/**
 * BARBEX — R2E.24B: TEST SUITE FOR PAYMENT CONFIRMATION & RPC SECURITY
 * Validates public.mark_appointment_as_paid logic, authorization matrix and idempotency
 */

const assert = require('assert');

// Simulação de banco / teste de contrato lógico da RPC
function simulateMarkAsPaid(context, params) {
  const { user, appointment, barbershop, membership, receptionPerm } = context;
  const { appointmentId, paymentMethod } = params;

  // 1. Caller check
  if (!user || !user.id) {
    return { success: false, code: 'UNAUTHORIZED', error: 'Usuário não autenticado.' };
  }

  // 2. Appointment exists
  if (!appointment || appointment.id !== appointmentId) {
    return { success: false, code: 'APPOINTMENT_NOT_FOUND', error: 'Agendamento não encontrado.' };
  }

  // 3. Authorization check
  const isSuperAdmin = Boolean(user.is_super_admin);
  const isOwner = barbershop && barbershop.owner_id === user.id && barbershop.id === appointment.tenant_id;
  const isDirectBarber = appointment.barber_user_id === user.id;
  const hasReception = Boolean(receptionPerm && receptionPerm.is_active && receptionPerm.tenant_id === appointment.tenant_id);
  const isManagerOrAdmin = Boolean(membership && membership.tenant_id === appointment.tenant_id && ['admin', 'manager', 'owner'].includes(membership.role));
  const isActiveMember = Boolean(membership && membership.tenant_id === appointment.tenant_id && membership.status === 'active');

  const isAuthorized = isSuperAdmin || isOwner || isDirectBarber || hasReception || isManagerOrAdmin || isActiveMember;
  if (!isAuthorized) {
    return { success: false, code: 'FORBIDDEN', error: 'Acesso negado: operador não possui permissão para registrar pagamentos neste estabelecimento.' };
  }

  // 4. Cancelled check
  if (appointment.status === 'cancelled') {
    return { success: false, code: 'CANNOT_PAY_CANCELLED', error: 'Não é possível registrar pagamento para um agendamento cancelado.' };
  }

  // 5. Idempotency check
  if (appointment.payment_status === 'paid') {
    return {
      success: true,
      already_paid: true,
      appointment_id: appointment.id,
      payment_status: 'paid',
      paid_at: appointment.paid_at
    };
  }

  // 6. Sanitize method
  const validMethods = ['cash', 'card', 'pix', 'in_person', 'money', 'credit_card', 'debit_card'];
  const cleanMethod = validMethods.includes(paymentMethod?.toLowerCase()?.trim()) ? paymentMethod.toLowerCase().trim() : 'cash';

  // 7. Update appointment
  const now = new Date().toISOString();
  appointment.payment_status = 'paid';
  appointment.payment_method = cleanMethod;
  appointment.paid_at = now;

  return {
    success: true,
    already_paid: false,
    appointment_id: appointment.id,
    payment_status: 'paid',
    payment_method: cleanMethod,
    paid_at: now
  };
}

