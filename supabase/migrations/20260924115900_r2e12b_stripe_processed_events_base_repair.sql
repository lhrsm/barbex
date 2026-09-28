-- ==============================================================================
-- BARBEX — R2E.12B.17A: STRIPE IDEMPOTENCY BASE REPAIR
-- Purpose: Materialize missing foundational table public.stripe_processed_events
-- Target Table: public.stripe_processed_events
-- Dependency of: 20260924120000_r2e12b_plans_yearly_stripe_prices.sql
-- ==============================================================================

BEGIN;

-- 1. Create foundational idempotency table if not exists
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

-- 2. Verify schema integrity in case table already existed (fail-closed check)
DO $$
DECLARE
  v_col_count integer;
BEGIN
  SELECT count(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'stripe_processed_events'
    AND column_name IN ('id', 'event_id', 'event_type', 'environment', 'status', 'processed_at', 'created_at');
    
  IF v_col_count < 7 THEN
    RAISE EXCEPTION 'Incompatible public.stripe_processed_events schema: missing required foundational columns (found % of 7)', v_col_count;
  END IF;
END $$;

-- 3. Dedicated indexes for lookup and timeline ordering
CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_event_id
  ON public.stripe_processed_events (event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_created_at
  ON public.stripe_processed_events (created_at);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- 5. Strict Security Privileges (Internal Webhook Infrastructure: Service Role Only)
REVOKE ALL ON TABLE public.stripe_processed_events FROM PUBLIC;
REVOKE ALL ON TABLE public.stripe_processed_events FROM anon;
REVOKE ALL ON TABLE public.stripe_processed_events FROM authenticated;
GRANT ALL ON TABLE public.stripe_processed_events TO service_role;

COMMIT;
