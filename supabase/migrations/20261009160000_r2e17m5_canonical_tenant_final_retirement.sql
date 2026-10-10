-- ==============================================================================
-- BARBEX — R2E.17M.5 CANONICAL RETIREMENT & FINAL CERTIFICATION MIGRATION
-- Production Migration: 20261009160000_r2e17m5_canonical_tenant_final_retirement.sql
--
-- 1. Migrate all active business RLS policies to canonical security helpers:
--    - public.is_tenant_owner(tenant_id)
--    - public.can_access_tenant(tenant_id)
--    - public.has_tenant_role(tenant_id, role)
--    Retiring all active business dependencies on tenant_id = auth.uid().
-- 2. Retire the 8 legacy dependencies on get_my_tenant_id().
-- 3. Drop the 5 unused translation helpers (forward-only canonical architecture).
-- 4. Mark get_my_tenant_id() as deprecated compatibility with 0 internal dependencies.
-- ==============================================================================

-- 1. MIGRATE POLICIES ON ACTIVE BUSINESS TABLES

-- appointments
DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;
CREATE POLICY "Staff can update appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    public.is_tenant_owner(tenant_id)
    OR (barber_id IN (SELECT barbers.id FROM public.barbers WHERE barbers.user_id = auth.uid()))
    OR (tenant_id IN (SELECT reception_permissions.tenant_id FROM public.reception_permissions WHERE reception_permissions.user_id = auth.uid() AND reception_permissions.is_active = true))
    OR public.has_tenant_role(tenant_id, 'manager')
    OR is_super_admin_user()
  )
  WITH CHECK (
    public.is_tenant_owner(tenant_id)
    OR (barber_id IN (SELECT barbers.id FROM public.barbers WHERE barbers.user_id = auth.uid()))
    OR (tenant_id IN (SELECT reception_permissions.tenant_id FROM public.reception_permissions WHERE reception_permissions.user_id = auth.uid() AND reception_permissions.is_active = true))
    OR public.has_tenant_role(tenant_id, 'manager')
    OR is_super_admin_user()
  );

DROP POLICY IF EXISTS "Tenant can view own appointments" ON public.appointments;
CREATE POLICY "Tenant can view own appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    public.can_access_tenant(tenant_id)
    OR is_super_admin_user()
  );

-- barbers
DROP POLICY IF EXISTS "Public select for active barbers" ON public.barbers;
CREATE POLICY "Public select for active barbers" ON public.barbers
  FOR SELECT TO authenticated, anon
  USING (
    active = true
    OR public.can_access_tenant(tenant_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- customers
DROP POLICY IF EXISTS "Tenant members can view customers" ON public.customers;
CREATE POLICY "Tenant members can view customers" ON public.customers
  FOR SELECT TO authenticated
  USING (
    public.can_access_tenant(tenant_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- appointment_reviews
DROP POLICY IF EXISTS "Tenant owner can delete reviews" ON public.appointment_reviews;
CREATE POLICY "Tenant owner can delete reviews" ON public.appointment_reviews
  FOR DELETE TO authenticated
  USING (public.is_tenant_owner(tenant_id) OR is_super_admin_user());

DROP POLICY IF EXISTS "Tenant owner can read all reviews" ON public.appointment_reviews;
CREATE POLICY "Tenant owner can read all reviews" ON public.appointment_reviews
  FOR SELECT TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin_user());

DROP POLICY IF EXISTS "Tenant owner can update reviews" ON public.appointment_reviews;
CREATE POLICY "Tenant owner can update reviews" ON public.appointment_reviews
  FOR UPDATE TO authenticated
  USING (public.is_tenant_owner(tenant_id) OR is_super_admin_user())
  WITH CHECK (public.is_tenant_owner(tenant_id) OR is_super_admin_user());

-- commissions
DROP POLICY IF EXISTS "Tenant admins can manage barber commissions" ON public.barber_commissions;
CREATE POLICY "Tenant admins can manage barber commissions" ON public.barber_commissions
  FOR ALL TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin_user())
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant manages commission closings" ON public.commission_closings;
CREATE POLICY "tenant manages commission closings" ON public.commission_closings
  FOR ALL TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin_user())
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant manages commission entries" ON public.commission_entries;
CREATE POLICY "tenant manages commission entries" ON public.commission_entries
  FOR ALL TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin_user())
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_super_admin_user());

-- loyalty_settings
DROP POLICY IF EXISTS "tenant manages own loyalty settings" ON public.loyalty_settings;
CREATE POLICY "tenant manages own loyalty settings" ON public.loyalty_settings
  FOR ALL TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin_user())
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_super_admin_user());

