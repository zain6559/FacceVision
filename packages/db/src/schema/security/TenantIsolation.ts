/**
 * FaceVision — Multi-Tenant Isolation Security
 * 
 * Provides enterprise-grade tenant isolation:
 * - Row-Level Security (RLS) enforcement
 * - Tenant data boundaries
 * - Cross-tenant access prevention
 * - Data residency controls
 */

import { pgTable, text, serial, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zorm";
import { z } from "zod/v4";

// ─── Tenant Configuration ────────────────────────────────────────────────────────

export const TENANT_STATUS = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  TERMINATED: "TERMINATED",
  PENDING: "PENDING",
} as const;

export const DATA_RESIDENCY = {
  US: "US",
  EU: "EU",
  APAC: "APAC",
  GLOBAL: "GLOBAL",
} as const;

export const ISOLATION_LEVELS = {
  STRICT: "STRICT",     // Complete isolation, no data sharing
  SHARED: "SHARED",     // Shared infrastructure with logical isolation
  FEDERATED: "FEDERATED", // Separate databases per tenant
} as const;

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  
  // Tenant identification
  tenantId: text("tenant_id").notNull().unique(), // UUID
  name: text("name").notNull(),
  slug: text("slug").unique(), // URL-friendly identifier
  
  // Status and lifecycle
  status: text("status").notNull().default(TENANT_STATUS.PENDING),
  isVerified: boolean("is_verified").notNull().default(false),
  
  // Isolation configuration
  isolationLevel: text("isolation_level").notNull().default(ISOLATION_LEVELS.SHARED),
  dataResidency: text("data_residency").notNull().default(DATA_RESIDENCY.GLOBAL),
  
  // Regional configuration
  primaryRegion: text("primary_region"), // AWS region, Azure region, etc.
  disasterRecoveryRegion: text("disaster_recovery_region"),
  
  // Resource limits
  maxProjects: integer("max_projects").notNull().default(10),
  maxApiKeys: integer("max_api_keys").notNull().default(50),
  maxIdentities: integer("max_identities"), // null = unlimited
  maxStorageGb: integer("max_storage_gb").notNull().default(100),
  maxRequestsPerMonth: integer("max_requests_per_month"), // null = unlimited
  
  // Security configuration
  requireMfa: boolean("require_mfa").notNull().default(false),
  enforceIpWhitelist: boolean("enforce_ip_whitelist").notNull().default(false),
  allowedIpRanges: jsonb("allowed_ip_ranges").$type<string[]>().default(null),
  
  // Compliance
  complianceCertifications: jsonb("compliance_certifications").$type<string[]>().default([]), // SOC2, HIPAA, GDPR, etc.
  dataRetentionDays: integer("data_retention_days").notNull().default(365),
  
  // Contact
  ownerEmail: text("owner_email").notNull(),
  billingEmail: text("billing_email"),
  technicalContact: text("technical_contact"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  activatedAt: timestamp("activated_at"),
  suspendedAt: timestamp("suspended_at"),
  terminatedAt: timestamp("terminated_at"),
}, (table) => ({
  tenantIdIdx: index("tenants_tenant_id_idx").on(table.tenantId),
  slugIdx: index("tenants_slug_idx").on(table.slug),
  statusIdx: index("tenants_status_idx").on(table.status),
}));

// ─── Tenant Resource Usage ───────────────────────────────────────────────────────

export const tenantResourceUsageTable = pgTable("tenant_resource_usage", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  
  // Resource tracking
  resourceType: text("resource_type").notNull(), // PROJECTS, API_KEYS, IDENTITIES, STORAGE, REQUESTS
  
  // Usage metrics
  currentUsage: integer("current_usage").notNull().default(0),
  peakUsage: integer("peak_usage").notNull().default(0),
  averageUsage: integer("average_usage").notNull().default(0),
  
  // Quota
  quotaLimit: integer("quota_limit"),
  quotaPercentage: real("quota_percentage"), // Auto-calculated
  
  // Billing
  isBillable: boolean("is_billable").notNull().default(true),
  costPerUnit: real("cost_per_unit"),
  
  // Period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Audit
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("tenant_usage_tenant_idx").on(table.tenantId),
  resourceTypeIdx: index("tenant_usage_resource_idx").on(table.resourceType),
  periodIdx: index("tenant_usage_period_idx").on(table.periodStart, table.periodEnd),
}));

