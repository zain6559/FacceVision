/**
 * FaceVision — Advanced API Key Security Schema
 * 
 * Enterprise-grade API Key Management with:
 * - Fine-grained scopes (permissions)
 * - Token expiration
 * - Rate limits per key
 * - IP restrictions
 * - Token rotation support
 * - Usage auditing
 */

import { pgTable, text, serial, integer, timestamp, jsonb, index, boolean, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── API Key Scopes ─────────────────────────────────────────────────────────────

/**
 * Available API scopes for fine-grained permissions
 */
export const API_SCOPES = {
  // Recognition
  RECOGNIZE: "recognition:identify",
  VERIFY: "recognition:verify",
  DETECT: "recognition:detect",
  
  // Identity Management
  IDENTITY_READ: "identity:read",
  IDENTITY_WRITE: "identity:write",
  IDENTITY_DELETE: "identity:delete",
  
  // Face Samples
  SAMPLE_READ: "sample:read",
  SAMPLE_WRITE: "sample:write",
  SAMPLE_DELETE: "sample:delete",
  
  // Embeddings
  EMBEDDING_READ: "embedding:read",
  EMBEDDING_WRITE: "embedding:write",
  
  // Analytics & Stats
  STATS_READ: "stats:read",
  
  // Learning Pipeline
  LEARNING_READ: "learning:read",
  LEARNING_TRIGGER: "learning:trigger",
  
  // Admin Operations
  ADMIN_USERS: "admin:users",
  ADMIN_API_KEYS: "admin:api_keys",
  ADMIN_PROJECTS: "admin:projects",
  ADMIN_SYSTEM: "admin:system",
  
  // Audit
  AUDIT_READ: "audit:read",
  
  // Marketplace
  MARKETPLACE_READ: "marketplace:read",
  MARKETPLACE_WRITE: "marketplace:write",
} as const;

export type ApiScope = typeof API_SCOPES[keyof typeof API_SCOPES];

// ─── API Key Roles ──────────────────────────────────────────────────────────────

export const API_KEY_ROLES = {
  ADMIN: "ADMIN",      // Full access
  SERVICE: "SERVICE",  // Application-level access
  DEVELOPER: "DEVELOPER", // Development access
  READONLY: "READONLY", // Read-only access
  CUSTOM: "CUSTOM",    // Custom scope-based access
} as const;

export type ApiKeyRole = typeof API_KEY_ROLES[keyof typeof API_KEY_ROLES];

/**
 * Default scopes per role
 */
export const ROLE_DEFAULT_SCOPES: Record<ApiKeyRole, ApiScope[]> = {
  [API_KEY_ROLES.ADMIN]: Object.values(API_SCOPES),
  [API_KEY_ROLES.SERVICE]: [
    API_SCOPES.RECOGNIZE,
    API_SCOPES.VERIFY,
    API_SCOPES.DETECT,
    API_SCOPES.IDENTITY_READ,
    API_SCOPES.SAMPLE_READ,
    API_SCOPES.STATS_READ,
  ],
  [API_KEY_ROLES.DEVELOPER]: [
    API_SCOPES.RECOGNIZE,
    API_SCOPES.VERIFY,
    API_SCOPES.DETECT,
    API_SCOPES.IDENTITY_READ,
    API_SCOPES.IDENTITY_WRITE,
    API_SCOPES.SAMPLE_READ,
    API_SCOPES.SAMPLE_WRITE,
    API_SCOPES.STATS_READ,
    API_SCOPES.LEARNING_READ,
  ],
  [API_KEY_ROLES.READONLY]: [
    API_SCOPES.IDENTITY_READ,
    API_SCOPES.SAMPLE_READ,
    API_SCOPES.EMBEDDING_READ,
    API_SCOPES.STATS_READ,
    API_SCOPES.AUDIT_READ,
  ],
  [API_KEY_ROLES.CUSTOM]: [], // No default scopes for custom
};

// ─── Advanced API Keys Table ────────────────────────────────────────────────────

export const advancedApiKeysTable = pgTable("advanced_api_keys", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => null as any, { onDelete: "cascade" }),
  
  // Key metadata
  keyName: text("key_name").notNull(),
  keyPrefix: text("key_prefix").notNull(), // e.g., "fv_live_xxxx"
  keyHash: text("key_hash").notNull(), // SHA-256 hash of full key
  keySuffix: text("key_suffix").notNull(), // Last 4 chars for display
  
  // Role and scopes
  role: text("role").notNull().default(API_KEY_ROLES.SERVICE),
  scopes: jsonb("scopes").$type<ApiScope[]>().notNull().default([]),
  
  // Expiration
  expiresAt: timestamp("expires_at"),
  lastRotatedAt: timestamp("last_rotated_at"),
  
  // Rate limiting
  rateLimit: integer("rate_limit").notNull().default(1000), // Requests per window
  rateLimitWindowMs: integer("rate_limit_window_ms").notNull().default(60000), // 1 minute default
  
  // IP restrictions
  allowedIps: jsonb("allowed_ips").$type<string[]>().default(null), // null = all IPs allowed
  deniedIps: jsonb("denied_ips").$type<string[]>().default(null),
  
  // Usage tracking
  usageCount: integer("usage_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  lastUsedIp: text("last_used_ip"),
  
  // Security
  isActive: boolean("is_active").notNull().default(true),
  isRevoked: boolean("is_revoked").notNull().default(false),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  
  // Rotation support
  previousKeyHash: text("previous_key_hash"), // For rotation tracking
  rotationCount: integer("rotation_count").notNull().default(0),
  
  // Metadata
  description: text("description"),
  environment: text("environment").notNull().default("production"), // production, staging, development
  createdBy: text("created_by"),
  
  // Audit
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  keyHashIdx: index("adv_api_keys_hash_idx").on(table.keyHash),
  projectIdx: index("adv_api_keys_project_idx").on(table.projectId),
  tenantIdx: index("adv_api_keys_tenant_idx").on(table.tenantId),
  expiresIdx: index("adv_api_keys_expires_idx").on(table.expiresAt),
  isActiveIdx: index("adv_api_keys_active_idx").on(table.isActive),
}));

