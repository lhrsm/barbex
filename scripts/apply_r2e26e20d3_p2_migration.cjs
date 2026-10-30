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
      maxBuffer: 20 * 1024 * 1024
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
  console.log('BARBEX — R2E.26E.20D.3: CUTOVER CONTROLADO DE TUTORIAIS P2');
  console.log('================================================================\n');

  // 1. Pré-verificação
  console.log('1. Verificando estado pré-cutover no banco de dados...');
  const preCountRes = runLinkedQuery('SELECT count(*) as total FROM public.tutorials;');
  const preCount = parseInt(preCountRes[0].total, 10);
  console.log(`   Total de tutoriais antes da migration: ${preCount}`);
  if (preCount !== 65) {
    throw new Error(`Pré-condição falhou: esperados 65 artigos, encontrados ${preCount}`);
  }

  // 2. Executar migration P2
  const migrationRelative = 'supabase/migrations/20261030150000_r2e26e20d1_help_center_p2_tutorials.sql';
  console.log(`\n2. Executando migration autorizada: ${migrationRelative}...`);
  runLinkedFile(migrationRelative);
  console.log('   Migration SQL executada com sucesso.');

  // 3. Registrar na tabela schema_migrations
  console.log('\n3. Registrando versão 20261030150000 em schema_migrations...');
  runLinkedQuery(`
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('20261030150000')
    ON CONFLICT (version) DO NOTHING;
  `);
  console.log('   Versão 20261030150000 registrada com sucesso.');

  // 4. Pós-verificação
  console.log('\n4. Verificando estado pós-cutover...');
  const postCountRes = runLinkedQuery('SELECT count(*) as total FROM public.tutorials;');
  const postCount = parseInt(postCountRes[0].total, 10);
  console.log(`   Total de tutoriais após a migration: ${postCount}`);
  if (postCount !== 68) {
    throw new Error(`Pós-condição falhou: esperados 68 artigos, encontrados ${postCount}`);
  }

  // 5. Verificar a presença dos 3 novos artigos
  console.log('\n5. Validando presença dos 3 artigos P2 em produção...');
  const p2Uuids = [
    'e59a721d-9e0c-4c48-8df1-3f628ab29008',
    'e59a721d-9e0c-4c48-8df1-3f628ab29009',
    'e59a721d-9e0c-4c48-8df1-3f628ab29010'
  ];

  const checkP2Res = runLinkedQuery(`
    SELECT id, title, category_id, profile_target, status 
    FROM public.tutorials 
    WHERE id::text IN ('${p2Uuids.join("','")}')
    ORDER BY id ASC;
  `);

  if (checkP2Res.length !== 3) {
    throw new Error(`Validação falhou: esperados 3 artigos P2, encontrados ${checkP2Res.length}`);
  }

  checkP2Res.forEach(r => {
    console.log(`   ✓ [${r.id.slice(-6)}] ${r.title} | Perfis: [${r.profile_target}] | Status: ${r.status}`);
  });

  console.log('\n================================================================');
  console.log('MIGRATION P2 APLICADA COM SUCESSO EM PRODUÇÃO!');
  console.log('================================================================');
}

main().catch(err => {
  console.error('\n✗ ERRO CRÍTICO NO CUTOVER:', err);
  process.exit(1);
});
