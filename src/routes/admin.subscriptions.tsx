import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifyTenant, CommercialClassification } from "@/lib/commercial-classification";
import {
  CreditCard,
  Search,
  Filter,
  User,
  Store,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Settings2,
  Package,
  Layers,
  X,
  ShieldAlert,
} from "lucide-react";
import { AdminSubscriptionOperationsModal } from "@/components/admin/AdminSubscriptionOperationsModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/admin/subscriptions")({
  component: AdminSubscriptionsCommercialCenter,
  head: () => ({
    title: "Centro de Controle Comercial | Barbex Super Admin",
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
  barbershop_id?: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  product_id?: string | null;
  price_id: string | null;
  status: string;
  billing_cycle: string | null;
  plan_key: string | null;
  latest_event_timestamp?: string | null;
  environment: string | null;
  current_period_start?: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  past_due_since?: string | null;
  grace_ends_at?: string | null;
  payment_failed_at?: string | null;
  is_internal_test_tenant?: boolean | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    business_name: string | null;
    whatsapp_number: string | null;
    email: string | null;
  } | null;
}

interface TenantAddonDbRow {
  id: string;
  tenant_id: string;
  addon_id: string;
  status: string;
  quantity: number;
  unit_price: number;
  currency: string;
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
  saas_addons?: {
    name: string;
    addon_key: string;
  } | null;
}

export interface UnifiedCommercialTenantRecord {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  created_at: string;
  owner_name: string;
  owner_email: string | null;
  classification: CommercialClassification;
  // Assinatura Stripe Canônica
  hasStripeSub: boolean;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
  billingCycle: string | null;
  planKey: string | null;
  environment: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  // Valores e Add-ons
  baseRecurringAmount: number | null;
  activeAddonsCount: number;
  addonsList: string[];
  addonsRecurringAmount: number | null;
  totalRecurringAmount: number | null;
  // Situação de Cobrança / Grace
  pastDueSince: string | null;
  graceEndsAt: string | null;
  isPastDue: boolean;
  isInGrace: boolean;
  isGraceExpired: boolean;
}

const formatCurrencyBrl = (val: number | null | undefined): string => {
  if (val == null || isNaN(val)) return "Dados indisponíveis";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
};

const formatPlanName = (planKey: string | null | undefined): string => {
  if (!planKey) return "Não informado";
  const normalized = planKey.trim().toLowerCase();
  if (normalized === "starter") return "Starter";
  if (normalized === "pro" || normalized === "professional") return "Pro";
  if (normalized === "elite") return "Elite";
  if (normalized === "free") return "Free";
  return planKey.toUpperCase();
};

const formatCycleLabel = (cycle: string | null | undefined): string => {
  if (!cycle) return "—";
  const normalized = cycle.trim().toLowerCase();
  if (normalized === "month" || normalized === "monthly") return "Mensal";
  if (normalized === "year" || normalized === "yearly") return "Anual";
  return cycle;
};

function AdminSubscriptionsCommercialCenter() {
  const [search, setSearch] = useState("");
  const [selectedModality, setSelectedModality] = useState<string>("ALL");
  const [selectedSubStatus, setSelectedSubStatus] = useState<string>("ALL");
  const [selectedCycle, setSelectedCycle] = useState<string>("ALL");
  const [selectedAddonsFilter, setSelectedAddonsFilter] = useState<string>("ALL");
  const [selectedEnvFilter, setSelectedEnvFilter] = useState<string>("ALL");

  const [operationsModal, setOperationsModal] = useState<{
    isOpen: boolean;
    tenant: UnifiedCommercialTenantRecord | null;
    initialTab?: "overview" | "subscription" | "addons" | "invoices" | "refunds" | "audit";
  }>({
    isOpen: false,
    tenant: null,
    initialTab: "overview",
  });

  // Consulta canônica completa
  const {
    data: commercialIndex = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<UnifiedCommercialTenantRecord[]>({
    queryKey: ["admin-commercial-control-center-index"],
    queryFn: async () => {
      const [
        { data: barbershops, error: bErr },
        { data: profiles, error: pErr },
        { data: plans, error: plErr },
        { data: subs, error: sErr },
        { data: tenantAddons, error: aErr },
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
        supabase
          .from("subscriptions")
          .select(
            "id, user_id, barbershop_id, stripe_subscription_id, stripe_customer_id, status, billing_cycle, plan_key, environment, current_period_start, current_period_end, cancel_at_period_end, past_due_since, grace_ends_at, payment_failed_at, is_internal_test_tenant, created_at, updated_at",
          ),
        supabase
          .from("tenant_addons")
          .select(
            "id, tenant_id, addon_id, status, quantity, unit_price, currency, cancel_at_period_end, current_period_end, saas_addons(name, addon_key)",
          ),
      ]);

      if (bErr) throw new Error("Erro ao consultar barbearias: " + bErr.message);
      if (sErr) throw new Error("Erro ao consultar assinaturas Stripe: " + sErr.message);
      if (pErr) console.warn("[CommercialCenter] Aviso ao consultar perfis:", pErr);
      if (plErr) console.warn("[CommercialCenter] Aviso ao consultar planos:", plErr);
      if (aErr) console.warn("[CommercialCenter] Aviso ao consultar tenant_addons:", aErr);

      const profileMap = new Map<string, ProfileDbRow>();
      ((profiles || []) as unknown as ProfileDbRow[]).forEach((p) => profileMap.set(p.id, p));

      const planMap = new Map<string, PlanDbRow>();
      ((plans || []) as unknown as PlanDbRow[]).forEach((pl) => planMap.set(pl.id, pl));

      const subsList = (subs || []) as unknown as SubscriptionDbRow[];
      const addonsList = (tenantAddons || []) as unknown as TenantAddonDbRow[];

      const now = new Date();

      const records: UnifiedCommercialTenantRecord[] = (
        (barbershops || []) as unknown as BarbershopDbRow[]
      ).map((b) => {
        const owner = b.owner_id ? profileMap.get(b.owner_id) : profileMap.get(b.id);
        const assignedPlan = b.plan_id ? planMap.get(b.plan_id) : null;
        const profilePlanName = owner?.plan ? owner.plan.trim() : null;

        // Subscrições deste tenant
        const tenantSubs = subsList.filter(
          (s) =>
            (s.barbershop_id && s.barbershop_id === b.id) ||
            s.user_id === b.owner_id ||
            s.user_id === b.id,
        );

        // Subscrição ativa canônica (se houver)
        const activeSub =
          tenantSubs.find((s) => s.status === "active" || s.status === "past_due") ||
          tenantSubs[0] ||
          null;

        // Classificação Comercial Canônica
        const classification = classifyTenant({
          id: b.id,
          name: b.name,
          slug: b.slug,
          owner_id: b.owner_id,
          plan_id: b.plan_id,
          created_at: b.created_at,
          ownerProfile: owner,
          assignedPlan,
          profilePlan: profilePlanName ? planMap.get(profilePlanName.toLowerCase()) : null,
          subscriptions: tenantSubs,
        });

        // Add-ons ativos deste tenant
        const activeAddons = addonsList.filter(
          (a) => a.tenant_id === b.id && a.status === "active",
        );
        const activeAddonsNames = activeAddons.map(
          (a) => a.saas_addons?.name || a.saas_addons?.addon_key || "Add-on",
        );
        const addonsRecurringTotal = activeAddons.reduce(
          (sum, a) => sum + (Number(a.unit_price) || 0) * (a.quantity || 1),
          0,
        );

        // Preço do plano base
        let basePrice: number | null = null;
        if (classification.modality === "ASSINATURA") {
          basePrice =
            assignedPlan?.price_monthly ?? (activeSub?.plan_key === "starter" ? 59.9 : null);
        } else if (classification.modality === "FREE") {
          basePrice = 0;
        }

        // Total recorrente
        let totalRecurring: number | null = null;
        if (classification.modality === "ASSINATURA" && basePrice != null) {
          totalRecurring = basePrice + addonsRecurringTotal;
        }

        // Verificação de Carência / Past Due
        const pastDueSince = activeSub?.past_due_since || null;
        const graceEndsAt = activeSub?.grace_ends_at || null;
        const isPastDue = activeSub?.status === "past_due";
        const isInGrace = Boolean(
          isPastDue && graceEndsAt && new Date(graceEndsAt).getTime() > now.getTime(),
        );
        const isGraceExpired = Boolean(
          isPastDue && graceEndsAt && new Date(graceEndsAt).getTime() <= now.getTime(),
        );

        return {
          id: b.id,
          name: b.name || "Sem Nome",
          slug: b.slug,
          owner_id: b.owner_id,
          created_at: b.created_at,
          owner_name:
            owner?.responsible_name ||
            owner?.display_name ||
            owner?.business_name ||
            "Não informado",
          owner_email: owner?.email || null,
          classification,
          hasStripeSub: Boolean(activeSub?.stripe_subscription_id),
          stripeSubscriptionId: activeSub?.stripe_subscription_id || null,
          stripeCustomerId: activeSub?.stripe_customer_id || null,
          subscriptionStatus: activeSub?.status || null,
          billingCycle: activeSub?.billing_cycle || null,
          planKey:
            activeSub?.plan_key ||
            classification.commercialPlanName ||
            classification.technicalPlanName ||
            null,
          environment: activeSub?.environment || null,
          currentPeriodEnd: activeSub?.current_period_end || null,
          cancelAtPeriodEnd: Boolean(activeSub?.cancel_at_period_end),
          baseRecurringAmount: basePrice,
          activeAddonsCount: activeAddons.length,
          addonsList: activeAddonsNames,
          addonsRecurringAmount: activeAddons.length > 0 ? addonsRecurringTotal : 0,
          totalRecurringAmount: totalRecurring,
          pastDueSince,
          graceEndsAt,
          isPastDue,
          isInGrace,
          isGraceExpired,
        };
      });

      return records;
    },
  });

  // Filtros Avançados
  const filteredRecords = useMemo(() => {
    return commercialIndex.filter((record) => {
      // 1. Busca textual
      const q = search.toLowerCase().trim();
      if (q) {
        const matchesName = record.name.toLowerCase().includes(q);
        const matchesSlug = record.slug.toLowerCase().includes(q);
        const matchesOwner = record.owner_name.toLowerCase().includes(q);
        const matchesEmail = record.owner_email?.toLowerCase().includes(q);
        const matchesId = record.id.toLowerCase().includes(q);
        if (!matchesName && !matchesSlug && !matchesOwner && !matchesEmail && !matchesId) {
          return false;
        }
      }

      // 2. Filtro de Modalidade Comercial
      if (selectedModality !== "ALL") {
        if (record.classification.modality !== selectedModality) return false;
      }

      // 3. Filtro de Status da Assinatura
      if (selectedSubStatus !== "ALL") {
        if (selectedSubStatus === "ACTIVE" && record.subscriptionStatus !== "active") return false;
        if (selectedSubStatus === "IN_GRACE" && !record.isInGrace) return false;
        if (selectedSubStatus === "PAST_DUE" && !record.isPastDue) return false;
        if (selectedSubStatus === "SCHEDULED_CANCEL" && !record.cancelAtPeriodEnd) return false;
        if (selectedSubStatus === "CANCELED" && record.subscriptionStatus !== "canceled")
          return false;
      }

      // 4. Filtro de Ciclo
      if (selectedCycle !== "ALL") {
        if (record.billingCycle?.toLowerCase() !== selectedCycle.toLowerCase()) return false;
      }

      // 5. Filtro de Add-ons
      if (selectedAddonsFilter === "WITH_ADDONS" && record.activeAddonsCount === 0) return false;
      if (selectedAddonsFilter === "NO_ADDONS" && record.activeAddonsCount > 0) return false;

      // 6. Filtro de Ambiente
      if (selectedEnvFilter === "LIVE" && record.environment !== "live") return false;
      if (selectedEnvFilter === "TEST" && record.environment !== "test") return false;
      if (selectedEnvFilter === "NO_STRIPE" && record.hasStripeSub) return false;

      return true;
    });
  }, [
    commercialIndex,
    search,
    selectedModality,
    selectedSubStatus,
    selectedCycle,
    selectedAddonsFilter,
    selectedEnvFilter,
  ]);

  // Contadores e Métricas
  const totalBarbershops = commercialIndex.length;
  const paidCommercialSubs = commercialIndex.filter(
    (r) => r.classification.modality === "ASSINATURA",
  );
  const paidCommercialCount = paidCommercialSubs.length;
  const totalMrr = paidCommercialSubs.reduce((acc, r) => acc + (r.totalRecurringAmount || 0), 0);
  const trialCount = commercialIndex.filter((r) => r.classification.modality === "TRIAL").length;
  const voucherCount = commercialIndex.filter(
    (r) => r.classification.modality === "VOUCHER",
  ).length;
  const freeCount = commercialIndex.filter((r) => r.classification.modality === "FREE").length;

  const isFiltered =
    search.trim() !== "" ||
    selectedModality !== "ALL" ||
    selectedSubStatus !== "ALL" ||
    selectedCycle !== "ALL" ||
    selectedAddonsFilter !== "ALL" ||
    selectedEnvFilter !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setSelectedModality("ALL");
    setSelectedSubStatus("ALL");
    setSelectedCycle("ALL");
    setSelectedAddonsFilter("ALL");
    setSelectedEnvFilter("ALL");
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-black tracking-tight text-white italic">
              CENTRO DE CONTROLE COMERCIAL
            </h2>
            <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold uppercase tracking-wider">
              SUPER ADMIN R2E.17E
            </Badge>
          </div>
          <p className="text-gray-400 font-medium text-sm mt-1">
            Visão consolidada de estabelecimentos, assinaturas Stripe, faturas, add-ons, estornos e
            trilhas de auditoria.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-11 rounded-2xl bg-white/5 border-white/10 hover:bg-white/10 text-xs font-bold text-gray-300 gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Recarregar Dados
          </Button>
        </div>
      </div>

      {/* Alerta Informativo de Produção (Empty State Canônico de Assinaturas) */}
      {paidCommercialCount === 0 && !isLoading && !isError && (
        <Card className="glass border-purple-500/30 bg-purple-950/20 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-tight">
                Nenhuma assinatura comercial ativa no momento
              </h4>
              <p className="text-xs text-gray-400 max-w-2xl mt-0.5">
                Todas as barbearias cadastradas estão sob modalidades de Teste (Trial), Concessão
                (Voucher) ou Plano Gratuito. Ações de ciclo de vida e estorno ficam habilitadas no
                painel detalhado de cada tenant conforme suas respectivas faturas Stripe.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-xs w-fit py-1 px-3 self-start sm:self-center"
          >
            0 Assinaturas Pagas
          </Badge>
        </Card>
      )}

      {/* Estado de Erro Explícito na Consulta */}
      {isError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-rose-400" />
          <div>
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">
              Falha ao carregar dados do Centro de Controle Comercial
            </h3>
            <p className="text-sm text-gray-400 max-w-md mt-1">
              {(error as Error)?.message || "Ocorreu um erro ao consultar o banco de dados."}
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="border-rose-500/30 text-rose-300 hover:bg-rose-500/20 rounded-xl gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <RefreshCw className="w-4 h-4" /> Tentar Novamente
          </Button>
        </div>
      )}

      {/* Cards de Métricas Consolidadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass border-white/5 bg-white/[0.02] rounded-3xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              Barbearias Cadastradas
            </CardDescription>
            <CardTitle className="text-3xl font-black text-white">
              {isLoading ? "..." : totalBarbershops}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-blue-400 font-medium flex items-center gap-1">
              <Store className="w-3.5 h-3.5" /> Estabelecimentos ativos no sistema
            </span>
          </CardContent>
        </Card>

        <Card className="glass border-white/5 bg-white/[0.02] rounded-3xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              Assinaturas Comerciais
            </CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-400">
              {isLoading ? "..." : `${paidCommercialCount} ativas`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {paidCommercialCount > 0
                ? "Faturamento recorrente Stripe"
                : "Sem assinantes pagantes"}
            </span>
          </CardContent>
        </Card>

        <Card className="glass border-white/5 bg-white/[0.02] rounded-3xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              MRR Contratado Efetivo
            </CardDescription>
            <CardTitle className="text-3xl font-black text-white">
              {isLoading ? "..." : formatCurrencyBrl(totalMrr)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-gray-400 font-medium">Planos base + módulos add-ons</span>
          </CardContent>
        </Card>

        <Card className="glass border-white/5 bg-white/[0.02] rounded-3xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              Composição de Acesso
            </CardDescription>
            <CardTitle className="text-xl font-bold text-purple-300">
              {isLoading
                ? "..."
                : `${trialCount} Trial · ${voucherCount} Vouch · ${freeCount} Free`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-purple-400" /> Modalidades sem cobrança
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca Operacional */}
      <Card className="glass border-white/5 bg-white/[0.02] p-4 rounded-3xl space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar por barbearia, slug, responsável, e-mail ou ID..."
              className="pl-12 h-11 bg-white/5 border-white/10 rounded-2xl text-white text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Modalidade */}
            <Select value={selectedModality} onValueChange={setSelectedModality}>
              <SelectTrigger className="h-11 w-40 bg-white/5 border-white/10 rounded-2xl text-xs text-white">
                <SelectValue placeholder="Modalidade" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectItem value="ALL">Todas Modalidades</SelectItem>
                <SelectItem value="ASSINATURA">Assinatura Stripe</SelectItem>
                <SelectItem value="TRIAL">Trial</SelectItem>
                <SelectItem value="VOUCHER">Voucher</SelectItem>
                <SelectItem value="FREE">Plano Free</SelectItem>
              </SelectContent>
            </Select>

            {/* Status da Assinatura */}
            <Select value={selectedSubStatus} onValueChange={setSelectedSubStatus}>
              <SelectTrigger className="h-11 w-44 bg-white/5 border-white/10 rounded-2xl text-xs text-white">
                <SelectValue placeholder="Status Stripe" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectItem value="ALL">Todos os Status</SelectItem>
                <SelectItem value="ACTIVE">Ativa</SelectItem>
                <SelectItem value="IN_GRACE">Em Carência (Grace)</SelectItem>
                <SelectItem value="PAST_DUE">Atrasada (Past Due)</SelectItem>
                <SelectItem value="SCHEDULED_CANCEL">Cancel. Agendado</SelectItem>
                <SelectItem value="CANCELED">Cancelada</SelectItem>
              </SelectContent>
            </Select>

            {/* Ciclo */}
            <Select value={selectedCycle} onValueChange={setSelectedCycle}>
              <SelectTrigger className="h-11 w-32 bg-white/5 border-white/10 rounded-2xl text-xs text-white">
                <SelectValue placeholder="Ciclo" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectItem value="ALL">Todos Ciclos</SelectItem>
                <SelectItem value="month">Mensal</SelectItem>
                <SelectItem value="year">Anual</SelectItem>
              </SelectContent>
            </Select>

            {/* Add-ons */}
            <Select value={selectedAddonsFilter} onValueChange={setSelectedAddonsFilter}>
              <SelectTrigger className="h-11 w-36 bg-white/5 border-white/10 rounded-2xl text-xs text-white">
                <SelectValue placeholder="Add-ons" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectItem value="ALL">Todos Add-ons</SelectItem>
                <SelectItem value="WITH_ADDONS">Com Add-ons</SelectItem>
                <SelectItem value="NO_ADDONS">Sem Add-ons</SelectItem>
              </SelectContent>
            </Select>

            {/* Ambiente */}
            <Select value={selectedEnvFilter} onValueChange={setSelectedEnvFilter}>
              <SelectTrigger className="h-11 w-36 bg-white/5 border-white/10 rounded-2xl text-xs text-white">
                <SelectValue placeholder="Ambiente" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectItem value="ALL">Todos Ambientes</SelectItem>
                <SelectItem value="LIVE">Stripe Live</SelectItem>
                <SelectItem value="TEST">Sandbox / Test</SelectItem>
                <SelectItem value="NO_STRIPE">Sem Stripe</SelectItem>
              </SelectContent>
            </Select>

            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-11 px-3 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-2xl gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Limpar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabela Primária de Estabelecimentos & Faturamento Canônico */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              Índice Comercial dos Estabelecimentos
            </h3>
            <p className="text-sm text-gray-400">
              Registros canônicos integrando identidade, classificação comercial, parâmetros Stripe
              e saldo recorrente.
            </p>
          </div>
          <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
            {filteredRecords.length} Estabelecimentos Exibidos
          </Badge>
        </div>

        <Card className="glass border-white/5 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-gray-400 font-bold uppercase tracking-wider text-[10px] py-4 pl-6 min-w-[200px]">
                    Barbearia / Contato
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-wider text-[10px] min-w-[120px]">
                    Modalidade
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-wider text-[10px] min-w-[100px]">
                    Plano Base
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-wider text-[10px] min-w-[80px]">
                    Ciclo
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-wider text-[10px] min-w-[100px]">
                    Valor Base
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-wider text-[10px] min-w-[110px]">
                    Add-ons Ativos
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-wider text-[10px] min-w-[110px]">
                    Total Recorrente
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-wider text-[10px] min-w-[120px]">
                    Renovação / Vigência
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-wider text-[10px] min-w-[120px]">
                    Situação Pagamento
                  </TableHead>
                  <TableHead className="text-gray-400 font-bold uppercase tracking-wider text-[10px] min-w-[90px]">
                    Ambiente
                  </TableHead>
                  <TableHead className="text-right text-gray-400 font-bold uppercase tracking-wider text-[10px] pr-6 min-w-[120px]">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="border-white/5">
                      <TableCell
                        colSpan={11}
                        className="py-8 text-center text-gray-500 animate-pulse"
                      >
                        Carregando estabelecimentos e dados comerciais...
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                        <Search className="w-8 h-8 text-gray-500 mb-1" />
                        <span className="font-semibold text-white">
                          Nenhum estabelecimento encontrado para os filtros selecionados.
                        </span>
                        <p className="text-xs text-gray-500">
                          Tente ajustar os parâmetros de busca ou clique em Limpar Filtros.
                        </p>
                        {isFiltered && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                            className="mt-2 text-xs border-white/10"
                          >
                            Limpar Filtros
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((t) => (
                    <TableRow
                      key={t.id}
                      className="border-white/5 hover:bg-white/[0.03] transition-colors"
                    >
                      {/* Barbearia / Contato */}
                      <TableCell className="pl-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm block">{t.name}</span>
                          <span className="text-[11px] text-gray-400 block">{t.owner_name}</span>
                          {t.owner_email && (
                            <span className="text-[10px] text-gray-500 font-mono">
                              {t.owner_email}
                            </span>
                          )}
                          <span className="text-[10px] text-purple-400/80 font-mono">
                            /{t.slug}
                          </span>
                        </div>
                      </TableCell>

                      {/* Modalidade */}
                      <TableCell>
                        <Badge
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            t.classification.modality === "ASSINATURA" &&
                              "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
                            t.classification.modality === "VOUCHER" &&
                              "bg-purple-500/20 text-purple-300 border border-purple-500/40",
                            t.classification.modality === "TRIAL" &&
                              (t.classification.trialStatus === "EXPIRADO"
                                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                : "bg-blue-500/15 text-blue-300 border border-blue-500/30"),
                            t.classification.modality === "FREE" &&
                              "bg-zinc-500/20 text-zinc-300 border border-zinc-500/30",
                          )}
                        >
                          {t.classification.modality}
                        </Badge>
                      </TableCell>

                      {/* Plano Base */}
                      <TableCell className="text-xs font-bold text-gray-200">
                        {formatPlanName(t.planKey)}
                      </TableCell>

                      {/* Ciclo */}
                      <TableCell className="text-xs text-gray-300">
                        {formatCycleLabel(t.billingCycle)}
                      </TableCell>

                      {/* Valor Base */}
                      <TableCell className="text-xs font-mono text-gray-200">
                        {t.classification.modality === "ASSINATURA"
                          ? formatCurrencyBrl(t.baseRecurringAmount)
                          : t.classification.modality === "FREE"
                            ? "R$ 0,00"
                            : "Não aplicável"}
                      </TableCell>

                      {/* Add-ons Ativos */}
                      <TableCell>
                        {t.activeAddonsCount > 0 ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                              {t.activeAddonsCount} ativo{t.activeAddonsCount > 1 ? "s" : ""}
                            </Badge>
                            <span className="text-[10px] text-gray-400 block font-mono">
                              {formatCurrencyBrl(t.addonsRecurringAmount)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500 font-mono">0 add-ons</span>
                        )}
                      </TableCell>

                      {/* Total Recorrente */}
                      <TableCell className="text-xs font-mono font-bold text-emerald-400">
                        {t.classification.modality === "ASSINATURA"
                          ? formatCurrencyBrl(t.totalRecurringAmount)
                          : "Não aplicável"}
                      </TableCell>

                      {/* Próxima Renovação / Vigência */}
                      <TableCell className="text-xs font-mono text-gray-300">
                        {t.classification.modality === "ASSINATURA" && t.currentPeriodEnd ? (
                          format(new Date(t.currentPeriodEnd), "dd/MM/yyyy", { locale: ptBR })
                        ) : t.classification.modality === "TRIAL" && t.classification.trialEnd ? (
                          <span
                            className={cn(
                              t.classification.trialStatus === "EXPIRADO"
                                ? "text-amber-400"
                                : "text-blue-300",
                            )}
                          >
                            {format(new Date(t.classification.trialEnd), "dd/MM/yyyy")}
                          </span>
                        ) : t.classification.modality === "VOUCHER" ? (
                          <span className="text-purple-300">Sem expiração</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </TableCell>

                      {/* Situação de Pagamento / Past Due / Grace */}
                      <TableCell>
                        {t.isInGrace ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                              IN_GRACE
                            </Badge>
                            {t.graceEndsAt && (
                              <span className="text-[10px] text-amber-400/80 block font-mono">
                                Até {format(new Date(t.graceEndsAt), "dd/MM HH:mm")}
                              </span>
                            )}
                          </div>
                        ) : t.isGraceExpired ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px]">
                              CARÊNCIA EXPIRADA
                            </Badge>
                          </div>
                        ) : t.cancelAtPeriodEnd ? (
                          <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                            CANCEL. AGENDADO
                          </Badge>
                        ) : t.classification.modality === "ASSINATURA" ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                            REGULAR
                          </Badge>
                        ) : (
                          <span className="text-gray-500 text-[10px] font-mono">SEM COBRANÇA</span>
                        )}
                      </TableCell>

                      {/* Ambiente Stripe */}
                      <TableCell>
                        {t.hasStripeSub ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] uppercase font-bold",
                              t.environment === "live"
                                ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                                : "border-amber-500/30 text-amber-300 bg-amber-500/10",
                            )}
                          >
                            {t.environment === "live" ? "LIVE" : "SANDBOX"}
                          </Badge>
                        ) : (
                          <span className="text-gray-500 text-[10px] font-mono">SEM STRIPE</span>
                        )}
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="text-right pr-6">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setOperationsModal({
                              isOpen: true,
                              tenant: t,
                              initialTab: "overview",
                            })
                          }
                          className="h-8 px-3 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 text-xs font-bold gap-1.5"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          Gerenciar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Surface Detalhada do Centro de Controle Comercial (Modal com 6 Abas) */}
      {operationsModal.tenant && (
        <AdminSubscriptionOperationsModal
          isOpen={operationsModal.isOpen}
          onClose={() => setOperationsModal((prev) => ({ ...prev, isOpen: false, tenant: null }))}
          tenantId={operationsModal.tenant.id}
          tenantName={operationsModal.tenant.name}
          initialTab={operationsModal.initialTab}
          tenantClassification={operationsModal.tenant.classification}
          ownerName={operationsModal.tenant.owner_name}
          ownerEmail={operationsModal.tenant.owner_email}
          baseRecurringAmount={operationsModal.tenant.baseRecurringAmount}
          addonsRecurringAmount={operationsModal.tenant.addonsRecurringAmount}
          totalRecurringAmount={operationsModal.tenant.totalRecurringAmount}
          graceEndsAt={operationsModal.tenant.graceEndsAt}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}
