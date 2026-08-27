
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { validateInvitationToken, acceptTeamInvitation } from "@/lib/team.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BarbexLogo } from "@/components/ui/barbex-logo";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Mail, AlertCircle, Lock } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  component: AcceptInvitationPage,
});

type PageState = "VALIDATING" | "VALID" | "INVALID" | "SUBMITTING" | "SUCCESS";

interface InvitationData {
  barbershopName: string;
  role: string;
  email: string;
  expiresAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  reception: "Recepcionista",
  receptionist: "Recepcionista",
  manager: "Gerente",
  financial: "Financeiro",
  finance: "Financeiro",
  cashier: "Caixa",
  barber: "Profissional / Barbeiro",
  professional: "Profissional / Barbeiro",
  tenant_admin: "Administrador",
  admin: "Administrador",
};

function AcceptInvitationPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("VALIDATING");
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("Convite inválido ou já utilizado.");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const validateFn = useServerFn(validateInvitationToken);
  const acceptFn = useServerFn(acceptTeamInvitation);

  useEffect(() => {
    let isMounted = true;

    async function checkInvitation() {
      if (!token || typeof token !== "string" || !/^[a-fA-F0-9]{64}$/.test(token.trim())) {
        if (isMounted) {
          setErrorMessage("Convite inválido ou já utilizado.");
          setPageState("INVALID");
        }
        return;
      }

      setPageState("VALIDATING");

      try {
        const result = await validateFn({ data: { token: token.trim() } });
        if (!isMounted) return;

        if (!result || !result.valid) {
          setErrorMessage("Convite inválido ou já utilizado.");
          setPageState("INVALID");
          return;
        }

        setInvitation({
          barbershopName: result.barbershopName || "Barbearia",
          role: result.role || "Membro",
          email: result.email || "",
          expiresAt: result.expiresAt || ""
        });
        setPageState("VALID");
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage("Convite inválido ou já utilizado.");
        setPageState("INVALID");
      }
    }

    checkInvitation();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setPageState("SUBMITTING");
    try {
      await acceptFn({ data: { token: token.trim(), password } });
      setPageState("SUCCESS");
      toast.success("Acesso criado com sucesso! Faça seu login.");
      navigate({ to: "/auth" });
    } catch (err: any) {
      setPageState("VALID");
      toast.error(err.message || "Erro ao ativar acesso");
    }
  };

  const formattedRole = invitation?.role ? (ROLE_LABELS[invitation.role] || invitation.role) : "Membro";

  if (pageState === "VALIDATING") {
    return (
      <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-4">
        <div className="mb-8">
          <BarbexLogo size="xl" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-gold animate-spin" />
          <p className="text-zinc-400 text-sm">Validando convite de acesso...</p>
        </div>
      </div>
    );
  }

  if (pageState === "INVALID") {
    return (
      <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-4">
        <div className="mb-8">
          <BarbexLogo size="xl" />
        </div>
        <Card className="w-full max-w-md bg-[#0b0f17] border-red-500/20 shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-3">
              <div className="h-14 w-14 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-white">Oops!</CardTitle>
            <CardDescription className="text-red-400 text-base mt-2">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center pt-2">
            <Button onClick={() => navigate({ to: "/" })} className="bg-gold text-black font-semibold hover:bg-gold/90">
              Voltar para o início
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        <BarbexLogo size="xl" />
      </div>
      
      <Card className="w-full max-w-md bg-[#0b0f17] border-gold/20 shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-gold/10 rounded-full flex items-center justify-center border border-gold/20">
              <ShieldCheck className="h-8 w-8 text-gold" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">Você foi convidado!</CardTitle>
          <CardDescription className="text-zinc-400 text-sm mt-1">
            <strong className="text-zinc-200">{invitation?.barbershopName}</strong> convidou você para atuar como <strong className="text-gold">{formattedRole}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Seu E-mail de Acesso</Label>
              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10 text-zinc-300 text-sm">
                <Mail size={16} className="text-gold" />
                <span className="font-mono">{invitation?.email}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300 text-sm">Crie sua senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-black/40 border-white/10 focus:border-gold/50 text-white pl-10"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
                <Lock size={16} className="absolute left-3 top-3 text-zinc-500" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-zinc-300 text-sm">Confirme sua senha</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-black/40 border-white/10 focus:border-gold/50 text-white pl-10"
                  placeholder="Repita sua senha"
                  minLength={6}
                  required
                />
                <Lock size={16} className="absolute left-3 top-3 text-zinc-500" />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gold hover:bg-gold/90 text-black font-bold h-12 mt-4 shadow-lg shadow-gold/10"
              disabled={pageState === "SUBMITTING"}
            >
              {pageState === "SUBMITTING" ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando seu acesso...
                </span>
              ) : (
                "ATIVAR MEU ACESSO"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-xs text-zinc-500 text-center">
          Ao ativar, você confirma seu vínculo com este estabelecimento.
        </CardFooter>
      </Card>
    </div>
  );
}
