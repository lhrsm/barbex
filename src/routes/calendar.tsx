import * as React from "react";
import { memo } from "react";
import { 
  format, 
  addMinutes, 
  startOfHour, 
  parseISO, 
  isSameDay, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addDays, 
  subDays, 
  startOfDay, 
  endOfDay,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  differenceInDays,
  isValid
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon,
  Clock, 
  User, 
  Scissors, 
  X, 
  AlertTriangle, 
  Crown, 
  CheckCircle2, 
  RefreshCcw, 
  UserPlus, 
  HelpCircle, 
  Loader2,
  CalendarRange,
  CalendarDays,
  CalendarCheck
} from "lucide-react";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { WalkinModal } from "@/components/calendar/WalkinModal";
import { WalkinQueuePanel } from "@/components/calendar/WalkinQueuePanel";
import { RescheduleWizard } from "@/components/reschedule/RescheduleWizard";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { HelpDrawer } from "@/components/help-center/HelpDrawer";
import { GuidedTour } from "@/components/help-center/GuidedTour";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { triggerWhatsAppMessage } from "@/utils/whatsapp";

// Componentes da Agenda Avançada Multiperfil
import { 
  AgendaFilters, 
  EMPTY_FILTERS, 
  type AgendaFilterState, 
  applyAgendaFilters 
} from "@/components/calendar/agenda/AgendaFilters";
import { MonthView } from "@/components/calendar/agenda/MonthView";
import { getAgendaOrigin, getAgendaStatus, paymentLabel, barberColor } from "@/components/calendar/agenda/status";

const calendarHelpConfig = {
  moduleKey: 'calendar',
  routePath: '/calendar',
  title: 'Gestão da Agenda',
  summary: 'Visualize e gerencie todos os agendamentos da sua barbearia em tempo real.',
  videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  faqs: [
    { question: 'Como marcar um Walk-in?', answer: 'Clique no botão "+" no topo e escolha "Adicionar Fila de Espera".' },
    { question: 'Posso bloquear horários?', answer: 'Sim, clique no horário desejado e selecione "Bloquear Horário" para folgas ou manutenções.' }
  ],
  commonIssues: [
    { issue: 'Horário indisponível mas aparece livre', solution: 'Verifique se o profissional vinculado ao serviço possui escala definida para este dia.' }
  ]
};

function getCalendarStatusConfig(status: string) {
  const normalized = String(status || '').toLowerCase();

  if (['completed', 'concluido', 'concluído', 'done'].includes(normalized)) {
    return {
      label: 'Concluído',
      badge: 'bg-emerald-700/25 text-emerald-300 border-emerald-600/40',
      ring: 'border-emerald-600/30',
      dot: 'bg-emerald-500',
    };
  }
  if (['paid', 'pago'].includes(normalized)) {
    return {
      label: 'Pago',
      badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40',
      ring: 'border-emerald-400/30',
      dot: 'bg-emerald-400',
    };
  }
  if (['cancelled', 'canceled', 'cancelado'].includes(normalized)) {
    return {
      label: 'Cancelado',
      badge: 'bg-red-600/20 text-red-300 border-red-500/40',
      ring: 'border-red-500/30',
      dot: 'bg-red-500',
    };
  }
  if (['no_show', 'faltou', 'missed'].includes(normalized)) {
    return {
      label: 'Faltou',
      badge: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
      ring: 'border-slate-400/20',
      dot: 'bg-slate-400',
    };
  }
  if (['confirmed', 'confirmado'].includes(normalized)) {
    return {
      label: 'Confirmado',
      badge: 'bg-blue-600/20 text-blue-300 border-blue-500/40',
      ring: 'border-blue-500/30',
      dot: 'bg-blue-500',
    };
  }
  if (['rescheduled', 'reagendado'].includes(normalized)) {
    return {
      label: 'Reagendado',
      badge: 'bg-purple-600/20 text-purple-300 border-purple-500/40',
      ring: 'border-purple-500/30',
      dot: 'bg-purple-500',
    };
  }
  if (['awaiting_payment'].includes(normalized)) {
    return {
      label: 'Pgto Pendente',
      badge: 'bg-amber-600/20 text-amber-300 border-amber-500/40',
      ring: 'border-amber-500/30',
      dot: 'bg-amber-500',
    };
  }
  return {
    label: 'Agendado',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    ring: 'border-orange-500/30',
    dot: 'bg-orange-500',
  };
}

