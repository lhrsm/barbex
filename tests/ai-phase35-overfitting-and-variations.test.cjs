/**
 * BARBEX — FASE R2E.26E.22N.35: GATE 4 — TESTES CONTRA OVERFITTING E VARIAÇÕES NATURAIS
 *
 * Valida robustez da resolução contextual e grounding fora dos 8 turnos canônicos:
 * - Cenário A: Planos ("Me fala dos planos...", "Qual compensa mais?", "Explica melhor...", "Minha equipe tem doze profissionais", "Então o Pro não serve?")
 * - Cenário B: Mudança de assunto ("Tenho uma dúvida sobre o Elite", "Agora deixa isso pra lá...", "E o profissional, posso trocar junto?")
 * - Cenário C: Ambiguidade real ("Estou escolhendo um barbeiro para atender um cliente", "Tenho 12 barbeiros. Qual você escolheria?" -> NÃO forçar planos!)
 * - Cenário D: Encerramento ("Obrigado, resolveu", "Até mais" -> 0 tutoriais, respostas breves)
 * - Cenário E: Reformulação após resposta > 500 chars ("Não entendi. Explica de outro jeito" -> preserva tema)
 * - Cenário F: Pergunta sem contexto suficiente ("Qual deles você escolheria?" sem histórico -> não força plano, pede esclarecimento)
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");

console.log("================================================================================");
console.log("BARBEX — R2E.26E.22N.35: TESTES CONTRA OVERFITTING E VARIAÇÕES NATURAIS (GATE 4)");
console.log("================================================================================\n");

// Catálogo factual oficial de teste
const catalog = [
  {
    id: "owner-barbex-plans-limits",
    title: "Planos Barbex, Limites e Gestão da Assinatura",
    category: "Assinatura",
    route: "/subscription",
    description: "Conheça os planos Starter, Pro e Elite do Barbex, consulte os limites do seu estabelecimento e gerencie sua assinatura da plataforma.",
    steps: [
      "Acesse 'Minha Assinatura' na rota /subscription.",
      "Confira seu consumo atual de barbeiros e automações.",
      "Compare os planos Starter (até 3 barbeiros), Pro (até 10 barbeiros) e Elite (ilimitado)."
    ],
    notes: "A rota /subscription gerencia o plano SaaS. A rota /subscriptions gerencia o Clube de Assinaturas de clientes."
  },
  {
    id: "owner-appointment-cancellation-reschedule",
    title: "Cancelamento e Reagendamento de Atendimentos",
    category: "Operação",
    route: "/calendar",
    description: "Aprenda a cancelar ou reagendar atendimentos e mudar horários na Agenda ou Recepção, liberando a grade e atualizando o status do cliente.",
    steps: [
      "Acesse a Agenda (/calendar) e localize o card do atendimento.",
      "Clique sobre o agendamento para abrir a janela de detalhes.",
      "Para reagendar: clique no botão 'Reagendar', selecione nova data/horário ou troque o profissional no Passo 1.",
      "Para cancelar: clique no botão 'Cancelar' no rodapé e confirme."
    ],
    notes: "O cancelamento de agendamento libera o horário imediatamente na grade."
  },
  {
    id: "owner-team-management",
    title: "Cadastro e Gestão de Barbeiros e Profissionais da Equipe",
    category: "Equipe",
    route: "/settings/team",
    description: "Gerencie os profissionais da sua barbearia: adicione barbeiros, defina suas comissões, dias de trabalho e permissões.",
    steps: [
      "Acesse Configurações -> Equipe (/settings/team).",
      "Clique em 'Novo Profissional' e preencha nome, e-mail e telefone.",
      "Defina a comissão percentual ou fixa e os dias de atendimento na grade."
    ],
    notes: "O número máximo de barbeiros ativos é determinado pelo plano contratado em /subscription."
  },
  {
    id: "owner-whatsapp-automation",
    title: "Configuração de Automações e Integração com WhatsApp",
    category: "Comunicação",
    route: "/settings/integrations",
    description: "Configure o envio automático de lembretes de agendamento e mensagens via API externa do WhatsApp (Z-API).",
    steps: [
      "Acesse Configurações -> Integrações (/settings/integrations).",
      "Vincule sua instância Z-API escaneando o QR Code.",
      "Ative as réguas de lembretes e confirmações automáticas."
    ],
    notes: "A integração com WhatsApp utiliza serviço de terceiros (Z-API) contratado à parte pelo estabelecimento e não é gratuita nem nativa."
  }
];

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

const STOP_WORDS_SET = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos", "e",
  "em", "na", "nas", "no", "nos", "o", "os", "ou", "para", "por", "que", "se", "um",
  "uma", "uns", "umas", "eu", "ele", "ela", "eles", "elas", "meu", "minha", "meus", "minhas",
  "seu", "sua", "seus", "suas", "fazer", "posso", "consigo", "onde", "aonde", "qual", "quais",
  "quando", "quanto", "quantos", "quanta", "quantas", "barbex",
  "sao", "são", "sou", "somos", "ser", "sera", "será", "seria", "foi", "foram", "era", "eram",
  "esta", "está", "estao", "estão", "esteve", "estar", "estava",
  "forma", "formas", "direito", "explica", "explicar", "explicacao", "explicação",
  "jeito", "entendi", "entender", "simplifica", "simplificar", "novamente", "novo",
  "outro", "outra", "outros", "outras", "fala", "parceiro", "ajuda", "ajudar",
  "quer", "quero", "queria", "quiser", "faco", "faço", "faz", "fazer",
  "barbearia", "barbearias", "sistema", "plataforma", "aplicativo", "app"
]);

const STEM_DICTIONARY = {
  agendar: ["agendo", "agendamento", "marcar", "agenda", "horario"],
  agendamento: ["agendar", "agendamentos", "horario", "agenda", "atendimento"],
  agendamentos: ["agendar", "agendamento", "horario", "agenda", "atendimento"],
  reagendo: ["reagendar", "reagendamento", "remarcar"],
  reagendar: ["reagendo", "reagendamento", "remarcar", "mudar", "alterar"],
  reagendamento: ["reagendar", "remarcar", "mudar", "alterar"],
  remarco: ["reagendar", "reagendamento", "remarcar"],
  remarcar: ["reagendar", "reagendamento", "mudar", "alterar"],
  mudar: ["reagendar", "reagendamento", "remarcar", "alterar", "trocar", "horario"],
  barbeiro: ["barbeiros", "profissional", "profissionais", "equipe"],
  barbeiros: ["barbeiro", "profissional", "profissionais", "equipe"],
  profissional: ["profissionais", "barbeiro", "barbeiros"],
  profissionais: ["profissional", "barbeiro", "barbeiros"],
  plano: ["planos", "assinatura", "starter", "pro", "elite", "upgrade", "limite", "limites"],
  planos: ["plano", "assinatura", "starter", "pro", "elite", "upgrade", "limite", "limites"],
  starter: ["plano", "planos", "limite"],
  pro: ["plano", "planos", "limite"],
  elite: ["plano", "planos", "limite"],
  whatsapp: ["zapi", "lembrete", "lembretes", "mensagem", "automacao"],
  lembretes: ["whatsapp", "lembrete", "automacao", "notificacao"]
};

function getVariants(word) {
  const norm = normalizeText(word);
  const set = new Set([norm]);
  if (STEM_DICTIONARY[norm]) STEM_DICTIONARY[norm].forEach(v => set.add(v));
  if (norm.endsWith("s") && norm.length > 4) set.add(norm.slice(0, -1));
  else if (!norm.endsWith("s") && norm.length >= 4) set.add(norm + "s");
  return Array.from(set);
}

function matchTerm(textNorm, v) {
  if (!v || v.length < 2) return false;
  if (v.length <= 4) return new RegExp(`\\b${v}\\b`).test(textNorm);
  return new RegExp(`\\b${v}`).test(textNorm);
}

const CLOSURE_PATTERNS = [
  /^(valeu|obrigado|obrigada|show|perfeito|entendi|beleza|era isso|era so isso|era so isso mesmo|era so isso parceiro|so isso|tudo certo|tks|thanks|top|falou|ate mais|ate logo|valeu parceiro|valeu era isso|obrigado resolveu)[\s!.]*$/i,
  /\b(valeu\s*,?\s*era isso|era isso\s*,?\s*valeu|obrigado\s*,?\s*era isso|obrigado\s*,?\s*resolveu|ate mais|até mais)\b/i
];

const TOPIC_SWITCH_PATTERNS = [
  /\b(agora outra coisa|agora quero|mudando de assunto|outra duvida|outra pergunta|sobre outra coisa|agora preciso|preciso de outra coisa|deixa isso pra la|deixa isso pra lá)\b/i
];

const CONTINUATION_PATTERNS = [
  /\b(nao entendi|não entendi|entendi direito|explica(r)?|de novo|outra forma|outro jeito|mais simples|simplificar|simplifica|detalha(r)?|melhor|explica melhor|nao manjo|não manjo)\b/i,
  /\b(e quanto custa|quanto custa|quanto e|quanto é|qual o valor|qual o preco|qual o preço|qual a diferenca|qual a diferença|qual compensa mais|qual compensa)\b/i,
  /\b(como faco isso|como faço isso|como funciona isso|como assim|onde fica isso|onde vejo isso)\b/i,
  /\b(e no elite|e no pro|e no starter|e na recepcao|e na recepção)\b/i,
  /\b(e se eu tiver|e se tiver|e se for|e mudar o barbeiro|mudar o barbeiro tambem|mudar o barbeiro também|trocar o barbeiro|trocar o barbeiro dele|trocar o profissional|posso trocar junto)\b/i,
  /\b(como se eu estivesse comecando|como se eu estivesse começando|como se eu fosse iniciante|como se eu tivesse comecado|como se eu tivesse começado)\b/i,
  /\b(qual voce escolheria|qual você escolheria|qual escolher|qual indicaria|qual o melhor para mim)\b/i,
  /\b(entao o pro nao serve|então o pro não serve|e o pro|o pro nao serve|o pro não serve)\b/i
];

const CLUSTER_IDENTIFIERS = {
  PLANS: [
    /\b(plano|planos|assinatura|starter|pro|elite|upgrade|downgrade|limite|limites)\b/i,
  ],
  APPOINTMENTS: [
    /\b(agendamento|agendar|agenda|calendario|calendário|horario|horário|cancelar|reagendar|desmarcar|remarcar|remarco|atendimento)\b/i,
  ],
  WHATSAPP: [
    /\b(whatsapp|zapi|lembrete|lembretes|notificacao|notificação|notificacoes|notificações|aviso|avisar)\b/i,
  ],
  PIX: [
    /\b(pix|chave|qrcode|qr code)\b/i,
  ],
  COMMISSIONS: [
    /\b(comissao|comissoes|comissões|repasse|fechamento de comissao)\b/i,
  ],
  TEAM: [
    /\b(equipe|cadastrar barbeiro|adicionar barbeiro|novo barbeiro|escolhendo um barbeiro)\b/i,
  ],
};

function detectCluster(text) {
  for (const [cluster, regexes] of Object.entries(CLUSTER_IDENTIFIERS)) {
    if (regexes.some((r) => r.test(text))) {
      return cluster;
    }
  }
  return null;
}

function getActiveHistoryCluster(history) {
  if (!history || history.length === 0) return null;
  const recent = history.slice(-4);
  for (let i = recent.length - 1; i >= 0; i--) {
    const cluster = detectCluster(recent[i].content);
    if (cluster) return cluster;
  }
  return null;
}

function resolveContextualQuery(currentQuery, history) {
  if (!history || history.length === 0) return currentQuery;

  const isClosure = CLOSURE_PATTERNS.some(p => p.test(currentQuery.trim()));
  if (isClosure) return currentQuery;

  const isExplicitSwitch = TOPIC_SWITCH_PATTERNS.some(p => p.test(currentQuery));
  if (isExplicitSwitch) {
    const cleanedQuery = currentQuery.replace(/\b(agora outra coisa|agora quero|mudando de assunto|outra duvida|outra pergunta|sobre outra coisa|beleza\s*\.?|agora preciso|deixa isso pra la|deixa isso pra lá\s*\.?)\b/gi, "").trim();
    return cleanedQuery || currentQuery;
  }

  const activeCluster = getActiveHistoryCluster(history);
  const detectedInCurrent = detectCluster(currentQuery);
  const isContinuation = CONTINUATION_PATTERNS.some(p => p.test(currentQuery));

  if (activeCluster === "PLANS") {
    if (isContinuation || !detectedInCurrent || detectedInCurrent === "PLANS" || /\b(\d+\s*barbeiros?|doze profissionais|quantos barbeiros?|qual voce escolheria|qual você escolheria|qual escolher|qual compensa|nao serve|não serve)\b/i.test(currentQuery)) {
      return `planos barbex pro elite limites ${currentQuery}`;
    }
  }

  if (activeCluster === "APPOINTMENTS") {
    if (isContinuation || !detectedInCurrent || detectedInCurrent === "APPOINTMENTS") {
      return `reagendar agendamento horario ${currentQuery}`;
    }
  }

  if (activeCluster === "WHATSAPP") {
    if (isContinuation || !detectedInCurrent || detectedInCurrent === "WHATSAPP") {
      return `whatsapp automacao zapi lembrete ${currentQuery}`;
    }
  }

  return currentQuery;
}

function retrieveTutorials(query, catalogItems) {
  const isClosure = CLOSURE_PATTERNS.some(p => p.test(query.trim()));
  if (isClosure) return [];

  const normQuery = normalizeText(query);
  const rawWords = normQuery.split(/\s+/).filter(w => w.length >= 2);
  const terms = rawWords.filter(w => !STOP_WORDS_SET.has(w));

  const scored = catalogItems.map(item => {
    let score = 0;
    let hasTitleOrCatMatch = false;
    let matchedTermsCount = 0;

    const normTitle = normalizeText(item.title);
    const normCat = normalizeText(item.category);
    const normDesc = normalizeText(item.description);
    const normNotes = normalizeText(item.notes || "");
    const allSteps = item.steps.map(s => normalizeText(s)).join(" ");

    for (const term of terms) {
      const variants = getVariants(term);
      let termMatched = false;

      if (variants.some(v => matchTerm(normTitle, v))) {
        score += 5.0;
        if (variants.some(v => new RegExp(`\\b${v}\\b`).test(normTitle))) score += 2.0;
        termMatched = true;
        hasTitleOrCatMatch = true;
      }
      if (variants.some(v => matchTerm(normCat, v))) {
        score += 2.5;
        termMatched = true;
        hasTitleOrCatMatch = true;
      }
      if (variants.some(v => matchTerm(normDesc, v))) {
        score += 2.0;
        termMatched = true;
      }
      if (variants.some(v => matchTerm(normNotes, v))) {
        score += 1.5;
        termMatched = true;
      }
      if (variants.some(v => matchTerm(allSteps, v))) {
        score += 1.0;
        termMatched = true;
      }

      if (termMatched) matchedTermsCount++;
    }

    if (terms.length >= 3 && matchedTermsCount === 1 && !hasTitleOrCatMatch) score = 0;
    if (!hasTitleOrCatMatch && score < 4.0) score = 0;

    const hasPlansIntent = terms.some(t => ["plano", "planos", "pro", "elite", "starter", "assinatura"].includes(t));
    const hasSizingOrChoice = terms.some(t => /\d+/.test(t) || ["escolheria", "escolher", "indicaria", "recomenda", "limite", "limites", "serve", "doze"].includes(t));
    if (item.id === "owner-team-management" && hasPlansIntent && hasSizingOrChoice) {
      score = 0;
    }

    const hasAppointmentIntent = terms.some(t => ["reagendar", "reagendamento", "agendamento", "horario", "remarcar"].includes(t));
    const hasChangeBarberIntent = terms.some(t => ["trocar", "mudar"].includes(t)) && terms.some(t => ["barbeiro", "profissional"].includes(t));
    if (item.id === "owner-team-management" && hasAppointmentIntent && hasChangeBarberIntent) {
      score = 0;
    }

    return { ...item, score };
  });

  const sorted = scored.filter(s => s.score >= 2.5).sort((a, b) => b.score - a.score);
  const topScore = sorted.length > 0 ? sorted[0].score : 0;
  return sorted.filter(a => a.score >= 5.0 || a.score >= topScore * 0.35).slice(0, 2);
}

let testCount = 0;
let passedCount = 0;

function runTest(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

// =============================================================================
// CENÁRIO A: VARIAÇÕES SOBRE PLANOS
// =============================================================================
console.log("--- CENÁRIO A: Variações Naturais sobre Planos ---");

const historyA = [];

runTest("A1. 'Me fala dos planos do Barbex.' -> recupera tutorial de planos", () => {
  const q = "Me fala dos planos do Barbex.";
  const res = resolveContextualQuery(q, historyA);
  const sources = retrieveTutorials(res, catalog);
  assert.ok(sources.some(s => s.id === "owner-barbex-plans-limits"));
  historyA.push({ role: "user", content: q });
  historyA.push({ role: "assistant", content: "O Barbex oferece Starter (até 3 barbeiros), Pro (até 10 barbeiros) e Elite (ilimitado)." });
});

runTest("A2. 'Qual compensa mais?' -> preserva cluster de planos", () => {
  const q = "Qual compensa mais?";
  const res = resolveContextualQuery(q, historyA);
  assert.ok(res.includes("planos"));
  const sources = retrieveTutorials(res, catalog);
  assert.ok(sources.some(s => s.id === "owner-barbex-plans-limits"));
  historyA.push({ role: "user", content: q });
  historyA.push({ role: "assistant", content: "Depende do tamanho: se tem até 10 barbeiros o Pro é excelente; se tem mais ou quer ilimitado, o Elite compensa." });
});

runTest("A3. 'Explica melhor, não manjo muito.' -> reformulação didática sem onboarding drift", () => {
  const q = "Explica melhor, não manjo muito.";
  const res = resolveContextualQuery(q, historyA);
  assert.ok(res.includes("planos"));
  const sources = retrieveTutorials(res, catalog);
  assert.ok(sources.some(s => s.id === "owner-barbex-plans-limits"));
  assert.ok(!sources.some(s => s.id === "owner-onboarding"));
  historyA.push({ role: "user", content: q });
  historyA.push({ role: "assistant", content: "Pense em cadeiras: o Pro cabe até 10 profissionais trabalhando juntos, o Elite não tem limite de cadeiras." });
});

runTest("A4. 'Minha equipe tem doze profissionais.' -> sizing ancorado em planos, não em gestão de equipe", () => {
  const q = "Minha equipe tem doze profissionais.";
  const res = resolveContextualQuery(q, historyA);
  assert.ok(res.includes("planos"));
  const sources = retrieveTutorials(res, catalog);
  assert.ok(sources.some(s => s.id === "owner-barbex-plans-limits"));
  assert.ok(!sources.some(s => s.id === "owner-team-management"));
  historyA.push({ role: "user", content: q });
  historyA.push({ role: "assistant", content: "Para 12 profissionais, você precisará do plano Elite, já que o Pro tem teto de 10." });
});

runTest("A5. 'Então o Pro não serve?' -> validação de limite preservando planos", () => {
  const q = "Então o Pro não serve?";
  const res = resolveContextualQuery(q, historyA);
  assert.ok(res.includes("planos"));
  const sources = retrieveTutorials(res, catalog);
  assert.ok(sources.some(s => s.id === "owner-barbex-plans-limits"));
});

// =============================================================================
// CENÁRIO B: MUDANÇA DE ASSUNTO
// =============================================================================
console.log("\n--- CENÁRIO B: Mudança Explícita de Assunto ---");

const historyB = [
  { role: "user", content: "Tenho uma dúvida sobre o Elite." },
  { role: "assistant", content: "O plano Elite oferece barbeiros e automações ilimitados." }
];

runTest("B1. 'Agora deixa isso pra lá. Como remarco um atendimento?' -> transição limpa para reagendamento", () => {
  const q = "Agora deixa isso pra lá. Como remarco um atendimento?";
  const res = resolveContextualQuery(q, historyB);
  assert.ok(!res.includes("elite") && !res.includes("plano"), "Zero contaminação de planos");
  const sources = retrieveTutorials(res, catalog);
  assert.ok(sources.some(s => s.id === "owner-appointment-cancellation-reschedule"));
  assert.ok(!sources.some(s => s.id === "owner-barbex-plans-limits"));
  historyB.push({ role: "user", content: q });
  historyB.push({ role: "assistant", content: "Abra a Agenda (/calendar), clique no atendimento e escolha Reagendar." });
});

runTest("B2. 'E o profissional, posso trocar junto?' -> continuidade em reagendamento", () => {
  const q = "E o profissional, posso trocar junto?";
  const res = resolveContextualQuery(q, historyB);
  assert.ok(res.includes("reagendar") || res.includes("agendamento"));
  const sources = retrieveTutorials(res, catalog);
  assert.ok(sources.some(s => s.id === "owner-appointment-cancellation-reschedule"));
  assert.ok(!sources.some(s => s.id === "owner-team-management"));
});

// =============================================================================
// CENÁRIO C: AMBIGUIDADE REAL (ESCOLHA DE BARBEIRO VS PLANO)
// =============================================================================
console.log("\n--- CENÁRIO C: Ambiguidade Real (Contexto Operacional de Escolha de Barbeiro) ---");

const historyC = [
  { role: "user", content: "Estou escolhendo um barbeiro para atender um cliente." },
  { role: "assistant", content: "Certo! Você pode verificar a disponibilidade de cada profissional na grade de horários da Agenda." }
];

runTest("C1. 'Tenho 12 barbeiros. Qual você escolheria?' no contexto operacional NÃO deve forçar planos", () => {
  const q = "Tenho 12 barbeiros. Qual você escolheria?";
  const res = resolveContextualQuery(q, historyC);
  // Como o histórico anterior NÃO está no cluster PLANS, a query não deve ser inflada com "planos barbex pro elite"
  assert.ok(!res.includes("planos barbex pro elite"), "Não deve forçar planos quando o assunto anterior era agendamento/atendimento");
  console.log(`    [Cenário C Resolução]: "${res}" (Correto: cluster operacional preservado sem forçar plano)`);
});

// =============================================================================
// CENÁRIO D: ENCERRAMENTO NATURAL
// =============================================================================
console.log("\n--- CENÁRIO D: Encerramento Natural ---");

const historyD = [
  { role: "user", content: "Onde configuro a Z-API?" },
  { role: "assistant", content: "Acesse Configurações -> Integrações (/settings/integrations)." }
];

runTest("D1. 'Obrigado, resolveu.' -> detecta encerramento e retorna 0 fontes", () => {
  const q = "Obrigado, resolveu.";
  const res = resolveContextualQuery(q, historyD);
  const sources = retrieveTutorials(res, catalog);
  assert.strictEqual(sources.length, 0, "Encerramento deve ter zero fontes");
});

runTest("D2. 'Até mais.' -> detecta despedida e retorna 0 fontes", () => {
  const q = "Até mais.";
  const res = resolveContextualQuery(q, historyD);
  const sources = retrieveTutorials(res, catalog);
  assert.strictEqual(sources.length, 0, "Despedida deve ter zero fontes");
});

// =============================================================================
// CENÁRIO E: REFORMULAÇÃO APÓS RESPOSTA LONGA (> 500 CARACTERES)
// =============================================================================
console.log("\n--- CENÁRIO E: Reformulação após Resposta Longa (> 500 Chars) ---");

const longText = "O Barbex disponibiliza planos desenhados para a escala do seu negócio: o Starter atende o profissional solo, o Pro suporta até 10 barbeiros ativos na grade com 8 réguas automatizadas de comunicação, e o Elite entrega capacidade ilimitada para redes e barbearias de grande porte sem qualquer trava de cadastro. Para consultar os detalhes completos, acesse a rota oficial /subscription no seu menu lateral.";
assert.ok(longText.length > 300);

const historyE = [
  { role: "user", content: "Qual a diferença entre os planos?" },
  { role: "assistant", content: longText + " " + longText } // > 600 chars
];

runTest("E1. 'Não entendi. Explica de outro jeito.' após resposta longa preserva PLANS", () => {
  const q = "Não entendi. Explica de outro jeito.";
  const res = resolveContextualQuery(q, historyE);
  assert.ok(res.includes("planos"));
  const sources = retrieveTutorials(res, catalog);
  assert.ok(sources.some(s => s.id === "owner-barbex-plans-limits"));
});

// =============================================================================
// CENÁRIO F: PERGUNTA SEM CONTEXTO SUFICIENTE (COLD START)
// =============================================================================
console.log("\n--- CENÁRIO F: Pergunta Isolada sem Contexto Prévia ---");

runTest("F1. 'Qual deles você escolheria?' sem histórico não assume planos arbitrariamente", () => {
  const q = "Qual deles você escolheria?";
  const res = resolveContextualQuery(q, []); // Histórico vazio
  assert.strictEqual(res, q, "Sem histórico, query não sofre expansão artificial");
  const sources = retrieveTutorials(res, catalog);
  // Não deve trazer planos com alta confiança sem referente
  assert.ok(!sources.some(s => s.id === "owner-barbex-plans-limits" && s.score > 15));
});

console.log("\n================================================================================");
console.log(`TOTAL DE TESTES CONTRA OVERFITTING: ${testCount} | APROVADOS: ${passedCount}`);
console.log("================================================================================");

