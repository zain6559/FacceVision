/**
 * FaceVision — Model Security & Verification Schema
 * 
 * Provides:
 * - Model integrity verification (SHA-256 hash)
 * - Model signing and signature verification
 * - Model version tracking
 * - Tampering detection
 */

import { pgTable, text, serial, integer, timestamp, jsonb, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm";
import { z } from "zod/v4";

// ─── Model Registry Status ─────────────────────────────────────────────────────

export const MODEL_STATUS = {
  PENDING: "PENDING",         // Uploaded, not verified
  VERIFIED: "VERIFIED",       // Hash and signature verified
  ACTIVE: "ACTIVE",          // In production use
  DEPRECATED: "DEPRECATED",   // No longer recommended
  RETIRED: "RETIRED",        // No longer available
  COMPROMISED: "COMPROMISED", // Tampering detected
} as const;

export type ModelStatus = typeof MODEL_STATUS[keyof typeof MODEL_STATUS];

// ─── Model Types ───────────────────────────────────────────────────────────────

export const MODEL_TYPES = {
  FACE_DETECTION: "FACE_DETECTION",
  FACE_RECOGNITION: "FACE_RECOGNITION",
  FACE_EMBEDDING: "FACE_EMBEDDING",
  LIVENESS: "LIVENESS",
  ANTI_SPOOFING: "ANTI_SPOOFING",
  DEEPFAKE_DETECTION: "DEEPFAKE_DETECTION",
  LANDMARK_DETECTION: "LANDMARK_DETECTION",
  FACE_ALIGNMENT: "FACE_ALIGNMENT",
  IMAGE_QUALITY: "IMAGE_QUALITY",
} as const;

export type ModelType = typeof MODEL_TYPES[keyof typeof MODEL_TYPES];

// ─── Model Registry Table ───────────────────────────────────────────────────────

export const modelRegistryTable = pgTable("model_registry", {
  id: serial("id").primaryKey(),
  
  // Model identification
  modelName: text("model_name").notNull(), // e.g., "arcface_r100", "retinaface"
  modelType: text("model_type").notNull(), // FACE_DETECTION, FACE_RECOGNITION, etc.
  version: text("version").notNull(), // Semantic version
  
  // File information
  fileName: text("file_name").notNull(), // Original file name
  fileSize: integer("file_size").notNull(), // Bytes
  fileFormat: text("file_format").notNull(), // onnx, pth, h5, tflite
  
  // Integrity verification
  sha256Hash: text("sha256_hash").notNull(), // SHA-256 of model file
  sha512Hash: text("sha512_hash").notNull(), // SHA-512 for additional security
  blake3Hash: text("blake3_hash"), // Blake3 for fast verification
  
  // Signature (for additional security)
  signatureAlgorithm: text("signature_algorithm"), // Ed25519, RSA-SHA256, etc.
  signature: text("signature"), // Base64 encoded signature
  publicKeyId: text("public_key_id"), // Reference to signing key
  
  // Metadata
  architecture: text("architecture"), // Model architecture name
  inputShape: jsonb("input_shape").$type<number[]>(), // Input tensor shape
  outputShape: jsonb("output_shape").$type<number[]>(), // Output tensor shape
  embeddingDim: integer("embedding_dim"), // For embedding models
  
  // Training info
  trainingDataset: text("training_dataset"),
  trainingDate: timestamp("training_date"),
  trainingEpochs: integer("training_epochs"),
  
  // Performance metrics
  accuracy: text("accuracy"), // JSON with metrics
  inferenceTimeMs: integer("inference_time_ms"), // Average inference time
  memoryUsageMb: integer("memory_usage_mb"),
  
  // Status and lifecycle
  status: text("status").notNull().default(MODEL_STATUS.PENDING),
  isDefault: boolean("is_default").notNull().default(false),
  isProduction: boolean("is_production").notNull().default(false),
  
  // Security
  isTampered: boolean("is_tampered").notNull().default(false),
  tamperDetectedAt: timestamp("tamper_detected_at"),
  tamperReason: text("tamper_reason"),
  
  // Provenance
  sourceUrl: text("source_url"), // Where model was downloaded from
  sourceChecksum: text("source_checksum"), // Checksum at download
  buildInfo: jsonb("build_info").$type<{
    buildDate?: string;
    builder?: string;
    gitCommit?: string;
    dockerImage?: string;
  }>(),
  
  // Security metadata
  securityInfo: jsonb("security_info").$type<{
    vulnerabilityScanDate?: string;
    vulnerabilityCount?: number;
    lastAuditDate?: string;
    certifications?: string[];
  }>(),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  verifiedAt: timestamp("verified_at"),
  activatedAt: timestamp("activated_at"),
  createdBy: text("created_by"),
}, (table) => ({
  nameVersionIdx: index("model_registry_name_version_idx").on(table.modelName, table.version),
  typeIdx: index("model_registry_type_idx").on(table.modelType),
  statusIdx: index("model_registry_status_idx").on(table.status),
  tenantIdx: index("model_registry_tenant_idx").on(table.tenantId),
  isDefaultIdx: index("model_registry_default_idx").on(table.isDefault),
  hashIdx: index("model_registry_hash_idx").on(table.sha256Hash),
  sha256Idx: index("model_registry_sha256_idx").on(table.sha256Hash),
}));

export const insertModelRegistrySchema = createInsertSchema(modelRegistryTable).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  verifiedAt: true,
  activatedAt: true,
  isTampered: true,
});

