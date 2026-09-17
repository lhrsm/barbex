# BARBEX — PHASE 17C.M6D: TEAM MANAGEMENT & STAFF AUTH EDGE MIGRATION

## 1. Visão Geral e Contexto
A fase **Phase 17C.M6D.1** implementou localmente a migração completa dos fluxos legados de gestão de equipe, convites de membros e autenticação/onboarding de colaboradores (staff) para **Supabase Edge Functions** e **RPCs PostgreSQL Atômicas**.

Todas as implementações foram desenvolvidas em conformidade estrita com o isolamento multi-tenant, segurança de papéis (Role Matrix), idempotência, proteção contra enumeração, atomicidade em nível de banco de dados e compensação automática de erros de terceiros (como envio de e-mails pelo Resend).

---

## 2. Auditoria e Classificação Funcional

| Função Legada | Runtime Legado | Classificação M6D | Destino no Supabase Target |
|---|---|---|---|
| `getTeamMembers` | Nitro / Client | **DIRECT CLIENT + RLS** | Consulta direta via Supabase Client autenticado (RLS garante tenant isolation). |
| `getPendingInvitations` | Nitro / Client | **DIRECT CLIENT + RLS** | Consulta direta via Supabase Client autenticado com filtro de status e tenant. |
| `validateInvitationToken` | Nitro Server Function | **EDGE FUNCTION (Public)** | `team-invitations` (action: `validate`) com rate limit e anti-enumeração. |
| `revokeTeamInvitation` | Nitro Server Function | **EDGE FUNCTION / RPC** | `team-invitations` (action: `revoke`) com validação de admin/owner do tenant. |
| `inviteTeamMember` | Nitro Server Function | **EDGE FUNCTION** | `team-invitations` (action: `invite`) + Resend Mock/API + Rate Limit. |
| `resendTeamInvitation` | Nitro Server Function | **EDGE FUNCTION** | `team-invitations` (action: `resend`) com rotação de token e envio de e-mail. |
| `acceptTeamInvitation` | Nitro Server Function | **EDGE FUNCTION + RPC** | `team-invitations` (action: `accept`) + `public.accept_team_invitation_atomic`. |
| `requestStaffEmailVerification`| Nitro Server Function | **EDGE FUNCTION** | `staff-auth` (action: `request-verification`) com OTP 6 dígitos e Resend. |
| `verifyStaffEmailCode` | Nitro Server Function | **EDGE FUNCTION** | `staff-auth` (action: `verify-code`) com proteção de tentativas (max 5) e hash. |
| `finalizeStaffAuthSetup` | Nitro Server Function | **EDGE FUNCTION + RPC** | `staff-auth` (action: `finalize-setup`) + `public.claim_staff_verification_challenge`. |
| `createReceptionUser` | Nitro Server Function | **EDGE FUNCTION** | `staff-auth` (action: `create-reception`) com concessão controlada de permissões. |
| `listReceptionUsers` | Nitro / Client | **DIRECT CLIENT + RLS** | Consulta direta à tabela `reception_permissions` / `profiles`. |
| `removeReceptionUser` | Nitro / Client | **DIRECT CLIENT + RLS** | Deleção / desativação direta com RLS de tenant admin. |

---

## 3. Arquitetura das Edge Functions

### 3.1 `team-invitations` (`supabase/functions/team-invitations/index.ts`)
- **Actions discriminadas via POST**:
  - `invite`: Cria convite com token criptográfico de 64 caracteres hexadecimais (32 bytes de entropia), expiração em 72h e envio de e-mail transacional.
  - `resend`: Atualiza token, renova prazo de 72h e reenfileira e-mail.
  - `revoke`: Marca status como `revoked` com validação de escopo de tenant.
  - `validate`: Validação pública pré-autenticação, retornando `{ ok: true, valid: boolean, barbershopName, role, email, expiresAt }` sem vazar detalhes internos.
  - `accept`: Aceite público ou autenticado. Cria usuário no GoTrue Admin (se inexistente) e invoca RPC atômica `accept_team_invitation_atomic`.

### 3.2 `staff-auth` (`supabase/functions/staff-auth/index.ts`)
- **Actions discriminadas via POST**:
  - `request-verification`: Gera código numérico OTP de 6 dígitos, grava hash SHA-256 em `verification_challenges` (expiração de 10 minutos) e despacha via Resend.
  - `verify-code`: Valida o hash do código fornecido, incrementa contador de tentativas com bloqueio/deleção defensiva ao atingir 5 tentativas incorretas.
  - `finalize-setup`: Consome o desafio verificado via `claim_staff_verification_challenge`, vincula credenciais no GoTrue Admin, atualiza registro em `barbers`, cria/atualiza `profiles`, vincula `tenant_memberships` e `user_roles`.
  - `create-reception`: Cria colaborador com credenciais e papel fixo de `reception`, configurando permissões padrão em `reception_permissions`.

