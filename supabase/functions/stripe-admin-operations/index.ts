/**
 * BARBEX SUPABASE EDGE FUNCTION — PRIVILEGED SUPER ADMIN FINANCIAL OPERATIONS
 *
 * Canonical privileged operational layer for Super Admin financial support operations.
 * Allows an authorized Super Admin to manage an existing tenant's Stripe subscription
 * and add-ons without:
 * - impersonating the tenant owner;
 * - weakening tenant-owner self-service endpoints;
 * - trusting browser financial authority;
 * - conflating cancellation with refund;
 * - issuing automatic refunds.
 *
 * Operations supported:
 * 1. preview: authoritatively inspects subscription, add-ons, and projected impact (zero mutation)
 * 2. cancel-base-period-end: schedules cancellation at current_period_end (cancel_at_period_end = true)
 * 3. reactivate-base-subscription: un-schedules cancellation (cancel_at_period_end = false)
 * 4. cancel-base-immediately: high-impact immediate Stripe termination + atomic synchronization
 * 5. cancel-addon: immediately removes single subscription item while preserving base subscription
 * 6. readd-addon: provisions new subscription item with canonical server price mapping
 * 7. change-base-plan: safely deferred under fail-closed financial safety policy
 */

import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireMethod, parseJsonBody } from "../_shared/validation.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { extractBearerToken } from "../_shared/auth.ts";
import { createStructuredLogger } from "../_shared/logging.ts";
import { generateRequestId } from "../_shared/crypto.ts";
import { EdgeError } from "../_shared/errors.ts";
import { stripeApiRequest, getTrustedStripeEnvironment } from "../_shared/stripe.ts";

export type StripeAdminOperationAction =
  | "preview"
  | "cancel-base-period-end"
  | "reactivate-base-subscription"
  | "cancel-base-immediately"
  | "cancel-addon"
  | "readd-addon"
  | "change-base-plan"
  | "list-invoices"
  | "get-invoice-detail"
  | "list-payments"
  | "get-refundable-state"
  | "preview-refund"
  | "list-refunds"
  | "refund-full"
  | "refund-partial";

export interface StripeAdminOperationPayload {
  action: StripeAdminOperationAction;
  tenantId: string;
  subscriptionId?: string;
  addonId?: string;
  contractId?: string;
  targetPlanKey?: string;
  reason?: string;
  typedConfirmation?: string;
  // Financial R2E.17D properties
  invoiceId?: string;
  paymentIntentId?: string;
  amount?: number; // Integer minor units (centavos)
  refundType?: "full" | "partial";
  idempotencyKey?: string;
}

function buildResponse(body: Record<string, unknown>, status = 200, req?: Request): Response {
  const requestId = req?.headers?.get("x-request-id") || generateRequestId();
  const cors = getCorsHeaders(req);

  return new Response(
    JSON.stringify({
      ...body,
      requestId,
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
        "x-request-id": requestId,
      },
    }
  );
}

/**
 * Validates caller identity and verifies STRICT Super Admin authority.
 * Never impersonates owner. Fails closed if not Super Admin.
 */
async function resolveSuperAdminCaller(
  req: Request,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<{ userId: string; email: string }> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new EdgeError("UNAUTHORIZED", "Token de autenticação ausente ou inválido.", 401);
  }

  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) {
    throw new EdgeError("UNAUTHORIZED", "Sessão expirada ou não autorizada.", 401);
  }

  const userId = user.id;

  // 1. Check user_roles table for super_admin
  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();

  let isSuperAdmin = Boolean(roleData);

  // 2. Check profile.role fallback if user_roles not populated
  if (!isSuperAdmin) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, email")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.role === "super_admin") {
      isSuperAdmin = true;
    }
  }

  if (!isSuperAdmin) {
    throw new EdgeError("FORBIDDEN", "Operação restrita exclusivamente ao Super Admin da plataforma.", 403);
  }

  return {
    userId,
    email: user.email || "",
  };
}

/**
 * Validates target tenant by canonical barbershop ID.
 */
async function resolveTargetTenant(
  tenantId: string,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<{ id: string; name: string; owner_id: string | null; slug: string }> {
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim().length === 0) {
    throw new EdgeError("INVALID_REQUEST", "Identificador do estabelecimento (tenantId) ausente ou inválido.", 400);
  }

  const cleanTenantId = tenantId.trim();

  const { data: barbershop, error: bErr } = await adminClient
    .from("barbershops")
    .select("id, name, owner_id, slug")
    .eq("id", cleanTenantId)
    .maybeSingle();

  if (bErr || !barbershop) {
    throw new EdgeError("NOT_FOUND", `Estabelecimento (ID: ${cleanTenantId}) não encontrado no sistema.`, 404);
  }

  return barbershop;
}

/**
 * Resolves active or target subscription for the tenant.
 */
async function resolveTenantSubscription(
  tenantId: string,
  adminClient: ReturnType<typeof createAdminClient>
) {
  const { data: sub, error: sErr } = await adminClient
    .from("subscriptions")
    .select("*")
    .eq("user_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sErr) {
    throw new EdgeError("INTERNAL_ERROR", "Falha ao consultar assinatura do estabelecimento no banco.", 500);
  }

  return sub;
}

/**
 * Logs Super Admin financial support operation into public.audit_logs.
 */
