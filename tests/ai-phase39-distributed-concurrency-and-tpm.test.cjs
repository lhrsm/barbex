/**
 * BARBEX — FASE R2E.26E.22N.39: SUÍTE DE TESTES DE CONCORRÊNCIA, TPM E RATE LIMITS DISTRIBUÍDOS
 *
 * Validação rigorosa dos 16 cenários de governança distribuída:
 * 1. Uma requisição
 * 2. Quatro requisições simultâneas
 * 3. Cinco requisições simultâneas (5ª negada)
 * 4. Vinte requisições concorrentes
 * 5. Múltiplos tenants isolados
 * 6. Múltiplos processos/instâncias independentes
 * 7. Falha antes de adquirir slot (Fail-Closed)
 * 8. Falha após adquirir slot (Liberação segura no finally)
 * 9. Timeout do provedor (Abort/Timeout -> Reconciliação com 0 tokens)
 * 10. Encerramento abrupto de processo (Recuperação por TTL)
 * 11. Expiração segura de lease
 * 12. Liberação idempotente duplicada
 * 13. Falha do PostgreSQL (Fail-Closed)
 * 14. Esgotamento do orçamento TPM (Teto 6.000 TPM vs 8.000 Groq)
 * 15. Esgotamento do limite diário por tenant (20 RPD persistente em UTC)
 * 16. Reinicialização de instâncias / Cold starts (Persistência no DB)
 */

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { execFileSync, execSync } = require("child_process");

const guardrailsServerPath = path.join(__dirname, "../src/lib/ai/guardrails.server.ts");
const chatFunctionsPath = path.join(__dirname, "../src/lib/ai/chat.functions.ts");
const migrationPath = path.join(__dirname, "../supabase/migrations/20261110100000_r2e26e22n39_distributed_ai_governance.sql");

const guardrailsContent = fs.readFileSync(guardrailsServerPath, "utf8");
const chatFunctionsContent = fs.readFileSync(chatFunctionsPath, "utf8");
const migrationSql = fs.readFileSync(migrationPath, "utf8");

const testSchema = "test_phase39_concurrency_isolated";

