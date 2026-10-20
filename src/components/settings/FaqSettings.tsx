import * as React from "react";
import { 
  HelpCircle, Plus, Trash2, ArrowUp, ArrowDown, Check, Eye, EyeOff, 
  Sparkles, Save, AlertCircle, Edit2, X, RefreshCw, CheckCircle2, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FaqRecord {
  id: string;
  tenant_id: string;
  question: string;
  answer: string;
  display_order: number;
  is_approved: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  tenantId: string | null;
  faqEnabled: boolean;
  onToggleFaqEnabled: (enabled: boolean) => void;
  shopName?: string;
}

// 8 Perguntas sugeridas conforme especificação da Fase 5
const SUGGESTED_TEMPLATES = [
  {
    question: "Preciso agendar horário antecipadamente?",
    answer: "Recomendamos o agendamento prévio pelo nosso portal para garantir o seu horário exclusivo com o barbeiro de sua preferência. Clientes sem agendamento são atendidos conforme a disponibilidade do momento."
  },
  {
    question: "Quais são as formas de pagamento aceitas?",
    answer: "Aceitamos PIX, cartões de crédito e débito das principais bandeiras e pagamento em dinheiro no balcão da barbearia."
  },
  {
    question: "Posso cancelar ou reagendar meu horário?",
    answer: "Sim! Você pode reagendar ou cancelar diretamente pelo portal online ou pelo link recebido na confirmação, com até 2 horas de antecedência do início do atendimento."
  },
  {
    question: "A barbearia atende crianças?",
    answer: "Sim, atendemos crianças de todas as idades com profissionais pacientes, ambiente confortável e cortes modernos e personalizados."
  },
  {
    question: "Qual é a tolerância para atrasos?",
    answer: "Trabalhamos com uma tolerância máxima de 10 minutos para garantir que todos os clientes do dia sejam atendidos pontualmente sem atrasar os próximos horários."
  },
  {
    question: "Onde fica localizada a barbearia?",
    answer: "Consulte o nosso endereço completo no rodapé da página. Você também pode abrir a rota no Google Maps clicando diretamente na localização."
  },
  {
    question: "Quais são os horários de funcionamento?",
    answer: "Nosso horário de funcionamento está disponível no portal. Para atendimentos em datas comemorativas ou feriados, consulte as datas livres diretamente na agenda online."
  },
  {
    question: "Posso escolher meu barbeiro?",
    answer: "Com certeza! Durante o agendamento, você tem a liberdade de escolher qualquer um dos nossos barbeiros disponíveis ou selecionar a opção 'Qualquer profissional livre'."
  }
];

export function FaqSettings({ tenantId, faqEnabled, onToggleFaqEnabled, shopName }: Props) {
  const [faqs, setFaqs] = React.useState<FaqRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState({ question: "", answer: "" });
  const [newForm, setNewForm] = React.useState({ question: "", answer: "" });
  const [isCreating, setIsCreating] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);

  // Carrega as perguntas do tenant
  const loadFaqs = React.useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("barbershop_faqs" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("Erro ao carregar FAQs:", error);
        toast.error("Erro ao carregar perguntas: " + error.message);
      } else {
        setFaqs((data as FaqRecord[]) || []);
      }
    } catch (e: any) {
      console.error("Exceção ao carregar FAQs:", e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  // Carrega templates sugeridos como pendentes (Fase 4 & 5)
  const handleLoadSuggested = async () => {
    if (!tenantId) return;
    try {
      setActionLoading(true);
      const startOrder = faqs.length;
      const rowsToInsert = SUGGESTED_TEMPLATES.map((tmpl, idx) => ({
        tenant_id: tenantId,
        question: tmpl.question,
        answer: tmpl.answer,
        display_order: startOrder + idx,
        is_approved: false, // Regra obrigatória: sugestões permanecem pendentes
        is_published: false, // Regra obrigatória: não publicar automaticamente
      }));

      const { error } = await supabase
        .from("barbershop_faqs" as any)
        .insert(rowsToInsert);

      if (error) {
        throw error;
      }

      toast.success("8 sugestões adicionadas com sucesso! Revise as respostas e aprove para publicar.");
      await loadFaqs();
    } catch (e: any) {
      toast.error("Falha ao adicionar sugestões: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Cria uma nova pergunta
  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    if (!newForm.question.trim() || !newForm.answer.trim()) {
      toast.error("Preencha a pergunta e a resposta.");
      return;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("barbershop_faqs" as any)
        .insert({
          tenant_id: tenantId,
          question: newForm.question.trim(),
          answer: newForm.answer.trim(),
          display_order: faqs.length,
          is_approved: true, // Perguntas criadas manualmente pelo dono nascem aprovadas
          is_published: true, // e publicadas
        });

      if (error) throw error;

      toast.success("Pergunta criada com sucesso!");
      setNewForm({ question: "", answer: "" });
      setIsCreating(false);
      await loadFaqs();
    } catch (e: any) {
      toast.error("Erro ao criar pergunta: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Salva edição de pergunta
  const handleSaveEdit = async (id: string) => {
    if (!editForm.question.trim() || !editForm.answer.trim()) {
      toast.error("A pergunta e a resposta não podem ficar vazias.");
      return;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("barbershop_faqs" as any)
        .update({
          question: editForm.question.trim(),
          answer: editForm.answer.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Pergunta atualizada!");
      setEditingId(null);
      await loadFaqs();
    } catch (e: any) {
      toast.error("Erro ao atualizar pergunta: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Apenas Aprova (mantém is_published inalterado - não publica automaticamente)
  const handleApprove = async (faq: FaqRecord) => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("barbershop_faqs" as any)
        .update({
          is_approved: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", faq.id);

      if (error) throw error;

      toast.success("Pergunta aprovada! Ela permanecerá oculta até ser publicada.");
      await loadFaqs();
    } catch (e: any) {
      toast.error("Erro ao aprovar pergunta: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Desaprova (retorna para pendente e despublica)
  const handleUnapprove = async (faq: FaqRecord) => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("barbershop_faqs" as any)
        .update({
          is_approved: false,
          is_published: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", faq.id);

      if (error) throw error;

      toast.success("Pergunta retornada para pendente e ocultada do site.");
      await loadFaqs();
    } catch (e: any) {
      toast.error("Erro ao desaprovar pergunta: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Ação explícita combinada: Aprovar e Publicar
  const handleApproveAndPublish = async (faq: FaqRecord) => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("barbershop_faqs" as any)
        .update({
          is_approved: true,
          is_published: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", faq.id);

      if (error) throw error;

      toast.success("Pergunta aprovada e publicada no site público com sucesso!");
      await loadFaqs();
    } catch (e: any) {
      toast.error("Erro ao aprovar e publicar: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Apenas Publica (somente permitido se já aprovada)
  const handlePublish = async (faq: FaqRecord) => {
    if (!faq.is_approved) {
      toast.error("A pergunta precisa ser aprovada antes de ser publicada.");
      return;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("barbershop_faqs" as any)
        .update({
          is_published: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", faq.id);

      if (error) throw error;

      toast.success("Pergunta publicada no site público!");
      await loadFaqs();
    } catch (e: any) {
      toast.error("Erro ao publicar pergunta: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Despublica (mantém aprovada, mas oculta no site público)
  const handleUnpublish = async (faq: FaqRecord) => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("barbershop_faqs" as any)
        .update({
          is_published: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", faq.id);

      if (error) throw error;

      toast.success("Pergunta despublicada e ocultada do site público.");
      await loadFaqs();
    } catch (e: any) {
      toast.error("Erro ao despublicar pergunta: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Publica em lote todas as perguntas já aprovadas que estejam ocultas (com confirmação explícita)
  const handlePublishAllApproved = async () => {
    if (!tenantId) return;
    const pendingApproved = faqs.filter((f) => f.is_approved && !f.is_published);
    if (pendingApproved.length === 0) {
      toast.info("Não há perguntas aprovadas pendentes de publicação.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Confirma a publicação de ${pendingApproved.length} pergunta(s) aprovada(s) no site público da barbearia?`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("barbershop_faqs" as any)
        .update({
          is_published: true,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("is_approved", true);

      if (error) throw error;

      toast.success(`${pendingApproved.length} pergunta(s) publicada(s) com sucesso no site público!`);
      await loadFaqs();
    } catch (e: any) {
      toast.error("Erro ao publicar perguntas em lote: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Exclusão
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta pergunta?")) return;

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("barbershop_faqs" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Pergunta removida.");
      await loadFaqs();
    } catch (e: any) {
      toast.error("Erro ao excluir pergunta: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Reordenação
  const handleMoveOrder = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= faqs.length) return;

    const currentFaq = faqs[index];
    const targetFaq = faqs[targetIndex];

    try {
      await Promise.all([
        supabase
          .from("barbershop_faqs" as any)
          .update({ display_order: targetFaq.display_order })
          .eq("id", currentFaq.id),
        supabase
          .from("barbershop_faqs" as any)
          .update({ display_order: currentFaq.display_order })
          .eq("id", targetFaq.id),
      ]);

      await loadFaqs();
    } catch (e: any) {
      toast.error("Erro ao reordenar: " + e.message);
    }
  };

  const publishedCount = faqs.filter(f => f.is_approved && f.is_published).length;
  const pendingCount = faqs.filter(f => !f.is_approved).length;

  return (
    <div className="space-y-6">
      {/* Card Principal de Controle */}
      <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
          <div className="space-y-1">
            <CardTitle className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
              <HelpCircle className="text-[#ea580c] h-5 w-5" />
              Perguntas Frequentes da Barbearia (FAQ)
            </CardTitle>
            <CardDescription className="text-slate-400">
              Gerencie as dúvidas dos seus clientes exibidas no seu link público exclusivo.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="border-gold/40 text-gold hover:bg-gold/10 font-bold"
            >
              {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showPreview ? "Ocultar Prévia" : "Prévia Pública"}
            </Button>
            <Button
              type="button"
              onClick={() => setIsCreating(true)}
              className="bg-[#ea580c] hover:bg-[#ea580c]/90 text-black font-black uppercase text-xs tracking-wider"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Pergunta
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Status Geral e Toggle da Seção */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-[#05070d]/60">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">Exibir Seção de FAQ na Página Pública</span>
                {faqEnabled ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">Ativa</Badge>
                ) : (
                  <Badge className="bg-slate-700/40 text-slate-400 border border-slate-600/30 text-[10px]">Oculta</Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Quando desativada, a seção de FAQ não aparecerá no site dos seus clientes, mesmo que haja perguntas cadastradas.
              </p>
            </div>
            <Switch
              checked={faqEnabled}
              onCheckedChange={onToggleFaqEnabled}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>

          {/* Métricas rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-white/5 bg-[#05070d] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Perguntas</p>
                <p className="text-2xl font-black text-white">{faqs.length}</p>
              </div>
              <HelpCircle className="w-6 h-6 text-slate-600" />
            </div>
            <div className="p-4 rounded-xl border border-white/5 bg-[#05070d] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Publicadas</p>
                <p className="text-2xl font-black text-emerald-400">{publishedCount}</p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-emerald-500/60" />
            </div>
            <div className="p-4 rounded-xl border border-white/5 bg-[#05070d] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Pendentes de Aprovação</p>
                <p className="text-2xl font-black text-amber-400">{pendingCount}</p>
              </div>
              <Clock className="w-6 h-6 text-amber-500/60" />
            </div>
          </div>

          {/* Alerta de perguntas aprovadas que ainda estão ocultas */}
          {faqs.some((f) => f.is_approved && !f.is_published) && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
                <div>
                  <p className="font-bold text-sm text-white">
                    {faqs.filter((f) => f.is_approved && !f.is_published).length} pergunta(s) aprovada(s) ainda não publicada(s) no site
                  </p>
                  <p className="text-xs text-amber-300/80">
                    Clique no botão ao lado para disponibilizá-la(s) imediatamente no portal público da sua barbearia.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handlePublishAllApproved}
                disabled={actionLoading}
                className="bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-wider shrink-0 px-4 h-9 shadow-md"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
                Publicar no Site
              </Button>
            </div>
          )}

          {/* Botão de Sugestões se não houver perguntas ou poucas */}
          {faqs.length === 0 && (
            <div className="p-6 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/5 via-transparent to-transparent text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/40 flex items-center justify-center mx-auto text-gold">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-black uppercase tracking-wider text-white text-base">Comece com Perguntas Sugeridas</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Adicione com 1 clique as 8 dúvidas mais frequentes dos clientes de barbearia (formas de pagamento, atrasos, crianças, agendamento etc.).
                  Você poderá editar as respostas e aprovar antes de publicar.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleLoadSuggested}
                disabled={actionLoading}
                className="bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-wider px-6"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Carregar 8 Perguntas Sugeridas
              </Button>
            </div>
          )}

          {/* Formulário de Criação Rápida */}
          {isCreating && (
            <form onSubmit={handleCreateNew} className="p-5 rounded-2xl border border-gold/40 bg-[#05070d] space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black uppercase tracking-wider text-gold flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nova Pergunta Frequente
                </h4>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pergunta</Label>
                  <Input
                    value={newForm.question}
                    onChange={(e) => setNewForm({ ...newForm, question: e.target.value })}
                    placeholder="Ex: Como funciona a tolerância de atraso?"
                    className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-gold mt-1"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Resposta</Label>
                  <Textarea
                    value={newForm.answer}
                    onChange={(e) => setNewForm({ ...newForm, answer: e.target.value })}
                    placeholder="Explique detalhadamente a resposta que o cliente verá..."
                    className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-gold mt-1 min-h-[90px]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreating(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={actionLoading} className="bg-gold text-black font-bold">
                  {actionLoading ? "Salvando..." : "Salvar Pergunta"}
                </Button>
              </div>
            </form>
          )}

          {/* Lista de Perguntas */}
          {loading ? (
            <div className="py-8 text-center text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-gold" />
              <span>Carregando perguntas frequentes...</span>
            </div>
          ) : faqs.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Perguntas Cadastradas ({faqs.length})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadSuggested}
                  disabled={actionLoading}
                  className="text-xs text-gold/80 hover:text-gold hover:bg-gold/5"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Restaurar / Importar Sugestões
                </Button>
              </div>

              {faqs.map((faq, index) => {
                const isEditing = editingId === faq.id;

                return (
                  <div
                    key={faq.id}
                    className={`p-4 rounded-xl border transition-all duration-200 ${
                      faq.is_published
                        ? "bg-[#05070d] border-white/10 hover:border-white/20"
                        : "bg-[#05070d]/40 border-white/5 opacity-80"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <Input
                          value={editForm.question}
                          onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                          className="bg-[#0b0f17] border-gold/50 text-white font-bold"
                        />
                        <Textarea
                          value={editForm.answer}
                          onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                          className="bg-[#0b0f17] border-gold/50 text-slate-200 min-h-[90px]"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSaveEdit(faq.id)}
                            disabled={actionLoading}
                            className="bg-gold text-black font-bold"
                          >
                            <Save className="w-3.5 h-3.5 mr-1.5" />
                            Salvar Alterações
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono text-slate-500 font-bold">#{index + 1}</span>
                            <h4 className="font-bold text-white text-base leading-snug">{faq.question}</h4>
                            {faq.is_approved ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                                Aprovada
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                                Pendente
                              </Badge>
                            )}
                            {faq.is_published ? (
                              <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px]">
                                No Ar
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-700/40 text-slate-400 border border-slate-600/30 text-[10px]">
                                Oculta
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line pt-1">
                            {faq.answer}
                          </p>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-1 shrink-0 pt-1 border-t sm:border-t-0 border-white/5 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveOrder(index, "up")}
                            disabled={index === 0}
                            title="Mover para cima"
                            className="h-8 w-8 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveOrder(index, "down")}
                            disabled={index === faqs.length - 1}
                            title="Mover para baixo"
                            className="h-8 w-8 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>

                          {/* Ações de Estado Independentes */}
                          {!faq.is_approved ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(faq)}
                                disabled={actionLoading}
                                title="Apenas aprova a pergunta sem publicá-la no site público"
                                className="h-8 text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                              >
                                Aprovar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleApproveAndPublish(faq)}
                                disabled={actionLoading}
                                title="Aprova e coloca no ar imediatamente no site público"
                                className="h-8 text-xs font-bold bg-gold text-black hover:bg-gold/90 shadow-sm"
                              >
                                Aprovar e publicar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnapprove(faq)}
                                disabled={actionLoading}
                                title="Voltar pergunta para status pendente e remover do site público"
                                className="h-8 text-xs font-bold border-slate-700 text-slate-400 hover:text-white"
                              >
                                Desaprovar
                              </Button>

                              {!faq.is_published ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handlePublish(faq)}
                                  disabled={actionLoading}
                                  title="Publicar esta pergunta aprovada no site público"
                                  className="h-8 text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 shadow-sm"
                                >
                                  Publicar
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnpublish(faq)}
                                  disabled={actionLoading}
                                  title="Ocultar pergunta do site público (mantendo aprovação)"
                                  className="h-8 text-xs font-bold border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                                >
                                  Despublicar
                                </Button>
                              )}
                            </>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingId(faq.id);
                              setEditForm({ question: faq.question, answer: faq.answer });
                            }}
                            title="Editar"
                            className="h-8 w-8 text-slate-400 hover:text-gold"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(faq.id)}
                            title="Excluir"
                            className="h-8 w-8 text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Prévia Pública */}
          {showPreview && (
            <div className="pt-6 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-gold" />
                <h4 className="text-xs font-black uppercase tracking-wider text-gold">
                  Prévia da Página Pública ({publishedCount} perguntas publicadas)
                </h4>
              </div>
              <div className="p-6 rounded-2xl bg-black border border-white/10 space-y-4">
                <div className="text-center space-y-2 mb-6">
                  <span className="text-gold font-black uppercase tracking-[0.25em] text-[10px]">Tire Suas Dúvidas</span>
                  <h3 className="text-2xl font-black uppercase italic text-white">Perguntas Frequentes</h3>
                  <p className="text-xs text-slate-400">Tudo o que você precisa saber sobre a {shopName || "nossa barbearia"}.</p>
                </div>
                {publishedCount === 0 ? (
                  <p className="text-center text-xs text-slate-500 italic py-4">
                    Nenhuma pergunta aprovada e publicada no momento. A seção permanecerá oculta no site público.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {faqs
                      .filter((f) => f.is_approved && f.is_published)
                      .map((f) => (
                        <details key={f.id} className="group p-4 rounded-xl border border-white/5 bg-[#0a0a0a]">
                          <summary className="font-bold text-white text-sm cursor-pointer list-none flex justify-between items-center">
                            <span>{f.question}</span>
                            <span className="text-gold transition-transform group-open:rotate-180">▼</span>
                          </summary>
                          <p className="text-xs text-slate-300 pt-3 border-t border-white/5 mt-3 leading-relaxed whitespace-pre-line">
                            {f.answer}
                          </p>
                        </details>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
