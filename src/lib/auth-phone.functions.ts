import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePhone, isValidBrazilianPhone } from "@/utils/phone";
import type { Database } from "@/integrations/supabase/types";

/**
 * Roles de colaboradores e administradores que possuem permissão
 * de autenticação via telefone (coerente com o índice parcial remoto idx_profiles_staff_phone_unique)
 */
export const AUTHENTICABLE_STAFF_ROLES = [
  "super_admin",
  "admin",
  "tenant_admin",
  "shop_owner",
  "manager",
  "reception",
  "receptionist",
  "financial",
  "finance",
  "cashier",
  "barber",
  "professional",
] as const;

export interface SessionDTO {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
}

export type SignInPhoneResult =
  | {
      ok: true;
      session: SessionDTO;
    }
  | {
      ok: false;
      code: "INVALID_CREDENTIALS" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE";
    };

/**
 * In-Memory Zero-PII Sliding Window Rate Limiter
 * Protege endpoints de autenticação e recuperação de senha sem persistir PII (telefones/e-mails)
 */
interface RateLimitBucket {
  timestamps: number[];
}

const memoryRateLimitStore = new Map<string, RateLimitBucket>();
const CLEANUP_INTERVAL_MS = 60_000;
let lastRateLimitCleanup = Date.now();

function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();

  // Limpeza periódica de buckets expirados
  if (now - lastRateLimitCleanup > CLEANUP_INTERVAL_MS) {
    lastRateLimitCleanup = now;
    for (const [k, bucket] of memoryRateLimitStore.entries()) {
      bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);
      if (bucket.timestamps.length === 0) {
        memoryRateLimitStore.delete(k);
      }
    }
  }

  const bucket = memoryRateLimitStore.get(key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

  if (bucket.timestamps.length >= maxAttempts) {
    memoryRateLimitStore.set(key, bucket);
    return false; // Rate limited
  }

  bucket.timestamps.push(now);
  memoryRateLimitStore.set(key, bucket);
  return true; // Permitido
}

function deriveRateLimitKey(prefix: string, rawIdentifier: string): string {
  let hash = 0;
  const str = `${prefix}:${rawIdentifier}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${prefix}:${Math.abs(hash).toString(36)}`;
}

/**
 * Helper privado compartilhado: Resolução segura e estrita de colaboradores por telefone
 *
 * Regras de resolução:
 * 1. Busca primária em public.profiles.phone (candidatos com e sem DDI 55)
 * 2. Fallback de compatibilidade em public.barbers.phone (apenas ativos com user_id preenchido)
 * 3. Validação de papel de staff em AUTHENTICABLE_STAFF_ROLES
 * 4. Deduplicação: se profiles e barbers apontam para o mesmo user_id, retorna com sucesso
 * 5. Fail-closed: se profiles e barbers apontam para usuários diferentes ou se houver colisão de múltiplos registros, encerra com null
 */
