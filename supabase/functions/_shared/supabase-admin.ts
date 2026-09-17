/**
 * BARBEX SUPABASE EDGE FUNCTIONS — SUPABASE ADMIN CLIENT INSTANTIATION
 * Edge/Deno compatible via esm.sh
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { getRequiredEnv } from "./env.ts";

let adminClientInstance: SupabaseClient | null = null;

/**
 * Creates or returns a singleton privileged admin client using SUPABASE_SERVICE_ROLE_KEY.
 * Never export or log the service_role key.
 */
export function createAdminClient(): SupabaseClient {
  if (adminClientInstance) {
    return adminClientInstance;
  }

  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  adminClientInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  return adminClientInstance;
}
