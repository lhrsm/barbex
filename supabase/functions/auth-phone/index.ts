/**
 * BARBEX SUPABASE EDGE FUNCTION — AUTH PHONE
 * Handles staff and tenant-scoped customer authentication via Phone + Password.
 * Authenticates against GoTrue via ephemeral client without exposing service_role or PII.
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

export interface SessionDTO {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
}

export type AuthPhonePayload =
  | {
      kind: "staff";
      phone: string;
      password: string;
    }
  | {
      kind: "customer";
      tenantSlug: string;
      phone: string;
      password: string;
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

  // 1. Primary lookup in profiles table
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
 * Executes password authentication against GoTrue using an isolated ephemeral client.
 */
async function authenticateGoTrue(
  email: string,
  password: string
): Promise<
  | { ok: true; session: SessionDTO }
  | { ok: false; code: "INVALID_CREDENTIALS" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE" }
> {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");

  const ephemeralAuthClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: authResult, error: authError } = await ephemeralAuthClient.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    if (authError.status === 429 || (authError.message && authError.message.toLowerCase().includes("rate limit"))) {
      return { ok: false, code: "RATE_LIMITED" };
    }
    if (authError.status && authError.status >= 500) {
      return { ok: false, code: "SERVICE_UNAVAILABLE" };
    }
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }

  const session = authResult?.session;
  if (!session?.access_token || !session?.refresh_token) {
    return { ok: false, code: "SERVICE_UNAVAILABLE" };
  }

  return {
    ok: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type || "bearer",
    },
  };
}

Deno.serve(async (req: Request) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  const logger = createStructuredLogger("auth-phone", req);
  const startTime = Date.now();

  try {
    requireMethod(req, "POST");

    const payload = await parseJsonBody<AuthPhonePayload>(req, 32768); // 32 KB max
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "";

    if (!payload || typeof payload !== "object" || !("kind" in payload)) {
      return buildResponse({ ok: false, code: "INVALID_CREDENTIALS" }, 200, req);
    }

    const adminClient = createAdminClient();

    // -------------------------------------------------------------------------
    // STAFF LOGIN PATH
    // -------------------------------------------------------------------------
    if (payload.kind === "staff") {
      const { phone, password } = payload;
      if (!phone || !password || typeof phone !== "string" || typeof password !== "string") {
        return buildResponse({ ok: false, code: "INVALID_CREDENTIALS" }, 200, req);
      }

      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone || !isValidBrazilianPhone(cleanPhone)) {
        return buildResponse({ ok: false, code: "INVALID_CREDENTIALS" }, 200, req);
      }

      // Rate limit: 10 attempts / 5 minutes (300s)
      const rateLimitKey = await generateRateLimitKey("auth:staff", cleanPhone, undefined, clientIp);
      await checkRateLimit(rateLimitKey, 10, 300);

      // Resolve staff user ID
      const targetUserId = await resolveStaffUserByPhone(cleanPhone, adminClient);
      if (!targetUserId) {
        logger.info("Staff user lookup resulted in zero matches or ambiguity", { kind: "staff", durationMs: Date.now() - startTime });
        return buildResponse({ ok: false, code: "INVALID_CREDENTIALS" }, 200, req);
      }

      // Resolve canonical email from Auth admin API
      const { data: authUserData, error: userError } = await adminClient.auth.admin.getUserById(targetUserId);
      if (userError || !authUserData?.user?.email) {
        return buildResponse({ ok: false, code: "INVALID_CREDENTIALS" }, 200, req);
      }

      const canonicalEmail = authUserData.user.email.trim().toLowerCase();

      // GoTrue password authentication
      const authResult = await authenticateGoTrue(canonicalEmail, password);
      if (!authResult.ok) {
        return buildResponse({ ok: false, code: authResult.code }, 200, req);
      }

      logger.info("Staff authentication successful", { kind: "staff", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true, session: authResult.session }, 200, req);
    }

    // -------------------------------------------------------------------------
    // CUSTOMER LOGIN PATH
    // -------------------------------------------------------------------------
    if (payload.kind === "customer") {
      const { tenantSlug, phone, password } = payload;
      if (!tenantSlug || !phone || !password || typeof tenantSlug !== "string" || typeof phone !== "string" || typeof password !== "string") {
        return buildResponse({ ok: false, code: "INVALID_CREDENTIALS" }, 200, req);
      }

      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone || !isValidBrazilianPhone(cleanPhone)) {
        return buildResponse({ ok: false, code: "INVALID_CREDENTIALS" }, 200, req);
      }

      // Rate limit: 10 attempts / 5 minutes (300s)
      const rateLimitKey = await generateRateLimitKey("auth:customer", cleanPhone, tenantSlug.trim().toLowerCase(), clientIp);
      await checkRateLimit(rateLimitKey, 10, 300);

      // Resolve customer user ID strictly within tenant
      const targetUserId = await resolveCustomerUserByPhone(tenantSlug, cleanPhone, adminClient);
      if (!targetUserId) {
        logger.info("Customer lookup resulted in zero matches or cross-tenant rejection", { kind: "customer", durationMs: Date.now() - startTime });
        return buildResponse({ ok: false, code: "INVALID_CREDENTIALS" }, 200, req);
      }

      // Resolve canonical email from Auth admin API
      const { data: authUserData, error: userError } = await adminClient.auth.admin.getUserById(targetUserId);
      if (userError || !authUserData?.user?.email) {
        return buildResponse({ ok: false, code: "INVALID_CREDENTIALS" }, 200, req);
      }

      const canonicalEmail = authUserData.user.email.trim().toLowerCase();

      // GoTrue password authentication
      const authResult = await authenticateGoTrue(canonicalEmail, password);
      if (!authResult.ok) {
        return buildResponse({ ok: false, code: authResult.code }, 200, req);
      }

      logger.info("Customer authentication successful", { kind: "customer", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true, session: authResult.session }, 200, req);
    }

    return buildResponse({ ok: false, code: "INVALID_CREDENTIALS" }, 200, req);
  } catch (err: unknown) {
    if (err instanceof EdgeError && err.code === "RATE_LIMITED") {
      return buildResponse({ ok: false, code: "RATE_LIMITED" }, 200, req);
    }

    logger.error("Unexpected error during auth-phone execution", {
      durationMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : "Unknown error"
    });

    return buildResponse({ ok: false, code: "SERVICE_UNAVAILABLE" }, 200, req);
  }
});
