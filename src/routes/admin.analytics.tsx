import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, 
  PieChart, 
  Users,
  Store,
  Calendar,
  CheckCircle2,
  Database,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminChartsTab } from "@/components/admin/AdminChartsTab";
import { AdminEngagementTab } from "@/components/admin/AdminEngagementTab";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { subDays } from "date-fns";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
  head: () => ({
    title: "Analytics Global | Barbex Super Admin",
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Uso da plataforma, retenção e engajamento dos estabelecimentos cadastrados." },
    ],
  }),
});

const MODULE_LABELS: Record<string, string> = {
  agenda: "Agenda",
  finances: "Financeiro",
  loyalty: "Fidelidade",
  subscriptions: "Assinaturas",
  products: "Produtos",
  automations: "Automações",
  reviews: "Avaliações",
  commissions: "Comissões",
  campaigns: "Campanhas",
  reports: "Relatórios",
  whatsapp: "WhatsApp / Z-API",
  ai_assistant: "IA para Atendimento",
};

function AdminAnalytics() {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ["admin-analytics-overview"],
    queryFn: async () => {
      const since30 = subDays(new Date(), 30).toISOString();
      const since24h = subDays(new Date(), 1).toISOString();

      const [
        { data: appointments, error: aErr },
        { data: barbershops, error: bErr },
        { data: modules, error: mErr },
        { count: customersCount, error: cErr },
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select("tenant_id, created_at")
          .gte("created_at", since30),
        supabase.from("barbershops").select("id, name, created_at"),
        supabase.from("barbershop_modules").select("tenant_id, module_key, enabled"),
        supabase.from("customers").select("*", { count: "exact", head: true }),
      ]);

      if (aErr) console.warn("Aviso ao consultar agendamentos:", aErr);
      if (bErr) throw new Error("Erro ao consultar barbearias: " + bErr.message);
      if (mErr) console.warn("Aviso ao consultar módulos:", mErr);
      if (cErr) console.warn("Aviso ao consultar contagem de clientes:", cErr);

      const apps = appointments || [];
      const shops = barbershops || [];
      const totalShops = shops.length || 0;

      // 1. Barbearias com movimentação de agendamentos nas últimas 24 horas
      const activeLast24h = new Set(
        apps
          .filter((a) => new Date(a.created_at).getTime() >= new Date(since24h).getTime() && a.tenant_id)
          .map((a) => a.tenant_id as string)
      ).size;

      // 2. Barbearias com movimentação de agendamentos nos últimos 30 dias
      const activeLast30d = new Set(
        apps.map((a) => a.tenant_id as string).filter(Boolean)
      ).size;

      // 3. Atividade Operacional da Base (30d): Proporção de estabelecimentos com agendamentos no mês
      // (Não constitui cálculo de retenção de coorte, mas atividade operacional recente da base)
      const operationalActivityRate = totalShops > 0
        ? Math.round((activeLast30d / totalShops) * 100)
        : 0;

      // 4. Adesão de Módulos reais habilitados
      const enabledModules = (modules || []).filter((m) => m.enabled);
      const moduleCounts: Record<string, number> = {};
      enabledModules.forEach((m) => {
        moduleCounts[m.module_key] = (moduleCounts[m.module_key] || 0) + 1;
      });

      const moduleDistribution = Object.entries(moduleCounts)
        .map(([key, count]) => ({
          key,
          label: MODULE_LABELS[key] || key,
          count,
          percentage: totalShops > 0 ? Math.round((count / totalShops) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        activeLast24h,
        activeLast30d,
        totalShops,
        totalCustomers: customersCount || 0,
        totalAppointments30d: apps.length,
        operationalActivityRate,
        moduleDistribution,
      };
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white italic uppercase tracking-tighter">
            Analytics Global
          </h1>
          <p className="text-gray-400 font-medium text-sm mt-1">
            Uso da plataforma, atividade operacional e engajamento real dos estabelecimentos cadastrados.
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-white/5 border border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="overview" className="rounded-xl px-8 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all text-xs font-bold uppercase tracking-wider">
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="charts" className="rounded-xl px-8 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all text-xs font-bold uppercase tracking-wider">
            Performance
          </TabsTrigger>
          <TabsTrigger value="usage" className="rounded-xl px-8 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all text-xs font-bold uppercase tracking-wider">
            Engajamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
          {isLoading ? (
            <div className="py-20 text-center space-y-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto" />
              <p className="text-gray-500 font-black italic uppercase tracking-widest text-xs">
                Calculando métricas operacionais...
              </p>
            </div>
          ) : error ? (
            <Card className="border-rose-500/20 bg-rose-500/5 p-8 text-center">
              <div className="text-rose-400 font-bold mb-2">Erro ao Carregar Analytics</div>
              <p className="text-gray-400 text-sm">{(error as Error).message}</p>
            </Card>
          ) : metrics ? (
            <>
              {/* 4 Cards Principais com Métricas Canônicas */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Card 1: Barbearias com Agendamentos nas Últimas 24h */}
                <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Barbearias com Agendamentos (24h)
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Activity className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black tracking-tight mb-2 text-white">
                      {metrics.activeLast24h}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-tighter">
                        Últimas 24h
                      </span>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                        com agendamentos registrados
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Barbearias com Agendamentos nos Últimos 30 Dias */}
                <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Barbearias com Agendamentos (30d)
                    </span>
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                      <Store className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black tracking-tight mb-2 text-white">
                      {metrics.activeLast30d}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-purple-400 font-bold uppercase tracking-tighter">
                        De {metrics.totalShops}
                      </span>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                        estabelecimentos na base
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: Atividade Operacional da Base (30d) */}
                <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Atividade Operacional da Base (30d)
                    </span>
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                      <PieChart className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black tracking-tight mb-2 text-white">
                      {metrics.operationalActivityRate}%
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">
                        {metrics.activeLast30d} de {metrics.totalShops}
                      </span>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                        estabelecimentos com agendamentos
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 4: Clientes Cadastrados na Plataforma */}
                <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Clientes Registrados
                    </span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <Users className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black tracking-tight mb-2 text-white">
                      {metrics.totalCustomers}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-tighter">
                        Consumidores
                      </span>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                        em todos os estabelecimentos
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Seção Central: Módulos Habilitados e Volume Operacional */}
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
                {/* Painel Esquerdo: Distribuição Real de Módulos */}
                <Card className="lg:col-span-4 glass border-white/5 rounded-2xl overflow-hidden shadow-none">
                  <CardHeader className="bg-white/5 px-8 py-6">
                    <CardTitle className="text-xl font-bold">Adesão Real de Módulos</CardTitle>
                    <CardDescription className="text-gray-500 font-medium">
                      Funcionalidades habilitadas nos estabelecimentos cadastrados.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    {metrics.moduleDistribution.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-8">
                        Nenhum módulo específico habilitado nos estabelecimentos.
                      </p>
                    ) : (
                      metrics.moduleDistribution.map((m) => (
                        <div key={m.key} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-white uppercase tracking-tight">
                              {m.label}
                            </span>
                            <span className="text-xs font-black text-purple-400">
                              {m.count} barbearia(s) ({m.percentage}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-700" 
                              style={{ width: `${m.percentage}%` }} 
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Painel Direito: Resumo de Volume Operacional Verificável */}
                <Card className="lg:col-span-3 glass border-white/5 rounded-2xl overflow-hidden shadow-none">
                  <CardHeader className="bg-white/5 px-8 py-6">
                    <CardTitle className="text-xl font-bold">Saúde Operacional</CardTitle>
                    <CardDescription className="text-gray-500 font-medium">
                      Métricas verificáveis de infraestrutura e tráfego.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 flex flex-col gap-6">
                    <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/5 border border-white/5">
                      <div className="p-3 bg-purple-500/20 rounded-2xl">
                        <Calendar className="h-6 w-6 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                          Agendamentos (30d)
                        </p>
                        <p className="text-xl font-black text-white italic">
                          {metrics.totalAppointments30d} agendamentos
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/5 border border-white/5">
                      <div className="p-3 bg-emerald-500/20 rounded-2xl">
                        <Database className="h-6 w-6 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                          Banco de Dados Supabase
                        </p>
                        <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                          <CheckCircle2 className="w-4 h-4" /> Conectado & Operacional
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="charts" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-1 glass rounded-2xl border-white/5">
            <AdminChartsTab />
          </div>
        </TabsContent>

        <TabsContent value="usage" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AdminEngagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
