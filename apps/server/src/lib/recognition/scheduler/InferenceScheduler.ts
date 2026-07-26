/**
 * FaceVision — GPU Inference Scheduler
 * 
 * Schedules inference across multiple GPUs:
 * - Load balancing
 * - Priority queues
 * - Batch optimization
 * - Device affinity
 */

import { logger } from "../../logger.js";

/**
 * GPU device information.
 */
export interface GPUDevice {
  id: number;
  name: string;
  memoryMb: number;
  utilizedMemoryMb: number;
  utilizationPct: number;
  maxBatchSize: number;
  currentBatchSize: number;
}

/**
 * Inference task.
 */
export interface InferenceTask {
  id: string;
  priority: number;
  payload: Buffer;
  callback: (result: unknown) => void;
  createdAt: Date;
  estimatedTimeMs: number;
}

/**
 * Scheduler statistics.
 */
interface SchedulerStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgQueueTime: number;
  avgProcessingTime: number;
  gpuUtilization: Record<number, number>;
}

/**
 * GPU Inference Scheduler.
 */
export class InferenceScheduler {
  private devices: Map<number, GPUDevice> = new Map();
  private queues: Map<number, InferenceTask[]> = new Map();
  private processing: Map<string, InferenceTask> = new Map();
  private stats: SchedulerStats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    avgQueueTime: 0,
    avgProcessingTime: 0,
    gpuUtilization: {}
  };
  
  private schedulingInterval: NodeJS.Timeout | null = null;
  private counter = 0;

  constructor() {
    // Initialize with simulated GPUs
    this.initializeDevices();
  }

  /**
   * Initialize GPU devices.
   */
  private initializeDevices(): void {
    // Simulated GPU setup
    const gpuCount = 1; // Would detect actual GPUs

    for (let i = 0; i < gpuCount; i++) {
      const device: GPUDevice = {
        id: i,
        name: `GPU ${i}`,
        memoryMb: 8192,
        utilizedMemoryMb: 0,
        utilizationPct: 0,
        maxBatchSize: 32,
        currentBatchSize: 0
      };
      
      this.devices.set(i, device);
      this.queues.set(i, []);
    }

    logger.info({ gpuCount }, "GPU scheduler initialized");
  }

  /**
   * Submit an inference task.
   */
  submit(task: Omit<InferenceTask, "id" | "createdAt">): string {
    const taskId = `task_${++this.counter}_${Date.now()}`;
    
    const fullTask: InferenceTask = {
      ...task,
      id: taskId,
      createdAt: new Date()
    };

    this.stats.totalTasks++;

    // Select best device
    const deviceId = this.selectDevice();
    const queue = this.queues.get(deviceId);
    
    if (queue) {
      // Insert by priority
      const insertIndex = queue.findIndex(t => t.priority < fullTask.priority);
      if (insertIndex === -1) {
        queue.push(fullTask);
      } else {
        queue.splice(insertIndex, 0, fullTask);
      }
    }

    // Start scheduling if not running
    this.ensureScheduling();

    logger.debug({ taskId, deviceId, queueLength: queue?.length }, "Task submitted");

    return taskId;
  }

  /**
   * Submit multiple tasks as a batch.
   */
  submitBatch(tasks: Omit<InferenceTask, "id" | "createdAt">[]): string[] {
    return tasks.map(task => this.submit(task));
  }

  /**
   * Select the best device based on load.
   */
  private selectDevice(): number {
    let bestDevice = 0;
    let lowestLoad = Infinity;

    for (const [deviceId, device] of this.devices.entries()) {
      // Calculate load score
      const memoryLoad = device.utilizedMemoryMb / device.memoryMb;
      const batchLoad = device.currentBatchSize / device.maxBatchSize;
      const load = (memoryLoad * 0.6 + batchLoad * 0.4);

      if (load < lowestLoad) {
        lowestLoad = load;
        bestDevice = deviceId;
      }
    }

    return bestDevice;
  }

  /**
   * Ensure scheduling loop is running.
   */
  private ensureScheduling(): void {
    if (this.schedulingInterval) return;

    this.schedulingInterval = setInterval(() => {
      this.scheduleBatch();
    }, 50); // Schedule every 50ms
  }

  /**
   * Schedule batch processing.
   */
  private async scheduleBatch(): Promise<void> {
    for (const [deviceId, device] of this.devices.entries()) {
      const queue = this.queues.get(deviceId);
      if (!queue || queue.length === 0) continue;

      // Check if device can accept more
      const availableMemory = device.memoryMb - device.utilizedMemoryMb;
      if (availableMemory < 500) continue; // Need at least 500MB

      // Build batch
      const batchSize = Math.min(
        device.maxBatchSize - device.currentBatchSize,
        queue.length
      );

      if (batchSize === 0) continue;

      const batch = queue.splice(0, batchSize);

      // Update device state
      device.currentBatchSize += batch.length;

      // Process batch
      this.processBatch(deviceId, batch);
    }

    // Stop scheduling if all queues empty
    const allEmpty = Array.from(this.queues.values()).every(q => q.length === 0);
    if (allEmpty && this.processing.size === 0) {
      this.stopScheduling();
    }
  }

  /**
   * Process a batch of tasks.
   */
  private async processBatch(deviceId: number, batch: InferenceTask[]): Promise<void> {
    const startTime = Date.now();

    for (const task of batch) {
      this.processing.set(task.id, task);
    }

    try {
      // Simulate batch processing
      await this.executeBatch(batch);

      const processingTime = Date.now() - startTime;

      // Update statistics
      for (const task of batch) {
        this.stats.completedTasks++;
        const queueTime = startTime - task.createdAt.getTime();
        
        // Update running average
        const n = this.stats.completedTasks;
        this.stats.avgQueueTime = (this.stats.avgQueueTime * (n - 1) + queueTime) / n;
        this.stats.avgProcessingTime = (this.stats.avgProcessingTime * (n - 1) + processingTime) / n;

        // Call callback
        task.callback({ success: true, taskId: task.id });
        this.processing.delete(task.id);
      }

    } catch (error) {
      for (const task of batch) {
        this.stats.failedTasks++;
        task.callback({ success: false, taskId: task.id, error });
        this.processing.delete(task.id);
      }
    }

    // Update device state
    const device = this.devices.get(deviceId);
    if (device) {
      device.currentBatchSize -= batch.length;
      device.utilizedMemoryMb = Math.max(0, device.utilizedMemoryMb - batch.length * 100);
    }
  }

  /**
   * Execute actual batch processing (simulated).
   */
  private async executeBatch(batch: InferenceTask[]): Promise<void> {
    // In production: call actual inference engine
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
  }

  /**
   * Stop scheduling loop.
   */
  private stopScheduling(): void {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = null;
    }
  }

  /**
   * Get device information.
   */
  getDevices(): GPUDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get scheduler statistics.
   */
  getStats(): SchedulerStats & { queues: Record<number, number>; processing: number } {
    const queues: Record<number, number> = {};
    for (const [deviceId, queue] of this.queues.entries()) {
      queues[deviceId] = queue.length;
    }

    return {
      ...this.stats,
      gpuUtilization: Object.fromEntries(
        Array.from(this.devices.entries()).map(([id, d]) => [id, d.utilizationPct])
      ),
      queues,
      processing: this.processing.size
    };
  }

  /**
   * Cancel a task.
   */
  cancel(taskId: string): boolean {
    // Check processing queue
    const task = this.processing.get(taskId);
    if (task) {
      this.processing.delete(taskId);
      this.stats.failedTasks++;
      return true;
    }

    // Check device queues
    for (const queue of this.queues.values()) {
      const index = queue.findIndex(t => t.id === taskId);
      if (index !== -1) {
        queue.splice(index, 1);
        return true;
      }
    }

    return false;
  }

  /**
   * Shutdown scheduler.
   */
  shutdown(): void {
    this.stopScheduling();
    
    // Cancel all pending tasks
    for (const task of this.processing.values()) {
      task.callback({ success: false, error: "Scheduler shutdown" });
    }
    this.processing.clear();

    for (const queue of this.queues.values()) {
      queue.length = 0;
    }

    logger.info("GPU scheduler shut down");
  }
}

// Singleton instance
export const inferenceScheduler = new InferenceScheduler();
