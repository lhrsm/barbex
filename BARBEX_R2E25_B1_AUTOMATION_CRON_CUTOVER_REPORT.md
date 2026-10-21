# BARBEX — R2E.25B.1
## RELATÓRIO DE CUTOVER CONTROLADO — AUTOMAÇÃO DE AVALIAÇÃO PÓS-ATENDIMENTO

**Ambiente de Produção:** `https://barbex.shop`  
**Supabase Target:** `ywdwrstxvsdqiryhieiz`  
**Barbearia de Referência:** Barbearia LM (`c54ac1ac-49be-4505-b7a4-d257ed023f08`)  
**Data e Hora do Cutover:** 21/10/2026 às 12:36 BRT (15:36 UTC)  
**Baseline Anterior:** `bf47fd3e`  
**Commit de Cutover:** `70e929a9`  
**Status Final:** `R2E25_B1_DEPLOYED_AWAITING_FUNCTIONAL_VALIDATION`

---

## 1. PREFLIGHT E BASELINE

O preflight obrigatório confirmou a conformidade absoluta do ambiente antes de qualquer mutação:
- **Git HEAD e origin/main:** Sincronizados no baseline `bf47fd3e` (contendo o ciclo R2E.25A.1 e commit de dashboard responsivo `e6bd3e93`).
- **Arquivos Protegidos:** `supabase/functions/stripe-checkout/index.ts` 100% íntegro (zero modificações).
- **Crons Existentes:** Identificado o jobid 1 (`dunning-hourly-scheduler`), que foi integralmente preservado sem sobreposição ou alteração de cronograma.
- **Segredos:** Confirmada a presença de `cron_worker_secret` no Supabase Vault (`vault.decrypted_secrets`) e `CRON_WORKER_SECRET` nos segredos das Edge Functions.

---

## 2. CENSO GLOBAL DA FILA (PRÉ-CUTOVER)

A execução do censo de leitura em `public.automation_queue` antes da ativação do agendador revelou:
- **Total de registros na tabela:** 14
- **Mensagens com `status = 'success'`:** 11 (4 confirmações para clientes, 4 para barbeiros e 3 agradecimentos imediatos pós-conclusão).
- **Mensagens com `status = 'pending'`:** Exatamente 3.
- **Distribuição por Tenant:** 100% dos registros pendentes pertenciam à Barbearia LM (`c54ac1ac-49be-4505-b7a4-d257ed023f08`).
- **Outros Tenants com pendências:** 0 registros (`rows: []`).
- **Workflow dos registros pendentes:** `appointment.completed.review.customer`.
- **Tentativas anteriores:** `attempts = 0` para todos os 3 registros.
- **Auditoria de logs anteriores:** A tabela `public.automation_logs` confirmou que o template de avaliação (`id = 5e4d0029-4dbf-46dc-a544-9ee3267ab513`) **jamais havia sido enviado** para os 3 agendamentos, atestando a elegibilidade absoluta para o despacho autorizado.

---

## 3. PROTEÇÃO CONTRA REPROCESSAMENTO GLOBAL (FASES 3 E 6)

Em atendimento às diretrizes da FASE 3 e FASE 6, a Edge Function `process-automation-queue` foi protegida com:

1. **Isolamento Retroativo por Timestamp e Allowlist:**
   ```ts
   const CUTOVER_TIMESTAMP = "2026-10-21T15:20:00.000Z";
   const AUTHORIZED_RETRO_QUEUE_IDS = new Set([
     "fb242b9d-38b7-4f7b-98ec-b07f7e05876d",
     "8b6a051d-16f8-4f8b-97da-08b86edfb9d4",
     "cd4cab18-19f9-4d88-ab95-583acb31b298",
   ]);
   ```
   - **Categoria A (Autorizada):** Os 3 IDs autorizados da LM foram explicitamente permitidos.
   - **Categoria B (Futura Global):** Qualquer atendimento concluído após o cutover (`created_at >= CUTOVER_TIMESTAMP`) é elegível e processado normalmente para qualquer barbearia.
   - **Categoria C (Retroativa Não Autorizada):** Mensagens antigas anteriores ao cutover de outras barbearias são descartadas do ciclo sem exclusão ou mutação de dados.