export const insertAdvancedApiKeySchema = createInsertSchema(advancedApiKeysTable).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  usageCount: true,
  lastUsedAt: true,
  lastUsedIp: true,
  previousKeyHash: true,
  rotationCount: true,
  isRevoked: true,
  revokedAt: true,
  revokedReason: true,
});

export type InsertAdvancedApiKey = z.infer<typeof insertAdvancedApiKeySchema>;
export type AdvancedApiKey = typeof advancedApiKeysTable.$inferSelect;

// ─── API Key Usage Log ────────────────────────────────────────────────────────

export const apiKeyUsageLogTable = pgTable("api_key_usage_log", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull().references(() => advancedApiKeysTable.id, { onDelete: "cascade" }),
  
  // Request info
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  
  // Response
  statusCode: integer("status_code"),
  responseTimeMs: integer("response_time_ms"),
  
  // Context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Rate limiting
  rateLimitRemaining: integer("rate_limit_remaining"),
  rateLimitReset: timestamp("rate_limit_reset"),
  
  // Audit
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
  apiKeyIdx: index("api_key_usage_key_idx").on(table.apiKeyId),
  timestampIdx: index("api_key_usage_timestamp_idx").on(table.timestamp),
  tenantIdx: index("api_key_usage_tenant_idx").on(table.tenantId),
}));

export const insertApiKeyUsageLogSchema = createInsertSchema(apiKeyUsageLogTable).omit({ id: true });
export type InsertApiKeyUsageLog = z.infer<typeof insertApiKeyUsageLogSchema>;
export type ApiKeyUsageLog = typeof apiKeyUsageLogTable.$inferSelect;

// ─── API Key Rotation Requests ─────────────────────────────────────────────────

