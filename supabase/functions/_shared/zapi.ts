// ==============================================================================
// BARBEX — SHARED Z-API CLIENT & UTILITIES
// ==============================================================================
// Deno-compatible Z-API integration client for WhatsApp messaging and webhooks.
// Multi-tenant safe, zero secret leaks, PII masked, robust error handling.
// ==============================================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

export interface WhatsAppInstance {
  id: string;
  tenant_id: string;
  barber_id?: string | null;
  instance_id: string;
  token?: string | null;
  client_token?: string | null;
  token_secret_id?: string | null;
  client_token_secret_id?: string | null;
  token_configured?: boolean | null;
  client_token_configured?: boolean | null;
  server_url?: string | null;
  provider: string;
  connected?: boolean | null;
  status?: string | null;
  phone?: string | null;
  webhook_token?: string | null;
  webhook_received_url?: string | null;
  webhook_received_configured_at?: string | null;
  webhook_received_last_response?: unknown;
  created_at?: string;
  updated_at?: string;
}

export interface ZApiButton {
  id: string;
  label: string;
}

export interface ZApiSendOptions {
  buttons?: ZApiButton[];
  imageUrl?: string;
  caption?: string;
}

export interface ZApiSendResult {
  success: boolean;
  messageId?: string | null;
  status: number;
  error?: string | null;
  raw?: unknown;
}

/**
 * Masks a secret token for safe logging/display.
 */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return "---";
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "********";
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
}

/**
 * Masks a phone number for safe logging (e.g. +55 (11) *****-**99).
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "---";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  const last4 = digits.slice(-4);
  const first2 = digits.slice(0, 2);
  return `+${first2} (**) *****-${last4}`;
}

/**
 * Normalizes phone number to Brazilian standard for Z-API (55 + DDD + 8/9 digits).
 */
export function normalizePhoneForZApi(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) {
    return "55" + digits;
  }
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  return digits;
}

export interface WhatsAppCredentials {
  id: string;
  tenant_id: string;
  instance_id: string;
  server_url?: string | null;
  token: string;
  client_token?: string | null;
  phone?: string | null;
  status?: string | null;
  connected?: boolean | null;
  webhook_received_url?: string | null;
  webhook_token?: string | null;
}

/**
 * Constant-time string comparison to prevent timing attacks on tokens.
 */
export function constantTimeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

/**
 * Retrieves decrypted WhatsApp credentials for a given tenant inside trusted server execution.
 * Fails closed if tenant, integration, or credentials are missing.
 */
export async function getTenantWhatsAppCredentials(
  supabase: SupabaseClient,
  tenantId: string
): Promise<WhatsAppCredentials | null> {
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
    return null;
  }

  // 1. Try secure RPC backed by Supabase Vault
  try {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc("get_whatsapp_credentials", {
      p_tenant_id: tenantId,
    });
    if (!rpcErr && rpcRows && rpcRows.length > 0) {
      const row = rpcRows[0];
      if (row.token && row.instance_id) {
        return {
          id: row.id,
          tenant_id: row.tenant_id,
          instance_id: row.instance_id,
          server_url: row.server_url || "https://api.z-api.io",
          phone: row.phone,
          status: row.status,
          connected: row.connected,
          token: row.token,
          client_token: row.client_token,
          webhook_received_url: row.webhook_received_url,
          webhook_token: row.webhook_token,
        };
      }
    }
  } catch {
    // Fall back to table check
  }

  // 2. Direct table lookup (supporting Vault references and backward compatibility)
  const { data: inst, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !inst) {
    return null;
  }

  let token = (inst as any).token || "";
  let clientToken = (inst as any).client_token || null;

  // Resolve Vault secrets if IDs are stored
  if (!token && (inst as any).token_secret_id) {
    try {
      const { data: sec } = await supabase
        .schema("vault")
        .from("decrypted_secrets")
        .select("decrypted_secret")
        .eq("id", (inst as any).token_secret_id)
        .maybeSingle();
      if (sec?.decrypted_secret) {
        token = sec.decrypted_secret;
      }
    } catch {
      // Vault schema query not permitted or failed
    }
  }

  if (!clientToken && (inst as any).client_token_secret_id) {
    try {
      const { data: sec } = await supabase
        .schema("vault")
        .from("decrypted_secrets")
        .select("decrypted_secret")
        .eq("id", (inst as any).client_token_secret_id)
        .maybeSingle();
      if (sec?.decrypted_secret) {
        clientToken = sec.decrypted_secret;
      }
    } catch {
      // Non-blocking
    }
  }

  // Fail closed if instance or token is absent
  if (!token || !inst.instance_id) {
    return null;
  }

  return {
    id: inst.id,
    tenant_id: inst.tenant_id,
    instance_id: inst.instance_id,
    server_url: inst.server_url || "https://api.z-api.io",
    token,
    client_token: clientToken,
    phone: inst.phone,
    status: inst.status,
    connected: inst.connected,
    webhook_received_url: inst.webhook_received_url,
    webhook_token: inst.webhook_token,
  };
}

