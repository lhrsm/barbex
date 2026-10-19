const assert = require('assert');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente do .env local se existirem
let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
        supabaseUrl = trimmed.split('=')[1].replace(/["']/g, '');
      } else if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
        supabaseAnonKey = trimmed.split('=')[1].replace(/["']/g, '');
      }
    }
  } catch (e) {
    // ignorar
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Configuração do Supabase ausente (.env)");
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function runTests() {
  console.log("===============================================================================================");
  console.log("BARBEX — R2E.21E.1: VALIDAÇÃO CANÔNICA DE IDENTIDADE DE TENANT E RPC PÚBLICA");
  console.log("===============================================================================================\n");

  const rawSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', '$slug.tsx'), 'utf8');
  const slugSource = rawSource.replace(/\r\n/g, '\n');

  let passed = 0;
  let failed = 0;

  async function test(id, description, fn) {
    try {
      await fn();
      console.log(`${id.padEnd(5)} | PASS [OK]  | ${description}`);
      passed++;
    } catch (e) {
      console.error(`${id.padEnd(5)} | FAIL [ERR] | ${description}\n        Erro: ${e.message}`);
      failed++;
    }
  }

  // T01: Carlos Barber Shop - Tenant ID canônico (92caca5a)
  await test("T01", "Carlos Barber Shop com Tenant ID canônico (92caca5a-5174-4725-9da9-b10a9aa87104) retorna can_operate=false", async () => {
    const carlosCanonicalTenant = "92caca5a-5174-4725-9da9-b10a9aa87104";
    const { data, error } = await anonClient.rpc('is_tenant_operational', {
      p_tenant_id: carlosCanonicalTenant
    });
    assert.strictEqual(error, null, "RPC anon não deve dar erro de permissão");
    assert.strictEqual(data, false, "Carlos Barber Shop deve retornar false");
  });

  // T02: Carlos Barber Shop - Owner ID (703dcd8f)
  await test("T02", "Carlos Barber Shop com Owner ID (703dcd8f-0077-4a57-8728-be05f654bd5b) retorna can_operate=false (Fail-closed resiliente)", async () => {
    const carlosOwnerId = "703dcd8f-0077-4a57-8728-be05f654bd5b";
    const { data, error } = await anonClient.rpc('is_tenant_operational', {
      p_tenant_id: carlosOwnerId
    });
    assert.strictEqual(error, null, "RPC anon não deve dar erro de permissão");
    assert.strictEqual(data, false, "Carlos Barber Shop com owner id deve retornar false");
  });

  // T03: Barbearia LM - Tenant ID canônico (c54ac1ac)
  await test("T03", "Barbearia LM (VOUCHER_ACTIVE / c54ac1ac-49be-4505-b7a4-d257ed023f08) retorna can_operate=true", async () => {
    const lmTenantId = "c54ac1ac-49be-4505-b7a4-d257ed023f08";
    const { data, error } = await anonClient.rpc('is_tenant_operational', {
      p_tenant_id: lmTenantId
    });
    assert.strictEqual(error, null, "RPC anon não deve dar erro de permissão");
    assert.strictEqual(data, true, "Barbearia LM deve retornar true");
  });

  // T04: Tenant inexistente e nulo
  await test("T04", "Tenant inexistente e nulo retornam rigorosamente false (Fail-closed estrito)", async () => {
    const { data: nonExistent } = await anonClient.rpc('is_tenant_operational', {
      p_tenant_id: "00000000-0000-0000-0000-000000000000"
    });
    assert.strictEqual(nonExistent, false, "Tenant inexistente deve retornar false");

    const { data: nullTenant } = await anonClient.rpc('is_tenant_operational', {
      p_tenant_id: null
    });
    assert.strictEqual(nullTenant, false, "Tenant nulo deve retornar false");
  });

  // T05: Não exposição de dados financeiros na RPC anon
  await test("T05", "RPC is_tenant_operational retorna exclusivamente boolean (sem dados financeiros ou de assinatura)", async () => {
    const lmTenantId = "c54ac1ac-49be-4505-b7a4-d257ed023f08";
    const { data } = await anonClient.rpc('is_tenant_operational', {
      p_tenant_id: lmTenantId
    });
    assert.strictEqual(typeof data, 'boolean', "Retorno deve ser boolean puro");
  });

  // T06: Resolução canônica de tenant no Frontend
  await test("T06", "Frontend resolve tenant_id canônico via barbershops entity e não assume owner/profile_id cegamente", async () => {
    assert(slugSource.includes('.from("barbershops")'), "Frontend deve consultar barbershops");
    assert(slugSource.includes("const canonicalTenantId = barbershopEntity?.id"), "Frontend deve derivar canonicalTenantId de barbershops.id");
    assert(slugSource.includes("p_tenant_id: canonicalTenantId"), "Frontend deve passar canonicalTenantId à RPC");
  });

  // T07: Reset completo de autorização na troca de slug (Sem herança de estado)
  await test("T07", "Mudança de tenant/slug reseta modal e limpa estado de autorização prévio", async () => {
    assert(slugSource.includes("setIsBookingOpen(false);\n      setCanAccess(false);\n      setIsEntitlementChecking(true);\n      fetchShopData(slug);"), "Troca de slug deve resetar estados imediatamente");
  });

  // T08: Bloqueio estrito no Dialog principal
  await test("T08", "Dialog de agendamento possui trava canônica open={isBookingOpen && canAccess === true}", async () => {
    assert(slugSource.includes("open={isBookingOpen && canAccess === true}"), "Dialog deve conter trava estrita de canAccess");
    assert(slugSource.includes("if (open && !canAccess) {"), "onOpenChange deve bloquear tentativa externa");
  });

  // T09: Presença da mensagem neutra institucional oficial
  await test("T09", "Mensagem neutra oficial está configurada sem menção a planos, inadimplência ou restrições financeiras", async () => {
    const expectedMsg = "Agendamentos online temporariamente indisponíveis no momento. Entre em contato diretamente com a barbearia para mais informações.";
    assert(slugSource.includes(expectedMsg), "Mensagem oficial deve estar presente verbatim");
    assert(!slugSource.includes("inadimplente"), "Não deve conter 'inadimplente'");
    assert(!slugSource.includes("sem plano"), "Não deve conter 'sem plano' na interface pública");
  });

  // T10: Botão do Hero e Cards de serviços desabilitados quando !canAccess
  await test("T10", "Botão do Hero e Cards de serviços desabilitados e exibem indisponibilidade para tenants RESTRICTED", async () => {
    assert(slugSource.includes("disabled={isEntitlementChecking || !canAccess}"), "Hero deve ter disabled");
    assert(slugSource.includes("Agendamento Indisponível"), "Hero deve exibir 'Agendamento Indisponível'");
    assert(slugSource.includes('"Indisponível"') && slugSource.includes("disabled={isEntitlementChecking || !canAccess}"), "Card de serviço deve conter estado Indisponível");
  });

  // T11: Banner neutro informativo presente antes do Hero
  await test("T11", "Banner neutro informativo é renderizado quando !isEntitlementChecking && !canAccess", async () => {
    assert(slugSource.includes("{!isEntitlementChecking && !canAccess && ("), "Banner deve existir e checar !isEntitlementChecking && !canAccess");
    assert(slugSource.includes("UNAVAILABLE_BOOKING_MESSAGE"), "Banner deve usar UNAVAILABLE_BOOKING_MESSAGE");
  });

  // T12: Preservação de integridade (stripe-checkout e dados institucionais)
  await test("T12", "Arquivo pendente stripe-checkout/index.ts e página institucional preservados intactos", async () => {
    const stripePath = path.join(__dirname, '..', 'supabase', 'functions', 'stripe-checkout', 'index.ts');
    assert(fs.existsSync(stripePath), "Arquivo stripe-checkout deve existir");
    assert(slugSource.includes("<AboutShop"), "AboutShop deve continuar renderizado");
    assert(slugSource.includes("shop.whatsapp_number"), "WhatsApp deve continuar acessível");
  });

  console.log("\n===============================================================================================");
  console.log(`TOTAL DE TESTES R2E.21E.1: ${passed + failed} | APROVADOS: ${passed} | REPROVADOS: ${failed}`);
  console.log("===============================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Erro fatal na execução dos testes:", err);
  process.exit(1);
});
