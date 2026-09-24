import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Loader2, PlayCircle, Info, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/rls-tests")({
  component: AdminRlsTests,
  head: () => ({
    meta: [
      { title: "Inspeção de RLS · Catálogo de Módulos — Barbex Admin" },
      { name: "description", content: "Auditoria estrutural no catálogo das políticas de RLS e guards de módulos premium." },
    ],
  }),
});

type Row = {
  table_name: string;
  operation: string;
  expected: string;
  actual: string;
  passed: boolean;
  status?: "CONFIGURADO" | "INCONCLUSIVO" | "CONFIGURACAO_AUSENTE" | "FALHA_ESTRUTURAL" | "ERRO_SCHEMA" | string;
  test_type?: string;
};

function AdminRlsTests() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    setRunning(true);
    setRows(null);
    const { data, error } = await supabase.rpc("test_rls_module_guards");
    setRunning(false);
    if (error) {
      toast.error("Falha ao executar inspeção no catálogo", { description: error.message });
      return;
    }
    const results = (data ?? []) as Row[];
    setRows(results);
    const configurados = results.filter((r) => r.status === "CONFIGURADO" || (!r.status && r.passed)).length;
    const total = results.length;
    if (configurados === total) {
      toast.success(`✅ ${configurados}/${total} tabelas estruturadas no catálogo`);
    } else {
      toast.info(`Inspeção concluída: ${configurados}/${total} configurados no catálogo; revise itens inconclusivos ou ausentes.`);
    }
  };

  const total = rows?.length ?? 0;
  const configurados = rows?.filter((r) => r.status === "CONFIGURADO" || (!r.status && r.passed)).length ?? 0;
  const inconclusivos = rows?.filter((r) => r.status === "INCONCLUSIVO").length ?? 0;
  const ausentes = rows?.filter((r) => r.status === "CONFIGURACAO_AUSENTE" || r.status === "FALHA_ESTRUTURAL").length ?? 0;
  const erros = rows?.filter((r) => r.status === "ERRO_SCHEMA").length ?? 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Auditoria Estrutural de Políticas RLS no Catálogo
              </CardTitle>
              <CardDescription>
                Inspeção passiva da arquitetura de segurança no PostgreSQL (pg_class e pg_policies).
              </CardDescription>
            </div>
            <Button onClick={runTests} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              {running ? "Inspecionando catálogo..." : "Inspecionar Catálogo"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/[0.05] text-sm text-blue-200/90 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-100">
                Escopo da Inspeção Passiva em Produção vs Isolamento Funcional:
              </p>
              <p className="text-xs text-blue-200/80 leading-relaxed">
                Esta rotina realiza <strong>exclusivamente análise estrutural passiva</strong> no catálogo do banco (sem inserções ou mutações),
                preservando dados reais, sequências numéricas e triggers.
                A presença de políticas no catálogo indica que as regras estão <em>configuradas</em>, mas <strong>NÃO comprova o isolamento funcional multi-tenant</strong> (leituras cruzadas e bloqueio de mutação entre clientes distintos).
                O isolamento funcional é <strong>não testado em produção</strong> por segurança e requer testes ativos em <strong>ambiente isolado de homologação (staging)</strong>.
              </p>
            </div>
          </div>

          {rows && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Configurados
                  </div>
                  <div className="text-2xl font-bold mt-1 text-white">{configurados}</div>
                  <div className="text-[11px] opacity-75 mt-0.5">RLS ativo + guard restritivo</div>
                </div>

                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] text-amber-200">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold">
                    <HelpCircle className="h-4 w-4 text-amber-400" /> Inconclusivos
                  </div>
                  <div className="text-2xl font-bold mt-1 text-white">{inconclusivos}</div>
                  <div className="text-[11px] opacity-75 mt-0.5">Requer staging funcional</div>
                </div>

                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-rose-200">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold">
                    <ShieldAlert className="h-4 w-4 text-rose-400" /> Ausente / Inseguro
                  </div>
                  <div className="text-2xl font-bold mt-1 text-white">{ausentes}</div>
                  <div className="text-[11px] opacity-75 mt-0.5">Sem políticas ou RLS inativo</div>
                </div>

                <div className="p-3 rounded-lg border border-white/10 bg-white/[0.03] text-white/80">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold">
                    <AlertTriangle className="h-4 w-4 text-white/60" /> Total Inspecionado
                  </div>
                  <div className="text-2xl font-bold mt-1 text-white">{total}</div>
                  <div className="text-[11px] opacity-75 mt-0.5">{erros > 0 ? `${erros} erro(s) de schema` : "Tabelas cobertas"}</div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>Critério de Catálogo</TableHead>
                    <TableHead>Diagnóstico Estrutural</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const status = r.status ?? (r.passed ? "CONFIGURADO" : "INCONCLUSIVO");
                    return (
                      <TableRow key={r.table_name}>
                        <TableCell className="font-mono text-xs font-semibold">{r.table_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.operation}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.expected}</TableCell>
                        <TableCell className="text-xs max-w-md truncate" title={r.actual}>
                          {r.actual}
                        </TableCell>
                        <TableCell className="text-right">
                          {status === "CONFIGURADO" ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              CONFIGURADO
                            </Badge>
                          ) : status === "INCONCLUSIVO" ? (
                            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              INCONCLUSIVO
                            </Badge>
                          ) : status === "ERRO_SCHEMA" ? (
                            <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              ERRO SCHEMA
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              AUSENTE
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