-- payment_gateways
DROP POLICY IF EXISTS "tenant manages own payment_gateways" ON public.payment_gateways;
CREATE POLICY "tenant manages own payment_gateways" ON public.payment_gateways
  FOR ALL TO authenticated
  USING (public.is_tenant_owner(tenant_id) OR is_super_admin_user())
  WITH CHECK (public.is_tenant_owner(tenant_id) OR is_super_admin_user());

-- refund_requests
DROP POLICY IF EXISTS "Tenants can manage their own refund requests" ON public.refund_requests;
CREATE POLICY "Tenants can manage their own refund requests" ON public.refund_requests
  FOR ALL TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin_user())
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_super_admin_user());

-- subscription_plans & services
DROP POLICY IF EXISTS "tenant manages own plans" ON public.subscription_plans;
CREATE POLICY "tenant manages own plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin_user())
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant manages own plan services" ON public.subscription_plan_services;
CREATE POLICY "tenant manages own plan services" ON public.subscription_plan_services
  FOR ALL TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin_user())
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_super_admin_user());

-- tenant_addons
DROP POLICY IF EXISTS "Barbearia vê seus próprios add-ons" ON public.tenant_addons;
CREATE POLICY "Barbearia vê seus próprios add-ons" ON public.tenant_addons
  FOR SELECT TO authenticated
  USING (public.can_access_tenant(tenant_id) OR has_role(auth.uid(), 'super_admin'::app_role));

-- barbershop_modules
DROP POLICY IF EXISTS "Tenants can read their own modules" ON public.barbershop_modules;
CREATE POLICY "Tenants can read their own modules" ON public.barbershop_modules
  FOR SELECT TO authenticated
  USING (public.can_access_tenant(tenant_id) OR has_role(auth.uid(), 'super_admin'::app_role));

-- waiting_list
DROP POLICY IF EXISTS "Tenant manages waiting list" ON public.waiting_list;
CREATE POLICY "Tenant manages waiting list" ON public.waiting_list
  FOR ALL TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin_user())
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_super_admin_user());

-- payment_receipts
DROP POLICY IF EXISTS "Tenant can view own receipts" ON public.payment_receipts;
CREATE POLICY "Tenant can view own receipts" ON public.payment_receipts
  FOR SELECT TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin());

DROP POLICY IF EXISTS "Tenant can insert own receipts" ON public.payment_receipts;
CREATE POLICY "Tenant can insert own receipts" ON public.payment_receipts
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_super_admin());

DROP POLICY IF EXISTS "Tenant can update own receipts" ON public.payment_receipts;
CREATE POLICY "Tenant can update own receipts" ON public.payment_receipts
  FOR UPDATE TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin())
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_super_admin());

DROP POLICY IF EXISTS "Tenant can delete own receipts" ON public.payment_receipts;
CREATE POLICY "Tenant can delete own receipts" ON public.payment_receipts
  FOR DELETE TO authenticated
  USING (public.can_access_tenant(tenant_id) OR is_super_admin());

-- reception_permissions
DROP POLICY IF EXISTS "Owner manages reception permissions" ON public.reception_permissions;
CREATE POLICY "Owner manages reception permissions" ON public.reception_permissions
  FOR ALL TO authenticated
  USING (public.is_tenant_owner(tenant_id) OR is_super_admin_user())
  WITH CHECK (public.is_tenant_owner(tenant_id) OR is_super_admin_user());

-- barbershop_module_logs
DROP POLICY IF EXISTS "Users write module logs for own tenant" ON public.barbershop_module_logs;
CREATE POLICY "Users write module logs for own tenant" ON public.barbershop_module_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_super_admin_user());

-- profiles
DROP POLICY IF EXISTS "Profiles are viewable by owner, tenant, or super admin" ON public.profiles;
CREATE POLICY "Profiles are viewable by owner, tenant, or super admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = id)
    OR is_super_admin_user()
    OR (tenant_id IS NOT NULL AND public.can_access_tenant(tenant_id))
  );

-- 2. DROP 5 UNUSED TRANSLATION HELPERS (FORWARD-ONLY MIGRATION)
DROP FUNCTION IF EXISTS public.canonical_tenant_to_operational_scope(uuid);
DROP FUNCTION IF EXISTS public.canonical_tenant_to_legacy_scope(uuid);
DROP FUNCTION IF EXISTS public.operational_scope_to_canonical_tenant(uuid);
DROP FUNCTION IF EXISTS public.legacy_scope_to_canonical_tenant(uuid);
DROP FUNCTION IF EXISTS public.resolve_operational_scope(uuid);

-- 3. PRESERVE get_my_tenant_id AS DEPRECATED COMPATIBILITY (0 INTERNAL DEPENDENCIES)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  -- DEPRECATED: Retained for external compatibility only. Zero internal database dependencies.
  SELECT tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
$function$;
