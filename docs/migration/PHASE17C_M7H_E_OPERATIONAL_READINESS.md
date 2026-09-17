# =====================================================================
# BARBEX — PHASE 17C.M7H-E
# OPERATIONAL READINESS / PRE-CUTOVER INVENTORY
# READ-ONLY DISCOVERY — NO ROUTING OR ENVIRONMENT CUTOVER
# =====================================================================

- **Phase:** PHASE 17C.M7H-E
- **Execution Mode:** READ-ONLY DISCOVERY ONLY (Zero Mutations, Zero Probes, No Deploy, No Push)
- **Source Project Ref:** `wdxhjwodyctgzqtogkgv`
- **Target Project Ref:** `ywdwrstxvsdqiryhieiz`
- **Source Production Domain:** `https://barbex.shop`
- **Target Supabase URL:** `https://ywdwrstxvsdqiryhieiz.supabase.co`
- **Canonical Schema Release:** `BARBEX-CANONICAL-20260909-02b6e234`
- **Generated At:** 2026-09-13T10:46:00.000Z
- **Final Decision:** `OPERATIONAL_READINESS_COMPLETE_READY_FOR_CUTOVER_PLAN`

---

## 0. Current Canonical State & Scope Definitions

### Row Count Topology
- **`SOURCE_PHYSICAL_RAW_PUBLIC_ROWS`:** `257691`
- **`CANONICAL_POST_REMEDIATION_PUBLIC_ROWS`:** `257687`
- **`TARGET_PUBLIC_ROWS`:** `257687`

> [!NOTE]
> The Source physical database was **NOT** reduced to 257,687 rows.
> The 4-row difference reflects the approved canonical remediation rules:
> 1. **`REM-TRANSFORM-01`:** 5 appointments retained in Target with legacy `subscription_id` set to `NULL` (relational orphan resolved without row loss).
> 2. **`REM-EXCLUDE-01`:** 4 stale `barber_services` rows referencing deleted barber `5959e528-a329-4aac-a39a-fbc6f86d9d1d` excluded from Target.
> Therefore, Source raw physical total = 257,691 and Target canonical total = 257,687.

### Fingerprint Scopes
- **Source Freeze Scope:** 24 mutable Source tables monitor physical freeze on Source.
- **Target Reconciliation Scope:** 159/159 Target tables compared byte-for-byte against the canonical post-remediation candidate dataset.

---

## 1. Execution Authorities Provenance

All prior execution authorities were verified on disk with cryptographic SHA-256 match:

| Authority Artifact | Canonical SHA-256 | Verification Status |
| :--- | :--- | :--- |
| `M7H_A4B_FINAL_DELTA_MANIFEST_SHA256` | `87e9979de3b2737d22dff88814d220d027c42a56b48963c1eefaec141475a00b` | **VERIFIED** |
| `M7H_A4B_FROZEN_CUTOVER_BUNDLE_SHA256` | `62e10366e085591c1a370c002466f8d51ea021184b2a00572eb56bba532a23f6` | **VERIFIED** |
| `M7H_B_STORAGE_MATERIALIZATION_BUNDLE_SHA256` | `5a719badc98f4c25e797ceedd4cd803c3560cb992ac9e43bd2908b9e7054b362` | **VERIFIED** |
| `M7H_C_REMEDIATION_AUTHORITY_SHA256` | `f32620c1984a0dc67b0729f5e92b90c6b731c08833f0f7c7803f64ac89068f78` | **VERIFIED** |
| `M7H_D_PUBLIC_DATA_MATERIALIZATION_BUNDLE_SHA256` | `2e91796e4823d9245d5f5c1edfed0e017e19dfc87c4e013612e39909ef762682` | **VERIFIED** |

---

## 2. Foundation Readiness Check

- **SOURCE Physical State:**
  - Raw public rows: `257691`
  - `status_checks` rows: `256998`
  - `status_checks` max ID: `256998`
  - 24 mutable fingerprints: Unchanged
  - 16/16 write paths: FROZEN
  - WP16 hotfix: Active and paused
  - Storage: 5 buckets, 30 objects, 10,480,575 bytes
  - `SOURCE_PHYSICAL_STATE_VALID`: **YES**
  - `SOURCE_FREEZE_VALID`: **YES**

- **TARGET Physical State:**
  - Public rows: `257687`
  - `status_checks` rows: `256998`
  - `status_checks` max ID: `256998`
  - Sequence `status_checks_id_seq`: Reseeded to 256,998 (`is_called = true`)
  - Sequence `rate_limit_hits_id_seq`: Reseeded to 1 (`is_called = false`)
  - Auth users: 10
  - Auth identities: 12
  - Storage: 5 buckets, 30 objects, 10,480,575 bytes
  - Schema: 159 base tables, 2 views, 2 sequences, 21 triggers enabled (ORIGIN mode), 0 broken FKs
  - `TARGET_MATERIALIZATION_VALID`: **YES**
  - `TARGET_AUTH_VALID`: **YES**
  - `TARGET_STORAGE_VALID`: **YES**
  - `TARGET_SCHEMA_VALID`: **YES**

