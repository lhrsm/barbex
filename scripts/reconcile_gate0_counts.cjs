const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Carregar os 58 artigos da produção atual
const dumpPath = path.join(__dirname, 'live_58_articles_dump.json');
const currentDb = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

// 2. Os 7 novos artigos P1
const p1Articles = [
  { id: 'e59a721d-9e0c-4c48-8df1-3f628ab29001', title: 'Como cadastrar clientes no balcão', profile_target: ['reception', 'tenant_admin', 'admin'], type: 'document', status: 'published' },
  { id: 'e59a721d-9e0c-4c48-8df1-3f628ab29002', title: 'Como validar carteirinha e QR Code de assinantes', profile_target: ['reception', 'barber', 'tenant_admin', 'admin'], type: 'document', status: 'published' },
  { id: 'e59a721d-9e0c-4c48-8df1-3f628ab29003', title: 'Como convidar usuários e configurar permissões', profile_target: ['tenant_admin', 'admin', 'owner'], type: 'document', status: 'published' },
  { id: 'e59a721d-9e0c-4c48-8df1-3f628ab29004', title: 'Como utilizar o Centro de Comando e os indicadores operacionais', profile_target: ['tenant_admin', 'admin', 'owner'], type: 'document', status: 'published' },
  { id: 'e59a721d-9e0c-4c48-8df1-3f628ab29005', title: 'Como bloquear horários e solicitar folgas', profile_target: ['barber', 'reception', 'tenant_admin', 'admin'], type: 'document', status: 'published' },
  { id: 'e59a721d-9e0c-4c48-8df1-3f628ab29006', title: 'Como funciona o agendamento em grupo', profile_target: ['client', 'customer', 'reception', 'tenant_admin', 'admin'], type: 'document', status: 'published' },
  { id: 'e59a721d-9e0c-4c48-8df1-3f628ab29007', title: 'Como configurar o portfólio e a página pública profissional', profile_target: ['barber', 'tenant_admin', 'admin'], type: 'document', status: 'published' }
];

const postDb = [...currentDb, ...p1Articles];

// 3. Catálogo estático
const catalogPath = path.join(__dirname, '..', 'src', 'lib', 'tutorials.catalog.ts');
const catalogContent = fs.readFileSync(catalogPath, 'utf8');

const SEMANTIC_EQUIVALENCES = {
  'owner-config-barbershop': { canonicalDbPrefix: 'Como configurar sua barbearia' },
  'owner-configure-team': { canonicalDbPrefix: 'Como cadastrar barbeiros' },
  'owner-configure-services': { canonicalDbPrefix: 'Como criar serviços' },
  'owner-operating-hours': { canonicalDbPrefix: 'Como evitar conflitos' },
  'owner-pix-config': { canonicalDbPrefix: 'Como configurar PIX' },
  'owner-cashier-closing': { canonicalDbPrefix: 'Como funciona o financeiro' },
  'owner-commission-rates': { canonicalDbPrefix: 'Como configurar comissão' },
  'owner-financial-reports': { canonicalDbPrefix: 'Como usar a Visão Gerencial' },
  'barber-manage-agenda': { canonicalDbPrefix: 'Como concluir ou cancelar' },
  'barber-track-commissions': { canonicalDbPrefix: 'Como o barbeiro acompanha' },
  'reception-schedule-appointment': { canonicalDbPrefix: 'Como criar um novo agendamento' },
  'reception-walkin': { canonicalDbPrefix: 'Como atender clientes sem agendamento' },
  'reception-comanda': { canonicalDbPrefix: 'Como usar a Comanda Digital' },
  'reception-checkin': { canonicalDbPrefix: 'Como usar o Check-in por QR Code' },
  'customer-book-online': { canonicalDbPrefix: 'Como o cliente agenda pelo site' },
  'customer-manage-appointments': { canonicalDbPrefix: 'Como reagendar trocando' },
  'customer-club-benefits': { canonicalDbPrefix: 'Como funciona o portal do cliente' }
};

