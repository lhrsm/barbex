# BARBEX — R2E.26E.10B
# SECURITY REVIEW E CUTOVER CONTROLADO DO HOTFIX DE CARGOS
## RELATÓRIO OFICIAL DE CUTOVER EM PRODUÇÃO

**Data:** 27 de Outubro de 2026  
**Ambiente:** Produção (https://barbex.shop)  
**Projeto Supabase:** `ywdwrstxvsdqiryhieiz`  
**Commit Publicado:** `63ec76d3`  
**Status da Entrega:** `R2E26E10B_DEPLOYED_AWAITING_FUNCTIONAL_VALIDATION`  

---

## 1. RESULTADO DA REVISÃO DE SEGURANÇA (GATE 0)

A auditoria de segurança pré-cutover validou integralmente os seguintes requisitos arquiteturais:

1. **Parâmetros e Assinatura da RPC:**  
   `public.change_tenant_team_member_role(p_tenant_id uuid, p_target_user_id uuid, p_new_role text)` preservada como `SECURITY DEFINER` e `SET search_path = public, pg_temp`.
2. **Preservação de Proteções da R2E.26E.9:**  
   - Anti-autopromoção (`42501`) ativa no backend.
   - Proteção do proprietário principal (`p_target_user_id = p_tenant_id`) e administradores globais (`super_admin`).
   - Validação e restrição estrita de cargos novos (`barber`, `reception`, `manager`, `financial`, `tenant_admin`).
   - Lock pessimista com `SELECT ... FOR UPDATE` sobre a linha do vínculo em `tenant_memberships`.
   - Bloqueio de privilégio para promoção a `tenant_admin` restrito a donos e superadmins.
3. **Privilégios de Execução (EXECUTE):**  
   Revogado `PUBLIC` / `anon`; concedido exclusivamente a `authenticated` e `service_role`.
4. **Isolamento de Escrita Multi-Tenant:**  
   Eliminada a escrita incorreta em `public.profiles.role` e `public.user_roles`. A tabela `tenant_memberships` foi consolidada como a única fonte canônica de papéis por estabelecimento, evitando colisões com o trigger `protect_role_column()` que bloqueava operadores sem permissão de `super_admin`.
5. **Compatibilidade do UUID v4:**  
   A regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` valida estritamente identificadores canônicos reais do Supabase Auth e PostgreSQL, impedindo passagem de strings sintéticas (`staff-...`, `barber-...`).
6. **Invariância de Dados:**  
   A alteração de cargo não interfere em credenciais de login, senhas, comissões pendentes, histórico de agendamentos ou transações financeiras.

---

## 2. EVIDÊNCIA DA COMPATIBILIDADE DA RPC

A definição instalada em produção foi inspecionada via `pg_get_functiondef`:

- **Verificação de Ausência de Escrita Global:**
  ```sql
  -- Nenhuma instrução "UPDATE public.profiles" no corpo da função.
  -- Nenhuma instrução "UPDATE public.user_roles" no corpo da função.
  ```
- **Atualização Canônica em `tenant_memberships`:**
  ```sql
  UPDATE public.tenant_memberships
  SET 
    role = v_clean_role::app_role,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND user_id = p_target_user_id;
  ```
- **Sincronização de `reception_permissions`:**
  - Se cargo $\neq$ `reception`: permissões desativadas (`is_active = false`).
  - Se cargo $=$ `reception`: upsert com `appointments:manage`, `clients:manage`, `view_all_schedules` e `is_active = true`.
- **Registro de Auditoria:**
  - Inserção atômica em `public.team_role_audit_logs`.

---

## 3. BACKUP PRÉ-CUTOVER E TESTE DE RESTAURAÇÃO (GATE 1)

Executado pelo script [execute_r2e26e10b_precutover_backup.cjs](file:///c:/Antigravity/Barbex/barbex/scripts/execute_r2e26e10b_precutover_backup.cjs):

- **Arquivo de Backup Gerado:** `backups/backup_r2e26e10b_precutover_1793108759569.json`
- **Conteúdo Snapshot:**
  - 6 registros de `tenant_memberships`.
  - 8 registros de `profiles` de equipe.
  - 0 registros de `reception_permissions`.
  - 6 registros de `barber_commissions` pendentes (R$ 125,00).
  - 7 registros de `transactions`.
  - 0 registros de `team_role_audit_logs`.
- **Teste de Restauração em Sandbox:**
  Executada consulta transacional com validação de Foreign Keys e integridade referencial com reversão compulsória (`ROLLBACK`), comprovando consistência estrutural.

---

## 4. MIGRATION APLICADA (GATE 2)

- **Arquivo:** [20261027170000_r2e26e10a_hotfix_role_rpc_profiles_update.sql](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20261027170000_r2e26e10a_hotfix_role_rpc_profiles_update.sql)
- **Tamanho:** 7.111 bytes
- **SHA-256:** `87C2DCC26E214EF66DB77152CF522012AB15F1E1A595D5699536668F18E015B0`
- **Tempo de Execução:** 16.64s
- **Registro de Schema:** Registradas as versões `20261027160000` e `20261027170000` na tabela `supabase_migrations.schema_migrations`.
- **Validação com Rollback:** Simulação da transição `reception` $\rightarrow$ `financial` $\rightarrow$ `reception` sob a autenticação do dono da barbearia executada com sucesso imediato sem disparar `protect_role_column()`.

---

## 5. COMMIT E PUBLICAÇÃO NO REPOSITÓRIO (GATE 3)

- **Hash do Commit:** `63ec76d3`
- **Mensagem:** `fix(team): resolve canonical uuid for team role changes and isolate rpc (R2E.26E.10B)`
- **Branch:** `main` $\rightarrow$ `origin/main`
- **Arquivos Versionados:**
  - [ChangeMemberRoleModal.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/team/ChangeMemberRoleModal.tsx)
  - [dashboard.usuarios.tsx](file:///c:/Antigravity/Barbex/barbex/src/routes/dashboard.usuarios.tsx)
  - [20261027170000_r2e26e10a_hotfix_role_rpc_profiles_update.sql](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20261027170000_r2e26e10a_hotfix_role_rpc_profiles_update.sql)
  - [BARBEX_R2E26E10A_ROLE_CHANGE_UUID_HOTFIX_REPORT.md](file:///c:/Antigravity/Barbex/barbex/BARBEX_R2E26E10A_ROLE_CHANGE_UUID_HOTFIX_REPORT.md)
  - [execute_r2e26e10b_precutover_backup.cjs](file:///c:/Antigravity/Barbex/barbex/scripts/execute_r2e26e10b_precutover_backup.cjs)
  - [execute_r2e26e10b_migration.cjs](file:///c:/Antigravity/Barbex/barbex/scripts/execute_r2e26e10b_migration.cjs)
  - [test_r2e26e10a_hotfix_suite.cjs](file:///c:/Antigravity/Barbex/barbex/scripts/test_r2e26e10a_hotfix_suite.cjs)

---

## 6. DEPLOYMENT EM PRODUÇÃO (GATE 3)

- **Plataforma:** Vercel (Edge & Serverless)
- **Status:** **READY** (HTTP 200)
- **Vercel Ray ID:** `gru1::iad1::h9td5-1793109234401-7fdee6e9d3c6`
- **Bundle Ativo em Produção:** `/assets/dashboard.usuarios-Dj65DNjs.js` (50.111 bytes)
- **Assinaturas Detectadas no Bundle Ativo:**
  - `change_tenant_team_member_role`: Presente.
  - Mensagem de validação de UUID canônico: Presente.
  - Trava de colaborador sem conta ativa de usuário: Presente.

---

## 7. SMOKE TESTS NÃO DESTRUTIVOS (GATE 4)

Executado pelo script [smoke_tests_r2e26e10b.cjs](file:///c:/Antigravity/Barbex/barbex/scripts/smoke_tests_r2e26e10b.cjs):

1. **Carregamento da Rota `/dashboard/usuarios`:** Resposta HTTP 200 OK (`APROVADO`).
2. **Presença dos Elementos de Interface:** Botão Alterar Cargo, Modal, avisos de governança e validação de UUID ativos no client bundle (`APROVADO`).
3. **Rejeição Anônima/Não Autenticada:** Chamadas à RPC sem bearer token rejeitadas com erro `42501` / permissão negada (`APROVADO`).
4. **Rejeição de Sintaxe Sintética:** Chamadas diretas contendo strings com prefixo `"staff-..."` rejeitadas pelo validador do PostgreSQL com erro `22P02` (`APROVADO`).
5. **Transições em Transação com Rollback:**
   - Dono promove colaborador `0cd900ec-...` para `financial` com sucesso (`APROVADO`).
   - Dono reverte colaborador para `reception` com sucesso (`APROVADO`).
   - Tentativa de autopromoção bloqueada com `42501` (`APROVADO`).
   - Tentativa cross-tenant com UUID aleatório bloqueada com `P0002` (`APROVADO`).
   - Rollback compulsório executado com zero mutações no banco (`APROVADO`).

---

## 8. BASELINE ANTES E DEPOIS DO CUTOVER (GATE 5)

| Indicador | Baseline Pré-Cutover | Pós-Cutover (Produção) | Status |
|---|---|---|---|
| `tenant_memberships` total | 6 | 6 | **Preservado** |
| `reception` memberships | 2 | 2 | **Preservado** |
| `financial` memberships | 0 | 0 | **Preservado** |
| `admin` / `tenant_admin` | 4 | 4 | **Preservado** |
| `barber_commissions` pendentes | 6 | 6 | **Preservado** |
| Saldo pendente de comissões | R$ 125,00 | R$ 125,00 | **Preservado** |
| `transactions` total | 7 | 7 | **Preservado** |
| `team_role_audit_logs` | 0 | 0 | **Preservado** |
| `saas_admin_vouchers` | 1 | 1 | **Preservado** |
| `subscriptions` | 1 | 1 | **Preservado** |

> **Nota Crítica de Governança:** Conforme determinação do procedimento, nenhum colaborador de produção teve seu cargo alterado permanentemente nesta etapa de engenharia. Os dados permanecem exatamente no estado original, aguardando validação funcional humana.

---

## 9. ANÁLISE DE RISCOS RESIDUAIS E MITIGAÇÕES

1. **Risco:** Tentativa de alteração de cargo de profissional/barbeiro que ainda não ativou sua conta de acesso (sem `user_id`).
   - **Mitigação:** O frontend detecta a ausência de `canonicalUserId`, desabilita o botão "Confirmar Alteração" e exibe o banner: *"Este colaborador não possui uma conta de usuário ativa (UUID) vinculada ao sistema para alteração de papéis de acesso."*
2. **Risco:** Latência de cache local do navegador para usuários que mantiveram a aba aberta.
   - **Mitigação:** O hash do bundle Vite foi alterado (`dashboard.usuarios-Dj65DNjs.js`). O service worker ou refresh da página força o carregamento imediato da nova versão.
3. **Risco:** Concorrência entre múltiplos administradores.
   - **Mitigação:** A RPC executa `SELECT ... FOR UPDATE` pessimista sobre a linha em `tenant_memberships`.

---

## 10. PENDÊNCIAS DE HOMOLOGAÇÃO HUMANA

Para a validação funcional definitiva com autorização do gestor:

1. Acessar https://barbex.shop/dashboard/usuarios autenticado como proprietário da `Barbearia LM`.
2. Localizar o colaborador com cargo atual `Recepcionista` (`user_id: 0cd900ec-d14a-4647-8229-1387c73c578f`).
3. Clicar no botão **"Alterar Cargo"**.
4. Selecionar o cargo **"Financeiro"** e confirmar.
5. Verificar:
   - Sucesso visual imediato via notificação toast.
   - Atualização do badge para `Financeiro`.
   - Gravação de 1 registro em `team_role_audit_logs`.
   - Acesso do colaborador promovido às rotas `/finances` e `/commissions`.

---

**STATUS FINAL:**  
# `R2E26E10B_DEPLOYED_AWAITING_FUNCTIONAL_VALIDATION`
