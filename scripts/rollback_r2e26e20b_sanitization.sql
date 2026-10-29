-- ==============================================================================
-- ROLLBACK SCRIPT SEGURO: rollback_r2e26e20b_sanitization.sql
-- FASE: R2E.26E.20B.1 — Reversão Idempotente de Segurança
-- PREVENÇÃO: Não reintroduz política permissiva irrestrita (USING true)
-- ==============================================================================

BEGIN;

-- 1. Remover a policy role-based endurecida se foi aplicada
DROP POLICY IF EXISTS "Role-based tutorial access" ON public.tutorials;

-- 2. Restaurar política de rollback segura (protege contra leitura anônima de tutoriais administrativos)
CREATE POLICY "Rollback safe tutorial access" ON public.tutorials
FOR SELECT USING (
  -- Super admins e administradores mantêm acesso irrestrito
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('super_admin', 'admin', 'tenant_admin')
  )
  OR
  -- Tutoriais de autoatendimento para clientes permanecem acessíveis ao portal público
  ('client' = ANY(profile_target) OR 'customer' = ANY(profile_target))
  OR
  -- Usuários autenticados operacionais mantêm acesso às rotinas da barbearia
  (auth.role() = 'authenticated')
);

-- 3. Resetar profile_target para null nos 58 artigos persistidos
UPDATE public.tutorials
SET profile_target = NULL, updated_at = NOW()
WHERE id IN (
  '00d14c7b-06e1-4203-94aa-8349326e9523',
  '09eba6e4-6234-4641-95ce-f3901f655109',
  '0a65cc62-5ef4-4f15-b9db-5122b8f90740',
  '1bf403d4-23ec-42db-bc16-2d0ade5372b5',
  '1ce9d357-4170-4be6-a50d-c1115faf1676',
  '226261c0-ab96-4320-801d-57a5bcf67c50',
  '24ac8596-a0b7-4bc8-8e7b-49977309331b',
  '25e450b5-ab99-45e8-bf1a-77b8ea121200',
  '2e2831f1-a060-4fe0-9eec-40a56096ae08',
  '2f8df9f3-4f4c-4d62-891f-a3e05ad2a2b5',
  '3420adbe-d44d-45b8-a92a-226c29839762',
  '3be978de-cd68-4763-8184-e7d6574811d3',
  '426fb66b-5034-4476-bcf2-11147b2b5637',
  '45e0fa0d-c0ec-4eba-9c96-1643efcdbb45',
  '4ec9d577-f0e8-4a9e-ae80-82cd5ff124b7',
  '4ee61ba1-d59e-4d67-8332-a4a74cac5062',
  '58726102-0ec1-4740-9172-87c6b083ae8e',
  '60a1afbb-4cdf-4dcb-a9a4-ea95dc134b73',
  '628290d8-6193-463c-8058-16b68f84ee13',
  '64032882-67d0-4d3a-ba4d-0ee186d8c175',
  '64f5bafc-7abb-44f1-9836-683dca7ce9d9',
  '682301b1-34a3-4c8f-b860-b4702a3c1aa6',
  '6a493a70-c0fd-4881-8e2a-66fb29f24d9b',
  '6eef64ad-7c7e-49cf-aef4-028dcb78dc68',
  '77cb39fc-8eb4-4a22-9308-a3ca18aa2395',
  '7f0f541d-c72c-4aa8-bebb-764a292917b6',
  '84dc0967-2b34-487c-b61e-c5a9819e96a2',
  '89d0363a-d477-4b84-8cba-54c8af36b6b1',
  '8d1aa3cf-1d9a-4bc6-84e8-6b5fda268db2',
  '905468c9-b4eb-4554-9493-e072cc92ec0e',
  '9ddeff2f-e151-4d75-b393-d680f4ae9d17',
  'a10df4f8-3f19-4c0e-b129-1f70608457c6',
  'a3ba57c9-60a7-4c2d-8a5a-544dde3c0451',
  'a9dfe5d0-c280-47f8-a63f-3dc82781730e',
  'b2242045-e3d5-4f89-9125-5a8cca7e4d32',
  'b3324233-56e8-49b8-a1ed-1e7acb6fc28e',
  'b99f5dcd-77f5-437b-b708-f874c25b81f2',
  'c334b3ba-0993-449a-a58e-88fb89f7f3d1',
  'c452a442-a0c5-4e8a-b963-7f948eac4f04',
  'c46d4879-e831-4f29-9dbc-c6280ff995f8',
  'c7fc4eec-b64c-404d-8acd-450ff06f01e0',
  'cf240ea1-0dec-4817-8afe-8626c4968e21',
  'cf8b2ce5-ab17-4801-a114-d6d3976fac5f',
  'd41f3d07-4b37-4b97-ba99-a2b8d3e44206',
  'd63482d7-27c9-4dbe-bc79-43dfc194acfe',
  'd8a7ab64-9080-476f-be29-18829321c61c',
  'dbad6386-64ac-4fa9-920f-d5ad1118d6ea',
  'e13485ca-a742-4ded-9d2b-f5f562e9262d',
  'e1697c6d-c015-4a9a-a183-11ad0837223f',
  'e16bb3fd-1359-4da2-91cd-cc8a03619e0d',
  'e2e293be-0df7-4d80-8cf0-b27a7268e33d',
  'e8227c4e-15da-4c36-9dee-a044c4236199',
  'e9fb6c24-7f1c-4d74-9838-0b503abcf88b',
  'f1f13775-30d4-4989-99b0-fc94dbad79ff',
  'f54cdc13-df05-42c5-894c-3c3b3993f532',
  'f8672138-3d17-432d-91d6-14bdd576c334',
  'fc102b15-773e-4c5d-a093-81e5adfbdc2f',
  'fd971753-ce48-43a5-8cfb-b4564c97f4df'
);

COMMIT;
