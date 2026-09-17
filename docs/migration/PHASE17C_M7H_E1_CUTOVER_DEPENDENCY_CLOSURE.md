# =====================================================================
# BARBEX — PHASE 17C.M7H-E1
# CUTOVER DEPENDENCY CLOSURE
# READ-ONLY / ZERO OPERATIONAL MUTATION REPORT
# =====================================================================

- **Phase:** PHASE 17C.M7H-E1
- **Execution Mode:** READ-ONLY FORENSIC CLOSURE ONLY (Zero Mutations, Zero Deployments, No Push)
- **Source Project Ref:** `wdxhjwodyctgzqtogkgv`
- **Target Project Ref:** `ywdwrstxvsdqiryhieiz`
- **Canonical Schema Release:** `BARBEX-CANONICAL-20260909-02b6e234`
- **Prior Authority Bundle (M7H-E):** `f5f9f5c05cfc8b09ac9060e3a73b2220bc048c20c8048c39793ae2798d1f81de`
- **Generated At:** 2026-09-13T10:56:00.000Z
- **Final Decision:** `CUTOVER_DEPENDENCY_CLOSURE_COMPLETE`

---

## 0. Executive Summary & Objective

Phase 17C.M7H-E1 resolves all operational dependencies identified during Pre-Cutover Inventory M7H-E without executing any mutating actions:
1. Formally attributes and analyzes the **3 P1 blockers** and **2 P2 items**.
2. Concludes forensic analysis on the single missing RPC reference (`get_automation_queue_stats`), proving zero regression risk and 100% parity with Source production.
3. Catalogs the exact **10 Target Edge secrets** to configure.
4. Classifies all **38 Supabase Edge Functions** into 5 operational deployment groups.
5. Identifies the exact **7 environment variables** and **4 provider webhooks** requiring boundary transition.
6. Details provider-specific actions for **Stripe** (3 actions), **Z-API** (2 actions), and **Resend** (3 actions).
7. Establishes the deterministic activation order for **6 scheduled producers**.
8. Constructs a cycle-free **20-node Cutover Dependency DAG** and outlines a small-phase execution plan (**F1 through F10**).

---

## 1. Absolute Safety Invariants

Execution was strictly read-only:
- Zero Edge Functions deployed
- Zero Target secrets set
- Zero Supabase / Lovable / Cloudflare environment variables modified
- Zero Stripe / Z-API / Resend webhooks altered
- Zero Auth redirect settings mutated
- Zero database cron jobs activated
- Zero active HTTP probes against production write paths
- Source write freeze and Target foundation completely intact

---

## 2. Verification of Prior Authority (M7H-E)

- **Expected M7H-E Bundle SHA-256:** `f5f9f5c05cfc8b09ac9060e3a73b2220bc048c20c8048c39793ae2798d1f81de`
- **Observed File Authority:** `f5f9f5c05cfc8b09ac9060e3a73b2220bc048c20c8048c39793ae2798d1f81de`
- **`M7H_E_BUNDLE_HASH_MATCH`:** **YES**

---

## 3. Foundation Invariants

- **Source State:**
  - Raw physical public rows: `257691`
  - `status_checks` rows: `256998`
  - `status_checks` max ID: `256998`
  - Write freeze: VALID (Zero write drift)
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

## 4. Exact Identification of the 3 P1 Blockers

| Blocker ID | Component | Description & Required Cutover Action | Affected Domain | Timing Constraint |
| :--- | :--- | :--- | :--- | :--- |
| **`P1-01`** | Target Supabase Secrets | Target project `ywdwrstxvsdqiryhieiz` requires 10 environment secrets configured via Supabase CLI (`npx supabase secrets set`) prior to activating Edge Functions. | Supabase Vault, Stripe, Resend, OpenAI | Must occur before Edge Function invocation and application publish. |
| **`P1-02`** | Target Edge Functions Deployment | All 38 functions under `supabase/functions/*` must be deployed to Target project `ywdwrstxvsdqiryhieiz` via `npx supabase functions deploy`. | Supabase Functions Runtime | Must occur before application publish and webhook switch. |
| **`P1-03`** | Provider Webhook Endpoints Cutover | Inbound webhook callback URLs on Stripe, Z-API, and Resend must be transitioned to Target Edge Function endpoints at the cutover boundary. | Stripe, Z-API, Resend | Must occur immediately following application publish. |

