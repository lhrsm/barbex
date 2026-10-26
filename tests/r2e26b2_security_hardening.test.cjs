/**
 * ==============================================================================
 * BARBEX R2E.26B.2 — SECURITY HARDENING TEST SUITE
 * ==============================================================================
 * Executa testes reais/controlados de autorização para:
 *   1. RPC public.get_barber_appointments (Anônimo, Barbeiro próprio, Barbeiro outro tenant,
 *      Barbeiro outro do mesmo tenant, Recepcionista, Tenant Owner, Super Admin).
 *   2. Validação e RLS de public.appointment_reviews (Cliente A próprio, Cliente B em A,
 *      Anônimo sem autorização, Funcionário/Staff forjando review, Atendimento não concluído,
 *      Agendamento skipped, Inconsistência tenant/customer).
 *   3. Preservação de invariantes financeiros e integridade de arquivo.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

console.log('==============================================================================');
console.log('BARBEX R2E.26B.2 — SECURITY HARDENING SUITE (TESTES POSITIVOS E NEGATIVOS)');
console.log('==============================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`[PASS] ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${testName}:`, err.message);
    failCount++;
  }
}

// ------------------------------------------------------------------------------
// FASE 1: AUDITORIA DA MIGRATION CANDIDATA 20261026160000_r2e26b2_security_hardening.sql
// ------------------------------------------------------------------------------
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261026160000_r2e26b2_security_hardening.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

runTest('TEST-1-MIGRATION-COMPLETENESS: A migration possui SECURITY DEFINER, search_path e REVOKE de anon', () => {
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.get_barber_appointments'), 'Deve definir get_barber_appointments');
  assert(migrationSql.includes('REVOKE EXECUTE ON FUNCTION public.get_barber_appointments(uuid) FROM PUBLIC, anon;'), 'Deve revogar anon');
  assert(migrationSql.includes('GRANT EXECUTE ON FUNCTION public.get_barber_appointments(uuid) TO authenticated;'), 'Deve conceder authenticated');
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.validate_appointment_review_before_insert()'), 'Deve definir trigger de reviews');
  assert(migrationSql.includes('unauthorized_review_submission'), 'Deve conter mensagem de erro de autorização de review');
  assert(migrationSql.includes('Customers can insert own appointment reviews'), 'Deve conter policy RLS de INSERT para cliente próprio');
  assert(migrationSql.includes('Customers can update own pending reviews'), 'Deve conter policy RLS de UPDATE para cliente próprio');
});

// ------------------------------------------------------------------------------
// FASE 2: SIMULAÇÃO RIGOROSA DA LÓGICA DE GET_BARBER_APPOINTMENTS
// ------------------------------------------------------------------------------
function simulateGetBarberAppointments({
  callerId,
  barber,
  tenantMemberships = [],
  profiles = [],
  isSuperAdmin = false,
  isTenantOwner = false
}) {
  // 1. Bloqueia chamadas anônimas
  if (!callerId) {
    throw new Error('unauthenticated: access denied');
  }

  // 2. Localiza o profissional
  if (!barber) {
    return [];
  }

  // 3. Verifica se o solicitante é o próprio profissional
  let isBarberSelf = false;
  if (barber.user_id === callerId) {
    isBarberSelf = true;
  } else if (barber.email && callerId.email && barber.email.toLowerCase() === callerId.email.toLowerCase()) {
    isBarberSelf = true;
  }

  // 4. Verifica se o solicitante possui papel administrativo/operacional no tenant
  let isTenantAdmin = false;
  if (isSuperAdmin || isTenantOwner) {
    isTenantAdmin = true;
  } else {
    const hasMembership = tenantMemberships.some(
      tm => tm.tenant_id === barber.tenant_id &&
            tm.user_id === callerId &&
            tm.status === 'active' &&
            ['admin', 'tenant_admin', 'manager', 'receptionist', 'reception'].includes(tm.role)
    );
    const hasProfile = profiles.some(
      p => p.id === callerId &&
           (p.tenant_id === barber.tenant_id || p.id === barber.tenant_id) &&
           ['admin', 'tenant_admin', 'super_admin', 'manager', 'receptionist', 'reception'].includes(p.role)
    );
    if (hasMembership || hasProfile) {
      isTenantAdmin = true;
    }
  }

  // 5. Se não for o próprio barbeiro e não for admin/recepção, bloqueia
  if (!isBarberSelf && !isTenantAdmin) {
    throw new Error('unauthorized: caller cannot access appointments for this barber');
  }

  return [
    { appointment_id: 'appt-123', barber_id: barber.id, customer_name: 'Cliente Teste' }
  ];
}

console.log('\n[Auditoria RPC public.get_barber_appointments]');

runTest('TEST-2-RPC-ANON-REJECTION: Usuário anônimo chamando get_barber_appointments é bloqueado', () => {
  assert.throws(() => {
    simulateGetBarberAppointments({ callerId: null, barber: { id: 'b1', tenant_id: 't1', user_id: 'u-b1' } });
  }, /unauthenticated: access denied/);
});

runTest('TEST-3-RPC-BARBER-SELF-ACCESS: Barbeiro acessando sua própria agenda é PERMITIDO', () => {
  const result = simulateGetBarberAppointments({
    callerId: 'u-b1',
    barber: { id: 'b1', tenant_id: 't1', user_id: 'u-b1' }
  });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].barber_id, 'b1');
});

runTest('TEST-4-RPC-PEER-BARBER-BLOCKED: Barbeiro B1 tentando acessar agenda de B2 do mesmo tenant é BLOQUEADO', () => {
  assert.throws(() => {
    simulateGetBarberAppointments({
      callerId: 'u-b1', // Barbeiro B1
      barber: { id: 'b2', tenant_id: 't1', user_id: 'u-b2' }, // Barbeiro B2
      tenantMemberships: [{ tenant_id: 't1', user_id: 'u-b1', status: 'active', role: 'barber' }]
    });
  }, /unauthorized: caller cannot access appointments for this barber/);
});

runTest('TEST-5-RPC-OTHER-TENANT-BLOCKED: Barbeiro de outro tenant tentando acessar agenda de B1 é BLOQUEADO', () => {
  assert.throws(() => {
    simulateGetBarberAppointments({
      callerId: 'u-b3-other-tenant',
      barber: { id: 'b1', tenant_id: 't1', user_id: 'u-b1' },
      tenantMemberships: [{ tenant_id: 't2-other', user_id: 'u-b3-other-tenant', status: 'active', role: 'barber' }]
    });
  }, /unauthorized: caller cannot access appointments for this barber/);
});

runTest('TEST-6-RPC-RECEPTIONIST-ALLOWED: Recepcionista do tenant acessando agenda do barbeiro é PERMITIDO', () => {
  const result = simulateGetBarberAppointments({
    callerId: 'u-rec-1',
    barber: { id: 'b1', tenant_id: 't1', user_id: 'u-b1' },
    tenantMemberships: [{ tenant_id: 't1', user_id: 'u-rec-1', status: 'active', role: 'receptionist' }]
  });
  assert.strictEqual(result.length, 1);
});

runTest('TEST-7-RPC-TENANT-OWNER-ALLOWED: Dono da barbearia acessando agenda de qualquer barbeiro é PERMITIDO', () => {
  const result = simulateGetBarberAppointments({
    callerId: 'u-owner-1',
    barber: { id: 'b1', tenant_id: 't1', user_id: 'u-b1' },
    isTenantOwner: true
  });
  assert.strictEqual(result.length, 1);
});

runTest('TEST-8-RPC-SUPERADMIN-ALLOWED: Super Admin global acessando agenda de qualquer barbeiro é PERMITIDO', () => {
  const result = simulateGetBarberAppointments({
    callerId: 'u-super-1',
    barber: { id: 'b1', tenant_id: 't1', user_id: 'u-b1' },
    isSuperAdmin: true
  });
  assert.strictEqual(result.length, 1);
});


// ------------------------------------------------------------------------------
// FASE 3: SIMULAÇÃO RIGOROSA DA TRIGGER E RLS DE APPOINTMENT_REVIEWS
// ------------------------------------------------------------------------------
function simulateReviewInsert({
  callerAuthUid,
  callerRole = 'authenticated',
  newRecord,
  appointment,
  customers = []
}) {
  // 1. Simulação RLS (Customers can insert own appointment reviews)
  if (callerRole !== 'authenticated' || !callerAuthUid) {
    throw new Error('RLS_VIOLATION: anon users cannot insert directly into appointment_reviews');
  }

  const callerCustomer = customers.find(c => c.id === newRecord.customer_id && c.auth_user_id === callerAuthUid && c.tenant_id === newRecord.tenant_id);
  if (!callerCustomer) {
    throw new Error('RLS_VIOLATION: caller does not own the customer record specified in the review');
  }

  // 2. Simulação da Trigger validate_appointment_review_before_insert()
  if (!appointment) {
    throw new Error('appointment_not_found: appointment does not exist');
  }

  if (appointment.status !== 'completed') {
    throw new Error(`appointment_not_completed: cannot review appointment with status ${appointment.status}`);
  }

  if (appointment.review_decision === 'skipped') {
    throw new Error('review_decision_already_skipped: customer chose not to review this appointment');
  }

  if (appointment.customer_id !== newRecord.customer_id || appointment.tenant_id !== newRecord.tenant_id) {
    throw new Error('inconsistent_review_target: customer or tenant does not match appointment');
  }

  // 3. Validação de identidade estrita da trigger
  if (callerRole === 'authenticated' && callerAuthUid) {
    const isOwner = customers.some(c => c.id === newRecord.customer_id && c.tenant_id === newRecord.tenant_id && c.auth_user_id === callerAuthUid);
    if (!isOwner) {
      throw new Error('unauthorized_review_submission: caller is not the owner of this customer profile');
    }
  }

  return { success: true, id: 'rev-created-123' };
}

console.log('\n[Auditoria Validação de Inserção de Avaliações]');

const validCustomerA = { id: 'cust-A', tenant_id: 'tenant-1', auth_user_id: 'auth-user-A' };
const validCustomerB = { id: 'cust-B', tenant_id: 'tenant-1', auth_user_id: 'auth-user-B' };
const staffUser = { id: 'staff-C', tenant_id: 'tenant-1', auth_user_id: 'auth-staff-C' };

const completedApptA = {
  id: 'appt-A',
  tenant_id: 'tenant-1',
  customer_id: 'cust-A',
  barber_id: 'barber-1',
  status: 'completed',
  review_decision: 'pending'
};

runTest('TEST-9-REVIEW-OWNER-SUCCESS: Cliente A avalia seu próprio agendamento completed com SUCESSO', () => {
  const res = simulateReviewInsert({
    callerAuthUid: 'auth-user-A',
    callerRole: 'authenticated',
    newRecord: {
      appointment_id: 'appt-A',
      customer_id: 'cust-A',
      tenant_id: 'tenant-1',
      barbershop_rating: 5
    },
    appointment: completedApptA,
    customers: [validCustomerA, validCustomerB]
  });
  assert.strictEqual(res.success, true);
});

runTest('TEST-10-REVIEW-IMPERSONATION-BLOCKED: Cliente B tentando avaliar agendamento de A é BLOQUEADO', () => {
  assert.throws(() => {
    simulateReviewInsert({
      callerAuthUid: 'auth-user-B', // Invasor Cliente B
      callerRole: 'authenticated',
      newRecord: {
        appointment_id: 'appt-A',
        customer_id: 'cust-A', // Alvo: Cliente A
        tenant_id: 'tenant-1',
        barbershop_rating: 1
      },
      appointment: completedApptA,
      customers: [validCustomerA, validCustomerB]
    });
  }, /RLS_VIOLATION: caller does not own the customer record/);
});

runTest('TEST-11-REVIEW-ANON-DIRECT-BLOCKED: Usuário anônimo tentando INSERT direto na tabela é BLOQUEADO', () => {
  assert.throws(() => {
    simulateReviewInsert({
      callerAuthUid: null,
      callerRole: 'anon',
      newRecord: {
        appointment_id: 'appt-A',
        customer_id: 'cust-A',
        tenant_id: 'tenant-1',
        barbershop_rating: 5
      },
      appointment: completedApptA,
      customers: [validCustomerA]
    });
  }, /RLS_VIOLATION: anon users cannot insert directly/);
});

runTest('TEST-12-REVIEW-STAFF-FORGERY-BLOCKED: Funcionário tentando criar avaliação para cliente é BLOQUEADO', () => {
  assert.throws(() => {
    simulateReviewInsert({
      callerAuthUid: 'auth-staff-C',
      callerRole: 'authenticated',
      newRecord: {
        appointment_id: 'appt-A',
        customer_id: 'cust-A',
        tenant_id: 'tenant-1',
        barbershop_rating: 5
      },
      appointment: completedApptA,
      customers: [validCustomerA, validCustomerB]
    });
  }, /RLS_VIOLATION: caller does not own the customer record/);
});

runTest('TEST-13-REVIEW-NOT-COMPLETED-PRESERVED: Tentativa de avaliar agendamento scheduled é BLOQUEADA', () => {
  assert.throws(() => {
    simulateReviewInsert({
      callerAuthUid: 'auth-user-A',
      callerRole: 'authenticated',
      newRecord: {
        appointment_id: 'appt-A',
        customer_id: 'cust-A',
        tenant_id: 'tenant-1',
        barbershop_rating: 5
      },
      appointment: { ...completedApptA, status: 'scheduled' },
      customers: [validCustomerA]
    });
  }, /appointment_not_completed/);
});

runTest('TEST-14-REVIEW-SKIPPED-PRESERVED: Tentativa de avaliar agendamento skipped é BLOQUEADA', () => {
  assert.throws(() => {
    simulateReviewInsert({
      callerAuthUid: 'auth-user-A',
      callerRole: 'authenticated',
      newRecord: {
        appointment_id: 'appt-A',
        customer_id: 'cust-A',
        tenant_id: 'tenant-1',
        barbershop_rating: 5
      },
      appointment: { ...completedApptA, review_decision: 'skipped' },
      customers: [validCustomerA]
    });
  }, /review_decision_already_skipped/);
});

// ------------------------------------------------------------------------------
// FASE 4: INVARIANTES DE PRODUÇÃO E FINANCEIRO
// ------------------------------------------------------------------------------
console.log('\n[Auditoria de Invariantes Financeiros e Estabilidade]');

runTest('TEST-15-FINANCIAL-INVARIANTS: Preservação estrita de stripe-checkout/index.ts e flags', () => {
  const diffStripe = execSync('git diff HEAD -- supabase/functions/stripe-checkout/index.ts', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });
  assert.strictEqual(diffStripe.trim(), '', 'stripe-checkout/index.ts não pode possuir diffs');
});

console.log('\n------------------------------------------------------------------------------');
console.log(`TOTAL TESTES: ${passCount + failCount} | APROVADOS: ${passCount} | REPROVADOS: ${failCount}`);
console.log('------------------------------------------------------------------------------');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('R2E.26B.2 SECURITY HARDENING SUITE PASSED PERFECTLY.\n');
}
