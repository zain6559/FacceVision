/**
 * FaceVision — Biometric Intelligence Agent
 * 
 * Main agent runtime that orchestrates all components:
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    BiometricAgent                               │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │   Request ──► [Goal Engine] ──► [Planner] ──► [Executor]     │
 * │                     │                   │              │         │
 * │                     ▼                   ▼              ▼         │
 * │              [Behavior Tree]     [Action Graph]  [Providers]    │
 * │                     │                   │              │         │
 * │                     ▼                   ▼              ▼         │
 * │              [Policy Engine]    [Validation]   [Providers]      │
 * │                                                                 │
 * │   Memory: Working │ Session │ Recognition │ Knowledge │ Long   │
 * │                                                                 │
 * │   Explainability: Evidence → Confidence → Reasoning → Audit    │
 * │                                                                 │
 * │   Learning: Feedback → Examples → Training → Updates            │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { logger } from "../../logger.js";
import { goalEngine } from "../core/goals/index.js";
import { memoryManager } from "../core/memory/index.js";
import { behaviorTree } from "../core/behavior/index.js";
import { policyEngine } from "../core/policy/index.js";
import { planner } from "../core/planner/index.js";
import { learningPipeline } from "../core/learning/index.js";
import { explainabilityEngine } from "../core/explainability/index.js";
import type {
  Goal,
  GoalPriority,
  Action,
  ActionResult,
  ActionType,
  AgentContext,
  AgentProviders,
  AgentResult,
  Evidence,
  LearningSignal
} from "../core/types.js";

/**
 * Agent configuration.
 */
export interface AgentConfig {
  sessionId: string;
  defaultPriority?: GoalPriority;
  enableLearning?: boolean;
  enableExplainability?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Biometric Intelligence Agent - Main runtime.
 */
export class BiometricAgent {
  private sessionId: string;
  private defaultPriority: GoalPriority;
  private enableLearning: boolean;
  private enableExplainability: boolean;
  private maxRetries: number;
  private timeoutMs: number;
  
  private providers: AgentProviders | null = null;

  constructor(config: AgentConfig) {
    this.sessionId = config.sessionId;
    this.defaultPriority = config.defaultPriority || "NORMAL";
    this.enableLearning = config.enableLearning ?? true;
    this.enableExplainability = config.enableExplainability ?? true;
    this.maxRetries = config.maxRetries || 3;
    this.timeoutMs = config.timeoutMs || 60000;

    logger.info({ 
      sessionId: this.sessionId,
      priority: this.defaultPriority
    }, "BiometricAgent initialized");
  }

  /**
   * Set the providers (recognition, knowledge, storage, intelligence).
   */
  setProviders(providers: AgentProviders): void {
    this.providers = providers;
    logger.info("Agent providers configured");
  }

