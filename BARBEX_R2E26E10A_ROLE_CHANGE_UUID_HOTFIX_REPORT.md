# BARBEX — R2E.26E.10A
# HOTFIX — ERRO DE UUID NA ALTERAÇÃO DE CARGO
## RELATÓRIO DE INVESTIGAÇÃO, CORREÇÃO E HOMOLOGAÇÃO LOCAL

**Data:** 27 de Outubro de 2026  
**Ambiente Alvo:** Produção (https://barbex.shop)  
**Status da Entrega:** `R2E26E10A_READY_FOR_REVIEW`  

---

## 1. RESUMO EXECUTIVO DO INCIDENTE

Durante a homologação humana pós-cutover da R2E.26E.10 no estabelecimento `Barbearia LM` (`tenant_id: c54ac1ac-49be-4505-b7a4-d257ed023f08`), a tentativa de alterar o cargo de um colaborador de `reception` para `financial` gerou a seguinte exceção no cliente:

```
invalid input syntax for type uuid: "staff-37b9ce7c-cc99-4f12-a150-bc9b6b464ed4"
```

A chamada RPC para `public.change_tenant_team_member_role` foi abortada imediatamente pelo motor PostgreSQL com código de erro `22P02`, impedindo qualquer mutação ou alteração parcial de dados no banco de dados.

---

## 2. INVESTIGAÇÃO DETALHADA E CAUSA RAIZ

### 2.1. Origem do Prefixo `staff-` e Anatomia dos Identificadores Sintéticos
Ao inspecionar [team.ts](file:///c:/Antigravity/Barbex/barbex/src/lib/backend/edge/team.ts#L108-L125), verificou-se que a função `getTeamMembers` consolida colaboradores de diferentes tabelas (`tenant_memberships` e `barbers`) em uma única interface padronizada chamada `UnifiedTeamMember`:

```typescript
// src/lib/backend/edge/team.ts
members.push({
  id: `staff-${mem.id}`,        // <-- Identificador sintético para unicidade visual no DOM/React
  userId: mem.user_id,          // <-- UUID CANÔNICO REAL DO USUÁRIO (auth.users / profiles)
  domainId: mem.id,             // <-- UUID da linha em public.tenant_memberships
  name: profile?.full_name || profile?.email || 'Membro da Equipe',
  role: mem.role || 'staff',
  entityType: 'staff',
  ...
});
```

Para barbeiros, o mesmo padrão é utilizado: `id: \`barber-${barber.id}\``, onde `domainId` aponta para `barbers.id` e `userId` contém o UUID de login do barbeiro (se possuir acesso cadastrado).

### 2.2. Ponto de Falha no Frontend
Ao inspecionar [ChangeMemberRoleModal.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/team/ChangeMemberRoleModal.tsx#L58-L64) antes da correção:

```typescript
// CÓDIGO COM DEFEITO:
await supabase.rpc('change_tenant_team_member_role', {
  p_tenant_id: tenantId,
  p_target_user_id: member.id, // <-- ERRO: Passava "staff-37b9ce7c-..." em vez de member.userId
  p_new_role: newRole,
});
```

A RPC no backend espera o parâmetro `p_target_user_id uuid`. Ao receber a string com o prefixo `"staff-"`, o parser do PostgreSQL rejeitou o tipo `uuid`.

Adicionalmente, nas verificações de segurança no cliente:
- `isSelf = member.id === currentUserId`
- `isOwner = member.id === tenantId`

Essas checagens comparavam `member.id` (string sintética `"staff-..."`) com `user.id` (UUID canônico), resultando sempre em `false` e desabilitando as proteções visuais de anti-autopromoção no client-side (embora garantidas no backend).

### 2.3. Descoberta Secundária de Engenharia no Banco de Dados
Durante a inspeção aprofundada da RPC e dos gatilhos do PostgreSQL:
- A tabela `public.profiles` possui o trigger `protect_role_column()`, que impede qualquer mutação na coluna `profiles.role` a menos que o solicitante (`auth.uid()`) possua `super_admin`:
  ```sql
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT public.is_super_admin() THEN
      IF auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'Only super_admins can change roles.';
      END IF;
    END IF;
  END IF;
  ```
- Na migration original, havia uma tentativa de atualizar `profiles.role` além de `tenant_memberships.role`. Mesmo com o UUID canônico correto, essa operação falharia com `P0001: Only super_admins can change roles.` para proprietários de barbearias que não são superadmins globais.
- Em consonância com a arquitetura aprovada no Gate 1 da R2E.26E.9, **a tabela `tenant_memberships` é a fonte canônica e isolada de autorização por barbearia**. Mutações de perfil de equipe pertencem única e exclusivamente a `tenant_memberships`, sem escrita em `profiles.role` ou `user_roles`.

---

## 3. AUDITORIA DA INTEGRIDADE DO BANCO EM PRODUÇÃO

Foi realizada consulta direta na base de produção para atestar o estado do colaborador envolvido no incidente:

- **ID do Vínculo (`domainId`):** `37b9ce7c-cc99-4f12-a150-bc9b6b464ed4`
- **UUID Canônico (`userId`):** `0cd900ec-d14a-4647-8229-1387c73c578f`
- **Tenant:** `c54ac1ac-49be-4505-b7a4-d257ed023f08` (Barbearia LM)
- **Role Atual em `tenant_memberships`:** `reception`
- **Status:** `active`
- **Auditoria (`team_role_audit_logs`):** 0 registros (nenhuma alteração parcial ou inconsistente)
- **Comissões Pendentes:** 6 registros = R$ 125,00 (100% íntegro)
- **Transações:** 7 registros (100% íntegro)

**Conclusão da Auditoria:** Nenhuma alteração parcial ocorreu; a transação do incidente sofreu rollback atômico pelo PostgreSQL.

---

## 4. IMPLEMENTAÇÃO DA CORREÇÃO

### 4.1. Frontend — [ChangeMemberRoleModal.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/team/ChangeMemberRoleModal.tsx)
1. **Resolução Segura do UUID Canônico:**
   Implementada a função `resolveCanonicalUserId(member)` utilizando validação estrita via regex de UUID v4 (`/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`).
   - Prioriza `member.userId`.
   - Se ausente ou inválido, avalia `member.id` apenas se este for um UUID puro.
   - Rejeita cegamente strings sintéticas prefixadas (`staff-...`, `barber-...`), impedindo remoções ingênuas de prefixo que poderiam apontar para IDs errôneos de outra entidade.
2. **Parâmetro RPC Canônico:**
   O payload de mutação agora envia estritamente `p_target_user_id: canonicalUserId`.
3. **Bloqueio Proativo no Cliente:**
   Se `canonicalUserId` for nulo ou inválido, o modal bloqueia a ação, exibe aviso visual explícito em banner vermelho e desabilita o botão de confirmação.
4. **Correção de Checagens de Autopromoção e Dono:**
   `isSelf` e `isOwner` agora comparam `canonicalUserId === currentUserId` e `canonicalUserId === tenantId`.

### 4.2. Frontend — [dashboard.usuarios.tsx](file:///c:/Antigravity/Barbex/barbex/src/routes/dashboard.usuarios.tsx)
- Corrigida a renderização condicional do botão "Alterar Cargo" em ambas as visualizações (Grid e Tabela).
- Comparação de isolamento alterada de `member.id !== user?.id && member.id !== tenantId` para `member.userId !== user?.id && member.userId !== tenantId`.

### 4.3. Backend/Migration — [20261027170000_r2e26e10a_hotfix_role_rpc_profiles_update.sql](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20261027170000_r2e26e10a_hotfix_role_rpc_profiles_update.sql)
- Preparada migration idempotente que atualiza a função `change_tenant_team_member_role`.
- Remove a tentativa de atualização em `public.profiles.role`, eliminando colisão com o trigger `protect_role_column()` e preservando o isolamento multi-tenant canônico em `tenant_memberships`.
- Arquivo criado localmente sem aplicação no banco de produção, aguardando autorização explícita de cutover.

---

## 5. BATERIA DE TESTES EXECUTADA

### 5.1. Testes de Unidade de Resolução de UUID (Script Local)
Executado via [test_r2e26e10a_hotfix_suite.cjs](file:///c:/Antigravity/Barbex/barbex/scripts/test_r2e26e10a_hotfix_suite.cjs):
- **Staff Sintético (`staff-37b9ce7c-...`):** Resolvido perfeitamente para `0cd900ec-d14a-4647-8229-1387c73c578f` (`PASS`).
- **Barbeiro Sintético (`barber-b99b5030-...`):** Resolvido perfeitamente para `69e0910b-a3f1-4be0-8a37-4f37c544bf6c` (`PASS`).
- **Barbeiro sem conta de usuário (`userId: null`):** Retornou `null`, acionando bloqueio preventivo de UI (`PASS`).

### 5.2. Testes de Transição e Validação no Banco (Transação com ROLLBACK)
Executado em bloco transacional isolado no PostgreSQL de produção com reversão compulsória (`ROLLBACK`):
1. **Rejeição de Sintaxe Sintética:** Chamada com `'staff-37b9ce7c-...'` rejeitada com código `22P02` (`PASS`).
2. **Transição Reception → Financial:** Executada com UUID canônico; retorno `{"success": true, "new_role": "financial"}` e inserção imediata em `team_role_audit_logs` (`PASS`).
3. **Transição Inversa Financial → Reception:** Executada com sucesso; reativação de permissões de recepção e auditoria registrada (`PASS`).
4. **Autopromoção:** Tentativa do dono alterar o próprio cargo bloqueada com código `42501` (`PASS`).
5. **Cross-Tenant:** Tentativa de alterar usuário aleatório/inexistente no tenant bloqueada com código `P0002` (`PASS`).

### 5.3. Testes Pós-Execução de Integridade
Conferência de invariantes após todos os testes:
- `tenant_memberships`: 6 registros.
- `barber_commissions` pendentes: 6 registros (R$ 125,00).
- `transactions`: 7 registros.
- `team_role_audit_logs`: 0 registros.
- **Resultado:** Zero mutação em dados financeiros ou de acesso em produção.

### 5.4. Build Completo do Projeto
- Comando: `npm.cmd run build`
- Resultado: **Sucesso (Exit code: 0)**
- Todos os pacotes compilados (Client, SSR, Nitro) sem erros de TypeScript ou Vite.

---

## 6. MATRIZ DE ARQUIVOS ALTERADOS E CRIADOS

| Arquivo | Tipo | Descrição |
|---|---|---|
| [ChangeMemberRoleModal.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/team/ChangeMemberRoleModal.tsx) | Frontend | Resolução de UUID canônico, envio exclusivo de `member.userId` e banner de bloqueio. |
| [dashboard.usuarios.tsx](file:///c:/Antigravity/Barbex/barbex/src/routes/dashboard.usuarios.tsx) | Frontend | Correção da checagem de isolamento `isSelf` / `isOwner` usando `member.userId`. |
| [20261027170000_r2e26e10a_hotfix_role_rpc_profiles_update.sql](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20261027170000_r2e26e10a_hotfix_role_rpc_profiles_update.sql) | SQL/Migration | Remoção de escrita conflitante em `profiles.role` (preparado localmente). |
| [test_r2e26e10a_hotfix_suite.cjs](file:///c:/Antigravity/Barbex/barbex/scripts/test_r2e26e10a_hotfix_suite.cjs) | Script de Teste | Suíte automatizada de validação de UUID e RPC transacional. |

---

## 7. ANÁLISE DE RISCOS RESIDUAIS E MITIGAÇÕES

1. **Risco Residual:** Barbeiros convidados sem conta de usuário (`userId = null`).
   - **Mitigação:** `resolveCanonicalUserId` retorna `null`, o modal desabilita a confirmação e orienta o administrador a vincular uma conta de acesso prévia.
2. **Risco Residual:** Conflito de concorrência durante a alteração de cargo.
   - **Mitigação:** A RPC executa `SELECT ... FOR UPDATE` pessimista sobre a linha de `tenant_memberships`, garantindo isolamento ACID.
3. **Risco Residual:** Regressão financeira.
   - **Mitigação:** A RPC não toca nas tabelas de comissões (`barber_commissions`) nem de pagamentos (`transactions`).

---

## 8. RECOMENDAÇÃO DE PUBLICAÇÃO

1. As correções de código local encontram-se **prontas, testadas e compiladas**.
2. Nenhuma migration, commit, push ou deploy foi realizado nesta etapa, respeitando integralmente as restrições operacionais.
3. Para o cutover da correção, recomenda-se:
   - Aplicar a migration `20261027170000_r2e26e10a_hotfix_role_rpc_profiles_update.sql` no banco de produção.
   - Realizar commit e push das alterações no frontend para acionar o deploy via Vercel.
   - Realizar teste de fumaça na interface promovendo o colaborador `0cd900ec-d14a-4647-8229-1387c73c578f` para `financial`.

---

**STATUS FINAL:**  
# `R2E26E10A_READY_FOR_REVIEW`
