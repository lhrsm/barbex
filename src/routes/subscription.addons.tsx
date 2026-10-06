import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { useModules } from "@/hooks/use-modules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowLeft, Check, Package, Sparkles, ShoppingBag, CreditCard, Wallet, Trophy, Ticket, TrendingUp, BarChart3, Percent, Zap, Infinity as InfinityIcon, Code, Plug, Palette, LucideIcon, ShoppingCart, Plus, Loader2 } from "lucide-react";
import { DefaultRouteError, DefaultRouteNotFound } from "@/components/route-boundaries";
import { SubscribeAddonDialog } from "@/components/subscription/SubscribeAddonDialog";
import { AddonsCartDrawer, type CartLine } from "@/components/subscription/AddonsCartDrawer";
import type { BillingCycle } from "@/lib/addons-engine.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/subscription/addons")({
  component: AddonsCatalog,
  errorComponent: DefaultRouteError,
  notFoundComponent: DefaultRouteNotFound,
  head: () => ({
    meta: [
      { title: "Módulos Adicionais | Barbex" },
      { name: "description", content: "Personalize sua assinatura Barbex adicionando apenas os módulos que sua barbearia precisa." },
    ],
  }),
});

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag, Package, CreditCard, Wallet, Trophy, Ticket, TrendingUp, BarChart3, Percent, Zap, Infinity: InfinityIcon, Sparkles, Code, Plug, Palette,
};

const CATEGORY_LABELS: Record<string, string> = {
  gestao: "Gestão",
  financeiro: "Financeiro",
  vendas: "Vendas",
  relacionamento: "Relacionamento",
  automacao: "Automação",
  ia: "Inteligência Artificial",
  integracoes: "Integrações",
};

interface Addon {
  id: string;
  addon_key: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  module_key: string;
  canonical_module_key: string | null;
  monthly_price: number;
  annual_price: number | null;
  minimum_plan: string | null;
  eligible_plan_keys: string[] | null;
  stripe_price_id_test: string | null;
  stripe_price_id_live: string | null;
  benefits: string[];
  max_quantity: number;
  sort_order: number;
}

