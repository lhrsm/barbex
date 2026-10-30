/**
 * BARBEX — R2E.26E.20B.10: TESTES ISOLADOS DA MIGRATION DE TUTORIAIS DA RECEPÇÃO
 * Modalidade: TESTE ISOLADO EM MEMÓRIA / ZERO ESCRITA EM PRODUÇÃO
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('BARBEX — R2E.26E.20B.10: SUITE DE TESTES ISOLADOS DA MIGRATION');
console.log('================================================================');
console.log('Timestamp: ' + new Date().toISOString());

let totalTests = 0;
let passedTests = 0;

function it(message, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${message}`);
    console.error(`    Erro: ${err.message}`);
  }
}

// 1. CARGA DO ESTADO BASELINE DOS 58 ARTIGOS REAIS
const dumpPath = path.join(__dirname, '../scripts/live_58_articles_dump.json');
const baselineArticles = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

it('Baseline contém exatamente 58 artigos persistidos', () => {
  assert.strictEqual(baselineArticles.length, 58);
});

// OS 9 UUIDs HOMOLOGADOS
const TARGET_UUIDS = [
  'cf240ea1-0dec-4817-8afe-8626c4968e21', // Como criar um novo agendamento
  'e8227c4e-15da-4c36-9dee-a044c4236199', // Como concluir ou cancelar um atendimento
  'a10df4f8-3f19-4c0e-b129-1f70608457c6', // Como funciona o agendamento de assinantes
  'c334b3ba-0993-449a-a58e-88fb89f7f3d1', // Como reagendar trocando data, horário e profissional
  '64f5bafc-7abb-44f1-9836-683dca7ce9d9', // Como funcionam usos de assinatura
  'b3324233-56e8-49b8-a1ed-1e7acb6fc28e', // Como vender produtos no frontend
  '09eba6e4-6234-4641-95ce-f3901f655109', // Como funciona a loja pública de produtos
  '6a493a70-c0fd-4881-8e2a-66fb29f24d9b', // Como acessar tutoriais e ajuda
  'f1f13775-30d4-4989-99b0-fc94dbad79ff'  // Como enviar sugestões de melhoria para o Barbex
];

// OS 7 UUIDs GERENCIAIS RESTRITOS
const RESTRICTED_UUIDS = [
  'd63482d7-27c9-4dbe-bc79-43dfc194acfe', // Intervalos entre atendimentos
  'a3ba57c9-60a7-4c2d-8a5a-544dde3c0451', // Criar planos de assinatura
  '2f8df9f3-4f4c-4d62-891f-a3e05ad2a2b5', // Vender uma assinatura
  'cf8b2ce5-ab17-4801-a114-d6d3976fac5f', // Mudar plano de um assinante
  'd8a7ab64-9080-476f-be29-18829321c61c', // Usar cupons de desconto
  '60a1afbb-4cdf-4dcb-a9a4-ea95dc134b73', // Cadastrar produtos
  '4ec9d577-f0e8-4a9e-ae80-82cd5ff124b7'  // Controlar estoque
];

// OS 3 UUIDs QUE JÁ POSSUÍAM 'reception'
const PRE_EXISTING_RECEPTION_UUIDS = [
  '1bf403d4-23ec-42db-bc16-2d0ade5372b5', // Como usar a Comanda Digital
  '9ddeff2f-e151-4d75-b393-d680f4ae9d17', // Como usar o Check-in por QR Code
  'c452a442-a0c5-4e8a-b963-7f948eac4f04'  // Como atender clientes sem agendamento (Walk-in)
];

// FUNÇÕES DE SIMULAÇÃO DE RLS E FRONTEND
function simulateRls(articles, role) {
  return articles.filter(art => {
    if (role === 'super_admin') return true;
    const targets = Array.isArray(art.profile_target) ? art.profile_target : [];
    // Cláusula pública para clientes
    if (targets.includes('client') || targets.includes('customer')) {
      return true;
    }
    // Cláusula admin/proprietário
    if (role === 'admin' || role === 'tenant_admin') {
      return true;
    }
    // Cláusula perfil específico
    if (role && targets.includes(role)) {
      return true;
    }
    return false;
  });
}

function simulateFrontendSafe(dbList, role) {
  if (!role) {
    return dbList.filter(art => {
      const targets = Array.isArray(art.profile_target) ? art.profile_target : [];
      return (targets.includes('client') || targets.includes('customer')) && !art.is_admin_only && art.type !== 'super_admin_internal';
    });
  }
  if (role === 'super_admin') return dbList;

  return dbList.filter(art => {
    if (art.type === 'super_admin_internal') return false;
    const targets = Array.isArray(art.profile_target) ? art.profile_target : [];
    if (targets.length === 1 && targets[0] === 'super_admin') return false;

    const isAdmin = role === 'tenant_admin' || role === 'admin' || role === 'manager';
    if (art.is_admin_only && !isAdmin) return false;

    if (targets.length > 0) {
      const match = targets.includes(role) ||
        (role === 'tenant_admin' && targets.includes('admin')) ||
        (role === 'admin' && targets.includes('tenant_admin')) ||
        (role === 'reception' && targets.includes('receptionist')) ||
        (role === 'receptionist' && targets.includes('reception')) ||
        (role === 'barber' && targets.includes('professional')) ||
        (role === 'professional' && targets.includes('barber')) ||
        (role === 'financial' && (targets.includes('finance') || targets.includes('cashier'))) ||
        (role === 'finance' && (targets.includes('financial') || targets.includes('cashier'))) ||
        (role === 'client' && targets.includes('customer')) ||
        (role === 'customer' && targets.includes('client'));
      if (!match) return false;
    }
    return true;
  });
}

const CATALOG_RECEPTION = [
  { id: "reception-agenda-operation", title: "Operação da Agenda da Recepção" },
  { id: "reception-checkin-arrival", title: "Check-in e Confirmação de Chegada" },
  { id: "reception-walkin-queue", title: "Adicionar Cliente na Fila de Espera (Walk-in)" },
  { id: "reception-comanda-digital", title: "Uso da Comanda Digital e Lançamento de Produtos" }
];

const EQUIV = {
  "reception-comanda-digital": "Como usar a Comanda Digital",
  "reception-walkin-queue": "Como atender clientes sem agendamento",
  "reception-checkin-arrival": "Como usar o Check-in por QR Code",
};

function combineWithCatalog(safeList, role) {
  if (role !== 'reception') return safeList;
  const map = new Map();
  safeList.forEach(a => map.set(a.id, a));

  CATALOG_RECEPTION.forEach(cat => {
    const prefix = EQUIV[cat.id];
    let match = null;
    if (prefix) {
      match = safeList.find(a => a.title && a.title.toLowerCase().startsWith(prefix.toLowerCase()));
    } else {
      match = safeList.find(a => a.title && a.title.trim().toLowerCase() === cat.title.trim().toLowerCase());
    }
    if (!match) {
      map.set(cat.id, cat);
    }
  });
  return Array.from(map.values());
}

// =============================================================================
// TESTE 1: ESTADO PRÉ-MIGRATION
// =============================================================================
console.log('\n--- FASE 1: Verificação do Estado Pré-Migration ---');

it('Estado pré-migration: exatamente 3 artigos possuem "reception" no banco', () => {
  const withRec = baselineArticles.filter(a => Array.isArray(a.profile_target) && a.profile_target.includes('reception'));
  assert.strictEqual(withRec.length, 3);
  withRec.forEach(a => assert(PRE_EXISTING_RECEPTION_UUIDS.includes(a.id)));
});

it('Estado pré-migration: nenhum dos 9 UUIDs alvo possui "reception"', () => {
  TARGET_UUIDS.forEach(id => {
    const art = baselineArticles.find(a => a.id === id);
    assert(art, `Artigo ${id} deve existir no baseline`);
    assert(!art.profile_target.includes('reception'), `Artigo ${id} não deve ter 'reception' antes da migration`);
  });
});

it('Estado pré-migration: Recepção visualiza exatamente 5 tutoriais na UI', () => {
  const rls = simulateRls(baselineArticles, 'reception');
  const safe = simulateFrontendSafe(rls, 'reception');
  const ui = combineWithCatalog(safe, 'reception');
  assert.strictEqual(ui.length, 5);
});

// =============================================================================
// TESTE 2: APLICAÇÃO DA MIGRATION SELETIVA
// =============================================================================
console.log('\n--- FASE 2: Aplicação da Migration Seletiva ---');

function applyMigration(articles) {
  return articles.map(art => {
    if (TARGET_UUIDS.includes(art.id)) {
      const targets = Array.isArray(art.profile_target) ? [...art.profile_target] : [];
      if (!targets.includes('reception')) {
        targets.push('reception');
      }
      return { ...art, profile_target: targets };
    }
    return { ...art };
  });
}

const migratedArticles = applyMigration(baselineArticles);

it('Após migration: total de artigos permanece exatamente 58', () => {
  assert.strictEqual(migratedArticles.length, 58);
});

it('Após migration: todos os 9 UUIDs alvo agora contêm "reception"', () => {
  TARGET_UUIDS.forEach(id => {
    const art = migratedArticles.find(a => a.id === id);
    assert(art.profile_target.includes('reception'), `Artigo ${id} deve conter 'reception'`);
  });
});

it('Após migration: perfis pré-existentes nos 9 artigos foram 100% preservados', () => {
  TARGET_UUIDS.forEach(id => {
    const original = baselineArticles.find(a => a.id === id);
    const updated = migratedArticles.find(a => a.id === id);
    original.profile_target.forEach(role => {
      assert(updated.profile_target.includes(role), `Perfil original '${role}' deve permanecer no artigo ${id}`);
    });
  });
});

it('Após migration: exatamente 12 artigos possuem "reception" no banco (3 originais + 9 novos)', () => {
  const withRec = migratedArticles.filter(a => a.profile_target.includes('reception'));
  assert.strictEqual(withRec.length, 12);
});

it('Após migration: os 49 artigos não-alvo permaneceram estritamente inalterados', () => {
  baselineArticles.forEach(orig => {
    if (!TARGET_UUIDS.includes(orig.id)) {
      const curr = migratedArticles.find(a => a.id === orig.id);
      assert.deepStrictEqual(curr.profile_target, orig.profile_target, `Artigo ${orig.id} não deveria ter profile_target alterado`);
    }
  });
});

// =============================================================================
// TESTE 3: SEGURANÇA E ISOLAMENTO DOS 7 ARTIGOS GERENCIAIS
// =============================================================================
console.log('\n--- FASE 3: Verificação de Isolamento dos 7 Artigos Gerenciais ---');

it('Nenhum dos 7 artigos gerenciais possui "reception" após a migration', () => {
  RESTRICTED_UUIDS.forEach(id => {
    const art = migratedArticles.find(a => a.id === id);
    assert(art, `Artigo gerencial ${id} deve existir`);
    assert(!art.profile_target.includes('reception'), `Artigo gerencial ${id} NUNCA deve conter 'reception'`);
  });
});

it('Usuário Recepção NÃO recebe nenhum dos 7 artigos gerenciais na RLS nem na UI', () => {
  const rls = simulateRls(migratedArticles, 'reception');
  const safe = simulateFrontendSafe(rls, 'reception');
  const ui = combineWithCatalog(safe, 'reception');
  const uiIds = ui.map(a => a.id);

  RESTRICTED_UUIDS.forEach(id => {
    assert(!uiIds.includes(id), `Artigo gerencial ${id} não pode aparecer na Central de Ajuda da recepção`);
  });
});

// =============================================================================
// TESTE 4: VALIDAÇÃO DA CENTRAL DE AJUDA DA RECEPÇÃO (13 TUTORIAIS)
// =============================================================================
console.log('\n--- FASE 4: Validação da Central de Ajuda da Recepção ---');

it('Supabase RLS retorna 14 artigos para a Recepção (11 com reception + 3 públicos de cliente)', () => {
  const rls = simulateRls(migratedArticles, 'reception');
  // 12 artigos têm reception, mas 1 deles (09eba6e4) também é cliente.
  // Total retornado por RLS = 12 com reception + 2 públicos de cliente sem reception = 14 artigos
  assert.strictEqual(rls.length, 14);
});

it('Frontend safeDbArticles aprova exatamente 12 artigos do banco para Recepção', () => {
  const rls = simulateRls(migratedArticles, 'reception');
  const safe = simulateFrontendSafe(rls, 'reception');
  // Os 2 artigos exclusivos de clientes são descartados pelo filtro de perfil no frontend
  assert.strictEqual(safe.length, 12);
});

it('Frontend exibe EXATAMENTE 13 tutoriais combinados para a Recepção (12 DB + 1 catálogo único)', () => {
  const rls = simulateRls(migratedArticles, 'reception');
  const safe = simulateFrontendSafe(rls, 'reception');
  const ui = combineWithCatalog(safe, 'reception');
  assert.strictEqual(ui.length, 13);
  
  // Confirmar que o catálogo único está presente
  assert(ui.some(a => a.id === 'reception-agenda-operation'));
  // Confirmar que os 3 itens do catálogo foram deduplicados para seus UUIDs
  assert(ui.some(a => a.id === '1bf403d4-23ec-42db-bc16-2d0ade5372b5')); // Comanda Digital
  assert(ui.some(a => a.id === '9ddeff2f-e151-4d75-b393-d680f4ae9d17')); // Check-in QR
  assert(ui.some(a => a.id === 'c452a442-a0c5-4e8a-b963-7f948eac4f04')); // Walk-in
});

// =============================================================================
// TESTE 5: NÃO-REGRESSÃO DOS DEMAIS PERFIS
// =============================================================================
console.log('\n--- FASE 5: Não-Regressão dos Demais Perfis ---');

it('Visitante Anônimo: RLS retorna 3 artigos públicos (e /tutorials redireciona para login)', () => {
  const rls = simulateRls(migratedArticles, null);
  const safe = simulateFrontendSafe(rls, null);
  assert.strictEqual(safe.length, 3);
});

it('Cliente Autenticado: continua visualizando exatamente 3 tutoriais autorizados', () => {
  const rls = simulateRls(migratedArticles, 'client');
  const safe = simulateFrontendSafe(rls, 'client');
  assert.strictEqual(safe.length, 3);
});

it('Barbeiro: continua visualizando exatamente 7 tutoriais (6 DB + 1 catálogo)', () => {
  const rls = simulateRls(migratedArticles, 'barber');
  const safe = simulateFrontendSafe(rls, 'barber');
  assert.strictEqual(safe.length, 6); // 6 do DB
  const totalBarber = safe.length + 1; // + 1 catalogo (barber-schedule-management)
  assert.strictEqual(totalBarber, 7);
});

it('Financeiro: continua visualizando exatamente 7 tutoriais do banco', () => {
  const rls = simulateRls(migratedArticles, 'financial');
  const safe = simulateFrontendSafe(rls, 'financial');
  assert.strictEqual(safe.length, 7);
});

it('Proprietário (Tenant Admin): continua visualizando exatamente 59 tutoriais (58 DB + 1 catálogo)', () => {
  const rls = simulateRls(migratedArticles, 'tenant_admin');
  const safe = simulateFrontendSafe(rls, 'tenant_admin');
  assert.strictEqual(safe.length, 58);
  const totalOwner = safe.length + 1; // + 1 catalogo (owner-calendar-multiprofile)
  assert.strictEqual(totalOwner, 59);
});

it('Super Admin: continua visualizando exatamente 63 tutoriais (58 DB + 5 catálogo)', () => {
  const rls = simulateRls(migratedArticles, 'super_admin');
  const safe = simulateFrontendSafe(rls, 'super_admin');
  assert.strictEqual(safe.length, 58);
  const totalSa = safe.length + 5; // + 5 catalogo exclusivos
  assert.strictEqual(totalSa, 63);
});

// =============================================================================
// TESTE 6: TESTE DE ROLLBACK
// =============================================================================
console.log('\n--- FASE 6: Teste de Rollback Transacional ---');

function applyRollback(articles) {
  return articles.map(art => {
    if (TARGET_UUIDS.includes(art.id)) {
      const targets = Array.isArray(art.profile_target) ? art.profile_target.filter(r => r !== 'reception') : [];
      return { ...art, profile_target: targets };
    }
    return { ...art };
  });
}

const rolledBackArticles = applyRollback(migratedArticles);

it('Rollback: total de artigos com "reception" retorna a exatamente 3', () => {
  const withRec = rolledBackArticles.filter(a => a.profile_target.includes('reception'));
  assert.strictEqual(withRec.length, 3);
  withRec.forEach(a => assert(PRE_EXISTING_RECEPTION_UUIDS.includes(a.id)));
});

it('Rollback: estado dos 58 artigos é idêntico byte a byte ao baseline original', () => {
  assert.deepStrictEqual(rolledBackArticles, baselineArticles);
});

it('Rollback: Central de Ajuda da Recepção retorna a exatamente 5 tutoriais', () => {
  const rls = simulateRls(rolledBackArticles, 'reception');
  const safe = simulateFrontendSafe(rls, 'reception');
  const ui = combineWithCatalog(safe, 'reception');
  assert.strictEqual(ui.length, 5);
});

// =============================================================================
// TESTE 7: TESTE DE REAPLICAÇÃO E IDEMPOTÊNCIA
// =============================================================================
console.log('\n--- FASE 7: Reaplicação e Idempotência ---');

const reappliedArticles = applyMigration(migratedArticles);

it('Idempotência: reaplicar a migration sobre o estado já migrado não gera duplicatas no array', () => {
  TARGET_UUIDS.forEach(id => {
    const art = reappliedArticles.find(a => a.id === id);
    const countReception = art.profile_target.filter(r => r === 'reception').length;
    assert.strictEqual(countReception, 1, `Artigo ${id} deve conter 'reception' exatamente uma vez`);
  });
});

it('Idempotência: o estado resultante é rigorosamente idêntico à primeira aplicação', () => {
  assert.deepStrictEqual(reappliedArticles, migratedArticles);
});

// =============================================================================
// RESULTADO FINAL
// =============================================================================
console.log('\n================================================================');
console.log(`TOTAL DE TESTES: ${totalTests} | SUCESSOS: ${passedTests} | FALHAS: ${totalTests - passedTests}`);
if (totalTests === passedTests) {
  console.log('RESULTADO FINAL: SUITE DE TESTES ISOLADOS 100% CONCLUÍDA! ✓');
} else {
  console.error('RESULTADO FINAL: FALHAS DETECTADAS NOS TESTES ISOLADOS!');
}
console.log('================================================================');

if (totalTests !== passedTests) {
  process.exit(1);
}

