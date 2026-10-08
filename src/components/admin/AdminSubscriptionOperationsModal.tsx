import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CommercialClassification } from "@/lib/commercial-classification";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  RotateCcw,
  LayoutDashboard,
  CreditCard,
  ShieldCheck,
  Clock,
  User,
  Info,
  Check,
  Copy,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface AddonContractItem {
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

export interface OperationPreview {
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

export interface StripeInvoiceSummary {
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

export interface StripeRefundSummary {
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

export interface RefundPreviewData {
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

export interface OperationalAuditItem {
  id: string;
  source: "audit_log" | "refund_operation";
  timestamp: string;
  action: string;
  actor: string;
  reason: string;
  amount?: number | null;
  currency?: string | null;
  details?: Record<string, unknown> | null;
}

export interface AdminSubscriptionOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  onSuccess: () => void;
  initialTab?: "overview" | "subscription" | "addons" | "invoices" | "refunds" | "audit";
  tenantClassification?: CommercialClassification | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  baseRecurringAmount?: number | null;
  addonsRecurringAmount?: number | null;
  totalRecurringAmount?: number | null;
  graceEndsAt?: string | null;
}

type SelectedOperation =
  | "none"
  | "cancel-base-period-end"
  | "reactivate-base-subscription"
  | "cancel-base-immediately"
  | "cancel-addon";

const formatCurrencyBrl = (val: number | null | undefined): string => {
  if (val == null || isNaN(val)) return "Dados indisponíveis";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
};

export function AdminSubscriptionOperationsModal({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  onSuccess,
  initialTab = "overview",
  tenantClassification,
  ownerName,
  ownerEmail,
  baseRecurringAmount,
  addonsRecurringAmount,
  totalRecurringAmount,
  graceEndsAt,
}: AdminSubscriptionOperationsModalProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "subscription" | "addons" | "invoices" | "refunds" | "audit"
  >(initialTab);
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

  // Invoices & Detail
  const [invoices, setInvoices] = useState<StripeInvoiceSummary[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [detailedInvoice, setDetailedInvoice] = useState<StripeInvoiceSummary | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Refunds state
  const [refunds, setRefunds] = useState<StripeRefundSummary[]>([]);
  const [isLoadingRefunds, setIsLoadingRefunds] = useState(false);
  const [refundTargetInvoice, setRefundTargetInvoice] = useState<StripeInvoiceSummary | null>(null);
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [partialAmountBrl, setPartialAmountBrl] = useState<string>("");
  const [refundPreview, setRefundPreview] = useState<RefundPreviewData | null>(null);
  const [isLoadingRefundPreview, setIsLoadingRefundPreview] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundTypedConfirmation, setRefundTypedConfirmation] = useState("");
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Audit timeline state
  const [auditItems, setAuditItems] = useState<OperationalAuditItem[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Sync initial tab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const copyToClipboard = (text: string, idKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
        console.error("[Admin Commercial Ops] Erro ao carregar preview:", err);
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
      console.error("[Admin Commercial Ops] Erro ao listar faturas:", err);
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
      console.error("[Admin Commercial Ops] Erro ao listar estornos:", err);
    } finally {
      setIsLoadingRefunds(false);
    }
  }, [tenantId]);

  // Load audit timeline
  const loadAuditTimeline = useCallback(async () => {
    if (!tenantId) return;
    setIsLoadingAudit(true);
    try {
      const [auditRes, refundOpsRes] = await Promise.all([
        supabase
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
            admin:profiles!audit_logs_admin_id_fkey(business_name, display_name, responsible_name, email)
          `,
          )
          .eq("target_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("stripe_refund_operations")
          .select(
            `
            id,
            stripe_refund_id,
            stripe_payment_intent_id,
            stripe_invoice_id,
            amount,
            currency,
            status,
            reason,
            created_at,
            actor_user_id
          `,
          )
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const items: OperationalAuditItem[] = [];

      if (auditRes.data) {
        auditRes.data.forEach((log: Record<string, unknown>) => {
          const adminObj = log.admin as Record<string, unknown> | null;
          const actorName =
            (adminObj?.display_name as string) ||
            (adminObj?.responsible_name as string) ||
            (adminObj?.business_name as string) ||
            (adminObj?.email as string) ||
            (log.admin_id as string);
          const detailsObj = (log.details as Record<string, unknown>) || {};
          const reasonVal = detailsObj.reason || "Operação sem motivo detalhado";
          items.push({
            id: log.id as string,
            source: "audit_log",
            timestamp: log.created_at as string,
            action: log.action as string,
            actor: actorName,
            reason: typeof reasonVal === "string" ? reasonVal : JSON.stringify(reasonVal),
            amount: (detailsObj.amount as number) || null,
            currency: (detailsObj.currency as string) || null,
            details: detailsObj,
          });
        });
      }

      if (refundOpsRes.data) {
        refundOpsRes.data.forEach((r: Record<string, unknown>) => {
          items.push({
            id: `refund-${r.id}`,
            source: "refund_operation",
            timestamp: r.created_at as string,
            action: `refund-${r.status}`,
            actor: (r.actor_user_id as string) || "Super Admin",
            reason: (r.reason as string) || "Estorno operacional",
            amount: (r.amount as number) ? (r.amount as number) / 100 : null,
            currency: (r.currency as string) || "brl",
            details: {
              stripeRefundId: r.stripe_refund_id,
              paymentIntentId: r.stripe_payment_intent_id,
              invoiceId: r.stripe_invoice_id,
            },
          });
        });
      }

      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditItems(items);
    } catch (err: unknown) {
      console.error("[Admin Commercial Ops] Erro ao carregar auditoria:", err);
    } finally {
      setIsLoadingAudit(false);
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
      setDetailedInvoice(null);
      loadOperationPreview("general-inspection");
      loadInvoices();
      loadRefunds();
      loadAuditTimeline();
    }
  }, [isOpen, tenantId, loadOperationPreview, loadInvoices, loadRefunds, loadAuditTimeline]);

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
      loadAuditTimeline();
      onSuccess();
    } catch (err: unknown) {
      console.error("[Admin Commercial Ops] Erro ao submeter operação:", err);
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
    setActiveTab("refunds");

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

  // Execute privileged refund
  const handleExecuteRefund = async () => {
    if (!refundTargetInvoice) return;
    if (refundReason.trim().length < 10) {
      setErrorMsg("O motivo do estorno deve conter ao menos 10 caracteres.");
      return;
    }
    if (refundTypedConfirmation !== "ESTORNAR") {
      setErrorMsg("Digite exatamente ESTORNAR para confirmar a devolução de valores.");
      return;
    }

    setIsSubmittingRefund(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const actionName = refundType === "full" ? "refund-full" : "refund-partial";
      const payload: Record<string, unknown> = {
        action: actionName,
        tenantId,
        invoiceId: refundTargetInvoice.id,
        reason: refundReason.trim(),
        typedConfirmation: refundTypedConfirmation.trim(),
        idempotencyKey: `client_refund_${tenantId}_${refundTargetInvoice.id}_${Date.now()}`,
      };

      if (refundType === "partial") {
        const parsedBrl = parseFloat(partialAmountBrl.replace(",", "."));
        if (isNaN(parsedBrl) || parsedBrl <= 0) {
          throw new Error("Informe um valor de estorno parcial válido maior que zero.");
        }
        payload.amount = Math.round(parsedBrl * 100);
      }

      const { data, error } = await supabase.functions.invoke("stripe-admin-operations", {
        body: payload,
      });

      if (error) throw new Error(error.message || "Falha ao processar estorno no Stripe.");
      if (!data?.ok) throw new Error(data?.message || "O estorno foi rejeitado pelo servidor.");

      setSuccessMsg(
        `Estorno de ${formatCurrencyBrl(data.refund.amount / 100)} executado com sucesso no Stripe!`,
      );
      setRefundTargetInvoice(null);
      setRefundPreview(null);
      setRefundReason("");
      setRefundTypedConfirmation("");
      setPartialAmountBrl("");

      // Reload invoices, refunds and audit
      loadInvoices();
      loadRefunds();
      loadAuditTimeline();
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

  const modality =
    tenantClassification?.modality || (preview?.hasSubscription ? "ASSINATURA" : "TRIAL");
  const isStripeActive = preview?.hasSubscription && preview?.stripeSubscriptionId;
  const isStripeLive = preview?.stripeEnvironment === "live";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-zinc-950 border border-white/10 text-white p-6 sm:p-8 rounded-3xl shadow-2xl">
        <DialogHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <DialogTitle className="text-2xl font-black italic tracking-tight text-white">
                  CENTRO COMERCIAL & SUPORTE PRIVILEGIADO
                </DialogTitle>
                <Badge
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    modality === "ASSINATURA" &&
                      "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
                    modality === "VOUCHER" &&
                      "bg-purple-500/20 text-purple-300 border border-purple-500/40",
                    modality === "TRIAL" &&
                      "bg-blue-500/20 text-blue-300 border border-blue-500/30",
                    modality === "FREE" && "bg-zinc-500/20 text-zinc-300 border border-zinc-500/30",
                  )}
                >
                  {modality}
                </Badge>
                {preview?.stripeEnvironment && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold uppercase",
                      isStripeLive
                        ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                        : "border-amber-500/30 text-amber-300 bg-amber-500/10",
                    )}
                  >
                    {isStripeLive ? "STRIPE LIVE" : "STRIPE SANDBOX"}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-sm text-gray-400 mt-1">
                Estabelecimento: <strong className="text-white">{tenantName}</strong>{" "}
                <span className="text-xs font-mono text-gray-500">({tenantId})</span>
              </DialogDescription>
              {(ownerName || ownerEmail) && (
                <div className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  <span>
                    Responsável:{" "}
                    <strong className="text-gray-300">{ownerName || "Não informado"}</strong>
                  </span>
                  {ownerEmail && <span className="text-gray-500">· {ownerEmail}</span>}
                </div>
              )}
            </div>

            {/* Ações Técnicas e Escape Hatches */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadOperationPreview("general-inspection");
                  loadInvoices();
                  loadRefunds();
                  loadAuditTimeline();
                }}
                disabled={isLoadingPreview || isLoadingInvoices || isLoadingRefunds}
                className="h-8 border-white/10 hover:bg-white/5 text-gray-300 text-xs gap-1.5"
                title="Recarregar dados do servidor"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoadingPreview && "animate-spin")} />
                Atualizar
              </Button>

              {preview?.escapeHatchLinks?.stripeCustomerUrl && (
                <a
                  href={preview.escapeHatchLinks.stripeCustomerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-white/10 bg-white/5 text-xs text-blue-400 hover:text-blue-300 hover:bg-white/10 transition-colors font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  Stripe Customer
                </a>
              )}

              {preview?.escapeHatchLinks?.stripeSubscriptionUrl && (
                <a
                  href={preview.escapeHatchLinks.stripeSubscriptionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-white/10 bg-white/5 text-xs text-purple-400 hover:text-purple-300 hover:bg-white/10 transition-colors font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  Stripe Sub
                </a>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Notificações de Sucesso ou Erro */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3 text-rose-300 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <div className="flex-1">{errorMsg}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setErrorMsg(null)}
              className="text-xs text-rose-400 hover:bg-rose-500/20 h-7"
            >
              Fechar
            </Button>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3 text-emerald-300 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <div className="flex-1">{successMsg}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccessMsg(null)}
              className="text-xs text-emerald-400 hover:bg-emerald-500/20 h-7"
            >
              Fechar
            </Button>
          </div>
        )}

        {/* 6 ABAS ESTRUTURADAS CONFORME ESPECIFICAÇÃO */}
        <Tabs
          value={activeTab}
          onValueChange={(val) =>
            setActiveTab(
              val as "overview" | "subscription" | "addons" | "invoices" | "refunds" | "audit",
            )
          }
          className="space-y-6 pt-2"
        >
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-2xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 h-auto">
            <TabsTrigger
              value="overview"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white py-2.5 gap-1.5"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger
              value="subscription"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white py-2.5 gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Assinatura
            </TabsTrigger>
            <TabsTrigger
              value="addons"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white py-2.5 gap-1.5"
            >
              <Package className="w-3.5 h-3.5" />
              Add-ons
            </TabsTrigger>
            <TabsTrigger
              value="invoices"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white py-2.5 gap-1.5"
            >
              <Receipt className="w-3.5 h-3.5" />
              Faturas ({invoices.length})
            </TabsTrigger>
            <TabsTrigger
              value="refunds"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white py-2.5 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Estornos ({refunds.length})
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white py-2.5 gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              Auditoria
            </TabsTrigger>
          </TabsList>

          {/* ========================================================================= */}
          {/* TAB 1: VISÃO GERAL (OVERVIEW) */}
          {/* ========================================================================= */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Modalidade & Vigência */}
              <Card className="glass border-white/5 bg-white/[0.02] rounded-2xl">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                    Modalidade de Acesso
                  </CardDescription>
                  <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                    {modality}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-gray-400">
                  {modality === "TRIAL" && (
                    <>
                      <p>
                        Status:{" "}
                        <strong className="text-blue-300">
                          {tenantClassification?.trialStatus || "EM VIGÊNCIA"}
                        </strong>
                      </p>
                      {tenantClassification?.trialEnd && (
                        <p className="font-mono text-[11px]">
                          Até {format(new Date(tenantClassification.trialEnd), "dd/MM/yyyy")}
                        </p>
                      )}
                    </>
                  )}
                  {modality === "VOUCHER" && (
                    <p className="text-purple-300 font-medium">Concessão permanente sem cobrança</p>
                  )}
                  {modality === "FREE" && (
                    <p className="text-zinc-300 font-medium">Plano gratuito permanente</p>
                  )}
                  {modality === "ASSINATURA" && (
                    <p className="text-emerald-300 font-medium">
                      Status: {preview?.subscriptionStatus?.toUpperCase() || "ATIVA"}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Card 2: Plano Base */}
              <Card className="glass border-white/5 bg-white/[0.02] rounded-2xl">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                    Plano Base
                  </CardDescription>
                  <CardTitle className="text-xl font-black text-purple-400">
                    {preview?.currentPlan?.toUpperCase() ||
                      tenantClassification?.technicalPlanName ||
                      "Não informado"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-gray-400">
                  <p>
                    Ciclo:{" "}
                    <strong className="text-gray-300">
                      {preview?.billingCycle === "year" ? "Anual" : "Mensal"}
                    </strong>
                  </p>
                  <p>
                    Valor Base:{" "}
                    <strong className="text-white">{formatCurrencyBrl(baseRecurringAmount)}</strong>
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Add-ons Ativos */}
              <Card className="glass border-white/5 bg-white/[0.02] rounded-2xl">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                    Add-ons Ativos
                  </CardDescription>
                  <CardTitle className="text-xl font-black text-blue-400">
                    {preview?.attachedAddons?.length || 0} módulos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-gray-400">
                  <p>
                    Valor Add-ons:{" "}
                    <strong className="text-white">
                      {formatCurrencyBrl(addonsRecurringAmount ?? 0)}
                    </strong>
                  </p>
                  <p className="text-[11px]">Cobrança vinculada ao Stripe</p>
                </CardContent>
              </Card>

              {/* Card 4: Total Recorrente */}
              <Card className="glass border-white/5 bg-white/[0.02] rounded-2xl">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                    Total Recorrente
                  </CardDescription>
                  <CardTitle className="text-xl font-black text-emerald-400">
                    {formatCurrencyBrl(totalRecurringAmount)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-gray-400">
                  <p>Próxima Renovação:</p>
                  <p className="text-white font-mono text-[11px]">
                    {preview?.currentPeriodEnd
                      ? format(new Date(preview.currentPeriodEnd), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })
                      : "Sem data definida"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Situação de Carência / Cancelamento Agendado */}
            {preview?.cancelAtPeriodEnd && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 text-amber-300 text-sm">
                <Clock className="w-5 h-5 flex-shrink-0 text-amber-400" />
                <div>
                  <strong className="block font-bold">CANCELAMENTO AGENDADO</strong>
                  Esta assinatura está configurada para não renovar ao término do período vigente (
                  {preview.currentPeriodEnd
                    ? format(new Date(preview.currentPeriodEnd), "dd/MM/yyyy")
                    : "data limite"}
                  ). O acesso permanece liberado até lá.
                </div>
              </div>
            )}

            {graceEndsAt && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3 text-rose-300 text-sm">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-400" />
                <div>
                  <strong className="block font-bold">PERÍODO DE TOLERÂNCIA (GRACE PERIOD)</strong>
                  Pagamento pendente. Carência expira em{" "}
                  {format(new Date(graceEndsAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}.
                </div>
              </div>
            )}

            {/* Atalhos Operacionais */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setActiveTab("subscription")}
                className="h-12 rounded-xl border-white/10 hover:bg-white/5 text-xs font-bold gap-2 justify-start px-4 text-purple-300"
              >
                <CreditCard className="w-4 h-4 text-purple-400" />
                Gerenciar Assinatura Base
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveTab("addons")}
                className="h-12 rounded-xl border-white/10 hover:bg-white/5 text-xs font-bold gap-2 justify-start px-4 text-blue-300"
              >
                <Package className="w-4 h-4 text-blue-400" />
                Gerenciar Add-ons Contratados
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveTab("invoices")}
                className="h-12 rounded-xl border-white/10 hover:bg-white/5 text-xs font-bold gap-2 justify-start px-4 text-emerald-300"
              >
                <Receipt className="w-4 h-4 text-emerald-400" />
                Ver Faturas & Realizar Estornos
              </Button>
            </div>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: ASSINATURA (SUBSCRIPTION LIFECYCLE) */}
          {/* ========================================================================= */}
          <TabsContent value="subscription" className="space-y-6">
            {!isStripeActive ? (
              <Card className="glass border-white/10 bg-white/[0.02] p-8 text-center rounded-2xl">
                <Info className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <h4 className="text-lg font-bold text-white">Sem Assinatura Stripe Recorrente</h4>
                <p className="text-sm text-gray-400 max-w-md mx-auto mt-1">
                  Este estabelecimento está sob a modalidade{" "}
                  <strong className="text-purple-400">{modality}</strong>. Operações de ciclo de
                  vida Stripe (cancelamento/reativação) aplicam-se exclusivamente a assinaturas
                  recorrentes ativas.
                </p>
              </Card>
            ) : (
              <>
                {/* Painel do Ciclo de Vida da Assinatura */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="glass border-white/5 bg-white/[0.02] rounded-2xl p-4">
                    <span className="text-xs text-gray-400 font-bold block mb-1 uppercase">
                      Status da Renovação
                    </span>
                    <div className="flex items-center gap-2">
                      {preview?.cancelAtPeriodEnd ? (
                        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs">
                          Cancelamento Agendado
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs">
                          Renovação Automática Ativa
                        </Badge>
                      )}
                    </div>
                  </Card>

                  <Card className="glass border-white/5 bg-white/[0.02] rounded-2xl p-4">
                    <span className="text-xs text-gray-400 font-bold block mb-1 uppercase">
                      Término do Ciclo Vigente
                    </span>
                    <span className="text-sm font-mono text-white font-bold">
                      {preview?.currentPeriodEnd
                        ? format(new Date(preview.currentPeriodEnd), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })
                        : "Não informado"}
                    </span>
                  </Card>

                  <Card className="glass border-white/5 bg-white/[0.02] rounded-2xl p-4">
                    <span className="text-xs text-gray-400 font-bold block mb-1 uppercase">
                      Alteração de Plano
                    </span>
                    <span className="text-xs text-gray-400 block">DEFERRED_SAFE (R2E.17C)</span>
                    <span className="text-[10px] text-amber-400/90 block mt-0.5">
                      Indisponível nesta etapa
                    </span>
                  </Card>
                </div>

                {/* Botões de Ação de Ciclo de Vida Contextuais */}
                {selectedOp === "none" && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {!preview?.cancelAtPeriodEnd ? (
                      <Button
                        variant="outline"
                        onClick={() => handleSelectOperation("cancel-base-period-end")}
                        className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs font-bold gap-2"
                      >
                        <Clock className="w-4 h-4 text-amber-400" />
                        Cancelar Renovação (No fim do período)
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => handleSelectOperation("reactivate-base-subscription")}
                        className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs font-bold gap-2"
                      >
                        <RotateCcw className="w-4 h-4 text-emerald-400" />
                        Desfazer Cancelamento (Reativar Renovação)
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => handleSelectOperation("cancel-base-immediately")}
                      className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-bold gap-2 ml-auto"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      Cancelar Imediatamente (Sem estorno)
                    </Button>
                  </div>
                )}

                {/* Painel de Execução da Operação de Ciclo de Vida */}
                {selectedOp !== "none" && (
                  <Card className="border border-purple-500/30 bg-purple-950/20 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                      <div>
                        <h4 className="text-base font-bold text-white flex items-center gap-2">
                          <ShieldAlert className="w-5 h-5 text-purple-400" />
                          Confirmação de Operação de Ciclo de Vida
                        </h4>
                        <p className="text-xs text-purple-300/80">
                          Operação selecionada: <strong className="text-white">{selectedOp}</strong>
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelSelection}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Cancelar Seleção
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-gray-400 font-bold block mb-1 uppercase">
                          Impacto Financeiro
                        </span>
                        <p className="text-gray-200">{preview?.financialConsequence}</p>
                      </div>
                      <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-gray-400 font-bold block mb-1 uppercase">
                          Impacto no Acesso da Barbearia
                        </span>
                        <p className="text-gray-200">{preview?.accessConsequence}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-gray-300 font-bold block">
                        Motivo Operacional do Suporte <span className="text-rose-400">*</span>
                      </label>
                      <Textarea
                        placeholder="Descreva o motivo desta alteração administrativa (mínimo de 10 caracteres)..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="bg-black/40 border-white/10 text-white rounded-xl text-xs min-h-[70px]"
                      />
                      <span className="text-[10px] text-gray-500 block">
                        {reason.trim().length} / 10 caracteres mínimos
                      </span>
                    </div>

                    {selectedOp === "cancel-base-immediately" && (
                      <div className="space-y-2 bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl">
                        <label className="text-xs text-rose-300 font-bold block">
                          Confirmação de Segurança: Digite CANCELAR para confirmar encerramento
                          imediato
                        </label>
                        <Input
                          placeholder="CANCELAR"
                          value={typedConfirmation}
                          onChange={(e) => setTypedConfirmation(e.target.value)}
                          className="bg-black/40 border-rose-500/40 text-white rounded-xl text-xs h-10 uppercase tracking-widest font-mono"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelSelection}
                        disabled={isSubmitting}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Desistir
                      </Button>
                      <Button
                        onClick={handleExecuteOperation}
                        disabled={!isFormValid() || isSubmitting}
                        className={cn(
                          "text-xs font-bold rounded-xl h-10 px-5 gap-2",
                          selectedOp === "cancel-base-immediately"
                            ? "bg-rose-600 hover:bg-rose-700 text-white"
                            : "bg-purple-600 hover:bg-purple-700 text-white",
                        )}
                      >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Executar no Stripe
                      </Button>
                    </div>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 3: ADD-ONS (TENANT-PURCHASED ADD-ONS) */}
          {/* ========================================================================= */}
          <TabsContent value="addons" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  Módulos Adicionais Contratados pelo Estabelecimento
                </h4>
                <p className="text-xs text-gray-400">
                  Gerenciamento isolado de itens de assinatura. A remoção de um add-on NÃO cancela a
                  assinatura base.
                </p>
              </div>
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                {preview?.attachedAddons?.length || 0} contratados
              </Badge>
            </div>

            {!preview?.attachedAddons || preview.attachedAddons.length === 0 ? (
              <Card className="glass border-white/5 bg-white/[0.02] p-8 text-center rounded-2xl">
                <Package className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">
                  Nenhum add-on contratado por este estabelecimento.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Módulos adicionais adquiridos pelo cliente aparecerão listados aqui.
                </p>
              </Card>
            ) : (
              <Card className="glass border-white/5 rounded-2xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5">
                      <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider py-3 pl-6">
                        Módulo / Add-on
                      </TableHead>
                      <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                        Valor Recorrente
                      </TableHead>
                      <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                        Status
                      </TableHead>
                      <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                        Stripe Item ID
                      </TableHead>
                      <TableHead className="text-right text-gray-400 text-[10px] font-bold uppercase tracking-wider pr-6">
                        Ação
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.attachedAddons.map((addon) => (
                      <TableRow key={addon.id} className="border-white/5">
                        <TableCell className="pl-6 py-4">
                          <div>
                            <span className="font-bold text-white text-sm block">
                              {addon.saas_addons?.name || addon.addon_id}
                            </span>
                            <span className="text-[11px] text-gray-500 font-mono">
                              {addon.saas_addons?.addon_key || "addon"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-gray-200">
                          {formatCurrencyBrl(addon.unit_price)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "text-[10px] font-bold uppercase",
                              addon.status === "active"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
                            )}
                          >
                            {addon.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-400">
                          {addon.stripe_subscription_item_id || "—"}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSelectOperation("cancel-addon", addon)}
                            className="h-8 border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Remover Add-on
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* Confirmação de Remoção de Add-on */}
            {selectedOp === "cancel-addon" && selectedAddonContract && (
              <Card className="border border-rose-500/30 bg-rose-950/20 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-400" />
                      Remover Add-on:{" "}
                      {selectedAddonContract.saas_addons?.name || selectedAddonContract.addon_id}
                    </h4>
                    <p className="text-xs text-rose-300/80">
                      A assinatura base NÃO será afetada. O módulo será desativado no Stripe.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelSelection}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Cancelar
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-300 font-bold block">
                    Motivo da Remoção <span className="text-rose-400">*</span>
                  </label>
                  <Textarea
                    placeholder="Descreva o motivo da remoção do add-on (mínimo de 10 caracteres)..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="bg-black/40 border-white/10 text-white rounded-xl text-xs min-h-[70px]"
                  />
                  <span className="text-[10px] text-gray-500 block">
                    {reason.trim().length} / 10 caracteres mínimos
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelSelection}
                    disabled={isSubmitting}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Desistir
                  </Button>
                  <Button
                    onClick={handleExecuteOperation}
                    disabled={reason.trim().length < 10 || isSubmitting}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl h-10 px-5 gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirmar Remoção do Add-on
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 4: FATURAS E PAGAMENTOS (INVOICES & PAYMENTS) */}
          {/* ========================================================================= */}
          <TabsContent value="invoices" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  Faturas e Pagamentos do Stripe
                </h4>
                <p className="text-xs text-gray-400">
                  Visibilidade canônica das cobranças emitidas, pagamentos capturados e saldos
                  estornáveis.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadInvoices}
                disabled={isLoadingInvoices}
                className="h-8 border-white/10 text-xs text-gray-300 gap-1.5"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoadingInvoices && "animate-spin")} />
                Recarregar Faturas
              </Button>
            </div>

            {isLoadingInvoices ? (
              <div className="py-12 text-center text-gray-500 animate-pulse text-xs">
                Consultando faturas Stripe autoritativas...
              </div>
            ) : invoices.length === 0 ? (
              <Card className="glass border-white/5 bg-white/[0.02] p-8 text-center rounded-2xl">
                <Receipt className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">
                  Nenhuma fatura encontrada no Stripe.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Faturas de assinaturas ou contratações de módulos aparecerão aqui automaticamente.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="glass border-white/5 rounded-2xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-white/5">
                      <TableRow className="border-white/5">
                        <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider py-3 pl-6">
                          Fatura / ID
                        </TableHead>
                        <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                          Data
                        </TableHead>
                        <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                          Status
                        </TableHead>
                        <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                          Total
                        </TableHead>
                        <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                          Pago
                        </TableHead>
                        <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                          Saldo Estornável
                        </TableHead>
                        <TableHead className="text-right text-gray-400 text-[10px] font-bold uppercase tracking-wider pr-6">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id} className="border-white/5">
                          <TableCell className="pl-6 py-4">
                            <div>
                              <span className="font-bold text-white text-sm block">
                                {inv.number || inv.id}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">{inv.id}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-300 font-mono">
                            {inv.created
                              ? format(new Date(inv.created), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-[10px] font-bold uppercase",
                                inv.status === "paid" &&
                                  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                                inv.status === "open" &&
                                  "bg-blue-500/20 text-blue-300 border-blue-500/30",
                                inv.status === "uncollectible" &&
                                  "bg-rose-500/20 text-rose-300 border-rose-500/30",
                                inv.status === "void" &&
                                  "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
                              )}
                            >
                              {inv.status === "paid" ? "PAGA" : inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-white">
                            {formatCurrencyBrl(inv.total / 100)}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-emerald-400">
                            {formatCurrencyBrl(inv.amount_paid / 100)}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-blue-400">
                            {formatCurrencyBrl(
                              (inv.amount_paid - (inv.amount_remaining || 0)) / 100,
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDetailedInvoice(inv)}
                                className="h-7 px-2 text-xs text-gray-300 hover:text-white"
                              >
                                Detalhes
                              </Button>
                              {inv.hosted_invoice_url && (
                                <a
                                  href={inv.hosted_invoice_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center h-7 px-2 text-xs text-blue-400 hover:text-blue-300"
                                  title="Abrir fatura hospedada Stripe"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {inv.escapeHatchLinks?.stripeInvoiceUrl && (
                                <a
                                  href={inv.escapeHatchLinks.stripeInvoiceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center h-7 px-2 text-xs text-purple-400 hover:text-purple-300"
                                  title="Abrir no Stripe Dashboard"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {inv.status === "paid" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleInitiateRefund(inv)}
                                  className="h-7 px-2.5 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 text-xs font-bold"
                                >
                                  Estornar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                {/* Painel de Detalhes da Fatura Selecionada */}
                {detailedInvoice && (
                  <Card className="glass border-white/10 bg-white/[0.03] p-6 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <h5 className="font-bold text-white text-sm">
                          Detalhes Técnicos da Fatura:{" "}
                          {detailedInvoice.number || detailedInvoice.id}
                        </h5>
                        <span className="text-[11px] font-mono text-gray-500">
                          {detailedInvoice.id}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailedInvoice(null)}
                        className="text-xs text-gray-400"
                      >
                        Fechar
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-gray-400 block mb-1">Subtotal</span>
                        <strong className="text-white">
                          {formatCurrencyBrl(detailedInvoice.subtotal / 100)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-1">Total Faturado</span>
                        <strong className="text-white">
                          {formatCurrencyBrl(detailedInvoice.total / 100)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-1">Valor Capturado</span>
                        <strong className="text-emerald-400">
                          {formatCurrencyBrl(detailedInvoice.amount_paid / 100)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-1">Valor Devido</span>
                        <strong className="text-amber-400">
                          {formatCurrencyBrl(detailedInvoice.amount_due / 100)}
                        </strong>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-white/5 text-xs font-mono text-gray-400">
                      {detailedInvoice.payment_intent_id && (
                        <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl">
                          <span>PaymentIntent: {detailedInvoice.payment_intent_id}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(detailedInvoice.payment_intent_id!, "pi")
                            }
                            className="h-6 px-2 text-[10px]"
                          >
                            {copiedId === "pi" ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      )}
                      {detailedInvoice.charge_id && (
                        <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl">
                          <span>Charge: {detailedInvoice.charge_id}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(detailedInvoice.charge_id!, "ch")}
                            className="h-6 px-2 text-[10px]"
                          >
                            {copiedId === "ch" ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 5: ESTORNOS (REFUNDS) */}
          {/* ========================================================================= */}
          <TabsContent value="refunds" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-purple-400" />
                  Operações de Estorno e Devoluções
                </h4>
                <p className="text-xs text-gray-400">
                  Estornos totais e parciais executados contra valores capturados. Invariante:{" "}
                  <strong className="text-purple-300">REFUND != CANCELLATION</strong>.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadRefunds}
                disabled={isLoadingRefunds}
                className="h-8 border-white/10 text-xs text-gray-300 gap-1.5"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoadingRefunds && "animate-spin")} />
                Recarregar Estornos
              </Button>
            </div>

            {/* Painel de Ação de Estorno Ativo (quando uma fatura é selecionada) */}
            {refundTargetInvoice && (
              <Card className="border border-purple-500/40 bg-purple-950/20 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                  <div>
                    <h5 className="font-bold text-white text-sm flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-purple-400" />
                      Novo Estorno da Fatura {refundTargetInvoice.number || refundTargetInvoice.id}
                    </h5>
                    <span className="text-[11px] font-mono text-gray-400">
                      ID: {refundTargetInvoice.id}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRefundTargetInvoice(null);
                      setRefundPreview(null);
                    }}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Cancelar
                  </Button>
                </div>

                {isLoadingRefundPreview ? (
                  <div className="py-8 text-center text-gray-400 text-xs animate-pulse">
                    Calculando saldo estornável autoritativo no Stripe...
                  </div>
                ) : refundPreview ? (
                  <>
                    {/* Indicadores Financeiros do Servidor */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-gray-400 block mb-1">Capturado Original</span>
                        <strong className="text-white text-sm">
                          {formatCurrencyBrl(refundPreview.originalCapturedAmount / 100)}
                        </strong>
                      </div>
                      <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-gray-400 block mb-1">Já Estornado</span>
                        <strong className="text-amber-400 text-sm">
                          {formatCurrencyBrl(refundPreview.totalAlreadyRefunded / 100)}
                        </strong>
                      </div>
                      <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-gray-400 block mb-1">Saldo Estornável</span>
                        <strong className="text-emerald-400 text-sm">
                          {formatCurrencyBrl(refundPreview.remainingRefundableAmount / 100)}
                        </strong>
                      </div>
                      <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-gray-400 block mb-1">Saldo Após Devolução</span>
                        <strong className="text-blue-400 text-sm">
                          {formatCurrencyBrl(refundPreview.remainingAfterRefund / 100)}
                        </strong>
                      </div>
                    </div>

                    {/* Invariantes de Isolamento */}
                    <div className="bg-black/40 border border-white/5 p-3 rounded-xl text-xs space-y-1">
                      <div className="flex items-center gap-2 text-gray-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>
                          Impacto na assinatura:{" "}
                          <strong className="text-white">{refundPreview.subscriptionImpact}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>
                          Impacto no add-on:{" "}
                          <strong className="text-white">{refundPreview.addonImpact}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Seleção Total vs Parcial */}
                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={refundType === "full" ? "default" : "outline"}
                        onClick={() => {
                          setRefundType("full");
                          handleInitiateRefund(refundTargetInvoice);
                        }}
                        className={cn(
                          "text-xs font-bold rounded-xl h-9 px-4",
                          refundType === "full" && "bg-purple-600 hover:bg-purple-700 text-white",
                        )}
                      >
                        Estorno Total (
                        {formatCurrencyBrl(refundPreview.remainingRefundableAmount / 100)})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={refundType === "partial" ? "default" : "outline"}
                        onClick={() => setRefundType("partial")}
                        className={cn(
                          "text-xs font-bold rounded-xl h-9 px-4",
                          refundType === "partial" &&
                            "bg-purple-600 hover:bg-purple-700 text-white",
                        )}
                      >
                        Estorno Parcial
                      </Button>

                      {refundPreview.addonAttributableMax > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRefundType("partial");
                            const valBrl = (refundPreview.addonAttributableMax / 100).toFixed(2);
                            handlePartialAmountChange(valBrl);
                          }}
                          className="text-xs text-blue-300 border-blue-500/30 hover:bg-blue-500/10 h-9 ml-auto"
                        >
                          Usar Valor do Add-on (
                          {formatCurrencyBrl(refundPreview.addonAttributableMax / 100)})
                        </Button>
                      )}
                    </div>

                    {refundType === "partial" && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-xs text-gray-300 font-bold block">
                          Valor Parcial a Devolver (R$) <span className="text-rose-400">*</span>
                        </label>
                        <Input
                          placeholder="Ex: 29.90"
                          value={partialAmountBrl}
                          onChange={(e) => handlePartialAmountChange(e.target.value)}
                          className="bg-black/40 border-white/10 text-white rounded-xl text-xs h-10 font-mono"
                        />
                        <span className="text-[10px] text-gray-500 block">
                          Máximo permitido:{" "}
                          {formatCurrencyBrl(refundPreview.remainingRefundableAmount / 100)}
                        </span>
                      </div>
                    )}

                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs text-gray-300 font-bold block">
                        Motivo Operacional do Estorno <span className="text-rose-400">*</span>
                      </label>
                      <Textarea
                        placeholder="Informe a justificativa de atendimento para este estorno (mínimo de 10 caracteres)..."
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        className="bg-black/40 border-white/10 text-white rounded-xl text-xs min-h-[60px]"
                      />
                      <span className="text-[10px] text-gray-500 block">
                        {refundReason.trim().length} / 10 caracteres mínimos
                      </span>
                    </div>

                    <div className="space-y-1.5 bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-xl">
                      <label className="text-xs text-rose-300 font-bold block">
                        Confirmação de Segurança: Digite ESTORNAR para executar devolução no Stripe
                      </label>
                      <Input
                        placeholder="ESTORNAR"
                        value={refundTypedConfirmation}
                        onChange={(e) => setRefundTypedConfirmation(e.target.value)}
                        className="bg-black/40 border-rose-500/40 text-white rounded-xl text-xs h-9 uppercase tracking-widest font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRefundTargetInvoice(null);
                          setRefundPreview(null);
                        }}
                        disabled={isSubmittingRefund}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleExecuteRefund}
                        disabled={
                          refundReason.trim().length < 10 ||
                          refundTypedConfirmation !== "ESTORNAR" ||
                          isSubmittingRefund
                        }
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl h-10 px-5 gap-2"
                      >
                        {isSubmittingRefund && <Loader2 className="w-4 h-4 animate-spin" />}
                        Executar Estorno no Stripe
                      </Button>
                    </div>
                  </>
                ) : null}
              </Card>
            )}

            {/* Tabela de Estornos Realizados */}
            {isLoadingRefunds ? (
              <div className="py-8 text-center text-gray-500 text-xs animate-pulse">
                Carregando histórico de estornos...
              </div>
            ) : refunds.length === 0 ? (
              <Card className="glass border-white/5 bg-white/[0.02] p-8 text-center rounded-2xl">
                <RotateCcw className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">
                  Nenhum estorno realizado até o momento.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Para efetuar uma devolução de valores, selecione uma fatura paga na aba "Faturas e
                  Pagamentos".
                </p>
              </Card>
            ) : (
              <Card className="glass border-white/5 rounded-2xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5">
                      <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider py-3 pl-6">
                        Data
                      </TableHead>
                      <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                        Valor
                      </TableHead>
                      <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                        Status
                      </TableHead>
                      <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                        Motivo
                      </TableHead>
                      <TableHead className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                        Stripe Refund ID
                      </TableHead>
                      <TableHead className="text-right text-gray-400 text-[10px] font-bold uppercase tracking-wider pr-6">
                        Stripe Link
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refunds.map((ref) => (
                      <TableRow key={ref.id} className="border-white/5">
                        <TableCell className="pl-6 py-4 text-xs font-mono text-gray-300">
                          {format(new Date(ref.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-rose-400">
                          {formatCurrencyBrl(ref.amount / 100)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "text-[10px] font-bold uppercase",
                              ref.status === "succeeded" &&
                                "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                              ref.status === "pending" &&
                                "bg-blue-500/20 text-blue-300 border-blue-500/30",
                              ref.status === "failed" &&
                                "bg-rose-500/20 text-rose-300 border-rose-500/30",
                              ref.status === "canceled" &&
                                "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
                            )}
                          >
                            {ref.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-300 max-w-xs truncate">
                          {ref.reason}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-400">
                          {ref.stripe_refund_id || "—"}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {ref.escapeHatchLinks?.stripeRefundUrl && (
                            <a
                              href={ref.escapeHatchLinks.stripeRefundUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-xs text-purple-400 hover:text-purple-300 gap-1 font-medium"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Ver no Stripe
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 6: AUDITORIA (AUDIT TIMELINE) */}
          {/* ========================================================================= */}
          <TabsContent value="audit" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-400" />
                  Linha do Tempo de Auditoria Operacional
                </h4>
                <p className="text-xs text-gray-400">
                  Histórico cronológico de mutações administrativas de ciclo de vida e estornos
                  (public.audit_logs).
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAuditTimeline}
                disabled={isLoadingAudit}
                className="h-8 border-white/10 text-xs text-gray-300 gap-1.5"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoadingAudit && "animate-spin")} />
                Recarregar Linha do Tempo
              </Button>
            </div>

            {isLoadingAudit ? (
              <div className="py-8 text-center text-gray-500 text-xs animate-pulse">
                Consultando registros de auditoria da barbearia...
              </div>
            ) : auditItems.length === 0 ? (
              <Card className="glass border-white/5 bg-white/[0.02] p-8 text-center rounded-2xl">
                <History className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">
                  Nenhum evento registrado nesta barbearia.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Operações realizadas como agendamento de cancelamento, reativação ou estornos
                  gerarão logs automáticos aqui.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {auditItems.map((item) => {
                  const isCancel = item.action.includes("cancel");
                  const isRefund = item.action.includes("refund");
                  const isReactivate = item.action.includes("reactivate");

                  return (
                    <Card
                      key={item.id}
                      className="glass border-white/5 bg-white/[0.02] p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={cn(
                              "text-[10px] font-bold uppercase",
                              isCancel && "bg-rose-500/20 text-rose-300 border-rose-500/30",
                              isRefund && "bg-purple-500/20 text-purple-300 border-purple-500/30",
                              isReactivate &&
                                "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                              !isCancel &&
                                !isRefund &&
                                !isReactivate &&
                                "bg-blue-500/20 text-blue-300 border-blue-500/30",
                            )}
                          >
                            {item.action}
                          </Badge>
                          <span className="text-xs font-medium text-white">
                            Ator: <strong className="text-gray-300">{item.actor}</strong>
                          </span>
                          <span className="text-[11px] text-gray-500 font-mono">
                            {format(new Date(item.timestamp), "dd/MM/yyyy HH:mm:ss", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300">
                          Motivo: <span className="italic text-gray-400">"{item.reason}"</span>
                        </p>
                      </div>

                      {item.amount != null && (
                        <div className="text-right sm:text-right">
                          <span className="text-[10px] text-gray-500 block uppercase">
                            Valor Envolvido
                          </span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            {formatCurrencyBrl(item.amount)}
                          </span>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
