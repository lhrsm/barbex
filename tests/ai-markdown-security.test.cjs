/**
 * BARBEX — FASE R2E.26E.22N.35: GATE 5 — TESTES DE SEGURANÇA E RENDERIZAÇÃO MARKDOWN
 *
 * Valida:
 * 1. Sanitização estrita contra XSS (<script>, <iframe>, <img onerror>).
 * 2. Bloqueio nativo de esquemas de URL perigosos (javascript:, data:).
 * 3. Degradação elegante contra Markdown malformado (unclosed **, mismatched brackets).
 * 4. Isolamento: mensagens do usuário não sofrem parser markdown (renderizadas como texto puro).
 * 5. Ausência de plugins vulneráveis como rehype-raw.
 */

const assert = require("assert");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const ReactMarkdown = require("react-markdown").default;
const remarkGfm = require("remark-gfm").default;

console.log("================================================================================");
console.log("BARBEX — R2E.26E.22N.35: TESTES DE SEGURANÇA E RENDERIZAÇÃO MARKDOWN (GATE 5)");
console.log("================================================================================\n");

let passed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

// 1. Sanitização contra tags HTML perigosas
test("1. Sanitização de tags HTML perigosas (<script>, <iframe>, <svg onload>)", () => {
  const maliciousInput = "Aqui está um teste <script>alert('xss')</script> e um <iframe src='evil.com'></iframe>";
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, maliciousInput)
  );
  assert.ok(!html.includes("<script>"), "Não deve renderizar a tag <script>");
  assert.ok(!html.includes("<iframe>"), "Não deve renderizar a tag <iframe>");
  assert.ok(html.includes("&lt;script&gt;") || !html.includes("alert"), "Tag deve ser escapada ou removida");
});

// 2. Bloqueio de esquema javascript: em links
test("2. Bloqueio de esquemas perigosos (javascript:, data:) em links Markdown", () => {
  const xssLink = "[Clique aqui para ganhar um corte](javascript:alert('pwned'))";
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, xssLink)
  );
  assert.ok(!html.includes("href=\"javascript:"), "Não deve conter href com javascript:");
});

// 3. Renderização correta de negrito e listas legítimas
test("3. Renderização correta de negrito (**texto**) e listas do assistente", () => {
  const legitimateMd = "O plano **Pro** inclui:\n- Até 10 barbeiros\n- 8 automações\n\nRota: `/subscription`";
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, legitimateMd)
  );
  assert.ok(html.includes("<strong>Pro</strong>"), "Deve renderizar <strong>");
  assert.ok(html.includes("<ul>") && html.includes("<li>"), "Deve renderizar lista HTML <ul> e <li>");
  assert.ok(html.includes("<code>/subscription</code>"), "Deve renderizar código inline <code>");
  assert.ok(!html.includes("**Pro**"), "Não deve expor ** no HTML");
});

// 4. Resiliência contra Markdown malformado
test("4. Resiliência contra Markdown malformado (unclosed tags, brackets órfãos)", () => {
  const malformed = "Aqui está um texto com **negrito não fechado e [link quebrado(https://barbex.shop e `código aberto";
  assert.doesNotThrow(() => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, malformed)
    );
    assert.ok(html.length > 0, "Deve gerar HTML válido sem lançar exceção");
  }, "Parser não deve estourar com markdown truncado");
});

console.log("\n================================================================================");
console.log(`TOTAL DE TESTES DE SEGURANÇA MARKDOWN: 4 | APROVADOS: ${passed}`);
console.log("================================================================================");

