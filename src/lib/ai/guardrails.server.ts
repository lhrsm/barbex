/**
 * BARBEX — GUARDRAILS DE SEGURANÇA E RATE LIMITING PARA AGENTE DE IA
 *
 * Garante que:
 * 1. O agente permaneça estritamente no perfil consultivo sem risco de Prompt Injection.
 * 2. O consumo da cota gratuita seja protegido contra abuso (Rate Limiting).
 * 3. O comprimento de entrada seja limitado a 500 caracteres.
 * 4. A política FREE-ONLY / FAIL-CLOSED seja aplicada sem fallbacks pagos.
 */

import { supabaseAdmin } from "../../integrations/supabase/client.server";

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
 * Avança janela de minuto mantendo janelas de hora e dia (utilizado para testes)
 */
export function advanceMinuteForTesting() {
  globalMinuteTimestamps = [];
  userMinuteWindowMap.clear();
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CanaryAllowlistParseResult {
  valid: boolean;
  id?: string;
  errorCode?:
    | "ABSENT"
    | "EMPTY"
    | "MALFORMED"
    | "WILDCARD_PROHIBITED"
    | "MULTI_TARGET_PROHIBITED";
  errorMessage?: string;
}

/**
 * Validador estrito de lista de controle canário (R2E.26E.22N.2)
 * Garante que apenas 1 UUID válido seja configurado, rejeitando listas múltiplas,
 * vazias, malformadas ou com curingas (* / all).
 */
export function parseStrictSingleCanaryAllowlist(
  envValue: string | undefined | null,
  variableName: string
): CanaryAllowlistParseResult {
  if (envValue === undefined || envValue === null) {
    return {
      valid: false,
      errorCode: "ABSENT",
      errorMessage: `Variável ${variableName} ausente ou não configurada (fail-closed).`,
    };
  }

  const trimmed = envValue.trim();
  if (trimmed === "") {
    return {
      valid: false,
      errorCode: "EMPTY",
      errorMessage: `Variável ${variableName} vazia (fail-closed).`,
    };
  }

  // Verificação contra curingas (* ou all)
  if (
    trimmed === "*" ||
    trimmed.toLowerCase() === "all" ||
    trimmed.includes("*")
  ) {
    return {
      valid: false,
      errorCode: "WILDCARD_PROHIBITED",
      errorMessage: `Curingas e permissões universais ('${trimmed}') são terminantemente proibidos em ${variableName}.`,
    };
  }

  // Divisão por vírgula para detectar múltiplos alvos
  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return {
      valid: false,
      errorCode: "MULTI_TARGET_PROHIBITED",
      errorMessage: `Múltiplos identificadores configurados em ${variableName}. A fase canário restringe-se estritamente a 1 alvo homologado.`,
    };
  }

  const targetId = parts[0];
  if (!UUID_REGEX.test(targetId)) {
    return {
      valid: false,
      errorCode: "MALFORMED",
      errorMessage: `Identificador em ${variableName} inválido ou malformado. Exige-se formato UUID canônico.`,
    };
  }

  return {
    valid: true,
    id: targetId.toLowerCase(),
  };
}

export interface CanaryAccessEvaluation {
  allowed: boolean;
  status:
    | "active"
    | "disabled"
    | "canary_tenant_blocked"
    | "canary_user_blocked"
    | "canary_config_invalid";
  reasonCode?: string;
  reason?: string;
}

/**
 * Avaliação mandante de isolamento canário por Tenant e Usuário (Gate 1)
 */
