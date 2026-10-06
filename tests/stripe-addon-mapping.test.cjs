const test = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');

function runPsql(sql) {
  return execSync('docker exec -i supabase_db_barbex psql -U postgres -d postgres -t -A', {
    input: sql,
    encoding: 'utf8'
  }).trim();
}

function runPsqlJson(sql) {
  const raw = runPsql(sql);
  return JSON.parse(raw);
}

const EXPECTED_MAPPINGS = {
  advanced_finance: {
    prod_test: 'prod_VNtU6mFHh7BIeA',
    price_test_m: 'price_1UN7hkPKG6q10UjrVQJMhKOd',
    price_test_a: 'price_1UN7hoPKG6q10UjrTHflxnQ0',
    prod_live: 'prod_VNtX3LEruEAPHq',
    price_live_m: 'price_1UN7kmPKG6q10Ujrow9qJlOO',
    price_live_a: 'price_1UN7kqPKG6q10UjrKqKRTwwo',
    monthly: 24.90,
    annual: 249.00
  },
  stock: {
    prod_test: 'prod_VNtUIircw6LBcV',
    price_test_m: 'price_1UN7huPKG6q10Ujr147F8CfP',
    price_test_a: 'price_1UN7hyPKG6q10UjrzokL2iUz',
    prod_live: 'prod_VNtXWOqnD0s995',
    price_live_m: 'price_1UN7kxPKG6q10UjrVSuJoHzY',
    price_live_a: 'price_1UN7l0PKG6q10UjrTZrbtQyB',
    monthly: 19.90,
    annual: 199.00
  },
  commissions: {
    prod_test: 'prod_VNtVKNFVA862HE',
    price_test_m: 'price_1UN7i6PKG6q10UjrCVzrm0o0',
    price_test_a: 'price_1UN7iAPKG6q10Ujra7Yhm4LK',
    prod_live: 'prod_VNtYOLhICI3n5L',
    price_live_m: 'price_1UN7l6PKG6q10UjrKAIDx4Oy',
    price_live_a: 'price_1UN7lAPKG6q10Ujrj9tK7Tje',
    monthly: 19.90,
    annual: 199.00
  },
  reports_advanced: {
    prod_test: 'prod_VNtVXOCMo7Ty82',
    price_test_m: 'price_1UN7iGPKG6q10UjrivhAmPCA',
    price_test_a: 'price_1UN7iKPKG6q10UjrnzoU0UKV',
    prod_live: 'prod_VNtYPW5OlwABop',
    price_live_m: 'price_1UN7lHPKG6q10UjrEeQFmuv3',
    price_live_a: 'price_1UN7lKPKG6q10UjrxV05jkBs',
    monthly: 19.90,
    annual: 199.00
  },
  loyalty: {
    prod_test: 'prod_VNtVqQG5ztEHSS',
    price_test_m: 'price_1UN7iRPKG6q10UjrN5HKnIA8',
    price_test_a: 'price_1UN7iUPKG6q10UjrLGJ3TqMq',
    prod_live: 'prod_VNtYd8lyvjJ4WF',
    price_live_m: 'price_1UN7lSPKG6q10UjrXmuT2P4s',
    price_live_a: 'price_1UN7lVPKG6q10UjrWviXsxDY',
    monthly: 19.90,
    annual: 199.00
  },
  coupons: {
    prod_test: 'prod_VNtVXAKb1kJt8q',
    price_test_m: 'price_1UN7ibPKG6q10UjrgjhuLPCA',
    price_test_a: 'price_1UN7iePKG6q10UjrEUVp4LxG',
    prod_live: 'prod_VNtYt5A9Efbd7T',
    price_live_m: 'price_1UN7lcPKG6q10UjrhxGhq2H9',
    price_live_a: 'price_1UN7lgPKG6q10UjrRfhGVWDy',
    monthly: 14.90,
    annual: 149.00
  },
  campaigns: {
    prod_test: 'prod_VNtVgbnquvqnI9',
    price_test_m: 'price_1UN7ilPKG6q10Ujrt2ZIOzfm',
    price_test_a: 'price_1UN7ipPKG6q10Ujrc4063Rxh',
    prod_live: 'prod_VNtYTWszPr8CrC',
    price_live_m: 'price_1UN7lnPKG6q10UjrEiTr93lZ',
    price_live_a: 'price_1UN7lqPKG6q10Ujrh5ISESj7',
    monthly: 24.90,
    annual: 249.00
  }
};

