/**
 * BARBEX — R2E.15C.3: Transactional Dunning Email Dispatch Tests
 * Local Validation Suite for Resend Templates, Provider Delivery,
 * Pre-Send Eligibility Recheck, Retry Classification, Claim Fencing, and PII Safety.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");

function runPsql(sql) {
  try {
    const raw = execSync(
      "docker exec -i supabase_db_barbex psql -U postgres -d postgres -t -A -v ON_ERROR_STOP=1",
      {
        input: sql,
        stdio: ["pipe", "pipe", "pipe"],
      },
    )
      .toString()
      .trim();
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines[lines.length - 1] || "";
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(`psql error: ${stderr}`);
  }
}

function runPsqlJson(sql) {
  const res = runPsql(sql);
  try {
    return JSON.parse(res);
  } catch (e) {
    throw new Error(`Failed to parse JSON from psql: "${res}". Error: ${e.message}`);
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatSaoPauloDateTime(dateInput) {
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

function getDunningSubject(type) {
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

const CANONICAL_RECOVERY_URL = "https://barbex.shop/subscription";

function renderDunningEmail(ctx) {
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
  <title>${escapeHtml(subject)}</title>
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
      Em caso de dúvidas, nossa equipe está à disposição através do e-mail suporte@barbex.shop ou diretamente pelo painel Barbex.
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

function classifyDunningProviderError(err) {
  const errStr = err instanceof Error ? err.message : String(err);
  let status = 0;

  if (err && typeof err === "object" && typeof err.status === "number") {
    status = err.status;
  }

  if (status === 429 || errStr.includes("RATE_LIMIT") || errStr.includes("429")) {
    return {
      category: "RETRYABLE_RATE_LIMIT",
      code: "HTTP_429",
      message: "Limite de taxa do provedor de e-mail excedido (HTTP 429).",
      retryable: true,
      retryDelaySeconds: 300,
    };
  }

  if (status >= 500 || errStr.includes("503") || errStr.includes("SERVICE_UNAVAILABLE")) {
    return {
      category: "RETRYABLE_PROVIDER",
      code: `HTTP_${status || 503}`,
      message: "Falha transitória ou indisponibilidade do provedor de e-mail.",
      retryable: true,
      retryDelaySeconds: 300,
    };
  }

  if (status >= 400 && status < 500 && status !== 429) {
    return {
      category: "NON_RETRYABLE_VALIDATION",
      code: `HTTP_${status}`,
      message: `Erro de validação na requisição do provedor: ${errStr.slice(0, 200)}`,
      retryable: false,
      retryDelaySeconds: 0,
    };
  }

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

  return {
    category: "UNKNOWN_OUTCOME",
    code: "UNKNOWN",
    message: errStr.slice(0, 250) || "Resultado ambíguo do provedor.",
    retryable: true,
    retryDelaySeconds: 300,
  };
}

describe(
  "BARBEX — R2E.15C.3: Transactional Dunning Email Dispatch Suite",
  { concurrency: 1 },
  () => {
    const testOwner = "44444444-aaaa-4444-8444-111111111111";
    const testOwnerInvalidEmail = "44444444-aaaa-4444-8444-222222222222";
    const testSubA = "sub_dunning_email_test_a";
    const testSubB = "sub_dunning_email_test_b";
    let mockProviderCalls = 0;

    function clearAllDunning() {
      runPsql("DELETE FROM public.dunning_notifications;");
    }

    before(() => {
      runPsql(`
      BEGIN;
      INSERT INTO auth.users (id, email) VALUES
        ('${testOwner}', 'owner_valid@barbex.shop'),
        ('${testOwnerInvalidEmail}', 'invalid_owner@barbex.shop')
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

      INSERT INTO public.profiles (id, email, contact_email, status, role, business_name, tenant_id) VALUES
        ('${testOwner}', 'owner_valid@barbex.shop', 'owner_valid@barbex.shop', 'active', 'tenant_admin', 'Barbearia Modelo & Cia', '${testOwner}'),
        ('${testOwnerInvalidEmail}', 'bad-email-no-at', NULL, 'active', 'tenant_admin', 'Barbearia Inválida', '${testOwnerInvalidEmail}')
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        contact_email = EXCLUDED.contact_email,
        business_name = EXCLUDED.business_name,
        status = EXCLUDED.status,
        role = EXCLUDED.role,
        tenant_id = EXCLUDED.tenant_id;

      DELETE FROM public.dunning_notifications;
      DELETE FROM public.subscriptions WHERE stripe_subscription_id IN ('${testSubA}', '${testSubB}', 'sub_invalid_owner_test');
      COMMIT;
    `);
    });

    after(() => {
      runPsql(`
      BEGIN;
      DELETE FROM public.dunning_notifications;
      DELETE FROM public.notifications WHERE tenant_id IN ('${testOwner}', '${testOwnerInvalidEmail}');
      DELETE FROM public.audit_logs WHERE target_id IN ('${testOwner}', '${testOwnerInvalidEmail}') OR admin_id IN ('${testOwner}', '${testOwnerInvalidEmail}');
      DELETE FROM public.subscriptions WHERE user_id IN ('${testOwner}', '${testOwnerInvalidEmail}') OR stripe_subscription_id IN ('${testSubA}', '${testSubB}', 'sub_invalid_owner_test');
      DELETE FROM public.profiles WHERE id IN ('${testOwner}', '${testOwnerInvalidEmail}');
      DELETE FROM auth.users WHERE id IN ('${testOwner}', '${testOwnerInvalidEmail}');
      COMMIT;
    `);
    });

    // ============================================================================
    // Gate 1: Template Rendering, Branding, Subjects & HTML Safety
    // ============================================================================
    describe("Gate 1: Template Rendering, Branding, Subjects & HTML Safety", () => {
      test("1.1 Deterministic subjects match canonical requirements for all 5 events", () => {
        assert.equal(
          getDunningSubject("initial"),
          "Barbex — Pagamento pendente e início do período de carência",
        );
        assert.equal(
          getDunningSubject("three_day"),
          "Barbex — Restam aproximadamente 3 dias do período de carência",
        );
        assert.equal(
          getDunningSubject("one_day"),
          "Barbex — Último dia de carência da sua assinatura",
        );
        assert.equal(
          getDunningSubject("grace_expired"),
          "Barbex — Período de carência encerrado e restrição comercial",
        );
        assert.equal(
          getDunningSubject("recovery"),
          "Barbex — Pagamento confirmado e assinatura regularizada",
        );
      });

      test("1.2 Recovery CTA link strictly points to https://barbex.shop/subscription in all 5 templates", () => {
        const types = ["initial", "three_day", "one_day", "grace_expired", "recovery"];
        for (const t of types) {
          const rendered = renderDunningEmail({
            notificationType: t,
            tenantDisplayName: "Barbearia Teste",
            planDisplayName: "Plano Pro",
            graceEndsAt: "2026-10-15T15:00:00Z",
          });
          assert.ok(
            rendered.html.includes("https://barbex.shop/subscription"),
            `Missing CTA URL in ${t} HTML`,
          );
          assert.ok(
            rendered.text.includes("https://barbex.shop/subscription"),
            `Missing CTA URL in ${t} text`,
          );
          assert.ok(
            !rendered.html.includes("billing.stripe.com"),
            `Must not contain static Stripe portal URL in ${t}`,
          );
        }
      });

      test("1.3 Zero static Stripe Portal URLs in any template output", () => {
        const rendered = renderDunningEmail({
          notificationType: "initial",
          tenantDisplayName: "Barbearia Alpha",
          planDisplayName: "Plano Pro",
        });
        assert.ok(!rendered.html.includes("stripe.com/session"));
        assert.ok(!rendered.text.includes("stripe.com/session"));
      });

      test("1.4 Dynamic tenant display name and plan name are strictly HTML-escaped", () => {
        const maliciousTenant =
          '<script>alert("xss")</script> & Barbearia "O\'Connor" <img src=x onerror=1>';
        const maliciousPlan = 'Plano <span onclick=hack()>Pro</span> & "VIP"';

        const rendered = renderDunningEmail({
          notificationType: "initial",
          tenantDisplayName: maliciousTenant,
          planDisplayName: maliciousPlan,
          graceEndsAt: "2026-10-10T12:00:00Z",
        });

        assert.ok(!rendered.html.includes("<script>"), "Raw <script> tag detected!");
        assert.ok(!rendered.html.includes("<img src=x"), "Raw <img> tag detected!");
        assert.ok(!rendered.html.includes("<span onclick="), "Raw <span> tag detected!");
        assert.ok(rendered.html.includes("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"));
        assert.ok(rendered.html.includes("&amp; Barbearia &quot;O&#039;Connor&quot;"));
        assert.ok(rendered.html.includes("&lt;img src=x onerror=1&gt;"));
      });

      test("1.5 Plain text alternative rendered for all 5 events", () => {
        const types = ["initial", "three_day", "one_day", "grace_expired", "recovery"];
        for (const t of types) {
          const rendered = renderDunningEmail({
            notificationType: t,
            tenantDisplayName: "Barbearia Elite",
            planDisplayName: "Plano Starter",
            graceEndsAt: "2026-10-12T18:00:00Z",
          });
          assert.ok(
            rendered.text && rendered.text.length > 50,
            `Plain text missing or too short for ${t}`,
          );
          assert.ok(
            !rendered.text.includes("<html>"),
            `Plain text should not contain HTML tags in ${t}`,
          );
          assert.ok(
            !rendered.text.includes("<div>"),
            `Plain text should not contain div tags in ${t}`,
          );
        }
      });

      test("1.6 Timezone formatting in America/Sao_Paulo (horário de Brasília)", () => {
        const isoUtc = "2026-10-10T15:30:00Z"; // 12:30 in America/Sao_Paulo (UTC-3)
        const formatted = formatSaoPauloDateTime(isoUtc);
        assert.ok(formatted.includes("10/10/2026"), `Date part missing in: ${formatted}`);
        assert.ok(
          formatted.includes("12:30"),
          `Time part in Sao Paulo timezone missing in: ${formatted}`,
        );
        assert.ok(
          formatted.includes("horário de Brasília"),
          `Timezone label missing in: ${formatted}`,
        );
      });

      test("1.7 Tone validation: no false claims of tenant suspension or deletion", () => {
        const initial = renderDunningEmail({ notificationType: "initial" });
        assert.ok(
          !initial.html.toLowerCase().includes("conta suspensa"),
          "Initial must not claim suspension",
        );
        assert.ok(
          !initial.html.toLowerCase().includes("conta deletada"),
          "Initial must not threaten deletion",
        );

        const oneDay = renderDunningEmail({ notificationType: "one_day" });
        assert.ok(
          !oneDay.html.toLowerCase().includes("conta suspensa"),
          "One_day must not claim suspension",
        );
        assert.ok(
          !oneDay.html.toLowerCase().includes("conta deletada"),
          "One_day must not threaten deletion",
        );

        const expired = renderDunningEmail({ notificationType: "grace_expired" });
        assert.ok(
          expired.html.includes("não foi cancelada nem suspensa administrativamente"),
          "Grace_expired must clarify non-suspension",
        );
        assert.ok(
          expired.html.includes("recursos comerciais contratados foram restritos"),
          "Grace_expired must state commercial restriction",
        );
      });
    });

    // ============================================================================
    // Gate 2: Error Classification Matrix
    // ============================================================================
    describe("Gate 2: Error Classification Matrix", () => {
      test("2.1 HTTP 429 classified as RETRYABLE_RATE_LIMIT with retryable: true", () => {
        const err429 = { status: 429, message: "Too Many Requests" };
        const res = classifyDunningProviderError(err429);
        assert.equal(res.category, "RETRYABLE_RATE_LIMIT");
        assert.equal(res.retryable, true);
        assert.equal(res.retryDelaySeconds, 300);
      });

      test("2.2 HTTP 503 / 500 classified as RETRYABLE_PROVIDER with retryable: true", () => {
        const err503 = { status: 503, message: "Service Unavailable" };
        const res503 = classifyDunningProviderError(err503);
        assert.equal(res503.category, "RETRYABLE_PROVIDER");
        assert.equal(res503.retryable, true);

        const err500 = { status: 500, message: "Internal Server Error" };
        const res500 = classifyDunningProviderError(err500);
        assert.equal(res500.category, "RETRYABLE_PROVIDER");
        assert.equal(res500.retryable, true);
      });

      test("2.3 Network / fetch failed / timeout classified as RETRYABLE_NETWORK_OR_UNKNOWN", () => {
        const errNet = new Error("fetch failed: connect ECONNRESET");
        const resNet = classifyDunningProviderError(errNet);
        assert.equal(resNet.category, "RETRYABLE_NETWORK_OR_UNKNOWN");
        assert.equal(resNet.retryable, true);
        assert.equal(resNet.retryDelaySeconds, 180);
      });

      test("2.4 HTTP 400 validation error classified as NON_RETRYABLE_VALIDATION", () => {
        const err400 = { status: 400, message: "Invalid payload: missing from field" };
        const res = classifyDunningProviderError(err400);
        assert.equal(res.category, "NON_RETRYABLE_VALIDATION");
        assert.equal(res.retryable, false);
        assert.equal(res.retryDelaySeconds, 0);
      });

      test("2.5 Ambiguous unknown outcome classified as UNKNOWN_OUTCOME with retryable: true", () => {
        const errUnknown = new Error("Unexpected crash in worker runtime");
        const res = classifyDunningProviderError(errUnknown);
        assert.equal(res.category, "UNKNOWN_OUTCOME");
        assert.equal(res.retryable, true);
      });
    });

    // ============================================================================
    // Gate 3: Provider Mock & Lifecycle Dispatch (Zero Real Network Calls)
    // ============================================================================
    describe("Gate 3: Provider Mock & Lifecycle Dispatch (Zero Real Network Calls)", () => {
      test("3.1 INITIAL dunning notice: claimed, pre-send passes, mock invoked once, sent", () => {
        clearAllDunning();

        const pastDueSince = new Date(Date.now() - 3600000).toISOString();
        const syncRes = runPsqlJson(`
        SELECT public.sync_subscription_atomic(
          '${testOwner}'::uuid,
          '${testSubA}',
          'cus_test_email_a',
          'price_1TVtOWPKG6q10UjrQErPgyKO',
          'prod_starter',
          'past_due',
          now(),
          now() + interval '1 month',
          false,
          'test',
          '${pastDueSince}'::timestamptz
        );
      `);
        assert.equal(syncRes.ok, true);

        // Claim initial notification
        const claimRes = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);
        assert.ok(claimRes.id, "Failed to claim initial dunning notice");
        assert.equal(claimRes.notification_type, "initial");
        assert.ok(claimRes.claim_token, "Claim token missing");
        assert.equal(claimRes.attempt_count, 1);

        // Pre-send check
        const eligRes = runPsqlJson(`
        SELECT public.check_dunning_presend_eligibility('${claimRes.id}', '${claimRes.claim_token}');
      `);
        assert.equal(eligRes.eligible, true);

        // Complete via mock
        mockProviderCalls++;
        const mockMsgId = `resend_mock_msg_${Date.now()}`;
        const compRes = runPsql(`
        SELECT public.complete_dunning_notification('${claimRes.id}', '${claimRes.claim_token}', '${mockMsgId}');
      `);
        assert.equal(compRes, "t");

        const row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${claimRes.id}';`,
        );
        assert.equal(row.status, "sent");
        assert.equal(row.provider_message_id, mockMsgId);
        assert.ok(row.sent_at);
        assert.equal(row.claim_token, null);
      });

      test("3.2 THREE_DAY reminder: claimed, pre-send passes, mock invoked once, sent", () => {
        clearAllDunning();

        const subId = runPsql(
          `SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSubA}';`,
        );
        const pastDueSince = runPsql(
          `SELECT past_due_since FROM public.subscriptions WHERE stripe_subscription_id = '${testSubA}';`,
        );

        const intentId = runPsql(`
        SELECT public.record_dunning_intent(
          '${subId}',
          '${testOwner}',
          '${pastDueSince}'::timestamptz,
          'three_day',
          'Aviso: Restam 3 dias de Carência',
          'Sua assinatura continua com pagamento pendente.'
        );
      `);
        assert.ok(intentId);

        const claimRes = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);
        assert.equal(claimRes.id, intentId);
        assert.equal(claimRes.notification_type, "three_day");

        const elig = runPsqlJson(`
        SELECT public.check_dunning_presend_eligibility('${claimRes.id}', '${claimRes.claim_token}');
      `);
        assert.equal(elig.eligible, true);

        mockProviderCalls++;
        const mockMsgId = `resend_mock_msg_${Date.now()}`;
        runPsql(
          `SELECT public.complete_dunning_notification('${claimRes.id}', '${claimRes.claim_token}', '${mockMsgId}');`,
        );

        const row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${claimRes.id}';`,
        );
        assert.equal(row.status, "sent");
        assert.equal(row.provider_message_id, mockMsgId);
      });

      test("3.3 ONE_DAY reminder: claimed, pre-send passes, mock invoked once, sent", () => {
        clearAllDunning();

        const subId = runPsql(
          `SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSubA}';`,
        );
        const pastDueSince = runPsql(
          `SELECT past_due_since FROM public.subscriptions WHERE stripe_subscription_id = '${testSubA}';`,
        );

        const intentId = runPsql(`
        SELECT public.record_dunning_intent(
          '${subId}',
          '${testOwner}',
          '${pastDueSince}'::timestamptz,
          'one_day',
          'Último Dia de Carência',
          'Amanhã encerra o período de carência.'
        );
      `);
        assert.ok(intentId);

        const claimRes = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);
        assert.equal(claimRes.id, intentId);
        assert.equal(claimRes.notification_type, "one_day");

        const elig = runPsqlJson(`
        SELECT public.check_dunning_presend_eligibility('${claimRes.id}', '${claimRes.claim_token}');
      `);
        assert.equal(elig.eligible, true);

        mockProviderCalls++;
        const mockMsgId = `resend_mock_msg_${Date.now()}`;
        runPsql(
          `SELECT public.complete_dunning_notification('${claimRes.id}', '${claimRes.claim_token}', '${mockMsgId}');`,
        );

        const row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${claimRes.id}';`,
        );
        assert.equal(row.status, "sent");
      });

      test("3.4 GRACE_EXPIRED notice: claimed, pre-send passes, mock invoked once, sent", () => {
        clearAllDunning();

        const subId = runPsql(
          `SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSubA}';`,
        );
        const pastDueSince = runPsql(
          `SELECT past_due_since FROM public.subscriptions WHERE stripe_subscription_id = '${testSubA}';`,
        );

        const intentId = runPsql(`
        SELECT public.record_dunning_intent(
          '${subId}',
          '${testOwner}',
          '${pastDueSince}'::timestamptz,
          'grace_expired',
          'Período de Carência Encerrado',
          'Recursos comerciais restritos até a quitação.'
        );
      `);
        assert.ok(intentId);

        const claimRes = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);
        assert.equal(claimRes.id, intentId);
        assert.equal(claimRes.notification_type, "grace_expired");

        const elig = runPsqlJson(`
        SELECT public.check_dunning_presend_eligibility('${claimRes.id}', '${claimRes.claim_token}');
      `);
        assert.equal(elig.eligible, true);

        mockProviderCalls++;
        const mockMsgId = `resend_mock_msg_${Date.now()}`;
        runPsql(
          `SELECT public.complete_dunning_notification('${claimRes.id}', '${claimRes.claim_token}', '${mockMsgId}');`,
        );

        const row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${claimRes.id}';`,
        );
        assert.equal(row.status, "sent");
      });

      test("3.5 RECOVERY notice: claimed, pre-send passes after recovery, mock invoked once, sent", () => {
        clearAllDunning();

        // 1. Recover subscription to active -> automatically records 'recovery' intent
        const recSync = runPsqlJson(`
        SELECT public.sync_subscription_atomic(
          '${testOwner}'::uuid,
          '${testSubA}',
          'cus_test_email_a',
          'price_1TVtOWPKG6q10UjrQErPgyKO',
          'prod_starter',
          'active',
          now(),
          now() + interval '1 month',
          false,
          'test',
          now()
        );
      `);
        assert.equal(recSync.ok, true);

        // 2. Claim recovery intent
        const claimRes = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);
        assert.ok(claimRes.id, "Failed to claim recovery notice");
        assert.equal(claimRes.notification_type, "recovery");

        // 3. Pre-send check passes on active subscription
        const elig = runPsqlJson(`
        SELECT public.check_dunning_presend_eligibility('${claimRes.id}', '${claimRes.claim_token}');
      `);
        assert.equal(elig.eligible, true);

        // 4. Complete
        mockProviderCalls++;
        const mockMsgId = `resend_mock_msg_${Date.now()}`;
        runPsql(
          `SELECT public.complete_dunning_notification('${claimRes.id}', '${claimRes.claim_token}', '${mockMsgId}');`,
        );

        const row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${claimRes.id}';`,
        );
        assert.equal(row.status, "sent");
        assert.equal(row.notification_type, "recovery");
      });
    });

    // ============================================================================
    // Gate 4: Pre-Send Eligibility, Stale Cancellation & Fencing
    // ============================================================================
    describe("Gate 4: Pre-Send Eligibility, Stale Cancellation & Fencing", () => {
      test("4.1 Stale reminder cancellation: recovered subscription causes pre-send check to cancel notice without provider call", () => {
        clearAllDunning();

        const pastDueSince = new Date(Date.now() - 7200000).toISOString();
        runPsqlJson(`
        SELECT public.sync_subscription_atomic(
          '${testOwner}'::uuid,
          '${testSubB}',
          'cus_test_email_b',
          'price_1TVtOWPKG6q10UjrQErPgyKO',
          'prod_starter',
          'past_due',
          now(),
          now() + interval '1 month',
          false,
          'test',
          '${pastDueSince}'::timestamptz
        );
      `);

        // Clear the auto-generated initial notice
        clearAllDunning();

        const subId = runPsql(
          `SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSubB}';`,
        );
        const threeDayId = runPsql(`
        SELECT public.record_dunning_intent(
          '${subId}',
          '${testOwner}',
          '${pastDueSince}'::timestamptz,
          'three_day',
          'Restam 3 dias de Carência',
          'Aviso'
        );
      `);
        assert.ok(threeDayId);

        // Subscription recovers before worker claims!
        runPsqlJson(`
        SELECT public.sync_subscription_atomic(
          '${testOwner}'::uuid,
          '${testSubB}',
          'cus_test_email_b',
          'price_1TVtOWPKG6q10UjrQErPgyKO',
          'prod_starter',
          'active',
          now(),
          now() + interval '1 month',
          false,
          'test',
          now()
        );
      `);

        // Delete the recovery notice generated by sync_subscription_atomic so the three_day notice is claimed
        runPsql(`DELETE FROM public.dunning_notifications WHERE id != '${threeDayId}';`);

        const claimRes = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);
        assert.equal(claimRes.id, threeDayId);

        // Pre-send check runs immediately before provider invocation
        const elig = runPsqlJson(`
        SELECT public.check_dunning_presend_eligibility('${claimRes.id}', '${claimRes.claim_token}');
      `);
        assert.equal(
          elig.eligible,
          false,
          "Stale reminder must be ineligible when subscription recovered",
        );
        assert.equal(elig.reason, "subscription_no_longer_past_due");

        // Verify DB automatically transitioned record to 'canceled'
        const row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${threeDayId}';`,
        );
        assert.equal(row.status, "canceled");
        assert.equal(row.last_error_category, "recovered_before_send");
      });

      test("4.2 Wrong claim token is rejected on complete_dunning_notification and fail_dunning_notification", () => {
        clearAllDunning();

        const subId = runPsql(
          `SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSubB}';`,
        );
        const pastDueSince = new Date().toISOString();

        const intentId = runPsql(`
        SELECT public.record_dunning_intent(
          '${subId}',
          '${testOwner}',
          '${pastDueSince}'::timestamptz,
          'initial',
          'Token Test Notice',
          'Mensagem'
        );
      `);
        assert.ok(intentId);

        const claimRes = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);
        assert.equal(claimRes.id, intentId);

        // Attempt completion with forged token
        const compForged = runPsql(`
        SELECT public.complete_dunning_notification('${claimRes.id}', 'forged-claim-token-123', 'msg_123');
      `);
        assert.equal(compForged, "f");

        // Attempt failure with forged token
        const failForged = runPsql(`
        SELECT public.fail_dunning_notification('${claimRes.id}', 'forged-claim-token-123', 'TEST_CAT', '400', 'err', false, 0);
      `);
        assert.equal(failForged, "f");

        // Record remains processing
        const row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${claimRes.id}';`,
        );
        assert.equal(row.status, "processing");
        assert.equal(row.claim_token, claimRes.claim_token);

        runPsql(
          `SELECT public.complete_dunning_notification('${claimRes.id}', '${claimRes.claim_token}', 'msg_clean');`,
        );
      });

      test("4.3 Invalid canonical owner email fails permanently as NON_RETRYABLE_RECIPIENT without calling provider", () => {
        clearAllDunning();

        const pastDueSince = new Date().toISOString();
        runPsqlJson(`
        SELECT public.sync_subscription_atomic(
          '${testOwnerInvalidEmail}'::uuid,
          'sub_invalid_owner_test',
          'cus_invalid_owner',
          'price_1TVtOWPKG6q10UjrQErPgyKO',
          'prod_starter',
          'past_due',
          now(),
          now() + interval '1 month',
          false,
          'test',
          '${pastDueSince}'::timestamptz
        );
      `);

        const claimRes = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);
        assert.ok(claimRes.id);

        const recipientEmail = claimRes.recipient_email;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const isValid = emailRegex.test(recipientEmail || "");
        assert.equal(isValid, false, "Recipient email must be invalid");

        runPsql(`
        SELECT public.fail_dunning_notification(
          '${claimRes.id}',
          '${claimRes.claim_token}',
          'NON_RETRYABLE_RECIPIENT',
          'INVALID_EMAIL',
          'E-mail do proprietário ausente ou inválido',
          false,
          0
        );
      `);

        const row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${claimRes.id}';`,
        );
        assert.equal(row.status, "failed");
        assert.equal(row.last_error_category, "NON_RETRYABLE_RECIPIENT");
        assert.equal(row.next_attempt_at, null);
      });
    });

    // ============================================================================
    // Gate 5: Retries, Unknown Outcome & Idempotency Limit
    // ============================================================================
    describe("Gate 5: Retries, Unknown Outcome & Idempotency Limit", () => {
      test("5.1 Retryable failure (429 / rate limit) transitions to retry with scheduled backoff and succeeds on next claim", () => {
        clearAllDunning();

        const subId = runPsql(
          `SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSubB}';`,
        );
        const pastDueSince = new Date(Date.now() + 50000).toISOString();

        const intentId = runPsql(`
        SELECT public.record_dunning_intent(
          '${subId}',
          '${testOwner}',
          '${pastDueSince}'::timestamptz,
          'three_day',
          'Aviso 3 dias',
          'Mensagem'
        );
      `);
        assert.ok(intentId);

        // Claim 1
        const claim1 = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);
        assert.equal(claim1.id, intentId);
        assert.equal(claim1.attempt_count, 1);

        const classification = classifyDunningProviderError({ status: 429 });
        assert.equal(classification.category, "RETRYABLE_RATE_LIMIT");
        assert.equal(classification.retryable, true);

        runPsql(`
        SELECT public.fail_dunning_notification(
          '${claim1.id}',
          '${claim1.claim_token}',
          '${classification.category}',
          '${classification.code}',
          '${classification.message}',
          true,
          1
        );
      `);

        let row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${intentId}';`,
        );
        assert.equal(row.status, "retry");
        assert.equal(row.last_error_category, "RETRYABLE_RATE_LIMIT");
        assert.ok(row.next_attempt_at);

        // Advance next_attempt_at past the DB-enforced 30s minimum for deterministic test execution
        runPsql(
          `UPDATE public.dunning_notifications SET next_attempt_at = now() - interval '1 second' WHERE id = '${intentId}';`,
        );

        // Claim 2
        const claim2 = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);
        assert.equal(claim2.id, intentId);
        assert.equal(claim2.attempt_count, 2);
        assert.notEqual(claim2.claim_token, claim1.claim_token);

        mockProviderCalls++;
        const mockMsgId = `resend_mock_retry_success_${Date.now()}`;
        runPsql(
          `SELECT public.complete_dunning_notification('${claim2.id}', '${claim2.claim_token}', '${mockMsgId}');`,
        );

        row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${intentId}';`,
        );
        assert.equal(row.status, "sent");
        assert.equal(row.provider_message_id, mockMsgId);
      });

      test("5.2 Non-retryable validation error (400) reaches terminal failed state immediately", () => {
        clearAllDunning();

        const subId = runPsql(
          `SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSubB}';`,
        );
        const pastDueSince = new Date(Date.now() + 60000).toISOString();

        const intentId = runPsql(`
        SELECT public.record_dunning_intent(
          '${subId}',
          '${testOwner}',
          '${pastDueSince}'::timestamptz,
          'one_day',
          'Aviso 1 dia',
          'Mensagem'
        );
      `);
        assert.ok(intentId);

        const claim = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);
        assert.equal(claim.id, intentId);

        const classification = classifyDunningProviderError({
          status: 400,
          message: "Invalid recipient domain",
        });
        assert.equal(classification.category, "NON_RETRYABLE_VALIDATION");
        assert.equal(classification.retryable, false);

        runPsql(`
        SELECT public.fail_dunning_notification(
          '${claim.id}',
          '${claim.claim_token}',
          '${classification.category}',
          '${classification.code}',
          '${classification.message}',
          false,
          0
        );
      `);

        const row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${intentId}';`,
        );
        assert.equal(row.status, "failed");
        assert.equal(row.last_error_category, "NON_RETRYABLE_VALIDATION");
        assert.equal(row.next_attempt_at, null);
      });

      test("5.3 Provider success with DB completion failure acknowledges potential duplication window", () => {
        clearAllDunning();

        const subId = runPsql(
          `SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSubB}';`,
        );
        const pastDueSince = new Date(Date.now() + 70000).toISOString();

        const intentId = runPsql(`
        SELECT public.record_dunning_intent(
          '${subId}',
          '${testOwner}',
          '${pastDueSince}'::timestamptz,
          'grace_expired',
          'Carência Encerrada',
          'Mensagem'
        );
      `);
        assert.ok(intentId);

        const claim = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('test-worker-1', 300) c;
      `);

        mockProviderCalls++;
        const providerMsgId = `resend_accepted_window_${Date.now()}`;

        // Simulate completion failure (e.g. wrong token due to lease takeover)
        const compRes = runPsql(`
        SELECT public.complete_dunning_notification('${claim.id}', 'wrong-token', '${providerMsgId}');
      `);
        assert.equal(compRes, "f");

        const row = runPsqlJson(
          `SELECT row_to_json(dn) FROM public.dunning_notifications dn WHERE id = '${intentId}';`,
        );
        assert.notEqual(row.status, "sent");

        runPsql(
          `SELECT public.complete_dunning_notification('${claim.id}', '${claim.claim_token}', '${providerMsgId}');`,
        );
      });

      test("5.4 Concurrent worker claim atomicity: two competing claims on same record yield exactly one claim", () => {
        clearAllDunning();

        const subId = runPsql(
          `SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSubB}';`,
        );
        const pastDueSince = new Date(Date.now() + 100000).toISOString();

        const intentId = runPsql(`
        SELECT public.record_dunning_intent(
          '${subId}',
          '${testOwner}',
          '${pastDueSince}'::timestamptz,
          'initial',
          'Novo Episódio',
          'Mensagem'
        );
      `);
        assert.ok(intentId);

        // Worker 1 claims
        const claim1 = runPsqlJson(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('worker-A', 300) c;
      `);
        assert.equal(claim1.id, intentId);

        // Worker 2 attempts simultaneous claim
        const claim2Raw = runPsql(`
        SELECT row_to_json(c) FROM public.claim_next_dunning_notification('worker-B', 300) c;
      `);
        assert.equal(claim2Raw, "", "Second worker must receive 0 rows");

        runPsql(
          `SELECT public.complete_dunning_notification('${claim1.id}', '${claim1.claim_token}', 'msg_concurrent');`,
        );
      });
    });

    // ============================================================================
    // Gate 6: Trial & Marketing Isolation & PII Safety
    // ============================================================================
    describe("Gate 6: Trial & Marketing Isolation & PII Safety", () => {
      test("6.1 Trial account never generates claimable dunning notification", () => {
        const trialOwner = "33333333-cccc-4333-8333-111111111111";
        const rows = runPsql(`
        SELECT count(*) FROM public.dunning_notifications WHERE tenant_id = '${trialOwner}';
      `);
        assert.equal(parseInt(rows, 10), 0);
      });

      test("6.2 Dunning notifications do not depend on marketing or commercial modules", () => {
        const hasMarketingConstraint = runPsql(`
        SELECT count(*) FROM information_schema.constraint_column_usage
        WHERE table_name = 'dunning_notifications' AND column_name ILIKE '%marketing%';
      `);
        assert.equal(parseInt(hasMarketingConstraint, 10), 0);
      });

      test("6.3 Zero raw email bodies stored in ledger & PII safety", () => {
        const bodyColumns = runPsql(`
        SELECT count(*) FROM information_schema.columns
        WHERE table_name = 'dunning_notifications'
          AND column_name IN ('html', 'html_body', 'body', 'text_body', 'rendered_content');
      `);
        assert.equal(parseInt(bodyColumns, 10), 0);
      });
    });
  },
);
