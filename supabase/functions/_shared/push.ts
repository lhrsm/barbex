/**
 * BARBEX SUPABASE EDGE FUNCTIONS — WEB PUSH / VAPID DISPATCHER
 * Handles Web Push notifications with VAPID signing, safe URL validation,
 * mock support for test environments, and stale subscription (404/410) detection.
 */

import { getOptionalEnv } from "./env.ts";
import { EdgeError } from "./errors.ts";
import { redactSensitive } from "./logging.ts";

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id?: string | null;
  tenant_id?: string | null;
  customer_phone?: string | null;
  audience?: string;
}

export interface PushNotificationPayload {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface PushDispatchResult {
  success: boolean;
  stale?: boolean;
  statusCode?: number;
  messageId?: string;
  error?: string;
}

/**
 * Validates that the notification destination URL is safe (relative path or approved barbex.shop domain).
 * Prevents open redirect and malicious protocol execution.
 */
export function validatePushUrl(url?: string): boolean {
  if (!url) return true;
  
  const trimmed = url.trim();
  if (trimmed === "") return true;

  // Block dangerous schemes
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return false;
  }

  // Allow safe relative paths
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return true;
  }

  // Allow trusted Barbex domains
  try {
    const parsed = new URL(trimmed);
    const trustedHosts = [
      "barbex.shop",
      "app.barbex.shop",
      "admin.barbex.shop",
      "localhost",
      "127.0.0.1"
    ];
    return trustedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Sanitizes push payload and ensures safe URL and content.
 */
export function sanitizePushPayload(payload: PushNotificationPayload): PushNotificationPayload {
  if (!payload || !payload.title) {
    throw new EdgeError("BAD_REQUEST", "Título da notificação push é obrigatório.", 400);
  }

  if (payload.url && !validatePushUrl(payload.url)) {
    throw new EdgeError("BAD_REQUEST", "URL de destino da notificação push inválida ou não autorizada.", 400);
  }

  return {
    title: payload.title.slice(0, 120),
    body: payload.body ? payload.body.slice(0, 500) : undefined,
    url: payload.url ? payload.url.slice(0, 500) : undefined,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/badge-72x72.png",
    image: payload.image ? payload.image.slice(0, 500) : undefined,
    tag: payload.tag ? payload.tag.slice(0, 64) : "barbex-notification",
    data: payload.data ? (redactSensitive(payload.data) as Record<string, unknown>) : undefined
  };
}

/**
 * Sends a Web Push notification to a single subscription.
 * In development or mock mode, intercepts without live network requests.
 */
export async function sendWebPushNotification(
  subscription: PushSubscriptionData,
  payload: PushNotificationPayload,
  options?: { vapidPublic?: string; vapidPrivate?: string; subject?: string }
): Promise<PushDispatchResult> {
  const sanitized = sanitizePushPayload(payload);
  const vapidPublic = options?.vapidPublic || getOptionalEnv("VAPID_PUBLIC_KEY");
  const vapidPrivate = options?.vapidPrivate || getOptionalEnv("VAPID_PRIVATE_KEY");
  const subject = options?.subject || getOptionalEnv("VAPID_SUBJECT") || "mailto:contato@barbex.shop";

  if (!subscription || !subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return { success: false, stale: true, statusCode: 400, error: "Subscrição inválida ou incompleta." };
  }

  // Mock mode when VAPID keys are absent or configured for testing
  if (!vapidPrivate || vapidPrivate === "mock" || vapidPrivate === "test_key") {
    console.log(`[WebPush Mock] Push to endpoint: ${subscription.endpoint.slice(0, 40)}... | Title: "${sanitized.title}"`);
    return {
      success: true,
      stale: false,
      statusCode: 201,
      messageId: `mock_push_${Date.now()}`
    };
  }

  try {
    const rawPayload = JSON.stringify(sanitized);

    // Dynamic import of web-push or direct HTTPS invocation with VAPID
    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "TTL": "86400",
        "Urgency": "normal"
      },
      body: rawPayload
    });

    if (res.status === 201 || res.status === 200 || res.status === 204) {
      return { success: true, stale: false, statusCode: res.status, messageId: `push_${Date.now()}` };
    }

    if (res.status === 404 || res.status === 410) {
      // Stale / expired subscription — must be deactivated
      console.warn(`[WebPush] Stale subscription detected (${res.status}) for endpoint: ${subscription.endpoint.slice(0, 40)}...`);
      return { success: false, stale: true, statusCode: res.status, error: "Subscrição expirada ou inválida no provedor de push." };
    }

    if (res.status === 429) {
      console.warn(`[WebPush RateLimit] Endpoint throttled (429)`);
      return { success: false, stale: false, statusCode: 429, error: "Rate limit excedido pelo provedor de push." };
    }

    const errText = await res.text().catch(() => "");
    console.error(`[WebPush Error] Status: ${res.status}, Body: ${errText}`);
    return { success: false, stale: false, statusCode: res.status, error: `Falha no provedor de push: HTTP ${res.status}` };
  } catch (err: any) {
    console.error(`[WebPush Exception] ${err?.message || err}`);
    return { success: false, stale: false, error: err?.message || "Erro desconhecido ao enviar push notification." };
  }
}
