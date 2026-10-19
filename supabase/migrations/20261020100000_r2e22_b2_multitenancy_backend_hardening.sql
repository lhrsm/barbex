-- ====================================================================
-- BARBEX — R2E.22B.2
-- MIGRATION: 20261020100000_r2e22_b2_multitenancy_backend_hardening.sql
-- PURPOSE:
-- 1. Hardening de RLS na tabela products para permitir operações de
--    gerentes e administradores vinculados via tenant_memberships.
-- 2. Proteção física em barber_services contra vínculos cross-tenant,
--    verificação de autorização e checagem de entitlement operacional.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. PRE-CONDITIONS & SAFETY CHECKS
-- --------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Tabela products nao encontrada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'barber_services') THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Tabela barber_services nao encontrada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_memberships') THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Tabela tenant_memberships nao encontrada.';
  END IF;
END $$;

-- --------------------------------------------------------------------
-- 2. PRODUCTS: EXPAND RLS FOR AUTHORIZED MANAGERS & ADMINS
-- --------------------------------------------------------------------

-- Drop legacy owner-only policies
DROP POLICY IF EXISTS "Users can create their own products" ON public.products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;
DROP POLICY IF EXISTS "Tenant staff can insert products" ON public.products;
DROP POLICY IF EXISTS "Tenant staff can update products" ON public.products;
DROP POLICY IF EXISTS "Tenant staff can delete products" ON public.products;

-- Recreate INSERT policy with manager/admin membership support
CREATE POLICY "Authorized staff can insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR is_super_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = products.user_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role)
    )
  );

-- Recreate UPDATE policy with manager/admin membership support
CREATE POLICY "Authorized staff can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR is_super_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = products.user_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role)
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR is_super_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = products.user_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role)
    )
  );

-- Recreate DELETE policy with manager/admin membership support
CREATE POLICY "Authorized staff can delete products" ON public.products
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR is_super_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = products.user_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role)
    )
  );

-- --------------------------------------------------------------------
-- 3. BARBER_SERVICES: TRIGGER DE BLINDAGEM CROSS-TENANT & AUTORIZAÇÃO
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_validate_barber_service_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_barber_tenant uuid;
  v_service_tenant uuid;
  v_actor_id uuid := auth.uid();
  v_is_authorized boolean := false;
BEGIN
  -- A. Obter o tenant canônico do profissional
  SELECT tenant_id INTO v_barber_tenant 
  FROM public.barbers 
  WHERE id = NEW.barber_id;

  IF v_barber_tenant IS NULL THEN
    RAISE EXCEPTION 'INTEGRITY_ERROR: Barbeiro informado (ID: %) nao possui tenant_id valido.', NEW.barber_id
      USING ERRCODE = '23503';
  END IF;

  -- B. Obter o tenant canônico do serviço
  SELECT tenant_id INTO v_service_tenant 
  FROM public.services 
  WHERE id = NEW.service_id;

  IF v_service_tenant IS NULL THEN
    RAISE EXCEPTION 'INTEGRITY_ERROR: Servico informado (ID: %) nao possui tenant_id valido.', NEW.service_id
      USING ERRCODE = '23503';
  END IF;

  -- C. Validação de isolamento Cross-Tenant
  IF v_barber_tenant IS DISTINCT FROM v_service_tenant THEN
    RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: O profissional (tenant: %) e o servico (tenant: %) pertencem a estabelecimentos diferentes.',
      v_barber_tenant, v_service_tenant
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  -- D. Coerência de tenant_id e user_id
  IF NEW.tenant_id IS NULL OR NEW.tenant_id IS DISTINCT FROM v_barber_tenant THEN
    NEW.tenant_id := v_barber_tenant;
  END IF;

  IF NEW.user_id IS NULL THEN
    NEW.user_id := COALESCE(v_actor_id, v_barber_tenant);
  END IF;

  -- E. Verificação de Autorização do Ator
  IF v_actor_id IS NOT NULL THEN
    -- 1. Super Admin
    IF is_super_admin_user() THEN
      v_is_authorized := true;
    -- 2. Dono do Tenant
    ELSIF v_actor_id = v_barber_tenant THEN
      v_is_authorized := true;
    -- 3. Membro da Equipe com Cargo de Gestão
    ELSIF EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = v_barber_tenant
        AND tm.user_id = v_actor_id
        AND tm.status = 'active'
        AND tm.role IN ('admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role)
    ) THEN
      v_is_authorized := true;
    -- 4. O próprio barbeiro vinculando serviços ao seu perfil
    ELSIF EXISTS (
      SELECT 1 FROM public.barbers b
      WHERE b.id = NEW.barber_id
        AND b.user_id = v_actor_id
    ) THEN
      v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Usuario nao possui permissao para gerenciar vinculos de servicos deste estabelecimento.'
        USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;
  END IF;

  -- F. Verificação de Entitlement Operacional (Bloqueio de RESTRICTED)
  IF NOT public.is_tenant_operational(v_barber_tenant) THEN
    RAISE EXCEPTION 'TENANT_SUSPENDED: Operacao negada para estabelecimento com assinatura ou periodo de teste expirado.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Vincular trigger na tabela barber_services
DROP TRIGGER IF EXISTS trg_check_barber_service_tenant ON public.barber_services;

CREATE TRIGGER trg_check_barber_service_tenant
  BEFORE INSERT OR UPDATE ON public.barber_services
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_barber_service_tenant_consistency();

-- Atualizar RLS de barber_services para consistência com as regras da trigger
DROP POLICY IF EXISTS "authenticated_manage_barber_services" ON public.barber_services;

CREATE POLICY "authenticated_manage_barber_services" ON public.barber_services
  FOR ALL TO authenticated
  USING (
    is_super_admin_user()
    OR auth.uid() = tenant_id
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = barber_services.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role)
    )
    OR EXISTS (
      SELECT 1 FROM public.barbers b
      WHERE b.id = barber_services.barber_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin_user()
    OR auth.uid() = tenant_id
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = barber_services.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role)
    )
    OR EXISTS (
      SELECT 1 FROM public.barbers b
      WHERE b.id = barber_services.barber_id
        AND b.user_id = auth.uid()
    )
  );

COMMIT;
