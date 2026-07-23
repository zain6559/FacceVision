import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { db, apiKeysTable, type ApiKey, safeDbQuery, inMemoryStore } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey | null;
      projectId?: number | null;
    }
  }
}

export interface AuthOptions {
  optional?: boolean;
  requiredRoles?: string[];
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Extracts API Key from request headers:
 * - Authorization: Bearer <key>
 * - X-API-Key: <key> or x-api-key: <key>
 */
export function extractApiKey(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (authHeader && typeof authHeader === "string") {
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token) return token;
    }
  }

  const xApiKey = req.headers["x-api-key"];
  if (xApiKey && typeof xApiKey === "string" && xApiKey.trim()) {
    return xApiKey.trim();
  }

  return null;
}

/**
 * Express middleware for validating API keys.
 * Validates 'Authorization: Bearer fv_live_...' or 'X-API-Key'.
 */
export function apiKeyAuth(options: AuthOptions = {}) {
  const { optional = false, requiredRoles } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawKey = extractApiKey(req);

      if (!rawKey) {
        if (optional) {
          req.apiKey = null;
          return next();
        }
        res.status(401).json({
          error: "Unauthorized: API Key required. Provide header 'Authorization: Bearer fv_live_...' or 'X-API-Key'.",
        });
        return;
      }

      // Compute SHA-256 hash of raw key string
      const keyHash = createHash("sha256").update(rawKey).digest("hex");

      // Query database for matching key record with graceful degradation fallback
      const { data: keyRecords, isDegraded } = await safeDbQuery(
        () => db.select().from(apiKeysTable).where(eq(apiKeysTable.keyHash, keyHash)).limit(1),
        () => inMemoryStore.apiKeys.filter((k: any) => k.keyHash === keyHash)
      );

      const keyRecord = keyRecords[0];

      if (!keyRecord || !timingSafeCompare(keyRecord.keyHash, keyHash)) {
        res.status(401).json({ error: "Unauthorized: Invalid or revoked API key." });
        return;
      }

      // Check role permissions if specified
      if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(keyRecord.role)) {
        res.status(403).json({
          error: `Forbidden: API key does not have required role (${requiredRoles.join(", ")}).`,
        });
        return;
      }

      // Attach key record and associated project ID to request
      req.apiKey = keyRecord;
      req.projectId = keyRecord.projectId;

      // Asynchronously record last used time without blocking request execution
      db.update(apiKeysTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeysTable.id, keyRecord.id))
        .catch((err) => console.error("Failed to update lastUsedAt for API key:", err));

      next();
    } catch (err: any) {
      console.error("API Key Authentication Error:", err);
      res.status(500).json({ error: "Internal authentication error" });
    }
  };
}

/**
 * Strict authentication middleware helper
 */
export const requireApiKey = (roles?: string[]) => apiKeyAuth({ optional: false, requiredRoles: roles });

/**
 * Optional authentication middleware helper (authenticates key if provided, allows unauthenticated if absent)
 */
export const optionalApiKey = apiKeyAuth({ optional: true });
