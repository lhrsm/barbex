import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./use-tenant";
import { useAuth } from "./use-auth";
import { startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { resolveDelinquencyState, type DelinquencyResolution } from "@/lib/delinquency";

export type PlanType = "starter" | "pro" | "elite" | "free";

export const RESTRICTED_LIMITS = {
  barbers: 0,
  customers: 0,
  services: 0,
  products: 0,
  monthlyAppointments: 0,
  whatsappConnections: 0,
  automations: 0,
  hasTrial: false,
  trialDays: 0,
};

export function resolvePlanFromPriceId(priceId: string | null | undefined): PlanType | null {
  if (!priceId) return null;
  const p = priceId.toLowerCase();
  if (
    p.includes("starter") ||
    p === "price_1tvtowpkg6q10ujrqerpgyko" ||
    p === "price_1ujdzbpkg6q10ujrqrf3rhbs"
  ) {
    return "starter";
  }
  if (
    p.includes("pro") ||
    p === "price_1tvtovpkg6q10ujre6zmgypk" ||
    p === "price_1ujdacpkg6q10ujrwojctnmr" ||
    p === "price_1tvtpzpkg6q10ujrr4d34v6a"
  ) {
    return "pro";
  }
  if (
    p.includes("elite") ||
    p === "price_1tmyg0pkg6q10ujrox8teehr" ||
    p === "price_1ujdx4pkg6q10ujrzkytrhaj" ||
    p === "price_1tvtqqpkg6q10ujrx7xmsyqm"
  ) {
    return "elite";
  }
  return null;
}

export const PLAN_LIMITS = {
  free: {
    barbers: 1,
    customers: 50,
    services: 5,
    products: 5,
    monthlyAppointments: 30,
    whatsappConnections: 0,
    automations: 0,
    hasTrial: true,
    trialDays: 15,
  },
  starter: {
    barbers: 3,
    customers: 300,
    services: 15,
    products: Infinity,
    monthlyAppointments: Infinity,
    whatsappConnections: 1,
    automations: 3,
    price: 59.9,
  },
  pro: {
    barbers: 10,
    customers: Infinity,
    services: Infinity,
    products: Infinity,
    monthlyAppointments: Infinity,
    whatsappConnections: 2,
    automations: 8,
    price: 99.9,
  },
  elite: {
    barbers: Infinity,
    customers: Infinity,
    services: Infinity,
    products: Infinity,
    monthlyAppointments: Infinity,
    whatsappConnections: Infinity,
    automations: Infinity,
    price: 149.9,
  },
};

export function usePlanLimits() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const userId = user?.id;

  const {
    data,
    isLoading: queryLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["plan-limits", tenantId, userId],
    queryFn: async () => {
      if (!tenantId && !userId) return null;

      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();

      const targetIds = Array.from(new Set([userId, tenantId].filter(Boolean))) as string[];
      const idOrFilter = targetIds.map((id) => `user_id.eq.${id}`).join(",");

      const profilePromise = tenantId
        ? supabase
            .from("profiles")
            .select("plan, effective_plan, selected_plan, created_at, trial_end, status")
            .or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle()
        : userId
        ? supabase
            .from("profiles")
            .select("plan, effective_plan, selected_plan, created_at, trial_end, status")
            .eq("id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any);

      const subPromise = idOrFilter
        ? supabase
            .from("subscriptions")
            .select(
              "status, current_period_end, cancel_at_period_end, stripe_customer_id, price_id, plan_key, past_due_since, grace_ends_at, payment_failed_at, canceled_at",
            )
            .or(idOrFilter)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any);

      const [profileRes, subRes, countsRes] = await Promise.all([
        profilePromise,
        subPromise,
        Promise.allSettled([
          supabase
            .from("barbers")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId || userId)
            .eq("active", true),
          supabase
            .from("services")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId || userId)
            .eq("active", true),
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("user_id", tenantId || userId)
            .eq("active", true),
          supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId || userId)
            .neq("status", "cancelled")
            .gte("start_time", monthStart)
            .lte("start_time", monthEnd),
          supabase
            .from("whatsapp_instances")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId || userId),
        ]),
      ]);

      if (profileRes.error && profileRes.error.code !== "PGRST116") {
        console.error("[usePlanLimits] Erro ao consultar perfil:", profileRes.error);
        throw new Error("Erro ao consultar perfil: " + profileRes.error.message);
      }
      if (subRes.error && subRes.error.code !== "PGRST116") {
        console.error("[usePlanLimits] Erro ao consultar assinatura:", subRes.error);
        throw new Error("Erro ao consultar assinatura: " + subRes.error.message);
      }

      // 1. Resolução segura de histórico de assinatura contratada
      let lastContractedPlan: PlanType | null = null;
      let subData: {
        status: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
        stripeCustomerId: string | null;
        priceId: string | null;
        pastDueSince: string | null;
        graceEndsAt: string | null;
        paymentFailedAt: string | null;
        canceledAt: string | null;
      } | null = null;

      if (subRes.data) {
        const rawSub = subRes.data as Record<string, unknown>;
        subData = {
          status: subRes.data.status || null,
          currentPeriodEnd: subRes.data.current_period_end || null,
          cancelAtPeriodEnd: !!subRes.data.cancel_at_period_end,
          stripeCustomerId: subRes.data.stripe_customer_id || null,
          priceId: subRes.data.price_id || null,
          pastDueSince: (rawSub.past_due_since as string) || null,
          graceEndsAt: (rawSub.grace_ends_at as string) || null,
          paymentFailedAt: (rawSub.payment_failed_at as string) || null,
          canceledAt: (rawSub.canceled_at as string) || null,
        };

        const planKeyFromSub = (rawSub.plan_key as string)?.toLowerCase();
        const pricePlan = resolvePlanFromPriceId(subRes.data.price_id);
        if (pricePlan) {
          lastContractedPlan = pricePlan;
        } else if (planKeyFromSub && ["starter", "pro", "elite"].includes(planKeyFromSub)) {
          lastContractedPlan = planKeyFromSub as PlanType;
        }
      }

      // 2. Avaliação de Trial do Perfil
      let trialEndStr: string | null = null;
      let trialActive = false;
      if (profileRes.data) {
        trialEndStr = profileRes.data.trial_end;
        const now = new Date();
        const trialEnd = trialEndStr ? new Date(trialEndStr) : null;
        trialActive = !!(trialEnd && trialEnd > now);
      }

      // 3. Resolução canônica de direitos via RPC resolve_tenant_entitlement
      let entitlementData: {
        operational_state: string;
        can_operate: boolean;
        effective_plan: string;
        commercial_plan?: string;
        plan_type?: string;
        restriction_reason: string | null;
        modules: string[];
      } | null = null;

      try {
        const effectiveTenant = tenantId || userId;
        const { data: entRes } = await supabase.rpc("resolve_tenant_entitlement", {
          _tenant_id: effectiveTenant,
        });
        if (entRes) {
          entitlementData = entRes as any;
        }
      } catch (e) {
        console.warn("[usePlanLimits] resolve_tenant_entitlement non-blocking fallback:", e);
      }

      // 4. Determinação estrita de currentPlan (FAIL-CLOSED / ZERO VULNERABILIDADE A PROFILES.EFFECTIVE_PLAN)
      let currentPlan: PlanType = "free";

      if (entitlementData) {
        if (!entitlementData.can_operate || entitlementData.operational_state === "RESTRICTED") {
          currentPlan = "free";
        } else if (entitlementData.operational_state === "VOUCHER_ACTIVE") {
          currentPlan = (["starter", "pro", "elite"].includes(entitlementData.effective_plan)
            ? entitlementData.effective_plan
            : "elite") as PlanType;
        } else if (entitlementData.operational_state === "TRIAL_ACTIVE" || trialActive) {
          currentPlan = "pro";
        } else if (["starter", "pro", "elite"].includes(entitlementData.effective_plan)) {
          currentPlan = entitlementData.effective_plan as PlanType;
        } else {
          currentPlan = "free";
        }
      } else {
        // Fallback apenas se RPC falhar (rede / indisponibilidade de banco):
        const isSubscribed = ["active", "trialing", "past_due"].includes(subRes?.data?.status || "");
        if (isSubscribed && lastContractedPlan) {
          currentPlan = lastContractedPlan;
        } else if (trialActive) {
          currentPlan = "pro";
        } else {
          currentPlan = "free";
        }
      }

      const [barbRes, servRes, prodRes, appRes, whatsappRes] = countsRes;

      const parseCount = (
        r: PromiseSettledResult<{ count?: number | null; error?: unknown } | null>,
      ): { count: number; ok: boolean } => {
        if (r.status === "fulfilled" && !r.value?.error && r.value?.count != null) {
          return { count: Number(r.value.count), ok: true };
        }
        return { count: 0, ok: false };
      };

      const parsedBarbers = parseCount(barbRes);
      const parsedServices = parseCount(servRes);
      const parsedProducts = parseCount(prodRes);
      const parsedAppointments = parseCount(appRes);
      const parsedWhatsapp = parseCount(whatsappRes);

      const usageData = {
        barbers: parsedBarbers.count,
        services: parsedServices.count,
        products: parsedProducts.count,
        monthlyAppointments: parsedAppointments.count,
        whatsappConnections: parsedWhatsapp.count,
      };

      const usageStatusData = {
        barbers: parsedBarbers.ok,
        services: parsedServices.ok,
        products: parsedProducts.ok,
        monthlyAppointments: parsedAppointments.ok,
        whatsappConnections: parsedWhatsapp.ok,
      };

      return {
        plan: currentPlan,
        trialEndsAt: trialEndStr,
        subscription: subData,
        lastContractedPlan,
        usage: usageData,
        usageStatus: usageStatusData,
        entitlement: entitlementData,
      };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2, // 2 minutos de cache compartilhado por tenant
  });

  const plan = data?.plan || "free";
  const trialEndsAt = data?.trialEndsAt || null;
  const subscription = data?.subscription || null;
  const lastContractedPlan = data?.lastContractedPlan || null;
  const entitlement = data?.entitlement || null;
  const usage = data?.usage || {
    barbers: 0,
    services: 0,
    products: 0,
    monthlyAppointments: 0,
    whatsappConnections: 0,
  };
  const loading = !!tenantId && queryLoading;

  const trialDaysRemaining = trialEndsAt
    ? Math.max(0, differenceInDays(new Date(trialEndsAt), new Date()))
    : 0;

  const subStatus = (subscription?.status || "").toLowerCase();
  const delinquency = resolveDelinquencyState(subscription);

  // A subscription is active if status is active/paid/trialing, or past_due strictly within Grace.
  const isSubscriptionActive =
    ["active", "paid", "trialing"].includes(subStatus) ||
    (subStatus === "past_due" && delinquency.isInGrace);

  // Plan grants access only if NOT delinquent with expired Grace
  const hasPlanAccess = !delinquency.isGraceExpired && !!plan && plan !== "free";

  const hasActiveSubscription = isSubscriptionActive || hasPlanAccess;
  const isTrialValid =
    !hasActiveSubscription && (trialEndsAt ? new Date(trialEndsAt) > new Date() : false);

  // Canonical Operational State Evaluation
  const isQueryError = Boolean(isError);
  const operationalState = entitlement?.operational_state || (hasActiveSubscription || isTrialValid ? "SUBSCRIPTION_ACTIVE" : "RESTRICTED");
  const canOperate = !isQueryError && (entitlement ? Boolean(entitlement.can_operate) : (hasActiveSubscription || isTrialValid));
  // Falha de rede não pode ser confundida com restrição legítima confirmada:
  const isRestricted = !isQueryError && (!canOperate || operationalState === "RESTRICTED");
  const restrictionReason = entitlement?.restriction_reason || (isRestricted ? "Conta com operações restritas" : null);

  // Se o tenant for RESTRICTED, em erro de rede, ou não puder operar, limites são rigorosamente ZERADOS (fail-closed)
  const limits = (isRestricted || isQueryError) ? RESTRICTED_LIMITS : (plan && PLAN_LIMITS[plan] ? PLAN_LIMITS[plan] : PLAN_LIMITS.free);

  const canAccess = canOperate;
  const isSubscriptionCanceled = subStatus === "canceled";
  const isTrialExpired =
    !hasActiveSubscription && !isSubscriptionCanceled && !!trialEndsAt && !isTrialValid;
  const isGraceExpired = delinquency.isGraceExpired;
  const isExpired = !canAccess;

  const isScheduledForCancellation = Boolean(
    subscription?.cancel_at_period_end && subStatus === "active",
  );
  const scheduledCancellationDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR")
    : null;

  let commercialState:
    | "RESTRICTED"
    | "TRIAL_ACTIVE"
    | "SUBSCRIPTION_ACTIVE"
    | "SUBSCRIPTION_GRACE"
    | "VOUCHER_ACTIVE"
    | "ERROR"
    | "FREE" = "FREE";

  if (isQueryError) {
    commercialState = "ERROR";
  } else if (isRestricted || operationalState === "RESTRICTED") {
    commercialState = "RESTRICTED";
  } else if (operationalState === "VOUCHER_ACTIVE") {
    commercialState = "VOUCHER_ACTIVE";
  } else if (operationalState === "TRIAL_ACTIVE" || isTrialValid) {
    commercialState = "TRIAL_ACTIVE";
  } else if (delinquency.isInGrace || operationalState === "SUBSCRIPTION_GRACE") {
    commercialState = "SUBSCRIPTION_GRACE";
  } else if (hasActiveSubscription || operationalState === "SUBSCRIPTION_ACTIVE") {
    commercialState = "SUBSCRIPTION_ACTIVE";
  }

  const checkLimit = (type: keyof typeof usage) => {
    // If query failed or tenant is operational-restricted, all operational actions are blocked (fail-closed)
    if (isQueryError || !canOperate || isRestricted) return false;
    if (!limits) return false;

    const limitValue = limits[type];

    // A. Se o limite for Infinity, é ilimitado -> sempre permitido (mesmo se contagem falhar)
    if (limitValue === Infinity) return true;

    // B. Se o limite for zero (recurso não permitido no plano ou restrito), bloqueia
    if (limitValue === 0) return false;

    // C. FAIL-CLOSED: Se a contagem falhou ou os dados ainda não foram obtidos, não autoriza
    if (!data || data.usageStatus?.[type] === false) {
      return false;
    }

    // D. Se a contagem real foi obtida com sucesso:
    return usage[type] < limitValue;
  };

  const refresh = async () => {
    await refetch();
  };

  return {
    plan,
    limits: limits || PLAN_LIMITS.free,
    usage,
    loading,
    isError,
    error,
    trialDaysRemaining,
    trialEndsAt,
    isTrial: isTrialValid,
    isTrialExpired,
    isInGrace: delinquency.isInGrace,
    isGraceExpired,
    delinquency,
    isExpired,
    isScheduledForCancellation,
    scheduledCancellationDate,
    subscription,
    lastContractedPlan,
    commercialState,
    operationalState,
    canOperate,
    isRestricted,
    restrictionReason,
    entitlement,
    checkLimit,
    refresh,
  };
}
