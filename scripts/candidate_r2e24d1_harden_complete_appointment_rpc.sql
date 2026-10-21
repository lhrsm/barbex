-- Migration: 20261021123000_r2e24d1_harden_complete_appointment_rpc.sql
-- Mandate: BARBEX R2E.24D.1 — Financial Hardening for complete_appointment RPC
-- Enforces:
--   1. Authentication & Tenant Authorization (auth.uid(), roles, ownership, barber assignment)
--   2. Strict Pessimistic Row Locking (FOR UPDATE)
--   3. Mandatory Payment Verification (Fail-closed: requires payment_status = 'paid', subscription, or verified zero amount)
--   4. Financial Idempotency (Single transaction creation, idempotent commission, early return if already completed)

BEGIN;

CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid,
    p_changed_by_type text DEFAULT 'system'::text,
    p_changed_by_id uuid DEFAULT NULL::uuid,
    p_source text DEFAULT 'rpc_complete_appointment'::text,
    p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_caller_id uuid;
    v_is_authorized boolean := false;
    v_credit_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_pix_amount NUMERIC(10,2);
    v_cash_amount NUMERIC(10,2);
    v_card_amount NUMERIC(10,2);
    v_final_amount NUMERIC(10,2);
    v_total_price NUMERIC(10,2);
    v_sub_covered NUMERIC(10,2);
    v_extra_amount NUMERIC(10,2);
    v_cashbackable_base NUMERIC(10,2);
    v_cashback_earned NUMERIC(10,2) := 0;
    v_cashback_percentage NUMERIC;
    v_cashback_enabled BOOLEAN := false;
    v_existing_trans BOOLEAN;
    v_status_before TEXT;
    v_description TEXT;
    v_cashback_tx_id UUID;
    v_cashback_skipped BOOLEAN := false;
    v_cashback_blocked_by_subscription BOOLEAN := false;
    v_cashback_blocked_by_module BOOLEAN := false;
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_income_amount NUMERIC(10,2);
    v_fully_covered BOOLEAN;
    v_commission_result jsonb;
    v_owner_id UUID;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- 1. Identificar operador autenticado
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL AND current_user NOT IN ('service_role', 'postgres') THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'UNAUTHORIZED',
        'error', 'Usuário não autenticado.'
      );
    END IF;
    IF v_caller_id IS NULL THEN
      v_caller_id := p_changed_by_id;
    END IF;

    -- 2. Carregar agendamento com bloqueio pessimista de linha (FOR UPDATE)
    SELECT a.*, c.name as customer_name, s.name as service_name
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id = p_appointment_id
    FOR UPDATE OF a
    INTO v_appt;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'APPOINTMENT_NOT_FOUND',
        'error', 'Agendamento não encontrado.'
      );
    END IF;

    -- 3. Validar vínculo e permissões do operador no tenant
    -- Se executado internamente por service_role/postgres SEM auth.uid() e sem p_changed_by_id, é manutenção do sistema
    IF (current_user IN ('service_role', 'postgres') AND auth.uid() IS NULL AND p_changed_by_id IS NULL) OR public.is_super_admin_user() THEN
      v_is_authorized := true;
    ELSIF public.is_tenant_owner(v_appt.tenant_id) THEN
      v_is_authorized := true;
    ELSIF v_appt.barber_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.barbers b
      WHERE b.id = v_appt.barber_id
        AND b.user_id = v_caller_id
    ) THEN
      v_is_authorized := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.reception_permissions rp
      WHERE rp.tenant_id = v_appt.tenant_id
        AND rp.user_id = v_caller_id
        AND rp.is_active = true
    ) THEN
      v_is_authorized := true;
    ELSIF public.has_tenant_role(v_appt.tenant_id, 'manager')
       OR public.has_tenant_role(v_appt.tenant_id, 'admin')
       OR public.has_tenant_role(v_appt.tenant_id, 'owner') THEN
      v_is_authorized := true;
    ELSIF public.is_active_tenant_member(v_appt.tenant_id) THEN
      v_is_authorized := true;
    -- Validação de operador via caller_id contra o tenant canônico
    ELSIF v_caller_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.barbershops WHERE id = v_appt.tenant_id AND owner_id = v_caller_id)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND tenant_id = v_appt.tenant_id AND role IN ('admin', 'tenant_admin', 'barber', 'reception', 'manager'))
    ) THEN
      v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'FORBIDDEN',
        'error', 'Acesso negado: operador não possui permissão para concluir atendimentos neste estabelecimento.'
      );
    END IF;

    -- 4. Validar estado do agendamento
    v_status_before := v_appt.status;
    IF v_appt.status = 'cancelled' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'CANNOT_COMPLETE_CANCELLED',
        'error', 'Não é possível concluir um agendamento cancelado.'
      );
    END IF;

    -- Idempotência: se já concluído, não duplicar transações ou comissões
    IF v_appt.status = 'completed' THEN
      v_commission_result := public.create_barber_commission_for_appointment(p_appointment_id);
      RETURN jsonb_build_object('success', true, 'already', true, 'commission', v_commission_result);
    END IF;

    -- 5. Carregar perfil do tenant para configurações de fidelidade
    SELECT * FROM public.profiles WHERE id = v_appt.tenant_id INTO v_tenant;

    v_total_price := COALESCE(v_appt.total_price, 0);
    v_sub_covered := COALESCE(v_appt.subscription_covered_amount, 0);
    v_extra_amount := GREATEST(0, v_total_price - v_sub_covered);
    v_fully_covered := (v_sub_covered >= v_total_price AND v_total_price > 0);

    -- 6. VERIFICAÇÃO RIGOROSA DE PAGAMENTO PERSISTIDO (FAIL-CLOSED)
    -- O atendimento só pode ser concluído se comprovadamente:
    -- a) For totalmente coberto pelo plano/assinatura (v_fully_covered = true)
    -- b) O valor total for zero (cortesia legítima)
    -- c) O pagamento tiver sido confirmado e persistido no banco (payment_status in ('paid', 'covered_by_subscription'))
    IF NOT (
      v_fully_covered OR
      v_total_price = 0 OR
      v_appt.payment_status IN ('paid', 'covered_by_subscription')
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'PAYMENT_REQUIRED',
        'error', 'Pagamento pendente. Registre ou confirme o pagamento antes de concluir o atendimento.'
      );
    END IF;

    -- 7. Resolução de montantes e método de pagamento
    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, 0);
    v_card_amount := COALESCE((p_metadata->>'card_amount')::numeric, 0);

    IF v_fully_covered THEN
        v_final_amount := 0;
        v_payment_method := 'subscription';
        v_payment_status := 'covered_by_subscription';
    ELSE
        v_final_amount := GREATEST(0, v_extra_amount - v_credit_used - v_cashback_used);
        v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'cash');
        v_payment_status := 'paid';
    END IF;

    -- 8. Cashback
    v_cashback_enabled := COALESCE(v_tenant.cashback_enabled, false);
    v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
    v_cashbackable_base := v_extra_amount;

    IF NOT v_cashback_enabled THEN
        v_cashback_blocked_by_module := true;
        v_cashback_earned := 0;
    ELSIF v_fully_covered THEN
        v_cashback_blocked_by_subscription := true;
        v_cashback_earned := 0;
    ELSIF v_cashback_percentage > 0 AND v_cashbackable_base > 0 THEN
        v_cashback_earned := (v_cashbackable_base * v_cashback_percentage) / 100;
        IF v_sub_covered > 0 THEN
            v_cashback_blocked_by_subscription := true;
        END IF;
    END IF;

    -- 9. Transação Financeira Única (Garantia de Não Duplicidade)
    SELECT EXISTS (SELECT 1 FROM public.transactions WHERE appointment_id = p_appointment_id AND type = 'income') INTO v_existing_trans;
    v_income_amount := v_extra_amount;

    IF NOT v_existing_trans AND v_income_amount > 0 THEN
        v_description := 'Atendimento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente')
            || CASE WHEN v_sub_covered > 0 THEN ' (diferença assinatura)' ELSE '' END;

        v_owner_id := public.resolve_appointment_owner(v_appt.tenant_id, v_appt.barber_id);
        IF v_owner_id IS NULL THEN
            RAISE EXCEPTION 'OWNER_RESOLUTION_FAILED: Não foi possível resolver inequivocamente o proprietário legítimo do estabelecimento para escrituração financeira.'
                USING ERRCODE = 'P0001';
        END IF;

        INSERT INTO public.transactions (
            user_id, tenant_id, appointment_id, barber_id, type, category,
            amount, pix_amount, cash_amount, credit_card_amount,
            credits_amount, cashback_amount, payment_method,
            description, date, payment_breakdown
        ) VALUES (
            v_owner_id, v_owner_id, p_appointment_id, v_appt.barber_id, 'income', 'Serviço',
            v_income_amount, v_pix_amount, v_cash_amount, v_card_amount,
            v_credit_used, v_cashback_used, v_payment_method,
            v_description, CURRENT_DATE,
            jsonb_build_object(
                'pix', v_pix_amount, 'cash', v_cash_amount, 'card', v_card_amount,
                'credits', v_credit_used, 'cashback', v_cashback_used,
                'subscription_covered', v_sub_covered,
                'total_price', v_total_price, 'extra_amount', v_extra_amount
            )
        );
    END IF;

    -- 10. Lançamento do Cashback
    IF v_cashback_earned > 0 THEN
        SELECT id FROM public.cashback_transactions
        WHERE appointment_id = p_appointment_id INTO v_cashback_tx_id;

        IF v_cashback_tx_id IS NULL THEN
            INSERT INTO public.cashback_transactions (
                customer_id, tenant_id, appointment_id, amount, base_amount, type, description
            ) VALUES (
                v_appt.customer_id, v_appt.tenant_id, p_appointment_id, v_cashback_earned, v_cashbackable_base, 'earned',
                'Cashback: ' || COALESCE(v_appt.service_name, 'Serviço') ||
                CASE WHEN v_sub_covered > 0 THEN ' (apenas valor extra)' ELSE '' END
            ) RETURNING id INTO v_cashback_tx_id;

            UPDATE public.customers
            SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned,
                updated_at = v_now
            WHERE id = v_appt.customer_id;
        END IF;
    ELSE
        v_cashback_skipped := true;
    END IF;

    -- 11. Atualizar log de uso de assinatura se aplicável
    IF v_appt.subscription_id IS NOT NULL AND v_sub_covered > 0 THEN
        UPDATE public.subscription_usage_logs
        SET status = 'consumed',
            used_at = COALESCE(used_at, v_now)
        WHERE appointment_id = p_appointment_id
          AND (status IS NULL OR status NOT IN ('consumed','refunded'));
    END IF;

    -- 12. Persistir conclusão no agendamento canônico
    UPDATE public.appointments
    SET status = 'completed',
        completed_at = v_now,
        updated_at = v_now,
        cashback_earned = v_cashback_earned,
        payment_method = v_payment_method,
        payment_status = v_payment_status,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used
    WHERE id = p_appointment_id;

    -- 13. Criar comissão do barbeiro (idempotente)
    v_commission_result := public.create_barber_commission_for_appointment(p_appointment_id);

    -- 14. Registro de auditoria canônica
    INSERT INTO public.appointment_status_logs (
      appointment_id,
      old_status,
      new_status,
      status_before,
      status_after,
      changed_by_type,
      changed_by_id,
      source,
      metadata
    ) VALUES (
      p_appointment_id,
      v_status_before,
      'completed',
      v_status_before,
      'completed',
      COALESCE(p_changed_by_type, 'system'),
      v_caller_id,
      COALESCE(p_source, 'rpc_complete_appointment'),
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'tenant_id', v_appt.tenant_id,
        'cashback_earned', v_cashback_earned,
        'cashback_tx_id', v_cashback_tx_id,
        'cashback_blocked_by_subscription', v_cashback_blocked_by_subscription,
        'cashback_blocked_by_module', v_cashback_blocked_by_module,
        'extra_amount', v_extra_amount,
        'subscription_covered', v_sub_covered,
        'barber_commission', v_commission_result,
        'payment_status', v_payment_status
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'appointment_id', p_appointment_id,
      'cashback_earned', v_cashback_earned,
      'cashback_skipped', v_cashback_skipped,
      'cashback_blocked_by_subscription', v_cashback_blocked_by_subscription,
      'cashback_blocked_by_module', v_cashback_blocked_by_module,
      'commission', v_commission_result
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_appointment(uuid, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_appointment(uuid, text, uuid, text, jsonb) TO anon, authenticated, service_role;

COMMIT;
