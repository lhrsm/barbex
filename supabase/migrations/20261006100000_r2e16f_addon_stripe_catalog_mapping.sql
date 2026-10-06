-- ============================================================================
-- BARBEX — R2E.16F: STRIPE ADD-ON CATALOG MAPPING & COMMERCIAL PRICING
-- Persists Authoritative Physical Stripe IDs (R2E.16E) for the 7 Approved Add-ons
-- Idempotent, forward-only, non-destructive migration
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. AUTHORITATIVE STRIPE CATALOG MAPPING (7 Approved Add-ons)
-- ----------------------------------------------------------------------------

-- 1.1 advanced_finance (Financeiro Pro)
UPDATE public.saas_addons
   SET name = 'Barbex Add-on — Financeiro Pro',
       canonical_module_key = 'advanced_finance',
       monthly_price = 24.90,
       annual_price = 249.00,
       currency = 'BRL',
       stripe_product_id_test = 'prod_VNtU6mFHh7BIeA',
       stripe_price_id_test = 'price_1UN7hkPKG6q10UjrVQJMhKOd',
       stripe_price_id_annual_test = 'price_1UN7hoPKG6q10UjrTHflxnQ0',
       stripe_product_id_live = 'prod_VNtX3LEruEAPHq',
       stripe_price_id_live = 'price_1UN7kmPKG6q10Ujrow9qJlOO',
       stripe_price_id_annual_live = 'price_1UN7kqPKG6q10UjrKqKRTwwo',
       eligible_plan_keys = ARRAY['starter']::TEXT[],
       is_active = true,
       updated_at = clock_timestamp()
 WHERE addon_key = 'advanced_finance';

-- 1.2 stock (Controle de Estoque & Produtos)
UPDATE public.saas_addons
   SET name = 'Barbex Add-on — Controle de Estoque & Produtos',
       canonical_module_key = 'stock',
       monthly_price = 19.90,
       annual_price = 199.00,
       currency = 'BRL',
       stripe_product_id_test = 'prod_VNtUIircw6LBcV',
       stripe_price_id_test = 'price_1UN7huPKG6q10Ujr147F8CfP',
       stripe_price_id_annual_test = 'price_1UN7hyPKG6q10UjrzokL2iUz',
       stripe_product_id_live = 'prod_VNtXWOqnD0s995',
       stripe_price_id_live = 'price_1UN7kxPKG6q10UjrVSuJoHzY',
       stripe_price_id_annual_live = 'price_1UN7l0PKG6q10UjrTZrbtQyB',
       eligible_plan_keys = ARRAY['starter', 'pro']::TEXT[],
       is_active = true,
       updated_at = clock_timestamp()
 WHERE addon_key = 'stock';

-- 1.3 commissions (Gestão de Comissões Avançada)
UPDATE public.saas_addons
   SET name = 'Barbex Add-on — Gestão de Comissões Avançada',
       canonical_module_key = 'commissions',
       monthly_price = 19.90,
       annual_price = 199.00,
       currency = 'BRL',
       stripe_product_id_test = 'prod_VNtVKNFVA862HE',
       stripe_price_id_test = 'price_1UN7i6PKG6q10UjrCVzrm0o0',
       stripe_price_id_annual_test = 'price_1UN7iAPKG6q10Ujra7Yhm4LK',
       stripe_product_id_live = 'prod_VNtYOLhICI3n5L',
       stripe_price_id_live = 'price_1UN7l6PKG6q10UjrKAIDx4Oy',
       stripe_price_id_annual_live = 'price_1UN7lAPKG6q10Ujrj9tK7Tje',
       eligible_plan_keys = ARRAY['starter', 'pro']::TEXT[],
       is_active = true,
       updated_at = clock_timestamp()
 WHERE addon_key = 'commissions';

-- 1.4 reports_advanced (Relatórios & Analytics Avançado)
UPDATE public.saas_addons
   SET name = 'Barbex Add-on — Relatórios & Analytics Avançado',
       canonical_module_key = 'reports_advanced',
       monthly_price = 19.90,
       annual_price = 199.00,
       currency = 'BRL',
       stripe_product_id_test = 'prod_VNtVXOCMo7Ty82',
       stripe_price_id_test = 'price_1UN7iGPKG6q10UjrivhAmPCA',
       stripe_price_id_annual_test = 'price_1UN7iKPKG6q10UjrnzoU0UKV',
       stripe_product_id_live = 'prod_VNtYPW5OlwABop',
       stripe_price_id_live = 'price_1UN7lHPKG6q10UjrEeQFmuv3',
       stripe_price_id_annual_live = 'price_1UN7lKPKG6q10UjrxV05jkBs',
       eligible_plan_keys = ARRAY['starter']::TEXT[],
       is_active = true,
       updated_at = clock_timestamp()
 WHERE addon_key = 'reports_advanced';

-- 1.5 loyalty (Fidelidade & Cashback)
UPDATE public.saas_addons
   SET name = 'Barbex Add-on — Fidelidade & Cashback',
       canonical_module_key = 'loyalty',
       monthly_price = 19.90,
       annual_price = 199.00,
       currency = 'BRL',
       stripe_product_id_test = 'prod_VNtVqQG5ztEHSS',
       stripe_price_id_test = 'price_1UN7iRPKG6q10UjrN5HKnIA8',
       stripe_price_id_annual_test = 'price_1UN7iUPKG6q10UjrLGJ3TqMq',
       stripe_product_id_live = 'prod_VNtYd8lyvjJ4WF',
       stripe_price_id_live = 'price_1UN7lSPKG6q10UjrXmuT2P4s',
       stripe_price_id_annual_live = 'price_1UN7lVPKG6q10UjrWviXsxDY',
       eligible_plan_keys = ARRAY['starter', 'pro']::TEXT[],
       is_active = true,
       updated_at = clock_timestamp()
 WHERE addon_key = 'loyalty';

