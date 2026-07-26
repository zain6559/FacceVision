/**
 * FaceVision — Security Schemas Index
 * 
 * Enterprise-grade security schemas for:
 * - Advanced API Key Management (scopes, expiration, rate limits)
 * - Model Integrity Verification (hash, signatures)
 * - Biometric Data Encryption (AES-256-GCM)
 * - Multi-Tenant Isolation (RLS, tenant boundaries)
 */

// ─── API Key Security ───────────────────────────────────────────────────────────

export {
  advancedApiKeysTable,
  apiKeyUsageLogTable,
  apiKeyRotationRequestsTable,
  API_SCOPES,
  API_KEY_ROLES,
  ROLE_DEFAULT_SCOPES,
  apiKeyRotationSchema,
  apiKeyCreationSchema,
  scopeValidationSchema,
  hasScope,
  hasAllScopes,
  hasAnyScope,
  isKeyExpired,
  isIpAllowed,
  type ApiScope,
  type ApiKeyRole,
  type InsertAdvancedApiKey,
  type AdvancedApiKey,
  type InsertApiKeyUsageLog,
  type ApiKeyUsageLog,
  type InsertApiKeyRotationRequest,
  type ApiKeyRotationRequest,
} from "./ApiKeySecurity";

// ─── Model Security ────────────────────────────────────────────────────────────

export {
  modelRegistryTable,
  modelVerificationLogTable,
  modelAccessLogTable,
  modelIntegrityMonitorTable,
  MODEL_STATUS,
  MODEL_TYPES,
  modelUploadSchema,
  modelVerificationSchema,
  verifyModelIntegrity,
  generateModelHash,
  type ModelStatus,
  type ModelType,
  type InsertModelRegistry,
  type ModelRegistry,
  type InsertModelVerificationLog,
  type ModelVerificationLog,
  type InsertModelAccessLog,
  type ModelAccessLog,
  type InsertModelIntegrityMonitor,
  type ModelIntegrityMonitor,
  type ModelVerificationResult,
} from "./ModelSecurity";

// ─── Biometric Security ────────────────────────────────────────────────────────

export {
  keyManagementTable,
  encryptedEmbeddingsTable,
  encryptionAccessLogTable,
  templateProtectionTable,
  biometricAuditTable,
  KEY_STATUS,
  KEY_TYPES,
  ENCRYPTION_ALGORITHMS,
  encryptAes256Gcm,
  decryptAes256Gcm,
  generateEncryptionKey,
  deriveKeyFromPassword,
  generateSalt,
  hashForAudit,
  generateSecureToken,
  type EncryptionResult,
  type DecryptionResult,
} from "./BiometricSecurity";

// ─── Tenant Isolation ────────────────────────────────────────────────────────────

export {
  tenantsTable,
  tenantResourceUsageTable,
  tenantApiKeyScopesTable,
  crossTenantAccessLogTable,
  tenantAuditEventsTable,
  TENANT_STATUS,
  DATA_RESIDENCY,
  ISOLATION_LEVELS,
  canAccessTenant,
  checkTenantResourceLimit,
  validateTenantStatus,
  createTenantFilter,
  logCrossTenantAttempt,
  type TenantContext,
} from "./TenantIsolation";
