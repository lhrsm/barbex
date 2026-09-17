/**
 * BARBEX SUPABASE EDGE FUNCTION — STRIPE WEBHOOK HANDLER
 * Features:
 * - Reads RAW body for HMAC SHA-256 signature verification
 * - Validates timestamp age (prevents replay attacks)
 * - Atomic event idempotency claim via public.claim_stripe_event RPC
 * - Handles subscription creation, updates, cancellations, checkout completions, and invoice outcomes
 * - Add-on absorption logic upon plan upgrade
 * - Zero PII or credentials in logs
 */

import { handleOptions } from "../_shared/cors.ts";
import { requireMethod } from "../_shared/validation.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { createStructuredLogger } from "../_shared/logging.ts";
import { verifyStripeWebhookSignature, stripeApiRequest } from "../_shared/stripe.ts";

const PRICE_TO_PLAN: Record<string, string> = {
  starter_monthly: "starter",
  pro_monthly: "pro",
  elite_monthly: "elite",
  price_1TVtOWPKG6q10UjrQErPgyKO: "starter",
  price_1TVtOVPKG6q10Ujre6zMGYpk: "pro",
  price_1TVtgWPKG6q10UjrxRUCnyg1: "elite",
  price_1TVsefPKG6q10UjrKpTaUe71: "elite"
};

/**
 * Absorbs contracted add-ons that are now included in the newly upgraded SaaS plan.
 */
