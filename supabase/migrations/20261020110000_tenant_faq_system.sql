-- BARBEX — R2E.22D
-- MIGRATION: TENANT FAQ SYSTEM & MULTI-TENANCY ISOLATION
-- Version: 20261020110000

BEGIN;

-- 1. Coluna de ativação da seção de FAQ no perfil da barbearia
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS faq_enabled boolean DEFAULT true;

-- 2. Tabela de Perguntas Frequentes por Barbearia (Multi-tenant)
CREATE TABLE IF NOT EXISTS public.barbershop_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_barbershop_faqs_tenant_order 
ON public.barbershop_faqs (tenant_id, display_order ASC);

CREATE INDEX IF NOT EXISTS idx_barbershop_faqs_public_read 
ON public.barbershop_faqs (tenant_id, is_published, is_approved);

-- 4. Habilitar RLS
ALTER TABLE public.barbershop_faqs ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS:
-- 5.1 Leitura pública: somente perguntas aprovadas e publicadas
DROP POLICY IF EXISTS "Public can view published tenant faqs" ON public.barbershop_faqs;
CREATE POLICY "Public can view published tenant faqs"
ON public.barbershop_faqs
FOR SELECT
USING (is_approved = true AND is_published = true);

-- 5.2 Leitura administrativa: membros da equipe com privilégios adequados ou owner
DROP POLICY IF EXISTS "Staff can view all faqs of own tenant" ON public.barbershop_faqs;
CREATE POLICY "Staff can view all faqs of own tenant"
ON public.barbershop_faqs
FOR SELECT
TO authenticated
USING (
  tenant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = barbershop_faqs.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role = ANY (ARRAY['admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role])
  ) OR
  is_super_admin_user()
);

-- 5.3 Escrita administrativa (INSERT / UPDATE / DELETE)
DROP POLICY IF EXISTS "Staff can insert faqs for own tenant" ON public.barbershop_faqs;
CREATE POLICY "Staff can insert faqs for own tenant"
ON public.barbershop_faqs
FOR INSERT
TO authenticated
WITH CHECK (
  (
    tenant_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = barbershop_faqs.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role = ANY (ARRAY['admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role])
    ) OR
    is_super_admin_user()
  )
  AND public.is_tenant_operational(tenant_id)
);

DROP POLICY IF EXISTS "Staff can update faqs for own tenant" ON public.barbershop_faqs;
CREATE POLICY "Staff can update faqs for own tenant"
ON public.barbershop_faqs
FOR UPDATE
TO authenticated
USING (
  (
    tenant_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = barbershop_faqs.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role = ANY (ARRAY['admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role])
    ) OR
    is_super_admin_user()
  )
  AND public.is_tenant_operational(tenant_id)
)
WITH CHECK (
  (
    tenant_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = barbershop_faqs.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role = ANY (ARRAY['admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role])
    ) OR
    is_super_admin_user()
  )
  AND public.is_tenant_operational(tenant_id)
);

DROP POLICY IF EXISTS "Staff can delete faqs for own tenant" ON public.barbershop_faqs;
CREATE POLICY "Staff can delete faqs for own tenant"
ON public.barbershop_faqs
FOR DELETE
TO authenticated
USING (
  (
    tenant_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = barbershop_faqs.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role = ANY (ARRAY['admin'::app_role, 'tenant_admin'::app_role, 'manager'::app_role])
    ) OR
    is_super_admin_user()
  )
  AND public.is_tenant_operational(tenant_id)
);

-- 6. Trigger de integridade operacional
DROP TRIGGER IF EXISTS trg_enforce_tenant_faqs ON public.barbershop_faqs;
CREATE TRIGGER trg_enforce_tenant_faqs
BEFORE INSERT OR UPDATE OR DELETE ON public.barbershop_faqs
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_tenant_operational();

-- 7. Trigger de atualização do timestamp
DROP TRIGGER IF EXISTS update_barbershop_faqs_updated_at ON public.barbershop_faqs;
CREATE TRIGGER update_barbershop_faqs_updated_at
BEFORE UPDATE ON public.barbershop_faqs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
