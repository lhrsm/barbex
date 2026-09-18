export interface RecipientMeta {
  label: string;
  cls: string;
}

export const RECIPIENT_LABELS: Record<string, RecipientMeta> = {
  customer: { label: "Cliente", cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  barber: { label: "Profissional", cls: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  shop: { label: "Barbearia", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  previous_barber: {
    label: "Profissional anterior",
    cls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  },
  new_barber: {
    label: "Novo profissional",
    cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  },
};

export function createUnknownRecipientMeta(rawRecipient?: string | null): RecipientMeta {
  const sanitized = String(rawRecipient || "").trim();
  const label = sanitized ? sanitized.replace(/_/g, " ") : "Outro destinatário";
  return {
    label,
    cls: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  };
}

export function getRecipientMeta(rawRecipient?: string | null): RecipientMeta {
  const key = String(rawRecipient || "")
    .trim()
    .toLowerCase();
  if (key && RECIPIENT_LABELS[key]) {
    return RECIPIENT_LABELS[key];
  }
  return createUnknownRecipientMeta(rawRecipient);
}

export const CATEGORY_LABELS: Record<string, string> = {
  agendamentos: "Agendamentos",
  assinaturas: "Assinaturas",
  financeiro: "Financeiro",
  fidelidade: "Fidelidade",
  marketing: "Marketing",
  avaliacoes: "Avaliações",
  outros: "Outros",
};

export const CATEGORY_ORDER = [
  "agendamentos",
  "assinaturas",
  "financeiro",
  "fidelidade",
  "marketing",
  "avaliacoes",
  "outros",
];

export function normalizeAutomationCategory(rawCategory?: string | null): string {
  const cat = String(rawCategory || "")
    .trim()
    .toLowerCase();
  if (cat === "agendamentos" || cat === "appointment") return "agendamentos";
  if (cat === "assinaturas" || cat === "subscription") return "assinaturas";
  if (cat === "financeiro" || cat === "financial" || cat === "payment") return "financeiro";
  if (cat === "fidelidade" || cat === "loyalty") return "fidelidade";
  if (cat === "marketing") return "marketing";
  if (cat === "review" || cat === "avaliacoes" || cat === "avaliação" || cat === "avaliacao")
    return "avaliacoes";
  if (!cat) return "agendamentos";
  return "outros";
}
