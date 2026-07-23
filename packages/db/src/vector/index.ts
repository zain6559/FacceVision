import { IVectorStore } from "./types.js";
import { pgVectorAdapter } from "./pgVectorAdapter.js";
import { milvusAdapter } from "./milvusAdapter.js";

export * from "./types.js";
export * from "./quantization.js";
export * from "./pgVectorAdapter.js";
export * from "./milvusAdapter.js";
export * from "./vectorBenchmark.js";

/**
 * Factory for selecting active vector engine based on dataset scale.
 *
 * - Sub-100M vectors  -> PgVector HNSW Partitioned Engine
 * - Billion-scale      -> Distributed Milvus/Qdrant Cluster Engine
 */
export function getActiveVectorStore(expectedDatasetSize = 1000000): IVectorStore {
  const useMilvus = process.env.USE_MILVUS === "true" || expectedDatasetSize >= 100000000;
  if (useMilvus) {
    console.log("[VectorStore Factory] Routing vector search to Distributed Milvus Cluster Engine (>100M scale)");
    return milvusAdapter;
  }
  return pgVectorAdapter;
}
