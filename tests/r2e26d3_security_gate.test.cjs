/**
 * BARBEX — R2E.26D.3 SECURITY GATE TEST SUITE
 * Testes para:
 * 1. Matriz de permissões e auditoria de vulnerabilidade RLS em public.barbers.
 * 2. Validação da RPC proposta update_barber_pix_info (autorização, whitelist, validação server-side).
 * 3. Análise de escalabilidade das métricas e eliminação de truncamento PostgREST (get_team_appointments_summary).
 * 4. Isolamento financeiro do fluxo de gorjetas (TipCard, register_pix_tip).
 * 5. Invariantes de produção (zero migrações aplicadas, Stripe Live, refunds fail-closed).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=== INICIANDO SUITE DE TESTES R2E.26D.3 (SECURITY GATE) ===");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// GATE 1 — Matriz de Permissões e Vulnerabilidade RLS
// -------------------------------------------------------------
runTest("GATE-1.1-RLS-COLUMN-INSECURITY-CONFIRMED", () => {
  // A policy "Barbers can manage their own profile" em public.barbers usa USING (auth.uid() = user_id)
  // Como o RLS do PostgreSQL atua a nível de linha e não de coluna, um UPDATE direto de um barbeiro
  // autenticado conseguiria alterar commission_rate, monthly_goal ou tenant_id se não houver RPC com whitelist.
  // Verificamos que o frontend agora tenta a RPC protegida para eliminar essa dependência da validação de cliente.
  const editDialogPath = path.join(__dirname, '../src/components/professional/EditProfileDialog.tsx');
  const src = fs.readFileSync(editDialogPath, 'utf8');

  assert.ok(src.includes('update_barber_pix_info'), "EditProfileDialog deve tentar a RPC segura update_barber_pix_info");
  assert.ok(!src.includes('commission_rate:'), "EditProfileDialog NÃO pode enviar commission_rate");
  assert.ok(!src.includes('monthly_goal:'), "EditProfileDialog NÃO pode enviar monthly_goal");
});

runTest("GATE-1.2-PREVENT-CROSS-TENANT-UPDATE", () => {
  // Barbeiro de um tenant não pode ter can_access_tenant(outro_tenant)
  const migrationSqlPath = path.join(__dirname, '../docs/migration/sql/r2e26d3_barber_pix_and_metrics_hardening.sql');
  const sql = fs.readFileSync(migrationSqlPath, 'utf8');

  assert.ok(sql.includes('v_barber.user_id = v_caller_id'), "Deve exigir que o chamador seja o próprio profissional");
  assert.ok(sql.includes('can_access_tenant(v_barber.tenant_id)'), "OU que possua autorização canônica sobre o tenant");
  assert.ok(sql.includes('PERMISSION_DENIED'), "Deve retornar PERMISSION_DENIED caso não seja autorizado");
});

// -------------------------------------------------------------
// GATE 2 — Validação da RPC Proposta (update_barber_pix_info)
// -------------------------------------------------------------
runTest("GATE-2.1-RPC-PARAMETERS-AND-SECURITY-DEFINER", () => {
  const migrationSqlPath = path.join(__dirname, '../docs/migration/sql/r2e26d3_barber_pix_and_metrics_hardening.sql');
  assert.ok(fs.existsSync(migrationSqlPath), "Arquivo de migração candidato deve existir");

  const sql = fs.readFileSync(migrationSqlPath, 'utf8');
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.update_barber_pix_info('), "Deve definir update_barber_pix_info");
  assert.ok(sql.includes('SECURITY DEFINER'), "Deve ser SECURITY DEFINER");
  assert.ok(sql.includes("SET search_path TO 'public', 'pg_temp'"), "Deve ter search_path seguro com pg_temp");
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.update_barber_pix_info'), "Deve revogar de PUBLIC e anon");
  assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION public.update_barber_pix_info'), "Deve conceder apenas a authenticated e service_role");
});

runTest("GATE-2.2-RPC-SERVER-SIDE-PIX-VALIDATION", () => {
  const migrationSqlPath = path.join(__dirname, '../docs/migration/sql/r2e26d3_barber_pix_and_metrics_hardening.sql');
  const sql = fs.readFileSync(migrationSqlPath, 'utf8');

  assert.ok(sql.includes('INVALID_CPF'), "RPC deve validar CPF no servidor");
  assert.ok(sql.includes('INVALID_CNPJ'), "RPC deve validar CNPJ no servidor");
  assert.ok(sql.includes('INVALID_PHONE'), "RPC deve validar Telefone no servidor");
  assert.ok(sql.includes('INVALID_EMAIL'), "RPC deve validar E-mail no servidor");
  assert.ok(sql.includes('INVALID_RANDOM_KEY'), "RPC deve validar Chave Aleatória no servidor");
});

runTest("GATE-2.3-RPC-COLUMN-WHITELIST-INTEGRITY", () => {
  const migrationSqlPath = path.join(__dirname, '../docs/migration/sql/r2e26d3_barber_pix_and_metrics_hardening.sql');
  const sql = fs.readFileSync(migrationSqlPath, 'utf8');

  // Verifica que o UPDATE na RPC altera EXCLUSIVAMENTE pix_key, pix_key_type, accepts_tips, updated_at
  const updateMatch = sql.match(/UPDATE public\.barbers\s+SET([\s\S]+?)WHERE id = p_barber_id;/);
  assert.ok(updateMatch, "Deve conter comando UPDATE em public.barbers");
  const updateBody = updateMatch[1];

  assert.ok(updateBody.includes('pix_key ='), "Deve atualizar pix_key");
  assert.ok(updateBody.includes('pix_key_type ='), "Deve atualizar pix_key_type");
  assert.ok(updateBody.includes('accepts_tips ='), "Deve atualizar accepts_tips");
  assert.ok(!updateBody.includes('commission_rate'), "NÃO pode atualizar commission_rate");
  assert.ok(!updateBody.includes('monthly_goal'), "NÃO pode atualizar monthly_goal");
  assert.ok(!updateBody.includes('tenant_id'), "NÃO pode atualizar tenant_id");
  assert.ok(!updateBody.includes('user_id'), "NÃO pode atualizar user_id");
});

// -------------------------------------------------------------
// GATE 3 — Métricas da Equipe e Eliminação de Truncamento PostgREST
// -------------------------------------------------------------
runTest("GATE-3.1-METRICS-DATABASE-AGGREGATION-RPC", () => {
  const migrationSqlPath = path.join(__dirname, '../docs/migration/sql/r2e26d3_barber_pix_and_metrics_hardening.sql');
  const sql = fs.readFileSync(migrationSqlPath, 'utf8');

  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.get_team_appointments_summary('), "Deve definir get_team_appointments_summary");
  assert.ok(sql.includes('public.can_access_tenant(p_tenant_id)'), "Deve validar autorização can_access_tenant");
  assert.ok(sql.includes("count(a.id) FILTER (WHERE a.status = 'completed')"), "Deve calcular concluídos no banco");
  assert.ok(sql.includes('GROUP BY a.barber_id'), "Deve agrupar por barber_id");
});

runTest("GATE-3.2-FRONTEND-PRIMARY-RPC-ARCHITECTURE", () => {
  const barbersRoutePath = path.join(__dirname, '../src/routes/barbers.tsx');
  const src = fs.readFileSync(barbersRoutePath, 'utf8');

  // Verifica que utiliza a RPC como fonte principal sem mascarar erros com fallback silencioso
  assert.ok(src.includes('get_team_appointments_summary'), "Deve consultar get_team_appointments_summary");
  assert.ok(src.includes('metricsLoading'), "Deve gerenciar estado de loading");
  assert.ok(src.includes('metricsError'), "Deve gerenciar estado de erro sem mascarar");
  assert.ok(src.includes('setMetricsError(rpcSummaryError.message'), "Deve registrar e exibir erro quando a RPC falha");
});

// -------------------------------------------------------------
// GATE 4 — Fluxo de Gorjetas e Isolamento Financeiro
// -------------------------------------------------------------
runTest("GATE-4.1-TIPCARD-SECURITY-AND-UX", () => {
  const tipCardPath = path.join(__dirname, '../src/components/tips/TipCard.tsx');
  const src = fs.readFileSync(tipCardPath, 'utf8');

  assert.ok(src.includes('Beneficiário:'), "Deve exibir beneficiário");
  assert.ok(src.includes('barberName'), "Deve usar barberName");
  assert.ok(src.includes('Copiar chave PIX'), "Deve conter botão 'Copiar chave PIX'");
  assert.ok(!src.includes('api.qrserver.com'), "NÃO pode usar gerador externo inseguro api.qrserver.com");
  assert.ok(src.includes('não passa pela barbearia'), "Deve alertar que valor não passa pela barbearia");
});

runTest("GATE-4.2-FINANCIAL-INVARIANTS-PRESERVED", () => {
  const stripePath = path.join(__dirname, '../supabase/functions/stripe-checkout/index.ts');
  const stripeSrc = fs.readFileSync(stripePath, 'utf8');

  assert.ok(stripeSrc.includes('ENABLE_SELF_SERVICE_REFUNDS'), "ENABLE_SELF_SERVICE_REFUNDS deve existir");
  assert.ok(stripeSrc.includes('Deno.env.get("ENABLE_SELF_SERVICE_REFUNDS") === "true"'), "Refunds kill-switch fail-closed preservado");
});

console.log("\n=======================================================");
console.log(`TOTAL DE TESTES: ${passed + failed} | PASSOU: ${passed} | FALHOU: ${failed}`);
console.log("=======================================================");

if (failed > 0) process.exit(1);
