-- Migration: 20260930150000_r2e13g5a_capability_enforcement_convergence.sql
-- Phase: R2E.13G.5A — Capability Enforcement Convergence
-- Summary:
-- 1. Refactor public.has_module_access(_user_id uuid, _module_key text) in place into canonical fail-closed resolver honoring barbershop_modules.enabled (tenant override)
-- 2. Restrict public.barbershop_modules to deny direct tenant mutations (Super Admin management only, tenant SELECT only)
-- 3. Add RESTRICTIVE capability RLS policies to campaigns, automations, and tenant_integrations

BEGIN;

-- 1. CANONICAL CAPABILITY RESOLVER (REPLACE IN PLACE WITHOUT DROPPING TO PRESERVE DEPENDENT POLICIES)
CREATE OR REPLACE FUNCTION public.has_module_access(
  _user_id uuid,
  _module_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_plan_slug text;
  v_allowed jsonb;
  v_bshop_plan_id uuid;
  v_override_enabled boolean;
BEGIN
  -- 1. Input sanity check (fail-closed)
  IF _user_id IS NULL OR _module_key IS NULL OR length(trim(_module_key)) = 0 THEN
    RETURN false;
  END IF;

  -- 2. Super admin bypass
  BEGIN
    IF public.is_super_admin_user() THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 3. Unknown module fail-closed
  -- Validate against canonical module catalog
  IF _module_key NOT IN (
    -- Always on core modules
    'dashboard', 'calendar', 'customers', 'barbers', 'services', 'finances', 'settings',
    -- Starter modules
    'basic_finance', 'client_portal', 'barber_panel', 'reports_basic', 'whatsapp', 'automations_basic', 'support', 'portal',
    -- Pro modules
    'advanced_finance', 'reports_advanced', 'dashboard_advanced', 'automations_smart', 'stock', 'coupons', 'cashback', 'loyalty', 'products', 'store', 'subscriptions', 'subscription_rewards', 'payment_gateway', 'commissions', 'campaigns',
    -- Elite / Enterprise modules
    'automations_unlimited', 'ai', 'api', 'api_access', 'integrations', 'white_label', 'multi_units', 'corporate_reports', 'tutorials', 'pix_key',
    'ai_scheduler', 'ai_commercial', 'ai_recovery', 'ai_products', 'ai_subscriptions', 'ai_smart_replies', 'ai_campaigns', 'ai_loyalty', 'ai_whatsapp', 'ai_google_reviews', 'ai_upsell', 'ai_cross_sell',
    'automations', 'integrations_center', 'communications'
  ) THEN
    RETURN false;
  END IF;

  -- 4. Always-on core modules are unconditionally entitled at capability dimension
  -- (Suspension, auth, and role checks remain enforced independently by their respective layers)
  IF _module_key IN ('dashboard', 'calendar', 'customers', 'barbers', 'services', 'finances', 'settings') THEN
    RETURN true;
  END IF;

  -- 5. Resolve canonical tenant ID using canonical G.2 resolution
  BEGIN
    v_tenant_id := public.resolve_canonical_tenant_id(_user_id, _user_id);
  EXCEPTION WHEN OTHERS THEN
    SELECT pr.tenant_id INTO v_tenant_id
      FROM public.profiles pr
     WHERE pr.id = _user_id;
    IF v_tenant_id IS NULL THEN
      v_tenant_id := _user_id;
    END IF;
  END;

  -- 6. Check tenant suspension (G.2 priority: suspended tenants have capabilities denied)
  BEGIN
    IF NOT public.is_tenant_operational(v_tenant_id, _user_id) THEN
      RETURN false;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = v_tenant_id AND status IN ('blocked', 'suspended', 'inactive')
    ) THEN
      RETURN false;
    END IF;
  END;

  -- 7. Administrative voucher check (active internal voucher bypass)
  BEGIN
    IF public.has_active_internal_voucher(_user_id) OR public.has_active_internal_voucher(v_tenant_id) THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 8. Tenant disable override check
  -- If explicitly marked enabled = false in barbershop_modules, DENY regardless of plan!
  SELECT enabled INTO v_override_enabled
    FROM public.barbershop_modules
   WHERE tenant_id = v_tenant_id AND module_key = _module_key;

  IF v_override_enabled IS FALSE THEN
    RETURN false;
  END IF;

  -- 9. Commercial Add-On check
  -- Active commercial add-on in tenant_addons grants access
  IF EXISTS (
    SELECT 1
      FROM public.tenant_addons ta
      JOIN public.saas_addons sa ON sa.id = ta.addon_id
     WHERE (ta.tenant_id = v_tenant_id OR ta.tenant_id = _user_id)
       AND (sa.module_key = _module_key OR sa.addon_key = _module_key)
       AND ta.status IN ('active', 'trialing', 'past_due')
       AND (ta.current_period_end IS NULL OR ta.current_period_end > now())
  ) THEN
    RETURN true;
  END IF;

  -- 10. Plan entitlement check
  -- Resolve plan via profiles.effective_plan / profiles.plan
  SELECT lower(coalesce(nullif(pr.effective_plan, ''), nullif(pr.plan, '')))
    INTO v_plan_slug
    FROM public.profiles pr
   WHERE pr.id = v_tenant_id OR pr.id = _user_id
   ORDER BY (pr.id = v_tenant_id) DESC
   LIMIT 1;

  IF v_plan_slug IS NOT NULL THEN
    SELECT allowed_modules INTO v_allowed
      FROM public.plans
     WHERE slug = v_plan_slug AND active = true;

    IF v_allowed IS NOT NULL AND v_allowed ? _module_key THEN
      RETURN true;
    END IF;
  END IF;

  -- Fallback via barbershops.plan_id
  SELECT plan_id INTO v_bshop_plan_id
    FROM public.barbershops
   WHERE id = v_tenant_id;

  IF v_bshop_plan_id IS NOT NULL THEN
    SELECT allowed_modules INTO v_allowed
      FROM public.plans
     WHERE id = v_bshop_plan_id AND active = true;

    IF v_allowed IS NOT NULL AND v_allowed ? _module_key THEN
      RETURN true;
    END IF;
  END IF;

  -- If not in plan and no active add-on, deny (tenant override cannot escalate plan)
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  -- Fail-closed
  RETURN false;
