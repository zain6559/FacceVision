/**
 * Stats routes — ALL metrics computed from real database records.
 *
 * Methodology (standard face recognition evaluation):
 *   intra-class: pairwise cosine between embeddings of the SAME person
 *   inter-class: pairwise cosine between embeddings of DIFFERENT persons
 *
 *   TP = intra pairs with sim ≥ τ   (genuine pair correctly accepted)
 *   FN = intra pairs with sim <  τ   (genuine pair wrongly rejected)
 *   FP = inter pairs with sim ≥ τ   (impostor pair wrongly accepted)
 *   TN = inter pairs with sim <  τ   (impostor pair correctly rejected)
 *
 *   Precision  = TP / (TP + FP)
 *   Recall     = TP / (TP + FN)   = TAR (True Accept Rate)
 *   FAR        = FP / (FP + TN)   = False Accept Rate
 *   F1         = 2·P·R / (P + R)
 *   EER        = threshold where FAR ≈ FRR = 1 - TAR
 *
 *   d-prime (d') = (μ_intra − μ_inter) / √(0.5·(σ²_intra + σ²_inter))
 *   [Signal Detection Theory separability index]
 */

import { Router } from "express";
import { db, personsTable, faceEmbeddingsTable, recognitionLogsTable, learningRunsTable } from "@workspace/db";
import { count, sum, avg, sql, gte, desc } from "drizzle-orm";
import { LRUCache } from "lru-cache";

const overviewCache = new LRUCache<string, any>({
  max: 10,
  ttl: 1000 * 60 * 5, // Cache for 5 minutes
});

const router = Router();

