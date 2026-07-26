/**
 * Rate Limiting Middleware Segment
 * 
 * Multi-tier rate limiting based on route sensitivity.
 */

import { type Request, type Response, type NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Configuration
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_RATE_LIMIT = Number(process.env["RATE_LIMIT_MAX"] ?? "10000");
const HEAVY_ROUTE_RATE_LIMIT = Number(process.env["RATE_LIMIT_HEAVY_MAX"] ?? "2000");
const AUTH_ROUTE_RATE_LIMIT = Math.min(DEFAULT_RATE_LIMIT, 500);

// In-memory store (use Redis for production)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Get rate limit key from request.
 */
function getRateLimitKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp = typeof forwarded === "string" 
    ? forwarded.split(",")[0].trim() 
    : req.ip ?? "unknown";
  // Sanitize IP address
  return rawIp.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
}

/**
 * Determine rate limit tier based on route.
 */
function getRouteTier(req: Request): { limit: number; tier: string } {
  const path = req.path;
  
  // Heavy routes (recognition, batch processing)
  if (path.includes("/recognition/identify") || 
      path.includes("/learning/trigger") || 
      path.includes("/enterprise/batch")) {
    return { limit: HEAVY_ROUTE_RATE_LIMIT, tier: "heavy" };
  }
  
  // Auth routes
  if (path.includes("/auth") || path.includes("/api-key")) {
    return { limit: AUTH_ROUTE_RATE_LIMIT, tier: "auth" };
  }
  
  // Default tier
  return { limit: DEFAULT_RATE_LIMIT, tier: "general" };
}

/**
 * Rate limiting middleware.
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip rate limiting in test mode or if disabled
  if (process.env["DISABLE_RATE_LIMIT"] === "true" || process.env["NODE_ENV"] === "test") {
    return next();
  }

  const ipKey = getRateLimitKey(req);
  const { limit, tier } = getRouteTier(req);
  const now = Date.now();

  const storeKey = `${ipKey}:${tier}`;
  let entry = rateLimitStore.get(storeKey);

  // Reset if expired
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(storeKey, entry);
  }

  entry.count++;

  // Set rate limit headers
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - entry.count)));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

  // Check limit
  if (entry.count > limit) {
    res.status(429).json({ 
      error: "Too many requests. Please retry later.",
      retryAfter: Math.ceil((entry.resetAt - now) / 1000)
    });
    return;
  }

  next();
}

/**
 * Periodic cleanup of expired rate limit entries.
 * Should be called on server startup.
 */
export function startRateLimitCleanup(): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * Clear all rate limit data.
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
