/**
 * FaceVision — Behavior Tree Engine
 * 
 * Implements a Behavior Tree for decision making in the agent.
 * Replaces complex if/else chains with a maintainable tree structure.
 * 
 * Node Types:
 * - SELECTOR: Returns success if any child succeeds (OR logic)
 * - SEQUENCE: Returns success if all children succeed (AND logic)
 * - PARALLEL: Executes all children concurrently
 * - CONDITION: Evaluates a condition, returns success/failure
 * - ACTION: Executes an action
 * - DECORATOR: Modifies child behavior (inverter, repeater, etc.)
 */

import { logger } from "../../logger.js";
import type { 
  BehaviorNode, 
  BehaviorNodeType, 
  BehaviorStatus,
  AgentContext,
  Goal,
  GoalType
} from "../types.js";

/**
 * Behavior Tree for biometric intelligence agent.
 */
export class BehaviorTree {
  private root: BehaviorNode;
  private nodeCounter = 0;

  constructor() {
    this.root = this.buildTree();
  }

  /**
   * Build the default behavior tree for goal-driven execution.
   */
  private buildTree(): BehaviorNode {
    return {
      id: "root",
      type: "SELECTOR",
      name: "Goal Execution Root",
      children: [
        // Critical path: High confidence identification
        this.buildCriticalPath(),
        
        // Normal path: Standard recognition flow
        this.buildNormalPath(),
        
        // Analysis path: Explanation and forensics
        this.buildAnalysisPath(),
        
        // Recovery path: When primary fails
        this.buildRecoveryPath()
      ]
    };
  }