// ─── Tenant API Key Scopes ───────────────────────────────────────────────────────

export const tenantApiKeyScopesTable = pgTable("tenant_api_key_scopes", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  
  // Scope configuration
  scopeName: text("scope_name").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  isAuditOnly: boolean("is_audit_only").notNull().default(false), // Log only, don't actually process
  
  // Custom restrictions for this tenant
  rateLimitOverride: integer("rate_limit_override"), // Override global rate limit
  maxRequestsPerDay: integer("max_requests_per_day"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("tenant_scope_tenant_idx").on(table.tenantId),
  scopeNameIdx: index("tenant_scope_name_idx").on(table.scopeName),
}));

// ─── Cross-Tenant Access Log ─────────────────────────────────────────────────────

export const crossTenantAccessLogTable = pgTable("cross_tenant_access_log", {
  id: serial("id").primaryKey(),
  
  // Attempted access
  attemptedTenantId: text("attempted_tenant_id").notNull(), // Tenant that tried to access
  targetTenantId: text("target_tenant_id").notNull(), // Tenant that was target of access
  
  // Requestor
  requestorType: text("requestor_type").notNull(), // API_KEY, USER, ADMIN, SYSTEM
  requestorId: text("requestor_id").notNull(),
  requestorTenantId: text("requestor_tenant_id").notNull(),
  
  // Resource attempted
  resourceType: text("resource_type").notNull(), // IDENTITY, PROJECT, API_KEY, etc.
  resourceId: text("resource_id"),
  operation: text("operation").notNull(), // READ, WRITE, DELETE, etc.
  
  // Result
  wasBlocked: boolean("was_blocked").notNull(),
  blockReason: text("block_reason"),
  
  // Context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Severity
  severity: text("severity").notNull().default("LOW"), // LOW, MEDIUM, HIGH, CRITICAL
  
  // Audit
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
  attemptedTenantIdx: index("cross_tenant_attempted_idx").on(table.attemptedTenantId),
  targetTenantIdx: index("cross_tenant_target_idx").on(table.targetTenantId),
  requestorIdx: index("cross_tenant_requestor_idx").on(table.requestorId),
  timestampIdx: index("cross_tenant_timestamp_idx").on(table.timestamp),
  severityIdx: index("cross_tenant_severity_idx").on(table.severity),
}));

// ─── Tenant Audit Events ─────────────────────────────────────────────────────────

export const tenantAuditEventsTable = pgTable("tenant_audit_events", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  
  // Event type
  eventType: text("event_type").notNull(), // SECURITY, BILLING, CONFIG, ACCESS, DATA
  eventCategory: text("event_category").notNull(), // Specific category
  
  // Actor
  actorType: text("actor_type").notNull(), // USER, ADMIN, API, SYSTEM
  actorId: text("actor_id").notNull(),
  actorIp: text("actor_ip"),
  
  // Resource
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  
  // Action
  action: text("action").notNull(), // CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, etc.
  actionResult: text("action_result").notNull(), // SUCCESS, FAILURE, PARTIAL
  
  // Details
  details: jsonb("details"), // Event-specific details
  previousState: jsonb("previous_state"), // For updates
  newState: jsonb("new_state"), // For updates
  
  // Compliance
  isComplianceRelevant: boolean("is_compliance_relevant").notNull().default(false),
  retentionUntil: timestamp("retention_until"), // When this event can be deleted
  
  // Audit
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("tenant_audit_tenant_idx").on(table.tenantId),
  eventTypeIdx: index("tenant_audit_event_type_idx").on(table.eventType),
  actorIdx: index("tenant_audit_actor_idx").on(table.actorType, table.actorId),
  timestampIdx: index("tenant_audit_timestamp_idx").on(table.timestamp),
}));

