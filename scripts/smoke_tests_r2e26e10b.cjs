const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');

function fetchUrl(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Barbex-Smoke-10B', 'Cache-Control': 'no-cache, no-store' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
    req.on('error', reject);
  });
}

function runLinkedQuery(sql) {
  const tempFile = `scripts/temp_smoke_10b_${Date.now()}.sql`;
  fs.writeFileSync(tempFile, sql, 'utf8');
  try {
    const out = execSync(`npx.cmd supabase db query --linked --file "${tempFile}"`, { encoding: 'utf8' });
    return out;
  } catch (err) {
    const combinedMsg = `${err.message} \nStdout: ${err.stdout || ''} \nStderr: ${err.stderr || ''}`;
    throw new Error(combinedMsg);
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

async function runSmokeTests() {
  console.log('================================================================');
  console.log('BARBEX R2E.26E.10B — GATE 4: SMOKE TESTS EM PRODUÇÃO');
  console.log('================================================================\n');

  // 1. Menu Equipe carrega via HTTP 200
  console.log('1. Verificando carregamento da rota /dashboard/usuarios...');
  const res = await fetchUrl('https://barbex.shop/dashboard/usuarios?t=' + Date.now());
  console.log(`Status HTTP: ${res.status} (Esperado: 200)`);
  if (res.status !== 200) {
    throw new Error(`Falha no carregamento da rota de equipe: status ${res.status}`);
  }
  console.log('>>> SMOKE 1 APROVADO: Rota /dashboard/usuarios respondendo com 200 OK.\n');

  // 2. Bundle atualizado em produção contém botão e modal de alteração de cargo
  console.log('2. Verificando presença dos elementos de alteração de cargo no bundle...');
  const assetMatch = res.body.match(/\/assets\/dashboard\.usuarios-[A-Za-z0-9_.-]+\.js/);
  if (!assetMatch) {
    throw new Error('Asset dashboard.usuarios não encontrado no HTML');
  }
  const assetUrl = 'https://barbex.shop' + assetMatch[0];
  const bundleRes = await fetchUrl(assetUrl);
  
  const hasButton = bundleRes.body.includes('Alterar Cargo') || bundleRes.body.includes('Pencil');
  const hasModalTitle = bundleRes.body.includes('Alterar Cargo do Colaborador');
  const hasCanonicalGuard = bundleRes.body.includes('identificador canônico (UUID) do colaborador');
  const hasMissingAccountGuard = bundleRes.body.includes('conta de usuário ativa (UUID) vinculada ao sistema');

  console.log(`- Botão Alterar Cargo presente: ${hasButton}`);
  console.log(`- Modal Alterar Cargo da Equipe presente: ${hasModalTitle}`);
  console.log(`- Proteção de identificador canônico presente: ${hasCanonicalGuard}`);
  console.log(`- Bloqueio de colaborador sem conta de login: ${hasMissingAccountGuard}`);

  if (!hasButton || !hasModalTitle || !hasCanonicalGuard || !hasMissingAccountGuard) {
    throw new Error('Falha no SMOKE 2: Componentes ou validações não encontrados no bundle de produção!');
  }
  console.log('>>> SMOKE 2 APROVADO: Bundle de produção íntegro com proteções ativas.\n');

  // 3. Teste de Rejeição de Acesso Não Autenticado (Anon / Public)
  console.log('3. Verificando rejeição de chamadas não autenticadas...');
  const anonSql = `
    SELECT public.change_tenant_team_member_role(
      'c54ac1ac-49be-4505-b7a4-d257ed023f08'::uuid,
      '0cd900ec-d14a-4647-8229-1387c73c578f'::uuid,
      'financial'
    );
  `;
  try {
    runLinkedQuery(anonSql);
    throw new Error('FALHA: Chamada anônima não foi rejeitada!');
  } catch (err) {
    if (err.message.includes('42501') || err.message.includes('Usuário não autenticado') || err.message.includes('permission denied')) {
      console.log('>>> SMOKE 3 APROVADO: Chamada não autenticada bloqueada com 42501 / permissão negada.\n');
    } else {
      throw err;
    }
  }

  // 4. Teste de Rejeição de Sintaxe de Identificador Sintético
  console.log('4. Verificando rejeição de identificadores sintéticos...');
  const synthSql = `
    BEGIN;
    SELECT public.change_tenant_team_member_role(
      'c54ac1ac-49be-4505-b7a4-d257ed023f08'::uuid,
      'staff-37b9ce7c-cc99-4f12-a150-bc9b6b464ed4'::uuid,
      'financial'
    );
    ROLLBACK;
  `;
  try {
    runLinkedQuery(synthSql);
    throw new Error('FALHA: String sintética não foi rejeitada!');
  } catch (err) {
    if (err.message.includes('22P02') || err.message.includes('invalid input syntax for type uuid')) {
      console.log('>>> SMOKE 4 APROVADO: Sintaxe sintética rejeitada pelo validador de tipos (22P02).\n');
    } else {
      throw err;
    }
  }

  // 5. Teste de Homologação em Transação Isolada com Rollback
  console.log('5. Executando simulação de homologação em bloco transacional com ROLLBACK...');
  const simSql = `
    BEGIN;
    DO $$
    DECLARE
      v_tenant_id uuid := 'c54ac1ac-49be-4505-b7a4-d257ed023f08';
      v_owner_id uuid := 'c54ac1ac-49be-4505-b7a4-d257ed023f08';
      v_staff_uuid uuid := '0cd900ec-d14a-4647-8229-1387c73c578f';
      v_res jsonb;
      v_current_role text;
      v_audit_count integer;
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);

      -- Transição 1: reception -> financial
      v_res := public.change_tenant_team_member_role(v_tenant_id, v_staff_uuid, 'financial');
      IF (v_res->>'new_role') != 'financial' THEN
        RAISE EXCEPTION 'Falha: new_role não é financial';
      END IF;

      -- Verificar auditoria registrada
      SELECT count(*) INTO v_audit_count
      FROM public.team_role_audit_logs
      WHERE tenant_id = v_tenant_id AND target_user_id = v_staff_uuid AND new_role = 'financial';

      IF v_audit_count = 0 THEN
        RAISE EXCEPTION 'Falha: Auditoria não registrada';
      END IF;

      -- Transição 2: financial -> reception
      v_res := public.change_tenant_team_member_role(v_tenant_id, v_staff_uuid, 'reception');
      IF (v_res->>'new_role') != 'reception' THEN
        RAISE EXCEPTION 'Falha: new_role não é reception';
      END IF;

      -- Autopromoção
      BEGIN
        PERFORM public.change_tenant_team_member_role(v_tenant_id, v_owner_id, 'financial');
        RAISE EXCEPTION 'FALHA: Autopromoção não bloqueada';
      EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE != '42501' THEN RAISE; END IF;
      END;

      -- Cross-tenant
      BEGIN
        PERFORM public.change_tenant_team_member_role(v_tenant_id, gen_random_uuid(), 'reception');
        RAISE EXCEPTION 'FALHA: Cross-tenant não bloqueado';
      EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE != 'P0002' THEN RAISE; END IF;
      END;
    END $$;
    ROLLBACK;
  `;
  const simRes = runLinkedQuery(simSql);
  console.log('Resultado da simulação em sandbox:', simRes);
  console.log('>>> SMOKE 5 APROVADO: Transições bidirecionais e travas de segurança validadas sem alteração real de cargo.\n');

  console.log('=== GATE 4 CONCLUÍDO COM SUCESSO: TODOS OS SMOKE TESTS APROVADOS ===');
}

runSmokeTests().catch(err => {
  console.error('Falha nos smoke tests:', err);
  process.exit(1);
});
