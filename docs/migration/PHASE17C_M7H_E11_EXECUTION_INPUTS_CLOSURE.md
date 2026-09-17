# =====================================================================
# BARBEX — PHASE 17C.M7H-E1.1
# CUTOVER EXECUTION INPUTS CLOSURE
# READ-ONLY / NO TARGET OR PROVIDER MUTATION REPORT
# =====================================================================

- **Phase:** PHASE 17C.M7H-E1.1
- **Execution Mode:** READ-ONLY EXECUTION INPUTS CLOSURE ONLY (Zero Mutations, Zero Probes, No Push)
- **Source Project Ref:** `wdxhjwodyctgzqtogkgv`
- **Target Project Ref:** `ywdwrstxvsdqiryhieiz`
- **Canonical Schema Release:** `BARBEX-CANONICAL-20260909-02b6e234`
- **M7H-E Authority:** `f5f9f5c05cfc8b09ac9060e3a73b2220bc048c20c8048c39793ae2798d1f81de`
- **M7H-E1 Authority:** `2c15bb08688556980e971c42dd2dfbe16d5c96c7204d60fbc117b2c1a548111c`
- **Generated At:** 2026-09-13T11:06:00.000Z
- **Final Decision:** `CUTOVER_EXECUTION_INPUTS_CLOSED_READY_FOR_F1`

---

## 0. Purpose & Executive Resolution

Phase 17C.M7H-E1.1 closes all execution-input ambiguities from M7H-E and M7H-E1 without performing any mutation on Source, Target, or third-party providers:
1. **Explicit Enumeration of Secrets:** Enumerate all exact 10 Target Edge secret names required by the runtime.
2. **Secret Reference Audit:** Proves `EDGE_SECRET_REFERENCES_UNACCOUNTED = 0` across all 38 Edge Functions and shared modules, properly classifying platform-provided variables (`SUPABASE_ANON_KEY`) and optional variables with proven fallbacks.
3. **Four Means Four Webhooks:** Formally incorporates and defines the **Gateway Webhook** alongside Stripe, Z-API, and Resend.
4. **Gateway Webhook Semantics:** Establishes `gateway-webhook` as an `EXTERNAL_PROVIDER_WEBHOOK` managing multi-gateway end-customer club subscriptions.
5. **Reconciled P1-03 Scope:** Updates P1-03 scope to `Stripe, Z-API, Resend, Gateway` (count = 4).
6. **Z-API Callback Template Resolution:** Formally validates the callback template `https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/zapi-webhook?barbershopId={barbershopId}` and proves payload `instanceId` binding.
7. **Environment Variable Alias Clarification:** Confirms `VITE_SUPABASE_PUBLISHABLE_KEY` is primary and `VITE_SUPABASE_ANON_KEY` is a compatibility alias in `src/integrations/supabase/client.ts`.
8. **F1 Scope Definition:** Confirms Target Auth is already 100% aligned (`F1_TARGET_AUTH_CONFIGURATION_REQUIRED = NO`), restricting Phase F1 strictly to Target Vault secrets configuration (10 actions).
9. **F5 Scope & Switch Order:** Details the 4 webhooks and their deterministic switch order.
10. **Dual-Delivery Safety Model:** Proves all 4 webhooks are `OVERLAP_SAFE` due to database-level idempotency ledgers.

---

## 1. Absolute Safety Boundary

Execution was strictly read-only:
- Zero secrets injected into Target Vault
- Zero Edge Functions deployed
- Zero Auth settings modified
- Zero environment variables switched
- Zero Stripe, Z-API, Resend, or Gateway configurations mutated
- Zero cron jobs activated
- Zero write endpoints invoked
- Zero git commits or pushes executed
- Source write freeze and Target foundation completely preserved

---

## 2. Verification of Prior Authorities