const calendarTourConfig = {
  key: 'calendar-tour',
  version: '1.0.0',
  steps: [
    {
      target: '[data-tour="calendar-view"]',
      title: 'A Agenda Principal',
      description: 'Aqui você vê todos os agendamentos organizados por profissional e horário.',
      position: 'bottom' as const
    },
    {
      target: '[data-tour="calendar-actions"]',
      title: 'Ações Rápidas',
      description: 'Use estes botões para criar agendamentos, check-ins ou gerenciar a fila de espera.',
      position: 'bottom' as const
    }
  ]
};

export type CalendarViewMode = "day" | "week" | "month" | "custom";

const CalendarComponent = memo(() => {
  const { user: authUser, loading: authLoading, role: authRole } = useAuth();
  const { tenantId } = useTenant();
  const { session, loading: profLoading } = useProfessionalAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const user = authUser || (session ? { id: session.barber_id, email: session.phone } : null);
  const role = authRole || (session ? 'barber' : null);
  const loading = authLoading || profLoading;

  const isBarberRole = role === 'barber';
  const barberTargetId = isBarberRole ? (user?.id || session?.barber_id) : null;

  const { checkLimit, limits, usage, refresh: refreshLimits } = usePlanLimits();

  // Estados dos Modos de Visualização e Filtros Avançados
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarViewMode>("day");
  const [customStartDate, setCustomStartDate] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateError, setDateError] = useState<string | null>(null);

  const [filters, setFilters] = useState<AgendaFilterState>(() => ({
    ...EMPTY_FILTERS,
    barberId: barberTargetId || "all"
  }));

  const [appointments, setAppointments] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isWalkinOpen, setIsWalkinOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<{date?: string, time?: string, step?: number, editingId?: string}>({});
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState<any>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  // Trava de perfil do Barbeiro
  useEffect(() => {
    if (isBarberRole && barberTargetId) {
      setFilters(prev => ({ ...prev, barberId: barberTargetId }));
    }
  }, [isBarberRole, barberTargetId]);

  const currentDateRef = useRef(currentDate);
  currentDateRef.current = currentDate;

  const viewRef = useRef(view);
  viewRef.current = view;

  const tenantIdRef = useRef(tenantId);
  tenantIdRef.current = tenantId;

  const userRef = useRef(user);
  userRef.current = user;

  const roleRef = useRef(role);
  roleRef.current = role;

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const customStartRef = useRef(customStartDate);
  customStartRef.current = customStartDate;

  const customEndRef = useRef(customEndDate);
  customEndRef.current = customEndDate;

  const latestFetchIdRef = useRef(0);

  const canAddAppointment = checkLimit("monthlyAppointments");

  useEffect(() => {
    if (!loading && !user) {
      console.warn('[AUTH_REDIRECT_TRACE]', 'No user found in CalendarComponent, redirecting to /auth', {
        pathname: window.location.pathname,
        timestamp: Date.now()
      });
      navigate({ to: "/auth" as any, replace: true });
      return;
    }

    if (!loading && user && role === 'super_admin') {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, loading, role, navigate]);

  const fetchData = useCallback(async () => {
    const curUser = userRef.current;
    const curTenant = tenantIdRef.current;
    const curRole = roleRef.current;
    const curDate = currentDateRef.current;
    const curView = viewRef.current;
    const curSession = sessionRef.current;

    if (!curUser || !curTenant) {
      console.log("[CALENDAR_BOOT_TRACE] No user or tenant, skipping fetchData");
      return;
    }

    const fetchId = ++latestFetchIdRef.current;
    const isInitial = !hasLoadedOnceRef.current;
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    console.log("[CALENDAR_BOOT_TRACE] Executing queries", { fetchId, isInitial, tenantId: curTenant, role: curRole, view: curView, date: curDate });

    let fetchSuccess = false;

    try {
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
        // Modo Período Personalizado
        const pStart = parseISO(customStartRef.current);
        const pEnd = parseISO(customEndRef.current);
        start = isValid(pStart) ? startOfDay(pStart) : startOfMonth(curDate);
        end = isValid(pEnd) ? endOfDay(pEnd) : endOfMonth(curDate);
      }

      let appQuery = supabase
        .from("appointments")
        .select("*, customers(*), services(*), barbers:barbers!appointments_barber_id_fkey(*)")
        .eq("tenant_id", curTenant)
        .in("status", ["scheduled", "confirmed", "completed", "cancelled", "no_show", "pending", "in_progress"])
        .gte("start_time", start.toISOString())
        .lte("start_time", end.toISOString());

      // Controle estrito de escopo multiperfil no banco: barbeiro só vê a si mesmo
      if (curRole === 'barber') {
        const targetId = curUser?.id || curSession?.barber_id;
        if (targetId) {
          appQuery = appQuery.eq('barber_id', targetId);
        }
      }

      const [appRes, barbRes, custRes, servRes] = await Promise.all([
        appQuery.order("start_time", { ascending: true }),
        supabase.from("barbers").select("*").eq("tenant_id", curTenant).order("name"),
        supabase.from("customers").select("*").eq("tenant_id", curTenant).order("name"),
        supabase.from("services").select("*").eq("tenant_id", curTenant).eq("active", true).order("name"),
      ]);

      if (fetchId !== latestFetchIdRef.current) {
        console.log("[CALENDAR_BOOT_TRACE] Stale response discarded", { fetchId, latest: latestFetchIdRef.current });
        return;
      }

      if (appRes.error) {
        console.error("[CALENDAR_SYNC_TRACE] Appointments fetch error:", appRes.error);
      } else if (appRes.data) {
        console.log("[CALENDAR_SYNC_TRACE] Refetch success, updating React state", {
          fetchId,
          returnedCount: appRes.data.length,
          tenantId: curTenant
        });
        setAppointments(appRes.data);
        fetchSuccess = true;
      }

      if (barbRes.data) setBarbers(barbRes.data);
      if (custRes.data) setCustomers(custRes.data);
      if (servRes.data) setServices(servRes.data);
    } catch (err) {
      console.error("[CALENDAR_BOOT_TRACE] Crash in fetchData:", err);
    } finally {
      if (fetchId === latestFetchIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
        if (fetchSuccess) {
          hasLoadedOnceRef.current = true;
        }
      }
    }
  }, []);

  const calendarDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedFetchData = useCallback((source?: string) => {
    console.log("[CALENDAR_SYNC_TRACE] Debounced refetch requested", { source: source || 'unknown' });
    if (calendarDebounceRef.current) {
      clearTimeout(calendarDebounceRef.current);
    }
    calendarDebounceRef.current = setTimeout(() => {
      console.log("[CALENDAR_SYNC_TRACE] Debounce timer fired, invoking fetchData");
      fetchData();
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    }, 100);
  }, [fetchData, queryClient]);

  useEffect(() => {
    fetchData();
  }, [user, currentDate, view, tenantId, customStartDate, customEndDate, fetchData]);

  useEffect(() => {
    if (!tenantId) return;

    const channelTopic = `calendar-realtime-${tenantId}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          debouncedFetchData('realtime:appointments');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointment_checkins', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          debouncedFetchData('realtime:checkins');
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          debouncedFetchData(`recovery:${status}`);
        }
      });

    const handleWindowRefresh = () => {
      debouncedFetchData('window:event');
    };

    window.addEventListener('REFRESH_APPOINTMENTS_DATA', handleWindowRefresh);

    return () => {
      if (calendarDebounceRef.current) {
        clearTimeout(calendarDebounceRef.current);
      }
      supabase.removeChannel(channel);
      window.removeEventListener('REFRESH_APPOINTMENTS_DATA', handleWindowRefresh);
    };
  }, [tenantId, debouncedFetchData, user, role]);

  // Aplicação puramente client-side dos filtros sobre o período carregado
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

  const isToday = isSameDay(currentDate, new Date());
  const activeApps = view === 'day' 
    ? filteredAppointments.filter(a => isSameDay(new Date(a.start_time), currentDate))
    : filteredAppointments;
  const activeRevenue = useMemo(() => activeApps.reduce((acc, a) => acc + Number(a.total_price || 0), 0), [activeApps]);

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

  if (loading && !user) {
    return (
      <AppLayout>
        <div className="flex flex-col h-full items-center justify-center min-h-[60vh] space-y-4 bg-[#05070d] p-8 text-white">
          <Loader2 className="h-10 w-10 text-gold animate-spin mb-4" />
          <p className="text-gold/60 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
            Carregando Agenda...
          </p>
        </div>
      </AppLayout>
    );
  }

  if (!loading && !user) {
    return null;
  }

  const openNewAppointment = (date?: Date, hour?: number) => {
    setModalInitialData({
      time: hour !== undefined ? `${hour.toString().padStart(2, '0')}:00` : undefined,
      date: date ? format(date, "yyyy-MM-dd") : undefined,
      step: 1,
      editingId: undefined,
    });
    setIsDialogOpen(true);
  };

  return (
    <AppLayout>
      <GuidedTour config={calendarTourConfig} />
      <div className="flex flex-col h-full space-y-4 bg-[#05070d] p-3 md:p-8 min-h-screen text-white max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gold">Agenda</h1>
            {(isLoading || isRefreshing) && <Loader2 className="h-5 w-5 animate-spin text-gold/40" />}
          </div>
          <HelpDrawer config={calendarHelpConfig} />
        </div>

        {!canAddAppointment && (
          <Alert className="bg-amber-950/30 border-amber-900/50 rounded-2xl">
            <Crown className="h-4 w-4 text-[#F5C542]" />
            <AlertTitle className="text-[#F5C542]">Limite de Agendamentos</AlertTitle>
            <AlertDescription className="flex items-center justify-between text-gray-400">
              Você atingiu o limite mensal de {limits.monthlyAppointments} agendamentos.
              <Button variant="link" size="sm" asChild className="p-0 h-auto text-[#F5C542] font-bold underline">
                <Link to="/subscription">Fazer Upgrade</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Card de Resumo Operacional */}
        <div className="relative overflow-hidden rounded-3xl border border-[#F59E0B]/15 bg-[#0B1220] p-5 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.25)]">
          <div className="relative flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-black shadow-[0_0_20px_rgba(245,197,66,0.35)]">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-black text-white tracking-tight">
                {view === 'day' ? "Agenda do Dia" : view === 'week' ? "Agenda da Semana" : view === 'month' ? "Agenda do Mês" : "Período Personalizado"}
              </h2>
              <p className="text-gray-400 text-xs font-medium mt-2">
                <span className="text-white font-bold">{activeApps.length}</span> atendimentos • R$ {activeRevenue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Seletores de Modo de Visualização e Botões de Ação */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex items-center bg-[#05070D] p-1 rounded-[18px] h-14 border border-white/5 w-full lg:w-auto">
            {(["day", "week", "month", "custom"] as const).map(v => (
              <button 
                key={v} 
                type="button"
                onClick={() => setView(v)} 
                className={cn(
                  "flex-1 sm:px-6 h-full rounded-[14px] text-xs font-black uppercase tracking-wider transition-all", 
                  view === v ? "bg-gold text-black shadow-lg" : "text-slate-400 hover:text-white"
                )}
              >
                {v === "day" ? "Dia" : v === "week" ? "Semana" : v === "month" ? "Mês" : "Período"}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-1">
            <Button onClick={() => openNewAppointment()} className="flex-1 h-14 rounded-[18px] bg-gold text-black font-black">
              <Plus className="mr-2 h-4 w-4" /> Novo Agendamento
            </Button>
            <Button onClick={() => setIsWalkinOpen(true)} className="flex-1 h-14 rounded-[18px] bg-emerald-600 hover:bg-emerald-500 text-white font-black">
              <UserPlus className="mr-2 h-4 w-4" /> Walk-in
            </Button>
          </div>
        </div>

        {/* Barra de Filtros Avançados Integrada */}
        <AgendaFilters
          value={filters}
          onChange={setFilters}
          barbers={barbers}
          services={services}
          paymentMethods={paymentMethods}
          resultCount={filteredAppointments.length}
          barberLocked={isBarberRole}
        />

        {/* Walk-in Queue Panel apenas no dia de hoje em modo Dia */}
        {isToday && view === 'day' && (
          <WalkinQueuePanel tenantId={tenantId} date={currentDate} refreshKey={appointments.length} onChange={() => fetchData()} />
        )}

        {/* Navegador de Período */}
        <div className="rounded-3xl border border-[#F59E0B]/15 bg-[#0B1220] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => {
                  if (view === 'day') setCurrentDate(subDays(currentDate, 1));
                  else if (view === 'week') setCurrentDate(subDays(currentDate, 7));
                  else if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
                }} 
                disabled={view === 'custom'}
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
              {view === 'day' && format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              {view === 'week' && `Semana de ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "d 'de' MMMM", { locale: ptBR })}`}
              {view === 'month' && format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
              {view === 'custom' && `${format(parseISO(customStartDate), "dd/MM/yyyy")} até ${format(parseISO(customEndDate), "dd/MM/yyyy")}`}
            </h3>

            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => {
                if (view === 'day') setCurrentDate(addDays(currentDate, 1));
                else if (view === 'week') setCurrentDate(addDays(currentDate, 7));
                else if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
              }} 
              disabled={view === 'custom'}
              aria-label="Próximo período"
              className="rounded-2xl border-white/10 text-gold h-11 w-11 disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Controles do Modo Período Personalizado */}
          {view === 'custom' && (
            <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Atalhos:</span>
                <Button variant="ghost" size="sm" onClick={() => applyPreset("last7")} className="h-8 rounded-lg text-xs bg-white/5 hover:bg-gold/15 hover:text-gold">Últimos 7 dias</Button>
                <Button variant="ghost" size="sm" onClick={() => applyPreset("last30")} className="h-8 rounded-lg text-xs bg-white/5 hover:bg-gold/15 hover:text-gold">Últimos 30 dias</Button>
                <Button variant="ghost" size="sm" onClick={() => applyPreset("thisMonth")} className="h-8 rounded-lg text-xs bg-white/5 hover:bg-gold/15 hover:text-gold">Este Mês</Button>
                <Button variant="ghost" size="sm" onClick={() => applyPreset("lastMonth")} className="h-8 rounded-lg text-xs bg-white/5 hover:bg-gold/15 hover:text-gold">Mês Passado</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400 mb-1 block">Data Inicial</Label>
                  <Input 
                    type="date" 
                    value={customStartDate} 
                    onChange={(e) => handleCustomRangeChange(e.target.value, customEndDate)}
                    className="h-10 rounded-xl border-white/10 bg-[#05070D] text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1 block">Data Final</Label>
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

        {/* Visualização de Conteúdo da Agenda */}
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
              setSelectedAppointmentId(app.id);
              setDetailsModalOpen(true);
            }}
            onReschedule={(app) => {
              setRescheduleAppt(app);
              setRescheduleOpen(true);
            }}
          />
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-4 pb-10">
              {filteredAppointments.length === 0 ? (
                <Card className="glass border-white/5 bg-[#0B1220] rounded-[32px] overflow-hidden">
                  <CardContent className="flex flex-col items-center justify-center py-20">
                    <CalendarIcon className="h-16 w-16 text-[#F59E0B]/20 mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">
                      Nenhum atendimento encontrado para os filtros selecionados
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {filteredAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      onClick={() => {
                        setSelectedAppointmentId(appt.id);
                        setDetailsModalOpen(true);
                      }}
                      className="group relative flex items-center gap-4 p-4 rounded-3xl border border-white/5 bg-[#0B1220] hover:bg-white/[0.04] transition-all cursor-pointer"
                    >
                      <div className="w-20 flex flex-col items-center justify-center border-r border-white/5 pr-3">
                        <span className="text-[11px] font-bold text-slate-400">
                          {format(new Date(appt.start_time), 'dd/MM')}
                        </span>
                        <span className="text-sm font-black text-white">
                          {format(new Date(appt.start_time), 'HH:mm')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-white italic uppercase tracking-tight truncate">
                            {appt.customers?.name || appt.customer_name || 'Cliente Final'}
                          </p>
                          {appt.total_price && (
                            <span className="text-xs font-bold text-gold shrink-0">
                              R$ {Number(appt.total_price).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-bold truncate">
                          {appt.services?.name || 'Serviço'} • {appt.barbers?.name || 'Profissional'}
                        </p>
                      </div>
                      <Badge className={cn("font-black uppercase text-[9px] shrink-0", getCalendarStatusConfig(appt.status).badge)}>
                        {getCalendarStatusConfig(appt.status).label}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Modais Operacionais Preservados */}
        <AppointmentModal 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen} 
          initialDate={modalInitialData.date} 
          initialTime={modalInitialData.time} 
          onSuccess={fetchData} 
        />
        <AppointmentDetailsModal 
          open={detailsModalOpen} 
          onOpenChange={setDetailsModalOpen} 
          appointmentId={selectedAppointmentId} 
          onSuccess={fetchData} 
          onReschedule={(appt) => { 
            setRescheduleAppt(appt); 
            setRescheduleOpen(true); 
          }} 
        />
        <WalkinModal 
          open={isWalkinOpen} 
          onOpenChange={setIsWalkinOpen} 
          onSuccess={fetchData} 
        />
        <RescheduleWizard 
          open={rescheduleOpen} 
          onOpenChange={setRescheduleOpen} 
          appointment={rescheduleAppt} 
          onSuccess={fetchData} 
          actor={role === "barber" ? "barber" : "admin"} 
          actorId={user?.id} 
          source="admin_calendar" 
        />
      </div>
    </AppLayout>
  );
});

export const Route = createFileRoute("/calendar")({
  component: () => <CalendarComponent />,
});
