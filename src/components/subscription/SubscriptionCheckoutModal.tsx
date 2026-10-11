import React, { useMemo, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { useQuery } from "@tanstack/react-query";
import { resolveTenantMetadata } from "@/lib/auth-identity.resolver";
import {
  ShieldCheck,
  Check,
  Store,
  UserCheck,
  Zap,
  Crown,
  Rocket,
  X,
  AlertTriangle,
  Loader2,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckoutOptions } from "@/hooks/useStripeCheckout";

interface SubscriptionCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  options: CheckoutOptions | null;
  checkoutElement: React.ReactNode;
}

export function SubscriptionCheckoutModal({
  open,
  onClose,
  options,
  checkoutElement,
}: SubscriptionCheckoutModalProps) {
  const { user } = useAuth();
  const { tenantId: activeTenantId, businessName: activeBusinessName } = useTenant();
  const [showBenefits, setShowBenefits] = useState(false);

  // Invalidação imediata e desmontagem de checkout obsoleto se houver logout ou troca de tenant/user
  useEffect(() => {
    if (open) {
      if (!user) {
        onClose();
      } else if (options?.tenantId && activeTenantId && options.tenantId !== activeTenantId) {
        onClose();
      } else if (options?.userId && user.id && options.userId !== user.id) {
        onClose();
      }
    }
  }, [open, options, user, activeTenantId, onClose]);

  // Consulta canônica de fallback caso o nome do estabelecimento ainda não esteja no hook
  const { data: resolvedTenantMeta } = useQuery({
    queryKey: ["checkout-tenant-meta", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return null;
      return resolveTenantMetadata(activeTenantId);
    },
    enabled: !!activeTenantId && !options?.tenantName && !activeBusinessName,
    staleTime: 5 * 60 * 1000,
  });

  // Guard de integridade de identidade genérico fail-closed
  const identityCheck = useMemo((): { valid: boolean; reason?: string } => {
    if (!open || !options) return { valid: true };

    // 1. Authenticated user presence
    if (!user || !user.id) {
      return {
        valid: false,
        reason: "Sessão não autenticada. Faça login para continuar com a contratação.",
      };
    }

    // 2. Active tenant presence
    if (!activeTenantId) {
      return {
        valid: false,
        reason:
          "Nenhum estabelecimento ativo selecionado. Selecione um estabelecimento para continuar.",
      };
    }

    const currentTenant = (activeTenantId || "").trim();
    const optionsTenant = (options.tenantId || "").trim();
    const currentUserId = (user?.id || "").trim();
    const optionsUserId = (options.userId || "").trim();
    const currentUserEmail = (user?.email || "").toLowerCase().trim();
    const optionsEmail = (options.customerEmail || "").toLowerCase().trim();

    // 3. Tenant mismatch check: checkout tenant must match active tenant
    if (optionsTenant && currentTenant && optionsTenant !== currentTenant) {
      return {
        valid: false,
        reason:
          "Inconsistência de estabelecimento: o checkout solicitado não pertence ao estabelecimento atualmente ativo.",
      };
    }

    // 4. User ID mismatch check: checkout user ID must match active user
    if (optionsUserId && currentUserId && optionsUserId !== currentUserId) {
      return {
        valid: false,
        reason:
          "Inconsistência de titular: o usuário autenticado difere do titular da solicitação de contratação.",
      };
    }

    // 5. Email mismatch check: checkout email must match session email
    if (optionsEmail && currentUserEmail && currentUserEmail !== optionsEmail) {
      return {
        valid: false,
        reason: `A conta autenticada no navegador (${currentUserEmail}) não corresponde ao titular da contratação (${optionsEmail}).`,
      };
    }

    return { valid: true };
  }, [open, options, user, activeTenantId]);

  if (!options) return null;

  const planKey = options.planKey || "starter";
  const billingCycle = options.billingCycle || "month";
  const planName =
    options.planName || (planKey === "starter" ? "Starter" : planKey === "pro" ? "Pro" : "Elite");
  const price = options.price || (billingCycle === "year" ? "499,00" : "59,90");
  const businessName =
    options.tenantName || activeBusinessName || resolvedTenantMeta?.name || "Meu Estabelecimento";
  const userEmail = options.customerEmail || user?.email || "";

  // Benefícios oficiais padronizados com o catálogo oficial do Barbex
  const defaultFeatures =
    planKey === "starter"
      ? [
          "Até 3 barbeiros",
          "Até 300 clientes",
          "Até 15 serviços",
          "WhatsApp + Portal do cliente",
          "3 automações essenciais",
        ]
      : planKey === "pro"
        ? [
            "Até 10 barbeiros · Clientes ilimitados",
            "Estoque, Loja, Cupons, Cashback, Fidelidade",
            "Assinaturas + Gateway de Pagamento",
            "Financeiro completo + Dashboard avançado",
            "8 automações inteligentes",
            "Suporte prioritário",
          ]
        : [
            "Barbeiros e admins ilimitados",
            "12 IAs (Agendadora, Comercial, WhatsApp...)",
            "Automações ilimitadas",
            "API aberta + Integrações + White Label",
            "Prioridade máxima no suporte",
          ];

  const features =
    options.features && options.features.length > 0 ? options.features : defaultFeatures;
  const PlanIcon = planKey === "starter" ? Zap : planKey === "pro" ? Crown : Rocket;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "w-[98vw] sm:w-[94vw] max-w-[1100px] h-[96vh] md:h-[92vh] max-h-[96vh] md:max-h-[880px] p-0 gap-0 overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl",
          "bg-[#0b0f17] border border-zinc-800 text-white shadow-2xl shadow-black/90",
          "flex flex-col focus:outline-none [&>button.absolute]:hidden",
        )}
      >
        <DialogTitle className="sr-only">Finalizar assinatura do Plano {planName}</DialogTitle>
        <DialogDescription className="sr-only">
          Revise os detalhes do plano {planName} e informe os dados de pagamento com segurança pelo
          Stripe.
        </DialogDescription>

        {/* ================================================================= */}
        {/* CABEÇALHO COMPACTO MOBILE (visível apenas em telas < lg)           */}
        {/* ================================================================= */}
        <div className="lg:hidden px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-[#070a10]">
          <div>
            <h3 className="text-sm font-black text-white tracking-tight">Finalizar assinatura</h3>
            <p className="text-[11px] text-zinc-400">Revise seu plano e informe os dados</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg border border-zinc-700/80 bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800 grid place-items-center transition-colors focus:outline-none"
            aria-label="Fechar checkout"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* CORPO DO CHECKOUT:                                                */}
        {/* NO MOBILE: Fluxo único com rolagem vertical unificada e suave     */}
        {/* NO DESKTOP: 2 colunas lado a lado (38% Resumo | 62% Stripe)       */}
        {/* ================================================================= */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0 w-full overscroll-contain">
          {/* =============================================================== */}
          {/* PAINEL ESQUERDO: RESUMO DA ASSINATURA BARBEX                    */}
          {/* Mobile: Topo compacto integrado ao scroll unificado             */}
          {/* Desktop: Coluna dedicada de 38% com scroll próprio              */}
          {/* =============================================================== */}
          <div className="w-full lg:w-[38%] shrink-0 bg-[#070a10] border-b lg:border-b-0 lg:border-r border-zinc-800/80 p-3.5 sm:p-5 lg:p-8 flex flex-col lg:justify-between lg:overflow-y-auto">
            <div className="space-y-3 sm:space-y-4 lg:space-y-5">
              {/* Badge Superior */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Assinatura Barbex
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Ambiente Seguro
                </span>
              </div>

              {/* Título do Plano e Preço */}
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 grid place-items-center shrink-0">
                    <PlanIcon className="h-4 w-4 lg:h-5 lg:w-5 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                      Plano Selecionado
                    </span>
                    <h2 className="text-lg sm:text-xl lg:text-3xl font-black text-white tracking-tight">
                      Plano {planName}
                    </h2>
                  </div>
                </div>

                <div className="pt-0.5 sm:pt-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-bold text-zinc-400">R$</span>
                    <span className="text-xl sm:text-2xl lg:text-4xl font-black text-white tracking-tight">
                      {price}
                    </span>
                    <span className="text-xs font-bold text-zinc-400 ml-1">
                      {billingCycle === "year" ? "/ ano" : "/ mês"}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs font-semibold text-emerald-400/90 mt-0.5">
                    {billingCycle === "year"
                      ? "Renovação anual com desconto · Cancele quando quiser"
                      : "Renovação mensal · Cancele quando quiser"}
                  </p>
                </div>
              </div>

              {/* Card de Contexto do Estabelecimento e Titular */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-2.5 sm:p-3.5 space-y-1 sm:space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-zinc-200">
                  <Store className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="font-semibold truncate text-[11px] sm:text-xs">
                    {businessName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <UserCheck className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate text-[11px] sm:text-xs">{userEmail}</span>
                </div>
              </div>

              {/* Mobile: Botão expansível acessível para benefícios */}
              <div className="lg:hidden">
                <button
                  type="button"
                  aria-expanded={showBenefits}
                  onClick={() => setShowBenefits((prev) => !prev)}
                  className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 text-[11px] font-semibold text-zinc-300 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-400" />
                    {showBenefits
                      ? "Ocultar benefícios do plano"
                      : `Ver benefícios do plano (${features.length})`}
                  </span>
                  {showBenefits ? (
                    <ChevronUp className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                  )}
                </button>
              </div>

              {/* Lista de Benefícios Inclusos: */}
              {/* No Desktop: SEMPRE visível (lg:block) */}
              {/* No Mobile: visível apenas quando expandido */}
              <div
                className={cn(
                  "space-y-2 sm:space-y-2.5",
                  showBenefits ? "block" : "hidden lg:block",
                )}
              >
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-zinc-400 block">
                  O que está incluso:
                </span>
                <ul className="space-y-1.5 sm:space-y-2">
                  {features.map((feat, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-[11px] sm:text-xs text-zinc-300"
                    >
                      <div className="h-4 w-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 grid place-items-center shrink-0 mt-0.5">
                        <Check className="h-2.5 w-2.5 text-emerald-400" />
                      </div>
                      <span className="leading-tight">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Rodapé de Segurança e Confiabilidade (Desktop apenas) */}
            <div className="hidden lg:flex mt-6 pt-5 border-t border-zinc-800/80 items-start gap-3 text-[11px] text-zinc-400">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 grid place-items-center shrink-0 text-emerald-400 mt-0.5">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="leading-snug">
                Pagamento processado com segurança pelo{" "}
                <strong className="text-zinc-200">Stripe</strong>. Criptografia ponta a ponta de
                nível bancário. Seus dados de cartão nunca são armazenados pelo Barbex.
              </p>
            </div>
          </div>

          {/* =============================================================== */}
          {/* PAINEL DIREITO: STRIPE EMBEDDED CHECKOUT                        */}
          {/* Mobile: Integrado no fluxo vertical unificado                   */}
          {/* Desktop: Coluna dedicada de 62% com scroll próprio              */}
          {/* =============================================================== */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0b0f17] lg:overflow-hidden">
            {/* Cabeçalho do Painel Direito com Fechar (Desktop apenas) */}
            <div className="hidden lg:flex px-7 py-4 border-b border-zinc-800/80 items-center justify-between shrink-0 bg-[#0b0f17]">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  Finalizar assinatura
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Revise seu plano e informe os dados de pagamento.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 rounded-lg border border-zinc-700/80 bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-600 grid place-items-center transition-colors focus:outline-none"
                aria-label="Fechar checkout"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Área de Conteúdo do Pagamento */}
            <div className="p-3 sm:p-4 lg:p-7 lg:flex-1 lg:overflow-y-auto space-y-3 sm:space-y-4">
              {/* CONDICIONAL: BLOQUEIO DE IDENTIDADE (FAIL-CLOSED) */}
              {!identityCheck.valid ? (
                <div className="p-6 border border-destructive/30 bg-destructive/10 rounded-xl space-y-4 text-center my-auto">
                  <div className="h-12 w-12 rounded-full bg-destructive/20 border border-destructive/40 text-destructive grid place-items-center mx-auto">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-base font-bold text-destructive">
                      Bloqueio de Segurança da Assinatura
                    </h4>
                    <p className="text-xs text-zinc-300 max-w-md mx-auto leading-relaxed">
                      {identityCheck.reason}
                    </p>
                    <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                      O checkout não foi carregado para proteger sua integridade financeira e evitar
                      cobrança no estabelecimento incorreto.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors"
                  >
                    Fechar e verificar conta
                  </button>
                </div>
              ) : (
                /* CONTAINER DO STRIPE: EXPANDIDO, SEM MARGENS EXCESSIVAS, ROLAGEM NATURAL */
                <div className="w-full bg-white rounded-xl shadow-lg border border-zinc-200 p-2.5 sm:p-5">
                  {checkoutElement || (
                    <div className="min-h-[380px] flex flex-col items-center justify-center gap-3 text-zinc-500">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                      <span className="text-xs font-semibold">
                        Carregando formulário seguro do Stripe...
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Rodapé Mobile Integrado no Fluxo (Não sobrepõe nem oculta botões) */}
              <div className="lg:hidden py-2.5 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
                <Lock className="h-3 w-3 text-emerald-400 shrink-0" />
                <span>Ambiente seguro processado pelo Stripe · Criptografia ponta a ponta</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
