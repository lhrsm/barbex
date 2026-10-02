import { useState } from "react";
import { AlertCircle, CreditCard, Headset, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link, useNavigate } from "@tanstack/react-router";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { canManageBilling } from "@/lib/delinquency";
import { createPortalSession } from "@/lib/backend/edge/stripe";
import { getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function GraceExpiredBlock({ onLogout }: { onLogout?: () => Promise<void> | void }) {
  const { delinquency } = usePlanLimits();
  const { role } = useAuth();
  const { isImpersonating } = useTenant();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const navigate = useNavigate();

  const isAuthorized = canManageBilling(role, isImpersonating);

  const handleRegularizePayment = async () => {
    if (!isAuthorized) {
      toast.error("Apenas administradores e proprietários podem regularizar a assinatura.");
      return;
    }

    setLoadingPortal(true);
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
      console.error("[GraceExpiredBlock] Erro ao abrir portal Stripe:", err);
      toast.error(
        (err as Error)?.message ||
          "Não foi possível abrir a página de pagamento agora. Tente novamente em alguns instantes ou entre em contato com o suporte.",
      );
    } finally {
      setLoadingPortal(false);
    }
  };

  const defaultLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[GraceExpiredBlock] Logout error:", err);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      navigate({ to: "/auth" });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="grace-expired-title"
      className="fixed inset-0 z-[9999] bg-[#05070d]/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <Card className="max-w-lg w-full border-2 border-red-500/25 bg-[#0b0f17] shadow-2xl rounded-2xl text-white">
        <CardHeader className="text-center space-y-4 pt-8">
          <div className="mx-auto bg-red-500/10 border border-red-500/20 w-16 h-16 rounded-2xl flex items-center justify-center text-red-400">
            <AlertCircle className="w-8 h-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
              Pagamento Pendente
            </div>
            <CardTitle
              id="grace-expired-title"
              className="text-2xl sm:text-3xl font-black tracking-tight text-white"
            >
              Acesso ao Plano Temporariamente Interrompido
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-zinc-400 max-w-md mx-auto leading-relaxed">
              O período de regularização da sua assinatura terminou
              {delinquency?.deadlineDisplay ? ` em ${delinquency.deadlineDisplay}` : ""}. Os
              recursos do seu plano estão temporariamente indisponíveis.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-6 sm:px-8">
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-white/5 space-y-2 text-xs sm:text-sm text-zinc-300">
            <p className="font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
              Seus dados continuam 100% seguros
            </p>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Clientes, agendamentos e histórico estão preservados. Regularize o pagamento para
              restaurar o acesso imediato a todas as funcionalidades.
            </p>
          </div>

          {!isAuthorized && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-xs text-amber-200">
              Entre em contato com o proprietário ou administrador da barbearia para regularizar a
              assinatura.
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-6 sm:px-8 pb-8 pt-2">
          {isAuthorized ? (
            <Button
              onClick={handleRegularizePayment}
              disabled={loadingPortal}
              className="w-full h-12 text-sm sm:text-base font-black uppercase tracking-wider bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-lg shadow-red-500/20 rounded-xl active:scale-[0.98] transition-all"
            >
              {loadingPortal ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Abrindo Portal de Pagamento...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Regularizar pagamento
                </>
              )}
            </Button>
          ) : null}

          <div className="grid grid-cols-2 gap-2 w-full pt-1">
            <Button
              asChild
              variant="outline"
              className="h-10 text-xs font-bold border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded-xl"
            >
              <Link to="/subscription">Minha Assinatura</Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-10 text-xs font-bold border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded-xl"
            >
              <Link to="/support">
                <Headset className="w-3.5 h-3.5 mr-1.5" />
                Suporte
              </Link>
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={onLogout || defaultLogout}
            className="w-full text-xs text-zinc-500 hover:text-zinc-300 hover:bg-transparent h-8 mt-1"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sair da conta
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
