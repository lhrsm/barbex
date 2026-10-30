const fs = require('fs');
const path = require('path');

const repoDir = path.join(__dirname, '..');
const migrationPath = path.join(repoDir, 'supabase', 'migrations', '20261030150000_r2e26e20d1_help_center_p2_tutorials.sql');
const rollbackPath = path.join(repoDir, 'scripts', 'rollback_r2e26e20d1_p2_tutorials.sql');
const oldRollbackInMigrations = path.join(repoDir, 'supabase', 'migrations', '20261030150000_r2e26e20d1_help_center_p2_tutorials_rollback.sql');
const backupPath = path.join(repoDir, 'scripts', 'backup_r2e26e20d3_pre_cutover_snapshot.json');
const crypto = require('crypto');

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
console.log('BARBEX — R2E.26E.20D.2: SUITE EXPANDIDA DE REVISÃO DE SEGURANÇA P2');
console.log('================================================================\n');

// 1. Arquivos existem
assert(fs.existsSync(migrationPath), 'Arquivo de migration P2 existe no caminho correto');
assert(fs.existsSync(rollbackPath), 'Arquivo de rollback P2 existe no caminho correto');

const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');

// 2. Os 3 UUIDs canônicos P2
const p2Uuids = [
  'e59a721d-9e0c-4c48-8df1-3f628ab29008',
  'e59a721d-9e0c-4c48-8df1-3f628ab29009',
  'e59a721d-9e0c-4c48-8df1-3f628ab29010'
];

p2Uuids.forEach(uuid => {
  assert(migrationSql.includes(uuid), `Migration contém UUID P2: ${uuid}`);
  assert(rollbackSql.includes(uuid), `Rollback contém UUID P2: ${uuid}`);
});

// Verificação de Unicidade dos UUIDs
const uniqueUuids = new Set(p2Uuids);
assert(uniqueUuids.size === 3, 'Exatamente três UUIDs distintos para P2');
p2Uuids.forEach(uuid => {
  const insertMatches = (migrationSql.match(new RegExp(`'${uuid}'`, 'g')) || []).length;
  assert(insertMatches === 1, `UUID '${uuid}' é referenciado para inserção estritamente uma vez na migration (unicidade garantida)`);
});

// 3. Validação dos Títulos e Conteúdos
const expectedTitles = [
  'Como configurar a escala semanal e horários de trabalho da equipe',
  'Como moderar e responder avaliações de clientes',
  'Como identificar e reativar clientes inativos pelo CRM'
];

expectedTitles.forEach(t => {
  assert(migrationSql.includes(t), `Migration contém título oficial: "${t}"`);
});

// 4. Seções Obrigatórias nos 3 Artigos
const mandatorySections = [
  '## Objetivo',
  '## Perfis Autorizados',
  '## Pré-requisitos',
  '## Passo a Passo',
  '## Resultado Esperado',
  '## Limitações',
  '## Problemas Frequentes',
  '## Termos de Busca'
];

mandatorySections.forEach(sec => {
  const count = (migrationSql.match(new RegExp(sec, 'g')) || []).length;
  assert(count === 3, `Seção "${sec}" presente exatamente nos 3 artigos P2 (encontrado: ${count})`);
});

// 5. Verificação da Cláusula Z-API e Ausência de Campanhas Massivas
assert(
  migrationSql.includes('Z-API') && migrationSql.includes('não incluso nas assinaturas dos planos Barbex'),
  'Artigo P2-03 contém advertência comercial expressa sobre a integração externa paga Z-API'
);
assert(
  migrationSql.includes('realizadas manualmente') || migrationSql.includes('manualmente'),
  'Artigo P2-03 esclarece que as ações de reativação são manuais via link direto do WhatsApp'
);

// 6. Verificação de Imutabilidade e Segurança no Artigo de Avaliações
assert(
  migrationSql.includes('moderate_appointment_review') && migrationSql.includes('Imutabilidade de Notas e Textos'),
  'Artigo P2-02 documenta expressamente a imutabilidade das avaliações e autoridade da Recepção'
);
assert(
  migrationSql.includes("exclusão definitiva (`delete`) de registros é prerrogativa restrita à Gestão"),
  'Artigo P2-02 documenta explicitamente que a Recepção NÃO possui permissão para deletar avaliações'
);

// 7. Verificação de Escala Regular vs Bloqueios no Artigo de Escalas
assert(
  migrationSql.includes('b29005') && migrationSql.includes('Diferença Entre Escala Regular e Folga Pontual'),
  'Artigo P2-01 referencia o tutorial P1 b29005 e esclarece a diferença entre escala regular e folgas pontuais'
);
assert(
  migrationSql.includes('update_barber_working_hours'),
  'Artigo P2-01 documenta a rotina segura update_barber_working_hours utilizada pelo profissional'
);

// 8. Idempotência e Segurança de ON CONFLICT
assert(migrationSql.includes('ON CONFLICT (id) DO UPDATE SET'), 'Migration utiliza ON CONFLICT (id) para garantir idempotência estrita');
const onConflictOccurrences = (migrationSql.match(/ON CONFLICT \(id\) DO UPDATE SET/g) || []).length;
assert(onConflictOccurrences === 3, `ON CONFLICT (id) presente exatamente nos 3 comandos INSERT`);