2. **Lock Atômico de Concorrência:**
   Antes de processar os itens, o worker realiza o update atômico para `status = 'processing'`:
   ```ts
   const { data: lockedRows } = await supabase
     .from("automation_queue")
     .update({ status: "processing", updated_at: new Date().toISOString() })
     .in("id", realItemIds)
     .in("status", ["pending", "failed"])
     .select("id");
   ```
   Se duas execuções do cron rodarem em paralelo, apenas a primeira obtém a posse das linhas, eliminando o risco de duplicidade de mensagens no WhatsApp.

---

## 4. SEGURANÇA DA EDGE FUNCTION `run-automations-cron`

- **Diretiva de Gateway:** Em `supabase/config.toml`, configurado `verify_jwt = false`.
- **Autenticação Própria Fail-Closed:** A função valida obrigatoriamente o header `x-cron-secret` contra a variável de ambiente `CRON_WORKER_SECRET` (ou `CRON_SECRET`).
- **Validação em Produção (Probe Pré-Ativação):**
  - Invocação sem segredo: Retornou **HTTP 401 Unauthorized** (`{"success":false,"error":"Unauthorized"}`).
  - Invocação com segredo incorreto: Retornou **HTTP 401 Unauthorized** (`{"success":false,"error":"Unauthorized"}`).
- **Credenciais em Código/Logs:** Nenhuma credencial foi exposta em código ou logs.

---

## 5. MIGRATION E AGENDADOR PG_CRON

Aplicada a migration `supabase/migrations/20261021153000_r2e25b_schedule_automation_queue_cron.sql`.

**Estado do `cron.job` após a aplicação:**
| Job ID | Job Name | Schedule | Active | Target / Comando |
| :---: | :--- | :---: | :---: | :--- |
| **1** | `dunning-hourly-scheduler` | `0 * * * *` | `true` | Invocação de `cron-worker` para inadimplência via Vault (Preservado) |
| **2** | `automation-queue-scheduler-2min` | `*/2 * * * *` | `true` | Invocação de `run-automations-cron` com `x-cron-secret` via Vault |

Total de jobs no banco: **Exatamente 2**. Zero conflitos.

---

## 6. RESULTADO INDIVIDUAL DOS TRÊS QUEUE IDS AUTORIZADOS

Após a publicação e o primeiro ciclo de execução do cron, os 3 registros foram processados e entregues com sucesso comprovado via Z-API:

### 1. Queue ID: `fb242b9d-38b7-4f7b-98ec-b07f7e05876d`
- **Agendamento:** `74e5d212-92d1-4a34-b938-3f4994a1311b` (Louis Menezes)
- **Horário do Processamento:** `2026-10-21 15:34:03.932 UTC` (12:34 BRT)
- **Status Anterior:** `pending` (`attempts = 0`)
- **Status Final:** **`success`** (`attempts = 1`, `error_message = null`)
- **Review Link:** `https://barbex.shop/review/a045403f-7ea9-4f85-b4c0-7edd491dc2ff`
- **Log ID:** `3289c735-1f1e-4f22-808a-c417ff333abb` (`status = 'sent'`)
- **Mensagem Formatada Entregue:**
  > "Olá Louis Menezes! ⭐\n\nComo foi seu atendimento na *Barbearia LM*?\n\nSua opinião ajuda a melhorar nossa experiência.\n\nAvaliar atendimento:\nhttps://barbex.shop/review/a045403f-7ea9-4f85-b4c0-7edd491dc2ff\n\nObrigado! 🤝"

