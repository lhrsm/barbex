import { TUTORIALS_CATALOG, type TutorialItem } from "@/lib/tutorials.catalog";

export interface TutorialSource {
  id: string;
  title: string;
  category: string;
  route: string;
  description: string;
  steps: string[];
  notes?: string;
  score: number;
}

const STOP_WORDS = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos", "e",
  "em", "na", "nas", "no", "nos", "o", "os", "ou", "para", "por", "que", "se", "um",
  "uma", "uns", "umas", "eu", "ele", "ela", "eles", "elas", "meu", "minha", "meus", "minhas",
  "seu", "sua", "seus", "suas", "fazer", "posso", "consigo", "onde", "aonde", "qual", "quais",
  "quando", "quanto", "quantos", "quanta", "quantas", "barbex",
  "sao", "são", "sou", "somos", "ser", "sera", "será", "seria", "foi", "foram", "era", "eram",
  "esta", "está", "estao", "estão", "esteve", "estar", "estava",
  "ter", "tem", "temos", "têm", "tinha", "tive", "teve",
  "ha", "há", "houve", "havia",
  "dizer", "saber", "sei", "sabe", "sabemos", "ver", "vejo", "veja", "vemos", "olha", "olhar",
  "dar", "da", "dá", "dado", "deu",
  "ir", "vai", "vao", "vão", "vou", "vamos",
  "aqui", "ali", "la", "lá",
  "isso", "isto", "aquilo", "este", "esta", "estes", "estas", "esse", "essa", "esses", "essas",
  "me", "mim", "comigo", "te", "ti", "contigo", "nos", "nós", "conosco", "lhe", "lhes",
  "muito", "pouco", "mais", "menos", "bem", "mal", "ja", "já", "ainda", "so", "só", "apenas",
  "tudo", "nada", "algo", "alguem", "alguém", "algum", "alguma", "alguns", "algumas", "nenhum", "nenhuma",
  // Palavras discursivas e metalinguísticas sem valor temático de domínio
  "forma", "formas", "direito", "explica", "explicar", "explicacao", "explicação",
  "jeito", "entendi", "entender", "simplifica", "simplificar", "novamente", "novo",
  "outro", "outra", "outros", "outras", "fala", "parceiro", "ajuda", "ajudar",
  "quer", "quero", "queria", "quiser", "faco", "faço", "faz", "fazer",
  // Termos de domínio genéricos que não devem distorcer o ranking
  "barbearia", "barbearias", "sistema", "plataforma", "aplicativo", "app"
]);

