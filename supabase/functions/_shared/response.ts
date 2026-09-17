/**
 * BARBEX SUPABASE EDGE FUNCTIONS — STANDARD RESPONSE BUILDERS
 */

import { getCorsHeaders } from "./cors.ts";
import { generateRequestId } from "./crypto.ts";
import type { ErrorCode, EdgeSuccess, EdgeFailure } from "./types.ts";

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "X-Content-Type-Options": "nosniff"
};

/**
 * Builds a uniform success JSON response.
 */
export function jsonSuccess<T>(
  data: T,
  status = 200,
  req?: Request,
  customHeaders?: Record<string, string>
): Response {
  const requestId = req?.headers?.get("x-request-id") || generateRequestId();
  const cors = getCorsHeaders(req);

  const payload: EdgeSuccess<T> = {
    ok: true,
    data,
    requestId
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...BASE_HEADERS,
      ...cors,
      ...customHeaders,
      "x-request-id": requestId
    }
  });
}

/**
 * Builds a uniform sanitized error JSON response.
 */
export function jsonError(
  code: ErrorCode,
  message: string,
  status = 400,
  req?: Request,
  customHeaders?: Record<string, string>
): Response {
  const requestId = req?.headers?.get("x-request-id") || generateRequestId();
  const cors = getCorsHeaders(req);

  const payload: EdgeFailure = {
    ok: false,
    code,
    error: message,
    requestId
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...BASE_HEADERS,
      ...cors,
      ...customHeaders,
      "x-request-id": requestId
    }
  });
}
