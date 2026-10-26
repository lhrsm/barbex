import * as React from "react";
import { ChevronsUpDown, Search, Check, Scissors, Clock, Pencil, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { formatBRL } from "./appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  services: any[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  error?: string | null;
  warning?: string | null;
}

export function ServiceSelector({ services, value, onChange, disabled, error, warning }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = services.find((s) => s.id === value);

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.category || "").toLowerCase().includes(q),
    );
  }, [services, query]);

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
      const currentIndex = list.findIndex((s) => s.id === value);
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
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
        Serviço
      </label>

      <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)} modal={true}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Selecionar serviço"
            aria-expanded={open}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 shadow-xs",
              disabled
                ? "cursor-not-allowed opacity-50 bg-zinc-100/60 border-zinc-200 text-zinc-400"
                : error
                ? "border-destructive/60 bg-red-50/30 text-destructive cursor-pointer"
                : open
                ? "border-gold/60 bg-gold/5 ring-1 ring-gold/20 text-zinc-900 cursor-pointer"
                : "border-zinc-200/90 bg-zinc-50/70 hover:bg-zinc-100/70 hover:border-zinc-300 text-zinc-900 cursor-pointer",
            )}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
              <Scissors className="h-5 w-5" />
            </span>
            {selected ? (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-zinc-900">
                    {selected.name}
                  </span>
                  <span className="block truncate text-xs text-zinc-500 font-medium">
                    {selected.duration_minutes} min · {formatBRL(Number(selected.price || 0))}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200/80 transition-colors">
                  <Pencil className="h-3 w-3 text-zinc-500" /> Alterar
                </span>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-zinc-500">
                  {disabled
                    ? "Selecione o profissional primeiro"
                    : services.length > 0
                    ? "Selecione o serviço"
                    : "Nenhum serviço vinculado a este profissional"}
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-400" />
              </>
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
          <div className="flex items-center gap-2.5 border-b border-zinc-100 px-3.5 py-2.5 bg-zinc-50/70">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Buscar serviço..."
              aria-label="Buscar serviço"
              className="h-8 border-0 bg-transparent p-0 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-0 shadow-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded transition-colors"
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
                Nenhum serviço encontrado{query ? ` para "${query}"` : ""}.
              </div>
            ) : (
              list.map((s, index) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer select-none outline-none",
                    value === s.id
                      ? "bg-gold/10 text-gold-950 font-bold"
                      : highlightedIndex === index
                      ? "bg-zinc-100 text-zinc-900"
                      : "hover:bg-zinc-50 text-zinc-800",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-zinc-900">
                      {s.name}
                    </span>
                    {s.category && (
                      <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-gold">
                        {s.category}
                      </span>
                    )}
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
                      <Clock className="h-3 w-3 text-zinc-400" /> {s.duration_minutes} min
                    </span>
                    {s.description && (
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-400">
                        {s.description}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-zinc-900">
                    {formatBRL(Number(s.price || 0))}
                  </span>
                  {value === s.id && <Check className="ml-1 h-4 w-4 shrink-0 text-gold" />}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {warning && <p className="text-xs font-medium text-amber-600">{warning}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
