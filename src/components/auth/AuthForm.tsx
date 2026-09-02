import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

import { toast } from "sonner";
import { UserCheck, Lock, Eye, EyeOff, Send, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { resolveAuthenticatedIdentity } from "@/lib/auth-identity.resolver";
import { normalizeIdentifier } from "@/utils/auth-identifier";
import { signInWithPhone, requestPasswordResetByPhone } from "@/lib/auth-phone.functions";

export function AuthForm() {
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");
  
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      toast.error("Informe seu e-mail ou telefone.");
      return;
    }

    if (!password) {
      toast.error("Informe sua senha de acesso.");
      return;
    }

    setLoading(true);
    try {
      const { type, value } = normalizeIdentifier(trimmedIdentifier);

      if (type === "email") {
        // Fluxo de e-mail 100% preservado: direto Browser -> GoTrue
        const { data, error } = await supabase.auth.signInWithPassword({
          email: value,
          password,
        });

        if (error) {
          if (error.status === 429 || error.message?.toLowerCase().includes("rate limit")) {
            throw new Error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
          }
          throw new Error("E-mail/telefone ou senha inválidos.");
        }

        if (!data?.user) {
          throw new Error("Não foi possível autenticar o usuário.");
        }

        // Resolução Canônica de Identidade Unificada
        const identity = await resolveAuthenticatedIdentity(data.user.id);

        if (!identity || identity.destination === "/auth") {
          throw new Error("Acesso não autorizado ou perfil não configurado.");
        }

        toast.success("Login realizado com sucesso!");
        navigate({ to: identity.destination as any });
      } else {
        // Fluxo de telefone: Server Function segura -> GoTrue -> setSession client-side
        const result = await signInWithPhone({
          data: {
            phone: value,
            password,
          },
        });

        if (!result.ok) {
          if (result.code === "RATE_LIMITED") {
            throw new Error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
          }
          if (result.code === "SERVICE_UNAVAILABLE") {
            throw new Error("Não foi possível entrar agora. Tente novamente em instantes.");
          }
          throw new Error("E-mail/telefone ou senha inválidos.");
        }

        // Hidratação da sessão no SDK do cliente Supabase
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });

        if (sessionError) {
          throw new Error("Não foi possível concluir o login. Tente novamente.");
        }

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        if (!userId) {
          throw new Error("Não foi possível autenticar o usuário.");
        }

        // Resolução Canônica de Identidade Unificada
        const identity = await resolveAuthenticatedIdentity(userId);

        if (!identity || identity.destination === "/auth") {
          throw new Error("Acesso não autorizado ou perfil não configurado.");
        }

        toast.success("Login realizado com sucesso!");
        navigate({ to: identity.destination as any });
      }
    } catch (error: any) {
      toast.error(error.message || "Não foi possível realizar o acesso administrativo.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = resetIdentifier.trim();
    if (!trimmed) {
      toast.error("Por favor, insira seu e-mail ou telefone cadastrado.");
      return;
    }
    
    setLoading(true);
    try {
      const { type, value } = normalizeIdentifier(trimmed);

      if (type === "email") {
        const { error } = await supabase.auth.resetPasswordForEmail(value, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) {
          if (error.status === 429 || (error.message && error.message.toLowerCase().includes("rate limit"))) {
            throw new Error("Muitas solicitações. Aguarde alguns minutos antes de tentar novamente.");
          }
        }
      } else {
        const result = await requestPasswordResetByPhone({
          data: { phone: value },
        });
        if (!result.ok && result.code === "RATE_LIMITED") {
          throw new Error("Muitas solicitações. Aguarde alguns minutos antes de tentar novamente.");
        }
      }

      toast.success("Se houver uma conta associada ao e-mail ou telefone informado, enviaremos as instruções de recuperação.");
      setIsResetModalOpen(false);
      setResetIdentifier("");
    } catch (error: any) {
      toast.error(error.message || "Não foi possível solicitar a recuperação de senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleLogin} className="space-y-5" noValidate>
        {/* Identificador Unificado: E-mail ou Telefone */}
        <div className="space-y-2">
          <Label htmlFor="login-identifier" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 ml-1">
            E-mail ou Telefone
          </Label>
          <div className="relative group">
            <UserCheck className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gold/60 group-focus-within:text-gold transition-colors z-10" aria-hidden="true" />
            <Input
              id="login-identifier"
              type="text"
              autoComplete="username"
              className="pl-14 h-[58px] md:h-[62px] rounded-[18px] bg-[#15171B] border-white/10 text-white text-base placeholder:text-zinc-600 placeholder:italic placeholder:font-medium placeholder:opacity-50 focus:bg-[#151D2C] focus:text-white focus-visible:bg-[#151D2C] focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/20 transition-all autofill:[-webkit-text-fill-color:#ffffff] autofill:[box-shadow:0_0_0_1000px_#15171B_inset]"
              placeholder="seu@email.com ou (71) 99999-9999"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Senha de Acesso */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="login-password" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 ml-1">
              Senha de Acesso
            </Label>
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="text-[9px] text-gold font-black uppercase tracking-[0.15em] hover:text-gold/80 transition-colors"
            >
              Esqueci minha senha
            </button>
          </div>
          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gold/60 group-focus-within:text-gold transition-colors z-10" aria-hidden="true" />
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              style={{ ["WebkitTextSecurity" as any]: showPassword ? "none" : "disc" }}
              autoComplete="current-password"
              className="pl-14 pr-14 h-[58px] md:h-[62px] rounded-[18px] bg-[#15171B] border-white/10 text-white text-base placeholder:text-zinc-600 placeholder:italic placeholder:font-medium placeholder:opacity-50 focus:bg-[#151D2C] focus:text-white focus-visible:bg-[#151D2C] focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/20 transition-all autofill:[-webkit-text-fill-color:#ffffff] autofill:[box-shadow:0_0_0_1000px_#15171B_inset]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors p-1 z-20"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-[56px] rounded-[16px] text-black font-black uppercase tracking-widest text-xs transition-all duration-300 hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          style={{
            background: "linear-gradient(135deg, #D4AF37, #B8860B)",
            boxShadow: "0 10px 30px -10px rgba(212,175,55,0.4)",
          }}
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              Processando
            </div>
          ) : (
            <div className="flex items-center gap-2">
              Acessar Painel <ArrowRight size={14} />
            </div>
          )}
        </Button>
      </form>

      {/* Recovery Modal */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="bg-[#0d0f14] border-white/5 rounded-[32px] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-white font-black uppercase tracking-tighter text-2xl italic">
              Recuperar <span className="text-gold">Acesso</span>
            </DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium text-sm leading-relaxed">
              Insira seu e-mail ou telefone e enviaremos as instruções para criar uma nova senha.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPasswordRequest} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="reset-identifier" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                E-mail ou telefone
              </Label>
              <div className="relative group">
                <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-gold transition-colors z-10" aria-hidden="true" />
                <Input
                  id="reset-identifier"
                  type="text"
                  autoComplete="username"
                  className="pl-12 h-[56px] rounded-[16px] bg-[#15171B] border-white/10 text-white text-base placeholder:text-zinc-600 focus:bg-[#151D2C] focus:text-white focus-visible:bg-[#151D2C] focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/20 transition-all autofill:[-webkit-text-fill-color:#ffffff] autofill:[box-shadow:0_0_0_1000px_#15171B_inset]"
                  placeholder="seu@email.com ou (71) 99999-9999"
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter className="sm:flex-col gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-[56px] rounded-[16px] text-black font-black uppercase tracking-widest text-xs transition-all duration-300"
                style={{
                  background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                }}
              >
                {loading ? "Enviando..." : (
                  <div className="flex items-center gap-2">
                    Enviar Instruções <Send size={14} />
                  </div>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsResetModalOpen(false)}
                className="text-zinc-500 hover:text-white font-black uppercase tracking-widest text-[10px]"
              >
                Cancelar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
