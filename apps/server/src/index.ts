import { TextEncoder, TextDecoder } from "node:util";
(globalThis as any).util = { TextEncoder, TextDecoder };

import { bootManager } from "./lib/boot/index.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * Graceful shutdown handler.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Received shutdown signal, cleaning up...");
  
  try {
    // Add cleanup logic here (close DB connections, stop workers, etc.)
    logger.info("Cleanup completed");
    process.exit(0);
  } catch (error) {
    logger.error({ error }, "Error during shutdown");
    process.exit(1);
  }
}

/**
 * Register shutdown handlers.
 */
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/**
 * Start the server with boot sequence.
 */
async function main(): Promise<void> {
  try {
    // ─── Phase 1: Boot Sequence ────────────────────────────────────────────────
    logger.info("Starting FaceVision server...");
    
    const bootResult = await bootManager.boot();
    
    if (!bootResult.success) {
      logger.error({ stages: bootResult.stages }, "Boot sequence failed, exiting");
      process.exit(1);
    }
    
    logger.info({ 
      totalDurationMs: bootResult.totalDurationMs,
      stages: bootResult.stages.map(s => `${s.name}:${s.status}`).join(", ")
    }, "Boot sequence completed successfully");
    
    // ─── Phase 2: Start HTTP Server ──────────────────────────────────────────
    const app = createApp();
    
    const server = app.listen(port, () => {
      logger.info({ port }, "FaceVision server listening");
    });
    
    // Handle server errors
    server.on("error", (err) => {
      logger.error({ err }, "Server error");
      process.exit(1);
    });
    
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

main();