/**
 * Retrieves WhatsApp credentials by Z-API instance ID.
 */
export async function getWhatsAppCredentialsByInstanceId(
  supabase: SupabaseClient,
  instanceId: string
): Promise<WhatsAppCredentials | null> {
  const { data: inst, error } = await supabase
    .from("whatsapp_instances")
    .select("tenant_id")
    .eq("instance_id", instanceId)
    .maybeSingle();

  if (error || !inst?.tenant_id) {
    return null;
  }

  return getTenantWhatsAppCredentials(supabase, inst.tenant_id);
}

/**
 * Retrieves the WhatsApp instance for a given tenant (metadata only, no raw token required).
 */
export async function getTenantWhatsAppInstance(
  supabase: SupabaseClient,
  tenantId: string
): Promise<WhatsAppInstance | null> {
  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data as WhatsAppInstance;
}

/**
 * Retrieves a WhatsApp instance by its DB primary key ID.
 */
export async function getWhatsAppInstanceById(
  supabase: SupabaseClient,
  id: string
): Promise<WhatsAppInstance | null> {
  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data as WhatsAppInstance;
}

/**
 * Retrieves a WhatsApp instance by its Z-API instance ID.
 */
export async function getWhatsAppInstanceByInstanceId(
  supabase: SupabaseClient,
  instanceId: string
): Promise<WhatsAppInstance | null> {
  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("instance_id", instanceId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data as WhatsAppInstance;
}

/**
 * Builds base headers for Z-API requests.
 */
function buildZApiHeaders(instance: WhatsAppInstance): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (instance.client_token) {
    headers["Client-Token"] = instance.client_token.trim();
  }
  return headers;
}

/**
 * Resolves base URL for Z-API instance.
 */
function getZApiBaseUrl(instance: WhatsAppInstance): string {
  return (instance.server_url && instance.server_url.trim()) || "https://api.z-api.io";
}

/**
 * Logs an integration call to the `zapi_integration_logs` table.
 */
export async function logZApiIntegration(
  supabase: SupabaseClient,
  params: {
    tenant_id: string;
    instance_id: string;
    action: string;
    method?: string;
    endpoint?: string;
    request_payload?: unknown;
    response_payload?: unknown;
    status_code?: number;
    phone?: string;
    error_message?: string;
    token?: string;
    client_token?: string;
  }
): Promise<void> {
  try {
    await supabase.from("zapi_integration_logs").insert([
      {
        tenant_id: params.tenant_id,
        instance_id: params.instance_id,
        action: params.action,
        method: params.method || "POST",
        endpoint: params.endpoint || null,
        request_payload: params.request_payload || null,
        request_body: params.request_payload || null,
        response_payload: params.response_payload || null,
        response_body: params.response_payload || null,
        status_code: params.status_code || null,
        response_status: params.status_code || null,
        phone_number: params.phone ? maskPhone(params.phone) : null,
        error_message: params.error_message || null,
        token_masked: maskSecret(params.token),
        client_token_masked: maskSecret(params.client_token),
      },
    ]);
  } catch (err: any) {
    // Non-blocking log failure
    console.error("[Z-API Log] Failed to record integration log:", err?.message);
  }
}

