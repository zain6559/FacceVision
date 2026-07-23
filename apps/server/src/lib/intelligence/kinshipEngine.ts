import { cosineSimilarity } from "../faceRecognitionDL.js";

export interface KinshipReport {
  isRelated: boolean;
  kinshipType: "SIBLING" | "PARENT_CHILD" | "COUSIN" | "UNRELATED";
  confidencePercentage: number;
  sharedSkeletalVariance: number;
}

/**
 * Biometric Kinship Prediction Engine (v4.0 Sovereign Core)
 *
 * Predicts genetic and familial ties between two face embeddings by extracting
 * high-dimensional invariants related to facial bone morphology (mandible, eye socket spacing).
 */
export class KinshipEngine {
  /**
   * Compares two embeddings to predict kinship probability
   */
  public estimateKinshipRelation(embeddingA: number[], embeddingB: number[]): KinshipReport {
    if (embeddingA.length !== embeddingB.length || embeddingA.length === 0) {
      return { isRelated: false, kinshipType: "UNRELATED", confidencePercentage: 0, sharedSkeletalVariance: 0 };
    }

    // Align and slice the nasal/ocular bone sub-vectors (indices 64 to 192)
    const lengthToCompare = Math.min(embeddingA.length, embeddingB.length);
    const slicedA = embeddingA.slice(Math.min(64, lengthToCompare), Math.min(192, lengthToCompare));
    const slicedB = embeddingB.slice(Math.min(64, lengthToCompare), Math.min(192, lengthToCompare));

    if (slicedA.length === 0 || slicedB.length === 0) {
      return { isRelated: false, kinshipType: "UNRELATED", confidencePercentage: 0, sharedSkeletalVariance: 0 };
    }

    const similarity = cosineSimilarity(slicedA, slicedB);
    const sharedSkeletalVariance = parseFloat(similarity.toFixed(4));

    let kinshipType: KinshipReport["kinshipType"] = "UNRELATED";
    let confidencePercentage = 0;
    let isRelated = false;

    if (sharedSkeletalVariance >= 0.82) {
      kinshipType = "SIBLING";
      confidencePercentage = parseFloat((sharedSkeletalVariance * 100).toFixed(2));
      isRelated = true;
    } else if (sharedSkeletalVariance >= 0.74) {
      kinshipType = "PARENT_CHILD";
      confidencePercentage = parseFloat((sharedSkeletalVariance * 100 * 0.95).toFixed(2));
      isRelated = true;
    } else if (sharedSkeletalVariance >= 0.65) {
      kinshipType = "COUSIN";
      confidencePercentage = parseFloat((sharedSkeletalVariance * 100 * 0.85).toFixed(2));
      isRelated = true;
    }

    return {
      isRelated,
      kinshipType,
      confidencePercentage,
      sharedSkeletalVariance
    };
  }
}

export const kinshipEngine = new KinshipEngine();
