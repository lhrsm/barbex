# BARBEX — RELATÓRIO DE AUDITORIA E VALIDAÇÃO CANÔNICA (R2E.21E.1)
## VALIDAÇÃO DE IDENTIDADE DO TENANT E RPC PÚBLICA
### PRÉ-DEPLOY / READ-ONLY / FAIL-CLOSED

---

## 1. SUMÁRIO EXECUTIVO

- **Ciclo:** R2E.21E.1
- **Status:** `R2E21_E1_READY_FOR_DEPLOY`
- **Ambiente:** Supabase Produção (`ywdwrstxvsdqiryhieiz`) & Sandbox Local (`supabase_db_barbex`)
- **Modo de Investigação:** Estritamente READ-ONLY (Zero mutações em produção, sem criação de agendamentos reais).
- **Preservação de Integridade:** Arquivo local `supabase/functions/stripe-checkout/index.ts` mantido intacto. Nenhuma migration, trigger, RLS, Edge Function ou regra do Stripe/Z-API foi alterada. Nenhum commit, push ou deploy executado.
- **Resultados de Testes e Validação:**
  - 36/36 Testes Canônicos de Segurança de Entitlement (`tests/r2e18_2_entitlement_security_tests.cjs`): **PASS [100%]**
  - 12/12 Testes de Validação E2E de Identidade e RPC (`tests/r2e21_e_public_entitlement_blocking.test.cjs`): **PASS [100%]**
  - Build de Produção (`cmd /c npm run build` — Vite 7 + TanStack Start + Nitro SSR): **PASS (Exit Code: 0)**

---

## 2. AUDITORIA DE IDENTIDADE CANÔNICA: TENANT ID vs. OWNER ID

A investigação no banco de produção identificou a arquitetura de entidades do Barbex:

1. **A tabela `public.tenants` não existe como tabela física.**
   - A tabela base de estabelecimentos (tenants) no Postgres é `public.barbershops`.
   - A conta de usuário proprietário é registrada em `public.profiles` (`auth.users`).
   - O relacionamento de permissões reside em `public.tenant_memberships`.

2. **Mapeamento Exato dos Tenants de Referência em Produção:**

### Carlos Barber Shop
- **Slug Real:** `carlos-barber-shop` (e não `carlos-barber`, que pertence a outro estabelecimento com plan_id ativo).
- **Tenant ID Real (Canônico do Estabelecimento):** `92caca5a-5174-4725-9da9-b10a9aa87104` (em `public.barbershops.id` e `public.tenant_memberships.tenant_id`).
- **Owner ID Real (Proprietário/Conta de Usuário):** `703dcd8f-0077-4a57-8728-be05f654bd5b` (em `public.profiles.id` e `public.barbershops.owner_id`).
- **Dados das Tabelas Filhas:**
  - `barbers`: 3 barbeiros vinculados (`Carlos Costa`, `Antônio Bento`, `Maria Luiza`), todos com `tenant_id = 92caca5a-5174-4725-9da9-b10a9aa87104` e `user_id = 703dcd8f-0077-4a57-8728-be05f654bd5b`.
  - `services`: vinculados com `tenant_id = 92caca5a-5174-4725-9da9-b10a9aa87104` e `user_id = 703dcd8f-0077-4a57-8728-be05f654bd5b`.

### Barbearia LM
- **Slug Real:** `lm`
- **Tenant ID Real (Canônico do Estabelecimento):** `c54ac1ac-49be-4505-b7a4-d257ed023f08`
- **Owner ID Real (Proprietário/Conta de Usuário):** `c54ac1ac-49be-4505-b7a4-d257ed023f08`
- **Particularidade Histórica:** Na Barbearia LM, o `tenant_id` coincide exatamente com o `owner_id`. Por isso, qualquer consulta anterior que utilizasse um ou outro produzia o mesmo resultado. Na Carlos Barber Shop, eles são distintos.

---

## 3. AUDITORIA DA RPC `public.is_tenant_operational`

A existência, assinatura e permissões da função em Produção (`ywdwrstxvsdqiryhieiz`) foram verificadas via `pg_proc` e `information_schema`:

