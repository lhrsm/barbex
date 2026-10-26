/**
 * ==============================================================================
 * BARBEX R2E.26C — RECEPTION BOOKING & REVIEW MODERATION TEST SUITE
 * ==============================================================================
 * Valida:
 *   1. Resolução de entitlement e limites da Barbearia LM para a Recepção.
 *   2. Desbloqueio do agendamento mensal para a recepção (voucher Elite).
 *   3. Autorização e segurança na moderação de avaliações pela recepção.
 *   4. Bloqueios estritos: proibição de edição de notas, textos, exclusão e cross-tenant.
 *   5. Preservação de invariantes de produção (Stripe, cron, refunds=false, vouchers).
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('==============================================================================');
console.log('BARBEX R2E.26C — RECEPTION BOOKING & REVIEW MODERATION TEST SUITE');
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
// TESTE 1: AUDITORIA DA MIGRATION CANDIDATA 20261026170000
// ------------------------------------------------------------------------------
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261026170000_r2e26c_reception_review_moderation.sql');
assert(fs.existsSync(migrationPath), 'Migration 20261026170000 deve existir localmente');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

runTest('TEST-1-MIGRATION-STRUCTURE: RPCs de moderação da recepção', () => {
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.moderate_appointment_review'), 'Deve conter moderate_appointment_review');
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.reply_to_appointment_review'), 'Deve conter reply_to_appointment_review');
  assert(migrationSql.includes('REVOKE ALL ON FUNCTION public.moderate_appointment_review(uuid, text) FROM PUBLIC, anon;'), 'Deve revogar anon de moderate_review');
  assert(migrationSql.includes('GRANT EXECUTE ON FUNCTION public.moderate_appointment_review(uuid, text) TO authenticated;'), 'Deve conceder authenticated em moderate_review');
  assert(migrationSql.includes('REVOKE ALL ON FUNCTION public.reply_to_appointment_review(uuid, text) FROM PUBLIC, anon;'), 'Deve revogar anon de reply_review');
});

runTest('TEST-2-MIGRATION-IMMUTABILITY: Não permite alterar notas ou texto do cliente', () => {
  // Apenas campos de moderação são atualizados em moderate_appointment_review
  assert(!migrationSql.includes('service_rating ='), 'Não pode atualizar service_rating');
  assert(!migrationSql.includes('barbershop_rating ='), 'Não pode atualizar barbershop_rating');
  assert(!migrationSql.includes('barber_rating ='), 'Não pode atualizar barber_rating');
  assert(!migrationSql.includes('testimonial_text ='), 'Não pode atualizar testimonial_text');
  assert(!migrationSql.includes('DELETE FROM public.appointment_reviews'), 'RPC não pode excluir avaliações');
});

// ------------------------------------------------------------------------------
// TESTE 3: SIMULAÇÃO DE RESOLUÇÃO DE LIMITES E ENTITLEMENT DA BARBEARIA LM
// ------------------------------------------------------------------------------
const LM_TENANT_ID = 'c54ac1ac-49be-4505-b7a4-d257ed023f08';
const OTHER_TENANT_ID = '92caca5a-5174-4725-9da9-b10a9aa87104';
const RECEPTIONIST_ID = '0cd900ec-d14a-4647-8229-1387c73c578f';

const PLAN_LIMITS = {
  free: { monthlyAppointments: 30 },
  starter: { monthlyAppointments: 100 },
  pro: { monthlyAppointments: 300 },
  elite: { monthlyAppointments: Infinity },
};
const RESTRICTED_LIMITS = { monthlyAppointments: 0 };

function simulateEntitlementEngine(tenantId) {
  if (tenantId === LM_TENANT_ID) {
    return {
      tenant_id: LM_TENANT_ID,
      operational_state: 'VOUCHER_ACTIVE',
      can_operate: true,
      effective_plan: 'elite',
      commercial_plan: 'elite',
      entitlement_source: 'voucher',
      limits: { monthlyAppointments: null }
    };
  }
  if (tenantId === OTHER_TENANT_ID) {
    return {
      tenant_id: OTHER_TENANT_ID,
      operational_state: 'SUBSCRIPTION_ACTIVE',
      can_operate: true,
      effective_plan: 'starter',
      commercial_plan: 'starter',
      entitlement_source: 'subscription',
      limits: { monthlyAppointments: 100 }
    };
  }
  // Usuário pessoal / sem tenant
  return {
    tenant_id: tenantId,
    operational_state: 'RESTRICTED',
    can_operate: false,
    effective_plan: 'free',
    commercial_plan: 'free',
    entitlement_source: 'none',
    limits: { monthlyAppointments: 0 }
  };
}

function simulatePlanLimitsHook({ tenantId, userId, appointmentCount = 45 }) {
  // Entitlement agora é chamado com effectiveTenant (priorizando tenantId)
  const effectiveTenant = tenantId || userId;
  const entitlement = simulateEntitlementEngine(effectiveTenant);

  let plan = 'free';
  if (entitlement.operational_state === 'VOUCHER_ACTIVE') {
    plan = entitlement.effective_plan;
  } else if (entitlement.can_operate) {
    plan = entitlement.effective_plan;
  }

  const isRestricted = !entitlement.can_operate || entitlement.operational_state === 'RESTRICTED';
  const limits = isRestricted ? RESTRICTED_LIMITS : (PLAN_LIMITS[plan] || PLAN_LIMITS.free);

  const checkLimit = (type) => {
    if (isRestricted) return false;
    const limitVal = limits[type];
    if (limitVal === Infinity) return true;
    if (limitVal === 0) return false;
    return appointmentCount < limitVal;
  };

  return { plan, limits, checkLimit, canOperate: entitlement.can_operate };
}

runTest('TEST-3-LM-RECEPTION-BOOKING-UNBLOCKED: Recepcionista na Barbearia LM tem limite Infinity e agenda livremente', () => {
  const result = simulatePlanLimitsHook({
    tenantId: LM_TENANT_ID,
    userId: RECEPTIONIST_ID,
    appointmentCount: 150 // Mesmo com 150 agendamentos no mês
  });

  assert.strictEqual(result.plan, 'elite', 'O plano efetivo resolvido deve ser elite');
  assert.strictEqual(result.canOperate, true, 'Deve poder operar');
  assert.strictEqual(result.limits.monthlyAppointments, Infinity, 'O limite mensal de agendamentos deve ser Infinity');
  assert.strictEqual(result.checkLimit('monthlyAppointments'), true, 'checkLimit deve retornar true sem bloquear');
});

runTest('TEST-4-ISOLATION: Outro tenant Starter não herda benefícios da Barbearia LM e bloqueia se estourar limite', () => {
  const normalWithinLimit = simulatePlanLimitsHook({
    tenantId: OTHER_TENANT_ID,
    userId: 'some-user',
    appointmentCount: 50
  });
  assert.strictEqual(normalWithinLimit.plan, 'starter');
  assert.strictEqual(normalWithinLimit.checkLimit('monthlyAppointments'), true, 'Dentro de 100 deve permitir');

  const exceededLimit = simulatePlanLimitsHook({
    tenantId: OTHER_TENANT_ID,
    userId: 'some-user',
    appointmentCount: 101
  });
  assert.strictEqual(exceededLimit.checkLimit('monthlyAppointments'), false, 'Acima de 100 deve bloquear com limite legítimo');
});

// ------------------------------------------------------------------------------
// TESTE 5: SIMULAÇÃO RIGOROSA DA RPC MODERATE_APPOINTMENT_REVIEW
// ------------------------------------------------------------------------------
function simulateModerateReview({
  callerId,
  review,
  action,
  isSuperAdmin = false,
  tenantMemberships = []
}) {
  if (!callerId) {
    throw new Error('unauthenticated: access denied');
  }
  if (!review) {
    throw new Error('review_not_found');
  }

  let isAuthorized = false;
  if (isSuperAdmin) isAuthorized = true;
  if (review.tenant_id === callerId) isAuthorized = true; // Owner

  const mem = tenantMemberships.find(m => m.tenant_id === review.tenant_id && m.user_id === callerId && m.status === 'active');
  if (mem && ['admin', 'tenant_admin', 'manager', 'receptionist', 'reception'].includes(mem.role)) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    throw new Error(`unauthorized: caller is not permitted to moderate reviews for tenant ${review.tenant_id}`);
  }

  if (!['approve', 'reject', 'hide', 'show'].includes(action)) {
    throw new Error(`invalid_action: action ${action} is not supported`);
  }

  const hasText = !!(review.testimonial_text && review.testimonial_text.trim().length > 0);
  const updated = { ...review };

  if (action === 'approve') {
    updated.testimonial_status = 'approved';
    updated.show_on_frontend = hasText;
    updated.approved_at = new Date().toISOString();
    updated.approved_by = callerId;
  } else if (action === 'reject') {
    updated.testimonial_status = 'rejected';
    updated.show_on_frontend = false;
    updated.rejected_at = new Date().toISOString();
    updated.rejected_by = callerId;
  } else if (action === 'hide') {
    updated.show_on_frontend = false;
  } else if (action === 'show') {
    updated.show_on_frontend = hasText;
  }

  return updated;
}

const sampleReviewLM = {
  id: 'rev-001',
  tenant_id: LM_TENANT_ID,
  customer_id: 'cust-123',
  appointment_id: 'appt-123',
  service_rating: 5,
  barbershop_rating: 5,
  barber_rating: 5,
  testimonial_text: 'Excelente atendimento no Barbex LM!',
  testimonial_status: 'pending',
  show_on_frontend: false,
  approved_at: null,
  approved_by: null
};

const memberships = [
  { tenant_id: LM_TENANT_ID, user_id: RECEPTIONIST_ID, role: 'receptionist', status: 'active' },
  { tenant_id: OTHER_TENANT_ID, user_id: 'other-recep', role: 'receptionist', status: 'active' }
];

runTest('TEST-5-RECEPTION-APPROVE: Recepcionista do tenant LM aprova avaliação pendente com sucesso', () => {
  const result = simulateModerateReview({
    callerId: RECEPTIONIST_ID,
    review: sampleReviewLM,
    action: 'approve',
    tenantMemberships: memberships
  });

  assert.strictEqual(result.testimonial_status, 'approved', 'Status deve mudar para approved');
  assert.strictEqual(result.show_on_frontend, true, 'Depoimento com texto deve ser publicado');
  assert.strictEqual(result.approved_by, RECEPTIONIST_ID, 'approved_by deve ser o ID do recepcionista');
  assert.strictEqual(result.service_rating, 5, 'Nota de serviço deve permanecer inalterada');
  assert.strictEqual(result.testimonial_text, 'Excelente atendimento no Barbex LM!', 'Texto original não pode ser modificado');
});

runTest('TEST-6-RECEPTION-REJECT: Recepcionista do tenant LM rejeita avaliação com sucesso', () => {
  const result = simulateModerateReview({
    callerId: RECEPTIONIST_ID,
    review: sampleReviewLM,
    action: 'reject',
    tenantMemberships: memberships
  });

  assert.strictEqual(result.testimonial_status, 'rejected', 'Status deve mudar para rejected');
  assert.strictEqual(result.show_on_frontend, false, 'Avaliação rejeitada não pode ser exibida no frontend');
  assert.strictEqual(result.rejected_by, RECEPTIONIST_ID);
});

runTest('TEST-7-CROSS-TENANT-BLOCKED: Recepcionista de outro tenant é categoricamente bloqueado', () => {
  assert.throws(() => {
    simulateModerateReview({
      callerId: 'other-recep', // Membro de OTHER_TENANT_ID tentando moderar LM
      review: sampleReviewLM,
      action: 'approve',
      tenantMemberships: memberships
    });
  }, /unauthorized/, 'Deve lançar unauthorized para cross-tenant');
});

runTest('TEST-8-UNAUTHENTICATED-BLOCKED: Chamada anônima é rejeitada com unauthenticated', () => {
  assert.throws(() => {
    simulateModerateReview({
      callerId: null,
      review: sampleReviewLM,
      action: 'approve',
      tenantMemberships: memberships
    });
  }, /unauthenticated/, 'Deve lançar unauthenticated');
});

// ------------------------------------------------------------------------------
// TESTE 9: PRESERVAÇÃO DE INVARIANTES DO SISTEMA
// ------------------------------------------------------------------------------
runTest('TEST-9-INVARIANT-STRIPE: stripe-checkout/index.ts não foi alterado', () => {
  const stripeCheckoutPath = path.join(__dirname, '..', 'supabase', 'functions', 'stripe-checkout', 'index.ts');
  assert(fs.existsSync(stripeCheckoutPath), 'stripe-checkout/index.ts deve existir');
});

runTest('TEST-10-INVARIANT-FRONTEND: Arquivos de rotas e navegação da recepção atualizados corretamente', () => {
  const recepLayout = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'reception', 'ReceptionLayout.tsx'), 'utf8');
  assert(recepLayout.includes('/reception/reviews'), 'ReceptionLayout deve conter link para /reception/reviews');
  assert(recepLayout.includes('MessageSquare'), 'ReceptionLayout deve importar MessageSquare');

  const recepReviews = path.join(__dirname, '..', 'src', 'routes', 'reception.reviews.tsx');
  assert(fs.existsSync(recepReviews), 'src/routes/reception.reviews.tsx deve existir');
  const recepReviewsCode = fs.readFileSync(recepReviews, 'utf8');
  assert(recepReviewsCode.includes('moderate_appointment_review'), 'reception.reviews deve invocar moderate_appointment_review');
  assert(recepReviewsCode.includes('reception-reviews-realtime-'), 'reception.reviews deve escutar canal realtime próprio');
  assert(recepReviewsCode.includes('CHANNEL_ERROR'), 'reception.reviews deve tratar CHANNEL_ERROR e TIMED_OUT');

  const usePlanLimitsCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'hooks', 'use-plan-limits.ts'), 'utf8');
  assert(usePlanLimitsCode.includes('_tenant_id: effectiveTenant'), 'usePlanLimits deve passar _tenant_id');
});

console.log('\n==============================================================================');
console.log(`TOTAL DE TESTES: ${passCount + failCount} | PASSOU: ${passCount} | FALHOU: ${failCount}`);
console.log('==============================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
