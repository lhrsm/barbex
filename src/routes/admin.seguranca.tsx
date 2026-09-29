import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/admin/seguranca")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/audit" });
  },
  component: AdminSegurancaRedirect,
  head: () => ({
    title: "Segurança (Redirecionamento) | Barbex Super Admin",
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function AdminSegurancaRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/admin/audit", replace: true });
  }, [navigate]);

  return (
    <div className="max-w-xl mx-auto py-12 p-4">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Redirecionando para Auditoria & Segurança...
          </CardTitle>
          <CardDescription>
            A rota órfã /admin/seguranca foi descontinuada e consolidada em /admin/audit (R2E.13F).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="default" className="gap-2">
            <Link to="/admin/audit">
              Acessar Auditoria
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
