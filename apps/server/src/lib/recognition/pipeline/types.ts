/**
 * FaceVision — Intelligent Recognition Pipeline Types
 * 
 * Defines types for the smart recognition pipeline:
 * - Intelligent routing based on quality
 * - Adaptive threshold
 * - Re-ranking
 */

import type { QualityScore } from "../../ingestion/pipeline/types.js";

// ─── Pipeline Types ────────────────────────────────────────────────────────────

export type RecognitionStage = 
  | "DETECTION"
  | "QUALITY_CHECK"
  | "ALIGNMENT"
  | "POSE_ESTIMATION"
  | "OCCLUSION_DETECTION"
  | "EMBEDDING"
  | "EMBEDDING_QUALITY"
  | "SEARCH"
  | "RERANK"
  | "CALIBRATION"
  | "DECISION";

export interface RecognitionPipelineContext {
  requestId: string;
  imageBuffer: Buffer;
  currentStage: RecognitionStage;
  detection?: DetectionResult;
  quality?: QualityScore;
  alignment?: AlignmentResult;
  embedding?: EmbeddingResult;
  search?: SearchResult[];
  reranked?: RerankedResult[];
  decision?: FinalDecision;
  errors: PipelineError[];
  startedAt: Date;
  metadata: Record<string, unknown>;
}

export interface PipelineError {
  stage: RecognitionStage;
  message: string;
  timestamp: Date;
  retryable: boolean;
}

// ─── Detection Types ────────────────────────────────────────────────────────────

export interface DetectionResult {
  faces: DetectedFace[];
  modelVersion: string;
  detectorType: string;
  detectionTimeMs: number;
}

export interface DetectedFace {
  faceId: string;
  boundingBox: BoundingBox;
  landmarks: Landmark5;
  landmarks106?: Landmark106;
  confidence: number;
  age?: number;
  gender?: "M" | "F";
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export type Landmark5 = [Point2D, Point2D, Point2D, Point2D, Point2D];
export type Landmark106 = Point2D[];

// ─── Alignment Types ────────────────────────────────────────────────────────────

export interface AlignmentResult {
  alignedFace: Buffer;
  alignedImage: Buffer;
  landmarks: Landmark5;
  transformationMatrix: number[][];
  method: AlignmentMethod;
}

export type AlignmentMethod = "AFFINE" | "SIMILARITY" | "PROJECTIVE" | "NONE";

// ─── Embedding Types ────────────────────────────────────────────────────────────

export interface EmbeddingResult {
  embedding: number[];
  dimension: number;
  modelVersion: string;
  embeddingVersion: string;
  normalization: NormalizationType;
  quality: EmbeddingQuality;
  extractionTimeMs: number;
}

export type NormalizationType = "L2" | "L1" | "NONE";

export interface EmbeddingQuality {
  overall: number;
  components: {
    magnitude: number;
    variance: number;
    uniqueness: number;
  };
}

// ─── Search Types ──────────────────────────────────────────────────────────────

export interface SearchResult {
  subjectId: number;
  personName: string;
  similarity: number;
  embeddingId: string;
  sourceUrl?: string;
  lastSeen?: Date;
  matchCount: number;
}

// ─── Re-ranking Types ──────────────────────────────────────────────────────────

export interface RerankedResult extends SearchResult {
  rerankScore: number;
  factors: RerankFactor[];
}

export interface RerankFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

// ─── Decision Types ─────────────────────────────────────────────────────────────

export interface FinalDecision {
  recognized: boolean;
  subjectId?: number;
  personName?: string;
  confidence: number;
  threshold: AdaptiveThreshold;
  verdict: DecisionVerdict;
  explanation: Explanation;
  alternativeMatches: SearchResult[];
}

export type DecisionVerdict = 
  | "VERIFIED_MATCH"
  | "LIKELY_MATCH"
  | "UNLIKELY_MATCH"
  | "NO_MATCH"
  | "NEEDS_REVIEW"
  | "LOW_QUALITY";

export interface AdaptiveThreshold {
  value: number;
  factors: ThresholdFactor[];
  model: string;
}

export interface ThresholdFactor {
  name: string;
  influence: number;       // How much this factor affects threshold
  value: number;          // Current value
  adjustedThreshold: number;
}

export interface Explanation {
  summary: string;
  factors: ExplanationFactor[];
  confidence: number;
  recommendations?: string[];
}

export interface ExplanationFactor {
  category: "QUALITY" | "MATCH" | "CONTEXT" | "HISTORY";
  name: string;
  description: string;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  weight: number;
}

// ─── Adaptive Threshold Types ─────────────────────────────────────────────────

export interface ThresholdContext {
  qualityScore: QualityScore;
  faceSize: number;
  lightingCondition: "GOOD" | "MODERATE" | "POOR";
  poseScore: number;
  occlusionLevel: number;
  age?: number;
  hasMask?: boolean;
  galleryQuality?: number;
}
