import { supabase } from "@/integrations/supabase/client";

export interface TenantAdminAuthResult {
  authorized: boolean;
  userId?: string;
  tenantId?: string;
  role?: string;
  errorCode?:
    | "UNAUTHENTICATED"
    | "PROFILE_NOT_FOUND"
    | "SUPER_ADMIN_DENIED"
    | "ROLE_UNAUTHORIZED"
    | "TENANT_NOT_RESOLVED"
    | "DATABASE_ERROR";
  errorMessage?: string;
}

const UNAUTHORIZED_ROLES = [
  "reception",
  "receptionist",
  "barber",
  "professional",
  "financial",
  "finance",
  "cashier",
  "manager",
  "client",
  "customer",
];

/**
 * Validador Centralizado de Acesso ao Agente de IA Institucional (Barbex R2E.26E.21B)
 *
 * Regras Canônicas Mandatórias:
 * 1. Requer autenticação válida (userId não-vazio).
 * 2. Consulta o perfil real no banco de dados (não confia em payload do cliente).
 * 3. Nega explicitamente acesso a super_admin por padrão (Requisito 6).
 * 4. Nega expressamente papéis operacionais e clientes (Requisito 5).
 * 5. Não presume que 'admin' equivale automaticamente a 'tenant_admin' (Gate 1).
 *    Exige comprovação ativa de vínculo de barbearia (owner_id em barbershops ou membership ativo).
 * 6. Resolve o tenantId estritamente a partir do banco de dados, garantindo isolamento total (Requisito 4).
 */
export async function verifyTenantAdminIdentity(
  userId: string | null | undefined,
  clientOverride?: any,
): Promise<TenantAdminAuthResult> {
  const db = clientOverride || supabase;

  // 1. Fail-closed se anônimo ou sem userId comprovado
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return {
      authorized: false,
      errorCode: "UNAUTHENTICATED",
      errorMessage: "Autenticação obrigatória para acessar o Assistente Institucional.",
    };
  }

  try {
    // 2. Consulta o perfil real do usuário autenticado no banco
    const { data: profile, error: profileErr } = await db
      .from("profiles")
      .select("id, role, tenant_id, status")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      return {
        authorized: false,
        errorCode: "DATABASE_ERROR",
        errorMessage: `Erro ao validar perfil de acesso: ${profileErr.message}`,
      };
    }

    if (!profile) {
      return {
        authorized: false,
        errorCode: "PROFILE_NOT_FOUND",
        errorMessage: "Perfil de usuário não encontrado.",
      };
    }

    const role = (profile.role || "").toLowerCase().trim();

    // 3. Superadmin: Acesso institucional negado por padrão (Requisito 6)
    if (role === "super_admin") {
      return {
        authorized: false,
        errorCode: "SUPER_ADMIN_DENIED",
        errorMessage:
          "O Superadmin não possui acesso operacional ao assistente institucional do tenant por padrão.",
      };
    }

    // 4. Perfis operacionais e clientes: Acesso estritamente bloqueado (Requisito 5)
    if (UNAUTHORIZED_ROLES.includes(role)) {
      return {
        authorized: false,
        errorCode: "ROLE_UNAUTHORIZED",
        errorMessage: `O perfil '${role}' não possui permissão para acessar o Assistente Institucional.`,
      };
    }

    // 5. Verificar se é candidato a administrador de barbearia
    const isTenantAdmin = role === "tenant_admin";
    const isAdmin = role === "admin";

    if (!isTenantAdmin && !isAdmin) {
      return {
        authorized: false,
        errorCode: "ROLE_UNAUTHORIZED",
        errorMessage: `Papel '${role}' não autorizado como administrador de barbearia.`,
      };
    }

    // 6. Resolução e validação ativa do Tenant (Não presumir 'admin' sem barbearia comprovada)
    let resolvedTenantId: string | null = null;

    // A. Verificar se é proprietário direto de uma barbearia (public.barbershops.owner_id)
    const { data: ownedShop } = await db
      .from("barbershops")
      .select("id, owner_id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (ownedShop?.id) {
      resolvedTenantId = ownedShop.id;
    }

    // B. Se não encontrou barbershop por owner_id, verificar tenant_memberships ativo
    if (!resolvedTenantId) {
      const { data: membership } = await db
        .from("tenant_memberships")
        .select("tenant_id, role, status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (membership?.tenant_id) {
        const memRole = (membership.role || "").toLowerCase().trim();
        // Apenas membresia de tenant_admin ou admin concede acesso
        if (memRole === "tenant_admin" || memRole === "admin") {
          resolvedTenantId = membership.tenant_id;
        }
      }
    }

    // C. Verificar profile.tenant_id (se válido e não for tenant sentinela)
    if (!resolvedTenantId && profile.tenant_id) {
      if (profile.tenant_id !== "00000000-0000-0000-0000-000000000000") {
        resolvedTenantId = profile.tenant_id;
      }
    }

    // D. Para tenant_admin canônico legado onde o próprio ID do perfil é o tenant_id
    if (!resolvedTenantId && isTenantAdmin) {
      resolvedTenantId = profile.id;
    }

    // 7. Se após todas as verificações nenhum tenant ativo puder ser comprovado: FAIL-CLOSED
    if (!resolvedTenantId) {
      return {
        authorized: false,
        errorCode: "TENANT_NOT_RESOLVED",
        errorMessage:
          "Associação ativa a uma barbearia não comprovada. Acesso negado ao Assistente.",
      };
    }

    // Autorização concluída com sucesso e escopo garantido
    return {
      authorized: true,
      userId,
      tenantId: resolvedTenantId,
      role,
    };
  } catch (err: any) {
    return {
      authorized: false,
      errorCode: "DATABASE_ERROR",
      errorMessage: `Exceção durante validação de acesso: ${err?.message || err}`,
    };
  }
}

