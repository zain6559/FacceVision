/**
 * InsightFace Core Architecture — TypeScript Type Definitions
 *
 * Defines official InsightFace data structures:
 * - 5-Point & 106-Point Facial Landmarks
 * - Bounding Boxes & Detection Telemetry
 * - ArcFace 512-dim Embeddings & Partial FC
 * - SCRFD / RetinaFace Anchor Specs
 * - Buffalo & Antelope Model Packs
 * - Model Provider Abstraction Interface
 */

export interface Point2D {
  x: number;
  y: number;
}

export type Landmark5 = [Point2D, Point2D, Point2D, Point2D, Point2D]; // [LeftEye, RightEye, Nose, LeftMouth, RightMouth]
export type Landmark106 = Point2D[];

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
}

export interface DetectedFace {
  box: BoundingBox;
  landmarks: Landmark5;
  landmarks106?: Landmark106;
  score: number;
  age?: number;
  gender?: "M" | "F";
  genderScore?: number;
}

export interface QualityMetrics {
  overallScore: number;       // Combined quality [0.0 - 1.0]
  blurScore: number;          // Sharpness evaluation
  illuminationScore: number;  // Contrast and lighting uniformity
  poseScore: number;          // Yaw/Pitch/Roll deviation penalty
  occlusionScore: number;     // Landmark visibility score
  pose: {
    yaw: number;   // In-plane / out-of-plane rotation (degrees)
    pitch: number;
    roll: number;
  };
}

export interface AlignedFaceResult {
  alignedBuffer: Buffer;      // 112x112 RGB raw image buffer
  landmarks: Landmark5;
  quality: QualityMetrics;
}

export interface EmbeddingResult {
  embedding: Float32Array;    // 512-dimensional L2-normalized ArcFace embedding
  quality: QualityMetrics;
  modelVersion: string;
  modelPack: string;
  executionTimeMs: number;
}

export type ONNXExecutionProvider = "cuda" | "tensorrt" | "directml" | "coreml" | "cpu";

export interface ONNXProviderConfig {
  preferredProviders: ONNXExecutionProvider[];
  deviceDeviceId?: number;
  numThreads?: number;
  gpuMemoryLimitMb?: number;
}

export type BuffaloModelPack = "buffalo_l" | "buffalo_m" | "buffalo_s" | "buffalo_sc" | "antelopev2";

export interface ModelZooConfig {
  packName: BuffaloModelPack;
  detectorModel: string;      // e.g. "scrfd_10g_bnkps.onnx"
  embeddingModel: string;     // e.g. "glintr100.onnx" or "w600k_r50.onnx"
  genderAgeModel?: string;    // e.g. "genderage.onnx"
  landmark106Model?: string;  // e.g. "2d106det.onnx"
  embeddingDim: number;       // 512 for ArcFace / Glint360k
  inputSize: [number, number]; // [640, 640] for detector, [112, 112] for embedder
}

export interface BatchInferenceOptions {
  batchSize?: number;
  concurrency?: number;
}

/**
 * Model Provider Abstraction Interface
 * Permits hot-swapping underlying models (ArcFace, SCRFD, MobileFaceNet)
 * without altering downstream server logic.
 */
export interface ModelProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly activePack: BuffaloModelPack;

  initialize(config?: ONNXProviderConfig): Promise<void>;
  isReady(): boolean;

  detectFaces(imageBuffer: Buffer, options?: { confidenceThreshold?: number; nmsThreshold?: number }): Promise<DetectedFace[]>;
  alignFace(imageBuffer: Buffer, landmarks: Landmark5): Promise<AlignedFaceResult>;
  extractEmbedding(alignedImageBuffer: Buffer): Promise<Float32Array>;
  estimateQuality(imageBuffer: Buffer, landmarks: Landmark5): Promise<QualityMetrics>;

  batchExtractEmbeddings(alignedImageBuffers: Buffer[], options?: BatchInferenceOptions): Promise<Float32Array[]>;

  switchModelPack(pack: BuffaloModelPack): Promise<void>;
}
