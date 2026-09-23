-- ==============================================================================
-- BARBEX — MIGRATION: 20260923110000_r2f3_reconcile_executive_kpis.sql
-- ==============================================================================
-- Reconciliação das RPCs executivas do Super Admin com a entidade canônica public.barbershops
-- Preserva estritamente contratos de retorno, segurança e permissões de super_admin.
-- ==============================================================================

-- 1. admin_executive_kpis
CREATE OR REPLACE FUNCTION public.admin_executive_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_mrr numeric := 0;
  v_paying int := 0;
  v_total_tenants int := 0;
  v_new_7 int := 0;
  v_new_30 int := 0;
  v_active_30 int := 0;
  v_dormant_30 int := 0;
  v_churn_signal int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 1. Total de estabelecimentos cadastrados na entidade canônica
  SELECT COUNT(*) INTO v_total_tenants
  FROM public.barbershops b;

  -- 2. Novos cadastros nos últimos 7 e 30 dias
  SELECT COUNT(*) INTO v_new_7
  FROM public.barbershops b
  WHERE b.created_at >= now() - interval '7 days';

  SELECT COUNT(*) INTO v_new_30
  FROM public.barbershops b
  WHERE b.created_at >= now() - interval '30 days';

  -- 3. Assinaturas Stripe efetivas e pagantes (0 em pré-lançamento comercial)
  SELECT COALESCE(SUM(pl.price_monthly), 0), COUNT(s.id)
    INTO v_mrr, v_paying
  FROM public.subscriptions s
  LEFT JOIN public.plans pl ON (pl.stripe_price_id_live = s.price_id OR pl.stripe_price_id_test = s.price_id OR pl.id::text = s.price_id)
  WHERE s.status = 'active'
    AND COALESCE(s.is_internal_test_tenant, false) = false;

  -- 4. Estabelecimentos com agendamentos recentes (30 dias)
  SELECT COUNT(DISTINCT a.tenant_id) INTO v_active_30
  FROM public.appointments a
  WHERE a.created_at >= now() - interval '30 days'
    AND a.tenant_id IS NOT NULL;

  v_dormant_30 := GREATEST(v_total_tenants - v_active_30, 0);

  -- 5. Churn signal: estabelecimentos com atividade anterior mas sem atividade recente
  SELECT COUNT(*) INTO v_churn_signal
  FROM (
    SELECT tenant_id
    FROM public.appointments
    WHERE created_at >= now() - interval '60 days'
      AND created_at <  now() - interval '30 days'
      AND tenant_id IS NOT NULL
    GROUP BY tenant_id
  ) prev
  WHERE prev.tenant_id NOT IN (
    SELECT tenant_id FROM public.appointments
    WHERE created_at >= now() - interval '30 days'
      AND tenant_id IS NOT NULL
  );

  v_result := jsonb_build_object(
    'mrr', v_mrr,
    'arr', v_mrr * 12,
    'arpu', CASE WHEN v_paying > 0 THEN round(v_mrr / v_paying, 2) ELSE 0 END,
    'ltv_estimate', CASE WHEN v_paying > 0 THEN round((v_mrr / v_paying) * 24, 2) ELSE 0 END,
    'paying_tenants', v_paying,
    'total_tenants', v_total_tenants,
    'new_signups_7d', v_new_7,
    'new_signups_30d', v_new_30,
    'active_tenants_30d', v_active_30,
    'dormant_tenants', v_dormant_30,
    'churn_signal_30d', v_churn_signal,
    'churn_rate_30d', CASE WHEN v_total_tenants > 0 THEN round((v_churn_signal::numeric / v_total_tenants) * 100, 2) ELSE 0 END
  );

  RETURN v_result;
END;
$$;

-- 2. admin_tenant_health
CREATE OR REPLACE FUNCTION public.admin_tenant_health(p_limit int DEFAULT 20)
RETURNS TABLE (
  tenant_id uuid,
  business_name text,
  plan text,
  created_at timestamptz,
  appointments_30d bigint,
  last_appointment_at timestamptz,
  days_since_activity int,
  whatsapp_connected boolean,
  open_tickets bigint,
  health_score int,
  risk_level text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH tenants AS (
    SELECT 
      b.id,
      b.name AS business_name,
      COALESCE(pl.name, p.plan) AS plan,
      b.created_at,
      b.owner_id
    FROM public.barbershops b
    LEFT JOIN public.profiles p ON p.id = b.owner_id
    LEFT JOIN public.plans pl ON pl.id = b.plan_id
  ),
  appts AS (
    SELECT 
      a.tenant_id,
      COUNT(*) FILTER (WHERE a.created_at >= now() - interval '30 days') AS a_30,
      MAX(a.created_at) AS last_at
    FROM public.appointments a
    WHERE a.tenant_id IS NOT NULL
    GROUP BY a.tenant_id
  ),
  wa AS (
    SELECT 
      w.tenant_id,
      bool_or(coalesce(w.connected, false) OR w.status = 'connected') AS is_connected
    FROM public.whatsapp_instances w
    WHERE w.tenant_id IS NOT NULL
    GROUP BY w.tenant_id
  ),
  tickets AS (
    SELECT 
      st.barbershop_id AS tenant_id, 
      COUNT(*) AS n
    FROM public.support_tickets st
    WHERE st.status IN ('open','pending','in_progress')
      AND st.barbershop_id IS NOT NULL
    GROUP BY st.barbershop_id
  )
  SELECT
    t.id AS tenant_id,
    t.business_name,
    t.plan,
    t.created_at,
    COALESCE(ap.a_30, 0) AS appointments_30d,
    ap.last_at AS last_appointment_at,
    CASE WHEN ap.last_at IS NULL THEN NULL
         ELSE EXTRACT(day FROM now() - ap.last_at)::int
    END AS days_since_activity,
    COALESCE(wa.is_connected, false) AS whatsapp_connected,
    COALESCE(tk.n, 0) AS open_tickets,
    LEAST(100, GREATEST(0,
      LEAST(40, COALESCE(ap.a_30, 0) * 2)::int
      + CASE WHEN COALESCE(wa.is_connected, false) THEN 20 ELSE 0 END
      + CASE WHEN t.plan IS NOT NULL AND lower(t.plan) NOT IN ('free','starter') THEN 20 ELSE 5 END
      + CASE WHEN COALESCE(tk.n, 0) = 0 THEN 10 ELSE 0 END
      + CASE WHEN ap.last_at >= now() - interval '7 days' THEN 10
             WHEN ap.last_at >= now() - interval '30 days' THEN 5
             ELSE 0 END
    ))::int AS health_score,
    CASE
      WHEN COALESCE(ap.a_30, 0) = 0 THEN 'critical'
      WHEN ap.last_at < now() - interval '14 days' THEN 'at_risk'
      WHEN NOT COALESCE(wa.is_connected, false) THEN 'watch'
      ELSE 'healthy'
    END AS risk_level
  FROM tenants t
  LEFT JOIN appts ap ON ap.tenant_id = t.id OR ap.tenant_id = t.owner_id
  LEFT JOIN wa   ON wa.tenant_id = t.id OR wa.tenant_id = t.owner_id
  LEFT JOIN tickets tk ON tk.tenant_id = t.id
  ORDER BY health_score ASC, appointments_30d ASC
  LIMIT p_limit;
END;
$$;
