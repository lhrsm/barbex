import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { classifyTenant, CommercialClassification } from "@/lib/commercial-classification";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Download,
  Filter,
  Calendar,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  PieChart,
  Activity,
  Layers,
  Store
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
  head: () => ({
    title: "Relatórios Enterprise | Barbex Super Admin",
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Relatórios e métricas canônicas de receita e assinaturas da plataforma." },
    ],
  }),
});

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(v) ? v : 0
  );

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

interface PlanDbRow {
  id: string;
  slug: string | null;
  name: string;
  price_monthly: number;
}

interface SubscriptionDbRow {
  id: string;
  user_id: string;
  price_id: string | null;
  status: string;
  is_internal_test_tenant: boolean | null;
  current_period_end: string | null;
  created_at?: string;
}

interface TransactionDbRow {
  id: string;
  amount: number | null;
  status: string | null;
  created_at: string;
}

function AdminReports() {
  const [periodDays, setPeriodDays] = useState<number>(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-reports-canonical", periodDays],
    queryFn: async () => {
      const [
        { data: plans, error: plErr },
        { data: barbershops, error: bErr },
        { data: profiles, error: pErr },
        { data: subscriptions, error: sErr },
      ] = await Promise.all([
        supabase.from("plans").select("id, slug, name, price_monthly"),
        supabase.from("barbershops").select("id, name, slug, plan_id, owner_id, created_at"),
        supabase
          .from("profiles")
          .select("id, plan, trial_start, trial_end, is_internal_test_tenant"),
        supabase
          .from("subscriptions")
          .select("id, user_id, price_id, status, is_internal_test_tenant, current_period_end, created_at"),
      ]);

      if (bErr) throw new Error("Erro ao carregar barbearias: " + bErr.message);
      if (sErr) throw new Error("Erro ao carregar assinaturas: " + sErr.message);
      if (plErr) console.warn("Aviso ao carregar planos:", plErr);
      if (pErr) console.warn("Aviso ao carregar perfis:", pErr);

      const plansMap = new Map<string, PlanDbRow>();
      ((plans || []) as unknown as PlanDbRow[]).forEach((p) => {
        plansMap.set(p.id, p);
        if (p.slug) plansMap.set(p.slug.toLowerCase(), p);
        if (p.name) plansMap.set(p.name.toLowerCase(), p);
      });

      const profilesMap = new Map<string, ProfileDbRow>(
        ((profiles || []) as unknown as ProfileDbRow[]).map((p) => [p.id, p])
      );

      const shopsList = (barbershops || []) as unknown as BarbershopDbRow[];
      const subsList = (subscriptions || []) as unknown as SubscriptionDbRow[];

      // Classificação Comercial Centralizada (R2E.9 / R2E.9.1)
      let effectiveMrr = 0;
      let commercialSubsCount = 0;
      let totalVouchers = 0;
      let totalTrials = 0;
      let totalCatalogPotential = 0;

      const tenantClassifications: CommercialClassification[] = [];

      shopsList.forEach((shop) => {
        const ownerProf = shop.owner_id ? profilesMap.get(shop.owner_id) : profilesMap.get(shop.id);
        const assignedPlan = shop.plan_id ? plansMap.get(shop.plan_id) : null;
        const profilePlan = ownerProf?.plan ? plansMap.get(ownerProf.plan.toLowerCase()) : null;
        const shopSubs = subsList.filter(
          (s) => s.user_id === shop.owner_id || s.user_id === shop.id
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

        tenantClassifications.push(classification);

        if (classification.modality === "ASSINATURA") {
          commercialSubsCount += 1;
          effectiveMrr += classification.contractedMonthlyAmount;
        } else if (classification.modality === "VOUCHER") {
          totalVouchers += 1;
          totalCatalogPotential += classification.catalogNominalAmount;
        } else if (classification.modality === "TRIAL") {
          totalTrials += 1;
          totalCatalogPotential += classification.catalogNominalAmount;
        }
      });

      const averageTicket = commercialSubsCount > 0 ? effectiveMrr / commercialSubsCount : 0;

      return {
        effectiveMrr,
        commercialSubsCount,
        averageTicket,
        totalShops: shopsList.length,
        totalVouchers,
        totalTrials,
        totalCatalogPotential,
        tenantClassifications,
      };
    },
    staleTime: 60_000,
  });

  const exportCsv = () => {
    if (!data || !data.tenantClassifications.length) {
      toast.error("Nenhum dado disponível para exportação.");
      return;
    }

    const headers = [
      "ID Barbearia",
      "Nome",
      "Slug",
      "Modalidade",
      "Status Trial",
      "Plano Comercial",
      "Plano Técnico",
      "MRR Contratado (R$)",
      "Valor Nominal Catálogo (R$)",
      "Voucher Permanente"
    ];

    const rows = data.tenantClassifications.map((t) => [
      `"${t.tenantId}"`,
      `"${t.tenantName.replace(/"/g, '""')}"`,
      `"${t.slug}"`,
      `"${t.modality}"`,
      `"${t.trialStatus}"`,
      `"${t.commercialPlanName || "—"}"`,
      `"${t.technicalPlanName || "—"}"`,
      t.contractedMonthlyAmount.toFixed(2),
      t.catalogNominalAmount.toFixed(2),
      t.isPermanentVoucher ? "Sim" : "Não"
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `barbex_relatorio_comercial_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Relatório comercial exportado com sucesso.");
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
            Relatórios Enterprise
          </h1>
          <p className="text-gray-400 font-medium text-sm mt-1">
            Visão consolidada de receita, assinaturas contratuais e saúde comercial da plataforma.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white text-xs font-bold uppercase tracking-wider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={exportCsv}
            disabled={isLoading || !data}
            className="h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2 text-xs font-bold uppercase tracking-widest italic shadow-[0_0_20px_rgba(168,85,247,0.3)]"
          >
            <Download size={15} /> Exportar CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto" />
          <p className="text-gray-500 font-black italic uppercase tracking-widest text-xs">
            Consolidando dados canônicos...
          </p>
        </div>
      ) : error ? (
        <Card className="border-rose-500/20 bg-rose-500/5 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white uppercase italic">Erro ao Carregar Relatórios</h3>
          <p className="text-gray-400 text-sm mt-1">{(error as Error).message}</p>
        </Card>
      ) : data ? (
        <>
          {/* KPI Cards Reais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Card 1: MRR Contratado */}
            <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] uppercase font-bold">
                    Contratado
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                    MRR Comercial
                  </p>
                  <h3 className="text-2xl font-black text-white italic tracking-tighter">
                    {brl(data.effectiveMrr)}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Exclui trials e vouchers
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Assinaturas Comerciais Pagas */}
            <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] uppercase font-bold">
                    Ativas
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                    Assinaturas Pagas
                  </p>
                  <h3 className="text-2xl font-black text-white italic tracking-tighter">
                    {data.commercialSubsCount}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-1">
                    De {data.totalShops} cadastradas
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Receita Recebida da Plataforma */}
            <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2.5 rounded-2xl bg-slate-500/10 text-slate-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-[10px] uppercase font-bold">
                    Transacional
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                    Receita Recebida
                  </p>
                  <h3 className="text-lg font-black text-white/90 italic tracking-tight">
                    Dados indisponíveis
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Fonte SaaS pendente
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Ticket Médio Contratado */}
            <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] uppercase font-bold">
                    Média / Sub
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                    Ticket Médio
                  </p>
                  <h3 className="text-2xl font-black text-white italic tracking-tighter">
                    {data.commercialSubsCount > 0 ? brl(data.averageTicket) : "R$ 0,00"}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Base: assinaturas ativas
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 5: Churn Rate */}
            <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] uppercase font-bold">
                    N/A
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                    Taxa de Churn
                  </p>
                  <h3 className="text-lg font-black text-white/90 italic tracking-tight">
                    Dados insuficientes
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Sem cancelamentos
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos e Distribuição Real */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Gráfico 1: Evolução de Receita da Plataforma */}
            <Card className="lg:col-span-2 glass border-white/5 rounded-[2.5rem] p-8 overflow-hidden">
              <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                    <TrendingUp className="text-purple-400 w-5 h-5" /> Faturamento da Plataforma
                  </CardTitle>
                  <CardDescription className="text-gray-500 text-xs mt-1">
                    Receita liquidada de assinaturas contratuais na conta do SaaS Barbex.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-[10px]">
                  Fonte Canônica Pendente
                </Badge>
              </CardHeader>

              <div className="h-[280px] w-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-6 text-center">
                <AlertCircle className="w-10 h-10 text-amber-400/80 mb-3" />
                <p className="text-sm font-bold text-white uppercase italic tracking-tight">
                  Histórico Financeiro Transacional Indisponível
                </p>
                <p className="text-xs text-gray-400 max-w-lg mt-2 leading-relaxed">
                  A tabela <code className="text-purple-300 font-mono">public.transactions</code> armazena exclusivamente os recebimentos operacionais das barbearias (serviços de corte e barba). O registro e conciliação de liquidações financeiras de assinaturas da plataforma requerem a integração de uma fonte financeira canônica dedicada a faturamento SaaS.
                </p>
              </div>
            </Card>

            {/* Painel 2: Distribuição por Modalidade Comercial */}
            <Card className="glass border-white/5 rounded-[2.5rem] p-8">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                  <PieChart className="text-pink-400 w-5 h-5" /> Modalidades Ativas
                </CardTitle>
                <CardDescription className="text-gray-500 text-xs mt-1">
                  Distribuição real das 5 barbearias cadastradas.
                </CardDescription>
              </CardHeader>
              <div className="space-y-6">
                {/* 1. Vouchers */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-purple-300">Voucher Permanente (LM)</span>
                    <span className="text-white">
                      {data.totalShops > 0 ? `${Math.round((data.totalVouchers / data.totalShops) * 100)}%` : "0%"} ({data.totalVouchers})
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all duration-700" 
                      style={{ width: `${data.totalShops > 0 ? (data.totalVouchers / data.totalShops) * 100 : 0}%` }} 
                    />
                  </div>
                </div>

                {/* 2. Trials */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-amber-300">Período de Testes (Trial)</span>
                    <span className="text-white">
                      {data.totalShops > 0 ? `${Math.round((data.totalTrials / data.totalShops) * 100)}%` : "0%"} ({data.totalTrials})
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-700" 
                      style={{ width: `${data.totalShops > 0 ? (data.totalTrials / data.totalShops) * 100 : 0}%` }} 
                    />
                  </div>
                </div>

                {/* 3. Assinaturas Comerciais */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-emerald-300">Assinaturas Comerciais</span>
                    <span className="text-white">
                      {data.totalShops > 0 ? `${Math.round((data.commercialSubsCount / data.totalShops) * 100)}%` : "0%"} ({data.commercialSubsCount})
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-700" 
                      style={{ width: `${data.totalShops > 0 ? (data.commercialSubsCount / data.totalShops) * 100 : 0}%` }} 
                    />
                  </div>
                </div>

                {/* Resumo de Potencial Nominal */}
                <div className="pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-medium">Potencial de Catálogo (Nominal):</span>
                    <span className="text-gray-300 font-mono font-bold">{brl(data.totalCatalogPotential)}/mês</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Valor de tabela dos planos técnicos atribuídos para homologação, sem faturamento ativo.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Tabela de Detalhamento Real */}
          <Card className="glass border-white/5 rounded-3xl p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-bold text-white uppercase italic flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-400" />
                Detalhamento Canônico dos Estabelecimentos
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Auditoria individual conforme a classificação comercial centralizada do release R2E.9.
              </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/5 uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Estabelecimento</th>
                    <th className="pb-3">Modalidade</th>
                    <th className="pb-3">Status de Vigência</th>
                    <th className="pb-3">Referência Técnica</th>
                    <th className="pb-3 text-right">MRR Comercial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.tenantClassifications.map((t) => (
                    <tr key={t.tenantId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3">
                        <span className="font-bold text-white">{t.tenantName}</span>
                        <span className="text-[10px] text-gray-500 block font-mono">slug: {t.slug}</span>
                      </td>
                      <td className="py-3">
                        {t.modality === "VOUCHER" ? (
                          <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
                            VOUCHER PERMANENTE
                          </Badge>
                        ) : t.modality === "TRIAL" ? (
                          <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                            TRIAL
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
                            ASSINATURA
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 text-gray-400 font-medium">
                        {t.trialStatus}
                      </td>
                      <td className="py-3 text-gray-300 font-mono">
                        {t.technicalPlanName || "PADRÃO"}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-white">
                        {brl(t.contractedMonthlyAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
