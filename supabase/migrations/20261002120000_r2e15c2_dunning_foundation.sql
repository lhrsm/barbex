-- ==============================================================================
-- BARBEX — R2E.15C.2: DUNNING PERSISTENCE & IDEMPOTENCY FOUNDATION
-- Migration: 20261002120000_r2e15c2_dunning_foundation.sql
-- ==============================================================================
-- Implements:
-- 1. public.dunning_notifications operational delivery & idempotency ledger
-- 2. Strict episode idempotency: UNIQUE (subscription_id, past_due_since, notification_type)
-- 3. In-app notification integration on public.notifications with deterministic unique_key
-- 4. Server-side recipient resolution: owner for email, owner + admins for in-app
-- 5. Deterministic reminder scanner (initial fallback, 3-day, 1-day, grace_expired)
-- 6. Transition-time atomic recovery intent creation (solving recovery clear race)
-- 7. Pre-send eligibility recheck authority (invalidating stale reminders upon recovery)
-- 8. Atomic claim with worker lease fencing, completion, and failure state transitions
-- 9. Deny-by-default RLS and granular privileges
-- 10. 12-month retention policy support
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.dunning_notifications
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dunning_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  past_due_since TIMESTAMPTZ NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('initial', 'three_day', 'one_day', 'grace_expired', 'recovery')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'retry', 'canceled')),
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id),
  recipient_email TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  claimed_at TIMESTAMPTZ,
  claim_token TEXT,
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  last_error_category TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  last_error_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT unq_dunning_episode_type UNIQUE (subscription_id, past_due_since, notification_type)
);

COMMENT ON TABLE public.dunning_notifications IS 'Dunning operational delivery ledger and idempotency store for transactional billing notifications (R2E.15C.2)';
COMMENT ON CONSTRAINT unq_dunning_episode_type ON public.dunning_notifications IS 'Guarantees strictly at most one dunning event of each type per delinquency episode';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dunning_claimable
  ON public.dunning_notifications (created_at ASC)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_dunning_sub_episode
  ON public.dunning_notifications (subscription_id, past_due_since);

CREATE INDEX IF NOT EXISTS idx_dunning_tenant
  ON public.dunning_notifications (tenant_id);

-- ------------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY & PERMISSIONS
-- ------------------------------------------------------------------------------

ALTER TABLE public.dunning_notifications ENABLE ROW LEVEL SECURITY;

-- Deny anon completely
REVOKE ALL ON TABLE public.dunning_notifications FROM anon;
REVOKE ALL ON TABLE public.dunning_notifications FROM PUBLIC;

