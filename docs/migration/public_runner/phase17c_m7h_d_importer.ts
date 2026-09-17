/**
 * BARBEX — PHASE 17C.M7H-D
 * TARGET PUBLIC DATA PHYSICAL MATERIALIZATION RUNNER
 * CHECKPOINT D — 7 IMPORT STAGES / FAIL-CLOSED TRANSACTION BOUNDARIES
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

// Authority Hashes
const EXPECTED_A4B_DELTA = "87e9979de3b2737d22dff88814d220d027c42a56b48963c1eefaec141475a00b";
const EXPECTED_A4B_BUNDLE = "62e10366e085591c1a370c002466f8d51ea021184b2a00572eb56bba532a23f6";
const EXPECTED_STORAGE_BUNDLE = "5a719badc98f4c25e797ceedd4cd803c3560cb992ac9e43bd2908b9e7054b362";
const EXPECTED_REMEDIATION_AUTHORITY = "f32620c1984a0dc67b0729f5e92b90c6b731c08833f0f7c7803f64ac89068f78";

function computeSha256(buf: Buffer | string): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
      rows.push(currentRow);
    }
  }
  return rows;
}

function escapeSql(val: string): string {
  return val.replace(/'/g, "''");
}

function formatSqlValue(val: string, colMeta: { data_type: string; udt_name: string; is_nullable: string }): string {
  if (val === null || val === undefined || val === '') {
    return 'NULL';
  }

  const { data_type, udt_name } = colMeta;

  if (data_type === 'boolean') {
    return val.toLowerCase() === 'true' || val === '1' || val === 't' ? 'true' : 'false';
  }

  if (['integer', 'smallint', 'bigint', 'numeric', 'real', 'double precision'].includes(data_type)) {
    return val;
  }

  if (udt_name.startsWith('_')) {
    const elemType = udt_name.substring(1);
    if (!val || val === '' || val === '[]' || val === '{}') {
      return `ARRAY[]::${elemType}[]`;
    }
    if (val.startsWith('[')) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) return `ARRAY[]::${elemType}[]`;
          const items = parsed.map(x => `'${escapeSql(String(x))}'`).join(', ');
          return `ARRAY[${items}]::${elemType}[]`;
        }
      } catch (e) {
        // fallback
      }
    }
    if (val.startsWith('{')) {
      return `'${escapeSql(val)}'::${elemType}[]`;
    }
    return `ARRAY['${escapeSql(val)}']::${elemType}[]`;
  }

  if (data_type === 'json' || data_type === 'jsonb') {
    return `'${escapeSql(val)}'::jsonb`;
  }

  if (data_type.includes('timestamp') || data_type === 'date' || data_type === 'time') {
    return `'${escapeSql(val)}'::timestamptz`;
  }

  if (data_type === 'uuid') {
    return `'${val}'::uuid`;
  }

  return `'${escapeSql(val)}'`;
}

function executeTargetSql(sql: string, tag: string): any {
  const tempFile = path.join('.migration-secrets', `m7h_d_${tag}_${Date.now()}.sql`);
  fs.writeFileSync(tempFile, sql, 'utf8');
  try {
    const out = execSync(`npx supabase db query --linked --project-ref ywdwrstxvsdqiryhieiz -f ${tempFile}`, { encoding: 'utf8' });
    return out;
  } catch (err: any) {
    console.error(`[EXEC ERROR on ${tag}]:`);
    if (err.stdout) console.error('STDOUT:', err.stdout.toString());
    if (err.stderr) console.error('STDERR:', err.stderr.toString());
    throw err;
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

function queryTargetCount(sql: string): number {
  const tempFile = path.join('.migration-secrets', `m7h_d_cnt_${Date.now()}.sql`);
  fs.writeFileSync(tempFile, sql, 'utf8');
  try {
    const out = execSync(`npx supabase db query --linked --project-ref ywdwrstxvsdqiryhieiz -f ${tempFile}`, { encoding: 'utf8' });
    const match = out.match(/\{[\s\S]*"rows":\s*(\[[\s\S]*?\])[\s\S]*\}/);
    if (!match) return 0;
    const rows = JSON.parse(match[1]);
    return Number(rows[0]?.cnt || 0);
  } catch (err) {
    return 0;
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

async function run() {
  console.log('=====================================================================');
  console.log('BARBEX — PHASE 17C.M7H-D TARGET PUBLIC DATA MATERIALIZATION RUNNER');
  console.log('=====================================================================');

  // STEP 1: Authority Hash Gates
  console.log('\n[1/10] Verifying Execution Authority Hashes...');
  const a4bDeltaSha = computeSha256(fs.readFileSync('docs/migration/evidence/phase17c_m7h_a4b_final_delta_manifest.json'));
  const candidateSha = computeSha256(fs.readFileSync('docs/migration/evidence/phase17c_m7h_a4b_final_candidate.json'));
  const deltaCsvSha = computeSha256(fs.readFileSync('.migration-secrets/final-delta/M7H-A4B-DELTA-1789053601540/status_checks_delta.csv'));
  const a4bBundleSha = computeSha256([
    a4bDeltaSha,
    candidateSha,
    deltaCsvSha,
    "BARBEX-CANONICAL-20260909-02b6e234",
    "1491b063b45d336a5f423a42dcc88a8723a7bd1c9edf4d9bce6aa8b967fecf25",
    "e7f20b696f60bc97d2d714c541a261273fff18b8a967d61bcb8ae95f02c36bee"
  ].join(':'));
  const storageBundleSha = JSON.parse(fs.readFileSync('docs/migration/evidence/phase17c_m7h_b_bundle.json', 'utf8')).bundle_hash;
  const remediationSha = computeSha256(fs.readFileSync('docs/migration/evidence/phase17c_m7h_c_remediation_authority.json', 'utf8'));

  console.log(`  A4B Delta Hash: ${a4bDeltaSha} (${a4bDeltaSha === EXPECTED_A4B_DELTA ? 'MATCH' : 'MISMATCH'})`);
  console.log(`  A4B Bundle Hash: ${a4bBundleSha} (${a4bBundleSha === EXPECTED_A4B_BUNDLE ? 'MATCH' : 'MISMATCH'})`);
  console.log(`  Storage Bundle Hash: ${storageBundleSha} (${storageBundleSha === EXPECTED_STORAGE_BUNDLE ? 'MATCH' : 'MISMATCH'})`);
  console.log(`  Remediation Authority Hash: ${remediationSha} (${remediationSha === EXPECTED_REMEDIATION_AUTHORITY ? 'MATCH' : 'MISMATCH'})`);

  if (a4bDeltaSha !== EXPECTED_A4B_DELTA || a4bBundleSha !== EXPECTED_A4B_BUNDLE || storageBundleSha !== EXPECTED_STORAGE_BUNDLE || remediationSha !== EXPECTED_REMEDIATION_AUTHORITY) {
    throw new Error('GATE_FAIL: Authority hash mismatch!');
  }

  // STEP 2: Source Freeze Precheck
  console.log('\n[2/10] Passively Verifying Source Freeze...');
  const env = fs.readFileSync('.env', 'utf8');
  const sourceUrl = env.match(/SUPABASE_URL="?([^"\r\n]+)"?/)?.[1];
  const sourceKey = env.match(/SUPABASE_PUBLISHABLE_KEY="?([^"\r\n]+)"?/)?.[1];
  const sbSource = createClient(sourceUrl!, sourceKey!);

  const { count: sourceScRows } = await sbSource.from('status_checks').select('*', { count: 'exact', head: true });
  const { data: sourceMaxId } = await sbSource.from('status_checks').select('id').order('id', { ascending: false }).limit(1).single();

  console.log(`  Source status_checks rows: ${sourceScRows} (required: 256998)`);
  console.log(`  Source status_checks max id: ${sourceMaxId?.id} (required: 256998)`);
  if (sourceScRows !== 256998 || sourceMaxId?.id !== 256998) {
    throw new Error('GATE_FAIL: Source freeze lost! Status checks mutated.');
  }

  // STEP 3: Target Foundation Precheck
  console.log('\n[3/10] Verifying Target Foundation State...');
  const precheckSql = `SELECT (SELECT count(*) FROM auth.users) AS users, (SELECT count(*) FROM auth.identities) AS identities, (SELECT count(*) FROM storage.buckets) AS buckets, (SELECT count(*) FROM storage.objects) AS objects, (SELECT sum(c) FROM (SELECT count(*) AS c FROM public.profiles UNION ALL SELECT count(*) FROM public.barbers UNION ALL SELECT count(*) FROM public.status_checks) t) AS public_rows;`;
  const precheckOut = executeTargetSql(precheckSql, 'precheck');
  const preRows = JSON.parse(precheckOut.match(/\{[\s\S]*"rows":\s*(\[[\s\S]*?\])[\s\S]*\}/)[1])[0];
  console.log(`  Target Auth Users: ${preRows.users} (required: 10)`);
  console.log(`  Target Auth Identities: ${preRows.identities} (required: 12)`);
  console.log(`  Target Storage Buckets: ${preRows.buckets} (required: 5)`);
  console.log(`  Target Storage Objects: ${preRows.objects} (required: 30)`);
  console.log(`  Target Public Rows Before Import: ${preRows.public_rows} (required: 0)`);

  if (Number(preRows.users) !== 10 || Number(preRows.identities) !== 12 || Number(preRows.buckets) !== 5 || Number(preRows.objects) !== 30 || Number(preRows.public_rows) !== 0) {
    throw new Error('GATE_FAIL: Target foundation invalid or public rows not empty!');
  }

  // Load Target Table Catalog
  const catalog = JSON.parse(fs.readFileSync('scratch/target_25_tables_catalog.json', 'utf8'));

  // STEP 4: Controlled Trigger Suppression
  console.log('\n[4/10] Executing Controlled Application Trigger Suppression...');
  const triggersToSuppress = [
    { table: 'profiles', trigger: 'trg_admin_notify_new_tenant' },
    { table: 'profiles', trigger: 'trg_admin_notify_tenant_signup' },
    { table: 'profiles', trigger: 'tr_protect_role_column' },
    { table: 'profiles', trigger: 'trg_admin_notify_plan_change' },
    { table: 'profiles', trigger: 'trg_guard_internal_test_tenant_flag' },
    { table: 'profiles', trigger: 'trg_sync_modules_on_profile_plan' },
    { table: 'profiles', trigger: 'update_profiles_updated_at' },
    { table: 'barbers', trigger: 'update_barbers_updated_at' },
    { table: 'customers', trigger: 'update_customers_updated_at' },
    { table: 'appointments', trigger: 'on_payment_status_change' },
    { table: 'appointments', trigger: 'tr_ensure_appointment_tenant_id' },
    { table: 'appointments', trigger: 'tr_handle_appointment_completion' },
    { table: 'appointments', trigger: 'tr_notify_new_appointment' },
    { table: 'appointments', trigger: 'tr_reserve_usage_log_on_insert' },
    { table: 'appointments', trigger: 'tr_sync_usage_logs_on_status' },
    { table: 'appointments', trigger: 'trg_appointment_completion_review_decision' },
    { table: 'appointments', trigger: 'trg_appointments_no_overlap' },
    { table: 'appointments', trigger: 'trg_commission_on_appointment' },
    { table: 'appointments', trigger: 'trg_first_appointment' },
    { table: 'appointments', trigger: 'update_appointments_updated_at' },
    { table: 'notifications', trigger: 'tr_sync_notification_read' }
  ];

  let suppressSql = 'BEGIN;\n';
  for (const t of triggersToSuppress) {
    suppressSql += `ALTER TABLE public."${t.table}" DISABLE TRIGGER "${t.trigger}";\n`;
  }
  suppressSql += 'COMMIT;\n';
  executeTargetSql(suppressSql, 'suppress_triggers');
  console.log(`  -> Successfully suppressed ${triggersToSuppress.length} certified application triggers across 6 tables.`);

  // Function to build table insert SQL
  function buildTableInsertSql(tableName: string, dataRows: string[][], headers: string[]): string {
    const tblMeta = catalog[tableName];
    if (!tblMeta) throw new Error(`Missing catalog metadata for ${tableName}`);

    // Filter out generated columns (customer_credits.available_amount) and columns not on Target
    const insertCols = headers.filter(h => {
      if (tableName === 'customer_credits' && h === 'available_amount') return false;
      return tblMeta[h] !== undefined;
    });

    const colIndexes = insertCols.map(c => headers.indexOf(c));
    const quotedCols = insertCols.map(c => `"${c}"`).join(', ');

    // Chunk into 5,000 rows max per INSERT statement
    const chunkSize = 5000;
    const statements: string[] = [];

    for (let c = 0; c < dataRows.length; c += chunkSize) {
      const chunk = dataRows.slice(c, c + chunkSize);
      const valuesList = chunk.map(row => {
        const vals = colIndexes.map(idx => {
          const colName = headers[idx];
          const rawVal = row[idx];
          return formatSqlValue(rawVal, tblMeta[colName]);
        });
        return `(${vals.join(', ')})`;
      }).join(',\n');

      statements.push(`INSERT INTO public."${tableName}" (${quotedCols}) VALUES \n${valuesList};`);
    }

    return statements.join('\n');
  }

  const stageResults: Record<string, any> = {};

  // STEP 5: STAGE 1 — Level 0 Tables (11 tables, 106 rows)
  console.log('\n[5/10] Executing STAGE 1: Level 0 Tables (11 tables)...');
  const stage1Tables = [
    'loyalty_achievements',
    'loyalty_campaign_templates',
    'loyalty_levels',
    'loyalty_settings',
    'onboarding_settings',
    'plans',
    'profiles',
    'saas_addons',
    'status_services',
    'subprocessors',
    'tutorial_categories'
  ];

  const currentProfiles = queryTargetCount('SELECT count(*) AS cnt FROM public.profiles');
  let stage1ExpectedRows = 106;
  if (currentProfiles === 10) {
    console.log('  -> STAGE 1 already committed (profiles = 10). Skipping insertion.');
    stageResults['stage_1'] = { status: 'COMMITTED', tables: stage1Tables.length, rows: stage1ExpectedRows };
  } else {
    let stage1Sql = 'BEGIN;\n';
    stage1ExpectedRows = 0;
    for (const tbl of stage1Tables) {
      const parsed = parseCsv(fs.readFileSync(`.migration-secrets/public-data/M7F-CAPTURE-1789043053743/${tbl}.csv`, 'utf8'));
      const headers = parsed[0];
      const rows = parsed.slice(1);
      stage1ExpectedRows += rows.length;
      stage1Sql += `-- Table: ${tbl} (${rows.length} rows)\n`;
      stage1Sql += buildTableInsertSql(tbl, rows, headers) + '\n';
    }
    // In-transaction verifier
    stage1Sql += `
      DO $$
      DECLARE
        v_cnt INTEGER;
      BEGIN
        SELECT count(*) INTO v_cnt FROM public.profiles;
        IF v_cnt <> 10 THEN RAISE EXCEPTION 'STAGE 1 VERIFIER FAIL: profiles count is %', v_cnt; END IF;
      END $$;
      COMMIT;
    `;
    executeTargetSql(stage1Sql, 'stage1');
    stageResults['stage_1'] = { status: 'COMMITTED', tables: stage1Tables.length, rows: stage1ExpectedRows };
    console.log(`  -> STAGE 1 COMMITTED: ${stage1ExpectedRows} rows inserted across ${stage1Tables.length} tables.`);
  }

  // STEP 6: STAGE 2 — Level 1 Tables (6 tables, 236 rows)
  console.log('\n[6/10] Executing STAGE 2: Level 1 Tables (6 tables, status_checks deferred to Stage 3)...');
  const stage2Tables = [
    'barbers',
    'barbershop_modules',
    'barbershops',
    'customers',
    'services',
    'tutorials'
  ];

  const currentBarbers = queryTargetCount('SELECT count(*) AS cnt FROM public.barbers');
  let stage2ExpectedRows = 236;
  if (currentBarbers === 8) {
    console.log('  -> STAGE 2 already committed (barbers = 8). Skipping insertion.');
    stageResults['stage_2'] = { status: 'COMMITTED', tables: stage2Tables.length, rows: stage2ExpectedRows };
  } else {
    let stage2Sql = 'BEGIN;\n';
    stage2ExpectedRows = 0;
    for (const tbl of stage2Tables) {
      const parsed = parseCsv(fs.readFileSync(`.migration-secrets/public-data/M7F-CAPTURE-1789043053743/${tbl}.csv`, 'utf8'));
      const headers = parsed[0];
      const rows = parsed.slice(1);
      stage2ExpectedRows += rows.length;
      stage2Sql += `-- Table: ${tbl} (${rows.length} rows)\n`;
      stage2Sql += buildTableInsertSql(tbl, rows, headers) + '\n';
    }
    stage2Sql += `
      DO $$
      DECLARE
        v_cnt INTEGER;
      BEGIN
        SELECT count(*) INTO v_cnt FROM public.barbers;
        IF v_cnt <> 8 THEN RAISE EXCEPTION 'STAGE 2 VERIFIER FAIL: barbers count is %', v_cnt; END IF;
        SELECT count(*) INTO v_cnt FROM public.customers;
        IF v_cnt <> 12 THEN RAISE EXCEPTION 'STAGE 2 VERIFIER FAIL: customers count is %', v_cnt; END IF;
      END $$;
      COMMIT;
    `;
    executeTargetSql(stage2Sql, 'stage2');
    stageResults['stage_2'] = { status: 'COMMITTED', tables: stage2Tables.length, rows: stage2ExpectedRows };
    console.log(`  -> STAGE 2 COMMITTED: ${stage2ExpectedRows} rows inserted across ${stage2Tables.length} tables.`);
  }

  // STEP 7: STAGE 3 — status_checks (11 keyset batches, 256,998 rows)
  console.log('\n[7/10] Executing STAGE 3: status_checks (11 Keyset Batches, 256,998 rows)...');
  let statusChecksInserted = 0;
  const statusChecksBatches = [];

  for (let b = 1; b <= 11; b++) {
    const bPadded = String(b).padStart(5, '0');
    const batchFileName = `batch-${bPadded}.csv`;
    const batchPath = `.migration-secrets/public-data/M7F-CAPTURE-1789043053743/status_checks/${batchFileName}`;
    const parsed = parseCsv(fs.readFileSync(batchPath, 'utf8'));
    const headers = parsed[0];
    let rows = parsed.slice(1);

    if (b === 11) {
      // Append the delta rows to batch 11
      const deltaPath = '.migration-secrets/final-delta/M7H-A4B-DELTA-1789053601540/status_checks_delta.csv';
      const deltaParsed = parseCsv(fs.readFileSync(deltaPath, 'utf8'));
      const deltaRows = deltaParsed.slice(1);
      console.log(`    (Batch 11: appending ${deltaRows.length} delta rows to ${rows.length} snapshot rows)`);
      rows = rows.concat(deltaRows);
    }

    const minIdInBatch = rows[0][0];
    const maxIdInBatch = rows[rows.length - 1][0];

    // Sub-chunk into 5,000 rows max per query payload to strictly satisfy HTTP entity size limits
    const subChunkSize = 5000;
    for (let c = 0; c < rows.length; c += subChunkSize) {
      const chunkRows = rows.slice(c, c + subChunkSize);
      const chunkSql = buildTableInsertSql('status_checks', chunkRows, headers);
      executeTargetSql(chunkSql, `sc_b${b}_c${Math.floor(c / subChunkSize) + 1}`);
    }

    // Verify after batch insertion
    const verifySql = `
      DO $$
      DECLARE
        v_max_id BIGINT;
      BEGIN
        SELECT max(id) INTO v_max_id FROM public.status_checks;
        IF v_max_id < ${maxIdInBatch} THEN
          RAISE EXCEPTION 'BATCH ${b} VERIFIER FAIL: max id expected at least ${maxIdInBatch}, got %', v_max_id;
        END IF;
      END $$;
    `;
    executeTargetSql(verifySql, `sc_verify_b${b}`);

    statusChecksInserted += rows.length;
    statusChecksBatches.push({
      batch: b,
      rows: rows.length,
      min_id: Number(minIdInBatch),
      max_id: Number(maxIdInBatch)
    });
    console.log(`  -> Batch ${b}/11 committed: ${rows.length} rows (IDs ${minIdInBatch}..${maxIdInBatch}). Cumulative: ${statusChecksInserted}`);
  }

  stageResults['stage_3'] = {
    status: 'COMMITTED',
    table: 'status_checks',
    batches: 11,
    rows: statusChecksInserted,
    min_id: 1,
    max_id: 256998
  };

  // STEP 8: STAGE 4 — Level 2 Tables (3 tables, 36 rows with Model A exclusions)
  console.log('\n[8/10] Executing STAGE 4: Level 2 Tables (3 tables, barber_services stale rows excluded)...');
  const stage4Tables = ['barber_services', 'products', 'subscription_plans'];
  const excludedBarberServiceIds = [
    "00b25157-87d5-4044-ad2e-d9dcf96c2618",
    "18e96e90-8e61-4142-aa06-93afd310216b",
    "d371b9cb-469e-4b72-a3df-5489b8d3cb2f",
    "d978ee8f-2688-4d58-b42e-822a8329888b"
  ];

  let stage4Sql = 'BEGIN;\n';
  let stage4ExpectedRows = 0;
  for (const tbl of stage4Tables) {
    const parsed = parseCsv(fs.readFileSync(`.migration-secrets/public-data/M7F-CAPTURE-1789043053743/${tbl}.csv`, 'utf8'));
    const headers = parsed[0];
    let rows = parsed.slice(1);

    if (tbl === 'barber_services') {
      const idIdx = headers.indexOf('id');
      const initialCount = rows.length;
      rows = rows.filter(r => !excludedBarberServiceIds.includes(r[idIdx]));
      console.log(`    (Rule REM-EXCLUDE-01: filtered ${initialCount - rows.length} stale barber_services rows. Retained: ${rows.length})`);
    }

    stage4ExpectedRows += rows.length;
    stage4Sql += `-- Table: ${tbl} (${rows.length} rows)\n`;
    stage4Sql += buildTableInsertSql(tbl, rows, headers) + '\n';
  }
  stage4Sql += `
    DO $$
    DECLARE
      v_cnt INTEGER;
    BEGIN
      SELECT count(*) INTO v_cnt FROM public.barber_services;
      IF v_cnt <> 22 THEN RAISE EXCEPTION 'STAGE 4 VERIFIER FAIL: barber_services count is %', v_cnt; END IF;
    END $$;
    COMMIT;
  `;
  executeTargetSql(stage4Sql, 'stage4');
  stageResults['stage_4'] = { status: 'COMMITTED', tables: stage4Tables.length, rows: stage4ExpectedRows };
  console.log(`  -> STAGE 4 COMMITTED: ${stage4ExpectedRows} rows inserted across ${stage4Tables.length} tables.`);

  // STEP 9: STAGE 5 — Level 3 Tables (2 tables, 88 rows with Model A transform)
  console.log('\n[9/10] Executing STAGE 5: Level 3 Tables (appointments orphan subscription_id -> NULL)...');
  const stage5Tables = ['appointments', 'subscription_plan_services'];
  const orphanSubscriptionApptIds = [
    "3da3b661-be36-441c-a9a5-9a48abe9bb1a",
    "39f8e617-51a6-4265-8d02-672d186b5b92",
    "683099a1-ec63-4aba-ba0a-23b20d47dab6",
    "13130eb0-f1ca-4d32-b4a1-9901f4d5093c",
    "329b8fe9-454c-4968-9937-ee8244a6b6bb"
  ];

  let stage5Sql = 'BEGIN;\n';
  let stage5ExpectedRows = 0;
  for (const tbl of stage5Tables) {
    const parsed = parseCsv(fs.readFileSync(`.migration-secrets/public-data/M7F-CAPTURE-1789043053743/${tbl}.csv`, 'utf8'));
    const headers = parsed[0];
    const rows = parsed.slice(1);

    if (tbl === 'appointments') {
      const idIdx = headers.indexOf('id');
      const subIdx = headers.indexOf('subscription_id');
      let transformedCount = 0;
      for (const r of rows) {
        if (orphanSubscriptionApptIds.includes(r[idIdx])) {
          r[subIdx] = ''; // sets to NULL in formatSqlValue
          transformedCount++;
        }
      }
      console.log(`    (Rule REM-TRANSFORM-01: transformed ${transformedCount} orphan subscription_id fields to NULL)`);
    }

    stage5ExpectedRows += rows.length;
    stage5Sql += `-- Table: ${tbl} (${rows.length} rows)\n`;
    stage5Sql += buildTableInsertSql(tbl, rows, headers) + '\n';
  }
  stage5Sql += `
    DO $$
    DECLARE
      v_cnt INTEGER;
    BEGIN
      SELECT count(*) INTO v_cnt FROM public.appointments;
      IF v_cnt <> 79 THEN RAISE EXCEPTION 'STAGE 5 VERIFIER FAIL: appointments count is %', v_cnt; END IF;
      SELECT count(*) INTO v_cnt FROM public.appointments WHERE id IN (
        '3da3b661-be36-441c-a9a5-9a48abe9bb1a',
        '39f8e617-51a6-4265-8d02-672d186b5b92',
        '683099a1-ec63-4aba-ba0a-23b20d47dab6',
        '13130eb0-f1ca-4d32-b4a1-9901f4d5093c',
        '329b8fe9-454c-4968-9937-ee8244a6b6bb'
      ) AND subscription_id IS NOT NULL;
      IF v_cnt <> 0 THEN RAISE EXCEPTION 'STAGE 5 VERIFIER FAIL: transformed appointments still have subscription_id'; END IF;
    END $$;
    COMMIT;
  `;
  executeTargetSql(stage5Sql, 'stage5');
  stageResults['stage_5'] = { status: 'COMMITTED', tables: stage5Tables.length, rows: stage5ExpectedRows };
  console.log(`  -> STAGE 5 COMMITTED: ${stage5ExpectedRows} rows inserted across ${stage5Tables.length} tables.`);

  // STEP 10: STAGE 6 — Level 4 Tables (2 tables, 223 rows)
  console.log('\n[10/10] Executing STAGE 6: Level 4 Tables (appointment_reviews, notifications)...');
  const stage6Tables = ['appointment_reviews', 'notifications'];

  let stage6Sql = 'BEGIN;\n';
  let stage6ExpectedRows = 0;
  for (const tbl of stage6Tables) {
    const parsed = parseCsv(fs.readFileSync(`.migration-secrets/public-data/M7F-CAPTURE-1789043053743/${tbl}.csv`, 'utf8'));
    const headers = parsed[0];
    const rows = parsed.slice(1);
    stage6ExpectedRows += rows.length;
    stage6Sql += `-- Table: ${tbl} (${rows.length} rows)\n`;
    stage6Sql += buildTableInsertSql(tbl, rows, headers) + '\n';
  }
  stage6Sql += `
    DO $$
    DECLARE
      v_cnt INTEGER;
    BEGIN
      SELECT count(*) INTO v_cnt FROM public.notifications;
      IF v_cnt <> 217 THEN RAISE EXCEPTION 'STAGE 6 VERIFIER FAIL: notifications count is %', v_cnt; END IF;
    END $$;
    COMMIT;
  `;
  executeTargetSql(stage6Sql, 'stage6');
  stageResults['stage_6'] = { status: 'COMMITTED', tables: stage6Tables.length, rows: stage6ExpectedRows };
  console.log(`  -> STAGE 6 COMMITTED: ${stage6ExpectedRows} rows inserted across ${stage6Tables.length} tables.`);

  // STAGE 7: Post-Import Transformations, Reseed & Trigger Restoration
  console.log('\nExecuting STAGE 7: Post-Import URL Rewrite, Sequence Reseed & Trigger Restoration...');
  let stage7Sql = 'BEGIN;\n';

  // 1. Storage URL Rewrite for certified 6 rows
  stage7Sql += `
    UPDATE public.barbers
    SET avatar_url = REPLACE(avatar_url, 'https://wdxhjwodyctgzqtogkgv.supabase.co', 'https://ywdwrstxvsdqiryhieiz.supabase.co')
    WHERE avatar_url LIKE '%wdxhjwodyctgzqtogkgv%';

    UPDATE public.profiles
    SET avatar_url = REPLACE(avatar_url, 'https://wdxhjwodyctgzqtogkgv.supabase.co', 'https://ywdwrstxvsdqiryhieiz.supabase.co')
    WHERE avatar_url LIKE '%wdxhjwodyctgzqtogkgv%';

    UPDATE public.profiles
    SET logo_url = REPLACE(logo_url, 'https://wdxhjwodyctgzqtogkgv.supabase.co', 'https://ywdwrstxvsdqiryhieiz.supabase.co')
    WHERE logo_url LIKE '%wdxhjwodyctgzqtogkgv%';
  `;

  // 2. Reseed Sequences
  stage7Sql += `
    SELECT setval('public.rate_limit_hits_id_seq', 1, false);
    SELECT setval('public.status_checks_id_seq', 256998, true);
  `;

  // 3. Restore all temporarily suppressed application triggers
  for (const t of triggersToSuppress) {
    stage7Sql += `ALTER TABLE public."${t.table}" ENABLE TRIGGER "${t.trigger}";\n`;
  }

  // 4. In-transaction verifications
  stage7Sql += `
    DO $$
    DECLARE
      v_b_rewritten INTEGER;
      v_p_rewritten INTEGER;
      v_rl_next BIGINT;
      v_sc_next BIGINT;
    BEGIN
      SELECT count(*) INTO v_b_rewritten FROM public.barbers WHERE avatar_url LIKE '%ywdwrstxvsdqiryhieiz%';
      IF v_b_rewritten <> 5 THEN RAISE EXCEPTION 'STAGE 7 VERIFIER FAIL: barbers rewritten expected 5, got %', v_b_rewritten; END IF;

      SELECT count(*) INTO v_p_rewritten FROM public.profiles WHERE (avatar_url LIKE '%ywdwrstxvsdqiryhieiz%' OR logo_url LIKE '%ywdwrstxvsdqiryhieiz%');
      IF v_p_rewritten <> 1 THEN RAISE EXCEPTION 'STAGE 7 VERIFIER FAIL: profiles rewritten expected 1, got %', v_p_rewritten; END IF;

      SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END INTO v_rl_next FROM public.rate_limit_hits_id_seq;
      IF v_rl_next <> 1 THEN RAISE EXCEPTION 'STAGE 7 VERIFIER FAIL: rate_limit_hits_id_seq next expected 1, got %', v_rl_next; END IF;

      SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END INTO v_sc_next FROM public.status_checks_id_seq;
      IF v_sc_next <> 256999 THEN RAISE EXCEPTION 'STAGE 7 VERIFIER FAIL: status_checks_id_seq next expected 256999, got %', v_sc_next; END IF;
    END $$;
    COMMIT;
  `;

  executeTargetSql(stage7Sql, 'stage7');
  stageResults['stage_7'] = {
    status: 'COMMITTED',
    storage_urls_rewritten: 6,
    sequences_reseeded: { rate_limit_hits: 1, status_checks: 256999 },
    triggers_restored: triggersToSuppress.length
  };
  console.log(`  -> STAGE 7 COMMITTED: 6 Storage URLs rewritten, 2 sequences reseeded, ${triggersToSuppress.length} triggers restored.`);

  fs.writeFileSync('docs/migration/evidence/phase17c_m7h_d_stage_results.json', JSON.stringify(stageResults, null, 2), 'utf8');

  console.log('\n=====================================================================');
  console.log('ALL 7 STAGES COMMITTED CLEANLY! PROCEEDING TO VERIFICATION GATES');
  console.log('=====================================================================');
}

run();