| Authority Artifact | Expected SHA-256 | Observed SHA-256 | Verification |
| :--- | :--- | :--- | :---: |
| `M7H_E_OPERATIONAL_READINESS_BUNDLE_SHA256` | `f5f9f5c05cfc8b09ac9060e3a73b2220bc048c20c8048c39793ae2798d1f81de` | `f5f9f5c05cfc8b09ac9060e3a73b2220bc048c20c8048c39793ae2798d1f81de` | **MATCH** |
| `M7H_E1_CUTOVER_DEPENDENCY_BUNDLE_SHA256` | `2c15bb08688556980e971c42dd2dfbe16d5c96c7204d60fbc117b2c1a548111c` | `2c15bb08688556980e971c42dd2dfbe16d5c96c7204d60fbc117b2c1a548111c` | **MATCH** |

- **`M7H_E_BUNDLE_HASH_MATCH`:** **YES**
- **`M7H_E1_BUNDLE_HASH_MATCH`:** **YES**

---

## 3. Foundation Drift Gate

- **Source State:**
  - Raw physical public rows: `257691`
  - `status_checks` rows: `256998`
  - `status_checks` max ID: `256998`
  - Write freeze: VALID (Zero drift)
  - WP-16 hotfix: Active & paused
  - `SOURCE_FREEZE_VALID`: **YES**

- **Target State:**
  - Canonical public rows: `257687`
  - `auth.users`: `10`
  - `auth.identities`: `12`
  - Storage: 5 buckets, 30 objects, 10,480,575 bytes
  - Base tables: 159 canonical (164 physical)
  - Triggers: 21 enabled in ORIGIN mode
  - `TARGET_FOUNDATION_VALID`: **YES**

---

## 4. Exact 10 Secret Names

The exact 10 secrets required by Target Edge runtime:
1. `SUPABASE_URL` (SUPABASE)
2. `SUPABASE_SERVICE_ROLE_KEY` (SUPABASE)
3. `STRIPE_SECRET_KEY` (STRIPE)
4. `STRIPE_WEBHOOK_SECRET` (STRIPE)
5. `RESEND_API_KEY` (RESEND)
6. `RESEND_FROM_EMAIL` (RESEND)
7. `OPENAI_API_KEY` (AI)
8. `CRON_SECRET` (CRON)
9. `PUSH_INTERNAL_SECRET` (SECURITY)
10. `SLACK_WEBHOOK_URL` (WEBHOOK)

- **`EDGE_SECRET_NAMES_TOTAL`:** `10`
- **`TARGET_EDGE_SECRETS_REQUIRED_TOTAL`:** `10`
- **`TARGET_EDGE_SECRETS_CURRENTLY_CONFIGURED`:** `0`
- **`TARGET_EDGE_SECRETS_TO_CONFIGURE`:** `10`

---

## 5. Secret Dependency Consistency & Platform Variables

Cross-referencing all 38 functions and `_shared/` modules identifies 22 distinct environment variable references:
- **10 Operator-Configured Secrets:** Matched 1-to-1 with the catalog above.
- **1 Platform-Provided Runtime Secret:**
  - `SUPABASE_ANON_KEY` (`PLATFORM_PROVIDED = YES`). Automatically injected into every Edge Function container in Deno runtime by Supabase platform.
- **11 Intentionally Optional Variables with Proven Fallbacks:**
  - `APP_URL`, `APP_BASE_URL`, `PUBLIC_APP_ORIGIN`: Proven fallback to `"https://barbex.shop"`
  - `CRON_WORKER_SECRET`: Fallback to `CRON_SECRET`
  - `STRIPE_TEST_SECRET_KEY`, `STRIPE_SANDBOX_API_KEY`: Fallback to `STRIPE_SECRET_KEY`
  - `PAYMENTS_SANDBOX_WEBHOOK_SECRET`, `PAYMENTS_LIVE_WEBHOOK_SECRET`: Fallback to `STRIPE_WEBHOOK_SECRET`
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: Optional push notification parameters

- **`EDGE_SECRET_REFERENCES_TOTAL`:** `22`
- **`EDGE_SECRET_REFERENCES_ACCOUNTED`:** `22`
- **`EDGE_SECRET_REFERENCES_UNACCOUNTED`:** `0`

---

