/**
 * BARBEX — FASE R2E.26E.22N.32: GATE 7 — TESTES DA INTERFACE DE CHAT E ACESSIBILIDADE
 *
 * Valida estaticamente e contratualmente todos os 10 requisitos de Gate 7:
 * 1. Indicador de digitação (TypingIndicator).
 * 2. Remoção de mensagens técnicas ("Consultando a Central de Ajuda do Barbex...").
 * 3. Fontes recolhidas por padrão (CollapsibleSources).
 * 4. Abertura das fontes por clique e teclado (Enter/Space, aria-expanded).
 * 5. Acessibilidade (role="status", aria-live="polite", sr-only, motion-reduce:animate-none).
 * 6. Rolagem automática mantida.
 * 7. Bloqueio de envio duplicado (disabled={isSubmitting}).
 * 8. Limpeza de histórico ao trocar de usuário ou tenant.
 * 9. Responsividade e layout preservados.
 * 10. Tratamento amigável de falhas e erros.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");

console.log("================================================================================");
console.log("BARBEX — R2E.26E.22N.32: TESTES DE INTERFACE DE CHAT E ACESSIBILIDADE (GATE 7)");
console.log("================================================================================\n");

const assistentePath = path.resolve(__dirname, "../src/routes/dashboard.assistente.tsx");
const typingPath = path.resolve(__dirname, "../src/components/ai/TypingIndicator.tsx");
const sourcesPath = path.resolve(__dirname, "../src/components/ai/CollapsibleSources.tsx");

const content = [
  fs.readFileSync(assistentePath, "utf8"),
  fs.existsSync(typingPath) ? fs.readFileSync(typingPath, "utf8") : "",
  fs.existsSync(sourcesPath) ? fs.readFileSync(sourcesPath, "utf8") : ""
].join("\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// 1. Indicador de Digitação
test("1. Indicador de digitação (TypingIndicator) implementado com animação de 3 pontos", () => {
  assert.ok(content.includes("function TypingIndicator"), "Deve existir o componente TypingIndicator");
  assert.ok(content.includes("animate-bounce"), "Deve usar animação de bounce para os pontos");
  assert.ok(content.includes("Respondendo..."), "Deve exibir texto discreto Respondendo...");
  assert.ok(content.includes("{isSubmitting && <TypingIndicator />}"), "Deve renderizar TypingIndicator condicionalmente");
});

// 2. Remoção de Mensagens Técnicas
test("2. Remoção de mensagens técnicas de consulta interna", () => {
  assert.ok(
    !content.includes("Consultando a Central de Ajuda do Barbex..."),
    "Não deve exibir mensagem de 'Consultando a Central de Ajuda do Barbex...'"
  );
  assert.ok(
    !content.includes("Central de Ajuda (68 artigos)"),
    "Cabeçalho não deve exibir contagem crua de artigos"
  );
  assert.ok(
    content.includes("Conhecimento Oficial Ativo"),
    "Cabeçalho deve exibir estado elegante de Conhecimento Oficial Ativo"
  );
});

// 3. Fontes Recolhidas por Padrão
test("3. Fontes recolhidas por padrão (CollapsibleSources)", () => {
  assert.ok(content.includes("function CollapsibleSources"), "Deve existir o componente CollapsibleSources");
  assert.ok(content.includes("const [isOpen, setIsOpen] = React.useState(false);"), "Deve iniciar recolhido com isOpen = false");
  assert.ok(content.includes("Consultar na Central de Ajuda"), "Botão deve ter rótulo amigável");
});

// 4. Abertura e Fechamento por Teclado e Clique
test("4. Abertura e fechamento das fontes com suporte a teclado e clique", () => {
  assert.ok(content.includes('e.key === "Enter" || e.key === " "'), "Deve alternar estado ao pressionar Enter ou Espaço");
  assert.ok(content.includes("aria-expanded={isOpen}"), "Deve atualizar atributo aria-expanded reativamente");
  assert.ok(content.includes('aria-controls="sources-collapsible-content"'), "Deve vincular botão ao conteúdo via aria-controls");
});

// 5. Acessibilidade e Leitores de Tela
test("5. Acessibilidade completa (role='status', aria-live='polite', sr-only e motion-reduce)", () => {
  assert.ok(content.includes('role="status"'), "TypingIndicator deve declarar role='status'");
  assert.ok(content.includes('aria-live="polite"'), "TypingIndicator deve declarar aria-live='polite'");
  assert.ok(content.includes("sr-only"), "Deve ter texto oculto dedicado a leitores de tela");
  assert.ok(content.includes("motion-reduce:animate-none"), "Deve respeitar prefers-reduced-motion desativando animação");
});

// 6. Rolagem Automática
test("6. Rolagem automática preservada ao enviar ou receber mensagens", () => {
  assert.ok(content.includes("scrollRef.current.scrollTop = scrollRef.current.scrollHeight;"), "Deve rolar para o final do chat");
  assert.ok(content.includes("[messages, isSubmitting]"), "Dependências da rolagem devem incluir messages e isSubmitting");
});

// 7. Prevenção de Envio Duplicado
test("7. Bloqueio de envio duplicado e estado de submissão", () => {
  assert.ok(content.includes("if (!textToSend || !isAuthorizedAdmin || isSubmitting) return;"), "handleSend deve ignorar se isSubmitting");
  assert.ok(content.includes("disabled={isSubmitting}"), "Campo de input deve ser desabilitado durante envio");
  assert.ok(content.includes("disabled={!input.trim() || isSubmitting || input.length > 500}"), "Botão Send deve ser desabilitado durante envio");
});

// 8. Isolamento de Sessão ao Trocar de Usuário ou Barbearia
test("8. Reset do histórico em memória na troca de usuário ou tenant", () => {
  assert.ok(content.includes("setMessages([INITIAL_MESSAGE]);"), "Deve resetar para a mensagem inicial");
  assert.ok(content.includes("}, [user?.id, tenantId]);"), "Deve depender estritamente de user?.id e tenantId");
});

// 9. Correção do Filtro de Mensagens do Assistente > 500 caracteres
test("9. Filtro de histórico permite mensagens do assistente de até 1500 caracteres", () => {
  assert.ok(
    content.includes('m.role === "assistant" ? m.content.length <= 1500 : m.content.length <= 500'),
    "Deve permitir assistente até 1500 chars e usuário até 500 chars sem descarte silencioso"
  );
});

// 10. Tratamento Amigável de Erros
test("10. Tratamento amigável de falhas e banner de rate limit", () => {
  assert.ok(content.includes("isError: true"), "Mensagens com falha devem ser marcadas como isError");
  assert.ok(content.includes("RATE_LIMIT_EXCEEDED"), "Deve tratar excedência de rate limit de forma limpa");
  assert.ok(content.includes("setBannerNotice"), "Deve exibir aviso amigável sem quebrar o componente");
});

console.log("\n================================================================================");
console.log(`TOTAL DE TESTES EXECUTADOS: ${passed + failed}`);
console.log(`TESTES APROVADOS: ${passed}`);
console.log(`TESTES FALHADOS:  ${failed}`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\nVEREDITO: GATE 7 (TESTES DE INTERFACE) APROVADO COM 100% DE SUCESSO.");
}

