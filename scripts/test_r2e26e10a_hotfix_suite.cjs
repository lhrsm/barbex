const { exec } = require('child_process');
const fs = require('fs');

function runLinkedQuery(sql) {
  return new Promise((resolve, reject) => {
    const tempFile = `temp_hotfix_test_${Date.now()}.sql`;
    fs.writeFileSync(tempFile, sql, 'utf8');
    exec(`npx.cmd supabase db query --linked --file "${tempFile}"`, { timeout: 45000 }, (error, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch (e) {}
      if (error) {
        return reject(new Error(`Command error: ${error.message}\nStderr: ${stderr}\nStdout: ${stdout}`));
      }
      resolve(stdout);
    });
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveCanonicalUserId(member) {
  if (!member) return null;
  if (member.userId && typeof member.userId === 'string' && UUID_REGEX.test(member.userId.trim())) {
    return member.userId.trim();
  }
  if (member.id && typeof member.id === 'string' && UUID_REGEX.test(member.id.trim())) {
    return member.id.trim();
  }
  return null;
}

async function runHotfixTestSuite() {
  console.log('================================================================');
  console.log('   BARBEX — R2E.26E.10A HOTFIX COMPREHENSIVE TEST SUITE         ');
  console.log('================================================================\n');

  // 1. Testes de Unidade da Resolução de UUID Canônico
  console.log('--- TESTE 1: RESOLUÇÃO DE IDENTIFICADORES SINTÉTICOS ---');
  
  const staffMember = {
    id: 'staff-37b9ce7c-cc99-4f12-a150-bc9b6b464ed4',
    entityType: 'staff',
    domainId: '37b9ce7c-cc99-4f12-a150-bc9b6b464ed4',
    userId: '0cd900ec-d14a-4647-8229-1387c73c578f',
    name: 'Colaborador Staff'
  };
  const resolvedStaffUuid = resolveCanonicalUserId(staffMember);
  console.log(`Staff sintético (${staffMember.id}) -> UUID Canônico: ${resolvedStaffUuid}`);
  if (resolvedStaffUuid !== '0cd900ec-d14a-4647-8229-1387c73c578f') {
    throw new Error('Falha no Teste 1: Staff não resolveu para o userId canônico!');
  }

  const barberMember = {
    id: 'barber-b99b5030-cf2f-41cf-ad66-ecb8686f0340',
    entityType: 'barber',
    domainId: 'b99b5030-cf2f-41cf-ad66-ecb8686f0340',
    userId: '69e0910b-a3f1-4be0-8a37-4f37c544bf6c',
    name: 'Barbeiro Autenticado'
  };
  const resolvedBarberUuid = resolveCanonicalUserId(barberMember);
  console.log(`Barbeiro sintético (${barberMember.id}) -> UUID Canônico: ${resolvedBarberUuid}`);
  if (resolvedBarberUuid !== '69e0910b-a3f1-4be0-8a37-4f37c544bf6c') {
    throw new Error('Falha no Teste 1: Barbeiro não resolveu para o userId canônico!');
  }

  const unauthenticatedBarber = {
    id: 'barber-f0000000-0000-0000-0000-000000000000',
    entityType: 'barber',
    domainId: 'f0000000-0000-0000-0000-000000000000',
    userId: null,
    name: 'Barbeiro Sem Conta'
  };
  const resolvedUnauthUuid = resolveCanonicalUserId(unauthenticatedBarber);
  console.log(`Barbeiro sem conta -> UUID Canônico: ${resolvedUnauthUuid} (Bloqueado com segurança)`);
  if (resolvedUnauthUuid !== null) {
    throw new Error('Falha no Teste 1: Barbeiro sem conta não deve resolver UUID!');
  }

  console.log('>>> Teste 1 APROVADO: Resolução de UUID canônica 100% precisa.\n');

  // 2. Testes de Transição e Validação no Banco de Dados em Bloco Transacional com Rollback
  console.log('--- TESTE 2: EXECUÇÃO DA RPC COM UUID CANÔNICO EM TRANSAÇÃO COM ROLLBACK ---');
  const dbTestSql = `
    BEGIN;

    -- Instalar versão ajustada da RPC dentro da transação isolada
    CREATE OR REPLACE FUNCTION public.change_tenant_team_member_role(
      p_tenant_id uuid,
      p_target_user_id uuid,
      p_new_role text
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $func$
    DECLARE
      v_caller_id uuid;
      v_is_authorized boolean := false;
      v_caller_role text;
      v_old_role text;
      v_clean_role text;
      v_valid_roles text[] := ARRAY['barber', 'reception', 'receptionist', 'manager', 'financial', 'finance', 'cashier', 'tenant_admin'];
      v_result jsonb;
    BEGIN
      v_caller_id := auth.uid();
      IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.' USING ERRCODE = '42501';
      END IF;

      -- 1. Anti-Autopromoção / Auto-elevação
      IF v_caller_id = p_target_user_id THEN
        RAISE EXCEPTION 'Acesso negado: Não é permitido alterar o próprio perfil de acesso.' USING ERRCODE = '42501';
      END IF;

      -- 2. Validação de Autorização do Operador
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

      IF v_clean_role = 'finance' OR v_clean_role = 'cashier' THEN
        v_clean_role := 'financial';
      ELSIF v_clean_role = 'receptionist' THEN
        v_clean_role := 'reception';
      END IF;

      -- 5. Lock Pessimista e Validação Multi-tenant
      SELECT role::text INTO v_old_role
      FROM public.tenant_memberships
      WHERE tenant_id = p_tenant_id
        AND user_id = p_target_user_id
        AND status = 'active'
      FOR UPDATE;

      IF v_old_role IS NULL THEN
        RAISE EXCEPTION 'Colaborador não encontrado ou não possui vínculo ativo com esta barbearia.' USING ERRCODE = 'P0002';
      END IF;

      -- 5.1 Impedimento de Elevação de Privilégio: Somente Dono ou Superadmin gerencia tenant_admin
      IF (v_clean_role = 'tenant_admin' OR v_old_role = 'tenant_admin') THEN
        IF NOT (v_caller_id = p_tenant_id OR public.is_tenant_owner(p_tenant_id) OR public.is_super_admin_user()) THEN
          RAISE EXCEPTION 'Acesso negado: Somente o proprietário do estabelecimento pode conceder ou alterar o cargo de Administrador.' USING ERRCODE = '42501';
        END IF;
      END IF;

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

      -- 7. Tratamento de Permissões Residuais (reception_permissions)
      IF v_clean_role != 'reception' THEN
        UPDATE public.reception_permissions
        SET is_active = false, updated_at = now()
        WHERE user_id = p_target_user_id AND tenant_id = p_tenant_id;
      ELSE
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

      -- 8. Gravação Estruturada no Log de Auditoria
      INSERT INTO public.team_role_audit_logs (
        tenant_id, operator_id, target_user_id, old_role, new_role, metadata
      ) VALUES (
        p_tenant_id, v_caller_id, p_target_user_id, v_old_role, v_clean_role,
        jsonb_build_object(
          'source', 'change_tenant_team_member_role',
          'caller_role', coalesce(v_caller_role, 'owner'),
          'timestamp', extract(epoch from now())
        )
      );

      RETURN jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'old_role', v_old_role,
        'new_role', v_clean_role,
        'message', format('Cargo do colaborador alterado com sucesso de %s para %s.', v_old_role, v_clean_role)
      );
    END;
    $func$;

    -- Ativar contexto do operador (Dono da Barbearia LM)
    -- Simular transição do colaborador 0cd900ec-d14a-4647-8229-1387c73c578f (reception -> financial)
    DO $$
    DECLARE
      v_tenant_id uuid := 'c54ac1ac-49be-4505-b7a4-d257ed023f08';
      v_owner_id uuid := 'c54ac1ac-49be-4505-b7a4-d257ed023f08';
      v_staff_uuid uuid := '0cd900ec-d14a-4647-8229-1387c73c578f';
      v_res jsonb;
      v_current_role text;
      v_rec record;
    BEGIN
      -- Confirmar cargo atual no banco
      SELECT role::text INTO v_current_role
      FROM public.tenant_memberships
      WHERE tenant_id = v_tenant_id AND user_id = v_staff_uuid;

      RAISE NOTICE 'Cargo antes da transição: %', v_current_role;

      -- Teste A: Tentar passar string sintética staff- diretamente (deve falhar com 22P02)
      BEGIN
        EXECUTE format('SELECT public.change_tenant_team_member_role(%L, %L::uuid, %L)', 
          v_tenant_id, 'staff-37b9ce7c-cc99-4f12-a150-bc9b6b464ed4', 'financial');
        RAISE EXCEPTION 'FALHA: String sintética não foi rejeitada!';
      EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '22P02' THEN
          RAISE NOTICE 'SUBTESTE A OK: Sintaxe inválida rejeitada pelo PostgreSQL com 22P02.';
        ELSE
          RAISE;
        END IF;
      END;

      -- Teste B: Executar com UUID canônico real (0cd900ec-d14a-4647-8229-1387c73c578f)
      PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);

      v_res := public.change_tenant_team_member_role(v_tenant_id, v_staff_uuid, 'financial');
      RAISE NOTICE 'Resultado da RPC (reception -> financial): %', v_res;

      IF (v_res->>'success')::boolean != true OR (v_res->>'new_role') != 'financial' THEN
        RAISE EXCEPTION 'Falha no SUBTESTE B: RPC não retornou sucesso ou new_role incorreto.';
      END IF;

      -- Conferir se o cargo foi atualizado em tenant_memberships
      SELECT role::text INTO v_current_role
      FROM public.tenant_memberships
      WHERE tenant_id = v_tenant_id AND user_id = v_staff_uuid;

      IF v_current_role != 'financial' THEN
        RAISE EXCEPTION 'Falha no SUBTESTE B: tenant_memberships não foi atualizado!';
      END IF;

      -- Conferir se o log de auditoria foi gravado
      SELECT count(*) INTO v_rec
      FROM public.team_role_audit_logs
      WHERE tenant_id = v_tenant_id AND target_user_id = v_staff_uuid AND new_role = 'financial';

      IF v_rec.count = 0 THEN
        RAISE EXCEPTION 'Falha no SUBTESTE B: Log de auditoria não foi gravado!';
      END IF;
      RAISE NOTICE 'SUBTESTE B OK: reception -> financial executado com sucesso e auditado.';

      -- Teste C: Transição inversa (financial -> reception)
      v_res := public.change_tenant_team_member_role(v_tenant_id, v_staff_uuid, 'reception');
      RAISE NOTICE 'Resultado da RPC (financial -> reception): %', v_res;

      IF (v_res->>'success')::boolean != true OR (v_res->>'new_role') != 'reception' THEN
        RAISE EXCEPTION 'Falha no SUBTESTE C: RPC não retornou sucesso.';
      END IF;

      SELECT role::text INTO v_current_role
      FROM public.tenant_memberships
      WHERE tenant_id = v_tenant_id AND user_id = v_staff_uuid;

      IF v_current_role != 'reception' THEN
        RAISE EXCEPTION 'Falha no SUBTESTE C: tenant_memberships não retornou a reception!';
      END IF;
      RAISE NOTICE 'SUBTESTE C OK: financial -> reception executado com sucesso.';

      -- Teste D: Bloqueio de Autopromoção
      BEGIN
        PERFORM public.change_tenant_team_member_role(v_tenant_id, v_owner_id, 'financial');
        RAISE EXCEPTION 'Falha no SUBTESTE D: Autopromoção não foi bloqueada!';
      EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '42501' THEN
          RAISE NOTICE 'SUBTESTE D OK: Autopromoção/autoalteração bloqueada com 42501.';
        ELSE
          RAISE;
        END IF;
      END;

      -- Teste E: Bloqueio de Usuário de Outro Tenant (Cross-Tenant)
      BEGIN
        PERFORM public.change_tenant_team_member_role(v_tenant_id, gen_random_uuid(), 'reception');
        RAISE EXCEPTION 'Falha no SUBTESTE E: Cross-tenant não foi bloqueado!';
      EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = 'P0002' THEN
          RAISE NOTICE 'SUBTESTE E OK: Usuário inexistente no tenant bloqueado com P0002.';
        ELSE
          RAISE;
        END IF;
      END;

    END $$;

    -- ROLLBACK OBRIGATÓRIO: Mantém o banco de produção 100% intacto sem nenhuma mutação
    ROLLBACK;
  `;

  const dbRes = await runLinkedQuery(dbTestSql);
  console.log('Resultado dos testes no banco:', dbRes);
  console.log('>>> Teste 2 APROVADO: Transições com UUID canônico validadas com rollback.\n');

  // 3. Verificação de Integridade dos Dados de Produção
  console.log('--- TESTE 3: CONFERÊNCIA DA INTEGRIDADE DO BANCO DE PRODUÇÃO ---');
  const verifySql = `
    SELECT 
      (SELECT count(*) FROM public.tenant_memberships) as memberships_count,
      (SELECT count(*) FROM public.barber_commissions WHERE status = 'pending') as pending_commissions_count,
      (SELECT coalesce(sum(commission_amount), 0) FROM public.barber_commissions WHERE status = 'pending') as pending_sum,
      (SELECT count(*) FROM public.transactions) as transactions_count,
      (SELECT count(*) FROM public.team_role_audit_logs) as audit_logs_count;
  `;
  const verifyRes = JSON.parse(await runLinkedQuery(verifySql));
  const vRow = (verifyRes.rows || verifyRes)[0];
  console.log('Métricas de Produção Pós-Teste:');
  console.log(`- tenant_memberships: ${vRow.memberships_count}`);
  console.log(`- barber_commissions pendentes: ${vRow.pending_commissions_count}`);
  console.log(`- soma comissões pendentes: R$ ${Number(vRow.pending_sum).toFixed(2)}`);
  console.log(`- transactions: ${vRow.transactions_count}`);
  console.log(`- audit_logs: ${vRow.audit_logs_count}`);

  if (
    Number(vRow.memberships_count) !== 6 ||
    Number(vRow.pending_commissions_count) !== 6 ||
    Number(vRow.pending_sum) !== 125.00 ||
    Number(vRow.transactions_count) !== 7 ||
    Number(vRow.audit_logs_count) !== 0
  ) {
    throw new Error('Falha de Integridade: Dados do banco sofreram mutação indevida!');
  }
  console.log('>>> Teste 3 APROVADO: Banco de dados preservado 100% inalterado.');
}

runHotfixTestSuite().catch(err => {
  console.error('Falha na suíte de testes do hotfix:', err);
  process.exit(1);
});
