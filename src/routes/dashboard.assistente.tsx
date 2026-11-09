import React from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Sparkles,
  Send,
  User,
  Bot,
  Zap,
  HelpCircle,
  Database,
  ArrowRight,
  TrendingUp,
  Users,
  Wallet,
  ShieldAlert,
  Loader2,
  RotateCcw,
  BookOpen,
  ExternalLink,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { resolveAIContext } from "@/lib/ai/context.functions";
import { verifyTenantAdminIdentity } from "@/lib/ai/tenant-admin-auth";
import { askAIAssistant } from "@/lib/ai/chat.functions";

export const Route = createFileRoute("/dashboard/assistente")({
  beforeLoad: async () => {
    // Validação preliminar no Router Guard (Fail-Closed)
    if (typeof window !== "undefined") {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        throw redirect({
          to: "/auth",
          search: { redirect: "/dashboard/assistente" } as any,
        });
      }

      // Validação canônica centralizada
      const authResult = await verifyTenantAdminIdentity(session.user.id);
      if (!authResult.authorized) {
        console.warn("[AI_ASSISTANT_GUARD] Acesso negado:", authResult.errorMessage);
        throw redirect({ to: "/dashboard" });
      }
    }
  },
  component: AIAssistantPage,
});

interface SourceItem {
  id: string;
  title: string;
  category: string;
  route: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
  isError?: boolean;
  timestamp: Date;
}

const INITIAL_MESSAGE: Message = {
  id: "welcome-1",
  role: "assistant",
  content:
    "Olá! Sou o Assistente Barbex. Posso tirar dúvidas sobre a operação da barbearia, como comissões, agendamentos, chave PIX e planos. Como posso te ajudar?",
  timestamp: new Date(),
};

/**
 * Componente de Referências Recolhíveis da Central de Ajuda (Gate 5 - Fase 32)
 */
