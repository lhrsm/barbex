/**
 * BARBEX — SUÍTE DE AUDITORIA E VERIFICAÇÃO FINAL: FASE R2E.26E.22N.16
 * Pré-requisitos para Deploy Supervisionado com Dual-Lock Fechado
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const repoDir = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

console.log('================================================================================');
console.log('BARBEX — FASE R2E.26E.22N.16: AUDITORIA PRÉ-DEPLOY SUPERVISIONADO');
console.log('================================================================================\n');

// --- BATERIA 1: ESTADO DA BRANCH, COMMIT E MIGRATIONS ---
console.log('--- BATERIA 1: ESTADO DE CÓDIGO E MIGRATIONS PENDENTES ---');

const migrationPath = path.join(repoDir, 'supabase', 'migrations', '20261106120000_r2e26e22n14_persistent_ai_governance.sql');
let migrationSql = '';

test('V01: Existência e integridade da Migration 14 local', () => {
  assert(fs.existsSync(migrationPath), 'Arquivo da Migration 14 não encontrado');
  migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  assert(migrationSql.length > 500, 'Arquivo de migration está incompleto ou vazio');
});

test('V02: Validação de Idempotência do DDL da Migration 14', () => {
  // Deve conter ADD COLUMN IF NOT EXISTS
  assert(migrationSql.includes('ADD COLUMN IF NOT EXISTS is_persistent'), 'Migration deve usar ADD COLUMN IF NOT EXISTS');
  // Funções devem usar CREATE OR REPLACE FUNCTION
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.is_module_globally_available'), 'Função is_module_globally_available deve ser CREATE OR REPLACE');
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.admin_set_ai_persistent_availability'), 'RPC admin_set_ai_persistent_availability deve ser CREATE OR REPLACE');
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.admin_set_global_module_availability'), 'RPC admin_set_global_module_availability deve ser CREATE OR REPLACE');
});

test('V03: Verificação de Fail-Closed no DDL (Migration NÃO ativa a IA automaticamente)', () => {
  // A coluna is_persistent deve ter DEFAULT false
  assert(migrationSql.includes('is_persistent BOOLEAN NOT NULL DEFAULT false'), 'Default de is_persistent DEVE ser false');
  // Não pode haver comandos UPDATE forçando is_available = true
  assert(!migrationSql.includes('SET is_available = true'), 'Migration não pode conter comandos estáticos ativando is_available');
});

// --- BATERIA 2: SEGURANÇA RBAC E AUDITORIA DA RPC ADMINISTRATIVA ---
console.log('\n--- BATERIA 2: SEGURANÇA RBAC, TOKEN E PRIVILÉGIOS DE RPC ---');

test('V04: Permissões EXECUTE estritas (REVOKE de anon e PUBLIC)', () => {
  assert(
    migrationSql.includes('REVOKE ALL ON FUNCTION public.admin_set_ai_persistent_availability(boolean, text, text) FROM PUBLIC, anon;'),
    'RPC administrativa DEVE revogar execução de PUBLIC e anon'
  );
  assert(
    migrationSql.includes('GRANT EXECUTE ON FUNCTION public.admin_set_ai_persistent_availability(boolean, text, text) TO authenticated, service_role, postgres;'),
    'RPC administrativa concede acesso apenas a authenticated, service_role e postgres'
  );
});

test('V05: Autenticação e Autorização super_admin avaliada ANTES do token (Não substituível)', () => {
  const rpcStartIndex = migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.admin_set_ai_persistent_availability');
  assert(rpcStartIndex > 0, 'RPC não encontrada');
  const rpcBody = migrationSql.slice(rpcStartIndex);

  const authCheckIndex = rpcBody.indexOf('NOT public.has_role(v_actor_id, \'super_admin\'');
  const tokenCheckIndex = rpcBody.indexOf('v_clean_token !=');

  assert(authCheckIndex > 0, 'Checagem de role super_admin ausente no corpo da RPC');
  assert(tokenCheckIndex > 0, 'Checagem de token de confirmação ausente no corpo da RPC');
  assert(authCheckIndex < tokenCheckIndex, 'A checagem de super_admin DEVE preceder a validação do token');

  // Confirma código de erro FORBIDDEN se não for super_admin
  assert(rpcBody.includes("'code', 'FORBIDDEN'"), 'Rejeição de não-super_admin deve ser FORBIDDEN');
  assert(rpcBody.includes("'code', 'INVALID_CONFIRMATION_TOKEN'"), 'Rejeição de token deve ser INVALID_CONFIRMATION_TOKEN');
});

test('V06: Trilha de auditoria atômica obrigatória em public.audit_logs', () => {
  assert(migrationSql.includes('INSERT INTO public.audit_logs'), 'RPC administrativa DEVE gravar auditoria imutável');
  assert(migrationSql.includes("'platform.ai_persistent_availability_updated'"), 'Evento de auditoria deve ser tipado');
  assert(migrationSql.includes('pg_advisory_xact_lock'), 'RPC deve usar advisory lock transacional contra concorrência');
});

// --- BATERIA 3: ARQUITETURA SERVERLESS E LIMITES GLOBAIS GROQ FREE TIER ---
console.log('\n--- BATERIA 3: MULTI-INSTÂNCIAS SERVERLESS E POLÍTICA GROQ FREE TIER ---');

test('V07: Resiliência Multi-Instância Serverless contra concorrência em cota Groq', () => {
  const providerSource = fs.readFileSync(path.join(repoDir, 'src', 'lib', 'ai', 'provider.server.ts'), 'utf-8');
  assert(providerSource.includes('res.status === 429'), 'Deve tratar explicitamente status 429');
  assert(providerSource.includes('GROQ_RATE_LIMIT_EXCEEDED'), 'Deve retornar código tipado GROQ_RATE_LIMIT_EXCEEDED');
  assert(providerSource.includes('A cota gratuita temporária de processamento da Groq foi atingida'), 'Mensagem amigável ao usuário sem retry loop');
});

test('V08: Política R$ 0,00 estrita: Ausência total de fallbacks para APIs pagas', () => {
  const providerSource = fs.readFileSync(path.join(repoDir, 'src', 'lib', 'ai', 'provider.server.ts'), 'utf-8');
  assert(!providerSource.includes('api.openai.com'), 'Não pode haver chamadas à API da OpenAI comercial');
  assert(!providerSource.includes('api.anthropic.com'), 'Não pode haver chamadas à API da Anthropic');
  assert(providerSource.includes('cost_estimate: 0'), 'Custo financeiro DEVE ser estritamente ZERO');
});

// --- BATERIA 4: BACKUP E ISOLAMENTO DE DADOS ---
console.log('\n--- BATERIA 4: BACKUP E RESTAURAÇÃO ISOLADA ---');

test('V09: Integridade do snapshot de backup pré-deploy (scratch/backup_snapshot_phase15.json)', () => {
  const snapshotPath = path.join(repoDir, 'scratch', 'backup_snapshot_phase15.json');
  assert(fs.existsSync(snapshotPath), 'Snapshot de backup não encontrado em scratch/');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

  assert(snapshot.platform_module_availability && snapshot.platform_module_availability.length >= 23, 'Snapshot deve conter ao menos 23 módulos');
  assert(snapshot.barbershops && snapshot.barbershops.length === 4, 'Snapshot deve conter as 4 barbearias ativas');

  // Barbearia LM
  const lm = snapshot.barbershops.find(b => b.id === 'c54ac1ac-49be-4505-b7a4-d257ed023f08');
  assert(lm, 'Barbearia LM deve estar presente no snapshot');
  assert.strictEqual(lm.is_active, true, 'Barbearia LM deve estar ativa');

  // Módulo de IA deve estar com is_available = false no snapshot
  const aiMod = snapshot.platform_module_availability.find(m => m.module_key === 'ai');
  assert(aiMod, 'Módulo de IA deve estar no snapshot');
  assert.strictEqual(aiMod.is_available, false, 'No snapshot de produção, IA deve estar false');
});

// --- BATERIA 5: PRESERVAÇÃO INTEGRAL DOS 22 DEMAIS MÓDULOS ---
console.log('\n--- BATERIA 5: PRESERVAÇÃO DOS DEMAIS MÓDULOS E HARMONIZAÇÃO DUAL-LOCK ---');

test('V10: Independência de schemas: IA não adiciona chaves estrangeiras em tabelas core', () => {
  assert(!migrationSql.includes('REFERENCES public.appointments'), 'Migration não toca appointments');
  assert(!migrationSql.includes('REFERENCES public.barbershops'), 'Migration não altera barbershops');
  assert(!migrationSql.includes('REFERENCES public.clients'), 'Migration não altera clients');
});

test('V11: Harmonização do Kill Switch Emergencial em admin_set_global_module_availability', () => {
  // Se o super admin desativar a IA via admin_set_global_module_availability, is_persistent DEVE ser limpo
  assert(migrationSql.includes("is_persistent = CASE WHEN p_available IS FALSE THEN false ELSE is_persistent END"),
    'Desativação de emergência DEVE resetar is_persistent para false');
});

console.log('\n================================================================================');
console.log(`RESULTADO DA AUDITORIA DA FASE 16: ${passed} PASS, ${failed} FAIL`);
console.log('================================================================================');

if (failed > 0) {
  process.exit(1);
}
