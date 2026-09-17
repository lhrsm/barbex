/**
 * BARBEX — STRIPE & BILLING EDGE ADAPTER
 * Adapts client-side plan checkout, customer portal, and addon management
 * to communicate directly with Supabase Edge Functions:
 * - stripe-checkout
 * - stripe-addons
 *
 * Enforces server-side price authority, safe return URLs, and zero client secret exposure.
 */

import { invokeEdgeFunction, type EdgeInvokeOptions } from "../edge-client";

export type StripeEnvironment = "test" | "live" | "sandbox";

export interface CreatePlanCheckoutInput {
  planKey?: "starter" | "pro" | "elite" | string;
  priceId?: string;
  quantity?: number;
  environment?: StripeEnvironment;
  returnUrl?: string;
  customerEmail?: string;
  userId?: string;
}

export interface CreatePortalSessionInput {
  environment?: StripeEnvironment;
  returnUrl?: string;
}

export interface PreviewAddonInput {
  addonId: string;
  quantity?: number;
  environment?: StripeEnvironment;
}

export interface SubscribeToAddonInput {
  addonId: string;
  quantity?: number;
  environment?: StripeEnvironment;
}

export interface CancelAddonInput {
  contractId: string;
  environment?: StripeEnvironment;
}

export interface ReactivateAddonInput {
  contractId: string;
  environment?: StripeEnvironment;
}

export interface UpdateAddonQuantityInput {
  contractId: string;
  quantity: number;
  environment?: StripeEnvironment;
}

export interface AdminCreateAddonPriceInput {
  addonId: string;
  environment?: StripeEnvironment;
}

export type StripeResult<T> = ({ ok: true } & T) | { ok: false; error: string; code?: string };

function unwrapInput<T>(input: T | { data: T }): T {
  if (input && typeof input === "object" && "data" in input && (input as any).data) {
    return (input as { data: T }).data;
  }
  return input as T;
}

/**
 * Creates an embedded Stripe Checkout session for a SaaS plan via 'stripe-checkout' Edge Function.
 */
export async function createPlanCheckout(
  rawInput: CreatePlanCheckoutInput | { data: CreatePlanCheckoutInput },
  options?: EdgeInvokeOptions
): Promise<StripeResult<{ clientSecret?: string; sessionId?: string; url?: string }>> {
  const input = unwrapInput(rawInput);
  const planKey = (input.planKey || (input.priceId?.includes("pro") ? "pro" : input.priceId?.includes("elite") ? "elite" : "starter")) as "starter" | "pro" | "elite";

  const result = await invokeEdgeFunction<
    { action: "create-plan-checkout"; planKey: string; environment?: string; returnUrl?: string; customerEmail?: string },
    { clientSecret?: string; sessionId?: string; url?: string }
  >(
    "stripe-checkout",
    {
      action: "create-plan-checkout",
      planKey,
      environment: input.environment || "test",
      returnUrl: input.returnUrl,
      customerEmail: input.customerEmail,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.message || "Falha ao iniciar checkout de pagamento.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    clientSecret: data.clientSecret,
    sessionId: data.sessionId,
    url: data.url,
  };
}

// Alias for compatibility with existing components
export const createCheckoutSession = createPlanCheckout;

/**
 * Creates a Stripe Customer Billing Portal session via 'stripe-checkout' Edge Function.
 */
export async function createPortalSession(
  rawInput: CreatePortalSessionInput | { data: CreatePortalSessionInput } = {},
  options?: EdgeInvokeOptions
): Promise<StripeResult<{ url: string }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    { action: "create-portal-session"; environment?: string; returnUrl?: string },
    { url: string }
  >(
    "stripe-checkout",
    {
      action: "create-portal-session",
      environment: input.environment || "test",
      returnUrl: input.returnUrl,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.message || "Falha ao abrir portal de faturamento.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  if (!data.url) {
    return {
      ok: false,
      error: "URL do portal não retornada pelo servidor.",
    };
  }

  return {
    ok: true,
    url: data.url,
  };
}

/**
 * Previews proration and pricing for an add-on via 'stripe-addons' Edge Function.
 */
export async function previewAddon(
  rawInput: PreviewAddonInput | { data: PreviewAddonInput },
  options?: EdgeInvokeOptions
): Promise<StripeResult<{
  prorationAmount: number;
  currency: string;
  nextInvoiceAmount: number;
  nextInvoiceDate: string | null;
  unitPrice: number;
  quantity: number;
  trialDays: number;
  trialEligible: boolean;
}>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    { action: "preview"; addonId: string; quantity?: number; environment?: string },
    {
      prorationAmount: number;
      currency: string;
      nextInvoiceAmount: number;
      nextInvoiceDate: string | null;
      unitPrice: number;
      quantity: number;
      trialDays: number;
      trialEligible: boolean;
    }
  >(
    "stripe-addons",
    {
      action: "preview",
      addonId: input.addonId,
      quantity: input.quantity,
      environment: input.environment || "test",
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.message || "Falha ao calcular prévia do add-on.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    prorationAmount: Number(data.prorationAmount ?? 0),
    currency: String(data.currency || "BRL"),
    nextInvoiceAmount: Number(data.nextInvoiceAmount ?? 0),
    nextInvoiceDate: data.nextInvoiceDate || null,
    unitPrice: Number(data.unitPrice ?? 0),
    quantity: Number(data.quantity ?? 1),
    trialDays: Number(data.trialDays ?? 0),
    trialEligible: Boolean(data.trialEligible),
  };
}

/**
 * Subscribes the tenant to an add-on via 'stripe-addons' Edge Function.
 */
export async function subscribeToAddon(
  rawInput: SubscribeToAddonInput | { data: SubscribeToAddonInput },
  options?: EdgeInvokeOptions
): Promise<StripeResult<{ contractId?: string }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    { action: "subscribe"; addonId: string; quantity?: number; environment?: string },
    { contractId?: string }
  >(
    "stripe-addons",
    {
      action: "subscribe",
      addonId: input.addonId,
      quantity: input.quantity,
      environment: input.environment || "test",
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.message || "Falha ao ativar add-on.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    contractId: data.contractId,
  };
}

/**
 * Schedules cancellation of an add-on at the end of the current billing cycle via 'stripe-addons' Edge Function.
 */
export async function cancelAddon(
  rawInput: CancelAddonInput | { data: CancelAddonInput },
  options?: EdgeInvokeOptions
): Promise<StripeResult<Record<string, unknown>>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    { action: "cancel"; contractId: string; environment?: string },
    Record<string, unknown>
  >(
    "stripe-addons",
    {
      action: "cancel",
      contractId: input.contractId,
      environment: input.environment || "test",
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.message || "Falha ao cancelar add-on.",
      code: result.code,
    };
  }

  return { ok: true };
}

