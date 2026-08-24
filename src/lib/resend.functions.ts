import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Resend Transactional Email Templates and Subjects
 */
export const EMAIL_TEMPLATES = {
  email_verification_code: {
    subject: "Seu código de verificação do Barbex",
    title: "Verifique seu e-mail",
  },
  client_account_setup: {
    subject: "Bem-vindo ao Barbex!",
    title: "Configuração de Conta",
  },
  client_password_recovery: {
    subject: "Redefina sua senha do Barbex",
    title: "Recuperação de Senha",
  },
  internal_user_invitation: {
    subject: "Você foi convidado para acessar o Barbex",
    title: "Convite de Acesso",
  },
  professional_invitation: {
    subject: "Você foi convidado para o Barbex",
    title: "Convite Profissional",
  },
  email_change_verification: {
    subject: "Confirme a alteração do seu e-mail no Barbex",
    title: "Alteração de E-mail",
  },
  security_alert: {
    subject: "Alerta de Segurança - Barbex",
    title: "Alerta de Segurança",
  },
  contact_form_message: {
    subject: "Nova mensagem recebida pelo site",
    title: "Nova Mensagem de Contato",
  },
  platform_contact_form_message: {
    subject: "Novo contato pela landing institucional",
    title: "Novo Contato Barbex",
  },
  mfa_enabled: {
    subject: "MFA Ativado com sucesso",
    title: "Segurança Reforçada",
  },
  mfa_disabled: {
    subject: "MFA Desativado",
    title: "Aviso de Segurança",
  },
  recovery_code_used: {
    subject: "Código de recuperação utilizado",
    title: "Alerta de Segurança",
  },
  test_email: {
    subject: "Teste de configuração do Barbex",
    title: "Teste de Integração",
  }
} as const;

export type TemplateKey = keyof typeof EMAIL_TEMPLATES;

const getAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

function escapeHtml(str?: string | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 13 && cleaned.startsWith("55")) {
    return `+55 (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("55")) {
    return `+55 (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  }
  return phone;
}

function normalizePhoneWa(phone?: string | null): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = "55" + cleaned;
  }
  return cleaned;
}

/**
 * Legacy compatibility: sendVerificationCode
 */
export const sendVerificationCode = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    code: z.string().length(6),
    userName: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    return sendTransactionalEmail({
      data: {
        recipient: data.email,
        templateKey: 'email_verification_code',
        templateData: { code: data.code, userName: data.userName }
      }
    });
  });

/**
 * Central Transactional Email Service
 * Handles template rendering, logging, and sending via Resend
 */
