-- =============================================================================
-- BARBEX — R2E.16H.2B: BASE PLAN STRIPE TEST MAPPING REPAIR
-- Target Table: public.plans
-- Scope: Exactly 3 canonical rows ('starter', 'pro', 'elite')
-- Purpose:
--   Populates canonical Stripe Test Product and Price IDs (monthly & annual).
--   Replaces historical legacy monetary strings ("59,90", etc.) in stripe_price_id_test.
--   Populates missing annual Test Price IDs and Product IDs.
--
-- Safety & Invariants:
--   - STRICT FAIL-CLOSED: Validates pre-conditions and post-conditions.
--   - ZERO MUTATION of Live mappings (stripe_*_live).
--   - ZERO MUTATION of monetary amounts (price_monthly, price_yearly).
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

  -- Verify no concurrent unexpected Test Price ID exists (must be NULL, legacy monetary string, or already target)
  SELECT stripe_price_id_test INTO v_invalid_price
  FROM public.plans
  WHERE slug = 'starter'
    AND stripe_price_id_test IS NOT NULL
    AND stripe_price_id_test NOT IN ('59,90', 'price_1UJrndPKG6q10UjrOh0rqWUQ')
  LIMIT 1;

  IF v_invalid_price IS NOT NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Starter has unexpected stripe_price_id_test: %', v_invalid_price;
  END IF;

  SELECT stripe_price_id_test INTO v_invalid_price
  FROM public.plans
  WHERE slug = 'pro'
    AND stripe_price_id_test IS NOT NULL
    AND stripe_price_id_test NOT IN ('99,90', 'price_1UJroIPKG6q10UjrzvrZu9FX')
  LIMIT 1;

  IF v_invalid_price IS NOT NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Pro has unexpected stripe_price_id_test: %', v_invalid_price;
  END IF;

  SELECT stripe_price_id_test INTO v_invalid_price
  FROM public.plans
  WHERE slug = 'elite'
    AND stripe_price_id_test IS NOT NULL
    AND stripe_price_id_test NOT IN ('149,90', 'price_1UJrp4PKG6q10UjrEB7Iy7RZ')
  LIMIT 1;

  IF v_invalid_price IS NOT NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Elite has unexpected stripe_price_id_test: %', v_invalid_price;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. ENSURE TARGET TEST COLUMNS EXIST
-- -----------------------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_product_id_test text,
  ADD COLUMN IF NOT EXISTS stripe_yearly_price_id_test text;

-- -----------------------------------------------------------------------------
-- 3. CANONICAL STRIPE TEST MAPPING UPDATES
-- -----------------------------------------------------------------------------

-- 3.1. Starter Plan (R$ 59.90/mo | R$ 499.00/yr Test)
UPDATE public.plans
SET
  stripe_product_id_test       = 'prod_VKWq9S7RZgrX3j',
  stripe_price_id_test         = 'price_1UJrndPKG6q10UjrOh0rqWUQ',
  stripe_yearly_price_id_test  = 'price_1UJrntPKG6q10Ujr5NZvGFcs',
  updated_at                   = now()
WHERE slug = 'starter';

-- 3.2. Pro Plan (R$ 99.90/mo | R$ 999.00/yr Test)
UPDATE public.plans
SET
  stripe_product_id_test       = 'prod_VKWrJsN3EnYsLv',
  stripe_price_id_test         = 'price_1UJroIPKG6q10UjrzvrZu9FX',
  stripe_yearly_price_id_test  = 'price_1UJroZPKG6q10Ujr3BhHgRpG',
  updated_at                   = now()
WHERE slug = 'pro';

-- 3.3. Elite Plan (R$ 149.90/mo | R$ 1499.00/yr Test)
UPDATE public.plans
SET
  stripe_product_id_test       = 'prod_VKWsIELFcSxXLr',
  stripe_price_id_test         = 'price_1UJrp4PKG6q10UjrEB7Iy7RZ',
  stripe_yearly_price_id_test  = 'price_1UJrpUPKG6q10UjruyBirOlI',
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
  -- Verify all 3 plans match exact canonical Test targets
  SELECT count(*) INTO v_verified_count
  FROM public.plans
  WHERE (
    slug = 'starter'
    AND stripe_product_id_test = 'prod_VKWq9S7RZgrX3j'
    AND stripe_price_id_test = 'price_1UJrndPKG6q10UjrOh0rqWUQ'
    AND stripe_yearly_price_id_test = 'price_1UJrntPKG6q10Ujr5NZvGFcs'
  ) OR (
    slug = 'pro'
    AND stripe_product_id_test = 'prod_VKWrJsN3EnYsLv'
    AND stripe_price_id_test = 'price_1UJroIPKG6q10UjrzvrZu9FX'
    AND stripe_yearly_price_id_test = 'price_1UJroZPKG6q10Ujr3BhHgRpG'
  ) OR (
    slug = 'elite'
    AND stripe_product_id_test = 'prod_VKWsIELFcSxXLr'
    AND stripe_price_id_test = 'price_1UJrp4PKG6q10UjrEB7Iy7RZ'
    AND stripe_yearly_price_id_test = 'price_1UJrpUPKG6q10UjruyBirOlI'
  );

  IF v_verified_count <> 3 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Target Test mappings did not match canonical values (matched: %/3)', v_verified_count;
  END IF;

  -- Ensure no residual commas or malformed IDs in Test mapping columns
  SELECT count(*) INTO v_anomaly_count
  FROM public.plans
  WHERE slug IN ('starter', 'pro', 'elite')
    AND (
      stripe_price_id_test LIKE '%,%'
      OR stripe_yearly_price_id_test LIKE '%,%'
      OR stripe_price_id_test NOT LIKE 'price_%'
      OR stripe_yearly_price_id_test NOT LIKE 'price_%'
      OR stripe_product_id_test NOT LIKE 'prod_%'
    );

  IF v_anomaly_count > 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Anomaly detected in Test mapping format (anomalies: %)', v_anomaly_count;
  END IF;
END $$;

COMMIT;
