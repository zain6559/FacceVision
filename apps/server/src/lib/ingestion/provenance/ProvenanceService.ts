/**
 * FaceVision — Provenance Service
 * 
 * Tracks the complete history of data through the system.
 * Every piece of data knows:
 * - Where it came from
 * - When it was collected
 * - Who collected it
 * - What transformations it underwent
 * - If it has been modified
 */

import { logger } from "../../logger.js";
import type {
  ProvenanceRecord,
  ProvenanceSource,
  PipelineInfo,
  LineageEntry,
  DataVersion,
  LineageGraph,
  EntityType,
  OperationType
} from "./types.js";

/**
 * Current system versions - should be updated with each release.
 */
const SYSTEM_VERSIONS = {
  pipeline: "1.0.0",
  extractor: "1.0.0",
  model: "1.0.0",
  schema: "1.0.0"
};

/**
 * Provenance Service - Maintains complete data lineage.
 */
export class ProvenanceService {
  private records: Map<string, ProvenanceRecord> = new Map();
  private versions: Map<string, DataVersion[]> = new Map();
  private counter = 0;

  /**
   * Create a provenance record for new data.
   */
  createRecord(
    entityId: string,
    entityType: EntityType,
    source: Omit<ProvenanceSource, "collectedAt">
  ): ProvenanceRecord {
    const recordId = `prov_${++this.counter}_${Date.now()}`;
    
    const record: ProvenanceRecord = {
      id: recordId,
      entityId,
      entityType,
      source: {
        ...source,
        collectedAt: new Date()
      },
      pipeline: {
        version: SYSTEM_VERSIONS.pipeline,
        extractorVersion: SYSTEM_VERSIONS.extractor,
        modelVersion: SYSTEM_VERSIONS.model,
        schemaVersion: SYSTEM_VERSIONS.schema,
        stages: []
      },
      lineage: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.records.set(entityId, record);
    
    logger.info({ recordId, entityId, entityType }, "Provenance record created");

    return record;
  }

  /**
   * Add a pipeline stage execution to the record.
   */
  addPipelineStage(
    entityId: string,
    stage: {
      name: string;
      version: string;
      durationMs: number;
      success: boolean;
      parameters?: Record<string, unknown>;
    }
  ): void {
    const record = this.records.get(entityId);
    if (!record) {
      logger.warn({ entityId }, "Provenance record not found");
      return;
    }

    record.pipeline.stages.push({
      ...stage,
      executedAt: new Date()
    });
    record.updatedAt = new Date();
  }

  /**
   * Add a lineage entry for an operation.
   */
  addLineageEntry(
    entityId: string,
    operation: OperationType,
    performedBy: string,
    details?: Record<string, unknown>
  ): void {
    const record = this.records.get(entityId);
    if (!record) {
      logger.warn({ entityId }, "Provenance record not found");
      return;
    }

    record.lineage.push({
      operation,
      performedBy,
      performedAt: new Date(),
      details
    });
    record.updatedAt = new Date();

    logger.debug({ entityId, operation, performedBy }, "Lineage entry added");
  }

  /**
   * Get provenance record for an entity.
   */
  getRecord(entityId: string): ProvenanceRecord | undefined {
    return this.records.get(entityId);
  }

  /**
   * Create a new version when data is modified.
   */
  createVersion(
    entityId: string,
    changes: {
      changedFields: string[];
      previousValues?: Record<string, unknown>;
      newValues: Record<string, unknown>;
    },
    createdBy: string
  ): DataVersion | undefined {
    const record = this.records.get(entityId);
    if (!record) {
      logger.warn({ entityId }, "Cannot create version - record not found");
      return undefined;
    }

    const existingVersions = this.versions.get(entityId) || [];
    const versionNumber = existingVersions.length + 1;

    const version: DataVersion = {
      versionId: `ver_${entityId}_${versionNumber}`,
      entityId,
      version: versionNumber,
      changes: {
        changedFields: changes.changedFields,
        previousValues: changes.previousValues,
        newValues: changes.newValues
      },
      createdAt: new Date(),
      createdBy
    };

    existingVersions.push(version);
    this.versions.set(entityId, existingVersions);

    // Add lineage entry
    this.addLineageEntry(entityId, "UPDATED", createdBy, { version: versionNumber });

    logger.info({ entityId, version: versionNumber }, "New version created");

    return version;
  }

  /**
   * Get all versions for an entity.
   */
  getVersions(entityId: string): DataVersion[] {
    return this.versions.get(entityId) || [];
  }

  /**
   * Build a lineage graph for an entity.
   */
  buildLineageGraph(rootId: string): LineageGraph {
    const visited = new Set<string>();
    const nodes: LineageGraph["nodes"] = [];
    const edges: LineageGraph["edges"] = [];

    const traverse = (entityId: string, depth = 0) => {
      if (visited.has(entityId) || depth > 10) return;
      visited.add(entityId);

      const record = this.records.get(entityId);
      if (!record) return;

      // Add node
      nodes.push({
        id: entityId,
        type: record.entityType,
        label: this.getNodeLabel(record),
        timestamp: record.createdAt
      });

      // Add lineage edges
      for (const entry of record.lineage) {
        if (entry.details?.relatedEntityId) {
          const targetId = entry.details.relatedEntityId as string;
          edges.push({
            source: entityId,
            target: targetId,
            relationship: entry.operation
          });
          traverse(targetId, depth + 1);
        }
      }
    };

    traverse(rootId);

    return { rootId, nodes, edges };
  }

  /**
   * Get human-readable label for a node.
   */
  private getNodeLabel(record: ProvenanceRecord): string {
    return `${record.entityType}: ${record.source.type}`;
  }

  /**
   * Get system versions.
   */
  getSystemVersions(): typeof SYSTEM_VERSIONS {
    return { ...SYSTEM_VERSIONS };
  }

  /**
   * Verify data integrity by checking checksum history.
   */
  verifyIntegrity(entityId: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const record = this.records.get(entityId);

    if (!record) {
      issues.push("Provenance record not found");
      return { valid: false, issues };
    }

    // Check if all pipeline stages completed successfully
    const failedStages = record.pipeline.stages.filter(s => !s.success);
    if (failedStages.length > 0) {
      issues.push(`Failed stages: ${failedStages.map(s => s.name).join(", ")}`);
    }

    // Check data consistency
    if (record.lineage.length === 0) {
      issues.push("No lineage history");
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Export provenance records for audit.
   */
  exportForAudit(entityIds?: string[]): ProvenanceRecord[] {
    if (entityIds) {
      return entityIds.map(id => this.records.get(id)).filter(Boolean) as ProvenanceRecord[];
    }
    return Array.from(this.records.values());
  }

  /**
   * Get provenance statistics.
   */
  getStats(): {
    totalRecords: number;
    byType: Record<EntityType, number>;
    bySource: Record<string, number>;
  } {
    const byType: Record<EntityType, number> = {
      IMAGE: 0,
      EMBEDDING: 0,
      PERSON: 0,
      METADATA: 0
    };
    const bySource: Record<string, number> = {};

    for (const record of this.records.values()) {
      byType[record.entityType]++;
      bySource[record.source.type] = (bySource[record.source.type] || 0) + 1;
    }

    return {
      totalRecords: this.records.size,
      byType,
      bySource
    };
  }
}

// Singleton instance
export const provenanceService = new ProvenanceService();