test.describe('BARBEX — R2E.16F.1: Stripe Add-on Catalog Mapping Verification', () => {

  test('M.1 Exactly 7 approved add-ons exist, are active, and have exact Stripe IDs', () => {
    const rows = runPsqlJson(`
      SELECT COALESCE(json_agg(sa.*), '[]'::json)
      FROM public.saas_addons sa
      WHERE is_active = true;
    `);

    assert.equal(rows.length, 7, 'Expected exactly 7 active add-ons');
    for (const r of rows) {
      const exp = EXPECTED_MAPPINGS[r.addon_key];
      assert.ok(exp, `Unexpected active addon: ${r.addon_key}`);
      assert.equal(r.stripe_product_id_test, exp.prod_test);
      assert.equal(r.stripe_price_id_test, exp.price_test_m);
      assert.equal(r.stripe_price_id_annual_test, exp.price_test_a);
      assert.equal(r.stripe_product_id_live, exp.prod_live);
      assert.equal(r.stripe_price_id_live, exp.price_live_m);
      assert.equal(r.stripe_price_id_annual_live, exp.price_live_a);
      assert.equal(Number(r.monthly_price), exp.monthly);
      assert.equal(Number(r.annual_price), exp.annual);
    }
  });

  test('M.2 Deferred add-ons (ai, api) are inactive and have NULL Stripe IDs', () => {
    const rows = runPsqlJson(`
      SELECT COALESCE(json_agg(sa.*), '[]'::json)
      FROM public.saas_addons sa
      WHERE addon_key IN ('ai', 'ai_assistant', 'ai_addon', 'api', 'api_access');
    `);

    for (const r of rows) {
      assert.equal(r.is_active, false);
      assert.equal(r.stripe_product_id_test, null);
      assert.equal(r.stripe_price_id_test, null);
      assert.equal(r.stripe_price_id_annual_test, null);
      assert.equal(r.stripe_product_id_live, null);
      assert.equal(r.stripe_price_id_live, null);
      assert.equal(r.stripe_price_id_annual_live, null);
    }
  });

  test('M.3 Legacy add-ons are inactive and have NULL Stripe IDs', () => {
    const rows = runPsqlJson(`
      SELECT COALESCE(json_agg(sa.*), '[]'::json)
      FROM public.saas_addons sa
      WHERE addon_key NOT IN ('advanced_finance', 'stock', 'commissions', 'reports_advanced', 'loyalty', 'coupons', 'campaigns', 'ai', 'ai_assistant', 'ai_addon', 'api', 'api_access');
    `);

    for (const r of rows) {
      assert.equal(r.is_active, false);
      assert.equal(r.stripe_price_id_test, null);
      assert.equal(r.stripe_price_id_live, null);
    }
  });

  test('M.4 RPC can_tenant_purchase_addon resolves exact Test monthly price ID', () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    runPsql(`
      BEGIN;
      INSERT INTO auth.users (id, email) VALUES ('${tenantId}', 'r2e16f_owner@barbex.shop') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${tenantId}', 'r2e16f_owner@barbex.shop', 'active', 'admin', '${tenantId}') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.barbershops (id, name, slug, owner_id) VALUES ('${tenantId}', 'Barbearia 16F', 'barbearia-16f', '${tenantId}') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.subscriptions (
        user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id,
        plan_key, status, billing_cycle, environment
      )
      VALUES (
        '${tenantId}', 'sub_16f_test', 'cus_16f_test', 'prod_starter', 'price_starter_month',
        'starter', 'active', 'month', 'test'
      )
      ON CONFLICT (stripe_subscription_id) DO UPDATE SET
        status = 'active', plan_key = 'starter', billing_cycle = 'month';
      COMMIT;
    `);

    const res = runPsqlJson(`
      SELECT public.can_tenant_purchase_addon('${tenantId}', 'advanced_finance', '${tenantId}', 'month', 'test');
    `);

    assert.equal(res.eligible, true);
    assert.equal(res.price_id, 'price_1UN7hkPKG6q10UjrVQJMhKOd');
  });

  test('M.5 RPC can_tenant_purchase_addon resolves exact Test annual price ID', () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    runPsql(`
      UPDATE public.subscriptions
      SET billing_cycle = 'year'
      WHERE user_id = '${tenantId}';
    `);

    const res = runPsqlJson(`
      SELECT public.can_tenant_purchase_addon('${tenantId}', 'advanced_finance', '${tenantId}', 'year', 'test');
    `);

    assert.equal(res.eligible, true);
    assert.equal(res.price_id, 'price_1UN7hoPKG6q10UjrTHflxnQ0');
  });

  test('M.6 RPC can_tenant_purchase_addon resolves exact Live monthly price ID', () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    runPsql(`
      UPDATE public.subscriptions
      SET billing_cycle = 'month'
      WHERE user_id = '${tenantId}';
    `);

    const res = runPsqlJson(`
      SELECT public.can_tenant_purchase_addon('${tenantId}', 'advanced_finance', '${tenantId}', 'month', 'live');
    `);

    assert.equal(res.eligible, true);
    assert.equal(res.price_id, 'price_1UN7kmPKG6q10Ujrow9qJlOO');
  });

  test('M.7 RPC can_tenant_purchase_addon resolves exact Live annual price ID', () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    runPsql(`
      UPDATE public.subscriptions
      SET billing_cycle = 'year'
      WHERE user_id = '${tenantId}';
    `);

    const res = runPsqlJson(`
      SELECT public.can_tenant_purchase_addon('${tenantId}', 'advanced_finance', '${tenantId}', 'year', 'live');
    `);

    assert.equal(res.eligible, true);
    assert.equal(res.price_id, 'price_1UN7kqPKG6q10UjrKqKRTwwo');
  });

  test('M.8 Unmapped deferred addon fails closed with ADDON_INACTIVE', () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const res = runPsqlJson(`
      SELECT public.can_tenant_purchase_addon('${tenantId}', 'ai_assistant', '${tenantId}', 'year', 'test');
    `);

    assert.equal(res.eligible, false);
    assert.equal(res.error_code, 'ADDON_INACTIVE');
  });
});
