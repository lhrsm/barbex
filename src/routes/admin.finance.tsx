import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { classifyTenant } from "@/lib/commercial-classification";
import {
  TrendingUp,
  DollarSign,
  Store,
  Layers,
  AlertTriangle,
  Receipt,
  Download,
  ShieldCheck,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/finance")({
  component: AdminFinance,
  head: () => ({
    title: "Financeiro & Receita | Barbex Super Admin",
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

interface PlanItem {
  id: string;
  name: string;
  slug: string | null;
  price_monthly: number;
}

interface TenantFinanceInfo {
  id: string;
  name: string;
  assignedPlanName: string | null;
  profilePlanName: string | null;
  isDivergent: boolean;
  effectivePlanName: string;
  monthlyEstimate: number;
}

interface BarbershopDbRow {
  id: string;
  name: string;
  slug: string;
  plan_id: string | null;
  owner_id: string | null;
  created_at: string;
}

interface ProfileDbRow {
  id: string;
  plan: string | null;
  trial_start: string | null;
  trial_end: string | null;
  is_internal_test_tenant: boolean | null;
}

interface SubscriptionDbRow {
  id: string;
  price_id: string | null;
  status: string;
  is_internal_test_tenant: boolean | null;
}

interface AppointmentDbRow {
  id: string;
  final_amount: number | null;
  status: string;
  created_at: string;
  tenant_id: string | null;
}

interface TransactionDbRow {
  id: string;
  amount: number | null;
  status: string | null;
  created_at: string;
}

function AdminFinance() {
  const queryClient = useQueryClient();

  const { data: financeStats, isLoading } = useQuery({
    queryKey: ["admin-finance-canonical"],
    queryFn: async () => {
      // 1. Fetch Planos Canônicos, Barbearias, Perfis e Assinaturas
      const [
        { data: plans },
        { data: barbershops },
        { data: profiles },
        { data: subscriptions },
        { data: appointments },
        { data: transactions },
      ] = await Promise.all([
        supabase
          .from("plans")
          .select("id, name, slug, price_monthly, stripe_price_id_live, stripe_price_id_test"),
        supabase.from("barbershops").select("id, name, slug, plan_id, owner_id, created_at"),
        supabase
          .from("profiles")
          .select("id, plan, trial_start, trial_end, is_internal_test_tenant"),
        supabase.from("subscriptions").select("id, price_id, status, is_internal_test_tenant"),
        supabase.from("appointments").select("id, final_amount, status, created_at, tenant_id"),
        supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const plansList = (plans || []) as PlanItem[];
      const planById = new Map<string, PlanItem>();
      plansList.forEach((p) => {
        planById.set(p.id, p);
        if (p.slug) planById.set(p.slug.toLowerCase(), p);
        if (p.name) planById.set(p.name.toLowerCase(), p);
      });

      const profileMap = new Map<string, ProfileDbRow>(
        ((profiles || []) as unknown as ProfileDbRow[]).map((p) => [p.id, p]),
      );

      // 2. Classificação Comercial Centralizada e MRR Contratado
      let effectiveMrr = 0;
      let commercialSubsCount = 0;
      let totalTechnicalCatalogEstimate = 0;
      const planDistribution: Record<string, { count: number; value: number }> = {};
      const tenantList: TenantFinanceInfo[] = [];
      const divergentTenants: TenantFinanceInfo[] = [];

      ((barbershops || []) as unknown as BarbershopDbRow[]).forEach((shop) => {
        const assignedPlan = shop.plan_id ? planById.get(shop.plan_id) : null;
        const ownerProf = shop.owner_id ? profileMap.get(shop.owner_id) : profileMap.get(shop.id);
        const profilePlanRaw = ownerProf?.plan ? ownerProf.plan.trim() : null;
        const profilePlan = profilePlanRaw ? planById.get(profilePlanRaw.toLowerCase()) : null;
        const shopSubs = (subscriptions || []).filter(
          (s: any) => s.barbershop_id === shop.id || s.user_id === shop.owner_id,
        );

        const classification = classifyTenant({
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
          owner_id: shop.owner_id,
          plan_id: shop.plan_id,
          created_at: shop.created_at,
          ownerProfile: ownerProf,
          assignedPlan,
          profilePlan,
          subscriptions: shopSubs,
        });

        if (classification.modality === "ASSINATURA") {
          commercialSubsCount += 1;
          effectiveMrr += classification.contractedMonthlyAmount;
        } else {
          totalTechnicalCatalogEstimate += classification.catalogNominalAmount;
        }

        const assignedPlanName = assignedPlan?.name || null;
        const profilePlanName = profilePlan?.name || profilePlanRaw || null;

        let isDivergent = false;
        if (assignedPlanName && profilePlanName) {
          isDivergent = assignedPlanName.toLowerCase() !== profilePlanName.toLowerCase();
        } else if (
          (assignedPlanName && !profilePlanName) ||
          (!assignedPlanName && profilePlanName)
        ) {
          isDivergent = true;
        }

        const catKey = classification.modality === "VOUCHER"
          ? "VOUCHER PERMANENTE"
          : classification.modality === "TRIAL"
            ? `TRIAL (${classification.technicalPlanName || "PADRÃO"})`
            : (classification.commercialPlanName || "ASSINATURA").toUpperCase();

        if (!planDistribution[catKey]) {
          planDistribution[catKey] = { count: 0, value: 0 };
        }
        planDistribution[catKey].count += 1;
        planDistribution[catKey].value += classification.catalogNominalAmount;

        const record: TenantFinanceInfo = {
          id: shop.id,
          name: shop.name,
          assignedPlanName,
          profilePlanName,
          isDivergent,
          effectivePlanName: classification.modality === "VOUCHER"
            ? "Voucher Permanente (Sem Cobrança)"
            : classification.modality === "TRIAL"
              ? `Trial ${classification.trialStatus} (Ref: ${classification.technicalPlanName})`
              : (classification.commercialPlanName || "Assinatura Ativa"),
          monthlyEstimate: classification.contractedMonthlyAmount,
        };

        tenantList.push(record);
        if (isDivergent) {
          divergentTenants.push(record);
        }
      });

      // 3. Volume Transacionado pelas Barbearias (Serviços de Clientes — Não é receita SaaS)
      const completedAppts = ((appointments || []) as unknown as AppointmentDbRow[]).filter(
        (a) => a.status === "completed",
      );
      const shopTransactedTotal = completedAppts.reduce(
        (acc: number, curr) => acc + (Number(curr.final_amount) || 0),
        0,
      );
      const shopTransactedCount = completedAppts.length;

      return {
        effectiveMrr,
        effectiveArr: effectiveMrr * 12,
        commercialSubsCount,
        tenantsCount: (barbershops || []).length,
        totalTechnicalCatalogEstimate,
        planDistribution,
        tenantList,
        divergentTenants,
        shopTransactedTotal,
        shopTransactedCount,
        recentTransactions: (transactions || []) as unknown as TransactionDbRow[],
      };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-finance-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-finance-canonical"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "barbershops" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-finance-canonical"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-finance-canonical"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-finance-canonical"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-12 pb-20">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white italic">
            RECEITA & FINANCEIRO
          </h2>
          <p className="text-gray-400 font-medium">
            Segregação de receita recorrente SaaS, planos de homologação e volume de serviços das
            barbearias.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="bg-white/5 border-white/10 text-white rounded-2xl h-12 px-6"
          >
            <Download className="mr-2 h-4 w-4" /> Exportar Dados
          </Button>
        </div>
      </div>

      {/* 4 Cards Principais com Conceitos Estritamente Segregados */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: MRR Recorrente Efetivo */}
        <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              MRR Efetivo (Stripe)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight mb-1 text-white">
              {isLoading ? "..." : fmt(financeStats?.effectiveMrr ?? 0)}
            </div>
            <div className="flex items-center gap-1.5">
              <Badge className="rounded-lg px-1.5 py-0 text-[10px] border-none font-bold bg-emerald-500/20 text-emerald-400">
                {financeStats?.commercialSubsCount ?? 0} Assinaturas Contratadas
              </Badge>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                Pré-lançamento
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: ARR Efetivo SaaS */}
        <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
              ARR Projetado Efetivo
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight mb-1 text-white">
              {isLoading ? "..." : fmt(financeStats?.effectiveArr ?? 0)}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                Baseado em faturamento Stripe real
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Planos Técnicos de Teste / Referência (Estimativa Não Faturada) */}
        <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Catálogo de Teste / Referência
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight mb-1 text-amber-400">
              {isLoading ? "..." : fmt(financeStats?.totalTechnicalCatalogEstimate ?? 0)}/mês
            </div>
            <div className="flex items-center gap-1.5">
              <Badge className="rounded-lg px-1.5 py-0 text-[10px] border-none font-bold bg-amber-500/20 text-amber-300">
                Catálogo Nominal (Testes)
              </Badge>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                Não faturado
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Volume Transacionado pelas Barbearias */}
        <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
              Volume das Barbearias
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Receipt className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight mb-1 text-white">
              {isLoading ? "..." : fmt(financeStats?.shopTransactedTotal ?? 0)}
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-help">
                    <Badge className="rounded-lg px-1.5 py-0 text-[10px] border-none font-bold bg-purple-500/20 text-purple-300">
                      {financeStats?.shopTransactedCount ?? 0} Agendamentos
                    </Badge>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                      Não é receita SaaS
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-gray-900 border-white/10 text-white max-w-xs">
                  Volume de serviços cobrados pelas barbearias de seus clientes finais. Esse
                  montante não constitui receita recorrente da plataforma Barbex.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>

      {/* Grid com Distribuição e Auditoria de Inconsistências */}
      <div className="grid gap-8 md:grid-cols-7">
        {/* Distribuição por Plano de Catálogo */}
        <Card className="md:col-span-4 glass border-white/5 rounded-2xl overflow-hidden shadow-none">
          <CardHeader className="bg-white/5 px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Store className="w-5 h-5 text-blue-400" />
                  Distribuição de Planos de Catálogo
                </CardTitle>
                <CardDescription className="text-gray-400 font-medium">
                  Planos atribuídos aos estabelecimentos em homologação (valores nominais).
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs"
              >
                {financeStats?.tenantsCount ?? 0} Barbearias
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {Object.entries(financeStats?.planDistribution || {}).map(([plan, data]) => {
              const count = data.count;
              const total = financeStats?.tenantsCount || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={plan} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-lg px-2 py-0.5 text-xs border-purple-500/30 bg-purple-500/10 text-purple-300 font-bold uppercase"
                      >
                        {plan}
                      </Badge>
                      <span className="text-sm font-bold text-white">
                        {count} {count === 1 ? "unidade" : "unidades"}
                      </span>
                      <span className="text-xs text-gray-500">· Est. {fmt(data.value)}/mês</span>
                    </div>
                    <span className="text-xs font-bold text-gray-400">{pct}%</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        plan.includes("ELITE")
                          ? "bg-gradient-to-r from-purple-500 to-pink-500"
                          : "bg-gradient-to-r from-blue-500 to-cyan-500",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Alerta de Divergências Cadastrais */}
            {financeStats?.divergentTenants && financeStats.divergentTenants.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Inconsistências Identificadas Entre Fontes de Plano (
                    {financeStats.divergentTenants.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {financeStats.divergentTenants.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1"
                    >
                      <span className="font-semibold text-white">{t.name}</span>
                      <div className="flex items-center gap-2 text-gray-400">
                        <span>
                          Barbearia:{" "}
                          <strong className="text-amber-300">
                            {t.assignedPlanName || "Nenhum"}
                          </strong>
                        </span>
                        <span>|</span>
                        <span>
                          Perfil:{" "}
                          <strong className="text-amber-300">
                            {t.profilePlanName || "Nenhum"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 italic">
                  Essas divergências foram preservadas sem alteração automática dos registros dos
                  estabelecimentos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ledger do Gateway e Volume de Agendamentos */}
        <Card className="md:col-span-3 glass border-white/5 rounded-2xl overflow-hidden shadow-none">
          <CardHeader className="bg-white/5 px-8 py-6">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Gateway & Cobranças
            </CardTitle>
            <CardDescription className="text-gray-400 font-medium">
              Histórico de liquidação de assinaturas SaaS no gateway.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {financeStats?.recentTransactions?.map((t: TransactionDbRow) => (
                  <TableRow
                    key={t.id}
                    className="border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <TableCell className="py-4 pl-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <DollarSign className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{fmt(t.amount || 0)}</span>
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                            {t.status || "Liquidado"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Badge className="bg-white/5 border-white/10 text-gray-400 text-[9px] uppercase font-bold">
                        {t.status || "Success"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!financeStats?.recentTransactions ||
                  financeStats.recentTransactions.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-12 px-6">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShieldCheck className="w-8 h-8 text-emerald-500/40 mb-1" />
                        <span className="text-sm font-semibold text-white">
                          Nenhuma transação Stripe registrada
                        </span>
                        <p className="text-xs text-gray-400 max-w-xs">
                          Plataforma em pré-lançamento comercial. Nenhum faturamento de assinatura
                          SaaS liquidado até o momento.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
