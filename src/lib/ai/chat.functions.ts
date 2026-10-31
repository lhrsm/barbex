import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifyTenantAdminIdentity } from "./tenant-admin-auth";
import {
  checkRateLimit,
  sanitizeAndValidateInput,
  isAIAssistantEnabled,
} from "./guardrails.server";
import { retrieveRelevantTutorials } from "./knowledge.server";
import { getAIProvider } from "./provider.server";
import type { AIContext } from "./types";

const AskAssistantInputSchema = z.object({
  question: z.string().min(2).max(500),
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
 * Server Function: askAIAssistant (Barbex R2E.26E.22A)
 *
 * Endpoint server-side seguro para tirar dúvidas de administradores da barbearia
 * fundamentado exclusivamente na Central de Ajuda do Barbex.
 *
 * Política: FREE-ONLY / FAIL-CLOSED / NO PAID FALLBACK
 */
export const askAIAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    return AskAssistantInputSchema.parse(input);
  })
  .handler(async ({ data, context }) => {
    const { userId, supabase: authSupabase } = context as any;
    const nowIso = new Date().toISOString();

    // 1. Sanitização inicial e verificação contra Prompt Injection
    const sanitization = sanitizeAndValidateInput(data.question);
    if (!sanitization.isValid) {
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

    // 2. Validação canônica de identidade e vínculo com a barbearia
    const authResult = await verifyTenantAdminIdentity(userId, authSupabase);
    if (!authResult.authorized || !authResult.tenantId) {
      throw new Error(
        authResult.errorMessage ||
          "Acesso negado: o Assistente de IA é de uso exclusivo do administrador da barbearia.",
      );
    }

    // 3. Verificação da Feature Flag (Fail-Closed)
    const flagStatus = isAIAssistantEnabled();
    if (!flagStatus.enabled) {
      return {
        success: false,
        reply:
          flagStatus.reason ||
          "O Assistente de IA está temporariamente indisponível.",
        sources: [],
        error: "FEATURE_DISABLED",
        timestamp: nowIso,
      };
    }

    // 4. Verificação de Rate Limiting (Cota Gratuita Protegida)
    const rateLimit = checkRateLimit(userId, authResult.tenantId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        reply:
          rateLimit.reason ||
          "Limite de consultas atingido. Aguarde alguns instantes.",
        sources: [],
        error: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        timestamp: nowIso,
      };
    }

    // 5. Recuperação de Conhecimento na Central de Ajuda
    const relevantSources = await retrieveRelevantTutorials(
      sanitization.cleanText,
      {
        maxResults: 3,
        minScoreThreshold: 1.5,
        supabaseClient: authSupabase,
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
      correlation_id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };

    // 7. Geração de Resposta via Provedor Abstrato (Groq / Mock)
    const provider = getAIProvider();
    const response = await provider.generate(
      sanitization.cleanText,
      relevantSources,
      aiContext,
    );

    return {
      success: !response.error,
      reply: response.content,
      sources: relevantSources.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        route: s.route,
      })),
      error: response.error,
      timestamp: nowIso,
    };
  });

