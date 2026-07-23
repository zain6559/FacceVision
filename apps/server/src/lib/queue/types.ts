export type QueueTopic =
  | "media.ingest"
  | "face.detection"
  | "face.embedding"
  | "face.index";

export interface MediaIngestMessage {
  jobId: string;
  mediaUrl: string;
  tenantId?: string;
  projectId?: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface FaceDetectionMessage {
  jobId: string;
  mediaUrl: string;
  imageBufferBase64?: string;
  tenantId?: string;
  projectId?: number;
  timestamp: string;
}

export interface FaceEmbeddingMessage {
  jobId: string;
  tenantId?: string;
  projectId?: number;
  alignedFaceBase64: string;
  box: { x: number; y: number; width: number; height: number };
  landmarks?: number[][];
  qualityScore: number;
  timestamp: string;
}

export interface FaceIndexMessage {
  jobId: string;
  personId?: number;
  tenantId?: string;
  projectId?: number;
  embedding: number[];
  qualityScore: number;
  algorithmVersion: string;
  timestamp: string;
}

export interface BackpressureMetrics {
  topic: QueueTopic;
  pendingCount: number;
  processingCount: number;
  consumerConcurrency: number;
  gpuUtilizationPct: number;
  memoryUsageMb: number;
  backpressureActive: boolean;
}

export interface QueueSystemStats {
  status: "ACTIVE" | "HIGH_LOAD_BACKPRESSURE" | "DEGRADED";
  targetThroughputPerSec: number;
  currentThroughputPerSec: number;
  topics: Record<QueueTopic, BackpressureMetrics>;
  timestamp: string;
}
