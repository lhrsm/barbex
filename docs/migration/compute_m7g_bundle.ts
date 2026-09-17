import * as fs from 'fs';
import * as crypto from 'crypto';

const manifest = JSON.parse(fs.readFileSync('docs/migration/evidence/phase17c_m7f_public_secure_snapshot_manifest.json', 'utf8'));
const checklist = JSON.parse(fs.readFileSync('docs/migration/evidence/phase17c_m7g_cutover_checklist.json', 'utf8'));
const runbook = fs.readFileSync('docs/migration/PHASE17C_M7G_CUTOVER_RUNBOOK.md', 'utf8');

const bundleItems = [
  "BARBEX-CANONICAL-20260909-02b6e234",
  "1491b063b45d336a5f423a42dcc88a8723a7bd1c9edf4d9bce6aa8b967fecf25",
  "e7f20b696f60bc97d2d714c541a261273fff18b8a967d61bcb8ae95f02c36bee",
  "e8776cdf7769a646bc863f3770d792a739b78f33f66b9a815463648c2e9023e5",
  crypto.createHash('sha256').update(runbook).digest('hex'),
  crypto.createHash('sha256').update(JSON.stringify(checklist)).digest('hex')
].join(':');

const cutoverBundleSha256 = crypto.createHash('sha256').update(bundleItems).digest('hex');
console.log(`M7G_CUTOVER_REVIEW_BUNDLE_SHA256: ${cutoverBundleSha256}`);
