-- =============================================================================
-- BARBEX — R2E.12B.7: FINAL CONCURRENCY, MANDATORY FENCING & ATOMIC LIFECYCLE
-- Target Tables: public.plans, public.subscriptions, public.stripe_processed_events
-- Target RPCs: public.claim_stripe_event, public.complete_stripe_event, public.fail_stripe_event,
--              public.cancel_subscription_atomic, public.sync_subscription_atomic
--
-- PRESERVATION RULES:
--   - price_monthly and price_yearly store BRL numeric values (not Price IDs).
--   - stripe_price_id_test and stripe_price_id_live store monthly Stripe Price IDs.
--   - stripe_yearly_price_id_test and stripe_yearly_price_id_live store yearly Stripe Price IDs.
--   - stripe_product_id_test and stripe_product_id_live store Stripe Product IDs.
--
-- NOTE: Local candidate migration only. DO NOT apply directly to production without express operator authorization.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. EVOLVE public.plans FOR YEARLY PRICE IDS & PRODUCT IDS
-- -----------------------------------------------------------------------------
ALTER TABLE public.plans 
  ADD COLUMN IF NOT EXISTS stripe_yearly_price_id_test text,
  ADD COLUMN IF NOT EXISTS stripe_yearly_price_id_live text,
  ADD COLUMN IF NOT EXISTS stripe_product_id_test text,
  ADD COLUMN IF NOT EXISTS stripe_product_id_live text;

COMMENT ON COLUMN public.plans.stripe_price_id_test IS 'Monthly Stripe Price ID for Test/Sandbox environment (format: price_...)';
COMMENT ON COLUMN public.plans.stripe_price_id_live IS 'Monthly Stripe Price ID for Live environment (format: price_...)';
COMMENT ON COLUMN public.plans.stripe_yearly_price_id_test IS 'Yearly Stripe Price ID for Test/Sandbox environment (format: price_...)';
COMMENT ON COLUMN public.plans.stripe_yearly_price_id_live IS 'Yearly Stripe Price ID for Live environment (format: price_...)';
COMMENT ON COLUMN public.plans.stripe_product_id_test IS 'Stripe Product ID for Test/Sandbox environment (format: prod_...)';
COMMENT ON COLUMN public.plans.stripe_product_id_live IS 'Stripe Product ID for Live environment (format: prod_...)';

CREATE INDEX IF NOT EXISTS idx_plans_stripe_yearly_price_test 
  ON public.plans(stripe_yearly_price_id_test) 
  WHERE stripe_yearly_price_id_test IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plans_stripe_yearly_price_live 
  ON public.plans(stripe_yearly_price_id_live) 
  WHERE stripe_yearly_price_id_live IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. EVOLVE public.subscriptions FOR BILLING CYCLE & OUT-OF-ORDER PROTECTION
-- -----------------------------------------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS plan_key text,
  ADD COLUMN IF NOT EXISTS latest_event_timestamp timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_subscriptions_billing_cycle'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT ck_subscriptions_billing_cycle
      CHECK (billing_cycle IN ('month', 'year'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_subscriptions_plan_key'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT ck_subscriptions_plan_key
      CHECK (plan_key IS NULL OR plan_key IN ('starter', 'pro', 'elite', 'free'));
  END IF;
END $$;

COMMENT ON COLUMN public.subscriptions.billing_cycle IS 'Active billing cycle: month or year';
COMMENT ON COLUMN public.subscriptions.plan_key IS 'Normalized plan key: starter, pro, elite, or free';
COMMENT ON COLUMN public.subscriptions.latest_event_timestamp IS 'Stripe event created timestamp to prevent out-of-order state regression';

CREATE INDEX IF NOT EXISTS idx_subscriptions_latest_event_timestamp
  ON public.subscriptions(latest_event_timestamp)
  WHERE latest_event_timestamp IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. EVOLVE public.stripe_processed_events FOR FENCING LEASE TOKEN
-- -----------------------------------------------------------------------------
ALTER TABLE public.stripe_processed_events
  ADD COLUMN IF NOT EXISTS lease_token text;

COMMENT ON COLUMN public.stripe_processed_events.lease_token IS 'Fencing token generated on claim to prevent zombie workers from completing expired leases';

-- -----------------------------------------------------------------------------
-- 4. CLEAN UP PREVIOUS RPC SIGNATURES TO PREVENT OVERLOAD AMBIGUITY
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_stripe_event(text, text, text);
DROP FUNCTION IF EXISTS public.complete_stripe_event(text);
DROP FUNCTION IF EXISTS public.complete_stripe_event(text, text);
DROP FUNCTION IF EXISTS public.fail_stripe_event(text);
DROP FUNCTION IF EXISTS public.fail_stripe_event(text, text);
DROP FUNCTION IF EXISTS public.fail_stripe_event(text, text, text);
DROP FUNCTION IF EXISTS public.cancel_subscription_atomic(text);
DROP FUNCTION IF EXISTS public.cancel_subscription_atomic(text, timestamptz);
DROP FUNCTION IF EXISTS public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text);
DROP FUNCTION IF EXISTS public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, timestamptz);

