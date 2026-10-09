-- ==============================================================================
-- BARBEX MIGRATION: 20261009130000_r2e17m2_dual_compatible_tenant_runtime.sql
-- STAGE: R2E.17M.2 — CANONICAL TENANT DUAL-COMPATIBLE RUNTIME LAYER (PHASE 2 OF 5)
-- AUTHORIZATION: EXPLICITLY AUTHORIZED BY OPERATOR (COMPATIBILITY LAYER ONLY)
-- TARGET: Supabase Production (ywdwrstxvsdqiryhieiz)
-- CONSTRAINTS:
--   - ZERO OPERATIONAL DATA REMAP
--   - ZERO LEGACY FK REMOVAL
--   - ZERO CANONICAL OPERATIONAL FK ACTIVATION
--   - ZERO RLS POLICY CUTOVER/REMOVAL
--   - ZERO PRODUCTION USER-FACING RESOLVER CUTOVER PREMATURELY
--   - ZERO STRIPE MUTATIONS
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CANONICAL TENANT -> OPERATIONAL SCOPE TRANSLATION HELPER
-- ------------------------------------------------------------------------------

-- Translates canonical business tenant (public.barbershops.id)
-- to legacy operational scope (public.barbershops.owner_id / public.profiles.id)
CREATE OR REPLACE FUNCTION public.canonical_tenant_to_operational_scope(p_canonical_tenant_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.owner_id
  FROM public.barbershops b
  WHERE b.id = p_canonical_tenant_id
    AND (
      coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      OR (auth.uid() IS NULL AND coalesce(auth.jwt() ->> 'role', '') = '')
      OR public.can_access_tenant(b.id)
    )
  LIMIT 1;
$$;

-- Alias/Synonym: canonical_tenant_to_legacy_scope
CREATE OR REPLACE FUNCTION public.canonical_tenant_to_legacy_scope(p_canonical_tenant_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.canonical_tenant_to_operational_scope(p_canonical_tenant_id);
$$;

-- ------------------------------------------------------------------------------
-- 2. OPERATIONAL SCOPE -> CANONICAL TENANT TRANSLATION HELPER
-- ------------------------------------------------------------------------------

-- Translates legacy operational scope (public.profiles.id / historical owner scope)
-- to canonical business tenant (public.barbershops.id)
CREATE OR REPLACE FUNCTION public.operational_scope_to_canonical_tenant(p_operational_scope_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.id
  FROM public.barbershops b
  WHERE (b.owner_id = p_operational_scope_id OR b.id = p_operational_scope_id)
    AND (
      coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      OR (auth.uid() IS NULL AND coalesce(auth.jwt() ->> 'role', '') = '')
      OR public.can_access_tenant(b.id)
    )
  ORDER BY (b.owner_id = p_operational_scope_id) DESC
  LIMIT 1;
$$;

-- Alias/Synonym: legacy_scope_to_canonical_tenant
CREATE OR REPLACE FUNCTION public.legacy_scope_to_canonical_tenant(p_operational_scope_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.operational_scope_to_canonical_tenant(p_operational_scope_id);
$$;

-- ------------------------------------------------------------------------------
-- 3. UNIFIED RESOLVE OPERATIONAL SCOPE HELPER
-- ------------------------------------------------------------------------------

-- Accepts either canonical barbershop ID or legacy operational scope ID
-- and resolves the current physical operational scope required for V1 queries.
CREATE OR REPLACE FUNCTION public.resolve_operational_scope(p_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.owner_id
  FROM public.barbershops b
  WHERE (b.id = p_id OR b.owner_id = p_id)
    AND (
      coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      OR (auth.uid() IS NULL AND coalesce(auth.jwt() ->> 'role', '') = '')
      OR public.can_access_tenant(b.id)
    )
  LIMIT 1;
$$;

-- ------------------------------------------------------------------------------
-- 4. PERMISSIONS & GRANTS
-- ------------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.canonical_tenant_to_operational_scope(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.canonical_tenant_to_legacy_scope(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.operational_scope_to_canonical_tenant(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.legacy_scope_to_canonical_tenant(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_operational_scope(uuid) TO authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 5. DOCUMENTATION & COMMENTS
-- ------------------------------------------------------------------------------

COMMENT ON FUNCTION public.canonical_tenant_to_operational_scope(uuid) IS 'Translates canonical barbershop ID to legacy operational scope ID (Phase 17M.2)';
COMMENT ON FUNCTION public.canonical_tenant_to_legacy_scope(uuid) IS 'Alias for canonical_tenant_to_operational_scope (Phase 17M.2)';
COMMENT ON FUNCTION public.operational_scope_to_canonical_tenant(uuid) IS 'Translates legacy operational scope ID to canonical barbershop ID (Phase 17M.2)';
COMMENT ON FUNCTION public.legacy_scope_to_canonical_tenant(uuid) IS 'Alias for operational_scope_to_canonical_tenant (Phase 17M.2)';
COMMENT ON FUNCTION public.resolve_operational_scope(uuid) IS 'Resolves active physical operational scope from either canonical or legacy ID (Phase 17M.2)';

COMMIT;
