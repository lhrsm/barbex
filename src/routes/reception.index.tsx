import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarPlus,
  UserPlus,
  Users,
  Clock,
  LogIn,
  Footprints,
  CircleDollarSign,
  ListChecks,
  Sparkles,
  Building2,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { WalkinModal } from "@/components/calendar/WalkinModal";
import { ReceptionQueue } from "@/components/reception/ReceptionQueue";
import { useReception } from "@/hooks/use-reception";
import { useTenant } from "@/hooks/use-tenant";
import { ProfileCompletionBanner } from "@/components/profile/ProfileCompletionBanner";

export const Route = createFileRoute("/reception/")({
  head: () => ({
    meta: [
      { title: "Central de Atendimento | Recepção Barbex" },
      { name: "description", content: "Resumo operacional do dia: atendimentos, check-ins, walk-ins e pagamentos pendentes." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Central de Atendimento | Recepção Barbex" },
      { property: "og:description", content: "Resumo operacional do dia da barbearia." },
    ],
  }),
  component: ReceptionHome,
});

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function KpiCard({
  label,
  value,
  subtext,
  icon: Icon,
  accentColor = "text-gold",
  badgeBg = "bg-gold/15 border-gold/30",
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: any;
  accentColor?: string;
  badgeBg?: string;
}) {
  return (
    <Card className="bg-[#0b0f17] border-zinc-800/80 p-4 shadow-sm hover:border-gold/30 transition-all">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${badgeBg} ${accentColor}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-400 truncate">{label}</p>
          <p className="text-2xl font-black text-white tabular-nums tracking-tight mt-0.5">{value}</p>
          {subtext && <p className="text-[10px] text-zinc-500 truncate mt-0.5">{subtext}</p>}
        </div>
      </div>
    </Card>
  );
}

function ReceptionHome() {
  const { tenantId, profile, user, can } = useReception();
  const { tenantProfile } = useTenant();
  const [apptOpen, setApptOpen] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const now = new Date();
  const day = format(now, "yyyy-MM-dd");
  const formattedDate = format(now, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const barbershopName = tenantProfile?.business_name || (profile as any)?.business_name || "Barbex";
  const userGreetingName = (profile as any)?.responsible_name?.split(" ")[0] ||
    (profile as any)?.display_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Recepção";

  const { data: stats, isLoading } = useQuery({
    queryKey: ["reception-stats", tenantId, day],
    enabled: !!tenantId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const start = `${day}T00:00:00`;
      const end = `${day}T23:59:59`;

      const [{ data: appts }, { count: checkins }, { count: waiting }] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, status, start_time, payment_status, source")
          .eq("tenant_id", tenantId!)
          .gte("start_time", start)
          .lte("start_time", end),
        supabase
          .from("appointment_checkins")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .gte("checked_in_at", start)
          .lte("checked_in_at", end),
        supabase
          .from("waiting_list")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("status", "aguardando"),
      ]);

      const list = appts || [];
      const nowDate = new Date();
      return {
        today: list.length,
        next: list.filter(
          (a: any) => new Date(a.start_time) > nowDate && !["cancelled", "completed"].includes(a.status),
        ).length,
        checkins: checkins ?? 0,
        walkins: list.filter((a: any) => a.source === "walkin").length,
        pendingPayment: list.filter(
          (a: any) => a.payment_status && a.payment_status !== "paid" && a.status !== "cancelled",
        ).length,
        waiting: waiting ?? 0,
      };
    },
  });

  return (
    <div className="space-y-6">
      {/* Banner de Completude de Perfil */}
      <ProfileCompletionBanner />

      {/* Header Principal da Recepção */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Central de Atendimento</h1>
            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
              Operação Ativa
            </Badge>
          </div>
          <p className="text-sm text-zinc-400">
            {getGreeting()}, <strong className="text-white font-semibold">{userGreetingName}</strong> ·{" "}
            <span className="capitalize">{formattedDate}</span> · <span className="text-gold">{barbershopName}</span>
          </p>
        </div>

        {/* Primary CTA destacada no Header */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setApptOpen(true)}
            className="bg-gold hover:bg-gold/90 text-black font-bold text-sm shadow-lg shadow-gold/20"
          >
            <CalendarPlus className="mr-2 h-4 w-4" aria-hidden /> Novo agendamento
          </Button>
        </div>
      </header>

      {/* Atalhos Operacionais Secundários */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWalkinOpen(true)}
          className="border-zinc-800 bg-[#0b0f17] text-zinc-200 hover:text-white hover:border-gold/40 text-xs font-medium"
        >
          <Footprints className="mr-2 h-3.5 w-3.5 text-gold" aria-hidden /> Atendimento presencial (Walk-in)
        </Button>
        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-zinc-800 bg-[#0b0f17] text-zinc-200 hover:text-white hover:border-gold/40 text-xs font-medium"
        >
          <a href="/reception/waiting-list">
            <ListChecks className="mr-2 h-3.5 w-3.5 text-gold" aria-hidden /> Lista de espera
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-zinc-800 bg-[#0b0f17] text-zinc-200 hover:text-white hover:border-gold/40 text-xs font-medium"
        >
          <a href="/reception/customers">
            <UserPlus className="mr-2 h-3.5 w-3.5 text-gold" aria-hidden /> Clientes
          </a>
        </Button>
      </div>

      {/* KPI Cards Operacionais */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-zinc-900" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Atendimentos hoje"
            value={stats?.today ?? 0}
            subtext="Programados para hoje"
            icon={Users}
            accentColor="text-gold"
            badgeBg="bg-gold/15 border-gold/30"
          />
          <KpiCard
            label="Próximos"
            value={stats?.next ?? 0}
            subtext="Aguardando horário"
            icon={Clock}
            accentColor="text-amber-400"
            badgeBg="bg-amber-400/15 border-amber-400/30"
          />
          <KpiCard
            label="Check-ins"
            value={stats?.checkins ?? 0}
            subtext="Clientes no local"
            icon={LogIn}
            accentColor="text-emerald-400"
            badgeBg="bg-emerald-400/15 border-emerald-400/30"
          />
          <KpiCard
            label="Walk-ins"
            value={stats?.walkins ?? 0}
            subtext="Presenciais sem agendar"
            icon={Footprints}
            accentColor="text-sky-400"
            badgeBg="bg-sky-400/15 border-sky-400/30"
          />
          {can("view_finances_summary") && (
            <KpiCard
              label="A receber"
              value={stats?.pendingPayment ?? 0}
              subtext="Pagamentos pendentes"
              icon={CircleDollarSign}
              accentColor="text-orange-400"
              badgeBg="bg-orange-400/15 border-orange-400/30"
            />
          )}
          <KpiCard
            label="Lista de espera"
            value={stats?.waiting ?? 0}
            subtext="Na fila de encaixe"
            icon={ListChecks}
            accentColor="text-violet-400"
            badgeBg="bg-violet-400/15 border-violet-400/30"
          />
        </div>
      )}

      {/* Seção da Fila de Atendimento do Dia */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-bold text-white tracking-tight">Fila de Atendimento do Dia</h2>
          </div>
          <span className="text-xs text-zinc-500">Atualização em tempo real</span>
        </div>
        <ReceptionQueue onNewAppointment={() => setApptOpen(true)} />
      </section>

      <AppointmentModal open={apptOpen} onOpenChange={setApptOpen} />
      <WalkinModal open={walkinOpen} onOpenChange={setWalkinOpen} />
    </div>
  );
}
