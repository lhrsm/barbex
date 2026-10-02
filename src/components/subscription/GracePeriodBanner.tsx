import { useState } from "react";
import { AlertTriangle, Clock, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { canManageBilling } from "@/lib/delinquency";
import { createPortalSession } from "@/lib/backend/edge/stripe";
import { getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function GracePeriodBanner() {
  const { delinquency } = usePlanLimits();
  const { role } = useAuth();
  const { isImpersonating } = useTenant();
  const [loading, setLoading] = useState(false);

  // Render ONLY for canonical IN_GRACE status
  if (!delinquency || !delinquency.isInGrace) {
    return null;
  }

  const isAuthorized = canManageBilling(role, isImpersonating);

  const handleRegularizePayment = async () => {
    if (!isAuthorized) {
      toast.error("Apenas administradores e proprietários podem regularizar a assinatura.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const token = authSession?.access_token;

      if (!token) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const returnUrl = `${window.location.origin}/subscription?portal_return=true`;
      const res = await createPortalSession(
        {
          returnUrl,
          environment: getStripeEnvironment(),
        },
        {
          authToken: token,
        },
      );

      if (!res.ok || !res.url) {
        throw new Error(
          res.error ||
            "Não foi possível abrir o portal de pagamento no momento. Tente novamente em instantes.",
        );
      }

      window.location.href = res.url;
    } catch (err: unknown) {
      console.error("[GracePeriodBanner] Erro ao abrir portal Stripe:", err);
      toast.error(
        (err as Error)?.message ||
          "Não foi possível abrir a página de pagamento agora. Tente novamente em alguns instantes ou entre em contato com o suporte.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-transparent border border-amber-500/30 rounded-2xl p-4 md:p-5 shadow-[0_4px_20px_rgba(245,158,11,0.08)] backdrop-blur-sm"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black text-amber-400 uppercase tracking-wider">
                Aviso de Pagamento
              </span>
              {delinquency.countdownDisplay && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {delinquency.countdownDisplay}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
              Não foi possível renovar sua assinatura. Seu acesso continua disponível até{" "}
              <strong className="text-amber-300 font-bold">
                {delinquency.deadlineDisplay || "o prazo limite"}
              </strong>{" "}
              (horário de Brasília). Regularize o pagamento para evitar a interrupção dos recursos
              do seu plano.
            </p>

            {!isAuthorized && (
              <p className="text-xs text-zinc-400 italic">
                Entre em contato com o administrador da barbearia para regularizar a assinatura.
              </p>
            )}
          </div>
        </div>

        {isAuthorized && (
          <div className="shrink-0 w-full sm:w-auto">
            <Button
              onClick={handleRegularizePayment}
              disabled={loading}
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider h-10 px-5 rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Abrindo Portal...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Regularizar pagamento
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
