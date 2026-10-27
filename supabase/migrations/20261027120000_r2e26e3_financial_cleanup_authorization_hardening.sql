-- ==============================================================================
-- BARBEX — R2E.26E.3: FINANCIAL CLEANUP AUTHORIZATION HARDENING
-- Restringe a execução de public.clear_barbershop_financial_data exclusivamente
-- ao proprietário legítimo do estabelecimento (barbershops.owner_id = auth.uid())
-- ou ao superadministrador do sistema (profiles.role IN ('super_admin', 'superadmin')).
-- Rejeita sumariamente perfil financial, recepcionista, barbeiro, chamadas cross-tenant e anônimas.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.clear_barbershop_financial_data(p_tenant_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_customer_record RECORD;
    v_count_appts INTEGER;
BEGIN
    -- 1. Hardened Authorization Gate: ONLY tenant owner or super admin
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Sessão não autenticada.'
        USING ERRCODE = '42501';
    END IF;

    IF NOT (public.is_tenant_owner(p_tenant_id) OR public.is_super_admin_user()) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Apenas o proprietário do estabelecimento ou super admin tem autorização para limpar dados financeiros.'
        USING ERRCODE = '42501';
    END IF;

    -- 2. Contar agendamentos antes
    SELECT count(*) INTO v_count_appts FROM public.appointments WHERE tenant_id = p_tenant_id;

    -- 3. Delete activity data (Ordem preserva integridade referencial)
    DELETE FROM public.appointment_status_logs WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = p_tenant_id);
    DELETE FROM public.refund_requests WHERE tenant_id = p_tenant_id;
    DELETE FROM public.cashback_transactions WHERE tenant_id = p_tenant_id;
    DELETE FROM public.credit_transactions WHERE tenant_id = p_tenant_id;
    DELETE FROM public.transactions WHERE tenant_id = p_tenant_id;
    DELETE FROM public.product_sales WHERE tenant_id = p_tenant_id;
    DELETE FROM public.appointments WHERE tenant_id = p_tenant_id;
    DELETE FROM public.financial_adjustment_logs WHERE tenant_id = p_tenant_id;
    DELETE FROM public.barber_commissions WHERE tenant_id = p_tenant_id;
    DELETE FROM public.commission_entries WHERE tenant_id = p_tenant_id;
    DELETE FROM public.commission_closings WHERE tenant_id = p_tenant_id;

    -- 4. Recalcular saldos de clientes afetados
    FOR v_customer_record IN SELECT id FROM public.customers WHERE tenant_id = p_tenant_id LOOP
        PERFORM public.fn_recalculate_customer_balances(v_customer_record.id);
        
        UPDATE public.customers 
        SET 
            credits = 0, 
            cashback_balance = 0, 
            loyalty_points = 0,
            total_spent = 0,
            appointments_count = 0
        WHERE id = v_customer_record.id;
    END LOOP;
    
    -- 5. Zerar carteira do tenant se existir
    UPDATE public.wallet SET balance = 0 WHERE user_id = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Dados financeiros limpos com sucesso com autorização confirmada.',
        'appointments_removed', v_count_appts
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp';

REVOKE ALL ON FUNCTION public.clear_barbershop_financial_data(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clear_barbershop_financial_data(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.clear_barbershop_financial_data(uuid) IS 'Limpeza financeira com autorização estrita server-side (Phase R2E.26E.3)';
