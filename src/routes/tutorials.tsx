import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HelpCenterLayout } from "@/components/help-center/HelpCenterLayout";
import { HelpSearch } from "@/components/help-center/HelpSearch";
import { HelpCategories } from "@/components/help-center/HelpCategories";
import { HelpArticleCard } from "@/components/help-center/HelpArticleCard";
import { HelpArticlePage } from "@/components/help-center/HelpArticlePage";
import { HelpHistory } from "@/components/help-center/HelpHistory";
import { HelpSkeleton } from "@/components/help-center/HelpSkeleton";
import { BookOpen, Search as SearchIcon, Sparkles, GraduationCap } from "lucide-react";
import { withModule } from "@/components/modules/withModule";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useModules } from "@/hooks/use-modules";
import {
  getTutorialsForRole,
  type TutorialItem,
} from "@/lib/tutorials.catalog";
import { openOnboardingModal } from "@/components/onboarding/OnboardingModal";

export const Route = createFileRoute("/tutorials")({
  component: withModule("tutorials", "Tutoriais", HelpCenterPage),
});

function mapCatalogItemToArticle(tut: TutorialItem) {
  const iconMap: Record<string, string> = {
    Essencial: "CheckCircle2",
    Operação: "Calendar",
    Homologado: "CalendarDays",
    Financeiro: "DollarSign",
    Recepção: "Bell",
    Comanda: "ListChecks",
    Profissional: "Scissors",
    Comissão: "CircleDollarSign",
    Extrato: "TrendingUp",
    Caixa: "Wallet",
    Agendamento: "Calendar",
    Portal: "User",
    Fidelidade: "Gift",
    Plataforma: "ShieldCheck",
    Conteúdo: "GraduationCap",
    Terceiro: "HelpCircle",
  };

  return {
    id: tut.id,
    title: tut.title,
    description: tut.description,
    long_description: `${tut.description}\n\nPasso a Passo de Utilização:\n${tut.steps
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n")}${tut.notes ? `\n\nObservação Importante:\n${tut.notes}` : ""}`,
    icon: iconMap[tut.badge || ""] || "BookOpen",
    is_featured: tut.badge === "Essencial" || tut.badge === "Homologado",
    estimated_time: "2 min",
    level: tut.badge || "Guia Rápido",
    category_id: tut.badge || "geral",
    category: { name: tut.badge || "Geral" },
    route: tut.route,
    type: "document",
  };
}

