/**
 * BARBEX SUPABASE EDGE FUNCTIONS — CORS HANDLER
 */

export const ALLOWED_ORIGINS = [
  "https://barbex.shop",
  "https://www.barbex.shop",
  "https://preview.barbex.shop",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000"
];

/**
 * Validates whether an incoming Origin is in the allowlist.
 */
export function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Generates CORS headers based on the request Origin.
 * Never reflects arbitrary origins.
 */
export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers?.get("origin");
  const allowOrigin = isAllowedOrigin(origin) ? (origin as string) : "https://barbex.shop";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * Handles OPTIONS preflight requests immediately with HTTP 204 No Content.
 */
export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req)
    });
  }
  return null;
}
