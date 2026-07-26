/**
 * FaceVision — Ingestion Pipeline Orchestrator
 * 
 * Implements the complete data pipeline:
 * 
 * Download → Hash → Deduplication → Quality Check → Metadata → Storage → Recognition
 * 
 * Each stage is independent and can be retried/failed separately.
 */

import { logger } from "../../logger.js";
import type { 
  PipelineContext, 
  PipelineStage, 
  PipelineResult,
  PipelineError,
  SourceRecord,
  QualityScore,
  ImageMetadata,
  DeduplicationResult,
  Checksum
} from "./types.js";
import { hashService } from "./services/HashService.js";
import { dedupService } from "./services/DeduplicationService.js";
import { qualityService } from "./services/QualityService.js";
import { metadataService } from "./services/MetadataService.js";
import { storageService } from "./services/StorageService.js";

/**
 * Pipeline Orchestrator - Manages the complete data flow.
 */
export class PipelineOrchestrator {
  private stages: PipelineStage[] = [
    "DOWNLOAD",
    "HASH",
    "DEDUP",
    "QUALITY",
    "METADATA",
    "STORAGE",
    "RECOGNITION"
  ];

  /**
   * Execute the complete pipeline for a single item.
   */
  async execute(
    jobId: string,
    sourceUrl: string
  ): Promise<PipelineResult<SourceRecord>> {
    const context: PipelineContext = {
      jobId,
      sourceUrl,
      currentStage: "DOWNLOAD",
      metadata: {},
      errors: [],
      startedAt: new Date()
    };

    logger.info({ jobId, sourceUrl }, "Starting pipeline execution");

    for (const stage of this.stages) {
      context.currentStage = stage;

      try {
        const result = await this.executeStage(context);
        
        if (!result.success) {
          // Check if error is retryable
          const lastError = result.errors[result.errors.length - 1];
          if (!lastError?.retryable) {
            logger.error({ jobId, stage, error: lastError }, "Pipeline failed at stage");
            return result;
          }
          
          // Retry logic could be added here
          logger.warn({ jobId, stage }, "Stage failed but is retryable");
        }

        if (context.metadata["skipRemaining"]) {
          logger.info({ jobId, stage }, "Skipping remaining stages");
          break;
        }

      } catch (error) {
        context.errors.push({
          stage,
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
          retryable: false
        });
        
        logger.error({ jobId, stage, error }, "Pipeline stage threw exception");
        
        // Continue to next stage or fail based on configuration
        if (!this.isStageCritical(stage)) {
          continue;
        }
        
        return {
          success: false,
          stage,
          errors: context.errors
        };
      }
    }

    logger.info({ 
      jobId, 
      stagesCompleted: this.stages.indexOf(context.currentStage) + 1 
    }, "Pipeline completed");

    return {
      success: context.errors.length === 0,
      data: context.metadata["sourceRecord"] as SourceRecord,
      stage: context.currentStage,
      errors: context.errors
    };
  }

  /**
   * Execute a single pipeline stage.
   */
  private async executeStage(context: PipelineContext): Promise<PipelineResult> {
    switch (context.currentStage) {
      case "DOWNLOAD":
        return this.executeDownload(context);
      case "HASH":
        return this.executeHash(context);
      case "DEDUP":
        return this.executeDedup(context);
      case "QUALITY":
        return this.executeQuality(context);
      case "METADATA":
        return this.executeMetadata(context);
      case "STORAGE":
        return this.executeStorage(context);
      case "RECOGNITION":
        return this.executeRecognition(context);
      default:
        return { success: true, stage: context.currentStage, errors: [] };
    }
  }

  /**
   * Download stage - Fetches the raw image/content.
   */
  private async executeDownload(context: PipelineContext): Promise<PipelineResult<{ buffer: Buffer; contentType: string }>> {
    logger.debug({ jobId: context.jobId }, "Executing DOWNLOAD stage");

    // Simulated download - in real implementation, use fetch/axios
    const buffer = Buffer.from([]);
    const contentType = "image/jpeg";

    context.metadata["downloadedBuffer"] = buffer;
    context.metadata["contentType"] = contentType;

    return {
      success: true,
      data: { buffer, contentType },
      stage: "DOWNLOAD",
      errors: []
    };
  }

