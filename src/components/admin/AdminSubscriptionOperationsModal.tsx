import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AddonContractItem {
  id: string;
  addon_id: string;
  status: string;
  quantity: number;
  unit_price: number;
  currency: string;
  stripe_subscription_item_id: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  saas_addons?: {
    name: string;
    addon_key: string;
    canonical_module_key: string | null;
  } | null;
}

interface OperationPreview {
  tenantId: string;
  barbershopName: string;
  slug: string;
  hasSubscription: boolean;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  currentPlan: string;
  billingCycle: string;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeEnvironment: string;
  attachedAddons: AddonContractItem[];
  financialConsequence: string;
  accessConsequence: string;
  escapeHatchLinks?: {
    stripeSubscriptionUrl: string | null;
    stripeCustomerUrl: string | null;
  };
}

interface AdminSubscriptionOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  onSuccess: () => void;
}

type SelectedOperation =
  | "none"
  | "cancel-base-period-end"
  | "reactivate-base-subscription"
  | "cancel-base-immediately"
  | "cancel-addon";

export function AdminSubscriptionOperationsModal({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  onSuccess,
}: AdminSubscriptionOperationsModalProps) {
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<OperationPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Operation selection & inputs
  const [selectedOp, setSelectedOp] = useState<SelectedOperation>("none");
  const [selectedAddonContract, setSelectedAddonContract] = useState<AddonContractItem | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load authoritative preview from server
  const loadPreview = async (targetOp = "general-inspection") => {
    if (!tenantId) return;
    setIsLoadingPreview(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-admin-operations", {
        body: {
          action: "preview",
          tenantId,
          targetOperation: targetOp,
        },
      });

      if (error || !data?.ok) {
        throw new Error(data?.message || error?.message || "Erro ao consultar servidor.");
      }

      setPreview(data.preview);
    } catch (err: unknown) {
      console.error("[AdminSubscriptionOperationsModal] Erro ao carregar preview:", err);
      setErrorMsg((err as Error)?.message || "Falha na comunicação com o servidor administrativo.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (isOpen && tenantId) {
      setSelectedOp("none");
      setSelectedAddonContract(null);
      setReason("");
      setTypedConfirmation("");
      setErrorMsg(null);
      setSuccessMsg(null);
      loadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tenantId]);

  const handleSelectOp = (op: SelectedOperation, addonContract?: AddonContractItem) => {
    setSelectedOp(op);
    setSelectedAddonContract(addonContract || null);
    setReason("");
    setTypedConfirmation("");
    setErrorMsg(null);
    setSuccessMsg(null);
    loadPreview(op);
  };

  const handleCancelSelection = () => {
    setSelectedOp("none");
    setSelectedAddonContract(null);
    setReason("");
    setTypedConfirmation("");
    setErrorMsg(null);
    loadPreview("general-inspection");
  };

  const handleExecuteOperation = async () => {
    if (selectedOp === "none") return;

    if (!reason || reason.trim().length < 10) {
      setErrorMsg("A justificativa deve ter no mínimo 10 caracteres.");
      return;
    }

    if (selectedOp === "cancel-base-immediately" && typedConfirmation !== "CANCELAR") {
      setErrorMsg("Digite 'CANCELAR' exatamente para confirmar a rescisão imediata.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: Record<string, unknown> = {
        action: selectedOp,
        tenantId,
        reason: reason.trim(),
      };

      if (selectedOp === "cancel-base-immediately") {
        payload.typedConfirmation = typedConfirmation.trim();
      }

      if (selectedOp === "cancel-addon" && selectedAddonContract) {
        payload.contractId = selectedAddonContract.id;
        payload.addonId = selectedAddonContract.addon_id;
      }

      const { data, error } = await supabase.functions.invoke("stripe-admin-operations", {
        body: payload,
      });

      if (error || !data?.ok) {
        throw new Error(data?.message || error?.message || "Falha na execução da operação.");
      }

      setSuccessMsg(data.message || "Operação realizada com sucesso.");
      setSelectedOp("none");
      setSelectedAddonContract(null);
      setReason("");
      setTypedConfirmation("");
      await loadPreview();
      onSuccess();
    } catch (err: unknown) {
      console.error("[AdminSubscriptionOperationsModal] Erro ao executar:", err);
      setErrorMsg((err as Error)?.message || "Ocorreu um erro ao processar a operação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = () => {
    if (!reason || reason.trim().length < 10) return false;
    if (selectedOp === "cancel-base-immediately" && typedConfirmation !== "CANCELAR") return false;
    return true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-white/10 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-white">
              Operações de Faturamento & Suporte
            </DialogTitle>
            {preview?.stripeEnvironment && (
              <Badge
                variant="outline"
                className={
                  preview.stripeEnvironment === "live"
                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]"
                    : "border-amber-500/30 text-amber-400 bg-amber-500/10 text-[10px]"
                }
              >
                {preview.stripeEnvironment === "live" ? "STRIPE LIVE" : "STRIPE SANDBOX"}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-gray-400 text-xs">
            Gestão autoritativa de ciclo de vida de assinaturas e add-ons para{" "}
            <strong className="text-white">{tenantName}</strong> (ID: {tenantId}).
          </DialogDescription>
        </DialogHeader>

        {isLoadingPreview && !preview ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            <span className="text-xs font-medium">
              Consultando estado autoritativo do Stripe...
            </span>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Mensagens de Sucesso ou Erro */}
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-300 text-xs font-medium">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Resumo da Assinatura Atual */}
            <Card className="border-white/10 bg-white/[0.02]">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Status da Assinatura Base
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        preview?.subscriptionStatus === "active"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs"
                          : preview?.subscriptionStatus === "canceled"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs"
                      }
                    >
                      {preview?.subscriptionStatus?.toUpperCase() || "SEM ASSINATURA"}
                    </Badge>
                    {preview?.cancelAtPeriodEnd && (
                      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                        CANCELAMENTO AGENDADO
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Plano</span>
                    <span className="font-bold text-white uppercase">
                      {preview?.currentPlan || "Free"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">
                      Ciclo de Cobrança
                    </span>
                    <span className="font-medium text-gray-300">
                      {preview?.billingCycle === "year" ? "Anual" : "Mensal"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Fim do Ciclo</span>
                    <span className="font-medium text-gray-300">
                      {preview?.currentPeriodEnd
                        ? format(new Date(preview.currentPeriodEnd), "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
                    </span>
                  </div>
                </div>

                {/* Links de Escape Hatch para o Stripe Dashboard */}
                {preview?.hasSubscription && (
                  <div className="pt-2 border-t border-white/5 flex flex-wrap gap-3">
                    {preview.escapeHatchLinks?.stripeSubscriptionUrl && (
                      <a
                        href={preview.escapeHatchLinks.stripeSubscriptionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 underline font-mono"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver Assinatura no Stripe Dashboard
                      </a>
                    )}
                    {preview.escapeHatchLinks?.stripeCustomerUrl && (
                      <a
                        href={preview.escapeHatchLinks.stripeCustomerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 underline font-mono"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver Cliente no Stripe
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Módulos Adicionais (Add-ons) Contratados */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-blue-400" />
                  Módulos Adicionais Vinculados
                </span>
                <span className="text-[11px] text-gray-500">
                  {preview?.attachedAddons?.length || 0} contratados
                </span>
              </div>

              {!preview?.attachedAddons || preview.attachedAddons.length === 0 ? (
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] text-center text-xs text-gray-500">
                  Nenhum módulo adicional vinculado à assinatura deste estabelecimento.
                </div>
              ) : (
                <div className="space-y-2">
                  {preview.attachedAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className="p-3 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-white block">
                          {addon.saas_addons?.name || "Módulo Adicional"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {addon.status === "active" ? "Ativo" : addon.status} · R${" "}
                          {addon.unit_price?.toFixed(2)}/mês
                        </span>
                      </div>
                      {addon.status === "active" && selectedOp === "none" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSelectOp("cancel-addon", addon)}
                          className="h-8 px-2.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Seleção de Operação ou Formulário de Execução */}
            {selectedOp === "none" ? (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300 block">
                  Ações Administrativas Disponíveis
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Cancelar no fim do ciclo */}
                  {preview?.hasSubscription &&
                    ["active", "trialing", "past_due"].includes(preview.subscriptionStatus) &&
                    !preview.cancelAtPeriodEnd && (
                      <Button
                        variant="outline"
                        onClick={() => handleSelectOp("cancel-base-period-end")}
                        className="h-auto py-3 px-4 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 justify-start flex-col items-start text-left"
                      >
                        <span className="font-bold text-xs">Cancelar Renovação</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          Desativa cobrança recorrente no término do ciclo atual
                        </span>
                      </Button>
                    )}

                  {/* Reativar renovação */}
                  {preview?.hasSubscription &&
                    ["active", "trialing", "past_due"].includes(preview.subscriptionStatus) &&
                    preview.cancelAtPeriodEnd && (
                      <Button
                        variant="outline"
                        onClick={() => handleSelectOp("reactivate-base-subscription")}
                        className="h-auto py-3 px-4 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 justify-start flex-col items-start text-left"
                      >
                        <span className="font-bold text-xs">Reativar Renovação</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          Mantém a assinatura e retoma a renovação automática
                        </span>
                      </Button>
                    )}

                  {/* Cancelar imediatamente */}
                  {preview?.hasSubscription &&
                    ["active", "trialing", "past_due"].includes(preview.subscriptionStatus) && (
                      <Button
                        variant="outline"
                        onClick={() => handleSelectOp("cancel-base-immediately")}
                        className="h-auto py-3 px-4 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 justify-start flex-col items-start text-left"
                      >
                        <span className="font-bold text-xs flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          Cancelar Imediatamente
                        </span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          Rescisão imediata no Stripe sem reembolso automático
                        </span>
                      </Button>
                    )}
                </div>

                {!preview?.hasSubscription && (
                  <p className="text-xs text-gray-500 italic">
                    Nenhuma assinatura Stripe ativa para este estabelecimento.
                  </p>
                )}
              </div>
            ) : (
              /* Formulário da Operação Selecionada com PREVIEW e JUSTIFICATIVA */
              <div className="space-y-4 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                      Confirmar Operação:{" "}
                      {selectedOp === "cancel-base-period-end"
                        ? "Cancelar Renovação ao Fim do Ciclo"
                        : selectedOp === "reactivate-base-subscription"
                          ? "Reativar Renovação Automática"
                          : selectedOp === "cancel-base-immediately"
                            ? "Cancelar Imediatamente (Sem Reembolso)"
                            : `Remover Módulo: ${selectedAddonContract?.saas_addons?.name || ""}`}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelSelection}
                    className="h-7 text-xs text-gray-400 hover:text-white"
                  >
                    Voltar
                  </Button>
                </div>

                {/* Caixa de Impacto e Consequências Autorizadas pelo Servidor */}
                <div
                  className={
                    selectedOp === "cancel-base-immediately"
                      ? "p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-2 text-xs"
                      : "p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2 text-xs"
                  }
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className={
                        selectedOp === "cancel-base-immediately"
                          ? "w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5"
                          : "w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
                      }
                    />
                    <div className="space-y-1">
                      <span className="font-bold text-white block">
                        Consequência Financeira & Acesso:
                      </span>
                      <p className="text-gray-300">{preview?.financialConsequence}</p>
                      <p className="text-gray-300">{preview?.accessConsequence}</p>
                      <p className="text-[11px] font-bold text-amber-300 pt-1">
                        * Invariante Barbex: Cancelamento não emite reembolso automático.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Justificativa Obrigatória */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                    <span>Justificativa Formal do Atendimento (Obrigatória)</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {reason.trim().length}/10 caracteres mín.
                    </span>
                  </label>
                  <Textarea
                    placeholder="Descreva o motivo desta intervenção administrativa (ex: solicitação do cliente via chamado #1234)..."
                    className="bg-white/5 border-white/10 text-white text-xs h-20 rounded-xl"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                {/* Confirmação Digitada para Ação de Alto Impacto */}
                {selectedOp === "cancel-base-immediately" && (
                  <div className="space-y-1.5 bg-rose-500/5 border border-rose-500/20 p-3 rounded-xl">
                    <label className="text-xs font-bold text-rose-300 block">
                      Confirmação de Segurança: Digite exatamente{" "}
                      <span className="underline">CANCELAR</span>
                    </label>
                    <Input
                      placeholder="Digite CANCELAR para autorizar"
                      className="bg-white/5 border-rose-500/30 text-white font-mono text-xs rounded-xl"
                      value={typedConfirmation}
                      onChange={(e) => setTypedConfirmation(e.target.value)}
                    />
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelSelection}
                    className="border-white/10 text-gray-300 hover:text-white"
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleExecuteOperation}
                    disabled={!isFormValid() || isSubmitting}
                    className={
                      selectedOp === "cancel-base-immediately"
                        ? "bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                        : "bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                    }
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Executando no Stripe...
                      </>
                    ) : (
                      "Confirmar Operação"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="border-t border-white/5 pt-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
