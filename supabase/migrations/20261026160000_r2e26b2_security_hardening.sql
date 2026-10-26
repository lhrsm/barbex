-- ==============================================================================
-- BARBEX — R2E.26B.2: SECURITY HARDENING BEFORE CUTOVER
-- Target Project: ywdwrstxvsdqiryhieiz
-- Migration: 20261026160000_r2e26b2_security_hardening.sql
-- Objectives:
--   1. Harden public.get_barber_appointments RPC against unauthorized callers:
--      - Require authenticated session (auth.uid() IS NOT NULL)
--      - Verify caller is either the barber themself, the tenant owner, super_admin,
--        or an active staff member with an administrative/reception role in that tenant.
--      - Explicitly reject anon and non-authorized peers from same or other tenants.
--   2. Harden public.appointment_reviews INSERT / UPDATE against impersonation:
--      - Restrict direct table INSERT to authenticated clients owning the customer record.
--      - Disallow staff/employees from forging reviews on behalf of customers.
--      - Fully preserve existing checks in validate_appointment_review_before_insert()
--        (completed status, tenant/customer consistency, skipped decision, locking).
--      - Preserve legitimate review flows (portal ReviewModal and WhatsApp review links).
--   3. Idempotent and fail-closed security posture.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDENING DA RPC GET_BARBER_APPOINTMENTS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_barber_appointments(p_barber_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_barber public.barbers%ROWTYPE;
  v_is_barber_self boolean := false;
  v_is_tenant_admin boolean := false;
  v_result jsonb;
BEGIN
  -- 1. Bloqueia chamadas anônimas
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated: access denied';
  END IF;

  -- 2. Localiza o profissional solicitado
  SELECT * INTO v_barber
  FROM public.barbers
  WHERE id = p_barber_id;

  IF v_barber.id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- 3. Verifica se o solicitante é o próprio profissional
  IF v_barber.user_id = v_caller THEN
    v_is_barber_self := true;
  ELSIF v_barber.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM auth.users u 
    WHERE u.id = v_caller AND lower(u.email) = lower(v_barber.email)
  ) THEN
    v_is_barber_self := true;
  END IF;

  -- 4. Verifica se o solicitante possui papel administrativo/operacional no tenant
  -- Não confia apenas em can_access_tenant, mas exige perfil de gestão ou recepção
  IF public.is_super_admin_user() 
     OR public.is_tenant_owner(v_barber.tenant_id)
     OR EXISTS (
       SELECT 1 FROM public.tenant_memberships tm
       WHERE tm.tenant_id = v_barber.tenant_id
         AND tm.user_id = v_caller
         AND tm.status = 'active'
         AND tm.role IN ('admin', 'tenant_admin', 'manager', 'receptionist', 'reception')
     )
     OR EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = v_caller
         AND (p.tenant_id = v_barber.tenant_id OR p.id = v_barber.tenant_id)
         AND p.role IN ('admin', 'tenant_admin', 'super_admin', 'manager', 'receptionist', 'reception')
     )
  THEN
    v_is_tenant_admin := true;
  END IF;

  -- 5. Se não for o próprio barbeiro e não for admin/recepcionista do tenant, bloqueia
  IF NOT (v_is_barber_self OR v_is_tenant_admin) THEN
    RAISE EXCEPTION 'unauthorized: caller cannot access appointments for this barber';
  END IF;

  -- 6. Executa a extração dos agendamentos
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.start_time DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      a.*,
      jsonb_build_object(
        'name', c.name,
        'phone', c.phone,
        'avatar_url', c.avatar_url
      ) AS customers,
      jsonb_build_object(
        'name', s.name
      ) AS services
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services  s ON s.id = a.service_id
    WHERE a.barber_id = p_barber_id
  ) t;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_barber_appointments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_barber_appointments(uuid) TO authenticated;


-- ------------------------------------------------------------------------------
-- 2. HARDENING DA TRIGGER DE VALIDAÇÃO DE AVALIAÇÃO ANTES DO INSERT
-- Preserva 100% das regras originais e adiciona validação de identidade estrita
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_appointment_review_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appt public.appointments;
  v_auth_user uuid := auth.uid();
  v_role text := auth.role();
