import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldAlert,
  AlertTriangle,
  Lock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Sliders,
  Info,
  Power,
  Flame,
  Wrench,
  KeyRound,
  MessageSquare,
  Bot,
  Calendar,
  Users,
  Scissors,
  DollarSign,
  Settings as SettingsIcon,
  HelpCircle,
  FileText,
  Package,
  Ticket,
  Gift,
  Percent,
  Layers,
  ChevronRight,
  ShieldCheck,
  Radio,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface GlobalModuleMatrixRow {
  module_key: string;
  is_available: boolean;
  unavailable_reason: string | null;
  classification: "STANDARD_GOVERNABLE" | "HIGH_IMPACT_GOVERNABLE" | "MAINTENANCE_ONLY" | "PROHIBITED";
  can_mutate: boolean;
  impact_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "CORE";
  requires_phrase: boolean;
  rationale: string;
  updated_at: string;
  updated_by: string | null;
}

const MODULE_NAMES: Record<string, string> = {
  dashboard: "Dashboard Principal",
  settings: "Configurações da Unidade",
  calendar: "Agenda Operacional",
  customers: "Gestão de Clientes",
  barbers: "Equipe de Barbeiros",
  services: "Catálogo de Serviços",
  finances: "Fluxo de Caixa Operacional",
  basic_finance: "Financeiro Básico",
  whatsapp: "WhatsApp (Z-API)",
  ai: "Inteligência Artificial (OpenAI)",
  api: "API Pública & Webhooks",
  campaigns: "Disparo de Campanhas",
  automations_basic: "Automações em Segundo Plano",
  client_portal: "Portal de Autoagendamento",
  barber_panel: "Painel Individual do Barbeiro",
  reports_basic: "Relatórios Operacionais Básicos",
  reports_advanced: "Relatórios Analíticos Avançados",
  support: "Central de Suporte & Chamados",
  advanced_finance: "Gestão Financeira Avançada (DRE)",
  stock: "Controle de Estoque & Produtos",
  coupons: "Cupons Promocionais",
  loyalty: "Programa de Pontos & Fidelidade",
  commissions: "Cálculo de Comissões",
};

const MODULE_ICONS: Record<string, any> = {
  dashboard: Radio,
  settings: SettingsIcon,
  calendar: Calendar,
  customers: Users,
  barbers: Scissors,
  services: Layers,
  finances: DollarSign,
  basic_finance: DollarSign,
  whatsapp: MessageSquare,
  ai: Bot,
  api: KeyRound,
  campaigns: Flame,
  automations_basic: Sliders,
  client_portal: ExternalLink,
  barber_panel: Scissors,
  reports_basic: FileText,
  reports_advanced: FileText,
  support: HelpCircle,
  advanced_finance: DollarSign,
  stock: Package,
  coupons: Ticket,
  loyalty: Gift,
  commissions: Percent,
};

