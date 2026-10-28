import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  format, 
  parseISO, 
  isSameDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  addDays, 
  subDays, 
  addMonths, 
  subMonths, 
  startOfDay, 
  endOfDay, 
  differenceInDays, 
  differenceInMinutes, 
  isValid 
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  CalendarPlus, 
  Footprints, 
  CheckCircle2, 
  LogIn, 
  PlayCircle, 
  XCircle, 
  Eye, 
  Clock, 
  Scissors, 
  Loader2,
  CalendarDays
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invalidateAllAppointmentQueries } from "@/lib/sync-appointments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EntityAvatar } from "@/components/calendar/appointment/EntityAvatar";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { WalkinModal } from "@/components/calendar/WalkinModal";
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { RescheduleWizard } from "@/components/reschedule/RescheduleWizard";
import { 
  AgendaFilters, 
  EMPTY_FILTERS, 
  type AgendaFilterState, 
  applyAgendaFilters 
} from "@/components/calendar/agenda/AgendaFilters";
import { MonthView } from "@/components/calendar/agenda/MonthView";
import { getAgendaOrigin } from "@/components/calendar/agenda/status";
import { useAppointmentStatus } from "@/hooks/use-appointment-status";
import { useReception } from "@/hooks/use-reception";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reception/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda da Recepção | Barbex" },
      { name: "description", content: "Agenda operacional completa da recepção com filtros por dia, semana, mês e período, check-in e ações rápidas." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Agenda da Recepção | Barbex" },
      { property: "og:description", content: "Agenda operacional multiperfil da barbearia." },
    ],
  }),
  component: ReceptionAgenda,
});

export type CalendarViewMode = "day" | "week" | "month" | "custom";

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando confirmação",
  scheduled: "Agendado",
  confirmed: "Confirmado",
  checked_in: "Check-in realizado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "No-show",
  rescheduled: "Reagendado",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  scheduled: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  confirmed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  checked_in: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  in_progress: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  no_show: "bg-destructive/15 text-destructive border-destructive/30",
  rescheduled: "bg-muted text-muted-foreground border-white/10",
};

function delayInfo(startTime: string, arrived: string | null) {
  if (!arrived) return null;
  const diff = differenceInMinutes(parseISO(arrived), parseISO(startTime));
  if (diff <= 0) return { label: "No horário", tone: "text-emerald-400" };
  if (diff <= 5) return { label: `+${diff} min`, tone: "text-amber-400" };
  if (diff <= 15) return { label: `Atraso moderado (${diff} min)`, tone: "text-orange-400" };
  return { label: `Atraso crítico (${diff} min)`, tone: "text-destructive" };
}

