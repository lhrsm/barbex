-- ==============================================================================
-- BARBEX ENTERPRISE CANONICAL MIGRATION: R2E.13G.2 / R2E.13G.2A
-- TENANT LIFECYCLE: SUSPEND & REACTIVATE AUTHORITATIVE RPCS + COMPREHENSIVE
-- FAIL-CLOSED OPERATIONAL WRITE DENIAL & AUDIT INTEGRITY
-- TARGET SCHEMA: public
-- SECURITY: SECURITY DEFINER, SET search_path = public, pg_temp
-- AUTHORIZATION: has_role(auth.uid(), 'super_admin'::public.app_role)
-- CONCURRENCY: SELECT ... FOR UPDATE
-- AUDIT: ATOMIC INSERT INTO public.audit_logs
-- NO STRIPE MUTATION / NO DATA DELETION / HISTORICAL READS PRESERVED
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. SCHEMA ALIGNMENT: SYNCHRONIZED ESTABLISHMENT MIRROR COLUMN
-- ------------------------------------------------------------------------------

ALTER TABLE public.barbershops
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ------------------------------------------------------------------------------
-- 1. CANONICAL REUSABLE TENANT IDENTITY & OPERATIONAL STATE HELPERS
-- ------------------------------------------------------------------------------

-- Resolves the canonical tenant profile ID from tenant_id or user_id candidates
CREATE OR REPLACE FUNCTION public.resolve_canonical_tenant_id(
  p_tenant_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidate uuid;
  v_resolved_profile_id uuid;
BEGIN
  -- 1. Prioritize p_tenant_id, fallback to p_user_id
  v_candidate := COALESCE(p_tenant_id, p_user_id);
  IF v_candidate IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Direct match in public.profiles (owner user account)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_candidate) THEN
    RETURN v_candidate;
  END IF;

  -- 3. Match in public.barbershops (establishment entity -> owner profile)
  SELECT owner_id INTO v_resolved_profile_id
  FROM public.barbershops
  WHERE id = v_candidate;

  IF v_resolved_profile_id IS NOT NULL THEN
    RETURN v_resolved_profile_id;
  END IF;

  -- 4. Check secondary candidate (p_user_id) if distinct
  IF p_user_id IS NOT NULL AND p_user_id <> v_candidate THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
      RETURN p_user_id;
    END IF;
  END IF;

  RETURN v_candidate;
END;
$$;

