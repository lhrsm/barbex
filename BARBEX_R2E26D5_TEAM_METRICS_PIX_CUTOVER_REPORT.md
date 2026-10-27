# BARBEX — R2E.26D.5
## RELATÓRIO DE CUTOVER CONTROLADO — MÉTRICAS DA EQUIPE E PIX PARA GORJETAS

**Data:** 27/10/2026  
**Commit Publicado:** `048e2f2b` (`feat(team-pix): harden team appointments metrics and barber pix tip security (R2E.26D.5)`)  
**Baseline Git Anterior:** `eb349be8`  
**Migration Aplicada:** `20261027090000_r2e26d4_barber_pix_and_metrics_hardening.sql` (Versão: `20261027090000`)  
**Deployment Vercel:** Ativo e servido (`/assets/barbers-C6KVt0P3.js`) | Status: `200 OK`  
**Ambiente de Produção:** [https://barbex.shop](https://barbex.shop) | Supabase Ref: `ywdwrstxvsdqiryhieiz`  
**Status Final:** `R2E26D5_DEPLOYED_AWAITING_FUNCTIONAL_VALIDATION`  

---

### RESULTADOS POR GATE

#### GATE 0 — VERIFICAÇÃO FINAL OBRIGATÓRIA (APROVADO)
- **Inspeção de Segurança da Função `trg_enforce_barber_update_security()`:**
  - O mecanismo de autorização foi desenhado para **não utilizar parâmetros de sessão ou flags manipuláveis** (como `set_config` / `current_setting`).
  - A permissão para atualizações de campos PIX (`pix_key`, `pix_key_type`, `accepts_tips`) por profissionais é validada de forma inviolável através da inspeção da pilha de chamadas interna do PostgreSQL (`GET DIAGNOSTICS v_call_context = PG_CONTEXT;`).
  - Se um usuário autenticado tentar uma chamada direta via API REST PostgREST (`PATCH /rest/v1/barbers`), `PG_CONTEXT` não contém a função `update_barber_pix_info`, resultando na rejeição imediata com código `42501` (`PERMISSION_DENIED`).
  - Tentativas diretas de alterar colunas administrativas (`commission_rate`, `commission_type`, `commission_fixed_value`, `commission_bonus_value`, `monthly_goal`, `category`, `tenant_id`, `user_id`) são categoricamente bloqueadas pelo trigger para qualquer usuário que não seja administrador do estabelecimento (`NOT can_access_tenant(tenant_id)`).
  - A RPC `update_barber_pix_info` executa com `SECURITY DEFINER`, com `search_path` fixado em `public, pg_temp`, e atualiza estritamente os campos de whitelist após validação e normalização de formato.
  - Atualizações legítimas de perfil do profissional (`name`, `phone`, `email`, `bio`, `avatar_url`, `active`, `specialties`) e operações administrativas continuam funcionando perfeitamente.

#### GATE 1 — PREFLIGHT DE PRODUÇÃO (APROVADO)
- **Sincronismo Git:** HEAD local verificado em `eb349be8`, idêntico a `origin/main` antes do commit, sem alterações concorrentes.
- **Censo de Dados Pré-Cutover:**
  - Barbearias: 4
  - Profissionais: 8
  - Agendamentos: 89
  - Funções de hardening pendentes: 0
  - Triggers pendentes: 0
- **Snapshot e Backup Consistente:**
  - Diretório de backup: `C:\Antigravity\backups\barbex\cutover_r2e26d5_20261027`
  - Tabelas críticas com dump JSON completo e hash SHA-256 gerado:
    - `barbers`: 16.610 bytes | SHA256: `15FACE0F82D25B0D2973A1EB6065F59F09C11DDB523EFC69E53AB577DDC3BF4C`
    - `barbershops`: 2.222 bytes | SHA256: `EA6D6AED70690771A2301A8135DB97DBD3BA9F96C8FF5F02A7523BF8BEDE6930`
    - `appointments`: 279.386 bytes | SHA256: `1E365BD755A5DBB37707CDC27A1B334E17760353C8F7DAB2B3C27E2E49256E78`
  - Procedimento de restauração compatível com Supabase Free documentado.

#### GATE 2 — APLICAÇÃO DA MIGRATION EM PRODUÇÃO (APROVADO)
- **Arquivo Aplicado:** [`docs/migration/sql/r2e26d4_barber_pix_and_metrics_hardening.sql`](file:///c:/Antigravity/Barbex/barbex/docs/migration/sql/r2e26d4_barber_pix_and_metrics_hardening.sql)
- **Objetos Instalados:**
  1. Trigger `trg_barbers_security_enforcement` em `public.barbers` acionando `public.trg_enforce_barber_update_security()`.
  2. RPC segura `public.update_barber_pix_info(uuid, text, text, boolean)` com `SECURITY DEFINER`.
  3. RPC escalável `public.get_team_appointments_summary(uuid)` com `SECURITY DEFINER` e agregação direta no banco.
- **Privilégios:**
  - `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;`
  - `GRANT EXECUTE ON FUNCTION ... TO authenticated, service_role;`
- **Registro de Versão:** Inserido na tabela `supabase_migrations.schema_migrations` com a versão `20261027090000`.

#### GATE 3 — PUBLICAÇÃO DO FRONTEND (APROVADO)
- **Commit Criado:** `048e2f2b`
- **Mensagem:** `feat(team-pix): harden team appointments metrics and barber pix tip security (R2E.26D.5)`
- **Push para GitHub:** Realizado com sucesso (`eb349be8..048e2f2b main -> main`).
- **Deploy Vercel:**
  - Build monitorado via polling direto aos servidores da Vercel.
  - Concluído em ~75 segundos com status `200 OK`.
  - Bundle ativo confirmado: `/assets/barbers-C6KVt0P3.js`.
  - Verificação de runtime: Zero erros no carregamento das rotas `/barbers` e `/reception`.

#### GATE 4 — SMOKE TESTS EM PRODUÇÃO (7/7 APROVADOS)
Executado script automatizado [`scripts/smoke_test_r2e26d5.cjs`](file:///c:/Antigravity/Barbex/barbex/scripts/smoke_test_r2e26d5.cjs) contra a infraestrutura de produção:

| Teste | Descrição | Resultado |
| :--- | :--- | :---: |
| **SMOKE-1** | Verificação de objetos SQL (Trigger e RPCs com SECURITY DEFINER) | ✅ **PASS** |
| **SMOKE-2** | `get_team_appointments_summary` isola tenants (rejeição com 42501) e agrega atendimentos | ✅ **PASS** |
| **SMOKE-3** | Trigger bloqueia adulteração de comissões por barbeiro não-administrador | ✅ **PASS** |
| **SMOKE-4** | `update_barber_pix_info` rejeita CPF/CNPJ com dígitos repetidos/inválidos no servidor | ✅ **PASS** |
| **SMOKE-5** | `update_barber_pix_info` atualiza e normaliza chave PIX válida com reversibilidade | ✅ **PASS** |
| **SMOKE-6** | Vercel serve assets compilados da R2E.26D.5 sem geradores externos de QR code | ✅ **PASS** |
| **SMOKE-7** | Integridade dos componentes `EditProfileDialog` e `TipCard` no bundle de produção | ✅ **PASS** |

---

### INVARIANTES DE PRODUÇÃO PRESERVADOS

- **Stripe Live & Reembolsos:**
  - Arquivo [`supabase/functions/stripe-checkout/index.ts`](file:///c:/Antigravity/Barbex/barbex/supabase/functions/stripe-checkout/index.ts) permanece intocado.
  - `ENABLE_SELF_SERVICE_REFUNDS=false` mantido integralmente.
- **Sistemas Operacionais Críticos:**
  - Z-API e notificações WhatsApp: Intocados.
  - Cron jobs do Supabase / pg_cron: Intocados.
  - Vouchers, Entitlements e Planos: Preservados.
  - Realtime: Preservado.
  - Agendamento da recepção e moderação de avaliações: Preservados.
  - Fluxo financeiro e comissões da barbearia: Intocados.

---

### MATRIZ DE SEGURANÇA EFETIVA PÓS-CUTOVER

| Ação / Endpoint | Ator | Mecanismo de Enforce | Comportamento |
| :--- | :--- | :--- | :--- |
| `PATCH /rest/v1/barbers` (comissão / metas) | Barbeiro | `trg_barbers_security_enforcement` | ❌ Bloqueado (`42501 PERMISSION_DENIED`) |
| `PATCH /rest/v1/barbers` (PIX direto) | Barbeiro | `trg_barbers_security_enforcement` (`PG_CONTEXT`) | ❌ Bloqueado (`42501 PERMISSION_DENIED`) |
| `PATCH /rest/v1/barbers` (dados perfil: bio, nome, tel) | Barbeiro | `trg_barbers_security_enforcement` + RLS | ✅ Permitido |
| `RPC update_barber_pix_info` (PIX próprio) | Barbeiro | Validação server-side + Whitelist | ✅ Validado, normalizado e salvo |
| `RPC update_barber_pix_info` (PIX de outro) | Barbeiro | Checagem de `user_id` / `tenant_id` | ❌ Bloqueado (`PERMISSION_DENIED`) |
| `RPC get_team_appointments_summary` | Admin do Tenant | `can_access_tenant` no servidor | ✅ Métricas agregadas sem truncamento |
| `RPC get_team_appointments_summary` | Outro Tenant / Anônimo | `can_access_tenant` no servidor | ❌ Bloqueado (`42501 PERMISSION_DENIED`) |

---

### PENDÊNCIAS DE HOMOLOGAÇÃO HUMANA

Conforme as diretrizes de governança, **não declaramos a homologação humana concluída automaticamente**. Solicitamos ao usuário que realize a validação funcional nos fluxos abaixo:

1. **Painel da Equipe (`/barbers`):**
   - Acessar o painel administrativo da Barbearia LM e conferir os cartões dos profissionais.
   - Confirmar a exibição separada de **"Atendimentos concluídos"** e **"total registrado (histórico)"**.
   - Conferir se os dados refletem a realidade da equipe sem valores fictícios.
2. **Edição de Perfil e PIX pelo Profissional:**
   - Acessar com a conta do profissional e abrir o modal de edição de perfil.
   - Salvar uma chave PIX e verificar a atualização bem-sucedida.
   - Testar o botão de cópia de chave PIX.
3. **Página Pública de Avaliação / Gorjeta:**
   - Acessar um link de avaliação pendente ou página do profissional (`/$slug/profissional`).
   - Confirmar a exibição clara do nome do profissional beneficiário e o botão de cópia rápida da chave PIX.

---

### STATUS FINAL

```
R2E26D5_DEPLOYED_AWAITING_FUNCTIONAL_VALIDATION
```
*(Deploy e migrações concluídos com sucesso; aguardando validação funcional pelo usuário no navegador).*
