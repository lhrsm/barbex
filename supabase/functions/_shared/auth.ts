/**
 * BARBEX SUPABASE EDGE FUNCTIONS — AUTHENTICATION & SESSION VERIFICATION
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { EdgeError } from "./errors.ts";
import { getRequiredEnv } from "./env.ts";
import { UserContext } from "./types.ts";
import { createAdminClient } from "./supabase-admin.ts";

/**
 * Extracts Bearer token from Request Authorization header.
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Creates a user-scoped Supabase client that respects RLS.
 */
export function createUserClient(token: string): SupabaseClient {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Verifies the JWT Bearer token and returns the authenticated user context.
 */
export async function verifyUserSession(req: Request): Promise<UserContext> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new EdgeError(
      "UNAUTHORIZED",
      "Token de autenticação ausente ou inválido.",
      401
    );
  }

  const adminClient = createAdminClient();
  const { data: { user }, error } = await adminClient.auth.getUser(token);

  if (error || !user) {
    throw new EdgeError(
      "UNAUTHORIZED",
      "Sessão expirada ou não autorizada.",
      401
    );
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role
  };
}

/**
 * Resolves user tenant ID and role from profiles table.
 */
export async function resolveUserTenantAndRole(userId: string): Promise<{ tenantId: string | null; role: string | null }> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return { tenantId: null, role: null };
  }

  return {
    tenantId: data.tenant_id || data.id,
    role: data.role || null
  };
}
