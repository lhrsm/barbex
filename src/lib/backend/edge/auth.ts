/**
 * BARBEX — AUTH EDGE ADAPTER
 * Adapts client-side phone authentication and password reset flows
 * to communicate directly with Supabase Edge Functions:
 * - auth-phone
 * - auth-phone-reset
 *
 * Implements strict type safety, normalized error handling, and zero PII leakage.
 */

import { invokeEdgeFunction, type EdgeInvokeOptions, type EdgeErrorCode } from "../edge-client";
import { normalizePhone } from "@/utils/phone";

export interface SignInPhoneSessionDTO {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
}

export type SignInPhoneResult =
  | {
      ok: true;
      session: SignInPhoneSessionDTO;
      requestId?: string;
    }
  | {
      ok: false;
      code: EdgeErrorCode;
      message?: string;
      requestId?: string;
    };

export interface RequestPasswordResetResult {
  ok: boolean;
  code?: EdgeErrorCode;
  message?: string;
  requestId?: string;
}

export interface SignInStaffWithPhoneInput {
  phone: string;
  password: string;
}

export interface SignInCustomerWithPhoneInput {
  tenantSlug: string;
  phone: string;
  password: string;
}

export interface RequestStaffPhoneResetInput {
  phone: string;
}

export interface RequestCustomerPhoneResetInput {
  tenantSlug: string;
  phone: string;
}

// Compatibility helper to extract data wrapper if passed
function unwrapInput<T>(input: T | { data: T }): T {
  if (input && typeof input === "object" && "data" in input && (input as any).data) {
    return (input as { data: T }).data;
  }
  return input as T;
}

/**
 * Authenticates a staff member using phone number and password via the auth-phone Edge Function.
 */
export async function signInStaffWithPhone(
  rawInput: SignInStaffWithPhoneInput | { data: SignInStaffWithPhoneInput },
  options?: EdgeInvokeOptions
): Promise<SignInPhoneResult> {
  const input = unwrapInput(rawInput);
  const cleanPhone = normalizePhone(input.phone);
  if (!cleanPhone || !input.password) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Telefone ou senha inválidos.",
    };
  }

  const result = await invokeEdgeFunction<
    { kind: "staff"; phone: string; password: string },
    { session: SignInPhoneSessionDTO }
  >(
    "auth-phone",
    {
      kind: "staff",
      phone: cleanPhone,
      password: input.password,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      requestId: result.requestId,
    };
  }

  const session = (result as any).session || (result as any).data?.session;
  if (!session?.access_token || !session?.refresh_token) {
    return {
      ok: false,
      code: "SERVICE_UNAVAILABLE",
      message: "Não foi possível emitir a sessão de autenticação.",
      requestId: result.requestId,
    };
  }

  return {
    ok: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type || "bearer",
    },
    requestId: result.requestId,
  };
}

/**
 * Authenticates a customer within a specific barbershop tenant via the auth-phone Edge Function.
 */
export async function signInCustomerWithPhone(
  rawInput: SignInCustomerWithPhoneInput | { data: SignInCustomerWithPhoneInput },
  options?: EdgeInvokeOptions
): Promise<SignInPhoneResult> {
  const input = unwrapInput(rawInput);
  const cleanSlug = input.tenantSlug?.trim().toLowerCase();
  const cleanPhone = normalizePhone(input.phone);

  if (!cleanSlug || !cleanPhone || !input.password) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Telefone, senha ou estabelecimento inválidos.",
    };
  }

  const result = await invokeEdgeFunction<
    { kind: "customer"; tenantSlug: string; phone: string; password: string },
    { session: SignInPhoneSessionDTO }
  >(
    "auth-phone",
    {
      kind: "customer",
      tenantSlug: cleanSlug,
      phone: cleanPhone,
      password: input.password,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      requestId: result.requestId,
    };
  }

  const session = (result as any).session || (result as any).data?.session;
  if (!session?.access_token || !session?.refresh_token) {
    return {
      ok: false,
      code: "SERVICE_UNAVAILABLE",
      message: "Não foi possível emitir a sessão de autenticação.",
      requestId: result.requestId,
    };
  }

  return {
    ok: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type || "bearer",
    },
    requestId: result.requestId,
  };
}

/**
 * Requests password recovery for a staff member by phone via the auth-phone-reset Edge Function.
 * Always returns ok: true (anti-enumeration) unless rate limited.
 */
export async function requestStaffPhonePasswordReset(
  rawInput: RequestStaffPhoneResetInput | { data: RequestStaffPhoneResetInput },
  options?: EdgeInvokeOptions
): Promise<RequestPasswordResetResult> {
  const input = unwrapInput(rawInput);
  const cleanPhone = normalizePhone(input.phone);
  if (!cleanPhone) {
    return { ok: true };
  }

  const result = await invokeEdgeFunction<
    { kind: "staff"; phone: string },
    Record<string, unknown>
  >(
    "auth-phone-reset",
    {
      kind: "staff",
      phone: cleanPhone,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      requestId: result.requestId,
    };
  }

  return {
    ok: true,
    requestId: result.requestId,
  };
}

/**
 * Requests password recovery for a customer within a tenant by phone via the auth-phone-reset Edge Function.
 * Always returns ok: true (anti-enumeration) unless rate limited.
 */
export async function requestCustomerPhonePasswordReset(
  rawInput: RequestCustomerPhoneResetInput | { data: RequestCustomerPhoneResetInput },
  options?: EdgeInvokeOptions
): Promise<RequestPasswordResetResult> {
  const input = unwrapInput(rawInput);
  const cleanSlug = input.tenantSlug?.trim().toLowerCase();
  const cleanPhone = normalizePhone(input.phone);

  if (!cleanSlug || !cleanPhone) {
    return { ok: true };
  }

  const result = await invokeEdgeFunction<
    { kind: "customer"; tenantSlug: string; phone: string },
    Record<string, unknown>
  >(
    "auth-phone-reset",
    {
      kind: "customer",
      tenantSlug: cleanSlug,
      phone: cleanPhone,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      requestId: result.requestId,
    };
  }

  return {
    ok: true,
    requestId: result.requestId,
  };
}

// Aliases for retrocompatibility
export const signInWithPhone = signInStaffWithPhone;
export const requestPasswordResetByPhone = requestStaffPhonePasswordReset;
export const requestCustomerPasswordResetByPhone = requestCustomerPhonePasswordReset;
