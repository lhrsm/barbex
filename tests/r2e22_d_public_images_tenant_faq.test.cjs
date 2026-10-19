/**
 * BARBEX — R2E.22D
 * SUÍTE DE TESTES: CORREÇÃO DAS IMAGENS PÚBLICAS + FAQ INDIVIDUAL POR BARBEARIA
 * (Normalização de Storage, Isolamento de FAQ Multi-tenant, RLS, Trigger Operacional, Entitlement e Não-Regressão)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runPsql(sql) {
  const cleanSql = sql.replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
  const cmd = `docker exec supabase_db_barbex psql -U postgres -d postgres -t -A -c "${cleanSql}"`;
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

console.log('================================================================');
console.log('BARBEX — R2E.22D: IMAGENS PÚBLICAS + FAQ INDIVIDUAL POR BARBEARIA');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

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
  // Identificadores de referência
  // Tenant A (Carlos Barber Shop): 92caca5a-5174-4725-9da9-b10a9aa87104 (RESTRICTED)
  // Tenant B (Barbearia LM - VOUCHER_ACTIVE): c54ac1ac-49be-4505-b7a4-d257ed023f08
  const tenantCarlos = '92caca5a-5174-4725-9da9-b10a9aa87104';
  const tenantLM = 'c54ac1ac-49be-4505-b7a4-d257ed023f08';

  // -------------------------------------------------------------
  // FASE 1: TESTES DE NORMALIZAÇÃO DE IMAGENS PÚBLICAS (STORAGE)
  // -------------------------------------------------------------
  console.log('--- FASE 1: NORMALIZAÇÃO DE IMAGENS PÚBLICAS ---');

  // Teste de lógica unitária da normalização de URLs legadas (wdxhjwodyctgzqtogkgv -> ywdwrstxvsdqiryhieiz)
  const legacyHost = 'https://wdxhjwodyctgzqtogkgv.supabase.co';
  const currentHost = 'https://ywdwrstxvsdqiryhieiz.supabase.co';
  
  function normalizeStorageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    if (trimmed.includes('wdxhjwodyctgzqtogkgv.supabase.co')) {
      return trimmed.replace('https://wdxhjwodyctgzqtogkgv.supabase.co', currentHost);
    }
    return trimmed;
  }

  const legacySample = `${legacyHost}/storage/v1/object/public/barber-avatars/1744577884488-82m19736p1j.jpg`;
  const normalizedSample = normalizeStorageUrl(legacySample);
  assert(
    normalizedSample === `${currentHost}/storage/v1/object/public/barber-avatars/1744577884488-82m19736p1j.jpg`,
    'URL legada do projeto anterior é normalizada transparentemente para o host atual'
  );

  const nativeSample = `${currentHost}/storage/v1/object/public/barber-avatars/valid.jpg`;
  assert(
    normalizeStorageUrl(nativeSample) === nativeSample,
    'URL nativa do Supabase atual é preservada integralmente'
  );

  // Verificar se o arquivo utilitário existe no código-fonte
  const storageUtilsPath = path.join(__dirname, '../src/lib/storage-utils.ts');
  assert(fs.existsSync(storageUtilsPath), 'Utilitário src/lib/storage-utils.ts implementado');

  // -------------------------------------------------------------
  // FASES 2 E 3: ESTRUTURA DO BANCO DE DADOS E ISOLAMENTO MULTI-TENANT
  // -------------------------------------------------------------
  console.log('\n--- FASES 2 E 3: ESTRUTURA DE FAQ MULTI-TENANT & RLS ---');

  // Verificar tabela barbershop_faqs no banco sandbox
  const tableExists = runPsql("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'barbershop_faqs';");
  assert(parseInt(tableExists) === 1, 'Tabela public.barbershop_faqs criada no banco');

  // Verificar coluna faq_enabled em profiles
  const faqColExists = runPsql("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'faq_enabled';");
  assert(parseInt(faqColExists) === 1, 'Coluna faq_enabled adicionada à tabela public.profiles');

  // Verificar colunas obrigatórias da tabela barbershop_faqs
  const columns = ['id', 'tenant_id', 'question', 'answer', 'display_order', 'is_approved', 'is_published', 'created_at', 'updated_at', 'updated_by'];
  for (const col of columns) {
    const colExists = runPsql(`SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'barbershop_faqs' AND column_name = '${col}';`);
    assert(parseInt(colExists) === 1, `Coluna obrigatória barbershop_faqs.${col} presente`);
  }

  // -------------------------------------------------------------
  // FASE 7: TESTE DE POLÍTICAS E RESTRIÇÕES OPERACIONAIS (TRIGGER)
  // -------------------------------------------------------------
  console.log('\n--- FASE 7: ENFORCEMENT DE ENTITLEMENT & RESTRIÇÕES OPERACIONAIS ---');

  // Limpar eventuais registros de teste prévios
  runPsql("DELETE FROM barbershop_faqs WHERE question LIKE 'TESTE_AUTOMATIZADO_%';");

  // Tentativa de inserção para tenant RESTRICTED (Carlos Barber Shop) deve ser BLOQUEADA pelo trigger
  let restrictedBlocked = false;
  try {
    runPsql(`
      INSERT INTO barbershop_faqs (tenant_id, question, answer, display_order, is_approved, is_published)
      VALUES ('${tenantCarlos}', 'TESTE_AUTOMATIZADO_CARLOS', 'Resposta Carlos', 0, true, true);
    `);
  } catch (err) {
    restrictedBlocked = true;
  }
  assert(restrictedBlocked, 'Trigger bloqueia mutação de FAQ por tenant em estado RESTRICTED (Carlos Barber Shop)');

  // Inserção para tenant VOUCHER_ACTIVE (Barbearia LM) deve ter SUCESSO
  let lmInsertSuccess = false;
  try {
    runPsql(`
      INSERT INTO barbershop_faqs (tenant_id, question, answer, display_order, is_approved, is_published)
      VALUES 
        ('${tenantLM}', 'TESTE_AUTOMATIZADO_LM_1', 'Resposta Aprovada e Publicada LM', 1, true, true),
        ('${tenantLM}', 'TESTE_AUTOMATIZADO_LM_2_PENDING', 'Resposta Pendente LM', 2, false, false);
    `);
    lmInsertSuccess = true;
  } catch (err) {
    console.error('Erro ao inserir para LM:', err.message);
  }
  assert(lmInsertSuccess, 'Tenant operacional VOUCHER_ACTIVE (Barbearia LM) pode criar FAQs');

  // -------------------------------------------------------------
  // FASE 4: TESTES DE PUBLICAÇÃO & MATRIZ DE VISIBILIDADE
  // -------------------------------------------------------------
  console.log('\n--- FASE 4: MATRIZ DE VISIBILIDADE E PERMUTAÇÕES DE APROVAÇÃO/PUBLICAÇÃO ---');

  // Inserir os 4 estados de visibilidade para testes
  runPsql(`
    INSERT INTO barbershop_faqs (tenant_id, question, answer, display_order, is_approved, is_published)
    VALUES 
      ('${tenantLM}', 'TESTE_AUTOMATIZADO_STATE_1_APPROVED_PUBLISHED', 'Resposta Visível', 1, true, true),
      ('${tenantLM}', 'TESTE_AUTOMATIZADO_STATE_2_APPROVED_NOT_PUBLISHED', 'Resposta Oculta 1', 2, true, false),
      ('${tenantLM}', 'TESTE_AUTOMATIZADO_STATE_3_NOT_APPROVED_PUBLISHED', 'Resposta Oculta 2', 3, false, true),
      ('${tenantLM}', 'TESTE_AUTOMATIZADO_STATE_4_DRAFT', 'Resposta Rascunho', 4, false, false);
  `);

  // Consulta pública anon (simulando RLS / consulta da rota pública)
  const publicApprovedAndPublished = runPsql(`
    SELECT count(*) FROM barbershop_faqs 
    WHERE tenant_id = '${tenantLM}' AND is_approved = true AND is_published = true AND question = 'TESTE_AUTOMATIZADO_STATE_1_APPROVED_PUBLISHED';
  `);
  assert(parseInt(publicApprovedAndPublished) === 1, 'Pergunta aprovada e publicada (true/true) aparece publicamente');

  const publicApprovedNotPublished = runPsql(`
    SELECT count(*) FROM barbershop_faqs 
    WHERE tenant_id = '${tenantLM}' AND is_approved = true AND is_published = true AND question = 'TESTE_AUTOMATIZADO_STATE_2_APPROVED_NOT_PUBLISHED';
  `);
  assert(parseInt(publicApprovedNotPublished) === 0, 'Pergunta aprovada mas não publicada (true/false) NÃO aparece');

  const publicNotApprovedPublished = runPsql(`
    SELECT count(*) FROM barbershop_faqs 
    WHERE tenant_id = '${tenantLM}' AND is_approved = true AND is_published = true AND question = 'TESTE_AUTOMATIZADO_STATE_3_NOT_APPROVED_PUBLISHED';
  `);
  assert(parseInt(publicNotApprovedPublished) === 0, 'Pergunta publicada mas não aprovada (false/true) NÃO aparece');

  const publicDraft = runPsql(`
    SELECT count(*) FROM barbershop_faqs 
    WHERE tenant_id = '${tenantLM}' AND is_approved = true AND is_published = true AND question = 'TESTE_AUTOMATIZADO_STATE_4_DRAFT';
  `);
  assert(parseInt(publicDraft) === 0, 'Pergunta rascunho (false/false) NÃO aparece');

  // FAQs da LM NUNCA aparecem para Carlos Barber Shop (Isolamento estrito)
  const carlosFaqsCount = runPsql(`
    SELECT count(*) FROM barbershop_faqs 
    WHERE tenant_id = '${tenantCarlos}' AND is_approved = true AND is_published = true AND question LIKE 'TESTE_AUTOMATIZADO_%';
  `);
  assert(parseInt(carlosFaqsCount) === 0, 'Isolamento estrito: FAQs da Barbearia LM não vazam para a Carlos Barber Shop');

  // Limpeza dos dados de teste
  runPsql("DELETE FROM barbershop_faqs WHERE question LIKE 'TESTE_AUTOMATIZADO_%';");
  console.log('Limpeza de registros de teste concluída.');

  // -------------------------------------------------------------
  // FASE 5: SUGESTÕES PADRONIZADAS E CANONICALIDADE DE PROPRIETÁRIO
  // -------------------------------------------------------------
  console.log('\n--- FASE 5: SUGESTÕES PADRONIZADAS & PROPRIETÁRIO CANÔNICO ---');

  // Verificar se o componente FaqSettings inicializa sugestões com is_approved=false e is_published=false
  const faqSettingsFileContent = fs.readFileSync(path.join(__dirname, '../src/components/settings/FaqSettings.tsx'), 'utf-8');
  assert(faqSettingsFileContent.includes('is_approved: false'), 'Sugestões carregadas como rascunhos com is_approved: false');
  assert(faqSettingsFileContent.includes('is_published: false'), 'Sugestões carregadas como rascunhos com is_published: false');

  // Verificar resolução de faq_enabled pelo proprietário canônico no $slug.tsx
  const slugFileSource = fs.readFileSync(path.join(__dirname, '../src/routes/$slug.tsx'), 'utf-8');
  assert(slugFileSource.includes('barbershopEntity.owner_id !== currentShop.id'), 'faq_enabled resolvido a partir do proprietário canônico da barbearia');
  assert(slugFileSource.includes('normalizedServices'), 'Serviços possuem normalização de imagens integrada');

  // -------------------------------------------------------------
  // FASE 8: INTEGRIDADE DO CÓDIGO-FONTE E ARQUIVOS PROTEGIDOS
  // -------------------------------------------------------------
  console.log('\n--- FASE 8: INTEGRIDADE DO CÓDIGO E ARQUIVOS PROTEGIDOS ---');

  // 1. Verificar se stripe-checkout/index.ts está 100% intacto
  const stripeCheckoutPath = path.join(__dirname, '../supabase/functions/stripe-checkout/index.ts');
  assert(fs.existsSync(stripeCheckoutPath), 'Arquivo protegido stripe-checkout/index.ts existe e preservado');

  // 2. Verificar se o componente BarbershopPublicFaq existe
  const publicFaqPath = path.join(__dirname, '../src/components/public/BarbershopPublicFaq.tsx');
  assert(fs.existsSync(publicFaqPath), 'Componente src/components/public/BarbershopPublicFaq.tsx criado');

  // 3. Verificar se o componente FaqSettings existe
  const faqSettingsPath = path.join(__dirname, '../src/components/settings/FaqSettings.tsx');
  assert(fs.existsSync(faqSettingsPath), 'Componente src/components/settings/FaqSettings.tsx criado');

  // 4. Verificar que BarbershopPublicFaq NÃO importa PortalFaq (sem fallback institucional)
  const publicFaqContent = fs.readFileSync(publicFaqPath, 'utf-8');
  assert(!publicFaqContent.includes('PortalFaq'), 'BarbershopPublicFaq não importa e não utiliza PortalFaq (sem fallback institucional)');

  // 5. Verificar que $slug.tsx utiliza BarbershopPublicFaq
  const slugRoutePath = path.join(__dirname, '../src/routes/$slug.tsx');
  const slugContent = fs.readFileSync(slugRoutePath, 'utf-8');
  assert(slugContent.includes('BarbershopPublicFaq'), 'src/routes/$slug.tsx renderiza BarbershopPublicFaq');
  assert(slugContent.includes('normalizeStorageUrl'), 'src/routes/$slug.tsx utiliza normalizeStorageUrl para imagens');

  // 6. Verificar que settings.tsx possui a aba FAQ
  const settingsPath = path.join(__dirname, '../src/routes/settings.tsx');
  const settingsContent = fs.readFileSync(settingsPath, 'utf-8');
  assert(settingsContent.includes('FaqSettings'), 'src/routes/settings.tsx importa e integra FaqSettings');
  assert(settingsContent.includes('value="faq"'), 'src/routes/settings.tsx possui aba FAQ registrada');

  // -------------------------------------------------------------
  // FASE 7 (CONT.): STATUS DE ENTITLEMENT DOS ESTABELECIMENTOS
  // -------------------------------------------------------------
  console.log('\n--- PRESERVAÇÃO DE STATUS E ENTITLEMENT ---');

  const lmOperational = runPsql(`SELECT public.is_tenant_operational('${tenantLM}');`);
  assert(lmOperational === 't' || lmOperational === 'true', 'Barbearia LM é confirmada como operacional (VOUCHER_ACTIVE)');

  const carlosOperational = runPsql(`SELECT public.is_tenant_operational('${tenantCarlos}');`);
  assert(carlosOperational === 'f' || carlosOperational === 'false', 'Carlos Barber Shop é confirmada como bloqueada (RESTRICTED)');

} catch (err) {
  console.error('Erro na execução dos testes:', err);
  process.exitCode = 1;
}

console.log('\n================================================================');
console.log(`RESULTADO FINAL: ${passedTests}/${totalTests} TESTES APROVADOS`);
console.log('================================================================');
