import { Router } from "express";
import {
  db,
  safeDbQuery,
  withDbRetry,
  checkDbHealth,
  getDbPoolStats,
  reconnectDb,
  inMemoryStore,
} from "@workspace/db";
import {
  projectsTable,
  collectionsTable,
  usersTable,
  apiKeysTable,
  auditLogsTable,
} from "@workspace/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { apiKeyAuth, optionalApiKey, requireApiKey } from "../middleware/auth.js";
import { sanitizeInputs, sanitizeString, escapeSqlWildcards } from "../middleware/sanitize.js";

const router = Router();

// Apply sanitization middleware to all enterprise routes
router.use(sanitizeInputs);

// ─── 1. PROJECTS MANAGEMENT ───────────────────────────────────────────────────

// GET /api/enterprise/projects — List all projects (Safe DB with Graceful Degradation)
router.get("/projects", optionalApiKey, async (req, res) => {
  try {
    const { data: projects, isDegraded } = await safeDbQuery(
      () => db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt)),
      () => inMemoryStore.projects
    );

    if (isDegraded) {
      res.setHeader("X-Degraded-Mode", "true");
    }
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/enterprise/projects — Create a new enterprise project
router.post("/projects", optionalApiKey, async (req, res) => {
  try {
    const name = req.body.name ? sanitizeString(String(req.body.name)) : "";
    const description = req.body.description ? sanitizeString(String(req.body.description)) : null;
    const tenantId = req.body.tenantId ? sanitizeString(String(req.body.tenantId)) : "default_tenant";

    if (!name) {
      res.status(400).json({ error: "Project name is required" });
      return;
    }

    let project: any;
    let isDegraded = false;
    try {
      const [inserted] = await withDbRetry(() =>
        db.insert(projectsTable).values({
          name,
          description,
          tenantId,
        }).returning()
      );
      project = inserted;
    } catch (dbErr) {
      isDegraded = true;
      project = {
        id: Math.floor(Math.random() * 9000) + 1000,
        name,
        description,
        tenantId,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      inMemoryStore.projects.push(project);
    }

    // Log audit event (non-blocking, safe)
    try {
      await safeDbQuery(
        () =>
          db.insert(auditLogsTable).values({
            tenantId,
            projectId: project.id,
            action: "PROJECT_CREATED",
            resource: `Project: ${name}`,
            status: "SUCCESS",
            metadata: { projectId: project.id, apiKeyId: req.apiKey?.id ?? null },
          }),
        () => {
          inMemoryStore.auditLogs.push({
            id: inMemoryStore.auditLogs.length + 1,
            tenantId,
            projectId: project.id,
            action: "PROJECT_CREATED",
            resource: `Project: ${name}`,
            status: "SUCCESS_DEGRADED",
            createdAt: new Date().toISOString(),
          });
          return null;
        }
      );
    } catch (e) {
      // Non-blocking audit log
    }

    if (isDegraded) {
      res.setHeader("X-Degraded-Mode", "true");
    }
    res.status(201).json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 2. COLLECTIONS MANAGEMENT ────────────────────────────────────────────────

// GET /api/enterprise/projects/:projectId/collections — List collections in a project
router.get("/projects/:projectId/collections", optionalApiKey, async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId) || projectId <= 0) {
      res.status(400).json({ error: "Invalid project ID" });
      return;
    }

    const { data: collections, isDegraded } = await safeDbQuery(
      () =>
        db
          .select()
          .from(collectionsTable)
          .where(eq(collectionsTable.projectId, projectId))
          .orderBy(desc(collectionsTable.createdAt)),
      () => inMemoryStore.collections.filter((c: any) => c.projectId === projectId)
    );

    if (isDegraded) {
      res.setHeader("X-Degraded-Mode", "true");
    }
    res.json(collections);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/enterprise/projects/:projectId/collections — Create a collection
router.post("/projects/:projectId/collections", optionalApiKey, async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId) || projectId <= 0) {
      res.status(400).json({ error: "Invalid project ID" });
      return;
    }

    const name = req.body.name ? sanitizeString(String(req.body.name)) : "";
    const description = req.body.description ? sanitizeString(String(req.body.description)) : null;

    if (!name) {
      res.status(400).json({ error: "Collection name is required" });
      return;
    }

    let col: any;
    let isDegraded = false;
    try {
      const [inserted] = await withDbRetry(() =>
        db.insert(collectionsTable).values({
          projectId,
          name,
          description,
        }).returning()
      );
      col = inserted;
    } catch (dbErr) {
      isDegraded = true;
      col = {
        id: Math.floor(Math.random() * 9000) + 1000,
        projectId,
        name,
        description,
        subjectCount: 0,
        createdAt: new Date().toISOString(),
      };
      inMemoryStore.collections.push(col);
    }

    if (isDegraded) {
      res.setHeader("X-Degraded-Mode", "true");
    }
    res.status(201).json(col);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 3. API KEYS MANAGEMENT ───────────────────────────────────────────────────

// GET /api/enterprise/projects/:projectId/api-keys — List API keys for a project
router.get("/projects/:projectId/api-keys", optionalApiKey, async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId) || projectId <= 0) {
      res.status(400).json({ error: "Invalid project ID" });
      return;
    }

    const { data: keys, isDegraded } = await safeDbQuery(
      () =>
        db
          .select({
            id: apiKeysTable.id,
            keyName: apiKeysTable.keyName,
            keyPrefix: apiKeysTable.keyPrefix,
            role: apiKeysTable.role,
            createdAt: apiKeysTable.createdAt,
            lastUsedAt: apiKeysTable.lastUsedAt,
          })
          .from(apiKeysTable)
          .where(eq(apiKeysTable.projectId, projectId))
          .orderBy(desc(apiKeysTable.createdAt)),
      () =>
        inMemoryStore.apiKeys
          .filter((k: any) => k.projectId === projectId)
          .map(({ keyHash, ...k }: any) => k)
    );

    if (isDegraded) {
      res.setHeader("X-Degraded-Mode", "true");
    }
    res.json(keys);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/enterprise/projects/:projectId/api-keys — Generate new API Key
router.post("/projects/:projectId/api-keys", optionalApiKey, async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId) || projectId <= 0) {
      res.status(400).json({ error: "Invalid project ID" });
      return;
    }

    const rawKeyName = req.body.keyName ? sanitizeString(String(req.body.keyName)) : "";
    if (!rawKeyName) {
      res.status(400).json({ error: "Key name is required" });
      return;
    }

    const allowedRoles = ["ADMIN", "SERVICE", "READONLY"];
    const role = allowedRoles.includes(req.body.role) ? req.body.role : "SERVICE";

    const rawSecret = randomBytes(24).toString("hex");
    const keyPrefix = "fv_live_" + rawSecret.slice(0, 8);
    const fullKey = `${keyPrefix}.${rawSecret}`;
    const keyHash = createHash("sha256").update(fullKey).digest("hex");

    let apiKeyRecord: any;
    let isDegraded = false;
    try {
      const [inserted] = await withDbRetry(() =>
        db.insert(apiKeysTable).values({
          projectId,
          keyName: rawKeyName,
          keyPrefix,
          keyHash,
          role,
        }).returning()
      );
      apiKeyRecord = inserted;
    } catch (dbErr) {
      isDegraded = true;
      apiKeyRecord = {
        id: Math.floor(Math.random() * 9000) + 1000,
        projectId,
        keyName: rawKeyName,
        keyPrefix,
        keyHash,
        role,
        createdAt: new Date().toISOString(),
      };
      inMemoryStore.apiKeys.push(apiKeyRecord);
    }

    // Log audit (non-blocking)
    try {
      await safeDbQuery(
        () =>
          db.insert(auditLogsTable).values({
            action: "API_KEY_CREATED",
            resource: `Key: ${rawKeyName}`,
            status: "SUCCESS",
            metadata: { keyId: apiKeyRecord.id, projectId, createdByApiKey: req.apiKey?.id ?? null },
          }),
        () => null
      );
    } catch (e) {
      // Non-blocking audit log
    }

    if (isDegraded) {
      res.setHeader("X-Degraded-Mode", "true");
    }

    // Return plain text key ONCE
    res.status(201).json({
      id: apiKeyRecord.id,
      keyName: rawKeyName,
      keyPrefix,
      apiKey: fullKey,
      role,
      createdAt: apiKeyRecord.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 4. AUDIT LOGS & MONITORING ───────────────────────────────────────────────

// GET /api/enterprise/audit-logs — Retrieve system audit logs
router.get("/audit-logs", optionalApiKey, async (req, res) => {
  try {
    const { data: logs, isDegraded } = await safeDbQuery(
      () => db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(100),
      () => inMemoryStore.auditLogs.slice(0, 100)
    );

    if (isDegraded) {
      res.setHeader("X-Degraded-Mode", "true");
    }
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/enterprise/monitoring/health — Enterprise Telemetry & Resilient Health Metrics
router.get("/monitoring/health", async (req, res) => {
  try {
    const dbHealth = await checkDbHealth();
    const poolStats = getDbPoolStats();
    const mem = process.memoryUsage();
    const uptime = process.uptime();

    const { data: projectCount } = await safeDbQuery(
      async () => {
        const [resCount] = await db.select({ cnt: count() }).from(projectsTable);
        return resCount?.cnt ?? 0;
      },
      () => inMemoryStore.projects.length
    );

    const { data: auditCount } = await safeDbQuery(
      async () => {
        const [resCount] = await db.select({ cnt: count() }).from(auditLogsTable);
        return resCount?.cnt ?? 0;
      },
      () => inMemoryStore.auditLogs.length
    );

    const status = dbHealth.isHealthy ? "HEALTHY" : "DEGRADED_DB_OFFLINE";

    res.json({
      status,
      service: "FaceVision Enterprise Engine",
      version: "5.0-compreface-edition",
      uptimeSeconds: Math.floor(uptime),
      databaseResilience: {
        isHealthy: dbHealth.isHealthy,
        latencyMs: dbHealth.latencyMs,
        pool: poolStats,
        metrics: dbHealth.metrics,
        lastError: dbHealth.lastError,
      },
      memoryUsage: {
        rssMb: Number((mem.rss / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
      },
      telemetry: {
        activeProjects: projectCount,
        totalAuditEvents: auditCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ status: "DEGRADED", error: err.message });
  }
});

// POST /api/enterprise/monitoring/reconnect — Manually trigger database connection pool reset & reconnection
router.post("/monitoring/reconnect", optionalApiKey, async (req, res) => {
  try {
    const reconnected = await reconnectDb();
    const health = await checkDbHealth();
    res.json({
      success: reconnected,
      status: health.isHealthy ? "HEALTHY" : "DEGRADED_DB_OFFLINE",
      health,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
