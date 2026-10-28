import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HelpSearchProps {
  value: string;
  onChange: (val: string) => void;
}

export function HelpSearch({ value, onChange }: HelpSearchProps) {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 h-4.5 w-4.5 sm:h-5 sm:w-5 pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="O que você está procurando? (Ex: Configurar agenda, Comissões...)"
        aria-label="Buscar na Central de Ajuda"
        className="pl-10 sm:pl-11 pr-10 h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-[#0b0f17] border-zinc-800/90 text-sm sm:text-base text-white placeholder:text-zinc-500 focus-visible:border-gold/60 focus-visible:ring-gold/20 shadow-lg transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar pesquisa"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 rounded-md transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
