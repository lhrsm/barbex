-- ==============================================================================
-- BARBEX — R2E.26E.4: GESTÃO UNIFICADA DE PAGAMENTOS DOS BARBEIROS (CANDIDATO)
-- RPC Canônica: public.pay_barber_commissions_v2
-- Reutiliza public.barber_commissions como fonte única canônica.
-- Autorização estrita: Proprietário, Superadmin, e membros com papel 'financial' ou 'admin'.
-- Atômico: Quitação e lançamento de despesa em public.transactions na mesma transação.
-- Idempotência: Suporte a chave única idempotency_key contra cliques e reenvios duplicados.
-- Preservação contábil: Registro de método, referência bancária, comprovante e notas.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.pay_barber_commissions_v2(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_commission_ids uuid[],
  p_payment_method text DEFAULT 'pix',
  p_payment_reference text DEFAULT NULL,
  p_receipt_url text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_locked_ids uuid[];
  v_count integer := 0;
  v_total_due numeric(10,2) := 0;
  v_paid_total numeric(10,2) := 0;
  v_barber_name text;
  v_transaction_id uuid;
  v_existing_tx_id uuid;
  v_is_authorized boolean := false;
BEGIN
  -- 1. Autenticação obrigatória
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Sessão não autenticada.'
    USING ERRCODE = '42501';
  END IF;

  -- 2. Validação de parâmetros mínimos
  IF p_tenant_id IS NULL OR p_barber_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_parameters',
      'message', 'Estabelecimento e profissional são parâmetros obrigatórios.'
    );
  END IF;

  IF p_commission_ids IS NULL OR array_length(p_commission_ids, 1) IS NULL OR array_length(p_commission_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_commissions_selected',
      'message', 'Selecione pelo menos uma comissão para efetuar o pagamento.'
    );
  END IF;

  -- 3. Autorização estrita server-side (Proprietário, Financeiro, Admin ou Superadmin)
  v_is_authorized := (
    public.is_tenant_owner(p_tenant_id)
    OR public.is_super_admin_user()
    OR public.has_tenant_role(p_tenant_id, 'financial')
    OR public.has_tenant_role(p_tenant_id, 'finance')
    OR public.has_tenant_role(p_tenant_id, 'admin')
    OR public.has_tenant_role(p_tenant_id, 'tenant_admin')
    OR public.has_tenant_role(p_tenant_id, 'manager')
  );

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Usuário não possui autorização financeira para liquidar comissões neste estabelecimento.'
    USING ERRCODE = '42501';
  END IF;

  -- 4. Verificação de Idempotência contra cliques duplicados / adulteração
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    DECLARE
      v_ext_barber_id uuid;
      v_ext_amount numeric(10,2);
    BEGIN
      SELECT id, barber_id, amount INTO v_existing_tx_id, v_ext_barber_id, v_ext_amount
      FROM public.transactions
      WHERE tenant_id = p_tenant_id
        AND payment_breakdown->>'idempotency_key' = p_idempotency_key
      LIMIT 1;

      IF v_existing_tx_id IS NOT NULL THEN
        -- Rejeitar se a chave já foi usada com barbeiro ou valor diferente
        IF v_ext_barber_id IS DISTINCT FROM p_barber_id OR (p_amount IS NOT NULL AND v_ext_amount IS DISTINCT FROM p_amount) THEN
          RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH: A chave de idempotência informada já foi processada com parâmetros distintos.'
          USING ERRCODE = '22023';
        END IF;

        RETURN jsonb_build_object(
          'success', true,
          'idempotent', true,
          'message', 'Pagamento já processado anteriormente com esta chave de idempotência.',
          'transaction_id', v_existing_tx_id
        );
      END IF;
    END;
  END IF;

  -- 5. Lock transacional pessimista (FOR UPDATE) nas comissões pendentes via CTE
  WITH locked_rows AS (
    SELECT id, commission_amount
    FROM public.barber_commissions
    WHERE tenant_id = p_tenant_id
      AND barber_id = p_barber_id
      AND id = ANY(p_commission_ids)
      AND status = 'pending'
    FOR UPDATE
  )
  SELECT 
    ARRAY_AGG(id), 
    COUNT(*), 
    COALESCE(SUM(commission_amount), 0)
  INTO 
    v_locked_ids, 
    v_count, 
    v_total_due
  FROM locked_rows;

  IF v_count = 0 OR v_locked_ids IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_pending_commissions_found',
      'message', 'Nenhuma comissão pendente encontrada para os itens selecionados.'
    );
  END IF;

  -- 6. Validação do montante calculado pelo servidor (Rejeita quitação parcial arbitrária)
  IF p_amount IS NOT NULL THEN
    IF p_amount <= 0 THEN
      RAISE EXCEPTION 'INVALID_AMOUNT: O valor do pagamento deve ser estritamente positivo.'
      USING ERRCODE = '22023';
    END IF;

    IF p_amount > v_total_due THEN
      RAISE EXCEPTION 'AMOUNT_EXCEEDED: O valor informado (R$ %) excede o total das comissões pendentes (R$ %).', p_amount, v_total_due
      USING ERRCODE = '22023';
    END IF;

    IF p_amount < v_total_due THEN
      RAISE EXCEPTION 'PARTIAL_PAYMENT_UNSUPPORTED: Pagamento parcial de lote selecionado não é suportado pelo modelo financeiro. Para quitação fracionada, selecione apenas as comissões específicas a liquidar.'
      USING ERRCODE = '22023';
    END IF;

    v_paid_total := p_amount;
  ELSE
    v_paid_total := v_total_due;
  END IF;

  -- 7. Identificação do profissional
  SELECT name INTO v_barber_name FROM public.barbers WHERE id = p_barber_id;

  -- 8. Contabilização: Registro atômico da saída em public.transactions
  INSERT INTO public.transactions (
    tenant_id,
    user_id,
    barber_id,
    type,
    category,
    amount,
    description,
    payment_method,
    pix_amount,
    cash_amount,
    date,
    time,
    payment_breakdown
  ) VALUES (
    p_tenant_id,
    auth.uid(),
    p_barber_id,
    'expense',
    'Comissão',
    v_paid_total,
    'Pagamento de comissão - ' || COALESCE(v_barber_name, 'Profissional') || ' (' || v_count || ' atendimentos)',
    COALESCE(p_payment_method, 'pix'),
    CASE WHEN COALESCE(p_payment_method, 'pix') = 'pix' THEN v_paid_total ELSE 0 END,
    CASE WHEN p_payment_method = 'cash' THEN v_paid_total ELSE 0 END,
    CURRENT_DATE,
    CURRENT_TIME,
    jsonb_build_object(
      'commission_ids', v_locked_ids,
      'payment_reference', p_payment_reference,
      'receipt_url', p_receipt_url,
      'notes', p_notes,
      'idempotency_key', p_idempotency_key,
      'paid_by', auth.uid(),
      'total_due', v_total_due
    )
  ) RETURNING id INTO v_transaction_id;

  -- 9. Quitação atômica em public.barber_commissions
  UPDATE public.barber_commissions
  SET status = 'paid',
      paid_at = now(),
      paid_by = auth.uid(),
      updated_at = now()
  WHERE id = ANY(v_locked_ids);

  -- 10. Retorno estruturado de sucesso
  RETURN jsonb_build_object(
    'success', true,
    'paid_count', v_count,
    'paid_total', v_paid_total,
    'total_due', v_total_due,
    'transaction_id', v_transaction_id,
    'payment_method', COALESCE(p_payment_method, 'pix'),
    'payment_reference', p_payment_reference,
    'paid_at', now(),
    'message', 'Pagamento de comissão liquidado com sucesso e despesa registrada.'
  );
