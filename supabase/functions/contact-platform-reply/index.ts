// ==============================================================================
// BARBEX — EDGE FUNCTION: contact-platform-reply
// ==============================================================================
// In-panel direct reply to platform institutional contact inquiries.
// Strictly restricted to authenticated Super Admin users.
// Dispatches transactional email via Resend to the message's original visitor,
// with reply_to set to contato@lmstartup.com.br and sender nao-responder@notify.barbex.shop.
// Durable audit trail persisted in public.platform_contact_replies.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { escapeHtml } from "../_shared/resend.ts";
import { getOptionalEnv } from "../_shared/env.ts";

interface ReplyRequestBody {
  messageId?: string;
  subject?: string;
  content?: string;
  clientRequestId?: string;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  // 1. CORS Preflight Handling
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  // 2. HTTP Method Enforcement
  if (req.method !== "POST") {
    return jsonError("METHOD_NOT_ALLOWED", "Método HTTP não permitido. Utilize POST.", 405, req);
  }

  const admin = createAdminClient();

  try {
    // 3. Authentication Check via Bearer Token
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonError("UNAUTHORIZED", "Sessão não autenticada. Token ausente.", 401, req);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const {
      data: { user },
      error: authErr,
    } = await admin.auth.getUser(token);

    if (authErr || !user) {
      return jsonError("UNAUTHORIZED", "Sessão expirada ou token inválido.", 401, req);
    }

    // 4. Strict Super Admin Authorization Verification
    // Check user_roles table for super_admin role
    const { data: roleData, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    let isSuperAdmin = !roleErr && roleData?.role === "super_admin";

    // Double check profiles table fallback
    if (!isSuperAdmin) {
      const { data: profileData } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profileData?.role === "super_admin") {
        isSuperAdmin = true;
      }
    }

    if (!isSuperAdmin) {
      return jsonError(
        "FORBIDDEN",
        "Acesso negado. Apenas o Super Admin da plataforma pode responder a mensagens institucionais.",
        403,
        req
      );
    }

    // 5. Parse & Validate Payload
    let body: ReplyRequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonError("BAD_REQUEST", "Corpo da requisição deve ser um JSON válido.", 400, req);
    }

    const { messageId, subject, content } = body;

    if (!messageId || typeof messageId !== "string" || !UUID_REGEX.test(messageId.trim())) {
      return jsonError("BAD_REQUEST", "Identificador da mensagem original (messageId) inválido.", 400, req);
    }

    if (!content || typeof content !== "string" || content.trim().length < 2) {
      return jsonError("BAD_REQUEST", "O conteúdo da resposta não pode ficar em branco.", 400, req);
    }

    if (content.length > 10000) {
      return jsonError("BAD_REQUEST", "O conteúdo da resposta excede o limite máximo de 10.000 caracteres.", 400, req);
    }

    const cleanContent = content.trim();

    // 6. Fetch Original Institutional Message from Database
    const { data: originalMessage, error: fetchMsgErr } = await admin
      .from("platform_contact_messages")
      .select("id, sender_name, sender_email, subject, message, created_at")
      .eq("id", messageId.trim())
      .maybeSingle();

    if (fetchMsgErr || !originalMessage) {
      return jsonError("NOT_FOUND", "Mensagem institucional original não encontrada no banco de dados.", 404, req);
    }

    const recipientEmail = (originalMessage.sender_email || "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(recipientEmail)) {
      return jsonError(
        "BAD_REQUEST",
        "O remetente da mensagem original possui um e-mail inválido cadastrado.",
        400,
        req
      );
    }

    const originalSenderName = (originalMessage.sender_name || "Visitante").trim();
    const finalSubject = (subject && typeof subject === "string" && subject.trim().length > 0)
      ? subject.trim().slice(0, 200)
      : `Re: ${originalMessage.subject || "Contato Barbex"}`;