-- -----------------------------------------------------------------------------
-- 5. UPGRADED WEBHOOK IDEMPOTENCY LIFECYCLE WITH MANDATORY FENCING TOKENS
-- -----------------------------------------------------------------------------

-- 5.1. Reivindicação atômica com geração de fencing token (lease_token)
CREATE OR REPLACE FUNCTION public.claim_stripe_event(
  p_event_id text,
  p_event_type text,
  p_environment text DEFAULT 'test'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lease_token text := gen_random_uuid()::text;
  v_current_status text;
  v_processed_at timestamptz;
  v_existing_token text;
BEGIN
  IF p_event_id IS NULL OR trim(p_event_id) = '' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'missing_event_id');
  END IF;

  -- 1. Tentativa de inserção com status 'processing' e novo lease_token
  INSERT INTO public.stripe_processed_events (
    event_id,
    event_type,
    environment,
    status,
    lease_token,
    processed_at,
    created_at
  )
  VALUES (
    trim(p_event_id),
    trim(p_event_type),
    COALESCE(p_environment, 'test'),
    'processing',
    v_lease_token,
    clock_timestamp(),
    clock_timestamp()
  )
  ON CONFLICT (event_id) DO NOTHING;

  IF FOUND THEN
    RETURN jsonb_build_object('claimed', true, 'lease_token', v_lease_token, 'attempt', 'initial');
  END IF;

  -- 2. Registro já existe: verificar status e posse do lease sob bloqueio
  SELECT status, processed_at, lease_token INTO v_current_status, v_processed_at, v_existing_token
  FROM public.stripe_processed_events
  WHERE event_id = trim(p_event_id)
  FOR UPDATE;

  -- Se já foi concluído com sucesso, descartar de forma estritamente idempotente
  IF v_current_status IN ('completed', 'processed') THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_completed');
  END IF;

  -- Se falhou anteriormente OU se está em 'processing' há mais de 5 minutos (worker anterior morreu/travou),
  -- permitir retry/reentrega gerando um novo lease_token (fencing token)
  IF v_current_status = 'failed' OR (v_current_status = 'processing' AND v_processed_at < clock_timestamp() - interval '5 minutes') THEN
    UPDATE public.stripe_processed_events
    SET status = 'processing',
        lease_token = v_lease_token,
        processed_at = clock_timestamp()
    WHERE event_id = trim(p_event_id);

    RETURN jsonb_build_object('claimed', true, 'lease_token', v_lease_token, 'attempt', 'recovered');
  END IF;

  -- Em execução ativa dentro do período de lease por outro worker
  RETURN jsonb_build_object('claimed', false, 'reason', 'active_lease');
END;
$$;

