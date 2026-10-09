-- ==============================================================================
-- BARBEX MIGRATION: 20261009140000_r2e17m3_canonical_tenant_data_cutover.sql
-- STAGE: R2E.17M.3 — CANONICAL TENANT CONTROLLED PRODUCTION DATA CUTOVER (PHASE 3 OF 5)
-- AUTHORIZATION: EXPLICITLY AUTHORIZED BY OPERATOR UNDER WRITE FREEZE
-- TARGET: Supabase Production (ywdwrstxvsdqiryhieiz)
-- CONSTRAINTS:
--   - ZERO STRIPE MUTATIONS
--   - ZERO ORPHAN DELETIONS (292134e7... 30 rows preserved)
--   - ZERO SYNTHETIC BARBERSHOPS CREATED
--   - ZERO LEGACY FALLBACK REMOVAL (17M.5 DEFERRED)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. DROP LEGACY FOREIGN KEYS (POINTING TO PROFILES OR USERS)
-- ------------------------------------------------------------------------------

ALTER TABLE public.appointments DROP CONSTRAINT appointments_tenant_id_fkey;
ALTER TABLE public.barbers DROP CONSTRAINT barbers_tenant_id_fkey;
ALTER TABLE public.barber_services DROP CONSTRAINT barber_services_tenant_id_fkey;
ALTER TABLE public.customers DROP CONSTRAINT customers_tenant_id_fkey;
ALTER TABLE public.services DROP CONSTRAINT services_tenant_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT profiles_tenant_id_fkey;
ALTER TABLE public.tenant_memberships DROP CONSTRAINT tenant_memberships_tenant_id_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT notifications_tenant_id_fkey;

-- ------------------------------------------------------------------------------
-- 2. DETERMINISTIC OPERATIONAL DATA REMAP
-- ------------------------------------------------------------------------------

-- Carlos Hotmail operational rows (703dcd8f-0077-4a57-8728-be05f654bd5b -> 92caca5a-5174-4725-9da9-b10a9aa87104)
UPDATE public.appointments
SET tenant_id = '92caca5a-5174-4725-9da9-b10a9aa87104'
WHERE tenant_id = '703dcd8f-0077-4a57-8728-be05f654bd5b';

UPDATE public.barbers
SET tenant_id = '92caca5a-5174-4725-9da9-b10a9aa87104'
WHERE tenant_id = '703dcd8f-0077-4a57-8728-be05f654bd5b';

UPDATE public.services
SET tenant_id = '92caca5a-5174-4725-9da9-b10a9aa87104'
WHERE tenant_id = '703dcd8f-0077-4a57-8728-be05f654bd5b';

UPDATE public.barber_services
SET tenant_id = '92caca5a-5174-4725-9da9-b10a9aa87104'
WHERE tenant_id = '703dcd8f-0077-4a57-8728-be05f654bd5b';

UPDATE public.customers
SET tenant_id = '92caca5a-5174-4725-9da9-b10a9aa87104'
WHERE tenant_id = '703dcd8f-0077-4a57-8728-be05f654bd5b'
   OR (id = 'be33fa44-fead-4d75-985b-75b9aaf0b06e' AND user_id = '703dcd8f-0077-4a57-8728-be05f654bd5b');

UPDATE public.loyalty_settings
SET tenant_id = '92caca5a-5174-4725-9da9-b10a9aa87104'
WHERE tenant_id = '703dcd8f-0077-4a57-8728-be05f654bd5b';

UPDATE public.notifications
SET tenant_id = '92caca5a-5174-4725-9da9-b10a9aa87104'
WHERE tenant_id = '703dcd8f-0077-4a57-8728-be05f654bd5b';

-- Barbearia Vip operational rows (67d4e85a-3ed5-4109-9c9b-b83622331286 -> 5d57205d-3a30-4852-92ff-78e8400cb9d5)
UPDATE public.loyalty_settings
SET tenant_id = '5d57205d-3a30-4852-92ff-78e8400cb9d5'
WHERE tenant_id = '67d4e85a-3ed5-4109-9c9b-b83622331286';

-- Merge and remap barbershop_modules for Barbearia Vip
UPDATE public.barbershop_modules m_new
SET enabled = m_old.enabled,
    updated_at = now()
