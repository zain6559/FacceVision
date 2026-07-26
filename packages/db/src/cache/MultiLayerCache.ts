/**
 * FaceVision — Multi-Layer Cache System
 * 
 * Specialized caches for different data types:
 * - Embedding Cache
 * - Policy Cache
 * - Search Cache
 * - Metadata Cache
 * - Session Cache
 */

import * as crypto from "crypto";
import { logger } from "../../../logger.js";

// ─── Cache Entry ────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  size: number; // Estimated size in bytes
  tags: string[];
  ttlMs?: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  totalMemoryBytes: number;
}

// ─── Base Cache ────────────────────────────────────────────────────────────────

abstract class BaseCache<T> {
  protected cache: Map<string, CacheEntry<T>> = new Map();
  protected maxSize: number;
  protected maxMemoryBytes: number;
  protected defaultTtlMs: number;
  protected stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    totalMemoryBytes: 0
  };

  constructor(maxSize = 10000, maxMemoryBytes = 100 * 1024 * 1024, defaultTtlMs = 3600000) {
    this.maxSize = maxSize;
    this.maxMemoryBytes = maxMemoryBytes;
    this.defaultTtlMs = defaultTtlMs;
  }

  protected generateKey(data: unknown): string {
    const str = JSON.stringify(data);
    return crypto.createHash("sha256").update(str).digest("hex");
  }

  protected isExpired(entry: CacheEntry<T>): boolean {
    if (!entry.ttlMs) return false;
    return Date.now() - entry.createdAt.getTime() > entry.ttlMs;
  }

  protected getEntry(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.decrementSize(entry);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    entry.accessedAt = new Date();
    entry.accessCount++;
    this.stats.hits++;
    this.updateHitRate();

    return entry;
  }

  protected setEntry(key: string, value: T, ttlMs?: number, priority: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM", tags: string[] = []): void {
    // Check memory limit
    const estimatedSize = this.estimateSize(value);
    while (this.stats.totalMemoryBytes + estimatedSize > this.maxMemoryBytes && this.cache.size > 0) {
      this.evictOne();
    }

    // Check size limit
    while (this.cache.size >= this.maxSize && this.cache.size > 0) {
      this.evictOne();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0,
      size: estimatedSize,
      tags,
      ttlMs: ttlMs || this.defaultTtlMs,
      priority
    };

    this.cache.set(key, entry);
    this.incrementSize(entry);
    this.stats.size = this.cache.size;
  }

  protected evictOne(): void {
    // LRU eviction with priority consideration
    let evictKey: string | null = null;
    let lowestScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Score: lower = evict first
      // Priority (lower priority = lower score), then access recency
      const priorityScore = entry.priority === "LOW" ? 1 : entry.priority === "MEDIUM" ? 2 : 3;
      const timeScore = entry.accessedAt.getTime();
      const score = priorityScore * 1000000 + timeScore;

      if (score < lowestScore) {
        lowestScore = score;
        evictKey = key;
      }
    }

    if (evictKey) {
      const entry = this.cache.get(evictKey);
      if (entry) {
        this.decrementSize(entry);
      }
      this.cache.delete(evictKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }

  protected estimateSize(value: T): number {
    // Rough estimate
    return JSON.stringify(value).length * 2;
  }

  protected incrementSize(entry: CacheEntry<T>): void {
    this.stats.totalMemoryBytes += entry.size;
  }

  protected decrementSize(entry: CacheEntry<T>): void {
    this.stats.totalMemoryBytes = Math.max(0, this.stats.totalMemoryBytes - entry.size);
  }

  protected updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  abstract get(key: string): T | null;
  abstract set(key: string, value: T, ttlMs?: number, tags?: string[]): void;

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.decrementSize(entry);
      return false;
    }
    return true;
  }

  invalidate(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.decrementSize(entry);
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      return true;
    }
    return false;
  }

  invalidateByTag(tag: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.decrementSize(entry);
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  clear(): void {
    this.cache.clear();
    this.stats.totalMemoryBytes = 0;
    this.stats.size = 0;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }
}

// ─── Embedding Cache ────────────────────────────────────────────────────────────

export interface CachedEmbedding {
  embedding: number[];
  qualityScore: number;
  modelVersion: string;
}

export class EmbeddingCache extends BaseCache<CachedEmbedding> {
  private embeddingDimension: number = 512;

  constructor(maxSize = 50000, maxMemoryBytes = 1024 * 1024 * 1024) {
    super(maxSize, maxMemoryBytes, 24 * 3600000); // 24 hour default TTL
  }

  get(key: string): CachedEmbedding | null {
    const entry = super.getEntry(key);
    return entry ? entry.value : null;
  }

  set(key: string, value: CachedEmbedding, ttlMs?: number, tags: string[] = []): void {
    super.setEntry(key, value, ttlMs, "HIGH", tags);
  }

  getByHash(imageHash: string): CachedEmbedding | null {
    return this.get(imageHash);
  }

  setByHash(imageHash: string, value: CachedEmbedding, ttlMs?: number): void {
    this.set(imageHash, value, ttlMs, ["image", imageHash]);
  }
}

// ─── Policy Cache ───────────────────────────────────────────────────────────────

export interface CachedPolicy {
  policyType: string;
  policyData: unknown;
  version: string;
}

export class PolicyCache extends BaseCache<CachedPolicy> {
  constructor(maxSize = 1000, maxMemoryBytes = 10 * 1024 * 1024) {
    super(maxSize, maxMemoryBytes, 3600000); // 1 hour default TTL
  }

  get(key: string): CachedPolicy | null {
    const entry = super.getEntry(key);
    return entry ? entry.value : null;
  }

