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

export type TenantAccessModality = "TRIAL" | "VOUCHER" | "ASSINATURA" | "OUTRO";

export type TenantTrialStatus = "EM VIGÊNCIA" | "EXPIRADO" | "SEM EXPIRAÇÃO" | "NÃO APLICÁVEL";

export interface CommercialClassification {
  tenantId: string;
  tenantName: string;
  slug: string;
  modality: TenantAccessModality;
  trialStatus: TenantTrialStatus;
  /** Nome do plano comercial contratado (apenas se houver assinatura comercial) */
  commercialPlanName: string | null;
  /** Nome do plano técnico liberado no sistema para testes/funcionalidades */
  technicalPlanName: string | null;
  /** Valor mensal efetivamente contratado (MRR comercial) */
  contractedMonthlyAmount: number;
  /** Valor nominal de catálogo da referência técnica (não faturado para trial/voucher) */
  catalogNominalAmount: number;
  isPermanentVoucher: boolean;
  trialStart: string | null;
  trialEnd: string | null;
  statusBadgeVariant: "emerald" | "blue" | "amber" | "purple" | "gray";
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
    is_internal_test_tenant?: boolean | null;
  }> | null;
  hasPermanentVoucher?: boolean;
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
  const technicalPlanName = technicalPlan?.name || (input.ownerProfile?.plan ? input.ownerProfile.plan.toUpperCase() : null);
  const catalogNominalAmount = technicalPlan ? Number(technicalPlan.price_monthly) || 0 : 0;

  // 1. Verificação de Assinatura Comercial Contratada
  const activePaidSub = (input.subscriptions || []).find(
    (s) => s.status === "active" && !s.is_internal_test_tenant && !isPermanentVoucher
  );

  if (activePaidSub) {
    const contractedAmount = technicalPlan ? Number(technicalPlan.price_monthly) || 0 : 0;
    return {
      tenantId: input.id,
      tenantName: input.name,
      slug: input.slug,
      modality: "ASSINATURA",
      trialStatus: "NÃO APLICÁVEL",
      commercialPlanName: technicalPlanName,
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
      commercialPlanName: null, // Proibido exibir como plano comercial
      technicalPlanName,        // Referência técnica para liberação de módulos
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

  // 3. Verificação de Trial
  const trialStart = input.ownerProfile?.trial_start || input.created_at || null;
  const trialEnd = input.ownerProfile?.trial_end || null;

  let isExpired = false;
  if (trialEnd) {
    const end = new Date(trialEnd);
    if (!isNaN(end.getTime()) && end < now) {
      isExpired = true;
    }
  }

  const trialStatus: TenantTrialStatus = isExpired ? "EXPIRADO" : "EM VIGÊNCIA";

  return {
    tenantId: input.id,
    tenantName: input.name,
    slug: input.slug,
    modality: "TRIAL",
    trialStatus,
    commercialPlanName: null, // Proibido exibir como plano comercial
    technicalPlanName,        // Referência técnica para liberação de módulos
    contractedMonthlyAmount: 0, // Não gera MRR
    catalogNominalAmount,
    isPermanentVoucher: false,
    trialStart,
    trialEnd,
    statusBadgeVariant: isExpired ? "amber" : "blue",
    statusLabel: isExpired ? "TRIAL EXPIRADO" : "TRIAL EM VIGÊNCIA",
    explanation: isExpired
      ? "Período de teste expirado (sem bloqueio de teste, sem assinatura comercial)"
      : "Período de teste ativo (homologação pré-comercial)",
  };
}
