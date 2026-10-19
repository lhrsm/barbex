/**
 * BARBEX — R2E.21G: VALIDAÇÃO DE MODAL COMERCIAL NA PÁGINA PÚBLICA E IDENTIDADE DA PLATAFORMA
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${message}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('BARBEX — R2E.21G: VALIDAÇÃO DE MODAL PÚBLICO E BRANDING');
  console.log('================================================================\n');

  // 1. Validação de src/routes/$slug.tsx
  console.log('--- 1. ROTA PÚBLICA (src/routes/$slug.tsx) ---');
  const slugRouteContent = fs.readFileSync(path.join(__dirname, '../src/routes/$slug.tsx'), 'utf8');

  assert(
    !slugRouteContent.includes('TrialExpiredBlock'),
    'src/routes/$slug.tsx NÃO importa nem renderiza TrialExpiredBlock'
  );

  assert(
    slugRouteContent.includes('Agendamentos online temporariamente indisponíveis no momento. Entre em contato diretamente com a barbearia para mais informações.') &&
    slugRouteContent.includes('UNAVAILABLE_BOOKING_MESSAGE') &&
    slugRouteContent.includes('open={isBookingOpen && canAccess === true}'),
    'src/routes/$slug.tsx preserva bloqueio neutro preventivo e mensagem da R2E.21F'
  );

  assert(
    !slugRouteContent.includes('BarberLM'),
    'src/routes/$slug.tsx não possui nenhuma referência a BarberLM'
  );

  // 2. Validação de src/components/layout/AppLayout.tsx
  console.log('\n--- 2. ÁREA ADMINISTRATIVA (src/components/layout/AppLayout.tsx) ---');
  const appLayoutContent = fs.readFileSync(path.join(__dirname, '../src/components/layout/AppLayout.tsx'), 'utf8');

  assert(
    appLayoutContent.includes('import { TrialExpiredBlock }') &&
    appLayoutContent.includes('{shouldBlockTrial && <TrialExpiredBlock />}'),
    'AppLayout.tsx preserva TrialExpiredBlock exclusivamente no painel administrativo autenticado'
  );

  // 3. Validação de src/components/subscription/TrialExpiredBlock.tsx
  console.log('\n--- 3. MODAL DE TRIAL EXPIRADO (TrialExpiredBlock.tsx) ---');
  const trialExpiredBlockContent = fs.readFileSync(path.join(__dirname, '../src/components/subscription/TrialExpiredBlock.tsx'), 'utf8');

  assert(
    trialExpiredBlockContent.includes('no Barbex expirou') &&
    !trialExpiredBlockContent.includes('BarberLM'),
    'TrialExpiredBlock.tsx utiliza a marca oficial Barbex e remove menção a BarberLM'
  );

  // 4. Validação de src/components/onboarding/SignupOnboardingModal.tsx
  console.log('\n--- 4. ONBOARDING (SignupOnboardingModal.tsx) ---');
  const signupModalContent = fs.readFileSync(path.join(__dirname, '../src/components/onboarding/SignupOnboardingModal.tsx'), 'utf8');

  assert(
    signupModalContent.includes('Já existe uma conta Barbex utilizando este e-mail.') &&
    !signupModalContent.includes('BarberLM'),
    'SignupOnboardingModal.tsx utiliza a marca oficial Barbex'
  );

  // 5. Validação de src/components/admin/support/SuperAdminTicketDetails.tsx
  console.log('\n--- 5. SUPORTE SUPERADMIN (SuperAdminTicketDetails.tsx) ---');
  const ticketDetailsContent = fs.readFileSync(path.join(__dirname, '../src/components/admin/support/SuperAdminTicketDetails.tsx'), 'utf8');

  assert(
    ticketDetailsContent.includes('Admin Barbex') &&
    !ticketDetailsContent.includes('Admin BarberLM'),
    'SuperAdminTicketDetails.tsx exibe "Admin Barbex" nos tickets de suporte'
  );

  // 6. Validação de src/lib/auth-client.functions.ts
  console.log('\n--- 6. AUTENTICAÇÃO / REDIRECT (auth-client.functions.ts) ---');
  const authClientContent = fs.readFileSync(path.join(__dirname, '../src/lib/auth-client.functions.ts'), 'utf8');

  assert(
    authClientContent.includes('https://barbex.shop') &&
    !authClientContent.includes('barberlm.lovable.app'),
    'auth-client.functions.ts utiliza https://barbex.shop como fallback de redirect'
  );

  // 7. Validação do README.md
  console.log('\n--- 7. README.md ---');
  const readmeContent = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');

  assert(
    readmeContent.includes('https://barbex.shop') &&
    !readmeContent.includes('barberlm.lovable.app'),
    'README.md referencia https://barbex.shop como Live app'
  );

  // 8. Integridade dos Tenants canônicos via RPC pública (is_tenant_operational)
  console.log('\n--- 8. CANONICAL ENTITLEMENT & TENANTS VIA RPC ---');
  const envPath = path.join(__dirname, '..', '.env');
  let supabaseUrl = '';
  let supabaseAnonKey = '';
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
        supabaseUrl = trimmed.split('=')[1].replace(/["']/g, '');
      } else if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
        supabaseAnonKey = trimmed.split('=')[1].replace(/["']/g, '');
      }
    }
  }

  if (supabaseUrl && supabaseAnonKey) {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: carlosOp, error: carlosErr } = await anonClient.rpc('is_tenant_operational', {
      p_tenant_id: '92caca5a-5174-4725-9da9-b10a9aa87104'
    });
    assert(
      !carlosErr && carlosOp === false,
      'Carlos Barber Shop (92caca5a): is_tenant_operational retorna false (RESTRICTED fail-closed)'
    );

    const { data: lmOp, error: lmErr } = await anonClient.rpc('is_tenant_operational', {
      p_tenant_id: 'c54ac1ac-49be-4505-b7a4-d257ed023f08'
    });
    assert(
      !lmErr && lmOp === true,
      'Barbearia LM (c54ac1ac): is_tenant_operational retorna true (VOUCHER_ACTIVE)'
    );
  }

  console.log('\n================================================================');
  console.log(`TOTAL DE TESTES: ${totalTests} | APROVADOS: ${passedTests} | FALHAS: ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exitCode = 1;
  } else {
    console.log('STATUS: R2E21_G_VALIDATION_SUCCESS');
    process.exitCode = 0;
  }
}

runTests().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exitCode = 1;
});
