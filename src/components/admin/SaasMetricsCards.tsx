import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Calendar,
  CreditCard,
  Percent,
  Layers,
  Store,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PlanRow {
  id: string;
  slug: string | null;
  name: string;
  price_monthly: number;
  tier: number | null;
  stripe_price_id_live?: string | null;
  stripe_price_id_test?: string | null;
}

interface BarbershopRow {
  id: string;
  name: string;
  plan_id: string | null;
  owner_id: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  plan: string | null;
  trial_start: string | null;
  trial_end: string | null;
  is_internal_test_tenant: boolean;
}

interface SubscriptionRow {
  id: string;
  price_id: string | null;
  status: string;
  is_internal_test_tenant?: boolean;
}

interface Metrics {
  effectiveMrr: number;
  effectiveArr: number;
  activeStripeSubs: number;
  totalShops: number;
  assignedPlansCount: number;
  catalogEstimatedValue: number;
  activeTrialsCount: number;
  byPlan: { name: string; slug: string; count: number; estimatedValue: number; color: string }[];
}

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-blue-500",
  pro: "bg-amber-500",
  professional: "bg-amber-500",
  elite: "bg-purple-500",
  enterprise: "bg-emerald-500",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SaasMetricsCards() {
  const { data: metrics, isLoading } = useQuery<Metrics>({
    queryKey: ["saas-metrics-canonical"],
    queryFn: async () => {
      const [{ data: plans }, { data: shops }, { data: subs }, { data: profiles }] =
        await Promise.all([
          supabase
            .from("plans")
            .select(
              "id, slug, name, price_monthly, tier, stripe_price_id_live, stripe_price_id_test",
            ),
          supabase.from("barbershops").select("id, name, plan_id, owner_id, created_at"),
          supabase.from("subscriptions").select("id, price_id, status, is_internal_test_tenant"),
          supabase
            .from("profiles")
            .select("id, plan, trial_start, trial_end, is_internal_test_tenant"),
        ]);

      const plansList = (plans || []) as unknown as PlanRow[];
      const shopsList = (shops || []) as unknown as BarbershopRow[];
      const subsList = (subs || []) as unknown as SubscriptionRow[];
      const profilesList = (profiles || []) as unknown as ProfileRow[];

      const planById = new Map<string, PlanRow>();
      plansList.forEach((p) => {
        planById.set(p.id, p);
        if (p.slug) planById.set(p.slug.toLowerCase(), p);
        if (p.name) planById.set(p.name.toLowerCase(), p);
        if (p.stripe_price_id_live) planById.set(p.stripe_price_id_live, p);
        if (p.stripe_price_id_test) planById.set(p.stripe_price_id_test, p);
      });

      const profileById = new Map<string, ProfileRow>();
      profilesList.forEach((pr) => profileById.set(pr.id, pr));

      // 1. MRR Efetivo (exclusivo de assinaturas Stripe ativas)
      let effectiveMrr = 0;
      let activeStripeSubs = 0;

      for (const sub of subsList) {
        if (sub.status === "active" && !sub.is_internal_test_tenant) {
          activeStripeSubs += 1;
          if (sub.price_id) {
            const plan = planById.get(sub.price_id);
            if (plan) effectiveMrr += Number(plan.price_monthly) || 0;
          }
        }
      }

      // 2. Planos atribuídos de catálogo (Homologação / Não faturado)
      let catalogEstimatedValue = 0;
      let assignedPlansCount = 0;
      const byPlanMap = new Map<
        string,
        { name: string; slug: string; count: number; estimatedValue: number }
      >();

      for (const shop of shopsList) {
        let plan: PlanRow | undefined;
        if (shop.plan_id) {
          plan = planById.get(shop.plan_id);
        }
        if (!plan && shop.owner_id) {
          const prof = profileById.get(shop.owner_id);
          if (prof?.plan) {
            plan = planById.get(prof.plan.toLowerCase());
          }
        }

        if (plan) {
          assignedPlansCount += 1;
          const price = Number(plan.price_monthly) || 0;
          catalogEstimatedValue += price;
          const slug = (plan.slug || plan.name).toLowerCase();
          const entry = byPlanMap.get(slug) || {
            name: plan.name,
            slug,
            count: 0,
            estimatedValue: 0,
          };
          entry.count += 1;
          entry.estimatedValue += price;
          byPlanMap.set(slug, entry);
        }
      }

      const byPlan = Array.from(byPlanMap.values())
        .sort((a, b) => b.estimatedValue - a.estimatedValue)
        .map((p) => ({ ...p, color: PLAN_COLORS[p.slug] || "bg-blue-500" }));

      // 3. Trials vigentes comprovados
      const now = new Date();
      let activeTrialsCount = 0;
      for (const shop of shopsList) {
        const owner = shop.owner_id ? profileById.get(shop.owner_id) : profileById.get(shop.id);
        if (owner?.trial_end) {
          const tEnd = new Date(owner.trial_end);
          if (tEnd > now) {
            activeTrialsCount += 1;
          }
        }
      }

      return {
        effectiveMrr,
        effectiveArr: effectiveMrr * 12,
        activeStripeSubs,
        totalShops: shopsList.length,
        assignedPlansCount,
        catalogEstimatedValue,
        activeTrialsCount,
        byPlan,
      };
    },
    staleTime: 30_000,
  });

  if (isLoading || !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "MRR Efetivo (Stripe)",
      value: fmtBRL(metrics.effectiveMrr),
      subtitle: "Faturado recorrente",
      icon: TrendingUp,
      color: "text-emerald-400",
      border: "border-emerald-500/30",
    },
    {
      label: "ARR Efetivo",
      value: fmtBRL(metrics.effectiveArr),
      subtitle: "Base anual real",
      icon: Calendar,
      color: "text-blue-400",
      border: "border-blue-500/30",
    },
    {
      label: "Assinaturas Stripe",
      value: String(metrics.activeStripeSubs),
      subtitle: "Pré-lançamento",
      icon: CreditCard,
      color: "text-purple-400",
      border: "border-purple-500/30",
    },
    {
      label: "Total Barbearias",
      value: String(metrics.totalShops),
      subtitle: "public.barbershops",
      icon: Store,
      color: "text-cyan-400",
      border: "border-cyan-500/30",
    },
    {
      label: "Planos Atribuídos",
      value: `${metrics.assignedPlansCount} (${fmtBRL(metrics.catalogEstimatedValue)})`,
      subtitle: "Est. não faturada",
      icon: Layers,
      color: "text-amber-400",
      border: "border-amber-500/30",
    },
    {
      label: "Trials Vigentes",
      value: String(metrics.activeTrialsCount),
      subtitle: "Com término futuro",
      icon: Clock,
      color: "text-pink-400",
      border: "border-pink-500/30",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-px w-8 bg-amber-500" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-400">
            Métricas SaaS Reconciliadas — Barbex
          </span>
        </div>
        <span className="text-xs text-gray-500">
          Entidade canônica:{" "}
          <strong className="text-gray-300">public.barbershops ({metrics.totalShops})</strong>
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className={cn("glass rounded-2xl border-2", c.border)}>
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white/70">
                  {c.label}
                </span>
                <c.icon className={cn("w-4 h-4 shrink-0", c.color)} />
              </div>
              <div>
                <div className="text-xl font-black text-white tracking-tight leading-none mb-1">
                  {c.value}
                </div>
                <span className="text-[10px] text-gray-400 font-medium">{c.subtitle}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Planos de Catálogo Atribuídos */}
      <Card className="glass rounded-2xl border border-white/10">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                Planos Atribuídos às Barbearias (Catálogo)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="w-4 h-4 text-amber-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-gray-900 border-white/10 text-white max-w-sm">
                      Valores nominais baseados nos planos vinculados às barbearias em ambiente de
                      homologação. Não constituem receita realizada nem MRR efetivo.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h3>
              <p className="text-xs text-white/50 mt-1">
                Estimativa nominal não faturada ({metrics.assignedPlansCount} de{" "}
                {metrics.totalShops} barbearias com plano atribuído)
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-white/50 block">Estimativa Não Faturada:</span>
              <strong className="text-amber-400 text-sm">
                {fmtBRL(metrics.catalogEstimatedValue)}/mês
              </strong>
            </div>
          </div>

          {metrics.byPlan.length === 0 ? (
            <p className="text-sm text-white/50">Nenhuma barbearia com plano atribuído.</p>
          ) : (
            <div className="space-y-4">
              {metrics.byPlan.map((p) => {
                const pct = metrics.catalogEstimatedValue
                  ? (p.estimatedValue / metrics.catalogEstimatedValue) * 100
                  : 0;
                return (
                  <div key={p.slug}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-white uppercase tracking-wider">
                        {p.name}
                      </span>
                      <span className="text-white/60">
                        {p.count} {p.count === 1 ? "barbearia" : "barbearias"} ·{" "}
                        <strong className="text-white">
                          {fmtBRL(p.estimatedValue)}/mês (nominal)
                        </strong>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={cn("h-full transition-all", p.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