function CollapsibleSources({ sources }: { sources?: SourceItem[] }) {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="pt-2 border-t border-white/5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
        aria-controls="sources-collapsible-content"
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/50 hover:text-gold transition-colors focus:outline-none focus:ring-1 focus:ring-gold/40 rounded px-1.5 py-0.5"
      >
        <BookOpen className="w-3 h-3 text-gold/70" />
        <span>Consultar na Central de Ajuda ({sources.length})</span>
        {isOpen ? (
          <ChevronUp className="w-3 h-3 text-white/40" />
        ) : (
          <ChevronDown className="w-3 h-3 text-white/40" />
        )}
      </button>

      {isOpen && (
        <div
          id="sources-collapsible-content"
          className="mt-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200"
          role="region"
          aria-label="Artigos recomendados da Central de Ajuda"
        >
          {sources.map((src) => (
            <Link
              key={src.id}
              to="/tutorials"
              search={{ q: src.title } as any}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 hover:border-gold/40 hover:bg-gold/5 text-[11px] font-medium text-zinc-300 hover:text-white transition-all group"
            >
              <span>{src.title}</span>
              <ExternalLink className="w-2.5 h-2.5 text-zinc-500 group-hover:text-gold" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Indicador de Digitação Fluido e Acessível (Gate 4 - Fase 32)
 */
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex gap-4 max-w-[85%] mr-auto"
      role="status"
      aria-live="polite"
      aria-label="Assistente virtual respondendo"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-gold/10 border-gold/20 text-gold">
        <Bot size={18} />
      </div>
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-zinc-300 rounded-tl-none flex items-center gap-3">
        <div className="flex items-center gap-1.5 py-1">
          <span className="w-2 h-2 rounded-full bg-gold/70 animate-bounce [animation-delay:-0.3s] motion-reduce:animate-none" />
          <span className="w-2 h-2 rounded-full bg-gold/70 animate-bounce [animation-delay:-0.15s] motion-reduce:animate-none" />
          <span className="w-2 h-2 rounded-full bg-gold/70 animate-bounce motion-reduce:animate-none" />
        </div>
        <span className="text-xs text-white/50 font-medium tracking-wide">
          Respondendo...
        </span>
        <span className="sr-only">Assistente está gerando a resposta...</span>
      </div>
    </motion.div>
  );
}

function AIAssistantPage() {
  const { user, role, loading: authLoading } = useAuth();
  const { tenantId, isLoading: tenantLoading, ownedShop } = useTenant();

  // Histórico em memória temporária (Zero LocalStorage / Privacidade Total)
  const [messages, setMessages] = React.useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [aiContextStatus, setAiContextStatus] = React.useState<string | null>(null);
  const [contextError, setContextError] = React.useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Verificação em runtime contra bypasses client-side
  const isAuthorizedAdmin =
    !authLoading &&
    !tenantLoading &&
    role !== "super_admin" &&
    (role === "tenant_admin" || (role === "admin" && (!!tenantId || !!ownedShop)));

  // Sincronização e verificação de contexto via Server Function
  React.useEffect(() => {
    let isMounted = true;
    if (isAuthorizedAdmin && user?.id) {
      resolveAIContext()
        .then((ctx) => {
          if (isMounted) {
            setAiContextStatus(ctx.status);
            setContextError(null);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setContextError(err.message || "Erro ao autenticar contexto de IA.");
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthorizedAdmin, user?.id]);

  // Limpeza de contexto estritamente em memória se tenant ou usuário mudar
  React.useEffect(() => {
    setMessages([INITIAL_MESSAGE]);
    setBannerNotice(null);
  }, [user?.id, tenantId]);

  const suggestedQuestions = [
    { text: "Como configurar as comissões dos barbeiros?", icon: Scissors },
    { text: "Como cadastrar novos serviços e valores?", icon: Wallet },
    { text: "Como funciona a comanda digital e split de pagamento?", icon: TrendingUp },
    { text: "Como configurar lembretes automáticos no WhatsApp?", icon: Users },
  ];

  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText || input).trim();
    if (!textToSend || !isAuthorizedAdmin || isSubmitting) return;

    if (textToSend.length > 500) {
      setBannerNotice("A pergunta deve ter no máximo 500 caracteres.");
      return;
    }

    setBannerNotice(null);

    // Histórico recente em memória da sessão (Gate 1 - Fase 32: máx 6 mensagens, assistente até 1500 chars, usuário até 500 chars)
    const recentHistory = messages
      .filter(
        (m) =>
          !m.isError &&
          m.id !== "welcome-1" &&
          m.content.trim().length > 0 &&
          (m.role === "assistant" ? m.content.length <= 1500 : m.content.length <= 500)
      )
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: m.content.trim(),
      }));

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSubmitting(true);

    try {
      const response = await askAIAssistant({
        data: {
          question: textToSend,
          history: recentHistory,
        },
      });

      const botMsg: Message = {
        id: `ast-${Date.now()}`,
        role: "assistant",
        content: response.reply,
        sources: response.sources,
        isError: !response.success,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);

      if (!response.success && response.error === "RATE_LIMIT_EXCEEDED") {
        setBannerNotice(response.reply);
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content:
          err.message ||
          "Não foi possível processar sua pergunta neste momento. Verifique sua conexão e tente novamente.",
        isError: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([INITIAL_MESSAGE]);
    setBannerNotice(null);
  };

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSubmitting]);

  // Loading state
  if (authLoading || tenantLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)] gap-4">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
        <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
          Validando credenciais do administrador...
        </p>
      </div>
    );
  }

  // Unauthorized Fallback (Caso de desvio ou sessão incompatível)
  if (!isAuthorizedAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)] max-w-lg mx-auto text-center gap-6 p-6">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Acesso Restrito</h2>
          <p className="text-white/60 text-sm">
            O Assistente de IA Institucional é de uso exclusivo do administrador da barbearia.
          </p>
        </div>
        <Button asChild className="bg-gold text-black hover:bg-gold/90 font-bold">
          <Link to="/dashboard">Voltar ao Painel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-5xl mx-auto gap-6 animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="flex items-center justify-between p-6 rounded-3xl bg-zinc-900/50 border border-gold/10 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gold/10 rounded-2xl">
            <Sparkles className="h-6 w-6 text-gold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight italic uppercase">Assistente AI</h1>
              <Badge className="bg-gold text-black font-black uppercase tracking-widest text-[9px] px-2 py-0.5 shadow-[0_0_15px_rgba(212,175,55,0.3)] border-none">
                MVP Funcional
              </Badge>
            </div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-0.5">
              Central de Conhecimento e Operação Barbex
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            className="border-white/10 hover:border-gold/30 hover:bg-gold/10 text-white/70 hover:text-white text-xs flex items-center gap-1.5"
            title="Limpar mensagens e iniciar nova conversa"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gold" />
            <span className="hidden sm:inline">Nova Conversa</span>
          </Button>

          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Base de Dados</span>
            {contextError ? (
              <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Falha no Contexto
              </span>
            ) : (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Conhecimento Oficial Ativo
              </span>
            )}
          </div>
        </div>
      </div>

      {bannerNotice && (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span className="flex-1">{bannerNotice}</span>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-white/40 hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Chat Area */}
        <Card className="flex-1 bg-[#0b0f17]/40 border-white/5 rounded-2xl flex flex-col overflow-hidden backdrop-blur-sm">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 max-w-[88%]",
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                      msg.role === "assistant"
                        ? msg.isError
                          ? "bg-red-500/10 border-red-500/20 text-red-400"
                          : "bg-gold/10 border-gold/20 text-gold"
                        : "bg-white/5 border-white/10 text-zinc-400"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      msg.isError ? (
                        <AlertTriangle size={18} />
                      ) : (
                        <Bot size={18} />
                      )
                    ) : (
                      <User size={18} />
                    )}
                  </div>

                  <div className="space-y-3 flex-1">
                    <div
                      className={cn(
                        "p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-line",
                        msg.role === "assistant"
                          ? msg.isError
                            ? "bg-red-500/5 border border-red-500/20 text-red-200 rounded-tl-none"
                            : "bg-white/[0.03] border border-white/5 text-zinc-300 rounded-tl-none font-normal"
                          : "bg-gold text-black font-bold rounded-tr-none shadow-[0_10px_20px_-10px_rgba(212,175,55,0.3)]"
                      )}
                    >
                      {msg.content}
                    </div>

                    {/* Referências Oficiais da Central de Ajuda Recolhíveis (Gate 5 - Fase 32) */}
                    {msg.sources && msg.sources.length > 0 && (
                      <CollapsibleSources sources={msg.sources} />
                    )}
                  </div>
                </motion.div>
              ))}

              {isSubmitting && <TypingIndicator />}
            </AnimatePresence>
          </div>

          <div className="p-6 bg-white/[0.02] border-t border-white/5">
            <div className="relative group">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ex: Como configurar as comissões dos barbeiros?"
                maxLength={500}
                disabled={isSubmitting}
                className="h-14 bg-zinc-950/50 border-white/10 rounded-2xl text-white font-medium pr-28 focus:border-gold/50 transition-all placeholder:text-zinc-600 disabled:opacity-50"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-mono pr-1 hidden sm:inline">
                  {input.length}/500
                </span>
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isSubmitting || input.length > 500}
                  className="w-10 h-10 rounded-xl bg-gold hover:bg-gold/90 text-black p-0 disabled:opacity-30 disabled:bg-zinc-800"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <Send size={18} />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-600 mt-2 px-1">
              <span>Assistente Institucional Barbex • Respostas baseadas em fatos oficiais.</span>
              <span>Modo estritamente consultivo.</span>
            </div>
          </div>
        </Card>

        {/* Sidebar Info */}
        <div className="hidden lg:flex flex-col gap-6 w-80 shrink-0">
          <Card className="bg-[#0b0f17]/40 border-white/5 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-xs font-black text-gold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <HelpCircle size={14} /> Dúvidas Frequentes
            </h3>
            <div className="space-y-2.5">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  disabled={isSubmitting}
                  onClick={() => handleSend(q.text)}
                  className="w-full text-left p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-gold/30 hover:bg-gold/5 group transition-all disabled:opacity-50"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-zinc-900 group-hover:bg-gold/10 transition-colors mt-0.5">
                      <q.icon size={13} className="text-zinc-500 group-hover:text-gold" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-200 leading-snug">
                        {q.text}
                      </p>
                    </div>
                    <ArrowRight
                      size={12}
                      className="text-zinc-700 group-hover:text-gold mt-1 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="bg-[#0b0f17]/40 border-white/5 rounded-2xl p-6 backdrop-blur-sm flex-1">
            <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Database size={14} /> Base de Tutoriais
            </h3>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {["Comissões", "Serviços", "Comanda", "Z-API", "PIX", "Relatórios"].map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="bg-zinc-950/50 border-white/5 text-[9px] text-zinc-500 font-bold uppercase tracking-widest px-2 py-0.5"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">
                As respostas são recuperadas diretamente dos 68 artigos homologados da Central de Ajuda.
              </p>

              <div className="pt-3 border-t border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Isolamento multi-tenant ativo</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Franquia 100% gratuita (Fail-Closed)</span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-bold border-white/10 hover:border-gold/30 hover:bg-gold/10 text-white"
                >
                  <Link to="/tutorials">Abrir Central de Ajuda</Link>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
