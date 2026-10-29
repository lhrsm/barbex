/**
 * BARBEX — R2E.26E.20B.6A
 * TEST SUITE: CLIENT PORTAL HELP CENTER NAVIGATION & AUTHENTICATED ACCESS SECURITY CHECK
 * 
 * Verifies Gate 2 & Gate 4 criteria:
 * 1. PortalNavigation.tsx includes "Ajuda e Tutoriais" with BookOpen icon and link to "/tutorials".
 * 2. $slug.portal.tsx header includes dedicated Link to "/tutorials" with BookOpen icon.
 * 3. $slug.portal.tsx preserves secondary onboarding modal button as "Guia" with Sparkles icon.
 * 4. AppLayout.tsx includes customerNavItems providing "Meu Painel" (/${slug}/portal), "Agendamentos", and "Ajuda e Tutoriais".
 * 5. AppLayout.tsx does NOT mark "/tutorials" as isPublicPath (unauthenticated visitors are redirected to /auth).
 * 6. tutorials.tsx includes defense-in-depth redirect for anonymous visitors (isAnonymous -> /auth?redirect=/tutorials).
 * 7. tutorials.tsx includes "Voltar ao Painel" action when effectiveRole is "client".
 * 8. Security: Client role sees exactly 3 client tutorials, with 0 administrative/finance/reception/barber/superadmin tutorials.
 * 9. Non-regression: Admin, reception, and barber navigation configurations remain intact.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('================================================================');
console.log('BARBEX — R2E.26E.20B.6A: SECURITY CHECK — ACESSO AUTENTICADO À CENTRAL');
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

// 1. Inspecionar PortalNavigation.tsx
console.log('--- TESTE 1: Navegação no PortalNavigation (Desktop & Mobile Bar) ---');
const portalNavPath = path.join(__dirname, '../src/components/portal/premium/layout/PortalNavigation.tsx');
const portalNavContent = fs.readFileSync(portalNavPath, 'utf8');

assert(portalNavContent.includes('BookOpen'), 'PortalNavigation importa BookOpen de lucide-react');
assert(portalNavContent.includes('to="/tutorials"'), 'PortalNavigation contém Link apontando para "/tutorials"');
assert(portalNavContent.includes('Ajuda e Tutoriais'), 'PortalNavigation exibe o rótulo "Ajuda e Tutoriais"');
assert(portalNavContent.includes('overflow-x-auto'), 'PortalNavigation mantém scroll horizontal responsivo para mobile');

// 2. Inspecionar $slug.portal.tsx (Header do Portal)
console.log('\n--- TESTE 2: Header de Ações Rápidas no Painel do Cliente ($slug.portal.tsx) ---');
const portalRoutePath = path.join(__dirname, '../src/routes/$slug.portal.tsx');
const portalRouteContent = fs.readFileSync(portalRoutePath, 'utf8');

assert(portalRouteContent.includes('<Link to="/tutorials">'), '$slug.portal.tsx possui Link para "/tutorials"');
assert(portalRouteContent.includes('<BookOpen className="h-4 w-4 text-gold" />'), '$slug.portal.tsx utiliza o ícone BookOpen no botão de ajuda');
assert(portalRouteContent.includes('openOnboardingModal()'), '$slug.portal.tsx preserva a abertura do Guia (OnboardingModal)');
assert(portalRouteContent.includes('Sparkles'), '$slug.portal.tsx usa Sparkles para diferenciar o Guia de Boas-Vindas');

// 3. Inspecionar AppLayout.tsx (Navegação de Retorno e Bloqueio Anônimo)
console.log('\n--- TESTE 3: Configuração do AppLayout e Guards de Autenticação ---');
const appLayoutPath = path.join(__dirname, '../src/components/layout/AppLayout.tsx');
const appLayoutContent = fs.readFileSync(appLayoutPath, 'utf8');

assert(appLayoutContent.includes('customerNavItems'), 'AppLayout define customerNavItems para clientes autenticados');
assert(appLayoutContent.includes('Meu Painel'), 'customerNavItems possui rota de retorno "Meu Painel"');
assert(appLayoutContent.includes('/portal'), 'customerNavItems aponta para /${slug}/portal');

// Verificação de segurança: /tutorials NÃO pode ser rota pública irrestrita no guard do AppLayout
const isPublicPathRegex = /const isPublicPath\s*=\s*[\s\S]*?pathname === "\/tutorials"[\s\S]*?;/;
assert(!isPublicPathRegex.test(appLayoutContent), 'AppLayout NÃO inclui "/tutorials" em isPublicPath (redireciona visitantes deslogados para /auth)');

// 4. Inspecionar tutorials.tsx (Defesa em Profundidade e Retorno ao Painel)
console.log('\n--- TESTE 4: Defesa em Profundidade na Central de Ajuda (tutorials.tsx) ---');
const tutorialsRoutePath = path.join(__dirname, '../src/routes/tutorials.tsx');
const tutorialsContent = fs.readFileSync(tutorialsRoutePath, 'utf8');

assert(tutorialsContent.includes('if (isAnonymous)'), 'tutorials.tsx possui hook de redirecionamento para visitantes anônimos');
assert(tutorialsContent.includes('search: { redirect: "/tutorials" }'), 'tutorials.tsx redireciona para login preservando o redirect');
assert(tutorialsContent.includes('isAuthResolving || isAnonymous'), 'tutorials.tsx bloqueia renderização de artigos enquanto anônimo ou hidratando');
assert(tutorialsContent.includes('effectiveRole === "client"'), 'tutorials.tsx detecta perfil cliente para exibir ação de retorno');
assert(tutorialsContent.includes('Voltar ao Painel'), 'tutorials.tsx exibe o botão "Voltar ao Painel" para clientes');
assert(tutorialsContent.includes('window.history.back()'), 'tutorials.tsx suporta retorno natural via histórico do navegador');

// 5. Verificação de Segurança e Filtragem do Perfil Cliente
console.log('\n--- TESTE 5: Segurança e Filtragem Estrita de Conteúdo para Cliente ---');
const backupPath = 'C:/Users/louis.SBPM-BA/.gemini/antigravity/brain/45691b4e-8a9d-48a7-9b92-314dc74733c8/backup_tutorials_manifest_pre_cutover_20261029.json';
const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const dbArticlesRaw = backupData.data.tutorials;

// Carregar migration para perfil
const migrationPath = path.join(__dirname, '../supabase/migrations/20261028140000_r2e26e20b_tutorials_sanitization_and_rls.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const targetMap = {};
const regex = /UPDATE public\.tutorials\s+SET profile_target = ARRAY\[(.*?)\]::text\[\].*?WHERE id = '([a-f0-9\-]+)';/gs;
let match;
while ((match = regex.exec(migrationSql)) !== null) {
  const roles = match[1].split(',').map(r => r.replace(/['\s]/g, ''));
  const id = match[2];
  targetMap[id] = roles;
}

const dbArticles = dbArticlesRaw.map(art => ({
  ...art,
  profile_target: targetMap[art.id] || []
}));

const clientAllowed = dbArticles.filter(a => (a.profile_target || []).includes('client'));
assert(clientAllowed.length === 3, `Cliente tem acesso a exatamente 3 artigos no banco (atual: ${clientAllowed.length})`);

const clientForbiddenFinancial = dbArticles.filter(a => 
  (a.profile_target || []).includes('client') && (a.category_id === '09ebdbf8-b397-400d-a77c-a1f9a2656fe2' || a.title.toLowerCase().includes('comissão'))
);
assert(clientForbiddenFinancial.length === 0, 'Cliente NÃO tem acesso a nenhum artigo financeiro ou de comissão');

const clientForbiddenSuperadmin = dbArticles.filter(a => 
  (a.profile_target || []).includes('client') && (a.profile_target || []).includes('superadmin')
);
assert(clientForbiddenSuperadmin.length === 0, 'Cliente NÃO tem acesso a nenhum artigo exclusivo de superadmin');

// 6. Teste de Não-Regressão dos Demais Perfis
console.log('\n--- TESTE 6: Não-Regressão dos Demais Perfis ---');
assert(appLayoutContent.includes('barberNavItems'), 'AppLayout preserva navegação exclusiva do barbeiro');
assert(appLayoutContent.includes('defaultNavItems'), 'AppLayout preserva navegação padrão de gestão/proprietário');

const receptionLayoutPath = path.join(__dirname, '../src/components/reception/ReceptionLayout.tsx');
const receptionLayoutContent = fs.readFileSync(receptionLayoutPath, 'utf8');
assert(receptionLayoutContent.includes('to: "/tutorials"'), 'ReceptionLayout mantém link para "/tutorials"');
assert(receptionLayoutContent.includes('openOnboardingModal()'), 'ReceptionLayout mantém Guia da Recepção');

console.log('\n================================================================');
console.log(`TOTAL DE TESTES: ${totalTests} | SUCESSOS: ${passedTests} | FALHAS: ${totalTests - passedTests}`);
if (passedTests === totalTests) {
  console.log('RESULTADO FINAL: TODOS OS TESTES PASSARAM COM SUCESSO! ✓');
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.error('RESULTADO FINAL: HOUVE FALHAS NOS TESTES! ✗');
  console.log('================================================================\n');
  process.exit(1);
}
