import { NewsExtractor, ExtractedNewsMetadata } from "./newsExtractor.js";
import { WaybackIngest, WaybackArchiveAsset } from "./waybackIngest.js";
import { db, personsTable, faceEmbeddingsTable, safeDbQuery } from "@workspace/db";
import { eq } from "drizzle-orm";

export * from "./newsExtractor.js";
export * from "./waybackIngest.js";

export interface UnifiedCandidateRecord {
  faceEmbedding: number[];
  personName: string;
  sourceUrl: string;
  jobTitle?: string;
  organization?: string;
  confidenceScore: number;
}

/**
 * Multi-Source Ingest Coordinator (v3.5 OSINT Core)
 *
 * Orchestrates face and metadata harvesting from News OpenGraph extractors, Wayback Archive endpoints,
 * and CDNs. Implements concurrency-managed pipelines, rate-limiting queues, and standardized DB persistence.
 */
export class MultiSourceIngestCoordinator {
  private newsExtractor = new NewsExtractor();
  private waybackIngest = new WaybackIngest();

  // Simple in-memory rate-limiter for domain calls (1 second cooldown per host)
  private domainCooldowns = new Map<string, number>();

  private enforceRateLimit(url: string): Promise<void> {
    try {
      const parsed = new URL(url);
      const host = parsed.host;
      const now = Date.now();
      const lastCall = this.domainCooldowns.get(host) || 0;
      const nextAllowed = lastCall + 1000;

      if (now < nextAllowed) {
        const delay = nextAllowed - now;
        this.domainCooldowns.set(host, nextAllowed);
        return new Promise(resolve => setTimeout(resolve, delay));
      }
      this.domainCooldowns.set(host, now);
    } catch {
      // If URL parsing fails, skip rate-limiting gracefully
    }
    return Promise.resolve();
  }

  /**
   * Harvests names and images from a list of structured news article URLs
   */
  public async ingestNewsArticles(urls: string[]): Promise<ExtractedNewsMetadata[]> {
    const results: ExtractedNewsMetadata[] = [];

    for (const url of urls) {
      try {
        await this.enforceRateLimit(url);
        console.log(`[Ingest Coordinator] Ingesting news article: ${url}`);
        const metadata = await this.newsExtractor.extractFromUrl(url);
        results.push(metadata);
      } catch (err: any) {
        console.error(`[Ingest Coordinator] Failed to ingest news URL: ${url}. Error:`, err?.message || err);
      }
    }

    return results;
  }

  /**
   * Harvests archived image profiles of a domain from the Wayback Machine
   */
  public async ingestHistoricalArchive(domain: string, limit = 50): Promise<WaybackArchiveAsset[]> {
    console.log(`[Ingest Coordinator] Querying historical captures for domain: ${domain}`);
    return this.waybackIngest.queryArchivedAssets(domain, limit);
  }

  /**
   * Saves a unified biometric candidate record to the PostgreSQL/Drizzle database
   */
  public async saveCandidateRecord(record: UnifiedCandidateRecord): Promise<boolean> {
    const { faceEmbedding, personName, sourceUrl, jobTitle, organization, confidenceScore } = record;

    if (faceEmbedding.length !== 576) {
      console.warn(`[Ingest Coordinator] Cannot store embedding for ${personName}: Expected 576 dimensions, got ${faceEmbedding.length}`);
      return false;
    }

    const { isDegraded } = await safeDbQuery(async () => {
      // 1. Resolve or create Person ID
      let personId: number | null = null;
      const existing = await db
        .select({ id: personsTable.id })
        .from(personsTable)
        .where(eq(personsTable.name, personName))
        .limit(1);

      if (existing.length > 0) {
        personId = existing[0].id;
      } else {
        const [inserted] = await db
          .insert(personsTable)
          .values({
            name: personName,
            source: "multi_source_ingestion",
            notes: `Auto-enrolled via OSINT news/wayback CDNs (Organization: ${organization || "N/A"})`,
          })
          .returning({ id: personsTable.id });
        personId = inserted?.id;
      }

      if (!personId) {
        throw new Error(`Failed to resolve valid personId for ${personName}`);
      }

      // 2. Insert embedding with unified metadata (Job title, organization, source)
      await db.insert(faceEmbeddingsTable).values({
        personId,
        embedding: faceEmbedding,
        imageUrl: sourceUrl,
        confidence: confidenceScore,
        qualityScore: 0.90,
        algorithmVersion: "v5-multisource-ingest",
        emotions: {
          jobTitle: jobTitle || "Unspecified",
          organization: organization || "Unspecified"
        }
      });
    }, () => null);

    return !isDegraded;
  }
}

export function createIngestCoordinator(): MultiSourceIngestCoordinator {
  return new MultiSourceIngestCoordinator();
}
