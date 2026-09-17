-- ==============================================================================
-- ROLLBACK: PHASE 17C.M6E STRIPE IDEMPOTENCY & ATOMIC SUBSCRIPTION SYNC
-- ==============================================================================

DROP FUNCTION IF EXISTS public.sync_subscription_atomic(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text);
DROP FUNCTION IF EXISTS public.claim_stripe_event(text, text, text);
DROP TABLE IF EXISTS public.stripe_processed_events CASCADE;
