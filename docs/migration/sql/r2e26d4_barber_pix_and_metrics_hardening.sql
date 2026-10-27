-- ==============================================================================
-- BARBEX — R2E.26D.4 MIGRATION CANDIDATE (PREPARED FOR CUTOVER AUTHORIZATION)
-- Objectives:
-- 1. Close table-level UPDATE vulnerability on public.barbers:
--    - BEFORE UPDATE trigger trg_barbers_security_enforcement.
--    - Strictly blocks non-admin authenticated users (barbers) from altering
--      administrative columns: commission_rate, commission_type,
--      commission_fixed_value, commission_bonus_value, monthly_goal,
--      category, tenant_id, user_id.
--    - Enforces that PIX changes (pix_key, pix_key_type, accepts_tips) by
--      non-admin users MUST go through the authorized RPC update_barber_pix_info.
--    - Preserves all legitimate tenant admin management operations.
-- 2. Hardened RPC for Barber PIX Tip Settings (update_barber_pix_info):
--    - Server-side authorization: caller must be barber themselves (auth.uid() = user_id)
--      OR canonical tenant admin (can_access_tenant(tenant_id)).
--    - Strict column whitelist: updates ONLY pix_key, pix_key_type, accepts_tips.
--    - Server-side format validation for CPF, CNPJ, Phone, Email, Random key.
--    - Canonical normalization (lowercase email, digits-only for documents, +55 for phone).
--    - Search path security: public, pg_temp.
--    - Minimal EXECUTE privileges: authenticated, service_role (revoked from anon/PUBLIC).
-- 3. Scalable Server-Side Team Appointments Summary RPC (get_team_appointments_summary):
--    - Multi-tenant isolation verified on server via can_access_tenant(p_tenant_id).
--    - Eliminates PostgREST 1,000 row truncation limit via database-level aggregation.
--    - Correct breakdown by status (total, completed, scheduled/confirmed).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURITY TRIGGER FUNCTION: trg_enforce_barber_update_security
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_enforce_barber_update_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_is_tenant_admin boolean := false;
  v_call_context text := '';
BEGIN
  -- A. Background workers, internal migrations and service_role bypass
  IF current_setting('role', true) = 'service_role' 
     OR (auth.jwt() ->> 'role') = 'service_role' 
     OR v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- B. Check if caller is canonical tenant administrator or super admin
  v_is_tenant_admin := public.can_access_tenant(OLD.tenant_id);

  -- C. Tenant Administrator flow
  IF v_is_tenant_admin THEN
    -- Admin cannot move barber to another tenant unless super_admin
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Não é permitido transferir o profissional para outro estabelecimento.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- D. Professional (Barber) self-management flow
  IF OLD.user_id IS NOT NULL AND OLD.user_id = v_caller_id THEN
    -- 1. Tenant and identity integrity
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Profissional não tem permissão para alterar tenant_id.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Profissional não tem permissão para alterar user_id.'
        USING ERRCODE = '42501';
    END IF;

    -- 2. Administrative and commission protection
    IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Profissional não tem permissão para alterar taxa de comissão.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.commission_type IS DISTINCT FROM OLD.commission_type THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Profissional não tem permissão para alterar tipo de comissão.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.commission_fixed_value IS DISTINCT FROM OLD.commission_fixed_value THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Profissional não tem permissão para alterar valor fixo de comissão.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.commission_bonus_value IS DISTINCT FROM OLD.commission_bonus_value THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Profissional não tem permissão para alterar bônus de comissão.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.monthly_goal IS DISTINCT FROM OLD.monthly_goal THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Profissional não tem permissão para alterar meta mensal.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.category IS DISTINCT FROM OLD.category THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Profissional não tem permissão para alterar categoria funcional.'
        USING ERRCODE = '42501';
    END IF;

    -- 3. PIX changes must be channeled through the authorized RPC update_barber_pix_info
    -- Recognized strictly via PostgreSQL call stack inspection (PG_CONTEXT) without relying on session flags
    IF (NEW.pix_key IS DISTINCT FROM OLD.pix_key 
        OR NEW.pix_key_type IS DISTINCT FROM OLD.pix_key_type 
        OR NEW.accepts_tips IS DISTINCT FROM OLD.accepts_tips) THEN
      GET DIAGNOSTICS v_call_context = PG_CONTEXT;
      IF v_call_context NOT LIKE '%update_barber_pix_info%' THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Atualizações de PIX devem ser realizadas exclusivamente pela RPC autorizada update_barber_pix_info.'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- E. Unauthorized caller
  RAISE EXCEPTION 'PERMISSION_DENIED: Usuário não autorizado a atualizar este profissional.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_barbers_security_enforcement ON public.barbers;
CREATE TRIGGER trg_barbers_security_enforcement
BEFORE UPDATE ON public.barbers
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_barber_update_security();


