const { test, describe, before, after, beforeEach } = require('node:test');
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

function runPsqlJson(sql) {
  const res = runPsql(sql);
  try {
    return JSON.parse(res);
  } catch (e) {
    throw new Error(`Failed to parse JSON from psql: "${res}". Error: ${e.message}`);
  }
}

describe('BARBEX — R2E.16B: Add-on Foundation Convergence Test Suite', { concurrency: 1 }, () => {
  const tenantOwnerA = '11111111-aaaa-4111-8111-111111111111';
  const tenantStaffA = '11111111-bbbb-4111-8111-111111111111';
  const tenantBarberA = '11111111-cccc-4111-8111-111111111111';
  const tenantB = '22222222-bbbb-4222-8222-222222222222';
  const superAdminId = '99999999-9999-4999-8999-999999999999';

  before(() => {
    runPsql(`
      BEGIN;
      -- Super Admin
      INSERT INTO auth.users (id, email) VALUES ('${superAdminId}', 'superadmin@barbex.shop') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, status, role) VALUES ('${superAdminId}', 'superadmin@barbex.shop', 'active', 'super_admin') ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'super_admin';
      INSERT INTO public.user_roles (user_id, role) VALUES ('${superAdminId}', 'super_admin') ON CONFLICT DO NOTHING;

      -- Tenant A Owner
      INSERT INTO auth.users (id, email) VALUES ('${tenantOwnerA}', 'r2e16b_owner_a@barbex.shop')
      ON CONFLICT (id) DO UPDATE SET email = 'r2e16b_owner_a@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${tenantOwnerA}', 'r2e16b_owner_a@barbex.shop', 'active', 'admin', '${tenantOwnerA}')
      ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'admin', tenant_id = '${tenantOwnerA}';
      INSERT INTO public.barbershops (id, name, slug, owner_id) VALUES ('${tenantOwnerA}', 'Barbearia A 16B', 'barbearia-a-16b', '${tenantOwnerA}')
      ON CONFLICT (id) DO UPDATE SET owner_id = '${tenantOwnerA}';

      -- Tenant A Staff Admin (non-owner)
      INSERT INTO auth.users (id, email) VALUES ('${tenantStaffA}', 'r2e16b_staff_a@barbex.shop')
      ON CONFLICT (id) DO UPDATE SET email = 'r2e16b_staff_a@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${tenantStaffA}', 'r2e16b_staff_a@barbex.shop', 'active', 'admin', '${tenantOwnerA}')
      ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'admin', tenant_id = '${tenantOwnerA}';

      -- Tenant A Barber
      INSERT INTO auth.users (id, email) VALUES ('${tenantBarberA}', 'r2e16b_barber_a@barbex.shop')
      ON CONFLICT (id) DO UPDATE SET email = 'r2e16b_barber_a@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${tenantBarberA}', 'r2e16b_barber_a@barbex.shop', 'active', 'barber', '${tenantOwnerA}')
      ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'barber', tenant_id = '${tenantOwnerA}';

      -- Tenant B
      INSERT INTO auth.users (id, email) VALUES ('${tenantB}', 'r2e16b_owner_b@barbex.shop')
      ON CONFLICT (id) DO UPDATE SET email = 'r2e16b_owner_b@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${tenantB}', 'r2e16b_owner_b@barbex.shop', 'active', 'admin', '${tenantB}')
      ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'admin', tenant_id = '${tenantB}';
      INSERT INTO public.barbershops (id, name, slug, owner_id) VALUES ('${tenantB}', 'Barbearia B 16B', 'barbearia-b-16b', '${tenantB}')
      ON CONFLICT (id) DO UPDATE SET owner_id = '${tenantB}';

      -- Clean up test records
      DELETE FROM public.tenant_addons WHERE tenant_id IN ('${tenantOwnerA}', '${tenantB}');
      DELETE FROM public.subscriptions WHERE user_id IN ('${tenantOwnerA}', '${tenantB}');
      DELETE FROM public.barbershop_modules WHERE tenant_id IN ('${tenantOwnerA}', '${tenantB}');
      COMMIT;
    `);
  });

  after(() => {
    runPsql(`
      BEGIN;
      DELETE FROM public.saas_admin_voucher_redemptions WHERE tenant_id IN ('${tenantOwnerA}', '${tenantB}');
      DELETE FROM public.tenant_addons WHERE tenant_id IN ('${tenantOwnerA}', '${tenantB}');
      DELETE FROM public.subscriptions WHERE user_id IN ('${tenantOwnerA}', '${tenantB}');
      DELETE FROM public.barbershop_modules WHERE tenant_id IN ('${tenantOwnerA}', '${tenantB}');
      COMMIT;
    `);
  });

  // Helper to ensure clean Starter active subscription
  function ensureActiveStarterSub(userId = tenantOwnerA) {
    runPsql(`
      INSERT INTO public.subscriptions (
        user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id,
        plan_key, status, billing_cycle, environment
      )
      VALUES (
        '${userId}', 'sub_starter_a', 'cus_test_a', 'prod_starter', 'price_starter_month',
        'starter', 'active', 'month', 'test'
      )
      ON CONFLICT (stripe_subscription_id) DO UPDATE SET
        plan_key = 'starter', status = 'active', billing_cycle = 'month',
        past_due_since = NULL, grace_ends_at = NULL;
    `);
  }

  // --------------------------------------------------------------------------
  // A. CATALOG MAPPING & CONVERGENCE TESTS
  // --------------------------------------------------------------------------
  describe('Gate A: Catalog Mapping & Convergence', { concurrency: false }, () => {
    test('A.1 Canonical addons map cleanly to canonical module keys', () => {
      const rows = runPsqlJson(`
        SELECT json_agg(json_build_object('addon_key', addon_key, 'canonical_module_key', canonical_module_key))
        FROM public.saas_addons
        WHERE addon_key IN ('stock', 'advanced_finance', 'reports_advanced', 'coupons', 'loyalty', 'commissions', 'ai_assistant', 'api_access', 'campaigns');
      `);

      const map = Object.fromEntries(rows.map(r => [r.addon_key, r.canonical_module_key]));
      assert.equal(map.stock, 'stock');
      assert.equal(map.advanced_finance, 'advanced_finance');
      assert.equal(map.reports_advanced, 'reports_advanced');
      assert.equal(map.coupons, 'coupons');
      assert.equal(map.loyalty, 'loyalty');
      assert.equal(map.commissions, 'commissions');
      assert.equal(map.ai_assistant, 'ai');
      assert.equal(map.api_access, 'api');
      assert.equal(map.campaigns, 'campaigns');
    });

    test('A.2 Ambiguous / non-module legacy addons have canonical_module_key = NULL and is_active = false', () => {
      const ambiguousRows = runPsqlJson(`
        SELECT COALESCE(json_agg(json_build_object('addon_key', addon_key, 'canonical_module_key', canonical_module_key, 'is_active', is_active)), '[]'::json)
        FROM public.saas_addons
        WHERE canonical_module_key IS NULL;
      `);

      assert.ok(ambiguousRows.length > 0, 'Expected at least one non-canonical legacy addon');
      for (const r of ambiguousRows) {
        assert.equal(r.canonical_module_key, null, `Expected null canonical module for ${r.addon_key}`);
        assert.equal(r.is_active, false, `Expected is_active = false for ${r.addon_key}`);
      }
    });

    test('A.3 Core and Non-commercial modules cannot be purchased as add-ons', () => {
      ensureActiveStarterSub();
      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'dashboard', '${tenantOwnerA}', 'month');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'NOT_FOUND');
    });
  });

  // --------------------------------------------------------------------------
  // B. PLAN ELIGIBILITY & NON-OVERLAP TESTS
  // --------------------------------------------------------------------------
  describe('Gate B: Plan Eligibility & Non-Overlap', { concurrency: false }, () => {
    test('B.1 Starter can purchase advanced_finance (eligible and not included)', () => {
      ensureActiveStarterSub();
      runPsql(`
        UPDATE public.saas_addons
        SET is_active = true, stripe_price_id_test = 'price_test_adv_fin'
        WHERE addon_key = 'advanced_finance';
      `);

      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'advanced_finance', '${tenantOwnerA}', 'month', 'test');
      `);
      assert.equal(res.eligible, true);
      assert.equal(res.canonical_module_key, 'advanced_finance');
    });

    test('B.2 Pro cannot purchase advanced_finance because it is already included in Pro', () => {
      ensureActiveStarterSub();
      runPsql(`
        UPDATE public.subscriptions
        SET plan_key = 'pro'
        WHERE stripe_subscription_id = 'sub_starter_a';
      `);

      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'advanced_finance', '${tenantOwnerA}', 'month', 'test');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'ALREADY_INCLUDED_IN_PLAN');
    });

    test('B.3 Ineligible plan key is denied', () => {
      ensureActiveStarterSub();
      runPsql(`
        UPDATE public.subscriptions
        SET plan_key = 'elite'
        WHERE stripe_subscription_id = 'sub_starter_a';
      `);

      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'advanced_finance', '${tenantOwnerA}', 'month', 'test');
      `);
      assert.equal(res.eligible, false);
      assert.ok(['ALREADY_INCLUDED_IN_PLAN', 'PLAN_NOT_ELIGIBLE'].includes(res.error_code));
    });
  });

  // --------------------------------------------------------------------------
  // C. BILLING CYCLE VOCABULARY & MATCHING TESTS
  // --------------------------------------------------------------------------
  describe('Gate C: Billing Cycle Normalization & Interval Matching', { concurrency: false }, () => {
    test('C.1 Normalization function maps month/monthly to month, year/annual to year', () => {
      assert.equal(runPsql(`SELECT public.normalize_billing_cycle('month');`), 'month');
      assert.equal(runPsql(`SELECT public.normalize_billing_cycle('monthly');`), 'month');
      assert.equal(runPsql(`SELECT public.normalize_billing_cycle('year');`), 'year');
      assert.equal(runPsql(`SELECT public.normalize_billing_cycle('yearly');`), 'year');
      assert.equal(runPsql(`SELECT public.normalize_billing_cycle('annual');`), 'year');
      assert.equal(runPsql(`SELECT public.normalize_billing_cycle('invalid');`), '');
    });

    test('C.2 Mixed billing interval is strictly DENIED fail-closed', () => {
      ensureActiveStarterSub();
      runPsql(`
        UPDATE public.subscriptions
        SET plan_key = 'starter', billing_cycle = 'year'
        WHERE stripe_subscription_id = 'sub_starter_a';
      `);

      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'advanced_finance', '${tenantOwnerA}', 'month', 'test');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'CYCLE_MISMATCH');
      assert.equal(res.expected_cycle, 'year');
    });
  });

  // --------------------------------------------------------------------------
  // D. GRACE PERIOD & ACTIVE_ADDON ENTITLEMENT TESTS
  // --------------------------------------------------------------------------
  describe('Gate D: Grace Period & Active Add-on Entitlement', { concurrency: false }, () => {
    beforeEach(() => {
      ensureActiveStarterSub();
      runPsql(`
        UPDATE public.saas_addons
        SET is_active = true, stripe_price_id_test = 'price_test_stock'
        WHERE addon_key = 'stock';

        DELETE FROM public.tenant_addons WHERE tenant_id = '${tenantOwnerA}';
        INSERT INTO public.tenant_addons (
          tenant_id, addon_id, status, stripe_subscription_id, stripe_subscription_item_id, current_period_end
        )
        SELECT '${tenantOwnerA}', id, 'active', 'sub_starter_a', 'si_test_stock', clock_timestamp() + interval '30 days'
        FROM public.saas_addons WHERE addon_key = 'stock';
      `);
    });

    test('D.1 Active base subscription + active addon -> GRANTED', () => {
      runPsql(`
        UPDATE public.subscriptions
        SET status = 'active', past_due_since = NULL, grace_ends_at = NULL
        WHERE stripe_subscription_id = 'sub_starter_a';
      `);

      const hasAccess = runPsql(`SELECT public.has_module_access('${tenantOwnerA}', 'stock');`);
      assert.equal(hasAccess, 't');

      const rpcActive = runPsql(`SELECT public.tenant_has_active_addon('${tenantOwnerA}', 'stock');`);
      assert.equal(rpcActive, 't');
    });

    test('D.2 Past due base subscription WITHIN GRACE + active addon -> GRANTED', () => {
      runPsql(`
        UPDATE public.subscriptions
        SET status = 'past_due',
            past_due_since = clock_timestamp() - interval '2 days',
            grace_ends_at = clock_timestamp() + interval '5 days'
        WHERE stripe_subscription_id = 'sub_starter_a';
      `);

      const hasAccess = runPsql(`SELECT public.has_module_access('${tenantOwnerA}', 'stock');`);
      assert.equal(hasAccess, 't');

      const rpcActive = runPsql(`SELECT public.tenant_has_active_addon('${tenantOwnerA}', 'stock');`);
      assert.equal(rpcActive, 't');
    });

    test('D.3 Past due base subscription EXPIRED GRACE + active addon -> DENIED fail-closed', () => {
      runPsql(`
        UPDATE public.subscriptions
        SET status = 'past_due',
            past_due_since = clock_timestamp() - interval '8 days',
            grace_ends_at = clock_timestamp() - interval '1 day'
        WHERE stripe_subscription_id = 'sub_starter_a';
      `);

      const hasAccess = runPsql(`SELECT public.has_module_access('${tenantOwnerA}', 'stock');`);
      assert.equal(hasAccess, 'f');

      const rpcActive = runPsql(`SELECT public.tenant_has_active_addon('${tenantOwnerA}', 'stock');`);
      assert.equal(rpcActive, 'f');
    });

    test('D.4 Canceled base subscription + active addon contract -> DENIED fail-closed', () => {
      runPsql(`
        UPDATE public.subscriptions
        SET status = 'canceled', grace_ends_at = NULL
        WHERE stripe_subscription_id = 'sub_starter_a';
      `);

      const hasAccess = runPsql(`SELECT public.has_module_access('${tenantOwnerA}', 'stock');`);
      assert.equal(hasAccess, 'f');

      const rpcActive = runPsql(`SELECT public.tenant_has_active_addon('${tenantOwnerA}', 'stock');`);
      assert.equal(rpcActive, 'f');
    });

    test('D.5 Unpaid base subscription + active addon contract -> DENIED fail-closed', () => {
      runPsql(`
        UPDATE public.subscriptions
        SET status = 'unpaid', grace_ends_at = NULL
        WHERE stripe_subscription_id = 'sub_starter_a';
      `);

      const hasAccess = runPsql(`SELECT public.has_module_access('${tenantOwnerA}', 'stock');`);
      assert.equal(hasAccess, 'f');

      const rpcActive = runPsql(`SELECT public.tenant_has_active_addon('${tenantOwnerA}', 'stock');`);
      assert.equal(rpcActive, 'f');
    });
  });

  // --------------------------------------------------------------------------
  // E. TRIAL PROTECTION TESTS
  // --------------------------------------------------------------------------
  describe('Gate E: Cardless Trial Isolation', { concurrency: false }, () => {
    test('E.1 Cardless trial without Stripe subscription cannot purchase add-ons', () => {
      runPsql(`
        DELETE FROM public.subscriptions WHERE user_id = '${tenantB}';
        UPDATE public.profiles SET trial_end = clock_timestamp() + interval '10 days' WHERE id = '${tenantB}';
      `);

      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantB}', 'stock', '${tenantB}', 'month', 'test');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'TRIAL_NOT_ELIGIBLE');
    });
  });

  // --------------------------------------------------------------------------
  // F. VOUCHER REDUNDANT PURCHASE PROTECTION TESTS
  // --------------------------------------------------------------------------
  describe('Gate F: Administrative Voucher Protection', { concurrency: false }, () => {
    test('F.1 Tenant with active internal voucher cannot purchase redundant add-on', () => {
      ensureActiveStarterSub();
      runPsql(`
        INSERT INTO public.saas_admin_vouchers (id, name, purpose, status, duration_type)
        VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Test Voucher', 'internal_testing', 'active', 'forever')
        ON CONFLICT (id) DO UPDATE SET status = 'active';

        INSERT INTO public.saas_admin_voucher_redemptions (id, voucher_id, tenant_id, status)
        VALUES ('00000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '${tenantOwnerA}'::uuid, 'active')
        ON CONFLICT (id) DO UPDATE SET status = 'active';
      `);

      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'stock', '${tenantOwnerA}', 'month', 'test');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'VOUCHER_ACTIVE');

      // Cleanup voucher
      runPsql(`
        DELETE FROM public.saas_admin_voucher_redemptions WHERE tenant_id = '${tenantOwnerA}';
      `);
    });
  });

  // --------------------------------------------------------------------------
  // G. OWNER-ONLY FINANCIAL AUTHORITY TESTS
  // --------------------------------------------------------------------------
  describe('Gate G: Owner-Only Financial Authority', { concurrency: false }, () => {
    beforeEach(() => {
      ensureActiveStarterSub();
      runPsql(`
        UPDATE public.saas_addons
        SET is_active = true, stripe_price_id_test = 'price_test_stock'
        WHERE addon_key = 'stock';
        DELETE FROM public.tenant_addons WHERE tenant_id = '${tenantOwnerA}';
      `);
    });

    test('G.1 Tenant Owner can initiate purchase check', () => {
      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'stock', '${tenantOwnerA}', 'month', 'test');
      `);
      assert.equal(res.eligible, true);
    });

    test('G.2 Non-owner Admin cannot initiate financial add-on purchase', () => {
      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'stock', '${tenantStaffA}', 'month', 'test');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'NOT_OWNER');
    });

    test('G.3 Barber / Professional role cannot initiate financial add-on purchase', () => {
      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'stock', '${tenantBarberA}', 'month', 'test');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'NOT_OWNER');
    });
  });

  // --------------------------------------------------------------------------
  // H. STRIPE PRICE FAIL-CLOSED & ENVIRONMENT ISOLATION TESTS
  // --------------------------------------------------------------------------
  describe('Gate H: Price Fail-Closed & Environment Isolation', { concurrency: false }, () => {
    beforeEach(() => {
      ensureActiveStarterSub();
      runPsql(`DELETE FROM public.tenant_addons WHERE tenant_id = '${tenantOwnerA}';`);
    });

    test('H.1 Missing Stripe Price ID fails closed with PRICE_NOT_CONFIGURED', () => {
      runPsql(`
        UPDATE public.saas_addons
        SET is_active = true, stripe_price_id_test = NULL
        WHERE addon_key = 'stock';
      `);

      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'stock', '${tenantOwnerA}', 'month', 'test');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'PRICE_NOT_CONFIGURED');
    });

    test('H.2 Cross-environment fallback is strictly prohibited (Live requested with only Test provisioned)', () => {
      runPsql(`
        UPDATE public.saas_addons
        SET is_active = true, stripe_price_id_test = 'price_test_stock', stripe_price_id_live = NULL
        WHERE addon_key = 'stock';
      `);

      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'stock', '${tenantOwnerA}', 'month', 'live');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'PRICE_NOT_CONFIGURED');
    });
  });

  // --------------------------------------------------------------------------
  // I. WEBHOOK SNAPSHOT RECONCILIATION & MISSING-ITEM PRUNING TESTS
  // --------------------------------------------------------------------------
  describe('Gate I: Webhook Missing-Item Pruning & Idempotency', { concurrency: false }, () => {
    test('I.1 Missing Stripe subscription item revokes local active tenant_addon', () => {
      ensureActiveStarterSub();
      // Insert 2 addons under sub_starter_a
      runPsql(`
        DELETE FROM public.tenant_addons WHERE tenant_id = '${tenantOwnerA}';
        INSERT INTO public.tenant_addons (tenant_id, addon_id, status, stripe_subscription_id, stripe_subscription_item_id)
        SELECT '${tenantOwnerA}', id, 'active', 'sub_starter_a', 'si_item_stock'
        FROM public.saas_addons WHERE addon_key = 'stock';

        INSERT INTO public.tenant_addons (tenant_id, addon_id, status, stripe_subscription_id, stripe_subscription_item_id)
        SELECT '${tenantOwnerA}', id, 'active', 'sub_starter_a', 'si_item_finance'
        FROM public.saas_addons WHERE addon_key = 'advanced_finance';
      `);

      // Snapshot now only contains si_item_stock. si_item_finance was removed in Stripe.
      runPsql(`
        UPDATE public.tenant_addons
        SET status = 'cancelled', cancelled_at = now()
        WHERE stripe_subscription_id = 'sub_starter_a'
          AND stripe_subscription_item_id NOT IN ('si_item_stock')
          AND status IN ('active', 'trialing', 'past_due');
      `);

      const activeCount = runPsql(`
        SELECT count(*) FROM public.tenant_addons
        WHERE stripe_subscription_id = 'sub_starter_a' AND status = 'active';
      `);
      assert.equal(Number(activeCount), 1);

      const canceledFin = runPsql(`
        SELECT status FROM public.tenant_addons
        WHERE stripe_subscription_id = 'sub_starter_a' AND stripe_subscription_item_id = 'si_item_finance';
      `);
      assert.equal(canceledFin, 'cancelled');
    });

    test('I.2 Webhook pruning is idempotent on replay', () => {
      // Re-running the exact same pruning query produces no further changes
      runPsql(`
        UPDATE public.tenant_addons
        SET status = 'cancelled', cancelled_at = now()
        WHERE stripe_subscription_id = 'sub_starter_a'
          AND stripe_subscription_item_id NOT IN ('si_item_stock')
          AND status IN ('active', 'trialing', 'past_due');
      `);

      const count = runPsql(`
        SELECT count(*) FROM public.tenant_addons
        WHERE stripe_subscription_id = 'sub_starter_a' AND status = 'active';
      `);
      assert.equal(Number(count), 1);
    });
  });

  // --------------------------------------------------------------------------
  // J. PLAN UPGRADE OVERLAP & ABSORPTION TESTS
  // --------------------------------------------------------------------------
  describe('Gate J: Plan Upgrade Overlap Absorption', { concurrency: false }, () => {
    test('J.1 When upgraded plan includes capability, status transitions to absorbed_by_plan', () => {
      ensureActiveStarterSub();
      // Insert stock addon under sub_starter_a
      runPsql(`
        DELETE FROM public.tenant_addons WHERE tenant_id = '${tenantOwnerA}';
        INSERT INTO public.tenant_addons (tenant_id, addon_id, status, stripe_subscription_id, stripe_subscription_item_id)
        SELECT '${tenantOwnerA}', id, 'active', 'sub_starter_a', 'si_test_stock'
        FROM public.saas_addons WHERE addon_key = 'stock';
      `);

      // Tenant upgrades to Elite (which includes stock)
      runPsql(`
        UPDATE public.subscriptions SET plan_key = 'elite', status = 'active' WHERE stripe_subscription_id = 'sub_starter_a';
        -- Simulate absorbAddonsIntoPlan
        UPDATE public.tenant_addons
        SET status = 'absorbed_by_plan', access_source = 'plan', stripe_subscription_item_id = NULL
        WHERE tenant_id = '${tenantOwnerA}' AND addon_id = (SELECT id FROM public.saas_addons WHERE addon_key = 'stock');
      `);

      // Stock is still accessible (via plan!), but add-on is absorbed
      const hasAccess = runPsql(`SELECT public.has_module_access('${tenantOwnerA}', 'stock');`);
      assert.equal(hasAccess, 't');

      const addonStatus = runPsql(`
        SELECT status FROM public.tenant_addons
        WHERE tenant_id = '${tenantOwnerA}' AND addon_id = (SELECT id FROM public.saas_addons WHERE addon_key = 'stock');
      `);
      assert.equal(addonStatus, 'absorbed_by_plan');
    });
  });

  // --------------------------------------------------------------------------
  // K. DOWNGRADE POLICY TESTS
  // --------------------------------------------------------------------------
  describe('Gate K: Downgrade Policy Integrity', { concurrency: false }, () => {
    test('K.1 Downgrade from Elite to Starter removes capabilities without auto-purchasing add-ons', () => {
      ensureActiveStarterSub();
      // Clean slate tenant addons
      runPsql(`DELETE FROM public.tenant_addons WHERE tenant_id = '${tenantOwnerA}';`);

      // Tenant on Elite
      runPsql(`UPDATE public.subscriptions SET plan_key = 'elite', status = 'active' WHERE stripe_subscription_id = 'sub_starter_a';`);
      assert.equal(runPsql(`SELECT public.has_module_access('${tenantOwnerA}', 'stock');`), 't');

      // Tenant downgrades to Starter
      runPsql(`UPDATE public.subscriptions SET plan_key = 'starter', status = 'active' WHERE stripe_subscription_id = 'sub_starter_a';`);

      // Stock access is immediately revoked
      assert.equal(runPsql(`SELECT public.has_module_access('${tenantOwnerA}', 'stock');`), 'f');

      // Zero tenant_addons were automatically created
      const addonsCount = runPsql(`SELECT count(*) FROM public.tenant_addons WHERE tenant_id = '${tenantOwnerA}';`);
      assert.equal(Number(addonsCount), 0);
    });
  });

  // --------------------------------------------------------------------------
  // L. SECURITY & CROSS-TENANT ISOLATION TESTS
  // --------------------------------------------------------------------------
  describe('Gate L: Cross-Tenant Isolation & Security', { concurrency: false }, () => {
    test('L.1 Cross-tenant add-on purchase check is denied', () => {
      ensureActiveStarterSub();
      // Tenant Owner A attempting to query / initiate purchase for Tenant B
      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantB}', 'stock', '${tenantOwnerA}', 'month', 'test');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'NOT_OWNER');
    });

    test('L.2 Unknown addon key fails closed', () => {
      ensureActiveStarterSub();
      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantOwnerA}', 'unknown_quantum_compute', '${tenantOwnerA}', 'month', 'test');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'NOT_FOUND');
    });
  });
});
