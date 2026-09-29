import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import {
  ShieldAlert,
  Search,
  RefreshCw,
  AlertCircle,
  FileText,
  User,
  Clock,
  Globe,
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/audit")({
  component: AdminAuditPage,
  head: () => ({
    title: "Auditoria & Governança | Barbex Super Admin",
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

interface AuditLogRecord {
  id: string;
  admin_id: string;
  target_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  admin?: {
    business_name: string | null;
  } | null;
}

export default function AdminAuditPage() {
  const [searchFilter, setSearchFilter] = useState<string>("");

  const {
    data: auditLogs,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin_canonical_audit_logs"],
    queryFn: async (): Promise<AuditLogRecord[]> => {
      const { data, error: qError } = await supabase
        .from("audit_logs")
        .select(
          `
          id,
          admin_id,
          target_id,
          action,
          details,
          ip_address,
          created_at,
          admin:profiles!audit_logs_admin_id_fkey(business_name)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (qError) {
        throw qError;
      }
      return (data as unknown as AuditLogRecord[]) || [];
    },
  });

  const filteredLogs = (auditLogs || []).filter((log) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    const actionMatch = (log.action || "").toLowerCase().includes(term);
    const adminMatch = (log.admin?.business_name || "").toLowerCase().includes(term);
    const detailsMatch = JSON.stringify(log.details || {})
      .toLowerCase()
      .includes(term);
    const ipMatch = (log.ip_address || "").toLowerCase().includes(term);
    return actionMatch || adminMatch || detailsMatch || ipMatch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Auditoria & Governança
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary">
              R2E.13F Canonical
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Trilha de auditoria append-only de ações administrativas, mutações de governança e
            eventos de segurança da plataforma.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Atualizar Trilha
          </Button>
        </div>
      </div>

      {/* Metric / Information Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Fonte de Autoridade</CardDescription>
            <CardTitle className="text-sm font-mono font-bold text-foreground">
              public.audit_logs
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Registros append-only imutáveis com RLS de Super Admin
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Controles de Mutação</CardDescription>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-emerald-500" />0 (Somente Leitura)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Proibida qualquer edição, exclusão ou mutação manual de logs
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total Carregado</CardDescription>
            <CardTitle className="text-2xl font-bold">
              {isLoading ? (
                <span className="text-muted-foreground text-lg">Carregando...</span>
              ) : isError ? (
                <span className="text-destructive text-lg font-semibold">Indisponível</span>
              ) : (
                (auditLogs?.length ?? 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Últimos eventos registrados na plataforma
          </CardContent>
        </Card>
      </div>

      {/* Audit Logs Table Card */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Registros de Auditoria do Sistema
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Visualização detalhada dos eventos de governança e segurança executados por
                administradores.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar por ação, admin, detalhes..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Carregando registros de auditoria...
            </div>
          ) : isError ? (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Falha ao consultar tabela public.audit_logs
              </div>
              <p className="font-mono">
                {error instanceof Error ? error.message : "Erro desconhecido na consulta"}
              </p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="text-sm font-medium text-foreground">
                {auditLogs && auditLogs.length === 0
                  ? "Nenhum log de auditoria registrado no banco de dados."
                  : "Nenhum registro corresponde ao filtro informado."}
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {auditLogs && auditLogs.length === 0
                  ? "Ações administrativas de Super Admin (alterações de plano, configurações, bloqueios) serão registradas nesta trilha."
                  : "Tente buscar por termos mais genéricos."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data / Horário</TableHead>
                    <TableHead className="text-xs">Administrador</TableHead>
                    <TableHead className="text-xs">Ação</TableHead>
                    <TableHead className="text-xs">IP de Origem</TableHead>
                    <TableHead className="text-xs">Detalhes do Evento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {log.created_at
                          ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", {
                              locale: ptBR,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span>{log.admin?.business_name || "Super Admin"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono uppercase tracking-tight"
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {log.ip_address ? (
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span>{log.ip_address}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-md truncate">
                        <span title={JSON.stringify(log.details, null, 2)}>
                          {log.details ? JSON.stringify(log.details) : "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