/**
 * Sends a text message via Z-API.
 */
export async function sendZApiText(
  instance: WhatsAppInstance,
  phone: string,
  message: string
): Promise<ZApiSendResult> {
  const targetPhone = normalizePhoneForZApi(phone);
  if (!targetPhone || targetPhone.length < 10) {
    return { success: false, status: 400, error: "INVALID_PHONE_NUMBER" };
  }

  // Prevent sending raw JSON in message body
  const jsonPattern = /\[\s*\{\s*".*?"\s*:\s*".*?"/g;
  if (jsonPattern.test(message) && message.includes("{") && message.includes("}")) {
    return { success: false, status: 400, error: "INVALID_MESSAGE_CONTENT_JSON_DETECTED" };
  }

  const baseUrl = getZApiBaseUrl(instance);
  const url = `${baseUrl}/instances/${instance.instance_id}/token/${instance.token}/send-text`;
  const headers = buildZApiHeaders(instance);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: targetPhone, message }),
    });

    const data = await res.json().catch(() => ({}));
    const messageId = data?.messageId || data?.id || (data?.messages && data.messages[0]?.id) || null;

    return {
      success: res.ok,
      messageId,
      status: res.status,
      error: res.ok ? null : data?.message || data?.error || `HTTP ${res.status}`,
      raw: data,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 500,
      error: err?.message || "NETWORK_ERROR",
    };
  }
}

/**
 * Sends a button message via Z-API.
 */
export async function sendZApiButton(
  instance: WhatsAppInstance,
  phone: string,
  message: string,
  buttons: ZApiButton[]
): Promise<ZApiSendResult> {
  const targetPhone = normalizePhoneForZApi(phone);
  if (!targetPhone || targetPhone.length < 10) {
    return { success: false, status: 400, error: "INVALID_PHONE_NUMBER" };
  }

  const baseUrl = getZApiBaseUrl(instance);
  const url = `${baseUrl}/instances/${instance.instance_id}/token/${instance.token}/send-button-list`;
  const headers = buildZApiHeaders(instance);

  const payload = {
    phone: targetPhone,
    message,
    buttonList: {
      buttons: buttons.map((b) => ({
        id: b.id,
        label: b.label,
      })),
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    // If button send succeeded
    if (res.ok) {
      const messageId = data?.messageId || data?.id || (data?.messages && data.messages[0]?.id) || null;
      return {
        success: true,
        messageId,
        status: res.status,
        raw: data,
      };
    }

    // Fallback: send text with options appended
    let fallbackText = message + "\n\n*Escolha uma opção:*\n";
    buttons.forEach((b, i) => {
      fallbackText += `${i + 1}️⃣ ${b.label}\n`;
    });

    return await sendZApiText(instance, targetPhone, fallbackText);
  } catch (err: any) {
    // Fallback to text on fetch error
    let fallbackText = message + "\n\n*Escolha uma opção:*\n";
    buttons.forEach((b, i) => {
      fallbackText += `${i + 1}️⃣ ${b.label}\n`;
    });
    return await sendZApiText(instance, targetPhone, fallbackText);
  }
}

/**
 * Sends an image message via Z-API.
 */
export async function sendZApiImage(
  instance: WhatsAppInstance,
  phone: string,
  imageUrl: string,
  caption?: string
): Promise<ZApiSendResult> {
  const targetPhone = normalizePhoneForZApi(phone);
  if (!targetPhone || targetPhone.length < 10) {
    return { success: false, status: 400, error: "INVALID_PHONE_NUMBER" };
  }

  const baseUrl = getZApiBaseUrl(instance);
  const url = `${baseUrl}/instances/${instance.instance_id}/token/${instance.token}/send-image`;
  const headers = buildZApiHeaders(instance);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: targetPhone,
        image: imageUrl,
        caption: caption || "",
      }),
    });

    const data = await res.json().catch(() => ({}));
    const messageId = data?.messageId || data?.id || null;

    return {
      success: res.ok,
      messageId,
      status: res.status,
      error: res.ok ? null : data?.message || data?.error || `HTTP ${res.status}`,
      raw: data,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 500,
      error: err?.message || "NETWORK_ERROR",
    };
  }
}

