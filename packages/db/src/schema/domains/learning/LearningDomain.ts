/**
 * FaceVision — Learning Domain Schema
 * 
 * Tracks machine learning experiments, training runs, and model updates.
 */

import { pgTable, text, serial, integer, real, timestamp, jsonb, uuid, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Experiment ────────────────────────────────────────────────────────────────

export const experimentsTable = pgTable("experiments", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Experiment metadata
  name: text("name").notNull(),
  description: text("description"),
  experimentType: text("experiment_type").notNull(), // THRESHOLD_CALIBRATION, MODEL_COMPARISON, PIPELINE_OPTIMIZATION
  
  // Configuration
  config: jsonb("config").$type<{
    baseModel?: string;
    thresholdStrategy?: string;
    qualityWeights?: Record<string, number>;
    rerankWeights?: Record<string, number>;
  }>(),
  
  // Target metrics
  targetMetrics: jsonb("target_metrics").$type<{
    targetFAR?: number;
    targetFRR?: number;
    targetEER?: number;
    targetLatency?: number;
  }>(),
  
  // Results
  results: jsonb("results").$type<{
    optimalThreshold?: number;
    achievedFAR?: number;
    achievedFR?: number;
    achievedEER?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    latencyP50?: number;
    latencyP95?: number;
    latencyP99?: number;
  }>(),
  
  // Status
  status: text("status").notNull().default("PENDING"), // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  
  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  // Data used
  evaluationDatasetSize: integer("evaluation_dataset_size"),
  trainingDatasetSize: integer("training_dataset_size"),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("public"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
}, (table) => ({
  uuidIdx: index("experiments_uuid_idx").on(table.uuid),
  statusIdx: index("experiments_status_idx").on(table.status),
  typeIdx: index("experiments_type_idx").on(table.experimentType),
  tenantIdx: index("experiments_tenant_idx").on(table.tenantId),
}));

export const insertExperimentSchema = createInsertSchema(experimentsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertExperiment = z.infer<typeof insertExperimentSchema>;
export type Experiment = typeof experimentsTable.$inferSelect;

// ─── Training Run ─────────────────────────────────────────────────────────────

export const trainingRunsTable = pgTable("training_runs", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Run metadata
  name: text("name").notNull(),
  description: text("description"),
  runType: text("run_type").notNull(), // THRESHOLD_UPDATE, POLICY_UPDATE, MODEL_FINE_TUNE
  
  // Status
  status: text("status").notNull().default("PENDING"), // PENDING, RUNNING, COMPLETED, FAILED, ROLLED_BACK
  
  // Configuration
  config: jsonb("config").$type<{
    learningRate?: number;
    batchSize?: number;
    epochs?: number;
    thresholdAdjustment?: number;
  }>(),
  
  // Results
  results: jsonb("results").$type<{
    improvement?: number;
    affectedPolicies?: string[];
    affectedThreshold?: number;
  }>(),
  
  // Data
  examplesUsed: integer("examples_used").notNull().default(0),
  feedbackExamples: integer("feedback_examples").notNull().default(0),
  falsePositiveExamples: integer("false_positive_examples").notNull().default(0),
  falseNegativeExamples: integer("false_negative_examples").notNull().default(0),
  
  // Errors
  errorsEncountered: integer("errors_encountered").notNull().default(0),
  errorMessage: text("error_message"),
  
  // Timing
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  
  // Relations
  experimentId: integer("experiment_id").references(() => experimentsTable.id, { onDelete: "set null" }),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("public"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
}, (table) => ({
  uuidIdx: index("training_runs_uuid_idx").on(table.uuid),
  statusIdx: index("training_runs_status_idx").on(table.status),
  typeIdx: index("training_runs_type_idx").on(table.runType),
  tenantIdx: index("training_runs_tenant_idx").on(table.tenantId),
}));

export const insertTrainingRunSchema = createInsertSchema(trainingRunsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertTrainingRun = z.infer<typeof insertTrainingRunSchema>;
export type TrainingRun = typeof trainingRunsTable.$inferSelect;

// ─── Learning Example ─────────────────────────────────────────────────────────

export const learningExamplesTable = pgTable("learning_examples", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // The learning signal type
  signalType: text("signal_type").notNull(), // HUMAN_FEEDBACK, FALSE_POSITIVE, FALSE_NEGATIVE, THRESHOLD_UPDATE, CONFIDENCE_ADJUSTMENT
  
  // Context
  context: jsonb("context").$type<{
    requestId?: number;
    identityId?: number;
    originalConfidence?: number;
    originalDecision?: string;
  }>(),
  
  // Feedback data
  expectedOutput: jsonb("expected_output"),
  actualOutput: jsonb("actual_output"),
  
  // Embedding info (for reference)
  embeddingId: integer("embedding_id"),
  modelVersion: text("model_version"),
  
  // Human feedback
  feedbackSource: text("feedback_source"), // ADMIN, USER, OPERATOR
  feedbackText: text("feedback_text"),
  
  // Usage tracking
  usedInRunId: integer("used_in_run_id").references(() => trainingRunsTable.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at"),
  isUsed: boolean("is_used").notNull().default(false),
  
  // Status
  isValid: boolean("is_valid").notNull().default(true),
  invalidReason: text("invalid_reason"),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("public"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uuidIdx: index("learning_examples_uuid_idx").on(table.uuid),
  signalTypeIdx: index("learning_examples_signal_type_idx").on(table.signalType),
  usedIdx: index("learning_examples_used_idx").on(table.isUsed),
  tenantIdx: index("learning_examples_tenant_idx").on(table.tenantId),
}));

export const insertLearningExampleSchema = createInsertSchema(learningExamplesTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertLearningExample = z.infer<typeof insertLearningExampleSchema>;
export type LearningExample = typeof learningExamplesTable.$inferSelect;

// ─── Model Version ───────────────────────────────────────────────────────────

export const modelVersionsTable = pgTable("model_versions", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Model info
  modelName: text("model_name").notNull(), // arcface, adaface, magface
  version: text("version").notNull(),
  releaseDate: timestamp("release_date"),
  
  // Technical details
  architecture: text("architecture").notNull(),
  inputSize: jsonb("input_size").$type<[number, number]>(),
  embeddingDim: integer("embedding_dim").notNull(),
  trainingDataset: text("training_dataset"),
  trainingDatasetSize: integer("training_dataset_size"),
  
  // Performance metrics
  performanceMetrics: jsonb("performance_metrics").$type<{
    lfwAccuracy?: number;
    cfpAccuracy?: number;
    agedbAccuracy?: number;
    averageLatencyMs?: number;
  }>(),
  
  // Capabilities
  capabilities: jsonb("capabilities").$type<{
    alignmentRequired: boolean;
    supportsPoseEstimation: boolean;
    supportsOcclusionHandling: boolean;
    supportsLiveness: boolean;
  }>(),
  
  // Status
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, DEPRECATED, RETIRED
  
  // Deprecation info
  deprecatedAt: timestamp("deprecated_at"),
  deprecationReason: text("deprecation_reason"),
  replacedByVersionId: integer("replaced_by_version_id"),
  
  // Storage
  modelPath: text("model_path"),
  modelSizeMb: integer("model_size_mb"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uuidIdx: index("model_versions_uuid_idx").on(table.uuid),
  modelNameIdx: index("model_versions_name_idx").on(table.modelName),
  statusIdx: index("model_versions_status_idx").on(table.status),
}));

export const insertModelVersionSchema = createInsertSchema(modelVersionsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertModelVersion = z.infer<typeof insertModelVersionSchema>;
export type ModelVersion = typeof modelVersionsTable.$inferSelect;

// ─── Policy Version ──────────────────────────────────────────────────────────

export const policyVersionsTable = pgTable("policy_versions", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Policy info
  policyType: text("policy_type").notNull(), // RECOGNITION, VERIFICATION, ENROLLMENT, THRESHOLD
  
  // Version
  version: text("version").notNull(),
  changeDescription: text("change_description"),
  
  // Policy data
  policyData: jsonb("policy_data").notNull(), // The actual policy rules/thresholds
  
  // Change tracking
  changeReason: text("change_reason"),
  basedOnExperimentId: integer("based_on_experiment_id").references(() => experimentsTable.id, { onDelete: "set null" }),
  basedOnTrainingRunId: integer("based_on_training_run_id").references(() => trainingRunsTable.id, { onDelete: "set null" }),
  
  // Status
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, SUPERSEDED, ROLLED_BACK
  
  // Supersession
  supersededById: integer("superseded_by_id"),
  supersededAt: timestamp("superseded_at"),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("public"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
}, (table) => ({
  uuidIdx: index("policy_versions_uuid_idx").on(table.uuid),
  policyTypeIdx: index("policy_versions_type_idx").on(table.policyType),
  statusIdx: index("policy_versions_status_idx").on(table.status),
  tenantIdx: index("policy_versions_tenant_idx").on(table.tenantId),
}));

export const insertPolicyVersionSchema = createInsertSchema(policyVersionsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertPolicyVersion = z.infer<typeof insertPolicyVersionSchema>;
export type PolicyVersion = typeof policyVersionsTable.$inferSelect;
