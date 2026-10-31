/**
 * BARBEX — R2E.26E.21C: SUITE DE TESTES ADVERSARIAIS DE SEGURANÇA (RBAC & MULTI-TENANCY)
 * 
 * Cobertura mandatória dos 10 cenários adversariais:
 * 1. Administrador legítimo da barbearia A.
 * 2. Administrador legítimo da barbearia B.
 * 3. Administrador de A tentando acessar dados de B (Cross-Tenant Attack).
 * 4. Recepção, barbeiro, financeiro, caixa e gerente operacional.
 * 5. Cliente final.
 * 6. Superadmin tentando acesso institucional.
 * 7. Usuário anônimo / não autenticado.
 * 8. Usuário com sessão expirada / token inválido.
 * 9. Usuário com papel 'admin' mas sem associação ativa a um tenant (Orphan Admin).
 * 10. Requisições com 'tenantId' e 'role' manipulados/injetados no payload pelo invasor.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");

console.log("================================================================================");
console.log("BARBEX — R2E.26E.21C: TESTES ADVERSARIAIS DE SEGURANÇA E MULTI-TENANCY");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function test(description, fn) {
  total++;
  try {
    fn();
    console.log(`  [PASS] #${total}: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] #${total}: ${description}`);
    console.error(`         Erro: ${err.message}`);
    process.exitCode = 1;
  }
}

async function asyncTest(description, fn) {
  total++;
  try {
    await fn();
    console.log(`  [PASS] #${total}: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] #${total}: ${description}`);
    console.error(`         Erro: ${err.message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// Banco de Dados Mockado com Isolamento e Registro de Queries
// -----------------------------------------------------------------------------
function createIsolatedMockDb(state) {
  const queryLogs = [];

  const db = {
    _logs: queryLogs,
    from: (tableName) => {
      let filters = [];
      let selectFields = "*";

      const builder = {
        select: (fields) => {
          selectFields = fields;
          return builder;
        },
        eq: (col, val) => {
          filters.push({ col, val });
          return builder;
        },
        gte: (col, val) => {
          filters.push({ col, op: ">=", val });
          return builder;
        },
        lte: (col, val) => {
          filters.push({ col, op: "<=", val });
          return builder;
        },
        maybeSingle: async () => {
          queryLogs.push({ table: tableName, filters, type: "maybeSingle" });
          const rows = state[tableName] || [];
          const match = rows.find((r) =>
            filters.every((f) => {
              if (f.op === ">=") return r[f.col] >= f.val;
              if (f.op === "<=") return r[f.col] <= f.val;
              return r[f.col] === f.val;
            })
          );
          return { data: match ? JSON.parse(JSON.stringify(match)) : null, error: null };
        },
        single: async () => {
          queryLogs.push({ table: tableName, filters, type: "single" });
          const rows = state[tableName] || [];
          const match = rows.find((r) =>
            filters.every((f) => r[f.col] === f.val)
          );
          if (!match) return { data: null, error: { message: "PGRST116: JSON object requested, multiple (or no) rows returned" } };
          return { data: JSON.parse(JSON.stringify(match)), error: null };
        },
      };

      return builder;
    },
  };

  return db;
}

const UNAUTHORIZED_ROLES = [
  "reception",
  "receptionist",
  "barber",
  "professional",
  "financial",
  "finance",
  "cashier",
  "manager",
  "client",
  "customer",
];

async function verifyTenantAdminIdentityCore(userId, db) {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return {
      authorized: false,
      errorCode: "UNAUTHENTICATED",
      errorMessage: "Autenticação obrigatória.",
    };
  }

  const { data: profile, error: profileErr } = await db
    .from("profiles")
    .select("id, role, tenant_id, status")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr || !profile) {
    return {
      authorized: false,
      errorCode: "PROFILE_NOT_FOUND",
      errorMessage: "Perfil de usuário não encontrado.",
    };
  }

  const role = (profile.role || "").toLowerCase().trim();

  if (role === "super_admin") {
    return {
      authorized: false,
      errorCode: "SUPER_ADMIN_DENIED",
      errorMessage: "Superadmin não possui acesso operacional ao assistente institucional por padrão.",
    };
  }

  if (UNAUTHORIZED_ROLES.includes(role)) {
    return {
      authorized: false,
      errorCode: "ROLE_UNAUTHORIZED",
      errorMessage: `Perfil '${role}' não autorizado a acessar o Assistente Institucional.`,
    };
  }

  const isTenantAdmin = role === "tenant_admin";
  const isAdmin = role === "admin";

  if (!isTenantAdmin && !isAdmin) {
    return {
      authorized: false,
      errorCode: "ROLE_UNAUTHORIZED",
      errorMessage: `Papel '${role}' não autorizado.`,
    };
  }

  let resolvedTenantId = null;

  const { data: ownedShop } = await db
    .from("barbershops")
    .select("id, owner_id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (ownedShop?.id) {
    resolvedTenantId = ownedShop.id;
  }

  if (!resolvedTenantId) {
    const { data: membership } = await db
      .from("tenant_memberships")
      .select("tenant_id, role, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (membership?.tenant_id) {
      const memRole = (membership.role || "").toLowerCase().trim();
      if (memRole === "tenant_admin" || memRole === "admin") {
        resolvedTenantId = membership.tenant_id;
      }
    }
  }

  if (!resolvedTenantId && profile.tenant_id) {
    if (profile.tenant_id !== "00000000-0000-0000-0000-000000000000") {
      resolvedTenantId = profile.tenant_id;
    }
  }

  if (!resolvedTenantId && isTenantAdmin) {
    resolvedTenantId = profile.id;
  }

  if (!resolvedTenantId) {
    return {
      authorized: false,
      errorCode: "TENANT_NOT_RESOLVED",
      errorMessage: "Associação ativa a uma barbearia não comprovada.",
    };
  }

  return {
    authorized: true,
    userId,
    tenantId: resolvedTenantId,
    role,
  };
}

// Simulação de chamada server-side protegida
async function executeAIFinancialSummary(serverAuthContext, clientParams, db) {
  // 1. Validar no servidor
  const authRes = await verifyTenantAdminIdentityCore(serverAuthContext.userId, db);
  if (!authRes.authorized) {
    throw new Error(`403 FORBIDDEN: ${authRes.errorMessage}`);
  }

  // 2. O tenant_id utilizado DEVE ser estritamente o resolvido no servidor
  const safeTenantId = authRes.tenantId;

  // 3. Fazer query simulada com filtro seguro
  const query = db.from("transactions").select("*").eq("tenant_id", safeTenantId);
  const { data } = await query.maybeSingle();

  return {
    success: true,
    tenant_id: safeTenantId,
    data,
  };
}

async function main() {
  const dbState = {
    profiles: [
      { id: "usr_admin_shop_a", role: "tenant_admin", tenant_id: "tenant_shop_a", status: "active" },
      { id: "usr_admin_shop_b", role: "tenant_admin", tenant_id: "tenant_shop_b", status: "active" },
      { id: "usr_legacy_admin_with_shop", role: "admin", tenant_id: null, status: "active" },
      { id: "usr_orphan_admin", role: "admin", tenant_id: null, status: "active" },
      { id: "usr_super_admin", role: "super_admin", tenant_id: null, status: "active" },
      { id: "usr_reception", role: "reception", tenant_id: "tenant_shop_a", status: "active" },
      { id: "usr_barber", role: "barber", tenant_id: "tenant_shop_a", status: "active" },
      { id: "usr_financial", role: "financial", tenant_id: "tenant_shop_a", status: "active" },
      { id: "usr_cashier", role: "cashier", tenant_id: "tenant_shop_a", status: "active" },
      { id: "usr_manager", role: "manager", tenant_id: "tenant_shop_a", status: "active" },
      { id: "usr_client", role: "client", tenant_id: "tenant_shop_a", status: "active" },
    ],
    barbershops: [
      { id: "tenant_shop_a", owner_id: "usr_admin_shop_a", name: "Barbearia Alfa" },
      { id: "tenant_shop_b", owner_id: "usr_admin_shop_b", name: "Barbearia Beta" },
      { id: "tenant_shop_legacy", owner_id: "usr_legacy_admin_with_shop", name: "Barbearia Legada" },
    ],
    tenant_memberships: [
      { user_id: "usr_admin_shop_a", tenant_id: "tenant_shop_a", role: "tenant_admin", status: "active" },
      { user_id: "usr_admin_shop_b", tenant_id: "tenant_shop_b", role: "tenant_admin", status: "active" },
      { user_id: "usr_reception", tenant_id: "tenant_shop_a", role: "reception", status: "active" },
      { user_id: "usr_financial", tenant_id: "tenant_shop_a", role: "financial", status: "active" },
    ],
    transactions: [
      { id: "tx_a_1", tenant_id: "tenant_shop_a", amount: 150.00, desc: "Corte e Barba Alfa" },
      { id: "tx_b_1", tenant_id: "tenant_shop_b", amount: 350.00, desc: "Dia do Noivo Beta" },
    ],
  };

  const db = createIsolatedMockDb(dbState);

  // Cenário 1: Administrador legítimo da barbearia A
  await asyncTest("Cenário 1: Administrador legítimo da Barbearia A tem acesso concedido com escopo em 'tenant_shop_a'", async () => {
    const res = await verifyTenantAdminIdentityCore("usr_admin_shop_a", db);
    assert.strictEqual(res.authorized, true);
    assert.strictEqual(res.tenantId, "tenant_shop_a");
    assert.strictEqual(res.role, "tenant_admin");
  });

  // Cenário 2: Administrador legítimo da barbearia B
  await asyncTest("Cenário 2: Administrador legítimo da Barbearia B tem acesso concedido com escopo em 'tenant_shop_b'", async () => {
    const res = await verifyTenantAdminIdentityCore("usr_admin_shop_b", db);
    assert.strictEqual(res.authorized, true);
    assert.strictEqual(res.tenantId, "tenant_shop_b");
    assert.strictEqual(res.role, "tenant_admin");
  });

  // Cenário 3: Administrador de A tentando acessar dados de B (Cross-Tenant Attack)
  await asyncTest("Cenário 3: Administrador de A forjando chamada para obter dados de B recebe APENAS dados de A", async () => {
    // Invasor autenticado como admin de A passa tenantId de B no payload do cliente
    const maliciousPayload = { target_tenant: "tenant_shop_b" };
    const result = await executeAIFinancialSummary({ userId: "usr_admin_shop_a" }, maliciousPayload, db);

    // O servidor DEVE ignorar target_tenant e usar estritamente o tenant_id autenticado de Alfa
    assert.strictEqual(result.tenant_id, "tenant_shop_a");
    assert.strictEqual(result.data.id, "tx_a_1");
    assert.notStrictEqual(result.data.id, "tx_b_1");
  });

  // Cenário 4: Perfis operacionais (Recepção, Barbeiro, Financeiro, Caixa, Gerente)
  await asyncTest("Cenário 4a: Recepção é sumariamente bloqueada", async () => {
    const res = await verifyTenantAdminIdentityCore("usr_reception", db);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "ROLE_UNAUTHORIZED");
  });

  await asyncTest("Cenário 4b: Barbeiro é sumariamente bloqueado", async () => {
    const res = await verifyTenantAdminIdentityCore("usr_barber", db);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "ROLE_UNAUTHORIZED");
  });

  await asyncTest("Cenário 4c: Financeiro é sumariamente bloqueado", async () => {
    const res = await verifyTenantAdminIdentityCore("usr_financial", db);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "ROLE_UNAUTHORIZED");
  });

  await asyncTest("Cenário 4d: Caixa é sumariamente bloqueado", async () => {
    const res = await verifyTenantAdminIdentityCore("usr_cashier", db);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "ROLE_UNAUTHORIZED");
  });

  await asyncTest("Cenário 4e: Gerente operacional é sumariamente bloqueado", async () => {
    const res = await verifyTenantAdminIdentityCore("usr_manager", db);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "ROLE_UNAUTHORIZED");
  });

  // Cenário 5: Cliente final
  await asyncTest("Cenário 5: Cliente final é sumariamente bloqueado", async () => {
    const res = await verifyTenantAdminIdentityCore("usr_client", db);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "ROLE_UNAUTHORIZED");
  });

  // Cenário 6: Superadmin
  await asyncTest("Cenário 6: Superadmin é bloqueado por padrão (SUPER_ADMIN_DENIED)", async () => {
    const res = await verifyTenantAdminIdentityCore("usr_super_admin", db);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "SUPER_ADMIN_DENIED");
  });

  // Cenário 7: Usuário anônimo
  await asyncTest("Cenário 7: Usuário anônimo (null/vazio) é rejeitado imediatamente (UNAUTHENTICATED)", async () => {
    const res = await verifyTenantAdminIdentityCore(null, db);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "UNAUTHENTICATED");
  });

  // Cenário 8: Sessão expirada ou token revogado
  await asyncTest("Cenário 8: Sessão expirada/inválida que não fornece userId válido resulta em UNAUTHENTICATED", async () => {
    const res = await verifyTenantAdminIdentityCore("", db);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "UNAUTHENTICATED");
  });

  // Cenário 9: Usuário 'admin' sem associação ativa a um tenant (Orphan Admin)
  await asyncTest("Cenário 9: Papel 'admin' sem barbearia associada é rejeitado (TENANT_NOT_RESOLVED)", async () => {
    const res = await verifyTenantAdminIdentityCore("usr_orphan_admin", db);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.errorCode, "TENANT_NOT_RESOLVED");
  });

  // Cenário 10: Injeção forjada de 'tenantId' e 'role' no payload da requisição
  await asyncTest("Cenário 10: Invasor enviando role='tenant_admin' e tenantId='tenant_shop_a' em chamada protegida é rejeitado", async () => {
    let threw = false;
    try {
      // O invasor é a recepção, tentando injetar claims no cliente
      await executeAIFinancialSummary(
        { userId: "usr_reception", injectedRole: "tenant_admin", injectedTenantId: "tenant_shop_a" },
        { someParam: "test" },
        db
      );
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes("403 FORBIDDEN"));
      assert.ok(e.message.includes("reception"));
    }
    assert.strictEqual(threw, true);
  });

  console.log("\n================================================================================");
  console.log(`RESULTADO FINAL ADVERSARIAL: ${passed} de ${total} testes APROVADOS.`);
  console.log("================================================================================");
}

main().catch((e) => {
  console.error("Erro fatal no runner adversarial:", e);
  process.exit(1);
});

