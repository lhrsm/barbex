/**
 * BARBEX SUPABASE EDGE FUNCTIONS — SAFE ENVIRONMENT CONFIGURATION
 */

import { EdgeError } from "./errors.ts";

/**
 * Retrieves a required environment variable from Deno runtime.
 * Throws a sanitized EdgeError if missing, without exposing sensitive values.
 */
export function getRequiredEnv(name: string): string {
  // In Deno environment, Deno.env.get is available; fallback for compatibility testing
  const val = typeof Deno !== "undefined" ? Deno.env.get(name) : process.env[name];
  if (!val) {
    console.error(`[Edge Config Error] Required environment variable '${name}' is missing.`);
    throw new EdgeError(
      "SERVICE_UNAVAILABLE",
      "O serviço está temporariamente indisponível devido a configuração interna.",
      503
    );
  }
  return val;
}

/**
 * Retrieves an optional environment variable with a default fallback.
 */
export function getOptionalEnv(name: string, fallback = ""): string {
  const val = typeof Deno !== "undefined" ? Deno.env.get(name) : process.env[name];
  return val || fallback;
}
