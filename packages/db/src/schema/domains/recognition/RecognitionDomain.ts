/**
 * FaceVision — Recognition Domain Schema
 * 
 * Tracks all recognition requests and results separately from identities.
 * This allows scaling recognition logs independently.
 */

import { pgTable, text, serial, integer, real, timestamp, jsonb, uuid, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Recognition Request ────────────────────────────────────────────────────────

export const recognitionRequestsTable = pgTable("recognition_requests", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Request type
  requestType: text("request_type").notNull(), // IDENTIFY, VERIFY, SEARCH, ENROLL
  status: text("status").notNull().default("PENDING"), // PENDING, PROCESSING, COMPLETED, FAILED
  
  // Input
  imageUrl: text("image_url"),
  imageStoragePath: text("image_storage_path"),
  inputHash: text("input_hash"), // SHA256 of input for deduplication
  
  // Quality metrics of input
  qualityScore: real("quality_score"),
  faceCount: integer("face_count").notNull().default(0),
  
  // Processing
  processingTimeMs: integer("processing_time_ms"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  // Model used
  modelName: text("model_name"),
  modelVersion: text("model_version"),
  detectorType: text("detector_type"),
  
  // Threshold used (fixed or adaptive)
  thresholdUsed: real("threshold_used"),
  thresholdType: text("threshold_type").notNull().default("FIXED"), // FIXED, ADAPTIVE, CALIBRATED
  
  // Result summary
  recognizedCount: integer("recognized_count").notNull().default(0),
  hasMatch: boolean("has_match").notNull().default(false),
  
  // Error handling
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  
  // Context
  tenantId: text("tenant_id").notNull().default("public"),
  projectId: integer("project_id"),
  apiKeyId: integer("api_key_id"),
  userId: integer("user_id"),
  
  // Partition key (for date-based partitioning)
  partitionDate: timestamp("partition_date").notNull().defaultNow(),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uuidIdx: index("recognition_requests_uuid_idx").on(table.uuid),
  statusIdx: index("recognition_requests_status_idx").on(table.status),
  partitionDateIdx: index("recognition_requests_partition_date_idx").on(table.partitionDate),
  tenantIdx: index("recognition_requests_tenant_idx").on(table.tenantId),
  projectIdx: index("recognition_requests_project_idx").on(table.projectId),
  hasMatchIdx: index("recognition_requests_has_match_idx").on(table.hasMatch),
  qualityIdx: index("recognition_requests_quality_idx").on(table.qualityScore),
}), {
  partitioning: {
    type: "range",
    columns: ["partition_date"], // Partition by date for efficient pruning
  },
});

export const insertRecognitionRequestSchema = createInsertSchema(recognitionRequestsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertRecognitionRequest = z.infer<typeof insertRecognitionRequestSchema>;
export type RecognitionRequest = typeof recognitionRequestsTable.$inferSelect;

// ─── Recognition Result ────────────────────────────────────────────────────────

export const recognitionResultsTable = pgTable("recognition_results", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  requestId: integer("request_id").notNull().references(() => recognitionRequestsTable.id, { onDelete: "cascade" }),
  
  // Face detected
  faceIndex: integer("face_index").notNull(), // Index of face in the request
  faceBoundingBox: jsonb("face_bounding_box").$type<{ x: number; y: number; width: number; height: number }>(),
  
  // Recognition result
  recognized: boolean("recognized").notNull().default(false),
  identityId: integer("identity_id").references(() => null as any, { onDelete: "set null" }), // Forward reference
  matchConfidence: real("match_confidence"),
  
  // Decision
  decision: text("decision").notNull(), // VERIFIED_MATCH, LIKELY_MATCH, UNLIKELY_MATCH, NO_MATCH, NEEDS_REVIEW
  threshold: real("threshold"),
  
  // Re-ranking info
  rerankScore: real("rerank_score"),
  rerankFactors: jsonb("rerank_factors").$type<Array<{ name: string; score: number }>>(),
  
  // Alternative matches (top 5)
  alternativeMatches: jsonb("alternative_matches").$type<Array<{
    identityId: number;
    confidence: number;
    decision: string;
  }>>(),
  
  // Explanation
  explanation: jsonb("explanation").$type<{
    summary: string;
    factors: Array<{ category: string; name: string; impact: string }>;
  }>(),
  
  // Liveness
  livenessCheck: jsonb("liveness_check").$type<{
    passed: boolean;
    confidence: number;
    type: string;
  }>(),
  
  // Quality
  embeddingQuality: real("embedding_quality"),
  
  // Processing
  detectionTimeMs: integer("detection_time_ms"),
  embeddingTimeMs: integer("embedding_time_ms"),
  searchTimeMs: integer("search_time_ms"),
  rerankTimeMs: integer("rerank_time_ms"),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("public"),
  
  // Partition key
  partitionDate: timestamp("partition_date").notNull().defaultNow(),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  requestIdx: index("recognition_results_request_idx").on(table.requestId),
  identityIdx: index("recognition_results_identity_idx").on(table.identityId),
  recognizedIdx: index("recognition_results_recognized_idx").on(table.recognized),
  decisionIdx: index("recognition_results_decision_idx").on(table.decision),
  partitionDateIdx: index("recognition_results_partition_date_idx").on(table.partitionDate),
}), {
  partitioning: {
    type: "range",
    columns: ["partition_date"],
  },
});

