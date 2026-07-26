import { Router, type IRouter } from "express";
import { getSystemHealth, isAlive, isReady } from "../lib/services/index.js";

const router: IRouter = Router();

/**
 * Basic liveness check.
 * Returns 200 if the server is alive.
 */
router.get("/live", (_req, res) => {
  if (isAlive()) {
    res.json({ status: "alive", timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({ status: "dead", timestamp: new Date().toISOString() });
  }
});

/**
 * Readiness check.
 * Returns 200 if the server can handle requests.
 */
router.get("/ready", async (_req, res) => {
  const ready = await isReady();
  if (ready) {
    res.json({ status: "ready", timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({ status: "not_ready", timestamp: new Date().toISOString() });
  }
});

/**
 * Comprehensive health check.
 * Returns detailed status of all components.
 */
router.get("/", async (_req, res) => {
  try {
    const health = await getSystemHealth();
    const statusCode = health.status === "healthy" ? 200 : 
                       health.status === "degraded" ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
