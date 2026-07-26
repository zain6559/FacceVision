/**
 * FaceVision — Hash Service
 * 
 * Computes multiple hash types for deduplication:
 * - SHA256: Exact match
 * - Perceptual Hash (pHash): Perceptual similarity
 */

import * as crypto from "crypto";
import type { Checksum } from "../types.js";

/**
 * Hash Service - Multi-level hashing for deduplication.
 */
export class HashService {
  /**
   * Compute checksum with multiple hash types.
   */
  async computeChecksum(buffer: Buffer): Promise<Checksum> {
    const sha256 = this.computeSHA256(buffer);
    const pHash = await this.computePerceptualHash(buffer);
    
    return {
      sha256,
      pHash,
      md5: crypto.createHash("md5").update(buffer).digest("hex")
    };
  }

  /**
   * Compute SHA256 hash for exact matching.
   */
  computeSHA256(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Compute perceptual hash (simplified pHash).
   * In production, use a proper image hashing library.
   */
  async computePerceptualHash(buffer: Buffer): Promise<string> {
    // Simplified pHash implementation
    // In production: resize to 8x8, reduce colors, compute DCT, compare
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    return hash.substring(0, 16); // Truncated for comparison
  }

  /**
   * Compute Hamming distance between two pHashes.
   */
  hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      throw new Error("Hash lengths must match");
    }

    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }
    return distance;
  }

  /**
   * Calculate similarity from hamming distance (0-1, 1 = identical).
   */
  similarityFromHamming(distance: number, hashLength: number): number {
    return 1 - (distance / hashLength);
  }
}

// Singleton instance
export const hashService = new HashService();
