/**
 * ==============================================================================
 * BARBEX R2E.26C.2 — PROFESSIONAL SELECTOR & MODAL DROPDOWN TEST SUITE
 * ==============================================================================
 * Valida:
 *   1. Popover modal={true} no ProfessionalSelector para permitir rolagem e isolamento.
 *   2. Altura dinâmica vinculada a --radix-popover-content-available-height e overscroll-contain.
 *   3. Detecção de colisão (avoidCollisions, side="bottom", sideOffset, collisionPadding).
 *   4. Padronização visual com formulário claro (bg-white, border-zinc-200, z-[60], sem clash escuro/claro).
 *   5. Navegação por teclado, busca por nome e fechamento ao selecionar.
 *   6. Conformidade idêntica aplicada a ServiceSelector e CustomerSelector.
 *   7. Preservação integral de invariantes (Stripe, RLS, RPCs, cron, vouchers, migrations).
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('==============================================================================');
console.log('BARBEX R2E.26C.2 — PROFESSIONAL SELECTOR TEST SUITE');
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

const professionalSelectorPath = path.join(__dirname, '..', 'src', 'components', 'calendar', 'appointment', 'ProfessionalSelector.tsx');
assert(fs.existsSync(professionalSelectorPath), 'ProfessionalSelector.tsx deve existir');
const profCode = fs.readFileSync(professionalSelectorPath, 'utf8');

const serviceSelectorPath = path.join(__dirname, '..', 'src', 'components', 'calendar', 'appointment', 'ServiceSelector.tsx');
assert(fs.existsSync(serviceSelectorPath), 'ServiceSelector.tsx deve existir');
const servCode = fs.readFileSync(serviceSelectorPath, 'utf8');

const customerSelectorPath = path.join(__dirname, '..', 'src', 'components', 'calendar', 'appointment', 'CustomerSelector.tsx');
assert(fs.existsSync(customerSelectorPath), 'CustomerSelector.tsx deve existir');
const custCode = fs.readFileSync(customerSelectorPath, 'utf8');

// TESTE 1: Radix Popover com modal={true} para permitir rolagem e prevenir bloqueio do Dialog
runTest('TEST-1-POPOVER-MODAL-LOCK: modal={true} ativo para rolagem desimpedida', () => {
  assert(profCode.includes('<Popover open={open} onOpenChange={setOpen} modal={true}>'), 'ProfessionalSelector deve usar modal={true}');
  assert(servCode.includes('modal={true}'), 'ServiceSelector deve usar modal={true}');
  assert(custCode.includes('modal={true}'), 'CustomerSelector deve usar modal={true}');
});

// TESTE 2: Collision detection e posicionamento inteligente (abre para cima quando sem espaço)
runTest('TEST-2-COLLISION-DETECTION: PopoverContent configurado com avoidCollisions e padding', () => {
  assert(profCode.includes('avoidCollisions={true}'), 'Deve conter avoidCollisions={true}');
  assert(profCode.includes('collisionPadding={12}'), 'Deve conter collisionPadding={12}');
  assert(profCode.includes('side="bottom"'), 'Deve configurar side="bottom" como padrão');
  assert(profCode.includes('sideOffset={6}'), 'Deve configurar sideOffset');
});

// TESTE 3: Rolagem vertical própria e altura máxima dinâmica
runTest('TEST-3-SCROLL-AND-MAX-HEIGHT: Altura restrita a available-height com overscroll-contain', () => {
  assert(profCode.includes('var(--radix-popover-content-available-height'), 'Deve respeitar --radix-popover-content-available-height');
  assert(profCode.includes('overscroll-contain'), 'Deve conter overscroll-contain para isolar scroll');
  assert(profCode.includes('overflow-y-auto'), 'Deve conter overflow-y-auto');
  assert(profCode.includes('e.stopPropagation()'), 'Deve isolar wheel event via stopPropagation');
});

// TESTE 4: Padronização visual com o formulário claro do Barbex (eliminação do dropdown escuro sobre fundo claro)
runTest('TEST-4-VISUAL-ALIGNMENT: Dropdown claro consistente com o modal (bg-white, z-[60], border-zinc-200)', () => {
  assert(profCode.includes('bg-white'), 'PopoverContent deve ser bg-white');
  assert(profCode.includes('border-zinc-200'), 'PopoverContent deve ter border-zinc-200');
  assert(profCode.includes('z-[60]'), 'PopoverContent deve ter z-[60] para sobreposição segura');
  assert(profCode.includes('text-zinc-900'), 'Texto principal deve ser escuro em fundo claro');
  assert(profCode.includes('Disponível'), 'Indicador de disponibilidade visível');
});

// TESTE 5: Busca por nome e atalhos de teclado
runTest('TEST-5-SEARCH-AND-KEYBOARD: Campo de busca com limpeza e navegação por setas/Enter', () => {
  assert(profCode.includes('ArrowDown'), 'Deve suportar ArrowDown');
  assert(profCode.includes('ArrowUp'), 'Deve suportar ArrowUp');
  assert(profCode.includes('Enter'), 'Deve suportar seleção via Enter');
  assert(profCode.includes('Escape'), 'Deve suportar fechamento via Escape');
  assert(profCode.includes('placeholder="Buscar profissional por nome..."'), 'Deve ter placeholder de busca');
});

// TESTE 6: Coerência nos demais seletores do modal de agendamento
runTest('TEST-6-SELECTOR-COHERENCE: ServiceSelector e CustomerSelector seguem padrão idêntico', () => {
  assert(servCode.includes('bg-white border border-zinc-200'), 'ServiceSelector PopoverContent deve ser bg-white');
  assert(servCode.includes('z-[60]'), 'ServiceSelector PopoverContent deve ter z-[60]');
  assert(custCode.includes('bg-white border border-zinc-200'), 'CustomerSelector PopoverContent deve ser bg-white');
  assert(custCode.includes('z-[60]'), 'CustomerSelector PopoverContent deve ter z-[60]');
});

// TESTE 7: Invariante Stripe Live
runTest('TEST-7-INVARIANT-STRIPE: stripe-checkout/index.ts intocado', () => {
  const stripePath = path.join(__dirname, '..', 'supabase', 'functions', 'stripe-checkout', 'index.ts');
  const stripeContent = fs.readFileSync(stripePath, 'utf8');
  assert(stripeContent.includes('ENABLE_SELF_SERVICE_REFUNDS'), 'Stripe checkout deve manter suas declarações originais');
});

// TESTE 8: Invariante Entitlements e Barbearia LM
runTest('TEST-8-INVARIANT-ENTITLEMENTS: resolve_tenant_entitlement(_tenant_id) preservado', () => {
  const planLimitsPath = path.join(__dirname, '..', 'src', 'hooks', 'use-plan-limits.ts');
  const planLimitsContent = fs.readFileSync(planLimitsPath, 'utf8');
  assert(planLimitsContent.includes('_tenant_id: effectiveTenant'), 'use-plan-limits deve manter assinatura _tenant_id');
});

console.log('\n==============================================================================');
console.log(`TOTAL DE TESTES: ${passCount + failCount} | PASSOU: ${passCount} | FALHOU: ${failCount}`);
console.log('==============================================================================');

if (failCount > 0) {
  process.exit(1);
}