FROM public.barbershop_modules m_old
WHERE m_new.tenant_id = '5d57205d-3a30-4852-92ff-78e8400cb9d5'
  AND m_old.tenant_id = '67d4e85a-3ed5-4109-9c9b-b83622331286'
  AND m_new.module_key = m_old.module_key;

DELETE FROM public.barbershop_modules m_old
USING public.barbershop_modules m_new
WHERE m_old.tenant_id = '67d4e85a-3ed5-4109-9c9b-b83622331286'
  AND m_new.tenant_id = '5d57205d-3a30-4852-92ff-78e8400cb9d5'
  AND m_old.module_key = m_new.module_key;

UPDATE public.barbershop_modules
SET tenant_id = '5d57205d-3a30-4852-92ff-78e8400cb9d5'
WHERE tenant_id = '67d4e85a-3ed5-4109-9c9b-b83622331286';

-- Personal notification remediation (997746ee...)
UPDATE public.notifications
SET tenant_id = NULL
WHERE id = '4849ebd4-56b0-4930-9661-fc477c4c3779';

-- ------------------------------------------------------------------------------
-- 3. PROFILE CANONICALIZATION
-- ------------------------------------------------------------------------------

UPDATE public.profiles
SET tenant_id = '7b5c3640-2e10-4788-83a7-5e6d8e0d9978'
WHERE id = '7b5c3640-2e10-4788-83a7-5e6d8e0d9978';

UPDATE public.profiles
SET tenant_id = '92caca5a-5174-4725-9da9-b10a9aa87104'
WHERE id = '703dcd8f-0077-4a57-8728-be05f654bd5b';

UPDATE public.profiles
SET tenant_id = '5d57205d-3a30-4852-92ff-78e8400cb9d5'
WHERE id = '67d4e85a-3ed5-4109-9c9b-b83622331286';

-- ------------------------------------------------------------------------------
-- 4. CANONICAL OWNER MEMBERSHIP BACKFILL
-- ------------------------------------------------------------------------------

INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
VALUES 
  ('c54ac1ac-49be-4505-b7a4-d257ed023f08', 'c54ac1ac-49be-4505-b7a4-d257ed023f08', 'admin', 'active'),
  ('7b5c3640-2e10-4788-83a7-5e6d8e0d9978', '7b5c3640-2e10-4788-83a7-5e6d8e0d9978', 'tenant_admin', 'active'),
  ('92caca5a-5174-4725-9da9-b10a9aa87104', '703dcd8f-0077-4a57-8728-be05f654bd5b', 'tenant_admin', 'active'),
  ('5d57205d-3a30-4852-92ff-78e8400cb9d5', '67d4e85a-3ed5-4109-9c9b-b83622331286', 'tenant_admin', 'active')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. CANONICAL FOREIGN KEY ACTIVATION (TARGET: public.barbershops.id)
-- ------------------------------------------------------------------------------

ALTER TABLE public.appointments 
  ADD CONSTRAINT appointments_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);

ALTER TABLE public.barbers 
  ADD CONSTRAINT barbers_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);

ALTER TABLE public.barber_services 
  ADD CONSTRAINT barber_services_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);

ALTER TABLE public.customers 
  ADD CONSTRAINT customers_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);

ALTER TABLE public.services 
  ADD CONSTRAINT services_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);

ALTER TABLE public.tenant_memberships 
  ADD CONSTRAINT tenant_memberships_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);

ALTER TABLE public.notifications 
  ADD CONSTRAINT notifications_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id);

-- Orphan-preserving constraints (NOT VALID preserves 292134e7... 30 rows)
ALTER TABLE public.barbershop_modules 
  ADD CONSTRAINT barbershop_modules_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id) NOT VALID;

ALTER TABLE public.loyalty_settings 
  ADD CONSTRAINT loyalty_settings_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.barbershops(id) NOT VALID;

-- ------------------------------------------------------------------------------
-- 6. COORDINATED CANONICAL RLS COMPATIBILITY
-- ------------------------------------------------------------------------------

-- Allow canonical tenant access on appointments
CREATE POLICY "Canonical tenant access for appointments"
  ON public.appointments
  FOR ALL
  TO authenticated
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

