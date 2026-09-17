/**
 * BARBEX SUPABASE EDGE FUNCTIONS — REQUEST VALIDATION & METHOD GUARDS
 */

import { EdgeError } from "./errors.ts";

/**
 * Enforces allowed HTTP methods on an incoming Request.
 */
export function requireMethod(req: Request, ...allowedMethods: string[]): void {
  const method = req.method.toUpperCase();
  const allowed = allowedMethods.map((m) => m.toUpperCase());

  if (!allowed.includes(method)) {
    throw new EdgeError(
      "INVALID_REQUEST",
      `Método HTTP '${method}' não é permitido para este endpoint. Métodos permitidos: ${allowed.join(", ")}`,
      405
    );
  }
}

/**
 * Safely parses the JSON body of a Request with a maximum size limit.
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  req: Request,
  maxSizeBytes = 1048576 // 1 MB default limit
): Promise<T> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
    throw new EdgeError(
      "INVALID_REQUEST",
      `O tamanho da requisição excede o limite máximo permitido de ${maxSizeBytes} bytes.`,
      413
    );
  }

  try {
    const bodyText = await req.text();
    if (!bodyText || !bodyText.trim()) {
      return {} as T;
    }
    if (bodyText.length > maxSizeBytes) {
      throw new EdgeError(
        "INVALID_REQUEST",
        `O tamanho da requisição excede o limite máximo permitido.`,
        413
      );
    }
    return JSON.parse(bodyText) as T;
  } catch (err) {
    if (err instanceof EdgeError) throw err;
    throw new EdgeError(
      "INVALID_REQUEST",
      "Corpo da requisição JSON inválido ou malformado.",
      400
    );
  }
}
