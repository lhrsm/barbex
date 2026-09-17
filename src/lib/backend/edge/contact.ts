/**
 * BARBEX — PUBLIC CONTACT ADAPTER
 * Calls the `contact-public` Supabase Edge Function.
 */

import { invokeEdgeFunction, type EdgeResult } from "@/lib/backend/edge-client";

export interface SubmitPublicContactParams {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  honeypot?: string;
}

export async function submitPublicContactMessageClient(
  params: SubmitPublicContactParams
): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await invokeEdgeFunction<
    SubmitPublicContactParams,
    { message: string }
  >("contact-public", params);

  if (!res.ok) {
    return { success: false, error: res.message || "Falha ao enviar mensagem." };
  }

  return { success: true, message: res.data?.message };
}
