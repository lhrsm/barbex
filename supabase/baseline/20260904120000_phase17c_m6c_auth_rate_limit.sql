-- ==============================================================================
-- BARBEX PHASE 17C.M6C: DISTRIBUTED ATOMIC RATE LIMITING
-- TABELA E RPC PARA CONTROLE DE RATE LIMIT PRIVILEGIADO NO SUPABASE EDGE
-- NÃO PERSISTE NENHUMA PII (CHAVES SÃO HASHES SHA-256 OPACAS)
-- TARGET PROJECT: ywdwrstxvsdqiryhieiz
-- ==============================================================================

-- 1. Tabela de controle de taxa
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE,
  scope text NOT NULL DEFAULT 'auth',
  attempts integer NOT NULL DEFAULT 1,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Índice para expiração e busca O(1)
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expires_at ON public.auth_rate_limits (expires_at);

-- 3. RLS ativado e sem policies públicas (Acesso exclusivo via SECURITY DEFINER ou service_role)
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- 4. RPC atômica com upsert e row-level locking
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_rec public.auth_rate_limits%ROWTYPE;
  v_allowed boolean;
  v_remaining integer;
BEGIN
  -- 1. Limpeza amortizada de registros expirados (probabilidade de 10% por chamada)
  IF (random() < 0.1) THEN
    DELETE FROM public.auth_rate_limits WHERE expires_at < v_now;
  END IF;

  -- 2. Upsert atômico do contador
  INSERT INTO public.auth_rate_limits (
    key_hash, 
    scope, 
    attempts, 
    window_started_at, 
    expires_at, 
    updated_at
  )
  VALUES (
    p_key, 
    'auth', 
    1, 
    v_now, 
    v_now + (p_window_seconds || ' seconds')::interval, 
    v_now
  )
  ON CONFLICT (key_hash) DO UPDATE
  SET
    attempts = CASE 
      WHEN public.auth_rate_limits.expires_at < v_now THEN 1 
      ELSE public.auth_rate_limits.attempts + 1 
    END,
    window_started_at = CASE 
      WHEN public.auth_rate_limits.expires_at < v_now THEN v_now 
      ELSE public.auth_rate_limits.window_started_at 
    END,
    expires_at = CASE 
      WHEN public.auth_rate_limits.expires_at < v_now THEN v_now + (p_window_seconds || ' seconds')::interval 
      ELSE public.auth_rate_limits.expires_at 
    END,
    updated_at = v_now
  RETURNING * INTO v_rec;

  -- 3. Avaliação dos limites
  IF v_rec.attempts <= p_max_requests THEN
    v_allowed := true;
    v_remaining := p_max_requests - v_rec.attempts;
  ELSE
    v_allowed := false;
    v_remaining := 0;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'attempts', v_rec.attempts
  );
END;
$$;

-- 5. Revogação de acesso público
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;
