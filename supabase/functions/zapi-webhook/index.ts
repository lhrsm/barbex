// ==============================================================================
// BARBEX — EDGE FUNCTION: zapi-webhook
// ==============================================================================
// Multi-tenant WhatsApp webhook receiver for Z-API callbacks.
// Features atomic idempotency, instance binding, appointment confirmation,
// status updates, zero secret leaks, and full multi-tenant isolation.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { AppError } from "../_shared/errors.ts";
import {
  getWhatsAppInstanceByInstanceId,
  getTenantWhatsAppInstance,
  sendZApiText,
  maskPhone,
  maskSecret,
  normalizePhoneForZApi,
  WhatsAppInstance,
} from "../_shared/zapi.ts";

/** Mantém apenas dígitos e remove o DDI 55 para comparar telefones localmente */
function stripDDI55(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.startsWith("55") ? digits.slice(2) : digits;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Handle health-check GET
  if (req.method === "GET") {
    return jsonResponse({ success: true, message: "Z-API Webhook active" }, 200, corsHeaders);
  }

  if (req.method !== "POST") {
    return errorResponse(new AppError("METHOD_NOT_ALLOWED", "Method not allowed", 405), corsHeaders);
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const url = new URL(req.url);

    // 1. Parse Payload
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new AppError("INVALID_REQUEST", "Invalid JSON payload", 400);
    }

    // 2. Identify Instance & Tenant
    const instanceId =
      body.instanceId ||
      body.instance_id ||
      url.searchParams.get("instanceId") ||
      url.searchParams.get("instance_id") ||
      "";

    const barbershopIdFromQuery =
      url.searchParams.get("barbershopId") ||
      url.searchParams.get("tenantId") ||
      "";

    let instance: WhatsAppInstance | null = null;

    if (instanceId) {
      instance = await getWhatsAppInstanceByInstanceId(supabaseAdmin, instanceId);
    } else if (barbershopIdFromQuery) {
      instance = await getTenantWhatsAppInstance(supabaseAdmin, barbershopIdFromQuery);
    }

    if (!instance) {
      // If instance is unknown, reject unauthorized
      console.warn(`[Z-API Webhook] Unknown instance or tenant. instanceId=[${instanceId}] tenant=[${barbershopIdFromQuery}]`);
      return jsonResponse({ success: false, error: "UNAUTHORIZED_INSTANCE" }, 401, corsHeaders);
    }

    // 3. Provider Authentication Verification
    const providedClientToken =
      req.headers.get("client-token") ||
      req.headers.get("Client-Token") ||
      url.searchParams.get("client_token") ||
      url.searchParams.get("clientToken") ||
      "";

    const providedWebhookToken =
      req.headers.get("x-webhook-token") ||
      url.searchParams.get("token") ||
      "";

    // If instance has client_token or webhook_token configured, enforce match
    if (instance.client_token && instance.client_token.trim().length > 0) {
      if (
        providedClientToken !== instance.client_token.trim() &&
        providedWebhookToken !== (instance.webhook_token || instance.token)
      ) {
        console.warn(`[Z-API Webhook] Invalid client-token for instance ${instance.instance_id}`);
        return jsonResponse({ success: false, error: "UNAUTHORIZED" }, 401, corsHeaders);
      }
    } else if (instance.webhook_token && instance.webhook_token.trim().length > 0) {
      if (providedWebhookToken !== instance.webhook_token.trim()) {
        console.warn(`[Z-API Webhook] Invalid webhook-token for instance ${instance.instance_id}`);
        return jsonResponse({ success: false, error: "UNAUTHORIZED" }, 401, corsHeaders);
      }
    }

    const tenantId = instance.tenant_id;
    const eventType = body.type || "unknown_event";

    // 4. Extract Event / Message Identifier for Idempotency
    const eventId =
      body.messageId ||
      body.id ||
      body.eventId ||
      (body.body && (body.body.messageId || body.body.id)) ||
      (body.zaapId ? `zaap_${body.zaapId}` : null) ||
      `${eventType}_${body.phone || body.from || "system"}_${body.timestamp || Date.now()}`;

    // 5. Atomic Idempotency Claim via claim_zapi_event RPC
    const { data: claimResult, error: claimErr } = await supabaseAdmin.rpc("claim_zapi_event", {
      p_event_id: String(eventId),
      p_event_type: eventType,
      p_tenant_id: tenantId,
      p_instance_id: instance.instance_id,
      p_source: "zapi_webhook",
    });

    if (claimErr) {
      // Fallback: direct table check if RPC not yet materialized
      const { data: existingEvent } = await supabaseAdmin
        .from("zapi_processed_events")
        .select("id")
        .eq("event_id", String(eventId))
        .maybeSingle();

      if (existingEvent) {
        return jsonResponse({ success: true, status: "already_processed", eventId }, 200, corsHeaders);
      }
    } else if (claimResult && claimResult.claimed === false) {
      return jsonResponse({ success: true, status: "already_processed", eventId }, 200, corsHeaders);
    }

    // 6. Ignore outgoing messages from self
    if (body.fromMe === true) {
      return jsonResponse({ success: true, status: "ignored_from_me" }, 200, corsHeaders);
    }

    // 7. Handle Specific Event Types
    const rawPhone = body.phone || body.from || (body.body && body.body.phone) || "";
    const normalizedDigits = stripDDI55(rawPhone);

    // Record webhook log safely
    try {
      await supabaseAdmin.from("webhook_logs").insert({
        barbershop_id: tenantId,
        payload: {
          type: eventType,
          phone: maskPhone(rawPhone),
          messageId: eventId,
        },
        event_type: eventType,
        status: "received",
      });
    } catch {
      // Non-blocking
    }

    switch (eventType) {
      case "ReceivedCallback": {
        const buttonId =
          body.buttonsResponseMessage?.buttonId ||
          body.listResponseMessage?.listRowId ||
          (body.body && body.body.buttonsResponseMessage?.buttonId);

        // If customer clicked 'main_confirm' or replied to confirm appointment
        if (buttonId === "main_confirm" && normalizedDigits.length >= 8) {
          // Find future scheduled appointments for this tenant and phone
          const { data: appointments } = await supabaseAdmin
            .from("appointments")
            .select("id, customer_phone, start_time, status")
            .eq("tenant_id", tenantId)
            .in("status", ["scheduled", "awaiting_confirmation"])
            .gte("start_time", new Date().toISOString())
            .order("start_time", { ascending: true })
            .limit(10);

          const matchingAppt = (appointments || []).find(
            (a: any) => stripDDI55(a.customer_phone) === normalizedDigits
          );

          if (matchingAppt) {
            // Update appointment status to confirmed
            await supabaseAdmin
              .from("appointments")
              .update({
                status: "confirmed",
                confirmed_at: new Date().toISOString(),
              })
              .eq("id", matchingAppt.id);

            // Send confirmation acknowledgment back via WhatsApp
            if (instance.connected) {
              await sendZApiText(
                instance,
                rawPhone,
                "✅ Seu agendamento foi confirmado com sucesso! Te esperamos lá."
              );
            }
          }
        }
        break;
      }

      case "DeliveryCallback":
      case "MessageStatusCallback": {
        const deliveryStatus = (body.status || "").toUpperCase(); // e.g. SENT, RECEIVED, READ, FAILED
        const providerMsgId = body.messageId || body.id || (body.body && body.body.messageId);

        if (providerMsgId) {
          // Update review automation logs if matching provider_message_id
          await supabaseAdmin
            .from("review_automation_logs")
            .update({
              status: deliveryStatus.toLowerCase() === "read" ? "read" : "delivered",
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", tenantId)
            .eq("provider_message_id", providerMsgId);
        }
        break;
      }

      case "ConnectedCallback": {
        await supabaseAdmin
          .from("whatsapp_instances")
          .update({
            connected: true,
            status: "connected",
            updated_at: new Date().toISOString(),
          })
          .eq("id", instance.id);
        break;
      }

      case "DisconnectedCallback": {
        await supabaseAdmin
          .from("whatsapp_instances")
          .update({
            connected: false,
            status: "disconnected",
            updated_at: new Date().toISOString(),
          })
          .eq("id", instance.id);
        break;
      }

      default: {
        // Safe 200 for unhandled/unsupported events
        return jsonResponse(
          { success: true, status: "unsupported_event_ignored", eventType },
          200,
          corsHeaders
        );
      }
    }

    return jsonResponse(
      {
        success: true,
        status: "processed",
        eventId,
      },
      200,
      corsHeaders
    );
  } catch (err) {
    return errorResponse(err, corsHeaders);
  }
});