function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [recentArticles, setRecentArticles] = useState<any[]>([]);

  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const { isEnabled } = useModules();

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("help_history");
    if (saved) {
      try {
        setRecentArticles(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing help history", e);
      }
    }
  }, []);

  const addToHistory = (article: any) => {
    const newHistory = [article, ...recentArticles.filter((a) => a.id !== article.id)].slice(0, 5);
    setRecentArticles(newHistory);
    localStorage.setItem("help_history", JSON.stringify(newHistory));
    setSelectedArticle(article);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Tutoriais canônicos do catálogo autorizados para o perfil do usuário
  const catalogArticles = useMemo(() => {
    const authorized = getTutorialsForRole({
      role,
      hasPermission,
      isModuleEnabled: (key: string) => isEnabled(key),
    });
    return authorized.map(mapCatalogItemToArticle);
  }, [role, hasPermission, isEnabled]);

  // Consulta ao banco de dados Supabase
  const { data: dbCategories } = useQuery({
    queryKey: ["help-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorial_categories")
        .select("*")
        .order("order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: dbArticles, isLoading } = useQuery({
    queryKey: ["help-articles", selectedCategoryId],
    queryFn: async () => {
      let query = supabase
        .from("tutorials")
        .select(`
          *,
          category:tutorial_categories(name)
        `)
        .order("order", { ascending: true });

      if (selectedCategoryId) {
        query = query.eq("category_id", selectedCategoryId);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
  });

  // Filtra e unifica artigos do banco e do catálogo de forma estritamente isolada e segura
  const combinedArticles = useMemo(() => {
    const isSuperAdmin = role === "super_admin";

    // 1. Filtra artigos do banco para proteger conteúdos administrativos
    const safeDbArticles = (dbArticles || []).filter((art: any) => {
      // Se for tutorial restrito a super admin e o usuário não for super admin, bloqueia
      if (!isSuperAdmin) {
        const targetProfiles = art.metadata?.target_profiles || [];
        if (targetProfiles.length === 1 && targetProfiles[0] === "super_admin") {
          return false;
        }
        if (art.type === "super_admin_internal") {
          return false;
        }
      }
      return true;
    });

    // 2. Unifica com artigos do catálogo autorizado
    const map = new Map<string, any>();
    catalogArticles.forEach((a) => map.set(a.id, a));
    safeDbArticles.forEach((a) => map.set(a.id, a));

    let list = Array.from(map.values());

    // 3. Filtro por categoria selecionada
    if (selectedCategoryId) {
      list = list.filter(
        (a) => a.category_id === selectedCategoryId || a.category?.name === selectedCategoryId
      );
    }

    return list;
  }, [dbArticles, catalogArticles, role, selectedCategoryId]);

  // Monta categorias combinadas dinâmicas
  const categories = useMemo(() => {
    if (dbCategories && dbCategories.length > 0) {
      return dbCategories;
    }

    // Se o banco não tem categorias cadastradas, gera a partir dos badges do catálogo
    const uniqueBadges = Array.from(new Set(catalogArticles.map((a) => a.category?.name).filter(Boolean)));
    return uniqueBadges.map((badge, idx) => ({
      id: badge,
      name: badge,
      icon: "BookOpen",
      order: idx,
    }));
  }, [dbCategories, catalogArticles]);

  const filteredArticles = useMemo(() => {
    if (!combinedArticles) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return combinedArticles;

    return combinedArticles.filter(
      (a: any) =>
        a.title.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.long_description && a.long_description.toLowerCase().includes(q))
    );
  }, [combinedArticles, searchQuery]);

  return (
    <HelpCenterLayout>
      {!selectedArticle ? (
        <div className="space-y-4 sm:space-y-6">
          {/* 1. Identificação da Central de Ajuda */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/25 text-gold text-xs font-semibold">
              <GraduationCap className="w-3.5 h-3.5 text-gold" />
              <span>Central de Ajuda 2.0</span>
            </div>
            <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">
              Base oficial Barbex
            </span>
          </div>

          {/* 2. Título e descrição compactos + 3. Campo de pesquisa */}
          <div className="text-center space-y-2.5 pt-1 pb-1 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-[34px] font-black text-white tracking-tight leading-tight">
              Como podemos <span className="text-gold">ajudar?</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
              Guias oficiais, passo a passo de operação e respostas para o dia a dia da barbearia.
            </p>
            {/* 3. Campo de pesquisa */}
            <div className="pt-1.5">
              <HelpSearch value={searchQuery} onChange={setSearchQuery} />
            </div>
          </div>

          {/* 4. Categorias */}
          {categories.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Categorias
                </span>
                {selectedCategoryId && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(null)}
                    className="text-xs text-gold hover:underline font-bold"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
              <HelpCategories
                categories={categories || []}
                selectedId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
              />
            </div>
          )}

          {/* Conteúdo Principal: 5. Artigos e tutoriais + 6. Área lateral */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 pt-1">
            {/* 5. Artigos e tutoriais */}
            <div className="lg:col-span-3 space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <h3 className="font-bold flex items-center gap-2 text-white text-base sm:text-lg">
                  <BookOpen className="text-gold h-4 w-4 sm:h-5 sm:w-5" />
                  {selectedCategoryId
                    ? categories?.find((c) => c.id === selectedCategoryId)?.name || selectedCategoryId
                    : "Todos os Artigos"}
                </h3>
                <span className="text-xs text-zinc-500 font-medium">
                  {filteredArticles.length} {filteredArticles.length === 1 ? "resultado" : "resultados"}
                </span>
              </div>

              {isLoading && combinedArticles.length === 0 ? (
                <HelpSkeleton />
              ) : filteredArticles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
                  {filteredArticles.map((article) => (
                    <HelpArticleCard key={article.id} article={article} onClick={addToHistory} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 px-4 border-2 border-dashed rounded-2xl bg-[#0b0f17]/50 border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                  <SearchIcon className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                  <h4 className="text-base font-bold text-white">Nenhum tutorial encontrado</h4>
                  <p className="text-zinc-500 max-w-sm mx-auto mt-1 text-xs sm:text-sm">
                    Não encontramos tutoriais para "{searchQuery}". Tente outros termos ou limpe os filtros.
                  </p>
                </div>
              )}
            </div>

            {/* 6. Área lateral de Guia de Início e Suporte Direto */}
            <aside className="space-y-3.5 lg:col-span-1 order-last lg:order-none">
              {/* Card Guia de Início */}
              <div className="p-4 rounded-2xl bg-[#0b0f17] border border-gold/25 space-y-2">
                <div className="flex items-center gap-2 text-gold">
                  <Sparkles className="w-4 h-4 text-gold" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                    Guia de Início
                  </h4>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Reveja o painel com as principais ferramentas e atalhos da sua função.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openOnboardingModal()}
                  className="w-full bg-gold/10 hover:bg-gold/20 border-gold/30 text-gold text-xs font-bold rounded-xl h-8.5"
                >
                  Abrir Guia de Boas-Vindas
                </Button>
              </div>

              <HelpHistory recentArticles={recentArticles} onSelect={addToHistory} />

              {/* Card Suporte Direto */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-gold/10 to-[#0b0f17] border border-gold/30 space-y-2 shadow-[0_4px_20px_rgba(212,175,55,0.15)]">
                <h4 className="font-black text-gold uppercase text-[11px] tracking-wider">
                  Suporte Direto
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Não encontrou o que precisava? Fale com nosso suporte especializado.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-gold hover:bg-gold/90 text-black font-bold rounded-xl border-none h-8.5 text-xs shadow-[0_2px_12px_rgba(212,175,55,0.25)]"
                  asChild
                >
                  <Link to="/support">Abrir Chamado</Link>
                </Button>
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <HelpArticlePage article={selectedArticle} onBack={() => setSelectedArticle(null)} />
      )}
    </HelpCenterLayout>
  );
}
