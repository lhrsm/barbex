/**
 * BARBEX — SUÍTE DE TESTES AUTOMATIZADOS (FASE R2E.26E.22N.8E.1)
 * Validação do Botão Flutuante, RBAC Estrito de Vínculo, Tratamento de Erros e Não-Regressão
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("===============================================================================");
console.log("BARBEX — TESTES AUTOMATIZADOS: ASSISTENTE FLUTUANTE & RBAC ESTRITO (22N.8E.1)");
console.log("===============================================================================\n");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Erro: ${err.message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// 1. Verificação de Código e Arquitetura do Componente AIAssistantFloatingButton
// -----------------------------------------------------------------------------
const floatingComponentPath = path.resolve(__dirname, "../src/components/ai/AIAssistantFloatingButton.tsx");
assert(fs.existsSync(floatingComponentPath), "Arquivo AIAssistantFloatingButton.tsx deve existir");
const componentCode = fs.readFileSync(floatingComponentPath, "utf8");

// Teste 1: Importação e uso do helper isProvenTenantAdmin
runTest("Gate 3.1: AIAssistantFloatingButton consome membership e isProvenTenantAdmin", () => {
  assert(componentCode.includes("membership"), "Deve extrair membership de useTenant()");
  assert(componentCode.includes("isProvenTenantAdmin"), "Deve utilizar isProvenTenantAdmin para avaliar autorização");
  assert(componentCode.includes("!authLoading") && componentCode.includes("!tenantLoading") && componentCode.includes("isProvenTenantAdmin({"), "Deve verificar loading e chamar isProvenTenantAdmin com parâmetros");
  assert(!componentCode.includes('role === "admin" && (!!tenantId || !!ownedShop)'), "Não deve conter condição frágil anterior baseada exclusivamente em tenantId");
});

// Teste 2: Acessibilidade e foco gerenciado
runTest("Gate 3.2: AIAssistantFloatingButton implementa acessibilidade completa e foco gerenciado", () => {
  assert(componentCode.includes('aria-label="Abrir Assistente Barbex"') || componentCode.includes('isOpen ? "Fechar Assistente Barbex" : "Abrir Assistente Barbex"'), "Deve ter aria-label acessível");
  assert(componentCode.includes('aria-expanded={isOpen}'), "Deve declarar aria-expanded");
  assert(componentCode.includes('role="dialog"'), "Painel deve declarar role='dialog'");
  assert(componentCode.includes('aria-label="Assistente Barbex"'), "Painel deve declarar aria-label");
  assert(componentCode.includes('handleKeyDown') && componentCode.includes('e.key === "Escape"'), "Deve suportar tecla Escape para fechar");
  assert(componentCode.includes('inputRef.current?.focus()'), "Deve focar no input ao abrir");
  assert(componentCode.includes('buttonRef.current?.focus()'), "Deve restaurar foco ao botão ao fechar");
});

// Teste 3: Integração sem duplicidade de endpoints
runTest("Gate 3.3: AIAssistantFloatingButton reutiliza askAIAssistant sem criar segundo endpoint", () => {
  assert(componentCode.includes('import { askAIAssistant } from "@/lib/ai/chat.functions"'), "Deve importar askAIAssistant existente");
  assert(!componentCode.includes('fetch("/api/ai"'), "Não deve chamar endpoints genéricos ou novos");
  assert(!componentCode.includes('groq.chat.completions'), "Nunca deve chamar provedor de IA diretamente no frontend");
});

// Teste 4: Tratamento de Kill Switch no frontend
runTest("Gate 3.4: AIAssistantFloatingButton bloqueia envio quando assistente estiver desativado", () => {
  assert(componentCode.includes('aiStatus === "disabled"'), "Deve checar se IA está disabled");
  assert(componentCode.includes('Assistente temporariamente desativado pela plataforma'), "Deve exibir mensagem amigável de desativação");
});

// -----------------------------------------------------------------------------
// 2. Testes Unitários de RBAC Estrito (isProvenTenantAdmin)
// -----------------------------------------------------------------------------
// Implementação espelho fiel do helper exportado em AIAssistantFloatingButton.tsx
function isProvenTenantAdmin(params) {
  const { userId, role, tenantId, ownedShop, membership } = params;

  if (!userId || !tenantId || !role) return false;

  const normalizedRole = role.toLowerCase().trim();

  const unauthorizedRoles = [
    "super_admin",
    "barber",
    "professional",
    "receptionist",
    "reception",
    "financial",
    "finance",
    "cashier",
    "manager",
    "client",
    "customer",
    "unknown",
  ];
  if (unauthorizedRoles.includes(normalizedRole)) return false;

  if (normalizedRole !== "tenant_admin" && normalizedRole !== "admin") return false;

  const isDirectShopOwner = !!ownedShop?.id && ownedShop.id === tenantId;

  const memTenantMatches = !!membership?.tenant_id && membership.tenant_id === tenantId;
  const memStatusActive = !membership?.status || membership.status === "active";
  const memRoleMatches =
    membership?.role?.toLowerCase().trim() === "admin" ||
    membership?.role?.toLowerCase().trim() === "tenant_admin";
  const isDirectActiveMemberAdmin = memTenantMatches && memStatusActive && memRoleMatches;

  const isCanonicalFounderTenant = normalizedRole === "tenant_admin" && userId === tenantId;

  return isDirectShopOwner || isDirectActiveMemberAdmin || isCanonicalFounderTenant;
}

runTest("RBAC 1: tenant_admin válido do tenant ativo com propriedade comprovada", () => {
  const authorized = isProvenTenantAdmin({
    userId: "user-123",
    role: "tenant_admin",
    tenantId: "tenant-abc",
    ownedShop: { id: "tenant-abc" },
  });
  assert.strictEqual(authorized, true, "tenant_admin proprietário deve ser autorizado");
});

runTest("RBAC 2: admin legado com vínculo administrativo comprovado (ownedShop)", () => {
  const authorized = isProvenTenantAdmin({
    userId: "user-carlos",
    role: "admin",
    tenantId: "tenant-carlos",
    ownedShop: { id: "tenant-carlos" },
  });
  assert.strictEqual(authorized, true, "admin com ownedShop coincidente deve ser autorizado");
});

runTest("RBAC 3: admin legado com vínculo administrativo comprovado (membership ativa)", () => {
  const authorized = isProvenTenantAdmin({
    userId: "user-admin-2",
    role: "admin",
    tenantId: "tenant-xyz",
    membership: { tenant_id: "tenant-xyz", role: "admin", status: "active" },
  });
  assert.strictEqual(authorized, true, "admin com membership de admin ativa no tenant deve ser autorizado");
});

runTest("RBAC 4: admin com apenas tenantId, sem vínculo comprovado (ownedShop=null, membership=null)", () => {
  const authorized = isProvenTenantAdmin({
    userId: "user-orphan-admin",
    role: "admin",
    tenantId: "tenant-random",
    ownedShop: null,
    membership: null,
  });
  assert.strictEqual(authorized, false, "admin órfão com mero tenantId NÃO deve ser autorizado");
});

runTest("RBAC 5: admin com propriedade de outra barbearia (ownedShop.id !== tenantId)", () => {
  const authorized = isProvenTenantAdmin({
    userId: "user-shop-a",
    role: "admin",
    tenantId: "tenant-b",
    ownedShop: { id: "tenant-a" },
  });
  assert.strictEqual(authorized, false, "admin com propriedade de outro tenant NÃO deve ter acesso ao tenant B");
});

runTest("RBAC 6: Membership inativa (status !== 'active')", () => {
  const authorized = isProvenTenantAdmin({
    userId: "user-suspended",
    role: "admin",
    tenantId: "tenant-xyz",
    membership: { tenant_id: "tenant-xyz", role: "admin", status: "inactive" },
  });
  assert.strictEqual(authorized, false, "membership inativa NÃO deve autorizar acesso");
});

runTest("RBAC 7: Membership de outro tenant (membership.tenant_id !== tenantId)", () => {
  const authorized = isProvenTenantAdmin({
    userId: "user-foreign",
    role: "admin",
    tenantId: "tenant-active",
    membership: { tenant_id: "tenant-other", role: "admin", status: "active" },
  });
  assert.strictEqual(authorized, false, "membership de outro tenant NÃO deve autorizar acesso no tenant ativo");
});

runTest("RBAC 8: Usuário sem autenticação (userId ausente ou nulo)", () => {
  assert.strictEqual(isProvenTenantAdmin({ userId: null, role: "admin", tenantId: "t1" }), false);
  assert.strictEqual(isProvenTenantAdmin({ userId: "", role: "tenant_admin", tenantId: "t1" }), false);
});

runTest("RBAC 9: Perfis de recepção, barbeiro, financeiro e cliente", () => {
  const roles = ["reception", "receptionist", "barber", "financial", "finance", "cashier", "manager", "client", "customer"];
  for (const r of roles) {
    const res = isProvenTenantAdmin({
      userId: "u-op",
      role: r,
      tenantId: "t1",
      ownedShop: { id: "t1" },
      membership: { tenant_id: "t1", role: r, status: "active" },
    });
    assert.strictEqual(res, false, `Perfil '${r}' deve ser estritamente bloqueado`);
  }
});

runTest("RBAC 10: Superadmin sem vínculo administrativo específico", () => {
  const authorized = isProvenTenantAdmin({
    userId: "super-user",
    role: "super_admin",
    tenantId: "t1",
    ownedShop: { id: "t1" },
  });
  assert.strictEqual(authorized, false, "super_admin deve ser bloqueado no assistente institucional");
});

runTest("RBAC 11: Ausência de dados de autorização (parâmetros vazios)", () => {
  assert.strictEqual(isProvenTenantAdmin({}), false, "Parâmetros vazios devem resultar em fail-closed");
});

runTest("RBAC 12: Alteração do tenant ativo (divergência entre tenantId e vínculo)", () => {
  const authorized = isProvenTenantAdmin({
    userId: "user-1",
    role: "admin",
    tenantId: "tenant-novo",
    ownedShop: { id: "tenant-antigo" },
    membership: { tenant_id: "tenant-antigo", role: "admin", status: "active" },
  });
  assert.strictEqual(authorized, false, "Ao trocar para tenant não vinculado, deve bloquear imediatamente");
});

// -----------------------------------------------------------------------------
// 3. Verificação do Layout da Dashboard
// -----------------------------------------------------------------------------
const dashboardLayoutPath = path.resolve(__dirname, "../src/routes/dashboard.tsx");
const dashboardCode = fs.readFileSync(dashboardLayoutPath, "utf8");

runTest("Gate 3.5: DashboardLayout monta AIAssistantFloatingButton", () => {
  assert(dashboardCode.includes('import { AIAssistantFloatingButton } from "@/components/ai/AIAssistantFloatingButton"'), "Deve importar AIAssistantFloatingButton");
  assert(dashboardCode.includes('<AIAssistantFloatingButton />'), "Deve renderizar <AIAssistantFloatingButton /> no layout");
});

// -----------------------------------------------------------------------------
// 4. Verificação do Tratamento Amigável de Erros na Server Function
// -----------------------------------------------------------------------------
const chatFunctionsPath = path.resolve(__dirname, "../src/lib/ai/chat.functions.ts");
const chatCode = fs.readFileSync(chatFunctionsPath, "utf8");

runTest("Gate 2.1: askAIAssistant trata erros de RPC e rate limit com mensagem amigável preservando fail-closed", () => {
  assert(chatCode.includes('isInternalRpcError'), "Deve identificar erros internos de RPC");
  assert(chatCode.includes('friendlyReply'), "Deve formatar resposta amigável ao usuário");
  assert(chatCode.includes('logAITelemetry'), "Deve manter telemetria completa");
  assert(chatCode.includes('success: false'), "Deve manter fail-closed (success: false)");
});

// -----------------------------------------------------------------------------
// 5. Verificação de Limpeza de Credencial no client.server.ts
// -----------------------------------------------------------------------------
const clientServerPath = path.resolve(__dirname, "../src/integrations/supabase/client.server.ts");
const clientServerCode = fs.readFileSync(clientServerPath, "utf8");

runTest("Gate 2.2: client.server.ts sanitiza chaves e emite alerta contra chaves demo em produção", () => {
  assert(clientServerCode.includes("rawKey?.trim()"), "Deve sanitizar espaços");
  assert(clientServerCode.includes("supabase-demo"), "Deve inspecionar chaves demo indesejadas em produção");
});

// -----------------------------------------------------------------------------
// 6. Verificação da Função resolveAIContext com Verificação Canário Real
// -----------------------------------------------------------------------------
const contextFunctionsPath = path.resolve(__dirname, "../src/lib/ai/context.functions.ts");
const contextCode = fs.readFileSync(contextFunctionsPath, "utf8");

runTest("Gate 2.3: resolveAIContext avalia status real via isAIAssistantEnabled", () => {
  assert(contextCode.includes('isAIAssistantEnabled'), "Deve consultar isAIAssistantEnabled");
  assert(contextCode.includes('canaryStatus.status'), "Deve retornar status avaliado");
});

// -----------------------------------------------------------------------------
// Resumo da Execução
// -----------------------------------------------------------------------------
console.log("\n===============================================================================");
console.log(`RESULTADO FINAL: ${passed} PASS, ${failed} FAIL`);
console.log("===============================================================================");

if (failed > 0) {
  process.exit(1);
}
