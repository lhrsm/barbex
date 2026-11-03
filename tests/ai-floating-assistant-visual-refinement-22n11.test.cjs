/**
 * BARBEX — SUÍTE DE TESTES AUTOMATIZADOS (FASE R2E.26E.22N.11)
 * Validação de Refinamento Visual Mobile, Responsividade, Áreas Seguras e Não-Regressão RBAC
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("===============================================================================");
console.log("BARBEX — TESTES AUTOMATIZADOS: REFINAMENTO VISUAL & RESPONSIVIDADE (22N.11)");
console.log("===============================================================================\n");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Erro: ${err.message}`);
    failed++;
  }
}

const componentPath = path.resolve(__dirname, "../src/components/ai/AIAssistantFloatingButton.tsx");
assert(fs.existsSync(componentPath), "Arquivo AIAssistantFloatingButton.tsx deve existir");
const code = fs.readFileSync(componentPath, "utf8");

// --- BATERIA 1: ACABAMENTO VISUAL MOBILE E BORDAS DOURADAS ---
runTest("V01: Painel flutuante aplica borda dourada discreta de 1px", () => {
  assert(code.includes("border-amber-500/30"), "Painel deve possuir borda dourada discreta border-amber-500/30");
});

runTest("V02: Painel flutuante possui sombra externa suave e anel dourado sutil", () => {
  assert(code.includes("shadow-[0_12px_45px_-10px_rgba(0,0,0,0.85),0_0_24px_rgba(245,158,11,0.08)]"), "Deve possuir sombra ambiente suave com reflexo âmbar");
  assert(code.includes("ring-1 ring-amber-500/10"), "Deve possuir anel sutil ring-amber-500/10 para contorno suave");
});

runTest("V03: Separação entre cabeçalho e área de conversa destacada com gradiente e borda dourada", () => {
  assert(code.includes("border-b border-amber-500/20"), "Cabeçalho deve ter borda divisora âmbar suave");
  assert(code.includes("bg-gradient-to-r from-amber-500/[0.04]"), "Cabeçalho deve possuir gradiente suave de destaque");
});

runTest("V04: Preservação estrita do tema escuro e contraste das mensagens", () => {
  assert(code.includes("bg-[#0c101d]"), "Fundo do diálogo deve permanecer no tema escuro profundo #0c101d");
  assert(code.includes("backdrop-blur-2xl"), "Diálogo deve manter desfoque de fundo backdrop-blur-2xl");
  assert(code.includes("text-slate-100"), "Mensagens do assistente devem utilizar texto com contraste legível");
  assert(code.includes("bg-amber-500 text-slate-950 font-medium"), "Mensagens do usuário devem manter alto contraste dourado");
});

// --- BATERIA 2: RESPONSIVIDADE, ÁREAS SEGURAS E NÃO-SOBREPOSIÇÃO ---
runTest("V05: Janela respeita a largura da tela sem ultrapassar limites em mobile", () => {
  assert(code.includes("w-[calc(100vw-2rem)]"), "Largura mobile deve reservar margens laterais de 1rem");
  assert(code.includes("max-w-[calc(100vw-2rem)]"), "Deve limitar explicitamente a largura máxima em mobile");
  assert(code.includes("sm:w-[400px]"), "Em desktop deve preservar tamanho fixo de 400px");
  assert(code.includes("box-border"), "Deve garantir box-sizing seguro para evitar overflow");
});

runTest("V06: Respeito às áreas seguras (safe areas) e altura dinâmica útil (dvh)", () => {
  assert(code.includes("env(safe-area-inset-bottom,0px)"), "Trigger e painel devem respeitar safe-area-inset-bottom");
  assert(code.includes("max-h-[calc(100dvh-7rem)]"), "Deve utilizar dynamic viewport height (dvh) para teclados e barras de navegação");
});

runTest("V07: Isolamento contra sobreposição com botões de acessibilidade", () => {
  // AccessibilityWidget fica à esquerda (left-4), assistente fica à direita (right-[calc...])
  assert(code.includes("right-[calc(1rem+env(safe-area-inset-right,0px))]"), "Assistente deve se ancorar à direita respeitando safe-area lateral");
  assert(code.includes("bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))]"), "Painel deve flutuar acima do botão disparador");
});

// --- BATERIA 3: NÃO-REGRESSÃO DE AUTORIZAÇÃO E SEGURANÇA (RBAC & KILL SWITCH) ---
runTest("V08: Lógica de autenticação e RBAC estrito permanece 100% inalterada", () => {
  assert(code.includes("isProvenTenantAdmin"), "isProvenTenantAdmin deve permanecer preservado");
  assert(code.includes("const isAuthorizedAdmin ="), "Validação de autorização deve permanecer ativa");
  assert(code.includes("askAIAssistant"), "Integração oficial à Server Function askAIAssistant deve permanecer inalterada");
  assert(code.includes('aiStatus === "disabled"'), "Bloqueio de kill switch deve permanecer ativo");
});

console.log(`\n===============================================================================`);
console.log(`RESULTADO DA SUÍTE VISUAL 22N.11: ${passed} PASS, ${failed} FAIL`);
console.log(`===============================================================================\n`);

if (failed > 0) {
  process.exit(1);
}