export type InsertModelRegistry = z.infer<typeof insertModelRegistrySchema>;
export type ModelRegistry = typeof modelRegistryTable.$inferSelect;

// ─── Model Verification Log ──────────────────────────────────────────────────────

export const modelVerificationLogTable = pgTable("model_verification_log", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().references(() => modelRegistryTable.id, { onDelete: "cascade" }),
  
  // Verification details
  verificationType: text("verification_type").notNull(), // INITIAL, PERIODIC, DEMAND, INCIDENT
  verificationMethod: text("verification_method").notNull(), // HASH, SIGNATURE, FULL
  
  // Hash verification
  expectedHash: text("expected_hash"),
  actualHash: text("actual_hash"),
  hashMatch: boolean("hash_match"),
  
  // Signature verification
  signatureValid: boolean("signature_valid"),
  signatureError: text("signature_error"),
  
  // Result
  result: text("result").notNull(), // PASS, FAIL, ERROR
  
  // Context
  triggeredBy: text("triggered_by"), // SYSTEM, ADMIN, AUTOMATION
  triggerReason: text("trigger_reason"),
  
  // System info at verification time
  systemInfo: jsonb("system_info").$type<{
    nodeId?: string;
    ipAddress?: string;
    platform?: string;
    modelFilePath?: string;
  }>(),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  
  // Audit
  verifiedAt: timestamp("verified_at").notNull().defaultNow(),
}, (table) => ({
  modelIdx: index("model_verify_log_model_idx").on(table.modelId),
  resultIdx: index("model_verify_log_result_idx").on(table.result),
  verifiedAtIdx: index("model_verify_log_verified_idx").on(table.verifiedAt),
}));

export const insertModelVerificationLogSchema = createInsertSchema(modelVerificationLogTable).omit({ id: true });
export type InsertModelVerificationLog = z.infer<typeof insertModelVerificationLogSchema>;
export type ModelVerificationLog = typeof modelVerificationLogTable.$inferSelect;

// ─── Model Access Log ───────────────────────────────────────────────────────────

export const modelAccessLogTable = pgTable("model_access_log", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().references(() => modelRegistryTable.id, { onDelete: "cascade" }),
  
  // Access details
  accessType: text("access_type").notNull(), // LOAD, INFERENCE, UNLOAD
  operationId: text("operation_id"), // Correlation ID
  
  // Performance
  loadTimeMs: integer("load_time_ms"),
  inferenceTimeMs: integer("inference_time_ms"),
  memoryUsedMb: integer("memory_used_mb"),
  
  // Context
  apiKeyId: integer("api_key_id"),
  userId: text("user_id"),
  projectId: integer("project_id"),
  
  // System
  nodeId: text("node_id"),
  ipAddress: text("ip_address"),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  
  // Audit
  accessedAt: timestamp("accessed_at").notNull().defaultNow(),
}, (table) => ({
  modelIdx: index("model_access_log_model_idx").on(table.modelId),
  accessedAtIdx: index("model_access_log_accessed_idx").on(table.accessedAt),
  apiKeyIdx: index("model_access_log_api_key_idx").on(table.apiKeyId),
}));

export const insertModelAccessLogSchema = createInsertSchema(modelAccessLogTable).omit({ id: true });
export type InsertModelAccessLog = z.infer<typeof insertModelAccessLogSchema>;
export type ModelAccessLog = typeof modelAccessLogTable.$inferSelect;

// ─── Model Integrity Monitoring ────────────────────────────────────────────────

