import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Lock,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Terminal,
  XCircle,
  HelpCircle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/admin/webhooks")({
  component: AdminWebhooksObservability,
  head: () => ({
    title: "Webhooks & Eventos Stripe | Barbex Super Admin",
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

interface StripeProcessedEvent {
  id: string;
  event_id: string;
  event_type: string;
  environment: string;
  status: string;
  processed_at: string;
  created_at: string;
}

export default function AdminWebhooksObservability() {
  const [searchTerm, setSearchTerm] = useState("");
  const [envFilter, setEnvFilter] = useState<"all" | "live" | "test">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Query: stripe_processed_events
  const {
    data: events,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin_stripe_processed_events"],
    queryFn: async (): Promise<StripeProcessedEvent[]> => {
      // NOTE: Querying public.stripe_processed_events without exposing lease_token.
      // In R2E.12B migration 20260924115900, this table had permissions revoked
      // from authenticated/anon and granted strictly to service_role.
      const { data, error: qError } = await supabase
        .from("stripe_processed_events")
        .select("id, event_id, event_type, environment, status, processed_at, created_at")
        .order("created_at", { ascending: false });

      if (qError) {
        throw qError;
      }
      return (data as StripeProcessedEvent[]) || [];
    },
  });

  // Check if error is specifically permission denied (PostgREST 401 / 42501)
  const isPermissionDenied =
    isError &&
    error &&
    typeof error === "object" &&
    ("code" in error || "message" in error) &&
    (String((error as { code?: string }).code) === "42501" ||
      String((error as { message?: string }).message)
        .toLowerCase()
        .includes("permission denied") ||
      String((error as { message?: string }).message)
        .toLowerCase()
        .includes("denied"));

  // Derived Factual Metrics (Only when query succeeds)
  const totalEvents = events ? events.length : null;
  const completedEvents = events
    ? events.filter((e) => e.status === "completed" || e.status === "processed").length
    : null;
  const failedEvents = events ? events.filter((e) => e.status === "failed").length : null;
  const processingEvents = events ? events.filter((e) => e.status === "processing").length : null;
  const latestEvent = events && events.length > 0 ? events[0] : null;

  // Event Types list for filtering
  const distinctEventTypes = events
    ? Array.from(new Set(events.map((e) => e.event_type))).sort()
    : [];

  // Filtered Events
  const filteredEvents = (events || []).filter((e) => {
    if (envFilter !== "all" && e.environment !== envFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (typeFilter !== "all" && e.event_type !== typeFilter) return false;
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      const matchId = e.event_id.toLowerCase().includes(term);
      const matchType = e.event_type.toLowerCase().includes(term);
      if (!matchId && !matchType) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Webhooks & Eventos Stripe
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary">
              R2E.13E Read-Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Observabilidade operacional e forense do pipeline de webhooks Stripe, idempotência e
            integridade de eventos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Atualizar Eventos
          </Button>
        </div>
      </div>

      {/* Canonical Webhook Infrastructure Info Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Webhook Canônico Stripe (Referência operacional conhecida)
            </CardDescription>
            <CardTitle
              className="text-sm font-mono font-bold text-foreground truncate"
              title="we_1UKbgCPKG6q10UjrKHkh5YpU"
            >
              we_1UKbgCPKG6q10UjrKHkh5YpU
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Endpoint ativo cadastrado na conta Stripe Barbex
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Runtime Edge Function (Referência operacional conhecida)
            </CardDescription>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Server className="h-4 w-4 text-emerald-500" />
              stripe-webhook v7 (ACTIVE)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Imutabilidade canônica R2E.12B preservada
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Mecanismo de Idempotência
            </CardDescription>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Configurado (Fencing Lease)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Token de 5 min via claim/complete/fail atômicos
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Validação Live E2E (Referência operacional conhecida)
            </CardDescription>
            <CardTitle className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Adiada pelo Operador
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            LIVE_FINANCIAL_FLOW_VALIDATED = FALSE
          </CardContent>
        </Card>
      </div>

      {/* Observability State / Alert Banner */}
      {isPermissionDenied ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-600" />
                Autoridade de Dados: Acesso Restrito ao Service Role (STRIPE_EVENTS_QUERY_AUTHORITY
                = UNAVAILABLE)
              </CardTitle>
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-700 dark:text-amber-300"
              >
                QUERY_UNAVAILABLE
              </Badge>
            </div>
            <CardDescription className="text-xs text-amber-700/80 dark:text-amber-400 mt-1">
              Conformidade com a Regra de Veracidade Absoluta (R2E.13E Seções 3, 8 e 28)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              A tabela física{" "}
              <code className="text-foreground font-mono">public.stripe_processed_events</code>{" "}
              possui isolamento estrito de segurança implementado na migração canônica{" "}
              <code className="text-foreground">
                20260924115900_r2e12b_stripe_processed_events_base_repair.sql
              </code>
              , tendo suas permissões revogadas de{" "}
              <code className="text-foreground font-mono">PUBLIC</code>,{" "}
              <code className="text-foreground font-mono">anon</code> e{" "}
              <code className="text-foreground font-mono">authenticated</code>, sendo restrita
              exclusivamente a <code className="text-foreground font-mono">service_role</code>{" "}
              (utilizado pela Edge Function de ingestão de webhooks).
            </p>
            <div className="p-3 rounded bg-background/50 border border-border/40 font-mono text-[11px] text-foreground">
              PostgREST Error 42501: permission denied for table stripe_processed_events
            </div>
            <p>
              <strong>Distinção Forense Estrita:</strong> A ausência de leitura direta pelo cliente
              navegador não é convertida sinteticamente em <code>0 eventos</code> ou em badge de{" "}
              <code>"Healthy"</code>. Zero é uma medição; indisponibilidade de consulta é ausência
              de medição. Nenhuma mutação de banco de dados, política RLS ou RPC adicional é
              autorizada nesta fase R2E.13E.
            </p>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Falha na Consulta de Eventos (QUERY_UNAVAILABLE)
              </CardTitle>
              <Badge variant="destructive">ERRO</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>Não foi possível consultar os eventos Stripe processados:</p>
            <p className="font-mono mt-1 text-destructive">
              {error instanceof Error ? error.message : JSON.stringify(error)}
            </p>
          </CardContent>
        </Card>
      ) : events && events.length === 0 ? (
        <Card className="border-border/60 bg-muted/20">
          <CardContent className="py-6 flex items-center gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                Estado Factual: NO_EVENTS_RECORDED.
              </span>{" "}
              Nenhum evento Stripe registrado até o momento na tabela física. Conforme a Seção 20 da
              especificação R2E.13E, este estado não é rotulado como "Healthy" ou "Unhealthy", pois
              ausência de eventos reflete apenas a retenção da validação Live pelo operador.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Metrics Cards (Only rendered with factual measurements when query succeeds) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Events */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Total de Eventos Registrados
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {isLoading ? (
                <span className="text-muted-foreground text-lg">Carregando...</span>
              ) : isError ? (
                <span className="text-muted-foreground text-lg font-semibold">Indisponível</span>
              ) : (
                totalEvents
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Eventos ingeridos pela Edge Function
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Concluídos com Sucesso
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {isLoading ? (
                <span className="text-muted-foreground text-lg">...</span>
              ) : isError ? (
                <span className="text-muted-foreground text-lg font-semibold">Indisponível</span>
              ) : (
                completedEvents
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Status: <span className="font-mono">completed</span> ou{" "}
            <span className="font-mono">processed</span>
          </CardContent>
        </Card>

        {/* Failed */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" /> Falhas Registradas
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {isLoading ? (
                <span className="text-muted-foreground text-lg">...</span>
              ) : isError ? (
                <span className="text-muted-foreground text-lg font-semibold">Indisponível</span>
              ) : (
                failedEvents
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Status: <span className="font-mono">failed</span>
          </CardContent>
        </Card>

        {/* In-Flight / Processing */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-sky-600 dark:text-sky-400 flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" /> Em Processamento
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {isLoading ? (
                <span className="text-muted-foreground text-lg">...</span>
              ) : isError ? (
                <span className="text-muted-foreground text-lg font-semibold">Indisponível</span>
              ) : (
                processingEvents
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Status: <span className="font-mono">processing</span> (sob lease)
          </CardContent>
        </Card>
      </div>

      {/* Idempotency & Legacy Endpoints Architecture Reference */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            Arquitetura de Idempotência & Endpoints Legados
          </CardTitle>
          <CardDescription className="text-xs">
            Especificações canônicas R2E.12B / R2E.13E do pipeline de webhooks Stripe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-background/50 space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Pipeline de Idempotência com Fencing Token
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>
                  <strong>Tabela Física:</strong>{" "}
                  <code className="text-foreground">public.stripe_processed_events</code> com chave
                  única em <code className="text-foreground">event_id</code>.
                </li>
                <li>
                  <strong>RPC de Bloqueio (Claim):</strong>{" "}
                  <code className="text-foreground">
                    claim_stripe_event(event_id, event_type, env)
                  </code>{" "}
                  atribui um <code>lease_token</code> exclusivo (UUID) e bloqueia o evento por 5
                  minutos.
                </li>
                <li>
                  <strong>Proteção Contra Workers Zumbis:</strong> Conclusão e registro de falha (
                  <code className="text-foreground">complete_stripe_event</code> e{" "}
                  <code className="text-foreground">fail_stripe_event</code>) exigem correspondência
                  atômica do <code>lease_token</code> vigente.
                </li>
                <li>
                  <strong>Status Vocabulary:</strong> <code>processing</code>,{" "}
                  <code>completed</code>, <code>processed</code>, <code>failed</code>.
                </li>
                <li>
                  <strong>Diagnóstico de Segurança:</strong> O campo{" "}
                  <code className="text-foreground">lease_token</code> é estritamente ocultado na
                  interface operacional para prevenir vazamento de tokens de isolamento.
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-lg border bg-background/50 space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-500" />
                Endpoints Legados Lovable & Validação Live
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>
                  <strong>Endpoints Legados:</strong> 2 endpoints legados Lovable permanecem
                  registrados na conta Stripe e NÃO foram desativados nesta fase
                  (LEGACY_LOVABLE_WEBHOOK_CLEANUP = PENDING).
                </li>
                <li>
                  <strong>Validação em Produção:</strong> A validação de idempotência através de
                  eventos duplicados reais em ambiente Live ainda não foi realizada
                  (IDEMPOTENCY_LIVE_VALIDATED = FALSE).
                </li>
                <li>
                  <strong>Controle de Mutações:</strong> Esta interface operacional é estritamente
                  somente-leitura. Controles de reprocessamento manual, exclusão ou retry direto não
                  existem nesta camada (WEBHOOK_MUTATION_CONTROLS = 0).
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table (Rendered if query succeeds) */}
      {!isError && (
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Registro Forense de Eventos Stripe
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Registros em tempo real da tabela{" "}
                  <code className="text-foreground">public.stripe_processed_events</code>
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48 sm:w-60">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por Event ID ou tipo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                <select
                  value={envFilter}
                  onChange={(e) => setEnvFilter(e.target.value as "all" | "live" | "test")}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">Ambiente: Todos</option>
                  <option value="live">Somente Live</option>
                  <option value="test">Somente Test</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">Status: Todos</option>
                  <option value="completed">Completed</option>
                  <option value="processed">Processed</option>
                  <option value="failed">Failed</option>
                  <option value="processing">Processing</option>
                </select>

                {distinctEventTypes.length > 0 && (
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">Tipo de Evento: Todos</option>
                    {distinctEventTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Carregando eventos Stripe...
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="text-sm font-medium text-foreground">
                  {events && events.length === 0
                    ? "Nenhum evento Stripe registrado até o momento."
                    : "Nenhum evento corresponde aos filtros selecionados."}
                </div>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {events && events.length === 0
                    ? "Eventos de webhook serão registrados após o envio de requisições pelo Stripe via checkout ou ciclo de vida de assinaturas."
                    : "Ajuste os filtros de tipo de evento, status ou ambiente."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Event ID</TableHead>
                      <TableHead className="text-xs">Tipo de Evento</TableHead>
                      <TableHead className="text-xs">Ambiente</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Processado Em</TableHead>
                      <TableHead className="text-xs">Criado Em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((evt) => (
                      <TableRow key={evt.id}>
                        <TableCell className="font-mono text-xs font-medium text-foreground">
                          <span title={evt.event_id}>{evt.event_id}</span>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{evt.event_type}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              evt.environment === "live"
                                ? "text-emerald-600 border-emerald-500/30"
                                : "text-amber-600 border-amber-500/30",
                            )}
                          >
                            {evt.environment}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              evt.status === "completed" || evt.status === "processed"
                                ? "default"
                                : evt.status === "failed"
                                  ? "destructive"
                                  : evt.status === "processing"
                                    ? "outline"
                                    : "secondary"
                            }
                            className="text-[10px] font-mono uppercase"
                          >
                            {evt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {evt.processed_at
                            ? format(new Date(evt.processed_at), "dd/MM/yyyy HH:mm:ss", {
                                locale: ptBR,
                              })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {evt.created_at
                            ? format(new Date(evt.created_at), "dd/MM/yyyy HH:mm:ss", {
                                locale: ptBR,
                              })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
