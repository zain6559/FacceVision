/**
 * FaceVision — Intelligent Recognition Pipeline
 * 
 * Smart pipeline that makes decisions during execution:
 * 
 * Image
 *   ↓
 * Detection
 *   ↓
 * Quality Check ──→ If low quality → Skip to review
 *   ↓
 * Alignment ──────→ If model doesn't need it → Skip
 *   ↓
 * Pose Estimation
 *   ↓
 * Occlusion Detection
 *   ↓
 * Embedding
 *   ↓
 * Embedding Quality ──→ If poor → Mark for review
 *   ↓
 * ANN Search
 *   ↓
 * Re-ranking (Quality, Temporal, Knowledge)
 *   ↓
 * Adaptive Threshold
 *   ↓
 * Decision with Explanation
 */

import { logger } from "../../logger.js";
import type {
  RecognitionPipelineContext,
  RecognitionStage,
  DetectionResult,
  QualityScore,
  EmbeddingResult,
  SearchResult,
  RerankedResult,
  FinalDecision,
  AdaptiveThreshold,
  ThresholdContext
} from "./types.js";
import { createDetector, FaceDetector } from "../detectors/DetectorInterface.js";
import { createAlignmentPolicy, AlignmentPolicy } from "../alignment/AlignmentPolicy.js";
import { createAdaptiveThreshold, AdaptiveThresholdEngine } from "../threshold/AdaptiveThreshold.js";
import { createReranker, Reranker } from "../rerank/ReRanker.js";
import { createEmbeddingCache, EmbeddingCache } from "../cache/EmbeddingCache.js";

/**
 * Pipeline configuration.
 */
export interface PipelineConfig {
  enableAdaptiveAlignment: boolean;
  enableQualityGate: boolean;
  enableReranking: boolean;
  enableAdaptiveThreshold: boolean;
  enableEmbeddingCache: boolean;
  maxFacesPerImage: number;
  minFaceSize: number;
  defaultThreshold: number;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: PipelineConfig = {
  enableAdaptiveAlignment: true,
  enableQualityGate: true,
  enableReranking: true,
  enableAdaptiveThreshold: true,
  enableEmbeddingCache: true,
  maxFacesPerImage: 10,
  minFaceSize: 64,
  defaultThreshold: 0.5
};

/**
 * Intelligent Recognition Pipeline.
 */
export class IntelligentRecognitionPipeline {
  private config: PipelineConfig;
  private detector: FaceDetector;
  private alignmentPolicy: AlignmentPolicy;
  private thresholdEngine: AdaptiveThresholdEngine;
  private reranker: Reranker;
  private embeddingCache: EmbeddingCache;
  
  private counter = 0;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize components
    this.detector = createDetector("scrfd");
    this.alignmentPolicy = createAlignmentPolicy();
    this.thresholdEngine = createAdaptiveThreshold();
    this.reranker = createReranker();
    this.embeddingCache = createEmbeddingCache();
  }

  /**
   * Process an image through the intelligent pipeline.
   */
  async process(imageBuffer: Buffer): Promise<FinalDecision> {
    const requestId = `req_${++this.counter}_${Date.now()}`;
    
    const context: RecognitionPipelineContext = {
      requestId,
      imageBuffer,
      currentStage: "DETECTION",
      errors: [],
      startedAt: new Date(),
      metadata: {}
    };

    logger.info({ requestId }, "Starting intelligent recognition pipeline");

    try {
      // Stage 1: Detection
      context.detection = await this.executeDetection(context);
      
      // Check if any faces detected
      if (!context.detection || context.detection.faces.length === 0) {
        return this.makeDecision(context, "NO_MATCH");
      }

      // Stage 2: Quality Check (optional gate)
      if (this.config.enableQualityGate) {
        context.quality = await this.assessQuality(context);
        
        if (context.quality.overall < 30) {
          logger.warn({ requestId, quality: context.quality.overall }, "Quality too low");
          return this.makeDecision(context, "LOW_QUALITY");
        }
      }

      // Stage 3: Alignment (policy-based)
      if (this.config.enableAdaptiveAlignment) {
        context.alignment = await this.executeAlignment(context);
      }

      // Stage 4-6: Embedding extraction
      context.embedding = await this.executeEmbedding(context);

      // Check embedding quality
      if (context.embedding.quality.overall < 40) {
        logger.warn({ requestId, embeddingQuality: context.embedding.quality.overall }, "Embedding quality low");
        return this.makeDecision(context, "NEEDS_REVIEW");
      }

      // Stage 7: Search
      context.search = await this.executeSearch(context);

      // Stage 8: Re-ranking (optional)
      if (this.config.enableReranking && context.search.length > 0) {
        context.reranked = await this.executeReranking(context);
      }

      // Stage 9-11: Decision with adaptive threshold
      const decision = await this.makeFinalDecision(context);

      logger.info({ 
        requestId, 
        decision: decision.verdict,
        confidence: decision.confidence 
      }, "Pipeline completed");

      return decision;

    } catch (error) {
      logger.error({ requestId, error }, "Pipeline failed");
      context.errors.push({
        stage: context.currentStage,
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
        retryable: true
      });

      return this.makeDecision(context, "NO_MATCH");
    }
  }

