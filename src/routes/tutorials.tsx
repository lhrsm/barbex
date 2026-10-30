import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import { BookOpen, Search as SearchIcon, Sparkles, GraduationCap, ShieldAlert, ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { withModule } from "@/components/modules/withModule";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useModules } from "@/hooks/use-modules";
import {
  getTutorialsForRole,
  type TutorialItem,
} from "@/lib/tutorials.catalog";
import { openOnboardingModal } from "@/components/onboarding/OnboardingModal";
import { toast } from "sonner";

interface TutorialsSearchParams {
  article?: string;
  category?: string;
  q?: string;
}

export const Route = createFileRoute("/tutorials")({
  validateSearch: (search: Record<string, unknown>): TutorialsSearchParams => ({
    article: typeof search.article === "string" && search.article.trim() ? search.article.trim() : undefined,
    category: typeof search.category === "string" && search.category.trim() ? search.category.trim() : undefined,
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
  }),
  component: withModule("tutorials", "Tutoriais", HelpCenterPage),
});

/**
 * Mapeamento canônico de equivalência semântica comprovada entre itens
 * do catálogo estruturado de onboarding e artigos persistidos no Supabase.
 * Permite deduplicação inteligente sem excluir conteúdos distintos nem quebrar links.
 */
const SEMANTIC_EQUIVALENCES: Record<string, { canonicalDbPrefix: string }> = {
  "client-online-booking": { canonicalDbPrefix: "Como o cliente agenda pelo site público" },
  "client-portal-management": { canonicalDbPrefix: "Como funciona o portal do cliente" },
  "client-loyalty-cashback": { canonicalDbPrefix: "Como funciona o portal do cliente e o Clube Barbex" },
  "owner-config-barbershop": { canonicalDbPrefix: "Como configurar sua barbearia pela primeira vez" },
  "owner-services-setup": { canonicalDbPrefix: "Como criar serviços" },
  "owner-team-management": { canonicalDbPrefix: "Como cadastrar barbeiros" },
  "owner-whatsapp-automation": { canonicalDbPrefix: "Como configurar Z-API" },
  "owner-finances-reconciliation": { canonicalDbPrefix: "Como usar a Visão Gerencial e exportar PDF" },
  "reception-comanda-digital": { canonicalDbPrefix: "Como usar a Comanda Digital" },
  "reception-walkin-queue": { canonicalDbPrefix: "Como atender clientes sem agendamento" },
  "reception-checkin-arrival": { canonicalDbPrefix: "Como usar o Check-in por QR Code" },
  "barber-complete-appointment": { canonicalDbPrefix: "Como concluir ou cancelar um atendimento" },
  "barber-commissions-statement": { canonicalDbPrefix: "Como o barbeiro acompanha sua comissão" },
  "finance-cash-flow": { canonicalDbPrefix: "Como funciona o financeiro da barbearia" },
  "finance-commission-payout": { canonicalDbPrefix: "Como pagar comissão ao barbeiro" },
};

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
    profile_target: tut.targetRoles,
  };
}

function HelpCenterPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  const [searchQuery, setSearchQuery] = useState(searchParams.q || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(searchParams.category || null);
  const [recentArticles, setRecentArticles] = useState<{ id: string; title: string }[]>([]);

  const { user, role, loading: authLoading, initialized: authInitialized } = useAuth();
  const { hasPermission } = usePermissions();
  const { isEnabled } = useModules();

  // GATE 1 — CONTEXTO DE AUTENTICAÇÃO E COMPORTAMENTO FAIL-CLOSED
  const isAuthResolving = !authInitialized || authLoading;
  const isAnonymous = authInitialized && (!user || !role || role === "unknown");
  const effectiveRole = useMemo(() => {
    if (isAuthResolving || isAnonymous) return null;
    return role;
  }, [isAuthResolving, isAnonymous, role]);

  // GATE 1 — REDIRECIONA VISITANTES ANÔNIMOS PARA A TELA DE LOGIN
  useEffect(() => {
    if (isAnonymous) {
      navigate({
        to: "/auth",
        search: { redirect: "/tutorials" } as any,
        replace: true,
      });
    }
  }, [isAnonymous, navigate]);

  // GATE 5 — HISTÓRICO ISOLADO POR CONTEXTO DE USUÁRIO
  const historyStorageKey = useMemo(() => {
    if (user?.id) return `help_history_${user.id}`;
    return "help_history_anon";
  }, [user?.id]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(historyStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Armazena apenas referências mínimas { id, title }, nunca o corpo inteiro
          setRecentArticles(parsed.map((item: any) => ({ id: item.id, title: item.title })));
        } else {
          setRecentArticles([]);
        }
      } else {
        setRecentArticles([]);
      }
    } catch {
      setRecentArticles([]);
    }
  }, [historyStorageKey]);

  // Sincroniza query params da URL com os estados locais
  useEffect(() => {
    if (searchParams.category !== undefined && searchParams.category !== selectedCategoryId) {
      setSelectedCategoryId(searchParams.category || null);
    }
  }, [searchParams.category]);

  useEffect(() => {
    if (searchParams.q !== undefined && searchParams.q !== searchQuery) {
      setSearchQuery(searchParams.q || "");
    }
  }, [searchParams.q]);

  // GATE 2 — CATÁLOGO ESTÁTICO AUTORIZADO
  const catalogArticles = useMemo(() => {
    // Para visitantes anônimos ou durante resolução de autenticação: NUNCA injetar catálogo estático!
    // Preserva estritamente os 3 artigos públicos provenientes do Supabase via RLS.
    if (isAuthResolving || isAnonymous || !effectiveRole) {
      return [];
    }

    const authorized = getTutorialsForRole({
      role: effectiveRole,
      hasPermission,
      isModuleEnabled: (key: string) => isEnabled(key),
    });

    return authorized.map(mapCatalogItemToArticle);
  }, [isAuthResolving, isAnonymous, effectiveRole, hasPermission, isEnabled]);

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

  const { data: dbArticles, isLoading, isError } = useQuery({
    queryKey: ["help-articles", isAnonymous, effectiveRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorials")
        .select(`
          *,
          category:tutorial_categories(name)
        `)
        .order("order", { ascending: true });

      if (error) {
        console.error("Erro ao carregar tutoriais:", error);
        throw error;
      }
      return data || [];
    },
  });

  // GATES 1, 2, 3 — DEFESA EM PROFUNDIDADE, UNIFICAÇÃO E DEDUPLICAÇÃO INTELIGENTE
  const { combinedArticles, aliasMap } = useMemo(() => {
    const isSuperAdmin = effectiveRole === "super_admin";
    const aliases = new Map<string, string>();

    // 1. Defesa em Profundidade nos artigos do banco de dados
    const safeDbArticles = (dbArticles || []).filter((art: any) => {
      // Visitante Anônimo: apenas artigos expressamente públicos para clientes
      if (isAnonymous) {
        const targets = Array.isArray(art.profile_target) ? art.profile_target : [];
        const isClientEligible = targets.includes("client") || targets.includes("customer");
        return isClientEligible && !art.is_admin_only && art.type !== "super_admin_internal";
      }

      // Super Admin: acesso irrestrito a todos os artigos publicados
      if (isSuperAdmin) return true;

      // Não-superadmin NUNCA pode ver artigos internos de superadmin
      if (art.type === "super_admin_internal") return false;
      const targets = Array.isArray(art.profile_target) ? art.profile_target : [];
      if (targets.length === 1 && targets[0] === "super_admin") return false;

      // Artigos administrativos exclusivos requerem cargo de gestão
      const isAdminRole =
        effectiveRole === "tenant_admin" || effectiveRole === "admin" || effectiveRole === "manager";
      if (art.is_admin_only && !isAdminRole) return false;

      // Verificação de compatibilidade de role
      if (targets.length > 0 && effectiveRole) {
        const roleMatches =
          targets.includes(effectiveRole) ||
          (effectiveRole === "tenant_admin" && targets.includes("admin")) ||
          (effectiveRole === "admin" && targets.includes("tenant_admin")) ||
          (effectiveRole === "reception" && targets.includes("receptionist")) ||
          (effectiveRole === "receptionist" && targets.includes("reception")) ||
          (effectiveRole === "barber" && targets.includes("professional")) ||
          (effectiveRole === "professional" && targets.includes("barber")) ||
          (effectiveRole === "financial" && (targets.includes("finance") || targets.includes("cashier"))) ||
          (effectiveRole === "finance" && (targets.includes("financial") || targets.includes("cashier"))) ||
          (effectiveRole === "cashier" && (targets.includes("financial") || targets.includes("finance"))) ||
          (effectiveRole === "customer" && targets.includes("client")) ||
          (effectiveRole === "client" && targets.includes("customer"));

        if (!roleMatches) return false;
      }

      return true;
    });

    // Mapeamento dos artigos do banco por ID
    const articleMap = new Map<string, any>();
    safeDbArticles.forEach((art: any) => {
      articleMap.set(art.id, art);
    });

    // 2. Unificação e Deduplicação com Catálogo Estático Autorizado
    catalogArticles.forEach((catItem: any) => {
      const equiv = SEMANTIC_EQUIVALENCES[catItem.id];
      let matchingDbArticle: any = null;

      if (equiv) {
        matchingDbArticle = safeDbArticles.find(
          (dbArt: any) =>
            dbArt.title && dbArt.title.toLowerCase().startsWith(equiv.canonicalDbPrefix.toLowerCase())
        );
      } else {
        matchingDbArticle = safeDbArticles.find(
          (dbArt: any) =>
            dbArt.title && dbArt.title.trim().toLowerCase() === catItem.title.trim().toLowerCase()
        );
      }

      if (matchingDbArticle) {
        // Registra alias do catálogo para o artigo canônico do banco
        aliases.set(catItem.id, matchingDbArticle.id);
      } else {
        // Conteúdo distinto do catálogo sem equivalente no banco: inclui mantendo o ID
        articleMap.set(catItem.id, catItem);
      }
    });

    return { combinedArticles: Array.from(articleMap.values()), aliasMap: aliases };
  }, [dbArticles, catalogArticles, effectiveRole, isAnonymous]);

  // GATE 4 — CATEGORIAS DINÂMICAS: EXIBIR SOMENTE AS QUE TÊM ARTIGOS ACESSÍVEIS
  const categories = useMemo(() => {
    if (!combinedArticles || combinedArticles.length === 0) return [];

    const activeCatIds = new Set<string>();
    const activeCatNames = new Set<string>();

    combinedArticles.forEach((art: any) => {
      if (art.category_id) activeCatIds.add(String(art.category_id).toLowerCase());
      if (art.category?.id) activeCatIds.add(String(art.category.id).toLowerCase());
      if (art.category?.name) activeCatNames.add(String(art.category.name).toLowerCase());
    });

    if (dbCategories && dbCategories.length > 0) {
      const filtered = dbCategories.filter((cat: any) => {
        const catId = String(cat.id).toLowerCase();
        const catName = String(cat.name).toLowerCase();
        return activeCatIds.has(catId) || activeCatNames.has(catName);
      });
      if (filtered.length > 0) return filtered;
    }

    const uniqueNames = Array.from(
      new Set(combinedArticles.map((a: any) => a.category?.name).filter(Boolean))
    );
    return uniqueNames.map((name, idx) => ({
      id: name,
      name: name,
      icon: "BookOpen",
      order: idx,
    }));
  }, [combinedArticles, dbCategories]);

  // GATE 4 — FILTRAGEM POR CATEGORIA E BUSCA
  const filteredArticles = useMemo(() => {
    let list = combinedArticles;

    if (selectedCategoryId) {
      list = list.filter((a: any) => {
        const catId = a.category_id || a.category?.id;
        const catName = a.category?.name;
        return (
          catId === selectedCategoryId ||
          (catName && catName.toLowerCase() === selectedCategoryId.toLowerCase())
        );
      });
    }

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (a: any) =>
          (a.title && a.title.toLowerCase().includes(q)) ||
          (a.description && a.description.toLowerCase().includes(q)) ||
          (a.long_description && a.long_description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [combinedArticles, selectedCategoryId, searchQuery]);

  // GATE 2 (R2E.26E.20E.1) — CONTADORES DINÂMICOS
  const totalAvailableCount = combinedArticles.length;
  const isFilterActive = Boolean(searchQuery.trim() || selectedCategoryId);
  const searchFilteredCount = filteredArticles.length;

  // GATE 6 — ROTAS DE DETALHES E PROTEÇÃO DE ACESSO DIRETO POR URL
  const requestedArticleId = searchParams.article;

  const activeArticle = useMemo(() => {
    if (!requestedArticleId) return null;
    let match = combinedArticles.find((a: any) => a.id === requestedArticleId);
    if (!match && aliasMap.has(requestedArticleId)) {
      const canonicalId = aliasMap.get(requestedArticleId);
      match = combinedArticles.find((a: any) => a.id === canonicalId);
    }
    return match || null;
  }, [requestedArticleId, combinedArticles, aliasMap]);

  const isRequestedArticleUnauthorized = Boolean(
    requestedArticleId && !isAuthResolving && !isLoading && !activeArticle
  );

  // GATE 5 — HISTÓRICO REVALIDADO EM TEMPO REAL
  const visibleHistory = useMemo(() => {
    const allowedMap = new Map(combinedArticles.map((a: any) => [a.id, a]));
    return recentArticles
      .filter((h: any) => {
        const targetId = aliasMap.get(h.id) || h.id;
        return allowedMap.has(targetId);
      })
      .map((h: any) => {
        const targetId = aliasMap.get(h.id) || h.id;
        return allowedMap.get(targetId) || h;
      });
  }, [recentArticles, combinedArticles, aliasMap]);

  const addToHistory = (article: any) => {
    const minimalItem = { id: article.id, title: article.title };
    setRecentArticles((prev) => {
      const updated = [minimalItem, ...prev.filter((a) => a.id !== article.id)].slice(0, 5);
      try {
        localStorage.setItem(historyStorageKey, JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not save help history", e);
      }
      return updated;
    });
  };

  const handleSelectArticle = (article: any) => {
    addToHistory(article);
    navigate({
      to: "/tutorials",
      search: (prev) => ({ ...prev, article: article.id }),
      replace: false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectHistory = (historyItem: any) => {
    const targetId = aliasMap.get(historyItem.id) || historyItem.id;
    const authorized = combinedArticles.find((a: any) => a.id === targetId);
    if (!authorized) {
      setRecentArticles((prev) => prev.filter((a) => a.id !== historyItem.id));
      toast.error("Este tutorial não está disponível para o seu perfil.");
      return;
    }
    handleSelectArticle(authorized);
  };

  const handleBackToList = () => {
    navigate({
      to: "/tutorials",
      search: (prev) => ({ ...prev, article: undefined }),
      replace: true,
    });
  };

  const handleSelectCategory = (catId: string | null) => {
    setSelectedCategoryId(catId);
    navigate({
      to: "/tutorials",
      search: (prev) => ({ ...prev, category: catId || undefined }),
      replace: true,
    });
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    navigate({
      to: "/tutorials",
      search: (prev) => ({ ...prev, q: query.trim() || undefined }),
      replace: true,
    });
  };

  if (isAuthResolving || isAnonymous) {
    return (
      <HelpCenterLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-gold" />
          <p className="text-xs text-zinc-400 font-medium">Verificando autorização...</p>
        </div>
      </HelpCenterLayout>
    );
  }



  return (
    <HelpCenterLayout>
      {/* CENÁRIO 1: ACESSO DIRETO NÃO AUTORIZADO (GATE 6) */}
      {isRequestedArticleUnauthorized ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Button
            variant="ghost"
            onClick={handleBackToList}
            className="text-zinc-400 hover:text-white -ml-2 h-9 text-xs sm:text-sm font-semibold gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para a Central de Ajuda
          </Button>

          <div className="bg-[#0b0f17] border border-amber-500/30 rounded-2xl p-6 sm:p-10 text-center space-y-4 max-w-xl mx-auto shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-white">Conteúdo Restrito</h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
                Este tutorial não está disponível para o seu nível de acesso atual ou requer autenticação como perfil
                autorizado.
              </p>
            </div>
            <Button
              onClick={handleBackToList}
              className="bg-gold text-black hover:bg-gold/90 font-bold text-xs rounded-xl h-9 px-5 shadow-[0_2px_12px_rgba(212,175,55,0.25)]"
            >
              Ver Tutoriais Disponíveis
            </Button>
          </div>
        </div>
      ) : activeArticle ? (
        /* CENÁRIO 2: ARTIGO AUTORIZADO SELECIONADO */
        <HelpArticlePage article={activeArticle} onBack={handleBackToList} />
      ) : (
        /* CENÁRIO 3: LISTAGEM PRINCIPAL DA CENTRAL DE AJUDA */
        <div className="space-y-4 sm:space-y-6">
          {/* 1. Identificação da Central de Ajuda com Contador Dinâmico */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-zinc-800/60">
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/25 text-gold text-xs font-semibold">
                <GraduationCap className="w-3.5 h-3.5 text-gold" />
                <span>Central de Ajuda</span>
              </div>

              {/* Contador Dinâmico de Tutoriais Disponíveis para o Perfil Autenticado */}
              {isLoading && combinedArticles.length === 0 ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/70 border border-zinc-700/60 text-[11px] sm:text-xs text-zinc-400 font-medium animate-pulse"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="w-3 h-3 animate-spin text-gold" />
                  <span>Carregando tutoriais...</span>
                </span>
              ) : isError ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-[11px] sm:text-xs text-red-400 font-medium"
                  role="status"
                  aria-live="polite"
                  id="tutorials-error-counter"
                >
                  <AlertCircle className="w-3 h-3 text-red-400" aria-hidden="true" />
                  <span>Indisponível</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] sm:text-xs text-zinc-300 font-medium shadow-sm"
                  role="status"
                  aria-live="polite"
                  id="tutorials-available-counter"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" aria-hidden="true" />
                  <span>
                    <strong className="text-white font-bold">{totalAvailableCount}</strong>{" "}
                    {totalAvailableCount === 1 ? "tutorial disponível" : "tutoriais disponíveis"}
                  </span>
                </span>
              )}

              {/* Indicador Distinto de Resultados de Filtro / Busca Ativa */}
              {isFilterActive && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] sm:text-xs text-amber-300 font-medium animate-in fade-in"
                  role="status"
                  aria-live="polite"
                  id="tutorials-filtered-counter"
                >
                  <SearchIcon className="w-3 h-3 text-amber-400" aria-hidden="true" />
                  <span>
                    <strong className="text-amber-200 font-bold">{searchFilteredCount}</strong>{" "}
                    {searchFilteredCount === 1 ? "resultado encontrado" : "resultados encontrados"}
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {effectiveRole === "client" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (typeof window !== "undefined" && window.history.length > 1) {
                      window.history.back();
                    } else {
                      navigate({ to: "/" });
                    }
                  }}
                  className="text-xs text-zinc-400 hover:text-gold gap-1.5 h-8 px-2.5 rounded-lg border border-white/5 hover:border-gold/30 hover:bg-gold/5"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-gold" />
                  <span>Voltar ao Painel</span>
                </Button>
              )}
              <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">Base oficial Barbex</span>
            </div>
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
              <HelpSearch value={searchQuery} onChange={handleSearchChange} />
            </div>
          </div>

          {/* 4. Categorias filtradas dinamicamente (GATE 4) */}
          {categories.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Categorias</span>
                {selectedCategoryId && (
                  <button
                    type="button"
                    onClick={() => handleSelectCategory(null)}
                    className="text-xs text-gold hover:underline font-bold"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
              <HelpCategories
                categories={categories || []}
                selectedId={selectedCategoryId}
                onSelect={handleSelectCategory}
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
                <span className="text-xs text-zinc-400 font-medium" aria-live="polite">
                  {isError ? (
                    <span className="text-red-400 font-medium">Erro ao carregar</span>
                  ) : isFilterActive ? (
                    <>
                      <strong className="text-zinc-200">{searchFilteredCount}</strong> de{" "}
                      <strong className="text-zinc-200">{totalAvailableCount}</strong>{" "}
                      {totalAvailableCount === 1 ? "tutorial" : "tutoriais"}
                    </>
                  ) : (
                    <>
                      <strong className="text-zinc-200">{totalAvailableCount}</strong>{" "}
                      {totalAvailableCount === 1 ? "tutorial disponível" : "tutoriais disponíveis"}
                    </>
                  )}
                </span>
              </div>

              {/* Fail-closed skeleton durante carregamento ou erro */}
              {isAuthResolving || (isLoading && combinedArticles.length === 0) ? (
                <HelpSkeleton />
              ) : isError ? (
                <div className="text-center py-12 px-4 border-2 border-dashed rounded-2xl bg-[#0b0f17]/50 border-red-900/30 animate-in fade-in zoom-in-95 duration-200">
                  <AlertCircle className="h-10 w-10 text-red-500/80 mx-auto mb-2" />
                  <h4 className="text-base font-bold text-white">Falha ao carregar tutoriais</h4>
                  <p className="text-zinc-500 max-w-sm mx-auto mt-1 text-xs sm:text-sm">
                    Ocorreu uma instabilidade na consulta à Central de Ajuda. Por favor, tente recarregar a página.
                  </p>
                </div>
              ) : filteredArticles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
                  {filteredArticles.map((article) => (
                    <HelpArticleCard key={article.id} article={article} onClick={handleSelectArticle} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 px-4 border-2 border-dashed rounded-2xl bg-[#0b0f17]/50 border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                  <SearchIcon className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                  <h4 className="text-base font-bold text-white">Nenhum tutorial encontrado</h4>
                  <p className="text-zinc-500 max-w-sm mx-auto mt-1 text-xs sm:text-sm">
                    {searchQuery
                      ? `Não encontramos tutoriais para "${searchQuery}". Tente outros termos ou limpe os filtros.`
                      : "Nenhum tutorial disponível para a categoria selecionada."}
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
                  <h4 className="font-bold text-xs uppercase tracking-wider text-white">Guia de Início</h4>
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

              {/* Histórico Isolado (GATE 5) */}
              <HelpHistory recentArticles={visibleHistory} onSelect={handleSelectHistory} />

              {/* Card Suporte Direto */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-gold/10 to-[#0b0f17] border border-gold/30 space-y-2 shadow-[0_4px_20px_rgba(212,175,55,0.15)]">
                <h4 className="font-black text-gold uppercase text-[11px] tracking-wider">Suporte Direto</h4>
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
      )}
    </HelpCenterLayout>
  );
}
