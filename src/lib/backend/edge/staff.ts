/**
 * BARBEX — STAFF AUTHENTICATION & ONBOARDING EDGE ADAPTER
 * Adapts staff onboarding, OTP verification, setup finalization, and reception creation
 * to communicate directly with Supabase Edge Function 'staff-auth'.
 * ZERO server-side secrets or service role keys allowed here.
 */

import { invokeEdgeFunction, type EdgeInvokeOptions } from "../edge-client";

export interface RequestStaffEmailVerificationInput {
  email: string;
  phone: string;
  barberId: string;
  tenantId: string;
  barberName: string;
}

export interface VerifyStaffEmailCodeInput {
  email: string;
  code: string;
  barberId: string;
}

export interface FinalizeStaffAuthSetupInput {
  email: string;
  password?: string;
  barberId: string;
  phone: string;
  name: string;
  tenantId: string;
}

export interface CreateReceptionAccountInput {
  email: string;
  password: string;
  name?: string;
}

function unwrapInput<T>(input: T | { data: T }): T {
  if (input && typeof input === "object" && "data" in input && (input as any).data) {
    return (input as { data: T }).data;
  }
  return input as T;
}

/**
 * Requests a 6-digit OTP code for staff verification via 'staff-auth' Edge Function.
 */
export async function requestStaffEmailVerification(
  rawInput: RequestStaffEmailVerificationInput | { data: RequestStaffEmailVerificationInput },
  options?: EdgeInvokeOptions
): Promise<{ ok: boolean; success: boolean; emailExists?: boolean }> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<{
    action: "request-verification";
    email: string;
    phone: string;
    barberId: string;
    tenantId: string;
    barberName: string;
  }, { emailExists?: boolean }>(
    "staff-auth",
    {
      action: "request-verification",
      email: input.email.trim().toLowerCase(),
      phone: input.phone,
      barberId: input.barberId,
      tenantId: input.tenantId,
      barberName: input.barberName,
    },
    options
  );

  if (!result.ok) {
    throw new Error(result.message || "Falha ao solicitar código de verificação.");
  }

  return {
    ok: true,
    success: true,
    emailExists: Boolean((result as any).emailExists),
  };
}

/**
 * Verifies a 6-digit OTP code for staff onboarding via 'staff-auth' Edge Function.
 */
export async function verifyStaffEmailCode(
  rawInput: VerifyStaffEmailCodeInput | { data: VerifyStaffEmailCodeInput },
  options?: EdgeInvokeOptions
): Promise<{ ok: boolean; success: boolean; verified: boolean; error?: string }> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<{
    action: "verify-code";
    email: string;
    code: string;
    barberId: string;
  }, { verified: boolean }>(
    "staff-auth",
    {
      action: "verify-code",
      email: input.email.trim().toLowerCase(),
      code: input.code.trim(),
      barberId: input.barberId,
    },
    options
  );

  if (!result.ok) {
    throw new Error(result.message || "Código de verificação inválido ou expirado.");
  }

  return {
    ok: true,
    success: true,
    verified: Boolean((result as any).verified !== false),
  };
}

/**
 * Finalizes staff onboarding setup and links user to barber profile via 'staff-auth' Edge Function.
 */
export async function finalizeStaffAuthSetup(
  rawInput: FinalizeStaffAuthSetupInput | { data: FinalizeStaffAuthSetupInput },
  options?: EdgeInvokeOptions
): Promise<{ ok: boolean; success: boolean; targetRoute?: string }> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<{
    action: "finalize-setup";
    email: string;
    password?: string;
    barberId: string;
    phone: string;
    name: string;
    tenantId: string;
  }, { targetRoute?: string }>(
    "staff-auth",
    {
      action: "finalize-setup",
      email: input.email.trim().toLowerCase(),
      password: input.password,
      barberId: input.barberId,
      phone: input.phone,
      name: input.name,
      tenantId: input.tenantId,
    },
    options
  );

  if (!result.ok) {
    throw new Error(result.message || "Falha ao finalizar configuração de acesso.");
  }

  return {
    ok: true,
    success: true,
    targetRoute: (result as any).targetRoute || "/dashboard",
  };
}

/**
 * Creates a dedicated reception account via 'staff-auth' Edge Function.
 */
export async function createReceptionAccount(
  rawInput: CreateReceptionAccountInput | { data: CreateReceptionAccountInput },
  options?: EdgeInvokeOptions
): Promise<{ ok: boolean; success: boolean; userId?: string }> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<{
    action: "create-reception";
    email: string;
    password: string;
    name?: string;
  }, { userId?: string }>(
    "staff-auth",
    {
      action: "create-reception",
      email: input.email.trim().toLowerCase(),
      password: input.password,
      name: input.name,
    },
    options
  );

  if (!result.ok) {
    throw new Error(result.message || "Falha ao criar conta de recepção.");
  }

  return {
    ok: true,
    success: true,
    userId: (result as any).userId,
  };
}
