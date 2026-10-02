/**
 * BARBEX SUPABASE EDGE FUNCTIONS — TRANSACTIONAL DUNNING EMAIL & DISPATCH
 * R2E.15C.3: Resend Templates, Provider Delivery, and Error Classification
 *
 * Responsibilities:
 * - Typed event mapping for 5 canonical dunning events (initial, three_day, one_day, grace_expired, recovery)
 * - Deterministic transactional subjects in Brazilian Portuguese
 * - Safe HTML rendering with dynamic input escaping (tenant and plan names)
 * - Plain-text alternative rendering for all events
 * - Canonical recovery link: https://barbex.shop/subscription (NO static Stripe Portal URL)
 * - Timezone display in America/Sao_Paulo
 * - Pre-send eligibility recheck authority (check_dunning_presend_eligibility)
 * - Server-side recipient resolution (tenant owner only)
 * - Resend provider dispatch via existing canonical helper
 * - Fenced completion (complete_dunning_notification) and retry/failure classification (fail_dunning_notification)
 * - PII safe logging (no raw recipient emails logged)
 */

import { escapeHtml, sendEmail, SendEmailOptions } from "./resend.ts";
import { EdgeError } from "./errors.ts";

export type DunningNotificationType =
  "initial" | "three_day" | "one_day" | "grace_expired" | "recovery";

export interface DunningEmailContext {
  notificationType: DunningNotificationType;
  tenantDisplayName?: string | null;
  planDisplayName?: string | null;
  graceEndsAt?: string | Date | null;
  subscriptionUrl?: string;
}

export interface RenderedDunningEmail {
  subject: string;
  html: string;
  text: string;
}

export interface DunningNotificationRecord {
  id: string;
  subscription_id: string;
  tenant_id: string;
  past_due_since: string;
  notification_type: DunningNotificationType;
  status: string;
  recipient_user_id: string;
  recipient_email?: string | null;
  attempt_count: number;
  claim_token: string;
}

export interface DunningDispatchResult {
  status: "sent" | "canceled" | "retry" | "failed" | "completion_failed";
  providerCalled: boolean;
  providerMessageId?: string | null;
  errorCategory?: string;
  errorCode?: string;
  error?: string;
  reason?: string;
}

export const CANONICAL_RECOVERY_URL = "https://barbex.shop/subscription";

/**
 * Format timestamp safely to America/Sao_Paulo timezone.
 */
export function formatSaoPauloDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "em breve";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "em breve";

  try {
    const formattedDate = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);

    const formattedTime = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

    return `${formattedDate} às ${formattedTime} (horário de Brasília)`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Deterministic transactional subjects for dunning events.
 */
export function getDunningSubject(type: DunningNotificationType): string {
  switch (type) {
    case "initial":
      return "Barbex — Pagamento pendente e início do período de carência";
    case "three_day":
      return "Barbex — Restam aproximadamente 3 dias do período de carência";
    case "one_day":
      return "Barbex — Último dia de carência da sua assinatura";
    case "grace_expired":
      return "Barbex — Período de carência encerrado e restrição comercial";
    case "recovery":
      return "Barbex — Pagamento confirmado e assinatura regularizada";
    default:
      return "Barbex — Notificação sobre sua assinatura";
  }
}

/**
 * Render HTML and plain text for dunning notifications.
 */
