-- ==============================================================================
-- BARBEX CONSOLIDATED STORAGE POLICIES BASELINE
-- POLÍTICAS DE CONTROLE DE ACESSO (RLS) PARA STORAGE.OBJECTS
-- TARGET PROJECT: ywdwrstxvsdqiryhieiz
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BUCKET: barber-avatars (Público para leitura, restrito por UID para escrita)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public Access to Barber Avatars" ON storage.objects;
CREATE POLICY "Public Access to Barber Avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'barber-avatars');

DROP POLICY IF EXISTS "Users can upload own assets" ON storage.objects;
CREATE POLICY "Users can upload own assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '-%')
    OR
    (storage.foldername(name))[1] = 'customer-avatars'
  )
);

DROP POLICY IF EXISTS "Users can update own assets" ON storage.objects;
CREATE POLICY "Users can update own assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '-%')
  )
)
WITH CHECK (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '-%')
  )
);

DROP POLICY IF EXISTS "Users can delete own assets" ON storage.objects;
CREATE POLICY "Users can delete own assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '-%')
  )
);

-- ------------------------------------------------------------------------------
-- 2. BUCKET: payment-receipts (Privado, isolado por tenant e público para upload anon)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tenant can view own receipt files" ON storage.objects;
CREATE POLICY "Tenant can view own receipt files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts' 
  AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
);

DROP POLICY IF EXISTS "Tenant can upload own receipt files" ON storage.objects;
CREATE POLICY "Tenant can upload own receipt files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts' 
  AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
);

DROP POLICY IF EXISTS "Public customers can upload receipt files" ON storage.objects;
CREATE POLICY "Public customers can upload receipt files"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Tenant can update own receipt files" ON storage.objects;
CREATE POLICY "Tenant can update own receipt files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-receipts' 
  AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
)
WITH CHECK (
  bucket_id = 'payment-receipts' 
  AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
);

DROP POLICY IF EXISTS "Tenant can delete own receipt files" ON storage.objects;
CREATE POLICY "Tenant can delete own receipt files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-receipts' 
  AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
);

-- ------------------------------------------------------------------------------
-- 3. BUCKET: support-attachments (Privado, isolado por tenant e autenticação)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated can read support attachments" ON storage.objects;
CREATE POLICY "Authenticated can read support attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND (
    (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    OR
    public.has_role(auth.uid(), 'super_admin')
  )
);

DROP POLICY IF EXISTS "Authenticated can upload support attachments" ON storage.objects;
CREATE POLICY "Authenticated can upload support attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND (
    (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    OR
    public.has_role(auth.uid(), 'super_admin')
  )
);

-- ------------------------------------------------------------------------------
-- 4. BUCKET: system-assets (Público para leitura, Super Admin para escrita)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public Access to System Assets" ON storage.objects;
CREATE POLICY "Public Access to System Assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'system-assets');

DROP POLICY IF EXISTS "Super Admins can manage system assets" ON storage.objects;
CREATE POLICY "Super Admins can manage system assets"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'system-assets'
  AND public.has_role(auth.uid(), 'super_admin')
);

-- ------------------------------------------------------------------------------
-- 5. BUCKET: tutorial-assets (Público para leitura, Super Admin para escrita)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public Access to Tutorial Assets" ON storage.objects;
CREATE POLICY "Public Access to Tutorial Assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'tutorial-assets');

DROP POLICY IF EXISTS "Super Admins can manage tutorial assets" ON storage.objects;
CREATE POLICY "Super Admins can manage tutorial assets"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'tutorial-assets'
  AND public.has_role(auth.uid(), 'super_admin')
);
