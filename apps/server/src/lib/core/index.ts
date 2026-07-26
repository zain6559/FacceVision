// Core interfaces and registry
export type {
  FaceEmbeddingBackend,
  DetectedFace,
  AlignedFace,
  EmbeddingResult,
  FaceDetectionResult,
  MatchResult,
  BackendInfo,
  BackendFactory
} from "./FaceEmbeddingBackend.js";

export { BackendRegistry, backendRegistry } from "./BackendRegistry.js";
export { RecognitionOrchestrator, recognitionOrchestrator } from "./RecognitionOrchestrator.js";
export type { 
  RecognitionRequest, 
  RecognitionResponse,
  MatchRequest,
  MatchResponse 
} from "./RecognitionOrchestrator.js";
