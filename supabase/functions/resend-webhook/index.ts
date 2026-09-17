// ==============================================================================
// BARBEX — EDGE FUNCTION: resend-webhook
// ==============================================================================
// Inbound webhook receiver for Resend transactional email events.
// Handles: email.sent, email.delivered, email.bounced, email.complained.
// Idempotently updates email_logs table with delivery timestamps and error codes.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { AppError } from "../_shared/errors.ts";

interface ResendEventBody {
  type: "email.sent" | "email.delivered" | "email.bounced" | "email.complained";
  created_at?: string;
  data?: {
    id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
  };
  id?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return errorResponse(new AppError("METHOD_NOT_ALLOWED", "Apenas POST permitido.", 405));
  }

  const supabaseAdmin = createSupabaseAdminClient();

  try {
    const rawText = await req.text();
    let body: ResendEventBody;
    try {
      body = JSON.parse(rawText);
    } catch {
      return errorResponse(new AppError("INVALID_JSON", "Payload inválido.", 400));
    }

    const { type, data, created_at, id: eventId } = body;
    if (!data || !data.id) {
      return errorResponse(new AppError("MISSING_DATA", "ID da mensagem não fornecido.", 400));
    }

    const messageId = data.id;
    const timestamp = created_at || data.created_at || new Date().toISOString();

    // 1. Check idempotency: if already delivered and this is a delayed 'sent', ignore
    const { data: existingLog } = await supabaseAdmin
      .from("email_logs")
      .select("id, status, provider_event_id")
      .eq("provider_message_id", messageId)
      .maybeSingle();

    if (existingLog && existingLog.status === "delivered" && type === "email.sent") {
      return jsonResponse({ success: true, message: "Already processed" }, 200);
    }

    let status = "sent";
    const updateData: Record<string, any> = {
      provider_event_id: eventId || messageId,
      updated_at: new Date().toISOString(),
    };

    switch (type) {
      case "email.sent":
        status = "sent";
        break;
      case "email.delivered":
        status = "delivered";
        updateData.delivered_at = timestamp;
        break;
      case "email.bounced":
        status = "bounced";
        updateData.failed_at = timestamp;
        updateData.error_code = "bounce";
        break;
      case "email.complained":
        status = "complained";
        break;
      default:
        return jsonResponse({ success: true, ignored: "unhandled event type" }, 200);
    }

    updateData.status = status;

    if (existingLog) {
      await supabaseAdmin
        .from("email_logs")
        .update(updateData)
        .eq("id", existingLog.id);
    } else {
      await supabaseAdmin.from("email_logs").insert({
        provider_message_id: messageId,
        provider_event_id: eventId || messageId,
        recipient: Array.isArray(data.to) ? data.to.join(", ") : data.to || "unknown",
        subject: data.subject || "Sem assunto",
        status,
        delivered_at: updateData.delivered_at || null,
        failed_at: updateData.failed_at || null,
        error_code: updateData.error_code || null,
        created_at: timestamp,
      });
    }

    return jsonResponse({ success: true, processed: true }, 200);
  } catch (err: any) {
    return errorResponse(err);
  }
});
