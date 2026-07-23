import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { scheduleDailyLearning } from "./lib/learningPipeline.js";

import { sanitizeInputs } from "./middleware/sanitize.js";

const app: Express = express();

// Trust reverse proxy if behind load balancer/Nginx (needed for accurate IP rate limiting)
if (process.env["NODE_ENV"] === "production") {
  app.set("trust proxy", 1);
}

// ─── Cyber Security Headers (CORS, CSP, HSTS, Frame Options, Policies) ─────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});

// ─── Structured Logging ────────────────────────────────────────────────────────
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

// ─── CORS — Configurable & Strict Origin Whitelist ─────────────────────────────
const ALLOWED_ORIGINS = (process.env["CORS_ORIGINS"] ?? "*").split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, server-to-server calls)
    if (!origin || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
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
}));

// ─── Body Parsing & Input Sanitization ─────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(sanitizeInputs);

// ─── Dynamic Multi-Tier Rate Limiter ───────────────────────────────────────────
const rateLimitWindowMs = 15 * 60 * 1000; // 15 minutes
const rateLimitMax = Number(process.env["RATE_LIMIT_MAX"] ?? "10000");
const rateLimitHeavyMax = Number(process.env["RATE_LIMIT_HEAVY_MAX"] ?? "2000");
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getRateLimitKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip ?? "unknown";
  return rawIp.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
}

app.use((req: Request, res: Response, next: NextFunction) => {
  if (process.env["DISABLE_RATE_LIMIT"] === "true" || process.env["NODE_ENV"] === "test") {
    return next();
  }

  const ipKey = getRateLimitKey(req);
  const now = Date.now();

  // Tier limit based on route sensitivity
  let routeLimit = rateLimitMax;
  const isHeavy = req.path.includes("/recognition/identify") || req.path.includes("/learning/trigger") || req.path.includes("/enterprise/batch");
  const isAuth = req.path.includes("/auth") || req.path.includes("/api-key");

  if (isHeavy) {
    routeLimit = rateLimitHeavyMax;
  } else if (isAuth) {
    routeLimit = Math.min(rateLimitMax, 500);
  }

  const storeKey = `${ipKey}:${isHeavy ? "heavy" : isAuth ? "auth" : "gen"}`;
  let entry = rateLimitStore.get(storeKey);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + rateLimitWindowMs };
    rateLimitStore.set(storeKey, entry);
  }

  entry.count++;

  res.setHeader("X-RateLimit-Limit", String(routeLimit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, routeLimit - entry.count)));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > routeLimit) {
    res.status(429).json({ error: "Too many requests. Please retry later." });
    return;
  }
  next();
});

// Periodic cleanup of expired rate-limit entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// ─── Request Timeout (60s default, 120s for heavy routes) ──────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const isHeavy = req.path.includes("/recognition/identify") || req.path.includes("/learning/trigger");
  const timeoutMs = isHeavy ? 120_000 : 60_000;
  res.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: "Request timeout" });
    }
  });
  next();
});

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", router);

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err: err.message, stack: err.stack }, "Unhandled error");
  if (!res.headersSent) {
    // Don't leak internal details in production
    const isProduction = process.env["NODE_ENV"] === "production";
    res.status(500).json({
      error: isProduction ? "Internal server error" : err.message,
    });
  }
});

// Start daily learning scheduler
scheduleDailyLearning();

export default app;