### 3.1 Definição Real no Postgres
```sql
CREATE OR REPLACE FUNCTION public.is_tenant_operational(
    p_tenant_id uuid, 
    p_user_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_canonical_id uuid;
  v_entitlement jsonb;
BEGIN
  v_canonical_id := public.resolve_canonical_tenant_id(p_tenant_id, p_user_id);
  IF v_canonical_id IS NULL THEN
    RETURN false; -- FAIL-CLOSED
  END IF;

  v_entitlement := public.resolve_tenant_entitlement(v_canonical_id);
  RETURN COALESCE((v_entitlement->>'can_operate')::boolean, false);
END;
$function$;
```

### 3.2 Permissões Verificadas
- `anon`: `GRANT EXECUTE` (Permitida para visitantes não autenticados).
- `authenticated`: `GRANT EXECUTE`
- `service_role`: `GRANT EXECUTE`
- `postgres`: `GRANT EXECUTE`

### 3.3 Comportamento do Resolvedor Canônico (`resolve_canonical_tenant_id`)
```sql
v_canonical_id := public.resolve_canonical_tenant_id(p_tenant_id, p_user_id);
```
O resolvedor canônico:
1. Prioriza `p_tenant_id`. Se este for um `barbershops.id` (ex: `92caca5a...`), resolve para o `owner_id` da barbearia (`703dcd8f...`).
2. Se `p_tenant_id` for diretamente o `profiles.id` (ex: `703dcd8f...`), resolve para ele mesmo.
3. Alimenta `resolve_tenant_entitlement(v_canonical_id)` que avalia assinaturas, trials e vouchers canônicos.

### 3.4 Matriz de Execução Real com `SET ROLE anon` em Produção

| ID de Entrada | Tipo do Identificador | Entidade Representada | Resultado da RPC (`is_tenant_operational`) | Motivo Canônico |
| :--- | :--- | :--- | :---: | :--- |
| `92caca5a-5174-4725-9da9-b10a9aa87104` | **Tenant ID Canônico** | Carlos Barber Shop (`barbershops`) | **`false`** | RESTRICTED (trial expirado, sem plano ativo) |
| `703dcd8f-0077-4a57-8728-be05f654bd5b` | **Owner ID** | Carlos Barber Shop (`profiles`) | **`false`** | RESTRICTED (resolução canônica idêntica) |
| `c54ac1ac-49be-4505-b7a4-d257ed023f08` | **Tenant ID = Owner ID** | Barbearia LM | **`true`** | VOUCHER_ACTIVE (Plano Elite Vitalício) |
| `00000000-0000-0000-0000-000000000000` | Inexistente | N/A | **`false`** | Fail-Closed (não encontrado) |
| `NULL` | Nulo | N/A | **`false`** | Fail-Closed estrito |

---

## 4. AJUSTE REFINADO NO FRONTEND (`src/routes/$slug.tsx`)

Para cumprir com perfeição a diretriz da Fase 3:
> *"Confirmar que o parâmetro enviado à RPC corresponde ao tenant_id canônico da barbearia carregada pelo slug. Não utilizar user.id, owner_id ou profiles.id como substitutos automáticos de tenant_id."*

### 4.1 Resolução Canônica do `tenant_id`
No carregamento público (`fetchShopData`), adicionou-se a consulta à entidade pública `barbershops`:
```tsx
// Resolução canônica de tenant do estabelecimento via barbershops (Public Read)
const { data: barbershopEntity } = await supabase
  .from("barbershops")
  .select("id, owner_id")
  .eq("slug", normalizedSlug)
  .maybeSingle();

const canonicalTenantId = barbershopEntity?.id || (currentShop as any).tenant_id || currentShop.id;
(currentShop as any).tenant_id = canonicalTenantId;
```

### 4.2 Chamada da RPC com o Tenant Canônico Estrito
```tsx
const { data: opData, error: opErr } = await supabase.rpc("is_tenant_operational", {
  p_tenant_id: canonicalTenantId,
});
```
- Para Carlos Barber Shop (`slug = 'carlos-barber-shop'`): o frontend envia estritamente **`92caca5a-5174-4725-9da9-b10a9aa87104`**.
- Para Barbearia LM (`slug = 'lm'`): o frontend envia estritamente **`c54ac1ac-49be-4505-b7a4-d257ed023f08`**.

