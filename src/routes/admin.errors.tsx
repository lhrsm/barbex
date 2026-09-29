import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  Activity, 
  Info 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/errors")({
  component: AdminErrors,
});

function AdminErrors() {
  const [searchFilter, setSearchFilter] = useState<string>("");

  const { data: auditLogs, isLoading: isLoadingAudit, refetch: refetchAudit } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select(`
          *,
          admin:profiles!audit_logs_admin_id_fkey(business_name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  const filteredLogs = auditLogs?.filter((log: any) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    const actionMatch = (log.action || "").toLowerCase().includes(term);
    const adminMatch = (log.admin?.business_name || "").toLowerCase().includes(term);
    const detailsMatch = JSON.stringify(log.details || {}).toLowerCase().includes(term);
    return actionMatch || adminMatch || detailsMatch;
  }) || [];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Central de Erros e Auditoria</h2>
          <p className="text-muted-foreground">Monitoramento de ocorrências, logs de auditoria e telemetria da plataforma.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchAudit(); }}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit" className="gap-2">
            <ShieldAlert className="h-4 w-4" /> Logs de Auditoria
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-2">
            <Activity className="h-4 w-4" /> Telemetria de Saúde
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Atividade Recente do Sistema</CardTitle>
                  <CardDescription>Eventos registrados na tabela canônica de auditoria da plataforma.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input 
                    placeholder="Filtrar logs..." 
                    className="pl-8 h-8 text-xs" 
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horário</TableHead>
                    <TableHead>Admin / Responsável</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingAudit ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10">Carregando logs...</TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
                        {searchFilter ? "Nenhum log encontrado para o filtro aplicado." : "Nenhum log registrado."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-xs font-bold">
                          {log.admin?.business_name || "Super Admin"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-tighter">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate font-mono">
                          {JSON.stringify(log.details)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card className="glass border-white/5 rounded-3xl p-8">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-400" />
                Consolidação da Telemetria de Plataforma
              </CardTitle>
              <CardDescription>
                Transição de arquitetura para o Barbex Platform Control Center (R2E.13).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                O monitoramento operacional centralizado dos subsistemas (Stripe, Webhooks, Edge Functions e Banco de Dados) está consolidado nos módulos dedicados <strong className="text-white">/admin/health</strong> e <strong className="text-white">/admin/webhooks</strong> no roadmap do Platform Control Center.
              </p>
              <p>
                A chamada legada à Edge Function inexistente (<code className="text-xs bg-muted px-1.5 py-0.5 rounded">automation-v2-health-check</code>) foi descontinuada para eliminar requisições HTTP 404 e falsos alertas na plataforma.
              </p>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                <Info className="h-5 w-5 text-blue-400 shrink-0" />
                <p className="text-xs text-blue-200/80">
                  Os eventos de segurança e alterações administrativas continuam auditados e rastreáveis na aba <strong>Logs de Auditoria</strong> acima.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
