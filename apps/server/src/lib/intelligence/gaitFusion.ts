import { cosineSimilarity } from "../faceRecognitionDL.js";

/**
 * Gait & Soft-Biometrics Fusion Engine (v4.0 Sovereign Core)
 *
 * Extracts and matches body pose ratios, limb dimensions, and walking rhythms
 * when the face is occluded or obscured by masks or tactical glasses.
 */
export class GaitFusionEngine {
  /**
   * Calculates similarity between two gait/body soft biometric vectors
   */
  public matchGaitVectors(vectorA: number[], vectorB: number[]): { similarity: number; match: boolean } {
    if (vectorA.length !== vectorB.length || vectorA.length === 0) {
      return { similarity: 0, match: false };
    }

    const similarity = cosineSimilarity(vectorA, vectorB);
    const threshold = 0.68; // Gait and body proportions have higher variance than facial landmarks

    return {
      similarity: parseFloat(similarity.toFixed(4)),
      match: similarity >= threshold
    };
  }

  /**
   * Fusion function combining facial and gait confidence indices
   */
  public fuseFaceAndGait(faceConfidence: number, gaitConfidence: number, faceOccluded = false): number {
    if (faceOccluded) {
      return parseFloat((gaitConfidence * 0.95).toFixed(4));
    }
    // Weighted fusion: face has 75% weight, gait has 25% weight when face is visible
    return parseFloat((faceConfidence * 0.75 + gaitConfidence * 0.25).toFixed(4));
  }
}

export const gaitFusionEngine = new GaitFusionEngine();