async function resolveAuthenticableStaffUserByPhone(
  inputPhone: string,
  supabaseAdmin: any
): Promise<string | null> {
  const cleanPhone = normalizePhone(inputPhone);
  if (!cleanPhone || !isValidBrazilianPhone(cleanPhone)) {
    return null;
  }

  const phoneCandidates = [cleanPhone];
  if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
    phoneCandidates.push(cleanPhone.slice(2));
  }

  // 1. Busca em profiles
  const { data: matchedProfiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .in("phone", phoneCandidates)
    .not("phone", "is", null)
    .neq("phone", "")
    .in("role", AUTHENTICABLE_STAFF_ROLES as unknown as string[]);

  if (profileError) return null;
  if (matchedProfiles && matchedProfiles.length > 1) return null; // Ambiguidade em profiles

  const profileUserId = (matchedProfiles && matchedProfiles.length === 1 && matchedProfiles[0]?.id)
    ? matchedProfiles[0].id
    : null;

  // 2. Fallback em barbers para profissionais ativos
  const { data: matchedBarbers, error: barberError } = await supabaseAdmin
    .from("barbers")
    .select("id, user_id, active")
    .in("phone", phoneCandidates)
    .eq("active", true)
    .not("user_id", "is", null);

  if (barberError) return null;
  if (matchedBarbers && matchedBarbers.length > 1) return null; // Ambiguidade em barbers

  let barberUserId: string | null = null;
  if (matchedBarbers && matchedBarbers.length === 1 && matchedBarbers[0]?.user_id) {
    const candidateUserId = matchedBarbers[0].user_id;

    // Valida se o perfil do usuário possui papel de staff autenticável
    const { data: bProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", candidateUserId)
      .in("role", AUTHENTICABLE_STAFF_ROLES as unknown as string[])
      .maybeSingle();

    if (bProfile?.id) {
      barberUserId = bProfile.id;
    }
  }

  // 3. Resolução de colisão e deduplicação
  if (profileUserId && barberUserId) {
    if (profileUserId === barberUserId) {
      return profileUserId; // Mesmo usuário em ambas as tabelas -> Deduplica com sucesso
    }
    return null; // Usuários distintos com mesmo telefone -> Colisão fail-closed
  }

  return profileUserId || barberUserId || null;
}

/**
 * Server Function: Autenticação de colaboradores via Telefone + Senha
 *
 * Fluxo de execução estritamente server-side:
 * 1. Aplica Rate Limit por identificador derivado (máx 10 tentativas por 5 minutos)
 * 2. Normaliza e valida o telefone no padrão E.164 canônico brasileiro (55XXXXXXXXXXX)
 * 3. Resolve pontualmente (O(1)) o usuário autenticável via resolveAuthenticableStaffUserByPhone
 * 4. Resolve o e-mail canônico oficial no auth.users via Admin API
 * 5. Executa autenticação GoTrue signInWithPassword através de cliente efêmero isolado
 * 6. Retorna DTO mínimo de sessão sem vazar e-mails, telefones ou detalhes internos
 */
export const signInWithPhone = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        phone: z.string().trim().min(1).max(50),
        password: z.string().min(1).max(256),
      })
      .parse(input)
  )
  .handler(async ({ data }): Promise<SignInPhoneResult> => {
    const { phone, password } = data;

    // 1. Rate Limiting por identificador derivado (10 tentativas / 5 minutos)
    const rateLimitKey = deriveRateLimitKey("login", phone);
    if (!checkRateLimit(rateLimitKey, 10, 300_000)) {
      return { ok: false, code: "RATE_LIMITED" };
    }

    // 2. Normalização determinística e validação fail-closed de formato
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || !isValidBrazilianPhone(cleanPhone)) {
      return { ok: false, code: "INVALID_CREDENTIALS" };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 3. Resolução de identidade autenticável via helper unificado
      const targetUserId = await resolveAuthenticableStaffUserByPhone(cleanPhone, supabaseAdmin);
      if (!targetUserId) {
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      // 4. Resolução pontual O(1) do Auth User oficial via Admin API
      const { data: authUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

      if (userError || !authUserData?.user?.email) {
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      const canonicalEmail = authUserData.user.email.trim().toLowerCase();

      // 5. Instanciação de cliente Supabase efêmero e isolado para GoTrue sign-in
      const { createClient } = await import("@supabase/supabase-js");

      const supabaseUrl =
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL;

      const supabaseAnonKey =
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return { ok: false, code: "SERVICE_UNAVAILABLE" };
      }

      const ephemeralAuthClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      // 6. Autenticação oficial de credenciais contra GoTrue
      const { data: authResult, error: authError } = await ephemeralAuthClient.auth.signInWithPassword({
        email: canonicalEmail,
        password,
      });

      if (authError) {
        if (authError.status === 429 || (authError.message && authError.message.toLowerCase().includes("rate limit"))) {
          return { ok: false, code: "RATE_LIMITED" };
        }
        if (authError.status && authError.status >= 500) {
          return { ok: false, code: "SERVICE_UNAVAILABLE" };
        }
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      const session = authResult?.session;
      if (!session?.access_token || !session?.refresh_token) {
        return { ok: false, code: "SERVICE_UNAVAILABLE" };
      }

      // 7. Retorno de DTO estrito e sanitizado
      return {
        ok: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          token_type: session.token_type || "bearer",
        },
      };
    } catch {
      return { ok: false, code: "SERVICE_UNAVAILABLE" };
    }
  });

export interface RequestPasswordResetResult {
  ok: boolean;
  code?: "RATE_LIMITED" | "SERVICE_UNAVAILABLE";
}

/**
 * Server Function: Solicitação segura de recuperação de senha por telefone (Zero Enumeração)
 *
 * Fluxo de execução server-side:
 * 1. Aplica Rate Limit por identificador derivado (máx 3 tentativas por 10 minutos)
 * 2. Normaliza e valida o telefone no padrão E.164 brasileiro
 * 3. Resolve o colaborador autenticável via resolveAuthenticableStaffUserByPhone
 * 4. Resolve o Auth User via Admin API de forma estritamente server-side (auth.users.email)
 * 5. Dispara resetPasswordForEmail via cliente efêmero para o e-mail canônico
 * 6. Retorna SEMPRE resposta neutra ({ ok: true }) prevenindo enumeração de telefones ou contas
 */
export const requestPasswordResetByPhone = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        phone: z.string().trim().min(1).max(50),
      })
      .parse(input)
  )
  .handler(async ({ data }): Promise<RequestPasswordResetResult> => {
    const { phone } = data;

    // 1. Rate Limiting anti-spam por identificador derivado (3 tentativas / 10 minutos)
    const rateLimitKey = deriveRateLimitKey("reset", phone);
    if (!checkRateLimit(rateLimitKey, 3, 600_000)) {
      return { ok: false, code: "RATE_LIMITED" };
    }

    // 2. Normalização fail-closed (se inválido, retorna neutro sem vazar erro específico)
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || !isValidBrazilianPhone(cleanPhone)) {
      return { ok: true };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 3. Resolução de identidade autenticável via helper unificado
      const targetUserId = await resolveAuthenticableStaffUserByPhone(cleanPhone, supabaseAdmin);
      if (!targetUserId) {
        return { ok: true };
      }

      // 4. Resolução pontual O(1) do Auth User oficial via Admin API
      const { data: authUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

      if (userError || !authUserData?.user?.email) {
        return { ok: true };
      }

      const canonicalEmail = authUserData.user.email.trim().toLowerCase();

      // 5. Instanciação de cliente Supabase efêmero para disparo GoTrue de recuperação
      const { createClient } = await import("@supabase/supabase-js");

      const supabaseUrl =
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL;

      const supabaseAnonKey =
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return { ok: true };
      }

      const ephemeralAuthClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      // 6. Construção de URL canônica de reset de senha segura
      const appUrl =
        process.env.APP_URL ||
        process.env.VITE_APP_URL ||
        "https://barbex.shop";

      const redirectTo = `${appUrl.replace(/\/+$/, "")}/auth/reset-password`;

      const { error: resetError } = await ephemeralAuthClient.auth.resetPasswordForEmail(canonicalEmail, {
        redirectTo,
      });

      if (resetError) {
        if (resetError.status === 429 || (resetError.message && resetError.message.toLowerCase().includes("rate limit"))) {
          return { ok: false, code: "RATE_LIMITED" };
        }
      }

      return { ok: true };
    } catch {
      return { ok: true };
    }
  });
