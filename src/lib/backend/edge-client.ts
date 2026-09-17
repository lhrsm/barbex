/**
 * BARBEX — CANONICAL EDGE FUNCTION CLIENT
 * Provides standardized, secure communication with Supabase Edge Functions.
 * Handles authentication tokens, timeouts, correlation IDs, and normalized error contracts.
 * ZERO server-side secrets or service role keys allowed here.
 */

import { supabase as defaultSupabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EdgeErrorCode =
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "SERVICE_UNAVAILABLE"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "INTERNAL_ERROR";

export interface EdgeResultSuccess<T> {
  ok: true;
  data?: T;
  session?: T;
  requestId?: string;
  [key: string]: unknown;
}

export interface EdgeResultError {
  ok: false;
  code: EdgeErrorCode;
  message?: string;
  requestId?: string;
}

export type EdgeResult<T = unknown> = EdgeResultSuccess<T> | EdgeResultError;

export interface EdgeInvokeOptions {
  /**
   * Custom Supabase client instance (used for isolated test harnesses or target shadow testing).
   */
  client?: SupabaseClient;
  /**
   * Timeout in milliseconds. Defaults to 15000ms (15 seconds).
   */
  timeoutMs?: number;
  /**
   * Explicit bearer token override if needed.
   */
  authToken?: string;
  /**
   * Additional request headers.
   */
  headers?: Record<string, string>;
}

function generateCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "req_" + Math.random().toString(36).substring(2, 15);
}

/**
 * Invokes a Supabase Edge Function with automatic token injection, timeout, and normalized error contract.
 */
export async function invokeEdgeFunction<TInput = unknown, TOutput = unknown>(
  functionName: string,
  payload?: TInput,
  options: EdgeInvokeOptions = {}
): Promise<EdgeResult<TOutput>> {
  const client = options.client || defaultSupabase;
  const timeoutMs = options.timeoutMs ?? 15000;
  const correlationId = generateCorrelationId();

  // Create an AbortController for timeout management
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const headers: Record<string, string> = {
      "x-request-id": correlationId,
      ...(options.headers || {}),
    };

    if (options.authToken) {
      headers["Authorization"] = `Bearer ${options.authToken}`;
    }

    const { data, error } = await client.functions.invoke(functionName, {
      body: payload,
      headers,
    });

    clearTimeout(timeoutId);

    if (error) {
      // Check HTTP status or error codes from functions invoke
      const status = (error as any).status || (error as any).statusCode;
      let mappedCode: EdgeErrorCode = "SERVICE_UNAVAILABLE";

      if (status === 401) mappedCode = "UNAUTHORIZED";
      else if (status === 403) mappedCode = "FORBIDDEN";
      else if (status === 429) mappedCode = "RATE_LIMITED";
      else if (status === 404) mappedCode = "NOT_FOUND";
      else if (status === 409) mappedCode = "CONFLICT";
      else if (status === 400) mappedCode = "INVALID_REQUEST";

      // If data is returned in error object, check if it contains a structured code
      if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        if (d.code && typeof d.code === "string") {
          return {
            ok: false,
            code: d.code as EdgeErrorCode,
            message: typeof d.message === "string" ? d.message : undefined,
            requestId: (typeof d.requestId === "string" ? d.requestId : correlationId),
          };
        }
      }

      return {
        ok: false,
        code: mappedCode,
        message: error.message || "Falha na comunicação com o servidor.",
        requestId: correlationId,
      };
    }

    // Edge Function returned a JSON body
    if (data && typeof data === "object") {
      const responseObj = data as Record<string, unknown>;
      
      // If the Edge function returned { ok: false, code: ... }
      if (responseObj.ok === false) {
        return {
          ok: false,
          code: (responseObj.code as EdgeErrorCode) || "SERVICE_UNAVAILABLE",
          message: typeof responseObj.message === "string" ? responseObj.message : undefined,
          requestId: (typeof responseObj.requestId === "string" ? responseObj.requestId : correlationId),
        };
      }

      // Success payload
      return {
        ok: true,
        ...responseObj,
        requestId: (typeof responseObj.requestId === "string" ? responseObj.requestId : correlationId),
      } as EdgeResultSuccess<TOutput>;
    }

    return {
      ok: true,
      data: data as TOutput,
      requestId: correlationId,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return {
          ok: false,
          code: "TIMEOUT",
          message: "Tempo limite de requisição excedido. Verifique sua conexão e tente novamente.",
          requestId: correlationId,
        };
      }
    }

    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: "Falha de conexão com a rede. Verifique sua internet e tente novamente.",
      requestId: correlationId,
    };
  }
}
