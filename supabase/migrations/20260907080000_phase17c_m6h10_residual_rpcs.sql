-- ==============================================================================
-- BARBEX — PHASE 17C.M6H.10 RESIDUAL BACKEND RPCS
-- Residual RPCs for Platform Settings, MFA Backup Codes, Super Admin & LGPD
-- ==============================================================================

-- 1. PUBLIC PLATFORM SETTINGS
CREATE OR REPLACE FUNCTION public.get_public_platform_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings RECORD;
  v_res jsonb;
BEGIN
  SELECT
    saas_name,
    main_url,
    saas_logo,
    public_email,
    contact_email,
    phone,
    whatsapp_number,
    address,
    social_links
  INTO v_settings
  FROM public.system_settings
  LIMIT 1;

  v_res := jsonb_build_object(
    'saas_name', COALESCE(v_settings.saas_name, 'Barbex'),
    'main_url', COALESCE(v_settings.main_url, 'https://barbex.shop'),
    'saas_logo', v_settings.saas_logo,
    'public_email', COALESCE(v_settings.public_email, v_settings.contact_email),
    'phone', v_settings.phone,
    'whatsapp_number', v_settings.whatsapp_number,
    'address', v_settings.address,
    'social_links', v_settings.social_links,
    'has_contact_form', true
  );

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_platform_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_settings() TO anon, authenticated, service_role;


-- 2. MFA BACKUP CODES RPCS
CREATE OR REPLACE FUNCTION public.generate_mfa_backup_codes()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_codes text[] := '{}';
  v_code text;
  v_hash text;
  i int;
  j int;
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  -- Remove unused codes for user
  DELETE FROM public.user_mfa_backup_codes
  WHERE user_id = v_user_id AND used_at IS NULL;

  FOR i IN 1..10 LOOP
    v_code := '';
    FOR j IN 1..8 LOOP
      v_code := v_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    v_codes := array_append(v_codes, v_code);
    v_hash := encode(sha256((v_code || ':' || v_user_id::text)::bytea), 'hex');

    INSERT INTO public.user_mfa_backup_codes (user_id, code_hash, created_at)
    VALUES (v_user_id, v_hash, now());
  END LOOP;

  INSERT INTO public.security_activity_logs (user_id, event_type, metadata)
  VALUES (v_user_id, 'recovery_codes_generated', jsonb_build_object('count', 10));

  RETURN v_codes;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_mfa_backup_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_mfa_backup_codes() TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.list_mfa_backup_codes()
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  used_at timestamptz,
  is_used boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.created_at,
    c.used_at,
    (c.used_at IS NOT NULL) AS is_used
  FROM public.user_mfa_backup_codes c
  WHERE c.user_id = v_user_id
  ORDER BY c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_mfa_backup_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_mfa_backup_codes() TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.verify_mfa_backup_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cleaned text;
  v_hash text;
  v_code_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  v_cleaned := upper(trim(p_code));
  v_hash := encode(sha256((v_cleaned || ':' || v_user_id::text)::bytea), 'hex');

  SELECT id INTO v_code_id
  FROM public.user_mfa_backup_codes
  WHERE user_id = v_user_id
    AND used_at IS NULL
    AND (code_hash = v_hash OR code_hash = v_cleaned)
  LIMIT 1
  FOR UPDATE;

  IF v_code_id IS NULL THEN
    INSERT INTO public.security_activity_logs (user_id, event_type, metadata)
    VALUES (v_user_id, 'mfa_challenge_failed', jsonb_build_object('method', 'backup_code'));
    RETURN false;
  END IF;

  UPDATE public.user_mfa_backup_codes
  SET used_at = now()
  WHERE id = v_code_id;

  INSERT INTO public.security_activity_logs (user_id, event_type, metadata)
  VALUES (v_user_id, 'recovery_code_used', jsonb_build_object('code_id', v_code_id));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_mfa_backup_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_mfa_backup_code(text) TO authenticated, service_role;


