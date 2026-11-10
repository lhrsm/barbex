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
const tenantDayWindowMap = new Map<string, RateRecord>();
let globalMinuteTimestamps: number[] = [];
let globalDayTimestamps: number[] = [];

const MAX_REQUESTS_PER_MINUTE_USER = 5;
const MAX_REQUESTS_PER_HOUR_TENANT = 30;
const MAX_REQUESTS_PER_DAY_TENANT = 20; // Limite diário por tenant para proteção do free tier Groq
const MAX_REQUESTS_PER_MINUTE_GLOBAL = 20; // 33% de margem abaixo do limite Groq Free Tier (30 RPM)
const MAX_REQUESTS_PER_DAY_GLOBAL = 800; // 20% de margem abaixo do limite Groq Free Tier (1000 RPD)

// Concurrency Semaphore (Proteção contra saturação do limite de 8.000 TPM da Groq)
// Máximo de 4 requisições simultâneas reservando ~1.800 tokens cada = 7.200 TPM (< 8.000 TPM)
const MAX_CONCURRENT_AI_REQUESTS = 4;
let activeAIRequestsCount = 0;

export function acquireAIConcurrencySlot(): { acquired: boolean; retryAfterSeconds?: number; reason?: string } {
  if (activeAIRequestsCount >= MAX_CONCURRENT_AI_REQUESTS) {
    return {
      acquired: false,
      retryAfterSeconds: 5,
      reason: `O assistente atingiu a capacidade concorrente máxima (${MAX_CONCURRENT_AI_REQUESTS} consultas simultâneas). Aguarde alguns instantes e tente novamente.`,
    };
  }
  activeAIRequestsCount++;
  return { acquired: true };
}

export function releaseAIConcurrencySlot(): void {
  if (activeAIRequestsCount > 0) {
    activeAIRequestsCount--;
  }
}

export function getActiveAIConcurrencyCount(): number {
  return activeAIRequestsCount;
}

export function resetAIConcurrencyForTesting(): void {
  activeAIRequestsCount = 0;
}

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

  for (const [key, record] of tenantDayWindowMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => t > oneDayAgo);
    if (record.timestamps.length === 0) tenantDayWindowMap.delete(key);
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

  // 5. Limite Diário por Barbearia/Tenant (20 req/dia) - Proteção da cota multi-tenant (Fase 37B)
  const tenantDayRecord = tenantDayWindowMap.get(tenantId) || { timestamps: [] };
  const tenantDayRecent = tenantDayRecord.timestamps.filter((t) => t > now - 24 * 60 * 60 * 1000);

  if (tenantDayRecent.length >= MAX_REQUESTS_PER_DAY_TENANT) {
    const oldest = tenantDayRecent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 24 * 60 * 60 * 1000 - now) / 1000));
    return {
      allowed: false,
      retryAfterSeconds,
      reason: `A cota diária da barbearia atingiu o limite de segurança (${MAX_REQUESTS_PER_DAY_TENANT} consultas/dia). Tente novamente amanhã.`,
    };
  }

  // Registra a nova requisição em todos os níveis de janela
  userRecent.push(now);
  userMinuteWindowMap.set(userId, { timestamps: userRecent });

  tenantRecent.push(now);
  tenantHourWindowMap.set(tenantId, { timestamps: tenantRecent });

  tenantDayRecent.push(now);
  tenantDayWindowMap.set(tenantId, { timestamps: tenantDayRecent });

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
  tenantDayWindowMap.clear();
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

export interface TenantAIAccessEvaluation {
  allowed: boolean;
  status:
    | "active"
    | "disabled"
    | "canary_tenant_blocked"
    | "canary_user_blocked"
    | "canary_config_invalid"
    | "tenant_not_authorized"
    | "user_not_authorized"
    | "invalid_identity";
  reasonCode?: string;
  reason?: string;
}

/**
 * Avaliação Centralizada de Acesso Multi-Tenant ao Assistente de IA (Fase R2E.26E.22N.14)
 *
 * 1. Kill Switch Global: BARBEX_AI_ASSISTANT_ENABLED = 'true' ou 'active'
 * 2. Suporte retrocompatível ao modo canário (se BARBEX_AI_CANARY_MODE === 'true' ou allowlist única configurada sem general release)
 * 3. Modo Multi-Tenant Geral:
 *    - Validação de formato UUID de tenantId e userId
 *    - Filtro opcional por allowlist multi-tenant em runtime (BARBEX_AI_ALLOWED_TENANT_IDS)
 *    - Filtro opcional por allowlist multi-usuário em runtime (BARBEX_AI_ALLOWED_USER_IDS)
 *    - Se allowlist não estiver configurada, permite qualquer barbearia ativa com administrador comprovado
 */
