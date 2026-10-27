-- ==============================================================================
-- BARBEX — R2E.26E.8
-- GESTÃO SEGURA DE ALTERAÇÃO DE CARGOS DA EQUIPE & AUDITORIA MULTI-TENANT
-- ==============================================================================

-- 1. Tabela de Auditoria de Trocas de Cargo
CREATE TABLE IF NOT EXISTS public.team_role_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  operator_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  old_role text NOT NULL,
  new_role text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices de busca por barbearia e usuário
CREATE INDEX IF NOT EXISTS idx_team_role_audit_tenant_user 
  ON public.team_role_audit_logs(tenant_id, target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_role_audit_operator
  ON public.team_role_audit_logs(operator_id, created_at DESC);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE public.team_role_audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: Proprietários e administradores do tenant e super admins
DROP POLICY IF EXISTS "Tenant admins can view role audit logs" ON public.team_role_audit_logs;
CREATE POLICY "Tenant admins can view role audit logs"
  ON public.team_role_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_tenant(tenant_id) OR public.is_super_admin_user()
  );

-- Revogar escrita direta do cliente
REVOKE INSERT, UPDATE, DELETE ON public.team_role_audit_logs FROM anon, authenticated, public;
GRANT SELECT ON public.team_role_audit_logs TO authenticated;
GRANT ALL ON public.team_role_audit_logs TO service_role;

