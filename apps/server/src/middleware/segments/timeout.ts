/**
 * Request Timeout Middleware Segment
 * 
 * Applies timeouts based on route sensitivity.
 */

import { type Request, type Response, type NextFunction } from "express";

// Configuration
const DEFAULT_TIMEOUT_MS = 60_000;    // 60 seconds
const HEAVY_TIMEOUT_MS = 120_000;      // 120 seconds for heavy operations

/**
 * Routes considered as heavy operations.
 */
const HEAVY_ROUTES = [
  "/recognition/identify",
  "/learning/trigger",
  "/intelligence/cluster",
  "/intelligence/calibrate"
];

/**
 * Determine timeout based on route.
 */
function getRouteTimeout(path: string): number {
  const isHeavy = HEAVY_ROUTES.some(route => path.includes(route));
  return isHeavy ? HEAVY_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

/**
 * Request timeout middleware.
 */
export function requestTimeoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const timeoutMs = getRouteTimeout(req.path);
  
  res.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      res.status(408).json({
        error: "Request timeout",
        timeoutMs,
        path: req.path
      });
    }
  });

  next();
}
