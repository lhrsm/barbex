// ==============================================================================
// BARBEX — EDGE FUNCTION: zapi-webhook
// ==============================================================================
// Multi-tenant WhatsApp webhook receiver for Z-API callbacks.
// Features atomic idempotency, instance binding, appointment confirmation,
// status updates, zero secret leaks, and full multi-tenant isolation.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { EdgeError } from "../_shared/errors.ts";
import {
  getWhatsAppInstanceByInstanceId,
  getTenantWhatsAppInstance,
  getTenantWhatsAppCredentials,
  getWhatsAppCredentialsByInstanceId,
  sendZApiText,
  maskPhone,
  maskSecret,
  constantTimeCompare,
  normalizePhoneForZApi,
  WhatsAppInstance,
  WhatsAppCredentials,
} from "../_shared/zapi.ts";

/** Mantém apenas dígitos e remove o DDI 55 para comparar telefones localmente */
function stripDDI55(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.startsWith("55") ? digits.slice(2) : digits;
}

function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function errorResponse(err: any, headers: HeadersInit = {}): Response {
  const status = err?.status || 500;
  const message = err?.message || "Internal server error";
  const code = err?.code || "INTERNAL_ERROR";
  return new Response(JSON.stringify({ ok: false, success: false, error: message, code }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Handle health-check GET
  if (req.method === "GET") {
    return jsonResponse({ success: true, message: "Z-API Webhook active" }, 200, corsHeaders);
  }

  if (req.method !== "POST") {
    return errorResponse(new EdgeError("INVALID_REQUEST", "Method not allowed", 405), corsHeaders);
  }

  try {
    const supabaseAdmin = createAdminClient();
    const url = new URL(req.url);

    // 1. Parse Payload
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new EdgeError("INVALID_REQUEST", "Invalid JSON payload", 400);
    }

    // 2. Identify Instance & Tenant Securely
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

    let credentials: WhatsAppCredentials | null = null;
    let instance: WhatsAppInstance | null = null;

    if (instanceId) {
      credentials = await getWhatsAppCredentialsByInstanceId(supabaseAdmin, instanceId);
      if (!credentials) {
        instance = await getWhatsAppInstanceByInstanceId(supabaseAdmin, instanceId);
      }
    } else if (barbershopIdFromQuery) {
      credentials = await getTenantWhatsAppCredentials(supabaseAdmin, barbershopIdFromQuery);
      if (!credentials) {
        instance = await getTenantWhatsAppInstance(supabaseAdmin, barbershopIdFromQuery);
      }
    }

    const effectiveInstance = credentials || instance;

    if (!effectiveInstance) {
      // If instance is unknown, reject unauthorized
      console.warn(`[Z-API Webhook] Unknown instance or tenant. instanceId=[${instanceId}] tenant=[${barbershopIdFromQuery}]`);
      return jsonResponse({ success: false, error: "UNAUTHORIZED_INSTANCE" }, 401, corsHeaders);
    }

    // 3. Provider Authentication Verification with Constant-Time Comparison
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

    const expectedClientToken = credentials?.client_token || effectiveInstance.client_token;
    const expectedWebhookToken = credentials?.webhook_token || effectiveInstance.webhook_token;
    const expectedToken = credentials?.token || (effectiveInstance as any).token;

    // If client_token or webhook_token configured, enforce constant-time match
    if (expectedClientToken && expectedClientToken.trim().length > 0) {
      const matchClient = constantTimeCompare(providedClientToken, expectedClientToken.trim());
      const matchWebhook = constantTimeCompare(providedWebhookToken, expectedWebhookToken || expectedToken);
      if (!matchClient && !matchWebhook) {
        console.warn(`[Z-API Webhook] Invalid client-token for instance ${effectiveInstance.instance_id}`);
        return jsonResponse({ success: false, error: "UNAUTHORIZED" }, 401, corsHeaders);
      }
    } else if (expectedWebhookToken && expectedWebhookToken.trim().length > 0) {
      if (!constantTimeCompare(providedWebhookToken, expectedWebhookToken.trim())) {
        console.warn(`[Z-API Webhook] Invalid webhook-token for instance ${effectiveInstance.instance_id}`);
        return jsonResponse({ success: false, error: "UNAUTHORIZED" }, 401, corsHeaders);
      }
    }

    const tenantId = effectiveInstance.tenant_id;
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
      p_instance_id: effectiveInstance.instance_id,
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
            if (effectiveInstance.connected && (effectiveInstance as any).token) {
              await sendZApiText(
                effectiveInstance as any,
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
        if (effectiveInstance.id) {
          await supabaseAdmin
            .from("whatsapp_instances")
            .update({
              connected: true,
              status: "connected",
              updated_at: new Date().toISOString(),
            })
            .eq("id", effectiveInstance.id);
        }
        break;
      }

      case "DisconnectedCallback": {
        if (effectiveInstance.id) {
          await supabaseAdmin
            .from("whatsapp_instances")
            .update({
              connected: false,
              status: "disconnected",
              updated_at: new Date().toISOString(),
            })
            .eq("id", effectiveInstance.id);
        }
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
