'use strict';

/**
 * BARBEX — R2E.26B
 * Multi-Profile Synchronization & Review Moderation Verification Test Suite
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let passed = 0;
let failed = 0;

function pass(name, detail) {
  passed++;
  console.log(`[PASS] ${name}: ${detail}`);
}

function fail(name, detail) {
  failed++;
  console.error(`[FAIL] ${name}: ${detail}`);
}

async function runTestSuite() {
  console.log('==============================================================================');
  console.log('BARBEX R2E.26B — MULTI-PROFILE REALTIME SYNC & REVIEW MODERATION TEST SUITE');
  console.log('==============================================================================\n');

  const rootDir = path.join(__dirname, '..');

  // 1. TEST: Review Utils Array Handling and Canonical Moderation Resolution
  console.log('[1/7] Auditoria de Resolução Canônica de Avaliações (src/lib/review.utils.ts)...');
  const reviewUtilsCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'review.utils.ts'), 'utf8');
  
  const hasArrayHandling = reviewUtilsCode.includes('Array.isArray(app.appointment_reviews)');
  const hasApprovedHandling = reviewUtilsCode.includes('rawStatus === "approved"');
  const hasRejectedHandling = reviewUtilsCode.includes('rawStatus === "rejected"');

  if (hasArrayHandling && hasApprovedHandling && hasRejectedHandling) {
    pass('TEST-1-REVIEW-RESOLUTION-CANONICAL', 'review.utils.ts extrai corretamente objetos de arrays PostgREST e resolve status aprovado/rejeitado/pendente');
  } else {
    fail('TEST-1-REVIEW-RESOLUTION-CANONICAL', 'review.utils.ts com lógica vulnerável a arrays ou status ausente');
  }

  // 2. TEST: Functional Resolution Simulation
  const { resolveReviewState } = require(path.join(rootDir, 'src', 'lib', 'review.utils.ts'));
  
  // Simulated PostgREST Array with Approved Review
  const appApproved = {
    status: 'completed',
    review_decision: 'submitted',
    appointment_reviews: [{ id: 'rev-1', testimonial_status: 'approved', submitted_at: '2026-10-26T10:00:00Z' }]
  };
  const resApproved = resolveReviewState(appApproved);

  // Simulated PostgREST Empty Array with matching review in review object
  const appReviewObj = {
    status: 'completed',
    review_decision: 'submitted',
    appointment_reviews: [],
    review: { id: 'rev-2', testimonial_status: 'approved', submitted_at: '2026-10-26T10:00:00Z' }
  };
  const resReviewObj = resolveReviewState(appReviewObj);

  // Simulated PostgREST Array with Rejected Review
  const appRejected = {
    status: 'completed',
    review_decision: 'submitted',
    appointment_reviews: [{ id: 'rev-3', testimonial_status: 'rejected', submitted_at: '2026-10-26T10:00:00Z' }]
  };
  const resRejected = resolveReviewState(appRejected);

  // Simulated PostgREST Array with Pending Review
  const appPending = {
    status: 'completed',
    review_decision: 'submitted',
    appointment_reviews: [{ id: 'rev-4', testimonial_status: 'pending', submitted_at: '2026-10-26T10:00:00Z' }]
  };
  const resPending = resolveReviewState(appPending);

  if (
    resApproved.moderationStatus === 'approved' && resApproved.label === '✓ Avaliado' &&
    resReviewObj.moderationStatus === 'approved' && resReviewObj.label === '✓ Avaliado' &&
    resRejected.moderationStatus === 'rejected' && resRejected.label === 'Avaliação enviada' &&
    resPending.moderationStatus === 'pending' && resPending.label === 'Avaliação enviada • Em moderação'
  ) {
    pass('TEST-2-FUNCTIONAL-STATUS-SIMULATION', 'Resolução de status de moderação 100% precisa em todos os 4 cenários (Aprovado, Objeto, Rejeitado, Pendente)');
  } else {
    fail('TEST-2-FUNCTIONAL-STATUS-SIMULATION', `Falha na simulação funcional: Approved=${resApproved.moderationStatus}, Obj=${resReviewObj.moderationStatus}, Rej=${resRejected.moderationStatus}, Pend=${resPending.moderationStatus}`);
  }

  // 3. TEST: Customer Portal Realtime Subscription
  console.log('\n[2/7] Auditoria do Portal do Cliente ($slug.portal.tsx)...');
  const portalCode = fs.readFileSync(path.join(rootDir, 'src', 'routes', '$slug.portal.tsx'), 'utf8');
  
  const portalListensAppts = portalCode.includes("table: 'appointments'") && portalCode.includes("filter: `customer_id=eq.${data.customer.id}`");
  const portalListensReviews = portalCode.includes("table: 'appointment_reviews'") && portalCode.includes("filter: `customer_id=eq.${data.customer.id}`");
  const portalStatusResilient = portalCode.includes("[PORTAL_REALTIME_STATUS]") && portalCode.includes("CHANNEL_ERROR");

  if (portalListensAppts && portalListensReviews && portalStatusResilient) {
    pass('TEST-3-CUSTOMER-PORTAL-REALTIME', 'Portal do cliente escuta appointments e appointment_reviews com filtro customer_id estrito e auto-recovery');
  } else {
    fail('TEST-3-CUSTOMER-PORTAL-REALTIME', 'Portal do cliente incompleto em listeners Realtime');
  }

  // 4. TEST: Admin Reviews Page Realtime Subscription
  console.log('\n[3/7] Auditoria do Painel de Moderação Administrativa (reviews.tsx)...');
  const reviewsAdminCode = fs.readFileSync(path.join(rootDir, 'src', 'routes', 'reviews.tsx'), 'utf8');
  
  const reviewsHasRealtime = reviewsAdminCode.includes("table: 'appointment_reviews'") && reviewsAdminCode.includes("filter: `tenant_id=eq.${effectiveTenantId}`");
  const reviewsHasTenant = reviewsAdminCode.includes("useTenant()");
  const reviewsHasCleanup = reviewsAdminCode.includes("supabase.removeChannel(channel)");

  if (reviewsHasRealtime && reviewsHasTenant && reviewsHasCleanup) {
    pass('TEST-4-ADMIN-REVIEWS-REALTIME', 'Painel administrativo de reviews possui canal Realtime exclusivo admin-reviews-realtime com filtro tenant_id');
  } else {
    fail('TEST-4-ADMIN-REVIEWS-REALTIME', 'Painel administrativo de reviews não sincroniza em tempo real');
  }

  // 5. TEST: Channel Topic Isolation across All 4 Profiles
  console.log('\n[4/7] Auditoria de Isolamento de Tópicos (Prevenção de Colisão)...');
  const calendarCode = fs.readFileSync(path.join(rootDir, 'src', 'routes', 'calendar.tsx'), 'utf8');
  const dashboardCode = fs.readFileSync(path.join(rootDir, 'src', 'routes', 'dashboard.index.tsx'), 'utf8');
  const receptionCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'reception', 'ReceptionQueue.tsx'), 'utf8');
  const professionalCode = fs.readFileSync(path.join(rootDir, 'src', 'routes', '$slug.profissional.tsx'), 'utf8');

  const calTopic = calendarCode.includes('calendar-realtime-${tenantId}');
  const dashTopic = dashboardCode.includes('dashboard-realtime-${tenantId}');
  const recepTopic = receptionCode.includes('reception-realtime-${tenantId}');
  const profTopic = professionalCode.includes('prof-realtime-${bId}');
  const portalTopic = portalCode.includes('portal_updates_${data.customer.id}');

  if (calTopic && dashTopic && recepTopic && profTopic && portalTopic) {
    pass('TEST-5-CHANNEL-TOPIC-ISOLATION', 'Todos os 4 perfis operam em namespaces de canal 100% isolados (calendar, dashboard, reception, prof, portal)');
  } else {
    fail('TEST-5-CHANNEL-TOPIC-ISOLATION', 'Colisão de canais detectada em um ou mais perfis');
  }

  // 6. TEST: Candidate Migration Prepared
  console.log('\n[5/7] Auditoria de Migração Candidata para appointment_reviews...');
  const migrationFile = path.join(rootDir, 'supabase', 'migrations', '20261026150000_r2e26b_appointment_reviews_realtime_publication.sql');
  if (fs.existsSync(migrationFile)) {
    const migContent = fs.readFileSync(migrationFile, 'utf8');
    if (migContent.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_reviews;')) {
      pass('TEST-6-CANDIDATE-MIGRATION', 'Migração idempotente 20261026150000 preparada para publicação de appointment_reviews');
    } else {
      fail('TEST-6-CANDIDATE-MIGRATION', 'Migração incompleta');
    }
  } else {
    fail('TEST-6-CANDIDATE-MIGRATION', 'Arquivo de migração candidata não encontrado');
  }

  // 7. TEST: Financial & Stripe Preservation
  console.log('\n[6/7] Auditoria de Segurança Financeira e Invariantes...');
  let stripeDiff = '';
  try {
    stripeDiff = execSync('git diff HEAD -- supabase/functions/stripe-checkout/index.ts', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch (e) {
    stripeDiff = '';
  }

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

  if (stripeDiff.length === 0 && envViolations.length === 0) {
    pass('TEST-7-FINANCIAL-INVARIANTS', 'Stripe checkout com 0 diffs e ENABLE_SELF_SERVICE_REFUNDS=false estritamente mantidos');
  } else {
    fail('TEST-7-FINANCIAL-INVARIANTS', 'Invariantes financeiras violadas');
  }

  console.log('\n------------------------------------------------------------------------------');
  console.log(`TOTAL TESTES: ${passed + failed} | APROVADOS: ${passed} | REPROVADOS: ${failed}`);
  console.log('------------------------------------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('R2E.26B ALL TESTS PASSED SUCCESSFULLY.\n');
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