END;
$$;

-- 2. PRIVILEGES ON CANONICAL RESOLVER
REVOKE ALL ON FUNCTION public.has_module_access(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_module_access(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, text) TO service_role;

-- 3. REMOVE DIRECT TENANT MUTATION ON barbershop_modules
-- Ensure table-level permissions allow authenticated role so RLS controls access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbershop_modules TO authenticated;
GRANT ALL ON public.barbershop_modules TO service_role;

DROP POLICY IF EXISTS "Tenants manage their own modules" ON public.barbershop_modules;
DROP POLICY IF EXISTS "Tenants can read their own modules" ON public.barbershop_modules;
DROP POLICY IF EXISTS "Super admins can manage barbershop modules" ON public.barbershop_modules;

CREATE POLICY "Tenants can read their own modules"
ON public.barbershop_modules
FOR SELECT
TO authenticated
USING (
  tenant_id = auth.uid() 
  OR tenant_id IN (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "Super admins can manage barbershop modules"
ON public.barbershop_modules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 4. RESTRICTIVE CAPABILITY RLS POLICIES ON CAMPAIGNS
DROP POLICY IF EXISTS "require_module_campaigns_insert" ON public.campaigns;
CREATE POLICY "require_module_campaigns_insert"
ON public.campaigns AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_module_access(auth.uid(), 'campaigns'));

DROP POLICY IF EXISTS "require_module_campaigns_update" ON public.campaigns;
CREATE POLICY "require_module_campaigns_update"
ON public.campaigns AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.has_module_access(auth.uid(), 'campaigns'))
WITH CHECK (public.has_module_access(auth.uid(), 'campaigns'));

DROP POLICY IF EXISTS "require_module_campaigns_delete" ON public.campaigns;
CREATE POLICY "require_module_campaigns_delete"
ON public.campaigns AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.has_module_access(auth.uid(), 'campaigns'));

-- 5. RESTRICTIVE CAPABILITY RLS POLICIES ON AUTOMATIONS
DROP POLICY IF EXISTS "require_module_automations_insert" ON public.automations;
CREATE POLICY "require_module_automations_insert"
ON public.automations AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_module_access(auth.uid(), 'automations'));

DROP POLICY IF EXISTS "require_module_automations_update" ON public.automations;
CREATE POLICY "require_module_automations_update"
ON public.automations AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.has_module_access(auth.uid(), 'automations'))
WITH CHECK (public.has_module_access(auth.uid(), 'automations'));

DROP POLICY IF EXISTS "require_module_automations_delete" ON public.automations;
CREATE POLICY "require_module_automations_delete"
ON public.automations AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.has_module_access(auth.uid(), 'automations'));

-- 6. RESTRICTIVE CAPABILITY RLS POLICIES ON TENANT_INTEGRATIONS
DROP POLICY IF EXISTS "require_module_integrations_insert" ON public.tenant_integrations;
CREATE POLICY "require_module_integrations_insert"
ON public.tenant_integrations AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_module_access(auth.uid(), 'integrations'));

DROP POLICY IF EXISTS "require_module_integrations_update" ON public.tenant_integrations;
CREATE POLICY "require_module_integrations_update"
ON public.tenant_integrations AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.has_module_access(auth.uid(), 'integrations'))
WITH CHECK (public.has_module_access(auth.uid(), 'integrations'));

DROP POLICY IF EXISTS "require_module_integrations_delete" ON public.tenant_integrations;
CREATE POLICY "require_module_integrations_delete"
ON public.tenant_integrations AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.has_module_access(auth.uid(), 'integrations'));

COMMIT;
