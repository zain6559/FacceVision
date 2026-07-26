/**
 * FaceVision — Planner
 * 
 * Separates THINKING from EXECUTION.
 * 
 * This is the CORE of the goal-driven architecture:
 * 
 * Goal → [Planner] → Action Graph → [Executor] → Results
 *                    ↓
 *              (Just planning,
 *              no execution!)
 */

import { logger } from "../../logger.js";
import type { 
  Goal, 
  Action, 
  ActionType,
  AgentContext,
  AgentProviders
} from "../types.js";

/**
 * Action dependency map - defines which actions must happen before others.
 */
const ACTION_DEPENDENCIES: Partial<Record<ActionType, ActionType[]>> = {
  "RECOGNITION_IDENTIFY": ["RECOGNITION_DETECT"],
  "RECOGNITION_VERIFY": ["RECOGNITION_DETECT"],
  "EXPLAIN_MATCH": ["RECOGNITION_IDENTIFY"],
  "GENERATE_HEATMAP": ["RECOGNITION_IDENTIFY"],
  "CLUSTER_ANALYZE": ["RECOGNITION_DETECT"],
  "VALIDATE_RESULT": ["RECOGNITION_IDENTIFY"],
  "HUMAN_REVIEW": ["VALIDATE_RESULT"],
  "DATABASE_INSERT": ["RECOGNITION_DETECT", "VALIDATE_RESULT"],
  "ENROLL_PERSON": ["DATABASE_INSERT"],
  "ANALYZE_FORENSIC": ["RECOGNITION_IDENTIFY", "EXPLAIN_MATCH"]
};

/**
 * Action metadata for planning.
 */
const ACTION_META: Record<ActionType, { duration: number; confidence: number }> = {
  "RECOGNITION_DETECT": { duration: 100, confidence: 0.95 },
  "RECOGNITION_IDENTIFY": { duration: 150, confidence: 0.90 },
  "RECOGNITION_VERIFY": { duration: 120, confidence: 0.92 },
  "KNOWLEDGE_SEARCH": { duration: 50, confidence: 0.85 },
  "KNOWLEDGE_INSERT": { duration: 30, confidence: 0.95 },
  "DATABASE_QUERY": { duration: 20, confidence: 0.99 },
  "DATABASE_INSERT": { duration: 30, confidence: 0.99 },
  "DATABASE_UPDATE": { duration: 25, confidence: 0.99 },
  "CLUSTER_ANALYZE": { duration: 500, confidence: 0.80 },
  "CALIBRATE_THRESHOLD": { duration: 1000, confidence: 0.85 },
  "EXPLAIN_MATCH": { duration: 80, confidence: 0.88 },
  "GENERATE_HEATMAP": { duration: 100, confidence: 0.85 },
  "ENROLL_PERSON": { duration: 50, confidence: 0.95 },
  "VALIDATE_RESULT": { duration: 30, confidence: 0.90 },
  "HUMAN_REVIEW": { duration: 0, confidence: 0.0 },
  "DETECT_SPOOF": { duration: 80, confidence: 0.87 }
};

/**
 * Planner - Creates action plans from goals.
 * 
 * Key principle: PLANNING ≠ EXECUTION
 * 
 * The planner only creates a plan (sequence of actions).
 * Execution is handled by the Executor.
 */
export class Planner {
  private actionCounter = 0;

  /**
   * Create an action plan for a goal.
   * Returns an ordered list of actions to execute.
   */
  createPlan(
    goal: Goal, 
    recommendedActions: ActionType[],
    context?: Partial<AgentContext>
  ): Action[] {
    logger.info({ 
      goalId: goal.id, 
      goalType: goal.type,
      recommendedActions 
    }, "Creating action plan");

    // Start with goal-specific actions
    const goalActions = this.getActionsForGoal(goal);
    
    // Add recommended actions from policies
    const allActions = [...new Set([...goalActions, ...recommendedActions])];
    
    // Build dependency graph
    const plan = this.buildActionGraph(allActions);
    
    // Optimize the plan
    const optimized = this.optimizePlan(plan);
    
    logger.info({ 
      goalId: goal.id, 
      actionCount: optimized.length,
      actions: optimized.map(a => a.type)
    }, "Action plan created");

    return optimized;
  }

  /**
   * Get default actions for a goal type.
   */
  private getActionsForGoal(goal: Goal): ActionType[] {
    const goalActionMap: Record<string, ActionType[]> = {
      "IDENTIFY_PERSON": ["RECOGNITION_DETECT", "RECOGNITION_IDENTIFY", "VALIDATE_RESULT"],
      "VERIFY_PERSON": ["RECOGNITION_DETECT", "RECOGNITION_VERIFY"],
      "SEARCH_KNOWLEDGE": ["KNOWLEDGE_SEARCH"],
      "CLUSTER_FACES": ["RECOGNITION_DETECT", "CLUSTER_ANALYZE"],
      "ENROLL_NEW_PERSON": ["RECOGNITION_DETECT", "VALIDATE_RESULT", "DATABASE_INSERT", "ENROLL_PERSON"],
      "EXPLAIN_MATCH": ["EXPLAIN_MATCH", "GENERATE_HEATMAP"],
      "ANALYZE_FORENSIC": ["RECOGNITION_DETECT", "RECOGNITION_IDENTIFY", "EXPLAIN_MATCH", "SEARCH_KNOWLEDGE"],
      "DETECT_SPOOF": ["RECOGNITION_DETECT", "DETECT_SPOOF"],
      "CALIBRATE_SYSTEM": ["CALIBRATE_THRESHOLD", "VALIDATE_RESULT"]
    };
    
    return goalActionMap[goal.type] || [];
  }

