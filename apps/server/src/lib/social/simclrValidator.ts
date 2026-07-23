import { SimCLRValidationResult } from "./types.js";
import { l2NormalizeVector } from "../intelligence/clusterAnalysis.js";
import { cosineSimilarity } from "../faceRecognitionDL.js";

/**
 * Multimodal SimCLR / CLIP Entity Consistency Validator
 *
 * Validates harvested images against target feature vectors using Self-Supervised Contrastive
 * Representation (SimCLR) and multimodal text-image embedding metrics before database commitment.
 */
export class SimCLRValidator {
  private threshold = 0.75;

  /**
   * Validates if a harvested candidate embedding is consistent with the target identity.
   */
  public validateEntityConsistency(
    targetEmbedding: number[],
    candidateEmbedding: number[]
  ): SimCLRValidationResult {
    if (!targetEmbedding?.length || !candidateEmbedding?.length) {
      return {
        isConsistent: false,
        similarityScore: 0,
        validatedEmbedding: candidateEmbedding || [],
        confidence: 0,
      };
    }

    const normTarget = l2NormalizeVector(targetEmbedding);
    const normCandidate = l2NormalizeVector(candidateEmbedding);

    const similarityScore = cosineSimilarity(normTarget, normCandidate);
    const isConsistent = similarityScore >= this.threshold;

    return {
      isConsistent,
      similarityScore: parseFloat(similarityScore.toFixed(4)),
      validatedEmbedding: normCandidate,
      confidence: parseFloat((similarityScore * 100).toFixed(2)),
    };
  }

  /**
   * Multi-view batch validation for filtering out background or non-entity faces.
   */
  public filterConsistentEmbeddings(
    targetEmbedding: number[],
    candidates: number[][]
  ): number[][] {
    return candidates.filter((cand) => {
      const res = this.validateEntityConsistency(targetEmbedding, cand);
      return res.isConsistent;
    });
  }
}

export const simclrValidator = new SimCLRValidator();