  set(key: string, value: CachedPolicy, ttlMs?: number, tags: string[] = []): void {
    super.setEntry(key, value, ttlMs, "HIGH", tags);
  }

  getByTypeAndVersion(policyType: string, version: string): CachedPolicy | null {
    return this.get(`${policyType}:${version}`);
  }

  setByTypeAndVersion(policyType: string, version: string, policyData: unknown): void {
    this.set(`${policyType}:${version}`, {
      policyType,
      policyData,
      version
    });
  }

  invalidateByType(policyType: string): number {
    return this.invalidateByTag(policyType);
  }
}

// ─── Search Cache ───────────────────────────────────────────────────────────────

export interface CachedSearchResult {
  results: unknown[];
  totalCount: number;
  queryHash: string;
}

export class SearchCache extends BaseCache<CachedSearchResult> {
  constructor(maxSize = 5000, maxMemoryBytes = 100 * 1024 * 1024) {
    super(maxSize, maxMemoryBytes, 300000); // 5 minute default TTL
  }

  get(key: string): CachedSearchResult | null {
    const entry = super.getEntry(key);
    return entry ? entry.value : null;
  }

  set(key: string, value: CachedSearchResult, ttlMs?: number, tags: string[] = []): void {
    super.setEntry(key, value, ttlMs, "MEDIUM", tags);
  }

  getByQueryHash(queryHash: string): CachedSearchResult | null {
    return this.get(`search:${queryHash}`);
  }

  setByQueryHash(queryHash: string, results: unknown[], totalCount: number): void {
    this.set(`search:${queryHash}`, {
      results,
      totalCount,
      queryHash
    }, 300000, ["search"]);
  }

  invalidateByIdentity(identityId: number): void {
    // In production, this would invalidate all search results containing this identity
    logger.debug({ identityId }, "Search cache invalidation for identity");
  }
}

// ─── Metadata Cache ─────────────────────────────────────────────────────────────

export interface CachedMetadata {
  metadata: Record<string, unknown>;
  version: number;
}

export class MetadataCache extends BaseCache<CachedMetadata> {
  constructor(maxSize = 20000, maxMemoryBytes = 200 * 1024 * 1024) {
    super(maxSize, maxMemoryBytes, 1800000); // 30 minute default TTL
  }

  get(key: string): CachedMetadata | null {
    const entry = super.getEntry(key);
    return entry ? entry.value : null;
  }

  set(key: string, value: CachedMetadata, ttlMs?: number, tags: string[] = []): void {
    super.setEntry(key, value, ttlMs, "MEDIUM", tags);
  }

  getByIdentity(identityId: number): CachedMetadata | null {
    return this.get(`identity:${identityId}`);
  }

  setByIdentity(identityId: number, metadata: Record<string, unknown>, version: number): void {
    this.set(`identity:${identityId}`, { metadata, version }, 1800000, ["identity", `id:${identityId}`]);
  }

  invalidateByIdentity(identityId: number): boolean {
    return this.invalidate(`identity:${identityId}`);
  }
}

// ─── Session Cache ─────────────────────────────────────────────────────────────

export interface CachedSession {
  userId: string;
  tenantId: string;
  permissions: string[];
  expiresAt: Date;
}

export class SessionCache extends BaseCache<CachedSession> {
  constructor(maxSize = 10000, maxMemoryBytes = 50 * 1024 * 1024) {
    super(maxSize, maxMemoryBytes, 1800000); // 30 minute default TTL
  }

  get(key: string): CachedSession | null {
    const entry = super.getEntry(key);
    if (!entry) return null;
    
    // Check if session is expired
    if (entry.value.expiresAt < new Date()) {
      this.invalidate(key);
      return null;
    }
    
    return entry.value;
  }

  set(key: string, value: CachedSession, ttlMs?: number, tags: string[] = []): void {
    super.setEntry(key, value, ttlMs, "HIGH", tags);
  }

  getByToken(token: string): CachedSession | null {
    return this.get(`session:${token}`);
  }

  setByToken(token: string, session: Omit<CachedSession, "expiresAt">, ttlMs?: number): void {
    const expiresAt = new Date(Date.now() + (ttlMs || this.defaultTtlMs));
    this.set(`session:${token}`, { ...session, expiresAt }, ttlMs, ["session"]);
  }

  invalidateByUser(userId: string): number {
    return this.invalidateByTag(`user:${userId}`);
  }
}

// ─── Multi-Layer Cache Manager ─────────────────────────────────────────────────

export class CacheManager {
  readonly embedding: EmbeddingCache;
  readonly policy: PolicyCache;
  readonly search: SearchCache;
  readonly metadata: MetadataCache;
  readonly session: SessionCache;

  constructor() {
    this.embedding = new EmbeddingCache();
    this.policy = new PolicyCache();
    this.search = new SearchCache();
    this.metadata = new MetadataCache();
    this.session = new SessionCache();
  }

  getStats(): Record<string, CacheStats> {
    return {
      embedding: this.embedding.getStats(),
      policy: this.policy.getStats(),
      search: this.search.getStats(),
      metadata: this.metadata.getStats(),
      session: this.session.getStats()
    };
  }

  clearAll(): void {
    this.embedding.clear();
    this.policy.clear();
    this.search.clear();
    this.metadata.clear();
    this.session.clear();
    logger.info("All caches cleared");
  }

  invalidateTenant(tenantId: string): void {
    // Invalidate all caches for a tenant
    this.search.invalidateByTag(`tenant:${tenantId}`);
    this.metadata.invalidateByTag(`tenant:${tenantId}`);
    logger.info({ tenantId }, "Tenant caches invalidated");
  }
}

// Singleton instance
export const cacheManager = new CacheManager();