    // 7. Server-Side Deduplication & Race Condition Prevention
    // Check 1: Is there a reply for this message in 'pending' status within the last 15 seconds?
    const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000).toISOString();
    const { data: pendingReplies } = await admin
      .from("platform_contact_replies")
      .select("id, status, attempt_at")
      .eq("message_id", originalMessage.id)
      .eq("status", "pending")
      .gte("attempt_at", fifteenSecondsAgo)
      .limit(1);

    if (pendingReplies && pendingReplies.length > 0) {
      return jsonError(
        "CONFLICT",
        "Uma resposta para esta mensagem já está sendo processada no momento. Aguarde alguns segundos.",
        409,
        req
      );
    }

    // Check 2: Was an identical content reply sent in the last 60 seconds?
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentIdenticalReplies } = await admin
      .from("platform_contact_replies")
      .select("id")
      .eq("message_id", originalMessage.id)
      .eq("content", cleanContent)
      .gte("attempt_at", sixtySecondsAgo)
      .limit(1);

    if (recentIdenticalReplies && recentIdenticalReplies.length > 0) {
      return jsonError(
        "CONFLICT",
        "Uma resposta idêntica a esta já foi enviada no último minuto para esta mensagem.",
        409,
        req
      );
    }

    // 8. Persist Initial Reply Record as 'pending'
    const nowIso = new Date().toISOString();
    const { data: replyRecord, error: insertErr } = await admin
      .from("platform_contact_replies")
      .insert({
        message_id: originalMessage.id,
        admin_id: user.id,
        admin_email: user.email || null,
        subject: finalSubject,
        content: cleanContent,
        recipient_email: recipientEmail,
        status: "pending",
        attempt_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .single();

    if (insertErr || !replyRecord) {
      console.error("[contact-platform-reply] Failed to record reply draft:", insertErr);
      return jsonError(
        "INTERNAL_ERROR",
        "Falha ao registrar tentativa de resposta no banco de dados.",
        500,
        req
      );
    }

    const replyId = replyRecord.id;

    // 9. Dispatch Email via Resend API
    const resendApiKey = getOptionalEnv("RESEND_API_KEY");
    let providerStatus: "accepted_by_provider" | "failed" = "failed";
    let providerMessageId: string | null = null;
    let providerErrorCode: string | null = null;

    if (!resendApiKey || resendApiKey === "mock" || resendApiKey === "test_key") {
      // Mock / Dev environment fallback
      console.log(
        `[contact-platform-reply:mock] Reply sent to ${recipientEmail} | Subject: "${finalSubject}"`
      );
      providerStatus = "accepted_by_provider";
      providerMessageId = `mock_reply_${Date.now()}`;
    } else {
      try {
        const fromAddress =
          Deno.env.get("RESEND_FROM_EMAIL") || "Barbex <nao-responder@notify.barbex.shop>";
        const institutionalReplyTo = "contato@lmstartup.com.br";

        // Build responsive, accessible branded HTML email
        const formattedBody = escapeHtml(cleanContent).replace(/\n/g, "<br/>");
        const formattedOrigMsg = escapeHtml(originalMessage.message || "").replace(/\n/g, "<br/>");

        const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(finalSubject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #05070d; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background-color: #090d16; border-radius: 16px; border: 1px solid #1e293b; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .logo { font-size: 24px; font-weight: 900; color: #a855f7; font-style: italic; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px; }
    h1 { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 16px; }
    p { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 16px; }
    .response-box { background-color: #0f172a; border-radius: 12px; border: 1px solid #334155; padding: 20px; margin: 20px 0; font-size: 14px; color: #f8fafc; line-height: 1.6; }
    .quote-box { background-color: #05070d; border-left: 3px solid #a855f7; border-radius: 4px; padding: 12px 16px; margin-top: 24px; font-size: 12px; color: #94a3b8; line-height: 1.5; }
    .quote-title { font-weight: 700; color: #cbd5e1; margin-bottom: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
    .reply-hint { font-size: 12px; color: #94a3b8; margin-top: 20px; padding: 12px; background-color: #1e1b4b20; border: 1px solid #6366f130; border-radius: 8px; }
    .footer { font-size: 11px; color: #64748b; margin-top: 28px; border-top: 1px solid #1e293b; padding-top: 16px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">BARBEX</div>
    <h1>Olá, ${escapeHtml(originalSenderName)}</h1>
    <p>A equipe institucional do <strong>Barbex</strong> respondeu à sua mensagem:</p>
    
    <div class="response-box">
      ${formattedBody}
    </div>

    <div class="reply-hint">
      <strong>Como responder:</strong> Caso queira dar continuidade a esta conversa, basta responder diretamente a este e-mail ou escrever para <a href="mailto:${institutionalReplyTo}" style="color: #c084fc;">${institutionalReplyTo}</a>.
    </div>

    <div class="quote-box">
      <div class="quote-title">Sua mensagem original:</div>
      ${formattedOrigMsg}
    </div>

    <div class="footer">
      &copy; Barbex Platform &bull; Equipe Institucional &bull; <a href="https://barbex.shop" style="color: #64748b; text-decoration: none;">barbex.shop</a>
    </div>
  </div>
</body>
</html>`.trim();

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [recipientEmail],
            reply_to: institutionalReplyTo,
            subject: finalSubject,
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          const resendData = await resendRes.json();
          providerStatus = "accepted_by_provider";
          providerMessageId = resendData.id || null;
        } else {
          providerStatus = "failed";
          providerErrorCode = `HTTP_${resendRes.status}`;
          const errText = await resendRes.text();
          console.warn(
            `[contact-platform-reply] Resend returned HTTP ${resendRes.status}: ${errText.slice(0, 200)}`
          );
        }
      } catch (sendErr: any) {
        providerStatus = "failed";
        providerErrorCode = sendErr?.name || "NETWORK_ERROR";
        console.warn(
          "[contact-platform-reply] Resend dispatch exception:",
          sendErr?.message || sendErr
        );
      }
    }

    // 10. Update Reply Record with Provider Feedback
    await admin
      .from("platform_contact_replies")
      .update({
        status: providerStatus,
        provider_message_id: providerMessageId,
        provider_error_code: providerErrorCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", replyId);

    // 11. Return Clear Result
    if (providerStatus === "accepted_by_provider") {
      return jsonSuccess(
        {
          replyId,
          status: "accepted_by_provider",
          providerMessageId,
          recipient: recipientEmail,
          subject: finalSubject,
          message: "Resposta enviada com sucesso e aceita pelo provedor de e-mail.",
        },
        200,
        req
      );
    } else {
      return jsonError(
        "SERVICE_UNAVAILABLE",
        `O provedor de e-mail rejeitou o envio (${providerErrorCode || "ERRO_DESCONHECIDO"}). Seu texto foi preservado para nova tentativa.`,
        502,
        req
      );
    }
  } catch (err: any) {
    console.error("[contact-platform-reply] Unhandled error:", err);
    return jsonError(
      "INTERNAL_ERROR",
      "Ocorreu um erro inesperado ao processar a resposta. Tente novamente.",
      500,
      req
    );
  }
});
