/**
 * FaceVision — Re-ranking Engine
 * 
 * Re-ranks search results using multiple signals:
 * 1. Base similarity (from ANN)
 * 2. Quality score
 * 3. Temporal proximity
 * 4. Knowledge graph relations
 * 5. Match frequency
 */

import type { SearchResult, RerankedResult, RerankFactor } from "../pipeline/types.js";
import type { QualityScore } from "../../ingestion/pipeline/types.js";

/**
 * Re-ranking weights.
 */
const RERANK_WEIGHTS = {
  baseSimilarity: 0.4,
  quality: 0.2,
  temporal: 0.15,
  knowledge: 0.1,
  frequency: 0.15
};

/**
 * Re-ranking Engine.
 */
export class Reranker {
  /**
   * Re-rank search results using multiple signals.
   */
  async rerank(
    _embedding: { embedding: number[] },
    results: SearchResult[],
    quality?: QualityScore
  ): Promise<RerankedResult[]> {
    const rerankedResults: RerankedResult[] = [];

    for (const result of results) {
      const factors: RerankFactor[] = [];
      let totalScore = 0;

      // Factor 1: Base similarity
      const similarityFactor: RerankFactor = {
        name: "Base Similarity",
        weight: RERANK_WEIGHTS.baseSimilarity,
        score: result.similarity,
        description: `ANN search similarity: ${(result.similarity * 100).toFixed(1)}%`
      };
      factors.push(similarityFactor);
      totalScore += result.similarity * RERANK_WEIGHTS.baseSimilarity;

      // Factor 2: Quality (from ingestion pipeline)
      const qualityScore = quality?.overall || 70;
      const normalizedQuality = qualityScore / 100;
      const qualityFactor: RerankFactor = {
        name: "Image Quality",
        weight: RERANK_WEIGHTS.quality,
        score: normalizedQuality,
        description: `Quality score: ${qualityScore}/100`
      };
      factors.push(qualityFactor);
      totalScore += normalizedQuality * RERANK_WEIGHTS.quality;

      // Factor 3: Temporal proximity (more recent = higher score)
      const temporalScore = this.calculateTemporalScore(result.lastSeen);
      const temporalFactor: RerankFactor = {
        name: "Temporal Proximity",
        weight: RERANK_WEIGHTS.temporal,
        score: temporalScore,
        description: result.lastSeen 
          ? `Last seen: ${this.formatDate(result.lastSeen)}`
          : "No timestamp available"
      };
      factors.push(temporalFactor);
      totalScore += temporalScore * RERANK_WEIGHTS.temporal;

      // Factor 4: Match frequency (more matches = higher confidence)
      const frequencyScore = this.calculateFrequencyScore(result.matchCount);
      const frequencyFactor: RerankFactor = {
        name: "Match Frequency",
        weight: RERANK_WEIGHTS.frequency,
        score: frequencyScore,
        description: `Seen ${result.matchCount} times`
      };
      factors.push(frequencyFactor);
      totalScore += frequencyScore * RERANK_WEIGHTS.frequency;

      // Factor 5: Knowledge graph relations (simplified)
      const knowledgeScore = 0.5; // Would query knowledge graph
      const knowledgeFactor: RerankFactor = {
        name: "Knowledge Relations",
        weight: RERANK_WEIGHTS.knowledge,
        score: knowledgeScore,
        description: "No relation data available"
      };
      factors.push(knowledgeFactor);
      totalScore += knowledgeScore * RERANK_WEIGHTS.knowledge;

      // Normalize final score
      const finalScore = Math.max(0, Math.min(1, totalScore));

      rerankedResults.push({
        ...result,
        rerankScore: Math.round(finalScore * 1000) / 1000,
        factors
      });
    }

    // Sort by rerank score
    rerankedResults.sort((a, b) => b.rerankScore - a.rerankScore);

    return rerankedResults;
  }

  /**
   * Calculate temporal proximity score.
   */
  private calculateTemporalScore(lastSeen?: Date): number {
    if (!lastSeen) return 0.5; // Neutral if no data

    const now = Date.now();
    const age = now - lastSeen.getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    // More recent = higher score
    if (age < dayMs) return 1.0;           // Seen today
    if (age < 7 * dayMs) return 0.9;      // Seen this week
    if (age < 30 * dayMs) return 0.7;      // Seen this month
    if (age < 90 * dayMs) return 0.5;      // Seen this quarter
    if (age < 180 * dayMs) return 0.3;    // Seen this half
    if (age < 365 * dayMs) return 0.2;     // Seen this year
    return 0.1;                             // Older
  }

  /**
   * Calculate frequency score from match count.
   */
  private calculateFrequencyScore(matchCount: number): number {
    // More matches = higher confidence, but with diminishing returns
    if (matchCount >= 10) return 1.0;
    if (matchCount >= 5) return 0.9;
    if (matchCount >= 3) return 0.7;
    if (matchCount >= 2) return 0.5;
    return 0.3; // Single observation
  }

  /**
   * Format date for display.
   */
  private formatDate(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  }

  /**
   * Get re-ranking weights.
   */
  getWeights(): typeof RERANK_WEIGHTS {
    return { ...RERANK_WEIGHTS };
  }

  /**
   * Update re-ranking weights.
   */
  updateWeights(weights: Partial<typeof RERANK_WEIGHTS>): void {
    Object.assign(RERANK_WEIGHTS, weights);
  }
}

/**
 * Factory function.
 */
export function createReranker(): Reranker {
  return new Reranker();
}
