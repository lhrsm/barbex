import * as fs from 'fs';
import * as crypto from 'crypto';

const m7gReviewBundle = "180c748fb0ab7516a1646fafeea07d4cbee73b30435f2f6306afe44f98a07fd7";
const mutableProof = fs.readFileSync('docs/migration/evidence/phase17c_m7g1_mutable_fingerprint_proof.json');
const writeMatrix = fs.readFileSync('docs/migration/evidence/phase17c_m7g1_write_path_freeze_matrix.json');
const webhookSafety = fs.readFileSync('docs/migration/evidence/phase17c_m7g1_webhook_safety.json');
const freezeOrder = fs.readFileSync('docs/migration/evidence/phase17c_m7g1_freeze_order.json');
const verifierSpec = fs.readFileSync('docs/migration/evidence/phase17c_m7g1_freeze_state_verifier_spec.json');
const storageReadiness = fs.readFileSync('docs/migration/evidence/phase17c_m7g1_storage_readiness.json');
const runbook = fs.readFileSync('docs/migration/PHASE17C_M7G_CUTOVER_RUNBOOK.md');

const bundleItems = [
  m7gReviewBundle,
  crypto.createHash('sha256').update(mutableProof).digest('hex'),
  crypto.createHash('sha256').update(writeMatrix).digest('hex'),
  crypto.createHash('sha256').update(webhookSafety).digest('hex'),
  crypto.createHash('sha256').update(freezeOrder).digest('hex'),
  crypto.createHash('sha256').update(verifierSpec).digest('hex'),
  crypto.createHash('sha256').update(storageReadiness).digest('hex'),
  crypto.createHash('sha256').update(runbook).digest('hex')
].join(':');

const executionBundleSha256 = crypto.createHash('sha256').update(bundleItems).digest('hex');
console.log(`M7G1_FREEZE_EXECUTION_BUNDLE_SHA256: ${executionBundleSha256}`);
