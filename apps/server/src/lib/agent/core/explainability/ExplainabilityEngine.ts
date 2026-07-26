/**
 * FaceVision — Explainability Engine
 * 
 * Integrates explainability INTO the decision process, not as a separate report.
 * 
 * Decision → Evidence → Confidence → Explanation
 *     ↓           ↓           ↓           ↓
 *   Action    [data why]  [how sure]  [human readable]
 */

import { logger } from "../../logger.js";
import type { 
  AgentContext,
  Evidence,
  Goal
} from "../types.js";

/**
 * Decision with full explainability context.
 */
export interface ExplainableDecision {
  action: string;
  confidence: number;
  evidence: Evidence[];
  reasoning: string;
  alternativeActions: Array<{
    action: string;
    confidence: number;
    reasonNotChosen: string;
  }>;
}

/**
 * Explainability Engine - Generates explanations for agent decisions.
 */
export class ExplainabilityEngine {
  /**
   * Generate explainable decision from context.
   */
  generateDecision(context: AgentContext): ExplainableDecision {
    const action = context.currentActions[0]?.type || "UNKNOWN";
    const confidence = this.calculateConfidence(context);
    const evidence = this.gatherEvidence(context);
    const reasoning = this.generateReasoning(context, action, confidence);
    const alternatives = this.generateAlternatives(context, action);

    return {
      action,
      confidence,
      evidence,
      reasoning,
      alternativeActions: alternatives
    };
  }

