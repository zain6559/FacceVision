/**
 * FaceVision — Agent System Core
 * 
 * Goal-driven biometric intelligence agent with:
 * - Goal Engine: Analyzes requests and creates structured goals
 * - Memory System: Working, Session, Recognition, Knowledge, Long-term
 * - Behavior Tree: Decision-making without if/else chains
 * - Policy Engine: Rule-based decision policies
 * - Planner: Separates thinking from execution
 * - Learning Pipeline: Continuous improvement from feedback
 * - Explainability: Integrated into every decision
 */

// Core types
export * from "./types.js";

// Goal Engine
export { GoalEngine, goalEngine } from "./goals/index.js";

// Memory System
export { MemoryManager, memoryManager } from "./memory/index.js";

// Behavior Tree
export { BehaviorTree, behaviorTree } from "./behavior/index.js";

// Policy Engine
export { PolicyEngine, policyEngine } from "./policy/index.js";

// Planner
export { Planner, planner } from "./planner/index.js";

// Learning Pipeline
export { LearningPipeline, learningPipeline } from "./learning/index.js";

// Explainability
export { ExplainabilityEngine, explainabilityEngine } from "./explainability/index.js";
export type { ExplainableDecision } from "./explainability/index.js";

// Runtime
export { BiometricAgent, createAgent } from "./runtime/index.js";
export type { AgentConfig } from "./runtime/index.js";