-- 2. RPC Canônica de Alteração de Cargo com Validação Server-Side e Anti-Autopromoção
CREATE OR REPLACE FUNCTION public.change_tenant_team_member_role(
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean := false;
  v_caller_role text;
  v_old_role text;
  v_target_profile_role text;
  v_clean_role text;
  v_valid_roles text[] := ARRAY['barber', 'reception', 'receptionist', 'manager', 'financial', 'finance', 'cashier', 'tenant_admin'];
  v_result jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  -- 1. Anti-Autopromoção / Auto-elevação: O usuário NUNCA pode alterar o próprio papel
  IF v_caller_id = p_target_user_id THEN
    RAISE EXCEPTION 'Acesso negado: Não é permitido alterar o próprio perfil de acesso.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validação de Autorização do Operador:
  -- Deve ser o proprietário da barbearia (id = p_tenant_id), super_admin, ou admin/tenant_admin ativo
  IF v_caller_id = p_tenant_id THEN
    v_is_authorized := true;
  ELSIF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role = 'super_admin') THEN
    v_is_authorized := true;
  ELSE
    SELECT role::text INTO v_caller_role
    FROM public.tenant_memberships
    WHERE tenant_id = p_tenant_id
      AND user_id = v_caller_id
      AND status = 'active';

    IF v_caller_role IN ('admin', 'tenant_admin') THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Acesso negado: Somente administradores da barbearia podem alterar cargos da equipe.' USING ERRCODE = '42501';
  END IF;

  -- 3. Proteção do Proprietário Principal e Administradores Globais
  IF p_target_user_id = p_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado: Não é permitido alterar o cargo do proprietário principal.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Acesso negado: Não é permitido alterar administradores globais.' USING ERRCODE = '42501';
  END IF;

  -- 4. Validação e Normalização do Cargo Novo
  v_clean_role := lower(trim(p_new_role));
  IF NOT (v_clean_role = ANY(v_valid_roles)) THEN
    RAISE EXCEPTION 'Cargo inválido. Cargos permitidos: barber, reception, manager, financial, tenant_admin.' USING ERRCODE = '22023';
  END IF;

  -- Normalizações canônicas
  IF v_clean_role = 'finance' OR v_clean_role = 'cashier' THEN
    v_clean_role := 'financial';
  ELSIF v_clean_role = 'receptionist' THEN
    v_clean_role := 'reception';
  END IF;

  -- 5. Lock Pessimista e Validação Multi-tenant (impede alterações cross-tenant)
  SELECT role::text INTO v_old_role
  FROM public.tenant_memberships
  WHERE tenant_id = p_tenant_id
    AND user_id = p_target_user_id
    AND status = 'active'
  FOR UPDATE;

  IF v_old_role IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado ou não possui vínculo ativo com esta barbearia.' USING ERRCODE = 'P0002';
  END IF;

  -- 5.1 Impedimento de Elevação de Privilégio: Somente o Dono do Estabelecimento ou Superadmin pode gerenciar tenant_admin
  IF (v_clean_role = 'tenant_admin' OR v_old_role = 'tenant_admin') THEN
    IF NOT (v_caller_id = p_tenant_id OR public.is_tenant_owner(p_tenant_id) OR public.is_super_admin_user()) THEN
      RAISE EXCEPTION 'Acesso negado: Somente o proprietário do estabelecimento pode conceder ou alterar o cargo de Administrador.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Se o cargo já for o mesmo, retornar sem mutação
  IF v_old_role = v_clean_role THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'O colaborador já possui este cargo.',
      'user_id', p_target_user_id,
      'role', v_clean_role
    );
  END IF;

  -- 6. Atualização Atômica Canônica em tenant_memberships (Fonte de Verdade Multi-Tenant)
  UPDATE public.tenant_memberships
  SET 
    role = v_clean_role::app_role,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND user_id = p_target_user_id;

  -- 7. Atualização Segura em profiles.role (Apenas se o usuário não for super_admin e for vinculado primariamente a este tenant)
  SELECT role::text INTO v_target_profile_role
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF v_target_profile_role IS NOT NULL AND v_target_profile_role NOT IN ('super_admin', 'admin') THEN
    -- Apenas sincroniza profile se for o tenant principal do usuário ou mono-tenant (evita poluição cross-tenant)
    IF EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = p_target_user_id AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
    ) THEN
      UPDATE public.profiles
      SET 
        role = v_clean_role::app_role,
        updated_at = now()
      WHERE id = p_target_user_id;
    END IF;
  END IF;

  -- NOTA DE SEGURANÇA MULTI-TENANT (GATE 1):
  -- A tabela public.user_roles possui escopo global (UNIQUE user_id sem tenant_id) e é reservada para super_admin.
  -- NENHUM cargo de equipe por tenant deve ser persistido em user_roles, pois concederia privilégios globais indevidos
  -- em políticas legadas (ex: transactions) e corromperia usuários multi-tenant.

  -- 8. Tratamento de Permissões Residuais (reception_permissions)
  IF v_clean_role != 'reception' THEN
    -- Desativa imediatamente permissões de recepção
    UPDATE public.reception_permissions
    SET 
      is_active = false,
      updated_at = now()
    WHERE user_id = p_target_user_id
      AND tenant_id = p_tenant_id;
  ELSE
    -- Reativar ou criar permissões de recepção se estiver retornando para reception
    INSERT INTO public.reception_permissions (user_id, tenant_id, permissions, is_active)
    VALUES (
      p_target_user_id, 
      p_tenant_id, 
      '{"appointments:manage": true, "clients:manage": true, "view_all_schedules": true}'::jsonb,
      true
    )
    ON CONFLICT (user_id)
    DO UPDATE SET 
      is_active = true,
      tenant_id = EXCLUDED.tenant_id,
      updated_at = now();
  END IF;

  -- 10. Gravação Estruturada no Log de Auditoria
  INSERT INTO public.team_role_audit_logs (
    tenant_id,
    operator_id,
    target_user_id,
    old_role,
    new_role,
    metadata
  ) VALUES (
    p_tenant_id,
    v_caller_id,
    p_target_user_id,
    v_old_role,
    v_clean_role,
    jsonb_build_object(
      'source', 'change_tenant_team_member_role',
      'caller_role', coalesce(v_caller_role, 'owner'),
      'timestamp', extract(epoch from now())
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'old_role', v_old_role,
    'new_role', v_clean_role,
    'message', format('Cargo do colaborador alterado com sucesso de %s para %s.', v_old_role, v_clean_role)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.change_tenant_team_member_role(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_tenant_team_member_role(uuid, uuid, text) TO authenticated;
