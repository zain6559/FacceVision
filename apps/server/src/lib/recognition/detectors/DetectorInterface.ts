/**
 * FaceVision — Face Detector Interface
 * 
 * Abstract interface for pluggable face detectors:
 * - SCRFD (default)
 * - RetinaFace
 * - YOLOv8-Face
 * - BlazeFace
 * - MTCNN
 */

import type { DetectionResult, BoundingBox, Landmark5, Landmark106 } from "../pipeline/types.js";

/**
 * Detector options.
 */
export interface DetectorOptions {
  confidenceThreshold?: number;
  nmsThreshold?: number;
  maxFaces?: number;
  minFaceSize?: number;
  inputSize?: [number, number];
}

/**
 * Face Detector Interface.
 */
export interface FaceDetector {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedLandmarkTypes: ("5" | "106")[];
  readonly inputSize: [number, number];

  /**
   * Initialize the detector.
   */
  initialize(): Promise<void>;

  /**
   * Check if detector is ready.
   */
  isReady(): boolean;

  /**
   * Detect faces in an image.
   */
  detect(imageBuffer: Buffer, options?: DetectorOptions): Promise<DetectionResult>;

  /**
   * Get model metadata.
   */
  getMetadata(): DetectorMetadata;
}

export interface DetectorMetadata {
  modelSize: number;
  inferenceTimeMs: number;
  precision: "FP32" | "FP16" | "INT8";
  backend: "ONNX" | "TensorRT" | "OpenVINO" | "CoreML";
}

/**
 * SCRFD Detector Implementation.
 */
class SCRFDDetector implements FaceDetector {
  readonly id = "scrfd";
  readonly name = "SCRFD (SMSFD)";
  readonly version = "1.0.0";
  readonly supportedLandmarkTypes: ("5" | "106")[] = ["5"];
  readonly inputSize: [number, number] = [640, 640];
  
  private ready = false;

  async initialize(): Promise<void> {
    // In production: load ONNX model
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  async detect(imageBuffer: Buffer, options?: DetectorOptions): Promise<DetectionResult> {
    const start = Date.now();
    
    // Simulated detection
    const faces = Math.random() > 0.3 ? 1 : 0;
    const detectedFaces = [];

    for (let i = 0; i < faces; i++) {
      detectedFaces.push(this.generateFakeFace(i));
    }

    return {
      faces: detectedFaces,
      modelVersion: this.version,
      detectorType: this.id,
      detectionTimeMs: Date.now() - start
    };
  }

  private generateFakeFace(index: number): DetectionResult["faces"][0] {
    return {
      faceId: `face_${index}`,
      boundingBox: {
        x: 100 + Math.random() * 100,
        y: 100 + Math.random() * 100,
        width: 150 + Math.random() * 50,
        height: 180 + Math.random() * 50,
        score: 0.9 + Math.random() * 0.1
      },
      landmarks: [
        { x: 140, y: 160 },
        { x: 190, y: 160 },
        { x: 165, y: 190 },
        { x: 145, y: 220 },
        { x: 185, y: 220 }
      ],
      confidence: 0.95
    };
  }

  getMetadata(): DetectorMetadata {
    return {
      modelSize: 23, // MB
      inferenceTimeMs: 15,
      precision: "FP16",
      backend: "ONNX"
    };
  }
}

/**
 * RetinaFace Detector Implementation.
 */
class RetinaFaceDetector implements FaceDetector {
  readonly id = "retinaface";
  readonly name = "RetinaFace";
  readonly version = "1.0.0";
  readonly supportedLandmarkTypes: ("5" | "106")[] = ["5", "106"];
  readonly inputSize: [number, number] = [640, 640];
  
  private ready = false;

