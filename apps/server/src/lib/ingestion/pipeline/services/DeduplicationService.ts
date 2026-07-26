/**
 * FaceVision — Deduplication Service
 * 
 * Multi-level deduplication strategy:
 * 1. SHA256 - Exact match
 * 2. pHash - Perceptual similarity
 * 3. Embedding distance - Deep learning similarity
 * 4. Manual merge - Human review for edge cases
 */

import { logger } from "../../../logger.js";
import { hashService } from "./HashService.js";
import type { DeduplicationResult, DeduplicationMatchType } from "../types.js";

/**
 * Deduplication thresholds.
 */
const THRESHOLDS = {
  EXACT_HASH: 1.0,           // 100% match
  PERCEPTUAL_HASH: 0.90,      // 90% similarity (hamming distance <= 6 for 64-bit)
  EMBEDDING_DISTANCE: 0.85    // 85% cosine similarity
};

/**
 * Deduplication Service - Checks for duplicate content.
 */
export class DeduplicationService {
  // In production, use Redis or similar for fast lookups
  private hashCache = new Map<string, string>();
  private pHashCache = new Map<string, string>();

  /**
   * Check if content is a duplicate using multi-level strategy.
   */
  async checkDuplicate(
    sha256: string,
    pHash: string,
    _buffer: Buffer
  ): Promise<DeduplicationResult> {
    // Level 1: Exact SHA256 match
    const exactMatch = await this.checkExactMatch(sha256);
    if (exactMatch) {
      return {
        isDuplicate: true,
        duplicateOf: exactMatch,
        matchType: "EXACT_HASH",
        confidence: 1.0
      };
    }

    // Level 2: Perceptual hash match
    const perceptualMatch = await this.checkPerceptualMatch(pHash);
    if (perceptualMatch) {
      return {
        isDuplicate: true,
        duplicateOf: perceptualMatch.id,
        matchType: "PERCEPTUAL_HASH",
        confidence: perceptualMatch.similarity
      };
    }

    // Level 3: Would check embedding distance in production
    // For now, return no duplicate
    return {
      isDuplicate: false,
      matchType: "NONE",
      confidence: 0
    };
  }

  /**
   * Check for exact SHA256 match.
   */
  private async checkExactMatch(sha256: string): Promise<string | null> {
    const existingId = this.hashCache.get(sha256);
    if (existingId) {
      logger.debug({ sha256, existingId }, "Exact hash match found");
      return existingId;
    }
    return null;
  }

  /**
   * Check for perceptual hash similarity.
   */
  private async checkPerceptualMatch(pHash: string): Promise<{ id: string; similarity: number } | null> {
    let bestMatch: { id: string; similarity: number } | null = null;

    for (const [id, storedHash] of this.pHashCache.entries()) {
      try {
        const distance = hashService.hammingDistance(pHash, storedHash);
        const similarity = hashService.similarityFromHamming(distance, pHash.length * 4); // 4 bits per char
        
        if (similarity >= THRESHOLDS.PERCEPTUAL_HASH) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { id, similarity };
          }
        }
      } catch {
        // Hash comparison failed, skip
      }
    }

    if (bestMatch) {
      logger.debug({ pHash, bestMatch }, "Perceptual hash match found");
    }

    return bestMatch;
  }

  /**
   * Register a new hash in the cache.
   */
  registerHash(id: string, sha256: string, pHash: string): void {
    this.hashCache.set(sha256, id);
    this.pHashCache.set(pHash, id);
  }

  /**
   * Get deduplication statistics.
   */
  getStats(): {
    exactMatches: number;
    perceptualMatches: number;
    totalCached: number;
  } {
    return {
      exactMatches: this.hashCache.size,
      perceptualMatches: this.pHashCache.size,
      totalCached: this.hashCache.size + this.pHashCache.size
    };
  }
}

// Singleton instance
export const dedupService = new DeduplicationService();
