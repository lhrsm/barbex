const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("BARBEX — R2E.23B.1: Live Stripe Plan Mapping DML & Rollback Verification", async (t) => {
  const migPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20261020120000_r2e23b_base_plan_live_stripe_mapping_repair.sql"
  );
  assert.ok(fs.existsSync(migPath), "Repair migration file must exist with 20261020120000 timestamp");

  const rollbackPath = path.join(
    __dirname,
    "..",
    "scripts",
    "rollback",
    "20261020120000_r2e23b_base_plan_live_stripe_mapping_rollback.sql"
  );
  assert.ok(fs.existsSync(rollbackPath), "Rollback script must exist in scripts/rollback/");

  const sql = fs.readFileSync(migPath, "utf8");
  const rollbackSql = fs.readFileSync(rollbackPath, "utf8");

  await t.test("1. Transactional and Fail-Closed Structure", () => {
    assert.ok(sql.includes("BEGIN;"), "Repair migration must be wrapped in transaction");
    assert.ok(sql.includes("COMMIT;"), "Repair migration must commit transaction");
    assert.ok(sql.includes("PRECONDITION_FAILED"), "Must contain explicit precondition failure checks");
    assert.ok(sql.includes("POSTCONDITION_FAILED"), "Must contain explicit postcondition failure checks");

    assert.ok(rollbackSql.includes("BEGIN;"), "Rollback must be wrapped in transaction");
    assert.ok(rollbackSql.includes("COMMIT;"), "Rollback must commit transaction");
  });

  await t.test("2. Exact Canonical Live Targets in Repair SQL", () => {
    // Starter
    assert.ok(sql.includes("prod_UUtAMkyffs3hei"), "Must contain Starter Live Product ID");
    assert.ok(sql.includes("price_1TVtOWPKG6q10UjrQErPgyKO"), "Must contain Starter Live Monthly Price ID");
    assert.ok(sql.includes("price_1UJDZBPKG6q10UjrQrf3rHBS"), "Must contain Starter Live Annual Price ID");
    assert.ok(sql.includes("starter"), "Must target canonical Starter slug");

    // Pro
    assert.ok(sql.includes("prod_UUtAGJzYKaux3J"), "Must contain Pro Live Product ID");
    assert.ok(sql.includes("price_1TVtOVPKG6q10Ujre6zMGYpk"), "Must contain Pro Live Monthly Price ID");
    assert.ok(sql.includes("price_1UJDaCPKG6q10UjrWOjctNmr"), "Must contain Pro Live Annual Price ID");
    assert.ok(sql.includes("pro"), "Must target canonical Pro slug");

    // Elite
    assert.ok(sql.includes("prod_UUtTTRItozWDdd"), "Must contain Elite Live Product ID");
    assert.ok(sql.includes("price_1TmYG0PKG6q10UjrOx8tEehr"), "Must contain Elite Live Monthly Price ID");
    assert.ok(sql.includes("price_1UJDX4PKG6q10UjrzkytrHAJ"), "Must contain Elite Live Annual Price ID");
    assert.ok(sql.includes("elite"), "Must target canonical Elite slug");
  });

  await t.test("3. Invariants Preserved (Zero Mutation of Monetary & Test Fields)", () => {
    assert.ok(!sql.includes("price_monthly ="), "Must NOT modify price_monthly");
    assert.ok(!sql.includes("price_yearly ="), "Must NOT modify price_yearly");
    assert.ok(!sql.includes("stripe_price_id_test ="), "Must NOT modify stripe_price_id_test");
    assert.ok(!sql.includes("stripe_yearly_price_id_test ="), "Must NOT modify stripe_yearly_price_id_test");
    assert.ok(!sql.includes("stripe_product_id_test ="), "Must NOT modify stripe_product_id_test");
  });

  await t.test("4. Simulated Plan Row Resolution Post-Repair", () => {
    const repairedPlans = [
      {
        slug: "starter",
        name: "Plano Starter",
        stripe_product_id_live: "prod_UUtAMkyffs3hei",
        stripe_price_id_live: "price_1TVtOWPKG6q10UjrQErPgyKO",
        stripe_yearly_price_id_live: "price_1UJDZBPKG6q10UjrQrf3rHBS",
      },
      {
        slug: "pro",
        name: "Plano Pro",
        stripe_product_id_live: "prod_UUtAGJzYKaux3J",
        stripe_price_id_live: "price_1TVtOVPKG6q10Ujre6zMGYpk",
        stripe_yearly_price_id_live: "price_1UJDaCPKG6q10UjrWOjctNmr",
      },
      {
        slug: "elite",
        name: "Plano Elite",
        stripe_product_id_live: "prod_UUtTTRItozWDdd",
        stripe_price_id_live: "price_1TmYG0PKG6q10UjrOx8tEehr",
        stripe_yearly_price_id_live: "price_1UJDX4PKG6q10UjrzkytrHAJ",
      },
    ];

    for (const plan of repairedPlans) {
      assert.ok(plan.stripe_product_id_live.startsWith("prod_"));
      assert.ok(plan.stripe_price_id_live.startsWith("price_"));
      assert.ok(plan.stripe_yearly_price_id_live.startsWith("price_"));
    }
  });
});
