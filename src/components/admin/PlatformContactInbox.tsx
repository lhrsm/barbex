import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare,
  Search,
  Mail,
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
  Archive,
  ArchiveRestore,
  Trash2,
  Inbox,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  status: "inbox" | "archived" | "trashed";
  archived_at: string | null;
  trashed_at: string | null;
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

type UntypedDbClient = {
  from: (table: string) => ReturnType<typeof supabase.from>;
};
const untypedDb = supabase as unknown as UntypedDbClient;

export function PlatformContactInbox() {
  const queryClient = useQueryClient();
  const [activeFolder, setActiveFolder] = useState<"inbox" | "archived" | "trashed">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRead, setFilterRead] = useState<"all" | "unread" | "read">("all");
  const [selectedMessage, setSelectedMessage] = useState<PlatformMessage | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyContent, setReplyContent] = useState("");

  // Lifecycle Multi-selection & Delete Confirmation State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
      const { data, error: fetchErr } = await untypedDb
        .from("platform_contact_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      return (data || []) as unknown as PlatformMessage[];
    },
  });

  // 2. Mutation to Toggle Read Status
  const toggleReadMutation = useMutation({
    mutationFn: async ({ messageId, nextRead }: { messageId: string; nextRead: boolean }) => {
      const { error: updateErr } = await untypedDb
        .from("platform_contact_messages")
        .update({
          read: nextRead,
          read_at: nextRead ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
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

  // 3. Lifecycle Mutations (Archive, Trash, Restore, Permanent Delete)
  const archiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error: updateErr } = await untypedDb
        .from("platform_contact_messages")
        .update({
          status: "archived",
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .in("id", ids);

      if (updateErr) throw new Error(updateErr.message);
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["platform-contact-messages"] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      if (selectedMessage && ids.includes(selectedMessage.id)) {
        setIsDetailOpen(false);
      }
      toast.success(
        ids.length === 1
          ? "Mensagem arquivada com sucesso."
          : `${ids.length} mensagens arquivadas.`,
      );
    },
    onError: (err: Error) => {
      toast.error("Erro ao arquivar mensagem: " + err.message);
    },
  });

  const trashMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error: updateErr } = await untypedDb
        .from("platform_contact_messages")
        .update({
          status: "trashed",
          trashed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .in("id", ids);

      if (updateErr) throw new Error(updateErr.message);
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["platform-contact-messages"] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      if (selectedMessage && ids.includes(selectedMessage.id)) {
        setIsDetailOpen(false);
      }
      toast.success(
        ids.length === 1
          ? "Mensagem enviada para a lixeira."
          : `${ids.length} mensagens enviadas para a lixeira.`,
      );
    },
    onError: (err: Error) => {
      toast.error("Erro ao mover para a lixeira: " + err.message);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error: updateErr } = await untypedDb
        .from("platform_contact_messages")
        .update({
          status: "inbox",
          archived_at: null,
          trashed_at: null,
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .in("id", ids);

      if (updateErr) throw new Error(updateErr.message);
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["platform-contact-messages"] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      if (selectedMessage && ids.includes(selectedMessage.id)) {
        setIsDetailOpen(false);
      }
      toast.success(
        ids.length === 1
          ? "Mensagem restaurada para a caixa de entrada."
          : `${ids.length} mensagens restauradas.`,
      );
    },
    onError: (err: Error) => {
      toast.error("Erro ao restaurar mensagem: " + err.message);
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error: delErr } = await untypedDb
        .from("platform_contact_messages")
        .delete()
        .in("id", ids);

      if (delErr) throw new Error(delErr.message);
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["platform-contact-messages"] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      if (selectedMessage && ids.includes(selectedMessage.id)) {
        setIsDetailOpen(false);
      }
      setIsDeleteDialogOpen(false);
      setDeleteTargetIds([]);
      toast.success(
        ids.length === 1
          ? "Mensagem excluída definitivamente."
          : `${ids.length} mensagens excluídas definitivamente.`,
      );
    },
    onError: (err: Error) => {
      toast.error("Erro ao excluir mensagem: " + err.message);
    },
  });

  // 4. Query Replies for Selected Message
  const { data: messageReplies = [], isLoading: isLoadingReplies } = useQuery<
    PlatformMessageReply[]
  >({
    queryKey: ["platform-contact-replies", selectedMessage?.id],
    queryFn: async () => {
      if (!selectedMessage?.id) return [];
      const { data, error: fetchRepliesErr } = await untypedDb
        .from("platform_contact_replies")
        .select("*")
        .eq("message_id", selectedMessage.id)
        .order("created_at", { ascending: false });

      if (fetchRepliesErr) {
        throw new Error(fetchRepliesErr.message);
      }
      return (data || []) as unknown as PlatformMessageReply[];
    },
    enabled: Boolean(selectedMessage?.id),
  });

  // 5. Mutation to Send Direct Reply via Edge Function
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

  const handleConfirmPermanentDelete = (ids: string[]) => {
    setDeleteTargetIds(ids);
    setIsDeleteDialogOpen(true);
  };

  // Folder Counts
  const inboxCount = messages.filter((m) => (m.status || "inbox") === "inbox").length;
  const archivedCount = messages.filter((m) => m.status === "archived").length;
  const trashedCount = messages.filter((m) => m.status === "trashed").length;
  const unreadInboxCount = messages.filter(
    (m) => (m.status || "inbox") === "inbox" && !m.read,
  ).length;

  // Filter messages based on activeFolder, search, read
  const filteredMessages = messages.filter((m) => {
    const itemStatus = m.status || "inbox";
    if (itemStatus !== activeFolder) return false;

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

  // Selection Logic
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredMessages.length && filteredMessages.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMessages.map((m) => m.id)));
    }
  };

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFolderChange = (folder: "inbox" | "archived" | "trashed") => {
    setActiveFolder(folder);
    setSelectedIds(new Set());
  };

  const isAllSelected = filteredMessages.length > 0 && selectedIds.size === filteredMessages.length;

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
          {unreadInboxCount > 0 && (
            <Badge className="bg-purple-600/20 text-purple-400 border-purple-500/30 text-xs px-2.5 py-1">
              {unreadInboxCount} não {unreadInboxCount === 1 ? "lida" : "lidas"}
            </Badge>
          )}
        </div>
      </div>

      {/* Folder Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white/[0.03] border border-white/10 rounded-2xl">
        <button
          onClick={() => handleFolderChange("inbox")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeFolder === "inbox"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Caixa de Entrada</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeFolder === "inbox"
                ? "bg-purple-800 text-purple-100"
                : "bg-white/10 text-slate-400"
            }`}
          >
            {inboxCount}
          </span>
        </button>

        <button
          onClick={() => handleFolderChange("archived")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeFolder === "archived"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Arquivadas</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeFolder === "archived"
                ? "bg-purple-800 text-purple-100"
                : "bg-white/10 text-slate-400"
            }`}
          >
            {archivedCount}
          </span>
        </button>

        <button
          onClick={() => handleFolderChange("trashed")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeFolder === "trashed"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Lixeira</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeFolder === "trashed"
                ? "bg-purple-800 text-purple-100"
                : "bg-white/10 text-slate-400"
            }`}
          >
            {trashedCount}
          </span>
        </button>
      </div>

      {/* Batch Action Toolbar (Visible when items selected) */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-purple-950/40 border border-purple-500/30 rounded-2xl animate-in fade-in-50">
          <div className="flex items-center gap-2 text-xs text-purple-200">
            <span className="font-bold">{selectedIds.size}</span>
            <span>
              {selectedIds.size === 1 ? "mensagem selecionada" : "mensagens selecionadas"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs h-7 px-2 text-purple-300 hover:text-white hover:bg-purple-900/40"
            >
              Desmarcar
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeFolder === "inbox" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => archiveMutation.mutate(Array.from(selectedIds))}
                  disabled={archiveMutation.isPending}
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs gap-1.5 h-8"
                >
                  <Archive className="w-3.5 h-3.5 text-purple-400" />
                  Arquivar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => trashMutation.mutate(Array.from(selectedIds))}
                  disabled={trashMutation.isPending}
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-rose-300 hover:text-rose-200 text-xs gap-1.5 h-8"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Mover para Lixeira
                </Button>
              </>
            )}

            {activeFolder === "archived" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restoreMutation.mutate(Array.from(selectedIds))}
                  disabled={restoreMutation.isPending}
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs gap-1.5 h-8"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  Restaurar para Entrada
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => trashMutation.mutate(Array.from(selectedIds))}
                  disabled={trashMutation.isPending}
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-rose-300 hover:text-rose-200 text-xs gap-1.5 h-8"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Mover para Lixeira
                </Button>
              </>
            )}

            {activeFolder === "trashed" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restoreMutation.mutate(Array.from(selectedIds))}
                  disabled={restoreMutation.isPending}
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs gap-1.5 h-8"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  Restaurar para Entrada
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleConfirmPermanentDelete(Array.from(selectedIds))}
                  disabled={permanentDeleteMutation.isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 h-8"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Definitivamente
                </Button>
              </>
            )}
          </div>
        </div>
      )}

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

      {/* Select All Row */}
      {filteredMessages.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={handleToggleSelectAll}
              className="border-white/20 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
            />
            <span className="cursor-pointer select-none" onClick={handleToggleSelectAll}>
              {isAllSelected ? "Desmarcar todas deste grupo" : "Selecionar todas deste grupo"}
            </span>
          </div>
          <span>
            {filteredMessages.length} {filteredMessages.length === 1 ? "mensagem" : "mensagens"}
          </span>
        </div>
      )}

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
          {activeFolder === "inbox" ? (
            <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
          ) : activeFolder === "archived" ? (
            <Archive className="w-10 h-10 text-slate-600 mx-auto" />
          ) : (
            <Trash2 className="w-10 h-10 text-slate-600 mx-auto" />
          )}
          <h4 className="text-white font-bold text-sm">
            {activeFolder === "inbox"
              ? "Nenhuma mensagem na Caixa de Entrada"
              : activeFolder === "archived"
                ? "Nenhuma mensagem arquivada"
                : "Nenhuma mensagem na Lixeira"}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? "Nenhum resultado corresponde aos termos da busca nesta pasta."
              : activeFolder === "inbox"
                ? "Nenhuma mensagem ativa no momento."
                : activeFolder === "archived"
                  ? "Mensagens arquivadas aparecerão aqui quando você optar por arquivá-las."
                  : "Mensagens movidas para a lixeira aparecerão aqui antes da exclusão permanente."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((msg) => {
            const isSelected = selectedIds.has(msg.id);
            return (
              <div
                key={msg.id}
                onClick={() => handleOpenDetail(msg)}
                className={`group p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? "bg-purple-900/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                    : msg.read
                      ? "bg-white/[0.02] border-white/5 hover:border-white/10 opacity-80 hover:opacity-100"
                      : "bg-purple-500/[0.05] border-purple-500/20 hover:border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.05)]"
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  <div
                    onClick={(e) => handleToggleSelectOne(msg.id, e)}
                    className="pt-0.5 sm:pt-0 shrink-0"
                  >
                    <Checkbox
                      checked={isSelected}
                      className="border-white/20 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                    />
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!msg.read && activeFolder === "inbox" && (
                        <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 animate-pulse" />
                      )}
                      <span className="text-white font-bold text-sm truncate">
                        {msg.sender_name}
                      </span>
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
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
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

                  {/* Row Actions based on Folder */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {activeFolder === "inbox" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => archiveMutation.mutate([msg.id])}
                          className="h-8 w-8 text-slate-400 hover:text-purple-300 hover:bg-white/5"
                          title="Arquivar mensagem"
                        >
                          <Archive size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => trashMutation.mutate([msg.id])}
                          className="h-8 w-8 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Mover para lixeira"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}

                    {activeFolder === "archived" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => restoreMutation.mutate([msg.id])}
                          className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-white/5"
                          title="Restaurar para caixa de entrada"
                        >
                          <ArchiveRestore size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => trashMutation.mutate([msg.id])}
                          className="h-8 w-8 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Mover para lixeira"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}

                    {activeFolder === "trashed" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => restoreMutation.mutate([msg.id])}
                          className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-white/5"
                          title="Restaurar para caixa de entrada"
                        >
                          <RotateCcw size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleConfirmPermanentDelete([msg.id])}
                          className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                          title="Excluir definitivamente"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDetail(msg)}
                      className="text-slate-400 group-hover:text-white h-8 w-8"
                      title="Ver detalhes"
                    >
                      <Eye size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
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
                <div className="flex items-center gap-2 flex-wrap order-2 sm:order-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toggleReadMutation.mutate({
                        messageId: selectedMessage.id,
                        nextRead: !selectedMessage.read,
                      })
                    }
                    className="border-white/10 text-xs"
                  >
                    {selectedMessage.read ? "Marcar não lida" : "Marcar lida"}
                  </Button>

                  {(selectedMessage.status || "inbox") === "inbox" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => archiveMutation.mutate([selectedMessage.id])}
                        disabled={archiveMutation.isPending}
                        className="border-white/10 text-xs gap-1"
                      >
                        <Archive size={12} /> Arquivar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => trashMutation.mutate([selectedMessage.id])}
                        disabled={trashMutation.isPending}
                        className="border-rose-500/20 text-rose-300 hover:text-rose-200 text-xs gap-1"
                      >
                        <Trash2 size={12} /> Mover p/ Lixeira
                      </Button>
                    </>
                  )}

                  {selectedMessage.status === "archived" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreMutation.mutate([selectedMessage.id])}
                        disabled={restoreMutation.isPending}
                        className="border-white/10 text-xs gap-1 text-emerald-400"
                      >
                        <RotateCcw size={12} /> Restaurar p/ Entrada
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => trashMutation.mutate([selectedMessage.id])}
                        disabled={trashMutation.isPending}
                        className="border-rose-500/20 text-rose-300 hover:text-rose-200 text-xs gap-1"
                      >
                        <Trash2 size={12} /> Mover p/ Lixeira
                      </Button>
                    </>
                  )}

                  {selectedMessage.status === "trashed" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreMutation.mutate([selectedMessage.id])}
                        disabled={restoreMutation.isPending}
                        className="border-white/10 text-xs gap-1 text-emerald-400"
                      >
                        <RotateCcw size={12} /> Restaurar p/ Entrada
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleConfirmPermanentDelete([selectedMessage.id])}
                        disabled={permanentDeleteMutation.isPending}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1"
                      >
                        <Trash2 size={12} /> Excluir Definitivamente
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 order-1 sm:order-2 self-end sm:self-auto">
                  <a
                    href={`mailto:${selectedMessage.sender_email}?subject=Re: ${encodeURIComponent(
                      selectedMessage.subject || "Contato pelo Barbex",
                    )}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-xs transition-all"
                  >
                    <ExternalLink size={12} /> E-mail externo
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
              {/* Recipient Info Card */}
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

      {/* Confirmation Dialog for Permanent Deletion */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#090D1A] border-rose-500/30 text-white rounded-3xl p-6">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Excluir mensagem permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-300 leading-relaxed">
              Esta ação é <strong className="text-rose-400">definitiva e irreversível</strong>.{" "}
              {deleteTargetIds.length === 1
                ? "A mensagem selecionada e seu histórico de respostas serão removidos definitivamente do banco de dados."
                : `As ${deleteTargetIds.length} mensagens selecionadas e seus respectivos históricos de resposta serão removidos definitivamente do banco de dados.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              disabled={permanentDeleteMutation.isPending}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={permanentDeleteMutation.isPending}
              onClick={() => permanentDeleteMutation.mutate(deleteTargetIds)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl gap-1.5"
            >
              {permanentDeleteMutation.isPending ? (
                <>
                  <RefreshCw size={12} className="animate-spin" /> Excluindo...
                </>
              ) : (
                <>
                  <Trash2 size={12} /> Confirmar Exclusão
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
