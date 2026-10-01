-- ==============================================================================
-- BARBEX ENTERPRISE CANONICAL MIGRATION: R2E.14B
-- GRACE PERIOD FOUNDATION: DELINQUENCY EPISODE + TRIAL ISOLATION + ATOMIC STRIPE TRANSITIONS
-- TARGET SCHEMA: public
-- SECURITY: SECURITY DEFINER, SET search_path = public, pg_temp
-- AUTHORIZATION: has_role(auth.uid(), 'super_admin'::public.app_role)
-- CONCURRENCY: SELECT ... FOR UPDATE, pg_advisory_xact_lock
-- AUDIT: ATOMIC INSERT INTO public.audit_logs
-- NO STRIPE MUTATION / ZERO PRODUCTION MUTATION / LOCAL VALIDATION ONLY
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SUBSCRIPTION SCHEMA EXTENSIONS
-- ------------------------------------------------------------------------------

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz NULL,
  ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz NULL;

COMMENT ON COLUMN public.subscriptions.past_due_since IS 'Canonical delinquency episode start timestamp';
COMMENT ON COLUMN public.subscriptions.grace_ends_at IS 'Immutable request-time entitlement deadline for current delinquency episode';
COMMENT ON COLUMN public.subscriptions.payment_failed_at IS 'Latest observational payment failure timestamp (non-authoritative for Grace start)';

-- ------------------------------------------------------------------------------
-- 2. SYSTEM SETTINGS GRACE POLICY EXTENSION
-- ------------------------------------------------------------------------------

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 7;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_system_settings_grace_period_days'
  ) THEN
    ALTER TABLE public.system_settings
      ADD CONSTRAINT ck_system_settings_grace_period_days
      CHECK (grace_period_days >= 1 AND grace_period_days <= 30);
  END IF;
END $$;

COMMENT ON COLUMN public.system_settings.grace_period_days IS 'Canonical platform delinquency grace period in days (1..30, default 7)';