export function evaluateTenantAIAccess(
  tenantId?: string | null,
  userId?: string | null
): TenantAIAccessEvaluation {
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

  // 2. Se modo canário estrito estiver explicitamente ativado via BARBEX_AI_CANARY_MODE='true'
  // OU se allowlists canário de alvo único estiverem configuradas E BARBEX_AI_GENERAL_RELEASE !== 'true' E BARBEX_AI_GENERAL_AVAILABILITY !== 'true'
  const isCanaryMode =
    (process.env.BARBEX_AI_CANARY_MODE === "true" ||
      Boolean(process.env.BARBEX_AI_CANARY_TENANT_IDS)) &&
    process.env.BARBEX_AI_GENERAL_RELEASE !== "true" &&
    process.env.BARBEX_AI_GENERAL_AVAILABILITY !== "true";

  if (isCanaryMode) {
    return evaluateCanaryAccess(tenantId, userId);
  }

  // 3. Validação dos Identificadores (UUID)
  if (!tenantId || typeof tenantId !== "string" || !UUID_REGEX.test(tenantId.trim())) {
    return {
      allowed: false,
      status: "invalid_identity",
      reasonCode: "INVALID_TENANT_UUID",
      reason: "Identificador de barbearia ausente ou malformado.",
    };
  }

  if (!userId || typeof userId !== "string" || !UUID_REGEX.test(userId.trim())) {
    return {
      allowed: false,
      status: "invalid_identity",
      reasonCode: "INVALID_USER_UUID",
      reason: "Identificador de usuário ausente ou malformado.",
    };
  }

  const cleanTenantId = tenantId.trim().toLowerCase();
  const cleanUserId = userId.trim().toLowerCase();

  // 3.1. Verificação de Bloqueio Individual de Barbearia (Kill Switch Granular - Fase 37B)
  const blockedTenantsRaw = process.env.BARBEX_AI_BLOCKED_TENANT_IDS?.trim();
  if (blockedTenantsRaw) {
    const blockedTenants = blockedTenantsRaw
      .split(",")
      .map((t) => t.trim().toLowerCase());
    if (blockedTenants.includes(cleanTenantId)) {
      return {
        allowed: false,
        status: "tenant_blocked",
        reasonCode: "TENANT_BLOCKED",
        reason: "O acesso ao Assistente Institucional está temporariamente suspenso para este estabelecimento.",
      };
    }
  }

  // 4. Allowlist Opcional de Barbearias (BARBEX_AI_ALLOWED_TENANT_IDS)
  const allowedTenantsRaw = process.env.BARBEX_AI_ALLOWED_TENANT_IDS?.trim();
  if (allowedTenantsRaw && allowedTenantsRaw !== "*") {
    const allowedTenants = allowedTenantsRaw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => UUID_REGEX.test(t));

    if (allowedTenants.length > 0 && !allowedTenants.includes(cleanTenantId)) {
      return {
        allowed: false,
        status: "tenant_not_authorized",
        reasonCode: "TENANT_NOT_IN_ALLOWLIST",
        reason: "Esta barbearia não está contemplada no rol atual de ativação do assistente.",
      };
    }
  }

  // 5. Allowlist Opcional de Usuários (BARBEX_AI_ALLOWED_USER_IDS)
  const allowedUsersRaw = process.env.BARBEX_AI_ALLOWED_USER_IDS?.trim();
  if (allowedUsersRaw && allowedUsersRaw !== "*") {
    const allowedUsers = allowedUsersRaw
      .split(",")
      .map((u) => u.trim().toLowerCase())
      .filter((u) => UUID_REGEX.test(u));

    if (allowedUsers.length > 0 && !allowedUsers.includes(cleanUserId)) {
      return {
        allowed: false,
        status: "user_not_authorized",
        reasonCode: "USER_NOT_IN_ALLOWLIST",
        reason: "Este usuário não está contemplado no rol atual de ativação do assistente.",
      };
    }
  }

  // Acesso Multi-tenant Ativo
  return {
    allowed: true,
    status: "active",
  };
}

