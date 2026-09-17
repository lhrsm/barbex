/**
 * BARBEX SUPABASE EDGE FUNCTION — STRIPE CHECKOUT & BILLING PORTAL
 * Actions:
 * - create-plan-checkout: Resolves SaaS plan price, customer, trial and creates embedded checkout session
 * - create-portal-session: Resolves customer and creates Stripe customer billing portal session
 */

import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireMethod, parseJsonBody } from "../_shared/validation.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { extractBearerToken } from "../_shared/auth.ts";
import { createStructuredLogger } from "../_shared/logging.ts";
import { generateRequestId } from "../_shared/crypto.ts";
import { EdgeError } from "../_shared/errors.ts";
import { generateRateLimitKey, checkRateLimit } from "../_shared/rate-limit.ts";
import { stripeApiRequest } from "../_shared/stripe.ts";

export type StripeCheckoutAction =
  | {
      action: "create-plan-checkout";
      planKey: "starter" | "pro" | "elite";
      environment?: "test" | "live" | "sandbox";
      returnUrl?: string;
      customerEmail?: string;
    }
  | {
      action: "create-portal-session";
      environment?: "test" | "live" | "sandbox";
      returnUrl?: string;
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
 * Resolves authenticated tenant owner / admin caller.
 */
async function resolveAuthCaller(
  req: Request,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<{ userId: string; tenantId: string; email: string; callerRole: string }> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new EdgeError("UNAUTHORIZED", "Token de autenticação ausente ou inválido.", 401);
  }

  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) {
    throw new EdgeError("UNAUTHORIZED", "Sessão expirada ou não autorizada.", 401);
  }

  const userId = user.id;
  const { data: profile, error: profErr } = await adminClient
    .from("profiles")
    .select("id, role, tenant_id, email, display_name, business_name")
    .eq("id", userId)
    .maybeSingle();

  if (profErr || !profile) {
    throw new EdgeError("FORBIDDEN", "Perfil de usuário não encontrado.", 403);
  }

  const effectiveTenantId = profile.tenant_id || profile.id;
  const isPrivileged = ["super_admin", "admin", "tenant_admin", "shop_owner"].includes(profile.role || "");

  if (!isPrivileged) {
    throw new EdgeError("FORBIDDEN", "Apenas administradores e proprietários podem gerenciar assinaturas.", 403);
  }

  return {
    userId,
    tenantId: effectiveTenantId,
    email: profile.email || user.email || "",
    callerRole: profile.role || "admin"
  };
}

/**
 * Searches or creates a Stripe Customer linked via metadata.userId
 */
async function resolveOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  try {
    // 1. Search by metadata
    const searchRes = await stripeApiRequest<{ data: Array<{ id: string; metadata?: Record<string, string> }> }>(
      `/customers/search?query=metadata['userId']:'${userId}'&limit=1`
    );

    if (searchRes?.data?.length > 0) {
      return searchRes.data[0].id;
    }

    // 2. Search by email
    if (email) {
      const listRes = await stripeApiRequest<{ data: Array<{ id: string; metadata?: Record<string, string> }> }>(
        `/customers?email=${encodeURIComponent(email)}&limit=1`
      );

      if (listRes?.data?.length > 0) {
        const customer = listRes.data[0];
        // Update metadata.userId if missing
        if (customer.metadata?.userId !== userId) {
          await stripeApiRequest(`/customers/${customer.id}`, {
            method: "POST",
            body: { metadata: { userId } }
          });
        }
        return customer.id;
      }
    }

    // 3. Create new Customer
    const created = await stripeApiRequest<{ id: string }>("/customers", {
      method: "POST",
      body: {
        email: email || undefined,
        metadata: { userId }
      }
    });

    return created.id;
  } catch (err) {
    console.error(`[Stripe Checkout] Failed to resolve/create customer: ${err}`);
    throw new EdgeError("SERVICE_UNAVAILABLE", "Falha ao vincular cliente no provedor de pagamentos.", 503);
  }
}

