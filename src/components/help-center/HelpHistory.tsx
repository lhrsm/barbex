import { Button } from "@/components/ui/button";
import { History, ArrowRight } from "lucide-react";

interface HelpHistoryProps {
  recentArticles: any[];
  onSelect: (article: any) => void;
}

export function HelpHistory({ recentArticles, onSelect }: HelpHistoryProps) {
  if (recentArticles.length === 0) return null;

  return (
    <div className="bg-[#0b0f17] border border-zinc-800/90 rounded-2xl p-4 space-y-2.5">
      <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
        <History size={13} /> Visto recentemente
      </h4>
      <div className="space-y-1">
        {recentArticles.map((article) => (
          <Button
            key={article.id}
            variant="ghost"
            onClick={() => onSelect(article)}
            className="w-full justify-between h-auto py-2 px-3 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 group text-left"
          >
            <span className="text-xs font-medium line-clamp-1">{article.title}</span>
            <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1 text-gold" />
          </Button>
        ))}
      </div>
    </div>
  );
}
