-- ==============================================================================
-- BARBEX — R2E.26A.3: REALTIME PUBLICATION AND CHECK-INS RLS HARDENING
-- Target project: ywdwrstxvsdqiryhieiz
-- Migration: 20261026090000_r2e26a3_realtime_publication_and_checkins_rls.sql
-- Invariants:
--   1. Strict tenant boundary via can_access_tenant and reception_permissions
--   2. Minimal tables in supabase_realtime (public.appointments and public.appointment_checkins only)
--   3. Preservation of REPLICA IDENTITY DEFAULT to avoid WAL bloating and old tuple leakage
--   4. Zero impact on financial tables, stripe, vouchers, and audit logs
-- ==============================================================================

-- 1. Ensure supabase_realtime publication exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Add public.appointments to supabase_realtime publication (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'appointments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
    END IF;
END $$;

-- 3. Add public.appointment_checkins to supabase_realtime publication (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'appointment_checkins'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_checkins;
    END IF;
END $$;

-- 4. Correct appointment_checkins RLS SELECT policy (allow staff and receptionists)
DROP POLICY IF EXISTS "tenant_read_checkins" ON public.appointment_checkins;
CREATE POLICY "tenant_read_checkins" ON public.appointment_checkins
    FOR SELECT TO authenticated
    USING (
        public.can_access_tenant(tenant_id)
        OR EXISTS (
            SELECT 1 FROM public.reception_permissions rp
            WHERE rp.tenant_id = appointment_checkins.tenant_id
              AND rp.user_id = auth.uid()
              AND rp.is_active = true
        )
        OR public.is_super_admin_user()
    );

-- 5. Correct appointment_checkins RLS INSERT policy (allow staff and receptionists)
DROP POLICY IF EXISTS "tenant_insert_checkins" ON public.appointment_checkins;
CREATE POLICY "tenant_insert_checkins" ON public.appointment_checkins
    FOR INSERT TO authenticated
    WITH CHECK (
        public.can_access_tenant(tenant_id)
        OR EXISTS (
            SELECT 1 FROM public.reception_permissions rp
            WHERE rp.tenant_id = appointment_checkins.tenant_id
              AND rp.user_id = auth.uid()
              AND rp.is_active = true
        )
        OR public.is_super_admin_user()
    );
