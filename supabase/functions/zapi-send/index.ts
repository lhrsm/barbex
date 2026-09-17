// ==============================================================================
// BARBEX — EDGE FUNCTION: zapi-send
// ==============================================================================
// Multi-tenant WhatsApp outbound sender & instance management via Z-API.
// Strictly enforces tenant isolation, RBAC, rate limiting, and zero secret leaks.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-admin.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { AppError } from "../_shared/errors.ts";
import {
  getTenantWhatsAppInstance,
  getWhatsAppInstanceById,
  sendZApiText,
  sendZApiButton,
  sendZApiImage,
  checkZApiStatus,
  setZApiWebhook,
  disconnectZApi,
  getZApiQRCode,
  logZApiIntegration,
  maskPhone,
  WhatsAppInstance,
} from "../_shared/zapi.ts";
import { normalizePhoneBR } from "../_shared/phone.ts";

interface RequestBody {
  action:
    | "send-text"
    | "send-button"
    | "send-image"
    | "send-test-message"
    | "send-test-button"
    | "check-status"
    | "set-webhook"
    | "disconnect"
    | "get-qrcode";
  tenantId?: string;
  instanceId?: string;
  data?: {
    phone?: string;
    message?: string;
    buttons?: Array<{ id: string; label: string }>;
    imageUrl?: string;
    caption?: string;
    webhookUrl?: string;
    customer_id?: string;
    appointment_id?: string;
  };
  phone?: string;
  message?: string;
  buttons?: Array<{ id: string; label: string }>;
  imageUrl?: string;
  caption?: string;
  webhookUrl?: string;
  customer_id?: string;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(new AppError("METHOD_NOT_ALLOWED", "Method not allowed", 405), corsHeaders);
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();

