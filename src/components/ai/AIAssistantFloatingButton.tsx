import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import {
  Bot,
  Sparkles,
  X,
  Send,
  Loader2,
  BookOpen,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { askAIAssistant } from "@/lib/ai/chat.functions";
import { resolveAIContext } from "@/lib/ai/context.functions";
import { cn } from "@/lib/utils";

interface SourceItem {
  id: string;
  title: string;
  category: string;
  route: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
  isError?: boolean;
  timestamp: Date;
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome-float-1",
  role: "assistant",
  content:
    "Olá! Sou o Assistente Barbex. Como posso ajudar com a gestão da sua barbearia hoje?",
  timestamp: new Date(),
};

/**
 * Validação rigorosa de equivalência administrativa do tenant (Barbex R2E.26E.22N.8E.1)
 *
 * Exige comprovação ativa de que o usuário autenticado é administrador do tenant ativo.
 * Rejeita qualquer autorização baseada exclusivamente na existência isolada de tenantId.
 */
export function isProvenTenantAdmin(params: {
  userId?: string | null;
  role?: string | null;
  tenantId?: string | null;
  ownedShop?: { id?: string | null } | null;
  membership?: { tenant_id?: string | null; role?: string | null; status?: string | null } | null;
}): boolean {
  const { userId, role, tenantId, ownedShop, membership } = params;

  if (!userId || !tenantId || !role) return false;

  const normalizedRole = role.toLowerCase().trim();

  // Papéis expressamente operacionais, clientes ou superadmin são rejeitados
  const unauthorizedRoles = [
    "super_admin",
    "barber",
    "professional",
    "receptionist",
    "reception",
    "financial",
    "finance",
    "cashier",
    "manager",
    "client",
    "customer",
    "unknown",
  ];
  if (unauthorizedRoles.includes(normalizedRole)) return false;

  // Apenas tenant_admin ou admin legado com comprovação de vínculo
  if (normalizedRole !== "tenant_admin" && normalizedRole !== "admin") return false;

  // Comprovação 1: Proprietário direto da barbearia cujo ID corresponde exatamente ao tenant ativo
  const isDirectShopOwner = !!ownedShop?.id && ownedShop.id === tenantId;

  // Comprovação 2: Membresia ativa com papel de administração vinculada exatamente ao tenant ativo
  const memTenantMatches = !!membership?.tenant_id && membership.tenant_id === tenantId;
  const memStatusActive = !membership?.status || membership.status === "active";
  const memRoleMatches =
    membership?.role?.toLowerCase().trim() === "admin" ||
    membership?.role?.toLowerCase().trim() === "tenant_admin";
  const isDirectActiveMemberAdmin = memTenantMatches && memStatusActive && memRoleMatches;

  // Comprovação 3: Modelo canônico legado onde o próprio ID do usuário fundador é o tenantId
  const isCanonicalFounderTenant = normalizedRole === "tenant_admin" && userId === tenantId;

  return isDirectShopOwner || isDirectActiveMemberAdmin || isCanonicalFounderTenant;
}

/**
 * AIAssistantFloatingButton (Barbex R2E.26E.22N.8E.1)
 *
 * Botão flutuante acessível no canto inferior direito da dashboard.
 * Visível EXCLUSIVAMENTE para usuários autenticados com papel tenant_admin comprovado no tenant ativo.
 * Oculto para barbeiros, recepção, financeiro, clientes, superadmin e não autenticados.
 *
 * Integra-se diretamente à Server Function canônica askAIAssistant.
 */
export function AIAssistantFloatingButton() {
  const { user, role, loading: authLoading } = useAuth();
  const { tenantId, isLoading: tenantLoading, ownedShop, membership } = useTenant();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiStatus, setAiStatus] = useState<"loading" | "active" | "disabled" | "unknown">("unknown");
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 1. RBAC estrito de visibilidade: exclusivo tenant_admin com vínculo comprovado ao tenant ativo
  const isAuthorizedAdmin =
    !authLoading &&
    !tenantLoading &&
    isProvenTenantAdmin({
      userId: user?.id,
      role,
      tenantId,
      ownedShop,
      membership,
    });

  // Se o usuário estiver na página dedicada do assistente, oculta o botão flutuante para evitar duplicidade
  const isOnAssistantPage = location.pathname.startsWith("/dashboard/assistente");

  // 2. Consulta de contexto e status do kill switch
  useEffect(() => {
    let isMounted = true;
    if (isAuthorizedAdmin && isOpen && aiStatus === "unknown") {
      setAiStatus("loading");
      resolveAIContext()
        .then((res: any) => {
          if (!isMounted) return;
          if (res.ai_assistant_enabled === false || res.status === "disabled") {
            setAiStatus("disabled");
            setStatusNotice(
              res.reason ||
              "O Assistente de IA está temporariamente desativado pela administração da plataforma."
            );
          } else {
            setAiStatus("active");
            setStatusNotice(null);
          }
        })
        .catch((err: any) => {
          if (!isMounted) return;
          setAiStatus("disabled");
          setStatusNotice(err.message || "Assistente temporariamente indisponível.");
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthorizedAdmin, isOpen, aiStatus]);

  // 3. Foco gerenciado ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // 4. Auto-scroll ao receber mensagens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // 5. Fechamento por teclado (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Se não for admin autorizado ou já estiver na página do assistente, não renderiza nada
  if (!isAuthorizedAdmin || isOnAssistantPage) {
    return null;
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = input.trim();
    if (!cleanText || isSubmitting || aiStatus === "disabled") return;

    if (cleanText.length > 500) {
      setStatusNotice("A pergunta deve conter no máximo 500 caracteres.");
      return;
    }

    setStatusNotice(null);
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: cleanText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSubmitting(true);

    try {
      const response = await askAIAssistant({
        data: { question: cleanText },
      });

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: "assistant",
        content: response.reply,
        sources: response.sources,
        isError: !response.success,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (!response.success && response.error === "GLOBAL_KILLSWITCH_DISABLED") {
        setAiStatus("disabled");
        setStatusNotice(response.reply);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
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

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Botão Flutuante (Trigger) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "group relative flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300",
            "focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#05070d]",
            isOpen
              ? "bg-slate-800 text-slate-200 hover:bg-slate-700 shadow-slate-900/50"
              : "bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 hover:from-amber-400 hover:to-amber-200 hover:scale-105 active:scale-95 shadow-amber-500/25"
          )}
          aria-label={isOpen ? "Fechar Assistente Barbex" : "Abrir Assistente Barbex"}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          title={isOpen ? "Fechar Assistente Barbex" : "Abrir Assistente Barbex"}
        >
          {isOpen ? (
            <X className="h-6 w-6 transition-transform group-hover:rotate-90 duration-200" />
          ) : (
            <>
              <Bot className="h-7 w-7 transition-transform group-hover:scale-110 duration-200" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center">
                  <Sparkles className="h-2.5 w-2.5 text-slate-950" />
                </span>
              </span>
            </>
          )}
        </button>
      </div>

      {/* Painel Flutuante do Assistente */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label="Assistente Barbex"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[400px] h-[540px] max-h-[calc(100vh-8rem)] rounded-2xl bg-[#0c101d] border border-white/10 shadow-2xl flex flex-col z-50 overflow-hidden backdrop-blur-2xl"
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">Assistente Barbex</h2>
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                      Canário
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Suporte Institucional</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  buttonRef.current?.focus();
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
                aria-label="Fechar painel do assistente"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Banner de Aviso de Status */}
            {statusNotice && (
              <div className="flex items-start gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span className="flex-1">{statusNotice}</span>
              </div>
            )}

            {/* Histórico da Conversa */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-3.5 text-sm"
              tabIndex={0}
              aria-label="Mensagens da conversa"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[85%] rounded-2xl p-3 leading-relaxed",
                    msg.role === "user"
                      ? "ml-auto bg-amber-500 text-slate-950 font-medium rounded-tr-sm shadow-sm"
                      : cn(
                        "mr-auto text-slate-200 rounded-tl-sm",
                        msg.isError
                          ? "bg-rose-950/40 border border-rose-500/30 text-rose-300"
                          : "bg-white/[0.06] border border-white/10"
                      )
                  )}
                >
                  <p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>

                  {/* Fontes de Conhecimento citadas */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Fontes da Central de Ajuda:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((src) => (
                          <span
                            key={src.id}
                            className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300"
                          >
                            <BookOpen className="h-2.5 w-2.5 text-amber-400" />
                            {src.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <span
                    className={cn(
                      "mt-1 text-[9px] self-end",
                      msg.role === "user" ? "text-slate-900/60" : "text-slate-400"
                    )}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}

              {/* Indicador de Carregamento */}
              {isSubmitting && (
                <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-tl-sm bg-white/[0.06] border border-white/10 px-3.5 py-2.5 text-xs text-slate-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                  <span aria-live="polite">Consultando base de conhecimento...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Rodapé / Input de Pergunta */}
            <form
              onSubmit={handleSend}
              className="border-t border-white/10 p-3 bg-white/[0.02]"
            >
              {aiStatus === "disabled" ? (
                <div className="text-center py-2 px-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-slate-400">
                  Assistente temporariamente desativado pela plataforma.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative flex items-end rounded-xl bg-white/[0.05] border border-white/10 focus-within:border-amber-400/50 transition-colors">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value.slice(0, 500))}
                      onKeyDown={handleInputKeyDown}
                      disabled={isSubmitting || aiStatus === "disabled"}
                      placeholder="Tire uma dúvida sobre o Barbex... (Enter para enviar)"
                      rows={2}
                      className="w-full resize-none bg-transparent px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none disabled:opacity-50"
                      aria-label="Pergunta para o Assistente Barbex"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isSubmitting || aiStatus === "disabled"}
                      className={cn(
                        "m-1.5 flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                        input.trim() && !isSubmitting
                          ? "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-sm"
                          : "bg-white/5 text-slate-500 cursor-not-allowed"
                      )}
                      aria-label="Enviar pergunta"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1 text-[10px] text-slate-400">
                    <span>Central de Ajuda Barbex</span>
                    <span>{input.length}/500</span>
                  </div>
                </div>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

