const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

console.log('================================================================');
console.log('BARBEX R2E.26E.10B — GATE 2: APLICAÇÃO DA MIGRATION EM PRODUÇÃO');
console.log('================================================================\n');

const migPath = 'supabase/migrations/20261027170000_r2e26e10a_hotfix_role_rpc_profiles_update.sql';
if (!fs.existsSync(migPath)) {
  console.error(`FATAL: Arquivo de migration não encontrado: ${migPath}`);
  process.exit(1);
}

const migContent = fs.readFileSync(migPath, 'utf8');
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(migPath)).digest('hex').toUpperCase();

console.log(`Arquivo da Migration: ${migPath}`);
console.log(`Tamanho: ${migContent.length} bytes`);
console.log(`SHA-256: ${sha256}\n`);

// 1. Aplicar a Migration SQL em Produção
console.log('[1/4] Aplicando migration 20261027170000 via supabase db query --linked...');
const start = Date.now();
const applyOut = execSync(`npx.cmd supabase db query --linked --file "${migPath}"`, {
  encoding: 'utf8',
  timeout: 60000
});
const duration = ((Date.now() - start) / 1000).toFixed(2);
console.log(`Migration aplicada com sucesso em ${duration}s.`);
console.log('Saída:', applyOut);

// 2. Registrar no schema_migrations
console.log('\n[2/4] Registrando versões 20261027160000 e 20261027170000 em schema_migrations...');
const recordSql = `
  INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261027160000') ON CONFLICT (version) DO NOTHING;
  INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261027170000') ON CONFLICT (version) DO NOTHING;
`;
fs.writeFileSync('scripts/temp_record_10b.sql', recordSql, 'utf8');
try {
  const recOut = execSync('npx.cmd supabase db query --linked --file scripts/temp_record_10b.sql', {
    encoding: 'utf8'
  });
  console.log('Versões registradas com sucesso em schema_migrations:', recOut);
} finally {
  if (fs.existsSync('scripts/temp_record_10b.sql')) {
    fs.unlinkSync('scripts/temp_record_10b.sql');
  }
}

// 3. Inspeção e Validação do Código Instalado da RPC
console.log('\n[3/4] Inspecionando a definição instalada da RPC change_tenant_team_member_role...');
const inspectSql = `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'change_tenant_team_member_role';`;
fs.writeFileSync('scripts/temp_inspect_func.sql', inspectSql, 'utf8');
let funcDef = '';
try {
  const inspectOut = execSync('npx.cmd supabase db query --linked --file scripts/temp_inspect_func.sql', {
    encoding: 'utf8'
  });
  const parsed = JSON.parse(inspectOut);
  funcDef = (parsed.rows || parsed)[0].pg_get_functiondef;
} finally {
  if (fs.existsSync('scripts/temp_inspect_func.sql')) {
    fs.unlinkSync('scripts/temp_inspect_func.sql');
  }
}

if (funcDef.includes('UPDATE public.profiles')) {
  console.error('FATAL: A função ainda contém UPDATE public.profiles! Falha de segurança.');
  process.exit(1);
}
if (!funcDef.includes('UPDATE public.tenant_memberships')) {
  console.error('FATAL: A função não contém UPDATE public.tenant_memberships!');
  process.exit(1);
}
if (!funcDef.includes('INSERT INTO public.team_role_audit_logs')) {
  console.error('FATAL: A função não contém gravação de auditoria!');
  process.exit(1);
}
console.log('>>> Inspeção de Código APROVADA: profiles.role NÃO é modificado; tenant_memberships e audit_logs ativos.');

