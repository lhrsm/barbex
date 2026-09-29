import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Crown, Edit2, Save, X, Check, Lock, RefreshCw, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/admin/plans")({
  component: AdminPlans,
});

interface PlanLimits {
  barbers?: number | null;
  clients?: number | null;
  services?: number | null;
  admins?: number | null;
  automations?: number | null;
}

interface Plan {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  tier: number;
  max_barbers: number | null;
  is_recommended: boolean;
  allowed_modules: string[];
  active: boolean;
  stripe_price_id_test: string | null;
  stripe_price_id_live: string | null;
  stripe_yearly_price_id_test: string | null;
  stripe_yearly_price_id_live: string | null;
  stripe_product_id_test: string | null;
  stripe_product_id_live: string | null;
  automation_limit: number | null;
  limits: PlanLimits;
}

const MODULE_CATALOG: { key: string; label: string; group: string }[] = [
  // Essenciais
  { key: "dashboard", label: "Dashboard", group: "Essenciais" },
  { key: "calendar", label: "Agenda", group: "Essenciais" },
  { key: "customers", label: "Clientes", group: "Essenciais" },
  { key: "barbers", label: "Barbeiros", group: "Essenciais" },
  { key: "services", label: "Serviços", group: "Essenciais" },
  { key: "client_portal", label: "Portal do Cliente", group: "Essenciais" },
  { key: "barber_panel", label: "Painel do Barbeiro", group: "Essenciais" },
  { key: "support", label: "Suporte", group: "Essenciais" },
  // Financeiro
  { key: "basic_finance", label: "Financeiro Básico", group: "Financeiro" },
  { key: "advanced_finance", label: "Financeiro Completo", group: "Financeiro" },
  { key: "payment_gateway", label: "Gateway de Pagamento", group: "Financeiro" },
  { key: "commissions", label: "Comissões", group: "Financeiro" },
  { key: "pix_key", label: "Chave PIX", group: "Financeiro" },
  // Marketing
  { key: "campaigns", label: "Campanhas", group: "Marketing" },
  { key: "coupons", label: "Cupons", group: "Marketing" },
  { key: "cashback", label: "Cashback", group: "Marketing" },
  { key: "loyalty", label: "Fidelidade", group: "Marketing" },
  { key: "subscription_rewards", label: "Recompensas Assinante", group: "Marketing" },
  // Automação
  { key: "whatsapp", label: "WhatsApp", group: "Automação" },
  { key: "automations_basic", label: "Automações Básicas", group: "Automação" },
  { key: "automations_smart", label: "Automações Inteligentes", group: "Automação" },
  { key: "automations_unlimited", label: "Automações Ilimitadas", group: "Automação" },
  // Vendas
  { key: "products", label: "Produtos", group: "Vendas" },
  { key: "stock", label: "Estoque", group: "Vendas" },
  { key: "store", label: "Loja Virtual", group: "Vendas" },
  { key: "subscriptions", label: "Assinaturas", group: "Vendas" },
  // Premium
  { key: "reports_basic", label: "Relatórios Básicos", group: "Premium" },
  { key: "reports_advanced", label: "Relatórios Avançados", group: "Premium" },
  { key: "dashboard_advanced", label: "Dashboard Avançado", group: "Premium" },
  { key: "tutorials", label: "Tutoriais", group: "Premium" },
  { key: "corporate_reports", label: "Relatórios Corporativos", group: "Premium" },
  // IA e Integrações
  { key: "ai", label: "IA (Suite Completa)", group: "IA e Integrações" },
  { key: "api", label: "API Pública", group: "IA e Integrações" },
  { key: "api_access", label: "API Access (legado)", group: "IA e Integrações" },
  { key: "integrations", label: "Integrações", group: "IA e Integrações" },
  { key: "white_label", label: "White Label", group: "IA e Integrações" },
  { key: "multi_units", label: "Multi-unidades", group: "IA e Integrações" },
];

const GROUPS = [
  "Essenciais",
  "Financeiro",
  "Marketing",
  "Automação",
  "Vendas",
  "Premium",
  "IA e Integrações",
] as const;

const LIMIT_FIELDS: { key: keyof PlanLimits; label: string }[] = [
  { key: "barbers", label: "Barbeiros" },
  { key: "clients", label: "Clientes" },
  { key: "services", label: "Serviços" },
  { key: "admins", label: "Administradores" },
  { key: "automations", label: "Automações" },
];

