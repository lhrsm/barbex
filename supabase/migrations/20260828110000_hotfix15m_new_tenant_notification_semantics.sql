-- ==============================================================================
-- HOTFIX 15M: CORREÇÃO SEMÂNTICA DA TRIGGER DE NOVO TENANT
-- Garante que a notificação "Nova barbearia cadastrada" seja gerada SOMENTE
-- para perfis de proprietários/administradores (admin, tenant_admin, shop_owner),
-- eliminando falsos positivos gerados pelo cadastro de colaboradores (staff).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.tg_admin_notify_new_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.role IN ('admin', 'tenant_admin', 'shop_owner') AND NEW.tenant_id IS NOT NULL THEN
    v_name := COALESCE(
      NULLIF(NEW.business_name, ''),
      NULLIF(NEW.display_name, ''),
      NULLIF(NEW.email, ''),
      'Nova barbearia'
    );
    PERFORM public.create_admin_notification(
      'new_tenant', 'Nova barbearia cadastrada',
      v_name || ' iniciou teste grátis no Barbex.',
      NEW.tenant_id, NEW.id, 'profile', NEW.id, '/admin/tenants', 'normal'
    );
  END IF;
  RETURN NEW;
END; $$;
