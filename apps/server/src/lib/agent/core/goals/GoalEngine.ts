/**
 * FaceVision — Goal Engine
 * 
 * Implements Goal-Driven Architecture for the biometric intelligence agent.
 * Goals are analyzed first, then appropriate actions are planned.
 */

import { logger } from "../../logger.js";
import type { 
  Goal, 
  GoalType, 
  GoalPriority, 
  GoalStatus,
  AgentContext 
} from "../types.js";

/**
 * Goal classification based on request analysis.
 */
interface GoalClassification {
  primaryGoal: GoalType;
  priority: GoalPriority;
  context: Record<string, unknown>;
  subGoals: GoalType[];
}

/**
 * Goal Engine - Analyzes incoming requests and creates structured goals.
 * 
 * This is the FIRST step in the agent pipeline:
 * 
 * Request → [Goal Engine] → Goal → [Planner] → Action Graph → [Executor]
 */
export class GoalEngine {
  private goalCounter = 0;

  /**
   * Analyze a request and create an appropriate goal.
   */
  analyzeRequest(
    request: {
      type?: string;
      imageBase64?: string;
      personId?: string;
      query?: string;
      action?: string;
      metadata?: Record<string, unknown>;
    },
    priority: GoalPriority = "NORMAL"
  ): Goal {
    const classification = this.classifyRequest(request);
    const goal = this.createGoal(classification, priority);
    
    logger.info({ 
      goalId: goal.id, 
      goalType: goal.type,
      priority: goal.priority 
    }, "Goal created from request analysis");
    
    return goal;
  }

  /**
   * Classify the request type and determine goal structure.
   */
  private classifyRequest(request: {
    type?: string;
    imageBase64?: string;
    personId?: string;
    query?: string;
    action?: string;
    metadata?: Record<string, unknown>;
  }): GoalClassification {
    const { type, imageBase64, personId, query, action } = request;

    // Determine goal type based on request characteristics
    let primaryGoal: GoalType;
    let subGoals: GoalType[] = [];
    const context: Record<string, unknown> = { ...request.metadata || {} };

    // Priority 1: Explainability requests
    if (action === "explain" || type === "explain") {
      primaryGoal = "EXPLAIN_MATCH";
      context.requiresHeatmap = true;
      context.requiresSaliency = true;
    }
    // Priority 2: Forensic analysis
    else if (action === "forensic" || type === "forensic") {
      primaryGoal = "ANALYZE_FORENSIC";
      subGoals = ["IDENTIFY_PERSON", "EXPLAIN_MATCH", "SEARCH_KNOWLEDGE"];
    }
    // Priority 3: Verification (two images)
    else if (type === "verify" || (imageBase64 && request.metadata?.imageB)) {
      primaryGoal = "VERIFY_PERSON";
      context.imageA = imageBase64;
      context.imageB = request.metadata?.imageB;
    }
    // Priority 4: Identification (one image, no personId)
    else if (imageBase64 && !personId) {
      primaryGoal = "IDENTIFY_PERSON";
      context.requiresMultipleMatches = true;
    }
    // Priority 5: Search knowledge base
    else if (query) {
      primaryGoal = "SEARCH_KNOWLEDGE";
      context.searchQuery = query;
    }
    // Priority 6: Enroll new person
    else if (action === "enroll" || type === "enroll") {
      primaryGoal = "ENROLL_NEW_PERSON";
      subGoals = ["RECOGNITION_DETECT", "DATABASE_INSERT"];
    }
    // Priority 7: Spoof detection
    else if (action === "spoof" || type === "spoof") {
      primaryGoal = "DETECT_SPOOF";
    }
    // Priority 8: Cluster analysis
    else if (action === "cluster" || type === "cluster") {
      primaryGoal = "CLUSTER_FACES";
      context.requiresUnsupervised = true;
    }
    // Priority 9: System calibration
    else if (action === "calibrate" || type === "calibrate") {
      primaryGoal = "CALIBRATE_SYSTEM";
    }
    // Default: Identification
    else {
      primaryGoal = imageBase64 ? "IDENTIFY_PERSON" : "SEARCH_KNOWLEDGE";
    }

    // Determine priority based on context
    let computedPriority: GoalPriority = priority;
    if (context.requiresUrgent === true) {
      computedPriority = "CRITICAL";
    } else if (request.metadata?.confidence && (request.metadata.confidence as number) < 0.5) {
      computedPriority = "HIGH";
    }

    return {
      primaryGoal,
      priority: computedPriority,
      context,
      subGoals
    };
  }

  /**
   * Create a structured goal from classification.
   */
  private createGoal(classification: GoalClassification, priority: GoalPriority): Goal {
    const goalId = `goal_${++this.goalCounter}_${Date.now()}`;
    
    return {
      id: goalId,
      type: classification.primaryGoal,
      priority: classification.priority !== "NORMAL" ? classification.priority : priority,
      description: this.getGoalDescription(classification.primaryGoal),
      context: classification.context,
      createdAt: new Date(),
      status: "PENDING"
    };
  }

  /**
   * Get human-readable description for goal type.
   */
  private getGoalDescription(goalType: GoalType): string {
    const descriptions: Record<GoalType, string> = {
      "IDENTIFY_PERSON": "Identify a person from their face",
      "VERIFY_PERSON": "Verify if two faces belong to the same person",
      "SEARCH_KNOWLEDGE": "Search the knowledge base for related information",
      "CLUSTER_FACES": "Cluster similar faces to discover unknown identities",
      "ENROLL_NEW_PERSON": "Enroll a new person into the database",
      "EXPLAIN_MATCH": "Explain why two faces matched or didn't match",
      "ANALYZE_FORENSIC": "Perform forensic analysis on a face",
      "DETECT_SPOOF": "Detect if a face is real or a spoof attempt",
      "CALIBRATE_SYSTEM": "Calibrate system thresholds for optimal performance"
    };
    return descriptions[goalType] || "Unknown goal";
  }

  /**
   * Update goal status.
   */
  updateGoalStatus(goal: Goal, status: GoalStatus, result?: unknown, error?: string): Goal {
    return {
      ...goal,
      status,
      result: result ?? goal.result,
      error: error ?? goal.error
    };
  }

  /**
   * Check if goal is terminal (completed or failed).
   */
  isGoalTerminal(goal: Goal): boolean {
    return ["COMPLETED", "FAILED", "CANCELLED"].includes(goal.status);
  }

  /**
   * Compare goals by priority for scheduling.
   */
  compareByPriority(a: Goal, b: Goal): number {
    const priorityOrder: Record<GoalPriority, number> = {
      "CRITICAL": 0,
      "HIGH": 1,
      "NORMAL": 2,
      "LOW": 3
    };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  }

  /**
   * Determine what sub-goals might be needed based on context.
   */
  inferSubGoals(goal: Goal): GoalType[] {
    const subGoals: GoalType[] = [];

    // If primary goal is identification, we need detection first
    if (goal.type === "IDENTIFY_PERSON" || goal.type === "VERIFY_PERSON") {
      subGoals.push("RECOGNITION_DETECT" as GoalType);
    }

    // If context requires explanation, add it
    if (goal.context.requiresExplanation) {
      subGoals.push("EXPLAIN_MATCH");
    }

    // If confidence is low, suggest cluster analysis
    if (goal.context.requiresMultipleMatches) {
      subGoals.push("CLUSTER_FACES");
    }

    return subGoals;
  }
}

// Singleton instance
export const goalEngine = new GoalEngine();
