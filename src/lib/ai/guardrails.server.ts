/**
 * BARBEX — GUARDRAILS DE SEGURANÇA E RATE LIMITING PARA AGENTE DE IA
 *
 * Garante que:
 * 1. O agente permaneça estritamente no perfil consultivo sem risco de Prompt Injection.
 * 2. O consumo da cota gratuita seja protegido contra abuso (Rate Limiting).
 * 3. O comprimento de entrada seja limitado a 500 caracteres.
 * 4. A política FREE-ONLY / FAIL-CLOSED seja aplicada sem fallbacks pagos.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
}

export interface SanitizedQuery {
  isValid: boolean;
  cleanText: string;
  rejectionReason?: string;
  isHighRiskInjection?: boolean;
}

// In-Memory Rate Limiter (janelas deslizantes por tenant e por usuário)
interface RateRecord {
  timestamps: number[];
}

const userMinuteWindowMap = new Map<string, RateRecord>();
const tenantHourWindowMap = new Map<string, RateRecord>();
let globalMinuteTimestamps: number[] = [];
let globalDayTimestamps: number[] = [];

const MAX_REQUESTS_PER_MINUTE_USER = 5;
const MAX_REQUESTS_PER_HOUR_TENANT = 30;
const MAX_REQUESTS_PER_MINUTE_GLOBAL = 20; // 33% de margem abaixo do limite Groq Free Tier (30 RPM)
const MAX_REQUESTS_PER_DAY_GLOBAL = 800; // 20% de margem abaixo do limite Groq Free Tier (1000 RPD)

/**
 * Limpa registros expirados para evitar acúmulo de memória
 */
function cleanupOldRecords() {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneMinuteAgo = now - 60 * 1000;

  for (const [key, record] of userMinuteWindowMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => t > oneMinuteAgo);
    if (record.timestamps.length === 0) userMinuteWindowMap.delete(key);
  }

  for (const [key, record] of tenantHourWindowMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => t > oneHourAgo);
    if (record.timestamps.length === 0) tenantHourWindowMap.delete(key);
  }

  globalMinuteTimestamps = globalMinuteTimestamps.filter((t) => t > oneMinuteAgo);
  globalDayTimestamps = globalDayTimestamps.filter((t) => t > oneDayAgo);
}

/**
 * Validador de Rate Limiting Multi-Nível (Usuário, Tenant e Global Groq Free Tier)
 */
export function checkRateLimit(userId: string, tenantId: string): RateLimitResult {
  cleanupOldRecords();
  const now = Date.now();

  // 1. Limite Global por Minuto (Proteção da Cota de 30 RPM da Groq)
  if (globalMinuteTimestamps.length >= MAX_REQUESTS_PER_MINUTE_GLOBAL) {
    const oldest = globalMinuteTimestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 60 * 1000 - now) / 1000));
    return {
      allowed: false,
      retryAfterSeconds,
      reason: `A capacidade global do assistente atingiu o limite temporário (${MAX_REQUESTS_PER_MINUTE_GLOBAL} req/min). Aguarde ${retryAfterSeconds} segundos.`,
    };
  }

  // 2. Limite Global por Dia (Proteção da Cota de 1.000 RPD da Groq)
  if (globalDayTimestamps.length >= MAX_REQUESTS_PER_DAY_GLOBAL) {
    const oldest = globalDayTimestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 24 * 60 * 60 * 1000 - now) / 1000));
    return {
      allowed: false,
      retryAfterSeconds,
      reason: `A cota diária global do assistente atingiu o teto gratuito de segurança (${MAX_REQUESTS_PER_DAY_GLOBAL} req/dia). Tente novamente amanhã.`,
    };
  }

  // 3. Limite por Usuário (5 req/minuto)
  const userRecord = userMinuteWindowMap.get(userId) || { timestamps: [] };
  const userRecent = userRecord.timestamps.filter((t) => t > now - 60 * 1000);

  if (userRecent.length >= MAX_REQUESTS_PER_MINUTE_USER) {
    const oldest = userRecent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 60 * 1000 - now) / 1000));
    return {
      allowed: false,
      retryAfterSeconds,
      reason: `Limite de consultas por minuto atingido (${MAX_REQUESTS_PER_MINUTE_USER} consultas/min). Aguarde ${retryAfterSeconds} segundos.`,
    };
  }

  // 4. Limite por Barbearia/Tenant (30 req/hora)
  const tenantRecord = tenantHourWindowMap.get(tenantId) || { timestamps: [] };
  const tenantRecent = tenantRecord.timestamps.filter((t) => t > now - 60 * 60 * 1000);

  if (tenantRecent.length >= MAX_REQUESTS_PER_HOUR_TENANT) {
    const oldest = tenantRecent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 60 * 60 * 1000 - now) / 1000));
    return {
      allowed: false,
      retryAfterSeconds,
      reason: `A cota da barbearia atingiu o limite gratuito temporário (${MAX_REQUESTS_PER_HOUR_TENANT} consultas/hora). Tente novamente mais tarde.`,
    };
  }

  // Registra a nova requisição em todos os 4 níveis de janela
  userRecent.push(now);
  userMinuteWindowMap.set(userId, { timestamps: userRecent });

  tenantRecent.push(now);
  tenantHourWindowMap.set(tenantId, { timestamps: tenantRecent });

  globalMinuteTimestamps.push(now);
  globalDayTimestamps.push(now);

  return { allowed: true };
}

