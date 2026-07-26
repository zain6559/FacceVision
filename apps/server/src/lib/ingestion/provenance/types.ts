/**
 * FaceVision — Provenance Types
 * 
 * Tracks the complete history of data through the system:
 * - Source information
 * - Pipeline versions
 * - Processing history
 * - Data lineage
 */

// ─── Provenance Types ────────────────────────────────────────────────────────────

export interface ProvenanceRecord {
  id: string;
  entityId: string;
  entityType: EntityType;
  source: ProvenanceSource;
  pipeline: PipelineInfo;
  lineage: LineageEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export type EntityType = "IMAGE" | "EMBEDDING" | "PERSON" | "METADATA";

export interface ProvenanceSource {
  url: string;
  type: SourceCategory;
  license?: string;
  collectorId: string;
  collectedAt: Date;
  isOriginal: boolean;
  originalSourceUrl?: string;
}

export type SourceCategory = "NEWS" | "SOCIAL_MEDIA" | "WEB_CRAWL" | "ARCHIVE" | "USER_UPLOAD" | "API" | "OTHER";

export interface PipelineInfo {
  version: string;
  extractorVersion: string;
  modelVersion: string;
  schemaVersion: string;
  stages: PipelineStageInfo[];
}

export interface PipelineStageInfo {
  name: string;
  version: string;
  executedAt: Date;
  durationMs: number;
  success: boolean;
  parameters?: Record<string, unknown>;
}

export interface LineageEntry {
  operation: OperationType;
  performedBy: string;
  performedAt: Date;
  details?: Record<string, unknown>;
}

export type OperationType = 
  | "CREATED"
  | "EXTRACTED"
  | "PROCESSED"
  | "MATCHED"
  | "ENROLLED"
  | "UPDATED"
  | "MERGED"
  | "ARCHIVED"
  | "DELETED";

// ─── Version Tracking ────────────────────────────────────────────────────────────

export interface DataVersion {
  versionId: string;
  entityId: string;
  version: number;
  changes: VersionChanges;
  createdAt: Date;
  createdBy: string;
}

export interface VersionChanges {
  changedFields: string[];
  previousValues?: Record<string, unknown>;
  newValues: Record<string, unknown>;
}

// ─── Lineage Graph ──────────────────────────────────────────────────────────────

export interface LineageGraph {
  rootId: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
}

export interface LineageNode {
  id: string;
  type: EntityType;
  label: string;
  timestamp: Date;
}

export interface LineageEdge {
  source: string;
  target: string;
  relationship: string;
}