- **`P1_BLOCKER_COUNT`:** `3`

---

## 5. Exact Identification of the 2 P2 Items

| Item ID | Component | Description & Impact | Follow-up Phase | Safe to Defer? |
| :--- | :--- | :--- | :--- | :---: |
| **`P2-01`** | `get_automation_queue_stats` RPC | Optional telemetry RPC in `src/routes/automations.tsx` line 125. Never existed in Source database; UI gracefully handles null/error via initial React state. | Post-cutover feature iteration | **YES** |
| **`P2-02`** | Legacy Nitro API Routes | Legacy routes under `src/routes/api/**` superseded by native Edge Functions. | Post-cutover codebase cleanup | **YES** |

- **`P2_ITEM_COUNT`:** `2`

---

## 6. Missing RPC Forensic Resolution (`get_automation_queue_stats`)

- **`MISSING_RPC_NAME`:** `get_automation_queue_stats`
- **`MISSING_RPC_REFERENCE_FILES`:** `src/routes/automations.tsx`
- **`MISSING_RPC_CALL_SITES`:** Line 125: `const { data: qData } = await anySupabase.rpc('get_automation_queue_stats', { p_tenant_id: tenantId });`
- **`MISSING_RPC_RUNTIME_REACHABLE`:** **YES** (Invoked when accessing `/automations` route)
- **`MISSING_RPC_FEATURE`:** Secondary badge counter for queued/processing WhatsApp automation dispatches
- **`MISSING_RPC_SOURCE_EXISTS`:** **NO** (Audited in Source catalog: function was never created on Source)
- **`MISSING_RPC_TARGET_EXISTS`:** **NO** (Not present in canonical release `BARBEX-CANONICAL-20260909-02b6e234`)
- **`MISSING_RPC_IS_DEAD_CODE`:** **NO** (Active in UI component)
- **`MISSING_RPC_IS_LEGACY_ALIAS`:** **NO**
- **`MISSING_RPC_REPLACEMENT_FUNCTION_IF_ANY`:** Direct client query on `public.automation_v2_dispatches` (lines 131-143) and initial React state `{ pending: 0, sent: 0, failed: 0, lastRun: null }`
- **`MISSING_RPC_CUTOVER_IMPACT`:** **ZERO_IMPACT** (100% parity with live Source production behavior; call fails silently into `catch (e) { console.error(e); }`)
- **`MISSING_RPC_CLASSIFICATION`:** `OPTIONAL_FEATURE`

---

## 7. Edge Secret Inventory — Exact 10 Names

| Secret Name | Category | Used By Functions | Reusable Credential? | Provider |
| :--- | :--- | :--- | :---: | :--- |
| `SUPABASE_URL` | SUPABASE | Admin Client, Auth helpers | No (Target URL) | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | SUPABASE | Admin Client, Workers, Push, Email | No (Target Key) | Supabase |
| `STRIPE_SECRET_KEY` | STRIPE | `stripe-checkout`, `stripe-addons`, `cron-worker` | Yes | Stripe |
| `STRIPE_WEBHOOK_SECRET` | STRIPE | `stripe-webhook` | No (New Endpoint Secret) | Stripe |
| `RESEND_API_KEY` | RESEND | `send-email`, `team-invitations`, `staff-auth` | Yes | Resend |
| `RESEND_FROM_EMAIL` | RESEND | `send-email`, `team-invitations` | Yes (`no-reply@barbex.shop`) | Resend |
| `OPENAI_API_KEY` | AI | `ai-assistant` | Yes | OpenAI |
| `CRON_SECRET` | CRON | `cron-worker`, `send-email` | Yes | Internal |
| `PUSH_INTERNAL_SECRET` | SECURITY | `send-push` | Yes | Internal |
| `SLACK_WEBHOOK_URL` | WEBHOOK | `cron-worker` (Optional alerts) | Yes | Slack |

