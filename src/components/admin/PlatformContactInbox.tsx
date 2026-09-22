import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare,
  Search,
  Mail,
  Phone,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  RefreshCw,
  Send,
  ShieldAlert,
  Reply,
  Lock,
  ExternalLink,
  MessageSquareReply,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlatformMessage {
  id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  company: string | null;
  subject: string | null;
  message: string;
  read: boolean;
  read_at: string | null;
  email_status: "pending" | "sent" | "failed";
  email_recipient: string | null;
  email_provider_message_id: string | null;
  email_attempt_at: string | null;
  email_error_code: string | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

interface PlatformMessageReply {
  id: string;
  message_id: string;
  admin_id: string | null;
  admin_email: string | null;
  subject: string;
  content: string;
  recipient_email: string;
  status: "pending" | "accepted_by_provider" | "failed";
  provider_message_id: string | null;
  provider_error_code: string | null;
  attempt_at: string;
  created_at: string;
  updated_at: string;
}

export function PlatformContactInbox() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRead, setFilterRead] = useState<"all" | "unread" | "read">("all");
  const [selectedMessage, setSelectedMessage] = useState<PlatformMessage | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyContent, setReplyContent] = useState("");

  // 1. Fetch Platform Messages
  const {
    data: messages = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<PlatformMessage[]>({
    queryKey: ["platform-contact-messages"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchErr } = await (supabase as any)
        .from("platform_contact_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      return (data || []) as PlatformMessage[];
    },
  });

  // 2. Mutation to Toggle Read Status
  const toggleReadMutation = useMutation({
    mutationFn: async ({ messageId, nextRead }: { messageId: string; nextRead: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase as any)
        .from("platform_contact_messages")
        .update({
          read: nextRead,
          read_at: nextRead ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      if (updateErr) throw new Error(updateErr.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["platform-contact-messages"] });
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
      toast.success(variables.nextRead ? "Marcada como lida" : "Marcada como não lida");
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar status: " + err.message);
    },
  });

  // 3. Query Replies for Selected Message
  const { data: messageReplies = [], isLoading: isLoadingReplies } = useQuery<
    PlatformMessageReply[]
  >({
    queryKey: ["platform-contact-replies", selectedMessage?.id],
    queryFn: async () => {
      if (!selectedMessage?.id) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchRepliesErr } = await (supabase as any)
        .from("platform_contact_replies")
        .select("*")
        .eq("message_id", selectedMessage.id)
        .order("created_at", { ascending: false });

      if (fetchRepliesErr) {
        throw new Error(fetchRepliesErr.message);
      }
      return (data || []) as PlatformMessageReply[];
    },
    enabled: Boolean(selectedMessage?.id),
  });

  // 4. Mutation to Send Direct Reply via Edge Function
  const sendReplyMutation = useMutation({
    mutationFn: async ({
      messageId,
      subject,
      content,
    }: {
      messageId: string;
      subject: string;
      content: string;
    }) => {
      const { data, error: invokeErr } = await supabase.functions.invoke("contact-platform-reply", {
        body: {
          messageId,
          subject,
          content,
        },
      });

      if (invokeErr) {
        throw new Error(invokeErr.message || "Erro na comunicação com o servidor.");
      }

      if (!data?.ok) {
        throw new Error(data?.error || "O provedor de e-mail rejeitou o envio.");
      }

      return data.data;
    },
    onSuccess: () => {
      toast.success("Resposta enviada com sucesso e aceita pelo provedor Resend!");
      queryClient.invalidateQueries({
        queryKey: ["platform-contact-replies", selectedMessage?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["platform-contact-messages"] });
      setReplyContent("");
      setIsReplyOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Falha ao enviar resposta: " + err.message);
      // Draft text is safely preserved in replyContent!
    },
  });

  const handleOpenReplyModal = () => {
    if (!selectedMessage) return;
    const defaultSubject = selectedMessage.subject?.trim()
      ? selectedMessage.subject.toLowerCase().startsWith("re:")
        ? selectedMessage.subject
        : `Re: ${selectedMessage.subject}`
      : "Re: Contato Barbex";
    setReplySubject((prev) => (prev.trim() ? prev : defaultSubject));
    setIsReplyOpen(true);
  };

  const handleOpenDetail = (msg: PlatformMessage) => {
    setSelectedMessage(msg);
    setIsDetailOpen(true);

    if (!msg.read) {
      toggleReadMutation.mutate({ messageId: msg.id, nextRead: true });
    }
  };

  const filteredMessages = messages.filter((m) => {
    const matchesSearch =
      !searchQuery.trim() ||
      m.sender_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.sender_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.subject && m.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.company && m.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.message.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterRead === "all" ||
      (filterRead === "unread" && !m.read) ||
      (filterRead === "read" && m.read);

    return matchesSearch && matchesFilter;
  });

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white uppercase italic tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            Contato da Plataforma
          </h2>
          <p className="text-xs text-slate-400">
            Mensagens institucionais recebidas através do formulário oficial em
            barbex.shop/#contato.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          {unreadCount > 0 && (
            <Badge className="bg-purple-600/20 text-purple-400 border-purple-500/30 text-xs px-2.5 py-1">
              {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}
            </Badge>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Buscar por nome, e-mail, assunto, empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-white/5 border-white/10 rounded-xl text-white text-xs placeholder:text-slate-500 focus:border-purple-500/50"
          />
        </div>

        <div className="flex gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl">
          {[
            { id: "all", label: "Todas" },
            { id: "unread", label: "Não lidas" },
            { id: "read", label: "Lidas" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterRead(tab.id as "all" | "unread" | "read")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterRead === tab.id
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages List */}
      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto" />
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
            Carregando mensagens da plataforma...
          </p>
        </div>
      ) : isError ? (
        <Card className="glass border-rose-500/20 bg-rose-500/5 p-8 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
          <h4 className="text-white font-bold text-sm">Falha ao carregar mensagens</h4>
          <p className="text-xs text-rose-300">
            {error instanceof Error ? error.message : "Erro desconhecido"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-white/10 text-xs"
          >
            Tentar novamente
          </Button>
        </Card>
      ) : filteredMessages.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-white/[0.02] border border-white/5 rounded-2xl">
          <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-white font-bold text-sm">Nenhuma mensagem encontrada</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? "Nenhum resultado corresponde aos termos da busca."
              : "Nenhuma mensagem institucional recebida até o momento."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => handleOpenDetail(msg)}
              className={`group p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                msg.read
                  ? "bg-white/[0.02] border-white/5 hover:border-white/10 opacity-80 hover:opacity-100"
                  : "bg-purple-500/[0.05] border-purple-500/20 hover:border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.05)]"
              }`}
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {!msg.read && (
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 animate-pulse" />
                  )}
                  <span className="text-white font-bold text-sm truncate">{msg.sender_name}</span>
                  {msg.company && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                      <Building2 size={12} className="text-slate-500" />
                      {msg.company}
                    </span>
                  )}
                  <span className="text-slate-500 text-xs">•</span>
                  <span className="text-xs text-slate-400 truncate">{msg.sender_email}</span>
                </div>

                <p className="text-xs text-slate-300 font-medium truncate">
                  {msg.subject || "Sem assunto"}
                </p>

                <p className="text-[11px] text-slate-500 line-clamp-1">{msg.message}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                {/* Email Delivery Status */}
                {msg.email_status === "sent" && (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
                    <CheckCircle2 size={10} /> Notificado
                  </Badge>
                )}
                {msg.email_status === "failed" && (
                  <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] gap-1">
                    <AlertCircle size={10} /> Falha E-mail
                  </Badge>
                )}
                {msg.email_status === "pending" && (
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] gap-1">
                    <Clock size={10} /> Pendente
                  </Badge>
                )}

                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Calendar size={12} />
                  {format(new Date(msg.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 group-hover:text-white h-8 w-8 p-0"
                >
                  <Eye size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl bg-[#090D1A] border-white/10 text-white p-6 sm:p-8 rounded-3xl">
          {selectedMessage && (
            <div className="space-y-6">
              <DialogHeader className="space-y-2 border-b border-white/5 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Mail className="w-5 h-5 text-purple-400" />
                    {selectedMessage.subject || "Contato pelo Site"}
                  </DialogTitle>
                  <div className="flex items-center gap-2">
                    {selectedMessage.email_status === "sent" && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                        E-mail entregue ao provedor
                      </Badge>
                    )}
                    {selectedMessage.email_status === "failed" && (
                      <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-xs">
                        Falha no envio de e-mail
                      </Badge>
                    )}
                  </div>
                </div>
                <DialogDescription className="text-xs text-slate-400">
                  Enviado em{" "}
                  {format(
                    new Date(selectedMessage.created_at),
                    "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                    {
                      locale: ptBR,
                    },
                  )}
                </DialogDescription>
              </DialogHeader>

              {/* Sender Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white/[0.03] border border-white/5 rounded-2xl text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                    Remetente
                  </span>
                  <span className="font-semibold text-white">{selectedMessage.sender_name}</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                    E-mail
                  </span>
                  <a
                    href={`mailto:${selectedMessage.sender_email}`}
                    className="font-semibold text-purple-400 hover:underline"
                  >
                    {selectedMessage.sender_email}
                  </a>
                </div>

                {selectedMessage.sender_phone && (
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                      Telefone / WhatsApp
                    </span>
                    <a
                      href={`tel:${selectedMessage.sender_phone}`}
                      className="font-semibold text-slate-300 hover:underline"
                    >
                      {selectedMessage.sender_phone}
                    </a>
                  </div>
                )}

                {selectedMessage.company && (
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                      Empresa
                    </span>
                    <span className="font-semibold text-slate-300">{selectedMessage.company}</span>
                  </div>
                )}
              </div>

              {/* Message Body */}
              <div className="space-y-2">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                  Conteúdo da Mensagem
                </span>
                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {selectedMessage.message}
                </div>
              </div>

              {/* Delivery Metadata */}
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[11px] text-slate-400 flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  <strong>Destinatário Notificado:</strong>{" "}
                  {selectedMessage.email_recipient || "contato@lmstartup.com.br"}
                </span>
                {selectedMessage.email_provider_message_id && (
                  <span>
                    <strong>Resend ID:</strong> {selectedMessage.email_provider_message_id}
                  </span>
                )}
                {selectedMessage.email_error_code && (
                  <span className="text-rose-400">
                    <strong>Erro Provedor:</strong> {selectedMessage.email_error_code}
                  </span>
                )}
                {selectedMessage.ip_address && (
                  <span>
                    <strong>IP:</strong> {selectedMessage.ip_address}
                  </span>
                )}
              </div>

              {/* Reply History Section */}
              <div className="space-y-3 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                    <MessageSquareReply size={14} className="text-purple-400" />
                    Histórico de Respostas ({messageReplies.length})
                  </span>
                  {isLoadingReplies && (
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <RefreshCw size={10} className="animate-spin" /> Carregando histórico...
                    </span>
                  )}
                </div>

                {messageReplies.length === 0 ? (
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                    <p className="text-xs text-slate-500">
                      Nenhuma resposta foi enviada pelo painel para esta mensagem até o momento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {messageReplies.map((reply) => (
                      <div
                        key={reply.id}
                        className="p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            {reply.status === "accepted_by_provider" && (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
                                <CheckCircle2 size={10} /> Aceito pelo provedor
                              </Badge>
                            )}
                            {reply.status === "failed" && (
                              <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] gap-1">
                                <AlertCircle size={10} /> Falha no envio
                              </Badge>
                            )}
                            {reply.status === "pending" && (
                              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] gap-1">
                                <Clock size={10} className="animate-spin" /> Processando
                              </Badge>
                            )}
                            <span className="text-slate-400 text-[11px] font-medium">
                              {reply.admin_email || "Super Admin"}
                            </span>
                          </div>

                          <span className="text-slate-500 text-[11px] flex items-center gap-1">
                            <Calendar size={11} />
                            {format(new Date(reply.created_at), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] font-semibold text-slate-300 block">
                            Assunto: {reply.subject}
                          </span>
                          <div className="mt-1 p-2.5 bg-black/40 border border-white/5 rounded-xl text-slate-200 text-xs whitespace-pre-wrap leading-relaxed">
                            {reply.content}
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5 pt-1 border-t border-white/5">
                          <span>
                            <strong>Destino:</strong> {reply.recipient_email}
                          </span>
                          {reply.provider_message_id && (
                            <span>
                              <strong>Resend ID:</strong> {reply.provider_message_id} (em trânsito)
                            </span>
                          )}
                          {reply.provider_error_code && (
                            <span className="text-rose-400">
                              <strong>Erro:</strong> {reply.provider_error_code}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toggleReadMutation.mutate({
                      messageId: selectedMessage.id,
                      nextRead: !selectedMessage.read,
                    })
                  }
                  className="border-white/10 text-xs order-2 sm:order-1"
                >
                  {selectedMessage.read ? "Marcar como não lida" : "Marcar como lida"}
                </Button>

                <div className="flex items-center gap-2 order-1 sm:order-2 self-end sm:self-auto">
                  <a
                    href={`mailto:${selectedMessage.sender_email}?subject=Re: ${encodeURIComponent(
                      selectedMessage.subject || "Contato pelo Barbex",
                    )}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-xs transition-all"
                  >
                    <ExternalLink size={12} /> Responder por E-mail
                  </a>

                  <Button
                    size="sm"
                    onClick={handleOpenReplyModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                  >
                    <Reply size={12} /> Responder pelo painel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Direct Reply Dialog Modal */}
      <Dialog open={isReplyOpen} onOpenChange={setIsReplyOpen}>
        <DialogContent className="max-w-xl bg-[#090D1A] border-white/10 text-white p-6 sm:p-7 rounded-3xl">
          <DialogHeader className="space-y-1.5 border-b border-white/5 pb-4">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquareReply className="w-5 h-5 text-purple-400" />
              Responder pelo Painel
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Sua resposta oficial será enviada por e-mail diretamente ao visitante através da
              Resend.
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4 pt-2">
              {/* Recipient Info Card (Read-only security badge) */}
              <div className="p-3.5 bg-white/[0.03] border border-white/5 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Destinatário Original
                  </span>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-400 text-[10px] gap-1 py-0.5"
                  >
                    <Lock size={10} /> Protegido via Banco
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-white truncate">
                    {selectedMessage.sender_name}
                  </div>
                  <div className="text-purple-300 font-mono text-[11px] truncate">
                    {selectedMessage.sender_email}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 border-t border-white/5 pt-1.5 flex items-center justify-between flex-wrap gap-1">
                  <span>Remetente: Barbex &lt;nao-responder@notify.barbex.shop&gt;</span>
                  <span>Respostas para: contato@lmstartup.com.br</span>
                </div>
              </div>

              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300">
                  Assunto da resposta
                </label>
                <Input
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  placeholder="Re: Assunto da mensagem..."
                  className="h-10 bg-white/5 border-white/10 rounded-xl text-white text-xs placeholder:text-slate-500 focus:border-purple-500/50"
                  maxLength={200}
                />
              </div>

              {/* Content Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Mensagem da resposta
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {replyContent.length} / 10.000
                  </span>
                </div>
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Escreva sua resposta institucional aqui..."
                  rows={6}
                  className="bg-white/5 border-white/10 rounded-xl text-white text-xs placeholder:text-slate-500 focus:border-purple-500/50 resize-none min-h-[140px]"
                  maxLength={10000}
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsReplyOpen(false)}
                  disabled={sendReplyMutation.isPending}
                  className="border-white/10 text-xs"
                >
                  Cancelar
                </Button>

                <Button
                  size="sm"
                  onClick={() =>
                    sendReplyMutation.mutate({
                      messageId: selectedMessage.id,
                      subject: replySubject,
                      content: replyContent,
                    })
                  }
                  disabled={!replyContent.trim() || sendReplyMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs gap-1.5 px-4 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                >
                  {sendReplyMutation.isPending ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" /> Enviando resposta...
                    </>
                  ) : (
                    <>
                      <Send size={12} /> Enviar resposta
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
