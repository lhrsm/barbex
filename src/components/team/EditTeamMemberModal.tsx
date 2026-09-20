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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Phone, Mail, Loader2, Sparkles, ShieldCheck, Briefcase } from "lucide-react";
import type { UnifiedTeamMember } from "@/lib/backend/edge/team";

interface EditTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: UnifiedTeamMember | null;
  tenantId: string;
  onSuccess?: () => void;
}

export function EditTeamMemberModal({
  isOpen,
  onClose,
  member,
  tenantId,
  onSuccess,
}: EditTeamMemberModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (isOpen && member) {
      setName(member.name || "");
      setPhone(member.phone || "");
    }
  }, [isOpen, member]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!member?.id || !tenantId) {
        throw new Error("Dados do colaborador ou da barbearia incompletos.");
      }

      const { data, error } = await supabase.rpc("update_tenant_team_member", {
        p_target_user_id: member.id,
        p_tenant_id: tenantId,
        p_display_name: name.trim(),
        p_phone: phone.trim() || null,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Dados do colaborador atualizados com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["team-members", tenantId] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar dados do colaborador.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Por favor, informe o nome do colaborador.");
      return;
    }
    mutation.mutate();
  };

  if (!member) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0b0f17] border-gold/20 text-white shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold">
              <User className="h-4 w-4" />
            </span>
            <DialogTitle className="text-xl font-bold text-white">Editar Colaborador</DialogTitle>
          </div>
          <DialogDescription className="text-zinc-400 text-xs">
            Atualize o nome e telefone de contato do membro da equipe. O papel e login permanecem inalterados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* E-mail de acesso (somente leitura) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-400">E-mail de acesso</Label>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400 cursor-not-allowed">
              <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
              <span className="truncate">{member.email || "Sem e-mail cadastrado"}</span>
              <Badge variant="outline" className="ml-auto text-[10px] border-zinc-700 text-zinc-300">
                <Briefcase className="h-3 w-3 mr-1 text-gold" />
                {member.roleLabel}
              </Badge>
            </div>
            <p className="text-[10px] text-zinc-500">O e-mail de login não pode ser modificado administrativamente.</p>
          </div>

          {/* Nome completo */}
          <div className="space-y-1.5">
            <Label htmlFor="team-member-name" className="text-xs font-semibold text-zinc-300">
              Nome do Colaborador <span className="text-gold">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                id="team-member-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Maria Santos"
                className="pl-9 bg-zinc-900/90 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-gold/50"
                required
                maxLength={120}
              />
            </div>
          </div>

          {/* WhatsApp / Telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="team-member-phone" className="text-xs font-semibold text-zinc-300">
              WhatsApp / Celular
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                id="team-member-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(71) 99999-9999"
                className="pl-9 bg-zinc-900/90 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-gold/50"
                maxLength={30}
              />
            </div>
            <p className="text-[10px] text-zinc-500">Usado para contato interno e escalas operacionais.</p>
          </div>

          <DialogFooter className="pt-4 border-t border-zinc-800/80 sm:justify-between items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Acesso restrito a administradores</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={mutation.isPending}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-gold hover:bg-gold/90 text-black font-semibold shadow-lg shadow-gold/20"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Salvar alterações
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