export const insertRecognitionResultSchema = createInsertSchema(recognitionResultsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertRecognitionResult = z.infer<typeof insertRecognitionResultSchema>;
export type RecognitionResult = typeof recognitionResultsTable.$inferSelect;

// ─── Verification Request ─────────────────────────────────────────────────────

export const verificationRequestsTable = pgTable("verification_requests", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Two faces being compared
  faceAImageUrl: text("face_a_image_url"),
  faceAStoragePath: text("face_a_storage_path"),
  faceAHash: text("face_a_hash"),
  
  faceBImageUrl: text("face_b_image_url"),
  faceBStoragePath: text("face_b_storage_path"),
  faceBHash: text("face_b_hash"),
  
  // Results
  isMatch: boolean("is_match").notNull(),
  similarityScore: real("similarity_score").notNull(),
  threshold: real("threshold").notNull(),
  decision: text("decision").notNull(), // MATCH, NO_MATCH, UNCERTAIN
  
  // Model info
  modelName: text("model_name"),
  modelVersion: text("model_version"),
  
  // Context
  purpose: text("purpose"), // ACCESS_CONTROL, KYC, DUPLICATE_DETECTION, etc.
  
  // Processing
  processingTimeMs: integer("processing_time_ms"),
  
  // Status
  status: text("status").notNull().default("COMPLETED"), // PENDING, PROCESSING, COMPLETED, FAILED
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("public"),
  projectId: integer("project_id"),
  
  // Partition
  partitionDate: timestamp("partition_date").notNull().defaultNow(),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uuidIdx: index("verification_requests_uuid_idx").on(table.uuid),
  isMatchIdx: index("verification_requests_is_match_idx").on(table.isMatch),
  partitionDateIdx: index("verification_requests_partition_date_idx").on(table.partitionDate),
}), {
  partitioning: {
    type: "range",
    columns: ["partition_date"],
  },
});

export const insertVerificationRequestSchema = createInsertSchema(verificationRequestsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertVerificationRequest = z.infer<typeof insertVerificationRequestSchema>;
export type VerificationRequest = typeof verificationRequestsTable.$inferSelect;

// ─── Threshold Calibration ─────────────────────────────────────────────────────

export const thresholdCalibrationsTable = pgTable("threshold_calibrations", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Calibration context
  calibrationType: text("calibration_type").notNull(), // FAR_BASED, EER_BASED, CUSTOM
  
  // Target metrics
  targetFAR: real("target_far"), // Desired False Acceptance Rate
  targetFRR: real("target_frr"), // Desired False Rejection Rate
  targetEER: real("target_eer"), // Equal Error Rate
  
  // Results
  optimalThreshold: real("optimal_threshold").notNull(),
  achievedFAR: real("achieved_far"),
  achievedFRR: real("achieved_frr"),
  achievedEER: real("achieved_eer"),
  
  // Evaluation data
  evaluationSetSize: integer("evaluation_set_size"),
  trueMatchCount: integer("true_match_count"),
  falseMatchCount: integer("false_match_count"),
  
  // Model info
  modelName: text("model_name"),
  modelVersion: text("model_version"),
  
  // Context factors used
  factorsUsed: jsonb("factors_used").$type<{
    quality: boolean;
    pose: boolean;
    lighting: boolean;
    occlusion: boolean;
  }>(),
  
  // Status
  status: text("status").notNull().default("VALID"), // VALID, STALE, SUPERSEDED
  
  // Relations
  supersededById: integer("superseded_by_id"),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("public"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
  validatedAt: timestamp("validated_at"),
}, (table) => ({
  uuidIdx: index("threshold_calibrations_uuid_idx").on(table.uuid),
  modelVersionIdx: index("threshold_calibrations_model_idx").on(table.modelVersion),
  statusIdx: index("threshold_calibrations_status_idx").on(table.status),
  tenantIdx: index("threshold_calibrations_tenant_idx").on(table.tenantId),
}));

export const insertThresholdCalibrationSchema = createInsertSchema(thresholdCalibrationsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertThresholdCalibration = z.infer<typeof insertThresholdCalibrationSchema>;
export type ThresholdCalibration = typeof thresholdCalibrationsTable.$inferSelect;