- **`EDGE_SECRET_NAMES_TOTAL`:** `10`
- **`TARGET_EDGE_SECRETS_REQUIRED_TOTAL`:** `10`
- **`TARGET_EDGE_SECRETS_CURRENTLY_CONFIGURED`:** `0`
- **`TARGET_EDGE_SECRETS_TO_CONFIGURE`:** `10`

---

## 8. Edge Functions Deployment Grouping (38 Functions)

- **Group A: Safe Passive Utilities (7 functions):**
  `automation-v2-health-check`, `automation-v2-test-workflow`, `debug-zapi-received`, `monitor-callbacks`, `run-automations`, `test-automation`, `zapi-api`
- **Group B: Webhook Receivers (7 functions):**
  `gateway-webhook`, `resend-webhook`, `stripe-webhook`, `zapi-catch-all`, `zapi-receive-json`, `zapi-webhook`, `zapi-webhook-v2`
- **Group C: Scheduled & Background Writers (7 functions):**
  `appointment-notifications`, `automation-engine`, `barbershop-anniversary-scheduler`, `cron-worker`, `process-automation-queue`, `reconcile-automations`, `run-automations-cron`
- **Group D: Internal & Service Dispatchers (8 functions):**
  `emit-admin-event`, `emit-automation-event`, `gateway-manager`, `reprocess-automation-job`, `send-email`, `send-push`, `whatsapp-cloud`, `zapi-send`
- **Group E: Externally Callable Application Functions (9 functions):**
  `ai-assistant`, `auth-phone`, `auth-phone-reset`, `contact-public`, `customer-auth`, `staff-auth`, `stripe-addons`, `stripe-checkout`, `team-invitations`

- **`EDGE_FUNCTIONS_TOTAL`:** `38`

---

## 9. Environment Variables — Exact Switch Set (7 Variables)

The 7 variables requiring value changes at cutover:
1. `VITE_SUPABASE_URL` (Frontend client URL -> `https://ywdwrstxvsdqiryhieiz.supabase.co`)
2. `VITE_SUPABASE_PUBLISHABLE_KEY` (Frontend client publishable anon key -> Target anon key)
3. `VITE_SUPABASE_ANON_KEY` (Frontend fallback anon key -> Target anon key)
4. `VITE_SUPABASE_PROJECT_ID` (Frontend project ref -> `ywdwrstxvsdqiryhieiz`)
5. `SUPABASE_URL` (Server & Edge runtime URL -> `https://ywdwrstxvsdqiryhieiz.supabase.co`)
6. `SUPABASE_ANON_KEY` (Server & Edge runtime anon key -> Target anon key)
7. `SUPABASE_SERVICE_ROLE_KEY` (Server & Edge runtime service-role key -> Target service-role key)
*(Note: `STRIPE_WEBHOOK_SECRET` will be updated in Target secrets for the new webhook endpoint).*

- **`ENV_SWITCH_VARIABLE_COUNT`:** `7`

---

## 10. Webhook Switch Exact Set (4 Webhooks)

1. **Stripe:** `/api/public/subscriptions/webhook` -> `https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/stripe-webhook`
2. **Z-API (WhatsApp):** `/api/webhooks/zapi/{barbershopId}` -> `https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/zapi-webhook?barbershopId={barbershopId}`
3. **Resend (Email):** `/api/public/resend-webhook` -> `https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/resend-webhook`
4. **Gateway (Subscriptions):** `/api/public/payments/webhook` -> `https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/gateway-webhook`

- **`WEBHOOK_SWITCH_COUNT`:** `4`

---

## 11. Third-Party Integration Details

### Stripe (3 Actions)
1. Configure `STRIPE_SECRET_KEY` and new `STRIPE_WEBHOOK_SECRET` in Target Supabase Vault.
2. Deploy `stripe-webhook`, `stripe-checkout`, `stripe-addons` to Target.
3. Update Webhook Destination URL in Stripe Developer Dashboard to Target Edge Function URL.
- Account reusable: **YES**
- Customer & Subscription IDs portable: **YES**
- Idempotency verified: **YES** (`claim_stripe_event` atomic transaction ledger)
- Dual delivery safe: **YES** (Source remains write-frozen; Target deduplicates by event ID)

