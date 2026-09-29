import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  ShieldAlert,
  Server,
  Database,
  ArrowUpRight,
  ExternalLink,
  Layers,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/billing")({
  component: AdminBillingObservability,
  head: () => ({
    title: "Billing Observability | Barbex Super Admin",
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

interface SubscriptionRecord {
  id: string;
  user_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  product_id: string | null;
  price_id: string | null;
  status: string;
  billing_cycle: string | null;
  plan_key: string | null;
  latest_event_timestamp: string | null;
  environment: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  created_at: string;
  updated_at: string;
}

interface PlanRecord {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number | null;
  stripe_price_id_monthly_test: string | null;
  stripe_price_id_monthly_live: string | null;
  stripe_price_id_yearly_test: string | null;
  stripe_price_id_yearly_live: string | null;
  stripe_product_id_test: string | null;
  stripe_product_id_live: string | null;
  tier: number | null;
}

const ATTENTION_STATUSES = ["past_due", "unpaid", "incomplete"];

export default function AdminBillingObservability() {
  const [searchTerm, setSearchTerm] = useState("");
  const [envFilter, setEnvFilter] = useState<"all" | "live" | "test">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Query 1: Subscriptions Query
  const {
    data: subscriptions,
    isLoading: isLoadingSubs,
    isError: isErrorSubs,
    error: subsError,
    refetch: refetchSubs,
  } = useQuery({
    queryKey: ["admin_canonical_subscriptions"],
    queryFn: async (): Promise<SubscriptionRecord[]> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "id, user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id, status, billing_cycle, plan_key, latest_event_timestamp, environment, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }
      return (data as SubscriptionRecord[]) || [];
    },
  });

  // Query 2: Plans Catalog Query
  const {
    data: plans,
    isLoading: isLoadingPlans,
    isError: isErrorPlans,
    error: plansError,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ["admin_canonical_plans_catalog"],
    queryFn: async (): Promise<PlanRecord[]> => {
      const { data, error } = await supabase
        .from("plans")
        .select(
          "id, name, price_monthly, price_yearly, stripe_price_id_monthly_test, stripe_price_id_monthly_live, stripe_price_id_yearly_test, stripe_price_id_yearly_live, stripe_product_id_test, stripe_product_id_live, tier",
        )
        .order("tier", { ascending: true });

      if (error) {
        throw error;
      }
      return (data as PlanRecord[]) || [];
    },
  });

  // Derived Factual Metrics (Only when subscriptions query succeeds)
  const totalCount = subscriptions ? subscriptions.length : null;
  const activeCount = subscriptions
    ? subscriptions.filter((s) => s.status === "active").length
    : null;
  const trialingCount = subscriptions
    ? subscriptions.filter((s) => s.status === "trialing").length
    : null;
  const pastDueCount = subscriptions
    ? subscriptions.filter((s) => s.status === "past_due").length
    : null;
  const attentionCount = subscriptions
    ? subscriptions.filter((s) => ATTENTION_STATUSES.includes(s.status)).length
    : null;

  // Environment Breakdown
  const liveCount = subscriptions
    ? subscriptions.filter((s) => s.environment === "live").length
    : null;
  const testCount = subscriptions
    ? subscriptions.filter((s) => s.environment === "test" || !s.environment).length
    : null;

  // Plan Key Breakdown
  const planDistribution = subscriptions
    ? subscriptions.reduce<Record<string, number>>((acc, sub) => {
        const key = sub.plan_key || "sem_plan_key";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    : {};

  // Billing Cycle Breakdown
  const cycleDistribution = subscriptions
    ? subscriptions.reduce<Record<string, number>>((acc, sub) => {
        const cycle = sub.billing_cycle || "sem_ciclo";
        acc[cycle] = (acc[cycle] || 0) + 1;
        return acc;
      }, {})
    : {};

  // Attention-Required Subscriptions
  const attentionRecords = subscriptions
    ? subscriptions.filter((s) => ATTENTION_STATUSES.includes(s.status))
    : [];

  // Filtered Subscriptions
  const filteredSubscriptions = (subscriptions || []).filter((sub) => {
    if (envFilter !== "all") {
      const subEnv = sub.environment || "test";
      if (subEnv !== envFilter) return false;
    }
    if (statusFilter !== "all" && sub.status !== statusFilter) {
      return false;
    }
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      const matchId = sub.id.toLowerCase().includes(term);
      const matchSubId = (sub.stripe_subscription_id || "").toLowerCase().includes(term);
      const matchCustId = (sub.stripe_customer_id || "").toLowerCase().includes(term);
      const matchPlan = (sub.plan_key || "").toLowerCase().includes(term);
      if (!matchId && !matchSubId && !matchCustId && !matchPlan) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Billing Observability
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary">
              R2E.13E Read-Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Painel operacional forense de assinaturas canônicas e integridade do catálogo Stripe no
            Barbex.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSubs();
              refetchPlans();
            }}
            className="gap-2"
          >
            <RefreshCw
              className={cn("h-4 w-4", (isLoadingSubs || isLoadingPlans) && "animate-spin")}
            />
            Atualizar Dados
          </Button>
          <Button variant="default" size="sm" asChild>
            <Link to="/admin/subscriptions">
              <ExternalLink className="h-4 w-4 mr-2" />
              Gestão de Assinaturas
            </Link>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Canonical Rows */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total de Assinaturas</CardDescription>
            <CardTitle className="text-2xl font-bold">
              {isLoadingSubs ? (
                <span className="text-muted-foreground text-lg">Carregando...</span>
              ) : isErrorSubs ? (
                <span className="text-destructive text-lg font-semibold">Indisponível</span>
              ) : (
                totalCount
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Registros na tabela <code className="text-foreground">public.subscriptions</code>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Ativas (Active)
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {isLoadingSubs ? (
                <span className="text-muted-foreground text-lg">...</span>
              ) : isErrorSubs ? (
                <span className="text-destructive text-lg font-semibold">Indisponível</span>
              ) : (
                activeCount
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Status <span className="font-mono">active</span> confirmado
          </CardContent>
        </Card>

        {/* Trialing */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Em Trial (Trialing)
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {isLoadingSubs ? (
                <span className="text-muted-foreground text-lg">...</span>
              ) : isErrorSubs ? (
                <span className="text-destructive text-lg font-semibold">Indisponível</span>
              ) : (
                trialingCount
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Período de teste Stripe ativo
          </CardContent>
        </Card>

        {/* Past Due */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Atrasadas (Past Due)
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {isLoadingSubs ? (
                <span className="text-muted-foreground text-lg">...</span>
              ) : isErrorSubs ? (
                <span className="text-destructive text-lg font-semibold">Indisponível</span>
              ) : (
                pastDueCount
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Cobrança em atraso/recusada
          </CardContent>
        </Card>

        {/* Attention Required */}
        <Card
          className={cn(
            "border-border/60",
            (attentionCount || 0) > 0 && "border-amber-500/50 bg-amber-500/5",
          )}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" /> Requer Atenção
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {isLoadingSubs ? (
                <span className="text-muted-foreground text-lg">...</span>
              ) : isErrorSubs ? (
                <span className="text-destructive text-lg font-semibold">Indisponível</span>
              ) : (
                attentionCount
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Status: past_due, unpaid ou incomplete
          </CardContent>
        </Card>
      </div>

      {/* Revenue Authority Section (Strict Rule: Zero is not displayed as synthetic revenue) */}
      <Card className="border-border/60 bg-muted/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Receita Recorrente & Autoridade Financeira
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Conformidade estrita com a Regra de Veracidade Absoluta (R2E.13E Seções 3, 10 e 11)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/40"
              >
                MRR_AUTHORITY: INSUFFICIENT
              </Badge>
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/40"
              >
                ARR_AUTHORITY: INSUFFICIENT
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-background/60 space-y-1">
              <div className="text-xs text-muted-foreground font-medium">
                MRR (Monthly Recurring Revenue)
              </div>
              <div className="text-xl font-bold text-muted-foreground">Dados indisponíveis</div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                Os registros atuais não permitem afirmar receita recorrente financeira com
                segurança. Existem 0 assinaturas canônicas Live faturadas no banco de dados.
                Transações de comanda/PDV (
                <code className="text-foreground">public.transactions</code>) pertencem às
                barbearias e não constituem receita de assinatura Barbex SaaS.
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-background/60 space-y-1">
              <div className="text-xs text-muted-foreground font-medium">ARR (Annual Run Rate)</div>
              <div className="text-xl font-bold text-muted-foreground">Dados indisponíveis</div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                ARR deriva estritamente de um MRR contratado e auditável. Não é permitida a projeção
                sintética (MRR × 12) enquanto a base de assinaturas ativas em ambiente Live for zero
                ou a validação de fluxo financeiro estiver pendente.
              </p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-2 p-2 rounded bg-background/40 border border-border/40">
            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>
              <strong>Política de Não-Fabricação de Métricas:</strong> Valores zero de receita ou
              porcentagens hipotéticas (0,00%, R$ 0,00) são omitidos para evitar confusão entre
              ausência de dados auditados e medição financeira real.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Distribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Plan */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Distribuição por Plano
            </CardTitle>
            <CardDescription className="text-xs">
              Segmentação pelo campo <code className="text-foreground">plan_key</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSubs ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Carregando planos...
              </div>
            ) : isErrorSubs ? (
              <div className="py-6 text-center text-xs text-destructive">Dados indisponíveis</div>
            ) : Object.keys(planDistribution).length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Nenhuma assinatura registrada
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(planDistribution).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between text-xs">
                    <span className="capitalize font-medium text-foreground">{plan}</span>
                    <Badge variant="secondary" className="font-mono">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Billing Cycle */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Ciclo de Cobrança
            </CardTitle>
            <CardDescription className="text-xs">
              Segmentação pelo campo <code className="text-foreground">billing_cycle</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSubs ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Carregando ciclos...
              </div>
            ) : isErrorSubs ? (
              <div className="py-6 text-center text-xs text-destructive">Dados indisponíveis</div>
            ) : Object.keys(cycleDistribution).length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Nenhuma assinatura registrada
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(cycleDistribution).map(([cycle, count]) => (
                  <div key={cycle} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {cycle === "month"
                        ? "Mensal (month)"
                        : cycle === "year"
                          ? "Anual (year)"
                          : cycle}
                    </span>
                    <Badge variant="secondary" className="font-mono">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Environment */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              Ambiente Stripe
            </CardTitle>
            <CardDescription className="text-xs">
              Separação estrita entre Test e Live
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSubs ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Carregando ambientes...
              </div>
            ) : isErrorSubs ? (
              <div className="py-6 text-center text-xs text-destructive">Dados indisponíveis</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                      Live
                    </Badge>
                    <span className="text-muted-foreground">Produção real</span>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {liveCount ?? 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                      Test
                    </Badge>
                    <span className="text-muted-foreground">Sandbox de testes</span>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {testCount ?? 0}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attention Required Records */}
      {attentionRecords.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Assinaturas Requerendo Atenção Operacional ({attentionRecords.length})
            </CardTitle>
            <CardDescription className="text-xs text-amber-700/80 dark:text-amber-400">
              Registros canônicos com inadimplência, faturamento pendente ou problemas de cobrança
              (BILLING_ATTENTION_RULE: status IN ('past_due', 'unpaid', 'incomplete'))
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ID Assinatura DB</TableHead>
                  <TableHead className="text-xs">Stripe Subscription ID</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Plano</TableHead>
                  <TableHead className="text-xs">Ambiente</TableHead>
                  <TableHead className="text-xs">Último Evento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attentionRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-xs">{record.id.slice(0, 8)}...</TableCell>
                    <TableCell className="font-mono text-xs">
                      {record.stripe_subscription_id || "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-[10px] uppercase">
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{record.plan_key || "Não definido"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {record.environment || "test"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {record.latest_event_timestamp
                        ? format(new Date(record.latest_event_timestamp), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Catalog Observability (Database Mapping Only) */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Mapeamento do Catálogo no Banco de Dados (Database Mapping Only)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Observabilidade estrita dos registros de preços e produtos em{" "}
                <code className="text-foreground">public.plans</code>. Não constitui verificação
                direta via API Stripe (CATALOG_STRIPE_API_VERIFIED = FALSE).
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              R2E.12B Canonical Catalog
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPlans ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Carregando catálogo de planos...
            </div>
          ) : isErrorPlans ? (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Falha ao consultar tabela public.plans
              </div>
              <p className="font-mono">
                {plansError instanceof Error ? plansError.message : "Erro desconhecido"}
              </p>
            </div>
          ) : plans && plans.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Plano</TableHead>
                    <TableHead className="text-xs">Preço Mensal (BRL)</TableHead>
                    <TableHead className="text-xs">Preço Anual (BRL)</TableHead>
                    <TableHead className="text-xs">Price ID Mensal (Test / Live)</TableHead>
                    <TableHead className="text-xs">Price ID Anual (Test / Live)</TableHead>
                    <TableHead className="text-xs">Product ID (Test / Live)</TableHead>
                    <TableHead className="text-xs">Status Mapeamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((p) => {
                    const hasMonthlyTest = Boolean(p.stripe_price_id_monthly_test);
                    const hasMonthlyLive = Boolean(p.stripe_price_id_monthly_live);
                    const hasYearlyTest = Boolean(p.stripe_price_id_yearly_test);
                    const hasYearlyLive = Boolean(p.stripe_price_id_yearly_live);
                    const isFullyMapped =
                      hasMonthlyTest && hasMonthlyLive && hasYearlyTest && hasYearlyLive;

                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-xs text-foreground">
                          {p.name}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(p.price_monthly)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.price_yearly
                            ? new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(p.price_yearly)
                            : "Não configurado"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-muted-foreground">
                              Test: {p.stripe_price_id_monthly_test || "—"}
                            </div>
                            <div className="text-[11px] text-foreground font-medium">
                              Live: {p.stripe_price_id_monthly_live || "—"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-muted-foreground">
                              Test: {p.stripe_price_id_yearly_test || "—"}
                            </div>
                            <div className="text-[11px] text-foreground font-medium">
                              Live: {p.stripe_price_id_yearly_live || "—"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-muted-foreground">
                              Test: {p.stripe_product_id_test || "—"}
                            </div>
                            <div className="text-[11px] text-foreground font-medium">
                              Live: {p.stripe_product_id_live || "—"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isFullyMapped ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                            >
                              Completo (DB)
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]"
                            >
                              Parcial
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Nenhum plano configurado na tabela public.plans.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canonical Subscriptions Operational List */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Registros Canônicos de Assinaturas
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Visualização detalhada somente-leitura dos registros em{" "}
                <code className="text-foreground">public.subscriptions</code>
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por ID, plano..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <select
                value={envFilter}
                onChange={(e) => setEnvFilter(e.target.value as "all" | "live" | "test")}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">Ambiente: Todos</option>
                <option value="live">Somente Live</option>
                <option value="test">Somente Test</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">Status: Todos</option>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past Due</option>
                <option value="canceled">Canceled</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingSubs ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Carregando registros de assinatura...
            </div>
          ) : isErrorSubs ? (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Falha ao consultar tabela public.subscriptions
              </div>
              <p className="font-mono">
                {subsError instanceof Error ? subsError.message : "Erro desconhecido"}
              </p>
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="text-sm font-medium text-foreground">
                {subscriptions && subscriptions.length === 0
                  ? "Nenhum registro de assinatura canônica no banco de dados."
                  : "Nenhum registro corresponde aos filtros selecionados."}
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {subscriptions && subscriptions.length === 0
                  ? "A validação financeira Live foi postergada pelo operador. Nenhuma assinatura foi materializada até o momento."
                  : "Ajuste os filtros de busca ou ambiente para visualizar outros registros."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">ID Registro</TableHead>
                    <TableHead className="text-xs">Stripe Sub ID</TableHead>
                    <TableHead className="text-xs">Plano</TableHead>
                    <TableHead className="text-xs">Ciclo</TableHead>
                    <TableHead className="text-xs">Ambiente</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Fim do Período</TableHead>
                    <TableHead className="text-xs">Último Evento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-mono text-xs">
                        <span title={sub.id}>{sub.id.slice(0, 8)}...</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {sub.stripe_subscription_id ? (
                          <span title={sub.stripe_subscription_id}>
                            {sub.stripe_subscription_id.slice(0, 14)}...
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs capitalize font-medium">
                        {sub.plan_key || "Não informado"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {sub.billing_cycle === "year" ? "Anual" : "Mensal"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            sub.environment === "live"
                              ? "text-emerald-600 border-emerald-500/30"
                              : "text-amber-600 border-amber-500/30",
                          )}
                        >
                          {sub.environment || "test"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            sub.status === "active"
                              ? "default"
                              : ATTENTION_STATUSES.includes(sub.status)
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-[10px] uppercase font-mono"
                        >
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {sub.current_period_end
                          ? format(new Date(sub.current_period_end), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {sub.latest_event_timestamp
                          ? format(new Date(sub.latest_event_timestamp), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
