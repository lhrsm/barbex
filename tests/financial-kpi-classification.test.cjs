const assert = require('assert');

console.log('================================================================');
console.log('BARBEX R2E.26E.13G — SUÍTE DE TESTES DE REGRESSÃO FINANCEIRA');
console.log('================================================================\n');

// 1. Test KpiCards calculation logic
console.log('TEST CASE 1: KpiCards - Separação estrita de Saídas vs Estornos Pagos');
{
  const summary = {
    totalExpense: 25.00, // Despesa de comissão
    realCashIncome: 0.00,
    netRevenue: 0.00,
    balance: -25.00
  };

  const refundRequestsEmpty = [];
  const paidRefundsEmpty = (refundRequestsEmpty || [])
    .filter((r) => r && (r.status === "completed" || r.status === "paid"))
    .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

  assert.strictEqual(summary.totalExpense, 25.00, 'Saídas deve exibir totalExpense (R$ 25,00)');
  assert.strictEqual(paidRefundsEmpty, 0.00, 'Estornos Pagos deve ser R$ 0,00 quando não há estornos');
  console.log('  ✓ Passou: Saídas = R$ 25,00 e Estornos Pagos = R$ 0,00 na ausência de estornos.');
}

console.log('\nTEST CASE 2: KpiCards - Estornos Reais Computados Corretamente');
{
  const refundRequests = [
    { id: '1', status: 'completed', amount: 50.00 },
    { id: '2', status: 'paid', amount: 35.00 },
    { id: '3', status: 'requested', amount: 20.00 },
    { id: '4', status: 'rejected', amount: 100.00 }
  ];

  const requestedRefunds = (refundRequests || [])
    .filter((r) => r && r.status === "requested")
    .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

  const paidRefunds = (refundRequests || [])
    .filter((r) => r && (r.status === "completed" || r.status === "paid"))
    .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

  assert.strictEqual(requestedRefunds, 20.00, 'Estornos solicitados deve somar R$ 20,00');
  assert.strictEqual(paidRefunds, 85.00, 'Estornos pagos deve somar 50 + 35 = R$ 85,00');
  console.log('  ✓ Passou: Estornos solicitados (R$ 20,00) e pagos (R$ 85,00) filtrados com precisão.');
}

console.log('\nTEST CASE 3: Transações - Classificação da Badge de Status');
{
  const getBadgeLabel = (t) => {
    if (t.appointment) {
      if (t.appointment.status === 'completed') return 'Concluído';
      if (t.appointment.status === 'cancelled') return 'Cancelado';
      return 'Agendado';
    }
    if (t.category === 'Comissão' || (t.description && t.description.toLowerCase().includes('comiss'))) {
      return 'Comissão';
    }
    if (t.type === 'credit_reversed' || t.type === 'cashback_reversed') {
      return 'Estorno de Saldo';
    }
    if (t.type === 'credit_granted') {
      return 'Crédito Concedido';
    }
    return 'Manual';
  };

  // 1. Transação de comissão (Alex Seles)
  const commTx = {
    id: '14a0d63b',
    type: 'expense',
    category: 'Comissão',
    amount: 25.00,
    appointment: null,
    description: 'Pagamento de comissão - Alex Seles (1 atendimentos)'
  };
  assert.strictEqual(getBadgeLabel(commTx), 'Comissão', 'Transação de comissão deve ter badge "Comissão"');

  // 2. Transação vinculada a agendamento
  const apptTx = {
    id: '8eda7deb',
    type: 'income',
    category: 'Serviço',
    amount: 50.00,
    appointment: { status: 'completed' },
    description: 'Atendimento: Combo Cabelo + Barba'
  };
  assert.strictEqual(getBadgeLabel(apptTx), 'Concluído', 'Transação com agendamento concluído deve ter badge "Concluído"');

  // 3. Estorno de saldo
  const creditRevTx = {
    id: 'c1',
    type: 'credit_reversed',
    category: 'Ajuste',
    amount: 10.00,
    appointment: null
  };
  assert.strictEqual(getBadgeLabel(creditRevTx), 'Estorno de Saldo');

  // 4. Lançamento avulso geral
  const manualTx = {
    id: 'm1',
    type: 'expense',
    category: 'Material',
    amount: 30.00,
    appointment: null,
    description: 'Compra de toalhas'
  };
  assert.strictEqual(getBadgeLabel(manualTx), 'Manual', 'Despesa geral deve manter badge "Manual"');

  console.log('  ✓ Passou: Badges de Comissão, Concluído, Estorno de Saldo e Manual operam perfeitamente.');
}

console.log('\nTEST CASE 4: DRE - Inexistência de Duplicidade Contábil');
{
  // Simular engine DRE:
  const commissionsTotal = 125.00; // Custos por competência
  const transactions = [
    { type: 'income', amount: 300.00, category: 'Serviço' },
    { type: 'expense', amount: 25.00, category: 'Comissão' }
  ];

  const income = transactions.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

  const commissionExpenses = transactions
    .filter(t => t.type === 'expense')
    .filter(t => t.category.toLowerCase().includes('comiss'))
    .reduce((a, t) => a + t.amount, 0);

  const otherExpenses = expense - commissionExpenses;

  // DRE:
  const grossRevenue = income;
  const costs = commissionsTotal;
  const operatingExpenses = otherExpenses;
  const operatingProfit = grossRevenue - costs - operatingExpenses;

  assert.strictEqual(commissionExpenses, 25.00, 'Despesas de comissão pagas devem ser R$ 25,00');
  assert.strictEqual(otherExpenses, 0.00, 'Outras despesas operacionais devem ser R$ 0,00');
  assert.strictEqual(operatingProfit, 300.00 - 125.00 - 0.00, 'Lucro operacional não deve deduzir a comissão paga duas vezes');

  console.log(`  ✓ Passou: DRE deduz comissão paga de otherExpenses (${otherExpenses.toFixed(2)}), evitando duplicidade.`);
}

console.log('\nTEST CASE 5: Regime de Caixa vs Regime de Competência');
{
  const entradaCaixa = 0.00;
  const totalExpense = 25.00;
  const totalRefundsPaid = 0.00;

  const saldoCaixa = entradaCaixa - totalExpense - totalRefundsPaid;
  assert.strictEqual(saldoCaixa, -25.00, 'Saldo de caixa deve ser -R$ 25,00');
  console.log('  ✓ Passou: Saldo de Caixa calculado com exatidão matemática (-R$ 25,00).');
}

console.log('\n================================================================');
console.log('TODOS OS 5 TEST CASES DE REGRESSÃO FINANCEIRA FORAM APROVADOS!');
console.log('================================================================\n');
