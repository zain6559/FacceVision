/**
 * FaceVision — Backend Registry
 * 
 * Manages registration and access to face embedding backends.
 * Allows dynamic switching between different backends at runtime.
 */

import { logger } from "../logger.js";
import type { 
  FaceEmbeddingBackend, 
  BackendFactory, 
  BackendInfo,
  EmbeddingResult,
  MatchResult,
  DetectedFace,
  FaceDetectionResult,
  AlignedFace
} from "./FaceEmbeddingBackend.js";

/**
 * Registry for face embedding backends.
 * Provides a unified interface to all registered backends.
 */
export class BackendRegistry {
  private backends: Map<string, FaceEmbeddingBackend> = new Map();
  private factories: Map<string, BackendFactory> = new Map();
  private activeBackendId: string | null = null;

  /**
   * Register a backend factory.
   */
  registerFactory(id: string, factory: BackendFactory): void {
    if (this.factories.has(id)) {
      logger.warn({ backendId: id }, "Backend factory already registered, overwriting");
    }
    this.factories.set(id, factory);
    logger.info({ backendId: id }, "Backend factory registered");
  }

  /**
   * Initialize a backend by ID.
   */
  async initializeBackend(id: string, config?: Record<string, unknown>): Promise<FaceEmbeddingBackend> {
    const factory = this.factories.get(id);
    if (!factory) {
      throw new Error(`Backend factory not found: ${id}`);
    }

    const backend = await factory(config);
    await backend.initialize();
    this.backends.set(id, backend);
    
    // Set as active if first backend
    if (!this.activeBackendId) {
      this.activeBackendId = id;
    }

    logger.info({ backendId: id }, "Backend initialized and registered");
    return backend;
  }

  /**
   * Set the active backend.
   */
  setActiveBackend(id: string): void {
    if (!this.backends.has(id)) {
      throw new Error(`Backend not found: ${id}`);
    }
    this.activeBackendId = id;
    logger.info({ backendId: id }, "Active backend switched");
  }

  /**
   * Get the active backend.
   */
  getActiveBackend(): FaceEmbeddingBackend | null {
    if (!this.activeBackendId) return null;
    return this.backends.get(this.activeBackendId) || null;
  }

  /**
   * Get backend by ID.
   */
  getBackend(id: string): FaceEmbeddingBackend | null {
    return this.backends.get(id) || null;
  }

  /**
   * Get info about all registered backends.
   */
  getAllBackendsInfo(): BackendInfo[] {
    return Array.from(this.backends.values()).map(b => b.getInfo());
  }

  /**
   * Get info about the active backend.
   */
  getActiveBackendInfo(): BackendInfo | null {
    const backend = this.getActiveBackend();
    return backend ? backend.getInfo() : null;
  }

  /**
   * Check if a backend is ready.
   */
  isBackendReady(id?: string): boolean {
    const backendId = id || this.activeBackendId;
    if (!backendId) return false;
    const backend = this.backends.get(backendId);
    return backend ? backend.isReady() : false;
  }

  /**
   * Destroy all backends and cleanup.
   */
  async destroyAll(): Promise<void> {
    for (const [id, backend] of this.backends) {
      try {
        await backend.destroy();
        logger.info({ backendId: id }, "Backend destroyed");
      } catch (error) {
        logger.error({ backendId: id, error }, "Error destroying backend");
      }
    }
    this.backends.clear();
    this.activeBackendId = null;
  }
}

// Singleton instance
export const backendRegistry = new BackendRegistry();
