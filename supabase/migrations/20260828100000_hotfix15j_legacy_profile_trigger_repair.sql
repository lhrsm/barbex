-- ==============================================================================
-- HOTFIX 15J: CORREÇÃO DEFINITIVA DAS TRIGGERS LEGADAS DE PROFILES
-- Corrige a referência a coluna inexistente NEW.barbershop_name para NEW.business_name
-- com fallback seguro em public.tg_admin_notify_new_tenant() e public.tg_admin_notify_plan_change()
-- ==============================================================================

-- 1. Corrige a função tg_admin_notify_new_tenant
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

-- 2. Corrige a função tg_admin_notify_plan_change
CREATE OR REPLACE FUNCTION public.tg_admin_notify_plan_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old text; v_new text; v_name text;
  v_rank jsonb := '{"starter":1,"pro":2,"elite":3}'::jsonb;
BEGIN
  v_old := COALESCE(OLD.effective_plan, OLD.plan);
  v_new := COALESCE(NEW.effective_plan, NEW.plan);
  IF v_old IS DISTINCT FROM v_new AND v_new IS NOT NULL THEN
    v_name := COALESCE(
      NULLIF(NEW.business_name, ''),
      NULLIF(NEW.display_name, ''),
      NULLIF(NEW.email, ''),
      'Barbearia'
    );
    IF (v_rank->>v_new)::int > COALESCE((v_rank->>v_old)::int, 0) THEN
      PERFORM public.create_admin_notification('plan_upgraded','Upgrade de plano',
        v_name || ' fez upgrade: ' || COALESCE(v_old,'—') || ' → ' || v_new,
        NEW.tenant_id, NEW.id, 'profile', NEW.id, '/admin/subscriptions', 'high');
    ELSE
      PERFORM public.create_admin_notification('plan_downgraded','Downgrade de plano',
        v_name || ' fez downgrade: ' || COALESCE(v_old,'—') || ' → ' || v_new,
        NEW.tenant_id, NEW.id, 'profile', NEW.id, '/admin/subscriptions', 'normal');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
