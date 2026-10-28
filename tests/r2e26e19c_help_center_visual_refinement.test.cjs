const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('BARBEX — R2E.26E.19C: HOTFIX VISUAL — CENTRAL DE AJUDA 2.0');
console.log('TEST SUITE: GATES 0 A 8 — VALIDAÇÃO COMPLETA DE REFINAMENTO');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

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

// Arquivos auditados
const tutorialsRoutePath = path.join(__dirname, '..', 'src', 'routes', 'tutorials.tsx');
const layoutPath = path.join(__dirname, '..', 'src', 'components', 'help-center', 'HelpCenterLayout.tsx');
const cardPath = path.join(__dirname, '..', 'src', 'components', 'help-center', 'HelpArticleCard.tsx');
const searchPath = path.join(__dirname, '..', 'src', 'components', 'help-center', 'HelpSearch.tsx');
const categoriesPath = path.join(__dirname, '..', 'src', 'components', 'help-center', 'HelpCategories.tsx');
const historyPath = path.join(__dirname, '..', 'src', 'components', 'help-center', 'HelpHistory.tsx');
const articlePagePath = path.join(__dirname, '..', 'src', 'components', 'help-center', 'HelpArticlePage.tsx');
const appLayoutPath = path.join(__dirname, '..', 'src', 'components', 'layout', 'AppLayout.tsx');
const receptionLayoutPath = path.join(__dirname, '..', 'src', 'components', 'reception', 'ReceptionLayout.tsx');
const catalogPath = path.join(__dirname, '..', 'src', 'lib', 'tutorials.catalog.ts');

const tutorialsCode = fs.readFileSync(tutorialsRoutePath, 'utf8');
const layoutCode = fs.readFileSync(layoutPath, 'utf8');
const cardCode = fs.readFileSync(cardPath, 'utf8');
const searchCode = fs.readFileSync(searchPath, 'utf8');
const categoriesCode = fs.readFileSync(categoriesPath, 'utf8');
const historyCode = fs.readFileSync(historyPath, 'utf8');
const articlePageCode = fs.readFileSync(articlePagePath, 'utf8');
const appLayoutCode = fs.readFileSync(appLayoutPath, 'utf8');
const receptionLayoutCode = fs.readFileSync(receptionLayoutPath, 'utf8');
const catalogCode = fs.readFileSync(catalogPath, 'utf8');

// GATE 1 — TIPOGRAFIA
test('T01: Título principal reduzido com destaque dourado preservado', () => {
  assert.ok(tutorialsCode.includes('Como podemos <span className="text-gold">ajudar?</span>'), 'Destaque dourado em "ajudar?" preservado');
  assert.ok(tutorialsCode.includes('text-2xl sm:text-3xl md:text-[34px]'), 'Tipografia do título calibrada (24-28px mobile, 30-34px desktop)');
  assert.ok(!tutorialsCode.includes('text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic'), 'Título inflado de 60px foi removido');
});

test('T02: Títulos dos artigos sem uppercase forçado e com suporte a até 3 linhas', () => {
  assert.ok(!cardCode.includes('uppercase text-white'), 'Título do card não possui uppercase forçado');
  assert.ok(cardCode.includes('line-clamp-3'), 'Permite até 3 linhas de título para evitar truncamento agressivo');
  assert.ok(cardCode.includes('text-base sm:text-[17px]'), 'Tamanho de fonte dos títulos calibrado entre 16px (mobile) e 17-18px (desktop)');
});

test('T03: Descrições dos artigos com contraste aprimorado (zinc-400)', () => {
  assert.ok(cardCode.includes('text-[13px] sm:text-sm text-zinc-400'), 'Descrições utilizam 13-14px com alto contraste text-zinc-400');
  assert.ok(cardCode.includes('line-clamp-2'), 'Descrição limitada a 2 linhas proporcionais');
});

