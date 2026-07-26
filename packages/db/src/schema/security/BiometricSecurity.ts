/**
 * FaceVision — Biometric Data Encryption & Security Schema
 * 
 * Provides enterprise-grade security for biometric data:
 * - Encryption at rest for embeddings
 * - Encryption in transit
 * - Key management
 * - Cancelable biometrics support
 * - Template protection
 */

import { pgTable, text, serial, integer, timestamp, jsonb, index, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zorm";
import { z } from "zod/v4";

// ─── Encryption Key Management ───────────────────────────────────────────────────

export const KEY_STATUS = {
  ACTIVE: "ACTIVE",
  ROTATING: "ROTATING",
  RETIRED: "RETIRED",
  DESTROYED: "DESTROYED",
} as const;

export const KEY_TYPES = {
  MASTER: "MASTER",           // Root encryption key
  EMBEDDING: "EMBEDDING",    // For encrypting embeddings
  SAMPLE: "SAMPLE",          // For encrypting face samples
  EXPORT: "EXPORT",          // For data export encryption
  BACKUP: "BACKUP",          // For backup encryption
} as const;

export const ENCRYPTION_ALGORITHMS = {
  AES_256_GCM: "AES-256-GCM",
  AES_256_CBC: "AES-256-CBC",
  CHACHA20_POLY1305: "ChaCha20-Poly1305",
} as const;

export const keyManagementTable = pgTable("encryption_keys", {
  id: serial("id").primaryKey(),
  
  // Key identification
  keyId: text("key_id").notNull().unique(), // UUID or custom identifier
  keyType: text("key_type").notNull(), // MASTER, EMBEDDING, SAMPLE, etc.
  
  // Key metadata (NOT the actual key)
  algorithm: text("algorithm").notNull(), // AES-256-GCM, ChaCha20-Poly1305, etc.
  keySize: integer("key_size").notNull(), // 256, 512, etc.
  
  // Status and lifecycle
  status: text("status").notNull().default(KEY_STATUS.ACTIVE),
  
  // Key material reference (encrypted reference to key in KMS)
  keyMaterialRef: text("key_material_ref"), // Reference to external KMS
  keyVersion: integer("key_version").notNull().default(1),
  
  // Rotation
  rotatedAt: timestamp("rotated_at"),
  previousKeyId: text("previous_key_id"), // For rotation tracking
  
  // Expiration
  expiresAt: timestamp("expires_at"),
  rotationDueAt: timestamp("rotation_due_at"), // When to rotate next
  
  // Access control
  isAutomatic: boolean("is_automatic").notNull().default(false), // Auto-rotate
  minAccessLevel: text("min_access_level").notNull().default("ADMIN"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
  lastValidatedAt: timestamp("last_validated_at"),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("default_tenant"),
}, (table) => ({
  keyIdIdx: index("encryption_keys_id_idx").on(table.keyId),
  typeIdx: index("encryption_keys_type_idx").on(table.keyType),
  statusIdx: index("encryption_keys_status_idx").on(table.status),
  tenantIdx: index("encryption_keys_tenant_idx").on(table.tenantId),
}));

// ─── Encrypted Embeddings ────────────────────────────────────────────────────────

export const encryptedEmbeddingsTable = pgTable("encrypted_embeddings", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull().unique(),
  
  // Reference to original embedding (for migration)
  originalEmbeddingId: integer("original_embedding_id"),
  
  // Identity reference
  identityId: integer("identity_id").notNull(),
  faceSampleId: integer("face_sample_id"),
  profileId: integer("profile_id"),
  
  // Encrypted data
  encryptedVector: text("encrypted_vector").notNull(), // Base64 encoded encrypted embedding
  iv: text("iv").notNull(), // Initialization vector
  authTag: text("auth_tag"), // Authentication tag for GCM mode
  
  // Encryption metadata
  encryptionAlgorithm: text("encryption_algorithm").notNull(),
  keyId: text("key_id").notNull(), // Reference to encryption key
  keyVersion: integer("key_version").notNull(),
  
  // Original vector metadata (for decryption)
  vectorDim: integer("vector_dim").notNull(),
  normalizationMethod: text("normalization_method").notNull().default("L2"),
  
  // Cancelable biometrics (optional transformation)
  hasCancelableTransform: boolean("has_cancelable_transform").notNull().default(false),
  cancelableMethod: text("cancelable_method"), // BioHash, CancelableFace, etc.
  transformParameters: jsonb("transform_parameters"), // Parameters for inverse transform
  
  // Model info
  modelName: text("model_name").notNull(),
  modelVersion: text("model_version").notNull(),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  isDecrypted: boolean("is_decrypted").notNull().default(false),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  encryptedAt: timestamp("encrypted_at").notNull().defaultNow(),
  decryptedAt: timestamp("decrypted_at"),
  decryptedBy: text("decrypted_by"),
}, (table) => ({
  uuidIdx: index("encrypted_embeddings_uuid_idx").on(table.uuid),
  identityIdx: index("encrypted_embeddings_identity_idx").on(table.identityId),
  keyIdx: index("encrypted_embeddings_key_idx").on(table.keyId),
  tenantIdx: index("encrypted_embeddings_tenant_idx").on(table.tenantId),
  isActiveIdx: index("encrypted_embeddings_active_idx").on(table.isActive),
}));

// ─── Encryption Access Log ────────────────────────────────────────────────────────

export const encryptionAccessLogTable = pgTable("encryption_access_log", {
  id: serial("id").primaryKey(),
  
  // Access type
  accessType: text("access_type").notNull(), // ENCRYPT, DECRYPT, RE_KEY, VALIDATE
  
  // Resource
  resourceType: text("resource_type").notNull(), // EMBEDDING, SAMPLE, KEY
  resourceId: text("resource_id").notNull(),
  
  // Key used
  keyId: text("key_id").notNull(),
  keyVersion: integer("key_version"),
  
  // Requestor
  requestedBy: text("requested_by").notNull(), // User ID, API key ID, or system
  requestType: text("request_type").notNull(), // USER, API, AUTOMATED
  
  // Context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  
  // Result
  success: boolean("success").notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  
  // Duration
  operationDurationMs: integer("operation_duration_ms"),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  
  // Audit
  accessedAt: timestamp("accessed_at").notNull().defaultNow(),
}, (table) => ({
  accessTypeIdx: index("encryption_access_type_idx").on(table.accessType),
  resourceIdx: index("encryption_access_resource_idx").on(table.resourceType, table.resourceId),
  keyIdx: index("encryption_access_key_idx").on(table.keyId),
  requestedByIdx: index("encryption_access_requested_idx").on(table.requestedBy),
  accessedAtIdx: index("encryption_access_time_idx").on(table.accessedAt),
  tenantIdx: index("encryption_access_tenant_idx").on(table.tenantId),
}));

// ─── Biometric Template Protection ──────────────────────────────────────────────

export const templateProtectionTable = pgTable("biometric_template_protection", {
  id: serial("id").primaryKey(),
  
  // Reference
  identityId: integer("identity_id").notNull(),
  embeddingId: integer("embedding_id").notNull(),
  
  // Protection method
  method: text("method").notNull(), // BioHash, CancelableFace, FeatureTransform, Quantization
  methodVersion: text("method_version").notNull(),
  
  // Transformed template (cancelable)
  protectedTemplate: text("protected_template").notNull(), // The cancelable template
  
  // Transform parameters (stored separately for security)
  transformParameters: jsonb("transform_parameters").notNull(),
  
  // Inverse parameters (for verification only - should never leave secure enclave)
  inverseParametersHash: text("inverse_parameters_hash"), // Hash of inverse params
  
  // Security
  salt: text("salt"), // For password-based transforms
  nonce: text("nonce"), // For one-time transforms
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  isCompromised: boolean("is_compromised").notNull().default(false),
  compromisedAt: timestamp("compromised_at"),
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
}, (table) => ({
  identityIdx: index("template_protection_identity_idx").on(table.identityId),
  embeddingIdx: index("template_protection_embedding_idx").on(table.embeddingId),
  tenantIdx: index("template_protection_tenant_idx").on(table.tenantId),
}));

// ─── Biometric Audit Trail ───────────────────────────────────────────────────────

export const biometricAuditTable = pgTable("biometric_audit", {
  id: serial("id").primaryKey(),
  
  // Action type
  action: text("action").notNull(), // ENROLL, VERIFY, DELETE, EXPORT, UPDATE
  
  // Subject (the biometric)
  identityId: integer("identity_id"),
  faceSampleId: integer("face_sample_id"),
  
  // Actor (who performed the action)
  actorType: text("actor_type").notNull(), // USER, ADMIN, SYSTEM, API
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name"),
  
  // Context
  apiKeyId: text("api_key_id"),
  projectId: integer("project_id"),
  ipAddress: text("ip_address"),
  sessionId: text("session_id"),
  userAgent: text("user_agent"),
  
  // Result
  success: boolean("success").notNull(),
  failureReason: text("failure_reason"),
  
  // Data involved (hashes, not actual data)
  subjectHash: text("subject_hash"), // SHA-256 of subject identifier
  dataHashes: jsonb("data_hashes").$type<string[]>(), // Hashes of any data involved
  
  // Sensitivity
  sensitivityLevel: text("sensitivity_level").notNull().default("STANDARD"), // STANDARD, ELEVATED, RESTRICTED
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  
  // Audit
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
  actionIdx: index("biometric_audit_action_idx").on(table.action),
  identityIdx: index("biometric_audit_identity_idx").on(table.identityId),
  actorIdx: index("biometric_audit_actor_idx").on(table.actorType, table.actorId),
  timestampIdx: index("biometric_audit_timestamp_idx").on(table.timestamp),
  tenantIdx: index("biometric_audit_tenant_idx").on(table.tenantId),
}));