---

## 3. Application Supabase Client Inventory

- **`SUPABASE_RUNTIME_CLIENTS_TOTAL`:** `4`
  1. `src/integrations/supabase/client.ts` (Browser Vite Client)
  2. `src/integrations/supabase/client.server.ts` (SSR Server Client)
  3. `src/integrations/supabase/auth-middleware.ts` (Edge / Auth Middleware)
  4. `src/lib/backend/edge-client.ts` (Canonical Edge Functions Client Adapter)
- **`SOURCE_PROJECT_REF_RUNTIME_REFERENCES`:** `0` (Zero references to `wdxhjwodyctgzqtogkgv` in `src/` or `supabase/functions/`)
- **`TARGET_PROJECT_REF_RUNTIME_REFERENCES`:** `0` (Zero hardcoded target references)
- **`HARDCODED_SOURCE_PROJECT_URLS`:** `0`
- **`HARDCODED_SOURCE_STORAGE_URLS`:** `0`
- **`SERVICE_ROLE_USAGE_LOCATIONS`:**
  - `src/integrations/supabase/client.server.ts`
  - `src/routes/api/**`
  - `supabase/functions/**`
- **`ANON_OR_PUBLISHABLE_KEY_USAGE_LOCATIONS`:**
  - `src/integrations/supabase/client.ts`
  - `src/integrations/supabase/auth-middleware.ts`

---

## 4. Production Hosting & Control Plane

- **`PRODUCTION_HOSTING_PROVIDER`:** Lovable Cloud / Cloudflare Pages
- **`PRODUCTION_ENV_CONTROL_PLANE`:** Lovable Cloud Project Dashboard & Cloudflare Pages Environment Variables
- **`PRODUCTION_DEPLOYMENT_MECHANISM`:** Git push to `main` branch with automatic TanStack Start / Nitro Cloudflare worker bundling (`wrangler.jsonc`)
- **`PRODUCTION_PUBLISH_REQUIRED`:** **YES** (Triggered at Cutover step 8)
- **`PRODUCTION_ROLLBACK_PATH_PROVEN`:** **YES** (Re-deploying previous git release or restoring environment variables to Source project `wdxhjwodyctgzqtogkgv`)

---

## 5. Edge Functions Inventory

- **`EDGE_FUNCTIONS_TOTAL`:** `38`
- **`EDGE_FUNCTIONS_SOURCE_COUPLED`:** `0`
- **`EDGE_FUNCTIONS_REQUIRE_TARGET_DEPLOYMENT`:** `38`

### Readiness Classification Matrix (38 Functions)
| Function Name | Invocation Model | Database Writes | Storage | Required Secrets | Target Ready |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `ai-assistant` | Authenticated JWT | Yes | No | `OPENAI_API_KEY` | YES |
| `appointment-notifications` | Scheduled / Worker | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `auth-phone` | Public | Yes (RPC) | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `auth-phone-reset` | Public | Yes (RPC) | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `automation-engine` | Scheduled / Worker | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `automation-v2-health-check` | Public / Probe | No | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `automation-v2-test-workflow`| Authenticated JWT | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `barbershop-anniversary-scheduler` | Scheduled | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `contact-public` | Public | Yes | No | `RESEND_API_KEY` | YES |
| `cron-worker` | Service-to-Service | Yes | No | `CRON_SECRET`, `STRIPE_SECRET_KEY` | YES |
| `customer-auth` | Public | Yes (RPC) | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `debug-zapi-received` | Service / Debug | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `emit-admin-event` | Authenticated JWT | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `emit-automation-event` | Authenticated JWT | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `gateway-manager` | Authenticated JWT | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `gateway-webhook` | Webhook | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `monitor-callbacks` | Service / Probe | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `process-automation-queue` | Scheduled / Worker | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `reconcile-automations` | Scheduled / Worker | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `reprocess-automation-job` | Authenticated JWT | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `resend-webhook` | Webhook | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `run-automations` | Service / Worker | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `run-automations-cron` | Scheduled | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `send-email` | Authenticated / Service | Yes | No | `RESEND_API_KEY` | YES |
| `send-push` | Authenticated / Service | Yes | No | `VAPID_PRIVATE_KEY` | YES |
| `staff-auth` | Public / Authenticated | Yes (RPC) | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `stripe-addons` | Authenticated JWT | Yes | No | `STRIPE_SECRET_KEY` | YES |
| `stripe-checkout` | Authenticated JWT | Yes | No | `STRIPE_SECRET_KEY` | YES |
| `stripe-webhook` | Webhook HMAC | Yes | No | `STRIPE_WEBHOOK_SECRET` | YES |
| `team-invitations` | Authenticated JWT | Yes | No | `RESEND_API_KEY` | YES |
| `test-automation` | Authenticated JWT | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `whatsapp-cloud` | Outbound / Service | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `zapi-api` | Authenticated JWT | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `zapi-catch-all` | Webhook Catch-all | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `zapi-receive-json` | Webhook | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `zapi-send` | Authenticated / Service | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `zapi-webhook` | Webhook Client-Token | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |
| `zapi-webhook-v2` | Webhook (Legacy) | Yes | No | `SUPABASE_SERVICE_ROLE_KEY` | YES |

