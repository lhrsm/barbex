const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('BARBEX — R2E.26E.17 TEST SUITE: COMANDA MODAL RESPONSIVENESS');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] T${totalTests.toString().padStart(2, '0')}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] T${totalTests.toString().padStart(2, '0')}: ${name}`);
    console.error(`       ${err.message}`);
  }
}

const comandaFilePath = path.join(__dirname, '..', 'src', 'components', 'calendar', 'ComandaModal.tsx');
const comandaCode = fs.readFileSync(comandaFilePath, 'utf8');

// T01: File exists and is non-empty
test('Arquivo ComandaModal.tsx existe e tem conteúdo válido', () => {
  assert.ok(fs.existsSync(comandaFilePath), 'ComandaModal.tsx deve existir');
  assert.ok(comandaCode.length > 500, 'ComandaModal.tsx não deve estar vazio');
});

// T02: DialogContent layout structure
test('DialogContent possui container flex com limites de altura proporcionais à viewport', () => {
  assert.ok(comandaCode.includes('max-h-[85vh]'), 'Deve ter max-h-[85vh] para mobile');
  assert.ok(comandaCode.includes('sm:max-h-[88vh]'), 'Deve ter sm:max-h-[88vh] para telas maiores');
  assert.ok(comandaCode.includes('flex flex-col'), 'Deve usar layout flex flex-col para estrutura sólida');
  assert.ok(comandaCode.includes('overflow-hidden'), 'DialogContent deve ter overflow-hidden para não vazar a tela');
});

// T03: Responsive width limits
test('DialogContent tem largura máxima responsiva com margens seguras', () => {
  assert.ok(comandaCode.includes('w-[calc(100%-1.5rem)]'), 'Deve respeitar margens seguras em telas estreitas');
  assert.ok(comandaCode.includes('max-w-md'), 'Limite inicial para mobile');
  assert.ok(comandaCode.includes('md:max-w-3xl'), 'Limite para tablet / notebook');
  assert.ok(comandaCode.includes('lg:max-w-4xl'), 'Limite amplo para desktop');
});

// T04: Header visibility and compactness
test('DialogHeader é flex-shrink-0 com padding proporcional e visual compacto', () => {
  assert.ok(comandaCode.includes('flex-shrink-0'), 'Header não pode encolher');
  assert.ok(comandaCode.includes('ShoppingBag'), 'Ícone de comanda deve estar presente');
  assert.ok(comandaCode.includes('Comanda Digital'), 'Título Comanda Digital mantido');
  assert.ok(!comandaCode.includes('p-8'), 'Padding excessivo p-8 deve ser removido');
});

// T05: Independent column scrolling on desktop
test('Desktop possui duas colunas com rolagem interna independente', () => {
  assert.ok(comandaCode.includes('md:grid-cols-2'), 'Deve manter grid de 2 colunas em md+');
  assert.ok(comandaCode.includes('md:overflow-hidden'), 'Container do body deve travar overflow no grid md+');
  assert.ok(comandaCode.includes('md:overflow-y-auto'), 'Colunas devem ter rolagem vertical independente no desktop');
  assert.ok(comandaCode.includes('md:divide-x'), 'Divisória elegante entre produtos e comanda no desktop');
});

// T06: Unified vertical scroll on mobile
test('Mobile possui layout de coluna única com rolagem contínua', () => {
  assert.ok(comandaCode.includes('grid-cols-1'), 'Deve ter 1 coluna em mobile');
  assert.ok(comandaCode.includes('overflow-y-auto md:overflow-hidden'), 'Body deve rolar naturalmente em mobile');
  assert.ok(comandaCode.includes('divide-y'), 'Divisória vertical entre produtos e comanda no mobile');
});

// T07: Footer accessibility and sticky action
test('DialogFooter é flex-shrink-0 e sempre acessível', () => {
  assert.ok(comandaCode.includes('DialogFooter'), 'DialogFooter deve estar presente');
  assert.ok(comandaCode.includes('Fechar Comanda'), 'Botão Fechar Comanda mantido');
  assert.ok(comandaCode.includes('flex-shrink-0'), 'Footer não pode encolher');
});

// T08: Mobile inline total in footer
test('Mobile exibe total no rodapé para visibilidade imediata', () => {
  assert.ok(comandaCode.includes('sm:hidden'), 'Deve haver visualização do total resumido para mobile');
  assert.ok(comandaCode.includes('comandaTotal.toFixed(2)'), 'Total deve ser formatado corretamente');
});

// T09: RPC add_product_to_comanda preserved
test('RPC add_product_to_comanda e parâmetros preservados sem alterações', () => {
  assert.ok(comandaCode.includes('add_product_to_comanda'), 'RPC add_product_to_comanda deve ser chamada');
  assert.ok(comandaCode.includes('p_appointment_id: appointmentId'), 'appointmentId deve ser enviado');
  assert.ok(comandaCode.includes('p_product_id: product.id'), 'product.id deve ser enviado');
  assert.ok(comandaCode.includes('p_quantity: qty'), 'quantidade deve ser enviada');
});

// T10: RPC remove_comanda_item preserved
test('RPC remove_comanda_item preservada sem alterações', () => {
  assert.ok(comandaCode.includes('remove_comanda_item'), 'RPC remove_comanda_item deve ser chamada');
  assert.ok(comandaCode.includes('p_sale_id: saleId'), 'p_sale_id deve ser enviado');
});

// T11: Stock validation logic preserved
test('Validação de estoque e feedback mantidos', () => {
  assert.ok(comandaCode.includes('product.stock_quantity < qty'), 'Guarda de quantidade x estoque');
  assert.ok(comandaCode.includes('Estoque insuficiente'), 'Mensagem de erro de estoque');
  assert.ok(comandaCode.includes('noStock'), 'Flag de estoque zero/negativo');
});

// T12: React Query invalidation and refresh preserved
test('Invalidações de cache e callback onChanged preservados', () => {
  assert.ok(comandaCode.includes('invalidateQueries({ queryKey: ["appointments"] })'), 'Invalida appointments');
  assert.ok(comandaCode.includes('invalidateQueries({ queryKey: ["calendar"] })'), 'Invalida calendar');
  assert.ok(comandaCode.includes('onChanged?.()'), 'Dispara callback onChanged');
});

// T13: Touch targets and accessibility
test('Controles de quantidade e botões possuem targets e acessibilidade', () => {
  assert.ok(comandaCode.includes('aria-label="Diminuir quantidade"'), 'Aria-label no botão menos');
  assert.ok(comandaCode.includes('aria-label="Aumentar quantidade"'), 'Aria-label no botão mais');
  assert.ok(comandaCode.includes('aria-label="Remover item da comanda"'), 'Aria-label no botão lixeira');
});

// T14: Empty states handled elegantly
test('Estados vazios de catálogo e comanda são tratados', () => {
  assert.ok(comandaCode.includes('Nenhum produto cadastrado') || comandaCode.includes('Nenhum produto encontrado'), 'Empty state para catálogo');
  assert.ok(comandaCode.includes('Nenhum produto adicionado nesta comanda'), 'Empty state para comanda atual');
});

// T15: Viewport matrix compatibility
test('Matriz de viewports: classes Tailwind cobrem 1920x1080, 1366x768, 768x1024, 390x844 e 320x568', () => {
  // 1920x1080 & 1366x768: lg:max-w-4xl, sm:max-h-[88vh]
  assert.ok(comandaCode.includes('lg:max-w-4xl'), 'Suporta telas grandes');
  // 768x1024: md:max-w-3xl, md:grid-cols-2
  assert.ok(comandaCode.includes('md:max-w-3xl'), 'Suporta tablets');
  // 390x844 & 320x568: w-[calc(100%-1.5rem)], grid-cols-1, max-h-[85vh]
  assert.ok(comandaCode.includes('w-[calc(100%-1.5rem)]'), 'Margem segura para 390 e 320px');
  assert.ok(comandaCode.includes('max-h-[85vh]'), 'Altura segura para smartphones');
});

console.log('\n================================================================');
console.log(`RESULTADO DA SUÍTE: ${passedTests}/${totalTests} TESTES APROVADOS (${((passedTests/totalTests)*100).toFixed(1)}%)`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}

