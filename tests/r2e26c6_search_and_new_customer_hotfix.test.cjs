/**
 * BARBEX R2E.26C.6 — SEARCH FIELDS & NEW CUSTOMER BUTTON VISUAL HOTFIX TEST SUITE
 * Validates:
 * 1. ProfessionalSelector: input has light background, dark text, zinc-500 placeholder, gold focus.
 * 2. CustomerSelector: "Novo cliente" button is gold with dark text; search input is light.
 * 3. ServiceSelector: search input is light with gold focus.
 * 4. AppointmentModal: new customer modal dialog has light background and gold save button.
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
console.log('BARBEX R2E.26C.6 — SEARCH & NEW CUSTOMER HOTFIX TEST SUITE');
console.log('='.repeat(78));

const basePath = path.join(__dirname, '..', 'src', 'components', 'calendar');

test('TEST-1-PROFESSIONAL-SEARCH-LIGHT-STYLING', () => {
  const content = fs.readFileSync(path.join(basePath, 'appointment', 'ProfessionalSelector.tsx'), 'utf8');
  assert(content.includes('<input'), 'Must use native input tag');
  assert(content.includes('text-zinc-900'), 'Text must be dark zinc-900');
  assert(content.includes('placeholder:text-zinc-500'), 'Placeholder must be zinc-500');
  assert(content.includes('focus-within:border-gold') || content.includes('focus-within:ring-gold'), 'Must have gold focus highlights');
  assert(content.includes('bg-zinc-50/80') || content.includes('bg-white'), 'Search container must be light');
});

test('TEST-2-CUSTOMER-NEW-CLIENT-BUTTON-GOLD', () => {
  const content = fs.readFileSync(path.join(basePath, 'appointment', 'CustomerSelector.tsx'), 'utf8');
  assert(content.includes('Novo cliente'), 'Must have Novo cliente text');
  assert(content.includes('bg-gold'), 'Novo cliente button must have bg-gold');
  assert(content.includes('text-black'), 'Novo cliente button text must be text-black for high contrast');
  assert(content.includes('hover:bg-gold-500'), 'Novo cliente button must have hover:bg-gold-500');
});

test('TEST-3-CUSTOMER-SEARCH-LIGHT-STYLING', () => {
  const content = fs.readFileSync(path.join(basePath, 'appointment', 'CustomerSelector.tsx'), 'utf8');
  assert(content.includes('<input'), 'Must use native input tag');
  assert(content.includes('text-zinc-900'), 'Text must be dark zinc-900');
  assert(content.includes('placeholder:text-zinc-500'), 'Placeholder must be zinc-500');
  assert(content.includes('focus-within:border-gold') || content.includes('focus-within:ring-gold'), 'Must have gold focus highlights');
});

test('TEST-4-SERVICE-SEARCH-LIGHT-STYLING', () => {
  const content = fs.readFileSync(path.join(basePath, 'appointment', 'ServiceSelector.tsx'), 'utf8');
  assert(content.includes('<input'), 'Must use native input tag');
  assert(content.includes('text-zinc-900'), 'Text must be dark zinc-900');
  assert(content.includes('placeholder:text-zinc-500'), 'Placeholder must be zinc-500');
  assert(content.includes('focus-within:border-gold') || content.includes('focus-within:ring-gold'), 'Must have gold focus highlights');
});

test('TEST-5-NEW-CUSTOMER-DIALOG-HARMONY', () => {
  const content = fs.readFileSync(path.join(basePath, 'AppointmentModal.tsx'), 'utf8');
  assert(content.includes('Cadastrar novo cliente'), 'Must have Cadastrar novo cliente dialog');
  assert(content.includes('bg-white text-zinc-900'), 'Dialog content must be light');
  assert(content.includes('bg-gold text-black'), 'Save client button must be gold with black text');
});

test('TEST-6-NO-REGRESSION-ACTIONS', () => {
  const custSel = fs.readFileSync(path.join(basePath, 'appointment', 'CustomerSelector.tsx'), 'utf8');
  assert(custSel.includes('onClick={onCreateNew}'), 'onCreateNew handler must remain untouched');
  const profSel = fs.readFileSync(path.join(basePath, 'appointment', 'ProfessionalSelector.tsx'), 'utf8');
  assert(profSel.includes('onChange(list[highlightedIndex].id)'), 'Selection handler must remain untouched');
});

console.log('='.repeat(78));
console.log(`TOTAL DE TESTES: ${passed + failed} | PASSOU: ${passed} | FALHOU: ${failed}`);
console.log('='.repeat(78));

if (failed > 0) process.exit(1);