export const apiKeyRotationRequestsTable = pgTable("api_key_rotation_requests", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull().references(() => advancedApiKeysTable.id, { onDelete: "cascade" }),
  
  // New key info
  newKeyHash: text("new_key_hash").notNull(),
  newKeyPrefix: text("new_key_prefix").notNull(),
  newKeySuffix: text("new_key_suffix").notNull(),
  
  // State
  status: text("status").notNull().default("PENDING"), // PENDING, COMPLETED, CANCELLED, EXPIRED
  expiresAt: timestamp("expires_at").notNull(), // When old key stops working
  completedAt: timestamp("completed_at"),
  
  // Security
  requestedBy: text("requested_by").notNull(),
  requestedIp: text("requested_ip"),
  
  // Audit
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  apiKeyIdx: index("api_key_rotation_key_idx").on(table.apiKeyId),
  statusIdx: index("api_key_rotation_status_idx").on(table.status),
  expiresIdx: index("api_key_rotation_expires_idx").on(table.expiresAt),
}));

export const insertApiKeyRotationRequestSchema = createInsertSchema(apiKeyRotationRequestsTable).omit({ id: true, createdAt: true });
export type InsertApiKeyRotationRequest = z.infer<typeof insertApiKeyRotationRequestSchema>;
export type ApiKeyRotationRequest = typeof apiKeyRotationRequestsTable.$inferSelect;

// ─── Validation Schemas ────────────────────────────────────────────────────────

export const apiKeyRotationSchema = z.object({
  keyId: z.number().int().positive(),
  reason: z.string().min(1).max(500).optional(),
});

export const apiKeyCreationSchema = z.object({
  keyName: z.string().min(1).max(100),
  role: z.nativeEnum(API_KEY_ROLES),
  scopes: z.array(z.enum(Object.values(API_SCOPES) as [string, ...string[]])).optional(),
  expiresAt: z.string().datetime().optional(), // ISO date string
  rateLimit: z.number().int().min(1).max(100000).optional(),
  rateLimitWindowMs: z.number().int().min(1000).max(3600000).optional(),
  allowedIps: z.array(z.string().ip()).optional(),
  deniedIps: z.array(z.string().ip()).optional(),
  description: z.string().max(500).optional(),
  environment: z.enum(["production", "staging", "development"]).optional(),
});

export const scopeValidationSchema = z.object({
  requiredScopes: z.array(z.enum(Object.values(API_SCOPES) as [string, ...string[]])),
  requireAll: z.boolean().default(false), // If true, all scopes required. If false, at least one required
});

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Check if a key has required scope
 */
export function hasScope(keyScopes: ApiScope[], requiredScope: ApiScope): boolean {
  return keyScopes.includes(requiredScope);
}

/**
 * Check if a key has ALL required scopes
 */
export function hasAllScopes(keyScopes: ApiScope[], requiredScopes: ApiScope[]): boolean {
  return requiredScopes.every(scope => keyScopes.includes(scope));
}

/**
 * Check if a key has ANY of the required scopes
 */
export function hasAnyScope(keyScopes: ApiScope[], requiredScopes: ApiScope[]): boolean {
  return requiredScopes.some(scope => keyScopes.includes(scope));
}

/**
 * Check if a key is expired
 */
export function isKeyExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date() > expiresAt;
}

/**
 * Check if IP is allowed
 */
export function isIpAllowed(
  clientIp: string,
  allowedIps: string[] | null,
  deniedIps: string[] | null
): boolean {
  // If denied list exists and IP is in it, deny
  if (deniedIps && deniedIps.some(pattern => matchesIpPattern(clientIp, pattern))) {
    return false;
  }
  
  // If allowed list exists, IP must be in it
  if (allowedIps && allowedIps.length > 0) {
    return allowedIps.some(pattern => matchesIpPattern(clientIp, pattern));
  }
  
  // No restrictions
  return true;
}

/**
 * Simple IP pattern matching (supports CIDR notation)
 */
function matchesIpPattern(ip: string, pattern: string): boolean {
  if (pattern.includes("/")) {
    // CIDR notation
    return matchesCidr(ip, pattern);
  }
  return ip === pattern;
}

function matchesCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  
  return (ipNum & mask) === (rangeNum & mask);
}

function ipToNumber(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
}
