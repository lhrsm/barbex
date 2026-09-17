/**
 * BARBEX SUPABASE EDGE FUNCTIONS — SHARED STRIPE MODULE
 * Direct, lightweight, Deno-native Stripe API client and Webhook validator.
 * Pinned API Version: 2025-01-27.acacia
 */

import { getOptionalEnv, getRequiredEnv } from "./env.ts";
import { EdgeError } from "./errors.ts";

export const STRIPE_API_VERSION = "2025-01-27.acacia";
const STRIPE_BASE_URL = "https://api.stripe.com/v1";

export function getStripeSecretKey(): string {
  // Checks environment variables in order of specificity
  const key = getOptionalEnv("STRIPE_SECRET_KEY") ||
              getOptionalEnv("STRIPE_TEST_SECRET_KEY") ||
              getOptionalEnv("STRIPE_SANDBOX_API_KEY");
  if (!key) {
    throw new EdgeError("SERVICE_UNAVAILABLE", "Chave do Stripe não configurada no ambiente.", 503);
  }
  return key;
}

export function getStripeWebhookSecret(): string {
  const secret = getOptionalEnv("STRIPE_WEBHOOK_SECRET") ||
                 getOptionalEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET") ||
                 getOptionalEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");
  if (!secret) {
    throw new EdgeError("SERVICE_UNAVAILABLE", "Chave secreta do webhook Stripe não configurada.", 503);
  }
  return secret;
}

/**
 * Executes an authenticated HTTP request to the Stripe REST API.
 */
export async function stripeApiRequest<T = any>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    body?: Record<string, unknown> | URLSearchParams;
    idempotencyKey?: string;
    apiKey?: string;
  } = {}
): Promise<T> {
  const apiKey = options.apiKey || getStripeSecretKey();
  const method = options.method || "GET";
  const url = `${STRIPE_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  let requestBody: string | undefined;

  if (method === "POST" || method === "DELETE") {
    if (options.body instanceof URLSearchParams) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      requestBody = options.body.toString();
    } else if (options.body && typeof options.body === "object") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      requestBody = serializeStripeParams(options.body).toString();
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: requestBody,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMessage = "Erro na comunicação com o provedor de pagamentos.";
    try {
      const errJson = JSON.parse(errorBody);
      if (errJson?.error?.message) {
        parsedMessage = errJson.error.message;
      }
    } catch {
      // Keep generic error message
    }
    console.error(`[Stripe API Error] Status: ${response.status}, Endpoint: ${endpoint}, Message: ${parsedMessage}`);
    throw new EdgeError("SERVICE_UNAVAILABLE", `Stripe: ${parsedMessage}`, response.status === 400 ? 400 : 502);
  }

  return await response.json() as T;
}

/**
 * Serializes nested objects and arrays into standard application/x-www-form-urlencoded format expected by Stripe.
 */
export function serializeStripeParams(obj: Record<string, any>, prefix = ""): URLSearchParams {
  const params = new URLSearchParams();

  function buildParams(data: any, currentPrefix: string) {
    if (data === null || data === undefined) return;

    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        buildParams(data[i], `${currentPrefix}[${i}]`);
      }
    } else if (typeof data === "object" && !(data instanceof Date)) {
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null) {
          const nextPrefix = currentPrefix ? `${currentPrefix}[${key}]` : key;
          buildParams(value, nextPrefix);
        }
      }
    } else {
      params.append(currentPrefix, String(data));
    }
  }

  buildParams(obj, prefix);
  return params;
}

/**
 * Validates Stripe webhook signatures using native Web Crypto HMAC SHA-256.
 */
export async function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret?: string
): Promise<boolean> {
  if (!signatureHeader || !rawBody) {
    return false;
  }

  const secret = webhookSecret || getStripeWebhookSecret();

  let timestamp: string | undefined;
  const signatures: string[] = [];

  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "t") timestamp = value?.trim();
    if (key?.trim() === "v1") signatures.push(value?.trim());
  }

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const eventTime = parseInt(timestamp, 10);
  if (isNaN(eventTime) || Math.abs(now - eventTime) > 300) {
    // Timestamp difference > 5 minutes (prevent replay attacks)
    return false;
  }

  const payloadToSign = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadToSign)
  );

  const expectedSignature = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some((sig) => timingSafeEqualHex(sig, expectedSignature));
}

/**
 * Constant-time hex string comparison to prevent timing attacks.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
