-- Migration: 20260930170000_r2e13g5b_tenant_capability_governance.sql
-- Phase: R2E.13G.5B — Super Admin / Platform Control Center: Tenant Capability Governance
-- Purpose: Governed tenant capability overrides, atomic audit, and Super Admin read/mutation layer

BEGIN;

-- 1. READ RPC: CANONICAL TENANT CAPABILITY MATRIX
CREATE OR REPLACE FUNCTION public.admin_get_tenant_capability_matrix(
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid;
  v_tenant_id uuid;
  v_tenant_name text;
  v_tenant_status text;
  v_tenant_plan text;
  v_tenant_effective_plan text;
  v_is_suspended boolean := false;
  v_plan_slug text;
  v_plan_name text;
  v_allowed_modules jsonb := '[]'::jsonb;
  v_addon_keys text[];
  v_modules jsonb;
BEGIN
  -- 1. Authorization check
  v_caller := auth.uid();
  IF v_caller IS NULL OR NOT public.is_super_admin_user() THEN
    RAISE EXCEPTION 'FORBIDDEN: Apenas super administradores podem inspecionar matriz de capacidades.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Tenant resolution
  v_tenant_id := public.resolve_canonical_tenant_id(p_tenant_id, p_tenant_id);
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND: Estabelecimento nao encontrado.'
      USING ERRCODE = 'P0004';
  END IF;

  -- 3. Fetch tenant profile info
  SELECT 
    coalesce(nullif(display_name, ''), nullif(business_name, ''), 'Estabelecimento'),
    status,
    plan,
    effective_plan
  INTO 
    v_tenant_name,
    v_tenant_status,
    v_tenant_plan,
    v_tenant_effective_plan
  FROM public.profiles
  WHERE id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND: Perfil do estabelecimento nao encontrado.'
      USING ERRCODE = 'P0004';
  END IF;

  v_is_suspended := (v_tenant_status IS NOT NULL AND v_tenant_status IN ('blocked', 'suspended', 'inactive'));

  -- 4. Resolve plan allowed modules
  v_plan_slug := lower(coalesce(nullif(v_tenant_effective_plan, ''), nullif(v_tenant_plan, '')));
  SELECT name, coalesce(allowed_modules, '[]'::jsonb)
    INTO v_plan_name, v_allowed_modules
    FROM public.plans
   WHERE slug = v_plan_slug;

  IF v_plan_name IS NULL THEN
    v_plan_name := coalesce(v_plan_slug, 'Sem plano');
  END IF;

  -- 5. Resolve active add-on keys
  SELECT array_agg(DISTINCT lower(coalesce(sa.module_key, sa.addon_key)))
    INTO v_addon_keys
    FROM public.tenant_addons ta
    JOIN public.saas_addons sa ON sa.id = ta.addon_id
   WHERE ta.tenant_id = v_tenant_id
     AND ta.status IN ('active', 'trialing', 'past_due')
     AND (ta.current_period_end IS NULL OR ta.current_period_end > now());

  IF v_addon_keys IS NULL THEN
    v_addon_keys := ARRAY[]::text[];
  END IF;

  -- 6. Build the canonical 23-module matrix
  WITH catalog(module_key, display_name, category, is_always_on) AS (
    VALUES
      ('dashboard', 'Dashboard Principal', 'core', true),
      ('calendar', 'Agenda & Calendário', 'core', true),
      ('customers', 'Clientes & CRM', 'core', true),
      ('barbers', 'Profissionais & Equipe', 'core', true),
      ('services', 'Catálogo de Serviços', 'core', true),
      ('finances', 'Financeiro Básico', 'core', true),
      ('settings', 'Configurações Gerais', 'core', true),
      ('products', 'Produtos & Estoque', 'operacoes', false),
      ('subscriptions', 'Clubes de Assinatura', 'recorrencia', false),
      ('commissions', 'Comissões Avançadas', 'financeiro', false),
      ('cashback', 'Programa de Cashback', 'fidelizacao', false),
      ('loyalty', 'Fidelidade & Recompensas', 'fidelizacao', false),
      ('campaigns', 'Campanhas de Marketing', 'marketing', false),
      ('automations', 'Automações de Fluxo', 'marketing', false),
      ('integrations', 'Integrações & Webhooks', 'integracao', false),
      ('corporate_reports', 'BI Executivo & Relatórios', 'analytics', false),
      ('ai', 'Recursos com IA', 'inteligencia', false),
      ('stock', 'Gestão de Estoque', 'operacoes', false),
      ('coupons', 'Cupons de Desconto', 'marketing', false),
      ('client_portal', 'Portal de Agendamento', 'canais', false),
      ('whatsapp', 'Conexão WhatsApp', 'comunicacao', false),
      ('multi_units', 'Multi-unidades', 'enterprise', false),
      ('white_label', 'White Label / Marca Própria', 'enterprise', false)
  ),
  computed AS (
    SELECT
      c.module_key,
      c.display_name,
      c.category,
      c.is_always_on,
      (c.is_always_on OR (v_allowed_modules ? c.module_key)) AS is_plan_entitled,
      (c.module_key = ANY(v_addon_keys)) AS is_addon_entitled,
      CASE
        WHEN bm.enabled IS FALSE THEN 'DISABLED'
        ELSE 'INHERIT'
      END AS override_state,
      CASE
        WHEN c.is_always_on THEN 'always_on'
        WHEN c.module_key = ANY(v_addon_keys) THEN 'addon'
        WHEN (v_allowed_modules ? c.module_key) THEN 'plan'
        ELSE 'none'
      END AS commercial_source,
      -- Authoritative effective access for the tenant
      CASE
        WHEN v_is_suspended THEN false
        WHEN c.is_always_on THEN true
        WHEN bm.enabled IS FALSE THEN false
        WHEN ((v_allowed_modules ? c.module_key) OR (c.module_key = ANY(v_addon_keys))) THEN true
        ELSE false
      END AS effective_access
    FROM catalog c
    LEFT JOIN public.barbershop_modules bm
      ON bm.tenant_id = v_tenant_id AND bm.module_key = c.module_key
    ORDER BY 
      c.is_always_on DESC,
      c.category ASC,
      c.display_name ASC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'module_key', module_key,
      'display_name', display_name,
      'category', category,
      'is_always_on', is_always_on,
      'is_plan_entitled', is_plan_entitled,
      'is_addon_entitled', is_addon_entitled,
      'has_commercial_entitlement', (is_plan_entitled OR is_addon_entitled),
      'commercial_source', commercial_source,
      'override_state', override_state,
      'effective_access', effective_access,
      'can_disable', (NOT is_always_on AND (is_plan_entitled OR is_addon_entitled) AND override_state = 'INHERIT' AND NOT v_is_suspended),
      'can_inherit', (NOT is_always_on AND override_state = 'DISABLED' AND NOT v_is_suspended)
    )
  ) INTO v_modules
  FROM computed;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'tenant_name', v_tenant_name,
    'status', v_tenant_status,
    'is_suspended', v_is_suspended,
    'plan_slug', v_plan_slug,
    'plan_name', v_plan_name,
    'modules', coalesce(v_modules, '[]'::jsonb)
  );
