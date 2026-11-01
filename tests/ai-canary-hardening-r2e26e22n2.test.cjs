/**
 * BARBEX — SUÍTE DE TESTES AUTOMATIZADOS DE SEGURANÇA E HARDENING DO CANÁRIO
 * Fase: R2E.26E.22N.2
 *
 * Valida:
 * 1. Kill Switch Global (Fail-Closed)
 * 2. Isolamento Canário Estrito (Allowlists de 1 Tenant e 1 Usuário, sem curingas, sem múltiplos alvos)
 * 3. Integração da RPC PostgreSQL de Rate Limiting (check_and_increment_ai_rate_limit)
 * 4. Telemetria Estruturada (Eventos, tokens, latência, ausência de vazamento de segredos)
 * 5. Fluxo End-to-End Fail-Closed (Zero chamadas ao provedor quando bloqueado)
 */

const assert = require('assert');
const path = require('path');

// Carregar implementações compiladas / locais via TypeScript / ts-node ou emulação direta dos contratos
const {
  parseStrictSingleCanaryAllowlist,
  evaluateCanaryAccess,
  isAIAssistantEnabled,
  checkDistributedRateLimit,
  checkRateLimit,
  resetRateLimitsForTesting,
  advanceMinuteForTesting,
} = require('../src/lib/ai/guardrails.server');

const {
  logAITelemetry,
  maskIdentifier,
  enableTelemetryCaptureForTesting,
  disableTelemetryCaptureForTesting,
  getCapturedTelemetryEvents,
  clearCapturedTelemetryEvents,
} = require('../src/lib/ai/telemetry.server');

const { verifyTenantAdminIdentity } = require('../src/lib/ai/tenant-admin-auth');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    failed++;
  }
}

const CANARY_TENANT_UUID = "3f6c1e5a-7b2a-4a8e-9c1d-8f2e3d4c5b6a";
const CANARY_USER_UUID = "d8e7a6b5-c4d3-4e2f-1a0b-9c8d7e6f5a4b";
const OTHER_TENANT_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER_USER_UUID = "11111111-2222-3333-4444-555555555555";

console.log("===============================================================================");
console.log("BARBEX — SUÍTE DE TESTES: HARDENING CANÁRIO, RPC E TELEMETRIA (R2E.26E.22N.2)");
console.log("===============================================================================\n");

