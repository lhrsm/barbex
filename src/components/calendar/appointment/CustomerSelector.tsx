import * as React from "react";
import { ChevronsUpDown, Search, Check, UserPlus, Crown, Pencil, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityAvatar } from "./EntityAvatar";
import { resolveImageUrl, formatBRL } from "./appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  customers: any[];
  value: string;
  onChange: (id: string) => void;
  onCreateNew: () => void;
  error?: string | null;
}

export function CustomerSelector({ customers, value, onChange, onCreateNew, error }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = customers.find((c) => c.id === value);

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 60);
    return customers
      .filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [customers, query]);

  // Keep highlighted item visible
  React.useEffect(() => {
    if (open && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, open]);

  // Reset highlight and query when opening/closing
  React.useEffect(() => {
    if (open) {
      const currentIndex = list.findIndex((c) => c.id === value);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open, list, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < list.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : list.length - 1));
    } else if (e.key === "Enter" && list[highlightedIndex]) {
      e.preventDefault();
      onChange(list[highlightedIndex].id);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
          Cliente
        </label>
        <Button
          type="button"
          onClick={onCreateNew}
          className="h-8 gap-1.5 rounded-xl bg-gold text-black font-bold text-xs hover:bg-gold-500 shadow-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-gold/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UserPlus className="h-3.5 w-3.5 stroke-[2.5]" />
          Novo cliente
        </Button>
      </div>

      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Buscar e selecionar cliente"
            aria-expanded={open}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 shadow-xs cursor-pointer",
              error
                ? "border-destructive/60 bg-red-50/30 text-destructive"
                : open
                ? "border-gold/60 bg-gold/5 ring-1 ring-gold/20 text-zinc-900"
                : "border-zinc-200/90 bg-zinc-50/70 hover:bg-zinc-100/70 hover:border-zinc-300 text-zinc-900",
            )}
          >
            <EntityAvatar
              imageUrl={selected ? resolveImageUrl(selected) : null}
              name={selected?.name}
              entityType="customer"
              size={44}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-zinc-900">
                {selected?.name || "Buscar por nome, telefone ou e-mail"}
              </span>
              <span className="block truncate text-xs text-zinc-500 font-medium">
                {selected?.phone || "Nenhum cliente selecionado"}
              </span>
            </span>
            {selected ? (
              <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200/80 transition-colors">
                <Pencil className="h-3 w-3 text-zinc-500" /> Alterar
              </span>
            ) : (
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-400" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          avoidCollisions={true}
          collisionPadding={12}
          className="w-[--radix-popover-trigger-width] min-w-[280px] max-w-[calc(100vw-32px)] p-0 bg-white border border-zinc-200/90 rounded-2xl shadow-2xl z-[60] overflow-hidden text-zinc-900"
        >
          <div className="flex items-center gap-2.5 border-b border-zinc-200/80 px-3.5 py-2 bg-zinc-50/80 focus-within:bg-white focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/30 transition-all">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Buscar por nome, telefone ou e-mail..."
              aria-label="Buscar cliente"
              className="h-8 w-full border-0 bg-transparent p-0 text-xs font-semibold text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md transition-colors cursor-pointer"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div
            ref={listRef}
            className="max-h-[min(300px,calc(var(--radix-popover-content-available-height,300px)-52px))] overflow-y-auto overscroll-contain p-1.5 custom-scrollbar"
            style={{ WebkitOverflowScrolling: "touch" }}
            onWheel={(e) => e.stopPropagation()}
          >
            {list.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs font-medium text-zinc-500">
                Nenhum cliente encontrado{query ? ` para "${query}"` : ""}.
              </div>
            ) : (
              list.map((c, index) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer select-none outline-none",
                    value === c.id
                      ? "bg-gold/10 text-gold-950 font-bold"
                      : highlightedIndex === index
                      ? "bg-zinc-100 text-zinc-900"
                      : "hover:bg-zinc-50 text-zinc-800",
                  )}
                >
                  <EntityAvatar
                    imageUrl={resolveImageUrl(c)}
                    name={c.name}
                    entityType="customer"
                    size={40}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-zinc-900">{c.name}</span>
                      {c.is_subscriber && (
                        <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Assinante" />
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-500 font-medium">
                      {c.phone || c.email || "Sem contato"}
                    </span>
                    <span className="block truncate text-[10px] text-zinc-400">
                      Créditos: {formatBRL(Number(c.credits ?? c.credit_balance ?? 0))} · Cashback:{" "}
                      {formatBRL(Number(c.cashback_balance || 0))}
                    </span>
                  </span>
                  {value === c.id && <Check className="h-4 w-4 shrink-0 text-gold" />}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