// ─── Encryption Service Implementation ──────────────────────────────────────────

import crypto from "crypto";

export interface EncryptionResult {
  encrypted: string;      // Base64 encoded encrypted data
  iv: string;            // Base64 encoded IV
  authTag?: string;       // Base64 encoded auth tag (for GCM)
  keyVersion: number;
}

export interface DecryptionResult {
  decrypted: Buffer;
  keyVersion: number;
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encryptAes256Gcm(
  plaintext: Buffer,
  key: Buffer,
  keyVersion: number
): EncryptionResult {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion,
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decryptAes256Gcm(
  encryptedData: string,
  iv: string,
  authTag: string,
  key: Buffer,
  expectedVersion: number
): DecryptionResult {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64")
  );
  
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, "base64")),
    decipher.final(),
  ]);
  
  return {
    decrypted,
    keyVersion: expectedVersion,
  };
}

/**
 * Generate a secure encryption key
 */
export function generateEncryptionKey(algorithm: string = "AES-256-GCM"): Buffer {
  const keySizes: Record<string, number> = {
    "AES-256-GCM": 32,
    "AES-256-CBC": 32,
    "ChaCha20-Poly1305": 32,
  };
  
  const keySize = keySizes[algorithm] || 32;
  return crypto.randomBytes(keySize);
}

/**
 * Derive key from password (for export encryption)
 */
export function deriveKeyFromPassword(
  password: string,
  salt: Buffer,
  iterations: number = 100000
): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
}

/**
 * Generate random salt
 */
export function generateSalt(length: number = 32): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Hash sensitive data for logging (without storing actual data)
 */
export function hashForAudit(data: string | number): string {
  return crypto.createHash("sha256").update(String(data)).digest("hex").substring(0, 16);
}

/**
 * Secure random token generation
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}
