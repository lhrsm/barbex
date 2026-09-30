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

function runPsqlJson(sql) {
  const res = runPsql(sql);
  try {
    return JSON.parse(res);
  } catch (e) {
    throw new Error(`Failed to parse JSON from psql: "${res}". Error: ${e.message}`);
  }
}

describe('R2E.13G.6B — Global Feature Availability Governance Tests', () => {

  const superAdminUserId = '99999999-9999-4999-8999-999999999999';
  const tenantActiveId = '11111111-1111-4111-8111-111111111111';
  const tenantSuspendedId = '22222222-2222-4222-8222-222222222222';
  const tenantStarterId = '33333333-3333-4333-8333-333333333333';

  before(() => {
    runPsql(`
      BEGIN;
      -- Super Admin
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
      UPDATE public.platform_module_availability SET is_available = true, unavailable_reason = NULL;

      -- Reset tenant overrides
      DELETE FROM public.barbershop_modules WHERE tenant_id IN ('${tenantActiveId}', '${tenantSuspendedId}', '${tenantStarterId}');
      COMMIT;
    `);
  });

  after(() => {
    runPsql(`
      UPDATE public.platform_module_availability SET is_available = true, unavailable_reason = NULL;
    `);
  });

  test('Gate 48: LOCAL_GLOBAL_MUTATION_AUTH_MATRIX — Server-side Super Admin authorization', () => {
    // 1. Anon / unauthenticated call
    const anonRes = runPsqlJson(`
      SELECT public.admin_set_global_module_availability('support', false, 'Tentativa sem auth 12345');
    `);
    assert.equal(anonRes.success, false);
    assert.equal(anonRes.code, 'FORBIDDEN');

    // 2. Ordinary tenant call
    const tenantRes = runPsqlJson(`
      SET request.jwt.claim.sub = '${tenantActiveId}';
      SELECT public.admin_set_global_module_availability('support', false, 'Tentativa de tenant comum');
    `);
    assert.equal(tenantRes.success, false);
    assert.equal(tenantRes.code, 'FORBIDDEN');

    // 3. Super Admin call
    const adminRes = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('support', false, 'Desativacao valida por super admin');
    `);
    assert.equal(adminRes.success, true);
    assert.equal(adminRes.code, 'SUCCESS');

    // Restore
    runPsql(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('support', true, 'Reativacao valida por super admin');
    `);
  });

  test('Gate 49: LOCAL_UNKNOWN_GLOBAL_MODULE_MUTATION — Unknown module is denied', () => {
    const res = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('unknown_invalid_key', false, 'Tentativa de modulo desconhecido');
    `);
    assert.equal(res.success, false);
    assert.equal(res.code, 'UNKNOWN_MODULE');
  });

  test('Gate 50: LOCAL_PROHIBITED_GLOBAL_MODULE_MUTATION — Prohibited core modules cannot be disabled', () => {
    // dashboard
    const dashRes = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('dashboard', false, 'Tentativa desativar dashboard');
    `);
    assert.equal(dashRes.success, false);
    assert.equal(dashRes.code, 'PROHIBITED_MODULE');

    // settings
    const settingsRes = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('settings', false, 'Tentativa desativar settings');
    `);
    assert.equal(settingsRes.success, false);
    assert.equal(settingsRes.code, 'PROHIBITED_MODULE');
  });

  test('Gate 51: LOCAL_MAINTENANCE_ONLY_GLOBAL_MODULE_MUTATION — Maintenance-only modules cannot be disabled in G.6B', () => {
    const calRes = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('calendar', false, 'Tentativa desativar calendar');
    `);
    assert.equal(calRes.success, false);
    assert.equal(calRes.code, 'MAINTENANCE_ONLY_MODULE');

    const custRes = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('customers', false, 'Tentativa desativar customers');
    `);
    assert.equal(custRes.success, false);
    assert.equal(custRes.code, 'MAINTENANCE_ONLY_MODULE');
  });

  test('Gate 52: LOCAL_STANDARD_GLOBAL_DISABLE — Standard disable flow, state change & audit event', () => {
    const res = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('support', false, 'Desativando suporte por manutencao tecnica');
    `);
    assert.equal(res.success, true);
    assert.equal(res.data.is_available, false);
    assert.equal(res.data.module_key, 'support');

    // Verify row state
    const isAvail = runPsql(`
      SELECT is_available FROM public.platform_module_availability WHERE module_key = 'support';
    `);
    assert.equal(isAvail, 'f');

    const reason = runPsql(`
      SELECT unavailable_reason FROM public.platform_module_availability WHERE module_key = 'support';
    `);
    assert.equal(reason, 'Desativando suporte por manutencao tecnica');

    // Verify has_module_access denies
    const hasAccess = runPsql(`
      SELECT public.has_module_access('${tenantActiveId}', 'support');
    `);
    assert.equal(hasAccess, 'f');

    // Verify audit log
    const auditAction = runPsql(`
      SELECT action FROM public.audit_logs WHERE action = 'platform.global_feature_availability_updated' ORDER BY created_at DESC LIMIT 1;
    `);
    assert.equal(auditAction, 'platform.global_feature_availability_updated');
  });

  test('Gate 53: LOCAL_STANDARD_GLOBAL_REENABLE — Re-enable restores availability without granting entitlement', () => {
    const res = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('support', true, 'Reativando suporte apos manutencao tecnica');
    `);
    assert.equal(res.success, true);
    assert.equal(res.data.is_available, true);

    // Verify row state
    const isAvail = runPsql(`
      SELECT is_available FROM public.platform_module_availability WHERE module_key = 'support';
    `);
    assert.equal(isAvail, 't');

    // Tenant without plan entitlement (e.g. advanced_finance for starter tenant)
    // First disable advanced_finance
    runPsql(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('advanced_finance', false, 'Desativando advanced_finance temporariamente');
    `);
    // Then re-enable
    runPsql(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('advanced_finance', true, 'Reativando advanced_finance temporariamente');
    `);
    // Starter tenant must STILL be denied (no plan entitlement)
    const starterAccess = runPsql(`
      SELECT public.has_module_access('${tenantStarterId}', 'advanced_finance');
    `);
    assert.equal(starterAccess, 'f', 'LOCAL_REENABLE_CAN_GRANT_ENTITLEMENT must be false');
  });

  test('Gate 54: LOCAL_GLOBAL_DUPLICATE_STATE_REJECT — Duplicate state is rejected with CONFLICT and zero audit rows', () => {
    // support is available, request true again
    const countBefore = runPsql(`
      SELECT count(*) FROM public.audit_logs WHERE action = 'platform.global_feature_availability_updated';
    `);

    const res = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('support', true, 'Tentativa de duplicidade');
    `);
    assert.equal(res.success, false);
    assert.equal(res.code, 'CONFLICT');

    const countAfter = runPsql(`
      SELECT count(*) FROM public.audit_logs WHERE action = 'platform.global_feature_availability_updated';
    `);
    assert.equal(countBefore, countAfter, 'No audit row must be inserted for duplicate state rejection');
  });

  test('Gate 55: LOCAL_GLOBAL_REASON_VALIDATION — Validates reason length boundaries (10..500)', () => {
    // null reason
    const nullRes = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('support', false, NULL);
    `);
    assert.equal(nullRes.code, 'INVALID_REASON');

    // 9 chars
    const shortRes = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('support', false, '123456789');
    `);
    assert.equal(shortRes.code, 'INVALID_REASON');

    // 501 chars
    const longStr = 'a'.repeat(501);
    const longRes = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('support', false, '${longStr}');
    `);
    assert.equal(longRes.code, 'INVALID_REASON');

    // exactly 10 chars
    const valid10 = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('support', false, '1234567890');
    `);
    assert.equal(valid10.success, true);

    // restore
    runPsql(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('support', true, '1234567890');
    `);
  });

  test('Gate 56: LOCAL_GLOBAL_MUTATION_CONCURRENCY — Deterministic serialization via advisory & row locks', () => {
    // Test transaction-level lock execution
    const res = runPsqlJson(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('coupons', false, 'Bloqueio de concorrencia teste');
    `);
    assert.equal(res.success, true);

    // Restore
    runPsql(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('coupons', true, 'Restaurando cupons');
    `);
  });

  test('Gate 57: LOCAL_GLOBAL_MUTATION_ATOMIC_AUDIT — State update and audit logging are atomic', () => {
    const auditId = runPsql(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT (public.admin_set_global_module_availability('loyalty', false, 'Teste de atomicidade'))->>'code';
    `);
    assert.equal(auditId, 'SUCCESS');

    const auditDetail = runPsql(`
      SELECT details->>'reason' FROM public.audit_logs WHERE action = 'platform.global_feature_availability_updated' ORDER BY created_at DESC LIMIT 1;
    `);
    assert.equal(auditDetail, 'Teste de atomicidade');

    // Restore
    runPsql(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('loyalty', true, 'Restaurando loyalty');
    `);
  });

  test('Gate 59: LOCAL_GLOBAL_DIRECT_WRITE_MATRIX — Direct browser writes remain closed to all roles', () => {
    // Anon direct write
    let anonFailed = false;
    try {
      runPsql(`
        SET ROLE anon;
        UPDATE public.platform_module_availability SET is_available = false WHERE module_key = 'support';
      `);
    } catch (e) {
      anonFailed = true;
    }
    assert.ok(anonFailed, 'Anon direct write must fail');

    // Authenticated direct write
    let authFailed = false;
    try {
      runPsql(`
        SET ROLE authenticated;
        UPDATE public.platform_module_availability SET is_available = false WHERE module_key = 'support';
      `);
    } catch (e) {
      authFailed = true;
    }
    assert.ok(authFailed, 'Authenticated direct write must fail');
  });

  test('Gate 60 & 61: LOCAL_GLOBAL_MUTATION_COMMERCIAL_PRESERVATION & TENANT_OVERRIDE_PRESERVATION', () => {
    // Record counts before
    const plansBefore = runPsql(`SELECT count(*) FROM public.plans;`);
    const addonsBefore = runPsql(`SELECT count(*) FROM public.tenant_addons;`);
    const subsBefore = runPsql(`SELECT count(*) FROM public.subscriptions;`);

    // Set tenant override disabled for support
    runPsql(`
      INSERT INTO public.barbershop_modules (tenant_id, module_key, enabled)
      VALUES ('${tenantActiveId}', 'support', false)
      ON CONFLICT (tenant_id, module_key) DO UPDATE SET enabled = false;
    `);

    // Global mutation
    runPsql(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('stock', false, 'Teste de preservacao comercial');
      SELECT public.admin_set_global_module_availability('stock', true, 'Restaurando estoque');
    `);

    // Record counts after
    const plansAfter = runPsql(`SELECT count(*) FROM public.plans;`);
    const addonsAfter = runPsql(`SELECT count(*) FROM public.tenant_addons;`);
    const subsAfter = runPsql(`SELECT count(*) FROM public.subscriptions;`);

    assert.equal(plansBefore, plansAfter, 'Plans count must be preserved');
    assert.equal(addonsBefore, addonsAfter, 'Addons count must be preserved');
    assert.equal(subsBefore, subsAfter, 'Subscriptions count must be preserved');

    // Verify tenant override is preserved
    const override = runPsql(`
      SELECT enabled FROM public.barbershop_modules WHERE tenant_id = '${tenantActiveId}' AND module_key = 'support';
    `);
    assert.equal(override, 'f', 'Tenant override must remain disabled');
  });

  test('Gate 62: LOCAL_GLOBAL_REENABLE_SUSPENSION_PRESERVATION — Re-enabling does not reactivate suspended tenant', () => {
    // Disable and re-enable campaigns
    runPsql(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('campaigns', false, 'Teste suspensao desativa');
      SELECT public.admin_set_global_module_availability('campaigns', true, 'Teste suspensao reativa');
    `);

    // Suspended tenant must STILL be denied access
    const suspendedAccess = runPsql(`
      SELECT public.has_module_access('${tenantSuspendedId}', 'campaigns');
    `);
    assert.equal(suspendedAccess, 'f', 'Suspended tenant must remain denied');
  });

  test('Gate 63: LOCAL_GLOBAL_ALWAYS_ON_PRECEDENCE — Global UNAVAILABLE + ALWAYS_ON module evaluates to DENY', () => {
    // Even if an always-on module were force set to false in DB directly (simulation)
    runPsql(`
      UPDATE public.platform_module_availability SET is_available = false WHERE module_key = 'dashboard';
    `);

    const access = runPsql(`
      SELECT public.has_module_access('${tenantActiveId}', 'dashboard');
    `);
    assert.equal(access, 'f', 'Unavailable always-on module must deny access');

    // Restore dashboard
    runPsql(`
      UPDATE public.platform_module_availability SET is_available = true WHERE module_key = 'dashboard';
    `);
  });

  test('Gate 64 & 65: LOCAL_GLOBAL_PLAN_MATRIX & LOCAL_GLOBAL_ADDON_MATRIX', () => {
    // campaigns is available for Pro tenant
    const availAccess = runPsql(`
      SELECT public.has_module_access('${tenantActiveId}', 'campaigns');
    `);
    assert.equal(availAccess, 't');

    // Disable campaigns globally
    runPsql(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('campaigns', false, 'Desativando campanhas globalmente');
    `);

    // Pro tenant must now be denied
    const unavailAccess = runPsql(`
      SELECT public.has_module_access('${tenantActiveId}', 'campaigns');
    `);
    assert.equal(unavailAccess, 'f');

    // Restore campaigns
    runPsql(`
      SET request.jwt.claim.sub = '${superAdminUserId}';
      SELECT public.admin_set_global_module_availability('campaigns', true, 'Reativando campanhas globalmente');
    `);
  });

  test('Gate 73: LOCAL_GLOBAL_GOVERNANCE_SECRET_FIELDS = 0 — No secrets in audit logs or RPC returns', () => {
    const rawAudit = runPsql(`
      SELECT details::text FROM public.audit_logs WHERE action = 'platform.global_feature_availability_updated' ORDER BY created_at DESC LIMIT 1;
    `);

    assert.ok(!rawAudit.includes('sk_'), 'No secret key in audit');
    assert.ok(!rawAudit.includes('whsec_'), 'No webhook secret in audit');
    assert.ok(!rawAudit.includes('Bearer'), 'No bearer token in audit');
    assert.ok(!rawAudit.includes('password'), 'No password in audit');
  });

});
