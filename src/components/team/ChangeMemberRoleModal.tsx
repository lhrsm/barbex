import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  Headphones,
  DollarSign,
  Briefcase,
  Scissors,
  Crown,
} from "lucide-react";
import type { UnifiedTeamMember } from "@/lib/backend/edge/team";

interface ChangeMemberRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: UnifiedTeamMember | null;
  tenantId: string;
  currentUserId?: string | null;
  onSuccess?: () => void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveCanonicalUserId(member: UnifiedTeamMember | null | undefined): string | null {
  if (!member) return null;
  // 1. Prioridade canônica: member.userId (UUID real de auth.users / tenant_memberships.user_id)
  if (member.userId && typeof member.userId === "string" && UUID_REGEX.test(member.userId.trim())) {
    return member.userId.trim();
  }
  // 2. Se member.id já for um UUID puro sem prefixo sintético (ex: "staff-" ou "barber-")
  if (member.id && typeof member.id === "string" && UUID_REGEX.test(member.id.trim())) {
    return member.id.trim();
  }
  return null;
}

const AVAILABLE_ROLES = [
  { value: "reception", label: "Recepcionista", icon: Headphones, desc: "Agendamentos, atendimento a clientes e escala diária" },
  { value: "financial", label: "Financeiro", icon: DollarSign, desc: "Gestão do caixa, DRE, conciliação e quitação de comissões" },
  { value: "manager", label: "Gerente", icon: Briefcase, desc: "Acompanhamento da equipe, clientes e marketing operacional" },
  { value: "barber", label: "Profissional / Barbeiro", icon: Scissors, desc: "Atendimento técnico, comissões individuais e agenda" },
  { value: "tenant_admin", label: "Administrador da Barbearia", icon: Crown, desc: "Gestão completa da unidade e membros da equipe" },
];

