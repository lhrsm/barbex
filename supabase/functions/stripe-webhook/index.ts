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
import { checkWebhookEventOrder, evaluateSubscriptionProfileConsistency } from "../_shared/stripe-pricing.ts";


export interface PlanMappingInfo {
  planKey: "starter" | "pro" | "elite";
  billingCycle: "month" | "year";
  legacy?: boolean;
}

export const PRICE_TO_PLAN_INFO: Record<string, PlanMappingInfo> = {
  // Lookup keys
  starter_monthly: { planKey: "starter", billingCycle: "month" },
  pro_monthly: { planKey: "pro", billingCycle: "month" },
  elite_monthly: { planKey: "elite", billingCycle: "month" },
  starter_yearly: { planKey: "starter", billingCycle: "year" },
  pro_yearly: { planKey: "pro", billingCycle: "year" },
  elite_yearly: { planKey: "elite", billingCycle: "year" },

  // Commercial LIVE Monthly Price IDs
  price_1TVtOWPKG6q10UjrQErPgyKO: { planKey: "starter", billingCycle: "month" },
  price_1TVtOVPKG6q10Ujre6zMGYpk: { planKey: "pro", billingCycle: "month" },
  price_1TmYG0PKG6q10UjrOx8tEehr: { planKey: "elite", billingCycle: "month" },

  // Commercial LIVE Yearly Price IDs
  price_1UJDZBPKG6q10UjrQrf3rHBS: { planKey: "starter", billingCycle: "year" },
  price_1UJDaCPKG6q10UjrWOjctNmr: { planKey: "pro", billingCycle: "year" },
  price_1UJDX4PKG6q10UjrzkytrHAJ: { planKey: "elite", billingCycle: "year" },

  // Historical/Legacy IDs (recognition preserved, blocked for new checkouts)
  price_1TVtgWPKG6q10UjrxRUCnyg1: { planKey: "elite", billingCycle: "month", legacy: true },
  price_1TVsefPKG6q10UjrKpTaUe71: { planKey: "elite", billingCycle: "month", legacy: true },
};