// 9. Auditoria de Segurança do Rollback
assert(rollbackSql.includes('DELETE FROM public.tutorials'), 'Rollback utiliza DELETE parametrizado pelos UUIDs');
const rollbackWhereIn = rollbackSql.includes("WHERE id IN (");
assert(rollbackWhereIn, 'Rollback possui cláusula WHERE id IN restrita aos UUIDs autorizados');

// Verificação de segurança: Rollback retirado de migrations/ e presente em scripts/
assert(!fs.existsSync(oldRollbackInMigrations), 'Rollback retirado com sucesso de supabase/migrations/ (forward-only mantido)');
assert(fs.existsSync(rollbackPath), 'Rollback presente no local seguro scripts/rollback_r2e26e20d1_p2_tutorials.sql');

// Verificação de Integridade do Backup Pré-Cutover
assert(fs.existsSync(backupPath), 'Arquivo de backup pré-cutover existe em scripts/');
const backupContent = fs.readFileSync(backupPath, 'utf8');
const backupJson = JSON.parse(backupContent);
assert(backupJson.total_articles === 65, 'Backup contém exatamente 65 artigos da base de produção');
const calculatedSha256 = crypto.createHash('sha256').update(backupContent).digest('hex');
assert(calculatedSha256 === '3d306dccd97a9802e043cea6e4cd3dc8a5ebc06a144095e924ebfe620f7cc59a', 'Hash SHA-256 do backup pré-cutover validado');

// Confirmar ausência de colisão com os 3 UUIDs P2 no backup
p2Uuids.forEach(uuid => {
  const existsInBackup = backupJson.articles.some(a => a.id === uuid);
  assert(!existsInBackup, `UUID P2 ${uuid.slice(-6)} ausente do backup pré-cutover (zero colisão)`);
});

// 10. Preservação dos artigos P0 e P1
const p1Uuids = [
  'e59a721d-9e0c-4c48-8df1-3f628ab29001',
  'e59a721d-9e0c-4c48-8df1-3f628ab29002',
  'e59a721d-9e0c-4c48-8df1-3f628ab29003',
  'e59a721d-9e0c-4c48-8df1-3f628ab29004',
  'e59a721d-9e0c-4c48-8df1-3f628ab29005',
  'e59a721d-9e0c-4c48-8df1-3f628ab29006',
  'e59a721d-9e0c-4c48-8df1-3f628ab29007'
];

p1Uuids.forEach(u => {
  assert(!migrationSql.includes(u), `Migration P2 não altera ou sobrescreve UUID P1: ${u}`);
  assert(!rollbackSql.includes(u), `Rollback P2 não remove UUID P1: ${u}`);
});

// 11. Validação dos perfis autorizados (profile_target)
const expectedProfiles = [
  { uuid: 'e59a721d-9e0c-4c48-8df1-3f628ab29008', profiles: ['barber', 'tenant_admin', 'admin', 'owner'], forbidden: ['client', 'customer', 'financial'] },
  { uuid: 'e59a721d-9e0c-4c48-8df1-3f628ab29009', profiles: ['reception', 'tenant_admin', 'admin', 'owner'], forbidden: ['client', 'customer', 'barber', 'financial'] },
  { uuid: 'e59a721d-9e0c-4c48-8df1-3f628ab29010', profiles: ['reception', 'tenant_admin', 'admin', 'owner'], forbidden: ['client', 'customer', 'barber', 'financial'] }
];

expectedProfiles.forEach(ep => {
  const profileStr = ep.profiles.map(p => `'${p}'`).join(', ');
  assert(
    migrationSql.includes(ep.uuid) && migrationSql.includes(profileStr),
    `Artigo ${ep.uuid.slice(-5)} possui perfis autorizados: [${ep.profiles.join(', ')}]`
  );
  
  // Confirma que perfis proibidos não constam no profile_target do artigo específico
  const artMatch = migrationSql.match(new RegExp(`'${ep.uuid}'[\\s\\S]*?ARRAY\\[([^\\]]+)\\]`));
  if (artMatch) {
    const rawArray = artMatch[1];
    ep.forbidden.forEach(forb => {
      assert(!rawArray.includes(`'${forb}'`), `Artigo ${ep.uuid.slice(-5)} exclui estritamente perfil não autorizado: '${forb}'`);
    });
  }
});

// 12. Validação de Foreign Keys das Categorias
const validCategoryIds = [
  '05fa32a0-54a1-42a2-bad2-e9f6f56f3fe5',
  'fa046d64-efcd-4235-8616-d04b3c4eaed7',
  '9bd90387-929c-42f0-81fe-70832fef6944'
];

validCategoryIds.forEach(catId => {
  assert(migrationSql.includes(catId), `Categoria FK válida referenciada na migration: ${catId}`);
});

console.log(`\n================================================================`);
console.log(`RESULTADO DA SUITE: ${passed} PASS, ${failed} FAIL`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