export function evaluateCanaryAccess(
  tenantId?: string | null,
  userId?: string | null
): CanaryAccessEvaluation {
  // 1. Verificação da Flag Global (Kill Switch)
  const envFlag = (
    process.env.BARBEX_AI_ASSISTANT_ENABLED ||
    process.env.ENABLE_TENANT_AI_ASSISTANT ||
    ""
  )
    .toLowerCase()
    .trim();

  // Fail-Closed: Qualquer valor diferente de 'true' ou 'active' desativa
  if (envFlag !== "true" && envFlag !== "active") {
    return {
      allowed: false,
      status: "disabled",
      reasonCode: "GLOBAL_KILLSWITCH_DISABLED",
      reason:
        "O Assistente de IA está temporariamente desativado pela administração da plataforma.",
    };
  }

  // 2. Parser da allowlist de Tenants (Exatamente 1 UUID)
  const tenantParsed = parseStrictSingleCanaryAllowlist(
    process.env.BARBEX_AI_CANARY_TENANT_IDS,
    "BARBEX_AI_CANARY_TENANT_IDS"
  );
  if (!tenantParsed.valid || !tenantParsed.id) {
    return {
      allowed: false,
      status: "canary_config_invalid",
      reasonCode: `CANARY_TENANT_CONFIG_${tenantParsed.errorCode}`,
      reason:
        tenantParsed.errorMessage ||
        "Configuração canário de barbearia inválida.",
    };
  }

  // 3. Parser da allowlist de Usuários (Exatamente 1 UUID)
  const userParsed = parseStrictSingleCanaryAllowlist(
    process.env.BARBEX_AI_CANARY_USER_IDS,
    "BARBEX_AI_CANARY_USER_IDS"
  );
  if (!userParsed.valid || !userParsed.id) {
    return {
      allowed: false,
      status: "canary_config_invalid",
      reasonCode: `CANARY_USER_CONFIG_${userParsed.errorCode}`,
      reason:
        userParsed.errorMessage || "Configuração canário de usuário inválida.",
    };
  }

  // 4. Validação do Tenant Autenticado
  if (
    !tenantId ||
    typeof tenantId !== "string" ||
    !UUID_REGEX.test(tenantId.trim())
  ) {
    return {
      allowed: false,
      status: "canary_tenant_blocked",
      reasonCode: "CANARY_TENANT_INVALID",
      reason: "Identificador de barbearia inválido ou malformado.",
    };
  }

  if (tenantId.trim().toLowerCase() !== tenantParsed.id) {
    return {
      allowed: false,
      status: "canary_tenant_blocked",
      reasonCode: "CANARY_TENANT_NOT_AUTHORIZED",
      reason:
        "O Assistente de IA Institucional encontra-se em fase de homologação canário restrita.",
    };
  }

  // 5. Validação do Usuário Autenticado
  if (
    !userId ||
    typeof userId !== "string" ||
    !UUID_REGEX.test(userId.trim())
  ) {
    return {
      allowed: false,
      status: "canary_user_blocked",
      reasonCode: "CANARY_USER_INVALID",
      reason: "Identificador de usuário inválido ou malformado.",
    };
  }

  if (userId.trim().toLowerCase() !== userParsed.id) {
    return {
      allowed: false,
      status: "canary_user_blocked",
      reasonCode: "CANARY_USER_NOT_AUTHORIZED",
      reason:
        "Acesso restrito ao administrador homologado para a fase canário.",
    };
  }

  // Acesso Canário 100% Homologado e Autorizado
  return {
    allowed: true,
    status: "active",
  };
}

/**
 * Avaliação da Feature Flag do Assistente com Suporte a Isolamento Canário
 */
export function isAIAssistantEnabled(
  tenantId?: string,
  userId?: string
): { enabled: boolean; status: string; reason?: string; reasonCode?: string } {
  // Se tenantId ou userId forem passados, avalia a governança canário completa
  if (tenantId !== undefined || userId !== undefined) {
    const canaryEval = evaluateCanaryAccess(tenantId, userId);
    return {
      enabled: canaryEval.allowed,
      status: canaryEval.status,
      reason: canaryEval.reason,
      reasonCode: canaryEval.reasonCode,
    };
  }

  // Avaliação genérica do kill switch global (quando chamado sem contexto de usuário)
  const envFlag = (
    process.env.BARBEX_AI_ASSISTANT_ENABLED ||
    process.env.ENABLE_TENANT_AI_ASSISTANT ||
    ""
  )
    .toLowerCase()
    .trim();

  if (envFlag === "false" || envFlag === "disabled" || envFlag === "off") {
    return {
      enabled: false,
      status: "disabled",
      reasonCode: "GLOBAL_KILLSWITCH_DISABLED",
      reason:
        "O Assistente de IA está temporariamente desativado pela administração da plataforma.",
    };
  }

  if (envFlag === "active" || envFlag === "true") {
    // Se a flag global estiver ativa, mas allowlists canário forem exigidas
    const tenantParsed = parseStrictSingleCanaryAllowlist(
      process.env.BARBEX_AI_CANARY_TENANT_IDS,
      "BARBEX_AI_CANARY_TENANT_IDS"
    );
    const userParsed = parseStrictSingleCanaryAllowlist(
      process.env.BARBEX_AI_CANARY_USER_IDS,
      "BARBEX_AI_CANARY_USER_IDS"
    );

    if (tenantParsed.valid && userParsed.valid) {
      return {
        enabled: false,
        status: "canary_requires_identity",
        reasonCode: "CANARY_IDENTITY_REQUIRED",
        reason:
          "O Assistente requer validação de identidade da barbearia canário.",
      };
    }

    return {
      enabled: false,
      status: "disabled",
      reasonCode: "CANARY_CONFIG_MISSING",
      reason: "Configuração canário não estabelecida.",
    };
  }

  return {
    enabled: false,
    status: "disabled",
    reasonCode: "GLOBAL_KILLSWITCH_DISABLED",
    reason: "O Assistente de IA Institucional aguarda ativação de produção.",
  };
}

