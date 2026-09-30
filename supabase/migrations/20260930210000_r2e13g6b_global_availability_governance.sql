-- ==============================================================================
-- BARBEX — R2E.13G.6B: GLOBAL FEATURE AVAILABILITY GOVERNANCE
-- Semantic Mutation Authority + Super Admin Control RPCs
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NARROW SCHEMA EXTENSION FOR UNAVAILABLE JUSTIFICATION
-- ------------------------------------------------------------------------------

ALTER TABLE public.platform_module_availability 
  ADD COLUMN IF NOT EXISTS unavailable_reason text;

-- ------------------------------------------------------------------------------
-- 2. CLASSIFICATION HELPER FUNCTION
-- Server-authoritative classification of all 23 canonical modules
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_module_governance_classification(
  p_module_key text
)
RETURNS TABLE (
  canonical_key text,
  classification text,
  can_mutate boolean,
  impact_level text,
  requires_phrase boolean,
  rationale text
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key text := lower(trim(p_module_key));
BEGIN
  -- Canonical alias resolution
  IF v_key = 'products' THEN v_key := 'stock'; END IF;
  IF v_key = 'cashback' THEN v_key := 'loyalty'; END IF;
  IF v_key = 'integrations' THEN v_key := 'api'; END IF;
  IF v_key = 'automations' THEN v_key := 'automations_basic'; END IF;

  RETURN QUERY
  SELECT
    v_key AS canonical_key,
    CASE
      -- PROHIBITED CORE MODULES (Protected Platform Recoverability)
      WHEN v_key IN ('dashboard', 'settings') THEN 'PROHIBITED'

      -- MAINTENANCE ONLY (Core Operational Backbone)
      WHEN v_key IN ('calendar', 'customers', 'barbers', 'services', 'finances', 'basic_finance') THEN 'MAINTENANCE_ONLY'

      -- HIGH IMPACT GOVERNABLE (External Providers / Dispatches / High Cost)
      WHEN v_key IN ('whatsapp', 'ai', 'api', 'campaigns', 'automations_basic') THEN 'HIGH_IMPACT_GOVERNABLE'

      -- STANDARD GOVERNABLE (SaaS Modules)
      WHEN v_key IN ('client_portal', 'barber_panel', 'reports_basic', 'reports_advanced', 'support', 'advanced_finance', 'stock', 'coupons', 'loyalty', 'commissions') THEN 'STANDARD_GOVERNABLE'

      ELSE 'UNKNOWN'
    END AS classification,

    -- Mutability in normal G.6B RPC
    CASE
      WHEN v_key IN ('whatsapp', 'ai', 'api', 'campaigns', 'automations_basic',
                     'client_portal', 'barber_panel', 'reports_basic', 'reports_advanced',
                     'support', 'advanced_finance', 'stock', 'coupons', 'loyalty', 'commissions') THEN true
      ELSE false
    END AS can_mutate,

    -- Impact level
    CASE
      WHEN v_key IN ('dashboard', 'settings') THEN 'CORE'
      WHEN v_key IN ('calendar', 'customers', 'barbers', 'services', 'finances', 'basic_finance') THEN 'CRITICAL'
      WHEN v_key IN ('whatsapp', 'ai', 'api', 'campaigns', 'automations_basic') THEN 'HIGH'
      WHEN v_key IN ('client_portal', 'barber_panel', 'advanced_finance') THEN 'MEDIUM'
      WHEN v_key IN ('reports_basic', 'reports_advanced', 'support', 'stock', 'coupons', 'loyalty', 'commissions') THEN 'LOW'
      ELSE 'UNKNOWN'
    END AS impact_level,

    -- Requires typed confirmation phrase on disable
    CASE
      WHEN v_key IN ('whatsapp', 'ai', 'api', 'campaigns', 'automations_basic') THEN true
      ELSE false
    END AS requires_phrase,

    -- Operational rationale
    CASE
      WHEN v_key = 'dashboard' THEN 'Núcleo de navegação autenticada e mensagens da plataforma. Desativação global estritamente proibida.'
      WHEN v_key = 'settings' THEN 'Núcleo de perfil, credenciais e gerenciamento financeiro de estabelecimentos. Desativação proibida.'
      WHEN v_key = 'calendar' THEN 'Núcleo de agendamento operacional. Alteração permitida apenas via janela de manutenção de infraestrutura.'
      WHEN v_key = 'customers' THEN 'Núcleo de base de clientes. Alteração permitida apenas via janela de manutenção de infraestrutura.'
      WHEN v_key = 'barbers' THEN 'Núcleo de equipe e profissionais. Alteração permitida apenas via janela de manutenção de infraestrutura.'
      WHEN v_key = 'services' THEN 'Núcleo de catálogo de serviços. Alteração permitida apenas via janela de manutenção de infraestrutura.'
      WHEN v_key = 'finances' THEN 'Operações financeiras diárias e fechamento de caixa. Restrito a manutenção.'
      WHEN v_key = 'basic_finance' THEN 'Livro caixa básico da barbearia. Restrito a manutenção.'
      WHEN v_key = 'whatsapp' THEN 'Integração externa Z-API. Alto impacto operacional e custos de envio.'
      WHEN v_key = 'ai' THEN 'Provedor externo de IA (OpenAI). Alto consumo de tokens e custos.'
      WHEN v_key = 'api' THEN 'Acesso a APIs públicas e webhooks externos.'
      WHEN v_key = 'campaigns' THEN 'Disparo em massa de campanhas para clientes.'
      WHEN v_key = 'automations_basic' THEN 'Disparos automáticos e gatilhos em segundo plano.'
      WHEN v_key = 'client_portal' THEN 'Portal público de autoagendamento de clientes.'
      WHEN v_key = 'barber_panel' THEN 'Painel dedicado dos profissionais da barbearia.'
      WHEN v_key = 'reports_basic' THEN 'Relatórios básicos de agendamento e atendimento.'
      WHEN v_key = 'reports_advanced' THEN 'Relatórios gerenciais analíticos e métricas avançadas.'
      WHEN v_key = 'support' THEN 'Módulo interno de abertura de chamados e suporte.'
      WHEN v_key = 'advanced_finance' THEN 'Gestão financeira avançada (DRE, centros de custo, contas a pagar).'
      WHEN v_key = 'stock' THEN 'Controle de estoque de insumos e produtos para venda.'
      WHEN v_key = 'coupons' THEN 'Gestão de cupons promocionais e descontos.'
      WHEN v_key = 'loyalty' THEN 'Programas de fidelidade e cashback.'
      WHEN v_key = 'commissions' THEN 'Regras de cálculo e divisão de comissões de profissionais.'
      ELSE 'Módulo não classificado no catálogo canônico.'
    END AS rationale;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. PRIVILEGED GOVERNANCE READ RPC
-- Returns the authoritative 23-module availability & governance matrix for Super Admin UI
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_get_global_module_availability_matrix()
RETURNS TABLE (
  module_key text,
  is_available boolean,
  unavailable_reason text,
  classification text,
  can_mutate boolean,
  impact_level text,
  requires_phrase boolean,
  rationale text,
  updated_at timestamptz,
  updated_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  -- Super Admin Server Authorization
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN: Requer privilégio de Super Admin.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pma.module_key,
    pma.is_available,
    pma.unavailable_reason,
    gov.classification,
    gov.can_mutate,
    gov.impact_level,
    gov.requires_phrase,
    gov.rationale,
    pma.updated_at,
    pma.updated_by
  FROM public.platform_module_availability pma
  CROSS JOIN LATERAL public.get_module_governance_classification(pma.module_key) gov
  ORDER BY
    CASE gov.classification
      WHEN 'HIGH_IMPACT_GOVERNABLE' THEN 1
      WHEN 'STANDARD_GOVERNABLE' THEN 2
      WHEN 'MAINTENANCE_ONLY' THEN 3
      WHEN 'PROHIBITED' THEN 4
      ELSE 5
    END,
    pma.module_key ASC;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. GOVERNED MUTATION RPC
-- Server-authoritative mutation of global module availability
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_global_module_availability(
  p_module_key text,
  p_available boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_clean_module text;
  v_clean_reason text;
  v_gov record;
  v_before_available boolean;
  v_before_reason text;
BEGIN
  -- A. AUTHORIZATION (Server-side Super Admin check)
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'super_admin'::public.app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Acesso negado: Requer privilégio de Super Admin.'
    );
  END IF;

  -- B. INPUT NORMALIZATION
  v_clean_module := lower(trim(coalesce(p_module_key, '')));
  IF v_clean_module = 'products' THEN v_clean_module := 'stock'; END IF;
  IF v_clean_module = 'cashback' THEN v_clean_module := 'loyalty'; END IF;
  IF v_clean_module = 'integrations' THEN v_clean_module := 'api'; END IF;
  IF v_clean_module = 'automations' THEN v_clean_module := 'automations_basic'; END IF;

  -- C. SERVER ALLOWLIST & CLASSIFICATION CHECK
  SELECT * INTO v_gov FROM public.get_module_governance_classification(v_clean_module);

  IF v_gov.classification = 'UNKNOWN' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNKNOWN_MODULE',
      'message', 'Módulo desconhecido ou inexistente no catálogo canônico da plataforma.'
    );
  END IF;

  IF v_gov.classification = 'PROHIBITED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PROHIBITED_MODULE',
      'message', 'O módulo ' || v_clean_module || ' é protegido como núcleo essencial da plataforma e não pode ser desativado globalmente.'
    );
  END IF;

  IF v_gov.classification = 'MAINTENANCE_ONLY' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MAINTENANCE_ONLY_MODULE',
      'message', 'O módulo ' || v_clean_module || ' é restrito a janelas de manutenção global da infraestrutura e não pode ser alterado via governança de módulos.'
    );
  END IF;

  IF NOT v_gov.can_mutate THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NON_GOVERNABLE_MODULE',
      'message', 'Módulo não elegível para mutação operacional global.'
    );
  END IF;

  -- D. JUSTIFICATION VALIDATION (Min 10, Max 500 chars)
  v_clean_reason := trim(coalesce(p_reason, ''));
  IF v_clean_reason IS NULL OR char_length(v_clean_reason) < 10 OR char_length(v_clean_reason) > 500 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_REASON',
      'message', 'Justificativa operacional é obrigatória e deve conter entre 10 e 500 caracteres legíveis.'
    );
  END IF;

  -- E. CONCURRENCY CONTROL (Advisory lock deterministic to global module availability)
  PERFORM pg_advisory_xact_lock(hashtext('global_module_availability'), hashtext(v_clean_module));

  -- F. ROW LOCKING & BEFORE-STATE INSPECTION
  SELECT is_available, unavailable_reason
    INTO v_before_available, v_before_reason
    FROM public.platform_module_availability
   WHERE module_key = v_clean_module
     FOR UPDATE;

  IF v_before_available IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MODULE_ROW_MISSING',
      'message', 'Registro de disponibilidade global não localizado no banco para o módulo: ' || v_clean_module
    );
  END IF;

  -- G. DUPLICATE STATE REJECTION (Idempotency)
  IF v_before_available = p_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONFLICT',
      'message', 'O módulo ' || v_clean_module || ' já se encontra no estado de disponibilidade solicitado.',
      'data', jsonb_build_object(
        'module_key', v_clean_module,
        'is_available', v_before_available
      )
    );
  END IF;

  -- H. AUTHORITATIVE MUTATION
  UPDATE public.platform_module_availability
     SET is_available = p_available,
         unavailable_reason = CASE WHEN p_available THEN NULL ELSE v_clean_reason END,
         updated_at = now(),
         updated_by = v_actor_id
   WHERE module_key = v_clean_module;

  -- I. ATOMIC AUDIT LOGGING (Same transaction; failure causes rollback)
  INSERT INTO public.audit_logs (
    admin_id,
    target_id,
    action,
    details,
    ip_address
  ) VALUES (
    v_actor_id,
    NULL,
    'platform.global_feature_availability_updated',
    jsonb_build_object(
      'module_key', v_clean_module,
      'previous_state', v_before_available,
      'new_state', p_available,
      'reason', v_clean_reason,
      'classification', v_gov.classification,
      'impact_level', v_gov.impact_level,
      'timestamp', now()
    ),
    NULL
  );

  -- J. STRUCTURED SUCCESS RESPONSE
  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Disponibilidade global do módulo ' || v_clean_module || ' atualizada com sucesso.',
    'data', jsonb_build_object(
      'module_key', v_clean_module,
      'previous_state', v_before_available,
      'is_available', p_available,
      'reason', v_clean_reason,
      'classification', v_gov.classification
    )
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. PRIVILEGE ENFORCEMENT
-- Revoke execution from PUBLIC & anon; allow authenticated (internal check enforces super_admin)
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.get_module_governance_classification(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_module_governance_classification(text) TO authenticated, service_role, postgres;

REVOKE ALL ON FUNCTION public.admin_get_global_module_availability_matrix() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_global_module_availability_matrix() TO authenticated, service_role, postgres;

REVOKE ALL ON FUNCTION public.admin_set_global_module_availability(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_global_module_availability(text, boolean, text) TO authenticated, service_role, postgres;
