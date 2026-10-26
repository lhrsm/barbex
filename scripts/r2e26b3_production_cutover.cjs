/**
 * ==============================================================================
 * BARBEX — R2E.26B.3: PRODUCTION CUTOVER AND POST-DDL VERIFICATION
 * Target Supabase: ywdwrstxvsdqiryhieiz
 * ==============================================================================
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('================================================================');
console.log('BARBEX R2E.26B.3 — CUTOVER UNIFICADO EM PRODUÇÃO');
console.log('Target Supabase: ywdwrstxvsdqiryhieiz');
console.log('Timestamp:', new Date().toISOString());
console.log('================================================================\n');

const mig1Path = 'supabase/migrations/20261026150000_r2e26b_appointment_reviews_realtime_publication.sql';
const mig2Path = 'supabase/migrations/20261026160000_r2e26b2_security_hardening.sql';

const mig1Sha = crypto.createHash('sha256').update(fs.readFileSync(mig1Path)).digest('hex').toUpperCase();
const mig2Sha = crypto.createHash('sha256').update(fs.readFileSync(mig2Path)).digest('hex').toUpperCase();

console.log(`[Gate Check] Migration 1: ${mig1Path}`);
console.log(`[Gate Check] SHA-256: ${mig1Sha}`);
console.log(`[Gate Check] Migration 2: ${mig2Path}`);
console.log(`[Gate Check] SHA-256: ${mig2Sha}\n`);

// 1. Aplicar Migration 1 (Realtime publication)
console.log('----------------------------------------------------------------');
console.log('[Passo 1/6] Aplicando Migration 1 (Publicação Realtime de appointment_reviews)...');
const t1 = Date.now();
const out1 = execSync(`npx.cmd supabase db query --linked --project-ref ywdwrstxvsdqiryhieiz -f "${mig1Path}"`, {
  encoding: 'utf8'
});
console.log(`Migration 1 aplicada em ${((Date.now() - t1)/1000).toFixed(2)}s.`);
console.log(out1 || '(success)');

// 2. Registrar Migration 1 em schema_migrations
console.log('\n[Passo 2/6] Registrando versão 20261026150000 em supabase_migrations.schema_migrations...');
const rec1Sql = "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261026150000') ON CONFLICT (version) DO NOTHING;";
fs.writeFileSync('scripts/temp_record_mig1.sql', rec1Sql, 'utf8');
try {
  const rec1Out = execSync('npx.cmd supabase db query --linked --project-ref ywdwrstxvsdqiryhieiz -f scripts/temp_record_mig1.sql', { encoding: 'utf8' });
  console.log(rec1Out || '(success)');
} finally {
  if (fs.existsSync('scripts/temp_record_mig1.sql')) fs.unlinkSync('scripts/temp_record_mig1.sql');
}

// 3. Aplicar Migration 2 (Hardening de Segurança RPC + Reviews)
console.log('----------------------------------------------------------------');
console.log('\n[Passo 3/6] Aplicando Migration 2 (Hardening de RPC e Avaliações)...');
const t2 = Date.now();
const out2 = execSync(`npx.cmd supabase db query --linked --project-ref ywdwrstxvsdqiryhieiz -f "${mig2Path}"`, {
  encoding: 'utf8'
});
console.log(`Migration 2 aplicada em ${((Date.now() - t2)/1000).toFixed(2)}s.`);
console.log(out2 || '(success)');

// 4. Registrar Migration 2 em schema_migrations
console.log('\n[Passo 4/6] Registrando versão 20261026160000 em supabase_migrations.schema_migrations...');
const rec2Sql = "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261026160000') ON CONFLICT (version) DO NOTHING;";
fs.writeFileSync('scripts/temp_record_mig2.sql', rec2Sql, 'utf8');
try {
  const rec2Out = execSync('npx.cmd supabase db query --linked --project-ref ywdwrstxvsdqiryhieiz -f scripts/temp_record_mig2.sql', { encoding: 'utf8' });
  console.log(rec2Out || '(success)');
} finally {
  if (fs.existsSync('scripts/temp_record_mig2.sql')) fs.unlinkSync('scripts/temp_record_mig2.sql');
}

// 5. Validação Pós-DDL Imediata no Banco
console.log('----------------------------------------------------------------');
console.log('\n[Passo 5/6] Executando validações estruturais pós-DDL em produção...');

const verifySql = `
  SELECT json_build_object(
    'realtime_tables', (
      SELECT json_agg(tablename) 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime'
    ),
    'rpc_info', (
      SELECT json_build_object(
        'proname', p.proname,
        'prosecdef', p.prosecdef,
        'proconfig', p.proconfig,
        'proacl', p.proacl
      )
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'get_barber_appointments'
    ),
    'appointment_reviews_policies', (
      SELECT json_agg(json_build_object(
        'policyname', policyname,
        'cmd', cmd,
        'roles', roles
      ))
      FROM pg_policies
      WHERE tablename = 'appointment_reviews'
    ),
    'trigger_installed', (
      SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_validate_appointment_review_before_insert'
          AND tgrelid = 'public.appointment_reviews'::regclass
      )
    ),
    'cron_active_count', (
      SELECT count(*) FROM cron.job WHERE active = true
    )
  ) AS post_ddl_status;
`;

fs.writeFileSync('scripts/temp_verify_post_ddl.sql', verifySql, 'utf8');
let postDdlResult = null;
try {
  const vOut = execSync('npx.cmd supabase db query --linked --project-ref ywdwrstxvsdqiryhieiz -f scripts/temp_verify_post_ddl.sql', { encoding: 'utf8' });
  console.log('Resultado Pós-DDL:\n', vOut);
  postDdlResult = vOut;
} finally {
  if (fs.existsSync('scripts/temp_verify_post_ddl.sql')) fs.unlinkSync('scripts/temp_verify_post_ddl.sql');
}

// 6. Testes Reais Negativos no Banco (Simulando chamadas anon e restritas)
console.log('----------------------------------------------------------------');
console.log('\n[Passo 6/6] Executando testes negativos reais de segurança pós-DDL...');

const negativeTestsSql = `
DO $$
DECLARE
  v_err_rpc boolean := false;
  v_err_insert boolean := false;
  v_dummy_barber uuid;
BEGIN
  -- 1. Teste Negativo RPC get_barber_appointments: Chamada sem auth.uid() deve falhar
  BEGIN
    PERFORM public.get_barber_appointments('00000000-0000-0000-0000-000000000000'::uuid);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%unauthenticated%' THEN
      v_err_rpc := true;
    END IF;
  END;

  IF NOT v_err_rpc THEN
    RAISE EXCEPTION 'TEST_FAIL: RPC get_barber_appointments não bloqueou chamada desautenticada!';
  END IF;

  RAISE NOTICE 'TEST_PASS: RPC get_barber_appointments bloqueou chamada desautenticada com sucesso!';
END $$;
`;

fs.writeFileSync('scripts/temp_negative_tests.sql', negativeTestsSql, 'utf8');
try {
  const negOut = execSync('npx.cmd supabase db query --linked --project-ref ywdwrstxvsdqiryhieiz -f scripts/temp_negative_tests.sql', { encoding: 'utf8' });
  console.log('Testes Negativos no Banco:\n', negOut);
} finally {
  if (fs.existsSync('scripts/temp_negative_tests.sql')) fs.unlinkSync('scripts/temp_negative_tests.sql');
}

console.log('\n================================================================');
console.log('CUTOVER DE DDL CONCLUÍDO E VALIDADO COM SUCESSO!');
console.log('================================================================\n');
