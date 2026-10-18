import * as React from "react";
import { CheckCircle2, Sparkles, ShieldCheck, Zap, ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export type PlanKey = "starter" | "pro" | "elite";

interface PricingSectionProps {
  onSelectPlan?: (planKey: PlanKey) => void;
}

export function PricingSection({ onSelectPlan }: PricingSectionProps) {
  const [billingCycle, setBillingCycle] = React.useState<"month" | "year">("month");

  const plans = [
    {
      key: "starter" as PlanKey,
      name: "Starter",
      tagline: "Ideal para barbearias individuais ou iniciando sua digitalização.",
      monthlyPrice: "59,90",
      annualPrice: "499,00",
      annualMonthlyEquivalent: "41,58",
      barbersText: "Até 2 profissionais",
      highlight: false,
      badge: null,
      features: [
        "Até 2 profissionais na equipe",
        "Agenda Online e Walk-in",
        "Portal do Cliente com link exclusivo",
        "Controle financeiro essencial",
        "Histórico básico de clientes",
        "Suporte técnico por chamado"
      ],
      ctaText: "Começar no Starter",
      ctaVariant: "outline" as const
    },
    {
      key: "pro" as PlanKey,
      name: "Pro",
      tagline: "O plano mais escolhido para equipes que buscam automação e crescimento.",
      monthlyPrice: "99,90",
      annualPrice: "999,00",
      annualMonthlyEquivalent: "83,25",
      barbersText: "Até 5 profissionais",
      highlight: true,
      badge: "Mais Popular • 15 Dias Grátis",
      features: [
        "Até 5 profissionais na equipe",
        "Tudo do plano Starter incluso",
        "Lembretes e avisos automáticos via WhatsApp",
        "Cálculo automático de comissões e rateios",
        "CRM 360° e fidelização de clientes",
        "Painel individual para cada barbeiro",
        "Suporte prioritário"
      ],
      ctaText: "Testar Pro 15 Dias Grátis",
      ctaVariant: "default" as const
    },
    {
      key: "elite" as PlanKey,
      name: "Elite",
      tagline: "Estrutura definitiva para barbearias de alto fluxo e operações consolidadas.",
      monthlyPrice: "149,90",
      annualPrice: "1.499,00",
      annualMonthlyEquivalent: "124,91",
      barbersText: "Profissionais Ilimitados",
      highlight: false,
      badge: "Escala Máxima",
      features: [
        "Profissionais ilimitados",
        "Tudo do plano Pro incluso",
        "Loja virtual integrada para venda de produtos",
        "DRE Executivo e relatórios avançados de BI",
        "Clube de assinaturas para clientes finais",
        "Gestão multi-unidades / franquias",
        "Atendimento VIP dedicado"
      ],
      ctaText: "Escolher Plano Elite",
      ctaVariant: "outline" as const
    }
  ];

  return (
    <section id="planos" className="py-20 md:py-28 lg:py-36 bg-[#05070d] relative px-4 sm:px-6 lg:px-8 overflow-hidden border-t border-white/5">
      {/* Background Decorativo com Micro-Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(212,175,55,0.08),transparent_65%)] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Cabeçalho da Seção */}
        <div className="text-center mb-12 md:mb-16 space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-gold/20 bg-gold/5 text-gold text-[10px] md:text-[11px] font-black uppercase tracking-[0.25em]">
            <Sparkles size={12} />
            Catálogo Comercial Transparente
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase italic tracking-tighter text-white leading-[1.02] text-balance">
            Planos sob medida para a sua <span className="text-gold">barbearia</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed font-medium text-balance">
            Escolha o plano ideal para a sua estrutura. Todos os novos cadastros iniciam com 15 dias de Trial Pro gratuito, sem necessidade de cartão de crédito.
          </p>

          {/* Toggle de Ciclo de Faturamento: Mensal / Anual */}
          <div className="pt-6 flex justify-center">
            <div 
              role="group" 
              aria-label="Opções de periodicidade de pagamento"
              className="inline-flex items-center p-1.5 rounded-2xl bg-zinc-900/90 border border-white/10 shadow-2xl backdrop-blur-md"
            >
              <button
                type="button"
                aria-pressed={billingCycle === "month"}
                onClick={() => setBillingCycle("month")}
                className={cn(
                  "px-5 sm:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  billingCycle === "month"
                    ? "bg-gold text-black shadow-lg shadow-gold/20"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Mensal
              </button>
              <button
                type="button"
                aria-pressed={billingCycle === "year"}
                onClick={() => setBillingCycle("year")}
                className={cn(
                  "px-5 sm:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  billingCycle === "year"
                    ? "bg-gold text-black shadow-lg shadow-gold/20"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Anual
                <span className={cn(
                  "text-[9px] font-black tracking-normal uppercase px-2 py-0.5 rounded-full",
                  billingCycle === "year"
                    ? "bg-black/20 text-black border border-black/10"
                    : "bg-gold/15 text-gold border border-gold/30"
                )}>
                  Economize no plano anual
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Grid dos 3 Cards de Planos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch pt-4">
          {plans.map((plan) => {
            const isHighlight = plan.highlight;
            const price = billingCycle === "month" ? plan.monthlyPrice : plan.annualPrice;
            const suffix = billingCycle === "month" ? "/mês" : "/ano";

            return (
              <motion.div
                key={plan.key}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "relative rounded-[2.5rem] p-8 sm:p-10 flex flex-col justify-between transition-all duration-500 backdrop-blur-md",
                  isHighlight
                    ? "bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border-2 border-gold/60 shadow-[0_20px_50px_-15px_rgba(212,175,55,0.25)] ring-1 ring-gold/30"
                    : "bg-zinc-900/40 border border-white/10 hover:border-gold/30 shadow-xl"
                )}
              >
                {/* Badge Superior */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-black uppercase tracking-[0.2em] text-[9px] sm:text-[10px] px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                      <Star size={12} fill="currentColor" />
                      {plan.badge}
                    </div>
                  </div>
                )}

                <div>
                  {/* Título e Tagline */}
                  <div className="flex justify-between items-baseline mb-3">
                    <h3 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-white">
                      {plan.name}
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gold px-3 py-1 rounded-full bg-gold/10 border border-gold/20">
                      {plan.barbersText}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed min-h-[44px]">
                    {plan.tagline}
                  </p>

                  {/* Preço */}
                  <div className="pt-6 pb-8 border-b border-white/5 space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl sm:text-2xl font-black text-gold italic">R$</span>
                      <span className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                        {price}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">
                        {suffix}
                      </span>
                    </div>

                    {billingCycle === "year" && (
                      <p className="text-[11px] font-bold text-slate-400">
                        Equivalente a <span className="text-gold">R$ {plan.annualMonthlyEquivalent}/mês</span> faturado anualmente.
                      </p>
                    )}
                  </div>

                  {/* Lista de Funcionalidades */}
                  <div className="py-6 space-y-3.5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      O que está incluso:
                    </div>
                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-300 font-medium leading-snug">
                          <CheckCircle2 size={16} className="text-gold shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Ação / CTA do Card */}
                <div className="pt-8 border-t border-white/5 space-y-3">
                  <Button
                    onClick={() => onSelectPlan && onSelectPlan(plan.key)}
                    className={cn(
                      "w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 flex items-center justify-center gap-2",
                      isHighlight
                        ? "bg-gold text-black hover:bg-gold/90 shadow-lg shadow-gold/20"
                        : "border-white/20 bg-white/5 hover:bg-white/10 text-white hover:border-gold/30"
                    )}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight size={14} />
                  </Button>

                  <div className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1.5">
                    <ShieldCheck size={12} className="text-gold/80" />
                    15 dias grátis • Sem cartão de crédito
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Rodapé Informativo da Seção */}
        <div className="mt-14 sm:mt-16 p-6 sm:p-8 rounded-3xl bg-zinc-950/70 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1">
            <h4 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
              Precisa de ajuda para escolher o melhor plano?
            </h4>
            <p className="text-xs sm:text-sm text-slate-400">
              Todos os novos cadastros ganham 15 dias de avaliação Pro completa para testar antes de qualquer cobrança.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 justify-center shrink-0">
            <a
              href="#faq"
              className="px-6 py-3 rounded-xl border border-white/10 hover:border-gold/30 bg-white/5 text-xs font-black uppercase tracking-widest text-white transition-colors"
            >
              Consultar FAQ
            </a>
            <a
              href="#contato"
              className="px-6 py-3 rounded-xl bg-gold/10 border border-gold/30 text-xs font-black uppercase tracking-widest text-gold hover:bg-gold/20 transition-colors"
            >
              Falar com Especialista
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
