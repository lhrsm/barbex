-- ====================================================================
-- BARBEX — R2E.22B.2
-- ROLLBACK SCRIPT FOR: 20261020100000_r2e22_b2_multitenancy_backend_hardening.sql
-- ====================================================================

BEGIN;

-- 1. Rollback barber_services trigger & policies
DROP TRIGGER IF EXISTS trg_check_barber_service_tenant ON public.barber_services;
DROP FUNCTION IF EXISTS public.trg_validate_barber_service_tenant_consistency();

DROP POLICY IF EXISTS "authenticated_manage_barber_services" ON public.barber_services;
CREATE POLICY "authenticated_manage_barber_services" ON public.barber_services
  FOR ALL TO authenticated
  USING (((auth.uid() = user_id) OR (auth.uid() = tenant_id)))
  WITH CHECK (((auth.uid() = user_id) OR (auth.uid() = tenant_id)));

-- 2. Rollback products RLS policies
DROP POLICY IF EXISTS "Authorized staff can insert products" ON public.products;
DROP POLICY IF EXISTS "Authorized staff can update products" ON public.products;
DROP POLICY IF EXISTS "Authorized staff can delete products" ON public.products;

CREATE POLICY "Users can create their own products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update their own products" ON public.products
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can delete their own products" ON public.products
  FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

COMMIT;
