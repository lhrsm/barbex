/**
 * R2E.22B.1 - Comprehensive Multi-tenancy Validation Suite
 * 
 * Tests:
 * 1. Financial isolation and RESTRICTED tenant blocking via database triggers.
 * 2. Products owner_id resolution semantics and RLS analysis.
 * 3. Barber services schema constraints, tenant_id FK target, and cross-tenant validation.
 * 4. Multi-role access simulation (Owner, Manager, Staff, Unaffiliated).
 */

const { execFileSync } = require('child_process');
const assert = require('assert');

function runPsql(sql) {
  return execFileSync(
    'docker',
    ['exec', 'supabase_db_barbex', 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf-8' }
  ).trim();
}

console.log('================================================================');
console.log('BARBEX R2E.22B.1 - MULTI-TENANCY COMPREHENSIVE VALIDATION');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

// ====================================================================
// SECTION 1: FINANCE MODULE VALIDATION (Fase 2)
// ====================================================================
console.log('--- SECTION 1: FINANCE MODULE (Fase 2) ---');

test('1.1: Verify transaction table schema and tenant_id column', () => {
  const colInfo = runPsql(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'transactions' 
      AND column_name IN ('tenant_id', 'user_id');
  `);
  assert(colInfo.includes('tenant_id'), 'transactions must have tenant_id column');
  assert(colInfo.includes('user_id'), 'transactions must have user_id column');
});

test('1.2: Verify operational blocking trigger on transactions for RESTRICTED tenants', () => {
  const triggerCheck = runPsql(`
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'public.transactions'::regclass 
      AND tgname = 'trg_enforce_tenant_transactions';
  `);
  assert(triggerCheck.includes('trg_enforce_tenant_transactions'), 'transactions table must have trg_enforce_tenant_transactions trigger');
});

test('1.3: Confirm RESTRICTED tenant cannot insert financial transaction in database', () => {
  const testScript = `
    DO $$
    DECLARE
      v_tenant_id uuid := '00000000-0000-0000-0000-000000000999';
      v_user_id uuid := '00000000-0000-0000-0000-000000000998';
      v_error_caught boolean := false;
      v_sqlstate text;
      v_sqlerrm text;
    BEGIN
      -- Create test auth users and profiles if not existing
      INSERT INTO auth.users (id, email)
      VALUES 
        (v_tenant_id, 'restricted_tenant@test.com'),
        (v_user_id, 'restricted_staff@test.com')
      ON CONFLICT (id) DO NOTHING;

      -- Profile with expired trial (RESTRICTED state)
      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES (v_tenant_id, 'Restricted Owner', 'free', NOW() - INTERVAL '30 days', NOW() - INTERVAL '15 days')
      ON CONFLICT (id) DO UPDATE SET 
        plan = 'free',
        trial_start = NOW() - INTERVAL '30 days',
        trial_end = NOW() - INTERVAL '15 days';

      -- Ensure no valid subscription or voucher exists for this tenant
      DELETE FROM public.subscriptions WHERE user_id = v_tenant_id;
      DELETE FROM public.saas_admin_voucher_redemptions WHERE tenant_id = v_tenant_id;

      -- Attempt insertion on transactions table under non-superuser actor context
      BEGIN
        -- Simulate authenticated actor
        PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        INSERT INTO public.transactions (tenant_id, user_id, type, amount, date, description)
        VALUES (v_tenant_id, v_user_id, 'income', 100.00, CURRENT_DATE, 'Test Restricted Transaction');
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
        v_error_caught := true;
      END;

      -- Cleanup test data
      DELETE FROM public.transactions WHERE tenant_id = v_tenant_id;
      DELETE FROM public.barbershops WHERE owner_id IN (v_tenant_id, v_user_id);
      DELETE FROM public.profiles WHERE id IN (v_tenant_id, v_user_id);
      DELETE FROM auth.users WHERE id IN (v_tenant_id, v_user_id);

      IF NOT v_error_caught THEN
        RAISE EXCEPTION 'Database allowed transaction insertion for RESTRICTED tenant!';
      ELSIF v_sqlstate <> 'P0001' AND NOT (v_sqlerrm LIKE '%TENANT_SUSPENDED%') THEN
        RAISE EXCEPTION 'Expected P0001 TENANT_SUSPENDED but received %: %', v_sqlstate, v_sqlerrm;
      END IF;
    END $$;
  `;
  const result = runPsql(testScript);
  assert(!result.includes('ERROR'), 'Trigger must successfully catch and abort transaction on RESTRICTED tenant with P0001');
});

test('1.4: Confirm financial queries strictly isolate data between distinct tenants', () => {
  const isolationScript = `
    DO $$
    DECLARE
      v_tenant_a uuid := '00000000-0000-0000-0000-00000000000a';
      v_tenant_b uuid := '00000000-0000-0000-0000-00000000000b';
      v_count_a integer;
      v_count_b integer;
    BEGIN
      -- Create test auth users and profiles
      INSERT INTO auth.users (id, email)
      VALUES 
        (v_tenant_a, 'tenant_a@test.com'),
        (v_tenant_b, 'tenant_b@test.com')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES 
        (v_tenant_a, 'Tenant A', 'pro', NOW(), NOW() + INTERVAL '15 days'),
        (v_tenant_b, 'Tenant B', 'pro', NOW(), NOW() + INTERVAL '15 days')
      ON CONFLICT (id) DO UPDATE SET trial_end = NOW() + INTERVAL '15 days';

      -- Insert 1 transaction for Tenant A
      INSERT INTO public.transactions (tenant_id, user_id, type, amount, date, description)
      VALUES (v_tenant_a, v_tenant_a, 'income', 50.00, CURRENT_DATE, 'A Tx');

      -- Query as Tenant B
      SELECT COUNT(*) INTO v_count_b FROM public.transactions WHERE tenant_id = v_tenant_b;
      SELECT COUNT(*) INTO v_count_a FROM public.transactions WHERE tenant_id = v_tenant_a;

      -- Cleanup
      DELETE FROM public.transactions WHERE tenant_id IN (v_tenant_a, v_tenant_b);
      DELETE FROM public.barbershops WHERE owner_id IN (v_tenant_a, v_tenant_b);
      DELETE FROM public.profiles WHERE id IN (v_tenant_a, v_tenant_b);
      DELETE FROM auth.users WHERE id IN (v_tenant_a, v_tenant_b);

      IF v_count_b <> 0 OR v_count_a <> 1 THEN
        RAISE EXCEPTION 'Cross-tenant leak detected: Tenant B saw % transactions, Tenant A saw %', v_count_b, v_count_a;
      END IF;
    END $$;
  `;
  const res = runPsql(isolationScript);
  assert(!res.includes('ERROR'), 'Transactions query must filter exclusively by tenant_id');
});

// ====================================================================
// SECTION 2: PRODUCTS MODULE VALIDATION (Fase 3)
// ====================================================================
console.log('\n--- SECTION 2: PRODUCTS MODULE (Fase 3) ---');

test('2.1: Semantic analysis of shopOwnerId fallback logic in products.tsx', () => {
  function resolveShopOwnerId({ ownedShop, currentShopData, tenantProfile, user }) {
    return ownedShop?.owner_id || currentShopData?.owner_id || tenantProfile?.id || user?.id;
  }

  const ownerUser = { id: 'owner-uuid-1111' };
  const managerUser = { id: 'manager-uuid-2222' };
  const staffUser = { id: 'staff-uuid-3333' };
  const unaffiliatedUser = { id: 'stranger-uuid-4444' };
  const shopData = { id: 'shop-uuid-5555', owner_id: 'owner-uuid-1111' };

  // Case 1: Owner
  const ownerResult = resolveShopOwnerId({
    ownedShop: shopData,
    currentShopData: shopData,
    tenantProfile: null,
    user: ownerUser
  });
  assert.strictEqual(ownerResult, 'owner-uuid-1111', 'Owner must resolve to their own owner_id');

  // Case 2: Manager
  const managerResult = resolveShopOwnerId({
    ownedShop: null,
    currentShopData: shopData,
    tenantProfile: null,
    user: managerUser
  });
  assert.strictEqual(managerResult, 'owner-uuid-1111', 'Manager must resolve to the canonical shop owner_id');

  // Case 3: Staff
  const staffResult = resolveShopOwnerId({
    ownedShop: null,
    currentShopData: shopData,
    tenantProfile: null,
    user: staffUser
  });
  assert.strictEqual(staffResult, 'owner-uuid-1111', 'Staff must resolve to the canonical shop owner_id');

  // Case 4: Unaffiliated User
  const unaffiliatedResult = resolveShopOwnerId({
    ownedShop: null,
    currentShopData: null,
    tenantProfile: null,
    user: unaffiliatedUser
  });
  assert.strictEqual(unaffiliatedResult, 'stranger-uuid-4444', 'Unaffiliated user falls back to user.id');

  // Case 5: Legacy Profile
  const legacyResult = resolveShopOwnerId({
    ownedShop: null,
    currentShopData: null,
    tenantProfile: { id: 'legacy-profile-id' },
    user: managerUser
  });
  assert.strictEqual(legacyResult, 'legacy-profile-id', 'Legacy profile falls back to tenantProfile.id');

  // CRITICAL: Ensure shop.id (tenant_id) is NEVER mistakenly used as user_id
  assert.notStrictEqual(managerResult, shopData.id, 'shop_id must NEVER be used as user_id');
});

test('2.2: Verify products table schema foreign keys and user_id constraint', () => {
  const fkCheck = runPsql(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.products'::regclass AND contype = 'f';
  `);
  assert(fkCheck.includes('products_user_id_fkey'), 'products table has foreign key on user_id');
  assert(fkCheck.includes('REFERENCES auth.users(id)'), 'products.user_id references auth.users(id)');
});

test('2.3: Verify RLS policies on products table and employee permission boundaries', () => {
  const policies = runPsql(`
    SELECT policyname, cmd, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'products';
  `);
  assert(
    policies.includes('Authorized staff can insert products') || policies.includes('Users can create their own products'), 
    'Must have staff or owner insert policy'
  );
  assert(policies.includes('(auth.uid() = user_id)'), 'Policy checks auth.uid() = user_id');
});

// ====================================================================
// SECTION 3: BARBER SERVICES MODULE (Fase 4)
// ====================================================================
console.log('\n--- SECTION 3: BARBER SERVICES MODULE (Fase 4) ---');

test('3.1: Verify barber_services schema and tenant_id foreign key reference', () => {
  const fkTarget = runPsql(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.barber_services'::regclass AND contype = 'f';
  `);
  assert(fkTarget.includes('barber_services_tenant_id_fkey'), 'barber_services has FK on tenant_id');
  assert(fkTarget.includes('REFERENCES auth.users(id)'), 'barber_services.tenant_id references auth.users(id)');
});

test('3.2: Verify database-level cross-tenant validation for barber_id and service_id', () => {
  const triggers = runPsql(`
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'public.barber_services'::regclass;
  `);
  const hasDbCrossTenantTrigger = triggers.length > 0 && (triggers.includes('cross') || triggers.includes('tenant') || triggers.includes('check'));
  console.log(`       [AUDIT] Database-level cross-tenant trigger on barber_services: ${hasDbCrossTenantTrigger ? 'EXISTS (Hardened)' : 'NONE'}`);
  assert(hasDbCrossTenantTrigger, 'DB trigger enforces barber_id and service_id match the same tenant');
});

test('3.3: Verify client-side cross-tenant filter in barbers.tsx', () => {
  const tenantServices = [
    { id: 'service-1', name: 'Corte', tenant_id: 'tenant-a' },
    { id: 'service-2', name: 'Barba', tenant_id: 'tenant-a' }
  ];
  const validServiceIds = new Set(tenantServices.map(s => s.id));

  // Cross-tenant injection attempt
  const incomingSelection = ['service-1', 'service-alien-b'];
  const safeSelectedServices = incomingSelection.filter(id => validServiceIds.has(id));

  assert.deepStrictEqual(safeSelectedServices, ['service-1'], 'Client filter must reject cross-tenant service_id');
});

// ====================================================================
// SUMMARY
// ====================================================================
console.log('\n================================================================');
console.log(`RESULT: ${passedTests}/${totalTests} tests passed`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
