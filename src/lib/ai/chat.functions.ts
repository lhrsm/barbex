import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  verifyTenantAdminIdentity,
  verifyTenantSubscriptionEligibility,
} from "./tenant-admin-auth";
import {
  checkRateLimit,
  checkDistributedRateLimit,
  checkDynamicModuleAvailability,
  sanitizeAndValidateInput,
  isAIAssistantEnabled,
  acquireAIConcurrencySlot,
  releaseAIConcurrencySlot,
} from "./guardrails.server";
import { retrieveRelevantTutorials } from "./knowledge.server";
import { getAIProvider } from "./provider.server";
import { logAITelemetry, maskIdentifier } from "./telemetry.server";
import type { AIContext } from "./types";

const ChatMessageHistoryItemSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(1500),
  })
  .refine(
    (item) => (item.role === "user" ? item.content.length <= 500 : item.content.length <= 1500),
    {
      message: "Mensagem do usuário não pode exceder 500 caracteres.",
    }
  );

export const AskAssistantInputSchema = z.object({
  question: z.string().min(2).max(500),
  history: z.array(ChatMessageHistoryItemSchema).max(6).optional(),
});

export interface AskAssistantResult {
  success: boolean;
  reply: string;
  sources: Array<{
    id: string;
    title: string;
    category: string;
    route: string;
  }>;
  error?: string;
  retryAfterSeconds?: number;
  timestamp: string;
}

/**
 * Server Function: askAIAssistant (Barbex R2E.26E.22N.8C)
 *
 * Endpoint server-side seguro para suporte e orientação de administradores de barbearia
 * fundamentado exclusivamente na Central de Ajuda do Barbex.
 *
 * Política: FREE-ONLY / FAIL-CLOSED / NO PAID FALLBACK
 * Ordem Obrigatória:
 * Autenticação -> Membership -> RBAC tenant_admin -> Kill Switch Global -> Isolamento Canário -> Rate Limiting Distribuído (RPC) -> Groq
 */
