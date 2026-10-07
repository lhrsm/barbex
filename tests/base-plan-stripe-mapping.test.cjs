const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Test the resolvePriceFromPlanRow function logic strictly matching supabase/functions/_shared/stripe-pricing.ts
const BLOCKED_LEGACY_PRICE_IDS = new Set([
  "price_1TVtgWPKG6q10UjrxRUCnyg1",
  "price_1TVsefPKG6q10UjrKpTaUe71",
]);

function resolvePriceFromPlanRow(planRow, planKey, billingCycle, environment) {
  if (!planRow) {
    return {
      ok: false,
      code: "CONFIG_ERROR",
      error: `Plano "${planKey}" não encontrado na base de dados.`,
    };
  }

  const isLive = environment === "live";
  let candidatePriceId = null;

  if (billingCycle === "year") {
    candidatePriceId = isLive
      ? planRow.stripe_yearly_price_id_live
      : planRow.stripe_yearly_price_id_test;
  } else {
    candidatePriceId = isLive ? planRow.stripe_price_id_live : planRow.stripe_price_id_test;
  }

  const isValidFormat =
    typeof candidatePriceId === "string" && candidatePriceId.trim().startsWith("price_");

  if (!isValidFormat || !candidatePriceId) {
    return {
      ok: false,
      code: "CONFIG_ERROR",
      error: `Preço Stripe não configurado ou formato inválido no banco de dados para o plano "${planRow.name || planKey}" (${billingCycle}, ambiente: ${environment}).`,
    };
  }

  const sanitizedId = candidatePriceId.trim();

  if (BLOCKED_LEGACY_PRICE_IDS.has(sanitizedId)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: `O identificador de preço ${sanitizedId} é um preço legado inativo para novas contratações.`,
    };
  }

  return { ok: true, priceId: sanitizedId };
}

function validatePlanCheckoutContract(planKey, billingCycle) {
  if (!planKey || typeof planKey !== "string" || !["starter", "pro", "elite"].includes(planKey)) {
    return {
      ok: false,
      code: "INVALID_PLAN",
      error: "Plano inválido selecionado para contratação. Escolha starter, pro ou elite.",
    };
  }

  if (
    !billingCycle ||
    typeof billingCycle !== "string" ||
    !["month", "year"].includes(billingCycle)
  ) {
    return {
      ok: false,
      code: "INVALID_BILLING_CYCLE",
      error: "Ciclo de faturamento inválido. Escolha month ou year.",
    };
  }

  return { ok: true };
}

// Canonical target plan rows after R2E.16H.2A & R2E.16H.2B repairs
const CANONICAL_REPAIRED_PLAN_ROWS = {
  starter: {
    slug: "starter",
    name: "Starter",
    stripe_product_id_live: "prod_UUtAMkyffs3hei",
    stripe_price_id_live: "price_1TVtOWPKG6q10UjrQErPgyKO",
    stripe_yearly_price_id_live: "price_1UJDZBPKG6q10UjrQrf3rHBS",
    stripe_product_id_test: "prod_VKWq9S7RZgrX3j",
    stripe_price_id_test: "price_1UJrndPKG6q10UjrOh0rqWUQ",
    stripe_yearly_price_id_test: "price_1UJrntPKG6q10Ujr5NZvGFcs",
  },
  pro: {
    slug: "pro",
    name: "Pro",
    stripe_product_id_live: "prod_UUtAGJzYKaux3J",
    stripe_price_id_live: "price_1TVtOVPKG6q10Ujre6zMGYpk",
    stripe_yearly_price_id_live: "price_1UJDaCPKG6q10UjrWOjctNmr",
    stripe_product_id_test: "prod_VKWrJsN3EnYsLv",
    stripe_price_id_test: "price_1UJroIPKG6q10UjrzvrZu9FX",
    stripe_yearly_price_id_test: "price_1UJroZPKG6q10Ujr3BhHgRpG",
  },
  elite: {
    slug: "elite",
    name: "Elite",
    stripe_product_id_live: "prod_UUtTTRItozWDdd",
    stripe_price_id_live: "price_1TmYG0PKG6q10UjrOx8tEehr",
    stripe_yearly_price_id_live: "price_1UJDX4PKG6q10UjrzkytrHAJ",
    stripe_product_id_test: "prod_VKWsIELFcSxXLr",
    stripe_price_id_test: "price_1UJrp4PKG6q10UjrEB7Iy7RZ",
    stripe_yearly_price_id_test: "price_1UJrpUPKG6q10UjruyBirOlI",
  },
};

