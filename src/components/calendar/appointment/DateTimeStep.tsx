import * as React from "react";
import { format, addDays, parseISO, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { EntityAvatar } from "./EntityAvatar";
import { AvailableSlotsGrid } from "./AvailableSlotsGrid";
import { resolveImageUrl, type Slot } from "./appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  barber: any;
  service: any;
  selectedDate: string;
  selectedTime: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  slots: Slot[];
  slotsLoading: boolean;
  isDayEnabled: (date: Date) => boolean;
  nextAvailableDate: string | null;
  errors: Record<string, string | null>;
}

export function DateTimeStep({
  barber,
  service,
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  slots,
  slotsLoading,
  isDayEnabled,
  nextAvailableDate,
  errors,
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = selectedDate ? parseISO(`${selectedDate}T12:00:00`) : undefined;

  const endsAt =
    selectedTime && service?.duration_minutes
      ? format(
          addMinutes(parseISO(`${selectedDate}T${selectedTime}:00`), service.duration_minutes),
          "HH:mm",
        )
      : null;

  const shortcuts = [
    { label: "Hoje", date: format(new Date(), "yyyy-MM-dd") },
    { label: "Amanhã", date: format(addDays(new Date(), 1), "yyyy-MM-dd") },
    ...(nextAvailableDate ? [{ label: "Próximo dia disponível", date: nextAvailableDate }] : []),
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-2 space-y-4 duration-300">
      {/* Pill do Profissional selecionado */}
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/70 p-3 shadow-xs">
        <EntityAvatar
          imageUrl={resolveImageUrl(barber)}
          name={barber?.name}
          entityType="professional"
          size={38}
          showStatus
          active={barber?.active !== false}
        />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Agenda do Profissional
          </p>
          <p className="min-w-0 truncate text-sm font-black text-zinc-900">
            {barber?.name || "Profissional"}
          </p>
        </div>
      </div>

      {/* Atalhos rápidos de data */}
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((s) => (
          <Button
            key={s.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDateChange(s.date)}
            className={cn(
              "h-8 rounded-full text-xs font-bold transition-all px-3 cursor-pointer",
              selectedDate === s.date
                ? "border-gold bg-gold/15 text-zinc-950 ring-1 ring-gold/30 shadow-xs"
                : "border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {/* Calendário Claro com Alto Contraste */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-xs overflow-hidden">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          onSelect={(d) => d && onDateChange(format(d, "yyyy-MM-dd"))}
          disabled={(date) => date < today || !isDayEnabled(date)}
          className="w-full bg-white text-zinc-900 p-0"
          classNames={{
            root: "w-full bg-white text-zinc-900",
            months: "w-full",
            month: "w-full space-y-3",
            month_caption: "flex justify-center items-center h-8 text-zinc-900 font-black text-sm capitalize",
            caption_label: "text-zinc-900 font-black text-sm capitalize",
            nav: "flex items-center justify-between w-full absolute top-0 inset-x-0 px-1 z-10",
            button_previous: "h-7 w-7 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200/60 bg-white",
            button_next: "h-7 w-7 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200/60 bg-white",
            table: "w-full border-collapse",
            weekdays: "flex w-full justify-between mb-1 border-b border-zinc-100 pb-1.5",
            weekday: "text-zinc-400 font-bold text-[11px] uppercase flex-1 text-center",
            week: "flex w-full justify-between mt-1",
            day: "flex-1 text-center p-0 relative",
            today: "border border-gold text-zinc-950 font-black rounded-xl",
            outside: "text-zinc-300 opacity-40 pointer-events-none",
            disabled: "text-zinc-300 opacity-30 cursor-not-allowed pointer-events-none line-through",
          }}
        />
      </div>
      {errors.date && <p className="text-xs font-medium text-destructive">{errors.date}</p>}

      {/* Horários disponíveis */}
      <div className="space-y-2 pt-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
          Horários disponíveis
        </h3>
        <AvailableSlotsGrid
          slots={slots}
          value={selectedTime}
          onSelect={onTimeChange}
          loading={slotsLoading}
          error={errors.time}
        />
      </div>

      {/* Resumo do serviço */}
      {service && (
        <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/70 p-3.5 text-sm shadow-xs space-y-1">
          <p className="text-zinc-500">
            Serviço selecionado:{" "}
            <span className="font-bold text-zinc-900">{service.name}</span>
          </p>
          <p className="text-zinc-500">
            Duração: <span className="font-bold text-zinc-900">{service.duration_minutes} minutos</span>
          </p>
          {endsAt && (
            <p className="text-zinc-500">
              Término previsto: <span className="font-bold text-zinc-900">{endsAt}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
