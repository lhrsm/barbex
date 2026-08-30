import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Users,
  UserPlus,
  Mail,
  Phone,
  Loader2,
  RotateCw,
  XCircle,
  Search,
  Filter,
  ShieldCheck,
  UserRound,
  Scissors,
  Headphones,
  Briefcase,
  DollarSign,
  Crown,
  LayoutGrid,
  Table as TableIcon,
  AlertCircle,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTeamMembers, getPendingInvitations, resendTeamInvitation, revokeTeamInvitation, UnifiedTeamMember } from "@/lib/team.functions";
import { useTenant } from "@/hooks/use-tenant";
import { AddUserModal } from "@/components/team/AddUserModal";
import { PermissionMatrix } from "@/components/security/PermissionMatrix";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/dashboard/usuarios")({
  component: () => (
    <PermissionGuard permission="users:manage">
      <TeamManagementPage />
    </PermissionGuard>
  ),
});

type CategoryTab = "all" | "barbers" | "reception" | "managers" | "financial" | "admin" | "invites";

function getCategoryBadgeStyle(category: string, barberCategory?: string | null) {
  switch (category) {
    case "barber":
      return barberCategory === "Proprietário"
        ? "border-purple-500/30 text-purple-400 bg-purple-500/5"
        : "border-blue-500/30 text-blue-400 bg-blue-500/5";
    case "reception":
      return "border-pink-500/30 text-pink-400 bg-pink-500/5";
    case "manager":
      return "border-amber-500/30 text-amber-400 bg-amber-500/5";
    case "financial":
      return "border-emerald-500/30 text-emerald-400 bg-emerald-500/5";
    case "admin":
      return "border-gold/30 text-gold bg-gold/5";
    default:
      return "border-zinc-500/30 text-zinc-400 bg-zinc-500/5";
  }
}

function getRoleIcon(category: string) {
  switch (category) {
    case "barber":
      return <Scissors className="h-3.5 w-3.5" />;
    case "reception":
      return <Headphones className="h-3.5 w-3.5" />;
    case "manager":
      return <Briefcase className="h-3.5 w-3.5" />;
    case "financial":
      return <DollarSign className="h-3.5 w-3.5" />;
    case "admin":
      return <Crown className="h-3.5 w-3.5" />;
    default:
      return <UserRound className="h-3.5 w-3.5" />;
  }
}

