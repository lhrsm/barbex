import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, CalendarCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  step: number;
  isLoading: boolean;
  onBack: () => void;
  onNext: () => void;
  onConfirm: () => void;
  isEditing?: boolean;
}

export function AppointmentModalFooter({
  step,
  isLoading,
  onBack,
  onNext,
  onConfirm,
  isEditing,
}: Props) {
  const isLast = step === 4;
  return (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      {step > 1 ? (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="h-10 w-full rounded-xl border-zinc-200 bg-white font-bold text-zinc-700 hover:bg-zinc-100 sm:w-auto text-xs transition-colors"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4 text-zinc-500" />
          Voltar
        </Button>
      ) : (
        <span className="hidden sm:block" />
      )}

      <Button
        type="button"
        onClick={isLast ? onConfirm : onNext}
        disabled={isLoading}
        className={cn(
          "h-10 w-full rounded-xl font-bold uppercase tracking-wider text-xs shadow-xs transition-all disabled:opacity-50 sm:w-auto",
          isLast
            ? "bg-gold text-black hover:bg-gold-500 shadow-sm"
            : "bg-black text-white hover:bg-zinc-800",
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            {isLast ? (isEditing ? "Salvando..." : "Criando agendamento...") : "Validando..."}
          </>
        ) : isLast ? (
          <>
            <CalendarCheck className="mr-1.5 h-4 w-4" />
            {isEditing ? "Salvar agendamento" : "Confirmar agendamento"}
          </>
        ) : (
          <>
            Continuar
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
