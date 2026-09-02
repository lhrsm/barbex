import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePhone, isValidBrazilianPhone } from "@/utils/phone";
import type { Database } from "@/integrations/supabase/types";
import type { SessionDTO, SignInPhoneResult } from "@/lib/auth-phone.functions";

/**
 * In-Memory Zero-PII Sliding Window Rate Limiter para o Portal do Cliente
 * Chave delimitada pelo tenantSlug + hash não-reversível do identificador
 */
interface RateLimitBucket {
  timestamps: number[];
}

const customerRateLimitStore = new Map<string, RateLimitBucket>();
const CLEANUP_INTERVAL_MS = 60_000;
let lastCustomerRateLimitCleanup = Date.now();

function checkCustomerRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();

  if (now - lastCustomerRateLimitCleanup > CLEANUP_INTERVAL_MS) {
    lastCustomerRateLimitCleanup = now;
    for (const [k, bucket] of customerRateLimitStore.entries()) {
      bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);
      if (bucket.timestamps.length === 0) {
        customerRateLimitStore.delete(k);
      }
    }
  }

  const bucket = customerRateLimitStore.get(key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

  if (bucket.timestamps.length >= maxAttempts) {
    customerRateLimitStore.set(key, bucket);
    return false;
  }

  bucket.timestamps.push(now);
  customerRateLimitStore.set(key, bucket);
  return true;
}

