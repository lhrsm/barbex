-- Migration: 20261106120000_r2e26e22n14_persistent_ai_governance.sql
-- Phase: R2E.26E.22N.14 — General Multi-Tenant AI Assistant Release & Persistent Availability Governance
-- Summary:
-- 1. Add is_persistent boolean NOT NULL DEFAULT false to public.platform_module_availability
-- 2. Update public.is_module_globally_available(text) to recognize persistent availability while maintaining fail-closed temporal checks
-- 3. Create dedicated RPC public.admin_set_ai_persistent_availability(boolean, text, text) for Super Admin release
-- 4. Update public.admin_set_global_module_availability(text, boolean, text) to clear is_persistent on deactivation (Kill Switch)
-- 5. Ensure 100% backwards compatibility and zero impact on other 22 modules

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SCHEMA EXTENSION (SAFE & NON-DESTRUCTIVE)
-- ------------------------------------------------------------------------------
ALTER TABLE public.platform_module_availability
  ADD COLUMN IF NOT EXISTS is_persistent BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.platform_module_availability.is_persistent IS
  'Indica se o módulo foi liberado em modo de produção contínua/persistente (sem expiração de janela temporal). Em caso de falso, módulos com governança temporal (como IA) continuam exigindo available_until válido.';

-- ------------------------------------------------------------------------------
-- 2. ATOMIC AVAILABILITY RESOLVER (CLOCK_TIMESTAMP + PERSISTENT MULTI-TENANT)
-- ------------------------------------------------------------------------------
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
  v_until timestamptz;
  v_persistent boolean;
