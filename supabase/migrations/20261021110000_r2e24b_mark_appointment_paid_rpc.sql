-- ==============================================================================
-- BARBEX — R2E.24B: RPC mark_appointment_as_paid
-- Security Definer RPC for authorized staff payment confirmation
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.mark_appointment_as_paid(
  p_appointment_id uuid,
  p_payment_method text DEFAULT 'cash'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_appt RECORD;
  v_caller_id uuid;
  v_is_authorized boolean := false;
  v_method text;
  v_now timestamptz := now();
BEGIN
  -- 1. Identify caller
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'error', 'Usuário não autenticado.'
    );
  END IF;

  -- 2. Fetch appointment with row lock
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'APPOINTMENT_NOT_FOUND',
      'error', 'Agendamento não encontrado.'
    );
  END IF;

  -- 3. Check authorization against appointment canonical tenant
  -- Super admin bypass
  IF public.is_super_admin_user() THEN
    v_is_authorized := true;
  -- Tenant Owner
  ELSIF public.is_tenant_owner(v_appt.tenant_id) THEN
    v_is_authorized := true;
  -- Direct Barber assigned to this appointment
  ELSIF v_appt.barber_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.barbers b
    WHERE b.id = v_appt.barber_id
      AND b.user_id = v_caller_id
  ) THEN
    v_is_authorized := true;
  -- Active reception staff with permission
  ELSIF EXISTS (
    SELECT 1 FROM public.reception_permissions rp
    WHERE rp.tenant_id = v_appt.tenant_id
      AND rp.user_id = v_caller_id
      AND rp.is_active = true
  ) THEN
    v_is_authorized := true;
  -- Tenant Manager or Admin role
  ELSIF public.has_tenant_role(v_appt.tenant_id, 'manager')
     OR public.has_tenant_role(v_appt.tenant_id, 'admin')
     OR public.has_tenant_role(v_appt.tenant_id, 'owner') THEN
    v_is_authorized := true;
  -- Active tenant membership (staff/barber)
  ELSIF public.is_active_tenant_member(v_appt.tenant_id) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'error', 'Acesso negado: operador não possui permissão para registrar pagamentos neste estabelecimento.'
    );
  END IF;

  -- 4. State validation
  IF v_appt.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CANNOT_PAY_CANCELLED',
      'error', 'Não é possível registrar pagamento para um agendamento cancelado.'
    );
  END IF;

  -- 5. Idempotency: if already paid, return early without duplication
  IF v_appt.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_paid', true,
      'appointment_id', p_appointment_id,
      'payment_status', 'paid',
      'paid_at', v_appt.paid_at
    );
  END IF;

  -- 6. Sanitize payment method
  v_method := lower(trim(COALESCE(p_payment_method, 'cash')));
  IF v_method NOT IN ('cash', 'card', 'pix', 'in_person', 'money', 'credit_card', 'debit_card') THEN
    v_method := 'cash';
  END IF;

  -- 7. Persist payment status update
  UPDATE public.appointments
  SET payment_status = 'paid',
      payment_method = v_method,
      paid_at = v_now,
      updated_at = v_now
  WHERE id = p_appointment_id;

  -- 8. Audit log (best-effort)
  BEGIN
    INSERT INTO public.appointment_status_logs (
      appointment_id,
      tenant_id,
      status_before,
      status_after,
      changed_by_type,
      changed_by_id,
      source,
      metadata
    ) VALUES (
      p_appointment_id,
      v_appt.tenant_id,
      v_appt.status,
      v_appt.status,
      'staff',
      v_caller_id,
      'rpc_mark_appointment_as_paid',
      jsonb_build_object(
        'action', 'mark_as_paid',
        'previous_payment_status', v_appt.payment_status,
        'new_payment_status', 'paid',
        'payment_method', v_method,
        'paid_at', v_now
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Resilient: do not abort payment update on log table collision
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'already_paid', false,
    'appointment_id', p_appointment_id,
    'payment_status', 'paid',
    'payment_method', v_method,
    'paid_at', v_now
  );
END;
$$;

-- Revoke execution from public, grant strictly to authenticated role
REVOKE EXECUTE ON FUNCTION public.mark_appointment_as_paid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_appointment_as_paid(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.mark_appointment_as_paid(uuid, text) IS 'Atômico e seguro: registra confirmação de pagamento presencial por operador autorizado com validação de tenant (R2E.24B)';