-- Allow canonical tenant access on barbers
CREATE POLICY "Canonical tenant access for barbers"
  ON public.barbers
  FOR ALL
  TO authenticated
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

-- Allow canonical tenant access on services
CREATE POLICY "Canonical tenant access for services"
  ON public.services
  FOR ALL
  TO authenticated
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

-- Allow canonical tenant access on barber_services
CREATE POLICY "Canonical tenant access for barber_services"
  ON public.barber_services
  FOR ALL
  TO authenticated
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

-- Allow canonical tenant access on customers
CREATE POLICY "Canonical tenant access for customers"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

-- Allow canonical tenant access on loyalty_settings
CREATE POLICY "Canonical tenant access for loyalty_settings"
  ON public.loyalty_settings
  FOR ALL
  TO authenticated
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

-- Allow canonical tenant access on barbershop_modules
CREATE POLICY "Canonical tenant access for barbershop_modules"
  ON public.barbershop_modules
  FOR SELECT
  TO authenticated
  USING (public.can_access_tenant(tenant_id));

-- Allow canonical tenant access on notifications
CREATE POLICY "Canonical tenant access for notifications"
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

-- ------------------------------------------------------------------------------
-- 7. TRIGGER UPDATE: CANONICAL FUTURE BUSINESS REGISTRATIONS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  shop_name text;
  generated_slug text;
  user_role text;
  target_tenant_id uuid;
  v_policy_days integer;
  v_policy_plan text;
  new_shop_id uuid;
BEGIN
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant_admin');
  SELECT trial_days, trial_plan INTO v_policy_days, v_policy_plan FROM public.get_default_trial_policy();

  IF user_role IN ('tenant_admin', 'admin', 'super_admin') THEN
    shop_name := COALESCE(new.raw_user_meta_data->>'business_name', 'Minha Barbearia');
    generated_slug := generate_unique_slug(shop_name);

    -- 1. Create canonical barbershop record
    INSERT INTO public.barbershops (owner_id, name, slug)
    VALUES (new.id, shop_name, generated_slug)
    ON CONFLICT (owner_id) DO UPDATE SET
      name = EXCLUDED.name
    RETURNING id INTO new_shop_id;

    IF new_shop_id IS NULL THEN
      SELECT id INTO new_shop_id FROM public.barbershops WHERE owner_id = new.id LIMIT 1;
    END IF;

    -- 2. Create profile with canonical tenant_id = new_shop_id
    INSERT INTO public.profiles (
      id, business_name, responsible_name, email, whatsapp_number,
      barbers_range, plan, trial_end, role, status, slug, tenant_id
    )
    VALUES (
      new.id, shop_name, new.raw_user_meta_data->>'responsible_name',
      new.email, new.raw_user_meta_data->>'whatsapp_number',
      new.raw_user_meta_data->>'barbers_range',
      COALESCE(new.raw_user_meta_data->>'plan', v_policy_plan),
      CASE 
        WHEN (new.raw_user_meta_data->>'plan') = v_policy_plan OR new.raw_user_meta_data->>'plan' IS NULL 
        THEN (now() + (v_policy_days || ' days')::interval) 
        ELSE NULL 
      END,
      user_role, 'active', generated_slug, new_shop_id
    )
    ON CONFLICT (id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      responsible_name = EXCLUDED.responsible_name,
      email = EXCLUDED.email,
      slug = COALESCE(profiles.slug, EXCLUDED.slug),
      tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id);

    -- 3. Create owner membership in tenant_memberships
    BEGIN
      INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
      VALUES (new_shop_id, new.id, user_role::public.app_role, 'active')
      ON CONFLICT (tenant_id, user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Safe fallback
    END;

  ELSE
    target_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;
    
    INSERT INTO public.profiles (
      id, responsible_name, display_name, email, role, status, slug, tenant_id
    )
    VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'responsible_name'), 
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'responsible_name'),
      new.email, user_role, 'active', NULL, target_tenant_id
    )
    ON CONFLICT (id) DO UPDATE SET 
      role = EXCLUDED.role,
      tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id);
  END IF;

  -- Ensure RBAC record exists
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, user_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Safe fallback
  END;

  RETURN new;
END;
$$;

COMMIT;
