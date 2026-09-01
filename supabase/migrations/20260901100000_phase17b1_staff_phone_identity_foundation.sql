-- ==============================================================================
-- BARBEX — PHASE 17B.1: PHONE DATA FOUNDATION
-- MIGRATION: 20260901100000_phase17b1_staff_phone_identity_foundation.sql
--
-- ESCOPO:
-- 1. Normalização determinística de profiles.phone para staff/administradores
-- 2. Backfill seguro de barbers.phone para profiles.phone (exclusivo para vínculos 1-para-1)
-- 3. Validação prévia de unicidade (Duplicate Precheck) com FAIL CLOSED
-- 4. Criação do índice parcial UNIQUE restrito a papéis de equipe/gestão
--
-- ISOLAMENTO:
-- - Zero alteração em clientes (customers.phone)
-- - Zero alteração em RLS
-- - Zero alteração em auth.users
-- ==============================================================================

DO $$
BEGIN
  -- 1. Sanitizar e normalizar profiles.phone de colaboradores e administradores existentes
  -- Remove qualquer caractere não numérico
  UPDATE public.profiles
  SET phone = regexp_replace(phone, '\D', '', 'g')
  WHERE phone IS NOT NULL
    AND phone <> ''
    AND role IN (
      'super_admin', 'admin', 'tenant_admin', 'shop_owner',
      'manager', 'reception', 'receptionist',
      'financial', 'finance', 'cashier',
      'barber', 'professional'
    );

  -- Adiciona DDI 55 para números brasileiros de 10 ou 11 dígitos sem prefixo nacional
  UPDATE public.profiles
  SET phone = '55' || phone
  WHERE phone IS NOT NULL
    AND phone <> ''
    AND length(phone) IN (10, 11)
    AND NOT phone LIKE '55%'
    AND role IN (
      'super_admin', 'admin', 'tenant_admin', 'shop_owner',
      'manager', 'reception', 'receptionist',
      'financial', 'finance', 'cashier',
      'barber', 'professional'
    );

  -- 2. Safe Barber Backfill: Preenche profiles.phone a partir de barbers.phone
  -- Apenas para barbeiros com vínculo 1-para-1 exclusivo com seu próprio user_id individual e com profiles.phone vazio
  WITH unique_barber_users AS (
    SELECT
      user_id,
      CASE
        WHEN length(regexp_replace(phone, '\D', '', 'g')) IN (10, 11) AND NOT regexp_replace(phone, '\D', '', 'g') LIKE '55%'
          THEN '55' || regexp_replace(phone, '\D', '', 'g')
        ELSE regexp_replace(phone, '\D', '', 'g')
      END AS clean_phone
    FROM public.barbers
    WHERE user_id IS NOT NULL
      AND phone IS NOT NULL
      AND phone <> ''
      AND user_id IN (
        SELECT user_id
        FROM public.barbers
        WHERE user_id IS NOT NULL
        GROUP BY user_id
        HAVING COUNT(*) = 1
      )
  )
  UPDATE public.profiles p
  SET phone = b.clean_phone
  FROM unique_barber_users b
  WHERE p.id = b.user_id
    AND (p.phone IS NULL OR p.phone = '')
    AND b.clean_phone IS NOT NULL
    AND b.clean_phone <> ''
    AND p.role IN (
      'super_admin', 'admin', 'tenant_admin', 'shop_owner',
      'manager', 'reception', 'receptionist',
      'financial', 'finance', 'cashier',
      'barber', 'professional'
    );

  -- 3. Duplicate Precheck: Garante que não existem números repetidos entre staff antes de criar o índice
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT phone
      FROM public.profiles
      WHERE phone IS NOT NULL
        AND phone <> ''
        AND role IN (
          'super_admin', 'admin', 'tenant_admin', 'shop_owner',
          'manager', 'reception', 'receptionist',
          'financial', 'finance', 'cashier',
          'barber', 'professional'
        )
      GROUP BY phone
      HAVING COUNT(*) > 1
    ) dupes
  ) THEN
    RAISE EXCEPTION 'Precondition failed: duplicate normalized phones detected among authenticable staff profiles';
  END IF;

END $$;

-- 4. Índice parcial UNIQUE para garantir unicidade estrita de telefones de colaboradores e administradores
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_staff_phone_unique
ON public.profiles (phone)
WHERE
  phone IS NOT NULL
  AND phone <> ''
  AND role IN (
    'super_admin', 'admin', 'tenant_admin', 'shop_owner',
    'manager', 'reception', 'receptionist',
    'financial', 'finance', 'cashier',
    'barber', 'professional'
  );
