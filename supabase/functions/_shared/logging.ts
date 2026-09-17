/**
 * BARBEX SUPABASE EDGE FUNCTIONS — STRUCTURED SAFE LOGGING & REDACTION
 */

import { generateRequestId } from "./crypto.ts";

const SENSITIVE_KEYS = new Set([
  "password",
  "senha",
  "email",
  "phone",
  "telefone",
  "authorization",
  "token",
  "access_token",
  "refresh_token",
  "service_role",
  "service_role_key",
  "secret",
  "api_key",
  "apikey",
  "stripe_secret",
  "stripe_webhook_secret",
  "zapi_token",
  "client_token",
  "resend_key",
  "jwt"
]);

/**
 * Recursively redacts sensitive keys and values from logging objects.
 */
export function redactSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    // Check for Bearer token
    if (obj.toLowerCase().startsWith("bearer ")) {
      return "Bearer [REDACTED]";
    }
    // Check for email pattern
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(obj)) {
      return "[EMAIL_REDACTED]";
    }
    // Check for phone pattern (10 to 14 digits)
    if (/^\+?\d{10,14}$/.test(obj.replace(/\D/g, ""))) {
      return "[PHONE_REDACTED]";
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        SENSITIVE_KEYS.has(lowerKey) ||
        lowerKey.includes("password") ||
        lowerKey.includes("senha") ||
        lowerKey.includes("token") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("auth") ||
        lowerKey.includes("email") ||
        lowerKey.includes("phone") ||
        lowerKey.includes("telefone")
      ) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSensitive(val);
      }
    }
    return result;
  }

  return obj;
}

export interface Logger {
  info(event: string, meta?: Record<string, unknown>): void;
  warn(event: string, meta?: Record<string, unknown>): void;
  error(event: string, meta?: Record<string, unknown>): void;
}

/**
 * Creates a structured JSON logger for Edge Functions.
 */
export function createLogger(functionName: string, requestId?: string): Logger {
  const reqId = requestId || generateRequestId();

  function log(level: "INFO" | "WARN" | "ERROR", event: string, meta?: Record<string, unknown>) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      function: functionName,
      requestId: reqId,
      event,
      ...(meta ? (redactSensitive(meta) as Record<string, unknown>) : {})
    };
    console.log(JSON.stringify(payload));
  }

  return {
    info: (event, meta) => log("INFO", event, meta),
    warn: (event, meta) => log("WARN", event, meta),
    error: (event, meta) => log("ERROR", event, meta)
  };
}
