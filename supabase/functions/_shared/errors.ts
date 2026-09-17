/**
 * BARBEX SUPABASE EDGE FUNCTIONS — ERROR HANDLING & SANITIZATION
 */

import type { ErrorCode } from "./types.ts";

export class EdgeError extends Error {
  code: ErrorCode;
  status: number;

  constructor(code: ErrorCode, message: string, status = 400) {
    super(message);
    this.name = "EdgeError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Maps known PostgreSQL / PostgREST error codes to standard Edge error codes and safe messages.
 */
export function mapDatabaseError(err: unknown): { code: ErrorCode; message: string; status: number } {
  const errObj = err as Record<string, unknown> | null;
  const msg = String(errObj?.message || "");
  const code = String(errObj?.code || "");

  if (code === "23505" || msg.includes("duplicate key") || msg.includes("already exists")) {
    return {
      code: "CONFLICT",
      message: "O registro informado já existe no sistema.",
      status: 409
    };
  }

  if (code === "23503" || msg.includes("foreign key")) {
    return {
      code: "INVALID_REQUEST",
      message: "Referência inválida ou recurso associado não encontrado.",
      status: 400
    };
  }

  if (code === "42501" || msg.includes("permission denied") || msg.includes("RLS")) {
    return {
      code: "FORBIDDEN",
      message: "Acesso não autorizado ao recurso solicitado.",
      status: 403
    };
  }

  if (code === "PGRST116" || msg.includes("Results contain 0 rows")) {
    return {
      code: "NOT_FOUND",
      message: "O recurso solicitado não foi encontrado.",
      status: 404
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Ocorreu um erro interno ao processar a solicitação.",
    status: 500
  };
}

/**
 * Sanitizes any raw exception or error to prevent leaking SQL, table names, stack traces, or secrets.
 */
export function sanitizeError(err: unknown): { code: ErrorCode; message: string; status: number } {
  if (err instanceof EdgeError) {
    return {
      code: err.code,
      message: err.message,
      status: err.status
    };
  }

  return mapDatabaseError(err);
}
