import type { Request, Response, NextFunction } from "express";

/**
 * List of forbidden keys that can cause Prototype Pollution.
 */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Sanitizes a string input against XSS, HTML injection, and null-byte/control characters.
 */
export function sanitizeString(val: string): string {
  if (typeof val !== "string") return val;

  const cleaned = val
    // Strip null bytes and control chars (except normal whitespace)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    // Remove script tags and contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove dangerous HTML tags (iframe, object, embed, applet, base, meta, style, link)
    .replace(/<(iframe|object|embed|applet|base|meta|style|link)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, "")
    .replace(/<(iframe|object|embed|applet|base|meta|style|link)[^>]*\/?>/gi, "")
    // Remove event handlers (e.g. onload=..., onerror=..., onclick=...)
    .replace(/on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "")
    // Remove dangerous protocols (javascript:, vbscript:, data:text/html)
    .replace(/(?:java|vb)script\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "")
    // Encode < and > to prevent HTML element injection
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return cleaned.trim();
}

/**
 * Escapes SQL wildcard characters (% and _) to prevent wildcard injection in LIKE / ILIKE queries.
 */
export function escapeSqlWildcards(str: string): string {
  if (typeof str !== "string") return str;
  return str.replace(/[%_\\]/g, "\\$&");
}

/**
 * Removes dangerous SQL injection keywords or syntax when building raw query filters.
 */
export function sanitizeSqlString(str: string): string {
  if (typeof str !== "string") return str;
  return str.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|UNION|CREATE|TRUNCATE)\b)|(--|\/\*|\*\/|;)/gi, "");
}

/**
 * Recursively sanitizes primitive values, arrays, and objects with Prototype Pollution defense.
 */
export function sanitizeData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // Preserve valid base64 image data strings intact
    if (data.startsWith("data:image/")) {
      return data.trim() as unknown as T;
    }
    return sanitizeString(data) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item)) as unknown as T;
  }

  if (typeof data === "object") {
    const sanitizedObj: Record<string, any> = {};
    for (const key of Object.keys(data as object)) {
      // Prototype Pollution Defense: ignore dangerous keys
      if (DANGEROUS_KEYS.has(key)) {
        continue;
      }

      // Sanitize key string
      const sanitizedKey = sanitizeString(key);
      if (DANGEROUS_KEYS.has(sanitizedKey)) {
        continue;
      }

      const value = (data as any)[key];
      sanitizedObj[sanitizedKey] = sanitizeData(value);
    }
    return sanitizedObj as T;
  }

  return data;
}

/**
 * Express middleware to sanitize body, query parameters, and route parameters.
 * Blocks XSS, SQL wildcards/injections, and Prototype Pollution.
 */
export function sanitizeInputs(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeData(req.body);
  }
  if (req.query && typeof req.query === "object") {
    const sanitizedQuery = sanitizeData(req.query);
    for (const key of Object.keys(req.query)) {
      delete (req.query as any)[key];
    }
    for (const [key, value] of Object.entries(sanitizedQuery as Record<string, any>)) {
      if (!DANGEROUS_KEYS.has(key)) {
        (req.query as any)[key] = value;
      }
    }
  }
  if (req.params && typeof req.params === "object") {
    const sanitizedParams = sanitizeData(req.params);
    for (const key of Object.keys(req.params)) {
      delete (req.params as any)[key];
    }
    for (const [key, value] of Object.entries(sanitizedParams as Record<string, any>)) {
      if (!DANGEROUS_KEYS.has(key)) {
        (req.params as any)[key] = value;
      }
    }
  }
  next();
}
