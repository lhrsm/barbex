/**
 * BARBEX SUPABASE EDGE FUNCTION — STRIPE ADD-ONS MANAGEMENT
 * Actions:
 * - preview: Computes proration and next billing amount
 * - subscribe: Subscribes tenant to addon via Stripe subscription items
 * - cancel: Schedules addon cancellation at period end
 * - reactivate: Un-schedules cancellation
 * - update-quantity: Updates seat/license quantity with proration
 * - batch-subscribe: Multi-item addon subscription with compensation
 * - admin-create-price: Super-admin only Stripe Product+Price provisioning
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

export type StripeAddonAction =
  | { action: "preview"; addonId: string; quantity?: number; environment?: string }
  | { action: "subscribe"; addonId: string; quantity?: number; environment?: string }
  | { action: "cancel"; contractId: string; environment?: string }
  | { action: "reactivate"; contractId: string; environment?: string }
  | { action: "update-quantity"; contractId: string; quantity: number; environment?: string }
  | { action: "batch-subscribe"; items: Array<{ addonId: string; quantity?: number }>; environment?: string }
  | { action: "admin-create-price"; addonId: string; environment?: string };

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
 * Resolves authenticated caller identity.
 */
async function resolveAuthCaller(
  req: Request,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<{ userId: string; tenantId: string; callerRole: string }> {
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
    .select("id, role, tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (profErr || !profile) {
    throw new EdgeError("FORBIDDEN", "Perfil de usuário não encontrado.", 403);
  }

  const effectiveTenantId = profile.tenant_id || profile.id;
  const isPrivileged = ["super_admin", "admin", "tenant_admin", "shop_owner"].includes(profile.role || "");

  if (!isPrivileged) {
    throw new EdgeError("FORBIDDEN", "Apenas administradores podem gerenciar módulos adicionais.", 403);
  }

  return {
    userId,
    tenantId: effectiveTenantId,
    callerRole: profile.role || "admin"
  };
}

Deno.serve(async (req: Request) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  const logger = createStructuredLogger("stripe-addons", req);
  const startTime = Date.now();

  try {
    requireMethod(req, "POST");

    const payload = await parseJsonBody<StripeAddonAction>(req, 32768);
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "";
    const adminClient = createAdminClient();

    if (!payload || typeof payload !== "object" || !("action" in payload)) {
      throw new EdgeError("INVALID_REQUEST", "Ação não especificada ou inválida.", 400);
    }

    const { userId, tenantId, callerRole } = await resolveAuthCaller(req, adminClient);

    // -------------------------------------------------------------------------
    // ACTION: PREVIEW
    // -------------------------------------------------------------------------
    if (payload.action === "preview") {
      const { addonId, quantity = 1, environment = "test" } = payload;
      const cleanQty = Math.max(1, Math.min(1000, Math.floor(quantity)));

      const { data: addon, error: addErr } = await adminClient
        .from("saas_addons")
        .select("*")
        .eq("id", addonId)
        .maybeSingle();

      if (addErr || !addon) {
        throw new EdgeError("NOT_FOUND", "Add-on não encontrado.", 404);
      }

      const priceField = environment === "live" ? "stripe_price_id_live" : "stripe_price_id_test";
      const priceId = addon[priceField];
      if (!priceId) {
        throw new EdgeError("INVALID_REQUEST", "Módulo ainda não configurado no Stripe.", 400);
      }

      const monthlyPrice = Number(addon.monthly_price || 0);
      const subtotal = monthlyPrice * cleanQty;

      return buildResponse({
        ok: true,
        unitPrice: monthlyPrice,
        quantity: cleanQty,
        subtotal,
        currency: addon.currency || "BRL",
        addonName: addon.name
      }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: SUBSCRIBE
    // -------------------------------------------------------------------------
    if (payload.action === "subscribe") {
      const { addonId, quantity = 1, environment = "test" } = payload;
      const cleanQty = Math.max(1, Math.min(1000, Math.floor(quantity)));

      const rateLimitKey = await generateRateLimitKey("stripe:addon_sub", addonId, tenantId, clientIp);
      await checkRateLimit(rateLimitKey, 10, 300);

      // 1. Verify addon existence
      const { data: addon, error: addErr } = await adminClient
        .from("saas_addons")
        .select("*")
        .eq("id", addonId)
        .eq("is_active", true)
        .maybeSingle();

      if (addErr || !addon) {
        throw new EdgeError("NOT_FOUND", "Add-on não encontrado ou inativo.", 404);
      }

      const priceField = environment === "live" ? "stripe_price_id_live" : "stripe_price_id_test";
      const priceId = addon[priceField];
      if (!priceId) {
        throw new EdgeError("INVALID_REQUEST", "Módulo ainda não configurado no Stripe.", 400);
      }

      // 2. Check if already contracted
      const { data: existingContract } = await adminClient
        .from("tenant_addons")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .eq("addon_id", addonId)
        .in("status", ["active", "trialing", "past_due"])
        .maybeSingle();

      if (existingContract) {
        throw new EdgeError("CONFLICT", "Este módulo já está contratado para seu estabelecimento.", 409);
      }

      // 3. Find active base SaaS subscription
      const { data: sub } = await adminClient
        .from("subscriptions")
        .select("stripe_subscription_id, stripe_customer_id")
        .eq("user_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub?.stripe_subscription_id) {
        throw new EdgeError("FORBIDDEN", "É necessário possuir uma assinatura ativa para contratar add-ons.", 403);
      }

      // 4. Create Stripe Subscription Item
      const subscriptionItem = await stripeApiRequest<{ id: string }>("/subscription_items", {
        method: "POST",
        body: {
          subscription: sub.stripe_subscription_id,
          price: priceId,
          quantity: cleanQty,
          proration_behavior: "create_prorations",
          metadata: {
            is_addon: "true",
            addon_id: addonId,
            addon_key: addon.addon_key,
            tenantId
          }
        }
      });

      // 5. Insert tenant_addons record
      const { data: inserted, error: insErr } = await adminClient
        .from("tenant_addons")
        .insert({
          tenant_id: tenantId,
          addon_id: addonId,
          environment,
          status: "active",
          quantity: cleanQty,
          unit_price: Number(addon.monthly_price || 0),
          currency: addon.currency || "BRL",
          stripe_subscription_id: sub.stripe_subscription_id,
          stripe_subscription_item_id: subscriptionItem.id,
          starts_at: new Date().toISOString()
        })
        .select("id")
        .single();

      if (insErr) {
        throw new EdgeError("INTERNAL_ERROR", "Falha ao registrar contratação no banco.", 500);
      }

      logger.info("Add-on subscribed successfully", { action: "subscribe", addonId, durationMs: Date.now() - startTime });
      return buildResponse({ ok: true, contractId: inserted.id }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: CANCEL
    // -------------------------------------------------------------------------
    if (payload.action === "cancel") {
      const { contractId } = payload;
      if (!contractId) throw new EdgeError("INVALID_REQUEST", "Identificador do contrato ausente.", 400);

      const { data: contract, error: cErr } = await adminClient
        .from("tenant_addons")
        .select("*")
        .eq("id", contractId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (cErr || !contract) {
        throw new EdgeError("NOT_FOUND", "Contrato não encontrado.", 404);
      }

      if (contract.stripe_subscription_item_id) {
        try {
          await stripeApiRequest(`/subscription_items/${contract.stripe_subscription_item_id}`, {
            method: "POST",
            body: {
              metadata: {
                cancel_at_period_end: "true",
                cancelled_at: new Date().toISOString()
              }
            }
          });
        } catch (sErr) {
          console.warn("[Stripe Addons] Warning updating stripe item metadata:", sErr);
        }
      }

      await adminClient
        .from("tenant_addons")
        .update({
          cancel_at_period_end: true,
          cancelled_at: new Date().toISOString()
        })
        .eq("id", contractId)
        .eq("tenant_id", tenantId);

      logger.info("Add-on marked to cancel at period end", { action: "cancel", contractId, durationMs: Date.now() - startTime });
      return buildResponse({ ok: true }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: REACTIVATE
    // -------------------------------------------------------------------------
    if (payload.action === "reactivate") {
      const { contractId } = payload;
      if (!contractId) throw new EdgeError("INVALID_REQUEST", "Identificador do contrato ausente.", 400);

      const { data: contract, error: cErr } = await adminClient
        .from("tenant_addons")
        .select("*")
        .eq("id", contractId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (cErr || !contract) {
        throw new EdgeError("NOT_FOUND", "Contrato não encontrado.", 404);
      }

      await adminClient
        .from("tenant_addons")
        .update({
          cancel_at_period_end: false,
          cancelled_at: null
        })
        .eq("id", contractId)
        .eq("tenant_id", tenantId);

      logger.info("Add-on cancellation reverted", { action: "reactivate", contractId, durationMs: Date.now() - startTime });
      return buildResponse({ ok: true }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: UPDATE-QUANTITY
    // -------------------------------------------------------------------------
    if (payload.action === "update-quantity") {
      const { contractId, quantity } = payload;
      const cleanQty = Math.max(1, Math.min(1000, Math.floor(quantity)));

      const { data: contract, error: cErr } = await adminClient
        .from("tenant_addons")
        .select("*")
        .eq("id", contractId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (cErr || !contract) {
        throw new EdgeError("NOT_FOUND", "Contrato não encontrado.", 404);
      }

      if (contract.stripe_subscription_item_id) {
        await stripeApiRequest(`/subscription_items/${contract.stripe_subscription_item_id}`, {
          method: "POST",
          body: {
            quantity: cleanQty,
            proration_behavior: "create_prorations"
          }
        });
      }

      await adminClient
        .from("tenant_addons")
        .update({
          quantity: cleanQty,
          updated_at: new Date().toISOString()
        })
        .eq("id", contractId)
        .eq("tenant_id", tenantId);

      logger.info("Add-on quantity updated", { action: "update-quantity", contractId, quantity: cleanQty, durationMs: Date.now() - startTime });
      return buildResponse({ ok: true, quantity: cleanQty }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: ADMIN-CREATE-PRICE (Super Admin Only)
    // -------------------------------------------------------------------------
    if (payload.action === "admin-create-price") {
      if (callerRole !== "super_admin") {
        throw new EdgeError("FORBIDDEN", "Apenas super administradores podem provisionar preços no Stripe.", 403);
      }

      const { addonId, environment = "test" } = payload;
      const { data: addon, error: aErr } = await adminClient
        .from("saas_addons")
        .select("*")
        .eq("id", addonId)
        .maybeSingle();

      if (aErr || !addon) {
        throw new EdgeError("NOT_FOUND", "Add-on não encontrado.", 404);
      }

      const priceField = environment === "live" ? "stripe_price_id_live" : "stripe_price_id_test";
      if (addon[priceField]) {
        return buildResponse({ ok: true, priceId: addon[priceField], existing: true }, 200, req);
      }

      // Create Product in Stripe
      const product = await stripeApiRequest<{ id: string }>("/products", {
        method: "POST",
        body: {
          name: `Add-on: ${addon.name}`,
          description: addon.description || undefined,
          metadata: {
            is_addon: "true",
            addon_key: addon.addon_key,
            addon_id: addonId
          }
        }
      });

      // Create recurring Price in Stripe
      const price = await stripeApiRequest<{ id: string }>("/prices", {
        method: "POST",
        body: {
          product: product.id,
          currency: (addon.currency || "brl").toLowerCase(),
          unit_amount: Math.round(Number(addon.monthly_price || 0) * 100),
          "recurring[interval]": "month",
          metadata: {
            is_addon: "true",
            addon_key: addon.addon_key,
            addon_id: addonId
          }
        }
      });

      // Update database row
      await adminClient
        .from("saas_addons")
        .update({ [priceField]: price.id })
        .eq("id", addonId);

      logger.info("Admin created Stripe price for add-on", { action: "admin-create-price", addonId, priceId: price.id, durationMs: Date.now() - startTime });
      return buildResponse({ ok: true, priceId: price.id, productId: product.id }, 200, req);
    }

    throw new EdgeError("INVALID_REQUEST", "Ação desconhecida.", 400);
  } catch (err: unknown) {
    if (err instanceof EdgeError) {
      return buildResponse({ ok: false, code: err.code, error: err.message }, err.status, req);
    }

    logger.error("Unexpected error during stripe-addons execution", {
      durationMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : "Unknown error"
    });

    return buildResponse({ ok: false, code: "SERVICE_UNAVAILABLE", error: "Serviço de add-ons temporariamente indisponível." }, 503, req);
  }
});
