# BARBEX — R2E.25B
## RELATÓRIO DE AUDITORIA FORENSE DA AUTOMAÇÃO DE AVALIAÇÃO PÓS-ATENDIMENTO

**Ambiente de Produção:** `https://barbex.shop`  
**Supabase Target:** `ywdwrstxvsdqiryhieiz`  
**Tenant de Referência:** Barbearia LM (`c54ac1ac-49be-4505-b7a4-d257ed023f08`)  
**Data da Auditoria:** 21/10/2026  
**Status do Ciclo:** `R2E25_B_READY_FOR_AUTHORIZATION`

---

## 1. SUMÁRIO EXECUTIVO

A auditoria forense da automação de avaliação pós-atendimento confirmou a causa exata pela qual as mensagens de agradecimento imediato são entregues normalmente pelo WhatsApp, enquanto os pedidos de avaliação pós-atendimento (agendados com atraso de 15 minutos) não eram recebidos pelos clientes da Barbearia LM.

**Diagnóstico Categórico:**
- **Evento emitido?** SIM. A conclusão do atendimento emite o evento `appointment.completed` com total integridade.
- **Mensagem enfileirada?** SIM. Ambas as mensagens são gravadas no banco:
  1. Agradecimento (`appointment.completed.customer`) com envio imediato (`scheduled_for = null`).
  2. Avaliação (`appointment.completed.review.customer`) com atraso de 15 minutos (`scheduled_for = created_at + 15m`).
- **Mensagem imediata entregue?** SIM. Despachada via Z-API no mesmo segundo pelo acionamento síncrono da conclusão (`status = 'success'`).
- **Mensagem de avaliação entregue?** NÃO. Permaneceu com `status = 'pending'`, `attempts = 0`.
- **Causa Raiz Comprovada:** Ausência de agendador periódico (`pg_cron`) ativo na instância de produção `ywdwrstxvsdqiryhieiz` para drenar a tabela `public.automation_queue`. No momento da conclusão do atendimento, a mensagem de avaliação é ignorada pelo despachante síncrono porque seu horário previsto (`scheduled_for`) está 15 minutos no futuro. Quando os 15 minutos transcorrem, nenhum processo desperta para processar as mensagens vencidas da fila.
- **Integração Z-API:** 100% operacional. Nenhuma alteração foi realizada ou necessária na integração WhatsApp.
- **RPC `complete_appointment`:** 100% íntegra. Não houve regressão no backend financeiro.

---

## 2. ARQUITETURA REAL DA AUTOMAÇÃO DE AVALIAÇÃO

O rastreamento de ponta a ponta do pipeline de avaliação revelou a seguinte cadeia de execução:

```
[Conclusão do Atendimento / Pagamento no Frontend]
                     │
                     ▼
       use-appointment-status.ts
                     │
                     ▼
       emitAutomationEvent('appointment.completed')
                     │
                     ▼
  [Edge Function: emit-automation-event]
   ├── 1. Gera registro em appointment_reviews (token UUID)
   ├── 2. Constrói review_link: https://barbex.shop/review/{token}
   ├── 3. Enfileira em public.automation_queue:
   │      ├─ appointment.completed.customer (scheduled_for = null)
   │      └─ appointment.completed.review.customer (scheduled_for = now + 15 min)
   └── 4. Dispara kick síncrono: process-automation-queue
                     │
                     ▼
  [Edge Function: process-automation-queue]
   ├── Filtra: scheduled_for IS NULL OR scheduled_for <= NOW()
   ├── Processa e envia IMEDIATAMENTE o agradecimento via Z-API
   └── IGNORA a avaliação (pois now + 15m <= now é FALSO)
                     │
                     ▼
       [15 minutos se passam...]
                     │
                     ▼
   ❌ NENHUM WORKER / CRON EXECUTAVA process-automation-queue!
   (Mensagem permanecia eternamente como 'pending' com attempts = 0)
```