function AddonsCatalog() {
  const { user, loading: authLoading, initialized: authInitialized } = useAuth();
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { plan, activeAddons, addonsUsedCount, addonsLimit, canAddMoreAddons, isAllowed } = useModules();
  const [selectedAddon, setSelectedAddon] = useState<Addon | null>(null);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [cartCycle, setCartCycle] = useState<BillingCycle>("monthly");
  const [cartOpen, setCartOpen] = useState(false);

  // 1. Owner Resolution (Fail-Closed: Policy 4.13 & Section 16)
  const { data: barbershop, isLoading: loadingBarbershop } = useQuery({
    queryKey: ["barbershop-owner-check", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("barbershops")
        .select("id, owner_id")
        .eq("id", tenantId)
        .maybeSingle();
      if (error) {
        console.warn("Could not load barbershop owner:", error.message);
        return null;
      }
      return data;
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const isOwnerLoading = authLoading || !authInitialized || tenantLoading || (!!tenantId && loadingBarbershop);
  const isOwner = Boolean(
    !isOwnerLoading &&
    user?.id &&
    barbershop?.owner_id &&
    barbershop.owner_id === user.id
  );

  // 2. Base Subscription Cycle Resolution (Policy 4.3 MATCH_BASE_SUBSCRIPTION)
  const { data: baseSub, isLoading: loadingBaseSub } = useQuery({
    queryKey: ["tenant-base-subscription-cycle", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id, status, plan_key, billing_cycle")
        .eq("user_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn("Could not load base subscription cycle:", error.message);
        return null;
      }
      return data;
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const cycleResolution = useMemo((): {
    status: "loading" | "valid" | "unknown";
    cycle: BillingCycle | null;
    rawCycle: string | null;
    reason?: string;
  } => {
    if (tenantLoading || loadingBaseSub) {
      return { status: "loading", cycle: null, rawCycle: null };
    }
    if (
      !baseSub?.stripe_subscription_id ||
      !["active", "trialing", "past_due"].includes(baseSub.status || "")
    ) {
      return {
        status: "unknown",
        cycle: null,
        rawCycle: null,
        reason: "no_active_subscription",
      };
    }
    const raw = String(baseSub.billing_cycle || "").toLowerCase().trim();
    if (raw === "year" || raw === "annual" || raw === "yearly") {
      return { status: "valid", cycle: "annual", rawCycle: raw };
    }
    if (raw === "month" || raw === "monthly") {
      return { status: "valid", cycle: "monthly", rawCycle: raw };
    }
    return {
      status: "unknown",
      cycle: null,
      rawCycle: raw || null,
      reason: "invalid_cycle",
    };
  }, [tenantLoading, loadingBaseSub, baseSub]);

  // Converge cart cycle immediately whenever authoritative cycle resolves
  useEffect(() => {
    if (cycleResolution.status === "valid" && cycleResolution.cycle && cartCycle !== cycleResolution.cycle) {
      setCartCycle(cycleResolution.cycle);
    }
  }, [cycleResolution, cartCycle]);

  const { data: addons = [], isLoading } = useQuery({
    queryKey: ["public-addons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_addons" as any)
        .select("id, addon_key, name, description, category, icon, module_key, canonical_module_key, monthly_price, annual_price, minimum_plan, eligible_plan_keys, stripe_price_id_test, stripe_price_id_live, benefits, max_quantity, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as unknown as Addon[]) || [];
    },
  });

  const contractedIds = new Set(activeAddons.map((a) => a.addon_id));
  const grouped = addons.reduce<Record<string, Addon[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const totalAddonsCost = activeAddons.reduce((s, a) => s + a.unit_price * a.quantity, 0);
  const totalMonthly = (plan?.price_monthly ?? 0) + totalAddonsCost;

  const cartIds = useMemo(() => new Set(cartLines.map((l) => l.addon.id)), [cartLines]);
  const cartCount = cartLines.length;

  const addToCart = (a: Addon) => {
    if (isOwnerLoading || !isOwner) {
      toast.error("Somente o proprietário pode contratar add-ons.");
      return;
    }
    if (cycleResolution.status !== "valid") {
      toast.error("É necessário ter uma assinatura ativa para contratar add-ons.");
      return;
    }
    if (cartIds.has(a.id)) {
      toast.info(`${a.name} já está no carrinho`);
      return;
    }
    if (!canAddMoreAddons && cartCount + activeAddons.length >= (addonsLimit ?? 0)) {
      toast.error("Limite de add-ons do seu plano atingido");
      return;
    }
    setCartLines((prev) => [
      ...prev,
      { addon: { id: a.id, addon_key: a.addon_key, name: a.name, monthly_price: Number(a.monthly_price), annual_price: a.annual_price ? Number(a.annual_price) : null, module_key: a.module_key }, quantity: 1 },
    ]);
    toast.success(`${a.name} adicionado ao carrinho`);
  };

  const removeFromCart = (id: string) => setCartLines((prev) => prev.filter((l) => l.addon.id !== id));
  const updateQty = (id: string, qty: number) =>
    setCartLines((prev) => prev.map((l) => (l.addon.id === id ? { ...l, quantity: qty } : l)));


  return (
    <div className="min-h-screen bg-[#050810] text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Back navigation */}
        <div className="mb-6">
          <Link
            from={Route.fullPath}
            to=".."
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para assinatura
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block text-[10px] font-bold px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 uppercase tracking-wider mb-3">
            Módulos Adicionais
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Personalize sua <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">assinatura Barbex</span>
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-sm md:text-base">
            Adicione apenas os recursos que sua barbearia precisa, sem migrar de plano.
          </p>
        </div>

        {/* Resumo do plano */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0A1020] to-[#0B1426] p-5 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Seu plano</div>
              <div className="text-lg font-bold text-white mt-1">{plan?.name ?? "—"}</div>
              <div className="text-xs text-white/40">R$ {(plan?.price_monthly ?? 0).toFixed(2)}/mês</div>
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Add-ons ativos</div>
              <div className="text-lg font-bold text-white mt-1">{addonsUsedCount} / {addonsLimit}</div>
              <div className="text-xs text-white/40">{canAddMoreAddons ? "Você pode contratar mais" : "Limite atingido"}</div>
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Custo add-ons</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">R$ {totalAddonsCost.toFixed(2)}</div>
              <div className="text-xs text-white/40">por mês</div>
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Mensalidade total</div>
              <div className="text-lg font-bold text-amber-300 mt-1">R$ {totalMonthly.toFixed(2)}</div>
              <Link to="/subscription" className="text-xs text-amber-400 hover:underline">Ver planos →</Link>
            </div>
          </div>
        </div>

        {isLoading && <div className="text-center text-white/50 py-10">Carregando catálogo...</div>}

        {/* Cards por categoria */}
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="mb-10">
            <h2 className="text-lg font-bold text-white/80 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-amber-500/40" />
              {CATEGORY_LABELS[cat] ?? cat}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((a) => {
                const Icon = ICON_MAP[a.icon ?? "Package"] ?? Package;
                const isContracted = contractedIds.has(a.id);
                const effectiveModuleKey = a.canonical_module_key || a.module_key;
                const isInPlan = isAllowed(effectiveModuleKey) && !isContracted;
                const isConfiguredInStripe = Boolean(a.stripe_price_id_live || a.stripe_price_id_test);
                const isEligibleForPlan = !a.eligible_plan_keys || !plan?.slug || a.eligible_plan_keys.includes(plan.slug);

                return (
                  <div
                    key={a.id}
                    className={`rounded-2xl border p-5 flex flex-col ${
                      isContracted
                        ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.08] to-transparent"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                        isContracted ? "bg-emerald-500/15 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/25"
                      }`}>
                        <Icon className={`w-5 h-5 ${isContracted ? "text-emerald-300" : "text-amber-300"}`} />
                      </div>
                      {isContracted && (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                          Ativo
                        </Badge>
                      )}
                      {isInPlan && (
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">
                          Incluído no plano
                        </Badge>
                      )}
                      {!isContracted && !isInPlan && !isConfiguredInStripe && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                          Em breve
                        </Badge>
                      )}
                      {!isContracted && !isInPlan && isConfiguredInStripe && !isEligibleForPlan && (
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[10px]">
                          Requer upgrade
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-base">{a.name}</h3>
                    <p className="text-xs text-white/60 mt-1 mb-3 min-h-[32px]">{a.description}</p>

                    {Array.isArray(a.benefits) && a.benefits.length > 0 && (
                      <ul className="space-y-1.5 mb-4">
                        {a.benefits.slice(0, 3).map((b, i) => (
                          <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-auto flex items-end justify-between pt-3 border-t border-white/10">
                      <div>
                        <div className="text-[10px] text-white/40 uppercase">
                          {cycleResolution.status === "valid" && cycleResolution.cycle === "annual" ? "plano anual" : "a partir de"}
                        </div>
                        <div className="text-xl font-bold text-white">
                          R$ {cycleResolution.status === "valid" && cycleResolution.cycle === "annual"
                            ? Number(a.annual_price ?? a.monthly_price * 10).toFixed(2)
                            : Number(a.monthly_price).toFixed(2)}
                          <span className="text-xs text-white/50 font-normal">
                            {cycleResolution.status === "valid" && cycleResolution.cycle === "annual" ? "/ano" : "/mês"}
                          </span>
                        </div>
                      </div>
                      {isInPlan ? (
                        <Link to="/settings">
                          <Button size="sm" variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20">
                            Ativar
                          </Button>
                        </Link>
                      ) : isContracted ? (
                        <Link to="/subscription">
                          <Button size="sm" variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20">
                            Gerenciar
                          </Button>
                        </Link>
                      ) : !isConfiguredInStripe ? (
                        <Button size="sm" disabled className="bg-white/10 text-white/40 cursor-not-allowed">
                          Indisponível
                        </Button>
                      ) : !isEligibleForPlan ? (
                        <Button size="sm" disabled className="bg-white/10 text-white/40 cursor-not-allowed">
                          Não elegível
                        </Button>
                      ) : isOwnerLoading || cycleResolution.status === "loading" ? (
                        <Button size="sm" disabled className="bg-white/5 text-white/40 border border-white/10 cursor-not-allowed text-xs">
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Verificando...
                        </Button>
                      ) : !isOwner ? (
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            size="sm"
                            disabled
                            className="bg-white/5 text-white/40 border border-white/10 cursor-not-allowed text-xs"
                            aria-disabled="true"
                          >
                            Contratar
                          </Button>
                          <span className="text-[10px] text-amber-300/80 text-right font-medium max-w-[170px] leading-tight">
                            Somente o proprietário pode contratar add-ons.
                          </span>
                        </div>
                      ) : cycleResolution.status === "unknown" ? (
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            size="sm"
                            disabled
                            className="bg-white/5 text-white/40 border border-white/10 cursor-not-allowed text-xs"
                            aria-disabled="true"
                          >
                            Contratar
                          </Button>
                          <span className="text-[10px] text-amber-300/80 text-right font-medium max-w-[170px] leading-tight">
                            {cycleResolution.reason === "no_active_subscription"
                              ? "Requer assinatura ativa para contratar add-ons."
                              : "Ciclo de cobrança não identificado."}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addToCart(a)}
                            disabled={cartIds.has(a.id)}
                            className="border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 h-8 px-2"
                            title={cartIds.has(a.id) ? "Já está no carrinho" : "Adicionar ao carrinho"}
                          >
                            {cartIds.has(a.id) ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setSelectedAddon(a)}
                            disabled={!canAddMoreAddons}
                            title={!canAddMoreAddons ? "Limite de add-ons do seu plano atingido" : undefined}
                            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold disabled:opacity-50"
                          >
                            Contratar
                            <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Upgrade hint */}
        {totalAddonsCost > 0 && (
          <div className="mt-10 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-transparent p-6 text-center">
            <h3 className="text-lg font-bold text-white mb-2">Dica de economia</h3>
            <p className="text-sm text-white/70 mb-4">
              Se você contratar muitos módulos avulsos, pode ser mais barato migrar para um plano superior.
              Compare com o Plano Pro e veja se vale o upgrade.
            </p>
            <Link to="/subscription">
              <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold">
                Comparar planos
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      <SubscribeAddonDialog
        open={!!selectedAddon}
        onOpenChange={(o) => !o && setSelectedAddon(null)}
        addon={selectedAddon}
        isOwner={isOwner}
        isOwnerLoading={isOwnerLoading}
        cycleResolution={cycleResolution}
      />

      <AddonsCartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        lines={cartLines}
        cycle={cartCycle}
        onCycleChange={setCartCycle}
        onRemove={removeFromCart}
        onQuantityChange={updateQty}
        onClear={() => setCartLines([])}
        isOwner={isOwner}
        isOwnerLoading={isOwnerLoading}
        cycleResolution={cycleResolution}
      />

      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-2xl shadow-amber-500/30 hover:scale-105 transition-transform"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-sm">{cartCount} {cartCount === 1 ? "módulo" : "módulos"}</span>
          <Badge className="bg-black/20 text-black border-0 text-xs">Revisar</Badge>
        </button>
      )}
    </div>
  );
}
