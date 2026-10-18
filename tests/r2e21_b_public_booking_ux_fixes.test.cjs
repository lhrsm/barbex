const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- BARBEX R2E.21B & R2E.21B.1 UX & BOOKING FIXES VALIDATION SUITE ---');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Test ${totalTests}: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${description}`);
    console.error(err);
  }
}

const slugPath = path.join(__dirname, '..', 'src', 'routes', '$slug.tsx');
const slugContent = fs.readFileSync(slugPath, 'utf8');

const stickyCtaPath = path.join(__dirname, '..', 'src', 'components', 'public', 'PortalStickyCta.tsx');
const stickyCtaContent = fs.readFileSync(stickyCtaPath, 'utf8');

const pwaPromptPath = path.join(__dirname, '..', 'src', 'components', 'pwa', 'InstallBarbexAppPrompt.tsx');
const pwaPromptContent = fs.readFileSync(pwaPromptPath, 'utf8');

const a11yPath = path.join(__dirname, '..', 'src', 'components', 'accessibility', 'AccessibilityWidget.tsx');
const a11yContent = fs.readFileSync(a11yPath, 'utf8');

const pwaHookPath = path.join(__dirname, '..', 'src', 'hooks', 'use-pwa-install.ts');
const pwaHookContent = fs.readFileSync(pwaHookPath, 'utf8');

// R2E.21B.1 FASE 1: REMOÇÃO DO INSTAGRAM DO HEADER
test('R2E.21B.1 FASE 1: Instagram icon/link removed from the public header', () => {
  const headerMatch = slugContent.match(/<header[\s\S]*?<\/header>/);
  assert(headerMatch, 'Header must exist in $slug.tsx');
  const headerContent = headerMatch[0];
  const topBarContent = headerContent.split('<Sheet')[0];
  assert(!topBarContent.includes('instagram'), 'Public header top bar must NOT contain Instagram link or icon');
  assert(slugContent.includes('key: "instagram"'), 'Instagram must be preserved in footer/social sections');
});

// R2E.21B.1 FASE 2: REORGANIZAÇÃO DO HEADER
test('R2E.21B.1 FASE 2: Barbershop name is visible and legible on mobile (< sm)', () => {
  assert(!slugContent.includes('<div className="hidden sm:block">\n                        <span className="font-extrabold text-sm md:text-base text-white tracking-tight group-hover:text-gold transition-colors line-clamp-1">\n                          {shop.business_name}'), 'Business name must not be hidden on mobile');
  assert(slugContent.includes('truncate max-w-[110px] xs:max-w-[160px] sm:max-w-[220px] md:max-w-none'), 'Business name must have responsive truncation');
});

test('R2E.21B.1 FASE 2: Header has compact responsive heights and whitespace-nowrap booking button', () => {
  assert(slugContent.includes('scrolled ? "h-14 sm:h-16 lg:h-[72px]" : "h-16 sm:h-20 lg:h-[86px]"'), 'Header should use compact responsive heights');
  assert(slugContent.includes('whitespace-nowrap') && slugContent.includes('h-9 px-3.5 text-xs sm:h-11 sm:px-6 sm:text-sm'), 'Agendar button must be whitespace-nowrap and appropriately sized');
});

// R2E.21B.1 FASE 3: REMOÇÃO DE CTA FLUTUANTE DUPLICADO NO MOBILE
test('R2E.21B.1 FASE 3: Duplicate floating mobile CTA is removed in favor of sticky header', () => {
  assert(!slugContent.includes('<PortalStickyCta'), '$slug.tsx must not render redundant floating PortalStickyCta');
  assert(!slugContent.includes('className="md:hidden h-[calc(80px+env(safe-area-inset-bottom,0px))]"'), '$slug.tsx should remove bottom spacer');
  assert(stickyCtaContent.includes('return null;'), 'PortalStickyCta should be safely disabled');
});

// R2E.21B.1 FASE 4: PROMPT PWA CONTEXTUAL E NÃO INTRUSIVO
test('R2E.21B.1 FASE 4: InstallBarbexAppPrompt is integrated in-page and hidden during modals', () => {
  assert(pwaPromptContent.includes('hidden?: boolean;'), 'InstallBarbexAppPrompt must support hidden prop');
  assert(slugContent.includes('InstallBarbexAppPrompt') && slugContent.includes('variant="inline"') && slugContent.includes('hidden={isBookingOpen || isCartOpen}'), 'PWA prompt must be rendered inline before footer and hidden during modals');
  assert(pwaHookContent.includes('const DISMISS_DAYS = 30;'), 'PWA dismiss persistence must be at least 30 days');
});

