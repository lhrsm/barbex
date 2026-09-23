import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard,
  Search,
  Filter,
  User,
  Store,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

export const Route = createFileRoute("/admin/subscriptions")({
  component: AdminSubscriptions,
  head: () => ({
    title: "Assinaturas & Planos | Barbex Super Admin",
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

interface BarbershopDbRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  plan_id: string | null;
  created_at: string;
}

interface ProfileDbRow {
  id: string;
  business_name: string | null;
  responsible_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  plan: string | null;
  trial_start: string | null;
  trial_end: string | null;
  is_internal_test_tenant: boolean | null;
}

interface PlanDbRow {
  id: string;
  name: string;
  price_monthly: number;
  tier: number | null;
}

interface SubscriptionDbRow {
  id: string;
  user_id: string | null;
  stripe_subscription_id: string | null;
  product_id: string | null;
  price_id: string | null;
  status: string;
  current_period_end: string | null;
  profiles?: {
    business_name: string | null;
    whatsapp_number: string | null;
    email: string | null;
  } | null;
}

interface TenantPlanRecord {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  plan_id: string | null;
  created_at: string;
  owner_name: string;
  owner_email: string | null;
  whatsapp_number: string | null;
  assigned_plan_name: string | null;
  profile_plan_name: string | null;
  is_divergent: boolean;
  trial_start: string | null;
  trial_end: string | null;
  trial_status: "expired" | "active" | "undelimited";
  trial_label: string;
  stripe_status: "active" | "none";
}

function AdminSubscriptions() {
  const [search, setSearch] = useState("");

  // 1. Assinaturas Stripe canônicas da tabela subscriptions
  const { data: stripeSubscriptions, isLoading: isLoadingSubs } = useQuery<SubscriptionDbRow[]>({
    queryKey: ["admin-stripe-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          `
          id,
          user_id,
          stripe_subscription_id,
          product_id,
          price_id,
          status,
          current_period_end,
          profiles:user_id (
            business_name,
            whatsapp_number,
            email
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[AdminSubscriptions] Erro ao buscar assinaturas Stripe:", error);
        throw error;
      }
      return (data || []) as unknown as SubscriptionDbRow[];
    },
  });

  // 2. Estabelecimentos canônicos (public.barbershops), perfis e planos
  const { data: tenantPlans, isLoading: isLoadingTenants } = useQuery<TenantPlanRecord[]>({
    queryKey: ["admin-tenant-plans-canonical"],
    queryFn: async () => {
      const [
        { data: barbershops, error: bErr },
        { data: profiles, error: pErr },
        { data: plans, error: plErr },
      ] = await Promise.all([
        supabase
          .from("barbershops")
          .select("id, name, slug, owner_id, plan_id, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select(
            "id, business_name, responsible_name, display_name, email, phone, whatsapp_number, plan, trial_start, trial_end, is_internal_test_tenant",
          ),
        supabase.from("plans").select("id, name, price_monthly, tier"),
      ]);

      if (bErr) throw bErr;
      if (pErr) console.warn("[AdminSubscriptions] Aviso ao consultar perfis:", pErr);
      if (plErr) console.warn("[AdminSubscriptions] Aviso ao consultar planos:", plErr);

      const profileMap = new Map<string, ProfileDbRow>();
      ((profiles || []) as unknown as ProfileDbRow[]).forEach((p) => profileMap.set(p.id, p));

      const planMap = new Map<string, PlanDbRow>();
      ((plans || []) as unknown as PlanDbRow[]).forEach((pl) => planMap.set(pl.id, pl));

      const now = new Date();

      const records: TenantPlanRecord[] = ((barbershops || []) as unknown as BarbershopDbRow[]).map(
        (b) => {
          const owner = b.owner_id ? profileMap.get(b.owner_id) : profileMap.get(b.id);
          const assignedPlan = b.plan_id ? planMap.get(b.plan_id) : null;
          const assignedPlanName = assignedPlan?.name || null;
          const profilePlanName = owner?.plan ? owner.plan.trim() : null;

          // Divergência entre barbershops.plan_id e profiles.plan
          let isDivergent = false;
          if (assignedPlanName && profilePlanName) {
            isDivergent = assignedPlanName.toLowerCase() !== profilePlanName.toLowerCase();
          } else if (
            (assignedPlanName && !profilePlanName) ||
            (!assignedPlanName && profilePlanName)
          ) {
            isDivergent = true;
          }

          // Situação do Trial
          const trialStart = owner?.trial_start || null;
          const trialEnd = owner?.trial_end || null;
          let trialStatus: "expired" | "active" | "undelimited" = "undelimited";
          let trialLabel = "Trial sem término delimitado (Homologação)";

          if (trialEnd) {
            const endDate = new Date(trialEnd);
            if (endDate < now) {
              trialStatus = "expired";
              trialLabel = `Expirado em ${format(endDate, "dd/MM/yyyy")}`;
            } else {
              trialStatus = "active";
              trialLabel = `Vigente até ${format(endDate, "dd/MM/yyyy")}`;
            }
          }

          return {
            id: b.id,
            name: b.name || "Sem Nome",
            slug: b.slug,
            owner_id: b.owner_id,
            plan_id: b.plan_id,
            created_at: b.created_at,
            owner_name:
              owner?.responsible_name ||
              owner?.display_name ||
              owner?.business_name ||
              "Não informado",
            owner_email: owner?.email || null,
            whatsapp_number: owner?.whatsapp_number || owner?.phone || null,
            assigned_plan_name: assignedPlanName,
            profile_plan_name: profilePlanName,
            is_divergent: isDivergent,
            trial_start: trialStart,
            trial_end: trialEnd,
            trial_status: trialStatus,
            trial_label: trialLabel,
            stripe_status: "none",
          };
        },
      );

      return records;
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-none shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            Ativa
          </Badge>
        );
      case "trialing":
        return <Badge className="bg-blue-500/20 text-blue-400 border-none">Trial</Badge>;
      case "past_due":
        return <Badge className="bg-amber-500/20 text-amber-400 border-none">Atrasada</Badge>;
      case "canceled":
        return <Badge className="bg-rose-500/20 text-rose-400 border-none">Cancelada</Badge>;
      default:
        return (
          <Badge variant="outline" className="text-gray-400 border-white/10">
            {status}
          </Badge>
        );
    }
  };

  const filteredSubs = (stripeSubscriptions || []).filter((sub) => {
    const q = search.toLowerCase();
    const biz = sub.profiles?.business_name?.toLowerCase() || "";
    const stripeId = sub.stripe_subscription_id?.toLowerCase() || "";
    return biz.includes(q) || stripeId.includes(q);
  });

  const filteredTenants = (tenantPlans || []).filter((t: TenantPlanRecord) => {
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      t.owner_name.toLowerCase().includes(q) ||
      (t.owner_email && t.owner_email.toLowerCase().includes(q))
    );
  });

  // Métricas de topo reconciliadas
  const totalTenantsCount = tenantPlans?.length || 0;
  const activeStripeSubsCount = (stripeSubscriptions || []).filter(
    (s) => s.status === "active",
  ).length;
  const assignedPlansCount = (tenantPlans || []).filter(
    (t) => t.assigned_plan_name || t.profile_plan_name,
  ).length;

  return (
    <div className="space-y-8 pb-20">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white italic">
            ASSINATURAS & PLANOS
          </h2>
          <p className="text-gray-400 font-medium">
            Reconciliação entre faturamento recorrente Stripe e planos/trials dos estabelecimentos
            cadastrados.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar por barbearia, proprietário ou ID..."
              className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-2xl bg-white/5 border-white/10"
            aria-label="Filtrar"
          >
            <Filter className="h-5 w-5 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* Cards de Resumo Executivo Reconciliado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass border-white/5 bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              Barbearias Cadastradas
            </CardDescription>
            <CardTitle className="text-3xl font-black text-white">
              {isLoadingTenants ? "..." : totalTenantsCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-blue-400 font-medium flex items-center gap-1">
              <Store className="w-3.5 h-3.5" /> Entidade canônica (public.barbershops)
            </span>
          </CardContent>
        </Card>

        <Card className="glass border-white/5 bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              Assinaturas Stripe Ativas
            </CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-400">
              {isLoadingSubs ? "..." : activeStripeSubsCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Pré-lançamento comercial
            </span>
          </CardContent>
        </Card>

        <Card className="glass border-white/5 bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              MRR Efetivo (Stripe)
            </CardDescription>
            <CardTitle className="text-3xl font-black text-white">R$ 0,00</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-gray-400 font-medium">
              Receita recorrente efetivamente faturada
            </span>
          </CardContent>
        </Card>

        <Card className="glass border-white/5 bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              Planos Atribuídos (Catálogo)
            </CardDescription>
            <CardTitle className="text-3xl font-black text-purple-400">
              {isLoadingTenants ? "..." : assignedPlansCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-amber-400/90 font-medium flex items-center gap-1 cursor-help">
                    <AlertCircle className="w-3.5 h-3.5" /> Est. R$ 329,60/mês (Não faturado)
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-gray-900 border-white/10 text-white max-w-xs">
                  Valor nominal dos planos de teste/catálogo atribuídos às barbearias. Não constitui
                  MRR nem receita realizada.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO 1: ASSINATURAS STRIPE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              1. Assinaturas Stripe (Faturamento Recorrente SaaS)
            </h3>
            <p className="text-sm text-gray-400">
              Registros reais de cobrança recorrente integrados via gateway Stripe.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs"
          >
            Fonte: public.subscriptions
          </Badge>
        </div>

        <Card className="glass border-white/5 rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px] py-4 pl-8">
                    Cliente / Empresa
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                    Stripe Subscription ID
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                    Plano / Preço
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                    Status
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                    Vencimento / Período
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingSubs ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i} className="border-white/5">
                      <TableCell
                        colSpan={5}
                        className="py-6 text-center animate-pulse text-gray-500"
                      >
                        Carregando assinaturas Stripe...
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredSubs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                        <CreditCard className="w-8 h-8 text-gray-500 mb-1" />
                        <span className="font-semibold text-white">
                          Nenhuma assinatura Stripe registrada
                        </span>
                        <p className="text-xs text-gray-400">
                          A plataforma está em pré-lançamento comercial. Nenhum estabelecimento
                          possui cobrança recorrente Stripe ativa. Os estabelecimentos cadastrados
                          constam na seção abaixo.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubs.map((sub) => (
                    <TableRow
                      key={sub.id}
                      className="border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <TableCell className="py-4 pl-8">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <User className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div>
                            <span className="font-bold text-white text-sm block">
                              {sub.profiles?.business_name || "Usuário SaaS"}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {sub.profiles?.email || "Sem email"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-300">
                        {sub.stripe_subscription_id || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-purple-500/30 text-purple-400 bg-purple-500/5 text-[10px] uppercase font-bold"
                        >
                          {sub.product_id?.split("_").pop() || "PLANO"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell className="text-xs text-gray-300">
                        {sub.current_period_end
                          ? format(new Date(sub.current_period_end), "dd 'de' MMM, yyyy", {
                              locale: ptBR,
                            })
                          : "Sem data"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO 2: PLANOS E TRIALS DAS BARBEARIAS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-400" />
              2. Planos e Trials das Barbearias Cadastradas
            </h3>
            <p className="text-sm text-gray-400">
              Estabelecimentos da entidade canônica (public.barbershops), proprietários vinculados,
              planos e vigência de trials.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs w-fit"
          >
            5 Barbearias Cadastradas
          </Badge>
        </div>

        <Card className="glass border-white/5 rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px] py-4 pl-8">
                    Estabelecimento
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                    Proprietário Vinculado
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                    Plano Atribuído & Fonte
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                    Trial / Vigência
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                    Ambiente
                  </TableHead>
                  <TableHead className="text-right text-gray-400 font-bold uppercase tracking-widest text-[10px] pr-8">
                    Stripe Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTenants ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-white/5">
                      <TableCell
                        colSpan={6}
                        className="py-6 text-center animate-pulse text-gray-500"
                      >
                        Carregando estabelecimentos cadastrados...
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-gray-500 italic">
                      Nenhum estabelecimento encontrado para a busca.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map((t: TenantPlanRecord) => (
                    <TableRow
                      key={t.id}
                      className="border-white/5 hover:bg-white/5 transition-colors"
                    >
                      {/* Estabelecimento */}
                      <TableCell className="py-4 pl-8">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm">{t.name}</span>
                          <span className="text-[11px] text-gray-500 font-mono">ID: {t.id}</span>
                          <span className="text-[10px] text-purple-400/80">/{t.slug}</span>
                        </div>
                      </TableCell>

                      {/* Proprietário */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-200">{t.owner_name}</span>
                          {t.owner_email && (
                            <span className="text-[11px] text-gray-400">{t.owner_email}</span>
                          )}
                          <span className="text-[10px] text-gray-500 font-mono">
                            Owner ID: {t.owner_id || "Mesmo que Barbershop"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Plano Atribuído & Divergência */}
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className="border-purple-500/30 text-purple-300 bg-purple-500/10 text-xs font-semibold uppercase"
                            >
                              {t.assigned_plan_name ||
                                (t.profile_plan_name
                                  ? `Perfil: ${t.profile_plan_name}`
                                  : "Não Atribuído")}
                            </Badge>
                            {t.is_divergent && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] flex items-center gap-1 cursor-help">
                                      <AlertTriangle className="w-3 h-3 text-amber-400" /> Plano a
                                      verificar
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-gray-900 border-white/10 text-white text-xs max-w-xs">
                                    Divergência de cadastro: barbershops.plan_id aponta para &ldquo;
                                    {t.assigned_plan_name || "Nenhum"}&rdquo;, enquanto
                                    profiles.plan indica &ldquo;{t.profile_plan_name || "Nenhum"}
                                    &rdquo;.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500">
                            Fonte: {t.assigned_plan_name ? "barbershops.plan_id" : "profiles.plan"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Trial / Vigência */}
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            {t.trial_status === "expired" ? (
                              <Badge className="bg-rose-500/20 text-rose-400 border-none text-[10px] flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {t.trial_label}
                              </Badge>
                            ) : t.trial_status === "active" ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[10px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> {t.trial_label}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-blue-500/30 text-blue-300 bg-blue-500/5 text-[10px]"
                              >
                                {t.trial_label}
                              </Badge>
                            )}
                          </div>
                          {t.trial_start && (
                            <span className="text-[10px] text-gray-500 mt-0.5">
                              Início: {format(new Date(t.trial_start), "dd/MM/yyyy")}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Ambiente / Concessão */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-white/10 text-gray-300 bg-white/5 text-[10px]"
                        >
                          Homologação / Pré-lançamento
                        </Badge>
                      </TableCell>

                      {/* Estado Stripe */}
                      <TableCell className="text-right pr-8">
                        <Badge
                          variant="outline"
                          className="border-gray-700 text-gray-400 bg-transparent text-[10px]"
                        >
                          Sem Assinatura Stripe
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
