import fetch from "node-fetch";

export interface ExtractedCdnAsset {
  mediaUrl: string;
  originalFileName: string;
  detectedAt: string;
  inMemoryBuffer: Buffer;
}

/**
 * Image-CDN & WordPress Media Scraper (v4.5 Sovereign Ingest Core)
 *
 * Streams target media assets directly into memory buffers, avoiding disk writes,
 * and extracts faces via on-the-fly streaming to facial embedding channels.
 */
export class CdnScraper {
  private userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15"
  ];

  /**
   * Scans a target web domain or directory index, extracting image URLs matching CDN patterns
   */
  public async scanCdnDirectory(url: string, htmlOverride?: string): Promise<string[]> {
    const images: string[] = [];
    let html = htmlOverride || "";

    if (!htmlOverride) {
      try {
        const uAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
        const res = await fetch(url, {
          headers: { "User-Agent": uAgent },
          timeout: 8000
        });
        if (res.ok) {
          html = await res.text();
        }
      } catch (err) {
        console.error(`[CDN Scraper] Directory scan failed on ${url}:`, err);
        return [];
      }
    }

    // Matches standard CDN paths, WordPress uploads, and generic image files
    const cdnPattern = /(?:href|src)=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"']*)?)["']/gi;
    let match;

    while ((match = cdnPattern.exec(html)) !== null) {
      let matchedUrl = match[1];

      // Resolve relative paths to absolute URLs
      if (matchedUrl.startsWith("/")) {
        try {
          const parsedRoot = new URL(url);
          matchedUrl = `${parsedRoot.protocol}//${parsedRoot.host}${matchedUrl}`;
        } catch {
          // Skip malformed domains
        }
      } else if (!matchedUrl.startsWith("http")) {
        matchedUrl = `${url.replace(/\/?$/, "/")}${matchedUrl}`;
      }

      if (matchedUrl.startsWith("http") && !images.includes(matchedUrl)) {
        images.push(matchedUrl);
      }
    }

    return images;
  }

  /**
   * Downloads an image directly into an in-memory buffer, bypassing the local disk completely
   */
  public async streamAssetToMemory(mediaUrl: string): Promise<ExtractedCdnAsset | null> {
    try {
      const uAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
      const response = await fetch(mediaUrl, {
        headers: { "User-Agent": uAgent },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Asset streaming failed with status ${response.status}`);
      }

      const inMemoryBuffer = await response.buffer();
      const parsedPath = new URL(mediaUrl).pathname;
      const originalFileName = parsedPath.split("/").pop() || "asset.png";

      return {
        mediaUrl,
        originalFileName,
        detectedAt: new Date().toISOString(),
        inMemoryBuffer
      };
    } catch (err: any) {
      console.error(`[CDN Scraper] Memory stream failed for ${mediaUrl}:`, err?.message || err);
      return null;
    }
  }
}