-- Determines whether a tenant is in an operational (non-suspended) state
CREATE OR REPLACE FUNCTION public.is_tenant_operational(
  p_tenant_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_status text;
BEGIN
  v_profile_id := public.resolve_canonical_tenant_id(p_tenant_id, p_user_id);
  IF v_profile_id IS NULL THEN
    -- Unassociated or non-tenant operational records are not blocked by tenant suspension
    RETURN true;
  END IF;

  SELECT status INTO v_status
  FROM public.profiles
  WHERE id = v_profile_id;

  -- Blocked, suspended or inactive tenants are non-operational
  IF v_status IS NOT NULL AND v_status IN ('blocked', 'suspended', 'inactive') THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Enforces operational state; raises P0001 if tenant is suspended
CREATE OR REPLACE FUNCTION public.assert_tenant_operational(
  p_tenant_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_tenant_operational(p_tenant_id, p_user_id) THEN
    RAISE EXCEPTION 'TENANT_SUSPENDED: Operacao negada para estabelecimento bloqueado.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. CENTRAL TRIGGER FUNCTION FOR FAIL-CLOSED OPERATIONAL WRITE DENIAL
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_enforce_tenant_operational()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_actor_id uuid := auth.uid();
BEGIN
  -- PLATFORM EXCEPTION: Super Admin actions and database administrators are never blocked by tenant suspension
  -- (allows Super Admin and DBA to audit, support, investigate, maintain, and reactivate)
  IF (v_actor_id IS NOT NULL AND public.has_role(v_actor_id, 'super_admin'::public.app_role))
     OR current_user IN ('postgres', 'supabase_admin') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- PLATFORM EXCEPTION: System processes with no user context (service_role / cron)
  -- are permitted for system logging / reconciliation unless mutating tenant business data
  IF v_actor_id IS NULL AND TG_TABLE_NAME IN ('audit_logs', 'system_logs', 'subscriptions', 'stripe_processed_events') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Extract tenant_id and user_id identifiers from the record
  IF TG_OP = 'DELETE' THEN
    BEGIN
      v_tenant_id := OLD.tenant_id;
    EXCEPTION WHEN undefined_column THEN
      v_tenant_id := NULL;
    END;

    BEGIN
      v_user_id := OLD.user_id;
    EXCEPTION WHEN undefined_column THEN
      v_user_id := NULL;
    END;

    IF v_tenant_id IS NULL AND v_user_id IS NULL THEN
      BEGIN
        v_tenant_id := OLD.id;
      EXCEPTION WHEN undefined_column THEN
        v_tenant_id := NULL;
      END;
    END IF;
  ELSE
    BEGIN
      v_tenant_id := NEW.tenant_id;
    EXCEPTION WHEN undefined_column THEN
      v_tenant_id := NULL;
    END;

    BEGIN
      v_user_id := NEW.user_id;
    EXCEPTION WHEN undefined_column THEN
      v_user_id := NULL;
    END;

    IF v_tenant_id IS NULL AND v_user_id IS NULL THEN
      BEGIN
        v_tenant_id := NEW.id;
      EXCEPTION WHEN undefined_column THEN
        v_tenant_id := NULL;
      END;
    END IF;
  END IF;

  -- Assert operational state
  IF NOT public.is_tenant_operational(v_tenant_id, v_user_id) THEN
    RAISE EXCEPTION 'TENANT_SUSPENDED: Operacao de % negada na tabela % para estabelecimento suspenso.', TG_OP, TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. ATTACH OPERATIONAL WRITE GUARDS TO BUSINESS WRITE SURFACES
-- ------------------------------------------------------------------------------

-- A. Appointments (Covers online booking, walk-in, and staff booking, rescheduling, and cancellation)
DROP TRIGGER IF EXISTS trg_enforce_tenant_appointments ON public.appointments;
CREATE TRIGGER trg_enforce_tenant_appointments
BEFORE INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_tenant_operational();

-- B. Financial Transactions (Covers payments, income, expenses, and manual cashier adjustments)
DROP TRIGGER IF EXISTS trg_enforce_tenant_transactions ON public.transactions;
CREATE TRIGGER trg_enforce_tenant_transactions
BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_tenant_operational();

-- C. Customers (Freezes customer database modifications)
DROP TRIGGER IF EXISTS trg_enforce_tenant_customers ON public.customers;
CREATE TRIGGER trg_enforce_tenant_customers
BEFORE INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_tenant_operational();

-- D. Services Catalogue (Freezes service catalog modifications)
DROP TRIGGER IF EXISTS trg_enforce_tenant_services ON public.services;
CREATE TRIGGER trg_enforce_tenant_services
BEFORE INSERT OR UPDATE OR DELETE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_tenant_operational();

-- E. Barbers / Team (Freezes professional and staff modifications)
DROP TRIGGER IF EXISTS trg_enforce_tenant_barbers ON public.barbers;
CREATE TRIGGER trg_enforce_tenant_barbers
BEFORE INSERT OR UPDATE OR DELETE ON public.barbers
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_tenant_operational();

-- F. Products / Inventory (Freezes product and stock modifications)
DROP TRIGGER IF EXISTS trg_enforce_tenant_products ON public.products;
CREATE TRIGGER trg_enforce_tenant_products
BEFORE INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_tenant_operational();

-- G. Tenant Memberships (Freezes team role assignments)
DROP TRIGGER IF EXISTS trg_enforce_tenant_memberships ON public.tenant_memberships;
CREATE TRIGGER trg_enforce_tenant_memberships
BEFORE INSERT OR UPDATE OR DELETE ON public.tenant_memberships
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_tenant_operational();

-- H. Automation Queue (Prevents queuing new notifications for suspended tenants)
DROP TRIGGER IF EXISTS trg_enforce_tenant_automation_queue ON public.automation_queue;
CREATE TRIGGER trg_enforce_tenant_automation_queue
BEFORE INSERT ON public.automation_queue
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_tenant_operational();

-- I. Marketing Campaigns (Prevents creating or modifying campaigns)
DROP TRIGGER IF EXISTS trg_enforce_tenant_campaigns ON public.campaigns;
CREATE TRIGGER trg_enforce_tenant_campaigns
BEFORE INSERT OR UPDATE OR DELETE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_tenant_operational();

-- J. Tenant Profile Configuration Protection
-- Suspended tenants cannot alter their business settings, hours, or profiles while blocked
CREATE OR REPLACE FUNCTION public.trg_enforce_tenant_profile_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  -- Super Admin and database administrators are exempt (required for admin_reactivate_tenant and administrative repairs)
  IF (v_actor_id IS NOT NULL AND public.has_role(v_actor_id, 'super_admin'::public.app_role))
     OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- If the profile was already blocked, regular tenants/users cannot modify settings
  IF OLD.status IN ('blocked', 'suspended', 'inactive') THEN
    RAISE EXCEPTION 'TENANT_SUSPENDED: Alteracoes de configuracao bloqueadas para estabelecimento suspenso.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_tenant_profiles ON public.profiles;
CREATE TRIGGER trg_enforce_tenant_profiles
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_tenant_profile_settings();

-- ------------------------------------------------------------------------------
-- 4. AUTHORITATIVE SUSPEND RPC: admin_suspend_tenant
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_suspend_tenant(
  p_tenant_id uuid,
  p_reason text,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_target_profile_id uuid;
  v_current_status text;
  v_blocked_at timestamptz;
  v_tenant_slug text;
  v_tenant_name text;
  v_clean_reason text;
BEGIN
  -- A. AUTHORIZATION (Server-side Super Admin enforcement)
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'super_admin'::public.app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Acesso negado: Requer privilégio de Super Admin.'
    );
  END IF;

  -- B. INPUT VALIDATION
  IF p_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_TARGET',
      'message', 'Identificador do tenant é obrigatório.'
    );
  END IF;

  v_clean_reason := trim(p_reason);
  IF v_clean_reason IS NULL OR char_length(v_clean_reason) < 10 OR char_length(v_clean_reason) > 500 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_REASON',
      'message', 'Motivo da suspensão é obrigatório e deve conter entre 10 e 500 caracteres legíveis.'
    );
  END IF;

  -- C. CANONICAL TARGET RESOLUTION (profiles vs barbershops dual-resolution)
  v_target_profile_id := public.resolve_canonical_tenant_id(p_tenant_id, NULL);

  IF v_target_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Estabelecimento ou perfil proprietário não localizado.'
    );
  END IF;

  -- D. ROW LOCKING & BEFORE-STATE INSPECTION (Concurrency Protection)
  SELECT
    id,
    COALESCE(status, 'active'),
    blocked_at,
    slug,
    COALESCE(business_name, full_name, 'Estabelecimento')
  INTO
    v_target_profile_id,
    v_current_status,
    v_blocked_at,
    v_tenant_slug,
    v_tenant_name
  FROM public.profiles
  WHERE id = v_target_profile_id
  FOR UPDATE;

  -- E. STATE TRANSITION VALIDATION
  IF v_current_status = 'blocked' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONFLICT',
      'message', 'Estabelecimento já se encontra suspenso.',
      'data', jsonb_build_object(
        'current_status', v_current_status,
        'blocked_at', v_blocked_at
      )
    );
  END IF;

  -- F. AUTHORITATIVE STATE TRANSITION (Data preserved, status updated)
  UPDATE public.profiles
  SET
    status = 'blocked',
    blocked_at = now(),
    suspension_reason = v_clean_reason,
    updated_at = now()
  WHERE id = v_target_profile_id;

  -- Synchronize canonical barbershops flag
  UPDATE public.barbershops
  SET
    is_active = false,
    updated_at = now()
  WHERE owner_id = v_target_profile_id OR id = p_tenant_id;

  -- G. ATOMIC AUDIT EVIDENCE (Rolls back whole transaction if INSERT fails)
  INSERT INTO public.audit_logs (
    admin_id,
    target_id,
    action,
    details,
    ip_address
  ) VALUES (
    v_actor_id,
    v_target_profile_id,
    'tenant.suspended',
    jsonb_build_object(
      'tenant_id', v_target_profile_id,
      'tenant_slug', v_tenant_slug,
      'tenant_name', v_tenant_name,
      'reason', v_clean_reason,
      'before_status', v_current_status,
      'after_status', 'blocked',
      'idempotency_key', p_idempotency_key,
      'timestamp', now()
    ),
    NULL
  );

  -- H. STRUCTURED RESULT
  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Estabelecimento suspenso com sucesso.',
    'data', jsonb_build_object(
      'tenant_id', v_target_profile_id,
      'status', 'blocked',
      'blocked_at', now(),
      'action', 'tenant.suspended'
    )
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. AUTHORITATIVE REACTIVATE RPC: admin_reactivate_tenant
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_reactivate_tenant(
  p_tenant_id uuid,
  p_reason text,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_target_profile_id uuid;
  v_current_status text;
  v_blocked_at timestamptz;
  v_tenant_slug text;
  v_tenant_name text;
  v_clean_reason text;
BEGIN
  -- A. AUTHORIZATION (Server-side Super Admin enforcement)
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'super_admin'::public.app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Acesso negado: Requer privilégio de Super Admin.'
    );
  END IF;

  -- B. INPUT VALIDATION
  IF p_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_TARGET',
      'message', 'Identificador do tenant é obrigatório.'
    );
  END IF;

  v_clean_reason := trim(p_reason);
  IF v_clean_reason IS NULL OR char_length(v_clean_reason) < 10 OR char_length(v_clean_reason) > 500 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_REASON',
      'message', 'Motivo da reativação é obrigatório e deve conter entre 10 e 500 caracteres legíveis.'
    );
  END IF;

  -- C. CANONICAL TARGET RESOLUTION (profiles vs barbershops dual-resolution)
  v_target_profile_id := public.resolve_canonical_tenant_id(p_tenant_id, NULL);

  IF v_target_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Estabelecimento ou perfil proprietário não localizado.'
    );
  END IF;

  -- D. ROW LOCKING & BEFORE-STATE INSPECTION (Concurrency Protection)
  SELECT
    id,
    COALESCE(status, 'active'),
    blocked_at,
    slug,
    COALESCE(business_name, full_name, 'Estabelecimento')
  INTO
    v_target_profile_id,
    v_current_status,
    v_blocked_at,
    v_tenant_slug,
    v_tenant_name
  FROM public.profiles
  WHERE id = v_target_profile_id
  FOR UPDATE;

  -- E. STATE TRANSITION VALIDATION
  IF v_current_status = 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONFLICT',
      'message', 'Estabelecimento já se encontra ativo.',
      'data', jsonb_build_object(
        'current_status', v_current_status
      )
    );
  END IF;

  -- F. AUTHORITATIVE STATE TRANSITION (Restores active status)
  UPDATE public.profiles
  SET
    status = 'active',
    blocked_at = NULL,
    suspension_reason = NULL,
    updated_at = now()
  WHERE id = v_target_profile_id;

  -- Synchronize canonical barbershops flag
  UPDATE public.barbershops
  SET
    is_active = true,
    updated_at = now()
  WHERE owner_id = v_target_profile_id OR id = p_tenant_id;

  -- G. ATOMIC AUDIT EVIDENCE (Rolls back whole transaction if INSERT fails)
  INSERT INTO public.audit_logs (
    admin_id,
    target_id,
    action,
    details,
    ip_address
  ) VALUES (
    v_actor_id,
    v_target_profile_id,
    'tenant.reactivated',
    jsonb_build_object(
      'tenant_id', v_target_profile_id,
      'tenant_slug', v_tenant_slug,
      'tenant_name', v_tenant_name,
      'reason', v_clean_reason,
      'before_status', v_current_status,
      'after_status', 'active',
      'idempotency_key', p_idempotency_key,
      'timestamp', now()
    ),
    NULL
  );

  -- H. STRUCTURED RESULT
  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Estabelecimento reativado com sucesso.',
    'data', jsonb_build_object(
      'tenant_id', v_target_profile_id,
      'status', 'active',
      'reactivated_at', now(),
      'action', 'tenant.reactivated'
    )
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. PRIVILEGE ENFORCEMENT (Explicit REVOKE from PUBLIC)
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.resolve_canonical_tenant_id(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_canonical_tenant_id(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_tenant_operational(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_operational(uuid, uuid) TO authenticated, anon;

REVOKE ALL ON FUNCTION public.assert_tenant_operational(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_tenant_operational(uuid, uuid) TO authenticated, anon;

REVOKE ALL ON FUNCTION public.admin_suspend_tenant(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_tenant(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_reactivate_tenant(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_tenant(uuid, text, text) TO authenticated;
