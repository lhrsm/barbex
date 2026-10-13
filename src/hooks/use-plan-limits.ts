import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./use-tenant";
import { useAuth } from "./use-auth";
import { startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { resolveDelinquencyState, type DelinquencyResolution } from "@/lib/delinquency";

export type PlanType = "starter" | "pro" | "elite" | "free";

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

      const profilePromise = userId
        ? supabase
            .from("profiles")
            .select("plan, effective_plan, selected_plan, created_at, trial_end, status")
            .eq("id", userId)
            .maybeSingle()
        : supabase
            .from("profiles")
            .select("plan, effective_plan, selected_plan, created_at, trial_end, status")
            .eq("tenant_id", tenantId!)
            .maybeSingle();

      const subPromise = userId
        ? supabase
            .from("subscriptions")
            .select(
              "status, current_period_end, cancel_at_period_end, stripe_customer_id, price_id, plan_key, past_due_since, grace_ends_at, payment_failed_at",
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : supabase
            .from("subscriptions")
            .select(
              "status, current_period_end, cancel_at_period_end, stripe_customer_id, price_id, plan_key, past_due_since, grace_ends_at, payment_failed_at",
            )
            .eq("user_id", tenantId!)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

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
            .eq("user_id", userId || tenantId)
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

      let currentPlan: PlanType = "free";
      let trialEndStr: string | null = null;

      if (profileRes.data) {
        trialEndStr = profileRes.data.trial_end;
        const now = new Date();
        const trialEnd = trialEndStr ? new Date(trialEndStr) : null;
        const trialActive = trialEnd && trialEnd > now;

        const profilePlan = (profileRes.data.plan as string)?.toLowerCase();
        const effectivePlan = (profileRes.data.effective_plan as string)?.toLowerCase();

        if (trialActive) {
          currentPlan = "pro";
        } else if (effectivePlan && effectivePlan !== "free") {
          currentPlan = effectivePlan as PlanType;
        } else {
          currentPlan = (profilePlan as PlanType) || "free";
        }
      }

      let subData: {
        status: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
        stripeCustomerId: string | null;
        priceId: string | null;
        pastDueSince: string | null;
        graceEndsAt: string | null;
        paymentFailedAt: string | null;
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
        };

        const isSubscribed = ["active", "trialing", "past_due"].includes(subRes.data.status || "");
        if (isSubscribed) {
          const planKey = (rawSub.plan_key as string)?.toLowerCase();
          const priceId = (subRes.data.price_id as string)?.toLowerCase() || "";

          if (planKey && ["starter", "pro", "elite"].includes(planKey)) {
            currentPlan = planKey as PlanType;
          } else if (priceId) {
            if (
              priceId.includes("starter") ||
              priceId === "price_1tvtowpkg6q10ujrqerpgyko" ||
              priceId === "price_1ujdzbpkg6q10ujrqrf3rhbs"
            ) {
              currentPlan = "starter";
            } else if (
              priceId.includes("pro") ||
              priceId === "price_1tvtovpkg6q10ujre6zmgypk" ||
              priceId === "price_1ujdacpkg6q10ujrwojctnmr"
            ) {
              currentPlan = "pro";
            } else if (
              priceId.includes("elite") ||
              priceId === "price_1tmyg0pkg6q10ujrox8teehr" ||
              priceId === "price_1ujdx4pkg6q10ujrzkytrhaj"
            ) {
              currentPlan = "elite";
            }
          }
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
        usage: usageData,
        usageStatus: usageStatusData,
      };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2, // 2 minutos de cache compartilhado por tenant
  });

  const plan = data?.plan || "free";
  const trialEndsAt = data?.trialEndsAt || null;
  const subscription = data?.subscription || null;
  const usage = data?.usage || {
    barbers: 0,
    services: 0,
    products: 0,
    monthlyAppointments: 0,
    whatsappConnections: 0,
  };
  const loading = !!tenantId && queryLoading;

  const limits = plan && PLAN_LIMITS[plan] ? PLAN_LIMITS[plan] : PLAN_LIMITS.free;

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
  const canAccess = hasActiveSubscription || isTrialValid;
  const isTrialExpired = !hasActiveSubscription && !!trialEndsAt && !isTrialValid;
  const isGraceExpired = delinquency.isGraceExpired;
  const isExpired = !canAccess;

  const checkLimit = (type: keyof typeof usage) => {
    if (!limits) return false;

    const limitValue = limits[type];

    // A. Se o limite for Infinity, é ilimitado -> sempre permitido (mesmo se contagem falhar)
    if (limitValue === Infinity) return true;

    // B. Se o limite for zero (recurso não permitido no plano), bloqueia
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
    subscription,
    checkLimit,
    refresh,
  };
}
