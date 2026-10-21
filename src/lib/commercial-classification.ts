/**
 * Classificação Canônica de Acesso e Assinaturas — Barbex Super Admin
 *
 * Regra de negócio estrita (R2E.9):
 * 1. Não confundir plano técnico/catálogo, trial, voucher e assinatura comercial.
 * 2. Barbearias de teste NÃO são assinantes comerciais.
 * 3. O nome de um plano comercial só aparece quando há assinatura comercial contratada.
 * 4. Barbearia LM possui voucher permanente ('VOUCHER', 'SEM EXPIRAÇÃO').
 * 5. As demais 4 barbearias são 'TRIAL', divididas em 'EM VIGÊNCIA' ou 'EXPIRADO'.
 */

export const LM_BARBERSHOP_ID = "c54ac1ac-49be-4505-b7a4-d257ed023f08";

export type TenantAccessModality = "TRIAL" | "VOUCHER" | "ASSINATURA" | "CANCELADA" | "RESTRICTED" | "FREE" | "TESTE_INTERNO" | "OUTRO";

export type TenantTrialStatus = "EM VIGÊNCIA" | "EXPIRADO" | "SEM EXPIRAÇÃO" | "NÃO APLICÁVEL";

export function resolveCommercialPlanNameFromPriceId(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  const p = priceId.toLowerCase();
  if (
    p.includes("starter") ||
    p === "price_1tvtowpkg6q10ujrqerpgyko" ||
    p === "price_1ujdzbpkg6q10ujrqrf3rhbs"
  ) {
    return "Starter";
  }
  if (
    p.includes("pro") ||
    p === "price_1tvtovpkg6q10ujre6zmgypk" ||
    p === "price_1ujdacpkg6q10ujrwojctnmr" ||
    p === "price_1tvtpzpkg6q10ujrr4d34v6a"
  ) {
    return "Pro";
  }
  if (
    p.includes("elite") ||
    p === "price_1tmyg0pkg6q10ujrox8teehr" ||
    p === "price_1ujdx4pkg6q10ujrzkytrhaj" ||
    p === "price_1tvtqqpkg6q10ujrx7xmsyqm"
  ) {
    return "Elite";
  }
  return null;
}

export interface CommercialClassification {
  tenantId: string;
  tenantName: string;
  slug: string;
  modality: TenantAccessModality;
  trialStatus: TenantTrialStatus;
  /** Identifica se o registro é uma fixture de teste interno / sintético */
  isInternalTest: boolean;
  /** Nome do plano comercial contratado (apenas se houver assinatura comercial) */
  commercialPlanName: string | null;
  /** Nome do último plano comercial contratado (se cancelado) */
  lastContractedPlanName?: string | null;
  /** Nome do plano técnico liberado no sistema para testes/funcionalidades */
  technicalPlanName: string | null;
  /** Valor mensal efetivamente contratado (MRR comercial) */
  contractedMonthlyAmount: number;
  /** Valor nominal de catálogo da referência técnica (não faturado para trial/voucher) */
  catalogNominalAmount: number;
  isPermanentVoucher: boolean;
  trialStart: string | null;
  trialEnd: string | null;
  statusBadgeVariant: "emerald" | "blue" | "amber" | "purple" | "gray" | "red";
  statusLabel: string;
  explanation: string;
}

export interface TenantClassificationInput {
  id: string;
  name: string;
  slug: string;
  owner_id?: string | null;
  plan_id?: string | null;
  created_at?: string;
  ownerProfile?: {
    id?: string;
    plan?: string | null;
    effective_plan?: string | null;
    trial_start?: string | null;
    trial_end?: string | null;
    is_internal_test_tenant?: boolean | null;
  } | null;
  assignedPlan?: {
    id: string;
    name: string;
    price_monthly: number;
  } | null;
  profilePlan?: {
    id: string;
    name: string;
    price_monthly: number;
  } | null;
  subscriptions?: Array<{
    id: string;
    status: string;
    price_id?: string | null;
    plan_key?: string | null;
    stripe_subscription_id?: string | null;
    is_internal_test_tenant?: boolean | null;
    canceled_at?: string | null;
  }> | null;
  hasPermanentVoucher?: boolean;
  entitlement?: {
    operational_state?: string | null;
    can_operate?: boolean | null;
    effective_plan?: string | null;
    restriction_reason?: string | null;
  } | null;
}

/**
 * Identifica se um estabelecimento ou registro é uma fixture/teste interno sintético.
 */
