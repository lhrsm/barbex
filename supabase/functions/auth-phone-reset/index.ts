/**
 * BARBEX SUPABASE EDGE FUNCTION — AUTH PHONE RESET
 * Handles staff and tenant-scoped customer password recovery by Phone with strict Anti-Enumeration.
 * Dispatches reset email server-side via GoTrue resetPasswordForEmail without leaking user existence.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireMethod, parseJsonBody } from "../_shared/validation.ts";
import { normalizePhone, isValidBrazilianPhone } from "../_shared/phone.ts";
import { generateRateLimitKey, checkRateLimit } from "../_shared/rate-limit.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { getRequiredEnv } from "../_shared/env.ts";
import { createStructuredLogger } from "../_shared/logging.ts";
import { generateRequestId } from "../_shared/crypto.ts";
import { EdgeError } from "../_shared/errors.ts";

export const AUTHENTICABLE_STAFF_ROLES = [
  "super_admin",
  "admin",
  "tenant_admin",
  "shop_owner",
  "manager",
  "reception",
  "receptionist",
  "financial",
  "finance",
  "cashier",
  "barber",
  "professional",
] as const;

export type AuthPhoneResetPayload =
  | {
      kind: "staff";
      phone: string;
    }
  | {
      kind: "customer";
      tenantSlug: string;
      phone: string;
    };

function buildResponse(body: Record<string, unknown>, status = 200, req?: Request): Response {
  const requestId = req?.headers?.get("x-request-id") || generateRequestId();
  const cors = getCorsHeaders(req);

  return new Response(
    JSON.stringify({
      ...body,
      requestId
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Content-Type-Options": "nosniff",
        ...cors,
        "x-request-id": requestId
      }
    }
  );
}

/**
 * Resolves an authenticable staff user ID by phone with fail-closed ambiguity checks.
 */
async function resolveStaffUserByPhone(
  cleanPhone: string,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const phoneCandidates = [cleanPhone];
  if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
    phoneCandidates.push(cleanPhone.slice(2));
  }

  // 1. Lookup in profiles table
  const { data: matchedProfiles, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role")
    .in("phone", phoneCandidates)
    .not("phone", "is", null)
    .neq("phone", "")
    .in("role", AUTHENTICABLE_STAFF_ROLES as unknown as string[]);

  if (profileError) return null;
  if (matchedProfiles && matchedProfiles.length > 1) return null; // Ambiguity: fail-closed

  const profileUserId =
    matchedProfiles && matchedProfiles.length === 1 && matchedProfiles[0]?.id
      ? matchedProfiles[0].id
      : null;

  // 2. Fallback lookup in barbers table for active barbers
  const { data: matchedBarbers, error: barberError } = await adminClient
    .from("barbers")
    .select("id, user_id, active")
    .in("phone", phoneCandidates)
    .eq("active", true)
    .not("user_id", "is", null);

  if (barberError) return null;
  if (matchedBarbers && matchedBarbers.length > 1) return null; // Ambiguity: fail-closed

  let barberUserId: string | null = null;
  if (matchedBarbers && matchedBarbers.length === 1 && matchedBarbers[0]?.user_id) {
    const candidateUserId = matchedBarbers[0].user_id;
    const { data: bProfile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", candidateUserId)
      .in("role", AUTHENTICABLE_STAFF_ROLES as unknown as string[])
      .maybeSingle();

    if (bProfile?.id) {
      barberUserId = bProfile.id;
    }
  }

  // 3. Collision resolution & deduplication
  if (profileUserId && barberUserId) {
    if (profileUserId === barberUserId) {
      return profileUserId;
    }
    return null; // Distinct users with same phone -> fail closed
  }

  return profileUserId || barberUserId || null;
}

/**
 * Resolves an authenticable customer user ID within a specific tenant with fail-closed isolation.
 */
async function resolveCustomerUserByPhone(
  tenantSlug: string,
  cleanPhone: string,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const cleanSlug = tenantSlug.trim().toLowerCase();
  if (!cleanSlug) return null;

  // 1. Resolve Tenant ID server-side from profiles table by slug
  const { data: shopProfile, error: shopErr } = await adminClient
    .from("profiles")
    .select("id")
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (shopErr || !shopProfile?.id) {
    return null;
  }

  const effectiveTenantId = shopProfile.id;

  // 2. Phone candidates (with and without DDI 55)
  const phoneCandidates = [cleanPhone];
  if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
    phoneCandidates.push(cleanPhone.slice(2));
  }

  // 3. Match customer in tenant
  const { data: matchedCustomers, error: customerError } = await adminClient
    .from("customers")
    .select("id, user_id, auth_user_id, tenant_id")
    .eq("tenant_id", effectiveTenantId)
    .in("phone", phoneCandidates)
    .not("phone", "is", null)
    .neq("phone", "");

  if (customerError || !matchedCustomers || matchedCustomers.length === 0 || matchedCustomers.length > 1) {
    return null; // Ambiguity or not found -> fail closed
  }

  const customer = matchedCustomers[0];
  const targetUserId = customer.user_id || customer.auth_user_id;
  if (!targetUserId) {
    return null; // Walk-in without Auth account
  }

  // 4. Validate client role strictly
  const { data: clientProfile, error: profErr } = await adminClient
    .from("profiles")
    .select("id, role, tenant_id")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profErr || !clientProfile || clientProfile.role !== "client") {
    return null; // Non-client profile in customer path -> fail closed
  }

  return targetUserId;
}

