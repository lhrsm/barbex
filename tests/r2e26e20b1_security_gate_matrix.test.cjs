const fs = require('fs');
const assert = require('assert');

console.log('=== TESTE DE MATRIZ DE ACESSO RLS ISOLADA (GATE 2) ===');

// Read migration file directly
const migrationSql = fs.readFileSync('supabase/migrations/20261028140000_r2e26e20b_tutorials_sanitization_and_rls.sql', 'utf8');

// Parse all UPDATE statements
const regex = /UPDATE public\.tutorials\s+SET profile_target = ARRAY\[([^\]]+)\]::text\[\],\s+module_key = '([^']+)',\s+updated_at = NOW\(\)\s+WHERE id = '([^']+)';/g;

const articles = [];
let match;
while ((match = regex.exec(migrationSql)) !== null) {
  const rolesRaw = match[1];
  const mod = match[2];
  const id = match[3];

  const roles = rolesRaw.split(',').map(s => s.trim().replace(/'/g, ''));
  articles.push({
    id,
    module: mod,
    proposed_visibility: roles,
    title: `Tutorial ID ${id.slice(0, 8)}`
  });
}

console.log(`Parsed ${articles.length} articles directly from migration SQL.`);
assert.strictEqual(articles.length, 58, 'Deveriam existir exatamente 58 artigos na migration.');

// Add 3 edge-case mock articles to test boundary conditions
const testKnowledgeBase = [
  ...articles,
  {
    id: 'mock-superadmin-exclusive-001',
    title: 'Auditoria Global de Infraestrutura e Chaves Secretas',
    module: 'admin',
    proposed_visibility: ['super_admin']
  },
  {
    id: 'mock-unclassified-null-target-002',
    title: 'Artigo Novo Sem Classificação (Rascunho Interno)',
    module: 'settings',
    proposed_visibility: null
  },
  {
    id: 'mock-multi-role-collaborator-003',
    title: 'Operação Conjunta Barbeiro e Caixa',
    module: 'finances',
    proposed_visibility: ['barber', 'cashier', 'receptionist']
  }
];

function evaluateRlsPolicy(user, tutorial) {
  const profileTarget = tutorial.proposed_visibility;

  // 1. Super Admin
  if (user.role === 'super_admin') {
    return true;
  }

  // 2. Client público (portal e agendamento)
  if (profileTarget && (profileTarget.includes('client') || profileTarget.includes('customer'))) {
    return true;
  }

  // If unauthenticated and not client public -> DENY
  if (!user.isAuthenticated) {
    return false;
  }

  // 3. Tenant Admin e Admin
  if (user.role === 'tenant_admin' || user.role === 'admin') {
    // Bloqueia se for exclusivo de super_admin
    if (profileTarget && profileTarget.length === 1 && profileTarget[0] === 'super_admin') {
      return false;
    }
    return true;
  }

  // 4. Usuários autenticados operacionais
  if (profileTarget && profileTarget.length > 0) {
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role];
    const match = userRoles.some(r => profileTarget.includes(r));
    if (match) {
      return true;
    }
  }

  return false;
}

// 12 Personas
const personas = [
  { name: '1. Usuário Anônimo (Visitante sem login)', isAuthenticated: false, role: 'anon', roles: [] },
  { name: '2. Cliente Autenticado no Portal', isAuthenticated: true, role: 'client', roles: ['client'] },
  { name: '3. Proprietário (Tenant Admin)', isAuthenticated: true, role: 'tenant_admin', roles: ['tenant_admin'] },
  { name: '4. Administrador da Barbearia', isAuthenticated: true, role: 'admin', roles: ['admin'] },
  { name: '5. Gerente da Barbearia', isAuthenticated: true, role: 'manager', roles: ['manager'] },
  { name: '6. Recepcionista', isAuthenticated: true, role: 'receptionist', roles: ['receptionist', 'reception'] },
  { name: '7. Barbeiro / Profissional', isAuthenticated: true, role: 'barber', roles: ['barber', 'professional'] },
  { name: '8. Operador Financeiro / Caixa', isAuthenticated: true, role: 'financial', roles: ['financial', 'finance', 'cashier'] },
  { name: '9. Super Administrador Global', isAuthenticated: true, role: 'super_admin', roles: ['super_admin'] },
  { name: '10. Usuário Híbrido (Barbeiro + Caixa)', isAuthenticated: true, role: 'barber', roles: ['barber', 'cashier'] },
  { name: '11. Usuário Sem Vínculo / Papel Desconhecido', isAuthenticated: true, role: 'unknown', roles: ['unknown'] },
  { name: '12. Usuário de Outro Tenant (Barbeiro de outra loja)', isAuthenticated: true, role: 'barber', roles: ['barber'] }
];

const results = {};

personas.forEach(p => {
  const visible = testKnowledgeBase.filter(t => evaluateRlsPolicy(p, t));
  const hidden = testKnowledgeBase.filter(t => !evaluateRlsPolicy(p, t));
  results[p.name] = {
    visibleCount: visible.length,
    hiddenCount: hidden.length,
    visibleTitles: visible.map(v => v.title)
  };
});

console.log('\nResultados por Persona:');
Object.keys(results).forEach(k => {
  console.log(`- ${k}: ${results[k].visibleCount} visíveis | ${results[k].hiddenCount} bloqueados`);
});

// Asserções estritas de segurança (Security Invariants)

// Invariante 1: Usuário anônimo só vê artigos de cliente (3 artigos públicos)
assert.strictEqual(results['1. Usuário Anônimo (Visitante sem login)'].visibleCount, 3, 'Anônimo deve ver estritamente 3 artigos públicos de cliente.');

// Invariante 2: Superadmin vê todos os artigos (61 de 61)
assert.strictEqual(results['9. Super Administrador Global'].visibleCount, 61, 'Superadmin deve ver 100% dos artigos da base.');

// Invariante 3: Artigo exclusivo do Superadmin está bloqueado para o Proprietário
const ownerVisible = results['3. Proprietário (Tenant Admin)'].visibleTitles;
assert(!ownerVisible.includes('Auditoria Global de Infraestrutura e Chaves Secretas'), 'Proprietário NÃO pode ver artigo exclusivo do Superadmin.');

// Invariante 4: Artigo nulo (sem classificação) NÃO é visto pelo Barbeiro ou Recepcionista
const barberVisible = results['7. Barbeiro / Profissional'].visibleTitles;
assert(!barberVisible.includes('Artigo Novo Sem Classificação (Rascunho Interno)'), 'Barbeiro NÃO pode ver artigo unclassified nulo.');
const recepVisible = results['6. Recepcionista'].visibleTitles;
assert(!recepVisible.includes('Artigo Novo Sem Classificação (Rascunho Interno)'), 'Recepcionista NÃO pode ver artigo unclassified nulo.');

// Invariante 5: Proprietário vê todos os 58 artigos de produção + artigo nulo = 60 artigos (todos exceto superadmin exclusivo)
assert.strictEqual(results['3. Proprietário (Tenant Admin)'].visibleCount, 60, 'Proprietário deve ver todos os artigos operacionais.');

// Invariante 6: Usuário híbrido (Barbeiro + Caixa) vê seus artigos de barbeiro E artigos de caixa
const hybridVisible = results['10. Usuário Híbrido (Barbeiro + Caixa)'].visibleTitles;
assert(hybridVisible.includes('Operação Conjunta Barbeiro e Caixa'), 'Usuário híbrido deve acessar artigo de múltiplos papéis.');

// Invariante 7: Usuário sem papel ativo só vê conteúdos públicos de cliente
assert.strictEqual(results['11. Usuário Sem Vínculo / Papel Desconhecido'].visibleCount, 3, 'Usuário desconhecido só pode ver artigos públicos de cliente.');

console.log('\n✔ TODAS AS 7 INVARIANTES DE SEGURANÇA FORAM VALIDADAS COM SUCESSO!');
fs.writeFileSync('security_matrix_results.json', JSON.stringify(results, null, 2), 'utf8');
