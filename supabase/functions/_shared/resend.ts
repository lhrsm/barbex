/**
 * BARBEX SUPABASE EDGE FUNCTIONS — TRANSACTIONAL EMAIL DISPATCHER (RESEND)
 * Handles sending transactional emails via Resend API with safe mock support,
 * template allowlisting, HTML escaping, and error classification.
 */

import { getOptionalEnv } from "./env.ts";
import { EdgeError } from "./errors.ts";

export type EmailTemplateKey =
  | "internal_user_invitation"
  | "email_verification_code"
  | "admin_digest"
  | "review_request"
  | "subscription_reminder"
  | "system_notification"
  | "custom";

export interface SendEmailOptions {
  recipient: string;
  templateKey: EmailTemplateKey;
  templateData: Record<string, unknown>;
  subject?: string;
  html?: string;
  tenantId?: string;
  userId?: string;
}

/**
 * Safely escapes HTML special characters to prevent HTML injection in emails.
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Builds HTML template for team invitations.
 */
function buildInvitationHtml(data: { barbershopName?: string; role?: string; inviteUrl?: string }): { subject: string; html: string } {
  const shop = escapeHtml(data.barbershopName || "Barbex");
  const role = escapeHtml(data.role || "Membro da Equipe");
  const inviteUrl = data.inviteUrl || "https://barbex.shop";
  const subject = `Convite para a equipe da ${shop}`;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; }
    .logo { font-size: 24px; font-weight: bold; color: #38bdf8; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; color: #ffffff; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; font-weight: 600; font-size: 16px; padding: 12px 28px; text-decoration: none; border-radius: 8px; text-align: center; }
    .footer { font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">BARBEX</div>
    <h1>Você foi convidado para a equipe!</h1>
    <p>Olá! Você foi convidado para integrar a equipe de <strong>${shop}</strong> com o papel de <strong>${role}</strong>.</p>
    <p>Clique no botão abaixo para aceitar seu convite e definir sua senha de acesso:</p>
    <p><a href="${inviteUrl}" class="btn" target="_blank" rel="noopener noreferrer">Aceitar Convite</a></p>
    <p style="font-size: 13px; color: #94a3b8;">Este convite expira em 72 horas. Se você não esperava este e-mail, ignore-o com segurança.</p>
    <div class="footer">
      &copy; Barbex Platform — Gestão Inteligente para Barbearias
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

/**
 * Builds HTML template for staff verification code.
 */
function buildVerificationCodeHtml(data: { code?: string; userName?: string }): { subject: string; html: string } {
  const code = escapeHtml(data.code || "000000");
  const userName = escapeHtml(data.userName || "Colaborador");
  const subject = `Seu código de verificação Barbex: ${code}`;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; }
    .logo { font-size: 24px; font-weight: bold; color: #38bdf8; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; color: #ffffff; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .code-box { font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; background-color: #0f172a; border: 1px solid #334155; padding: 16px; text-align: center; border-radius: 8px; margin: 24px 0; }
    .footer { font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">BARBEX</div>
    <h1>Código de Verificação</h1>
    <p>Olá ${userName}, utilize o código abaixo para validar seu e-mail e prosseguir com a configuração de acesso:</p>
    <div class="code-box">${code}</div>
    <p style="font-size: 13px; color: #94a3b8;">Este código expira em 10 minutos. Nunca compartilhe este código com terceiros.</p>
    <div class="footer">
      &copy; Barbex Platform — Gestão Inteligente para Barbearias
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

/**
 * Builds HTML template for Admin Digest.
 */
function buildAdminDigestHtml(data: { period?: string; summaryText?: string; newTenants?: number; newAppointments?: number; criticalEvents?: number }): { subject: string; html: string } {
  const period = data.period === "weekly" ? "Semanal" : "Diário";
  const subject = `📊 Barbex — Relatório ${period} de Atividades`;
  const summary = escapeHtml(data.summaryText || "Resumo operacional da plataforma.");
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; }
    .logo { font-size: 24px; font-weight: bold; color: #38bdf8; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; color: #ffffff; margin-bottom: 16px; }
    .stat-box { display: flex; justify-content: space-between; background-color: #0f172a; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .stat-item { text-align: center; }
    .stat-val { font-size: 20px; font-weight: bold; color: #38bdf8; }
    .stat-lbl { font-size: 12px; color: #94a3b8; }
    p { font-size: 14px; line-height: 1.6; color: #cbd5e1; }
    .footer { font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">BARBEX ADMIN</div>
    <h1>Resumo Executivo ${period}</h1>
    <div class="stat-box">
      <div class="stat-item"><div class="stat-val">${Number(data.newTenants) || 0}</div><div class="stat-lbl">Novos Tenants</div></div>
      <div class="stat-item"><div class="stat-val">${Number(data.newAppointments) || 0}</div><div class="stat-lbl">Agendamentos</div></div>
      <div class="stat-item"><div class="stat-val">${Number(data.criticalEvents) || 0}</div><div class="stat-lbl">Críticos</div></div>
    </div>
    <p style="white-space: pre-line;">${summary}</p>
    <div class="footer">
      &copy; Barbex Platform — Gestão Inteligente para Barbearias
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

/**
 * Builds HTML template for Review Requests.
 */
function buildReviewRequestHtml(data: { customerName?: string; barbershopName?: string; barberName?: string; reviewLink?: string }): { subject: string; html: string } {
  const customerName = escapeHtml(data.customerName || "Cliente");
  const barbershopName = escapeHtml(data.barbershopName || "nossa barbearia");
  const reviewLink = data.reviewLink || "https://barbex.shop";
  const subject = `Como foi seu atendimento na ${barbershopName}?`;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; }
    .logo { font-size: 24px; font-weight: bold; color: #38bdf8; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; color: #ffffff; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; font-weight: 600; font-size: 16px; padding: 12px 28px; text-decoration: none; border-radius: 8px; text-align: center; }
    .footer { font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">BARBEX</div>
    <h1>Avalie seu atendimento!</h1>
    <p>Olá <strong>${customerName}</strong>! Esperamos que tenha tido uma ótima experiência na <strong>${barbershopName}</strong>.</p>
    <p>Poderia dedicar 30 segundos para avaliar o serviço? Sua opinião nos ajuda a evoluir sempre.</p>
    <p><a href="${reviewLink}" class="btn" target="_blank" rel="noopener noreferrer">Avaliar Atendimento</a></p>
    <div class="footer">
      &copy; Barbex Platform — Gestão Inteligente para Barbearias
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

/**
 * Builds HTML template for Subscription Reminders.
 */
function buildSubscriptionReminderHtml(data: { planName?: string; dueDate?: string; actionUrl?: string; message?: string }): { subject: string; html: string } {
  const planName = escapeHtml(data.planName || "Plano Barbex");
  const dueDate = escapeHtml(data.dueDate || "em breve");
  const actionUrl = data.actionUrl || "https://barbex.shop/admin";
  const customMessage = escapeHtml(data.message || `Lembramos que a renovação do seu ${planName} está prevista para ${dueDate}.`);
  const subject = `Aviso sobre sua assinatura ${planName} — Barbex`;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; }
    .logo { font-size: 24px; font-weight: bold; color: #38bdf8; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; color: #ffffff; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; font-weight: 600; font-size: 16px; padding: 12px 28px; text-decoration: none; border-radius: 8px; text-align: center; }
    .footer { font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">BARBEX</div>
    <h1>Informação sobre sua assinatura</h1>
    <p>${customMessage}</p>
    <p>Acesse seu painel financeiro para gerenciar seus métodos de pagamento ou detalhes do plano:</p>
    <p><a href="${actionUrl}" class="btn" target="_blank" rel="noopener noreferrer">Gerenciar Assinatura</a></p>
    <div class="footer">
      &copy; Barbex Platform — Gestão Inteligente para Barbearias
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

/**
 * Builds HTML template for System Notifications.
 */
function buildSystemNotificationHtml(data: { title?: string; message?: string; actionUrl?: string }): { subject: string; html: string } {
  const title = escapeHtml(data.title || "Notificação do Sistema");
  const message = escapeHtml(data.message || "Aviso importante sobre sua conta.");
  const actionUrl = data.actionUrl || "https://barbex.shop";
  const subject = `Barbex — ${title}`;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; }
    .logo { font-size: 24px; font-weight: bold; color: #38bdf8; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; color: #ffffff; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; font-weight: 600; font-size: 16px; padding: 12px 28px; text-decoration: none; border-radius: 8px; text-align: center; }
    .footer { font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">BARBEX</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="${actionUrl}" class="btn" target="_blank" rel="noopener noreferrer">Acessar Sistema</a></p>
    <div class="footer">
      &copy; Barbex Platform — Gestão Inteligente para Barbearias
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

/**
 * Sends a transactional email using Resend API.
 * In development / mock mode, logs safely without making live HTTP requests if RESEND_API_KEY is absent.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ id: string; success: boolean }> {
  const apiKey = getOptionalEnv("RESEND_API_KEY");

  let subject = options.subject || "Notificação Barbex";
  let html = options.html || "<p>Notificação Barbex</p>";

  switch (options.templateKey) {
    case "internal_user_invitation": {
      const rendered = buildInvitationHtml(options.templateData as any);
      subject = rendered.subject;
      html = rendered.html;
      break;
    }
    case "email_verification_code": {
      const rendered = buildVerificationCodeHtml(options.templateData as any);
      subject = rendered.subject;
      html = rendered.html;
      break;
    }
    case "admin_digest": {
      const rendered = buildAdminDigestHtml(options.templateData as any);
      subject = rendered.subject;
      html = rendered.html;
      break;
    }
    case "review_request": {
      const rendered = buildReviewRequestHtml(options.templateData as any);
      subject = rendered.subject;
      html = rendered.html;
      break;
    }
    case "subscription_reminder": {
      const rendered = buildSubscriptionReminderHtml(options.templateData as any);
      subject = rendered.subject;
      html = rendered.html;
      break;
    }
    case "system_notification": {
      const rendered = buildSystemNotificationHtml(options.templateData as any);
      subject = rendered.subject;
      html = rendered.html;
      break;
    }
    case "custom": {
      if (options.templateData?.bodyText) {
        const bodyText = escapeHtml(options.templateData.bodyText);
        html = `<div style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc;"><p>${bodyText}</p></div>`;
      }
      break;
    }
    default:
      throw new EdgeError("BAD_REQUEST", `Template de email desconhecido: ${options.templateKey}`, 400);
  }

  // Mock mode when RESEND_API_KEY is not configured or in test mode
  if (!apiKey || apiKey === "mock" || apiKey === "test_key") {
    console.log(`[Resend Mock] Email to ${options.recipient} | Subject: "${subject}" | Template: ${options.templateKey}`);
    return { id: `mock_msg_${Date.now()}`, success: true };
  }

  const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "Barbex <nao-responder@barbex.shop>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [options.recipient],
        subject,
        html
      })
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Resend Error] Status: ${res.status}, Body: ${errBody}`);
      if (res.status === 429) {
        throw new EdgeError("RATE_LIMIT_EXCEEDED", "Limite de taxa do provedor de e-mail excedido.", 429);
      }
      if (res.status >= 400 && res.status < 500) {
        throw new EdgeError("BAD_REQUEST", `Falha de validação do provedor de e-mail (${res.status}).`, 400);
      }
      throw new EdgeError("SERVICE_UNAVAILABLE", "Falha transitória no envio do e-mail transacional.", 503);
    }

    const data = await res.json();
    return { id: data.id || `msg_${Date.now()}`, success: true };
  } catch (err: unknown) {
    if (err instanceof EdgeError) throw err;
    console.error(`[Resend Exception] Error sending email: ${err}`);
    throw new EdgeError("SERVICE_UNAVAILABLE", "Serviço de e-mail temporariamente indisponível.", 503);
  }
}