END;
$$;

-- 11. Wrapper de Compatibilidade para chamadas legadas de pay_barber_commissions
CREATE OR REPLACE FUNCTION public.pay_barber_commissions(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_commission_ids uuid[],
  p_paid_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.pay_barber_commissions_v2(
    p_tenant_id := p_tenant_id,
    p_barber_id := p_barber_id,
    p_commission_ids := p_commission_ids,
    p_payment_method := 'pix',
    p_payment_reference := 'Legacy pay_barber_commissions wrapper',
    p_receipt_url := NULL,
    p_notes := NULL,
    p_amount := NULL,
    p_idempotency_key := NULL
  );
END;
$$;

-- 12. Permissões de Execução Seguras
REVOKE ALL ON FUNCTION public.pay_barber_commissions_v2(uuid, uuid, uuid[], text, text, text, text, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pay_barber_commissions_v2(uuid, uuid, uuid[], text, text, text, text, numeric, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pay_barber_commissions(uuid, uuid, uuid[], uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pay_barber_commissions(uuid, uuid, uuid[], uuid) TO authenticated, service_role;

-- 12.1 Desativação de endpoint legado pay_commission_entries
CREATE OR REPLACE FUNCTION public.pay_commission_entries(
  p_barber_id uuid,
  p_entry_ids uuid[],
  p_amount numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'DEPRECATED_ENDPOINT: Use public.pay_barber_commissions_v2 como canal canônico de liquidação.'
  USING ERRCODE = '0A000';
END;
$$;

REVOKE ALL ON FUNCTION public.pay_commission_entries(uuid, uuid[], numeric, text) FROM public, anon;

COMMENT ON FUNCTION public.pay_barber_commissions_v2(uuid, uuid, uuid[], text, text, text, text, numeric, text)
  IS 'Liquidação unificada de comissões com autorização de perfil financial, atomicidade de despesa e idempotência (R2E.26E.4)';

-- 13. Índice de Idempotência para Busca Otimizada
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_idempotency 
  ON public.transactions(tenant_id, (payment_breakdown->>'idempotency_key')) 
  WHERE (payment_breakdown->>'idempotency_key') IS NOT NULL;

