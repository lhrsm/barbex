-- ==============================================================================
-- BARBEX — FORWARD MIGRATION: SECURE Z-API CREDENTIAL ARCHITECTURE WITH VAULT
-- Migration ID: 20260918130000_secure_zapi_credentials_vault.sql
-- Status: Unexecuted in R2D.2 (Designed for R2D2A deployment)
-- ==============================================================================

BEGIN;

-- 1. Ensure Supabase Vault extension is active
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- 2. Add Vault secret references to whatsapp_instances
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS token_secret_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_token_secret_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL;

-- 3. Safely drop raw secret columns from whatsapp_instances (0 rows in production Target)
ALTER TABLE public.whatsapp_instances
  DROP COLUMN IF EXISTS token CASCADE,
  DROP COLUMN IF EXISTS client_token CASCADE;

-- 4. Add safe boolean indicator columns for browser UI status checks
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS token_configured BOOLEAN GENERATED ALWAYS AS (token_secret_id IS NOT NULL) STORED,
  ADD COLUMN IF NOT EXISTS client_token_configured BOOLEAN GENERATED ALWAYS AS (client_token_secret_id IS NOT NULL) STORED;

-- 5. Tighten RLS on whatsapp_instances
-- Drop legacy policies that allowed barbers to view/manage provider credentials
DROP POLICY IF EXISTS "Manage own whatsapp instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "View own whatsapp instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Barbers can manage their own whatsapp connections" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Owners can manage their shop's whatsapp" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Owners can manage their shop's instance" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Users can view their own tenant data" ON public.whatsapp_instances;

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Tenant Administrator read-only policy for safe metadata
CREATE POLICY "Tenant admin view whatsapp instance metadata"
  ON public.whatsapp_instances
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = whatsapp_instances.tenant_id
        AND p.role IN ('admin', 'manager')
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Revoke direct INSERT, UPDATE, DELETE from authenticated/anon roles
-- All mutations must go through trusted Edge Functions or Vault RPCs via service_role
REVOKE INSERT, UPDATE, DELETE ON public.whatsapp_instances FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;

-- 6. Trusted Vault Secret Management Functions (SECURITY DEFINER, service_role ONLY)

-- Function: set_whatsapp_credentials
CREATE OR REPLACE FUNCTION public.set_whatsapp_credentials(
  p_tenant_id UUID,
  p_instance_id TEXT,
  p_token TEXT,
  p_client_token TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_server_url TEXT DEFAULT 'https://api.z-api.io'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_existing_inst RECORD;
  v_token_secret_id UUID;
  v_client_token_secret_id UUID;
  v_secret_name_token TEXT;
  v_secret_name_client TEXT;
BEGIN
  -- Normalize inputs
  p_instance_id := NULLIF(TRIM(p_instance_id), '');
  p_token := NULLIF(TRIM(p_token), '');
  p_client_token := NULLIF(TRIM(p_client_token), '');
  p_phone := NULLIF(TRIM(p_phone), '');
  p_server_url := COALESCE(NULLIF(TRIM(p_server_url), ''), 'https://api.z-api.io');

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  IF p_instance_id IS NULL THEN
    RAISE EXCEPTION 'Instance ID is required';
  END IF;

  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Token is required';
  END IF;

  -- Generate deterministic secret names per tenant
  v_secret_name_token := 'zapi_token_' || p_tenant_id::text;
  v_secret_name_client := 'zapi_client_token_' || p_tenant_id::text;

  -- Check existing instance
  SELECT id, token_secret_id, client_token_secret_id
  INTO v_existing_inst
  FROM public.whatsapp_instances
  WHERE tenant_id = p_tenant_id
  LIMIT 1;

  -- 1. Store/Update Token in Vault
  IF v_existing_inst.token_secret_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing_inst.token_secret_id, p_token);
    v_token_secret_id := v_existing_inst.token_secret_id;
  ELSE
    SELECT vault.create_secret(p_token, v_secret_name_token, 'Z-API Token for tenant ' || p_tenant_id::text)
    INTO v_token_secret_id;
  END IF;

  -- 2. Store/Update Client Token in Vault if provided
  IF p_client_token IS NOT NULL THEN
    IF v_existing_inst.client_token_secret_id IS NOT NULL THEN
      PERFORM vault.update_secret(v_existing_inst.client_token_secret_id, p_client_token);
      v_client_token_secret_id := v_existing_inst.client_token_secret_id;
    ELSE
      SELECT vault.create_secret(p_client_token, v_secret_name_client, 'Z-API Client Token for tenant ' || p_tenant_id::text)
      INTO v_client_token_secret_id;
    END IF;
  ELSE
    v_client_token_secret_id := v_existing_inst.client_token_secret_id;
  END IF;

  -- 3. Upsert whatsapp_instances row with secret references
  IF v_existing_inst.id IS NOT NULL THEN
    UPDATE public.whatsapp_instances
    SET
      instance_id = p_instance_id,
      server_url = p_server_url,
      phone = COALESCE(p_phone, phone),
      token_secret_id = v_token_secret_id,
      client_token_secret_id = v_client_token_secret_id,
      provider = 'z-api',
      updated_at = NOW()
    WHERE id = v_existing_inst.id;
  ELSE
    INSERT INTO public.whatsapp_instances (
      tenant_id,
      instance_id,
      server_url,
      phone,
      token_secret_id,
      client_token_secret_id,
      provider,
      status,
      connected,
      created_at,
      updated_at
    ) VALUES (
      p_tenant_id,
      p_instance_id,
      p_server_url,
      p_phone,
      v_token_secret_id,
      v_client_token_secret_id,
      'z-api',
      'disconnected',
      false,
      NOW(),
      NOW()
    );
  END IF;

  -- Return safe metadata only
  RETURN jsonb_build_object(
    'success', true,
    'configured', true,
    'connected', false,
    'phone', p_phone,
    'tokenConfigured', true,
    'clientTokenConfigured', (v_client_token_secret_id IS NOT NULL)
  );
