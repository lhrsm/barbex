import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Ban,
  Layers,
  Search,
  Lock,
  Sparkles,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CapabilityModule {
  module_key: string;
  display_name: string;
  category: string;
  is_always_on: boolean;
  is_plan_entitled: boolean;
  is_addon_entitled: boolean;
  has_commercial_entitlement: boolean;
  commercial_source: "always_on" | "plan" | "addon" | "none";
  override_state: "INHERIT" | "DISABLED";
  effective_access: boolean;
  can_disable: boolean;
  can_inherit: boolean;
}

interface CapabilityMatrixResponse {
  tenant_id: string;
  tenant_name: string;
  status: string;
  is_suspended: boolean;
  plan_slug: string;
  plan_name: string;
  modules: CapabilityModule[];
}

interface TenantCapabilityModalProps {
  tenantId: string | null;
  tenantName: string;
  tenantSlug: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TenantCapabilityModal({
  tenantId,
  tenantName,
  tenantSlug,
  isOpen,
  onClose,
}: TenantCapabilityModalProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Level 2 Confirmation state
  const [pendingMutation, setPendingMutation] = useState<{
    module: CapabilityModule;
    targetState: "DISABLED" | "INHERIT";
  } | null>(null);
  const [reason, setReason] = useState("");

  const { data: matrix, isLoading, refetch } = useQuery<CapabilityMatrixResponse>({
    queryKey: ["tenant-capabilities", tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error("Tenant ID required");
      const { data, error } = await supabase.rpc("admin_get_tenant_capability_matrix", {
        p_tenant_id: tenantId,
      });
      if (error) throw error;
      return data as unknown as CapabilityMatrixResponse;
    },
    enabled: isOpen && !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async ({
      moduleKey,
      overrideState,
      mutationReason,
    }: {
      moduleKey: string;
      overrideState: "DISABLED" | "INHERIT";
      mutationReason: string;
    }) => {
      if (!tenantId) throw new Error("Tenant ID ausente");
      const { data, error } = await supabase.rpc("admin_set_tenant_module_override", {
        p_tenant_id: tenantId,
        p_module_key: moduleKey,
        p_override_state: overrideState,
        p_reason: mutationReason,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any, variables) => {
      toast.success(
        variables.overrideState === "DISABLED"
          ? `Módulo '${variables.moduleKey}' desativado com sucesso para esta barbearia.`
          : `Restrição removida. Módulo '${variables.moduleKey}' agora herda o plano/add-on.`
      );
      setPendingMutation(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["tenant-capabilities", tenantId] });
      refetch();
    },
    onError: (error: any) => {
      console.error("Erro na mutação de capacidade:", error);
      toast.error(error.message || "Falha ao atualizar capacidade do estabelecimento.");
    },
  });

  const handleOpenConfirm = (module: CapabilityModule, targetState: "DISABLED" | "INHERIT") => {
    setPendingMutation({ module, targetState });
    setReason("");
  };

  const handleExecuteMutation = () => {
    if (!pendingMutation) return;
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 10 || trimmedReason.length > 500) {
      toast.error("A justificativa deve conter entre 10 e 500 caracteres.");
      return;
    }

    mutation.mutate({
      moduleKey: pendingMutation.module.module_key,
      overrideState: pendingMutation.targetState,
      mutationReason: trimmedReason,
    });
  };

  const filteredModules = matrix?.modules?.filter((m) => {
    const matchesSearch =
      m.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.module_key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" ||
      (categoryFilter === "core" && m.is_always_on) ||
      m.category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: "all", label: "Todos" },
    { id: "core", label: "Core (Sempre Ativos)" },
    { id: "marketing", label: "Marketing" },
    { id: "financeiro", label: "Financeiro" },
    { id: "fidelizacao", label: "Fidelização" },
    { id: "operacoes", label: "Operações" },
    { id: "enterprise", label: "Enterprise" },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="glass border-white/10 text-white max-w-4xl max-h-[90vh] flex flex-col rounded-3xl p-6 overflow-hidden">
          <DialogHeader className="pb-3 border-b border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    Governança de Capacidades & Módulos
                  </DialogTitle>
                  <DialogDescription className="text-gray-400 text-xs mt-0.5">
                    Estabelecimento:{" "}
                    <span className="font-bold text-purple-300">
                      {matrix?.tenant_name || tenantName}
                    </span>{" "}
                    <span className="font-mono text-[11px] text-gray-500">({tenantSlug})</span>
                  </DialogDescription>
                </div>
              </div>

              {matrix && (
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5",
                      matrix.is_suspended
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    )}
                  >
                    {matrix.is_suspended ? "Suspenso / Bloqueado" : "Ativo"}
                  </Badge>
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5">
                    {matrix.plan_name || "Sem plano"}
                  </Badge>
                </div>
              )}
            </div>