  /**
   * Calculate decision confidence from multiple factors.
   */
  private calculateConfidence(context: AgentContext): number {
    let confidence = 0.5; // Base confidence

    // Factor 1: Recognition confidence
    if (context.confidence > 0) {
      confidence = context.confidence * 0.6;
    }

    // Factor 2: Evidence strength
    const evidenceStrength = this.calculateEvidenceStrength(context.evidence);
    confidence += evidenceStrength * 0.2;

    // Factor 3: Action completion rate
    const completionRate = this.getCompletionRate(context);
    confidence += completionRate * 0.1;

    // Factor 4: Memory relevance
    const memoryRelevance = this.getMemoryRelevance(context);
    confidence += memoryRelevance * 0.1;

    // Normalize to 0-1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate evidence strength (0-1).
   */
  private calculateEvidenceStrength(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;

    const totalWeight = evidence.reduce((sum, e) => sum + e.weight, 0);
    const maxWeight = evidence.length; // Assuming max weight per evidence is 1
    
    return Math.min(1, totalWeight / maxWeight);
  }

  /**
   * Get action completion rate.
   */
  private getCompletionRate(context: AgentContext): number {
    const total = context.completedActions.length;
    const successful = context.completedActions.filter(a => a.success).length;
    
    return total > 0 ? successful / total : 0;
  }

  /**
   * Get memory relevance score.
   */
  private getMemoryRelevance(context: AgentContext): number {
    // Check if we have relevant recognition memory
    if (context.recognitionMemory.size > 0) {
      return 0.8;
    }
    
    // Check knowledge memory
    if (context.knowledgeMemory.size > 0) {
      return 0.5;
    }
    
    return 0;
  }

  /**
   * Gather all relevant evidence.
   */
  private gatherEvidence(context: AgentContext): Evidence[] {
    const evidence: Evidence[] = [...context.evidence];

    // Add recognition evidence
    if (context.confidence > 0) {
      evidence.push({
        type: "RECOGNITION_CONFIDENCE",
        data: context.confidence,
        weight: 0.8,
        source: "recognition_provider",
        timestamp: new Date()
      });
    }

    // Add action completion evidence
    for (const result of context.completedActions) {
      evidence.push({
        type: "ACTION_RESULT",
        data: { actionId: result.actionId, success: result.success },
        weight: result.confidence,
        source: "action_executor",
        timestamp: new Date()
      });
    }

    // Add memory evidence
    if (context.recognitionMemory.size > 0) {
      evidence.push({
        type: "RECOGNITION_MEMORY",
        data: { subjectsKnown: context.recognitionMemory.size },
        weight: 0.5,
        source: "memory_system",
        timestamp: new Date()
      });
    }

    return evidence;
  }

  /**
   * Generate human-readable reasoning.
   */
  private generateReasoning(
    context: AgentContext, 
    action: string, 
    confidence: number
  ): string {
    const parts: string[] = [];

    // Goal-based reasoning
    parts.push(`Goal: ${this.getGoalDescription(context.goal)}`);

    // Confidence-based reasoning
    if (confidence >= 0.8) {
      parts.push("High confidence based on multiple strong evidence signals.");
    } else if (confidence >= 0.5) {
      parts.push("Moderate confidence. Some uncertainty in evidence.");
    } else {
      parts.push("Low confidence. Consider human review or additional verification.");
    }

    // Recognition-specific reasoning
    if (context.confidence >= 0.7) {
      parts.push(`Recognition achieved ${(context.confidence * 100).toFixed(1)}% match.`);
    } else if (context.confidence > 0) {
      parts.push(`Recognition confidence is ${(context.confidence * 100).toFixed(1)}%.`);
    }

    // Evidence summary
    const strongEvidence = context.evidence.filter(e => e.weight >= 0.7).length;
    if (strongEvidence > 0) {
      parts.push(`${strongEvidence} strong evidence signals identified.`);
    }

    // Memory-based reasoning
    if (context.recognitionMemory.size > 0) {
      parts.push(`Subject has been recognized ${context.recognitionMemory.size} time(s) before.`);
    }

    return parts.join(" ");
  }

  /**
   * Get human-readable goal description.
   */
  private getGoalDescription(goal: Goal): string {
    const descriptions: Record<string, string> = {
      "IDENTIFY_PERSON": "Identify person from face",
      "VERIFY_PERSON": "Verify if two faces match",
      "SEARCH_KNOWLEDGE": "Search knowledge base",
      "CLUSTER_FACES": "Cluster similar faces",
      "ENROLL_NEW_PERSON": "Enroll new person",
      "EXPLAIN_MATCH": "Explain match result",
      "ANALYZE_FORENSIC": "Perform forensic analysis",
      "DETECT_SPOOF": "Detect spoof attempt",
      "CALIBRATE_SYSTEM": "Calibrate system thresholds"
    };
    return descriptions[goal.type] || goal.type;
  }

  /**
   * Generate alternative actions that were considered.
   */
  private generateAlternatives(
    context: AgentContext, 
    chosenAction: string
  ): ExplainableDecision["alternativeActions"] {
    const alternatives: ExplainableDecision["alternativeActions"] = [];

    // Consider actions not taken
    const possibleActions = [
      { action: "RECOGNITION_IDENTIFY", reason: "Standard identification flow" },
      { action: "CLUSTER_ANALYZE", reason: "When multiple candidates exist" },
      { action: "HUMAN_REVIEW", reason: "When confidence is low" },
      { action: "EXPLAIN_MATCH", reason: "When explanation is required" }
    ];

    for (const alt of possibleActions) {
      if (alt.action !== chosenAction) {
        // Calculate confidence for alternative
        const altConfidence = this.calculateAlternativeConfidence(context, alt.action);
        
        alternatives.push({
          action: alt.action,
          confidence: altConfidence,
          reasonNotChosen: alt.reason
        });
      }
    }

    return alternatives;
  }

  /**
   * Calculate confidence for an alternative action.
   */
  private calculateAlternativeConfidence(
    context: AgentContext, 
    action: string
  ): number {
    let confidence = 0.3; // Base lower confidence for alternatives

    // Adjust based on context
    if (action === "HUMAN_REVIEW" && context.confidence < 0.5) {
      confidence = 0.8;
    } else if (action === "CLUSTER_ANALYZE" && context.pendingGoals.some(g => g.type === "CLUSTER_FACES")) {
      confidence = 0.7;
    } else if (action === "EXPLAIN_MATCH" && context.confidence > 0.6) {
      confidence = 0.6;
    }

    return confidence;
  }

  /**
   * Generate explanation for a specific decision.
   */
  explainDecision(decision: {
    action: string;
    parameters: Record<string, unknown>;
    result: unknown;
    confidence: number;
  }): string {
    const parts: string[] = [];

    // What was decided
    parts.push(`Action: ${decision.action}`);

    // Why this action
    parts.push(`Chosen because: ${this.getActionReason(decision.action)}`);

    // Result summary
    if (typeof decision.result === "object" && decision.result !== null) {
      const result = decision.result as Record<string, unknown>;
      if ("recognized" in result) {
        parts.push(`Recognition result: ${result.recognized ? "Match found" : "No match"}`);
      }
      if ("confidence" in result) {
        parts.push(`Confidence: ${((result.confidence as number) * 100).toFixed(1)}%`);
      }
    }

    // Next steps recommendation
    if (decision.confidence < 0.5) {
      parts.push("Recommendation: Consider human review for low-confidence decisions.");
    } else if (decision.confidence >= 0.8) {
      parts.push("Recommendation: Decision can be automated with high confidence.");
    }

    return parts.join(". ");
  }

  /**
   * Get reason for action selection.
   */
  private getActionReason(action: string): string {
    const reasons: Record<string, string> = {
      "RECOGNITION_DETECT": "Face detection is always the first step for image-based goals",
      "RECOGNITION_IDENTIFY": "Standard identification flow after face detection",
      "RECOGNITION_VERIFY": "Verification requires comparing two faces",
      "CLUSTER_ANALYZE": "Clustering helps when multiple similar faces exist",
      "EXPLAIN_MATCH": "Explanation provides transparency into the decision",
      "HUMAN_REVIEW": "Low confidence requires human intervention",
      "ENROLL_PERSON": "New person enrollment after verification",
      "DETECT_SPOOF": "Spoof detection for security-critical applications"
    };
    return reasons[action] || "No specific reason available";
  }

  /**
   * Generate audit trail for a decision.
   */
  generateAuditTrail(context: AgentContext): {
    timestamp: Date;
    goal: string;
    actions: Array<{ action: string; result: string; duration: number }>;
    evidence: Evidence[];
    finalConfidence: number;
    decision: string;
  } {
    return {
      timestamp: new Date(),
      goal: context.goal.type,
      actions: context.completedActions.map(a => ({
        action: a.actionId,
        result: a.success ? "success" : "failure",
        duration: a.executionTimeMs
      })),
      evidence: context.evidence,
      finalConfidence: this.calculateConfidence(context),
      decision: context.currentActions[0]?.type || "UNKNOWN"
    };
  }
}

// Singleton instance
export const explainabilityEngine = new ExplainabilityEngine();