### 2. Queue ID: `8b6a051d-16f8-4f8b-97da-08b86edfb9d4`
- **Agendamento:** `750bd917-c7ae-4a8c-94f1-33abf8fb0407` (Carlos Menezes)
- **Horário do Processamento:** `2026-10-21 15:34:06.284 UTC` (12:34 BRT)
- **Status Anterior:** `pending` (`attempts = 0`)
- **Status Final:** **`success`** (`attempts = 1`, `error_message = null`)
- **Review Link:** `https://barbex.shop/review/a837f232-ae30-4237-91f6-d3e51d68bccd`
- **Log ID:** `2a2df6ba-b673-4598-bc8d-112d86c49995` (`status = 'sent'`)
- **Mensagem Formatada Entregue:**
  > "Olá Carlos Menezes! ⭐\n\nComo foi seu atendimento na *Barbearia LM*?\n\nSua opinião ajuda a melhorar nossa experiência.\n\nAvaliar atendimento:\nhttps://barbex.shop/review/a837f232-ae30-4237-91f6-d3e51d68bccd\n\nObrigado! 🤝"

### 3. Queue ID: `cd4cab18-19f9-4d88-ab95-583acb31b298`
- **Agendamento:** `4b1d2586-4359-4a21-af73-487b50f1b1e6` (Louis Menezes)
- **Horário do Processamento:** `2026-10-21 15:34:06.954 UTC` (12:34 BRT)
- **Status Anterior:** `pending` (`attempts = 0`)
- **Status Final:** **`success`** (`attempts = 1`, `error_message = null`)
- **Review Link:** `https://barbex.shop/review/7db98f98-9465-4603-b328-ff1c58c5ac7e`
- **Log ID:** `e5ed0ec6-1752-42d1-ac9e-b009a2fab01c` (`status = 'sent'`)
- **Mensagem Formatada Entregue:**
  > "Olá Louis Menezes! ⭐\n\nComo foi seu atendimento na *Barbearia LM*?\n\nSua opinião ajuda a melhorar nossa experiência.\n\nAvaliar atendimento:\nhttps://barbex.shop/review/7db98f98-9465-4603-b328-ff1c58c5ac7e\n\nObrigado! 🤝"

---

## 7. EXECUÇÕES SUBSEQUENTES E AUSÊNCIA DE DUPLICIDADE

A consulta à tabela `cron.job_run_details` confirmou a cadência periódica de 2 minutos do novo cron:
- **Run ID 455 (15:34:00 UTC):** Status `succeeded`. Drenou os 3 itens autorizados que estavam vencidos.
- **Run ID 456 (15:36:00 UTC):** Status `succeeded`. Verificou a fila, encontrou 0 mensagens pendentes e finalizou com zero erros e **zero reenvios ou mensagens duplicadas**.

---

## 8. RISCOS RESIDUAIS E PLANO DE ROLLBACK

- **Riscos Residuais:** Mínimos. A Edge Function só aceita requisições autenticadas por segredo do Vault, a fila possui lock atômico de status `'processing'` e deduplicação em `automation_logs`.
- **Plano de Rollback Instantâneo (se necessário):**
  Para pausar imediatamente o polling do cron sem afetar o resto da plataforma:
  ```sql
  SELECT cron.unschedule('automation-queue-scheduler-2min');
  ```

---

## 9. PENDÊNCIAS DE HOMOLOGAÇÃO FUNCIONAL (FASE 10)

Conforme orientação do usuário, não foram concluídos atendimentos artificiais durante o cutover.
A confirmação definitiva de ponta a ponta ocorrerá no próximo atendimento concluído naturalmente na Barbearia LM:
1. Conclusão do atendimento pelo operador.
2. Recebimento imediato do agradecimento no WhatsApp.
3. Transcurso do intervalo de 15 minutos.
4. Recebimento automático da mensagem de avaliação com link `https://barbex.shop/review/{token}`.

---

## 10. STATUS FINAL

```
================================================================
STATUS: R2E25_B1_DEPLOYED_AWAITING_FUNCTIONAL_VALIDATION
================================================================
```
Agendador publicado com sucesso; autenticação e concorrência validadas em produção; os 3 envios autorizados foram concluídos com sucesso e sem duplicidades; aguardando a validação funcional no próximo atendimento real.
