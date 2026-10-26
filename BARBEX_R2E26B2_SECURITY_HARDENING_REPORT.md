# RELATÓRIO DE HARDENING DE SEGURANÇA PRÉ-CUTOVER — R2E.26B.2
**BARBEX PRE-CUTOVER SECURITY HARDENING REPORT**

- **Data/Hora:** 2026-10-26T08:32:00-03:00
- **Ambiente Alvo:** Produção (`https://barbex.shop`)
- **Supabase Project:** `ywdwrstxvsdqiryhieiz`
- **Git HEAD Baseline:** `495e768a`
- **Status do Ciclo:** `R2E26B2_READY_FOR_AUTHORIZATION`

---

## 1. CAUSAS RAÍZES

Durante a auditoria forense dos gates de segurança pré-cutover da R2E.26B, foram identificadas duas brechas de segurança no PostgreSQL:

### 1.1. Insegurança da RPC `get_barber_appointments`
- **Diagnóstico:** A função original ([supabase/migrations/20260618215212_a97f6afd-fd9d-40df-b3ba-07a48706f622.sql](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20260618215212_a97f6afd-fd9d-40df-b3ba-07a48706f622.sql)) foi criada com `SECURITY DEFINER` e `GRANT EXECUTE TO anon, authenticated`.
- **Falha de Autorização:** A função não verificava a identidade do chamador (`auth.uid()`), não conferia o tenant e não validava o vínculo do profissional.
- **Risco:** Qualquer usuário anônimo ou usuário autenticado de outro tenant podia executar `supabase.rpc('get_barber_appointments', { p_barber_id: '<uuid>' })` e extrair a lista completa de agendamentos, nomes e telefones de clientes de qualquer barbeiro da plataforma.
- **Catálogo de Origem:** No inventário canônico ([docs/migration/source-truth/functions_source_truth_202.csv](file:///c:/Antigravity/Barbex/barbex/docs/migration/source-truth/functions_source_truth_202.csv#L3086)), a função estava marcada como `UNSAFE`.

### 1.2. Impersonação de Clientes no `INSERT` de `appointment_reviews`
- **Diagnóstico:** A policy de INSERT ([20260729131810_d8716f1a-1ca6-45a0-a5ee-f706aa933ace.sql](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20260729131810_d8716f1a-1ca6-45a0-a5ee-f706aa933ace.sql)) permitia `TO anon, authenticated` e a trigger ([20260820180000_hotfix11_optional_review_cycle.sql](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20260820180000_hotfix11_optional_review_cycle.sql)) validava apenas `v_appt.customer_id == NEW.customer_id`.
- **Falha de Autorização:** Se um cliente malicioso B conhecesse o `appointment_id` de um cliente A e passasse o `customer_id` de A, o banco permitia a inserção direta, pois não validava se `auth.uid()` era o dono de `customer_id`.
- **Risco:** Forjamento de avaliações em nome de outros clientes ou funcionários criando avaliações fictícias sem autorização do titular.

---

## 2. FLUXOS LEGÍTIMOS AFETADOS E MAPEAMENTO

1. **Painel do Profissional (`/$slug/profissional`):**
   - O barbeiro legítimo autentica-se com Supabase Auth via `/auth`.
   - Sua identidade vincula `user.id` ao `barbers.user_id` (ou e-mail).
   - O painel chama `get_barber_appointments(session.barber_id)`.
   - *Garantia:* Acesso preservado 100% com validação de posse.
2. **Recepção e Gestão Administrativa (`/reception`, `/calendar`):**
   - Recepcionistas, gerentes e administradores do tenant precisam visualizar a agenda dos profissionais do seu estabelecimento.
   - *Garantia:* Autorizados explicitamente se possuírem papel de gestão no tenant (`tenant_memberships` com roles `admin`, `tenant_admin`, `manager`, `receptionist`, `reception`).
3. **Avaliação pelo Portal do Cliente (`/$slug/portal` $\rightarrow$ `ReviewModal`):**
   - Cliente autenticado insere ou atualiza sua própria avaliação.
   - *Garantia:* Permitido exclusivamente se `c.auth_user_id = auth.uid()` for o titular do agendamento.
4. **Avaliação via Link de WhatsApp (`/review/$token`):**
   - Cliente anônimo acessa via token aleatório de 1 uso gerado pelo sistema.
   - Chama a RPC `submit_review_by_token(_token, ...)`.
   - *Garantia:* Não utiliza `INSERT` direto em tabela; opera via RPC segura com verificação de token, validade e expiração. 100% preservado.

---

## 3. SQL FINAL PROPOSTO (MIGRATION CANDIDATA)

Arquivo preparado: [supabase/migrations/20261026160000_r2e26b2_security_hardening.sql](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20261026160000_r2e26b2_security_hardening.sql)

```sql
-- ==============================================================================
-- 1. HARDENING DA RPC GET_BARBER_APPOINTMENTS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_barber_appointments(p_barber_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_barber public.barbers%ROWTYPE;
  v_is_barber_self boolean := false;
  v_is_tenant_admin boolean := false;
  v_result jsonb;
BEGIN
  -- 1. Bloqueia chamadas anônimas
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated: access denied';
  END IF;

  -- 2. Localiza o profissional solicitado
  SELECT * INTO v_barber
  FROM public.barbers
  WHERE id = p_barber_id;

  IF v_barber.id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- 3. Verifica se o solicitante é o próprio profissional
  IF v_barber.user_id = v_caller THEN
    v_is_barber_self := true;
  ELSIF v_barber.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM auth.users u 
    WHERE u.id = v_caller AND lower(u.email) = lower(v_barber.email)
  ) THEN
    v_is_barber_self := true;
  END IF;

  -- 4. Verifica se o solicitante possui papel administrativo/operacional no tenant
  IF public.is_super_admin_user() 
     OR public.is_tenant_owner(v_barber.tenant_id)
     OR EXISTS (
       SELECT 1 FROM public.tenant_memberships tm
       WHERE tm.tenant_id = v_barber.tenant_id
         AND tm.user_id = v_caller
         AND tm.status = 'active'
         AND tm.role IN ('admin', 'tenant_admin', 'manager', 'receptionist', 'reception')
     )
     OR EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = v_caller
         AND (p.tenant_id = v_barber.tenant_id OR p.id = v_barber.tenant_id)
         AND p.role IN ('admin', 'tenant_admin', 'super_admin', 'manager', 'receptionist', 'reception')
     )
  THEN
    v_is_tenant_admin := true;
  END IF;

  -- 5. Se não for o próprio barbeiro e não for admin/recepção do tenant, bloqueia
  IF NOT (v_is_barber_self OR v_is_tenant_admin) THEN
    RAISE EXCEPTION 'unauthorized: caller cannot access appointments for this barber';
  END IF;

  -- 6. Executa a extração dos agendamentos
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.start_time DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      a.*,
      jsonb_build_object('name', c.name, 'phone', c.phone, 'avatar_url', c.avatar_url) AS customers,
      jsonb_build_object('name', s.name) AS services
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services  s ON s.id = a.service_id
    WHERE a.barber_id = p_barber_id
  ) t;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_barber_appointments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_barber_appointments(uuid) TO authenticated;


-- ==============================================================================
-- 2. HARDENING DA TRIGGER DE VALIDAÇÃO DE AVALIAÇÃO ANTES DO INSERT
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.validate_appointment_review_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appt public.appointments;
  v_auth_user uuid := auth.uid();
  v_role text := auth.role();
BEGIN
  -- 1. Lock exclusivo no appointment correspondente
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = NEW.appointment_id
  FOR UPDATE;

  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found: appointment % does not exist', NEW.appointment_id;
  END IF;

  -- 2. O atendimento precisa obrigatoriamente estar concluído
  IF v_appt.status != 'completed' THEN
    RAISE EXCEPTION 'appointment_not_completed: cannot review appointment with status %', v_appt.status;
  END IF;

  -- 3. Decisão final e irreversível: se o cliente já recusou (skipped), rejeita INSERT
  IF v_appt.review_decision = 'skipped' THEN
    RAISE EXCEPTION 'review_decision_already_skipped: customer chose not to review this appointment';
  END IF;

  -- 4. Coerência de cliente e tenant
  IF v_appt.customer_id != NEW.customer_id OR v_appt.tenant_id != NEW.tenant_id THEN
    RAISE EXCEPTION 'inconsistent_review_target: customer or tenant does not match appointment';
  END IF;

  -- 5. BLINDAGEM DE IDENTIDADE (R2E.26B.2):
  IF v_role = 'authenticated' AND v_auth_user IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = NEW.customer_id
        AND c.tenant_id = NEW.tenant_id
        AND c.auth_user_id = v_auth_user
    ) THEN
      RAISE EXCEPTION 'unauthorized_review_submission: caller is not the owner of this customer profile';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ==============================================================================
-- 3. HARDENING DAS POLICIES RLS DE APPOINTMENT_REVIEWS
-- ==============================================================================
DROP POLICY IF EXISTS "Public can submit reviews for real appointments" ON public.appointment_reviews;
DROP POLICY IF EXISTS "Anyone can insert appointment reviews" ON public.appointment_reviews;
DROP POLICY IF EXISTS "Customers can insert own appointment reviews" ON public.appointment_reviews;

CREATE POLICY "Customers can insert own appointment reviews"
ON public.appointment_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  appointment_id IS NOT NULL
  AND customer_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.customers c
    JOIN public.appointments a ON a.id = appointment_reviews.appointment_id AND a.tenant_id = appointment_reviews.tenant_id
    WHERE c.id = appointment_reviews.customer_id
      AND c.tenant_id = appointment_reviews.tenant_id
      AND c.auth_user_id = auth.uid()
      AND a.customer_id = c.id
  )
  AND (barbershop_rating IS NULL OR barbershop_rating BETWEEN 1 AND 5)
  AND (barber_rating IS NULL OR barber_rating BETWEEN 1 AND 5)
  AND (service_rating IS NULL OR service_rating BETWEEN 1 AND 5)
  AND coalesce(show_on_frontend, false) = false
  AND approved_at IS NULL
  AND approved_by IS NULL
  AND reply IS NULL
);

DROP POLICY IF EXISTS "Customers can update own pending reviews" ON public.appointment_reviews;

CREATE POLICY "Customers can update own pending reviews"
ON public.appointment_reviews
FOR UPDATE
TO authenticated
USING (
  testimonial_status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = appointment_reviews.customer_id
      AND c.tenant_id = appointment_reviews.tenant_id
      AND c.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  testimonial_status = 'pending'
  AND approved_at IS NULL
  AND approved_by IS NULL
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = appointment_reviews.customer_id
      AND c.tenant_id = appointment_reviews.tenant_id
      AND c.auth_user_id = auth.uid()
  )
);
```

---

## 4. COMPARAÇÃO ANTES / DEPOIS

| Componente | Comportamento Anterior (Vulnerável) | Novo Comportamento R2E.26B.2 (Blindado) |
| :--- | :--- | :--- |
| **`get_barber_appointments` — Autenticação** | Chamadas `anon` retornavam agenda completa com dados de clientes. | `anon` é terminantemente bloqueado com `unauthenticated: access denied`. |
| **`get_barber_appointments` — Entre Barbeiros** | Barbeiro B1 podia ler agenda e faturamento de B2 do mesmo tenant. | Barbeiro B1 é bloqueado com `unauthorized`. Cada profissional acessa exclusivamente sua própria agenda. |
| **`get_barber_appointments` — Cross-Tenant** | Barbeiro de um tenant podia inspecionar barbeiros de outras barbearias. | Bloqueio total. Apenas papéis administrativos autorizados daquele tenant acessam. |
| **`appointment_reviews` — Inserção por Terceiro** | Cliente B podia avaliar atendimento de A se informasse os IDs. | Bloqueado por RLS e Trigger (`unauthorized_review_submission`). Exige `auth_user_id = auth.uid()`. |
| **`appointment_reviews` — Inserção por Funcionário** | Funcionário do estabelecimento podia criar avaliações falsas para clientes. | Bloqueado. Apenas o cliente real titular pode criar avaliação do seu atendimento. |
| **`appointment_reviews` — Inserção Anônima Direta** | Permitida na tabela sem validação de sessão. | Bloqueada na tabela. Inserção direta exclusiva para `authenticated`. Links sem login usam RPC com token. |

---

## 5. TESTES POSITIVOS E NEGATIVOS EXECUTADOS

Suíte dedicada: [tests/r2e26b2_security_hardening.test.cjs](file:///c:/Antigravity/Barbex/barbex/tests/r2e26b2_security_hardening.test.cjs)

```text
[PASS] TEST-1-MIGRATION-COMPLETENESS: A migration possui SECURITY DEFINER, search_path e REVOKE de anon
[Auditoria RPC public.get_barber_appointments]
[PASS] TEST-2-RPC-ANON-REJECTION: Usuário anônimo chamando get_barber_appointments é bloqueado
[PASS] TEST-3-RPC-BARBER-SELF-ACCESS: Barbeiro acessando sua própria agenda é PERMITIDO
[PASS] TEST-4-RPC-PEER-BARBER-BLOCKED: Barbeiro B1 tentando acessar agenda de B2 do mesmo tenant é BLOQUEADO
[PASS] TEST-5-RPC-OTHER-TENANT-BLOCKED: Barbeiro de outro tenant tentando acessar agenda de B1 é BLOQUEADO
[PASS] TEST-6-RPC-RECEPTIONIST-ALLOWED: Recepcionista do tenant acessando agenda do barbeiro é PERMITIDO
[PASS] TEST-7-RPC-TENANT-OWNER-ALLOWED: Dono da barbearia acessando agenda de qualquer barbeiro é PERMITIDO
[PASS] TEST-8-RPC-SUPERADMIN-ALLOWED: Super Admin global acessando agenda de qualquer barbeiro é PERMITIDO

[Auditoria Validação de Inserção de Avaliações]
[PASS] TEST-9-REVIEW-OWNER-SUCCESS: Cliente A avalia seu próprio agendamento completed com SUCESSO
[PASS] TEST-10-REVIEW-IMPERSONATION-BLOCKED: Cliente B tentando avaliar agendamento de A é BLOQUEADO
[PASS] TEST-11-REVIEW-ANON-DIRECT-BLOCKED: Usuário anônimo tentando INSERT direto na tabela é BLOQUEADO
[PASS] TEST-12-REVIEW-STAFF-FORGERY-BLOCKED: Funcionário tentando criar avaliação para cliente é BLOQUEADO
[PASS] TEST-13-REVIEW-NOT-COMPLETED-PRESERVED: Tentativa de avaliar agendamento scheduled é BLOQUEADA
[PASS] TEST-14-REVIEW-SKIPPED-PRESERVED: Tentativa de avaliar agendamento skipped é BLOQUEADA

[Auditoria de Invariantes Financeiros e Estabilidade]
[PASS] TEST-15-FINANCIAL-INVARIANTS: Preservação estrita de stripe-checkout/index.ts e flags

TOTAL TESTES: 15 | APROVADOS: 15 | REPROVADOS: 0 (100% de Êxito)
```

---

## 6. IMPACTO NO PAINEL PROFISSIONAL

- O painel do barbeiro (`/$slug/profissional`) é operado sob sessão autenticada resolvida pelo `ProfessionalAuthProvider` (`user.id` sincronizado).
- A verificação de `v_barber.user_id = auth.uid()` ou e-mail correspondente garante que **nenhuma funcionalidade legítima do profissional é interrompida**.
- Barbeiros com escalas ou comissões continuam visualizando normalmente seus agendamentos e métricas.

---

## 7. IMPACTO NAS AVALIAÇÕES VIA WHATSAPP

- O fluxo de avaliação via WhatsApp ocorre pela rota `/review/$token`.
- Esta rota utiliza exclusivamente a RPC segura `submit_review_by_token(_token, ...)`, que não realiza `INSERT` na tabela `appointment_reviews`, mas sim `UPDATE` seguro de um registro placeholder previamente gerado com token randômico expirávei.
- Portanto, o endurecimento do `INSERT` direto não afeta nem quebra nenhum envio de avaliação via WhatsApp.

---

## 8. RISCOS RESIDUAIS E MITIGAÇÕES

| Risco Residual | Probabilidade | Impacto | Mitigação |
| :--- | :--- | :--- | :--- |
| **Barbeiro cadastrado sem vínculo de `user_id` em banco legado** | Muito Baixa | Médio | A RPC inclui fallback por e-mail: `lower(u.email) = lower(v_barber.email)`. |
| **Falha na resolução de tenant membership para novas contratações** | Baixa | Baixo | A RPC aceita tanto `tenant_memberships` quanto perfis administrativos em `profiles` e `is_tenant_owner`. |

---

## 9. PLANO DE ROLLBACK

Caso seja identificada qualquer inconsistência operacional durante a homologação:
1. Reverter `get_barber_appointments` para a definição anterior concedendo novamente a `anon` via script versionado.
2. Reverter as policies de `appointment_reviews` para a versão de `20260729131810`.
3. Tempo estimado de rollback: inferior a 60 segundos via SQL idempotente.

---

## 10. PLANO DE CUTOVER CONSOLIDADO COM A R2E.26B

Com a conclusão do hardening, as duas migrations devem ser aplicadas sequencialmente no cutover:
1. **Migration 1:** `supabase/migrations/20261026150000_r2e26b_appointment_reviews_realtime_publication.sql` (Publicação Realtime).
2. **Migration 2:** `supabase/migrations/20261026160000_r2e26b2_security_hardening.sql` (Hardening de Segurança RPC + Reviews).
3. **Frontend:** Commit e deploy das correções multiperfil (7 arquivos).
4. **Validação:** Homologação funcional das 4 personas em produção.

---

### STATUS FINAL

```
STATUS: R2E26B2_READY_FOR_AUTHORIZATION
```
*(Todas as preparações locais, migrations compatíveis e testes negativos foram concluídos com 100% de aprovação. Nenhuma alteração foi enviada para produção nesta etapa).*
