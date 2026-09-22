-- ==============================================================================
-- BARBEX — MIGRATION: 20260919120000_contact_messages_durable_storage.sql
-- Description: Durable persistence and tenant-isolated inbox for public contact form.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_slug TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_recipient TEXT,
  email_provider_message_id TEXT,
  email_attempt_at TIMESTAMPTZ,
  email_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant-scoped chronological queries
CREATE INDEX IF NOT EXISTS idx_contact_messages_tenant_created 
  ON public.contact_messages(tenant_id, created_at DESC);

-- Index for unread count badge
CREATE INDEX IF NOT EXISTS idx_contact_messages_unread 
  ON public.contact_messages(tenant_id, read) WHERE read = false;

-- Enable Row Level Security
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent conflicts
DROP POLICY IF EXISTS "Tenant admin can view own contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Tenant admin can update own contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Tenant owner can delete own contact messages" ON public.contact_messages;

-- RLS: Only authenticated tenant admin and managers can view their tenant's messages
CREATE POLICY "Tenant admin can view own contact messages"
  ON public.contact_messages
  FOR SELECT
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
  );

-- RLS: Tenant admin/manager can update read status
CREATE POLICY "Tenant admin can update own contact messages"
  ON public.contact_messages
  FOR UPDATE
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
  )
  WITH CHECK (
    auth.uid() = tenant_id
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = contact_messages.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('admin', 'manager')
    )
  );

-- RLS: Only tenant owner can delete messages
CREATE POLICY "Tenant owner can delete own contact messages"
  ON public.contact_messages
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = tenant_id
  );
