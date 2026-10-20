-- =============================================================================
-- BARBEX — R2E.23B.1: BASE PLAN STRIPE LIVE MAPPING ROLLBACK SCRIPT
-- Target Table: public.plans
-- Location: scripts/rollback/ (Outside automated migrations)
-- Scope: Exactly 3 canonical rows ('starter', 'pro', 'elite')
-- Purpose:
--   Restores stripe_*_live columns back to their pre-cutover state if rollback is ever required.
--
-- Safety & Invariants:
--   - STRICT FAIL-CLOSED: Verifies exactly 3 rows updated.
--   - ZERO MUTATION of monetary amounts (price_monthly, price_yearly).
--   - ZERO MUTATION of Test mappings (stripe_*_test).
-- =============================================================================

BEGIN;

UPDATE public.plans
SET
  stripe_product_id_live       = NULL,
  stripe_price_id_live         = NULL,
  stripe_yearly_price_id_live  = NULL,
  updated_at                   = now()
WHERE slug IN ('starter', 'pro', 'elite');

-- Assertion
DO $$
DECLARE
  v_null_count integer;
BEGIN
  SELECT count(*) INTO v_null_count
  FROM public.plans
  WHERE slug IN ('starter', 'pro', 'elite')
    AND stripe_product_id_live IS NULL
    AND stripe_price_id_live IS NULL
    AND stripe_yearly_price_id_live IS NULL;

  IF v_null_count <> 3 THEN
    RAISE EXCEPTION 'ROLLBACK_FAILED: Expected 3 plans with NULL Live mappings, found %', v_null_count;
  END IF;
END $$;

COMMIT;
