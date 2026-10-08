import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Receipt,
  FileText,
  History,
  ArrowDownRight,
  RotateCcw,
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

interface StripeInvoiceSummary {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  amount_remaining: number;
  created: string | null;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  subscription_id: string | null;
  payment_intent_id: string | null;
  charge_id: string | null;
  escapeHatchLinks: {
    stripeInvoiceUrl: string;
    stripePaymentUrl: string | null;
  };
}

interface StripeRefundSummary {
  id: string;
  stripe_refund_id: string | null;
  stripe_payment_intent_id: string;
  stripe_invoice_id: string | null;
  amount: number;
  currency: string;
  status: string;
  reason: string;
  created_at: string;
  actor_user_id: string;
  escapeHatchLinks: {
    stripeRefundUrl: string | null;
    stripePaymentUrl: string;
  };
}

interface RefundPreviewData {
  tenantId: string;
  barbershopName: string;
  invoiceId: string;
  paymentIntentId: string | null;
  chargeId: string | null;
  originalCapturedAmount: number;
  totalAlreadyRefunded: number;
  remainingRefundableAmount: number;
  requestedRefundAmount: number;
  remainingAfterRefund: number;
  currency: string;
  addonAttributableMax: number;
  subscriptionImpact: string;
  addonImpact: string;
  financialConsequence: string;
  escapeHatchLinks?: {
    stripeInvoiceUrl: string;
    stripePaymentUrl: string | null;
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
  const [activeTab, setActiveTab] = useState<"lifecycle" | "invoices" | "refunds">("lifecycle");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<OperationPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Lifecycle operation selection & inputs
  const [selectedOp, setSelectedOp] = useState<SelectedOperation>("none");
  const [selectedAddonContract, setSelectedAddonContract] = useState<AddonContractItem | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invoices & Refunds state
  const [invoices, setInvoices] = useState<StripeInvoiceSummary[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [refunds, setRefunds] = useState<StripeRefundSummary[]>([]);
  const [isLoadingRefunds, setIsLoadingRefunds] = useState(false);

  // Active Refund Action state
  const [refundTargetInvoice, setRefundTargetInvoice] = useState<StripeInvoiceSummary | null>(null);
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [partialAmountBrl, setPartialAmountBrl] = useState<string>("");
  const [refundPreview, setRefundPreview] = useState<RefundPreviewData | null>(null);
  const [isLoadingRefundPreview, setIsLoadingRefundPreview] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundTypedConfirmation, setRefundTypedConfirmation] = useState("");
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Load preview data (zero-mutation)
  const loadOperationPreview = useCallback(
    async (targetOp: string = "general-inspection") => {
      if (!tenantId) return;
      setIsLoadingPreview(true);
      setErrorMsg(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          throw new Error("Sessão expirada. Faça login novamente como Super Admin.");
        }

        const { data, error } = await supabase.functions.invoke("stripe-admin-operations", {
          body: {
            action: "preview",
            tenantId,
            targetOperation: targetOp,
          },
        });

        if (error) {
          throw new Error(error.message || "Falha ao carregar prévia da operação.");
        }

        if (!data?.ok) {
          throw new Error(data?.message || "Erro retornado pelo servidor.");
        }

        setPreview(data.preview);
      } catch (err: unknown) {
        console.error("[Admin Subscription Ops] Erro ao carregar preview:", err);
        const message =
          err instanceof Error ? err.message : "Erro ao consultar dados da assinatura.";
        setErrorMsg(message);
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [tenantId],
  );

  // Load invoices
  const loadInvoices = useCallback(async () => {
    if (!tenantId) return;
    setIsLoadingInvoices(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-admin-operations", {
        body: {
          action: "list-invoices",
          tenantId,
        },
      });

      if (error) throw new Error(error.message || "Falha ao carregar faturas.");
      if (data?.ok) {
        setInvoices(data.invoices || []);
      }
    } catch (err: unknown) {
      console.error("[Admin Subscription Ops] Erro ao listar faturas:", err);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, [tenantId]);

  // Load refunds history
  const loadRefunds = useCallback(async () => {
    if (!tenantId) return;
    setIsLoadingRefunds(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-admin-operations", {
        body: {
          action: "list-refunds",
          tenantId,
        },
      });

      if (error) throw new Error(error.message || "Falha ao carregar histórico de estornos.");
      if (data?.ok) {
        setRefunds(data.refunds || []);
      }
    } catch (err: unknown) {
      console.error("[Admin Subscription Ops] Erro ao listar estornos:", err);
    } finally {
      setIsLoadingRefunds(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (isOpen && tenantId) {
      setPreview(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setSelectedOp("none");
      setSelectedAddonContract(null);
      setReason("");
      setTypedConfirmation("");
      setRefundTargetInvoice(null);
      setRefundPreview(null);
      loadOperationPreview("general-inspection");
      loadInvoices();
      loadRefunds();
    }
  }, [isOpen, tenantId, loadOperationPreview, loadInvoices, loadRefunds]);

  // Handle operation selection
  const handleSelectOperation = (op: SelectedOperation, addonItem?: AddonContractItem) => {
    setSelectedOp(op);
    setSelectedAddonContract(addonItem || null);
    setReason("");
    setTypedConfirmation("");
    setErrorMsg(null);
    setSuccessMsg(null);
    loadOperationPreview(op);
  };

  const handleCancelSelection = () => {
    setSelectedOp("none");
    setSelectedAddonContract(null);
    setReason("");
    setTypedConfirmation("");
    setErrorMsg(null);
    loadOperationPreview("general-inspection");
  };

  // Validate mutation requirements
  const isFormValid = () => {
    if (reason.trim().length < 10) return false;
    if (selectedOp === "cancel-base-immediately" && typedConfirmation !== "CANCELAR") {
      return false;
    }
    return true;
  };

  // Execute privileged lifecycle operation
  const handleExecuteOperation = async () => {
    if (!isFormValid()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: Record<string, unknown> = {
        action: selectedOp,
        tenantId,
        reason: reason.trim(),
        typedConfirmation: typedConfirmation.trim(),
      };

      if (selectedOp === "cancel-addon" && selectedAddonContract) {
        payload.contractId = selectedAddonContract.id;
        payload.addonId = selectedAddonContract.addon_id;
      }

      const { data, error } = await supabase.functions.invoke("stripe-admin-operations", {
        body: payload,
      });

      if (error) {
        throw new Error(error.message || "Falha ao executar operação administrativa.");
      }

      if (!data?.ok) {
        throw new Error(data?.message || "A operação foi rejeitada pelo servidor.");
      }

      setSuccessMsg(data.message || "Operação executada com sucesso!");
      setSelectedOp("none");
      setSelectedAddonContract(null);
      setReason("");
      setTypedConfirmation("");

      // Reload state and signal parent
      loadOperationPreview("general-inspection");
      loadInvoices();
      onSuccess();
    } catch (err: unknown) {
      console.error("[Admin Subscription Ops] Erro ao submeter operação:", err);
      const message =
        err instanceof Error ? err.message : "Erro desconhecido ao processar no Stripe.";
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load preview for refund
  const handleInitiateRefund = async (inv: StripeInvoiceSummary) => {
    setRefundTargetInvoice(inv);
    setRefundType("full");
    setPartialAmountBrl("");
    setRefundReason("");
    setRefundTypedConfirmation("");
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoadingRefundPreview(true);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-admin-operations", {
        body: {
          action: "preview-refund",
          tenantId,
          invoiceId: inv.id,
          refundType: "full",
        },
      });

      if (error) throw new Error(error.message || "Falha ao carregar prévia do estorno.");
      if (!data?.ok) throw new Error(data?.message || "Erro ao consultar saldo estornável.");

      setRefundPreview(data.preview);
    } catch (err: unknown) {
      console.error("[Admin Refund] Erro ao carregar preview do estorno:", err);
      const message = err instanceof Error ? err.message : "Erro ao consultar saldo estornável.";
      setErrorMsg(message);
    } finally {
      setIsLoadingRefundPreview(false);
    }
  };

  // Recalculate refund preview for partial
  const handlePartialAmountChange = async (val: string) => {
    setPartialAmountBrl(val);
    if (!refundTargetInvoice) return;

    const parsedBrl = parseFloat(val.replace(",", "."));
    if (isNaN(parsedBrl) || parsedBrl <= 0) {
      return;
    }

    const centavos = Math.round(parsedBrl * 100);
    try {
      const { data } = await supabase.functions.invoke("stripe-admin-operations", {
        body: {
          action: "preview-refund",
          tenantId,
          invoiceId: refundTargetInvoice.id,
          refundType: "partial",
          amount: centavos,
        },
      });

      if (data?.ok && data.preview) {
        setRefundPreview(data.preview);
      }
    } catch {
      // Keep previous preview
    }
  };

  // Set partial amount to add-on attributable max
  const handleApplyAddonAmount = (centavos: number) => {
    setRefundType("partial");
    const brl = (centavos / 100).toFixed(2);
    setPartialAmountBrl(brl);
    handlePartialAmountChange(brl);
  };

  // Validate refund requirements
  const isRefundFormValid = () => {
    if (refundReason.trim().length < 10) return false;
    if (refundTypedConfirmation !== "ESTORNAR") return false;
    if (refundType === "partial") {
      const parsed = parseFloat(partialAmountBrl.replace(",", "."));
      if (isNaN(parsed) || parsed <= 0) return false;
    }
    return true;
  };

  // Execute refund
  const handleExecuteRefund = async () => {
    if (!isRefundFormValid() || !refundTargetInvoice) return;
    setIsSubmittingRefund(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const isPartial = refundType === "partial";
      const payload: Record<string, unknown> = {
        action: isPartial ? "refund-partial" : "refund-full",
        tenantId,
        invoiceId: refundTargetInvoice.id,
        reason: refundReason.trim(),
        typedConfirmation: refundTypedConfirmation.trim(),
      };

      if (isPartial) {
        const parsedBrl = parseFloat(partialAmountBrl.replace(",", "."));
        payload.amount = Math.round(parsedBrl * 100);
      }

      const { data, error } = await supabase.functions.invoke("stripe-admin-operations", {
        body: payload,
      });

      if (error) {
        throw new Error(error.message || "Falha ao processar estorno no Stripe.");
      }

      if (!data?.ok) {
        throw new Error(data?.message || "O estorno foi rejeitado pelo servidor.");
      }

      setSuccessMsg(data.message || "Estorno processado com sucesso!");
      setRefundTargetInvoice(null);
      setRefundPreview(null);
      setRefundReason("");
      setRefundTypedConfirmation("");

      // Reload invoices and refunds
      loadInvoices();
      loadRefunds();
      onSuccess();
    } catch (err: unknown) {
      console.error("[Admin Refund] Erro ao submeter estorno:", err);
      const message =
        err instanceof Error ? err.message : "Erro desconhecido ao processar estorno no Stripe.";
      setErrorMsg(message);
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-950 border border-white/10 text-white p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="border-b border-white/5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Operações Financeiras de Super Admin
                  <Badge
                    variant="outline"
                    className="border-purple-500/30 text-purple-300 bg-purple-500/5 text-[10px]"
                  >
                    Privilegiado
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400">
                  Estabelecimento: <strong className="text-white">{tenantName}</strong> (ID:{" "}
                  <span className="font-mono">{tenantId}</span>)
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                loadOperationPreview("general-inspection");
                loadInvoices();
                loadRefunds();
              }}
              disabled={isLoadingPreview || isLoadingInvoices || isLoadingRefunds}
              className="border-white/10 text-xs text-gray-300 hover:text-white"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${
                  isLoadingPreview || isLoadingInvoices || isLoadingRefunds ? "animate-spin" : ""
                }`}
              />
              Atualizar
            </Button>
          </div>

          {/* Navigation Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(val: string) =>
              setActiveTab(val as "lifecycle" | "invoices" | "refunds")
            }
            className="w-full pt-4"
          >
            <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
              <TabsTrigger
                value="lifecycle"
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs font-semibold rounded-lg px-4"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Ciclo de Vida (Base & Add-ons)
              </TabsTrigger>
              <TabsTrigger
                value="invoices"
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs font-semibold rounded-lg px-4"
              >
                <Receipt className="w-3.5 h-3.5 mr-1.5" />
                Faturas & Pagamentos ({invoices.length})
              </TabsTrigger>
              <TabsTrigger
                value="refunds"
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs font-semibold rounded-lg px-4"
              >
                <History className="w-3.5 h-3.5 mr-1.5" />
                Estornos Realizados ({refunds.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        {/* Global Alert Messages */}
        {errorMsg && (
          <div className="p-3 my-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 my-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: CICLO DE VIDA (Assinatura Base & Add-ons) */}
        {/* ========================================================================= */}
        {activeTab === "lifecycle" && (
          <div className="space-y-5 pt-2">
            {isLoadingPreview ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                <span>Consultando autoridade Stripe do estabelecimento...</span>
              </div>
            ) : !preview ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                Nenhum dado retornado para este estabelecimento.
              </div>
            ) : (
              <div className="space-y-5">
                {/* Cartão de Resumo da Assinatura Base */}
                <Card className="bg-white/5 border-white/10 rounded-xl overflow-hidden">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          Plano Base Atual
                        </span>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white capitalize">
                            Plano {preview.currentPlan}
                          </h4>
                          <Badge
                            variant="outline"
                            className={
                              preview.subscriptionStatus === "active"
                                ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                                : "border-amber-500/30 text-amber-300 bg-amber-500/10"
                            }
                          >
                            {preview.subscriptionStatus}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-gray-700 text-gray-400 text-[10px]"
                          >
                            {preview.stripeEnvironment === "live"
                              ? "PRODUÇÃO LIVE"
                              : "TESTE SANDBOX"}
                          </Badge>
                        </div>
                      </div>

                      {/* Links Rápidos do Stripe */}
                      <div className="flex items-center gap-2">
                        {preview.escapeHatchLinks?.stripeSubscriptionUrl && (
                          <a
                            href={preview.escapeHatchLinks.stripeSubscriptionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 underline font-medium"
                          >
                            Stripe Assinatura
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {preview.escapeHatchLinks?.stripeCustomerUrl && (
                          <a
                            href={preview.escapeHatchLinks.stripeCustomerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 underline font-medium"
                          >
                            Stripe Cliente
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-gray-400 text-[10px] uppercase font-bold">Ciclo</span>
                        <p className="text-white font-medium capitalize">
                          {preview.billingCycle === "year" ? "Anual" : "Mensal"}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-gray-400 text-[10px] uppercase font-bold">
                          Término do Período
                        </span>
                        <p className="text-white font-medium">
                          {preview.currentPeriodEnd
                            ? format(new Date(preview.currentPeriodEnd), "dd/MM/yyyy", {
                                locale: ptBR,
                              })
                            : "N/A"}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-gray-400 text-[10px] uppercase font-bold">
                          Renovação Automática
                        </span>
                        <p
                          className={
                            preview.cancelAtPeriodEnd
                              ? "text-rose-400 font-bold"
                              : "text-emerald-400 font-medium"
                          }
                        >
                          {preview.cancelAtPeriodEnd ? "Cancelamento Agendado" : "Ativa Contínua"}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-gray-400 text-[10px] uppercase font-bold">
                          Stripe Sub ID
                        </span>
                        <p className="font-mono text-gray-300 text-[11px] truncate">
                          {preview.stripeSubscriptionId || "Sem assinatura"}
                        </p>
                      </div>
                    </div>

                    {/* Botões de Ação para Assinatura Base */}
                    {preview.hasSubscription && preview.subscriptionStatus !== "canceled" && (
                      <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
                        {!preview.cancelAtPeriodEnd ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSelectOperation("cancel-base-period-end")}
                            className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs"
                          >
                            Cancelar ao Término do Ciclo
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSelectOperation("reactivate-base-subscription")}
                            className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs"
                          >
                            Reativar Renovação Automática
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectOperation("cancel-base-immediately")}
                          className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-bold"
                        >
                          Cancelar Imediatamente (Rescisão)
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tabela de Add-ons Contratados */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-purple-400" />
                      Módulos Adicionais (Add-ons Vinculados)
                    </h4>
                    <span className="text-[10px] text-gray-500">
                      {preview.attachedAddons.length} módulo(s) encontrado(s)
                    </span>
                  </div>

                  {preview.attachedAddons.length === 0 ? (
                    <div className="p-4 rounded-xl border border-white/5 bg-white/5 text-center text-xs text-gray-500">
                      Nenhum add-on contratado para este estabelecimento.
                    </div>
                  ) : (
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-white/5">
                          <TableRow className="border-white/5">
                            <TableHead className="text-gray-400 text-xs">Módulo</TableHead>
                            <TableHead className="text-gray-400 text-xs">Valor Unit.</TableHead>
                            <TableHead className="text-gray-400 text-xs">Status</TableHead>
                            <TableHead className="text-gray-400 text-xs">Stripe Item ID</TableHead>
                            <TableHead className="text-right text-gray-400 text-xs">
                              Ações
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.attachedAddons.map((add) => (
                            <TableRow key={add.id} className="border-white/5">
                              <TableCell className="font-medium text-white text-xs">
                                {add.saas_addons?.name || "Módulo Adicional"}
                              </TableCell>
                              <TableCell className="text-gray-300 text-xs">
                                R$ {Number(add.unit_price).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    add.status === "active"
                                      ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10 text-[10px]"
                                      : "border-gray-700 text-gray-400 text-[10px]"
                                  }
                                >
                                  {add.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-gray-400 text-[10px]">
                                {add.stripe_subscription_item_id || "N/A"}
                              </TableCell>
                              <TableCell className="text-right">
                                {add.status === "active" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleSelectOperation("cancel-addon", add)}
                                    className="h-7 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                                    Remover Add-on
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Formulário de Confirmação da Operação de Ciclo de Vida */}
                {selectedOp !== "none" && (
                  <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-4">
                    <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                      <h5 className="font-bold text-white text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-purple-400" />
                        Confirmação de Operação:{" "}
                        <span className="text-purple-300 font-mono text-xs">{selectedOp}</span>
                      </h5>
                    </div>

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
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: FATURAS & PAGAMENTOS (Stripe Invoices, Details & Refunds) */}
        {/* ========================================================================= */}
        {activeTab === "invoices" && (
          <div className="space-y-5 pt-2">
            {isLoadingInvoices ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                <span>Buscando faturas do estabelecimento no Stripe...</span>
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 bg-white/5 rounded-xl border border-white/5">
                Nenhuma fatura encontrada para este estabelecimento no Stripe.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-white/5">
                      <TableRow className="border-white/5">
                        <TableHead className="text-gray-400 text-xs">Fatura Nº</TableHead>
                        <TableHead className="text-gray-400 text-xs">Data</TableHead>
                        <TableHead className="text-gray-400 text-xs">Total / Pago</TableHead>
                        <TableHead className="text-gray-400 text-xs">Status</TableHead>
                        <TableHead className="text-right text-gray-400 text-xs">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id} className="border-white/5">
                          <TableCell className="font-mono text-xs text-white">
                            {inv.number}
                          </TableCell>
                          <TableCell className="text-xs text-gray-400">
                            {inv.paid_at
                              ? format(new Date(inv.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : inv.created
                                ? format(new Date(inv.created), "dd/MM/yyyy", { locale: ptBR })
                                : "N/A"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-bold text-white">
                              R$ {(inv.total / 100).toFixed(2)}
                            </span>
                            {inv.amount_paid > 0 && inv.amount_paid !== inv.total && (
                              <span className="text-[10px] text-gray-400 ml-1.5">
                                (pago: R$ {(inv.amount_paid / 100).toFixed(2)})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                inv.status === "paid"
                                  ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10 text-[10px]"
                                  : inv.status === "open"
                                    ? "border-amber-500/30 text-amber-300 bg-amber-500/10 text-[10px]"
                                    : "border-gray-700 text-gray-400 text-[10px]"
                              }
                            >
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {inv.invoice_pdf && (
                                <a
                                  href={inv.invoice_pdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-gray-400 hover:text-white"
                                  title="Baixar PDF da fatura"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <a
                                href={inv.escapeHatchLinks.stripeInvoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-purple-400 hover:text-purple-300"
                                title="Abrir no Stripe Dashboard"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              {inv.status === "paid" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleInitiateRefund(inv)}
                                  className="h-7 px-2 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 text-xs font-semibold"
                                >
                                  <ArrowDownRight className="w-3.5 h-3.5 mr-1" />
                                  Estornar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Painel de Estorno (se uma fatura for selecionada) */}
                {refundTargetInvoice && (
                  <div className="p-5 rounded-2xl border border-purple-500/30 bg-purple-500/5 space-y-4">
                    <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                      <div>
                        <h5 className="font-bold text-white text-sm flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-purple-400" />
                          Estorno Financeiro da Fatura:{" "}
                          <span className="font-mono text-purple-300">
                            {refundTargetInvoice.number}
                          </span>
                        </h5>
                        <p className="text-[11px] text-gray-400">
                          ID Stripe: <span className="font-mono">{refundTargetInvoice.id}</span>
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRefundTargetInvoice(null);
                          setRefundPreview(null);
                        }}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        Cancelar
                      </Button>
                    </div>

                    {isLoadingRefundPreview ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-gray-400 text-xs">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                        <span>Calculando saldo estornável autoritativo no Stripe...</span>
                      </div>
                    ) : refundPreview ? (
                      <div className="space-y-4 text-xs">
                        {/* Resumo do Saldo Autorizado */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                          <div>
                            <span className="text-[10px] text-gray-400 uppercase font-bold">
                              Valor Capturado
                            </span>
                            <p className="font-bold text-white text-sm">
                              R$ {(refundPreview.originalCapturedAmount / 100).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 uppercase font-bold">
                              Já Estornado
                            </span>
                            <p className="font-bold text-amber-400 text-sm">
                              R$ {(refundPreview.totalAlreadyRefunded / 100).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 uppercase font-bold">
                              Saldo Estornável
                            </span>
                            <p className="font-bold text-emerald-400 text-sm">
                              R$ {(refundPreview.remainingRefundableAmount / 100).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 uppercase font-bold">
                              Saldo Após Estorno
                            </span>
                            <p className="font-bold text-purple-300 text-sm">
                              R$ {(refundPreview.remainingAfterRefund / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Invariante Crítico */}
                        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            Invariante Crítico: REFUND != CANCELLATION
                          </div>
                          <p className="text-gray-300">
                            {refundPreview.subscriptionImpact} | {refundPreview.addonImpact}
                          </p>
                          <p className="text-[11px] text-amber-300">
                            O estorno financeiro NÃO rescinde a assinatura nem revoga o acesso
                            imediatamente. Para rescindir serviços, utilize a aba de Ciclo de Vida.
                          </p>
                        </div>

                        {/* Seleção do Tipo de Estorno */}
                        <div className="space-y-2">
                          <label className="font-bold text-gray-300">Tipo de Devolução:</label>
                          <div className="flex items-center gap-3">
                            <Button
                              type="button"
                              size="sm"
                              variant={refundType === "full" ? "default" : "outline"}
                              onClick={() => {
                                setRefundType("full");
                                setPartialAmountBrl("");
                                handleInitiateRefund(refundTargetInvoice);
                              }}
                              className={
                                refundType === "full"
                                  ? "bg-purple-600 hover:bg-purple-700 text-white font-bold"
                                  : "border-white/10 text-gray-300"
                              }
                            >
                              Estorno Total (R${" "}
                              {(refundPreview.remainingRefundableAmount / 100).toFixed(2)})
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant={refundType === "partial" ? "default" : "outline"}
                              onClick={() => setRefundType("partial")}
                              className={
                                refundType === "partial"
                                  ? "bg-purple-600 hover:bg-purple-700 text-white font-bold"
                                  : "border-white/10 text-gray-300"
                              }
                            >
                              Estorno Parcial
                            </Button>

                            {/* Auxílio de Add-on Attributable Max */}
                            {refundPreview.addonAttributableMax > 0 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleApplyAddonAmount(refundPreview.addonAttributableMax)
                                }
                                className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 text-xs"
                              >
                                Estornar Valor de Add-on (R${" "}
                                {(refundPreview.addonAttributableMax / 100).toFixed(2)})
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Campo de Valor Parcial */}
                        {refundType === "partial" && (
                          <div className="space-y-1.5 bg-black/30 p-3 rounded-xl border border-white/5">
                            <label className="font-bold text-gray-300 block">
                              Valor a Estornar (R$):
                            </label>
                            <Input
                              type="text"
                              placeholder="Ex: 29,90"
                              value={partialAmountBrl}
                              onChange={(e) => handlePartialAmountChange(e.target.value)}
                              className="bg-white/5 border-white/10 text-white font-mono text-xs rounded-xl"
                            />
                            <p className="text-[10px] text-gray-500">
                              Máximo permitido: R${" "}
                              {(refundPreview.remainingRefundableAmount / 100).toFixed(2)}
                            </p>
                          </div>
                        )}

                        {/* Justificativa Obrigatória */}
                        <div className="space-y-1.5">
                          <label className="font-bold text-gray-300 flex items-center justify-between">
                            <span>Justificativa Formal do Estorno (Obrigatória)</span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {refundReason.trim().length}/10 caracteres mín.
                            </span>
                          </label>
                          <Textarea
                            placeholder="Descreva formalmente a razão do estorno solicitado pelo cliente..."
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-xs h-20 rounded-xl"
                          />
                        </div>

                        {/* Confirmação Digitada */}
                        <div className="space-y-1.5 bg-rose-500/5 border border-rose-500/20 p-3 rounded-xl">
                          <label className="font-bold text-rose-300 block">
                            Confirmação de Segurança: Digite exatamente{" "}
                            <span className="underline">ESTORNAR</span>
                          </label>
                          <Input
                            placeholder="Digite ESTORNAR para autorizar"
                            value={refundTypedConfirmation}
                            onChange={(e) => setRefundTypedConfirmation(e.target.value)}
                            className="bg-white/5 border-rose-500/30 text-white font-mono text-xs rounded-xl"
                          />
                        </div>

                        {/* Botão de Envio do Estorno */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setRefundTargetInvoice(null);
                              setRefundPreview(null);
                            }}
                            className="border-white/10 text-gray-300 hover:text-white"
                            disabled={isSubmittingRefund}
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleExecuteRefund}
                            disabled={!isRefundFormValid() || isSubmittingRefund}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                          >
                            {isSubmittingRefund ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Processando no Stripe...
                              </>
                            ) : (
                              `Confirmar Estorno (${refundType === "full" ? "Total" : "Parcial"})`
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ESTORNOS REALIZADOS (Audit Ledger) */}
        {/* ========================================================================= */}
        {activeTab === "refunds" && (
          <div className="space-y-5 pt-2">
            {isLoadingRefunds ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                <span>Carregando histórico de estornos...</span>
              </div>
            ) : refunds.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 bg-white/5 rounded-xl border border-white/5">
                Nenhum estorno registrado para este estabelecimento.
              </div>
            ) : (
              <div className="border border-white/10 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5">
                      <TableHead className="text-gray-400 text-xs">Data & Hora</TableHead>
                      <TableHead className="text-gray-400 text-xs">Valor Estornado</TableHead>
                      <TableHead className="text-gray-400 text-xs">Status</TableHead>
                      <TableHead className="text-gray-400 text-xs">Motivo Registrado</TableHead>
                      <TableHead className="text-right text-gray-400 text-xs">Stripe ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refunds.map((ref) => (
                      <TableRow key={ref.id} className="border-white/5">
                        <TableCell className="text-xs text-gray-300">
                          {format(new Date(ref.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-emerald-400">
                          R$ {(ref.amount / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              ref.status === "succeeded"
                                ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10 text-[10px]"
                                : "border-amber-500/30 text-amber-300 bg-amber-500/10 text-[10px]"
                            }
                          >
                            {ref.status}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-xs text-gray-300 max-w-xs truncate"
                          title={ref.reason}
                        >
                          {ref.reason}
                        </TableCell>
                        <TableCell className="text-right">
                          {ref.stripe_refund_id ? (
                            <a
                              href={ref.escapeHatchLinks.stripeRefundUrl || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[11px] text-purple-400 hover:text-purple-300 underline inline-flex items-center gap-1"
                            >
                              {ref.stripe_refund_id}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="font-mono text-gray-500 text-[10px]">Pendente</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
