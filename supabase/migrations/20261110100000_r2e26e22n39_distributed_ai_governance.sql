-- BARBEX — FASE R2E.26E.22N.39: HARDENING DE GOVERNANÇA, CONCORRÊNCIA E TPM DISTRIBUÍDOS
-- Provedor: PostgreSQL nativo no Supabase Free Tier
-- Objetivo:
-- 1. Semáforo distribuído de concorrência (máx 4 chamadas simultâneas globais, leases com TTL).
-- 2. Orçamento distribuído de TPM (Groq Free Tier teto 8.000 TPM; margem conservadora de 6.000 TPM).
-- 3. Limite diário persistente por tenant (20 req/dia em janela UTC).
-- 4. Reconciliação atômica de tokens reais da Groq e liberação idempotente.
-- 5. Zero persistência de conversas ou prompts (apenas dados técnicos de governança).
-- 6. SEM transações abertas durante chamadas de rede externas (dois RPCs atômicos separados: acquire e release).

-- 1. Tabela de rastreamento de consumo temporal
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  window_bucket TIMESTAMPTZ NOT NULL,
  window_type VARCHAR(16) NOT NULL, -- 'user_min', 'tenant_hour', 'tenant_day', 'global_min', 'global_day'
  request_count INT NOT NULL DEFAULT 1,
  estimated_tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_ai_rate_limits PRIMARY KEY (tenant_id, user_id, window_type, window_bucket)
);

CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_bucket 
ON public.ai_rate_limits (window_bucket);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

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

