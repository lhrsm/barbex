/**
 * BARBEX — CANONICAL STRIPE PRICING & COMMERCIAL MATRIX
 * Authoritative commercial definition, format sanitization, fail-closed resolution,
 * and Stripe price object validation for SaaS plans (Starter, Pro, Elite).
 */

export type PlanKey = "starter" | "pro" | "elite";
export type BillingCycle = "month" | "year";
export type StripeEnvironment = "test" | "live" | "sandbox";

export interface PlanCommercialRule {
  expectedAmount: number; // in centavos
  expectedCurrency: "brl";
  expectedInterval: BillingCycle;
  displayPrice: string;
  totalAnnualPrice?: string;
  monthlyEquivalent?: string;
  annualSavings?: string;
}

export const COMMERCIAL_RULES: Record<PlanKey, Record<BillingCycle, PlanCommercialRule>> = {
  starter: {
    month: {
      expectedAmount: 5990,
      expectedCurrency: "brl",
      expectedInterval: "month",
      displayPrice: "R$ 59,90/mês",
    },
    year: {
      expectedAmount: 49900,
      expectedCurrency: "brl",
      expectedInterval: "year",
      displayPrice: "R$ 499,00/ano",
      totalAnnualPrice: "R$ 499,00",
      monthlyEquivalent: "R$ 41,58",
      annualSavings: "R$ 219,80",
    },
  },
  pro: {
    month: {
      expectedAmount: 9990,
      expectedCurrency: "brl",
      expectedInterval: "month",
      displayPrice: "R$ 99,90/mês",
    },
    year: {
      expectedAmount: 99900,
      expectedCurrency: "brl",
      expectedInterval: "year",
      displayPrice: "R$ 999,00/ano",
      totalAnnualPrice: "R$ 999,00",
      monthlyEquivalent: "R$ 83,25",
      annualSavings: "R$ 199,80",
    },
  },
  elite: {
    month: {
      expectedAmount: 14990,
      expectedCurrency: "brl",
      expectedInterval: "month",
      displayPrice: "R$ 149,90/mês",
    },
    year: {
      expectedAmount: 149900,
      expectedCurrency: "brl",
      expectedInterval: "year",
      displayPrice: "R$ 1.499,00/ano",
      totalAnnualPrice: "R$ 1.499,00",
      monthlyEquivalent: "R$ 124,92",
      annualSavings: "R$ 299,80",
    },
  },
};

/**
 * Candidate Live Price IDs provided by the operator.
 * These represent the target configuration to be persisted in public.plans.
 */
export const CANDIDATE_LIVE_PRICE_IDS: Record<PlanKey, Record<BillingCycle, string>> = {
  starter: {
    month: "price_1TVtOWPKG6q10UjrQErPgyKO",
    year: "price_1UJDZBPKG6q10UjrQrf3rHBS",
  },
  pro: {
    month: "price_1TVtOVPKG6q10Ujre6zMGYpk",
    year: "price_1UJDaCPKG6q10UjrWOjctNmr",
  },
  elite: {
    month: "price_1TmYG0PKG6q10UjrOx8tEehr",
    year: "price_1UJDX4PKG6q10UjrzkytrHAJ",
  },
};

/**
 * Legacy Price IDs strictly blocked from new subscriptions.
 * Preserved exclusively for historical recognition of existing subscribers.
 */
export const BLOCKED_LEGACY_PRICE_IDS = new Set<string>([
  "price_1TVtgWPKG6q10UjrxRUCnyg1", // Elite R$ 59,90/mês legado arquivado
  "price_1TVsefPKG6q10UjrKpTaUe71", // Elite legado sem lookup key
]);

export interface ValidationSuccess {
  ok: true;
}

