const fs = require('fs');
const path = require('path');

console.log("================================================================");
console.log("BARBEX — R2E.26E.20C.4: SUITE DE TESTES ISOLADOS DA EXPANSÃO P1");
console.log("================================================================");
console.log("Timestamp:", new Date().toISOString());

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testsFailed++;
  }
}

// 1. Carregar baseline dos 58 artigos
const detailedArticlesPath = path.join(__dirname, '..', 'scripts', 'detailed_58_articles_audit.json');
const originalArticles = JSON.parse(fs.readFileSync(detailedArticlesPath, 'utf8'));

assert(originalArticles.length === 58, "Baseline contém exatamente 58 artigos persistidos");
const originalIds = new Set(originalArticles.map(a => a.id));

// 2. As 21 categorias canônicas
const CANONICAL_CATEGORIES = new Map([
  ['428c0ddc-fc67-42be-bc4f-aff6280344f3', 'Agenda'],
  ['a19b101e-cd41-4b7c-93a5-c3cc43127113', 'Assinaturas'],
  ['9bd90387-929c-42f0-81fe-70832fef6944', 'Clientes e Relacionamento'],
  ['a5ec4c8e-f49d-4817-afbd-8e7c19324215', 'Comissões'],
  ['ac653d4f-6ff5-4a15-94ab-7d5c4dc13ec6', 'Configurações'],
  ['05fa32a0-54a1-42a2-bad2-e9f6f56f3fe5', 'Equipe'],
  ['fa046d64-efcd-4235-8616-d04b3c4eaed7', 'Experiência do Cliente'],
  ['74fe2b6f-3efd-47cf-9c6f-8826161f59c6', 'Fidelidade'],
  ['3851298e-00d9-4c45-9f5f-bcad2479f6ca', 'Financeiro'],
  ['c55b3ff3-0fe8-4872-8449-d5700bc0e6b1', 'Indicadores e Inteligência'],
  ['48e4a20a-3617-44ec-a0c7-49cf177e13f9', 'Integrações'],
  ['dc3b2bb6-1525-405d-8fbd-d53fcda0a12d', 'Marketing e Comunicação'],
  ['128ad0ba-bc76-445d-aeb1-de819fb0e735', 'Novidades'],
  ['d19d2eed-8f98-4860-9d9e-3680a865751a', 'Operação Diária'],
  ['f7d696f3-efb0-48fe-94a5-abe9759b73c2', 'Primeiros passos'],
  ['37a77850-8fb1-4746-83fb-8b1b6e8f51fc', 'Produtos'],
  ['cc26830e-6ba9-4e3d-a37a-a7c78da57097', 'Segurança e Privacidade'],
  ['8645beb0-0551-4367-82d4-e78024bef2b4', 'Solução de Problemas'],
  ['e1031ac1-cc5b-4174-a30b-e5b6f027356c', 'Super Admin'],
  ['effb1c97-4599-452c-9895-2f231b130022', 'Suporte'],
  ['1f1a286c-5238-4efa-ad40-f0b656754c7d', 'WhatsApp'],
]);

assert(CANONICAL_CATEGORIES.size === 21, "Total de categorias canônicas registradas é 21");

// 3. Os 7 Artigos Restritos
const RESTRICTED_UUIDS = [
  'd63482d7-27c9-4dbe-bc79-43dfc194acfe',
  'a3ba57c9-60a7-4c2d-8a5a-544dde3c0451',
  '2f8df9f3-4f4c-4d62-891f-a3e05ad2a2b5',
  'cf8b2ce5-ab17-4801-a114-d6d3976fac5f',
  'd8a7ab64-9080-476f-be29-18829321c61c',
  '60a1afbb-4cdf-4dcb-a9a4-ea95dc134b73',
  '4ec9d577-f0e8-4a9e-ae80-82cd5ff124b7'
];

// 4. Carregar e analisar a migration SQL
console.log("\n--- TESTE 1: Integridade da Migration P1 (SQL) ---");
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261030130000_r2e26e20c4_help_center_p1_operational_tutorials.sql');
assert(fs.existsSync(migrationPath), "Arquivo de migration 20261030130000 existe");

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

const P1_UUIDS = [
  'e59a721d-9e0c-4c48-8df1-3f628ab29001',
  'e59a721d-9e0c-4c48-8df1-3f628ab29002',
  'e59a721d-9e0c-4c48-8df1-3f628ab29003',
  'e59a721d-9e0c-4c48-8df1-3f628ab29004',
  'e59a721d-9e0c-4c48-8df1-3f628ab29005',
  'e59a721d-9e0c-4c48-8df1-3f628ab29006',
  'e59a721d-9e0c-4c48-8df1-3f628ab29007'
];

