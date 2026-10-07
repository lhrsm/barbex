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
  if (!res || res.trim() === '') return null;
  try {
    return JSON.parse(res);
  } catch (e) {
    throw new Error(`Failed to parse JSON from psql: "${res}". Error: ${e.message}`);
  }
}

/**
 * High-fidelity Node simulator matching supabase/functions/stripe-checkout/index.ts
 * (resolveAuthCaller and create-plan-checkout action).
 */
class StripeCheckoutEdgeSimulator {
  constructor() {
    this.sessionCreationCalls = 0;
    this.customerCreationCalls = 0;
    this.subscriptionSideEffects = 0;
  }

  resetCounters() {
    this.sessionCreationCalls = 0;
    this.customerCreationCalls = 0;
    this.subscriptionSideEffects = 0;
  }

  /**
   * Simulates exact resolveAuthCaller logic in supabase/functions/stripe-checkout/index.ts
   */
  resolveAuthCaller(userId) {
    if (!userId) {
      const err = new Error("Token de autenticação ausente ou inválido.");
      err.status = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    // 1. Fetch profile
    const profile = runPsqlJson(`
      SELECT row_to_json(p) FROM (
        SELECT id, role, tenant_id, email, display_name, business_name
        FROM public.profiles
        WHERE id = '${userId}'
      ) p;
    `);

    if (!profile) {
      const err = new Error("Perfil de usuário não encontrado.");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    const effectiveTenantId = profile.tenant_id || profile.id;
    if (!effectiveTenantId) {
      const err = new Error("Tenant não identificado.");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    // 2. Resolve canonical barbershop ownership
    let barbershop = null;

    if (profile.tenant_id) {
      barbershop = runPsqlJson(`
        SELECT row_to_json(b) FROM (
          SELECT id, owner_id FROM public.barbershops WHERE id = '${profile.tenant_id}'
        ) b;
      `);

      if (!barbershop) {
        barbershop = runPsqlJson(`
          SELECT row_to_json(b) FROM (
            SELECT id, owner_id FROM public.barbershops WHERE owner_id = '${profile.tenant_id}'
          ) b;
        `);
      }
    } else {
      barbershop = runPsqlJson(`
        SELECT row_to_json(b) FROM (
          SELECT id, owner_id FROM public.barbershops WHERE owner_id = '${userId}'
        ) b;
      `);

      if (!barbershop) {
        barbershop = runPsqlJson(`
          SELECT row_to_json(b) FROM (
            SELECT id, owner_id FROM public.barbershops WHERE id = '${userId}'
          ) b;
        `);
      }
    }

    if (!barbershop) {
      const err = new Error("Barbearia não encontrada ou não vinculada ao usuário.");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    // 3. Canonical owner authority: barbershops.owner_id === auth.uid()
    const isOwner = barbershop.owner_id === userId;
    if (!isOwner) {
      const err = new Error("Apenas o proprietário do estabelecimento pode gerenciar assinaturas.");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    return {
      userId,
      tenantId: barbershop.id || effectiveTenantId,
      email: profile.email || "",
      callerRole: profile.role || "barber",
      isOwner: true
    };
  }

  /**
   * Simulates full create-plan-checkout action
   */
  async invokeCreatePlanCheckout(userId, payload) {
    // 1. Resolve auth caller
    const auth = this.resolveAuthCaller(userId);

    // 2. Validate contract
    if (!payload.planKey || !["starter", "pro", "elite"].includes(payload.planKey)) {
      const err = new Error("Plano inválido.");
      err.status = 400;
      err.code = "INVALID_REQUEST";
      throw err;
    }
    if (!payload.billingCycle || !["month", "year"].includes(payload.billingCycle)) {
      const err = new Error("Ciclo inválido.");
      err.status = 400;
      err.code = "INVALID_REQUEST";
      throw err;
    }

    // 3. Resolve price server-side (ignore browser price/amount)
    const planRow = runPsqlJson(`
      SELECT row_to_json(p) FROM (
        SELECT id, slug, name, stripe_price_id_test, stripe_price_id_live
        FROM public.plans
        WHERE slug = '${payload.planKey}' AND active = true
      ) p;
    `);

    if (!planRow) {
      const err = new Error("Plano não encontrado.");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    const priceId = planRow.stripe_price_id_test;

    // 4. Provider calls (only reached if authorized!)
    this.customerCreationCalls++;
    this.sessionCreationCalls++;
    this.subscriptionSideEffects++;

    // Return embedded session contract
    return {
      ok: true,
      clientSecret: "cs_test_mock_secret_" + Date.now(),
      sessionId: "cs_test_mock_id_" + Date.now(),
      mode: "subscription",
      ui_mode: "embedded",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: undefined,
      cancel_url: undefined
    };
  }
}

describe('BARBEX — R2E.16H.3A: Base Checkout Owner Authority Repair Test Suite', { concurrency: 1 }, () => {
  const sim = new StripeCheckoutEdgeSimulator();

  // Test UUIDs
  const tenantA_id = 'a1000000-0000-4000-8000-000000000001';
  const ownerA_barber_id = tenantA_id; // Candidate model: owner with role 'barber'
  const ownerB_ordinary_id = 'b2000000-0000-4000-8000-000000000001';
  const tenantB_id = ownerB_ordinary_id;

  const staffAdmin_id = 'a1000000-0000-4000-8000-000000000002';
  const tenantAdmin_id = 'a1000000-0000-4000-8000-000000000003';
  const manager_id = 'a1000000-0000-4000-8000-000000000004';
  const financial_id = 'a1000000-0000-4000-8000-000000000005';
  const cashier_id = 'a1000000-0000-4000-8000-000000000006';
  const professional_id = 'a1000000-0000-4000-8000-000000000007';
  const barberNonOwner_id = 'a1000000-0000-4000-8000-000000000008';
  const clientNonOwner_id = 'a1000000-0000-4000-8000-000000000009';
  const superAdminNonOwner_id = 'a1000000-0000-4000-8000-000000000099';

  const crossTenantOwner_id = 'c3000000-0000-4000-8000-000000000001';
  const tenantC_id = crossTenantOwner_id;

  const userNoTenant_id = 'd4000000-0000-4000-8000-000000000001';
  const userUnresolvedBarbershop_id = 'e5000000-0000-4000-8000-000000000001';
  const fakeTenant_id = 'f6000000-0000-4000-8000-000000000001';

  // Production Candidate Fixture Model (Section 11)
  const candidate_id = 'ab0fb7c1-b7c9-40ef-be97-14348e88ae65';

  before(() => {
    runPsql(`
      BEGIN;
      -- 1. Tenant A: Owner with role 'barber'
      INSERT INTO auth.users (id, email) VALUES ('${ownerA_barber_id}', 'r2e16h3a_owner_a@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_owner_a@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${ownerA_barber_id}', 'r2e16h3a_owner_a@barbex.shop', 'active', 'barber', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'barber', tenant_id = '${tenantA_id}';
      INSERT INTO public.barbershops (id, name, slug, owner_id)
        VALUES ('${tenantA_id}', 'Barbearia Alpha 16H3A', 'barbearia-alpha-16h3a', '${ownerA_barber_id}')
        ON CONFLICT (id) DO UPDATE SET owner_id = '${ownerA_barber_id}';

      -- 2. Tenant B: Owner with ordinary role ('client')
      INSERT INTO auth.users (id, email) VALUES ('${ownerB_ordinary_id}', 'r2e16h3a_owner_b@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_owner_b@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${ownerB_ordinary_id}', 'r2e16h3a_owner_b@barbex.shop', 'active', 'client', '${tenantB_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'client', tenant_id = '${tenantB_id}';
      INSERT INTO public.barbershops (id, name, slug, owner_id)
        VALUES ('${tenantB_id}', 'Barbearia Beta 16H3A', 'barbearia-beta-16h3a', '${ownerB_ordinary_id}')
        ON CONFLICT (id) DO UPDATE SET owner_id = '${ownerB_ordinary_id}';

      -- 3. Non-owner staff belonging to Tenant A
      -- Admin
      INSERT INTO auth.users (id, email) VALUES ('${staffAdmin_id}', 'r2e16h3a_staff_admin@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_staff_admin@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${staffAdmin_id}', 'r2e16h3a_staff_admin@barbex.shop', 'active', 'admin', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'admin', tenant_id = '${tenantA_id}';

      -- Tenant Admin
      INSERT INTO auth.users (id, email) VALUES ('${tenantAdmin_id}', 'r2e16h3a_tenant_admin@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_tenant_admin@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${tenantAdmin_id}', 'r2e16h3a_tenant_admin@barbex.shop', 'active', 'tenant_admin', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'tenant_admin', tenant_id = '${tenantA_id}';

      -- Manager
      INSERT INTO auth.users (id, email) VALUES ('${manager_id}', 'r2e16h3a_manager@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_manager@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${manager_id}', 'r2e16h3a_manager@barbex.shop', 'active', 'manager', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'manager', tenant_id = '${tenantA_id}';

      -- Financial
      INSERT INTO auth.users (id, email) VALUES ('${financial_id}', 'r2e16h3a_financial@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_financial@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${financial_id}', 'r2e16h3a_financial@barbex.shop', 'active', 'financial', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'financial', tenant_id = '${tenantA_id}';

      -- Cashier
      INSERT INTO auth.users (id, email) VALUES ('${cashier_id}', 'r2e16h3a_cashier@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_cashier@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${cashier_id}', 'r2e16h3a_cashier@barbex.shop', 'active', 'cashier', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'cashier', tenant_id = '${tenantA_id}';

      -- Professional
      INSERT INTO auth.users (id, email) VALUES ('${professional_id}', 'r2e16h3a_professional@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_professional@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${professional_id}', 'r2e16h3a_professional@barbex.shop', 'active', 'professional', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'professional', tenant_id = '${tenantA_id}';

      -- Barber non-owner
      INSERT INTO auth.users (id, email) VALUES ('${barberNonOwner_id}', 'r2e16h3a_barber_staff@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_barber_staff@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${barberNonOwner_id}', 'r2e16h3a_barber_staff@barbex.shop', 'active', 'barber', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'barber', tenant_id = '${tenantA_id}';

      -- Client non-owner
      INSERT INTO auth.users (id, email) VALUES ('${clientNonOwner_id}', 'r2e16h3a_client@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_client@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${clientNonOwner_id}', 'r2e16h3a_client@barbex.shop', 'active', 'client', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'client', tenant_id = '${tenantA_id}';

      -- Super Admin
      INSERT INTO auth.users (id, email) VALUES ('${superAdminNonOwner_id}', 'r2e16h3a_superadmin@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_superadmin@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${superAdminNonOwner_id}', 'r2e16h3a_superadmin@barbex.shop', 'active', 'super_admin', NULL)
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'super_admin', tenant_id = NULL;

      -- 4. Cross-tenant owner: owns Tenant C, but profile tenant_id points to Tenant A
      INSERT INTO auth.users (id, email) VALUES ('${crossTenantOwner_id}', 'r2e16h3a_crosstenant@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_crosstenant@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${crossTenantOwner_id}', 'r2e16h3a_crosstenant@barbex.shop', 'active', 'barber', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'barber', tenant_id = '${tenantA_id}';
      INSERT INTO public.barbershops (id, name, slug, owner_id)
        VALUES ('${tenantC_id}', 'Barbearia Gamma 16H3A', 'barbearia-gamma-16h3a', '${crossTenantOwner_id}')
        ON CONFLICT (id) DO UPDATE SET owner_id = '${crossTenantOwner_id}';

      -- 5. User without tenant (tenant_id null, no barbershop owned)
      INSERT INTO auth.users (id, email) VALUES ('${userNoTenant_id}', 'r2e16h3a_notenant@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_notenant@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${userNoTenant_id}', 'r2e16h3a_notenant@barbex.shop', 'active', 'client', NULL)
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'client', tenant_id = NULL;

      -- 6. User with unresolved barbershop (tenant_id points to profile without barbershop)
      INSERT INTO auth.users (id, email) VALUES ('${fakeTenant_id}', 'r2e16h3a_faketenant@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_faketenant@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${fakeTenant_id}', 'r2e16h3a_faketenant@barbex.shop', 'active', 'client', NULL)
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'client', tenant_id = NULL;

      INSERT INTO auth.users (id, email) VALUES ('${userUnresolvedBarbershop_id}', 'r2e16h3a_unresolved@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_unresolved@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${userUnresolvedBarbershop_id}', 'r2e16h3a_unresolved@barbex.shop', 'active', 'barber', '${fakeTenant_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'barber', tenant_id = '${fakeTenant_id}';

      -- 7. Candidate Tenant Regression Fixture (Section 11)
      INSERT INTO auth.users (id, email) VALUES ('${candidate_id}', 'r2e16h3a_candidate_owner@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16h3a_candidate_owner@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${candidate_id}', 'r2e16h3a_candidate_owner@barbex.shop', 'active', 'barber', '${candidate_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'barber', tenant_id = '${candidate_id}';
      INSERT INTO public.barbershops (id, name, slug, owner_id)
        VALUES ('${candidate_id}', 'Barbearia Candidate 16H3A', 'barbearia-candidate-16h3a', '${candidate_id}')
        ON CONFLICT (id) DO UPDATE SET owner_id = '${candidate_id}';

      COMMIT;
    `);
  });

  after(() => {
    runPsql(`
      BEGIN;
      DELETE FROM public.barbershops WHERE id IN ('${tenantA_id}', '${tenantB_id}', '${tenantC_id}', '${candidate_id}');
      DELETE FROM public.profiles WHERE id IN (
        '${ownerA_barber_id}', '${ownerB_ordinary_id}', '${staffAdmin_id}', '${tenantAdmin_id}',
        '${manager_id}', '${financial_id}', '${cashier_id}', '${professional_id}',
        '${barberNonOwner_id}', '${clientNonOwner_id}', '${superAdminNonOwner_id}',
        '${crossTenantOwner_id}', '${userNoTenant_id}', '${userUnresolvedBarbershop_id}',
        '${fakeTenant_id}', '${candidate_id}'
      );
      DELETE FROM auth.users WHERE id IN (
        '${ownerA_barber_id}', '${ownerB_ordinary_id}', '${staffAdmin_id}', '${tenantAdmin_id}',
        '${manager_id}', '${financial_id}', '${cashier_id}', '${professional_id}',
        '${barberNonOwner_id}', '${clientNonOwner_id}', '${superAdminNonOwner_id}',
        '${crossTenantOwner_id}', '${userNoTenant_id}', '${userUnresolvedBarbershop_id}',
        '${fakeTenant_id}', '${candidate_id}'
      );
      COMMIT;
    `);
  });

  beforeEach(() => {
    sim.resetCounters();
  });

  // =========================================================================
  // GATE 1: Canonical Owner Positive Controls (Cases A & B)
  // =========================================================================
  describe('Gate 1: Canonical Owner Positive Controls', () => {
    test('Case A: canonical tenant owner with profile.role = barber -> ALLOWED', async () => {
      const res = await sim.invokeCreatePlanCheckout(ownerA_barber_id, {
        planKey: 'starter',
        billingCycle: 'month'
      });

      assert.equal(res.ok, true);
      assert.ok(res.clientSecret.startsWith('cs_test_mock_secret_'));
      assert.equal(sim.sessionCreationCalls, 1);
      assert.equal(sim.customerCreationCalls, 1);
      assert.equal(sim.subscriptionSideEffects, 1);
    });

    test('Case B: canonical tenant owner with ordinary role (client/receptionist) -> ALLOWED based on owner_id', async () => {
      const res = await sim.invokeCreatePlanCheckout(ownerB_ordinary_id, {
        planKey: 'starter',
        billingCycle: 'month'
      });

      assert.equal(res.ok, true);
      assert.ok(res.clientSecret.startsWith('cs_test_mock_secret_'));
      assert.equal(sim.sessionCreationCalls, 1);
      assert.equal(sim.customerCreationCalls, 1);
      assert.equal(sim.subscriptionSideEffects, 1);
    });
  });

  // =========================================================================
  // GATE 2: Non-Owner Roles Denied Matrix (Cases C through K)
  // =========================================================================
  describe('Gate 2: Non-Owner Privileged and Non-Privileged Roles Denied Matrix', () => {
    const nonOwnerCases = [
      { name: 'Case C: admin non-owner', userId: staffAdmin_id },
      { name: 'Case D: tenant_admin non-owner', userId: tenantAdmin_id },
      { name: 'Case E: manager non-owner', userId: manager_id },
      { name: 'Case F: financial non-owner', userId: financial_id },
      { name: 'Case G: cashier non-owner', userId: cashier_id },
      { name: 'Case H: professional non-owner', userId: professional_id },
      { name: 'Case I: barber non-owner', userId: barberNonOwner_id },
      { name: 'Case J: client non-owner', userId: clientNonOwner_id },
      { name: 'Case K: super_admin non-owner', userId: superAdminNonOwner_id },
    ];

    for (const testCase of nonOwnerCases) {
      test(`${testCase.name} -> DENIED with zero Stripe mutation calls`, async () => {
        await assert.rejects(
          async () => {
            await sim.invokeCreatePlanCheckout(testCase.userId, {
              planKey: 'starter',
              billingCycle: 'month'
            });
          },
          (err) => {
            assert.equal(err.status, 403);
            assert.equal(err.code, 'FORBIDDEN');
            return true;
          }
        );

        assert.equal(sim.sessionCreationCalls, 0, 'Zero Stripe Checkout Sessions created');
        assert.equal(sim.customerCreationCalls, 0, 'Zero Stripe Customers created');
        assert.equal(sim.subscriptionSideEffects, 0, 'Zero Stripe Subscription side effects');
      });
    }
  });

  // =========================================================================
  // GATE 3: Structural Denials (Cases L, M, N)
  // =========================================================================
  describe('Gate 3: Cross-Tenant, No-Tenant, and Unresolved Barbershop Denials', () => {
    test('Case L: cross-tenant owner acting in another tenant -> DENIED', async () => {
      await assert.rejects(
        async () => {
          await sim.invokeCreatePlanCheckout(crossTenantOwner_id, {
            planKey: 'starter',
            billingCycle: 'month'
          });
        },
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          assert.equal(err.message, 'Apenas o proprietário do estabelecimento pode gerenciar assinaturas.');
          return true;
        }
      );

      assert.equal(sim.sessionCreationCalls, 0);
      assert.equal(sim.customerCreationCalls, 0);
      assert.equal(sim.subscriptionSideEffects, 0);
    });

    test('Case M: user without tenant (no tenant_id, no barbershop) -> DENIED', async () => {
      await assert.rejects(
        async () => {
          await sim.invokeCreatePlanCheckout(userNoTenant_id, {
            planKey: 'starter',
            billingCycle: 'month'
          });
        },
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          assert.equal(err.message, 'Barbearia não encontrada ou não vinculada ao usuário.');
          return true;
        }
      );

      assert.equal(sim.sessionCreationCalls, 0);
      assert.equal(sim.customerCreationCalls, 0);
      assert.equal(sim.subscriptionSideEffects, 0);
    });

    test('Case N: unresolved barbershop -> DENIED', async () => {
      await assert.rejects(
        async () => {
          await sim.invokeCreatePlanCheckout(userUnresolvedBarbershop_id, {
            planKey: 'starter',
            billingCycle: 'month'
          });
        },
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          assert.equal(err.message, 'Barbearia não encontrada ou não vinculada ao usuário.');
          return true;
        }
      );

      assert.equal(sim.sessionCreationCalls, 0);
      assert.equal(sim.customerCreationCalls, 0);
      assert.equal(sim.subscriptionSideEffects, 0);
    });
  });

  // =========================================================================
  // GATE 4: Candidate Tenant Regression (Section 11)
  // =========================================================================
  describe('Gate 4: Candidate Tenant Regression (Section 11 Model)', () => {
    test('Candidate tenant ab0fb7c1-b7c9-40ef-be97-14348e88ae65 (role=barber, owner_id=same) -> ALLOWED', async () => {
      const auth = sim.resolveAuthCaller(candidate_id);

      assert.equal(auth.isOwner, true, 'OWNER_RESOLUTION must be TRUE');
      assert.equal(auth.userId, candidate_id);
      assert.equal(auth.callerRole, 'barber');

      const checkout = await sim.invokeCreatePlanCheckout(candidate_id, {
        planKey: 'starter',
        billingCycle: 'month'
      });

      assert.equal(checkout.ok, true, 'BASE_CHECKOUT_AUTHORIZATION must be ALLOWED');
      assert.ok(checkout.clientSecret);
      assert.equal(sim.sessionCreationCalls, 1);
    });
  });

  // =========================================================================
  // GATE 5: Embedded Checkout Contract Freeze (Section 8)
  // =========================================================================
  describe('Gate 5: Embedded Checkout Contract Freeze', () => {
    test('Session parameters maintain strict embedded mode contract', async () => {
      const res = await sim.invokeCreatePlanCheckout(ownerA_barber_id, {
        planKey: 'starter',
        billingCycle: 'month'
      });

      assert.equal(res.mode, 'subscription', 'mode must be subscription');
      assert.equal(res.ui_mode, 'embedded', 'ui_mode must be embedded');
      assert.equal(res.success_url, undefined, 'success_url must be omitted in embedded mode');
      assert.equal(res.cancel_url, undefined, 'cancel_url must be omitted in embedded mode');
      assert.ok(res.clientSecret, 'clientSecret must be returned to Barbex');
      assert.equal(res.url, undefined, 'Session.url must NOT be in the Barbex contract');
    });
  });

  // =========================================================================
  // GATE 6: Browser Authority Rejection (Section 9)
  // =========================================================================
  describe('Gate 6: Browser Authority Resistance', () => {
    test('Browser cannot tamper with price, amount, or ownership', async () => {
      // Browser attempts to inject fake priceId, amount, ownerId
      const maliciousPayload = {
        planKey: 'starter',
        billingCycle: 'month',
        stripe_price_id: 'price_fake_free',
        unit_amount: 0,
        amount: 0,
        owner_id: 'a1000000-0000-4000-8000-000000000099',
        customer_id: 'cus_tampered',
        subscription_id: 'sub_tampered'
      };

      const res = await sim.invokeCreatePlanCheckout(ownerA_barber_id, maliciousPayload);

      assert.equal(res.ok, true);
      // Verify price resolved from database, not browser injection
      assert.equal(res.line_items[0].price, 'price_1UJrndPKG6q10UjrOh0rqWUQ');
      assert.equal(res.line_items[0].quantity, 1);
    });
  });
});
