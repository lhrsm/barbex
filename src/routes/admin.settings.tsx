import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings,
  Globe,
  CreditCard,
  Shield,
  Share2,
  Save,
  Upload,
  Power,
  Lock,
  History,
  Info,
  ExternalLink,
  Smartphone,
  AlertCircle,
  Mail,
  Bell,
  MessageSquare,
  ArrowRight,
  Calendar,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Loader2,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AdminEventSubscriptions } from "@/components/admin/AdminEventSubscriptions";
import { AdminEventTemplates } from "@/components/admin/AdminEventTemplates";
import { GlobalFeatureGovernance } from "@/components/admin/GlobalFeatureGovernance";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab");
      if (p === "contato" || p === "mensagens" || p === "platform-contact") return "mensagens";
      if (p) return p;
    }
    return "geral";
  });

  const DEFAULT_SYSTEM_SETTINGS = {
    saas_name: "Barbex",
    main_url: "https://barbex.shop",
    saas_logo: null,
    maintenance_mode: false,
    admin_access_level: "restricted",
    audit_logs_enabled: true,
    public_email: "contato@barbex.shop",
    contact_email: "contato@lmstartup.com.br",
    phone: "",
    whatsapp_number: "",
    address: "",
    has_contact_form: true,
    social_links: {
      instagram: "",
      facebook: "",
      tiktok: "",
      linkedin: "",
      youtube: "",
      twitter: "",
    },
  };

  const {
    data: settings,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["admin-system-settings"],
    queryFn: async () => {
      console.log("Fetching system settings...");
      // Fetch settings with a simple select to avoid maybeSingle issues if data is inconsistent
      const { data, error } = await supabase.from("system_settings").select("*").limit(1);

      if (error) {
        console.error("Supabase error fetching settings:", error);
        throw error;
      }
      const raw = data?.[0] || null;
      if (raw) {
        // Strip sensitive credentials so secrets are never held in browser memory
        delete (raw as any).stripe_secret_key;
        delete (raw as any).stripe_webhook_secret;
      }
      return raw;
    },
  });

  const [formData, setFormData] = useState<any>(null);

  // Consulta planos ativos elegíveis para período de teste
  const { data: activePlans } = useQuery({
    queryKey: ["admin-active-plans-for-trial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, slug, active")
        .eq("active", true)
        .order("tier", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Estados locais para governança de política de trial
  const [trialDaysInput, setTrialDaysInput] = useState<number>(15);
  const [trialPlanInput, setTrialPlanInput] = useState<string>("pro");
  const [trialConfirmOpen, setTrialConfirmOpen] = useState<boolean>(false);
  const [trialReason, setTrialReason] = useState<string>("");

  // Estados locais para governança de política de carência para inadimplência (R2E.14B)
  const [graceDaysInput, setGraceDaysInput] = useState<number>(7);
  const [graceConfirmOpen, setGraceConfirmOpen] = useState<boolean>(false);
  const [graceReason, setGraceReason] = useState<string>("");

  useEffect(() => {
    if (settings) {
      setFormData({
        ...DEFAULT_SYSTEM_SETTINGS,
        ...settings,
        social_links: {
          ...DEFAULT_SYSTEM_SETTINGS.social_links,
          ...(settings.social_links || {}),
        },
      });

      if ((settings as any).default_trial_days) {
        setTrialDaysInput(Number((settings as any).default_trial_days));
      }
      if ((settings as any).default_trial_plan) {
        setTrialPlanInput(String((settings as any).default_trial_plan));
      }
      if (
        (settings as any).grace_period_days !== undefined &&
        (settings as any).grace_period_days !== null
      ) {
        setGraceDaysInput(Number((settings as any).grace_period_days));
      }
    } else if (settings === null && !isLoading && !queryError) {
      // Cenário B: Tabela vazia — inicializar com valores padrão seguros
      setFormData(DEFAULT_SYSTEM_SETTINGS);
    }
  }, [settings, isLoading, queryError]);

  // Mutação governada para atualização atômica de política de trial via RPC
  const updateTrialPolicyMutation = useMutation({
    mutationFn: async ({ days, plan, reason }: { days: number; plan: string; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_update_trial_policy", {
        p_trial_days: days,
        p_trial_plan: plan,
        p_reason: reason,
      });

      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        throw new Error(res?.message || "Falha ao atualizar política de trial");
      }
      return res;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Política de trial da plataforma atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-system-settings"] });
      setTrialConfirmOpen(false);
      setTrialReason("");
    },
    onError: (err: any) => {
      toast.error(`Erro na governança de trial: ${err.message}`);
    },
  });

  // Mutação governada para atualização atômica do período de carência via RPC (R2E.14B)
  const updateGracePolicyMutation = useMutation({
    mutationFn: async ({ days, reason }: { days: number; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_update_grace_policy", {
        p_grace_period_days: days,
        p_reason: reason,
      });

      if (error) throw error;
      const res = data as any;
      if (!res?.ok && !res?.success) {
        throw new Error(res?.error || res?.message || "Falha ao atualizar período de carência");
      }
      return res;
    },
    onSuccess: () => {
      toast.success("Período de carência para inadimplência atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-system-settings"] });
      setGraceConfirmOpen(false);
      setGraceReason("");
    },
    onError: (err: any) => {
      toast.error(`Erro na governança de carência: ${err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (newData: any) => {
      const targetId = settings?.id || newData?.id;

      if (targetId) {
        // Atualização de registro existente — nunca persistir credenciais sensíveis em system_settings
        const {
          id,
          updated_at,
          stripe_secret_key,
          stripe_webhook_secret,
          two_factor_auth_enabled,
          ...updatePayload
        } = newData;
        const { error } = await supabase
          .from("system_settings")
          .update(updatePayload)
          .eq("id", targetId);

        if (error) throw error;
      } else {
        // Tabela estava vazia na leitura. Verificar atomicamente se outra sessão inseriu
        const { data: existingRows, error: checkError } = await supabase
          .from("system_settings")
          .select("id")
          .limit(1);

        if (checkError) throw checkError;

        if (existingRows && existingRows.length > 0) {
          // Atualiza registro criado concorrentemente para evitar duplicação
          const { id, updated_at, ...updatePayload } = newData;
          const { error } = await supabase
            .from("system_settings")
            .update(updatePayload)
            .eq("id", existingRows[0].id);

          if (error) throw error;
        } else {
          // Insere o primeiro registro da plataforma
          const { id, updated_at, ...insertPayload } = newData;
          const { error } = await supabase.from("system_settings").insert([insertPayload]);

          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["platform-public-settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar configurações: " + (error?.message || "Erro desconhecido"));
    },
  });

  if (isLoading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        <p className="text-gray-500 font-black italic uppercase tracking-widest">
          Acessando Núcleo do Sistema...
        </p>
      </div>
    );
  }

  // Cenário C: Erro real de conexão ou permissão
  if (queryError) {
    return (
      <div className="p-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-xl font-bold text-white uppercase italic">Erro de Conexão</h3>
        <p className="text-gray-400">
          {(queryError as Error)?.message || "Não foi possível carregar as configurações do banco."}
        </p>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-system-settings"] })}
          className="bg-white/5 border border-white/10"
        >
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!formData) return null;

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white italic uppercase truncate">
            Configurações da Plataforma
          </h2>
          <p className="text-gray-400 font-medium text-sm truncate">
            Gerencie identidade pública, comunicação e informações institucionais do Barbex.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          size="sm"
          className="h-9 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white gap-2 font-bold uppercase tracking-wider text-[11px] italic shadow-[0_0_16px_rgba(168,85,247,0.3)] transition-all hover:scale-[1.02] active:scale-95 shrink-0 self-start md:self-auto"
        >
          <Save className="w-3.5 h-3.5" />
          {updateMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto -mx-2 px-2 scrollbar-none">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl h-auto inline-flex gap-0.5 w-auto">
            {[
              { id: "geral", label: "Geral", icon: Globe },
              { id: "features", label: "Recursos Globais", icon: Power },
              { id: "mensagens", label: "Contato da Plataforma", icon: MessageSquare },
              { id: "faturamento", label: "Faturamento & Políticas", icon: CreditCard },
              { id: "seguranca", label: "Segurança", icon: Shield },
              { id: "integracoes", label: "Integrações", icon: Share2 },
              { id: "notificacoes", label: "Notificações", icon: Bell },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider gap-1.5 transition-all data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:bg-white/5",
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent
          value="geral"
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="glass border-white/5 rounded-[2.5rem] p-8">
              <CardHeader className="p-0 mb-8">
                <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                  <Info className="text-purple-400 w-5 h-5" />
                  Identidade Visual & Info
                </CardTitle>
              </CardHeader>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                    Nome do SaaS
                  </Label>
                  <Input
                    value={formData.saas_name}
                    onChange={(e) => setFormData({ ...formData, saas_name: e.target.value })}
                    className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                    URL Principal
                  </Label>
                  <Input
                    value={formData.main_url}
                    onChange={(e) => setFormData({ ...formData, main_url: e.target.value })}
                    className="h-12 bg-white/5 border-white/10 rounded-xl"
                  />
                </div>
                <div className="space-y-4">
                  <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                    Logo do SaaS
                  </Label>
                  <div className="flex flex-col gap-4">
                    {formData.saas_logo && (
                      <div className="w-32 h-32 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-4">
                        <img
                          src={formData.saas_logo}
                          alt="Logo preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex gap-4">
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="logo-upload"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          const fileExt = file.name.split(".").pop();
                          const filePath = `saas-logo-${Math.random()}.${fileExt}`;

                          toast.promise(
                            (async () => {
                              const { data, error } = await supabase.storage
                                .from("system-assets")
                                .upload(filePath, file);

                              if (error) throw error;

                              const {
                                data: { publicUrl },
                              } = supabase.storage.from("system-assets").getPublicUrl(filePath);

                              setFormData({ ...formData, saas_logo: publicUrl });
                              return publicUrl;
                            })(),
                            {
                              loading: "Enviando logo...",
                              success: "Logo enviada com sucesso!",
                              error: (err) => `Erro ao enviar: ${err.message}`,
                            },
                          );
                        }}
                      />
                      <Button
                        asChild
                        variant="outline"
                        className="h-12 flex-1 rounded-xl bg-white/5 border-white/10 gap-2 font-bold uppercase tracking-widest text-[10px]"
                      >
                        <label htmlFor="logo-upload" className="cursor-pointer">
                          <Upload size={18} />
                          {formData.saas_logo ? "Alterar Logo" : "Upload Logo"}
                        </label>
                      </Button>
                      {formData.saas_logo && (
                        <Button
                          variant="ghost"
                          onClick={() => setFormData({ ...formData, saas_logo: null })}
                          className="h-12 px-4 rounded-xl text-rose-500 hover:bg-rose-500/10"
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="glass border-white/5 rounded-[2.5rem] p-8 border-rose-500/10">
              <CardHeader className="p-0 mb-8">
                <CardTitle className="text-xl font-bold text-rose-400 italic tracking-tight uppercase flex items-center gap-2">
                  <Power className="w-5 h-5" />
                  Estado do Sistema
                </CardTitle>
              </CardHeader>
              <div className="space-y-8">
                <div className="flex items-center justify-between p-6 rounded-3xl bg-rose-500/5 border border-rose-500/10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold uppercase tracking-tight text-sm">
                        Manutenção Global
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-rose-500/10 border-rose-500/20 text-rose-300">
                        Legado / Não Operacional
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed max-w-[280px]">
                      Desacoplado de flags de módulos. A manutenção global da plataforma é
                      gerenciada exclusivamente pelo orquestrador de infraestrutura (R2E.13G.6B).
                    </p>
                  </div>
                  <Switch
                    checked={formData.maintenance_mode}
                    disabled={true}
                    className="data-[state=checked]:bg-rose-500 opacity-50 cursor-not-allowed"
                  />
                </div>

                <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10 space-y-4">
                  <p className="text-amber-400 text-[10px] uppercase font-black tracking-widest">
                    Aviso Importante
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    A URL principal define o domínio de redirecionamento para checkouts e e-mails
                    transacionais. Certifique-se de que o SSL está ativo no domínio configurado.
                  </p>
                </div>
              </div>
            </Card>

            {/* Subseção: Landing Institucional & Contato Público (Hotfix 18) */}
            <Card className="glass border-white/5 rounded-[2.5rem] p-8 lg:col-span-2 border-purple-500/20">
              <CardHeader className="p-0 mb-8">
                <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                  <Globe className="text-purple-400 w-5 h-5" />
                  Landing Institucional & Contato Público
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs">
                  Configure as informações públicas, canais de atendimento e redes sociais exibidos
                  na página principal (barbex.shop). Campos não preenchidos não serão exibidos na
                  landing.
                </CardDescription>
              </CardHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Informações Institucionais & Canais */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" />
                    Dados Institucionais Públicos
                  </h4>

                  <div className="space-y-2">
                    <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                      E-mail Institucional Público
                    </Label>
                    <Input
                      type="email"
                      placeholder="Ex: contato@barbex.shop"
                      value={formData.public_email || ""}
                      onChange={(e) => setFormData({ ...formData, public_email: e.target.value })}
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                    />
                    <p className="text-[11px] text-gray-500 px-1">
                      Exibido publicamente no rodapé e na seção de contato da landing.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                      Telefone Institucional
                    </Label>
                    <Input
                      placeholder="Ex: (11) 3000-0000"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                      WhatsApp Oficial do Barbex
                    </Label>
                    <Input
                      placeholder="Ex: 5511999999999 ou (11) 99999-9999"
                      value={formData.whatsapp_number || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, whatsapp_number: e.target.value })
                      }
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                      Endereço / Sede
                    </Label>
                    <Input
                      placeholder="Ex: Av. Paulista, 1000 - São Paulo/SP"
                      value={formData.address || ""}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                    />
                  </div>

                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="has_contact_form"
                          className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                          Exibir formulário de contato na landing page
                        </Label>
                        <p className="text-[11px] text-gray-400">
                          Habilita o formulário de envio de mensagens em barbex.shop/#contato.
                        </p>
                      </div>
                      <Switch
                        id="has_contact_form"
                        checked={formData.has_contact_form ?? true}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, has_contact_form: checked })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-purple-400 text-[10px] uppercase font-black tracking-widest px-1 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        E-mail para receber mensagens da landing
                      </Label>
                      <Input
                        type="email"
                        placeholder="Ex: leads@barbex.shop ou atendimento@barbex.shop"
                        value={formData.contact_email || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, contact_email: e.target.value })
                        }
                        className="h-12 bg-white/5 border-purple-500/30 rounded-xl focus:ring-purple-500/20"
                      />
                      <p className="text-[11px] text-gray-400 px-1 leading-relaxed">
                        Este endereço receberá as mensagens enviadas pelo formulário de contato da
                        landing institucional do Barbex. Este e-mail{" "}
                        <strong>não será exibido publicamente</strong>; será utilizado somente para
                        receber mensagens do formulário.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Redes Sociais da Plataforma */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                    <Share2 className="w-3.5 h-3.5" />
                    Redes Sociais Oficiais
                  </h4>

                  <div className="space-y-2">
                    <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                      Instagram
                    </Label>
                    <Input
                      placeholder="@barbex.shop ou URL completa"
                      value={formData.social_links?.instagram || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          social_links: {
                            ...(formData.social_links || {}),
                            instagram: e.target.value,
                          },
                        })
                      }
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                      Facebook
                    </Label>
                    <Input
                      placeholder="barbex.shop ou URL completa"
                      value={formData.social_links?.facebook || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          social_links: {
                            ...(formData.social_links || {}),
                            facebook: e.target.value,
                          },
                        })
                      }
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                      TikTok
                    </Label>
                    <Input
                      placeholder="@barbex.shop ou URL completa"
                      value={formData.social_links?.tiktok || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          social_links: {
                            ...(formData.social_links || {}),
                            tiktok: e.target.value,
                          },
                        })
                      }
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                      LinkedIn
                    </Label>
                    <Input
                      placeholder="https://linkedin.com/company/barbex ou barbex"
                      value={formData.social_links?.linkedin || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          social_links: {
                            ...(formData.social_links || {}),
                            linkedin: e.target.value,
                          },
                        })
                      }
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                      YouTube
                    </Label>
                    <Input
                      placeholder="@barbex ou URL completa"
                      value={formData.social_links?.youtube || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          social_links: {
                            ...(formData.social_links || {}),
                            youtube: e.target.value,
                          },
                        })
                      }
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">
                      X / Twitter
                    </Label>
                    <Input
                      placeholder="@barbex ou URL completa"
                      value={formData.social_links?.twitter || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          social_links: {
                            ...(formData.social_links || {}),
                            twitter: e.target.value,
                          },
                        })
                      }
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent
          value="faturamento"
          className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8"
        >
          {/* 1. POLÍTICA DE PERÍODO DE TESTE (TRIAL DA PLATAFORMA) */}
          <Card className="glass border-white/5 rounded-[2.5rem] p-8 max-w-4xl border-purple-500/20">
            <CardHeader className="p-0 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                    <Calendar className="text-purple-400 w-5 h-5" />
                    Política de Período de Teste (Trial)
                  </CardTitle>
                  <CardDescription className="text-gray-400 text-xs mt-1">
                    Defina a duração padrão e o plano inicial concedido automaticamente a novas
                    barbearias cadastradas na plataforma.
                  </CardDescription>
                </div>
                <div className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono text-[10px] uppercase font-bold tracking-wider shrink-0">
                  Novos Cadastros
                </div>
              </div>
            </CardHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="trial-days-input"
                    className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1"
                  >
                    Duração Padrão do Teste (Dias)
                  </Label>
                  <Input
                    id="trial-days-input"
                    type="number"
                    min={1}
                    max={90}
                    value={trialDaysInput}
                    onChange={(e) =>
                      setTrialDaysInput(Math.max(1, Math.min(90, parseInt(e.target.value) || 1)))
                    }
                    className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50 text-white font-mono text-sm"
                  />
                  <p className="text-[11px] text-gray-500 px-1">
                    Intervalo permitido: 1 a 90 dias. Padrão canônico da plataforma: 15 dias.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="trial-plan-select"
                    className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1"
                  >
                    Plano Comercial Concedido no Trial
                  </Label>
                  <Select value={trialPlanInput} onValueChange={(val) => setTrialPlanInput(val)}>
                    <SelectTrigger
                      id="trial-plan-select"
                      className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-medium"
                    >
                      <SelectValue placeholder="Selecione o plano de teste" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      {activePlans && activePlans.length > 0 ? (
                        activePlans.map((p) => (
                          <SelectItem
                            key={p.slug}
                            value={p.slug}
                            className="cursor-pointer hover:bg-white/10"
                          >
                            {p.name} ({p.slug.toUpperCase()})
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="starter">Starter (STARTER)</SelectItem>
                          <SelectItem value="pro">Pro (PRO)</SelectItem>
                          <SelectItem value="elite">Elite (ELITE)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-gray-500 px-1">
                    Apenas planos ativos no catálogo comercial podem ser selecionados para o trial.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 space-y-2">
                <p className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-amber-300">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Contrato de Não-Retroatividade:
                </p>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  A alteração desta política{" "}
                  <strong>aplica-se exclusivamente a novos cadastros</strong> de barbearias. Contas
                  que já possuem período de teste em vigor mantêm sua data de término original sem
                  recálculo retroativo. Nenhuma alteração é enviada à API do Stripe.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setTrialConfirmOpen(true)}
                  disabled={updateTrialPolicyMutation.isPending}
                  className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white gap-2 text-xs uppercase tracking-wider h-10 px-5 shadow-[0_0_16px_rgba(168,85,247,0.3)]"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salvar Política de Trial
                </Button>
              </div>
            </div>
          </Card>

          {/* 2. GOVERNANÇA DE PERÍODO DE GRAÇA (GRACE PERIOD) - R2E.14B ATIVO */}
          <Card className="glass border-white/5 rounded-[2.5rem] p-8 max-w-4xl border-blue-500/20">
            <CardHeader className="p-0 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                    <Clock className="text-blue-400 w-5 h-5" />
                    Período de Carência para Inadimplência
                  </CardTitle>
                  <CardDescription className="text-gray-400 text-xs mt-1">
                    Janela temporal de tolerância para faturas vencidas e inadimplência temporária
                    (past_due) exclusivamente para assinantes pagantes.
                  </CardDescription>
                </div>
                <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono text-[10px] uppercase font-bold tracking-wider shrink-0">
                  {(settings as any)?.grace_period_days ?? 7} Dias Vigentes
                </div>
              </div>
            </CardHeader>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="grace-days-input"
                  className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1"
                >
                  Dias de Carência na Inadimplência (1 a 30 dias)
                </Label>
                <Input
                  id="grace-days-input"
                  type="number"
                  min={1}
                  max={30}
                  value={graceDaysInput}
                  onChange={(e) =>
                    setGraceDaysInput(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))
                  }
                  className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-blue-500/50 text-white font-mono text-sm max-w-xs"
                />
                <p className="text-[11px] text-gray-500 px-1">
                  Intervalo permitido: 1 a 30 dias. Padrão canônico da plataforma: 7 dias.
                </p>
              </div>

              {/* Explicação estrita em português distinguindo Trial de Grace */}
              <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-300 uppercase tracking-wider">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  Isolamento Rigoroso entre Teste Gratuito e Carência:
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Aplica-se somente a assinantes pagantes cuja renovação não pôde ser cobrada. Não
                  altera nem estende o período de teste gratuito de 15 dias.
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Tenants no período de teste gratuito que não contratarem uma assinatura comercial
                  têm o acesso encerrado ao final dos 15 dias sem receber carência (15 dias de teste
                  nunca se tornam 22 dias).
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setGraceConfirmOpen(true)}
                  disabled={updateGracePolicyMutation.isPending}
                  className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2 text-xs uppercase tracking-wider h-10 px-5 shadow-[0_0_16px_rgba(59,130,246,0.3)]"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salvar Período de Carência
                </Button>
              </div>
            </div>
          </Card>

          {/* 3. SEGURANÇA & CREDENCIAIS DE FATURAMENTO (CARD PREEXISTENTE PRESERVADO) */}
          <Card className="glass border-white/5 rounded-[2.5rem] p-8 max-w-4xl">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                <CreditCard className="text-blue-400 w-5 h-5" />
                Segurança & Credenciais de Faturamento
              </CardTitle>
              <CardDescription className="text-gray-400">
                Arquitetura e custódia de credenciais Stripe da plataforma.
              </CardDescription>
            </CardHeader>
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 space-y-3">
                <p className="text-white font-bold uppercase tracking-tight text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-400" />
                  Autoridade Exclusiva do Servidor
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Conforme a arquitetura canônica (R2E.12B / R2E.13B), chaves secretas de API (
                  <code className="text-blue-300">STRIPE_SECRET_KEY</code>) e segredos de assinatura
                  de webhook (<code className="text-blue-300">STRIPE_WEBHOOK_SECRET</code>) residem
                  estritamente no cofre seguro do Supabase (Vault / Edge Runtime) e não são
                  armazenados em tabelas de configurações públicas nem manipulados via navegador.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex gap-3">
                <Info className="text-blue-400 w-5 h-5 shrink-0" />
                <p className="text-xs text-blue-200/70 font-medium">
                  O ambiente de execução da plataforma opera em modo <strong>LIVE</strong> com
                  preços e produtos canônicos vinculados no servidor. Alterações de credenciais
                  devem ser realizadas exclusivamente por operador autorizado via console de
                  infraestrutura.
                </p>
              </div>
            </div>
          </Card>

          {/* MODAL DE CONFIRMAÇÃO NÍVEL 2: POLÍTICA DE TRIAL */}
          <Dialog
            open={trialConfirmOpen}
            onOpenChange={(open) =>
              !open && !updateTrialPolicyMutation.isPending && setTrialConfirmOpen(false)
            }
          >
            <DialogContent className="glass border-purple-500/30 text-white max-w-lg rounded-3xl">
              <DialogHeader className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black text-purple-300 tracking-tight">
                      CONFIRMAR POLÍTICA DE TRIAL
                    </DialogTitle>
                    <DialogDescription className="text-gray-400 text-xs mt-1">
                      Governança da plataforma: requer justificativa operacional obrigatória.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Duração Atual:</span>
                    <span className="text-white font-mono font-bold">
                      {(settings as any)?.default_trial_days || 15} dias
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nova Duração:</span>
                    <span className="text-purple-300 font-mono font-bold">
                      {trialDaysInput} dias
                    </span>
                  </div>
                  <div className="border-t border-white/5 my-1" />
                  <div className="flex justify-between">
                    <span className="text-gray-400">Plano Atual:</span>
                    <span className="text-white font-mono uppercase font-bold">
                      {(settings as any)?.default_trial_plan || "pro"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Novo Plano:</span>
                    <span className="text-purple-300 font-mono uppercase font-bold">
                      {trialPlanInput}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 space-y-1">
                  <p className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-400" />
                    Impacto da Modificação:
                  </p>
                  <p className="text-gray-300 text-[11px] leading-relaxed mt-1">
                    Esta política afetará <strong>apenas novas contas</strong> criadas após a
                    confirmação. Contas com período de teste em vigor mantêm seu prazo original. A
                    mutação e a justificativa serão registradas atomicamente no log de auditoria da
                    plataforma.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label
                      htmlFor="trial-policy-reason"
                      className="text-xs font-bold text-gray-300"
                    >
                      Justificativa Operacional (Obrigatório, 10 a 500 caracteres)
                    </Label>
                    <span
                      className={cn(
                        "text-[10px] font-mono",
                        trialReason.trim().length >= 10 && trialReason.trim().length <= 500
                          ? "text-emerald-400"
                          : "text-gray-500",
                      )}
                    >
                      {trialReason.trim().length}/500
                    </span>
                  </div>
                  <Textarea
                    id="trial-policy-reason"
                    value={trialReason}
                    onChange={(e) => setTrialReason(e.target.value)}
                    placeholder="Descreva a razão comercial/estratégica para a alteração da política de trial..."
                    disabled={updateTrialPolicyMutation.isPending}
                    maxLength={500}
                    className="bg-white/5 border-white/10 text-white rounded-xl min-h-[90px] focus:border-purple-500 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 mt-2">
                <Button
                  variant="outline"
                  onClick={() => setTrialConfirmOpen(false)}
                  disabled={updateTrialPolicyMutation.isPending}
                  className="rounded-xl border-white/10 hover:bg-white/10 text-gray-300"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={
                    trialReason.trim().length < 10 ||
                    trialReason.trim().length > 500 ||
                    updateTrialPolicyMutation.isPending
                  }
                  onClick={() => {
                    updateTrialPolicyMutation.mutate({
                      days: trialDaysInput,
                      plan: trialPlanInput,
                      reason: trialReason,
                    });
                  }}
                  className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {updateTrialPolicyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gravando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Confirmar e Gravar Política
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* MODAL DE CONFIRMAÇÃO NÍVEL 2: PERÍODO DE CARÊNCIA (R2E.14B) */}
          <Dialog
            open={graceConfirmOpen}
            onOpenChange={(open) =>
              !open && !updateGracePolicyMutation.isPending && setGraceConfirmOpen(false)
            }
          >
            <DialogContent className="glass border-blue-500/30 text-white max-w-lg rounded-3xl">
              <DialogHeader className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black text-blue-300 tracking-tight">
                      CONFIRMAR PERÍODO DE CARÊNCIA
                    </DialogTitle>
                    <DialogDescription className="text-gray-400 text-xs mt-1">
                      Governança da plataforma: requer justificativa operacional obrigatória.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Duração Atual de Carência:</span>
                    <span className="text-white font-mono font-bold">
                      {(settings as any)?.grace_period_days || 7} dias
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nova Duração de Carência:</span>
                    <span className="text-blue-300 font-mono font-bold">{graceDaysInput} dias</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
                  <p className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-400" />
                    Impacto da Modificação:
                  </p>
                  <p className="text-gray-300 text-[11px] leading-relaxed mt-1">
                    Esta política afetará <strong>novos episódios de inadimplência</strong> gerados
                    após a confirmação. Episódios já em curso mantêm seu prazo de expiração
                    (grace_ends_at) imutável. A mutação e a justificativa serão registradas
                    atomicamente no log de auditoria da plataforma.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label
                      htmlFor="grace-policy-reason"
                      className="text-xs font-bold text-gray-300"
                    >
                      Justificativa Operacional (Obrigatório, 10 a 500 caracteres)
                    </Label>
                    <span
                      className={cn(
                        "text-[10px] font-mono",
                        graceReason.trim().length >= 10 && graceReason.trim().length <= 500
                          ? "text-emerald-400"
                          : "text-gray-500",
                      )}
                    >
                      {graceReason.trim().length}/500
                    </span>
                  </div>
                  <Textarea
                    id="grace-policy-reason"
                    value={graceReason}
                    onChange={(e) => setGraceReason(e.target.value)}
                    placeholder="Descreva a razão comercial/estratégica para a alteração do período de carência..."
                    disabled={updateGracePolicyMutation.isPending}
                    maxLength={500}
                    className="bg-white/5 border-white/10 text-white rounded-xl min-h-[90px] focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 mt-2">
                <Button
                  variant="outline"
                  onClick={() => setGraceConfirmOpen(false)}
                  disabled={updateGracePolicyMutation.isPending}
                  className="rounded-xl border-white/10 hover:bg-white/10 text-gray-300"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={
                    graceReason.trim().length < 10 ||
                    graceReason.trim().length > 500 ||
                    updateGracePolicyMutation.isPending
                  }
                  onClick={() => {
                    updateGracePolicyMutation.mutate({
                      days: graceDaysInput,
                      reason: graceReason,
                    });
                  }}
                  className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {updateGracePolicyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gravando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Confirmar e Gravar Política
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent
          value="seguranca"
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="glass border-white/5 rounded-[2.5rem] p-8">
              <CardHeader className="p-0 mb-8">
                <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                  <Smartphone className="text-purple-400 w-5 h-5" />
                  Políticas de Autenticação & Acesso
                </CardTitle>
              </CardHeader>
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <p className="text-white font-bold text-sm uppercase italic">
                    Controle de Identidade Centralizado
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Políticas de MFA (autenticação de dois fatores) e restrições de rede para contas
                    de super administração são aplicadas diretamente no nível de identidade
                    (Supabase Auth / Provedor de Identidade) e nas regras de borda (Cloudflare /
                    WAF).
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex gap-3">
                  <Info className="text-purple-400 w-5 h-5 shrink-0" />
                  <p className="text-xs text-purple-200/70 font-medium">
                    Controles sem imposição no backend foram removidos para garantir a estrita
                    integridade do painel de controle.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="glass border-white/5 rounded-[2.5rem] p-8">
              <CardHeader className="p-0 mb-8">
                <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                  <History className="text-blue-400 w-5 h-5" />
                  Auditoria & Compliance
                </CardTitle>
              </CardHeader>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold text-sm uppercase italic">
                        Logs de Atividade
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-300">
                        Obrigatório / Incondicional
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Auditoria de conformidade e segurança da plataforma sempre ativa. Não pode ser
                      desativada por flag genérica.
                    </p>
                  </div>
                  <Switch
                    checked={true}
                    disabled={true}
                    className="data-[state=checked]:bg-blue-600 opacity-50 cursor-not-allowed"
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl border-white/10 bg-white/5 gap-2 text-xs font-bold uppercase tracking-widest"
                >
                  <ExternalLink size={14} /> Exportar Relatório de Auditoria
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent
          value="integracoes"
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "WhatsApp (Z-API)",
                status: "Conectado",
                icon: "https://cdn-icons-png.flaticon.com/512/733/733585.png",
                color: "text-emerald-400",
              },
              {
                name: "E-mail (Resend)",
                status: "Ativo",
                icon: "https://avatars.githubusercontent.com/u/104191638?s=200&v=4",
                color: "text-white",
              },
              {
                name: "OpenAI (IA)",
                status: "Configurado",
                icon: "https://openai.com/favicon.ico",
                color: "text-purple-400",
              },
              {
                name: "Google Analytics",
                status: "Inativo",
                icon: "https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg",
                color: "text-gray-500",
              },
            ].map((integ, i) => (
              <Card
                key={i}
                className="glass border-white/5 rounded-3xl p-6 group hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                    <img
                      src={integ.icon}
                      alt={integ.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm uppercase tracking-tighter">
                      {integ.name}
                    </h4>
                    <span
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        integ.color,
                      )}
                    >
                      {integ.status}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-full rounded-xl bg-white/5 text-[10px] font-bold uppercase tracking-widest border border-white/5 group-hover:border-purple-500/30"
                >
                  Gerenciar Conexão
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent
          value="mensagens"
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <Card className="glass border-white/5 rounded-3xl p-8">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Central de Mensagens da Plataforma
              </CardTitle>
              <CardDescription>
                A caixa de entrada de mensagens de contato da plataforma foi promovida para uma rota
                operacional de nível superior dedicada (R2E.13F).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Para gerenciar, responder, arquivar ou excluir mensagens de contato de barbearias e
                visitantes com suporte completo a filtros, pastas e threads de resposta, acesse a
                rota canônica.
              </p>
              <Button asChild variant="default" className="gap-2">
                <Link to="/admin/messages">
                  Acessar Mensagens da Plataforma (/admin/messages)
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="features"
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <GlobalFeatureGovernance />
        </TabsContent>

        <TabsContent
          value="notificacoes"
          className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6"
        >
          <AdminEventSubscriptions />
          <AdminEventTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
}
