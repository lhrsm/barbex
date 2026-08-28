import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { useAuth } from "@/hooks/use-auth";
import { updateMyProfile } from "@/lib/profile.functions";
import { toast } from "sonner";
import { User, Phone, Mail, Loader2, Sparkles, ShieldCheck } from "lucide-react";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function EditProfileModal({
  isOpen,
  onClose,
  title = "Meu Perfil",
  description = "Mantenha suas informações pessoais e de contato atualizadas.",
}: EditProfileModalProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const updateProfileFn = useServerFn(updateMyProfile);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (isOpen && profile) {
      setName(profile.display_name || profile.responsible_name || profile.full_name || "");
      setPhone(profile.phone || "");
      setAvatarUrl((profile as any)?.avatar_url || (profile as any)?.logo_url || "");
    }
  }, [isOpen, profile]);

  const mutation = useMutation({
    mutationFn: async () => {
      return await updateProfileFn({
        data: {
          displayName: name.trim(),
          responsibleName: name.trim(),
          phone: phone.trim(),
          avatarUrl: avatarUrl.trim(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["tenant-profile"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["barbers"] });
      // Atualiza o estado da janela local
      window.location.reload();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar perfil.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Por favor, informe seu nome completo.");
      return;
    }
    if (avatarUrl.trim()) {
      try {
        const parsed = new URL(avatarUrl.trim());
        if (parsed.protocol !== "https:") {
          toast.error("A foto de perfil deve utilizar um link HTTPS seguro (https://).");
          return;
        }
      } catch {
        toast.error("URL da foto de perfil inválida.");
        return;
      }
    }
    mutation.mutate();
  };

  const roleLabel = (profile?.role || "colaborador").toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0b0f17] border-gold/20 text-white shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold">
              <User className="h-4 w-4" />
            </span>
            <DialogTitle className="text-xl font-bold text-white">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-zinc-400 text-sm">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* E-mail (somente leitura) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-400">E-mail de acesso</Label>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400 cursor-not-allowed">
              <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
              <span className="truncate">{profile?.email || user?.email}</span>
              <span className="ml-auto text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                {roleLabel}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">O e-mail é vinculado à sua conta de autenticação.</p>
          </div>

          {/* Nome completo */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="text-xs font-semibold text-zinc-300">
              Nome completo / Exibição <span className="text-gold">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
                className="pl-9 bg-zinc-900/90 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-gold/50"
                required
                maxLength={120}
              />
            </div>
          </div>

          {/* WhatsApp / Telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone" className="text-xs font-semibold text-zinc-300">
              WhatsApp / Celular <span className="text-gold">*</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                id="profile-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(71) 99999-9999"
                className="pl-9 bg-zinc-900/90 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-gold/50"
                maxLength={30}
              />
            </div>
            <p className="text-[11px] text-zinc-500">Usado para notificações operacionais e contato da barbearia.</p>
          </div>

          <DialogFooter className="pt-4 border-t border-zinc-800/80 sm:justify-between items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Ambiente seguro</span>
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
                    Salvar perfil
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
