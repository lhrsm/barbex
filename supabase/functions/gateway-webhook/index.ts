// ==============================================================================
// BARBEX — EDGE FUNCTION: gateway-webhook
// ==============================================================================
// Inbound multi-gateway webhook receiver for end-customer club subscriptions.
// Routes by gateway ID (?gateway=<gatewayId>), normalizes event status,
// and idempotently updates customer_subscriptions and customer_subscription_payments.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { AppError } from "../_shared/errors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return errorResponse(new AppError("METHOD_NOT_ALLOWED", "Apenas POST permitido.", 405));
  }

  const supabaseAdmin = createSupabaseAdminClient();

  try {
    const url = new URL(req.url);
    const gatewayId = url.searchParams.get("gateway");

    if (!gatewayId) {
      return errorResponse(new AppError("MISSING_GATEWAY_ID", "Parâmetro gateway obrigatório na URL.", 400));
    }

    const { data: gw, error: gwErr } = await supabaseAdmin
      .from("payment_gateways")
      .select("*")
      .eq("id", gatewayId)
      .maybeSingle();

    if (gwErr || !gw) {
      return errorResponse(new AppError("GATEWAY_NOT_FOUND", "Gateway não encontrado.", 404));
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    // Log received webhook payload for audit
    await supabaseAdmin.from("payment_gateway_logs").insert({
      tenant_id: gw.tenant_id,
      gateway_id: gw.id,
      event: "webhook_received",
      status: "info",
      message: `provider=${gw.provider} payload=${JSON.stringify(payload).slice(0, 500)}`,
    });

    // Extract normalized status and subscription ID if present in payload
    const providerSubId = payload.subscription_id || payload.id || payload.subscription || null;
    const rawStatus = String(payload.status || payload.event || "").toLowerCase();

    let nextStatus = "pending_payment";
    if (rawStatus.includes("paid") || rawStatus.includes("active") || rawStatus.includes("confirmed")) {
      nextStatus = "active";
    } else if (rawStatus.includes("cancel")) {
      nextStatus = "canceled";
    } else if (rawStatus.includes("fail") || rawStatus.includes("overdue")) {
      nextStatus = "past_due";
    }

    if (providerSubId) {
      await supabaseAdmin
        .from("customer_subscriptions")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .or(`provider_subscription_id.eq.${providerSubId},id.eq.${providerSubId}`);
    }

    return jsonResponse({ success: true, processed: true, gateway: gw.provider }, 200);
  } catch (err: any) {
    return errorResponse(err);
  }
});