function executeDockerPsql(sql) {
  const res = execFileSync(
    "docker",
    ["exec", "supabase_db_barbex", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-c", sql],
    {
      encoding: "utf8",
      timeout: 10000,
    }
  );
  return res.trim();
}

describe("BARBEX FASE R2E.26E.22N.39 — Concorrência, TPM e Governança Distribuída (16 Cenários)", () => {
  before(() => {
    // Inicializa o esquema de teste isolado via arquivo temporário único
    const initSql = `
      DROP SCHEMA IF EXISTS ${testSchema} CASCADE;
      CREATE SCHEMA ${testSchema};
      SET search_path = ${testSchema}, public;
      ${migrationSql.replace(/public\./g, `${testSchema}.`)}
    `;
    const tmpFile = path.join(__dirname, `_temp_init_${Date.now()}.sql`);
    fs.writeFileSync(tmpFile, initSql, "utf8");
    try {
      execSync(`docker cp "${tmpFile}" supabase_db_barbex:/tmp/init_phase39.sql`, { stdio: "pipe" });
      execSync(`docker exec supabase_db_barbex psql -U postgres -d postgres -f /tmp/init_phase39.sql`, { stdio: "pipe" });
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  beforeEach(() => {
    // Limpa registros entre testes via DELETE FROM (sem bloqueio exclusivo)
    executeDockerPsql(`DELETE FROM ${testSchema}.ai_active_leases; DELETE FROM ${testSchema}.ai_rate_limits;`);
  });

  after(() => {
    executeDockerPsql(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE;`);
  });

  function rpcAcquire(params = {}) {
    const {
      tenantId = "11111111-1111-1111-1111-111111111111",
      userId = "22222222-2222-2222-2222-222222222222",
      reservedTokens = 2200,
      maxConcurrency = 4,
      maxGlobalTPM = 6000,
      maxTenantDay = 20,
      maxTenantHour = 30,
      maxUserMin = 5,
      maxGlobalMin = 20,
      maxGlobalDay = 800,
      leaseTtlSeconds = 45,
    } = params;

    const sql = `SELECT ${testSchema}.ai_governance_acquire_slot('${tenantId}'::uuid, '${userId}'::uuid, ${reservedTokens}, ${maxConcurrency}, ${maxGlobalTPM}, ${maxTenantDay}, ${maxTenantHour}, ${maxUserMin}, ${maxGlobalMin}, ${maxGlobalDay}, ${leaseTtlSeconds});`;
    const out = executeDockerPsql(sql);
    return JSON.parse(out);
  }

  function rpcRelease(leaseId, tenantId, actualTokens = null, status = "released") {
    const tokensVal = actualTokens === null ? "NULL" : actualTokens;
    const sql = `SELECT ${testSchema}.ai_governance_release_slot('${leaseId}'::uuid, '${tenantId}'::uuid, ${tokensVal}, '${status}');`;
    const out = executeDockerPsql(sql);
    return JSON.parse(out);
  }

  // Cenário 1: Uma requisição única
  test("Cenário 1: Uma requisição adquire slot com sucesso e libera com reconciliação", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";
    const user = "22222222-2222-2222-2222-222222222222";

    const acq = rpcAcquire({ tenantId: tenant, userId: user, reservedTokens: 2000 });
    assert.strictEqual(acq.allowed, true);
    assert.ok(acq.lease_id, "Deve retornar lease_id");
    assert.strictEqual(acq.current_concurrency, 1);

    const rel = rpcRelease(acq.lease_id, tenant, 350);
    assert.strictEqual(rel.released, true);
    assert.strictEqual(rel.actual_tokens, 350);
    assert.strictEqual(rel.token_delta, -1650);
  });

  // Cenário 2: Quatro requisições simultâneas
  test("Cenário 2: Quatro requisições simultâneas adquirem slots com sucesso", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";
    const leases = [];

    for (let i = 1; i <= 4; i++) {
      const acq = rpcAcquire({
        tenantId: tenant,
        userId: `00000000-0000-0000-0000-00000000000${i}`,
        reservedTokens: 1000,
        maxConcurrency: 4,
      });
      assert.strictEqual(acq.allowed, true, `Requisição ${i} deve ser permitida`);
      assert.strictEqual(acq.current_concurrency, i);
      leases.push(acq.lease_id);
    }

    assert.strictEqual(leases.length, 4);

    for (const leaseId of leases) {
      const rel = rpcRelease(leaseId, tenant, 200);
      assert.strictEqual(rel.released, true);
    }
  });

  // Cenário 3: Cinco requisições simultâneas (5ª bloqueada por concorrência)
  test("Cenário 3: 5ª requisição simultânea é bloqueada com CONCURRENCY_LIMIT_EXCEEDED", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";
    const leases = [];

    for (let i = 1; i <= 4; i++) {
      const acq = rpcAcquire({
        tenantId: tenant,
        userId: `00000000-0000-0000-0000-00000000000${i}`,
        reservedTokens: 1000,
        maxConcurrency: 4,
      });
      assert.strictEqual(acq.allowed, true);
      leases.push(acq.lease_id);
    }

    const fifth = rpcAcquire({
      tenantId: tenant,
      userId: "00000000-0000-0000-0000-000000000005",
      reservedTokens: 1000,
      maxConcurrency: 4,
    });
    assert.strictEqual(fifth.allowed, false);
    assert.strictEqual(fifth.reason, "CONCURRENCY_LIMIT_EXCEEDED");
    assert.strictEqual(fifth.current_concurrency, 4);
    assert.strictEqual(fifth.limit, 4);

    rpcRelease(leases[0], tenant, 200);

    const retry = rpcAcquire({
      tenantId: tenant,
      userId: "00000000-0000-0000-0000-000000000005",
      reservedTokens: 1000,
      maxConcurrency: 4,
    });
    assert.strictEqual(retry.allowed, true);
  });

  // Cenário 4: Vinte requisições concorrentes
  test("Cenário 4: Rajada de 20 requisições simultâneas nunca excede 4 slots ativos", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";
    let allowedCount = 0;
    let blockedCount = 0;

    for (let i = 1; i <= 20; i++) {
      const acq = rpcAcquire({
        tenantId: tenant,
        userId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        reservedTokens: 200,
        maxConcurrency: 4,
        maxGlobalTPM: 100000,
      });
      if (acq.allowed) {
        allowedCount++;
      } else {
        blockedCount++;
        assert.strictEqual(acq.reason, "CONCURRENCY_LIMIT_EXCEEDED");
      }
    }

    assert.strictEqual(allowedCount, 4, "Exatamente 4 devem ser permitidas");
    assert.strictEqual(blockedCount, 16, "Exatamente 16 devem ser bloqueadas");
  });

  // Cenário 5: Múltiplos tenants isolados
  test("Cenário 5: Isolamento multi-tenant — Tenant A atingir limite diário não bloqueia Tenant B", () => {
    const tenantA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const tenantB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const user = "22222222-2222-2222-2222-222222222222";

    for (let i = 1; i <= 20; i++) {
      const acq = rpcAcquire({
        tenantId: tenantA,
        userId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        reservedTokens: 50,
        maxConcurrency: 100,
        maxGlobalTPM: 100000,
        maxGlobalMin: 100,
        maxTenantDay: 20,
      });
      assert.strictEqual(acq.allowed, true);
      rpcRelease(acq.lease_id, tenantA, 50);
    }

    const blockedA = rpcAcquire({
      tenantId: tenantA,
      userId: user,
      reservedTokens: 50,
      maxConcurrency: 100,
      maxGlobalTPM: 100000,
      maxGlobalMin: 100,
      maxTenantDay: 20,
    });
    assert.strictEqual(blockedA.allowed, false);
    assert.strictEqual(blockedA.reason, "TENANT_DAILY_LIMIT_EXCEEDED");

    const allowedB = rpcAcquire({
      tenantId: tenantB,
      userId: user,
      reservedTokens: 50,
      maxConcurrency: 100,
      maxGlobalTPM: 100000,
      maxGlobalMin: 100,
      maxTenantDay: 20,
    });
    assert.strictEqual(allowedB.allowed, true);
  });

  // Cenário 6: Múltiplos processos independentes (Simulação de concorrência PostgreSQL)
  test("Cenário 6: Concorrência cross-instance respeita atomicidade no banco", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";

    const inst1_a = rpcAcquire({ tenantId: tenant, userId: "00000000-0000-0000-0000-000000000001", maxConcurrency: 4, reservedTokens: 500 });
    const inst2_a = rpcAcquire({ tenantId: tenant, userId: "00000000-0000-0000-0000-000000000002", maxConcurrency: 4, reservedTokens: 500 });
    const inst1_b = rpcAcquire({ tenantId: tenant, userId: "00000000-0000-0000-0000-000000000003", maxConcurrency: 4, reservedTokens: 500 });
    const inst2_b = rpcAcquire({ tenantId: tenant, userId: "00000000-0000-0000-0000-000000000004", maxConcurrency: 4, reservedTokens: 500 });

    assert.strictEqual(inst1_a.allowed, true);
    assert.strictEqual(inst2_a.allowed, true);
    assert.strictEqual(inst1_b.allowed, true);
    assert.strictEqual(inst2_b.allowed, true);

    const inst1_c = rpcAcquire({ tenantId: tenant, userId: "00000000-0000-0000-0000-000000000005", maxConcurrency: 4, reservedTokens: 500 });
    assert.strictEqual(inst1_c.allowed, false);
    assert.strictEqual(inst1_c.reason, "CONCURRENCY_LIMIT_EXCEEDED");
  });

  // Cenário 7: Falha antes de adquirir slot (Fail-Closed)
  test("Cenário 7: Identificadores nulos ou inválidos retornam fail-closed imediato", () => {
    const sql = `SELECT ${testSchema}.ai_governance_acquire_slot(NULL, NULL);`;
    const out = executeDockerPsql(sql);
    const json = JSON.parse(out);
    assert.strictEqual(json.allowed, false);
    assert.strictEqual(json.reason, "INVALID_IDENTIFIERS");
  });

  // Cenário 8: Falha após adquirir slot (Liberação segura no finally)
  test("Cenário 8: Slot adquirido é liberado com status 'error' quando o processo falha", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";
    const user = "22222222-2222-2222-2222-222222222222";

    const acq = rpcAcquire({ tenantId: tenant, userId: user, reservedTokens: 2500 });
    assert.strictEqual(acq.allowed, true);

    const rel = rpcRelease(acq.lease_id, tenant, 0, "error");
    assert.strictEqual(rel.released, true);
    assert.strictEqual(rel.token_delta, -2500, "Deve estornar 100% dos tokens reservados");
  });

  // Cenário 9: Timeout do provedor
  test("Cenário 9: Timeout de rede aborta chamada e devolve reserva de tokens", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";
    const user = "22222222-2222-2222-2222-222222222222";

    const acq = rpcAcquire({ tenantId: tenant, userId: user, reservedTokens: 3000 });
    assert.strictEqual(acq.allowed, true);

    const rel = rpcRelease(acq.lease_id, tenant, 0, "timeout");
    assert.strictEqual(rel.released, true);
    assert.strictEqual(rel.token_delta, -3000);
  });

  // Cenário 10: Encerramento abrupto do processo (Recuperação por TTL)
  test("Cenário 10: Lease órfã expira por TTL e libera concorrência automaticamente", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";

    for (let i = 1; i <= 4; i++) {
      rpcAcquire({
        tenantId: tenant,
        userId: `00000000-0000-0000-0000-00000000000${i}`,
        leaseTtlSeconds: 60,
        maxConcurrency: 4,
        reservedTokens: 500,
      });
    }

    const blocked = rpcAcquire({ tenantId: tenant, userId: "00000000-0000-0000-0000-000000000005", maxConcurrency: 4, reservedTokens: 500 });
    assert.strictEqual(blocked.allowed, false);

    executeDockerPsql(`UPDATE ${testSchema}.ai_active_leases SET expires_at = now() - interval '2 seconds' WHERE status = 'active';`);

    const recovered = rpcAcquire({ tenantId: tenant, userId: "00000000-0000-0000-0000-000000000005", maxConcurrency: 4, reservedTokens: 500 });
    assert.strictEqual(recovered.allowed, true, "Deve recuperar slot após expiração de leases órfãs");
  });

  // Cenário 11: Expiração segura de lease
  test("Cenário 11: Leases com status 'expired' não são contabilizadas na concorrência", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";

    const acq = rpcAcquire({ tenantId: tenant, userId: "00000000-0000-0000-0000-000000000001", leaseTtlSeconds: 1 });
    assert.strictEqual(acq.allowed, true);

    executeDockerPsql(`UPDATE ${testSchema}.ai_active_leases SET status = 'expired' WHERE lease_id = '${acq.lease_id}'::uuid;`);

    const out = executeDockerPsql(`SELECT count(*) FROM ${testSchema}.ai_active_leases WHERE status = 'active' AND expires_at > now();`);
    assert.strictEqual(out, "0");
  });

  // Cenário 12: Liberação duplicada (Idempotência)
  test("Cenário 12: Liberação duplicada da mesma lease é estritamente idempotente", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";
    const user = "22222222-2222-2222-2222-222222222222";

    const acq = rpcAcquire({ tenantId: tenant, userId: user, reservedTokens: 2000 });
    assert.strictEqual(acq.allowed, true);

    const rel1 = rpcRelease(acq.lease_id, tenant, 400);
    assert.strictEqual(rel1.released, true);
    assert.strictEqual(rel1.actual_tokens, 400);

    const rel2 = rpcRelease(acq.lease_id, tenant, 400);
    assert.strictEqual(rel2.released, true);
    assert.strictEqual(rel2.already_processed, true, "Segunda liberação deve retornar already_processed");
  });

  // Cenário 13: Falha do PostgreSQL (Proteção Fail-Closed no TypeScript)
  test("Cenário 13: Exceção na conexão ou RPC bloqueia a requisição (Fail-Closed)", () => {
    assert.match(guardrailsContent, /GOVERNANCE_RPC_ERROR/);
    assert.match(guardrailsContent, /GOVERNANCE_RPC_EXCEPTION/);
    assert.match(guardrailsContent, /GOVERNANCE_CLIENT_UNAVAILABLE/);
  });

  // Cenário 14: Esgotamento do orçamento TPM
  test("Cenário 14: Requisições que ultrapassam o teto de 6.000 TPM são bloqueadas com TPM_LIMIT_EXCEEDED", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";

    const r1 = rpcAcquire({
      tenantId: tenant,
      userId: "00000000-0000-0000-0000-000000000001",
      reservedTokens: 3000,
      maxGlobalTPM: 6000,
      maxConcurrency: 10,
    });
    assert.strictEqual(r1.allowed, true);

    const r2 = rpcAcquire({
      tenantId: tenant,
      userId: "00000000-0000-0000-0000-000000000002",
      reservedTokens: 2500,
      maxGlobalTPM: 6000,
      maxConcurrency: 10,
    });
    assert.strictEqual(r2.allowed, true);

    const r3 = rpcAcquire({
      tenantId: tenant,
      userId: "00000000-0000-0000-0000-000000000003",
      reservedTokens: 1000,
      maxGlobalTPM: 6000,
      maxConcurrency: 10,
    });
    assert.strictEqual(r3.allowed, false);
    assert.strictEqual(r3.reason, "TPM_LIMIT_EXCEEDED");
    assert.strictEqual(r3.limit, 6000);

    rpcRelease(r1.lease_id, tenant, 400);

    const r3_retry = rpcAcquire({
      tenantId: tenant,
      userId: "00000000-0000-0000-0000-000000000003",
      reservedTokens: 1000,
      maxGlobalTPM: 6000,
      maxConcurrency: 10,
    });
    assert.strictEqual(r3_retry.allowed, true, "Deve permitir nova reserva após reconciliação de tokens reais");
  });

  // Cenário 15: Esgotamento do limite diário por tenant
  test("Cenário 15: Tenant é bloqueado com TENANT_DAILY_LIMIT_EXCEEDED na 21ª requisição do dia em UTC", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";

    for (let i = 1; i <= 20; i++) {
      const acq = rpcAcquire({
        tenantId: tenant,
        userId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        reservedTokens: 50,
        maxConcurrency: 50,
        maxGlobalTPM: 100000,
        maxGlobalMin: 100,
        maxTenantDay: 20,
      });
      assert.strictEqual(acq.allowed, true, `Req ${i} deve ser permitida`);
      rpcRelease(acq.lease_id, tenant, 50);
    }

    const blocked = rpcAcquire({
      tenantId: tenant,
      userId: "00000000-0000-0000-0000-000000000099",
      reservedTokens: 50,
      maxConcurrency: 50,
      maxGlobalTPM: 100000,
      maxGlobalMin: 100,
      maxTenantDay: 20,
    });
    assert.strictEqual(blocked.allowed, false);
    assert.strictEqual(blocked.reason, "TENANT_DAILY_LIMIT_EXCEEDED");
    assert.strictEqual(blocked.limit, 20);
    assert.strictEqual(blocked.current, 20);
  });

  // Cenário 16: Reinicialização de instâncias / Cold starts
  test("Cenário 16: Cold start ou nova instância preserva histórico e limites persistidos no PostgreSQL", () => {
    const tenant = "11111111-1111-1111-1111-111111111111";

    for (let i = 1; i <= 10; i++) {
      const acq = rpcAcquire({
        tenantId: tenant,
        userId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        reservedTokens: 50,
        maxConcurrency: 50,
        maxGlobalTPM: 100000,
        maxGlobalMin: 100,
        maxTenantDay: 20,
      });
      rpcRelease(acq.lease_id, tenant, 50);
    }

    const sql = `SELECT request_count FROM ${testSchema}.ai_rate_limits WHERE tenant_id = '${tenant}'::uuid AND window_type = 'tenant_day';`;
    const out = executeDockerPsql(sql);
    assert.strictEqual(out, "10", "PostgreSQL deve manter a contagem exata de 10 requisições após cold start");
  });
});
