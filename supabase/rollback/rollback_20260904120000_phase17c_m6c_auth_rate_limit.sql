-- ==============================================================================
-- BARBEX PHASE 17C.M6C: ROLLBACK RATE LIMITING INFRASTRUCTURE
-- TARGET PROJECT: ywdwrstxvsdqiryhieiz
-- REVERTE DE FORMA SEGURA A TABELA E RPC DE RATE LIMIT SEM AFETAR DADOS DE NEGÓCIO
-- ==============================================================================

BEGIN;

-- 1. Revogar permissões e remover a RPC
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM service_role;
DROP FUNCTION IF EXISTS public.check_rate_limit(text, integer, integer);

-- 2. Remover índices e tabela de rate limits
DROP INDEX IF EXISTS public.idx_auth_rate_limits_expires_at;
DROP TABLE IF EXISTS public.auth_rate_limits;

COMMIT;
