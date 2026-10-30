const fs = require('fs');
const path = require('path');

// 1. Carregar baseline original dos 58 artigos reais da produção
const originalArticles = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'live_58_articles_dump.json'), 'utf8')
);

// 2. Extrair os 7 artigos da migration P1
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261030130000_r2e26e20c4_help_center_p1_operational_tutorials.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

const p1Articles = [
  {
    id: 'e59a721d-9e0c-4c48-8df1-3f628ab29001',
    title: 'Como cadastrar clientes no balcão',
    profile_target: ['reception', 'tenant_admin', 'admin'],
    type: 'document',
    status: 'published'
  },
  {
    id: 'e59a721d-9e0c-4c48-8df1-3f628ab29002',
    title: 'Como validar carteirinha e QR Code de assinantes',
    profile_target: ['reception', 'barber', 'tenant_admin', 'admin'],
    type: 'document',
    status: 'published'
  },
  {
    id: 'e59a721d-9e0c-4c48-8df1-3f628ab29003',
    title: 'Como convidar usuários e configurar permissões',
    profile_target: ['tenant_admin', 'admin', 'owner'],
    type: 'document',
    status: 'published'
  },
  {
    id: 'e59a721d-9e0c-4c48-8df1-3f628ab29004',
    title: 'Como utilizar o Centro de Comando e os indicadores operacionais',
    profile_target: ['tenant_admin', 'admin', 'owner'],
    type: 'document',
    status: 'published'
  },
  {
    id: 'e59a721d-9e0c-4c48-8df1-3f628ab29005',
    title: 'Como bloquear horários e solicitar folgas',
    profile_target: ['barber', 'reception', 'tenant_admin', 'admin'],
    type: 'document',
    status: 'published'
  },
  {
    id: 'e59a721d-9e0c-4c48-8df1-3f628ab29006',
    title: 'Como funciona o agendamento em grupo',
    profile_target: ['client', 'customer', 'reception', 'tenant_admin', 'admin'],
    type: 'document',
    status: 'published'
  },
  {
    id: 'e59a721d-9e0c-4c48-8df1-3f628ab29007',
    title: 'Como configurar o portfólio e a página pública profissional',
    profile_target: ['barber', 'tenant_admin', 'admin'],
    type: 'document',
    status: 'published'
  }
];

const mergedDbArticles = [...originalArticles, ...p1Articles];

console.log("================================================================");
console.log("BARBEX — SIMULAÇÃO EXATA DE CONTAGENS POR PERFIL (R2E.26E.20C.4A)");
console.log("================================================================\n");

// Extrair catálogo estático
const catalogPath = path.join(__dirname, '..', 'src', 'lib', 'tutorials.catalog.ts');
const catalogContent = fs.readFileSync(catalogPath, 'utf8');

// Equivalências semânticas definidas no frontend
const SEMANTIC_EQUIVALENCES = {
  "owner-config-barbershop": { canonicalDbPrefix: "Como configurar sua barbearia" },
  "owner-configure-team": { canonicalDbPrefix: "Como cadastrar barbeiros" },
  "owner-configure-services": { canonicalDbPrefix: "Como criar serviços" },
  "owner-operating-hours": { canonicalDbPrefix: "Como evitar conflitos" },
  "owner-pix-config": { canonicalDbPrefix: "Como configurar PIX" },
  "owner-cashier-closing": { canonicalDbPrefix: "Como funciona o financeiro" },
  "owner-commission-rates": { canonicalDbPrefix: "Como configurar comissão" },
  "owner-financial-reports": { canonicalDbPrefix: "Como usar a Visão Gerencial" },
  "barber-manage-agenda": { canonicalDbPrefix: "Como concluir ou cancelar" },
  "barber-track-commissions": { canonicalDbPrefix: "Como o barbeiro acompanha" },
  "reception-schedule-appointment": { canonicalDbPrefix: "Como criar um novo agendamento" },
  "reception-walkin": { canonicalDbPrefix: "Como atender clientes sem agendamento" },
  "reception-comanda": { canonicalDbPrefix: "Como usar a Comanda Digital" },
  "reception-checkin": { canonicalDbPrefix: "Como usar o Check-in por QR Code" },
  "customer-book-online": { canonicalDbPrefix: "Como o cliente agenda pelo site" },
  "customer-manage-appointments": { canonicalDbPrefix: "Como reagendar trocando" },
  "customer-club-benefits": { canonicalDbPrefix: "Como funciona o portal do cliente" }
};

// Parse dos itens do catálogo estático
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

console.log(`Itens no catálogo estático analisados: ${catalogArticles.length}`);

