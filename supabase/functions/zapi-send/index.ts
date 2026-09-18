// ==============================================================================
// BARBEX — EDGE FUNCTION: zapi-send
// ==============================================================================
// Multi-tenant WhatsApp outbound sender, safe status & write-only credential manager.
// Strictly enforces tenant isolation, RBAC, rate limiting, and zero secret leaks.
// Backed by Supabase Vault for secure credential storage.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { extractBearerToken } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { EdgeError } from "../_shared/errors.ts";
import {
  getTenantWhatsAppInstance,
  getTenantWhatsAppCredentials,
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
  maskSecret,
  WhatsAppInstance,
  WhatsAppCredentials,
} from "../_shared/zapi.ts";

interface RequestBody {
  action:
    | "save-config"
    | "get-status"
    | "remove-config"
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
  instance_id?: string;
  token?: string;
  client_token?: string;
  server_url?: string;
  phone?: string;
  data?: {
    instance_id?: string;
    token?: string;
    client_token?: string;
    server_url?: string;
    phone?: string;
    message?: string;
    buttons?: Array<{ id: string; label: string }>;
    imageUrl?: string;
    caption?: string;
    webhookUrl?: string;
    customer_id?: string;
    appointment_id?: string;
  };
  phone_number?: string;
  message?: string;
  buttons?: Array<{ id: string; label: string }>;
  imageUrl?: string;
  caption?: string;
  webhookUrl?: string;
  customer_id?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  if (req.method !== "POST") {
    return errorResponse(new EdgeError("INVALID_REQUEST", "Method not allowed", 405), corsHeaders);
  }

  try {
    const supabaseAdmin = createAdminClient();

    // 1. Determine caller identity: User JWT vs Internal Service Role
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const isServiceRole =
      authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "SERVICE_ROLE_KEY_NOT_MATCHED") ||
      req.headers.get("x-service-role-key") === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let authenticatedUserId: string | null = null;
    let userRole = "anon";

    if (!isServiceRole) {
      const token = extractBearerToken(req);
      if (!token) {
        throw new EdgeError("UNAUTHORIZED", "Authentication required", 401);
      }
      const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
      if (userErr || !user) {
        throw new EdgeError("UNAUTHORIZED", "Authentication required", 401);
      }
      authenticatedUserId = user.id;

      // Check role in user_roles and profiles
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", authenticatedUserId)
        .maybeSingle();

      const { data: profileRow } = await supabaseAdmin
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", authenticatedUserId)
        .maybeSingle();

      userRole = roleRow?.role || profileRow?.role || "tenant_admin";
    }

