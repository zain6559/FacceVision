import { pgTable, text, serial, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── 1. Projects Table (CompreFace Project Abstraction) ───────────────────────
export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  status: text("status").notNull().default("active"), // active|archived
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("projects_tenant_idx").on(table.tenantId),
}));

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

// ─── 2. Face Collections Table (CompreFace Subject Collections) ──────────────
export const collectionsTable = pgTable("collections", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  subjectCount: integer("subject_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("collections_project_idx").on(table.projectId),
}));

export const insertCollectionSchema = createInsertSchema(collectionsTable).omit({ id: true, createdAt: true });
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collectionsTable.$inferSelect;

// ─── 3. Users Table (Multi-tenant Enterprise RBAC) ───────────────────────────
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("DEVELOPER"), // ADMIN | DEVELOPER | VIEWER
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email),
  tenantIdx: index("users_tenant_idx").on(table.tenantId),
}));

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// ─── 4. API Keys Table (CompreFace Key Management) ───────────────────────────
export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  keyName: text("key_name").notNull(),
  keyPrefix: text("key_prefix").notNull(), // e.g. "fv_live_..."
  keyHash: text("key_hash").notNull(),
  role: text("role").notNull().default("SERVICE"), // ADMIN | SERVICE | READONLY
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => ({
  keyHashIdx: index("api_keys_hash_idx").on(table.keyHash),
  projectIdx: index("api_keys_project_idx").on(table.projectId),
}));

export const insertApiKeySchema = createInsertSchema(apiKeysTable).omit({ id: true, createdAt: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeysTable.$inferSelect;

// ─── 5. Audit & Activity Logs (Enterprise Auditability) ──────────────────────
export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default_tenant"),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // RECOGNITION | ENROLLMENT | API_KEY_CREATED | PROJECT_CREATED | DELETED
  resource: text("resource").notNull(),
  status: text("status").notNull().default("SUCCESS"), // SUCCESS | FAILURE | DENIED
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("audit_tenant_idx").on(table.tenantId),
  actionIdx: index("audit_action_idx").on(table.action),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
