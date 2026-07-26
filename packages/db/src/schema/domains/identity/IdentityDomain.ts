/**
 * FaceVision — Identity Domain Schema
 * 
 * Proper separation of Identity from Face Samples:
 * 
 * Identity (Person)
 *   │
 *   ▼
 * BiometricProfile
 *   │
 *   ▼
 * FaceSample (Image with metadata)
 *   │
 *   ▼
 * Embedding (Versioned)
 */

import { pgTable, text, serial, integer, real, timestamp, jsonb, uuid, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Identity (Person) ─────────────────────────────────────────────────────────

export const identitiesTable = pgTable("identities", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Core identity
  primaryName: text("primary_name").notNull(),
  alternateNames: jsonb("alternate_names").$type<string[]>(),
  
  // Classification
  identityType: text("identity_type").notNull().default("PERSON"), // PERSON, GROUP, ANIMAL, OBJECT
  
  // Organization (optional)
  organizationId: integer("organization_id"),
  
  // Metadata
  birthDate: timestamp("birth_date"),
  gender: text("gender"),
  
  // Status
  isVerified: boolean("is_verified").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, INACTIVE, MERGED, DELETED
  
  // Relations
  mergedIntoId: integer("merged_into_id"), // If this identity was merged into another
  tenantId: text("tenant_id").notNull().default("public"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: text("created_by"),
}, (table) => ({
  uuidIdx: index("identities_uuid_idx").on(table.uuid),
  nameIdx: index("identities_name_idx").on(table.primaryName),
  tenantIdx: index("identities_tenant_idx").on(table.tenantId),
  statusIdx: index("identities_status_idx").on(table.status),
}));

export const insertIdentitySchema = createInsertSchema(identitiesTable).omit({ id: true, uuid: true, createdAt: true, updatedAt: true });
export type InsertIdentity = z.infer<typeof insertIdentitySchema>;
export type Identity = typeof identitiesTable.$inferSelect;

// ─── Biometric Profile ─────────────────────────────────────────────────────────

export const biometricProfilesTable = pgTable("biometric_profiles", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  identityId: integer("identity_id").notNull().references(() => identitiesTable.id, { onDelete: "cascade" }),
  
  // Profile metadata
  profileType: text("profile_type").notNull().default("STANDARD"), // STANDARD, VIP, SUSPICIOUS, STAFF
  captureEnvironment: text("capture_environment"), // passport, cctv, mobile, web
  
  // Quality metrics for this profile
  avgQualityScore: real("avg_quality_score"),
  embeddingCount: integer("embedding_count").notNull().default(0),
  firstCaptureAt: timestamp("first_capture_at"),
  lastCaptureAt: timestamp("last_capture_at"),
  
  // Status
  isEnrolled: boolean("is_enrolled").notNull().default(false),
  enrollmentMethod: text("enrollment_method"), // MANUAL, AUTOMATIC, IMPORT
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("public"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  identityIdx: index("biometric_profiles_identity_idx").on(table.identityId),
  tenantIdx: index("biometric_profiles_tenant_idx").on(table.tenantId),
}));

export const insertBiometricProfileSchema = createInsertSchema(biometricProfilesTable).omit({ id: true, uuid: true, createdAt: true, updatedAt: true });
export type InsertBiometricProfile = z.infer<typeof insertBiometricProfileSchema>;
export type BiometricProfile = typeof biometricProfilesTable.$inferSelect;

// ─── Face Sample ───────────────────────────────────────────────────────────────

export const faceSamplesTable = pgTable("face_samples", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  identityId: integer("identity_id").notNull().references(() => identitiesTable.id, { onDelete: "cascade" }),
  profileId: integer("profile_id").references(() => biometricProfilesTable.id, { onDelete: "set null" }),
  
  // Image metadata
  imageUrl: text("image_url"),
  imageStoragePath: text("image_storage_path"),
  thumbnailUrl: text("thumbnail_url"),
  
  // Quality metrics at capture time
  qualityScore: real("quality_score").notNull(),
  sharpness: real("sharpness"),
  brightness: real("brightness"),
  faceSize: integer("face_size"),
  pose: jsonb("pose").$type<{ yaw: number; pitch: number; roll: number }>(),
  occlusion: real("occlusion"),
  
  // Detection info
  boundingBox: jsonb("bounding_box").$type<{ x: number; y: number; width: number; height: number }>(),
  landmarks: jsonb("landmarks").$type<number[][]>(),
  
  // Context
  captureSource: text("capture_source").notNull().default("DIRECT"), // DIRECT, API, IMPORT, CRAWLER
  captureDevice: text("capture_device"),
  locationLabel: text("location_label"),
  gpsCoordinates: jsonb("gps_coordinates").$type<{ latitude: number; longitude: number }>(),
  
  // Provenance
  sourceUrl: text("source_url"),
  sourceType: text("source_type"), // NEWS, SOCIAL, CDN, ARCHIVE, DIRECT
  license: text("license"),
  
  // Storage tier (Hot/Warm/Cold/Archive)
  storageTier: text("storage_tier").notNull().default("HOT"),
  storageTierUpdatedAt: timestamp("storage_tier_updated_at"),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  isVerified: boolean("is_verified").notNull().default(false),
  needsReview: boolean("needs_review").notNull().default(false),
  reviewStatus: text("review_status"), // PENDING, APPROVED, REJECTED
  
  // Relations
  tenantId: text("tenant_id").notNull().default("public"),
  projectId: integer("project_id"),
  collectionId: integer("collection_id"),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
}, (table) => ({
  identityIdx: index("face_samples_identity_idx").on(table.identityId),
  profileIdx: index("face_samples_profile_idx").on(table.profileId),
  qualityIdx: index("face_samples_quality_idx").on(table.qualityScore),
  storageTierIdx: index("face_samples_storage_tier_idx").on(table.storageTier),
  tenantIdx: index("face_samples_tenant_idx").on(table.tenantId),
  needsReviewIdx: index("face_samples_needs_review_idx").on(table.needsReview),
}));

