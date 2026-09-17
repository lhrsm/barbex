/**
 * BARBEX SUPABASE EDGE FUNCTIONS — ATOMIC PRIVACY-PRESERVING RATE LIMITING
 */

import { sha256Hex } from "./crypto.ts";
import { EdgeError } from "./errors.ts";
import { createAdminClient } from "./supabase-admin.ts";

/**
 * Generates an opaque, privacy-preserving rate limit key using SHA-256 hashes.
 * Never stores raw phone numbers or emails in database tables or logs.
 */
export async function generateRateLimitKey(
  context: string,
  identifier: string,
  tenantId?: string,
  ip?: string
): Promise<string> {
  const normalizedId = identifier.trim().toLowerCase();
  const idHash = await sha256Hex(normalizedId);
  const ipSuffix = ip && ip.trim() ? `:${(await sha256Hex(ip.trim())).substring(0, 16)}` : "";

  if (tenantId) {
    const tenantHash = await sha256Hex(tenantId);
    return `rl:${context}:${tenantHash.substring(0, 16)}:${idHash.substring(0, 32)}${ipSuffix}`;
  }

  return `rl:${context}:${idHash.substring(0, 32)}${ipSuffix}`;
}

/**
 * Enforces rate limiting against the atomic check_rate_limit PostgreSQL RPC.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.rpc("check_rate_limit", {
      p_key: key,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    });

    if (error) {
      console.warn(`[RateLimit Warning] RPC check_rate_limit failed: ${error.message}. Allowing request conservatively.`);
      return { allowed: true, remaining: maxRequests - 1 };
    }

    const allowed = data === true || data?.allowed === true;
    if (!allowed) {
      throw new EdgeError(
        "RATE_LIMITED",
        "Muitas requisições enviadas. Aguarde alguns instantes antes de tentar novamente.",
        429
      );
    }

    return {
      allowed: true,
      remaining: typeof data?.remaining === "number" ? data.remaining : maxRequests - 1
    };
  } catch (err) {
    if (err instanceof EdgeError) throw err;
    console.warn(`[RateLimit Exception] Error evaluating rate limit: ${err}`);
    return { allowed: true, remaining: maxRequests - 1 };
  }
}
