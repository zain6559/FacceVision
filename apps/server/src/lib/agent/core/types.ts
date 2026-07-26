/**
 * FaceVision — Agent System Core Types
 * 
 * Foundation types for the goal-driven biometric intelligence agent.
 * Defines the core interfaces and data structures used throughout the agent system.
 */

// ─── Goal Types ────────────────────────────────────────────────────────────────

export type GoalType = 
  | "IDENTIFY_PERSON"
  | "VERIFY_PERSON"
  | "SEARCH_KNOWLEDGE"
  | "CLUSTER_FACES"
  | "ENROLL_NEW_PERSON"
  | "EXPLAIN_MATCH"
  | "ANALYZE_FORENSIC"
  | "DETECT_SPOOF"
  | "CALIBRATE_SYSTEM";

export type GoalPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export interface Goal {
  id: string;
  type: GoalType;
  priority: GoalPriority;
  description: string;
  context: Record<string, unknown>;
  createdAt: Date;
  status: GoalStatus;
  result?: unknown;
  error?: string;
}

export type GoalStatus = 
  | "PENDING"
  | "ANALYZING"
  | "PLANNING"
  | "EXECUTING"
  | "VALIDATING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

// ─── Action Types ─────────────────────────────────────────────────────────────

export type ActionType = 
  | "RECOGNITION_DETECT"
  | "RECOGNITION_IDENTIFY"
  | "RECOGNITION_VERIFY"
  | "KNOWLEDGE_SEARCH"
  | "KNOWLEDGE_INSERT"
  | "DATABASE_QUERY"
  | "DATABASE_INSERT"
  | "DATABASE_UPDATE"
  | "CLUSTER_ANALYZE"
  | "CALIBRATE_THRESHOLD"
  | "EXPLAIN_MATCH"
  | "GENERATE_HEATMAP"
  | "ENROLL_PERSON"
  | "VALIDATE_RESULT"
  | "HUMAN_REVIEW";

export interface Action {
  id: string;
  type: ActionType;
  parameters: Record<string, unknown>;
  dependsOn: string[];
  estimatedDurationMs: number;
  confidence: number;
}

export interface ActionResult {
  actionId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
  confidence: number;
}

// ─── Policy Types ─────────────────────────────────────────────────────────────

export interface Policy {
  id: string;
  name: string;
  description: string;
  conditions: PolicyCondition[];
  actions: ActionType[];
  priority: number;
}

export interface PolicyCondition {
  field: string;
  operator: "EQ" | "NEQ" | "GT" | "LT" | "GTE" | "LTE" | "IN" | "NOT_IN" | "CONTAINS";
  value: unknown;
}

// ─── Behavior Tree Types ───────────────────────────────────────────────────────

export type BehaviorNodeType = 
  | "SELECTOR"
  | "SEQUENCE"
  | "PARALLEL"
  | "CONDITION"
  | "ACTION"
  | "DECORATOR";

export type BehaviorStatus = "SUCCESS" | "FAILURE" | "RUNNING";

export interface BehaviorNode {
  id: string;
  type: BehaviorNodeType;
  name: string;
  children?: BehaviorNode[];
  condition?: (context: AgentContext) => boolean;
  action?: (context: AgentContext) => Promise<BehaviorStatus>;
  decorator?: (child: BehaviorNode) => BehaviorNode;
}

// ─── Memory Types ─────────────────────────────────────────────────────────────

export type MemoryType = "WORKING" | "SESSION" | "RECOGNITION" | "KNOWLEDGE" | "LONG_TERM";

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  key: string;
  value: unknown;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  importance: number; // 0-1
  ttlMs?: number;
}

export interface RecognitionMemory {
  subjectId: string;
  embeddings: number[][];
  lastRecognition: Date;
  recognitionCount: number;
  confidenceHistory: number[];
  locations: string[];
}

export interface SessionMemory {
  sessionId: string;
  goals: Goal[];
  actions: Action[];
  results: ActionResult[];
  context: Record<string, unknown>;
  startedAt: Date;
}

// ─── Context Types ────────────────────────────────────────────────────────────

export interface AgentContext {
  goal: Goal;
  workingMemory: Map<string, MemoryEntry>;
  sessionMemory: SessionMemory;
  recognitionMemory: Map<string, RecognitionMemory>;
  knowledgeMemory: Map<string, unknown>;
  longTermMemory: Map<string, MemoryEntry>;
  