export interface ValidationFailure {
  ok: false;
  code:
    | "INVALID_PLAN"
    | "INVALID_BILLING_CYCLE"
    | "CONFIG_ERROR"
    | "FORBIDDEN"
    | "PRICE_INACTIVE"
    | "CURRENCY_MISMATCH"
    | "AMOUNT_MISMATCH"
    | "INTERVAL_MISMATCH"
    | "ENVIRONMENT_MISMATCH"
    | "PRODUCT_MISMATCH";
  error: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validates the explicit contract for plan checkout.
 * Enforces typed planKey ('starter' | 'pro' | 'elite') and billingCycle ('month' | 'year').
 * Rejects missing, invalid, or heuristic parameters without silent fallback.
 */
export function validatePlanCheckoutContract(
  planKey: unknown,
  billingCycle: unknown
): ValidationResult {
  if (!planKey || typeof planKey !== "string" || !["starter", "pro", "elite"].includes(planKey)) {
    return {
      ok: false,
      code: "INVALID_PLAN",
      error: "Plano inválido selecionado para contratação. Escolha starter, pro ou elite.",
    };
  }

  if (!billingCycle || typeof billingCycle !== "string" || !["month", "year"].includes(billingCycle)) {
    return {
      ok: false,
      code: "INVALID_BILLING_CYCLE",
      error: "Ciclo de faturamento inválido. Escolha mensal (month) ou anual (year).",
    };
  }

  return { ok: true };
}

export interface ResolvePriceSuccess {
  ok: true;
  priceId: string;
}

export type ResolvePriceResult = ResolvePriceSuccess | ValidationFailure;

/**
 * Resolves Price ID from database plan row with strict fail-closed semantics.
 * Rejects null, empty, non-string, or monetary strings (like "59,90").
 * Blocks legacy prices from new subscriptions.
 * Zero silent fallback to hardcoded IDs.
 */
export function resolvePriceFromPlanRow(
  planRow: {
    name?: string;
    slug?: string;
    stripe_price_id_test?: string | null;
    stripe_price_id_live?: string | null;
    stripe_yearly_price_id_test?: string | null;
    stripe_yearly_price_id_live?: string | null;
  } | null,
  planKey: PlanKey,
  billingCycle: BillingCycle,
  environment: "test" | "live"
): ResolvePriceResult {
  if (!planRow) {
    return {
      ok: false,
      code: "CONFIG_ERROR",
      error: `Plano "${planKey}" não encontrado na base de dados.`,
    };
  }

  const isLive = environment === "live";
  let candidatePriceId: string | null | undefined = null;

  if (billingCycle === "year") {
    candidatePriceId = isLive
      ? planRow.stripe_yearly_price_id_live
      : planRow.stripe_yearly_price_id_test;
  } else {
    candidatePriceId = isLive
      ? planRow.stripe_price_id_live
      : planRow.stripe_price_id_test;
  }

  // Strict format validation: must be string and start with "price_"
  const isValidFormat =
    typeof candidatePriceId === "string" &&
    candidatePriceId.trim().startsWith("price_");

  if (!isValidFormat || !candidatePriceId) {
    return {
      ok: false,
      code: "CONFIG_ERROR",
      error: `Preço Stripe não configurado ou formato inválido no banco de dados para o plano "${planRow.name || planKey}" (${billingCycle}, ambiente: ${environment}).`,
    };
  }

  const sanitizedId = candidatePriceId.trim();

  // Strict check against blocked legacy prices
  if (BLOCKED_LEGACY_PRICE_IDS.has(sanitizedId)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: `O identificador de preço ${sanitizedId} é um preço legado inativo para novas contratações.`,
    };
  }

  return { ok: true, priceId: sanitizedId };
}

/**
 * Validates Stripe Price object attributes against authoritative commercial rules.
 * Verifies active status, currency (BRL), unit amount in centavos, recurring interval, and environment livemode.
 */