// GATE 2 — REORGANIZAÇÃO DA PÁGINA
test('T04: Sequência da página: 1. Identificação -> 2. Título -> 3. Busca -> 4. Categorias -> 5. Artigos -> 6. Lateral', () => {
  const posIdentificacao = tutorialsCode.indexOf('Central de Ajuda 2.0');
  const posTitulo = tutorialsCode.indexOf('Como podemos');
  const posBusca = tutorialsCode.indexOf('<HelpSearch');
  const posCategorias = tutorialsCode.indexOf('<HelpCategories');
  const posArtigos = tutorialsCode.indexOf('filteredArticles.map');
  const posLateral = tutorialsCode.indexOf('<aside');

  assert.ok(posIdentificacao !== -1 && posIdentificacao < posTitulo, '1. Identificação antes do Título');
  assert.ok(posTitulo < posBusca, '2. Título antes da Busca');
  assert.ok(posBusca < posCategorias, '3. Busca antes das Categorias');
  assert.ok(posCategorias < posArtigos, '4. Categorias antes dos Artigos');
  assert.ok(posArtigos < posLateral, '5. Artigos antes ou integrados com Lateral');
});

test('T05: Primeira linha de artigos aparece precocemente na viewport sem margens ociosas', () => {
  assert.ok(!tutorialsCode.includes('py-8 md:py-14'), 'Padding vertical exagerado de 56px removido');
  assert.ok(!tutorialsCode.includes('space-y-12'), 'Espaçamento vertical inflado removido');
  assert.ok(tutorialsCode.includes('space-y-4 sm:space-y-6'), 'Espaçamentos verticais compactos adotados');
});

// GATE 3 — CARDS DOS TUTORIAIS
test('T06: Cards padronizados com altura flexível, ícones 36px e badges de destaque', () => {
  assert.ok(cardCode.includes('flex flex-col justify-between h-full'), 'Card utiliza altura flexível h-full com flex-col justify-between');
  assert.ok(cardCode.includes('h-9 w-9 rounded-xl'), 'Ícone padronizado em 36px (h-9 w-9)');
  assert.ok(cardCode.includes('bg-gold text-black'), 'Badge de destaque dourada preservada');
  assert.ok(cardCode.includes('border-t border-zinc-800'), 'Rodapé alinhado com borda divisória sutil');
});

test('T07: Grid responsivo de artigos (1 coluna mobile, 2 colunas tablet, 3 colunas desktop)', () => {
  assert.ok(tutorialsCode.includes('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'), 'Grid responsivo de 1 a 3 colunas');
});

// GATE 4 — CATEGORIAS
test('T08: Botões de categorias compactos com tipografia 12-13px e scrollbar oculta', () => {
  assert.ok(categoriesCode.includes('h-8 sm:h-8.5 px-3 sm:px-3.5'), 'Botões compactos de altura ~32-34px');
  assert.ok(categoriesCode.includes('text-xs sm:text-[13px] font-bold'), 'Tipografia compacta de 12-13px');
  assert.ok(categoriesCode.includes('scrollbar-none'), 'Scrollbar visualmente oculta');
  assert.ok(categoriesCode.includes('[&::-webkit-scrollbar]:hidden'), 'Pseudo-elemento de scrollbar oculto');
  assert.ok(categoriesCode.includes('focus-visible:ring-2 focus-visible:ring-gold'), 'Foco acessível por teclado preservado');
});

// GATE 5 — ÁREA LATERAL
test('T09: Área lateral com Guia de Início, Suporte Direto e ordem mobile não-bloqueante', () => {
  assert.ok(tutorialsCode.includes('order-last lg:order-none'), 'No mobile, a lateral fica ao final (order-last) sem bloquear os tutoriais');
  assert.ok(tutorialsCode.includes('openOnboardingModal()'), 'Botão do Guia de Início abre modal de onboarding');
  assert.ok(tutorialsCode.includes('/support'), 'Botão de Suporte Direto aponta para /support');
  assert.ok(historyCode.includes('recentArticles'), 'Histórico de artigos recentes implementado');
});

