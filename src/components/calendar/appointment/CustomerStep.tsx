import * as React from "react";
import { Crown, ExternalLink, Pencil, User } from "lucide-react";
import { CustomerSelector } from "./CustomerSelector";
import { EntityAvatar } from "./EntityAvatar";
import { resolveImageUrl, formatBRL } from "./appointment-utils";
import { Button } from "@/components/ui/button";

interface Props {
  customers: any[];
  selectedCustomer: string;
  onCustomerChange: (id: string) => void;
  onCreateNew: () => void;
  errors: Record<string, string | null>;
}

export function CustomerStep({
  customers,
  selectedCustomer,
  onCustomerChange,
  onCreateNew,
  errors,
}: Props) {
  const [isChanging, setIsChanging] = React.useState(false);
  const customer = customers.find((c) => c.id === selectedCustomer);

  // Se o cliente foi desmarcado externamente, garantir modo seletor
  React.useEffect(() => {
    if (!selectedCustomer) {
      setIsChanging(false);
    }
  }, [selectedCustomer]);

  return (
    <div className="animate-in fade-in slide-in-from-right-2 space-y-4 duration-300">
      {/* Quando nenhum cliente está selecionado OU o usuário clicou em 'Alterar cliente' */}
      {(!customer || isChanging) ? (
        <div className="space-y-3">
          {isChanging && customer && (
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Alterar cliente
              </span>
              <button
                type="button"
                onClick={() => setIsChanging(false)}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
          <CustomerSelector
            customers={customers}
            value={selectedCustomer}
            onChange={(id) => {
              onCustomerChange(id);
              setIsChanging(false);
            }}
            onCreateNew={onCreateNew}
            error={errors.customer}
          />
        </div>
      ) : (
        /* Cartão principal do cliente selecionado — sem duplicação */
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs space-y-4">
          <div className="flex items-start gap-3.5">
            <EntityAvatar
              imageUrl={resolveImageUrl(customer)}
              name={customer.name}
              entityType="customer"
              size={56}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-black text-zinc-900">{customer.name}</h3>
                {customer.is_subscriber && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                    <Crown className="h-3 w-3" /> Assinante
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-zinc-600 mt-0.5">
                {customer.phone || "Sem telefone cadastrado"}
              </p>
              {customer.email && (
                <p className="truncate text-xs text-zinc-500 mt-0.5">{customer.email}</p>
              )}
            </div>
          </div>

          {/* Créditos e cashback (quando aplicáveis) */}
          {(Number(customer.credits ?? customer.credit_balance ?? 0) > 0 ||
            Number(customer.cashback_balance || 0) > 0) && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-100">
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Créditos disponíveis
                </p>
                <p className="text-sm font-black text-zinc-900 mt-0.5">
                  {formatBRL(Number(customer.credits ?? customer.credit_balance ?? 0))}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Cashback disponível
                </p>
                <p className="text-sm font-black text-zinc-900 mt-0.5">
                  {formatBRL(Number(customer.cashback_balance || 0))}
                </p>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsChanging(true)}
              className="h-8 rounded-xl border-zinc-200/90 bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-zinc-800 transition-colors shadow-xs"
            >
              <Pencil className="mr-1.5 h-3 w-3 text-zinc-500" />
              Alterar cliente
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              asChild
              className="h-8 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            >
              <a href="/customers" target="_blank" rel="noreferrer">
                Visualizar perfil <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      )}
      {errors.customer && (
        <p className="text-xs font-medium text-destructive">{errors.customer}</p>
      )}
    </div>
  );
}