/**
 * Reactivates a cancelled add-on via 'stripe-addons' Edge Function.
 */
export async function reactivateAddon(
  rawInput: ReactivateAddonInput | { data: ReactivateAddonInput },
  options?: EdgeInvokeOptions
): Promise<StripeResult<Record<string, unknown>>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    { action: "reactivate"; contractId: string; environment?: string },
    Record<string, unknown>
  >(
    "stripe-addons",
    {
      action: "reactivate",
      contractId: input.contractId,
      environment: input.environment || "test",
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.message || "Falha ao reativar add-on.",
      code: result.code,
    };
  }

  return { ok: true };
}

/**
 * Updates the seat/unit quantity for an add-on via 'stripe-addons' Edge Function.
 */
export async function updateAddonQuantity(
  rawInput: UpdateAddonQuantityInput | { data: UpdateAddonQuantityInput },
  options?: EdgeInvokeOptions
): Promise<StripeResult<Record<string, unknown>>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    { action: "update-quantity"; contractId: string; quantity: number; environment?: string },
    Record<string, unknown>
  >(
    "stripe-addons",
    {
      action: "update-quantity",
      contractId: input.contractId,
      quantity: input.quantity,
      environment: input.environment || "test",
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.message || "Falha ao atualizar quantidade do add-on.",
      code: result.code,
    };
  }

  return { ok: true };
}

/**
 * Provisions Stripe Product + Price for an add-on (Super-admin only) via 'stripe-addons' Edge Function.
 */
export async function adminCreateAddonStripePrice(
  rawInput: AdminCreateAddonPriceInput | { data: AdminCreateAddonPriceInput },
  options?: EdgeInvokeOptions
): Promise<StripeResult<{ priceId?: string }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    { action: "admin-create-price"; addonId: string; environment?: string },
    { priceId?: string }
  >(
    "stripe-addons",
    {
      action: "admin-create-price",
      addonId: input.addonId,
      environment: input.environment || "test",
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.message || "Falha ao criar preço no Stripe.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    priceId: data.priceId,
  };
}

export interface BatchItemInput {
  addonId: string;
  quantity?: number;
  billingCycle?: "monthly" | "annual";
}

export interface PreviewAddonsBatchInput {
  items: BatchItemInput[];
  environment?: StripeEnvironment;
}

export interface SubscribeToAddonsBatchInput {
  items: BatchItemInput[];
  environment?: StripeEnvironment;
}

/**
 * Previews batch of add-ons via 'stripe-addons' Edge Function.
 */
export async function previewAddonsBatch(
  rawInput: PreviewAddonsBatchInput | { data: PreviewAddonsBatchInput },
  options?: EdgeInvokeOptions
): Promise<StripeResult<{
  prorationAmount: number;
  nextInvoiceAmount: number;
  currency: string;
  nextInvoiceDate: string | null;
}>> {
  const input = unwrapInput(rawInput);
  let totalProration = 0;
  let totalNextInvoice = 0;
  let currency = "BRL";
  let nextInvoiceDate: string | null = null;

  for (const item of input.items || []) {
    const res = await previewAddon({
      addonId: item.addonId,
      quantity: item.quantity,
      environment: input.environment,
    }, options);
    if (!res.ok) {
      return res;
    }
    totalProration += res.prorationAmount;
    totalNextInvoice += res.nextInvoiceAmount;
    currency = res.currency;
    if (res.nextInvoiceDate) nextInvoiceDate = res.nextInvoiceDate;
  }

  return {
    ok: true,
    prorationAmount: totalProration,
    nextInvoiceAmount: totalNextInvoice,
    currency,
    nextInvoiceDate,
  };
}

/**
 * Subscribes batch of add-ons via 'stripe-addons' Edge Function.
 */
export async function subscribeToAddonsBatch(
  rawInput: SubscribeToAddonsBatchInput | { data: SubscribeToAddonsBatchInput },
  options?: EdgeInvokeOptions
): Promise<StripeResult<{
  contracts: Array<{ addonId: string; contractId: string; billingCycle: "monthly" | "annual" }>;
}>> {
  const input = unwrapInput(rawInput);
  const contracts: Array<{ addonId: string; contractId: string; billingCycle: "monthly" | "annual" }> = [];

  for (const item of input.items || []) {
    const res = await subscribeToAddon({
      addonId: item.addonId,
      quantity: item.quantity,
      environment: input.environment,
    }, options);
    if (!res.ok) {
      return res;
    }
    contracts.push({
      addonId: item.addonId,
      contractId: res.contractId || "",
      billingCycle: item.billingCycle || "monthly",
    });
  }

  return {
    ok: true,
    contracts,
  };
}

