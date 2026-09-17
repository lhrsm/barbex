# BARBEX — PHASE 17C.M6E: STRIPE EDGE RE-IMPLEMENTATION & PAYMENT SAFETY

## 1. Visão Geral e Contexto
A fase **Phase 17C.M6E.1** implementou localmente a migração completa de toda a infraestrutura server-side do **Stripe** para **Supabase Edge Functions** e **RPCs PostgreSQL Atômicas**, eliminando a dependência legada do runtime Nitro e do gateway intermediário Lovable.

Todas as operações foram desenvolvidas e validadas exclusivamente em **Stripe Test Mode / Sandbox**, garantindo 0 transações reais, 0 cobranças em cartões e 0 modificações no Stripe Dashboard ou no ambiente de produção `barbex.shop`.

---

## 2. Inventário e Auditoria Funcional

| Função / Endpoint Legado | Runtime Legado | Destino Supabase Edge | Papel & Autorização |
|---|---|---|---|
| `createPlanCheckout` | TanStack Server Fn | `stripe-checkout` (action: `create-plan-checkout`) | `admin`, `tenant_admin`, `shop_owner`, `super_admin` |
| `createPortalSession` | TanStack Server Fn | `stripe-checkout` (action: `create-portal-session`) | `admin`, `tenant_admin`, `shop_owner`, `super_admin` |
| `previewAddon` | TanStack Server Fn | `stripe-addons` (action: `preview`) | `admin`, `tenant_admin`, `shop_owner`, `super_admin` |
| `subscribeToAddon` | TanStack Server Fn | `stripe-addons` (action: `subscribe`) | `admin`, `tenant_admin`, `shop_owner`, `super_admin` |
| `cancelAddon` | TanStack Server Fn | `stripe-addons` (action: `cancel`) | `admin`, `tenant_admin`, `shop_owner`, `super_admin` |
| `reactivateAddon` | TanStack Server Fn | `stripe-addons` (action: `reactivate`) | `admin`, `tenant_admin`, `shop_owner`, `super_admin` |
| `updateAddonQuantity` | TanStack Server Fn | `stripe-addons` (action: `update-quantity`) | `admin`, `tenant_admin`, `shop_owner`, `super_admin` |
| `adminCreateAddonStripePrice` | TanStack Server Fn | `stripe-addons` (action: `admin-create-price`) | `super_admin` (estrito) |
| `/api/public/payments/webhook` | Nitro Route | `stripe-webhook` | Assinatura Criptográfica HMAC SHA-256 |
| `/api/public/subscriptions/webhook` | Nitro Route | Gateway de marketplace de terceiros (mantido no runtime de clientes) | Assinatura Gateway |

---

## 3. Arquitetura das Novas Edge Functions

### 3.1 `stripe-checkout` (`supabase/functions/stripe-checkout/index.ts`)
- **`create-plan-checkout`**:
  - Validação estrita de JWT do chamador.
  - Autoridade de preços server-side: resolve `price_id` da tabela `plans` (`stripe_price_id_test` / `stripe_price_id_live`), rejeitando IDs arbitrários do cliente.
  - Cálculo de dias restantes de trial a partir de `profiles.trial_end`.
  - Busca ou criação determinística de Stripe Customer com `metadata.userId`.
  - Criação de sessão de checkout embutida (`ui_mode: "embedded"`), com validação anti-open redirect para `return_url`.
  - Registro de auditoria em `saas_checkout_sessions`.
- **`create-portal-session`**:
  - Resolve `stripe_customer_id` da assinatura ativa ou busca via metadata no Stripe.
  - Cria sessão do Stripe Customer Billing Portal com `return_url` canônica.

