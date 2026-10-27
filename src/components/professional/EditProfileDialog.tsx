import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, X, Loader2, QrCode } from "lucide-react";
import { validatePixKey, normalizePixKey } from "@/utils/pix-validator";

export function EditProfileDialog({ isOpen, onClose, barber, onUpdate }: any) {
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    bio: "",
    avatar_url: "",
    active: true,
    category: "",
    specialties_string: "",
    pix_key: "",
    pix_key_type: "cpf",
    accepts_tips: false,
  });

  useEffect(() => {
    if (barber && isOpen) {
      setFormData({
        name: barber.name || "",
        phone: barber.phone || "",
        email: barber.email || "",
        bio: barber.bio || "",
        avatar_url: barber.avatar_url || "",
        active: barber.active !== false,
        category: barber.category || "",
        specialties_string: Array.isArray(barber.specialties) ? barber.specialties.join(", ") : "",
        pix_key: barber.pix_key || "",
        pix_key_type: barber.pix_key_type || "cpf",
        accepts_tips: barber.accepts_tips ?? false,
      });
    }
  }, [barber, isOpen]);

  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 5MB.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato inválido. Use imagens JPG, PNG ou WEBP.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      toast.error("Sessão não identificada para upload.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(fileExt) ? fileExt : "jpg";
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${safeExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("barber-avatars")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from("barber-avatars")
        .getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Foto carregada com sucesso! Clique em 'Salvar Perfil' para confirmar.");
    } catch (err: any) {
      console.error("[EditProfileDialog] Upload error:", err);
      toast.error(err.message || "Erro ao carregar foto do profissional.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const specialties = formData.specialties_string
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Validação coerente para formatos PIX quando gorjetas estiverem habilitadas
      if (formData.accepts_tips && formData.pix_key.trim()) {
        const pixValidation = validatePixKey(formData.pix_key, formData.pix_key_type);
        if (!pixValidation.isValid) {
          toast.error(`Chave PIX inválida: ${pixValidation.errorMessage}`);
          setLoading(false);
          return;
        }
      }

      const normalizedPixKey = (formData.accepts_tips && formData.pix_key.trim())
        ? normalizePixKey(formData.pix_key, formData.pix_key_type)
        : formData.pix_key.trim();

      // 1. Atualização de dados PIX exclusivamente via RPC autorizada (Gate 3 - Sem fallback inseguro)
      const hasPixConfigured = formData.accepts_tips || Boolean(formData.pix_key.trim());
      const pixChanged = (
        normalizedPixKey !== (barber.pix_key || "") ||
        formData.pix_key_type !== (barber.pix_key_type || "cpf") ||
        formData.accepts_tips !== (barber.accepts_tips ?? false)
      );

      if (hasPixConfigured || pixChanged) {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("update_barber_pix_info", {
          p_barber_id: barber.id,
          p_pix_key: normalizedPixKey,
          p_pix_key_type: formData.pix_key_type,
          p_accepts_tips: formData.accepts_tips,
        });

        if (rpcErr) {
          console.error("[EditProfileDialog] Erro na RPC de PIX:", rpcErr);
          toast.error(`Não foi possível salvar as configurações de PIX: ${rpcErr.message}`);
          setLoading(false);
          return; // Aborta imediatamente sem salvar parcialmente e sem fallback inseguro
        }

        if (!rpcRes || !(rpcRes as any).success) {
          const failureMsg = (rpcRes as any)?.error || "Erro de validação no servidor ao atualizar PIX.";
          console.error("[EditProfileDialog] Falha na validação do servidor:", failureMsg);
          toast.error(`Erro ao salvar PIX: ${failureMsg}`);
          setLoading(false);
          return; // Aborta imediatamente sem salvar parcialmente
        }
      }

      // 2. Persistência dos dados de perfil estritamente autorizados ao profissional
      // Exclui colunas administrativas e não envia dados de PIX diretamente na tabela barbers
      const updatePayload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        bio: formData.bio,
        avatar_url: formData.avatar_url,
        active: formData.active,
        category: formData.category,
        specialties: specialties,
      };

      const { error: profileError } = await supabase
        .from("barbers")
        .update(updatePayload)
        .eq("id", barber.id);
      
      if (profileError) throw profileError;
      toast.success("Perfil e configurações atualizados com sucesso!");
      if (onUpdate) onUpdate();
      onClose();
    } catch (e: any) {
      console.error("[EditProfileDialog] Erro ao salvar perfil:", e);
      toast.error("Erro ao salvar: " + (e.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-[#0b0f17] border-gold/20 rounded-2xl shadow-2xl text-white">
        <DialogHeader className="border-b border-gold/10 pb-4">
          <DialogTitle className="text-xl font-black text-gold uppercase tracking-wider">Editar Perfil Profissional</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <Avatar className="h-28 w-28 border-4 border-gold/30 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                <AvatarImage src={formData.avatar_url} className="object-cover" />
                <AvatarFallback className="bg-gold/10 text-gold text-3xl font-black">
                  {formData.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="barber-avatar-input"
                className="absolute bottom-0 right-0 bg-gold hover:bg-gold/90 p-2.5 rounded-full text-black shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95 z-10"
                title="Carregar foto do computador/celular"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                ) : (
                  <Camera className="h-4 w-4 text-black" />
                )}
                <input
                  id="barber-avatar-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingAvatar || loading}
                  onChange={handleAvatarFileUpload}
                />
              </label>
            </div>
            <p className="text-[11px] text-zinc-400">
              {uploadingAvatar ? "Enviando imagem..." : "Clique na câmera para enviar foto (máx. 5MB)"}
            </p>
            
            <div className="w-full space-y-1.5 pt-1">
              <Label className="text-gold font-black uppercase text-[10px] tracking-[0.2em] ml-1">Ou informe a URL da Foto</Label>
              <Input 
                placeholder="https://..." 
                value={formData.avatar_url}
                onChange={(e) => setFormData({...formData, avatar_url: e.target.value})}
                className="bg-[#05070d] border-gold/20 focus-visible:ring-gold/40 rounded-xl h-11 text-white placeholder:text-gray-600 font-medium text-xs"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gold font-black uppercase text-[10px] tracking-[0.2em] ml-1">Nome Completo</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-[#05070d] border-gold/20 focus-visible:ring-gold/40 rounded-xl h-11 text-white font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gold font-black uppercase text-[10px] tracking-[0.2em] ml-1">E-mail</Label>
              <Input 
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="bg-[#05070d] border-gold/20 focus-visible:ring-gold/40 rounded-xl h-11 text-white font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gold font-black uppercase text-[10px] tracking-[0.2em] ml-1">Telefone / WhatsApp</Label>
              <Input 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="bg-[#05070d] border-gold/20 focus-visible:ring-gold/40 rounded-xl h-11 text-white font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gold font-black uppercase text-[10px] tracking-[0.2em] ml-1">Cargo / Tipo</Label>
              <Input 
                placeholder="Ex: Freelancer, Master, etc."
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="bg-[#05070d] border-gold/20 focus-visible:ring-gold/40 rounded-xl h-11 text-white font-bold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gold font-black uppercase text-[10px] tracking-[0.2em] ml-1">Especialidades (separadas por vírgula)</Label>
            <Input 
              placeholder="Ex: Corte Degradê, Barba, Pigmentação"
              value={formData.specialties_string}
              onChange={(e) => setFormData({...formData, specialties_string: e.target.value})}
              className="bg-[#05070d] border-gold/20 focus-visible:ring-gold/40 rounded-xl h-11 text-white font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gold font-black uppercase text-[10px] tracking-[0.2em] ml-1">Bio / Descrição Profissional</Label>
            <Textarea 
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              className="bg-[#05070d] border-gold/20 focus-visible:ring-gold/40 min-h-[100px] rounded-xl text-white font-medium resize-none"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gold/5 rounded-xl border border-gold/10">
            <div className="space-y-1">
              <Label className="text-gold font-black uppercase text-[10px] tracking-wider">Perfil Disponível</Label>
              <p className="text-[10px] text-gray-500 font-medium leading-tight">Os clientes poderão ver seu perfil e realizar agendamentos.</p>
            </div>
            <Switch 
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({...formData, active: checked})}
              className="data-[state=checked]:bg-gold"
            />
          </div>

          {/* Seção PIX para Gorjetas */}
          <div className="p-4 bg-zinc-950/80 rounded-xl border border-gold/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-gold" />
                  <Label className="text-gold font-black uppercase text-[10px] tracking-wider">
                    PIX para Gorjetas Digitais
                  </Label>
                </div>
                <p className="text-[10px] text-gray-400 font-medium leading-tight">
                  Permite aos clientes enviarem gorjetas diretamente para sua conta ao avaliar o atendimento.
                </p>
              </div>
              <Switch 
                id="edit-profile-accepts-tips"
                checked={formData.accepts_tips}
                onCheckedChange={(checked) => setFormData({...formData, accepts_tips: checked})}
                className="data-[state=checked]:bg-gold"
              />
            </div>

            {formData.accepts_tips && (
              <div className="space-y-3 pt-2 border-t border-gold/10">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 font-semibold text-xs">Tipo de Chave PIX</Label>
                  <select
                    id="edit-profile-pix-type"
                    value={formData.pix_key_type}
                    onChange={(e) => setFormData({ ...formData, pix_key_type: e.target.value })}
                    className="w-full bg-[#05070d] border border-gold/20 focus-visible:ring-gold/40 rounded-xl h-11 text-white font-medium text-xs px-3 focus:outline-none"
                  >
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="phone">Telefone / Celular</option>
                    <option value="email">E-mail</option>
                    <option value="random">Chave Aleatória (EVP)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-300 font-semibold text-xs">Chave PIX</Label>
                  <Input 
                    id="edit-profile-pix-key"
                    placeholder={
                      formData.pix_key_type === 'cpf' ? '000.000.000-00' :
                      formData.pix_key_type === 'cnpj' ? '00.000.000/0000-00' :
                      formData.pix_key_type === 'phone' ? '(11) 99999-9999' :
                      formData.pix_key_type === 'email' ? 'seu-pix@exemplo.com' :
                      'Chave aleatória de 32 ou 36 caracteres'
                    }
                    value={formData.pix_key}
                    onChange={(e) => setFormData({...formData, pix_key: e.target.value})}
                    className="bg-[#05070d] border-gold/20 focus-visible:ring-gold/40 rounded-xl h-11 text-white placeholder:text-gray-600 font-medium text-xs"
                  />
                  <p className="text-[10px] text-zinc-400">
                    O valor é transferido 100% diretamente ao profissional via app bancário do cliente.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-3 border-t border-gold/10 pt-6 mt-2">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-white/5 font-bold rounded-xl h-10 px-6"
          >
            <X className="h-4 w-4 mr-2" /> Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || uploadingAvatar}
            className="bg-gold hover:bg-[#B8962E] text-black border-0 rounded-xl font-black px-8 h-10 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(212,175,55,0.2)]"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Salvar Perfil
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
