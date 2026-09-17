import * as fs from 'fs';
import * as crypto from 'crypto';
import { parseCsvRows } from './csv_parser_helper';

const manifestPath = 'docs/migration/evidence/phase17c_m7f_public_secure_snapshot_manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let totalRaw = 0;
let totalParsed = 0;

for (const t of manifest.tables) {
  if (t.table === 'status_checks') {
    let sParsed = 0;
    for (const b of t.batches) {
      const bPath = `.migration-secrets/public-data/${t.capture_id}/status_checks/${b.file_name}`;
      const bCsv = fs.readFileSync(bPath, 'utf8');
      const bCnt = parseCsvRows(bCsv);
      b.parsed_count = bCnt;
      sParsed += bCnt;
    }
    t.parsed_secure_rows = sParsed;
    totalRaw += t.raw_source_rows;
    totalParsed += sParsed;
  } else {
    const fPath = t.raw_file_path;
    const csv = fs.readFileSync(fPath, 'utf8');
    const cnt = parseCsvRows(csv);
    t.parsed_secure_rows = cnt;
    totalRaw += t.raw_source_rows;
    totalParsed += cnt;
  }
}

console.log(`Total Raw: ${totalRaw}, Total Parsed: ${totalParsed}`);
console.log(`Match: ${totalRaw === totalParsed}`);

manifest.census_at_capture.raw_source_rows = totalRaw;
manifest.census_at_capture.parsed_secure_rows = totalParsed;
manifest.census_at_capture.raw_parsed_match = (totalRaw === totalParsed);

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

const manifestSha256 = crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
console.log(`M7F_PUBLIC_SECURE_SNAPSHOT_MANIFEST_SHA256: ${manifestSha256}`);

const bundleMaterial = [
  "BARBEX-CANONICAL-20260909-02b6e234",
  "1491b063b45d336a5f423a42dcc88a8723a7bd1c9edf4d9bce6aa8b967fecf25",
  "c15b3f3d4968fd453ce7a225e08e8260ea172fdfff3ead8f55ead1feea03ec2a",
  manifestSha256
].join(':');
const bundleSha256 = crypto.createHash('sha256').update(bundleMaterial).digest('hex');
console.log(`M7F_PUBLIC_SNAPSHOT_BUNDLE_SHA256: ${bundleSha256}`);
