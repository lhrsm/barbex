import { useState, useEffect } from "react";
import {
  Zap,
  RefreshCw,
  Trash2,
  Save,
  Loader2,
  Copy,
  Edit3,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  History,
  FileText,
  Phone,
  Activity,
  Terminal,
  Send,
  Lock,
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  sendZApiTestButton,
  checkZApiStatus,
  setZApiWebhook,
  saveZApiConfig,
  getZApiStatus,
  removeZApiConfig,
} from "@/lib/backend/edge/zapi";

interface WhatsAppInstance {
  id?: string | null;
  instance_id: string;
  server_url: string;
  status: string;
  phone?: string | null;
  updated_at?: string;
  connected?: boolean;
  token_configured?: boolean;
  client_token_configured?: boolean;
  webhook_received_url?: string | null;
  webhook_received_configured_at?: string | null;
  webhook_received_last_response?: any;
}

const isZApiSuccess = (data: any) => {
  if (!data) return false;
  if (data.success === true) return true;
  if (data.allCompatible === true) return true;
  const result = data.result;
  if (result) {
    if (
      result.value === true ||
      result.success === true ||
      result.message?.toLowerCase().includes("sucesso")
    )
      return true;
    if (Array.isArray(data.results)) {
      return data.results.every((r: any) => r.success || r.isCompatible);
    }
  }
  if (data.status === 200 || data.status === 201) return true;
  return false;
};

