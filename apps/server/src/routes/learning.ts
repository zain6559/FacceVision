import { Router } from "express";
import { db, learningRunsTable } from "@workspace/db";
import { desc, count, gte, sql } from "drizzle-orm";
import { TriggerLearningBody, ListLearningRunsQueryParams } from "@workspace/api-zod";
import { runLearningPipeline, isLearningRunning } from "../lib/learningPipeline.js";

const router = Router();

// POST /learning/trigger
router.post("/trigger", async (req, res) => {
  try {
    const parsed = TriggerLearningBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { source, maxImages = 20 } = parsed.data;

    if (isLearningRunning()) {
      res.status(409).json({ error: "Learning pipeline is already running" });
      return;
    }

    const [run] = await db
      .insert(learningRunsTable)
      .values({ source, status: "pending", facesAdded: 0, personsAdded: 0, maxImages })
      .returning();

    // Fire-and-forget
    runLearningPipeline(run.id, source, maxImages).catch(() => {});

    res.json(run);
  } catch (err: any) {
    console.error("POST /learning/trigger error:", err);
    res.status(500).json({ error: "Failed to trigger learning pipeline", details: err?.message });
  }
});

// GET /learning/status
router.get("/status", async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [currentRun] = await db
      .select()
      .from(learningRunsTable)
      .where(sql`status IN ('pending','running')`)
      .orderBy(desc(learningRunsTable.startedAt))
      .limit(1);

    const [lastRun] = await db
      .select()
      .from(learningRunsTable)
      .where(sql`status IN ('completed','failed')`)
      .orderBy(desc(learningRunsTable.startedAt))
      .limit(1);

    const [todayRuns] = await db
      .select({ count: count() })
      .from(learningRunsTable)
      .where(gte(learningRunsTable.startedAt, today));

    const nextScheduled = new Date();
    nextScheduled.setDate(nextScheduled.getDate() + 1);
    nextScheduled.setHours(0, 0, 0, 0);

    res.json({
      isRunning: isLearningRunning(),
      currentRun: currentRun ?? null,
      lastRun: lastRun ?? null,
      nextScheduledAt: nextScheduled.toISOString(),
      totalRunsToday: Number(todayRuns?.count ?? 0),
    });
  } catch (err: any) {
    console.error("GET /learning/status error:", err);
    res.status(500).json({ error: "Failed to fetch learning status", details: err?.message });
  }
});

// GET /learning/runs
router.get("/runs", async (req, res) => {
  try {
    const parsed = ListLearningRunsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }
    const { limit = 20 } = parsed.data;
    const runs = await db
      .select()
      .from(learningRunsTable)
      .orderBy(desc(learningRunsTable.startedAt))
      .limit(limit);
    res.json(runs);
  } catch (err: any) {
    console.error("GET /learning/runs error:", err);
    res.status(500).json({ error: "Failed to list learning runs", details: err?.message });
  }
});

export default router;
