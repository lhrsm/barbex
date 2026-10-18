import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits, PLAN_LIMITS, PlanType } from "@/hooks/use-plan-limits";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Check,
  Crown,
  Zap,
  ShieldAlert,
  Star,
  Rocket,
  Clock,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  Scale,
  X,
  ArrowDownCircle,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { SubscriptionCheckoutModal } from "@/components/subscription/SubscriptionCheckoutModal";
import { useTenant } from "@/hooks/use-tenant";
import {
  createPortalSession,
  cancelSubscriptionPeriodEnd,
  reactivateSubscription,
  previewSubscriptionCancellation,
  requestCancellationWithRefund,
  type SubscriptionCancellationPreviewResult,
} from "@/lib/backend/edge/stripe";
import { Badge } from "@/components/ui/badge";
import { YourAddons } from "@/components/subscription/YourAddons";
import { getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useBillingContext } from "@/hooks/use-billing-context";
import { BenefitCard } from "@/components/subscription/BenefitCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const WHATSAPP_COMERCIAL = "5571981708086";
const personalizadoUrl = `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent("Olá! Tenho interesse em um Plano Personalizado do BarberX para minha barbearia.")}`;

import { PermissionGuard } from "@/components/auth/PermissionGuard";

export const Route = createFileRoute("/subscription/")({
  component: () => (
    <PermissionGuard permission="settings:manage">
      <SubscriptionComponent />
    </PermissionGuard>
  ),
});