Deno.serve(async (req: Request) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  const logger = createStructuredLogger("stripe-checkout", req);
  const startTime = Date.now();

  try {
    requireMethod(req, "POST");

    const payload = await parseJsonBody<StripeCheckoutAction>(req, 32768);
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "";
    const adminClient = createAdminClient();

    if (!payload || typeof payload !== "object" || !("action" in payload)) {
      throw new EdgeError("INVALID_REQUEST", "Ação não especificada ou inválida.", 400);
    }

    const { userId, tenantId, email } = await resolveAuthCaller(req, adminClient);

    // -------------------------------------------------------------------------
    // ACTION: CREATE-PLAN-CHECKOUT
    // -------------------------------------------------------------------------
    if (payload.action === "create-plan-checkout") {
      const { planKey, environment = "test", returnUrl, customerEmail } = payload;

      if (!planKey || !["starter", "pro", "elite"].includes(planKey)) {
        throw new EdgeError("INVALID_REQUEST", "Plano selecionado inválido. Escolha starter, pro ou elite.", 400);
      }

      const rateLimitKey = await generateRateLimitKey("stripe:checkout", userId, tenantId, clientIp);
      await checkRateLimit(rateLimitKey, 10, 300);

      // 1. Resolve price from database plans table
      const { data: planRow, error: planErr } = await adminClient
        .from("plans")
        .select("id, slug, name, stripe_price_id_test, stripe_price_id_live")
        .eq("slug", planKey)
        .eq("active", true)
        .maybeSingle();

      if (planErr || !planRow) {
        throw new EdgeError("NOT_FOUND", `Plano "${planKey}" não encontrado ou inativo.`, 404);
      }

      const isLive = environment === "live";
      const priceId = isLive ? planRow.stripe_price_id_live : planRow.stripe_price_id_test;

      if (!priceId) {
        throw new EdgeError("INVALID_REQUEST", `O plano ${planRow.name} não possui preço configurado para este ambiente.`, 400);
      }

      // 2. Resolve Trial remaining seconds from profile
      const { data: profile } = await adminClient
        .from("profiles")
        .select("trial_end")
        .eq("id", userId)
        .maybeSingle();

      const trialEnd = profile?.trial_end ? new Date(profile.trial_end) : null;
      const now = new Date();
      const trialRemainingSeconds = trialEnd && trialEnd > now
        ? Math.floor((trialEnd.getTime() - now.getTime()) / 1000)
        : 0;

      const stripeTrialEnd = trialRemainingSeconds > 60
        ? Math.floor(Date.now() / 1000) + trialRemainingSeconds
        : undefined;

      // 3. Resolve Customer in Stripe
      const customerId = await resolveOrCreateStripeCustomer(userId, customerEmail || email);

      // 4. Safe Return URL validation
      const appUrl = Deno.env.get("APP_URL") || "https://barbex.shop";
      let safeReturnUrl = `${appUrl.replace(/\/+$/, "")}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
      if (returnUrl && (returnUrl.startsWith("https://barbex.shop") || returnUrl.startsWith("http://localhost"))) {
        safeReturnUrl = returnUrl.includes("{CHECKOUT_SESSION_ID}")
          ? returnUrl
          : `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
      }

      // 5. Create Stripe Checkout Session
      const sessionBody: Record<string, any> = {
        mode: "subscription",
        ui_mode: "embedded",
        customer: customerId,
        return_url: safeReturnUrl,
        billing_address_collection: "required",
        customer_update: {
          address: "auto",
          name: "auto"
        },
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        metadata: {
          userId,
          tenantId,
          plan: planRow.name,
          planKey,
          environment
        },
        subscription_data: {
          metadata: {
            userId,
            tenantId,
            planKey,
            environment
          },
          ...(stripeTrialEnd && { trial_end: stripeTrialEnd })
        }
      };

      const session = await stripeApiRequest<{ id: string; client_secret: string }>("/checkout/sessions", {
        method: "POST",
        body: sessionBody
      });

      // 6. Audit session in saas_checkout_sessions
      try {
        await adminClient.from("saas_checkout_sessions").insert({
          tenant_id: tenantId,
          user_id: userId,
          plan_key: planKey,
          stripe_price_id: priceId,
          stripe_checkout_session_id: session.id,
          status: "pending",
          environment
        });
      } catch (auditErr) {
        console.warn("[Stripe Checkout] Audit log insert warning:", auditErr);
      }

      logger.info("Plan checkout session initialized", { action: "create-plan-checkout", planKey, durationMs: Date.now() - startTime });
      return buildResponse({ ok: true, clientSecret: session.client_secret, sessionId: session.id }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: CREATE-PORTAL-SESSION
    // -------------------------------------------------------------------------
    if (payload.action === "create-portal-session") {
      const { environment = "test", returnUrl } = payload;

      const rateLimitKey = await generateRateLimitKey("stripe:portal", userId, tenantId, clientIp);
      await checkRateLimit(rateLimitKey, 10, 300);

      // 1. Check subscriptions table for existing customer ID
      const { data: sub } = await adminClient
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let customerId = sub?.stripe_customer_id;
      if (!customerId) {
        customerId = await resolveOrCreateStripeCustomer(userId, email);
      }

      const appUrl = Deno.env.get("APP_URL") || "https://barbex.shop";
      let safeReturnUrl = `${appUrl.replace(/\/+$/, "")}/admin/subscriptions`;
      if (returnUrl && (returnUrl.startsWith("https://barbex.shop") || returnUrl.startsWith("http://localhost"))) {
        safeReturnUrl = returnUrl;
      }

      const portalSession = await stripeApiRequest<{ url: string }>("/billing_portal/sessions", {
        method: "POST",
        body: {
          customer: customerId,
          return_url: safeReturnUrl
        }
      });

      logger.info("Billing portal session created", { action: "create-portal-session", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true, url: portalSession.url }, 200, req);
    }

    throw new EdgeError("INVALID_REQUEST", "Ação desconhecida.", 400);
  } catch (err: unknown) {
    if (err instanceof EdgeError) {
      return buildResponse({ ok: false, code: err.code, error: err.message }, err.status, req);
    }

    logger.error("Unexpected error during stripe-checkout execution", {
      durationMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : "Unknown error"
    });

    return buildResponse({ ok: false, code: "SERVICE_UNAVAILABLE", error: "Serviço de pagamentos temporariamente indisponível." }, 503, req);
  }
});