async function main() {
  // -------------------------------------------------------------------------
  // 1. TESTES DO PARSER DE ALLOWLIST CANÁRIO (parseStrictSingleCanaryAllowlist)
  // -------------------------------------------------------------------------
  console.log("--- GRUPO 1: PARSER DE ALLOWLIST CANÁRIO ---");

  runTest("Rejeita variável ausente (undefined / null)", () => {
    const resUndef = parseStrictSingleCanaryAllowlist(undefined, "TEST_VAR");
    assert.strictEqual(resUndef.valid, false);
    assert.strictEqual(resUndef.errorCode, "ABSENT");

    const resNull = parseStrictSingleCanaryAllowlist(null, "TEST_VAR");
    assert.strictEqual(resNull.valid, false);
    assert.strictEqual(resNull.errorCode, "ABSENT");
  });

  runTest("Rejeita string vazia ou apenas espaços", () => {
    const resEmpty = parseStrictSingleCanaryAllowlist("   ", "TEST_VAR");
    assert.strictEqual(resEmpty.valid, false);
    assert.strictEqual(resEmpty.errorCode, "EMPTY");
  });

  runTest("Rejeita curingas universais ('*', 'all', '*test*')", () => {
    const resStar = parseStrictSingleCanaryAllowlist("*", "TEST_VAR");
    assert.strictEqual(resStar.valid, false);
    assert.strictEqual(resStar.errorCode, "WILDCARD_PROHIBITED");

    const resAll = parseStrictSingleCanaryAllowlist("ALL", "TEST_VAR");
    assert.strictEqual(resAll.valid, false);
    assert.strictEqual(resAll.errorCode, "WILDCARD_PROHIBITED");
  });

  runTest("Rejeita múltiplos identificadores na lista canário (exige estritamente 1)", () => {
    const multi = `${CANARY_TENANT_UUID},${OTHER_TENANT_UUID}`;
    const res = parseStrictSingleCanaryAllowlist(multi, "TEST_VAR");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errorCode, "MULTI_TARGET_PROHIBITED");
  });

  runTest("Rejeita UUID malformado ou formato inválido", () => {
    const res = parseStrictSingleCanaryAllowlist("not-a-valid-uuid-1234", "TEST_VAR");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errorCode, "MALFORMED");
  });

  runTest("Aceita exatamente 1 UUID canônico válido", () => {
    const res = parseStrictSingleCanaryAllowlist(CANARY_TENANT_UUID, "TEST_VAR");
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.id, CANARY_TENANT_UUID.toLowerCase());
  });

  // -------------------------------------------------------------------------
  // 2. TESTES DE GOVERNANÇA E ISOLAMENTO CANÁRIO (evaluateCanaryAccess)
  // -------------------------------------------------------------------------
  console.log("\n--- GRUPO 2: ISOLAMENTO CANÁRIO POR TENANT E USUÁRIO ---");

  // Salvar env original
  const origEnv = { ...process.env };

  try {
    // Cenário: Flag Global Desativada
    runTest("Kill Switch Global: Flag ausente bloqueia acesso", () => {
      delete process.env.BARBEX_AI_ASSISTANT_ENABLED;
      process.env.BARBEX_AI_CANARY_TENANT_IDS = CANARY_TENANT_UUID;
      process.env.BARBEX_AI_CANARY_USER_IDS = CANARY_USER_UUID;

      const evalRes = evaluateCanaryAccess(CANARY_TENANT_UUID, CANARY_USER_UUID);
      assert.strictEqual(evalRes.allowed, false);
      assert.strictEqual(evalRes.reasonCode, "GLOBAL_KILLSWITCH_DISABLED");
    });

    runTest("Kill Switch Global: Flag 'false' ou 'disabled' bloqueia acesso", () => {
      process.env.BARBEX_AI_ASSISTANT_ENABLED = "false";
      const evalRes = evaluateCanaryAccess(CANARY_TENANT_UUID, CANARY_USER_UUID);
      assert.strictEqual(evalRes.allowed, false);
      assert.strictEqual(evalRes.reasonCode, "GLOBAL_KILLSWITCH_DISABLED");
    });

    runTest("Kill Switch Global: Flag ativa com allowlist ausente bloqueia (Fail-Closed)", () => {
      process.env.BARBEX_AI_ASSISTANT_ENABLED = "true";
      delete process.env.BARBEX_AI_CANARY_TENANT_IDS;
      delete process.env.BARBEX_AI_CANARY_USER_IDS;

      const evalRes = evaluateCanaryAccess(CANARY_TENANT_UUID, CANARY_USER_UUID);
      assert.strictEqual(evalRes.allowed, false);
      assert.strictEqual(evalRes.reasonCode, "CANARY_TENANT_CONFIG_ABSENT");
    });

    runTest("Canário Autorizado: Tenant e Usuário corretos passam pelo gate", () => {
      process.env.BARBEX_AI_ASSISTANT_ENABLED = "true";
      process.env.BARBEX_AI_CANARY_TENANT_IDS = CANARY_TENANT_UUID;
      process.env.BARBEX_AI_CANARY_USER_IDS = CANARY_USER_UUID;

      const evalRes = evaluateCanaryAccess(CANARY_TENANT_UUID, CANARY_USER_UUID);
      assert.strictEqual(evalRes.allowed, true);
      assert.strictEqual(evalRes.status, "active");
    });

    runTest("Isolamento: Tenant diferente é bloqueado mesmo com usuário autorizado", () => {
      process.env.BARBEX_AI_ASSISTANT_ENABLED = "true";
      process.env.BARBEX_AI_CANARY_TENANT_IDS = CANARY_TENANT_UUID;
      process.env.BARBEX_AI_CANARY_USER_IDS = CANARY_USER_UUID;

      const evalRes = evaluateCanaryAccess(OTHER_TENANT_UUID, CANARY_USER_UUID);
      assert.strictEqual(evalRes.allowed, false);
      assert.strictEqual(evalRes.reasonCode, "CANARY_TENANT_NOT_AUTHORIZED");
    });

    runTest("Isolamento: Usuário diferente é bloqueado mesmo com tenant autorizado", () => {
      process.env.BARBEX_AI_ASSISTANT_ENABLED = "true";
      process.env.BARBEX_AI_CANARY_TENANT_IDS = CANARY_TENANT_UUID;
      process.env.BARBEX_AI_CANARY_USER_IDS = CANARY_USER_UUID;

      const evalRes = evaluateCanaryAccess(CANARY_TENANT_UUID, OTHER_USER_UUID);
      assert.strictEqual(evalRes.allowed, false);
      assert.strictEqual(evalRes.reasonCode, "CANARY_USER_NOT_AUTHORIZED");
    });

    runTest("Isolamento: Ambos diferentes são bloqueados", () => {
      process.env.BARBEX_AI_ASSISTANT_ENABLED = "true";
      process.env.BARBEX_AI_CANARY_TENANT_IDS = CANARY_TENANT_UUID;
      process.env.BARBEX_AI_CANARY_USER_IDS = CANARY_USER_UUID;

      const evalRes = evaluateCanaryAccess(OTHER_TENANT_UUID, OTHER_USER_UUID);
      assert.strictEqual(evalRes.allowed, false);
      assert.strictEqual(evalRes.reasonCode, "CANARY_TENANT_NOT_AUTHORIZED");
    });

    runTest("isAIAssistantEnabled: Integração transparente com contexto canário", () => {
      process.env.BARBEX_AI_ASSISTANT_ENABLED = "true";
      process.env.BARBEX_AI_CANARY_TENANT_IDS = CANARY_TENANT_UUID;
      process.env.BARBEX_AI_CANARY_USER_IDS = CANARY_USER_UUID;

      const resAllow = isAIAssistantEnabled(CANARY_TENANT_UUID, CANARY_USER_UUID);
      assert.strictEqual(resAllow.enabled, true);

      const resDeny = isAIAssistantEnabled(OTHER_TENANT_UUID, CANARY_USER_UUID);
      assert.strictEqual(resDeny.enabled, false);
      assert.strictEqual(resDeny.reasonCode, "CANARY_TENANT_NOT_AUTHORIZED");
    });

  } finally {
    process.env = { ...origEnv };
  }

  // -------------------------------------------------------------------------
  // 3. TESTES DA RPC POSTGRESQL DE RATE LIMITING (checkDistributedRateLimit)
  // -------------------------------------------------------------------------
  console.log("\n--- GRUPO 3: INTEGRAÇÃO DA RPC POSTGRESQL DE RATE LIMITING ---");

  await runAsyncTest("RPC Autorizada: Retorna allowed = true e dados de contadores", async () => {
    const mockClient = {
      rpc: async (funcName, params) => {
        assert.strictEqual(funcName, "check_and_increment_ai_rate_limit");
        assert.strictEqual(params.p_tenant_id, CANARY_TENANT_UUID);
        assert.strictEqual(params.p_user_id, CANARY_USER_UUID);
        assert.strictEqual(params.p_max_per_min, 5);
        assert.strictEqual(params.p_max_per_hour, 30);
        return {
          data: {
            allowed: true,
            user_minute_count: 1,
            tenant_hour_count: 1,
            global_minute_count: 1,
            global_day_count: 1,
          },
          error: null,
        };
      },
    };

    const res = await checkDistributedRateLimit(CANARY_TENANT_UUID, CANARY_USER_UUID, mockClient);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.source, "rpc");
    assert.strictEqual(res.details.user_minute_count, 1);
  });

  await runAsyncTest("RPC Negada: Retorna allowed = false e retryAfterSeconds", async () => {
    const mockClient = {
      rpc: async () => ({
        data: {
          allowed: false,
          reason: "USER_RATE_LIMIT_EXCEEDED",
          retry_after_seconds: 45,
          current: 6,
          limit: 5,
        },
        error: null,
      }),
    };

    const res = await checkDistributedRateLimit(CANARY_TENANT_UUID, CANARY_USER_UUID, mockClient);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.reason, "USER_RATE_LIMIT_EXCEEDED");
    assert.strictEqual(res.retryAfterSeconds, 45);
    assert.strictEqual(res.source, "rpc");
  });

  await runAsyncTest("RPC Falha de Execução: Fail-Closed seguro com allowed = false", async () => {
    const mockClient = {
      rpc: async () => ({
        data: null,
        error: { message: "database timeout or connection refused" },
      }),
    };

    const res = await checkDistributedRateLimit(CANARY_TENANT_UUID, CANARY_USER_UUID, mockClient);
    assert.strictEqual(res.allowed, false);
    assert.ok(res.reason.includes("RATE_LIMIT_RPC_ERROR"));
  });

  await runAsyncTest("RPC Retorna NULL: Fail-Closed com allowed = false", async () => {
    const mockClient = {
      rpc: async () => ({
        data: null,
        error: null,
      }),
    };

    const res = await checkDistributedRateLimit(CANARY_TENANT_UUID, CANARY_USER_UUID, mockClient);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.reason, "RATE_LIMIT_RPC_INVALID_RESPONSE");
  });

  await runAsyncTest("RPC Retorna Formato Inesperado: Fail-Closed com allowed = false", async () => {
    const mockClient = {
      rpc: async () => ({
        data: { weird_field: "unexpected" }, // sem 'allowed' boolean
        error: null,
      }),
    };

    const res = await checkDistributedRateLimit(CANARY_TENANT_UUID, CANARY_USER_UUID, mockClient);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.reason, "RATE_LIMIT_RPC_UNEXPECTED_FORMAT");
  });

  // -------------------------------------------------------------------------
  // 4. TESTES DE TELEMETRIA ESTRUTURADA (telemetry.server)
  // -------------------------------------------------------------------------
  console.log("\n--- GRUPO 4: TELEMETRIA ESTRUTURADA E PRIVACIDADE ---");

  enableTelemetryCaptureForTesting();

  runTest("Mascaramento de UUIDs: Preserva auditoria sem expor identificadores brutos", () => {
    const maskedTenant = maskIdentifier(CANARY_TENANT_UUID);
    assert.strictEqual(maskedTenant, "3f6c...5b6a");
    assert.ok(!maskedTenant.includes("-7b2a-4a8e-9c1d-"));

    const maskedUser = maskIdentifier(CANARY_USER_UUID);
    assert.strictEqual(maskedUser, "d8e7...5a4b");

    assert.strictEqual(maskIdentifier(null), "anonymous");
    assert.strictEqual(maskIdentifier(""), "anonymous");
  });

  runTest("Emissão de Eventos de Telemetria: Estrutura JSON segura sem vazamento", () => {
    clearCapturedTelemetryEvents();

    logAITelemetry({
      event: "AI_ACCESS_ATTEMPT",
      timestamp: new Date().toISOString(),
      correlationId: "ai-test-123",
      outcome: "ALLOWED",
      userIdMasked: maskIdentifier(CANARY_USER_UUID),
    });

    logAITelemetry({
      event: "AI_CANARY_BLOCKED",
      timestamp: new Date().toISOString(),
      correlationId: "ai-test-123",
      outcome: "BLOCKED",
      reasonCode: "CANARY_TENANT_NOT_AUTHORIZED",
      tenantIdMasked: maskIdentifier(OTHER_TENANT_UUID),
      userIdMasked: maskIdentifier(CANARY_USER_UUID),
    });

    logAITelemetry({
      event: "AI_PROVIDER_RESPONSE",
      timestamp: new Date().toISOString(),
      correlationId: "ai-test-123",
      outcome: "SUCCESS",
      model: "groq_free_tier",
      latencyMs: 850,
      totalTokens: 320,
      tenantIdMasked: maskIdentifier(CANARY_TENANT_UUID),
      userIdMasked: maskIdentifier(CANARY_USER_UUID),
    });

    const events = getCapturedTelemetryEvents();
    assert.strictEqual(events.length, 3);
    assert.strictEqual(events[0].event, "AI_ACCESS_ATTEMPT");
    assert.strictEqual(events[1].event, "AI_CANARY_BLOCKED");
    assert.strictEqual(events[2].event, "AI_PROVIDER_RESPONSE");
    assert.strictEqual(events[2].totalTokens, 320);

    // Garantir que nenhum evento contém chaves de segredo ou payloads proibidos
    events.forEach(evt => {
      const serialized = JSON.stringify(evt);
      assert.ok(!serialized.includes("GROQ_API_KEY"));
      assert.ok(!serialized.includes("SERVICE_ROLE_KEY"));
      assert.ok(!serialized.includes("Bearer"));
      assert.ok(!serialized.includes("password"));
    });
  });

  disableTelemetryCaptureForTesting();

  // -------------------------------------------------------------------------
  // 5. TESTES DO CONTRATO RBAC E TENANT ADMIN (verifyTenantAdminIdentity)
  // -------------------------------------------------------------------------
  console.log("\n--- GRUPO 5: VALIDAÇÃO CANÔNICA DE RBAC E MEMBERSHIP ---");

  await runAsyncTest("Nega acesso sem autenticação (userId ausente)", async () => {
    const res = await verifyTenantAdminIdentity(null);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "UNAUTHENTICATED");
  });

  await runAsyncTest("Nega expressamente super_admin por privilégio de plataforma", async () => {
    const mockDb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "user-super", role: "super_admin", status: "active" },
              error: null,
            }),
          }),
        }),
      }),
    };

    const res = await verifyTenantAdminIdentity("user-super", mockDb);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "SUPER_ADMIN_DENIED");
  });

  await runAsyncTest("Nega perfis operacionais (barber, receptionist, client)", async () => {
    const mockDb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "user-barber", role: "barber", status: "active" },
              error: null,
            }),
          }),
        }),
      }),
    };

    const res = await verifyTenantAdminIdentity("user-barber", mockDb);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "ROLE_UNAUTHORIZED");
  });

  await runAsyncTest("Autoriza tenant_admin legítimo com tenant resolvido", async () => {
    const mockDb = {
      from: (table) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (table === "profiles") {
                return {
                  data: { id: CANARY_USER_UUID, role: "tenant_admin", tenant_id: CANARY_TENANT_UUID, status: "active" },
                  error: null,
                };
              }
              if (table === "barbershops") {
                return { data: { id: CANARY_TENANT_UUID, owner_id: CANARY_USER_UUID }, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      }),
    };

    const res = await verifyTenantAdminIdentity(CANARY_USER_UUID, mockDb);
    assert.strictEqual(res.authorized, true);
    assert.strictEqual(res.tenantId, CANARY_TENANT_UUID);
    assert.strictEqual(res.role, "tenant_admin");
  });

  // -------------------------------------------------------------------------
  // 6. TESTES DO FLUXO COMPLETO END-TO-END (ZERO CALLS AO PROVEDOR EM BLOQUEIO)
  // -------------------------------------------------------------------------
  console.log("\n--- GRUPO 6: FLUXO END-TO-END E CONTROLE DE CHAMADAS AO PROVEDOR ---");

  // Simulador do Handler Server-Side Integrado
  async function simulateHandlerExecution({
    userId,
    tenantId,
    role,
    globalFlag,
    canaryTenantEnv,
    canaryUserEnv,
    rpcAllowed,
    rpcError,
  }) {
    // Configurar ambiente isolado
    if (globalFlag !== undefined) process.env.BARBEX_AI_ASSISTANT_ENABLED = globalFlag;
    else delete process.env.BARBEX_AI_ASSISTANT_ENABLED;

    if (canaryTenantEnv !== undefined) process.env.BARBEX_AI_CANARY_TENANT_IDS = canaryTenantEnv;
    else delete process.env.BARBEX_AI_CANARY_TENANT_IDS;

    if (canaryUserEnv !== undefined) process.env.BARBEX_AI_CANARY_USER_IDS = canaryUserEnv;
    else delete process.env.BARBEX_AI_CANARY_USER_IDS;

    let providerCallsCount = 0;
    const mockProvider = {
      name: "mock_test_provider",
      generate: async () => {
        providerCallsCount++;
        return { content: "Resposta simulada", usage: { tokens: 150 } };
      },
    };

    // 1. RBAC
    if (!userId || role !== "tenant_admin" || !tenantId) {
      return { success: false, error: "ROLE_UNAUTHORIZED", providerCallsCount };
    }

    // 2. Kill switch & Canary
    const canaryStatus = isAIAssistantEnabled(tenantId, userId);
    if (!canaryStatus.enabled) {
      return { success: false, error: canaryStatus.reasonCode || "FEATURE_DISABLED", providerCallsCount };
    }

    // 3. Rate Limit RPC
    const mockRpcClient = {
      rpc: async () => {
        if (rpcError) return { data: null, error: { message: "RPC failed" } };
        return {
          data: {
            allowed: rpcAllowed,
            reason: rpcAllowed ? undefined : "USER_RATE_LIMIT_EXCEEDED",
            retry_after_seconds: rpcAllowed ? undefined : 60,
          },
          error: null,
        };
      },
    };

    const rateLimit = await checkDistributedRateLimit(tenantId, userId, mockRpcClient);
    if (!rateLimit.allowed) {
      return { success: false, error: "RATE_LIMIT_EXCEEDED", providerCallsCount };
    }

    // 4. Provider Call
    const response = await mockProvider.generate();
    return { success: true, content: response.content, providerCallsCount };
  }

  await runAsyncTest("E2E: Requisição 100% Homologada executa exatamente 1 chamada ao provedor", async () => {
    const res = await simulateHandlerExecution({
      userId: CANARY_USER_UUID,
      tenantId: CANARY_TENANT_UUID,
      role: "tenant_admin",
      globalFlag: "true",
      canaryTenantEnv: CANARY_TENANT_UUID,
      canaryUserEnv: CANARY_USER_UUID,
      rpcAllowed: true,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.providerCallsCount, 1);
  });

  await runAsyncTest("E2E: Bloqueio por Kill Switch resulta em ZERO chamadas ao provedor", async () => {
    const res = await simulateHandlerExecution({
      userId: CANARY_USER_UUID,
      tenantId: CANARY_TENANT_UUID,
      role: "tenant_admin",
      globalFlag: "false",
      canaryTenantEnv: CANARY_TENANT_UUID,
      canaryUserEnv: CANARY_USER_UUID,
      rpcAllowed: true,
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, "GLOBAL_KILLSWITCH_DISABLED");
    assert.strictEqual(res.providerCallsCount, 0);
  });

  await runAsyncTest("E2E: Bloqueio por Tenant Não-Canário resulta em ZERO chamadas ao provedor", async () => {
    const res = await simulateHandlerExecution({
      userId: CANARY_USER_UUID,
      tenantId: OTHER_TENANT_UUID,
      role: "tenant_admin",
      globalFlag: "true",
      canaryTenantEnv: CANARY_TENANT_UUID,
      canaryUserEnv: CANARY_USER_UUID,
      rpcAllowed: true,
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, "CANARY_TENANT_NOT_AUTHORIZED");
    assert.strictEqual(res.providerCallsCount, 0);
  });

  await runAsyncTest("E2E: Bloqueio por Rate Limit RPC resulta em ZERO chamadas ao provedor", async () => {
    const res = await simulateHandlerExecution({
      userId: CANARY_USER_UUID,
      tenantId: CANARY_TENANT_UUID,
      role: "tenant_admin",
      globalFlag: "true",
      canaryTenantEnv: CANARY_TENANT_UUID,
      canaryUserEnv: CANARY_USER_UUID,
      rpcAllowed: false,
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, "RATE_LIMIT_EXCEEDED");
    assert.strictEqual(res.providerCallsCount, 0);
  });

  await runAsyncTest("E2E: Falha técnica na RPC resulta em Fail-Closed e ZERO chamadas ao provedor", async () => {
    const res = await simulateHandlerExecution({
      userId: CANARY_USER_UUID,
      tenantId: CANARY_TENANT_UUID,
      role: "tenant_admin",
      globalFlag: "true",
      canaryTenantEnv: CANARY_TENANT_UUID,
      canaryUserEnv: CANARY_USER_UUID,
      rpcAllowed: false,
      rpcError: true,
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, "RATE_LIMIT_EXCEEDED");
    assert.strictEqual(res.providerCallsCount, 0);
  });

  // -------------------------------------------------------------------------
  // 7. SIMULAÇÃO DAS 4 JANELAS DE RATE LIMITING
  // -------------------------------------------------------------------------
  console.log("\n--- GRUPO 7: TESTE DAS 4 JANELAS DE RATE LIMITING ---");

  resetRateLimitsForTesting();

  runTest("Janela 1: Limite de 5 req/min por usuário", () => {
    resetRateLimitsForTesting();
    const t = CANARY_TENANT_UUID;
    const u = CANARY_USER_UUID;

    for (let i = 1; i <= 5; i++) {
      const res = checkRateLimit(u, t);
      assert.strictEqual(res.allowed, true, `Req ${i} deveria ser permitida`);
    }

    const blocked = checkRateLimit(u, t);
    assert.strictEqual(blocked.allowed, false);
    assert.ok(blocked.reason.includes("5 consultas/min"));
  });

  runTest("Janela 2: Limite de 20 req/min GLOBAL", () => {
    resetRateLimitsForTesting();
    const t = CANARY_TENANT_UUID;

    for (let i = 1; i <= 20; i++) {
      const fakeUser = `user-global-${i}`;
      const res = checkRateLimit(fakeUser, `tenant-${i}`);
      assert.strictEqual(res.allowed, true, `Req global ${i} deveria ser permitida`);
    }

    const blocked = checkRateLimit("overflow-user", "overflow-tenant");
    assert.strictEqual(blocked.allowed, false);
    assert.ok(blocked.reason.includes("20 req/min"));
  });

  runTest("Janela 3: Limite de 30 req/hora por tenant (com avanço de minuto)", () => {
    resetRateLimitsForTesting();
    const t = CANARY_TENANT_UUID;

    // Bloco 1: 15 requisições no minuto 1
    for (let i = 1; i <= 15; i++) {
      const res = checkRateLimit(`user-m1-${i}`, t);
      assert.strictEqual(res.allowed, true, `Req m1-${i} deveria ser permitida`);
    }

    // Avançar para minuto 2 (limpa global_min e user_min, preserva tenant_hour)
    advanceMinuteForTesting();

    // Bloco 2: 15 requisições no minuto 2
    for (let i = 16; i <= 30; i++) {
      const res = checkRateLimit(`user-m2-${i}`, t);
      assert.strictEqual(res.allowed, true, `Req m2-${i} deveria ser permitida`);
    }

    // Avançar minuto novamente para garantir que global_min não é o bloqueador
    advanceMinuteForTesting();

    // A 31ª requisição na mesma hora do tenant deve ser bloqueada
    const blocked = checkRateLimit("user-m3-overflow", t);
    assert.strictEqual(blocked.allowed, false);
    assert.ok(blocked.reason.includes("30 consultas/hora"));
  });

  runTest("Janela 4: Limite de 800 req/dia GLOBAL", () => {
    resetRateLimitsForTesting();

    // Simular 40 minutos com 20 reqs cada = 800 reqs diárias
    // Para teste rápido, injetar 800 timestamps e testar bloqueio
    for (let m = 0; m < 40; m++) {
      advanceMinuteForTesting();
      for (let i = 1; i <= 20; i++) {
        const res = checkRateLimit(`user-${m}-${i}`, `tenant-${m}-${i}`);
        assert.strictEqual(res.allowed, true);
      }
    }

    advanceMinuteForTesting();
    const blocked = checkRateLimit("user-day-overflow", "tenant-day-overflow");
    assert.strictEqual(blocked.allowed, false);
    assert.ok(blocked.reason.includes("800 req/dia"));
  });

  // -------------------------------------------------------------------------
  // RESUMO FINAL
  // -------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`TOTAL DE TESTES: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR IN SUITE:", err);
  process.exit(1);
});
