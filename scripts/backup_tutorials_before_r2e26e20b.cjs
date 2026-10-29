/**
 * BACKUP PRE-MUTATION SCRIPT (R2E.26E.20B / R2E.26E.20B.1)
 * Executa dump estrito e captura de policies, grants e integridade referencial.
 */
const { execSync } = require('child_process');
const fs = require('fs');

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = `scripts/backup_tutorials_manifest_${ts}.json`;
const latestFile = 'scripts/backup_tutorials_manifest_latest.json';

console.log('--- EXECUTANDO BACKUP COMPLETO PRE-MUTATION ---');

function runQuery(sql) {
  const output = execSync(`npx.cmd supabase db query --linked "${sql.replace(/\n/g, ' ')}"`, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  const jsonStart = output.indexOf('{');
  if (jsonStart === -1) throw new Error('Falha ao processar retorno JSON do Supabase');
  return JSON.parse(output.slice(jsonStart)).rows;
}

try {
  console.log('1. Exportando registros da tabela tutorials...');
  const tutorials = runQuery('SELECT * FROM tutorials ORDER BY id;');

  console.log('2. Exportando registros da tabela tutorial_categories...');
  const categories = runQuery('SELECT * FROM tutorial_categories ORDER BY id;');

  console.log('3. Exportando policies ativas em tutorials...');
  const policies = runQuery("SELECT polname, polcmd, polpermissive, polroles FROM pg_policy WHERE polrelid = 'tutorials'::regclass;");

  console.log('4. Exportando grants de permissoes em tutorials...');
  const grants = runQuery("SELECT grantee, privilege_type, is_grantable FROM information_schema.role_table_grants WHERE table_name = 'tutorials';");

  const manifest = {
    timestamp: new Date().toISOString(),
    gitHead: '83daee9d',
    environment: 'production-supabase',
    counts: {
      tutorials: tutorials.length,
      categories: categories.length,
      policies: policies.length,
      grants: grants.length
    },
    schema: {
      tutorialsTable: 'public.tutorials',
      categoriesTable: 'public.tutorial_categories'
    },
    data: {
      tutorials,
      categories,
      policies,
      grants
    }
  };

  fs.writeFileSync(backupFile, JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(latestFile, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\n✔ Backup concluído com sucesso!`);
  console.log(`- Arquivo versionado: ${backupFile}`);
  console.log(`- Arquivo latest: ${latestFile}`);
  console.log(`- Tutoriais preservados: ${tutorials.length}`);
  console.log(`- Categorias preservadas: ${categories.length}`);
  console.log(`- Policies capturadas: ${policies.length}`);
} catch (err) {
  console.error('ERRO NO BACKUP:', err.message);
  process.exit(1);
}
