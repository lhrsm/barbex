const { execSync } = require('child_process');

function runLinkedQuery(sql) {
  const cleanSql = sql.replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
  const output = execSync(`npx.cmd supabase db query --linked "${cleanSql}"`, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  const jsonStart = output.indexOf('{');
  if (jsonStart === -1) throw new Error('Falha ao processar retorno JSON do Supabase');
  return JSON.parse(output.slice(jsonStart)).rows;
}

console.log("=== GATE 0: AUDITORIA DE MIGRATIONS E POLICIES NO SUPABASE PROD ===");

// 1. Ultimas migrations registradas
const migrations = runLinkedQuery("SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;");
console.log("Últimas 5 migrations aplicadas no banco de produção:");
console.log(JSON.stringify(migrations, null, 2));

// 2. Policies ativas na tabela tutorials
const policies = runLinkedQuery("SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as qual FROM pg_policy WHERE polrelid = 'tutorials'::regclass;");
console.log("\nPolicies ativas em public.tutorials:");
console.log(JSON.stringify(policies, null, 2));

// 3. Contagem atual de artigos na tabela tutorials
const countRes = runLinkedQuery("SELECT count(*) as total, count(*) FILTER (WHERE 'reception' = ANY(profile_target)) as with_reception FROM tutorials;");
console.log("\nContagens em public.tutorials:");
console.log(JSON.stringify(countRes, null, 2));