function SubscriptionComponent() {
  console.log("[Subscription] Rendering SubscriptionComponent");
  let auth, planLimits, checkout, tenantInfo;

  try {
    auth = useAuth();
    planLimits = usePlanLimits();
    checkout = useStripeCheckout();
    tenantInfo = useTenant();
    console.log("[Subscription] Hooks loaded:", {
      authLoading: auth.loading,
      planLoading: planLimits.loading,
      plan: planLimits.plan,
    });
  } catch (err) {
    console.error("[Subscription] Error loading hooks:", err);
    throw err;
  }

  const { user, loading: authLoading, role } = auth;
  const { tenantId, businessName } = tenantInfo;
  const {
    plan,
    usage,
    limits,
    trialDaysRemaining,
    isTrial,
    loading: planLoading,
    subscription,
    lastContractedPlan,
    commercialState,
    operationalState,
    canOperate,
    isRestricted,
    isError,
    delinquency,
    refresh,
  } = planLimits;
  const { openCheckout, closeCheckout, isOpen, options, checkoutElement } = checkout;
  const { ctx: billing, isInternalTesting } = useBillingContext();

  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const isPortalReturn =
    typeof window !== "undefined" && window.location.search.includes("portal_return=true");

  const handleManualRefresh = async () => {
    setRefreshingStatus(true);
    try {
      await refresh();
      toast.success("Status da assinatura atualizado.");
    } catch (e: any) {
      toast.error("Não foi possível atualizar o status agora.");
    } finally {
      setRefreshingStatus(false);
    }
  };
  const [compareOpen, setCompareOpen] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<PlanType | null>(null);
  const [billingCycle, setBillingCycle] = useState<"month" | "year">("month");

  // Cancellation and reactivation lifecycle states
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelFeedback, setCancelFeedback] = useState("");
  const [cancelPreview, setCancelPreview] = useState<SubscriptionCancellationPreviewResult | null>(
    null,
  );
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedCancelMode, setSelectedCancelMode] = useState<
    "cooling_off" | "proportional" | "period_end"
  >("period_end");

  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [reversingCancellation, setReversingCancellation] = useState(false);

  const planRank: Record<string, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    professional: 2,
    elite: 3,
  };

  const requestPlanChange = (newPlan: PlanType) => {
    const current = planRank[plan ?? "free"] ?? 0;
    const target = planRank[newPlan] ?? 0;
    if (target < current) {
      setDowngradeTarget(newPlan);
      return;
    }
    handlePlanChange(newPlan);
  };

  const handlePlanChange = async (newPlan: PlanType, cycle: "month" | "year" = billingCycle) => {
    console.log("[Subscription] 👆 Clique em handlePlanChange:", {
      newPlan,
      currentPlan: plan,
      cycle,
    });

    if (!user) {
      console.warn("[Subscription] ❌ Usuário não logado");
      toast.error("Você precisa estar logado.");
      return;
    }

    if (newPlan === "free") {
      console.log("[Subscription] ℹ️ Plano free selecionado, ignorando checkout");
      return;
    }

    setUpdating(true); // Ativa loading global para evitar múltiplos cliques

    try {
      // Normaliza nome legado para 'pro'
      const planKey = (newPlan === ("professional" as any) ? "pro" : newPlan) as
        "starter" | "pro" | "elite";
      if (!["starter", "pro", "elite"].includes(planKey)) {
        throw new Error("Plano selecionado inválido. Escolha Starter, Pro ou Elite.");
      }

      if (!["month", "year"].includes(cycle)) {
        throw new Error("Ciclo de faturamento inválido. Escolha Mensal ou Anual.");
      }

      const targetConfig = planConfigs.find((p) => p.id === planKey);
      const selectedPrice =
        cycle === "year" ? targetConfig?.yearlyPrice : targetConfig?.monthlyPrice;

      console.log("[Subscription] 🚀 Abrindo modal de checkout com contrato explícito:", {
        planKey,
        billingCycle: cycle,
      });
      openCheckout({
        planKey,
        billingCycle: cycle,
        customerEmail: user.email,
        userId: user.id,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        tenantId: tenantId || undefined,
        tenantName: businessName || undefined,
        planName: targetConfig?.name || planKey,
        price: selectedPrice || (cycle === "year" ? "499,00" : "59,90"),
        features: targetConfig?.features || undefined,
      });
    } catch (err: any) {
      console.error("[Subscription] ❌ Erro ao iniciar o checkout:", err);
      toast.error(err.message || "Erro ao iniciar o checkout.");
    } finally {
      // Pequeno delay para garantir que o modal abra antes de remover o loading do botão
      setTimeout(() => setUpdating(false), 500);
    }
  };

  const handleManageSubscription = async () => {
    setUpdating(true);
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const token = authSession?.access_token;

      if (!token) throw new Error("Você precisa estar logado.");

      const res = await createPortalSession(
        {
          returnUrl: `${window.location.origin}/subscription`,
          environment: getStripeEnvironment(),
        },
        {
          authToken: token,
        },
      );
      if (!res.ok) {
        throw new Error(res.error || "Não foi possível abrir o portal.");
      }
      if (res.url) {
        window.open(res.url, "_blank");
      }
    } catch (e: any) {
      console.error("[Subscription] manageSubscription error:", e);
      toast.error(e?.message || "Não foi possível abrir o portal.");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenCancelDialog = async () => {
    setCancelDialogOpen(true);
    setLoadingPreview(true);
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) throw new Error("Você precisa estar logado.");

      const res = await previewSubscriptionCancellation(
        { environment: getStripeEnvironment() },
        { authToken: token },
      );

      if (res.ok) {
        setCancelPreview(res);
        if (res.self_service_allowed !== false && res.cooling_off?.eligible) {
          setSelectedCancelMode("cooling_off");
        } else if (res.self_service_allowed !== false && res.proportional?.eligible) {
          setSelectedCancelMode("proportional");
        } else {
          setSelectedCancelMode("period_end");
        }
      } else {
        toast.error(res.error || "Não foi possível carregar a prévia de reembolso.");
      }
    } catch (e: any) {
      console.warn("Could not load cancellation preview:", e);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmCancellation = async () => {
    if (cancelingSubscription) return;
    setCancelingSubscription(true);
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) throw new Error("Você precisa estar logado.");

      if (selectedCancelMode === "cooling_off" || selectedCancelMode === "proportional") {
        const expectedRefundCents =
          selectedCancelMode === "cooling_off"
            ? cancelPreview?.cooling_off?.estimated_refund_cents || 0
            : cancelPreview?.proportional?.estimated_refund_cents || 0;

        const res = await requestCancellationWithRefund(
          {
            mode: selectedCancelMode,
            expectedRefundCents,
            reason: cancelReason || "Não informado",
            feedback: cancelFeedback || undefined,
            environment: getStripeEnvironment(),
          },
          { authToken: token },
        );

        if (!res.ok) {
          throw new Error(res.error || "Não foi possível processar o estorno e cancelamento.");
        }

        if (res.requires_review) {
          toast.warning(
            res.message ||
              "Estorno financeiro enviado. A conciliação do cancelamento está em acompanhamento pelo suporte.",
          );
        } else {
          toast.success(
            res.message ||
              "Assinatura cancelada com sucesso e estorno enviado para o provedor de pagamentos.",
          );
        }
      } else {
        const res = await cancelSubscriptionPeriodEnd(
          {
            reason: cancelReason || "Não informado",
            feedback: cancelFeedback || undefined,
            environment: getStripeEnvironment(),
          },
          { authToken: token },
        );

        if (!res.ok) {
          throw new Error(res.error || "Não foi possível agendar o cancelamento.");
        }

        toast.success(
          res.message || "Cancelamento agendado com sucesso para o final do ciclo atual.",
        );
      }

      setCancelDialogOpen(false);
      setCancelReason("");
      setCancelFeedback("");
      setCancelPreview(null);
      await refresh();
    } catch (err: unknown) {
      console.error("[Subscription] handleConfirmCancellation error:", err);
      const msg = err instanceof Error ? err.message : "Erro ao processar cancelamento.";
      if (msg.includes("mudou de R$") || msg.includes("confirme o novo valor")) {
        toast.info(
          "O valor do estorno foi atualizado com base no tempo decorrido. Por favor, revise e confirme o novo valor.",
        );
        // P2-01: Auto-refresh preview on value drift
        try {
          const {
            data: { session: authSession },
          } = await supabase.auth.getSession();
          if (authSession?.access_token) {
            const updatedPreview = await previewSubscriptionCancellation(
              { environment: getStripeEnvironment() },
              { authToken: authSession.access_token },
            );
            if (updatedPreview.ok) {
              setCancelPreview(updatedPreview);
            }
          }
        } catch (_refreshErr) {}
      } else {
        toast.error(msg);
      }
    } finally {
      setCancelingSubscription(false);
    }
  };

  const handleConfirmReactivation = async () => {
    if (reversingCancellation) return;
    setReversingCancellation(true);
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) throw new Error("Você precisa estar logado.");

      const res = await reactivateSubscription(
        {
          environment: getStripeEnvironment(),
        },
        { authToken: token },
      );

      if (!res.ok) {
        throw new Error(res.error || "Não foi possível reativar a assinatura.");
      }

      toast.success(res.message || "Assinatura mantida com sucesso! Renovação automática ativa.");
      setReactivateDialogOpen(false);
      await refresh();
    } catch (err: unknown) {
      console.error("[Subscription] handleConfirmReactivation error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao reativar assinatura.");
    } finally {
      setReversingCancellation(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
      return;
    }

    if (!authLoading && user && role === "super_admin") {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, authLoading, role, navigate]);

  if (authLoading || planLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    console.log("[Subscription] No user found after loading");
    return null;
  }

  // Valores comerciais reais dos planos (conforme tabela comercial autorizada).
  const planConfigs = [
    {
      id: "starter" as PlanType,
      name: "Starter",
      monthlyPrice: "59,90",
      yearlyPrice: "499,00",
      yearlyMonthlyEquivalent: "41,58",
      yearlySavings: "219,80",
      yearlySavingsPercent: "30%",
      description: "Para barbeiros autônomos e pequenas barbearias.",
      icon: <Zap className="text-amber-500 w-5 h-5" />,
      features: [
        "Até 3 barbeiros",
        "Até 300 clientes",
        "Até 15 serviços",
        "WhatsApp + Portal do cliente",
        "3 automações essenciais",
      ],
      highlight: false,
    },
    {
      id: "pro" as PlanType,
      name: "Pro",
      monthlyPrice: "99,90",
      yearlyPrice: "999,00",
      yearlyMonthlyEquivalent: "83,25",
      yearlySavings: "199,80",
      yearlySavingsPercent: "17%",
      description: "Recomendado para a maioria das barbearias.",
      icon: <Crown className="text-amber-500 w-5 h-5" />,
      features: [
        "Até 10 barbeiros · Clientes ilimitados",
        "Estoque, Loja, Cupons, Cashback, Fidelidade",
        "Assinaturas + Gateway de Pagamento",
        "Financeiro completo + Dashboard avançado",
        "8 automações inteligentes",
        "Suporte prioritário",
      ],
      highlight: true,
    },
    {
      id: "elite" as PlanType,
      name: "Elite",
      monthlyPrice: "149,90",
      yearlyPrice: "1.499,00",
      yearlyMonthlyEquivalent: "124,92",
      yearlySavings: "299,80",
      yearlySavingsPercent: "17%",
      description: "IA completa e escala ilimitada.",
      icon: <Rocket className="text-amber-500 w-5 h-5" />,
      features: [
        "Barbeiros e admins ilimitados",
        "12 IAs (Agendadora, Comercial, WhatsApp...)",
        "Automações ilimitadas",
        "API aberta + Integrações + White Label",
        "Prioridade máxima no suporte",
      ],
      highlight: false,
    },
  ];

  return (
    <AppLayout>
      <PaymentTestModeBanner />
      <div className="min-h-screen bg-[#05070d] text-white max-w-full overflow-x-hidden">
        <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          {/* HEADER */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start sm:items-center gap-4">
              <div className="shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 grid place-items-center shadow-[0_4px_20px_rgba(16,185,129,0.15)]">
                <CreditCard className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight break-words sm:truncate">
                  Minha Assinatura
                </h1>
                <p className="text-sm text-zinc-400 mt-1 break-words sm:truncate">
                  Gerencie seu plano e limites do sistema
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                onClick={() => setCompareOpen(true)}
                className="w-full sm:w-auto shrink-0 bg-[#0b0f17] border border-zinc-700 text-white hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/10 font-bold text-xs h-11 sm:h-9 rounded-[14px] sm:rounded-md px-3 transition-all"
              >
                <Scale className="w-3.5 h-3.5 mr-1.5" /> Ver Comparativo
              </Button>
              {(plan !== "free" || subscription?.stripe_customer_id || subscription?.status === "canceled" || lastContractedPlan) && !isInternalTesting && (
                <>
                  <Button
                    size="sm"
                    onClick={handleManageSubscription}
                    disabled={updating}
                    className="w-full sm:w-auto shrink-0 bg-[#0b0f17] border border-zinc-700 text-white hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/10 font-bold text-xs h-11 sm:h-9 rounded-[14px] sm:rounded-md px-3 transition-all"
                  >
                    {updating ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Histórico & Faturamento
                  </Button>
                  {subscription?.status === "active" && !subscription?.cancel_at_period_end && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenCancelDialog}
                      disabled={updating || cancelingSubscription}
                      className="w-full sm:w-auto shrink-0 border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/50 font-bold text-xs h-11 sm:h-9 rounded-[14px] sm:rounded-md px-3 transition-all"
                    >
                      Cancelar assinatura
                    </Button>
                  )}
                  {subscription?.status === "active" && subscription?.cancel_at_period_end && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReactivateDialogOpen(true)}
                      disabled={updating || reversingCancellation}
                      className="w-full sm:w-auto shrink-0 border-amber-500/40 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/60 font-bold text-xs h-11 sm:h-9 rounded-[14px] sm:rounded-md px-3 transition-all"
                    >
                      {reversingCancellation ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Desistir do cancelamento
                    </Button>
                  )}
                </>
              )}
            </div>
          </header>

          {/* Benefício administrativo (voucher permanente) — aparece só para tenants internos */}
          {isInternalTesting && billing && <BenefitCard ctx={billing} />}

          {/* Seus módulos adicionais */}
          <YourAddons />

          {/* Status Alerts */}
          {isError && (
            <div className="bg-[#0b0f17] border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_8px_28px_rgba(245,158,11,0.12)]">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 grid place-items-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Instabilidade na verificação do plano
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Não foi possível verificar seu plano no momento devido a uma instabilidade de conexão. Suas assinaturas não foram canceladas.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => refresh()}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          )}

          {!isError && isRestricted && (
            <div className="bg-[#0b0f17] border border-red-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_8px_28px_rgba(239,68,68,0.12)]">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-red-500/10 border border-red-500/20 grid place-items-center shrink-0">
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Sem plano ativo — Acesso operacional restrito
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {lastContractedPlan
                      ? `Seu último plano contratado foi ${lastContractedPlan === "starter" ? "Starter" : lastContractedPlan === "pro" ? "Pro" : "Elite"} (cancelado/reembolsado). As operações de agendamento e cadastro estão bloqueadas.`
                      : "Seu período de teste expirou. Escolha um plano abaixo para liberar o sistema para uso."}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  const el = document.getElementById("planos-disponiveis");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-[0_4px_16px_rgba(16,185,129,0.3)] whitespace-nowrap"
              >
                Contratar Novo Plano
              </Button>
            </div>
          )}

          {isTrial && !isRestricted && (
            <div className="bg-[#0b0f17] border border-sky-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_8px_28px_rgba(56,189,248,0.10)]">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-sky-500/10 border border-sky-500/20 grid place-items-center shrink-0">
                  <Clock className="h-5 w-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Seu período de teste expira em {trialDaysRemaining}{" "}
                    {trialDaysRemaining === 1 ? "dia" : "dias"}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Assine agora para continuar com todos os recursos Pro.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handlePlanChange("pro")}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-[0_4px_16px_rgba(16,185,129,0.3)] whitespace-nowrap"
              >
                Assinar Plano Pro
              </Button>
            </div>
          )}

          {isPortalReturn && (
            <StatusBanner
              tone="sky"
              icon={Clock}
              title="Estamos verificando a atualização da sua assinatura"
              desc="Se você realizou o pagamento ou atualizou seu cartão no Portal Stripe, o processamento pode levar alguns instantes. Clique para checar novamente."
            >
              <Button
                size="sm"
                disabled={refreshingStatus}
                onClick={handleManualRefresh}
                className="bg-sky-500 hover:bg-sky-400 text-black font-bold"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", refreshingStatus && "animate-spin")} />
                Atualizar status
              </Button>
            </StatusBanner>
          )}

          {subscription?.status === "active" && subscription?.cancel_at_period_end && (
            <StatusBanner
              tone="amber"
              icon={Clock}
              title="Cancelamento Agendado"
              desc={`Sua assinatura continuará ativa até ${
                subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR")
                  : "o término do ciclo atual"
              }. Após esse período, o acesso aos recursos contratados será encerrado e o plano retornará para o Grátis. Nenhuma renovação automática será realizada.`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={reversingCancellation}
                  onClick={() => setReactivateDialogOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                >
                  {reversingCancellation ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Desistir do cancelamento
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={refreshingStatus}
                  onClick={handleManualRefresh}
                  className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white text-xs"
                >
                  <RefreshCw
                    className={cn("w-3.5 h-3.5 mr-1.5", refreshingStatus && "animate-spin")}
                  />
                  Atualizar status
                </Button>
              </div>
            </StatusBanner>
          )}

          {subscription?.status === "past_due" && delinquency?.isInGrace && (
            <StatusBanner
              tone="amber"
              icon={AlertTriangle}
              title="Pagamento Pendente — Período de Regularização Ativo"
              desc={`Não foi possível renovar sua assinatura. Seu acesso continua disponível até ${delinquency.deadlineDisplay || "o prazo limite"} (horário de Brasília). Regularize o pagamento para evitar a interrupção dos recursos do seu plano.`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {delinquency.countdownDisplay && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {delinquency.countdownDisplay}
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={handleManageSubscription}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold"
                >
                  <CreditCard className="w-4 h-4 mr-2" /> Regularizar no Portal Stripe
                </Button>
              </div>
            </StatusBanner>
          )}

          {subscription?.status === "past_due" && delinquency?.isGraceExpired && (
            <StatusBanner
              tone="red"
              icon={ShieldAlert}
              title="Assinatura Pendente — Período de Carência Encerrado"
              desc={`O prazo de regularização terminou${delinquency.deadlineDisplay ? ` em ${delinquency.deadlineDisplay}` : ""}. Os recursos do plano estão temporariamente indisponíveis. Regularize seu pagamento para restaurar o acesso.`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleManageSubscription}
                  className="bg-red-500 hover:bg-red-400 text-white font-bold"
                >
                  <CreditCard className="w-4 h-4 mr-2" /> Regularizar no Portal Stripe
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={refreshingStatus}
                  onClick={handleManualRefresh}
                  className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white"
                >
                  <RefreshCw className={cn("w-4 h-4 mr-1.5", refreshingStatus && "animate-spin")} />
                  Atualizar status
                </Button>
              </div>
            </StatusBanner>
          )}
          {subscription?.status === "unpaid" && (
            <StatusBanner
              tone="red"
              icon={ShieldAlert}
              title="Assinatura Suspensa"
              desc="Sua assinatura está inativa por falhas recorrentes. Recursos premium bloqueados."
            >
              <Button
                size="sm"
                onClick={handleManageSubscription}
                className="bg-red-500 hover:bg-red-400 text-white font-bold"
              >
                Regularizar Agora
              </Button>
            </StatusBanner>
          )}
          {subscription?.status === "canceled" && (
            <StatusBanner
              tone="zinc"
              icon={AlertCircle}
              title="Assinatura Cancelada"
              desc={
                lastContractedPlan
                  ? `Sua assinatura anterior do plano ${
                      lastContractedPlan === "starter"
                        ? "Starter"
                        : lastContractedPlan === "pro"
                          ? "Pro"
                          : "Elite"
                    } foi cancelada. Escolha um novo plano abaixo.`
                  : "Sua assinatura anterior foi cancelada. Escolha um novo plano abaixo."
              }
            />
          )}
          {subscription?.status === "incomplete" && (
            <StatusBanner
              tone="sky"
              icon={Loader2}
              title="Checkout Pendente"
              desc="Você tem uma assinatura que ainda não foi concluída. Finalize o pagamento."
            >
              <Button
                size="sm"
                onClick={handleManageSubscription}
                className="bg-sky-500 hover:bg-sky-400 text-white font-bold"
              >
                Finalizar Pagamento
              </Button>
            </StatusBanner>
          )}

          {/* PLANO ATUAL */}
          <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-5 md:p-6 shadow-[0_8px_28px_rgba(16,185,129,0.08)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-5 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-11 w-11 rounded-xl grid place-items-center shrink-0 border",
                    isRestricted
                      ? "bg-red-500/10 border-red-500/20 text-red-400"
                      : operationalState === "VOUCHER_ACTIVE"
                        ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                        : isTrial
                          ? "bg-sky-500/10 border-sky-500/20 text-sky-400"
                          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                  )}
                >
                  {isRestricted ? (
                    <ShieldAlert className="h-5 w-5 text-red-400" />
                  ) : operationalState === "VOUCHER_ACTIVE" ? (
                    <Crown className="h-5 w-5 text-purple-400" />
                  ) : plan === "elite" || (plan as any) === "enterprise" ? (
                    <Rocket className="h-5 w-5 text-emerald-400" />
                  ) : plan === "pro" || (plan as any) === "professional" ? (
                    <Crown className="h-5 w-5 text-emerald-400" />
                  ) : plan === "starter" ? (
                    <Zap className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Star className="h-5 w-5 text-emerald-400" />
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    {isRestricted
                      ? "Situação do Estabelecimento"
                      : operationalState === "VOUCHER_ACTIVE"
                        ? "Plano Concedido"
                        : "Plano Atual"}
                  </div>
                  <div className="text-xl font-black text-white">
                    {isRestricted
                      ? "Sem plano ativo"
                      : operationalState === "VOUCHER_ACTIVE"
                        ? "Elite (Voucher)"
                        : isTrial
                          ? "Trial Pro"
                          : plan === "starter"
                            ? "Starter"
                            : plan === "pro" || (plan as any) === "professional"
                              ? "Pro"
                              : plan === "elite" || (plan as any) === "enterprise"
                                ? "Elite"
                                : !plan || plan === "free"
                                  ? "Grátis"
                                  : plan}
                  </div>
                  {isRestricted && lastContractedPlan && (
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Último plano contratado:{" "}
                      <span className="font-semibold text-zinc-300">
                        {lastContractedPlan === "starter"
                          ? "Starter"
                          : lastContractedPlan === "pro"
                            ? "Pro"
                            : "Elite"}
                      </span>{" "}
                      (Cancelado)
                    </div>
                  )}
                  {operationalState === "VOUCHER_ACTIVE" && (
                    <div className="text-xs text-purple-300/80 mt-0.5">
                      Acesso permanente concedido por voucher institucional
                    </div>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "w-full sm:w-auto h-[34px] sm:h-auto px-3 py-1.5 rounded-xl sm:rounded-lg border text-[10px] font-black uppercase tracking-widest grid place-items-center text-center",
                  isRestricted
                    ? "bg-red-500/10 text-red-400 border-red-500/30"
                    : operationalState === "VOUCHER_ACTIVE"
                      ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                      : subscription?.status === "active" && subscription?.cancel_at_period_end
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : subscription?.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : isTrial
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                            : subscription?.status === "past_due"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : subscription?.status === "unpaid"
                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
                )}
              >
                {isRestricted
                  ? "Acesso Restrito"
                  : operationalState === "VOUCHER_ACTIVE"
                    ? "Voucher Ativo"
                    : subscription?.status === "active" && subscription?.cancel_at_period_end
                      ? "Cancelamento Agendado"
                      : subscription?.status === "active"
                        ? "Assinatura Ativa"
                        : isTrial
                          ? "Período de Teste"
                          : subscription?.status === "past_due"
                            ? "Pagamento Pendente"
                            : subscription?.status === "unpaid"
                              ? "Inadimplente"
                              : "Plano Gratuito"}
              </div>
            </div>

            <div className="grid gap-3 grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-5">
              <UsageBar
                label="Profissionais"
                used={usage?.barbers ?? 0}
                limit={limits?.barbers}
                isRestricted={isRestricted}
              />
              <UsageBar
                label="Serviços"
                used={usage?.services ?? 0}
                limit={limits?.services}
                isRestricted={isRestricted}
              />
              <UsageBar
                label="Produtos"
                used={usage?.products ?? 0}
                limit={limits?.products}
                isRestricted={isRestricted}
              />
              <UsageBar
                label="Agendamentos"
                used={usage?.monthlyAppointments ?? 0}
                limit={limits?.monthlyAppointments}
                isRestricted={isRestricted}
              />
              <UsageBar
                label="WhatsApp"
                used={usage?.whatsappConnections ?? 0}
                limit={limits?.whatsappConnections}
                isRestricted={isRestricted}
              />
            </div>
          </div>

          {/* PLANOS DISPONÍVEIS */}
          <div id="planos-disponiveis" className="pt-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-zinc-800" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Planos Disponíveis
              </span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            {/* SELETOR DE CICLO: MENSAL vs ANUAL */}
            <div className="flex justify-center my-6">
              <div className="inline-flex items-center p-1.5 rounded-xl bg-[#0b0f17] border border-zinc-800 shadow-lg">
                <button
                  type="button"
                  onClick={() => setBillingCycle("month")}
                  className={cn(
                    "px-5 py-2.5 rounded-lg text-xs font-bold transition-all",
                    billingCycle === "month"
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20"
                      : "text-zinc-400 hover:text-white",
                  )}
                >
                  Cobrança Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("year")}
                  className={cn(
                    "px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                    billingCycle === "year"
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20"
                      : "text-zinc-400 hover:text-white",
                  )}
                >
                  <span>Cobrança Anual</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                    Até 30% OFF
                  </span>
                </button>
              </div>
            </div>

            <div className="grid gap-5 grid-cols-1 md:grid-cols-3 pt-2">
              {planConfigs.map((config) => {
                let isCurrentPlan = false;
                let isUpgrade = false;
                try {
                  const currentPlanIndex = planConfigs.findIndex((c) => c.id === plan);
                  const configIndex = planConfigs.findIndex((c) => c.id === config.id);
                  isCurrentPlan = plan === config.id;
                  isUpgrade = currentPlanIndex < configIndex;
                } catch {}
                const Icon = config.id === "starter" ? Zap : config.id === "pro" ? Crown : Rocket;

                return (
                  <div
                    key={config.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1",
                      isCurrentPlan
                        ? "bg-gradient-to-b from-emerald-500/10 to-[#0b0f17] border-2 border-emerald-500/50 shadow-[0_8px_32px_rgba(16,185,129,0.25)]"
                        : "bg-[#0b0f17] border border-zinc-800/80 hover:border-emerald-500/30 hover:shadow-[0_8px_28px_rgba(16,185,129,0.12)]",
                    )}
                  >
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-[0_4px_16px_rgba(16,185,129,0.4)] whitespace-nowrap">
                        Plano Atual
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                          Plano
                        </div>
                        <h3 className="text-2xl font-black tracking-tight text-white">
                          {config.name}
                        </h3>
                      </div>
                      <div
                        className={cn(
                          "h-11 w-11 rounded-xl grid place-items-center border",
                          isCurrentPlan
                            ? "bg-emerald-500/15 border-emerald-500/30"
                            : "bg-zinc-800/50 border-zinc-700/50",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            isCurrentPlan ? "text-emerald-400" : "text-zinc-400",
                          )}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 min-h-[32px]">{config.description}</p>

                    <div className="my-5 py-4 border-y border-zinc-800/80">
                      {billingCycle === "year" ? (
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs text-zinc-500 font-bold">R$</span>
                            <span className="text-4xl font-black tracking-tight text-white">
                              {config.yearlyPrice}
                            </span>
                            <span className="text-xs text-emerald-400 font-bold ml-1">/ano</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1.5 flex flex-wrap items-center gap-1">
                            <span>Equivalente a R$ {config.yearlyMonthlyEquivalent}/mês</span>
                            <span className="text-emerald-400 font-semibold">
                              · Economia de R$ {config.yearlySavings}/ano
                            </span>
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs text-zinc-500 font-bold">R$</span>
                          <span className="text-4xl font-black tracking-tight text-white">
                            {config.monthlyPrice}
                          </span>
                          <span className="text-xs text-zinc-500 font-bold ml-1">/mês</span>
                        </div>
                      )}
                    </div>

                    <ul className="space-y-2.5 flex-1 mb-5">
                      {config.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                          <div
                            className={cn(
                              "h-4 w-4 rounded-full grid place-items-center mt-0.5 shrink-0",
                              isCurrentPlan ? "bg-emerald-500/20" : "bg-zinc-800",
                            )}
                          >
                            <Check
                              className={cn(
                                "w-2.5 h-2.5",
                                isCurrentPlan ? "text-emerald-400" : "text-zinc-400",
                              )}
                            />
                          </div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      disabled={isCurrentPlan || updating}
                      onClick={() => requestPlanChange(config.id)}
                      className={cn(
                        "w-full h-11 rounded-xl font-bold text-sm transition-all",
                        isCurrentPlan
                          ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-100 cursor-default"
                          : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-[0_4px_16px_rgba(16,185,129,0.3)]",
                      )}
                    >
                      {updating && !isCurrentPlan ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      {isCurrentPlan
                        ? "✓ Plano Ativo"
                        : isUpgrade
                          ? `Fazer Upgrade para ${config.name}`
                          : `Fazer Downgrade para ${config.name}`}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* PLANO PERSONALIZADO */}
            <div className="mt-8 p-6 md:p-7 rounded-2xl bg-gradient-to-br from-zinc-900 via-[#0b0f17] to-zinc-950 border border-zinc-700/60 hover:border-emerald-500/40 transition-all flex flex-col md:flex-row items-start md:items-center gap-5">
              <div className="flex-1">
                <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 uppercase tracking-widest mb-2">
                  Serviço Premium
                </span>
                <h3 className="text-xl md:text-2xl font-black text-white mb-1.5">
                  Plano Personalizado
                </h3>
                <p className="text-sm text-zinc-400 mb-3">
                  Sua barbearia tem necessidades específicas? Montamos um plano exclusivo com
                  desenvolvimento, integrações, APIs, consultoria, migração, treinamentos, módulos e
                  automações sob medida.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Consultoria",
                    "Integrações",
                    "API dedicada",
                    "Treinamentos",
                    "Módulos exclusivos",
                    "Migração",
                  ].map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 font-bold"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <a
                href={personalizadoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-auto"
              >
                <Button className="w-full md:w-auto h-11 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-[0_4px_16px_rgba(16,185,129,0.35)] whitespace-nowrap">
                  Solicitar Orçamento
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CHECKOUT STRIPE EMBEDDED REFINADO */}
      <SubscriptionCheckoutModal
        open={isOpen}
        onClose={closeCheckout}
        options={options}
        checkoutElement={checkoutElement}
      />

      {/* COMPARATIVO DE PLANOS */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-[#0b0f17] border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Scale className="h-5 w-5 text-emerald-400" /> Comparativo de Planos
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-3 font-bold text-zinc-400 text-xs uppercase tracking-wider">
                    Recurso
                  </th>
                  <th className="text-center py-3 px-3 font-black text-white">Starter</th>
                  <th className="text-center py-3 px-3 font-black text-emerald-400">Pro</th>
                  <th className="text-center py-3 px-3 font-black text-white">Elite</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:border-zinc-800/60">
                <tr>
                  <td className="py-3 px-3 text-zinc-300 font-semibold">Preço mensal</td>
                  <td className="text-center font-bold">R$ 59,90</td>
                  <td className="text-center font-black text-emerald-400 bg-emerald-500/5">
                    R$ 99,90
                  </td>
                  <td className="text-center font-bold">R$ 149,90</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Agenda Online</td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Profissionais</td>
                  <td className="text-center">3</td>
                  <td className="text-center text-emerald-400 font-bold bg-emerald-500/5">10</td>
                  <td className="text-center">∞</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Clientes</td>
                  <td className="text-center">300</td>
                  <td className="text-center text-emerald-400 bg-emerald-500/5">∞</td>
                  <td className="text-center">∞</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Serviços</td>
                  <td className="text-center">15</td>
                  <td className="text-center text-emerald-400 bg-emerald-500/5">∞</td>
                  <td className="text-center">∞</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Administradores</td>
                  <td className="text-center">1</td>
                  <td className="text-center text-emerald-400 bg-emerald-500/5">3</td>
                  <td className="text-center">∞</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Portal do Cliente</td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">WhatsApp</td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300 font-semibold">
                    Quantidade de automações
                  </td>
                  <td className="text-center font-bold">3</td>
                  <td className="text-center text-emerald-400 font-black bg-emerald-500/5">8</td>
                  <td className="text-center font-bold">∞ + IA</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Financeiro</td>
                  <td className="text-center text-xs">Básico</td>
                  <td className="text-center text-emerald-400 font-bold bg-emerald-500/5 text-xs">
                    Completo
                  </td>
                  <td className="text-center text-xs">Premium</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Relatórios</td>
                  <td className="text-center text-xs">Básicos</td>
                  <td className="text-center text-emerald-400 font-bold bg-emerald-500/5 text-xs">
                    Avançados
                  </td>
                  <td className="text-center text-xs">Corporativos</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Estoque</td>
                  <td className="text-center">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Loja Virtual</td>
                  <td className="text-center">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Assinaturas</td>
                  <td className="text-center">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Gateway de Pagamento</td>
                  <td className="text-center">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Cashback</td>
                  <td className="text-center">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Fidelidade</td>
                  <td className="text-center">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300 font-semibold">Inteligência Artificial</td>
                  <td className="text-center">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center font-bold text-emerald-400">12 IAs</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">API aberta</td>
                  <td className="text-center">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Integrações</td>
                  <td className="text-center">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">White Label</td>
                  <td className="text-center">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center bg-emerald-500/5">
                    <X className="inline w-4 h-4 text-zinc-600" />
                  </td>
                  <td className="text-center">
                    <Check className="inline w-4 h-4 text-emerald-400" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-zinc-300">Suporte</td>
                  <td className="text-center text-xs">Padrão</td>
                  <td className="text-center text-emerald-400 font-bold bg-emerald-500/5 text-xs">
                    Prioritário
                  </td>
                  <td className="text-center text-xs">Máxima Prioridade</td>
                </tr>
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* DOWNGRADE CONFIRMATION */}
      <AlertDialog
        open={!!downgradeTarget}
        onOpenChange={(o) => {
          if (!o) setDowngradeTarget(null);
        }}
      >
        <AlertDialogContent className="bg-[#0b0f17] border-amber-500/30 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <ArrowDownCircle className="h-5 w-5 text-amber-400" />
              Confirmar Downgrade
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 space-y-3">
              <span className="block">
                Você está prestes a mudar para um plano inferior ({downgradeTarget?.toUpperCase()}).
                Ao confirmar, você perderá acesso aos seguintes recursos:
              </span>
              <ul className="list-disc list-inside text-amber-300/90 space-y-1 text-sm">
                {downgradeTarget === "starter" && (
                  <>
                    <li>Financeiro completo, comissões e fechamentos</li>
                    <li>Automações de WhatsApp e campanhas</li>
                    <li>Programa de fidelidade</li>
                    <li>Múltiplos profissionais (limite de 3 profissionais)</li>
                    <li>Relatórios avançados</li>
                  </>
                )}
                {downgradeTarget === "pro" && (
                  <>
                    <li>Clube de assinaturas / planos recorrentes para clientes</li>
                    <li>Profissionais ilimitados (limite de {PLAN_LIMITS.pro.barbers})</li>
                    <li>Conexões WhatsApp ilimitadas (limite de 2)</li>
                    <li>Suporte prioritário</li>
                  </>
                )}
              </ul>
              <span className="block text-xs text-zinc-500">
                Dados existentes não serão apagados, mas funcionalidades premium ficarão bloqueadas.
              </span>
              <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="text-xs font-semibold text-emerald-300">
                  Alternativa: manter recursos como módulos adicionais
                </div>
                <p className="text-[11px] text-emerald-200/70 mt-1">
                  Você pode continuar usando os recursos acima contratando-os individualmente como
                  add-ons no plano inferior.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                  onClick={() => {
                    setDowngradeTarget(null);
                    navigate({ to: "/subscription/addons" });
                  }}
                >
                  Ver catálogo de add-ons
                </Button>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-zinc-700 text-white hover:bg-zinc-800 hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = downgradeTarget;
                setDowngradeTarget(null);
                if (target) handlePlanChange(target);
              }}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold"
            >
              Confirmar Downgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL DE CONFIRMAÇÃO DE CANCELAMENTO E REEMBOLSO */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-[#0b0f17] border-red-500/30 text-white max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Cancelar sua assinatura
            </DialogTitle>
          </DialogHeader>

          {loadingPreview ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-xs font-medium">Calculando opções de estorno e elegibilidade...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cancelPreview?.self_service_allowed === false && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold block text-white">
                      Estorno por autoatendimento não disponível
                    </span>
                    <p className="text-zinc-300">
                      {cancelPreview.self_service_disabled_reason ||
                        "O cancelamento com estorno automático está em liberação gradual ou requer atendimento assistido."}
                    </p>
                    <p className="text-[11px] text-amber-400/90 font-medium">
                      Você pode cancelar a renovação ao término do período abaixo (sem novas
                      cobranças) ou contatar o suporte para estorno financeiro.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-zinc-400">
                Selecione uma das modalidades disponíveis abaixo de acordo com a política comercial
                e o Código de Defesa do Consumidor:
              </p>

              {/* OPÇÕES DISPONÍVEIS */}
              <div className="space-y-3">
                {/* MODALIDADE A: DIREITO DE ARREPENDIMENTO (CDC ART. 49) */}
                {cancelPreview?.self_service_allowed !== false &&
                  cancelPreview?.cooling_off?.eligible && (
                    <div
                      onClick={() => setSelectedCancelMode("cooling_off")}
                      className={cn(
                        "p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-2",
                        selectedCancelMode === "cooling_off"
                          ? "border-emerald-500 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                          : "border-zinc-800 bg-[#05070d] hover:border-zinc-700",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="cancel_mode"
                            checked={selectedCancelMode === "cooling_off"}
                            onChange={() => setSelectedCancelMode("cooling_off")}
                            className="text-emerald-500 focus:ring-emerald-500"
                          />
                          <span className="font-bold text-sm text-white">
                            Direito de Arrependimento (CDC Art. 49)
                          </span>
                        </div>
                        <Badge variant="success" className="text-[10px] font-bold">
                          100% de Reembolso
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-400 pl-5">
                        Você está dentro dos primeiros 7 dias da contratação. Receba devolução
                        integral de{" "}
                        <strong className="text-emerald-400">
                          R${" "}
                          {((cancelPreview.cooling_off.estimated_refund_cents || 0) / 100)
                            .toFixed(2)
                            .replace(".", ",")}
                        </strong>
                        . O acesso pago será encerrado imediatamente.
                      </p>
                    </div>
                  )}

                {/* MODALIDADE B: CANCELAMENTO IMEDIATO PROPORCIONAL */}
                {cancelPreview?.self_service_allowed !== false &&
                  cancelPreview?.proportional?.eligible && (
                    <div
                      onClick={() => setSelectedCancelMode("proportional")}
                      className={cn(
                        "p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-2",
                        selectedCancelMode === "proportional"
                          ? "border-sky-500 bg-sky-950/20 shadow-[0_0_15px_rgba(14,165,233,0.15)]"
                          : "border-zinc-800 bg-[#05070d] hover:border-zinc-700",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="cancel_mode"
                            checked={selectedCancelMode === "proportional"}
                            onChange={() => setSelectedCancelMode("proportional")}
                            className="text-sky-500 focus:ring-sky-500"
                          />
                          <span className="font-bold text-sm text-white">
                            Cancelar agora com reembolso proporcional
                          </span>
                        </div>
                        <Badge variant="info" className="text-[10px] font-bold">
                          Pro-rata restante
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-400 pl-5">
                        Devolução estimada de{" "}
                        <strong className="text-sky-400">
                          R${" "}
                          {((cancelPreview.proportional.estimated_refund_cents || 0) / 100)
                            .toFixed(2)
                            .replace(".", ",")}
                        </strong>{" "}
                        referente aos dias não utilizados deste ciclo. O acesso aos recursos pagos
                        será encerrado imediatamente.
                      </p>
                    </div>
                  )}

                {/* MODALIDADE C: CANCELAR AO TÉRMINO DO CICLO ATUAL */}
                <div
                  onClick={() => setSelectedCancelMode("period_end")}
                  className={cn(
                    "p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-2",
                    selectedCancelMode === "period_end"
                      ? "border-amber-500 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                      : "border-zinc-800 bg-[#05070d] hover:border-zinc-700",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="cancel_mode"
                        checked={selectedCancelMode === "period_end"}
                        onChange={() => setSelectedCancelMode("period_end")}
                        className="text-amber-500 focus:ring-amber-500"
                      />
                      <span className="font-bold text-sm text-white">
                        Cancelar apenas a próxima renovação
                      </span>
                    </div>
                    <Badge variant="warning" className="text-[10px] font-bold">
                      Sem Reembolso
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 pl-5">
                    Você continuará com acesso total aos recursos do plano até{" "}
                    <strong className="text-amber-400">
                      {subscription?.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR")
                        : "o final do ciclo"}
                    </strong>
                    . Não haverá nenhuma nova cobrança ou renovação automática.
                  </p>
                </div>
              </div>

              {/* RESUMO DA MODALIDADE SELECIONADA */}
              <div className="rounded-xl border border-zinc-800 bg-[#05070d] p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Modalidade Selecionada:</span>
                  <span className="font-bold text-white">
                    {selectedCancelMode === "cooling_off"
                      ? "Direito de Arrependimento (Integral)"
                      : selectedCancelMode === "proportional"
                        ? "Cancelamento Imediato Proporcional"
                        : "Cancelamento ao Fim do Período"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Valor Estimado do Estorno:</span>
                  <span className="font-bold text-emerald-400">
                    {selectedCancelMode === "cooling_off"
                      ? `R$ ${((cancelPreview?.cooling_off?.estimated_refund_cents || 0) / 100).toFixed(2).replace(".", ",")}`
                      : selectedCancelMode === "proportional"
                        ? `R$ ${((cancelPreview?.proportional?.estimated_refund_cents || 0) / 100).toFixed(2).replace(".", ",")}`
                        : "R$ 0,00"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Término do Acesso Pago:</span>
                  <span className="font-bold text-amber-400">
                    {selectedCancelMode === "period_end"
                      ? subscription?.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR")
                        : "Final do ciclo vigente"
                      : "Imediato (ao confirmar)"}
                  </span>
                </div>
                <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-400">
                  🔒 <strong className="text-zinc-300">Dados seguros:</strong> Clientes,
                  agendamentos e profissionais cadastrados continuarão preservados no seu
                  estabelecimento.
                </div>
              </div>

              {/* MOTIVO OPCIONAL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Qual o motivo do cancelamento? (opcional)
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-[#05070d] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                >
                  <option value="">Selecione um motivo...</option>
                  <option value="arrependimento_legal">Arrependimento da contratação</option>
                  <option value="custo">Custo da mensalidade</option>
                  <option value="pouco_uso">Pouco uso dos recursos</option>
                  <option value="migracao">Migrando para outro sistema</option>
                  <option value="fechou_estabelecimento">Fechamento do estabelecimento</option>
                  <option value="dificuldade_uso">Dificuldade de configuração/uso</option>
                  <option value="outro">Outro motivo</option>
                </select>
              </div>

              {/* FEEDBACK ADICIONAL OPCIONAL */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">
                  Como podemos melhorar? (opcional)
                </label>
                <textarea
                  value={cancelFeedback}
                  onChange={(e) => setCancelFeedback(e.target.value)}
                  placeholder="Conte-nos o que faltou ou como poderíamos te atender melhor..."
                  rows={2}
                  className="w-full bg-[#05070d] border border-zinc-800 rounded-lg p-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50 resize-none"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelingSubscription}
              className="bg-transparent border-zinc-700 text-white hover:bg-zinc-800 text-xs"
            >
              Manter assinatura
            </Button>
            <Button
              onClick={handleConfirmCancellation}
              disabled={cancelingSubscription || loadingPreview}
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
            >
              {cancelingSubscription ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Processando cancelamento...
                </>
              ) : (
                "Confirmar cancelamento"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE REVERSÃO / DESISTÊNCIA */}
      <AlertDialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <AlertDialogContent className="bg-[#0b0f17] border-emerald-500/30 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <RefreshCw className="h-5 w-5 text-emerald-400" />
              Manter sua assinatura ativa?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 space-y-2">
              <span className="block">
                Ao desistir do cancelamento, o agendamento de término será removido e sua assinatura
                continuará normalmente com renovação automática no final do ciclo.
              </span>
              <span className="block text-xs text-emerald-400/90 font-medium">
                Você manterá acesso contínuo a todos os recursos do plano {plan?.toUpperCase()} sem
                interrupções.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={reversingCancellation}
              className="bg-transparent border-zinc-700 text-white hover:bg-zinc-800 hover:text-white text-xs"
            >
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReactivation}
              disabled={reversingCancellation}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs"
            >
              {reversingCancellation ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Revertendo...
                </>
              ) : (
                "Confirmar e Manter Assinatura"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function StatusBanner({
  tone,
  icon: Icon,
  title,
  desc,
  children,
}: {
  tone: "amber" | "red" | "zinc" | "sky";
  icon: any;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  const map = {
    amber: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      glow: "shadow-[0_8px_28px_rgba(245,158,11,0.10)]",
    },
    red: {
      border: "border-red-500/30",
      bg: "bg-red-500/10",
      text: "text-red-400",
      glow: "shadow-[0_8px_28px_rgba(239,68,68,0.10)]",
    },
    zinc: { border: "border-zinc-700/60", bg: "bg-zinc-500/10", text: "text-zinc-400", glow: "" },
    sky: {
      border: "border-sky-500/30",
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      glow: "shadow-[0_8px_28px_rgba(56,189,248,0.10)]",
    },
  }[tone];
  return (
    <div
      className={cn(
        "bg-[#0b0f17] border rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4",
        map.border,
        map.glow,
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "h-11 w-11 rounded-xl grid place-items-center shrink-0 border",
            map.bg,
            map.border,
          )}
        >
          <Icon className={cn("h-5 w-5", map.text)} />
        </div>
        <div>
          <h3 className="text-base font-black text-white">{title}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function UsageBar({
  label,
  used,
  limit,
  isRestricted,
}: {
  label: string;
  used: number;
  limit: number | undefined;
  isRestricted?: boolean;
}) {
  const isInf = limit === Infinity;
  const isZero = limit === 0 || isRestricted;
  const max = isInf ? 100 : (limit ?? 0);
  const pct = isInf ? 100 : isZero ? 100 : Math.min((used / (max || 1)) * 100, 100);
  return (
    <div
      className={cn(
        "bg-[#05070d]/60 border rounded-2xl min-h-[92px] p-[14px] flex flex-col justify-between transition-colors",
        isZero ? "border-red-500/20 bg-red-950/10" : "border-zinc-800/60",
      )}
    >
      <div className="flex justify-between items-baseline mb-2 gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 truncate">
          {label}
        </span>
        <span
          className={cn(
            "text-xs font-black whitespace-nowrap shrink-0",
            isZero ? "text-red-400 font-bold" : "text-emerald-400",
          )}
        >
          {isZero ? `${used} (Restrito)` : `${used} / ${isInf ? "∞" : max}`}
        </span>
      </div>
      <Progress
        value={pct}
        className={cn(
          "h-1.5 bg-zinc-800",
          isZero
            ? "[&>div]:bg-red-500/80"
            : "[&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-emerald-400",
        )}
      />
    </div>
  );
}
