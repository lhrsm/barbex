-- ==============================================================================
-- BARBEX — MIGRATION: 20260920100000_storage_and_team_member_profile_repair.sql
-- Description:
-- 1. Create 'user-avatars' bucket with 5MB limit and strict image mime-types.
-- 2. Restore least-privilege RLS policies on storage.objects for user-avatars and barber-avatars.
-- 3. Create update_tenant_team_member RPC for authorized tenant admins to edit staff profiles.
-- ==============================================================================

-- 1. Create user-avatars bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Update barber-avatars bucket with file size and mime-type limits
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'barber-avatars';

-- 2. Storage RLS Policies for user-avatars
DROP POLICY IF EXISTS "Public read user-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Public read user-avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-avatars');

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'user-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Storage RLS Policies for barber-avatars
DROP POLICY IF EXISTS "Public read barber-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own barber assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own barber assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own barber assets" ON storage.objects;

CREATE POLICY "Public read barber-avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'barber-avatars');

CREATE POLICY "Users can upload own barber assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '/%')
    OR
    name LIKE (auth.uid()::text || '-%')
  )
);

CREATE POLICY "Users can update own barber assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '/%')
    OR
    name LIKE (auth.uid()::text || '-%')
  )
)
WITH CHECK (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '/%')
    OR
    name LIKE (auth.uid()::text || '-%')
  )
);

CREATE POLICY "Users can delete own barber assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '/%')
    OR
    name LIKE (auth.uid()::text || '-%')
  )
);

-- 4. Secure Team Member Profile Edit RPC
CREATE OR REPLACE FUNCTION public.update_tenant_team_member(
  p_target_user_id UUID,
  p_tenant_id UUID,
  p_display_name TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_authorized BOOLEAN := false;
  v_clean_phone TEXT;
  v_clean_name TEXT;
  v_result JSONB;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  -- 1. Check if caller is tenant owner or has admin/manager membership in p_tenant_id
  IF v_caller_id = p_tenant_id THEN
    v_is_authorized := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = p_tenant_id
        AND tm.user_id = v_caller_id
        AND tm.status = 'active'
        AND tm.role IN ('admin', 'manager', 'tenant_admin')
    ) INTO v_is_authorized;
  END IF;

  -- Also allow super_admin
  IF NOT v_is_authorized THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role = 'super_admin') THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Acesso negado: Somente administradores da barbearia podem editar membros da equipe.' USING ERRCODE = '42501';
  END IF;

  -- 2. Verify target user has an active membership in the SAME tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = p_tenant_id
      AND tm.user_id = p_target_user_id
      AND tm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Colaborador não encontrado ou não pertence a esta barbearia.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Prevent editing tenant owner or super_admin account via team edit
  IF p_target_user_id = p_tenant_id THEN
    RAISE EXCEPTION 'O perfil do proprietário deve ser editado diretamente em Meu Perfil.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Acesso negado: Não é permitido editar administradores do sistema.' USING ERRCODE = '42501';
  END IF;

  -- 4. Validate and sanitize inputs
  v_clean_name := trim(p_display_name);
  IF v_clean_name IS NULL OR length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Nome do colaborador deve ter pelo menos 2 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF length(v_clean_name) > 120 THEN
    v_clean_name := substring(v_clean_name FROM 1 FOR 120);
  END IF;

  v_clean_phone := trim(p_phone);
  IF v_clean_phone = '' THEN
    v_clean_phone := NULL;
  END IF;

  -- 5. Update only permitted operational profile fields
  -- Note: Do NOT touch email, role, tenant_id, effective_plan, etc.!
  UPDATE public.profiles
  SET 
    display_name = v_clean_name,
    responsible_name = v_clean_name,
    phone = v_clean_phone,
    updated_at = now()
  WHERE id = p_target_user_id;

  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'display_name', v_clean_name,
    'phone', v_clean_phone
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_tenant_team_member(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tenant_team_member(UUID, UUID, TEXT, TEXT) TO authenticated;