// ─── Tenant Isolation Enforcement ────────────────────────────────────────────────

/**
 * Tenant context for request handling
 */
export interface TenantContext {
  tenantId: string;
  userId?: string;
  apiKeyId?: string;
  roles: string[];
  permissions: string[];
  ipAddress?: string;
  isAdmin: boolean;
}

/**
 * Verify tenant access is allowed
 */
export function canAccessTenant(
  requestorTenantId: string,
  targetTenantId: string,
  operation: "READ" | "WRITE" | "DELETE"
): { allowed: boolean; reason?: string } {
  // Same tenant - always allowed
  if (requestorTenantId === targetTenantId) {
    return { allowed: true };
  }
  
  // Cross-tenant access is NEVER allowed by default
  return {
    allowed: false,
    reason: `Cross-tenant access denied: cannot ${operation} resources from tenant ${targetTenantId}`
  };
}

/**
 * Check if tenant has exceeded resource limits
 */
export function checkTenantResourceLimit(
  currentUsage: number,
  maxLimit: number | null
): { exceeded: boolean; percentage?: number; message?: string } {
  if (maxLimit === null) {
    return { exceeded: false }; // Unlimited
  }
  
  const percentage = (currentUsage / maxLimit) * 100;
  
  if (currentUsage >= maxLimit) {
    return {
      exceeded: true,
      percentage,
      message: `Resource limit exceeded: ${currentUsage}/${maxLimit} (${percentage.toFixed(1)}%)`
    };
  }
  
  // Warning at 80%
  if (percentage >= 80) {
    return {
      exceeded: false,
      percentage,
      message: `Resource limit warning: ${percentage.toFixed(1)}% utilized`
    };
  }
  
  return { exceeded: false, percentage };
}

/**
 * Validate tenant is active and verified
 */
export function validateTenantStatus(
  status: string,
  isVerified: boolean
): { valid: boolean; reason?: string } {
  if (status === TENANT_STATUS.SUSPENDED) {
    return {
      valid: false,
      reason: "Tenant is suspended"
    };
  }
  
  if (status === TENANT_STATUS.TERMINATED) {
    return {
      valid: false,
      reason: "Tenant has been terminated"
    };
  }
  
  if (status === TENANT_STATUS.PENDING) {
    return {
      valid: false,
      reason: "Tenant is not yet activated"
    };
  }
  
  if (!isVerified) {
    return {
      valid: false,
      reason: "Tenant email not verified"
    };
  }
  
  return { valid: true };
}

/**
 * Generate tenant-scoped query filters
 */
export function createTenantFilter(tableTenantId: string, requestorTenantId: string): {
  filter: unknown;
  error?: string;
} {
  // Verify same tenant
  if (tableTenantId !== requestorTenantId) {
    return {
      filter: null,
      error: "Tenant isolation violation: cannot query resources from another tenant"
    };
  }
  
  return {
    filter: { tenantId: requestorTenantId }
  };
}

/**
 * Log cross-tenant access attempt
 */
export function logCrossTenantAttempt(data: {
  attemptedTenantId: string;
  targetTenantId: string;
  requestorId: string;
  resourceType: string;
  operation: string;
  ipAddress?: string;
  wasBlocked: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}): void {
  // This would be called by the middleware when cross-tenant access is detected
  console.warn("CROSS-TENANT ACCESS ATTEMPT:", {
    attemptedTenant: data.attemptedTenantId,
    targetTenant: data.targetTenantId,
    requestor: data.requestorId.substring(0, 8) + "...",
    resource: data.resourceType,
    operation: data.operation,
    blocked: data.wasBlocked,
    severity: data.severity,
    ip: data.ipAddress,
  });
}