// Backward-compatible string map
const PRICE_TO_PLAN: Record<string, string> = Object.fromEntries(
  Object.entries(PRICE_TO_PLAN_INFO).map(([k, v]) => [k, v.planKey])
);

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

  const colMonthly = environment === "live" ? "stripe_price_id_live" : "stripe_price_id_test";
  const colYearly = environment === "live" ? "stripe_yearly_price_id_live" : "stripe_yearly_price_id_test";
  const planInfo = PRICE_TO_PLAN_INFO[newPriceId];
  const targetSlug = planInfo?.planKey || newPriceId.replace(/_(monthly|yearly)$/, "");

  const { data: newPlan } = await adminClient
    .from("plans")
    .select("id, name, allowed_modules")
    .or(`${colMonthly}.eq.${newPriceId},${colYearly}.eq.${newPriceId},slug.eq.${targetSlug}`)
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
  const currentStripeItemIds = new Set<string>();

  for (const item of items) {
    const price = item.price || {};
    const meta = price.metadata || {};
    const isAddon = meta.commercial_type === "addon" || meta.is_addon === "true" || (price.lookup_key || "").startsWith("addon_");
    if (!isAddon) continue;

    currentStripeItemIds.add(item.id);

    const addonKey = meta.addon_key || (price.lookup_key || "").replace(/^addon_/, "").replace(/_monthly$/, "").replace(/_annual$/, "");
    if (!addonKey) continue;

    const { data: addon } = await adminClient
      .from("saas_addons")
      .select("id, monthly_price, annual_price, currency")
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

  // P2-D: WEBHOOK MISSING-ITEM PRUNING (Snapshot Reconciliation)
  // Identify tenant_addons belonging to this subscription that no longer exist in Stripe items snapshot
  const { data: existingContracts } = await adminClient
    .from("tenant_addons")
    .select("id, stripe_subscription_item_id, status")
    .eq("stripe_subscription_id", subscription.id)
    .in("status", ["active", "trialing", "past_due"]);

  if (existingContracts && existingContracts.length > 0) {
    for (const contract of existingContracts) {
      if (contract.stripe_subscription_item_id && !currentStripeItemIds.has(contract.stripe_subscription_item_id)) {
        await adminClient
          .from("tenant_addons")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancel_at_period_end: false,
            updated_at: new Date().toISOString()
          })
          .eq("id", contract.id);
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  const logger = createStructuredLogger("stripe-webhook", req);
  const startTime = Date.now();

  let eventId: string | null = null;
  let eventType: string | null = null;
  let leaseToken: string | null = null;

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

    eventId = event?.id || null;
    eventType = event?.type || null;
    const livemode = Boolean(event?.livemode);
    const environment = livemode ? "live" : "test";

    if (!eventId || !eventType) {
      return new Response(JSON.stringify({ error: "Malformed Stripe event" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const adminClient = createAdminClient();

    // 3. Atomic event claim via RPC with fencing lease_token
    const { data: claimData, error: claimErr } = await adminClient.rpc("claim_stripe_event", {
      p_event_id: eventId,
      p_event_type: eventType,
      p_environment: environment
    });

    if (claimErr) {
      console.warn("[Stripe Webhook] Error calling claim_stripe_event RPC:", claimErr);
    }

    const isClaimed = typeof claimData === "boolean" ? claimData : Boolean((claimData as any)?.claimed);
    leaseToken = typeof claimData === "object" ? (claimData as any)?.lease_token : null;

    // If event was already claimed/processed or under active lease, return 200 immediately
    if (!isClaimed) {
      logger.info("Stripe event already processed or actively leased; skipping execution", {
        eventId,
        eventType,
        reason: (claimData as any)?.reason
      });
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
        // Out-of-order check strictly based on event.created timestamp vs stored latest_event_timestamp
        // (Does NOT use updated_at to prevent false rejections from local database touches)
        const { data: existingSub } = await adminClient
          .from("subscriptions")
          .select("latest_event_timestamp")
          .eq("stripe_subscription_id", object.id)
          .maybeSingle();

        const orderCheck = checkWebhookEventOrder(event.created, existingSub?.latest_event_timestamp);
        if (orderCheck.isStale) {
          logger.info("Out-of-order Stripe event ignored to prevent race condition/downgrade", {
            eventId,
            eventType,
            eventCreated: event.created,
            storedLatestEvent: existingSub?.latest_event_timestamp,
            reason: orderCheck.reason,
          });
          return new Response(JSON.stringify({ received: true, ignored_out_of_order: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

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
          p_environment: environment,
          p_event_timestamp: event.created ? new Date(event.created * 1000).toISOString() : null
        });

        // Note: Canonical profile.plan entitlement is atomically maintained by sync_subscription_atomic
        // inside the transactional advisory lock based on all active subscriptions of user_id.

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
      const { data: cancelResult, error: cancelErr } = await adminClient.rpc("cancel_subscription_atomic", {
        p_stripe_subscription_id: object.id,
        p_event_timestamp: event.created ? new Date(event.created * 1000).toISOString() : null,
      });

      if (cancelErr) {
        logger.error("Error executing cancel_subscription_atomic RPC", { error: cancelErr.message });
        throw new Error(`cancel_subscription_atomic failed: ${cancelErr.message}`);
      }

      if (cancelResult?.ignored_out_of_order) {
        logger.info("Out-of-order customer.subscription.deleted event ignored", {
          eventId,
          eventCreated: event.created,
          subscriptionId: object.id,
        });
        return new Response(JSON.stringify({ received: true, ignored_out_of_order: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      logger.info("Subscription cancelled atomically with supersession protection", {
        subscriptionId: object.id,
        finalProfilePlan: cancelResult?.final_profile_plan,
        userId: cancelResult?.user_id,
      });
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

      if (object.subscription) {
        try {
          const eventTimestamp = event?.created ? new Date(event.created * 1000).toISOString() : null;
          await adminClient.rpc("record_subscription_payment_failed", {
            p_stripe_subscription_id: object.subscription,
            p_event_timestamp: eventTimestamp,
          });
        } catch (pfErr) {
          logger.warn("Failed to record subscription payment failed timestamp", {
            subscriptionId: object.subscription,
            error: pfErr,
          });
        }
      }
    }

    // 4. Mark event as completed in idempotency table conditioned on lease_token
    if (eventId && leaseToken) {
      try {
        const { data: completedOk, error: compErr } = await adminClient.rpc("complete_stripe_event", {
          p_event_id: eventId,
          p_lease_token: leaseToken
        });
        if (compErr || completedOk === false) {
          logger.warn("Warning: complete_stripe_event failed or lease lost", { eventId, completedOk, compErr });
        }
      } catch (completeErr) {
        console.warn("[Stripe Webhook] Error calling complete_stripe_event RPC:", completeErr);
      }
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
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    logger.error("Unexpected error processing Stripe webhook", {
      durationMs: Date.now() - startTime,
      errorMessage: errorMsg
    });

    // Mark event as failed in idempotency table so Stripe retries can be processed, conditioned on lease_token
    if (eventId && leaseToken) {
      try {
        const adminClient = createAdminClient();
        await adminClient.rpc("fail_stripe_event", {
          p_event_id: eventId,
          p_lease_token: leaseToken,
          p_error: errorMsg
        });
      } catch (failErr) {
        console.warn("[Stripe Webhook] Error recording event failure:", failErr);
      }
    }

    // Return 500 so Stripe knows to retry transient failures
    return new Response(JSON.stringify({ error: "Webhook processing error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
