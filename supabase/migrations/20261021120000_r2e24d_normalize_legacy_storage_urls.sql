-- ==============================================================================
-- BARBEX — R2E.24D: NORMALIZE LEGACY STORAGE URLS
-- Replaces legacy Supabase project ref with active production project ref
-- Safe, idempotent, non-destructive to existing paths
-- ==============================================================================

DO $$
BEGIN
  -- 1. Profiles
  UPDATE public.profiles
  SET pix_qr_code_url = REPLACE(pix_qr_code_url, 'wdxhjwodyctgzqtogkgv.supabase.co', 'ywdwrstxvsdqiryhieiz.supabase.co')
  WHERE pix_qr_code_url LIKE '%wdxhjwodyctgzqtogkgv.supabase.co%';

  UPDATE public.profiles
  SET avatar_url = REPLACE(avatar_url, 'wdxhjwodyctgzqtogkgv.supabase.co', 'ywdwrstxvsdqiryhieiz.supabase.co')
  WHERE avatar_url LIKE '%wdxhjwodyctgzqtogkgv.supabase.co%';

  UPDATE public.profiles
  SET logo_url = REPLACE(logo_url, 'wdxhjwodyctgzqtogkgv.supabase.co', 'ywdwrstxvsdqiryhieiz.supabase.co')
  WHERE logo_url LIKE '%wdxhjwodyctgzqtogkgv.supabase.co%';

  UPDATE public.profiles
  SET barbershop_logo_url = REPLACE(barbershop_logo_url, 'wdxhjwodyctgzqtogkgv.supabase.co', 'ywdwrstxvsdqiryhieiz.supabase.co')
  WHERE barbershop_logo_url LIKE '%wdxhjwodyctgzqtogkgv.supabase.co%';

  -- 2. Customers
  UPDATE public.customers
  SET avatar_url = REPLACE(avatar_url, 'wdxhjwodyctgzqtogkgv.supabase.co', 'ywdwrstxvsdqiryhieiz.supabase.co')
  WHERE avatar_url LIKE '%wdxhjwodyctgzqtogkgv.supabase.co%';

  -- 3. Barbers
  UPDATE public.barbers
  SET avatar_url = REPLACE(avatar_url, 'wdxhjwodyctgzqtogkgv.supabase.co', 'ywdwrstxvsdqiryhieiz.supabase.co')
  WHERE avatar_url LIKE '%wdxhjwodyctgzqtogkgv.supabase.co%';

  UPDATE public.barbers
  SET pix_qr_code_url = REPLACE(pix_qr_code_url, 'wdxhjwodyctgzqtogkgv.supabase.co', 'ywdwrstxvsdqiryhieiz.supabase.co')
  WHERE pix_qr_code_url LIKE '%wdxhjwodyctgzqtogkgv.supabase.co%';
END $$;
