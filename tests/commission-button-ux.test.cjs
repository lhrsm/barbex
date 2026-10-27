const assert = require('assert');

// 1. Simular função pura canManageCommissionPayouts conforme implementada em permissions.matrix.ts
function canManageCommissionPayouts({
  role,
  membershipRole,
  isOwner,
  hasManagePermission,
}) {
  if (isOwner) return true;
  if (
    membershipRole === "reception" ||
    membershipRole === "receptionist" ||
    membershipRole === "barber" ||
    membershipRole === "professional" ||
    membershipRole === "client" ||
    membershipRole === "customer"
  ) {
    return false;
  }
  if (
    membershipRole === "owner" ||
    membershipRole === "admin" ||
    membershipRole === "tenant_admin" ||
    membershipRole === "financial" ||
    membershipRole === "finance" ||
    membershipRole === "manager"
  ) {
    return true;
  }
  if (
    role === "super_admin" ||
    role === "admin" ||
    role === "tenant_admin" ||
    role === "financial" ||
    role === "finance"
  ) {
    return true;
  }
  if (
    hasManagePermission &&
    role !== "reception" &&
    role !== "receptionist" &&
    role !== "barber" &&
    role !== "professional" &&
    role !== "client" &&
    role !== "customer"
  ) {
    return true;
  }
  return false;
}

// 2. Simular regra de visibilidade do botão no painel de comissões
function computeCanPayBarber({
  canManagePayouts,
  financialError,
  loadingData,
  pendingCount,
  pendingAmount,
}) {
  if (loadingData) return false;
  if (financialError) return false;
  return canManagePayouts && pendingCount > 0 && pendingAmount > 0;
}

// 3. Simular proteção interna do componente PayCommissionDialog
function payCommissionDialogShouldRender({ pendingAmount, pendingCount }) {
  if (!pendingAmount || pendingAmount <= 0) return false;
  if (!pendingCount || pendingCount <= 0) return false;
  return true;
}

console.log('================================================================');
console.log('BARBEX R2E.26E.13D — TESTES DE UX: VISIBILIDADE DO BOTÃO DE PAGAR');
console.log('================================================================\n');

// Test Case 1: Matriz de Autorização por Perfil
console.log('[1/7] Testando matriz de autorização por perfil...');
assert.strictEqual(
  canManageCommissionPayouts({ role: 'admin', isOwner: false }),
  true,
  'Admin deve estar autorizado'
);
assert.strictEqual(
  canManageCommissionPayouts({ role: 'tenant_admin', isOwner: false }),
  true,
  'Tenant Admin deve estar autorizado'
);
assert.strictEqual(
  canManageCommissionPayouts({ role: 'financial', isOwner: false }),
  true,
  'Financeiro deve estar autorizado'
);
assert.strictEqual(
  canManageCommissionPayouts({ isOwner: true }),
  true,
  'Proprietário (owner) deve estar autorizado'
);
assert.strictEqual(
  canManageCommissionPayouts({ role: 'reception', membershipRole: 'reception', isOwner: false }),
  false,
  'Recepção NÃO deve estar autorizada'
);
assert.strictEqual(
  canManageCommissionPayouts({ role: 'barber', membershipRole: 'barber', isOwner: false }),
  false,
  'Barbeiro NÃO deve estar autorizado'
);
assert.strictEqual(
  canManageCommissionPayouts({ role: 'reception', membershipRole: 'reception', hasManagePermission: true, isOwner: false }),
  false,
  'Recepção com hasManagePermission=true NÃO pode contornar a restrição financeira'
);
assert.strictEqual(
  canManageCommissionPayouts({ role: 'barber', membershipRole: 'barber', hasManagePermission: true, isOwner: false }),
  false,
  'Barbeiro com hasManagePermission=true NÃO pode contornar a restrição financeira'
);
assert.strictEqual(
  canManageCommissionPayouts({ membershipRole: 'manager', isOwner: false }),
  true,
  'Manager do tenant deve estar autorizado'
);
assert.strictEqual(
  canManageCommissionPayouts({ role: 'client', isOwner: false }),
  false,
  'Cliente NÃO deve estar autorizado'
);
assert.strictEqual(
  canManageCommissionPayouts({ role: null, isOwner: false }),
  false,
  'Anônimo NÃO deve estar autorizado'
);
console.log('  -> PASS: Matriz de autorização validada rigorosamente.\n');

