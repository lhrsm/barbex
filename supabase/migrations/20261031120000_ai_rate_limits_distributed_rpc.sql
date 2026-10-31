-- BARBEX — RATE LIMITING DISTRIBUÍDO A CUSTO ZERO PARA O AGENTE DE IA
-- Migration Proposta: R2E.26E.22F (Não executada no Supabase nesta fase)
-- Provedor: PostgreSQL nativo no Supabase Free Tier
-- Objetivo: Atomicidade, concorrência multi-instância na Vercel, isolamento multi-tenant
--           e controle global de consumo para proteção da cota do Groq Free Tier (30 RPM / 1000 RPD)

-- 1. Tabela de rastreamento de consumo temporal
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  window_bucket TIMESTAMPTZ NOT NULL,
  window_type VARCHAR(16) NOT NULL, -- 'user_min', 'tenant_hour', 'global_min', 'global_day'
  request_count INT NOT NULL DEFAULT 1,
  estimated_tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_ai_rate_limits PRIMARY KEY (tenant_id, user_id, window_type, window_bucket)
);

-- 2. Índice para otimização de consultas e purga rápida de janelas expiradas
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_bucket 
ON public.ai_rate_limits (window_bucket);

-- 3. Habilitação de RLS (segurança fail-closed no nível de tabela)
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Política de RLS restrita: Apenas service_role ou funções SECURITY DEFINER podem manipular
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_rate_limits' AND policyname = 'ai_rate_limits_admin_only'
  ) THEN
    CREATE POLICY "ai_rate_limits_admin_only"
    ON public.ai_rate_limits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 4. Função RPC Atômica de Verificação e Incremento Multi-Nível
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_rate_limit(
  p_tenant_id UUID,
  p_user_id UUID,
  p_max_per_min INT DEFAULT 5,
  p_max_per_hour INT DEFAULT 30,
  p_estimated_tokens INT DEFAULT 1800,
  p_max_global_per_min INT DEFAULT 20,
  p_max_global_per_day INT DEFAULT 800
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_bucket TIMESTAMPTZ := date_trunc('minute', now());
  v_hour_bucket TIMESTAMPTZ := date_trunc('hour', now());
  v_day_bucket TIMESTAMPTZ := date_trunc('day', now());
  v_user_count INT;
  v_tenant_count INT;
  v_global_min_count INT;
  v_global_day_count INT;
  v_sentinel_tenant UUID := '00000000-0000-0000-0000-000000000000'::uuid;
  v_sentinel_user UUID := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  -- Validação defensiva de parâmetros (Fail-Closed)
  IF p_tenant_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'INVALID_IDENTIFIERS',
      'error', 'tenant_id and user_id are strictly required'
    );
  END IF;

  -- 1. Controle Global por Minuto (Proteção da cota global da chave Groq: 30 RPM)
  INSERT INTO public.ai_rate_limits (tenant_id, user_id, window_bucket, window_type, request_count, estimated_tokens)
  VALUES (v_sentinel_tenant, v_sentinel_user, v_min_bucket, 'global_min', 1, p_estimated_tokens)
  ON CONFLICT (tenant_id, user_id, window_type, window_bucket)
  DO UPDATE SET 
    request_count = public.ai_rate_limits.request_count + 1,
    estimated_tokens = public.ai_rate_limits.estimated_tokens + EXCLUDED.estimated_tokens
  RETURNING request_count INTO v_global_min_count;

  IF v_global_min_count > p_max_global_per_min THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'GLOBAL_RATE_LIMIT_EXCEEDED',
      'retry_after_seconds', GREATEST(1, (60 - EXTRACT(SECOND FROM now()))::int),
      'current', v_global_min_count,
      'limit', p_max_global_per_min
    );
  END IF;

  -- 2. Controle Global por Dia (Proteção da cota global da chave Groq: 1.000 RPD)
  INSERT INTO public.ai_rate_limits (tenant_id, user_id, window_bucket, window_type, request_count, estimated_tokens)
  VALUES (v_sentinel_tenant, v_sentinel_user, v_day_bucket, 'global_day', 1, p_estimated_tokens)
  ON CONFLICT (tenant_id, user_id, window_type, window_bucket)
  DO UPDATE SET 
    request_count = public.ai_rate_limits.request_count + 1,
    estimated_tokens = public.ai_rate_limits.estimated_tokens + EXCLUDED.estimated_tokens
  RETURNING request_count INTO v_global_day_count;

  IF v_global_day_count > p_max_global_per_day THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'GLOBAL_DAILY_LIMIT_EXCEEDED',
      'retry_after_seconds', GREATEST(1, (86400 - (EXTRACT(HOUR FROM now())::int * 3600 + EXTRACT(MINUTE FROM now())::int * 60 + EXTRACT(SECOND FROM now())::int))),
      'current', v_global_day_count,
      'limit', p_max_global_per_day
    );
  END IF;

  -- 3. Controle de Janela de 1 Minuto por Usuário (Req/min)
  INSERT INTO public.ai_rate_limits (tenant_id, user_id, window_bucket, window_type, request_count, estimated_tokens)
  VALUES (p_tenant_id, p_user_id, v_min_bucket, 'user_min', 1, p_estimated_tokens)
  ON CONFLICT (tenant_id, user_id, window_type, window_bucket)
  DO UPDATE SET 
    request_count = public.ai_rate_limits.request_count + 1,
    estimated_tokens = public.ai_rate_limits.estimated_tokens + EXCLUDED.estimated_tokens
  RETURNING request_count INTO v_user_count;

  IF v_user_count > p_max_per_min THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'USER_RATE_LIMIT_EXCEEDED',
      'retry_after_seconds', GREATEST(1, (60 - EXTRACT(SECOND FROM now()))::int),
      'current', v_user_count,
      'limit', p_max_per_min
    );
  END IF;

  -- 4. Controle de Janela de 1 Hora por Barbearia/Tenant (Req/hora)
  INSERT INTO public.ai_rate_limits (tenant_id, user_id, window_bucket, window_type, request_count, estimated_tokens)
  VALUES (p_tenant_id, v_sentinel_user, v_hour_bucket, 'tenant_hour', 1, p_estimated_tokens)
  ON CONFLICT (tenant_id, user_id, window_type, window_bucket)
  DO UPDATE SET 
    request_count = public.ai_rate_limits.request_count + 1,
    estimated_tokens = public.ai_rate_limits.estimated_tokens + EXCLUDED.estimated_tokens
  RETURNING request_count INTO v_tenant_count;

  IF v_tenant_count > p_max_per_hour THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'TENANT_RATE_LIMIT_EXCEEDED',
      'retry_after_seconds', GREATEST(1, (3600 - (EXTRACT(MINUTE FROM now())::int * 60 + EXTRACT(SECOND FROM now())::int))),
      'current', v_tenant_count,
      'limit', p_max_per_hour
    );
  END IF;

  -- 5. Limpeza probabilística oportunista (1% das requisições purgam janelas com mais de 2 dias)
  IF random() < 0.01 THEN
    DELETE FROM public.ai_rate_limits WHERE window_bucket < now() - INTERVAL '2 days';
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'user_minute_count', v_user_count,
    'tenant_hour_count', v_tenant_count,
    'global_minute_count', v_global_min_count,
    'global_day_count', v_global_day_count
  );
END;
$$;

-- 5. Concessão de permissões de execução controladas (Hardening Supabase RLS/RBAC)
-- Princípio do Menor Privilégio: A RPC é de uso EXCLUSIVO do backend server-side (service_role).
-- Nenhuma role de cliente (anon ou authenticated) possui permissão de EXECUTE,
-- impedindo que clientes manipulem parâmetros ou esgotem cotas de outros tenants via API PostgREST.
REVOKE ALL ON FUNCTION public.check_and_increment_ai_rate_limit(UUID, UUID, INT, INT, INT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_increment_ai_rate_limit(UUID, UUID, INT, INT, INT, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.check_and_increment_ai_rate_limit(UUID, UUID, INT, INT, INT, INT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_rate_limit(UUID, UUID, INT, INT, INT, INT, INT) TO service_role;

-- ============================================================================
-- PROCEDIMENTO DE ROLLBACK (IDEMPOTENTE E NÃO-DESTRUTIVO AO RESTANTE DO BANCO):
-- DROP FUNCTION IF EXISTS public.check_and_increment_ai_rate_limit(UUID, UUID, INT, INT, INT, INT, INT);
-- DROP TABLE IF EXISTS public.ai_rate_limits CASCADE;
-- ============================================================================