  // State
  currentActions: Action[];
  completedActions: ActionResult[];
  pendingGoals: Goal[];
  
  // Confidence & Evidence
  confidence: number;
  evidence: Evidence[];
  explanations: string[];
  
  // Providers (injected)
  providers: AgentProviders;
}

export interface Evidence {
  type: string;
  data: unknown;
  weight: number;
  source: string;
  timestamp: Date;
}

// ─── Provider Interfaces ──────────────────────────────────────────────────────

export interface RecognitionProvider {
  detect(imageBase64: string): Promise<{ faces: DetectedFace[] }>;
  identify(imageBase64: string, threshold?: number): Promise<IdentificationResult>;
  verify(imageA: string, imageB: string): Promise<VerificationResult>;
}

export interface KnowledgeProvider {
  search(query: string): Promise<KnowledgeResult[]>;
  insert(fact: KnowledgeFact): Promise<void>;
  query(pattern: string): Promise<KnowledgeResult[]>;
}

export interface StorageProvider {
  query<T>(table: string, filters: Record<string, unknown>): Promise<T[]>;
  insert<T>(table: string, data: T): Promise<T>;
  update<T>(table: string, id: string, data: Partial<T>): Promise<T>;
  delete(table: string, id: string): Promise<void>;
}

export interface IntelligenceProvider {
  explain(queryEmbedding: number[], targetEmbedding: number[]): Promise<ExplainabilityReport>;
  cluster(embeddings: number[][], eps?: number): Promise<ClusterResult>;
  calibrate(targetFAR?: number): Promise<CalibrationResult>;
  detectSpoof(imageBase64: string): Promise<SpoofDetectionResult>;
}

export interface AgentProviders {
  recognition: RecognitionProvider;
  knowledge: KnowledgeProvider;
  storage: StorageProvider;
  intelligence: IntelligenceProvider;
}

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface DetectedFace {
  box: number[];
  score: number;
  landmarks?: number[][];
  age?: number;
  gender?: string;
}

export interface IdentificationResult {
  recognized: boolean;
  subjectId?: string;
  confidence: number;
  candidates: Array<{ subjectId: string; confidence: number }>;
}

export interface VerificationResult {
  isMatch: boolean;
  similarity: number;
  threshold: number;
}

export interface KnowledgeFact {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source: string;
}

export interface KnowledgeResult {
  fact: KnowledgeFact;
  score: number;
}

export interface ExplainabilityReport {
  overallSimilarity: number;
  regions: Array<{ name: string; similarity: number; weight: number }>;
  verdict: string;
  explanation: string;
}

export interface ClusterResult {
  clusters: Array<{ id: string; members: string[] }>;
  noise: string[];
  totalClusters: number;
}

export interface CalibrationResult {
  optimalThreshold: number;
  calculatedEER: number;
  previousThreshold: number;
}

export interface SpoofDetectionResult {
  isSpoof: boolean;
  confidence: number;
  type?: string;
}

// ─── Learning Types ───────────────────────────────────────────────────────────

export type LearningSignal = 
  | "HUMAN_FEEDBACK"
  | "FALSE_POSITIVE"
  | "FALSE_NEGATIVE"
  | "CONFIDENCE_ADJUSTMENT"
  | "THRESHOLD_UPDATE";

export interface LearningExample {
  id: string;
  queryEmbedding: number[];
  expectedOutput: unknown;
  actualOutput: unknown;
  signal: LearningSignal;
  feedback?: string;
  createdAt: Date;
  used: boolean;
}

export interface ModelUpdate {
  id: string;
  type: "THRESHOLD" | "WEIGHT" | "POLICY";
  changes: Record<string, unknown>;
  basedOn: string[]; // LearningExample IDs
  createdAt: Date;
  status: "PENDING" | "APPLIED" | "ROLLED_BACK";
}

// ─── Agent Result ─────────────────────────────────────────────────────────────

export interface AgentResult {
  success: boolean;
  goal: Goal;
  actions: ActionResult[];
  finalConfidence: number;
  explanations: string[];
  evidence: Evidence[];
  learningGenerated: LearningExample[];
  error?: string;
}
