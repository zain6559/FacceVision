import { WaybackIngest, WaybackArchiveAsset } from "./waybackIngest.js";

export interface BreachRecordMetadata {
  name: string;
  username: string;
  sourceLeakId: string;
  jobTitle?: string;
  organization?: string;
  leakedPasswordHash?: string;
}

export interface IngestedBreachFaceAsset {
  originalUrl: string;
  archiveUrl: string;
  timestamp: string;
  meta: BreachRecordMetadata;
}

/**
 * Wayback & Breach Archival Ingest Worker (v4.5 Sovereign Ingest Core)
 *
 * Extracts historical avatar images from CDX records and correlates them directly
 * with compromised credential leaks, user handles, and relational intelligence databases.
 */
export class WaybackBreachIngest {
  private wayback = new WaybackIngest();

  /**
   * Queries historical assets and maps them with active breach records
   */
  public async harvestBreachAvatars(
    domain: string,
    breachMetadata: BreachRecordMetadata,
    limit = 20
  ): Promise<IngestedBreachFaceAsset[]> {
    console.log(`[Breach Ingest] Commencing historical avatar harvest for username: ${breachMetadata.username} on domain: ${domain}`);

    // Query Wayback CDX index for user profile picture sub-routes
    const targetQuery = `${domain}/${breachMetadata.username}/*`;
    const historicalAssets = await this.wayback.queryArchivedAssets(targetQuery, limit);

    return historicalAssets.map((asset: WaybackArchiveAsset) => ({
      originalUrl: asset.originalUrl,
      archiveUrl: asset.archiveUrl,
      timestamp: asset.timestamp,
      meta: breachMetadata
    }));
  }
}
