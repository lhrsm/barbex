# BARBEX — PHASE 17C.M7H-F1
## TARGET RUNTIME SECRET CONFIGURATION REPORT
### FIRST CONTROLLED TARGET RUNTIME MUTATION — PASSIVE VAULT ISOLATION

**Source Project Ref:** `wdxhjwodyctgzqtogkgv`  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz`  
**Target Supabase URL:** `https://ywdwrstxvsdqiryhieiz.supabase.co`  
**Execution Timestamp:** 2026-09-13T11:06:00.000Z  

---

### 1. Executive Summary & Objective

Phase **17C.M7H-F1** represents the first controlled Target runtime mutation stage of the Barbex cutover pipeline. Under strict zero-business-side-effect boundaries, this phase resolves and configures the Target Edge Functions runtime secrets without deploying functions, without invoking endpoints, without changing authentication, without touching DNS or application environment variables, and without mutating Source or Target database/storage foundations.

All prior authority hashes were strictly verified before mutation. The canonical 10-secret inventory established in E1.1 was audited against physical platform behaviors:
- **2 Platform-Provided Secrets:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are native platform-injected variables automatically bound to Target (`ywdwrstxvsdqiryhieiz`).
- **1 Deferred Secret:** `STRIPE_WEBHOOK_SECRET` cannot exist until the Target webhook endpoint is registered at Stripe in Cutover Phase F5 (`DEFERRED_TO_F5_PROVIDER_BOUNDARY`).
- **7 Operator-Managed Secrets:** `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OPENAI_API_KEY`, `CRON_SECRET`, `PUSH_INTERNAL_SECRET`, and `SLACK_WEBHOOK_URL` are classified, proven reusable without invalidating Source, and mapped to the Target Vault.

---

### 2. Authority Hash Verifications

| Authority Bundle | Expected SHA-256 | Actual SHA-256 | Match |
| :--- | :--- | :--- | :---: |
| **M7H-E Operational Readiness** | `f5f9f5c05cfc8b09ac9060e3a73b2220bc048c20c8048c39793ae2798d1f81de` | `f5f9f5c05cfc8b09ac9060e3a73b2220bc048c20c8048c39793ae2798d1f81de` | **YES** |
| **M7H-E1 Cutover Dependency** | `2c15bb08688556980e971c42dd2dfbe16d5c96c7204d60fbc117b2c1a548111c` | `2c15bb08688556980e971c42dd2dfbe16d5c96c7204d60fbc117b2c1a548111c` | **YES** |
| **M7H-E1.1 Execution Inputs** | `c285dda351dd8ffbd55dd3e80c89f80d9b3d1ab8ba255b4969001d96f7ca040a` | `c285dda351dd8ffbd55dd3e80c89f80d9b3d1ab8ba255b4969001d96f7ca040a` | **YES** |

---

### 3. Foundation Invariants Pre- and Post-Check

```
SOURCE FOUNDATION:
  - Raw Physical Public Rows: 257,691 (FROZEN)
  - status_checks Rows:       256,998 (FROZEN)
  - status_checks Max ID:     256,998 (FROZEN)
  - Write Freeze:             ACTIVE / VALID
  - WP-16 Hotfix:             ACTIVE

TARGET FOUNDATION:
  - Canonical Public Rows:    257,687 (159 tables aligned)
  - status_checks Rows:       256,998
  - status_checks Max ID:     256,998
  - Auth Users:               10
  - Auth Identities:          12
  - Storage Buckets:          5
  - Storage Objects:          30
  - Storage Bytes:            10,480,575
  - Triggers Enabled:         21 (ORIGIN replication mode)
  - Foundation Drift:         0
```

---

### 4. Canonical Secret Inventory & Classification Matrix

