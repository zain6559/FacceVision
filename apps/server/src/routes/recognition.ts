import { Router } from "express";
import { db, faceEmbeddingsTable, personsTable, recognitionLogsTable, safeDbQuery } from "@workspace/db";
import { eq, desc, count, sql, cosineDistance, inArray } from "drizzle-orm";
import { IdentifyFaceBody, ListRecognitionLogsQueryParams } from "@workspace/api-zod";
import { processImageMulti, computeMatchScore, extractEmbedding, ALGORITHM_WEIGHTS } from "../lib/faceRecognition.js";
import sharp from "sharp";
import { LRUCache } from "lru-cache";
import { createHash } from "crypto";
import { optionalApiKey } from "../middleware/auth.js";
import { sanitizeInputs, sanitizeString, escapeSqlWildcards } from "../middleware/sanitize.js";

const router = Router();

// Apply input sanitization and optional API key authentication
router.use(sanitizeInputs);
router.use(optionalApiKey);

// ═══════════════════════════════════════════════════════════════════════
// High-Performance LRU Cache — Eliminates redundant vector searches
// Inspired by CompreFace's caching layer for repeated face queries.
// ═══════════════════════════════════════════════════════════════════════

type CachedCandidate = {
  id: number;
  personId: number;
  embedding: number[];
  clbpEmbedding: number[] | null;
  lbpEmbedding: number[] | null;
  hogEmbedding: number[] | null;
  lpqEmbedding: number[] | null;
  dctEmbedding: number[] | null;
};

const vectorSearchCache = new LRUCache<string, CachedCandidate[]>({
  max: 5000,
  ttl: 60_000,                  // 60 seconds TTL
  allowStale: true,             // Serve stale while refreshing
  updateAgeOnGet: true,         // Reset TTL on cache hit
  updateAgeOnHas: false,
});

// Person data cache — avoids repeated person lookups for the same IDs
type CachedPerson = {
  id: number;
  name: string;
  nameAr: string | null;
  source: string;
  thumbnailUrl: string | null;
  notes: string | null;
  tenantId: string;
  createdAt: Date;
  faceCount: number;
};

const personDataCache = new LRUCache<number, CachedPerson>({
  max: 10000,
  ttl: 120_000,                 // 2 minutes TTL
  allowStale: true,
  updateAgeOnGet: true,
});

/**
 * Generate a cache key from an embedding vector.
 * Uses SHA-256 of the Float32 binary representation for speed + collision resistance.
 */
function embeddingCacheKey(embedding: number[]): string {
  const buf = Buffer.from(new Float32Array(embedding).buffer);
  return createHash("sha256").update(buf).digest("hex").slice(0, 32);
}

/**
 * Invalidate all caches (called when new faces are enrolled).
 */
export function invalidateRecognitionCaches(): void {
  vectorSearchCache.clear();
  personDataCache.clear();
}

/**
 * Set pgvector HNSW ef_search for optimal recall at query time.
 */
async function setSearchParameters(): Promise<void> {
  try {
    await db.execute(sql`SET hnsw.ef_search = 200`);
  } catch {
    // Silently ignore if connection doesn't support SET (e.g., Neon serverless)
  }
}

// Warm up search parameters on module load
setSearchParameters().catch(() => {});

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const UA = "FaceVisionResearch/4.0 (academic; contact@facevision.ai)";

async function fetchWithTimeout(url: string, options: any = {}, timeout = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function dbRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 500): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const backoff = delayMs * Math.pow(1.5, i) + Math.random() * 300;
      console.warn(`Database query failed (attempt ${i + 1}/${retries}), retrying in ${Math.round(backoff)}ms...`, err);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastError;
}

