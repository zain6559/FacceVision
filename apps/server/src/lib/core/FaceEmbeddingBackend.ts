/**
 * FaceVision — Face Embedding Backend Interface
 * 
 * Unified interface for pluggable face recognition backends.
 * This abstraction allows the system to use different backends:
 * - InsightFace (ArcFace/SCRFD)
 * - AdaFace
 * - MagFace
 * - ElasticFace
 * - FaceNet
 * 
 * Without requiring changes to the rest of the system.
 */

export interface DetectedFace {
  box: number[];        // [x, y, width, height]
  score: number;        // Detection confidence [0-1]
  landmarks?: number[][]; // Key facial points
  age?: number;
  gender?: string;
  emotions?: Record<string, number>;
}

export interface AlignedFace {
  buffer: Buffer;       // Aligned face image buffer
  qualityScore: number; // Quality assessment [0-1]
  landmarks: number[][];
}

export interface EmbeddingResult {
  embedding: number[];        // Main embedding vector
  subEmbeddings?: {
    clbp?: number[];
    lbp?: number[];
    hog?: number[];
    lpq?: number[];
    dct?: number[];
  };
  qualityScore: number;
  livenessScore?: number;
  isSpoof?: boolean;
  metadata?: {
    age?: number;
    gender?: string;
    ethnicity?: string;
    hasMask?: boolean;
    hasGlasses?: boolean;
  };
}

export interface FaceDetectionResult {
  faces: DetectedFace[];
  imageBuffer?: Buffer;
  imageWidth?: number;
  imageHeight?: number;
}

export interface MatchResult {
  similarity: number;
  algorithmScores?: {
    clbp?: number;
    lbp?: number;
    hog?: number;
    lpq?: number;
    dct?: number;
  };
}

export interface BackendInfo {
  id: string;
  name: string;
  version: string;
  embeddingDim: number;
  isLoaded: boolean;
}

/**
 * Unified interface for face embedding extraction backends.
 * All backends must implement this interface.
 */
export interface FaceEmbeddingBackend {
  /** Unique identifier for this backend */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Backend version */
  readonly version: string;
  
  /** Embedding dimensionality */
  readonly embeddingDim: number;

  /**
   * Initialize the backend (load models, etc.)
   * Called once during startup.
   */
  initialize(): Promise<void>;
  
  /**
   * Check if the backend is ready for inference.
   */
  isReady(): boolean;
  
  /**
   * Get backend information.
   */
  getInfo(): BackendInfo;
  
  /**
   * Detect faces in an image.
   * Returns bounding boxes and keypoints.
   */
  detectFaces(imageBuffer: Buffer): Promise<FaceDetectionResult>;
  
  /**
   * Align a detected face to standard pose.
   */
  alignFace(imageBuffer: Buffer, face: DetectedFace): Promise<AlignedFace>;
  
  /**
   * Extract embedding from an aligned face.
   */
  extractEmbedding(alignedFaceBuffer: Buffer): Promise<number[]>;
  
  /**
   * Process image: detect → align → extract.
   * Convenience method combining multiple steps.
   */
  processImage(imageBuffer: Buffer): Promise<EmbeddingResult[]>;
  
  /**
   * Compute similarity between two embeddings.
   */
  computeSimilarity(embeddingA: number[], embeddingB: number[]): number;
  
  /**
   * Compute match score with optional sub-algorithm scores.
   */
  computeMatchScore(
    queryEmbedding: number[],
    storedEmbedding: number[],
    storedSubEmbeddings?: EmbeddingResult["subEmbeddings"]
  ): MatchResult;
  
  /**
   * Cleanup resources (free models, etc.)
   */
  destroy(): Promise<void>;
}

/**
 * Factory function type for creating backend instances.
 */
export type BackendFactory = (config?: Record<string, unknown>) => Promise<FaceEmbeddingBackend>;
