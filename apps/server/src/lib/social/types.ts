export type SocialPlatform = "instagram" | "facebook" | "twitter" | "linkedin" | "web";

export interface SocialTarget {
  username: string;
  platform: SocialPlatform;
  targetPersonName?: string;
  targetPersonId?: number;
}

export interface CrawledMediaItem {
  id: string;
  mediaUrl: string;
  platform: SocialPlatform;
  caption?: string;
  hashtags: string[];
  geoCoordinates?: { lat: number; lng: number };
  detectedFacesCount: number;
  qualityScore: number;
  timestamp: string;
}

export interface ProxyNode {
  id: string;
  url: string;
  region: "US" | "EU" | "ASIA";
  latencyMs: number;
  healthy: boolean;
  consecutiveFailures: number;
  lastCheckedAt: string;
}

export type NodeType = "person" | "post" | "location" | "comment";
export type EdgeRelation = "TAGGED_IN" | "COMMENTED_ON" | "LOCATED_AT" | "ASSOCIATED_WITH";

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  metadata: Record<string, any>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: EdgeRelation;
  weight?: number;
}

export interface NormalizedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootNodeId: string;
  maxDepthTraversed: number;
  totalEntities: number;
}

export interface SimCLRValidationResult {
  isConsistent: boolean;
  similarityScore: number;
  validatedEmbedding: number[];
  confidence: number;
}

export interface SocialCrawlResult {
  target: SocialTarget;
  graph: NormalizedGraph;
  mediaItems: CrawledMediaItem[];
  embeddingsEnrolled: number;
  simclrMatchConfidence: number;
  durationMs: number;
}

export interface WorkerPoolStats {
  activeWorkers: number;
  maxWorkers: number;
  proxiesCount: number;
  healthyProxiesCount: number;
  requestsProcessed: number;
  successRate: number;
  averageLatencyMs: number;
}

export interface SyntheticAugmentOptions {
  posesCount?: number;          // Default: 10
  yawRange?: [number, number];   // [-45, 45]
  pitchRange?: [number, number]; // [-30, 30]
  cctvLightingSim?: boolean;
}

export interface SyntheticFaceVariation {
  variationId: string;
  poseYaw: number;
  posePitch: number;
  lightingCondition: string;
  syntheticEmbedding: number[];
  similarityWithSource: number;
}

export interface SyntheticAugmentResult {
  sourceEmbedding: number[];
  variations: SyntheticFaceVariation[];
  totalGenerated: number;
}
