import { supabase } from "../../integrations/supabase/client";

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
    | "TENANT_NOT_FOUND"
    | "TENANT_INACTIVE"
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

    // 8. Validação explícita de atividade da barbearia (barbershops.is_active = true)
    const { data: targetShop, error: shopErr } = await db
      .from("barbershops")
      .select("id, is_active")
      .eq("id", resolvedTenantId)
      .maybeSingle();

    if (shopErr) {
      return {
        authorized: false,
        errorCode: "DATABASE_ERROR",
        errorMessage: `Erro ao validar barbearia vinculada: ${shopErr.message}`,
      };
    }

    if (!targetShop) {
      return {
        authorized: false,
        errorCode: "TENANT_NOT_FOUND",
        errorMessage: "Barbearia vinculada não encontrada no sistema.",
      };
    }

    if (targetShop.is_active === false) {
      return {
        authorized: false,
        errorCode: "TENANT_INACTIVE",
        errorMessage: "A barbearia vinculada está inativa. Acesso negado ao Assistente.",
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

export interface TenantSubscriptionEligibilityResult {
  eligible: boolean;
  tenantId?: string;
  plan?: string;
  operationalState?: string;
  errorCode?:
    | "INVALID_TENANT_ID"
    | "TENANT_NOT_FOUND"
    | "TENANT_INACTIVE"
    | "TENANT_BLOCKED"
    | "NO_ACTIVE_SUBSCRIPTION"
    | "TRIAL_EXPIRED"
    | "SUBSCRIPTION_CANCELED"
    | "PLAN_INELIGIBLE"
    | "MODULE_DISABLED_FOR_TENANT"
    | "DATABASE_ERROR";
  errorMessage?: string;
}

const ELIGIBLE_PLANS = ["starter", "pro", "elite"];

/**
 * Validador Dinâmico de Elegibilidade Comercial de Assinatura (Fase R2E.26E.22N.37B)
 *
 * Garante que o Assistente Institucional seja liberado exclusivamente a barbearias
 * adimplentes com assinatura ativa nos planos Starter, Pro ou Elite.
 *
 * Condições Mandatórias (ALL TRUE):
 * 1. Barbearia ativa (is_active !== false).
 * 2. Barbearia não bloqueada (blocked_at IS NULL).
 * 3. Barbearia não presente na blacklist individual (BARBEX_AI_BLOCKED_TENANT_IDS).
 * 4. Direitos operacionais comprovados via resolve_tenant_entitlement ou assinaturas ativas.
 * 5. Plano comercial efetivo em ('starter', 'pro', 'elite').
 * 6. Sem trial expirado e sem assinatura cancelada/inadimplente.
 */
export async function verifyTenantSubscriptionEligibility(
  tenantId: string | null | undefined,
  clientOverride?: any
): Promise<TenantSubscriptionEligibilityResult> {
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
    return {
      eligible: false,
      errorCode: "INVALID_TENANT_ID",
      errorMessage: "Identificador de barbearia não fornecido para validação comercial.",
    };
  }

  const cleanTenantId = tenantId.trim().toLowerCase();

  // 1. Verificação de Bloqueio Individual de Tenant via Variável de Ambiente (Kill Switch Granular)
  const blockedTenantsRaw = process.env.BARBEX_AI_BLOCKED_TENANT_IDS?.trim();
  if (blockedTenantsRaw) {
    const blockedTenants = blockedTenantsRaw
      .split(",")
      .map((t) => t.trim().toLowerCase());
    if (blockedTenants.includes(cleanTenantId)) {
      return {
        eligible: false,
        errorCode: "TENANT_BLOCKED",
        errorMessage: "O acesso ao Assistente Institucional está temporariamente suspenso para este estabelecimento.",
      };
    }
  }

  const db = clientOverride || supabase;

  try {
    // 2. Consulta à Barbearia (status de ativação e bloqueio via owner)
    const { data: shop, error: shopErr } = await db
      .from("barbershops")
      .select("id, is_active, owner_id")
      .eq("id", cleanTenantId)
      .maybeSingle();

    if (shopErr) {
      return {
        eligible: false,
        errorCode: "DATABASE_ERROR",
        errorMessage: `Erro ao consultar estabelecimento: ${shopErr.message}`,
      };
    }

    if (!shop) {
      return {
        eligible: false,
        errorCode: "TENANT_NOT_FOUND",
        errorMessage: "Estabelecimento não encontrado no sistema.",
      };
    }

    if (shop.is_active === false) {
      return {
        eligible: false,
        errorCode: "TENANT_INACTIVE",
        errorMessage: "O estabelecimento está inativo no Barbex.",
      };
    }

    // Verificar se o proprietário da barbearia está com perfil bloqueado
    if (shop.owner_id) {
      const { data: ownerProfile } = await db
        .from("profiles")
        .select("blocked_at")
        .eq("id", shop.owner_id)
        .maybeSingle();

      if (ownerProfile?.blocked_at) {
        return {
          eligible: false,
          errorCode: "TENANT_BLOCKED",
          errorMessage: "O estabelecimento encontra-se suspenso administrativamente.",
        };
      }
    }

    // 3. Consulta de Direitos via RPC Canônica resolve_tenant_entitlement
    let entitlementData: {
      can_operate?: boolean;
      effective_plan?: string;
      commercial_plan?: string;
      operational_state?: string;
      restriction_reason?: string | null;
      modules?: string[];
    } | null = null;

    if (typeof db.rpc === "function") {
      try {
        const { data: entRes, error: entErr } = await db.rpc("resolve_tenant_entitlement", {
          _tenant_id: cleanTenantId,
        });
        if (!entErr && entRes) {
          entitlementData = entRes;
        }
      } catch (e) {
        // Fallback para query direta em subscriptions
      }
    }

    // 4. Consulta direta de assinaturas e trial (para confirmação e fallback)
    const { data: subscription } = await db
      .from("subscriptions")
      .select("status, plan_id, current_period_end")
      .eq("tenant_id", cleanTenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Avaliação das Regras de Elegibilidade
    if (entitlementData) {
      // Se a RPC identificou restrição explícita
      if (entitlementData.can_operate === false || entitlementData.operational_state === "RESTRICTED") {
        if (subscription?.status === "canceled" || entitlementData.restriction_reason === "subscription_canceled") {
          return {
            eligible: false,
            errorCode: "SUBSCRIPTION_CANCELED",
            errorMessage: "A assinatura do seu estabelecimento está cancelada. Reative seu plano em /subscription para acessar o Assistente Institucional.",
          };
        }

        if (entitlementData.restriction_reason === "trial_expired") {
          return {
            eligible: false,
            errorCode: "TRIAL_EXPIRED",
            errorMessage: "O período de teste gratuito do seu estabelecimento expirou. Para utilizar o Assistente Institucional, ative um plano em /subscription.",
          };
        }

        return {
          eligible: false,
          errorCode: "NO_ACTIVE_SUBSCRIPTION",
          errorMessage: "Seu estabelecimento não possui uma assinatura ativa. O Assistente Institucional é exclusivo para assinantes dos planos Starter, Pro e Elite (/subscription).",
        };
      }

      const planName = (entitlementData.effective_plan || entitlementData.commercial_plan || "").toLowerCase();
      if (!ELIGIBLE_PLANS.includes(planName)) {
        return {
          eligible: false,
          errorCode: "PLAN_INELIGIBLE",
          errorMessage: `O plano atual (${planName || "gratuito"}) não inclui o Assistente Institucional. Conheça os planos Starter, Pro e Elite na rota /subscription.`,
        };
      }

      return {
        eligible: true,
        tenantId: cleanTenantId,
        plan: planName,
        operationalState: entitlementData.operational_state || "ACTIVE",
      };
    }

    // Fallback: Avaliação direta via tabela subscriptions e profiles
    if (subscription) {
      const subStatus = (subscription.status || "").toLowerCase();
      if (subStatus === "canceled") {
        return {
          eligible: false,
          errorCode: "SUBSCRIPTION_CANCELED",
          errorMessage: "A assinatura do seu estabelecimento está cancelada. Reative seu plano em /subscription para acessar o Assistente Institucional.",
        };
      }

      if (!["active", "trialing"].includes(subStatus)) {
        return {
          eligible: false,
          errorCode: "NO_ACTIVE_SUBSCRIPTION",
          errorMessage: `Assinatura com status '${subStatus}'. O Assistente Institucional requer uma assinatura ativa (/subscription).`,
        };
      }

      return {
        eligible: true,
        tenantId: cleanTenantId,
        plan: "starter", // plano base ativo
        operationalState: "SUBSCRIPTION_ACTIVE",
      };
    }

    // Se nenhum entitlement nem subscription forem encontrados: FAIL-CLOSED
    return {
      eligible: false,
      errorCode: "NO_ACTIVE_SUBSCRIPTION",
      errorMessage: "Nenhuma assinatura ativa encontrada para este estabelecimento. Ative seu plano em /subscription.",
    };
  } catch (err: any) {
    return {
      eligible: false,
      errorCode: "DATABASE_ERROR",
      errorMessage: `Exceção durante validação de elegibilidade: ${err?.message || err}`,
    };
  }
}


