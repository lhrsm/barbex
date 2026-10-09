-- ==============================================================================
-- BARBEX MIGRATION: 20261009121500_r2e17m1_canonical_tenant_compatibility_foundation.sql
-- STAGE: R2E.17M.1 — CANONICAL TENANT COMPATIBILITY FOUNDATION (PHASE 1 OF 5)
-- AUTHORIZATION: EXPLICITLY AUTHORIZED BY OPERATOR (COMPATIBILITY FOUNDATION ONLY)
-- TARGET: Supabase Production (ywdwrstxvsdqiryhieiz)
-- CONSTRAINTS:
--   - ZERO DATA REMAP
--   - ZERO LEGACY FK REMOVAL
--   - ZERO RLS CUTOVER
--   - ZERO FRONTEND RESOLVER CUTOVER
--   - ZERO TRIGGER CUTOVER
--   - ZERO STRIPE MUTATIONS
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CANONICAL TENANT SECURITY DEFINER HELPERS
-- ------------------------------------------------------------------------------

-- Helper 1: Check if authenticated user is the direct owner of the barbershop
CREATE OR REPLACE FUNCTION public.is_tenant_owner(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.barbershops
    WHERE id = p_tenant_id
      AND owner_id = auth.uid()
  );
$$;

-- Helper 2: Check if authenticated user is an active member of the barbershop
CREATE OR REPLACE FUNCTION public.is_active_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- Helper 3: Check if authenticated user has a specific active role in the tenant
-- Casts role::text to support custom enum app_role comparison with input text
CREATE OR REPLACE FUNCTION public.has_tenant_role(p_tenant_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND role::text = p_role
      AND status = 'active'
  ) OR (
    p_role IN ('owner', 'admin') AND public.is_tenant_owner(p_tenant_id)
  );
$$;

-- Helper 4: Consolidated authorization helper for tenant access
CREATE OR REPLACE FUNCTION public.can_access_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    p_tenant_id IS NOT NULL AND (
      public.is_super_admin_user()
      OR public.is_tenant_owner(p_tenant_id)
      OR public.is_active_tenant_member(p_tenant_id)
    )
  );
$$;

-- Helper 5: Authoritative canonical tenant resolver for authenticated user
-- Note: Existing public.get_my_tenant_id() is intentionally preserved unchanged
-- to prevent altering V1 runtime behavior during Phase 1.
CREATE OR REPLACE FUNCTION public.get_my_canonical_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    -- 1. Explicit active membership
    (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.status = 'active' LIMIT 1),
    -- 2. Barbershop owned by this user
    (SELECT b.id FROM public.barbershops b WHERE b.owner_id = auth.uid() LIMIT 1),
    -- 3. Profile assigned tenant (must be a valid barbershop)
    (SELECT p.tenant_id FROM public.profiles p JOIN public.barbershops b ON b.id = p.tenant_id WHERE p.id = auth.uid() LIMIT 1)
  );
$$;

-- ------------------------------------------------------------------------------
-- 2. PERMISSIONS & GRANTS
-- ------------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.is_tenant_owner(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_tenant_member(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_tenant(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_canonical_tenant_id() TO authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 3. COMMENTS & DOCUMENTATION
-- ------------------------------------------------------------------------------

COMMENT ON FUNCTION public.is_tenant_owner(uuid) IS 'Checks if auth.uid() owns the specified barbershop (Phase 17M.1)';
COMMENT ON FUNCTION public.is_active_tenant_member(uuid) IS 'Checks if auth.uid() has active membership in the specified barbershop (Phase 17M.1)';
COMMENT ON FUNCTION public.has_tenant_role(uuid, text) IS 'Checks if auth.uid() has active specified role in the barbershop (Phase 17M.1)';
COMMENT ON FUNCTION public.can_access_tenant(uuid) IS 'Consolidated canonical tenant access check (Phase 17M.1)';
COMMENT ON FUNCTION public.get_my_canonical_tenant_id() IS 'Resolves canonical barbershop ID for authenticated user (Phase 17M.1)';

COMMIT;