-- 2. Tabela de leases ativas para controle distribuído de concorrência e TPM
CREATE TABLE IF NOT EXISTS public.ai_active_leases (
  lease_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reserved_tokens INT NOT NULL DEFAULT 2200,
  actual_tokens INT DEFAULT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active', -- 'active', 'released', 'expired'
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_active_leases_active 
ON public.ai_active_leases (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_active_leases_tenant 
ON public.ai_active_leases (tenant_id, status);

ALTER TABLE public.ai_active_leases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_active_leases' AND policyname = 'ai_active_leases_admin_only'
  ) THEN
    CREATE POLICY "ai_active_leases_admin_only"
    ON public.ai_active_leases
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 3. Função RPC Atômica de Aquisição de Slot de Concorrência, TPM e Rate Limits
CREATE OR REPLACE FUNCTION public.ai_governance_acquire_slot(
  p_tenant_id UUID,
  p_user_id UUID,
  p_reserved_tokens INT DEFAULT 2200,
  p_max_concurrency INT DEFAULT 4,
  p_max_global_tpm INT DEFAULT 6000,
  p_max_tenant_day INT DEFAULT 20,
  p_max_tenant_hour INT DEFAULT 30,
  p_max_user_min INT DEFAULT 5,
  p_max_global_min INT DEFAULT 20,
  p_max_global_day INT DEFAULT 800,
  p_lease_ttl_seconds INT DEFAULT 45
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_utc_now TIMESTAMPTZ := timezone('utc', v_now);
  v_min_bucket TIMESTAMPTZ := date_trunc('minute', v_now);
  v_hour_bucket TIMESTAMPTZ := date_trunc('hour', v_now);
  v_day_bucket TIMESTAMPTZ := date_trunc('day', v_utc_now);
  
  v_sentinel UUID := '00000000-0000-0000-0000-000000000000'::uuid;
  v_active_concurrency INT;
  v_active_reserved_tokens INT;
  v_minute_consumed_tokens INT;
  v_tenant_day_count INT;
  v_tenant_hour_count INT;
  v_user_min_count INT;
  v_global_min_count INT;
  v_global_day_count INT;
  
  v_lease_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_seconds_to_next_min INT;
  v_seconds_to_next_day INT;
BEGIN
  -- 0. Validação defensiva de identificadores (Fail-Closed)
  IF p_tenant_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'INVALID_IDENTIFIERS',
      'error', 'tenant_id and user_id are strictly required'
    );
  END IF;

  -- 1. Expiração de leases antigas (Housekeeping automático contra slots órfãos)
  UPDATE public.ai_active_leases
  SET status = 'expired'
  WHERE status = 'active' AND expires_at <= v_now;

  -- 2. Concurrency Check (P1-01) - Máximo 4 chamadas simultâneas globais
  SELECT COUNT(*) INTO v_active_concurrency
  FROM public.ai_active_leases
  WHERE status = 'active' AND expires_at > v_now;

  IF v_active_concurrency >= p_max_concurrency THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'CONCURRENCY_LIMIT_EXCEEDED',
      'retry_after_seconds', 5,
      'current_concurrency', v_active_concurrency,
      'limit', p_max_concurrency
    );
  END IF;

  -- 3. TPM Check (P1-02) - Máximo global conservador (6.000 TPM vs 8.000 TPM teto Groq)
  -- Soma tokens de leases ativas (em andamento) + tokens reais já consumidos na janela de 1 minuto
  SELECT COALESCE(SUM(reserved_tokens), 0) INTO v_active_reserved_tokens
  FROM public.ai_active_leases
  WHERE status = 'active' AND expires_at > v_now;

  SELECT COALESCE(estimated_tokens, 0) INTO v_minute_consumed_tokens
  FROM public.ai_rate_limits
  WHERE tenant_id = v_sentinel AND user_id = v_sentinel
    AND window_type = 'global_min' AND window_bucket = v_min_bucket;

  IF (COALESCE(v_minute_consumed_tokens, 0) + v_active_reserved_tokens + p_reserved_tokens) > p_max_global_tpm THEN
    v_seconds_to_next_min := GREATEST(1, (60 - EXTRACT(SECOND FROM v_now))::int);
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'TPM_LIMIT_EXCEEDED',
      'retry_after_seconds', v_seconds_to_next_min,
      'current_tpm', (COALESCE(v_minute_consumed_tokens, 0) + v_active_reserved_tokens),
      'reserved_requested', p_reserved_tokens,
      'limit', p_max_global_tpm
    );
  END IF;

  -- 4. Limite Diário por Tenant (P2-01) - 20 req/dia em janela UTC persistente
  SELECT COALESCE(request_count, 0) INTO v_tenant_day_count
  FROM public.ai_rate_limits
  WHERE tenant_id = p_tenant_id AND user_id = v_sentinel
    AND window_type = 'tenant_day' AND window_bucket = v_day_bucket;

  IF COALESCE(v_tenant_day_count, 0) >= p_max_tenant_day THEN
    v_seconds_to_next_day := GREATEST(1, 86400 - (
      EXTRACT(HOUR FROM v_utc_now)::int * 3600 +
      EXTRACT(MINUTE FROM v_utc_now)::int * 60 +
      EXTRACT(SECOND FROM v_utc_now)::int
    ));
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'TENANT_DAILY_LIMIT_EXCEEDED',
      'retry_after_seconds', v_seconds_to_next_day,
      'current', v_tenant_day_count,
      'limit', p_max_tenant_day
    );
  END IF;

  -- 5. Rate Limits Convencionais (Global Min, Global Day, User Min, Tenant Hour)
  -- 5.1 Global Min (20 RPM)
  SELECT COALESCE(request_count, 0) INTO v_global_min_count
  FROM public.ai_rate_limits
  WHERE tenant_id = v_sentinel AND user_id = v_sentinel
    AND window_type = 'global_min' AND window_bucket = v_min_bucket;

  IF COALESCE(v_global_min_count, 0) >= p_max_global_min THEN
    v_seconds_to_next_min := GREATEST(1, (60 - EXTRACT(SECOND FROM v_now))::int);
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'GLOBAL_RATE_LIMIT_EXCEEDED',
      'retry_after_seconds', v_seconds_to_next_min,
      'current', v_global_min_count,
      'limit', p_max_global_min
    );
  END IF;

  -- 5.2 Global Day (800 RPD)
  SELECT COALESCE(request_count, 0) INTO v_global_day_count
  FROM public.ai_rate_limits
  WHERE tenant_id = v_sentinel AND user_id = v_sentinel
    AND window_type = 'global_day' AND window_bucket = v_day_bucket;

  IF COALESCE(v_global_day_count, 0) >= p_max_global_day THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'GLOBAL_DAILY_LIMIT_EXCEEDED',
      'retry_after_seconds', 3600,
      'current', v_global_day_count,
      'limit', p_max_global_day
    );
  END IF;

  -- 5.3 User Min (5 RPM)
  SELECT COALESCE(request_count, 0) INTO v_user_min_count
  FROM public.ai_rate_limits
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id
    AND window_type = 'user_min' AND window_bucket = v_min_bucket;

  IF COALESCE(v_user_min_count, 0) >= p_max_user_min THEN
    v_seconds_to_next_min := GREATEST(1, (60 - EXTRACT(SECOND FROM v_now))::int);
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'USER_RATE_LIMIT_EXCEEDED',
      'retry_after_seconds', v_seconds_to_next_min,
      'current', v_user_min_count,
      'limit', p_max_user_min
    );
  END IF;

  -- 5.4 Tenant Hour (30 RPH)
  SELECT COALESCE(request_count, 0) INTO v_tenant_hour_count
  FROM public.ai_rate_limits
  WHERE tenant_id = p_tenant_id AND user_id = v_sentinel
    AND window_type = 'tenant_hour' AND window_bucket = v_hour_bucket;

  IF COALESCE(v_tenant_hour_count, 0) >= p_max_tenant_hour THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'TENANT_RATE_LIMIT_EXCEEDED',
      'retry_after_seconds', GREATEST(1, (3600 - (EXTRACT(MINUTE FROM v_now)::int * 60 + EXTRACT(SECOND FROM v_now)::int))),
      'current', v_tenant_hour_count,
      'limit', p_max_tenant_hour
    );
  END IF;

  -- 6. EFETIVAÇÃO ATÔMICA DA RESERVA E INCREMENTO DE CONTADORES
  v_lease_id := gen_random_uuid();
  v_expires_at := v_now + (p_lease_ttl_seconds || ' seconds')::interval;

  INSERT INTO public.ai_active_leases (
    lease_id, tenant_id, user_id, reserved_tokens, status, expires_at
  ) VALUES (
    v_lease_id, p_tenant_id, p_user_id, p_reserved_tokens, 'active', v_expires_at
  );

  -- 6.1 Upsert Global Min (incrementa request_count; tokens reais são computados na liberação)
  INSERT INTO public.ai_rate_limits (tenant_id, user_id, window_bucket, window_type, request_count, estimated_tokens)
  VALUES (v_sentinel, v_sentinel, v_min_bucket, 'global_min', 1, 0)
  ON CONFLICT (tenant_id, user_id, window_type, window_bucket)
  DO UPDATE SET 
    request_count = public.ai_rate_limits.request_count + 1;

  -- 6.2 Upsert Global Day
  INSERT INTO public.ai_rate_limits (tenant_id, user_id, window_bucket, window_type, request_count, estimated_tokens)
  VALUES (v_sentinel, v_sentinel, v_day_bucket, 'global_day', 1, 0)
  ON CONFLICT (tenant_id, user_id, window_type, window_bucket)
  DO UPDATE SET 
    request_count = public.ai_rate_limits.request_count + 1;

  -- 6.3 Upsert Tenant Day (P2-01)
  INSERT INTO public.ai_rate_limits (tenant_id, user_id, window_bucket, window_type, request_count, estimated_tokens)
  VALUES (p_tenant_id, v_sentinel, v_day_bucket, 'tenant_day', 1, 0)
  ON CONFLICT (tenant_id, user_id, window_type, window_bucket)
  DO UPDATE SET 
    request_count = public.ai_rate_limits.request_count + 1;

  -- 6.4 Upsert Tenant Hour
  INSERT INTO public.ai_rate_limits (tenant_id, user_id, window_bucket, window_type, request_count, estimated_tokens)
  VALUES (p_tenant_id, v_sentinel, v_hour_bucket, 'tenant_hour', 1, 0)
  ON CONFLICT (tenant_id, user_id, window_type, window_bucket)
  DO UPDATE SET 
    request_count = public.ai_rate_limits.request_count + 1;

  -- 6.5 Upsert User Min
  INSERT INTO public.ai_rate_limits (tenant_id, user_id, window_bucket, window_type, request_count, estimated_tokens)
  VALUES (p_tenant_id, p_user_id, v_min_bucket, 'user_min', 1, 0)
  ON CONFLICT (tenant_id, user_id, window_type, window_bucket)
  DO UPDATE SET 
    request_count = public.ai_rate_limits.request_count + 1;

  -- 7. Limpeza probabilística oportunista (1% das requisições limpam leases antigas > 2h e rate limits > 2d)
  IF random() < 0.01 THEN
    DELETE FROM public.ai_active_leases WHERE expires_at < v_now - INTERVAL '2 hours';
    DELETE FROM public.ai_rate_limits WHERE window_bucket < v_now - INTERVAL '2 days';
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'lease_id', v_lease_id,
    'reserved_tokens', p_reserved_tokens,
    'expires_at', v_expires_at,
    'current_concurrency', v_active_concurrency + 1
  );
