/**
 * FaceVision — Learning Pipeline
 * 
 * Implements continuous learning from agent interactions:
 * 
 * Recognition → Human Review → Feedback → Dataset → Training Queue → Evaluation → Promotion
 */

import { logger } from "../../logger.js";
import type { 
  LearningSignal,
  LearningExample,
  ModelUpdate,
  AgentContext,
  Goal,
  ActionResult
} from "../types.js";

/**
 * Learning Pipeline - Manages the agent's learning cycle.
 */
export class LearningPipeline {
  private examples: Map<string, LearningExample> = new Map();
  private updates: Map<string, ModelUpdate> = new Map();
  private exampleCounter = 0;
  private updateCounter = 0;
  
  // Thresholds for automatic learning
  private readonly FP_THRESHOLD = 0.3;  // False positive threshold
  private readonly FN_THRESHOLD = 0.7;  // False negative threshold
  private readonly BATCH_SIZE = 100;   // Examples before training

  /**
   * Record a learning signal from agent execution.
   */
  recordSignal(
    signal: LearningSignal,
    context: {
      goal: Goal;
      actions: ActionResult[];
      expectedOutput?: unknown;
      actualOutput?: unknown;
      feedback?: string;
    }
  ): LearningExample | null {
    // Only create examples for recognition-related signals
    if (!this.isRelevantSignal(signal, context.goal)) {
      return null;
    }

    const exampleId = `example_${++this.exampleCounter}_${Date.now()}`;
    
    const example: LearningExample = {
      id: exampleId,
      queryEmbedding: this.extractEmbedding(context),
      expectedOutput: context.expectedOutput,
      actualOutput: context.actualOutput,
      signal,
      feedback: context.feedback,
      createdAt: new Date(),
      used: false
    };

    this.examples.set(exampleId, example);
    logger.info({ exampleId, signal }, "Learning example recorded");

    // Check if we should trigger training
    if (this.shouldTriggerTraining()) {
      this.triggerTraining();
    }

    return example;
  }

  /**
   * Check if signal is relevant to learning.
   */
  private isRelevantSignal(signal: LearningSignal, goal: Goal): boolean {
    const recognitionGoals = ["IDENTIFY_PERSON", "VERIFY_PERSON", "ENROLL_NEW_PERSON"];
    
    return recognitionGoals.includes(goal.type) ||
           signal === "HUMAN_FEEDBACK" ||
           signal === "THRESHOLD_UPDATE";
  }

  /**
   * Extract embedding from context (simplified).
   */
  private extractEmbedding(context: { goal: Goal }): number[] {
    // In real implementation, extract from working memory
    const embedding = context.goal.context?.embedding as number[];
    return embedding || [];
  }

  /**
   * Check if training should be triggered.
   */
  private shouldTriggerTraining(): boolean {
    const unusedExamples = Array.from(this.examples.values()).filter(e => !e.used);
    return unusedExamples.length >= this.BATCH_SIZE;
  }

  /**
   * Trigger training with collected examples.
   */
  async triggerTraining(): Promise<ModelUpdate | null> {
    const unusedExamples = Array.from(this.examples.values())
      .filter(e => !e.used)
      .slice(0, this.BATCH_SIZE);

    if (unusedExamples.length === 0) {
      return null;
    }

    logger.info({ count: unusedExamples.length }, "Triggering model training");

    // Mark examples as used
    for (const example of unusedExamples) {
      example.used = true;
    }

    // Generate model update
    const update = this.generateModelUpdate(unusedExamples);
    this.updates.set(update.id, update);

    return update;
  }

  /**
   * Generate a model update from learning examples.
   */
  private generateModelUpdate(examples: LearningExample[]): ModelUpdate {
    const updateId = `update_${++this.updateCounter}_${Date.now()}`;

    // Analyze signals to determine update type
    const signalCounts = this.countSignals(examples);
    
    let updateType: ModelUpdate["type"];
    let changes: Record<string, unknown> = {};

    // Determine update type based on dominant signal
    if (signalCounts["HUMAN_FEEDBACK"] > signalCounts["FALSE_POSITIVE"] &&
        signalCounts["HUMAN_FEEDBACK"] > signalCounts["FALSE_NEGATIVE"]) {
      updateType = "THRESHOLD";
      changes = this.calculateThresholdAdjustment(examples);
    } else if (signalCounts["FALSE_POSITIVE"] > signalCounts["FALSE_NEGATIVE"]) {
      updateType = "THRESHOLD";
      changes = { thresholdAdjustment: 0.05 }; // Increase threshold
    } else if (signalCounts["FALSE_NEGATIVE"] > signalCounts["FALSE_POSITIVE"]) {
      updateType = "THRESHOLD";
      changes = { thresholdAdjustment: -0.05 }; // Decrease threshold
    } else {
      updateType = "WEIGHT";
      changes = this.calculateWeightAdjustment(examples);
    }

    const update: ModelUpdate = {
      id: updateId,
      type: updateType,
      changes,
      basedOn: examples.map(e => e.id),
      createdAt: new Date(),
      status: "PENDING"
    };

    logger.info({ 
      updateId, 
      type: updateType,
      basedOn: examples.length 
    }, "Model update generated");

    return update;
  }