-- 5.2. Conclusão atômica com Fencing Token OBRIGATÓRIO
CREATE OR REPLACE FUNCTION public.complete_stripe_event(
  p_event_id text,
  p_lease_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Rejeição estrita se token for nulo ou em branco (sem rota alternativa)
  IF p_event_id IS NULL OR trim(p_event_id) = '' OR p_lease_token IS NULL OR trim(p_lease_token) = '' THEN
    RETURN false;
  END IF;

  -- Conclusão estrita: exige token válido, status processing e lease ainda vigente (<= 5 min)
  UPDATE public.stripe_processed_events
  SET status = 'completed',
      processed_at = clock_timestamp()
  WHERE event_id = trim(p_event_id)
    AND status = 'processing'
    AND lease_token = trim(p_lease_token)
    AND processed_at >= clock_timestamp() - interval '5 minutes';

  RETURN FOUND;
END;
$$;

-- 5.3. Registro de falha com Fencing Token OBRIGATÓRIO
CREATE OR REPLACE FUNCTION public.fail_stripe_event(
  p_event_id text,
  p_lease_token text,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Rejeição estrita se token for nulo ou em branco
  IF p_event_id IS NULL OR trim(p_event_id) = '' OR p_lease_token IS NULL OR trim(p_lease_token) = '' THEN
    RETURN false;
  END IF;

  -- Registro de falha estrito: exige token válido, status processing e lease ainda vigente
  UPDATE public.stripe_processed_events
  SET status = 'failed',
      processed_at = clock_timestamp()
  WHERE event_id = trim(p_event_id)
    AND status = 'processing'
    AND lease_token = trim(p_lease_token)
    AND processed_at >= clock_timestamp() - interval '5 minutes';

  RETURN FOUND;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. ATOMIC CANCELLATION RPC (PROTECTION AGAINST SUPERSEDED SUBSCRIPTIONS)
-- -----------------------------------------------------------------------------
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

  -- 1. Identificar o user_id da assinatura candidata para adquirir lock canônico por titular
  SELECT user_id INTO v_target_user_id
  FROM public.subscriptions
  WHERE stripe_subscription_id = trim(p_stripe_subscription_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'not_found', true);
  END IF;

  -- 2. SERIALIZAÇÃO CANÔNICA POR TITULAR (GATE 6 - R2E.12B.11)
  -- Adquire lock determinístico advisory + lock exclusivo de linha em public.profiles
  -- Garantindo que qualquer operação concorrente (sync, upgrade, outro cancel) para o mesmo titular
  -- seja estritamente enfileirada e avaliada sobre o estado comitado mais recente.
  IF v_target_user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(('x' || substr(md5(v_target_user_id::text), 1, 16))::bit(64)::bigint);
    PERFORM 1 FROM public.profiles WHERE id = v_target_user_id FOR UPDATE;
  END IF;

  -- 3. Buscar assinatura com bloqueio FOR UPDATE após bloqueio do titular
  SELECT id, user_id, status, plan_key, latest_event_timestamp
  INTO v_sub
  FROM public.subscriptions
  WHERE stripe_subscription_id = trim(p_stripe_subscription_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'not_found', true);
  END IF;

  -- 2. Guarda contra eventos fora de ordem
  IF p_event_timestamp IS NOT NULL AND v_sub.latest_event_timestamp IS NOT NULL THEN
    IF p_event_timestamp < v_sub.latest_event_timestamp THEN
      RETURN jsonb_build_object(
        'ok', true,
        'ignored_out_of_order', true,
        'message', 'Evento de cancelamento mais antigo que o estado atual registrado'
      );
    END IF;
  END IF;

  -- 3. Atualizar assinatura para 'canceled'
  -- Preserva latest_event_timestamp estritamente com o timestamp do evento (sem clock_timestamp fallback)
  UPDATE public.subscriptions
  SET status = 'canceled',
      plan_key = 'free',
      latest_event_timestamp = COALESCE(p_event_timestamp, latest_event_timestamp),
      updated_at = v_now
  WHERE id = v_sub.id;

  -- 4. Atualizar add-ons vinculados a esta assinatura específica
  UPDATE public.tenant_addons
  SET status = 'canceled',
      cancelled_at = v_now,
      updated_at = v_now
  WHERE stripe_subscription_id = trim(p_stripe_subscription_id);

  -- 5. Avaliação Atômica de Consistência do Perfil:
  -- Verifica se o usuário possui outra assinatura ativa (active, trialing ou past_due)
  -- Mantém a hierarquia correta de plano caso haja outra assinatura
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

    -- Atualiza profile atomicamente na mesma transação
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

-- -----------------------------------------------------------------------------
-- 7. UPGRADE RPC public.sync_subscription_atomic
-- -----------------------------------------------------------------------------
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
BEGIN
  IF p_user_id IS NULL OR p_stripe_subscription_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Parâmetros obrigatórios ausentes');
  END IF;

  -- 0. SERIALIZAÇÃO CANÔNICA POR TITULAR (GATE 6 - R2E.12B.11)
  -- Adquire lock determinístico advisory + lock exclusivo de linha em public.profiles
  -- Garantindo que qualquer operação concorrente (sync, upgrade, cancel) para o mesmo titular
  -- utilize a mesma disciplina de lock e seja estritamente serializada.
  PERFORM pg_advisory_xact_lock(('x' || substr(md5(p_user_id::text), 1, 16))::bit(64)::bigint);
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- 1. Verificação contra eventos fora de ordem (race condition guard)
  -- Executada exclusivamente quando p_event_timestamp for fornecido
  IF p_event_timestamp IS NOT NULL THEN
    SELECT latest_event_timestamp INTO v_stored_latest_event
    FROM public.subscriptions
    WHERE stripe_subscription_id = p_stripe_subscription_id;

    -- Se o evento recebido for estritamente mais antigo que o já processado, ignora mutação
    IF v_stored_latest_event IS NOT NULL AND p_event_timestamp < v_stored_latest_event THEN
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
    -- Preços legados (Elite R$ 59,90)
    ELSIF p_price_id IN ('price_1TVtgWPKG6q10UjrxRUCnyg1', 'price_1TVsefPKG6q10UjrKpTaUe71') THEN
      v_plan_slug := 'elite';
      v_billing_cycle := 'month';
    -- Lookup keys de Sandbox/Test
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
      -- Resolução via tabela public.plans considerando os 4 campos de preço
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

  -- 3. Upsert em Subscriptions
  -- IMPORTANTE: latest_event_timestamp armazena ESTRITAMENTE p_event_timestamp (SEM fallback para clock_timestamp)
  -- para não corromper a semântica de eventos Stripe com relógio local do banco
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
    updated_at = v_now;

  -- 4. Atualizar profile mantendo consistência canônica estrita
  -- Se o status desta assinatura for inativo/cancelado, verificar se o usuário possui outra assinatura ativa
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
    -- Assinatura ativa: seleciona o plano de maior hierarquia entre TODAS as assinaturas ativas do usuário
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
    'status', p_status
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. PERMISSÕES ESTRITAS DE EXECUÇÃO
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.claim_stripe_event(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.complete_stripe_event(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_stripe_event(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.fail_stripe_event(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_stripe_event(text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_subscription_atomic(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription_atomic(text, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, timestamptz) TO service_role;

COMMIT;
