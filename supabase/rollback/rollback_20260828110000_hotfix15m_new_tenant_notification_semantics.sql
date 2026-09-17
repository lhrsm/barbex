-- ==============================================================================
-- ROLLBACK HOTFIX 15M: RESTAURA DEFINIÇÃO DO HOTFIX 15J
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.tg_admin_notify_new_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.role IS DISTINCT FROM 'super_admin' AND NEW.tenant_id IS NOT NULL THEN
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
