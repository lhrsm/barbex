/**
 * BARBEX — R2E.26E.20B.6A
 * RUNTIME SIMULATOR: AUTHENTICATION GUARDS, REDIRECTS, AND SESSION LIFECYCLE
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('BARBEX — R2E.26E.20B.6A: SIMULADOR DE EXECUÇÃO — GUARDS & REDIRECTS');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// 1. Simular o Guard do AppLayout
function simulateAppLayoutGuard({ pathname, user, role, slug, authIdentity, tenantProfile }) {
  const isPublicPath =
    pathname === "/auth" ||
    pathname === "/" ||
    pathname.endsWith("/portal") ||
    pathname.includes("/agendamento/") ||
    pathname.includes("/review/") ||
    pathname.endsWith("/profissional");

  let redirectTarget = null;

  if (!user && !isPublicPath) {
    redirectTarget = { to: "/auth", search: { redirect: pathname } };
    return { allowed: false, redirectTarget, navItems: [] };
  }

  // Redirect by role on /dashboard
  if (
    user &&
    !pathname.startsWith("/auth") &&
    (pathname === "/dashboard" || pathname === "/dashboard/")
  ) {
    if (role === "super_admin") {
      redirectTarget = { to: "/admin/dashboard" };
    } else if (role === "reception" || role === "receptionist") {
      redirectTarget = { to: "/reception" };
    } else if (role === "client" || role === "customer") {
      const targetClientSlug =
        authIdentity?.tenantSlug || tenantProfile?.slug || (slug !== "general" ? slug : null);
      redirectTarget = { to: `/${targetClientSlug}/portal` };
    }
    return { allowed: true, redirectTarget, navItems: [] };
  }

  // Nav Items calculation
  const resolvedClientSlug =
    authIdentity?.tenantSlug || tenantProfile?.slug || (slug !== "general" ? slug : "");
  
  let navItems = [];
  if (role === "client" || role === "customer") {
    navItems = resolvedClientSlug ? [
      { label: "Meu Painel", to: `/${resolvedClientSlug}/portal` },
      { label: "Agendamentos", to: `/${resolvedClientSlug}/portal?tab=appointments` },
      { label: "Ajuda e Tutoriais", to: "/tutorials" },
    ] : [{ label: "Ajuda e Tutoriais", to: "/tutorials" }];
  }

  return { allowed: true, redirectTarget: null, navItems };
}

// CENÁRIO 1: Visitante deslogado em /tutorials
console.log('--- CENÁRIO 1: Visitante Deslogado acessando /tutorials ---');
const unauthTutorials = simulateAppLayoutGuard({
  pathname: "/tutorials",
  user: null,
  role: null
});
assert(unauthTutorials.allowed === false, 'Acesso direto deslogado a /tutorials é BLOQUEADO');
assert(unauthTutorials.redirectTarget?.to === "/auth", 'Redirecionamento enviado para /auth');
assert(unauthTutorials.redirectTarget?.search?.redirect === "/tutorials", 'Parâmetro de redirect preserva /tutorials');

// CENÁRIO 2: Visitante deslogado em rotas públicas
console.log('\n--- CENÁRIO 2: Visitante Deslogado em rotas públicas permitidas ---');
const unauthLanding = simulateAppLayoutGuard({ pathname: "/", user: null });
assert(unauthLanding.allowed === true, 'Página inicial / permanece pública');

const unauthPortal = simulateAppLayoutGuard({ pathname: "/barbearia-modelo/portal", user: null });
assert(unauthPortal.allowed === true, 'Portal público /:slug/portal permanece público com formulário de login');

// CENÁRIO 3: Cliente Autenticado acessando /tutorials
console.log('\n--- CENÁRIO 3: Cliente Autenticado acessando /tutorials ---');
const authClientTutorials = simulateAppLayoutGuard({
  pathname: "/tutorials",
  user: { id: "user_client_123" },
  role: "client",
  slug: "barbearia-vip",
  tenantProfile: { slug: "barbearia-vip" }
});
assert(authClientTutorials.allowed === true, 'Cliente autenticado tem ACESSO AUTORIZADO a /tutorials');
assert(authClientTutorials.redirectTarget === null, 'Nenhum redirecionamento indevido é aplicado ao cliente em /tutorials');
assert(authClientTutorials.navItems.length === 3, 'Cliente recebe menu de navegação de 3 itens');
assert(authClientTutorials.navItems[0].label === "Meu Painel", 'Menu inclui link de retorno "Meu Painel"');
assert(authClientTutorials.navItems[0].to === "/barbearia-vip/portal", 'Link "Meu Painel" aponta para /barbearia-vip/portal');

// CENÁRIO 4: Proprietário Autenticado acessando /tutorials
console.log('\n--- CENÁRIO 4: Proprietário Autenticado acessando /tutorials ---');
const authOwnerTutorials = simulateAppLayoutGuard({
  pathname: "/tutorials",
  user: { id: "user_owner_456" },
  role: "tenant_admin",
  slug: "barbearia-vip"
});
assert(authOwnerTutorials.allowed === true, 'Proprietário autenticado tem ACESSO AUTORIZADO a /tutorials');
assert(authOwnerTutorials.redirectTarget === null, 'Proprietário não é redirecionado fora de /tutorials');

// CENÁRIO 5: Logout do Usuário enquanto em /tutorials
console.log('\n--- CENÁRIO 5: Ação de Logout na Central de Ajuda ---');
let sessionUser = { id: "user_client_123" };
let currentRole = "client";

// Usuário está em /tutorials
let state = simulateAppLayoutGuard({ pathname: "/tutorials", user: sessionUser, role: currentRole });
assert(state.allowed === true, 'Estado pré-logout: usuário logado visualiza tutoriais');

// Usuário clica em logout
sessionUser = null;
currentRole = null;
state = simulateAppLayoutGuard({ pathname: "/tutorials", user: sessionUser, role: currentRole });
assert(state.allowed === false, 'Estado pós-logout: guard bloqueia imediatamente a rota /tutorials');
assert(state.redirectTarget?.to === "/auth", 'Estado pós-logout: redirecionamento imediato para /auth');

// CENÁRIO 6: Isolamento de Histórico entre Contas
console.log('\n--- CENÁRIO 6: Isolamento de Chaves de Histórico entre Contas ---');
function getStorageKey(user) {
  if (user?.id) return `help_history_${user.id}`;
  return "help_history_anon";
}
const keyUserA = getStorageKey({ id: "client_aaa" });
const keyUserB = getStorageKey({ id: "owner_bbb" });
const keyAnon = getStorageKey(null);

assert(keyUserA === "help_history_client_aaa", 'Chave do Usuário A é unívoca e isolada');
assert(keyUserB === "help_history_owner_bbb", 'Chave do Usuário B é unívoca e isolada');
assert(keyUserA !== keyUserB, 'Chaves de contas diferentes NUNCA colidem');
assert(keyUserA !== keyAnon, 'Chave de usuário autenticado é distinta da chave anônima');

console.log('\n================================================================');
console.log(`TOTAL DE TESTES: ${totalTests} | SUCESSOS: ${passedTests} | FALHAS: ${totalTests - passedTests}`);
if (passedTests === totalTests) {
  console.log('RESULTADO FINAL: SIMULAÇÃO CONCLUÍDA COM 100% DE SUCESSO! ✓');
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.error('RESULTADO FINAL: HOUVE FALHAS NA SIMULAÇÃO! ✗');
  console.log('================================================================\n');
  process.exit(1);
}

