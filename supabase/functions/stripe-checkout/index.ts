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
    }
  | {
      action: "cancel-subscription-period-end";
      reason?: string;
      feedback?: string;
      environment?: "test" | "live" | "sandbox";
    }
  | {
      action: "reactivate-subscription";
      environment?: "test" | "live" | "sandbox";
    }
  | {
      action: "preview-subscription-cancellation";
      environment?: "test" | "live" | "sandbox";
    }
  | {
      action: "request-cancellation-with-refund";
      mode: "cooling_off" | "proportional";
      expectedRefundCents: number;
      reason?: string;
      feedback?: string;
      environment?: "test" | "live" | "sandbox";
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Canary financial safeguards:
 * - ENABLE_SELF_SERVICE_REFUNDS: global boolean kill-switch
 * - REFUND_ALLOWED_TENANTS: comma-separated list of UUIDs authorized for self-service refunds
 * - REFUND_MAX_CENTS_PER_OPERATION: maximum refundable cents allowed in canary (default: 6000 cents / R$ 60,00)
 */
function evaluateRefundCanaryAccess(tenantId: string): {
  allowed: boolean;
  reason?: string;
  maxRefundCents: number;
} {
  const maxCentsEnv = Deno.env.get("REFUND_MAX_CENTS_PER_OPERATION");
  let maxRefundCents = 6000; // R$ 60,00 default
  if (maxCentsEnv) {
    const parsed = parseInt(maxCentsEnv, 10);
    if (!isNaN(parsed) && parsed > 0) {
      maxRefundCents = parsed;
    }
  }

  // 1. Global Kill-Switch (ENABLE_SELF_SERVICE_REFUNDS)
  const globalEnabled = Deno.env.get("ENABLE_SELF_SERVICE_REFUNDS") === "true";
  if (!globalEnabled) {
    return {
      allowed: false,
      reason: "Operações automáticas de estorno estão temporariamente desabilitadas para manutenção preventiva. Por favor, contate o suporte.",
      maxRefundCents
    };
  }

  // 2. Tenant Allowlist (REFUND_ALLOWED_TENANTS)
  const rawAllowlist = Deno.env.get("REFUND_ALLOWED_TENANTS") || "";
  const trimmed = rawAllowlist.trim();

  // Fail-closed if allowlist is absent or empty
  if (!trimmed) {
    return {
      allowed: false,
      reason: "O autoatendimento de estorno está em fase de liberação gradual e ainda não está ativo para este estabelecimento. Por favor, contate o suporte.",
      maxRefundCents
    };
  }

  // Wildcards strictly rejected
  if (trimmed.includes("*")) {
    console.error("[Stripe Checkout Canary Security] Wildcard in REFUND_ALLOWED_TENANTS is strictly prohibited. Failing closed.");
    return {
      allowed: false,
      reason: "O autoatendimento de estorno está temporariamente indisponível devido a configuração restritiva. Por favor, contate o suporte.",
      maxRefundCents
    };
  }

  // Parse comma-separated UUIDs and validate format
  const allowedUuids = trimmed
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => UUID_REGEX.test(s));

  if (!allowedUuids.includes(tenantId.toLowerCase())) {
    return {
      allowed: false,
      reason: "O autoatendimento de estorno está em fase de liberação gradual e ainda não está ativo para este estabelecimento. Por favor, contate o suporte.",
      maxRefundCents
    };
  }

  return {
    allowed: true,
    maxRefundCents
  };
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

  // Canonical tenant & barbershop resolution: strictly authoritative tenant or owned barbershop
  let barbershop: { id: string; owner_id: string | null } | null = null;

  if (profile.tenant_id) {
    const { data: shopById } = await adminClient
      .from("barbershops")
      .select("id, owner_id")
      .eq("id", profile.tenant_id)
      .maybeSingle();

    if (shopById) {
      barbershop = shopById;
    }
  } else {
    // If profile.tenant_id is null, resolve barbershop strictly by owner_id
    const { data: shopByOwner } = await adminClient
      .from("barbershops")
      .select("id, owner_id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (shopByOwner) {
      barbershop = shopByOwner;
    }
  }

  if (!barbershop) {
    throw new EdgeError("FORBIDDEN", "Barbearia não encontrada ou não vinculada ao usuário.", 403);
  }

  // Canonical owner authority: barbershops.owner_id === auth.uid()
  // No implicit user_id === tenant_id collapse, no fallback to role
  const isOwner = barbershop.owner_id === userId;
  if (!isOwner) {
    throw new EdgeError("FORBIDDEN", "Apenas o proprietário do estabelecimento pode gerenciar assinaturas.", 403);
  }

  return {
    userId,
    tenantId: barbershop.id,
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

    // -------------------------------------------------------------------------
    // ACTION: CANCEL-SUBSCRIPTION-PERIOD-END
    // -------------------------------------------------------------------------
    if (payload.action === "cancel-subscription-period-end") {
      const trustedEnv = getTrustedStripeEnvironment();
      const rateLimitKey = await generateRateLimitKey("stripe:cancel-pe", userId, tenantId, clientIp);
      await checkRateLimit(rateLimitKey, 5, 300);

      // 1. Locate canonical commercial subscription for this tenant/user
      const { data: sub, error: subErr } = await adminClient
        .from("subscriptions")
        .select("*")
        .or(`user_id.eq.${tenantId},user_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr || !sub || !sub.stripe_subscription_id) {
        throw new EdgeError("NOT_FOUND", "Nenhuma assinatura ativa encontrada para este estabelecimento.", 404);
      }

      if (sub.status === "canceled") {
        throw new EdgeError("CONFLICT", "A assinatura deste estabelecimento já se encontra cancelada.", 409);
      }

      if (!["active", "trialing", "past_due"].includes(sub.status)) {
        throw new EdgeError("CONFLICT", `Não é possível agendar cancelamento de uma assinatura com status '${sub.status}'.`, 409);
      }

      // Idempotency check: if already scheduled for cancellation
      if (sub.cancel_at_period_end) {
        logger.info("Subscription cancel_at_period_end already scheduled (idempotent)", {
          subscriptionId: sub.stripe_subscription_id,
          tenantId,
          durationMs: Date.now() - startTime
        });
        return buildResponse({
          ok: true,
          success: true,
          subscription_status: sub.status,
          cancel_at_period_end: true,
          current_period_end: sub.current_period_end,
          message: "O cancelamento ao término do período vigente já estava agendado."
        }, 200, req);
      }

      // 2. Schedule cancellation in Stripe
      const stripeSub = await stripeApiRequest<{ id: string; cancel_at_period_end: boolean; current_period_end?: number; cancel_at?: number; canceled_at?: number }>(
        `/subscriptions/${sub.stripe_subscription_id}`,
        {
          method: "POST",
          body: {
            cancel_at_period_end: "true"
          },
          idempotencyKey: `cancel-pe-${tenantId}-${sub.stripe_subscription_id}`,
          environment: trustedEnv
        }
      );

      if (!stripeSub || !stripeSub.cancel_at_period_end) {
        throw new EdgeError("SERVICE_UNAVAILABLE", "O provedor de pagamentos não confirmou o agendamento do cancelamento.", 502);
      }

      // 3. Update Supabase subscriptions record
      const updateData: Record<string, unknown> = {
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      };
      if (stripeSub.cancel_at) {
        updateData.cancel_at = new Date(stripeSub.cancel_at * 1000).toISOString();
      } else if (sub.current_period_end) {
        updateData.cancel_at = sub.current_period_end;
      }
      if (stripeSub.canceled_at) {
        updateData.canceled_at = new Date(stripeSub.canceled_at * 1000).toISOString();
      } else {
        updateData.canceled_at = new Date().toISOString();
      }
      if (payload.reason) updateData.cancellation_reason = String(payload.reason).slice(0, 500);
      if (payload.feedback) updateData.cancellation_feedback = String(payload.feedback).slice(0, 1000);
      updateData.cancellation_actor_id = userId;

      try {
        await adminClient
          .from("subscriptions")
          .update(updateData)
          .eq("id", sub.id);
      } catch (_dbErr) {
        // Fallback update with existing columns if migration columns not yet in DB
        await adminClient
          .from("subscriptions")
          .update({
            cancel_at_period_end: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", sub.id);
      }

      // 4. Audit Log
      try {
        await adminClient.from("audit_logs").insert({
          user_id: userId,
          target_id: tenantId,
          action: "subscription.cancel_at_period_end",
          details: {
            source: "tenant_self_service",
            stripe_subscription_id: sub.stripe_subscription_id,
            reason: payload.reason || "Não informado",
            feedback: payload.feedback || null,
            current_period_end: sub.current_period_end,
            actor_email: email
          },
          ip_address: clientIp
        });
      } catch (auditErr) {
        logger.warn("Audit log insert warning:", auditErr);
      }

      logger.info("Cancel at period end scheduled by tenant owner", {
        tenantId,
        subscriptionId: sub.stripe_subscription_id,
        durationMs: Date.now() - startTime
      });

      return buildResponse({
        ok: true,
        success: true,
        subscription_status: sub.status,
        cancel_at_period_end: true,
        current_period_end: sub.current_period_end,
        message: "Cancelamento agendado com sucesso para o término do ciclo atual."
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: REACTIVATE-SUBSCRIPTION
    // -------------------------------------------------------------------------
    if (payload.action === "reactivate-subscription") {
      const trustedEnv = getTrustedStripeEnvironment();
      const rateLimitKey = await generateRateLimitKey("stripe:reactivate", userId, tenantId, clientIp);
      await checkRateLimit(rateLimitKey, 5, 300);

      // 1. Locate canonical commercial subscription for this tenant/user
      const { data: sub, error: subErr } = await adminClient
        .from("subscriptions")
        .select("*")
        .or(`user_id.eq.${tenantId},user_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr || !sub || !sub.stripe_subscription_id) {
        throw new EdgeError("NOT_FOUND", "Nenhuma assinatura encontrada para este estabelecimento.", 404);
      }

      if (sub.status === "canceled") {
        throw new EdgeError("CONFLICT", "Não é possível reativar uma assinatura cujo período já foi encerrado definitivamente.", 409);
      }

      if (!["active", "trialing", "past_due"].includes(sub.status)) {
        throw new EdgeError("CONFLICT", `Não é possível reativar uma assinatura com status definitivo '${sub.status}'.`, 409);
      }

      // Idempotency check: if not scheduled for cancellation
      if (!sub.cancel_at_period_end) {
        logger.info("Subscription already active for continuous renewal (idempotent)", {
          subscriptionId: sub.stripe_subscription_id,
          tenantId,
          durationMs: Date.now() - startTime
        });
        return buildResponse({
          ok: true,
          success: true,
          subscription_status: sub.status,
          cancel_at_period_end: false,
          current_period_end: sub.current_period_end,
          message: "A assinatura já está configurada para renovação contínua."
        }, 200, req);
      }

      // 2. Un-schedule cancellation in Stripe
      const stripeSub = await stripeApiRequest<{ id: string; cancel_at_period_end: boolean; current_period_end?: number }>(
        `/subscriptions/${sub.stripe_subscription_id}`,
        {
          method: "POST",
          body: {
            cancel_at_period_end: "false"
          },
          idempotencyKey: `reactivate-${tenantId}-${sub.stripe_subscription_id}`,
          environment: trustedEnv
        }
      );

      if (!stripeSub || stripeSub.cancel_at_period_end !== false) {
        throw new EdgeError("SERVICE_UNAVAILABLE", "O provedor de pagamentos não confirmou a reversão do cancelamento.", 502);
      }

      // 3. Update Supabase subscriptions record
      const updateData: Record<string, unknown> = {
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
        cancel_at: null,
        cancellation_reason: null,
        cancellation_feedback: null
      };

      try {
        await adminClient
          .from("subscriptions")
          .update(updateData)
          .eq("id", sub.id);
      } catch (_dbErr) {
        await adminClient
          .from("subscriptions")
          .update({
            cancel_at_period_end: false,
            updated_at: new Date().toISOString()
          })
          .eq("id", sub.id);
      }

      // 4. Audit Log
      try {
        await adminClient.from("audit_logs").insert({
          user_id: userId,
          target_id: tenantId,
          action: "subscription.reactivate",
          details: {
            source: "tenant_self_service",
            stripe_subscription_id: sub.stripe_subscription_id,
            current_period_end: sub.current_period_end,
            actor_email: email
          },
          ip_address: clientIp
        });
      } catch (auditErr) {
        logger.warn("Audit log insert warning:", auditErr);
      }

      logger.info("Subscription reactivation scheduled by tenant owner", {
        tenantId,
        subscriptionId: sub.stripe_subscription_id,
        durationMs: Date.now() - startTime
      });

      return buildResponse({
        ok: true,
        success: true,
        subscription_status: sub.status,
        cancel_at_period_end: false,
        current_period_end: sub.current_period_end,
        message: "Assinatura mantida com sucesso. A renovação automática continuará ativa."
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: PREVIEW-SUBSCRIPTION-CANCELLATION
    // -------------------------------------------------------------------------
    if (payload.action === "preview-subscription-cancellation") {
      const trustedEnv = getTrustedStripeEnvironment();
      const rateLimitKey = await generateRateLimitKey("stripe:preview-cancel", userId, tenantId, clientIp);
      await checkRateLimit(rateLimitKey, 15, 300);

      // 1. Locate canonical commercial subscription for this tenant/user
      const { data: sub, error: subErr } = await adminClient
        .from("subscriptions")
        .select("*")
        .or(`user_id.eq.${tenantId},user_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr || !sub || !sub.stripe_subscription_id) {
        throw new EdgeError("NOT_FOUND", "Nenhuma assinatura ativa encontrada para este estabelecimento.", 404);
      }

      if (sub.status === "canceled") {
        throw new EdgeError("CONFLICT", "A assinatura deste estabelecimento já se encontra cancelada.", 409);
      }

      // 2. Fetch live subscription data from Stripe
      const stripeSub = await stripeApiRequest<any>(
        `/subscriptions/${sub.stripe_subscription_id}`,
        { environment: trustedEnv }
      );

      // 3. Fetch latest paid invoice from Stripe
      let latestInvoice: any = null;
      if (stripeSub?.latest_invoice) {
        const invId = typeof stripeSub.latest_invoice === "string" ? stripeSub.latest_invoice : stripeSub.latest_invoice.id;
        try {
          latestInvoice = await stripeApiRequest<any>(
            `/invoices/${invId}?expand[]=payment_intent`,
            { environment: trustedEnv }
          );
        } catch (e) {
          logger.warn("Could not fetch latest_invoice directly, searching by subscription:", e);
        }
      }

      if (!latestInvoice) {
        try {
          const invList = await stripeApiRequest<{ data: any[] }>(
            `/invoices?subscription=${sub.stripe_subscription_id}&status=paid&limit=1`,
            { environment: trustedEnv }
          );
          if (invList?.data?.length > 0) {
            const firstInv = invList.data[0];
            latestInvoice = await stripeApiRequest<any>(
              `/invoices/${firstInv.id}?expand[]=payment_intent`,
              { environment: trustedEnv }
            );
          }
        } catch (e) {
          logger.warn("Could not fetch invoices by subscription:", e);
        }
      }

      // 4. Calculate captured amount & refunds already issued (with pagination)
      let capturedAmountCents = 0;
      let totalAlreadyRefundedCents = 0;
      let currency = (latestInvoice?.currency || "brl").toLowerCase();
      let piId: string | null = null;
      let hasActiveDispute = false;

      if (latestInvoice) {
        const pi = latestInvoice.payment_intent;
        piId = typeof pi === "string" ? pi : pi?.id || null;
        capturedAmountCents = (typeof pi === "object" ? pi?.amount_received : null) ?? latestInvoice.amount_paid ?? 0;

        if (piId) {
          // P0-03: Dispute & Chargeback Preflight
          try {
            const piExpanded = await stripeApiRequest<any>(
              `/payment_intents/${piId}?expand[]=charges.data.dispute`,
              { environment: trustedEnv }
            );
            const charges = piExpanded?.charges?.data || [];
            for (const ch of charges) {
              if (ch.disputed || ch.dispute) {
                hasActiveDispute = true;
                break;
              }
            }
          } catch (dispErr) {
            logger.warn("Dispute check warning in preview:", dispErr);
          }

          // P2-02: Paginated refund lookup
          try {
            let hasMore = true;
            let startingAfter: string | undefined = undefined;
            while (hasMore) {
              const url: string = `/refunds?payment_intent=${piId}&limit=100${startingAfter ? `&starting_after=${startingAfter}` : ""}`;
              const refRes: any = await stripeApiRequest<{ data: any[]; has_more: boolean }>(url, { environment: trustedEnv });
              const refunds = refRes?.data || [];
              for (const r of refunds) {
                if (r.status === "succeeded" || r.status === "pending") {
                  totalAlreadyRefundedCents += (r.amount || 0);
                }
              }
              hasMore = Boolean(refRes?.has_more && refunds.length > 0);
              if (hasMore) {
                startingAfter = refunds[refunds.length - 1].id;
              }
            }
          } catch (rErr) {
            logger.warn("Could not query existing refunds from Stripe:", rErr);
          }
        }
      }

      const remainingRefundableCents = Math.max(0, capturedAmountCents - totalAlreadyRefundedCents);

      // 5. Timestamps and cooling-off (Modalidade A) calculation
      const nowSec = Math.floor(Date.now() / 1000);
      const subCreatedSec = stripeSub?.created || (sub.created_at ? Math.floor(new Date(sub.created_at).getTime() / 1000) : nowSec);
      const periodStartSec = stripeSub?.current_period_start || (sub.current_period_start ? Math.floor(new Date(sub.current_period_start).getTime() / 1000) : subCreatedSec);
      const periodEndSec = stripeSub?.current_period_end || (sub.current_period_end ? Math.floor(new Date(sub.current_period_end).getTime() / 1000) : nowSec + 86400 * 30);

      // CDC Art. 49: 7 statutory days from initial contract start
      const coolingOffWindowSec = 7 * 86400;
      const elapsedSinceCreationSec = Math.max(0, nowSec - subCreatedSec);
      const isInitialContract = (periodStartSec - subCreatedSec) < 86400 * 2;
      const coolingOffEligible = !hasActiveDispute && isInitialContract && (elapsedSinceCreationSec <= coolingOffWindowSec) && remainingRefundableCents > 0;
      const coolingOffRefundCents = coolingOffEligible ? remainingRefundableCents : 0;
      const coolingOffDaysRemaining = Math.max(0, Math.ceil((coolingOffWindowSec - elapsedSinceCreationSec) / 86400));

      // 6. Proportional refund (Modalidade B) calculation
      const totalCycleSec = Math.max(1, periodEndSec - periodStartSec);
      const remainingSec = Math.max(0, periodEndSec - nowSec);
      const proportionalRatio = Math.min(1, Math.max(0, remainingSec / totalCycleSec));
      const calculatedProportionalCents = Math.round(capturedAmountCents * proportionalRatio);
      const proportionalRefundCents = Math.min(calculatedProportionalCents, remainingRefundableCents);
      const proportionalEligible = !hasActiveDispute && !coolingOffEligible && proportionalRefundCents > 0 && remainingRefundableCents > 0;

      // 7. Cancellation at period end (Modalidade C)
      const periodEndEligible = !sub.cancel_at_period_end && sub.status !== "canceled";

      logger.info("Subscription cancellation preview evaluated", {
        tenantId,
        subscriptionId: sub.stripe_subscription_id,
        hasActiveDispute,
        coolingOffEligible,
        coolingOffRefundCents,
        proportionalEligible,
        proportionalRefundCents,
        durationMs: Date.now() - startTime
      });

      // Canary access and policy evaluation
      const canaryAccess = evaluateRefundCanaryAccess(tenantId);
      const isAnnualCycle = (periodEndSec - periodStartSec) > 86400 * 35;
      const selfServiceAllowed = canaryAccess.allowed && !isAnnualCycle;
      const selfServiceReason = !canaryAccess.allowed
        ? canaryAccess.reason
        : isAnnualCycle
        ? "Assinaturas de ciclo anual não são elegíveis ao cancelamento com estorno por autoatendimento. Por favor, contate o suporte."
        : undefined;

      return buildResponse({
        ok: true,
        self_service_allowed: selfServiceAllowed,
        self_service_disabled_reason: selfServiceReason,
        max_self_service_refund_cents: canaryAccess.maxRefundCents,
        is_annual_cycle: isAnnualCycle,
        subscription_id: sub.stripe_subscription_id,
        status: sub.status,
        cancel_at_period_end: Boolean(sub.cancel_at_period_end),
        currency: currency.toUpperCase(),
        paid_amount_cents: capturedAmountCents,
        already_refunded_cents: totalAlreadyRefundedCents,
        remaining_refundable_cents: remainingRefundableCents,
        has_active_dispute: hasActiveDispute,
        current_period_start: new Date(periodStartSec * 1000).toISOString(),
        current_period_end: new Date(periodEndSec * 1000).toISOString(),
        sub_created_at: new Date(subCreatedSec * 1000).toISOString(),
        cooling_off: {
          eligible: coolingOffEligible,
          mode: "cooling_off",
          estimated_refund_cents: coolingOffRefundCents,
          effective_end: "immediate",
          days_remaining_in_window: coolingOffDaysRemaining,
          requires_confirmation: true,
          ineligibility_reason: hasActiveDispute
            ? "Este pagamento possui uma contestação em análise. Entre em contato com o suporte para verificar o cancelamento e a situação financeira."
            : !isInitialContract
            ? "O direito de arrependimento (CDC Art. 49) aplica-se exclusivamente à contratação inicial da assinatura."
            : elapsedSinceCreationSec > coolingOffWindowSec
            ? "O prazo legal de arrependimento de 7 dias a contar da contratação já expirou."
            : remainingRefundableCents <= 0
            ? "Não há saldo reembolsável disponível nesta fatura."
            : undefined
        },
        proportional: {
          eligible: proportionalEligible,
          mode: "proportional",
          estimated_refund_cents: proportionalRefundCents,
          effective_end: "immediate",
          remaining_seconds: remainingSec,
          total_cycle_seconds: totalCycleSec,
          requires_confirmation: true,
          ineligibility_reason: hasActiveDispute
            ? "Este pagamento possui uma contestação em análise. Entre em contato com o suporte para verificar o cancelamento e a situação financeira."
            : coolingOffEligible
            ? "Esta assinatura é elegível ao arrependimento com estorno integral de 100%."
            : proportionalRefundCents <= 0
            ? "Não há tempo remanescente no ciclo ou saldo reembolsável para estorno proporcional."
            : undefined
        },
        period_end: {
          eligible: periodEndEligible,
          mode: "period_end",
          estimated_refund_cents: 0,
          effective_end: "period_end",
          current_period_end: new Date(periodEndSec * 1000).toISOString(),
          requires_confirmation: true
        }
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: REQUEST-CANCELLATION-WITH-REFUND
    // -------------------------------------------------------------------------
    if (payload.action === "request-cancellation-with-refund") {
      const trustedEnv = getTrustedStripeEnvironment();
      const rateLimitKey = await generateRateLimitKey("stripe:request-refund", userId, tenantId, clientIp);
      await checkRateLimit(rateLimitKey, 5, 300);

      // Canary safeguards: kill-switch & tenant allowlist validation (Fail-closed)
      const canaryAccess = evaluateRefundCanaryAccess(tenantId);
      if (!canaryAccess.allowed) {
        throw new EdgeError(
          "FORBIDDEN",
          canaryAccess.reason || "Operações automáticas de estorno não estão disponíveis para este estabelecimento. Por favor, contate o suporte.",
          403
        );
      }

      const { mode, expectedRefundCents, reason, feedback } = payload;
      if (!mode || !["cooling_off", "proportional"].includes(mode)) {
        throw new EdgeError("INVALID_REQUEST", "Modalidade de estorno inválida. Escolha 'cooling_off' ou 'proportional'.", 400);
      }

      if (typeof expectedRefundCents !== "number" || expectedRefundCents <= 0) {
        throw new EdgeError("INVALID_REQUEST", "Valor de estorno esperado inválido ou ausente.", 400);
      }

      // 1. Locate canonical commercial subscription for this tenant/user
      const { data: sub, error: subErr } = await adminClient
        .from("subscriptions")
        .select("*")
        .or(`user_id.eq.${tenantId},user_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr || !sub || !sub.stripe_subscription_id) {
        throw new EdgeError("NOT_FOUND", "Nenhuma assinatura ativa encontrada para este estabelecimento.", 404);
      }

      if (sub.status === "canceled") {
        throw new EdgeError("CONFLICT", "A assinatura deste estabelecimento já se encontra cancelada.", 409);
      }

      // Live safety safeguard: protect reference production subscription
      if (sub.stripe_subscription_id === "sub_1UQ2KRPKG6q10Ujr3DAlbmfN") {
        throw new EdgeError(
          "FORBIDDEN",
          "Esta assinatura é a referência canônica protegida de produção e não pode ser cancelada ou estornada nesta fase.",
          403
        );
      }

      // 2. Fetch live subscription & invoice data from Stripe for authoritative calculation
      const stripeSub = await stripeApiRequest<any>(
        `/subscriptions/${sub.stripe_subscription_id}`,
        { environment: trustedEnv }
      );

      let latestInvoice: any = null;
      if (stripeSub?.latest_invoice) {
        const invId = typeof stripeSub.latest_invoice === "string" ? stripeSub.latest_invoice : stripeSub.latest_invoice.id;
        try {
          latestInvoice = await stripeApiRequest<any>(
            `/invoices/${invId}?expand[]=payment_intent`,
            { environment: trustedEnv }
          );
        } catch (_e) {
          // fallback search
        }
      }

      if (!latestInvoice) {
        const invList = await stripeApiRequest<{ data: any[] }>(
          `/invoices?subscription=${sub.stripe_subscription_id}&status=paid&limit=1`,
          { environment: trustedEnv }
        );
        if (invList?.data?.length > 0) {
          latestInvoice = await stripeApiRequest<any>(
            `/invoices/${invList.data[0].id}?expand[]=payment_intent`,
            { environment: trustedEnv }
          );
        }
      }

      if (!latestInvoice) {
        throw new EdgeError("CONFLICT", "Nenhuma fatura paga encontrada para esta assinatura.", 409);
      }

      const pi = latestInvoice.payment_intent;
      const piId = typeof pi === "string" ? pi : pi?.id || null;
      if (!piId) {
        throw new EdgeError("CONFLICT", "A fatura mais recente não possui um PaymentIntent associado para processar estorno.", 409);
      }

      // P0-03: Dispute & Chargeback Preflight
      let hasActiveDispute = false;
      try {
        const piExpanded = await stripeApiRequest<any>(
          `/payment_intents/${piId}?expand[]=charges.data.dispute`,
          { environment: trustedEnv }
        );
        const charges = piExpanded?.charges?.data || [];
        for (const ch of charges) {
          if (ch.disputed || ch.dispute) {
            hasActiveDispute = true;
            break;
          }
        }
      } catch (dispErr) {
        logger.warn("Dispute check warning:", dispErr);
      }

      if (hasActiveDispute) {
        throw new EdgeError(
          "CONFLICT",
          "Este pagamento possui uma contestação em análise. Entre em contato com o suporte para verificar o cancelamento e a situação financeira.",
          409
        );
      }

      const capturedAmountCents = (typeof pi === "object" ? pi?.amount_received : null) ?? latestInvoice.amount_paid ?? 0;
      if (capturedAmountCents <= 0) {
        throw new EdgeError("CONFLICT", "Esta fatura não possui valor capturado disponível para devolução.", 409);
      }

      // P0-01: Stable, deterministic idempotency key linked to tenant, subscription, invoice and mode
      // (Independent of dynamic microsecond elapsed time or variable cents)
      const opKey = `cust-ref-${tenantId}-${sub.stripe_subscription_id}-${latestInvoice.id}-${mode}`;

      // Query existing refunds from Stripe to check refundable balance & detect already executed refunds
      let totalAlreadyRefundedCents = 0;
      let existingStripeRefund: any = null;
      try {
        let hasMore = true;
        let startingAfter: string | undefined = undefined;
        while (hasMore) {
          const url: string = `/refunds?payment_intent=${piId}&limit=100${startingAfter ? `&starting_after=${startingAfter}` : ""}`;
          const refRes: any = await stripeApiRequest<{ data: any[]; has_more: boolean }>(url, { environment: trustedEnv });
          const refunds = refRes?.data || [];
          for (const r of refunds) {
            if (r.status === "succeeded" || r.status === "pending") {
              totalAlreadyRefundedCents += (r.amount || 0);
              // Check if already refunded under this logical operation key
              if (r.idempotency_key === opKey || (r.metadata && r.metadata.operation_key === opKey)) {
                existingStripeRefund = r;
              }
            }
          }
          hasMore = Boolean(refRes?.has_more && refunds.length > 0);
          if (hasMore) {
            startingAfter = refunds[refunds.length - 1].id;
          }
        }
      } catch (rErr) {
        logger.warn("Could not query existing refunds from Stripe:", rErr);
      }

      const remainingRefundableCents = Math.max(0, capturedAmountCents - totalAlreadyRefundedCents);
      if (remainingRefundableCents <= 0 && !existingStripeRefund) {
        throw new EdgeError("CONFLICT", "Todo o saldo elegível desta fatura já foi estornado anteriormente.", 409);
      }

      // Re-calculate authoritatively
      const nowSec = Math.floor(Date.now() / 1000);
      const subCreatedSec = stripeSub?.created || (sub.created_at ? Math.floor(new Date(sub.created_at).getTime() / 1000) : nowSec);
      const periodStartSec = stripeSub?.current_period_start || (sub.current_period_start ? Math.floor(new Date(sub.current_period_start).getTime() / 1000) : subCreatedSec);
      const periodEndSec = stripeSub?.current_period_end || (sub.current_period_end ? Math.floor(new Date(sub.current_period_end).getTime() / 1000) : nowSec + 86400 * 30);

      let authoritativeRefundCents = 0;
      if (mode === "cooling_off") {
        const coolingOffWindowSec = 7 * 86400;
        const elapsedSinceCreationSec = Math.max(0, nowSec - subCreatedSec);
        const isInitialContract = (periodStartSec - subCreatedSec) < 86400 * 2;
        if (!isInitialContract || elapsedSinceCreationSec > coolingOffWindowSec) {
          throw new EdgeError("CONFLICT", "O prazo de arrependimento (7 dias da contratação inicial) não é mais elegível.", 409);
        }
        authoritativeRefundCents = remainingRefundableCents;
      } else if (mode === "proportional") {
        const totalCycleSec = Math.max(1, periodEndSec - periodStartSec);
        const remainingSec = Math.max(0, periodEndSec - nowSec);
        const proportionalRatio = Math.min(1, Math.max(0, remainingSec / totalCycleSec));
        const calculatedCents = Math.round(capturedAmountCents * proportionalRatio);
        authoritativeRefundCents = Math.min(calculatedCents, remainingRefundableCents);
      }

      if (authoritativeRefundCents <= 0 && !existingStripeRefund) {
        throw new EdgeError("CONFLICT", "O valor de reembolso calculado é zero. Nenhuma devolução é aplicável.", 409);
      }

      // Canary Financial Limits & Safeguards
      const isAnnualCycle = (periodEndSec - periodStartSec) > 86400 * 35;
      if (isAnnualCycle) {
        throw new EdgeError(
          "FORBIDDEN",
          "Assinaturas de ciclo anual não são elegíveis ao cancelamento com estorno por autoatendimento. Por favor, contate o suporte.",
          403
        );
      }

      const invCurrency = (latestInvoice?.currency || "brl").toLowerCase();
      if (invCurrency !== "brl") {
        throw new EdgeError(
          "FORBIDDEN",
          `Moeda '${invCurrency.toUpperCase()}' não suportada para autoatendimento no canário. Apenas BRL é permitido.`,
          403
        );
      }

      if (!Number.isInteger(authoritativeRefundCents) || authoritativeRefundCents <= 0) {
        throw new EdgeError(
          "INVALID_REQUEST",
          "O valor de estorno deve ser um número inteiro positivo de centavos.",
          400
        );
      }

      if (authoritativeRefundCents > canaryAccess.maxRefundCents) {
        throw new EdgeError(
          "FORBIDDEN",
          `O valor calculado de R$ ${(authoritativeRefundCents / 100).toFixed(2)} excede o limite máximo permitido de R$ ${(canaryAccess.maxRefundCents / 100).toFixed(2)} por operação para autoatendimento nesta fase. Por favor, solicite a operação através do suporte.`,
          403
        );
      }

      // Check drift: if recalculated value differs from what user confirmed by > 1 centavo
      if (!existingStripeRefund && Math.abs(authoritativeRefundCents - expectedRefundCents) > 1) {
        throw new EdgeError(
          "CONFLICT",
          `O valor estimado de estorno mudou de R$ ${(expectedRefundCents / 100).toFixed(2)} para R$ ${(authoritativeRefundCents / 100).toFixed(2)} devido ao tempo decorrido. Por favor, confirme o novo valor atualizado.`,
          409
        );
      }

      const cleanReason = (reason ? `Cancelamento (${mode}): ${reason}` : `Cancelamento por solicitação do cliente (${mode})`).slice(0, 150).padEnd(10, " ");

      // 3. Atomically claim refund operation in database (Short Transaction / Lock Isolation)
      const { data: claimData, error: claimErr } = await adminClient.rpc("claim_refund_operation", {
        p_tenant_id: tenantId,
        p_actor_user_id: userId,
        p_payment_intent_id: piId,
        p_invoice_id: latestInvoice.id,
        p_amount: authoritativeRefundCents,
        p_currency: latestInvoice.currency || "brl",
        p_reason: cleanReason,
        p_idempotency_key: opKey,
        p_metadata: {
          refund_mode: mode,
          source: "tenant_self_service",
          subscription_id: sub.stripe_subscription_id,
          expected_refund_cents: expectedRefundCents,
          authoritative_refund_cents: authoritativeRefundCents,
          user_email: email
        }
      });

      if (claimErr) {
        logger.error("claim_refund_operation RPC failed", { claimErr });
        throw new EdgeError("SERVICE_UNAVAILABLE", "Falha de controle de concorrência ao registrar estorno.", 503);
      }

      if (claimData?.already_processed) {
        return buildResponse({
          ok: true,
          success: true,
          mode,
          refunded_cents: claimData.amount || authoritativeRefundCents,
          stripe_refund_id: claimData.stripe_refund_id,
          subscription_status: "canceled",
          effective_end: "immediate",
          message: "Esta solicitação de cancelamento e reembolso já havia sido processada com sucesso."
        }, 200, req);
      }

      if (claimData?.in_progress) {
        throw new EdgeError("CONFLICT", "Uma solicitação idêntica de estorno já está em processamento.", 409);
      }

      const operationId = claimData?.operation_id;

      // 4. Issue Refund in Stripe (or reuse existing refund if already succeeded on gateway)
      let stripeRefund = existingStripeRefund;
      if (!stripeRefund) {
        try {
          stripeRefund = await stripeApiRequest<{ id: string; status: string; amount: number; charge?: string }>(
            "/refunds",
            {
              method: "POST",
              body: {
                payment_intent: piId,
                amount: authoritativeRefundCents,
                reason: "requested_by_customer",
                metadata: { operation_key: opKey }
              },
              idempotencyKey: opKey,
              environment: trustedEnv
            }
          );
        } catch (refErr: any) {
          if (operationId) {
            try {
              await adminClient.rpc("fail_refund_operation", {
                p_operation_id: operationId,
                p_error_message: refErr?.message || "Stripe refund creation failed"
              });
            } catch (_fErr) {}
          }
          logger.error("Stripe refund creation failed", { refErr });
          throw new EdgeError("SERVICE_UNAVAILABLE", "O provedor de pagamentos recusou o estorno financeiro.", 502);
        }
      }

      // 5. Cancel subscription immediately in Stripe (DELETE /subscriptions/:id)
      let cancelSucceeded = false;
      try {
        const delRes = await stripeApiRequest<any>(`/subscriptions/${sub.stripe_subscription_id}`, {
          method: "DELETE",
          environment: trustedEnv
        });
        if (delRes && (delRes.status === "canceled" || delRes.id === sub.stripe_subscription_id)) {
          cancelSucceeded = true;
        }
      } catch (delErr: any) {
        logger.error("Critical: Stripe subscription deletion failed after refund issued", {
          subscriptionId: sub.stripe_subscription_id,
          stripeRefundId: stripeRefund?.id,
          delErr: delErr?.message
        });
      }

      // P0-02: Partial Failure recovery. If cancellation failed, DO NOT declare full success!
      if (!cancelSucceeded) {
        const correlationId = `corr-${Date.now()}-${generateRequestId()}`;
        try {
          await adminClient.rpc("flag_refund_operation_review", {
            p_operation_id: operationId,
            p_status: "requires_review",
            p_error_message: "Stripe refund succeeded, but DELETE /subscriptions failed.",
            p_recovery_notes: `correlationId: ${correlationId}, refund_id: ${stripeRefund?.id}`
          });
        } catch (_fErr) {
          await adminClient
            .from("stripe_refund_operations")
            .update({
              status: "requires_review",
              error_message: "Stripe refund succeeded, but DELETE /subscriptions failed.",
              stripe_refund_id: stripeRefund?.id || null,
              correlation_id: correlationId,
              updated_at: new Date().toISOString()
            })
            .eq("id", operationId);
        }

        try {
          await adminClient.from("audit_logs").insert({
            user_id: userId,
            target_id: tenantId,
            action: "subscription.refund_partial_failure",
            details: {
              status: "requires_review",
              correlation_id: correlationId,
              stripe_subscription_id: sub.stripe_subscription_id,
              stripe_refund_id: stripeRefund?.id,
              mode,
              amount_cents: authoritativeRefundCents,
              actor_email: email
            },
            ip_address: clientIp
          });
        } catch (_aErr) {}

        return buildResponse({
          ok: true,
          success: false,
          partial_success: true,
          requires_review: true,
          correlation_id: correlationId,
          mode,
          refunded_cents: authoritativeRefundCents,
          stripe_refund_id: stripeRefund?.id,
          subscription_status: sub.status,
          effective_end: "pending_review",
          message: "O estorno financeiro foi enviado com sucesso, mas a desativação da assinatura no gateway requer conciliação operacional. Um chamado interno foi aberto e não haverá novas cobranças."
        }, 200, req);
      }

      // 6. Complete refund operation in DB
      if (operationId && stripeRefund?.id) {
        try {
          await adminClient.rpc("complete_refund_operation", {
            p_operation_id: operationId,
            p_stripe_refund_id: stripeRefund.id,
            p_stripe_charge_id: stripeRefund.charge || null
          });
        } catch (compErr) {
          logger.warn("complete_refund_operation warning:", compErr);
        }
      }

      // 7. Update Supabase subscriptions and barbershops (with P1-02 safe fallback for legacy columns)
      const nowIso = new Date().toISOString();
      try {
        await adminClient
          .from("subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: false,
            canceled_at: nowIso,
            ended_at: nowIso,
            cancellation_reason: cleanReason,
            cancellation_feedback: feedback ? String(feedback).slice(0, 1000) : null,
            cancellation_actor_id: userId,
            updated_at: nowIso
          })
          .eq("id", sub.id);
      } catch (_dbSubErr) {
        try {
          await adminClient
            .from("subscriptions")
            .update({
              status: "canceled",
              cancel_at_period_end: false,
              updated_at: nowIso
            })
            .eq("id", sub.id);
        } catch (fbErr) {
          logger.warn("Warning updating subscriptions table via fallback:", fbErr);
        }
      }

      try {
        await adminClient
          .from("barbershops")
          .update({
            plan: "gratis",
            updated_at: nowIso
          })
          .eq("id", tenantId);
      } catch (dbShopErr) {
        logger.warn("Warning updating barbershops plan to gratis:", dbShopErr);
      }

      // 8. Audit log
      try {
        await adminClient.from("audit_logs").insert({
          user_id: userId,
          target_id: tenantId,
          action: mode === "cooling_off" ? "subscription.cooling_off_refund" : "subscription.proportional_refund",
          details: {
            source: "tenant_self_service",
            mode,
            stripe_subscription_id: sub.stripe_subscription_id,
            stripe_refund_id: stripeRefund?.id,
            amount_cents: authoritativeRefundCents,
            reason: reason || null,
            feedback: feedback || null,
            actor_email: email
          },
          ip_address: clientIp
        });
      } catch (auditErr) {
        logger.warn("Audit log insert warning:", auditErr);
      }

      logger.info("Subscription canceled with refund completed", {
        tenantId,
        subscriptionId: sub.stripe_subscription_id,
        mode,
        refundedCents: authoritativeRefundCents,
        stripeRefundId: stripeRefund?.id,
        durationMs: Date.now() - startTime
      });

      return buildResponse({
        ok: true,
        success: true,
        mode,
        refunded_cents: authoritativeRefundCents,
        stripe_refund_id: stripeRefund?.id,
        subscription_status: "canceled",
        effective_end: "immediate",
        message: mode === "cooling_off"
          ? "Assinatura cancelada e estorno integral de 100% solicitado com sucesso (Direito de Arrependimento)."
          : "Assinatura cancelada e estorno proporcional do período restante solicitado com sucesso."
      }, 200, req);
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