async function recordAuditLog(
  adminClient: ReturnType<typeof createAdminClient>,
  adminId: string,
  targetId: string,
  action: string,
  details: Record<string, unknown>,
  ipAddress?: string | null
) {
  try {
    const { error } = await adminClient.from("audit_logs").insert({
      admin_id: adminId,
      target_id: targetId,
      action,
      details,
      ip_address: ipAddress || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[Stripe Admin Operations] Falha ao registrar log de auditoria:", error);
    }
  } catch (err) {
    console.error("[Stripe Admin Operations] Exceção ao gravar auditoria:", err);
  }
}

Deno.serve(async (req: Request) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  const logger = createStructuredLogger("stripe-admin-operations", req);
  const startTime = Date.now();
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;

  try {
    requireMethod(req, "POST");

    const adminClient = createAdminClient();

    // 1. Authorize Super Admin strictly
    const adminCaller = await resolveSuperAdminCaller(req, adminClient);

    // 2. Parse payload
    const payload = await parseJsonBody<StripeAdminOperationPayload>(req);
    const { action, tenantId, reason, typedConfirmation } = payload;

    if (!action) {
      throw new EdgeError("INVALID_REQUEST", "Ação de operação financeira ausente.", 400);
    }

    // 3. Resolve canonical tenant
    const tenant = await resolveTargetTenant(tenantId, adminClient);

    // 4. Resolve canonical subscription
    const sub = await resolveTenantSubscription(tenant.id, adminClient);

    // -------------------------------------------------------------------------
    // ACTION: PREVIEW (Zero mutation)
    // -------------------------------------------------------------------------
    if (action === "preview") {
      const targetOp = (payload as any).targetOperation || "general-inspection";

      // Fetch attached add-ons
      const { data: addons } = await adminClient
        .from("tenant_addons")
        .select(`
          id,
          addon_id,
          status,
          quantity,
          unit_price,
          currency,
          stripe_subscription_item_id,
          cancel_at_period_end,
          current_period_end,
          saas_addons:addon_id (
            name,
            addon_key,
            canonical_module_key
          )
        `)
        .eq("tenant_id", tenant.id);

      let stripeLiveObject: any = null;
      if (sub?.stripe_subscription_id) {
        try {
          stripeLiveObject = await stripeApiRequest(`/subscriptions/${sub.stripe_subscription_id}`);
        } catch (sErr) {
          logger.warn("Não foi possível consultar assinatura no Stripe durante preview:", sErr);
        }
      }

      const planKey = sub?.plan_key || "free";
      const billingCycle = sub?.billing_cycle || "month";
      const status = sub?.status || "none";
      const currentPeriodEnd = stripeLiveObject?.current_period_end
        ? new Date(stripeLiveObject.current_period_end * 1000).toISOString()
        : sub?.current_period_end || null;
      const cancelAtPeriodEnd = Boolean(stripeLiveObject?.cancel_at_period_end ?? sub?.cancel_at_period_end);

      let financialConsequence = "Nenhuma cobrança ou estorno será efetuado nesta visualização.";
      let accessConsequence = "O status atual de acesso permanece inalterado.";

      if (targetOp === "cancel-base-period-end") {
        financialConsequence = "Nenhum reembolso será emitido. Renovação automática será desativada.";
        accessConsequence = `O estabelecimento manterá acesso integral até o fim do período (${currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString("pt-BR") : "vigente"}).`;
      } else if (targetOp === "cancel-base-immediately") {
        financialConsequence = "ATENÇÃO: A assinatura será cancelada imediatamente no Stripe. Nenhum reembolso automático será emitido.";
        accessConsequence = "O plano do estabelecimento será revertido imediatamente para Free. Módulos adicionais vinculados serão desativados.";
      } else if (targetOp === "reactivate-base-subscription") {
        financialConsequence = "A cobrança recorrente voltará a ocorrer normalmente no término do ciclo atual.";
        accessConsequence = "O estabelecimento continuará com acesso ininterrupto ao plano contratado.";
      } else if (targetOp === "cancel-addon") {
        financialConsequence = "O módulo adicional será removido do Stripe sem estorno proporcional automático. A assinatura base continua ativa.";
        accessConsequence = "O recurso do módulo adicional será revogado imediatamente para o estabelecimento.";
      }

      return buildResponse({
        ok: true,
        preview: {
          tenantId: tenant.id,
          barbershopName: tenant.name,
          slug: tenant.slug,
          hasSubscription: Boolean(sub),
          stripeSubscriptionId: sub?.stripe_subscription_id || null,
          stripeCustomerId: sub?.stripe_customer_id || null,
          currentPlan: planKey,
          billingCycle,
          subscriptionStatus: status,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          stripeEnvironment: sub?.environment || getTrustedStripeEnvironment(),
          attachedAddons: addons || [],
          requestedOperation: targetOp,
          financialConsequence,
          accessConsequence,
          escapeHatchLinks: {
            stripeSubscriptionUrl: sub?.stripe_subscription_id
              ? `https://dashboard.stripe.com/${sub.environment === "live" ? "" : "test/"}subscriptions/${sub.stripe_subscription_id}`
              : null,
            stripeCustomerUrl: sub?.stripe_customer_id
              ? `https://dashboard.stripe.com/${sub.environment === "live" ? "" : "test/"}customers/${sub.stripe_customer_id}`
              : null,
          },
        },
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: LIST-INVOICES (Financial Read Model)
    // -------------------------------------------------------------------------
    if (action === "list-invoices") {
      if (!sub?.stripe_customer_id) {
        return buildResponse({ ok: true, invoices: [] }, 200, req);
      }

      const stripeEnv = sub.environment === "live" ? "live" : "test";
      const invoicesRes = await stripeApiRequest<{ data: any[] }>(
        `/invoices?customer=${sub.stripe_customer_id}&limit=24`,
        { environment: stripeEnv }
      );

      const invoices = (invoicesRes?.data || []).map((inv: any) => {
        const piId = typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent?.id || null;
        const chId = typeof inv.charge === "string" ? inv.charge : inv.charge?.id || null;
        return {
          id: inv.id,
          number: inv.number || inv.id,
          status: inv.status,
          currency: inv.currency || "brl",
          subtotal: inv.subtotal,
          total: inv.total,
          amount_paid: inv.amount_paid,
          amount_due: inv.amount_due,
          amount_remaining: inv.amount_remaining,
          created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
          period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
          period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
          paid_at: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : null,
          hosted_invoice_url: inv.hosted_invoice_url || null,
          invoice_pdf: inv.invoice_pdf || null,
          subscription_id: inv.subscription || null,
          payment_intent_id: piId,
          charge_id: chId,
          escapeHatchLinks: {
            stripeInvoiceUrl: `https://dashboard.stripe.com/${stripeEnv === "live" ? "" : "test/"}invoices/${inv.id}`,
            stripePaymentUrl: piId ? `https://dashboard.stripe.com/${stripeEnv === "live" ? "" : "test/"}payments/${piId}` : null,
          },
        };
      });

      return buildResponse({ ok: true, invoices }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: GET-INVOICE-DETAIL (Financial Read Model with Line Items & Balance)
    // -------------------------------------------------------------------------
    if (action === "get-invoice-detail") {
      const { invoiceId } = payload;
      if (!invoiceId) {
        throw new EdgeError("INVALID_REQUEST", "Identificador da fatura (invoiceId) ausente.", 400);
      }

      const stripeEnv = sub?.environment === "live" ? "live" : "test";
      const inv = await stripeApiRequest<any>(
        `/invoices/${invoiceId}?expand[]=payment_intent&expand[]=lines.data`,
        { environment: stripeEnv }
      );

      // Strict validation: invoice must belong to tenant's customer
      if (sub?.stripe_customer_id && inv.customer !== sub.stripe_customer_id) {
        throw new EdgeError("FORBIDDEN", "A fatura informada não pertence ao estabelecimento solicitado.", 403);
      }

      const pi = inv.payment_intent;
      const piId = typeof pi === "string" ? pi : pi?.id || null;
      const capturedAmount = (typeof pi === "object" ? pi?.amount_received : null) ?? inv.amount_paid ?? 0;

      // Query refunds for this payment intent from Stripe
      let totalAlreadyRefunded = 0;
      let refunds: any[] = [];
      if (piId) {
        try {
          const refRes = await stripeApiRequest<{ data: any[] }>(`/refunds?payment_intent=${piId}&limit=50`, { environment: stripeEnv });
          refunds = refRes?.data || [];
          totalAlreadyRefunded = refunds.reduce((acc: number, r: any) => {
            return (r.status === "succeeded" || r.status === "pending") ? acc + (r.amount || 0) : acc;
          }, 0);
        } catch (rErr) {
          logger.warn("Aviso ao buscar estornos da fatura no Stripe:", rErr);
        }
      }

      const remainingRefundable = Math.max(0, capturedAmount - totalAlreadyRefunded);

      // Process line items and compute add-on attributable total
      let addonAttributableTotal = 0;
      const lines = (inv.lines?.data || []).map((line: any) => {
        const meta = line.price?.metadata || {};
        const isAddon = meta.is_addon === "true" || meta.commercial_type === "addon" || (line.price?.lookup_key || "").startsWith("addon_");
        if (isAddon) {
          addonAttributableTotal += (line.amount || 0);
        }
        return {
          id: line.id,
          description: line.description || "",
          amount: line.amount,
          currency: line.currency || "brl",
          proration: Boolean(line.proration),
          subscription_item: line.subscription_item || null,
          isAddon,
        };
      });

      const addonAttributableMax = Math.min(remainingRefundable, addonAttributableTotal);

      return buildResponse({
        ok: true,
        invoice: {
          id: inv.id,
          number: inv.number || inv.id,
          status: inv.status,
          currency: inv.currency || "brl",
          subtotal: inv.subtotal,
          total: inv.total,
          amount_paid: inv.amount_paid,
          amount_due: inv.amount_due,
          amount_remaining: inv.amount_remaining,
          created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
          paid_at: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : null,
          hosted_invoice_url: inv.hosted_invoice_url || null,
          invoice_pdf: inv.invoice_pdf || null,
          subscription_id: inv.subscription || null,
          payment_intent_id: piId,
          charge_id: typeof inv.charge === "string" ? inv.charge : inv.charge?.id || null,
          originalCapturedAmount: capturedAmount,
          totalAlreadyRefunded,
          remainingRefundableAmount: remainingRefundable,
          addonAttributableMax,
          lines,
          refunds: refunds.map((r: any) => ({
            id: r.id,
            amount: r.amount,
            currency: r.currency,
            status: r.status,
            created: r.created ? new Date(r.created * 1000).toISOString() : null,
            reason: r.reason,
          })),
          escapeHatchLinks: {
            stripeInvoiceUrl: `https://dashboard.stripe.com/${stripeEnv === "live" ? "" : "test/"}invoices/${inv.id}`,
            stripePaymentUrl: piId ? `https://dashboard.stripe.com/${stripeEnv === "live" ? "" : "test/"}payments/${piId}` : null,
          },
        },
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: GET-REFUNDABLE-STATE / PREVIEW-REFUND (Zero Mutation Financial Preview)
    // -------------------------------------------------------------------------
    if (action === "get-refundable-state" || action === "preview-refund") {
      const { invoiceId, refundType, amount } = payload;
      if (!invoiceId) {
        throw new EdgeError("INVALID_REQUEST", "Identificador da fatura (invoiceId) ausente.", 400);
      }

      const stripeEnv = sub?.environment === "live" ? "live" : "test";
      const inv = await stripeApiRequest<any>(
        `/invoices/${invoiceId}?expand[]=payment_intent&expand[]=lines.data`,
        { environment: stripeEnv }
      );

      if (sub?.stripe_customer_id && inv.customer !== sub.stripe_customer_id) {
        throw new EdgeError("FORBIDDEN", "A fatura informada não pertence ao estabelecimento solicitado.", 403);
      }

      const pi = inv.payment_intent;
      const piId = typeof pi === "string" ? pi : pi?.id || null;
      const capturedAmount = (typeof pi === "object" ? pi?.amount_received : null) ?? inv.amount_paid ?? 0;

      let totalAlreadyRefunded = 0;
      if (piId) {
        try {
          const refRes = await stripeApiRequest<{ data: any[] }>(`/refunds?payment_intent=${piId}&limit=50`, { environment: stripeEnv });
          totalAlreadyRefunded = (refRes?.data || []).reduce((acc: number, r: any) => {
            return (r.status === "succeeded" || r.status === "pending") ? acc + (r.amount || 0) : acc;
          }, 0);
        } catch (rErr) {
          logger.warn("Aviso ao buscar estornos no preview:", rErr);
        }
      }

      const remainingRefundable = Math.max(0, capturedAmount - totalAlreadyRefunded);

      // Add-on attributable calculation
      let addonAttributableTotal = 0;
      for (const line of inv.lines?.data || []) {
        const meta = line.price?.metadata || {};
        if (meta.is_addon === "true" || meta.commercial_type === "addon" || (line.price?.lookup_key || "").startsWith("addon_")) {
          addonAttributableTotal += (line.amount || 0);
        }
      }
      const addonAttributableMax = Math.min(remainingRefundable, addonAttributableTotal);

      let requestedRefundAmount = remainingRefundable;
      if (refundType === "partial") {
        if (!amount || !Number.isInteger(amount) || amount <= 0) {
          throw new EdgeError("INVALID_REQUEST", "Para estorno parcial, o valor deve ser um número inteiro positivo em centavos.", 400);
        }
        if (amount > remainingRefundable) {
          throw new EdgeError("INVALID_REQUEST", `O valor solicitado (R$ ${(amount / 100).toFixed(2)}) excede o saldo estornável disponível (R$ ${(remainingRefundable / 100).toFixed(2)}).`, 400);
        }
        requestedRefundAmount = amount;
      }

      const remainingAfterRefund = remainingRefundable - requestedRefundAmount;

      return buildResponse({
        ok: true,
        preview: {
          tenantId: tenant.id,
          barbershopName: tenant.name,
          invoiceId: inv.id,
          paymentIntentId: piId,
          chargeId: typeof inv.charge === "string" ? inv.charge : inv.charge?.id || null,
          originalCapturedAmount: capturedAmount,
          totalAlreadyRefunded,
          remainingRefundableAmount: remainingRefundable,
          requestedRefundAmount,
          remainingAfterRefund,
          currency: inv.currency || "brl",
          addonAttributableMax,
          subscriptionImpact: "NONE (A assinatura base permanece ativa)",
          addonImpact: "NONE (Os módulos adicionais contratados permanecem ativos)",
          financialConsequence: `Será solicitado o estorno de R$ ${(requestedRefundAmount / 100).toFixed(2)} no Stripe. Não haverá cancelamento de serviços.`,
          escapeHatchLinks: {
            stripeInvoiceUrl: `https://dashboard.stripe.com/${stripeEnv === "live" ? "" : "test/"}invoices/${inv.id}`,
            stripePaymentUrl: piId ? `https://dashboard.stripe.com/${stripeEnv === "live" ? "" : "test/"}payments/${piId}` : null,
          },
        },
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: LIST-REFUNDS (Tenant Refund Operations Ledger)
    // -------------------------------------------------------------------------
    if (action === "list-refunds") {
      const { data: refunds, error: refErr } = await adminClient
        .from("stripe_refund_operations")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (refErr) {
        logger.warn("Aviso ao buscar stripe_refund_operations:", refErr);
      }

      const stripeEnv = sub?.environment === "live" ? "live" : "test";
      const normalizedRefunds = (refunds || []).map((r: any) => ({
        id: r.id,
        stripe_refund_id: r.stripe_refund_id,
        stripe_payment_intent_id: r.stripe_payment_intent_id,
        stripe_invoice_id: r.stripe_invoice_id,
        amount: r.amount,
        currency: r.currency,
        status: r.status,
        reason: r.reason,
        created_at: r.created_at,
        actor_user_id: r.actor_user_id,
        escapeHatchLinks: {
          stripeRefundUrl: r.stripe_refund_id
            ? `https://dashboard.stripe.com/${stripeEnv === "live" ? "" : "test/"}refunds/${r.stripe_refund_id}`
            : null,
          stripePaymentUrl: `https://dashboard.stripe.com/${stripeEnv === "live" ? "" : "test/"}payments/${r.stripe_payment_intent_id}`,
        },
      }));

      return buildResponse({ ok: true, refunds: normalizedRefunds }, 200, req);
    }

    // -------------------------------------------------------------------------
    // MUTATION VALIDATION: Reason is mandatory (>= 10 chars)
    // -------------------------------------------------------------------------
    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      throw new EdgeError(
        "INVALID_REQUEST",
        "É obrigatório justificar formalmente a operação de suporte administrativo (mínimo de 10 caracteres).",
        400
      );
    }

    const cleanReason = reason.trim();

    // -------------------------------------------------------------------------
    // ACTION: CANCEL-BASE-PERIOD-END
    // -------------------------------------------------------------------------
    if (action === "cancel-base-period-end") {
      if (!sub || !sub.stripe_subscription_id) {
        throw new EdgeError("NOT_FOUND", "Nenhuma assinatura Stripe encontrada para este estabelecimento.", 404);
      }

      if (!["active", "trialing", "past_due"].includes(sub.status)) {
        throw new EdgeError("CONFLICT", `Não é possível agendar cancelamento de uma assinatura com status '${sub.status}'.`, 409);
      }

      if (sub.cancel_at_period_end) {
        throw new EdgeError("CONFLICT", "O cancelamento ao término do período já está agendado para esta assinatura.", 409);
      }

      // 1. Stripe mutation
      await stripeApiRequest(`/subscriptions/${sub.stripe_subscription_id}`, {
        method: "POST",
        body: {
          cancel_at_period_end: "true",
        },
        idempotencyKey: `admin-cancel-pe-${tenant.id}-${sub.stripe_subscription_id}`,
      });

      // 2. Local DB update
      await adminClient
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      // 3. Record audit log
      await recordAuditLog(
        adminClient,
        adminCaller.userId,
        tenant.id,
        "superadmin.subscription_cancel_at_period_end",
        {
          operation: "cancel-base-period-end",
          reason: cleanReason,
          stripe_subscription_id: sub.stripe_subscription_id,
          previous_state: { cancel_at_period_end: false },
          new_state: { cancel_at_period_end: true },
          tenant_name: tenant.name,
          current_period_end: sub.current_period_end,
          actor_email: adminCaller.email,
        },
        clientIp
      );

      logger.info("Cancel at period end scheduled by Super Admin", {
        tenantId: tenant.id,
        subscriptionId: sub.stripe_subscription_id,
        durationMs: Date.now() - startTime,
      });

      return buildResponse({
        ok: true,
        message: "Cancelamento da assinatura agendado para o término do ciclo atual. Nenhum reembolso emitido.",
        cancel_at_period_end: true,
        current_period_end: sub.current_period_end,
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: REACTIVATE-BASE-SUBSCRIPTION
    // -------------------------------------------------------------------------
    if (action === "reactivate-base-subscription") {
      if (!sub || !sub.stripe_subscription_id) {
        throw new EdgeError("NOT_FOUND", "Nenhuma assinatura Stripe encontrada para este estabelecimento.", 404);
      }

      if (!sub.cancel_at_period_end) {
        throw new EdgeError("CONFLICT", "A assinatura já está configurada para renovação automática contínua.", 409);
      }

      if (!["active", "trialing", "past_due"].includes(sub.status)) {
        throw new EdgeError("CONFLICT", `Não é possível reativar uma assinatura com status definitivo '${sub.status}'.`, 409);
      }

      // 1. Stripe mutation
      await stripeApiRequest(`/subscriptions/${sub.stripe_subscription_id}`, {
        method: "POST",
        body: {
          cancel_at_period_end: "false",
        },
        idempotencyKey: `admin-reactivate-${tenant.id}-${sub.stripe_subscription_id}`,
      });

      // 2. Local DB update
      await adminClient
        .from("subscriptions")
        .update({
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      // 3. Record audit log
      await recordAuditLog(
        adminClient,
        adminCaller.userId,
        tenant.id,
        "superadmin.subscription_reactivate",
        {
          operation: "reactivate-base-subscription",
          reason: cleanReason,
          stripe_subscription_id: sub.stripe_subscription_id,
          previous_state: { cancel_at_period_end: true },
          new_state: { cancel_at_period_end: false },
          tenant_name: tenant.name,
          actor_email: adminCaller.email,
        },
        clientIp
      );

      logger.info("Subscription cancellation unscheduled by Super Admin", {
        tenantId: tenant.id,
        subscriptionId: sub.stripe_subscription_id,
        durationMs: Date.now() - startTime,
      });

      return buildResponse({
        ok: true,
        message: "Renovação automática da assinatura reativada com sucesso. Sem criação de nova assinatura ou cobrança antecipada.",
        cancel_at_period_end: false,
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: CANCEL-BASE-IMMEDIATELY
    // -------------------------------------------------------------------------
    if (action === "cancel-base-immediately") {
      if (!sub || !sub.stripe_subscription_id) {
        throw new EdgeError("NOT_FOUND", "Nenhuma assinatura Stripe encontrada para este estabelecimento.", 404);
      }

      // High-impact typed confirmation check
      if (typedConfirmation !== "CANCELAR") {
        throw new EdgeError(
          "INVALID_REQUEST",
          "Confirmação de segurança ausente ou incorreta. Digite exatamente 'CANCELAR' para autorizar a rescisão imediata.",
          400
        );
      }

      // 1. Terminate subscription immediately in Stripe
      // proration_behavior: "none" ensures NO automatic invoice or refund is generated
      try {
        await stripeApiRequest(`/subscriptions/${sub.stripe_subscription_id}`, {
          method: "DELETE",
          body: {
            proration_behavior: "none",
          },
          idempotencyKey: `admin-cancel-imm-${tenant.id}-${sub.stripe_subscription_id}`,
        });
      } catch (stripeErr: any) {
        // If already deleted in Stripe, proceed to synchronize local state
        logger.warn("Stripe subscription deletion returned message:", stripeErr?.message || stripeErr);
      }

      // 2. Atomic local DB synchronization via cancel_subscription_atomic RPC
      const { data: cancelResult, error: cancelRpcErr } = await adminClient.rpc("cancel_subscription_atomic", {
        p_stripe_subscription_id: sub.stripe_subscription_id,
        p_event_timestamp: new Date().toISOString(),
      });

      if (cancelRpcErr) {
        logger.error("Falha ao executar cancel_subscription_atomic RPC:", cancelRpcErr);
      }

      // 3. Ensure all attached tenant_addons are terminated locally
      await adminClient
        .from("tenant_addons")
        .update({
          status: "canceled",
          cancelled_at: new Date().toISOString(),
          stripe_subscription_item_id: null,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.stripe_subscription_id);

      // 4. Record audit log
      await recordAuditLog(
        adminClient,
        adminCaller.userId,
        tenant.id,
        "superadmin.subscription_cancel_immediately",
        {
          operation: "cancel-base-immediately",
          reason: cleanReason,
          stripe_subscription_id: sub.stripe_subscription_id,
          automatic_refund_issued: false,
          final_plan: cancelResult?.final_profile_plan || "free",
          tenant_name: tenant.name,
          actor_email: adminCaller.email,
        },
        clientIp
      );

      logger.info("Subscription immediately terminated by Super Admin", {
        tenantId: tenant.id,
        subscriptionId: sub.stripe_subscription_id,
        durationMs: Date.now() - startTime,
      });

      return buildResponse({
        ok: true,
        message: "Assinatura cancelada imediatamente no Stripe e no sistema. Nenhum reembolso automático emitido.",
        status: "canceled",
        final_plan: cancelResult?.final_profile_plan || "free",
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: CANCEL-ADDON
    // -------------------------------------------------------------------------
    if (action === "cancel-addon") {
      const { contractId, addonId } = payload;
      if (!contractId && !addonId) {
        throw new EdgeError("INVALID_REQUEST", "Identificador do módulo adicional (contractId ou addonId) ausente.", 400);
      }

      let query = adminClient
        .from("tenant_addons")
        .select(`
          id,
          addon_id,
          status,
          stripe_subscription_id,
          stripe_subscription_item_id,
          saas_addons:addon_id (
            name,
            addon_key
          )
        `)
        .eq("tenant_id", tenant.id)
        .in("status", ["active", "trialing", "past_due"]);

      if (contractId) {
        query = query.eq("id", contractId);
      } else if (addonId) {
        query = query.eq("addon_id", addonId);
      }

      const { data: contract, error: cErr } = await query.maybeSingle();

      if (cErr || !contract) {
        throw new EdgeError("NOT_FOUND", "Contrato ativo do módulo adicional não encontrado para este estabelecimento.", 404);
      }

      // 1. Delete subscription item in Stripe if itemId present
      if (contract.stripe_subscription_item_id) {
        try {
          await stripeApiRequest(`/subscription_items/${contract.stripe_subscription_item_id}`, {
            method: "DELETE",
            body: {
              proration_behavior: "none",
            },
            idempotencyKey: `admin-addon-del-${contract.id}`,
          });
        } catch (sErr: any) {
          logger.warn("Aviso ao remover subscription_item no Stripe:", sErr?.message || sErr);
        }
      }

      // 2. Update tenant_addons record in local DB
      await adminClient
        .from("tenant_addons")
        .update({
          status: "canceled",
          cancelled_at: new Date().toISOString(),
          stripe_subscription_item_id: null,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contract.id);

      // 3. Record audit log
      await recordAuditLog(
        adminClient,
        adminCaller.userId,
        tenant.id,
        "superadmin.addon_cancel",
        {
          operation: "cancel-addon",
          contract_id: contract.id,
          addon_id: contract.addon_id,
          addon_name: (contract as any)?.saas_addons?.name || "Módulo adicional",
          stripe_subscription_item_id: contract.stripe_subscription_item_id,
          base_subscription_id: contract.stripe_subscription_id,
          base_subscription_preserved: true,
          reason: cleanReason,
          actor_email: adminCaller.email,
        },
        clientIp
      );

      logger.info("Add-on item canceled by Super Admin", {
        tenantId: tenant.id,
        contractId: contract.id,
        durationMs: Date.now() - startTime,
      });

      return buildResponse({
        ok: true,
        message: "Módulo adicional removido com sucesso. A assinatura base e outros módulos permanecem inalterados.",
        contract_id: contract.id,
        status: "canceled",
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: READD-ADDON
    // -------------------------------------------------------------------------
    if (action === "readd-addon") {
      const { addonId } = payload;
      if (!addonId) {
        throw new EdgeError("INVALID_REQUEST", "Identificador do módulo adicional (addonId) ausente.", 400);
      }

      if (!sub || !sub.stripe_subscription_id || !["active", "trialing", "past_due"].includes(sub.status)) {
        throw new EdgeError("CONFLICT", "É necessário que o estabelecimento possua uma assinatura base ativa para vincular um add-on.", 409);
      }

      // 1. Fetch addon metadata
      const { data: addon, error: addErr } = await adminClient
        .from("saas_addons")
        .select("*")
        .eq("id", addonId)
        .eq("is_active", true)
        .maybeSingle();

      if (addErr || !addon) {
        throw new EdgeError("NOT_FOUND", "Módulo adicional ativo não encontrado no catálogo.", 404);
      }

      // 2. Check if already active
      const { data: existingActive } = await adminClient
        .from("tenant_addons")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("addon_id", addonId)
        .in("status", ["active", "trialing", "past_due"])
        .maybeSingle();

      if (existingActive) {
        throw new EdgeError("CONFLICT", "Este módulo adicional já se encontra ativo para este estabelecimento.", 409);
      }

      // 3. Resolve canonical Stripe Price strictly server-side
      const targetEnv = sub.environment === "live" ? "live" : "test";
      const isAnnual = sub.billing_cycle === "year" || sub.billing_cycle === "annual" || sub.billing_cycle === "yearly";
      const normalizedCycle = isAnnual ? "year" : "month";

      let priceId: string | null = null;
      if (targetEnv === "live") {
        priceId = isAnnual ? addon.stripe_price_id_annual_live : addon.stripe_price_id_live;
      } else {
        priceId = isAnnual ? addon.stripe_price_id_annual_test : addon.stripe_price_id_test;
      }

      if (!priceId) {
        throw new EdgeError("INVALID_REQUEST", "Módulo adicional sem ID de preço canônico configurado no Stripe.", 400);
      }

      // 4. Create Stripe Subscription Item
      const subscriptionItem = await stripeApiRequest<{ id: string }>("/subscription_items", {
        method: "POST",
        body: {
          subscription: sub.stripe_subscription_id,
          price: priceId,
          quantity: 1,
          proration_behavior: "none",
          metadata: {
            is_addon: "true",
            addon_id: addon.id,
            addon_key: addon.addon_key,
            tenantId: tenant.id,
            billing_cycle: normalizedCycle,
            readded_by_superadmin: "true",
          },
        },
        idempotencyKey: `admin-addon-readd-${tenant.id}-${addon.id}-${Date.now() / 60000 | 0}`,
      });

      // 5. Insert tenant_addons record
      const unitPrice = Number(isAnnual && addon.annual_price ? addon.annual_price : addon.monthly_price || 0);
      const { data: inserted, error: insErr } = await adminClient
        .from("tenant_addons")
        .insert({
          tenant_id: tenant.id,
          addon_id: addon.id,
          environment: targetEnv,
          status: "active",
          quantity: 1,
          unit_price: unitPrice,
          currency: addon.currency || "BRL",
          stripe_subscription_id: sub.stripe_subscription_id,
          stripe_subscription_item_id: subscriptionItem.id,
          starts_at: new Date().toISOString(),
          billing_cycle: normalizedCycle,
          cancel_at_period_end: false,
        })
        .select("id")
        .single();

      if (insErr) {
        logger.error("Erro ao inserir tenant_addons:", insErr);
        throw new EdgeError("INTERNAL_ERROR", "Falha ao registrar novo vínculo de add-on no banco.", 500);
      }

      // 6. Record audit log
      await recordAuditLog(
        adminClient,
        adminCaller.userId,
        tenant.id,
        "superadmin.addon_readd",
        {
          operation: "readd-addon",
          contract_id: inserted.id,
          addon_id: addon.id,
          addon_name: addon.name,
          stripe_subscription_item_id: subscriptionItem.id,
          base_subscription_id: sub.stripe_subscription_id,
          unit_price: unitPrice,
          reason: cleanReason,
          actor_email: adminCaller.email,
        },
        clientIp
      );

      logger.info("Add-on re-added by Super Admin", {
        tenantId: tenant.id,
        addonId: addon.id,
        contractId: inserted.id,
        durationMs: Date.now() - startTime,
      });

      return buildResponse({
        ok: true,
        message: "Módulo adicional contratado e vinculado com sucesso à assinatura existente.",
        contract_id: inserted.id,
        stripe_subscription_item_id: subscriptionItem.id,
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: REFUND-FULL (Privileged Full Refund Foundation)
    // -------------------------------------------------------------------------
    if (action === "refund-full") {
      const { invoiceId, idempotencyKey } = payload;
      if (!invoiceId) {
        throw new EdgeError("INVALID_REQUEST", "Identificador da fatura (invoiceId) ausente.", 400);
      }

      // Interim safety check: typed confirmation "ESTORNAR"
      if (typedConfirmation !== "ESTORNAR") {
        throw new EdgeError(
          "INVALID_REQUEST",
          "Confirmação de segurança ausente ou incorreta. Digite exatamente 'ESTORNAR' para autorizar a devolução.",
          400
        );
      }

      const stripeEnv = sub?.environment === "live" ? "live" : "test";
      const inv = await stripeApiRequest<any>(
        `/invoices/${invoiceId}?expand[]=payment_intent`,
        { environment: stripeEnv }
      );

      if (sub?.stripe_customer_id && inv.customer !== sub.stripe_customer_id) {
        throw new EdgeError("FORBIDDEN", "A fatura informada não pertence ao estabelecimento solicitado.", 403);
      }

      const pi = inv.payment_intent;
      const piId = typeof pi === "string" ? pi : pi?.id || null;
      if (!piId) {
        throw new EdgeError("CONFLICT", "Esta fatura não possui uma intenção de pagamento (PaymentIntent) associada para estorno.", 409);
      }

      const capturedAmount = (typeof pi === "object" ? pi?.amount_received : null) ?? inv.amount_paid ?? 0;
      if (capturedAmount <= 0) {
        throw new EdgeError("CONFLICT", "Esta fatura não possui valor capturado disponível para estorno.", 409);
      }

      // Query existing refunds directly from Stripe
      let totalAlreadyRefunded = 0;
      try {
        const refRes = await stripeApiRequest<{ data: any[] }>(`/refunds?payment_intent=${piId}&limit=50`, { environment: stripeEnv });
        const refunds = refRes?.data || [];
        totalAlreadyRefunded = refunds.reduce((acc: number, r: any) => {
          return (r.status === "succeeded" || r.status === "pending") ? acc + (r.amount || 0) : acc;
        }, 0);
      } catch (rErr) {
        logger.warn("Aviso ao buscar estornos anteriores no Stripe:", rErr);
      }

      const remainingRefundable = Math.max(0, capturedAmount - totalAlreadyRefunded);
      if (remainingRefundable <= 0) {
        throw new EdgeError("CONFLICT", "Todo o saldo desta fatura já foi estornado anteriormente no Stripe.", 409);
      }

      const refundAmount = remainingRefundable;
      const opKey = idempotencyKey || `admin-ref-full-${tenant.id}-${inv.id}-${piId}`;

      // 1. Concurrency and Idempotency: Claim operation atomically in database
      const { data: claimData, error: claimErr } = await adminClient.rpc("claim_refund_operation", {
        p_tenant_id: tenant.id,
        p_actor_user_id: adminCaller.userId,
        p_payment_intent_id: piId,
        p_invoice_id: inv.id,
        p_amount: refundAmount,
        p_currency: inv.currency || "brl",
        p_reason: cleanReason,
        p_idempotency_key: opKey,
        p_metadata: {
          refund_type: "full",
          original_captured: capturedAmount,
          admin_email: adminCaller.email,
        },
      });

      if (claimErr) {
        logger.error("Falha ao registrar claim_refund_operation:", claimErr);
        throw new EdgeError("INTERNAL_ERROR", "Falha no controle de concorrência/idempotência da operação.", 500);
      }

      if (claimData?.already_processed) {
        return buildResponse({
          ok: true,
          message: "Este estorno já foi processado e concluído anteriormente.",
          refund_id: claimData.stripe_refund_id,
          amount: claimData.amount,
          currency: claimData.currency,
          already_processed: true,
        }, 200, req);
      }

      if (claimData?.in_progress) {
        throw new EdgeError("CONFLICT", "Uma solicitação de estorno para esta fatura já está em andamento. Aguarde alguns instantes.", 409);
      }

      const operationId = claimData?.operation_id;

      // 2. Stripe Mutation: Execute refund
      let stripeRefund: any;
      try {
        stripeRefund = await stripeApiRequest<any>("/refunds", {
          method: "POST",
          body: {
            payment_intent: piId,
            amount: refundAmount,
            reason: "requested_by_customer",
            metadata: {
              tenantId: tenant.id,
              invoiceId: inv.id,
              fullRefund: "true",
              actorUserId: adminCaller.userId,
              reason: cleanReason,
            },
          },
          idempotencyKey: opKey,
          environment: stripeEnv,
        });
      } catch (sErr: any) {
        logger.error("Falha ao criar estorno no Stripe:", sErr);
        if (operationId) {
          await adminClient.rpc("fail_refund_operation", {
            p_operation_id: operationId,
            p_error_message: sErr?.message || String(sErr),
          });
        }
        throw new EdgeError("SERVICE_UNAVAILABLE", `Stripe recusou o estorno: ${sErr?.message || "Erro no provedor"}`, 502);
      }

      // 3. Mark operation complete in local database
      if (operationId) {
        await adminClient.rpc("complete_refund_operation", {
          p_operation_id: operationId,
          p_stripe_refund_id: stripeRefund.id,
          p_stripe_charge_id: stripeRefund.charge || null,
        });
      }

      // 4. Record audit log
      await recordAuditLog(
        adminClient,
        adminCaller.userId,
        tenant.id,
        "superadmin.refund_full",
        {
          operation: "refund-full",
          stripe_refund_id: stripeRefund.id,
          stripe_payment_intent_id: piId,
          stripe_invoice_id: inv.id,
          amount: refundAmount,
          currency: inv.currency || "brl",
          reason: cleanReason,
          subscription_impact: "NONE",
          addon_impact: "NONE",
          remaining_after_refund: 0,
          tenant_name: tenant.name,
          actor_email: adminCaller.email,
        },
        clientIp
      );

      logger.info("Full refund executed by Super Admin", {
        tenantId: tenant.id,
        refundId: stripeRefund.id,
        amount: refundAmount,
        durationMs: Date.now() - startTime,
      });

      return buildResponse({
        ok: true,
        message: "Estorno total processado com sucesso no Stripe. A assinatura base e add-ons permanecem inalterados.",
        refund: {
          id: stripeRefund.id,
          amount: refundAmount,
          currency: inv.currency || "brl",
          status: stripeRefund.status || "succeeded",
          remainingRefundableAmount: 0,
          subscriptionImpact: "NONE",
          addonImpact: "NONE",
        },
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: REFUND-PARTIAL (Privileged Partial Refund Foundation)
    // -------------------------------------------------------------------------
    if (action === "refund-partial") {
      const { invoiceId, amount, idempotencyKey } = payload;
      if (!invoiceId) {
        throw new EdgeError("INVALID_REQUEST", "Identificador da fatura (invoiceId) ausente.", 400);
      }

      if (!amount || !Number.isInteger(amount) || amount <= 0) {
        throw new EdgeError("INVALID_REQUEST", "O valor para estorno parcial deve ser um número inteiro positivo em centavos.", 400);
      }

      // Interim safety check: typed confirmation "ESTORNAR"
      if (typedConfirmation !== "ESTORNAR") {
        throw new EdgeError(
          "INVALID_REQUEST",
          "Confirmação de segurança ausente ou incorreta. Digite exatamente 'ESTORNAR' para autorizar a devolução.",
          400
        );
      }

      const stripeEnv = sub?.environment === "live" ? "live" : "test";
      const inv = await stripeApiRequest<any>(
        `/invoices/${invoiceId}?expand[]=payment_intent`,
        { environment: stripeEnv }
      );

      if (sub?.stripe_customer_id && inv.customer !== sub.stripe_customer_id) {
        throw new EdgeError("FORBIDDEN", "A fatura informada não pertence ao estabelecimento solicitado.", 403);
      }

      const pi = inv.payment_intent;
      const piId = typeof pi === "string" ? pi : pi?.id || null;
      if (!piId) {
        throw new EdgeError("CONFLICT", "Esta fatura não possui uma intenção de pagamento (PaymentIntent) associada para estorno.", 409);
      }

      const capturedAmount = (typeof pi === "object" ? pi?.amount_received : null) ?? inv.amount_paid ?? 0;
      if (capturedAmount <= 0) {
        throw new EdgeError("CONFLICT", "Esta fatura não possui valor capturado disponível para estorno.", 409);
      }

      // Authoritative calculation of remaining refundable from Stripe
      let totalAlreadyRefunded = 0;
      try {
        const refRes = await stripeApiRequest<{ data: any[] }>(`/refunds?payment_intent=${piId}&limit=50`, { environment: stripeEnv });
        const refunds = refRes?.data || [];
        totalAlreadyRefunded = refunds.reduce((acc: number, r: any) => {
          return (r.status === "succeeded" || r.status === "pending") ? acc + (r.amount || 0) : acc;
        }, 0);
      } catch (rErr) {
        logger.warn("Aviso ao buscar estornos anteriores no Stripe:", rErr);
      }

      const remainingRefundable = Math.max(0, capturedAmount - totalAlreadyRefunded);
      if (amount > remainingRefundable) {
        throw new EdgeError(
          "INVALID_REQUEST",
          `O valor solicitado (R$ ${(amount / 100).toFixed(2)}) excede o saldo estornável disponível (R$ ${(remainingRefundable / 100).toFixed(2)}).`,
          400
        );
      }

      const refundAmount = amount;
      const opKey = idempotencyKey || `admin-ref-part-${tenant.id}-${inv.id}-${refundAmount}-${Date.now() / 60000 | 0}`;

      // 1. Concurrency and Idempotency: Claim operation atomically in database
      const { data: claimData, error: claimErr } = await adminClient.rpc("claim_refund_operation", {
        p_tenant_id: tenant.id,
        p_actor_user_id: adminCaller.userId,
        p_payment_intent_id: piId,
        p_invoice_id: inv.id,
        p_amount: refundAmount,
        p_currency: inv.currency || "brl",
        p_reason: cleanReason,
        p_idempotency_key: opKey,
        p_metadata: {
          refund_type: "partial",
          original_captured: capturedAmount,
          already_refunded_before: totalAlreadyRefunded,
          admin_email: adminCaller.email,
        },
      });

      if (claimErr) {
        logger.error("Falha ao registrar claim_refund_operation:", claimErr);
        throw new EdgeError("INTERNAL_ERROR", "Falha no controle de concorrência/idempotência da operação.", 500);
      }

      if (claimData?.already_processed) {
        return buildResponse({
          ok: true,
          message: "Este estorno já foi processado e concluído anteriormente.",
          refund_id: claimData.stripe_refund_id,
          amount: claimData.amount,
          currency: claimData.currency,
          already_processed: true,
        }, 200, req);
      }

      if (claimData?.in_progress) {
        throw new EdgeError("CONFLICT", "Uma solicitação de estorno para esta fatura já está em andamento. Aguarde alguns instantes.", 409);
      }

      const operationId = claimData?.operation_id;

      // 2. Stripe Mutation: Execute partial refund
      let stripeRefund: any;
      try {
        stripeRefund = await stripeApiRequest<any>("/refunds", {
          method: "POST",
          body: {
            payment_intent: piId,
            amount: refundAmount,
            reason: "requested_by_customer",
            metadata: {
              tenantId: tenant.id,
              invoiceId: inv.id,
              partialRefund: "true",
              actorUserId: adminCaller.userId,
              reason: cleanReason,
            },
          },
          idempotencyKey: opKey,
          environment: stripeEnv,
        });
      } catch (sErr: any) {
        logger.error("Falha ao criar estorno parcial no Stripe:", sErr);
        if (operationId) {
          await adminClient.rpc("fail_refund_operation", {
            p_operation_id: operationId,
            p_error_message: sErr?.message || String(sErr),
          });
        }
        throw new EdgeError("SERVICE_UNAVAILABLE", `Stripe recusou o estorno: ${sErr?.message || "Erro no provedor"}`, 502);
      }

      // 3. Mark operation complete in local database
      if (operationId) {
        await adminClient.rpc("complete_refund_operation", {
          p_operation_id: operationId,
          p_stripe_refund_id: stripeRefund.id,
          p_stripe_charge_id: stripeRefund.charge || null,
        });
      }

      const remainingAfterRefund = remainingRefundable - refundAmount;

      // 4. Record audit log
      await recordAuditLog(
        adminClient,
        adminCaller.userId,
        tenant.id,
        "superadmin.refund_partial",
        {
          operation: "refund-partial",
          stripe_refund_id: stripeRefund.id,
          stripe_payment_intent_id: piId,
          stripe_invoice_id: inv.id,
          amount: refundAmount,
          currency: inv.currency || "brl",
          reason: cleanReason,
          subscription_impact: "NONE",
          addon_impact: "NONE",
          remaining_after_refund: remainingAfterRefund,
          tenant_name: tenant.name,
          actor_email: adminCaller.email,
        },
        clientIp
      );

      logger.info("Partial refund executed by Super Admin", {
        tenantId: tenant.id,
        refundId: stripeRefund.id,
        amount: refundAmount,
        remainingAfter: remainingAfterRefund,
        durationMs: Date.now() - startTime,
      });

      return buildResponse({
        ok: true,
        message: "Estorno parcial processado com sucesso no Stripe. A assinatura base e add-ons permanecem inalterados.",
        refund: {
          id: stripeRefund.id,
          amount: refundAmount,
          currency: inv.currency || "brl",
          status: stripeRefund.status || "succeeded",
          remainingRefundableAmount: remainingAfterRefund,
          subscriptionImpact: "NONE",
          addonImpact: "NONE",
        },
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: CHANGE-BASE-PLAN (Deferred under fail-closed safety policy)
    // -------------------------------------------------------------------------
    if (action === "change-base-plan") {
      // As audited in Phase R2E.17C Section 11:
      // Direct in-flight plan changes without an existing customer-specific proration agreement
      // are deferred to prevent unmonitored immediate charges or credit collisions.
      return buildResponse({
        ok: false,
        error: "DEFERRED_SAFE",
        message: "A alteração imediata de plano pelo Super Admin está diferida nesta fase por política de segurança de faturamento. Utilize o fluxo canônico de checkout ou gerencie pelo Stripe Dashboard.",
      }, 422, req);
    }

    throw new EdgeError("INVALID_REQUEST", `Ação '${action}' não reconhecida.`, 400);

  } catch (err: any) {
    if (err instanceof EdgeError || err?.name === "EdgeError" || err?.status) {
      const httpStatus = Number(err.status || err.statusCode || 400);
      logger.warn(`EdgeError [${err.code}]: ${err.message}`, { status: httpStatus });
      return buildResponse({ ok: false, error: err.code || "BAD_REQUEST", message: err.message }, httpStatus, req);
    }

    logger.error("Exceção não tratada em stripe-admin-operations:", { error: err?.message || String(err) });
    return buildResponse({
      ok: false,
      error: "INTERNAL_ERROR",
      message: err?.message || "Ocorreu um erro interno no servidor durante a operação administrativa.",
    }, 500, req);
  }
});
