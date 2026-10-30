const { execSync } = require('child_process');
const fs = require('fs');

function runLinkedQuery(sql) {
  const tempFile = `scripts/temp_validate_p0_${Date.now()}.sql`;
  fs.writeFileSync(tempFile, sql, 'utf8');
  try {
    const out = execSync(`npx.cmd supabase db query --linked --file "${tempFile}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const parsed = JSON.parse(out);
    return parsed.rows || parsed;
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

const ZAPI_UUIDS = [
  'e2e293be-0df7-4d80-8cf0-b27a7268e33d',
  '2e2831f1-a060-4fe0-9eec-40a56096ae08',
  '64032882-67d0-4d3a-ba4d-0ee186d8c175',
  '1ce9d357-4170-4be6-a50d-c1115faf1676',
  '628290d8-6193-463c-8058-16b68f84ee13',
  '905468c9-b4eb-4554-9493-e072cc92ec0e',
];

const CANONICAL_ROUTES_UUIDS = [
  '7f0f541d-c72c-4aa8-bebb-764a292917b6',
  'c334b3ba-0993-449a-a58e-88fb89f7f3d1',
  'e8227c4e-15da-4c36-9dee-a044c4236199',
];

const ALL_9_TARGET_UUIDS = [...ZAPI_UUIDS, ...CANONICAL_ROUTES_UUIDS];

const RESTRICTED_UUIDS = [
  'd63482d7-27c9-4dbe-bc79-43dfc194acfe',
  'a3ba57c9-60a7-4c2d-8a5a-544dde3c0451',
  '2f8df9f3-4f4c-4d62-891f-a3e05ad2a2b5',
  'cf8b2ce5-ab17-4801-a114-d6d3976fac5f',
  'd8a7ab64-9080-476f-be29-18829321c61c',
  '60a1afbb-4cdf-4dcb-a9a4-ea95dc134b73',
  '4ec9d577-f0e8-4a9e-ae80-82cd5ff124b7'
];

async function runValidation() {
  console.log("=== INITIATING POST-MIGRATION VALIDATION R2E.26E.20C.3 ===\n");
  let passed = true;

  // 1. Fetch all tutorials from production
  console.log("[CHECK 1] Querying all tutorials via linked Supabase...");
  const sql = `SELECT id, title, category_id, profile_target, long_description, status FROM public.tutorials;`;
  const allTutorials = runLinkedQuery(sql);

  console.log(`Total tutorials in DB: ${allTutorials.length}`);
  if (allTutorials.length !== 58) {
    console.error(`FAIL: Expected exactly 58 tutorials, found ${allTutorials.length}`);
    passed = false;
  } else {
    console.log(" PASS: Total count remains strictly 58.");
  }

  const tutMap = new Map(allTutorials.map(t => [t.id, t]));

  // 2. Validate all 9 UUIDs are present
  console.log(`\n[CHECK 2] Verifying presence of all 9 target UUIDs...`);
  for (const id of ALL_9_TARGET_UUIDS) {
    if (!tutMap.has(id)) {
      console.error(` FAIL: Missing expected tutorial UUID: ${id}`);
      passed = false;
    }
  }
  if (passed) console.log(" PASS: All 9 target UUIDs exist in database.");

  // 3. Validate Z-API notice in the 6 WhatsApp tutorials
  console.log(`\n[CHECK 3] Verifying standardized Z-API notice on 6 WhatsApp articles...`);
  for (const id of ZAPI_UUIDS) {
    const tut = tutMap.get(id);
    if (!tut) continue;
    const desc = tut.long_description || '';
    const occurrences = (desc.match(/As automações de mensagens pelo WhatsApp dependem da integração com a Z-API/g) || []).length;
    if (occurrences === 1) {
      console.log(` PASS [${id.slice(0, 8)}] "${tut.title}": Contains exactly 1 Z-API notice.`);
    } else if (occurrences === 0) {
      console.error(` FAIL [${id.slice(0, 8)}] "${tut.title}": Missing Z-API notice!`);
      passed = false;
    } else {
      console.error(` FAIL [${id.slice(0, 8)}] "${tut.title}": Duplicate Z-API notices found (${occurrences})!`);
      passed = false;
    }
  }

  // 4. Validate canonical routes on the 3 cancellation/portal tutorials
  console.log(`\n[CHECK 4] Verifying canonical route instructions on 3 cancellation/portal articles...`);
  
  // 7f0f541d - Portal do Cliente e Clube Barbex
  const tPortal = tutMap.get('7f0f541d-c72c-4aa8-bebb-764a292917b6');
  if (tPortal) {
    const desc = tPortal.long_description || '';
    const hasPortal = desc.includes('/{slug}/portal') || desc.includes('barbex.shop/{slug}/portal');
    const hasToken = desc.includes('/agendamento/{token}') || desc.includes('barbex.shop/agendamento/{token}');
    const hasCreditPix = desc.includes('créditos') && desc.includes('PIX');
    if (hasPortal && hasToken && hasCreditPix) {
      console.log(` PASS [7f0f541d] "${tPortal.title}": Canonical portal routes & cancellation/credit/PIX flows documented.`);
    } else {
      console.error(` FAIL [7f0f541d] Missing required canonical routes or cancellation options in description.`);
      passed = false;
    }
  }

  // c334b3ba - Reagendamento
  const tReagendar = tutMap.get('c334b3ba-0993-449a-a58e-88fb89f7f3d1');
  if (tReagendar) {
    const desc = tReagendar.long_description || '';
    const hasPortal = desc.includes('/{slug}/portal') || desc.includes('barbex.shop/{slug}/portal');
    const hasToken = desc.includes('/agendamento/{token}') || desc.includes('barbex.shop/agendamento/{token}');
    if (hasPortal && hasToken) {
      console.log(` PASS [c334b3ba] "${tReagendar.title}": Canonical self-service routes documented.`);
    } else {
      console.error(` FAIL [c334b3ba] Missing canonical routes in reagendamento description.`);
      passed = false;
    }
  }

  // e8227c4e - Concluir ou Cancelar Atendimento
  const tAtendimento = tutMap.get('e8227c4e-15da-4c36-9dee-a044c4236199');
  if (tAtendimento) {
    const desc = tAtendimento.long_description || '';
    const hasCalendar = desc.includes('/calendar');
    const hasReception = desc.includes('/reception/agenda');
    const hasRefund = desc.includes('estorno') && desc.includes('crédito');
    if (hasCalendar && hasReception && hasRefund) {
      console.log(` PASS [e8227c4e] "${tAtendimento.title}": Canonical /calendar, /reception/agenda & client refund modalities documented.`);
    } else {
      console.error(` FAIL [e8227c4e] Missing /calendar, /reception/agenda or refund modalities in description.`);
      passed = false;
    }
  }

  // 5. Validate profile counts in DB
  console.log(`\n[CHECK 5] Verifying profile counts in database...`);
  const receptionDB = allTutorials.filter(t => (t.profile_target || []).includes('reception'));
  const clientDB = allTutorials.filter(t => (t.profile_target || []).includes('client'));
  const barberDB = allTutorials.filter(t => (t.profile_target || []).includes('barber'));

  console.log(` DB Reception count: ${receptionDB.length} (Expected: 12)`);
  console.log(` DB Client count: ${clientDB.length} (Expected: 3)`);
  console.log(` DB Barber count: ${barberDB.length} (Expected: 6)`);

  if (receptionDB.length !== 12) {
    console.error(` FAIL: Expected 12 reception articles in DB, got ${receptionDB.length}`);
    passed = false;
  }
  if (clientDB.length !== 3) {
    console.error(` FAIL: Expected 3 client articles in DB, got ${clientDB.length}`);
    passed = false;
  }
  if (barberDB.length !== 6) {
    console.error(` FAIL: Expected 6 barber articles in DB, got ${barberDB.length}`);
    passed = false;
  }

  // 6. Validate restricted articles protection
  console.log(`\n[CHECK 6] Verifying isolation of 7 restricted articles...`);
  for (const id of RESTRICTED_UUIDS) {
    const tut = tutMap.get(id);
    if (!tut) continue;
    const profiles = tut.profile_target || [];
    if (profiles.includes('reception') || profiles.includes('client') || profiles.includes('barber')) {
      console.error(` FAIL: Restricted tutorial ${id} has unauthorized roles: ${profiles.join(', ')}`);
      passed = false;
    }
  }
  if (passed) console.log(" PASS: 7 restricted managerial articles remain fully shielded.");

  // 7. Check migration version in schema_migrations
  console.log(`\n[CHECK 7] Verifying schema_migrations registry in production...`);
  const migSql = `SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261030110000';`;
  const migRows = runLinkedQuery(migSql);
  if (migRows.length > 0 && migRows[0].version === '20261030110000') {
    console.log(" PASS: Migration 20261030110000 is officially registered in schema_migrations.");
  } else {
    console.error(" FAIL: Migration 20261030110000 not found in schema_migrations!");
    passed = false;
  }

  // Final summary
  console.log("\n========================================================");
  if (passed) {
    console.log(">>> POST-MIGRATION VALIDATION SUCCESSFUL: ALL CHECKS PASSED <<<");
    console.log("========================================================");
    process.exit(0);
  } else {
    console.error(">>> POST-MIGRATION VALIDATION FAILED! <<<");
    console.log("========================================================");
    process.exit(1);
  }
}

runValidation().catch(e => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
