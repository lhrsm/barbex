-- ==============================================================================
-- BARBEX M2: TARGET POST-BOOTSTRAP VERIFICATION (READ-ONLY)
-- Valida que todas as 38 tabelas, funções essenciais e RLS foram criadas sem crons ativos
-- ==============================================================================

SELECT 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS public_tables_count,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) AS rls_enabled_tables_count,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS total_policies_count,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public') AS public_functions_count,
  (SELECT COUNT(*) FROM cron.job) AS active_cron_jobs;

-- Validação de objetos fundamentais da Phase 17C.2B
SELECT 
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'background_jobs' AND column_name = 'locked_at') AS has_locked_at,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'background_jobs' AND column_name = 'locked_by') AS has_locked_by,
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'background_jobs' AND indexname = 'idx_bg_jobs_claimable') AS has_claim_index,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'claim_next_background_job') AS has_claim_rpc,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_scalability_aggregates') AS has_observability_rpc;

-- CRITÉRIO DE ACEITAÇÃO:
-- public_tables_count = 38
-- rls_enabled_tables_count = 38
-- active_cron_jobs = 0 (Crons permanecem desativados até o cutover)
-- has_locked_at = TRUE, has_locked_by = TRUE, has_claim_index = TRUE, has_claim_rpc = TRUE, has_observability_rpc = TRUE
