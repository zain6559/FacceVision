import { pgTable, text, serial, integer, real, timestamp, jsonb, vector, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const personsTable = pgTable("persons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  source: text("source").notNull().default("manual"),
  thumbnailUrl: text("thumbnail_url"),
  notes: text("notes"),
  tenantId: text("tenant_id").notNull().default("public"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // B-tree indexes for fast lookup and search
  nameIdx: index("persons_name_idx").on(table.name),
  tenantIdx: index("persons_tenant_idx").on(table.tenantId),
  createdAtIdx: index("persons_created_at_idx").on(table.createdAt),
}));

export const insertPersonSchema = createInsertSchema(personsTable).omit({ id: true, createdAt: true });
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof personsTable.$inferSelect;

export const faceEmbeddingsTable = pgTable("face_embeddings", {
  id: serial("id").primaryKey(),
  personId: integer("person_id").notNull().references(() => personsTable.id, { onDelete: "cascade" }),
  // Unified 512-dimensional vector standard (Matching SOTA buffalo_l ArcFace)
  embedding: vector("embedding", { dimensions: 512 }).notNull(),
  // Tracking and integrity attributes for biometric validation
  embeddingVersion: text("embedding_version").notNull().default("v5-fused"),
  modelVersion: text("model_version").notNull().default("buffalo_l"),
  vectorDim: integer("vector_dim").notNull().default(512),

  // Per-algorithm sub-embeddings
  lbpEmbedding:  jsonb("lbp_embedding").$type<number[]>(),   // Multi-Scale LBPH 128-dim [Ahonen 2006]
  hogEmbedding:  jsonb("hog_embedding").$type<number[]>(),   // Gabor wavelets 128-dim   [Liu 2002]
  dctEmbedding:  jsonb("dct_embedding").$type<number[]>(),   // WLD 64-dim               [Chen 2010]
  clbpEmbedding: jsonb("clbp_embedding").$type<number[]>(),  // Completed LBP 128-dim    [Guo 2010]
  lpqEmbedding:  jsonb("lpq_embedding").$type<number[]>(),   // Local Phase Quant 128-dim [Ojansivu 2008]
  imageUrl: text("image_url"),
  confidence: real("confidence").notNull().default(1.0),
  qualityScore: real("quality_score").notNull().default(1.0),
  algorithmVersion: text("algorithm_version").notNull().default("v1"),
  age: real("age"),
  gender: text("gender"),
  emotions: jsonb("emotions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // ═══════════════════════════════════════════════════════════════════
  // HNSW Index — Tuned for million-scale face matching (CompreFace-style)
  //
  //  m=32:               Higher graph connectivity → better recall at scale
  //                      (default=16 loses recall past ~500K vectors)
  //  ef_construction=256: Thorough graph build → higher quality neighborhoods
  //                      (default=64 creates weak links for high-dim vectors)
  //
  // ef_search is set at query-time (SET hnsw.ef_search = 200) in
  // recognition.ts for optimal latency/recall tradeoff.
  // ═══════════════════════════════════════════════════════════════════
  embeddingIndex: index("embedding_idx")
    .using("hnsw", table.embedding.op("vector_cosine_ops"))
    .with({ m: 32, ef_construction: 256 }),

  // B-tree on personId for fast JOIN and CASCADE lookups
  personIdIdx: index("face_embeddings_person_id_idx").on(table.personId),

  // B-tree on qualityScore for filtering low-quality embeddings
  qualityIdx: index("face_embeddings_quality_idx").on(table.qualityScore),
}));

export const insertFaceEmbeddingSchema = createInsertSchema(faceEmbeddingsTable).omit({ id: true, createdAt: true });
export type InsertFaceEmbedding = z.infer<typeof insertFaceEmbeddingSchema>;
export type FaceEmbedding = typeof faceEmbeddingsTable.$inferSelect;

export const recognitionLogsTable = pgTable("recognition_logs", {
  id: serial("id").primaryKey(),
  personId: integer("person_id").references(() => personsTable.id, { onDelete: "set null" }),
  confidence: real("confidence"),
  recognized: integer("recognized").notNull().default(0), // 0=false, 1=true
  processingTimeMs: real("processing_time_ms").notNull().default(0),
  algorithmVersion: text("algorithm_version"),
  qualityScore: real("quality_score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRecognitionLogSchema = createInsertSchema(recognitionLogsTable).omit({ id: true, createdAt: true });
export type InsertRecognitionLog = z.infer<typeof insertRecognitionLogSchema>;
export type RecognitionLog = typeof recognitionLogsTable.$inferSelect;

export const learningRunsTable = pgTable("learning_runs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  status: text("status").notNull().default("pending"), // pending|running|completed|failed
  facesAdded: integer("faces_added").notNull().default(0),
  personsAdded: integer("persons_added").notNull().default(0),
  maxImages: integer("max_images").notNull().default(20),
  errorMessage: text("error_message"),
  errors: integer("errors").notNull().default(0),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const experimentsTable = pgTable("experiments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  algorithmVersion: text("algorithm_version").notNull(),
  parameters: jsonb("parameters").notNull(), // weights, thresholds, etc.
  metrics: jsonb("metrics"), // FAR, FRR, Precision, Recall, EER
  status: text("status").notNull().default("pending"), // pending|running|completed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertExperimentSchema = createInsertSchema(experimentsTable).omit({ id: true, createdAt: true });
export type InsertExperiment = z.infer<typeof insertExperimentSchema>;
export type Experiment = typeof experimentsTable.$inferSelect;

export const insertLearningRunSchema = createInsertSchema(learningRunsTable).omit({ id: true, startedAt: true });
export type InsertLearningRun = z.infer<typeof insertLearningRunSchema>;
export type LearningRun = typeof learningRunsTable.$inferSelect;
