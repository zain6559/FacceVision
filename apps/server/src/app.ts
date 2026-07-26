/**
 * FaceVision — Express Application
 * 
 * Main application factory. Creates and configures the Express app.
 * All middleware is now organized into separate segments for better maintainability.
 */

import express, { type Express, type Request, type Response, type NextFunction, type ErrorRequestHandler } from "express";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { scheduleDailyLearning } from "./lib/learningPipeline.js";
import { sanitizeInputs } from "./middleware/sanitize.js";

// Middleware segments
import { 
  securityHeaders,
  createCorsMiddleware,
  rateLimitMiddleware,
  requestTimeoutMiddleware,
  startRateLimitCleanup
} from "./middleware/segments/index.js";

/**
 * Create and configure the Express application.
 */
export function createApp(): Express {
  const app: Express = express();

  // Trust reverse proxy if behind load balancer/Nginx
  if (process.env["NODE_ENV"] === "production") {
    app.set("trust proxy", 1);
  }

  // ─── Security Headers ────────────────────────────────────────────────────────
  app.use(securityHeaders);

  // ─── Structured Logging ─────────────────────────────────────────────────────
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );

  // ─── CORS ───────────────────────────────────────────────────────────────────
  app.use(createCorsMiddleware());

  // ─── Body Parsing & Sanitization ───────────────────────────────────────────
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(sanitizeInputs);

  // ─── Rate Limiting ───────────────────────────────────────────────────────────
  app.use(rateLimitMiddleware);

  // ─── Request Timeout ────────────────────────────────────────────────────────
  app.use(requestTimeoutMiddleware);

  // ─── Routes ─────────────────────────────────────────────────────────────────
  app.use("/api", router);

  // ─── Global Error Handler ────────────────────────────────────────────────────
  const errorHandler: ErrorRequestHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err: err.message, stack: err.stack }, "Unhandled error");
    if (!res.headersSent) {
      const isProduction = process.env["NODE_ENV"] === "production";
      res.status(500).json({
        error: isProduction ? "Internal server error" : err.message,
      });
    }
  };
  app.use(errorHandler);

  // ─── Start Background Tasks ─────────────────────────────────────────────────
  // Start rate limit cleanup
  startRateLimitCleanup();
  
  // Schedule daily learning
  scheduleDailyLearning();

  return app;
}

// Default export for backward compatibility
export default createApp();