export function renderDunningEmail(ctx: DunningEmailContext): RenderedDunningEmail {
  const subject = getDunningSubject(ctx.notificationType);
  const tenantName = escapeHtml(ctx.tenantDisplayName || "Sua Barbearia");
  const rawTenantName = ctx.tenantDisplayName || "Sua Barbearia";
  const planName = escapeHtml(ctx.planDisplayName || "Plano Barbex");
  const rawPlanName = ctx.planDisplayName || "Plano Barbex";
  const deadlineStr = formatSaoPauloDateTime(ctx.graceEndsAt);
  const ctaUrl = ctx.subscriptionUrl || CANONICAL_RECOVERY_URL;

  let heading = "";
  let messageHtml = "";
  let messageText = "";

  switch (ctx.notificationType) {
    case "initial":
      heading = "Aviso de Pagamento Pendente";
      messageHtml = `
        <p>Olá! Identificamos uma pendência no processamento do pagamento da sua assinatura (<strong>${planName}</strong>) para <strong>${tenantName}</strong>.</p>
        <p>Seu período de carência (Grace Period) já está ativo e você continua com acesso irrestrito às suas funcionalidades até <strong>${deadlineStr}</strong>.</p>
        <p>Para evitar qualquer interrupção futura em ferramentas comerciais, recomendamos a atualização dos seus dados de faturamento diretamente pelo painel Barbex.</p>
      `;
      messageText =
        `Aviso de Pagamento Pendente\n\n` +
        `Olá! Identificamos uma pendência no processamento do pagamento da sua assinatura (${rawPlanName}) para ${rawTenantName}.\n` +
        `Seu período de carência já está ativo e você continua com acesso irrestrito às suas funcionalidades até ${deadlineStr}.\n` +
        `Para evitar qualquer interrupção futura em ferramentas comerciais, atualize seus dados de faturamento diretamente pelo painel Barbex:\n${ctaUrl}\n\n` +
        `Dúvidas? Entre em contato com nosso suporte através da plataforma ou em suporte@barbex.shop.`;
      break;

    case "three_day":
      heading = "Restam 3 Dias de Carência";
      messageHtml = `
        <p>Olá! Lembramos que restam aproximadamente 3 dias no período de carência da assinatura <strong>${planName}</strong> de <strong>${tenantName}</strong>.</p>
        <p>A data limite para regularização sem restrições é <strong>${deadlineStr}</strong>.</p>
        <p>Caso o pagamento não seja regularizado até essa data, módulos e recursos comerciais poderão sofrer restrições temporárias até a quitação.</p>
      `;
      messageText =
        `Restam 3 Dias de Carência\n\n` +
        `Olá! Lembramos que restam aproximadamente 3 dias no período de carência da assinatura ${rawPlanName} de ${rawTenantName}.\n` +
        `A data limite para regularização sem restrições é ${deadlineStr}.\n` +
        `Caso o pagamento não seja regularizado até essa data, módulos e recursos comerciais poderão sofrer restrições temporárias até a quitação.\n\n` +
        `Regularize sua assinatura acessando:\n${ctaUrl}\n\n` +
        `Dúvidas? Entre em contato com nosso suporte através da plataforma ou em suporte@barbex.shop.`;
      break;

    case "one_day":
      heading = "Último Dia do Período de Carência";
      messageHtml = `
        <p>Olá! Este é um lembrete importante: o período de carência da assinatura <strong>${planName}</strong> de <strong>${tenantName}</strong> encerra-se em <strong>${deadlineStr}</strong>.</p>
        <p>Após esse prazo, funcionalidades comerciais pagas entrarão em modo restrito até que uma nova cobrança seja processada com sucesso pelo seu método de pagamento.</p>
        <p>Evite qualquer impacto na rotina da sua equipe atualizando seus dados de pagamento agora mesmo.</p>
      `;
      messageText =
        `Último Dia do Período de Carência\n\n` +
        `Olá! Este é um lembrete importante: o período de carência da assinatura ${rawPlanName} de ${rawTenantName} encerra-se em ${deadlineStr}.\n` +
        `Após esse prazo, funcionalidades comerciais pagas entrarão em modo restrito até que uma nova cobrança seja processada com sucesso.\n` +
        `Evite qualquer impacto na rotina da sua equipe atualizando seus dados de pagamento agora mesmo:\n${ctaUrl}\n\n` +
        `Dúvidas? Entre em contato com nosso suporte através da plataforma ou em suporte@barbex.shop.`;
      break;

    case "grace_expired":
      heading = "Período de Carência Encerrado";
      messageHtml = `
        <p>Olá. Informamos que o período de carência da assinatura <strong>${planName}</strong> de <strong>${tenantName}</strong> encerrou-se em <strong>${deadlineStr}</strong> sem a confirmação do pagamento.</p>
        <p>Por esse motivo, os recursos comerciais contratados foram restritos temporariamente. Vale ressaltar que sua conta <strong>não foi cancelada nem suspensa administrativamente</strong>: seus dados e histórico permanecem totalmente seguros.</p>
        <p>Para restabelecer imediatamente todas as permissões e recursos da sua assinatura, basta regularizar a pendência financeira.</p>
      `;
      messageText =
        `Período de Carência Encerrado\n\n` +
        `Olá. Informamos que o período de carência da assinatura ${rawPlanName} de ${rawTenantName} encerrou-se em ${deadlineStr} sem a confirmação do pagamento.\n` +
        `Por esse motivo, os recursos comerciais contratados foram restritos temporariamente. Sua conta não foi cancelada nem suspensa administrativamente: seus dados e histórico permanecem totalmente seguros.\n` +
        `Para restabelecer imediatamente todos os recursos, regularize sua assinatura acessando:\n${ctaUrl}\n\n` +
        `Dúvidas? Entre em contato com nosso suporte através da plataforma ou em suporte@barbex.shop.`;
      break;

    case "recovery":
      heading = "Pagamento Confirmado — Assinatura Regularizada";
      messageHtml = `
        <p>Olá! Confirmamos com sucesso a regularização do pagamento da sua assinatura <strong>${planName}</strong> para <strong>${tenantName}</strong>.</p>
        <p>Seu período de carência foi finalizado e todos os recursos e módulos comerciais estão plenamente ativos e disponíveis.</p>
        <p>Agradecemos por manter sua assinatura em dia e continuar contando com a Barbex na gestão da sua barbearia!</p>
      `;
      messageText =
        `Pagamento Confirmado — Assinatura Regularizada\n\n` +
        `Olá! Confirmamos com sucesso a regularização do pagamento da sua assinatura ${rawPlanName} para ${rawTenantName}.\n` +
        `Seu período de carência foi finalizado e todos os recursos e módulos comerciais estão plenamente ativos e disponíveis.\n\n` +
        `Acesse seu painel Barbex:\n${ctaUrl}\n\n` +
        `Dúvidas? Entre em contato com nosso suporte através da plataforma ou em suporte@barbex.shop.`;
      break;
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: 1.5px; color: #38bdf8; margin-bottom: 24px; }
    .logo span { color: #94a3b8; font-weight: 400; font-size: 14px; margin-left: 8px; }
    h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 16px; }
    .btn-container { margin: 28px 0; text-align: center; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 28px; text-decoration: none; border-radius: 8px; text-align: center; transition: background-color 0.2s; }
    .btn:hover { background-color: #0369a1; }
    .support-note { font-size: 13px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
    .footer { font-size: 11px; color: #64748b; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">BARBEX <span>FATURAMENTO</span></div>
    <h1>${escapeHtml(heading)}</h1>
    ${messageHtml}
    <div class="btn-container">
      <a href="${ctaUrl}" class="btn" target="_blank" rel="noopener noreferrer">Gerenciar Assinatura</a>
    </div>
    <div class="support-note">
      Em caso de dúvidas, nossa equipe está à disposição através do e-mail <a href="mailto:suporte@barbex.shop" style="color: #38bdf8; text-decoration: none;">suporte@barbex.shop</a> ou diretamente pelo painel Barbex.
    </div>
    <div class="footer">
      &copy; Barbex Platform — Comunicação Transacional de Faturamento
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text: messageText.trim() };
}

/**
 * Classifies Resend and network provider errors into canonical retryable / non-retryable categories.
 */
export function classifyDunningProviderError(err: unknown): {
  category: string;
  code?: string;
  message: string;
  retryable: boolean;
  retryDelaySeconds: number;
} {
  const errStr = err instanceof Error ? err.message : String(err);
  let status = 0;

  if (err instanceof EdgeError) {
    status = err.status;
  } else if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
  ) {
    status = (err as { status: number }).status;
  }

  // 1. Rate Limit (HTTP 429) -> RETRYABLE_RATE_LIMIT
  if (status === 429 || errStr.includes("RATE_LIMIT") || errStr.includes("429")) {
    return {
      category: "RETRYABLE_RATE_LIMIT",
      code: "HTTP_429",
      message: "Limite de taxa do provedor de e-mail excedido (HTTP 429).",
      retryable: true,
      retryDelaySeconds: 300,
    };
  }

  // 2. Provider Server Error (5xx / 503) -> RETRYABLE_PROVIDER
  if (status >= 500 || errStr.includes("503") || errStr.includes("SERVICE_UNAVAILABLE")) {
    return {
      category: "RETRYABLE_PROVIDER",
      code: `HTTP_${status || 503}`,
      message: "Falha transitória ou indisponibilidade do provedor de e-mail.",
      retryable: true,
      retryDelaySeconds: 300,
    };
  }

  // 3. Client Validation Error (4xx / 400) -> NON_RETRYABLE_VALIDATION
  if (status >= 400 && status < 500 && status !== 429) {
    return {
      category: "NON_RETRYABLE_VALIDATION",
      code: `HTTP_${status}`,
      message: `Erro de validação na requisição do provedor: ${errStr.slice(0, 200)}`,
      retryable: false,
      retryDelaySeconds: 0,
    };
  }

  // 4. Network / Timeout / Abort -> RETRYABLE_NETWORK_OR_UNKNOWN
  if (
    errStr.includes("timeout") ||
    errStr.includes("fetch failed") ||
    errStr.includes("network") ||
    errStr.includes("AbortError") ||
    errStr.includes("ECONNRESET")
  ) {
    return {
      category: "RETRYABLE_NETWORK_OR_UNKNOWN",
      code: "NETWORK_TIMEOUT",
      message: "Timeout ou falha de conectividade com a API de e-mail.",
      retryable: true,
      retryDelaySeconds: 180,
    };
  }

  // 5. Default unknown ambiguous outcome -> UNKNOWN_OUTCOME
  return {
    category: "UNKNOWN_OUTCOME",
    code: "UNKNOWN",
    message: errStr.slice(0, 250) || "Resultado ambíguo do provedor.",
    retryable: true,
    retryDelaySeconds: 300,
  };
}

/**
 * Executes dunning notification provider dispatch with strict pre-send eligibility,
 * server-side recipient authority, fencing verification, and atomic state completion.
 */
export async function dispatchDunningNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  notification: DunningNotificationRecord,
  options?: {
    sendEmailFn?: (opts: SendEmailOptions) => Promise<{ id: string; success: boolean }>;
  },
): Promise<DunningDispatchResult> {
  const sendFn = options?.sendEmailFn || sendEmail;

  // 1. Mandatory Pre-send Eligibility Recheck (RPC check_dunning_presend_eligibility)
  const { data: eligibility, error: eligErr } = await adminClient.rpc(
    "check_dunning_presend_eligibility",
    {
      p_dunning_id: notification.id,
      p_claim_token: notification.claim_token,
    },
  );

  if (eligErr) {
    console.error(
      `[DunningDispatch] Eligibility check error for ${notification.id}: ${eligErr.message}`,
    );
    return {
      status: "failed",
      providerCalled: false,
      errorCategory: "ELIGIBILITY_RPC_ERROR",
      error: eligErr.message,
    };
  }

  if (!eligibility || !eligibility.eligible) {
    const reason = eligibility?.reason || "not_eligible";
    console.log(
      `[DunningDispatch] Notification ${notification.id} is ineligible (${reason}). Provider call omitted.`,
    );
    return {
      status: "canceled",
      providerCalled: false,
      reason,
    };
  }

  // 2. Resolve Canonical Recipient Authority Server-Side (Tenant Owner Only)
  const { data: profile, error: profErr } = await adminClient
    .from("profiles")
    .select("id, email, contact_email, business_name")
    .eq("id", notification.recipient_user_id)
    .maybeSingle();

  if (profErr || !profile) {
    await adminClient.rpc("fail_dunning_notification", {
      p_dunning_id: notification.id,
      p_claim_token: notification.claim_token,
      p_error_category: "NON_RETRYABLE_RECIPIENT",
      p_error_code: "PROFILE_NOT_FOUND",
      p_error_message: "Perfil do proprietário da assinatura não foi encontrado.",
      p_retryable: false,
      p_retry_delay_seconds: 0,
    });
    return {
      status: "failed",
      providerCalled: false,
      errorCategory: "NON_RETRYABLE_RECIPIENT",
      error: "Profile not found",
    };
  }

  const canonicalEmail = (profile.contact_email || profile.email || "").trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!canonicalEmail || !emailRegex.test(canonicalEmail)) {
    await adminClient.rpc("fail_dunning_notification", {
      p_dunning_id: notification.id,
      p_claim_token: notification.claim_token,
      p_error_category: "NON_RETRYABLE_RECIPIENT",
      p_error_code: "INVALID_EMAIL",
      p_error_message: "E-mail do proprietário da assinatura ausente ou inválido.",
      p_retryable: false,
      p_retry_delay_seconds: 0,
    });
    return {
      status: "failed",
      providerCalled: false,
      errorCategory: "NON_RETRYABLE_RECIPIENT",
      error: "Invalid canonical email",
    };
  }

  // 3. Resolve Subscription & Plan Information
  const { data: sub } = await adminClient
    .from("subscriptions")
    .select("id, status, grace_ends_at, price_id")
    .eq("id", notification.subscription_id)
    .maybeSingle();

  let planDisplayName = "Plano Barbex";
  if (sub?.price_id) {
    const { data: plan } = await adminClient
      .from("plans")
      .select("name")
      .or(
        `stripe_price_id_test.eq.${sub.price_id},stripe_price_id_live.eq.${sub.price_id},stripe_yearly_price_id_test.eq.${sub.price_id},stripe_yearly_price_id_live.eq.${sub.price_id}`,
      )
      .limit(1)
      .maybeSingle();

    if (plan?.name) {
      planDisplayName = plan.name;
    } else if (sub.price_id.toLowerCase().includes("starter")) {
      planDisplayName = "Plano Starter";
    } else if (sub.price_id.toLowerCase().includes("pro")) {
      planDisplayName = "Plano Pro";
    } else if (sub.price_id.toLowerCase().includes("elite")) {
      planDisplayName = "Plano Elite";
    }
  }

  // 4. Render Email Template (Subject, HTML, Plain Text)
  const rendered = renderDunningEmail({
    notificationType: notification.notification_type,
    tenantDisplayName: profile.business_name,
    planDisplayName,
    graceEndsAt: sub?.grace_ends_at,
    subscriptionUrl: CANONICAL_RECOVERY_URL,
  });

  // 5. Call Provider via Canonical sendEmail (or Injected Provider Mock)
  let providerMessageId: string | null = null;

  try {
    const sendResult = await sendFn({
      recipient: canonicalEmail,
      templateKey: "custom",
      templateData: {},
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tenantId: notification.tenant_id,
      userId: notification.recipient_user_id,
    });

    providerMessageId = sendResult?.id || null;
  } catch (err: unknown) {
    const classification = classifyDunningProviderError(err);
    console.error(
      `[DunningDispatch] Provider call error for ${notification.id}: ${classification.category} - ${classification.message}`,
    );

    await adminClient.rpc("fail_dunning_notification", {
      p_dunning_id: notification.id,
      p_claim_token: notification.claim_token,
      p_error_category: classification.category,
      p_error_code: classification.code || "PROVIDER_ERROR",
      p_error_message: classification.message,
      p_retryable: classification.retryable,
      p_retry_delay_seconds: classification.retryDelaySeconds,
    });

    return {
      status: classification.retryable ? "retry" : "failed",
      providerCalled: true,
      errorCategory: classification.category,
      errorCode: classification.code,
      error: classification.message,
    };
  }

  // 6. Complete Notification via Fenced RPC (complete_dunning_notification)
  const { data: compSuccess, error: compErr } = await adminClient.rpc(
    "complete_dunning_notification",
    {
      p_dunning_id: notification.id,
      p_claim_token: notification.claim_token,
      p_provider_message_id: providerMessageId,
    },
  );

  if (compErr || !compSuccess) {
    // Note: Provider accepted request, but DB completion failed (e.g. lease expired or token mismatch).
    // This represents the documented provider duplication window.
    console.error(
      `[DunningDispatch] Fenced completion failed for ${notification.id}: ${compErr?.message || "token mismatch"}`,
    );
    return {
      status: "completion_failed",
      providerCalled: true,
      providerMessageId,
      error: compErr?.message || "Fenced completion failed",
    };
  }

  return {
    status: "sent",
    providerCalled: true,
    providerMessageId,
  };
}
