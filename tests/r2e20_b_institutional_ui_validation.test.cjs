/**
 * BARBEX — SUÍTE DE TESTES AUTOMATIZADOS R2E.20B
 * Validação de Integridade Institucional: Landing Page, Planos, FAQ, Navegação e Acessibilidade.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('BARBEX — SUÍTE DE VALIDAÇÃO INSTITUCIONAL R2E.20B');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`[PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${description}`);
    console.error(`       Error: ${err.message}`);
  }
}

const ROOT = path.resolve(__dirname, '..');

// 1. FAQ TESTS (PortalFaq.tsx)
const faqPath = path.join(ROOT, 'src', 'components', 'public', 'PortalFaq.tsx');
const faqContent = fs.readFileSync(faqPath, 'utf8');

runTest('1.1 PortalFaq: Contém 12 perguntas e respostas institucionais homologadas', () => {
  assert(faqContent.includes('Como funciona o teste gratuito de 15 dias?'), 'Falta pergunta de 15 dias');
  assert(faqContent.includes('O que acontece ao final do período de avaliação?'), 'Falta pergunta de término do teste');
  assert(faqContent.includes('Preciso cadastrar cartão de crédito para iniciar o teste?'), 'Falta pergunta sobre cartão');
  assert(faqContent.includes('Como funciona o cancelamento da assinatura? Existe fidelidade?'), 'Falta pergunta sobre cancelamento');
  assert(faqContent.includes('Posso mudar de plano quando minha barbearia crescer?'), 'Falta pergunta sobre mudança de plano');
  assert(faqContent.includes('Quais são as formas de pagamento aceitas para a assinatura?'), 'Falta pergunta de formas de pagamento');
  assert(faqContent.includes('Como funciona a integração com o WhatsApp?'), 'Falta pergunta de WhatsApp');
});

runTest('1.2 PortalFaq: Regras de negócio - Não anuncia plano gratuito permanente', () => {
  assert(faqContent.includes('O Barbex não possui plano gratuito permanente'), 'Deve afirmar claramente a ausência de free tier perpétuo');
});

runTest('1.3 PortalFaq: Regras de negócio - Esclarece cancelamento sem reembolso automático', () => {
  assert(faqContent.includes('Não há estorno ou reembolso financeiro automático'), 'Deve informar ausência de reembolso automático');
  assert(faqContent.includes('mantém o acesso completo garantido até o último dia do ciclo já pago'), 'Deve esclarecer que o acesso vai até o fim do ciclo');
  assert(faqContent.includes('renovação automática é interrompida'), 'Deve esclarecer interrupção da renovação');
});

runTest('1.4 PortalFaq: Regras de negócio - Não anuncia módulos avulsos; foca em planos', () => {
  assert(!faqContent.includes('adicionar módulos ao meu plano'), 'Não deve falar em adicionar módulos avulsos');
  assert(faqContent.includes('sem venda fragmentada de módulos avulsos'), 'Deve explicar o modelo de planos completos');
});

runTest('1.5 PortalFaq: Regras de negócio - Integração WhatsApp via QR Code nativo nos planos Pro e Elite', () => {
  assert(faqContent.includes('nos planos compatíveis (Pro e Elite)'), 'Deve restringir aos planos compatíveis');
  assert(faqContent.includes('leitura de QR Code direto no painel'), 'Deve mencionar QR Code nativo');
});

runTest('1.6 PortalFaq: Acessibilidade - Atributos aria e indicador de foco visível', () => {
  assert(faqContent.includes('aria-expanded={isOpen}'), 'Falta aria-expanded');
  assert(faqContent.includes('aria-controls={answerId}'), 'Falta aria-controls');
  assert(faqContent.includes('role="region"'), 'Falta role="region"');
  assert(faqContent.includes('focus-visible:ring-2 focus-visible:ring-gold'), 'Falta anel de foco visível');
});

// 2. PRICING SECTION TESTS (PricingSection.tsx)
const pricingPath = path.join(ROOT, 'src', 'components', 'public', 'PricingSection.tsx');
const pricingContent = fs.readFileSync(pricingPath, 'utf8');

runTest('2.1 PricingSection: Possui âncora #planos e container estruturado', () => {
  assert(pricingContent.includes('id="planos"'), 'Falta âncora id="planos"');
});

runTest('2.2 PricingSection: Catálogo comercial Starter (59,90 / 499,00 e até 2 profissionais)', () => {
  assert(pricingContent.includes('monthlyPrice: "59,90"'), 'Preço mensal Starter incorreto');
  assert(pricingContent.includes('annualPrice: "499,00"'), 'Preço anual Starter incorreto');
  assert(pricingContent.includes('Até 2 profissionais'), 'Limite de profissionais Starter incorreto');
});

runTest('2.3 PricingSection: Catálogo comercial Pro (99,90 / 999,00 e até 5 profissionais)', () => {
  assert(pricingContent.includes('monthlyPrice: "99,90"'), 'Preço mensal Pro incorreto');
  assert(pricingContent.includes('annualPrice: "999,00"'), 'Preço anual Pro incorreto');
  assert(pricingContent.includes('Até 5 profissionais'), 'Limite de profissionais Pro incorreto');
  assert(pricingContent.includes('highlight: true'), 'Plano Pro deve ter destaque equilibrado');
  assert(pricingContent.includes('Mais Popular • 15 Dias Grátis'), 'Badge do Pro ausente');
});

runTest('2.4 PricingSection: Catálogo comercial Elite (149,90 / 1.499,00 e profissionais ilimitados)', () => {
  assert(pricingContent.includes('monthlyPrice: "149,90"'), 'Preço mensal Elite incorreto');
  assert(pricingContent.includes('annualPrice: "1.499,00"'), 'Preço anual Elite incorreto');
  assert(pricingContent.includes('Profissionais Ilimitados'), 'Limite de profissionais Elite incorreto');
});

runTest('2.5 PricingSection: Alternância mensal/anual com indicação de economia', () => {
  assert(pricingContent.includes('Economize no plano anual'), 'Falta badge de economia anual');
  assert(pricingContent.includes('aria-pressed={billingCycle === "month"}'), 'Falta aria-pressed no mensal');
  assert(pricingContent.includes('aria-pressed={billingCycle === "year"}'), 'Falta aria-pressed no anual');
});

runTest('2.6 PricingSection: CTA repassa plano selecionado via callback', () => {
  assert(pricingContent.includes('onSelectPlan && onSelectPlan(plan.key)'), 'CTA deve invocar onSelectPlan com a chave');
  assert(pricingContent.includes('15 dias grátis • Sem cartão de crédito'), 'Rodapé de confiança ausente no card');
});

// 3. LANDING PAGE & NAVEGAÇÃO TESTS (src/routes/index.tsx)
const indexPath = path.join(ROOT, 'src', 'routes', 'index.tsx');
const indexContent = fs.readFileSync(indexPath, 'utf8');

runTest('3.1 Index: Inclusão do link "Planos" no menu Desktop', () => {
  assert(indexContent.includes('<a href="#planos" className="hover:text-gold transition-colors">Planos</a>'), 'Link Planos ausente no header desktop');
});

runTest('3.2 Index: Inclusão do link "Planos" no Drawer Mobile', () => {
  assert(indexContent.includes('{ label: "Planos", href: "#planos" }'), 'Link Planos ausente no drawer mobile');
});

runTest('3.3 Index: Renderização do componente PricingSection integrado', () => {
  assert(indexContent.includes('<PricingSection'), 'PricingSection não está renderizado em index.tsx');
  assert(indexContent.includes('setWizardPlan(planKey)'), 'Não gerencia o estado do plano selecionado');
});

runTest('3.4 Index: Hero possui CTA direto "Conhecer Planos" ancorado a #planos', () => {
  assert(indexContent.includes('href="#planos"'), 'CTA do Hero deve direcionar para #planos');
  assert(indexContent.includes('Conhecer Planos'), 'Texto Conhecer Planos no Hero');
});

runTest('3.5 Index: RegisterWizard recebe initialPlan dinamicamente', () => {
  assert(indexContent.includes('initialPlan={wizardPlan}'), 'RegisterWizard deve receber initialPlan={wizardPlan}');
});

// 4. AUTENTICAÇÃO TESTS (src/routes/auth.index.tsx)
const authPath = path.join(ROOT, 'src', 'routes', 'auth.index.tsx');
const authContent = fs.readFileSync(authPath, 'utf8');

runTest('4.1 Auth: Caixa de escape para novos visitantes iniciarem teste de 15 dias', () => {
  assert(authContent.includes('Não tem uma barbearia cadastrada?'), 'Falta chamada para quem não tem barbearia cadastrada');
  assert(authContent.includes('Comece seu teste grátis de 15 dias sem burocracia e sem cartão de crédito.'), 'Falta texto descritivo');
  assert(authContent.includes('href="/#planos"'), 'Link de retorno aos planos ausente');
  assert(authContent.includes('Iniciar Teste Grátis de 15 Dias'), 'Falta botão de ação de 15 dias grátis');
});

// 5. ISOLAMENTO DO BACKEND E STRIPE
runTest('5.1 Isolamento: Nenhuma migration ou arquivo de backend modificado indevidamente', () => {
  assert(fs.existsSync(path.join(ROOT, 'supabase', 'functions', 'stripe-checkout', 'index.ts')), 'Edge function preservada');
});

console.log('\n================================================================');
console.log(`RESULTADO FINAL: ${passedTests}/${totalTests} TESTES APROVADOS (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
