/**
 * FaceVision — Audit Domain Schema
 * 
 * Comprehensive audit logging for compliance and security.
 * Logs capture not just "what happened" but context for each action.
 */

import { pgTable, text, serial, integer, timestamp, jsonb, uuid, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Action details
  action: text("action").notNull(), // RECOGNITION, VERIFICATION, ENROLLMENT, DELETION, CONFIG_CHANGE, LOGIN, etc.
  actionCategory: text("action_category").notNull(), // SECURITY, DATA, SYSTEM, USER
  
  // Resource
  resourceType: text("resource_type").notNull(), // IDENTITY, EMBEDDING, FACE_SAMPLE, PROJECT, USER, API_KEY, etc.
  resourceId: text("resource_id"), // Can be string for UUID support
  
  // Actor (who did it)
  actorType: text("actor_type").notNull(), // USER, API_KEY, SYSTEM, ADMIN
  actorId: text("actor_id"),
  actorName: text("actor_name"),
  
  // Context
  tenantId: text("tenant_id").notNull().default("public"),
  projectId: integer("project_id"),
  
  // Request info
  requestId: text("request_id"), // Correlation ID
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Action result
  status: text("status").notNull(), // SUCCESS, FAILURE, DENIED, PARTIAL
  
  // Detailed changes
  changes: jsonb("changes").$type<{
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    changedFields?: string[];
  }>(),
  
  // Recognition-specific audit (enriched context)
  recognitionContext: jsonb("recognition_context").$type<{
    modelVersion?: string;
    threshold?: number;
    confidence?: number;
    latencyMs?: number;
    decision?: string;
    faceCount?: number;
  }>(),
  
  // Security context
  securityContext: jsonb("security_context").$type<{
    authenticationMethod?: string;
    mfaUsed?: boolean;
    riskScore?: number;
    geoLocation?: string;
  }>(),
  
  // Error details
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  
  // Partition key
  partitionDate: timestamp("partition_date").notNull().defaultNow(),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uuidIdx: index("audit_logs_uuid_idx").on(table.uuid),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  actionCategoryIdx: index("audit_logs_category_idx").on(table.actionCategory),
  resourceTypeIdx: index("audit_logs_resource_type_idx").on(table.resourceType),
  actorIdx: index("audit_logs_actor_idx").on(table.actorId),
  tenantIdx: index("audit_logs_tenant_idx").on(table.tenantId),
  statusIdx: index("audit_logs_status_idx").on(table.status),
  partitionDateIdx: index("audit_logs_partition_date_idx").on(table.partitionDate),
}), {
  partitioning: {
    type: "range",
    columns: ["partition_date"],
  },
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;

// ─── Access Log ───────────────────────────────────────────────────────────────

export const accessLogsTable = pgTable("access_logs", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Authentication
  authenticationId: text("authentication_id"),
  actorType: text("actor_type").notNull(), // USER, API_KEY, SERVICE
  actorId: text("actor_id"),
  actorName: text("actor_name"),
  
  // Access details
  accessType: text("access_type").notNull(), // LOGIN, LOGOUT, API_CALL, DATA_ACCESS
  resource: text("resource").notNull(),
  action: text("action").notNull(), // READ, WRITE, DELETE, EXECUTE
  
  // Context
  tenantId: text("tenant_id").notNull().default("public"),
  projectId: integer("project_id"),
  
  // Request
  requestMethod: text("request_method"), // GET, POST, etc.
  requestPath: text("request_path"),
  requestId: text("request_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Response
  responseStatus: integer("response_status"),
  responseTimeMs: integer("response_time_ms"),
  
  // Security
  mfaUsed: boolean("mfa_used").notNull().default(false),
  riskScore: integer("risk_score"),
  
  // Denied access
  deniedReason: text("denied_reason"),
  
  // Partition
  partitionDate: timestamp("partition_date").notNull().defaultNow(),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uuidIdx: index("access_logs_uuid_idx").on(table.uuid),
  actorIdx: index("access_logs_actor_idx").on(table.actorId),
  accessTypeIdx: index("access_logs_access_type_idx").on(table.accessType),
  resourceIdx: index("access_logs_resource_idx").on(table.resource),
  tenantIdx: index("access_logs_tenant_idx").on(table.tenantId),
  partitionDateIdx: index("access_logs_partition_date_idx").on(table.partitionDate),
}), {
  partitioning: {
    type: "range",
    columns: ["partition_date"],
  },
});

export const insertAccessLogSchema = createInsertSchema(accessLogsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertAccessLog = z.infer<typeof insertAccessLogSchema>;
export type AccessLog = typeof accessLogsTable.$inferSelect;

// ─── Compliance Report ────────────────────────────────────────────────────────

export const complianceReportsTable = pgTable("compliance_reports", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Report details
  reportType: text("report_type").notNull(), // GDPR_REQUEST, DATA_INVENTORY, ACCESS_AUDIT, CONSENT_REPORT
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Status
  status: text("status").notNull().default("GENERATING"), // GENERATING, READY, FAILED
  
  // Results
  results: jsonb("results"),
  filePath: text("file_path"),
  
  // Requestor
  requestedBy: text("requested_by").notNull(),
  requestorEmail: text("requestor_email"),
  requestReason: text("request_reason"),
  
  // Compliance framework
  framework: text("framework"), // GDPR, CCPA, HIPAA, SOC2
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("public"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  uuidIdx: index("compliance_reports_uuid_idx").on(table.uuid),
  reportTypeIdx: index("compliance_reports_type_idx").on(table.reportType),
  statusIdx: index("compliance_reports_status_idx").on(table.status),
  tenantIdx: index("compliance_reports_tenant_idx").on(table.tenantId),
}));

export const insertComplianceReportSchema = createInsertSchema(complianceReportsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertComplianceReport = z.infer<typeof insertComplianceReportSchema>;
export type ComplianceReport = typeof complianceReportsTable.$inferSelect;
