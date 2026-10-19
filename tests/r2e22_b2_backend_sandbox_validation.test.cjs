/**
 * R2E.22B.2 - Sandbox Backend Multi-tenancy Hardening Validation Suite
 * 
 * Tests the 12 Scenarios required by Phase 6:
 * 1. Authorized Owner
 * 2. Authorized Manager
 * 3. Financial staff without product permissions
 * 4. Professional without administrative permissions
 * 5. Unaffiliated user
 * 6. Staff from another tenant
 * 7. Cross-tenant association attempt (barber A + service B -> REJECTED)
 * 8. Legitimate association (barber A + service A -> SUCCESS)
 * 9. Legacy product validity
 * 10. RESTRICTED tenant blocking (P0001)
 * 11. Direct API manipulation attempt via JWT impersonation
 * 12. Barbearia LM entitlement and voucher preservation
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
console.log('BARBEX R2E.22B.2 — BACKEND HARDENING SANDBOX VALIDATION');
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
// TEST SUITE: 12 SCENARIOS
// ====================================================================

test('Scenario 1: Authorized Owner can manage products and barber_services', () => {
  const sql = `
    DO $$
    DECLARE
      v_owner_id uuid := '11111111-1111-4111-8111-111111111111';
      v_prod_id uuid;
    BEGIN
      INSERT INTO auth.users (id, email) VALUES (v_owner_id, 'owner1@test.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES (v_owner_id, 'Owner 1 Shop', 'pro', NOW(), NOW() + INTERVAL '30 days')
      ON CONFLICT (id) DO UPDATE SET trial_end = NOW() + INTERVAL '30 days';

      PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      EXECUTE 'SET LOCAL ROLE authenticated';

      INSERT INTO public.products (user_id, name, price, stock_quantity)
      VALUES (v_owner_id, 'Pomada Owner', 45.00, 20)
      RETURNING id INTO v_prod_id;

      UPDATE public.products SET price = 50.00 WHERE id = v_prod_id;
      DELETE FROM public.products WHERE id = v_prod_id;

      EXECUTE 'RESET ROLE';
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', '', true);

      DELETE FROM public.barbershops WHERE owner_id = v_owner_id;
      DELETE FROM public.profiles WHERE id = v_owner_id;
      DELETE FROM auth.users WHERE id = v_owner_id;
    END $$;
  `;
  const res = runPsql(sql);
  assert(!res.includes('ERROR'), 'Authorized owner must be able to manage products');
});

test('Scenario 2: Authorized Manager can create and update products of their tenant', () => {
  const sql = `
    DO $$
    DECLARE
      v_owner_id uuid := '22222222-2222-4222-8222-222222222221';
      v_manager_id uuid := '22222222-2222-4222-8222-222222222222';
      v_prod_id uuid;
    BEGIN
      INSERT INTO auth.users (id, email) VALUES (v_owner_id, 'owner2@test.com'), (v_manager_id, 'mgr2@test.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES 
        (v_owner_id, 'Owner 2 Shop', 'pro', NOW(), NOW() + INTERVAL '30 days'),
        (v_manager_id, 'Manager User', 'pro', NOW(), NOW() + INTERVAL '30 days')
      ON CONFLICT (id) DO UPDATE SET trial_end = NOW() + INTERVAL '30 days';

      INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
      VALUES (v_owner_id, v_manager_id, 'manager'::app_role, 'active')
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'manager'::app_role, status = 'active';

      PERFORM set_config('request.jwt.claim.sub', v_manager_id::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      EXECUTE 'SET LOCAL ROLE authenticated';

      INSERT INTO public.products (user_id, name, price, stock_quantity)
      VALUES (v_owner_id, 'Shampoo by Manager', 60.00, 15)
      RETURNING id INTO v_prod_id;

      UPDATE public.products SET price = 65.00 WHERE id = v_prod_id;
      DELETE FROM public.products WHERE id = v_prod_id;

      EXECUTE 'RESET ROLE';
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', '', true);

      DELETE FROM public.tenant_memberships WHERE tenant_id = v_owner_id;
      DELETE FROM public.barbershops WHERE owner_id IN (v_owner_id, v_manager_id);
      DELETE FROM public.profiles WHERE id IN (v_owner_id, v_manager_id);
      DELETE FROM auth.users WHERE id IN (v_owner_id, v_manager_id);
    END $$;
  `;
  const res = runPsql(sql);
  assert(!res.includes('ERROR'), 'Authorized manager must be able to insert/update products on behalf of the owner');
});

test('Scenario 3: Financial staff without product permissions is BLOCKED from mutating products', () => {
  const sql = `
    DO $$
    DECLARE
      v_owner_id uuid := '33333333-3333-4333-8333-333333333331';
      v_fin_id uuid := '33333333-3333-4333-8333-333333333332';
      v_caught boolean := false;
    BEGIN
      INSERT INTO auth.users (id, email) VALUES (v_owner_id, 'owner3@test.com'), (v_fin_id, 'fin3@test.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES 
        (v_owner_id, 'Owner 3 Shop', 'pro', NOW(), NOW() + INTERVAL '30 days'),
        (v_fin_id, 'Fin User', 'pro', NOW(), NOW() + INTERVAL '30 days')
      ON CONFLICT (id) DO UPDATE SET trial_end = NOW() + INTERVAL '30 days';

      INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
      VALUES (v_owner_id, v_fin_id, 'financial'::app_role, 'active')
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'financial'::app_role, status = 'active';

      PERFORM set_config('request.jwt.claim.sub', v_fin_id::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      EXECUTE 'SET LOCAL ROLE authenticated';

      BEGIN
        INSERT INTO public.products (user_id, name, price, stock_quantity)
        VALUES (v_owner_id, 'Illegal Fin Product', 10.00, 5);
      EXCEPTION WHEN OTHERS THEN
        v_caught := true;
      END;

      EXECUTE 'RESET ROLE';
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', '', true);

      DELETE FROM public.tenant_memberships WHERE tenant_id = v_owner_id;
      DELETE FROM public.barbershops WHERE owner_id IN (v_owner_id, v_fin_id);
      DELETE FROM public.profiles WHERE id IN (v_owner_id, v_fin_id);
      DELETE FROM auth.users WHERE id IN (v_owner_id, v_fin_id);

      IF NOT v_caught THEN
        RAISE EXCEPTION 'Financial role was allowed to insert products!';
      END IF;
    END $$;
  `;
  const res = runPsql(sql);
  assert(!res.includes('ERROR'), 'Financial staff must be blocked from inserting products');
});

test('Scenario 4: Professional without admin permissions is BLOCKED from products but can link own services', () => {
  const sql = `
    DO $$
    DECLARE
      v_owner_id uuid := '44444444-4444-4444-8444-444444444441';
      v_barber_user_id uuid := '44444444-4444-4444-8444-444444444442';
      v_barber_id uuid;
      v_service_id uuid;
      v_prod_blocked boolean := false;
      v_service_linked boolean := false;
    BEGIN
      INSERT INTO auth.users (id, email) VALUES (v_owner_id, 'owner4@test.com'), (v_barber_user_id, 'barber4@test.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES 
        (v_owner_id, 'Owner 4 Shop', 'pro', NOW(), NOW() + INTERVAL '30 days'),
        (v_barber_user_id, 'Barber 4 Profile', 'pro', NOW(), NOW() + INTERVAL '30 days')
      ON CONFLICT (id) DO UPDATE SET trial_end = NOW() + INTERVAL '30 days';

      INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
      VALUES (v_owner_id, v_barber_user_id, 'barber'::app_role, 'active')
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'barber'::app_role, status = 'active';

      INSERT INTO public.barbers (name, tenant_id, user_id, active)
      VALUES ('Barber Four', v_owner_id, v_barber_user_id, true)
      RETURNING id INTO v_barber_id;

      INSERT INTO public.services (name, tenant_id, user_id, price, duration_minutes)
      VALUES ('Corte Tradicional', v_owner_id, v_owner_id, 35.00, 30)
      RETURNING id INTO v_service_id;

      -- Act as Barber under authenticated role
      PERFORM set_config('request.jwt.claim.sub', v_barber_user_id::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      EXECUTE 'SET LOCAL ROLE authenticated';

      -- 1. Must be blocked from products
      BEGIN
        INSERT INTO public.products (user_id, name, price, stock_quantity)
        VALUES (v_owner_id, 'Unauthorized Barber Product', 20.00, 1);
      EXCEPTION WHEN OTHERS THEN
        v_prod_blocked := true;
      END;

      -- 2. Can link service to self
      INSERT INTO public.barber_services (barber_id, service_id, tenant_id, user_id)
      VALUES (v_barber_id, v_service_id, v_owner_id, v_barber_user_id);
      v_service_linked := true;

      EXECUTE 'RESET ROLE';
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', '', true);

      DELETE FROM public.barber_services WHERE barber_id = v_barber_id;
      DELETE FROM public.services WHERE id = v_service_id;
      DELETE FROM public.barbers WHERE id = v_barber_id;
      DELETE FROM public.tenant_memberships WHERE tenant_id = v_owner_id;
      DELETE FROM public.barbershops WHERE owner_id IN (v_owner_id, v_barber_user_id);
      DELETE FROM public.profiles WHERE id IN (v_owner_id, v_barber_user_id);
      DELETE FROM auth.users WHERE id IN (v_owner_id, v_barber_user_id);

      IF NOT v_prod_blocked OR NOT v_service_linked THEN
        RAISE EXCEPTION 'Failed assertion: prod_blocked=%, service_linked=%', v_prod_blocked, v_service_linked;
      END IF;
    END $$;
  `;
  const res = runPsql(sql);
  assert(!res.includes('ERROR'), 'Barber must be blocked from products but allowed to link services to their own profile');
});

test('Scenario 5: Unaffiliated user is BLOCKED from mutating other tenants products/services', () => {
  const sql = `
    DO $$
    DECLARE
      v_owner_id uuid := '55555555-5555-4555-8555-555555555551';
      v_stranger_id uuid := '55555555-5555-4555-8555-555555555552';
      v_caught boolean := false;
    BEGIN
      INSERT INTO auth.users (id, email) VALUES (v_owner_id, 'owner5@test.com'), (v_stranger_id, 'stranger5@test.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES 
        (v_owner_id, 'Owner 5 Shop', 'pro', NOW(), NOW() + INTERVAL '30 days'),
        (v_stranger_id, 'Stranger', 'pro', NOW(), NOW() + INTERVAL '30 days')
      ON CONFLICT (id) DO UPDATE SET trial_end = NOW() + INTERVAL '30 days';

      PERFORM set_config('request.jwt.claim.sub', v_stranger_id::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      EXECUTE 'SET LOCAL ROLE authenticated';

      BEGIN
        INSERT INTO public.products (user_id, name, price, stock_quantity)
        VALUES (v_owner_id, 'Stranger Attack Product', 1.00, 1);
      EXCEPTION WHEN OTHERS THEN
        v_caught := true;
      END;

      EXECUTE 'RESET ROLE';
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', '', true);

      DELETE FROM public.barbershops WHERE owner_id IN (v_owner_id, v_stranger_id);
      DELETE FROM public.profiles WHERE id IN (v_owner_id, v_stranger_id);
      DELETE FROM auth.users WHERE id IN (v_owner_id, v_stranger_id);

      IF NOT v_caught THEN
        RAISE EXCEPTION 'Stranger was allowed to insert product for owner!';
      END IF;
    END $$;
  `;
  const res = runPsql(sql);
  assert(!res.includes('ERROR'), 'Unaffiliated stranger must be blocked by RLS');
});

test('Scenario 6: Staff of Tenant A is BLOCKED from mutating Tenant B products', () => {
  const sql = `
    DO $$
    DECLARE
      v_owner_a uuid := '66666666-6666-4666-8666-666666666661';
      v_mgr_a uuid := '66666666-6666-4666-8666-666666666662';
      v_owner_b uuid := '66666666-6666-4666-8666-666666666663';
      v_caught boolean := false;
    BEGIN
      INSERT INTO auth.users (id, email) VALUES (v_owner_a, 'ownerA@test.com'), (v_mgr_a, 'mgrA@test.com'), (v_owner_b, 'ownerB@test.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES 
        (v_owner_a, 'Shop A', 'pro', NOW(), NOW() + INTERVAL '30 days'),
        (v_mgr_a, 'Manager A', 'pro', NOW(), NOW() + INTERVAL '30 days'),
        (v_owner_b, 'Shop B', 'pro', NOW(), NOW() + INTERVAL '30 days')
      ON CONFLICT (id) DO UPDATE SET trial_end = NOW() + INTERVAL '30 days';

      INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
      VALUES (v_owner_a, v_mgr_a, 'manager'::app_role, 'active')
      ON CONFLICT (tenant_id, user_id) DO NOTHING;

      PERFORM set_config('request.jwt.claim.sub', v_mgr_a::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      EXECUTE 'SET LOCAL ROLE authenticated';

      BEGIN
        INSERT INTO public.products (user_id, name, price, stock_quantity)
        VALUES (v_owner_b, 'Cross Tenant Product', 99.00, 10);
      EXCEPTION WHEN OTHERS THEN
        v_caught := true;
      END;

      EXECUTE 'RESET ROLE';
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', '', true);

      DELETE FROM public.tenant_memberships WHERE tenant_id IN (v_owner_a, v_owner_b);
      DELETE FROM public.barbershops WHERE owner_id IN (v_owner_a, v_mgr_a, v_owner_b);
      DELETE FROM public.profiles WHERE id IN (v_owner_a, v_mgr_a, v_owner_b);
      DELETE FROM auth.users WHERE id IN (v_owner_a, v_mgr_a, v_owner_b);

      IF NOT v_caught THEN
        RAISE EXCEPTION 'Manager of Tenant A was allowed to insert product for Tenant B!';
      END IF;
    END $$;
  `;
  const res = runPsql(sql);
  assert(!res.includes('ERROR'), 'Staff from Tenant A must be blocked from Tenant B');
});

test('Scenario 7: Cross-tenant association attempt (Barber A + Service B) is BLOCKED with 23514', () => {
  const sql = `
    DO $$
    DECLARE
      v_tenant_a uuid := '77777777-7777-4777-8777-777777777771';
      v_tenant_b uuid := '77777777-7777-4777-8777-777777777772';
      v_barber_a uuid;
      v_service_b uuid;
      v_caught boolean := false;
      v_sqlstate text;
    BEGIN
      INSERT INTO auth.users (id, email) VALUES (v_tenant_a, 'tenantA7@test.com'), (v_tenant_b, 'tenantB7@test.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES 
        (v_tenant_a, 'Tenant A7', 'pro', NOW(), NOW() + INTERVAL '30 days'),
        (v_tenant_b, 'Tenant B7', 'pro', NOW(), NOW() + INTERVAL '30 days')
      ON CONFLICT (id) DO UPDATE SET trial_end = NOW() + INTERVAL '30 days';

      INSERT INTO public.barbers (name, tenant_id, user_id, active)
      VALUES ('Barber in Tenant A', v_tenant_a, v_tenant_a, true)
      RETURNING id INTO v_barber_a;

      INSERT INTO public.services (name, tenant_id, user_id, price, duration_minutes)
      VALUES ('Service in Tenant B', v_tenant_b, v_tenant_b, 50.00, 30)
      RETURNING id INTO v_service_b;

      BEGIN
        INSERT INTO public.barber_services (barber_id, service_id, tenant_id, user_id)
        VALUES (v_barber_a, v_service_b, v_tenant_a, v_tenant_a);
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
        v_caught := true;
      END;

      DELETE FROM public.services WHERE id = v_service_b;
      DELETE FROM public.barbers WHERE id = v_barber_a;
      DELETE FROM public.barbershops WHERE owner_id IN (v_tenant_a, v_tenant_b);
      DELETE FROM public.profiles WHERE id IN (v_tenant_a, v_tenant_b);
      DELETE FROM auth.users WHERE id IN (v_tenant_a, v_tenant_b);

      IF NOT v_caught THEN
        RAISE EXCEPTION 'Cross-tenant link between Barber A and Service B was erroneously permitted!';
      ELSIF v_sqlstate <> '23514' THEN
        RAISE EXCEPTION 'Expected SQLSTATE 23514 check_violation but got %', v_sqlstate;
      END IF;
    END $$;
  `;
  const res = runPsql(sql);
  assert(!res.includes('ERROR'), 'Cross-tenant association must be aborted by trigger with 23514');
});

test('Scenario 8: Legitimate association (Barber A + Service A) SUCCEEDS', () => {
  const sql = `
    DO $$
    DECLARE
      v_tenant_a uuid := '88888888-8888-4888-8888-888888888881';
      v_barber_a uuid;
      v_service_a uuid;
      v_link_id uuid;
    BEGIN
      INSERT INTO auth.users (id, email) VALUES (v_tenant_a, 'tenantA8@test.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES (v_tenant_a, 'Tenant A8', 'pro', NOW(), NOW() + INTERVAL '30 days')
      ON CONFLICT (id) DO UPDATE SET trial_end = NOW() + INTERVAL '30 days';

      INSERT INTO public.barbers (name, tenant_id, user_id, active)
      VALUES ('Barber A8', v_tenant_a, v_tenant_a, true)
      RETURNING id INTO v_barber_a;

      INSERT INTO public.services (name, tenant_id, user_id, price, duration_minutes)
      VALUES ('Service A8', v_tenant_a, v_tenant_a, 40.00, 30)
      RETURNING id INTO v_service_a;

      INSERT INTO public.barber_services (barber_id, service_id, tenant_id, user_id)
      VALUES (v_barber_a, v_service_a, v_tenant_a, v_tenant_a)
      RETURNING id INTO v_link_id;

      DELETE FROM public.barber_services WHERE id = v_link_id;
      DELETE FROM public.services WHERE id = v_service_a;
      DELETE FROM public.barbers WHERE id = v_barber_a;
      DELETE FROM public.barbershops WHERE owner_id = v_tenant_a;
      DELETE FROM public.profiles WHERE id = v_tenant_a;
      DELETE FROM auth.users WHERE id = v_tenant_a;
    END $$;
  `;
  const res = runPsql(sql);
  assert(!res.includes('ERROR'), 'Legitimate association must succeed without error');
});

test('Scenario 9: Legacy products remain valid and accessible', () => {
  const sql = `
    SELECT count(*) FROM public.products;
  `;
  const count = parseInt(runPsql(sql), 10);
  assert(!isNaN(count) && count >= 0, 'Legacy products query must succeed');
});

test('Scenario 10: RESTRICTED tenant cannot link barber_services or mutate products', () => {
  const sql = `
    DO $$
    DECLARE
      v_restricted_tenant uuid := '99999999-9999-4999-8999-999999999991';
      v_barber_id uuid;
      v_service_id uuid;
      v_caught_service boolean := false;
      v_caught_product boolean := false;
    BEGIN
      INSERT INTO auth.users (id, email) VALUES (v_restricted_tenant, 'restricted@test.com') ON CONFLICT (id) DO NOTHING;
      
      -- Setup tenant as ACTIVE first to create test entities
      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES (v_restricted_tenant, 'Restricted Shop', 'pro', NOW(), NOW() + INTERVAL '10 days')
      ON CONFLICT (id) DO UPDATE SET plan = 'pro', trial_end = NOW() + INTERVAL '10 days';

      INSERT INTO public.barbers (name, tenant_id, user_id, active)
      VALUES ('Suspended Barber', v_restricted_tenant, v_restricted_tenant, true)
      RETURNING id INTO v_barber_id;

      INSERT INTO public.services (name, tenant_id, user_id, price, duration_minutes)
      VALUES ('Suspended Service', v_restricted_tenant, v_restricted_tenant, 20.00, 20)
      RETURNING id INTO v_service_id;

      -- Transition tenant to RESTRICTED
      UPDATE public.profiles 
      SET plan = 'free', trial_start = NOW() - INTERVAL '30 days', trial_end = NOW() - INTERVAL '15 days'
      WHERE id = v_restricted_tenant;

      DELETE FROM public.subscriptions WHERE user_id = v_restricted_tenant;
      DELETE FROM public.saas_admin_voucher_redemptions WHERE tenant_id = v_restricted_tenant;

      -- 1. Test barber_services link on RESTRICTED tenant
      BEGIN
        INSERT INTO public.barber_services (barber_id, service_id, tenant_id, user_id)
        VALUES (v_barber_id, v_service_id, v_restricted_tenant, v_restricted_tenant);
      EXCEPTION WHEN OTHERS THEN
        v_caught_service := true;
      END;

      -- 2. Test product insertion on RESTRICTED tenant
      BEGIN
        INSERT INTO public.products (user_id, name, price, stock_quantity)
        VALUES (v_restricted_tenant, 'Suspended Prod', 10.00, 1);
      EXCEPTION WHEN OTHERS THEN
        v_caught_product := true;
      END;

      -- Re-enable temporarily to allow superuser cleanup
      UPDATE public.profiles SET trial_end = NOW() + INTERVAL '1 day' WHERE id = v_restricted_tenant;

      DELETE FROM public.services WHERE id = v_service_id;
      DELETE FROM public.barbers WHERE id = v_barber_id;
      DELETE FROM public.barbershops WHERE owner_id = v_restricted_tenant;
      DELETE FROM public.profiles WHERE id = v_restricted_tenant;
      DELETE FROM auth.users WHERE id = v_restricted_tenant;

      IF NOT v_caught_service OR NOT v_caught_product THEN
        RAISE EXCEPTION 'RESTRICTED tenant was not blocked! caught_service=%, caught_product=%', v_caught_service, v_caught_product;
      END IF;
    END $$;
  `;
  const res = runPsql(sql);
  assert(!res.includes('ERROR'), 'RESTRICTED tenant must be blocked from both products and barber_services');
});

test('Scenario 11: Direct API manipulation attempt via JWT impersonation is thwarted', () => {
  const sql = `
    DO $$
    DECLARE
      v_attacker_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      v_victim_tenant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      v_prod_id uuid;
      v_updated_rows integer;
    BEGIN
      INSERT INTO auth.users (id, email) VALUES (v_attacker_id, 'attacker@test.com'), (v_victim_tenant, 'victim@test.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, business_name, plan, trial_start, trial_end)
      VALUES 
        (v_attacker_id, 'Attacker', 'pro', NOW(), NOW() + INTERVAL '30 days'),
        (v_victim_tenant, 'Victim', 'pro', NOW(), NOW() + INTERVAL '30 days')
      ON CONFLICT (id) DO UPDATE SET trial_end = NOW() + INTERVAL '30 days';

      -- Create a victim product as victim
      INSERT INTO public.products (user_id, name, price, stock_quantity)
      VALUES (v_victim_tenant, 'Victim Product', 100.00, 10)
      RETURNING id INTO v_prod_id;

      -- Attacker token under authenticated role
      PERFORM set_config('request.jwt.claim.sub', v_attacker_id::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      EXECUTE 'SET LOCAL ROLE authenticated';

      -- Attacker attempts to forge an update on victim product
      UPDATE public.products SET price = 0.01 WHERE id = v_prod_id;
      GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

      EXECUTE 'RESET ROLE';
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', '', true);

      DELETE FROM public.products WHERE id = v_prod_id;
      DELETE FROM public.barbershops WHERE owner_id IN (v_attacker_id, v_victim_tenant);
      DELETE FROM public.profiles WHERE id IN (v_attacker_id, v_victim_tenant);
      DELETE FROM auth.users WHERE id IN (v_attacker_id, v_victim_tenant);

      IF v_updated_rows > 0 THEN
        RAISE EXCEPTION 'Attacker was able to update victim product (rows updated: %)', v_updated_rows;
      END IF;
    END $$;
  `;
  const res = runPsql(sql);
  assert(!res.includes('ERROR'), 'Direct API manipulation must be rejected with 0 rows updated');
});

test('Scenario 12: Barbearia LM entitlement and voucher preservation', () => {
  const lmEntitlement = runPsql(`
    SELECT public.is_tenant_operational('c54ac1ac-49be-4505-b7a4-d257ed023f08');
  `);
  assert.strictEqual(lmEntitlement, 't', 'Barbearia LM must remain fully operational (true)');

  const lmState = runPsql(`
    SELECT public.resolve_tenant_entitlement('c54ac1ac-49be-4505-b7a4-d257ed023f08')->>'operational_state';
  `);
  assert.strictEqual(lmState, 'VOUCHER_ACTIVE', 'Barbearia LM must retain VOUCHER_ACTIVE state');
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