| Secret Name | Category | Classification | Source / Value Semantics | Dependent Functions |
| :--- | :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | SUPABASE | `PLATFORM_PROVIDED` | Auto-injected by Supabase Edge runtime (`https://ywdwrstxvsdqiryhieiz.supabase.co`) | `_shared/supabase-admin.ts`, `auth-phone` |
| `SUPABASE_SERVICE_ROLE_KEY` | SUPABASE | `PLATFORM_PROVIDED` | Auto-injected by Supabase Edge runtime (Target Service Role JWT) | `_shared/supabase-admin.ts`, `cron-worker` |
| `STRIPE_SECRET_KEY` | STRIPE | `OPERATOR_CONFIGURED_REUSABLE` | Stripe Administrative API Key (Shared account/environment) | `_shared/stripe.ts`, `stripe-checkout` |
| `STRIPE_WEBHOOK_SECRET` | STRIPE | `NOT_YET_OBTAINABLE` | Target endpoint signing secret; deferred to Cutover Phase F5 | `stripe-webhook` |
| `RESEND_API_KEY` | RESEND | `OPERATOR_CONFIGURED_REUSABLE` | Resend API key for `barbex.shop` transactional email | `_shared/resend.ts`, `send-email` |
| `RESEND_FROM_EMAIL` | RESEND | `OPERATOR_CONFIGURED_REUSABLE` | Canonical sender address (`no-reply@barbex.shop`) | `_shared/resend.ts`, `send-email` |
| `OPENAI_API_KEY` | AI | `OPERATOR_CONFIGURED_REUSABLE` | OpenAI API Key for assistant chat & embeddings | `ai-assistant` |
| `CRON_SECRET` | CRON | `OPERATOR_CONFIGURED_REUSABLE` | Internal automation authentication bearer token | `cron-worker`, `monitor-callbacks` |
| `PUSH_INTERNAL_SECRET` | SECURITY | `OPERATOR_CONFIGURED_REUSABLE` | Internal Web Push event dispatcher authentication bearer | `send-push`, `emit-admin-event` |
| `SLACK_WEBHOOK_URL` | WEBHOOK | `OPERATOR_CONFIGURED_REUSABLE` | Slack incoming webhook URL for operational alerting | `cron-worker`, `automation-v2-health-check` |

---

### 5. Architectural Consistency & Justifications

1. **Z-API Secret Justification:**
   - WhatsApp credentials (`token`, `instance_id`, `client_token`) are **NOT** global server environment secrets. They are tenant-isolated and stored securely in `public.whatsapp_instances` per barbershop. The `zapi-webhook` handler dynamically resolves credentials from the database via payload `instanceId`. Hence, no Z-API secrets are required in F1.
2. **Gateway Secret Justification:**
   - End-customer club subscription gateways (Asaas, MercadoPago, Pagar.me) store API keys and webhooks per tenant inside `public.payment_gateways`. The `gateway-webhook` handler resolves credentials via query parameter `?gateway={gatewayId}` directly from the database. Hence, no Gateway secrets are required in F1.
3. **Stripe Webhook Secret Deferral:**
   - The Target webhook signing secret cannot be fabricated. It is generated by Stripe when the new Target endpoint `https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/stripe-webhook` is created in Phase F5. Marking it `NOT_YET_OBTAINABLE` at Phase F1 is fail-safe and prevents credential mismatch.

---

### 6. Strict Isolation Invariants

- **Edge Functions Deployed:** 0
- **Edge Functions Invoked:** 0
- **Auth Configurations Mutated:** 0 (Site URL `https://barbex.shop` and Redirects `https://barbex.shop/**` already matched)
- **Provider Configurations Mutated:** 0
- **Target Public Data Mutated:** 0
- **Target Storage Mutated:** 0
- **Target Sequences Mutated:** 0
- **Source State Mutated:** 0 (Freeze completely intact)

---

### 7. Rollback Model

Because no functions are deployed or receiving traffic, rollback of Phase F1 requires only unsetting configured secrets via the Supabase Management CLI:
```bash
supabase secrets unset --project-ref ywdwrstxvsdqiryhieiz <SECRET_NAME>
```
Source credentials remain 100% isolated, unaffected, and immutable.
