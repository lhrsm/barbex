// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseAdminClient() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_URL = rawUrl?.trim();
  
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_SERVICE_ROLE_KEY = rawKey?.trim()?.replace(/^["']/, '')?.replace(/["']$/, '');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ];
    const message = `Configuração do Supabase ausente no servidor: ${missing.join(', ')}. Verifique as variáveis de ambiente.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  // Verificação defensiva de chave demo em ambiente de produção
  if (process.env.NODE_ENV === 'production' && SUPABASE_SERVICE_ROLE_KEY.includes('supabase-demo')) {
    console.error('[Supabase Admin] ALERTA CRÍTICO: SUPABASE_SERVICE_ROLE_KEY contém chave demo local em produção.');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// Server-side Supabase client with service role - bypasses RLS
// SECURITY: Only use this for trusted server-side operations, never expose to client code
// Import like: import { supabaseAdmin } from "@/integrations/supabase/client.server";
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
