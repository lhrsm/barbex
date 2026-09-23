import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifyTenant, CommercialClassification } from "@/lib/commercial-classification";
import {
  Search,
  MoreVertical,
  Ban,
  Unlock,
  ExternalLink,
  Filter,
  CreditCard,
  Building2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  User,
  Globe,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/tenants")({
  component: AdminTenants,
  head: () => ({
    title: "Gestor de Barbearias | Barbex Admin",
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  owner_id: string | null;
  plan_id: string | null;
  created_at: string;
  updated_at: string | null;
  // Resolved owner profile
  owner_name: string;
  owner_email: string | null;
  whatsapp_number: string | null;
  is_internal_test_tenant: boolean;
  status: "active" | "blocked";
  // Resolved plan status
  plan_status: "verified" | "to_verify";
  plan_label: string;
  plan_details: string;
  assigned_plan_name: string | null;
  profile_plan_name: string | null;
  classification: CommercialClassification;
  // Metrics
  stats: {
    customers: number;
    barbers: number;
    revenue: number;
  };
}

function AdminTenants() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    data: tenants,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-tenants-canonical"],
    queryFn: async () => {
      // 1. Consulta à entidade canônica public.barbershops
      const { data: barbershops, error: bError } = await supabase
        .from("barbershops")
        .select(
          `
          id,
          name,
          slug,
          logo_url,
          owner_id,
          plan_id,
          created_at,
          updated_at
        `,
        )
        .order("created_at", { ascending: false });

      if (bError) {
        console.error("[AdminTenants] Erro ao consultar barbershops:", bError);
        throw bError;
      }

      if (!barbershops || barbershops.length === 0) return [];

      // 2. Consulta paralela aos perfis, planos e assinaturas
      const [
        { data: profiles, error: pError },
        { data: plans, error: plError },
        { data: subs, error: sError },
      ] = await Promise.all([
        supabase.from("profiles").select(`
          id,
          business_name,
          responsible_name,
          display_name,
          email,
          phone,
          whatsapp_number,
          plan,
          status,
          created_at,
          is_internal_test_tenant,
          trial_start,
          trial_end
        `),
        supabase.from("plans").select("id, name, price_monthly, tier"),
        supabase.from("subscriptions").select("id, user_id, barbershop_id, status, price_id, is_internal_test_tenant"),
      ]);

      if (pError) console.warn("[AdminTenants] Aviso ao consultar profiles:", pError);
      if (plError) console.warn("[AdminTenants] Aviso ao consultar plans:", plError);
      if (sError) console.warn("[AdminTenants] Aviso ao consultar subs:", sError);

      const profilesMap = new Map((profiles || []).map((p) => [p.id, p]));
      const plansMap = new Map((plans || []).map((pl) => [pl.id, pl]));

      // 3. Resolução segura de cada estabelecimento com métricas reais
      const resolvedTenants: TenantRecord[] = await Promise.all(
        barbershops.map(async (shop) => {
          const ownerProfile = shop.owner_id ? profilesMap.get(shop.owner_id) : null;
          const assignedPlan = shop.plan_id ? plansMap.get(shop.plan_id) : null;
          const profilePlan = ownerProfile?.plan || null;

          // Regra de convergência/divergência de planos
          const assignedNameLower = assignedPlan ? assignedPlan.name.toLowerCase() : "";
          const profilePlanLower = profilePlan ? profilePlan.toLowerCase() : "";

          let plan_status: "verified" | "to_verify" = "verified";
          let plan_label = assignedPlan ? assignedPlan.name : "Sem plano";
          let plan_details = "";

          if (!shop.plan_id || !assignedPlan || assignedNameLower !== profilePlanLower) {
            plan_status = "to_verify";
            plan_label = "Plano a verificar";
            plan_details = assignedPlan
              ? `Atribuído: ${assignedPlan.name} | Perfil: ${profilePlan || "Nenhum"}`
              : `Perfil: ${profilePlan || "Nenhum"} | Sem plano no banco`;
          } else {
            plan_details = `Plano ativo: ${assignedPlan.name}`;
          }

          // Classificação Comercial Centralizada (R2E.9)
          const shopSubs = (subs || []).filter(
            (s: any) => s.barbershop_id === shop.id || s.user_id === shop.owner_id
          );
          const classification = classifyTenant({
            id: shop.id,
            name: shop.name,
            slug: shop.slug,
            owner_id: shop.owner_id,
            plan_id: shop.plan_id,
            created_at: shop.created_at,
            ownerProfile,
            assignedPlan,
            profilePlan: profilePlan ? plansMap.get(profilePlan.toLowerCase()) : null,
            subscriptions: shopSubs,
          });

          // Nome do proprietário
          const owner_name =
            ownerProfile?.responsible_name?.trim() ||
            ownerProfile?.display_name?.trim() ||
            ownerProfile?.business_name?.trim() ||
            ownerProfile?.email ||
            "Não informado";

          // Filtro para dados associados (suporta tanto tenant_id quanto user_id legado)
          const targetIds = [shop.id];
          if (shop.owner_id && !targetIds.includes(shop.owner_id)) {
            targetIds.push(shop.owner_id);
          }

          const orFilter = targetIds.map((id) => `tenant_id.eq.${id},user_id.eq.${id}`).join(",");

          // Consultas de métricas em paralelo
          const [customersRes, barbersRes, appointmentsRes] = await Promise.all([
            supabase.from("customers").select("*", { count: "exact", head: true }).or(orFilter),
            supabase.from("barbers").select("*", { count: "exact", head: true }).or(orFilter),
            supabase
              .from("appointments")
              .select("final_amount")
              .or(orFilter)
              .eq("status", "completed"),
          ]);

          const revenue = (appointmentsRes.data || []).reduce(
            (acc, curr) => acc + (curr.final_amount || 0),
            0,
          );

          return {
            id: shop.id,
            name: shop.name,
            slug: shop.slug,
            logo_url: shop.logo_url,
            owner_id: shop.owner_id,
            plan_id: shop.plan_id,
            created_at: shop.created_at,
            updated_at: shop.updated_at,
            owner_name,
            owner_email: ownerProfile?.email || null,
            whatsapp_number: ownerProfile?.whatsapp_number || ownerProfile?.phone || null,
            is_internal_test_tenant: !!ownerProfile?.is_internal_test_tenant,
            status: ownerProfile?.status === "blocked" ? "blocked" : "active",
            plan_status,
            plan_label,
            plan_details,
            assigned_plan_name: assignedPlan?.name || null,
            profile_plan_name: profilePlan,
            classification,
            stats: {
              customers: customersRes.count || 0,
              barbers: barbersRes.count || 0,
              revenue,
            },
          };
        }),
      );

      return resolvedTenants;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      ownerId,
      status,
      tenantName,
    }: {
      ownerId: string | null;
      status: "active" | "blocked";
      tenantName: string;
    }) => {
      if (!ownerId) {
        throw new Error("Este estabelecimento não possui proprietário vinculado no banco.");
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          status,
          blocked_at: status === "blocked" ? new Date().toISOString() : null,
        })
        .eq("id", ownerId);

      if (error) throw error;

      // Auditoria da ação
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_logs").insert({
          admin_id: user.id,
          target_id: ownerId,
          action: status === "blocked" ? "block_tenant" : "reactivate_tenant",
          details: { status, tenant_name: tenantName },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants-canonical"] });
      toast.success("Status da barbearia atualizado com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao alterar status: " + (err.message || "Falha inesperada"));
    },
  });

  const impersonate = async (tenant: TenantRecord) => {
    sessionStorage.setItem("impersonated_tenant_id", tenant.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("audit_logs").insert({
        admin_id: user.id,
        target_id: tenant.id,
        action: "impersonate",
        details: { impersonated_at: new Date().toISOString(), tenant_name: tenant.name },
      });
    }

    toast.success(`Entrando como ${tenant.name}...`);
    navigate({ to: "/dashboard" });
  };

  const filteredTenants = tenants?.filter((t) => {
    const term = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(term) ||
      t.slug.toLowerCase().includes(term) ||
      t.owner_name.toLowerCase().includes(term) ||
      (t.owner_email && t.owner_email.toLowerCase().includes(term)) ||
      (t.whatsapp_number && t.whatsapp_number.includes(term))
    );
  });

  return (
    <TooltipProvider>
      <div className="space-y-8 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl font-black tracking-tight text-white italic">
              GESTOR DE BARBEARIAS
            </h2>
            <p className="text-gray-400 font-medium">
              Controle canônico sobre os estabelecimentos parceiros da plataforma.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
              <Input
                placeholder="Buscar barbearia, slug, proprietário..."
                className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-white placeholder:text-gray-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 hover:bg-white/10"
              aria-label="Atualizar dados"
              onClick={() => refetch()}
            >
              <RefreshCw
                className={cn("h-5 w-5 text-gray-400", isLoading && "animate-spin text-purple-400")}
              />
            </Button>
          </div>
        </div>

        {/* Estado de Erro Explícito */}
        {isError && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-rose-400" />
            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                Falha ao carregar barbearias
              </h3>
              <p className="text-sm text-gray-400 max-w-md mt-1">
                {error instanceof Error
                  ? error.message
                  : "Ocorreu um erro ao consultar os estabelecimentos no banco de dados."}
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

        {!isError && (
          <Card className="glass border-white/5 rounded-[2.5rem] overflow-hidden shadow-none">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px] py-6 pl-8">
                      Barbearia / Slug
                    </TableHead>
                    <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                      Proprietário
                    </TableHead>
                    <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                      Status
                    </TableHead>
                    <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                      Modalidade / Acesso
                    </TableHead>
                    <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                      Métricas
                    </TableHead>
                    <TableHead className="text-right text-gray-400 font-bold uppercase tracking-widest text-[10px] pr-8">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-white/5">
                        <TableCell className="pl-8">
                          <Skeleton className="h-10 w-48 bg-white/5 rounded-xl" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-32 bg-white/5 rounded-lg" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-20 bg-white/5 rounded-lg" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-28 bg-white/5 rounded-lg" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-32 bg-white/5 rounded-lg" />
                        </TableCell>
                        <TableCell className="pr-8">
                          <Skeleton className="h-8 w-8 bg-white/5 rounded-lg ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredTenants?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-gray-500 italic">
                        {search
                          ? "Nenhuma barbearia encontrada para a busca realizada."
                          : "Nenhuma barbearia cadastrada no banco."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTenants?.map((tenant) => (
                      <TableRow
                        key={tenant.id}
                        className="border-white/5 hover:bg-white/5 transition-colors group"
                      >
                        {/* Barbearia / Slug */}
                        <TableCell className="py-6 pl-8">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/5 shrink-0 overflow-hidden">
                              {tenant.logo_url ? (
                                <img
                                  src={tenant.logo_url}
                                  alt={tenant.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Building2 className="w-5 h-5 text-purple-400" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-white group-hover:text-purple-400 transition-colors flex items-center gap-2 truncate">
                                {tenant.name}
                                {tenant.is_internal_test_tenant && (
                                  <Badge className="bg-amber-500/15 text-amber-300 border border-amber-400/30 text-[9px] uppercase tracking-wider px-1.5 py-0.2 shrink-0">
                                    Teste interno
                                  </Badge>
                                )}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] text-purple-400/80 font-mono tracking-tight font-medium">
                                  /{tenant.slug}
                                </span>
                                <a
                                  href={`/${tenant.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-500 hover:text-purple-300 transition-colors"
                                  title="Abrir página pública"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Proprietário */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              {tenant.owner_name}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                              {tenant.whatsapp_number || tenant.owner_email || "Sem contato"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge
                            className={cn(
                              "rounded-lg px-2.5 py-0.5 text-[10px] border-none font-bold uppercase tracking-wider",
                              tenant.status === "blocked"
                                ? "bg-rose-500/20 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                                : "bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
                            )}
                          >
                            {tenant.status === "blocked" ? "Bloqueado" : "Ativo"}
                          </Badge>
                        </TableCell>

                        {/* Modalidade de Acesso / Plano Técnico (R2E.9) */}
                        <TableCell>
                          {tenant.classification.modality === "VOUCHER" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center gap-1.5 cursor-help">
                                  <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(168,85,247,0.15)]">
                                    <ShieldCheck className="w-3 h-3 text-purple-400" />
                                    VOUCHER PERMANENTE
                                  </Badge>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-zinc-900 border-white/10 text-gray-200 text-xs p-3 rounded-xl max-w-xs shadow-xl"
                              >
                                <p className="font-semibold text-purple-300 mb-1">
                                  Acesso por Voucher Permanente:
                                </p>
                                <p className="text-[11px] text-gray-300 leading-relaxed">
                                  Conta de testes contínuos da plataforma. Sem contratação de assinatura comercial.
                                </p>
                                {tenant.classification.technicalPlanName && (
                                  <p className="text-[10px] text-gray-400 mt-2">
                                    Referência técnica liberada: <strong className="text-purple-300">{tenant.classification.technicalPlanName}</strong>
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          ) : tenant.classification.modality === "TRIAL" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center gap-1.5 cursor-help">
                                  <Badge
                                    className={cn(
                                      "rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                                      tenant.classification.trialStatus === "EXPIRADO"
                                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                        : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                                    )}
                                  >
                                    <Clock className="w-3 h-3" />
                                    TRIAL · {tenant.classification.trialStatus}
                                  </Badge>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-zinc-900 border-white/10 text-gray-200 text-xs p-3 rounded-xl max-w-xs shadow-xl"
                              >
                                <p className={cn("font-semibold mb-1", tenant.classification.trialStatus === "EXPIRADO" ? "text-amber-300" : "text-blue-300")}>
                                  Período de Testes ({tenant.classification.trialStatus})
                                </p>
                                <p className="text-[11px] text-gray-300 leading-relaxed">
                                  {tenant.classification.explanation}
                                </p>
                                {tenant.classification.technicalPlanName && (
                                  <p className="text-[10px] text-gray-400 mt-2">
                                    Referência técnica de liberação: <strong className="text-white">{tenant.classification.technicalPlanName}</strong>
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                              ASSINATURA: {tenant.classification.commercialPlanName}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Métricas */}
                        <TableCell>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                Clientes
                              </span>
                              <span className="text-xs font-bold text-white">
                                {tenant.stats.customers}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                Barbeiros
                              </span>
                              <span className="text-xs font-bold text-white">
                                {tenant.stats.barbers}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                Receita
                              </span>
                              <span className="text-xs font-bold text-emerald-400">
                                R${" "}
                                {tenant.stats.revenue.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 0,
                                })}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Ações */}
                        <TableCell className="text-right pr-8">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-purple-500/20 hover:text-purple-400 rounded-xl transition-all"
                                aria-label="Mais opções"
                              >
                                <MoreVertical className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-64 glass border-white/10 rounded-2xl p-2 text-white"
                            >
                              <DropdownMenuLabel className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-3 py-2">
                                Comandos do Sistema
                              </DropdownMenuLabel>

                              <DropdownMenuItem
                                className="rounded-xl focus:bg-white/10 cursor-pointer transition-all"
                                onClick={() => impersonate(tenant)}
                              >
                                <ExternalLink className="mr-3 h-4 w-4 text-purple-400" />
                                <span className="font-medium text-xs">Modo Visualização</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className="rounded-xl focus:bg-white/10 cursor-pointer transition-all"
                                onClick={() => window.open(`/${tenant.slug}`, "_blank")}
                              >
                                <Globe className="mr-3 h-4 w-4 text-emerald-400" />
                                <span className="font-medium text-xs">Página Pública</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="bg-white/5 my-2" />

                              <DropdownMenuItem
                                className="rounded-xl focus:bg-white/10 cursor-pointer transition-all"
                                onClick={() => navigate({ to: `/admin/plans` })}
                              >
                                <CreditCard className="mr-3 h-4 w-4 text-blue-400" />
                                <span className="font-medium text-xs">Gestão de Planos</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="bg-white/5 my-2" />

                              {tenant.owner_id ? (
                                tenant.status === "blocked" ? (
                                  <DropdownMenuItem
                                    className="rounded-xl focus:bg-emerald-500/20 text-emerald-400 cursor-pointer transition-all"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        ownerId: tenant.owner_id,
                                        status: "active",
                                        tenantName: tenant.name,
                                      })
                                    }
                                  >
                                    <Unlock className="mr-3 h-4 w-4" />
                                    <span className="font-bold text-xs">
                                      Desbloquear Estabelecimento
                                    </span>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    className="rounded-xl focus:bg-rose-500/20 text-rose-400 cursor-pointer transition-all"
                                    onClick={() => {
                                      if (confirm(`BLOQUEAR ACESSO: ${tenant.name}?`)) {
                                        updateStatusMutation.mutate({
                                          ownerId: tenant.owner_id,
                                          status: "blocked",
                                          tenantName: tenant.name,
                                        });
                                      }
                                    }}
                                  >
                                    <Ban className="mr-3 h-4 w-4" />
                                    <span className="font-bold text-xs">Suspender Acesso</span>
                                  </DropdownMenuItem>
                                )
                              ) : (
                                <DropdownMenuItem disabled className="text-gray-500 text-xs italic">
                                  Proprietário não vinculado
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-6 flex gap-4 backdrop-blur-md">
          <AlertTriangle className="text-rose-400 shrink-0 w-6 h-6" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-white uppercase tracking-tight">
              Protocolo de Segurança e Isolamento
            </p>
            <p className="text-xs text-gray-400 leading-relaxed font-medium">
              A listagem acima reflete os estabelecimentos canônicos registrados no cluster Supabase
              Target. O bloqueio atua no perfil do proprietário, suspendendo o acesso administrativo
              à barbearia sem remover dados históricos.
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
