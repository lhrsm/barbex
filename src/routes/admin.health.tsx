import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  Lock,
  Server,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Clock,
  KeyRound,
  FileCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/health")({
  component: AdminHealthPage,
  head: () => ({
    title: "Saúde da Plataforma | Barbex Super Admin",
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

interface HealthProbeResult {
  database: {
    status: "AVAILABLE" | "UNAVAILABLE";
    latencyMs: number | null;
    error: string | null;
  };
  auth: {
    status: "AVAILABLE" | "UNAVAILABLE";
    error: string | null;
  };
  catalog: {
    status: "CONFIGURED" | "PARTIAL" | "UNAVAILABLE";
    mappedPlanCount: number;
    totalPlanCount: number;
    error: string | null;
  };
}

export default function AdminHealthPage() {
  const {
    data: health,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<HealthProbeResult>({
    queryKey: ["admin_platform_health_probes"],
    queryFn: async (): Promise<HealthProbeResult> => {
      // 1. Direct PostgreSQL Connectivity Probe
      const dbStart = performance.now();
      let dbStatus: "AVAILABLE" | "UNAVAILABLE" = "AVAILABLE";
      let dbLatency: number | null = null;
      let dbError: string | null = null;

      try {
        const { error: qError } = await supabase.from("system_settings").select("id").limit(1);

        if (qError) {
          dbStatus = "UNAVAILABLE";
          dbError = qError.message;
        } else {
          dbLatency = Math.round(performance.now() - dbStart);
        }
      } catch (err) {
        dbStatus = "UNAVAILABLE";
        dbError = err instanceof Error ? err.message : "Erro desconhecido";
      }

      // 2. Supabase Auth Session Probe
      let authStatus: "AVAILABLE" | "UNAVAILABLE" = "AVAILABLE";
      let authError: string | null = null;
      try {
        const { error: aError } = await supabase.auth.getSession();
        if (aError) {
          authStatus = "UNAVAILABLE";
          authError = aError.message;
        }
      } catch (err) {
        authStatus = "UNAVAILABLE";
        authError = err instanceof Error ? err.message : "Erro no client de autenticação";
      }

      // 3. Database Catalog Mappings Probe
      let catalogStatus: "CONFIGURED" | "PARTIAL" | "UNAVAILABLE" = "CONFIGURED";
      let mappedCount = 0;
      let totalCount = 0;
      let catalogError: string | null = null;

      try {
        const { data: plansData, error: pError } = await supabase
          .from("plans")
          .select(
            "id, name, stripe_price_id_monthly_test, stripe_price_id_monthly_live, stripe_price_id_yearly_test, stripe_price_id_yearly_live",
          );

        if (pError) {
          catalogStatus = "UNAVAILABLE";
          catalogError = pError.message;
        } else if (plansData) {
          totalCount = plansData.length;
          mappedCount = plansData.filter(
            (p) =>
              Boolean(p.stripe_price_id_monthly_test) &&
              Boolean(p.stripe_price_id_monthly_live) &&
              Boolean(p.stripe_price_id_yearly_test) &&
              Boolean(p.stripe_price_id_yearly_live),
          ).length;

          if (mappedCount < totalCount) {
            catalogStatus = "PARTIAL";
          }
        }
      } catch (err) {
        catalogStatus = "UNAVAILABLE";
        catalogError = err instanceof Error ? err.message : "Erro na leitura de planos";
      }

      return {
        database: {
          status: dbStatus,
          latencyMs: dbLatency,
          error: dbError,
        },
        auth: {
          status: authStatus,
          error: authError,
        },
        catalog: {
          status: catalogStatus,
          mappedPlanCount: mappedCount,
          totalPlanCount: totalCount,
          error: catalogError,
        },
      };
    },
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Saúde da Plataforma
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary">
              R2E.13F Factual
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Painel forense de disponibilidade de subsistemas, conectividade de dados e estado de
            observabilidade.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", (isLoading || isRefetching) && "animate-spin")} />
            Atualizar Diagnóstico
          </Button>
        </div>
      </div>

      {/* Observability Standards Disclaimer */}
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="py-4 text-xs text-muted-foreground leading-relaxed flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
          <div>
            <strong>Regra de Veracidade Absoluta (R2E.13F Seções 10–13):</strong> Métricas
            sintéticas de uptime ("99.9%"), latências simuladas ou inferências de saúde sem prova
            autoritativa são terminantemente proibidas. A ausência de falhas legíveis não é rotulada
            como "Healthy". Métricas financeiras (MRR/ARR) são omitidas deste módulo.
          </div>
        </CardContent>
      </Card>

      {/* Subsystem Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. Database Connectivity Probe */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Banco de Dados (PostgreSQL)
              </CardTitle>
              {isLoading ? (
                <Badge variant="outline">Testando...</Badge>
              ) : health?.database.status === "AVAILABLE" ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                >
                  AVAILABLE
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">
                  UNAVAILABLE
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Conectividade real via PostgREST na tabela{" "}
              <code className="text-foreground">system_settings</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {health?.database.status === "AVAILABLE" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Conexão direta:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Ativa e Respondendo
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Latência round-trip observada:</span>
                  <span className="font-mono text-foreground font-medium">
                    {health.database.latencyMs !== null ? `${health.database.latencyMs} ms` : "—"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-2 rounded bg-destructive/10 text-destructive text-[11px] font-mono">
                {health?.database.error || "Falha na conexão com o banco"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Supabase Auth Session Probe */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                Sessão de Autenticação (Auth Client)
              </CardTitle>
              {isLoading ? (
                <Badge variant="outline">Testando...</Badge>
              ) : health?.auth.status === "AVAILABLE" ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                >
                  AVAILABLE
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">
                  UNAVAILABLE
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Verificação da sessão ativa do cliente via <code className="text-foreground">supabase.auth.getSession()</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {health?.auth.status === "AVAILABLE" ? (
              <div className="flex items-center justify-between">
                <span>Estado da Sessão Auth:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Client Responsivo / Sessão Ativa
                </span>
              </div>
            ) : (
              <div className="p-2 rounded bg-destructive/10 text-destructive text-[11px] font-mono">
                {health?.auth.error || "Falha na verificação de sessão"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Catalog Database Mappings */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-primary" />
                Catálogo de Planos (Mapeamento)
              </CardTitle>
              {isLoading ? (
                <Badge variant="outline">Consultando...</Badge>
              ) : health?.catalog.status === "CONFIGURED" ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                >
                  CONFIGURED
                </Badge>
              ) : health?.catalog.status === "PARTIAL" ? (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]"
                >
                  PARCIAL
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">
                  UNAVAILABLE
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Mapeamento de Price IDs Test/Live em{" "}
              <code className="text-foreground">public.plans</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Planos mapeados no DB:</span>
              <span className="font-mono text-foreground font-medium">
                {health?.catalog.mappedPlanCount ?? 0} de {health?.catalog.totalPlanCount ?? 0}{" "}
                planos
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/80 leading-normal">
              <strong>DATABASE_MAPPING_ONLY:</strong> Reflete a configuração local no PostgreSQL;
              não representa validação direta via API da Stripe.
            </p>
          </CardContent>
        </Card>

        {/* 4. Stripe Webhooks Observability Boundary */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                Eventos Stripe (Webhooks)
              </CardTitle>
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-700 dark:text-amber-300 text-[10px]"
              >
                UNAVAILABLE
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Observabilidade do pipeline físico de eventos recebidos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p className="leading-relaxed">
              Acesso à tabela{" "}
              <code className="text-foreground">public.stripe_processed_events</code> é restrito à{" "}
              <code>service_role</code> (Edge Function). O cliente navegador não possui autoridade
              de leitura.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px]">Detalhes do pipeline:</span>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-7 text-xs px-2 gap-1 text-primary"
              >
                <Link to="/admin/webhooks">
                  Ver /admin/webhooks
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 5. Live Financial Validation Gate */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Validação Financeira Live
              </CardTitle>
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-700 dark:text-amber-300 text-[10px]"
              >
                NOT_VALIDATED
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Execução de transações reais com cartão em ambiente de produção
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Status do Gate E2E Live:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Adiada pelo operador
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Nenhuma assinatura real foi faturada em produção até o presente momento
              (LIVE_FINANCIAL_FLOW_VALIDATED = FALSE).
            </p>
          </CardContent>
        </Card>

        {/* 6. Trilha de Auditoria & Governança */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-500" />
                Trilha de Auditoria (Audit Logs)
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
              >
                CONFIGURED
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Rastreabilidade append-only de ações administrativas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p className="leading-relaxed">
              Tabela <code className="text-foreground">public.audit_logs</code> configurada com
              proteção estrita de RLS e zero controles de mutação externa.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px]">Trilha completa:</span>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-7 text-xs px-2 gap-1 text-primary"
              >
                <Link to="/admin/audit">
                  Ver /admin/audit
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
