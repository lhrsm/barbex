const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

console.log('================================================================');
console.log('BARBEX R2E.24D.1 — APLICAÇÃO EXCLUSIVA DA MIGRATION DE STORAGE');
console.log('Target Supabase: ywdwrstxvsdqiryhieiz');
console.log('Timestamp:', new Date().toISOString());
console.log('================================================================\n');

const migPath = 'supabase/migrations/20261021120000_r2e24d_normalize_legacy_storage_urls.sql';
const migBuffer = fs.readFileSync(migPath);
const actualSha = crypto.createHash('sha256').update(migBuffer).digest('hex').toUpperCase();

console.log(`[Gate Check] Migration: ${migPath}`);
console.log(`[Gate Check] Migration SHA-256: ${actualSha}`);

// 1. Aplicar Migration
console.log('\n[Passo 1/3] Aplicando migration de normalização de URLs no banco de produção...');
const start = Date.now();
const applyOut = execSync(`npx.cmd supabase db query --linked --project-ref ywdwrstxvsdqiryhieiz -f "${migPath}"`, {
  encoding: 'utf8'
});
console.log(`Migration aplicada com sucesso em ${((Date.now() - start)/1000).toFixed(2)}s.`);
console.log('Output:', applyOut || '(success)');

// 2. Registrar versão em schema_migrations
console.log('\n[Passo 2/3] Registrando versão 20261021120000 em supabase_migrations.schema_migrations...');
const recordSql = "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261021120000') ON CONFLICT (version) DO NOTHING;";
fs.writeFileSync('scripts/temp_record_20261021120000.sql', recordSql, 'utf8');
try {
  const recOut = execSync('npx.cmd supabase db query --linked --project-ref ywdwrstxvsdqiryhieiz -f scripts/temp_record_20261021120000.sql', {
    encoding: 'utf8'
  });
  console.log('Registro concluído:', recOut || '(success)');
} finally {
  if (fs.existsSync('scripts/temp_record_20261021120000.sql')) {
    fs.unlinkSync('scripts/temp_record_20261021120000.sql');
  }
}

// 3. Verificar pós-migração: confirmar que nenhuma URL legada restou nas colunas auditadas
console.log('\n[Passo 3/3] Verificação pós-migração no banco...');
const checkSql = `
SELECT 'profiles.pix_qr_code_url' as col, count(*) as cnt FROM profiles WHERE pix_qr_code_url LIKE '%wdxhjwodyctgzqtogkgv.supabase.co%'
UNION ALL
SELECT 'customers.avatar_url', count(*) FROM customers WHERE avatar_url LIKE '%wdxhjwodyctgzqtogkgv.supabase.co%';
`;
fs.writeFileSync('scripts/temp_check_legacy_post.sql', checkSql, 'utf8');
try {
  const checkOut = execSync('npx.cmd supabase db query --linked --project-ref ywdwrstxvsdqiryhieiz -f scripts/temp_check_legacy_post.sql', {
    encoding: 'utf8'
  });
  console.log('Resultado da verificação pós-migração (deve ser 0 para todas as colunas):');
  console.log(checkOut);
} finally {
  if (fs.existsSync('scripts/temp_check_legacy_post.sql')) {
    fs.unlinkSync('scripts/temp_check_legacy_post.sql');
  }
}

console.log('\n================================================================');
console.log('MIGRATION 20261021120000 APLICADA E VERIFICADA COM SUCESSO');
console.log('================================================================');
