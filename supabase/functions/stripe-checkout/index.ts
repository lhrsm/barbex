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
import { stripeApiRequest, getTrustedStripeEnvironment } from "../_shared/stripe.ts";
import {
  COMMERCIAL_RULES,
  BLOCKED_LEGACY_PRICE_IDS,
  validatePlanCheckoutContract,
  resolvePriceFromPlanRow,
  validateStripePriceObject,
  type PlanKey,
  type BillingCycle,
} from "../_shared/stripe-pricing.ts";

export type StripeCheckoutAction =
  | {
      action: "create-plan-checkout";
      planKey: "starter" | "pro" | "elite";
      billingCycle: "month" | "year";
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
 * Resolves authenticated tenant owner caller.
 * Enforces canonical financial owner authority: barbershops.owner_id === auth.uid()
 */
async function resolveAuthCaller(
  req: Request,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<{ userId: string; tenantId: string; email: string; callerRole: string; isOwner: boolean }> {
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
  if (!effectiveTenantId) {
    throw new EdgeError("FORBIDDEN", "Tenant não identificado.", 403);
  }

  // Resolve canonical barbershop ownership
  let barbershop: { id: string; owner_id: string | null } | null = null;

  if (profile.tenant_id) {
    const { data: shopById } = await adminClient
      .from("barbershops")
      .select("id, owner_id")
      .eq("id", profile.tenant_id)
      .maybeSingle();

    if (shopById) {
      barbershop = shopById;
    } else {
      const { data: shopByOwner } = await adminClient
        .from("barbershops")
        .select("id, owner_id")
        .eq("owner_id", profile.tenant_id)
        .maybeSingle();
      barbershop = shopByOwner;
    }
  } else {
    const { data: shopByOwner } = await adminClient
      .from("barbershops")
      .select("id, owner_id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (shopByOwner) {
      barbershop = shopByOwner;
    } else {
      const { data: shopById } = await adminClient
        .from("barbershops")
        .select("id, owner_id")
        .eq("id", userId)
        .maybeSingle();
      barbershop = shopById;
    }
  }

  if (!barbershop) {
    throw new EdgeError("FORBIDDEN", "Barbearia não encontrada ou não vinculada ao usuário.", 403);
  }

  // Canonical owner authority: barbershops.owner_id === auth.uid()
  const isOwner = barbershop.owner_id === userId;
  if (!isOwner) {
    throw new EdgeError("FORBIDDEN", "Apenas o proprietário do estabelecimento pode gerenciar assinaturas.", 403);
  }

  return {
    userId,
    tenantId: barbershop.id || effectiveTenantId,
    email: profile.email || user.email || "",
    callerRole: profile.role || "barber",
    isOwner: true
  };
}

/**
 * Searches or creates a Stripe Customer linked via metadata.userId
 */
async function resolveOrCreateStripeCustomer(
  userId: string,
  email: string,
  environment?: "test" | "live" | "sandbox"
): Promise<string> {
  try {
    // 1. Search by metadata
    const searchRes = await stripeApiRequest<{ data: Array<{ id: string; metadata?: Record<string, string> }> }>(
      `/customers/search?query=metadata['userId']:'${userId}'&limit=1`,
      { environment }
    );

    if (searchRes?.data?.length > 0) {
      return searchRes.data[0].id;
    }

    // 2. Search by email
    if (email) {
      const listRes = await stripeApiRequest<{ data: Array<{ id: string; metadata?: Record<string, string> }> }>(
        `/customers?email=${encodeURIComponent(email)}&limit=1`,
        { environment }
      );

      if (listRes?.data?.length > 0) {
        const customer = listRes.data[0];
        // Update metadata.userId if missing
        if (customer.metadata?.userId !== userId) {
          await stripeApiRequest(`/customers/${customer.id}`, {
            method: "POST",
            body: { metadata: { userId } },
            environment
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
      },
      environment
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
      const { planKey, billingCycle, returnUrl, customerEmail } = payload;

      // 1. Strict Contract Validation (no heuristics, no fallback to starter or month)
      const contractVal = validatePlanCheckoutContract(planKey, billingCycle);
      if (!contractVal.ok) {
        throw new EdgeError("INVALID_REQUEST", contractVal.error, 400);
      }

      // 2. Strict Server-Side Trusted Environment Resolution
      const trustedEnv = getTrustedStripeEnvironment();
      const isLive = trustedEnv === "live";

      // Prevent browser tampering across environments
      if (payload.environment && payload.environment !== trustedEnv && !(trustedEnv === "test" && payload.environment === "sandbox")) {
        throw new EdgeError(
          "FORBIDDEN",
          `Ambiente solicitado (${payload.environment}) incompatível com a configuração autorizada do servidor (${trustedEnv}).`,
          403
        );
      }

      const rateLimitKey = await generateRateLimitKey("stripe:checkout", userId, tenantId, clientIp);
      await checkRateLimit(rateLimitKey, 10, 300);

      // 3. Resolve price from database plans table with strict FAIL-CLOSED semantics
      const { data: planRow, error: planErr } = await adminClient
        .from("plans")
        .select("id, slug, name, stripe_price_id_test, stripe_price_id_live, stripe_yearly_price_id_test, stripe_yearly_price_id_live, stripe_product_id_test, stripe_product_id_live")
        .eq("slug", planKey)
        .eq("active", true)
        .maybeSingle();

      if (planErr || !planRow) {
        throw new EdgeError("NOT_FOUND", `Plano "${planKey}" não encontrado ou inativo.`, 404);
      }

      const resolution = resolvePriceFromPlanRow(
        planRow,
        planKey as PlanKey,
        billingCycle as BillingCycle,
        trustedEnv
      );

      if (!resolution.ok) {
        throw new EdgeError(
          resolution.code,
          resolution.error,
          resolution.code === "FORBIDDEN" ? 403 : 422
        );
      }

      const priceId = resolution.priceId;

      // 4. Server-Side Preflight Validation with Stripe API
      let stripePrice: any;
      try {
        stripePrice = await stripeApiRequest(`/prices/${priceId}`, {
          environment: trustedEnv
        });
      } catch (apiErr: any) {
        if (apiErr instanceof EdgeError && apiErr.status === 404) {
          throw new EdgeError("NOT_FOUND", `Preço ${priceId} não foi encontrado no catálogo do Stripe.`, 404);
        }
        if (apiErr instanceof EdgeError && (apiErr.status === 401 || apiErr.status === 403)) {
          throw new EdgeError("SERVICE_UNAVAILABLE", "Credenciais de pagamento inválidas no provedor.", 503);
        }
        throw new EdgeError("SERVICE_UNAVAILABLE", "Indisponibilidade temporária na comunicação com a API do Stripe.", 503);
      }

      const expectedProductId = isLive
        ? (planRow as any)?.stripe_product_id_live
        : (planRow as any)?.stripe_product_id_test;

      const priceValidation = validateStripePriceObject(
        stripePrice,
        planKey as PlanKey,
        billingCycle as BillingCycle,
        isLive,
        expectedProductId
      );

      if (!priceValidation.ok) {
        throw new EdgeError(
          priceValidation.code,
          priceValidation.error,
          priceValidation.code === "FORBIDDEN" ? 403 : 422
        );
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
      const customerId = await resolveOrCreateStripeCustomer(userId, customerEmail || email, trustedEnv);

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
          billingCycle,
          environment: trustedEnv
        },
        subscription_data: {
          metadata: {
            userId,
            tenantId,
            planKey,
            billingCycle,
            environment: trustedEnv
          },
          ...(stripeTrialEnd && { trial_end: stripeTrialEnd })
        }
      };

      const session = await stripeApiRequest<{ id: string; client_secret: string }>("/checkout/sessions", {
        method: "POST",
        body: sessionBody,
        environment: trustedEnv
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
          environment: trustedEnv
        });
      } catch (auditErr) {
        console.warn("[Stripe Checkout] Audit log insert warning:", auditErr);
      }

      logger.info("Plan checkout session initialized", { action: "create-plan-checkout", planKey, billingCycle, environment: trustedEnv, durationMs: Date.now() - startTime });
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
        customerId = await resolveOrCreateStripeCustomer(userId, email, environment);
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
        },
        environment
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
