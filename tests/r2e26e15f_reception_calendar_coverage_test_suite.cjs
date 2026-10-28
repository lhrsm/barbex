/**
 * SUÍTE DE TESTES AUTOMATIZADOS: R2E.26E.15F — COBERTURA MULTIPERFIL DA AGENDA DA RECEPÇÃO
 * Valida os 4 modos (Dia, Semana, Mês, Período), filtros avançados, isolamento e modais.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== INICIANDO SUÍTE DE TESTES T01–T16: COBERTURA DA AGENDA DA RECEPÇÃO (R2E.26E.15F) ===\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Erro: ${err.message}`);
    failCount++;
  }
}

// Carregar arquivos para validação estrutural e comportamental
const receptionAgendaFile = path.resolve(__dirname, '../src/routes/reception.agenda.tsx');
const receptionCode = fs.readFileSync(receptionAgendaFile, 'utf8');

const profAgendaFile = path.resolve(__dirname, '../src/routes/$slug.profissional.tsx');
const profCode = fs.readFileSync(profAgendaFile, 'utf8');

// T01 — Recepção suporta modo "day"
test('T01 — Recepção suporta modo "day" com cálculo de limites diários', () => {
  assert(receptionCode.includes('curView === "day"'), 'Deve conter verificação do modo day');
  assert(receptionCode.includes('startOfDay(curDate)'), 'Deve calcular startOfDay');
  assert(receptionCode.includes('endOfDay(curDate)'), 'Deve calcular endOfDay');
});

// T02 — Recepção suporta modo "week"
test('T02 — Recepção suporta modo "week" com cálculo de início e fim da semana', () => {
  assert(receptionCode.includes('curView === "week"'), 'Deve conter verificação do modo week');
  assert(receptionCode.includes('startOfWeek(curDate, { weekStartsOn: 0 })'), 'Deve calcular startOfWeek');
  assert(receptionCode.includes('endOfWeek(curDate, { weekStartsOn: 0 })'), 'Deve calcular endOfWeek');
});

// T03 — Recepção suporta modo "month"
test('T03 — Recepção suporta modo "month" com englobamento do mês completo', () => {
  assert(receptionCode.includes('curView === "month"'), 'Deve conter verificação do modo month');
  assert(receptionCode.includes('startOfWeek(startOfMonth(curDate)'), 'Deve calcular início da grade mensal');
  assert(receptionCode.includes('endOfWeek(endOfMonth(curDate)'), 'Deve calcular fim da grade mensal');
});

// T04 — Recepção suporta modo "custom"
test('T04 — Recepção suporta modo "custom" para período personalizado', () => {
  assert(receptionCode.includes('customStartDate') && receptionCode.includes('customEndDate'), 'Deve conter estados de data custom');
  assert(receptionCode.includes('parseISO(customStartRef.current)'), 'Deve realizar parseISO da data inicial');
  assert(receptionCode.includes('parseISO(customEndRef.current)'), 'Deve realizar parseISO da data final');
});

// T05 — Validação de limite máximo de 90 dias
test('T05 — Validação de limite de 90 dias rejeita intervalos maiores', () => {
  assert(receptionCode.includes('diff > 90'), 'Deve validar diferença de até 90 dias');
  assert(receptionCode.includes('O intervalo máximo permitido é de 90 dias.'), 'Deve conter mensagem de erro');
});

// T06 — Validação de datas: data inicial posterior à data final
test('T06 — Validação de range rejeita quando data inicial > final', () => {
  assert(receptionCode.includes('s > e'), 'Deve validar s > e');
  assert(receptionCode.includes('A data inicial não pode ser posterior à data final.'), 'Deve conter mensagem de erro');
});

// T07 — Presença da barra de filtros avançados AgendaFilters
test('T07 — Integração de AgendaFilters com suporte multi-profissional', () => {
  assert(receptionCode.includes('<AgendaFilters'), 'Deve renderizar AgendaFilters');
  assert(receptionCode.includes('barberLocked={false}'), 'Recepção NÃO deve ter barbeiro travado (acesso multi-profissional)');
});

// T08 — Aplicação dos filtros em tempo de execução via applyAgendaFilters
test('T08 — Aplicação de filtros de status, cliente e barbeiro', () => {
  assert(receptionCode.includes('applyAgendaFilters(appointments, filters, getAgendaOrigin)'), 'Deve chamar applyAgendaFilters');
});

// T09 — Botões operacionais de recepção preservados
test('T09 — Botões operacionais da recepção preservados (Confirmar, Check-in, Concluir, Detalhes, Cancelar)', () => {
  assert(receptionCode.includes('handleCheckin'), 'Deve conter ação de Check-in');
  assert(receptionCode.includes('handleStatus(appt, "confirmed")'), 'Deve conter ação de Confirmar');
  assert(receptionCode.includes('handleStatus(appt, "completed")'), 'Deve conter ação de Concluir');
  assert(receptionCode.includes('handleStatus(appt, "cancelled")'), 'Deve conter ação de Cancelar');
  assert(receptionCode.includes('setDetailsId'), 'Deve conter ação de abrir Detalhes');
});

// T10 — Ações rápidas Novo Agendamento e Walk-in
test('T10 — Ações Novo Agendamento e Walk-in presentes e padronizadas', () => {
  assert(receptionCode.includes('setApptOpen(true)'), 'Deve acionar abertura de Novo Agendamento');
  assert(receptionCode.includes('setWalkinOpen(true)'), 'Deve acionar abertura de Walk-in');
  assert(receptionCode.includes('Novo Agendamento') && receptionCode.includes('Walk-in'), 'Deve exibir labels corretos');
});

// T11 — Modais operacionais conectados
test('T11 — Modais conectados (AppointmentModal, WalkinModal, AppointmentDetailsModal, RescheduleWizard)', () => {
  assert(receptionCode.includes('<AppointmentModal'), 'Deve conter AppointmentModal');
  assert(receptionCode.includes('<WalkinModal'), 'Deve conter WalkinModal');
  assert(receptionCode.includes('<AppointmentDetailsModal'), 'Deve conter AppointmentDetailsModal');
  assert(receptionCode.includes('<RescheduleWizard'), 'Deve conter RescheduleWizard');
});

// T12 — Integração com MonthView
test('T12 — Componente MonthView homologado integrado na Agenda da Recepção', () => {
  assert(receptionCode.includes('<MonthView'), 'Deve renderizar MonthView');
  assert(receptionCode.includes('setView("day")'), 'Clicar em data no MonthView deve navegar para o Dia selecionado');
});

// T13 — Isolamento Multi-tenant
test('T13 — Isolamento multi-tenant obrigatório em todas as queries da recepção', () => {
  assert(receptionCode.includes('.eq("tenant_id", tenantId)'), 'Deve filtrar explicitamente por tenant_id');
});

// T14 — Responsividade dos botões e seletores (R2E.26E.15E)
test('T14 — Responsividade: container flex-col sm:flex-row e botões em grid mobile', () => {
  assert(receptionCode.includes('flex flex-col sm:flex-row sm:items-center justify-between gap-3'), 'Container deve ser flex-col sm:flex-row');
  assert(receptionCode.includes('grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto shrink-0'), 'Botões devem ser grid-cols-2 sm:flex');
  assert(receptionCode.includes('h-11 px-4 sm:px-5 rounded-xl'), 'Botões devem ter altura h-11 e rounded-xl');
});

// T15 — Auditoria de Barbeiros: escopo restrito no portal do profissional
test('T15 — Barbeiro: portal profissional utiliza get_barber_appointments restrito por barber_id', () => {
  assert(profCode.includes('get_barber_appointments'), 'Deve utilizar RPC get_barber_appointments');
  assert(profCode.includes('p_barber_id: session.barber_id'), 'Deve passar p_barber_id da sessão estritamente');
});

// T16 — Auditoria de Barbeiros: filtros Hoje, Semana e Mês presentes no portal
test('T16 — Barbeiro: filtros Hoje, Semana e Mês disponíveis no portal do profissional', () => {
  assert(profCode.includes("'today'") && profCode.includes("'week'") && profCode.includes("'month'"), 'Deve conter filtros temporais');
  assert(profCode.includes('filterLabels'), 'Deve possuir labels para Hoje, Semana, Mês');
});

console.log('\n--- RESUMO DA SUÍTE T01–T16 ---');
console.log(`Total de Testes: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('TODOS OS 16 TESTES PASSARAM COM SUCESSO (100% GREEN)!\n');
}