// 4. Teste Dinâmico em Transação com Rollback
console.log('\n[4/4] Executando validação dinâmica da RPC sob contexto de Dono da Barbearia com ROLLBACK...');
const testSql = `
  BEGIN;
  DO $$
  DECLARE
    v_tenant_id uuid := 'c54ac1ac-49be-4505-b7a4-d257ed023f08';
    v_owner_id uuid := 'c54ac1ac-49be-4505-b7a4-d257ed023f08';
    v_staff_uuid uuid := '0cd900ec-d14a-4647-8229-1387c73c578f';
    v_res jsonb;
    v_current_role text;
  BEGIN
    -- Simular autenticação como dono da barbearia
    PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);

    -- Executar transição reception -> financial
    v_res := public.change_tenant_team_member_role(v_tenant_id, v_staff_uuid, 'financial');
    IF (v_res->>'success')::boolean != true THEN
      RAISE EXCEPTION 'Falha: RPC não retornou success';
    END IF;

    SELECT role::text INTO v_current_role
    FROM public.tenant_memberships
    WHERE tenant_id = v_tenant_id AND user_id = v_staff_uuid;

    IF v_current_role != 'financial' THEN
      RAISE EXCEPTION 'Falha: Cargo não foi atualizado para financial';
    END IF;

    -- Executar transição inversa financial -> reception
    v_res := public.change_tenant_team_member_role(v_tenant_id, v_staff_uuid, 'reception');
    IF (v_res->>'success')::boolean != true THEN
      RAISE EXCEPTION 'Falha: RPC reversa não retornou success';
    END IF;

    SELECT role::text INTO v_current_role
    FROM public.tenant_memberships
    WHERE tenant_id = v_tenant_id AND user_id = v_staff_uuid;

    IF v_current_role != 'reception' THEN
      RAISE EXCEPTION 'Falha: Cargo não retornou para reception';
    END IF;
  END $$;
  ROLLBACK;
`;
fs.writeFileSync('scripts/temp_dyn_test.sql', testSql, 'utf8');
try {
  const dynOut = execSync('npx.cmd supabase db query --linked --file scripts/temp_dyn_test.sql', {
    encoding: 'utf8'
  });
  console.log('Resultado do teste dinâmico (Rollback):', dynOut);
  console.log('>>> Validação dinâmica em rollback APROVADA: Dono consegue alterar cargo sem acionar protect_role_column()!');
} finally {
  if (fs.existsSync('scripts/temp_dyn_test.sql')) {
    fs.unlinkSync('scripts/temp_dyn_test.sql');
  }
}

// 5. Verificação da Preservação do Banco de Dados
console.log('\n--- VERIFICAÇÃO FINAL DE INTEGRIDADE DO BANCO ---');
const verifySql = `
  SELECT 
    (SELECT count(*) FROM public.tenant_memberships) as memberships_count,
    (SELECT count(*) FROM public.barber_commissions WHERE status = 'pending') as pending_commissions_count,
    (SELECT coalesce(sum(commission_amount), 0) FROM public.barber_commissions WHERE status = 'pending') as pending_sum,
    (SELECT count(*) FROM public.transactions) as transactions_count,
    (SELECT count(*) FROM public.team_role_audit_logs) as audit_logs_count;
`;
fs.writeFileSync('scripts/temp_verify.sql', verifySql, 'utf8');
try {
  const verifyOut = execSync('npx.cmd supabase db query --linked --file scripts/temp_verify.sql', {
    encoding: 'utf8'
  });
  const vParsed = JSON.parse(verifyOut);
  const vRow = (vParsed.rows || vParsed)[0];
  console.log('Métricas de Produção Pós-Migration:');
  console.log(`- tenant_memberships: ${vRow.memberships_count}`);
  console.log(`- comissões pendentes: ${vRow.pending_commissions_count}`);
  console.log(`- soma comissões pendentes: R$ ${Number(vRow.pending_sum).toFixed(2)}`);
  console.log(`- transações: ${vRow.transactions_count}`);
  console.log(`- logs de auditoria de cargos: ${vRow.audit_logs_count}`);

  if (
    Number(vRow.memberships_count) !== 6 ||
    Number(vRow.pending_commissions_count) !== 6 ||
    Number(vRow.pending_sum) !== 125.00 ||
    Number(vRow.transactions_count) !== 7 ||
    Number(vRow.audit_logs_count) !== 0
  ) {
    console.error('FATAL: Invariantes do banco foram alteradas!');
    process.exit(1);
  }
  console.log('>>> Integridade do banco de produção 100% PRESERVADA (Zero mutações indevidas).\n');
} finally {
  if (fs.existsSync('scripts/temp_verify.sql')) {
    fs.unlinkSync('scripts/temp_verify.sql');
  }
}

console.log('=== GATE 2 CONCLUÍDO COM SUCESSO: MIGRATION APLICADA E HOMOLOGADA NO BACKEND ===');