## 6. Webhook Matrix (Four Means Four)

| Provider | Logical Purpose | Current Path | Planned Target Path | Idempotency | Dual Delivery |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Stripe** | SaaS Plan Billing & Subscriptions | `/api/public/subscriptions/webhook` | `/functions/v1/stripe-webhook` | `claim_stripe_event` | OVERLAP_SAFE |
| **Z-API** | WhatsApp Appointment Confirmations | `/api/webhooks/zapi/{barbershopId}` | `/functions/v1/zapi-webhook?barbershopId={barbershopId}` | `claim_zapi_event` | OVERLAP_SAFE |
| **Resend** | Email Delivery Events | `/api/public/resend-webhook` | `/functions/v1/resend-webhook` | `email_logs.provider_message_id` | OVERLAP_SAFE |
| **Gateway** | Customer Club Subscription Charges | `/api/public/payments/webhook` | `/functions/v1/gateway-webhook?gateway={gatewayId}` | `payment_gateway_logs` | OVERLAP_SAFE |

- **`WEBHOOK_SWITCH_COUNT`:** `4`

---

## 7. Gateway Webhook Closure

- **`GATEWAY_WEBHOOK_PROVIDER_IDENTITY`:** Multi-Gateway Customer Billing (Asaas, MercadoPago, Pagar.me configured per tenant)
- **`GATEWAY_WEBHOOK_LOGICAL_PURPOSE`:** Recurring end-customer club subscriptions and comanda payments
- **`GATEWAY_WEBHOOK_RUNTIME_REACHABLE`:** **YES** (Callable by external tenant payment gateways)
- **`GATEWAY_WEBHOOK_CURRENT_HANDLER`:** `src/routes/api/public/payments/webhook.ts`
- **`GATEWAY_WEBHOOK_TARGET_HANDLER`:** `supabase/functions/gateway-webhook`
- **`GATEWAY_WEBHOOK_CURRENT_CALLBACK_CONFIGURED`:** `https://barbex.shop/api/public/payments/webhook`
- **`GATEWAY_WEBHOOK_TARGET_CALLBACK_REQUIRED`:** **YES**
- **`GATEWAY_WEBHOOK_WRITES_DB`:** **YES** (`public.payment_gateway_logs`, `public.customer_subscriptions`)
- **`GATEWAY_WEBHOOK_IDEMPOTENCY_VALID`:** **YES** (Audit logging and subscription status normalization)
- **`GATEWAY_WEBHOOK_SECRET_DEPENDENCIES`:** `["SUPABASE_SERVICE_ROLE_KEY"]`
- **`GATEWAY_WEBHOOK_CUTOVER_ACTION_REQUIRED`:** Deploy `gateway-webhook` and update callback URLs in tenant gateway configurations
- **`GATEWAY_WEBHOOK_ROLLBACK_ACTION`:** Revert gateway callback URLs to Source endpoint
- **`GATEWAY_WEBHOOK_CLASSIFICATION`:** `EXTERNAL_PROVIDER_WEBHOOK`

---

## 8. Corrected P1-03 Scope

- **`P1_03_ORIGINAL_SCOPE_COMPLETE`:** **NO**
- **`P1_03_CORRECTED_SCOPE`:** `Stripe, Z-API, Resend, Gateway`
- **`P1_03_WEBHOOK_COUNT`:** `4`

---

## 9. Z-API Target Callback Template

- **`ZAPI_TARGET_CALLBACK_TEMPLATE_VALID`:** **YES**
- **`ZAPI_TARGET_CALLBACK_PATH`:** `/functions/v1/zapi-webhook`
- **`ZAPI_TARGET_QUERY_PARAMETERS`:** `barbershopId={barbershopId}`
- **`ZAPI_BARBERSHOP_ID_PARAMETER_REQUIRED`:** **NO** (Optional fallback; Z-API body payload automatically provides `instanceId`)
- **`ZAPI_BARBERSHOP_ID_BINDING_METHOD`:** Primary binding via payload `instanceId` matched against `public.whatsapp_instances.instance_id`; secondary fallback via query parameter `barbershopId` / `tenantId`

