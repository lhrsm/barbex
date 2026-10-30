const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoDir = path.join(__dirname, '..');

function runLinkedQuery(sql) {
  const tempFile = path.join(__dirname, `temp_smoke_${Date.now()}.sql`);
  fs.writeFileSync(tempFile, sql, 'utf8');
  try {
    const out = execSync(`npx.cmd supabase db query --linked --file "${tempFile}"`, {
      cwd: repoDir,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024
    });
    const parsed = JSON.parse(out);
    return parsed.rows || parsed;
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('BARBEX — R2E.26E.20D.3: SUITE DE SMOKE TESTS EM PRODUÇÃO (P2)');
console.log('================================================================\n');

// 1. Contagem total de tutoriais
const countRes = runLinkedQuery('SELECT count(*) as total FROM public.tutorials;');
const totalTutorials = parseInt(countRes[0].total, 10);
assert(totalTutorials === 68, `Total de tutoriais em produção é exatamente 68 (obtido: ${totalTutorials})`);

// 2. Validação dos 3 novos artigos P2
const p2Uuids = [
  'e59a721d-9e0c-4c48-8df1-3f628ab29008',
  'e59a721d-9e0c-4c48-8df1-3f628ab29009',
  'e59a721d-9e0c-4c48-8df1-3f628ab29010'
];

const p2Rows = runLinkedQuery(`
  SELECT id, title, description, long_description, category_id, profile_target, status, slug, icon, related_route, "order"
  FROM public.tutorials
  WHERE id::text IN ('${p2Uuids.join("','")}')
  ORDER BY id ASC;
`);

assert(p2Rows.length === 3, `Exatamente 3 artigos P2 encontrados na base (obtido: ${p2Rows.length})`);

p2Rows.forEach(row => {
  assert(row.status === 'published', `Artigo [${row.id.slice(-6)}] está com status = 'published'`);
  assert(row.long_description && row.long_description.length > 500, `Artigo [${row.id.slice(-6)}] possui conteúdo completo (tamanho: ${row.long_description.length} caracteres)`);
  assert(row.description && row.description.length > 20, `Artigo [${row.id.slice(-6)}] possui resumo curto preenchido`);
  assert(row.slug && row.slug.length > 5, `Artigo [${row.id.slice(-6)}] possui slug canônico: ${row.slug}`);
  console.log(`     > [${row.id.slice(-6)}] "${row.title}" | Rota: ${row.related_route} | Ordem: ${row.order} | Perfis: [${row.profile_target.join(', ')}]`);
});

// Validação dos perfis específicos
const art08 = p2Rows.find(r => r.id === 'e59a721d-9e0c-4c48-8df1-3f628ab29008');
assert(
  art08 && art08.profile_target.includes('barber') && art08.profile_target.includes('tenant_admin'),
  'Artigo b29008 contém perfis autorizados barber e tenant_admin'
);

const art09 = p2Rows.find(r => r.id === 'e59a721d-9e0c-4c48-8df1-3f628ab29009');
assert(
  art09 && art09.profile_target.includes('reception') && art09.profile_target.includes('tenant_admin'),
  'Artigo b29009 contém perfis autorizados reception e tenant_admin'
);

const art10 = p2Rows.find(r => r.id === 'e59a721d-9e0c-4c48-8df1-3f628ab29010');
assert(
  art10 && art10.profile_target.includes('reception') && art10.profile_target.includes('tenant_admin'),
  'Artigo b29010 contém perfis autorizados reception e tenant_admin'
);

// 3. Validação dos 7 artigos P1 intactos
const p1Uuids = [
  'e59a721d-9e0c-4c48-8df1-3f628ab29001',
  'e59a721d-9e0c-4c48-8df1-3f628ab29002',
  'e59a721d-9e0c-4c48-8df1-3f628ab29003',
  'e59a721d-9e0c-4c48-8df1-3f628ab29004',
  'e59a721d-9e0c-4c48-8df1-3f628ab29005',
  'e59a721d-9e0c-4c48-8df1-3f628ab29006',
  'e59a721d-9e0c-4c48-8df1-3f628ab29007'
];

const p1Res = runLinkedQuery(`
  SELECT count(*) as cnt
  FROM public.tutorials
  WHERE id::text IN ('${p1Uuids.join("','")}')
    AND status = 'published';
`);
assert(parseInt(p1Res[0].cnt, 10) === 7, `Todos os 7 tutoriais P1 permanecem intactos e publicados`);

// 4. Validação das 21 categorias
const catRes = runLinkedQuery(`SELECT count(*) as cnt FROM public.tutorial_categories;`);
assert(parseInt(catRes[0].cnt, 10) === 21, `Total de 21 categorias de tutoriais permanece inalterado`);

// 5. Validação da migração registrada em schema_migrations
const migRes = runLinkedQuery(`
  SELECT version 
  FROM supabase_migrations.schema_migrations 
  WHERE version = '20261030150000';
`);
assert(migRes.length === 1 && migRes[0].version === '20261030150000', `Versão 20261030150000 registrada com sucesso em schema_migrations`);

// 6. Projeção exata por perfil utilizando o pipeline canônico
console.log('\n--- Projeções por Perfil (Pipeline RLS + safeDb + Catálogo + Deduplicação) ---');
const allArticles = runLinkedQuery(`SELECT id, title, description, category_id, type, status, profile_target, "order" FROM public.tutorials;`);

const tutorialsTsxPath = path.join(repoDir, 'src', 'routes', 'tutorials.tsx');
const tutorialsTsx = fs.readFileSync(tutorialsTsxPath, 'utf8');
const semEqMatch = tutorialsTsx.match(/const\s+SEMANTIC_EQUIVALENCES:\s*Record<[\s\S]*?>\s*=\s*({[\s\S]*?});/);
const SEMANTIC_EQUIVALENCES = eval('(' + semEqMatch[1] + ')');

const catalogPath = path.join(repoDir, 'src', 'lib', 'tutorials.catalog.ts');
const catalogTs = fs.readFileSync(catalogPath, 'utf8');
const itemBlocks = catalogTs.split(/{\s*id:\s*['"]/g).slice(1);
const catalogItems = itemBlocks.map(block => {
  const idMatch = block.match(/^([^'"]+)/);
  const titleMatch = block.match(/title:\s*['"]([^'"]+)['"]/);
  const targetRolesMatch = block.match(/targetRoles:\s*\[([\s\S]*?)\]/);
  return {
    id: idMatch ? idMatch[1] : null,
    title: titleMatch ? titleMatch[1] : null,
    targetRoles: targetRolesMatch 
      ? targetRolesMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean)
      : []
  };
}).filter(i => i.id && i.title);

function simulateRoleExact(role, isAnon = false) {
  const isSuperAdmin = role === 'super_admin';
  const effectiveRole = role;

  // 1. RLS
  const rlsRows = allArticles.filter(art => {
    const pt = art.profile_target || [];
    const isClientTarget = pt.includes('client') || pt.includes('customer');
    if (isClientTarget) return true;
    if (isAnon) return false;
    if (isSuperAdmin || role === 'admin' || role === 'tenant_admin') return true;
    if (pt.length === 0) return true;
    return pt.includes(role);
  });

  // 2. safeDb
  const safeDbArticles = rlsRows.filter(art => {
    if (isAnon) {
      const targets = Array.isArray(art.profile_target) ? art.profile_target : [];
      return (targets.includes('client') || targets.includes('customer')) && art.type !== 'super_admin_internal';
    }
    if (isSuperAdmin) return true;
    if (art.type === 'super_admin_internal') return false;
    const targets = Array.isArray(art.profile_target) ? art.profile_target : [];
    if (targets.length === 1 && targets[0] === 'super_admin') return false;

    if (targets.length > 0 && effectiveRole) {
      const roleMatches =
        targets.includes(effectiveRole) ||
        (effectiveRole === 'tenant_admin' && targets.includes('admin')) ||
        (effectiveRole === 'admin' && targets.includes('tenant_admin')) ||
        (effectiveRole === 'reception' && targets.includes('receptionist')) ||
        (effectiveRole === 'receptionist' && targets.includes('reception')) ||
        (effectiveRole === 'barber' && targets.includes('professional')) ||
        (effectiveRole === 'professional' && targets.includes('barber')) ||
        (effectiveRole === 'financial' && (targets.includes('finance') || targets.includes('cashier'))) ||
        (effectiveRole === 'finance' && (targets.includes('financial') || targets.includes('cashier'))) ||
        (effectiveRole === 'cashier' && (targets.includes('financial') || targets.includes('finance'))) ||
        (effectiveRole === 'customer' && targets.includes('client')) ||
        (effectiveRole === 'client' && targets.includes('customer'));
      if (!roleMatches) return false;
    }
    return true;
  });

  // 3. Catálogo
  let authorizedCatalog = [];
  if (!isAnon && effectiveRole) {
    if (isSuperAdmin) {
      authorizedCatalog = catalogItems;
    } else {
      authorizedCatalog = catalogItems.filter(item => {
        const matchesRole = item.targetRoles.includes(effectiveRole) ||
          (effectiveRole === 'client' && item.targetRoles.includes('customer')) ||
          (effectiveRole === 'reception' && item.targetRoles.includes('receptionist')) ||
          (effectiveRole === 'barber' && item.targetRoles.includes('professional'));
        if (!matchesRole) return false;
        if (item.targetRoles.length === 1 && item.targetRoles[0] === 'super_admin') return false;
        return true;
      });
    }
  }

  // 4. Deduplicação
  const articleMap = new Map();
  safeDbArticles.forEach(art => articleMap.set(art.id, art));

  authorizedCatalog.forEach(catItem => {
    const equiv = SEMANTIC_EQUIVALENCES[catItem.id];
    let matching = null;
    if (equiv) {
      matching = safeDbArticles.find(a => a.title && a.title.toLowerCase().startsWith(equiv.canonicalDbPrefix.toLowerCase()));
    } else {
      matching = safeDbArticles.find(a => a.title && a.title.trim().toLowerCase() === catItem.title.trim().toLowerCase());
    }
    if (!matching) {
      articleMap.set(catItem.id, catItem);
    }
  });

  return articleMap.size;
}

const clientCount = simulateRoleExact('client');
const barberCount = simulateRoleExact('barber');
const receptionCount = simulateRoleExact('reception');
const financialCount = simulateRoleExact('financial');
const adminCount = simulateRoleExact('tenant_admin');
const superAdminCount = simulateRoleExact('super_admin');

console.log(`   Projeção Cliente: ${clientCount} (esperado: 4)`);
console.log(`   Projeção Barbeiro: ${barberCount} (esperado: 11)`);
console.log(`   Projeção Recepção: ${receptionCount} (esperado: 19)`);
console.log(`   Projeção Financeiro: ${financialCount} (esperado: 7)`);
console.log(`   Projeção Administrador/Proprietário: ${adminCount} (esperado: 69)`);
console.log(`   Projeção Superadmin: ${superAdminCount} (esperado: 73)`);

assert(clientCount === 4, `Projeção Cliente é 4 (obtido: ${clientCount})`);
assert(barberCount === 11, `Projeção Barbeiro é 11 (obtido: ${barberCount})`);
assert(receptionCount === 19, `Projeção Recepção é 19 (obtido: ${receptionCount})`);
assert(financialCount === 7, `Projeção Financeiro é 7 (obtido: ${financialCount})`);
assert(adminCount === 69, `Projeção Administrador é 69 (obtido: ${adminCount})`);
assert(superAdminCount === 73, `Projeção Superadmin é 73 (obtido: ${superAdminCount})`);

console.log(`\n================================================================`);
console.log(`SMOKE TESTS EM PRODUÇÃO: ${passed} PASS, ${failed} FAIL`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
