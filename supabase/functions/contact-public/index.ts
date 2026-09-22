// ==============================================================================
// BARBEX — EDGE FUNCTION: contact-public
// ==============================================================================
// Public contact form endpoint with server-side validation, honeypot anti-spam,
// atomic rate limiting, durable persistence in public.contact_messages, and
// truthful transactional email notification delivery via Resend.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { EdgeError, sanitizeError } from "../_shared/errors.ts";
import { checkRateLimit, generateRateLimitKey } from "../_shared/rate-limit.ts";
import { escapeHtml } from "../_shared/resend.ts";
import { getOptionalEnv } from "../_shared/env.ts";

interface ContactRequestBody {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  honeypot?: string;
  slug?: string;
  tenantId?: string;
}

serve(async (req: Request) => {
  // 1. CORS Preflight Handling
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  if (req.method === "GET") {
    // Non-sending health and verification probe
    const apiKey = getOptionalEnv("RESEND_API_KEY");
    const fromEmail = getOptionalEnv("RESEND_FROM_EMAIL") || "Barbex <nao-responder@notify.barbex.shop>";

    let keyValid = false;
    let domainVerified = false;
    let domainStatus: string | null = null;
    let domainsFound: string[] = [];

    let probeHttpStatus: number | null = null;
    let probeMessage: string | null = null;
    let sendingKeyConfirmed = false;

    if (apiKey && apiKey !== "mock" && apiKey !== "test_key") {
      try {
        const domainsRes = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        probeHttpStatus = domainsRes.status;
        if (domainsRes.ok) {
          keyValid = true;
          const data = await domainsRes.json();
          const domainsList: Array<{ name?: string; status?: string }> = data?.data || [];
          domainsFound = domainsList.map(d => d.name || "");
          const notifyDomain = domainsList.find(
            d => (d.name || "").toLowerCase() === "notify.barbex.shop" || (d.name || "").toLowerCase() === "barbex.shop"
          );
          if (notifyDomain) {
            domainStatus = notifyDomain.status || null;
            domainVerified = notifyDomain.status === "verified";
          }
        } else {
          const errText = await domainsRes.text();
          try {
            const parsed = JSON.parse(errText);
            probeMessage = parsed?.message || `HTTP_${domainsRes.status}`;
          } catch {
            probeMessage = `HTTP_${domainsRes.status}`;
          }
          if (probeMessage === "This API key is restricted to only send emails") {
            keyValid = true;
            sendingKeyConfirmed = true;

            // Perform non-sending validation probe to verify domain authorization
            // Calling POST /emails with no recipient ('to' missing) can NEVER send an email,
            // but tests if Resend rejects with 'domain_not_verified' or accepts the 'from' domain.
            const dryRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ from: fromEmail })
            });

            const dryText = await dryRes.text();
            let dryJson: any = null;
            try { dryJson = JSON.parse(dryText); } catch {}

            // If domain is unverified, Resend returns domain_not_verified / 403
            // If domain is verified, Resend returns 422 validation_error about missing 'to' or 'html'
            if (dryText.includes("domain") && (dryText.includes("not verified") || dryText.includes("unverified"))) {
              domainVerified = false;
              domainStatus = "unverified";
              probeMessage = dryJson?.message || dryText;
            } else if (dryRes.status === 422 || (dryJson && dryJson.name === "validation_error")) {
              // The domain passed sender validation, but rejected due to missing required 'to' field
              domainVerified = true;
              domainStatus = "verified_sender_domain";
              probeMessage = `Key authenticated with sending permission; domain accepted by provider (${dryJson?.message || 'validation check passed'})`;
            } else {
              domainStatus = `provider_response_${dryRes.status}`;
              probeMessage = dryJson?.message || `HTTP_${dryRes.status}`;
            }
          }
        }
      } catch (err: unknown) {
        probeMessage = err instanceof Error ? err.message : "FETCH_ERROR";
        console.warn("[contact-public:health] Resend probe error:", probeMessage);
      }
    }

    return jsonSuccess(
      {
        status: "healthy",
        service: "contact-public",
        emailConfig: {
          apiKeyConfigured: Boolean(apiKey && apiKey !== "mock" && apiKey !== "test_key"),
          apiKeyValid: keyValid,
          sendingKeyConfirmed,
          probeHttpStatus,
          probeMessage,
          fromEmailConfigured: Boolean(getOptionalEnv("RESEND_FROM_EMAIL")),
          fromEmailAddress: fromEmail,
          senderDomainVerified: domainVerified,
          senderDomainStatus: domainStatus,
          verifiedDomains: domainsFound
        }
      },
      200,
      req
    );
  }

  if (req.method !== "POST") {
    return jsonError("INVALID_REQUEST", "Apenas métodos GET e POST são permitidos.", 405, req);
  }

  try {
    // 2. Parse JSON body safely
    let body: ContactRequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonError("INVALID_REQUEST", "Corpo da requisição inválido (JSON esperado).", 400, req);
    }

    // 3. Honeypot Anti-Spam Check: fake success for automated bots
    if (body.honeypot && body.honeypot.trim().length > 0) {
      return jsonSuccess(
        {
          success: true,
          persisted: true,
          emailStatus: "sent",
          message: "Recebemos sua mensagem. A barbearia poderá consultá-la pelo painel."
        },
        200,
        req
      );
    }

    // 4. IP Rate Limiting (5 submissions per 10 minutes)
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const rateLimitKey = await generateRateLimitKey(
      "contact_public",
      clientIp,
      body.tenantId || body.slug,
      clientIp
    );

    await checkRateLimit(rateLimitKey, 5, 600);

    // 5. Server-side validation of inputs
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const message = body.message?.trim();
    const phone = body.phone?.trim() || "";
    const subject = body.subject?.trim() || "Contato pelo Site";
    const slug = body.slug?.trim().toLowerCase() || "";
    const tenantId = body.tenantId?.trim() || "";

    if (!name || !email || !message) {
      return jsonError("INVALID_REQUEST", "Nome, e-mail e mensagem são obrigatórios.", 400, req);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError("INVALID_REQUEST", "E-mail inválido.", 400, req);
    }

    if (!slug && !tenantId) {
      return jsonError("INVALID_REQUEST", "Identificador da barbearia (slug) é obrigatório.", 400, req);
    }

    // Enforce bounds
    if (name.length > 100) {
      return jsonError("INVALID_REQUEST", "Nome excede o tamanho máximo de 100 caracteres.", 400, req);
    }
    if (email.length > 120) {
      return jsonError("INVALID_REQUEST", "E-mail excede o tamanho máximo de 120 caracteres.", 400, req);
    }
    if (message.length > 2000) {
      return jsonError("INVALID_REQUEST", "Mensagem excede o tamanho máximo de 2000 caracteres.", 400, req);
    }

    // 6. Canonical Server-Side Tenant Resolution (do not trust client tenant_id blindly)
    const admin = createAdminClient();
    let tenantQuery = admin
      .from("profiles")
      .select("id, business_name, contact_email, email, slug, contact_form_enabled");

    if (slug) {
      tenantQuery = tenantQuery.eq("slug", slug);
    } else {
      tenantQuery = tenantQuery.eq("id", tenantId);
    }

    const { data: tenantProfile, error: tenantErr } = await tenantQuery.maybeSingle();

    if (tenantErr || !tenantProfile) {
      return jsonError("NOT_FOUND", "Barbearia não encontrada.", 404, req);
    }

    // 6.1 Enforce tenant-level contact form toggle (R2E.4D)
    if (tenantProfile.contact_form_enabled !== true) {
      return jsonError(
        "FORBIDDEN",
        "O formulário de contato não está habilitado para esta barbearia.",
        403,
        req,
      );
    }

    // 6.2 Enforce explicit, valid contact_email (NO fallback to login email)
    const contactRecipient = (tenantProfile.contact_email || "").trim();
    if (!contactRecipient || !contactRecipient.includes("@")) {
      return jsonError(
        "UNPROCESSABLE_ENTITY",
        "O formulário de contato desta barbearia não possui um e-mail de recebimento configurado.",
        422,
        req,
      );
    }

    const targetTenantId = tenantProfile.id;
    const targetShopSlug = tenantProfile.slug || slug || "barbex";

    // 7. Durable Database Persistence in public.contact_messages
    const safeName = escapeHtml(name);
    const safeSubject = escapeHtml(subject.slice(0, 150));
    const safeMessage = escapeHtml(message);
    const safePhone = phone ? phone.slice(0, 30) : null;

    const { data: insertedMsg, error: insertErr } = await admin
      .from("contact_messages")
      .insert({
        tenant_id: targetTenantId,
        shop_slug: targetShopSlug,
        sender_name: safeName,
        sender_email: email,
        sender_phone: safePhone,
        subject: safeSubject,
        message: safeMessage,
        read: false,
        email_status: "pending",
        email_recipient: contactRecipient || null
      })
      .select("id")
      .single();

    if (insertErr || !insertedMsg) {
      console.error("[contact-public] DB persistence failed:", insertErr?.message || insertErr);
      return jsonError(
        "INTERNAL_ERROR",
        "Não foi possível salvar sua mensagem. Tente novamente mais tarde.",
        500,
        req
      );
    }

    // 8. Transactional Email Dispatch with Truthful State Model
    const resendApiKey = getOptionalEnv("RESEND_API_KEY");
    let emailStatus: "sent" | "failed" | "provider_unconfigured" = "provider_unconfigured";
    let emailErrorCode: string | null = null;
    let emailProviderMessageId: string | null = null;

    if (!resendApiKey || resendApiKey === "mock" || resendApiKey === "test_key") {
      emailStatus = "provider_unconfigured";
      emailErrorCode = "MISSING_RESEND_API_KEY";
    } else if (!contactRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactRecipient)) {
      emailStatus = "failed";
      emailErrorCode = "NO_RECIPIENT_CONFIGURED";
    } else {
      try {
        const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "Barbex <nao-responder@notify.barbex.shop>";
        const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Nova Mensagem de Contato</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; }
    .logo { font-size: 20px; font-weight: bold; color: #d4af37; margin-bottom: 20px; }
    h1 { font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 16px; }
    p { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 16px; }
    .card { background-color: #0f172a; border-radius: 8px; border: 1px solid #334155; padding: 16px; margin: 20px 0; }
    .field { font-size: 13px; color: #94a3b8; margin-bottom: 8px; }
    .val { color: #f8fafc; font-weight: 600; }
    .msg-box { font-size: 14px; color: #e2e8f0; white-space: pre-wrap; background-color: #1e293b; padding: 12px; border-radius: 6px; border: 1px solid #475569; margin-top: 12px; }
    .footer { font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">BARBEX &bull; ${escapeHtml(tenantProfile.business_name || "Barbearia")}</div>
    <h1>Nova Mensagem de Contato pelo Site</h1>
    <p>Você recebeu uma nova mensagem através da página pública da sua barbearia:</p>
    <div class="card">
      <div class="field">Remetente: <span class="val">${safeName}</span></div>
      <div class="field">E-mail: <span class="val">${escapeHtml(email)}</span></div>
      ${safePhone ? `<div class="field">Telefone / WhatsApp: <span class="val">${escapeHtml(safePhone)}</span></div>` : ""}
      <div class="field">Assunto: <span class="val">${safeSubject}</span></div>
      <div class="msg-box">${safeMessage}</div>
    </div>
    <p style="font-size: 13px; color: #94a3b8;">Esta mensagem também está disponível no seu painel administrativo em Omnichannel &gt; Contato do Site.</p>
    <div class="footer">
      &copy; Barbex Platform — Mensagens do Site
    </div>
  </div>
</body>
</html>`.trim();

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [contactRecipient],
            subject: `[Contato Site] ${safeSubject} - ${safeName}`,
            html: emailHtml
          })
        });

        if (resendRes.ok) {
          const resendData = await resendRes.json();
          emailStatus = "sent";
          emailProviderMessageId = resendData.id || null;
        } else {
          emailStatus = "failed";
          emailErrorCode = `HTTP_${resendRes.status}`;
          const errText = await resendRes.text();
          console.warn(`[contact-public] Resend returned HTTP ${resendRes.status}: ${errText.slice(0, 200)}`);
        }
      } catch (sendErr: any) {
        emailStatus = "failed";
        emailErrorCode = sendErr?.name || "NETWORK_ERROR";
        console.warn("[contact-public] Resend dispatch exception:", sendErr?.message || sendErr);
      }
    }

    // 9. Update the persisted record with email status
    await admin
      .from("contact_messages")
      .update({
        email_status: emailStatus,
        email_recipient: contactRecipient || null,
        email_provider_message_id: emailProviderMessageId,
        email_attempt_at: new Date().toISOString(),
        email_error_code: emailErrorCode,
        updated_at: new Date().toISOString()
      })
      .eq("id", insertedMsg.id);

    // 10. Truthful response acknowledging durable persistence
    return jsonSuccess(
      {
        success: true,
        persisted: true,
        emailStatus,
        id: insertedMsg.id,
        message: "Recebemos sua mensagem. A barbearia poderá consultá-la pelo painel."
      },
      200,
      req
    );
  } catch (err: unknown) {
    const sanitized = sanitizeError(err);
    return jsonError(sanitized.code, sanitized.message, sanitized.status, req);
  }
});
