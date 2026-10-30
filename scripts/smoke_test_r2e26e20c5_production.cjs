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
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runProductionSmokeTests() {
  console.log('================================================================');
  console.log('BARBEX — R2E.26E.20C.5: SMOKE TESTS EM PRODUÇÃO (PÓS-CUTOVER)');
  console.log('================================================================\n');

  // TESTE 1: Contagem Total de Artigos
  console.log('--- TESTE 1: Contagem Total de Tutoriais na Produção ---');
  const countRes = runLinkedQuery('SELECT count(*) as total FROM public.tutorials;');
  const total = parseInt(countRes[0].total, 10);
  assert(total === 65, `Total de tutoriais na produção é exatamente 65 (obtido: ${total})`);

  // TESTE 2: Presença dos 7 Novos Artigos P1
  console.log('\n--- TESTE 2: Presença e Status dos 7 Artigos P1 ---');
  const P1_UUIDS = [
    'e59a721d-9e0c-4c48-8df1-3f628ab29001',
    'e59a721d-9e0c-4c48-8df1-3f628ab29002',
    'e59a721d-9e0c-4c48-8df1-3f628ab29003',
    'e59a721d-9e0c-4c48-8df1-3f628ab29004',
    'e59a721d-9e0c-4c48-8df1-3f628ab29005',
    'e59a721d-9e0c-4c48-8df1-3f628ab29006',
    'e59a721d-9e0c-4c48-8df1-3f628ab29007'
  ];

  const p1Rows = runLinkedQuery(`
    SELECT id, title, profile_target, category_id, status, related_route, "order"
    FROM public.tutorials
    WHERE id IN ('${P1_UUIDS.join("','")}')
    ORDER BY "order" ASC;
  `);

  assert(p1Rows.length === 7, `Exatamente 7 novos artigos localizados em produção (encontrados: ${p1Rows.length})`);
  p1Rows.forEach(row => {
    assert(row.status === 'published', `Artigo [${row.id.slice(-3)}] "${row.title}" está com status 'published'`);
  });

  // TESTE 3: Blindagem Gerencial Estrita (T03, T04 e 7 Restritos)
  console.log('\n--- TESTE 3: Blindagem e Segurança RBAC ---');
  const t03 = p1Rows.find(r => r.id.endsWith('003'));
  const t04 = p1Rows.find(r => r.id.endsWith('004'));

  assert(
    t03 && (t03.profile_target || []).every(p => ['tenant_admin', 'admin', 'owner'].includes(p)),
    'T03 (Convidar Usuários) está blindado para papéis gerenciais'
  );
  assert(
    t04 && (t04.profile_target || []).every(p => ['tenant_admin', 'admin', 'owner'].includes(p)),
    'T04 (Centro de Comando) está blindado para papéis gerenciais'
  );

  const RESTRICTED_7 = [
    'd63482d7-27c9-4dbe-bc79-43dfc194acfe',
    'a3ba57c9-60a7-4c2d-8a5a-544dde3c0451',
    '2f8df9f3-4f4c-4d62-891f-a3e05ad2a2b5',
    'cf8b2ce5-ab17-4801-a114-d6d3976fac5f',
    'd8a7ab64-9080-476f-be29-18829321c61c',
    '60a1afbb-4cdf-4dcb-a9a4-ea95dc134b73',
    '4ec9d577-f0e8-4a9e-ae80-82cd5ff124b7'
  ];

  const restrictedRows = runLinkedQuery(`
    SELECT id, title, profile_target
    FROM public.tutorials
    WHERE id IN ('${RESTRICTED_7.join("','")}');
  `);

  assert(restrictedRows.length === 7, `Todos os 7 artigos gerenciais históricos foram localizados`);
  restrictedRows.forEach(row => {
    const pt = row.profile_target || [];
    assert(
      !pt.includes('reception') && !pt.includes('barber') && !pt.includes('client'),
      `Artigo restrito "${row.title}" NÃO foi exposto para reception/barber/client`
    );
  });

  // TESTE 4: Integridade dos Artigos P0 (Z-API e Autosserviço)
  console.log('\n--- TESTE 4: Não-Regressão das Correções P0 (Z-API e Cancelamento) ---');
  const p0ZapiRes = runLinkedQuery(`
    SELECT id, title, description, long_description
    FROM public.tutorials
    WHERE id IN (
      'e2e293be-0df7-4d80-8cf0-b27a7268e33d',
      '2e2831f1-a060-4fe0-9eec-40a56096ae08',
      '64032882-67d0-4d3a-ba4d-0ee186d8c175'
    );
  `);
  p0ZapiRes.forEach(row => {
    const hasNotice = (row.long_description || '').includes('Z-API') || (row.description || '').includes('Z-API');
    assert(hasNotice, `Artigo P0 "${row.title}" mantém aviso de integração externa Z-API`);
  });

  const p0CancelRes = runLinkedQuery(`
    SELECT id, title, long_description
    FROM public.tutorials
    WHERE id = 'c334b3ba-0993-449a-a58e-88fb89f7f3d1';
  `);
  const hasPortal = (p0CancelRes[0]?.long_description || '').includes('agendamentos');
  assert(hasPortal, 'Artigo de reagendamento e cancelamento mantém instruções da rota canônica');

  // TESTE 5: Preservação das 21 Categorias Canônicas
  console.log('\n--- TESTE 5: Integridade das 21 Categorias ---');
  const catRes = runLinkedQuery('SELECT count(*) as total FROM public.tutorial_categories;');
  const catTotal = parseInt(catRes[0].total, 10);
  assert(catTotal === 21, `Total de categorias permanece exatamente 21 (obtido: ${catTotal})`);

  // TESTE 6: Proteção da Rota /tutorials para Anônimos
  console.log('\n--- TESTE 6: Proteção de Layout para Visitantes Anônimos ---');
  const appRoutesPath = path.join(repoDir, 'src', 'App.tsx');
  let authProtected = true;
  if (fs.existsSync(appRoutesPath)) {
    const appContent = fs.readFileSync(appRoutesPath, 'utf8');
    // Checar se /tutorials NÃO está em isPublicPath
    const isPublicMatch = appContent.match(/const\s+isPublicPath\s*=\s*\[([\s\S]*?)\]/);
    if (isPublicMatch) {
      authProtected = !isPublicMatch[1].includes("'/tutorials'") && !isPublicMatch[1].includes('"/tutorials"');
    }
  }
  assert(authProtected, 'Rota /tutorials está protegida contra acesso deslogado no frontend');

  // TESTE 7: Verificação da Tabela schema_migrations
  console.log('\n--- TESTE 7: Histórico de Migrations do Supabase ---');
  const migRes = runLinkedQuery(`
    SELECT version 
    FROM supabase_migrations.schema_migrations 
    WHERE version = '20261030130000';
  `);
  assert(migRes.length === 1, 'Versão 20261030130000 devidamente registrada em schema_migrations');

  console.log('\n================================================================');
  console.log(`TOTAL DE TESTES: ${passed + failed} | APROVADOS: ${passed} | FALHAS: ${failed}`);
  if (failed === 0) {
    console.log('RESULTADO FINAL: SMOKE TESTS EM PRODUÇÃO 100% APROVADOS! ✓');
    console.log('================================================================');
  } else {
    console.error('RESULTADO FINAL: FALHAS DETECTADAS NOS SMOKE TESTS EM PRODUÇÃO! ❌');
    console.log('================================================================');
    process.exit(1);
  }
}

runProductionSmokeTests().catch(err => {
  console.error('\n❌ ERRO NOS SMOKE TESTS:', err.message);
  process.exit(1);
});
