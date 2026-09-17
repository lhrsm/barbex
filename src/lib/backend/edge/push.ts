/**
 * BARBEX — WEB PUSH ADAPTER
 * Connects frontend callers to:
 * 1. Direct Supabase Client + RLS/RPC for subscription registration/unregistration.
 * 2. `send-push` Supabase Edge Function for authorized push dispatching.
 * ZERO VAPID private keys or server secrets allowed here.
 */

import { supabase as defaultSupabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEdgeFunction, type EdgeInvokeOptions, type EdgeResult } from "@/lib/backend/edge-client";

export type PushAudience = "customer" | "staff" | "owner";

export interface RegisterPushParams {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  customerPhone?: string | null;
  tenantId?: string | null;
  audience?: PushAudience;
}

export interface SendPushPayload {
  target?: {
    user_id?: string;
    customer_phone?: string;
    tenant_id?: string;
    audience?: PushAudience;
    endpoint?: string;
  };
  payload: {
    title: string;
    body?: string;
    url?: string;
    icon?: string;
    image?: string;
    tag?: string;
  };
}

export interface SendPushResultData {
  sent: number;
  failed: number;
  cleaned: number;
  durationMs?: number;
  results?: Array<{ endpoint: string; success: boolean; error?: string }>;
  message?: string;
}

/**
 * Registers a push subscription directly via Supabase Client + RPC.
 */
export async function registerPushSubscription(
  params: RegisterPushParams,
  client?: SupabaseClient
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = client || defaultSupabase;

  const { data, error } = await sb.rpc("register_push_subscription", {
    _endpoint: params.endpoint,
    _p256dh: params.p256dh,
    _auth: params.auth,
    _user_agent: params.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : undefined),
    _customer_phone: params.customerPhone ?? undefined,
    _tenant_id: params.tenantId ?? undefined,
    _audience: params.audience || "customer",
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const res = data as any;
  if (res && res.success === false) {
    return { ok: false, error: res.error || "Falha ao registrar subscrição." };
  }

  return { ok: true, id: res?.id };
}

/**
 * Unregisters / deactivates a push subscription directly via Supabase Client + RPC.
 */
export async function unregisterPushSubscription(
  endpoint: string,
  client?: SupabaseClient
): Promise<{ ok: boolean; error?: string }> {
  const sb = client || defaultSupabase;

  const { data, error } = await sb.rpc("unregister_push_subscription", {
    _endpoint: endpoint,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Dispatches a Web Push notification through the Supabase `send-push` Edge Function.
 */
export async function sendWebPush(
  payload: SendPushPayload,
  options?: EdgeInvokeOptions
): Promise<EdgeResult<SendPushResultData>> {
  return await invokeEdgeFunction<SendPushPayload, SendPushResultData>(
    "send-push",
    payload,
    options
  );
}
