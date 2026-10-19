-- BARBEX — R2E.22D.1
-- ROLLBACK SCRIPT FOR MIGRATION 20261020110000 (TENANT FAQ SYSTEM)
-- Isolated rollback outside supabase/migrations directory

BEGIN;

-- 1. Remover triggers associados à tabela barbershop_faqs
DROP TRIGGER IF EXISTS trg_enforce_tenant_faqs ON public.barbershop_faqs;
DROP TRIGGER IF EXISTS update_barbershop_faqs_updated_at ON public.barbershop_faqs;

-- 2. Remover índices associados (são removidos automaticamente com o DROP TABLE, mas especificados para idoneidade)
DROP INDEX IF EXISTS public.idx_barbershop_faqs_tenant_order;
DROP INDEX IF EXISTS public.idx_barbershop_faqs_public_read;

-- 3. Remover tabela public.barbershop_faqs
DROP TABLE IF EXISTS public.barbershop_faqs CASCADE;

-- 4. Remover coluna faq_enabled de public.profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS faq_enabled;

-- 5. Remover registro da migration no schema_migrations se presente de forma resiliente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261020110000';
  END IF;
END $$;

COMMIT;
