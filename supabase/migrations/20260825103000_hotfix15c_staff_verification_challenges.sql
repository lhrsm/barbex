-- ============================================================================
-- HOTFIX 15C: Correção Estrutural e Lifecycle Atômico de OTP para Colaboradores
-- Inclui barber_id, consumed_at, índices parciais e RPCs atômicas com SECURITY DEFINER
-- ============================================================================

-- 1. Adicionar colunas barber_id e consumed_at
ALTER TABLE public.verification_challenges
ADD COLUMN IF NOT EXISTS barber_id uuid;

ALTER TABLE public.verification_challenges
ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

-- 2. Criar Foreign Key idempotente para public.barbers(id) com ON DELETE CASCADE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'verification_challenges_barber_id_fkey'
    ) THEN
        ALTER TABLE public.verification_challenges
        ADD CONSTRAINT verification_challenges_barber_id_fkey
        FOREIGN KEY (barber_id)
        REFERENCES public.barbers(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Criar índice para performance em buscas por barber_id
CREATE INDEX IF NOT EXISTS verification_challenges_barber_id_idx
ON public.verification_challenges (barber_id);

-- 4. Criar Check Constraint para garantir exclusividade entre client_id e barber_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'verification_challenges_target_exclusivity_check'
    ) THEN
        ALTER TABLE public.verification_challenges
        ADD CONSTRAINT verification_challenges_target_exclusivity_check
        CHECK (
            NOT (
                client_id IS NOT NULL
                AND barber_id IS NOT NULL
            )
        );
    END IF;
END $$;

-- 5. Criar índice UNIQUE parcial para garantir no máximo UM challenge staff não consumido por barbeiro
DROP INDEX IF EXISTS public.verification_challenges_one_active_staff_idx;

CREATE UNIQUE INDEX IF NOT EXISTS verification_challenges_one_active_staff_idx
ON public.verification_challenges (barber_id)
WHERE
    barber_id IS NOT NULL
    AND purpose = 'staff_email_verification'
    AND consumed_at IS NULL;

-- 6. RPC: Validação atômica de OTP com incremento seguro de tentativas e FOR UPDATE
CREATE OR REPLACE FUNCTION public.verify_staff_verification_challenge(
    p_challenge_id uuid,
    p_barber_id uuid,
    p_code_hash text,
    p_max_attempts int DEFAULT 5
)
RETURNS TABLE (
    success boolean,
    error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row record;
BEGIN
    SELECT * INTO v_row
    FROM public.verification_challenges
    WHERE id = p_challenge_id
      AND barber_id = p_barber_id
      AND purpose = 'staff_email_verification'
      AND verified_at IS NULL
      AND consumed_at IS NULL
      AND expires_at > now()
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'NOT_FOUND_OR_EXPIRED'::text;
        RETURN;
    END IF;

    IF (v_row.attempts >= p_max_attempts) THEN
        DELETE FROM public.verification_challenges WHERE id = p_challenge_id;
        RETURN QUERY SELECT false, 'ATTEMPTS_EXCEEDED'::text;
        RETURN;
    END IF;

    IF (v_row.code_hash <> p_code_hash) THEN
        IF ((v_row.attempts + 1) >= p_max_attempts) THEN
            DELETE FROM public.verification_challenges WHERE id = p_challenge_id;
            RETURN QUERY SELECT false, 'ATTEMPTS_EXCEEDED'::text;
        ELSE
            UPDATE public.verification_challenges
            SET attempts = attempts + 1
            WHERE id = p_challenge_id;
            RETURN QUERY SELECT false, 'INVALID_CODE'::text;
        END IF;
        RETURN;
    END IF;

    -- Código válido e dentro do limite: marcação atômica
    UPDATE public.verification_challenges
    SET verified_at = now()
    WHERE id = p_challenge_id;

    RETURN QUERY SELECT true, 'OK'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_staff_verification_challenge(uuid, uuid, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_staff_verification_challenge(uuid, uuid, text, int) TO service_role;

-- 7. RPC: Aquisição atômica de direito de consumo (Claim) no Finalize
CREATE OR REPLACE FUNCTION public.claim_staff_verification_challenge(
    p_barber_id uuid,
    p_email text,
    p_max_attempts int DEFAULT 5
)
RETURNS TABLE (
    claimed boolean,
    challenge_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN
    UPDATE public.verification_challenges
    SET consumed_at = now()
    WHERE id = (
        SELECT id
        FROM public.verification_challenges
        WHERE barber_id = p_barber_id
          AND email = p_email
          AND purpose = 'staff_email_verification'
          AND verified_at IS NOT NULL
          AND consumed_at IS NULL
          AND expires_at > now()
          AND attempts < p_max_attempts
        ORDER BY verified_at DESC
        LIMIT 1
        FOR UPDATE
    )
    RETURNING id INTO v_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::uuid;
    ELSE
        RETURN QUERY SELECT true, v_id;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_staff_verification_challenge(uuid, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_staff_verification_challenge(uuid, text, int) TO service_role;

-- 8. Comentários explicativos no catálogo do PostgreSQL
COMMENT ON COLUMN public.verification_challenges.barber_id IS 'Identificador do colaborador/barbeiro quando o desafio é de staff (purpose = staff_email_verification). Mutuamente exclusivo com client_id.';
COMMENT ON COLUMN public.verification_challenges.consumed_at IS 'Timestamp em que o desafio verificado foi reivindicado/consumido para criação ou vínculo de conta, prevenindo duplo finalize.';
COMMENT ON CONSTRAINT verification_challenges_target_exclusivity_check ON public.verification_challenges IS 'Garante que um desafio de verificação não aponte simultaneamente para cliente e colaborador.';
COMMENT ON INDEX public.verification_challenges_one_active_staff_idx IS 'Garante unicidade estrita: no máximo um desafio OTP staff não consumido por colaborador.';
