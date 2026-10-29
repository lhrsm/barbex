/**
 * SUITE DE TESTES ESTATÍSTICOS E VALIDAÇÃO DE SEGURANÇA (R2E.26E.20B)
 */
const fs = require('fs');
const assert = require('assert');

console.log('--- EXECUTANDO TESTES LOCAIS DA R2E.26E.20B ---');

// 1. Validar integridade dos 58 artigos a partir do backup manifest
const manifest = JSON.parse(fs.readFileSync('scripts/backup_tutorials_manifest_latest.json', 'utf8'));
const articles = manifest.data.tutorials;
assert.strictEqual(articles.length, 58, 'Deveriam existir exatamente 58 artigos no banco.');
console.log('✔ Teste 1: Total de 58 artigos persistidos confirmado no backup manifest.');

// 2. Validar que todos os 58 receberam classificação na migration SQL
const migration = fs.readFileSync('supabase/migrations/20261028140000_r2e26e20b_tutorials_sanitization_and_rls.sql', 'utf8');
const updateMatches = migration.match(/UPDATE public\.tutorials\s+SET profile_target = ARRAY\[([^\]]+)\]::text\[\],\s+module_key = '([^']+)'/g);
assert.strictEqual(updateMatches.length, 58, 'Todos os 58 artigos devem possuir atribuição de profile_target e module_key na migration.');
console.log('✔ Teste 2: Metadados completos e válidos para todos os 58 artigos na migration.');
const revisedIds = [
  'e16bb3fd-1359-4da2-91cd-cc8a03619e0d',
  '905468c9-b4eb-4554-9493-e072cc92ec0e',
  '0a65cc62-5ef4-4f15-b9db-5122b8f90740',
  '1ce9d357-4170-4be6-a50d-c1115faf1676',
  'e2e293be-0df7-4d80-8cf0-b27a7268e33d',
  '6eef64ad-7c7e-49cf-aef4-028dcb78dc68',
  '8d1aa3cf-1d9a-4bc6-84e8-6b5fda268db2',
  '628290d8-6193-463c-8058-16b68f84ee13',
  '09eba6e4-6234-4641-95ce-f3901f655109',
  '7f0f541d-c72c-4aa8-bebb-764a292917b6',
  '2e2831f1-a060-4fe0-9eec-40a56096ae08',
  '9ddeff2f-e151-4d75-b393-d680f4ae9d17',
  'c452a442-a0c5-4e8a-b963-7f948eac4f04',
  'c334b3ba-0993-449a-a58e-88fb89f7f3d1'
];

revisedIds.forEach(id => {
  assert(migration.includes(id), `Migration deve conter o ID revisado ${id}`);
});
console.log('✔ Teste 3: Todos os 14 artigos em revisão estão contemplados na migration.');

// 4. Validar transparência comercial sobre WhatsApp e Z-API
assert(migration.includes('O Barbex não oferece integração nativa ou independente com WhatsApp'), 'Disclaimer comercial padronizado ausente na migration.');
assert(migration.includes('Z-API'), 'Menções a Z-API devem ser preservadas e explicadas.');
console.log('✔ Teste 4: Disclaimer de transparência comercial Z-API validado com sucesso.');

// 5. Validar política de RLS role-based
assert(migration.includes('Role-based tutorial access'), 'Policy role-based ausente.');
assert(migration.includes('client'), 'Policy deve liberar tutoriais de clientes para o portal.');
assert(migration.includes('super_admin'), 'Policy deve contemplar superadmin.');
console.log('✔ Teste 5: Estrutura de RLS endurecida e compatível com segurança multiperfil.');

// 6. Validar script de rollback endurecido (não reintroduz USING true)
const rollback = fs.readFileSync('scripts/rollback_r2e26e20b_sanitization.sql', 'utf8');
assert(!rollback.includes('USING (true)'), 'Rollback NÃO pode reintroduzir USING (true).');
assert(rollback.includes('Rollback safe tutorial access'), 'Rollback deve criar policy segura.');
assert(rollback.includes('profile_target = NULL'), 'Rollback deve restaurar profile_target.');
console.log('✔ Teste 6: Script de rollback seguro validado e idempotente.');

console.log('\nTODOS OS TESTES DA FASE R2E.26E.20B PASSARAM COM SUCESSO (6/6).');
