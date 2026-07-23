export interface FaceLearnConfig {
  apiKey?: string;
  endpoint?: string;
  tenantId?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export interface IdentifyCandidate {
  id: number | string;
  name: string;
  similarity: number;
  confidence?: number;
}

export interface IdentifyResult {
  recognized: boolean;
  bestMatch: IdentifyCandidate | null;
  candidates: IdentifyCandidate[];
  allFaces: any[];
  processingTimeMs: number;
}

export interface HealthCheckResult {
  status: string;
  timestamp: string;
  database: {
    healthy: boolean;
    latencyMs: number;
    isPgBouncerActive?: boolean;
  };
  services: Record<string, any>;
}

export interface PersonItem {
  id: number;
  name: string;
  nameAr?: string | null;
  source: string;
  thumbnailUrl?: string | null;
  notes?: string | null;
  tenantId: string;
  createdAt: string;
  faceCount?: number;
}

export class FaceLearnClient {
  private config: Required<Pick<FaceLearnConfig, "endpoint" | "tenantId" | "maxRetries" | "retryDelayMs" | "timeoutMs">> & FaceLearnConfig;

  constructor(config: FaceLearnConfig) {
    const {
      endpoint = "http://localhost:8080/api",
      tenantId = "default_tenant",
      maxRetries = 3,
      retryDelayMs = 500,
      timeoutMs = 15000,
      ...rest
    } = config;
    this.config = {
      endpoint: endpoint.replace(/\/+$/, ""),
      tenantId,
      maxRetries,
      retryDelayMs,
      timeoutMs,
      ...rest,
    };
  }

  private async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (this.config.apiKey) headers.set("Authorization", `Bearer ${this.config.apiKey}`);
    if (this.config.tenantId) headers.set("X-Tenant-ID", this.config.tenantId);

    const url = `${this.config.endpoint}${path.startsWith("/") ? path : `/${path}`}`;
    let attempt = 0;
    const maxRetries = this.config.maxRetries;
    const baseDelay = this.config.retryDelayMs;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const res = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          // Retry on 502, 503, 504 server gateway errors
          if ([502, 503, 504].includes(res.status) && attempt < maxRetries) {
            attempt++;
            const delay = baseDelay * Math.pow(1.5, attempt - 1);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          throw new Error(`FaceLearn API Error [${res.status} ${res.statusText}]: ${errBody || "Request failed"}`);
        }
        return (await res.json()) as T;
      } catch (err: any) {
        clearTimeout(timeoutId);
        attempt++;
        const isNetworkErr =
          err.name === "AbortError" ||
          err.code === "ECONNREFUSED" ||
          err.code === "ECONNRESET" ||
          err.message?.includes("fetch failed") ||
          err.message?.includes("network");

        if (isNetworkErr && attempt <= maxRetries) {
          const delay = baseDelay * Math.pow(1.5, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`FaceLearn API Request failed after ${maxRetries} attempts`);
  }

  /**
   * Healthcheck & Telemetry
   */
  async getHealth(): Promise<HealthCheckResult> {
    return this.request("/healthz");
  }

  /**
   * Identifies all faces in the provided base64 image.
   */
  async identify(imageBase64: string, threshold: number = 0.52): Promise<IdentifyResult> {
    return this.request("/recognition/identify", {
      method: "POST",
      body: JSON.stringify({ image: imageBase64, threshold }),
    });
  }

  /**
   * Identity Management - List Persons
   */
  async listPersons(query?: { page?: number; limit?: number; search?: string }): Promise<{ persons: PersonItem[]; total: number; page: number; totalPages: number }> {
    const params = new URLSearchParams();
    if (query?.page) params.append("page", String(query.page));
    if (query?.limit) params.append("limit", String(query.limit));
    if (query?.search) params.append("search", query.search);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/persons${queryString}`);
  }

  /**
   * Identity Management - Get Person By ID
   */
  async getPerson(id: number): Promise<PersonItem> {
    return this.request(`/persons/${id}`);
  }

  /**
   * Identity Management - Enroll New Person
   */
  async enrollPerson(data: { name: string; nameAr?: string; source?: string; notes?: string }): Promise<PersonItem> {
    return this.request("/persons", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Identity Management - Delete Person
   */
  async deletePerson(id: number): Promise<{ success: boolean }> {
    return this.request(`/persons/${id}`, { method: "DELETE" });
  }

  /**
   * Identity Management - Add Face to Existing Person
   */
  async addFaceToPerson(personId: number, imageBase64: string): Promise<any> {
    return this.request(`/persons/${personId}/faces`, {
      method: "POST",
      body: JSON.stringify({ image: imageBase64 }),
    });
  }

  /**
   * Biometric Intelligence - XAI Match Decomposition
   */
  async explainMatch(sourceFaceId: string | number, targetFaceId: string | number) {
    return this.request("/intelligence/explain", {
      method: "POST",
      body: JSON.stringify({ sourceFaceId, targetFaceId }),
    });
  }

  /**
   * Biometric Intelligence - DBSCAN Density Clustering
   */
  async clusterUnassigned(eps: number = 0.30, minSamples: number = 2) {
    return this.request("/intelligence/cluster", {
      method: "POST",
      body: JSON.stringify({ eps, minSamples }),
    });
  }

  /**
   * Biometric Intelligence - Self Calibration
   */
  async selfCalibrate() {
    return this.request("/intelligence/self-calibrate", {
      method: "POST",
    });
  }

  /**
   * Enterprise Abstraction - Projects
   */
  async listProjects() {
    return this.request("/enterprise/projects");
  }

  async createProject(data: { name: string; description?: string }) {
    return this.request("/enterprise/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Enterprise Abstraction - Collections
   */
  async listCollections(projectId?: number) {
    const qs = projectId ? `?projectId=${projectId}` : "";
    return this.request(`/enterprise/collections${qs}`);
  }

  async createCollection(data: { projectId: number; name: string; description?: string }) {
    return this.request("/enterprise/collections", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Enterprise Abstraction - API Keys
   */
  async createApiKey(data: { projectId: number; keyName: string; role?: "ADMIN" | "SERVICE" | "READONLY" }) {
    return this.request("/enterprise/api-keys", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Start an ML Benchmark Experiment
   */
  async runExperiment(name: string, description?: string, algorithmVersion: string = "v5") {
    return this.request("/experiments/run", {
      method: "POST",
      body: JSON.stringify({ name, description, algorithmVersion }),
    });
  }

  /**
   * Fetch potentially duplicated faces across different persons for Dataset Cleaning
   */
  async findDuplicates() {
    return this.request("/dataset/duplicates");
  }

  /**
   * Exports the entire face embedding dataset securely
   */
  async exportDataset() {
    return this.request("/dataset/export");
  }
}
