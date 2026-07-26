/**
 * FaceVision — Embedding Cache
 * 
 * Caches embeddings to avoid recomputing for the same image:
 * - URL-based caching
 * - Hash-based caching
 * - LRU eviction
 * - TTL support
 */

import * as crypto from "crypto";
import type { EmbeddingResult } from "../pipeline/types.js";

/**
 * Cache entry with metadata.
 */
interface CacheEntry {
  key: string;
  embedding: EmbeddingResult;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  ttlMs?: number;
}

/**
 * Cache statistics.
 */
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * Embedding Cache with LRU eviction.
 */
export class EmbeddingCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private defaultTtlMs: number;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0
  };

  constructor(maxSize = 10000, defaultTtlMs = 24 * 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Get embedding from cache.
   */
  async get(imageBuffer: Buffer): Promise<EmbeddingResult | null> {
    const key = this.generateKey(imageBuffer);
    return this.getByKey(key);
  }

  /**
   * Get embedding by key.
   */
  async getByKey(key: string): Promise<EmbeddingResult | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL
    if (entry.ttlMs) {
      const age = Date.now() - entry.createdAt.getTime();
      if (age > entry.ttlMs) {
        this.cache.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }
    }

    // Update access metadata
    entry.accessedAt = new Date();
    entry.accessCount++;

    this.stats.hits++;
    this.updateHitRate();

    return entry.embedding;
  }

  /**
   * Store embedding in cache.
   */
  async set(imageBuffer: Buffer, embedding: EmbeddingResult, ttlMs?: number): Promise<void> {
    const key = this.generateKey(imageBuffer);
    return this.setByKey(key, embedding, ttlMs);
  }

  /**
   * Store embedding by key.
   */
  async setByKey(key: string, embedding: EmbeddingResult, ttlMs?: number): Promise<void> {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      key,
      embedding,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0,
      ttlMs: ttlMs || this.defaultTtlMs
    });

    this.stats.size = this.cache.size;
  }

  /**
   * Generate cache key from image buffer.
   */
  private generateKey(imageBuffer: Buffer): string {
    // Use SHA256 hash as key
    return crypto.createHash("sha256").update(imageBuffer).digest("hex");
  }

  /**
   * Generate key from URL.
   */
  generateKeyFromUrl(url: string): string {
    return crypto.createHash("sha256").update(url).digest("hex");
  }

  /**
   * Evict least recently used entry.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessedAt.getTime() < oldestTime) {
        oldestTime = entry.accessedAt.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }

  /**
   * Update hit rate statistics.
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Check if key exists in cache.
   */
  has(imageBuffer: Buffer): boolean {
    const key = this.generateKey(imageBuffer);
    return this.cache.has(key);
  }

  /**
   * Remove specific entry from cache.
   */
  invalidate(imageBuffer: Buffer): boolean {
    const key = this.generateKey(imageBuffer);
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache size.
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache capacity.
   */
  capacity(): number {
    return this.maxSize;
  }

  /**
   * Update cache capacity.
   */
  setCapacity(maxSize: number): void {
    this.maxSize = maxSize;
    
    // Evict if over capacity
    while (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Update default TTL.
   */
  setDefaultTtl(ttlMs: number): void {
    this.defaultTtlMs = ttlMs;
  }

  /**
   * Clean up expired entries.
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttlMs) {
        const age = now - entry.createdAt.getTime();
        if (age > entry.ttlMs) {
          this.cache.delete(key);
          cleaned++;
        }
      }
    }

    this.stats.size = this.cache.size;
    return cleaned;
  }

  /**
   * Get entries sorted by access count (for analysis).
   */
  getTopAccessed(limit = 10): Array<{ key: string; accessCount: number }> {
    return Array.from(this.cache.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit)
      .map(e => ({ key: e.key, accessCount: e.accessCount }));
  }
}

/**
 * Factory function.
 */
export function createEmbeddingCache(maxSize = 10000): EmbeddingCache {
  return new EmbeddingCache(maxSize);
}