BEGIN
  -- 1. Input sanity check (fail-closed)
  IF p_module_key IS NULL OR length(trim(p_module_key)) = 0 THEN
    RETURN false;
  END IF;

  -- 2. Canonical alias resolution
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

  -- 3. Query state from platform_module_availability
  SELECT is_available, available_until, is_persistent
    INTO v_avail, v_until, v_persistent
    FROM public.platform_module_availability
   WHERE module_key = v_canonical;

  -- 4. Fail-closed on missing row or explicit false
  IF v_avail IS NOT TRUE THEN
    RETURN false;
  END IF;

  -- 5. Strict temporal validation exclusively for 'ai' unless persistent mode is active
  IF v_canonical = 'ai' THEN
    -- Se liberado em modo persistente homologado, não expira temporalmente
    IF v_persistent IS TRUE THEN
      RETURN true;
    END IF;

    -- Caso contrário, exige janela temporal canário estritamente válida
    IF v_until IS NULL OR clock_timestamp() >= v_until THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_module_globally_available(text) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. DEDICATED SUPER ADMIN PERSISTENT AVAILABILITY RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_ai_persistent_availability(
  p_available boolean,
  p_reason text,
  p_confirmation_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_clean_reason text;
  v_clean_token text;
  v_before_available boolean;
  v_before_persistent boolean;
  v_before_reason text;
  v_before_until timestamptz;
BEGIN
  -- A. AUTHORIZATION (Server-side Super Admin check)
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'super_admin'::public.app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Acesso negado: Requer privilégio de Super Admin.'
    );
  END IF;

  -- B. CONFIRMATION TOKEN CHECK (Fail-Closed against accidental invocation)
  v_clean_token := trim(coalesce(p_confirmation_token, ''));
  IF v_clean_token != 'CONFIRM_PERSISTENT_MULTI_TENANT_AI_RELEASE' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_CONFIRMATION_TOKEN',
      'message', 'Token de confirmação inválido para liberação geral persistente do assistente de IA.'
    );
  END IF;

  -- C. JUSTIFICATION VALIDATION (Min 10, Max 500 chars)
  v_clean_reason := trim(coalesce(p_reason, ''));
  IF v_clean_reason IS NULL OR char_length(v_clean_reason) < 10 OR char_length(v_clean_reason) > 500 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_REASON',
      'message', 'Justificativa operacional é obrigatória e deve conter entre 10 e 500 caracteres legíveis.'
    );
  END IF;

  -- D. CONCURRENCY CONTROL (Advisory lock for AI availability mutation)
  PERFORM pg_advisory_xact_lock(hashtext('global_module_availability'), hashtext('ai'));

  -- E. ROW LOCKING & BEFORE-STATE INSPECTION
  SELECT is_available, is_persistent, unavailable_reason, available_until
    INTO v_before_available, v_before_persistent, v_before_reason, v_before_until
    FROM public.platform_module_availability
   WHERE module_key = 'ai'
     FOR UPDATE;

  IF v_before_available IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MODULE_ROW_MISSING',
      'message', 'Registro do módulo de IA não localizado na tabela de governança global.'
    );
  END IF;

  -- F. AUTHORITATIVE MUTATION
  UPDATE public.platform_module_availability
     SET is_available = p_available,
         is_persistent = p_available,
         available_until = NULL, -- Liberação persistente remove expiração temporal
         unavailable_reason = CASE WHEN p_available THEN NULL ELSE v_clean_reason END,
         updated_at = clock_timestamp(),
         updated_by = v_actor_id
   WHERE module_key = 'ai';

  -- G. ATOMIC AUDIT LOGGING
  INSERT INTO public.audit_logs (
    admin_id,
    target_id,
    action,
    details,
    ip_address
  ) VALUES (
    v_actor_id,
    NULL,
    'platform.ai_persistent_availability_updated',
    jsonb_build_object(
      'module_key', 'ai',
      'previous_available', v_before_available,
      'previous_persistent', v_before_persistent,
      'new_available', p_available,
      'new_persistent', p_available,
      'available_until', null,
      'reason', v_clean_reason,
      'mode', 'persistent_multi_tenant_release',
      'timestamp', clock_timestamp()
    ),
    NULL
  );

  -- H. STRUCTURED SUCCESS RESPONSE
  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Disponibilidade persistente do módulo de IA atualizada com sucesso.',
    'data', jsonb_build_object(
      'module_key', 'ai',
      'previous_state', v_before_available,
      'is_available', p_available,
      'is_persistent', p_available,
      'available_until', null,
      'reason', v_clean_reason
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_ai_persistent_availability(boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_ai_persistent_availability(boolean, text, text) TO authenticated, service_role, postgres;

-- ------------------------------------------------------------------------------
-- 4. EMERGENCY KILL SWITCH HARMONIZATION
-- Ensure admin_set_global_module_availability clears is_persistent when disabling
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_global_module_availability(
  p_module_key text,
  p_available boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_clean_module text;
  v_clean_reason text;
  v_gov record;
  v_before_available boolean;
  v_before_reason text;
  v_before_until timestamptz;
BEGIN
  -- A. AUTHORIZATION (Server-side Super Admin check)
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'super_admin'::public.app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Acesso negado: Requer privilégio de Super Admin.'
    );
  END IF;

  -- B. INPUT NORMALIZATION
  v_clean_module := lower(trim(coalesce(p_module_key, '')));
  IF v_clean_module = 'products' THEN v_clean_module := 'stock'; END IF;
  IF v_clean_module = 'cashback' THEN v_clean_module := 'loyalty'; END IF;
  IF v_clean_module = 'integrations' THEN v_clean_module := 'api'; END IF;
  IF v_clean_module = 'automations' THEN v_clean_module := 'automations_basic'; END IF;

  -- C. SERVER ALLOWLIST & CLASSIFICATION CHECK
  SELECT * INTO v_gov FROM public.get_module_governance_classification(v_clean_module);

  IF v_gov.classification = 'UNKNOWN' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNKNOWN_MODULE',
      'message', 'Módulo desconhecido ou inexistente no catálogo canônico da plataforma.'
    );
  END IF;

  IF v_gov.classification = 'PROHIBITED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PROHIBITED_MODULE',
      'message', 'O módulo ' || v_clean_module || ' é protegido como núcleo essencial da plataforma e não pode ser desativado globalmente.'
    );
  END IF;

  IF v_gov.classification = 'MAINTENANCE_ONLY' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MAINTENANCE_ONLY_MODULE',
      'message', 'O módulo ' || v_clean_module || ' é restrito a janelas de manutenção global da infraestrutura e não pode ser alterado via governança de módulos.'
    );
  END IF;

  IF NOT v_gov.can_mutate THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NON_GOVERNABLE_MODULE',
      'message', 'Módulo não elegível para mutação operacional global.'
    );
  END IF;

  -- D. JUSTIFICATION VALIDATION (Min 10, Max 500 chars)
  v_clean_reason := trim(coalesce(p_reason, ''));
  IF v_clean_reason IS NULL OR char_length(v_clean_reason) < 10 OR char_length(v_clean_reason) > 500 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_REASON',
      'message', 'Justificativa operacional é obrigatória e deve conter entre 10 e 500 caracteres legíveis.'
    );
  END IF;

  -- E. FAIL-CLOSED GUARD: AI ACTIVATION REQUIRES DURATION PARAMETER OR PERSISTENT RPC
  IF v_clean_module = 'ai' AND p_available IS TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'AI_ACTIVATION_REQUIRES_DURATION',
      'message', 'A ativação temporal do módulo de IA exige especificação de duração (4 parâmetros) ou liberação persistente via admin_set_ai_persistent_availability.'
    );
  END IF;

  -- F. CONCURRENCY CONTROL
  PERFORM pg_advisory_xact_lock(hashtext('global_module_availability'), hashtext(v_clean_module));

  -- G. ROW LOCKING & BEFORE-STATE INSPECTION
  SELECT is_available, unavailable_reason, available_until
    INTO v_before_available, v_before_reason, v_before_until
    FROM public.platform_module_availability
   WHERE module_key = v_clean_module
     FOR UPDATE;

  IF v_before_available IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MODULE_ROW_MISSING',
      'message', 'Registro de disponibilidade global não localizado no banco para o módulo: ' || v_clean_module
    );
  END IF;

  -- H. DUPLICATE STATE REJECTION (Idempotency)
  IF v_before_available = p_available AND (v_clean_module != 'ai' OR v_before_until IS NULL) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONFLICT',
      'message', 'O módulo ' || v_clean_module || ' já se encontra no estado de disponibilidade solicitado.',
      'data', jsonb_build_object(
        'module_key', v_clean_module,
        'is_available', v_before_available
      )
    );
  END IF;

  -- I. AUTHORITATIVE MUTATION
  UPDATE public.platform_module_availability
     SET is_available = p_available,
         is_persistent = CASE WHEN p_available IS FALSE THEN false ELSE is_persistent END,
         unavailable_reason = CASE WHEN p_available THEN NULL ELSE v_clean_reason END,
         available_until = NULL, -- 3-arg calls always clear available_until
         updated_at = clock_timestamp(),
         updated_by = v_actor_id
   WHERE module_key = v_clean_module;

  -- J. ATOMIC AUDIT LOGGING
  INSERT INTO public.audit_logs (
    admin_id,
    target_id,
    action,
    details,
    ip_address
  ) VALUES (
    v_actor_id,
    NULL,
    'platform.global_feature_availability_updated',
    jsonb_build_object(
      'module_key', v_clean_module,
      'previous_state', v_before_available,
      'new_state', p_available,
      'available_until', null,
      'reason', v_clean_reason,
      'classification', v_gov.classification,
      'impact_level', v_gov.impact_level,
      'signature', '3_args',
      'timestamp', clock_timestamp()
    ),
    NULL
  );

  -- K. STRUCTURED SUCCESS RESPONSE
  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Disponibilidade global do módulo ' || v_clean_module || ' atualizada com sucesso.',
    'data', jsonb_build_object(
      'module_key', v_clean_module,
      'previous_state', v_before_available,
      'is_available', p_available,
      'available_until', null,
      'reason', v_clean_reason,
      'classification', v_gov.classification
    )
  );
END;
$$;

COMMIT;