### Z-API (2 Actions)
1. Deploy `zapi-webhook` and `zapi-send` to Target.
2. Update callback URLs in Z-API panel / instances for all 4 barbershop instances to Target URL.
- Instances reusable: **YES** (Data in `public.whatsapp_instances` already materialized)
- Phone number / QR re-pairing required: **NO**

### Resend (3 Actions)
1. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Target Supabase Vault.
2. Deploy `send-email` and `resend-webhook` to Target.
3. Update Webhook URL in Resend Dashboard to Target URL.
- Sending domain reusable: **YES** (`barbex.shop` DNS authentication unchanged)
- DNS changes required: **NO**

---

## 12. Scheduled Producers Activation Order (6 Producers)

Target background producers must be activated deterministically after write smoke tests pass:
1. `cron-worker` (Addons Reconcile & Expired Cleanup)
2. `cron-worker` (Review Reminders & Requests)
3. `cron-worker` (Admin Digest Email)
4. `automation-engine` / `process-automation-queue`
5. `barbershop-anniversary-scheduler`
6. `WP-16` Status Check Writer (Unpause only after full system stabilization)

- **`SCHEDULED_PRODUCERS_TOTAL`:** `6`

---

## 13. Pre-Cutover Actions Breakdown

- **`PREPARE_NOW_SAFE_COUNT`:** `5` (Target secrets, Edge Function deployment, Auth config, Environment staging, Provider endpoint preparation)
- **`CUTOVER_BOUNDARY_ONLY_COUNT`:** `5` (Stripe, Z-API, Resend, Gateway webhook switches, Application deployment publish)
- **`POST_PUBLISH_BEFORE_WRITERS_COUNT`:** `3` (Routing verification, Read-only smoke tests, Controlled write smoke tests)
- **`POST_VALIDATION_ACTIVATION_COUNT`:** `3` (Enable cron-worker, Enable automation queue, Unpause WP16)
- **`POST_CUTOVER_FOLLOWUP_COUNT`:** `4` (Soak observation window, Retire legacy Nitro routes, Implement `get_automation_queue_stats`, Retire Source write freeze)

---

## 14. Cutover Dependency DAG

- **`CUTOVER_DAG_COMPLETE`:** **YES**
- **`CUTOVER_DAG_NODE_COUNT`:** `20`
- **`CUTOVER_DAG_CYCLE_COUNT`:** `0` (Validated via topological sort; zero circular dependencies)

---

## 15. Checkpointed Execution Phases (F1 – F10)

- **`F1`:** Target Runtime Configuration (Secrets, Auth redirects)
- **`F2`:** Target Edge Functions Deployment (38 functions deployed)
- **`F3`:** Target Passive Health Verification (GET health checks, zero writes)
- **`F4`:** Application Environment Pre-Staging (Lovable / Cloudflare Pages envs)
- **`F5`:** Controlled Webhook Cutover Boundary (Stripe, Z-API, Resend endpoint updates)
- **`F6`:** Application Cutover Publish (Production frontend release)
- **`F7`:** Post-Cutover Read-Only Smoke Testing (15 tests)
- **`F8`:** Post-Cutover Write Smoke Testing (8 tests in staging tenant)
- **`F9`:** Background Writer Activation (Deterministic cron & worker enable)
- **`F10`:** Production Stabilization & Source Retirement (30-min telemetry soak)

---

## 16. Final Blocker Classification

- **`FINAL_P0_BLOCKERS`:** `0`
- **`FINAL_P1_BLOCKERS`:** `3`
- **`FINAL_P2_ITEMS`:** `2`

---

## 17. Quality Verification

- **`GIT_DIFF_CHECK`:** `PASS`
- **`TYPESCRIPT`:** `PASS` (`tsc --noEmit` exit code 0)
- **`BUILD`:** `PASS` (`npm run build` exit code 0)
- **`SECRET_SCAN`:** `PASS` (0 secrets leaked)

---

## 18. Cryptographic Authority

- **`M7H_E1_CUTOVER_DEPENDENCY_BUNDLE_SHA256`:**
  `2c15bb08688556980e971c42dd2dfbe16d5c96c7204d60fbc117b2c1a548111c`