// R2E.21B.1 FASE 5: CONTROLES DE ACESSIBILIDADE E VOLTAR AO TOPO
test('R2E.21B.1 FASE 5: AccessibilityWidget uses z-30, safe area, and left-side positioning', () => {
  assert(a11yContent.includes('z-30'), 'AccessibilityWidget must use z-30 to yield to modals (z-50)');
  assert(a11yContent.includes('env(safe-area-inset-bottom,0px)'), 'AccessibilityWidget must respect safe area');
  assert(a11yContent.includes('left-4') && a11yContent.includes('md:left-6'), 'AccessibilityWidget must be on the left to avoid BackToTopButton on the right');
});

test('R2E.21B.1 FASE 5: BackToTopButton uses z-30, safe area, and hides during booking/cart modals', () => {
  assert(slugContent.includes('BackToTopButton hidden={isBookingOpen || isCartOpen}'), 'BackToTopButton must hide when modal is open');
  assert(slugContent.includes('className={`fixed right-4 md:right-6 z-30'), 'BackToTopButton must use z-30 on right side');
});

// R2E.21B FASES 2-6: NÃO REGRESSÃO DO FLUXO DE AGENDAMENTO
test('R2E.21B FASE 2: Step 1 mobile banner is compacted to h-[96px]', () => {
  assert(slugContent.includes('relative h-[96px] md:h-auto md:min-h-[560px]'), 'Step 1 banner must be compact h-[96px] on mobile');
});

test('R2E.21B FASE 2: Step 1 PhoneInput borders and radius are aligned without seams', () => {
  assert(slugContent.includes('!rounded-r-xl !rounded-l-none'), 'PhoneInput input must have rounded-r-xl rounded-l-none');
  assert(slugContent.includes('!rounded-l-xl !rounded-r-none'), 'PhoneInput country button must have rounded-l-xl rounded-r-none');
});

test('R2E.21B FASE 2: Step 1 benefits list is compacted into a 2-column grid', () => {
  assert(slugContent.includes('grid grid-cols-2 gap-1.5 px-1'), 'Step 1 benefits must use 2-column grid on mobile');
});

test('R2E.21B FASE 2: Step 1 provides clear guidance when terms are unaccepted', () => {
  assert(slugContent.includes('Marque o aceite obrigatório dos Termos e Privacidade acima para continuar'), 'Must show clear warning when terms not accepted');
  assert(slugContent.includes('Termos de Uso') && slugContent.includes('<span className="text-amber-700 font-bold">*</span>'), 'Terms must have required asterisk');
});

test('R2E.21B FASE 3: Step 3 renders informative empty state when no barbers available for service/date', () => {
  assert(slugContent.includes('Nenhum profissional disponível para esta data'), 'Step 3 must have empty state title');
  assert(slugContent.includes('id="step3-date-input"'), 'Step 3 date input must have id for programmatic focus');
  assert(slugContent.includes('Escolher outra data'), 'Step 3 empty state must offer action to choose another date');
  assert(slugContent.includes('Trocar serviço'), 'Step 3 empty state must offer action to switch service');
});

test('R2E.21B FASE 4: Step 4 provides clear action to alter date or barber', () => {
  assert(slugContent.includes('Alterar data ou barbeiro'), 'Step 4 header must offer alter date or barber action');
  assert(slugContent.includes('Nenhum horário disponível em'), 'Step 4 empty state must specify the formatted date');
  assert(slugContent.includes('setBookingStep(3)'), 'Alter date actions in Step 4 must return to Step 3 seamlessly');
});

test('R2E.21B FASE 5: Step 5 validates real PIX configuration before showing PIX option', () => {
  assert(slugContent.includes('hasValidPix'), 'Step 5 must verify hasValidPix');
  assert(slugContent.includes("shop.pix_key.toLowerCase() !== 'chave não cadastrada'"), 'Must reject placeholder chave não cadastrada');
  assert(slugContent.includes('hasValidPix ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"'), 'Must collapse grid when PIX is unavailable');
});

test('R2E.21B FASE 6: Marketplace categories use w-full instead of w-screen -mx-4', () => {
  assert(slugContent.includes('className="w-full mt-3 mb-4 lg:mb-12 overflow-hidden"'), 'Category wrapper must use w-full');
  assert(!slugContent.includes('w-screen sm:w-auto overflow-hidden'), 'Should no longer have w-screen wrapper');
});

test('R2E.21B FASE 6: Secondary PhoneInput in identify modal has aligned border radiuses', () => {
  assert(slugContent.includes('!rounded-r-md !rounded-l-none'), 'Identify modal PhoneInput must be rounded-r-md');
  assert(slugContent.includes('!rounded-l-md !rounded-r-none'), 'Identify modal country selector must be rounded-l-md');
});

console.log(`\nTESTS COMPLETED: ${passedTests}/${totalTests} PASS (${Math.round((passedTests / totalTests) * 100)}%)`);

if (passedTests !== totalTests) {
  process.exit(1);
}