export interface DistributedRateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
  source: "rpc" | "memory_fallback";
  details?: Record<string, unknown>;
}

/**
 * Validador Distribuído de Rate Limiting PostgreSQL (RPC) (Gate 2)
 *
 * Utiliza o cliente server-side autorizado (service_role) para invocar
 * atomicamente public.check_and_increment_ai_rate_limit no PostgreSQL.
 * Bloqueia estritamente (Fail-Closed) em caso de erro, NULL ou formato inesperado.
 */
export async function checkDistributedRateLimit(
  tenantId: string,
  userId: string,
  supabaseClientOverride?: any
): Promise<DistributedRateLimitResult> {
  try {
    let client = supabaseClientOverride;
    if (!client) {
      try {
        client = supabaseAdmin;
      } catch {
        client = null;
      }
    }

    if (client && typeof client.rpc === "function") {
      const { data, error } = await client.rpc(
        "check_and_increment_ai_rate_limit",
        {
          p_tenant_id: tenantId,
          p_user_id: userId,
          p_max_per_min: 5,
          p_max_per_hour: 30,
          p_estimated_tokens: 1800,
          p_max_global_per_min: 20,
          p_max_global_per_day: 800,
        }
      );

      if (error) {
        return {
          allowed: false,
          reason: `RATE_LIMIT_RPC_ERROR: ${error.message || "Erro de execução na RPC"}`,
          source: "rpc",
        };
      }

      if (!data || typeof data !== "object") {
        return {
          allowed: false,
          reason: "RATE_LIMIT_RPC_INVALID_RESPONSE",
          source: "rpc",
        };
      }

      if (data.allowed === false) {
        return {
          allowed: false,
          retryAfterSeconds: data.retry_after_seconds || 60,
          reason: data.reason || "RATE_LIMIT_EXCEEDED",
          source: "rpc",
          details: data,
        };
      }

      if (data.allowed === true) {
        return {
          allowed: true,
          source: "rpc",
          details: data,
        };
      }

      // Resposta inesperada: Fail-Closed
      return {
        allowed: false,
        reason: "RATE_LIMIT_RPC_UNEXPECTED_FORMAT",
        source: "rpc",
      };
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === "test" && !supabaseClientOverride) {
      const memResult = checkRateLimit(userId, tenantId);
      return {
        allowed: memResult.allowed,
        retryAfterSeconds: memResult.retryAfterSeconds,
        reason: memResult.reason,
        source: "memory_fallback",
      };
    }

    return {
      allowed: false,
      reason: `RATE_LIMIT_RPC_EXCEPTION: ${err?.message || String(err)}`,
      source: "rpc",
    };
  }

  // Se nenhum cliente RPC estiver disponível:
  if (process.env.NODE_ENV === "test") {
    const memResult = checkRateLimit(userId, tenantId);
    return {
      allowed: memResult.allowed,
      retryAfterSeconds: memResult.retryAfterSeconds,
      reason: memResult.reason,
      source: "memory_fallback",
    };
  }

  return {
    allowed: false,
    reason: "RATE_LIMIT_CLIENT_UNAVAILABLE",
    source: "rpc",
  };
}