export const modelIntegrityMonitorTable = pgTable("model_integrity_monitor", {
  id: serial("id").primaryKey(),
  
  // Monitoring config
  modelId: integer("model_id").notNull().references(() => modelRegistryTable.id, { onDelete: "cascade" }),
  monitorType: text("monitor_type").notNull(), // HASH_CHECK, SIGNATURE_CHECK, BEHAVIOR_ANALYSIS
  
  // Schedule
  scheduleType: text("schedule_type").notNull().default("PERIODIC"), // PERIODIC, ON_LOAD, ON_INFERENCE, EVENT_TRIGGERED
  intervalMinutes: integer("interval_minutes").default(60), // For periodic checks
  
  // Thresholds
  maxHashDeviation: integer("max_hash_deviation").default(0), // Expected: 0 (any change = breach)
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  lastCheckAt: timestamp("last_check_at"),
  lastCheckResult: text("last_check_result"), // PASS, FAIL, ERROR, SKIPPED
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  
  // Alerts
  alertOnFailure: boolean("alert_on_failure").notNull().default(true),
  alertWebhook: text("alert_webhook"), // URL to call on failure
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  modelIdx: index("model_integrity_model_idx").on(table.modelId),
  isActiveIdx: index("model_integrity_active_idx").on(table.isActive),
}));

export const insertModelIntegrityMonitorSchema = createInsertSchema(modelIntegrityMonitorTable).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastCheckAt: true,
  lastCheckResult: true,
  consecutiveFailures: true,
});

export type InsertModelIntegrityMonitor = z.infer<typeof insertModelIntegrityMonitorSchema>;
export type ModelIntegrityMonitor = typeof modelIntegrityMonitorTable.$inferSelect;

// ─── Validation Schemas ────────────────────────────────────────────────────────

export const modelUploadSchema = z.object({
  modelName: z.string().min(1).max(100),
  modelType: z.nativeEnum(MODEL_TYPES),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Semantic version required"),
  fileName: z.string().min(1),
  fileFormat: z.enum(["onnx", "pth", "h5", "tflite", "pb"]),
  signature: z.string().optional(),
  signatureAlgorithm: z.string().optional(),
  metadata: z.object({
    architecture: z.string().optional(),
    inputShape: z.array(z.number()).optional(),
    outputShape: z.array(z.number()).optional(),
    trainingDataset: z.string().optional(),
  }).optional(),
});

export const modelVerificationSchema = z.object({
  modelId: z.number().int().positive(),
  verificationType: z.enum(["INITIAL", "PERIODIC", "DEMAND", "INCIDENT"]),
});

// ─── Model Loading Security ─────────────────────────────────────────────────────

export interface ModelVerificationResult {
  isValid: boolean;
  hashMatch: boolean;
  signatureValid?: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Verify model integrity before loading
 */
export async function verifyModelIntegrity(
  modelPath: string,
  expectedHash: string,
  expectedSignature?: string
): Promise<ModelVerificationResult> {
  const fs = await import("fs/promises");
  const crypto = await import("crypto");
  
  const result: ModelVerificationResult = {
    isValid: false,
    hashMatch: false,
    signatureValid: undefined,
    errors: [],
    warnings: [],
  };

  try {
    // Read model file
    const modelBuffer = await fs.readFile(modelPath);
    
    // Calculate SHA-256
    const actualHash = crypto.createHash("sha256").update(modelBuffer).digest("hex");
    
    // Verify hash
    result.hashMatch = actualHash === expectedHash;
    
    if (!result.hashMatch) {
      result.errors.push(`Hash mismatch: expected ${expectedHash}, got ${actualHash}`);
    }
    
    // Verify signature if provided
    if (expectedSignature) {
      // Signature verification would use the appropriate algorithm
      // This is a placeholder - actual implementation depends on signing method
      result.warnings.push("Signature verification not yet implemented");
    }
    
    result.isValid = result.hashMatch && (result.signatureValid ?? true);
    
  } catch (error) {
    result.errors.push(`Failed to verify model: ${error}`);
  }
  
  return result;
}

/**
 * Generate secure model hash
 */
export async function generateModelHash(modelPath: string): Promise<{
  sha256: string;
  sha512: string;
}> {
  const fs = await import("fs/promises");
  const crypto = await import("crypto");
  
  const modelBuffer = await fs.readFile(modelPath);
  
  return {
    sha256: crypto.createHash("sha256").update(modelBuffer).digest("hex"),
    sha512: crypto.createHash("sha512").update(modelBuffer).digest("hex"),
  };
}
