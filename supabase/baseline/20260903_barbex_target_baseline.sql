-- ==============================================================================
-- BARBEX ENTERPRISE CANONICAL DATABASE BASELINE
-- TARGET PROJECT: ywdwrstxvsdqiryhieiz
-- REPRODUZ O ESTADO FINAL CONSOLIDADO DO SCHEMA PÓS-PHASE 17B / 17C.2B
-- ==============================================================================

-- ==============================================================================
-- 01. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA extensions;

-- ==============================================================================
-- 02. CUSTOM ENUMS & TYPES
-- ==============================================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'admin', 
    'super_admin', 
    'tenant_admin', 
    'shop_owner', 
    'barber', 
    'professional', 
    'reception', 
    'receptionist', 
    'manager', 
    'financial', 
    'cashier', 
    'client', 
    'customer'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM (
    'pending', 
    'confirmed', 
    'in_progress', 
    'completed', 
    'cancelled', 
    'no_show'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 03. TABLES (ORDEM HIERÁRQUICA E AUTO-CONTIDA)
-- ==============================================================================

-- 1. PROFILES (Vinculado a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID,
  role public.app_role NOT NULL DEFAULT 'client'::public.app_role,
  full_name TEXT,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  business_name TEXT,
  slug TEXT UNIQUE,
  avatar_url TEXT,
  logo_url TEXT,
  bio TEXT,
  address JSONB,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. BARBERSHOPS (Estabelecimentos / Unidades)
CREATE TABLE IF NOT EXISTS public.barbershops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tenant_id UUID,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  address JSONB,
  opening_hours JSONB,
  logo_url TEXT,
  banner_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. BARBERS (Profissionais)
CREATE TABLE IF NOT EXISTS public.barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  specialties TEXT[],
  commission_rate NUMERIC(5,2) DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SERVICES (Serviços e Catálogo)
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  category TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CUSTOMERS (Clientes dos Estabelecimentos)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_canonical TEXT,
  email TEXT,
  notes TEXT,
  total_spent NUMERIC(10,2) DEFAULT 0.00,
  total_visits INTEGER DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. APPOINTMENTS (Agendamentos e Atendimentos)
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status public.appointment_status NOT NULL DEFAULT 'pending'::public.appointment_status,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PLANS (Planos SaaS)
CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  interval TEXT NOT NULL DEFAULT 'month',
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. SUBSCRIPTIONS (Assinaturas de Tenants)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  plan_id TEXT REFERENCES public.plans(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. FINANCIAL TRANSACTIONS (Financeiro e Caixa)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. PRODUCTS (Estoque e Vendas de Produtos)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  cost_price NUMERIC(10,2) DEFAULT 0.00,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER DEFAULT 5,
  barcode TEXT,
  sku TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. NOTIFICATIONS (Notificações do Sistema)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. ADMIN NOTIFICATIONS & EVENTS
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  tenant_id UUID,
  actor_id UUID,
  entity_type TEXT,
  entity_id UUID,
  destination TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. BACKGROUND JOBS (Engine Atômico Phase 17C.2B Incorporado)
CREATE TABLE IF NOT EXISTS public.background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  queue_name TEXT NOT NULL DEFAULT 'default',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. SUBPROCESSORS (LGPD)
CREATE TABLE IF NOT EXISTS public.subprocessors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  location TEXT NOT NULL,
  privacy_url TEXT NOT NULL,
  website_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. PROFESSIONAL TIME OFF (Folgas e Ausências)
CREATE TABLE IF NOT EXISTS public.professional_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  type TEXT NOT NULL DEFAULT 'day_off',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 04. INDEXES DE PERFORMANCE E CONSTRAINTS
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_barbers_tenant ON public.barbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON public.services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone_canonical);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_time ON public.appointments(tenant_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_bg_jobs_claimable ON public.background_jobs (priority DESC, next_run_at ASC, created_at ASC) WHERE status IN ('pending', 'retry');

-- ==============================================================================
-- 05. FUNCTIONS & RPCS (SECURITY DEFINER COM SEARCH_PATH STRICTO)
-- ==============================================================================

-- Verificação de Role
CREATE OR REPLACE FUNCTION public.has_role(p_user_id UUID, p_role public.app_role)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id AND role = p_role AND is_active = true
  );
END; $$;

-- Verificação de Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'::public.app_role AND is_active = true
  );
END; $$;

-- Claim Atômico de Background Jobs (Phase 17C.2B)
CREATE OR REPLACE FUNCTION public.claim_next_background_job(
  p_worker_id TEXT,
  p_queue_name TEXT DEFAULT NULL
)
RETURNS SETOF public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  SELECT id INTO v_job_id
  FROM public.background_jobs
  WHERE status IN ('pending', 'retry')
    AND next_run_at <= NOW()
    AND (p_queue_name IS NULL OR queue_name = p_queue_name)
  ORDER BY priority DESC, next_run_at ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.background_jobs
  SET 
    status = 'processing',
    locked_at = NOW(),
    locked_by = p_worker_id,
    attempts = attempts + 1,
    updated_at = NOW()
  WHERE id = v_job_id
  RETURNING *;
END;
$$;

-- Reconciliação de Jobs Travados (Phase 17C.2B)
CREATE OR REPLACE FUNCTION public.reconcile_stuck_background_jobs(
  p_timeout_minutes INTEGER DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retried_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_timeout_threshold TIMESTAMPTZ;
BEGIN
  v_timeout_threshold := NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;

  WITH retried AS (
    UPDATE public.background_jobs
    SET 
      status = 'retry',
      locked_at = NULL,
      locked_by = NULL,
      next_run_at = NOW() + INTERVAL '2 minutes',
      last_error = COALESCE(last_error, '') || ' [Auto-recovered: stuck in processing for > ' || p_timeout_minutes || 'm]',
      updated_at = NOW()
    WHERE status = 'processing'
      AND locked_at < v_timeout_threshold
      AND attempts < max_attempts
    RETURNING id
  )
  SELECT COUNT(*) INTO v_retried_count FROM retried;

  WITH failed_permanent AS (
    UPDATE public.background_jobs
    SET 
      status = 'failed',
      locked_at = NULL,
      locked_by = NULL,
      last_error = COALESCE(last_error, '') || ' [Permanent failure: stuck in processing and exceeded max_attempts (' || attempts || '/' || max_attempts || ')]',
      updated_at = NOW()
    WHERE status = 'processing'
      AND locked_at < v_timeout_threshold
      AND attempts >= max_attempts
    RETURNING id
  )
  SELECT COUNT(*) INTO v_failed_count FROM failed_permanent;

  RETURN jsonb_build_object(
    'reconciled_at', NOW(),
    'timeout_minutes', p_timeout_minutes,
    'retried_jobs', v_retried_count,
    'permanently_failed_jobs', v_failed_count
  );
END;
$$;

-- Agregados de Escalabilidade e Observabilidade (Phase 17C.2B)
CREATE OR REPLACE FUNCTION public.get_scalability_aggregates()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_active_tenants INTEGER := 0;
  v_total_appointments INTEGER := 0;
  v_pending_count INTEGER := 0;
  v_processing_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_retry_count INTEGER := 0;
  v_completed_count INTEGER := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Requer privilégios de super_admin'
      USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(DISTINCT id) INTO v_active_tenants
  FROM public.profiles
  WHERE role = 'tenant_admin' AND is_active = true;

  SELECT COUNT(*) INTO v_total_appointments
  FROM public.appointments;

  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'processing'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'retry'),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO 
    v_pending_count, 
    v_processing_count, 
    v_failed_count, 
    v_retry_count, 
    v_completed_count
  FROM public.background_jobs;

  RETURN jsonb_build_object(
    'active_tenants', v_active_tenants,
    'total_appointments', v_total_appointments,
    'avg_request_duration', NULL,
    'error_rate', NULL,
    'queue_status', jsonb_build_object(
      'pending', v_pending_count + v_retry_count,
      'processing', v_processing_count,
      'failed', v_failed_count,
      'dead_letter', v_failed_count,
      'completed', v_completed_count
    )
  );
END;
$$;

-- Notificação de Novo Tenant (Semântica do Hotfix 15M Preservada)
CREATE OR REPLACE FUNCTION public.tg_admin_notify_new_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.role IN ('admin', 'tenant_admin', 'shop_owner') AND NEW.tenant_id IS NOT NULL THEN
    v_name := COALESCE(
      NULLIF(NEW.business_name, ''),
      NULLIF(NEW.display_name, ''),
      NULLIF(NEW.email, ''),
      'Nova barbearia'
    );
    INSERT INTO public.admin_notifications (
      type, title, message, tenant_id, actor_id, entity_type, entity_id, destination, priority, created_at
    ) VALUES (
      'new_tenant', 'Nova barbearia cadastrada',
      v_name || ' iniciou teste grátis no Barbex.',
      NEW.tenant_id, NEW.id, 'profile', NEW.id, '/admin/tenants', 'normal', NOW()
    );
  END IF;
  RETURN NEW;
END; $$;

-- ==============================================================================
-- 06. RLS ENABLEMENT
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subprocessors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_time_off ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 07. RLS POLICIES CANÔNICAS
-- ==============================================================================

-- Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Subprocessors & Plans
CREATE POLICY "Subprocessors viewable by everyone" ON public.subprocessors FOR SELECT USING (true);
CREATE POLICY "Plans viewable by everyone" ON public.plans FOR SELECT USING (true);

-- Professional Time Off
CREATE POLICY "Time off viewable by tenant members" ON public.professional_time_off FOR SELECT USING (true);
CREATE POLICY "Time off insertable by authenticated users" ON public.professional_time_off FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Time off deletable by authenticated users" ON public.professional_time_off FOR DELETE USING (auth.uid() IS NOT NULL);

-- Appointments
CREATE POLICY "Appointments viewable by tenant or creator" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "Appointments insertable by anyone" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Appointments updatable by authenticated users" ON public.appointments FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ==============================================================================
-- 08. TRIGGERS
-- ==============================================================================
DROP TRIGGER IF EXISTS trg_admin_notify_new_tenant ON public.profiles;
CREATE TRIGGER trg_admin_notify_new_tenant
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_admin_notify_new_tenant();

-- ==============================================================================
-- 09. REALTIME PUBLICATION PREPARATION
-- ==============================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;

-- ==============================================================================
-- 10. GRANTS & PRIVILEGES DE SEGURANÇA
-- ==============================================================================
REVOKE EXECUTE ON FUNCTION public.claim_next_background_job(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_next_background_job(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_next_background_job(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_background_job(TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_background_jobs(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_background_jobs(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_background_jobs(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stuck_background_jobs(INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_scalability_aggregates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scalability_aggregates() TO service_role;

-- ==============================================================================
-- 11. ATOMIC BACKGROUND JOB ENGINE & QUEUE ALLOWLIST (PHASE 17C.M6G)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.complete_background_job(
  p_job_id UUID,
  p_worker_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  IF p_job_id IS NULL OR p_worker_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.background_jobs
  SET
    status = 'completed',
    completed_at = NOW(),
    locked_at = NULL,
    locked_by = NULL,
    last_error = NULL,
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_by = p_worker_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_background_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_error TEXT,
  p_retry_delay_seconds INTEGER DEFAULT 120
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_new_status TEXT;
  v_next_run TIMESTAMPTZ;
  v_updated_count INTEGER := 0;
  v_delay_sec INTEGER;
BEGIN
  IF p_job_id IS NULL OR p_worker_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT id, attempts, max_attempts INTO v_job
  FROM public.background_jobs
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_by = p_worker_id;

  IF v_job.id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_delay_sec := GREATEST(COALESCE(p_retry_delay_seconds, 120), 10);

  IF v_job.attempts >= COALESCE(v_job.max_attempts, 3) THEN
    v_new_status := 'failed';
    v_next_run := NULL;
  ELSE
    v_new_status := 'retry';
    v_next_run := NOW() + (v_delay_sec || ' seconds')::INTERVAL;
  END IF;

  UPDATE public.background_jobs
  SET
    status = v_new_status,
    next_run_at = COALESCE(v_next_run, next_run_at),
    last_error = p_error,
    locked_at = NULL,
    locked_by = NULL,
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_by = p_worker_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_background_job_safe(
  p_tenant_id UUID,
  p_queue_name TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_priority INTEGER DEFAULT 0,
  p_next_run_at TIMESTAMPTZ DEFAULT NOW(),
  p_max_attempts INTEGER DEFAULT 3
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
  v_allowed_queues TEXT[] := ARRAY[
    'email_notification',
    'push_notification',
    'whatsapp_notification',
    'review_request',
    'review_reminder',
    'subscription_reminder',
    'addons_cleanup',
    'admin_digest',
    'reconcile_stuck_jobs',
    'default'
  ];
BEGIN
  IF p_queue_name IS NULL OR NOT (p_queue_name = ANY(v_allowed_queues)) THEN
    RAISE EXCEPTION 'Fila de background job não permitida: %', p_queue_name;
  END IF;

  INSERT INTO public.background_jobs (
    tenant_id,
    queue_name,
    payload,
    priority,
    status,
    attempts,
    max_attempts,
    next_run_at,
    created_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    p_queue_name,
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_priority, 0),
    'pending',
    0,
    GREATEST(COALESCE(p_max_attempts, 3), 1),
    COALESCE(p_next_run_at, NOW()),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_background_job(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_background_job(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.fail_background_job(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_background_job(UUID, TEXT, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_background_job_safe(UUID, TEXT, JSONB, INTEGER, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_background_job_safe(UUID, TEXT, JSONB, INTEGER, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_background_job_safe(UUID, TEXT, JSONB, INTEGER, TIMESTAMPTZ, INTEGER) TO authenticated;