/**
 * Avaliação da Feature Flag do Assistente com Suporte a Isolamento Multi-Tenant e Canário
 */
export function isAIAssistantEnabled(
  tenantId?: string,
  userId?: string
): { enabled: boolean; status: string; reason?: string; reasonCode?: string } {
  // Se tenantId ou userId forem passados, avalia a governança de acesso (canário ou multi-tenant)
  if (tenantId !== undefined || userId !== undefined) {
    const accessEval = evaluateTenantAIAccess(tenantId, userId);
    return {
      enabled: accessEval.allowed,
      status: accessEval.status,
      reason: accessEval.reason,
      reasonCode: accessEval.reasonCode,
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

  if (envFlag === "false" || envFlag === "disabled" || envFlag === "off" || envFlag === "") {
    return {
      enabled: false,
      status: "disabled",
      reasonCode: "GLOBAL_KILLSWITCH_DISABLED",
      reason:
        "O Assistente de IA está temporariamente desativado pela administração da plataforma.",
    };
  }

  if (envFlag === "active" || envFlag === "true") {
    const isCanaryMode =
      (process.env.BARBEX_AI_CANARY_MODE === "true" ||
        Boolean(process.env.BARBEX_AI_CANARY_TENANT_IDS)) &&
      process.env.BARBEX_AI_GENERAL_RELEASE !== "true" &&
      process.env.BARBEX_AI_GENERAL_AVAILABILITY !== "true";

    if (isCanaryMode) {
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

    // Modo Geral Multi-Tenant Ativo
    return {
      enabled: true,
      status: "active",
    };
  }

  return {
    enabled: false,
    status: "disabled",
    reasonCode: "GLOBAL_KILLSWITCH_DISABLED",
    reason: "O Assistente de IA Institucional aguarda ativação de produção.",
  };
}

export interface DynamicModuleAvailabilityResult {
  available: boolean;
  reasonCode?:
    | "DYNAMIC_KILLSWITCH_ACTIVE"
    | "DYNAMIC_KILLSWITCH_DISABLED"
    | "DYNAMIC_KILLSWITCH_TIMEOUT"
    | "DYNAMIC_KILLSWITCH_ERROR"
    | "DYNAMIC_KILLSWITCH_INVALID_RESPONSE"
    | "DYNAMIC_KILLSWITCH_CLIENT_UNAVAILABLE";
  reason?: string;
  source: "rpc" | "table_fallback" | "test_mock";
}

/**
 * Validador Dinâmico de Disponibilidade Global do Módulo de IA (Kill Switch Dinâmico Dual-Key)
 * Fase: R2E.26E.22N.13B
 *
 * Consulta em tempo real (sem cache entre requisições) a RPC public.is_module_globally_available('ai')
 * ou a tabela public.platform_module_availability no Supabase.
 *
 * Propriedades de Segurança:
 * 1. Timeout estrito de 3.000 ms (Fail-Closed).
 * 2. Em caso de timeout, erro de rede, retorno NULL ou formato inesperado: BLOQUEIA (Fail-Closed).
 * 3. Se o módulo estiver is_available = false: BLOQUEIA com DYNAMIC_KILLSWITCH_DISABLED.
 * 4. Não satura nem modifica a tabela de rate limits.
 * 5. Não loga segredos ou dados pessoais.
 */
export async function checkDynamicModuleAvailability(
  supabaseClientOverride?: any
): Promise<DynamicModuleAvailabilityResult> {
  // Em ambiente de teste automatizado, verificar flag de override de teste se injetada
  if (process.env.BARBEX_TEST_DYNAMIC_KILLSWITCH_STATE !== undefined) {
    const testState = process.env.BARBEX_TEST_DYNAMIC_KILLSWITCH_STATE;
    if (testState === "false" || testState === "disabled") {
      return {
        available: false,
        reasonCode: "DYNAMIC_KILLSWITCH_DISABLED",
        reason: "O Assistente de IA está temporariamente suspenso pela administração da plataforma.",
        source: "test_mock",
      };
    }
    if (testState === "timeout") {
      return {
        available: false,
        reasonCode: "DYNAMIC_KILLSWITCH_TIMEOUT",
        reason: "O serviço de validação do assistente excedeu o tempo limite. Por segurança, tente novamente em instantes.",
        source: "test_mock",
      };
    }
    if (testState === "error") {
      return {
        available: false,
        reasonCode: "DYNAMIC_KILLSWITCH_ERROR",
        reason: "Erro ao consultar a governança do assistente. Por segurança, tente novamente em instantes.",
        source: "test_mock",
      };
    }
    if (testState === "true" || testState === "active") {
      return {
        available: true,
        reasonCode: "DYNAMIC_KILLSWITCH_ACTIVE",
        source: "test_mock",
      };
    }
  }

  let client = supabaseClientOverride;
  if (!client) {
    try {
      client = supabaseAdmin;
    } catch {
      client = null;
    }
  }

  if (!client) {
    return {
      available: false,
      reasonCode: "DYNAMIC_KILLSWITCH_CLIENT_UNAVAILABLE",
      reason: "Serviço de validação de segurança indisponível no servidor.",
      source: "rpc",
    };
  }

  try {
    // Timeout estrito de 3000ms com Promise.race
    let timerId: any;
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) => {
      timerId = setTimeout(() => reject(new Error("DYNAMIC_KILLSWITCH_TIMEOUT")), 3000);
    });

    let queryPromise: Promise<{ data: any; error: any }>;

    if (typeof client.rpc === "function") {
      queryPromise = client.rpc("is_module_globally_available", {
        p_module_key: "ai",
      });
    } else if (typeof client.from === "function") {
      queryPromise = client
        .from("platform_module_availability")
        .select("is_available")
        .eq("module_key", "ai")
        .maybeSingle();
    } else {
      clearTimeout(timerId);
      return {
        available: false,
        reasonCode: "DYNAMIC_KILLSWITCH_CLIENT_UNAVAILABLE",
        reason: "Cliente Supabase inválido para verificação de governança.",
        source: "rpc",
      };
    }

    const result: any = await Promise.race([queryPromise, timeoutPromise]);
    clearTimeout(timerId);

    if (result.error) {
      return {
        available: false,
        reasonCode: "DYNAMIC_KILLSWITCH_ERROR",
        reason: "Instabilidade temporária na governança do assistente. Tente novamente em instantes.",
        source: "rpc",
      };
    }

    let isAvailable: boolean | null = null;
    if (typeof result.data === "boolean") {
      isAvailable = result.data;
    } else if (result.data && typeof result.data.is_available === "boolean") {
      isAvailable = result.data.is_available;
    }

    if (isAvailable === null || isAvailable === undefined) {
      return {
        available: false,
        reasonCode: "DYNAMIC_KILLSWITCH_INVALID_RESPONSE",
        reason: "Resposta ambígua do serviço de segurança. Operação bloqueada.",
        source: "rpc",
      };
    }

    if (isAvailable === false) {
      return {
        available: false,
        reasonCode: "DYNAMIC_KILLSWITCH_DISABLED",
        reason: "O Assistente de IA está temporariamente suspenso pela administração da plataforma.",
        source: "rpc",
      };
    }

    return {
      available: true,
      reasonCode: "DYNAMIC_KILLSWITCH_ACTIVE",
      source: "rpc",
    };
  } catch (err: any) {
    if (err?.message === "DYNAMIC_KILLSWITCH_TIMEOUT") {
      return {
        available: false,
        reasonCode: "DYNAMIC_KILLSWITCH_TIMEOUT",
        reason: "Tempo de resposta da governança excedido. Operação bloqueada por segurança.",
        source: "rpc",
      };
    }

    return {
      available: false,
      reasonCode: "DYNAMIC_KILLSWITCH_ERROR",
      reason: "Falha de comunicação com o serviço de governança do assistente.",
      source: "rpc",
    };
  }
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

// ============================================================================
// HARDENING DE GOVERNANÇA, CONCORRÊNCIA E ORÇAMENTO TPM DISTRIBUÍDOS (FASE 39)
// ============================================================================

export interface DistributedGovernanceAcquireParams {
  tenantId: string;
  userId: string;
  reservedTokens?: number;
  maxConcurrency?: number;
  maxGlobalTPM?: number;
  maxTenantDay?: number;
  maxTenantHour?: number;
  maxUserMin?: number;
  maxGlobalMin?: number;
  maxGlobalDay?: number;
  leaseTtlSeconds?: number;
  supabaseClientOverride?: any;
}

export interface DistributedGovernanceAcquireResult {
  allowed: boolean;
  leaseId?: string;
  reservedTokens?: number;
  expiresAt?: string;
  currentConcurrency?: number;
  retryAfterSeconds?: number;
  reason?: string;
  source: "rpc" | "memory_fallback";
  details?: Record<string, unknown>;
}

export interface DistributedGovernanceReleaseParams {
  leaseId: string;
  tenantId: string;
  actualTokens?: number | null;
  status?: "released" | "expired" | "error";
  supabaseClientOverride?: any;
}

export interface DistributedGovernanceReleaseResult {
  released: boolean;
  leaseId?: string;
  reservedTokens?: number;
  actualTokens?: number | null;
  tokenDelta?: number;
  alreadyProcessed?: boolean;
  reason?: string;
  source: "rpc" | "memory_fallback";
}

interface InMemoryLease {
  leaseId: string;
  tenantId: string;
  userId: string;
  reservedTokens: number;
  actualTokens: number | null;
  status: "active" | "released" | "expired";
  expiresAt: number;
  createdAt: number;
}

const inMemoryLeasesMap = new Map<string, InMemoryLease>();
let inMemoryMinuteConsumedTokens = 0;
let inMemoryMinuteBucketTimestamp = Math.floor(Date.now() / 60000) * 60000;

function cleanupInMemoryLeases() {
  const now = Date.now();
  for (const [id, lease] of inMemoryLeasesMap.entries()) {
    if (lease.status === "active" && lease.expiresAt <= now) {
      lease.status = "expired";
    }
    if (lease.expiresAt < now - 3600000) {
      inMemoryLeasesMap.delete(id);
    }
  }
}

/**
 * Estimativa conservadora de pior caso de tokens para a chamada
 * Considera: Prompt de Sistema + Fontes/Tutoriais + Histórico + Pergunta + MaxTokens de Saída
 */
export function estimateWorstCaseTokens(
  question: string,
  sources: Array<{ title?: string; steps?: string[]; notes?: string }>,
  history?: Array<{ role: string; content: string }>,
  maxOutputTokens: number = 600
): number {
  const systemPromptChars = 4000;
  const questionChars = (question || "").length;
  const historyChars = (history || []).reduce((acc, h) => acc + (h.content || "").length, 0);
  const sourcesChars = (sources || []).reduce((acc, s) => {
    const stepsLen = (s.steps || []).join(" ").length;
    return acc + (s.title || "").length + stepsLen + (s.notes || "").length;
  }, 0);

  const totalChars = systemPromptChars + questionChars + historyChars + sourcesChars;
  const inputTokensEst = Math.ceil(totalChars / 3.8);

  // Piso seguro de 1800 e teto de 3500 para proteção contra estouro de TPM (8.000 teto Groq)
  return Math.max(1800, Math.min(3500, inputTokensEst + maxOutputTokens));
}

/**
 * Aquisição atômica em memória (para testes unitários sem PostgreSQL ativo)
 */
function acquireInMemoryGovernanceSlot(
  params: DistributedGovernanceAcquireParams
): DistributedGovernanceAcquireResult {
  cleanupInMemoryLeases();
  cleanupOldRecords();

  const now = Date.now();
  const currentMinuteBucket = Math.floor(now / 60000) * 60000;
  if (currentMinuteBucket !== inMemoryMinuteBucketTimestamp) {
    inMemoryMinuteBucketTimestamp = currentMinuteBucket;
    inMemoryMinuteConsumedTokens = 0;
  }

  const {
    tenantId,
    userId,
    reservedTokens = 2200,
    maxConcurrency = 4,
    maxGlobalTPM = 6000,
    leaseTtlSeconds = 45,
  } = params;

  // 1. Concurrency Check (P1-01)
  let activeConcurrency = 0;
  let activeReservedTokens = 0;
  for (const lease of inMemoryLeasesMap.values()) {
    if (lease.status === "active" && lease.expiresAt > now) {
      activeConcurrency++;
      activeReservedTokens += lease.reservedTokens;
    }
  }

  if (activeConcurrency >= maxConcurrency) {
    return {
      allowed: false,
      reason: "CONCURRENCY_LIMIT_EXCEEDED",
      retryAfterSeconds: 5,
      currentConcurrency: activeConcurrency,
      source: "memory_fallback",
    };
  }

  // 2. TPM Check (P1-02)
  if ((inMemoryMinuteConsumedTokens + activeReservedTokens + reservedTokens) > maxGlobalTPM) {
    const secondsToNextMin = Math.max(1, 60 - Math.floor((now % 60000) / 1000));
    return {
      allowed: false,
      reason: "TPM_LIMIT_EXCEEDED",
      retryAfterSeconds: secondsToNextMin,
      source: "memory_fallback",
      details: {
        currentTpm: inMemoryMinuteConsumedTokens + activeReservedTokens,
        reservedRequested: reservedTokens,
        limit: maxGlobalTPM,
      },
    };
  }

  // 3. Conventional Rate Limits (including Tenant Day - P2-01)
  const rateLimitResult = checkRateLimit(userId, tenantId);
  if (!rateLimitResult.allowed) {
    return {
      allowed: false,
      reason: rateLimitResult.reason || "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: rateLimitResult.retryAfterSeconds || 60,
      source: "memory_fallback",
    };
  }

  // 4. Criação da lease com TTL
  const leaseId = `lease-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const expiresAt = now + leaseTtlSeconds * 1000;

  inMemoryLeasesMap.set(leaseId, {
    leaseId,
    tenantId,
    userId,
    reservedTokens,
    actualTokens: null,
    status: "active",
    expiresAt,
    createdAt: now,
  });

  return {
    allowed: true,
    leaseId,
    reservedTokens,
    expiresAt: new Date(expiresAt).toISOString(),
    currentConcurrency: activeConcurrency + 1,
    source: "memory_fallback",
  };
}

/**
 * Liberação de slot em memória (para testes unitários)
 */
function releaseInMemoryGovernanceSlot(
  params: DistributedGovernanceReleaseParams
): DistributedGovernanceReleaseResult {
  const { leaseId, tenantId, actualTokens = null, status = "released" } = params;
  const lease = inMemoryLeasesMap.get(leaseId);

  if (!lease) {
    return {
      released: false,
      reason: "LEASE_NOT_FOUND",
      source: "memory_fallback",
    };
  }

  if (lease.tenantId !== tenantId) {
    return {
      released: false,
      reason: "TENANT_MISMATCH",
      source: "memory_fallback",
    };
  }

  if (lease.status !== "active") {
    return {
      released: true,
      alreadyProcessed: true,
      source: "memory_fallback",
    };
  }

  lease.status = status;
  lease.actualTokens = actualTokens;

  let tokenDelta = 0;
  if (actualTokens !== null && actualTokens >= 0) {
    tokenDelta = actualTokens - lease.reservedTokens;
    inMemoryMinuteConsumedTokens = Math.max(0, inMemoryMinuteConsumedTokens + actualTokens);
  }

  return {
    released: true,
    leaseId,
    reservedTokens: lease.reservedTokens,
    actualTokens,
    tokenDelta,
    source: "memory_fallback",
  };
}

/**
 * Aquisição Distribuída de Slot de Governança (Concorrência, TPM e Rate Limits)
 *
 * Invoca a RPC public.ai_governance_acquire_slot no PostgreSQL.
 * Não mantém transações abertas. Em caso de sucesso, retorna lease_id com TTL de 45s.
 */
export async function acquireAIDistributedGovernanceSlot(
  params: DistributedGovernanceAcquireParams
): Promise<DistributedGovernanceAcquireResult> {
  const {
    tenantId,
    userId,
    reservedTokens = 2200,
    maxConcurrency = 4,
    maxGlobalTPM = 6000,
    maxTenantDay = 20,
    maxTenantHour = 30,
    maxUserMin = 5,
    maxGlobalMin = 20,
    maxGlobalDay = 800,
    leaseTtlSeconds = 45,
    supabaseClientOverride,
  } = params;

  let client = supabaseClientOverride;
  if (!client) {
    try {
      client = supabaseAdmin;
    } catch {
      client = null;
    }
  }

  if (client && typeof client.rpc === "function") {
    try {
      const { data, error } = await client.rpc("ai_governance_acquire_slot", {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_reserved_tokens: reservedTokens,
        p_max_concurrency: maxConcurrency,
        p_max_global_tpm: maxGlobalTPM,
        p_max_tenant_day: maxTenantDay,
        p_max_tenant_hour: maxTenantHour,
        p_max_user_min: maxUserMin,
        p_max_global_min: maxGlobalMin,
        p_max_global_day: maxGlobalDay,
        p_lease_ttl_seconds: leaseTtlSeconds,
      });

      if (error) {
        return {
          allowed: false,
          reason: `GOVERNANCE_RPC_ERROR: ${error.message || "Erro na RPC de governança"}`,
          source: "rpc",
        };
      }

      if (!data || typeof data !== "object") {
        return {
          allowed: false,
          reason: "GOVERNANCE_RPC_INVALID_RESPONSE",
          source: "rpc",
        };
      }

      if (data.allowed === false) {
        return {
          allowed: false,
          retryAfterSeconds: data.retry_after_seconds || 5,
          reason: data.reason || "GOVERNANCE_LIMIT_EXCEEDED",
          source: "rpc",
          details: data,
        };
      }

      if (data.allowed === true && data.lease_id) {
        return {
          allowed: true,
          leaseId: data.lease_id,
          reservedTokens: data.reserved_tokens || reservedTokens,
          expiresAt: data.expires_at,
          currentConcurrency: data.current_concurrency,
          source: "rpc",
          details: data,
        };
      }

      return {
        allowed: false,
        reason: "GOVERNANCE_RPC_UNEXPECTED_FORMAT",
        source: "rpc",
      };
    } catch (err: any) {
      if (process.env.NODE_ENV === "test" && !supabaseClientOverride) {
        return acquireInMemoryGovernanceSlot(params);
      }
      return {
        allowed: false,
        reason: `GOVERNANCE_RPC_EXCEPTION: ${err?.message || String(err)}`,
        source: "rpc",
      };
    }
  }

  if (process.env.NODE_ENV === "test") {
    return acquireInMemoryGovernanceSlot(params);
  }

  return {
    allowed: false,
    reason: "GOVERNANCE_CLIENT_UNAVAILABLE",
    source: "rpc",
  };
}

/**
 * Liberação Distribuída de Slot e Reconciliação Real de Tokens (Gate 2 e 3)
 *
 * Invoca public.ai_governance_release_slot atomicamente no PostgreSQL.
 * Atualiza o consumo real informado pelo provedor e encerra a lease.
 */
export async function releaseAIDistributedGovernanceSlot(
  params: DistributedGovernanceReleaseParams
): Promise<DistributedGovernanceReleaseResult> {
  const {
    leaseId,
    tenantId,
    actualTokens = null,
    status = "released",
    supabaseClientOverride,
  } = params;

  let client = supabaseClientOverride;
  if (!client) {
    try {
      client = supabaseAdmin;
    } catch {
      client = null;
    }
  }

  if (client && typeof client.rpc === "function") {
    try {
      const { data, error } = await client.rpc("ai_governance_release_slot", {
        p_lease_id: leaseId,
        p_tenant_id: tenantId,
        p_actual_tokens: actualTokens,
        p_status: status,
      });

      if (error) {
        return {
          released: false,
          reason: `GOVERNANCE_RELEASE_RPC_ERROR: ${error.message || "Erro ao liberar lease"}`,
          source: "rpc",
        };
      }

      if (data && typeof data === "object") {
        return {
          released: data.released === true,
          leaseId: data.lease_id || leaseId,
          reservedTokens: data.reserved_tokens,
          actualTokens: data.actual_tokens,
          tokenDelta: data.token_delta,
          alreadyProcessed: data.already_processed === true,
          source: "rpc",
        };
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === "test" && !supabaseClientOverride) {
        return releaseInMemoryGovernanceSlot(params);
      }
      return {
        released: false,
        reason: `GOVERNANCE_RELEASE_EXCEPTION: ${err?.message || String(err)}`,
        source: "rpc",
      };
    }
  }

  if (process.env.NODE_ENV === "test") {
    return releaseInMemoryGovernanceSlot(params);
  }

  return {
    released: false,
    reason: "GOVERNANCE_CLIENT_UNAVAILABLE",
    source: "rpc",
  };
}

/**
 * Reset de governança distribuída para ambiente de testes
 */
export function resetDistributedGovernanceForTesting(): void {
  inMemoryLeasesMap.clear();
  inMemoryMinuteConsumedTokens = 0;
  inMemoryMinuteBucketTimestamp = Math.floor(Date.now() / 60000) * 60000;
  resetAIConcurrencyForTesting();
  resetRateLimitsForTesting();
}


