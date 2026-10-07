-- =============================================================================
-- BARBEX — R2E.16H.2A: CONTROLLED BASE PLAN STRIPE LIVE MAPPING REPAIR
-- Target Table: public.plans
-- Scope: Exactly 3 canonical rows ('starter', 'pro', 'elite')
-- Purpose:
--   Populates canonical Stripe Live Product and Price IDs (monthly & annual).
--   Replaces historical legacy monetary strings ("59,90", etc.) in stripe_price_id_live.
--   Populates missing annual Live Price IDs and Product IDs.
--
-- Safety & Invariants:
--   - STRICT FAIL-CLOSED: Validates pre-conditions and post-conditions.
--   - ZERO MUTATION of monetary amounts (price_monthly, price_yearly).
--   - ZERO MUTATION of Test mappings (stripe_*_test).
--   - ZERO MUTATION of add-on catalog (public.saas_addons).
--   - ZERO MUTATION of customer data, subscriptions, or tenant state.
--   - IDEMPOTENT: Re-running does not corrupt data or raise errors.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. PRECONDITION VALIDATION
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_plan_count integer;
  v_invalid_price text;
BEGIN
  -- Verify all 3 canonical base plans exist
  SELECT count(*) INTO v_plan_count
  FROM public.plans
  WHERE slug IN ('starter', 'pro', 'elite');

  IF v_plan_count <> 3 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Expected exactly 3 canonical plans (starter, pro, elite), found %', v_plan_count;
  END IF;

  -- Verify no concurrent unexpected Price ID exists (must be NULL, legacy monetary string, or already target)
  SELECT stripe_price_id_live INTO v_invalid_price
  FROM public.plans
  WHERE slug = 'starter'
    AND stripe_price_id_live IS NOT NULL
    AND stripe_price_id_live NOT IN ('59,90', 'price_1TVtOWPKG6q10UjrQErPgyKO')
  LIMIT 1;

  IF v_invalid_price IS NOT NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Starter has unexpected stripe_price_id_live: %', v_invalid_price;
  END IF;

  SELECT stripe_price_id_live INTO v_invalid_price
  FROM public.plans
  WHERE slug = 'pro'
    AND stripe_price_id_live IS NOT NULL
    AND stripe_price_id_live NOT IN ('99,90', 'price_1TVtOVPKG6q10Ujre6zMGYpk')
  LIMIT 1;

  IF v_invalid_price IS NOT NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Pro has unexpected stripe_price_id_live: %', v_invalid_price;
  END IF;

  SELECT stripe_price_id_live INTO v_invalid_price
  FROM public.plans
  WHERE slug = 'elite'
    AND stripe_price_id_live IS NOT NULL
    AND stripe_price_id_live NOT IN ('149,90', 'price_1TmYG0PKG6q10UjrOx8tEehr')
  LIMIT 1;

  IF v_invalid_price IS NOT NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Elite has unexpected stripe_price_id_live: %', v_invalid_price;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. ENSURE TARGET COLUMNS EXIST
-- -----------------------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_product_id_live text,
  ADD COLUMN IF NOT EXISTS stripe_yearly_price_id_live text;

-- -----------------------------------------------------------------------------
-- 3. CANONICAL STRIPE LIVE MAPPING UPDATES
-- -----------------------------------------------------------------------------

-- 3.1. Starter Plan (R$ 59.90/mo | R$ 499.00/yr)
UPDATE public.plans
SET
  stripe_product_id_live       = 'prod_UUtAMkyffs3hei',
  stripe_price_id_live         = 'price_1TVtOWPKG6q10UjrQErPgyKO',
  stripe_yearly_price_id_live  = 'price_1UJDZBPKG6q10UjrQrf3rHBS',
  updated_at                   = now()
WHERE slug = 'starter';

-- 3.2. Pro Plan (R$ 99.90/mo | R$ 999.00/yr)
UPDATE public.plans
SET
  stripe_product_id_live       = 'prod_UUtAGJzYKaux3J',
  stripe_price_id_live         = 'price_1TVtOVPKG6q10Ujre6zMGYpk',
  stripe_yearly_price_id_live  = 'price_1UJDaCPKG6q10UjrWOjctNmr',
  updated_at                   = now()
WHERE slug = 'pro';

-- 3.3. Elite Plan (R$ 149.90/mo | R$ 1499.00/yr)
UPDATE public.plans
SET
  stripe_product_id_live       = 'prod_UUtTTRItozWDdd',
  stripe_price_id_live         = 'price_1TmYG0PKG6q10UjrOx8tEehr',
  stripe_yearly_price_id_live  = 'price_1UJDX4PKG6q10UjrzkytrHAJ',
  updated_at                   = now()
WHERE slug = 'elite';

-- -----------------------------------------------------------------------------
-- 4. POSTCONDITION ASSERTIONS (FAIL-CLOSED INTEGRITY CHECK)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_verified_count integer;
  v_anomaly_count integer;
BEGIN
  -- Verify all 3 plans match exact canonical targets
  SELECT count(*) INTO v_verified_count
  FROM public.plans
  WHERE (
    slug = 'starter'
    AND stripe_product_id_live = 'prod_UUtAMkyffs3hei'
    AND stripe_price_id_live = 'price_1TVtOWPKG6q10UjrQErPgyKO'
    AND stripe_yearly_price_id_live = 'price_1UJDZBPKG6q10UjrQrf3rHBS'
  ) OR (
    slug = 'pro'
    AND stripe_product_id_live = 'prod_UUtAGJzYKaux3J'
    AND stripe_price_id_live = 'price_1TVtOVPKG6q10Ujre6zMGYpk'
    AND stripe_yearly_price_id_live = 'price_1UJDaCPKG6q10UjrWOjctNmr'
  ) OR (
    slug = 'elite'
    AND stripe_product_id_live = 'prod_UUtTTRItozWDdd'
    AND stripe_price_id_live = 'price_1TmYG0PKG6q10UjrOx8tEehr'
    AND stripe_yearly_price_id_live = 'price_1UJDX4PKG6q10UjrzkytrHAJ'
  );

  IF v_verified_count <> 3 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Target mappings did not match canonical values (matched: %/3)', v_verified_count;
  END IF;

  -- Ensure no residual commas or malformed IDs in Live mapping columns
  SELECT count(*) INTO v_anomaly_count
  FROM public.plans
  WHERE slug IN ('starter', 'pro', 'elite')
    AND (
      stripe_price_id_live LIKE '%,%'
      OR stripe_yearly_price_id_live LIKE '%,%'
      OR stripe_price_id_live NOT LIKE 'price_%'
      OR stripe_yearly_price_id_live NOT LIKE 'price_%'
      OR stripe_product_id_live NOT LIKE 'prod_%'
    );

  IF v_anomaly_count > 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Anomaly detected in Live mapping format (anomalies: %)', v_anomaly_count;
  END IF;
END $$;

COMMIT;