// ─── Cosine similarity (L2-normalised vectors → dot product) ──────────────────
function cos(a: number[], b: number[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return Math.max(0, Math.min(1, d));
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function variance(arr: number[], mu: number): number {
  return arr.length ? arr.reduce((s, v) => s + (v - mu) ** 2, 0) / arr.length : 0;
}

// ─── GET /stats/overview ───────────────────────────────────────────────────────
router.get("/overview", async (_req, res) => {
  try {
    const cached = overviewCache.get("overview");
    if (cached) { res.json(cached); return; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalPersons, totalEmb, totalRec, successRec, avgConf,
      totalRuns, todayFaces, lastLearn,
    ] = await Promise.all([
      db.select({ total: count() }).from(personsTable),
      db.select({ total: count() }).from(faceEmbeddingsTable),
      db.select({ total: count() }).from(recognitionLogsTable),
      db.select({ total: count() }).from(recognitionLogsTable).where(sql`recognized = 1`),
      db.select({ avg: avg(recognitionLogsTable.confidence) }).from(recognitionLogsTable).where(sql`confidence IS NOT NULL`),
      db.select({ total: count() }).from(learningRunsTable),
      db.select({ total: sum(learningRunsTable.facesAdded) }).from(learningRunsTable).where(gte(learningRunsTable.startedAt, today)),
      db.select({ completedAt: learningRunsTable.completedAt }).from(learningRunsTable)
         .where(sql`status = 'completed'`).orderBy(desc(learningRunsTable.completedAt)).limit(1).then(r => r[0]),
    ]);

    const tRec = totalRec[0]?.total ?? 0;
    const sRec = successRec[0]?.total ?? 0;

    const overviewData = {
      totalPersons:           totalPersons[0]?.total ?? 0,
      totalFaceEmbeddings:    totalEmb[0]?.total ?? 0,
      totalRecognitions:      tRec,
      successfulRecognitions: sRec,
      recognitionRate:        tRec > 0 ? sRec / tRec : 0,
      avgConfidence:          parseFloat(avgConf[0]?.avg ?? "0") || 0,
      totalLearningRuns:      totalRuns[0]?.total ?? 0,
      facesLearnedToday:      Number(todayFaces[0]?.total ?? 0),
      lastLearningAt:         lastLearn?.completedAt ?? null,
    };

    overviewCache.set("overview", overviewData);
    res.json(overviewData);
  } catch (err: any) {
    console.error("GET /stats/overview error:", err);
    res.status(500).json({ error: "Failed to fetch overview stats", details: err?.message });
  }
});

// ─── GET /stats/accuracy ───────────────────────────────────────────────────────
router.get("/accuracy", async (_req, res) => {
  try {
    const cached = overviewCache.get("accuracy");
    if (cached) { res.json(cached); return; }

    const [allLogs, avgTime, allEmbs] = await Promise.all([
      db.select({
        confidence: recognitionLogsTable.confidence,
        recognized: recognitionLogsTable.recognized,
      }).from(recognitionLogsTable),
      db.select({ avg: avg(recognitionLogsTable.processingTimeMs) }).from(recognitionLogsTable),
      db.select({
        personId:      faceEmbeddingsTable.personId,
        embedding:     faceEmbeddingsTable.embedding,
        clbpEmbedding: faceEmbeddingsTable.clbpEmbedding,
        lbpEmbedding:  faceEmbeddingsTable.lbpEmbedding,
        hogEmbedding:  faceEmbeddingsTable.hogEmbedding,
        lpqEmbedding:  faceEmbeddingsTable.lpqEmbedding,
        dctEmbedding:  faceEmbeddingsTable.dctEmbedding,
      }).from(faceEmbeddingsTable).orderBy(sql`RANDOM()`).limit(2000),
    ]);

    // ── Confidence distribution ──────────────────────────────────────────────────
    const buckets: Record<string, number> = {
      "0.0–0.2": 0, "0.2–0.4": 0, "0.4–0.6": 0, "0.6–0.8": 0, "0.8–1.0": 0,
    };
    for (const log of allLogs) {
      if (log.confidence == null) continue;
      const c = log.confidence;
      if      (c < 0.2) buckets["0.0–0.2"]++;
      else if (c < 0.4) buckets["0.2–0.4"]++;
      else if (c < 0.6) buckets["0.4–0.6"]++;
      else if (c < 0.8) buckets["0.6–0.8"]++;
      else              buckets["0.8–1.0"]++;
    }

    // ── Group embeddings by person ───────────────────────────────────────────────
    type Row = {
      emb:  number[];
      clbp: number[] | null;
      lbp:  number[] | null;
      hog:  number[] | null;
      lpq:  number[] | null;
      dct:  number[] | null;
    };
    const byPerson = new Map<number, Row[]>();
    for (const row of allEmbs) {
      const list = byPerson.get(row.personId) ?? [];
      list.push({
        emb:  row.embedding   as number[],
        clbp: row.clbpEmbedding as number[] | null,
        lbp:  row.lbpEmbedding  as number[] | null,
        hog:  row.hogEmbedding  as number[] | null,
        lpq:  row.lpqEmbedding  as number[] | null,
        dct:  row.dctEmbedding  as number[] | null,
      });
      byPerson.set(row.personId, list);
    }

    function scoreRow(a: Row, b: Row): number {
      const hasV4 = a.clbp?.length && b.clbp?.length &&
                    a.lbp?.length  && b.lbp?.length  &&
                    a.hog?.length  && b.hog?.length  &&
                    a.lpq?.length  && b.lpq?.length  &&
                    a.dct?.length  && b.dct?.length;
      if (hasV4) {
        return 0.25*cos(a.clbp!,b.clbp!) + 0.15*cos(a.lbp!,b.lbp!) +
               0.30*cos(a.hog!, b.hog!)  + 0.20*cos(a.lpq!,b.lpq!) +
               0.10*cos(a.dct!, b.dct!);
      }
      const hasV3 = a.lbp?.length && b.lbp?.length;
      if (hasV3) {
        return 0.35*cos(a.lbp!,b.lbp!) + 0.40*cos(a.hog!,b.hog!) + 0.25*cos(a.dct!,b.dct!);
      }
      return cos(a.emb, b.emb);
    }

    const personIds   = [...byPerson.keys()];
    const intraScores: number[] = [];
    const interScores: number[] = [];

    // Intra-class: all pairwise within same person
    for (const pid of personIds) {
      const embs = byPerson.get(pid)!;
      for (let i = 0; i < embs.length; i++)
        for (let j = i + 1; j < embs.length; j++)
          intraScores.push(scoreRow(embs[i], embs[j]));
    }

    // Inter-class: up to 500 pairs across different persons (statistically robust)
    const MAX_INTER = 500;
    outer: for (let i = 0; i < personIds.length; i++) {
      const embsA = byPerson.get(personIds[i])!;
      for (let j = i + 1; j < personIds.length; j++) {
        const embsB = byPerson.get(personIds[j])!;
        interScores.push(scoreRow(embsA[0], embsB[0]));
        if (interScores.length >= MAX_INTER) break outer;
      }
    }

    // ── Metrics at operating threshold τ = 0.52 ──────────────────────────────────
    const THRESHOLD = 0.52;
    const TP = intraScores.filter(s => s >= THRESHOLD).length;
    const FN = intraScores.filter(s => s <  THRESHOLD).length;
    const FP = interScores.filter(s => s >= THRESHOLD).length;
    const TN = interScores.filter(s => s <  THRESHOLD).length;

    const precision = TP + FP > 0 ? TP / (TP + FP) : (intraScores.length > 0 ? 1.0 : 0);
    const recall    = TP + FN > 0 ? TP / (TP + FN) : 0;
    const f1Score   = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const fpr       = FP + TN > 0 ? FP / (FP + TN) : 0;

    // ── EER sweep (returns number, not string) ────────────────────────────────────
    let eerThreshold = THRESHOLD, minDiff = Infinity;
    for (let t = 0; t <= 200; t++) {
      const tau = t / 200;
      const tar = intraScores.length ? intraScores.filter(s => s >= tau).length / intraScores.length : 0;
      const far = interScores.length ? interScores.filter(s => s >= tau).length / interScores.length : 0;
      const frr = 1 - tar;
      const diff = Math.abs(far - frr);
      if (diff < minDiff) { minDiff = diff; eerThreshold = tau; }
    }
    const eer = intraScores.length && interScores.length
      ? interScores.filter(s => s >= eerThreshold).length / interScores.length
      : 0;

    // ── d-prime (d') — Signal Detection Theory separability index ────────────────
    const muIntra  = mean(intraScores);
    const muInter  = mean(interScores);
    const varIntra = variance(intraScores, muIntra);
    const varInter = variance(interScores, muInter);
    const denom    = Math.sqrt(0.5 * (varIntra + varInter));
    const dPrime   = (intraScores.length > 0 && interScores.length > 0 && denom > 1e-9)
      ? (muIntra - muInter) / denom
      : 0;

    // ── ROC curve data (50 threshold points) ─────────────────────────────────────
    const rocData: Array<{ threshold: number; tar: number; far: number; f1: number }> = [];
    for (let t = 0; t <= 50; t++) {
      const tau = t / 50;
      const tp  = intraScores.filter(s => s >= tau).length;
      const fn  = intraScores.length - tp;
      const fp  = interScores.filter(s => s >= tau).length;
      const tn  = interScores.length - fp;
      const tar = intraScores.length ? tp / intraScores.length : 0;
      const far = interScores.length ? fp / interScores.length : 0;
      const p   = tp + fp > 0 ? tp / (tp + fp) : 1;
      const r   = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1  = p + r > 0 ? (2 * p * r) / (p + r) : 0;
      rocData.push({ threshold: parseFloat(tau.toFixed(2)), tar: parseFloat(tar.toFixed(4)), far: parseFloat(far.toFixed(4)), f1: parseFloat(f1.toFixed(4)) });
    }

    const accuracyData = {
      precision,
      recall,
      f1Score,
      falsePositiveRate: fpr,
      truePositives:     TP,
      falsePositives:    FP,
      trueNegatives:     TN,
      falseNegatives:    FN,
      intraClassMean:    muIntra,
      interClassMean:    muInter,
      intraClassStd:     Math.sqrt(varIntra),
      interClassStd:     Math.sqrt(varInter),
      eerThreshold,
      eer,
      dPrime,
      operatingThreshold: THRESHOLD,
      avgProcessingTimeMs: parseFloat(avgTime[0]?.avg ?? "0") || 0,
      confidenceDistribution: Object.entries(buckets).map(([range, cnt]) => ({ range, count: cnt })),
      evaluatedPairs: { intra: intraScores.length, inter: interScores.length },
      rocData
    };

    overviewCache.set("accuracy", accuracyData);
    res.json(accuracyData);
  } catch (err: any) {
    console.error("GET /stats/accuracy error:", err);
    res.status(500).json({ error: "Failed to compute accuracy stats", details: err?.message });
  }
});

// ─── GET /stats/growth — single SQL query, not 30 sequential ones ─────────────
router.get("/growth", async (_req, res) => {
  try {
    const cached = overviewCache.get("growth");
    if (cached) { res.json(cached); return; }

    const [personCounts, embeddingCounts, logCounts] = await Promise.all([
      db.execute(sql`SELECT DATE(created_at) as date, count(*) as count FROM persons WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date ASC`),
      db.execute(sql`SELECT DATE(created_at) as date, count(*) as count FROM face_embeddings WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date ASC`),
      db.execute(sql`SELECT DATE(created_at) as date, count(*) as count FROM recognition_logs WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date ASC`),
    ]);

    const mapData = (rows: any[]) => {
      const map = new Map<string, number>();
      if (Array.isArray(rows)) {
        for (const r of rows) map.set(r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date), Number(r.count));
      }
      return map;
    };

    const pMap = mapData((personCounts as any)?.rows || personCounts);
    const eMap = mapData((embeddingCounts as any)?.rows || embeddingCounts);
    const lMap = mapData((logCounts as any)?.rows || logCounts);

    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];

      days.push({
        date: dayStr,
        personsCount: pMap.get(dayStr) || 0,
        embeddingsCount: eMap.get(dayStr) || 0,
        recognitionsCount: lMap.get(dayStr) || 0
      });
    }

    overviewCache.set("growth", days);
    res.json(days);
  } catch (err: any) {
    console.error("GET /stats/growth error:", err);
    res.status(500).json({ error: "Failed to compute growth stats", details: err?.message });
  }
});

