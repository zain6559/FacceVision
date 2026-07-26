/**
 * FaceVision — Ingestion Pipeline Types
 * 
 * Defines the data flow types for the ingestion system:
 * Raw → Download → Hash → Deduplication → Quality → Metadata → Storage → Recognition
 */

// ─── Pipeline Types ─────────────────────────────────────────────────────────────

export type PipelineStage = 
  | "DOWNLOAD"
  | "HASH"
  | "DEDUP"
  | "QUALITY"
  | "METADATA"
  | "STORAGE"
  | "RECOGNITION";

export interface PipelineContext {
  jobId: string;
  sourceUrl: string;
  currentStage: PipelineStage;
  metadata: Record<string, unknown>;
  errors: PipelineError[];
  startedAt: Date;
}

export interface PipelineError {
  stage: PipelineStage;
  message: string;
  timestamp: Date;
  retryable: boolean;
}

export interface PipelineResult<T = unknown> {
  success: boolean;
  data?: T;
  stage: PipelineStage;
  errors: PipelineError[];
}

// ─── Data Record Types ─────────────────────────────────────────────────────────

export interface SourceRecord {
  id: string;
  sourceUrl: string;
  sourceType: SourceType;
  collectedAt: Date;
  collectorId: string;
  license?: string;
  checksum: Checksum;
  contentType: string;
}

export type SourceType = "NEWS" | "SOCIAL" | "CDN" | "ARCHIVE" | "DIRECT" | "UNKNOWN";

export interface Checksum {
  sha256: string;
  pHash?: string;
  md5?: string;
}

// ─── Quality Types ─────────────────────────────────────────────────────────────

export interface QualityScore {
  overall: number;           // 0-100
  sharpness: number;        // Blur detection
  brightness: number;       // Illumination
  contrast: number;         // Contrast ratio
  faceSize: number;         // Face pixel area
  pose: PoseScore;
  occlusion: number;        // Occlusion level
  noise: number;            // Noise level
}

export interface PoseScore {
  yaw: number;              // Left-right rotation
  pitch: number;            // Up-down rotation
  roll: number;             // Tilt
  penalty: number;          // Combined penalty
}

// ─── Metadata Types ─────────────────────────────────────────────────────────────

export interface ImageMetadata {
  resolution: { width: number; height: number };
  colorSpace: string;
  format: string;
  sizeBytes: number;
  exif?: ExifData;
  gps?: { latitude: number; longitude: number };
  timestamp?: Date;
  cameraModel?: string;
  orientation?: number;
}

export interface ExifData {
  make?: string;
  model?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: number;
  focalLength?: string;
  dateTimeOriginal?: string;
}

// ─── Deduplication Types ────────────────────────────────────────────────────────

export interface DeduplicationResult {
  isDuplicate: boolean;
  duplicateOf?: string;
  matchType: DeduplicationMatchType;
  confidence: number;
}

export type DeduplicationMatchType = 
  | "EXACT_HASH"
  | "PERCEPTUAL_HASH"
  | "EMBEDDING_DISTANCE"
  | "METADATA_MATCH"
  | "NONE";

// ─── Worker Types ────────────────────────────────────────────────────────────────

export interface IngestionJob {
  id: string;
  source: string;
  sourceType: SourceType;
  priority: JobPriority;
  payload: unknown;
  createdAt: Date;
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
}

export type JobPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

// ─── Queue Topics ───────────────────────────────────────────────────────────────

export type IngestionQueueTopic =
  | "ingest.raw"
  | "ingest.quality"
  | "ingest.dedup"
  | "ingest.recognize"
  | "ingest.knowledge"
  | "ingest.archive";

// ─── Search Provider Types ──────────────────────────────────────────────────────

export interface SearchProvider {
  readonly id: string;
  readonly name: string;
  
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  supportsImageSearch(): boolean;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  language?: string;
  safeSearch?: boolean;
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  imageUrl?: string;
  publishedAt?: Date;
  source: string;
}
