/**
 * FaceVision — Recognition Orchestrator
 * 
 * Single entry point for all face recognition operations.
 * Delegates to the appropriate backend via the BackendRegistry.
 * 
 * This is NOT a service locator - it's a clean abstraction that:
 * - Maintains recognition state
 * - Coordinates between backends
 * - Handles fallback logic
 * - Provides a consistent API
 */

import { logger } from "../logger.js";
import { backendRegistry, BackendRegistry } from "./BackendRegistry.js";
import type {
  FaceEmbeddingBackend,
  EmbeddingResult,
  MatchResult,
  FaceDetectionResult,
  AlignedFace,
  BackendInfo
} from "./FaceEmbeddingBackend.js";

export interface RecognitionRequest {
  imageBase64: string;
  returnMultipleFaces?: boolean;
  minQualityScore?: number;
}

export interface RecognitionResponse {
  success: boolean;
  faces: EmbeddingResult[];
  primaryFace?: EmbeddingResult;
  processingTimeMs: number;
  backendUsed?: string;
  error?: string;
}

export interface MatchRequest {
  queryEmbedding: number[];
  candidateEmbeddings: Array<{
    embedding: number[];
    subEmbeddings?: EmbeddingResult["subEmbeddings"];
    metadata?: Record<string, unknown>;
  }>;
  threshold?: number;
  returnTopK?: number;
}

export interface MatchResponse {
  success: boolean;
  matches: Array<{
    embedding: number[];
    similarity: number;
    algorithmScores?: MatchResult["algorithmScores"];
    metadata?: Record<string, unknown>;
  }>;
  processingTimeMs: number;
}

/**
 * Orchestrator for face recognition operations.
 * Provides a unified interface to all recognition capabilities.
 */
export class RecognitionOrchestrator {
  private registry: BackendRegistry;
  private defaultThreshold: number = 0.6;

  constructor(registry: BackendRegistry = backendRegistry) {
    this.registry = registry;
  }

  /**
   * Set the default matching threshold.
   */
  setDefaultThreshold(threshold: number): void {
    this.defaultThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Get the current backend info.
   */
  getBackendInfo(): BackendInfo | null {
    return this.registry.getActiveBackendInfo();
  }

  /**
   * Get all available backends.
   */
  getAvailableBackends(): BackendInfo[] {
    return this.registry.getAllBackendsInfo();
  }

  /**
   * Switch to a different backend.
   */
  async switchBackend(backendId: string): Promise<void> {
    this.registry.setActiveBackend(backendId);
    logger.info({ backendId }, "Recognition orchestrator switched backend");
  }

  /**
   * Perform face recognition on an image.
   */
  async recognize(request: RecognitionRequest): Promise<RecognitionResponse> {
    const startTime = Date.now();
    const backend = this.registry.getActiveBackend();

    if (!backend) {
      return {
        success: false,
        faces: [],
        processingTimeMs: Date.now() - startTime,
        error: "No recognition backend available"
      };
    }

    try {
      // Convert base64 to buffer
      const base64Data = request.imageBase64.replace(/^data:[^;]+;base64,/i, "");
      const imageBuffer = Buffer.from(base64Data, "base64");

      // Detect and extract embeddings
      const results = await backend.processImage(imageBuffer);

      // Filter by quality if specified
      const filteredResults = request.minQualityScore
        ? results.filter(r => r.qualityScore >= (request.minQualityScore || 0))
        : results;

      const primaryFace = request.returnMultipleFaces 
        ? filteredResults[0] 
        : filteredResults[0];

      return {
        success: true,
        faces: filteredResults,
        primaryFace,
        processingTimeMs: Date.now() - startTime,
        backendUsed: backend.id
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error: errorMessage }, "Recognition failed");
      return {
        success: false,
        faces: [],
        processingTimeMs: Date.now() - startTime,
        backendUsed: backend.id,
        error: errorMessage
      };
    }
  }

  /**
   * Match query embedding against candidates.
   */
  async match(request: MatchRequest): Promise<MatchResponse> {
    const startTime = Date.now();
    const backend = this.registry.getActiveBackend();

    if (!backend) {
      return {
        success: false,
        matches: [],
        processingTimeMs: Date.now() - startTime,
      };
    }

    try {
      const threshold = request.threshold ?? this.defaultThreshold;
      const matches: MatchResponse["matches"] = [];

      for (const candidate of request.candidateEmbeddings) {
        const matchResult = backend.computeMatchScore(
          request.queryEmbedding,
          candidate.embedding,
          candidate.subEmbeddings
        );

        if (matchResult.similarity >= threshold) {
          matches.push({
            embedding: candidate.embedding,
            similarity: matchResult.similarity,
            algorithmScores: matchResult.algorithmScores,
            metadata: candidate.metadata
          });
        }
      }

      // Sort by similarity descending
      matches.sort((a, b) => b.similarity - a.similarity);

      // Limit to top K if specified
      const limitedMatches = request.returnTopK
        ? matches.slice(0, request.returnTopK)
        : matches;

      return {
        success: true,
        matches: limitedMatches,
        processingTimeMs: Date.now() - startTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error: errorMessage }, "Matching failed");
      return {
        success: false,
        matches: [],
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Detect faces only (without extraction).
   */
  async detectFaces(imageBase64: string): Promise<FaceDetectionResult> {
    const backend = this.registry.getActiveBackend();
    if (!backend) {
      return { faces: [] };
    }

    const base64Data = imageBase64.replace(/^data:[^;]+;base64,/i, "");
    const imageBuffer = Buffer.from(base64Data, "base64");
    return backend.detectFaces(imageBuffer);
  }

  /**
   * Align a face to standard pose.
   */
  async alignFace(imageBuffer: Buffer, face: { box: number[]; score?: number }): Promise<AlignedFace> {
    const backend = this.registry.getActiveBackend();
    if (!backend) {
      throw new Error("No recognition backend available");
    }
    return backend.alignFace(imageBuffer, face as any);
  }

  /**
   * Extract embedding from aligned face.
   */
  async extractEmbedding(alignedFaceBuffer: Buffer): Promise<number[]> {
    const backend = this.registry.getActiveBackend();
    if (!backend) {
      throw new Error("No recognition backend available");
    }
    return backend.extractEmbedding(alignedFaceBuffer);
  }

  /**
   * Compute similarity between two embeddings.
   */
  computeSimilarity(embeddingA: number[], embeddingB: number[]): number {
    const backend = this.registry.getActiveBackend();
    if (!backend) {
      return 0;
    }
    return backend.computeSimilarity(embeddingA, embeddingB);
  }

  /**
   * Check if the orchestrator is ready.
   */
  isReady(): boolean {
    return this.registry.isBackendReady();
  }
}

// Singleton instance
export const recognitionOrchestrator = new RecognitionOrchestrator();
