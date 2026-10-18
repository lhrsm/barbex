import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  shop?: any;
  productsEnabled?: boolean;
  subscriptionsEnabled?: boolean;
  cashbackEnabled?: boolean;
  couponsEnabled?: boolean;
  loyaltyEnabled?: boolean;
};

export function PortalFaq({
  shop,
  productsEnabled = true,
  subscriptionsEnabled = true,
  cashbackEnabled = true,
  couponsEnabled = true,
  loyaltyEnabled = true,
}: Props) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const faqs = [
    {
      q: "Como funciona o teste gratuito de 15 dias?",
      a: "Você tem 15 dias de avaliação gratuita para testar os recursos da plataforma Barbex na sua barbearia. Não solicitamos cartão de crédito para iniciar e a configuração é feita em minutos. Cada barbearia tem direito a 15 dias de Trial Pro concedido uma única vez."
    },
    {
      q: "O que acontece ao final do período de avaliação?",
      a: "Ao término dos 15 dias de teste, o acesso aos recursos operacionais fica pausado até a contratação de um dos planos vigentes (Starter, Pro ou Elite). O Barbex não possui plano gratuito permanente, mas todas as configurações, cadastros de clientes e dados da sua barbearia permanecem preservados para quando você decidir assinar."
    },
    {
      q: "Preciso cadastrar cartão de crédito para iniciar o teste?",
      a: "Não. O início do período de teste de 15 dias é totalmente livre de cobrança e sem exigência de dados de pagamento. Você só cadastra seu cartão se optar por continuar usando o Barbex após o término da avaliação."
    },
    {
      q: "Como funciona o cancelamento da assinatura? Existe fidelidade?",
      a: "O Barbex não possui contratos com cláusulas de fidelidade oculta ou multas rescisórias. O cancelamento pode ser solicitado a qualquer momento diretamente pelo painel administrativo. Na opção padrão de cancelamento ao fim do período, a renovação automática é interrompida e sua barbearia mantém o acesso completo garantido até o último dia do ciclo já pago (seja mensal ou anual). Não há estorno ou reembolso financeiro automático."
    },
    {
      q: "Posso mudar de plano quando minha barbearia crescer?",
      a: "Sim! O modelo comercial do Barbex é estruturado em planos completos (Starter, Pro e Elite), sem venda fragmentada de módulos avulsos. Você pode solicitar o upgrade ou downgrade a qualquer momento pelo painel, ajustando a quantidade de profissionais e recursos conforme a sua demanda."
    },
    {
      q: "Quais são as formas de pagamento aceitas para a assinatura?",
      a: "As assinaturas da plataforma Barbex são processadas com segurança pela infraestrutura internacional da Stripe, com suporte a cartões de crédito das principais bandeiras nacionais e internacionais, com opção de faturamento mensal ou anual."
    },
    {
      q: "Como funciona a integração com o WhatsApp?",
      a: "O Barbex possui integração nativa para disparo de lembretes automáticos de agendamento e confirmações aos seus clientes nos planos compatíveis (Pro e Elite). A barbearia conecta seu próprio número de WhatsApp via leitura de QR Code direto no painel, sem necessidade de contratar planos complexos de API externa."
    },
    {
      q: "O Barbex possui agendamento online com Portal do Cliente?",
      a: "Sim. Sua barbearia recebe um link exclusivo e personalizável onde os clientes podem consultar horários livres em tempo real e agendar 24 horas por dia, com sincronização imediata na agenda dos profissionais."
    },
    {
      q: "O cliente consegue reagendar ou cancelar sozinho?",
      a: "Sim. Diretamente pelo portal ou pelo link de confirmação do agendamento, o cliente pode solicitar reagendamento ou cancelamento, sempre respeitando as regras de antecedência mínima configuradas pela sua barbearia."
    },
    {
      q: "Existe painel individual para cada profissional da equipe?",
      a: "Com certeza. Cada profissional cadastrado na sua equipe pode ter acesso individual para visualizar sua própria agenda, acompanhar comissões acumuladas, histórico de atendimentos e metas pessoais."
    },
    {
      q: "Como funciona o controle financeiro e comissões?",
      a: "O Barbex automatiza o cálculo de comissões por serviço e produto, gera fluxo de caixa diário, relatórios de lucratividade e visão gerencial de faturamento, eliminando anotações em papel ou planilhas manuais."
    },
    {
      q: "O Barbex funciona em celulares, tablets e computadores?",
      a: "Sim. A plataforma é 100% web e responsiva, operando com total fluidez em qualquer navegador em computadores (Windows/Mac), tablets e smartphones (Android/iOS), sem exigir downloads pesados de lojas de aplicativos."
    }
  ];

  return (
    <section id="faq" className="py-16 md:py-24 lg:py-32 bg-black relative px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.06),transparent_60%)]" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-12 md:mb-16 space-y-4">
          <span className="text-gold font-black uppercase tracking-[0.3em] text-[10px] md:text-[11px]">Dúvidas Frequentes</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase italic tracking-tighter text-white leading-[1.02] text-balance">
            FAQ Comercial & Transparência
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto font-medium">
            Respostas claras e objetivas sobre planos, período de teste de 15 dias, segurança e funcionamento do Barbex.
          </p>
        </div>

        <div className="space-y-3" role="region" aria-label="Perguntas frequentes sobre o Barbex">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            const questionId = `faq-question-${idx}`;
            const answerId = `faq-answer-${idx}`;

            return (
              <motion.div
                key={idx}
                initial={false}
                className={cn(
                  "group rounded-2xl border transition-all duration-300",
                  isOpen
                    ? "border-gold/30 bg-zinc-900/50 shadow-[0_10px_30px_-10px_rgba(212,175,55,0.1)]"
                    : "border-white/5 bg-zinc-900/30 hover:border-white/10 hover:bg-zinc-900/40"
                )}
              >
                <button
                  id={questionId}
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 sm:gap-6 px-6 sm:px-8 py-5 sm:py-6 text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black transition-colors"
                >
                  <span className={cn(
                    "text-base sm:text-lg font-bold tracking-tight transition-colors duration-300 leading-snug",
                    isOpen ? "text-gold" : "text-slate-200 group-hover:text-white"
                  )}>
                    {faq.q}
                  </span>
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                    isOpen
                      ? "bg-gold border-gold text-black rotate-180"
                      : "border-white/10 text-slate-400 group-hover:border-gold/50 group-hover:text-gold"
                  )}>
                    <ChevronDown size={18} aria-hidden="true" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={answerId}
                      role="region"
                      aria-labelledby={questionId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                        <div className="h-px w-full bg-white/5 mb-6" />
                        <p className="text-[15px] sm:text-[16px] leading-[1.8] text-slate-300 font-medium">
                          {faq.a}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