export function isSyntheticTestRecord(input: TenantClassificationInput): boolean {
  // 1. Flag explícita no perfil do proprietário
  if (input.ownerProfile?.is_internal_test_tenant === true) {
    return true;
  }

  // 2. Assinaturas vinculadas marcadas como teste interno ou com IDs sintéticos conhecidos
  const subs = input.subscriptions || [];
  if (subs.some((s) => s.is_internal_test_tenant === true)) {
    return true;
  }
  if (
    subs.some(
      (s) =>
        s.stripe_subscription_id &&
        (s.stripe_subscription_id.startsWith("sub_t") ||
          s.stripe_subscription_id.includes("_14b") ||
          s.stripe_subscription_id.includes("m17")),
    )
  ) {
    return true;
  }

  // 3. Faixas de IDs reservadas exclusivamente para fixtures sintéticas automatizadas
  if (
    input.id.startsWith("c0000000-") ||
    input.id.startsWith("a0000000-") ||
    (input.owner_id &&
      (input.owner_id.startsWith("c0000000-") || input.owner_id.startsWith("a0000000-")))
  ) {
    return true;
  }

  // 4. Salvaguarda contra falso positivo por coincidência de nome:
  // Se o proprietário estiver expressamente marcado como comercial legítimo (false),
  // ele NUNCA é classificado como sintético por mera semelhança nominal.
  if (input.ownerProfile?.is_internal_test_tenant === false) {
    return false;
  }

  // 5. Nomenclatura padronizada de fixtures sintéticas conhecidas (Tenant T01 a T30, etc.)
  if (
    /^Tenant\s+T\d+/i.test(input.name.trim()) ||
    /^tenant-t\d+/i.test(input.slug.trim())
  ) {
    return true;
  }

  return false;
}

/**
 * Classifica um estabelecimento com base nas regras comerciais estritas da plataforma.
 */