-- 3. SUPER ADMIN & LGPD RPCS
CREATE OR REPLACE FUNCTION public.admin_list_upgrade_recommendations(p_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_allowed boolean;
  v_since timestamptz;
  v_rows jsonb;
  v_kpis jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  v_is_allowed := public.is_super_admin() OR public.has_role(v_user_id, 'admin');
  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_since := now() - (COALESCE(p_days, 90) || ' days')::interval;

  WITH rec_data AS (
    SELECT
      r.id,
      r.tenant_id,
      p.business_name AS tenant_name,
      p.email AS tenant_email,
      cp.name AS current_plan_name,
      rp.name AS recommended_plan_name,
      r.billing_cycle::text AS billing_cycle,
      r.current_option_total::numeric AS current_option_total,
      r.upgrade_option_total::numeric AS upgrade_option_total,
      r.monthly_savings::numeric AS monthly_savings,
      r.annual_savings::numeric AS annual_savings,
      r.recommendation_reason,
      r.customer_action,
      r.shown_at,
      r.action_taken_at
    FROM public.addon_upgrade_recommendations r
    LEFT JOIN public.profiles p ON p.id = r.tenant_id
    LEFT JOIN public.plans cp ON cp.id = r.current_plan_id
    LEFT JOIN public.plans rp ON rp.id = r.recommended_plan_id
    WHERE r.shown_at >= v_since
    ORDER BY r.shown_at DESC
    LIMIT 500
  ),
  rec_agg AS (
    SELECT
      count(*)::int AS total_shown,
      count(*) FILTER (WHERE customer_action = 'upgraded' OR customer_action = 'accepted')::int AS total_accepted,
      count(*) FILTER (WHERE customer_action = 'dismissed')::int AS total_dismissed,
      COALESCE(sum(monthly_savings), 0)::numeric AS total_monthly_savings_offered,
      COALESCE(sum(monthly_savings) FILTER (WHERE customer_action = 'upgraded' OR customer_action = 'accepted'), 0)::numeric AS total_monthly_savings_accepted
    FROM rec_data
  )
  SELECT
    jsonb_build_object(
      'total_shown', ra.total_shown,
      'total_accepted', ra.total_accepted,
      'total_dismissed', ra.total_dismissed,
      'total_pending', ra.total_shown - ra.total_accepted - ra.total_dismissed,
      'conversion_rate', CASE WHEN (ra.total_accepted + ra.total_dismissed) > 0 THEN ROUND((ra.total_accepted::numeric / (ra.total_accepted + ra.total_dismissed)::numeric), 4) ELSE 0 END,
      'total_monthly_savings_offered', ra.total_monthly_savings_offered,
      'total_monthly_savings_accepted', ra.total_monthly_savings_accepted
    ),
    COALESCE(jsonb_agg(row_to_json(rd)::jsonb), '[]'::jsonb)
  INTO v_kpis, v_rows
  FROM rec_agg ra
  CROSS JOIN rec_data rd
  GROUP BY ra.total_shown, ra.total_accepted, ra.total_dismissed, ra.total_monthly_savings_offered, ra.total_monthly_savings_accepted;

  IF v_kpis IS NULL THEN
    v_kpis := jsonb_build_object(
      'total_shown', 0,
      'total_accepted', 0,
      'total_dismissed', 0,
      'total_pending', 0,
      'conversion_rate', 0,
      'total_monthly_savings_offered', 0,
      'total_monthly_savings_accepted', 0
    );
    v_rows := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('kpis', v_kpis, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_upgrade_recommendations(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_upgrade_recommendations(integer) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.admin_list_lgpd_requests(
  p_status text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF public.lgpd_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (public.is_super_admin() OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Acesso negado: super_admin obrigatório.';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.lgpd_requests
  WHERE (p_status IS NULL OR status = p_status)
    AND (p_type IS NULL OR request_type = p_type)
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  ORDER BY created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_lgpd_requests(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_lgpd_requests(text, text, uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.admin_resolve_lgpd_request(
  p_request_id uuid,
  p_status text,
  p_response text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF NOT (public.is_super_admin() OR public.has_role(v_user_id, 'super_admin')) THEN
    RAISE EXCEPTION 'Acesso negado: super_admin obrigatório.';
  END IF;

  UPDATE public.lgpd_requests
  SET
    status = p_status,
    response = CASE WHEN p_response IS NOT NULL THEN jsonb_build_object('note', p_response) ELSE response END,
    resolved_at = now(),
    resolved_by = v_user_id,
    updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.security_activity_logs (user_id, event_type, metadata)
  VALUES (
    v_user_id,
    'lgpd_request_resolved',
    jsonb_build_object('request_id', p_request_id, 'status', p_status)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_lgpd_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_lgpd_request(uuid, text, text) TO authenticated, service_role;