const catalogItemRegex = /{\s*id:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]+)['"][\s\S]*?targetRoles:\s*\[([\s\S]*?)\],/g;
const catalogArticles = [];
let match;
while ((match = catalogItemRegex.exec(catalogContent)) !== null) {
  const id = match[1];
  const title = match[2];
  const targetRolesRaw = match[3];
  const targetRoles = targetRolesRaw.split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  catalogArticles.push({ id, title, targetRoles });
}

function analyzeRole(articles, role, isAnon = false) {
  const isSuperAdmin = role === 'super_admin';

  // 1. Persistidos no banco com a role ou alvo cliente
  const directTargetDb = articles.filter(art => {
    const pt = art.profile_target || [];
    if (isSuperAdmin || role === 'tenant_admin' || role === 'admin') return true;
    if (role === 'reception') return pt.includes('reception') || pt.includes('receptionist');
    if (role === 'barber') return pt.includes('barber') || pt.includes('professional');
    if (role === 'financial') return pt.includes('financial') || pt.includes('finance') || pt.includes('cashier');
    if (role === 'client') return pt.includes('client') || pt.includes('customer');
    if (isAnon) return pt.includes('client') || pt.includes('customer');
    return false;
  });

  // 2. Retornados pela RLS no PostgreSQL
  const rlsRows = articles.filter(art => {
    const pt = art.profile_target || [];
    const isClientTarget = pt.includes('client') || pt.includes('customer');
    if (isClientTarget) return true;
    if (isAnon) return false;
    if (isSuperAdmin || role === 'admin' || role === 'tenant_admin') return true;
    if (pt.length === 0) return true;
    return pt.includes(role);
  });

  // 3. Aceitos pelo filtro do Frontend (safeDb)
  const safeDb = rlsRows.filter(art => {
    if (isAnon) {
      const targets = Array.isArray(art.profile_target) ? art.profile_target : [];
      return (targets.includes('client') || targets.includes('customer')) && !art.is_admin_only && art.type !== 'super_admin_internal';
    }
    if (isSuperAdmin) return true;
    if (art.type === 'super_admin_internal') return false;
    const targets = Array.isArray(art.profile_target) ? art.profile_target : [];
    if (targets.length === 1 && targets[0] === 'super_admin') return false;
    const isAdminRole = role === 'tenant_admin' || role === 'admin' || role === 'manager';
    if (art.is_admin_only && !isAdminRole) return false;
    if (targets.length > 0 && role) {
      const roleMatches =
        targets.includes(role) ||
        (role === 'tenant_admin' && targets.includes('admin')) ||
        (role === 'admin' && targets.includes('tenant_admin')) ||
        (role === 'reception' && targets.includes('receptionist')) ||
        (role === 'receptionist' && targets.includes('reception')) ||
        (role === 'barber' && targets.includes('professional')) ||
        (role === 'professional' && targets.includes('barber')) ||
        (role === 'financial' && (targets.includes('finance') || targets.includes('cashier'))) ||
        (role === 'finance' && (targets.includes('financial') || targets.includes('cashier'))) ||
        (role === 'cashier' && (targets.includes('financial') || targets.includes('finance'))) ||
        (role === 'customer' && targets.includes('client')) ||
        (role === 'client' && targets.includes('customer'));
      if (!roleMatches) return false;
    }
    return true;
  });

  // 4. Catálogo estático exclusivo (não deduplicado)
  const articleMap = new Map();
  safeDb.forEach(art => articleMap.set(art.id, art));

  const roleCatalog = catalogArticles.filter(catItem => {
    if (isSuperAdmin) return true;
    return catItem.targetRoles.includes(role) ||
           (role === 'client' && catItem.targetRoles.includes('customer')) ||
           (role === 'reception' && catItem.targetRoles.includes('receptionist')) ||
           (role === 'barber' && catItem.targetRoles.includes('professional'));
  });

  const staticExclusive = [];
  roleCatalog.forEach(catItem => {
    const equiv = SEMANTIC_EQUIVALENCES[catItem.id];
    let matching = null;
    if (equiv) {
      matching = safeDb.find(a => a.title && a.title.toLowerCase().startsWith(equiv.canonicalDbPrefix.toLowerCase()));
    } else {
      matching = safeDb.find(a => a.title && a.title.trim().toLowerCase() === catItem.title.trim().toLowerCase());
    }
    if (!matching) {
      articleMap.set(catItem.id, catItem);
      staticExclusive.push(catItem.id);
    }
  });

  // 5. Efetivamente exibidos na UI (/tutorials)
  const effectivelyDisplayed = isAnon ? 0 : articleMap.size;

  return {
    directDb: directTargetDb.length,
    rlsCount: rlsRows.length,
    safeDbCount: safeDb.length,
    staticExclusiveCount: staticExclusive.length,
    staticExclusive,
    effectivelyDisplayed,
    uiTotalMap: articleMap.size
  };
}

const roles = [
  { role: 'client', name: 'Cliente Autenticado' },
  { role: 'reception', name: 'Recepção' },
  { role: 'barber', name: 'Barbeiro' },
  { role: 'financial', name: 'Financeiro' },
  { role: 'tenant_admin', name: 'Proprietário / Admin' },
  { role: 'super_admin', name: 'Super Admin' }
];

console.log('========================================================================================================');
console.log('RECONCILIAÇÃO EXATA DAS 5 DIMENSÕES DE CONTAGEM — BASELINE (58) vs PÓS-P1 (65)');
console.log('========================================================================================================\n');

console.log('| Perfil | Estado | 1. DB Direto | 2. RLS Retornados | 3. Frontend safeDb | 4. Estáticos Exclusivos | 5. Exibidos na UI (/tutorials) |');
console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: |');

roles.forEach(r => {
  const b = analyzeRole(currentDb, r.role);
  const a = analyzeRole(postDb, r.role);
  console.log(`| **${r.name}** (\`${r.role}\`) | Baseline | ${b.directDb} | ${b.rlsCount} | ${b.safeDbCount} | ${b.staticExclusiveCount} | **${b.effectivelyDisplayed}** |`);
  console.log(`| | **Pós-P1** | **${a.directDb}** (+${a.directDb - b.directDb}) | **${a.rlsCount}** (+${a.rlsCount - b.rlsCount}) | **${a.safeDbCount}** (+${a.safeDbCount - b.safeDbCount}) | **${a.staticExclusiveCount}** | **${a.effectivelyDisplayed}** (+${a.effectivelyDisplayed - b.effectivelyDisplayed}) |`);
});

const anonB = analyzeRole(currentDb, 'client', true);
const anonA = analyzeRole(postDb, 'client', true);
console.log(`| **Visitante Anônimo** *(Deslogado)* | Baseline | ${anonB.directDb} | ${anonB.rlsCount} | ${anonB.safeDbCount} | ${anonB.staticExclusiveCount} | **0 (Bloqueado por Auth)** |`);
console.log(`| | **Pós-P1** | **${anonA.directDb}** (+${anonA.directDb - anonB.directDb}) | **${anonA.rlsCount}** (+${anonA.rlsCount - anonB.rlsCount}) | **${anonA.safeDbCount}** (+${anonA.safeDbCount - anonB.safeDbCount}) | **${anonA.staticExclusiveCount}** | **0 (Bloqueado por Auth)** |`);

console.log('\n========================================================================================================');