  /**
   * Build action graph respecting dependencies.
   */
  private buildActionGraph(actions: ActionType[]): Action[] {
    const actionMap = new Map<string, Action>();
    const actionIds = new Map<ActionType, string[]>();
    
    // Create action objects
    for (const actionType of actions) {
      const actionId = `action_${++this.actionCounter}_${Date.now()}`;
      const meta = ACTION_META[actionType] || { duration: 100, confidence: 0.8 };
      
      const action: Action = {
        id: actionId,
        type: actionType,
        parameters: {},
        dependsOn: [],
        estimatedDurationMs: meta.duration,
        confidence: meta.confidence
      };
      
      actionMap.set(actionId, action);
      
      const ids = actionIds.get(actionType) || [];
      ids.push(actionId);
      actionIds.set(actionType, ids);
    }

    // Add dependencies
    for (const [actionId, action] of actionMap) {
      const deps = ACTION_DEPENDENCIES[action.type] || [];
      for (const depType of deps) {
        const depIds = actionIds.get(depType) || [];
        // Only depend on the first instance of each type
        if (depIds.length > 0) {
          action.dependsOn.push(depIds[0]);
        }
      }
    }

    return Array.from(actionMap.values());
  }

  /**
   * Topological sort to get execution order.
   */
  private topologicalSort(actions: Action[]): Action[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    
    // Initialize
    for (const action of actions) {
      inDegree.set(action.id, action.dependsOn.length);
      adjacency.set(action.id, []);
    }
    
    // Build adjacency list (reverse dependencies)
    for (const action of actions) {
      for (const depId of action.dependsOn) {
        const neighbors = adjacency.get(depId) || [];
        neighbors.push(action.id);
        adjacency.set(depId, neighbors);
      }
    }
    
    // Find all nodes with no incoming edges
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }
    
    // Process
    const sorted: Action[] = [];
    const actionMap = new Map(actions.map(a => [a.id, a]));
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const current = actionMap.get(currentId);
      if (current) {
        sorted.push(current);
      }
      
      for (const neighborId of adjacency.get(currentId) || []) {
        const newDegree = (inDegree.get(neighborId) || 1) - 1;
        inDegree.set(neighborId, newDegree);
        if (newDegree === 0) {
          queue.push(neighborId);
        }
      }
    }
    
    // Check for cycles
    if (sorted.length !== actions.length) {
      logger.warn("Circular dependency detected in action graph");
    }
    
    return sorted;
  }

  /**
   * Optimize the plan (remove redundant actions, parallel where possible).
   */
  private optimizePlan(actions: Action[]): Action[] {
    // Topological sort
    let plan = this.topologicalSort(actions);
    
    // Group by parallel potential
    const levels = this.groupByLevel(plan);
    
    // Flatten levels
    plan = levels.flat();
    
    return plan;
  }

  /**
   * Group actions into parallel execution levels.
   */
  private groupByLevel(actions: Action[]): Action[][] {
    const levels: Action[][] = [];
    const completed = new Set<string>();
    
    const remaining = [...actions];
    
    while (remaining.length > 0) {
      const level: Action[] = [];
      
      for (let i = 0; i < remaining.length; i++) {
        const action = remaining[i];
        const depsSatisfied = action.dependsOn.every(dep => completed.has(dep));
        
        if (depsSatisfied) {
          level.push(action);
          remaining.splice(i, 1);
          i--;
        }
      }
      
      if (level.length === 0 && remaining.length > 0) {
        // Shouldn't happen with valid dependencies, but handle gracefully
        logger.warn("Could not resolve dependencies, adding remaining actions");
        levels.push(remaining);
        break;
      }
      
      levels.push(level);
      for (const action of level) {
        completed.add(action.id);
      }
    }
    
    return levels;
  }

  /**
   * Validate a plan (check for cycles, missing dependencies).
   */
  validatePlan(actions: Action[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for duplicate actions
    const seen = new Set<string>();
    for (const action of actions) {
      if (seen.has(action.id)) {
        errors.push(`Duplicate action ID: ${action.id}`);
      }
      seen.add(action.id);
    }
    
    // Check for missing dependencies
    const actionIds = new Set(actions.map(a => a.id));
    for (const action of actions) {
      for (const depId of action.dependsOn) {
        if (!actionIds.has(depId)) {
          errors.push(`Action ${action.id} depends on missing action ${depId}`);
        }
      }
    }
    
    // Check for cycles (simple DFS)
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (actionId: string): boolean => {
      visited.add(actionId);
      recursionStack.add(actionId);
      
      const action = actions.find(a => a.id === actionId);
      if (action) {
        for (const depId of action.dependsOn) {
          if (!visited.has(depId) && hasCycle(depId)) {
            return true;
          }
          if (recursionStack.has(depId)) {
            return true;
          }
        }
      }
      
      recursionStack.delete(actionId);
      return false;
    };
    
    for (const action of actions) {
      if (!visited.has(action.id) && hasCycle(action.id)) {
        errors.push(`Circular dependency detected involving action ${action.id}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Estimate total execution time for a plan.
   */
  estimateDuration(actions: Action[]): number {
    // Find critical path (longest path through dependencies)
    const levels = this.groupByLevel(actions);
    let total = 0;
    
    for (const level of levels) {
      // Actions in same level run in parallel
      const maxDuration = Math.max(...level.map(a => a.estimatedDurationMs));
      total += maxDuration;
    }
    
    return total;
  }

  /**
   * Get action by ID.
   */
  getAction(actions: Action[], actionId: string): Action | undefined {
    return actions.find(a => a.id === actionId);
  }
}

// Singleton instance
export const planner = new Planner();
