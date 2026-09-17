-- ==============================================================================
-- ROLLBACK: 20260904180000_phase17c_m6f_zapi_idempotency.sql
-- ==============================================================================

DROP FUNCTION IF EXISTS public.claim_zapi_event(TEXT, TEXT, UUID, TEXT, TEXT);
DROP TABLE IF EXISTS public.zapi_processed_events CASCADE;
