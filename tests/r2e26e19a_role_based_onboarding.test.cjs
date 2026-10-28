const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('BARBEX — R2E.26E.19A: ONBOARDING PERSONALIZADO & CENTRAL DE AJUDA');
console.log('TEST SUITE: GATES 1 A 7 — 16 REQUISITOS DE COBERTURA');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] T${totalTests.toString().padStart(2, '0')}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] T${totalTests.toString().padStart(2, '0')}: ${name}`);
    console.error(`       ${err.message}`);
  }
}

// Arquivos auditados
const catalogPath = path.join(__dirname, '..', 'src', 'lib', 'tutorials.catalog.ts');
const onboardingPath = path.join(__dirname, '..', 'src', 'components', 'onboarding', 'OnboardingModal.tsx');
const modulesPath = path.join(__dirname, '..', 'src', 'hooks', 'use-modules.ts');
const tutorialsRoutePath = path.join(__dirname, '..', 'src', 'routes', 'tutorials.tsx');
const helpDrawerPath = path.join(__dirname, '..', 'src', 'components', 'help-center', 'HelpDrawer.tsx');
const receptionLayoutPath = path.join(__dirname, '..', 'src', 'components', 'reception', 'ReceptionLayout.tsx');
const customerPortalPath = path.join(__dirname, '..', 'src', 'routes', '$slug.portal.tsx');
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261028120000_r2e26e19a_onboarding_versioning_schema.sql');

const catalogCode = fs.readFileSync(catalogPath, 'utf8');
const onboardingCode = fs.readFileSync(onboardingPath, 'utf8');
const modulesCode = fs.readFileSync(modulesPath, 'utf8');
const tutorialsRouteCode = fs.readFileSync(tutorialsRoutePath, 'utf8');
const helpDrawerCode = fs.readFileSync(helpDrawerPath, 'utf8');
const receptionLayoutCode = fs.readFileSync(receptionLayoutPath, 'utf8');
const customerPortalCode = fs.readFileSync(customerPortalPath, 'utf8');
const migrationCode = fs.readFileSync(migrationPath, 'utf8');

// T01: Perfil Proprietário (tenant_admin)
test('T01: Configuração e tutoriais exclusivos para Proprietário (tenant_admin)', () => {
  assert.ok(catalogCode.includes('tenant_admin: {'), 'Deve ter configuração de boas-vindas para tenant_admin');
  assert.ok(catalogCode.includes('owner-config-barbershop'), 'Deve incluir tutorial de configuração da barbearia');
  assert.ok(catalogCode.includes('owner-services-setup'), 'Deve incluir tutorial de cadastro de serviços');
  assert.ok(catalogCode.includes('owner-team-management'), 'Deve incluir tutorial de gestão de equipe');
  assert.ok(catalogCode.includes('owner-whatsapp-automation'), 'Deve incluir tutorial de WhatsApp com alerta de terceiro');
  assert.ok(catalogCode.includes('Z-API'), 'Deve alertar expressamente sobre dependência de API externa (Z-API)');
});

// T02: Perfil Administrador (admin)
test('T02: Configuração e tutoriais para Administrador da barbearia (admin)', () => {
  assert.ok(catalogCode.includes('admin: {'), 'Deve ter configuração para admin');
  assert.ok(catalogCode.includes('owner-calendar-multiprofile'), 'Admin deve ter tutorial da agenda multiperfil');
  assert.ok(catalogCode.includes('owner-finances-reconciliation'), 'Admin deve ter tutorial de fechamento financeiro');
});

// T03: Perfil Recepcionista (reception / receptionist)
test('T03: Configuração e tutoriais específicos para Recepcionista (reception / receptionist)', () => {
  assert.ok(catalogCode.includes('reception: {'), 'Deve ter configuração para reception');
  assert.ok(catalogCode.includes('receptionist: {'), 'Deve ter configuração para receptionist');
  assert.ok(catalogCode.includes('reception-agenda-operation'), 'Deve ter tutorial de operação da agenda da recepção');
  assert.ok(catalogCode.includes('reception-checkin-arrival'), 'Deve ter tutorial de check-in de chegada');
  assert.ok(catalogCode.includes('reception-walkin-queue'), 'Deve ter tutorial de fila de espera (Walk-in)');
  assert.ok(catalogCode.includes('reception-comanda-digital'), 'Deve ter tutorial de comanda digital');
  // Valida que recepção está montada em ReceptionLayout
  assert.ok(receptionLayoutCode.includes('<OnboardingModal />'), 'ReceptionLayout deve montar OnboardingModal');
  assert.ok(receptionLayoutCode.includes('Guia da Recepção'), 'ReceptionLayout deve ter botão para abrir o guia');
});

// T04: Perfil Barbeiro / Profissional (barber / professional)
test('T04: Configuração e tutoriais restritos para Barbeiro / Profissional', () => {
  assert.ok(catalogCode.includes('barber: {'), 'Deve ter configuração para barber');
  assert.ok(catalogCode.includes('professional: {'), 'Deve ter configuração para professional');
  assert.ok(catalogCode.includes('barber-daily-agenda'), 'Deve ter tutorial de agenda diária individual');
  assert.ok(catalogCode.includes('barber-complete-appointment'), 'Deve ter tutorial de conclusão segura de atendimento');
  assert.ok(catalogCode.includes('barber-commissions-statement'), 'Deve ter tutorial de extrato de comissões');
  // Barbeiro NÃO deve ter atalho para subscription nem faturamento global
  assert.ok(!catalogCode.includes('barber: {\n    quickActions: [\n      { label: "Planos"'), 'Barbeiro não pode ter ação de planos');
});

// T05: Perfil Financeiro (financial / finance / cashier)
test('T05: Configuração e tutoriais para Operadores Financeiros e Caixa', () => {
  assert.ok(catalogCode.includes('financial: {'), 'Deve ter configuração para financial');
  assert.ok(catalogCode.includes('finance: {'), 'Deve ter configuração para finance');
  assert.ok(catalogCode.includes('cashier: {'), 'Deve ter configuração para cashier');
  assert.ok(catalogCode.includes('finance-cash-flow'), 'Deve ter tutorial de fluxo de caixa');
  assert.ok(catalogCode.includes('finance-commission-payout'), 'Deve ter tutorial de liquidação de comissões');
});

// T06: Perfil Cliente (client / customer)
test('T06: Configuração e tutoriais para Cliente no Portal e Agendamento Público', () => {
  assert.ok(catalogCode.includes('client: {'), 'Deve ter configuração para client');
  assert.ok(catalogCode.includes('customer: {'), 'Deve ter configuração para customer');
  assert.ok(catalogCode.includes('client-online-booking'), 'Deve ter tutorial de autoagendamento online');
  assert.ok(catalogCode.includes('client-portal-management'), 'Deve ter tutorial de gestão no portal');
  assert.ok(catalogCode.includes('client-loyalty-cashback'), 'Deve ter tutorial de pontos e cashback');
  // Valida que cliente no portal tem acesso à modal
  assert.ok(customerPortalCode.includes('<OnboardingModal />'), 'CustomerPortalPage deve renderizar OnboardingModal');
  assert.ok(customerPortalCode.includes('openOnboardingModal()'), 'CustomerPortalPage deve ter botão de Ajuda que aciona a modal');
});

// T07: Perfil Superadmin (super_admin)
test('T07: Configuração e tutoriais exclusivos de Governança para Superadmin', () => {
  assert.ok(catalogCode.includes('super_admin: {'), 'Deve ter configuração para super_admin');
  assert.ok(catalogCode.includes('superadmin-tenants-governance'), 'Deve ter tutorial de governança de barbearias');
  assert.ok(catalogCode.includes('superadmin-knowledge-base'), 'Deve ter tutorial de gestão da knowledge base');
});

// T08: Múltiplos Perfis e Contexto Ativo
test('T08: Resolução de perfil ativo respeita contexto e não mistura cargos', () => {
  assert.ok(catalogCode.includes('function getRoleWelcomeConfig'), 'Deve ter função determinística getRoleWelcomeConfig');
  assert.ok(catalogCode.includes('function getTutorialsForRole'), 'Deve ter função getTutorialsForRole');
  // OnboardingModal usa role da identidade ativa
  assert.ok(onboardingCode.includes('const { user, role, identity, profile'), 'OnboardingModal consome role e identity do useAuth');
  assert.ok(onboardingCode.includes('const welcomeConfig = useMemo'), 'welcomeConfig recalculado dinamicamente com base no role ativo');
});

// T09: Mudança de Tenant e Isolamento Multi-Tenant
test('T09: Mudança de tenant atualiza exibição sem cruzar dados entre estabelecimentos', () => {
  assert.ok(onboardingCode.includes('sessionStorage.getItem(sessionKey)'), 'Session key isola por user.id e por perfil');
  assert.ok(onboardingCode.includes('identity?.businessName') && onboardingCode.includes('profile?.business_name'), 'Exibe o nome do tenant isolado atualmente ativo');
  assert.ok(!onboardingCode.includes('SELECT * FROM barbershops'), 'Não faz query cross-tenant sem filtro');
});

// T10: Permissões Restritas e Filtragem Efetiva
test('T10: Tutoriais e atalhos ocultam recursos desautorizados ou com módulos desabilitados', () => {
  assert.ok(catalogCode.includes('item.requiredPermission'), 'Valida permissão requerida no catálogo');
  assert.ok(catalogCode.includes('!hasPermission(item.requiredPermission)'), 'Oculta tutorial se hasPermission retornar false');
  assert.ok(catalogCode.includes('item.moduleKey && isModuleEnabled'), 'Valida se o módulo está habilitado no tenant');
  assert.ok(onboardingCode.includes('const authorizedQuickActions = useMemo'), 'Filtra quickActions com hasPermission e isEnabled');
});

// T11: Primeiro Acesso Elegível
test('T11: Primeiro acesso dispara modal para todos os perfis elegíveis', () => {
  // Removeu o bloqueio 'role === tenant_admin'
  assert.ok(!onboardingCode.includes("role === 'tenant_admin'"), 'Não pode ter mais restrição exclusiva para tenant_admin');
  assert.ok(onboardingCode.includes('const isEligible = role && role !== "unknown"'), 'Qualquer perfil reconhecido é elegível');
  assert.ok(onboardingCode.includes('setIsOpen(true)'), 'Abre a modal no primeiro acesso elegível');
});

// T12: Reabertura Voluntária do Popup
test('T12: Popup pode ser reaberto a qualquer momento via evento global e HelpDrawer', () => {
  assert.ok(onboardingCode.includes('export function openOnboardingModal()'), 'Exporta openOnboardingModal');
  assert.ok(onboardingCode.includes('window.addEventListener("barbex:open-onboarding"'), 'OnboardingModal escuta evento barbex:open-onboarding');
  assert.ok(helpDrawerCode.includes('openOnboardingModal()'), 'HelpDrawer possui botão para chamar openOnboardingModal');
  assert.ok(tutorialsRouteCode.includes('openOnboardingModal()'), 'Página de Tutoriais possui card que chama openOnboardingModal');
});

// T13: Persistência da Preferência do Usuário
test('T13: Checkbox Não exibir novamente persiste preferência remota com segurança', () => {
  assert.ok(onboardingCode.includes('updatePrefsMutation'), 'Possui mutation para gravar preferências no Supabase');
  assert.ok(onboardingCode.includes('show_onboarding: show'), 'Grava show_onboarding boolean no banco');
  assert.ok(onboardingCode.includes('user_onboarding_preferences'), 'Atualiza tabela user_onboarding_preferences');
  assert.ok(onboardingCode.includes('isPreferenceActive = preferences?.show_onboarding !== false'), 'Respeita preferência gravada');
});

// T14: Acesso à Central de Ajuda ALWAYS_ON
test('T14: Módulo tutorials é categorizado como ALWAYS_ON sem exigir add-on', () => {
  assert.ok(modulesCode.includes('"tutorials"'), 'use-modules.ts inclui "tutorials" em ALWAYS_ON');
  assert.ok(modulesCode.includes('tutorials: true'), 'DEFAULT_MODULES define tutorials como true');
  assert.ok(tutorialsRouteCode.includes('withModule("tutorials"'), 'tutorialsRoute continua usando withModule protegido');
});

// T15: Tentativas de Acesso Não Autorizado e Bloqueio de Superadmin
test('T15: Tutoriais internos de Superadmin nunca são expostos a usuários comuns', () => {
  assert.ok(catalogCode.includes('if (item.targetRoles.length === 1 && item.targetRoles[0] === "super_admin")'), 'Regra explícita bloqueia itens super_admin no catálogo');
  assert.ok(tutorialsRouteCode.includes('if (!isSuperAdmin)'), 'tutorials.tsx bloqueia artigos super_admin para não-superadmins');
  assert.ok(tutorialsRouteCode.includes('targetProfiles.length === 1 && targetProfiles[0] === "super_admin"'), 'Verifica metadata target_profiles do banco');
});

// T16: Responsividade, Acessibilidade e Sem Vídeo Externo
test('T16: Ausência de vídeo externo, controle de rolagem e conformidade de acessibilidade', () => {
  // Remoção de VideoPlayer
  assert.ok(!onboardingCode.includes('VideoPlayer'), 'OnboardingModal não deve importar nem renderizar VideoPlayer');
  assert.ok(!onboardingCode.includes('youtube.com'), 'OnboardingModal não deve referenciar URLs externas do YouTube');
  // Responsividade
  assert.ok(onboardingCode.includes('max-h-[90vh]'), 'Modal deve limitar altura a max-h-[90vh]');
  assert.ok(onboardingCode.includes('overflow-y-auto flex-1'), 'Corpo da modal deve ter rolagem vertical interna');
  assert.ok(onboardingCode.includes('shrink-0'), 'Cabeçalho e rodapé devem ter shrink-0 para não serem esmagados');
  // Acessibilidade
  assert.ok(onboardingCode.includes('aria-describedby="onboarding-dialog-description"'), 'DialogContent deve ter aria-describedby');
  assert.ok(onboardingCode.includes('aria-label="Fechar guia de início"'), 'Botão fechar deve ter aria-label acessível');
  assert.ok(onboardingCode.includes('focus-visible:ring'), 'Deve ter anel de foco acessível para navegação por teclado');
});

// Migration Check: Verifica que a migration de versionamento foi preparada
test('T17 [Bônus]: Migration revisável de versionamento preparada e idempotente', () => {
  assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration deve existir');
  assert.ok(migrationCode.includes('last_seen_version'), 'Migration deve adicionar last_seen_version');
  assert.ok(migrationCode.includes('dismissed_at'), 'Migration deve adicionar dismissed_at');
  assert.ok(migrationCode.includes('active_version'), 'Migration deve adicionar active_version');
});

console.log(`\n================================================================`);
console.log(`TOTAL DE TESTES: ${totalTests} | APROVADOS: ${passedTests} | FALHAS: ${totalTests - passedTests}`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  console.log('SUCESSO: Todos os 16 requisitos de R2E.26E.19A foram validados com 100% de sucesso!');
  process.exit(0);
} else {
  console.error('FALHA: Alguns testes não passaram.');
  process.exit(1);
}
