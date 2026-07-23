import { Router } from "express";
import { executeSocialGraphLearning } from "../lib/social/socialGraphCrawler.js";
import { socialWorkerPool } from "../lib/social/socialWorkerPool.js";
import { generateSyntheticAugmentations } from "../lib/social/syntheticAugmenter.js";
import { optionalApiKey } from "../middleware/auth.js";
import { sanitizeInputs, sanitizeString } from "../middleware/sanitize.js";

const router = Router();

router.use(sanitizeInputs);
router.use(optionalApiKey);

// POST /api/social/crawl — Execute Social Graph Learning (Instagram & Facebook)
router.post("/crawl", async (req, res) => {
  try {
    const rawUsername = req.body.username ? sanitizeString(String(req.body.username)) : "";
    const rawPlatform = req.body.platform ? sanitizeString(String(req.body.platform)).toLowerCase() : "instagram";
    const personName = req.body.personName ? sanitizeString(String(req.body.personName)) : undefined;

    if (!rawUsername) {
      res.status(400).json({ error: "Username parameter is required for social learning" });
      return;
    }

    const platform = (["instagram", "facebook", "twitter", "linkedin"].includes(rawPlatform)
      ? rawPlatform
      : "instagram") as any;

    const result = await executeSocialGraphLearning({
      username: rawUsername,
      platform,
      targetPersonName: personName,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to execute social graph learning" });
  }
});

// POST /api/social/augment — Generative 3D Pose Synthetic Augmentation (10 Variations)
router.post("/augment", async (req, res) => {
  try {
    const { embedding, posesCount = 10 } = req.body;

    if (!Array.isArray(embedding) || embedding.length !== 512) {
      res.status(400).json({ error: "embedding parameter must be a 512-dimensional array" });
      return;
    }

    const result = generateSyntheticAugmentations(embedding, { posesCount });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Synthetic augmentation failed" });
  }
});

// GET /api/social/status — Worker Pool Telemetry & Proxy Rotation Metrics
router.get("/status", async (_req, res) => {
  try {
    const stats = socialWorkerPool.getStats();
    res.json({
      status: "ACTIVE",
      engine: "Social Media Graph & Headless Worker Pool Engine",
      workerPool: stats,
      supportedPlatforms: ["instagram", "facebook", "twitter", "linkedin"],
      syntheticAugmentation: {
        enabled: true,
        defaultPosesPerFace: 10,
        yawRangeDegrees: [-45, 45],
        pitchRangeDegrees: [-30, 30],
        cctvLightingSimulation: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