export const insertFaceSampleSchema = createInsertSchema(faceSamplesTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertFaceSample = z.infer<typeof insertFaceSampleSchema>;
export type FaceSample = typeof faceSamplesTable.$inferSelect;

// ─── Embedding (Versioned) ─────────────────────────────────────────────────────

export const embeddingsTable = pgTable("embeddings", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom(),
  
  // Relations
  identityId: integer("identity_id").notNull().references(() => identitiesTable.id, { onDelete: "cascade" }),
  faceSampleId: integer("face_sample_id").references(() => faceSamplesTable.id, { onDelete: "cascade" }),
  profileId: integer("profile_id").references(() => biometricProfilesTable.id, { onDelete: "set null" }),
  
  // The embedding vector (stored externally for large scale, but kept here for now)
  // For production: use Vector Database (Milvus, Qdrant, pgvector)
  embeddingVector: real("embedding_vector").array().notNull(),
  vectorDim: integer("vector_dim").notNull(),
  
  // Version tracking (critical for model upgrades)
  modelName: text("model_name").notNull(), // arcface, adaface, magface, elasticface
  modelVersion: text("model_version").notNull(),
  embeddingVersion: text("embedding_version").notNull(), // v1, v2, v3
  trainingDataset: text("training_dataset"), // buffalo_l, glint360k, etc.
  
  // Normalization
  normalizationMethod: text("normalization_method").notNull().default("L2"), // L2, L1, NONE
  
  // Quality at extraction time
  extractionQualityScore: real("extraction_quality_score"),
  extractionConfidence: real("extraction_confidence"),
  
  // Sub-embeddings (for ensemble)
  subEmbeddings: jsonb("sub_embeddings").$type<{
    lbp?: number[];
    hog?: number[];
    dct?: number[];
    clbp?: number[];
    lpq?: number[];
  }>(),
  
  // Algorithm version for legacy support
  algorithmVersion: text("algorithm_version").notNull().default("v1"),
  
  // Storage tier
  storageTier: text("storage_tier").notNull().default("HOT"),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  isPrimary: boolean("is_primary").notNull().default(false), // Best embedding for this identity
  
  // Tenant
  tenantId: text("tenant_id").notNull().default("public"),
  
  // HNSW index is created separately for vector search
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
  extractionTimeMs: integer("extraction_time_ms"),
}, (table) => ({
  identityIdx: index("embeddings_identity_idx").on(table.identityId),
  faceSampleIdx: index("embeddings_face_sample_idx").on(table.faceSampleId),
  profileIdx: index("embeddings_profile_idx").on(table.profileId),
  modelVersionIdx: index("embeddings_model_version_idx").on(table.modelVersion),
  storageTierIdx: index("embeddings_storage_tier_idx").on(table.storageTier),
  tenantIdx: index("embeddings_tenant_idx").on(table.tenantId),
  isPrimaryIdx: index("embeddings_is_primary_idx").on(table.isPrimary),
}));

export const insertEmbeddingSchema = createInsertSchema(embeddingsTable).omit({ id: true, uuid: true, createdAt: true });
export type InsertEmbedding = z.infer<typeof insertEmbeddingSchema>;
export type Embedding = typeof embeddingsTable.$inferSelect;

// ─── Identity Merge History ─────────────────────────────────────────────────────

export const identityMergeHistoryTable = pgTable("identity_merge_history", {
  id: serial("id").primaryKey(),
  
  // Source identity (the one being merged)
  sourceIdentityId: integer("source_identity_id").notNull().references(() => identitiesTable.id, { onDelete: "set null" }),
  sourceUuid: uuid("source_uuid").notNull(),
  
  // Target identity (the one it was merged into)
  targetIdentityId: integer("target_identity_id").notNull().references(() => identitiesTable.id, { onDelete: "set null" }),
  targetUuid: uuid("target_uuid").notNull(),
  
  // Merge details
  mergeReason: text("merge_reason"),
  similarityScore: real("similarity_score"),
  approvedBy: text("approved_by"),
  mergeMethod: text("merge_method").notNull().default("MANUAL"), // MANUAL, AUTOMATIC, ADMIN
  
  // Audit
  mergedAt: timestamp("merged_at").notNull().defaultNow(),
  mergedBy: text("merged_by").notNull(),
});

export const insertIdentityMergeHistorySchema = createInsertSchema(identityMergeHistoryTable).omit({ id: true });
export type InsertIdentityMergeHistory = z.infer<typeof insertIdentityMergeHistorySchema>;
export type IdentityMergeHistory = typeof identityMergeHistoryTable.$inferSelect;
