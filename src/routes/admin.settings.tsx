import { createFileRoute } from "@tanstack/react-router";
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
  MessageSquare
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AdminEventSubscriptions } from "@/components/admin/AdminEventSubscriptions";
import { AdminEventTemplates } from "@/components/admin/AdminEventTemplates";
import { PlatformContactInbox } from "@/components/admin/PlatformContactInbox";

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

  const { data: settings, isLoading, error: queryError } = useQuery({
    queryKey: ["admin-system-settings"],
    queryFn: async () => {
      console.log("Fetching system settings...");
      // Fetch settings with a simple select to avoid maybeSingle issues if data is inconsistent
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .limit(1);

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
    }
  });

  const [formData, setFormData] = useState<any>(null);

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
    } else if (settings === null && !isLoading && !queryError) {
      // Cenário B: Tabela vazia — inicializar com valores padrão seguros
      setFormData(DEFAULT_SYSTEM_SETTINGS);
    }
  }, [settings, isLoading, queryError]);

  const updateMutation = useMutation({
    mutationFn: async (newData: any) => {
      const targetId = settings?.id || newData?.id;

      if (targetId) {
        // Atualização de registro existente — nunca persistir credenciais sensíveis em system_settings
        const { id, updated_at, stripe_secret_key, stripe_webhook_secret, two_factor_auth_enabled, ...updatePayload } = newData;
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
          const { error } = await supabase
            .from("system_settings")
            .insert([insertPayload]);

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
    }
  });

  if (isLoading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        <p className="text-gray-500 font-black italic uppercase tracking-widest">Acessando Núcleo do Sistema...</p>
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
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white italic uppercase truncate">Configurações da Plataforma</h2>
          <p className="text-gray-400 font-medium text-sm truncate">Gerencie identidade pública, comunicação e informações institucionais do Barbex.</p>
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
              { id: "mensagens", label: "Contato da Plataforma", icon: MessageSquare },
              { id: "faturamento", label: "Faturamento", icon: CreditCard },
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

        <TabsContent value="geral" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                  <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">Nome do SaaS</Label>
                  <Input
                    value={formData.saas_name}
                    onChange={(e) => setFormData({...formData, saas_name: e.target.value})}
                    className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">URL Principal</Label>
                  <Input
                    value={formData.main_url}
                    onChange={(e) => setFormData({...formData, main_url: e.target.value})}
                    className="h-12 bg-white/5 border-white/10 rounded-xl"
                  />
                </div>
                <div className="space-y-4">
                  <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">Logo do SaaS</Label>
                  <div className="flex flex-col gap-4">
                    {formData.saas_logo && (
                      <div className="w-32 h-32 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-4">
                        <img src={formData.saas_logo} alt="Logo preview" className="max-w-full max-h-full object-contain" />
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

                          const fileExt = file.name.split('.').pop();
                          const filePath = `saas-logo-${Math.random()}.${fileExt}`;

                          toast.promise(
                            (async () => {
                              const { data, error } = await supabase.storage
                                .from('system-assets')
                                .upload(filePath, file);

                              if (error) throw error;

                              const { data: { publicUrl } } = supabase.storage
                                .from('system-assets')
                                .getPublicUrl(filePath);

                              setFormData({ ...formData, saas_logo: publicUrl });
                              return publicUrl;
                            })(),
                            {
                              loading: 'Enviando logo...',
                              success: 'Logo enviada com sucesso!',
                              error: (err) => `Erro ao enviar: ${err.message}`
                            }
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
                          onClick={() => setFormData({...formData, saas_logo: null})}
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
                    <p className="text-white font-bold uppercase tracking-tight text-sm">Manutenção Global</p>
                    <p className="text-xs text-gray-500 leading-relaxed max-w-[280px]">Ative para bloquear o acesso de todos os usuários enquanto realiza atualizações críticas.</p>
                  </div>
                  <Switch
                    checked={formData.maintenance_mode}
                    onCheckedChange={(val) => setFormData({...formData, maintenance_mode: val})}
                    className="data-[state=checked]:bg-rose-500"
                  />
                </div>

                <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10 space-y-4">
                  <p className="text-amber-400 text-[10px] uppercase font-black tracking-widest">Aviso Importante</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    A URL principal define o domínio de redirecionamento para checkouts e e-mails transacionais. Certifique-se de que o SSL está ativo no domínio configurado.
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
                  Configure as informações públicas, canais de atendimento e redes sociais exibidos na página principal (barbex.shop). Campos não preenchidos não serão exibidos na landing.
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
                      onChange={(e) => setFormData({...formData, public_email: e.target.value})}
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
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
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
                      onChange={(e) => setFormData({...formData, whatsapp_number: e.target.value})}
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
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
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
                        onCheckedChange={(checked) => setFormData({ ...formData, has_contact_form: checked })}
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
                        onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                        className="h-12 bg-white/5 border-purple-500/30 rounded-xl focus:ring-purple-500/20"
                      />
                      <p className="text-[11px] text-gray-400 px-1 leading-relaxed">
                        Este endereço receberá as mensagens enviadas pelo formulário de contato da landing institucional do Barbex. Este e-mail <strong>não será exibido publicamente</strong>; será utilizado somente para receber mensagens do formulário.
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
                      onChange={(e) => setFormData({
                        ...formData,
                        social_links: { ...(formData.social_links || {}), instagram: e.target.value }
                      })}
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
                      onChange={(e) => setFormData({
                        ...formData,
                        social_links: { ...(formData.social_links || {}), facebook: e.target.value }
                      })}
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
                      onChange={(e) => setFormData({
                        ...formData,
                        social_links: { ...(formData.social_links || {}), tiktok: e.target.value }
                      })}
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
                      onChange={(e) => setFormData({
                        ...formData,
                        social_links: { ...(formData.social_links || {}), linkedin: e.target.value }
                      })}
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
                      onChange={(e) => setFormData({
                        ...formData,
                        social_links: { ...(formData.social_links || {}), youtube: e.target.value }
                      })}
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
                      onChange={(e) => setFormData({
                        ...formData,
                        social_links: { ...(formData.social_links || {}), twitter: e.target.value }
                      })}
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="faturamento" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="glass border-white/5 rounded-[2.5rem] p-8 max-w-3xl">
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
                  Conforme a arquitetura canônica (R2E.12B / R2E.13B), chaves secretas de API (<code className="text-blue-300">STRIPE_SECRET_KEY</code>) e segredos de assinatura de webhook (<code className="text-blue-300">STRIPE_WEBHOOK_SECRET</code>) residem estritamente no cofre seguro do Supabase (Vault / Edge Runtime) e não são armazenados em tabelas de configurações públicas nem manipulados via navegador.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex gap-3">
                <Info className="text-blue-400 w-5 h-5 shrink-0" />
                <p className="text-xs text-blue-200/70 font-medium">
                  O ambiente de execução da plataforma opera em modo <strong>LIVE</strong> com preços e produtos canônicos vinculados no servidor. Alterações de credenciais devem ser realizadas exclusivamente por operador autorizado via console de infraestrutura.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="seguranca" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                  <p className="text-white font-bold text-sm uppercase italic">Controle de Identidade Centralizado</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Políticas de MFA (autenticação de dois fatores) e restrições de rede para contas de super administração são aplicadas diretamente no nível de identidade (Supabase Auth / Provedor de Identidade) e nas regras de borda (Cloudflare / WAF).
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex gap-3">
                  <Info className="text-purple-400 w-5 h-5 shrink-0" />
                  <p className="text-xs text-purple-200/70 font-medium">
                    Controles sem imposição no backend foram removidos para garantir a estrita integridade do painel de controle.
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
                    <p className="text-white font-bold text-sm uppercase italic">Logs de Atividade</p>
                    <p className="text-xs text-gray-500">Registrar todas as ações de Super Admins no banco.</p>
                  </div>
                  <Switch
                    checked={formData.audit_logs_enabled}
                    onCheckedChange={(val) => setFormData({...formData, audit_logs_enabled: val})}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>
                <Button variant="outline" className="w-full h-12 rounded-xl border-white/10 bg-white/5 gap-2 text-xs font-bold uppercase tracking-widest">
                  <ExternalLink size={14} /> Exportar Relatório de Auditoria
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="integracoes" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "WhatsApp (Z-API)", status: "Conectado", icon: "https://cdn-icons-png.flaticon.com/512/733/733585.png", color: "text-emerald-400" },
              { name: "E-mail (Resend)", status: "Ativo", icon: "https://avatars.githubusercontent.com/u/104191638?s=200&v=4", color: "text-white" },
              { name: "OpenAI (IA)", status: "Configurado", icon: "https://openai.com/favicon.ico", color: "text-purple-400" },
              { name: "Google Analytics", status: "Inativo", icon: "https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg", color: "text-gray-500" },
            ].map((integ, i) => (
              <Card key={i} className="glass border-white/5 rounded-3xl p-6 group hover:border-white/10 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                    <img src={integ.icon} alt={integ.name} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm uppercase tracking-tighter">{integ.name}</h4>
                    <span className={cn("text-[10px] font-black uppercase tracking-widest", integ.color)}>{integ.status}</span>
                  </div>
                </div>
                <Button variant="ghost" className="w-full rounded-xl bg-white/5 text-[10px] font-bold uppercase tracking-widest border border-white/5 group-hover:border-purple-500/30">
                  Gerenciar Conexão
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="mensagens" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <PlatformContactInbox />
        </TabsContent>

        <TabsContent value="notificacoes" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          <AdminEventSubscriptions />
          <AdminEventTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
}