  /**
   * Execute face detection.
   */
  private async executeDetection(context: RecognitionPipelineContext): Promise<DetectionResult> {
    context.currentStage = "DETECTION";
    logger.debug({ requestId: context.requestId }, "Stage: DETECTION");

    const result = await this.detector.detect(context.imageBuffer, {
      maxFaces: this.config.maxFacesPerImage,
      minFaceSize: this.config.minFaceSize
    });

    logger.debug({ requestId: context.requestId, facesFound: result.faces.length }, "Detection complete");

    return result;
  }

  /**
   * Assess image quality for recognition.
   */
  private async assessQuality(context: RecognitionPipelineContext): Promise<QualityScore> {
    context.currentStage = "QUALITY_CHECK";
    logger.debug({ requestId: context.requestId }, "Stage: QUALITY_CHECK");

    // In production: use actual quality assessment
    return {
      overall: 70,
      sharpness: 80,
      brightness: 65,
      contrast: 75,
      faceSize: context.detection?.faces[0]?.boundingBox.width || 100,
      pose: { yaw: 5, pitch: 3, roll: 2, penalty: 0.1 },
      occlusion: 0.1,
      noise: 15
    };
  }

  /**
   * Execute alignment based on policy.
   */
  private async executeAlignment(context: RecognitionPipelineContext): Promise<{ aligned: Buffer; method: string } | undefined> {
    context.currentStage = "ALIGNMENT";
    logger.debug({ requestId: context.requestId }, "Stage: ALIGNMENT");

    // Check if alignment is needed based on policy
    const needsAlignment = this.alignmentPolicy.needsAlignment(
      context.detection?.faces[0]?.landmarks,
      context.quality
    );

    if (!needsAlignment) {
      logger.debug({ requestId: context.requestId }, "Alignment skipped by policy");
      return undefined;
    }

    // Execute alignment
    return {
      aligned: context.imageBuffer, // Would be actual aligned face
      method: "SIMILARITY"
    };
  }

  /**
   * Execute embedding extraction.
   */
  private async executeEmbedding(context: RecognitionPipelineContext): Promise<EmbeddingResult> {
    context.currentStage = "EMBEDDING";
    logger.debug({ requestId: context.requestId }, "Stage: EMBEDDING");

    // Check cache first
    if (this.config.enableEmbeddingCache) {
      const cached = await this.embeddingCache.get(context.imageBuffer);
      if (cached) {
        logger.debug({ requestId: context.requestId }, "Using cached embedding");
        return cached;
      }
    }

    // In production: extract actual embedding from model
    const embedding = new Array(512).fill(0).map(() => Math.random());
    const result: EmbeddingResult = {
      embedding,
      dimension: 512,
      modelVersion: "1.0.0",
      embeddingVersion: "1.0.0",
      normalization: "L2",
      quality: {
        overall: 85,
        components: {
          magnitude: 1.0,
          variance: 0.3,
          uniqueness: 0.7
        }
      },
      extractionTimeMs: 50
    };

    // Cache the embedding
    if (this.config.enableEmbeddingCache) {
      await this.embeddingCache.set(context.imageBuffer, result);
    }

    return result;
  }

  /**
   * Execute ANN search.
   */
  private async executeSearch(context: RecognitionPipelineContext): Promise<SearchResult[]> {
    context.currentStage = "SEARCH";
    logger.debug({ requestId: context.requestId }, "Stage: SEARCH");

    // In production: execute ANN search (FAISS, Milvus, etc.)
    // For now, return simulated results
    return [
      {
        subjectId: 1,
        personName: "John Doe",
        similarity: 0.85,
        embeddingId: "emb_001",
        sourceUrl: "https://example.com/john.jpg",
        matchCount: 5
      },
      {
        subjectId: 2,
        personName: "Jane Smith",
        similarity: 0.72,
        embeddingId: "emb_002",
        matchCount: 2
      }
    ];
  }

  /**
   * Execute re-ranking.
   */
  private async executeReranking(context: RecognitionPipelineContext): Promise<RerankedResult[]> {
    context.currentStage = "RERANK";
    logger.debug({ requestId: context.requestId }, "Stage: RERANK");

    const reranked = await this.reranker.rerank(
      context.embedding!,
      context.search!,
      context.quality
    );

    logger.debug({ requestId: context.requestId, results: reranked.length }, "Re-ranking complete");

    return reranked;
  }

