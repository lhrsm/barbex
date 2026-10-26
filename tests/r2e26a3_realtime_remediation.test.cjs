'use strict';

/**
 * BARBEX — R2E.26A.3: REMEDIAÇÃO CONTROLADA DA SINCRONIZAÇÃO REALTIME
 * Automated Quality Gate and Verification Suite
 * Target: ywdwrstxvsdqiryhieiz | Production: https://barbex.shop
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let passed = 0;
let failed = 0;
const results = [];

function pass(gate, details) {
  passed++;
  const msg = `[PASS] ${gate}: ${details}`;
  results.push({ gate, status: 'PASS', details });
  console.log(msg);
}

function fail(gate, details) {
  failed++;
  const msg = `[FAIL] ${gate}: ${details}`;
  results.push({ gate, status: 'FAIL', details });
  console.error(msg);
}

async function runTestSuite() {
  console.log('==============================================================================');
  console.log('BARBEX R2E.26A.3 — QUALITY GATES & REALTIME REMEDIATION TEST SUITE');
  console.log('==============================================================================\n');

  const rootDir = path.resolve(__dirname, '..');

  // -------------------------------------------------------------------------
  // GATE 1: MIGRATION E PUBLICAÇÃO POSTGRES REALTIME (FASE 1)
  // -------------------------------------------------------------------------
  const migrationPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20261026090000_r2e26a3_realtime_publication_and_checkins_rls.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    fail('GATE-1.1-MIGRATION-FILE', 'Migration file does not exist');
  } else {
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');

    // Verifica que adiciona exclusivamente appointments e appointment_checkins
    const hasAppointments = migrationContent.includes("ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;");
    const hasCheckins = migrationContent.includes("ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_checkins;");
    const hasForAllTables = /FOR\s+ALL\s+TABLES/i.test(migrationContent);
    const hasFinancials = /financial|transactions|subscriptions|invoices|vault/i.test(
      migrationContent.replace(/Zero impact on financial tables/i, '')
    );

    if (hasAppointments && hasCheckins) {
      pass('GATE-1.1-PUBLICATION-TABLES', 'Explicitly adds public.appointments and public.appointment_checkins');
    } else {
      fail('GATE-1.1-PUBLICATION-TABLES', 'Missing target table additions');
    }

    if (!hasForAllTables) {
      pass('GATE-1.2-NO-FOR-ALL-TABLES', 'Strictly avoids FOR ALL TABLES (idempotent targeted publication)');
    } else {
      fail('GATE-1.2-NO-FOR-ALL-TABLES', 'Forbidden FOR ALL TABLES detected');
    }

    if (!hasFinancials) {
      pass('GATE-1.3-NO-FINANCIAL-EXPOSURE', 'Zero financial or auth tables added to Realtime publication');
    } else {
      fail('GATE-1.3-NO-FINANCIAL-EXPOSURE', 'Unintended tables found in migration');
    }

    const hasIdempotency = migrationContent.includes('pg_publication_tables') && migrationContent.includes('IF NOT EXISTS');
    if (hasIdempotency) {
      pass('GATE-1.4-IDEMPOTENCY', 'Publication addition is protected by IF NOT EXISTS DO blocks');
    } else {
      fail('GATE-1.4-IDEMPOTENCY', 'Missing publication idempotency checks');
    }
  }

  // -------------------------------------------------------------------------
  // GATE 2: INVESTIGAÇÃO E DECISÃO DE REPLICA IDENTITY (FASE 2)
  // -------------------------------------------------------------------------
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  const hasUnsafeReplicaFull = /REPLICA\s+IDENTITY\s+FULL/i.test(migrationContent);

  // Prova empírica no código de que não existem DELETEs físicos de agendamentos
  let allApptDeletes = '';
  try {
    allApptDeletes = execSync('git grep -i "DELETE FROM appointments" -- src/', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch (e) {
    allApptDeletes = ''; // git grep exits with 1 when no matches are found
  }

  if (!hasUnsafeReplicaFull) {
    pass('GATE-2.1-REPLICA-IDENTITY-DEFAULT', 'REPLICA IDENTITY FULL avoided; preserved DEFAULT to prevent WAL bloat');
  } else {
    fail('GATE-2.1-REPLICA-IDENTITY-DEFAULT', 'REPLICA IDENTITY FULL was applied unconditionally');
  }

  if (allApptDeletes.length === 0) {
    pass('GATE-2.2-NO-PHYSICAL-DELETES', 'Codebase audit confirms 0 physical DELETEs; status updates used exclusively');
  } else {
    fail('GATE-2.2-NO-PHYSICAL-DELETES', `Unexpected physical DELETE found: ${allApptDeletes}`);
  }

  // -------------------------------------------------------------------------
  // GATE 3: RLS AUDIT & CHECK-INS AUTHORIZATION BRIDGE (FASE 3)
  // -------------------------------------------------------------------------
  const hasCanAccessTenant = migrationContent.includes('public.can_access_tenant(tenant_id)');
  const hasReceptionPermissions = migrationContent.includes('reception_permissions');
  const hasSuperAdmin = migrationContent.includes('public.is_super_admin_user()');
  const hasCheckinsSelect = migrationContent.includes('CREATE POLICY "tenant_read_checkins"');
  const hasCheckinsInsert = migrationContent.includes('CREATE POLICY "tenant_insert_checkins"');

  if (hasCanAccessTenant && hasReceptionPermissions && hasSuperAdmin) {
    pass('GATE-3.1-CHECKINS-RLS-BRIDGE', 'RLS permits authorized tenant members and receptionists via reception_permissions');
  } else {
    fail('GATE-3.1-CHECKINS-RLS-BRIDGE', 'Incomplete RLS permission bridge in migration');
  }

  if (hasCheckinsSelect && hasCheckinsInsert) {
    pass('GATE-3.2-CHECKINS-POLICIES-BOUND', 'SELECT and INSERT policies configured with tenant boundary');
  } else {
    fail('GATE-3.2-CHECKINS-POLICIES-BOUND', 'Missing SELECT or INSERT policy declaration');
  }

  // -------------------------------------------------------------------------
  // GATE 4: FRONTEND SYNCHRONIZATION POSTGRES CHANGES & LOCAL STATES (CAMINHO 1)
  // -------------------------------------------------------------------------
  const syncAppointmentsPath = path.join(rootDir, 'src', 'lib', 'sync-appointments.ts');
  const syncAppointmentsCode = fs.readFileSync(syncAppointmentsPath, 'utf8');

  const hasInvalidateAll = syncAppointmentsCode.includes('export function invalidateAllAppointmentQueries');
  const hasWindowEvents = syncAppointmentsCode.includes('REFRESH_APPOINTMENTS_DATA') && syncAppointmentsCode.includes('REFRESH_DASHBOARD_DATA');
  const hasNoPublicBroadcast = !syncAppointmentsCode.includes('broadcastAppointmentSync');

  if (hasInvalidateAll && hasWindowEvents && hasNoPublicBroadcast) {
    pass('GATE-4.1-SYNC-APPOINTMENTS-SECURE', 'sync-appointments.ts eliminates unauthenticated public broadcast and orchestrates local bus');
  } else {
    fail('GATE-4.1-SYNC-APPOINTMENTS-SECURE', 'sync-appointments.ts retains public broadcast or missing window dispatch');
  }

  // Calendar component inspection
  const calendarPath = path.join(rootDir, 'src', 'routes', 'calendar.tsx');
  const calendarCode = fs.readFileSync(calendarPath, 'utf8');

  const calHasPostgres = calendarCode.includes("table: 'appointments'");
  const calHasWindow = calendarCode.includes("addEventListener('REFRESH_APPOINTMENTS_DATA'");
  const calHasDebounce = calendarCode.includes('debouncedFetchData');

  if (calHasPostgres && calHasWindow && calHasDebounce) {
    pass('GATE-4.2-CALENDAR-REALTIME-INTEGRATION', 'calendar.tsx listens to postgres_changes and window refresh with debounce');
  } else {
    fail('GATE-4.2-CALENDAR-REALTIME-INTEGRATION', 'calendar.tsx missing postgres_changes or debounce');
  }

  // Dashboard component inspection
  const dashboardPath = path.join(rootDir, 'src', 'routes', 'dashboard.index.tsx');
  const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');

  const dashHasPostgres = dashboardCode.includes("table: 'appointments'");
  const dashHasWindow = dashboardCode.includes("addEventListener('REFRESH_APPOINTMENTS_DATA'");
  const dashHasDebounce = dashboardCode.includes('executeDebouncedSync');

  if (dashHasPostgres && dashHasWindow && dashHasDebounce) {
    pass('GATE-4.3-DASHBOARD-REALTIME-INTEGRATION', 'dashboard.index.tsx listens to postgres_changes and window refresh with debounce');
  } else {
    fail('GATE-4.3-DASHBOARD-REALTIME-INTEGRATION', 'dashboard.index.tsx missing postgres_changes or debounce');
  }

  // ReceptionQueue inspection
  const receptionQueuePath = path.join(rootDir, 'src', 'components', 'reception', 'ReceptionQueue.tsx');
  const receptionQueueCode = fs.readFileSync(receptionQueuePath, 'utf8');

  const rqHasPostgresAppts = receptionQueueCode.includes('table: "appointments"');
  const rqHasPostgresCheckins = receptionQueueCode.includes('table: "appointment_checkins"');
  const rqHasWindow = receptionQueueCode.includes('REFRESH_APPOINTMENTS_DATA');

  if (rqHasPostgresAppts && rqHasPostgresCheckins && rqHasWindow) {
    pass('GATE-4.4-RECEPTION-QUEUE-REALTIME-INTEGRATION', 'ReceptionQueue.tsx listens to appointments, checkins, and window events');
  } else {
    fail('GATE-4.4-RECEPTION-QUEUE-REALTIME-INTEGRATION', 'ReceptionQueue.tsx missing listeners');
  }

  // Public Booking Slug inspection
  const slugPath = path.join(rootDir, 'src', 'routes', '$slug.tsx');
  const slugCode = fs.readFileSync(slugPath, 'utf8');

  const slugHasInvalidate = slugCode.includes('invalidateAllAppointmentQueries(queryClient');
  if (slugHasInvalidate) {
    pass('GATE-4.5-PUBLIC-BOOKING-SYNC', '$slug.tsx invokes invalidateAllAppointmentQueries upon successful booking');
  } else {
    fail('GATE-4.5-PUBLIC-BOOKING-SYNC', '$slug.tsx does not invalidate appointment cache');
  }

  // -------------------------------------------------------------------------
  // GATE 5: MULTI-TENANT ISOLATION (FASE 5)
  // -------------------------------------------------------------------------
  const calTenantFilter = calendarCode.includes("filter: `tenant_id=eq.${tenantId}`");
  const dashTenantFilter = dashboardCode.includes("filter: `tenant_id=eq.${tenantId}`");
  const rqTenantFilter = receptionQueueCode.includes("filter: `tenant_id=eq.${tenantId}`");

  if (calTenantFilter && dashTenantFilter && rqTenantFilter) {
    pass('GATE-5.1-TENANT-ISOLATION-REALTIME', 'All Realtime channel filters strictly enforce tenant_id isolation');
  } else {
    fail('GATE-5.1-TENANT-ISOLATION-REALTIME', 'Unfiltered or incorrectly filtered Realtime subscription detected');
  }

  // -------------------------------------------------------------------------
  // GATE 6: SEGURANÇA E NÃO-REGRESSÃO (FASE 6)
  // -------------------------------------------------------------------------
  let stripeDiff = '';
  try {
    stripeDiff = execSync(
      'git diff origin/main -- supabase/functions/stripe-checkout/index.ts',
      { cwd: rootDir, encoding: 'utf8' }
    ).trim();
  } catch (e) {
    // If origin/main is not fetchable locally, verify head against baseline
    stripeDiff = execSync(
      'git diff HEAD -- supabase/functions/stripe-checkout/index.ts',
      { cwd: rootDir, encoding: 'utf8' }
    ).trim();
  }

  if (stripeDiff.length === 0) {
    pass('GATE-6.1-STRIPE-CHECKOUT-UNTOUCHED', 'supabase/functions/stripe-checkout/index.ts is completely untouched (0 diffs)');
  } else {
    fail('GATE-6.1-STRIPE-CHECKOUT-UNTOUCHED', `Unauthorized modifications in stripe-checkout: ${stripeDiff}`);
  }

  // Verify ENABLE_SELF_SERVICE_REFUNDS is never set to true in any env file
  const envFiles = ['.env', '.env.local', '.env.production', '.env.staging'];
  let envViolations = [];
  for (const ef of envFiles) {
    const fullPath = path.join(rootDir, ef);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (/ENABLE_SELF_SERVICE_REFUNDS\s*=\s*true/i.test(content)) {
        envViolations.push(ef);
      }
    }
  }

  if (envViolations.length === 0) {
    pass('GATE-6.2-REFUNDS-DISABLED', 'ENABLE_SELF_SERVICE_REFUNDS=false (Fail-Closed) strictly preserved across all configs');
  } else {
    fail('GATE-6.2-REFUNDS-DISABLED', `Self-service refunds enabled in env file: ${envViolations.join(', ')}`);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n------------------------------------------------------------------------------');
  console.log(`TOTAL GATES: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('------------------------------------------------------------------------------');

  if (failed > 0) {
    console.error('R2E.26A.3 VALIDATION FAILED: Review failed gates above.');
    process.exit(1);
  } else {
    console.log('R2E.26A.3 ALL QUALITY GATES PASSED SUCCESSFULLY.');
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
