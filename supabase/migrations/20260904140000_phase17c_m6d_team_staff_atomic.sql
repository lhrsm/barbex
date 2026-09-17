-- ==============================================================================
-- BARBEX PHASE 17C.M6D: ATOMIC TEAM INVITATION ACCEPTANCE & STAFF CHALLENGE CLAIM
-- RPCs ATÔMICAS PRIVILEGIADAS PARA EDGE FUNCTIONS DE GESTÃO DE EQUIPE
-- TARGET PROJECT: ywdwrstxvsdqiryhieiz
-- ==============================================================================

-- 1. RPC Atômica de Aceite de Convite de Equipe
CREATE OR REPLACE FUNCTION public.accept_team_invitation_atomic(
  p_token text,
  p_user_id uuid,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_invite public.user_invitations%ROWTYPE;
  v_current_profile public.profiles%ROWTYPE;
  v_is_privileged boolean := false;
  v_target_role text;
  v_clean_phone text;
BEGIN
  -- 1. Lock e validação atômica do convite
  SELECT * INTO v_invite
  FROM public.user_invitations
  WHERE token_hash = p_token
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INVITATION', 'message', 'Convite inválido ou já utilizado.');
  END IF;

  IF v_invite.expires_at <= v_now THEN
    UPDATE public.user_invitations
    SET status = 'expired', updated_at = v_now
    WHERE id = v_invite.id;
    RETURN jsonb_build_object('ok', false, 'code', 'EXPIRED_INVITATION', 'message', 'Este convite expirou.');
  END IF;

  v_target_role := v_invite.role;

  -- 2. Consultar perfil atual do usuário
  SELECT * INTO v_current_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF FOUND THEN
    IF v_current_profile.role IN ('super_admin', 'admin', 'tenant_admin') THEN
      v_is_privileged := true;
    END IF;
  END IF;

  -- 3. Upsert atômico de tenant_memberships
  INSERT INTO public.tenant_memberships (
    tenant_id,
    user_id,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_invite.tenant_id,
    p_user_id,
    v_target_role,
    'active',
    v_now,
    v_now
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET
    role = CASE
      WHEN public.tenant_memberships.role IN ('super_admin', 'admin', 'tenant_admin') THEN public.tenant_memberships.role
      ELSE EXCLUDED.role
    END,
    status = 'active',
    updated_at = v_now;

  -- 4. Atualização de Profile (preservando papéis privilegiados)
  IF NOT v_is_privileged THEN
    v_clean_phone := NULLIF(trim(p_phone), '');
    IF v_clean_phone IS NULL AND v_invite.phone IS NOT NULL THEN
      v_clean_phone := v_invite.phone;
    END IF;

    BEGIN
      UPDATE public.profiles
      SET
        role = v_target_role,
        tenant_id = v_invite.tenant_id,
        status = 'active',
        phone = COALESCE(v_clean_phone, public.profiles.phone),
        updated_at = v_now
      WHERE id = p_user_id;
    EXCEPTION WHEN unique_violation THEN
      -- Se houver colisão de telefone com índice único de staff, atualiza sem alterar o telefone
      UPDATE public.profiles
      SET
        role = v_target_role,
        tenant_id = v_invite.tenant_id,
        status = 'active',
        updated_at = v_now
      WHERE id = p_user_id;
    END;
  END IF;

  -- 5. Se for recepção, garantir permissões padrão
  IF v_target_role IN ('reception', 'receptionist') THEN
    INSERT INTO public.reception_permissions (
      user_id,
      tenant_id,
      permissions,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      p_user_id,
      v_invite.tenant_id,
      '{"can_view_calendar": true, "can_create_appointments": true, "can_manage_clients": true, "can_view_cashier": true}'::jsonb,
      true,
      v_now,
      v_now
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      is_active = true,
      updated_at = v_now;
  END IF;

  -- 6. Upsert user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, v_target_role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 7. Marcar convite como aceito
  UPDATE public.user_invitations
  SET
    status = 'accepted',
    accepted_at = v_now,
    accepted_by = p_user_id,
    updated_at = v_now
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'tenant_id', v_invite.tenant_id,
    'role', v_target_role,
    'invitation_id', v_invite.id
  );
END;
$$;

-- 2. RPC Atômica de Consumo (Claim) de Desafio de Verificação Staff
CREATE OR REPLACE FUNCTION public.claim_staff_verification_challenge(
  p_barber_id uuid,
  p_email text,
  p_max_attempts integer DEFAULT 5
)
RETURNS TABLE (
  claimed boolean,
  challenge_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_id uuid;
BEGIN
  -- Seleciona e consome atomicamente com row-level lock
  UPDATE public.verification_challenges
  SET consumed_at = v_now
  WHERE id = (
    SELECT id
    FROM public.verification_challenges
    WHERE barber_id = p_barber_id
      AND email = lower(trim(p_email))
      AND purpose = 'staff_email_verification'
      AND expires_at > v_now
      AND verified_at IS NOT NULL
      AND consumed_at IS NULL
      AND attempts < p_max_attempts
    ORDER BY verified_at DESC
    LIMIT 1
    FOR UPDATE
  )
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_id;
  ELSE
    RETURN QUERY SELECT false, NULL::uuid;
  END IF;
END;
$$;

-- 3. Permissões das RPCs
REVOKE ALL ON FUNCTION public.accept_team_invitation_atomic(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_team_invitation_atomic(text, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.accept_team_invitation_atomic(text, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation_atomic(text, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.claim_staff_verification_challenge(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_staff_verification_challenge(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_staff_verification_challenge(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_staff_verification_challenge(uuid, text, integer) TO service_role;
