-- ==============================================================================
-- BARBEX PHASE 17C.M6E: STRIPE WEBHOOK IDEMPOTENCY & ATOMIC SUBSCRIPTION SYNC
-- TARGET PROJECT: ywdwrstxvsdqiryhieiz
-- ==============================================================================

-- 1. Tabela de Idempotência de Eventos do Stripe
CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  event_type text NOT NULL,
  environment text NOT NULL DEFAULT 'test',
  status text NOT NULL DEFAULT 'processed',
  processed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_stripe_processed_events_event_id UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_event_id
  ON public.stripe_processed_events (event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_created_at
  ON public.stripe_processed_events (created_at);

ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- 2. RPC Atômica de Claim de Evento Stripe (Garante Concorrência e Previne Replay)
CREATE OR REPLACE FUNCTION public.claim_stripe_event(
  p_event_id text,
  p_event_type text,
  p_environment text DEFAULT 'test'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted boolean := false;
BEGIN
  IF p_event_id IS NULL OR trim(p_event_id) = '' THEN
    RETURN false;
  END IF;

  INSERT INTO public.stripe_processed_events (
    event_id,
    event_type,
    environment,
    status,
    processed_at,
    created_at
  )
  VALUES (
    trim(p_event_id),
    trim(p_event_type),
    COALESCE(p_environment, 'test'),
    'processing',
    clock_timestamp(),
    clock_timestamp()
  )
  ON CONFLICT (event_id) DO NOTHING;

  IF FOUND THEN
    v_inserted := true;
  END IF;

  RETURN v_inserted;
END;
$$;

-- 3. RPC Atômica de Sincronização de Assinatura e Perfil
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
  p_environment text DEFAULT 'test'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_plan_slug text := 'free';
  v_is_active boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_stripe_subscription_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Parâmetros obrigatórios ausentes');
  END IF;

  -- 1. Upsert em Subscriptions
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
    updated_at = v_now;

  -- 2. Resolver slug do plano a partir do price_id
  IF p_price_id IS NOT NULL THEN
    IF p_price_id ILIKE '%starter%' THEN
      v_plan_slug := 'starter';
    ELSIF p_price_id ILIKE '%pro%' THEN
      v_plan_slug := 'pro';
    ELSIF p_price_id ILIKE '%elite%' THEN
      v_plan_slug := 'elite';
    ELSE
      SELECT slug INTO v_plan_slug
      FROM public.plans
      WHERE (stripe_price_id_test = p_price_id OR stripe_price_id_live = p_price_id)
        AND active = true
      LIMIT 1;

      IF v_plan_slug IS NULL THEN
        v_plan_slug := 'free';
      END IF;
    END IF;
  END IF;

  v_is_active := p_status IN ('active', 'trialing', 'past_due');
  IF NOT v_is_active THEN
    v_plan_slug := 'free';
  END IF;

  -- 3. Atualizar profile
  UPDATE public.profiles
  SET
    plan = v_plan_slug,
    updated_at = v_now
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'plan', v_plan_slug,
    'status', p_status
  );
END;
$$;

-- 4. Permissões Estritas (Apenas service_role)
REVOKE ALL ON TABLE public.stripe_processed_events FROM PUBLIC;
REVOKE ALL ON TABLE public.stripe_processed_events FROM anon;
REVOKE ALL ON TABLE public.stripe_processed_events FROM authenticated;
GRANT ALL ON TABLE public.stripe_processed_events TO service_role;

REVOKE ALL ON FUNCTION public.claim_stripe_event(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_stripe_event(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_stripe_event(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text) TO service_role;
