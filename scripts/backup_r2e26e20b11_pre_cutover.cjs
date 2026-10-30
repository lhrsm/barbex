const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("=== GATE 1: GERANDO SNAPSHOT DE BACKUP PRÉ-CUTOVER (PRODUÇÃO) ===");

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

// Query all in one trip:
const targetList = TARGET_UUIDS.map(id => `'${id}'`).join(',');
const restrictedList = RESTRICTED_UUIDS.map(id => `'${id}'`).join(',');

const sql = `
SELECT json_build_object(
  'timestamp', NOW(),
  'target_records', (
    SELECT json_agg(t) FROM (
      SELECT id, title, category_id, module_key, profile_target, status
      FROM tutorials
      WHERE id IN (${targetList})
      ORDER BY id
    ) t
  ),
  'restricted_records', (
    SELECT json_agg(r) FROM (
      SELECT id, title, category_id, module_key, profile_target, status
      FROM tutorials
      WHERE id IN (${restrictedList})
      ORDER BY id
    ) r
  ),
  'policies', (
    SELECT json_agg(p) FROM (
      SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as qual
      FROM pg_policy
      WHERE polrelid = 'tutorials'::regclass
    ) p
  ),
  'summary_counts', (
    SELECT json_build_object(
      'total_tutorials', count(*),
      'with_reception', count(*) FILTER (WHERE 'reception' = ANY(profile_target)),
      'with_client', count(*) FILTER (WHERE 'client' = ANY(profile_target)),
      'with_receptionist', count(*) FILTER (WHERE 'receptionist' = ANY(profile_target))
    ) FROM tutorials
  )
) as backup_manifest;
`;

const cleanSql = sql.replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
console.log("Executando snapshot direto no banco de produção...");
const output = execSync(`npx.cmd supabase db query --linked "${cleanSql}"`, {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024
});

const jsonStart = output.indexOf('{');
if (jsonStart === -1) {
  throw new Error("Falha ao obter JSON de retorno: " + output);
}
const result = JSON.parse(output.slice(jsonStart));
const manifest = result.rows[0].backup_manifest;

console.log("Backup obtido com sucesso!");
console.log(`- Registros alvo: ${manifest.target_records.length}`);
console.log(`- Registros restritos: ${manifest.restricted_records.length}`);
console.log(`- Policies RLS: ${manifest.policies.length}`);
console.log(`- Contagens atuais:`, manifest.summary_counts);

// Verificação de integridade do backup:
if (manifest.target_records.length !== 9) {
  throw new Error(`ERRO: Esperado 9 registros alvo, recebido ${manifest.target_records.length}`);
}
if (manifest.restricted_records.length !== 7) {
  throw new Error(`ERRO: Esperado 7 registros restritos, recebido ${manifest.restricted_records.length}`);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFilename = `backup_r2e26e20b11_pre_cutover_${timestamp}.json`;
const backupPath = path.join(__dirname, backupFilename);
const latestPath = path.join(__dirname, 'backup_r2e26e20b11_pre_cutover_latest.json');

fs.writeFileSync(backupPath, JSON.stringify(manifest, null, 2), 'utf8');
fs.writeFileSync(latestPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log(`Snapshot salvo em: ${backupPath}`);
console.log(`Snapshot latest atualizado em: ${latestPath}`);