  /**
   * Make final decision with adaptive threshold.
   */
  private async makeFinalDecision(context: RecognitionPipelineContext): Promise<FinalDecision> {
    context.currentStage = "DECISION";
    logger.debug({ requestId: context.requestId }, "Stage: DECISION");

    const results = context.reranked || context.search || [];
    if (results.length === 0) {
      return this.makeDecision(context, "NO_MATCH");
    }

    // Calculate adaptive threshold
    const thresholdContext: ThresholdContext = {
      qualityScore: context.quality!,
      faceSize: context.detection?.faces[0]?.boundingBox.width || 100,
      lightingCondition: "GOOD",
      poseScore: context.quality?.pose.penalty || 0.1,
      occlusionLevel: context.quality?.occlusion || 0.1
    };

    const adaptiveThreshold = await this.thresholdEngine.calculate(thresholdContext);

    // Get top match
    const topMatch = results[0];

    // Determine verdict based on threshold
    let verdict: FinalDecision["verdict"];
    if (topMatch.rerankScore !== undefined) {
      if (topMatch.rerankScore >= adaptiveThreshold.value * 1.1) {
        verdict = "VERIFIED_MATCH";
      } else if (topMatch.rerankScore >= adaptiveThreshold.value) {
        verdict = "LIKELY_MATCH";
      } else if (topMatch.rerankScore >= adaptiveThreshold.value * 0.8) {
        verdict = "UNLIKELY_MATCH";
      } else {
        verdict = "NO_MATCH";
      }
    } else {
      if (topMatch.similarity >= adaptiveThreshold.value * 1.1) {
        verdict = "VERIFIED_MATCH";
      } else if (topMatch.similarity >= adaptiveThreshold.value) {
        verdict = "LIKELY_MATCH";
      } else if (topMatch.similarity >= adaptiveThreshold.value * 0.8) {
        verdict = "UNLIKELY_MATCH";
      } else {
        verdict = "NO_MATCH";
      }
    }

    const confidence = topMatch.rerankScore ?? topMatch.similarity;

    // Generate explanation
    const explanation = this.generateExplanation(context, adaptiveThreshold, confidence);

    return {
      recognized: verdict === "VERIFIED_MATCH" || verdict === "LIKELY_MATCH",
      subjectId: topMatch.subjectId,
      personName: topMatch.personName,
      confidence,
      threshold: adaptiveThreshold,
      verdict,
      explanation,
      alternativeMatches: results.slice(1, 4)
    };
  }

  /**
   * Make a simple decision without full pipeline.
   */
  private makeDecision(
    context: RecognitionPipelineContext,
    verdict: FinalDecision["verdict"]
  ): FinalDecision {
    return {
      recognized: false,
      confidence: 0,
      threshold: {
        value: this.config.defaultThreshold,
        factors: [],
        model: "default"
      },
      verdict,
      explanation: {
        summary: `Pipeline ended with verdict: ${verdict}`,
        factors: [],
        confidence: 0
      },
      alternativeMatches: []
    };
  }

  /**
   * Generate explanation for the decision.
   */
  private generateExplanation(
    context: RecognitionPipelineContext,
    threshold: AdaptiveThreshold,
    confidence: number
  ): FinalDecision["explanation"] {
    const factors = [];

    // Quality factor
    if (context.quality) {
      factors.push({
        category: "QUALITY" as const,
        name: "Image Quality",
        description: `Overall quality score: ${context.quality.overall}/100`,
        impact: context.quality.overall >= 70 ? "POSITIVE" as const : "NEGATIVE" as const,
        weight: 0.3
      });
    }

    // Embedding quality factor
    if (context.embedding?.quality) {
      factors.push({
        category: "QUALITY" as const,
        name: "Embedding Quality",
        description: `Embedding variance: ${context.embedding.quality.components.variance.toFixed(2)}`,
        impact: context.embedding.quality.overall >= 70 ? "POSITIVE" as const : "NEGATIVE" as const,
        weight: 0.2
      });
    }

    // Match confidence factor
    factors.push({
      category: "MATCH" as const,
      name: "Match Confidence",
      description: `Similarity score: ${(confidence * 100).toFixed(1)}%`,
      impact: confidence >= threshold.value ? "POSITIVE" as const : "NEGATIVE" as const,
      weight: 0.5
    });

    const positiveFactors = factors.filter(f => f.impact === "POSITIVE").length;
    const totalFactors = factors.length;
    const explanationConfidence = positiveFactors / totalFactors;

    return {
      summary: `Face ${context.detection?.faces.length || 0} detected with ${(confidence * 100).toFixed(1)}% confidence`,
      factors,
      confidence: explanationConfidence,
      recommendations: confidence < threshold.value 
        ? ["Consider requesting higher quality image", "Try different lighting conditions"]
        : undefined
    };
  }

  /**
   * Get pipeline configuration.
   */
  getConfig(): PipelineConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const intelligentPipeline = new IntelligentRecognitionPipeline();
