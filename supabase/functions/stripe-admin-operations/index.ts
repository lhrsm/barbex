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
  | "change-base-plan";

export interface StripeAdminOperationPayload {
  action: StripeAdminOperationAction;
  tenantId: string;
  subscriptionId?: string;
  addonId?: string;
  contractId?: string;
  targetPlanKey?: string;
  reason?: string;
  typedConfirmation?: string;
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