### Componentes Mapeados:
1. **Configuração da Automação:** Tabela `public.automation_templates` (`key = 'appointment.completed.review.customer'`, `trigger_event = 'appointment.completed'`). Confirmado ativo para a Barbearia LM (`id = 28935447-926f-4229-87a3-5c7fe9b7f575`).
2. **Evento Disparador:** `appointment.completed` disparado após pagamento/conclusão na RPC `complete_appointment`.
3. **Atraso Configurado:** 15 minutos (`15 * 60 * 1000 ms`), codificado em `supabase/functions/emit-automation-event/index.ts:517-519`.
4. **Fila de Persistência:** Tabela `public.automation_queue`.
5. **Geração do Link:** Tabela `public.appointment_reviews` com token UUID persistido em `payload.review_link = 'https://barbex.shop/review/{token}'`.
6. **Despachante:** Edge Function `process-automation-queue` via biblioteca `sendAutomationMessageV2` e Z-API.
7. **Agendador Periódico (Faltante em Produção):** Invocação recorrente de `run-automations-cron` via extensão `pg_cron`.

---

## 3. EVIDÊNCIAS DE ATENDIMENTOS CONCLUÍDOS (PRODUÇÃO)

Inspeção forense direta na base de produção `ywdwrstxvsdqiryhieiz` para a **Barbearia LM** (`c54ac1ac-49be-4505-b7a4-d257ed023f08`) em 21/10/2026:

### Atendimento 1:
- **ID Agendamento:** `74e5d212-92d1-4a34-b938-3f4994a1311b`
- **Horário Conclusão:** 21/10/2026 às 13:27:14 UTC (10:27 BRT)
- **Mensagem Imediata (Agradecimento):** Queue ID `45c10603-c34b-45ec-8deb-3af567117fcd` (`scheduled_for = null`). Status: `success` às 13:27:15 UTC (~1.1s após conclusão).
- **Mensagem Atrasada (Avaliação):** Queue ID `fb242b9d-38b7-4f7b-98ec-b07f7e05876d`.
  - `workflow_key`: `appointment.completed.review.customer`
  - `created_at`: 21/10/2026 13:27:14.465 UTC
  - `scheduled_for`: 21/10/2026 13:42:14.389 UTC (Exatos 15 minutos após conclusão)
  - `review_link`: `https://barbex.shop/review/a045403f-7ea9-4f85-b4c0-7edd491dc2ff`
  - `status`: **`pending`**
  - `attempts`: **`0`**
  - `error_message`: `null`

### Atendimento 2:
- **ID Agendamento:** `750bd917-c7ae-4a8c-94f1-33abf8fb0407`
- **Horário Conclusão:** 21/10/2026 às 13:27:28 UTC (10:27 BRT)
- **Mensagem Imediata (Agradecimento):** Enviada com sucesso imediato via Z-API.
- **Mensagem Atrasada (Avaliação):** Queue ID `8b6a051d-16f8-4f8b-97da-08b86edfb9d4`.
  - `created_at`: 21/10/2026 13:27:28.609 UTC
  - `scheduled_for`: 21/10/2026 13:42:28.545 UTC (Exatos 15 minutos após conclusão)
  - `review_link`: `https://barbex.shop/review/a837f232-ae30-4237-91f6-d3e51d68bccd`
  - `status`: **`pending`**
  - `attempts`: **`0`**
  - `error_message`: `null`

### Atendimento 3:
- **ID Agendamento:** `4b1d2586-4359-4a21-af73-487b50f1b1e6`
- **Horário Conclusão:** 21/10/2026 às 14:33:50 UTC (11:33 BRT)
- **Mensagem Imediata (Agradecimento):** Enviada com sucesso imediato via Z-API.
- **Mensagem Atrasada (Avaliação):** Queue ID `cd4cab18-19f9-4d88-ab95-583acb31b298`.
  - `created_at`: 21/10/2026 14:33:50.707 UTC
  - `scheduled_for`: 21/10/2026 14:48:50.669 UTC (Exatos 15 minutos após conclusão)
  - `review_link`: `https://barbex.shop/review/7db98f98-9465-4603-b328-ff1c58c5ac7e`
  - `status`: **`pending`**
  - `attempts`: **`0`**
  - `error_message`: `null`

