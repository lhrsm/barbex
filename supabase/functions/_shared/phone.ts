/**
 * BARBEX SUPABASE EDGE FUNCTIONS — CANONICAL PHONE NORMALIZATION
 * Exact parity with src/utils/phone.ts
 */

/**
 * Normalizes a phone number to canonical E.164 format (digits only, with Brazilian country code 55)
 * Example: "+55 (71) 98274-7130" -> "5571982747130"
 * Example: "(71) 98274-7130" -> "5571982747130"
 * Example: "71982747130" -> "5571982747130"
 * Example: "5571982747130" -> "5571982747130"
 */
export function normalizePhone(phone?: string | null): string {
  if (!phone) return "";

  // Remove all non-digits
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";

  // If already prefixed with Brazilian DDI 55 and has valid length (55 + 2 DDD + 8 or 9 digits = 12 or 13 digits)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // If provided as 10 or 11 digits (2 DDD + 8 or 9 digits), prepend Brazilian DDI 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Return digits as-is for international or other formats without heuristic distortion
  return digits;
}

/**
 * Validates if a normalized phone number matches the canonical Brazilian mobile or landline format
 * Format: 55 + DDD (11-99) + 8 or 9 digits (total 12 or 13 digits)
 */
export function isValidBrazilianPhone(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = normalizePhone(phone);
  return /^55[1-9][0-9]{9,10}$/.test(digits);
}
