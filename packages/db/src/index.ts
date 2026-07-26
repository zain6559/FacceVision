import pg from "pg";
import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema/index.js";

// ─── ENVIRONMENT VARIABLES & CONFIGURATION ───────────────────────────────────────
const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/facevision";
const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const DB_POOL_MAX = parseInt(process.env.DB_POOL_MAX || "20", 10);
const DB_IDLE_TIMEOUT_MS = parseInt(process.env.DB_IDLE_TIMEOUT_MS || "30000", 10);
const DB_CONN_TIMEOUT_MS = parseInt(process.env.DB_CONN_TIMEOUT_MS || "5000", 10);
const DB_RETRY_COUNT = parseInt(process.env.DB_RETRY_COUNT || "3", 10);
const DB_RETRY_DELAY_MS = parseInt(process.env.DB_RETRY_DELAY_MS || "500", 10);

const USE_PGBOUNCER =
  process.env.USE_PGBOUNCER === "true" ||
  DATABASE_URL.includes("pgbouncer=true") ||
  DATABASE_URL.includes(":6543");

const isNeon = (process.env.USE_NEON === "true" || DATABASE_URL.includes(".neon.tech")) && !DATABASE_URL.includes("localhost");

if (!process.env.DATABASE_URL) {
  console.warn(
    `[DB Resilience] DATABASE_URL not specified. Using default: ${DEFAULT_DATABASE_URL}. Operating with automatic degradation protection.`
  );
}

// ─── CONNECTION POOL & DRIVER INITIALIZATION ─────────────────────────────────────
let pool: pg.Pool | null = null;
let rawDb: NodePgDatabase<typeof schema>;

// Resilience Metrics & State
let isDbHealthy = false;
let lastCheckedAt: Date | null = null;
let lastError: string | null = null;
let totalQueriesCount = 0;
let failedQueriesCount = 0;
let totalRetriesCount = 0;
let lastLatencyMs = 0;

function createSafeFallbackPool(): pg.Pool {
  const fallbackPool = new pg.Pool({
    connectionString: DEFAULT_DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 2000,
  });
  fallbackPool.on("error", (err) => {
    console.error("[DB Resilience] Suppressed fallback pool client error:", err?.message || err);
    isDbHealthy = false;
    lastError = err?.message || String(err);
  });
  return fallbackPool;
}

function createDbClient() {
  if (isNeon) {
    try {
      const sql = neon(DATABASE_URL);
      rawDb = drizzleNeon(sql, { schema }) as unknown as NodePgDatabase<typeof schema>;
      isDbHealthy = true;
    } catch (err: any) {
      console.error("[DB Resilience] Neon initialization error:", err?.message || err);
      isDbHealthy = false;
      lastError = err?.message || String(err);
      rawDb = drizzleNodePg(createSafeFallbackPool(), { schema });
    }
  } else {
    try {
      const { Pool } = pg;
      pool = new Pool({
        connectionString: DATABASE_URL,
        max: USE_PGBOUNCER ? Math.max(DB_POOL_MAX, 50) : DB_POOL_MAX,
        idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
        connectionTimeoutMillis: DB_CONN_TIMEOUT_MS,
        // PgBouncer proxy tuning: statement_timeout & query_timeout prevent query hanging in transaction pool mode
        statement_timeout: 15000,
        query_timeout: 15000,
        allowExitOnIdle: false,
      });

      if (USE_PGBOUNCER) {
        console.log("[DB Proxy] PgBouncer Connection Proxying Enabled (Transaction Pooling Mode & Statement Timeout: 15s)");
      }

      // Prevent idle client errors from crashing the application process
      pool.on("error", (err) => {
        console.error("[DB Pool Error] Unexpected pool client error:", err?.message || err);
        isDbHealthy = false;
        lastError = err?.message || String(err);
      });

      rawDb = drizzleNodePg(pool, { schema });
      isDbHealthy = true;
    } catch (err: any) {
      console.error("[DB Resilience] PG Pool initialization error:", err?.message || err);
      isDbHealthy = false;
      lastError = err?.message || String(err);
      rawDb = drizzleNodePg(createSafeFallbackPool(), { schema });
    }
  }
}

createDbClient();

export const db = rawDb!;