// Função que emula a lógica exata de PostgreSQL RLS + useMemo do tutorials.tsx
function computeArticlesForRole(articlesList, role, isAnon = false) {
  const isSuperAdmin = role === 'super_admin';
  const aliases = new Map();

  // 1. STAGE 1: PostgreSQL RLS Filter (Server-side)
  const rlsRows = articlesList.filter(art => {
    const pt = art.profile_target || [];
    const isClientTarget = pt.includes('client') || pt.includes('customer');
    if (isClientTarget) return true;
    if (isAnon) return false;
    if (isSuperAdmin || role === 'admin' || role === 'tenant_admin') return true;
    if (pt.length === 0) return true;
    return pt.includes(role);
  });

  // 2. STAGE 2: safeDb filtering (Client-side)
  const safeDb = rlsRows.filter((art) => {
    if (isAnon) {
      const targets = Array.isArray(art.profile_target) ? art.profile_target : [];
      return (targets.includes("client") || targets.includes("customer")) && !art.is_admin_only && art.type !== "super_admin_internal";
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
        (role === "tenant_admin" && targets.includes("admin")) ||
        (role === "admin" && targets.includes("tenant_admin")) ||
        (role === "reception" && targets.includes("receptionist")) ||
        (role === "receptionist" && targets.includes("reception")) ||
        (role === "barber" && targets.includes("professional")) ||
        (role === "professional" && targets.includes("barber")) ||
        (role === "financial" && (targets.includes("finance") || targets.includes("cashier"))) ||
        (role === "finance" && (targets.includes("financial") || targets.includes("cashier"))) ||
        (role === "cashier" && (targets.includes("financial") || targets.includes("finance"))) ||
        (role === "customer" && targets.includes("client")) ||
        (role === "client" && targets.includes("customer"));

      if (!roleMatches) return false;
    }

    return true;
  });

  const articleMap = new Map();
  safeDb.forEach(art => articleMap.set(art.id, art));

  // 3. STAGE 3: Unificação com Catálogo Estático e Deduplicação
  const roleCatalog = catalogArticles.filter(catItem => {
    if (isSuperAdmin) return true;
    return catItem.targetRoles.includes(role) ||
           (role === 'client' && catItem.targetRoles.includes('customer')) ||
           (role === 'reception' && catItem.targetRoles.includes('receptionist')) ||
           (role === 'barber' && catItem.targetRoles.includes('professional'));
  });

  const staticAdded = [];
  roleCatalog.forEach(catItem => {
    const equiv = SEMANTIC_EQUIVALENCES[catItem.id];
    let matchingDbArticle = null;

    if (equiv) {
      matchingDbArticle = safeDb.find(dbArt => dbArt.title && dbArt.title.toLowerCase().startsWith(equiv.canonicalDbPrefix.toLowerCase()));
    } else {
      matchingDbArticle = safeDb.find(dbArt => dbArt.title && dbArt.title.trim().toLowerCase() === catItem.title.trim().toLowerCase());
    }

    if (matchingDbArticle) {
      aliases.set(catItem.id, matchingDbArticle.id);
    } else {
      articleMap.set(catItem.id, catItem);
      staticAdded.push(catItem.id);
    }
  });

  return {
    rlsCount: rlsRows.length,
    dbCount: safeDb.length,
    uiCount: articleMap.size,
    staticAdded,
    safeDb,
    articles: Array.from(articleMap.values())
  };
}

const rolesToTest = [
  { role: 'client', label: 'Cliente (Autenticado)' },
  { role: 'reception', label: 'Recepção' },
  { role: 'barber', label: 'Barbeiro' },
  { role: 'financial', label: 'Financeiro' },
  { role: 'tenant_admin', label: 'Proprietário / Admin' },
  { role: 'super_admin', label: 'Super Admin' }
];

console.log("\n--- RESULTADO DA CONTAGEM DEFINITIVA: BASELINE (58) vs PÓS-P1 (65) ---");
console.log("| Perfil | Baseline DB (safeDb) | Pós-P1 DB (safeDb) | Variação DB | Baseline UI | Pós-P1 UI | Variação UI | Artigos P1 Adicionados |");
console.log("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |");

rolesToTest.forEach(({ role, label }) => {
  const base = computeArticlesForRole(originalArticles, role);
  const post = computeArticlesForRole(mergedDbArticles, role);
  let p1Names = [];
  if (role === 'client') p1Names = ['T06'];
  if (role === 'reception') p1Names = ['T01', 'T02', 'T05', 'T06'];
  if (role === 'barber') p1Names = ['T02', 'T05', 'T07'];
  if (role === 'financial') p1Names = ['(Nenhum)'];
  if (role === 'tenant_admin') p1Names = ['T01 a T07 (Todos)'];
  if (role === 'super_admin') p1Names = ['T01 a T07 (Todos)'];

  console.log(`| ${label} (\`${role}\`) | ${base.dbCount} | ${post.dbCount} | +${post.dbCount - base.dbCount} | ${base.uiCount} | ${post.uiCount} | +${post.uiCount - base.uiCount} | ${p1Names.join(', ')} |`);
});

const anonBase = computeArticlesForRole(originalArticles, 'client', true);
const anonPost = computeArticlesForRole(mergedDbArticles, 'client', true);
console.log(`| Visitante Anônimo (RLS) | ${anonBase.dbCount} | ${anonPost.dbCount} | +${anonPost.dbCount - anonBase.dbCount} | ${anonBase.uiCount} | ${anonPost.uiCount} | +${anonPost.uiCount - anonBase.uiCount} | T06 (Público no agendamento) |`);

console.log("\n================================================================");