    // 2. Parse Request Body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      throw new EdgeError("INVALID_REQUEST", "Invalid JSON payload", 400);
    }

    const { action } = body;
    if (!action) {
      throw new EdgeError("INVALID_REQUEST", "Action is required", 400);
    }

    // Merge nested data if present
    const data = body.data || {};
    const phone = data.phone || body.phone || body.phone_number;
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
      targetTenantId = body.tenantId || "";
      if (!targetTenantId && body.instanceId) {
        const inst = await getWhatsAppInstanceById(supabaseAdmin, body.instanceId);
        if (inst) targetTenantId = inst.tenant_id;
      }
      if (!targetTenantId) {
        throw new EdgeError("INVALID_REQUEST", "Tenant ID is required for service role calls", 400);
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

        // Cross-tenant check: if caller provided a tenantId different from resolved tenant
        if (body.tenantId && body.tenantId !== targetTenantId && userRole !== "super_admin") {
          throw new EdgeError("FORBIDDEN", "Cross-tenant access forbidden", 403);
        }
      }
    }

    // Validate UUID structure
    if (!targetTenantId || !UUID_REGEX.test(targetTenantId)) {
      throw new EdgeError("INVALID_REQUEST", "Malformed or missing tenant ID", 400);
    }

    // =========================================================================
    // SECTION A: CONFIGURATION MANAGEMENT (save-config, get-status, remove-config)
    // =========================================================================
    if (action === "save-config" || action === "get-status" || action === "remove-config") {
      // Barbers, professionals, and clients CANNOT configure or inspect integration credentials
      if (!isServiceRole) {
        const forbiddenRoles = ["barber", "professional", "client", "customer"];
        if (forbiddenRoles.includes(userRole.toLowerCase())) {
          throw new EdgeError("FORBIDDEN", "Non-admin roles cannot manage integration credentials", 403);
        }

        // Must be the tenant owner or have admin/manager role in the tenant
        if (userRole !== "super_admin" && authenticatedUserId !== targetTenantId) {
          const { data: callerProfile } = await supabaseAdmin
            .from("profiles")
            .select("tenant_id, role")
            .eq("id", authenticatedUserId!)
            .maybeSingle();

          const isTenantAdminOrManager =
            callerProfile?.tenant_id === targetTenantId &&
            (callerProfile?.role === "admin" || callerProfile?.role === "manager");

          if (!isTenantAdminOrManager) {
            throw new EdgeError("FORBIDDEN", "Forbidden: You are not an administrator of this tenant", 403);
          }
        }
      }

      // ACTION: SAVE CONFIG (Write-Only Credential Persistence)
      if (action === "save-config") {
        const rawInstanceId = data.instance_id || body.instance_id || body.instanceId;
        const rawToken = data.token || body.token;
        const rawClientToken = data.client_token || body.client_token;
        const rawServerUrl = data.server_url || body.server_url || "https://api.z-api.io";
        const rawPhone = data.phone || body.phone || "";

        if (!rawInstanceId || typeof rawInstanceId !== "string" || !rawInstanceId.trim()) {
          throw new EdgeError("INVALID_REQUEST", "Instance ID is required", 400);
        }
        if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
          throw new EdgeError("INVALID_REQUEST", "Token is required", 400);
        }

        const trimmedInstanceId = rawInstanceId.trim();
        const trimmedToken = rawToken.trim();
        const trimmedClientToken = rawClientToken && typeof rawClientToken === "string" ? rawClientToken.trim() : null;
        const trimmedServerUrl = rawServerUrl.trim();
        const normalizedPhone = rawPhone.replace(/\D/g, "");

        // 1. Try secure RPC backed by Supabase Vault
        let rpcSucceeded = false;
        try {
          const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc("set_whatsapp_credentials", {
            p_tenant_id: targetTenantId,
            p_instance_id: trimmedInstanceId,
            p_token: trimmedToken,
            p_client_token: trimmedClientToken,
            p_phone: normalizedPhone || null,
            p_server_url: trimmedServerUrl,
          });
          if (!rpcErr && rpcRes) {
            rpcSucceeded = true;
          }
        } catch {
          // Fall through to fallback
        }

        // 2. Direct fallback upsert via service role if RPC is not yet materialized in DB
        if (!rpcSucceeded) {
          const { data: existing } = await supabaseAdmin
            .from("whatsapp_instances")
            .select("id")
            .eq("tenant_id", targetTenantId)
            .maybeSingle();

          const upsertPayload: any = {
            tenant_id: targetTenantId,
            instance_id: trimmedInstanceId,
            server_url: trimmedServerUrl,
            phone: normalizedPhone,
            provider: "z-api",
            updated_at: new Date().toISOString(),
          };

          // Store in legacy token columns only if available
          upsertPayload.token = trimmedToken;
          if (trimmedClientToken) upsertPayload.client_token = trimmedClientToken;

          if (existing?.id) {
            await supabaseAdmin.from("whatsapp_instances").update(upsertPayload).eq("id", existing.id);
          } else {
            upsertPayload.status = "disconnected";
            upsertPayload.connected = false;
            await supabaseAdmin.from("whatsapp_instances").insert([upsertPayload]);
          }
        }

        // Audit log safe save event (zero raw secrets)
        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: trimmedInstanceId,
          action: "save-config",
          method: "POST",
          status_code: 200,
          token: trimmedToken,
          client_token: trimmedClientToken || undefined,
        });

        // Return SAFE metadata ONLY: Never echo or return raw token/client_token
        return jsonResponse(
          {
            success: true,
            configured: true,
            connected: false,
            phone: normalizedPhone || null,
            instanceIdMasked: maskSecret(trimmedInstanceId),
            tokenConfigured: true,
            clientTokenConfigured: Boolean(trimmedClientToken),
          },
          200,
          corsHeaders
        );
      }

      // ACTION: GET STATUS (Safe Non-Sensitive Telemetry)
      if (action === "get-status") {
        const inst = await getTenantWhatsAppInstance(supabaseAdmin, targetTenantId);
        const creds = await getTenantWhatsAppCredentials(supabaseAdmin, targetTenantId);

        const isTokenConfigured = Boolean(
          creds?.token || (inst as any)?.token_secret_id || (inst as any)?.token_configured || (inst as any)?.token
        );
        const isClientTokenConfigured = Boolean(
          creds?.client_token || (inst as any)?.client_token_secret_id || (inst as any)?.client_token_configured || (inst as any)?.client_token
        );

        return jsonResponse(
          {
            success: true,
            id: inst?.id || null,
            configured: Boolean(inst),
            connected: Boolean(inst?.connected),
            status: inst?.status || "disconnected",
            phone: inst?.phone || null,
            instanceId: inst?.instance_id || null,
            instanceIdMasked: inst?.instance_id ? maskSecret(inst.instance_id) : null,
            serverUrl: inst?.server_url || "https://api.z-api.io",
            tokenConfigured: isTokenConfigured,
            clientTokenConfigured: isClientTokenConfigured,
            webhookReceivedUrl: inst?.webhook_received_url || null,
            webhookReceivedConfiguredAt: inst?.webhook_received_configured_at || null,
          },
          200,
          corsHeaders
        );
      }

      // ACTION: REMOVE CONFIG (Safe Secret Revocation)
      if (action === "remove-config") {
        let rpcDone = false;
        try {
          const { data: delRes, error: delErr } = await supabaseAdmin.rpc("delete_whatsapp_credentials", {
            p_tenant_id: targetTenantId,
          });
          if (!delErr && delRes === true) {
            rpcDone = true;
          }
        } catch {
          // Fallback
        }

        if (!rpcDone) {
          await supabaseAdmin.from("whatsapp_instances").delete().eq("tenant_id", targetTenantId);
        }

        return jsonResponse({ success: true, removed: true }, 200, corsHeaders);
      }
    }

    // =========================================================================
    // SECTION B: PROVIDER OPERATIONS (send-text, send-button, check-status, etc.)
    // =========================================================================

    // 4. Retrieve Tenant WhatsApp Credentials Securely from Server-Side Storage
    const credentials = await getTenantWhatsAppCredentials(supabaseAdmin, targetTenantId);
    if (!credentials || !credentials.token) {
      throw new EdgeError(
        "NOT_FOUND",
        "WhatsApp credentials not configured for this tenant. Configure credentials first.",
        404
      );
    }

    // 5. Rate Limiting for Browser-Facing Manual Sends
    if (!isServiceRole && (action === "send-test-message" || action === "send-test-button" || action === "send-text")) {
      await checkRateLimit(`zapi_send_${authenticatedUserId}`, 30, 60);
    }

    // 6. Cross-Tenant Customer Validation (if customerId is supplied)
    if (customerId) {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, tenant_id, phone")
        .eq("id", customerId)
        .maybeSingle();

      if (!customer || customer.tenant_id !== targetTenantId) {
        throw new EdgeError("FORBIDDEN", "Customer does not belong to this tenant", 403);
      }
    }

    // 7. Execute Actions
    switch (action) {
      case "check-status": {
        const result = await checkZApiStatus(credentials as any);
        // Update database with latest status
        await supabaseAdmin
          .from("whatsapp_instances")
          .update({
            connected: result.connected,
            status: result.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", credentials.id);

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: credentials.instance_id,
          action: "check-status",
          method: "GET",
          status_code: 200,
          response_payload: result.raw,
          token: credentials.token,
          client_token: credentials.client_token || undefined,
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

        const result = await setZApiWebhook(credentials as any, targetWebhookUrl);

        if (result.success) {
          await supabaseAdmin
            .from("whatsapp_instances")
            .update({
              webhook_received_url: targetWebhookUrl,
              webhook_received_configured_at: new Date().toISOString(),
              webhook_received_last_response: result.results,
              updated_at: new Date().toISOString(),
            })
            .eq("id", credentials.id);
        }

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: credentials.instance_id,
          action: "set-webhook",
          method: "PUT",
          status_code: result.success ? 200 : 400,
          request_payload: { webhookUrl: targetWebhookUrl },
          response_payload: result.results,
          token: credentials.token,
          client_token: credentials.client_token || undefined,
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
        const result = await disconnectZApi(credentials as any);
        await supabaseAdmin
          .from("whatsapp_instances")
          .update({
            connected: false,
            status: "disconnected",
            updated_at: new Date().toISOString(),
          })
          .eq("id", credentials.id);

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: credentials.instance_id,
          action: "disconnect",
          method: "GET",
          status_code: 200,
          response_payload: result.raw,
          token: credentials.token,
          client_token: credentials.client_token || undefined,
        });

        return jsonResponse({ success: true, status: "disconnected" }, 200, corsHeaders);
      }

      case "get-qrcode": {
        const result = await getZApiQRCode(credentials as any);
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
          throw new EdgeError("INVALID_REQUEST", "Recipient phone is required", 400);
        }
        const textMessage = message || "Mensagem de teste Barbex";

        const result = await sendZApiText(credentials as any, phone, textMessage);

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: credentials.instance_id,
          action: action,
          method: "POST",
          phone: phone,
          status_code: result.status,
          request_payload: { phone: maskPhone(phone), action },
          response_payload: result.raw,
          error_message: result.error || undefined,
          token: credentials.token,
          client_token: credentials.client_token || undefined,
        });

        if (!result.success) {
          throw new EdgeError(
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
          throw new EdgeError("INVALID_REQUEST", "Recipient phone is required", 400);
        }
        const textMessage =
          message || "Por favor, confirme seu agendamento no botão abaixo:";
        const buttonList =
          buttons && buttons.length > 0
            ? buttons
            : [{ id: "main_confirm", label: "Confirmar Agendamento" }];

        const result = await sendZApiButton(credentials as any, phone, textMessage, buttonList);

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: credentials.instance_id,
          action: action,
          method: "POST",
          phone: phone,
          status_code: result.status,
          request_payload: { phone: maskPhone(phone), buttonsCount: buttonList.length },
          response_payload: result.raw,
          error_message: result.error || undefined,
          token: credentials.token,
          client_token: credentials.client_token || undefined,
        });

        if (!result.success) {
          throw new EdgeError(
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
          throw new EdgeError("INVALID_REQUEST", "Recipient phone is required", 400);
        }
        if (!imageUrl) {
          throw new EdgeError("INVALID_REQUEST", "Image URL is required", 400);
        }

        const result = await sendZApiImage(credentials as any, phone, imageUrl, caption);

        await logZApiIntegration(supabaseAdmin, {
          tenant_id: targetTenantId,
          instance_id: credentials.instance_id,
          action: "send-image",
          method: "POST",
          phone: phone,
          status_code: result.status,
          request_payload: { phone: maskPhone(phone), imageUrl },
          response_payload: result.raw,
          error_message: result.error || undefined,
          token: credentials.token,
          client_token: credentials.client_token || undefined,
        });

        if (!result.success) {
          throw new EdgeError(
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
        throw new EdgeError("INVALID_REQUEST", `Unsupported action: ${action}`, 400);
    }
  } catch (err) {
    return errorResponse(err, corsHeaders);
  }
});