### 3.2 `stripe-addons` (`supabase/functions/stripe-addons/index.ts`)
- **`preview`**: Projeta valores unitários e subtotais com base na quantidade solicitada.
- **`subscribe`**: Adiciona o add-on como subscription item no Stripe com proration imediato e vincula em `tenant_addons`.
- **`cancel`**: Marca cancelamento agendado ao fim do período (`cancel_at_period_end = true`).
- **`reactivate`**: Desfaz o cancelamento agendado.
- **`update-quantity`**: Atualiza a quantidade de licenças/assentos no Stripe e sincroniza o banco de dados.
- **`admin-create-price`**: Criação de `Product` e `Price` recorrente no Stripe exclusiva para `super_admin`.

### 3.3 `stripe-webhook` (`supabase/functions/stripe-webhook/index.ts`)
- **Raw Body & Web Crypto**: Leitura bruta do corpo da requisição (`await req.text()`) e verificação de assinatura HMAC SHA-256 em tempo constante contra `STRIPE_WEBHOOK_SECRET`.
- **Proteção Anti-Replay**: Rejeição de requisições com timestamp superior a 300 segundos.
- **Idempotência Atômica**: Invocação da RPC `claim_stripe_event` para garantir que cada `event_id` seja processado no máximo uma única vez, retornando HTTP 200 para eventos duplicados.
- **Eventos Suportados**:
  - `customer.subscription.created`: upsert em `subscriptions` e sincronização de `profiles.plan`.
  - `customer.subscription.updated`: atualização de plano, sincronização de itens e absorção de add-ons (`absorbAddonsIntoPlan`).
  - `customer.subscription.deleted`: cancelamento de assinatura e rebaixamento para plano `free`.
  - `checkout.session.completed`: confirmação de pagamento.
  - `invoice.paid`: reset de contadores de dunning em add-ons.
  - `invoice.payment_failed`: incremento de falhas de cobrança.

---

## 4. Idempotência e Migração de Banco de Dados

Arquivo preparado: `supabase/migrations/20260904160000_phase17c_m6e_stripe_idempotency.sql`

### 4.1 Tabela `public.stripe_processed_events`
- Garante unicidade por `event_id` (`CONSTRAINT uq_stripe_processed_events_event_id UNIQUE`).
- RLS ativado com permissões revogadas para `PUBLIC`, `anon` e `authenticated`, concedidas apenas a `service_role`.

### 4.2 RPC `public.claim_stripe_event`
- Executa inserção com `ON CONFLICT DO NOTHING`.
- Retorna `true` apenas para a primeira requisição concorrente e `false` para retransmissões subsequentes.
- Permissões: `SECURITY DEFINER`, `search_path = public, pg_temp`, restrito a `service_role`.

### 4.3 RPC `public.sync_subscription_atomic`
- Realiza o upsert atômico da assinatura e atualiza `profiles.plan` correspondente em uma única transação de banco.

---

## 5. Segurança, RBAC e Prevenção de Fraudes

1. **Autoridade de Preços**: O cliente nunca envia `price_id` arbitrário como autoridade de valor; o preço é sempre derivado da tabela de planos ou do catálogo de add-ons.
2. **Isolamento Multi-Tenant**: Um tenant não pode criar sessões de portal nem assinar add-ons em nome de outro estabelecimento.
3. **Bloqueio de Escalada de Privilégios**: Criação de preços de catálogo no Stripe restrita a `super_admin`.
4. **Validação de Limites de Quantidade**: Quantidades de add-ons são sanitizadas e limitadas entre `1` e `1000`.
5. **Zero Vazamento de PII e Segredos**: Chaves de API do Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) e detalhes de cartão nunca são gravados em código ou expostos em logs.

---

## 6. Resultados dos Testes de Validação

- **Testes de Assinatura Criptográfica Webhook**: 100% PASS (Validação HMAC, segredo incorreto, payload adulterado, timestamp expirado).
- **Testes de Concorrência e Idempotência**: 100% PASS (50 requisições simultâneas para o mesmo `event_id` resultam em exatamente 1 processamento).
- **Testes de Ciclo de Vida de Assinaturas e Add-ons**: 100% PASS (Criação, upgrade, downgrade, cancelamento, absorção).
- **Regressão Completa**: 273/273 testes PASS em todos os módulos M6D.1, M6D.2 e M6E.1.