// Executar suíte de testes de contrato
function runTests() {
  console.log('=== TESTES DO FLUXO DE PAGAMENTO R2E.24B ===\n');

  const tenantLM = 'c54ac1ac-49be-4505-b7a4-d257ed023f08';
  const tenantOther = '99999999-9999-9999-9999-999999999999';

  // 1. Operador autorizado (Owner da LM)
  {
    const appt = { id: 'a1', tenant_id: tenantLM, status: 'confirmed', payment_status: 'pending' };
    const res = simulateMarkAsPaid({
      user: { id: 'user-lm-owner' },
      appointment: appt,
      barbershop: { id: tenantLM, owner_id: 'user-lm-owner' }
    }, { appointmentId: 'a1', paymentMethod: 'pix' });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.already_paid, false);
    assert.strictEqual(appt.payment_status, 'paid');
    assert.strictEqual(appt.payment_method, 'pix');
    console.log('✔ Teste 1: Operador autorizado (Owner) confirma pagamento com sucesso.');
  }

  // 2. Operador não autorizado (Cliente comum)
  {
    const appt = { id: 'a2', tenant_id: tenantLM, status: 'confirmed', payment_status: 'pending' };
    const res = simulateMarkAsPaid({
      user: { id: 'user-client' },
      appointment: appt,
      barbershop: { id: tenantLM, owner_id: 'user-lm-owner' }
    }, { appointmentId: 'a2', paymentMethod: 'cash' });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'FORBIDDEN');
    assert.strictEqual(appt.payment_status, 'pending');
    console.log('✔ Teste 2: Cliente comum bloqueado com FORBIDDEN.');
  }

  // 3. Usuário de outro tenant (Cross-tenant attack)
  {
    const appt = { id: 'a3', tenant_id: tenantLM, status: 'confirmed', payment_status: 'pending' };
    const res = simulateMarkAsPaid({
      user: { id: 'user-other-tenant' },
      appointment: appt,
      barbershop: { id: tenantOther, owner_id: 'user-other-tenant' },
      membership: { tenant_id: tenantOther, role: 'admin', status: 'active' }
    }, { appointmentId: 'a3', paymentMethod: 'card' });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'FORBIDDEN');
    assert.strictEqual(appt.payment_status, 'pending');
    console.log('✔ Teste 3: Usuário de outro tenant estritamente bloqueado (Cross-tenant guard).');
  }

  // 4. Agendamento inexistente
  {
    const res = simulateMarkAsPaid({
      user: { id: 'user-lm-owner' },
      appointment: null,
      barbershop: { id: tenantLM, owner_id: 'user-lm-owner' }
    }, { appointmentId: 'non-existent', paymentMethod: 'cash' });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'APPOINTMENT_NOT_FOUND');
    console.log('✔ Teste 4: Agendamento inexistente retorna APPOINTMENT_NOT_FOUND.');
  }

  // 5. Agendamento cancelado
  {
    const appt = { id: 'a5', tenant_id: tenantLM, status: 'cancelled', payment_status: 'pending' };
    const res = simulateMarkAsPaid({
      user: { id: 'user-lm-owner' },
      appointment: appt,
      barbershop: { id: tenantLM, owner_id: 'user-lm-owner' }
    }, { appointmentId: 'a5', paymentMethod: 'cash' });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'CANNOT_PAY_CANCELLED');
    console.log('✔ Teste 5: Agendamento cancelado não permite registro de pagamento.');
  }

  // 6. Idempotência (Já pago)
  {
    const appt = { id: 'a6', tenant_id: tenantLM, status: 'confirmed', payment_status: 'paid', paid_at: '2026-10-21T06:00:00Z' };
    const res = simulateMarkAsPaid({
      user: { id: 'user-lm-owner' },
      appointment: appt,
      barbershop: { id: tenantLM, owner_id: 'user-lm-owner' }
    }, { appointmentId: 'a6', paymentMethod: 'cash' });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.already_paid, true);
    assert.strictEqual(res.paid_at, '2026-10-21T06:00:00Z');
    console.log('✔ Teste 6: Idempotência garantida (já pago não duplica nem altera paid_at).');
  }

  // 7. Sanitização de método de pagamento inválido
  {
    const appt = { id: 'a7', tenant_id: tenantLM, status: 'confirmed', payment_status: 'pending' };
    const res = simulateMarkAsPaid({
      user: { id: 'user-lm-owner' },
      appointment: appt,
      barbershop: { id: tenantLM, owner_id: 'user-lm-owner' }
    }, { appointmentId: 'a7', paymentMethod: 'INVALID_METHOD_ATTACK' });

    assert.strictEqual(res.success, true);
    assert.strictEqual(appt.payment_method, 'cash'); // Fallback seguro
    console.log('✔ Teste 7: Método de pagamento inválido sanitizado para "cash".');
  }

  console.log('\nTODOS OS 7 TESTES DE PAGAMENTO PASSARAM COM SUCESSO!\n');
}

runTests();
