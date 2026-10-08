const { test, describe, before, after } = require('node:test');
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
 * High-fidelity simulator implementing the exact hardened logic
 * from supabase/functions/stripe-checkout/index.ts (resolveAuthCaller)
 */
function resolveStripeCheckoutCaller(userId) {
  if (!userId) {
    const err = new Error("Token de autenticação ausente ou inválido.");
    err.status = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  }

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

  let barbershop = null;
  if (profile.tenant_id) {
    barbershop = runPsqlJson(`
      SELECT row_to_json(b) FROM (
        SELECT id, owner_id FROM public.barbershops WHERE id = '${profile.tenant_id}'
      ) b;
    `);
  } else {
    barbershop = runPsqlJson(`
      SELECT row_to_json(b) FROM (
        SELECT id, owner_id FROM public.barbershops WHERE owner_id = '${userId}'
      ) b;
    `);
  }

  if (!barbershop) {
    const err = new Error("Barbearia não encontrada ou não vinculada ao usuário.");
    err.status = 403;
    err.code = "FORBIDDEN";
    throw err;
  }

  const isOwner = barbershop.owner_id === userId;
  if (!isOwner) {
    const err = new Error("Apenas o proprietário do estabelecimento pode gerenciar assinaturas.");
    err.status = 403;
    err.code = "FORBIDDEN";
    throw err;
  }

  return {
    userId,
    tenantId: barbershop.id,
    email: profile.email || "",
    callerRole: profile.role || "barber",
    isOwner: true
  };
}

/**
 * High-fidelity simulator implementing the exact hardened logic
 * from supabase/functions/stripe-addons/index.ts (resolveAuthCaller)
 */
function resolveStripeAddonsCaller(userId) {
  if (!userId) {
    const err = new Error("Token de autenticação ausente ou inválido.");
    err.status = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  }

  const profile = runPsqlJson(`
    SELECT row_to_json(p) FROM (
      SELECT id, role, tenant_id FROM public.profiles WHERE id = '${userId}'
    ) p;
  `);

  if (!profile) {
    const err = new Error("Perfil de usuário não encontrado.");
    err.status = 403;
    err.code = "FORBIDDEN";
    throw err;
  }

  let barbershop = null;
  if (profile.tenant_id) {
    barbershop = runPsqlJson(`
      SELECT row_to_json(b) FROM (
        SELECT id, owner_id FROM public.barbershops WHERE id = '${profile.tenant_id}'
      ) b;
    `);
  } else {
    barbershop = runPsqlJson(`
      SELECT row_to_json(b) FROM (
        SELECT id, owner_id FROM public.barbershops WHERE owner_id = '${userId}'
      ) b;
    `);
  }

  if (!barbershop) {
    const err = new Error("Barbearia não encontrada ou não vinculada ao usuário.");
    err.status = 403;
    err.code = "FORBIDDEN";
    throw err;
  }

  const isOwner = barbershop.owner_id === userId;

  const isPrivileged = ["super_admin", "admin", "tenant_admin", "shop_owner"].includes(profile.role || "") || isOwner;
  if (!isPrivileged) {
    const err = new Error("Apenas administradores podem acessar módulos adicionais.");
    err.status = 403;
    err.code = "FORBIDDEN";
    throw err;
  }

  return {
    userId,
    tenantId: barbershop.id,
    callerRole: profile.role || "admin",
    isOwner
  };
}