  /**
   * Hash stage - Generates SHA256 and Perceptual Hash.
   */
  private async executeHash(context: PipelineContext): Promise<PipelineResult<Checksum>> {
    logger.debug({ jobId: context.jobId }, "Executing HASH stage");

    const buffer = context.metadata["downloadedBuffer"] as Buffer;
    const checksum = await hashService.computeChecksum(buffer);

    context.metadata["checksum"] = checksum;

    return {
      success: true,
      data: checksum,
      stage: "HASH",
      errors: []
    };
  }

  /**
   * Deduplication stage - Checks for duplicates using multiple strategies.
   */
  private async executeDedup(context: PipelineContext): Promise<PipelineResult<DeduplicationResult>> {
    logger.debug({ jobId: context.jobId }, "Executing DEDUP stage");

    const checksum = context.metadata["checksum"] as Checksum;
    const buffer = context.metadata["downloadedBuffer"] as Buffer;

    const dedupResult = await dedupService.checkDuplicate(
      checksum.sha256,
      checksum.pHash,
      buffer
    );

    context.metadata["dedupResult"] = dedupResult;

    if (dedupResult.isDuplicate) {
      logger.info({ 
        jobId: context.jobId, 
        duplicateOf: dedupResult.duplicateOf,
        matchType: dedupResult.matchType
      }, "Duplicate detected, skipping remaining stages");
      
      context.metadata["skipRemaining"] = true;
    }

    return {
      success: !dedupResult.isDuplicate,
      data: dedupResult,
      stage: "DEDUP",
      errors: []
    };
  }

  /**
   * Quality stage - Assesses image quality.
   */
  private async executeQuality(context: PipelineContext): Promise<PipelineResult<QualityScore>> {
    logger.debug({ jobId: context.jobId }, "Executing QUALITY stage");

    const buffer = context.metadata["downloadedBuffer"] as Buffer;
    const quality = await qualityService.assessQuality(buffer);

    context.metadata["qualityScore"] = quality;

    // If quality is too low, skip recognition
    if (quality.overall < 30) {
      logger.warn({ jobId: context.jobId, quality: quality.overall }, "Quality too low, skipping");
      context.metadata["skipRemaining"] = true;
    }

    return {
      success: quality.overall >= 30,
      data: quality,
      stage: "QUALITY",
      errors: []
    };
  }

  /**
   * Metadata extraction stage.
   */
  private async executeMetadata(context: PipelineContext): Promise<PipelineResult<ImageMetadata>> {
    logger.debug({ jobId: context.jobId }, "Executing METADATA stage");

    const buffer = context.metadata["downloadedBuffer"] as Buffer;
    const metadata = await metadataService.extractMetadata(buffer);

    context.metadata["imageMetadata"] = metadata;

    return {
      success: true,
      data: metadata,
      stage: "METADATA",
      errors: []
    };
  }

  /**
   * Storage stage - Saves the processed data.
   */
  private async executeStorage(context: PipelineContext): Promise<PipelineResult<SourceRecord>> {
    logger.debug({ jobId: context.jobId }, "Executing STORAGE stage");

    const record = await storageService.store(context);

    context.metadata["sourceRecord"] = record;
    context.metadata["skipRemaining"] = true; // Recognition is async

    return {
      success: true,
      data: record,
      stage: "STORAGE",
      errors: []
    };
  }

  /**
   * Recognition stage - Queues for async recognition processing.
   */
  private async executeRecognition(context: PipelineContext): Promise<PipelineResult> {
    logger.debug({ jobId: context.jobId }, "Executing RECOGNITION stage");

    // In real implementation, publish to recognition queue
    // eventProducer.publish("face.embedding", { jobId: context.jobId, ... });

    return {
      success: true,
      stage: "RECOGNITION",
      errors: []
    };
  }

  /**
   * Check if a stage is critical (fails the pipeline).
   */
  private isStageCritical(stage: PipelineStage): boolean {
    const criticalStages: PipelineStage[] = ["DOWNLOAD", "HASH", "STORAGE"];
    return criticalStages.includes(stage);
  }

  /**
   * Get pipeline statistics.
   */
  getStats(): {
    totalStages: number;
    stages: PipelineStage[];
  } {
    return {
      totalStages: this.stages.length,
      stages: this.stages
    };
  }
}

// Singleton instance
export const pipelineOrchestrator = new PipelineOrchestrator();
