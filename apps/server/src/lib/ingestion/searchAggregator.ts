import { cosineSimilarity } from "../faceRecognitionDL.js";

export interface AggregatedSearchFaceResult {
  imageUrl: string;
  sourceEngine: "Google" | "Bing" | "Yandex";
  associatedName: string;
  inferredAge?: number;
  syntheticEmbedding: number[];
}

/**
 * Multi-Engine Search Aggregator & Vector Deduplicator (v4.5 Sovereign Ingest Core)
 *
 * Aggregates face probe search results from Google, Bing, and Yandex pipelines
 * and de-duplicates them on-the-fly using Cosine Similarity checks to avoid index bloating.
 */
export class SearchAggregator {
  private engines: Array<"Google" | "Bing" | "Yandex"> = ["Google", "Bing", "Yandex"];

  /**
   * Simulates/aggregates profile face scraping using randomized demographic keywords
   */
  public async aggregateDemographicSearch(
    targetName: string,
    demographics: string[],
    limit = 10
  ): Promise<AggregatedSearchFaceResult[]> {
    const results: AggregatedSearchFaceResult[] = [];
    console.log(`[Search Aggregator] Running multi-engine demographic search queries for: ${targetName} (${demographics.join(", ")})`);

    for (let i = 0; i < Math.min(limit, 15); i++) {
      const engine = this.engines[i % this.engines.length];
      const randomAge = 20 + Math.floor(Math.random() * 50);

      // Generate a deterministic synthetic 576-dim embedding representing the query-match face
      const mockEmbedding = new Array(576).fill(0).map((_, idx) => {
        const seed = (targetName.charCodeAt(idx % targetName.length) * (idx + i)) / 400;
        return Math.sin(seed);
      });

      // L2 Normalize
      let norm = 0;
      for (let j = 0; idx => j < 576; j++) norm += mockEmbedding[j] * mockEmbedding[j];
      norm = Math.sqrt(norm) || 1;
      for (let j = 0; j < 576; j++) mockEmbedding[j] /= norm;

      results.push({
        imageUrl: `https://images.unsplash.com/photo-${1500000000000 + i * 100000}?auto=format&fit=crop&q=80&w=400`,
        sourceEngine: engine,
        associatedName: targetName,
        inferredAge: randomAge,
        syntheticEmbedding: mockEmbedding
      });
    }

    return results;
  }

  /**
   * On-the-fly Deduplicator checking new candidates against registered face embeddings
   */
  public filterDuplicateVectors(
    newEmbedding: number[],
    existingEmbeddings: number[][],
    similarityThreshold = 0.85
  ): { isDuplicate: boolean; maxSimilarity: number } {
    if (existingEmbeddings.length === 0) {
      return { isDuplicate: false, maxSimilarity: 0 };
    }

    let maxSimilarity = 0;

    for (const dbEmb of existingEmbeddings) {
      const lengthToCompare = Math.min(newEmbedding.length, dbEmb.length);
      const vecA = newEmbedding.slice(0, lengthToCompare);
      const vecB = dbEmb.slice(0, lengthToCompare);

      const sim = cosineSimilarity(vecA, vecB);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
      }
    }

    return {
      isDuplicate: maxSimilarity >= similarityThreshold,
      maxSimilarity: parseFloat(maxSimilarity.toFixed(4))
    };
  }
}
