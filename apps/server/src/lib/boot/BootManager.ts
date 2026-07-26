/**
 * FaceVision — Boot Manager
 * 
 * Manages the sequential startup of all system components with independent
 * initialization, health checks, and graceful error handling.
 * 
 * Boot Sequence:
 * ┌─────────────┐
 * │   Startup   │
 * └──────┬──────┘
 *        ↓
 * ┌──────▼──────┐
 * │  Database   │ ← Fails independently
 * └──────┬──────┘
 *        ↓
 * ┌──────▼──────┐
 * │   Models    │ ← Fails independently
 * └──────┬──────┘
 *        ↓
 * ┌──────▼──────┐
 * │    Queue    │ ← Fails independently
 * └──────┬──────┘
 *        ↓
 * ┌──────▼──────┐
 * │   Workers   │ ← Fails independently
 * └──────┬──────┘
 *        ↓
 * ┌──────▼──────┐
 * │   Server    │
 * └─────────────┘
 */

import { logger } from "../logger.js";
import { db, checkConnection } from "@workspace/db";
import { initializeModels, getModelStatus } from "../modelManager.js";
import { initializeInsightFace } from "../insightface/index.js";

export interface BootStage {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  error?: Error;
  durationMs?: number;
  details?: Record<string, unknown>;
}

export interface BootResult {
  success: boolean;
  stages: BootStage[];
  totalDurationMs: number;
  serverReady: boolean;
}

export interface HealthCheck {
  name: string;
  healthy: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Boot Manager orchestrates the startup sequence of all system components.
 * Each stage initializes independently and reports its health status.
 */
export class BootManager {
  private stages: Map<string, BootStage> = new Map();
  private startTime: number = 0;

  constructor() {
    this.stages.set("database", { name: "database", status: "pending" });
    this.stages.set("models", { name: "models", status: "pending" });
    this.stages.set("insightface", { name: "insightface", status: "pending" });
    this.stages.set("queue", { name: "queue", status: "pending" });
    this.stages.set("workers", { name: "workers", status: "pending" });
    this.stages.set("server", { name: "server", status: "pending" });
  }

  private async runStage(
    name: string,
    fn: () => Promise<void>
  ): Promise<void> {
    const stage = this.stages.get(name)!;
    stage.status = "running";
    const stageStart = Date.now();

    try {
      logger.info({ stage: name }, `Boot stage starting: ${name}`);
      await fn();
      stage.status = "completed";
      stage.durationMs = Date.now() - stageStart;
      logger.info({ 
        stage: name, 
        durationMs: stage.durationMs 
      }, `Boot stage completed: ${name}`);
    } catch (error) {
      stage.status = "failed";
      stage.error = error instanceof Error ? error : new Error(String(error));
      stage.durationMs = Date.now() - stageStart;
      logger.error({ 
        stage: name, 
        error: stage.error.message,
        durationMs: stage.durationMs 
      }, `Boot stage failed: ${name}`);
      throw error;
    }
  }

  /**
   * Execute the full boot sequence.
   * Returns immediately on first failure.
   */
  async boot(): Promise<BootResult> {
    this.startTime = Date.now();
    const result: BootResult = {
      success: false,
      stages: [],
      totalDurationMs: 0,
      serverReady: false,
    };

    try {
      // Stage 1: Database
      await this.runStage("database", async () => {
        await this.initializeDatabase();
      });

      // Stage 2: ML Models
      await this.runStage("models", async () => {
        await this.initializeModels();
      });

      // Stage 3: InsightFace Engine
      await this.runStage("insightface", async () => {
        await this.initializeInsightFace();
      });

      // Stage 4: Queue System
      await this.runStage("queue", async () => {
        await this.initializeQueue();
      });

      // Stage 5: Workers
      await this.runStage("workers", async () => {
        await this.initializeWorkers();
      });

      // Mark server as ready
      this.stages.get("server")!.status = "completed";

      result.success = true;
      result.serverReady = true;

    } catch (error) {
      logger.error({ error }, "Boot sequence failed");
      result.success = false;
    }

    result.totalDurationMs = Date.now() - this.startTime;
    result.stages = Array.from(this.stages.values());

    logger.info({ 
      success: result.success, 
      totalDurationMs: result.totalDurationMs,
      stages: result.stages.map(s => `${s.name}:${s.status}`).join(", ")
    }, "Boot sequence finished");

    return result;
  }

  private async initializeDatabase(): Promise<void> {
    const connected = await checkConnection();
    if (!connected) {
      throw new Error("Failed to connect to database");
    }
    logger.info("Database connection established");
  }

  private async initializeModels(): Promise<void> {
    const status = await initializeModels();
    if (!status.loaded) {
      throw new Error(`Model initialization failed: ${status.error || "Unknown error"}`);
    }
    logger.info({ modelPath: status.modelPath }, "ML models loaded");
  }

  private async initializeInsightFace(): Promise<void> {
    try {
      await initializeInsightFace();
      logger.info("InsightFace engine initialized");
    } catch (error) {
      // InsightFace is optional - log warning but don't fail boot
      logger.warn({ error }, "InsightFace initialization failed - will use fallback");
      this.stages.get("insightface")!.details = { 
        optional: true, 
        warning: "Running without InsightFace" 
      };
    }
  }

  private async initializeQueue(): Promise<void> {
    // Queue initialization is optional for now
    // Can be extended to include Redis/RabbitMQ setup
    this.stages.get("queue")!.details = { 
      status: "lazy_init", 
      message: "Queue uses lazy initialization" 
    };
    logger.info("Queue system initialized (lazy mode)");
  }

  private async initializeWorkers(): Promise<void> {
    // Worker initialization - can be extended for background job processing
    this.stages.get("workers")!.details = { 
      status: "lazy_init",
      message: "Workers initialized on demand" 
    };
    logger.info("Workers initialized");
  }

  /**
   * Get health status of all components.
   */
  getHealthChecks(): HealthCheck[] {
    const checks: HealthCheck[] = [];

    // Database health
    checks.push({
      name: "database",
      healthy: this.stages.get("database")?.status === "completed",
      message: "Database connection status",
    });

    // Models health
    const modelStatus = getModelStatus();
    checks.push({
      name: "models",
      healthy: modelStatus.loaded,
      message: modelStatus.loaded ? "Models loaded" : "Models not loaded",
      details: { modelPath: modelStatus.modelPath },
    });

    // InsightFace health
    const insightfaceStage = this.stages.get("insightface")!;
    checks.push({
      name: "insightface",
      healthy: insightfaceStage.status === "completed" || insightfaceStage.details?.optional === true,
      message: insightfaceStage.status === "completed" ? "Ready" : "Not available (optional)",
    });

    // Server health
    checks.push({
      name: "server",
      healthy: this.stages.get("server")?.status === "completed",
      message: "HTTP server status",
    });

    return checks;
  }

  /**
   * Get boot result summary.
   */
  getSummary(): { isHealthy: boolean; failedStage?: string } {
    const failedStage = Array.from(this.stages.entries())
      .find(([, stage]) => stage.status === "failed")?.[0];
    
    return {
      isHealthy: this.stages.get("server")?.status === "completed",
      failedStage,
    };
  }
}

// Singleton instance
export const bootManager = new BootManager();
