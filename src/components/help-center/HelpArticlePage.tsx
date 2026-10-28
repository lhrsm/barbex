import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, PlayCircle, BookOpen, CheckCircle2 } from "lucide-react";

interface HelpArticlePageProps {
  article: any;
  onBack: () => void;
}

export function HelpArticlePage({ article, onBack }: HelpArticlePageProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      <Button 
        variant="ghost" 
        onClick={onBack}
        className="text-zinc-400 hover:text-white -ml-2 h-9 text-xs sm:text-sm font-semibold gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para a base
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Badge className="bg-gold/15 text-gold border border-gold/30 text-xs font-bold px-2.5 py-0.5">
                {article.category?.name || "Geral"}
              </Badge>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                Versão 2.0
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
              {article.title}
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              {article.description}
            </p>
          </div>

          {article.type === "video" && (
            <div className="aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-black relative group">
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 group-hover:bg-zinc-900/30 transition-all">
                <PlayCircle className="h-16 w-16 text-gold shadow-2xl" />
              </div>
            </div>
          )}

          <div className="bg-[#0b0f17] rounded-2xl p-5 sm:p-7 border border-zinc-800 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-white border-b border-zinc-800/80 pb-3">
              <BookOpen className="text-gold h-5 w-5" />
              Conteúdo do Guia
            </h3>
            <div className="text-zinc-300 whitespace-pre-line leading-relaxed text-sm sm:text-base">
              {article.long_description || article.description}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-[#0b0f17] rounded-2xl p-5 border border-zinc-800 space-y-3.5">
            <h4 className="font-bold text-white uppercase text-xs tracking-wider">Informações</h4>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-zinc-500">Tempo estimado</span>
                <span className="text-white font-medium flex items-center gap-1">
                  <Clock size={13} className="text-zinc-400" /> {article.estimated_time}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-zinc-500">Dificuldade</span>
                <Badge variant="outline" className="border-zinc-800 text-[10px] uppercase font-bold text-zinc-400">
                  {article.level}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-zinc-500">Tipo</span>
                <span className="text-white font-medium capitalize">{article.type}</span>
              </div>
            </div>
          </div>

          {article.route && (
            <Button
              className="w-full h-11 rounded-xl bg-gold text-black font-black text-sm shadow-[0_4px_16px_rgba(212,175,55,0.3)] hover:bg-gold/90 transition-all"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = article.route;
                }
              }}
            >
              Abrir no Barbex
            </Button>
          )}

          <div className="bg-gold/5 rounded-2xl p-5 border border-gold/20 space-y-3">
            <h4 className="font-bold text-gold uppercase text-[11px] tracking-wider">Checklist</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-300">
                <CheckCircle2 className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                <span>Configurações verificadas</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-300">
                <CheckCircle2 className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                <span>Módulo ativo</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
