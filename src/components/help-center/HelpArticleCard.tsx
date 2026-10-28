import { Badge } from "@/components/ui/badge";
import { Clock, Star, ArrowRight } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface HelpArticleCardProps {
  article: any;
  onClick: (article: any) => void;
}

export function HelpArticleCard({ article, onClick }: HelpArticleCardProps) {
  const Icon = (LucideIcons as any)[article.icon] || LucideIcons.FileText;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onClick(article)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(article);
        }
      }}
      className="group cursor-pointer bg-[#0b0f17] border border-zinc-800/90 hover:border-gold/50 rounded-2xl p-4 sm:p-5 flex flex-col justify-between h-full transition-all duration-200 hover:shadow-[0_8px_24px_-6px_rgba(212,175,55,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <div>
        <div className="flex justify-between items-start mb-3 gap-2">
          <div className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/25 grid place-items-center text-gold shrink-0 transition-transform duration-200 group-hover:scale-105">
            <Icon size={18} />
          </div>
          {article.is_featured && (
            <Badge className="bg-gold text-black hover:bg-gold/90 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 border-none shadow-[0_2px_8px_rgba(212,175,55,0.25)]">
              <Star size={10} className="mr-1 fill-black" /> Destaque
            </Badge>
          )}
        </div>
        <h3 className="font-bold text-white group-hover:text-gold transition-colors text-base sm:text-[17px] leading-snug line-clamp-3">
          {article.title}
        </h3>
        <p className="text-[13px] sm:text-sm text-zinc-400 line-clamp-2 mt-2 mb-4 leading-relaxed">
          {article.description}
        </p>
      </div>

      <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] sm:text-xs text-zinc-400 font-medium">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-zinc-400">
            <Clock size={12} className="text-zinc-500" /> {article.estimated_time}
          </span>
          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-semibold">
            {article.level}
          </span>
        </div>
        <span className="text-gold flex items-center gap-1 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
          Ler mais <ArrowRight size={12} />
        </span>
      </div>
    </article>
  );
}