-- ------------------------------------------------------------------------------
-- 3. SEMANTIC RPC: admin_update_grace_policy
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_update_grace_policy(
  p_grace_period_days integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_before_days integer;
  v_clean_reason text;
  v_now timestamptz := clock_timestamp();
BEGIN
  -- 1. Authentication check
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Authorization check (super_admin only)
  IF NOT public.has_role(v_actor_id, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado: requer super_admin' USING ERRCODE = '42501';
  END IF;

  -- 3. Range validation: 1 to 30 days
  IF p_grace_period_days IS NULL OR p_grace_period_days < 1 OR p_grace_period_days > 30 THEN
    RAISE EXCEPTION 'Período de carência inválido: deve estar entre 1 e 30 dias' USING ERRCODE = '22003';
  END IF;

  -- 4. Reason validation: 10 to 500 characters
  v_clean_reason := trim(COALESCE(p_reason, ''));
  IF length(v_clean_reason) < 10 OR length(v_clean_reason) > 500 THEN
    RAISE EXCEPTION 'Justificativa inválida: deve conter entre 10 e 500 caracteres' USING ERRCODE = '22023';
  END IF;

  -- 5. Concurrency control: Lock system_settings row FOR UPDATE
  SELECT grace_period_days INTO v_before_days
  FROM public.system_settings
  FOR UPDATE;

  -- 6. Duplicate value rejection
  IF v_before_days = p_grace_period_days THEN
    RAISE EXCEPTION 'O período de carência informado já é o valor vigente (% dias)', p_grace_period_days USING ERRCODE = 'P0002';
  END IF;

  -- 7. Authoritative mutation
  UPDATE public.system_settings
  SET grace_period_days = p_grace_period_days,
      updated_at = v_now;

  -- 8. Atomic audit logging
  INSERT INTO public.audit_logs (
    admin_id,
    target_id,
    action,
    details,
    ip_address,
    created_at
  ) VALUES (
    v_actor_id,
    NULL,
    'platform.grace_policy_updated',
    jsonb_build_object(
      'previous_days', v_before_days,
      'new_days', p_grace_period_days,
      'reason', v_clean_reason,
      'timestamp', v_now
    ),
    NULL,
    v_now
  );

  -- 9. Return structured response
  RETURN jsonb_build_object(
    'ok', true,
    'previous_days', v_before_days,
    'new_days', p_grace_period_days,
    'reason', v_clean_reason,
    'updated_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_grace_policy(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_grace_policy(integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_grace_policy(integer, text) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. HELPER RPC: record_subscription_payment_failed
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_subscription_payment_failed(
  p_stripe_subscription_id text,
  p_event_timestamp timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_failed_at timestamptz := COALESCE(p_event_timestamp, v_now);
  v_sub_id uuid;
BEGIN
  IF p_stripe_subscription_id IS NULL OR trim(p_stripe_subscription_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stripe_subscription_id ausente');
  END IF;

  SELECT id INTO v_sub_id
  FROM public.subscriptions
  WHERE stripe_subscription_id = trim(p_stripe_subscription_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'not_found', true);
  END IF;

  UPDATE public.subscriptions
  SET payment_failed_at = v_failed_at,
      updated_at = v_now
  WHERE id = v_sub_id;

  RETURN jsonb_build_object(
    'ok', true,
    'subscription_id', v_sub_id,
    'payment_failed_at', v_failed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_subscription_payment_failed(text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_subscription_payment_failed(text, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_subscription_payment_failed(text, timestamptz) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. UPGRADE RPC: sync_subscription_atomic (WITH DELINQUENCY EPISODE LIFECYCLE)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_subscription_atomic(
  p_user_id uuid,
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_price_id text,
  p_product_id text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean DEFAULT false,
  p_environment text DEFAULT 'test',
  p_event_timestamp timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_plan_slug text := 'free';
  v_billing_cycle text := 'month';
  v_is_active boolean := false;
  v_stored_latest_event timestamptz;
  v_other_plan text;

  -- Existing subscription state
  v_existing_id uuid;
  v_existing_status text;
  v_existing_past_due_since timestamptz;
  v_existing_grace_ends_at timestamptz;
  v_existing_payment_failed_at timestamptz;

  -- Delinquency episode target fields
  v_target_past_due_since timestamptz := NULL;
  v_target_grace_ends_at timestamptz := NULL;
  v_target_payment_failed_at timestamptz := NULL;
  v_configured_grace_days integer;
  v_audit_action text := NULL;
BEGIN
  IF p_user_id IS NULL OR p_stripe_subscription_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Parâmetros obrigatórios ausentes');
  END IF;

  -- 0. SERIALIZAÇÃO CANÔNICA POR TITULAR (GATE 6 - R2E.12B.11)
  PERFORM pg_advisory_xact_lock(('x' || substr(md5(p_user_id::text), 1, 16))::bit(64)::bigint);
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- 1. Verificação contra eventos fora de ordem (race condition guard)
  SELECT
    id,
    status,
    past_due_since,
    grace_ends_at,
    payment_failed_at,
    latest_event_timestamp
  INTO
    v_existing_id,
    v_existing_status,
    v_existing_past_due_since,
    v_existing_grace_ends_at,
    v_existing_payment_failed_at,
    v_stored_latest_event
  FROM public.subscriptions
  WHERE stripe_subscription_id = p_stripe_subscription_id;

  IF p_event_timestamp IS NOT NULL AND v_stored_latest_event IS NOT NULL THEN
    IF p_event_timestamp < v_stored_latest_event THEN
      RETURN jsonb_build_object(
        'ok', true,
        'ignored_out_of_order', true,
        'user_id', p_user_id,
        'message', 'Incoming event is strictly older than latest processed event'
      );
    END IF;
  END IF;

  -- 2. Resolver slug do plano e ciclo a partir do price_id (reconhece mensal e anual)
  IF p_price_id IS NOT NULL THEN
    -- Mapeamento estrito para os 6 Price IDs comerciais Live
    IF p_price_id = 'price_1TVtOWPKG6q10UjrQErPgyKO' THEN
      v_plan_slug := 'starter';
      v_billing_cycle := 'month';
    ELSIF p_price_id = 'price_1UJDZBPKG6q10UjrQrf3rHBS' THEN
      v_plan_slug := 'starter';
      v_billing_cycle := 'year';
    ELSIF p_price_id = 'price_1TVtOVPKG6q10Ujre6zMGYpk' THEN
      v_plan_slug := 'pro';
      v_billing_cycle := 'month';
    ELSIF p_price_id = 'price_1UJDaCPKG6q10UjrWOjctNmr' THEN
      v_plan_slug := 'pro';
      v_billing_cycle := 'year';
    ELSIF p_price_id = 'price_1TmYG0PKG6q10UjrOx8tEehr' THEN
      v_plan_slug := 'elite';
      v_billing_cycle := 'month';
    ELSIF p_price_id = 'price_1UJDX4PKG6q10UjrzkytrHAJ' THEN
      v_plan_slug := 'elite';
      v_billing_cycle := 'year';
    ELSIF p_price_id IN ('price_1TVtgWPKG6q10UjrxRUCnyg1', 'price_1TVsefPKG6q10UjrKpTaUe71') THEN
      v_plan_slug := 'elite';
      v_billing_cycle := 'month';
    ELSIF p_price_id ILIKE '%starter%' THEN
      v_plan_slug := 'starter';
      v_billing_cycle := CASE WHEN p_price_id ILIKE '%year%' THEN 'year' ELSE 'month' END;
    ELSIF p_price_id ILIKE '%pro%' THEN
      v_plan_slug := 'pro';
      v_billing_cycle := CASE WHEN p_price_id ILIKE '%year%' THEN 'year' ELSE 'month' END;
    ELSIF p_price_id ILIKE '%elite%' THEN
      v_plan_slug := 'elite';
      v_billing_cycle := CASE WHEN p_price_id ILIKE '%year%' THEN 'year' ELSE 'month' END;
    ELSE
      SELECT slug, 'year' INTO v_plan_slug, v_billing_cycle
      FROM public.plans
      WHERE (stripe_yearly_price_id_test = p_price_id OR stripe_yearly_price_id_live = p_price_id)
        AND active = true
      LIMIT 1;

      IF v_plan_slug IS NULL THEN
        SELECT slug, 'month' INTO v_plan_slug, v_billing_cycle
        FROM public.plans
        WHERE (stripe_price_id_test = p_price_id OR stripe_price_id_live = p_price_id)
          AND active = true
        LIMIT 1;
      END IF;

      IF v_plan_slug IS NULL THEN
        v_plan_slug := 'free';
        v_billing_cycle := 'month';
      END IF;
    END IF;
  END IF;

  v_is_active := p_status IN ('active', 'trialing', 'past_due');
  IF NOT v_is_active THEN
    v_plan_slug := 'free';
  END IF;

  -- 3. DELINQUENCY EPISODE & GRACE LIFECYCLE MANAGEMENT (R2E.14B)
  IF p_status = 'past_due' THEN
    -- Check if subscription was already in past_due with valid episode timestamps
    IF v_existing_id IS NOT NULL AND v_existing_status = 'past_due'
       AND v_existing_past_due_since IS NOT NULL AND v_existing_grace_ends_at IS NOT NULL THEN
      -- REPEATED PAST_DUE: Preserve existing episode (NO extension / NO reset)
      v_target_past_due_since := v_existing_past_due_since;
      v_target_grace_ends_at := v_existing_grace_ends_at;
      v_target_payment_failed_at := v_existing_payment_failed_at;
    ELSE
      -- NEW DELINQUENCY EPISODE (non-past_due -> past_due or new episode)
      -- Read current valid grace policy from system_settings
      SELECT grace_period_days INTO v_configured_grace_days
      FROM public.system_settings
      LIMIT 1;

      IF v_configured_grace_days IS NULL OR v_configured_grace_days < 1 OR v_configured_grace_days > 30 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Configuração de período de carência inválida ou ausente');
      END IF;

      -- Canonical delinquency start: accepted event timestamp or local clock
      v_target_past_due_since := COALESCE(p_event_timestamp, v_now);
      v_target_grace_ends_at := v_target_past_due_since + (v_configured_grace_days || ' days')::interval;
      v_target_payment_failed_at := v_existing_payment_failed_at;
      v_audit_action := 'billing.grace_started';
    END IF;
  ELSIF p_status = 'active' THEN
    -- RECOVERY: Clear delinquency episode
    v_target_past_due_since := NULL;
    v_target_grace_ends_at := NULL;
    v_target_payment_failed_at := NULL;
    IF v_existing_status = 'past_due' THEN
      v_audit_action := 'billing.grace_recovered';
    END IF;
  ELSIF p_status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    -- TERMINAL: Clear delinquency episode
    v_target_past_due_since := NULL;
    v_target_grace_ends_at := NULL;
    v_target_payment_failed_at := NULL;
    IF v_existing_status = 'past_due' THEN
      v_audit_action := 'billing.grace_terminal';
    END IF;
  ELSE
    -- Other statuses (e.g. trialing, incomplete)
    v_target_past_due_since := NULL;
    v_target_grace_ends_at := NULL;
    v_target_payment_failed_at := v_existing_payment_failed_at;
  END IF;

  -- 4. Upsert em Subscriptions
  INSERT INTO public.subscriptions (
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    product_id,
    price_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    environment,
    billing_cycle,
    plan_key,
    latest_event_timestamp,
    past_due_since,
    grace_ends_at,
    payment_failed_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    p_product_id,
    p_price_id,
    p_status,
    p_period_start,
    p_period_end,
    COALESCE(p_cancel_at_period_end, false),
    COALESCE(p_environment, 'test'),
    v_billing_cycle,
    v_plan_slug,
    p_event_timestamp,
    v_target_past_due_since,
    v_target_grace_ends_at,
    v_target_payment_failed_at,
    v_now,
    v_now
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, public.subscriptions.stripe_customer_id),
    product_id = COALESCE(EXCLUDED.product_id, public.subscriptions.product_id),
    price_id = COALESCE(EXCLUDED.price_id, public.subscriptions.price_id),
    status = EXCLUDED.status,
    current_period_start = COALESCE(EXCLUDED.current_period_start, public.subscriptions.current_period_start),
    current_period_end = COALESCE(EXCLUDED.current_period_end, public.subscriptions.current_period_end),
    cancel_at_period_end = COALESCE(EXCLUDED.cancel_at_period_end, public.subscriptions.cancel_at_period_end),
    environment = EXCLUDED.environment,
    billing_cycle = v_billing_cycle,
    plan_key = v_plan_slug,
    latest_event_timestamp = COALESCE(p_event_timestamp, public.subscriptions.latest_event_timestamp),
    past_due_since = v_target_past_due_since,
    grace_ends_at = v_target_grace_ends_at,
    payment_failed_at = v_target_payment_failed_at,
    updated_at = v_now;

  -- 5. ATOMIC AUDIT LOGGING FOR DELINQUENCY TRANSITIONS
  IF v_audit_action IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      admin_id,
      target_id,
      action,
      details,
      ip_address,
      created_at
    ) VALUES (
      COALESCE(auth.uid(), p_user_id),
      p_user_id,
      v_audit_action,
      jsonb_build_object(
        'stripe_subscription_id', p_stripe_subscription_id,
        'previous_status', v_existing_status,
        'new_status', p_status,
        'past_due_since', v_target_past_due_since,
        'grace_ends_at', v_target_grace_ends_at,
        'timestamp', v_now
      ),
      NULL,
      v_now
    );
  END IF;

  -- 6. Atualizar profile mantendo consistência canônica estrita
  IF NOT v_is_active THEN
    SELECT plan_key INTO v_other_plan
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND stripe_subscription_id <> p_stripe_subscription_id
      AND status IN ('active', 'trialing', 'past_due')
    ORDER BY CASE plan_key
      WHEN 'elite' THEN 3
      WHEN 'pro' THEN 2
      WHEN 'starter' THEN 1
      ELSE 0
    END DESC
    LIMIT 1;

    IF FOUND AND v_other_plan IS NOT NULL THEN
      UPDATE public.profiles
      SET plan = v_other_plan, updated_at = v_now
      WHERE id = p_user_id;
    ELSE
      UPDATE public.profiles
      SET plan = 'free', updated_at = v_now
      WHERE id = p_user_id;
    END IF;
  ELSE
    SELECT plan_key INTO v_other_plan
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'trialing', 'past_due')
    ORDER BY CASE plan_key
      WHEN 'elite' THEN 3
      WHEN 'pro' THEN 2
      WHEN 'starter' THEN 1
      ELSE 0
    END DESC
    LIMIT 1;

    UPDATE public.profiles
    SET plan = COALESCE(v_other_plan, v_plan_slug), updated_at = v_now
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'plan', v_plan_slug,
    'billing_cycle', v_billing_cycle,
    'status', p_status,
    'past_due_since', v_target_past_due_since,
    'grace_ends_at', v_target_grace_ends_at
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. UPGRADE RPC: cancel_subscription_atomic (WITH GRACE EPISODE CLEARING)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_subscription_atomic(
  p_stripe_subscription_id text,
  p_event_timestamp timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_sub record;
  v_active_sub record;
  v_target_plan text := 'free';
  v_target_user_id uuid;
BEGIN
  IF p_stripe_subscription_id IS NULL OR trim(p_stripe_subscription_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stripe_subscription_id ausente');
  END IF;

  SELECT user_id INTO v_target_user_id
  FROM public.subscriptions
  WHERE stripe_subscription_id = trim(p_stripe_subscription_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'not_found', true);
  END IF;

  IF v_target_user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(('x' || substr(md5(v_target_user_id::text), 1, 16))::bit(64)::bigint);
    PERFORM 1 FROM public.profiles WHERE id = v_target_user_id FOR UPDATE;
  END IF;

  SELECT id, user_id, status, plan_key, latest_event_timestamp
  INTO v_sub
  FROM public.subscriptions
  WHERE stripe_subscription_id = trim(p_stripe_subscription_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'not_found', true);
  END IF;

  IF p_event_timestamp IS NOT NULL AND v_sub.latest_event_timestamp IS NOT NULL THEN
    IF p_event_timestamp < v_sub.latest_event_timestamp THEN
      RETURN jsonb_build_object(
        'ok', true,
        'ignored_out_of_order', true,
        'message', 'Evento de cancelamento mais antigo que o estado atual registrado'
      );
    END IF;
  END IF;

  -- Atualizar assinatura para 'canceled' e limpar campos de carência
  UPDATE public.subscriptions
  SET status = 'canceled',
      plan_key = 'free',
      past_due_since = NULL,
      grace_ends_at = NULL,
      payment_failed_at = NULL,
      latest_event_timestamp = COALESCE(p_event_timestamp, latest_event_timestamp),
      updated_at = v_now
  WHERE id = v_sub.id;

  -- Audit termination if previously past_due
  IF v_sub.status = 'past_due' THEN
    INSERT INTO public.audit_logs (
      admin_id,
      target_id,
      action,
      details,
      ip_address,
      created_at
    ) VALUES (
      COALESCE(auth.uid(), v_sub.user_id),
      v_sub.user_id,
      'billing.grace_terminal',
      jsonb_build_object(
        'stripe_subscription_id', p_stripe_subscription_id,
        'previous_status', v_sub.status,
        'new_status', 'canceled',
        'timestamp', v_now
      ),
      NULL,
      v_now
    );
  END IF;

  -- Atualizar add-ons vinculados a esta assinatura específica
  UPDATE public.tenant_addons
  SET status = 'canceled',
      cancelled_at = v_now,
      updated_at = v_now
  WHERE stripe_subscription_id = trim(p_stripe_subscription_id);

  IF v_sub.user_id IS NOT NULL THEN
    SELECT plan_key, status INTO v_active_sub
    FROM public.subscriptions
    WHERE user_id = v_sub.user_id
      AND id <> v_sub.id
      AND status IN ('active', 'trialing', 'past_due')
    ORDER BY CASE plan_key
      WHEN 'elite' THEN 3
      WHEN 'pro' THEN 2
      WHEN 'starter' THEN 1
      ELSE 0
    END DESC
    LIMIT 1;

    IF FOUND AND v_active_sub.plan_key IS NOT NULL THEN
      v_target_plan := v_active_sub.plan_key;
    ELSE
      v_target_plan := 'free';
    END IF;

    UPDATE public.profiles
    SET plan = v_target_plan,
        updated_at = v_now
    WHERE id = v_sub.user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_sub.user_id,
    'cancelled_subscription_id', p_stripe_subscription_id,
    'final_profile_plan', v_target_plan
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. UPGRADE RESOLVER: public.has_module_access
--    WITH DYNAMIC GRACE PERIOD CUTOFF & CARDLESS TRIAL ISOLATION (R2E.14B)
-- ------------------------------------------------------------------------------

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

  -- 11. Commercial Add-On check
  IF EXISTS (
    SELECT 1
      FROM public.tenant_addons ta
      JOIN public.saas_addons sa ON sa.id = ta.addon_id
     WHERE (ta.tenant_id = v_tenant_id OR ta.tenant_id = _user_id)
       AND (sa.module_key = _module_key OR sa.addon_key = _module_key OR sa.module_key = v_canonical_key OR sa.addon_key = v_canonical_key)
       AND ta.status IN ('active', 'trialing', 'past_due')
       AND (ta.current_period_end IS NULL OR ta.current_period_end > clock_timestamp())
  ) THEN
    RETURN true;
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

COMMIT;