END;
$$;

-- 4. Função RPC Atômica de Liberação de Slot e Reconciliação Real de Tokens
CREATE OR REPLACE FUNCTION public.ai_governance_release_slot(
  p_lease_id UUID,
  p_tenant_id UUID,
  p_actual_tokens INT DEFAULT NULL,
  p_status VARCHAR(16) DEFAULT 'released'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lease RECORD;
  v_token_delta INT := 0;
  v_min_bucket TIMESTAMPTZ;
  v_sentinel UUID := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  IF p_lease_id IS NULL OR p_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'released', false,
      'reason', 'INVALID_IDENTIFIERS',
      'error', 'lease_id and tenant_id are strictly required'
    );
  END IF;

  -- Busca a lease com bloqueio para update
  SELECT * INTO v_lease
  FROM public.ai_active_leases
  WHERE lease_id = p_lease_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'released', false,
      'reason', 'LEASE_NOT_FOUND',
      'error', 'Lease ID not found'
    );
  END IF;

  -- Proteção contra liberação por outro tenant (Isolamento estrito)
  IF v_lease.tenant_id <> p_tenant_id THEN
    RETURN jsonb_build_object(
      'released', false,
      'reason', 'TENANT_MISMATCH',
      'error', 'Tenant ID does not match the lease owner'
    );
  END IF;

  -- Idempotência: Se já foi liberada ou expirada, retorna sucesso sem duplicar ajustes
  IF v_lease.status <> 'active' THEN
    RETURN jsonb_build_object(
      'released', true,
      'already_processed', true,
      'status', v_lease.status
    );
  END IF;

  -- Atualiza a lease
  UPDATE public.ai_active_leases
  SET status = COALESCE(p_status, 'released'),
      actual_tokens = p_actual_tokens,
      released_at = clock_timestamp()
  WHERE lease_id = p_lease_id;

  -- Reconciliação de tokens reais consumidos: soma ao bucket global_min da criação da lease
  IF p_actual_tokens IS NOT NULL AND p_actual_tokens > 0 THEN
    v_token_delta := p_actual_tokens - v_lease.reserved_tokens;
    v_min_bucket := date_trunc('minute', v_lease.created_at);

    UPDATE public.ai_rate_limits
    SET estimated_tokens = estimated_tokens + p_actual_tokens
    WHERE tenant_id = v_sentinel AND user_id = v_sentinel
      AND window_type = 'global_min' AND window_bucket = v_min_bucket;
  ELSE
    v_token_delta := - v_lease.reserved_tokens;
  END IF;

  RETURN jsonb_build_object(
    'released', true,
    'lease_id', p_lease_id,
    'reserved_tokens', v_lease.reserved_tokens,
    'actual_tokens', p_actual_tokens,
    'token_delta', v_token_delta
  );
