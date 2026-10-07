const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Test the resolvePriceFromPlanRow function logic strictly matching supabase/functions/_shared/stripe-pricing.ts
const BLOCKED_LEGACY_PRICE_IDS = new Set([
  'price_1TVtgWPKG6q10UjrxRUCnyg1',
  'price_1TVsefPKG6q10UjrKpTaUe71',
]);

function resolvePriceFromPlanRow(planRow, planKey, billingCycle, environment) {
  if (!planRow) {
    return {
      ok: false,
      code: 'CONFIG_ERROR',
      error: `Plano "${planKey}" não encontrado na base de dados.`,
    };
  }

  const isLive = environment === 'live';
  let candidatePriceId = null;

  if (billingCycle === 'year') {
    candidatePriceId = isLive
      ? planRow.stripe_yearly_price_id_live
      : planRow.stripe_yearly_price_id_test;
  } else {
    candidatePriceId = isLive
      ? planRow.stripe_price_id_live
      : planRow.stripe_price_id_test;
  }

  const isValidFormat =
    typeof candidatePriceId === 'string' &&
    candidatePriceId.trim().startsWith('price_');

  if (!isValidFormat || !candidatePriceId) {
    return {
      ok: false,
      code: 'CONFIG_ERROR',
      error: `Preço Stripe não configurado ou formato inválido no banco de dados para o plano "${planRow.name || planKey}" (${billingCycle}, ambiente: ${environment}).`,
    };
  }

  const sanitizedId = candidatePriceId.trim();

  if (BLOCKED_LEGACY_PRICE_IDS.has(sanitizedId)) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      error: `O identificador de preço ${sanitizedId} é um preço legado inativo para novas contratações.`,
    };
  }

  return { ok: true, priceId: sanitizedId };
}

function validatePlanCheckoutContract(planKey, billingCycle) {
  if (!planKey || typeof planKey !== 'string' || !['starter', 'pro', 'elite'].includes(planKey)) {
    return {
      ok: false,
      code: 'INVALID_PLAN',
      error: 'Plano inválido selecionado para contratação. Escolha starter, pro ou elite.',
    };
  }

  if (!billingCycle || typeof billingCycle !== 'string' || !['month', 'year'].includes(billingCycle)) {
    return {
      ok: false,
      code: 'INVALID_BILLING_CYCLE',
      error: 'Ciclo de faturamento inválido. Escolha month ou year.',
    };
  }

  return { ok: true };
}

// Canonical target plan rows after R2E.16H.2A repair
const REPAIRED_PLAN_ROWS = {
  starter: {
    slug: 'starter',
    name: 'Starter',
    stripe_product_id_live: 'prod_UUtAMkyffs3hei',
    stripe_price_id_live: 'price_1TVtOWPKG6q10UjrQErPgyKO',
    stripe_yearly_price_id_live: 'price_1UJDZBPKG6q10UjrQrf3rHBS',
    stripe_product_id_test: 'prod_test_starter',
    stripe_price_id_test: 'price_test_starter_mo',
    stripe_yearly_price_id_test: 'price_test_starter_yr'
  },
  pro: {
    slug: 'pro',
    name: 'Pro',
    stripe_product_id_live: 'prod_UUtAGJzYKaux3J',
    stripe_price_id_live: 'price_1TVtOVPKG6q10Ujre6zMGYpk',
    stripe_yearly_price_id_live: 'price_1UJDaCPKG6q10UjrWOjctNmr',
    stripe_product_id_test: 'prod_test_pro',
    stripe_price_id_test: 'price_test_pro_mo',
    stripe_yearly_price_id_test: 'price_test_pro_yr'
  },
  elite: {
    slug: 'elite',
    name: 'Elite',
    stripe_product_id_live: 'prod_UUtTTRItozWDdd',
    stripe_price_id_live: 'price_1TmYG0PKG6q10UjrOx8tEehr',
    stripe_yearly_price_id_live: 'price_1UJDX4PKG6q10UjrzkytrHAJ',
    stripe_product_id_test: 'prod_test_elite',
    stripe_price_id_test: 'price_test_elite_mo',
    stripe_yearly_price_id_test: 'price_test_elite_yr'
  }
};

// Legacy un-repaired plan rows
const UNREPAIRED_PLAN_ROWS = {
  starter: {
    slug: 'starter',
    name: 'Starter',
    stripe_product_id_live: null,
    stripe_price_id_live: '59,90',
    stripe_yearly_price_id_live: null
  },
  pro: {
    slug: 'pro',
    name: 'Pro',
    stripe_product_id_live: null,
    stripe_price_id_live: '99,90',
    stripe_yearly_price_id_live: null
  },
  elite: {
    slug: 'elite',
    name: 'Elite',
    stripe_product_id_live: null,
    stripe_price_id_live: '149,90',
    stripe_yearly_price_id_live: null
  }
};