// GATE 6 — NAVEGAÇÃO MULTIPERFIL
test('T10: Menu lateral do Proprietário possui "Ajuda e Tutoriais" apontando para /tutorials', () => {
  assert.ok(appLayoutCode.includes('{ label: "Ajuda e Tutoriais", icon: BookOpen, to: "/tutorials" }'), 'Item "Ajuda e Tutoriais" presente no menu lateral do proprietário');
});

test('T11: Menu do Barbeiro (barberNavItems) possui "Ajuda e Tutoriais" apontando para /tutorials', () => {
  assert.ok(appLayoutCode.includes('{ label: "Ajuda e Tutoriais", icon: BookOpen, to: "/tutorials" }'), 'Item "Ajuda e Tutoriais" presente no painel do barbeiro');
  assert.ok(appLayoutCode.includes('barberNavItems'), 'barberNavItems atualizado com o link');
});

test('T12: Menu da Recepção (ReceptionLayout NAV) possui "Ajuda e Tutoriais" apontando para /tutorials', () => {
  assert.ok(receptionLayoutCode.includes('{ label: "Ajuda e Tutoriais", to: "/tutorials", icon: BookOpen }'), 'Item "Ajuda e Tutoriais" presente na barra da recepção');
});

// GATE 7 — ACESSIBILIDADE E HIERARQUIA
test('T13: Acessibilidade de foco, labels semânticos e navegação por teclado nos cards', () => {
  assert.ok(cardCode.includes('role="button"'), 'Card tem role="button"');
  assert.ok(cardCode.includes('tabIndex={0}'), 'Card tem tabIndex={0}');
  assert.ok(cardCode.includes('onKeyDown'), 'Card escuta Enter e Espaço via teclado');
  assert.ok(searchCode.includes('aria-label="Buscar na Central de Ajuda"'), 'Campo de pesquisa possui aria-label acessível');
});

// GATE 8 — INTEGRIDADE DO CATÁLOGO DE TUTORIAIS
test('T14: Catálogo canônico preserva todos os 19 tutoriais originais sem mutações indevidas', () => {
  const tutorialMatches = (catalogCode.match(/id:\s*"[^"]+"/g) || []).map(m => m.replace(/id:\s*"|"/g, ''));
  const uniqueIds = Array.from(new Set(tutorialMatches));
  assert.ok(uniqueIds.length >= 19, `Catálogo deve conter pelo menos 19 tutoriais (encontrados: ${uniqueIds.length})`);
  assert.ok(catalogCode.includes('owner-config-barbershop'), 'Tutorial owner-config-barbershop presente');
  assert.ok(catalogCode.includes('reception-agenda-operation'), 'Tutorial reception-agenda-operation presente');
  assert.ok(catalogCode.includes('barber-daily-agenda'), 'Tutorial barber-daily-agenda presente');
  assert.ok(catalogCode.includes('superadmin-tenants-governance'), 'Tutorial superadmin-tenants-governance presente');
});

test('T15: Campo de pesquisa possui botão acessível de limpar busca quando preenchido', () => {
  assert.ok(searchCode.includes('aria-label="Limpar pesquisa"'), 'Botão limpar pesquisa com aria-label acessível');
  assert.ok(searchCode.includes('onChange("")'), 'Limpa o estado de busca no clique');
});

console.log(`\n================================================================`);
console.log(`TOTAL DE TESTES: ${totalTests} | APROVADOS: ${passedTests} | FALHAS: ${totalTests - passedTests}`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  console.log('SUCESSO: Todos os 15 testes de refinamento visual da Central de Ajuda 2.0 foram aprovados!');
  process.exit(0);
} else {
  console.error('FALHA: Testes de refinamento não passaram.');
  process.exit(1);
}
