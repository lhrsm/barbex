-- ===================================================================
-- BARBEX — ROLLBACK PHASE 17C.M6G WORKERS
-- File: rollback_20260904200000_phase17c_m6g_workers.sql
-- ===================================================================

DROP FUNCTION IF EXISTS public.enqueue_background_job_safe(UUID, TEXT, JSONB, INTEGER, TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS public.fail_background_job(UUID, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.complete_background_job(UUID, TEXT);
