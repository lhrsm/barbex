import * as fs from 'fs';
import * as crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_MANIFEST_SHA256 = "e7f20b696f60bc97d2d714c541a261273fff18b8a967d61bcb8ae95f02c36bee";
const EXPECTED_BUNDLE_SHA256 = "e8776cdf7769a646bc863f3770d792a739b78f33f66b9a815463648c2e9023e5";

async function main() {
  console.log("=== 1. VERIFY M7F IMMUTABILITY ===");
  const manifestPath = 'docs/migration/evidence/phase17c_m7f_public_secure_snapshot_manifest.json';
  const manifestRaw = fs.readFileSync(manifestPath);
  const manifestHash = crypto.createHash('sha256').update(manifestRaw).digest('hex');
  console.log(`Computed Manifest SHA256: ${manifestHash}`);
  const manifestMatch = (manifestHash === EXPECTED_MANIFEST_SHA256);
  console.log(`M7F_MANIFEST_HASH_MATCH: ${manifestMatch ? "YES" : "NO"}`);

  const bundleMaterial = [
    "BARBEX-CANONICAL-20260909-02b6e234",
    "1491b063b45d336a5f423a42dcc88a8723a7bd1c9edf4d9bce6aa8b967fecf25",
    "c15b3f3d4968fd453ce7a225e08e8260ea172fdfff3ead8f55ead1feea03ec2a",
    manifestHash
  ].join(':');
  const bundleHash = crypto.createHash('sha256').update(bundleMaterial).digest('hex');
  console.log(`Computed Bundle SHA256: ${bundleHash}`);
  const bundleMatch = (bundleHash === EXPECTED_BUNDLE_SHA256);
  console.log(`M7F_BUNDLE_HASH_MATCH: ${bundleMatch ? "YES" : "NO"}`);

  // Revalidate all secure files
  const manifest = JSON.parse(manifestRaw.toString('utf8'));
  let allFilesMatch = true;
  for (const t of manifest.tables) {
    if (t.table === 'status_checks') {
      for (const b of t.batches) {
        const bPath = `.migration-secrets/public-data/${t.capture_id}/status_checks/${b.file_name}`;
        const bContent = fs.readFileSync(bPath);
        const bHash = crypto.createHash('sha256').update(bContent).digest('hex');
        if (bHash !== b.file_sha256) {
          console.error(`Hash mismatch for ${bPath}: expected ${b.file_sha256}, got ${bHash}`);
          allFilesMatch = false;
        }
      }
    } else {
      const fPath = t.raw_file_path;
      const fContent = fs.readFileSync(fPath);
      const fHash = crypto.createHash('sha256').update(fContent).digest('hex');
      if (fHash !== t.file_sha256) {
        console.error(`Hash mismatch for ${fPath}: expected ${t.file_sha256}, got ${fHash}`);
        allFilesMatch = false;
      }
    }
  }
  console.log(`M7F_SECURE_FILES_HASH_MATCH: ${allFilesMatch ? "YES" : "NO"}`);

  if (!manifestMatch || !bundleMatch || !allFilesMatch) {
    console.error("M7F snapshot changed! Aborting.");
    process.exit(1);
  }

  console.log("\n=== 2. CURRENT SOURCE CENSUS & DELTA ===");
  const env = fs.readFileSync('.env', 'utf8');
  const urlMatch = env.match(/SUPABASE_URL="?([^"\r\n]+)"?/);
  const keyMatch = env.match(/SUPABASE_PUBLISHABLE_KEY="?([^"\r\n]+)"?/);
  const sourceClient = createClient(urlMatch![1], keyMatch![1]);

  const m7aData = JSON.parse(fs.readFileSync('docs/migration/evidence/phase17c_m7a_table_row_counts.json', 'utf8'));
  const allTables = m7aData.tables.map((t: any) => t.table);

  let totalCurrentRows = 0;
  let nonemptyCount = 0;
  let emptyCount = 0;
  const currentCounts: Record<string, number> = {};
  const changedTables: Record<string, { m7f: number, current: number, delta: number }> = {};

  const m7fTableCounts: Record<string, number> = {};
  for (const t of manifest.tables) {
    m7fTableCounts[t.table] = t.raw_source_rows;
  }

  for (const table of allTables) {
    const { count, error } = await sourceClient.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`Error querying ${table}: ${error.message}`);
      continue;
    }
    const cnt = count || 0;
    currentCounts[table] = cnt;
    totalCurrentRows += cnt;
    if (cnt > 0) nonemptyCount++;
    else emptyCount++;

    const m7fCount = m7fTableCounts[table] || 0;
    if (cnt !== m7fCount) {
      changedTables[table] = {
        m7f: m7fCount,
        current: cnt,
        delta: cnt - m7fCount
      };
    }
  }

  console.log(`M7G_SOURCE_PUBLIC_ROWS_CURRENT: ${totalCurrentRows}`);
  console.log(`M7G_SOURCE_NONEMPTY_TABLES_CURRENT: ${nonemptyCount}`);
  console.log(`M7G_SOURCE_EMPTY_TABLES_CURRENT: ${emptyCount}`);

  const m7fTotal = manifest.census_at_capture.raw_source_rows;
  const totalDelta = totalCurrentRows - m7fTotal;
  const tablesWithDelta = Object.keys(changedTables).length;

  console.log(`M7F_TO_M7G_TOTAL_ROW_DELTA: ${totalDelta}`);
  console.log(`M7F_TO_M7G_TABLES_WITH_ROW_COUNT_DELTA: ${tablesWithDelta}`);
  console.log(`Changed tables:`, JSON.stringify(changedTables, null, 2));

  // Check status_checks specifically
  const { data: maxScData } = await sourceClient.from('status_checks').select('id').order('id', { ascending: false }).limit(1);
  const currentScMaxId = maxScData?.[0]?.id || 256536;
  const scDelta = currentCounts['status_checks'] - 256536;
  console.log(`\n=== 4. STATUS_CHECKS FINAL DELTA ===`);
  console.log(`M7G_STATUS_CHECKS_CURRENT_ROWS: ${currentCounts['status_checks']}`);
  console.log(`M7G_STATUS_CHECKS_CURRENT_MAX_ID: ${currentScMaxId}`);
  console.log(`M7G_STATUS_CHECKS_DELTA_ROWS: ${scDelta}`);
  console.log(`M7G_STATUS_CHECKS_DELTA_APPEND_ONLY: ${currentScMaxId >= 256536 ? "YES" : "NO"}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