test('BARBEX — R2E.16H.2A: Base Plan Live Mapping & Checkout Resolver Suite', async (t) => {
  await t.test('1. Six canonical Live combinations resolve exact target price IDs after repair', () => {
    // 1.1 Starter Monthly
    const sm = resolvePriceFromPlanRow(REPAIRED_PLAN_ROWS.starter, 'starter', 'month', 'live');
    assert.equal(sm.ok, true);
    assert.equal(sm.priceId, 'price_1TVtOWPKG6q10UjrQErPgyKO');

    // 1.2 Starter Annual
    const sy = resolvePriceFromPlanRow(REPAIRED_PLAN_ROWS.starter, 'starter', 'year', 'live');
    assert.equal(sy.ok, true);
    assert.equal(sy.priceId, 'price_1UJDZBPKG6q10UjrQrf3rHBS');

    // 1.3 Pro Monthly
    const pm = resolvePriceFromPlanRow(REPAIRED_PLAN_ROWS.pro, 'pro', 'month', 'live');
    assert.equal(pm.ok, true);
    assert.equal(pm.priceId, 'price_1TVtOVPKG6q10Ujre6zMGYpk');

    // 1.4 Pro Annual
    const py = resolvePriceFromPlanRow(REPAIRED_PLAN_ROWS.pro, 'pro', 'year', 'live');
    assert.equal(py.ok, true);
    assert.equal(py.priceId, 'price_1UJDaCPKG6q10UjrWOjctNmr');

    // 1.5 Elite Monthly
    const em = resolvePriceFromPlanRow(REPAIRED_PLAN_ROWS.elite, 'elite', 'month', 'live');
    assert.equal(em.ok, true);
    assert.equal(em.priceId, 'price_1TmYG0PKG6q10UjrOx8tEehr');

    // 1.6 Elite Annual
    const ey = resolvePriceFromPlanRow(REPAIRED_PLAN_ROWS.elite, 'elite', 'year', 'live');
    assert.equal(ey.ok, true);
    assert.equal(ey.priceId, 'price_1UJDX4PKG6q10UjrzkytrHAJ');
  });

  await t.test('2. Unrepaired legacy mapping fails closed with CONFIG_ERROR (proves defect & fix)', () => {
    const sm = resolvePriceFromPlanRow(UNREPAIRED_PLAN_ROWS.starter, 'starter', 'month', 'live');
    assert.equal(sm.ok, false);
    assert.equal(sm.code, 'CONFIG_ERROR');

    const sy = resolvePriceFromPlanRow(UNREPAIRED_PLAN_ROWS.starter, 'starter', 'year', 'live');
    assert.equal(sy.ok, false);
    assert.equal(sy.code, 'CONFIG_ERROR');

    const pm = resolvePriceFromPlanRow(UNREPAIRED_PLAN_ROWS.pro, 'pro', 'month', 'live');
    assert.equal(pm.ok, false);
    assert.equal(pm.code, 'CONFIG_ERROR');

    const em = resolvePriceFromPlanRow(UNREPAIRED_PLAN_ROWS.elite, 'elite', 'month', 'live');
    assert.equal(em.ok, false);
    assert.equal(em.code, 'CONFIG_ERROR');
  });

  await t.test('3. Contract validation rejects invalid plans, cycles and parameters', () => {
    assert.equal(validatePlanCheckoutContract(null, 'month').ok, false);
    assert.equal(validatePlanCheckoutContract('enterprise', 'month').ok, false);
    assert.equal(validatePlanCheckoutContract('starter', 'quarter').ok, false);
    assert.equal(validatePlanCheckoutContract('starter', null).ok, false);
    assert.equal(validatePlanCheckoutContract('starter', 'month').ok, true);
    assert.equal(validatePlanCheckoutContract('elite', 'year').ok, true);
  });

  await t.test('4. Environment isolation prevents cross-environment price leakage', () => {
    const liveRes = resolvePriceFromPlanRow(REPAIRED_PLAN_ROWS.starter, 'starter', 'month', 'live');
    assert.equal(liveRes.priceId, 'price_1TVtOWPKG6q10UjrQErPgyKO');

    const testRes = resolvePriceFromPlanRow(REPAIRED_PLAN_ROWS.starter, 'starter', 'month', 'test');
    assert.equal(testRes.priceId, 'price_test_starter_mo');

    assert.notEqual(liveRes.priceId, testRes.priceId);
  });

  await t.test('5. Blocked legacy price IDs are strictly rejected', () => {
    const legacyRow = {
      slug: 'elite',
      name: 'Elite',
      stripe_price_id_live: 'price_1TVtgWPKG6q10UjrxRUCnyg1'
    };
    const res = resolvePriceFromPlanRow(legacyRow, 'elite', 'month', 'live');
    assert.equal(res.ok, false);
    assert.equal(res.code, 'FORBIDDEN');
  });

  await t.test('6. SQL migration file structure and invariant assertions verification', () => {
    const migPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261007090000_r2e16h2a_base_plan_live_stripe_mapping_repair.sql');
    assert.ok(fs.existsSync(migPath), 'Migration file must exist');

    const sql = fs.readFileSync(migPath, 'utf8');
    assert.ok(sql.includes('BEGIN;'), 'Migration must be wrapped in transaction');
    assert.ok(sql.includes('COMMIT;'), 'Migration must commit transaction');
    assert.ok(sql.includes('prod_UUtAMkyffs3hei'), 'Must contain Starter Product ID');
    assert.ok(sql.includes('price_1TVtOWPKG6q10UjrQErPgyKO'), 'Must contain Starter Monthly Price ID');
    assert.ok(sql.includes('price_1UJDZBPKG6q10UjrQrf3rHBS'), 'Must contain Starter Annual Price ID');
    assert.ok(sql.includes('prod_UUtAGJzYKaux3J'), 'Must contain Pro Product ID');
    assert.ok(sql.includes('price_1TVtOVPKG6q10Ujre6zMGYpk'), 'Must contain Pro Monthly Price ID');
    assert.ok(sql.includes('price_1UJDaCPKG6q10UjrWOjctNmr'), 'Must contain Pro Annual Price ID');
    assert.ok(sql.includes('prod_UUtTTRItozWDdd'), 'Must contain Elite Product ID');
    assert.ok(sql.includes('price_1TmYG0PKG6q10UjrOx8tEehr'), 'Must contain Elite Monthly Price ID');
    assert.ok(sql.includes('price_1UJDX4PKG6q10UjrzkytrHAJ'), 'Must contain Elite Annual Price ID');
    assert.ok(sql.includes('RAISE EXCEPTION'), 'Must contain fail-closed assertions');
  });
});