export function validateStripePriceObject(
  priceObj: {
    id?: string;
    active?: boolean;
    currency?: string;
    unit_amount?: number | null;
    livemode?: boolean;
    product?: string | { id: string } | null;
    recurring?: {
      interval?: string;
      interval_count?: number;
    } | null;
  } | null,
  planKey: PlanKey,
  billingCycle: BillingCycle,
  isLive: boolean,
  expectedProductId?: string | null
): ValidationResult {
  if (!priceObj || typeof priceObj !== "object") {
    return {
      ok: false,
      code: "CONFIG_ERROR",
      error: "Objeto de preço Stripe retornado é nulo ou inválido.",
    };
  }

  if (priceObj.id && BLOCKED_LEGACY_PRICE_IDS.has(priceObj.id)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: `O identificador de preço ${priceObj.id} é um preço legado inativo para novas contratações.`,
    };
  }

  if (priceObj.active !== true) {
    return {
      ok: false,
      code: "PRICE_INACTIVE",
      error: `O preço ${priceObj.id || "solicitado"} está inativo ou arquivado no Stripe.`,
    };
  }

  if (Boolean(priceObj.livemode) !== isLive) {
    return {
      ok: false,
      code: "ENVIRONMENT_MISMATCH",
      error: `Divergência de ambiente: esperado ${isLive ? "Live" : "Test"}, mas o preço pertence a ${priceObj.livemode ? "Live" : "Test"}.`,
    };
  }

  // Strict Product ID verification for new checkouts:
  // Must be configured in the plans catalog and match price.product from Stripe
  if (!expectedProductId || typeof expectedProductId !== "string" || !expectedProductId.trim().startsWith("prod_")) {
    return {
      ok: false,
      code: "CONFIG_ERROR",
      error: `Configuração incompleta: Identificador de produto Stripe (Product ID) ausente ou inválido para novas contratações do plano ${planKey} (${billingCycle}).`,
    };
  }

  const sanitizedExpectedProductId = expectedProductId.trim();
  const actualProductId =
    typeof priceObj.product === "object" && priceObj.product?.id
      ? priceObj.product.id
      : typeof priceObj.product === "string"
      ? priceObj.product
      : null;

  if (!actualProductId) {
    return {
      ok: false,
      code: "PRODUCT_MISMATCH",
      error: `O preço Stripe ${priceObj.id || "solicitado"} não possui produto associado. Esperado: ${sanitizedExpectedProductId}.`,
    };
  }

  if (actualProductId !== sanitizedExpectedProductId) {
    return {
      ok: false,
      code: "PRODUCT_MISMATCH",
      error: `Divergência de produto Stripe: o preço pertence a ${actualProductId}, mas o plano ${planKey} exige o produto ${sanitizedExpectedProductId}.`,
    };
  }

  const rule = COMMERCIAL_RULES[planKey][billingCycle];

  const currency = (priceObj.currency || "").toLowerCase();
  if (currency !== rule.expectedCurrency) {
    return {
      ok: false,
      code: "CURRENCY_MISMATCH",
      error: `Moeda inválida: esperado ${rule.expectedCurrency.toUpperCase()}, recebido ${currency.toUpperCase()}.`,
    };
  }

  if (priceObj.unit_amount !== rule.expectedAmount) {
    const expectedBrl = (rule.expectedAmount / 100).toFixed(2);
    const receivedBrl = ((priceObj.unit_amount || 0) / 100).toFixed(2);
    return {
      ok: false,
      code: "AMOUNT_MISMATCH",
      error: `Valor unitário divergente da tabela comercial: esperado R$ ${expectedBrl}, recebido R$ ${receivedBrl}.`,
    };
  }

  const interval = priceObj.recurring?.interval;
  if (interval !== rule.expectedInterval) {
    return {
      ok: false,
      code: "INTERVAL_MISMATCH",
      error: `Periodicidade divergente: esperado ${rule.expectedInterval}, recebido ${interval || "desconhecido"}.`,
    };
  }

  return { ok: true };
}

/**
 * Evaluates whether an incoming Stripe webhook event is strictly out of order.
 * - Compares event.created epoch seconds with the stored latest_event_timestamp.
 * - An event is strictly STALE only if its creation time is strictly EARLIER than the latest stored event timestamp.
 * - Identical timestamps (events fired in the same second) or missing timestamps are NOT stale.
 */
export function checkWebhookEventOrder(
  eventCreatedEpochSeconds: number | null | undefined,
  latestEventTimestampIso: string | null | undefined
): { isStale: boolean; reason?: string } {
  if (!eventCreatedEpochSeconds || !latestEventTimestampIso) {
    return { isStale: false };
  }

  const incomingTimeMs = eventCreatedEpochSeconds * 1000;
  const latestStoredTimeMs = new Date(latestEventTimestampIso).getTime();

  if (isNaN(latestStoredTimeMs)) {
    return { isStale: false };
  }

  // Strictly less than: equal timestamps (e.g. created and invoice in same second) are allowed
  if (incomingTimeMs < latestStoredTimeMs) {
    return {
      isStale: true,
      reason: `Evento Stripe defasado: criado em ${new Date(incomingTimeMs).toISOString()}, mas já foi processado evento de ${new Date(latestStoredTimeMs).toISOString()}.`,
    };
  }

  return { isStale: false };
}

/**
 * Determines the authoritative profile.plan based on subscription status and resolved plan key.
 * - Ensures active, trialing, past_due retain access.
 * - Ensures canceled, unpaid, incomplete_expired, or missing subscriptions are set to 'free'.
 */
export function evaluateSubscriptionProfileConsistency(
  subscriptionStatus: string | null | undefined,
  resolvedPlanKey: string | null | undefined
): "free" | "starter" | "pro" | "elite" {
  const activeStatuses = ["active", "trialing", "past_due"];
  const isPaidActive = subscriptionStatus ? activeStatuses.includes(subscriptionStatus) : false;

  if (!isPaidActive) {
    return "free";
  }

  if (resolvedPlanKey && ["starter", "pro", "elite"].includes(resolvedPlanKey)) {
    return resolvedPlanKey as "starter" | "pro" | "elite";
  }

  return "free";
}