*(Nota: Telefones e dados pessoais foram normalizados/omitidos para conformidade com a FASE 3).*

---

## 4. AUDITORIA DE CRON E FILA

A inspeção da infraestrutura de agendamento revelou:

1. **Consulta à tabela `cron.job` em produção:**
   - Apenas 1 job registrado: `jobid = 1`, `jobname = 'dunning-hourly-scheduler'`, schedule `'0 * * * *'`, rodando de hora em hora exclusivamente para notificações de inadimplência (`{"queue": "dunning"}`).
   - **Nenhum job de polling da fila de automações (`automation_queue`) estava registrado.**
2. **Consulta aos logs de execução `cron.job_run_details`:**
   - A extensão `pg_cron` e o módulo `pg_net` estão perfeitamente funcionais em `ywdwrstxvsdqiryhieiz`, executando o job de dunning a cada hora com status `succeeded` (última execução às 14:00 UTC).
3. **Consulta aos segredos do Supabase Vault (`vault.decrypted_secrets`):**
   - O segredo `cron_worker_secret` está provisionado no Vault e sincronizado com os secrets das Edge Functions (`CRON_WORKER_SECRET`).
4. **Configuração de Gateway de Edge Functions (`supabase/config.toml`):**
   - A função `run-automations-cron` não constava em `config.toml`, operando sob a diretiva default `verify_jwt = true`, o que bloqueava eventuais chamadas diretas não autenticadas pelo gateway de API.

---

## 5. CORREÇÃO CONTROLADA IMPLEMENTADA (LOCAL)

Para restaurar o ciclo automático com o mínimo de alterações necessárias, preservando a segurança e o isolamento multi-tenant:

### 1. `supabase/config.toml`
Adicionada a declaração explícita de `verify_jwt = false` para a função `run-automations-cron`, permitindo que o `pg_net` acione o endpoint sem JWT de usuário:
```toml
[functions.run-automations-cron]
verify_jwt = false
```