function TeamManagementPage() {
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const fetchMembers = useServerFn(getTeamMembers);
  const fetchInvites = useServerFn(getPendingInvitations);
  const resendInviteFn = useServerFn(resendTeamInvitation);
  const revokeInviteFn = useServerFn(revokeTeamInvitation);

  const { data: members = [], isLoading: loadingMembers, refetch: refetchMembers } = useQuery<UnifiedTeamMember[]>({
    queryKey: ["team-members", tenantId],
    queryFn: () => fetchMembers({ data: { tenantId: tenantId! } }) as Promise<UnifiedTeamMember[]>,
    enabled: !!tenantId,
  });

  const { data: invites = [], isLoading: loadingInvites, refetch: refetchInvites } = useQuery({
    queryKey: ["team-invites", tenantId],
    queryFn: () => fetchInvites({ data: { tenantId: tenantId! } }),
    enabled: !!tenantId,
  });

  const handleResend = async (invitationId: string) => {
    if (!tenantId) return;
    setActionInProgressId(invitationId);
    try {
      await resendInviteFn({ data: { invitationId, tenantId } });
      toast.success("Convite reenviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["team-invites", tenantId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao reenviar convite.");
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!tenantId) return;
    setActionInProgressId(invitationId);
    try {
      await revokeInviteFn({ data: { invitationId, tenantId } });
      toast.success("Convite revogado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["team-invites", tenantId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao revogar convite.");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Counts by category
  const counts = useMemo(() => {
    const totalMembers = members.length;
    const barbers = members.filter(m => m.category === "barber").length;
    const reception = members.filter(m => m.category === "reception").length;
    const managers = members.filter(m => m.category === "manager").length;
    const financial = members.filter(m => m.category === "financial").length;
    const admin = members.filter(m => m.category === "admin").length;
    const pendingInvites = invites.length;
    const activeMembers = members.filter(m => m.status === "active").length;

    return {
      total: totalMembers,
      activeMembers,
      barbers,
      reception,
      managers,
      financial,
      admin,
      pendingInvites,
    };
  }, [members, invites]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((member) => {
      // Security & Data Integrity: Exclude client/customer roles
      if (member.role === "client" || member.role === "customer") return false;
      if (!["barber", "reception", "manager", "financial", "admin"].includes(member.category)) return false;

      // Category filter
      if (activeTab === "barbers" && member.category !== "barber") return false;
      if (activeTab === "reception" && member.category !== "reception") return false;
      if (activeTab === "managers" && member.category !== "manager") return false;
      if (activeTab === "financial" && member.category !== "financial") return false;
      if (activeTab === "admin" && member.category !== "admin") return false;
      if (activeTab === "invites") return false;

      // Status filter
      if (statusFilter === "active" && member.status !== "active") return false;
      if (statusFilter === "inactive" && member.status !== "inactive") return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (member.name || "").toLowerCase();
        const email = (member.email || "").toLowerCase();
        const phone = (member.phone || "").toLowerCase();
        const role = (member.roleLabel || member.role || "").toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q) || role.includes(q);
      }

      return true;
    });
  }, [members, activeTab, statusFilter, searchQuery]);

  // Filtered invites list
  const filteredInvites = useMemo(() => {
    if (activeTab !== "all" && activeTab !== "invites") return [];
    if (!invites) return [];
    return invites.filter((invite: any) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const email = (invite.email || "").toLowerCase();
        const phone = (invite.phone || "").toLowerCase();
        const role = (invite.role || "").toLowerCase();
        return email.includes(q) || phone.includes(q) || role.includes(q);
      }
      return true;
    });
  }, [invites, activeTab, searchQuery]);

  const isLoading = loadingMembers || loadingInvites;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
              Painel de Gestão
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Equipe & Colaboradores
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Visão centralizada de barbeiros, recepcionistas, gerentes, financeiro e administradores da sua barbearia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              refetchMembers();
              refetchInvites();
              toast.success("Dados atualizados com sucesso!");
            }}
            className="border-zinc-800 bg-[#0b0f17] text-zinc-300 hover:text-white hover:border-gold/40 h-11 px-4 rounded-xl"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>

          <Button
            onClick={() => navigate({ to: "/barbers" })}
            variant="outline"
            className="border-amber-500/20 bg-[#0b0f17] text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/40 h-11 px-5 rounded-xl font-bold"
          >
            <Scissors className="mr-2 h-4 w-4" />
            Painel Barbeiros
          </Button>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="h-11 px-6 bg-gold hover:bg-gold/90 text-black font-extrabold rounded-xl shadow-[0_0_25px_rgba(212,175,55,0.25)] hover:shadow-[0_0_35px_rgba(212,175,55,0.4)] transition-all hover:scale-[1.02]"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar Colaborador
          </Button>
        </div>
      </div>

      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        tenantId={tenantId || ""}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total da Equipe */}
        <Card className="bg-[#0b0f17] border-gold/20 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              Total da Equipe
              <Users className="h-4 w-4 text-gold" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white tabular-nums">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-gold" /> : counts.total}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Colaboradores e convites</p>
          </CardContent>
        </Card>

        {/* Barbeiros & Profissionais */}
        <Card className="bg-[#0b0f17] border-blue-500/20 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center justify-between">
              Barbeiros
              <Scissors className="h-4 w-4 text-blue-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-400 tabular-nums">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-blue-400" /> : counts.barbers}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Profissionais de atendimento</p>
          </CardContent>
        </Card>

        {/* Recepção */}
        <Card className="bg-[#0b0f17] border-pink-500/20 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-pink-400 flex items-center justify-between">
              Recepção
              <Headphones className="h-4 w-4 text-pink-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-pink-400 tabular-nums">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-pink-400" /> : counts.reception}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Central de atendimento</p>
          </CardContent>
        </Card>

        {/* Gerência & Financeiro */}
        <Card className="bg-[#0b0f17] border-emerald-500/20 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
              Gestão & Caixa
              <Briefcase className="h-4 w-4 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-400 tabular-nums">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-emerald-400" /> : counts.managers + counts.financial + counts.admin}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Gerência, caixa e admin</p>
          </CardContent>
        </Card>

        {/* Convites Pendentes */}
        <Card className="bg-[#0b0f17] border-amber-500/20 shadow-sm rounded-2xl col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
              Convites Pendentes
              <Mail className="h-4 w-4 text-amber-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-400 tabular-nums">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-amber-400" /> : counts.pendingInvites}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Aguardando confirmação</p>
          </CardContent>
        </Card>
      </div>

      {/* Segmented Tab Navigation */}
      <div className="border-b border-zinc-800/80 pb-px overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2 min-w-max">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === "all"
                ? "bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <Users className="h-4 w-4" />
            Todos
            <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === "all" ? "bg-black/20 text-black" : "bg-zinc-800 text-zinc-400"
            }`}>
              {counts.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("barbers")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === "barbers"
                ? "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <Scissors className="h-4 w-4" />
            Barbeiros & Profissionais
            <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === "barbers" ? "bg-black/20 text-white" : "bg-zinc-800 text-zinc-400"
            }`}>
              {counts.barbers}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("reception")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === "reception"
                ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <Headphones className="h-4 w-4" />
            Recepção
            <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === "reception" ? "bg-black/20 text-white" : "bg-zinc-800 text-zinc-400"
            }`}>
              {counts.reception}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("managers")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === "managers"
                ? "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <Briefcase className="h-4 w-4" />
            Gerência
            <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === "managers" ? "bg-black/20 text-black" : "bg-zinc-800 text-zinc-400"
            }`}>
              {counts.managers}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("financial")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === "financial"
                ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <DollarSign className="h-4 w-4" />
            Financeiro / Caixa
            <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === "financial" ? "bg-black/20 text-black" : "bg-zinc-800 text-zinc-400"
            }`}>
              {counts.financial}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("admin")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === "admin"
                ? "bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <Crown className="h-4 w-4" />
            Administração
            <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === "admin" ? "bg-black/20 text-white" : "bg-zinc-800 text-zinc-400"
            }`}>
              {counts.admin}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("invites")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === "invites"
                ? "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <Mail className="h-4 w-4" />
            Convites
            <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === "invites" ? "bg-black/20 text-black" : "bg-zinc-800 text-zinc-400"
            }`}>
              {counts.pendingInvites}
            </span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail, WhatsApp ou cargo..."
            className="pl-10 h-11 bg-[#0b0f17] border-amber-500/10 focus:border-amber-500/30 text-white placeholder:text-zinc-500 rounded-xl text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#0b0f17] border border-amber-500/10 text-xs text-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500/30 cursor-pointer h-11"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>

          <div className="flex items-center border border-zinc-800 bg-[#0b0f17] rounded-xl p-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-lg transition-all ${
                      viewMode === "grid" ? "bg-gold text-black" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Visualização em Cards</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`p-2 rounded-lg transition-all ${
                      viewMode === "table" ? "bg-gold text-black" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <TableIcon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Visualização em Tabela</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Main Content Area: Cards or Table */}
      {isLoading ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-6 border border-amber-500/10 rounded-[20px] bg-[#0b0f17] space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-zinc-800 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-zinc-800 rounded animate-pulse" />
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-4 w-full bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === "invites" ? (
        /* Render Invites Section Directly when in 'invites' tab */
        <div className="space-y-4">
          {filteredInvites.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-amber-500/20 rounded-[20px] bg-[#0b0f17] text-muted-foreground">
              <Mail className="mx-auto mb-4 opacity-20 text-amber-500 h-14 w-14" />
              <p className="text-lg font-bold text-white/80">Nenhum convite pendente</p>
              <p className="text-sm mt-1 text-zinc-500">Todos os colaboradores convidados já ativaram seus acessos.</p>
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-6 bg-gold text-black font-bold rounded-xl"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Convite
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredInvites.map((invite: any) => (
                <div
                  key={invite.id}
                  className="p-6 border border-amber-500/20 rounded-[20px] bg-[#0b0f17] shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/5 text-xs">
                        Convite Pendente
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        Expira: {new Date(invite.expires_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-white font-bold text-lg truncate">
                        <Mail className="h-5 w-5 text-amber-400 shrink-0" />
                        <span className="truncate">{invite.email}</span>
                      </div>
                      <Badge className="bg-zinc-800 text-zinc-300 border-none capitalize text-xs">
                        Cargo: {invite.role}
                      </Badge>
                      {invite.phone && (
                        <p className="text-xs text-zinc-400 flex items-center gap-1.5 pt-1">
                          <Phone className="h-3.5 w-3.5 text-emerald-400" />
                          {invite.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-6 mt-6 border-t border-zinc-800">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionInProgressId === invite.id}
                      onClick={() => handleResend(invite.id)}
                      className="border-zinc-800 text-zinc-300 hover:text-white hover:border-gold/40 text-xs h-9 rounded-lg"
                    >
                      {actionInProgressId === invite.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 text-gold" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5 mr-1" />
                      )}
                      Reenviar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionInProgressId === invite.id}
                      onClick={() => handleRevoke(invite.id)}
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs h-9 rounded-lg"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Revogar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : filteredMembers.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 border border-dashed border-amber-500/20 rounded-[20px] bg-[#0b0f17] text-muted-foreground">
          <UserRound size={64} className="mx-auto mb-4 opacity-15 text-amber-500" />
          <p className="text-lg font-bold text-white/80">Nenhum membro encontrado</p>
          <p className="text-sm mt-1 text-zinc-500">
            {searchQuery
              ? "Nenhum membro corresponde à busca realizada."
              : activeTab === "barbers"
              ? "Nenhum barbeiro cadastrado. Acesse a gestão de barbeiros para cadastrar."
              : activeTab === "reception"
              ? "Nenhum recepcionista cadastrado. Convide sua equipe de recepção."
              : activeTab === "managers"
              ? "Nenhum gerente cadastrado."
              : activeTab === "financial"
              ? "Nenhum colaborador no setor financeiro / caixa."
              : "Não há membros registrados nesta categoria."}
          </p>
          <div className="flex justify-center gap-3 mt-6">
            {activeTab === "barbers" ? (
              <Button
                onClick={() => navigate({ to: "/barbers" })}
                className="bg-gold text-black font-bold rounded-xl"
              >
                <Scissors className="mr-2 h-4 w-4" />
                Ir para Barbeiros
              </Button>
            ) : (
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-gold text-black font-bold rounded-xl"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Convidar Colaborador
              </Button>
            )}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid of Unified Team Cards (Barbers Design System) */
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => {
            const initial = (member.name?.[0] || "?").toUpperCase();

            return (
              <div
                key={member.id}
                className="group relative p-6 border border-amber-500/20 rounded-[20px] bg-[#0b0f17] shadow-xl hover:border-amber-500/50 transition-all duration-500 hover:-translate-y-1 flex flex-col justify-between"
              >
                {/* Top Right Status Badge */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                  <Badge
                    className={`border text-[11px] font-semibold ${
                      member.status === "active"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    }`}
                  >
                    {member.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                <div>
                  {/* Avatar & Main Info */}
                  <div className="flex items-start gap-4 mb-5">
                    <div className="relative shrink-0">
                      <Avatar className="h-16 w-16 border-2 border-amber-500/30 ring-4 ring-amber-500/5 transition-transform duration-500 group-hover:scale-105">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <AvatarFallback className="bg-amber-500/10 text-amber-500 text-lg font-bold">
                            {initial}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <h3 className="font-bold text-lg text-white truncate group-hover:text-amber-400 transition-colors">
                        {member.name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold tracking-wider uppercase py-0.5 flex items-center gap-1 ${getCategoryBadgeStyle(
                            member.category,
                            member.barberCategory
                          )}`}
                        >
                          {getRoleIcon(member.category)}
                          {member.roleLabel}
                        </Badge>

                        {member.commissionRate !== null && member.commissionRate > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold tracking-wider uppercase py-0.5 border-orange-500/30 text-orange-400 bg-orange-500/5"
                          >
                            {member.commissionRate}% Comis.
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Access Status & Completeness */}
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    {member.accessStatus === "active_account" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        <ShieldCheck className="h-3.5 w-3.5" /> Acesso ao Painel Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 bg-zinc-800/60 px-2.5 py-1 rounded-lg border border-zinc-700/40">
                        <UserRound className="h-3.5 w-3.5 text-zinc-500" /> Profissional Operacional
                      </span>
                    )}

                    {!member.isProfileComplete && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                        <AlertCircle className="h-3.5 w-3.5" /> Nome/Contato pendente
                      </span>
                    )}
                  </div>

                  {/* Contact & Meta Details */}
                  <div className="space-y-2.5 mb-6 text-sm text-zinc-400">
                    <div className="flex items-center gap-2.5 hover:text-white transition-colors">
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <Phone size={13} className="text-amber-500/70" />
                      </div>
                      <span className="truncate">{member.phone || "Telefone não informado"}</span>
                    </div>

                    <div className="flex items-center gap-2.5 hover:text-white transition-colors">
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <Mail size={13} className="text-amber-500/70" />
                      </div>
                      <span className="truncate">{member.email || "E-mail não informado"}</span>
                    </div>

                    {member.entityType === "barber" && (
                      <div className="flex items-center gap-2.5 text-zinc-300">
                        <div className="p-1.5 rounded-lg bg-white/5">
                          <Scissors size={13} className="text-amber-500/70" />
                        </div>
                        <span>{member.appointmentsCount} atendimentos realizados</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer / Actions */}
                <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  {member.entityType === "barber" ? (
                    <Button
                      variant="outline"
                      onClick={() => navigate({ to: "/barbers" })}
                      className="w-full h-10 border-amber-500/20 text-amber-400 hover:bg-amber-500/10 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Scissors className="h-3.5 w-3.5" />
                      Ver na Gestão de Barbeiros
                      <ExternalLink className="h-3 w-3 ml-1 opacity-70" />
                    </Button>
                  ) : (
                    <div className="w-full flex items-center justify-between text-xs text-zinc-500">
                      <span>Membro interno da equipe</span>
                      <Badge variant="outline" className="border-zinc-800 text-zinc-400 text-[10px]">
                        Sistema
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Executive Table View */
        <div className="bg-[#0b0f17] rounded-2xl border border-gold/15 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Colaborador</TableHead>
                  <TableHead className="text-zinc-400">Categoria & Cargo</TableHead>
                  <TableHead className="text-zinc-400">Contato / WhatsApp</TableHead>
                  <TableHead className="text-zinc-400">Acesso ao Painel</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                  <TableHead className="text-zinc-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => {
                  const initial = (member.name?.[0] || "?").toUpperCase();

                  return (
                    <TableRow
                      key={member.id}
                      className="border-zinc-800/60 hover:bg-white/[0.02] transition-colors"
                    >
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-amber-500/30">
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt={member.name} className="h-full w-full object-cover" />
                            ) : (
                              <AvatarFallback className="bg-amber-500/10 text-amber-500 font-bold text-sm">
                                {initial}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate max-w-xs">{member.name}</div>
                            {member.email && (
                              <div className="text-xs text-zinc-400 truncate max-w-xs">{member.email}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium ${getCategoryBadgeStyle(
                            member.category,
                            member.barberCategory
                          )}`}
                        >
                          {member.roleLabel}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-zinc-300 text-sm">
                        {member.phone ? (
                          <span className="flex items-center gap-1.5 text-zinc-300">
                            <Phone className="h-3.5 w-3.5 text-emerald-400" />
                            {member.phone}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs italic">Não informado</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {member.accessStatus === "active_account" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                            <ShieldCheck className="h-3.5 w-3.5" /> Login Habilitado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            <UserRound className="h-3.5 w-3.5" /> Sem login individual
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={`text-xs ${
                            member.status === "active"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-red-500/15 text-red-400 border border-red-500/30"
                          }`}
                        >
                          {member.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        {member.entityType === "barber" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate({ to: "/barbers" })}
                            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 text-xs"
                          >
                            Ver Barbeiro
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        ) : (
                          <span className="text-xs text-zinc-600">Equipe</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Seção de Convites Pendentes no rodapé quando na aba 'all' */}
      {activeTab === "all" && filteredInvites.length > 0 && (
        <div className="bg-[#0b0f17] rounded-2xl border border-gold/15 overflow-hidden shadow-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2">
              <Mail className="text-gold h-5 w-5" />
              <h2 className="font-bold text-white text-lg">Convites de Acesso Pendentes ({filteredInvites.length})</h2>
            </div>
            <span className="text-xs text-zinc-500">Aguardando confirmação do colaborador</span>
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredInvites.map((invite: any) => (
              <div
                key={invite.id}
                className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white text-sm truncate">{invite.email}</p>
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/5 text-[10px]">
                      Pendente
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 capitalize">Cargo: {invite.role}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Expira em: {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/60">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionInProgressId === invite.id}
                    onClick={() => handleResend(invite.id)}
                    className="text-zinc-300 hover:text-white text-xs h-8 px-2.5"
                  >
                    {actionInProgressId === invite.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1 text-gold" />
                    ) : (
                      <RotateCw className="h-3 w-3 mr-1" />
                    )}
                    Reenviar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionInProgressId === invite.id}
                    onClick={() => handleRevoke(invite.id)}
                    className="text-red-400 hover:text-red-300 text-xs h-8 px-2.5"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Revogar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matriz de Permissões de Referência */}
      <PermissionMatrix />
    </div>
  );
}
