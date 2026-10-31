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
  "em", "na", "nas", "no", "nos", "o", "os", "para", "por", "que", "se", "um",
  "uma", "uns", "umas", "eu", "ele", "ela", "eles", "elas", "meu", "minha",
  "seu", "sua", "fazer", "posso", "consigo", "onde", "qual", "quais", "barbex"
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

/**
 * Deriva variações morfológicas comuns do Português (singular/plural)
 */
function getWordVariants(word: string): string[] {
  const variants = [word];
  if (word.endsWith("oes")) {
    variants.push(word.replace(/oes$/, "ao"));
  } else if (word.endsWith("ao")) {
    variants.push(word.replace(/ao$/, "oes"));
  }
  if (word.endsWith("s") && word.length > 4) {
    variants.push(word.slice(0, -1));
  } else if (!word.endsWith("s") && word.length >= 4) {
    variants.push(word + "s");
  }
  return variants;
}

function extractQueryTerms(query: string): string[] {
  const normalized = normalizeText(query);
  const words = normalized.split(/\s+/).filter((w) => w.length >= 3);
  const filtered = words.filter((w) => !STOP_WORDS.has(w));
  return Array.from(new Set(filtered));
}

/**
 * Recuperador Textual Canônico da Base de Conhecimento Barbex
 *
 * Busca tutoriais publicados e elegíveis para administradores de barbearia (tenant_admin).
 * Prioriza recuperação direta, leve e sem dependência de embeddings externos ou bancos vetoriais.
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
  const minScoreThreshold = options?.minScoreThreshold ?? 1.5;
  const terms = extractQueryTerms(query);

  if (terms.length === 0) {
    return [];
  }

  // Coleção candidata: catálogo de tutoriais canônicos para administradores
  // Filtra tutoriais elegíveis para o perfil tenant_admin / admin
  const candidateArticles: TutorialSource[] = TUTORIALS_CATALOG
    .filter((item) => {
      const isTargetRole =
        item.targetRoles.includes("tenant_admin") ||
        item.targetRoles.includes("admin") ||
        item.targetRoles.includes("barber") || // barbeiros operam sob a gestão do admin
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

  // Algoritmo de Ranking Textual Ponderado por Termos
  for (const article of candidateArticles) {
    let score = 0;
    let matchedTermsCount = 0;
    let hasTitleOrCatMatch = false;

    const titleNorm = normalizeText(article.title);
    const catNorm = normalizeText(article.category);
    const descNorm = normalizeText(article.description);
    const stepsNorm = normalizeText(article.steps.join(" "));

    for (const term of terms) {
      const variants = getWordVariants(term);
      let termMatched = false;

      // 1. Correspondência em título (peso máximo: 4.0 + bônus de palavra exata)
      const titleHit = variants.some((v) => titleNorm.includes(v));
      if (titleHit) {
        score += 4.0;
        if (variants.some((v) => new RegExp(`\\b${v}\\b`).test(titleNorm))) {
          score += 2.0;
        }
        termMatched = true;
        hasTitleOrCatMatch = true;
      }

      // 2. Correspondência em categoria/módulo (peso: 2.5)
      const catHit = variants.some((v) => catNorm.includes(v));
      if (catHit) {
        score += 2.5;
        termMatched = true;
        hasTitleOrCatMatch = true;
      }

      // 3. Correspondência na descrição sumária (peso: 2.0)
      const descHit = variants.some((v) => descNorm.includes(v));
      if (descHit) {
        score += 2.0;
        termMatched = true;
      }

      // 4. Correspondência nos passos de execução (peso: 1.0)
      const stepsHit = variants.some((v) => stepsNorm.includes(v));
      if (stepsHit) {
        score += 1.0;
        termMatched = true;
      }

      if (termMatched) {
        matchedTermsCount++;
      }
    }

    // Filtro de Incidentalidade: se a consulta tiver múltiplos termos (>= 3)
    // e apenas 1 termo coincidir superficialmente na descrição/passos sem correspondência
    // no título ou na categoria, descartar para evitar falsos positivos
    if (terms.length >= 3 && matchedTermsCount === 1 && !hasTitleOrCatMatch) {
      score = 0;
    }

    article.score = score;
  }

  // Ordenar por relevância decrescente
  const filtered = candidateArticles
    .filter((a) => a.score >= minScoreThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return filtered;
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

