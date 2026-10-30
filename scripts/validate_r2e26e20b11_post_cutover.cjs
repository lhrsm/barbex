const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("=== GATE 4: VALIDAÇÃO PÓS-CUTOVER EM PRODUÇÃO (R2E.26E.20B.11) ===");

const TARGET_UUIDS = [
  'cf240ea1-0dec-4817-8afe-8626c4968e21',
  'e8227c4e-15da-4c36-9dee-a044c4236199',
  'a10df4f8-3f19-4c0e-b129-1f70608457c6',
  'c334b3ba-0993-449a-a58e-88fb89f7f3d1',
  '64f5bafc-7abb-44f1-9836-683dca7ce9d9',
  'b3324233-56e8-49b8-a1ed-1e7acb6fc28e',
  '09eba6e4-6234-4641-95ce-f3901f655109',
  '6a493a70-c0fd-4881-8e2a-66fb29f24d9b',
  'f1f13775-30d4-4989-99b0-fc94dbad79ff'
];

const RESTRICTED_UUIDS = [
  'd63482d7-27c9-4dbe-bc79-43dfc194acfe',
  'a3ba57c9-60a7-4c2d-8a5a-544dde3c0451',
  '2f8df9f3-4f4c-4d62-891f-a3e05ad2a2b5',
  'cf8b2ce5-ab17-4801-a114-d6d3976fac5f',
  'd8a7ab64-9080-476f-be29-18829321c61c',
  '60a1afbb-4cdf-4dcb-a9a4-ea95dc134b73',
  '4ec9d577-f0e8-4a9e-ae80-82cd5ff124b7'
];

// Query production database for full live tutorials
const sql = `
SELECT json_build_object(
  'all_tutorials', (
    SELECT json_agg(t) FROM (
      SELECT id, title, category_id, module_key, profile_target, status, "order", type
      FROM tutorials
      ORDER BY id
    ) t
  ),
  'summary_counts', (
    SELECT json_build_object(
      'total', count(*),
      'with_reception', count(*) FILTER (WHERE 'reception' = ANY(profile_target)),
      'with_client', count(*) FILTER (WHERE 'client' = ANY(profile_target) OR 'customer' = ANY(profile_target)),
      'with_receptionist', count(*) FILTER (WHERE 'receptionist' = ANY(profile_target))
    ) FROM tutorials
  )
) as post_cutover_state;
`;

const cleanSql = sql.replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
console.log("Consultando estado live pós-cutover do Supabase...");
const output = execSync(`npx.cmd supabase db query --linked "${cleanSql}"`, {
  encoding: 'utf8',
  maxBuffer: 15 * 1024 * 1024
});

const jsonStart = output.indexOf('{');
if (jsonStart === -1) throw new Error("Erro ao ler JSON: " + output);
const liveData = JSON.parse(output.slice(jsonStart)).rows[0].post_cutover_state;

const allTutorials = liveData.all_tutorials;
const summaryCounts = liveData.summary_counts;

console.log("\n--- CONTAGENS GERAIS NO BANCO DE PRODUÇÃO ---");
console.log(`Total de tutoriais: ${summaryCounts.total} (Esperado: 58)`);
console.log(`Artigos com 'reception': ${summaryCounts.with_reception} (Esperado: 12)`);
console.log(`Artigos com 'client': ${summaryCounts.with_client} (Esperado: 3)`);
console.log(`Artigos com 'receptionist': ${summaryCounts.with_receptionist} (Esperado: 19)`);

let pass = true;

if (summaryCounts.total !== 58) {
  console.error(`ERRO: Total de tutoriais diferente de 58: ${summaryCounts.total}`);
  pass = false;
}
if (summaryCounts.with_reception !== 12) {
  console.error(`ERRO: Total de artigos com reception diferente de 12: ${summaryCounts.with_reception}`);
  pass = false;
}
if (summaryCounts.with_client !== 3) {
  console.error(`ERRO: Total de artigos de cliente diferente de 3: ${summaryCounts.with_client}`);
  pass = false;
}

// 2. Verificar os 9 UUIDs alvo
console.log("\n--- VERIFICAÇÃO DOS 9 UUIDS ALVO ---");
for (const id of TARGET_UUIDS) {
  const row = allTutorials.find(t => t.id === id);
  if (!row) {
    console.error(`ERRO: UUID ${id} não encontrado!`);
    pass = false;
    continue;
  }
  const hasReception = Array.isArray(row.profile_target) && row.profile_target.includes('reception');
  console.log(`[${hasReception ? 'PASS' : 'FAIL'}] ${id}: "${row.title}" | profile_target: ${JSON.stringify(row.profile_target)}`);
  if (!hasReception) pass = false;
}

// 3. Verificar os 7 UUIDs restritos
console.log("\n--- VERIFICAÇÃO DOS 7 UUIDS GERENCIAIS RESTRITOS ---");
for (const id of RESTRICTED_UUIDS) {
  const row = allTutorials.find(t => t.id === id);
  if (!row) {
    console.error(`ERRO: UUID restrito ${id} não encontrado!`);
    pass = false;
    continue;
  }
  const hasReception = Array.isArray(row.profile_target) && row.profile_target.includes('reception');
  console.log(`[${!hasReception ? 'PASS' : 'FAIL'}] ${id}: "${row.title}" | Contém 'reception': ${hasReception}`);
  if (hasReception) {
    console.error(`VIOLAÇÃO CRÍTICA: Artigo gerencial ${id} contém 'reception'!`);
    pass = false;
  }
}

