/**
 * BARBEX — R2E.17M.1 COMPATIBILITY FOUNDATION VALIDATION TEST
 * Verifies that the canonical tenant helpers exist and behave securely in production.
 * Zero mutations, zero side-effects.
 */

const assert = require('assert');
const { execSync } = require('child_process');

console.log('===============================================================');
console.log('BARBEX R2E.17M.1 — COMPATIBILITY FOUNDATION PRODUCTION VALIDATION');
console.log('===============================================================\n');

function runLinkedQuery(sql) {
  const singleLine = sql.replace(/\s+/g, ' ').trim().replace(/"/g, '\\"');
  const res = execSync(`npx.cmd supabase db query --linked "${singleLine}"`, { encoding: 'utf8' });
  const jsonMatch = res.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse query output: ' + res);
  return JSON.parse(jsonMatch[0]);
}

// 1. Verify existence and security attributes of all 5 canonical helpers
console.log('1. Checking created helper functions in pg_proc...');
const funcQuery = `
  SELECT proname, prosecdef, provolatile, proconfig 
  FROM pg_proc 
  JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
  WHERE pg_namespace.nspname = 'public' 
    AND proname IN (
      'is_tenant_owner',
      'is_active_tenant_member',
      'has_tenant_role',
      'can_access_tenant',
      'get_my_canonical_tenant_id'
    );
`;
const funcResult = runLinkedQuery(funcQuery);
const foundNames = funcResult.rows.map(r => r.proname).sort();
console.log('  Found functions:', foundNames.join(', '));

assert.strictEqual(foundNames.length, 5, 'All 5 canonical helpers must exist in public schema');
funcResult.rows.forEach(r => {
  assert.strictEqual(r.prosecdef, true, `${r.proname} must be SECURITY DEFINER`);
  assert.strictEqual(r.provolatile, 's', `${r.proname} must be STABLE`);
  assert.ok(r.proconfig && r.proconfig.includes('search_path=public, pg_temp'), `${r.proname} must enforce safe search_path`);
});
console.log('  [PASS] All 5 helpers verified with SECURITY DEFINER and fixed search_path.\n');

// 2. Verify legacy get_my_tenant_id remains untouched
console.log('2. Checking legacy get_my_tenant_id preservation...');
const legacyQuery = `
  SELECT proname, prosecdef, provolatile, prosrc
  FROM pg_proc 
  JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
  WHERE pg_namespace.nspname = 'public' 
    AND proname = 'get_my_tenant_id';
`;
const legacyResult = runLinkedQuery(legacyQuery);
assert.strictEqual(legacyResult.rows.length, 1, 'Legacy get_my_tenant_id must remain in place');
assert.ok(legacyResult.rows[0].prosrc.includes('SELECT tenant_id'), 'Legacy get_my_tenant_id body must be unchanged');
console.log('  [PASS] Legacy get_my_tenant_id preserved untouched for V1 runtime.\n');

// 3. Security test: anonymous invocation
console.log('3. Checking anonymous invocation security...');
const anonQuery = `
  SELECT 
    public.is_tenant_owner('92caca5a-5174-4725-9da9-b10a9aa87104') as is_owner_anon,
    public.can_access_tenant('92caca5a-5174-4725-9da9-b10a9aa87104') as can_access_anon,
    public.can_access_tenant(null) as can_access_null,
    public.get_my_canonical_tenant_id() as my_canonical_tenant_anon;
`;
const anonResult = runLinkedQuery(anonQuery);
const row = anonResult.rows[0];
assert.strictEqual(row.is_owner_anon, false, 'Anonymous must not be owner');
assert.strictEqual(row.can_access_anon, false, 'Anonymous must not have tenant access');
assert.strictEqual(row.can_access_null, false, 'NULL tenant access must be false');
assert.strictEqual(row.my_canonical_tenant_anon, null, 'Anonymous canonical tenant must be null');
console.log('  [PASS] Anonymous security assertions passed.\n');

console.log('===============================================================');
console.log('R2E.17M.1 FOUNDATION VALIDATION RESULT: ALL TESTS PASS');
console.log('===============================================================');
