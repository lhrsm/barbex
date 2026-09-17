import * as fs from 'fs';

const manifest = JSON.parse(fs.readFileSync('docs/migration/evidence/phase17c_m7e_public_snapshot_manifest.json', 'utf8'));
const m7cImportManifest = JSON.parse(fs.readFileSync('docs/migration/evidence/phase17c_m7c_table_import_manifest.json', 'utf8'));

// Non-empty tables: exactly 25
const currentCounts = manifest.table_counts;
const nonemptyTableNames = Object.keys(currentCounts).filter(t => currentCounts[t] > 0);

console.log(`Nonempty tables found: ${nonemptyTableNames.length}`);

// Map import plan for each nonempty table
const importPlanTables = m7cImportManifest.tables.map((t: any) => {
  const currentSourceRows = currentCounts[t.table] || 0;
  let excluded = 0;
  let transformed = 0;
  if (t.table === 'barber_services') excluded = 4;
  if (t.table === 'appointments') transformed = 5;

  const expectedImport = currentSourceRows - excluded;

  let batchStrategy = t.batch_strategy;
  let batchDetails = null;
  if (t.table === 'status_checks') {
    batchStrategy = 'KEYSET_PAGINATION';
    batchDetails = {
      batch_size: 25000,
      batch_count: Math.ceil(currentSourceRows / 25000),
      keyset_column: 'id',
      min_id: 1,
      max_id: currentSourceRows
    };
  }

  return {
    table: t.table,
    schema: 'public',
    dependency_level: t.level,
    source_rows: currentSourceRows,
    transformed_rows: transformed,
    excluded_rows: excluded,
    expected_imported_rows: expectedImport,
    primary_key: t.primary_key,
    sequence_reseed_required: t.sequence_backed || t.table === 'status_checks',
    sequence_name: t.table === 'status_checks' ? 'status_checks_id_seq' : (t.sequence_backed ? `${t.table}_id_seq` : null),
    expected_sequence_next: t.table === 'status_checks' ? currentSourceRows + 1 : null,
    generated_columns_excluded: t.generated_columns_omitted || [],
    trigger_strategy: ['profiles', 'barbers', 'customers', 'appointments', 'services', 'notifications'].includes(t.table)
      ? 'CONTROLLED_SUPPRESSION_AND_RESTORE'
      : 'NONE',
    batch_strategy: batchStrategy,
    batch_details: batchDetails,
    columns_to_insert: t.columns_to_insert
  };
});

// Sort by dependency_level
importPlanTables.sort((a: any, b: any) => a.dependency_level - b.dependency_level);

const publicImportPlan = {
  meta: {
    phase: "PHASE 17C.M7E",
    release_id: "BARBEX-CANONICAL-20260909-02b6e234",
    title: "Final 25-Table Public Data Import Plan",
    source_project_ref: "wdxhjwodyctgzqtogkgv",
    target_project_ref: "ywdwrstxvsdqiryhieiz",
    generated_at: new Date().toISOString(),
    total_source_rows: manifest.census.source_public_total_rows_current,
    total_excluded_rows: manifest.import_row_counts.rows_to_exclude,
    total_transformed_rows: manifest.import_row_counts.rows_to_transform,
    total_expected_target_rows: manifest.import_row_counts.expected_target_public_rows_after_import,
    nonempty_tables_count: importPlanTables.length
  },
  tables: importPlanTables
};

fs.writeFileSync(
  'docs/migration/evidence/phase17c_m7e_public_import_plan.json',
  JSON.stringify(publicImportPlan, null, 2),
  'utf8'
);

console.log('Saved docs/migration/evidence/phase17c_m7e_public_import_plan.json');
