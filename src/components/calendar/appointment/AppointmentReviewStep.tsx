import { format, parseISO, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, MapPin, Pencil, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityAvatar } from "./EntityAvatar";
import { AppointmentFinancialSummary } from "./AppointmentFinancialSummary";
import { PaymentSelector } from "./PaymentSelector";
import { resolveImageUrl, formatBRL, type FinancialBreakdown } from "./appointment-utils";

interface Props {
  barber: any;
  customer: any;
  service: any;
  selectedDate: string;
  selectedTime: string;
  shopName?: string | null;
  breakdown: FinancialBreakdown;
  paymentStatus: string;
  paymentMethod: string;
  onPaymentStatusChange: (v: string) => void;
  onPaymentMethodChange: (v: string) => void;
  mixedCredits: string;
  mixedOther: string;
  onMixedCreditsChange: (v: string) => void;
  onMixedOtherChange: (v: string) => void;
  onEditStep: (step: number) => void;
  errors: Record<string, string | null>;
}

export function AppointmentReviewStep({
  barber,
  customer,
  service,
  selectedDate,
  selectedTime,
  shopName,
  breakdown,
  paymentStatus,
  paymentMethod,
  onPaymentStatusChange,
  onPaymentMethodChange,
  mixedCredits,
  mixedOther,
  onMixedCreditsChange,
  onMixedOtherChange,
  onEditStep,
  errors,
}: Props) {
  const start = selectedDate && selectedTime ? parseISO(`${selectedDate}T${selectedTime}:00`) : null;
  const end = start && service ? addMinutes(start, service.duration_minutes || 30) : null;

  return (
    <div className="animate-in fade-in slide-in-from-right-2 space-y-4 duration-300">
      <div>
        <h2 className="text-base font-black uppercase tracking-tight text-zinc-900">
          Resumo do agendamento
        </h2>
        <p className="text-xs text-zinc-500">Confira todos os dados antes de confirmar o horário.</p>
      </div>

      <div className="space-y-3.5">
        {/* Card 1: Profissional & Serviço */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <EntityAvatar
                imageUrl={resolveImageUrl(barber)}
                name={barber?.name}
                entityType="professional"
                size={44}
                showStatus
                active={barber?.active !== false}
              />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Profissional
                </p>
                <p className="truncate text-sm font-black text-zinc-900">{barber?.name || "—"}</p>
                <p className="truncate text-xs font-medium text-zinc-500">
                  {barber?.category || "Barbeiro"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEditStep(1)}
              className="h-7 shrink-0 rounded-lg border-zinc-200/80 bg-zinc-50 px-2.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100 transition-colors shadow-xs"
            >
              <Pencil className="mr-1 h-3 w-3 text-zinc-400" />
              Alterar
            </Button>
          </div>

          <div className="border-t border-zinc-100 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <Scissors className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-zinc-900">{service?.name || "—"}</p>
                  <p className="text-xs text-zinc-500 font-medium">
                    {service?.duration_minutes ? `${service.duration_minutes} min` : "—"}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-sm font-black text-zinc-900 tabular-nums">
                {service?.price !== undefined ? formatBRL(Number(service.price)) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Data, Horário e Local */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Data e Horário
                </p>
                <p className="truncate text-sm font-black text-zinc-900">
                  {selectedDate
                    ? format(parseISO(`${selectedDate}T12:00:00`), "dd 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })
                    : "—"}
                </p>
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-zinc-400" />
                    {selectedTime || "—"}
                    {end && ` às ${format(end, "HH:mm")}`}
                  </span>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEditStep(2)}
              className="h-7 shrink-0 rounded-lg border-zinc-200/80 bg-zinc-50 px-2.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100 transition-colors shadow-xs"
            >
              <Pencil className="mr-1 h-3 w-3 text-zinc-400" />
              Alterar
            </Button>
          </div>

          {shopName && (
            <div className="border-t border-zinc-100 pt-2 flex items-center gap-2 text-xs text-zinc-500 font-medium">
              <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">{shopName}</span>
            </div>
          )}
        </div>

        {/* Card 3: Cliente */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <EntityAvatar
                imageUrl={resolveImageUrl(customer)}
                name={customer?.name}
                entityType="customer"
                size={44}
              />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Cliente
                </p>
                <p className="truncate text-sm font-black text-zinc-900">{customer?.name || "—"}</p>
                <p className="truncate text-xs font-medium text-zinc-600">
                  {customer?.phone || "Sem telefone cadastrado"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEditStep(3)}
              className="h-7 shrink-0 rounded-lg border-zinc-200/80 bg-zinc-50 px-2.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100 transition-colors shadow-xs"
            >
              <Pencil className="mr-1 h-3 w-3 text-zinc-400" />
              Alterar
            </Button>
          </div>
        </div>

        {/* Card 4: Resumo Financeiro */}
        <AppointmentFinancialSummary breakdown={breakdown} />

        {/* Card 5: Pagamento */}
        <PaymentSelector
          status={paymentStatus}
          method={paymentMethod}
          onStatusChange={onPaymentStatusChange}
          onMethodChange={onPaymentMethodChange}
          mixedCredits={mixedCredits}
          mixedOther={mixedOther}
          onMixedCreditsChange={onMixedCreditsChange}
          onMixedOtherChange={onMixedOtherChange}
          total={breakdown.total}
          methodError={errors.paymentMethod}
          mixedError={errors.mixed}
        />
      </div>
    </div>
  );
}