function ReceptionAgenda() {
  const queryClient = useQueryClient();
  const { tenantId, can } = useReception();
  const { updateStatus } = useAppointmentStatus();

  // Estados de navegação e modos
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarViewMode>("day");
  const [customStartDate, setCustomStartDate] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateError, setDateError] = useState<string | null>(null);

  // Estados de filtros avançados
  const [filters, setFilters] = useState<AgendaFilterState>(EMPTY_FILTERS);

  // Dados carregados
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modais operacionais
  const [apptOpen, setApptOpen] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState<any>(null);

  // Refs para ciclo de fetch sem race conditions
  const currentDateRef = useRef(currentDate);
  currentDateRef.current = currentDate;
  const viewRef = useRef(view);
  viewRef.current = view;
  const customStartRef = useRef(customStartDate);
  customStartRef.current = customStartDate;
  const customEndRef = useRef(customEndDate);
  customEndRef.current = customEndDate;
  const latestFetchIdRef = useRef(0);

  // Busca de profissionais e serviços do tenant
  useEffect(() => {
    if (!tenantId) return;

    async function loadAux() {
      try {
        const [barbRes, servRes] = await Promise.all([
          supabase.from("barbers").select("*").eq("tenant_id", tenantId!).eq("active", true).order("name"),
          supabase.from("services").select("*").eq("tenant_id", tenantId!).eq("active", true).order("name"),
        ]);
        if (barbRes.data) setBarbers(barbRes.data);
        if (servRes.data) setServices(servRes.data);
      } catch (err) {
        console.error("[ReceptionAgenda] Error loading auxiliary data:", err);
      }
    }
    loadAux();
  }, [tenantId]);

  // Consulta de atendimentos e check-ins com suporte a Dia, Semana, Mês e Período
  const fetchData = useCallback(async () => {
    if (!tenantId) return;

    const fetchId = ++latestFetchIdRef.current;
    setIsLoading(true);

    try {
      const curDate = currentDateRef.current;
      const curView = viewRef.current;
      let start: Date;
      let end: Date;

      if (curView === "day") {
        start = startOfDay(curDate);
        end = endOfDay(curDate);
      } else if (curView === "week") {
        start = startOfWeek(curDate, { weekStartsOn: 0 });
        end = endOfWeek(curDate, { weekStartsOn: 0 });
      } else if (curView === "month") {
        start = startOfWeek(startOfMonth(curDate), { weekStartsOn: 0 });
        end = endOfWeek(endOfMonth(curDate), { weekStartsOn: 0 });
      } else {
        const pStart = parseISO(customStartRef.current);
        const pEnd = parseISO(customEndRef.current);
        start = isValid(pStart) ? startOfDay(pStart) : startOfMonth(curDate);
        end = isValid(pEnd) ? endOfDay(pEnd) : endOfMonth(curDate);
      }

      const [apptRes, checkinRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, customers(*), barbers:barbers!appointments_barber_id_fkey(*), services(*)")
          .eq("tenant_id", tenantId)
          .in("status", ["scheduled", "confirmed", "completed", "cancelled", "no_show", "pending", "in_progress"])
          .gte("start_time", start.toISOString())
          .lte("start_time", end.toISOString())
          .order("start_time", { ascending: true }),
        supabase
          .from("appointment_checkins")
          .select("appointment_id, checked_in_at")
          .eq("tenant_id", tenantId)
          .gte("checked_in_at", start.toISOString())
          .lte("checked_in_at", end.toISOString()),
      ]);

      if (fetchId !== latestFetchIdRef.current) return;

      if (apptRes.error) {
        console.error("[ReceptionAgenda] Fetch error:", apptRes.error);
        return;
      }

      const checkinMap = new Map((checkinRes.data || []).map((c: any) => [c.appointment_id, c.checked_in_at]));
      const enriched = (apptRes.data || []).map((a: any) => ({
        ...a,
        arrived_at: checkinMap.get(a.id) ?? null,
      }));

      setAppointments(enriched);
    } catch (err) {
      console.error("[ReceptionAgenda] Crash in fetchData:", err);
    } finally {
      if (fetchId === latestFetchIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, currentDate, view, customStartDate, customEndDate]);

  // Sincronização Realtime
  useEffect(() => {
    if (!tenantId) return;

    const channelTopic = `reception-agenda-rt-${tenantId}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `tenant_id=eq.${tenantId}` },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_checkins", filter: `tenant_id=eq.${tenantId}` },
        () => fetchData()
      )
      .subscribe();

    const handleWindowRefresh = () => fetchData();
    window.addEventListener("REFRESH_APPOINTMENTS_DATA", handleWindowRefresh);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("REFRESH_APPOINTMENTS_DATA", handleWindowRefresh);
    };
  }, [tenantId, fetchData]);

  // Filtros client-side aplicados sobre o dataset carregado
  const filteredAppointments = useMemo(() => {
    return applyAgendaFilters(appointments, filters, getAgendaOrigin);
  }, [appointments, filters]);

  const paymentMethods = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a) => {
      if (a.payment_method) set.add(String(a.payment_method));
    });
    return Array.from(set).sort();
  }, [appointments]);

  const activeRevenue = useMemo(() => {
    return filteredAppointments.reduce((acc, a) => acc + Number(a.total_price || 0), 0);
  }, [filteredAppointments]);

  // Validação de intervalo personalizado (máximo 90 dias)
  const handleCustomRangeChange = (startStr: string, endStr: string) => {
    const s = parseISO(startStr);
    const e = parseISO(endStr);
    if (!isValid(s) || !isValid(e)) {
      setDateError("Formato de data inválido.");
      return;
    }
    if (s > e) {
      setDateError("A data inicial não pode ser posterior à data final.");
      return;
    }
    const diff = differenceInDays(e, s);
    if (diff > 90) {
      setDateError("O intervalo máximo permitido é de 90 dias.");
      return;
    }
    setDateError(null);
    setCustomStartDate(startStr);
    setCustomEndDate(endStr);
  };

  const applyPreset = (preset: "last7" | "last30" | "thisMonth" | "lastMonth") => {
    const now = new Date();
    if (preset === "last7") {
      handleCustomRangeChange(format(subDays(now, 7), "yyyy-MM-dd"), format(now, "yyyy-MM-dd"));
    } else if (preset === "last30") {
      handleCustomRangeChange(format(subDays(now, 30), "yyyy-MM-dd"), format(now, "yyyy-MM-dd"));
    } else if (preset === "thisMonth") {
      handleCustomRangeChange(format(startOfMonth(now), "yyyy-MM-dd"), format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (preset === "lastMonth") {
      const prev = subMonths(now, 1);
      handleCustomRangeChange(format(startOfMonth(prev), "yyyy-MM-dd"), format(endOfMonth(prev), "yyyy-MM-dd"));
    }
  };

  // Ações Operacionais da Recepção
  async function handleCheckin(appt: any) {
    try {
      setBusyId(appt.id);
      const { error } = await supabase.from("appointment_checkins").insert({
        appointment_id: appt.id,
        tenant_id: tenantId!,
        customer_id: appt.customers?.id ?? null,
        source: "reception",
      });
      if (error) throw error;
      await updateStatus(appt.id, "confirmed", {}, "reception_portal");
      toast.success(`Check-in registrado para ${appt.customers?.name || "cliente"}`);
      invalidateAllAppointmentQueries(queryClient, {
        appointmentId: appt.id,
        status: "confirmed",
        tenantId,
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar check-in");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatus(appt: any, nextStatus: string) {
    try {
      setBusyId(appt.id);
      await updateStatus(appt.id, nextStatus as any, {}, "reception_portal");
      toast.success(`Status atualizado para ${STATUS_LABEL[nextStatus] || nextStatus}`);
      invalidateAllAppointmentQueries(queryClient, {
        appointmentId: appt.id,
        status: nextStatus,
        tenantId,
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    } finally {
      setBusyId(null);
    }
  }

  // Agrupamento por dia para visualização semanal ou período personalizado
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    filteredAppointments.forEach((appt) => {
      const dateKey = format(parseISO(appt.start_time), "yyyy-MM-dd");
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(appt);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredAppointments]);

  // Card Operacional de Atendimento
  const renderAppointmentCard = (appt: any) => {
    const delay = delayInfo(appt.start_time, appt.arrived_at);
    const status = appt.arrived_at && appt.status === "confirmed" ? "checked_in" : appt.status;
    const busy = busyId === appt.id;

    return (
      <Card key={appt.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between bg-[#0b0f17] border-zinc-800/80 shadow-md rounded-2xl hover:border-gold/30 transition-all">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-14 shrink-0 text-center">
            <p className="text-base font-bold tabular-nums text-white">
              {format(parseISO(appt.start_time), "HH:mm")}
            </p>
            <p className="text-[11px] text-zinc-400">
              {appt.services?.duration ? `${appt.services.duration} min` : "—"}
            </p>
          </div>
          <EntityAvatar
            imageUrl={appt.customers?.avatar_url}
            name={appt.customers?.name}
            entityType="customer"
            size={40}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {appt.customers?.name || "Cliente"}
            </p>
            <p className="truncate text-xs text-zinc-400">
              {appt.services?.name || "Serviço"} · {appt.customers?.phone || "sem telefone"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                <EntityAvatar
                  imageUrl={appt.barbers?.avatar_url}
                  name={appt.barbers?.name}
                  entityType="professional"
                  size={18}
                />
                {appt.barbers?.name || "Sem profissional"}
              </span>
              <Badge
                variant="secondary"
                className={cn("border text-[11px] font-semibold", STATUS_CLASS[status] || "")}
              >
                {STATUS_LABEL[status] || status}
              </Badge>
              {appt.source && (
                <Badge variant="outline" className="text-[11px] capitalize border-white/10 text-zinc-300">
                  {appt.source === "walkin" ? "Walk-in" : appt.source}
                </Badge>
              )}
              {delay && (
                <span className={cn("text-[11px] font-medium", delay.tone)}>
                  {delay.label}
                </span>
              )}
            </div>
            {appt.notes && (
              <p className="mt-1 truncate text-[11px] italic text-zinc-400">
                {appt.notes}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["pending", "scheduled"].includes(appt.status) && (
            <Button 
              size="sm" 
              disabled={busy} 
              onClick={() => handleStatus(appt, "confirmed")}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs h-9"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden /> Confirmar
            </Button>
          )}
          {!appt.arrived_at && !["completed", "cancelled"].includes(appt.status) && (
            <Button 
              size="sm" 
              variant="outline" 
              disabled={busy} 
              onClick={() => handleCheckin(appt)}
              className="border-sky-500/40 text-sky-400 hover:bg-sky-500/10 font-semibold text-xs h-9"
            >
              <LogIn className="mr-1.5 h-4 w-4" aria-hidden /> Check-in
            </Button>
          )}
          {can("complete_appointment") && !["completed", "cancelled"].includes(appt.status) && (
            <Button 
              size="sm" 
              variant="outline" 
              disabled={busy} 
              onClick={() => handleStatus(appt, "completed")}
              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-semibold text-xs h-9"
            >
              <PlayCircle className="mr-1.5 h-4 w-4" aria-hidden /> Concluir
            </Button>
          )}
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setDetailsId(appt.id)}
            className="text-zinc-300 hover:text-white hover:bg-white/5 font-semibold text-xs h-9"
          >
            <Eye className="mr-1.5 h-4 w-4" aria-hidden /> Detalhes
          </Button>
          {!["completed", "cancelled"].includes(appt.status) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 font-semibold text-xs h-9"
              disabled={busy}
              onClick={() => {
                if (confirm("Cancelar este atendimento?")) handleStatus(appt, "cancelled");
              }}
            >
              <XCircle className="mr-1.5 h-4 w-4" aria-hidden /> Cancelar
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-5 pb-12 max-w-full overflow-x-hidden text-white">
      {/* Resumo Operacional */}
      <div className="relative overflow-hidden rounded-3xl border border-[#F59E0B]/15 bg-[#0B1220] p-5 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.25)]">
        <div className="relative flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-black shadow-[0_0_20px_rgba(245,197,66,0.35)]">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">
                {view === "day" ? "Agenda da Recepção (Dia)" : view === "week" ? "Agenda da Recepção (Semana)" : view === "month" ? "Agenda da Recepção (Mês)" : "Agenda da Recepção (Período Personalizado)"}
              </h1>
              {(isLoading || isRefreshing) && <Loader2 className="h-5 w-5 animate-spin text-gold/60" />}
            </div>
            <p className="text-zinc-400 text-xs font-medium mt-2">
              <span className="text-white font-bold">{filteredAppointments.length}</span> atendimentos • R$ {activeRevenue.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Seletores de Modo de Visualização e Botões de Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center bg-[#05070D] p-1 rounded-2xl h-11 border border-white/5 w-full sm:w-auto">
          {(["day", "week", "month", "custom"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "flex-1 sm:px-4 h-full rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                view === v ? "bg-gold text-black shadow-md" : "text-zinc-400 hover:text-white"
              )}
            >
              {v === "day" ? "Dia" : v === "week" ? "Semana" : v === "month" ? "Mês" : "Período"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto shrink-0">
          <Button
            onClick={() => setApptOpen(true)}
            className="h-11 px-4 sm:px-5 rounded-xl bg-gold hover:bg-[#D4A017] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,197,66,0.2)] transition-all w-full sm:w-auto justify-center"
          >
            <CalendarPlus className="mr-1.5 h-4 w-4 shrink-0" /> Novo Agendamento
          </Button>
          <Button
            onClick={() => setWalkinOpen(true)}
            className="h-11 px-4 sm:px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all w-full sm:w-auto justify-center"
          >
            <Footprints className="mr-1.5 h-4 w-4 shrink-0" /> Walk-in
          </Button>
        </div>
      </div>

      {/* Barra de Filtros Avançados Compartilhada */}
      <AgendaFilters
        value={filters}
        onChange={setFilters}
        barbers={barbers}
        services={services}
        paymentMethods={paymentMethods}
        resultCount={filteredAppointments.length}
        barberLocked={false}
      />

      {/* Navegador de Período */}
      <div className="rounded-3xl border border-[#F59E0B]/15 bg-[#0B1220] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (view === "day") setCurrentDate(subDays(currentDate, 1));
                else if (view === "week") setCurrentDate(subDays(currentDate, 7));
                else if (view === "month") setCurrentDate(subMonths(currentDate, 1));
              }}
              disabled={view === "custom"}
              aria-label="Período anterior"
              className="rounded-2xl border-white/10 text-gold h-11 w-11 disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="rounded-xl border-white/10 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-gold hover:border-gold/30 h-11 px-3"
            >
              Hoje
            </Button>
          </div>

          <h3 className="font-black capitalize tracking-tight text-base sm:text-lg text-center truncate">
            {view === "day" && format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            {view === "week" && `Semana de ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "d 'de' MMMM", { locale: ptBR })}`}
            {view === "month" && format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
            {view === "custom" && `${format(parseISO(customStartDate), "dd/MM/yyyy")} até ${format(parseISO(customEndDate), "dd/MM/yyyy")}`}
          </h3>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (view === "day") setCurrentDate(addDays(currentDate, 1));
              else if (view === "week") setCurrentDate(addDays(currentDate, 7));
              else if (view === "month") setCurrentDate(addMonths(currentDate, 1));
            }}
            disabled={view === "custom"}
            aria-label="Próximo período"
            className="rounded-2xl border-white/10 text-gold h-11 w-11 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Controles do Modo Período Personalizado */}
        {view === "custom" && (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider mr-1">Atalhos:</span>
              <Button variant="ghost" size="sm" onClick={() => applyPreset("last7")} className="h-8 rounded-lg text-xs bg-white/5 hover:bg-gold/15 hover:text-gold">Últimos 7 dias</Button>
              <Button variant="ghost" size="sm" onClick={() => applyPreset("last30")} className="h-8 rounded-lg text-xs bg-white/5 hover:bg-gold/15 hover:text-gold">Últimos 30 dias</Button>
              <Button variant="ghost" size="sm" onClick={() => applyPreset("thisMonth")} className="h-8 rounded-lg text-xs bg-white/5 hover:bg-gold/15 hover:text-gold">Este Mês</Button>
              <Button variant="ghost" size="sm" onClick={() => applyPreset("lastMonth")} className="h-8 rounded-lg text-xs bg-white/5 hover:bg-gold/15 hover:text-gold">Mês Passado</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-400 mb-1 block">Data Inicial</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => handleCustomRangeChange(e.target.value, customEndDate)}
                  className="h-10 rounded-xl border-white/10 bg-[#05070D] text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-400 mb-1 block">Data Final</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => handleCustomRangeChange(customStartDate, e.target.value)}
                  className="h-10 rounded-xl border-white/10 bg-[#05070D] text-white"
                />
              </div>
            </div>
            {dateError && (
              <p className="text-xs text-red-400 font-bold bg-red-950/40 border border-red-800/40 p-2 rounded-lg">
                {dateError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo da Agenda por Modo */}
      {view === "month" ? (
        <MonthView
          month={currentDate}
          appointments={filteredAppointments}
          selectedDate={currentDate}
          onSelectDate={(d) => {
            setCurrentDate(d);
            setView("day");
          }}
          onView={(app) => {
            setDetailsId(app.id);
          }}
          onReschedule={(app) => {
            setRescheduleAppt(app);
            setRescheduleOpen(true);
          }}
        />
      ) : view === "day" ? (
        <div className="space-y-3">
          {filteredAppointments.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center bg-[#0b0f17] border-zinc-800/80 rounded-3xl">
              <Clock className="h-12 w-12 text-zinc-500/30" />
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                Nenhum atendimento encontrado para este dia com os filtros aplicados
              </p>
            </Card>
          ) : (
            filteredAppointments.map(renderAppointmentCard)
          )}
        </div>
      ) : (
        /* Visualização Semanal ou Período Personalizado Agrupado por Data */
        <div className="space-y-6">
          {appointmentsByDate.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center bg-[#0b0f17] border-zinc-800/80 rounded-3xl">
              <CalendarIcon className="h-12 w-12 text-zinc-500/30" />
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                Nenhum atendimento encontrado para o período selecionado
              </p>
            </Card>
          ) : (
            appointmentsByDate.map(([dateKey, dayAppts]) => {
              const dayDate = parseISO(dateKey);
              return (
                <div key={dateKey} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                    <h4 className="text-sm font-black capitalize text-gold tracking-wide">
                      {format(dayDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </h4>
                    <span className="text-xs text-zinc-400 font-semibold">
                      {dayAppts.length} {dayAppts.length === 1 ? "atendimento" : "atendimentos"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {dayAppts.map(renderAppointmentCard)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modais Operacionais Preservados */}
      <AppointmentModal
        open={apptOpen}
        onOpenChange={setApptOpen}
        initialDate={format(currentDate, "yyyy-MM-dd")}
        onSuccess={() => {
          invalidateAllAppointmentQueries(queryClient, { tenantId });
          fetchData();
        }}
      />
      <WalkinModal
        open={walkinOpen}
        onOpenChange={setWalkinOpen}
        onSuccess={() => {
          invalidateAllAppointmentQueries(queryClient, { tenantId });
          fetchData();
        }}
      />
      <AppointmentDetailsModal
        appointmentId={detailsId || undefined}
        open={!!detailsId}
        onOpenChange={(v) => !v && setDetailsId(null)}
        onSuccess={() => {
          invalidateAllAppointmentQueries(queryClient, { tenantId });
          fetchData();
        }}
      />
      <RescheduleWizard
        appointment={rescheduleAppt}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        onSuccess={() => {
          invalidateAllAppointmentQueries(queryClient, { tenantId });
          fetchData();
        }}
      />
    </div>
  );
}
