import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SourceItem {
  id: string;
  title: string;
  category: string;
  route: string;
}

interface CollapsibleSourcesProps {
  sources?: SourceItem[];
  className?: string;
}

/**
 * CollapsibleSources (Barbex R2E.26E.22N.34)
 *
 * Apresentação acessível e recolhida por padrão de artigos consultados da Central de Ajuda.
 * - Recolhido por padrão (evita poluição visual no chat)
 * - Títulos apresentados separadamente em badges/pills individuais
 * - Navegável por teclado com atributos ARIA completos
 */
export function CollapsibleSources({ sources, className }: CollapsibleSourcesProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className={cn("pt-2 border-t border-white/5 space-y-1", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
        aria-controls="sources-collapsible-content"
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/50 hover:text-gold transition-colors focus:outline-none focus:ring-1 focus:ring-gold/40 rounded px-1.5 py-0.5 cursor-pointer"
      >
        <BookOpen className="w-3 h-3 text-gold/70" />
        <span>Consultar na Central de Ajuda ({sources.length})</span>
        {isOpen ? (
          <ChevronUp className="w-3 h-3 text-white/40" />
        ) : (
          <ChevronDown className="w-3 h-3 text-white/40" />
        )}
      </button>

      {isOpen && (
        <div
          id="sources-collapsible-content"
          className="mt-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200"
          role="region"
          aria-label="Artigos recomendados da Central de Ajuda"
        >
          {sources.map((src) => (
            <Link
              key={src.id}
              to="/tutorials"
              search={{ q: src.title } as any}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 hover:border-gold/40 hover:bg-gold/5 text-[11px] font-medium text-zinc-300 hover:text-white transition-all group"
            >
              <span>{src.title}</span>
              <ExternalLink className="w-2.5 h-2.5 text-zinc-500 group-hover:text-gold" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
