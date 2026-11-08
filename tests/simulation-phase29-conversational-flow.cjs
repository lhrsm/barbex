/**
 * BARBEX — FASE R2E.26E.22N.29: GATE 9 — SIMULAÇÃO DETERMINÍSTICA DO FLUXO CONVERSACIONAL LOCAL
 *
 * Simula uma sessão real em memória de 5 turnos com o MockAIProvider determinístico:
 * Turno 1: "Fala, meu parceiro! Me ajuda a organizar os agendamentos?"
 * Turno 2: "Um cliente quer mudar o horário. Como faço?"
 * Turno 3: "Me explica de um jeito simples a diferença entre os planos Pro e Elite."
 * Turno 4: "Não entendi direito. Pode me explicar de outra forma?" (Deve manter o foco nos planos!)
 * Turno 5: "E a chave PIX, como configuro?" (Deve mudar para PIX sem contaminação!)
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");

console.log("================================================================================");
console.log("BARBEX — R2E.26E.22N.29: SIMULAÇÃO LOCAL DE FLUXO CONVERSACIONAL (GATE 9)");
console.log("================================================================================\n");

// Catalog mock aligned with TUTORIALS_CATALOG
const catalog = [
  {
    id: "owner-config-barbershop",
    title: "Configurações da Barbearia e Chave PIX",
    category: "Essencial",
    route: "/settings",
    description: "Configure a chave PIX da barbearia e gerencie os dados cadastrais do estabelecimento.",
    steps: ["No menu lateral acesse Configurações (/settings)", "Selecione a aba PIX", "Informe sua chave PIX oficial"],
    notes: "A chave PIX cadastrada é exibida ao cliente na página pública de agendamento."
  },
  {
    id: "owner-calendar-multiprofile",
    title: "Agenda Avançada Multiperfil",
    category: "Homologado",
    route: "/calendar",
    description: "Navegue nos 4 modos homologados: Dia, Semana, Mês e Período Personalizado com filtros rápidos em tempo real para organizar seus agendamentos e atendimentos.",
    steps: ["Abra a Agenda (/calendar)", "Filtre por profissional ou status", "Visualize os atendimentos do dia"],
    notes: "Os filtros da agenda operam dinamicamente em tempo real na interface e não possuem armazenamento de filtros salvos."
  },
  {
    id: "owner-appointment-creation",
    title: "Como Criar um Agendamento no Painel",
    category: "Operação",
    route: "/calendar",
    description: "Crie novos agendamentos rapidamente pela Agenda principal ou pela Recepção, selecionando cliente, barbeiro, serviços e horário.",
    steps: ["Acesse a Agenda (/calendar)", "Clique em + Novo Agendamento", "Selecione cliente e serviços"],
    notes: "O agendamento confirmado bloqueia o horário na grade."
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
    id: "reception-walkin-queue",
    title: "Fila de Espera Operacional e Atendimento Walk-in",
    category: "Recepção",
    route: "/reception/waiting-list",
    description: "Gerencie clientes presenciais sem agendamento prévio na fila de espera operacional.",
    steps: ["Acesse a fila", "Adicione cliente walk-in", "Chame o cliente"],
    notes: "Para atendimento presencial sem agendamento."
  }
];

// Reutilização determinística do motor de busca e resolução contextual de knowledge.server.ts
function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

const CONTINUATION_PATTERNS = [
  /\b(nao entendi|não entendi|entendi direito|explica(r)?|de novo|outra forma|outro jeito|mais simples|simplificar|simplifica|detalha(r)?|melhor)\b/i,
  /\b(e quanto custa|quanto custa|quanto e|quanto é|qual o valor|qual o preco|qual o preço|qual a diferenca|qual a diferença)\b/i,
  /\b(como faco isso|como faço isso|como funciona isso|como assim|onde fica isso|onde vejo isso)\b/i,
  /\b(e no elite|e no pro|e no starter|e na recepcao|e na recepção|isso funciona na recepcao|isso funciona na recepção)\b/i,
];

const TOPIC_DOMAIN_TERMS = new Set([
  "pix", "chave", "qrcode", "comissao", "comissoes", "repasse",
  "servico", "servicos", "corte", "barba",
  "agendamento", "agendar", "agenda", "calendario", "cancelar", "reagendar", "desmarcar",
  "walkin", "fila", "espera", "comanda", "split",
  "whatsapp", "zapi", "notificacao",
  "plano", "planos", "assinatura", "starter", "pro", "elite", "upgrade",
  "barbeiro", "barbeiros", "profissional", "profissionais", "equipe",
  "suporte", "chamado"
]);

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
  crio: ["cria", "criar", "criacao", "novo", "agendamento", "marcar"],
  criar: ["cria", "crio", "criacao", "novo", "agendamento", "marcar"],
  agendar: ["agendo", "agendamento", "marcar", "agenda", "horario"],
  agendamento: ["agendar", "agendamentos", "horario", "agenda", "atendimento"],
  agendamentos: ["agendar", "agendamento", "horario", "agenda", "atendimento"],
  cancelo: ["cancelar", "cancelamento", "desmarcar", "excluir"],
  cancelar: ["cancelo", "cancelamento", "desmarcar"],
  cancelamento: ["cancelo", "cancelar", "desmarcar"],
  reagendo: ["reagendar", "reagendamento", "remarcar"],
  reagendar: ["reagendo", "reagendamento", "remarcar", "mudar", "alterar"],
  reagendamento: ["reagendar", "remarcar", "mudar", "alterar"],
  remarcar: ["reagendar", "reagendamento", "mudar", "alterar"],
  mudar: ["reagendar", "reagendamento", "remarcar", "alterar", "trocar", "horario"],
  alterar: ["reagendar", "reagendamento", "remarcar", "mudar", "trocar"],
  trocar: ["reagendar", "reagendamento", "remarcar", "mudar", "alterar"],
  horario: ["horarios", "agendamento", "reagendar", "reagendamento", "remarcar", "agenda"],
  horarios: ["horario", "agendamento", "reagendar", "reagendamento", "remarcar", "agenda"],

  // Organização e Visualização da Agenda
  organizar: ["agenda", "calendario", "grade", "painel", "visualizacao", "filtros"],
  organizacao: ["agenda", "calendario", "grade", "painel"],
  plano: ["planos", "assinatura", "starter", "pro", "elite", "upgrade", "limite", "limites"],
  planos: ["plano", "assinatura", "starter", "pro", "elite", "upgrade", "limite", "limites"],
  starter: ["plano", "planos", "limite"],
  pro: ["plano", "planos", "limite"],
  elite: ["plano", "planos", "limite"],
  pix: ["chave", "pagamento", "qr", "qrcode"],
  pagamento: ["pagamentos", "pix", "cartao"],
  espera: ["fila", "walkin", "encaixe"],
  fila: ["espera", "walkin", "encaixe"],
  walkin: ["fila", "espera", "encaixe"]
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

function resolveContextualQuery(currentQuery, history) {
  if (!history || history.length === 0) return currentQuery;

  const normCurrent = normalizeText(currentQuery);
  const currentWords = normCurrent.split(/\s+/).filter((w) => w.length >= 2);
  const currentTopicHits = currentWords.filter((w) => TOPIC_DOMAIN_TERMS.has(w));

  const isExplicitContinuity = CONTINUATION_PATTERNS.some((p) => p.test(currentQuery));
  const isShortQuery = currentWords.length <= 6;

  if (!isExplicitContinuity && currentTopicHits.length >= 2) {
    return currentQuery;
  }

  if (!isExplicitContinuity && !isShortQuery) {
    return currentQuery;
  }

  const previousUserMsg = [...history].reverse().find((m) => m.role === "user");
  if (!previousUserMsg) return currentQuery;

  const normPrev = normalizeText(previousUserMsg.content);
  const prevWords = normPrev.split(/\s+/).filter((w) => w.length >= 2);
  const prevTopicTerms = prevWords.filter((w) => TOPIC_DOMAIN_TERMS.has(w));

  if (prevTopicTerms.length > 0) {
    const uniquePrevTerms = Array.from(new Set(prevTopicTerms)).join(" ");
    return `${uniquePrevTerms} ${currentQuery}`;
  }

  return currentQuery;
}

function retrieveTutorials(query, history) {
  const effectiveQuery = resolveContextualQuery(query, history);
  const normalized = normalizeText(effectiveQuery);
  const words = normalized.split(/\s+/).filter(w => w.length >= 2);
  const terms = Array.from(new Set(words.filter(w => !STOP_WORDS_SET.has(w))));

  if (terms.length === 0) return { effectiveQuery, results: [] };

  const candidateArticles = catalog.map(c => ({ ...c, score: 0 }));

  for (const article of candidateArticles) {
    let score = 0;
    let matchedTermsCount = 0;
    let hasTitleOrCatMatch = false;

    const titleNorm = normalizeText(article.title);
    const catNorm = normalizeText(article.category);
    const descNorm = normalizeText(article.description);
    const stepsNorm = normalizeText(article.steps.join(" "));
    const notesNorm = normalizeText(article.notes || "");

    for (const term of terms) {
      const variants = getVariants(term);
      let termMatched = false;

      if (variants.some(v => matchTerm(titleNorm, v))) {
        score += 5.0;
        if (variants.some(v => new RegExp(`\\b${v}\\b`).test(titleNorm))) score += 2.0;
        termMatched = true;
        hasTitleOrCatMatch = true;
      }
      if (variants.some(v => matchTerm(catNorm, v))) {
        score += 2.5;
        termMatched = true;
        hasTitleOrCatMatch = true;
      }
      if (variants.some(v => matchTerm(descNorm, v))) {
        score += 2.0;
        termMatched = true;
      }
      if (variants.some(v => matchTerm(notesNorm, v))) {
        score += 1.5;
        termMatched = true;
      }
      if (variants.some(v => matchTerm(stepsNorm, v))) {
        score += 1.0;
        termMatched = true;
      }
      if (termMatched) matchedTermsCount++;
    }

    if (terms.length >= 3 && matchedTermsCount === 1 && !hasTitleOrCatMatch) score = 0;
    if (!hasTitleOrCatMatch && score < 4.0) score = 0;

    const hasWalkinIntent = terms.some(t => ["walkin", "fila", "espera", "encaixe"].includes(t));
    if (article.id === "reception-walkin-queue" && !hasWalkinIntent) score = 0;

    article.score = score;
  }

  const sorted = candidateArticles.filter(a => a.score >= 2.5).sort((a, b) => b.score - a.score);
  const topScore = sorted.length > 0 ? sorted[0].score : 0;
  const filtered = sorted.filter(a => a.score >= 5.0 || a.score >= topScore * 0.35).slice(0, 3);

  return { effectiveQuery, results: filtered };
}

// Emulação do Mock Provider com suporte determinístico a contexto
function generateMockResponse(question, sources, history) {
  if (sources.length === 0) {
    return "Não localizei um tutorial específico sobre isso na Central de Ajuda do Barbex. Você pode abrir um chamado em /support ou enviar e-mail para suporte@barbex.shop.";
  }

  const primary = sources[0];
  const isRephrase = /\b(nao entendi|não entendi|de outra forma|outro jeito|simplifica|simplificar|de novo)\b/i.test(question);

  if (isRephrase && primary.id === "owner-barbex-plans-limits") {
    return "Sem problemas! Explicando de forma bem prática: o plano Pro atende até 10 barbeiros com clientes ilimitados por R$ 99,90/mês. Já o Elite não possui nenhum limite de equipe ou automação por R$ 149,90/mês. Você pode comparar os limites da sua barbearia na rota /subscription.";
  }

  if (primary.id === "owner-barbex-plans-limits") {
    return "O Barbex oferece três planos na rota /subscription: Starter (até 3 barbeiros e 300 clientes por R$ 59,90/mês), Pro (até 10 barbeiros e clientes ilimitados por R$ 99,90/mês) e Elite (profissionais, clientes e automações ilimitados por R$ 149,90/mês). Os limites e upgrade de plano ficam disponíveis no topo de /subscription.";
  }

  if (primary.id === "owner-appointment-cancellation-reschedule") {
    return "Para mudar o horário de um cliente, acesse /calendar, clique sobre o agendamento desejado e selecione 'Reagendar'. Você poderá escolher a nova data e horário (e até trocar o profissional no Passo 1). Ao confirmar, a grade é atualizada automaticamente.";
  }

  if (primary.id === "owner-calendar-multiprofile") {
    return "Para organizar seus agendamentos, acesse a Agenda em /calendar. Você pode alternar as visualizações entre Dia, Semana, Mês ou Período Personalizado e filtrar em tempo real por profissional ou status de pagamento.";
  }

  if (primary.id === "owner-config-barbershop") {
    return "Para configurar sua chave PIX, acesse Configurações (/settings) e clique na aba 'PIX'. Preencha sua chave (CPF, CNPJ, e-mail, celular ou aleatória), anexe o QR Code se desejar e clique em 'Salvar Configurações'.";
  }

  return `Você pode realizar essa operação acessando a rota ${primary.route}. Procedimento: ${primary.steps.join(" ")}`;
}

// EXECUÇÃO DA SESSÃO SIMULADA EM 5 TURNOS
const sessionHistory = [];

const turns = [
  {
    turn: 1,
    query: "Fala, meu parceiro! Me ajuda a organizar os agendamentos?",
    expectedPrimaryArticle: "owner-calendar-multiprofile",
  },
  {
    turn: 2,
    query: "Um cliente quer mudar o horário. Como faço?",
    expectedPrimaryArticle: "owner-appointment-cancellation-reschedule",
  },
  {
    turn: 3,
    query: "Me explica de um jeito simples a diferença entre os planos Pro e Elite.",
    expectedPrimaryArticle: "owner-barbex-plans-limits",
  },
  {
    turn: 4,
    query: "Não entendi direito. Pode me explicar de outra forma?",
    expectedPrimaryArticle: "owner-barbex-plans-limits", // CRÍTICO: NÃO PODE VAZAR CANCELAMENTO OU OUTRO!
  },
  {
    turn: 5,
    query: "E a chave PIX, como configuro?",
    expectedPrimaryArticle: "owner-config-barbershop", // CRÍTICO: MUDANÇA DE TÓPICO SEM RESÍDUO DE PLANOS!
  }
];

let allPassed = true;

for (const t of turns) {
  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`TURNO ${t.turn}: Administrador pergunta: "${t.query}"`);
  console.log(`Histórico em memória da sessão: ${sessionHistory.length} mensagens`);

  const { effectiveQuery, results } = retrieveTutorials(t.query, sessionHistory);
  console.log(`Consulta efetiva após resolução contextual: "${effectiveQuery}"`);

  if (results.length === 0) {
    console.error(`[FALHA] Nenhum artigo recuperado!`);
    allPassed = false;
    continue;
  }

  const primary = results[0];
  console.log(`Artigo líder recuperado: ${primary.id} (Score: ${primary.score}) - Título: "${primary.title}"`);

  if (primary.id !== t.expectedPrimaryArticle) {
    console.error(`[FALHA] Esperava '${t.expectedPrimaryArticle}', mas obteve '${primary.id}'`);
    allPassed = false;
  } else {
    console.log(`[SUCESSO] Artigo recuperado com precisão cirúrgica: ${primary.id}`);
  }

  const reply = generateMockResponse(t.query, results, sessionHistory);
  console.log(`Resposta do Assistente:\n"${reply}"`);

  // Adiciona ao histórico da sessão em memória
  sessionHistory.push({ role: "user", content: t.query });
  sessionHistory.push({ role: "assistant", content: reply });
}

console.log("\n================================================================================");
if (allPassed) {
  console.log("VEREDITO DA SIMULAÇÃO: 5/5 TURNOS HOMOLOGADOS COM 100% DE FIDELIDADE CONTEXTUAL!");
} else {
  console.error("VEREDITO DA SIMULAÇÃO: FALHAS DETECTADAS!");
  process.exit(1);
}
console.log("================================================================================");