BEGIN
  -- 1. Lock exclusivo no appointment correspondente para serialização estrita com RPC
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = NEW.appointment_id
  FOR UPDATE;

  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found: appointment % does not exist', NEW.appointment_id;
  END IF;

  -- 2. O atendimento precisa obrigatoriamente estar concluído
  IF v_appt.status != 'completed' THEN
    RAISE EXCEPTION 'appointment_not_completed: cannot review appointment with status %', v_appt.status;
  END IF;

  -- 3. Decisão final e irreversível: se o cliente já recusou (skipped), rejeita INSERT
  IF v_appt.review_decision = 'skipped' THEN
    RAISE EXCEPTION 'review_decision_already_skipped: customer chose not to review this appointment';
  END IF;

  -- 4. Coerência de cliente e tenant
  IF v_appt.customer_id != NEW.customer_id OR v_appt.tenant_id != NEW.tenant_id THEN
    RAISE EXCEPTION 'inconsistent_review_target: customer or tenant does not match appointment';
  END IF;

  -- 5. BLINDAGEM DE IDENTIDADE (R2E.26B.2):
  -- Quando a chamada for executada por usuário autenticado, exige que o chamador seja
  -- estritamente o titular do perfil do cliente (auth_user_id = auth.uid()).
  -- Impede que outro cliente ou colaborador do estabelecimento crie avaliações em nome de outrem.
  IF v_role = 'authenticated' AND v_auth_user IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = NEW.customer_id
        AND c.tenant_id = NEW.tenant_id
        AND c.auth_user_id = v_auth_user
    ) THEN
      RAISE EXCEPTION 'unauthorized_review_submission: caller is not the owner of this customer profile';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_appointment_review_before_insert ON public.appointment_reviews;
CREATE TRIGGER trg_validate_appointment_review_before_insert
  BEFORE INSERT ON public.appointment_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_appointment_review_before_insert();


-- ------------------------------------------------------------------------------
-- 3. HARDENING DAS POLICIES RLS DE APPOINTMENT_REVIEWS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can submit reviews for real appointments" ON public.appointment_reviews;
DROP POLICY IF EXISTS "Anyone can insert appointment reviews" ON public.appointment_reviews;
DROP POLICY IF EXISTS "Canonical tenant access for appointment_reviews" ON public.appointment_reviews;
DROP POLICY IF EXISTS "Customers can insert own appointment reviews" ON public.appointment_reviews;

CREATE POLICY "Customers can insert own appointment reviews"
ON public.appointment_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  appointment_id IS NOT NULL
  AND customer_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.customers c
    JOIN public.appointments a ON a.id = appointment_reviews.appointment_id AND a.tenant_id = appointment_reviews.tenant_id
    WHERE c.id = appointment_reviews.customer_id
      AND c.tenant_id = appointment_reviews.tenant_id
      AND c.auth_user_id = auth.uid()
      AND a.customer_id = c.id
  )
  AND (barbershop_rating IS NULL OR barbershop_rating BETWEEN 1 AND 5)
  AND (barber_rating IS NULL OR barber_rating BETWEEN 1 AND 5)
  AND (service_rating IS NULL OR service_rating BETWEEN 1 AND 5)
  AND coalesce(show_on_frontend, false) = false
  AND approved_at IS NULL
  AND approved_by IS NULL
  AND reply IS NULL
);

-- Permite que o cliente atualize exclusivamente suas próprias avaliações pendentes no portal
DROP POLICY IF EXISTS "Customers can update own pending reviews" ON public.appointment_reviews;

CREATE POLICY "Customers can update own pending reviews"
ON public.appointment_reviews
FOR UPDATE
TO authenticated
USING (
  testimonial_status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = appointment_reviews.customer_id
      AND c.tenant_id = appointment_reviews.tenant_id
      AND c.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  testimonial_status = 'pending'
  AND approved_at IS NULL
  AND approved_by IS NULL
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = appointment_reviews.customer_id
      AND c.tenant_id = appointment_reviews.tenant_id
      AND c.auth_user_id = auth.uid()
  )
);
