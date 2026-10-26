import { formatBRL, type FinancialBreakdown } from "./appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  breakdown: FinancialBreakdown;
  className?: string;
}

function Row({
  label,
  value,
  negative,
  strong,
}: {
  label: string;
  value: string;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={cn(strong ? "text-sm font-black text-zinc-900" : "text-sm text-zinc-600")}>
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-bold tabular-nums text-right",
          strong ? "text-lg font-black text-zinc-950" : "text-zinc-900",
          negative && "text-emerald-700 font-bold",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function AppointmentFinancialSummary({ breakdown, className }: Props) {
  const b = breakdown;
  return (
    <section
      className={cn("rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs", className)}
      aria-label="Resumo financeiro"
    >
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
        Resumo financeiro
      </h3>
      <div className="divide-y divide-zinc-100">
        <Row label="Valor do serviço" value={formatBRL(b.servicePrice)} />
        {b.products > 0 && <Row label="Produtos" value={formatBRL(b.products)} />}
        {b.extras > 0 && <Row label="Adicionais" value={formatBRL(b.extras)} />}
        {b.discounts > 0 && (
          <Row label="Descontos" value={`-${formatBRL(b.discounts)}`} negative />
        )}
        {b.creditsUsed > 0 && (
          <Row
            label="Créditos utilizados"
            value={`-${formatBRL(b.creditsUsed)}`}
            negative
          />
        )}
        {b.cashbackUsed > 0 && (
          <Row
            label="Cashback utilizado"
            value={`-${formatBRL(b.cashbackUsed)}`}
            negative
          />
        )}
        <div className="pt-2 mt-1 border-t border-zinc-200">
          <Row label="Total do atendimento" value={formatBRL(b.total)} strong />
        </div>
      </div>
    </section>
  );
}
