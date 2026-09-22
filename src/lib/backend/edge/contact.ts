/**
 * BARBEX — PUBLIC CONTACT ADAPTER
 * Calls the `contact-public` Supabase Edge Function with durable persistence contract.
 */

import { invokeEdgeFunction } from "@/lib/backend/edge-client";

export interface SubmitPublicContactParams {
  slug?: string;
  tenantId?: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  honeypot?: string;
}

export interface SubmitPublicContactResult {
  success: boolean;
  persisted: boolean;
  emailStatus?: "sent" | "failed" | "provider_unconfigured" | "pending" | "ignored";
  id?: string;
  message?: string;
  error?: string;
}

export async function submitPublicContactMessageClient(
  params: SubmitPublicContactParams,
): Promise<SubmitPublicContactResult> {
  const res = await invokeEdgeFunction<
    SubmitPublicContactParams,
    {
      id?: string;
      persisted?: boolean;
      emailStatus?: "sent" | "failed" | "provider_unconfigured" | "pending" | "ignored";
      message?: string;
    }
  >("contact-public", params);

  if (!res.ok) {
    return {
      success: false,
      persisted: false,
      error: res.message || "Falha na comunicação com o servidor.",
    };
  }

  const data = res.data;
  return {
    success: true,
    persisted: Boolean(data?.persisted ?? true),
    emailStatus: data?.emailStatus,
    id: data?.id,
    message: data?.message || "Recebemos sua mensagem. A barbearia poderá consultá-la pelo painel.",
  };
}
