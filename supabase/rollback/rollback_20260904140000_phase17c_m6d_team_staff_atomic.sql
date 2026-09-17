-- ==============================================================================
-- BARBEX PHASE 17C.M6D: ROLLBACK ATOMIC TEAM & STAFF RPCs
-- TARGET PROJECT: ywdwrstxvsdqiryhieiz
-- REVERTE DE FORMA SEGURA AS RPCs ATÔMICAS CRIADAS NA M6D
-- ==============================================================================

BEGIN;

-- 1. Revogar e remover claim_staff_verification_challenge
REVOKE ALL ON FUNCTION public.claim_staff_verification_challenge(uuid, text, integer) FROM service_role;
DROP FUNCTION IF EXISTS public.claim_staff_verification_challenge(uuid, text, integer);

-- 2. Revogar e remover accept_team_invitation_atomic
REVOKE ALL ON FUNCTION public.accept_team_invitation_atomic(text, uuid, text) FROM service_role;
DROP FUNCTION IF EXISTS public.accept_team_invitation_atomic(text, uuid, text);

COMMIT;
