-- BARBEX — R2E.4E: Platform Contact Messages In-Panel Direct Reply & Audit Trail
-- Dedicated table for tracking replies sent to institutional contact inquiries

CREATE TABLE IF NOT EXISTS public.platform_contact_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.platform_contact_messages(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email text,
  subject text NOT NULL,
  content text NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted_by_provider' | 'failed'
  provider_message_id text,
  provider_error_code text,
  attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by message_id
CREATE INDEX IF NOT EXISTS idx_platform_contact_replies_message_id 
ON public.platform_contact_replies(message_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.platform_contact_replies ENABLE ROW LEVEL SECURITY;

-- Superadmin-only policies
DROP POLICY IF EXISTS "Super admins can view platform contact replies" ON public.platform_contact_replies;
CREATE POLICY "Super admins can view platform contact replies"
ON public.platform_contact_replies
FOR SELECT
TO authenticated
USING (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can insert platform contact replies" ON public.platform_contact_replies;
CREATE POLICY "Super admins can insert platform contact replies"
ON public.platform_contact_replies
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can update platform contact replies" ON public.platform_contact_replies;
CREATE POLICY "Super admins can update platform contact replies"
ON public.platform_contact_replies
FOR UPDATE
TO authenticated
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

-- Permissions
REVOKE ALL ON TABLE public.platform_contact_replies FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_contact_replies TO authenticated, service_role;
