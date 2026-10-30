const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoDir = path.join(__dirname, '..');

function runLinkedQuery(sql) {
  const tempFile = path.join(__dirname, `temp_apply_${Date.now()}.sql`);
  fs.writeFileSync(tempFile, sql, 'utf8');
  try {
    const out = execSync(`npx.cmd supabase db query --linked --file "${tempFile}"`, {
      cwd: repoDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });
    const parsed = JSON.parse(out);
    return parsed.rows || parsed;
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

function runLinkedFile(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(repoDir, filePath);
  const out = execSync(`npx.cmd supabase db query --linked --file "${fullPath}"`, {
    cwd: repoDir,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  const parsed = JSON.parse(out);
  return parsed.rows || parsed;
}

async function main() {
  console.log('================================================================');
  console.log('BARBEX — R2E.26E.20C.5: CUTOVER CONTROLADO DE TUTORIAIS P1');
  console.log('================================================================\n');

  // 1. Pré-verificação
  console.log('1. Verificando estado pré-cutover no banco de dados...');
  const preCountRes = runLinkedQuery('SELECT count(*) as total FROM public.tutorials;');
  const preCount = parseInt(preCountRes[0].total, 10);
  console.log(`   Total de tutoriais antes da migration: ${preCount}`);
  if (preCount !== 58) {
    throw new Error(`Pré-condição falhou: esperados 58 artigos, encontrados ${preCount}`);
  }

  // 2. Executar migration P1
  const migrationRelative = 'supabase/migrations/20261030130000_r2e26e20c4_help_center_p1_operational_tutorials.sql';
  console.log(`\n2. Executando migration autorizada: ${migrationRelative}...`);
  runLinkedFile(migrationRelative);
  console.log('   Migration SQL executada com sucesso.');

  // 3. Registrar na tabela schema_migrations
  console.log('\n3. Registrando versão 20261030130000 em schema_migrations...');
  runLinkedQuery(`
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('20261030130000')
    ON CONFLICT (version) DO NOTHING;
  `);
  console.log('   Versão registrada no histórico do Supabase.');

  // 4. Verificação de Pós-Condição: Contagem Total
  console.log('\n4. Verificando contagem de pós-condição...');
  const postCountRes = runLinkedQuery('SELECT count(*) as total FROM public.tutorials;');
  const postCount = parseInt(postCountRes[0].total, 10);
  console.log(`   Total de tutoriais após a migration: ${postCount} (Esperado: 65)`);
  if (postCount !== 65) {
    throw new Error(`Falha de pós-condição: total esperado: 65, obtido: ${postCount}`);
  }

  // 5. Verificação da Integridade dos 7 Novos UUIDs
  console.log('\n5. Verificando integridade dos 7 novos UUIDs...');
  const newUuids = [
    'e59a721d-9e0c-4c48-8df1-3f628ab29001',
    'e59a721d-9e0c-4c48-8df1-3f628ab29002',
    'e59a721d-9e0c-4c48-8df1-3f628ab29003',
    'e59a721d-9e0c-4c48-8df1-3f628ab29004',
    'e59a721d-9e0c-4c48-8df1-3f628ab29005',
    'e59a721d-9e0c-4c48-8df1-3f628ab29006',
    'e59a721d-9e0c-4c48-8df1-3f628ab29007'
  ];

  const uuidCheck = runLinkedQuery(`
    SELECT id, title, profile_target, category_id, status 
    FROM public.tutorials 
    WHERE id IN ('${newUuids.join("','")}')
    ORDER BY id ASC;
  `);
  console.log(`   Novos artigos encontrados no banco: ${uuidCheck.length}/7`);
  if (uuidCheck.length !== 7) {
    throw new Error(`Falha: esperados 7 artigos novos, encontrados ${uuidCheck.length}`);
  }

  uuidCheck.forEach(art => {
    console.log(`   ✓ [${art.id.slice(-3)}] ${art.title} (targets: [${(art.profile_target || []).join(', ')}])`);
  });

  // 6. Confirmação de Preservação dos 58 Artigos Preexistentes
  console.log('\n6. Confirmando integridade dos 58 artigos originais...');
  const originalCheck = runLinkedQuery(`
    SELECT count(*) as preserved
    FROM public.tutorials
    WHERE id NOT IN ('${newUuids.join("','")}');
  `);
  const preservedCount = parseInt(originalCheck[0].preserved, 10);
  console.log(`   Artigos pré-existentes preservados: ${preservedCount}/58`);
  if (preservedCount !== 58) {
    throw new Error(`Falha crítica: número de artigos originais alterado! Esperado: 58, encontrado: ${preservedCount}`);
  }

  // 7. Confirmação das 21 Categorias
  console.log('\n7. Confirmando preservação das 21 categorias canônicas...');
  const catCheck = runLinkedQuery('SELECT count(*) as total FROM public.tutorial_categories;');
  const catTotal = parseInt(catCheck[0].total, 10);
  console.log(`   Total de categorias: ${catTotal}/21`);
  if (catTotal !== 21) {
    throw new Error(`Falha: número de categorias alterado! Esperado: 21, encontrado: ${catTotal}`);
  }

  // 8. Confirmação de Blindagem dos Artigos Gerenciais
  console.log('\n8. Confirmando blindagem de segurança RBAC...');
  const t3t4 = uuidCheck.filter(a => a.id.endsWith('003') || a.id.endsWith('004'));
  t3t4.forEach(a => {
    const pt = a.profile_target || [];
    const hasOp = pt.includes('reception') || pt.includes('barber') || pt.includes('client');
    if (hasOp) throw new Error(`Falha de segurança em ${a.id}: contém papéis operacionais!`);
    console.log(`   ✓ ${a.title} blindado (somente gestão: [${pt.join(', ')}])`);
  });

  const restrictedUuids = [
    'd63482d7-27c9-4dbe-bc79-43dfc194acfe',
    'a3ba57c9-60a7-4c2d-8a5a-544dde3c0451',
    '2f8df9f3-4f4c-4d62-891f-a3e05ad2a2b5',
    'cf8b2ce5-ab17-4801-a114-d6d3976fac5f',
    'd8a7ab64-9080-476f-be29-18829321c61c',
    '60a1afbb-4cdf-4dcb-a9a4-ea95dc134b73',
    '4ec9d577-f0e8-4a9e-ae80-82cd5ff124b7'
  ];
  const restrictedCheck = runLinkedQuery(`
    SELECT id, title, profile_target
    FROM public.tutorials
    WHERE id IN ('${restrictedUuids.join("','")}')
      AND ('reception' = ANY(profile_target) OR 'barber' = ANY(profile_target) OR 'client' = ANY(profile_target));
  `);
  if (restrictedCheck.length > 0) {
    throw new Error(`Falha crítica de segurança: artigos gerenciais originais violados!`);
  }
  console.log('   ✓ Os 7 artigos gerenciais pré-existentes permanecem 100% blindados.');

  console.log('\n================================================================');
  console.log('CUTOVER CONTROLADO EXECUTADO COM 100% DE SUCESSO! ✓');
  console.log('================================================================');
}

main().catch(err => {
  console.error('\n❌ ERRO NO CUTOVER:', err.message);
  process.exit(1);
});