// Test Case 2: Profissional com comissão pendente positiva (Alex Seles antes da quitação)
console.log('[2/7] Testando Alex Seles com comissão pendente de R$ 25,00...');
const alexBeforePayout = computeCanPayBarber({
  canManagePayouts: true,
  financialError: null,
  loadingData: false,
  pendingCount: 1,
  pendingAmount: 25.00,
});
assert.strictEqual(alexBeforePayout, true, 'Alex Seles com pendência de R$ 25,00 deve exibir botão para usuário autorizado');
assert.strictEqual(
  payCommissionDialogShouldRender({ pendingAmount: 25.00, pendingCount: 1 }),
  true,
  'PayCommissionDialog deve renderizar'
);
console.log('  -> PASS: Botão visível para comissão positiva elegível.\n');

// Test Case 3: Alex Seles pós-quitação (saldo zerado)
console.log('[3/7] Testando Alex Seles pós-quitação (saldo zerado)...');
const alexAfterPayout = computeCanPayBarber({
  canManagePayouts: true,
  financialError: null,
  loadingData: false,
  pendingCount: 0,
  pendingAmount: 0.00,
});
assert.strictEqual(alexAfterPayout, false, 'Alex Seles pós-quitação deve ter o botão OCULTO');
assert.strictEqual(
  payCommissionDialogShouldRender({ pendingAmount: 0.00, pendingCount: 0 }),
  false,
  'PayCommissionDialog deve retornar null'
);
console.log('  -> PASS: Botão oculto quando não há comissões pendentes.\n');

// Test Case 4: Profissional sem comissão (José Bonifacio)
console.log('[4/7] Testando profissional sem comissão (José Bonifacio)...');
const joseBonifacio = computeCanPayBarber({
  canManagePayouts: true,
  financialError: null,
  loadingData: false,
  pendingCount: 0,
  pendingAmount: 0.00,
});
assert.strictEqual(joseBonifacio, false, 'Profissional sem comissão deve ter botão oculto');
console.log('  -> PASS: Botão oculto para profissional sem comissão.\n');

// Test Case 5: Profissional com comissão de valor zero (Louis Menezes - Cortesia)
console.log('[5/7] Testando profissional com comissão de R$ 0,00 (Louis Menezes)...');
const louisMenezes = computeCanPayBarber({
  canManagePayouts: true,
  financialError: null,
  loadingData: false,
  pendingCount: 1,
  pendingAmount: 0.00, // Ajuste / cortesia
});
assert.strictEqual(louisMenezes, false, 'Profissional com valor zero deve ter botão oculto');
assert.strictEqual(
  payCommissionDialogShouldRender({ pendingAmount: 0.00, pendingCount: 1 }),
  false,
  'PayCommissionDialog deve retornar null para valor zero'
);
console.log('  -> PASS: Botão oculto para saldo zero, mesmo existindo item de cortesia.\n');

// Test Case 6: Recepcionista acessando barbeiro com comissão pendente
console.log('[6/7] Testando recepcionista visualizando barbeiro com saldo pendente...');
const receptionView = computeCanPayBarber({
  canManagePayouts: false, // Perfil de recepção sem autorização
  financialError: null,
  loadingData: false,
  pendingCount: 4,
  pendingAmount: 100.00, // Barbeiro Louis
});
assert.strictEqual(receptionView, false, 'Recepcionista NÃO deve ver botão de pagar mesmo com saldo positivo');
console.log('  -> PASS: Botão oculto para perfil não autorizado (fail-closed).\n');

// Test Case 7: Estado de erro de consulta e reaparecimento de nova comissão
console.log('[7/7] Testando estado de erro na consulta e nova comissão futura...');
const errorState = computeCanPayBarber({
  canManagePayouts: true,
  financialError: 'Erro de conexão com o banco',
  loadingData: false,
  pendingCount: 2,
  pendingAmount: 50.00,
});
assert.strictEqual(errorState, false, 'Em caso de erro na consulta, nenhum botão deve estar disponível');

const loadingState = computeCanPayBarber({
  canManagePayouts: true,
  financialError: null,
  loadingData: true,
  pendingCount: 2,
  pendingAmount: 50.00,
});
assert.strictEqual(loadingState, false, 'Durante o carregamento, nenhum botão deve estar disponível');

// Nova comissão criada futuramente
const futureNewCommission = computeCanPayBarber({
  canManagePayouts: true,
  financialError: null,
  loadingData: false,
  pendingCount: 1,
  pendingAmount: 30.00,
});
assert.strictEqual(futureNewCommission, true, 'Ao surgir nova comissão pendente positiva, botão reaparece');
console.log('  -> PASS: Erro/carregamento bloqueia botão e nova comissão reativa botão com sucesso.\n');

console.log('=== TODOS OS TESTES DE UX DO BOTÃO DE PAGAMENTO FORAM APROVADOS (PASS) ===');
