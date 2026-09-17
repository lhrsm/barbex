import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { validateInvitationToken, acceptTeamInvitation } from "@/lib/backend/edge/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BarbexLogo } from "@/components/ui/barbex-logo";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Mail, AlertCircle, Lock } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    title: "Aceitar Convite de Equipe | Barbex",
    meta: [
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
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
        const result = await validateInvitationToken({ token: token.trim() });
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
      } catch {
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
      await acceptTeamInvitation({ token: token.trim(), password });
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
          <CardDescription className="text-zinc-400 text-base mt-2">
            Você foi convidado para fazer parte da equipe de <strong className="text-gold">{invitation?.barbershopName}</strong> como <strong className="text-white">{formattedRole}</strong>.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleAccept}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs">E-mail associado ao convite</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  value={invitation?.email || ""}
                  disabled
                  className="bg-black/40 border-zinc-800 text-zinc-400 pl-9 font-mono text-sm cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs font-medium">Defina sua senha de acesso</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="bg-black/20 border-zinc-800 text-white pl-9 focus:border-gold/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs font-medium">Confirme sua senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita sua senha"
                  required
                  className="bg-black/20 border-zinc-800 text-white pl-9 focus:border-gold/50"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button 
              type="submit" 
              disabled={pageState === "SUBMITTING"}
              className="w-full bg-gold text-black font-bold hover:bg-gold/90 h-11"
            >
              {pageState === "SUBMITTING" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ativando sua conta...
                </>
              ) : (
                "Concluir Cadastro e Ativar Acesso"
              )}
            </Button>
            <p className="text-[11px] text-zinc-500 text-center">
              Ao continuar, você concorda com as diretrizes de acesso e políticas do estabelecimento.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
