/**
 * BARBEX — AI ASSISTANT ADAPTER
 * Connects frontend callers to the `ai-assistant` Supabase Edge Function.
 * Completely eliminates Lovable gateway and client-side secret exposure.
 */

import { invokeEdgeFunction, type EdgeResult } from "@/lib/backend/edge-client";

export interface AskAdminAssistantInput {
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AskAdminAssistantOutput {
  answer: string;
}

export interface LoyaltySuggestion {
  template_slug: string;
  reason: string;
  tweak?: Record<string, any>;
}

export interface LoyaltySuggestionsOutput {
  suggestions: LoyaltySuggestion[];
}

export async function askAdminAssistantClient(
  input: AskAdminAssistantInput
): Promise<{ answer?: string; error?: string }> {
  const res = await invokeEdgeFunction<
    { action: string; question: string; history?: Array<{ role: "user" | "assistant"; content: string }> },
    AskAdminAssistantOutput
  >("ai-assistant", {
    action: "admin-assistant",
    question: input.question,
    history: input.history,
  });

  if (!res.ok) {
    return { error: res.message || "Falha ao consultar o assistente de IA." };
  }

  return { answer: res.data?.answer };
}

export async function suggestLoyaltyCampaignsClient(): Promise<{
  suggestions?: LoyaltySuggestion[];
  error?: string;
}> {
  const res = await invokeEdgeFunction<{ action: string }, LoyaltySuggestionsOutput>(
    "ai-assistant",
    { action: "loyalty-campaign-suggestions" }
  );

  if (!res.ok) {
    return { error: res.message || "Falha ao gerar sugestões de fidelidade." };
  }

  return { suggestions: res.data?.suggestions || [] };
}
