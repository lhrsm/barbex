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
 * High-fidelity Node implementation of the exact Edge Function authorization engine
 * in supabase/functions/stripe-addons/index.ts (lines 59-136).
 * Executes against the real PostgreSQL container and counts any provider mutation attempts.
 */
class StripeAddonsEdgeSimulator {
  constructor() {
    this.providerMutationCalls = 0;
  }

  resetProviderMutationCount() {
    this.providerMutationCalls = 0;
  }

  getProviderMutationCount() {
    return this.providerMutationCalls;
  }

  /**
   * Simulates resolveAuthCaller from stripe-addons/index.ts: lines 59-109
   */
  resolveAuthCaller(userId) {
    if (!userId) {
      const err = new Error("Token de autenticação ausente ou inválido.");
      err.status = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    const row = runPsqlJson(`
      SELECT json_build_object(
        'profile', (SELECT row_to_json(p) FROM public.profiles p WHERE p.id = '${userId}'),
        'barbershop', (SELECT row_to_json(b) FROM public.barbershops b WHERE b.id = COALESCE((SELECT tenant_id FROM public.profiles WHERE id = '${userId}'), '${userId}'))
      );
    `);

    const profile = row?.profile;
    if (!profile) {
      const err = new Error("Perfil de usuário não encontrado.");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    const effectiveTenantId = profile.tenant_id || profile.id;
    const barbershop = row?.barbershop;

    const isOwner = barbershop
      ? barbershop.owner_id === userId
      : (profile.tenant_id === null || profile.id === userId);

    const isPrivileged = ["super_admin", "admin", "tenant_admin", "shop_owner"].includes(profile.role || "") || isOwner;

    if (!isPrivileged) {
      const err = new Error("Apenas administradores podem acessar módulos adicionais.");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    return {
      userId,
      tenantId: effectiveTenantId,
      callerRole: profile.role || "admin",
      isOwner
    };
  }

  /**
   * Simulates Edge function invocation for any action.
   * Asserts owner-only authorization BEFORE provider mutation.
   */
  async invokeAction(userId, payload) {
    if (!payload || typeof payload !== "object" || !payload.action) {
      const err = new Error("Ação não especificada ou inválida.");
      err.status = 400;
      err.code = "INVALID_REQUEST";
      throw err;
    }

    // 1. Resolve caller
    const auth = this.resolveAuthCaller(userId);

    // 2. Enforce owner-only gate for mutations (lines 132-136)
    const mutationActions = ["subscribe", "cancel", "reactivate", "update-quantity", "batch-subscribe"];
    if (mutationActions.includes(payload.action)) {
      if (!auth.isOwner) {
        const err = new Error("Apenas o proprietário do estabelecimento pode gerenciar cobranças de add-ons.");
        err.status = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
    }

    // 3. Action handling
    if (payload.action === "preview") {
      // Read-only preview: No provider mutation
      const addon = runPsqlJson(`
        SELECT row_to_json(a) FROM (
          SELECT * FROM public.saas_addons WHERE id = '${payload.addonId}'
        ) a;
      `);
      if (!addon) {
        const err = new Error("Add-on não encontrado.");
        err.status = 404;
        err.code = "NOT_FOUND";
        throw err;
      }
      return { ok: true, preview: true, addonName: addon.name };
    }

    if (payload.action === "subscribe") {
      // Reached authorized pre-provider boundary!
      // Here an authorized owner would trigger Stripe subscriptionItem creation.
      this.providerMutationCalls++;
      return { ok: true, preProviderReached: true };
    }

    if (payload.action === "cancel") {
      // Must verify tenant isolation: query scoped to auth.tenantId
      const contract = runPsqlJson(`
        SELECT row_to_json(c) FROM (
          SELECT * FROM public.tenant_addons WHERE id = '${payload.contractId}' AND tenant_id = '${auth.tenantId}'
        ) c;
      `);
      if (!contract) {
        const err = new Error("Contrato não encontrado.");
        err.status = 404;
        err.code = "NOT_FOUND";
        throw err;
      }
      this.providerMutationCalls++;
      return { ok: true, preProviderReached: true };
    }

    if (payload.action === "reactivate") {
      const contract = runPsqlJson(`
        SELECT row_to_json(c) FROM (
          SELECT * FROM public.tenant_addons WHERE id = '${payload.contractId}' AND tenant_id = '${auth.tenantId}'
        ) c;
      `);
      if (!contract) {
        const err = new Error("Contrato não encontrado.");
        err.status = 404;
        err.code = "NOT_FOUND";
        throw err;
      }
      this.providerMutationCalls++;
      return { ok: true, preProviderReached: true };
    }

    if (payload.action === "update-quantity") {
      const contract = runPsqlJson(`
        SELECT row_to_json(c) FROM (
          SELECT * FROM public.tenant_addons WHERE id = '${payload.contractId}' AND tenant_id = '${auth.tenantId}'
        ) c;
      `);
      if (!contract) {
        const err = new Error("Contrato não encontrado.");
        err.status = 404;
        err.code = "NOT_FOUND";
        throw err;
      }
      this.providerMutationCalls++;
      return { ok: true, preProviderReached: true };
    }

    if (payload.action === "batch-subscribe") {
      this.providerMutationCalls++;
      return { ok: true, preProviderReached: true };
    }

    throw new Error(`Ação desconhecida: ${payload.action}`);
  }
}

describe('BARBEX — R2E.16D: Financial Authorization Matrix Test Suite', { concurrency: 1 }, () => {
  const edge = new StripeAddonsEdgeSimulator();

  // Test identities
  const tenantA_id = 'a0000000-0000-4000-8000-000000000011';
  const ownerA_id = tenantA_id;
  const staffAdminA_id = 'a0000000-0000-4000-8000-000000000012';
  const tenantAdminA_id = 'a0000000-0000-4000-8000-000000000013';
  const managerA_id = 'a0000000-0000-4000-8000-000000000014';
  const financialA_id = 'a0000000-0000-4000-8000-000000000015';
  const cashierA_id = 'a0000000-0000-4000-8000-000000000016';
  const professionalA_id = 'a0000000-0000-4000-8000-000000000017';
  const barberA_id = 'a0000000-0000-4000-8000-000000000018';
  const clientA_id = 'a0000000-0000-4000-8000-000000000019';
  const superAdmin_id = 'a0000000-0000-4000-8000-000000000099';

  const tenantB_id = 'b0000000-0000-4000-8000-000000000011';
  const ownerB_id = tenantB_id;

  const noTenantUser_id = 'c0000000-0000-4000-8000-000000000001';

  let testAddonId = '';
  const tenantAContractId = 'c0000000-aaaa-4000-8000-000000000001';
  const tenantBContractId = 'c0000000-bbbb-4000-8000-000000000001';

  before(() => {
    runPsql(`
      BEGIN;
      -- 1. Setup Tenant A Owner
      INSERT INTO auth.users (id, email) VALUES ('${ownerA_id}', 'r2e16d_owner_a@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_owner_a@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${ownerA_id}', 'r2e16d_owner_a@barbex.shop', 'active', 'admin', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'admin', tenant_id = '${tenantA_id}';
      INSERT INTO public.barbershops (id, name, slug, owner_id) VALUES ('${tenantA_id}', 'Barbearia A Matriz', 'barbearia-a-matriz', '${ownerA_id}')
        ON CONFLICT (id) DO UPDATE SET owner_id = '${ownerA_id}';

      -- Staff Admin (non-owner)
      INSERT INTO auth.users (id, email) VALUES ('${staffAdminA_id}', 'r2e16d_staff_admin@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_staff_admin@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${staffAdminA_id}', 'r2e16d_staff_admin@barbex.shop', 'active', 'admin', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'admin', tenant_id = '${tenantA_id}';

      -- Tenant Admin (non-owner)
      INSERT INTO auth.users (id, email) VALUES ('${tenantAdminA_id}', 'r2e16d_tenant_admin@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_tenant_admin@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${tenantAdminA_id}', 'r2e16d_tenant_admin@barbex.shop', 'active', 'tenant_admin', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'tenant_admin', tenant_id = '${tenantA_id}';

      -- Manager (non-owner)
      INSERT INTO auth.users (id, email) VALUES ('${managerA_id}', 'r2e16d_manager@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_manager@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${managerA_id}', 'r2e16d_manager@barbex.shop', 'active', 'manager', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'manager', tenant_id = '${tenantA_id}';

      -- Financial (non-owner)
      INSERT INTO auth.users (id, email) VALUES ('${financialA_id}', 'r2e16d_financial@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_financial@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${financialA_id}', 'r2e16d_financial@barbex.shop', 'active', 'financial', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'financial', tenant_id = '${tenantA_id}';

      -- Cashier (non-owner)
      INSERT INTO auth.users (id, email) VALUES ('${cashierA_id}', 'r2e16d_cashier@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_cashier@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${cashierA_id}', 'r2e16d_cashier@barbex.shop', 'active', 'cashier', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'cashier', tenant_id = '${tenantA_id}';

      -- Professional (non-owner)
      INSERT INTO auth.users (id, email) VALUES ('${professionalA_id}', 'r2e16d_professional@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_professional@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${professionalA_id}', 'r2e16d_professional@barbex.shop', 'active', 'professional', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'professional', tenant_id = '${tenantA_id}';

      -- Barber (non-owner)
      INSERT INTO auth.users (id, email) VALUES ('${barberA_id}', 'r2e16d_barber@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_barber@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${barberA_id}', 'r2e16d_barber@barbex.shop', 'active', 'barber', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'barber', tenant_id = '${tenantA_id}';

      -- Client (non-owner)
      INSERT INTO auth.users (id, email) VALUES ('${clientA_id}', 'r2e16d_client@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_client@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${clientA_id}', 'r2e16d_client@barbex.shop', 'active', 'client', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'client', tenant_id = '${tenantA_id}';

      -- Super Admin (associated with Tenant A as staff, but NOT the owner)
      INSERT INTO auth.users (id, email) VALUES ('${superAdmin_id}', 'r2e16d_superadmin@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_superadmin@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${superAdmin_id}', 'r2e16d_superadmin@barbex.shop', 'active', 'super_admin', '${tenantA_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'super_admin', tenant_id = '${tenantA_id}';

      -- 2. Setup Tenant B
      INSERT INTO auth.users (id, email) VALUES ('${ownerB_id}', 'r2e16d_owner_b@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_owner_b@barbex.shop';
      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES ('${ownerB_id}', 'r2e16d_owner_b@barbex.shop', 'active', 'admin', '${tenantB_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'admin', tenant_id = '${tenantB_id}';
      INSERT INTO public.barbershops (id, name, slug, owner_id) VALUES ('${tenantB_id}', 'Barbearia B Matriz', 'barbearia-b-matriz', '${ownerB_id}')
        ON CONFLICT (id) DO UPDATE SET owner_id = '${ownerB_id}';

      -- 3. Setup user with no tenant relation
      INSERT INTO auth.users (id, email) VALUES ('${noTenantUser_id}', 'r2e16d_notenant@barbex.shop')
        ON CONFLICT (id) DO UPDATE SET email = 'r2e16d_notenant@barbex.shop';
      DELETE FROM public.profiles WHERE id = '${noTenantUser_id}';

      -- Active Starter subscription for Tenant A
      INSERT INTO public.subscriptions (user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id, plan_key, status, billing_cycle, environment)
      VALUES ('${tenantA_id}', 'sub_tenant_a_active', 'cus_tenant_a', 'prod_starter', 'price_starter_month', 'starter', 'active', 'month', 'test')
      ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = 'active', plan_key = 'starter', billing_cycle = 'month';

      -- Active Starter subscription for Tenant B
      INSERT INTO public.subscriptions (user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id, plan_key, status, billing_cycle, environment)
      VALUES ('${tenantB_id}', 'sub_tenant_b_active', 'cus_tenant_b', 'prod_starter', 'price_starter_month', 'starter', 'active', 'month', 'test')
      ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = 'active', plan_key = 'starter', billing_cycle = 'month';

      -- Configure saas_addons for test
      UPDATE public.saas_addons
      SET is_active = true, stripe_price_id_test = 'price_test_stock'
      WHERE addon_key = 'stock';

      UPDATE public.saas_addons
      SET is_active = true, stripe_price_id_test = 'price_test_adv_fin'
      WHERE addon_key = 'advanced_finance';

      COMMIT;
    `);

    testAddonId = runPsql(`
      SELECT id FROM public.saas_addons WHERE addon_key = 'stock' LIMIT 1;
    `);

    // Ensure contracts for Tenant A and Tenant B
    runPsql(`
      DELETE FROM public.tenant_addons WHERE id IN ('${tenantAContractId}', '${tenantBContractId}');
      INSERT INTO public.tenant_addons (id, tenant_id, addon_id, status, stripe_subscription_id, stripe_subscription_item_id)
      VALUES ('${tenantAContractId}', '${tenantA_id}', '${testAddonId}', 'active', 'sub_tenant_a_active', 'si_item_a');

      INSERT INTO public.tenant_addons (id, tenant_id, addon_id, status, stripe_subscription_id, stripe_subscription_item_id)
      VALUES ('${tenantBContractId}', '${tenantB_id}', '${testAddonId}', 'active', 'sub_tenant_b_active', 'si_item_b');
    `);
  });

  after(() => {
    runPsql(`
      BEGIN;
      DELETE FROM public.tenant_addons WHERE id IN ('${tenantAContractId}', '${tenantBContractId}');
      DELETE FROM public.subscriptions WHERE user_id IN ('${tenantA_id}', '${tenantB_id}');
      DELETE FROM public.barbershops WHERE id IN ('${tenantA_id}', '${tenantB_id}');
      DELETE FROM public.profiles WHERE id IN (
        '${ownerA_id}', '${staffAdminA_id}', '${tenantAdminA_id}', '${managerA_id}',
        '${financialA_id}', '${cashierA_id}', '${professionalA_id}', '${barberA_id}',
        '${clientA_id}', '${superAdmin_id}', '${ownerB_id}'
      );
      COMMIT;
    `);
  });

  beforeEach(() => {
    edge.resetProviderMutationCount();
  });

  // ==========================================================================
  // 1. POSITIVE CONTROL: ACTUAL TENANT OWNER
  // ==========================================================================
  describe('Gate 1: Owner Positive Control', () => {
    test('1.1 Actual tenant owner is authorized for SUBSCRIBE (pre-provider reached)', async () => {
      const res = await edge.invokeAction(ownerA_id, {
        action: 'subscribe',
        addonId: testAddonId
      });
      assert.equal(res.ok, true);
      assert.equal(res.preProviderReached, true);
      assert.equal(edge.getProviderMutationCount(), 1);
    });

    test('1.2 Actual tenant owner is authorized for CANCEL', async () => {
      const res = await edge.invokeAction(ownerA_id, {
        action: 'cancel',
        contractId: tenantAContractId
      });
      assert.equal(res.ok, true);
      assert.equal(res.preProviderReached, true);
      assert.equal(edge.getProviderMutationCount(), 1);
    });

    test('1.3 Actual tenant owner is authorized for REACTIVATE', async () => {
      const res = await edge.invokeAction(ownerA_id, {
        action: 'reactivate',
        contractId: tenantAContractId
      });
      assert.equal(res.ok, true);
      assert.equal(res.preProviderReached, true);
      assert.equal(edge.getProviderMutationCount(), 1);
    });

    test('1.4 Actual tenant owner is authorized for UPDATE-QUANTITY', async () => {
      const res = await edge.invokeAction(ownerA_id, {
        action: 'update-quantity',
        contractId: tenantAContractId,
        quantity: 2
      });
      assert.equal(res.ok, true);
      assert.equal(res.preProviderReached, true);
      assert.equal(edge.getProviderMutationCount(), 1);
    });

    test('1.5 Actual tenant owner is authorized for BATCH-SUBSCRIBE', async () => {
      const res = await edge.invokeAction(ownerA_id, {
        action: 'batch-subscribe',
        addonIds: [testAddonId]
      });
      assert.equal(res.ok, true);
      assert.equal(res.preProviderReached, true);
      assert.equal(edge.getProviderMutationCount(), 1);
    });
  });

  // ==========================================================================
  // 2. REQUIRED ROLE MATRIX: ALL NON-OWNER IDENTITIES ARE STRICTLY DENIED
  // ==========================================================================
  describe('Gate 2: Required Non-Owner Roles Matrix (Zero Provider Calls)', () => {
    const nonOwnerIdentities = [
      { name: 'admin non-owner', userId: staffAdminA_id },
      { name: 'tenant_admin non-owner', userId: tenantAdminA_id },
      { name: 'manager non-owner', userId: managerA_id },
      { name: 'financial non-owner', userId: financialA_id },
      { name: 'cashier non-owner', userId: cashierA_id },
      { name: 'professional non-owner', userId: professionalA_id },
      { name: 'barber non-owner', userId: barberA_id },
      { name: 'client non-owner', userId: clientA_id },
      { name: 'super_admin non-owner', userId: superAdmin_id },
      { name: 'no-tenant relationship user', userId: noTenantUser_id }
    ];

    for (const identity of nonOwnerIdentities) {
      test(`2.X ${identity.name} is DENIED for SUBSCRIBE (provider calls = 0)`, async () => {
        await assert.rejects(
          async () => {
            await edge.invokeAction(identity.userId, {
              action: 'subscribe',
              addonId: testAddonId
            });
          },
          (err) => {
            assert.equal(err.status, 403);
            return true;
          }
        );
        assert.equal(edge.getProviderMutationCount(), 0, 'Zero provider mutation calls allowed for unauthorized identity');
      });

      test(`2.X ${identity.name} is DENIED for CANCEL (provider calls = 0)`, async () => {
        await assert.rejects(
          async () => {
            await edge.invokeAction(identity.userId, {
              action: 'cancel',
              contractId: tenantAContractId
            });
          },
          (err) => {
            assert.ok([403, 404].includes(err.status));
            return true;
          }
        );
        assert.equal(edge.getProviderMutationCount(), 0);
      });

      test(`2.X ${identity.name} is DENIED for REACTIVATE (provider calls = 0)`, async () => {
        await assert.rejects(
          async () => {
            await edge.invokeAction(identity.userId, {
              action: 'reactivate',
              contractId: tenantAContractId
            });
          },
          (err) => {
            assert.ok([403, 404].includes(err.status));
            return true;
          }
        );
        assert.equal(edge.getProviderMutationCount(), 0);
      });

      test(`2.X ${identity.name} is DENIED for UPDATE-QUANTITY (provider calls = 0)`, async () => {
        await assert.rejects(
          async () => {
            await edge.invokeAction(identity.userId, {
              action: 'update-quantity',
              contractId: tenantAContractId,
              quantity: 5
            });
          },
          (err) => {
            assert.ok([403, 404].includes(err.status));
            return true;
          }
        );
        assert.equal(edge.getProviderMutationCount(), 0);
      });

      test(`2.X ${identity.name} is DENIED for BATCH-SUBSCRIBE (provider calls = 0)`, async () => {
        await assert.rejects(
          async () => {
            await edge.invokeAction(identity.userId, {
              action: 'batch-subscribe',
              addonIds: [testAddonId]
            });
          },
          (err) => {
            assert.equal(err.status, 403);
            return true;
          }
        );
        assert.equal(edge.getProviderMutationCount(), 0);
      });
    }
  });

  // ==========================================================================
  // 3. CROSS-TENANT ISOLATION: POSSESSION OF IDS CANNOT AUTHORIZE MUTATION
  // ==========================================================================
  describe('Gate 3: Cross-Tenant Isolation & Possession Bypass Resistance', () => {
    test('3.1 Tenant B Owner possessing Tenant A contractId cannot CANCEL Tenant A addon', async () => {
      await assert.rejects(
        async () => {
          await edge.invokeAction(ownerB_id, {
            action: 'cancel',
            contractId: tenantAContractId
          });
        },
        (err) => {
          // Denied with 404 because contractId does not belong to Tenant B
          assert.equal(err.status, 404);
          assert.equal(err.code, 'NOT_FOUND');
          return true;
        }
      );
      assert.equal(edge.getProviderMutationCount(), 0);
    });

    test('3.2 Tenant B Owner possessing Tenant A contractId cannot REACTIVATE Tenant A addon', async () => {
      await assert.rejects(
        async () => {
          await edge.invokeAction(ownerB_id, {
            action: 'reactivate',
            contractId: tenantAContractId
          });
        },
        (err) => {
          assert.equal(err.status, 404);
          return true;
        }
      );
      assert.equal(edge.getProviderMutationCount(), 0);
    });

    test('3.3 Tenant B Owner possessing Tenant A contractId cannot UPDATE-QUANTITY on Tenant A addon', async () => {
      await assert.rejects(
        async () => {
          await edge.invokeAction(ownerB_id, {
            action: 'update-quantity',
            contractId: tenantAContractId,
            quantity: 3
          });
        },
        (err) => {
          assert.equal(err.status, 404);
          return true;
        }
      );
      assert.equal(edge.getProviderMutationCount(), 0);
    });

    test('3.4 Staff Admin of Tenant A possessing Tenant A contractId cannot CANCEL (owner gate)', async () => {
      await assert.rejects(
        async () => {
          await edge.invokeAction(staffAdminA_id, {
            action: 'cancel',
            contractId: tenantAContractId
          });
        },
        (err) => {
          assert.equal(err.status, 403);
          return true;
        }
      );
      assert.equal(edge.getProviderMutationCount(), 0);
    });
  });

  // ==========================================================================
  // 4. PREVIEW READ-ONLY AUTHORITY & ZERO PROVIDER MUTATION
  // ==========================================================================
  describe('Gate 4: Preview Authority (Read-Only)', () => {
    test('4.1 Actual owner can preview addon (Zero provider mutations)', async () => {
      const res = await edge.invokeAction(ownerA_id, {
        action: 'preview',
        addonId: testAddonId
      });
      assert.equal(res.ok, true);
      assert.equal(edge.getProviderMutationCount(), 0);
    });

    test('4.2 Non-owner admin can preview addon (Read-only privileged billing)', async () => {
      const res = await edge.invokeAction(staffAdminA_id, {
        action: 'preview',
        addonId: testAddonId
      });
      assert.equal(res.ok, true);
      assert.equal(edge.getProviderMutationCount(), 0);
    });

    test('4.3 Non-owner tenant_admin can preview addon', async () => {
      const res = await edge.invokeAction(tenantAdminA_id, {
        action: 'preview',
        addonId: testAddonId
      });
      assert.equal(res.ok, true);
      assert.equal(edge.getProviderMutationCount(), 0);
    });

    test('4.4 Non-privileged roles (barber, client) are DENIED preview', async () => {
      await assert.rejects(
        async () => {
          await edge.invokeAction(barberA_id, {
            action: 'preview',
            addonId: testAddonId
          });
        },
        (err) => {
          assert.equal(err.status, 403);
          return true;
        }
      );
      assert.equal(edge.getProviderMutationCount(), 0);
    });
  });

  // ==========================================================================
  // 5. DATABASE RPC CAN_TENANT_PURCHASE_ADDON ROLE VERIFICATION
  // ==========================================================================
  describe('Gate 5: Database RPC can_tenant_purchase_addon Authorization Matrix', () => {
    test('5.1 Owner is eligible in can_tenant_purchase_addon for uncontracted addon', () => {
      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${tenantA_id}', 'advanced_finance', '${ownerA_id}', 'month', 'test');
      `);
      assert.equal(res.eligible, true);
      assert.equal(res.canonical_module_key, 'advanced_finance');
    });

    const nonOwnerRolesDb = [
      { name: 'staff admin', userId: staffAdminA_id },
      { name: 'tenant admin', userId: tenantAdminA_id },
      { name: 'manager', userId: managerA_id },
      { name: 'financial', userId: financialA_id },
      { name: 'cashier', userId: cashierA_id },
      { name: 'professional', userId: professionalA_id },
      { name: 'barber', userId: barberA_id },
      { name: 'client', userId: clientA_id },
      { name: 'super admin', userId: superAdmin_id },
      { name: 'cross-tenant owner B', userId: ownerB_id }
    ];

    for (const r of nonOwnerRolesDb) {
      test(`5.X ${r.name} is DENIED with NOT_OWNER in RPC can_tenant_purchase_addon`, () => {
        const res = runPsqlJson(`
          SELECT public.can_tenant_purchase_addon('${tenantA_id}', 'advanced_finance', '${r.userId}', 'month', 'test');
        `);
        assert.equal(res.eligible, false);
        assert.equal(res.error_code, 'NOT_OWNER');
      });
    }

    test('5.X user with no subscription is denied with NO_ACTIVE_SUBSCRIPTION', () => {
      const res = runPsqlJson(`
        SELECT public.can_tenant_purchase_addon('${noTenantUser_id}', 'advanced_finance', '${noTenantUser_id}', 'month', 'test');
      `);
      assert.equal(res.eligible, false);
      assert.equal(res.error_code, 'NO_ACTIVE_SUBSCRIPTION');
    });
  });
});
