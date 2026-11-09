import React from "react";
import { Bot } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  compact?: boolean;
  className?: string;
}

/**
 * TypingIndicator (Barbex R2E.26E.22N.34)
 *
 * Indicador discreto e fluido de geração/digitação de resposta da IA.
 * - 3 pontos pulsantes com animação fluida
 * - Acessível via role="status" e aria-live="polite"
 * - Elimina qualquer exposição técnica de processos internos de busca
 */
export function TypingIndicator({ compact = false, className }: TypingIndicatorProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "mr-auto flex items-center gap-2 rounded-2xl rounded-tl-sm bg-white/[0.07] border border-white/10 px-3.5 py-2.5 text-xs text-slate-300",
          className
        )}
        role="status"
        aria-live="polite"
        aria-label="Assistente virtual respondendo"
      >
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]" />
        </div>
        <span className="text-[11px] text-slate-400">Respondendo...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-4 max-w-[85%] mr-auto", className)}
      role="status"
      aria-live="polite"
      aria-label="Assistente virtual respondendo"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-gold/10 border-gold/20 text-gold">
        <Bot size={18} />
      </div>

      <div className="p-3.5 rounded-2xl rounded-tl-none bg-white/[0.03] border border-white/5 flex items-center gap-2">
        <div className="flex items-center gap-1.5 motion-reduce:animate-none">
          <span className="w-2 h-2 rounded-full bg-gold/80 animate-bounce [animation-delay:0s] motion-reduce:animate-none" />
          <span className="w-2 h-2 rounded-full bg-gold/80 animate-bounce [animation-delay:0.2s] motion-reduce:animate-none" />
          <span className="w-2 h-2 rounded-full bg-gold/80 animate-bounce [animation-delay:0.4s] motion-reduce:animate-none" />
        </div>
        <span className="text-xs text-zinc-500 font-medium">Respondendo...</span>
        <span className="sr-only">O assistente está respondendo</span>
      </div>
    </motion.div>
  );
}