-- 1.6 coupons (Cupons & Promoções)
UPDATE public.saas_addons
   SET name = 'Barbex Add-on — Cupons & Promoções',
       canonical_module_key = 'coupons',
       monthly_price = 14.90,
       annual_price = 149.00,
       currency = 'BRL',
       stripe_product_id_test = 'prod_VNtVXAKb1kJt8q',
       stripe_price_id_test = 'price_1UN7ibPKG6q10UjrgjhuLPCA',
       stripe_price_id_annual_test = 'price_1UN7iePKG6q10UjrEUVp4LxG',
       stripe_product_id_live = 'prod_VNtYt5A9Efbd7T',
       stripe_price_id_live = 'price_1UN7lcPKG6q10UjrhxGhq2H9',
       stripe_price_id_annual_live = 'price_1UN7lgPKG6q10UjrRfhGVWDy',
       eligible_plan_keys = ARRAY['starter', 'pro']::TEXT[],
       is_active = true,
       updated_at = clock_timestamp()
 WHERE addon_key = 'coupons';

-- 1.7 campaigns (Marketing Hub & Campanhas)
UPDATE public.saas_addons
   SET name = 'Barbex Add-on — Marketing Hub & Campanhas',
       canonical_module_key = 'campaigns',
       monthly_price = 24.90,
       annual_price = 249.00,
       currency = 'BRL',
       stripe_product_id_test = 'prod_VNtVgbnquvqnI9',
       stripe_price_id_test = 'price_1UN7ilPKG6q10Ujrt2ZIOzfm',
       stripe_price_id_annual_test = 'price_1UN7ipPKG6q10Ujrc4063Rxh',
       stripe_product_id_live = 'prod_VNtYTWszPr8CrC',
       stripe_price_id_live = 'price_1UN7lnPKG6q10UjrEiTr93lZ',
       stripe_price_id_annual_live = 'price_1UN7lqPKG6q10Ujrh5ISESj7',
       eligible_plan_keys = ARRAY['starter', 'pro']::TEXT[],
       is_active = true,
       updated_at = clock_timestamp()
 WHERE addon_key = 'campaigns';

-- ----------------------------------------------------------------------------
-- 2. ENFORCE DEFERRED & LEGACY NON-ACTIVATION (Policy 7 & Section 24, 25)
-- ----------------------------------------------------------------------------

-- Deferred Add-ons (ai, api): strictly unmapped and inactive
UPDATE public.saas_addons
   SET stripe_product_id_test = NULL,
       stripe_price_id_test = NULL,
       stripe_price_id_annual_test = NULL,
       stripe_product_id_live = NULL,
       stripe_price_id_live = NULL,
       stripe_price_id_annual_live = NULL,
       is_active = false
 WHERE addon_key IN ('ai', 'ai_assistant', 'ai_addon', 'api', 'api_access');

-- Legacy / Ambiguous Add-ons: strictly unmapped and inactive
UPDATE public.saas_addons
   SET stripe_product_id_test = NULL,
       stripe_price_id_test = NULL,
       stripe_price_id_annual_test = NULL,
       stripe_product_id_live = NULL,
       stripe_price_id_live = NULL,
       stripe_price_id_annual_live = NULL,
       canonical_module_key = NULL,
       is_active = false
 WHERE addon_key IN (
   'store',
   'subscriptions',
   'cashback',
   'payment_gateway',
   'automations_extra_single',
   'automations_pack_5',
   'automations_unlimited',
   'integrations',
   'white_label',
   'whatsapp_marketing'
 );

-- ----------------------------------------------------------------------------
-- 3. INTEGRITY & ISOLATION ASSERTIONS (Fail-Closed Gate)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_count INT;
  v_invalid INT;
BEGIN
  -- Assert exactly 7 approved add-ons are mapped and active
  SELECT COUNT(*) INTO v_count
    FROM public.saas_addons
   WHERE addon_key IN ('advanced_finance', 'stock', 'commissions', 'reports_advanced', 'loyalty', 'coupons', 'campaigns')
     AND is_active = true
     AND stripe_product_id_test LIKE 'prod_%'
     AND stripe_price_id_test LIKE 'price_%'
     AND stripe_price_id_annual_test LIKE 'price_%'
     AND stripe_product_id_live LIKE 'prod_%'
     AND stripe_price_id_live LIKE 'price_%'
     AND stripe_price_id_annual_live LIKE 'price_%';

  IF v_count <> 7 THEN
    RAISE EXCEPTION 'MIGRATION INTEGRITY FAILED: Expected exactly 7 fully mapped and active add-ons, found %', v_count;
  END IF;

  -- Assert deferred and legacy add-ons have NO Price IDs and are NOT active
  SELECT COUNT(*) INTO v_invalid
    FROM public.saas_addons
   WHERE addon_key NOT IN ('advanced_finance', 'stock', 'commissions', 'reports_advanced', 'loyalty', 'coupons', 'campaigns')
     AND (is_active = true 
          OR stripe_price_id_test IS NOT NULL 
          OR stripe_price_id_live IS NOT NULL
          OR stripe_price_id_annual_test IS NOT NULL
          OR stripe_price_id_annual_live IS NOT NULL);

  IF v_invalid > 0 THEN
    RAISE EXCEPTION 'MIGRATION INTEGRITY FAILED: % unauthorized add-on rows are active or mapped', v_invalid;
  END IF;
END $$;

COMMIT;