// Legacy un-repaired plan rows with monetary strings
const UNREPAIRED_PLAN_ROWS = {
  starter: {
    slug: "starter",
    name: "Starter",
    stripe_product_id_live: null,
    stripe_price_id_live: "59,90",
    stripe_yearly_price_id_live: null,
    stripe_product_id_test: null,
    stripe_price_id_test: "59,90",
    stripe_yearly_price_id_test: null,
  },
  pro: {
    slug: "pro",
    name: "Pro",
    stripe_product_id_live: null,
    stripe_price_id_live: "99,90",
    stripe_yearly_price_id_live: null,
    stripe_product_id_test: null,
    stripe_price_id_test: "99,90",
    stripe_yearly_price_id_test: null,
  },
  elite: {
    slug: "elite",
    name: "Elite",
    stripe_product_id_live: null,
    stripe_price_id_live: "149,90",
    stripe_yearly_price_id_live: null,
    stripe_product_id_test: null,
    stripe_price_id_test: "149,90",
    stripe_yearly_price_id_test: null,
  },
};

test("BARBEX — R2E.16H.2B: Base Plan Stripe Mapping & Environment Isolation Suite", async (t) => {
  await t.test("1. Six canonical Live combinations resolve exact target price IDs", () => {
    // 1.1 Starter Monthly Live
    const sm = resolvePriceFromPlanRow(
      CANONICAL_REPAIRED_PLAN_ROWS.starter,
      "starter",
      "month",
      "live",
    );
    assert.equal(sm.ok, true);
    assert.equal(sm.priceId, "price_1TVtOWPKG6q10UjrQErPgyKO");

    // 1.2 Starter Annual Live
    const sy = resolvePriceFromPlanRow(
      CANONICAL_REPAIRED_PLAN_ROWS.starter,
      "starter",
      "year",
      "live",
    );
    assert.equal(sy.ok, true);
    assert.equal(sy.priceId, "price_1UJDZBPKG6q10UjrQrf3rHBS");

    // 1.3 Pro Monthly Live
    const pm = resolvePriceFromPlanRow(CANONICAL_REPAIRED_PLAN_ROWS.pro, "pro", "month", "live");
    assert.equal(pm.ok, true);
    assert.equal(pm.priceId, "price_1TVtOVPKG6q10Ujre6zMGYpk");

    // 1.4 Pro Annual Live
    const py = resolvePriceFromPlanRow(CANONICAL_REPAIRED_PLAN_ROWS.pro, "pro", "year", "live");
    assert.equal(py.ok, true);
    assert.equal(py.priceId, "price_1UJDaCPKG6q10UjrWOjctNmr");

    // 1.5 Elite Monthly Live
    const em = resolvePriceFromPlanRow(
      CANONICAL_REPAIRED_PLAN_ROWS.elite,
      "elite",
      "month",
      "live",
    );
    assert.equal(em.ok, true);
    assert.equal(em.priceId, "price_1TmYG0PKG6q10UjrOx8tEehr");

    // 1.6 Elite Annual Live
    const ey = resolvePriceFromPlanRow(CANONICAL_REPAIRED_PLAN_ROWS.elite, "elite", "year", "live");
    assert.equal(ey.ok, true);
    assert.equal(ey.priceId, "price_1UJDX4PKG6q10UjrzkytrHAJ");
  });

  await t.test("2. Six canonical Test combinations resolve exact target price IDs", () => {
    // 2.1 Starter Monthly Test
    const sm = resolvePriceFromPlanRow(
      CANONICAL_REPAIRED_PLAN_ROWS.starter,
      "starter",
      "month",
      "test",
    );
    assert.equal(sm.ok, true);
    assert.equal(sm.priceId, "price_1UJrndPKG6q10UjrOh0rqWUQ");

    // 2.2 Starter Annual Test
    const sy = resolvePriceFromPlanRow(
      CANONICAL_REPAIRED_PLAN_ROWS.starter,
      "starter",
      "year",
      "test",
    );
    assert.equal(sy.ok, true);
    assert.equal(sy.priceId, "price_1UJrntPKG6q10Ujr5NZvGFcs");

    // 2.3 Pro Monthly Test
    const pm = resolvePriceFromPlanRow(CANONICAL_REPAIRED_PLAN_ROWS.pro, "pro", "month", "test");
    assert.equal(pm.ok, true);
    assert.equal(pm.priceId, "price_1UJroIPKG6q10UjrzvrZu9FX");

    // 2.4 Pro Annual Test
    const py = resolvePriceFromPlanRow(CANONICAL_REPAIRED_PLAN_ROWS.pro, "pro", "year", "test");
    assert.equal(py.ok, true);
    assert.equal(py.priceId, "price_1UJroZPKG6q10Ujr3BhHgRpG");

    // 2.5 Elite Monthly Test
    const em = resolvePriceFromPlanRow(
      CANONICAL_REPAIRED_PLAN_ROWS.elite,
      "elite",
      "month",
      "test",
    );
    assert.equal(em.ok, true);
    assert.equal(em.priceId, "price_1UJrp4PKG6q10UjrEB7Iy7RZ");

    // 2.6 Elite Annual Test
    const ey = resolvePriceFromPlanRow(CANONICAL_REPAIRED_PLAN_ROWS.elite, "elite", "year", "test");
    assert.equal(ey.ok, true);
    assert.equal(ey.priceId, "price_1UJrpUPKG6q10UjruyBirOlI");
  });

  await t.test("3. Full 12/12 Matrix test with strict non-leakage verification", () => {
    const plans = ["starter", "pro", "elite"];
    const cycles = ["month", "year"];
    const envs = ["test", "live"];

    let passCount = 0;
    for (const plan of plans) {
      for (const cycle of cycles) {
        for (const env of envs) {
          const res = resolvePriceFromPlanRow(CANONICAL_REPAIRED_PLAN_ROWS[plan], plan, cycle, env);
          assert.equal(res.ok, true);
          assert.ok(res.priceId.startsWith("price_"));

          // Verify that test resolves to test and live resolves to live (they must never equal each other)
          const oppositeEnv = env === "test" ? "live" : "test";
          const oppRes = resolvePriceFromPlanRow(
            CANONICAL_REPAIRED_PLAN_ROWS[plan],
            plan,
            cycle,
            oppositeEnv,
          );
          assert.equal(oppRes.ok, true);
          assert.notEqual(
            res.priceId,
            oppRes.priceId,
            `Cross-env contamination detected for ${plan} ${cycle}`,
          );

          passCount++;
        }
      }
    }
    assert.equal(passCount, 12, "Must successfully verify all 12 combinations");
  });

  await t.test(
    "4. Unrepaired legacy mapping fails closed with CONFIG_ERROR in both test & live",
    () => {
      for (const env of ["test", "live"]) {
        const sm = resolvePriceFromPlanRow(UNREPAIRED_PLAN_ROWS.starter, "starter", "month", env);
        assert.equal(sm.ok, false);
        assert.equal(sm.code, "CONFIG_ERROR");

        const sy = resolvePriceFromPlanRow(UNREPAIRED_PLAN_ROWS.starter, "starter", "year", env);
        assert.equal(sy.ok, false);
        assert.equal(sy.code, "CONFIG_ERROR");

        const pm = resolvePriceFromPlanRow(UNREPAIRED_PLAN_ROWS.pro, "pro", "month", env);
        assert.equal(pm.ok, false);
        assert.equal(pm.code, "CONFIG_ERROR");

        const em = resolvePriceFromPlanRow(UNREPAIRED_PLAN_ROWS.elite, "elite", "month", env);
        assert.equal(em.ok, false);
        assert.equal(em.code, "CONFIG_ERROR");
      }
    },
  );

  await t.test("5. Fail-closed contract and error handling regressions", () => {
    // Missing/unknown plans
    assert.equal(validatePlanCheckoutContract(null, "month").ok, false);
    assert.equal(validatePlanCheckoutContract("enterprise", "month").ok, false);
    assert.equal(validatePlanCheckoutContract("starter", "quarter").ok, false);
    assert.equal(validatePlanCheckoutContract("starter", null).ok, false);
    assert.equal(validatePlanCheckoutContract("starter", "month").ok, true);
    assert.equal(validatePlanCheckoutContract("pro", "month").ok, true);
    assert.equal(validatePlanCheckoutContract("elite", "year").ok, true);

    // Null plan row
    const nullRow = resolvePriceFromPlanRow(null, "starter", "month", "test");
    assert.equal(nullRow.ok, false);
    assert.equal(nullRow.code, "CONFIG_ERROR");

    // Missing specific column
    const missingColRow = { slug: "starter", stripe_price_id_test: null };
    const missingRes = resolvePriceFromPlanRow(missingColRow, "starter", "month", "test");
    assert.equal(missingRes.ok, false);
    assert.equal(missingRes.code, "CONFIG_ERROR");

    // Non 'price_' prefix format
    const badPrefixRow = { slug: "starter", stripe_price_id_test: "prod_VKWq9S7RZgrX3j" };
    const badPrefixRes = resolvePriceFromPlanRow(badPrefixRow, "starter", "month", "test");
    assert.equal(badPrefixRes.ok, false);
    assert.equal(badPrefixRes.code, "CONFIG_ERROR");

    // Blocked legacy price
    const blockedRow = { slug: "elite", stripe_price_id_live: "price_1TVtgWPKG6q10UjrxRUCnyg1" };
    const blockedRes = resolvePriceFromPlanRow(blockedRow, "elite", "month", "live");
    assert.equal(blockedRes.ok, false);
    assert.equal(blockedRes.code, "FORBIDDEN");
  });

  await t.test("6. Verify H.2B SQL migration syntax, safety checks, and canonical targets", () => {
    const migPath = path.join(
      __dirname,
      "..",
      "supabase",
      "migrations",
      "20261007100000_r2e16h2b_base_plan_test_stripe_mapping_repair.sql",
    );
    assert.ok(fs.existsSync(migPath), "H.2B migration file must exist");

    const sql = fs.readFileSync(migPath, "utf8");
    assert.ok(sql.includes("BEGIN;"), "Migration must be wrapped in transaction");
    assert.ok(sql.includes("COMMIT;"), "Migration must commit transaction");

    // Test product/price targets
    assert.ok(sql.includes("prod_VKWq9S7RZgrX3j"), "Must contain Starter Test Product ID");
    assert.ok(
      sql.includes("price_1UJrndPKG6q10UjrOh0rqWUQ"),
      "Must contain Starter Test Monthly Price ID",
    );
    assert.ok(
      sql.includes("price_1UJrntPKG6q10Ujr5NZvGFcs"),
      "Must contain Starter Test Annual Price ID",
    );

    assert.ok(sql.includes("prod_VKWrJsN3EnYsLv"), "Must contain Pro Test Product ID");
    assert.ok(
      sql.includes("price_1UJroIPKG6q10UjrzvrZu9FX"),
      "Must contain Pro Test Monthly Price ID",
    );
    assert.ok(
      sql.includes("price_1UJroZPKG6q10Ujr3BhHgRpG"),
      "Must contain Pro Test Annual Price ID",
    );

    assert.ok(sql.includes("prod_VKWsIELFcSxXLr"), "Must contain Elite Test Product ID");
    assert.ok(
      sql.includes("price_1UJrp4PKG6q10UjrEB7Iy7RZ"),
      "Must contain Elite Test Monthly Price ID",
    );
    assert.ok(
      sql.includes("price_1UJrpUPKG6q10UjruyBirOlI"),
      "Must contain Elite Test Annual Price ID",
    );

    // Live columns must NOT be updated
    assert.ok(!sql.includes("stripe_product_id_live ="), "Must NOT modify stripe_product_id_live");
    assert.ok(!sql.includes("stripe_price_id_live ="), "Must NOT modify stripe_price_id_live");
    assert.ok(
      !sql.includes("stripe_yearly_price_id_live ="),
      "Must NOT modify stripe_yearly_price_id_live",
    );

    // Monetary columns must NOT be updated
    assert.ok(!sql.includes("price_monthly ="), "Must NOT modify price_monthly");
    assert.ok(!sql.includes("price_yearly ="), "Must NOT modify price_yearly");

    // Fail-closed checks
    assert.ok(sql.includes("RAISE EXCEPTION"), "Must contain fail-closed assertions");
  });
});