            {/* Suspended Alert */}
            {matrix?.is_suspended && (
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-3 flex items-center gap-3 text-rose-300 text-xs mt-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
                <span>
                  <strong>Atenção:</strong> Este estabelecimento está atualmente suspenso ou bloqueado.
                  Conforme a política G.5B, alterações nas capacidades estão desabilitadas para
                  preservar o isolamento operacional.
                </span>
              </div>
            )}
          </DialogHeader>

          {/* Search & Filter bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 pb-2">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Filtrar por nome ou chave..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 rounded-xl text-xs h-9 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all shrink-0",
                    categoryFilter === cat.id
                      ? "bg-purple-500/30 text-purple-300 border border-purple-400/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                      : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Modules Table */}
          <div className="flex-1 overflow-y-auto pr-1 mt-2 rounded-2xl border border-white/5 bg-white/[0.02]">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-white/5 rounded-xl" />
                ))}
              </div>
            ) : filteredModules?.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-xs italic">
                Nenhum módulo encontrado com os filtros selecionados.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[9px] pl-4">
                      Módulo & Chave
                    </TableHead>
                    <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">
                      Origem Comercial
                    </TableHead>
                    <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">
                      Restrição (Override)
                    </TableHead>
                    <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">
                      Acesso Efetivo
                    </TableHead>
                    <TableHead className="text-right text-gray-400 font-bold uppercase tracking-widest text-[9px] pr-4">
                      Governança
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModules?.map((mod) => (
                    <TableRow
                      key={mod.module_key}
                      className="border-white/5 hover:bg-white/[0.04] transition-colors"
                    >
                      {/* Name & Key */}
                      <TableCell className="py-3 pl-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-white flex items-center gap-1.5">
                            {mod.is_always_on && (
                              <Lock className="w-3 h-3 text-purple-400 shrink-0" />
                            )}
                            {mod.display_name}
                          </span>
                          <span className="font-mono text-[10px] text-gray-500">
                            {mod.module_key}
                          </span>
                        </div>
                      </TableCell>

                      {/* Commercial Source */}
                      <TableCell className="py-3">
                        {mod.is_always_on ? (
                          <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[9px] font-bold uppercase tracking-wider">
                            Sempre Disponível (Core)
                          </Badge>
                        ) : mod.commercial_source === "addon" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[9px] font-bold uppercase tracking-wider">
                            Add-on Ativo
                          </Badge>
                        ) : mod.commercial_source === "plan" ? (
                          <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30 text-[9px] font-bold uppercase tracking-wider">
                            Incluído no Plano
                          </Badge>
                        ) : (
                          <Badge className="bg-white/5 text-gray-400 border-white/10 text-[9px] font-medium uppercase tracking-wider">
                            Não Incluso
                          </Badge>
                        )}
                      </TableCell>

                      {/* Tenant Override */}
                      <TableCell className="py-3">
                        {mod.override_state === "DISABLED" ? (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
                            <Ban className="w-2.5 h-2.5 text-rose-400" />
                            Desativado
                          </Badge>
                        ) : (
                          <Badge className="bg-white/5 text-gray-400 border-white/10 text-[9px] font-medium uppercase tracking-wider">
                            Padrão (INHERIT)
                          </Badge>
                        )}
                      </TableCell>

                      {/* Effective Access */}
                      <TableCell className="py-3">
                        {mod.effective_access ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Liberado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            Bloqueado
                          </span>
                        )}
                      </TableCell>

                      {/* Governance Action */}
                      <TableCell className="py-3 text-right pr-4">
                        {mod.is_always_on ? (
                          <span className="text-[10px] text-gray-500 italic">Imutável</span>
                        ) : matrix?.is_suspended ? (
                          <span className="text-[10px] text-gray-500 italic">Bloqueado</span>
                        ) : mod.can_disable ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenConfirm(mod, "DISABLED")}
                            className="h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 rounded-lg transition-all"
                          >
                            <Ban className="w-3 h-3 mr-1" />
                            Desativar
                          </Button>
                        ) : mod.can_inherit ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenConfirm(mod, "INHERIT")}
                            className="h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 rounded-lg transition-all"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Restaurar
                          </Button>
                        ) : (
                          <span className="text-[10px] text-gray-500 italic">Sem direito</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-white/5 flex items-center justify-between sm:justify-between">
            <span className="text-[10px] text-gray-500">
              Política G.5B: Apenas restrições (DISABLED) ou herança (INHERIT) são governadas.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-xl text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LEVEL 2 CONFIRMATION DIALOG */}
      <Dialog
        open={!!pendingMutation}
        onOpenChange={(open) => !open && !mutation.isPending && setPendingMutation(null)}
      >
        <DialogContent className="glass border-white/15 text-white max-w-lg rounded-3xl p-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-2xl border",
                  pendingMutation?.targetState === "DISABLED"
                    ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                )}
              >
                {pendingMutation?.targetState === "DISABLED" ? (
                  <Ban className="h-6 w-6" />
                ) : (
                  <RotateCcw className="h-6 w-6" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-tight text-white">
                  {pendingMutation?.targetState === "DISABLED"
                    ? "Desativar Módulo para Esta Barbearia"
                    : "Restaurar Herança de Plano (INHERIT)"}
                </DialogTitle>
                <DialogDescription className="text-gray-400 text-xs">
                  Confirmação de Nível 2 — Ação com auditoria atômica obrigatória.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {pendingMutation && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">Estabelecimento:</span>
                  <span className="font-bold text-white">{matrix?.tenant_name || tenantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Módulo:</span>
                  <span className="font-bold text-purple-300">
                    {pendingMutation.module.display_name} ({pendingMutation.module.module_key})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Novo Estado:</span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      pendingMutation.targetState === "DISABLED" ? "text-rose-400" : "text-emerald-400"
                    )}
                  >
                    {pendingMutation.targetState}
                  </span>
                </div>
              </div>

              {/* Consequence notice */}
              <div
                className={cn(
                  "p-3 rounded-2xl border space-y-1 text-[11px]",
                  pendingMutation.targetState === "DISABLED"
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-300"
                )}
              >
                <p className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Efeito Operacional:
                </p>
                <p className="leading-relaxed text-gray-300">
                  {pendingMutation.targetState === "DISABLED"
                    ? "O acesso ao módulo será bloqueado imediatamente no backend e frontend para este estabelecimento, mesmo estando presente no plano comercial. Nenhum dado histórico é excluído."
                    : "A restrição administrativa será revogada. O módulo voltará a ser regido pelo plano comercial ativo ou add-on. Esta ação NÃO adquire nem concede novas licenças comerciais."}
                </p>
              </div>

              {/* Mandatory Reason (10..500 chars) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="mutation-reason" className="text-xs font-bold text-gray-300">
                    Justificativa Operacional (Obrigatória):
                  </Label>
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      reason.trim().length >= 10 && reason.trim().length <= 500
                        ? "text-emerald-400"
                        : "text-amber-400"
                    )}
                  >
                    {reason.trim().length}/500 (mínimo 10)
                  </span>
                </div>
                <Textarea
                  id="mutation-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Informe o motivo da alteração de capacidade (mínimo 10 caracteres)..."
                  className="bg-white/5 border-white/10 text-xs rounded-xl focus:border-purple-400 text-white placeholder:text-gray-600 resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => setPendingMutation(null)}
              className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={
                mutation.isPending ||
                reason.trim().length < 10 ||
                reason.trim().length > 500
              }
              onClick={handleExecuteMutation}
              className={cn(
                "rounded-xl text-xs font-bold px-4 transition-all shadow-lg",
                pendingMutation?.targetState === "DISABLED"
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30"
              )}
            >
              {mutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : null}
              Confirmar Alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
