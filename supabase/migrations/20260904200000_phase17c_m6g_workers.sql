-- ===================================================================
-- BARBEX — PHASE 17C.M6G BACKGROUND WORKERS & JOB ENGINE FOUNDATION
-- Migration: 20260904200000_phase17c_m6g_workers.sql
-- ===================================================================

-- 1. RPC Atômico de Conclusão de Job com Validação de Lock de Worker
CREATE OR REPLACE FUNCTION public.complete_background_job(
  p_job_id UUID,
  p_worker_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  IF p_job_id IS NULL OR p_worker_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.background_jobs
  SET
    status = 'completed',
    completed_at = NOW(),
    locked_at = NULL,
    locked_by = NULL,
    last_error = NULL,
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_by = p_worker_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count > 0;
END;
$$;

-- 2. RPC Atômico de Falha / Retry com Backoff Seguro e Verificação de Lease
CREATE OR REPLACE FUNCTION public.fail_background_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_error TEXT,
  p_retry_delay_seconds INTEGER DEFAULT 120
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_new_status TEXT;
  v_next_run TIMESTAMPTZ;
  v_updated_count INTEGER := 0;
  v_delay_sec INTEGER;
BEGIN
  IF p_job_id IS NULL OR p_worker_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Seleciona e valida ownership do worker
  SELECT id, attempts, max_attempts INTO v_job
  FROM public.background_jobs
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_by = p_worker_id;

  IF v_job.id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_delay_sec := GREATEST(COALESCE(p_retry_delay_seconds, 120), 10);

  IF v_job.attempts >= COALESCE(v_job.max_attempts, 3) THEN
    v_new_status := 'failed';
    v_next_run := NULL;
  ELSE
    v_new_status := 'retry';
    v_next_run := NOW() + (v_delay_sec || ' seconds')::INTERVAL;
  END IF;

  UPDATE public.background_jobs
  SET
    status = v_new_status,
    next_run_at = COALESCE(v_next_run, next_run_at),
    last_error = p_error,
    locked_at = NULL,
    locked_by = NULL,
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_by = p_worker_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count > 0;
END;
$$;

-- 3. RPC Seguro para Agendamento de Jobs com Allowlist de Filas
CREATE OR REPLACE FUNCTION public.enqueue_background_job_safe(
  p_tenant_id UUID,
  p_queue_name TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_priority INTEGER DEFAULT 0,
  p_next_run_at TIMESTAMPTZ DEFAULT NOW(),
  p_max_attempts INTEGER DEFAULT 3
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
  v_allowed_queues TEXT[] := ARRAY[
    'email_notification',
    'push_notification',
    'whatsapp_notification',
    'review_request',
    'review_reminder',
    'subscription_reminder',
    'addons_cleanup',
    'admin_digest',
    'reconcile_stuck_jobs',
    'default'
  ];
BEGIN
  IF p_queue_name IS NULL OR NOT (p_queue_name = ANY(v_allowed_queues)) THEN
    RAISE EXCEPTION 'Fila de background job não permitida: %', p_queue_name;
  END IF;

  INSERT INTO public.background_jobs (
    tenant_id,
    queue_name,
    payload,
    priority,
    status,
    attempts,
    max_attempts,
    next_run_at,
    created_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    p_queue_name,
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_priority, 0),
    'pending',
    0,
    GREATEST(COALESCE(p_max_attempts, 3), 1),
    COALESCE(p_next_run_at, NOW()),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

-- 4. Permissões de Acesso Granulares (Princípio do Menor Privilégio)
REVOKE ALL ON FUNCTION public.complete_background_job(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_background_job(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.fail_background_job(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_background_job(UUID, TEXT, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_background_job_safe(UUID, TEXT, JSONB, INTEGER, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_background_job_safe(UUID, TEXT, JSONB, INTEGER, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_background_job_safe(UUID, TEXT, JSONB, INTEGER, TIMESTAMPTZ, INTEGER) TO authenticated;
