import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Security Logger - FaceVision
 * 
 * Protects sensitive data in logs:
 * - API keys are NEVER logged
 * - Embeddings are NEVER logged
 * - Images are NEVER logged
 * - Personal data is REDACTED
 * - Only hashes and metadata are logged
 */

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  
  // Sensitive data paths to redact
  redact: [
    // Authentication
    "req.headers.authorization",
    "req.headers.cookie",
    "req.headers['x-api-key']",
    "res.headers['set-cookie']",
    
    // Biometric data - NEVER log these
    "*.embedding",
    "*.embeddingVector",
    "*.faceEmbedding",
    "*.faceVector",
    "*.biometricData",
    
    // Images and media
    "*.imageUrl",
    "*.imageData",
    "*.imageBase64",
    "*.imageBuffer",
    "*.thumbnailData",
    "*.faceImage",
    
    // API keys and tokens
    "*.apiKey",
    "*.apiSecret",
    "*.accessToken",
    "*.refreshToken",
    "*.sessionToken",
    "*.bearerToken",
    "*.password",
    "*.privateKey",
    
    // Personal data
    "*.ssn",
    "*.passportNumber",
    "*.nationalId",
    "*.creditCard",
    "*.bankAccount",
    
    // Request bodies (redact sensitive fields)
    "req.body.apiKey",
    "req.body.password",
    "req.body.embedding",
    "req.body.image",
    "req.body.faceData",
    
    // Response bodies
    "res.body.apiKey",
    "res.body.embedding",
  ],
  
  // Base formatters
  base: {
    env: process.env.NODE_ENV,
    service: "facevision-api",
    version: process.env.APP_VERSION ?? "1.0.0",
  },
  
  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Production configuration
  ...(isProduction
    ? {
        // Production: structured JSON for log aggregation
        formatters: {
          level: (label) => ({ level: label }),
        },
      }
    : {
        // Development: pretty printing
        transport: {
          target: "pino-pretty",
          options: { 
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }),
});

/**
 * Security logging helpers
 */

/**
 * Log security event without sensitive data
 */
export function logSecurityEvent(
  event: string,
  data: {
    userId?: string;
    apiKeyId?: string;
    ip?: string;
    action: string;
    resource?: string;
    success: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
) {
  // Hash sensitive identifiers for audit trail
  const sanitizedData = {
    event,
    timestamp: new Date().toISOString(),
    action: data.action,
    resource: data.resource,
    success: data.success,
    reason: data.reason,
    // Only log hashes of IDs, never the actual values
    userIdHash: data.userId ? hashIdentifier(data.userId) : undefined,
    apiKeyIdHash: data.apiKeyId ? hashIdentifier(data.apiKeyId) : undefined,
    ip: data.ip ? hashIp(data.ip) : undefined, // Hash IP for privacy
    metadata: data.metadata,
  };
  
  logger.info(sanitizedData);
}

/**
 * Log API request (without body)
 */
export function logApiRequest(req: {
  method: string;
  path: string;
  ip?: string;
  userAgent?: string;
  apiKeyId?: string;
  responseTime?: number;
  statusCode?: number;
}) {
  logger.info({
    type: "api_request",
    method: req.method,
    path: req.path,
    apiKeyIdHash: req.apiKeyId ? hashIdentifier(req.apiKeyId) : undefined,
    ipHash: req.ip ? hashIp(req.ip) : undefined,
    userAgent: req.userAgent,
    responseTime: req.responseTime,
    statusCode: req.statusCode,
  });
}

/**
 * Log biometric operation (without actual data)
 */
export function logBiometricOperation(op: {
  operation: "ENROLL" | "VERIFY" | "SEARCH" | "DELETE";
  identityId?: string;
  faceCount?: number;
  quality?: number;
  confidence?: number;
  apiKeyId?: string;
  success: boolean;
  duration?: number;
}) {
  logger.info({
    type: "biometric_operation",
    operation: op.operation,
    // NEVER log actual identity IDs - only hash
    identityIdHash: op.identityId ? hashIdentifier(op.identityId) : undefined,
    faceCount: op.faceCount,
    quality: op.quality,
    confidence: op.confidence,
    apiKeyIdHash: op.apiKeyId ? hashIdentifier(op.apiKeyId) : undefined,
    success: op.success,
    duration: op.duration,
  });
}

/**
 * Log model operation (without embeddings)
 */
export function logModelOperation(op: {
  modelName: string;
  modelVersion: string;
  operation: "LOAD" | "INFERENCE" | "UNLOAD";
  duration?: number;
  memoryUsed?: number;
  apiKeyId?: string;
}) {
  logger.info({
    type: "model_operation",
    modelName: op.modelName,
    modelVersion: op.modelVersion,
    operation: op.operation,
    duration: op.duration,
    memoryUsed: op.memoryUsed,
    apiKeyIdHash: op.apiKeyId ? hashIdentifier(op.apiKeyId) : undefined,
  });
}

/**
 * Hash identifier for privacy-preserving logs
 */
function hashIdentifier(id: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(id).digest("hex").substring(0, 16);
}

/**
 * Hash IP for privacy-preserving logs
 */
function hashIp(ip: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(ip).digest("hex").substring(0, 12);
}

/**
 * Create child logger with request context
 */
export function createRequestLogger(context: {
  requestId: string;
  apiKeyId?: string;
  tenantId?: string;
  userId?: string;
}) {
  return logger.child({
    requestId: context.requestId,
    apiKeyIdHash: context.apiKeyId ? hashIdentifier(context.apiKeyId) : undefined,
    tenantId: context.tenantId,
    userIdHash: context.userId ? hashIdentifier(context.userId) : undefined,
  });
}