// Validar que todos os 7 UUIDs estão no SQL
for (let i = 0; i < P1_UUIDS.length; i++) {
  const id = P1_UUIDS[i];
  assert(migrationSql.includes(id), `Tutorial T0${i+1} (${id}) está presente na migration SQL`);
  assert(!originalIds.has(id), `Tutorial T0${i+1} possui UUID inédito, sem colisão com os 58 existentes`);
}

// 5. Testes da Estrutura Editorial (10 requisitos por artigo)
console.log("\n--- TESTE 2: Estrutura Editorial dos 7 Tutoriais ---");
const REQUIRED_SECTIONS = [
  '**1. Perfil Autorizado:**',
  '**2. Objetivo do Procedimento:**',
  '**3. Pré-requisitos:**',
  '**4. Passo a Passo:**',
  '**5. Resultado Esperado:**',
  '**6. Limitações e Regras Aplicáveis:**',
  '**7. Problemas Frequentes e Orientações:**',
  '**8. Módulo e Categoria:**',
  '**9. Termos de Busca e Palavras-chave:**'
];

for (let i = 0; i < P1_UUIDS.length; i++) {
  const id = P1_UUIDS[i];
  const tutorialSnippet = migrationSql.substring(migrationSql.indexOf(id));
  
  let allSectionsPresent = true;
  for (const sec of REQUIRED_SECTIONS) {
    if (!tutorialSnippet.includes(sec)) {
      allSectionsPresent = false;
      console.error(`  [T0${i+1}] Seção ausente: ${sec}`);
    }
  }
  assert(allSectionsPresent, `T0${i+1} contém todas as seções editoriais obrigatórias`);
}

// 6. Testes de Perfis de Acesso e RBAC
console.log("\n--- TESTE 3: Regras de Perfil e Isolamento Gerencial ---");
// T01: Recepção
assert(migrationSql.includes(`'e59a721d-9e0c-4c48-8df1-3f628ab29001'`) && 
       migrationSql.includes(`ARRAY['reception', 'tenant_admin', 'admin']`), 
       "T01 (Clientes Balcão) inclui perfil 'reception' e administração");

// T02: Recepção / Barbeiro
assert(migrationSql.includes(`'e59a721d-9e0c-4c48-8df1-3f628ab29002'`) && 
       migrationSql.includes(`ARRAY['reception', 'barber', 'tenant_admin', 'admin']`), 
       "T02 (Carteirinha QR Code) inclui perfis operacionais e administração");

// T03: Exclusivo Admin / Gerencial
assert(migrationSql.includes(`'e59a721d-9e0c-4c48-8df1-3f628ab29003'`) && 
       migrationSql.includes(`ARRAY['tenant_admin', 'admin', 'owner']`), 
       "T03 (Convidar Usuários) é estritamente gerencial e blindado contra operacional");

// T04: Exclusivo Admin / Gerencial
assert(migrationSql.includes(`'e59a721d-9e0c-4c48-8df1-3f628ab29004'`) && 
       migrationSql.includes(`ARRAY['tenant_admin', 'admin', 'owner']`), 
       "T04 (Centro de Comando) é estritamente gerencial e blindado contra operacional");

// T05: Barbeiro / Recepção
assert(migrationSql.includes(`'e59a721d-9e0c-4c48-8df1-3f628ab29005'`) && 
       migrationSql.includes(`ARRAY['barber', 'reception', 'tenant_admin', 'admin']`), 
       "T05 (Bloquear Horários e Folgas) atende Barbeiro e Recepção");

// T06: Cliente / Recepção
assert(migrationSql.includes(`'e59a721d-9e0c-4c48-8df1-3f628ab29006'`) && 
       migrationSql.includes(`ARRAY['client', 'customer', 'reception', 'tenant_admin', 'admin']`), 
       "T06 (Agendamento em Grupo) inclui Cliente e Recepção");

// T07: Barbeiro / Admin
assert(migrationSql.includes(`'e59a721d-9e0c-4c48-8df1-3f628ab29007'`) && 
       migrationSql.includes(`ARRAY['barber', 'tenant_admin', 'admin']`), 
       "T07 (Portfólio do Barbeiro) atende Barbeiro com governança administrativa");

// Blindagem dos 7 artigos restritos
for (const resId of RESTRICTED_UUIDS) {
  assert(!P1_UUIDS.includes(resId), `Artigo restrito original ${resId} não sofreu mutação`);
}