-- ------------------------------------------------------------------------------
-- 2. HARDENED RPC: update_barber_pix_info
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_barber_pix_info(
  p_barber_id uuid,
  p_pix_key text,
  p_pix_key_type text,
  p_accepts_tips boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_barber record;
  v_normalized_key text := trim(COALESCE(p_pix_key, ''));
  v_key_type text := lower(trim(COALESCE(p_pix_key_type, '')));
  v_clean_digits text;
BEGIN
  -- 1. Authentication check
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED: Sessão não autenticada.');
  END IF;

  -- 2. Existence and ownership check
  SELECT id, user_id, tenant_id INTO v_barber
  FROM public.barbers
  WHERE id = p_barber_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND: Profissional não encontrado.');
  END IF;

  -- 3. Authorization check: caller must be the barber themselves or canonical tenant admin
  IF NOT (
    (v_barber.user_id IS NOT NULL AND v_barber.user_id = v_caller_id)
    OR public.can_access_tenant(v_barber.tenant_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED: Não autorizado a alterar dados deste profissional.');
  END IF;

  -- 4. Server-side validation and normalization if tips are accepted
  IF p_accepts_tips IS TRUE AND v_normalized_key <> '' THEN
    IF v_key_type NOT IN ('cpf', 'cnpj', 'phone', 'email', 'random') THEN
      RETURN jsonb_build_object('success', false, 'error', 'INVALID_TYPE: Tipo de chave PIX inválido.');
    END IF;

    CASE v_key_type
      WHEN 'cpf' THEN
        v_clean_digits := regexp_replace(v_normalized_key, '\D', '', 'g');
        IF length(v_clean_digits) <> 11 OR v_clean_digits ~ '^(\d)\1{10}$' THEN
          RETURN jsonb_build_object('success', false, 'error', 'INVALID_CPF: Formato de CPF inválido.');
        END IF;
        v_normalized_key := v_clean_digits;

      WHEN 'cnpj' THEN
        v_clean_digits := regexp_replace(v_normalized_key, '\D', '', 'g');
        IF length(v_clean_digits) <> 14 OR v_clean_digits ~ '^(\d)\1{13}$' THEN
          RETURN jsonb_build_object('success', false, 'error', 'INVALID_CNPJ: Formato de CNPJ inválido.');
        END IF;
        v_normalized_key := v_clean_digits;

      WHEN 'phone' THEN
        v_clean_digits := regexp_replace(v_normalized_key, '\D', '', 'g');
        IF length(v_clean_digits) = 10 OR length(v_clean_digits) = 11 THEN
          v_normalized_key := '+55' || v_clean_digits;
        ELSIF length(v_clean_digits) = 12 OR length(v_clean_digits) = 13 THEN
          v_normalized_key := '+' || v_clean_digits;
        ELSE
          RETURN jsonb_build_object('success', false, 'error', 'INVALID_PHONE: Formato de telefone inválido.');
        END IF;

      WHEN 'email' THEN
        IF v_normalized_key !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
          RETURN jsonb_build_object('success', false, 'error', 'INVALID_EMAIL: Formato de e-mail inválido.');
        END IF;
        v_normalized_key := lower(v_normalized_key);

      WHEN 'random' THEN
        IF v_normalized_key !~* '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$'
           AND length(v_normalized_key) <> 32 AND length(v_normalized_key) <> 36 THEN
          RETURN jsonb_build_object('success', false, 'error', 'INVALID_RANDOM_KEY: Chave aleatória inválida.');
        END IF;
        v_normalized_key := lower(v_normalized_key);
    END CASE;
  ELSE
    -- If accepts_tips is false, clear or keep normalized key
    IF p_accepts_tips IS FALSE THEN
      v_normalized_key := NULLIF(v_normalized_key, '');
    END IF;
  END IF;

  -- 5. Whitelist Update: ONLY PIX columns and updated_at
  UPDATE public.barbers
  SET pix_key = v_normalized_key,
      pix_key_type = v_key_type,
      accepts_tips = COALESCE(p_accepts_tips, false),
      updated_at = now()
  WHERE id = p_barber_id;

  RETURN jsonb_build_object(
    'success', true,
    'barber_id', p_barber_id,
    'pix_key', v_normalized_key,
    'pix_key_type', v_key_type,
    'accepts_tips', COALESCE(p_accepts_tips, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_barber_pix_info(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_barber_pix_info(uuid, text, text, boolean) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. SCALABLE TEAM SUMMARY RPC: get_team_appointments_summary
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_team_appointments_summary(p_tenant_id uuid)
RETURNS TABLE (
  barber_id uuid,
  total_appointments bigint,
  completed_appointments bigint,
  scheduled_appointments bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Multi-tenant authorization: caller must have tenant access
  IF NOT public.can_access_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Usuário não autorizado para este estabelecimento.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.barber_id,
    count(a.id) AS total_appointments,
    count(a.id) FILTER (WHERE a.status = 'completed') AS completed_appointments,
    count(a.id) FILTER (WHERE a.status IN ('scheduled', 'confirmed')) AS scheduled_appointments
  FROM public.appointments a
  WHERE a.tenant_id = p_tenant_id
    AND a.barber_id IS NOT NULL
  GROUP BY a.barber_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_appointments_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_appointments_summary(uuid) TO authenticated, service_role;