export function GlobalFeatureGovernance() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<string>("ALL");

  // Dialog State
  const [targetModule, setTargetModule] = useState<GlobalModuleMatrixRow | null>(null);
  const [desiredState, setDesiredState] = useState<boolean>(true);
  const [reason, setReason] = useState("");
  const [typedPhrase, setTypedPhrase] = useState("");

  const { data: matrix, isLoading, error } = useQuery<GlobalModuleMatrixRow[]>({
    queryKey: ["admin-global-module-availability-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_global_module_availability_matrix");
      if (error) throw error;
      return (data as unknown as GlobalModuleMatrixRow[]) || [];
    },
    staleTime: 10_000,
  });

  const mutation = useMutation({
    mutationFn: async ({
      moduleKey,
      available,
      justification,
    }: {
      moduleKey: string;
      available: boolean;
      justification: string;
    }) => {
      const { data, error } = await supabase.rpc("admin_set_global_module_availability", {
        p_module_key: moduleKey,
        p_available: available,
        p_reason: justification,
      });

      if (error) {
        throw new Error(error.message);
      }

      const res = data as any;
      if (!res?.success) {
        throw new Error(res?.message || `Erro ao atualizar (${res?.code || "UNKNOWN"})`);
      }

      return res;
    },
    onSuccess: (res) => {
      toast.success(res?.message || "Disponibilidade global atualizada com sucesso.");
      setTargetModule(null);
      setReason("");
      setTypedPhrase("");
      queryClient.invalidateQueries({ queryKey: ["admin-global-module-availability-matrix"] });
      queryClient.invalidateQueries({ queryKey: ["global-module-availability"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-modules"] });
      queryClient.invalidateQueries({ queryKey: ["user-modules"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Falha na mutação de governança.");
    },
  });

  const openActionDialog = (row: GlobalModuleMatrixRow, makeAvailable: boolean) => {
    if (!row.can_mutate) return;
    setTargetModule(row);
    setDesiredState(makeAvailable);
    setReason("");
    setTypedPhrase("");
  };

  const handleConfirmAction = () => {
    if (!targetModule) return;
    const cleanReason = reason.trim();
    if (cleanReason.length < 10 || cleanReason.length > 500) {
      toast.error("A justificativa deve conter entre 10 e 500 caracteres.");
      return;
    }

    if (
      !desiredState &&
      targetModule.classification === "HIGH_IMPACT_GOVERNABLE" &&
      typedPhrase.trim() !== `DESATIVAR ${targetModule.module_key.toUpperCase()}`
    ) {
      toast.error(
        `Digite exatamente 'DESATIVAR ${targetModule.module_key.toUpperCase()}' para confirmar.`
      );
      return;
    }

    mutation.mutate({
      moduleKey: targetModule.module_key,
      available: desiredState,
      justification: cleanReason,
    });
  };

  const filteredMatrix = (matrix || []).filter((row) => {
    const matchesSearch =
      row.module_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (MODULE_NAMES[row.module_key] || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.rationale.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      classificationFilter === "ALL" || row.classification === classificationFilter;

    return matchesSearch && matchesFilter;
  });

  const totalCount = matrix?.length || 0;
  const availableCount = matrix?.filter((m) => m.is_available).length || 0;
  const unavailableCount = matrix?.filter((m) => !m.is_available).length || 0;
  const protectedCount = matrix?.filter((m) => !m.can_mutate).length || 0;

  const expectedPhrase = targetModule
    ? `DESATIVAR ${targetModule.module_key.toUpperCase()}`
    : "";
  const isPhraseValid =
    !targetModule ||
    desiredState ||
    targetModule.classification !== "HIGH_IMPACT_GOVERNABLE" ||
    typedPhrase.trim() === expectedPhrase;

  const isReasonValid = reason.trim().length >= 10 && reason.trim().length <= 500;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tight flex items-center gap-2">
              <Power className="w-6 h-6 text-purple-400" />
              Governança Global de Módulos
            </h3>
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px] font-bold">
              R2E.13G.6B
            </Badge>
          </div>
          <p className="text-gray-400 text-xs md:text-sm mt-1">
            Controle de emergência e autoridade servidora sobre a disponibilidade de recursos em toda a plataforma.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["admin-global-module-availability-matrix"] })
          }
          className="border-white/10 hover:bg-white/5 text-gray-300 gap-2 shrink-0 self-start md:self-auto"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Rationale Notice Card */}
      <Card className="glass border-white/10 rounded-2xl bg-gradient-to-r from-purple-950/20 to-blue-950/20 border-l-4 border-l-purple-500 p-6">
        <div className="flex items-start gap-4">
          <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div className="space-y-2 text-xs text-gray-300 leading-relaxed">
            <p className="font-bold text-white">Regras de Precedência e Segurança Operacional:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>
                <strong className="text-rose-400">Desativação Global:</strong> Nega o acesso ao recurso imediatamente para <span className="text-white">todos os estabelecimentos</span>, mesmo aqueles com plano ativo ou add-on contratado.
              </li>
              <li>
                <strong className="text-emerald-400">Restauração de Disponibilidade:</strong> Apenas devolve a disponibilidade à plataforma; <span className="text-white">NÃO concede direitos</span> a estabelecimentos sem o recurso no plano.
              </li>
              <li>
                <strong className="text-purple-400">Módulos Protegidos:</strong> Recursos de núcleo essencial (<code className="text-purple-300">dashboard</code>, <code className="text-purple-300">settings</code>) e infraestrutura operacional são bloqueados contra mutação para garantir a recuperabilidade do sistema.
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass border-white/5 p-5 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Catálogo Canônico</p>
          <p className="text-2xl font-black text-white italic mt-1">{totalCount} Módulos</p>
          <p className="text-[11px] text-gray-500 mt-1">Total arquitetural G.5 / G.6</p>
        </Card>

        <Card className="glass border-white/5 p-5 rounded-2xl border-emerald-500/20 bg-emerald-500/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Disponíveis (Online)</p>
          <p className="text-2xl font-black text-emerald-400 italic mt-1">{availableCount}</p>
          <p className="text-[11px] text-emerald-500/80 mt-1">Acesso normal governado por plano</p>
        </Card>

        <Card className="glass border-white/5 p-5 rounded-2xl border-rose-500/20 bg-rose-500/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Indisponíveis (Kill Switch)</p>
          <p className="text-2xl font-black text-rose-400 italic mt-1">{unavailableCount}</p>
          <p className="text-[11px] text-rose-500/80 mt-1">Bloqueados em toda a plataforma</p>
        </Card>

        <Card className="glass border-white/5 p-5 rounded-2xl border-purple-500/20 bg-purple-500/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Núcleo & Manutenção</p>
          <p className="text-2xl font-black text-purple-400 italic mt-1">{protectedCount}</p>
          <p className="text-[11px] text-purple-500/80 mt-1">Imunes a desativação operacional</p>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Filtrar por nome, chave técnica ou justificativa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 bg-white/5 border-white/10 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "ALL", label: "Todos" },
            { id: "HIGH_IMPACT_GOVERNABLE", label: "Alto Impacto" },
            { id: "STANDARD_GOVERNABLE", label: "Padrão" },
            { id: "MAINTENANCE_ONLY", label: "Manutenção" },
            { id: "PROHIBITED", label: "Protegidos" },
          ].map((f) => (
            <Button
              key={f.id}
              variant="ghost"
              size="sm"
              onClick={() => setClassificationFilter(f.id)}
              className={cn(
                "h-9 px-3 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all shrink-0",
                classificationFilter === f.id
                  ? "bg-purple-600 text-white"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Modules Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredMatrix.map((row) => {
          const Icon = MODULE_ICONS[row.module_key] || Layers;
          const displayName = MODULE_NAMES[row.module_key] || row.module_key;

          return (
            <Card
              key={row.module_key}
              className={cn(
                "glass border-white/5 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300",
                !row.is_available && "border-rose-500/30 bg-rose-950/10",
                row.classification === "PROHIBITED" && "border-white/5 opacity-85",
                row.can_mutate && "hover:border-purple-500/30"
              )}
            >
              <div className="space-y-4">
                {/* Card Top: Icon, Names, Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                        row.is_available
                          ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                          : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white italic truncate uppercase">
                        {displayName}
                      </p>
                      <code className="text-[10px] text-gray-400 font-mono block truncate">
                        {row.module_key}
                      </code>
                    </div>
                  </div>

                  {row.is_available ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 text-[10px] font-bold uppercase shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Disponível
                    </Badge>
                  ) : (
                    <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 gap-1 text-[10px] font-bold uppercase shrink-0 animate-pulse">
                      <XCircle className="w-3 h-3" />
                      Indisponível
                    </Badge>
                  )}
                </div>

                {/* Classification & Impact Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {row.classification === "HIGH_IMPACT_GOVERNABLE" && (
                    <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-[9px] uppercase font-bold gap-1">
                      <Flame className="w-3 h-3 text-amber-400" />
                      Alto Impacto
                    </Badge>
                  )}
                  {row.classification === "STANDARD_GOVERNABLE" && (
                    <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20 text-[9px] uppercase font-bold">
                      Padrão
                    </Badge>
                  )}
                  {row.classification === "MAINTENANCE_ONLY" && (
                    <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-[9px] uppercase font-bold gap-1">
                      <Wrench className="w-3 h-3 text-purple-400" />
                      Janela de Manutenção
                    </Badge>
                  )}
                  {row.classification === "PROHIBITED" && (
                    <Badge className="bg-zinc-500/10 text-zinc-300 border-zinc-500/20 text-[9px] uppercase font-bold gap-1">
                      <Lock className="w-3 h-3 text-zinc-400" />
                      Núcleo Protegido
                    </Badge>
                  )}

                  <Badge
                    variant="outline"
                    className="text-[9px] font-mono text-gray-400 border-white/10"
                  >
                    Impacto: {row.impact_level}
                  </Badge>
                </div>

                {/* Rationale & Operational note */}
                <p className="text-xs text-gray-400 leading-relaxed min-h-[36px]">
                  {row.rationale}
                </p>

                {/* If currently unavailable: display reason */}
                {!row.is_available && row.unavailable_reason && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] space-y-1">
                    <p className="font-bold text-[10px] uppercase tracking-wider text-rose-400">
                      Motivo do Bloqueio:
                    </p>
                    <p className="italic">"{row.unavailable_reason}"</p>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-5 mt-4 border-t border-white/5">
                {row.can_mutate ? (
                  row.is_available ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openActionDialog(row, false)}
                      className="w-full h-10 rounded-xl text-xs font-bold uppercase tracking-wider border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 gap-1.5 transition-all"
                    >
                      <Power className="w-3.5 h-3.5" />
                      Desativar Globalmente
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openActionDialog(row, true)}
                      className="w-full h-10 rounded-xl text-xs font-bold uppercase tracking-wider border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Restaurar Disponibilidade
                    </Button>
                  )
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="w-full h-10 rounded-xl text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-white/5 opacity-60 cursor-not-allowed gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {row.classification === "PROHIBITED"
                      ? "Protegido pelo Núcleo"
                      : "Restrito a Manutenção"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Confirmation & Justification Dialog */}
      <Dialog open={!!targetModule} onOpenChange={(open) => !open && setTargetModule(null)}>
        <DialogContent className="glass border-white/10 rounded-3xl max-w-lg bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase italic tracking-tight flex items-center gap-2">
              {desiredState ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Restaurar Disponibilidade Global
                </>
              ) : targetModule?.classification === "HIGH_IMPACT_GOVERNABLE" ? (
                <>
                  <Flame className="w-5 h-5 text-rose-500" />
                  Desativação de Alto Impacto
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Desativação Global de Recurso
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 leading-relaxed pt-2">
              Módulo: <strong className="text-white">{MODULE_NAMES[targetModule?.module_key || ""] || targetModule?.module_key}</strong> (<code>{targetModule?.module_key}</code>)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Context Warning Box */}
            {desiredState ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Restauração da Disponibilidade da Plataforma
                </p>
                <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                  Esta ação reativa o recurso para todos os estabelecimentos contratantes. Estabelecimentos cujo plano ou add-ons não incluam o recurso continuarão sem acesso normal por ausência de direito comercial.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Atenção: Impacto Global Imediato
                </p>
                <p className="text-[11px] text-rose-200/80 leading-relaxed">
                  Desativar este módulo tornará o recurso <strong className="text-white">inacessível para todos os estabelecimentos da plataforma</strong>, inclusive assinantes Pro e Elite. Nenhuma assinatura comercial ou cobrança Stripe será alterada.
                </p>
              </div>
            )}

            {/* Level 3: Typed Phrase Confirmation for HIGH_IMPACT */}
            {!desiredState && targetModule?.classification === "HIGH_IMPACT_GOVERNABLE" && (
              <div className="space-y-2 p-4 rounded-2xl bg-zinc-900 border border-rose-500/30">
                <Label className="text-[10px] uppercase font-black tracking-widest text-rose-400">
                  Confirmação Explícita de Alto Impacto (Nível 3)
                </Label>
                <p className="text-[11px] text-gray-400">
                  Digite exatamente <code className="text-white font-bold bg-white/10 px-1 py-0.5 rounded">{expectedPhrase}</code> para liberar a ação:
                </p>
                <Input
                  value={typedPhrase}
                  onChange={(e) => setTypedPhrase(e.target.value)}
                  placeholder={expectedPhrase}
                  className="h-11 bg-white/5 border-white/10 rounded-xl text-xs font-mono uppercase tracking-wider text-rose-300 focus:ring-rose-500"
                />
              </div>
            )}

            {/* Mandatory Reason Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">
                  Justificativa Operacional (Obrigatória)
                </Label>
                <span
                  className={cn(
                    "text-[10px] font-mono",
                    reason.trim().length >= 10 && reason.trim().length <= 500
                      ? "text-emerald-400"
                      : "text-gray-500"
                  )}
                >
                  {reason.trim().length} / 500 caracteres (mín. 10)
                </span>
              </div>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva detalhadamente o motivo técnico ou operacional desta alteração de disponibilidade..."
                rows={3}
                className="bg-white/5 border-white/10 rounded-xl text-xs leading-relaxed focus:ring-purple-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="ghost"
              onClick={() => setTargetModule(null)}
              disabled={mutation.isPending}
              className="text-gray-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={!isReasonValid || !isPhraseValid || mutation.isPending}
              className={cn(
                "font-bold uppercase tracking-wider text-xs gap-2 rounded-xl h-11 px-5",
                desiredState
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-rose-600 hover:bg-rose-500 text-white"
              )}
            >
              {mutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Processando...
                </>
              ) : desiredState ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirmar Restauração
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5" />
                  Confirmar Desativação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
