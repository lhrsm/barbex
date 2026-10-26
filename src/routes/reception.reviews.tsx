import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useReception } from "@/hooks/use-reception";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Star,
  Check,
  X as XIcon,
  MessageSquare,
  Search,
  Quote,
  Clock,
  User as UserIcon,
  Scissors,
  Calendar as CalendarIcon,
  Reply,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/reception/reviews")({
  head: () => ({
    meta: [
      { title: "Avaliações | Recepção Barbex" },
      { name: "description", content: "Moderação de avaliações e depoimentos de clientes da barbearia." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReceptionReviewsPage,
});

type FilterKey = "pending" | "approved" | "rejected" | "all";

function StarsDisplay({ value }: { value: number | null }) {
  if (value == null) return <span className="text-zinc-500 text-xs">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("h-3.5 w-3.5", n <= value ? "text-gold fill-gold" : "text-zinc-700")}
        />
      ))}
      <span className="ml-1 text-xs text-zinc-300 font-bold tabular-nums">{value}</span>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30", dot: "bg-amber-400" },
  approved: { label: "Aprovado", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  rejected: { label: "Rejeitado", cls: "bg-red-500/10 text-red-400 border-red-500/30", dot: "bg-red-400" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider shrink-0", meta.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function ReceptionReviewsPage() {
  const { tenantId, can, isOwner } = useReception();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [search, setSearch] = useState("");
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("appointment_reviews")
      .select("*, customers(name, phone), barbers(name), appointments(start_time, services(name))")
      .eq("tenant_id", tenantId)
      .or("submitted_at.not.is.null,service_rating.not.is.null,barbershop_rating.not.is.null,barber_rating.not.is.null")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar avaliações: " + error.message);
    }
    setReviews(data || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchReviews();

    if (!tenantId) return;

    const channelTopic = `reception-reviews-realtime-${tenantId}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment_reviews",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log("[RECEPTION_REVIEWS_REALTIME] Atualização detectada:", payload.eventType);
          fetchReviews();
        }
      )
      .subscribe((status, err) => {
        console.log("[RECEPTION_REVIEWS_REALTIME_STATUS]", {
          topic: channelTopic,
          status,
          error: err ? err.message : null,
        });
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          fetchReviews();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, fetchReviews]);

  const handleModerate = async (reviewId: string, action: "approve" | "reject") => {
    try {
      setProcessingId(reviewId);
      const { data, error } = await supabase.rpc("moderate_appointment_review", {
        p_review_id: reviewId,
        p_action: action,
      });

      if (error) {
        toast.error("Erro ao moderar: " + error.message);
        return;
      }

      toast.success(action === "approve" ? "Avaliação aprovada com sucesso!" : "Avaliação rejeitada.");
      fetchReviews();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "Falha na moderação"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReply = async (reviewId: string) => {
    const text = (replyDraft[reviewId] || "").trim();
    if (!text) {
      toast.error("Digite o texto da resposta.");
      return;
    }

    try {
      setProcessingId(reviewId);
      const { error } = await supabase.rpc("reply_to_appointment_review", {
        p_review_id: reviewId,
        p_reply: text,
      });

      if (error) {
        toast.error("Erro ao responder: " + error.message);
        return;
      }

      toast.success("Resposta enviada com sucesso!");
      setReplyOpen((s) => ({ ...s, [reviewId]: false }));
      fetchReviews();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "Falha ao enviar resposta"));
    } finally {
      setProcessingId(null);
    }
  };

  const submitted = useMemo(
    () => reviews.filter((r) => r.submitted_at || r.testimonial_text || r.barbershop_rating),
    [reviews]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return submitted.filter((r) => {
      if (filter !== "all" && r.testimonial_status !== filter) return false;
      if (!term) return true;
      const text = [
        r.customers?.name,
        r.barbers?.name,
        r.appointments?.services?.name,
        r.testimonial_text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(term);
    });
  }, [submitted, filter, search]);

  const counts = useMemo(
    () => ({
      pending: submitted.filter((r) => r.testimonial_status === "pending").length,
      approved: submitted.filter((r) => r.testimonial_status === "approved").length,
      rejected: submitted.filter((r) => r.testimonial_status === "rejected").length,
      all: submitted.length,
    }),
    [submitted]
  );

  const TABS: { key: FilterKey; label: string }[] = [
    { key: "pending", label: "Pendentes" },
    { key: "approved", label: "Aprovados" },
    { key: "rejected", label: "Rejeitados" },
    { key: "all", label: "Todos" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <MessageSquare className="h-6 w-6 text-gold" />
            Moderação de Avaliações
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Acompanhe em tempo real e modere depoimentos e notas atribuídas por clientes.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Sincronização em tempo real ativa
        </div>
      </header>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-x-auto">
          {TABS.map((tab) => {
            const count = counts[tab.key];
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                  active
                    ? "bg-gold text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                )}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-bold",
                      active ? "bg-zinc-950/20 text-zinc-950" : "bg-zinc-800 text-zinc-300"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar por cliente, barbeiro ou texto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900/80 border-zinc-800 text-xs h-9"
          />
        </div>
      </div>

      {/* Listagem de Avaliações */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-zinc-900/50 border border-zinc-800/80 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-zinc-800/80 rounded-2xl bg-zinc-900/30">
          <MessageSquare className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm font-medium">Nenhuma avaliação encontrada.</p>
          <p className="text-zinc-600 text-xs mt-1">
            {filter === "pending"
              ? "Não há avaliações aguardando moderação no momento."
              : "Nenhum registro corresponde ao filtro aplicado."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const dateStr = r.submitted_at || r.created_at;
            const formattedDate = dateStr
              ? format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
              : "—";

            return (
              <div
                key={r.id}
                className={cn(
                  "p-4 rounded-xl border bg-zinc-900/60 backdrop-blur transition-all",
                  r.testimonial_status === "pending"
                    ? "border-amber-500/30 shadow-[0_4px_20px_-10px_rgba(245,158,11,0.15)]"
                    : "border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <StatusBadge status={r.testimonial_status || "pending"} />
                      <span className="font-semibold text-white text-sm">
                        {r.customers?.name || "Cliente sem identificação"}
                      </span>
                      {r.customers?.phone && (
                        <span className="text-xs text-zinc-500 font-mono">
                          {r.customers.phone}
                        </span>
                      )}
                      <span className="text-xs text-zinc-500">•</span>
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {formattedDate}
                      </span>
                    </div>

                    {/* Ratings */}
                    <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                      {r.barbershop_rating != null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-400">Barbearia:</span>
                          <StarsDisplay value={r.barbershop_rating} />
                        </div>
                      )}
                      {r.service_rating != null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-400">Atendimento:</span>
                          <StarsDisplay value={r.service_rating} />
                        </div>
                      )}
                      {r.barber_rating != null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-400">Profissional ({r.barbers?.name || "Barbeiro"}):</span>
                          <StarsDisplay value={r.barber_rating} />
                        </div>
                      )}
                    </div>

                    {/* Depoimento / Comentário */}
                    {r.testimonial_text && (
                      <div className="mt-2 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-sm text-zinc-200">
                        <Quote className="h-3.5 w-3.5 text-gold/60 inline mr-1.5 -mt-1" />
                        <span>{r.testimonial_text}</span>
                      </div>
                    )}

                    {/* Resposta da Barbearia */}
                    {r.reply && (
                      <div className="mt-2 pl-3 border-l-2 border-gold/40 text-xs text-zinc-400">
                        <span className="text-gold font-bold block mb-0.5">Resposta da equipe:</span>
                        <span>{r.reply}</span>
                      </div>
                    )}
                  </div>

                  {/* Ações de Moderação */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                    {r.testimonial_status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processingId === r.id}
                          onClick={() => handleModerate(r.id, "approve")}
                          className="h-8 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1.5 text-xs font-semibold"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processingId === r.id}
                          onClick={() => handleModerate(r.id, "reject")}
                          className="h-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 gap-1.5 text-xs font-semibold"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                          Rejeitar
                        </Button>
                      </>
                    )}

                    {r.testimonial_status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === r.id}
                        onClick={() => handleModerate(r.id, "reject")}
                        className="h-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border-zinc-800 text-xs"
                      >
                        Rejeitar
                      </Button>
                    )}

                    {r.testimonial_status === "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === r.id}
                        onClick={() => handleModerate(r.id, "approve")}
                        className="h-8 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 border-zinc-800 text-xs"
                      >
                        Aprovar
                      </Button>
                    )}

                    {!r.reply && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReplyOpen((s) => ({ ...s, [r.id]: !s[r.id] }))}
                        className="h-8 text-zinc-400 hover:text-white text-xs gap-1"
                      >
                        <Reply className="h-3.5 w-3.5" />
                        Responder
                      </Button>
                    )}
                  </div>
                </div>

                {/* Form de Resposta */}
                {replyOpen[r.id] && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2">
                    <Textarea
                      placeholder="Escreva a resposta da barbearia..."
                      value={replyDraft[r.id] || ""}
                      onChange={(e) =>
                        setReplyDraft((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      className="text-xs bg-zinc-950/80 border-zinc-800 min-h-[60px]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReplyOpen((s) => ({ ...s, [r.id]: false }))}
                        className="h-7 text-xs text-zinc-500"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        disabled={processingId === r.id}
                        onClick={() => handleReply(r.id)}
                        className="h-7 text-xs bg-gold hover:bg-gold/90 text-zinc-950 font-bold gap-1"
                      >
                        <Send className="h-3 w-3" />
                        Publicar Resposta
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