### 3.3 Módulo Compartilhado de E-mails (`supabase/functions/_shared/resend.ts`)
- **Templates HTML Embutidos**:
  - `internal_user_invitation`: Layout moderno e responsivo com branding Barbex, nome da barbearia, cargo e botão de aceite.
  - `email_verification_code`: Caixa estilizada com código de 6 dígitos e aviso de expiração de 10 minutos.
- **Modo Mock Seguro**:
  - Quando a variável `RESEND_API_KEY` está ausente ou configurada como `mock`, simula o envio com log estruturado sem realizar requisições HTTP externas nem causar erros no fluxo.

---

## 4. Matriz de Autorização (Role Matrix)

| Ação | Papéis Autorizados | Origem do Tenant |
|---|---|---|
| `invite` | `super_admin`, `admin`, `tenant_admin`, `shop_owner` | Token JWT -> Profile do Chamador |
| `resend` | `super_admin`, `admin`, `tenant_admin`, `shop_owner` | Token JWT -> Profile do Chamador |
| `revoke` | `super_admin`, `admin`, `tenant_admin`, `shop_owner` | Token JWT -> Profile do Chamador |
| `validate` | Público (sem autenticação prévia) | Resolvido via `token_hash` do convite |
| `accept` | Público / Usuário Convidado | Resolvido via `token_hash` do convite |
| `request-verification` | Colaborador / Público (iniciado pelo fluxo de login) | Resolvido via `barber_id` e `tenant_id` |
| `verify-code` | Colaborador / Público | Resolvido via `barber_id` e e-mail |
| `finalize-setup` | Colaborador / Público com desafio verificado | Resolvido via `barber_id` e `tenant_id` |
| `create-reception` | `super_admin`, `admin`, `tenant_admin`, `shop_owner` | Token JWT -> Profile do Chamador |

---

## 5. Migrações e RPCs Atômicas

Arquivo de migração preparado: `supabase/migrations/20260904140000_phase17c_m6d_team_staff_atomic.sql`

### 5.1 `public.accept_team_invitation_atomic`
- **Assinatura**: `accept_team_invitation_atomic(p_token text, p_user_id uuid, p_phone text DEFAULT NULL) RETURNS jsonb`
- **Comportamento**:
  - Executa row lock (`FOR UPDATE`) no registro de `user_invitations`.
  - Valida atomicamente expiração e unicidade de consumo.
  - Realiza upsert seguro em `tenant_memberships` preservando privilégios prévios.
  - Atualiza `profiles` com tratamento defensivo contra colisões no índice único de telefone (`unique_violation` catch).
  - Garante inserção em `user_roles`.
  - Atualiza status do convite para `accepted` com timestamp e `accepted_by`.
  - Permissões: `SECURITY DEFINER`, `search_path = public, pg_temp`, `REVOKE FROM PUBLIC`, `GRANT TO service_role`.

### 5.2 `public.claim_staff_verification_challenge`
- **Assinatura**: `claim_staff_verification_challenge(p_barber_id uuid, p_email text, p_max_attempts integer DEFAULT 5) RETURNS TABLE(claimed boolean, challenge_id uuid)`
- **Comportamento**:
  - Executa claim atômico via subquery `FOR UPDATE`, marcando `consumed_at = clock_timestamp()` somente se o desafio foi verificado, não expirou e não ultrapassou o limite de tentativas.
  - Permissões: `SECURITY DEFINER`, `search_path = public, pg_temp`, `REVOKE FROM PUBLIC`, `GRANT TO service_role`.

---

## 6. Compensação e Atomicidade de Efeitos Colaterais

1. **Falha de Envio de E-mail no Convite (`invite`)**:
   - O registro recém-inserido em `user_invitations` é deletado defensivamente caso a API do Resend retorne erro.
2. **Falha de Envio de E-mail no Reenvio (`resend`)**:
   - Caso o disparo falhe, o token anterior e seu timestamp de expiração são restaurados no banco de dados.
3. **Falha no Banco após Criação de GoTrue User (`accept` / `finalize-setup`)**:
   - Caso uma nova conta de Auth tenha sido criada na execução atual e a transação subsequente falhe, o usuário órfão é deletado imediatamente do GoTrue (`admin.deleteUser`).

---

## 7. Status do Gatilho `handle_new_user`

- **Estado Atual no Target**: Inativo / Deferido.
- **Necessário para Edge M6D**: NÃO. As Edge Functions realizam o provisionamento e vinculação de perfis (`profiles`, `user_roles`, `tenant_memberships`) de forma explícita, determinística e controlada.
- **Fase Recomendada para Reativação**: Fase de cutover final (M6H / M7) sob validação controlada.

---

## 8. Verificação de Qualidade e Segurança

- **Testes Unitários e de Integração**: 120/120 testes passaram com 100% de sucesso (`scratch/test_m6d_team_staff_edge.mjs`).
- **Verificação de Segredos**: 0 chaves de API, senhas ou tokens gravados em código fonte.
- **Diferenças Git**: `git diff --check` validado sem inconsistências.
- **Estado de Produção**: Inalterado.