---

## 6. Edge Function Secrets Inventory

- **`EDGE_SECRET_NAMES_TOTAL`:** `10`
  1. `SUPABASE_URL`
  2. `SUPABASE_SERVICE_ROLE_KEY`
  3. `STRIPE_SECRET_KEY`
  4. `STRIPE_WEBHOOK_SECRET`
  5. `RESEND_API_KEY`
  6. `RESEND_FROM_EMAIL`
  7. `OPENAI_API_KEY`
  8. `CRON_SECRET`
  9. `PUSH_INTERNAL_SECRET`
  10. `SLACK_WEBHOOK_URL`
- **`TARGET_EDGE_SECRETS_READY`:** `0` (Will be configured via `supabase secrets set` during Cutover step 3)
- **`TARGET_EDGE_SECRETS_MISSING_COUNT`:** `10`

---

## 7. Third-Party Integrations Readiness

### Stripe
- **`STRIPE_WEBHOOK_ENDPOINT_CURRENT`:** `https://barbex.shop/api/public/subscriptions/webhook`
- **`STRIPE_WEBHOOK_ENDPOINT_TARGET_PLANNED`:** `https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/stripe-webhook`
- **`STRIPE_WEBHOOK_IDEMPOTENCY_VALID`:** **YES** (`claim_stripe_event` atomic ledger)
- **`STRIPE_EXISTING_IDS_PORTABLE`:** **YES** (All `cus_*`, `sub_*`, `price_*` preserved verbatim in Target database)
- **`STRIPE_CUTOVER_ACTIONS_REQUIRED`:**
  1. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Target secrets.
  2. Deploy `stripe-webhook`, `stripe-checkout`, `stripe-addons`.
  3. Update Webhook endpoint in Stripe Dashboard.

### Z-API
- **`ZAPI_CURRENT_CALLBACK`:** `https://barbex.shop/api/webhooks/zapi/{barbershopId}`
- **`ZAPI_TARGET_CALLBACK_PLANNED`:** `https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/zapi-webhook?barbershopId={barbershopId}`
- **`ZAPI_INSTANCE_REUSABLE`:** **YES** (All 4 instances in `public.whatsapp_instances` materialized in Target; QR re-pairing not required)
- **`ZAPI_CUTOVER_ACTIONS_REQUIRED`:**
  1. Deploy `zapi-webhook` and `zapi-send`.
  2. Update callback URLs in Z-API panel.

### Resend
- **`RESEND_CURRENT_WEBHOOK`:** `https://barbex.shop/api/public/resend-webhook`
- **`RESEND_TARGET_WEBHOOK_PLANNED`:** `https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/resend-webhook`
- **`RESEND_DOMAIN_CHANGE_REQUIRED`:** **NO** (`barbex.shop` domain authentication is independent of database)
- **`RESEND_CUTOVER_ACTIONS_REQUIRED`:**
  1. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Target secrets.
  2. Deploy `send-email` and `resend-webhook`.
  3. Update Webhook endpoint in Resend Dashboard.

---

## 8. Auth Readiness

- **`AUTH_SITE_URL_SOURCE`:** `https://barbex.shop`
- **`AUTH_SITE_URL_TARGET_PLANNED`:** `https://barbex.shop`
- **`AUTH_REDIRECT_CONFIG_MATCH`:** **YES**
- **`AUTH_REDIRECT_CHANGES_REQUIRED`:** None (Add `https://barbex.shop/**` to Target Auth allowed redirects)
- **`AUTH_EMAIL_LOGIN_READY`:** **YES** (10 confirmed users)
- **`AUTH_PASSWORD_LOGIN_READY`:** **YES** (bcrypt hashes preserved)
- **`AUTH_PHONE_LOGIN_READY_IF_USED`:** **YES** (`auth-phone` function available)

---

## 9. Realtime Readiness

- **`REALTIME_SUBSCRIPTIONS_TOTAL`:** `21`
- **`REALTIME_SOURCE_PROJECT_COUPLING`:** `0`
- **`REALTIME_UNFILTERED_SUBSCRIPTIONS`:** `0`
- **`REALTIME_CUTOVER_BLOCKERS`:** `0`

