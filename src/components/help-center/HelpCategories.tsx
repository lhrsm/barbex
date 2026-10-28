import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface HelpCategoriesProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function HelpCategories({ categories, selectedId, onSelect }: HelpCategoriesProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-xl text-xs sm:text-[13px] font-bold whitespace-nowrap transition-all duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
          selectedId === null
            ? "bg-gold text-black shadow-[0_2px_10px_rgba(212,175,55,0.25)]"
            : "bg-[#0b0f17] border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
        )}
      >
        Todos
      </button>
      {categories.map((category) => {
        const Icon = (LucideIcons as any)[category.icon] || LucideIcons.BookOpen;
        const isSelected = selectedId === category.id;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={cn(
              "h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-xl text-xs sm:text-[13px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-all duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
              isSelected
                ? "bg-gold text-black shadow-[0_2px_10px_rgba(212,175,55,0.25)]"
                : "bg-[#0b0f17] border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
            )}
          >
            <Icon size={14} className={isSelected ? "text-black" : "text-zinc-500"} />
            <span>{category.name}</span>
          </button>
        );
      })}
    </div>
  );
}