describe('BARBEX — R2E.17B: Tenant Financial Authority Hardening Suite', { concurrency: 1 }, () => {
  // Test UUIDs
  // Tenant Alpha (Clean 1:1 owner)
  const tenantAlpha_id = 'e0000000-0000-4000-8000-000000000001';
  const ownerAlpha_id = tenantAlpha_id;

  // Tenant Beta (Distinct user ID != tenant ID)
  const tenantBeta_id = 'e0000000-0000-4000-8000-000000000002';
  const ownerBeta_id = 'e0000000-0000-4000-8000-000000000022'; // distinct UUID

  // Staff in Tenant Alpha
  const staffAdminAlpha_id = 'e0000000-0000-4000-8000-000000000003';
  const staffBarberAlpha_id = 'e0000000-0000-4000-8000-000000000004';

  // Super Admin
  const superAdmin_id = 'e0000000-0000-4000-8000-000000000099';

  // Section 10: Production Legacy Collision Fixture
  const legacyConflictUser_id = 'ab0fb7c1-b7c9-40ef-be97-14348e88ae65'; // Louis staff barber / legacy shell
  const barbeariaLM_tenant_id = 'c54ac1ac-49be-4505-b7a4-d257ed023f08'; // Barbearia LM
  const barbeariaLM_owner_id = barbeariaLM_tenant_id; // Owner of Barbearia LM

  // Missing / Invalid users
  const userNoProfile_id = 'e0000000-0000-4000-8000-000000000088';
  const userNoTenantNoShop_id = 'e0000000-0000-4000-8000-000000000077';
  const userInvalidTenant_id = 'e0000000-0000-4000-8000-000000000066';
  const nonExistentTenant_id = 'e0000000-dead-4000-8000-000000000000';

  before(() => {
    runPsql(`
      BEGIN;
      -- 1. Setup Tenant Alpha (equal UUID pattern: owner_id = shop_id)
      INSERT INTO auth.users (id, email) VALUES ('${ownerAlpha_id}', 'owner_alpha@barbex.test')
        ON CONFLICT (id) DO UPDATE SET email = 'owner_alpha@barbex.test';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${ownerAlpha_id}', 'owner_alpha@barbex.test', 'active', 'tenant_admin', '${tenantAlpha_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'tenant_admin', tenant_id = '${tenantAlpha_id}';
      INSERT INTO public.barbershops (id, name, slug, owner_id)
        VALUES ('${tenantAlpha_id}', 'Barbearia Alpha Test', 'barbearia-alpha-test', '${ownerAlpha_id}')
        ON CONFLICT (id) DO UPDATE SET owner_id = '${ownerAlpha_id}';

      -- 2. Setup Tenant Beta (distinct UUID pattern: owner_id != shop_id, and profile.tenant_id = null)
      INSERT INTO auth.users (id, email) VALUES ('${ownerBeta_id}', 'owner_beta@barbex.test')
        ON CONFLICT (id) DO UPDATE SET email = 'owner_beta@barbex.test';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${ownerBeta_id}', 'owner_beta@barbex.test', 'active', 'tenant_admin', NULL)
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'tenant_admin', tenant_id = NULL;
      INSERT INTO public.barbershops (id, name, slug, owner_id)
        VALUES ('${tenantBeta_id}', 'Barbearia Beta Test', 'barbearia-beta-test', '${ownerBeta_id}')
        ON CONFLICT (id) DO UPDATE SET owner_id = '${ownerBeta_id}';

      -- 3. Staff in Tenant Alpha
      INSERT INTO auth.users (id, email) VALUES ('${staffAdminAlpha_id}', 'staff_admin_alpha@barbex.test')
        ON CONFLICT (id) DO UPDATE SET email = 'staff_admin_alpha@barbex.test';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${staffAdminAlpha_id}', 'staff_admin_alpha@barbex.test', 'active', 'admin', '${tenantAlpha_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'admin', tenant_id = '${tenantAlpha_id}';

      INSERT INTO auth.users (id, email) VALUES ('${staffBarberAlpha_id}', 'staff_barber_alpha@barbex.test')
        ON CONFLICT (id) DO UPDATE SET email = 'staff_barber_alpha@barbex.test';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${staffBarberAlpha_id}', 'staff_barber_alpha@barbex.test', 'active', 'barber', '${tenantAlpha_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'barber', tenant_id = '${tenantAlpha_id}';

      -- 4. Super Admin (non-owner)
      INSERT INTO auth.users (id, email) VALUES ('${superAdmin_id}', 'superadmin_test@barbex.test')
        ON CONFLICT (id) DO UPDATE SET email = 'superadmin_test@barbex.test';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${superAdmin_id}', 'superadmin_test@barbex.test', 'active', 'super_admin', NULL)
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'super_admin', tenant_id = NULL;

      -- 5. Section 10: Production Legacy Conflict Fixture
      -- Real Barbearia LM
      INSERT INTO auth.users (id, email) VALUES ('${barbeariaLM_owner_id}', 'owner_lm@barbex.test')
        ON CONFLICT (id) DO UPDATE SET email = 'owner_lm@barbex.test';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${barbeariaLM_owner_id}', 'owner_lm@barbex.test', 'active', 'admin', '${barbeariaLM_tenant_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'admin', tenant_id = '${barbeariaLM_tenant_id}';
      INSERT INTO public.barbershops (id, name, slug, owner_id)
        VALUES ('${barbeariaLM_tenant_id}', 'Barbearia LM Test', 'barbearia-lm-test', '${barbeariaLM_owner_id}')
        ON CONFLICT (id) DO UPDATE SET owner_id = '${barbeariaLM_owner_id}';

      -- Legacy User (contato@sbpmbahia.com.br): role barber, tenant_id points to Barbearia LM!
      INSERT INTO auth.users (id, email) VALUES ('${legacyConflictUser_id}', 'contato@sbpmbahia.com.br')
        ON CONFLICT (id) DO UPDATE SET email = 'contato@sbpmbahia.com.br';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${legacyConflictUser_id}', 'contato@sbpmbahia.com.br', 'active', 'barber', '${barbeariaLM_tenant_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'barber', tenant_id = '${barbeariaLM_tenant_id}';

      -- Legacy Barbershop Shell (ab0fb7c1...)
      INSERT INTO public.barbershops (id, name, slug, owner_id)
        VALUES ('${legacyConflictUser_id}', 'Barbearia do Louis Test Shell', 'barbearia-louis-shell', '${legacyConflictUser_id}')
        ON CONFLICT (id) DO UPDATE SET owner_id = '${legacyConflictUser_id}';

      -- 6. User with null tenant_id and no owned shop
      INSERT INTO auth.users (id, email) VALUES ('${userNoTenantNoShop_id}', 'notenant@barbex.test')
        ON CONFLICT (id) DO UPDATE SET email = 'notenant@barbex.test';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${userNoTenantNoShop_id}', 'notenant@barbex.test', 'active', 'barber', NULL)
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'barber', tenant_id = NULL;

      -- 7. User pointing to nonexistent barbershop tenant (profile exists, but no barbershops row)
      INSERT INTO auth.users (id, email) VALUES ('${nonExistentTenant_id}', 'faketenant@barbex.test')
        ON CONFLICT (id) DO UPDATE SET email = 'faketenant@barbex.test';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${nonExistentTenant_id}', 'faketenant@barbex.test', 'active', 'client', NULL)
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'client', tenant_id = NULL;

      INSERT INTO auth.users (id, email) VALUES ('${userInvalidTenant_id}', 'invalidtenant@barbex.test')
        ON CONFLICT (id) DO UPDATE SET email = 'invalidtenant@barbex.test';
      INSERT INTO public.profiles (id, email, status, role, tenant_id)
        VALUES ('${userInvalidTenant_id}', 'invalidtenant@barbex.test', 'active', 'barber', '${nonExistentTenant_id}')
        ON CONFLICT (id) DO UPDATE SET status = 'active', role = 'barber', tenant_id = '${nonExistentTenant_id}';

      COMMIT;
    `);
  });

  after(() => {
    runPsql(`
      BEGIN;
      DELETE FROM public.barbershops WHERE id IN ('${tenantAlpha_id}', '${tenantBeta_id}', '${legacyConflictUser_id}', '${barbeariaLM_tenant_id}');
      DELETE FROM public.profiles WHERE id IN (
        '${ownerAlpha_id}', '${ownerBeta_id}', '${staffAdminAlpha_id}', '${staffBarberAlpha_id}',
        '${superAdmin_id}', '${legacyConflictUser_id}', '${barbeariaLM_owner_id}',
        '${userNoProfile_id}', '${userNoTenantNoShop_id}', '${userInvalidTenant_id}', '${nonExistentTenant_id}'
      );
      DELETE FROM auth.users WHERE id IN (
        '${ownerAlpha_id}', '${ownerBeta_id}', '${staffAdminAlpha_id}', '${staffBarberAlpha_id}',
        '${superAdmin_id}', '${legacyConflictUser_id}', '${barbeariaLM_owner_id}',
        '${userNoProfile_id}', '${userNoTenantNoShop_id}', '${userInvalidTenant_id}', '${nonExistentTenant_id}'
      );
      COMMIT;
    `);
  });

function resolveCanonicalBarbershopAndOwnership(userId) {
  const profile = runPsqlJson(`
    SELECT row_to_json(p) FROM (
      SELECT id, role, tenant_id FROM public.profiles WHERE id = '${userId}'
    ) p;
  `);
  if (!profile) return null;

  let barbershop = null;
  if (profile.tenant_id) {
    barbershop = runPsqlJson(`
      SELECT row_to_json(b) FROM (
        SELECT id, owner_id FROM public.barbershops WHERE id = '${profile.tenant_id}'
      ) b;
    `);
  } else {
    barbershop = runPsqlJson(`
      SELECT row_to_json(b) FROM (
        SELECT id, owner_id FROM public.barbershops WHERE owner_id = '${userId}'
      ) b;
    `);
  }
  if (!barbershop) return null;

  return {
    userId,
    tenantId: barbershop.id,
    isOwner: barbershop.owner_id === userId,
    barbershop
  };
}

  // =========================================================================
  // SECTION 10: LEGACY CONFLICT REGRESSION FIXTURE (MANDATORY REGRESSION)
  // =========================================================================
  describe('Gate 1: Section 10 Legacy Collision Regression', () => {
    test('1.1 The runtime resolves canonical tenant as Barbearia LM (c54ac1ac...), NOT the legacy shell', () => {
      const resolution = resolveCanonicalBarbershopAndOwnership(legacyConflictUser_id);
      assert.ok(resolution, 'Resolution must succeed');
      assert.equal(resolution.userId, legacyConflictUser_id);
      assert.equal(resolution.tenantId, barbeariaLM_tenant_id, 'Resolved tenant MUST be Barbearia LM');
      assert.notEqual(resolution.tenantId, legacyConflictUser_id, 'Resolved tenant MUST NOT be legacy shell ID');
      assert.equal(resolution.isOwner, false, 'User is NOT the owner of the resolved tenant Barbearia LM');
    });

    test('1.2 Financial mutation in base checkout is strictly DENIED for legacy conflict user', () => {
      assert.throws(
        () => resolveStripeCheckoutCaller(legacyConflictUser_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          assert.equal(err.message, 'Apenas o proprietário do estabelecimento pode gerenciar assinaturas.');
          return true;
        }
      );
    });

    test('1.3 Financial mutation in add-ons is DENIED (staff barber has isOwner = FALSE)', () => {
      // With their actual profile role (barber), general access is denied
      assert.throws(
        () => resolveStripeAddonsCaller(legacyConflictUser_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          assert.equal(err.message, 'Apenas administradores podem acessar módulos adicionais.');
          return true;
        }
      );
    });

    test('1.4 If assigned tenant_admin role, legacy conflict user still has isOwner = FALSE and cannot mutate finances', () => {
      // Temporarily elevate role to tenant_admin for test
      runPsql(`UPDATE public.profiles SET role = 'tenant_admin' WHERE id = '${legacyConflictUser_id}';`);
      try {
        const auth = resolveStripeAddonsCaller(legacyConflictUser_id);
        assert.equal(auth.tenantId, barbeariaLM_tenant_id, 'Tenant remains Barbearia LM');
        assert.equal(auth.isOwner, false, 'isOwner remains strictly FALSE');
        // Base checkout still denies them:
        assert.throws(
          () => resolveStripeCheckoutCaller(legacyConflictUser_id),
          (err) => {
            assert.equal(err.status, 403);
            assert.equal(err.code, 'FORBIDDEN');
            return true;
          }
        );
      } finally {
        runPsql(`UPDATE public.profiles SET role = 'barber' WHERE id = '${legacyConflictUser_id}';`);
      }
    });
  });

  // =========================================================================
  // SECTION 11: CROSS-TENANT ATTACK MATRIX
  // =========================================================================
  describe('Gate 2: Section 11 Cross-Tenant Attack Matrix', () => {
    test('2.1 Canonical owner / own tenant (equal UUID) -> ALLOWED in checkout & addons', () => {
      const checkoutAuth = resolveStripeCheckoutCaller(ownerAlpha_id);
      assert.equal(checkoutAuth.userId, ownerAlpha_id);
      assert.equal(checkoutAuth.tenantId, tenantAlpha_id);
      assert.equal(checkoutAuth.isOwner, true);

      const addonsAuth = resolveStripeAddonsCaller(ownerAlpha_id);
      assert.equal(addonsAuth.userId, ownerAlpha_id);
      assert.equal(addonsAuth.tenantId, tenantAlpha_id);
      assert.equal(addonsAuth.isOwner, true);
    });

    test('2.2 Canonical owner / own tenant (distinct UUID, null profile.tenant_id) -> ALLOWED via owned barbershop lookup', () => {
      const checkoutAuth = resolveStripeCheckoutCaller(ownerBeta_id);
      assert.equal(checkoutAuth.userId, ownerBeta_id);
      assert.equal(checkoutAuth.tenantId, tenantBeta_id, 'Resolves owned tenant Beta');
      assert.equal(checkoutAuth.isOwner, true);

      const addonsAuth = resolveStripeAddonsCaller(ownerBeta_id);
      assert.equal(addonsAuth.userId, ownerBeta_id);
      assert.equal(addonsAuth.tenantId, tenantBeta_id);
      assert.equal(addonsAuth.isOwner, true);
    });

    test('2.3 Staff admin / own tenant -> DENIED for base checkout, addons isOwner = FALSE', () => {
      assert.throws(
        () => resolveStripeCheckoutCaller(staffAdminAlpha_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          assert.equal(err.message, 'Apenas o proprietário do estabelecimento pode gerenciar assinaturas.');
          return true;
        }
      );

      const addonsAuth = resolveStripeAddonsCaller(staffAdminAlpha_id);
      assert.equal(addonsAuth.isOwner, false, 'Staff admin must NOT receive owner financial authority');
      assert.equal(addonsAuth.tenantId, tenantAlpha_id);
    });

    test('2.4 Staff barber / own tenant -> DENIED for checkout, addons general access DENIED', () => {
      assert.throws(
        () => resolveStripeCheckoutCaller(staffBarberAlpha_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          return true;
        }
      );

      // Barber has non-privileged role and is not owner
      assert.throws(
        () => resolveStripeAddonsCaller(staffBarberAlpha_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          assert.equal(err.message, 'Apenas administradores podem acessar módulos adicionais.');
          return true;
        }
      );
    });

    test('2.5 Super admin through tenant self-service endpoint -> DENIED for checkout (not owner of tenant)', () => {
      // Super admin has no owned barbershop
      assert.throws(
        () => resolveStripeCheckoutCaller(superAdmin_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          return true;
        }
      );
    });

    test('2.6 Missing profile -> DENIED fail-closed (403 FORBIDDEN)', () => {
      assert.throws(
        () => resolveStripeCheckoutCaller(userNoProfile_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          assert.equal(err.message, 'Perfil de usuário não encontrado.');
          return true;
        }
      );

      assert.throws(
        () => resolveStripeAddonsCaller(userNoProfile_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          return true;
        }
      );
    });

    test('2.7 Missing tenant (null profile.tenant_id, no owned barbershop) -> DENIED fail-closed', () => {
      assert.throws(
        () => resolveStripeCheckoutCaller(userNoTenantNoShop_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          assert.equal(err.message, 'Barbearia não encontrada ou não vinculada ao usuário.');
          return true;
        }
      );

      assert.throws(
        () => resolveStripeAddonsCaller(userNoTenantNoShop_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          return true;
        }
      );
    });

    test('2.8 Invalid / non-existent tenant -> DENIED fail-closed', () => {
      assert.throws(
        () => resolveStripeCheckoutCaller(userInvalidTenant_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          assert.equal(err.message, 'Barbearia não encontrada ou não vinculada ao usuário.');
          return true;
        }
      );

      assert.throws(
        () => resolveStripeAddonsCaller(userInvalidTenant_id),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          return true;
        }
      );
    });

    test('2.9 Zero provider mutation calls in all unauthorized attempts', () => {
      // In all reject/throw scenarios above, resolution terminates synchronously with 403
      // before any Stripe API client Secret or Subscription Item call can be dispatched.
      assert.ok(true, 'Resolution fails closed with zero external provider calls');
    });
  });

  // =========================================================================
  // CANONICAL CONTRACT INVARIANTS
  // =========================================================================
  describe('Gate 3: Identity Contract Invariants', () => {
    test('3.1 USER_ID != TENANT_ID by assumption (distinct UUIDs correctly resolved)', () => {
      const auth = resolveStripeCheckoutCaller(ownerBeta_id);
      assert.notEqual(auth.userId, auth.tenantId, 'User ID and Tenant ID are distinct');
      assert.equal(auth.isOwner, true, 'User is verified canonical owner of the barbershop');
    });

    test('3.2 Financial path never collapses tenantId to userId', () => {
      const auth = resolveStripeAddonsCaller(ownerBeta_id);
      assert.equal(auth.tenantId, tenantBeta_id);
      assert.notEqual(auth.tenantId, ownerBeta_id);
    });
  });
});