---

## 10. Environment Switch Exactness

- **`ENV_SWITCH_VARIABLE_COUNT`:** `7`
- **`VITE_PUBLISHABLE_AND_ANON_BOTH_REQUIRED`:** **NO**
- **`VITE_KEY_ALIAS_RELATIONSHIP`:** `VITE_SUPABASE_PUBLISHABLE_KEY` is primary; `VITE_SUPABASE_ANON_KEY` is fallback alias in `src/integrations/supabase/client.ts:8`. Both take the exact same Target anonymous JWT value. Setting both ensures 100% compatibility.

---

## 11. Edge Functions Deployment Preconditions (38 Functions)

- **`EDGE_FUNCTIONS_TOTAL`:** `38`
- **`EDGE_FUNCTIONS_SAFE_TO_DEPLOY_PASSIVELY`:** `38` (All functions can be uploaded to Target and remain dormant without executing writes)
- **`EDGE_FUNCTIONS_UNSAFE_TO_INVOKE_PRECUTOVER`:** `23` (Functions with write capability; must not receive production traffic before cutover)
- **`EDGE_FUNCTIONS_REQUIRING_SECRETS_BEFORE_DEPLOY`:** `0` (Supabase CLI deploys code without requiring secret values)
- **`EDGE_FUNCTIONS_REQUIRING_SECRETS_BEFORE_INVOKE`:** `38` (All functions require runtime secrets upon invocation)

---

## 12. F1 Scope Closure

- **`F1_TARGET_SECRET_CONFIGURATION_REQUIRED`:** **YES** (10 secrets via `supabase secrets set`)
- **`F1_TARGET_AUTH_CONFIGURATION_REQUIRED`:** **NO**
- **`F1_TARGET_AUTH_CHANGES_EXACT`:** `NONE (Target Auth Site URL and redirect configuration already match production https://barbex.shop/**)`
- **`F1_SECRET_ACTION_COUNT`:** `10`
- **`F1_AUTH_ACTION_COUNT`:** `0`
- **`F1_TOTAL_MUTATION_ACTIONS`:** `10`

---

## 13. F5 Scope Correction & Switch Order

- **`F5_WEBHOOKS_EXACT`:** `["Resend", "Gateway", "Z-API", "Stripe"]`
- **`F5_WEBHOOK_COUNT`:** `4`
- **`F5_WEBHOOK_SWITCH_ORDER`:**
  1. `Resend` (Email delivery telemetry; lowest business risk)
  2. `Gateway` (Multi-gateway subscription payments)
  3. `Z-API` (WhatsApp customer appointment confirmation replies)
  4. `Stripe` (Core SaaS subscription and billing checkout events)

---

## 14. Provider Dual-Delivery Safety

All 4 webhooks are classified as **`OVERLAP_SAFE`**:
- Atomic database-level idempotency ensures that duplicate event deliveries (from network retries or cutover boundary overlap) are safely deduplicated.
- Source remains write-frozen, guaranteeing zero split-brain mutations.

---

## 15. Draft F1 Execution Manifest

- **`F1_EXECUTION_MANIFEST_COMPLETE`:** **YES**
- **`F1_SECRET_ACTION_COUNT`:** `10`
- **`F1_AUTH_ACTION_COUNT`:** `0`
- **`F1_TOTAL_MUTATION_ACTIONS`:** `10`

---

## 16. Quality Verification

- **`GIT_DIFF_CHECK`:** `PASS`
- **`TYPESCRIPT`:** `PASS` (`tsc --noEmit` exit code 0)
- **`BUILD`:** `PASS` (`npm run build` exit code 0)
- **`SECRET_SCAN`:** `PASS` (0 plaintext secrets leaked)

---

## 17. Cryptographic Authority

- **`M7H_E11_EXECUTION_INPUTS_BUNDLE_SHA256`:**
  `c285dda351dd8ffbd55dd3e80c89f80d9b3d1ab8ba255b4969001d96f7ca040a`
