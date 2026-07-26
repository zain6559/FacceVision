/**
 * FaceVision — Health Check Service
 * 
 * Provides comprehensive health checks for all system components.
 * Used for monitoring, load balancers, and orchestration systems.
 */

import { db } from "@workspace/db";
import { getModelStatus } from "../modelManager.js";
import { checkConnection } from "@workspace/db";
import { bootManager } from "../boot/index.js";

export interface ComponentHealth {
  name: string;
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
  lastChecked?: Date;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  components: ComponentHealth[];
  overallScore: number; // 0-100
}

/**
 * Check database connectivity.
 */
async function checkDatabase(): Promise<ComponentHealth> {
  try {
    const connected = await checkConnection();
    return {
      name: "database",
      healthy: connected,
      message: connected ? "Connected" : "Connection failed",
      lastChecked: new Date()
    };
  } catch (error) {
    return {
      name: "database",
      healthy: false,
      message: error instanceof Error ? error.message : "Unknown error",
      lastChecked: new Date()
    };
  }
}

/**
 * Check ML models status.
 */
function checkModels(): ComponentHealth {
  const status = getModelStatus();
  return {
    name: "models",
    healthy: status.loaded,
    message: status.loaded ? "Models loaded" : "Models not loaded",
    details: {
      modelPath: status.modelPath,
      modelSize: status.size
    },
    lastChecked: new Date()
  };
}

/**
 * Check boot stages status.
 */
function checkBootStages(): ComponentHealth {
  const summary = bootManager.getSummary();
  return {
    name: "boot",
    healthy: summary.isHealthy,
    message: summary.isHealthy 
      ? "All stages completed" 
      : `Failed at: ${summary.failedStage}`,
    details: summary,
    lastChecked: new Date()
  };
}

/**
 * Get comprehensive health status.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const checks = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkModels()),
    Promise.resolve(checkBootStages())
  ]);

  const healthyCount = checks.filter(c => c.healthy).length;
  const overallScore = Math.round((healthyCount / checks.length) * 100);
  
  let status: SystemHealth["status"];
  if (healthyCount === checks.length) {
    status = "healthy";
  } else if (healthyCount > 0) {
    status = "degraded";
  } else {
    status = "unhealthy";
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    components: checks,
    overallScore
  };
}

/**
 * Simple liveness check - returns true if the server is alive.
 */
export function isAlive(): boolean {
  return true;
}

/**
 * Simple readiness check - returns true if the server can handle requests.
 */
export async function isReady(): Promise<boolean> {
  try {
    const connected = await checkConnection();
    return connected;
  } catch {
    return false;
  }
}
