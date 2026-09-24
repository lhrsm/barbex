-- ==============================================================================
-- BARBEX — RELEASE R2E.11B: FINAL SUPER ADMIN MIGRATION HARDENING
-- Target Supabase: ywdwrstxvsdqiryhieiz
-- Migration: 20260924100000_r2e11_p1_superadmin_rpcs_repair.sql
-- Escopo estrito e corrigido:
--   1. P1-ADM-01: Seed canônico idempotente para public.system_settings (payments_test_mode=false)
--   2. P1-ADM-02: RPC public.admin_list_upgrade_recommendations (validação estrita de p_days <= 0 / nulo, agregação total)
--   3. P1-ADM-03: RPCs public.admin_list_lgpd_requests e public.admin_resolve_lgpd_request (validação estrita de status nulo, estados finais imutáveis e FOR UPDATE)
--   4. P1-ADM-04: RPC public.test_rls_module_guards (auditoria estrutural passiva de RLS, separação estrita de comprovado vs inconclusivo vs falha, sem efeitos colaterais de escrita em produção)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. P1-ADM-01: SEED CANÔNICO IDEMPOTENTE DE SYSTEM_SETTINGS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Inicializa configurações somente se a tabela estiver vazia
  -- Preserva integralmente qualquer registro existente
  IF NOT EXISTS (SELECT 1 FROM public.system_settings LIMIT 1) THEN
    INSERT INTO public.system_settings (
      saas_name,
      main_url,
      public_email,
      contact_email,
      has_contact_form,
      maintenance_mode,
      admin_access_level,
      two_factor_auth_enabled,
      audit_logs_enabled,
      payments_test_mode
    ) VALUES (
      'Barbex',
      'https://barbex.shop',
      'contato@barbex.shop',
      'contato@lmstartup.com.br',
      true,              -- Formulário institucional ativo
      false,             -- Plataforma no ar (sem manutenção)
      'restricted',      -- Acesso Super Admin restrito
      false,             -- 2FA desativado inicialmente para evitar lockout
      true,              -- Auditoria ativada
      false              -- Modo de pagamento Live (Real), não Sandbox
    );
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. P1-ADM-02: RPC PUBLIC.ADMIN_LIST_UPGRADE_RECOMMENDATIONS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_upgrade_recommendations(p_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_allowed boolean;
  v_clean_days integer;
  v_since timestamptz;
  v_kpis jsonb;
  v_rows jsonb;
BEGIN
  -- 1. Verificação de autenticação e autorização
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  v_is_allowed := public.is_super_admin() OR public.has_role(v_user_id, 'super_admin');
  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'Acesso negado: super_admin obrigatório.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validação rigorosa do parâmetro p_days (nulo, zero, negativo ou excessivo)
  IF p_days IS NULL OR p_days <= 0 THEN
    v_clean_days := 90;
  ELSIF p_days > 3650 THEN
    v_clean_days := 3650;
  ELSE
    v_clean_days := p_days;
  END IF;

  v_since := now() - (v_clean_days || ' days')::interval;

  -- 3. KPIs calculados sobre TODO o período consultado (independente de LIMIT da listagem)
  SELECT
    jsonb_build_object(
      'total_shown', count(*)::int,
      'total_accepted', count(*) FILTER (WHERE customer_action IN ('upgraded', 'accepted'))::int,
      'total_dismissed', count(*) FILTER (WHERE customer_action IN ('dismissed', 'kept_addons'))::int,
      'total_pending', count(*) FILTER (WHERE customer_action IS NULL OR customer_action NOT IN ('upgraded', 'accepted', 'dismissed', 'kept_addons'))::int,
      'conversion_rate', CASE 
        WHEN (count(*) FILTER (WHERE customer_action IN ('upgraded', 'accepted', 'dismissed', 'kept_addons'))) > 0 
        THEN ROUND(
          (count(*) FILTER (WHERE customer_action IN ('upgraded', 'accepted')))::numeric / 
          (count(*) FILTER (WHERE customer_action IN ('upgraded', 'accepted', 'dismissed', 'kept_addons')))::numeric, 
          4
        ) 
        ELSE 0 
      END,
      'total_monthly_savings_offered', COALESCE(sum(monthly_savings), 0)::numeric,
      'total_monthly_savings_accepted', COALESCE(sum(monthly_savings) FILTER (WHERE customer_action IN ('upgraded', 'accepted')), 0)::numeric
    )
  INTO v_kpis
  FROM public.addon_upgrade_recommendations
  WHERE shown_at >= v_since;

  -- 4. Histórico detalhado limitado a 500 registros para eficiência da interface
  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', r.id,
      'tenant_id', r.tenant_id,
      'tenant_name', p.business_name,
      'tenant_email', p.email,
      'current_plan_name', cp.name,
      'recommended_plan_name', rp.name,
      'billing_cycle', r.billing_cycle::text,
      'current_option_total', r.current_option_total::numeric,
      'upgrade_option_total', r.upgrade_option_total::numeric,
      'monthly_savings', r.monthly_savings::numeric,
      'annual_savings', r.annual_savings::numeric,
      'recommendation_reason', r.recommendation_reason,
      'customer_action', r.customer_action,
      'shown_at', r.shown_at,
      'action_taken_at', r.action_taken_at
    ) AS row_data
    FROM public.addon_upgrade_recommendations r
    LEFT JOIN public.profiles p ON p.id = r.tenant_id
    LEFT JOIN public.plans cp ON cp.id = r.current_plan_id
    LEFT JOIN public.plans rp ON rp.id = r.recommended_plan_id
    WHERE r.shown_at >= v_since
    ORDER BY r.shown_at DESC
    LIMIT 500
  ) sub;

  IF v_kpis IS NULL THEN
    v_kpis := jsonb_build_object(
      'total_shown', 0,
      'total_accepted', 0,
      'total_dismissed', 0,
      'total_pending', 0,
      'conversion_rate', 0,
      'total_monthly_savings_offered', 0,
      'total_monthly_savings_accepted', 0
    );
  END IF;

  RETURN jsonb_build_object('kpis', v_kpis, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_upgrade_recommendations(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_upgrade_recommendations(integer) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. P1-ADM-03: RPCS PUBLIC.ADMIN_LIST_LGPD_REQUESTS E PUBLIC.ADMIN_RESOLVE_LGPD_REQUEST
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_lgpd_requests(
  p_status text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF public.lgpd_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.is_super_admin() OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Acesso negado: super_admin obrigatório.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.lgpd_requests
  WHERE (p_status IS NULL OR status = p_status)
    AND (p_type IS NULL OR request_type = p_type)
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  ORDER BY created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_lgpd_requests(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_lgpd_requests(text, text, uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.admin_resolve_lgpd_request(
  p_request_id uuid,
  p_status text,
  p_response text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_req RECORD;
  v_clean_status text;
BEGIN
  -- 1. Verificação de autenticação e autorização
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.is_super_admin() OR public.has_role(v_user_id, 'super_admin')) THEN
    RAISE EXCEPTION 'Acesso negado: super_admin obrigatório.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validação estrita de parâmetros obrigatórios
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetro p_request_id é obrigatório.' USING ERRCODE = '22023';
  END IF;

  IF p_status IS NULL OR trim(p_status) = '' THEN
    RAISE EXCEPTION 'Parâmetro p_status é obrigatório e não pode ser nulo ou vazio.' USING ERRCODE = '22023';
  END IF;

  v_clean_status := lower(trim(p_status));

  -- 3. Validação dos status canônicos permitidos para resolução
  IF v_clean_status NOT IN ('in_progress', 'done', 'rejected') THEN
    RAISE EXCEPTION 'Status inválido: "%". Status permitidos para resolução: in_progress, done, rejected', p_status USING ERRCODE = '22023';
  END IF;

  -- 4. Bloqueio transacional da linha para prevenir concorrência simultânea
  SELECT * INTO v_req
  FROM public.lgpd_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação LGPD não encontrada para o ID fornecido.' USING ERRCODE = 'P0002';
  END IF;

  -- 5. Validação da Máquina de Estados:
  -- A. Estados finais são imutáveis (solicitações concluídas ou rejeitadas não podem ser alteradas)
  IF v_req.status IN ('done', 'rejected') THEN
    RAISE EXCEPTION 'Solicitação LGPD já foi finalizada com status "%" e não pode ser alterada.', v_req.status USING ERRCODE = '22000';
  END IF;

  -- B. Transição redundante para o mesmo status
  IF v_req.status = v_clean_status THEN
    RAISE EXCEPTION 'Solicitação já se encontra no status "%". Transição redundante.', v_clean_status USING ERRCODE = '22000';
  END IF;

  -- 6. Atualização atômica
  UPDATE public.lgpd_requests
  SET
    status = v_clean_status,
    response = CASE 
      WHEN p_response IS NOT NULL AND trim(p_response) <> '' 
      THEN COALESCE(response, '{}'::jsonb) || jsonb_build_object(
        'note', trim(p_response),
        'resolved_by', v_user_id,
        'at', now()
      )
      ELSE response 
    END,
    resolved_at = CASE WHEN v_clean_status IN ('done', 'rejected') THEN now() ELSE resolved_at END,
    resolved_by = CASE WHEN v_clean_status IN ('done', 'rejected') THEN v_user_id ELSE resolved_by END,
    updated_at = now()
  WHERE id = p_request_id;

  -- 7. Registro de auditoria imutável na tabela de segurança da plataforma
  INSERT INTO public.security_activity_logs (
    user_id,
    event_type,
    metadata
  ) VALUES (
    v_user_id,
    'lgpd_request_resolved',
    jsonb_build_object(
      'request_id', p_request_id,
      'previous_status', v_req.status,
      'new_status', v_clean_status,
      'tenant_id', v_req.tenant_id,
      'request_type', v_req.request_type,
      'resolved_by', v_user_id
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_lgpd_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_lgpd_request(uuid, text, text) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. P1-ADM-04: RPC PUBLIC.TEST_RLS_MODULE_GUARDS (AUDITORIA ESTRUTURAL DE CATÁLOGO)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.test_rls_module_guards();

CREATE OR REPLACE FUNCTION public.test_rls_module_guards()
RETURNS TABLE(
  table_name text, 
  operation text, 
  expected text, 
  actual text, 
  passed boolean,
  status text,
  test_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
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
  v_rls_enabled boolean;
  v_rls_forced boolean;
  v_total_pol integer;
  v_restrictive_pol integer;
  v_permissive_pol integer;
  v_has_module_guard boolean;
  v_has_tenant_filter boolean;
  v_potential_open_mutation boolean;
  v_open_pol_name text;
BEGIN
  -- 1. Verificação de permissões do Super Admin
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.is_super_admin() OR public.has_role(v_caller, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden: super admin only' USING ERRCODE = '42501';
  END IF;

  -- 2. Inspeção arquitetural passiva no catálogo (sem mutação de dados ou efeitos colaterais)
  FOREACH t IN ARRAY tables LOOP
    table_name := t;
    test_type := 'PASSIVO_CATALOGO';
    operation := 'INSPEÇÃO ESTRUTURAL DE POLÍTICAS';
    expected := 'RLS_HABILITADO_E_POLITICA_CONFIGURADA';
    passed := false;
    status := 'INCONCLUSIVO';
    v_rls_enabled := false;
    v_rls_forced := false;
    v_total_pol := 0;
    v_restrictive_pol := 0;
    v_permissive_pol := 0;
    v_has_module_guard := false;
    v_has_tenant_filter := false;
    v_potential_open_mutation := false;
    v_open_pol_name := NULL;

    -- Etapa A: Verificar existência no catálogo público PostgreSQL
    SELECT c.relrowsecurity, c.relforcerowsecurity
    INTO v_rls_enabled, v_rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = t;

    IF NOT FOUND THEN
      status := 'ERRO_SCHEMA';
      actual := 'Tabela não encontrada no catálogo público PostgreSQL.';
      passed := false;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Etapa B: Verificar se RLS está explicitamente ativado na tabela
    IF NOT v_rls_enabled THEN
      status := 'FALHA_ESTRUTURAL';
      actual := 'Configuração ausente: RLS desabilitado na relação (relrowsecurity = false).';
      passed := false;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Etapa C: Levantamento das políticas registradas em pg_policies
    SELECT 
      count(*)::int,
      count(*) FILTER (WHERE permissive = 'RESTRICTIVE')::int,
      count(*) FILTER (WHERE permissive = 'PERMISSIVE')::int
    INTO v_total_pol, v_restrictive_pol, v_permissive_pol
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = t;

    IF v_total_pol = 0 THEN
      status := 'CONFIGURACAO_AUSENTE';
      actual := 'Configuração ausente: RLS ativo mas nenhuma política definida em pg_policies.';
      passed := false;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Etapa D: Inspecionar presença de guard restritivo de módulo
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' 
        AND tablename = t 
        AND permissive = 'RESTRICTIVE'
        AND (policyname ILIKE '%require_module%' OR with_check ILIKE '%has_module%' OR qual ILIKE '%has_module%')
    ) INTO v_has_module_guard;

    -- Etapa E: Inspecionar presença de políticas com filtro de tenant ou proprietário
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' 
        AND tablename = t 
        AND (qual ILIKE '%tenant_id%' OR qual ILIKE '%auth.uid()%' OR with_check ILIKE '%tenant_id%' OR with_check ILIKE '%auth.uid()%')
    ) INTO v_has_tenant_filter;

    -- Etapa F: Análise de políticas de mutação permissivas com predicados amplos para anon/public
    -- Avalia operação (cmd), papel (roles), modalidade e condições USING (qual) / WITH CHECK
    -- Nota de segurança: NÃO declara vazamento apenas por with_check ser nulo (ex: DELETE nunca usa with_check).
    -- Quando detectada política aberta sem predicado restritivo, classifica como INCONCLUSIVO para validação em staging.
    SELECT 
      EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' 
          AND tablename = t 
          AND permissive = 'PERMISSIVE'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
          AND (roles @> '{public}' OR roles @> '{anon}')
          AND (qual IS NULL OR qual = 'true')
          AND (cmd = 'DELETE' OR with_check IS NULL OR with_check = 'true')
      ),
      (
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' 
          AND tablename = t 
          AND permissive = 'PERMISSIVE'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
          AND (roles @> '{public}' OR roles @> '{anon}')
          AND (qual IS NULL OR qual = 'true')
          AND (cmd = 'DELETE' OR with_check IS NULL OR with_check = 'true')
        LIMIT 1
      )
    INTO v_potential_open_mutation, v_open_pol_name;

    -- Classificação discriminativa separando configuração estrutural de isolamento funcional não testado:
    IF v_potential_open_mutation THEN
      -- Análise estática identifica política permissiva com predicado amplo
      -- Não conclui vazamento sem comprovação funcional; indica necessidade de staging
      status := 'INCONCLUSIVO';
      passed := false;
      actual := format('INCONCLUSIVO: Política permissiva ampla identificada ("%s" para anon/public). Análise estática não determina se o acesso é indevido; requer testes funcionais em staging.', v_open_pol_name);

    ELSIF v_has_module_guard THEN
      -- Configuração estrutural identificada no catálogo: guard restritivo de módulo presente.
      -- O isolamento funcional multi-tenant permanece explicitamente NÃO TESTADO em produção.
      status := 'CONFIGURADO';
      passed := true;
      actual := format('ESTRUTURAL: Guard restritivo de módulo cadastrado no catálogo (%s políticas: %s restritiva(s), %s permissiva(s)). Isolamento funcional multi-tenant: NÃO TESTADO (requer staging).', v_total_pol, v_restrictive_pol, v_permissive_pol);

    ELSIF v_has_tenant_filter THEN
      -- Configuração estrutural de tenant identificada, mas sem guard restritivo de módulo.
      -- Isolamento funcional multi-tenant permanece NÃO TESTADO.
      status := 'INCONCLUSIVO';
      passed := false;
      actual := format('INCONCLUSIVO: %s política(s) de tenant cadastradas, sem guard restritivo de módulo. Isolamento funcional multi-tenant: NÃO TESTADO (requer staging).', v_total_pol);

    ELSE
      -- Configuração ausente ou potencialmente insegura: sem guard de módulo nem filtro de tenant
      status := 'CONFIGURACAO_AUSENTE';
      passed := false;
      actual := format('ALERTA: RLS ativo com %s política(s), mas nenhum filtro de tenant ou guard de módulo foi identificado no catálogo.', v_total_pol);
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.test_rls_module_guards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.test_rls_module_guards() TO authenticated, service_role;

COMMIT;