async function fetchWikipediaData(wikiTitle: string) {
  try {
    const cleanTitle = sanitizeString(wikiTitle);
    const url = `${WIKI_API}?action=query&titles=${encodeURIComponent(cleanTitle)}&prop=pageimages|langlinks&lllang=ar&format=json&pithumbsize=500&redirects=1`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const data: any = await res.json();
    const pages = data?.query?.pages ?? {};
    const page: any = Object.values(pages)[0];
    const thumbUrl = page?.thumbnail?.source ?? null;
    const nameAr = page?.langlinks?.[0]?.["*"] ?? null;
    return { thumbUrl, nameAr };
  } catch {
    return null;
  }
}

async function imageUrlToBase64(imageUrl: string) {
  try {
    const res = await fetchWithTimeout(imageUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

async function fetchBingImage(name: string): Promise<string | null> {
  try {
    const cleanName = sanitizeString(name);
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(cleanName + " portrait")}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const matches = html.match(/murl&quot;:&quot;(http[^&]+)&quot;/);
    if (matches) {
      return decodeURIComponent(matches[1]);
    }
  } catch (err) {
    console.error("Bing Image Scraping Error:", err);
  }
  return null;
}

let activeLiveSearches = 0;
const MAX_CONCURRENT_LIVE_SEARCHES = 2;

async function performLiveSearch(imageBase64: string): Promise<number[]> {
  if (activeLiveSearches >= MAX_CONCURRENT_LIVE_SEARCHES) {
    console.warn("[Live Search] High concurrency throttle: Skipping web search fallback to maintain low latency.");
    return [];
  }

  activeLiveSearches++;
  try {
    const raw = imageBase64.replace(/^data:image\/[a-z+]+;base64,/, "");
    const blob = new Blob([Buffer.from(raw, "base64")], { type: "image/jpeg" });
    const fd = new FormData();
    fd.append('file', blob, 'face.jpg');

    const uploadRes = await fetchWithTimeout('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: fd
    }, 10000).then(r => r.json() as any);

    if (!uploadRes?.data?.url) return [];
    const directUrl = uploadRes.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');

    const lensRes = await fetchWithTimeout('https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(directUrl), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, 10000).then(r => r.text());

    // 1. Scrape Wikipedia slugs directly as Priority 1
    const wikiMatches = lensRes.match(/wikipedia\.org\/wiki\/([^"'\s\\&]+)/g);
    let candidateNames: string[] = [];

    if (wikiMatches) {
      candidateNames = wikiMatches.map(m => {
        const parts = m.split('/wiki/');
        return parts[1] ? sanitizeString(decodeURIComponent(parts[1]).replace(/_/g, " ")) : "";
      }).filter(Boolean);
    }

    // 2. Scrape visual matches titles from all internet sources (Priority 2)
    const titleMatches = [...lensRes.matchAll(/"title"\s*:\s*"([^"]+)"/g)].map(m => m[1]);

    const isSocialTitle = (t: string) => {
      return /instagram|facebook|linkedin|twitter|\bX\b|tiktok|@/i.test(t);
    };

    const cleanTitle = (t: string) => {
      return sanitizeString(t
        .replace(/ - Wikipedia/gi, "")
        .replace(/ - IMDb/gi, "")
        .replace(/ - Biography/gi, "")
        .replace(/[\|\-\:\·].*$/g, "")
        .trim());
    };

    const extractSocialName = (t: string) => {
      return sanitizeString(t
        .replace(/\(.*?\)/g, "")
        .replace(/• Instagram.*/gi, "")
        .replace(/\| LinkedIn.*/gi, "")
        .replace(/\/ X.*/gi, "")
        .replace(/\| Facebook.*/gi, "")
        .replace(/\| Twitter.*/gi, "")
        .replace(/on TikTok.*/gi, "")
        .replace(/[\|\-\:\·\•].*$/g, "")
        .trim());
    };

    const socialCounts: Record<string, number> = {};
    const generalCounts: Record<string, number> = {};

    for (const rawTitle of titleMatches) {
      if (isSocialTitle(rawTitle)) {
        const name = extractSocialName(rawTitle);
        const wordCount = name.split(/\s+/).length;
        if (wordCount >= 2 && wordCount <= 4 && !/^[0-9]+$/.test(name)) {
          socialCounts[name] = (socialCounts[name] || 0) + 1;
        }
      } else {
        const name = cleanTitle(rawTitle);
        const wordCount = name.split(/\s+/).length;
        if (wordCount >= 2 && wordCount <= 4 && !/^[0-9]+$/.test(name)) {
          generalCounts[name] = (generalCounts[name] || 0) + 1;
        }
      }
    }

    const sortedSocialNames = Object.entries(socialCounts)
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);

    const sortedGeneralNames = Object.entries(generalCounts)
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);

    // Merge candidates: Wiki first, then Social Media matches, then general web matches
    const allCandidates = [...new Set([...candidateNames, ...sortedSocialNames, ...sortedGeneralNames])].slice(0, 5);

    const enrolledIds: number[] = [];
    for (const name of allCandidates) {
      const existing = await db.select().from(personsTable).where(eq(personsTable.name, name)).limit(1);
      if (existing.length > 0) {
        enrolledIds.push(existing[0].id);
        continue;
      }

      // 1. Try Wikipedia details
      let portraitUrl: string | null = null;
      let nameAr: string | null = null;
      const wikiData = await fetchWikipediaData(name.replace(/ /g, "_"));
      if (wikiData?.thumbUrl) {
        portraitUrl = wikiData.thumbUrl;
        nameAr = wikiData.nameAr;
      } else {
        // 2. Fallback to Bing Image Search
        portraitUrl = await fetchBingImage(name);
      }

      if (portraitUrl) {
        const base64 = await imageUrlToBase64(portraitUrl);
        if (base64) {
          const [newPerson] = await dbRetry(() => db.insert(personsTable).values({
            name,
            nameAr,
            source: "live_search"
          }).returning());

          const result = await extractEmbedding(base64);
          if (result) {
            await dbRetry(() => db.insert(faceEmbeddingsTable).values({
              personId:         newPerson.id,
              embedding:        result.embedding,
              clbpEmbedding:    result.clbpEmbedding,
              lbpEmbedding:     result.lbpEmbedding,
              hogEmbedding:     result.hogEmbedding,
              lpqEmbedding:     result.lpqEmbedding,
              dctEmbedding:     result.dctEmbedding,
              confidence:       result.qualityScore,
              qualityScore:     result.qualityScore,
              algorithmVersion: result.algorithmVersion,
              age:              result.age,
              gender:           result.gender,
              emotions:         result.emotions,
            }));
          }
          enrolledIds.push(newPerson.id);
        }
      }
    }
    return enrolledIds;
  } catch (err) {
    console.error("Live Search Fallback Error:", err);
    return [];
  } finally {
    activeLiveSearches = Math.max(0, activeLiveSearches - 1);
  }
}

// Helper to dynamically enroll by name
async function enrollByName(name: string): Promise<number | null> {
  try {
    const cleanName = sanitizeString(name);
    const existing = await db.select().from(personsTable).where(eq(personsTable.name, cleanName)).limit(1);
    if (existing.length > 0) return existing[0].id;

    let portraitUrl: string | null = null;
    let nameAr: string | null = null;

    const wikiData = await fetchWikipediaData(cleanName.replace(/ /g, "_"));
    if (wikiData?.thumbUrl) {
      portraitUrl = wikiData.thumbUrl;
      nameAr = wikiData.nameAr;
    } else {
      portraitUrl = await fetchBingImage(cleanName);
    }

    if (portraitUrl) {
      const base64 = await imageUrlToBase64(portraitUrl);
      if (base64) {
        const [newPerson] = await dbRetry(() => db.insert(personsTable).values({
          name: cleanName,
          nameAr,
          source: "name_search"
        }).returning());

        const result = await extractEmbedding(base64);
        if (result) {
          await dbRetry(() => db.insert(faceEmbeddingsTable).values({
            personId:         newPerson.id,
            embedding:        result.embedding,
            clbpEmbedding:    result.clbpEmbedding,
            lbpEmbedding:     result.lbpEmbedding,
            hogEmbedding:     result.hogEmbedding,
            lpqEmbedding:     result.lpqEmbedding,
            dctEmbedding:     result.dctEmbedding,
            confidence:       result.qualityScore,
            qualityScore:     result.qualityScore,
            algorithmVersion: result.algorithmVersion,
            age:              result.age,
            gender:           result.gender,
            emotions:         result.emotions,
          }));
        }
        return newPerson.id;
      }
    }
  } catch (err) {
    console.error("Direct Name Enrollment Error:", err);
  }
  return null;
}

router.post("/identify", async (req, res) => {
  try {
    const parsed = IdentifyFaceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { imageBase64, threshold = 0.68 } = parsed.data;
    const rawNameFilter = req.body.name ? String(req.body.name) : undefined;
    const nameFilter = rawNameFilter ? sanitizeString(rawNameFilter) : undefined;
    const startTime = Date.now();

    const queryResults = await processImageMulti(imageBase64, "v5");
    const processingTimeMs = Date.now() - startTime;

    if (!queryResults || queryResults.length === 0) {
      // Non-blocking fire-and-forget logging
      safeDbQuery(
        () => db.insert(recognitionLogsTable).values({
          recognized: 0, processingTimeMs,
          algorithmVersion: "v5", qualityScore: 0,
        }),
        () => null
      ).catch(() => {});

      res.status(400).json({
        error: "No face detected in the image",
        errorCode: "NO_FACE_DETECTED",
        recognized: false,
        matched: false,
        candidates: [],
        processingTimeMs,
        facesDetected: 0,
        logId: null
      });
      return;
    }

    type ScoreEntry = {
      personId: number;
      similarity: number;
      algorithmScores: ReturnType<typeof computeMatchScore>["algorithmScores"];
    };

    const faces: any[] = [];
    let bestOverallFace: any = null;

    for (const queryResult of queryResults) {
      // Quality gate — dynamic calibration for low quality images to prevent false positives
      const qualityPenalty = Math.max(0, (0.5 - queryResult.qualityScore) * 0.3);
      const calibratedThreshold = Math.min(0.95, threshold + qualityPenalty);

      // Filter by name if provided (sanitized and SQL-escaped)
      const escapedFilter = nameFilter ? escapeSqlWildcards(nameFilter) : undefined;
      let whereClause = escapedFilter
        ? sql`${faceEmbeddingsTable.personId} IN (SELECT id FROM persons WHERE name ILIKE ${'%' + escapedFilter + '%'} OR name_ar ILIKE ${'%' + escapedFilter + '%'})`
        : undefined;

      // ═══════════════════════════════════════════════════════════════
      // Vector Search Phase 1: Cache-First HNSW Retrieval
      // Check the LRU cache before hitting pgvector.
      // ═══════════════════════════════════════════════════════════════
      const cacheKey = embeddingCacheKey(queryResult.embedding) + (nameFilter ? `:${nameFilter}` : "");
      let topCandidates: CachedCandidate[];
      const cached = vectorSearchCache.get(cacheKey);

      if (cached) {
        topCandidates = cached;
      } else {
        await setSearchParameters();

        const simScore = sql<number>`1 - (${cosineDistance(faceEmbeddingsTable.embedding, queryResult.embedding)})`;
        const dbResults = await db
          .select({
            id:            faceEmbeddingsTable.id,
            personId:      faceEmbeddingsTable.personId,
            embedding:     faceEmbeddingsTable.embedding,
            clbpEmbedding: faceEmbeddingsTable.clbpEmbedding,
            lbpEmbedding:  faceEmbeddingsTable.lbpEmbedding,
            hogEmbedding:  faceEmbeddingsTable.hogEmbedding,
            lpqEmbedding:  faceEmbeddingsTable.lpqEmbedding,
            dctEmbedding:  faceEmbeddingsTable.dctEmbedding,
          })
          .from(faceEmbeddingsTable)
          .where(whereClause)
          .orderBy(desc(simScore))
          .limit(100);

        topCandidates = dbResults.map(row => ({
          id: row.id,
          personId: row.personId,
          embedding: row.embedding as number[],
          clbpEmbedding: row.clbpEmbedding as number[] | null,
          lbpEmbedding: row.lbpEmbedding as number[] | null,
          hogEmbedding: row.hogEmbedding as number[] | null,
          lpqEmbedding: row.lpqEmbedding as number[] | null,
          dctEmbedding: row.dctEmbedding as number[] | null,
        }));
        vectorSearchCache.set(cacheKey, topCandidates);
      }

      // Phase 2: Precise Weighted Re-ranking in Memory
      let scores: ScoreEntry[] = [];
      const runReRanking = (candidates: typeof topCandidates) => {
        scores = [];
        for (const row of candidates) {
          const match = computeMatchScore(queryResult, {
            embedding:     row.embedding as number[],
            clbpEmbedding: row.clbpEmbedding as number[] | null,
            lbpEmbedding:  row.lbpEmbedding  as number[] | null,
            hogEmbedding:  row.hogEmbedding  as number[] | null,
            lpqEmbedding:  row.lpqEmbedding  as number[] | null,
            dctEmbedding:  row.dctEmbedding  as number[] | null,
          });
          scores.push({ personId: row.personId, ...match });
        }
      };

      runReRanking(topCandidates);

      let personBest = new Map<number, ScoreEntry>();
      for (const s of scores) {
        const prev = personBest.get(s.personId);
        if (!prev || s.similarity > prev.similarity) personBest.set(s.personId, s);
      }

      let topEntries = [...personBest.values()]
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      // Dynamic Live Web Search Fallback if no match or match is below threshold
      const bestMatchScore = topEntries[0]?.similarity ?? 0;
      const liveEnrolledIds: number[] = [];

      if (bestMatchScore < calibratedThreshold && queryResult.qualityScore > 0.15) {
        if (nameFilter) {
          console.log(`No local match for search filter name "${nameFilter}". Attempting direct Wiki enrollment fallback...`);
          const enrolledId = await enrollByName(nameFilter);
          if (enrolledId) liveEnrolledIds.push(enrolledId);
        }

        if (liveEnrolledIds.length === 0) {
          console.log("No high confidence local match found. Initiating Google Lens Visual Search fallback...");
          const lensIds = await performLiveSearch(imageBase64);
          liveEnrolledIds.push(...lensIds);
        }

        if (liveEnrolledIds.length > 0) {
          const freshCandidates = await db
            .select({
              id:            faceEmbeddingsTable.id,
              personId:      faceEmbeddingsTable.personId,
              embedding:     faceEmbeddingsTable.embedding,
              clbpEmbedding: faceEmbeddingsTable.clbpEmbedding,
              lbpEmbedding:  faceEmbeddingsTable.lbpEmbedding,
              hogEmbedding:  faceEmbeddingsTable.hogEmbedding,
              lpqEmbedding:  faceEmbeddingsTable.lpqEmbedding,
              dctEmbedding:  faceEmbeddingsTable.dctEmbedding,
            })
            .from(faceEmbeddingsTable)
            .where(inArray(faceEmbeddingsTable.personId, liveEnrolledIds));

          const formattedCandidates = freshCandidates.map(row => ({
            id: row.id,
            personId: row.personId,
            embedding: row.embedding as number[],
            clbpEmbedding: row.clbpEmbedding as number[] | null,
            lbpEmbedding:  row.lbpEmbedding  as number[] | null,
            hogEmbedding:  row.hogEmbedding  as number[] | null,
            lpqEmbedding:  row.lpqEmbedding  as number[] | null,
            dctEmbedding:  row.dctEmbedding  as number[] | null,
          }));

          runReRanking(formattedCandidates);

          for (const s of scores) {
            const prev = personBest.get(s.personId);
            if (!prev || s.similarity > prev.similarity) personBest.set(s.personId, s);
          }

          topEntries = [...personBest.values()]
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5);
        }
      }

      if (topEntries.length === 0) {
        faces.push({ recognized: false, matched: false, candidates: [], qualityScore: queryResult.qualityScore });
        continue;
      }

      const uniquePersonIds = [...new Set(topEntries.map(e => e.personId))];
      const cachedPersons = new Map<number, CachedPerson>();
      const uncachedIds: number[] = [];

      for (const pid of uniquePersonIds) {
        const cached = personDataCache.get(pid);
        if (cached) {
          cachedPersons.set(pid, cached);
        } else {
          uncachedIds.push(pid);
        }
      }

      if (uncachedIds.length > 0) {
        const [freshPersons, faceCounts] = await Promise.all([
          db.select().from(personsTable).where(inArray(personsTable.id, uncachedIds)),
          db.select({
            personId: faceEmbeddingsTable.personId,
            cnt: count(),
          }).from(faceEmbeddingsTable)
            .where(inArray(faceEmbeddingsTable.personId, uncachedIds))
            .groupBy(faceEmbeddingsTable.personId),
        ]);

        const countMap = new Map(faceCounts.map(fc => [fc.personId, fc.cnt]));

        for (const p of freshPersons) {
          const entry: CachedPerson = {
            ...p,
            faceCount: countMap.get(p.id) ?? 0,
          };
          personDataCache.set(p.id, entry);
          cachedPersons.set(p.id, entry);
        }
      }

      const rawCandidates = topEntries.map((entry) => {
        const person = cachedPersons.get(entry.personId);
        return person ? {
          person: { ...person },
          name: person.name,
          confidence: entry.similarity,
          similarity: entry.similarity,
          distance: 1 - entry.similarity,
          algorithmScores: entry.algorithmScores,
        } : null;
      });

      const candidates = rawCandidates.filter(Boolean) as NonNullable<(typeof rawCandidates)[number]>[];
      const bestMatch = candidates[0];
      const recognized = bestMatch?.confidence >= calibratedThreshold;

      const faceResult = {
        recognized,
        matched: recognized,
        candidates,
        bestMatch: recognized ? bestMatch : undefined,
        qualityScore: queryResult.qualityScore,
        calibratedThreshold,
        age: queryResult.age,
        gender: queryResult.gender,
        emotions: queryResult.emotions,
        livenessScore: queryResult.livenessScore,
        isSpoof: queryResult.isSpoof,
        box: queryResult.box,
        algorithmVersion: queryResult.algorithmVersion
      };
      faces.push(faceResult);

      if (!bestOverallFace || (bestMatch?.confidence > (bestOverallFace.bestMatch?.confidence ?? 0))) {
        bestOverallFace = faceResult;
      }
    }

    if (!bestOverallFace) {
      bestOverallFace = { recognized: false, matched: false, candidates: [], bestMatch: undefined, qualityScore: 0, algorithmVersion: "v5" } as any;
    }

    let logId: number | null = null;
    safeDbQuery(
      async () => {
        const [inserted] = await db
          .insert(recognitionLogsTable)
          .values({
            personId:         bestOverallFace.recognized ? bestOverallFace.bestMatch.person.id : null,
            confidence:       bestOverallFace.bestMatch?.confidence ?? null,
            recognized:       bestOverallFace.recognized ? 1 : 0,
            processingTimeMs,
            algorithmVersion: bestOverallFace.algorithmVersion,
            qualityScore:     bestOverallFace.qualityScore,
          })
          .returning();
        logId = inserted?.id ?? null;
        return inserted;
      },
      () => null
    ).catch(() => {});

    let annotatedImageBase64: string | null = null;
    try {
      const raw = imageBase64.replace(/^data:image\/[a-z+]+;base64,/, "");
      const imageBuffer = Buffer.from(raw, "base64");
      const metadata = await sharp(imageBuffer).metadata();
      const w = metadata.width ?? 0;
      const h = metadata.height ?? 0;

      if (w > 0 && h > 0 && faces.length > 0) {
        const svgElements: string[] = [];
        for (const face of faces) {
          if (!face.box) continue;
          const [fx, fy, fw, fh] = face.box;

          const strokeColor = face.isSpoof ? "#ff3333" : "#00ffcc";
          svgElements.push(`<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="none" stroke="${strokeColor}" stroke-width="3" rx="4"/>`);

          const labelY = Math.max(16, fy - 6);
          const rawName = face.recognized ? face.bestMatch.person.name : "Unknown";
          const nameText = sanitizeString(rawName);
          const livenessText = face.isSpoof ? "SPOOF DETECTED" : "LIVE";
          const labelText = `${nameText} (${face.age ? Math.round(face.age) : "?"}y, ${face.gender ?? "?"}) [${livenessText}]`;
          const labelWidth = labelText.length * 6.5 + 12;

          svgElements.push(`
            <rect x="${fx}" y="${labelY - 16}" width="${labelWidth}" height="20" fill="#111" opacity="0.85" rx="3"/>
            <text x="${fx + 6}" y="${labelY - 2}" fill="${strokeColor}" font-family="monospace, sans-serif" font-size="11" font-weight="bold">${labelText}</text>
          `);
        }

        if (svgElements.length > 0) {
          const svgString = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${svgElements.join("")}</svg>`;
          const annotatedBuffer = await sharp(imageBuffer)
            .composite([{ input: Buffer.from(svgString), blend: 'over' }])
            .toBuffer();

          const mime = metadata.format ? `image/${metadata.format}` : "image/jpeg";
          annotatedImageBase64 = `data:${mime};base64,${annotatedBuffer.toString("base64")}`;
        }
      }
    } catch (annotErr) {
      console.error("Failed to generate annotated overlay image:", annotErr);
    }

    res.json({
      recognized: bestOverallFace.recognized,
      matched: bestOverallFace.recognized,
      candidates: bestOverallFace.candidates,
      bestMatch: bestOverallFace.bestMatch,
      processingTimeMs,
      facesDetected: queryResults.length,
      qualityScore: bestOverallFace.qualityScore,
      isSpoof: bestOverallFace.isSpoof,
      livenessScore: bestOverallFace.livenessScore,
      algorithmWeights: ALGORITHM_WEIGHTS,
      algorithmVersion: bestOverallFace.algorithmVersion,
      totalDims: 576,
      logId: logId ?? null,
      allFaces: faces,
      annotatedImageBase64
    });
  } catch (err: any) {
    console.error("POST /recognition/identify error:", err);
    res.status(500).json({ error: "Recognition failed", details: err?.message });
  }
});

// GET /recognition/logs
router.get("/logs", async (req, res) => {
  try {
    const parsed = ListRecognitionLogsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const limit = Math.min(Math.max(1, parsed.data.limit ?? 50), 500);

    const logs = await db
      .select({
        id:               recognitionLogsTable.id,
        personId:         recognitionLogsTable.personId,
        personName:       personsTable.name,
        confidence:       recognitionLogsTable.confidence,
        recognized:       recognitionLogsTable.recognized,
        processingTimeMs: recognitionLogsTable.processingTimeMs,
        algorithmVersion: recognitionLogsTable.algorithmVersion,
        qualityScore:     recognitionLogsTable.qualityScore,
        createdAt:        recognitionLogsTable.createdAt,
      })
      .from(recognitionLogsTable)
      .leftJoin(personsTable, eq(recognitionLogsTable.personId, personsTable.id))
      .orderBy(desc(recognitionLogsTable.createdAt))
      .limit(limit);

    res.json(logs.map(l => ({ ...l, recognized: l.recognized === 1 })));
  } catch (err: any) {
    console.error("GET /recognition/logs error:", err);
    res.status(500).json({ error: "Failed to list recognition logs", details: err?.message });
  }
});

export default router;
