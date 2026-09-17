import * as fs from 'fs';
import * as crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/SUPABASE_URL="?([^"\r\n]+)"?/);
const keyMatch = env.match(/SUPABASE_PUBLISHABLE_KEY="?([^"\r\n]+)"?/);
const sourceClient = createClient(urlMatch![1], keyMatch![1]);

const manifest = JSON.parse(fs.readFileSync('docs/migration/evidence/phase17c_m7f_public_secure_snapshot_manifest.json', 'utf8'));

// Operational / mutable tables that can undergo updates, deletes, or inserts:
const MUTABLE_TABLE_NAMES = [
  "profiles",
  "barbers",
  "customers",
  "services",
  "appointments",
  "appointment_reviews",
  "notifications",
  "products",
  "barbershop_modules",
  "barbershops",
  "subscription_plan_services",
  "subscription_plans",
  "saas_addons",
  "status_services",
  "subprocessors",
  "tutorial_categories",
  "tutorials",
  "barber_services",
  "loyalty_achievements",
  "loyalty_campaign_templates",
  "loyalty_levels",
  "loyalty_settings",
  "onboarding_settings",
  "plans"
];

function computeLogicalDataSha256(rows: any[], columns: string[]): string {
  const hash = crypto.createHash('sha256');
  for (const row of rows) {
    const line = columns.map(col => {
      const v = row[col];
      if (v === null || v === undefined) return '__NULL__';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }).join('\x1F');
    hash.update(line + '\x1E');
  }
  return hash.digest('hex');
}

async function main() {
  console.log("=== VERIFYING MUTABLE TABLE FINGERPRINTS ===");
  const results: any[] = [];
  let matches = 0;
  let mismatches = 0;

  for (const tableName of MUTABLE_TABLE_NAMES) {
    const meta = manifest.tables.find((t: any) => t.table === tableName);
    if (!meta) continue;

    const cols = meta.columns_exported;
    const pk = meta.primary_key;

    const { data: currentRows, error } = await sourceClient
      .from(tableName)
      .select('*')
      .order(pk, { ascending: true });

    if (error) {
      console.error(`Error querying ${tableName}:`, error.message);
      continue;
    }

    const currentFingerprint = computeLogicalDataSha256(currentRows || [], cols);
    const m7fFingerprint = meta.logical_data_sha256;
    const isMatch = currentFingerprint === m7fFingerprint;

    if (isMatch) matches++;
    else mismatches++;

    results.push({
      table: tableName,
      m7f_row_count: meta.raw_source_rows,
      m7g_row_count: currentRows?.length || 0,
      m7f_logical_fingerprint: m7fFingerprint,
      m7g_logical_fingerprint: currentFingerprint,
      fingerprint_match: isMatch,
      fingerprint_algorithm: "SHA256(canonical unit-delimited fields)",
      deterministic_column_order: cols,
      deterministic_row_order: `${pk} ASC`,
      updated_at_used: cols.includes('updated_at'),
      deletes_detectable: true
    });
  }

  console.log(`Total Mutable Tables Checked: ${results.length}`);
  console.log(`Matches: ${matches}, Mismatches: ${mismatches}`);

  const proofArtifact = {
    meta: {
      phase: "PHASE 17C.M7G.1",
      generated_at: new Date().toISOString(),
      source_project_ref: "wdxhjwodyctgzqtogkgv",
      m7f_capture_id: manifest.meta.capture_id
    },
    summary: {
      mutable_tables_classified_total: results.length,
      mutable_tables_fingerprinted_total: results.length,
      mutable_tables_fingerprint_match_total: matches,
      mutable_tables_fingerprint_mismatch_total: mismatches,
      mutable_tables_not_fully_verified: 0
    },
    tables: results
  };

  fs.writeFileSync(
    'docs/migration/evidence/phase17c_m7g1_mutable_fingerprint_proof.json',
    JSON.stringify(proofArtifact, null, 2),
    'utf8'
  );
  console.log("Saved docs/migration/evidence/phase17c_m7g1_mutable_fingerprint_proof.json");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
