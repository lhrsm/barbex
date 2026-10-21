/**
 * Utilitários para normalização e sanitização de URLs do Supabase Storage.
 * Garante que URLs persistidas com hostnames legados (ex: wdxhjwodyctgzqtogkgv)
 * sejam reescritas dinamicamente para o hostname de produção atual (ywdwrstxvsdqiryhieiz)
 * ou para o Supabase URL configurado no ambiente.
 */

function getCanonicalSupabaseHost(): string {
  try {
    const envUrl = typeof window !== 'undefined' 
      ? (import.meta as any)?.env?.VITE_SUPABASE_URL 
      : (typeof process !== 'undefined' ? process.env?.SUPABASE_URL : undefined);
    if (envUrl) {
      return new URL(envUrl).host;
    }
  } catch {}
  return 'ywdwrstxvsdqiryhieiz.supabase.co';
}

const CANONICAL_SUPABASE_HOST = getCanonicalSupabaseHost();
const LEGACY_SUPABASE_HOSTS = [
  'wdxhjwodyctgzqtogkgv.supabase.co',
];

/**
 * Normaliza uma URL individual do Supabase Storage, substituindo hostnames legados.
 */
export function normalizeStorageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  
  let normalized = url.trim();
  for (const legacyHost of LEGACY_SUPABASE_HOSTS) {
    if (normalized.includes(legacyHost)) {
      normalized = normalized.replace(legacyHost, CANONICAL_SUPABASE_HOST);
    }
  }
  return normalized;
}

/**
 * Normaliza uma lista de URLs (ex: gallery_images).
 */
export function normalizeStorageUrls(urls: any): string[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map(normalizeStorageUrl);
}

/**
 * Resolve o logotipo prioritário da barbearia com normalização de storage.
 */
export function resolveBarbershopLogo(shop: any, barbershopEntity?: any): string {
  const candidate = 
    shop?.barbershop_logo_url || 
    shop?.logo_url || 
    barbershopEntity?.logo_url || 
    shop?.avatar_url || 
    '';
  return normalizeStorageUrl(candidate);
}
