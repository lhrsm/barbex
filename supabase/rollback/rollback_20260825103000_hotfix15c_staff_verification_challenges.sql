-- ============================================================================
-- ROLLBACK HOTFIX 15C: Reversão da estrutura e funções de OTP para Staff
-- ============================================================================

-- 1. Remover RPCs atômicas
DROP FUNCTION IF EXISTS public.claim_staff_verification_challenge(uuid, text, int);
DROP FUNCTION IF EXISTS public.verify_staff_verification_challenge(uuid, uuid, text, int);

-- 2. Remover Índice UNIQUE parcial de concorrência staff
DROP INDEX IF EXISTS public.verification_challenges_one_active_staff_idx;

-- 3. Remover Check Constraint de exclusividade
ALTER TABLE public.verification_challenges
DROP CONSTRAINT IF EXISTS verification_challenges_target_exclusivity_check;

-- 4. Remover Índice normal de barber_id
DROP INDEX IF EXISTS public.verification_challenges_barber_id_idx;

-- 5. Remover Foreign Key de barber_id
ALTER TABLE public.verification_challenges
DROP CONSTRAINT IF EXISTS verification_challenges_barber_id_fkey;

-- 6. Remover Colunas consumed_at e barber_id
ALTER TABLE public.verification_challenges
DROP COLUMN IF EXISTS consumed_at;

ALTER TABLE public.verification_challenges
DROP COLUMN IF EXISTS barber_id;