// ─── HEALTH MONITORING & TELEMETRY ───────────────────────────────────────────────
export async function checkDbHealth(): Promise<{
  isHealthy: boolean;
  latencyMs: number;
  activeConnections?: number;
  maxConnections: number;
  isPgBouncerActive: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  metrics: {
    totalQueries: number;
    failedQueries: number;
    totalRetries: number;
  };
}> {
  const start = Date.now();
  try {
    if (pool) {
      await pool.query("SELECT 1");
    } else if (rawDb) {
      await (rawDb as any).execute?.("SELECT 1");
    }
    lastLatencyMs = Date.now() - start;
    isDbHealthy = true;
    lastError = null;
  } catch (err: any) {
    lastLatencyMs = Date.now() - start;
    isDbHealthy = false;
    lastError = err?.message || String(err);
  }
  lastCheckedAt = new Date();

  return {
    isHealthy: isDbHealthy,
    latencyMs: lastLatencyMs,
    activeConnections: pool ? pool.totalCount - pool.idleCount : undefined,
    maxConnections: DB_POOL_MAX,
    isPgBouncerActive: USE_PGBOUNCER,
    lastCheckedAt: lastCheckedAt ? lastCheckedAt.toISOString() : null,
    lastError,
    metrics: {
      totalQueries: totalQueriesCount,
      failedQueries: failedQueriesCount,
      totalRetries: totalRetriesCount,
    },
  };
}

export function isDbConnected(): boolean {
  return isDbHealthy;
}

export function getDbPoolStats() {
  return {
    isHealthy: isDbHealthy,
    isPgBouncerActive: USE_PGBOUNCER,
    maxConnections: DB_POOL_MAX,
    totalCount: pool?.totalCount ?? 0,
    idleCount: pool?.idleCount ?? 0,
    waitingCount: pool?.waitingCount ?? 0,
    lastLatencyMs,
    lastError,
  };
}

export async function reconnectDb(): Promise<boolean> {
  console.log("[DB Resilience] Attempting DB reconnection & pool refresh...");
  if (pool) {
    try {
      await pool.end();
    } catch (e) {
      // Ignore cleanup error
    }
  }
  createDbClient();
  const health = await checkDbHealth();
  return health.isHealthy;
}

// ─── RESILIENT RETRY UTILITY ─────────────────────────────────────────────────────
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  retries: number = DB_RETRY_COUNT,
  delayMs: number = DB_RETRY_DELAY_MS
): Promise<T> {
  totalQueriesCount++;
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const result = await operation();
      isDbHealthy = true;
      return result;
    } catch (err: any) {
      attempt++;
      totalRetriesCount++;
      const errMsg = err?.message || String(err);
      const isConnError =
        errMsg.includes("ECONNREFUSED") ||
        errMsg.includes("ECONNRESET") ||
        errMsg.includes("ETIMEDOUT") ||
        errMsg.includes("57P01") ||
        errMsg.includes("57P03") ||
        errMsg.includes("08006") ||
        errMsg.includes("08003") ||
        errMsg.includes("connection closed") ||
        errMsg.includes("Connection terminated");

      if (isConnError && attempt < retries) {
        console.warn(`[DB Resilience] Connection glitch detected (${errMsg}). Attempting pool refresh...`);
        try {
          await reconnectDb();
        } catch (e) {
          // ignore reconnect error
        }
      }

      if (attempt > retries) {
        failedQueriesCount++;
        isDbHealthy = false;
        lastError = errMsg;
        console.error(`[DB Retry Exhausted] Operation failed after ${retries} attempts:`, errMsg);
        throw err;
      }
      const backoff = delayMs * Math.pow(1.5, attempt - 1);
      console.warn(`[DB Retry ${attempt}/${retries}] Retrying query in ${Math.round(backoff)}ms due to: ${errMsg}`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw new Error("Unexpected retry exit");
}

// ─── EMERGENCY IN-MEMORY STORE & GRACEFUL DEGRADATION ──────────────────────────────
export interface InMemoryStore {
  projects: Array<any>;
  collections: Array<any>;
  apiKeys: Array<any>;
  auditLogs: Array<any>;
  persons: Array<any>;
}

export const inMemoryStore: InMemoryStore = {
  projects: [
    {
      id: 1,
      name: "Default Project (Degraded)",
      description: "Fallback project active when DB is offline",
      tenantId: "default_tenant",
      status: "active",
      createdAt: new Date().toISOString(),
    },
  ],
  collections: [],
  apiKeys: [],
  auditLogs: [],
  persons: [],
};

export async function safeDbQuery<T>(
  operation: () => Promise<T>,
  fallback: T | (() => T)
): Promise<{ data: T; isDegraded: boolean }> {
  try {
    const data = await withDbRetry(operation);
    return { data, isDegraded: false };
  } catch (err: any) {
    console.warn("[DB Graceful Degradation] Executing in degraded mode. Error:", err?.message);
    const fallbackValue = typeof fallback === "function" ? (fallback as () => T)() : fallback;
    return { data: fallbackValue, isDegraded: true };
  }
}

export * from "./schema/index.js";
export * from "./vector/index.js";
export * as security from "./schema/security/index.js";
