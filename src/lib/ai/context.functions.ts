import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  verifyTenantAdminIdentity,
  verifyTenantSubscriptionEligibility,
} from "./tenant-admin-auth";
import {
  isAIAssistantEnabled,
  checkDynamicModuleAvailability,
} from "./guardrails.server";

/**
 * Endpoint de Servidor: resolveAIContext (Barbex R2E.26E.22N.13B)
 *
 * Restrito EXCLUSIVAMENTE a administradores de barbearia autorizados (tenant_admin).
 * Qualquer perfil operacional (reception, barber, finance, client) ou super_admin
 * é sumariamente rejeitado no servidor (fail-closed).
 *
 * Avalia o status em tempo real do Kill Switch Global Vercel e do Kill Switch Dinâmico em Banco (Dual-Key).
 */
export const resolveAIContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authSupabase } = context as any;

    // 1. Validação canônica centralizada de autoridade e vínculo com o tenant
    const authResult = await verifyTenantAdminIdentity(userId, authSupabase);

    if (!authResult.authorized || !authResult.tenantId) {
      throw new Error(
        authResult.errorMessage || "Acesso não autorizado ao Assistente Institucional.",
      );
    }

    // 2. Consulta módulos ativos da barbearia autorizada (estritamente pelo tenantId verificado)
    const { data: tenantModules } = await authSupabase
      .from("barbershop_modules" as any)
      .select("module_key")
      .eq("tenant_id", authResult.tenantId)
      .eq("enabled", true);

    // 2.1. Validação Dinâmica de Elegibilidade Comercial de Assinatura (Fase R2E.26E.22N.37B)
    const eligibilityResult = await verifyTenantSubscriptionEligibility(authResult.tenantId, authSupabase);
    if (!eligibilityResult.eligible) {
      return {
        status: "subscription_ineligible",
        ai_assistant_enabled: false,
        reason: eligibilityResult.errorMessage || "Assinatura Starter, Pro ou Elite necessária para acesso ao assistente.",
        reasonCode: eligibilityResult.errorCode || "SUBSCRIPTION_INELIGIBLE",
        context: {
          tenant_id: authResult.tenantId,
          user_id: userId,
          role: authResult.role,
          enabled_modules: (tenantModules as any[])?.map((m) => m.module_key) || [],
        },
      };
    }

    // 3. Verificação do status real do Kill Switch Global Vercel e Isolamento Canário
    const canaryStatus = isAIAssistantEnabled(authResult.tenantId, userId);

    // 3.1. Verificação do Kill Switch Dinâmico em Banco (Dual-Key)
    const dynamicAvailability = await checkDynamicModuleAvailability(authSupabase);

    const isFullyEnabled = canaryStatus.enabled && dynamicAvailability.available;
    const effectiveReason = !canaryStatus.enabled
      ? canaryStatus.reason
      : (!dynamicAvailability.available ? dynamicAvailability.reason : undefined);
    const effectiveReasonCode = !canaryStatus.enabled
      ? canaryStatus.reasonCode
      : (!dynamicAvailability.available ? dynamicAvailability.reasonCode : undefined);

    let effectiveStatus = canaryStatus.status;
    if (canaryStatus.enabled && !dynamicAvailability.available) {
      effectiveStatus = "dynamically_disabled";
    }

    return {
      status: effectiveStatus,
      ai_assistant_enabled: isFullyEnabled,
      reason: effectiveReason,
      reasonCode: effectiveReasonCode,
      context: {
        tenant_id: authResult.tenantId,
        user_id: userId,
        role: authResult.role,
        enabled_modules: (tenantModules as any[])?.map((m) => m.module_key) || [],
      },
    };
  });