  async initialize(): Promise<void> {
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  async detect(imageBuffer: Buffer, options?: DetectorOptions): Promise<DetectionResult> {
    const start = Date.now();
    
    // Simulated detection
    const faces = Math.random() > 0.2 ? 1 : 0;
    const detectedFaces = [];

    for (let i = 0; i < faces; i++) {
      detectedFaces.push({
        faceId: `face_${i}`,
        boundingBox: {
          x: 100 + Math.random() * 100,
          y: 100 + Math.random() * 100,
          width: 150 + Math.random() * 50,
          height: 180 + Math.random() * 50,
          score: 0.92 + Math.random() * 0.08
        },
        landmarks: [
          { x: 140, y: 160 },
          { x: 190, y: 160 },
          { x: 165, y: 190 },
          { x: 145, y: 220 },
          { x: 185, y: 220 }
        ],
        confidence: 0.97
      });
    }

    return {
      faces: detectedFaces,
      modelVersion: this.version,
      detectorType: this.id,
      detectionTimeMs: Date.now() - start
    };
  }

  getMetadata(): DetectorMetadata {
    return {
      modelSize: 45, // MB
      inferenceTimeMs: 25,
      precision: "FP32",
      backend: "ONNX"
    };
  }
}

/**
 * YOLOv8-Face Detector Implementation.
 */
class YOLOFaceDetector implements FaceDetector {
  readonly id = "yoloface";
  readonly name = "YOLOv8-Face";
  readonly version = "1.0.0";
  readonly supportedLandmarkTypes: ("5" | "106")[] = ["5"];
  readonly inputSize: [number, number] = [640, 640];
  
  private ready = false;

  async initialize(): Promise<void> {
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  async detect(imageBuffer: Buffer, options?: DetectorOptions): Promise<DetectionResult> {
    const start = Date.now();
    
    // Simulated detection
    const faces = Math.random() > 0.25 ? 1 : 0;
    const detectedFaces = [];

    for (let i = 0; i < faces; i++) {
      detectedFaces.push({
        faceId: `face_${i}`,
        boundingBox: {
          x: 100 + Math.random() * 100,
          y: 100 + Math.random() * 100,
          width: 150 + Math.random() * 50,
          height: 180 + Math.random() * 50,
          score: 0.88 + Math.random() * 0.12
        },
        landmarks: [
          { x: 140, y: 160 },
          { x: 190, y: 160 },
          { x: 165, y: 190 },
          { x: 145, y: 220 },
          { x: 185, y: 220 }
        ],
        confidence: 0.93
      });
    }

    return {
      faces: detectedFaces,
      modelVersion: this.version,
      detectorType: this.id,
      detectionTimeMs: Date.now() - start
    };
  }

  getMetadata(): DetectorMetadata {
    return {
      modelSize: 35, // MB
      inferenceTimeMs: 12,
      precision: "FP16",
      backend: "ONNX"
    };
  }
}

/**
 * Detector Registry - Manages available detectors.
 */
export class DetectorRegistry {
  private detectors: Map<string, FaceDetector> = new Map();
  private defaultDetector: string = "scrfd";

  constructor() {
    // Register default detectors
    this.register(new SCRFDDetector());
    this.register(new RetinaFaceDetector());
    this.register(new YOLOFaceDetector());
  }

  /**
   * Register a detector.
   */
  register(detector: FaceDetector): void {
    this.detectors.set(detector.id, detector);
  }

  /**
   * Get a detector by ID.
   */
  get(detectorId?: string): FaceDetector {
    const id = detectorId || this.defaultDetector;
    const detector = this.detectors.get(id);
    if (!detector) {
      throw new Error(`Detector ${id} not found`);
    }
    return detector;
  }

  /**
   * Get all registered detectors.
   */
  getAll(): FaceDetector[] {
    return Array.from(this.detectors.values());
  }

  /**
   * Set default detector.
   */
  setDefault(detectorId: string): void {
    if (!this.detectors.has(detectorId)) {
      throw new Error(`Detector ${detectorId} not registered`);
    }
    this.defaultDetector = detectorId;
  }

  /**
   * Initialize all detectors.
   */
  async initializeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.detectors.values()).map(d => d.initialize())
    );
  }
}

// Singleton registry
export const detectorRegistry = new DetectorRegistry();

/**
 * Factory function to create a detector.
 */
export function createDetector(type: "scrfd" | "retinaface" | "yoloface" = "scrfd"): FaceDetector {
  return detectorRegistry.get(type);
}
