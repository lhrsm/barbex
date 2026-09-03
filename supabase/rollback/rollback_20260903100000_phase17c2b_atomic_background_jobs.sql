-- ===================================================================
-- BARBEX — ROLLBACK PHASE 17C.2B ATOMIC BACKGROUND JOBS & OBSERVABILITY
-- Rollback for: 20260903100000_phase17c2b_atomic_background_jobs.sql
-- ===================================================================

-- 1. Unschedule cron job se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-stuck-background-jobs-hourly') THEN
      PERFORM cron.unschedule('reconcile-stuck-background-jobs-hourly');
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. Drop RPCs and procedures
DROP FUNCTION IF EXISTS public.get_scalability_aggregates();
DROP FUNCTION IF EXISTS public.reconcile_stuck_background_jobs(INTEGER);
DROP FUNCTION IF EXISTS public.claim_next_background_job(TEXT, TEXT);

-- 3. Drop partial index
DROP INDEX IF EXISTS public.idx_bg_jobs_claimable;

-- 4. Drop additive columns
ALTER TABLE public.background_jobs
DROP COLUMN IF EXISTS locked_by,
DROP COLUMN IF EXISTS locked_at;