export const askAIAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    return AskAssistantInputSchema.parse(input);
  })
  .handler(async ({ data, context }) => {
    const { userId, supabase: authSupabase } = context as any;
    const nowIso = new Date().toISOString();
    const correlationId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const startTime = Date.now();

    // 0. Telemetria: Registro inicial de tentativa de acesso
    logAITelemetry({
      event: "AI_ACCESS_ATTEMPT",
      timestamp: nowIso,
      correlationId,
      outcome: "ALLOWED",
      userIdMasked: maskIdentifier(userId),
    });

    // 1. Sanitização inicial e verificação contra Prompt Injection
    const sanitization = sanitizeAndValidateInput(data.question);
    if (!sanitization.isValid) {
      logAITelemetry({
        event: "AI_ERROR",
        timestamp: nowIso,
        correlationId,
        outcome: "BLOCKED",
        reasonCode: sanitization.isHighRiskInjection
          ? "PROMPT_INJECTION_DETECTED"
          : "INVALID_INPUT",
        userIdMasked: maskIdentifier(userId),
      });

      return {
        success: false,
        reply: sanitization.rejectionReason || "Pergunta inválida.",
        sources: [],
        error: sanitization.isHighRiskInjection
          ? "PROMPT_INJECTION_DETECTED"
          : "INVALID_INPUT",
        timestamp: nowIso,
      };
    }

    // 1.1. Validação e sanitização estrita do histórico de conversação (Gate 1 e Gate 2)
    const validatedHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (Array.isArray(data.history)) {
      for (const item of data.history.slice(-6)) {
        if (item.role === "user" || item.role === "assistant") {
          const itemSanitization = sanitizeAndValidateInput(item.content);
          if (
            itemSanitization.isValid &&
            !itemSanitization.isHighRiskInjection &&
            itemSanitization.cleanText.length > 0
          ) {
            // Representação compacta: usuário até 500 chars, assistente até 1000 chars (Gate 1 - Fase 32)
            const maxLen = item.role === "user" ? 500 : 1000;
            validatedHistory.push({
              role: item.role,
              content: itemSanitization.cleanText.slice(0, maxLen),
            });
          }
        }
      }
    }

    // 2. Validação canônica de identidade e vínculo com a barbearia (RBAC / Membership)
    const authResult = await verifyTenantAdminIdentity(userId, authSupabase);
    if (!authResult.authorized || !authResult.tenantId) {
      logAITelemetry({
        event: authResult.errorCode === "UNAUTHENTICATED" ? "AI_AUTH_BLOCKED" : "AI_RBAC_BLOCKED",
        timestamp: nowIso,
        correlationId,
        outcome: "BLOCKED",
        reasonCode: authResult.errorCode || "ROLE_UNAUTHORIZED",
        userIdMasked: maskIdentifier(userId),
        tenantIdMasked: maskIdentifier(authResult.tenantId),
      });

      throw new Error(
        authResult.errorMessage ||
          "Acesso negado: o Assistente de IA é de uso exclusivo do administrador da barbearia.",
      );
    }

    // 2.1. Validação Dinâmica de Elegibilidade Comercial de Assinatura (Fase R2E.26E.22N.37B)
    const eligibilityResult = await verifyTenantSubscriptionEligibility(
      authResult.tenantId,
      authSupabase
    );
    if (!eligibilityResult.eligible) {
      logAITelemetry({
        event: "AI_SUBSCRIPTION_BLOCKED",
        timestamp: nowIso,
        correlationId,
        outcome: "BLOCKED",
        reasonCode: eligibilityResult.errorCode || "SUBSCRIPTION_INELIGIBLE",
        tenantIdMasked: maskIdentifier(authResult.tenantId),
        userIdMasked: maskIdentifier(userId),
      });

      return {
        success: false,
        reply:
          eligibilityResult.errorMessage ||
          "O Assistente Institucional é exclusivo para barbearias com assinatura ativa nos planos Starter, Pro ou Elite (/subscription).",
        sources: [],
        error: eligibilityResult.errorCode || "SUBSCRIPTION_INELIGIBLE",
        timestamp: nowIso,
      };
    }

    // 3. Verificação do Kill Switch Global e Isolamento Canário por Tenant e Usuário
    const canaryStatus = isAIAssistantEnabled(authResult.tenantId, userId);
    if (!canaryStatus.enabled) {
      const isKillSwitch = canaryStatus.reasonCode === "GLOBAL_KILLSWITCH_DISABLED";
      logAITelemetry({
        event: isKillSwitch ? "AI_KILLSWITCH_BLOCKED" : "AI_CANARY_BLOCKED",
        timestamp: nowIso,
        correlationId,
        outcome: "BLOCKED",
        reasonCode: canaryStatus.reasonCode || "FEATURE_DISABLED",
        tenantIdMasked: maskIdentifier(authResult.tenantId),
        userIdMasked: maskIdentifier(userId),
      });

      return {
        success: false,
        reply:
          canaryStatus.reason ||
          "O Assistente de IA está temporariamente indisponível.",
        sources: [],
        error: canaryStatus.reasonCode || "FEATURE_DISABLED",
        timestamp: nowIso,
      };
    }

    // 3.1. Verificação do Kill Switch Dinâmico em Banco (Dual-Key Security - Fase R2E.26E.22N.13B)
    const dynamicAvailability = await checkDynamicModuleAvailability(authSupabase);
    if (!dynamicAvailability.available) {
      logAITelemetry({
        event: "AI_KILLSWITCH_BLOCKED",
        timestamp: nowIso,
        correlationId,
        outcome: "BLOCKED",
        reasonCode: dynamicAvailability.reasonCode || "DYNAMIC_KILLSWITCH_DISABLED",
        tenantIdMasked: maskIdentifier(authResult.tenantId),
        userIdMasked: maskIdentifier(userId),
      });

      return {
        success: false,
        reply:
          dynamicAvailability.reason ||
          "O Assistente de IA está temporariamente suspenso pela administração da plataforma.",
        sources: [],
        error: dynamicAvailability.reasonCode || "DYNAMIC_KILLSWITCH_DISABLED",
        timestamp: nowIso,
      };
    }

    // 4. Verificação de Rate Limiting Distribuído (RPC PostgreSQL + salvaguarda em memória)
    const rateLimit = await checkDistributedRateLimit(authResult.tenantId, userId);
    if (!rateLimit.allowed) {
      logAITelemetry({
        event: "AI_RATE_LIMIT_BLOCKED",
        timestamp: nowIso,
        correlationId,
        outcome: "BLOCKED",
        reasonCode: rateLimit.reason,
        rateLimitSource: rateLimit.source,
        tenantIdMasked: maskIdentifier(authResult.tenantId),
        userIdMasked: maskIdentifier(userId),
      });

      const isInternalRpcError =
        rateLimit.reason?.startsWith("RATE_LIMIT_RPC_") ||
        rateLimit.reason === "RATE_LIMIT_CLIENT_UNAVAILABLE";

      const friendlyReply = isInternalRpcError
        ? "O serviço de validação de cotas do assistente está temporariamente instável. Por segurança, tente novamente em instantes."
        : (rateLimit.reason || "Limite de consultas atingido. Aguarde alguns instantes.");

      return {
        success: false,
        reply: friendlyReply,
        sources: [],
        error: isInternalRpcError
          ? (rateLimit.reason || "RATE_LIMIT_UNAVAILABLE")
          : "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        timestamp: nowIso,
      };
    }

    // 5. Recuperação de Conhecimento na Central de Ajuda com Resolução Contextual
    const relevantSources = await retrieveRelevantTutorials(
      sanitization.cleanText,
      {
        maxResults: 3,
        minScoreThreshold: 2.5,
        supabaseClient: authSupabase,
        history: validatedHistory,
      },
    );

    // 6. Montagem do Contexto de IA Auditável
    const aiContext: AIContext = {
      tenant_id: authResult.tenantId,
      user_id: userId,
      role: authResult.role as any,
      permissions: ["settings:manage", "dashboard:view"],
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      enabled_modules: ["tutorials", "calendar", "finances"],
      active_addons: [],
      allowed_data_scopes: ["tutorials", "general_operations"],
      correlation_id: correlationId,
    };

    // 7. Geração de Resposta via Provedor (Groq Free Tier / Mock Determinístico)
    // 7.1. Controle Concorrente de Semáforo (máx 4 requisições simultâneas)
    const concurrencySlot = acquireAIConcurrencySlot();
    if (!concurrencySlot.acquired) {
      logAITelemetry({
        event: "AI_RATE_LIMIT_BLOCKED",
        timestamp: new Date().toISOString(),
        correlationId,
        outcome: "BLOCKED",
        reasonCode: "CONCURRENCY_LIMIT_EXCEEDED",
        tenantIdMasked: maskIdentifier(authResult.tenantId),
        userIdMasked: maskIdentifier(userId),
      });

      return {
        success: false,
        reply:
          concurrencySlot.reason ||
          "O assistente atingiu a capacidade concorrente máxima. Aguarde alguns instantes e tente novamente.",
        sources: [],
        error: "CONCURRENCY_LIMIT_EXCEEDED",
        retryAfterSeconds: concurrencySlot.retryAfterSeconds || 5,
        timestamp: nowIso,
      };
    }

    const provider = getAIProvider();

    logAITelemetry({
      event: "AI_PROVIDER_REQUEST",
      timestamp: new Date().toISOString(),
      correlationId,
      outcome: "ALLOWED",
      model: provider.name,
      tenantIdMasked: maskIdentifier(authResult.tenantId),
      userIdMasked: maskIdentifier(userId),
      rateLimitSource: rateLimit.source,
    });

    let response;
    try {
      response = await provider.generate(
        sanitization.cleanText,
        relevantSources,
        aiContext,
        {
          history: validatedHistory,
        },
      );
    } finally {
      releaseAIConcurrencySlot();
    }

    const latencyMs = Date.now() - startTime;

    if (response.error) {
      logAITelemetry({
        event: "AI_ERROR",
        timestamp: new Date().toISOString(),
        correlationId,
        outcome: "ERROR",
        reasonCode: response.error,
        model: provider.name,
        latencyMs,
        tenantIdMasked: maskIdentifier(authResult.tenantId),
        userIdMasked: maskIdentifier(userId),
      });
    } else {
      logAITelemetry({
        event: "AI_PROVIDER_RESPONSE",
        timestamp: new Date().toISOString(),
        correlationId,
        outcome: "SUCCESS",
        model: provider.name,
        latencyMs,
        totalTokens: response.usage?.tokens,
        tenantIdMasked: maskIdentifier(authResult.tenantId),
        userIdMasked: maskIdentifier(userId),
      });
    }

    // Só envia como fontes na resposta da API os artigos com alta relevância (score >= 3.5),
    // ou o melhor artigo caso haja apenas um, protegendo a interface contra citações de artigos marginais
    const confidentSources = relevantSources.filter((s) => s.score >= 3.5);
    const finalSources = confidentSources.length > 0
      ? confidentSources
      : (relevantSources.length > 0 && relevantSources[0].score >= 2.5 ? [relevantSources[0]] : []);

    return {
      success: !response.error,
      reply: response.content,
      sources: finalSources.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        route: s.route,
      })),
      error: response.error,
      timestamp: nowIso,
    };
  });