export function classifyTenant(input: TenantClassificationInput): CommercialClassification {
  const now = new Date();
  const isLM = input.id === LM_BARBERSHOP_ID || input.slug === "lm";
  const isPermanentVoucher = isLM || !!input.hasPermanentVoucher;

  // Resolução do plano técnico para apuração de funcionalidades/catálogo
  const technicalPlan = input.assignedPlan || input.profilePlan || null;
  const technicalPlanName =
    technicalPlan?.name ||
    (input.ownerProfile?.plan ? input.ownerProfile.plan.toUpperCase() : null);
  const catalogNominalAmount = technicalPlan ? Number(technicalPlan.price_monthly) || 0 : 0;

  // 0. Verificação Prioritária de Testes Internos / Fixtures Sintéticas
  if (isSyntheticTestRecord(input)) {
    return {
      tenantId: input.id,
      tenantName: input.name,
      slug: input.slug,
      modality: "TESTE_INTERNO",
      trialStatus: "NÃO APLICÁVEL",
      isInternalTest: true,
      commercialPlanName: null, // Proibido apresentar teste interno como plano comercial
      lastContractedPlanName: null,
      technicalPlanName: technicalPlanName || "TEST",
      contractedMonthlyAmount: 0, // Proibido gerar MRR comercial
      catalogNominalAmount: 0, // Proibido poluir valor nominal de catálogo comercial
      isPermanentVoucher: false,
      trialStart: input.ownerProfile?.trial_start || null,
      trialEnd: input.ownerProfile?.trial_end || null,
      statusBadgeVariant: "gray",
      statusLabel: "TESTE INTERNO",
      explanation: "Registro sintético de homologação interna (não comercial)",
    };
  }

  // 1. Verificação de Assinatura Comercial Ativa
  const activePaidSub = (input.subscriptions || []).find(
    (s) =>
      (s.status === "active" || s.status === "past_due") &&
      !s.is_internal_test_tenant &&
      !isPermanentVoucher,
  );

  if (activePaidSub) {
    const contractedAmount = technicalPlan ? Number(technicalPlan.price_monthly) || 0 : 0;
    return {
      tenantId: input.id,
      tenantName: input.name,
      slug: input.slug,
      modality: "ASSINATURA",
      trialStatus: "NÃO APLICÁVEL",
      isInternalTest: false,
      commercialPlanName: technicalPlanName,
      lastContractedPlanName: technicalPlanName,
      technicalPlanName,
      contractedMonthlyAmount: contractedAmount,
      catalogNominalAmount,
      isPermanentVoucher: false,
      trialStart: input.ownerProfile?.trial_start || null,
      trialEnd: input.ownerProfile?.trial_end || null,
      statusBadgeVariant: "emerald",
      statusLabel: "ASSINATURA ATIVA",
      explanation: `Assinatura comercial contratada (${technicalPlanName})`,
    };
  }

  // 2. Verificação de Voucher Permanente
  if (isPermanentVoucher) {
    return {
      tenantId: input.id,
      tenantName: input.name,
      slug: input.slug,
      modality: "VOUCHER",
      trialStatus: "SEM EXPIRAÇÃO",
      isInternalTest: false,
      commercialPlanName: null, // Proibido exibir como plano comercial
      lastContractedPlanName: null,
      technicalPlanName, // Referência técnica para liberação de módulos
      contractedMonthlyAmount: 0, // Não gera MRR
      catalogNominalAmount,
      isPermanentVoucher: true,
      trialStart: input.ownerProfile?.trial_start || null,
      trialEnd: null,
      statusBadgeVariant: "purple",
      statusLabel: "VOUCHER PERMANENTE",
      explanation: "Acesso por voucher permanente de testes (sem cobrança comercial)",
    };
  }

  // 3. Verificação de Assinatura Comercial Anterior Cancelada (ex: Carlos Barber Shop)
  const canceledSub = (input.subscriptions || []).find(
    (s) => s.status === "canceled" && !s.is_internal_test_tenant && !isPermanentVoucher,
  );

  if (canceledSub) {
    const lastPlan =
      resolveCommercialPlanNameFromPriceId(canceledSub.price_id) ||
      (canceledSub.plan_key && canceledSub.plan_key !== "free"
        ? canceledSub.plan_key.charAt(0).toUpperCase() + canceledSub.plan_key.slice(1)
        : null) ||
      (technicalPlanName && technicalPlanName !== "FREE" ? technicalPlanName : null);

    return {
      tenantId: input.id,
      tenantName: input.name,
      slug: input.slug,
      modality: "CANCELADA",
      trialStatus: "NÃO APLICÁVEL",
      isInternalTest: false,
      commercialPlanName: null, // Proibido exibir como plano comercial ativo
      lastContractedPlanName: lastPlan || null,
      technicalPlanName: "FREE",
      contractedMonthlyAmount: 0, // Não gera MRR
      catalogNominalAmount: 0,
      isPermanentVoucher: false,
      trialStart: input.ownerProfile?.trial_start || null,
      trialEnd: input.ownerProfile?.trial_end || null,
      statusBadgeVariant: "gray",
      statusLabel: "ASSINATURA CANCELADA",
      explanation: lastPlan
        ? `Assinatura anterior cancelada/reembolsada (Último plano contratado: ${lastPlan})`
        : "Assinatura anterior cancelada/reembolsada (Sem plano anterior identificado)",
    };
  }

  // 4. Verificação de Plano Gratuito (Free) sem trial
  const isProfileFree = input.ownerProfile?.plan?.toLowerCase() === "free";
  const hasNoTrial = !input.ownerProfile?.trial_end && !input.ownerProfile?.trial_start;
  if (isProfileFree && hasNoTrial) {
    return {
      tenantId: input.id,
      tenantName: input.name,
      slug: input.slug,
      modality: "FREE",
      trialStatus: "NÃO APLICÁVEL",
      isInternalTest: false,
      commercialPlanName: null,
      lastContractedPlanName: null,
      technicalPlanName: "FREE",
      contractedMonthlyAmount: 0,
      catalogNominalAmount: 0,
      isPermanentVoucher: false,
      trialStart: null,
      trialEnd: null,
      statusBadgeVariant: "gray",
      statusLabel: "PLANO GRATUITO",
      explanation: "Acesso permanente ao plano Free básico (sem cobrança recorrente)",
    };
  }

  // 5. Verificação de Trial / Acesso Restrito
  const trialStart = input.ownerProfile?.trial_start || input.created_at || null;
  const trialEnd = input.ownerProfile?.trial_end || null;

  let isExpired = false;
  if (trialEnd) {
    const end = new Date(trialEnd);
    if (!isNaN(end.getTime()) && end < now) {
      isExpired = true;
    }
  }

  if (isExpired || input.entitlement?.operational_state === "RESTRICTED") {
    return {
      tenantId: input.id,
      tenantName: input.name,
      slug: input.slug,
      modality: "RESTRICTED",
      trialStatus: "EXPIRADO",
      isInternalTest: false,
      commercialPlanName: null,
      lastContractedPlanName: null,
      technicalPlanName: "FREE",
      contractedMonthlyAmount: 0,
      catalogNominalAmount: 0,
      isPermanentVoucher: false,
      trialStart,
      trialEnd,
      statusBadgeVariant: "amber",
      statusLabel: "TRIAL EXPIRADO",
      explanation: "Período de teste encerrado — Acesso operacional restrito a novas operações",
    };
  }

  return {
    tenantId: input.id,
    tenantName: input.name,
    slug: input.slug,
    modality: "TRIAL",
    trialStatus: "EM VIGÊNCIA",
    isInternalTest: false,
    commercialPlanName: null, // Proibido exibir como plano comercial
    lastContractedPlanName: null,
    technicalPlanName: "PRO", // Referência técnica liberada no trial
    contractedMonthlyAmount: 0, // Não gera MRR
    catalogNominalAmount: 99.9,
    isPermanentVoucher: false,
    trialStart,
    trialEnd,
    statusBadgeVariant: "blue",
    statusLabel: "TRIAL PRO (EM VIGÊNCIA)",
    explanation: "Período de teste Pro ativo (homologação pré-comercial)",
  };
}
