import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { 
  CheckCircle2, 
  Loader2, 
  CreditCard, 
  Banknote, 
  QrCode, 
  FileText, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  Receipt
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type PendingCommission = {
  id: string;
  appointment_id: string;
  customer_name: string | null;
  service_name: string | null;
  service_amount: number;
  commission_amount: number;
  status: string;
  appointment_date: string | null;
  created_at: string;
};

type PayCommissionDialogProps = {
  tenantId: string;
  barberId: string;
  barberName: string;
  startDate?: string | null;
  endDate?: string | null;
  pendingAmount?: number;
  pendingCount?: number;
  triggerClassName?: string;
  triggerLabel?: string;
  onPaid?: () => void;
};

const fmt = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PayCommissionDialog({
  tenantId,
  barberId,
  barberName,
  startDate,
  endDate,
  pendingAmount = 0,
  pendingCount = 0,
  triggerClassName,
  triggerLabel = "Pagar Comissão",
  onPaid,
}: PayCommissionDialogProps) {
  // R2E.26E.13D: Ocultar o botão quando não houver saldo pendente positivo elegível
  if (pendingAmount <= 0 || pendingCount <= 0) {
    return null;
  }

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [items, setItems] = useState<PendingCommission[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [step, setStep] = useState<"items" | "confirm">("items");

  // Payment form fields (Gate 2 & Gate 5)
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  const selectedTotal = selectedItems.reduce(
    (sum, item) => sum + Number(item.commission_amount || 0),
    0
  );

  const periodLabel = (() => {
    if (startDate && endDate) return `${startDate} até ${endDate}`;
    if (startDate) return `A partir de ${startDate}`;
    if (endDate) return `Até ${endDate}`;
    return "Todas as pendências";
  })();

  async function loadPending() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_barber_pending_commissions", {
        p_tenant_id: tenantId,
        p_barber_id: barberId,
        p_start_date: startDate || undefined,
        p_end_date: endDate || undefined,
      });
      if (error) throw error;
      const list = (Array.isArray(data) ? data : []) as PendingCommission[];
      setItems(list);
      setSelectedIds(list.map((item) => item.id));
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar comissões pendentes");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenChange(value: boolean) {
    setOpen(value);
    if (value) {
      setStep("items");
      setPaymentReference("");
      setReceiptUrl("");
      setNotes("");
      setPaymentMethod("pix");
      await loadPending();
    }
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? items.map((item) => item.id) : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((itemId) => itemId !== id)
    );
  }

  function handleGoToConfirm() {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos uma comissão para liquidar.");
      return;
    }
    const totalToPay = items
      .filter((i) => selectedIds.includes(i.id))
      .reduce((s, i) => s + Number(i.commission_amount || 0), 0);
    if (totalToPay <= 0) {
      toast.error("O valor total das comissões selecionadas deve ser maior que R$ 0,00.");
      return;
    }
    setStep("confirm");
  }

  async function executePayment() {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos uma comissão para pagar.");
      return;
    }
    if (selectedTotal <= 0) {
      toast.error("Não é permitido liquidar comissões com valor total zerado.");
      return;
    }
    setPaying(true);
    try {
      const idempotencyKey = `pay-${tenantId}-${barberId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      
      // Call canonical v2 RPC
      const { data, error } = await (supabase.rpc as any)("pay_barber_commissions_v2", {
        p_tenant_id: tenantId,
        p_barber_id: barberId,
        p_commission_ids: selectedIds,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference.trim() || undefined,
        p_receipt_url: receiptUrl.trim() || undefined,
        p_notes: notes.trim() || undefined,
        p_amount: selectedTotal,
        p_idempotency_key: idempotencyKey,
      });

      // Backward compatibility fallback to v1 if v2 is not yet deployed
      if (error && (error.message?.includes("function") || error.code === "42883")) {
        console.warn("[PayCommissionDialog] v2 not available, falling back to v1:", error.message);
        const { data: auth } = await supabase.auth.getUser();
        const { data: v1Data, error: v1Error } = await supabase.rpc("pay_barber_commissions", {
          p_tenant_id: tenantId,
          p_barber_id: barberId,
          p_commission_ids: selectedIds,
          p_paid_by: auth.user?.id || tenantId,
        });
        if (v1Error) throw v1Error;
        const res1 = v1Data as any;
        if (!res1?.success) throw new Error(res1?.error || "Falha ao pagar comissão");
        toast.success(`${res1.paid_count} comissão(ões) pagas: ${fmt(Number(res1.paid_total || selectedTotal))}`);
      } else if (error) {
        throw error;
      } else {
        const result = data as any;
        if (!result?.success) throw new Error(result?.error || result?.message || "Falha ao registrar quitação");
        toast.success(
          result.message || `${result.paid_count} comissão(ões) pagas com sucesso: ${fmt(Number(result.paid_total || selectedTotal))}`
        );
      }

      setOpen(false);
      onPaid?.();
    } catch (error: any) {
      console.error("[PayCommissionDialog] Erro na quitação:", error);
      toast.error(error.message || "Erro ao confirmar liquidação de comissão");
    } finally {
      setPaying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          disabled={pendingAmount <= 0 || pendingCount <= 0}
          className={cn(
            "h-10 gap-2 bg-emerald-500 text-black hover:bg-emerald-400 font-black rounded-xl disabled:opacity-50 transition-all",
            triggerClassName
          )}
        >
          <CheckCircle2 className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-[#0b0f17] border-amber-500/20 text-white max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
            <Receipt className="h-5 w-5 text-amber-400" />
            {step === "items" ? "Liquidação de Comissões do Barbeiro" : "Confirmação do Pagamento"}
          </DialogTitle>
        </DialogHeader>

        {step === "items" ? (
          <>
            {/* CARDS RESUMO DO BARBEIRO */}
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-amber-500/10 bg-[#05070d] p-3.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Profissional</p>
                <p className="font-black text-white mt-1 truncate">{barberName}</p>
              </div>
              <div className="rounded-xl border border-amber-500/10 bg-[#05070d] p-3.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Pendente</p>
                <p className="font-black text-amber-400 mt-1">{fmt(items.reduce((s, i) => s + Number(i.commission_amount || 0), 0) || pendingAmount)}</p>
              </div>
              <div className="rounded-xl border border-amber-500/10 bg-[#05070d] p-3.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Atendimentos</p>
                <p className="font-black text-white mt-1">{items.length || pendingCount}</p>
              </div>
              <div className="rounded-xl border border-amber-500/10 bg-[#05070d] p-3.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Período</p>
                <p className="font-black text-white mt-1 text-xs truncate">{periodLabel}</p>
              </div>
            </div>

            {/* TABELA DE ATENDIMENTOS SELECIONÁVEIS */}
            <div className="rounded-xl border border-amber-500/10 overflow-hidden flex-1 min-h-[220px] max-h-[320px] flex flex-col">
              <div className="flex items-center justify-between gap-3 bg-[#05070d] border-b border-amber-500/10 px-4 py-2.5">
                <label className="flex items-center gap-3 text-sm font-bold text-white cursor-pointer select-none">
                  <Checkbox
                    checked={items.length > 0 && selectedIds.length === items.length}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                  Selecionar todos ({selectedIds.length}/{items.length})
                </label>
                <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/20 text-xs px-2.5 py-1">
                  Selecionado: {fmt(selectedTotal)}
                </Badge>
              </div>

              <div className="overflow-auto flex-1">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-[#05070d] sticky top-0 z-10">
                    <tr className="border-b border-amber-500/10">
                      <th className="w-12 px-4 py-2.5" />
                      <th className="px-4 py-2.5 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Data</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Cliente</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Serviço</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-black text-amber-400 uppercase tracking-widest">Valor</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-black text-amber-400 uppercase tracking-widest">Comissão</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-500/5">
                    {loading ? (
                      <tr><td colSpan={7} className="py-10 text-center text-zinc-500"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando comissões...</td></tr>
                    ) : items.length === 0 ? (
                      <tr><td colSpan={7} className="py-10 text-center text-zinc-500 italic">Nenhuma comissão pendente para este barbeiro.</td></tr>
                    ) : items.map((item) => (
                      <tr key={item.id} className="hover:bg-amber-500/5 transition-colors">
                        <td className="px-4 py-2.5">
                          <Checkbox
                            checked={selectedIds.includes(item.id)}
                            onCheckedChange={(checked) => toggleOne(item.id, checked === true)}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-xs font-bold text-white">
                          {format(new Date(item.appointment_date || item.created_at), "dd/MM/yyyy")}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-zinc-300">{item.customer_name || "Cliente"}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-300">{item.service_name || "Serviço"}</td>
                        <td className="px-4 py-2.5 text-xs text-right text-white font-bold">{fmt(Number(item.service_amount || 0))}</td>
                        <td className="px-4 py-2.5 text-xs text-right text-amber-400 font-black">{fmt(Number(item.commission_amount || 0))}</td>
                        <td className="px-4 py-2.5"><Badge className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 text-[10px]">Pendente</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PARÂMETROS DO PAGAMENTO (MÉTODO, REF, NOTAS) */}
            <div className="grid gap-3 sm:grid-cols-3 bg-[#05070d] p-3.5 rounded-xl border border-amber-500/10">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5 text-amber-400" /> Método de Pagamento
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-[#0b0f17] border-zinc-700 text-white h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0f17] border-zinc-700 text-white">
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cash">Dinheiro em Espécie</SelectItem>
                    <SelectItem value="bank_transfer">Transferência Bancária</SelectItem>
                    <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    <SelectItem value="other">Outro Método</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-amber-400" /> Referência Bancária / Chave Pix
                </Label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ex: Chave Pix / ID Transação / NSU"
                  className="bg-[#0b0f17] border-zinc-700 text-white h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-amber-400" /> Comprovante (URL ou Doc)
                </Label>
                <Input
                  value={receiptUrl}
                  onChange={(e) => setReceiptUrl(e.target.value)}
                  placeholder="Ex: https://comprovante... ou Nº Doc"
                  className="bg-[#0b0f17] border-zinc-700 text-white h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700 bg-transparent text-white hover:bg-zinc-800">
                Cancelar
              </Button>
              <Button 
                onClick={handleGoToConfirm} 
                disabled={selectedIds.length === 0} 
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-black gap-2"
              >
                Prosseguir para Confirmação <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* STEP 2: CONFIRMAÇÃO OBRIGATÓRIA ANTES DA QUITAÇÃO */
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-300 space-y-1">
                <p className="font-bold text-white text-sm">Confirmação de Registro Contábil</p>
                <p>Esta operação liquidará as comissões selecionadas e registrará automaticamente uma <strong>saída financeira (despesa)</strong> na Central Financeira.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 bg-[#05070d] p-4 rounded-xl border border-zinc-800">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Profissional Beneficiário</p>
                <p className="font-black text-white text-base mt-0.5">{barberName}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Valor a Liquidar</p>
                <p className="font-black text-emerald-400 text-xl mt-0.5">{fmt(selectedTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Atendimentos Quitados</p>
                <p className="font-bold text-white text-sm mt-0.5">{selectedIds.length} comissões</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Método de Pagamento</p>
                <p className="font-bold text-white text-sm mt-0.5 uppercase">{paymentMethod}</p>
              </div>
              {paymentReference && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Referência Bancária</p>
                  <p className="text-xs text-zinc-300 mt-0.5 font-mono">{paymentReference}</p>
                </div>
              )}
              {receiptUrl && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Comprovante</p>
                  <p className="text-xs text-zinc-300 mt-0.5 font-mono truncate">{receiptUrl}</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-zinc-300">Observações adicionais (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Quitação semanal referente à 2ª quinzena de outubro..."
                className="bg-[#05070d] border-zinc-700 text-white text-xs resize-none h-18"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button variant="outline" onClick={() => setStep("items")} disabled={paying} className="border-zinc-700 bg-transparent text-white hover:bg-zinc-800">
                Voltar e Ajustar
              </Button>
              <Button 
                onClick={executePayment} 
                disabled={paying} 
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-black gap-2 shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processando Liquidação...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> Confirmar e Registrar Despesa
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}