import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { updateMyProfileClient } from "@/lib/backend/client/profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Phone, Mail, Loader2, Sparkles, ShieldCheck, Camera, Trash2 } from "lucide-react";

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
  description = "Mantenha suas informações pessoais e foto de perfil atualizadas.",
}: EditProfileModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Directly fetch fresh profile record to eliminate any stale session/auth state
  const { data: directProfile } = useQuery({
    queryKey: ["my-profile-direct", user?.id],
    enabled: isOpen && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, responsible_name, full_name, phone, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (isOpen) {
      const current = directProfile || profile;
      if (current) {
        setName(current.display_name || current.responsible_name || (current as any).full_name || "");
        setPhone(current.phone || "");
        // Strictly personal avatar: never fall back to barbershop logo_url
        setAvatarUrl(current.avatar_url || "");
      }
    }
  }, [isOpen, profile, directProfile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // 1. Client-side Size Validation (Max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 5MB.");
      return;
    }

    // 2. Client-side MIME Type Validation
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato inválido. Por favor, envie uma imagem JPG, PNG ou WEBP.");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(fileExt) ? fileExt : "jpg";
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${safeExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from("user-avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      toast.success("Foto carregada com sucesso! Clique em 'Salvar perfil' para confirmar.");
    } catch (err: any) {
      console.error("[EditProfileModal] Avatar upload error:", err);
      toast.error(err.message || "Erro ao enviar imagem.");
    } finally {
      setIsUploadingAvatar(false);
      // Reset input value so same file can be chosen again if needed
      e.target.value = "";
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl("");
    toast.info("Foto removida. Clique em 'Salvar perfil' para confirmar.");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      return await updateMyProfileClient({
        displayName: name.trim(),
        responsibleName: name.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUrl.trim(),
      });
    },
    onSuccess: async () => {
      toast.success("Perfil atualizado com sucesso!");
      try {
        await refreshProfile();
      } catch (e) {
        console.warn("[EditProfileModal] Failed to refresh auth profile:", e);
      }
      queryClient.invalidateQueries({ queryKey: ["my-profile-direct", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["tenant-profile"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["barbers"] });
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
  const initials = (name?.substring(0, 2) || "US").toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0b0f17] border-gold/20 text-white shadow-2xl rounded-2xl">
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
          {/* Avatar Upload & Preview Section */}
          <div className="flex flex-col items-center gap-2 py-2 border-b border-zinc-800/60 pb-4">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-gold/40 ring-4 ring-gold/10 shadow-xl">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={name || "Perfil"} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-gold/10 text-gold text-2xl font-black">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <label
                htmlFor="personal-avatar-file-input"
                className="absolute bottom-0 right-0 h-8 w-8 bg-gold hover:bg-gold/90 text-black rounded-full flex items-center justify-center cursor-pointer shadow-md transition-transform hover:scale-105 active:scale-95 z-10"
                title="Alterar foto de perfil"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                ) : (
                  <Camera className="h-4 w-4 text-black" />
                )}
                <input
                  id="personal-avatar-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={isUploadingAvatar || mutation.isPending}
                  onChange={handleAvatarUpload}
                />
              </label>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-zinc-400">
                {isUploadingAvatar ? "Enviando foto..." : "JPG, PNG ou WEBP até 5MB"}
              </span>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isUploadingAvatar || mutation.isPending}
                  className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-0.5 ml-1 transition-colors"
                >
                  <Trash2 className="h-3 w-3 inline" /> Remover foto
                </button>
              )}
            </div>
          </div>

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
                disabled={mutation.isPending || isUploadingAvatar}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || isUploadingAvatar}
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