async function absorbAddonsIntoPlan(
  adminClient: ReturnType<typeof createAdminClient>,
  tenantId: string,
  subscriptionId: string,
  newPriceId: string,
  environment: string
) {
  if (!newPriceId) return;

  const col = environment === "live" ? "stripe_price_id_live" : "stripe_price_id_test";
  const { data: newPlan } = await adminClient
    .from("plans")
    .select("id, name, allowed_modules")
    .or(`${col}.eq.${newPriceId},slug.eq.${newPriceId.replace(/_monthly$/, "")}`)
    .eq("active", true)
    .maybeSingle();

  const allowed: string[] = Array.isArray(newPlan?.allowed_modules)
    ? (newPlan!.allowed_modules as any[]).filter((v) => typeof v === "string")
    : [];
  if (allowed.length === 0) return;

  const { data: contracts } = await adminClient
    .from("tenant_addons")
    .select("id, addon_id, stripe_subscription_item_id, saas_addons:addon_id(module_key, name, addon_key)")
    .eq("tenant_id", tenantId)
    .eq("stripe_subscription_id", subscriptionId)
    .in("status", ["active", "trialing", "past_due"]);

  const absorbCandidates = ((contracts as any[]) || []).filter(
    (c) => c?.saas_addons?.module_key && allowed.includes(c.saas_addons.module_key)
  );
  if (absorbCandidates.length === 0) return;

  for (const c of absorbCandidates) {
    const itemId = c.stripe_subscription_item_id;
    if (itemId) {
      try {
        await stripeApiRequest(`/subscription_items/${itemId}?proration_behavior=create_prorations`, {
          method: "DELETE"
        });
      } catch (err) {
        console.warn(`[Stripe Webhook] Warning deleting absorbed item ${itemId}:`, err);
      }
    }

    await adminClient
      .from("tenant_addons")
      .update({
        status: "absorbed_by_plan",
        access_source: "plan",
        stripe_subscription_item_id: null,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", c.id);
  }
}

/**
 * Synchronizes add-on subscription items from Stripe subscription object.
 */
async function syncAddonsFromSubscription(
  adminClient: ReturnType<typeof createAdminClient>,
  subscription: any,
  environment: string
) {
  const userId = subscription.metadata?.userId || subscription.metadata?.tenantId;
  if (!userId) return;

  const items = subscription.items?.data || [];
  for (const item of items) {
    const price = item.price || {};
    const meta = price.metadata || {};
    const isAddon = meta.is_addon === "true" || (price.lookup_key || "").startsWith("addon_");
    if (!isAddon) continue;

    const addonKey = meta.addon_key || (price.lookup_key || "").replace(/^addon_/, "").replace(/_monthly$/, "");
    if (!addonKey) continue;

    const { data: addon } = await adminClient
      .from("saas_addons")
      .select("id, monthly_price, currency")
      .eq("addon_key", addonKey)
      .maybeSingle();

    if (!addon) continue;

    const periodStart = item.current_period_start || subscription.current_period_start;
    const periodEnd = item.current_period_end || subscription.current_period_end;
    const itemCancel = meta.cancel_at_period_end === "true" || subscription.cancel_at_period_end === true;

    await adminClient.from("tenant_addons").upsert(
      {
        tenant_id: userId,
        addon_id: addon.id,
        environment,
        status: subscription.status,
        quantity: item.quantity || 1,
        unit_price: (price.unit_amount || 0) / 100 || Number(addon.monthly_price || 0),
        currency: (price.currency || addon.currency || "BRL").toUpperCase(),
        stripe_subscription_id: subscription.id,
        stripe_subscription_item_id: item.id,
        current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: itemCancel,
        updated_at: new Date().toISOString()
      },
      { onConflict: "stripe_subscription_item_id" }
    );
  }
}

Deno.serve(async (req: Request) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  const logger = createStructuredLogger("stripe-webhook", req);
  const startTime = Date.now();

  try {
    requireMethod(req, "POST");

    // 1. Read raw text body for cryptographic signature verification
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("stripe-signature");

    const isValidSignature = await verifyStripeWebhookSignature(rawBody, signatureHeader);
    if (!isValidSignature) {
      logger.error("Invalid Stripe webhook signature");
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Parse verified payload
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const eventId = event?.id;
    const eventType = event?.type;
    const livemode = Boolean(event?.livemode);
    const environment = livemode ? "live" : "test";

    if (!eventId || !eventType) {
      return new Response(JSON.stringify({ error: "Malformed Stripe event" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const adminClient = createAdminClient();

    // 3. Atomic event claim via RPC
    const { data: isClaimed, error: claimErr } = await adminClient.rpc("claim_stripe_event", {
      p_event_id: eventId,
      p_event_type: eventType,
      p_environment: environment
    });

    if (claimErr) {
      console.warn("[Stripe Webhook] Error calling claim_stripe_event RPC:", claimErr);
    }

    // If event was already claimed/processed, return 200 immediately
    if (isClaimed === false) {
      logger.info("Stripe event already processed; skipping execution", { eventId, eventType });
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const object = event.data?.object;

    // -------------------------------------------------------------------------
    // EVENT: CUSTOMER.SUBSCRIPTION.CREATED / UPDATED
    // -------------------------------------------------------------------------
    if (eventType === "customer.subscription.created" || eventType === "customer.subscription.updated") {
      const userId = object.metadata?.userId || object.metadata?.tenantId;
      if (userId) {
        const items = object.items?.data || [];
        const planItem = items.find((it: any) => {
          const meta = it.price?.metadata || {};
          const isAddon = meta.is_addon === "true" || (it.price?.lookup_key || "").startsWith("addon_");
          return !isAddon;
        }) || items[0];

        const priceId = planItem?.price?.lookup_key || planItem?.price?.id;
        const productId = planItem?.price?.product;
        const periodStart = planItem?.current_period_start || object.current_period_start;
        const periodEnd = planItem?.current_period_end || object.current_period_end;

        await adminClient.rpc("sync_subscription_atomic", {
          p_user_id: userId,
          p_stripe_subscription_id: object.id,
          p_stripe_customer_id: object.customer,
          p_price_id: priceId || null,
          p_product_id: productId || null,
          p_status: object.status,
          p_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
          p_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          p_cancel_at_period_end: Boolean(object.cancel_at_period_end),
          p_environment: environment
        });

        await syncAddonsFromSubscription(adminClient, object, environment);

        if (eventType === "customer.subscription.updated" && priceId) {
          await absorbAddonsIntoPlan(adminClient, userId, object.id, priceId, environment);
        }
      }
    }

    // -------------------------------------------------------------------------
    // EVENT: CUSTOMER.SUBSCRIPTION.DELETED
    // -------------------------------------------------------------------------
    else if (eventType === "customer.subscription.deleted") {
      await adminClient
        .from("subscriptions")
        .update({
          status: "canceled",
          updated_at: new Date().toISOString()
        })
        .eq("stripe_subscription_id", object.id);

      await adminClient
        .from("tenant_addons")
        .update({
          status: "canceled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("stripe_subscription_id", object.id);

      const userId = object.metadata?.userId || object.metadata?.tenantId;
      if (userId) {
        await adminClient.from("profiles").update({ plan: "free" }).eq("id", userId);
      }
    }

    // -------------------------------------------------------------------------
    // EVENT: CHECKOUT.SESSION.COMPLETED
    // -------------------------------------------------------------------------
    else if (eventType === "checkout.session.completed") {
      logger.info("Checkout session completed event received", {
        sessionId: object.id,
        status: object.status,
        paymentStatus: object.payment_status
      });
    }

    // -------------------------------------------------------------------------
    // EVENT: INVOICE.PAID
    // -------------------------------------------------------------------------
    else if (eventType === "invoice.paid") {
      const lines = object.lines?.data || [];
      const itemIds: string[] = [];
      for (const line of lines) {
        const itemId = line?.subscription_item || line?.parent?.subscription_item_details?.subscription_item;
        if (itemId) itemIds.push(itemId);
      }

      if (itemIds.length > 0) {
        await adminClient
          .from("tenant_addons")
          .update({
            payment_failed_count: 0,
            last_payment_error: null,
            last_payment_failed_at: null,
            updated_at: new Date().toISOString()
          })
          .in("stripe_subscription_item_id", itemIds);
      }
    }

    // -------------------------------------------------------------------------
    // EVENT: INVOICE.PAYMENT_FAILED
    // -------------------------------------------------------------------------
    else if (eventType === "invoice.payment_failed") {
      logger.info("Invoice payment failed event handled", {
        invoiceId: object.id,
        attemptCount: object.attempt_count
      });
    }

    logger.info("Stripe webhook processed successfully", {
      eventId,
      eventType,
      durationMs: Date.now() - startTime
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: unknown) {
    logger.error("Unexpected error processing Stripe webhook", {
      durationMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : "Unknown error"
    });

    // Return 500 so Stripe knows to retry transient failures
    return new Response(JSON.stringify({ error: "Webhook processing error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
