import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "./appointment-utils";
import { cn } from "@/lib/utils";

export const PAYMENT_STATUSES = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
];

export const PAYMENT_METHODS = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "card", label: "Cartão" },
  { value: "wallet", label: "Créditos do cliente" },
];

interface Props {
  status: string;
  method: string;
  onStatusChange: (v: string) => void;
  onMethodChange: (v: string) => void;
  mixedCredits: string;
  mixedOther: string;
  onMixedCreditsChange: (v: string) => void;
  onMixedOtherChange: (v: string) => void;
  total: number;
  methodError?: string | null;
  mixedError?: string | null;
}

export function PaymentSelector({
  status,
  method,
  onStatusChange,
  onMethodChange,
  mixedCredits,
  mixedOther,
  onMixedCreditsChange,
  onMixedOtherChange,
  total,
  methodError,
  mixedError,
}: Props) {
  const sum = Number(mixedCredits || 0) + Number(mixedOther || 0);
  const matches = Math.abs(sum - total) < 0.01;

  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs" aria-label="Pagamento">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Pagamento</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="payment-status" className="text-xs font-semibold text-zinc-600">
            Status do pagamento
          </Label>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger
              id="payment-status"
              className="rounded-xl border-zinc-200/90 bg-zinc-50/70 hover:bg-zinc-100 text-zinc-900 font-semibold h-10 shadow-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-zinc-200/90 text-zinc-900 rounded-xl shadow-xl z-[70]">
              {PAYMENT_STATUSES.map((s) => (
                <SelectItem
                  key={s.value}
                  value={s.value}
                  className="text-zinc-900 hover:bg-zinc-100 focus:bg-zinc-100 cursor-pointer font-medium"
                >
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment-method" className="text-xs font-semibold text-zinc-600">
            Forma de pagamento
          </Label>
          <Select value={method} onValueChange={onMethodChange}>
            <SelectTrigger
              id="payment-method"
              className={cn(
                "rounded-xl border-zinc-200/90 bg-zinc-50/70 hover:bg-zinc-100 text-zinc-900 font-semibold h-10 shadow-xs",
                methodError && "border-destructive text-destructive",
              )}
            >
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="bg-white border-zinc-200/90 text-zinc-900 rounded-xl shadow-xl z-[70]">
              {PAYMENT_METHODS.map((m) => (
                <SelectItem
                  key={m.value}
                  value={m.value}
                  className="text-zinc-900 hover:bg-zinc-100 focus:bg-zinc-100 cursor-pointer font-medium"
                >
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {methodError && <p className="text-xs font-medium text-destructive">{methodError}</p>}
        </div>
      </div>

      {method === "mixed" && (
        <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mixed-credits" className="text-xs font-semibold text-zinc-600">
                Créditos
              </Label>
              <Input
                id="mixed-credits"
                type="number"
                step="0.01"
                min="0"
                value={mixedCredits}
                onChange={(e) => onMixedCreditsChange(e.target.value)}
                className="h-10 rounded-xl border-zinc-200/90 bg-white text-zinc-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mixed-other" className="text-xs font-semibold text-zinc-600">
                Demais formas
              </Label>
              <Input
                id="mixed-other"
                type="number"
                step="0.01"
                min="0"
                value={mixedOther}
                onChange={(e) => onMixedOtherChange(e.target.value)}
                className="h-10 rounded-xl border-zinc-200/90 bg-white text-zinc-900"
              />
            </div>
          </div>
          <p
            className={cn(
              "text-xs font-bold pt-1",
              matches ? "text-emerald-700" : "text-destructive",
            )}
          >
            Soma: {formatBRL(sum)} / Total: {formatBRL(total)}
          </p>
          {mixedError && <p className="text-xs font-medium text-destructive">{mixedError}</p>}
        </div>
      )}
    </section>
  );
}