END;
$$;

-- Function: get_whatsapp_credentials (service_role ONLY)
CREATE OR REPLACE FUNCTION public.get_whatsapp_credentials(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  instance_id TEXT,
  server_url TEXT,
  phone TEXT,
  status TEXT,
  connected BOOLEAN,
  token TEXT,
  client_token TEXT,
  webhook_received_url TEXT,
  webhook_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wi.id,
    wi.tenant_id,
    wi.instance_id,
    wi.server_url,
    wi.phone,
    wi.status,
    wi.connected,
    sec_tok.decrypted_secret AS token,
    sec_cli.decrypted_secret AS client_token,
    wi.webhook_received_url,
    wi.webhook_token
  FROM public.whatsapp_instances wi
  LEFT JOIN vault.decrypted_secrets sec_tok ON sec_tok.id = wi.token_secret_id
  LEFT JOIN vault.decrypted_secrets sec_cli ON sec_cli.id = wi.client_token_secret_id
  WHERE wi.tenant_id = p_tenant_id
  LIMIT 1;
END;
$$;

-- Function: delete_whatsapp_credentials (service_role ONLY)
CREATE OR REPLACE FUNCTION public.delete_whatsapp_credentials(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_inst RECORD;
BEGIN
  SELECT id, token_secret_id, client_token_secret_id
  INTO v_inst
  FROM public.whatsapp_instances
  WHERE tenant_id = p_tenant_id
  LIMIT 1;

  IF v_inst.id IS NULL THEN
    RETURN false;
  END IF;

  -- Delete secrets from vault if referenced
  IF v_inst.token_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_inst.token_secret_id;
  END IF;

  IF v_inst.client_token_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_inst.client_token_secret_id;
  END IF;

  -- Delete from whatsapp_instances
  DELETE FROM public.whatsapp_instances WHERE id = v_inst.id;

  RETURN true;
END;
$$;

-- Strictly restrict execution privileges to service_role
REVOKE EXECUTE ON FUNCTION public.set_whatsapp_credentials FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_whatsapp_credentials FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_whatsapp_credentials FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.set_whatsapp_credentials TO service_role;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_credentials TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_whatsapp_credentials TO service_role;

COMMIT;
