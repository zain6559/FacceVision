import { Router } from "express";
import { db, experimentsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { runInternalBenchmark } from "../lib/benchmark.js";

const router = Router();

// ─── GET /experiments ─────────────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const experiments = await db.select().from(experimentsTable).orderBy(desc(experimentsTable.createdAt));
    res.json(experiments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /experiments/run ────────────────────────────────────────────────────
router.post("/run", async (req, res) => {
  try {
    const { name, description, algorithmVersion = "v5" } = req.body;

    // Create pending experiment
    const [experiment] = await db.insert(experimentsTable).values({
      name: name || `Benchmark ${new Date().toISOString()}`,
      description,
      algorithmVersion,
      parameters: { threshold: 0.52 }, // Default parameters
      status: "running"
    }).returning();

    res.status(202).json({ message: "Experiment started", experimentId: experiment.id });

    // Run benchmark in background (Simulation of job queue)
    setTimeout(async () => {
      try {
        const results = await runInternalBenchmark();

        // Find best threshold (EER point)
        const eerPoint = results.results.reduce((prev, curr) =>
          Math.abs(curr.far - curr.frr) < Math.abs(prev.far - prev.frr) ? curr : prev
        );

        await db.update(experimentsTable).set({
          status: "completed",
          metrics: {
            eer: results.eerEstimate,
            bestThreshold: eerPoint.threshold,
            precision: eerPoint.precision,
            recall: eerPoint.recall,
            f1Score: (2 * eerPoint.precision * eerPoint.recall) / (eerPoint.precision + eerPoint.recall),
            totalPairs: results.totalPairs
          },
          completedAt: new Date()
        }).where(eq(experimentsTable.id, experiment.id));

      } catch (err) {
        await db.update(experimentsTable)
          .set({ status: "failed" })
          .where(eq(experimentsTable.id, experiment.id));
      }
    }, 0);

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
