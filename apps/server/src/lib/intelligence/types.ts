/**
 * Face Intelligence Platform Layer — Type Definitions
 *
 * Provides model-agnostic abstractions for:
 * - Biometric Explainability & Saliency Analysis
 * - Cosine DBSCAN Clustering & Duplicate Detection
 * - Automated Threshold Calibration (FAR/FRR Optimization)
 * - Self-Evaluation & Model/Dataset Rollback System
 * - Automated AI Biometric Intelligence Reports
 */

export interface FeatureSaliencyRegion {
  name: "ocular_left" | "ocular_right" | "nasal_bridge" | "oral_mandibular" | "facial_contour";
  weight: number;             // Contribution percentage [0 - 100%]
  similarityScore: number;    // Local region similarity
  confidence: number;
}

export interface ExplainabilityReport {
  subjectMatchName?: string;
  globalSimilarity: number;
  calibratedConfidence: number;
  regions: FeatureSaliencyRegion[];
  biometricSummaryText: string;
  qualityImpactPenalty: number;
}

export interface FaceClusterNode {
  embeddingId: number;
  personId?: number;
  personName?: string;
  embedding: number[];
  clusterId?: number;
}

export interface ClusterGroup {
  clusterId: number;
  suggestedName?: string;
  memberCount: number;
  members: FaceClusterNode[];
  centroid: number[];
  cohesionScore: number;     // Intra-cluster similarity
}

export interface DuplicatePair {
  personA: { id: number; name: string };
  personB: { id: number; name: string };
  similarity: number;
  recommendation: "MERGE_REQUIRED" | "REVIEW_RECOMMENDED" | "DISTINCT";
}

export interface ThresholdCalibrationOptions {
  targetFAR?: number;        // e.g. 0.0001 (1 in 100,000)
  targetFRR?: number;        // e.g. 0.01 (1 in 100)
  minSamplesRequired?: number;
}

export interface CalibrationResult {
  optimalThreshold: number;
  estimatedFAR: number;
  estimatedFRR: number;
  eerThreshold: number;       // Equal Error Rate threshold where FAR == FRR
  sampleSizeEvaluated: number;
  calibratedAt: string;
}

export interface VersionCheckpoint {
  versionId: string;
  datasetVersion: string;
  modelVersion: string;
  activeThreshold: number;
  metrics: {
    accuracy: number;
    far: number;
    frr: number;
  };
  createdAt: string;
  status: "STABLE" | "DEPRECATED" | "ACTIVE";
}

export interface AIIntelligenceReport {
  generatedAt: string;
  healthStatus: "OPTIMAL" | "CALIBRATION_NEEDED" | "DEGRADED";
  activeModelInfo: {
    id: string;
    pack: string;
    activeThreshold: number;
  };
  clusteringSummary: {
    totalIdentities: number;
    unclusteredFaces: number;
    duplicatePairsCount: number;
  };
  calibrationMetrics: CalibrationResult;
  versionHistory: VersionCheckpoint[];
  recommendations: string[];
}

export interface ProtectedTemplate {
  protectedVector: number[];
  algorithmMode: 'ROP' | 'BIOHASH' | 'SALTED_TRANSFORM';
  keyFingerprint: string;
  dimensionality: number;
  protectedAt: string;
  isRevoked: boolean;
}

export interface BiometricVerifyResult {
  isMatch: boolean;
  protectedSimilarity: number;
  confidenceLevel: 'HIGH' | 'MODERATE' | 'LOW' | 'NO_MATCH';
  verifiedAt: string;
}

export interface BiometricKeyInfo {
  tenantId: string;
  keyFingerprint: string;
  algorithm: string;
  createdAt: string;
  isActive: boolean;
}

export interface SaliencyHeatmapResult {
  svgOverlay: string;
  svgBase64: string;
  regions: AnatomicalRegionHeatmap[];
  globalMatchScore: number;
  dominantRegion: string;
  interpretationText: string;
}

export interface AnatomicalRegionHeatmap {
  name: string;
  similarity: number;
  heatColor: string;
  opacity: number;
  boundingEllipse: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
  };
}

export interface GradCAMResult {
  activationGrid: number[][];
  normalizedGrid: number[][];
  heatmapColors: string[][];
  peakActivationCell: { row: number; col: number; value: number };
  meanActivation: number;
}

export interface LandmarkDecompositionResult {
  totalLandmarks: number;
  matchedLandmarks: number;
  landmarkDetails: LandmarkMatchDetail[];
  strongestMatchRegion: string;
  weakestMatchRegion: string;
  overallLandmarkScore: number;
}

export interface LandmarkMatchDetail {
  index: number;
  name: string;
  region: string;
  similarity: number;
  contribution: number;
}

export interface DeepfakeAnalysisResult {
  verdict: DeepfakeVerdict;
  isAuthentic: boolean;
  authenticityScore: number;
  processingTimeMs: number;
  forensicSignals: ForensicSignal[];
  recommendation: 'PROCEED' | 'FLAG_FOR_REVIEW' | 'REJECT_SYNTHETIC';
  reportSummary: string;
}

export interface DeepfakeVerdict {
  classification: 'AUTHENTIC' | 'LIKELY_AUTHENTIC' | 'SUSPICIOUS' | 'LIKELY_SYNTHETIC' | 'SYNTHETIC';
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ForensicSignal {
  signalName: string;
  signalType: 'FREQUENCY' | 'COMPRESSION' | 'COLOR' | 'NOISE' | 'EDGE';
  score: number;
  weight: number;
  anomalyDetected: boolean;
  details: string;
}

export interface FrequencyAnalysis {
  dctEnergyDistribution: number[];
  highFreqRatio: number;
  spectralFlatnessScore: number;
  ganArtifactLikelihood: number;
}

export interface CompressionAnalysis {
  estimatedQuality: number;
  blockArtifactScore: number;
  doubleCompressionDetected: boolean;
  quantizationTableAnomaly: boolean;
}

export interface ColorConsistencyAnalysis {
  channelCorrelation: { rg: number; rb: number; gb: number };
  histogramUniformity: number;
  colorBandingDetected: boolean;
  syntheticColorScore: number;
}

export interface NoiseAnalysis {
  noiseVariance: number;
  noiseUniformity: number;
  patchInconsistency: number;
  syntheticNoiseScore: number;
}

export interface EdgeCoherenceAnalysis {
  edgeDensity: number;
  edgeSharpness: number;
  blurKernelConsistency: number;
  artificialBlurDetected: boolean;
}
