/**
 * BARBEX SUPABASE EDGE FUNCTIONS — SEND EMAIL
 * Secure transactional email sender via Resend API with template allowlisting,
 * recipient validation, service/user authorization, and safe mock capabilities.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSuccessResponse, createErrorResponse } from "../_shared/response.ts";
import { createLogger } from "../_shared/logging.ts";
import { EdgeError } from "../_shared/errors.ts";
import { getOptionalEnv, getRequiredEnv } from "../_shared/env.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { extractBearerToken, verifyUserSession } from "../_shared/auth.ts";
import { sendEmail, EmailTemplateKey } from "../_shared/resend.ts";

const ALLOWED_TEMPLATES = new Set<EmailTemplateKey>([
  "internal_user_invitation",
  "email_verification_code",
  "admin_digest",
  "review_request",
  "subscription_reminder",
  "system_notification",
  "custom"
]);

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const logger = createLogger("send-email");
  const startTime = performance.now();

  try {
    if (req.method !== "POST") {
      throw new EdgeError("METHOD_NOT_ALLOWED", "Método HTTP não permitido.", 405);
    }

    // 1. Authentication & Authorization Check
    const bearerToken = extractBearerToken(req);
    const cronSecretHeader = req.headers.get("x-cron-secret") || req.headers.get("x-internal-secret");
    const configuredCronSecret = getOptionalEnv("CRON_WORKER_SECRET") || getOptionalEnv("CRON_SECRET");
    const serviceRoleKey = getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY");

    let isServiceRole = false;
    let authenticatedUserId: string | null = null;

    if (bearerToken && serviceRoleKey && bearerToken === serviceRoleKey) {
      isServiceRole = true;
    } else if (configuredCronSecret && cronSecretHeader === configuredCronSecret) {
      isServiceRole = true;
    } else if (bearerToken) {
      try {
        const session = await verifyUserSession(req);
        authenticatedUserId = session.userId;
      } catch {
        // Fallback or reject
        throw new EdgeError("UNAUTHORIZED", "Credenciais inválidas para envio de e-mail.", 401);
      }
    } else {
      throw new EdgeError("UNAUTHORIZED", "Acesso não autorizado ao serviço de e-mail.", 401);
    }

    // 2. Parse & Validate Payload
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new EdgeError("BAD_REQUEST", "JSON de requisição inválido.", 400);
    }

    const {
      recipient,
      templateKey,
      templateData = {},
      subject,
      tenantId,
      eventId
    } = body;

    if (!recipient || typeof recipient !== "string") {
      throw new EdgeError("BAD_REQUEST", "Destinatário de e-mail (recipient) é obrigatório.", 400);
    }

    // Strict email format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(recipient.trim())) {
      throw new EdgeError("BAD_REQUEST", "Endereço de e-mail inválido.", 400);
    }

    if (!templateKey || !ALLOWED_TEMPLATES.has(templateKey)) {
      throw new EdgeError(
        "BAD_REQUEST",
        `Template de e-mail '${templateKey}' não é permitido. Templates válidos: ${Array.from(ALLOWED_TEMPLATES).join(", ")}`,
        400
      );
    }

    // 3. Recipient Authority Check for User-invoked calls
    if (!isServiceRole && authenticatedUserId) {
      const adminClient = createAdminClient();
      const { data: profile } = await adminClient
        .from("profiles")
        .select("id, email, role, tenant_id")
        .eq("id", authenticatedUserId)
        .maybeSingle();

      const userEmail = profile?.email?.toLowerCase();
      const targetEmail = recipient.trim().toLowerCase();

      // Non-admin users can only send emails to their own registered email
      if (profile?.role !== "super_admin" && profile?.role !== "tenant_admin") {
        if (userEmail !== targetEmail) {
          throw new EdgeError("FORBIDDEN", "Usuários regulares só podem enviar e-mails para si mesmos.", 403);
        }
      }
    }

    // 4. Send Email via Shared Resend Engine
    logger.info("email_dispatch_start", {
      recipient,
      templateKey,
      tenantId,
      isServiceRole
    });

    const sendResult = await sendEmail({
      recipient: recipient.trim(),
      templateKey,
      templateData,
      subject,
      tenantId,
      userId: authenticatedUserId || undefined
    });

    const durationMs = Math.round(performance.now() - startTime);
    logger.info("email_dispatch_success", {
      messageId: sendResult.id,
      durationMs
    });

    return createSuccessResponse(
      {
        messageId: sendResult.id,
        recipient: recipient.trim(),
        templateKey,
        delivered: true,
        durationMs
      },
      corsHeaders
    );

  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    logger.error("email_dispatch_error", {
      error: error instanceof Error ? error.message : String(error),
      durationMs
    });

    return createErrorResponse(error, corsHeaders);
  }
});