function normalizeText(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

/**
 * Dicionário canônico de expansão semântica e stems de operações do Barbex.
 * Conecta flexões verbais e sinônimos aos termos das funcionalidades reais.
 */
const STEM_DICTIONARY: Record<string, string[]> = {
  // Criação / Agendamento
  crio: ["cria", "criar", "criacao", "novo", "agendamento", "marcar"],
  criar: ["cria", "crio", "criacao", "novo", "agendamento", "marcar"],
  criacao: ["cria", "criar", "crio", "novo", "agendamento"],
  agendo: ["agendar", "agendamento", "marcar", "agenda", "horario"],
  agendar: ["agendo", "agendamento", "marcar", "agenda", "horario"],
  agendamento: ["agendar", "agendamentos", "horario", "agenda", "atendimento"],
  agendamentos: ["agendar", "agendamento", "horario", "agenda", "atendimento"],
  marcar: ["agendar", "agendamento", "agenda", "horario"],

  // Cancelamento / Reagendamento
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

  // Planos / Assinaturas Barbex SaaS
  plano: ["planos", "assinatura", "starter", "pro", "elite", "upgrade", "limite", "limites"],
  planos: ["plano", "assinatura", "starter", "pro", "elite", "upgrade", "limite", "limites"],
  limite: ["limites", "plano", "planos", "capacidade", "cota"],
  limites: ["limite", "plano", "planos", "capacidade", "cota"],
  assinatura: ["assinaturas", "plano", "planos", "mensalidade", "upgrade"],
  assinaturas: ["assinatura", "plano", "planos", "mensalidade"],
  upgrade: ["plano", "planos", "mudar", "trocar", "assinatura"],
  downgrade: ["plano", "planos", "mudar", "trocar", "assinatura"],
  addon: ["addons", "modulo", "modulos", "adicional", "adicionais", "plano"],
  addons: ["addon", "modulo", "modulos", "adicional", "adicionais", "plano"],
  starter: ["plano", "planos", "limite", "preco"],
  pro: ["plano", "planos", "limite", "preco"],
  elite: ["plano", "planos", "limite", "preco"],

  // Barbeiros / Profissionais / Equipe
  barbeiro: ["barbeiros", "profissional", "profissionais", "equipe"],
  barbeiros: ["barbeiro", "profissional", "profissionais", "equipe"],
  profissional: ["profissionais", "barbeiro", "barbeiros", "equipe"],
  profissionais: ["profissional", "barbeiro", "barbeiros", "equipe"],
  equipe: ["barbeiros", "profissionais", "time"],

  // Comissões
  comissao: ["comissoes", "repasse", "porcentagem", "percentual"],
  comissoes: ["comissao", "repasse", "porcentagem", "percentual"],

  // Pagamentos / PIX
  pix: ["chave", "pagamento", "qr", "qrcode", "transferencia"],
  pagamento: ["pagamentos", "pix", "cartao", "dinheiro", "comanda"],
  pagamentos: ["pagamento", "pix", "cartao", "dinheiro", "comanda"],

  // Recepção / Walk-in / Fila
  recepcao: ["recepcionista", "balcao", "agenda", "atendimento"],
  recepcionista: ["recepcao", "balcao"],
  espera: ["fila", "walkin", "encaixe"],
  fila: ["espera", "walkin", "encaixe"],
  walkin: ["fila", "espera", "encaixe"]
};

/**
 * Deriva variações morfológicas controladas do Português (singular/plural)
 * protegendo palavras curtas contra regras de sufixo indevidas.
 */
function getWordVariants(word: string): string[] {
  const norm = normalizeText(word);
  const variants = new Set<string>([norm]);

  // 1. Expansão semântica via dicionário operacional
  if (STEM_DICTIONARY[norm]) {
    for (const v of STEM_DICTIONARY[norm]) {
      variants.add(v);
    }
  }

  // 2. Variação singular/plural para substantivos comuns
  if (norm.endsWith("s") && norm.length > 4) {
    variants.add(norm.slice(0, -1));
  } else if (!norm.endsWith("s") && norm.length >= 4) {
    variants.add(norm + "s");
  }

  // 3. Regra de -ão / -ões SOMENTE para palavras com pelo menos 4 caracteres
  if (norm.length >= 4) {
    if (norm.endsWith("oes")) {
      variants.add(norm.replace(/oes$/, "ao"));
    } else if (norm.endsWith("ao")) {
      variants.add(norm.replace(/ao$/, "oes"));
    }
  }

  return Array.from(variants);
}

function extractQueryTerms(query: string): string[] {
  const normalized = normalizeText(query);
  const words = normalized.split(/\s+/).filter((w) => w.length >= 2);
  const filtered = words.filter((w) => !STOP_WORDS.has(w));
  return Array.from(new Set(filtered));
}

/**
 * Validação de correspondência de termos respeitando fronteiras de palavra
 * para evitar que palavras curtas colidam com substrings acidentais.
 */
function matchTermInText(textNorm: string, variant: string): boolean {
  if (!variant || variant.length < 2) return false;
  // Palavras curtas (<= 4 letras): exigem fronteira de palavra estrita (\b)
  if (variant.length <= 4) {
    return new RegExp(`\\b${variant}\\b`).test(textNorm);
  }
  // Palavras médias/longas (>= 5 letras): match no início ou palavra inteira
  return new RegExp(`\\b${variant}`).test(textNorm);
}

/**
 * Padrões indicativos de encerramento / agradecimento (sem necessidade de busca de tutoriais).
 */
export const CLOSURE_PATTERNS = [
  /\b(valeu|obrigad[oa]|era isso|so isso|só isso|fechou|por hoje e so|por hoje é só|tchau|ate mais|até mais|falou|muito obrigado|perfeito valeu)\b/i,
];

/**
 * Padrões indicativos de mudança explícita de assunto.
 */
export const TOPIC_SWITCH_PATTERNS = [
  /\b(agora (outra coisa|outro assunto|quero|preciso|me ajuda a)|mudando de assunto|outra duvida|outra dúvida|sobre outro tema|agora sobre)\b/i,
];

/**
 * Padrões indicativos de anáfora, continuidade, comparação, escolha ou pedido de reformulação.
 */
export const CONTINUATION_PATTERNS = [
  /\b(nao entendi|não entendi|entendi direito|explica(r)?|de novo|outra forma|outro jeito|mais simples|simplificar|simplifica|detalha(r)?|melhor)\b/i,
  /\b(comecando agora|começando agora|como iniciante|iniciante|leigo|do zero|como se eu estivesse|como se fosse)\b/i,
  /\b(qual (voce|você)? (escolheria|recomenda|indica|pegaria|seria melhor|e melhor|é melhor)|qual dos dois|qual deles|qual escolher)\b/i,
  /\b(\d+|quantos?|tantos?)\s+(barbeiros?|profissionais?|cadeiras?)\b/i,
  /\b(e quanto custa|quanto custa|quanto e|quanto é|qual o valor|qual o preco|qual o preço|qual a diferenca|qual a diferença)\b/i,
  /\b(como faco isso|como faço isso|como funciona isso|como assim|onde fica isso|onde vejo isso)\b/i,
  /\b(e no elite|e no pro|e no starter|e na recepcao|e na recepção|isso funciona na recepcao|isso funciona na recepção)\b/i,
  /\b(e se eu tiver|e se tiver|e se for|e se eu quiser|e mudar|e trocar|trocar o barbeiro|mudar o barbeiro|trocar o barbeiro dele|trocar o profissional|tambem|também)\b/i,
  /\b(dele|dela|desse cliente|deste cliente|desse atendimento|deste agendamento)\b/i,
];

export type TopicClusterKey = "PLANS" | "APPOINTMENTS" | "WHATSAPP" | "PIX" | "COMMISSIONS" | "TEAM";

export const CLUSTER_IDENTIFIERS: Record<TopicClusterKey, RegExp[]> = {
  PLANS: [
    /\b(plano|planos|assinatura|starter|pro|elite|upgrade|downgrade|limite|limites|addon|add-on|ia para atendimento|mensalidade|preco|preço|valor)\b/i,
  ],
  APPOINTMENTS: [
    /\b(agendamento|agendar|agenda|calendario|calendário|horario|horário|cancelar|reagendar|desmarcar|remarcar|atendimento)\b/i,
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
    /\b(equipe|cadastrar barbeiro|adicionar barbeiro|novo barbeiro)\b/i,
  ],
};

export function detectCluster(text: string): TopicClusterKey | null {
  for (const [cluster, regexes] of Object.entries(CLUSTER_IDENTIFIERS) as [TopicClusterKey, RegExp[]][]) {
    if (regexes.some((r) => r.test(text))) {
      return cluster;
    }
  }
  return null;
}

export function getActiveHistoryCluster(
  history?: Array<{ role: string; content: string }>
): TopicClusterKey | null {
  if (!history || history.length === 0) return null;
  const recent = history.slice(-4);
  for (let i = recent.length - 1; i >= 0; i--) {
    const cluster = detectCluster(recent[i].content);
    if (cluster) return cluster;
  }
  return null;
}

/**
 * Termos indicadores de temas específicos para ancoragem contextual e prevenção de contaminação cruzada.
 */
const TOPIC_DOMAIN_TERMS = new Set([
  "pix", "chave", "qrcode", "comissao", "comissoes", "repasse",
  "servico", "servicos", "corte", "barba",
  "agendamento", "agendar", "agenda", "calendario", "cancelar", "reagendar", "desmarcar",
  "walkin", "fila", "espera", "comanda", "split",
  "whatsapp", "zapi", "lembrete", "lembretes", "notificacao",
  "plano", "planos", "assinatura", "starter", "pro", "elite", "upgrade", "limite", "limites", "addon", "mensalidade",
  "barbeiro", "barbeiros", "profissional", "profissionais", "equipe",
  "suporte", "chamado"
]);

/**
 * Resolução Contextual Determinística de Consultas Anafóricas (Gate 3 - Fase 34)
 */
export function resolveContextualQuery(
  currentQuery: string,
  history?: Array<{ role: string; content: string }>
): string {
  if (!history || history.length === 0) {
    return currentQuery;
  }

  // 1. Encerramento / Agradecimento (se não tiver intenção de pergunta)
  const isClosure = CLOSURE_PATTERNS.some((p) => p.test(currentQuery));
  const hasQuestionIntent = /[?]|(como|onde|qual|quando|por que|mudar|trocar|ajuda)/i.test(currentQuery);
  if (isClosure && !hasQuestionIntent) {
    return currentQuery;
  }

  // 2. Mudança explícita de assunto ("Agora outra coisa: ...", "Mudando de assunto...")
  const isTopicSwitch = TOPIC_SWITCH_PATTERNS.some((p) => p.test(currentQuery));
  if (isTopicSwitch) {
    return currentQuery;
  }

  // 3. Resolução determinística baseada no cluster ativo da sessão
  const isContinuation = CONTINUATION_PATTERNS.some((p) => p.test(currentQuery));
  const activeCluster = getActiveHistoryCluster(history);

  if (isContinuation && activeCluster) {
    if (activeCluster === "PLANS") {
      return `planos pro elite ${currentQuery}`;
    }
    if (activeCluster === "APPOINTMENTS") {
      return `reagendamento agendamento calendar ${currentQuery}`;
    }
    if (activeCluster === "WHATSAPP") {
      return `whatsapp notificacoes lembretes ${currentQuery}`;
    }
    if (activeCluster === "PIX") {
      return `pix chave configuracoes ${currentQuery}`;
    }
    if (activeCluster === "COMMISSIONS") {
      return `comissoes repasse financas ${currentQuery}`;
    }
  }

  // 4. Fallback legado de proximidade de termos caso nenhum cluster forte seja identificado
  const normCurrent = normalizeText(currentQuery);
  const currentWords = normCurrent.split(/\s+/).filter((w) => w.length >= 2);
  const currentTopicHits = currentWords.filter((w) => TOPIC_DOMAIN_TERMS.has(w));
  const isShortQuery = currentWords.length <= 6;

  if (!isContinuation && currentTopicHits.length >= 1) {
    return currentQuery;
  }

  if (!isContinuation && !isShortQuery) {
    return currentQuery;
  }

  const recentHistory = history.slice(-3);
  let contextualTopicTerms: string[] = [];

  const previousUserMsg = [...recentHistory].reverse().find((m) => m.role === "user");
  if (previousUserMsg) {
    const normUser = normalizeText(previousUserMsg.content);
    const userWords = normUser.split(/\s+/).filter((w) => w.length >= 2);
    contextualTopicTerms = userWords.filter((w) => TOPIC_DOMAIN_TERMS.has(w));
  }

  if (contextualTopicTerms.length === 0) {
    const previousAssistantMsg = [...recentHistory].reverse().find((m) => m.role === "assistant");
    if (previousAssistantMsg) {
      const normAssistant = normalizeText(previousAssistantMsg.content);
      const assistantWords = normAssistant.split(/\s+/).filter((w) => w.length >= 2);
      contextualTopicTerms = assistantWords.filter((w) => TOPIC_DOMAIN_TERMS.has(w)).slice(0, 4);
    }
  }

  if (contextualTopicTerms.length > 0) {
    const uniquePrevTerms = Array.from(new Set(contextualTopicTerms)).join(" ");
    return `${uniquePrevTerms} ${currentQuery}`;
  }

  return currentQuery;
}

/**
 * Recuperador Textual Canônico da Base de Conhecimento Barbex
 *
 * Busca tutoriais publicados e elegíveis para administradores de barbearia (tenant_admin).
 * Prioriza precisão cirúrgica, relevância contextual e ausência de falsos positivos.
 */
export async function retrieveRelevantTutorials(
  query: string,
  options?: {
    maxResults?: number;
    minScoreThreshold?: number;
    supabaseClient?: any;
    history?: Array<{ role: string; content: string }>;
  }
): Promise<TutorialSource[]> {
  const maxResults = options?.maxResults ?? 3;
  const minScoreThreshold = options?.minScoreThreshold ?? 2.5;

  // Interceptador de Encerramento: se for apenas agradecimento/fechamento, não recupera tutoriais
  const isClosure = CLOSURE_PATTERNS.some((p) => p.test(query));
  const hasQuestionIntent = /[?]|(como|onde|qual|quando|por que|mudar|trocar|ajuda)/i.test(query);
  if (isClosure && !hasQuestionIntent) {
    return [];
  }

  // Resolução contextual determinística (Gate 3 - Fase 34)
  const effectiveQuery = resolveContextualQuery(query, options?.history);
  const terms = extractQueryTerms(effectiveQuery);

  if (terms.length === 0) {
    return [];
  }

  // Coleção candidata: catálogo de tutoriais canônicos elegíveis para o painel
  const candidateArticles: TutorialSource[] = TUTORIALS_CATALOG
    .filter((item) => {
      const isTargetRole =
        item.targetRoles.includes("tenant_admin") ||
        item.targetRoles.includes("admin") ||
        item.targetRoles.includes("barber") ||
        item.targetRoles.includes("reception");
      return isTargetRole;
    })
    .map((item) => ({
      id: item.id,
      title: item.title,
      category: item.badge || "Geral",
      route: item.route,
      description: item.description,
      steps: item.steps,
      notes: item.notes,
      score: 0,
    }));

  // Algoritmo de Ranking Textual Ponderado com Fronteiras e Notas
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
      const variants = getWordVariants(term);
      let termMatched = false;

      // 1. Correspondência em título (peso máximo: 5.0 + bônus de palavra exata)
      const titleHit = variants.some((v) => matchTermInText(titleNorm, v));
      if (titleHit) {
        score += 5.0;
        if (variants.some((v) => new RegExp(`\\b${v}\\b`).test(titleNorm))) {
          score += 2.0;
        }
        termMatched = true;
        hasTitleOrCatMatch = true;
      }

      // 2. Correspondência em categoria/badge (peso: 2.5)
      const catHit = variants.some((v) => matchTermInText(catNorm, v));
      if (catHit) {
        score += 2.5;
        termMatched = true;
        hasTitleOrCatMatch = true;
      }

      // 3. Correspondência na descrição sumária (peso: 2.0)
      const descHit = variants.some((v) => matchTermInText(descNorm, v));
      if (descHit) {
        score += 2.0;
        termMatched = true;
      }

      // 4. Correspondência nas observações oficiais (peso: 1.5)
      const notesHit = variants.some((v) => matchTermInText(notesNorm, v));
      if (notesHit) {
        score += 1.5;
        termMatched = true;
      }

      // 5. Correspondência nos passos de execução (peso: 1.0)
      const stepsHit = variants.some((v) => matchTermInText(stepsNorm, v));
      if (stepsHit) {
        score += 1.0;
        termMatched = true;
      }

      if (termMatched) {
        matchedTermsCount++;
      }
    }

    // Filtro de Incidentalidade Fortalecido (Gate 7):
    // 1. Se a consulta tiver múltiplos termos (>= 3) e apenas 1 termo coincidir superficialmente sem match no título ou categoria, descartar
    if (terms.length >= 3 && matchedTermsCount === 1 && !hasTitleOrCatMatch) {
      score = 0;
    }

    // 2. Se não houver correspondência em título nem em categoria, descartar pontuações marginais (< 4.0)
    if (!hasTitleOrCatMatch && score < 4.0) {
      score = 0;
    }

    // 3. Proteção contra inclusão acidental de Walk-in (Gate 4 e 7):
    // O artigo reception-walkin-queue só pontua se a pergunta mencionar expressamente walkin, fila, espera ou encaixe
    const hasWalkinIntent = terms.some((t) => ["walkin", "fila", "espera", "encaixe"].includes(t));
    if (article.id === "reception-walkin-queue" && !hasWalkinIntent) {
      score = 0;
    }

    // 4. Proteção contra desvio de planos e agendamentos para gestão de equipe (Fase 34):
    // A. Quando a consulta envolve planos e dimensionamento/escolha por número de barbeiros,
    // não poluir com cadastro e gestão de equipe.
    const hasPlansIntent = terms.some((t) => ["plano", "planos", "pro", "elite", "starter", "assinatura"].includes(t));
    const hasSizingOrChoice = terms.some((t) => /\d+/.test(t) || ["escolheria", "escolher", "indicaria", "recomenda", "limite", "limites"].includes(t));
    if (article.id === "owner-team-management" && hasPlansIntent && hasSizingOrChoice) {
      score = 0;
    }

    // B. Quando a consulta envolve reagendar/trocar o barbeiro de um agendamento existente (Passo 1 do reagendamento),
    // não poluir com cadastro/gestão de equipe.
    const hasAppointmentIntent = terms.some((t) => ["reagendar", "reagendamento", "agendamento", "horario"].includes(t));
    const hasChangeBarberIntent = terms.some((t) => ["trocar", "mudar"].includes(t)) && terms.some((t) => ["barbeiro", "profissional"].includes(t));
    if (article.id === "owner-team-management" && hasAppointmentIntent && hasChangeBarberIntent) {
      score = 0;
    }

    article.score = score;
  }

  // Ordenar por relevância decrescente
  const sorted = candidateArticles
    .filter((a) => a.score >= minScoreThreshold)
    .sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    return [];
  }

  // Filtro Dinâmico de Relevância Relativa:
  // Se o primeiro colocado tem pontuação alta (>= 15), descartar artigos com pontuação muito inferior (< 35% do líder)
  // para evitar vazamento de fontes marginais irrelevantes
  const topScore = sorted[0].score;
  const filtered = sorted.filter(
    (a) => a.score >= 5.0 || a.score >= topScore * 0.35
  );

  return filtered.slice(0, maxResults);
}

/**
 * Monta o bloco seguro de contexto para o prompt do modelo (Gate 2 - Fase 32).
 * Formata os tutoriais em fatos e regras operacionais sem induzir reprodução literal de listas numeradas.
 */
export function buildTutorialContextPrompt(sources: TutorialSource[]): string {
  if (sources.length === 0) {
    return "<barbex_facts>\nNenhum artigo ou regra oficial encontrada para os termos da pergunta.\n</barbex_facts>";
  }

  const factsText = sources
    .map((s, index) => {
      const cleanSteps = s.steps.map((st) => `  - ${st}`).join("\n");
      const notesText = s.notes ? `\n  - Regra do sistema: ${s.notes}` : "";
      return `[Fato Operacional ${index + 1}: ${s.title}]
ID: ${s.id}
Tema: ${s.category}
Rota da Tela: ${s.route}
Resumo do Recurso: ${s.description}
Procedimento e Ações Oficiais:
${cleanSteps}${notesText}`;
    })
    .join("\n\n---\n\n");

  return `<barbex_facts>
${factsText}
</barbex_facts>`;
}
