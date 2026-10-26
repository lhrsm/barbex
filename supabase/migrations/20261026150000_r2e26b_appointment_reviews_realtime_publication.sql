-- ==============================================================================
-- BARBEX — R2E.26B: CANDIDATE MIGRATION FOR APPOINTMENT REVIEWS REALTIME PUBLICATION
-- Target Project: ywdwrstxvsdqiryhieiz
-- Migration: 20261026150000_r2e26b_appointment_reviews_realtime_publication.sql
-- Objectives:
--   1. Idempotently add public.appointment_reviews to supabase_realtime publication.
--   2. Ensure REPLICA IDENTITY remains DEFAULT to prevent WAL bloating.
--   3. Strictly preserve tenant boundaries and existing RLS policies.
-- ==============================================================================

-- 1. Ensure supabase_realtime publication exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Add public.appointment_reviews to supabase_realtime publication (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'appointment_reviews'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_reviews;
    END IF;
END $$;