  /**
   * Count signal types in examples.
   */
  private countSignals(examples: LearningExample[]): Record<LearningSignal, number> {
    const counts: Record<LearningSignal, number> = {
      "HUMAN_FEEDBACK": 0,
      "FALSE_POSITIVE": 0,
      "FALSE_NEGATIVE": 0,
      "CONFIDENCE_ADJUSTMENT": 0,
      "THRESHOLD_UPDATE": 0
    };

    for (const example of examples) {
      counts[example.signal]++;
    }

    return counts;
  }

  /**
   * Calculate threshold adjustment from human feedback.
   */
  private calculateThresholdAdjustment(examples: LearningExample[]): Record<string, unknown> {
    let totalAdjustment = 0;
    let count = 0;

    for (const example of examples) {
      if (example.signal === "HUMAN_FEEDBACK" && example.feedback) {
        // Parse feedback for threshold adjustments
        const adjustment = this.parseThresholdFeedback(example.feedback);
        if (adjustment !== null) {
          totalAdjustment += adjustment;
          count++;
        }
      }
    }

    const avgAdjustment = count > 0 ? totalAdjustment / count : 0;
    
    return {
      thresholdAdjustment: avgAdjustment,
      basedOnFeedbackCount: count
    };
  }

  /**
   * Parse threshold adjustment from feedback string.
   */
  private parseThresholdFeedback(feedback: string): number | null {
    const increaseMatch = feedback.match(/increase.*threshold.*(\d+\.?\d*)/i);
    const decreaseMatch = feedback.match(/decrease.*threshold.*(\d+\.?\d*)/i);
    
    if (increaseMatch) {
      return parseFloat(increaseMatch[1]);
    }
    if (decreaseMatch) {
      return -parseFloat(decreaseMatch[1]);
    }
    
    return null;
  }

  /**
   * Calculate weight adjustment for ensemble algorithms.
   */
  private calculateWeightAdjustment(examples: LearningExample[]): Record<string, unknown> {
    // Simplified weight adjustment based on false positive/negative rates
    const fpRate = examples.filter(e => e.signal === "FALSE_POSITIVE").length / examples.length;
    const fnRate = examples.filter(e => e.signal === "FALSE_NEGATIVE").length / examples.length;

    return {
      clbpWeight: fpRate > fnRate ? -0.05 : 0.05,
      hogWeight: fpRate < fnRate ? 0.1 : -0.05,
      lpqWeight: 0, // No change
      adjustmentReason: fpRate > fnRate ? "Reducing false positives" : "Reducing false negatives"
    };
  }

  /**
   * Apply a pending update.
   */
  async applyUpdate(updateId: string): Promise<boolean> {
    const update = this.updates.get(updateId);
    if (!update || update.status !== "PENDING") {
      return false;
    }

    logger.info({ updateId, type: update.type }, "Applying model update");

    // In real implementation, apply changes to model/policy engine
    // For now, just mark as applied
    update.status = "APPLIED";

    logger.info({ updateId }, "Model update applied successfully");
    return true;
  }

  /**
   * Rollback an applied update.
   */
  rollbackUpdate(updateId: string): boolean {
    const update = this.updates.get(updateId);
    if (!update || update.status !== "APPLIED") {
      return false;
    }

    logger.info({ updateId }, "Rolling back model update");

    // In real implementation, rollback changes
    update.status = "ROLLED_BACK";

    return true;
  }

  /**
   * Get pending updates.
   */
  getPendingUpdates(): ModelUpdate[] {
    return Array.from(this.updates.values())
      .filter(u => u.status === "PENDING");
  }

  /**
   * Get applied updates history.
   */
  getUpdateHistory(limit = 10): ModelUpdate[] {
    return Array.from(this.updates.values())
      .filter(u => u.status === "APPLIED")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get learning statistics.
   */
  getStats(): {
    totalExamples: number;
    unusedExamples: number;
    pendingUpdates: number;
    appliedUpdates: number;
    signalDistribution: Record<LearningSignal, number>;
  } {
    const allExamples = Array.from(this.examples.values());
    const signalCounts = this.countSignals(allExamples);

    return {
      totalExamples: allExamples.length,
      unusedExamples: allExamples.filter(e => !e.used).length,
      pendingUpdates: this.updates.size,
      appliedUpdates: Array.from(this.updates.values()).filter(u => u.status === "APPLIED").length,
      signalDistribution: signalCounts
    };
  }

  /**
   * Clear all learning data.
   */
  clear(): void {
    this.examples.clear();
    this.updates.clear();
    logger.info("Learning data cleared");
  }
}

// Singleton instance
export const learningPipeline = new LearningPipeline();
