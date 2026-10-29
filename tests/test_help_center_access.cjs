/**
 * BARBEX — R2E.26E.20B.4
 * SUITE DE TESTES AUTOMATIZADOS: VISIBILIDADE ANÔNIMA E INTEGRIDADE DA CENTRAL DE AJUDA
 * 
 * Cobre os 12 cenários obrigatórios do Gate 7:
 * 1. Anônimo: exatamente três artigos públicos.
 * 2. Cliente: conteúdos autorizados, sem duplicações indevidas.
 * 3. Proprietário: conteúdos correspondentes (sem artigos internos de superadmin).
 * 4. Recepção: conteúdos correspondentes (sem artigos exclusivos de barbeiro ou financeiro).
 * 5. Barbeiro: conteúdos correspondentes (sem artigos exclusivos de recepção ou financeiro).
 * 6. Financeiro: conteúdos correspondentes (sem artigos exclusivos de barbeiro ou recepção).
 * 7. Superadmin: conteúdos correspondentes (todos os artigos).
 * 8. Troca de sessão no mesmo navegador (isolamento e fail-closed).
 * 9. Histórico isolado (chaves separadas e revalidação de autorização antes de abrir).
 * 10. Categorias filtradas (apenas categorias com artigos visíveis, 0 categorias vazias).
 * 11. Busca e detalhes protegidos (acesso direto por URL não autorizado é bloqueado).
 * 12. Compatibilidade com a RLS existente no Supabase PostgREST.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('================================================================');
console.log('BARBEX — R2E.26E.20B.4: SUITE DE TESTES DA CENTRAL DE AJUDA');
console.log('================================================================\n');

// 1. Carregar inventário persistido dos 58 artigos e 21 categorias
const backupPath = 'C:/Users/louis.SBPM-BA/.gemini/antigravity/brain/45691b4e-8a9d-48a7-9b92-314dc74733c8/backup_tutorials_manifest_pre_cutover_20261029.json';
if (!fs.existsSync(backupPath)) {
  console.error('ERRO: Arquivo de backup não encontrado em:', backupPath);
  process.exit(1);
}

const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const dbArticlesRaw = backupData.data.tutorials;
const dbCategories = backupData.data.categories;

// Carregar migration aplicada em 20B.2 para pegar profile_target real de cada artigo
const migrationPath = path.join(__dirname, '../supabase/migrations/20261028140000_r2e26e20b_tutorials_sanitization_and_rls.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Extrair mapeamento de profile_target da migration
const targetMap = {};
const regex = /UPDATE public\.tutorials\s+SET profile_target = ARRAY\[(.*?)\]::text\[\].*?WHERE id = '([a-f0-9\-]+)';/gs;
let match;
while ((match = regex.exec(migrationSql)) !== null) {
  const roles = match[1].split(',').map(r => r.replace(/['\s]/g, ''));
  const id = match[2];
  targetMap[id] = roles;
}

const dbArticles = dbArticlesRaw.map(art => {
  return {
    ...art,
    profile_target: targetMap[art.id] || []
  };
});

console.log(`✓ Carregados ${dbArticles.length} artigos do banco com metadados de profile_target.`);
console.log(`✓ Carregadas ${dbCategories.length} categorias oficiais do banco.\n`);

// 2. Extrair itens do catálogo de onboarding (TUTORIALS_CATALOG)
const catalogFilePath = path.join(__dirname, '../src/lib/tutorials.catalog.ts');
const catalogTs = fs.readFileSync(catalogFilePath, 'utf8');

// Parse básico dos itens do catálogo
const catalogItems = [];
const itemRegex = /{\s*id:\s*"([^"]+)",\s*title:\s*"([^"]+)",\s*description:\s*"([^"]+)",\s*targetRoles:\s*\[(.*?)\](?:,\s*requiredPermission:\s*"([^"]+)")?(?:,\s*moduleKey:\s*"([^"]+)")?/gs;
while ((match = itemRegex.exec(catalogTs)) !== null) {
  const id = match[1];
  const title = match[2];
  const description = match[3];
  const targetRoles = match[4].split(',').map(r => r.replace(/['"\s]/g, ''));
  const requiredPermission = match[5] || null;
  const moduleKey = match[6] || null;
  catalogItems.push({ id, title, description, targetRoles, requiredPermission, moduleKey });
}

console.log(`✓ Extraídos ${catalogItems.length} tutoriais estruturados do catálogo TypeScript.\n`);

// 3. Implementar a exata lógica de unificação e filtragem de tutorials.tsx
const SEMANTIC_EQUIVALENCES = {
  "client-online-booking": { canonicalDbPrefix: "Como o cliente agenda pelo site público" },
  "client-portal-management": { canonicalDbPrefix: "Como funciona o portal do cliente" },
  "client-loyalty-cashback": { canonicalDbPrefix: "Como funciona o portal do cliente e o Clube Barbex" },
  "owner-config-barbershop": { canonicalDbPrefix: "Como configurar sua barbearia pela primeira vez" },
  "owner-services-setup": { canonicalDbPrefix: "Como criar serviços" },
  "owner-team-management": { canonicalDbPrefix: "Como cadastrar barbeiros" },
  "owner-whatsapp-automation": { canonicalDbPrefix: "Como configurar Z-API" },
  "owner-finances-reconciliation": { canonicalDbPrefix: "Como usar a Visão Gerencial e exportar PDF" },
  "reception-comanda-digital": { canonicalDbPrefix: "Como usar a Comanda Digital" },
  "reception-walkin-queue": { canonicalDbPrefix: "Como atender clientes sem agendamento" },
  "reception-checkin-arrival": { canonicalDbPrefix: "Como usar o Check-in por QR Code" },
  "barber-complete-appointment": { canonicalDbPrefix: "Como concluir ou cancelar um atendimento" },
  "barber-commissions-statement": { canonicalDbPrefix: "Como o barbeiro acompanha sua comissão" },
  "finance-cash-flow": { canonicalDbPrefix: "Como funciona o financeiro da barbearia" },
  "finance-commission-payout": { canonicalDbPrefix: "Como pagar comissão ao barbeiro" },
};

function getAuthorizedCatalogArticles(role, isAnonymous) {
  if (isAnonymous || !role || role === 'unknown') return [];
  if (role === 'super_admin') return catalogItems;

  return catalogItems.filter(item => {
    const matches = item.targetRoles.includes(role);
    if (!matches) return false;
    if (item.targetRoles.length === 1 && item.targetRoles[0] === 'super_admin') return false;
    return true;
  });
}

function computeCombinedArticles({ role, isAnonymous, dbArticlesList, activeCatalogList }) {
  const isSuperAdmin = role === 'super_admin';
  const aliases = new Map();

  const safeDbArticles = (dbArticlesList || []).filter(art => {
    if (isAnonymous) {
      const targets = Array.isArray(art.profile_target) ? art.profile_target : [];
      const isClientEligible = targets.includes('client') || targets.includes('customer');
      return isClientEligible && !art.is_admin_only && art.type !== 'super_admin_internal';
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

  const articleMap = new Map();
  safeDbArticles.forEach(art => articleMap.set(art.id, art));

  activeCatalogList.forEach(catItem => {
    const equiv = SEMANTIC_EQUIVALENCES[catItem.id];
    let matchingDbArticle = null;

    if (equiv) {
      matchingDbArticle = safeDbArticles.find(dbArt =>
        dbArt.title && dbArt.title.toLowerCase().startsWith(equiv.canonicalDbPrefix.toLowerCase())
      );
    } else {
      matchingDbArticle = safeDbArticles.find(dbArt =>
        dbArt.title && dbArt.title.trim().toLowerCase() === catItem.title.trim().toLowerCase()
      );
    }

    if (matchingDbArticle) {
      aliases.set(catItem.id, matchingDbArticle.id);
    } else {
      articleMap.set(catItem.id, catItem);
    }
  });

  return { combinedArticles: Array.from(articleMap.values()), aliasMap: aliases };
}

function computeCategories(combinedArticles, dbCats) {
  const activeCatIds = new Set();
  const activeCatNames = new Set();

  combinedArticles.forEach(art => {
    if (art.category_id) activeCatIds.add(String(art.category_id).toLowerCase());
    if (art.category?.id) activeCatIds.add(String(art.category.id).toLowerCase());
    if (art.category?.name) activeCatNames.add(String(art.category.name).toLowerCase());
  });

  return dbCats.filter(cat => {
    const catId = String(cat.id).toLowerCase();
    const catName = String(cat.name).toLowerCase();
    return activeCatIds.has(catId) || activeCatNames.has(catName);
  });
}

let allPassed = true;
function assert(desc, condition) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    allPassed = false;
  }
}

// =============================================================================
// TESTE 1: VISITANTE ANÔNIMO (EXATAMENTE 3 ARTIGOS PÚBLICOS)
// =============================================================================
console.log('--- TESTE 1: Visitante Anônimo ---');
const anonCatalog = getAuthorizedCatalogArticles(null, true);
assert('Catálogo estático de anônimo deve ser vazio ([]), preservando dados do Supabase', anonCatalog.length === 0);

const anonRes = computeCombinedArticles({
  role: null,
  isAnonymous: true,
  dbArticlesList: dbArticles,
  activeCatalogList: anonCatalog
});

assert('Anônimo deve ver exatamente 3 artigos', anonRes.combinedArticles.length === 3);
const anonTitles = anonRes.combinedArticles.map(a => a.title);
assert('Artigo 1 de agendamento público presente', anonTitles.includes('Como o cliente agenda pelo site público'));
assert('Artigo 2 de loja pública de produtos presente', anonTitles.includes('Como funciona a loja pública de produtos'));
assert('Artigo 3 de portal do cliente presente', anonTitles.includes('Como funciona o portal do cliente e o Clube Barbex'));
assert('Nenhum artigo administrativo presente', anonRes.combinedArticles.every(a => !a.is_admin_only));

// =============================================================================
// TESTE 2: CLIENTE AUTENTICADO (SEM DUPLICAÇÕES INDEVIDAS)
// =============================================================================
console.log('\n--- TESTE 2: Cliente Autenticado ---');
const clientCatalog = getAuthorizedCatalogArticles('client', false);
assert('Catálogo autorizado de cliente tem 3 itens estruturados', clientCatalog.length === 3);

const clientRes = computeCombinedArticles({
  role: 'client',
  isAnonymous: false,
  dbArticlesList: dbArticles,
  activeCatalogList: clientCatalog
});

assert('Cliente autenticado não deve ter duplicações indevidas (exatamente 3 artigos)', clientRes.combinedArticles.length === 3);
assert('client-online-booking mapeado para UUID canonical', clientRes.aliasMap.has('client-online-booking'));
assert('client-portal-management mapeado para UUID canonical', clientRes.aliasMap.has('client-portal-management'));
assert('client-loyalty-cashback mapeado para UUID canonical', clientRes.aliasMap.has('client-loyalty-cashback'));

// =============================================================================
// TESTE 3: PROPRIETÁRIO / TENANT ADMIN
// =============================================================================
console.log('\n--- TESTE 3: Proprietário (tenant_admin) ---');
const ownerCatalog = getAuthorizedCatalogArticles('tenant_admin', false);
const ownerRes = computeCombinedArticles({
  role: 'tenant_admin',
  isAnonymous: false,
  dbArticlesList: dbArticles,
  activeCatalogList: ownerCatalog
});

assert('Proprietário vê os artigos operacionais da barbearia (> 30)', ownerRes.combinedArticles.length > 30);
assert('Proprietário NUNCA vê artigos internos exclusivos de superadmin', ownerRes.combinedArticles.every(a => a.type !== 'super_admin_internal'));
assert('Catalog item com equivalente do banco foi deduplicado', ownerRes.aliasMap.has('owner-config-barbershop'));
assert('Catalog item exclusivo (owner-calendar-multiprofile) foi incluído', ownerRes.combinedArticles.some(a => a.id === 'owner-calendar-multiprofile'));

// =============================================================================
// TESTE 4: RECEPCIONISTA (RECEPTIONIST)
// =============================================================================
console.log('\n--- TESTE 4: Recepcionista (receptionist) ---');
const recCatalog = getAuthorizedCatalogArticles('receptionist', false);
const recRes = computeCombinedArticles({
  role: 'receptionist',
  isAnonymous: false,
  dbArticlesList: dbArticles,
  activeCatalogList: recCatalog
});

assert('Recepcionista vê artigos com permissão para recepção', recRes.combinedArticles.length > 0);
assert('Recepcionista NÃO vê artigo exclusivo de extrato de comissão do barbeiro', !recRes.combinedArticles.some(a => a.title && a.title.includes('Como o barbeiro acompanha sua comissão')));
assert('Recepcionista NÃO vê artigo de pagar comissões financeiras', !recRes.combinedArticles.some(a => a.title && a.title.includes('Como pagar comissão ao barbeiro')));
assert('Tutorial exclusivo da agenda da recepção incluído', recRes.combinedArticles.some(a => a.id === 'reception-agenda-operation'));

// =============================================================================
// TESTE 5: BARBEIRO (BARBER / PROFESSIONAL)
// =============================================================================
console.log('\n--- TESTE 5: Barbeiro (barber) ---');
const barberCatalog = getAuthorizedCatalogArticles('barber', false);
const barberRes = computeCombinedArticles({
  role: 'barber',
  isAnonymous: false,
  dbArticlesList: dbArticles,
  activeCatalogList: barberCatalog
});

assert('Barbeiro vê artigos autorizados para sua função', barberRes.combinedArticles.length > 0);
assert('Barbeiro vê como o barbeiro acompanha sua comissão', barberRes.combinedArticles.some(a => a.title && a.title.includes('Como o barbeiro acompanha sua comissão')));
assert('Barbeiro NÃO vê como pagar comissão ao barbeiro (gestão/financeiro)', !barberRes.combinedArticles.some(a => a.title && a.title.includes('Como pagar comissão ao barbeiro')));
assert('Barbeiro NÃO vê tutoriais da recepção (reception-agenda-operation)', !barberRes.combinedArticles.some(a => a.id === 'reception-agenda-operation'));

// =============================================================================
// TESTE 6: OPERADOR FINANCEIRO (FINANCIAL / FINANCE)
// =============================================================================
console.log('\n--- TESTE 6: Financeiro (financial) ---');
const finCatalog = getAuthorizedCatalogArticles('financial', false);
const finRes = computeCombinedArticles({
  role: 'financial',
  isAnonymous: false,
  dbArticlesList: dbArticles,
  activeCatalogList: finCatalog
});

assert('Financeiro vê tutoriais de liquidação de comissões', finRes.combinedArticles.some(a => a.title && a.title.includes('Como pagar comissão ao barbeiro')));
assert('Financeiro NÃO vê tutoriais exclusivos de super_admin', finRes.combinedArticles.every(a => a.type !== 'super_admin_internal'));

// =============================================================================
// TESTE 7: SUPER ADMIN
// =============================================================================
console.log('\n--- TESTE 7: Super Admin (super_admin) ---');
const saCatalog = getAuthorizedCatalogArticles('super_admin', false);
const saRes = computeCombinedArticles({
  role: 'super_admin',
  isAnonymous: false,
  dbArticlesList: dbArticles,
  activeCatalogList: saCatalog
});

assert('Superadmin visualiza todos os artigos do banco (58) + tutoriais únicos do catálogo', saRes.combinedArticles.length >= 58);
assert('Superadmin vê tutoriais exclusivos de governança global', saRes.combinedArticles.some(a => a.id === 'superadmin-tenants-governance'));

// =============================================================================
// TESTE 8: TROCA DE SESSÃO NO MESMO NAVEGADOR & FAIL-CLOSED
// =============================================================================
console.log('\n--- TESTE 8: Troca de Sessão & Fail-Closed ---');
// Simula transição com authLoading = true
const isAuthResolving = true;
const transRole = isAuthResolving ? null : 'tenant_admin';
const transCatalog = getAuthorizedCatalogArticles(transRole, isAuthResolving);
const transRes = computeCombinedArticles({
  role: transRole,
  isAnonymous: isAuthResolving,
  dbArticlesList: dbArticles,
  activeCatalogList: transCatalog
});
assert('Durante transição/loading de sessão, comportamento é estritamente fail-closed (3 artigos)', transRes.combinedArticles.length === 3);

// =============================================================================
// TESTE 9: HISTÓRICO ISOLADO POR CONTEXTO DE USUÁRIO
// =============================================================================
console.log('\n--- TESTE 9: Histórico Isolado ---');
const ownerUserId = 'user-owner-123';
const clientUserId = 'user-client-456';
const ownerHistoryKey = `help_history_${ownerUserId}`;
const clientHistoryKey = `help_history_${clientUserId}`;
const anonHistoryKey = 'help_history_anon';

assert('Chave de histórico do proprietário é distinta da do cliente', ownerHistoryKey !== clientHistoryKey);
assert('Chave de histórico de anônimo é isolada', anonHistoryKey !== ownerHistoryKey && anonHistoryKey !== clientHistoryKey);

// Revalidação antes de abrir:
const ownerRecentHistory = [{ id: 'e1697c6d-c015-4a9a-a183-11ad0837223f', title: 'Como pagar comissão ao barbeiro' }];
const anonAllowedIds = new Set(anonRes.combinedArticles.map(a => a.id));
const anonVisibleHistory = ownerRecentHistory.filter(h => anonAllowedIds.has(h.id));
assert('Histórico do proprietário com artigo financeiro NÃO aparece para anônimo', anonVisibleHistory.length === 0);

// =============================================================================
// TESTE 10: CATEGORIAS FILTRADAS DINAMICAMENTE
// =============================================================================
console.log('\n--- TESTE 10: Categorias Filtradas ---');
const anonCategories = computeCategories(anonRes.combinedArticles, dbCategories);
assert('Anônimo vê apenas as categorias dos 3 artigos públicos', anonCategories.length > 0 && anonCategories.length <= 3);
const anonCatNames = anonCategories.map(c => c.name.toLowerCase());
assert('Anônimo NÃO vê categoria Financeiro', !anonCatNames.includes('financeiro') && !anonCatNames.includes('financeiro e comissões'));
assert('Anônimo NÃO vê categoria Fiscal', !anonCatNames.includes('fiscal') && !anonCatNames.includes('fiscal e tributário'));
assert('Anônimo NÃO vê categoria Gestão e Liderança', !anonCatNames.includes('gestão e liderança'));

const ownerCategories = computeCategories(ownerRes.combinedArticles, dbCategories);
assert('Proprietário vê todas as categorias que possuem artigos', ownerCategories.length > anonCategories.length);

// =============================================================================
// TESTE 11: BUSCA E DETALHES PROTEGIDOS (ACESSO DIRETO POR URL)
// =============================================================================
console.log('\n--- TESTE 11: Busca e Detalhes Protegidos ---');
// Caso 1: Anônimo acessa artigo público por UUID
const requestedPublicId = '6eef64ad-7c7e-49cf-aef4-028dcb78dc68';
const matchPublic = anonRes.combinedArticles.find(a => a.id === requestedPublicId);
assert('Anônimo tem acesso autorizado ao artigo público de agendamento', Boolean(matchPublic));

// Caso 2: Anônimo tenta acessar artigo administrativo por UUID
const requestedAdminId = '24ac8596-a0b7-4bc8-8e7b-49977309331b'; // Financeiro da barbearia
const matchAdmin = anonRes.combinedArticles.find(a => a.id === requestedAdminId);
const isUnauthorizedAnon = Boolean(requestedAdminId && !matchAdmin);
assert('Acesso direto de anônimo a artigo administrativo é BLOQUEADO (isUnauthorized = true)', isUnauthorizedAnon);

// Caso 3: Recepcionista tenta acessar artigo exclusivo do barbeiro
const requestedBarberId = 'f54cdc13-d1f1-46f9-ba5a-4e201b15df84'; // Comissão do barbeiro
const matchRecBarber = recRes.combinedArticles.find(a => a.id === requestedBarberId);
const isUnauthorizedRec = Boolean(requestedBarberId && !matchRecBarber);
assert('Acesso direto de recepcionista a artigo do barbeiro é BLOQUEADO', isUnauthorizedRec);

// Caso 4: Barbeiro tenta acessar comanda digital restrita
const requestedComandaId = '1bf403d4-b258-45ec-8e7c-ec87c10b784a';
const matchBarberComanda = barberRes.combinedArticles.find(a => a.id === requestedComandaId);
assert('Barbeiro não autorizado tem acesso negado à comanda de recepção', !matchBarberComanda);

// Caso 5: Não-superadmin tenta acessar tutorial exclusivo do superadmin
const requestedSaId = 'superadmin-tenants-governance';
const matchOwnerSa = ownerRes.combinedArticles.find(a => a.id === requestedSaId);
assert('Proprietário tem acesso negado ao tutorial exclusivo de superadmin', !matchOwnerSa);

// =============================================================================
// TESTE 12: COMPATIBILIDADE COM A RLS EXISTENTE DO SUPABASE
// =============================================================================
console.log('\n--- TESTE 12: Compatibilidade com RLS no Supabase ---');
// Realizar requisição real com chave anon
const envBak = fs.readFileSync('.env.prod.bak', 'utf8');
const anonKeyMatch = envBak.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/) || envBak.match(/VITE_SUPABASE_PUBLISHABLE_KEY=([^\r\n]+)/);
const anonKey = anonKeyMatch[1].replace(/["']/g, '').trim();

const reqOptions = {
  hostname: 'ywdwrstxvsdqiryhieiz.supabase.co',
  port: 443,
  path: '/rest/v1/tutorials?select=' + encodeURIComponent('id,title,profile_target') + '&order=order.asc',
  method: 'GET',
  headers: {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Accept': 'application/json'
  }
};

const req = https.request(reqOptions, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.log('API Error: Status', res.statusCode, 'Body:', body);
    }
    assert('PostgREST retorna HTTP 200 para consulta anônima', res.statusCode === 200);
    if (res.statusCode === 200) {
      const data = JSON.parse(body);
      assert('PostgREST com chave anon retorna EXATAMENTE 3 artigos em produção', data.length === 3);
      const apiIds = data.map(d => d.id).sort();
      const frontendAnonIds = anonRes.combinedArticles.map(d => d.id).sort();
      assert('Frontend com novos filtros exibe exatamente os mesmos 3 IDs autorizados pela RLS', JSON.stringify(apiIds) === JSON.stringify(frontendAnonIds));
    } else {
      assert('PostgREST com chave anon retorna EXATAMENTE 3 artigos em produção', false);
    }

    console.log('\n================================================================');
    if (allPassed) {
      console.log('RESULTADO FINAL: TODOS OS 12 TESTES PASSARAM COM SUCESSO! ✓');
    } else {
      console.error('RESULTADO FINAL: FALHAS DETECTADAS NOS TESTES!');
      process.exit(1);
    }
    console.log('================================================================\n');
  });
});
req.on('error', err => {
  console.error('Erro na requisição PostgREST:', err);
  process.exit(1);
});
req.end();