export function ZApiWhatsAppCard({ tenantId }: { tenantId: string }) {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [integrationLogs, setIntegrationLogs] = useState<any[]>([]);
  const [lastWebhookCall, setLastWebhookCall] = useState<any>(null);
  const [isSendingButtonTest, setIsSendingButtonTest] = useState(false);
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);
  const [lastEndpointTestResult, setLastEndpointTestResult] = useState<any>(null);
  const [isWaitingForCallback, setIsWaitingForCallback] = useState(false);
  const [webhookDebugLogs, setWebhookDebugLogs] = useState<any[]>([]);
  const [callbackResult, setCallbackResult] = useState<{
    received: boolean;
    time?: string | null;
    buttonId?: string | null;
    phone?: string | null;
    payload?: any;
    error?: string;
  } | null>(null);

  // Safe non-secret form fields
  const [formData, setFormData] = useState({
    instance_id: "",
    api_url: "https://api.z-api.io",
    phone: "",
  });

  // Write-only password fields: never hydrated from stored secrets
  const [tokenInput, setTokenInput] = useState("");
  const [clientTokenInput, setClientTokenInput] = useState("");
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [clientTokenConfigured, setClientTokenConfigured] = useState(false);

  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("config");

  useEffect(() => {
    if (tenantId) {
      fetchInstance();
      fetchLogs();
      fetchIntegrationLogs();
    }
  }, [tenantId]);

  async function fetchIntegrationLogs() {
    try {
      const { data: logRows } = await supabase
        .from("zapi_integration_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (logRows) {
        setIntegrationLogs(logRows);
      }

      const { data: debugLogs } = await supabase
        .from("zapi_webhook_debug")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("received_at", { ascending: false })
        .limit(10);

      if (debugLogs) {
        setWebhookDebugLogs(debugLogs);
      }
    } catch (error) {
      console.error("Error fetching integration logs:", error);
    }
  }

  async function sendTestButtonWithCallback() {
    if (!instance?.instance_id || !tokenConfigured) {
      toast.error("Salve as configurações primeiro");
      return;
    }
    if (!formData.phone) {
      toast.error("Informe um telefone de destino para o teste");
      return;
    }
    const phone = formData.phone.replace(/\D/g, "");
    setIsSendingButtonTest(true);
    setIsWaitingForCallback(true);
    setCallbackResult(null);
    try {
      const res = await sendZApiTestButton({
        phone,
        instanceId: instance.id || undefined,
        tenantId,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Mensagem enviada! Clique no botão no seu WhatsApp.");
      let secondsPassed = 0;
      const maxSeconds = 30;
      const startTime = new Date().toISOString();
      const checkInterval = setInterval(async () => {
        secondsPassed += 3;
        await fetchIntegrationLogs();
        const { data: webhookLogs } = await supabase
          .from("zapi_webhook_debug")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("source", "zapi_real")
          .eq("option_id", "main_confirm")
          .gte("received_at", startTime)
          .order("received_at", { ascending: false })
          .limit(1);

        if (webhookLogs && webhookLogs.length > 0) {
          clearInterval(checkInterval);
          setIsWaitingForCallback(false);
          const log = webhookLogs[0];
          setCallbackResult({
            received: true,
            time: log.received_at,
            buttonId: log.option_id,
            phone: log.phone_normalized,
            payload: log.payload_raw,
          });
          toast.success("Callback recebido com sucesso!");
        } else if (secondsPassed >= maxSeconds) {
          clearInterval(checkInterval);
          setIsWaitingForCallback(false);
          setCallbackResult({
            received: false,
            error: "Nenhum webhook recebido após 30 segundos.",
          });
          toast.error("Tempo esgotado.");
        }
      }, 3000);
    } catch (err: any) {
      setIsWaitingForCallback(false);
      toast.error("Erro: " + err.message);
    } finally {
      setIsSendingButtonTest(false);
    }
  }

  async function fetchInstance() {
    try {
      // Safe status API: returns metadata without exposing raw secrets
      const res = await getZApiStatus({ tenantId });
      if (res.ok) {
        setTokenConfigured(Boolean(res.tokenConfigured));
        setClientTokenConfigured(Boolean(res.clientTokenConfigured));
        setFormData({
          instance_id: res.instanceId || "",
          api_url: res.serverUrl || "https://api.z-api.io",
          phone: res.phone || "",
        });
        setInstance({
          id: res.id,
          instance_id: res.instanceId || "",
          server_url: res.serverUrl || "https://api.z-api.io",
          status: res.status,
          connected: res.connected,
          phone: res.phone || "",
          token_configured: res.tokenConfigured,
          client_token_configured: res.clientTokenConfigured,
          webhook_received_url: res.webhookReceivedUrl || undefined,
          webhook_received_configured_at: res.webhookReceivedConfiguredAt || undefined,
        });
      }
    } catch (error) {
      console.error("Error fetching Z-API status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs() {
    try {
      const { data } = await supabase
        .from("automation_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setLogs(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.instance_id.trim()) {
      toast.error("Informe o ID da instância Z-API");
      return;
    }
    // If not previously configured, token is required
    if (!tokenConfigured && !tokenInput.trim()) {
      toast.error("Informe o token da instância Z-API");
      return;
    }

    setIsSaving(true);
    const phone = formData.phone.replace(/\D/g, "");

    try {
      // Write-only configuration API: sends credentials over HTTPS directly to Edge Function
      const res = await saveZApiConfig({
        tenantId,
        instance_id: formData.instance_id.trim(),
        token: tokenInput.trim(),
        client_token: clientTokenInput.trim() || undefined,
        server_url: formData.api_url.trim(),
        phone,
      });

      if (!res.ok) {
        throw new Error(res.error || "Falha ao salvar configurações");
      }

      // Clear password input values immediately upon save: never retain in memory
      setTokenInput("");
      setClientTokenInput("");
      setTokenConfigured(true);
      if (clientTokenInput.trim()) {
        setClientTokenConfigured(true);
      }

      toast.success("Configurações do Z-API salvas com sucesso!");

      // Re-fetch safe status
      await fetchInstance();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message || "falha desconhecida"));
    } finally {
      setIsSaving(false);
    }
  }

  async function syncStatus() {
    if (!instance?.instance_id && !formData.instance_id) return;
    setIsTesting(true);
    try {
      const res = await checkZApiStatus({ instanceId: instance?.id || undefined, tenantId });
      if (!res.ok) throw new Error(res.error);
      toast.success("Status sincronizado!");
      await fetchInstance();
    } catch (err: any) {
      toast.error(err?.message || "Erro na sincronização");
    } finally {
      setIsTesting(false);
    }
  }

  async function reconfigureWebhook() {
    if (!instance?.instance_id && !formData.instance_id) return;
    setIsConfiguring(true);
    try {
      const res = await setZApiWebhook({ instanceId: instance?.id || undefined, tenantId });
      if (!res.ok) throw new Error(res.error);
      setLastWebhookCall(res);
      toast.success("Webhook configurado com sucesso!");
      await fetchInstance();
    } catch (err: any) {
      toast.error("Erro na reconfiguração: " + err.message);
    } finally {
      setIsConfiguring(false);
    }
  }

  async function testSupabaseEndpoint() {
    if (!instance?.instance_id && !formData.instance_id) return;
    setIsTestingEndpoint(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-webhook", {
        body: { type: "ReceivedCallback", phone: formData.phone || "5571988939385", text: "1" },
      });
      if (error) throw error;
      setLastEndpointTestResult(data);
      if (data.success) toast.success("Endpoint testado com sucesso!");
      else toast.error("Falha no teste do endpoint");
    } catch (err: any) {
      toast.error("Erro no teste");
    } finally {
      setIsTestingEndpoint(false);
    }
  }

  async function handleRemoveIntegration() {
    if (!confirm("Deseja realmente remover as configurações do Z-API WhatsApp?")) return;
    setIsRemoving(true);
    try {
      const res = await removeZApiConfig({ tenantId });
      if (!res.ok) throw new Error(res.error);
      setInstance(null);
      setTokenConfigured(false);
      setClientTokenConfigured(false);
      setFormData({
        instance_id: "",
        api_url: "https://api.z-api.io",
        phone: "",
      });
      setTokenInput("");
      setClientTokenInput("");
      toast.success("Integração removida com sucesso!");
      await fetchInstance();
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    } finally {
      setIsRemoving(false);
    }
  }

  if (loading)
    return <div className="p-8 text-center text-zinc-400">Carregando integrações...</div>;

  return (
    <Card className="bg-[#0b0f1a] border-white/10 text-white">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Zap className="text-blue-400" /> Z-API WhatsApp
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              className={
                instance?.connected
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }
            >
              {instance?.connected ? "Conectado" : "Desconectado"}
            </Badge>
            {tokenConfigured && (
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]"
              >
                <ShieldCheck className="w-3 h-3 mr-1" /> Vault Seguro
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border-white/10">
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4 pt-4">
            <form onSubmit={saveSettings} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone WhatsApp</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ex: 5571999999999"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID Instância Z-API</Label>
                  <Input
                    value={formData.instance_id}
                    onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })}
                    placeholder="Ex: 3B4C5D6E7F8G9H0I"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Token Z-API</Label>
                    {tokenConfigured && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Configurado
                      </span>
                    )}
                  </div>
                  <Input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={
                      tokenConfigured
                        ? "•••••••••••• (Configurado — digite para alterar)"
                        : "Insira o token da Z-API"
                    }
                    className="bg-white/5 border-white/10"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Client Token</Label>
                    {clientTokenConfigured && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Configurado
                      </span>
                    )}
                  </div>
                  <Input
                    type="password"
                    value={clientTokenInput}
                    onChange={(e) => setClientTokenInput(e.target.value)}
                    placeholder={
                      clientTokenConfigured
                        ? "•••••••••••• (Configurado — digite para alterar)"
                        : "Insira o client token (opcional)"
                    }
                    className="bg-white/5 border-white/10"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="h-8 px-3 text-xs rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={16} /> Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2" size={16} /> Salvar Configurações
                    </>
                  )}
                </Button>

                {tokenConfigured && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isRemoving}
                    onClick={handleRemoveIntegration}
                    className="h-8 px-3 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    {isRemoving ? (
                      <Loader2 className="animate-spin mr-1" size={14} />
                    ) : (
                      <Trash2 className="mr-1" size={14} />
                    )}
                    Remover Conexão
                  </Button>
                )}
              </div>
            </form>
          </TabsContent>

          <TabsContent value="diagnostico" className="pt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={syncStatus}
                disabled={isTesting || !tokenConfigured}
                size="sm"
                className="bg-zinc-700 hover:bg-zinc-600"
              >
                {isTesting ? (
                  <Loader2 className="animate-spin mr-1" size={14} />
                ) : (
                  <RefreshCw className="mr-1" size={14} />
                )}
                Sincronizar Status
              </Button>
              <Button
                onClick={reconfigureWebhook}
                disabled={isConfiguring || !tokenConfigured}
                size="sm"
                className="bg-blue-600 hover:bg-blue-500"
              >
                Configurar Webhook V2
              </Button>
              <Button
                onClick={testSupabaseEndpoint}
                disabled={isTestingEndpoint}
                size="sm"
                className="bg-amber-600 hover:bg-amber-500"
              >
                Testar Endpoint
              </Button>
              <Button
                onClick={sendTestButtonWithCallback}
                disabled={isSendingButtonTest || !tokenConfigured}
                size="sm"
                className="bg-purple-600 hover:bg-purple-500"
              >
                Testar WhatsApp Real
              </Button>
            </div>
            <p className="text-[10px] text-slate-400">
              URL Atual: {instance?.webhook_received_url || "Nenhuma"}
            </p>
          </TabsContent>

          <TabsContent value="logs" className="pt-4 space-y-4">
            <div className="space-y-2">
              {integrationLogs.length > 0 ? (
                integrationLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold uppercase text-blue-400">{log.action}</span>
                      <span className="text-zinc-500 ml-2">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        log.status_code >= 200 && log.status_code < 300
                          ? "text-emerald-400 border-emerald-500/30"
                          : "text-rose-400 border-rose-500/30"
                      }
                    >
                      HTTP {log.status_code || "---"}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500 text-center py-6">
                  Nenhum log registrado ainda.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