END;
$$;

-- 5. Função RPC legada check_and_increment_ai_rate_limit (preservada para backward compatibility sem criar leases)
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
  IF p_tenant_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'INVALID_IDENTIFIERS',
      'error', 'tenant_id and user_id are strictly required'
    );
  END IF;

  -- 1. Controle Global por Minuto
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

  -- 2. Controle Global por Dia
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
      'retry_after_seconds', 3600,
      'current', v_global_day_count,
      'limit', p_max_global_per_day
    );
  END IF;

  -- 3. Controle por Tenant / Hora
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

  -- 4. Controle por Usuário / Minuto
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

  RETURN jsonb_build_object(
    'allowed', true,
    'user_minute_count', v_user_count,
    'tenant_hour_count', v_tenant_count,
    'global_minute_count', v_global_min_count,
    'global_day_count', v_global_day_count
  );
END;
$$;

-- 6. Concessão e restrição de privilégios (Least Privilege)
REVOKE ALL ON FUNCTION public.ai_governance_acquire_slot(UUID, UUID, INT, INT, INT, INT, INT, INT, INT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_governance_acquire_slot(UUID, UUID, INT, INT, INT, INT, INT, INT, INT, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.ai_governance_acquire_slot(UUID, UUID, INT, INT, INT, INT, INT, INT, INT, INT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ai_governance_acquire_slot(UUID, UUID, INT, INT, INT, INT, INT, INT, INT, INT, INT) TO service_role;

REVOKE ALL ON FUNCTION public.ai_governance_release_slot(UUID, UUID, INT, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_governance_release_slot(UUID, UUID, INT, VARCHAR) FROM anon;
REVOKE ALL ON FUNCTION public.ai_governance_release_slot(UUID, UUID, INT, VARCHAR) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ai_governance_release_slot(UUID, UUID, INT, VARCHAR) TO service_role;

REVOKE ALL ON FUNCTION public.check_and_increment_ai_rate_limit(UUID, UUID, INT, INT, INT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_increment_ai_rate_limit(UUID, UUID, INT, INT, INT, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.check_and_increment_ai_rate_limit(UUID, UUID, INT, INT, INT, INT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_rate_limit(UUID, UUID, INT, INT, INT, INT, INT) TO service_role;

-- ============================================================================
-- PROCEDIMENTO DE ROLLBACK IDEMPOTENTE:
-- DROP FUNCTION IF EXISTS public.ai_governance_release_slot(UUID, UUID, INT, VARCHAR);
-- DROP FUNCTION IF EXISTS public.ai_governance_acquire_slot(UUID, UUID, INT, INT, INT, INT, INT, INT, INT, INT, INT);
-- DROP TABLE IF EXISTS public.ai_active_leases CASCADE;
-- ============================================================================
