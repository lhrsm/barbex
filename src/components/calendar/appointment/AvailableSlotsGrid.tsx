import { Check, Lock, Sun, Sunset, Moon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Slot } from "./appointment-utils";
import { cn } from "@/lib/utils";

const PERIOD_CONFIG: Record<Slot["period"], { label: string; icon: any }> = {
  morning: { label: "Manhã", icon: Sun },
  afternoon: { label: "Tarde", icon: Sunset },
  evening: { label: "Noite", icon: Moon },
};

interface Props {
  slots: Slot[];
  value: string;
  onSelect: (time: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function AvailableSlotsGrid({ slots, value, onSelect, loading, error }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-zinc-100 border border-zinc-200/60" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-6 text-center text-sm font-medium text-zinc-500">
        Nenhum horário configurado para este profissional nesta data.
      </p>
    );
  }

  const periods: Slot["period"][] = ["morning", "afternoon", "evening"];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {periods.map((p) => {
          const group = slots.filter((s) => s.period === p);
          if (group.length === 0) return null;
          const { label, icon: Icon } = PERIOD_CONFIG[p];
          return (
            <div key={p} className="space-y-2">
              <div className="flex items-center gap-1.5 px-0.5">
                <Icon className="h-3.5 w-3.5 text-zinc-400" />
                <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  {label}
                </h4>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.map((slot) => {
                  const disabled = slot.state !== "available";
                  const selected = value === slot.time;
                  const tip =
                    slot.state === "busy"
                      ? "Já existe um atendimento neste período"
                      : slot.state === "overflow"
                        ? "O serviço ultrapassa o fim do expediente"
                        : slot.state === "past"
                          ? "Horário já passou"
                          : null;

                  const btn = (
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      aria-label={`Horário ${slot.time}${tip ? ` — ${tip}` : ""}`}
                      onClick={() => onSelect(slot.time)}
                      className={cn(
                        "flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 cursor-pointer shadow-xs",
                        selected
                          ? "border-gold bg-gold text-black shadow-sm ring-2 ring-gold/20"
                          : disabled
                            ? "cursor-not-allowed border-zinc-200/60 bg-zinc-100/60 text-zinc-400 opacity-60 line-through"
                            : "border-zinc-200/90 bg-zinc-50/70 hover:bg-zinc-100/90 hover:border-zinc-300 text-zinc-900",
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      {disabled && !selected && <Lock className="h-3 w-3 text-zinc-400" />}
                      {slot.time}
                    </button>
                  );

                  return tip ? (
                    <Tooltip key={slot.time}>
                      <TooltipTrigger asChild>
                        <span className="block">{btn}</span>
                      </TooltipTrigger>
                      <TooltipContent className="bg-zinc-900 text-white text-xs rounded-lg py-1 px-2.5 shadow-xl">
                        {tip}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span key={slot.time} className="block">
                      {btn}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    </TooltipProvider>
  );
}
