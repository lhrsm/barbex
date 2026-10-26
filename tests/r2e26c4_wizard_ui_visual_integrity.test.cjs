/**
 * BARBEX R2E.26C.4 / R2E.26C.5 — WIZARD UI & VISUAL REGRESSION TEST SUITE
 * Validates visual standard, light-theme token compliance, elimination of dark containers,
 * customer deduplication, slot periods, financial summary formatting, and responsive classes.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

console.log('='.repeat(78));
console.log('BARBEX R2E.26C.4 / R2E.26C.5 — WIZARD UI & VISUAL INTEGRITY TEST SUITE');
console.log('='.repeat(78));

const basePath = path.join(__dirname, '..', 'src', 'components', 'calendar');

// 1. CustomerStep — Eliminates duplication, single main card, light styles
test('TEST-1-CUSTOMER-STEP-DEDUPLICATION-AND-LIGHT-CARD', () => {
  const content = fs.readFileSync(path.join(basePath, 'appointment', 'CustomerStep.tsx'), 'utf8');
  assert(content.includes('(!customer || isChanging)'), 'Must toggle between selector and primary card');
  assert(content.includes('Alterar cliente'), 'Must have button to change customer');
  assert(content.includes('border-zinc-200/90 bg-white'), 'Must use light card container');
  assert(content.includes('text-zinc-900'), 'Must use legible dark typography');
  assert(!content.includes('bg-card'), 'Must NOT use dark bg-card token');
});

// 2. DateTimeStep — Light calendar and high-contrast days
test('TEST-2-DATETIME-STEP-LIGHT-CALENDAR', () => {
  const content = fs.readFileSync(path.join(basePath, 'appointment', 'DateTimeStep.tsx'), 'utf8');
  assert(content.includes('border-zinc-200/90 bg-white'), 'Calendar container must be light');
  assert(content.includes('text-zinc-900'), 'Calendar days must have high contrast text-zinc-900');
  assert(content.includes('border border-gold'), 'Today or selected date must have gold styling');
  assert(!content.includes('bg-card'), 'Must NOT use dark bg-card token');
});

// 3. AvailableSlotsGrid — Period groups and light buttons with gold active state
test('TEST-3-SLOTS-GRID-PERIODS-AND-CONTRAST', () => {
  const content = fs.readFileSync(path.join(basePath, 'appointment', 'AvailableSlotsGrid.tsx'), 'utf8');
  assert(content.includes('PERIOD_CONFIG'), 'Must have period config for Morning, Afternoon, Evening');
  assert(content.includes('Manhã') && content.includes('Tarde') && content.includes('Noite'), 'Must display period labels');
  assert(content.includes('border-gold bg-gold text-black'), 'Selected slot must be highlighted in gold with black text');
  assert(content.includes('border-zinc-200/90 bg-zinc-50/70'), 'Unselected slot must be light button');
  assert(!content.includes('bg-card'), 'Must NOT use dark bg-card token');
});

// 4. AppointmentReviewStep — Single column responsive layout, no cramped 2-col
test('TEST-4-REVIEW-STEP-RESPONSIVE-SINGLE-COLUMN', () => {
  const content = fs.readFileSync(path.join(basePath, 'appointment', 'AppointmentReviewStep.tsx'), 'utf8');
  assert(!content.includes('lg:grid-cols-2'), 'Must NOT use rigid lg:grid-cols-2 that squishes 480px modal');
  assert(content.includes('Resumo do agendamento'), 'Must display clear header');
  assert(content.includes('onEditStep(1)'), 'Must allow editing professional/service');
  assert(content.includes('onEditStep(2)'), 'Must allow editing date/time');
  assert(content.includes('onEditStep(3)'), 'Must allow editing customer');
  assert(!content.includes('bg-card'), 'Must NOT use dark bg-card token');
});

// 5. AppointmentFinancialSummary — Tabular nums, generous spacing, high contrast
test('TEST-5-FINANCIAL-SUMMARY-LEGIBILITY', () => {
  const content = fs.readFileSync(path.join(basePath, 'appointment', 'AppointmentFinancialSummary.tsx'), 'utf8');
  assert(content.includes('tabular-nums'), 'Financial values must use tabular-nums');
  assert(content.includes('text-emerald-700'), 'Discounts/credits must use legible emerald color');
  assert(content.includes('border-zinc-200/90 bg-white'), 'Container must be light');
  assert(content.includes('font-black text-zinc-950'), 'Total must be prominent and legible');
  assert(!content.includes('bg-card'), 'Must NOT use dark bg-card token');
});

// 6. PaymentSelector — Light select triggers and menus
test('TEST-6-PAYMENT-SELECTOR-LIGHT-THEME', () => {
  const content = fs.readFileSync(path.join(basePath, 'appointment', 'PaymentSelector.tsx'), 'utf8');
  assert(content.includes('bg-zinc-50/70'), 'Select triggers must be light');
  assert(content.includes('bg-white border-zinc-200/90 text-zinc-900'), 'SelectContent must be light');
  assert(!content.includes('bg-card'), 'Must NOT use dark bg-card token');
});

// 7. AppointmentModal — Context-aware header and robust footer
test('TEST-7-APPOINTMENT-MODAL-HEADER-AND-FOOTER', () => {
  const content = fs.readFileSync(path.join(basePath, 'AppointmentModal.tsx'), 'utf8');
  assert(content.includes('Painel da Recepção'), 'Must show Painel da Recepção on reception route');
  assert(content.includes('Painel Administrativo'), 'Must preserve Painel Administrativo for admin');
  assert(content.includes('bg-gold text-black'), 'Confirmation button must be gold with black text');
  assert(content.includes('Loader2'), 'Must show loading indicator during submission');
});

// 8. Invariants — Stripe and Entitlements untouched
test('TEST-8-INVARIANT-STRIPE-AND-SECURITY', () => {
  const stripeContent = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'stripe-checkout', 'index.ts'), 'utf8');
  assert(stripeContent.includes('ENABLE_SELF_SERVICE_REFUNDS'), 'Must check ENABLE_SELF_SERVICE_REFUNDS');
  assert(!stripeContent.includes('mock_checkout'), 'No mock checkout');
});

console.log('='.repeat(78));
console.log(`TOTAL DE TESTES: ${passed + failed} | PASSOU: ${passed} | FALHOU: ${failed}`);
console.log('='.repeat(78));

if (failed > 0) process.exit(1);