  /**
   * Build critical path for high-priority goals.
   */
  private buildCriticalPath(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Critical Path",
      children: [
        {
          id: this.newNodeId(),
          type: "CONDITION",
          name: "Is Critical Priority",
          condition: (ctx: AgentContext) => ctx.goal.priority === "CRITICAL"
        },
        {
          id: this.newNodeId(),
          type: "SELECTOR",
          name: "Critical Actions",
          children: [
            this.createActionNode("DETECT_SPOOF", "Spoof Detection"),
            this.createActionNode("VERIFY_PERSON", "Verify Person")
          ]
        }
      ]
    };
  }

  /**
   * Build normal execution path.
   */
  private buildNormalPath(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Normal Path",
      children: [
        {
          id: this.newNodeId(),
          type: "CONDITION",
          name: "Is Normal Priority",
          condition: (ctx: AgentContext) => 
            ctx.goal.priority === "NORMAL" || ctx.goal.priority === "HIGH"
        },
        this.buildGoalRouting()
      ]
    };
  }

  /**
   * Build goal-based routing logic.
   */
  private buildGoalRouting(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SELECTOR",
      name: "Goal Router",
      children: [
        // Identification path
        {
          id: this.newNodeId(),
          type: "SEQUENCE",
          name: "Identification Path",
          children: [
            {
              id: this.newNodeId(),
              type: "CONDITION",
              name: "Is Identify Goal",
              condition: (ctx: AgentContext) => ctx.goal.type === "IDENTIFY_PERSON"
            },
            this.createActionNode("RECOGNITION_DETECT", "Detect Faces"),
            this.createActionNode("RECOGNITION_IDENTIFY", "Identify Person"),
            this.createConditionNode(
              "Low Confidence Check",
              (ctx: AgentContext) => ctx.confidence < 0.7,
              [this.createActionNode("CLUSTER_ANALYZE", "Cluster Analysis")]
            )
          ]
        },
        
        // Verification path
        {
          id: this.newNodeId(),
          type: "SEQUENCE",
          name: "Verification Path",
          children: [
            {
              id: this.newNodeId(),
              type: "CONDITION",
              name: "Is Verify Goal",
              condition: (ctx: AgentContext) => ctx.goal.type === "VERIFY_PERSON"
            },
            this.createActionNode("RECOGNITION_VERIFY", "Verify Person")
          ]
        },
        
        // Knowledge search path
        {
          id: this.newNodeId(),
          type: "SEQUENCE",
          name: "Knowledge Search Path",
          children: [
            {
              id: this.newNodeId(),
              type: "CONDITION",
              name: "Is Knowledge Goal",
              condition: (ctx: AgentContext) => ctx.goal.type === "SEARCH_KNOWLEDGE"
            },
            this.createActionNode("KNOWLEDGE_SEARCH", "Search Knowledge")
          ]
        },
        
        // Enrollment path
        {
          id: this.newNodeId(),
          type: "SEQUENCE",
          name: "Enrollment Path",
          children: [
            {
              id: this.newNodeId(),
              type: "CONDITION",
              name: "Is Enroll Goal",
              condition: (ctx: AgentContext) => ctx.goal.type === "ENROLL_NEW_PERSON"
            },
            this.createActionNode("ENROLL_PERSON", "Enroll New Person")
          ]
        }
      ]
    };
  }

  /**
   * Build analysis path (explanation, forensics).
   */
  private buildAnalysisPath(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Analysis Path",
      children: [
        {
          id: this.newNodeId(),
          type: "CONDITION",
          name: "Is Analysis Goal",
          condition: (ctx: AgentContext) => 
            ctx.goal.type === "EXPLAIN_MATCH" || 
            ctx.goal.type === "ANALYZE_FORENSIC"
        },
        {
          id: this.newNodeId(),
          type: "SELECTOR",
          name: "Analysis Actions",
          children: [
            {
              id: this.newNodeId(),
              type: "SEQUENCE",
              name: "Explain Match",
              children: [
                this.createActionNode("EXPLAIN_MATCH", "Explain Match"),
                this.createActionNode("GENERATE_HEATMAP", "Generate Heatmap")
              ]
            },
            this.createActionNode("ANALYZE_FORENSIC", "Forensic Analysis")
          ]
        }
      ]
    };
  }

  /**
   * Build recovery path when primary fails.
   */
  private buildRecoveryPath(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Recovery Path",
      children: [
        {
          id: this.newNodeId(),
          type: "CONDITION",
          name: "Primary Failed",
          condition: (ctx: AgentContext) => ctx.completedActions.length > 0 &&
            !ctx.completedActions[ctx.completedActions.length - 1].success
        },
        {
          id: this.newNodeId(),
          type: "SELECTOR",
          name: "Recovery Actions",
          children: [
            this.createActionNode("HUMAN_REVIEW", "Request Human Review"),
            this.createActionNode("CALIBRATE_THRESHOLD", "Calibrate System")
          ]
        }
      ]
    };
  }

  /**
   * Create an action node.
   */
  private createActionNode(actionType: string, name: string): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "ACTION",
      name,
      action: async (ctx: AgentContext) => {
        logger.info({ actionType, goal: ctx.goal.type }, `Executing action: ${name}`);
        // Action execution is handled by the executor
        return "SUCCESS";
      }
    };
  }

  /**
   * Create a condition node.
   */
  private createConditionNode(
    name: string, 
    condition: (ctx: AgentContext) => boolean,
    trueChild?: BehaviorNode[]
  ): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "CONDITION",
      name,
      condition,
      children: trueChild
    };
  }

  /**
   * Generate unique node ID.
   */
  private newNodeId(): string {
    return `node_${++this.nodeCounter}`;
  }

  /**
   * Execute the behavior tree with given context.
   */
  async execute(context: AgentContext): Promise<{
    status: BehaviorStatus;
    executedActions: string[];
    remainingTree: BehaviorNode;
  }> {
    logger.debug({ goalId: context.goal.id }, "Starting behavior tree execution");
    
    const executedActions: string[] = [];
    
    try {
      const status = await this.executeNode(this.root, context, executedActions);
      
      return {
        status,
        executedActions,
        remainingTree: this.root
      };
    } catch (error) {
      logger.error({ error }, "Behavior tree execution failed");
      return {
        status: "FAILURE",
        executedActions,
        remainingTree: this.root
      };
    }
  }

  /**
   * Execute a single node.
   */
  private async executeNode(
    node: BehaviorNode, 
    context: AgentContext,
    executedActions: string[]
  ): Promise<BehaviorStatus> {
    switch (node.type) {
      case "SELECTOR":
        return this.executeSelector(node, context, executedActions);
      case "SEQUENCE":
        return this.executeSequence(node, context, executedActions);
      case "PARALLEL":
        return this.executeParallel(node, context, executedActions);
      case "CONDITION":
        return this.executeCondition(node, context, executedActions);
      case "ACTION":
        return this.executeAction(node, context, executedActions);
      default:
        return "FAILURE";
    }
  }

  /**
   * Execute SELECTOR node (OR logic - succeed on first child success).
   */
  private async executeSelector(
    node: BehaviorNode, 
    context: AgentContext,
    executedActions: string[]
  ): Promise<BehaviorStatus> {
    if (!node.children || node.children.length === 0) {
      return "FAILURE";
    }

    for (const child of node.children) {
      const status = await this.executeNode(child, context, executedActions);
      if (status === "SUCCESS") {
        return "SUCCESS";
      }
    }

    return "FAILURE";
  }

  /**
   * Execute SEQUENCE node (AND logic - succeed only if all children succeed).
   */
  private async executeSequence(
    node: BehaviorNode, 
    context: AgentContext,
    executedActions: string[]
  ): Promise<BehaviorStatus> {
    if (!node.children || node.children.length === 0) {
      return "SUCCESS";
    }

    for (const child of node.children) {
      const status = await this.executeNode(child, context, executedActions);
      if (status === "FAILURE") {
        return "FAILURE";
      }
    }

    return "SUCCESS";
  }

  /**
   * Execute PARALLEL node (execute all children concurrently).
   */
  private async executeParallel(
    node: BehaviorNode, 
    context: AgentContext,
    executedActions: string[]
  ): Promise<BehaviorStatus> {
    if (!node.children || node.children.length === 0) {
      return "SUCCESS";
    }

    const results = await Promise.all(
      node.children.map(child => this.executeNode(child, context, executedActions))
    );

    // Success if at least half succeed
    const successCount = results.filter(r => r === "SUCCESS").length;
    return successCount >= Math.ceil(node.children.length / 2) ? "SUCCESS" : "FAILURE";
  }

  /**
   * Execute CONDITION node.
   */
  private async executeCondition(
    node: BehaviorNode, 
    context: AgentContext,
    executedActions: string[]
  ): Promise<BehaviorStatus> {
    if (!node.condition) {
      return "FAILURE";
    }

    const result = node.condition(context);
    
    if (result && node.children && node.children.length > 0) {
      // If condition is true, execute children
      return this.executeNode({
        ...node,
        type: "SEQUENCE",
        children: node.children
      }, context, executedActions);
    }

    return result ? "SUCCESS" : "FAILURE";
  }

  /**
   * Execute ACTION node.
   */
  private async executeAction(
    node: BehaviorNode, 
    context: AgentContext,
    executedActions: string[]
  ): Promise<BehaviorStatus> {
    if (!node.action) {
      return "FAILURE";
    }

    executedActions.push(node.name);
    
    try {
      const status = await node.action(context);
      return status;
    } catch (error) {
      logger.error({ nodeName: node.name, error }, "Action execution failed");
      return "FAILURE";
    }
  }

  /**
   * Get the root node (for inspection).
   */
  getRoot(): BehaviorNode {
    return this.root;
  }

  /**
   * Build a custom tree for a specific goal type.
   */
  buildCustomTree(goalType: GoalType): BehaviorNode {
    const trees: Record<GoalType, () => BehaviorNode> = {
      "IDENTIFY_PERSON": () => this.buildIdentificationTree(),
      "VERIFY_PERSON": () => this.buildVerificationTree(),
      "EXPLAIN_MATCH": () => this.buildExplainTree(),
      "CLUSTER_FACES": () => this.buildClusterTree(),
      "ENROLL_NEW_PERSON": () => this.buildEnrollTree(),
      "DETECT_SPOOF": () => this.buildSpoofTree(),
      "CALIBRATE_SYSTEM": () => this.buildCalibrationTree(),
      "ANALYZE_FORENSIC": () => this.buildForensicTree(),
      "SEARCH_KNOWLEDGE": () => this.buildKnowledgeTree()
    };

    const builder = trees[goalType];
    return builder ? builder() : this.buildTree();
  }

  // Specialized tree builders
  private buildIdentificationTree(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Identification Tree",
      children: [
        this.createActionNode("RECOGNITION_DETECT", "Detect Faces"),
        this.createActionNode("RECOGNITION_IDENTIFY", "Identify Person")
      ]
    };
  }

  private buildVerificationTree(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Verification Tree",
      children: [
        this.createActionNode("RECOGNITION_DETECT", "Detect Face A"),
        this.createActionNode("RECOGNITION_DETECT", "Detect Face B"),
        this.createActionNode("RECOGNITION_VERIFY", "Verify Match")
      ]
    };
  }

  private buildExplainTree(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Explanation Tree",
      children: [
        this.createActionNode("EXPLAIN_MATCH", "Explain Match"),
        this.createActionNode("GENERATE_HEATMAP", "Generate Heatmap")
      ]
    };
  }

  private buildClusterTree(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Cluster Tree",
      children: [
        this.createActionNode("RECOGNITION_DETECT", "Detect All Faces"),
        this.createActionNode("CLUSTER_ANALYZE", "Cluster Analysis")
      ]
    };
  }

  private buildEnrollTree(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Enroll Tree",
      children: [
        this.createActionNode("RECOGNITION_DETECT", "Detect Face"),
        this.createActionNode("VALIDATE_RESULT", "Validate Quality"),
        this.createActionNode("DATABASE_INSERT", "Store Person")
      ]
    };
  }

  private buildSpoofTree(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Spoof Detection Tree",
      children: [
        this.createActionNode("RECOGNITION_DETECT", "Detect Face"),
        this.createActionNode("DETECT_SPOOF", "Analyze Liveness")
      ]
    };
  }

  private buildCalibrationTree(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Calibration Tree",
      children: [
        this.createActionNode("CALIBRATE_THRESHOLD", "Calculate Optimal Threshold"),
        this.createActionNode("VALIDATE_RESULT", "Validate Calibration")
      ]
    };
  }

  private buildForensicTree(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Forensic Tree",
      children: [
        this.createActionNode("RECOGNITION_DETECT", "Detect Face"),
        this.createActionNode("IDENTIFY_PERSON", "Identify"),
        this.createActionNode("EXPLAIN_MATCH", "Explain"),
        this.createActionNode("SEARCH_KNOWLEDGE", "Search Related")
      ]
    };
  }

  private buildKnowledgeTree(): BehaviorNode {
    return {
      id: this.newNodeId(),
      type: "SEQUENCE",
      name: "Knowledge Search Tree",
      children: [
        this.createActionNode("KNOWLEDGE_SEARCH", "Search Knowledge Base"),
        this.createConditionNode(
          "Low Results",
          (ctx: AgentContext) => ctx.pendingGoals.length === 0,
          [this.createActionNode("SEARCH_KNOWLEDGE", "Expand Search")]
        )
      ]
    };
  }
}

// Singleton instance
export const behaviorTree = new BehaviorTree();
