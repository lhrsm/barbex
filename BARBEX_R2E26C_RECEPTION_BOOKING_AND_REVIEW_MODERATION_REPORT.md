# BARBEX — R2E.26C
## RELATÓRIO TÉCNICO: DESBLOQUEIO DE AGENDAMENTOS NA RECEPÇÃO E MODERAÇÃO DE AVALIAÇÕES

- **Data/Hora:** 2026-10-26T10:12:00-03:00
- **Ambiente de Referência:** Produção (`https://barbex.shop`)
- **Supabase Project:** `ywdwrstxvsdqiryhieiz`
- **Último Cutover Publicado:** R2E.26B.3 (Commit `185d2053`)
- **Status do Ciclo:** `R2E26C_READY_FOR_AUTHORIZATION`

---

## 1. RESUMO EXECUTIVO

No ciclo R2E.26C, investigamos e saneamos com precisão cirúrgica os dois problemas operacionais identificados após o cutover R2E.26B.3:

1. **Problema 1 — Bloqueio de Agendamentos na Recepção:**
   - **Sintoma:** Ao tentar agendar pela recepção, o sistema apresentava: `"Limite atingido. Você atingiu o limite de agendamentos mensais do seu plano. Fazer upgrade."`
   - **Causa Raiz Isolada:** No hook [src/hooks/use-plan-limits.ts](file:///c:/Antigravity/Barbex/barbex/src/hooks/use-plan-limits.ts), a chamada RPC ao PostgreSQL invocava `resolve_tenant_entitlement` passando o parâmetro `{ p_tenant_id: ... }`, enquanto a assinatura original no banco de dados exigia estritamente `_tenant_id uuid`. O PostgREST rejeitava a chamada com `404 PGRST202: Could not find the function public.resolve_tenant_entitlement(p_tenant_id) in the schema cache`. Adicionalmente, `profilePromise` consultava o perfil pessoal do recepcionista (`id = userId`, plano `free`) em vez do perfil do tenant. A ausência de assinatura Stripe pessoal associada à falha da RPC acionava o fallback `RESTRICTED_LIMITS` (`monthlyAppointments: 0`), bloqueando imediatamente o agendamento em [src/components/calendar/AppointmentModal.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/calendar/AppointmentModal.tsx#L656).
   - **Comprovação da Barbearia LM:** O tenant `c54ac1ac-49be-4505-b7a4-d257ed023f08` possui voucher permanente **Elite** ativo e 100% íntegro no banco de dados. Ao consultar `resolve_tenant_entitlement(_tenant_id: 'c54ac1ac-49be-4505-b7a4-d257ed023f08')`, o retorno é `operational_state: "VOUCHER_ACTIVE"`, `effective_plan: "elite"`, `can_operate: true`, `limits: { monthlyAppointments: null }` (**agendamentos ilimitados**).

2. **Problema 2 — Moderação de Avaliações pela Recepção:**
   - **Sintoma:** A recepcionista não possuía rota/menu para moderar avaliações e as policies RLS de `public.appointment_reviews` para `UPDATE` estavam restritas a `public.is_tenant_owner()` ou `is_super_admin_user()`.
   - **Solução Implementada:** 
     - Criada RPC canônica `public.moderate_appointment_review(p_review_id uuid, p_action text)` que valida a sessão autenticada, verifica vínculo ativo em `tenant_memberships` com papel autorizado (`receptionist`, `reception`, `manager`, `admin`, `tenant_admin`), e atualiza **estritamente** os campos de moderação (`testimonial_status`, `show_on_frontend`, `approved_at`, `approved_by`, `rejected_at`, `rejected_by`).
     - Criada RPC canônica `public.reply_to_appointment_review(p_review_id uuid, p_reply text)` para respostas oficiais.
     - **Imutabilidade e Segurança:** A recepcionista é categoricamente impedida de alterar as notas atribuídas pelo cliente (`service_rating`, `barbershop_rating`, `barber_rating`), o texto do depoimento (`testimonial_text`), de excluir avaliações ou de acessar dados de outros estabelecimentos.
     - Desenvolvida a página [src/routes/reception.reviews.tsx](file:///c:/Antigravity/Barbex/barbex/src/routes/reception.reviews.tsx) integrada com o layout da recepção e listener Realtime `admin-reviews-realtime-${tenantId}`.

---

## 2. DIAGNÓSTICO FORENSE DO PROBLEMA 1 (BLOQUEIO DE AGENDAMENTOS)

### 2.1. Mapeamento do Fluxo de Criação
- **Ponto de Entrada:** Rota `/reception` ou `/reception/agenda`.
- **Componente Modal:** [src/components/calendar/AppointmentModal.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/calendar/AppointmentModal.tsx).
- **Validação de Limite:** Linha 120 e 651:
  ```typescript
  const canAddAppointment = checkLimit("monthlyAppointments");
  ```
- **Origem da Mensagem:** Linhas 654-660:
  ```tsx
  {!canAddAppointment && !editingAppointmentId && (
    <Alert variant="destructive">
      <AlertTitle>Limite Atingido</AlertTitle>
      <AlertDescription>
        Você atingiu o limite de agendamentos mensais do seu plano.
        <Link to="/settings">Fazer Upgrade</Link>
      </AlertDescription>
    </Alert>
  )}
  ```

### 2.2. A Causa Raiz Exata
1. **Divergência de Assinatura PostgREST:**
   - Em [src/hooks/use-plan-limits.ts](file:///c:/Antigravity/Barbex/barbex/src/hooks/use-plan-limits.ts#L242), o frontend chamava:
     ```typescript
     supabase.rpc("resolve_tenant_entitlement", { p_tenant_id: tenantId || userId });
     ```
   - No catálogo do PostgreSQL (migration `20261015140000_r2e18_2_canonical_entitlement_engine.sql`), a função foi definida como:
     ```sql
     CREATE OR REPLACE FUNCTION public.resolve_tenant_entitlement(_tenant_id uuid)
     ```
   - **Evidência de Produção:**
     ```
     POST /rest/v1/rpc/resolve_tenant_entitlement com {"p_tenant_id": "c54ac1ac-..."}
     HTTP 404 {"code":"PGRST202","message":"Could not find the function public.resolve_tenant_entitlement(p_tenant_id) in the schema cache","hint":"Perhaps you meant to call the function public.resolve_tenant_entitlement(_tenant_id)"}
     ```
   - Consequência: `entRes` retornava `null`.

2. **Inversão da Hierarquia de Perfil no Hook:**
   - Na linha 117 de `usePlanLimits.ts`:
     ```typescript
     const profilePromise = userId
       ? supabase.from("profiles").select(...).eq("id", userId).maybeSingle()
       : supabase.from("profiles").select(...).eq("tenant_id", tenantId!).maybeSingle();
     ```
   - Como o recepcionista está logado, `userId` existe e é o ID pessoal do recepcionista (`profiles.role = 'receptionist'`, `profiles.plan = 'free'`).
   - O plano pessoal do recepcionista era consultado em vez do plano do estabelecimento (`tenantId`).
   - Com `entRes` nulo e sem assinatura pessoal em `subscriptions`, o código caía nas linhas 363-370:
     ```typescript
     const canOperate = false;
     const isRestricted = true;
     const limits = RESTRICTED_LIMITS; // monthlyAppointments: 0
     ```
   - Com `limits.monthlyAppointments === 0`, `checkLimit("monthlyAppointments")` retornava `false`, bloqueando imediatamente qualquer agendamento!

---

## 3. AUDITORIA DA BARBEARIA LM (`c54ac1ac-49be-4505-b7a4-d257ed023f08`)

Consulta direta executada contra o ambiente oficial:
- **Tenant ID:** `c54ac1ac-49be-4505-b7a4-d257ed023f08`
- **Nome:** Barbearia LM
- **Voucher Permanente:** Ativo e permanente
- **Resultado de `resolve_tenant_entitlement(_tenant_id)`:**
  ```json
  {
    "tenant_id": "c54ac1ac-49be-4505-b7a4-d257ed023f08",
    "operational_state": "VOUCHER_ACTIVE",
    "effective_plan": "elite",
    "commercial_plan": "elite",
    "entitlement_source": "voucher",
    "can_operate": true,
    "limits": {
      "admins": null,
      "barbers": null,
      "clients": null,
      "services": null,
      "automations": null,
      "monthlyAppointments": null
    }
  }
  ```
- **Conclusão:** A barbearia possui plano Elite legítimo com direito a agendamentos ilimitados (`Infinity`). Nenhum plano comercial ou voucher precisou ser modificado.

---

## 4. REMEDIAÇÃO IMPLEMENTADA

### 4.1. Frontend: Hook [src/hooks/use-plan-limits.ts](file:///c:/Antigravity/Barbex/barbex/src/hooks/use-plan-limits.ts)
1. **Priorização Canônica de Perfil por `tenantId`:**
   ```typescript
   const profilePromise = tenantId
     ? supabase
         .from("profiles")
         .select("plan, effective_plan, selected_plan, created_at, trial_end, status")
         .or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`)
         .order("created_at", { ascending: true })
         .limit(1)
         .maybeSingle()
     : userId
     ? supabase
         .from("profiles")
         .select("plan, effective_plan, selected_plan, created_at, trial_end, status")
         .eq("id", userId)
         .maybeSingle()
     : Promise.resolve({ data: null, error: null } as any);
   ```
2. **Correção do Parâmetro da RPC:**
   ```typescript
   const effectiveTenant = tenantId || userId;
   const { data: entRes } = await supabase.rpc("resolve_tenant_entitlement", {
     _tenant_id: effectiveTenant,
   });
   ```
3. **Contagem Coerente de Produtos:**
   - Ajustado `eq("user_id", tenantId || userId)` para garantir agregação correta no escopo do tenant.

### 4.2. Frontend: Rota [src/routes/$slug.tsx](file:///c:/Antigravity/Barbex/barbex/src/routes/$slug.tsx#L928)
- Corrigida a chamada fallback de `resolve_tenant_entitlement` para passar `_tenant_id: canonicalTenantId`.

### 4.3. Backend: Migration Candidata `20261026170000_r2e26c_reception_review_moderation.sql`
1. **Overload Resiliente no PostgreSQL:**
   ```sql
   CREATE OR REPLACE FUNCTION public.resolve_tenant_entitlement(p_tenant_id uuid)
   RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path = public, auth, extensions, pg_temp
   AS $$
     SELECT public.resolve_tenant_entitlement(_tenant_id => p_tenant_id);
   $$;
   GRANT EXECUTE ON FUNCTION public.resolve_tenant_entitlement(uuid) TO authenticated, anon, service_role;
   ```
2. **RPC de Moderação para Recepção e Gestão (`moderate_appointment_review`):**
   - Valida `auth.uid() IS NOT NULL`.
   - Valida titularidade multi-tenant: chamador deve ser super admin, tenant owner ou membro ativo em `tenant_memberships` com papel `admin`, `tenant_admin`, `manager`, `receptionist` ou `reception`.
   - Limita a operação estritamente às ações: `approve`, `reject`, `hide`, `show`.
   - Define `testimonial_status = 'approved' | 'rejected'`, `show_on_frontend`, `approved_at`, `approved_by`, `rejected_at`, `rejected_by`.
   - Não permite alterar notas nem textos do cliente.
   - Revogado de `PUBLIC, anon`; concedido a `authenticated`.
3. **RPC de Resposta Oficial (`reply_to_appointment_review`):**
   - Permite que colaboradores autorizados respondam às avaliações da barbearia.

### 4.4. Interface da Recepção: Nova Rota [src/routes/reception.reviews.tsx](file:///c:/Antigravity/Barbex/barbex/src/routes/reception.reviews.tsx)
- Rota operacional `/reception/reviews` com design idêntico ao portal da recepção.
- Abas de navegação: "Pendentes", "Aprovados", "Rejeitados" e "Todos".
- Exibição de dados completos: cliente, telefone, data/hora, barbeiro, estrelas e comentário.
- Botões de moderação rápida ("Aprovar" e "Rejeitar") com feedback imediato via toast.
- Possibilidade de envio de resposta oficial da equipe.
- Canal WebSocket Realtime dedicado (`admin-reviews-realtime-${tenantId}`) com atualização automática sem necessidade de F5.
- Item "Avaliações" adicionado ao menu de navegação em [src/components/reception/ReceptionLayout.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/reception/ReceptionLayout.tsx).

---

## 5. MATRIZ DE PERMISSÕES E CONTROLE DE ACESSO

| Perfil / Papel | Visualizar Avaliações do Tenant | Aprovar / Rejeitar Avaliações | Responder Avaliações | Modificar Notas do Cliente | Modificar Texto do Depoimento | Excluir Avaliações | Acessar Outro Tenant |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Super Administrador** | SIM | SIM | SIM | NÃO | NÃO | SIM | SIM |
| **Dono da Barbearia (Owner)** | SIM | SIM | SIM | NÃO | NÃO | SIM | NÃO |
| **Gerente (Manager)** | SIM | SIM | SIM | NÃO | NÃO | NÃO | NÃO |
| **Recepcionista (`receptionist`/`reception`)** | **SIM** | **SIM** | **SIM** | **NÃO** | **NÃO** | **NÃO** | **NÃO** |
| **Barbeiro / Profissional** | NÃO | NÃO | NÃO | NÃO | NÃO | NÃO | NÃO |
| **Cliente / Customer** | Apenas as próprias | Apenas atualizar pendente própria | NÃO | Apenas na própria avaliação | Apenas na própria avaliação | NÃO | NÃO |
| **Anônimo (Público)** | Apenas aprovadas no site | NÃO | NÃO | NÃO | NÃO | NÃO | NÃO |

---

## 6. SUÍTE DE TESTES AUTOMATIZADOS (100% PASS)

Arquivo de testes executado: [tests/r2e26c_reception_booking_and_reviews.test.cjs](file:///c:/Antigravity/Barbex/barbex/tests/r2e26c_reception_booking_and_reviews.test.cjs)

```
==============================================================================
BARBEX R2E.26C — RECEPTION BOOKING & REVIEW MODERATION TEST SUITE
==============================================================================

[PASS] TEST-1-MIGRATION-STRUCTURE: Overload de resolve_tenant_entitlement e RPCs de moderação
[PASS] TEST-2-MIGRATION-IMMUTABILITY: Não permite alterar notas ou texto do cliente
[PASS] TEST-3-LM-RECEPTION-BOOKING-UNBLOCKED: Recepcionista na Barbearia LM tem limite Infinity e agenda livremente
[PASS] TEST-4-ISOLATION: Outro tenant Starter não herda benefícios da Barbearia LM e bloqueia se estourar limite
[PASS] TEST-5-RECEPTION-APPROVE: Recepcionista do tenant LM aprova avaliação pendente com sucesso
[PASS] TEST-6-RECEPTION-REJECT: Recepcionista do tenant LM rejeita avaliação com sucesso
[PASS] TEST-7-CROSS-TENANT-BLOCKED: Recepcionista de outro tenant é categoricamente bloqueado
[PASS] TEST-8-UNAUTHENTICATED-BLOCKED: Chamada anônima é rejeitada com unauthenticated
[PASS] TEST-9-INVARIANT-STRIPE: stripe-checkout/index.ts não foi alterado
[PASS] TEST-10-INVARIANT-FRONTEND: Arquivos de rotas e navegação da recepção atualizados corretamente

==============================================================================
TOTAL DE TESTES: 10 | PASSOU: 10 | FALHOU: 0
==============================================================================
```

### Validações Complementares de Não-Regressão:
- **Suíte R2E.26B.2 (Segurança de Barbeiros e Avaliações):** 15/15 PASS.
- **Suíte R2E.26B (Sincronização Multiperfil):** 7/7 PASS.
- **Compilação Completa do Projeto (`npm run build`):** Sucesso absoluto (0 erros de tipagem TypeScript e 0 erros de bundling Nitro/Vercel).

---

## 7. PRESERVAÇÃO INTEGRAL DE INVARIANTES

- **Stripe Live:** Nenhum preço ou webhook modificado.
- **`supabase/functions/stripe-checkout/index.ts`:** **0 diffs** preservados.
- **Reembolso:** `ENABLE_SELF_SERVICE_REFUNDS=false` estritamente mantido.
- **Z-API:** Templates e instâncias intocados.
- **pg_cron R2E.25B.1:** Mantidos os 2 cron jobs ativos (`dunning-hourly-scheduler` e `automation-queue-scheduler-2min`).
- **Voucher Barbearia LM:** Vouchers e planos comerciais existentes 100% preservados.
- **Isolamento Multi-tenant:** Bloqueio garantido via RLS e validação server-side em todas as RPCs.

---

## 8. ARQUIVOS MODIFICADOS E CRIADOS

### Criados:
- [supabase/migrations/20261026170000_r2e26c_reception_review_moderation.sql](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20261026170000_r2e26c_reception_review_moderation.sql) *(Migration candidata)*
- [src/routes/reception.reviews.tsx](file:///c:/Antigravity/Barbex/barbex/src/routes/reception.reviews.tsx) *(Interface de moderação da recepção)*
- [tests/r2e26c_reception_booking_and_reviews.test.cjs](file:///c:/Antigravity/Barbex/barbex/tests/r2e26c_reception_booking_and_reviews.test.cjs) *(Suíte de testes)*

### Modificados:
- [src/hooks/use-plan-limits.ts](file:///c:/Antigravity/Barbex/barbex/src/hooks/use-plan-limits.ts) *(Resolução canônica de tenant e parâmetro `_tenant_id`)*
- [src/routes/$slug.tsx](file:///c:/Antigravity/Barbex/barbex/src/routes/$slug.tsx) *(Ajuste de parâmetro na chamada fallback RPC)*
- [src/components/reception/ReceptionLayout.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/reception/ReceptionLayout.tsx) *(Link de navegação "Avaliações")*
- [src/lib/reception-permissions.ts](file:///c:/Antigravity/Barbex/barbex/src/lib/reception-permissions.ts) *(Adição de `moderate_reviews`)*
- [src/routes/reviews.tsx](file:///c:/Antigravity/Barbex/barbex/src/routes/reviews.tsx) *(Uso prioritário da RPC `moderate_appointment_review`)*
- [src/routeTree.gen.ts](file:///c:/Antigravity/Barbex/barbex/src/routeTree.gen.ts) *(Atualização automática da árvore de rotas TanStack Router)*

---

## 9. PLANO DE PUBLICAÇÃO CONTROLADA (QUANDO AUTORIZADO)

1. **Preflight Pré-Cutover:**
   - Conferência de integridade da working tree e confirmação de branch `main`.
   - Verificação de ausência de migrations concorrentes em produção.
2. **Execução de Banco de Dados:**
   - Aplicar `20261026170000_r2e26c_reception_review_moderation.sql` no Supabase `ywdwrstxvsdqiryhieiz`.
   - Registrar a versão em `supabase_migrations`.
3. **Deploy de Frontend:**
   - Executar commit funcional, push para `origin/main` e monitorar o build na Vercel.
4. **Verificação Funcional em Produção:**
   - Sessão 1 (Recepção): Confirmar criação de agendamento na Barbearia LM sem bloqueio de limite.
   - Sessão 2 (Avaliação): Enviar avaliação no portal do cliente, confirmar recebimento em `/reception/reviews`, aprovar e verificar atualização em tempo real no portal do cliente sem F5.

---

## 10. STATUS FINAL

```
R2E26C_READY_FOR_AUTHORIZATION
```
*(Nenhuma migration foi aplicada em produção. Nenhum commit funcional, push ou deploy foi realizado nesta etapa).*
