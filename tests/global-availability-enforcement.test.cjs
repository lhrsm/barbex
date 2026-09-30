const { test, describe, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');

function runPsql(sql) {
  try {
    const raw = execSync('docker exec -i supabase_db_barbex psql -U postgres -d postgres -t -A -v ON_ERROR_STOP=1', {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString().trim();
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines[lines.length - 1] || '';
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(`psql error: ${stderr}`);
  }
}

describe('R2E.13G.6A — Global Feature Availability Enforcement Tests', () => {

  // IDs for testing
  const tenantActiveId = '11111111-1111-4111-8111-111111111111';
  const tenantSuspendedId = '22222222-2222-4222-8222-222222222222';
  const tenantStarterId = '33333333-3333-4333-8333-333333333333';
  const superAdminUserId = '99999999-9999-4999-8999-999999999999';

  before(() => {
    // Setup test fixtures in isolated local DB
    runPsql(`
      BEGIN;
      -- Ensure super_admin user
      INSERT INTO auth.users (id, email) VALUES ('${superAdminUserId}', 'admin@barbex.shop') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, status) VALUES ('${superAdminUserId}', 'admin@barbex.shop', 'active') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.user_roles (user_id, role) VALUES ('${superAdminUserId}', 'super_admin') ON CONFLICT DO NOTHING;

      -- Active Pro Tenant
      INSERT INTO auth.users (id, email) VALUES ('${tenantActiveId}', 'pro@tenant.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, status, effective_plan, plan) VALUES ('${tenantActiveId}', 'pro@tenant.com', 'active', 'pro', 'pro') ON CONFLICT (id) DO UPDATE SET status = 'active', effective_plan = 'pro', plan = 'pro';

      -- Suspended Tenant
      INSERT INTO auth.users (id, email) VALUES ('${tenantSuspendedId}', 'suspended@tenant.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, status, effective_plan, plan) VALUES ('${tenantSuspendedId}', 'suspended@tenant.com', 'suspended', 'pro', 'pro') ON CONFLICT (id) DO UPDATE SET status = 'suspended', effective_plan = 'pro', plan = 'pro';

      -- Starter Tenant
      INSERT INTO auth.users (id, email) VALUES ('${tenantStarterId}', 'starter@tenant.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, status, effective_plan, plan) VALUES ('${tenantStarterId}', 'starter@tenant.com', 'active', 'starter', 'starter') ON CONFLICT (id) DO UPDATE SET status = 'active', effective_plan = 'starter', plan = 'starter';

      -- Reset all modules to available
      UPDATE public.platform_module_availability SET is_available = true;

      -- Reset tenant overrides
      DELETE FROM public.barbershop_modules WHERE tenant_id IN ('${tenantActiveId}', '${tenantSuspendedId}', '${tenantStarterId}');

      COMMIT;
    `);
  });

  after(() => {
    // Cleanup local test states
    runPsql(`
      UPDATE public.platform_module_availability SET is_available = true;
      DELETE FROM public.barbershop_modules WHERE tenant_id IN ('${tenantActiveId}', '${tenantSuspendedId}', '${tenantStarterId}');
    `);
  });

  test('Gate 54: LOCAL_GLOBAL_DEFAULT_NONREGRESSION — All canonical modules available by default match pre-G6A capability', () => {
    // Always-on core module (calendar) -> true
    const cal = runPsql(`SELECT public.has_module_access('${tenantActiveId}', 'calendar');`);
    assert.equal(cal, 't');

    // Pro entitled module (campaigns) for Pro tenant -> true
    const camp = runPsql(`SELECT public.has_module_access('${tenantActiveId}', 'campaigns');`);
    assert.equal(camp, 't');

    // Pro module (campaigns) for Starter tenant (unentitled) -> false
    const starterCamp = runPsql(`SELECT public.has_module_access('${tenantStarterId}', 'campaigns');`);
    assert.equal(starterCamp, 'f');

    // Suspended tenant -> false
    const susp = runPsql(`SELECT public.has_module_access('${tenantSuspendedId}', 'calendar');`);
    assert.equal(susp, 'f');
  });

  test('Gate 55: LOCAL_GLOBAL_UNAVAILABLE_DENY — Globally unavailable module is denied regardless of plan or override', () => {
    // Mark campaigns as globally UNAVAILABLE
    runPsql(`UPDATE public.platform_module_availability SET is_available = false WHERE module_key = 'campaigns';`);

    // Even though tenant is on Pro (plan has campaigns) and active, has_module_access MUST return false
    const campPro = runPsql(`SELECT public.has_module_access('${tenantActiveId}', 'campaigns');`);
    assert.equal(campPro, 'f', 'Pro tenant must be denied campaigns when globally unavailable');

    // Even if tenant override explicitly sets enabled = true in barbershop_modules, it MUST NOT bypass global kill!
    runPsql(`INSERT INTO public.barbershop_modules (tenant_id, module_key, enabled) VALUES ('${tenantActiveId}', 'campaigns', true) ON CONFLICT (tenant_id, module_key) DO UPDATE SET enabled = true;`);
    const campOverride = runPsql(`SELECT public.has_module_access('${tenantActiveId}', 'campaigns');`);
    assert.equal(campOverride, 'f', 'Tenant override enabled=true must not bypass global kill');

    // Reset campaigns
    runPsql(`UPDATE public.platform_module_availability SET is_available = true WHERE module_key = 'campaigns';`);
    runPsql(`DELETE FROM public.barbershop_modules WHERE tenant_id = '${tenantActiveId}' AND module_key = 'campaigns';`);
  });

  test('Gate 56: LOCAL_ALWAYS_ON_CANNOT_BYPASS_GLOBAL — Always-on core module cannot bypass global unavailable', () => {
    // Temporarily mark calendar (an always-on module) as globally UNAVAILABLE
    runPsql(`UPDATE public.platform_module_availability SET is_available = false WHERE module_key = 'calendar';`);

    const cal = runPsql(`SELECT public.has_module_access('${tenantActiveId}', 'calendar');`);
    assert.equal(cal, 'f', 'Always-on module calendar must return false when globally unavailable');

    // Reset calendar
    runPsql(`UPDATE public.platform_module_availability SET is_available = true WHERE module_key = 'calendar';`);
    const calRestored = runPsql(`SELECT public.has_module_access('${tenantActiveId}', 'calendar');`);
    assert.equal(calRestored, 't', 'Always-on module calendar must return true once restored');
  });

  test('Gate 57: LOCAL_SUSPENSION_PRECEDENCE — Global AVAILABLE + suspended tenant = DENY', () => {
    const res = runPsql(`SELECT public.has_module_access('${tenantSuspendedId}', 'customers');`);
    assert.equal(res, 'f', 'Suspended tenant must be denied even when module is globally available');
  });

  test('Gate 58: LOCAL_TENANT_OVERRIDE_PRECEDENCE — Global AVAILABLE + commercial entitlement + tenant DISABLED = DENY', () => {
    // Tenant disables loyalty module locally
    runPsql(`INSERT INTO public.barbershop_modules (tenant_id, module_key, enabled) VALUES ('${tenantActiveId}', 'loyalty', false) ON CONFLICT (tenant_id, module_key) DO UPDATE SET enabled = false;`);

    const res = runPsql(`SELECT public.has_module_access('${tenantActiveId}', 'loyalty');`);
    assert.equal(res, 'f', 'Tenant disabled override must deny access even when globally available and plan entitled');

    // Clean up
    runPsql(`DELETE FROM public.barbershop_modules WHERE tenant_id = '${tenantActiveId}' AND module_key = 'loyalty';`);
  });

  test('Gate 59: LOCAL_GLOBAL_AVAILABLE_NO_ENTITLEMENT — Global AVAILABLE + no plan + no addon = DENY', () => {
    // Starter tenant requesting Pro module (advanced_finance)
    const res = runPsql(`SELECT public.has_module_access('${tenantStarterId}', 'advanced_finance');`);
    assert.equal(res, 'f', 'Starter tenant must be denied Pro module even when globally available');
  });

  test('Gate 60: LOCAL_GLOBAL_ADDON_MATRIX — Addon grants access when AVAILABLE, but denies when UNAVAILABLE', () => {
    // Find or create an addon for ai module
    runPsql(`
      DO $$
      DECLARE
        v_addon_id uuid;
      BEGIN
        SELECT id INTO v_addon_id FROM public.saas_addons WHERE module_key = 'ai' LIMIT 1;
        IF v_addon_id IS NULL THEN
          INSERT INTO public.saas_addons (name, addon_key, module_key, monthly_price, is_active)
          VALUES ('AI Assistant', 'ai_addon', 'ai', 49.90, true)
          RETURNING id INTO v_addon_id;
        END IF;

        INSERT INTO public.tenant_addons (tenant_id, addon_id, status, current_period_end)
        VALUES ('${tenantStarterId}', v_addon_id, 'active', now() + interval '30 days')
        ON CONFLICT DO NOTHING;
      END $$;
    `);

    // With ai globally available: Starter tenant with active AI addon has access
    const aiAvailable = runPsql(`SELECT public.has_module_access('${tenantStarterId}', 'ai');`);
    assert.equal(aiAvailable, 't', 'Active addon must grant access when module is globally available');

    // Mark ai as globally UNAVAILABLE
    runPsql(`UPDATE public.platform_module_availability SET is_available = false WHERE module_key = 'ai';`);
    const aiKilled = runPsql(`SELECT public.has_module_access('${tenantStarterId}', 'ai');`);
    assert.equal(aiKilled, 'f', 'Active addon MUST NOT bypass global kill when module is globally unavailable');

    // Restore ai and cleanup addon
    runPsql(`UPDATE public.platform_module_availability SET is_available = true WHERE module_key = 'ai';`);
    runPsql(`DELETE FROM public.tenant_addons WHERE tenant_id = '${tenantStarterId}';`);
  });

  test('Gate 61: LOCAL_UNKNOWN_MODULE_FAIL_CLOSED — Unknown module fails closed', () => {
    const unknown1 = runPsql(`SELECT public.has_module_access('${tenantActiveId}', 'quantum_teleport');`);
    assert.equal(unknown1, 'f');

    const unknown2 = runPsql(`SELECT public.has_module_access('${tenantActiveId}', '');`);
    assert.equal(unknown2, 'f');

    const unknown3 = runPsql(`SELECT public.has_module_access('${tenantActiveId}', NULL);`);
    assert.equal(unknown3, 'f');
  });

  test('Gate 62: LOCAL_GLOBAL_AVAILABILITY_DIRECT_WRITE_BLOCK — Non-service role direct write fails due to RLS / REVOKE', () => {
    // Attempt insert as authenticated non-superadmin
    assert.throws(() => {
      runPsql(`
        SET ROLE authenticated;
        SET request.jwt.claims = '{"sub": "${tenantActiveId}", "role": "authenticated"}';
        INSERT INTO public.platform_module_availability (module_key, is_available) VALUES ('rogue_module', true);
      `);
    }, /permission denied/i);

    // Attempt update as authenticated non-superadmin
    assert.throws(() => {
      runPsql(`
        SET ROLE authenticated;
        SET request.jwt.claims = '{"sub": "${tenantActiveId}", "role": "authenticated"}';
        UPDATE public.platform_module_availability SET is_available = false WHERE module_key = 'calendar';
      `);
    }, /permission denied/i);
  });

  test('Gate 63: LOCAL_GLOBAL_AVAILABILITY_DIRECT_SUPERADMIN_WRITE_BLOCK — Authenticated Super Admin browser role cannot directly mutate platform_module_availability', () => {
    // In G.6A, direct browser writes are completely revoked from authenticated/anon roles
    assert.throws(() => {
      runPsql(`
        SET ROLE authenticated;
        SET request.jwt.claims = '{"sub": "${superAdminUserId}", "role": "authenticated"}';
        UPDATE public.platform_module_availability SET is_available = false WHERE module_key = 'calendar';
      `);
    }, /permission denied/i);
  });

  test('Gate 64: LOCAL_GLOBAL_AVAILABILITY_CROSS_TENANT_ISOLATION — Global availability does not leak tenant data', () => {
    // Read platform_module_availability as tenantActiveId
    const rows = runPsql(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${tenantActiveId}", "role": "authenticated"}';
      SELECT count(*) FROM public.platform_module_availability;
    `);
    assert.equal(rows, '23', 'Authenticated tenant can view all 23 platform availability flags');
  });

  test('Gate 65: LOCAL_GLOBAL_AVAILABILITY_RLS_MATRIX — Dependent RLS policies on campaigns/automations respect global kill', () => {
    // Clean up any lingering IDs
    runPsql(`DELETE FROM public.campaigns WHERE id IN ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');`);

    try {
      // Under normal availability, tenant CAN insert a campaign
      runPsql(`
        SET ROLE authenticated;
        SET request.jwt.claims = '{"sub": "${tenantActiveId}", "role": "authenticated"}';
        INSERT INTO public.campaigns (id, tenant_id, title, status)
        VALUES ('c0000000-0000-4000-8000-000000000001', '${tenantActiveId}', 'Test Campaign G6A Available', 'draft');
      `);

      // Mark campaigns globally UNAVAILABLE
      runPsql(`UPDATE public.platform_module_availability SET is_available = false WHERE module_key = 'campaigns';`);

      // Now, INSERT under authenticated role MUST fail RLS check (require_module_campaigns_insert)!
      assert.throws(() => {
        runPsql(`
          SET ROLE authenticated;
          SET request.jwt.claims = '{"sub": "${tenantActiveId}", "role": "authenticated"}';
          INSERT INTO public.campaigns (id, tenant_id, title, status)
          VALUES ('c0000000-0000-4000-8000-000000000002', '${tenantActiveId}', 'Test Campaign G6A Blocked', 'draft');
        `);
      }, /violates row-level security policy/i);

      // And UPDATE under authenticated role affects 0 rows because USING clause filters out rows when module is unavailable!
      const updateResult = runPsql(`
        SET ROLE authenticated;
        SET request.jwt.claims = '{"sub": "${tenantActiveId}", "role": "authenticated"}';
        UPDATE public.campaigns SET title = 'Attempted update' WHERE id = 'c0000000-0000-4000-8000-000000000001';
      `);
      assert.match(updateResult, /UPDATE 0/i, 'UPDATE must affect 0 rows under RLS when module is globally unavailable');

      // Verify the title was not modified
      const currentTitle = runPsql(`
        SELECT title FROM public.campaigns WHERE id = 'c0000000-0000-4000-8000-000000000001';
      `);
      assert.equal(currentTitle, 'Test Campaign G6A Available');
    } finally {
      // Restore campaigns availability and cleanup
      runPsql(`UPDATE public.platform_module_availability SET is_available = true WHERE module_key = 'campaigns';`);
      runPsql(`DELETE FROM public.campaigns WHERE id IN ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');`);
    }
  });

  test('Gate 66: Helper function is_module_globally_available works correctly with canonical keys and aliases', () => {
    assert.equal(runPsql(`SELECT public.is_module_globally_available('campaigns');`), 't');
    assert.equal(runPsql(`SELECT public.is_module_globally_available('portal');`), 't'); // alias for client_portal
    assert.equal(runPsql(`SELECT public.is_module_globally_available('products');`), 't'); // alias for stock

    runPsql(`UPDATE public.platform_module_availability SET is_available = false WHERE module_key = 'stock';`);
    assert.equal(runPsql(`SELECT public.is_module_globally_available('stock');`), 'f');
    assert.equal(runPsql(`SELECT public.is_module_globally_available('products');`), 'f'); // alias reflects false
    assert.equal(runPsql(`SELECT public.is_module_globally_available('store');`), 'f'); // alias reflects false

    runPsql(`UPDATE public.platform_module_availability SET is_available = true WHERE module_key = 'stock';`);
  });
});
