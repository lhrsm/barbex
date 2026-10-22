# BARBEX - R2E.26A
## RELATORIO FORENSE: SINCRONIZACAO GLOBAL DE AGENDAMENTOS ENTRE PAINEIS

**Status:** R2E26_A_READY_FOR_AUTHORIZATION
**Data:** 2026-10-22
**Baseline HEAD:** 6ff7def0
**Ambiente:** Producao - https://barbex.shop | Supabase: ywdwrstxvsdqiryhieiz
**Build:** vite v7.3.2 - built in 2m 21s - 0 erros TypeScript

---

## 1. PROBLEMA CONFIRMADO

O usuario acessou o painel da barbearia com perfil RECEPCIONISTA.
Apos criar um agendamento via AppointmentModal ou WalkinModal, o registro nao aparecia automaticamente
na ReceptionQueue - somente apos pressionar F5.

### Causa Raiz

| Componente | Falha identificada |
|---|---|
| AppointmentModal.tsx | Nao invalidava query keys de recepcao (reception-queue, reception-stats) |
| WalkinModal.tsx | Nao possuia queryClient - zero invalidacao apos criacao de walk-in |
| ReceptionQueue.tsx | Sem Supabase Realtime - sem escuta a eventos cross-tab/cross-device |
| reception.index.tsx | Sem listener de evento de janela REFRESH_APPOINTMENTS_DATA |
| use-appointment-status.ts | Invalidacoes ad-hoc isoladas, nao cobriam fila de recepcao |
| use-customer-cancellation.ts | Idem - sem invalidacao de reception-queue/stats |
| AppointmentDetailsModal.tsx | Idem - acoes de status/cancelamento nao sincronizavam recepcao |
| RescheduleWizard.tsx | Sem invalidacao apos reagendamento |

Vetor de falha: As query keys ['reception-queue', tenantId, day, barberId] e ['reception-stats', tenantId, day]
usadas pelo ReceptionQueue eram completamente isoladas das invalidacoes disparadas pelos modais.
Nao havia Realtime nem event listeners de sincronizacao cross-tab.

---

## 2. ARQUIVOS MODIFICADOS (9 arquivos alterados + 1 criado)

Modificados:
  src/components/calendar/AppointmentDetailsModal.tsx
  src/components/calendar/AppointmentModal.tsx
  src/components/calendar/WalkinModal.tsx
  src/components/reception/ReceptionQueue.tsx
  src/components/reschedule/RescheduleWizard.tsx
  src/hooks/use-appointment-status.ts
  src/hooks/use-customer-cancellation.ts
  src/routes/reception.agenda.tsx
  src/routes/reception.index.tsx

Criado (novo):
  src/lib/sync-appointments.ts

---

## 3. IMPLEMENTACAO

### 3.1 src/lib/sync-appointments.ts - Modulo Central de Sincronizacao

Criado como ponto unico de verdade para invalidacao de cache e despacho de eventos.

Exporta:
- APPOINTMENT_QUERY_KEYS: mapa exaustivo de todas as query keys do sistema
  - appointments, calendar, dashboard, reception-queue, reception-stats
  - customer-appointments, finances, barber-appointments
- invalidateAllAppointmentQueries(queryClient, context?): invalida todas as query keys relevantes e despacha:
  - window.dispatchEvent(new Event('REFRESH_APPOINTMENTS_DATA'))
  - window.dispatchEvent(new Event('REFRESH_DASHBOARD_DATA'))

### 3.2 ReceptionQueue.tsx - Canal Realtime

Adicionado useEffect com:
- Canal Supabase reception-realtime-{tenantId} escutando postgres_changes em:
  - Tabela appointments com filtro tenant_id=eq.{tenantId}
  - Tabela appointment_checkins com filtro tenant_id=eq.{tenantId}
- Listener REFRESH_APPOINTMENTS_DATA para sincronizacao cross-tab (mesmo dispositivo)
- refetchOnWindowFocus: true e refetchOnReconnect: true para robustez
- Cleanup correto no unmount: supabase.removeChannel(channel)

Cobertura de cenarios:
| Cenario | Mecanismo |
|---|---|
| Mesma aba/sessao | TanStack Query invalidation |
| Outra aba do mesmo usuario | window.dispatchEvent |
| Outro dispositivo/usuario | Supabase Realtime postgres_changes |
| Reconexao apos queda de rede | refetchOnReconnect: true |
| Foco retornando a janela | refetchOnWindowFocus: true |

