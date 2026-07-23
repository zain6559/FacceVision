import { Router } from "express";
import { eventProducer } from "../lib/queue/eventProducer.js";
import { workerPoolManager } from "../lib/queue/workerPoolManager.js";
import { initializeWorkerPoolConsumers } from "../lib/queue/eventConsumers.js";
import { optionalApiKey } from "../middleware/auth.js";
import { sanitizeInputs, sanitizeString } from "../middleware/sanitize.js";

const router = Router();

router.use(sanitizeInputs);
router.use(optionalApiKey);

// Initialize event consumers on module load
initializeWorkerPoolConsumers();

// POST /api/queue/ingest — Asynchronously ingest raw image/video URLs into media.ingest topic
router.post("/ingest", async (req, res) => {
  try {
    const { mediaUrls, tenantId, projectId } = req.body;

    if (!Array.isArray(mediaUrls) || mediaUrls.length === 0) {
      res.status(400).json({ error: "mediaUrls parameter must be a non-empty array of URL strings" });
      return;
    }

    const messages = mediaUrls.map((url, i) => ({
      jobId: `job_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
      mediaUrl: sanitizeString(String(url)),
      tenantId: tenantId ? sanitizeString(String(tenantId)) : "default_tenant",
      projectId: projectId ? Number(projectId) : 1,
      timestamp: new Date().toISOString(),
    }));

    const publishedCount = await eventProducer.publishBatch("media.ingest", messages);

    res.status(202).json({
      status: "QUEUED",
      message: `Enqueued ${publishedCount} media items into pipeline topic 'media.ingest'`,
      jobIds: messages.map((m) => m.jobId),
      targetThroughput: "10,000 images/sec",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/queue/stats — Retrieve backpressure metrics, queue depth, and worker pool stats
router.get("/stats", async (_req, res) => {
  try {
    const stats = workerPoolManager.getSystemStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/queue/workers/scale — Dynamically scale worker concurrency for a topic
router.post("/workers/scale", async (req, res) => {
  try {
    const { topic, concurrency } = req.body;

    if (!["media.ingest", "face.detection", "face.embedding", "face.index"].includes(topic)) {
      res.status(400).json({ error: "Invalid queue topic name" });
      return;
    }

    const numConcurrency = Number(concurrency);
    if (isNaN(numConcurrency) || numConcurrency <= 0) {
      res.status(400).json({ error: "Concurrency must be a positive integer" });
      return;
    }

    workerPoolManager.scaleWorkerConcurrency(topic as any, numConcurrency);

    res.json({
      status: "SCALED",
      topic,
      newConcurrency: numConcurrency,
      systemStats: workerPoolManager.getSystemStats(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
