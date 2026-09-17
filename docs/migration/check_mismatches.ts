import * as fs from 'fs';
const manifest = JSON.parse(fs.readFileSync('docs/migration/evidence/phase17c_m7f_public_secure_snapshot_manifest.json', 'utf8'));

manifest.tables.forEach((t: any) => {
  if (t.raw_source_rows !== t.parsed_secure_rows) {
    console.log(`Mismatch in ${t.table}: raw=${t.raw_source_rows}, parsed=${t.parsed_secure_rows}`);
  }
});
