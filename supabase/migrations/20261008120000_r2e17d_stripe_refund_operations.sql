-- ==============================================================================
-- BARBEX R2E.17D: SUPER ADMIN STRIPE REFUND OPERATIONS LEDGER & CONCURRENCY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.stripe_refund_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL,
  stripe_refund_id text,
  stripe_payment_intent_id text NOT NULL,
  stripe_charge_id text,
  stripe_invoice_id text,
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'brl',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
  reason text NOT NULL CHECK (length(trim(reason)) >= 10),
  idempotency_key text NOT NULL UNIQUE,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_stripe_refund_ops_tenant
  ON public.stripe_refund_operations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_stripe_refund_ops_pi
  ON public.stripe_refund_operations (stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_stripe_refund_ops_refund_id
  ON public.stripe_refund_operations (stripe_refund_id);

ALTER TABLE public.stripe_refund_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admins can view and manage refund operations" ON public.stripe_refund_operations;
CREATE POLICY "Super Admins can view and manage refund operations"
  ON public.stripe_refund_operations
  FOR ALL
  TO authenticated
  USING (public.is_super_admin_user() = TRUE)
  WITH CHECK (public.is_super_admin_user() = TRUE);

GRANT ALL ON public.stripe_refund_operations TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.stripe_refund_operations TO authenticated;

-- RPC: Atomic Claim for Refund Operation
CREATE OR REPLACE FUNCTION public.claim_refund_operation(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_payment_intent_id text,
  p_invoice_id text,
  p_amount integer,
  p_currency text,
  p_reason text,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing record;
  v_new_id uuid;
BEGIN
  IF p_payment_intent_id IS NULL OR trim(p_payment_intent_id) = '' THEN
    RAISE EXCEPTION 'p_payment_intent_id is mandatory';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be greater than zero';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'p_reason must be at least 10 characters';
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'p_idempotency_key is mandatory';
  END IF;

  -- Advisory lock per payment intent to serialize concurrent refund requests
  PERFORM pg_advisory_xact_lock(hashtext('stripe_refund:' || p_payment_intent_id));

  -- Check existing idempotency key
  SELECT id, status, stripe_refund_id, amount, currency
  INTO v_existing
  FROM public.stripe_refund_operations
  WHERE idempotency_key = trim(p_idempotency_key);

  IF FOUND THEN
    IF v_existing.status = 'succeeded' THEN
      RETURN jsonb_build_object(
        'already_processed', true,
        'operation_id', v_existing.id,
        'stripe_refund_id', v_existing.stripe_refund_id,
        'amount', v_existing.amount,
        'currency', v_existing.currency
      );
    ELSIF v_existing.status = 'pending' THEN
      RETURN jsonb_build_object(
        'in_progress', true,
        'operation_id', v_existing.id
      );
    ELSE
      RETURN jsonb_build_object(
        'failed_previously', true,
        'operation_id', v_existing.id
      );
    END IF;
  END IF;

  -- Insert pending refund operation
  INSERT INTO public.stripe_refund_operations (
    tenant_id,
    actor_user_id,
    stripe_payment_intent_id,
    stripe_invoice_id,
    amount,
    currency,
    status,
    reason,
    idempotency_key,
    metadata
  ) VALUES (
    p_tenant_id,
    p_actor_user_id,
    trim(p_payment_intent_id),
    p_invoice_id,
    p_amount,
    lower(coalesce(p_currency, 'brl')),
    'pending',
    trim(p_reason),
    trim(p_idempotency_key),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'claimed', true,
    'operation_id', v_new_id
  );
END;
$$;

-- RPC: Complete Refund Operation
CREATE OR REPLACE FUNCTION public.complete_refund_operation(
  p_operation_id uuid,
  p_stripe_refund_id text,
  p_stripe_charge_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.stripe_refund_operations
  SET
    status = 'succeeded',
    stripe_refund_id = p_stripe_refund_id,
    stripe_charge_id = coalesce(p_stripe_charge_id, stripe_charge_id),
    updated_at = clock_timestamp()
  WHERE id = p_operation_id;

  RETURN FOUND;
END;
$$;

-- RPC: Fail Refund Operation
CREATE OR REPLACE FUNCTION public.fail_refund_operation(
  p_operation_id uuid,
  p_error_message text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.stripe_refund_operations
  SET
    status = 'failed',
    error_message = p_error_message,
    updated_at = clock_timestamp()
  WHERE id = p_operation_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_refund_operation(uuid, uuid, text, text, integer, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_refund_operation(uuid, uuid, text, text, integer, text, text, text, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_refund_operation(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_refund_operation(uuid, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fail_refund_operation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fail_refund_operation(uuid, text) TO authenticated, service_role;
