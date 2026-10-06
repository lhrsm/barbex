-- ============================================================================
-- BARBEX — R2E.16B: ADD-ON FOUNDATION CONVERGENCE & POLICY FREEZE
-- Canonical Catalog, Entitlement Resolution, Grace Linkage & Webhook Convergence
-- Idempotent, forward-only, non-destructive migration
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. EXTEND saas_addons SCHEMA (P2-A & Policy Model)
-- ----------------------------------------------------------------------------

-- Add canonical_module_key referencing platform_module_availability(module_key)
ALTER TABLE public.saas_addons
  ADD COLUMN IF NOT EXISTS canonical_module_key TEXT REFERENCES public.platform_module_availability(module_key) ON UPDATE CASCADE ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS eligible_plan_keys TEXT[] NOT NULL DEFAULT ARRAY['starter', 'pro', 'elite']::TEXT[],
  ADD COLUMN IF NOT EXISTS stripe_price_id_annual_test TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id_annual_live TEXT;

CREATE INDEX IF NOT EXISTS idx_saas_addons_canonical_module ON public.saas_addons(canonical_module_key);
CREATE INDEX IF NOT EXISTS idx_saas_addons_active ON public.saas_addons(is_active);

-- ----------------------------------------------------------------------------
-- 2. CONVERGE EXISTING 17 ROWS & SEED CANDIDATES (Non-destructive)
-- ----------------------------------------------------------------------------

-- Upsert Canonical Add-on Candidates (preserving existing records in production or inserting in fresh environments)
INSERT INTO public.saas_addons (
  addon_key, name, description, category, icon, module_key, canonical_module_key,
  monthly_price, annual_price, currency, eligible_plan_keys, is_active, sort_order
) VALUES
  ('stock', 'Controle de Estoque', 'Gerencie entrada, saída e alertas de estoque de produtos.', 'gestao', 'Package', 'stock', 'stock', 14.90, 149.00, 'BRL', ARRAY['starter', 'pro']::TEXT[], false, 20),
  ('advanced_finance', 'Financeiro Avançado', 'DRE, fluxo de caixa projetado, categorias e comparativos.', 'financeiro', 'TrendingUp', 'advanced_finance', 'advanced_finance', 24.90, 249.00, 'BRL', ARRAY['starter']::TEXT[], false, 70),
  ('reports_advanced', 'Relatórios Avançados', 'Dashboards executivos, análise de barbeiros e retenção.', 'gestao', 'BarChart3', 'reports_advanced', 'reports_advanced', 19.90, 199.00, 'BRL', ARRAY['starter']::TEXT[], false, 80),
  ('coupons', 'Cupons e Promoções', 'Crie cupons de desconto e campanhas segmentadas.', 'relacionamento', 'Ticket', 'coupons', 'coupons', 14.90, 149.00, 'BRL', ARRAY['starter', 'pro']::TEXT[], false, 60),
  ('loyalty', 'Fidelidade Premium', 'Programa de pontos, recompensas e fidelização de clientes.', 'relacionamento', 'Trophy', 'loyalty', 'loyalty', 19.90, 199.00, 'BRL', ARRAY['starter', 'pro']::TEXT[], false, 50),
  ('commissions', 'Comissões', 'Cálculo automático de comissões por barbeiro e serviço.', 'financeiro', 'Percent', 'commissions', 'commissions', 14.90, 149.00, 'BRL', ARRAY['starter', 'pro']::TEXT[], false, 90),
  ('ai_assistant', 'IA para Atendimento', 'Assistente de IA para respostas e recomendações.', 'ia', 'Sparkles', 'ai', 'ai', 49.90, 499.00, 'BRL', ARRAY['starter', 'pro']::TEXT[], false, 140),
  ('api_access', 'API Pública', 'Acesso à API REST do Barbex para integrações próprias.', 'integracoes', 'Code', 'api_access', 'api', 39.90, 399.00, 'BRL', ARRAY['starter', 'pro']::TEXT[], false, 150),
  ('campaigns', 'Campanhas de Marketing', 'Disparos segmentados, réguas de relacionamento e campanhas promocionais.', 'relacionamento', 'Send', 'campaigns', 'campaigns', 19.90, 199.00, 'BRL', ARRAY['starter', 'pro']::TEXT[], false, 65)
ON CONFLICT (addon_key) DO UPDATE
  SET canonical_module_key = EXCLUDED.canonical_module_key,
      eligible_plan_keys = EXCLUDED.eligible_plan_keys,
      annual_price = COALESCE(public.saas_addons.annual_price, EXCLUDED.annual_price);

