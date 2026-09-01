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
 * Server Function: Autenticação de colaboradores via Telefone + Senha
 *
 * Fluxo de execução estritamente server-side:
 * 1. Normaliza e valida o telefone no padrão E.164 canônico brasileiro (55XXXXXXXXXXX)
 * 2. Consulta public.profiles de forma restrita a papéis de staff/administração
 * 3. Resolve pontualmente (O(1)) o usuário e e-mail canônico no auth.users via supabaseAdmin
 * 4. Executa autenticação GoTrue signInWithPassword através de cliente efêmero isolado
 * 5. Retorna DTO mínimo de sessão sem vazar e-mails, telefones ou detalhes internos
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

    // 1. Normalização determinística e validação fail-closed de formato
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || !isValidBrazilianPhone(cleanPhone)) {
      return { ok: false, code: "INVALID_CREDENTIALS" };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 2. Lookup no banco: busca em profiles tolerando variações legadas de prefixo nacional
      const phoneCandidates = [cleanPhone];
      if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
        phoneCandidates.push(cleanPhone.slice(2));
      }

      let targetUserId: string | null = null;

      const { data: matchedProfiles, error: lookupError } = await supabaseAdmin
        .from("profiles")
        .select("id, role")
        .in("phone", phoneCandidates)
        .not("phone", "is", null)
        .neq("phone", "")
        .in("role", AUTHENTICABLE_STAFF_ROLES as unknown as string[]);

      if (lookupError) {
        return { ok: false, code: "SERVICE_UNAVAILABLE" };
      }

      if (matchedProfiles && matchedProfiles.length === 1 && matchedProfiles[0]?.id) {
        targetUserId = matchedProfiles[0].id;
      } else if (matchedProfiles && matchedProfiles.length > 1) {
        // Ambiguidade detectada em profiles: encerra por segurança
        return { ok: false, code: "INVALID_CREDENTIALS" };
      } else {
        // Fallback para tabela barbers (onde telefones de profissionais residem historicamente)
        const { data: matchedBarbers, error: barberLookupError } = await supabaseAdmin
          .from("barbers")
          .select("id, user_id, active")
          .in("phone", phoneCandidates)
          .eq("active", true)
          .not("user_id", "is", null);

        if (barberLookupError) {
          return { ok: false, code: "SERVICE_UNAVAILABLE" };
        }

        if (matchedBarbers && matchedBarbers.length === 1 && matchedBarbers[0]?.user_id) {
          const barberUserId = matchedBarbers[0].user_id;

          // Valida que o perfil do usuário possui papel de staff autenticável
          const { data: barberProfile, error: bProfError } = await supabaseAdmin
            .from("profiles")
            .select("id, role")
            .eq("id", barberUserId)
            .in("role", AUTHENTICABLE_STAFF_ROLES as unknown as string[])
            .maybeSingle();

          if (bProfError || !barberProfile?.id) {
            return { ok: false, code: "INVALID_CREDENTIALS" };
          }

          targetUserId = barberProfile.id;
        } else {
          return { ok: false, code: "INVALID_CREDENTIALS" };
        }
      }

      if (!targetUserId) {
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      // 3. Resolução pontual O(1) do Auth User oficial via Admin API
      const { data: authUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

      if (userError || !authUserData?.user?.email) {
        return { ok: false, code: "INVALID_CREDENTIALS" };
      }

      const canonicalEmail = authUserData.user.email.trim().toLowerCase();

      // 4. Instanciação de cliente Supabase efêmero e isolado para GoTrue sign-in
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

      // 5. Autenticação oficial de credenciais contra GoTrue
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

      // 6. Retorno de DTO estrito e sanitizado
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
