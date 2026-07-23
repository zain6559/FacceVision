export interface QuantizedVector {
  quantizedData: Uint8Array; // 512 uint8 bytes (75% memory reduction)
  min: number;
  max: number;
}

export interface VectorPoint {
  id: string | number;
  personId: number;
  embedding: number[];
  quantized?: QuantizedVector;
  qualityScore: number;
  confidence: number;
  algorithmVersion: string;
  metadata?: Record<string, any>;
}

export interface VectorSearchQuery {
  vector: number[];
  topK: number;
  efSearch?: number; // HNSW Search depth (Default: 64)
  tenantId?: string;
  minQualityScore?: number;
  useQuantization?: boolean;
}

export interface VectorSearchResult {
  id: string | number;
  personId: number;
  similarity: number;
  distance: number;
  qualityScore: number;
  algorithmVersion: string;
}

export interface IVectorStore {
  name: string;
  insert(point: VectorPoint): Promise<boolean>;
  insertBatch(points: VectorPoint[]): Promise<number>;
  search(query: VectorSearchQuery): Promise<VectorSearchResult[]>;
  deleteByPersonId(personId: number): Promise<boolean>;
  getStats(): Promise<{ totalVectors: number; engine: string; memoryFootprintReductionPct: number }>;
}
