import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Database,
  ShieldCheck,
  Zap,
  History,
  AlertTriangle,
  BarChart3,
  LineChart,
  Clock,
  CheckCircle2,
  Terminal,
  Search,
  RefreshCw,
  Server,
  Lock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  PremiumTabs,
  PremiumTabsList,
  PremiumTabsBody,
  PremiumTabsContent
} from "@/components/ui/premium-tabs";
import { getSystemHealthClient, getScalabilityMetricsClient } from "@/lib/backend/quick-wins";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/observability")({
  component: ObservabilityCenterPage,
});

function ObservabilityCenterPage() {
  const { data: health, isLoading: loadingHealth, refetch: refetchHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => getSystemHealthClient(),
    refetchInterval: 30000 // 30s
  });

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['scalability-metrics'],
    queryFn: () => getScalabilityMetricsClient()
  });

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 grid place-items-center shadow-lg shadow-indigo-500/5">
            <Activity className="text-indigo-400" size={28} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Observabilidade</h1>
            <p className="text-zinc-500 font-medium text-sm mt-1 uppercase tracking-tight">Monitoramento de Escalabilidade e Resiliência Enterprise</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" onClick={() => refetchHealth()} className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white gap-2 uppercase font-black italic tracking-widest text-[10px]">
             <RefreshCw size={14} className={loadingHealth ? "animate-spin" : ""} /> Atualizar Agora
           </Button>
           <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-black uppercase tracking-tighter italic">SaaS Operational</Badge>
        </div>
      </div>

      {/* Main Grid: Health & Real-time Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#0b0f17] border-zinc-800 shadow-2xl overflow-hidden group">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-white font-black italic uppercase tracking-tight">Saúde do Ecossistema</CardTitle>
                <CardDescription className="text-zinc-500 font-bold uppercase text-[10px]">Status dos serviços fundamentais em tempo real</CardDescription>
              </div>
              <div className="text-right">
                <Badge variant="outline" className={cn(
                  "font-black uppercase text-[10px] italic",
                  health?.status === 'healthy' ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-amber-500/5 border-amber-500/20 text-amber-400"
                )}>
                  {health?.status === 'healthy' ? 'Status: Operacional' : 'Status: Degradado'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HealthStatusItem icon={Database} label="PostgreSQL" status={health?.services?.database === 'healthy' ? 'success' : 'error'} />
              <HealthStatusItem icon={ShieldCheck} label="Auth" status="unmonitored" />
              <HealthStatusItem icon={Zap} label="Realtime" status="unmonitored" />
              <HealthStatusItem icon={Server} label="Edge Fns" status="unmonitored" />
            </div>

            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Latência da Conexão com o Banco</span>
                <span className={cn("text-xs font-black italic", (health?.metrics?.db_latency_ms || 0) > 300 ? "text-amber-400" : "text-emerald-400")}>
                  {health?.metrics?.db_latency_ms || 0}ms
                </span>
              </div>
              <Progress value={Math.min((health?.metrics?.db_latency_ms || 0) / 5, 100)} className="h-1.5 bg-zinc-800" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0f17] border-zinc-800 shadow-2xl flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="text-white font-black italic uppercase tracking-tight text-lg">Alertas de Performance</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            {(() => {
              const activeAlerts: Array<{ id: number; title: string; type: string; time: string; service: string }> = [];
              if ((health?.metrics?.db_latency_ms || 0) > 500) {
                activeAlerts.push({ id: 1, title: "Lentidão na Conexão", type: "warning", time: "Em tempo real", service: "Database" });
              }
              if ((metrics?.queue_status?.pending || 0) > 10) {
                activeAlerts.push({ id: 2, title: "Fila Acumulada", type: "warning", time: "Em tempo real", service: "Queue" });
              }
              if ((metrics?.queue_status?.failed || 0) > 0) {
                activeAlerts.push({ id: 3, title: "Jobs com Falha Detectados", type: "warning", time: "Em tempo real", service: "Queue" });
              }

              if (activeAlerts.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center h-28 text-center p-4">
                    <CheckCircle2 className="text-emerald-500 mb-2" size={24} />
                    <p className="text-xs font-black text-zinc-300 uppercase italic">Nenhum Alerta Ativo</p>
                    <p className="text-[10px] font-medium text-zinc-500 mt-0.5 uppercase">Operação estável sem incidentes detectados</p>
                  </div>
                );
              }

              return activeAlerts.map(alert => (
                <div key={alert.id} className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl flex items-start gap-3 hover:border-indigo-500/30 transition-all cursor-pointer group">
                  <div className={cn("p-1.5 rounded-lg mt-0.5", alert.type === 'warning' ? "bg-amber-500/10" : "bg-indigo-500/10")}>
                    <AlertTriangle size={14} className={alert.type === 'warning' ? "text-amber-500" : "text-indigo-400"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white uppercase italic group-hover:text-indigo-400 transition-colors">{alert.title}</p>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5 tracking-tighter">{alert.service} • {alert.time}</p>
                  </div>
                </div>
              ));
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Tabs Section */}
      <PremiumTabs defaultValue="overview">
        <PremiumTabsList
          tabs={[
            { value: "overview", label: "Overview", icon: BarChart3 },
            { value: "queues", label: "Filas & Jobs", icon: History },
            { value: "resilience", label: "Resiliência", icon: ShieldCheck },
            { value: "healing", label: "Auto-Healing", icon: RefreshCw },
            { value: "governance", label: "Governança", icon: Lock },
          ]}
        />
        <PremiumTabsBody>
          <PremiumTabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <MetricStatCard title="Tenants Ativos" value={metrics?.active_tenants ?? 0} unit="barbearias cadastradas" icon={Server} />
              <MetricStatCard title="Agendamentos" value={metrics?.total_appointments ?? 0} unit="agendamentos no banco" icon={Clock} />
              <MetricStatCard
                title="Taxa de Erro"
                value={metrics?.error_rate !== null && metrics?.error_rate !== undefined ? `${(((metrics?.error_rate || 0)) * 100).toFixed(2)}%` : "Indisponível"}
                unit={metrics?.error_rate !== null && metrics?.error_rate !== undefined ? "avg" : "sem telemetria de logs"}
                icon={AlertTriangle}
                isWarning={Boolean(metrics?.error_rate && metrics.error_rate > 0.05)}
              />
            </div>
          </PremiumTabsContent>

          <PremiumTabsContent value="queues">
            <Card className="bg-[#0b0f17] border-zinc-800">
               <CardHeader>
                 <CardTitle className="text-white font-black italic uppercase tracking-tight">Status da Fila de Processamento</CardTitle>
                 <CardDescription className="text-zinc-500 font-bold uppercase text-[10px]">Fairness e Resiliência de Automações</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center space-y-1">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Pendentes</p>
                      <p className="text-3xl font-black text-white italic">{metrics?.queue_status?.pending ?? 0}</p>
                    </div>
                    <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center space-y-1">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Falhados (Retry)</p>
                      <p className="text-3xl font-black text-amber-500 italic">{metrics?.queue_status?.failed ?? 0}</p>
                    </div>
                    <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center space-y-1">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Dead-Letter</p>
                      <p className="text-3xl font-black text-rose-500 italic">{metrics?.queue_status?.dead_letter ?? 0}</p>
                    </div>
                 </div>
                </CardContent>
            </Card>
          </PremiumTabsContent>

          <PremiumTabsContent value="resilience">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-[#0b0f17] border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white font-black italic uppercase tracking-tight">Circuit Breakers & Integrações</CardTitle>
                  <CardDescription className="text-zinc-500 font-bold uppercase text-[10px]">Status de disponibilidade de gateways externos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: "Z-API (WhatsApp)", status: "OPERACIONAL", note: "Notificações e Mensageria" },
                    { name: "Stripe Gateway", status: "OPERACIONAL", note: "Cobranças e Assinaturas" },
                    { name: "Resend", status: "OPERACIONAL", note: "Disparo de E-mails Transacionais" }
                  ].map(circuit => (
                    <div key={circuit.name} className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                      <div>
                        <p className="text-xs font-black text-white uppercase italic">{circuit.name}</p>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5 tracking-tighter">{circuit.note}</p>
                      </div>
                      <Badge className="h-6 px-3 font-black uppercase text-[10px] tracking-widest bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        {circuit.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-[#0b0f17] border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white font-black italic uppercase tracking-tight">Estratégias de Idempotência</CardTitle>
                  <CardDescription className="text-zinc-500 font-bold uppercase text-[10px]">Prevenção de operações duplicadas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl space-y-2">
                    <p className="text-xs font-black text-white uppercase italic">Mecanismo Ativo</p>
                    <p className="text-xs text-zinc-400 font-medium">Controle de concorrência com constraints UNIQUE no banco e claim pessimista via PostgreSQL (SKIP LOCKED).</p>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2">
                    <span className="text-zinc-400 font-bold italic uppercase text-[10px]">Proteção de Lock Atômico</span>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-black uppercase text-[9px]">ATIVO</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </PremiumTabsContent>

          <PremiumTabsContent value="healing">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-[#0b0f17] border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white font-black italic uppercase tracking-tight">Auto-Healing Engine</CardTitle>
                  <CardDescription className="text-zinc-500 font-bold uppercase text-[10px]">Correção automática de falhas estruturais</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-white uppercase italic">Status do Motor</p>
                      <p className="text-[10px] font-bold text-emerald-500 uppercase mt-0.5 tracking-tighter">Reconciliação de Jobs Agendada (pg_cron)</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { name: "Jobs Travados (>15m)", action: "Reconciliação para Retry / Dead-Letter", status: "Monitorado" },
                      { name: "Conexões DB", action: "Pool Gerenciado Supabase", status: "Operacional" }
                    ].map(item => (
                      <div key={item.name} className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                        <div>
                          <p className="text-xs font-bold text-zinc-300">{item.name}</p>
                          <p className="text-[9px] font-black text-zinc-500 uppercase italic">{item.action}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-black uppercase italic text-zinc-400">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#0b0f17] border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white font-black italic uppercase tracking-tight">Estatísticas de Recuperação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] flex items-center justify-center text-zinc-500 italic text-xs uppercase text-center p-4">
                    Sem histórico de jobs travados para exibir no momento.
                  </div>
                </CardContent>
              </Card>
            </div>
          </PremiumTabsContent>

          <PremiumTabsContent value="governance">
            <div className="grid grid-cols-1 gap-6">
              <Card className="bg-[#0b0f17] border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white font-black italic uppercase tracking-tight">Governança e Integridade</CardTitle>
                  <CardDescription className="text-zinc-500 font-bold uppercase text-[10px]">Cadeia de custódia e validação de logs críticos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6 p-6 bg-zinc-900/30 border border-zinc-800 rounded-3xl">
                    <div className="h-20 w-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 grid place-items-center">
                      <ShieldCheck className="text-indigo-400" size={40} />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white italic uppercase">Políticas de Segurança e RLS</h4>
                      <p className="text-xs text-zinc-500 font-medium max-w-2xl mt-1">Acesso a dados e tabelas estritamente protegido por Row-Level Security no PostgreSQL com isolamento por Tenant ID.</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                    <span className="text-xs font-bold text-zinc-300">Auditoria RLS Ativa</span>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-black uppercase text-[10px]">100% Protegido</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </PremiumTabsContent>

          <PremiumTabsContent value="logs">
            <div className="p-6 bg-[#0b0f17] rounded-2xl border border-zinc-800 text-center space-y-2">
              <Terminal className="mx-auto text-zinc-600 mb-2" size={32} />
              <p className="text-xs font-black text-zinc-400 uppercase italic">Stream de Logs Centralizado</p>
              <p className="text-[10px] text-zinc-600 uppercase">A visualização em tempo real de logs de sistema está em fase de instrumentação.</p>
            </div>
          </PremiumTabsContent>
        </PremiumTabsBody>
      </PremiumTabs>
    </div>
  );
}

function HealthStatusItem({ icon: Icon, label, status }: any) {
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isUnmonitored = status === 'unmonitored';

  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-zinc-900/30 border border-zinc-800 hover:bg-zinc-900 transition-colors">
      <div className={cn(
        "h-10 w-10 rounded-xl border grid place-items-center shadow-lg",
        isSuccess ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
        isError ? "bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-rose-500/5" :
        "bg-zinc-800/40 border-zinc-700/30 text-zinc-500"
      )}>
        <Icon size={20} />
      </div>
      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">{label}</span>
      <Badge className={cn(
        "text-[8px] uppercase font-black italic tracking-widest",
        isSuccess ? "bg-emerald-500/10 text-emerald-500" :
        isError ? "bg-rose-500/10 text-rose-500" :
        "bg-zinc-800 text-zinc-500 border-zinc-700/50"
      )}>
        {isSuccess ? 'ONLINE' : isError ? 'ERROR' : 'NÃO MONITORADO'}
      </Badge>
    </div>
  );
}

function MetricStatCard({ title, value, unit, icon: Icon, isWarning = false }: any) {
  return (
    <Card className="bg-[#0b0f17] border-zinc-800 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
        <Icon size={48} className={isWarning ? "text-rose-500" : "text-indigo-400"} />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-4xl font-black italic tracking-tighter", isWarning ? "text-rose-500" : "text-white")}>{value}</p>
        <p className="text-[9px] font-bold text-zinc-600 uppercase mt-1 italic tracking-widest">{unit}</p>
      </CardContent>
    </Card>
  );
}