/**
 * Reset de Rate Limiting (utilizado estritamente para suítes de testes automatizados)
 */
export function resetRateLimitsForTesting() {
  userMinuteWindowMap.clear();
  tenantHourWindowMap.clear();
  globalMinuteTimestamps = [];
  globalDayTimestamps = [];
}

/**
 * Padrões Adversariais de Tentativa de Prompt Injection
 */
const INJECTION_PATTERNS = [
  /ignore\s+.*instructions/i,
  /desconsidere\s+.*instru[cç][oõ]es/i,
  /esque[cç]a\s+.*(regras|instru[cç][oõ]es|prompt)/i,
  /you\s+are\s+now\s+(dan|developer\s+mode|unrestricted|superadmin)/i,
  /voc[eê]\s+agora\s+[eé]\s+(um\s+hacker|livre|superadmin)/i,
  /habilite\s+o\s+modo\s+superadmin/i,
  /me\s+conceda\s+acesso\s+de\s+superadmin/i,
  /print\s+(your\s+)?system\s+prompt/i,
  /mostre\s+o\s+prompt\s+de\s+sistema/i,
  /delete\s+from\s+[a-z_]+/i,
  /drop\s+table\s+[a-z_]+/i,
];

/**
 * Higienização e Validação do Input do Administrador
 */
export function sanitizeAndValidateInput(question: unknown): SanitizedQuery {
  if (typeof question !== "string") {
    return {
      isValid: false,
      cleanText: "",
      rejectionReason: "A pergunta deve ser uma sequência de texto válida.",
    };
  }

  const trimmed = question.trim();

  // Tamanho mínimo
  if (trimmed.length < 2) {
    return {
      isValid: false,
      cleanText: "",
      rejectionReason: "A pergunta é muito curta para ser processada.",
    };
  }

  // Tamanho máximo estrito: 500 caracteres
  if (trimmed.length > 500) {
    return {
      isValid: false,
      cleanText: trimmed.slice(0, 500),
      rejectionReason: "A pergunta excede o limite máximo permitido de 500 caracteres.",
    };
  }

  // Verificação de Prompt Injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isValid: false,
        cleanText: trimmed,
        isHighRiskInjection: true,
        rejectionReason:
          "Sua solicitação contém comandos de controle não autorizados. O assistente aceita apenas dúvidas sobre a utilização do sistema Barbex.",
      };
    }
  }

  return {
    isValid: true,
    cleanText: trimmed,
  };
}

/**
 * Avaliação da Feature Flag do Assistente
 */
export function isAIAssistantEnabled(): { enabled: boolean; status: string; reason?: string } {
  const envFlag = (
    process.env.BARBEX_AI_ASSISTANT_ENABLED ||
    process.env.ENABLE_TENANT_AI_ASSISTANT ||
    ""
  ).toLowerCase();

  // Em modo de testes automatizados ou desenvolvimento local sem bloqueio explícito
  const isDevOrTest = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

  if (envFlag === "false" || envFlag === "disabled" || envFlag === "off") {
    return {
      enabled: false,
      status: "disabled",
      reason: "O Assistente de IA está temporariamente desativado pela administração da plataforma.",
    };
  }

  if (envFlag === "active" || envFlag === "true" || envFlag === "local_mvp") {
    return { enabled: true, status: "active" };
  }

  // Comportamento default seguro (Fail-Closed em produção; ativo para MVP demonstrável em dev/test)
  if (isDevOrTest) {
    return { enabled: true, status: "local_mvp" };
  }

  return {
    enabled: false,
    status: "disabled",
    reason: "O Assistente de IA Institucional aguarda ativação de produção.",
  };
}

