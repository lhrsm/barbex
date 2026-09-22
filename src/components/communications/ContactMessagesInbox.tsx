import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Mail,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  User,
  Calendar,
  Eye,
  RefreshCw,
  Loader2,
  MailQuestion,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export interface ContactMessage {
  id: string;
  tenant_id: string;
  shop_slug: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  subject: string | null;
  message: string;
  read: boolean;
  read_at: string | null;
  email_status: "pending" | "sent" | "failed" | "provider_unconfigured" | string;
  email_recipient: string | null;
  email_provider_message_id: string | null;
  email_attempt_at: string | null;
  email_error_code: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  tenantId: string;
}

type UntypedDbClient = {
  from: (table: string) => ReturnType<typeof supabase.from>;
};
const untypedDb = supabase as unknown as UntypedDbClient;

export function ContactMessagesInbox({ tenantId }: Props) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRead, setFilterRead] = useState<"all" | "unread" | "read">("all");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 1. Fetch Contact Messages strictly scoped to current tenant
  const {
    data: messages = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ContactMessage[]>({
    queryKey: ["contact-messages", tenantId],
    queryFn: async () => {
      const { data, error: fetchErr } = await untypedDb
        .from("contact_messages")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      return (data || []) as unknown as ContactMessage[];
    },
    enabled: !!tenantId,
  });

  // 2. Mutation to Toggle Read Status
  const toggleReadMutation = useMutation({
    mutationFn: async ({ messageId, nextRead }: { messageId: string; nextRead: boolean }) => {
      const { error: updateErr } = await untypedDb
        .from("contact_messages")
        .update({
          read: nextRead,
          read_at: nextRead ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .eq("id", messageId)
        .eq("tenant_id", tenantId);

      if (updateErr) throw new Error(updateErr.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages", tenantId] });
      if (selectedMessage && selectedMessage.id === variables.messageId) {
        setSelectedMessage((prev) =>
          prev
            ? {
                ...prev,
                read: variables.nextRead,
                read_at: variables.nextRead ? new Date().toISOString() : null,
              }
            : null,
        );
      }
      toast.success(
        variables.nextRead ? "Mensagem marcada como lida." : "Mensagem marcada como não lida.",
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar status da mensagem.");
    },
  });

  // Filter messages
  const filteredMessages = messages.filter((msg) => {
    if (filterRead === "unread" && msg.read) return false;
    if (filterRead === "read" && !msg.read) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSender = msg.sender_name?.toLowerCase().includes(q);
      const matchEmail = msg.sender_email?.toLowerCase().includes(q);
      const matchSubject = msg.subject?.toLowerCase().includes(q);
      const matchPhone = msg.sender_phone?.toLowerCase().includes(q);
      const matchContent = msg.message?.toLowerCase().includes(q);
      return matchSender || matchEmail || matchSubject || matchPhone || matchContent;
    }

    return true;
  });

  const unreadCount = messages.filter((m) => !m.read).length;

  const handleOpenDetail = (msg: ContactMessage) => {
    setSelectedMessage(msg);
    setIsDetailOpen(true);
    // Mark as read automatically when opening if unread
    if (!msg.read) {
      toggleReadMutation.mutate({ messageId: msg.id, nextRead: true });
    }
  };

  const renderEmailBadge = (status: string, errorCode?: string | null) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
            <CheckCircle2 size={11} className="mr-1 inline" /> Notificado por E-mail
          </Badge>
        );
      case "provider_unconfigured":
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
            <MailQuestion size={11} className="mr-1 inline" /> E-mail Não Configurado
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] font-bold">
            <AlertCircle size={11} className="mr-1 inline" /> Falha no Envio{" "}
            {errorCode ? `(${errorCode})` : ""}
          </Badge>
        );
      default:
        return (
          <Badge className="bg-zinc-800 text-zinc-400 border-none text-[10px]">
            <Clock size={11} className="mr-1 inline" /> Pendente
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail, assunto..."
            className="pl-10 h-11 bg-[#0b0f17] border-zinc-800 focus:border-gold/40 text-white rounded-xl text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0b0f17] border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setFilterRead("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterRead === "all" ? "bg-gold text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              Todas ({messages.length})
            </button>
            <button
              onClick={() => setFilterRead("unread")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterRead === "unread"
                  ? "bg-amber-500 text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Não lidas ({unreadCount})
            </button>
            <button
              onClick={() => setFilterRead("read")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterRead === "read" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Lidas ({messages.length - unreadCount})
            </button>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="h-11 w-11 border-zinc-800 bg-[#0b0f17] hover:border-gold/40 text-zinc-300 rounded-xl"
            title="Atualizar mensagens"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} />
            <span className="text-sm">
              Erro ao carregar mensagens:{" "}
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-red-500/30 text-xs"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Table Card */}
      <Card className="bg-[#0b0f17] border-zinc-800/80 overflow-hidden rounded-2xl shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40">
                <th className="p-4 text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  Status
                </th>
                <th className="p-4 text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  Remetente
                </th>
                <th className="p-4 text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  Assunto & Mensagem
                </th>
                <th className="p-4 text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  Notificação E-mail
                </th>
                <th className="p-4 text-[11px] font-black uppercase tracking-wider text-zinc-400 text-right">
                  Data
                </th>
                <th className="p-4 text-[11px] font-black uppercase tracking-wider text-zinc-400 text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map((msg) => (
                <tr
                  key={msg.id}
                  onClick={() => handleOpenDetail(msg)}
                  className={`border-b border-zinc-800/50 hover:bg-white/[0.02] transition-colors cursor-pointer ${
                    !msg.read ? "bg-amber-500/[0.03]" : ""
                  }`}
                >
                  <td className="p-4 whitespace-nowrap">
                    {!msg.read ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />{" "}
                        Nova
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-medium">Lida</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span
                        className={`text-sm ${!msg.read ? "font-bold text-white" : "text-zinc-300"}`}
                      >
                        {msg.sender_name}
                      </span>
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Mail size={12} /> {msg.sender_email}
                      </span>
                      {msg.sender_phone && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Phone size={12} className="text-emerald-500" /> {msg.sender_phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 max-w-sm">
                    <div className="flex flex-col">
                      <span
                        className={`text-sm truncate ${!msg.read ? "font-bold text-white" : "text-zinc-300"}`}
                      >
                        {msg.subject || "Sem assunto"}
                      </span>
                      <span className="text-xs text-zinc-500 truncate">{msg.message}</span>
                    </div>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {renderEmailBadge(msg.email_status, msg.email_error_code)}
                  </td>
                  <td className="p-4 text-right whitespace-nowrap text-xs text-zinc-400">
                    {format(new Date(msg.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </td>
                  <td
                    className="p-4 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDetail(msg)}
                        className="text-zinc-400 hover:text-white text-xs h-8 px-2"
                      >
                        <Eye size={14} className="mr-1" /> Ver
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={toggleReadMutation.isPending}
                        onClick={() =>
                          toggleReadMutation.mutate({ messageId: msg.id, nextRead: !msg.read })
                        }
                        className="text-xs h-8 px-2 text-zinc-400 hover:text-gold"
                      >
                        {msg.read ? "Marcar não lida" : "Marcar lida"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredMessages.length && !isLoading && (
                <tr>
                  <td colSpan={6} className="p-16 text-center text-zinc-500">
                    <Mail size={36} className="mx-auto mb-3 opacity-20 text-gold" />
                    <p className="text-base font-bold text-zinc-400">Nenhuma mensagem encontrada</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {searchQuery
                        ? "Nenhuma mensagem corresponde aos critérios de busca."
                        : filterRead === "unread"
                          ? "Você não possui mensagens não lidas no momento."
                          : "As mensagens enviadas pelo formulário de contato do site aparecerão aqui."}
                    </p>
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-16 text-center text-zinc-500">
                    <Loader2 size={32} className="mx-auto mb-2 animate-spin text-gold" />
                    <p className="text-xs">Carregando mensagens da caixa de entrada...</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Message Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl bg-[#0b0f17] border border-zinc-800 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between gap-4">
              <span>{selectedMessage?.subject || "Mensagem de Contato"}</span>
              {selectedMessage &&
                renderEmailBadge(selectedMessage.email_status, selectedMessage.email_error_code)}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Enviada em{" "}
              {selectedMessage?.created_at
                ? format(
                    new Date(selectedMessage.created_at),
                    "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                    { locale: ptBR },
                  )
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-6 pt-2">
              {/* Sender info card */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-gold shrink-0" />
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                      Remetente
                    </span>
                    <span className="font-semibold text-zinc-200">
                      {selectedMessage.sender_name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-gold shrink-0" />
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                      E-mail
                    </span>
                    <a
                      href={`mailto:${selectedMessage.sender_email}`}
                      className="text-amber-400 hover:underline font-semibold"
                    >
                      {selectedMessage.sender_email}
                    </a>
                  </div>
                </div>

                {selectedMessage.sender_phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                        WhatsApp / Telefone
                      </span>
                      <a
                        href={`https://wa.me/${selectedMessage.sender_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline font-semibold"
                      >
                        {selectedMessage.sender_phone}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gold shrink-0" />
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                      Loja / Slug
                    </span>
                    <span className="text-zinc-400 font-mono">/{selectedMessage.shop_slug}</span>
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                  Conteúdo da Mensagem
                </label>
                <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap min-h-[140px]">
                  {selectedMessage.message}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800/80">
                <div className="text-[11px] text-zinc-500">
                  ID: <span className="font-mono text-zinc-400">{selectedMessage.id}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toggleReadMutation.mutate({
                        messageId: selectedMessage.id,
                        nextRead: !selectedMessage.read,
                      })
                    }
                    className="border-zinc-800 hover:border-gold/40 text-xs"
                  >
                    {selectedMessage.read ? "Marcar como não lida" : "Marcar como lida"}
                  </Button>

                  <Button
                    size="sm"
                    className="bg-gold text-black font-bold hover:bg-gold/90 text-xs"
                    onClick={() => {
                      if (selectedMessage.sender_phone) {
                        window.open(
                          `https://wa.me/${selectedMessage.sender_phone.replace(/\D/g, "")}`,
                          "_blank",
                        );
                      } else {
                        window.location.href = `mailto:${selectedMessage.sender_email}?subject=Re: ${encodeURIComponent(
                          selectedMessage.subject || "Contato",
                        )}`;
                      }
                    }}
                  >
                    Responder Cliente
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