  /**
   * Execute a request through the agent.
   * 
   * Pipeline:
   * 1. Create Goal from request
   * 2. Plan actions based on goal
   * 3. Execute actions
   * 4. Learn from results
   * 5. Generate explanation
   */
  async execute(request: {
    type?: string;
    imageBase64?: string;
    personId?: string;
    query?: string;
    action?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgentResult> {
    const startTime = Date.now();
    logger.info({ sessionId: this.sessionId, request }, "Agent execution started");

    try {
      // ─── Step 1: Goal Creation ───────────────────────────────────────────────
      const goal = goalEngine.analyzeRequest(request, this.defaultPriority);
      goalEngine.updateGoalStatus(goal, "ANALYZING");
      
      // ─── Step 2: Build Context ────────────────────────────────────────────────
      const context = await this.buildContext(goal);
      
      // ─── Step 3: Policy Evaluation ────────────────────────────────────────────
      const policyResult = policyEngine.evaluatePolicies(context);
      logger.debug({ 
        goalId: goal.id,
        policiesTriggered: policyResult.applicablePolicies.length 
      }, "Policies evaluated");

      // ─── Step 4: Planning ────────────────────────────────────────────────────
      goalEngine.updateGoalStatus(goal, "PLANNING");
      const plan = planner.createPlan(goal, policyResult.recommendedActions, context);
      
      const validation = planner.validatePlan(plan);
      if (!validation.valid) {
        logger.warn({ errors: validation.errors }, "Plan validation warnings");
      }

      // ─── Step 5: Execute ──────────────────────────────────────────────────
      goalEngine.updateGoalStatus(goal, "EXECUTING");
      context.currentActions = plan;
      
      const actionResults = await this.executePlan(plan, context);
      context.completedActions = actionResults;

      // ─── Step 6: Learn ──────────────────────────────────────────────────────
      if (this.enableLearning) {
        await this.learn(goal, actionResults);
      }

      // ─── Step 7: Explain ────────────────────────────────────────────────────
      goalEngine.updateGoalStatus(goal, "VALIDATING");
      const finalConfidence = this.calculateFinalConfidence(actionResults);
      context.confidence = finalConfidence;
      
      const explanations = this.enableExplainability 
        ? [explainabilityEngine.generateDecision(context).reasoning]
        : [];
      
      const evidence = this.gatherEvidence(actionResults);

      // ─── Step 8: Complete ──────────────────────────────────────────────────
      goalEngine.updateGoalStatus(goal, "COMPLETED", actionResults);
      
      const result: AgentResult = {
        success: this.isSuccess(actionResults),
        goal,
        actions: actionResults,
        finalConfidence,
        explanations,
        evidence,
        learningGenerated: []
      };

      logger.info({ 
        goalId: goal.id,
        success: result.success,
        confidence: finalConfidence,
        duration: Date.now() - startTime
      }, "Agent execution completed");

      return result;

    } catch (error) {
      logger.error({ error, sessionId: this.sessionId }, "Agent execution failed");
      
      return {
        success: false,
        goal: { id: "unknown", type: "IDENTIFY_PERSON", priority: "NORMAL", description: "", context: {}, createdAt: new Date(), status: "FAILED" },
        actions: [],
        finalConfidence: 0,
        explanations: [],
        evidence: [],
        learningGenerated: [],
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Build agent context from all memory tiers.
   */
  private async buildContext(goal: Goal): Promise<AgentContext> {
    const baseContext = memoryManager.buildContext(this.sessionId);
    
    return {
      goal,
      workingMemory: baseContext.workingMemory || new Map(),
      sessionMemory: baseContext.sessionMemory || {
        sessionId: this.sessionId,
        goals: [],
        actions: [],
        results: [],
        context: {},
        startedAt: new Date()
      },
      recognitionMemory: baseContext.recognitionMemory || new Map(),
      knowledgeMemory: baseContext.knowledgeMemory || new Map(),
      longTermMemory: baseContext.longTermMemory || new Map(),
      currentActions: [],
      completedActions: [],
      pendingGoals: [],
      confidence: 0,
      evidence: [],
      explanations: [],
      providers: this.providers!
    };
  }

  /**
   * Execute a plan of actions.
   */
  private async executePlan(plan: Action[], context: AgentContext): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of plan) {
      const startTime = Date.now();
      
      try {
        // Check dependencies
        const depsSatisfied = action.dependsOn.every(depId => 
          results.some(r => r.actionId === depId && r.success)
        );

        if (!depsSatisfied) {
          results.push({
            actionId: action.id,
            success: false,
            error: "Dependencies not satisfied",
            executionTimeMs: 0,
            confidence: 0
          });
          continue;
        }

        // Execute the action through the appropriate provider
        const result = await this.executeAction(action, context);
        results.push(result);

      } catch (error) {
        results.push({
          actionId: action.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          executionTimeMs: Date.now() - startTime,
          confidence: 0
        });
      }
    }

    return results;
  }

  /**
   * Execute a single action through the appropriate provider.
   */
  private async executeAction(action: Action, context: AgentContext): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!this.providers) {
      return {
        actionId: action.id,
        success: false,
        error: "Providers not configured",
        executionTimeMs: 0,
        confidence: 0
      };
    }

    try {
      let data: unknown = null;

      // Route action to appropriate provider
      switch (action.type) {
        case "RECOGNITION_DETECT":
        case "RECOGNITION_IDENTIFY":
        case "RECOGNITION_VERIFY":
          // Use recognition provider
          data = await this.executeRecognitionAction(action, context);
          break;
          
        case "KNOWLEDGE_SEARCH":
        case "KNOWLEDGE_INSERT":
          // Use knowledge provider
          data = await this.executeKnowledgeAction(action, context);
          break;
          
        case "DATABASE_QUERY":
        case "DATABASE_INSERT":
        case "DATABASE_UPDATE":
          // Use storage provider
          data = await this.executeStorageAction(action, context);
          break;
          
        case "EXPLAIN_MATCH":
        case "GENERATE_HEATMAP":
        case "CLUSTER_ANALYZE":
        case "CALIBRATE_THRESHOLD":
        case "DETECT_SPOOF":
          // Use intelligence provider
          data = await this.executeIntelligenceAction(action, context);
          break;
          
        default:
          logger.warn({ actionType: action.type }, "Unknown action type");
      }

      return {
        actionId: action.id,
        success: true,
        data,
        executionTimeMs: Date.now() - startTime,
        confidence: action.confidence
      };

    } catch (error) {
      return {
        actionId: action.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTimeMs: Date.now() - startTime,
        confidence: 0
      };
    }
  }

  /**
   * Execute recognition-related action.
   */
  private async executeRecognitionAction(action: Action, context: AgentContext): Promise<unknown> {
    const imageBase64 = context.goal.context?.imageBase64 as string;
    
    switch (action.type) {
      case "RECOGNITION_DETECT":
        return this.providers!.recognition.detect(imageBase64);
        
      case "RECOGNITION_IDENTIFY":
        return this.providers!.recognition.identify(
          imageBase64, 
          context.goal.context?.threshold as number
        );
        
      case "RECOGNITION_VERIFY":
        const imageB = context.goal.context?.imageB as string;
        return this.providers!.recognition.verify(imageBase64, imageB);
        
      default:
        return null;
    }
  }

  /**
   * Execute knowledge-related action.
   */
  private async executeKnowledgeAction(action: Action, context: AgentContext): Promise<unknown> {
    switch (action.type) {
      case "KNOWLEDGE_SEARCH":
        const query = context.goal.context?.query as string;
        return this.providers!.knowledge.search(query || "");
        
      case "KNOWLEDGE_INSERT":
        const fact = context.goal.context?.fact;
        if (fact) {
          await this.providers!.knowledge.insert(fact as any);
        }
        return null;
        
      default:
        return null;
    }
  }

  /**
   * Execute storage-related action.
   */
  private async executeStorageAction(action: Action, context: AgentContext): Promise<unknown> {
    const table = context.goal.context?.table as string;
    const data = context.goal.context?.data;

    switch (action.type) {
      case "DATABASE_QUERY":
        return this.providers!.storage.query(table || "", data || {});
        
      case "DATABASE_INSERT":
        return this.providers!.storage.insert(table || "", data || {});
        
      case "DATABASE_UPDATE":
        const id = context.goal.context?.id as string;
        return this.providers!.storage.update(table || "", id, data || {});
        
      default:
        return null;
    }
  }

  /**
   * Execute intelligence-related action.
   */
  private async executeIntelligenceAction(action: Action, context: AgentContext): Promise<unknown> {
    switch (action.type) {
      case "EXPLAIN_MATCH":
        const queryEmb = context.goal.context?.queryEmbedding as number[];
        const targetEmb = context.goal.context?.targetEmbedding as number[];
        if (queryEmb && targetEmb) {
          return this.providers!.intelligence.explain(queryEmb, targetEmb);
        }
        return null;
        
      case "CLUSTER_ANALYZE":
        const embeddings = context.goal.context?.embeddings as number[][];
        const eps = context.goal.context?.eps as number;
        if (embeddings) {
          return this.providers!.intelligence.cluster(embeddings, eps);
        }
        return null;
        
      case "CALIBRATE_THRESHOLD":
        const targetFAR = context.goal.context?.targetFAR as number;
        return this.providers!.intelligence.calibrate(targetFAR);
        
      case "DETECT_SPOOF":
        const image = context.goal.context?.imageBase64 as string;
        return this.providers!.intelligence.detectSpoof(image);
        
      default:
        return null;
    }
  }

  /**
   * Learn from execution results.
   */
  private async learn(goal: Goal, results: ActionResult[]): Promise<void> {
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    
    if (total === 0) return;

    let signal: LearningSignal = "CONFIDENCE_ADJUSTMENT";
    
    if (successful / total < 0.5) {
      signal = "FALSE_NEGATIVE";
    } else if (successful === total) {
      signal = "THRESHOLD_UPDATE";
    }

    learningPipeline.recordSignal(signal, {
      goal,
      actions: results,
      actualOutput: results
    });
  }

  /**
   * Calculate final confidence from action results.
   */
  private calculateFinalConfidence(results: ActionResult[]): number {
    if (results.length === 0) return 0;

    const successful = results.filter(r => r.success);
    const avgConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / (successful.length || 1);
    
    const successRate = successful.length / results.length;
    
    return avgConfidence * successRate;
  }

  /**
   * Gather evidence from results.
   */
  private gatherEvidence(results: ActionResult[]): Evidence[] {
    return results.map(r => ({
      type: r.success ? "SUCCESSFUL_ACTION" : "FAILED_ACTION",
      data: { actionId: r.actionId, result: r.data },
      weight: r.confidence,
      source: "action_executor",
      timestamp: new Date()
    }));
  }

  /**
   * Determine if execution was successful.
   */
  private isSuccess(results: ActionResult[]): boolean {
    if (results.length === 0) return false;
    
    const successfulRate = results.filter(r => r.success).length / results.length;
    return successfulRate >= 0.5;
  }

  /**
   * Get agent statistics.
   */
  getStats(): {
    memory: Record<string, number>;
    learning: ReturnType<typeof learningPipeline.getStats>;
  } {
    return {
      memory: memoryManager.getStats(),
      learning: learningPipeline.getStats()
    };
  }
}

/**
 * Factory function to create a new agent instance.
 */
export function createAgent(sessionId: string): BiometricAgent {
  return new BiometricAgent({ sessionId });
}