export function ChangeMemberRoleModal({
  isOpen,
  onClose,
  member,
  tenantId,
  currentUserId,
  onSuccess,
}: ChangeMemberRoleModalProps) {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [confirmStep, setConfirmStep] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && member) {
      setSelectedRole(member.category === "barber" ? "barber" : member.role || "reception");
      setConfirmStep(false);
    }
  }, [isOpen, member]);

  const canonicalUserId = resolveCanonicalUserId(member);
  const isSelf = Boolean(canonicalUserId && currentUserId && canonicalUserId === currentUserId);
  const isOwner = Boolean(canonicalUserId && tenantId && canonicalUserId === tenantId);
  const isMissingCanonicalId = !canonicalUserId;
  const isBlocked = isSelf || isOwner || isMissingCanonicalId;

  const currentRoleInfo = AVAILABLE_ROLES.find(
    (r) => r.value === member?.category || r.value === member?.role
  );
  const newRoleInfo = AVAILABLE_ROLES.find((r) => r.value === selectedRole);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!canonicalUserId || !tenantId) {
        throw new Error("Não foi possível identificar o identificador canônico (UUID) do colaborador para esta operação.");
      }
      if (isSelf) {
        throw new Error("Não é permitido alterar seu próprio cargo.");
      }
      if (isOwner) {
        throw new Error("Não é permitido alterar o cargo do proprietário principal.");
      }

      const { data, error } = await (supabase.rpc as any)("change_tenant_team_member_role", {
        p_tenant_id: tenantId,
        p_target_user_id: canonicalUserId,
        p_new_role: selectedRole,
      });

      if (error) {
        throw new Error(error.message);
      }

      const res = data as any;
      if (!res?.success) {
        throw new Error(res?.message || "Falha ao alterar cargo.");
      }

      return res;
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || "Cargo alterado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["team-members", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-membership"] });
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar cargo do colaborador.");
      setConfirmStep(false);
    },
  });

  if (!member) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-[#0b0f17] border-amber-500/30 text-white shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <DialogTitle className="text-xl font-black text-white">
              Alterar Cargo do Colaborador
            </DialogTitle>
          </div>
          <DialogDescription className="text-zinc-400 text-xs">
            A alteração de cargo substitui o perfil de acesso do colaborador neste estabelecimento, revogando as permissões antigas e concedendo as novas atribuições de forma atômica.
          </DialogDescription>
        </DialogHeader>

        {isBlocked ? (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 my-2">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-300">
              <p className="font-bold">Ação não permitida</p>
              <p className="mt-1 text-red-300/80">
                {isSelf
                  ? "Por motivos de segurança e prevenção de autopromoção, você não pode alterar o seu próprio cargo."
                  : isOwner
                  ? "O proprietário principal da barbearia não pode ter seu cargo alterado por este menu."
                  : "Este colaborador não possui uma conta de usuário ativa (UUID) vinculada ao sistema para alteração de papéis de acesso."}
              </p>
            </div>
          </div>
        ) : !confirmStep ? (
          <div className="space-y-4 py-2">
            {/* Resumo do Membro */}
            <div className="rounded-xl border border-zinc-800 bg-[#05070d] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-white">{member.name}</p>
                  <p className="text-[11px] text-zinc-400">{member.email || "Sem e-mail"}</p>
                </div>
                <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/5 text-xs font-bold">
                  Atual: {member.roleLabel}
                </Badge>
              </div>
            </div>

            {/* Seleção de Novo Cargo */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Novo Cargo Pretendido
              </Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="bg-[#05070d] border-zinc-700 text-white h-11 focus:border-amber-500/60 rounded-xl">
                  <SelectValue placeholder="Selecione o novo cargo" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0f17] border-zinc-800 text-white">
                  {AVAILABLE_ROLES.map((r) => {
                    const Icon = r.icon;
                    return (
                      <SelectItem key={r.value} value={r.value} className="py-2.5 focus:bg-amber-500/10 focus:text-white">
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 text-amber-400 shrink-0" />
                          <div>
                            <p className="font-bold text-xs">{r.label}</p>
                            <p className="text-[10px] text-zinc-400">{r.desc}</p>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Alerta de Governança e Sessão */}
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-300/90 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
                Governança de Acesso e Sessão
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                • Modelo <strong>mono-role</strong>: O cargo anterior é revogado imediatamente na barbearia.
                <br />
                • Se o colaborador sair da <strong>Recepção</strong>, todas as permissões de recepção são desativadas.
                <br />
                • Sessões já abertas no navegador do colaborador poderão exigir recarregamento da página para atualizar o cache de permissões.
              </p>
            </div>

            <DialogFooter className="pt-3 border-t border-zinc-800/80 gap-2 sm:gap-0">
              <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmStep(true)}
                disabled={selectedRole === (member.category === "barber" ? "barber" : member.role)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs gap-1.5 shadow-[0_4px_16px_rgba(245,158,11,0.2)]"
              >
                Avançar para Confirmação
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* ETAPA 2: CONFIRMAÇÃO EXPLÍCITA */
          <div className="space-y-4 py-2">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center space-y-2">
              <AlertTriangle className="h-7 w-7 text-amber-400 mx-auto" />
              <p className="text-sm font-black text-white">
                Confirmar alteração de permissões?
              </p>
              <p className="text-xs text-zinc-300">
                Você está prestes a modificar o cargo do colaborador:
              </p>
              <div className="flex items-center justify-center gap-3 pt-2 text-xs font-bold">
                <Badge variant="outline" className="border-zinc-700 bg-zinc-800/80 text-zinc-300">
                  {currentRoleInfo?.label || member.roleLabel}
                </Badge>
                <ArrowRight className="h-4 w-4 text-amber-400" />
                <Badge className="bg-amber-500 text-black font-black">
                  {newRoleInfo?.label}
                </Badge>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 text-center">
              Esta ação será registrada no log de auditoria do estabelecimento com a data e seu identificador de operador.
            </p>

            <DialogFooter className="pt-3 border-t border-zinc-800/80 gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setConfirmStep(false)}
                disabled={mutation.isPending}
                className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs"
              >
                Voltar e Ajustar
              </Button>
              <Button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs gap-1.5 shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Atualizando Cargo...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-1" />
                    Confirmar e Aplicar Cargo
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