export const sendTransactionalEmail = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    recipient: z.string().email(),
    templateKey: z.string(),
    templateData: z.record(z.any()).optional(),
    tenantId: z.string().optional(),
    userId: z.string().optional(),
    correlationId: z.string().optional(),
    replyTo: z.string().email().optional(),
    customSubject: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const adminClient = await getAdmin();

    // Fetch global settings from database
    const { data: settings } = await adminClient
      .from("resend_settings" as any)
      .select("*")
      .maybeSingle();

    const RESEND_API_KEY = process.env['RESEND_API_KEY'];
    const FROM_EMAIL = (settings as any)?.from_email || process.env['RESEND_FROM_EMAIL'] || 'noreply@notify.barbex.shop';
    const FROM_NAME = (settings as any)?.from_name || process.env['RESEND_FROM_NAME'] || 'Barbex';

    if (!RESEND_API_KEY) {
      console.error("[Resend] API key not found");
      throw new Error("Resend API key is not configured.");
    }

    const template = EMAIL_TEMPLATES[data.templateKey as TemplateKey];
    if (!template) {
      throw new Error(`Template ${data.templateKey} not found`);
    }

    // Create initial log
    const { data: logEntry } = await adminClient
      .from("email_logs" as any)
      .insert({
        tenant_id: data.tenantId,
        user_id: data.userId,
        recipient: data.recipient,
        template_key: data.templateKey,
        correlation_id: data.correlationId,
        status: 'processing'
      } as any)
      .select('id')
      .single();

    const logId = (logEntry as any)?.id;

    try {
      let html = "";
      if (data.templateKey === "contact_form_message") {
        html = renderContactFormEmailHtml(data.templateData);
      } else {
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9f9f9; color: #1a1a1a; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
              .header { background: #000; padding: 40px 20px; text-align: center; }
              .logo { color: #D4AF37; font-size: 28px; font-weight: 800; font-style: italic; letter-spacing: -0.05em; text-transform: uppercase; margin: 0; }
              .content { padding: 40px; line-height: 1.6; }
              .title { font-size: 24px; font-weight: 700; margin-bottom: 24px; color: #111; text-align: center; }
              .button { display: inline-block; padding: 14px 28px; background-color: #D4AF37; color: #000 !important; text-decoration: none; border-radius: 8px; font-weight: 700; text-transform: uppercase; font-size: 14px; letter-spacing: 0.05em; margin: 24px 0; }
              .footer { padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #f3f4f6; }
              .code-box { background: #f3f4f6; padding: 24px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 6px; margin: 24px 0; border-radius: 12px; color: #000; }
              .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              .info-table td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
              .info-table td.label { font-weight: 700; color: #555; width: 30%; }
              .message-box { background: #f8fafc; border-left: 4px solid #D4AF37; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0; font-size: 15px; line-height: 1.6; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 class="logo">BARBEX</h1>
              </div>
              <div class="content">
                <h2 class="title">${template.title}</h2>
                ${renderTemplateContent(data.templateKey as TemplateKey, data.templateData)}
              </div>
              <div class="footer">
                © 2026 Barbex - Gestão Premium de Barbearias<br>
                Enviado por Barbex Enterprise
              </div>
            </div>
          </body>
          </html>
        `;
      }

      const emailPayload: any = {
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [data.recipient],
        subject: data.customSubject || template.subject,
        html: html,
        tags: [
          { name: 'template_key', value: data.templateKey },
          { name: 'log_id', value: String(logId || '') }
        ]
      };

      if (data.replyTo) {
        emailPayload.reply_to = data.replyTo;
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Resend API Error");
      }

      const resendData = await response.json();

      if (logId) {
        await adminClient
          .from("email_logs" as any)
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: resendData.id
          } as any)
          .eq("id", logId);
      }

      return { success: true, messageId: resendData.id };
    } catch (error: any) {
      console.error("[Resend] Send failed:", error);

      if (logId) {
        await adminClient
          .from("email_logs" as any)
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_code: error.message
          } as any)
          .eq("id", logId);
      }

      throw error;
    }
  });

function renderContactFormEmailHtml(data: any = {}) {
  const name = escapeHtml(data.visitorName || data.name || "Visitante");
  const rawEmail = data.visitorEmail || data.email || null;
  const email = rawEmail ? escapeHtml(rawEmail) : null;
  const rawPhone = data.visitorPhone || data.phone || null;
  const formattedPhone = rawPhone ? escapeHtml(formatPhoneDisplay(rawPhone)) : null;
  const waPhone = rawPhone ? normalizePhoneWa(rawPhone) : null;
  const subject = escapeHtml(data.subject || "Contato pelo Site");
  const message = escapeHtml(data.message || "").replace(/\n/g, "<br />");
  const barbershopName = escapeHtml(data.businessName || data.barbershopName || "Sua Barbearia");
  const slug = escapeHtml(data.slug || "");
  const sentAt = escapeHtml(data.timestamp || data.sentAt || new Date().toLocaleString("pt-BR"));

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Nova Mensagem de Contato</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 30px 12px;">
    <tr>
      <td align="center">
        <!-- Container Principal -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">

          <!-- Header Premium -->
          <tr>
            <td align="center" style="background-color: #050505; padding: 36px 20px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <span style="color: #D4AF37; font-size: 26px; font-weight: 900; font-style: italic; letter-spacing: 2px; text-transform: uppercase; display: block;">BARBEX</span>
                    <span style="color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 6px; display: block;">NOVA MENSAGEM DE CONTATO</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corpo do E-mail -->
          <tr>
            <td style="padding: 36px 28px;">

              <!-- Introdução & Badge -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <h2 style="font-size: 22px; font-weight: 800; color: #111827; margin: 0 0 8px 0; letter-spacing: -0.5px;">Nova mensagem pelo seu site</h2>
                    <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 14px 0;">Um visitante entrou em contato através da página pública da sua barbearia no Barbex.</p>
                    <span style="display: inline-block; background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 4px 14px; border-radius: 9999px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${barbershopName}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Card: Dados do Contato -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding-bottom: 12px; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block;">DADOS DO CONTATO</span>
                  </td>
                </tr>

                <!-- Nome -->
                <tr>
                  <td style="padding: 12px 0 8px 0;">
                    <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Nome</span>
                    <span style="font-size: 15px; color: #0f172a; font-weight: 700; display: block;">${name}</span>
                  </td>
                </tr>

                <!-- E-mail (se presente) -->
                ${email ? `
                <tr>
                  <td style="padding: 8px 0; border-top: 1px solid #f8fafc;">
                    <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">E-mail</span>
                    <a href="mailto:${email}" style="font-size: 15px; color: #0f172a; font-weight: 600; text-decoration: underline;">${email}</a>
                  </td>
                </tr>` : ''}

                <!-- Telefone / WhatsApp (se presente) -->
                ${formattedPhone ? `
                <tr>
                  <td style="padding: 8px 0; border-top: 1px solid #f8fafc;">
                    <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Telefone / WhatsApp</span>
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 15px; color: #0f172a; font-weight: 700; padding-right: 12px;">${formattedPhone}</td>
                        ${waPhone ? `
                        <td>
                          <a href="https://wa.me/${waPhone}" style="display: inline-block; font-size: 12px; font-weight: 800; color: #059669; text-decoration: none; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 2px 10px; border-radius: 6px;">
                            Falar pelo WhatsApp &rarr;
                          </a>
                        </td>` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>` : ''}

                <!-- Assunto (se presente) -->
                ${subject ? `
                <tr>
                  <td style="padding: 8px 0 4px 0; border-top: 1px solid #f8fafc;">
                    <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Assunto</span>
                    <span style="font-size: 14px; color: #334155; font-weight: 600; display: block;">${subject}</span>
                  </td>
                </tr>` : ''}
              </table>

              <!-- Bloco: Mensagem -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #D4AF37; border-radius: 10px; padding: 20px; margin-bottom: 28px;">
                <tr>
                  <td style="padding-bottom: 10px;">
                    <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block;">MENSAGEM DO VISITANTE</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 15px; color: #1e293b; line-height: 1.7; word-break: break-word;">
                    ${message}
                  </td>
                </tr>
              </table>

              <!-- Ações Rápidas -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block;">RESPONDER AO CLIENTE</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        ${email ? `
                        <td style="padding-right: 12px; padding-bottom: 8px;">
                          <a href="mailto:${email}" style="display: inline-block; padding: 13px 24px; background-color: #D4AF37; color: #000000 !important; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">
                            Responder por e-mail
                          </a>
                        </td>` : ''}
                        ${waPhone ? `
                        <td style="padding-bottom: 8px;">
                          <a href="https://wa.me/${waPhone}" style="display: inline-block; padding: 13px 24px; background-color: #10b981; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">
                            Responder pelo WhatsApp
                          </a>
                        </td>` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Informações de Envio (Discreto) -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 14px 16px;">
                <tr>
                  <td style="padding-bottom: 8px;">
                    <span style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; display: block;">INFORMAÇÕES DO ENVIO</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #64748b; line-height: 1.6;">
                    ${slug ? `<strong>Página:</strong> barbex.shop/${slug}<br/>` : ''}
                    <strong>Data/Hora:</strong> ${sentAt}<br/>
                    <strong>Barbearia:</strong> ${barbershopName}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Discreto -->
          <tr>
            <td align="center" style="padding: 24px 20px; background-color: #fafafa; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; line-height: 1.5;">
              Mensagem enviada através da página pública da <strong>${barbershopName}</strong> no Barbex.<br/>
              <span style="color: #9ca3af; font-size: 11px; font-weight: 600; margin-top: 4px; display: inline-block;">Barbex &bull; Gestão inteligente para barbearias</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function renderTemplateContent(key: TemplateKey, data: any = {}) {
  switch (key) {
    case 'email_verification_code':
      return `
        <p>Olá, utilize o código abaixo para confirmar sua identidade no Barbex:</p>
        <div class="code-box">${data.code}</div>
        <p style="text-align: center; color: #666; font-size: 14px;">Este código expira em 10 minutos.</p>
      `;
    case 'contact_form_message':
      return `
        <p>Você recebeu uma nova mensagem enviada através da sua página pública no Barbex.</p>
        <table class="info-table">
          <tr><td class="label">Barbearia:</td><td><strong>${data.businessName || data.barbershopName || 'Barbearia'}</strong></td></tr>
          <tr><td class="label">Nome:</td><td>${data.visitorName || data.name || 'Não informado'}</td></tr>
          <tr><td class="label">E-mail:</td><td>${(data.visitorEmail || data.email) ? `<a href="mailto:${data.visitorEmail || data.email}">${data.visitorEmail || data.email}</a>` : 'Não informado'}</td></tr>
          <tr><td class="label">Telefone / WhatsApp:</td><td>${data.visitorPhone || data.phone || 'Não informado'}</td></tr>
          <tr><td class="label">Assunto:</td><td><strong>${data.subject || 'Contato'}</strong></td></tr>
          <tr><td class="label">Origem:</td><td>barbex.shop/${data.slug || ''}</td></tr>
          <tr><td class="label">Data/Hora:</td><td>${data.timestamp || data.sentAt || new Date().toLocaleString('pt-BR')}</td></tr>
        </table>
        <h4 style="margin: 20px 0 8px; color: #111;">Mensagem:</h4>
        <div class="message-box">${data.message || ''}</div>
        <p style="font-size: 13px; color: #666; margin-top: 24px;">Para responder ao cliente, basta responder diretamente a este e-mail.</p>
      `;
    case 'platform_contact_form_message':
      return `
        <p>Você recebeu um novo contato corporativo através da <strong>Landing Institucional do Barbex</strong> (barbex.shop).</p>
        <table class="info-table">
          <tr><td class="label">Plataforma:</td><td><strong>Barbex Enterprise</strong></td></tr>
          <tr><td class="label">Nome:</td><td>${data.visitorName || data.name || 'Não informado'}</td></tr>
          <tr><td class="label">E-mail:</td><td>${(data.visitorEmail || data.email) ? `<a href="mailto:${data.visitorEmail || data.email}">${data.visitorEmail || data.email}</a>` : 'Não informado'}</td></tr>
          <tr><td class="label">Telefone / WhatsApp:</td><td>${data.visitorPhone || data.phone || 'Não informado'}</td></tr>
          <tr><td class="label">Empresa / Barbearia:</td><td>${data.company || 'Não informado'}</td></tr>
          <tr><td class="label">Assunto:</td><td><strong>${data.subject || 'Contato Institucional'}</strong></td></tr>
          <tr><td class="label">Origem:</td><td>https://barbex.shop/#contato</td></tr>
          <tr><td class="label">Data/Hora:</td><td>${data.timestamp || data.sentAt || new Date().toLocaleString('pt-BR')}</td></tr>
        </table>
        <h4 style="margin: 20px 0 8px; color: #111;">Mensagem:</h4>
        <div class="message-box">${data.message || ''}</div>
        <p style="font-size: 13px; color: #666; margin-top: 24px;">Para responder diretamente ao interessado, basta responder a este e-mail.</p>
      `;
    case 'internal_user_invitation':
    case 'professional_invitation':
      return `
        <p>Olá! Você foi convidado para acessar o Barbex.</p>
        <p><strong>Barbearia:</strong> ${data.barbershopName || 'Barbex'}</p>
        <p><strong>Função:</strong> ${data.role || 'Membro'}</p>
        <div style="text-align: center;">
          <a href="${data.inviteUrl}" class="button">CRIAR MEU ACESSO</a>
        </div>
        <p style="text-align: center; color: #666; font-size: 14px;">Este convite expira em 72 horas.</p>
      `;
    case 'client_password_recovery':
      return `
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <div style="text-align: center;">
          <a href="${data.recoveryUrl}" class="button">REDEFINIR MINHA SENHA</a>
        </div>
        <p style="text-align: center; color: #666; font-size: 14px;">Se você não solicitou, ignore este e-mail.</p>
      `;
    case 'test_email':
      return `
        <p>Olá.</p>
        <p>Este é um e-mail de teste da integração Resend do Barbex.</p>
        <p>Se você recebeu esta mensagem, a configuração de e-mail transacional está funcionando corretamente.</p>
        <p><strong>Barbex</strong></p>
      `;
    case 'security_alert':
    case 'mfa_enabled':
    case 'mfa_disabled':
    case 'recovery_code_used':
      return `
        <p>Aviso importante sobre sua conta:</p>
        <div style="background: #fff8e1; border-left: 4px solid #D4AF37; padding: 15px; margin: 20px 0;">
          ${data.message || 'Houve uma alteração nas configurações de segurança da sua conta.'}
        </div>
        <p>Se você reconhece esta ação, nenhuma medida adicional é necessária.</p>
      `;
    default:
      return `<p>${data.message || 'Este é um e-mail automático do sistema Barbex.'}</p>`;
  }
}