/**
 * Checks connection status of a Z-API instance.
 */
export async function checkZApiStatus(
  instance: WhatsAppInstance
): Promise<{ connected: boolean; status: string; raw: unknown }> {
  const baseUrl = getZApiBaseUrl(instance);
  const url = `${baseUrl}/instances/${instance.instance_id}/token/${instance.token}/status`;
  const headers = buildZApiHeaders(instance);

  const res = await fetch(url, { method: "GET", headers });
  const data = await res.json().catch(() => ({}));

  const isConnected = data?.connected === true;
  const status = isConnected ? "connected" : "disconnected";

  return {
    connected: isConnected,
    status,
    raw: data,
  };
}

/**
 * Sets up webhook URLs on Z-API provider for an instance.
 */
export async function setZApiWebhook(
  instance: WhatsAppInstance,
  webhookUrl: string
): Promise<{ success: boolean; results: unknown[] }> {
  const baseUrl = getZApiBaseUrl(instance);
  const headers = buildZApiHeaders(instance);

  const types = [
    { id: "update-webhook-received", required: true },
    { id: "update-webhook-disconnected", required: true },
    { id: "update-webhook-connected", required: true },
    { id: "update-webhook-message-status", required: true },
  ];

  const results = await Promise.all(
    types.map(async (t) => {
      const url = `${baseUrl}/instances/${instance.instance_id}/token/${instance.token}/${t.id}`;
      try {
        const res = await fetch(url, {
          method: "PUT",
          headers,
          body: JSON.stringify({ value: webhookUrl }),
        });
        const data = await res.json().catch(() => ({}));
        const isSuccess =
          res.status === 200 ||
          res.status === 201 ||
          data?.value === true ||
          data?.success === true;
        return { type: t.id, success: isSuccess, status: res.status, raw: data };
      } catch (err: any) {
        return { type: t.id, success: false, error: err?.message };
      }
    })
  );

  const allRequiredSuccess = results.filter((_, i) => types[i].required).every((r) => r.success);

  return {
    success: allRequiredSuccess,
    results,
  };
}

/**
 * Disconnects an instance on Z-API provider.
 */
export async function disconnectZApi(
  instance: WhatsAppInstance
): Promise<{ success: boolean; raw: unknown }> {
  const baseUrl = getZApiBaseUrl(instance);
  const url = `${baseUrl}/instances/${instance.instance_id}/token/${instance.token}/disconnect`;
  const headers = buildZApiHeaders(instance);

  const res = await fetch(url, { method: "GET", headers });
  const data = await res.json().catch(() => ({}));

  return {
    success: res.ok,
    raw: data,
  };
}

/**
 * Retrieves QR code for scanning.
 */
export async function getZApiQRCode(
  instance: WhatsAppInstance
): Promise<{ success: boolean; qrCode?: string; raw?: unknown }> {
  const baseUrl = getZApiBaseUrl(instance);
  const url = `${baseUrl}/instances/${instance.instance_id}/token/${instance.token}/qr-code/image`;
  const headers = buildZApiHeaders(instance);

  const res = await fetch(url, { method: "GET", headers });
  const data = await res.json().catch(() => ({}));

  return {
    success: res.ok,
    qrCode: data?.value || data?.qrcode || null,
    raw: data,
  };
}
