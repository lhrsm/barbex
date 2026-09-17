/**
 * BARBEX — CUSTOMER AUTH ADAPTER
 * Public booking customer verification and onboarding.
 * Calls `customer-auth` Edge Function directly.
 */

import { invokeEdgeFunction, type EdgeResult } from "@/lib/backend/edge-client";

export interface RequestCustomerVerificationParams {
  tenantId: string;
  phone: string;
  name: string;
  email: string;
}

export interface VerifyCustomerCodeParams {
  challengeId: string;
  code: string;
  email?: string;
}

export interface FinalizeCustomerAuthParams {
  challengeId: string;
  password?: string;
}

export async function requestCustomerEmailVerificationClient(
  params: RequestCustomerVerificationParams
): Promise<{ success: boolean; challengeId?: string; error?: string }> {
  const res = await invokeEdgeFunction<
    { action: string; tenantId: string; phone: string; name: string; email: string },
    { challengeId: string; expiresAt: string; message: string }
  >("customer-auth", {
    action: "request-verification",
    tenantId: params.tenantId,
    phone: params.phone,
    name: params.name,
    email: params.email,
  });

  if (!res.ok) {
    return { success: false, error: res.message || "Falha ao solicitar verificação." };
  }

  return { success: true, challengeId: res.data?.challengeId };
}

export async function verifyCustomerEmailCodeClient(
  params: VerifyCustomerCodeParams
): Promise<{ success: boolean; error?: string }> {
  const res = await invokeEdgeFunction<
    { action: string; challengeId: string; code: string; email?: string },
    { verified: boolean; challengeId: string }
  >("customer-auth", {
    action: "verify-code",
    challengeId: params.challengeId,
    code: params.code,
    email: params.email,
  });

  if (!res.ok) {
    return { success: false, error: res.message || "Código incorreto ou expirado." };
  }

  return { success: true };
}

export async function finalizeCustomerAuthSetupClient(
  params: FinalizeCustomerAuthParams
): Promise<{ success: boolean; userId?: string; email?: string; error?: string }> {
  const res = await invokeEdgeFunction<
    { action: string; challengeId: string; password?: string },
    { userId: string; email: string; message: string }
  >("customer-auth", {
    action: "finalize-setup",
    challengeId: params.challengeId,
    password: params.password,
  });

  if (!res.ok) {
    return { success: false, error: res.message || "Falha ao finalizar cadastro." };
  }

  return {
    success: true,
    userId: res.data?.userId,
    email: res.data?.email,
  };
}
