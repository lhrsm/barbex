-- ==============================================================================
-- BARBEX — R2E.17M.4 RESIDUAL CANONICAL HARDENING MIGRATION
-- Production Migration: 20261009150000_r2e17m4_residual_canonical_hardening.sql
--
-- 1. Correct tg_admin_notify_new_tenant() column reference (NEW.business_name).
-- 2. Restore on_auth_user_created trigger on auth.users -> public.handle_new_user().
-- 3. Add canonical FKs from unconstrained operational business tables to public.barbershops(id):
--    - appointment_reviews (tenant_id -> barbershops.id)
--    - subscription_plans (tenant_id -> barbershops.id)
--    - subscription_plan_services (tenant_id -> barbershops.id)
--    - saas_checkout_sessions (tenant_id -> barbershops.id)
-- 4. Harden RLS policies using canonical helper public.can_access_tenant(tenant_id).
-- ==============================================================================

-- 1. FIX TRIGGER FUNCTION tg_admin_notify_new_tenant
CREATE OR REPLACE FUNCTION public.tg_admin_notify_new_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_name text;
BEGIN
  IF NEW.role IS DISTINCT FROM 'super_admin' AND NEW.tenant_id IS NOT NULL THEN
    v_name := COALESCE(NEW.business_name, NEW.display_name, NEW.email, 'Nova barbearia');
    PERFORM public.create_admin_notification(
      'new_tenant', 'Nova barbearia cadastrada',
      v_name || ' iniciou teste grátis no Barbex.',
      NEW.tenant_id, NEW.id, 'profile', NEW.id, '/admin/tenants', 'normal'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 2. RESTORE on_auth_user_created TRIGGER ON auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. HARDEN RESIDUAL BUSINESS FOREIGN KEYS TO public.barbershops(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_reviews_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.appointment_reviews
      ADD CONSTRAINT appointment_reviews_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plan_services_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.subscription_plan_services
      ADD CONSTRAINT subscription_plan_services_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saas_checkout_sessions_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.saas_checkout_sessions
      ADD CONSTRAINT saas_checkout_sessions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);
  END IF;
END $$;

-- 4. HARDEN RLS ON RESIDUAL BUSINESS TABLES
DROP POLICY IF EXISTS "Canonical tenant access for appointment_reviews" ON public.appointment_reviews;
CREATE POLICY "Canonical tenant access for appointment_reviews"
  ON public.appointment_reviews
  FOR ALL
  TO authenticated
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Canonical tenant access for subscription_plans" ON public.subscription_plans;
CREATE POLICY "Canonical tenant access for subscription_plans"
  ON public.subscription_plans
  FOR ALL
  TO authenticated
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Canonical tenant access for subscription_plan_services" ON public.subscription_plan_services;
CREATE POLICY "Canonical tenant access for subscription_plan_services"
  ON public.subscription_plan_services
  FOR ALL
  TO authenticated
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Canonical tenant access for tenant_addons" ON public.tenant_addons;
CREATE POLICY "Canonical tenant access for tenant_addons"
  ON public.tenant_addons
  FOR ALL
  TO authenticated
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));
