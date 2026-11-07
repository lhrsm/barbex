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
  reagendar: ["reagendo", "reagendamento", "remarcar"],
  reagendamento: ["reagendar", "remarcar"],
  remarcar: ["reagendar", "reagendamento"],

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
  }
): Promise<TutorialSource[]> {
  const maxResults = options?.maxResults ?? 3;
  const minScoreThreshold = options?.minScoreThreshold ?? 2.5;
  const terms = extractQueryTerms(query);

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

    // Filtro de Incidentalidade: se a consulta tiver múltiplos termos (>= 3)
    // e apenas 1 termo coincidir superficialmente sem match no título ou categoria, descartar
    if (terms.length >= 3 && matchedTermsCount === 1 && !hasTitleOrCatMatch) {
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
 * Monta o bloco seguro de contexto para o prompt do modelo.
 * Os dados são delimitados de forma passiva, impedindo injeção de instruções.
 */
export function buildTutorialContextPrompt(sources: TutorialSource[]): string {
  if (sources.length === 0) {
    return "<tutorial_context>\nNenhum tutorial oficial encontrado para os termos da pergunta.\n</tutorial_context>";
  }

  const articlesText = sources
    .map((s, index) => {
      const stepsText = s.steps.map((st, i) => `  ${i + 1}. ${st}`).join("\n");
      const notesText = s.notes ? `\n  Observação: ${s.notes}` : "";
      return `[Tutorial ${index + 1}]
ID: ${s.id}
Título: ${s.title}
Categoria: ${s.category}
Rota da Tela no Barbex: ${s.route}
Resumo: ${s.description}
Passo a Passo Oficial:
${stepsText}${notesText}`;
    })
    .join("\n\n---\n\n");

  return `<tutorial_context>
${articlesText}
</tutorial_context>`;
}
