/**
 * BARBEX SUPABASE EDGE FUNCTIONS — SEND PUSH
 * Secure Web Push notification dispatcher with VAPID authentication,
 * recipient authority, safe URL validation, and stale subscription cleanup.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSuccessResponse, createErrorResponse } from "../_shared/response.ts";
import { createLogger } from "../_shared/logging.ts";
import { EdgeError } from "../_shared/errors.ts";
import { getOptionalEnv } from "../_shared/env.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { extractBearerToken, verifyUserSession } from "../_shared/auth.ts";
import { sendWebPushNotification, sanitizePushPayload, PushSubscriptionData, PushNotificationPayload } from "../_shared/push.ts";

interface SendPushRequestBody {
  target?: {
    user_id?: string;
    customer_phone?: string;
    tenant_id?: string;
    audience?: "customer" | "staff" | "owner";
    endpoint?: string;
  };
  payload?: PushNotificationPayload;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const logger = createLogger("send-push");
  const startTime = performance.now();

  try {
    if (req.method !== "POST") {
      throw new EdgeError("METHOD_NOT_ALLOWED", "Método HTTP não permitido.", 405);
    }

    // 1. Authentication & Authorization Check
    const bearerToken = extractBearerToken(req);
    const internalSecretHeader = req.headers.get("x-internal-secret") || req.headers.get("x-cron-secret");
    const configuredInternalSecret = getOptionalEnv("PUSH_INTERNAL_SECRET") || getOptionalEnv("CRON_WORKER_SECRET");
    const serviceRoleKey = getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY");

    let isServiceRole = false;
    let authenticatedUserId: string | null = null;

    if (bearerToken && serviceRoleKey && bearerToken === serviceRoleKey) {
      isServiceRole = true;
    } else if (configuredInternalSecret && internalSecretHeader === configuredInternalSecret) {
      isServiceRole = true;
    } else if (bearerToken) {
      try {
        const session = await verifyUserSession(req);
        authenticatedUserId = session.userId;
      } catch {
        throw new EdgeError("UNAUTHORIZED", "Credenciais inválidas para envio de push.", 401);
      }
    } else {
      throw new EdgeError("UNAUTHORIZED", "Acesso não autorizado ao serviço de Web Push.", 401);
    }

    // 2. Parse & Validate Payload
    let body: SendPushRequestBody;
    try {
      body = await req.json();
    } catch {
      throw new EdgeError("BAD_REQUEST", "JSON de requisição inválido.", 400);
    }

    const { target = {}, payload } = body;

    if (!payload || !payload.title) {
      throw new EdgeError("BAD_REQUEST", "Payload de notificação com título (title) é obrigatório.", 400);
    }

    const sanitizedPayload = sanitizePushPayload(payload);

    // 3. Authorization & Tenant Boundary Validation for User-invoked calls
    const adminClient = createAdminClient();

    if (!isServiceRole && authenticatedUserId) {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("id, role, tenant_id")
        .eq("id", authenticatedUserId)
        .maybeSingle();

      const userRole = profile?.role;
      const userTenantId = profile?.tenant_id || profile?.id;

      if (userRole !== "super_admin" && userRole !== "tenant_admin") {
        // Regular user can only push to their own user_id
        if (target.user_id && target.user_id !== authenticatedUserId) {
          throw new EdgeError("FORBIDDEN", "Usuários não podem disparar push para outros usuários.", 403);
        }
        target.user_id = authenticatedUserId;
      } else if (userRole === "tenant_admin") {
        // Tenant admin can only push within their tenant
        if (target.tenant_id && target.tenant_id !== userTenantId) {
          throw new EdgeError("FORBIDDEN", "Acesso não autorizado a dados de outro tenant.", 403);
        }
        target.tenant_id = userTenantId;
      }
    }

    // 4. Query Push Subscriptions from Database
    let query = adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id, tenant_id, customer_phone, audience, active")
      .eq("active", true);

    if (target.endpoint) query = query.eq("endpoint", target.endpoint);
    if (target.user_id) query = query.eq("user_id", target.user_id);
    if (target.customer_phone) query = query.eq("customer_phone", target.customer_phone);
    if (target.tenant_id) query = query.eq("tenant_id", target.tenant_id);
    if (target.audience) query = query.eq("audience", target.audience);

    const { data: subs, error: queryError } = await query;

    if (queryError) {
      logger.error("push_subscription_query_error", { error: queryError.message });
      throw new EdgeError("INTERNAL_ERROR", "Falha ao consultar subscrições de push.", 500);
    }

    if (!subs || subs.length === 0) {
      logger.info("push_no_subscriptions_found", { target });
      return createSuccessResponse(
        {
          sent: 0,
          failed: 0,
          cleaned: 0,
          message: "Nenhuma subscrição ativa encontrada para o destinatário informado."
        },
        corsHeaders
      );
    }

    logger.info("push_dispatch_start", {
      subscriptionCount: subs.length,
      target
    });

    // 5. Send Notifications & Collect Stale Subscriptions
    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];
    const results: Array<{ endpoint: string; success: boolean; error?: string }> = [];

    await Promise.all(
      subs.map(async (sub) => {
        const subData: PushSubscriptionData = {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          user_id: sub.user_id,
          tenant_id: sub.tenant_id,
          customer_phone: sub.customer_phone,
          audience: sub.audience
        };

        const res = await sendWebPushNotification(subData, sanitizedPayload);

        if (res.success) {
          sent++;
          results.push({ endpoint: sub.endpoint.slice(0, 30) + "...", success: true });
        } else {
          failed++;
          results.push({ endpoint: sub.endpoint.slice(0, 30) + "...", success: false, error: res.error });
          if (res.stale) {
            staleEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    // 6. Deactivate Stale / 410 Subscriptions Atomic Clean-up
    if (staleEndpoints.length > 0) {
      await adminClient
        .from("push_subscriptions")
        .update({ active: false, updated_at: new Date().toISOString() })
        .in("endpoint", staleEndpoints);

      logger.info("push_stale_subscriptions_deactivated", {
        deactivatedCount: staleEndpoints.length
      });
    }

    const durationMs = Math.round(performance.now() - startTime);
    logger.info("push_dispatch_completed", {
      sent,
      failed,
      cleaned: staleEndpoints.length,
      durationMs
    });

    return createSuccessResponse(
      {
        sent,
        failed,
        cleaned: staleEndpoints.length,
        durationMs,
        results
      },
      corsHeaders
    );

  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    logger.error("push_dispatch_error", {
      error: error instanceof Error ? error.message : String(error),
      durationMs
    });

    return createErrorResponse(error, corsHeaders);
  }
});
