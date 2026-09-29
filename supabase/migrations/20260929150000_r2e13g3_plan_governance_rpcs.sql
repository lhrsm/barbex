-- ==============================================================================
-- BARBEX ENTERPRISE CANONICAL MIGRATION: R2E.13G.3
-- PLAN & CAPABILITY GOVERNANCE: METADATA, ACTIVE AVAILABILITY & MODULE CONTROLS
-- TARGET SCHEMA: public
-- SECURITY: SECURITY DEFINER, SET search_path = public, pg_temp
-- AUTHORIZATION: has_role(auth.uid(), 'super_admin'::public.app_role)
-- CONCURRENCY: SELECT ... FOR UPDATE
-- AUDIT: ATOMIC INSERT INTO public.audit_logs
-- NO STRIPE PRICE MUTATION / NO COMMERCIAL PRICE MUTATION / NO PLAN DELETION
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTHORITATIVE PLAN METADATA UPDATE RPC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_update_plan_metadata(
  p_plan_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_tier integer DEFAULT 0,
  p_max_barbers integer DEFAULT NULL,
  p_is_recommended boolean DEFAULT false,
  p_automation_limit integer DEFAULT 0,
  p_limits jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_plan_slug text;
  v_before_state jsonb;
  v_clean_name text;
BEGIN
  -- A. AUTHORIZATION (Server-side Super Admin check)
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'super_admin'::public.app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Acesso negado: Requer privilégio de Super Admin.'
    );
  END IF;

  -- B. INPUT VALIDATION
  IF p_plan_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_TARGET',
      'message', 'Identificador do plano é obrigatório.'
    );
  END IF;

  v_clean_name := trim(p_name);
  IF v_clean_name IS NULL OR char_length(v_clean_name) < 2 OR char_length(v_clean_name) > 100 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_NAME',
      'message', 'Nome do plano deve conter entre 2 e 100 caracteres.'
    );
  END IF;

  -- C. ROW LOCKING & BEFORE-STATE CAPTURE
  SELECT
    slug,
    jsonb_build_object(
      'name', name,
      'description', description,
      'tier', tier,
      'max_barbers', max_barbers,
      'is_recommended', is_recommended,
      'automation_limit', automation_limit,
      'limits', limits
    )
  INTO
    v_plan_slug,
    v_before_state
  FROM public.plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF v_before_state IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Plano não localizado.'
    );
  END IF;

  -- D. AUTHORITATIVE MUTATION (Excludes Stripe mappings and commercial prices)
  UPDATE public.plans
  SET
    name = v_clean_name,
    description = p_description,
    tier = COALESCE(p_tier, 0),
    max_barbers = p_max_barbers,
    is_recommended = COALESCE(p_is_recommended, false),
    automation_limit = COALESCE(p_automation_limit, 0),
    limits = COALESCE(p_limits, '{}'::jsonb),
    updated_at = now()
  WHERE id = p_plan_id;

  -- E. ATOMIC AUDIT LOGGING
  INSERT INTO public.audit_logs (
    admin_id,
    target_id,
    action,
    details,
    ip_address
  ) VALUES (
    v_actor_id,
    p_plan_id,
    'plan.metadata_updated',
    jsonb_build_object(
      'plan_id', p_plan_id,
      'plan_slug', v_plan_slug,
      'before', v_before_state,
      'after', jsonb_build_object(
        'name', v_clean_name,
        'description', p_description,
        'tier', COALESCE(p_tier, 0),
        'max_barbers', p_max_barbers,
        'is_recommended', COALESCE(p_is_recommended, false),
        'automation_limit', COALESCE(p_automation_limit, 0),
        'limits', COALESCE(p_limits, '{}'::jsonb)
      ),
      'timestamp', now()
    ),
    NULL
  );

  -- F. STRUCTURED RESULT
  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Metadados do plano atualizados com sucesso.',
    'data', jsonb_build_object(
      'plan_id', p_plan_id,
      'slug', v_plan_slug,
      'name', v_clean_name
    )
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. AUTHORITATIVE PLAN AVAILABILITY (ACTIVE/INACTIVE) RPC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_plan_active(
  p_plan_id uuid,
  p_active boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_plan_slug text;
  v_plan_name text;
  v_current_active boolean;
  v_clean_reason text;
  v_action text;
BEGIN
  -- A. AUTHORIZATION (Server-side Super Admin check)
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'super_admin'::public.app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Acesso negado: Requer privilégio de Super Admin.'
    );
  END IF;

  -- B. INPUT VALIDATION
  IF p_plan_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_TARGET',
      'message', 'Identificador do plano é obrigatório.'
    );
  END IF;

  IF p_active IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_STATE',
      'message', 'Status ativo/inativo é obrigatório.'
    );
  END IF;

  v_clean_reason := trim(p_reason);

  -- Mandatory reason for deactivation (Level 2 governance)
  IF NOT p_active THEN
    IF v_clean_reason IS NULL OR char_length(v_clean_reason) < 10 OR char_length(v_clean_reason) > 500 THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'INVALID_REASON',
        'message', 'Motivo da desativação é obrigatório e deve conter entre 10 e 500 caracteres.'
      );
    END IF;
  ELSE
    -- If reason provided for activation, validate length
    IF v_clean_reason IS NOT NULL AND (char_length(v_clean_reason) < 5 OR char_length(v_clean_reason) > 500) THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'INVALID_REASON',
        'message', 'Motivo da ativação deve conter entre 5 e 500 caracteres quando fornecido.'
      );
    END IF;
  END IF;

  -- C. ROW LOCKING & CONCURRENCY
  SELECT
    slug,
    name,
    COALESCE(active, true)
  INTO
    v_plan_slug,
    v_plan_name,
    v_current_active
  FROM public.plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF v_plan_slug IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Plano não localizado.'
    );
  END IF;

  -- D. IDEMPOTENCY CHECK
  IF v_current_active = p_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONFLICT',
      'message', CASE
        WHEN p_active THEN 'O plano já se encontra ativo.'
        ELSE 'O plano já se encontra desativado.'
      END,
      'data', jsonb_build_object(
        'current_active', v_current_active
      )
    );
  END IF;

  -- E. AUTHORITATIVE MUTATION
  UPDATE public.plans
  SET
    active = p_active,
    updated_at = now()
  WHERE id = p_plan_id;

  v_action := CASE WHEN p_active THEN 'plan.activated' ELSE 'plan.deactivated' END;

  -- F. ATOMIC AUDIT LOGGING
  INSERT INTO public.audit_logs (
    admin_id,
    target_id,
    action,
    details,
    ip_address
  ) VALUES (
    v_actor_id,
    p_plan_id,
    v_action,
    jsonb_build_object(
      'plan_id', p_plan_id,
      'plan_slug', v_plan_slug,
      'plan_name', v_plan_name,
      'before_active', v_current_active,
      'after_active', p_active,
      'reason', v_clean_reason,
      'timestamp', now()
    ),
    NULL
  );

  -- G. STRUCTURED RESULT
  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', CASE
      WHEN p_active THEN 'Plano ativado com sucesso para novas assinaturas.'
      ELSE 'Plano desativado com sucesso. Novas assinaturas bloqueadas; assinantes existentes preservados.'
    END,
    'data', jsonb_build_object(
      'plan_id', p_plan_id,
      'slug', v_plan_slug,
      'active', p_active,
      'action', v_action
    )
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. AUTHORITATIVE PLAN MODULES GOVERNANCE RPC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_plan_modules(
  p_plan_id uuid,
  p_allowed_modules jsonb,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_plan_slug text;
  v_plan_name text;
  v_before_modules jsonb;
  v_clean_reason text;
BEGIN
  -- A. AUTHORIZATION (Server-side Super Admin check)
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'super_admin'::public.app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Acesso negado: Requer privilégio de Super Admin.'
    );
  END IF;

  -- B. INPUT VALIDATION
  IF p_plan_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_TARGET',
      'message', 'Identificador do plano é obrigatório.'
    );
  END IF;

  IF p_allowed_modules IS NULL OR jsonb_typeof(p_allowed_modules) <> 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_MODULES',
      'message', 'Módulos permitidos deve ser um array JSON de strings.'
    );
  END IF;

  v_clean_reason := trim(p_reason);
  IF v_clean_reason IS NOT NULL AND (char_length(v_clean_reason) < 5 OR char_length(v_clean_reason) > 500) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_REASON',
      'message', 'Motivo da alteração de módulos deve conter entre 5 e 500 caracteres quando fornecido.'
    );
  END IF;

  -- C. ROW LOCKING & CONCURRENCY
  SELECT
    slug,
    name,
    COALESCE(allowed_modules, '[]'::jsonb)
  INTO
    v_plan_slug,
    v_plan_name,
    v_before_modules
  FROM public.plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF v_plan_slug IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Plano não localizado.'
    );
  END IF;

  -- D. AUTHORITATIVE MUTATION
  UPDATE public.plans
  SET
    allowed_modules = p_allowed_modules,
    updated_at = now()
  WHERE id = p_plan_id;

  -- E. ATOMIC AUDIT LOGGING
  INSERT INTO public.audit_logs (
    admin_id,
    target_id,
    action,
    details,
    ip_address
  ) VALUES (
    v_actor_id,
    p_plan_id,
    'plan.modules_updated',
    jsonb_build_object(
      'plan_id', p_plan_id,
      'plan_slug', v_plan_slug,
      'plan_name', v_plan_name,
      'before_modules', v_before_modules,
      'after_modules', p_allowed_modules,
      'reason', v_clean_reason,
      'timestamp', now()
    ),
    NULL
  );

  -- F. STRUCTURED RESULT
  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Módulos permitidos do plano atualizados com sucesso.',
    'data', jsonb_build_object(
      'plan_id', p_plan_id,
      'slug', v_plan_slug,
      'modules_count', jsonb_array_length(p_allowed_modules)
    )
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. PRIVILEGE ENFORCEMENT (Explicit REVOKE from PUBLIC and anon)
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.admin_update_plan_metadata(uuid, text, text, integer, integer, boolean, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_plan_metadata(uuid, text, text, integer, integer, boolean, integer, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_plan_active(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_active(uuid, boolean, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_plan_modules(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_modules(uuid, jsonb, text) TO authenticated;
