-- ==============================================================================
-- BARBEX — PHASE R2E.4D
-- Tenant Contact Form Toggle + Platform Institutional Contact Recovery
-- ==============================================================================

-- 1. Tenant Contact Form Configuration on public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS contact_form_enabled boolean NOT NULL DEFAULT false;

-- 2. Preserve existing Barbearia LM configuration: explicitly activate
UPDATE public.profiles
SET contact_form_enabled = true
WHERE slug = 'lm' OR id = 'c54ac1ac-49be-4505-b7a4-d257ed023f08';

-- 3. Platform Institutional Settings: add has_contact_form toggle
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS has_contact_form boolean NOT NULL DEFAULT true;

-- 4. Seed / Update canonical platform row in public.system_settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.system_settings LIMIT 1) THEN
    INSERT INTO public.system_settings (
      saas_name,
      main_url,
      contact_email,
      public_email,
      has_contact_form
    ) VALUES (
      'Barbex',
      'https://barbex.shop',
      'contato@lmstartup.com.br',
      'contato@barbex.shop',
      true
    );
  ELSE
    UPDATE public.system_settings
    SET
      contact_email = COALESCE(NULLIF(contact_email, ''), 'contato@lmstartup.com.br'),
      has_contact_form = true
    WHERE id = (SELECT id FROM public.system_settings LIMIT 1);
  END IF;
END $$;

-- 5. Safe Public RPC for Platform Public Settings
CREATE OR REPLACE FUNCTION public.get_public_platform_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings RECORD;
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
    social_links,
    COALESCE(has_contact_form, false) AS has_contact_form
  INTO v_settings
  FROM public.system_settings
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'saas_name', 'Barbex',
      'main_url', 'https://barbex.shop',
      'saas_logo', NULL,
      'public_email', NULL,
      'phone', NULL,
      'whatsapp_number', NULL,
      'address', NULL,
      'social_links', NULL,
      'has_contact_form', false
    );
  END IF;

  RETURN jsonb_build_object(
    'saas_name', COALESCE(v_settings.saas_name, 'Barbex'),
    'main_url', COALESCE(v_settings.main_url, 'https://barbex.shop'),
    'saas_logo', v_settings.saas_logo,
    'public_email', COALESCE(v_settings.public_email, v_settings.contact_email),
    'phone', v_settings.phone,
    'whatsapp_number', v_settings.whatsapp_number,
    'address', v_settings.address,
    'social_links', v_settings.social_links,
    'has_contact_form', (v_settings.has_contact_form = true AND v_settings.contact_email IS NOT NULL AND v_settings.contact_email LIKE '%@%')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_platform_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_settings() TO anon, authenticated, service_role;

-- 6. Dedicated, Isolated Table for Platform Institutional Landing Messages
CREATE TABLE IF NOT EXISTS public.platform_contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  sender_phone text,
  company text,
  subject text,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  email_status text NOT NULL DEFAULT 'pending',
  email_recipient text,
  email_provider_message_id text,
  email_attempt_at timestamptz,
  email_error_code text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_contact_messages ENABLE ROW LEVEL SECURITY;

-- Superadmin-only policies
DROP POLICY IF EXISTS "Super admins can view platform contact messages" ON public.platform_contact_messages;
CREATE POLICY "Super admins can view platform contact messages"
ON public.platform_contact_messages
FOR SELECT
TO authenticated
USING (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can update platform contact messages" ON public.platform_contact_messages;
CREATE POLICY "Super admins can update platform contact messages"
ON public.platform_contact_messages
FOR UPDATE
TO authenticated
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can delete platform contact messages" ON public.platform_contact_messages;
CREATE POLICY "Super admins can delete platform contact messages"
ON public.platform_contact_messages
FOR DELETE
TO authenticated
USING (public.is_super_admin_user());

-- 7. Privileged Tenant Contact Settings Update RPC (R2E.4D)
-- Restricts configuration updates exclusively to authorized tenant admins/managers without widening profiles general UPDATE policy
CREATE OR REPLACE FUNCTION public.update_tenant_contact_settings(
  p_tenant_id uuid,
  p_contact_form_enabled boolean,
  p_contact_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_authorized boolean := false;
  v_normalized_email text := trim(lower(COALESCE(p_contact_email, '')));
BEGIN
  -- 1. Must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  -- 2. Verify authorization: tenant owner OR active admin/manager membership OR superadmin
  IF v_user_id = p_tenant_id THEN
    v_is_authorized := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = p_tenant_id
      AND tm.user_id = v_user_id
      AND tm.status = 'active'
      AND tm.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  ) THEN
    v_is_authorized := true;
  ELSIF public.is_super_admin_user() THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Não autorizado: somente administradores ou gestores do estabelecimento podem alterar esta configuração.';
  END IF;

  -- 3. Business rule validation: activation requires valid email
  IF p_contact_form_enabled IS TRUE THEN
    IF v_normalized_email = '' OR v_normalized_email NOT LIKE '%@%' OR v_normalized_email NOT LIKE '%.%' THEN
      RAISE EXCEPTION 'Um endereço de e-mail válido é obrigatório para ativar o formulário de contato.';
    END IF;
  END IF;

  IF length(v_normalized_email) > 120 THEN
    RAISE EXCEPTION 'O endereço de e-mail excede o limite máximo de 120 caracteres.';
  END IF;

  -- 4. Update ONLY contact settings on profiles (never touch credentials, tenant_id, role)
  UPDATE public.profiles
  SET
    contact_form_enabled = p_contact_form_enabled,
    contact_email = CASE
      -- When disabled, preserve existing email if new is empty; update if new is provided
      WHEN p_contact_form_enabled IS FALSE AND v_normalized_email = '' THEN contact_email
      ELSE NULLIF(v_normalized_email, '')
    END,
    updated_at = now()
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'contact_form_enabled', p_contact_form_enabled,
    'contact_email', v_normalized_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_tenant_contact_settings(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tenant_contact_settings(uuid, boolean, text) TO authenticated, service_role;