### 3.3 Modais e Hooks - Invalidacao Unificada

| Arquivo | Alteracao |
|---|---|
| AppointmentModal.tsx | Importa e chama invalidateAllAppointmentQueries em create/edit |
| WalkinModal.tsx | Adicionado useQueryClient + invalidateAllAppointmentQueries |
| AppointmentDetailsModal.tsx | Substitui invalidacoes ad-hoc por invalidateAllAppointmentQueries |
| RescheduleWizard.tsx | Adicionado useQueryClient + invalidateAllAppointmentQueries |
| use-appointment-status.ts | Centralizado via invalidateAllAppointmentQueries |
| use-customer-cancellation.ts | Centralizado via invalidateAllAppointmentQueries |
| reception.index.tsx | Listener REFRESH_APPOINTMENTS_DATA + onSuccess nos modais |
| reception.agenda.tsx | onSuccess nos modais com invalidateAllAppointmentQueries |

---

## 4. OPERACOES SEM ALTERACAO

| Escopo | Status |
|---|---|
| supabase/functions/stripe-checkout/index.ts | INTOCADO |
| RPC complete_appointment | INTOCADA |
| Integracao Z-API | INTOCADA |
| Migrations de banco | NENHUMA |
| ENABLE_SELF_SERVICE_REFUNDS | false - mantido |
| Fluxo de pagamento PIX/Stripe | INTOCADO |
| Automacao de avaliacao (R2E.25B.1) | INTOCADA |

---

## 5. SUITE DE TESTES - RESULTADO FINAL

Arquivo: tests/r2e26a_cross_panel_sync.test.cjs

BARBEX R2E.26A -- Cross-Panel Sync Test Suite
PASS -- H-sync-module: sync-appointments.ts OK
PASS -- I-ReceptionQueue-Realtime: ReceptionQueue.tsx OK
PASS -- J-WalkinModal: WalkinModal.tsx OK
PASS -- K1-reception.index: reception.index.tsx OK
PASS -- K2-reception.agenda: reception.agenda.tsx OK
PASS -- L-AppointmentModal: AppointmentModal.tsx OK
PASS -- M-RescheduleWizard: RescheduleWizard.tsx OK
PASS -- N-use-appointment-status: use-appointment-status.ts OK
PASS -- O-AppointmentDetailsModal: AppointmentDetailsModal.tsx OK
PASS -- P-use-customer-cancellation: use-customer-cancellation.ts OK
Resultado: 10 PASS | 0 FAIL | 10 total

---

## 6. BUILD DE PRODUCAO

vite v7.3.2 building client environment for production...
built in 2m 21s

0 erros TypeScript. Warnings presentes (inputValidator() deprecated, use client em framer-motion)
sao pre-existentes e nao relacionados as alteracoes do ciclo R2E.26A.

---

## 7. GATES DE SEGURANCA

| Gate | Status |
|---|---|
| Nenhum commit executado | OK |
| Nenhum push executado | OK |
| Nenhum deploy executado | OK |
| Nenhuma migration aplicada em producao | OK |
| Nenhum agendamento real criado | OK |
| Nenhuma mensagem WhatsApp disparada | OK |
| Stripe Live intocado | OK |
| Build sem erros TypeScript | OK |
| Testes 10/10 PASS | OK |

---

## 8. PLANO DE CUTOVER (sujeito a autorizacao)

1. git add - apenas os 10 arquivos modificados + sync-appointments.ts + test suite + este relatorio
2. git commit - mensagem: feat(sync): cross-panel appointment sync with realtime and unified query invalidation (R2E.26A)
3. git push origin main
4. Deploy Vercel - automatico via push (CI/CD existente)
5. Smoke teste pos-deploy:
   - Criar agendamento como recepcionista: verificar aparecimento automatico na fila
   - Concluir atendimento como barbeiro: verificar atualizacao no dashboard
   - Cancelar agendamento como cliente: verificar reflexo no painel admin

---

## 9. ROLLBACK

Caso o comportamento seja regressivo apos o deploy:

git revert HEAD --no-edit
git push origin main

Nao ha migrations de banco - rollback e exclusivamente de codigo frontend.

---

## 10. AUTORIZACAO REQUERIDA

Este relatorio conclui a FASE 8 - GOVERNANCA do ciclo R2E.26A.

Status: R2E26_A_READY_FOR_AUTHORIZATION

Aguarda autorizacao formal para execucao do cutover controlado (Fase 9):
commit -> push -> deploy -> smoke test pos-deploy.
