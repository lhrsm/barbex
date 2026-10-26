import * as React from "react";
import { ChevronsUpDown, Search, Check, Pencil, X, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { EntityAvatar } from "./EntityAvatar";
import { resolveImageUrl } from "./appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  barbers: any[];
  value: string;
  onChange: (id: string) => void;
  error?: string | null;
}

export function ProfessionalSelector({ barbers, value, onChange, error }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = barbers.find((b) => b.id === value);

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return barbers;
    return barbers.filter((b) => {
      const nameMatch = (b.name || "").toLowerCase().includes(q);
      const catMatch = (b.category || "").toLowerCase().includes(q);
      const specMatch = Array.isArray(b.specialties) && b.specialties.some((s: string) => (s || "").toLowerCase().includes(q));
      return nameMatch || catMatch || specMatch;
    });
  }, [barbers, query]);

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
      const currentIndex = list.findIndex((b) => b.id === value);
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
        Profissional
      </label>

      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Selecionar profissional"
            aria-expanded={open}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 shadow-xs cursor-pointer",
              error
                ? "border-destructive/60 bg-red-50/30 text-destructive"
                : open
                ? "border-gold/60 bg-gold/5 ring-1 ring-gold/20"
                : "border-zinc-200/90 bg-zinc-50/70 hover:bg-zinc-100/70 hover:border-zinc-300 text-zinc-900",
            )}
          >
            {selected ? (
              <>
                <EntityAvatar
                  imageUrl={resolveImageUrl(selected)}
                  name={selected.name}
                  entityType="professional"
                  size={44}
                  showStatus
                  active={selected.active !== false}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-zinc-900">
                    {selected.name}
                  </span>
                  <span className="block truncate text-xs text-zinc-500 font-medium">
                    {selected.category || "Barbeiro"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200/80 transition-colors">
                  <Pencil className="h-3 w-3 text-zinc-500" /> Alterar
                </span>
              </>
            ) : (
              <>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-200/70 text-zinc-400">
                  <User className="h-5 w-5" />
                </div>
                <span className="flex-1 text-sm font-medium text-zinc-500">
                  Selecione o profissional
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
          {/* Campo de Busca */}
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
              placeholder="Buscar profissional por nome..."
              aria-label="Buscar profissional"
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

          {/* Lista com Rolagem Própria e Altura Limitada Dinâmica */}
          <div
            ref={listRef}
            className="max-h-[min(300px,calc(var(--radix-popover-content-available-height,300px)-52px))] overflow-y-auto overscroll-contain p-1.5 custom-scrollbar"
            style={{ WebkitOverflowScrolling: "touch" }}
            onWheel={(e) => e.stopPropagation()}
          >
            {list.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs font-medium text-zinc-500">
                Nenhum profissional encontrado{query ? ` para "${query}"` : ""}.
              </div>
            ) : (
              list.map((b, index) => {
                const isActive = b.active !== false;
                const isSelected = value === b.id;
                const isHighlighted = highlightedIndex === index;

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      onChange(b.id);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer select-none outline-none",
                      isSelected
                        ? "bg-gold/10 text-gold-950 font-bold"
                        : isHighlighted
                        ? "bg-zinc-100 text-zinc-900"
                        : "hover:bg-zinc-50 text-zinc-800",
                    )}
                  >
                    <EntityAvatar
                      imageUrl={resolveImageUrl(b)}
                      name={b.name}
                      entityType="professional"
                      size={40}
                      showStatus
                      active={isActive}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn(
                        "block truncate text-xs font-bold",
                        isSelected ? "text-gold-950" : "text-zinc-900"
                      )}>
                        {b.name}
                      </span>
                      <span className="block truncate text-[11px] text-zinc-500 font-medium">
                        {b.category || "Barbeiro"}
                        {Array.isArray(b.specialties) && b.specialties.length > 0
                          ? ` · ${b.specialties.slice(0, 2).join(", ")}`
                          : ""}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
                          isActive
                            ? "text-emerald-700 bg-emerald-50 border border-emerald-200/50"
                            : "text-zinc-500 bg-zinc-100 border border-zinc-200/50",
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-zinc-400")} />
                        {isActive ? "Disponível" : "Indisponível"}
                      </span>
                    </span>
                    {isSelected && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
