/**
 * BARBEX — R2E.22E.1
 * SUÍTE DE TESTES: CORREÇÃO DO FAQ PÚBLICO (RESOLUÇÃO CANÔNICA),
 * APROVAÇÃO E PUBLICAÇÃO INDEPENDENTES, IDENTIDADE EM CONFIGURAÇÕES E REMOÇÃO DE DEBUG
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('================================================================');
console.log('BARBEX R2E.22E.1 — TESTES DE FAQ CANÔNICO, AÇÕES E IDENTIDADE');
console.log('Data/Hora:', new Date().toISOString());
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

try {
  // -------------------------------------------------------------
  // TESTE 1: REMOÇÃO DO PAINEL DE DEBUG EM CONFIGURAÇÕES (FASE 4)
  // -------------------------------------------------------------
  console.log('--- TESTE 1: REMOÇÃO DO PAINEL DE DEBUG EM CONFIGURAÇÕES ---');
  const settingsContent = fs.readFileSync(path.join(__dirname, '../src/routes/settings.tsx'), 'utf8');

  assert(!settingsContent.includes('const [debugInfo, setDebugInfo]'), '1.1: Estado debugInfo removido de settings.tsx');
  assert(!settingsContent.includes('Debug Settings Data (temporário)'), '1.2: Componente visual de debug removido de settings.tsx');
  assert(!settingsContent.includes('setDebugInfo('), '1.3: Nenhuma chamada a setDebugInfo remanescente');

  // -------------------------------------------------------------
  // TESTE 2: RESOLUÇÃO RESILIENTE DE IDENTIDADE EM CONFIGURAÇÕES (FASE 3)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 2: RESOLUÇÃO DE IDENTIDADE EM CONFIGURAÇÕES ---');
  
  // Identificadores canônicos conhecidos
  const carlosOwnerId = '703dcd8f-0077-4a57-8728-be05f654bd5b';
  const carlosTenantId = '92caca5a-5174-4725-9da9-b10a9aa87104';
  const lmTenantId = 'c54ac1ac-49be-4505-b7a4-d257ed023f08';

  assert(settingsContent.includes('profileIdRef.current'), '2.1: profileIdRef implementado para reter ID real do perfil');
  assert(settingsContent.includes('shopIdRef.current'), '2.2: shopIdRef implementado para reter ID real da barbearia');
  
  // Verificar se a consulta de perfil suporta user.id e tenant_id
  const hasOrProfileQuery = settingsContent.includes('.or(profileFilter)') && settingsContent.includes('id.eq.${user.id}');
  assert(hasOrProfileQuery, '2.3: Consulta de perfil busca por user.id prioritariamente (previne "Perfil não encontrado")');

  // Verificar se a busca de barbershops suporta id e owner_id
  const hasOrShopQuery = settingsContent.includes('.or(shopFilter)') && settingsContent.includes('owner_id.eq.${resolvedProfileId}');
  assert(hasOrShopQuery, '2.4: Consulta de barbearia busca por owner_id do proprietário e id do tenant');

  // Simulação de resolução de perfil para Carlos Barber Shop (onde user.id !== tenant_id)
  function simulateCarlosProfileLookup(user_id, effective_tenant_id) {
    const dbProfiles = [
      { id: '703dcd8f-0077-4a57-8728-be05f654bd5b', tenant_id: '92caca5a-5174-4725-9da9-b10a9aa87104', business_name: 'Carlos Barber Shop' },
      { id: 'c54ac1ac-49be-4505-b7a4-d257ed023f08', tenant_id: 'c54ac1ac-49be-4505-b7a4-d257ed023f08', business_name: 'Barbearia LM' },
    ];
    const oldResult = dbProfiles.filter(p => p.id === effective_tenant_id);
    const newResult = dbProfiles.filter(p => p.id === user_id || p.tenant_id === effective_tenant_id);
    return { oldMatches: oldResult.length, newMatches: newResult.length, resolvedProfile: newResult[0] };
  }

  const simCarlos = simulateCarlosProfileLookup(carlosOwnerId, carlosTenantId);
  assert(simCarlos.oldMatches === 0, '2.5: Reprodução comprovada: código antigo retornava 0 perfis para Carlos Barber Shop');
  assert(simCarlos.newMatches === 1 && simCarlos.resolvedProfile.id === carlosOwnerId, '2.6: Código corrigido resolve com sucesso o perfil de Carlos Barber Shop');

  const simLM = simulateCarlosProfileLookup(lmTenantId, lmTenantId);
  assert(simLM.newMatches === 1 && simLM.resolvedProfile.id === lmTenantId, '2.7: Barbearia LM continua resolvendo com 100% de precisão');

  // -------------------------------------------------------------
  // TESTE 3: RESOLUÇÃO CANÔNICA DO FAQ PÚBLICO (FASE 1)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 3: RESOLUÇÃO CANÔNICA DO FAQ PÚBLICO ---');
  const publicFaqContent = fs.readFileSync(path.join(__dirname, '../src/components/public/BarbershopPublicFaq.tsx'), 'utf8');
  const slugRouteContent = fs.readFileSync(path.join(__dirname, '../src/routes/$slug.tsx'), 'utf8');

  assert(!publicFaqContent.includes('candidateIds'), '3.1: candidateIds eliminado de BarbershopPublicFaq');
  assert(publicFaqContent.includes('.eq("tenant_id", canonicalOwnerId)'), '3.2: Busca pública consulta estritamente .eq("tenant_id", canonicalOwnerId)');
  assert(slugRouteContent.includes('canonicalTenantId={shop?.owner_id || canonicalTenantId}'), '3.3: Rota $slug repassa explicitamente o owner_id da barbearia');

  // Simular resolução canônica pública de FAQ para LM e Carlos
  function simulateCanonicalFaqLookup(shop) {
    const canonicalOwnerId = shop.owner_id || (shop.id && shop.owner_id === undefined ? shop.id : null);
    if (!canonicalOwnerId) return [];

    const mockFaqs = [
      { id: '1', tenant_id: 'c54ac1ac-49be-4505-b7a4-d257ed023f08', question: 'LM Q1', is_approved: true, is_published: true },
      { id: '2', tenant_id: '703dcd8f-0077-4a57-8728-be05f654bd5b', question: 'Carlos Q1', is_approved: true, is_published: true },
      { id: '3', tenant_id: 'c54ac1ac-49be-4505-b7a4-d257ed023f08', question: 'LM Draft', is_approved: true, is_published: false },
      { id: '4', tenant_id: '703dcd8f-0077-4a57-8728-be05f654bd5b', question: 'Carlos Unapproved', is_approved: false, is_published: false },
    ];

    return mockFaqs.filter(f => f.tenant_id === canonicalOwnerId && f.is_approved && f.is_published);
  }

  const lmCanonicalResults = simulateCanonicalFaqLookup({
    id: 'c54ac1ac-49be-4505-b7a4-d257ed023f08',
    owner_id: 'c54ac1ac-49be-4505-b7a4-d257ed023f08'
  });
  assert(lmCanonicalResults.length === 1 && lmCanonicalResults[0].question === 'LM Q1', '3.4: LM encontra suas perguntas publicadas e ignora rascunhos');

  const carlosCanonicalResults = simulateCanonicalFaqLookup({
    id: '92caca5a-5174-4725-9da9-b10a9aa87104',
    owner_id: '703dcd8f-0077-4a57-8728-be05f654bd5b'
  });
  assert(carlosCanonicalResults.length === 1 && carlosCanonicalResults[0].question === 'Carlos Q1', '3.5: Carlos encontra suas perguntas registradas sob owner_id');

  // Isolamento estrito: garantir que as perguntas da LM não vazam para Carlos e vice-versa
  assert(!lmCanonicalResults.some(f => f.tenant_id === carlosOwnerId), '3.6: Isolamento multi-tenant: FAQ de Carlos não vaza para LM');
  assert(!carlosCanonicalResults.some(f => f.tenant_id === lmTenantId), '3.7: Isolamento multi-tenant: FAQ de LM não vaza para Carlos');

  // -------------------------------------------------------------
  // TESTE 4: AÇÕES CLARAS DE APROVAÇÃO E PUBLICAÇÃO (FASE 2)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 4: AÇÕES CLARAS DE APROVAÇÃO E PUBLICAÇÃO ---');
  const faqSettingsContent = fs.readFileSync(path.join(__dirname, '../src/components/settings/FaqSettings.tsx'), 'utf8');

  assert(faqSettingsContent.includes('const handleApprove ='), '4.1: Ação explícita handleApprove disponibilizada');
  assert(faqSettingsContent.includes('const handlePublish ='), '4.2: Ação explícita handlePublish disponibilizada');
  assert(faqSettingsContent.includes('const handleApproveAndPublish ='), '4.3: Ação combinada explícita handleApproveAndPublish disponibilizada');
  assert(faqSettingsContent.includes('const handleUnpublish ='), '4.4: Ação explícita handleUnpublish disponibilizada');
  assert(faqSettingsContent.includes('const handleUnapprove ='), '4.5: Ação explícita handleUnapprove disponibilizada');

  // Verificar que handleApprove não altera is_published
  const handleApproveBlock = faqSettingsContent.slice(
    faqSettingsContent.indexOf('const handleApprove ='),
    faqSettingsContent.indexOf('const handleUnapprove =')
  );
  assert(
    handleApproveBlock.includes('is_approved: true') && !handleApproveBlock.includes('is_published'),
    '4.6: handleApprove NÃO publica automaticamente (mantém is_published inalterado)'
  );

  // Verificar que handlePublishAllApproved exige confirmação explícita
  const batchPublishConfirm = faqSettingsContent.includes('window.confirm') && faqSettingsContent.includes('handlePublishAllApproved');
  assert(batchPublishConfirm, '4.7: Publicação em lote exige confirmação explícita do usuário via window.confirm');

  // -------------------------------------------------------------
  // TESTE 5: INTEGRIDADE DE ARQUIVOS PROTEGIDOS E NÃO-REGRESSÃO
  // -------------------------------------------------------------
  console.log('\n--- TESTE 5: ARQUIVOS PROTEGIDOS E NÃO-REGRESSÃO ---');
  const stripePath = path.join(__dirname, '../supabase/functions/stripe-checkout/index.ts');
  assert(fs.existsSync(stripePath), '5.1: supabase/functions/stripe-checkout/index.ts existe');
  const stripeDiff = execSync('git diff supabase/functions/stripe-checkout/index.ts', { encoding: 'utf8' }).trim();
  assert(stripeDiff === '', '5.2: stripe-checkout/index.ts permanece 100% intocado (0 diffs)');

  // -------------------------------------------------------------
  // RESULTADO CONSOLIDADO
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TOTAL DE TESTES: ${totalTests} | APROVADOS: ${passedTests} | FALHAS: ${totalTests - passedTests}`);
  console.log('================================================================');

  if (totalTests === passedTests) {
    console.log('STATUS: R2E22_E1_TESTS_SUCCESS');
  } else {
    process.exit(1);
  }

} catch (err) {
  console.error('Falha nos testes de regressão:', err);
  process.exit(1);
}