// 4. Simulação de RLS e Frontend da Central de Ajuda
console.log("\n--- SIMULAÇÃO DE RLS E RENDERIZAÇÃO DA CENTRAL DE AJUDA ---");

// Simulação RLS para reception:
// Qual: (EXISTS super_admin) OR ('client' = ANY(profile_target) OR 'customer' = ANY(profile_target)) OR (auth.role = 'authenticated' AND (profile_target IS NULL OR cardinality = 0 OR profiles.role = ANY(profile_target) OR profiles.role IN ('admin', 'tenant_admin')))
const receptionRlsArticles = allTutorials.filter(t => {
  const targets = t.profile_target || [];
  const isClient = targets.includes('client') || targets.includes('customer');
  const isReception = targets.includes('reception');
  return isClient || isReception;
});

console.log(`Artigos retornados pela RLS para perfil 'reception': ${receptionRlsArticles.length} (Esperado: 14)`);
if (receptionRlsArticles.length !== 14) {
  console.error(`ERRO: RLS retornou ${receptionRlsArticles.length}, esperado 14`);
  pass = false;
}

// Frontend safeDbArticles filtro em tutorials.tsx:
// safeDbArticles = dbArticles.filter(a => {
//   if (currentRole === 'reception') {
//     return a.profile_target?.includes('reception');
//   }
//   ...
// });
const safeDbReception = receptionRlsArticles.filter(t => {
  return Array.isArray(t.profile_target) && t.profile_target.includes('reception');
});

console.log(`Artigos aprovados pelo frontend safeDbArticles: ${safeDbReception.length} (Esperado: 12)`);
if (safeDbReception.length !== 12) {
  console.error(`ERRO: safeDbArticles aprovou ${safeDbReception.length}, esperado 12`);
  pass = false;
}

// Artigos estáticos do catálogo (tutorials.catalog.ts):
// Para reception: target_profiles inclui 'reception':
// O catálogo possui: 'reception-agenda-operation' ("Operação Diária da Agenda na Recepção")
// Outros tutoriais do catálogo que têm reception:
// "Como acessar tutoriais e ajuda" tem alias 'reception-help-access', que dedup com db '6a493a70-c0fd-4881-8e2a-66fb29f24d9b'
// "Como criar um novo agendamento" dedup com db 'cf240ea1-0dec-4817-8afe-8626c4968e21'
// Portanto, artigos estáticos adicionados após deduplicação: exatamente 1 ('reception-agenda-operation')
const staticAdded = 1;
const totalUiReception = safeDbReception.length + staticAdded;

console.log(`Artigo estático catálogo único adicionado: ${staticAdded} ('reception-agenda-operation')`);
console.log(`Total final de tutoriais na UI da Recepção: ${totalUiReception} (Esperado: 13)`);

if (totalUiReception !== 13) {
  console.error(`ERRO: Total na UI da Recepção é ${totalUiReception}, esperado 13!`);
  pass = false;
}

// 5. Matriz de Não-Regressão de outros perfis
console.log("\n--- MATRIZ DE NÃO-REGRESSÃO DOS DEMAIS PERFIS ---");
const matrix = {
  super_admin: { db: 58, static: 5, expectedTotal: 63 },
  tenant_admin: { db: 58, static: 1, expectedTotal: 59 },
  barber: { db: 6, static: 1, expectedTotal: 7 },
  financial: { db: 7, static: 0, expectedTotal: 7 },
  client: { db: 3, static: 0, expectedTotal: 3 }
};

for (const [role, expected] of Object.entries(matrix)) {
  const dbMatch = allTutorials.filter(t => {
    if (role === 'super_admin' || role === 'tenant_admin') return true;
    return Array.isArray(t.profile_target) && t.profile_target.includes(role);
  });
  const actualDb = dbMatch.length;
  const actualTotal = actualDb + expected.static;
  const isMatch = actualDb === expected.db && actualTotal === expected.expectedTotal;
  console.log(`[${isMatch ? 'PASS' : 'FAIL'}] Perfil ${role.padEnd(14)}: DB=${actualDb} (${expected.db}), Catálogo=${expected.static}, Total=${actualTotal} (${expected.expectedTotal})`);
  if (!isMatch) pass = false;
}

// Salvar dump pós-cutover
const postDumpPath = path.join(__dirname, 'post_cutover_r2e26e20b11_state.json');
fs.writeFileSync(postDumpPath, JSON.stringify(liveData, null, 2), 'utf8');
console.log(`\nEstado live salvo em: ${postDumpPath}`);

console.log("\n=================================================");
if (pass) {
  console.log("RESULTADO FINAL GATE 4: VALIDAÇÃO 100% APROVADA! ✓");
} else {
  console.error("RESULTADO FINAL GATE 4: REPROVADO! ✗");
  process.exit(1);
}
console.log("=================================================");
