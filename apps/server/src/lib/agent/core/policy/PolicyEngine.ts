/**
 * FaceVision — Policy Engine
 * 
 * Manages decision policies for the agent.
 * Policies define HOW the agent should respond to different situations.
 */

import { logger } from "../../logger.js";
import type { 
  Policy, 
  PolicyCondition, 
  AgentContext,
  ActionType,
  Goal
} from "../types.js";

/**
 * Policy Engine - Evaluates and applies policies to context.
 * 
 * Example policies:
 * - Low Confidence → Search more, request human review
 * - Multiple Matches → Cluster analysis
 * - No Match → Suggest enrollment
 * - High Priority → Skip non-essential steps
 */
export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private policyCounter = 0;

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default policies for biometric intelligence.
   */
  private initializeDefaultPolicies(): void {
    // Policy 1: Low Confidence - Request Additional Verification
    this.addPolicy({
      name: "Low Confidence Verification",
      description: "When confidence is below threshold, request additional verification",
      conditions: [
        { field: "confidence", operator: "LT", value: 0.6 }
      ],
      actions: ["SEARCH_KNOWLEDGE", "CLUSTER_ANALYZE"],
      priority: 10
    });

    // Policy 2: Very Low Confidence - Human Review
    this.addPolicy({
      name: "Very Low Confidence - Human Review",
      description: "When confidence is critically low, request human review",
      conditions: [
        { field: "confidence", operator: "LT", value: 0.3 }
      ],
      actions: ["HUMAN_REVIEW"],
      priority: 20
    });

    // Policy 3: Multiple High-Confidence Matches
    this.addPolicy({
      name: "Multiple Matches - Cluster",
      description: "When multiple candidates have similar confidence, perform clustering",
      conditions: [
        { field: "pendingGoals", operator: "CONTAINS", value: "CLUSTER_FACES" }
      ],
      actions: ["CLUSTER_ANALYZE"],
      priority: 5
    });

    // Policy 4: New Person - Auto-Enroll Option
    this.addPolicy({
      name: "No Match - Suggest Enrollment",
      description: "When no match found, suggest enrollment of new person",
      conditions: [
        { field: "recognized", operator: "EQ", value: false }
      ],
      actions: ["ENROLL_NEW_PERSON"],
      priority: 8
    });

    // Policy 5: Spoof Detection Required
    this.addPolicy({
      name: "Spoof Detection for High Security",
      description: "Always check for spoofing in high-security contexts",
      conditions: [
        { field: "context.securityLevel", operator: "EQ", value: "HIGH" }
      ],
      actions: ["DETECT_SPOOF"],
      priority: 15
    });

    // Policy 6: Explanation Required
    this.addPolicy({
      name: "Generate Explanation",
      description: "Generate explanation for any match",
      conditions: [
        { field: "context.requireExplanation", operator: "EQ", value: true }
      ],
      actions: ["EXPLAIN_MATCH", "GENERATE_HEATMAP"],
      priority: 3
    });

    // Policy 7: Critical Priority - Skip Non-Essential
    this.addPolicy({
      name: "Critical Priority Fast Path",
      description: "For critical tasks, skip non-essential validation",
      conditions: [
        { field: "goal.priority", operator: "EQ", value: "CRITICAL" }
      ],
      actions: ["RECOGNITION_DETECT", "RECOGNITION_IDENTIFY"],
      priority: 25
    });

    // Policy 8: Forensic Analysis
    this.addPolicy({
      name: "Forensic Analysis Mode",
      description: "When forensic analysis is requested, perform comprehensive analysis",
      conditions: [
        { field: "goal.type", operator: "EQ", value: "ANALYZE_FORENSIC" }
      ],
      actions: ["EXPLAIN_MATCH", "GENERATE_HEATMAP", "SEARCH_KNOWLEDGE"],
      priority: 12
    });
  }

  /**
   * Add a new policy.
   */
  addPolicy(policy: Omit<Policy, "id">): Policy {
    const id = `policy_${++this.policyCounter}`;
    const fullPolicy: Policy = { ...policy, id };
    this.policies.set(id, fullPolicy);
    logger.info({ policyId: id, name: policy.name }, "Policy added");
    return fullPolicy;
  }

  /**
   * Remove a policy.
   */
  removePolicy(policyId: string): boolean {
    const deleted = this.policies.delete(policyId);
    if (deleted) {
      logger.info({ policyId }, "Policy removed");
    }
    return deleted;
  }

  /**
   * Evaluate all applicable policies for a context.
   */
  evaluatePolicies(context: AgentContext): {
    applicablePolicies: Policy[];
    recommendedActions: ActionType[];
  } {
    const applicablePolicies: Policy[] = [];
    const recommendedActions = new Set<ActionType>();

    for (const policy of this.policies.values()) {
      if (this.evaluateConditions(policy.conditions, context)) {
        applicablePolicies.push(policy);
        for (const action of policy.actions) {
          recommendedActions.add(action);
        }
      }
    }

    // Sort by priority (higher priority first)
    applicablePolicies.sort((a, b) => b.priority - a.priority);

    return {
      applicablePolicies,
      recommendedActions: Array.from(recommendedActions)
    };
  }

  /**
   * Evaluate policy conditions against context.
   */
  private evaluateConditions(conditions: PolicyCondition[], context: AgentContext): boolean {
    return conditions.every(condition => this.evaluateCondition(condition, context));
  }

  /**
   * Evaluate a single condition.
   */
  private evaluateCondition(condition: PolicyCondition, context: AgentContext): boolean {
    const value = this.getNestedValue(context, condition.field);
    
    if (value === undefined) {
      return false;
    }

    switch (condition.operator) {
      case "EQ":
        return value === condition.value;
      case "NEQ":
        return value !== condition.value;
      case "GT":
        return typeof value === "number" && value > (condition.value as number);
      case "LT":
        return typeof value === "number" && value < (condition.value as number);
      case "GTE":
        return typeof value === "number" && value >= (condition.value as number);
      case "LTE":
        return typeof value === "number" && value <= (condition.value as number);
      case "IN":
        return Array.isArray(condition.value) && condition.value.includes(value);
      case "NOT_IN":
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case "CONTAINS":
        return typeof value === "string" && value.includes(condition.value as string);
      default:
        return false;
    }
  }

  /**
   * Get nested value from object using dot notation.
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Get policy by ID.
   */
  getPolicy(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all policies.
   */
  getAllPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Update a policy.
   */
  updatePolicy(policyId: string, updates: Partial<Policy>): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }
    
    const updated = { ...policy, ...updates, id: policyId };
    this.policies.set(policyId, updated);
    logger.info({ policyId }, "Policy updated");
    return true;
  }

  /**
   * Get policies applicable to a specific goal type.
   */
  getPoliciesForGoal(goalType: string): Policy[] {
    return Array.from(this.policies.values())
      .filter(policy => 
        policy.conditions.some(c => 
          c.field === "goal.type" && c.value === goalType
        )
      )
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Clear all policies and reinitialize defaults.
   */
  resetToDefaults(): void {
    this.policies.clear();
    this.initializeDefaultPolicies();
    logger.info("Policies reset to defaults");
  }

  /**
   * Export policies for persistence.
   */
  exportPolicies(): Policy[] {
    return this.getAllPolicies();
  }

  /**
   * Import policies from persistence.
   */
  importPolicies(policies: Policy[]): void {
    this.policies.clear();
    for (const policy of policies) {
      this.policies.set(policy.id, policy);
    }
    logger.info({ count: policies.length }, "Policies imported");
  }
}

// Singleton instance
export const policyEngine = new PolicyEngine();
