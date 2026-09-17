/**
 * BARBEX SUPABASE EDGE FUNCTIONS — CRYPTO & UTILITIES (DENO-NATIVE)
 */

/**
 * Computes a SHA-256 hash formatted as a hex string using Deno Web Crypto API.
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a standard UUID v4 request identifier.
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Calculates elapsed milliseconds from a high-resolution performance timestamp.
 */
export function elapsedMs(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}
