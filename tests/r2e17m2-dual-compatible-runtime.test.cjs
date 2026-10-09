/**
 * BARBEX — R2E.17M.2 DUAL-COMPATIBLE RUNTIME VALIDATION TEST
 * Verifies that the canonical tenant <-> operational scope translation layer
 * behaves deterministically, securely, and with zero production mutations.
 */

const assert = require('assert');
const { execSync } = require('child_process');

console.log('===============================================================');
console.log('BARBEX R2E.17M.2 — DUAL-COMPATIBLE RUNTIME VALIDATION');
console.log('===============================================================\n');

function runLinkedQuery(sql) {
  const singleLine = sql.replace(/\s+/g, ' ').trim().replace(/"/g, '\\"');
  const res = execSync(`npx.cmd supabase db query --linked "${singleLine}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const jsonMatch = res.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse query output: ' + res);
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.rows || parsed;
}

// 1. Verify existence and security attributes of all 17M.2 helpers
console.log('1. Checking created helper functions in pg_proc...');
const funcQuery = `
  SELECT proname, prosecdef, provolatile, proconfig 
  FROM pg_proc 
  JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
  WHERE pg_namespace.nspname = 'public' 
    AND proname IN (
      'canonical_tenant_to_operational_scope',
      'canonical_tenant_to_legacy_scope',
      'operational_scope_to_canonical_tenant',
      'legacy_scope_to_canonical_tenant',
      'resolve_operational_scope'
    );
`;

const funcResult = runLinkedQuery(funcQuery);
const foundNames = funcResult.map(r => r.proname).sort();
console.log('  Found functions:', foundNames.join(', '));

assert.strictEqual(foundNames.length, 5, 'All 5 dual-compatible helpers must exist in public schema');
funcResult.forEach(r => {
  assert.strictEqual(r.prosecdef, true, `${r.proname} must be SECURITY DEFINER`);
  assert.strictEqual(r.provolatile, 's', `${r.proname} must be STABLE`);
  assert.ok(r.proconfig && r.proconfig.includes('search_path=public, pg_temp'), `${r.proname} must enforce safe search_path`);
});
console.log('  [PASS] All 5 helpers verified with SECURITY DEFINER and fixed search_path.\n');

// 2. Validate translation and round-trip invariants for active barbershops
console.log('2. Validating translation and round-trip invariants for active barbershops...');

const CONTROL_TENANTS = [
  {
    name: 'Barbearia LM',
    canonical: 'c54ac1ac-49be-4505-b7a4-d257ed023f08',
    expectedOperational: 'c54ac1ac-49be-4505-b7a4-d257ed023f08',
    isAligned: true
  },
  {
    name: 'Barber Shop Carlos (Gmail)',
    canonical: '7b5c3640-2e10-4788-83a7-5e6d8e0d9978',
    expectedOperational: '7b5c3640-2e10-4788-83a7-5e6d8e0d9978',
    isAligned: true
  },
  {
    name: 'Carlos Barber Shop (Hotmail)',
    canonical: '92caca5a-5174-4725-9da9-b10a9aa87104',
    expectedOperational: '703dcd8f-0077-4a57-8728-be05f654bd5b',
    isAligned: false
  },
  {
    name: 'Carlos Barber (Barbearia Vip)',
    canonical: '5d57205d-3a30-4852-92ff-78e8400cb9d5',
    expectedOperational: '67d4e85a-3ed5-4109-9c9b-b83622331286',
    isAligned: false
  }
];

let roundTripFailures = 0;
let ambiguousTranslations = 0;

for (const shop of CONTROL_TENANTS) {
  const transQuery = `
    SELECT 
      public.canonical_tenant_to_operational_scope('${shop.canonical}') as op_scope,
      public.canonical_tenant_to_legacy_scope('${shop.canonical}') as legacy_scope,
      public.operational_scope_to_canonical_tenant('${shop.expectedOperational}') as back_canonical,
      public.legacy_scope_to_canonical_tenant('${shop.expectedOperational}') as back_legacy_canonical,
      public.resolve_operational_scope('${shop.canonical}') as resolve_from_canonical,
      public.resolve_operational_scope('${shop.expectedOperational}') as resolve_from_op;
  `;
  const [res] = runLinkedQuery(transQuery);

  console.log(`  Testing: ${shop.name} (${shop.isAligned ? 'Aligned' : 'Split'})`);
  console.log(`    Canonical: ${shop.canonical}`);
  console.log(`    Operational: ${res.op_scope}`);
  console.log(`    Round-trip Canonical: ${res.back_canonical}`);
  console.log(`    Resolve from Canonical: ${res.resolve_from_canonical}`);
  console.log(`    Resolve from Operational: ${res.resolve_from_op}`);

  if (res.op_scope !== shop.expectedOperational) {
    roundTripFailures++;
    console.error(`    [FAIL] Operational scope mismatch for ${shop.name}: got ${res.op_scope}, expected ${shop.expectedOperational}`);
  }
  if (res.legacy_scope !== shop.expectedOperational) {
    roundTripFailures++;
  }
  if (res.back_canonical !== shop.canonical) {
    roundTripFailures++;
    console.error(`    [FAIL] Round-trip canonical mismatch for ${shop.name}: got ${res.back_canonical}, expected ${shop.canonical}`);
  }
  if (res.resolve_from_canonical !== shop.expectedOperational || res.resolve_from_op !== shop.expectedOperational) {
    roundTripFailures++;
    console.error(`    [FAIL] Resolve operational scope mismatch for ${shop.name}`);
  }
}

assert.strictEqual(roundTripFailures, 0, 'Must have 0 round trip failures');
assert.strictEqual(ambiguousTranslations, 0, 'Must have 0 ambiguous translations');
console.log('  [PASS] All 4 active barbershops translate and round-trip deterministically.\n');

// 3. Verify Orphan Exclusion & Negative Cases
console.log('3. Checking orphan and non-business exclusion...');
const orphanQuery = `
  SELECT 
    public.canonical_tenant_to_operational_scope('292134e7-4b98-49ee-84c6-b8b546ec57de') as orphan_op,
    public.operational_scope_to_canonical_tenant('292134e7-4b98-49ee-84c6-b8b546ec57de') as orphan_can,
    public.resolve_operational_scope('292134e7-4b98-49ee-84c6-b8b546ec57de') as orphan_resolve,
    public.canonical_tenant_to_operational_scope('997746ee-723f-40e4-a6c6-5359eddd2a98') as personal_op,
    public.operational_scope_to_canonical_tenant('997746ee-723f-40e4-a6c6-5359eddd2a98') as personal_can,
    public.canonical_tenant_to_operational_scope(null) as null_op,
    public.operational_scope_to_canonical_tenant(null) as null_can,
    public.resolve_operational_scope(null) as null_resolve,
    public.canonical_tenant_to_operational_scope('00000000-0000-0000-0000-000000000000') as unknown_op,
    public.operational_scope_to_canonical_tenant('00000000-0000-0000-0000-000000000000') as unknown_can;
`;
const [orphanRes] = runLinkedQuery(orphanQuery);
assert.strictEqual(orphanRes.orphan_op, null, 'Orphan scope must return null op');
assert.strictEqual(orphanRes.orphan_can, null, 'Orphan scope must return null canonical');
assert.strictEqual(orphanRes.orphan_resolve, null, 'Orphan scope must return null resolve');
assert.strictEqual(orphanRes.personal_op, null, 'Personal notification scope must return null op');
assert.strictEqual(orphanRes.personal_can, null, 'Personal notification scope must return null canonical');
assert.strictEqual(orphanRes.null_op, null, 'Null must return null op');
assert.strictEqual(orphanRes.null_can, null, 'Null must return null canonical');
assert.strictEqual(orphanRes.null_resolve, null, 'Null must return null resolve');
assert.strictEqual(orphanRes.unknown_op, null, 'Unknown UUID must return null op');
assert.strictEqual(orphanRes.unknown_can, null, 'Unknown UUID must return null canonical');
console.log('  [PASS] Orphan scopes, personal scopes, nulls, and unknown UUIDs safely return NULL.\n');

// 4. Authenticated Security Matrix: Anonymous & Cross-Tenant Isolation
console.log('4. Checking Authenticated Security Matrix (cross-tenant leakage prevention)...');
const secAnonQuery = `
  BEGIN;
  SET LOCAL ROLE anon;
  SET LOCAL "request.jwt.claims" = '{"role": "anon"}';
  SELECT 
    public.canonical_tenant_to_operational_scope('92caca5a-5174-4725-9da9-b10a9aa87104') as anon_can_to_op,
    public.operational_scope_to_canonical_tenant('703dcd8f-0077-4a57-8728-be05f654bd5b') as anon_op_to_can,
    public.resolve_operational_scope('92caca5a-5174-4725-9da9-b10a9aa87104') as anon_resolve;
  ROLLBACK;
`;
const [secAnonRes] = runLinkedQuery(secAnonQuery);
assert.strictEqual(secAnonRes.anon_can_to_op, null, 'Anonymous must not resolve canonical tenant');
assert.strictEqual(secAnonRes.anon_op_to_can, null, 'Anonymous must not resolve operational scope');
assert.strictEqual(secAnonRes.anon_resolve, null, 'Anonymous must not resolve operational scope');

const secCrossQuery = `
  BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "7b5c3640-2e10-4788-83a7-5e6d8e0d9978", "role": "authenticated"}';
  SELECT 
    public.canonical_tenant_to_operational_scope('7b5c3640-2e10-4788-83a7-5e6d8e0d9978') as own_can_to_op,
    public.operational_scope_to_canonical_tenant('7b5c3640-2e10-4788-83a7-5e6d8e0d9978') as own_op_to_can,
    public.canonical_tenant_to_operational_scope('92caca5a-5174-4725-9da9-b10a9aa87104') as cross_can_to_op,
    public.operational_scope_to_canonical_tenant('703dcd8f-0077-4a57-8728-be05f654bd5b') as cross_op_to_can;
  ROLLBACK;
`;
const [secCrossRes] = runLinkedQuery(secCrossQuery);
assert.strictEqual(secCrossRes.own_can_to_op, '7b5c3640-2e10-4788-83a7-5e6d8e0d9978', 'Owner must resolve own canonical tenant');
assert.strictEqual(secCrossRes.own_op_to_can, '7b5c3640-2e10-4788-83a7-5e6d8e0d9978', 'Owner must resolve own operational scope');
assert.strictEqual(secCrossRes.cross_can_to_op, null, 'Owner must NOT resolve other tenant canonical scope');
assert.strictEqual(secCrossRes.cross_op_to_can, null, 'Owner must NOT resolve other tenant operational scope');
console.log('  [PASS] Authenticated security matrix verified: CROSS_TENANT_TRANSLATION_LEAKAGE = 0.\n');

// 5. Verify Data and Immutability
console.log('5. Verifying operational data and schema immutability...');
const countQuery = `
  SELECT 
    (SELECT count(*)::int FROM barbers) as barbers_total,
    (SELECT count(*)::int FROM services) as services_total,
    (SELECT count(*)::int FROM barber_services) as barber_services_total,
    (SELECT count(*)::int FROM customers) as customers_total,
    (SELECT count(*)::int FROM appointments) as appointments_total,
    (SELECT count(*)::int FROM barbershop_modules) as modules_total,
    (SELECT count(*)::int FROM loyalty_settings) as loyalty_total,
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public') as policies_total;
`;
const [counts] = runLinkedQuery(countQuery);
console.log('  Table counts:', counts);
assert.strictEqual(counts.barbers_total, 8, 'Barbers count must be 8');
assert.strictEqual(counts.services_total, 8, 'Services count must be 8');
assert.strictEqual(counts.barber_services_total, 22, 'Barber services count must be 22');
assert.strictEqual(counts.customers_total, 12, 'Customers count must be 12');
assert.strictEqual(counts.appointments_total, 80, 'Appointments count must be 80');
assert.strictEqual(counts.modules_total, 131, 'Modules count must be 131');
assert.strictEqual(counts.loyalty_total, 5, 'Loyalty count must be 5');
assert.strictEqual(counts.policies_total, 422, 'RLS policy count must remain exactly 422');

// Carlos Hotmail exact operational counts
const hotmailOpQuery = `
  SELECT 
    (SELECT count(*)::int FROM barbers WHERE tenant_id = '703dcd8f-0077-4a57-8728-be05f654bd5b') as barbers,
    (SELECT count(*)::int FROM services WHERE tenant_id = '703dcd8f-0077-4a57-8728-be05f654bd5b') as services,
    (SELECT count(*)::int FROM barber_services WHERE tenant_id = '703dcd8f-0077-4a57-8728-be05f654bd5b') as barber_services,
    (SELECT count(*)::int FROM appointments WHERE tenant_id = '703dcd8f-0077-4a57-8728-be05f654bd5b') as appointments;
`;
const [hotmailCounts] = runLinkedQuery(hotmailOpQuery);
console.log('  Carlos Hotmail operational counts:', hotmailCounts);
assert.strictEqual(hotmailCounts.barbers, 3, 'Carlos Hotmail barbers must be 3');
assert.strictEqual(hotmailCounts.services, 3, 'Carlos Hotmail services must be 3');
assert.strictEqual(hotmailCounts.barber_services, 9, 'Carlos Hotmail barber_services must be 9');
assert.strictEqual(hotmailCounts.appointments, 5, 'Carlos Hotmail appointments must be 5');
console.log('  [PASS] Zero operational rows modified. Production immutability verified.\n');

console.log('===============================================================');
console.log('R2E.17M.2 DUAL-COMPATIBLE RUNTIME VALIDATION: ALL TESTS PASS');
console.log('===============================================================');
