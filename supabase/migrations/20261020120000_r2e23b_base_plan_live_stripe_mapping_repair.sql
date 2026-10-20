-- =============================================================================
-- BARBEX — R2E.23B.1: BASE PLAN STRIPE LIVE MAPPING REPAIR
-- Target Table: public.plans
-- Scope: Exactly 3 canonical rows ('starter', 'pro', 'elite')
-- Migration Version: 20261020120000
-- Purpose:
--   Populates and verifies canonical Stripe Live Product and Price IDs (monthly & annual).
--   Resolves P1 finding from R2E.23A audit with idempotent, fail-closed enforcement.
--
-- Safety & Invariants:
--   - STRICT FAIL-CLOSED: Preconditions and postconditions validated with RAISE EXCEPTION.
--   - ZERO MUTATION of monetary amounts (price_monthly, price_yearly).
--   - ZERO MUTATION of Test mappings (stripe_*_test).
--   - ZERO MUTATION of customer data, subscriptions, or tenant state.
--   - IDEMPOTENT: Safe to run multiple times without unintended state drift.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. PRECONDITION VALIDATION
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_plan_count integer;
  v_unexpected_val text;
BEGIN
  -- Verify all 3 canonical base plans exist
  SELECT count(*) INTO v_plan_count
  FROM public.plans
  WHERE slug IN ('starter', 'pro', 'elite');

  IF v_plan_count <> 3 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Expected exactly 3 canonical plans (starter, pro, elite), found %', v_plan_count;
  END IF;

  -- Verify Starter has no unexpected non-null Live Price ID (must be NULL or already target)
  SELECT stripe_price_id_live INTO v_unexpected_val
  FROM public.plans
  WHERE slug = 'starter'
    AND stripe_price_id_live IS NOT NULL
    AND stripe_price_id_live <> 'price_1TVtOWPKG6q10UjrQErPgyKO'
  LIMIT 1;

  IF v_unexpected_val IS NOT NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Starter has unexpected stripe_price_id_live: %', v_unexpected_val;
  END IF;

  -- Verify Pro has no unexpected non-null Live Price ID
  SELECT stripe_price_id_live INTO v_unexpected_val
  FROM public.plans
  WHERE slug = 'pro'
    AND stripe_price_id_live IS NOT NULL
    AND stripe_price_id_live <> 'price_1TVtOVPKG6q10Ujre6zMGYpk'
  LIMIT 1;

  IF v_unexpected_val IS NOT NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Pro has unexpected stripe_price_id_live: %', v_unexpected_val;
  END IF;

  -- Verify Elite has no unexpected non-null Live Price ID
  SELECT stripe_price_id_live INTO v_unexpected_val
  FROM public.plans
  WHERE slug = 'elite'
    AND stripe_price_id_live IS NOT NULL
    AND stripe_price_id_live <> 'price_1TmYG0PKG6q10UjrOx8tEehr'
  LIMIT 1;

  IF v_unexpected_val IS NOT NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Elite has unexpected stripe_price_id_live: %', v_unexpected_val;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. CANONICAL STRIPE LIVE MAPPING UPDATES
-- -----------------------------------------------------------------------------

-- 2.1. Starter Plan (R$ 59,90/mês | R$ 499,00/ano Live)
UPDATE public.plans
SET
  stripe_product_id_live       = 'prod_UUtAMkyffs3hei',
  stripe_price_id_live         = 'price_1TVtOWPKG6q10UjrQErPgyKO',
  stripe_yearly_price_id_live  = 'price_1UJDZBPKG6q10UjrQrf3rHBS',
  updated_at                   = now()
WHERE slug = 'starter'
  AND (id = '90f24904-6d57-40d0-bc16-533da6c9f168' OR id = '23689b12-84ea-43a8-92ce-80da4094b1de' OR id IS NOT NULL);

-- 2.2. Pro Plan (R$ 99,90/mês | R$ 999,00/ano Live)
UPDATE public.plans
SET
  stripe_product_id_live       = 'prod_UUtAGJzYKaux3J',
  stripe_price_id_live         = 'price_1TVtOVPKG6q10Ujre6zMGYpk',
  stripe_yearly_price_id_live  = 'price_1UJDaCPKG6q10UjrWOjctNmr',
  updated_at                   = now()
WHERE slug = 'pro'
  AND (id = 'b2d0b9f0-714d-4e34-bffa-fe2af36d9200' OR id = '331d6350-5e48-4300-86c7-4b834edd270c' OR id IS NOT NULL);

-- 2.3. Elite Plan (R$ 149,90/mês | R$ 1.499,00/ano Live)
UPDATE public.plans
SET
  stripe_product_id_live       = 'prod_UUtTTRItozWDdd',
  stripe_price_id_live         = 'price_1TmYG0PKG6q10UjrOx8tEehr',
  stripe_yearly_price_id_live  = 'price_1UJDX4PKG6q10UjrzkytrHAJ',
  updated_at                   = now()
WHERE slug = 'elite'
  AND (id = '2b4c3225-3b35-48c5-a8a0-2c84e2a10c41' OR id = 'fe73232b-429f-4096-93f5-1db36b3a978e' OR id IS NOT NULL);

-- -----------------------------------------------------------------------------
-- 3. POSTCONDITION ASSERTIONS (FAIL-CLOSED INTEGRITY CHECK)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_verified_count integer;
  v_test_mutated_count integer;
BEGIN
  -- Verify all 3 plans match exact canonical Live targets
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
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Target Live mappings did not match canonical values (matched: %/3)', v_verified_count;
  END IF;

  -- Invariant: Ensure Test mappings were NOT mutated
  SELECT count(*) INTO v_test_mutated_count
  FROM public.plans
  WHERE (slug = 'starter' AND stripe_price_id_test <> 'price_1UJrndPKG6q10UjrOh0rqWUQ')
     OR (slug = 'pro' AND stripe_price_id_test <> 'price_1UJroIPKG6q10UjrzvrZu9FX')
     OR (slug = 'elite' AND stripe_price_id_test <> 'price_1UJrp4PKG6q10UjrEB7Iy7RZ');

  IF v_test_mutated_count > 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Invariant violated: Test mappings were unexpectedly altered (% rows)', v_test_mutated_count;
  END IF;
END $$;

COMMIT;
