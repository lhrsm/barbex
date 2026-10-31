import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifyTenantAdminIdentity } from "./tenant-admin-auth";

/**
 * Endpoint de Servidor: resolveAIContext (Barbex R2E.26E.21B)
 *
 * Restrito EXCLUSIVAMENTE a administradores de barbearia autorizados (tenant_admin).
 * Qualquer perfil operacional (reception, barber, finance, client) ou super_admin
 * é sumariamente rejeitado no servidor (fail-closed).
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

    return {
      status: "active",
      ai_assistant_enabled: "active",
      context: {
        tenant_id: authResult.tenantId,
        user_id: userId,
        role: authResult.role,
        enabled_modules: (tenantModules as any[])?.map((m) => m.module_key) || [],
      },
    };
  });