### 2. `supabase/functions/run-automations-cron/index.ts`
Implementada proteção fail-closed de autenticação serviço-a-serviço (idêntica ao padrão de segurança estabelecido em `cron-worker`):
```ts
// Fail-closed Service-to-Service Authentication
const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
const cronSecretHeader = req.headers.get("x-cron-secret") || req.headers.get("x-internal-secret");
const configuredCronSecret = Deno.env.get("CRON_WORKER_SECRET") || Deno.env.get("CRON_SECRET");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

let isAuthorized = false;
if (authHeader.startsWith("Bearer ") && serviceRoleKey && authHeader.slice(7).trim() === serviceRoleKey) {
  isAuthorized = true;
} else if (configuredCronSecret && cronSecretHeader === configuredCronSecret) {
  isAuthorized = true;
} else if (configuredCronSecret && authHeader.startsWith("Bearer ") && authHeader.slice(7).trim() === configuredCronSecret) {
  isAuthorized = true;
}

if (!isAuthorized) {
  return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### 3. Nova Migration: `supabase/migrations/20261021153000_r2e25b_schedule_automation_queue_cron.sql`
Registra no `pg_cron` a execução a cada 2 minutos (`*/2 * * * *`) chamando `run-automations-cron` via `pg_net` com autenticação segura pelo Vault:
```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automation-queue-scheduler-2min') THEN
      PERFORM cron.unschedule('automation-queue-scheduler-2min');
    END IF;

    PERFORM cron.schedule(
      'automation-queue-scheduler-2min',
      '*/2 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/run-automations-cron',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_worker_secret' LIMIT 1)
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
```

---

## 6. SUÍTE DE TESTES E HOMOLOGAÇÃO LOCAL

Foi construída e executada a suíte `tests/r2e25b_post_service_review.test.cjs`:

```
================================================================
BARBEX R2E.25B — SUÍTE DE TESTES FORENSES DA AUTOMAÇÃO DE AVALIAÇÃO
================================================================

  [PASS] 1. Delay calculation: review is +15m, thank-you is immediate (null)
  [PASS] 2. Process queue filter logic: ignores future jobs, claims past/due jobs
  [PASS] 3. Review token and review_link formatting
  [PASS] 4. Deduplication logic prevents duplicate dispatch if already in automation_logs
  [PASS] 5. Inactive template filter: skips inactive automation templates
  [PASS] 6. Missing phone numbers are skipped gracefully without crashing worker
  [PASS] 7. Multi-tenant isolation: queue items strictly preserve tenant_id
  [PASS] 8. Fail-closed Service-to-Service auth for run-automations-cron
  [PASS] 9. complete_appointment RPC preserves required state for automation pipeline

================================================================
RESULTADO FINAL DOS TESTES: 9/9 PASSARAM (100%)
================================================================
```

---

## 7. ARQUIVOS MODIFICADOS E PRESERVADOS

### Modificados Localmente:
1. `supabase/config.toml` (registro de `[functions.run-automations-cron] verify_jwt = false`)
2. `supabase/functions/run-automations-cron/index.ts` (autenticação `x-cron-secret` fail-closed)
3. `supabase/migrations/20261021153000_r2e25b_schedule_automation_queue_cron.sql` (agendamento pg_cron a cada 2 minutos)
4. `tests/r2e25b_post_service_review.test.cjs` (testes automatizados)

### Arquivo Protegido:
- `supabase/functions/stripe-checkout/index.ts` — **100% PRESERVADO (ZERO MODIFICAÇÕES)**.

---

## 8. DECISÃO SOBRE MENSAGENS PENDENTES EXISTENTES

Existem exatamente 3 itens pendentes de avaliação para a Barbearia LM gerados hoje (concluídos entre 10:27 e 11:33 BRT).

- **Opção A (Recomendada):** Permitir o despacho automático das 3 mensagens assim que o agendador for publicado. Como os atendimentos ocorreram há menos de 2 horas, os clientes ainda estão no ciclo natural do atendimento e a solicitação de avaliação é legítima e útil.
- **Opção B:** Atualizar manualmente o status das 3 mensagens antigas para `'skipped'` antes da ativação do cron, processando apenas os atendimentos concluídos a partir do momento da publicação.

Essa decisão deve ser formalizada pelo usuário na aprovação do cutover.

---

## 9. PLANO DE PUBLICAÇÃO CONTROLADA (CUTOVER R2E.25B.1)

1. **Deploy da Edge Function:** Publicar a Edge Function atualizada `run-automations-cron`:
   ```bash
   npx supabase functions deploy run-automations-cron --project-ref ywdwrstxvsdqiryhieiz --no-verify-jwt
   ```
2. **Aplicação da Migration de Agendamento:**
   Executar a migration `20261021153000_r2e25b_schedule_automation_queue_cron.sql` no banco de produção.
3. **Validação Operacional Pós-Cutover:**
   - Verificar `cron.job` para confirmar presença de `automation-queue-scheduler-2min`.
   - Monitorar `cron.job_run_details` após 2 a 4 minutos para confirmar execução com status `succeeded`.
   - Monitorar `public.automation_queue` confirmando transição das mensagens elegíveis de `pending` para `success`.

---

## 10. STATUS FINAL

```
================================================================
STATUS: R2E25_B_READY_FOR_AUTHORIZATION
================================================================
```
Causa raiz identificada e comprovada por evidências forenses; correção local mínima implementada; integridade de outros sistemas garantida; aguardando autorização para publicação em produção.
