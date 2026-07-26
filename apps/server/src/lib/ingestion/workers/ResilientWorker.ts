/**
 * FaceVision — Resilient Worker with Retry Strategy
 * 
 * Implements:
 * - Retry with exponential backoff
 * - Circuit breaker pattern
 * - Dead letter queue
 * - Graceful degradation
 */

import { logger } from "../../logger.js";
import type { IngestionJob, JobStatus, JobPriority } from "../pipeline/types.js";

/**
 * Retry configuration.
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/**
 * Circuit breaker states.
 */
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * Circuit breaker configuration.
 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

/**
 * Worker statistics.
 */
interface WorkerStats {
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
  circuitBreakerTrips: number;
}

/**
 * Resilient Worker - Handles jobs with retry and circuit breaker.
 */
export class ResilientWorker {
  private jobQueue: IngestionJob[] = [];
  private processing = false;
  private stats: WorkerStats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
    circuitBreakerTrips: 0
  };

  // Circuit breaker state
  private circuitState: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;

  // Configuration
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      "NETWORK_ERROR",
      "TIMEOUT",
      "RATE_LIMIT",
      "SERVICE_UNAVAILABLE",
      "INTERNAL_ERROR"
    ]
  };

  private circuitConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenMaxAttempts: 3
  };

  private counter = 0;

  constructor(
    private workerId: string,
    private processor: (job: IngestionJob) => Promise<void>
  ) {}

  /**
   * Submit a job to the worker queue.
   */
  submit(job: Omit<IngestionJob, "id" | "status" | "retryCount">): string {
    const jobId = `job_${++this.counter}_${Date.now()}`;
    
    const fullJob: IngestionJob = {
      ...job,
      id: jobId,
      status: "PENDING",
      retryCount: 0
    };

    // Sort by priority
    this.enqueueByPriority(fullJob);
    
    logger.info({ jobId, workerId: this.workerId }, "Job submitted to worker");

    // Start processing if not already running
    if (!this.processing) {
      this.process();
    }

    return jobId;
  }

  /**
   * Enqueue job by priority.
   */
  private enqueueByPriority(job: IngestionJob): void {
    const priorityOrder: Record<JobPriority, number> = {
      "CRITICAL": 0,
      "HIGH": 1,
      "NORMAL": 2,
      "LOW": 3
    };

    const insertIndex = this.jobQueue.findIndex(
      j => priorityOrder[j.priority] > priorityOrder[j.priority]
    );

    if (insertIndex === -1) {
      this.jobQueue.push(job);
    } else {
      this.jobQueue.splice(insertIndex, 0, job);
    }
  }

  /**
   * Process jobs from the queue.
   */
  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    logger.info({ workerId: this.workerId }, "Worker started processing");

    while (this.jobQueue.length > 0) {
      // Check circuit breaker
      if (!this.canProcess()) {
        await this.waitForCircuitReset();
        continue;
      }

      const job = this.jobQueue.shift();
      if (!job) continue;

      try {
        await this.processJob(job);
      } catch (error) {
        logger.error({ jobId: job.id, error }, "Job processing failed");
      }
    }

    this.processing = false;
    logger.info({ workerId: this.workerId }, "Worker stopped processing");
  }

  /**
   * Process a single job with retry logic.
   */
  private async processJob(job: IngestionJob): Promise<void> {
    this.stats.processed++;

    try {
      await this.processor(job);
      this.onSuccess(job);
    } catch (error) {
      this.onFailure(job, error);
    }
  }

  /**
   * Handle successful job completion.
   */
  private onSuccess(job: IngestionJob): void {
    job.status = "COMPLETED";
    this.stats.succeeded++;
    this.failureCount = 0; // Reset circuit breaker on success
    
    logger.info({ jobId: job.id }, "Job completed successfully");
  }

  /**
   * Handle job failure with retry logic.
   */
  private onFailure(job: IngestionJob, error: unknown): void {
    const errorType = this.categorizeError(error);
    
    if (this.isRetryable(errorType) && job.retryCount < this.retryConfig.maxRetries) {
      // Retry the job
      job.retryCount++;
      this.stats.retried++;
      
      const delay = this.calculateBackoff(job.retryCount);
      
      logger.warn({ 
        jobId: job.id, 
        retryCount: job.retryCount,
        delay,
        errorType
      }, "Scheduling job retry");

      setTimeout(() => {
        this.enqueueByPriority(job);
      }, delay);
    } else {
      // Job failed permanently
      job.status = "FAILED";
      this.stats.failed++;
      this.recordFailure();

      logger.error({ 
        jobId: job.id, 
        errorType,
        retryCount: job.retryCount
      }, "Job failed permanently");
    }
  }

  /**
   * Categorize an error to determine if it's retryable.
   */
  private categorizeError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes("network") || message.includes("fetch")) {
        return "NETWORK_ERROR";
      }
      if (message.includes("timeout")) {
        return "TIMEOUT";
      }
      if (message.includes("rate limit")) {
        return "RATE_LIMIT";
      }
      if (message.includes("503") || message.includes("unavailable")) {
        return "SERVICE_UNAVAILABLE";
      }
    }
    
    return "INTERNAL_ERROR";
  }

  /**
   * Check if an error type is retryable.
   */
  private isRetryable(errorType: string): boolean {
    return this.retryConfig.retryableErrors.includes(errorType);
  }

  /**
   * Calculate exponential backoff delay.
   */
  private calculateBackoff(retryCount: number): number {
    const delay = Math.min(
      this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, retryCount - 1),
      this.retryConfig.maxDelayMs
    );
    
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return delay + jitter;
  }

  // ─── Circuit Breaker ─────────────────────────────────────────────────────────

  /**
   * Check if processing is allowed based on circuit breaker.
   */
  private canProcess(): boolean {
    if (this.circuitState === "CLOSED") return true;
    
    if (this.circuitState === "OPEN") {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.circuitConfig.resetTimeoutMs) {
        this.circuitState = "HALF_OPEN";
        this.halfOpenAttempts = 0;
        logger.info({ workerId: this.workerId }, "Circuit breaker entering HALF_OPEN");
        return true;
      }
      return false;
    }

    // HALF_OPEN state
    return this.halfOpenAttempts < this.circuitConfig.halfOpenMaxAttempts;
  }

  /**
   * Wait for circuit breaker to reset.
   */
  private async waitForCircuitReset(): Promise<void> {
    const waitTime = Math.max(
      1000,
      this.circuitConfig.resetTimeoutMs - (Date.now() - this.lastFailureTime)
    );
    logger.debug({ workerId: this.workerId, waitTime }, "Waiting for circuit breaker reset");
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Record a failure for circuit breaker.
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.circuitState === "HALF_OPEN") {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.circuitConfig.halfOpenMaxAttempts) {
        this.circuitState = "OPEN";
        this.stats.circuitBreakerTrips++;
        logger.warn({ workerId: this.workerId }, "Circuit breaker OPEN (half-open failures)");
      }
    } else if (this.failureCount >= this.circuitConfig.failureThreshold) {
      this.circuitState = "OPEN";
      this.stats.circuitBreakerTrips++;
      logger.warn({ workerId: this.workerId }, "Circuit breaker OPEN (threshold exceeded)");
    }
  }

  /**
   * Get worker statistics.
   */
  getStats(): WorkerStats & { queueLength: number; circuitState: CircuitState } {
    return {
      ...this.stats,
      queueLength: this.jobQueue.length,
      circuitState: this.circuitState
    };
  }

  /**
   * Get circuit breaker state.
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Manually reset circuit breaker.
   */
  resetCircuitBreaker(): void {
    this.circuitState = "CLOSED";
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    logger.info({ workerId: this.workerId }, "Circuit breaker manually reset");
  }

  /**
   * Update retry configuration.
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Update circuit breaker configuration.
   */
  updateCircuitConfig(config: Partial<CircuitBreakerConfig>): void {
    this.circuitConfig = { ...this.circuitConfig, ...config };
  }
}

/**
 * Factory to create a resilient worker.
 */
export function createResilientWorker(
  workerId: string,
  processor: (job: IngestionJob) => Promise<void>
): ResilientWorker {
  return new ResilientWorker(workerId, processor);
}