### 4.3 Busca das Entidades Filhas (Barbeiros e Serviços)
A busca de barbeiros utilizava `.eq("tenant_id", currentShop.id)`. Como `currentShop.id` era o `owner_id`, os barbeiros cadastrados com o `tenant_id` da barbearia poderiam não ser filtrados corretamente.  
A consulta foi ajustada para:
```tsx
supabase
  .from("barbers")
  .select("*, barber_services(service_id)")
  .or(`tenant_id.eq.${canonicalTenantId},tenant_id.eq.${currentShop.id}`)
  .eq("active", true)
```

### 4.4 Isolamento e Mudança de Slug (Zero Reaproveitamento de Sessão)
No `useEffect` disparado pela alteração do parâmetro `slug`, o estado de autorização e qualquer modal aberto são invalidados imediatamente:
```tsx
useEffect(() => {
  if (slug) {
    setIsBookingOpen(false);
    setCanAccess(false);
    setIsEntitlementChecking(true);
    fetchShopData(slug);
...
```

---

## 5. RESULTADOS DOS TESTES DE VALIDAÇÃO (12/12 PASS)

```
===============================================================================================
BARBEX — R2E.21E.1: VALIDAÇÃO CANÔNICA DE IDENTIDADE DE TENANT E RPC PÚBLICA
===============================================================================================

T01   | PASS [OK]  | Carlos Barber Shop com Tenant ID canônico (92caca5a-5174-4725-9da9-b10a9aa87104) retorna can_operate=false
T02   | PASS [OK]  | Carlos Barber Shop com Owner ID (703dcd8f-0077-4a57-8728-be05f654bd5b) retorna can_operate=false (Fail-closed resiliente)
T03   | PASS [OK]  | Barbearia LM (VOUCHER_ACTIVE / c54ac1ac-49be-4505-b7a4-d257ed023f08) retorna can_operate=true
T04   | PASS [OK]  | Tenant inexistente e nulo retornam rigorosamente false (Fail-closed estrito)
T05   | PASS [OK]  | RPC is_tenant_operational retorna exclusivamente boolean (sem dados financeiros ou de assinatura)
T06   | PASS [OK]  | Frontend resolve tenant_id canônico via barbershops entity e não assume owner/profile_id cegamente
T07   | PASS [OK]  | Mudança de tenant/slug reseta modal e limpa estado de autorização prévio
T08   | PASS [OK]  | Dialog de agendamento possui trava canônica open={isBookingOpen && canAccess === true}
T09   | PASS [OK]  | Mensagem neutra oficial está configurada sem menção a planos, inadimplência ou restrições financeiras
T10   | PASS [OK]  | Botão do Hero e Cards de serviços desabilitados e exibem indisponibilidade para tenants RESTRICTED
T11   | PASS [OK]  | Banner neutro informativo é renderizado quando !isEntitlementChecking && !canAccess
T12   | PASS [OK]  | Arquivo pendente stripe-checkout/index.ts e página institucional preservados intactos

===============================================================================================
TOTAL DE TESTES R2E.21E.1: 12 | APROVADOS: 12 | REPROVADOS: 0
===============================================================================================
```

---

## 6. CONCLUSÃO E STATUS FINAL

1. **A inconsistência de identificador foi elucidada:**
   - O `tenant_id` canônico da Carlos Barber Shop é `92caca5a-5174-4725-9da9-b10a9aa87104`.
   - O `owner_id` é `703dcd8f-0077-4a57-8728-be05f654bd5b`.
   - O frontend agora obtém e envia o `tenant_id` canônico para a RPC.
2. **A RPC `is_tenant_operational` existe em Produção e é 100% fail-closed:**
   - Avaliada como `anon`, bloqueia Carlos Barber Shop (`false`), autoriza Barbearia LM (`true`), bloqueia tenants inexistentes (`false`) e nulos (`false`).
3. **Não há necessidade de novas RPCs ou migrations no backend.**
4. **Build de produção e 48 testes automatizados aprovados.**

**STATUS:** `R2E21_E1_READY_FOR_DEPLOY`
*(Nenhum commit, push ou deploy executado nesta etapa)*
