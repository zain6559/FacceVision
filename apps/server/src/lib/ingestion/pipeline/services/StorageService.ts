/**
 * FaceVision — Storage Service
 * 
 * Stores processed data and manages provenance.
 */

import { logger } from "../../../logger.js";
import type { PipelineContext, SourceRecord, SourceType } from "../types.js";

/**
 * Storage Service - Persists processed data with provenance.
 */
export class StorageService {
  private storageCounter = 0;

  /**
   * Store the processed data and create source record.
   */
  async store(context: PipelineContext): Promise<SourceRecord> {
    logger.debug({ jobId: context.jobId }, "Storing processed data");

    const checksum = context.metadata["checksum"];
    const metadata = context.metadata["imageMetadata"];
    const qualityScore = context.metadata["qualityScore"];
    const contentType = context.metadata["contentType"] || "image/jpeg";

    // Create source record with provenance
    const record: SourceRecord = {
      id: `src_${++this.storageCounter}_${Date.now()}`,
      sourceUrl: context.sourceUrl,
      sourceType: this.detectSourceType(context.sourceUrl),
      collectedAt: new Date(),
      collectorId: "pipeline-orchestrator",
      license: this.detectLicense(context.sourceUrl),
      checksum: checksum || { sha256: "unknown" },
      contentType
    };

    // In production:
    // 1. Store image to S3/GCS/Azure Blob
    // 2. Store metadata to database
    // 3. Update search index
    // 4. Record provenance

    logger.info({ 
      jobId: context.jobId, 
      recordId: record.id,
      sourceType: record.sourceType 
    }, "Data stored successfully");

    return record;
  }

  /**
   * Detect source type from URL.
   */
  private detectSourceType(url: string): SourceType {
    const lower = url.toLowerCase();

    if (lower.includes("instagram")) return "SOCIAL";
    if (lower.includes("facebook")) return "SOCIAL";
    if (lower.includes("twitter") || lower.includes("x.com")) return "SOCIAL";
    if (lower.includes("linkedin")) return "SOCIAL";
    if (lower.includes("news") || lower.includes("article")) return "NEWS";
    if (lower.includes("cdn") || lower.includes("cloudfront")) return "CDN";
    if (lower.includes("archive.org") || lower.includes("wayback")) return "ARCHIVE";
    
    return "UNKNOWN";
  }

  /**
   * Detect license from URL or metadata.
   */
  private detectLicense(url: string): string {
    const lower = url.toLowerCase();

    // Creative Commons licenses
    if (lower.includes("creativecommons.org/publicdomain")) {
      return "CC0" + (lower.includes("by") ? "-PD" : "");
    }
    if (lower.includes("creativecommons.org/licenses/by")) {
      return "CC-BY" + (lower.includes("nc") ? "-NC" : "");
    }

    // Default to unknown - should be verified
    return "UNKNOWN";
  }

  /**
   * Get storage statistics.
   */
  getStats(): { totalStored: number } {
    return {
      totalStored: this.storageCounter
    };
  }
}

// Singleton instance
export const storageService = new StorageService();