-- Authenticated: Read-only access scoped strictly to tenant owner or tenant admin
DROP POLICY IF EXISTS "dunning_notifications_read_policy" ON public.dunning_notifications;
CREATE POLICY "dunning_notifications_read_policy"
  ON public.dunning_notifications
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('tenant_admin', 'super_admin')
    )
    OR tenant_id = auth.uid()
    OR recipient_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Service role has full access
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dunning_notifications TO service_role;
GRANT SELECT ON TABLE public.dunning_notifications TO authenticated;
GRANT SELECT ON TABLE public.tenant_memberships TO authenticated;
-- Ensure public.notifications cascades cleanly when tenant/profile is deleted
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_tenant_id_fkey,
  ADD CONSTRAINT notifications_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- 3. IN-APP BILLING NOTIFICATION INTEGRATION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.emit_in_app_billing_notification(
  p_subscription_id UUID,
  p_tenant_id UUID,
  p_past_due_since TIMESTAMPTZ,
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_action_link TEXT DEFAULT '/subscription'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin RECORD;
  v_count INTEGER := 0;
  v_unique_key TEXT;
  v_iso_past_due TEXT := to_char(p_past_due_since, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  -- Resolve all billing-authorized admins for this tenant server-side:
  -- 1) The tenant owner (profiles.id = p_tenant_id or subscription.user_id)
  -- 2) Members with role 'tenant_admin' or 'super_admin' in tenant_memberships
  FOR v_admin IN
    SELECT DISTINCT u.user_id
    FROM (
      SELECT p_tenant_id AS user_id
      UNION
      SELECT s.user_id FROM public.subscriptions s WHERE s.id = p_subscription_id
      UNION
      SELECT tm.user_id FROM public.tenant_memberships tm
      WHERE tm.tenant_id = p_tenant_id AND tm.role IN ('tenant_admin', 'super_admin')
    ) u
    JOIN public.profiles p ON p.id = u.user_id
    WHERE p.status = 'active'
  LOOP
    v_unique_key := 'billing:' || p_subscription_id || ':' || v_iso_past_due || ':' || p_notification_type || ':' || v_admin.user_id;

    -- Avoid duplicate in-app notifications
    IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE unique_key = v_unique_key) THEN
      INSERT INTO public.notifications (
        user_id,
        tenant_id,
        type,
        title,
        message,
        link,
        unique_key,
        read,
        is_read,
        metadata,
        created_at
      ) VALUES (
        v_admin.user_id,
        p_tenant_id,
        'billing_' || p_notification_type,
        p_title,
        p_message,
        p_action_link,
        v_unique_key,
        false,
        false,
        jsonb_build_object(
          'subscription_id', p_subscription_id,
          'past_due_since', p_past_due_since,
          'notification_type', p_notification_type
        ),
        clock_timestamp()
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_in_app_billing_notification(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_in_app_billing_notification(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.emit_in_app_billing_notification(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. INTENT CREATION RPC: record_dunning_intent
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_dunning_intent(
  p_subscription_id UUID,
  p_tenant_id UUID,
  p_past_due_since TIMESTAMPTZ,
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dunning_id UUID;
  v_recipient_user_id UUID;
  v_recipient_email TEXT;
BEGIN
  IF p_notification_type NOT IN ('initial', 'three_day', 'one_day', 'grace_expired', 'recovery') THEN
    RAISE EXCEPTION 'Tipo de notificação de cobrança inválido: %', p_notification_type;
  END IF;

  IF p_past_due_since IS NULL THEN
    RAISE EXCEPTION 'past_due_since não pode ser nulo para registro de dunning';
  END IF;

  -- Resolve primary subscription owner server-side
  SELECT s.user_id, COALESCE(p.contact_email, p.email)
  INTO v_recipient_user_id, v_recipient_email
  FROM public.subscriptions s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.id = p_subscription_id;

  IF v_recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'Assinatura % ou proprietário não encontrado', p_subscription_id;
  END IF;

  -- Insert into dunning_notifications (idempotent ON CONFLICT DO NOTHING)
  INSERT INTO public.dunning_notifications (
    subscription_id,
    tenant_id,
    past_due_since,
    notification_type,
    status,
    recipient_user_id,
    recipient_email,
    created_at,
    updated_at
  ) VALUES (
    p_subscription_id,
    p_tenant_id,
    p_past_due_since,
    p_notification_type,
    'pending',
    v_recipient_user_id,
    v_recipient_email,
    clock_timestamp(),
    clock_timestamp()
  )
  ON CONFLICT (subscription_id, past_due_since, notification_type) DO NOTHING
  RETURNING id INTO v_dunning_id;

  IF v_dunning_id IS NOT NULL THEN
    -- Also emit persistent in-app notifications
    PERFORM public.emit_in_app_billing_notification(
      p_subscription_id,
      p_tenant_id,
      p_past_due_since,
      p_notification_type,
      p_title,
      p_message,
      '/subscription'
    );
  END IF;

  RETURN v_dunning_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_dunning_intent(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_dunning_intent(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_dunning_intent(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 5. DETERMINISTIC REMINDER SCANNER: scan_and_enqueue_dunning_reminders
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.scan_and_enqueue_dunning_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_initial_count INTEGER := 0;
  v_three_day_count INTEGER := 0;
  v_one_day_count INTEGER := 0;
  v_expired_count INTEGER := 0;
  v_res UUID;
BEGIN
  -- Scan active past_due subscriptions strictly
  FOR v_sub IN
    SELECT
      s.id,
      s.user_id,
      s.past_due_since,
      s.grace_ends_at
    FROM public.subscriptions s
    WHERE s.status = 'past_due'
      AND s.past_due_since IS NOT NULL
      AND s.grace_ends_at IS NOT NULL
  LOOP
    -- 1. Check INITIAL (missing fallback)
    IF NOT EXISTS (
      SELECT 1 FROM public.dunning_notifications dn
      WHERE dn.subscription_id = v_sub.id
        AND dn.past_due_since = v_sub.past_due_since
        AND dn.notification_type = 'initial'
    ) THEN
      v_res := public.record_dunning_intent(
        v_sub.id,
        v_sub.user_id,
        v_sub.past_due_since,
        'initial',
        'Pagamento Pendente — Regularize sua Assinatura',
        'Identificamos uma pendência no pagamento da sua assinatura. Seu período de carência está ativo até ' || to_char(v_sub.grace_ends_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') || '.'
      );
      IF v_res IS NOT NULL THEN v_initial_count := v_initial_count + 1; END IF;
    END IF;

    -- 2. Check THREE_DAY window: remaining <= 3 days AND remaining > 1 day
    IF v_now >= (v_sub.grace_ends_at - INTERVAL '3 days')
       AND v_now < (v_sub.grace_ends_at - INTERVAL '1 day')
       AND NOT EXISTS (
         SELECT 1 FROM public.dunning_notifications dn
         WHERE dn.subscription_id = v_sub.id
           AND dn.past_due_since = v_sub.past_due_since
           AND dn.notification_type = 'three_day'
       ) THEN
      v_res := public.record_dunning_intent(
        v_sub.id,
        v_sub.user_id,
        v_sub.past_due_since,
        'three_day',
        'Aviso Importante: Restam 3 dias de Carência',
        'Sua assinatura Barbex continua com pagamento pendente. Restam aproximadamente 3 dias antes do bloqueio dos recursos comerciais.'
      );
      IF v_res IS NOT NULL THEN v_three_day_count := v_three_day_count + 1; END IF;
    END IF;

    -- 3. Check ONE_DAY window: remaining <= 1 day AND remaining > 0 (v_now < grace_ends_at)
    IF v_now >= (v_sub.grace_ends_at - INTERVAL '1 day')
       AND v_now < v_sub.grace_ends_at
       AND NOT EXISTS (
         SELECT 1 FROM public.dunning_notifications dn
         WHERE dn.subscription_id = v_sub.id
           AND dn.past_due_since = v_sub.past_due_since
           AND dn.notification_type = 'one_day'
       ) THEN
      v_res := public.record_dunning_intent(
        v_sub.id,
        v_sub.user_id,
        v_sub.past_due_since,
        'one_day',
        'Último Dia de Carência — Regularize Agora',
        'Amanhã encerra o período de carência da sua assinatura Barbex. Regularize seus dados de pagamento para evitar a suspensão de ferramentas comerciais.'
      );
      IF v_res IS NOT NULL THEN v_one_day_count := v_one_day_count + 1; END IF;
    END IF;

    -- 4. Check GRACE_EXPIRED: v_now >= grace_ends_at
    IF v_now >= v_sub.grace_ends_at
       AND NOT EXISTS (
         SELECT 1 FROM public.dunning_notifications dn
         WHERE dn.subscription_id = v_sub.id
           AND dn.past_due_since = v_sub.past_due_since
           AND dn.notification_type = 'grace_expired'
       ) THEN
      v_res := public.record_dunning_intent(
        v_sub.id,
        v_sub.user_id,
        v_sub.past_due_since,
        'grace_expired',
        'Período de Carência Encerrado',
        'O período de carência da sua assinatura expirou. Recursos comerciais adicionais foram suspensos até a regularização do pagamento.'
      );
      IF v_res IS NOT NULL THEN v_expired_count := v_expired_count + 1; END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'scanned_at', v_now,
    'enqueued_initial', v_initial_count,
    'enqueued_three_day', v_three_day_count,
    'enqueued_one_day', v_one_day_count,
    'enqueued_expired', v_expired_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.scan_and_enqueue_dunning_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.scan_and_enqueue_dunning_reminders() FROM anon;
GRANT EXECUTE ON FUNCTION public.scan_and_enqueue_dunning_reminders() TO service_role;

-- ------------------------------------------------------------------------------
-- 6. ATOMIC CLAIM RPC: claim_next_dunning_notification
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_next_dunning_notification(
  p_worker_id TEXT DEFAULT 'worker-default',
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  id UUID,
  subscription_id UUID,
  tenant_id UUID,
  past_due_since TIMESTAMPTZ,
  notification_type TEXT,
  status TEXT,
  recipient_user_id UUID,
  recipient_email TEXT,
  attempt_count INTEGER,
  claim_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec_id UUID;
  v_lease_sec INTEGER := GREATEST(COALESCE(p_lease_seconds, 300), 30);
  v_token TEXT := p_worker_id || ':' || gen_random_uuid()::text;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- First auto-reconcile stale processing records whose lease has expired
  UPDATE public.dunning_notifications dn_stale
  SET
    status = CASE WHEN dn_stale.attempt_count >= dn_stale.max_attempts THEN 'failed' ELSE 'retry' END,
    claim_token = NULL,
    claimed_at = NULL,
    last_error_category = 'worker_lease_timeout',
    last_error_message = 'Worker lease expirou antes da conclusão',
    updated_at = v_now
  WHERE dn_stale.status = 'processing'
    AND dn_stale.claimed_at IS NOT NULL
    AND dn_stale.claimed_at < (v_now - (v_lease_sec || ' seconds')::INTERVAL);

  -- Select next pending or retryable notification with pessimistic lock
  SELECT dn.id INTO v_rec_id
  FROM public.dunning_notifications dn
  WHERE dn.status IN ('pending', 'retry')
    AND (dn.next_attempt_at IS NULL OR dn.next_attempt_at <= v_now)
    AND dn.attempt_count < dn.max_attempts
  ORDER BY dn.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_rec_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.dunning_notifications dn
  SET
    status = 'processing',
    claimed_at = v_now,
    claim_token = v_token,
    attempt_count = dn.attempt_count + 1,
    updated_at = v_now
  WHERE dn.id = v_rec_id
  RETURNING
    dn.id,
    dn.subscription_id,
    dn.tenant_id,
    dn.past_due_since,
    dn.notification_type,
    dn.status,
    dn.recipient_user_id,
    dn.recipient_email,
    dn.attempt_count,
    dn.claim_token;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_dunning_notification(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_next_dunning_notification(TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_next_dunning_notification(TEXT, INTEGER) TO service_role;

-- ------------------------------------------------------------------------------
-- 7. PRE-SEND ELIGIBILITY RECHECK: check_dunning_presend_eligibility
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_dunning_presend_eligibility(
  p_dunning_id UUID,
  p_claim_token TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn RECORD;
  v_sub RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_dunning_id IS NULL OR p_claim_token IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'missing_parameters');
  END IF;

  SELECT * INTO v_dn
  FROM public.dunning_notifications
  WHERE id = p_dunning_id;

  IF v_dn.id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'dunning_not_found');
  END IF;

  -- Validate lease claim ownership
  IF v_dn.claim_token IS DISTINCT FROM p_claim_token THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'claim_token_mismatch');
  END IF;

  -- Check current subscription state
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE id = v_dn.subscription_id;

  IF v_sub.id IS NULL THEN
    UPDATE public.dunning_notifications
    SET status = 'canceled', last_error_category = 'subscription_deleted', updated_at = v_now
    WHERE id = p_dunning_id AND claim_token = p_claim_token;
    RETURN jsonb_build_object('eligible', false, 'reason', 'subscription_deleted');
  END IF;

  -- For delinquency notifications: initial, three_day, one_day, grace_expired
  IF v_dn.notification_type IN ('initial', 'three_day', 'one_day', 'grace_expired') THEN
    -- If subscription has already recovered to active or was canceled
    IF v_sub.status <> 'past_due' THEN
      UPDATE public.dunning_notifications
      SET status = 'canceled',
          last_error_category = 'recovered_before_send',
          last_error_message = 'Assinatura recuperou antes do envio do lembrete',
          updated_at = v_now
      WHERE id = p_dunning_id AND claim_token = p_claim_token;
      RETURN jsonb_build_object('eligible', false, 'reason', 'subscription_no_longer_past_due');
    END IF;

    -- Validate episode timestamp match
    IF v_sub.past_due_since IS DISTINCT FROM v_dn.past_due_since THEN
      UPDATE public.dunning_notifications
      SET status = 'canceled',
          last_error_category = 'episode_mismatch',
          last_error_message = 'Episódio de inadimplência mudou antes do envio',
          updated_at = v_now
      WHERE id = p_dunning_id AND claim_token = p_claim_token;
      RETURN jsonb_build_object('eligible', false, 'reason', 'episode_changed');
    END IF;

    -- For 3-day reminder: stale if 1-day window already reached
    IF v_dn.notification_type = 'three_day' AND v_now >= (v_sub.grace_ends_at - INTERVAL '1 day') THEN
      UPDATE public.dunning_notifications
      SET status = 'canceled',
          last_error_category = 'superseded_by_newer_window',
          last_error_message = 'Lembrete de 3 dias superado pela janela de 1 dia',
          updated_at = v_now
      WHERE id = p_dunning_id AND claim_token = p_claim_token;
      RETURN jsonb_build_object('eligible', false, 'reason', 'three_day_superseded');
    END IF;

    -- For 1-day reminder: stale if grace already expired
    IF v_dn.notification_type = 'one_day' AND v_now >= v_sub.grace_ends_at THEN
      UPDATE public.dunning_notifications
      SET status = 'canceled',
          last_error_category = 'superseded_by_grace_expired',
          last_error_message = 'Lembrete de 1 dia superado pela expiração da carência',
          updated_at = v_now
      WHERE id = p_dunning_id AND claim_token = p_claim_token;
      RETURN jsonb_build_object('eligible', false, 'reason', 'one_day_superseded');
    END IF;

  ELSIF v_dn.notification_type = 'recovery' THEN
    -- Recovery notification requires subscription status to be paid/active
    IF v_sub.status NOT IN ('active', 'trialing') THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'subscription_not_active');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'subscription_id', v_sub.id,
    'tenant_id', v_dn.tenant_id,
    'notification_type', v_dn.notification_type,
    'recipient_email', v_dn.recipient_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_dunning_presend_eligibility(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_dunning_presend_eligibility(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_dunning_presend_eligibility(UUID, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 8. COMPLETION RPC: complete_dunning_notification
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_dunning_notification(
  p_dunning_id UUID,
  p_claim_token TEXT,
  p_provider_message_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER := 0;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_dunning_id IS NULL OR p_claim_token IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.dunning_notifications
  SET
    status = 'sent',
    claim_token = NULL,
    claimed_at = NULL,
    provider_message_id = p_provider_message_id,
    sent_at = v_now,
    last_error_category = NULL,
    last_error_code = NULL,
    last_error_message = NULL,
    updated_at = v_now
  WHERE id = p_dunning_id
    AND status = 'processing'
    AND claim_token = p_claim_token;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_dunning_notification(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_dunning_notification(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_dunning_notification(UUID, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 9. FAILURE RPC: fail_dunning_notification
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fail_dunning_notification(
  p_dunning_id UUID,
  p_claim_token TEXT,
  p_error_category TEXT,
  p_error_code TEXT,
  p_error_message TEXT,
  p_retryable BOOLEAN DEFAULT TRUE,
  p_retry_delay_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn RECORD;
  v_delay_sec INTEGER := GREATEST(COALESCE(p_retry_delay_seconds, 300), 30);
  v_now TIMESTAMPTZ := clock_timestamp();
  v_will_retry BOOLEAN;
BEGIN
  IF p_dunning_id IS NULL OR p_claim_token IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_dn
  FROM public.dunning_notifications
  WHERE id = p_dunning_id
    AND status = 'processing'
    AND claim_token = p_claim_token;

  IF v_dn.id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_will_retry := p_retryable AND (v_dn.attempt_count < v_dn.max_attempts);

  UPDATE public.dunning_notifications
  SET
    status = CASE WHEN v_will_retry THEN 'retry' ELSE 'failed' END,
    next_attempt_at = CASE WHEN v_will_retry THEN v_now + (v_delay_sec || ' seconds')::INTERVAL ELSE NULL END,
    claim_token = NULL,
    claimed_at = NULL,
    last_error_category = p_error_category,
    last_error_code = p_error_code,
    last_error_message = p_error_message,
    last_error_at = v_now,
    updated_at = v_now
  WHERE id = p_dunning_id
    AND status = 'processing'
    AND claim_token = p_claim_token;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_dunning_notification(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_dunning_notification(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.fail_dunning_notification(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) TO service_role;

-- ------------------------------------------------------------------------------
-- 10. RETENTION POLICY SUPPORT: purge_expired_dunning_records
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_expired_dunning_records(
  p_retention_days INTEGER DEFAULT 365
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_days INTEGER := GREATEST(COALESCE(p_retention_days, 365), 30);
BEGIN
  DELETE FROM public.dunning_notifications
  WHERE status IN ('sent', 'canceled', 'failed')
    AND created_at < (clock_timestamp() - (v_days || ' days')::INTERVAL);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_dunning_records(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_dunning_records(INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.purge_expired_dunning_records(INTEGER) TO service_role;

-- ------------------------------------------------------------------------------
-- 11. UPGRADE RPC: sync_subscription_atomic (WITH DUNNING OUTBOX INTEGRATION)
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
  v_is_new_delinquency_episode boolean := false;
  v_is_recovery_transition boolean := false;
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
    IF v_existing_id IS NOT NULL AND v_existing_status = 'past_due'
       AND v_existing_past_due_since IS NOT NULL AND v_existing_grace_ends_at IS NOT NULL THEN
      -- REPEATED PAST_DUE: Preserve existing episode (NO extension / NO reset)
      v_target_past_due_since := v_existing_past_due_since;
      v_target_grace_ends_at := v_existing_grace_ends_at;
      v_target_payment_failed_at := v_existing_payment_failed_at;
    ELSE
      -- NEW DELINQUENCY EPISODE
      SELECT grace_period_days INTO v_configured_grace_days
      FROM public.system_settings
      LIMIT 1;

      IF v_configured_grace_days IS NULL OR v_configured_grace_days < 1 OR v_configured_grace_days > 30 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Configuração de período de carência inválida ou ausente');
      END IF;

      v_target_past_due_since := COALESCE(p_event_timestamp, v_now);
      v_target_grace_ends_at := v_target_past_due_since + (v_configured_grace_days || ' days')::interval;
      v_target_payment_failed_at := v_existing_payment_failed_at;
      v_audit_action := 'billing.grace_started';
      v_is_new_delinquency_episode := true;
    END IF;
  ELSIF p_status = 'active' THEN
    -- RECOVERY: Clear delinquency episode
    v_target_past_due_since := NULL;
    v_target_grace_ends_at := NULL;
    v_target_payment_failed_at := NULL;
    IF v_existing_status = 'past_due' THEN
      v_audit_action := 'billing.grace_recovered';
      v_is_recovery_transition := true;
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
    v_target_past_due_since := NULL;
    v_target_grace_ends_at := NULL;
    v_target_payment_failed_at := v_existing_payment_failed_at;
  END IF;

  -- 4. Upsert em Subscriptions
  INSERT INTO public.subscriptions (
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    price_id,
    product_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    environment,
    latest_event_timestamp,
    past_due_since,
    grace_ends_at,
    payment_failed_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    COALESCE(p_price_id, 'price_missing'),
    COALESCE(p_product_id, 'prod_missing'),
    p_status,
    p_period_start,
    p_period_end,
    p_cancel_at_period_end,
    p_environment,
    p_event_timestamp,
    v_target_past_due_since,
    v_target_grace_ends_at,
    v_target_payment_failed_at,
    v_now,
    v_now
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    price_id = EXCLUDED.price_id,
    product_id = EXCLUDED.product_id,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    environment = EXCLUDED.environment,
    latest_event_timestamp = COALESCE(p_event_timestamp, subscriptions.latest_event_timestamp),
    past_due_since = EXCLUDED.past_due_since,
    grace_ends_at = EXCLUDED.grace_ends_at,
    payment_failed_at = EXCLUDED.payment_failed_at,
    updated_at = v_now
  RETURNING id INTO v_existing_id;

  -- 5. ATOMIC DUNNING OUTBOX INTEGRATION (R2E.15C.2)
  -- A. New delinquency episode starts -> emit INITIAL notice exactly once
  IF v_is_new_delinquency_episode AND v_existing_id IS NOT NULL THEN
    PERFORM public.record_dunning_intent(
      v_existing_id,
      p_user_id,
      v_target_past_due_since,
      'initial',
      'Pagamento Pendente — Regularize sua Assinatura',
      'Identificamos uma pendência no pagamento da sua assinatura. Seu período de carência está ativo até ' || to_char(v_target_grace_ends_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') || '.'
    );
  END IF;

  -- B. Recovery from past_due -> emit RECOVERY notice exactly once for that episode
  IF v_is_recovery_transition AND v_existing_id IS NOT NULL AND v_existing_past_due_since IS NOT NULL THEN
    PERFORM public.record_dunning_intent(
      v_existing_id,
      p_user_id,
      v_existing_past_due_since,
      'recovery',
      'Assinatura Regularizada com Sucesso',
      'Confirmamos a regularização do pagamento da sua assinatura Barbex. Todos os recursos foram restabelecidos.'
    );
  END IF;

  -- 6. Manutenção da projeção canônica do perfil
  SELECT p2.slug INTO v_other_plan
  FROM public.subscriptions s2
  JOIN public.plans p2 ON (
    p2.stripe_price_id_live = s2.price_id
    OR p2.stripe_yearly_price_id_live = s2.price_id
    OR p2.stripe_price_id_test = s2.price_id
    OR p2.stripe_yearly_price_id_test = s2.price_id
  )
  WHERE s2.user_id = p_user_id
    AND s2.status IN ('active', 'trialing', 'past_due')
    AND p2.active = true
  ORDER BY
    CASE p2.slug
      WHEN 'elite' THEN 3
      WHEN 'pro' THEN 2
      WHEN 'starter' THEN 1
      ELSE 0
    END DESC
  LIMIT 1;

  IF v_other_plan IS NOT NULL THEN
    v_plan_slug := v_other_plan;
  END IF;

  UPDATE public.profiles
  SET plan = v_plan_slug,
      updated_at = v_now
  WHERE id = p_user_id;

  -- 7. Auditoria Atômica de Grace
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
        'subscription_id', v_existing_id,
        'previous_status', v_existing_status,
        'new_status', p_status,
        'status', p_status,
        'past_due_since', v_target_past_due_since,
        'grace_ends_at', v_target_grace_ends_at,
        'previous_past_due_since', v_existing_past_due_since,
        'timestamp', v_now
      ),
      NULL,
      v_now
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'subscription_id', v_existing_id,
    'user_id', p_user_id,
    'plan', v_plan_slug,
    'billing_cycle', v_billing_cycle,
    'status', p_status,
    'past_due_since', v_target_past_due_since,
    'grace_ends_at', v_target_grace_ends_at,
    'audit_action', v_audit_action
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, timestamptz) TO service_role;