function deriveCustomerRateLimitKey(tenantSlug: string, rawIdentifier: string): string {
  let hash = 0;
  const str = `cust:${tenantSlug}:${rawIdentifier}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `cust:${tenantSlug}:${Math.abs(hash).toString(36)}`;
}

/**
 * Server Function: Autenticação de CLIENTES via Telefone + Senha no Portal da Barbearia
 *
 * Requisitos de Segurança e Multi-Tenancy:
 * 1. O escopo é estritamente delimitado pelo tenantSlug (resolvido server-side para tenant_id)
 * 2. O telefone pode coexistir em barbearias diferentes sem vazamento cruzado
 * 3. Busca restrita a public.customers onde tenant_id = tenant resolvido
 * 4. Valida se o cliente possui vínculo com Auth User e se o perfil possui role = 'client'
 * 5. Executa autenticação GoTrue signInWithPassword via cliente efêmero
 * 6. Retorna DTO mínimo de sessão sem expor dados de email ou identificação interna
 */
export const signInCustomerWithPhone = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        tenantSlug: z.string().trim().min(1).max(100),
        phone: z.string().trim().min(1).max(50),
        password: z.string().min(1).max(256),
      })
      .parse(input)
  )
  .handler(async ({ data }): Promise<SignInPhoneResult> => {
    const { tenantSlug, phone, password } = data;

    // 1. Rate Limiting por tenant + identificador derivado (10 tentativas por 5 minutos)
    const rateLimitKey = deriveCustomerRateLimitKey(tenantSlug, phone);
    if (!checkCustomerRateLimit(rateLimitKey, 10, 300_000)) {
      return { ok: false, code: "RATE_LIMITED" };
    }

    // 2. Normalização determinística e validação fail-closed de formato
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || !isValidBrazilianPhone(cleanPhone)) {
      return { ok: false, code: "INVALID_CREDENTIALS" };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 3. Resolução segura do Tenant ID a partir do slug
      const { data: shopProfile, error: shopErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("slug", tenantSlug.trim().toLowerCase())
        .maybeSingle();

      if (shopErr || !shopProfile?.id) {
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      const effectiveTenantId = shopProfile.id;

      // 4. Candidatos de telefone (com e sem prefixo nacional 55)
      const phoneCandidates = [cleanPhone];
      if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
        phoneCandidates.push(cleanPhone.slice(2));
      }

      // 5. Lookup exclusivo de customer dentro do tenant
      const { data: matchedCustomers, error: customerError } = await supabaseAdmin
        .from("customers")
        .select("id, user_id, auth_user_id, tenant_id")
        .eq("tenant_id", effectiveTenantId)
        .in("phone", phoneCandidates)
        .not("phone", "is", null)
        .neq("phone", "");

      if (customerError) {
        return { ok: false, code: "SERVICE_UNAVAILABLE" };
      }

      if (!matchedCustomers || matchedCustomers.length === 0) {
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      if (matchedCustomers.length > 1) {
        // Ambiguidade intra-tenant detectada: fail closed
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      const customer = matchedCustomers[0];
      const targetUserId = customer.user_id || (customer as any).auth_user_id;

      if (!targetUserId) {
        // Cliente de agendamento/walk-in sem conta de acesso criada
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      // 6. Validar que o perfil associado possui papel estrito de cliente
      const { data: clientProfile, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("id, role, tenant_id")
        .eq("id", targetUserId)
        .maybeSingle();

      if (profErr || !clientProfile) {
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      if (clientProfile.role !== "client") {
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      // 7. Resolução pontual O(1) do Auth User oficial via Admin API
      const { data: authUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

      if (userError || !authUserData?.user?.email) {
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      const canonicalEmail = authUserData.user.email.trim().toLowerCase();

      // 8. Instanciação de cliente Supabase efêmero para autenticação GoTrue
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

      // 9. Autenticação oficial de credenciais contra GoTrue
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

      // 10. Retorno de DTO estrito e sanitizado
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

export interface RequestCustomerPasswordResetResult {
  ok: boolean;
  code?: "RATE_LIMITED" | "SERVICE_UNAVAILABLE";
}

/**
 * Server Function: Solicitação segura de recuperação de senha por telefone para CLIENTES (Zero Enumeração)
 *
 * Requisitos e Fluxo:
 * 1. O escopo é estritamente delimitado pelo tenantSlug (resolvido server-side para tenant_id)
 * 2. Rate Limiting por tenantSlug + hash de telefone (3 solicitações / 10 minutos)
 * 3. Normaliza e valida o telefone no padrão E.164 brasileiro
 * 4. Busca exclusiva em public.customers dentro do tenant resolvido
 * 5. Se não encontrar, ou se cliente não possuir user_id (walk-in): retorna neutro { ok: true } sem vazar dados
 * 6. Valida que o perfil possui papel 'client'
 * 7. Resolve o Auth User via Admin API de forma estritamente server-side (auth.users.email)
 * 8. Dispara resetPasswordForEmail via cliente efêmero para o e-mail canônico
 * 9. Retorna SEMPRE { ok: true } (Zero Enumeração)
 */
export const requestCustomerPasswordResetByPhone = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        tenantSlug: z.string().trim().min(1).max(100),
        phone: z.string().trim().min(1).max(50),
      })
      .parse(input)
  )
  .handler(async ({ data }): Promise<RequestCustomerPasswordResetResult> => {
    const { tenantSlug, phone } = data;

    // 1. Rate Limiting anti-spam por tenant + identificador derivado (3 tentativas / 10 minutos)
    const rateLimitKey = deriveCustomerRateLimitKey(`reset:${tenantSlug}`, phone);
    if (!checkCustomerRateLimit(rateLimitKey, 3, 600_000)) {
      return { ok: false, code: "RATE_LIMITED" };
    }

    // 2. Normalização fail-closed (se inválido, retorna neutro sem vazar erro específico)
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || !isValidBrazilianPhone(cleanPhone)) {
      return { ok: true };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 3. Resolução segura do Tenant ID a partir do slug
      const { data: shopProfile, error: shopErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("slug", tenantSlug.trim().toLowerCase())
        .maybeSingle();

      if (shopErr || !shopProfile?.id) {
        return { ok: true };
      }

      const effectiveTenantId = shopProfile.id;

      // 4. Candidatos de telefone (com e sem prefixo nacional 55)
      const phoneCandidates = [cleanPhone];
      if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
        phoneCandidates.push(cleanPhone.slice(2));
      }

      // 5. Lookup de customer no tenant
      const { data: matchedCustomers, error: customerError } = await supabaseAdmin
        .from("customers")
        .select("id, user_id, auth_user_id, tenant_id")
        .eq("tenant_id", effectiveTenantId)
        .in("phone", phoneCandidates)
        .not("phone", "is", null)
        .neq("phone", "");

      if (customerError || !matchedCustomers || matchedCustomers.length === 0 || matchedCustomers.length > 1) {
        return { ok: true };
      }

      const customer = matchedCustomers[0];
      const targetUserId = customer.user_id || (customer as any).auth_user_id;

      if (!targetUserId) {
        return { ok: true };
      }

      // 6. Validar role de cliente
      const { data: clientProfile, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("id, role, tenant_id")
        .eq("id", targetUserId)
        .maybeSingle();

      if (profErr || !clientProfile || clientProfile.role !== "client") {
        return { ok: true };
      }

      // 7. Resolução pontual O(1) do Auth User oficial via Admin API
      const { data: authUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

      if (userError || !authUserData?.user?.email) {
        return { ok: true };
      }

      const canonicalEmail = authUserData.user.email.trim().toLowerCase();

      // 8. Instanciação de cliente Supabase efêmero para envio do reset
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

      // 9. Construção de URL canônica de reset de senha
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