END;
$$;


-- 2. MUTATION RPC: GOVERNED TENANT CAPABILITY OVERRIDE MUTATION
CREATE OR REPLACE FUNCTION public.admin_set_tenant_module_override(
  p_tenant_id uuid,
  p_module_key text,
  p_override_state text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_tenant_id uuid;
  v_clean_module text;
  v_clean_state text;
  v_clean_reason text;
  v_tenant_status text;
  v_tenant_plan text;
  v_tenant_effective_plan text;
  v_plan_slug text;
  v_plan_allowed jsonb;
  v_has_plan_entitlement boolean := false;
  v_has_addon_entitlement boolean := false;
  v_has_commercial_entitlement boolean := false;
  v_current_enabled boolean;
  v_current_state text;
  v_audit_id uuid;
  v_effective_access boolean;
BEGIN
  -- A. SUPER ADMIN AUTHORIZATION CHECK
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL OR NOT public.is_super_admin_user() THEN
    RAISE EXCEPTION 'FORBIDDEN: Operacao restrita a super administradores da plataforma.'
      USING ERRCODE = '42501';
  END IF;

  -- B. INPUT VALIDATION: STATE CONTRACT
  v_clean_state := upper(trim(p_override_state));
  IF v_clean_state NOT IN ('DISABLED', 'INHERIT') THEN
    RAISE EXCEPTION 'INVALID_OVERRIDE_STATE: Estado de restricao invalido (%s). Permitidos apenas INHERIT ou DISABLED.', p_override_state
      USING ERRCODE = 'P0001';
  END IF;

  -- C. INPUT VALIDATION: REASON CONTRACT (10..500 chars)
  v_clean_reason := trim(p_reason);
  IF length(v_clean_reason) < 10 OR length(v_clean_reason) > 500 THEN
    RAISE EXCEPTION 'INVALID_REASON: Justificativa deve conter entre 10 e 500 caracteres (comprimento atual: %).', length(v_clean_reason)
      USING ERRCODE = 'P0003';
  END IF;

  -- D. TENANT RESOLUTION & VALIDATION
  v_tenant_id := public.resolve_canonical_tenant_id(p_tenant_id, p_tenant_id);
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND: Estabelecimento % nao encontrado.', p_tenant_id
      USING ERRCODE = 'P0004';
  END IF;

  SELECT status, plan, effective_plan
    INTO v_tenant_status, v_tenant_plan, v_tenant_effective_plan
    FROM public.profiles
   WHERE id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND: Perfil do estabelecimento % nao encontrado.', v_tenant_id
      USING ERRCODE = 'P0004';
  END IF;

  -- E. SUSPENDED TENANT POLICY (G.5B: PROHIBITED WHILE SUSPENDED)
  IF v_tenant_status IS NOT NULL AND v_tenant_status IN ('blocked', 'suspended', 'inactive') THEN
    RAISE EXCEPTION 'TENANT_SUSPENDED: Nao e permitido alterar capacidades de estabelecimento bloqueado ou suspenso.'
      USING ERRCODE = 'P0005';
  END IF;

  -- F. MODULE VALIDATION (Canonical 23 Catalog)
  v_clean_module := lower(trim(p_module_key));
  IF v_clean_module NOT IN (
    'dashboard', 'calendar', 'customers', 'barbers', 'services', 'finances', 'settings',
    'products', 'subscriptions', 'commissions', 'cashback', 'loyalty', 'campaigns',
    'automations', 'integrations', 'corporate_reports', 'ai', 'stock', 'coupons',
    'client_portal', 'whatsapp', 'multi_units', 'white_label'
  ) THEN
    RAISE EXCEPTION 'UNKNOWN_MODULE: Modulo % nao reconhecido no catalogo canonico da plataforma.', p_module_key
      USING ERRCODE = 'P0006';
  END IF;

  -- G. ALWAYS-ON MODULE PROTECTION (IMMUTABLE)
  IF v_clean_module IN ('dashboard', 'calendar', 'customers', 'barbers', 'services', 'finances', 'settings') THEN
    RAISE EXCEPTION 'ALWAYS_ON_MODULE_IMMUTABLE: Modulos essenciais (%s) sao sempre ativos e nao admitem restricao administrativa.', v_clean_module
      USING ERRCODE = 'P0007';
  END IF;

  -- H. TRANSACTION ADVISORY LOCKING (CONCURRENCY PROTECTION)
  PERFORM pg_advisory_xact_lock(hashtext('tenant_module_override:' || v_tenant_id::text || ':' || v_clean_module));

  -- I. COMMERCIAL ENTITLEMENT CHECK
  v_plan_slug := lower(coalesce(nullif(v_tenant_effective_plan, ''), nullif(v_tenant_plan, '')));
  SELECT allowed_modules INTO v_plan_allowed
    FROM public.plans
   WHERE slug = v_plan_slug;

  v_has_plan_entitlement := (v_plan_allowed IS NOT NULL AND v_plan_allowed ? v_clean_module);

  SELECT EXISTS (
    SELECT 1 FROM public.tenant_addons ta
    JOIN public.saas_addons sa ON sa.id = ta.addon_id
    WHERE ta.tenant_id = v_tenant_id
      AND (sa.module_key = v_clean_module OR sa.addon_key = v_clean_module)
      AND ta.status IN ('active', 'trialing', 'past_due')
      AND (ta.current_period_end IS NULL OR ta.current_period_end > now())
  ) INTO v_has_addon_entitlement;

  v_has_commercial_entitlement := (v_has_plan_entitlement OR v_has_addon_entitlement);

  -- Prohibit DISABLED override if tenant does not even have commercial entitlement
  IF v_clean_state = 'DISABLED' AND NOT v_has_commercial_entitlement THEN
    RAISE EXCEPTION 'NO_COMMERCIAL_ENTITLEMENT: Modulo % nao esta incluido no plano nem possui add-on ativo para este tenant.', v_clean_module
      USING ERRCODE = 'P0008';
  END IF;

  -- J. IDEMPOTENCY CHECK
  SELECT enabled INTO v_current_enabled
    FROM public.barbershop_modules
   WHERE tenant_id = v_tenant_id AND module_key = v_clean_module;

  v_current_state := CASE WHEN v_current_enabled IS FALSE THEN 'DISABLED' ELSE 'INHERIT' END;

  IF v_clean_state = v_current_state THEN
    RAISE EXCEPTION 'IDEMPOTENT_OPERATION: O modulo % ja se encontra no estado % para esta barbearia.', v_clean_module, v_clean_state
      USING ERRCODE = 'P0002';
  END IF;

  -- K. AUTHORITATIVE STORAGE MUTATION
  IF v_clean_state = 'DISABLED' THEN
    INSERT INTO public.barbershop_modules (tenant_id, module_key, enabled, updated_at)
    VALUES (v_tenant_id, v_clean_module, false, now())
    ON CONFLICT (tenant_id, module_key)
    DO UPDATE SET enabled = false, updated_at = now();
  ELSE
    -- INHERIT: Remove the restrictive override row
    DELETE FROM public.barbershop_modules
     WHERE tenant_id = v_tenant_id AND module_key = v_clean_module;
  END IF;

  -- L. ATOMIC AUDIT LOGGING
  INSERT INTO public.audit_logs (
    admin_id,
    target_id,
    action,
    details,
    ip_address
  ) VALUES (
    v_actor_id,
    v_tenant_id,
    'platform.tenant_module_override_updated',
    jsonb_build_object(
      'tenant_id', v_tenant_id,
      'module_key', v_clean_module,
      'previous_state', v_current_state,
      'new_state', v_clean_state,
      'reason', v_clean_reason,
      'commercial_entitlement', v_has_commercial_entitlement
    ),
    inet_client_addr()::text
  ) RETURNING id INTO v_audit_id;

  -- M. RE-EVALUATE EFFECTIVE ACCESS
  v_effective_access := (
    NOT (v_tenant_status IS NOT NULL AND v_tenant_status IN ('blocked', 'suspended', 'inactive'))
    AND (
      v_clean_state <> 'DISABLED' AND v_has_commercial_entitlement
    )
  );

  -- N. RETURN AUTHORITATIVE RESULT
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'module_key', v_clean_module,
    'previous_state', v_current_state,
    'new_state', v_clean_state,
    'effective_access', v_effective_access,
    'audit_id', v_audit_id
  );
END;
$$;

-- 3. PERMISSIONS & SECURITY
REVOKE ALL ON FUNCTION public.admin_get_tenant_capability_matrix(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_tenant_capability_matrix(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_tenant_capability_matrix(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_tenant_capability_matrix(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_set_tenant_module_override(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_tenant_module_override(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_module_override(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_module_override(uuid, text, text, text) TO service_role;

COMMIT;