    // 1. Determine caller identity: User JWT vs Internal Service Role
    const authHeader = req.headers.get("authorization") || "";
    const isServiceRole =
      authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "SERVICE_ROLE_KEY_NOT_MATCHED") ||
      req.headers.get("x-service-role-key") === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let authenticatedUserId: string | null = null;
    let userRole: string = "anon";

    if (!isServiceRole) {
      const user = await getAuthenticatedUser(req, supabaseAdmin);
      if (!user) {
        throw new AppError("UNAUTHORIZED", "Authentication required", 401);
      }
      authenticatedUserId = user.id;

      // Check role in user_roles
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", authenticatedUserId)
        .maybeSingle();

      userRole = roleRow?.role || "tenant_admin";
    }

    // 2. Parse Request Body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      throw new AppError("INVALID_REQUEST", "Invalid JSON payload", 400);
    }

    const { action } = body;
    if (!action) {
      throw new AppError("INVALID_REQUEST", "Action is required", 400);
    }

    // Merge nested data if present
    const data = body.data || {};
    const phone = data.phone || body.phone;
    const message = data.message || body.message;
    const buttons = data.buttons || body.buttons;
    const imageUrl = data.imageUrl || body.imageUrl;
    const caption = data.caption || body.caption;
    const webhookUrl = data.webhookUrl || body.webhookUrl;
    const customerId = data.customer_id || body.customer_id;

    // 3. Resolve Target Tenant
    let targetTenantId: string;
    if (isServiceRole) {
      // Internal service role / worker can explicitly specify target tenantId
      targetTenantId = body.tenantId || (body.instanceId ? "" : "");
      if (!targetTenantId && body.instanceId) {
        const inst = await getWhatsAppInstanceById(supabaseAdmin, body.instanceId);
        if (inst) targetTenantId = inst.tenant_id;
      }
      if (!targetTenantId) {
        throw new AppError("INVALID_REQUEST", "Tenant ID is required for service role calls", 400);
      }
    } else {
      // Authenticated user: tenant is derived from auth.uid() or verified if super_admin
      if (userRole === "super_admin" && body.tenantId) {
        targetTenantId = body.tenantId;
      } else {
        // Resolve tenant_id of the authenticated user
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, tenant_id")
          .eq("id", authenticatedUserId!)
          .maybeSingle();

        targetTenantId = profile?.tenant_id || authenticatedUserId!;
      }
    }

    // 4. Retrieve Tenant WhatsApp Instance
    let instance: WhatsAppInstance | null = null;
    if (body.instanceId) {
      instance = await getWhatsAppInstanceById(supabaseAdmin, body.instanceId);
      // Cross-tenant verification: Ensure instance belongs to targetTenantId
      if (instance && instance.tenant_id !== targetTenantId && userRole !== "super_admin") {
        throw new AppError("FORBIDDEN", "Instance does not belong to your tenant", 403);
      }
    } else {
      instance = await getTenantWhatsAppInstance(supabaseAdmin, targetTenantId);
    }

    if (!instance) {
      throw new AppError(
        "NOT_FOUND",
        "WhatsApp instance not found for this tenant",
        404
      );
    }

    // 5. Rate Limiting for Browser-Facing Manual Sends
    if (!isServiceRole && (action === "send-test-message" || action === "send-test-button" || action === "send-text")) {
      await checkRateLimit(supabaseAdmin, `zapi_send_${authenticatedUserId}`, 30, 60);
    }

    // 6. Cross-Tenant Customer Validation (if customerId is supplied)
    if (customerId) {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, tenant_id, phone")
        .eq("id", customerId)
        .maybeSingle();

      if (!customer || customer.tenant_id !== targetTenantId) {
        throw new AppError("FORBIDDEN", "Customer does not belong to this tenant", 403);
      }
    }

    // 7. Execute Actions
    switch (action) {
      case "check-status": {
        const result = await checkZApiStatus(instance);
        // Update database with latest status
        await supabaseAdmin
          .from("whatsapp_instances")
          .update({
            connected: result.connected,
            status: result.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", instance.id);

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: instance.instance_id,
          action: "check-status",
          method: "GET",
          status_code: 200,
          response_payload: result.raw,
          token: instance.token,
          client_token: instance.client_token || undefined,
        });

        return jsonResponse(
          {
            success: true,
            connected: result.connected,
            status: result.status,
          },
          200,
          corsHeaders
        );
      }

      case "set-webhook": {
        const targetWebhookUrl =
          webhookUrl ||
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/zapi-webhook`;

        const result = await setZApiWebhook(instance, targetWebhookUrl);

        if (result.success) {
          await supabaseAdmin
            .from("whatsapp_instances")
            .update({
              webhook_received_url: targetWebhookUrl,
              webhook_received_configured_at: new Date().toISOString(),
              webhook_received_last_response: result.results,
              updated_at: new Date().toISOString(),
            })
            .eq("id", instance.id);
        }

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: instance.instance_id,
          action: "set-webhook",
          method: "PUT",
          status_code: result.success ? 200 : 400,
          request_payload: { webhookUrl: targetWebhookUrl },
          response_payload: result.results,
          token: instance.token,
          client_token: instance.client_token || undefined,
        });

        return jsonResponse(
          {
            success: result.success,
            webhookUrl: targetWebhookUrl,
            results: result.results,
          },
          result.success ? 200 : 400,
          corsHeaders
        );
      }

      case "disconnect": {
        const result = await disconnectZApi(instance);
        await supabaseAdmin
          .from("whatsapp_instances")
          .update({
            connected: false,
            status: "disconnected",
            updated_at: new Date().toISOString(),
          })
          .eq("id", instance.id);

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: instance.instance_id,
          action: "disconnect",
          method: "GET",
          status_code: 200,
          response_payload: result.raw,
          token: instance.token,
          client_token: instance.client_token || undefined,
        });

        return jsonResponse({ success: true, status: "disconnected" }, 200, corsHeaders);
      }

      case "get-qrcode": {
        const result = await getZApiQRCode(instance);
        return jsonResponse(
          {
            success: result.success,
            qrCode: result.qrCode,
          },
          result.success ? 200 : 400,
          corsHeaders
        );
      }

      case "send-text":
      case "send-test-message": {
        if (!phone) {
          throw new AppError("INVALID_REQUEST", "Recipient phone is required", 400);
        }
        const textMessage = message || "Mensagem de teste BarberX";

        const result = await sendZApiText(instance, phone, textMessage);

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: instance.instance_id,
          action: action,
          method: "POST",
          phone: phone,
          status_code: result.status,
          request_payload: { phone: maskPhone(phone), action },
          response_payload: result.raw,
          error_message: result.error || undefined,
          token: instance.token,
          client_token: instance.client_token || undefined,
        });

        if (!result.success) {
          throw new AppError(
            "SERVICE_UNAVAILABLE",
            result.error || "Failed to send WhatsApp text message",
            result.status || 502
          );
        }

        return jsonResponse(
          {
            success: true,
            messageId: result.messageId,
            status: "sent",
          },
          200,
          corsHeaders
        );
      }

      case "send-button":
      case "send-test-button": {
        if (!phone) {
          throw new AppError("INVALID_REQUEST", "Recipient phone is required", 400);
        }
        const textMessage =
          message || "Por favor, confirme seu agendamento no botão abaixo:";
        const buttonList =
          buttons && buttons.length > 0
            ? buttons
            : [{ id: "main_confirm", label: "Confirmar Agendamento" }];

        const result = await sendZApiButton(instance, phone, textMessage, buttonList);

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: instance.instance_id,
          action: action,
          method: "POST",
          phone: phone,
          status_code: result.status,
          request_payload: { phone: maskPhone(phone), buttonsCount: buttonList.length },
          response_payload: result.raw,
          error_message: result.error || undefined,
          token: instance.token,
          client_token: instance.client_token || undefined,
        });

        if (!result.success) {
          throw new AppError(
            "SERVICE_UNAVAILABLE",
            result.error || "Failed to send WhatsApp button message",
            result.status || 502
          );
        }

        return jsonResponse(
          {
            success: true,
            messageId: result.messageId,
            status: "sent",
          },
          200,
          corsHeaders
        );
      }

      case "send-image": {
        if (!phone) {
          throw new AppError("INVALID_REQUEST", "Recipient phone is required", 400);
        }
        if (!imageUrl) {
          throw new AppError("INVALID_REQUEST", "Image URL is required", 400);
        }

        const result = await sendZApiImage(instance, phone, imageUrl, caption);

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: instance.instance_id,
          action: "send-image",
          method: "POST",
          phone: phone,
          status_code: result.status,
          request_payload: { phone: maskPhone(phone), imageUrl },
          response_payload: result.raw,
          error_message: result.error || undefined,
          token: instance.token,
          client_token: instance.client_token || undefined,
        });

        if (!result.success) {
          throw new AppError(
            "SERVICE_UNAVAILABLE",
            result.error || "Failed to send WhatsApp image message",
            result.status || 502
          );
        }

        return jsonResponse(
          {
            success: true,
            messageId: result.messageId,
            status: "sent",
          },
          200,
          corsHeaders
        );
      }

      default:
        throw new AppError("INVALID_REQUEST", `Unsupported action: ${action}`, 400);
    }
  } catch (err) {
    return errorResponse(err, corsHeaders);
  }
});