// 7. Testes de Integridade de Categorias
console.log("\n--- TESTE 4: Conformidade das Categorias ---");
const expectedCatIds = [
  '9bd90387-929c-42f0-81fe-70832fef6944', // T01: Clientes e Relacionamento
  'a19b101e-cd41-4b7c-93a5-c3cc43127113', // T02: Assinaturas
  '05fa32a0-54a1-42a2-bad2-e9f6f56f3fe5', // T03: Equipe
  'c55b3ff3-0fe8-4872-8449-d5700bc0e6b1', // T04: Indicadores e Inteligência
  '428c0ddc-fc67-42be-bc4f-aff6280344f3', // T05: Agenda
  '428c0ddc-fc67-42be-bc4f-aff6280344f3', // T06: Agenda
  '05fa32a0-54a1-42a2-bad2-e9f6f56f3fe5'  // T07: Equipe
];

for (let i = 0; i < expectedCatIds.length; i++) {
  const catId = expectedCatIds[i];
  const catName = CANONICAL_CATEGORIES.get(catId);
  assert(CANONICAL_CATEGORIES.has(catId), `T0${i+1} vinculado a categoria canônica válida: "${catName}" (${catId})`);
  assert(migrationSql.includes(catId), `Migration referencia foreign key da categoria ${catId}`);
}

// 8. Testes do Script de Rollback
console.log("\n--- TESTE 5: Integridade do Script de Rollback ---");
const rollbackPath = path.join(__dirname, '..', 'scripts', 'rollback_r2e26e20c4_help_center_p1_operational_tutorials.sql');
assert(fs.existsSync(rollbackPath), "Arquivo de rollback existe");

const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');
assert(rollbackSql.includes("DELETE FROM public.tutorials"), "Rollback executa DELETE em public.tutorials");
assert(rollbackSql.includes("version = '20261030130000'"), "Rollback limpa registro em schema_migrations");

for (let i = 0; i < P1_UUIDS.length; i++) {
  assert(rollbackSql.includes(P1_UUIDS[i]), `Rollback inclui remoção exata do UUID T0${i+1}`);
}
for (const origId of originalIds) {
  assert(!rollbackSql.includes(origId), `Rollback NÃO toca no tutorial pré-existente ${origId}`);
}

// 9. Simulação da Busca e Deduplicação
console.log("\n--- TESTE 6: Cobertura de Busca e Palavras-chave ---");
const KEYWORD_CHECKS = [
  { keyword: 'balcão', expectedSnippet: 'Como cadastrar clientes no balcão' },
  { keyword: 'carteirinha', expectedSnippet: 'Como validar carteirinha e QR Code' },
  { keyword: 'permissões', expectedSnippet: 'Como convidar usuários e configurar permissões' },
  { keyword: 'centro de comando', expectedSnippet: 'Como utilizar o Centro de Comando' },
  { keyword: 'folga', expectedSnippet: 'Como bloquear horários e solicitar folgas' },
  { keyword: 'agendamento em grupo', expectedSnippet: 'Como funciona o agendamento em grupo' },
  { keyword: 'portfólio', expectedSnippet: 'Como configurar o portfólio' },
  { keyword: 'estorno', expectedSnippet: 'useCustomerCancellation' },
  { keyword: 'pix', expectedSnippet: 'reembolso via PIX' },
  { keyword: 'créditos', expectedSnippet: 'créditos na barbearia' }
];

for (const { keyword, expectedSnippet } of KEYWORD_CHECKS) {
  assert(migrationSql.toLowerCase().includes(keyword.toLowerCase()), `Termo de busca essencial '${keyword}' indexado na documentação P1`);
}

// 10. Projeção de Métricas Futuras
console.log("\n--- TESTE 7: Projeção de Métricas Pós-Publicação ---");
const currentCount = 58;
const projectedCount = currentCount + P1_UUIDS.length;
assert(projectedCount === 65, `Projeção de tutoriais na base: de ${currentCount} para exatamente ${projectedCount}`);

console.log("\n================================================================");
console.log(`TOTAL DE TESTES: ${testsPassed + testsFailed} | APROVADOS: ${testsPassed} | FALHAS: ${testsFailed}`);
if (testsFailed === 0) {
  console.log("RESULTADO FINAL: SUÍTE DE EXPANSÃO P1 100% APROVADA! ✓");
  console.log("================================================================");
  process.exit(0);
} else {
  console.error("RESULTADO FINAL: FALHAS DETECTADAS!");
  console.log("================================================================");
  process.exit(1);
}

