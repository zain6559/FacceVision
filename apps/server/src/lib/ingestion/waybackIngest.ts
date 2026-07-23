import fetch from "node-fetch";

export interface WaybackArchiveAsset {
  originalUrl: string;
  archiveUrl: string;
  timestamp: string;
  mimeType: string;
}

/**
 * Wayback Machine CDX API Connector (v3.5 OSINT Core)
 *
 * Queries the Internet Archive's Wayback Machine CDX Server to extract
 * historical page captures, profile pictures, and avatars associated with a domain.
 */
export class WaybackIngest {
  private cdxBaseUrl = "https://web.archive.org/cdx/search/cdx";

  /**
   * Queries the Wayback Machine for image assets of a target domain
   *
   * @param domain Target domain, e.g. "example.com" or "example.com/profiles/*"
   * @param limit Maximum number of historical captures to fetch
   */
  public async queryArchivedAssets(domain: string, limit = 50): Promise<WaybackArchiveAsset[]> {
    const queryUrl = `${this.cdxBaseUrl}?url=${encodeURIComponent(domain)}&matchType=domain&output=json&limit=${limit}&collapse=urlkey`;

    try {
      const response = await fetch(queryUrl, {
        headers: { "User-Agent": "Mozilla/5.0 Face-Intelligence-Wayback-Ingestion-v3.5" },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Wayback CDX API responded with status ${response.status}`);
      }

      const rawData = await response.json() as string[][];
      if (!rawData || rawData.length <= 1) {
        return [];
      }

      // The first row of CDX response is the headers list, e.g., ["urlkey", "timestamp", "original", "mimetype", "statuscode", "digest", "length"]
      const headers = rawData[0];
      const urlIndex = headers.indexOf("original");
      const timestampIndex = headers.indexOf("timestamp");
      const mimeIndex = headers.indexOf("mimetype");

      const assets: WaybackArchiveAsset[] = [];

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const originalUrl = row[urlIndex];
        const timestamp = row[timestampIndex];
        const mimeType = row[mimeIndex] || "";

        // Filter only for image assets to avoid wasting processing power on html/css/js
        const isImage = mimeType.startsWith("image/") ||
                        originalUrl.endsWith(".jpg") ||
                        originalUrl.endsWith(".jpeg") ||
                        originalUrl.endsWith(".png") ||
                        originalUrl.endsWith(".webp");

        if (isImage && originalUrl && timestamp) {
          // Construct the official wayback archive URL structure
          const archiveUrl = `https://web.archive.org/web/${timestamp}/${originalUrl}`;
          assets.push({
            originalUrl,
            archiveUrl,
            timestamp,
            mimeType
          });
        }
      }

      return assets;
    } catch (err: any) {
      console.error(`[Wayback Ingest] Failed to retrieve assets for ${domain}:`, err?.message || err);
      return [];
    }
  }
}
