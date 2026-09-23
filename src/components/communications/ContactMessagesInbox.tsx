import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Mail,
  Search,
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
  Archive,
  ArchiveRestore,
  Trash2,
  Inbox,
  RotateCcw,
  AlertTriangle,
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
  status: "inbox" | "archived" | "trashed";
  archived_at: string | null;
  trashed_at: string | null;
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
  const [activeFolder, setActiveFolder] = useState<"inbox" | "archived" | "trashed">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRead, setFilterRead] = useState<"all" | "unread" | "read">("all");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Multi-selection & Delete Confirmation State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleteTargetMessage, setDeleteTargetMessage] = useState<ContactMessage | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // 1. Fetch Contact Messages strictly scoped to current tenant
  const {
    data: messages = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
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

  // 3. Lifecycle Mutations (Archive, Trash, Restore, Permanent Delete)
  const archiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error: updateErr } = await untypedDb
        .from("contact_messages")
        .update({
          status: "archived",
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .in("id", ids)
        .eq("tenant_id", tenantId);

      if (updateErr) throw new Error(updateErr.message);
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages", tenantId] });
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
        .from("contact_messages")
        .update({
          status: "trashed",
          trashed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .in("id", ids)
        .eq("tenant_id", tenantId);

      if (updateErr) throw new Error(updateErr.message);
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages", tenantId] });
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
        .from("contact_messages")
        .update({
          status: "inbox",
          archived_at: null,
          trashed_at: null,
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .in("id", ids)
        .eq("tenant_id", tenantId);

      if (updateErr) throw new Error(updateErr.message);
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages", tenantId] });
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
        .from("contact_messages")
        .delete()
        .in("id", ids)
        .eq("tenant_id", tenantId);

      if (delErr) throw new Error(delErr.message);
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages", tenantId] });
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
      setDeleteTargetMessage(null);
      toast.success("Mensagem excluída definitivamente.");
    },
    onError: (err: Error) => {
      toast.error("Erro ao excluir mensagem: " + err.message);
    },
  });

  // Folder Counts
  const inboxCount = messages.filter((m) => (m.status || "inbox") === "inbox").length;
  const archivedCount = messages.filter((m) => m.status === "archived").length;
  const trashedCount = messages.filter((m) => m.status === "trashed").length;
  const unreadInboxCount = messages.filter(
    (m) => (m.status || "inbox") === "inbox" && !m.read,
  ).length;

  // Filter messages based on activeFolder, search, read
  const filteredMessages = messages.filter((msg) => {
    const itemStatus = msg.status || "inbox";
    if (itemStatus !== activeFolder) return false;

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

  const handleOpenDetail = (msg: ContactMessage) => {
    setSelectedMessage(msg);
    setIsDetailOpen(true);
    // Mark as read automatically when opening if unread
    if (!msg.read) {
      toggleReadMutation.mutate({ messageId: msg.id, nextRead: true });
    }
  };

  const handleConfirmPermanentDelete = (msg: ContactMessage) => {
    setDeleteTargetMessage(msg);
    setDeleteTargetIds([msg.id]);
    setIsDeleteDialogOpen(true);
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
      {/* Folder Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#0b0f17] border border-zinc-800 rounded-2xl">
        <button
          onClick={() => handleFolderChange("inbox")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeFolder === "inbox"
              ? "bg-gold text-black shadow-md shadow-gold/20"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Caixa de Entrada</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeFolder === "inbox"
                ? "bg-black/20 text-black font-black"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {inboxCount}
          </span>
        </button>

        <button
          onClick={() => handleFolderChange("archived")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeFolder === "archived"
              ? "bg-gold text-black shadow-md shadow-gold/20"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Arquivadas</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeFolder === "archived"
                ? "bg-black/20 text-black font-black"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {archivedCount}
          </span>
        </button>

        <button
          onClick={() => handleFolderChange("trashed")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeFolder === "trashed"
              ? "bg-gold text-black shadow-md shadow-gold/20"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Lixeira</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeFolder === "trashed"
                ? "bg-black/20 text-black font-black"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {trashedCount}
          </span>
        </button>
      </div>

      {/* Batch Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-900 border border-gold/40 rounded-2xl animate-in fade-in-50">
          <div className="flex items-center gap-2 text-xs text-zinc-200">
            <span className="font-bold text-gold">{selectedIds.size}</span>
            <span>
              {selectedIds.size === 1 ? "mensagem selecionada" : "mensagens selecionadas"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs h-7 px-2 text-zinc-400 hover:text-white"
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
                  className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white text-xs gap-1.5 h-8"
                >
                  <Archive className="w-3.5 h-3.5 text-gold" />
                  Arquivar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => trashMutation.mutate(Array.from(selectedIds))}
                  disabled={trashMutation.isPending}
                  className="border-red-500/30 bg-zinc-800 hover:bg-red-500/10 text-red-300 text-xs gap-1.5 h-8"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
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
                  className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white text-xs gap-1.5 h-8"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  Restaurar para Entrada
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => trashMutation.mutate(Array.from(selectedIds))}
                  disabled={trashMutation.isPending}
                  className="border-red-500/30 bg-zinc-800 hover:bg-red-500/10 text-red-300 text-xs gap-1.5 h-8"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  Mover para Lixeira
                </Button>
              </>
            )}

            {activeFolder === "trashed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => restoreMutation.mutate(Array.from(selectedIds))}
                disabled={restoreMutation.isPending}
                className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white text-xs gap-1.5 h-8"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                Restaurar para Entrada
              </Button>
            )}
          </div>
        </div>
      )}

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
              Todas ({filteredMessages.length})
            </button>
            <button
              onClick={() => setFilterRead("unread")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterRead === "unread"
                  ? "bg-amber-500 text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Não lidas {activeFolder === "inbox" && `(${unreadInboxCount})`}
            </button>
            <button
              onClick={() => setFilterRead("read")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterRead === "read" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Lidas
            </button>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="h-11 w-11 border-zinc-800 bg-[#0b0f17] hover:border-gold/40 text-zinc-300 rounded-xl"
            title="Atualizar mensagens"
          >
            <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
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
                <th className="p-4 w-10 text-center">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleToggleSelectAll}
                    className="border-zinc-600 data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                  />
                </th>
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
              {filteredMessages.map((msg) => {
                const isSelected = selectedIds.has(msg.id);
                return (
                  <tr
                    key={msg.id}
                    onClick={() => handleOpenDetail(msg)}
                    className={`border-b border-zinc-800/50 hover:bg-white/[0.02] transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-gold/[0.07]"
                        : !msg.read && activeFolder === "inbox"
                          ? "bg-amber-500/[0.03]"
                          : ""
                    }`}
                  >
                    <td
                      className="p-4 text-center"
                      onClick={(e) => handleToggleSelectOne(msg.id, e)}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="border-zinc-600 data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                      />
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {!msg.read && activeFolder === "inbox" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />{" "}
                          Nova
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-500 font-medium">
                          {msg.read ? "Lida" : "Não lida"}
                        </span>
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
                        {/* Folder Specific Action Buttons */}
                        {activeFolder === "inbox" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => archiveMutation.mutate([msg.id])}
                              className="h-8 w-8 text-zinc-400 hover:text-gold"
                              title="Arquivar mensagem"
                            >
                              <Archive size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => trashMutation.mutate([msg.id])}
                              className="h-8 w-8 text-zinc-400 hover:text-red-400"
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
                              className="h-8 w-8 text-zinc-400 hover:text-emerald-400"
                              title="Restaurar para caixa de entrada"
                            >
                              <ArchiveRestore size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => trashMutation.mutate([msg.id])}
                              className="h-8 w-8 text-zinc-400 hover:text-red-400"
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
                              className="h-8 w-8 text-zinc-400 hover:text-emerald-400"
                              title="Restaurar para caixa de entrada"
                            >
                              <RotateCcw size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleConfirmPermanentDelete(msg)}
                              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              title="Excluir definitivamente"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </>
                        )}

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
                );
              })}

              {!filteredMessages.length && !isLoading && (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-zinc-500">
                    {activeFolder === "inbox" ? (
                      <Mail size={36} className="mx-auto mb-3 opacity-20 text-gold" />
                    ) : activeFolder === "archived" ? (
                      <Archive size={36} className="mx-auto mb-3 opacity-20 text-gold" />
                    ) : (
                      <Trash2 size={36} className="mx-auto mb-3 opacity-20 text-gold" />
                    )}
                    <p className="text-base font-bold text-zinc-400">
                      {activeFolder === "inbox"
                        ? "Nenhuma mensagem na Caixa de Entrada"
                        : activeFolder === "archived"
                          ? "Nenhuma mensagem arquivada"
                          : "Nenhuma mensagem na Lixeira"}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {searchQuery
                        ? "Nenhuma mensagem corresponde aos critérios de busca."
                        : activeFolder === "inbox"
                          ? filterRead === "unread"
                            ? "Você não possui mensagens não lidas no momento."
                            : "As mensagens enviadas pelo formulário de contato do site aparecerão aqui."
                          : activeFolder === "archived"
                            ? "Mensagens arquivadas ficam organizadas nesta pasta."
                            : "Mensagens enviadas para a lixeira permanecem aqui até serem restauradas ou excluídas definitivamente."}
                    </p>
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-zinc-500">
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
                <div className="flex items-center gap-2 flex-wrap">
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
                    {selectedMessage.read ? "Marcar não lida" : "Marcar lida"}
                  </Button>

                  {(selectedMessage.status || "inbox") === "inbox" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => archiveMutation.mutate([selectedMessage.id])}
                        disabled={archiveMutation.isPending}
                        className="border-zinc-800 hover:border-gold/40 text-xs gap-1"
                      >
                        <Archive size={12} className="text-gold" /> Arquivar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => trashMutation.mutate([selectedMessage.id])}
                        disabled={trashMutation.isPending}
                        className="border-red-500/20 text-red-400 hover:text-red-300 text-xs gap-1"
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
                        className="border-zinc-800 hover:border-emerald-500/40 text-emerald-400 text-xs gap-1"
                      >
                        <RotateCcw size={12} /> Restaurar p/ Entrada
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => trashMutation.mutate([selectedMessage.id])}
                        disabled={trashMutation.isPending}
                        className="border-red-500/20 text-red-400 hover:text-red-300 text-xs gap-1"
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
                        className="border-zinc-800 hover:border-emerald-500/40 text-emerald-400 text-xs gap-1"
                      >
                        <RotateCcw size={12} /> Restaurar p/ Entrada
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleConfirmPermanentDelete(selectedMessage)}
                        disabled={permanentDeleteMutation.isPending}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1"
                      >
                        <Trash2 size={12} /> Excluir Definitivamente
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
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

      {/* Confirmation Dialog for Permanent Deletion */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#0b0f17] border-red-500/30 text-white rounded-2xl p-6">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Excluir mensagem permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-300 leading-relaxed space-y-2">
              <p>
                Esta ação é <strong className="text-red-400">definitiva e irreversível</strong>. A
                mensagem a seguir será removida definitivamente:
              </p>
              {deleteTargetMessage && (
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1 text-zinc-200">
                  <div>
                    <span className="text-zinc-400">Remetente: </span>
                    <strong className="text-white">{deleteTargetMessage.sender_name}</strong> (
                    {deleteTargetMessage.sender_email})
                  </div>
                  <div>
                    <span className="text-zinc-400">Assunto: </span>
                    <span className="text-gold">
                      {deleteTargetMessage.subject || "Sem assunto"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Recebida em: </span>
                    <span className="text-zinc-300">
                      {format(new Date(deleteTargetMessage.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              disabled={permanentDeleteMutation.isPending}
              className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white text-xs rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={permanentDeleteMutation.isPending}
              onClick={() => permanentDeleteMutation.mutate(deleteTargetIds)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl gap-1.5"
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
