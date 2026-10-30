const crypto = require('crypto');
const fs = require('fs');

const dump = JSON.parse(fs.readFileSync('scripts/live_58_articles_dump.json', 'utf8'));

const targetUuids = [
  "cf240ea1-0dec-4817-8afe-8626c4968e21",
  "e8227c4e-15da-4c36-9dee-a044c4236199",
  "a10df4f8-3f19-4c0e-b129-1f70608457c6",
  "c334b3ba-0993-449a-a58e-88fb89f7f3d1",
  "64f5bafc-7abb-44f1-9836-683dca7ce9d9",
  "b3324233-56e8-49b8-a1ed-1e7acb6fc28e",
  "09eba6e4-6234-4641-95ce-f3901f655109",
  "6a493a70-c0fd-4881-8e2a-66fb29f24d9b",
  "f1f13775-30d4-4989-99b0-fc94dbad79ff"
];

console.log("=== VERIFICAÇÃO DE INTEGRIDADE DOS 9 UUIDS ALVO ===");

let allFound = true;
let noneHasReception = true;

targetUuids.forEach((uuid, idx) => {
  const item = dump.find(a => a.id === uuid);
  if (!item) {
    console.error(`[FAIL] UUID não encontrado: ${uuid}`);
    allFound = false;
    return;
  }
  const sha256 = crypto.createHash('sha256').update(uuid).digest('hex');
  const hasReception = Array.isArray(item.profile_target) && item.profile_target.includes('reception');
  if (hasReception) noneHasReception = false;

  console.log(`[${idx + 1}] UUID: ${uuid} | SHA256: ${sha256.substring(0, 16)}...`);
  console.log(`    Title: "${item.title}"`);
  console.log(`    Targets: ${JSON.stringify(item.profile_target)} | Contains 'reception': ${hasReception}`);
});

const listHash = crypto.createHash('sha256').update(targetUuids.sort().join(',')).digest('hex');
console.log("\nSHA256 combinado da lista de UUIDs:", listHash);
console.log("Todos encontrados:", allFound);
console.log("Nenhum contém 'reception' atualmente:", noneHasReception);

