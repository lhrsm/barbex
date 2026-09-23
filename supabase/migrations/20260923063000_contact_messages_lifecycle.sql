-- BARBEX — R2E.4E: Contact Messages Lifecycle Management (Inbox, Archive, Trash, Restore, Delete)
-- Applies to both platform institutional messages and tenant barbershop messages

-- 1. Extend public.platform_contact_messages
ALTER TABLE public.platform_contact_messages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'archived', 'trashed')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS trashed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_platform_contact_messages_status 
  ON public.platform_contact_messages(status, created_at DESC);

-- 2. Extend public.contact_messages
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'archived', 'trashed')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS trashed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contact_messages_tenant_status 
  ON public.contact_messages(tenant_id, status, created_at DESC);

-- 3. Update DELETE policy on public.contact_messages to allow authorized tenant managers/admins
DROP POLICY IF EXISTS "Tenant owner can delete own contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Tenant admin can delete own contact messages" ON public.contact_messages;

CREATE POLICY "Tenant admin can delete own contact messages"
  ON public.contact_messages
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = tenant_id
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = contact_messages.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('admin', 'manager')
    )
    OR public.is_super_admin_user()
  );