const formatCurrency = (val: number | null | undefined): string => {
  if (val == null || isNaN(val)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
};

function AdminPlans() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Plan | null>(null);

  const {
    data: plans,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-plans-modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select(
          `
          id,
          name,
          slug,
          description,
          price_monthly,
          price_yearly,
          tier,
          max_barbers,
          is_recommended,
          allowed_modules,
          active,
          stripe_price_id_test,
          stripe_price_id_live,
          stripe_yearly_price_id_test,
          stripe_yearly_price_id_live,
          stripe_product_id_test,
          stripe_product_id_live,
          automation_limit,
          limits
        `,
        )
        .order("tier", { ascending: true });

      if (error) {
        console.error("[AdminPlans] Erro ao carregar planos:", error);
        throw error;
      }

      return (data || []).map((p: Record<string, unknown>) => ({
        ...p,
        price_monthly: Number(p.price_monthly) || 0,
        price_yearly: Number(p.price_yearly) || 0,
        allowed_modules: Array.isArray(p.allowed_modules) ? (p.allowed_modules as string[]) : [],
        tier: typeof p.tier === "number" ? p.tier : 0,
        limits: p.limits && typeof p.limits === "object" ? (p.limits as PlanLimits) : {},
      })) as unknown as Plan[];
    },
  });

  // R2E.13D: Preços e identificadores Stripe são de autoridade canônica e somente leitura.
  // Apenas metadados operacionais não-financeiros podem ser modificados.
  const updateMutation = useMutation({
    mutationFn: async (plan: Plan) => {
      const payload: Record<string, unknown> = {
        name: plan.name,
        description: plan.description,
        tier: plan.tier,
        max_barbers: plan.max_barbers,
        is_recommended: plan.is_recommended,
        allowed_modules: plan.allowed_modules,
        active: plan.active,
        automation_limit: plan.automation_limit ?? 0,
        limits: plan.limits || {},
      };
      const { error } = await supabase
        .from("plans")
        .update(payload as never)
        .eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plans-modules"] });
      qc.invalidateQueries({ queryKey: ["barbershop-plan"] });
      setEditing(null);
      toast.success("Metadados do plano atualizados com sucesso");
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + (e?.message || "Falha ao atualizar")),
  });

  useEffect(() => {
    if (editing && plans) {
      const p = plans.find((x) => x.id === editing);
      if (p) setForm({ ...p });
    } else {
      setForm(null);
    }
  }, [editing, plans]);

  const toggleModule = (key: string) => {
    if (!form) return;
    const has = form.allowed_modules.includes(key);
    setForm({
      ...form,
      allowed_modules: has
        ? form.allowed_modules.filter((m) => m !== key)
        : [...form.allowed_modules, key],
    });
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-white/60 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
        <p className="text-sm font-medium">Carregando catálogo de planos...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-10 max-w-lg mx-auto bg-rose-500/10 border border-rose-500/30 rounded-3xl text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <div>
          <h2 className="text-lg font-bold text-white uppercase tracking-tight">
            Falha ao carregar planos
          </h2>
          <p className="text-xs text-rose-200/80 mt-1">
            {(error as Error)?.message ||
              "Ocorreu um erro ao consultar o catálogo de planos no banco de dados."}
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs uppercase font-bold tracking-wider rounded-xl gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="p-16 text-center text-white/60 bg-white/[0.02] border border-white/10 rounded-3xl max-w-lg mx-auto space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
        <h2 className="text-lg font-bold text-white uppercase">Nenhum plano cadastrado</h2>
        <p className="text-xs text-white/50">
          Não há registros de planos cadastrados na tabela public.plans.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px w-8 bg-amber-500" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-400">
              Super Admin
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white italic uppercase">
            Planos & Módulos
          </h1>
          <p className="text-sm text-white/60 mt-2">
            Catálogo canônico de planos, precificação mensal e anual, mapeamentos Stripe e controle
            de módulos.
          </p>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const isEditing = editing === plan.id;
          const current = isEditing && form ? form : plan;
          const allowedSet = new Set(current.allowed_modules);

          return (
            <Card
              key={plan.id}
              className={cn(
                "glass rounded-3xl border-2 transition-all flex flex-col",
                isEditing
                  ? "border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.25)]"
                  : plan.is_recommended
                    ? "border-amber-500/40"
                    : "border-white/10",
              )}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    {isEditing ? (
                      <Input
                        value={current.name}
                        onChange={(e) => setForm({ ...current, name: e.target.value })}
                        className="h-9 text-lg font-bold bg-white/5 border-white/10"
                      />
                    ) : (
                      <CardTitle className="text-2xl font-black text-white italic uppercase flex items-center gap-2">
                        {plan.name}
                        {plan.is_recommended && <Crown className="w-4 h-4 text-amber-400" />}
                      </CardTitle>
                    )}
                    <CardDescription className="text-white/50 text-xs mt-1">
                      Tier {current.tier} · slug:{" "}
                      <code className="text-amber-400">{plan.slug}</code>
                    </CardDescription>
                  </div>
                  <Badge
                    className={
                      plan.active
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-zinc-500/20 text-zinc-400"
                    }
                  >
                    {plan.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-5">
                {/* Preços Mensal e Anual canônicos (R2E.12B / R2E.13D) */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      Preços Canônicos (BRL)
                    </span>
                    <Badge variant="outline" className="text-[9px] text-white/40 border-white/10">
                      Somente Leitura
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-white/50 block">
                        Mensal
                      </Label>
                      <p className="text-lg font-black text-white mt-0.5">
                        {formatCurrency(plan.price_monthly)}
                        <span className="text-xs font-normal text-white/50 ml-1">/mês</span>
                      </p>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-white/50 block">
                        Anual
                      </Label>
                      <p className="text-lg font-black text-amber-400 mt-0.5">
                        {formatCurrency(plan.price_yearly)}
                        <span className="text-xs font-normal text-white/50 ml-1">/ano</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Limite de barbeiros */}
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-white/50">
                    Máx. barbeiros
                  </Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={current.max_barbers ?? ""}
                      placeholder="Ilimitado"
                      onChange={(e) =>
                        setForm({
                          ...current,
                          max_barbers: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      className="h-9 bg-white/5 border-white/10 mt-1"
                    />
                  ) : (
                    <p className="text-xl font-black text-white mt-1">{plan.max_barbers ?? "∞"}</p>
                  )}
                </div>

                {isEditing && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <Label className="text-xs text-white/70">Marcar como recomendado</Label>
                    <Switch
                      checked={current.is_recommended}
                      onCheckedChange={(v) => setForm({ ...current, is_recommended: v })}
                    />
                  </div>
                )}

                {/* Mapeamentos Stripe canônicos (Read-Only) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase tracking-wider text-white/60 font-bold flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-amber-400" />
                      Mapeamentos Stripe
                    </Label>
                    <Badge variant="outline" className="text-[9px] text-white/40 border-white/10">
                      Somente Leitura
                    </Badge>
                  </div>

                  {/* Bloco SANDBOX / TEST */}
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-black uppercase">
                          TEST / SANDBOX
                        </Badge>
                        <span className="text-[10px] text-white/50">Homologação</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-1 text-xs">
                      <div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                          Price Mensal
                        </span>
                        <code className="text-[11px] font-mono text-amber-200/90 break-all select-all">
                          {plan.stripe_price_id_test || (
                            <span className="text-red-400/80 italic">Não configurado</span>
                          )}
                        </code>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                          Price Anual
                        </span>
                        <code className="text-[11px] font-mono text-amber-200/90 break-all select-all">
                          {plan.stripe_yearly_price_id_test || (
                            <span className="text-red-400/80 italic">Não configurado</span>
                          )}
                        </code>
                      </div>
                      {plan.stripe_product_id_test && (
                        <div className="pt-1 border-t border-amber-500/10">
                          <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                            Product ID
                          </span>
                          <code className="text-[11px] font-mono text-white/60 break-all select-all">
                            {plan.stripe_product_id_test}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bloco PRODUÇÃO / LIVE */}
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-black uppercase">
                          LIVE / PRODUÇÃO
                        </Badge>
                        <span className="text-[10px] text-white/50">Ambiente Real</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-1 text-xs">
                      <div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                          Price Mensal
                        </span>
                        <code className="text-[11px] font-mono text-emerald-200/90 break-all select-all">
                          {plan.stripe_price_id_live || (
                            <span className="text-red-400/80 italic">Não configurado</span>
                          )}
                        </code>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                          Price Anual
                        </span>
                        <code className="text-[11px] font-mono text-emerald-200/90 break-all select-all">
                          {plan.stripe_yearly_price_id_live || (
                            <span className="text-red-400/80 italic">Não configurado</span>
                          )}
                        </code>
                      </div>
                      {plan.stripe_product_id_live && (
                        <div className="pt-1 border-t border-emerald-500/10">
                          <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                            Product ID
                          </span>
                          <code className="text-[11px] font-mono text-white/60 break-all select-all">
                            {plan.stripe_product_id_live}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Limites por plano */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <Label className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">
                    Limites do plano
                  </Label>
                  <p className="text-[10px] text-white/40 -mt-1">Deixe vazio para ilimitado.</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {LIMIT_FIELDS.map((field) => {
                      const value = current.limits?.[field.key];
                      return (
                        <div key={field.key}>
                          <Label className="text-[10px] text-white/50">{field.label}</Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              min={0}
                              value={value ?? ""}
                              placeholder="∞"
                              onChange={(e) => {
                                const raw = e.target.value;
                                setForm({
                                  ...current,
                                  limits: {
                                    ...(current.limits || {}),
                                    [field.key]: raw === "" ? null : parseInt(raw, 10),
                                  },
                                });
                              }}
                              className="h-8 bg-black/30 border-white/10 text-xs mt-1"
                            />
                          ) : (
                            <p className="text-sm font-bold text-white/80 mt-1">
                              {value == null ? "∞" : value}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-white/50">
                    Módulos permitidos ({current.allowed_modules.length})
                  </Label>
                  <div className="mt-3 space-y-3">
                    {GROUPS.map((group) => {
                      const items = MODULE_CATALOG.filter((m) => m.group === group);
                      return (
                        <div key={group}>
                          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                            {group}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {items.map((m) => {
                              const on = allowedSet.has(m.key);
                              return (
                                <button
                                  key={m.key}
                                  type="button"
                                  disabled={!isEditing}
                                  onClick={() => toggleModule(m.key)}
                                  className={cn(
                                    "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all text-left",
                                    on
                                      ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                                      : "bg-white/5 border-white/10 text-white/40",
                                    isEditing && "hover:border-amber-500/60 cursor-pointer",
                                    !isEditing && "cursor-default opacity-90",
                                  )}
                                >
                                  {on ? (
                                    <Check className="w-3 h-3 shrink-0" />
                                  ) : (
                                    <Lock className="w-3 h-3 shrink-0" />
                                  )}
                                  <span className="truncate">{m.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-4 border-t border-white/10">
                {isEditing ? (
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="ghost"
                      className="flex-1 text-white/60"
                      onClick={() => setEditing(null)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold"
                      onClick={() => form && updateMutation.mutate(form)}
                      disabled={updateMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Salvar
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setEditing(plan.id)}
                    className={cn(
                      "w-full group relative overflow-hidden",
                      "border-amber-500/30 bg-amber-500/5 text-amber-100",
                      "hover:border-amber-500/70 hover:bg-amber-500/15 hover:text-amber-50",
                      "hover:shadow-[0_0_24px_rgba(245,158,11,0.25)]",
                      "transition-all duration-300 ease-out",
                    )}
                  >
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-0 bg-gradient-to-r from-transparent via-amber-400/20 to-transparent transition-transform duration-500 ease-out" />
                    <Edit2 className="w-4 h-4 mr-2 relative z-10 group-hover:scale-110 transition-transform duration-300" />
                    <span className="relative z-10 font-semibold tracking-wide">
                      Editar metadados
                    </span>
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Card className="glass border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-5 text-sm text-amber-200/80">
          💡 <strong>Autoridade Canônica:</strong> A precificação mensal/anual e os identificadores
          Stripe são controlados de forma centralizada e segura pelo backend/migrations. As
          alterações permitidas nesta interface limitam-se aos metadados operacionais do plano
          (nome, limite de barbeiros, módulos e limites). A sincronização de módulos com as
          barbearias é executada automaticamente.
        </CardContent>
      </Card>
    </div>
  );
}
