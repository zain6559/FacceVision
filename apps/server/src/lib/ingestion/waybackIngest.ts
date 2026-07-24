import fetch from "node-fetch";

export interface WaybackArchiveAsset {
  originalUrl: string;
  archiveUrl: string;
  timestamp: string;
  mimeType: string;
  digest: string;
}

/**
 * Resilient Wayback Machine CDX API Connector (v5.0+ Production-Grade Ingestion)
 *
 * Features:
 * 1. Temporal CDX Chunking: Queries the index in separate year/month slices to prevent timeouts.
 * 2. MD5 / Content Digest Deduplication: Excludes redundant files prior to downloading.
 * 3. Exponential Backoff Retries: Gracefully recovers from Wayback API connection throttles.
 */
export class WaybackIngest {
  private cdxBaseUrl = "https://web.archive.org/cdx/search/cdx";

  /**
   * Queries the Wayback Machine CDX server using temporal chunking and backoff retries
   */
  public async queryArchivedAssets(domain: string, limit = 50): Promise<WaybackArchiveAsset[]> {
    const assets: WaybackArchiveAsset[] = [];
    const seenDigests = new Set<string>();

    // 1. Temporal Chunking: Querying past years in distinct chunks (e.g. 2022 to 2026)
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 3; // Query past 3 years

    console.log(`[Wayback Ingest] Commencing temporal CDX chunking from ${startYear} to ${currentYear} for domain: ${domain}`);

    for (let year = startYear; year <= currentYear; year++) {
      const fromTimestamp = `${year}0101000000`;
      const toTimestamp = `${year}1231235959`;

      const queryUrl = `${this.cdxBaseUrl}?url=${encodeURIComponent(domain)}&matchType=domain&output=json&limit=${Math.ceil(limit / 3)}&from=${fromTimestamp}&to=${toTimestamp}&collapse=digest`;

      try {
        const rawData = await this.fetchWithExponentialBackoff(queryUrl);
        if (!rawData || rawData.length <= 1) {
          continue;
        }

        const headers = rawData[0];
        const urlIndex = headers.indexOf("original");
        const timestampIndex = headers.indexOf("timestamp");
        const mimeIndex = headers.indexOf("mimetype");
        const digestIndex = headers.indexOf("digest");

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          const originalUrl = row[urlIndex];
          const timestamp = row[timestampIndex];
          const mimeType = row[mimeIndex] || "";
          const digest = row[digestIndex] || `hash_${originalUrl}`;

          // Filter only for image assets
          const isImage = mimeType.startsWith("image/") ||
                          originalUrl.endsWith(".jpg") ||
                          originalUrl.endsWith(".jpeg") ||
                          originalUrl.endsWith(".png") ||
                          originalUrl.endsWith(".webp");

          // Deduplication: prevent adding duplicates of identical contents (same digest)
          if (isImage && originalUrl && timestamp && !seenDigests.has(digest)) {
            seenDigests.add(digest);
            const archiveUrl = `https://web.archive.org/web/${timestamp}/${originalUrl}`;
            assets.push({
              originalUrl,
              archiveUrl,
              timestamp,
              mimeType,
              digest
            });
          }
        }

        if (assets.length >= limit) {
          break;
        }
      } catch (err: any) {
        console.error(`[Wayback Ingest] Failed temporal CDX slice for year ${year}:`, err?.message || err);
      }
    }

    return assets.slice(0, limit);
  }

  /**
   * Resilient HTTP fetch wrapper with Exponential Backoff
   */
  private async fetchWithExponentialBackoff(url: string, retries = 3, delay = 1000): Promise<string[][] | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 Face-Intelligence-Wayback-CDX-Production-v5.0" },
          timeout: 10000
        });

        if (response.ok) {
          return await response.json() as string[][];
        }

        if (response.status === 429 || response.status >= 500) {
          const backoff = delay * Math.pow(1.5, attempt - 1);
          console.warn(`[Wayback Ingest] CDX Server throttled (HTTP ${response.status}). Retrying attempt ${attempt}/${retries} in ${Math.round(backoff)}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
        } else {
          // Reject immediately on 400 Bad Request or 404
          throw new Error(`Wayback CDX API responded with irreversible status ${response.status}`);
        }
      } catch (err: any) {
        if (attempt === retries) {
          throw err;
        }
        const backoff = delay * Math.pow(1.5, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
    return null;
  }
}