/**
 * Dispatches password reset email via GoTrue using an ephemeral client.
 */
async function dispatchGoTruePasswordReset(email: string): Promise<"OK" | "RATE_LIMITED" | "FAILED"> {
  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");

    const ephemeralAuthClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const appUrl = Deno.env.get("APP_URL") || "https://barbex.shop";
    const redirectTo = `${appUrl.replace(/\/+$/, "")}/auth/reset-password`;

    const { error: resetError } = await ephemeralAuthClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      if (resetError.status === 429 || (resetError.message && resetError.message.toLowerCase().includes("rate limit"))) {
        return "RATE_LIMITED";
      }
      return "FAILED";
    }

    return "OK";
  } catch {
    return "FAILED";
  }
}

Deno.serve(async (req: Request) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  const logger = createStructuredLogger("auth-phone-reset", req);
  const startTime = Date.now();

  try {
    requireMethod(req, "POST");

    const payload = await parseJsonBody<AuthPhoneResetPayload>(req, 32768); // 32 KB max
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "";

    if (!payload || typeof payload !== "object" || !("kind" in payload)) {
      // Anti-enumeration: neutral response
      return buildResponse({ ok: true }, 200, req);
    }

    const adminClient = createAdminClient();

    // -------------------------------------------------------------------------
    // STAFF PASSWORD RESET PATH
    // -------------------------------------------------------------------------
    if (payload.kind === "staff") {
      const { phone } = payload;
      if (!phone || typeof phone !== "string") {
        return buildResponse({ ok: true }, 200, req);
      }

      // Rate limit: 3 attempts / 10 minutes (600s)
      const rateLimitKey = await generateRateLimitKey("auth:reset:staff", phone, undefined, clientIp);
      await checkRateLimit(rateLimitKey, 3, 600);

      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone || !isValidBrazilianPhone(cleanPhone)) {
        return buildResponse({ ok: true }, 200, req);
      }

      const targetUserId = await resolveStaffUserByPhone(cleanPhone, adminClient);
      if (!targetUserId) {
        logger.info("Staff reset lookup: non-existent or ambiguous", { kind: "staff", durationMs: Date.now() - startTime });
        return buildResponse({ ok: true }, 200, req);
      }

      const { data: authUserData, error: userError } = await adminClient.auth.admin.getUserById(targetUserId);
      if (userError || !authUserData?.user?.email) {
        return buildResponse({ ok: true }, 200, req);
      }

      const canonicalEmail = authUserData.user.email.trim().toLowerCase();
      const dispatchStatus = await dispatchGoTruePasswordReset(canonicalEmail);

      if (dispatchStatus === "RATE_LIMITED") {
        return buildResponse({ ok: false, code: "RATE_LIMITED" }, 200, req);
      }

      logger.info("Staff reset dispatched", { kind: "staff", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true }, 200, req);
    }

    // -------------------------------------------------------------------------
    // CUSTOMER PASSWORD RESET PATH
    // -------------------------------------------------------------------------
    if (payload.kind === "customer") {
      const { tenantSlug, phone } = payload;
      if (!tenantSlug || !phone || typeof tenantSlug !== "string" || typeof phone !== "string") {
        return buildResponse({ ok: true }, 200, req);
      }

      // Rate limit: 3 attempts / 10 minutes (600s)
      const rateLimitKey = await generateRateLimitKey("auth:reset:customer", phone, tenantSlug.trim().toLowerCase(), clientIp);
      await checkRateLimit(rateLimitKey, 3, 600);

      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone || !isValidBrazilianPhone(cleanPhone)) {
        return buildResponse({ ok: true }, 200, req);
      }

      const targetUserId = await resolveCustomerUserByPhone(tenantSlug, cleanPhone, adminClient);
      if (!targetUserId) {
        logger.info("Customer reset lookup: non-existent, cross-tenant or walk-in", { kind: "customer", durationMs: Date.now() - startTime });
        return buildResponse({ ok: true }, 200, req);
      }

      const { data: authUserData, error: userError } = await adminClient.auth.admin.getUserById(targetUserId);
      if (userError || !authUserData?.user?.email) {
        return buildResponse({ ok: true }, 200, req);
      }

      const canonicalEmail = authUserData.user.email.trim().toLowerCase();
      const dispatchStatus = await dispatchGoTruePasswordReset(canonicalEmail);

      if (dispatchStatus === "RATE_LIMITED") {
        return buildResponse({ ok: false, code: "RATE_LIMITED" }, 200, req);
      }

      logger.info("Customer reset dispatched", { kind: "customer", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true }, 200, req);
    }

    return buildResponse({ ok: true }, 200, req);
  } catch (err: unknown) {
    if (err instanceof EdgeError && err.code === "RATE_LIMITED") {
      return buildResponse({ ok: false, code: "RATE_LIMITED" }, 200, req);
    }

    logger.error("Unexpected error during auth-phone-reset execution", {
      durationMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : "Unknown error"
    });

    // In password reset, fail open/neutral for anti-enumeration unless rate limited
    return buildResponse({ ok: true }, 200, req);
  }
});
