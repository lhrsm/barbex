-- Migration: 20260930190000_r2e13g6a_global_availability_enforcement.sql
-- Phase: R2E.13G.6A — Global Feature Availability: Enforcement Convergence
-- Summary:
-- 1. Create normalized, strongly-typed public.platform_module_availability relation
-- 2. Seed canonical 23-module catalog with default is_available = true (non-regression)
-- 3. Configure RLS: public/authenticated read-only; direct browser writes denied
-- 4. Provide helper function public.is_module_globally_available(p_module_key text)
-- 5. Reconverge public.has_module_access(_user_id, _module_key) in place to enforce global availability

BEGIN;

-- 1. CANONICAL GLOBAL MODULE AVAILABILITY STORAGE
CREATE TABLE IF NOT EXISTS public.platform_module_availability (
  module_key text PRIMARY KEY,
  is_available boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_by uuid
);

-- 2. SEED CANONICAL 23-MODULE CATALOG (PRESERVE EXISTING AVAILABILITY)
INSERT INTO public.platform_module_availability (module_key, is_available, description) VALUES
  ('dashboard', true, 'Painel principal e metricas essenciais da barbearia'),
  ('calendar', true, 'Agenda de agendamentos e horarios operacionais'),
  ('customers', true, 'Gestao de clientes e historico de atendimentos'),
  ('barbers', true, 'Gestao de equipe de barbeiros e profissionais'),
  ('services', true, 'Catalogo de servicos e precos'),
  ('finances', true, 'Fluxo de caixa basico e controle diario'),
  ('settings', true, 'Configuracoes gerais da unidade e conta'),
  ('client_portal', true, 'Portal publico de autoatendimento do cliente'),
  ('basic_finance', true, 'Relatorios financeiros basicos'),
  ('barber_panel', true, 'Painel individual do barbeiro e comissoes'),
  ('reports_basic', true, 'Relatorios operacionais basicos'),
  ('whatsapp', true, 'Notificacoes e lembretes via WhatsApp'),
  ('automations_basic', true, 'Automacoes operacionais basicas'),
  ('support', true, 'Canal de suporte integrado e tickets'),
  ('advanced_finance', true, 'DRE, fluxo de caixa avancado e conciliacao'),
  ('reports_advanced', true, 'Inteligencia de dados e relatorios analiticos avancados'),
  ('stock', true, 'Gestao de estoque e catalogo de produtos'),
  ('coupons', true, 'Campanhas de cupons promocionais e descontos'),
  ('loyalty', true, 'Programa de pontos, fidelidade e cashback'),
  ('commissions', true, 'Calculo e gestao avancada de comissoes'),
  ('campaigns', true, 'Disparos em massa e marketing hub'),
  ('ai', true, 'Recursos de inteligencia artificial e assistente'),
  ('api', true, 'Acesso a API publica e integracoes externas')
ON CONFLICT (module_key) DO UPDATE
  SET description = EXCLUDED.description;

-- 3. ROW LEVEL SECURITY & PERMISSIONS
ALTER TABLE public.platform_module_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view platform module availability" ON public.platform_module_availability;
CREATE POLICY "Anyone can view platform module availability"
  ON public.platform_module_availability
  FOR SELECT
  USING (true);

-- Revoke direct browser writes from non-privileged roles (service_role only until G.6B governed RPC)
GRANT SELECT ON public.platform_module_availability TO anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.platform_module_availability FROM anon, authenticated, public;

-- Trigger to maintain updated_at
DROP TRIGGER IF EXISTS trg_platform_module_availability_updated_at ON public.platform_module_availability;
CREATE TRIGGER trg_platform_module_availability_updated_at
  BEFORE UPDATE ON public.platform_module_availability
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. HELPER FUNCTION: is_module_globally_available
CREATE OR REPLACE FUNCTION public.is_module_globally_available(p_module_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_canonical text;
  v_avail boolean;
BEGIN
  IF p_module_key IS NULL OR length(trim(p_module_key)) = 0 THEN
    RETURN false;
  END IF;

  v_canonical := lower(trim(p_module_key));
  IF v_canonical = 'portal' THEN
    v_canonical := 'client_portal';
  ELSIF v_canonical IN ('automations', 'automations_smart', 'automations_unlimited') THEN
    v_canonical := 'automations_basic';
  ELSIF v_canonical IN ('products', 'store') THEN
    v_canonical := 'stock';
  ELSIF v_canonical = 'cashback' THEN
    v_canonical := 'loyalty';
  ELSIF v_canonical IN ('integrations', 'integrations_center', 'api_access') THEN
    v_canonical := 'api';
  ELSIF v_canonical IN (
    'ai_scheduler', 'ai_commercial', 'ai_recovery', 'ai_products',
    'ai_subscriptions', 'ai_smart_replies', 'ai_campaigns', 'ai_loyalty',
    'ai_whatsapp', 'ai_google_reviews', 'ai_upsell', 'ai_cross_sell'
  ) THEN
    v_canonical := 'ai';
  END IF;

  SELECT is_available INTO v_avail
    FROM public.platform_module_availability
   WHERE module_key = v_canonical;

  -- Fail-closed on explicit false; fallback open on missing row to prevent accidental lockout
  IF v_avail IS FALSE THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_module_globally_available(text) TO anon, authenticated, service_role;

-- 5. RECONVERGE CANONICAL RESOLVER: public.has_module_access
-- Preserves in-place signature (uuid, text) -> boolean to prevent dropping dependent RLS policies
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

  -- 11. Commercial Add-On check
  -- Active commercial add-on in tenant_addons grants access
  IF EXISTS (
    SELECT 1
      FROM public.tenant_addons ta
      JOIN public.saas_addons sa ON sa.id = ta.addon_id
     WHERE (ta.tenant_id = v_tenant_id OR ta.tenant_id = _user_id)
       AND (sa.module_key = _module_key OR sa.addon_key = _module_key OR sa.module_key = v_canonical_key OR sa.addon_key = v_canonical_key)
       AND ta.status IN ('active', 'trialing', 'past_due')
       AND (ta.current_period_end IS NULL OR ta.current_period_end > now())
  ) THEN
    RETURN true;
  END IF;

  -- 12. Plan entitlement check
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

  -- If not in plan and no active add-on, deny (tenant override cannot escalate plan)
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  -- Fail-closed
  RETURN false;
END;
$$;

COMMIT;
