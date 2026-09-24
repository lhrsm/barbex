-- ==============================================================================
-- ROLLBACK: 20260924100000_r2e11_p1_superadmin_rpcs_repair.sql
-- Target Supabase: ywdwrstxvsdqiryhieiz
-- Data: 2026-09-24
-- ==============================================================================

BEGIN;

-- 1. Reverter RPCs LGPD
DROP FUNCTION IF EXISTS public.admin_resolve_lgpd_request(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_list_lgpd_requests(text, text, uuid);

-- 2. Reverter RPC de Recomendações de Upgrade
DROP FUNCTION IF EXISTS public.admin_list_upgrade_recommendations(integer);

-- 3. Reverter test_rls_module_guards para a exata definição anterior (migration 20260722122019)
DROP FUNCTION IF EXISTS public.test_rls_module_guards();

CREATE OR REPLACE FUNCTION public.test_rls_module_guards()
RETURNS TABLE(table_name text, operation text, expected text, actual text, passed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fake_user uuid := gen_random_uuid();
  tables text[] := ARRAY[
    'barber_commissions','cashback_transactions','commission_closings','commission_entries',
    'customer_subscriptions','loyalty_campaign_participations','loyalty_campaign_templates',
    'loyalty_campaigns','loyalty_rewards','loyalty_settings','product_images','product_sales',
    'products','subscription_card_scans','subscription_invoices','subscription_loyalty_history',
    'subscription_loyalty_rewards','subscription_payments','subscription_plan_benefit_services',
    'subscription_plan_benefits','subscription_plan_changes','subscription_plan_services',
    'subscription_plans','subscription_referrals','subscription_status_logs','subscription_usage_logs'
  ];
  t text;
  err_msg text;
  blocked boolean;
BEGIN
  -- Only super admins can run this diagnostic
  IF NOT public.is_super_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: super admin only';
  END IF;

  FOREACH t IN ARRAY tables LOOP
    blocked := false;
    err_msg := NULL;
    BEGIN
      -- Simulate authenticated user without any premium module
      EXECUTE format(
        'SET LOCAL role authenticated; ' ||
        'SET LOCAL "request.jwt.claims" = %L; ' ||
        'INSERT INTO public.%I DEFAULT VALUES;',
        json_build_object('sub', fake_user::text, 'role','authenticated')::text,
        t
      );
    EXCEPTION WHEN OTHERS THEN
      blocked := true;
      err_msg := SQLERRM;
    END;
    RESET role;

    table_name := t;
    operation := 'INSERT';
    expected := 'BLOCKED (RLS)';
    actual := CASE WHEN blocked THEN 'BLOCKED: ' || COALESCE(err_msg,'') ELSE 'ALLOWED (LEAK!)' END;
    passed := blocked AND (
      err_msg ILIKE '%row-level security%' OR
      err_msg ILIKE '%violates row-level%' OR
      err_msg ILIKE '%permission denied%' OR
      err_msg ILIKE '%new row violates%'
    );
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.test_rls_module_guards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.test_rls_module_guards() TO authenticated, service_role;

-- 4. Reverter registro de seed em system_settings SOMENTE se NÃO foi modificado após a publicação
-- Se o registro tiver sido editado pela administração pós-publicação (updated_at > created_at),
-- os dados e configurações são integralmente preservados.
DELETE FROM public.system_settings 
WHERE saas_name = 'Barbex' 
  AND contact_email = 'contato@lmstartup.com.br'
  AND (updated_at IS NULL OR updated_at = created_at);

COMMIT;
