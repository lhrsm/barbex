-- ==============================================================================
-- BARBEX ENTERPRISE CANONICAL MIGRATION: R2E.13G.4
-- TRIAL & PLATFORM POLICY GOVERNANCE: DURATION, PLAN & RESOLVER CONSOLIDATION
-- TARGET SCHEMA: public
-- SECURITY: SECURITY DEFINER, SET search_path = public, pg_temp
-- AUTHORIZATION: has_role(auth.uid(), 'super_admin'::public.app_role)
-- CONCURRENCY: SELECT ... FOR UPDATE
-- AUDIT: ATOMIC INSERT INTO public.audit_logs
-- NO STRIPE MUTATION / NO DATA REWRITE OF EXISTING TRIALS / NO UNRESTRICTED SETTINGS WRITER
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD GOVERNED TRIAL POLICY COLUMNS TO public.system_settings
-- ------------------------------------------------------------------------------

ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS default_trial_days integer NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS default_trial_plan text NOT NULL DEFAULT 'pro';

-- ------------------------------------------------------------------------------
-- 2. AUTHORITATIVE TRIAL POLICY RESOLVER FUNCTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_default_trial_policy(
  OUT trial_days integer,
  OUT trial_plan text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer;
  v_plan text;
  v_plan_exists boolean;
BEGIN
  -- A. Read from single-row system_settings
  SELECT
    default_trial_days,
    default_trial_plan
  INTO
    v_days,
    v_plan
  FROM public.system_settings
  LIMIT 1;

  -- B. Validate and fallback trial_days (Bounded 1..90, canonical fallback 15)
  IF v_days IS NOT NULL AND v_days >= 1 AND v_days <= 90 THEN
    trial_days := v_days;
  ELSE
    trial_days := 15;
  END IF;

  -- C. Validate and fallback trial_plan (Must exist and be active in public.plans)
  IF v_plan IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.plans WHERE slug = lower(trim(v_plan)) AND active = true
    ) INTO v_plan_exists;

    IF v_plan_exists THEN
      trial_plan := lower(trim(v_plan));
    ELSE
      trial_plan := 'pro';
    END IF;
  ELSE
    trial_plan := 'pro';
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. CONSOLIDATE TRIAL CREATION PATH (handle_new_user) TO USE RESOLVER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  shop_name text;
  generated_slug text;
  user_role text;
  target_tenant_id uuid;
  v_policy_days integer;
  v_policy_plan text;