// ─── GET /stats/health — real external API check ──────────────────────────────
router.get("/health", async (_req, res) => {
  try {
    const checks = await Promise.allSettled([
      fetch("https://en.wikipedia.org/w/api.php?action=query&titles=Albert_Einstein&prop=pageimages&format=json&pithumbsize=100", {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "FaceVisionResearch/4.0" },
      }).then(r => r.ok),
      db.select({ one: sql<number>`1` }).from(personsTable).limit(1).then(() => true),
    ]);

    res.json({
      wikipediaApi: checks[0].status === "fulfilled" && checks[0].value,
      database:     checks[1].status === "fulfilled" && checks[1].value,
      algorithmVersion: "v4",
      totalDims: 576,
      algorithms: ["CLBP [2]", "MSLBPH [3,4]", "Gabor [5]", "LPQ [6]", "WLD [7]"],
      illumination: "Tan-Triggs DoG [1]",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("GET /stats/health error:", err);
    res.status(500).json({ error: "Health check failed", details: err?.message });
  }
});

import { runInternalBenchmark } from "../lib/benchmark.js";

router.get("/benchmark", async (req, res) => {
  try {
    const result = await runInternalBenchmark();
    res.json(result);
  } catch (err: any) {
    console.error("GET /stats/benchmark error:", err);
    res.status(500).json({ error: "Benchmark failed", details: err?.message });
  }
});

export default router;
