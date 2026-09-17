-- ==============================================================================
-- BARBEX M2: TARGET PRE-BOOTSTRAP VERIFICATION (READ-ONLY)
-- Valida que o schema public do projeto target está completamente vazio antes do bootstrap
-- ==============================================================================

SELECT 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') AS public_tables_count,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public') AS public_functions_count,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS public_policies_count,
  (SELECT COUNT(*) FROM cron.job) AS active_cron_jobs;

-- CRITÉRIO DE ACEITAÇÃO:
-- public_tables_count = 0
-- public_functions_count = 0
-- public_policies_count = 0
-- active_cron_jobs = 0
