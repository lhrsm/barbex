import { createFileRoute } from "@tanstack/react-router";
import { Users, UserPlus, Mail, Phone, UserCheck, Loader2, RotateCw, XCircle, Search, Filter, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTeamMembers, getPendingInvitations, resendTeamInvitation, revokeTeamInvitation } from "@/lib/team.functions";
import { useTenant } from "@/hooks/use-tenant";
import { AddUserModal } from "@/components/team/AddUserModal";
import { PermissionMatrix } from "@/components/security/PermissionMatrix";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/usuarios")({
  component: () => (
    <PermissionGuard permission="users:manage">
      <TeamManagementPage />
    </PermissionGuard>
  ),
});

function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: "Administrador",
    tenant_admin: "Dono / Admin",
    super_admin: "Super Admin",
    manager: "Gerente",
    reception: "Recepção",
    receptionist: "Recepcionista",
    financial: "Financeiro",
    finance: "Financeiro",
    cashier: "Caixa",
    barber: "Barbeiro",
    professional: "Profissional",
    client: "Cliente",
    customer: "Cliente",
  };
  return map[role?.toLowerCase()] || role;
}

function TeamManagementPage() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");

  const fetchMembers = useServerFn(getTeamMembers);
  const fetchInvites = useServerFn(getPendingInvitations);
  const resendInviteFn = useServerFn(resendTeamInvitation);
  const revokeInviteFn = useServerFn(revokeTeamInvitation);

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ["team-members", tenantId],
    queryFn: () => fetchMembers({ data: { tenantId: tenantId! } }),
    enabled: !!tenantId,
  });

  const { data: invites, isLoading: loadingInvites } = useQuery({
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

  // Filtragem de membros ativos
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((member: any) => {
      const p = member.profile;
      const name = (p?.responsible_name || p?.display_name || "").toLowerCase();
      const email = (p?.email || "").toLowerCase();
      const phone = (p?.phone || "").toLowerCase();
      const role = (member.role || "").toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || name.includes(q) || email.includes(q) || phone.includes(q);
      const matchesRole = selectedRole === "all" || role === selectedRole.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, selectedRole]);

  // Filtragem de convites pendentes
  const filteredInvites = useMemo(() => {
    if (!invites) return [];
    return invites.filter((invite: any) => {
      const email = (invite.email || "").toLowerCase();
      const role = (invite.role || "").toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || email.includes(q);
      const matchesRole = selectedRole === "all" || role === selectedRole.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [invites, searchQuery, selectedRole]);

  const activeCount = members?.length || 0;
  const pendingCount = invites?.length || 0;
  const totalCount = activeCount + pendingCount;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Quick Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Equipe & Acessos</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gerencie os colaboradores, recepcionistas, gerentes e permissões da sua barbearia.
          </p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gold hover:bg-gold/90 text-black font-bold shadow-lg shadow-gold/20 self-start sm:self-auto"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Convidar colaborador
        </Button>
      </div>

      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        tenantId={tenantId || ""}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#0b0f17] border-gold/15 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total da Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white tabular-nums">
              {loadingMembers || loadingInvites ? <Loader2 className="h-6 w-6 animate-spin text-gold" /> : totalCount}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Colaboradores vinculados e convites</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0f17] border-emerald-500/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Membros Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-400 tabular-nums">
              {loadingMembers ? <Loader2 className="h-6 w-6 animate-spin text-emerald-400" /> : activeCount}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Acessos habilitados e confirmados</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0f17] border-gold/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gold">Convites Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-gold tabular-nums">
              {loadingInvites ? <Loader2 className="h-6 w-6 animate-spin text-gold" /> : pendingCount}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Aguardando confirmação e criação de senha</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou WhatsApp..."
            className="pl-9 bg-[#0b0f17] border-zinc-800 text-white placeholder:text-zinc-500 text-sm focus-visible:ring-gold/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Função:
          </span>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="bg-[#0b0f17] border border-zinc-800 text-xs text-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50 cursor-pointer"
          >
            <option value="all">Todas as funções</option>
            <option value="reception">Recepção</option>
            <option value="manager">Gerente</option>
            <option value="financial">Financeiro / Caixa</option>
            <option value="barber">Barbeiro</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>

      {/* Seção 1: Membros Ativos */}
      <div className="bg-[#0b0f17] rounded-xl border border-gold/15 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-gold/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-gold h-5 w-5" />
            <h2 className="font-bold text-white text-base sm:text-lg">Membros Ativos ({filteredMembers.length})</h2>
          </div>
          <span className="text-xs text-zinc-500">Fonte canônica: tenant_memberships</span>
        </div>

        {/* Visualização Desktop: Tabela */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Colaborador</TableHead>
                <TableHead className="text-zinc-400">Função</TableHead>
                <TableHead className="text-zinc-400">Contato / WhatsApp</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400 text-right">Completude</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingMembers ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-zinc-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-gold mb-2" />
                    Carregando membros da equipe...
                  </TableCell>
                </TableRow>
              ) : filteredMembers.length > 0 ? (
                filteredMembers.map((member: any) => {
                  const p = member.profile;
                  const primaryName = p?.responsible_name || p?.display_name || p?.email || "Colaborador";
                  const email = p?.email || member.user_id;
                  const phone = p?.phone;
                  const isProfileIncomplete = !p?.display_name && !p?.responsible_name;
                  const initial = (primaryName?.[0] || "?").toUpperCase();

                  return (
                    <TableRow key={member.id} className="border-zinc-800/60 hover:bg-white/[0.02] transition-colors">
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center text-gold font-bold text-sm shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate max-w-xs">{primaryName}</div>
                            {primaryName !== email && (
                              <div className="text-xs text-zinc-400 truncate max-w-xs">{email}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-gold/25 text-gold bg-gold/5 capitalize font-medium text-xs">
                          {getRoleLabel(member.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-300 text-sm">
                        {phone ? (
                          <span className="flex items-center gap-1.5 text-zinc-300">
                            <Phone className="h-3.5 w-3.5 text-emerald-400" />
                            {phone}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs italic">Não informado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                          Ativo
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isProfileIncomplete ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                            Nome pendente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                            <ShieldCheck className="h-3.5 w-3.5" /> Completo
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-zinc-500">
                    Nenhum membro ativo encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Visualização Mobile: Cards */}
        <div className="md:hidden divide-y divide-zinc-800/80">
          {loadingMembers ? (
            <div className="text-center py-8 text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gold mb-2" />
              Carregando membros...
            </div>
          ) : filteredMembers.length > 0 ? (
            filteredMembers.map((member: any) => {
              const p = member.profile;
              const primaryName = p?.responsible_name || p?.display_name || p?.email || "Colaborador";
              const email = p?.email || member.user_id;
              const phone = p?.phone;
              const isProfileIncomplete = !p?.display_name && !p?.responsible_name;
              const initial = (primaryName?.[0] || "?").toUpperCase();

              return (
                <div key={member.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center text-gold font-bold text-base shrink-0">
                        {initial}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{primaryName}</p>
                        <Badge variant="outline" className="border-gold/25 text-gold bg-gold/5 text-[10px] mt-0.5">
                          {getRoleLabel(member.role)}
                        </Badge>
                      </div>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs">
                      Ativo
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-zinc-400 pl-13">
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{email}</span>
                    </p>
                    {phone && (
                      <p className="flex items-center gap-1.5 text-zinc-300">
                        <Phone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>{phone}</span>
                      </p>
                    )}
                    {isProfileIncomplete && (
                      <p className="text-amber-400 text-[11px] pt-1">⚠️ Perfil aguardando preenchimento do nome</p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-zinc-500 text-sm">
              Nenhum membro ativo encontrado.
            </div>
          )}
        </div>
      </div>

      {/* Seção 2: Convites Pendentes */}
      {filteredInvites.length > 0 && (
        <div className="bg-[#0b0f17] rounded-xl border border-gold/15 overflow-hidden shadow-lg">
          <div className="p-4 border-b border-gold/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="text-gold h-5 w-5" />
              <h2 className="font-bold text-white text-base sm:text-lg">Convites Pendentes ({filteredInvites.length})</h2>
            </div>
            <span className="text-xs text-zinc-500">Aguardando aceite</span>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">E-mail Convidado</TableHead>
                  <TableHead className="text-zinc-400">Função</TableHead>
                  <TableHead className="text-zinc-400">WhatsApp</TableHead>
                  <TableHead className="text-zinc-400">Expira em</TableHead>
                  <TableHead className="text-zinc-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvites.map((invite: any) => (
                  <TableRow key={invite.id} className="border-zinc-800/60 hover:bg-white/[0.02]">
                    <TableCell className="font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-zinc-500" />
                        <span>{invite.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-gold/25 text-gold bg-gold/5 capitalize text-xs">
                        {getRoleLabel(invite.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-300 text-sm">
                      {invite.phone || <span className="text-zinc-600 text-xs italic">Não informado</span>}
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionInProgressId === invite.id}
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs"
                        onClick={() => handleResend(invite.id)}
                      >
                        {actionInProgressId === invite.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 text-gold" />
                        ) : (
                          <RotateCw className="h-3.5 w-3.5 mr-1" />
                        )}
                        Reenviar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionInProgressId === invite.id}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                        onClick={() => handleRevoke(invite.id)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Revogar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-zinc-800/80">
            {filteredInvites.map((invite: any) => (
              <div key={invite.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-white text-sm truncate">{invite.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="border-gold/25 text-gold bg-gold/5 text-[10px]">
                        {getRoleLabel(invite.role)}
                      </Badge>
                      <Badge className="bg-amber-500/15 text-amber-400 border-none text-[10px]">
                        Pendente
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                  <span className="text-[11px] text-zinc-500">Expira: {new Date(invite.expires_at).toLocaleDateString()}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionInProgressId === invite.id}
                      className="text-zinc-400 hover:text-white text-xs h-7 px-2"
                      onClick={() => handleResend(invite.id)}
                    >
                      <RotateCw className="h-3 w-3 mr-1" /> Reenviar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionInProgressId === invite.id}
                      className="text-red-400 hover:text-red-300 text-xs h-7 px-2"
                      onClick={() => handleRevoke(invite.id)}
                    >
                      <XCircle className="h-3 w-3 mr-1" /> Revogar
                    </Button>
                  </div>
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