BEGIN
  -- Determine role from metadata or default to tenant_admin
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant_admin');

  -- Resolve authoritative trial policy from database
  SELECT trial_days, trial_plan INTO v_policy_days, v_policy_plan FROM public.get_default_trial_policy();

  -- Logic for administrative roles (Barbershop Owners)
  IF user_role IN ('tenant_admin', 'admin', 'super_admin') THEN
    shop_name := COALESCE(new.raw_user_meta_data->>'business_name', 'Minha Barbearia');
    generated_slug := generate_unique_slug(shop_name);

    INSERT INTO public.profiles (
      id, business_name, responsible_name, email, whatsapp_number,
      barbers_range, plan, trial_end, role, status, slug
    )
    VALUES (
      new.id, shop_name, new.raw_user_meta_data->>'responsible_name',
      new.email, new.raw_user_meta_data->>'whatsapp_number',
      new.raw_user_meta_data->>'barbers_range',
      COALESCE(new.raw_user_meta_data->>'plan', v_policy_plan),
      CASE 
        WHEN (new.raw_user_meta_data->>'plan') = v_policy_plan OR new.raw_user_meta_data->>'plan' IS NULL 
        THEN (now() + (v_policy_days || ' days')::interval) 
        ELSE NULL 
      END,
      user_role, 'active', generated_slug
    )
    ON CONFLICT (id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      responsible_name = EXCLUDED.responsible_name,
      email = EXCLUDED.email,
      slug = COALESCE(profiles.slug, EXCLUDED.slug);

    -- Create actual tenant record
    INSERT INTO public.barbershops (owner_id, name, slug)
    VALUES (new.id, shop_name, generated_slug)
    ON CONFLICT (owner_id) DO NOTHING;
  ELSE
    -- Logic for clients, staff, professionals (Strict Isolation: No slug, No tenant)
    target_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;
    
    INSERT INTO public.profiles (
      id, responsible_name, display_name, email, role, status, slug, tenant_id
    )
    VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'responsible_name'), 
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'responsible_name'),
      new.email, user_role, 'active', NULL, target_tenant_id
    )
    ON CONFLICT (id) DO UPDATE SET 
      role = EXCLUDED.role,
      tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id);
  END IF;

  -- Ensure RBAC record exists
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, user_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback safe
  END;

  RETURN new;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. PRIVILEGED TRIAL POLICY GOVERNANCE RPC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_update_trial_policy(
  p_trial_days integer,
  p_trial_plan text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_clean_plan text;
  v_clean_reason text;
  v_settings_id uuid;
  v_before_days integer;
  v_before_plan text;
  v_plan_valid boolean;
BEGIN
  -- A. AUTHORIZATION (Server-side Super Admin check)
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'super_admin'::public.app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Acesso negado: Requer privilégio de Super Admin.'
    );
  END IF;

  -- B. INPUT VALIDATION: TRIAL DAYS (Bounded 1..90)
  IF p_trial_days IS NULL OR p_trial_days < 1 OR p_trial_days > 90 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_DAYS',
      'message', 'Duração do trial deve ser um número inteiro entre 1 e 90 dias.'
    );
  END IF;

  -- C. INPUT VALIDATION: TRIAL PLAN (Must be non-empty and exist in public.plans as active)
  v_clean_plan := lower(trim(p_trial_plan));
  IF v_clean_plan IS NULL OR char_length(v_clean_plan) < 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_PLAN',
      'message', 'Plano do trial é obrigatório.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.plans WHERE slug = v_clean_plan AND active = true
  ) INTO v_plan_valid;

  IF NOT v_plan_valid THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PLAN_NOT_ELIGIBLE',
      'message', 'O plano informado não existe ou não está ativo para novas contratações.'
    );
  END IF;

  -- D. INPUT VALIDATION: REASON (Level 2 Governance: 10..500 chars)
  v_clean_reason := trim(p_reason);
  IF v_clean_reason IS NULL OR char_length(v_clean_reason) < 10 OR char_length(v_clean_reason) > 500 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_REASON',
      'message', 'Justificativa operacional é obrigatória e deve conter entre 10 e 500 caracteres.'
    );
  END IF;

  -- E. ROW LOCKING & CONCURRENCY
  SELECT
    id,
    default_trial_days,
    default_trial_plan
  INTO
    v_settings_id,
    v_before_days,
    v_before_plan
  FROM public.system_settings
  LIMIT 1
  FOR UPDATE;

  IF v_settings_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SETTINGS_NOT_FOUND',
      'message', 'Configurações da plataforma não inicializadas.'
    );
  END IF;

  -- F. IDEMPOTENCY CHECK
  IF v_before_days = p_trial_days AND v_before_plan = v_clean_plan THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONFLICT',
      'message', 'A política de trial já se encontra configurada com estes mesmos valores.',
      'data', jsonb_build_object(
        'current_trial_days', v_before_days,
        'current_trial_plan', v_before_plan
      )
    );
  END IF;

  -- G. AUTHORITATIVE MUTATION
  UPDATE public.system_settings
  SET
    default_trial_days = p_trial_days,
    default_trial_plan = v_clean_plan,
    updated_at = now()
  WHERE id = v_settings_id;

  -- H. ATOMIC AUDIT LOGGING
  INSERT INTO public.audit_logs (
    admin_id,
    target_id,
    action,
    details,
    ip_address
  ) VALUES (
    v_actor_id,
    v_settings_id,
    'platform.trial_policy_updated',
    jsonb_build_object(
      'before', jsonb_build_object(
        'default_trial_days', v_before_days,
        'default_trial_plan', v_before_plan
      ),
      'after', jsonb_build_object(
        'default_trial_days', p_trial_days,
        'default_trial_plan', v_clean_plan
      ),
      'reason', v_clean_reason,
      'applies_to', 'NEW_TRIALS_ONLY',
      'timestamp', now()
    ),
    NULL
  );

  -- I. STRUCTURED RESULT
  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Política de trial da plataforma atualizada com sucesso. Aplicável exclusivamente a novos cadastros.',
    'data', jsonb_build_object(
      'default_trial_days', p_trial_days,
      'default_trial_plan', v_clean_plan
    )
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. PRIVILEGE ENFORCEMENT
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.get_default_trial_policy() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_default_trial_policy() TO authenticated, service_role, postgres;

REVOKE ALL ON FUNCTION public.admin_update_trial_policy(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_trial_policy(integer, text, text) TO authenticated;