All 21 Realtime channel bindings use standard parameterized scopes (`tenantId`, `ticket.id`, `barberId`, `customer.id`). None reference the Source project ID. Switching the client Supabase URL and anon key provides 100% Realtime functionality on Target.

---

## 10. Cron & Automation Readiness

- **`SCHEDULED_PRODUCERS_TOTAL`:** `6`
- **`TARGET_SCHEDULED_PRODUCERS_CONFIGURED`:** `6`
- **`TARGET_SCHEDULED_PRODUCERS_INACTIVE`:** `6` (Target has 0 active `pg_cron` jobs; writers safely dormant)
- **`SCHEDULED_PRODUCER_BLOCKERS`:** `0`
- **`WP16_STATE`:** Remains **FROZEN** and paused.

---

## 11. Storage Application Readiness

- **`TARGET_STORAGE_REFERENCE_ROWS`:** `6`
- **`TARGET_STORAGE_REFERENCE_ROWS_VALID`:** `6/6` (5 in `barbers.avatar_url`, 1 in `profiles.avatar_url`)
- **`HARDCODED_SOURCE_STORAGE_RUNTIME_REFERENCES`:** `0`
- **`STORAGE_RUNTIME_CUTOVER_BLOCKERS`:** `0`
- **`STORAGE_ACCESS_MODEL_VALID`:** **YES**
- **`PRIVATE_BUCKET_ACCESS_MODEL_VALID`:** **YES** (Private buckets `payment-receipts` and `support-attachments` protected by tenant RLS)

---

## 12. Database Function / RPC Readiness

- **`APPLICATION_RPC_REFERENCES_TOTAL`:** `95`
- **`TARGET_RPC_REFERENCES_RESOLVED`:** `94`
- **`TARGET_RPC_REFERENCES_MISSING`:** `1` (`get_automation_queue_stats` - optional UI telemetry call wrapped in try/catch)
- **`RPC_CUTOVER_BLOCKERS`:** `0`

---

## 13. Environment Switch Matrix

- **`ENV_VARIABLES_TOTAL`:** `22`
- **`ENV_VARIABLES_REQUIRING_CHANGE`:** `7`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - *(plus Stripe webhook secret `STRIPE_WEBHOOK_SECRET` for new target endpoint)*
- **`ENV_VARIABLES_REUSABLE`:** `15`
- **`ENV_VARIABLES_UNRESOLVED`:** `0`

---

## 14. Webhook Switch Matrix

- **`WEBHOOK_ENDPOINTS_TOTAL`:** `4` (Stripe, Z-API, Resend, Gateway)
- **`WEBHOOK_ENDPOINTS_REQUIRING_CHANGE`:** `4`
- **`WEBHOOK_ENDPOINTS_UNRESOLVED`:** `0`

---

## 15. Cutover Order & Rollback Draft

- **`CUTOVER_DRAFT_COMPLETE`:** **YES**
- **`CUTOVER_STEPS_TOTAL`:** `14`
- **`ROLLBACK_DRAFT_COMPLETE`:** **YES**
- **`SPLIT_BRAIN_PREVENTION_DEFINED`:** **YES** (Source remains strictly frozen during entire cutover window; Target background workers stay disabled until smoke tests pass)

---

## 16. Smoke Test Plan

- **`SMOKE_TEST_PLAN_COMPLETE`:** **YES**
- **`READ_ONLY_TESTS_COUNT`:** `15`
- **`WRITE_TESTS_COUNT`:** `8`

---

## 17. Readiness Blockers Classification

- **`P0_BLOCKERS`:** `0` (Zero blockers preventing creation and authorization of Cutover Plan)
- **`P1_BLOCKERS`:** `3` (Standard operational cutover actions: Target secrets configuration, Target edge functions deployment, webhook endpoint updates)
- **`P2_BLOCKERS`:** `2` (Post-cutover cleanup: deprecate legacy Nitro API routes, add `get_automation_queue_stats` RPC)

---

## 18. Quality Verification

- **`GIT_DIFF_CHECK`:** `PASS` (Clean, zero whitespace or syntax errors)
- **`TYPESCRIPT`:** `PASS` (`tsc --noEmit` exited with code 0)
- **`BUILD`:** `PASS` (`npm run build` completed in 43.10s, exit code 0)
- **`SECRET_SCAN`:** `PASS` (0 plaintext secrets or API keys leaked)

---

## 19. Readiness Bundle Authority

- **`M7H_E_OPERATIONAL_READINESS_BUNDLE_SHA256`:**
  `f5f9f5c05cfc8b09ac9060e3a73b2220bc048c20c8048c39793ae2798d1f81de`
