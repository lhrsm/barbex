import * as React from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  shop: any;
  canonicalTenantId: string;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  display_order: number;
}

export function BarbershopPublicFaq({ shop, canonicalTenantId }: Props) {
  const [faqs, setFaqs] = React.useState<FaqItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  // Se a barbearia desativou explicitamente a seção de FAQ, ocultar
  const isFaqEnabled = shop?.faq_enabled !== false;

  React.useEffect(() => {
    let isMounted = true;
    async function loadFaqs() {
      if (!canonicalTenantId || !isFaqEnabled) {
        if (isMounted) {
          setFaqs([]);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("barbershop_faqs" as any)
          .select("id, question, answer, display_order")
          .eq("tenant_id", canonicalTenantId)
          .eq("is_approved", true)
          .eq("is_published", true)
          .order("display_order", { ascending: true });

        if (error) {
          console.warn("[BarbershopPublicFaq] Erro ao carregar perguntas:", error.message);
          if (isMounted) setFaqs([]);
        } else if (isMounted) {
          setFaqs((data as FaqItem[]) || []);
        }
      } catch (err) {
        console.warn("[BarbershopPublicFaq] Exceção na busca:", err);
        if (isMounted) setFaqs([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFaqs();
    return () => {
      isMounted = false;
    };
  }, [canonicalTenantId, isFaqEnabled]);

  // Se a seção estiver desabilitada ou não houver perguntas validadas, oculta completamente
  if (!isFaqEnabled || (!loading && faqs.length === 0)) {
    return null;
  }

  // Schema estruturado FAQPage para SEO do estabelecimento
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((f) => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.answer,
      },
    })),
  };

  return (
    <section id="faq" className="py-16 md:py-24 bg-black relative px-4 sm:px-6 lg:px-8 overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.06),transparent_60%)]" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-12 md:mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-[10px] md:text-[11px] font-black uppercase tracking-[0.25em]">
            <HelpCircle className="w-3.5 h-3.5 text-gold" />
            Tire Suas Dúvidas
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white leading-tight">
            Perguntas Frequentes
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto font-medium">
            Tudo o que você precisa saber sobre nossos atendimentos, agendamentos e políticas na {shop?.business_name || "barbearia"}.
          </p>
        </div>

        <div className="space-y-3" role="region" aria-label={`Perguntas frequentes sobre ${shop?.business_name || "a barbearia"}`}>
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            const questionId = `shop-faq-q-${faq.id}`;
            const answerId = `shop-faq-a-${faq.id}`;

            return (
              <motion.div
                key={faq.id}
                initial={false}
                className={cn(
                  "rounded-2xl border transition-all duration-300 overflow-hidden",
                  isOpen
                    ? "bg-gradient-to-b from-[#141414] to-[#0A0A0A] border-gold/40 shadow-[0_0_30px_rgba(212,175,55,0.08)]"
                    : "bg-[#0A0A0A]/60 border-white/5 hover:border-white/15 hover:bg-[#111111]"
                )}
              >
                <button
                  type="button"
                  id={questionId}
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                >
                  <span className={cn(
                    "font-bold text-base sm:text-lg transition-colors leading-snug",
                    isOpen ? "text-gold" : "text-white"
                  )}>
                    {faq.question}
                  </span>
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300",
                      isOpen
                        ? "bg-gold text-black border-gold rotate-180"
                        : "bg-white/5 text-slate-400 border-white/10"
                    )}
                    aria-hidden="true"
                  >
                    <ChevronDown className="w-4 h-4" />
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
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 text-slate-300 text-sm sm:text-base leading-relaxed border-t border-white/5 mt-1 pt-4 font-normal whitespace-pre-line">
                        {faq.answer}
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