-- AMBIGUOUS / NON-MODULE LEGACY ROWS: preserve data, but canonical_module_key remains NULL and is_active = false
UPDATE public.saas_addons
   SET canonical_module_key = NULL,
       is_active = false
 WHERE addon_key IN (
   'store',
   'subscriptions',
   'cashback',
   'payment_gateway',
   'automations_extra_single',
   'automations_pack_5',
   'automations_unlimited',
   'integrations',
   'white_label',
   'whatsapp_marketing',
   'ai_addon'
 );

-- ----------------------------------------------------------------------------
-- 3. EXPAND tenant_addons STATUS DOMAIN
-- ----------------------------------------------------------------------------

-- Ensure check constraint accepts 'absorbed_by_plan', 'inactive', and US/UK spelling of canceled/cancelled
ALTER TABLE public.tenant_addons
  DROP CONSTRAINT IF EXISTS tenant_addons_status_check;

ALTER TABLE public.tenant_addons
  ADD CONSTRAINT tenant_addons_status_check
  CHECK (status IN ('pending', 'trialing', 'active', 'past_due', 'canceled', 'cancelled', 'expired', 'absorbed_by_plan', 'inactive'));

-- ----------------------------------------------------------------------------
-- 4. BILLING CYCLE VOCABULARY NORMALIZATION HELPER
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_billing_cycle(p_cycle TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(coalesce(p_cycle, '')))
    WHEN 'month' THEN 'month'
    WHEN 'monthly' THEN 'month'
    WHEN 'year' THEN 'year'
    WHEN 'yearly' THEN 'year'
    WHEN 'annual' THEN 'year'
    WHEN 'annually' THEN 'year'
    ELSE NULL
  END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_billing_cycle(TEXT) TO authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- 5. GRACE-AWARE tenant_has_active_addon (P2-C & Section 12)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tenant_has_active_addon(_tenant_id UUID, _module_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_canonical_key text;
BEGIN
  IF _tenant_id IS NULL OR _module_key IS NULL OR length(trim(_module_key)) = 0 THEN
    RETURN false;
  END IF;

  v_canonical_key := lower(trim(_module_key));
  IF v_canonical_key = 'portal' THEN
    v_canonical_key := 'client_portal';
  ELSIF v_canonical_key IN ('automations', 'automations_smart', 'automations_unlimited') THEN
    v_canonical_key := 'automations_basic';
  ELSIF v_canonical_key IN ('products', 'store') THEN
    v_canonical_key := 'stock';
  ELSIF v_canonical_key = 'cashback' THEN
    v_canonical_key := 'loyalty';
  ELSIF v_canonical_key IN ('integrations', 'integrations_center', 'api_access') THEN
    v_canonical_key := 'api';
  ELSIF v_canonical_key IN (
    'ai_scheduler', 'ai_commercial', 'ai_recovery', 'ai_products',
    'ai_subscriptions', 'ai_smart_replies', 'ai_campaigns', 'ai_loyalty',
    'ai_whatsapp', 'ai_google_reviews', 'ai_upsell', 'ai_cross_sell'
  ) THEN
    v_canonical_key := 'ai';
  END IF;

  -- 1. Operational availability: globally available
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_module_availability
     WHERE module_key = v_canonical_key AND is_available = true
  ) THEN
    RETURN false;
  END IF;

  -- 2. Tenant operational status: suspended tenants have access denied
  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = _tenant_id AND status IN ('blocked', 'suspended', 'inactive')
  ) THEN
    RETURN false;
  END IF;

  -- 3. Base Subscription Grace Authority:
  -- Add-on capability is commercially tied to the parent subscription episode.
  -- If a subscription exists, it MUST be active or within-grace.
  -- If no subscription exists, fallback to active paid profile plan.
  IF EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = _tenant_id) THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.subscriptions s
       WHERE s.user_id = _tenant_id
         AND (
           s.status IN ('active', 'trialing')
           OR (
             s.status = 'past_due'
             AND s.past_due_since IS NOT NULL
             AND s.grace_ends_at IS NOT NULL
             AND clock_timestamp() < s.grace_ends_at
           )
         )
    ) THEN
      RETURN false;
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
     WHERE pr.id = _tenant_id
       AND lower(coalesce(nullif(pr.effective_plan, ''), nullif(pr.plan, ''))) IN ('starter', 'pro', 'elite')
       AND pr.status = 'active'
  ) THEN
    RETURN false;
  END IF;

  -- 4. Contract verification in tenant_addons
  RETURN EXISTS (
    SELECT 1
      FROM public.tenant_addons ta
      JOIN public.saas_addons sa ON sa.id = ta.addon_id
     WHERE ta.tenant_id = _tenant_id
       AND (
         sa.module_key = _module_key
         OR sa.addon_key = _module_key
         OR sa.canonical_module_key = _module_key
         OR sa.module_key = v_canonical_key
         OR sa.addon_key = v_canonical_key
         OR sa.canonical_module_key = v_canonical_key
       )
       AND ta.status IN ('active', 'trialing', 'past_due')
       AND (ta.current_period_end IS NULL OR ta.current_period_end > clock_timestamp())
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_has_active_addon(UUID, TEXT) TO authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- 6. CANONICAL CAPABILITY ARBITER: has_module_access STEP 11 CONVERGENCE
-- ----------------------------------------------------------------------------

-- Drop inadvertent 3-arg overload to prevent function ambiguity
DROP FUNCTION IF EXISTS public.has_module_access(uuid, text, uuid);

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
  v_canonical_key text;
  v_global_available boolean;
  v_tenant_id uuid;
  v_plan_slug text;
  v_allowed jsonb;
  v_bshop_plan_id uuid;
  v_override_enabled boolean;

  -- Subscription & Grace evaluation
  v_sub_status text;
  v_sub_plan text;
  v_sub_past_due_since timestamptz;
  v_sub_grace_ends_at timestamptz;
  v_has_sub boolean := false;
  v_profile_trial_end timestamptz;
  v_commercial_entitled boolean := false;
  v_target_plan text;
BEGIN
  -- 1. Input sanity check (fail-closed)
  IF _user_id IS NULL OR _module_key IS NULL OR length(trim(_module_key)) = 0 THEN
    RETURN false;
  END IF;

  -- 2. Normalize aliases to canonical 23-module catalog keys
  v_canonical_key := lower(trim(_module_key));
  IF v_canonical_key = 'portal' THEN
    v_canonical_key := 'client_portal';
  ELSIF v_canonical_key IN ('automations', 'automations_smart', 'automations_unlimited') THEN
    v_canonical_key := 'automations_basic';
  ELSIF v_canonical_key IN ('products', 'store') THEN
    v_canonical_key := 'stock';
  ELSIF v_canonical_key = 'cashback' THEN
    v_canonical_key := 'loyalty';
  ELSIF v_canonical_key IN ('integrations', 'integrations_center', 'api_access') THEN
    v_canonical_key := 'api';
  ELSIF v_canonical_key IN (
    'ai_scheduler', 'ai_commercial', 'ai_recovery', 'ai_products',
    'ai_subscriptions', 'ai_smart_replies', 'ai_campaigns', 'ai_loyalty',
    'ai_whatsapp', 'ai_google_reviews', 'ai_upsell', 'ai_cross_sell'
  ) THEN
    v_canonical_key := 'ai';
  END IF;

  -- 3. Unknown module check (fail-closed)
  IF v_canonical_key NOT IN (
    -- 7 Core always-on
    'dashboard', 'calendar', 'customers', 'barbers', 'services', 'finances', 'settings',
    -- 7 Starter
    'client_portal', 'basic_finance', 'barber_panel', 'reports_basic', 'whatsapp', 'automations_basic', 'support',
    -- 7 Pro
    'advanced_finance', 'reports_advanced', 'stock', 'coupons', 'loyalty', 'commissions', 'campaigns',
    -- 2 Elite
    'ai', 'api'
  ) THEN
    RETURN false;
  END IF;

  -- 4. GLOBAL AVAILABILITY ENFORCEMENT (Platform Operational Dimension)
  -- If explicitly marked is_available = false, DENY IMMEDIATELY across all callers!
  SELECT is_available INTO v_global_available
    FROM public.platform_module_availability
   WHERE module_key = v_canonical_key;

  IF v_global_available IS FALSE THEN
    RETURN false;
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
  -- Crucial: ALWAYS_ON cannot bypass suspension!
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

  -- 7. Super admin bypass for operational tenants on globally available modules
  BEGIN
    IF public.is_super_admin_user() THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 8. Administrative voucher check (active internal voucher bypass)
  BEGIN
    IF public.has_active_internal_voucher(_user_id) OR public.has_active_internal_voucher(v_tenant_id) THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 9. Always-on core modules are unconditionally entitled at commercial capability dimension
  -- (Suspension, auth, and role checks remain enforced independently by their respective layers)
  IF v_canonical_key IN ('dashboard', 'calendar', 'customers', 'barbers', 'services', 'finances', 'settings') THEN
    RETURN true;
  END IF;

  -- 10. Tenant disable override check
  -- If explicitly marked enabled = false in barbershop_modules, DENY regardless of plan!
  SELECT enabled INTO v_override_enabled
    FROM public.barbershop_modules
   WHERE tenant_id = v_tenant_id AND (module_key = _module_key OR module_key = v_canonical_key);

  IF v_override_enabled IS FALSE THEN
    RETURN false;
  END IF;

  -- 11. Commercial Add-On check (R2E.16B Grace-Aware Convergence)
  IF EXISTS (
    SELECT 1
      FROM public.tenant_addons ta
      JOIN public.saas_addons sa ON sa.id = ta.addon_id
     WHERE (ta.tenant_id = v_tenant_id OR ta.tenant_id = _user_id)
       AND (
         sa.module_key = _module_key
         OR sa.addon_key = _module_key
         OR sa.canonical_module_key = _module_key
         OR sa.module_key = v_canonical_key
         OR sa.addon_key = v_canonical_key
         OR sa.canonical_module_key = v_canonical_key
       )
       AND ta.status IN ('active', 'trialing', 'past_due')
       AND (ta.current_period_end IS NULL OR ta.current_period_end > clock_timestamp())
  ) THEN
    -- ADDON GRACE ENFORCEMENT: Active add-on capability is valid ONLY IF
    -- the parent base subscription is currently commercially entitled.
    -- If a subscription exists: it MUST be active/trialing or past_due within grace.
    -- If grace has expired or subscription is canceled/unpaid, add-on access is DENIED.
    IF EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = v_tenant_id OR s.user_id = _user_id) THEN
      IF EXISTS (
        SELECT 1
          FROM public.subscriptions s
         WHERE (s.user_id = v_tenant_id OR s.user_id = _user_id)
           AND (
             s.status IN ('active', 'trialing')
             OR (
               s.status = 'past_due'
               AND s.past_due_since IS NOT NULL
               AND s.grace_ends_at IS NOT NULL
               AND clock_timestamp() < s.grace_ends_at
             )
           )
      ) THEN
        RETURN true;
      END IF;
    ELSIF EXISTS (
      SELECT 1 FROM public.profiles pr
       WHERE (pr.id = v_tenant_id OR pr.id = _user_id)
         AND lower(coalesce(nullif(pr.effective_plan, ''), nullif(pr.plan, ''))) IN ('starter', 'pro', 'elite')
         AND pr.status = 'active'
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- 12. COMMERCIAL ENTITLEMENT RESOLUTION: SUBSCRIPTION GRACE & TRIAL ISOLATION (R2E.14B)
  -- A. Fetch plan from profiles
  SELECT
    lower(coalesce(nullif(pr.effective_plan, ''), nullif(pr.plan, ''))),
    pr.trial_end
  INTO
    v_plan_slug,
    v_profile_trial_end
  FROM public.profiles pr
  WHERE pr.id = v_tenant_id OR pr.id = _user_id
  ORDER BY (pr.id = v_tenant_id) DESC
  LIMIT 1;

  -- B. Check subscription authority in public.subscriptions
  SELECT
    status,
    plan_key,
    past_due_since,
    grace_ends_at
  INTO
    v_sub_status,
    v_sub_plan,
    v_sub_past_due_since,
    v_sub_grace_ends_at
  FROM public.subscriptions
  WHERE user_id = v_tenant_id OR user_id = _user_id
  ORDER BY
    CASE status
      WHEN 'active' THEN 1
      WHEN 'past_due' THEN 2
      WHEN 'trialing' THEN 3
      ELSE 4
    END ASC,
    CASE plan_key
      WHEN 'elite' THEN 1
      WHEN 'pro' THEN 2
      WHEN 'starter' THEN 3
      ELSE 4
    END ASC,
    updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_has_sub := true;
  END IF;

  IF v_has_sub THEN
    -- Paid subscription lifecycle authority
    IF v_sub_status = 'active' THEN
      v_commercial_entitled := true;
      v_target_plan := COALESCE(v_sub_plan, v_plan_slug);
    ELSIF v_sub_status = 'past_due' THEN
      -- DELINQUENCY GRACE EVALUATION: Request-time dynamic check
      IF v_sub_past_due_since IS NOT NULL
         AND v_sub_grace_ends_at IS NOT NULL
         AND clock_timestamp() < v_sub_grace_ends_at THEN
        -- Within Grace Period!
        v_commercial_entitled := true;
        v_target_plan := COALESCE(v_sub_plan, v_plan_slug);
      ELSE
        -- Grace Expired or missing metadata: fail closed
        v_commercial_entitled := false;
      END IF;
    ELSIF v_sub_status = 'trialing' THEN
      v_commercial_entitled := true;
      v_target_plan := COALESCE(v_sub_plan, v_plan_slug);
    ELSE
      -- Terminal or non-entitled status (canceled, unpaid, incomplete_expired)
      v_commercial_entitled := false;
    END IF;
  ELSE
    -- Cardless Free Trial authority (NO subscription exists)
    IF v_profile_trial_end IS NOT NULL THEN
      IF clock_timestamp() < v_profile_trial_end THEN
        -- Free trial is ACTIVE
        v_commercial_entitled := true;
        v_target_plan := v_plan_slug;
      ELSE
        -- Free trial is EXPIRED: Grace NEVER applies to expired cardless trial!
        v_commercial_entitled := false;
      END IF;
    ELSE
      v_commercial_entitled := false;
    END IF;
  END IF;

  -- If not commercially entitled, deny access to commercial capabilities
  IF NOT v_commercial_entitled THEN
    RETURN false;
  END IF;

  -- C. Validate capability against active plan modules in public.plans
  IF v_target_plan IS NOT NULL THEN
    SELECT allowed_modules INTO v_allowed
    FROM public.plans
    WHERE slug = v_target_plan AND active = true;

    IF v_allowed IS NOT NULL AND (v_allowed ? _module_key OR v_allowed ? v_canonical_key) THEN
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

    IF v_allowed IS NOT NULL AND (v_allowed ? _module_key OR v_allowed ? v_canonical_key) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
EXCEPTION WHEN OTHERS THEN
  -- Fail-closed
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_module_access(UUID, TEXT) TO authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- 7. SERVER-SIDE ADD-ON PURCHASE ELIGIBILITY ARBITER (Section 15, 16, 22, 23)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_tenant_purchase_addon(
  _tenant_id UUID,
  _addon_key TEXT,
  _user_id UUID DEFAULT auth.uid(),
  _billing_cycle TEXT DEFAULT 'month',
  _environment TEXT DEFAULT 'test'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_owner BOOLEAN := false;
  v_sub RECORD;
  v_addon RECORD;
  v_allowed_modules JSONB;
  v_norm_sub_cycle TEXT;
  v_norm_req_cycle TEXT;
  v_price_id TEXT;
BEGIN
  -- 1. Tenant & Financial Role Authority
  IF _tenant_id IS NULL OR _user_id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'invalid_caller', 'error_code', 'INVALID_CALLER');
  END IF;

  -- Verify owner authority: caller must be barbershops.owner_id OR profile tenant identity
  SELECT EXISTS (
    SELECT 1 FROM public.barbershops
     WHERE id = _tenant_id AND owner_id = _user_id
  ) OR (_tenant_id = _user_id) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'owner_required', 'error_code', 'NOT_OWNER');
  END IF;

  -- 2. Tenant lifecycle check
  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = _tenant_id AND status IN ('blocked', 'suspended', 'inactive')
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'tenant_suspended', 'error_code', 'TENANT_SUSPENDED');
  END IF;

  -- 3. Base Subscription Authority & Grace Evaluation
  SELECT status, plan_key, billing_cycle, past_due_since, grace_ends_at, stripe_subscription_id
    INTO v_sub
    FROM public.subscriptions
   WHERE user_id = _tenant_id
   ORDER BY
     CASE status
       WHEN 'active' THEN 1
       WHEN 'past_due' THEN 2
       WHEN 'trialing' THEN 3
       ELSE 4
     END ASC,
     updated_at DESC
   LIMIT 1;

  IF v_sub.status IS NULL OR v_sub.status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    -- Check if cardless trial
    IF EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = _tenant_id AND trial_end IS NOT NULL AND trial_end > clock_timestamp()
    ) THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'trial_not_eligible', 'error_code', 'TRIAL_NOT_ELIGIBLE');
    END IF;
    RETURN jsonb_build_object('eligible', false, 'reason', 'requires_paid_subscription', 'error_code', 'NO_ACTIVE_SUBSCRIPTION');
  END IF;

  IF v_sub.status = 'past_due' THEN
    IF v_sub.past_due_since IS NULL OR v_sub.grace_ends_at IS NULL OR clock_timestamp() >= v_sub.grace_ends_at THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'grace_expired', 'error_code', 'GRACE_EXPIRED');
    END IF;
  END IF;

  -- 4. Add-on Catalog Record
  SELECT id, addon_key, name, canonical_module_key, is_active, eligible_plan_keys,
         monthly_price, annual_price,
         stripe_price_id_test, stripe_price_id_live,
         stripe_price_id_annual_test, stripe_price_id_annual_live
    INTO v_addon
    FROM public.saas_addons
   WHERE addon_key = _addon_key;

  IF v_addon.id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'addon_not_found', 'error_code', 'NOT_FOUND');
  END IF;

  IF v_addon.is_active IS FALSE THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'addon_inactive', 'error_code', 'ADDON_INACTIVE');
  END IF;

  IF v_addon.canonical_module_key IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'non_canonical_addon', 'error_code', 'NON_CANONICAL');
  END IF;

  -- 5. Operational Global Availability
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_module_availability
     WHERE module_key = v_addon.canonical_module_key AND is_available = true
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'module_globally_unavailable', 'error_code', 'GLOBALLY_UNAVAILABLE');
  END IF;

  -- 6. Administrative Voucher Isolation
  IF public.has_active_internal_voucher(_tenant_id) OR public.has_active_internal_voucher(_user_id) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'voucher_already_grants', 'error_code', 'VOUCHER_ACTIVE');
  END IF;

  -- 7. Plan Non-Overlap: module must not already be included in current plan
  SELECT allowed_modules INTO v_allowed_modules
    FROM public.plans
   WHERE slug = v_sub.plan_key AND active = true;

  IF v_allowed_modules IS NOT NULL AND (v_allowed_modules ? v_addon.canonical_module_key) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'included_in_plan', 'error_code', 'ALREADY_INCLUDED_IN_PLAN');
  END IF;

  -- 8. Plan Eligibility
  IF NOT (v_sub.plan_key = ANY(v_addon.eligible_plan_keys)) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_eligible_for_plan', 'error_code', 'PLAN_NOT_ELIGIBLE');
  END IF;

  -- 9. Duplicate Contract Check
  IF EXISTS (
    SELECT 1 FROM public.tenant_addons
     WHERE tenant_id = _tenant_id
       AND addon_id = v_addon.id
       AND status IN ('active', 'trialing', 'past_due')
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'already_purchased', 'error_code', 'ALREADY_CONTRACTED');
  END IF;

  -- 10. Billing Cycle Matching
  v_norm_sub_cycle := public.normalize_billing_cycle(v_sub.billing_cycle);
  v_norm_req_cycle := public.normalize_billing_cycle(_billing_cycle);

  IF v_norm_sub_cycle IS NULL OR v_norm_req_cycle IS NULL OR v_norm_sub_cycle <> v_norm_req_cycle THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'cycle_mismatch',
      'error_code', 'CYCLE_MISMATCH',
      'expected_cycle', v_norm_sub_cycle
    );
  END IF;

  -- 11. Stripe Price Mapping Check (Fail-closed if unprovisioned)
  IF lower(_environment) = 'live' THEN
    IF v_norm_sub_cycle = 'year' THEN
      v_price_id := v_addon.stripe_price_id_annual_live;
    ELSE
      v_price_id := v_addon.stripe_price_id_live;
    END IF;
  ELSE
    IF v_norm_sub_cycle = 'year' THEN
      v_price_id := v_addon.stripe_price_id_annual_test;
    ELSE
      v_price_id := v_addon.stripe_price_id_test;
    END IF;
  END IF;

  IF v_price_id IS NULL OR trim(v_price_id) = '' THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'not_configured_in_stripe',
      'error_code', 'PRICE_NOT_CONFIGURED',
      'addon_id', v_addon.id,
      'canonical_module_key', v_addon.canonical_module_key
    );
  END IF;

  -- 12. All gates passed
  RETURN jsonb_build_object(
    'eligible', true,
    'addon_id', v_addon.id,
    'addon_key', v_addon.addon_key,
    'canonical_module_key', v_addon.canonical_module_key,
    'base_plan', v_sub.plan_key,
    'billing_cycle', v_norm_sub_cycle,
    'price_id', v_price_id,
    'stripe_subscription_id', v_sub.stripe_subscription_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_tenant_purchase_addon(UUID, TEXT, UUID, TEXT, TEXT) TO authenticated, anon, service_role;

COMMIT;
