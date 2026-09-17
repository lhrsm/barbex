-- ==============================================================================
-- BARBEX — PHASE 17B.1 ROLLBACK SCRIPT
-- ROLLBACK FOR: 20260901100000_phase17b1_staff_phone_identity_foundation.sql
--
-- ESCOPO:
-- 1. Remove o índice parcial de unicidade de telefones de staff
-- 2. Mantém os dados preservados (caso seja necessária restauração exata de dados,
--    utilizar a baseline canônica pré-17B em backups/pre-phase17b/database-data.sql)
-- ==============================================================================

DROP INDEX IF EXISTS public.idx_profiles_staff_phone_unique;
