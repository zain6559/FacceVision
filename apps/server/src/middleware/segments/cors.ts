/**
 * CORS Middleware Segment
 * 
 * Handles Cross-Origin Resource Sharing configuration.
 */

import cors, { type CorsOptions } from "cors";
import { type Request, type NextFunction, type ErrorRequestHandler } from "express";

/**
 * Parse allowed origins from environment variable.
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env["CORS_ORIGINS"];
  if (!envOrigins) return ["*"];
  return envOrigins.split(",").map(s => s.trim());
}

/**
 * CORS configuration options.
 */
export function createCorsMiddleware(): ReturnType<typeof cors> {
  const allowedOrigins = getAllowedOrigins();
  
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server calls)
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "x-api-key"],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    maxAge: 600,
    credentials: true,
  };

  return cors(corsOptions);
}

/**
 * Handle CORS errors.
 */
export function corsErrorHandler(
  err: Error,
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (err.message === "Not allowed by CORS") {
    next(err);
  } else {
    next();
  }
}
