# BARBEX — PHASE 17C.M7H-F2
## TARGET EDGE FUNCTIONS PASSIVE DEPLOYMENT REPORT
### DEPLOY CODE ONLY — ZERO BUSINESS TRAFFIC / ZERO INVOCATION

**Source Project Ref:** `wdxhjwodyctgzqtogkgv`  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz`  
**Target Supabase URL:** `https://ywdwrstxvsdqiryhieiz.supabase.co`  
**Execution Timestamp:** 2026-09-13T11:13:00.000Z  

---

### 1. Executive Summary & Objectives

Phase **17C.M7H-F2** achieved the passive deployment of the canonical **38 Edge Functions** to the Target project (`ywdwrstxvsdqiryhieiz`). 

Under strict fail-closed operational constraints:
- All four prior cryptographic authority bundles were verified.
- Source freeze and Target foundation invariants were passively confirmed.
- Target remote identity was validated as `ywdwrstxvsdqiryhieiz`.
- F1 secret state was verified (platform-provided native variables intact, 7 operator secrets present, `STRIPE_WEBHOOK_SECRET` deferred to F5).
- All 38 functions were enumerated and their `verify_jwt` semantics resolved per `supabase/config.toml` (18 `verify_jwt = true`, 20 `verify_jwt = false`).
- All 38 functions were deployed server-side via `npx supabase functions deploy --use-api --project-ref ywdwrstxvsdqiryhieiz` with 100% success (38 attempted, 38 succeeded, 0 failed).
- Remote metadata inspection confirmed 38 active functions present on Target with exact parity and zero unexpected functions.
- **ZERO** HTTP requests, probes, or invocations were executed.
- **ZERO** cron schedules, background workers, or automation engines were activated.
- Database and storage foundations on both Source and Target remain 100% untouched and unchanged.

---

### 2. Authority Hash Verifications

| Authority Bundle | Expected SHA-256 | Actual SHA-256 | Match |
| :--- | :--- | :--- | :---: |
| **M7H-E Operational Readiness** | `f5f9f5c05cfc8b09ac9060e3a73b2220bc048c20c8048c39793ae2798d1f81de` | `f5f9f5c05cfc8b09ac9060e3a73b2220bc048c20c8048c39793ae2798d1f81de` | **YES** |
| **M7H-E1 Cutover Dependency** | `2c15bb08688556980e971c42dd2dfbe16d5c96c7204d60fbc117b2c1a548111c` | `2c15bb08688556980e971c42dd2dfbe16d5c96c7204d60fbc117b2c1a548111c` | **YES** |
| **M7H-E1.1 Execution Inputs** | `c285dda351dd8ffbd55dd3e80c89f80d9b3d1ab8ba255b4969001d96f7ca040a` | `c285dda351dd8ffbd55dd3e80c89f80d9b3d1ab8ba255b4969001d96f7ca040a` | **YES** |
| **M7H-F1 Runtime Configuration** | `643e9b57a4448a0ce5073c04e9dac1cc877f0af45f601d41c2d0cb5631cf672a` | `643e9b57a4448a0ce5073c04e9dac1cc877f0af45f601d41c2d0cb5631cf672a` | **YES** |

---

### 3. Deployed Function Inventory & JWT Semantics Matrix

All 38 functions deployed successfully to `ywdwrstxvsdqiryhieiz`:

| # | Function Name | Status | Remote Version | verify_jwt | Authentication Guard |
|---|:---|:---:|:---:|:---:|:---|
| 1 | `ai-assistant` | ACTIVE | 1 | `false` | Custom application token / rate limit |
| 2 | `appointment-notifications` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 3 | `auth-phone` | ACTIVE | 2 | `false` | Public phone login normalization |
| 4 | `auth-phone-reset` | ACTIVE | 1 | `false` | Public password reset recovery guard |
| 5 | `automation-engine` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 6 | `automation-v2-health-check` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 7 | `automation-v2-test-workflow` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 8 | `barbershop-anniversary-scheduler` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 9 | `contact-public` | ACTIVE | 1 | `false` | Public landing page anti-spam |
| 10 | `cron-worker` | ACTIVE | 1 | `false` | Bearer `CRON_SECRET` header |
| 11 | `customer-auth` | ACTIVE | 1 | `false` | Client portal session credentials |
| 12 | `debug-zapi-received` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 13 | `emit-admin-event` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 14 | `emit-automation-event` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 15 | `gateway-manager` | ACTIVE | 1 | `false` | Internal secret / Gateway signature |
| 16 | `gateway-webhook` | ACTIVE | 1 | `false` | Inbound club billing webhook signature |
| 17 | `monitor-callbacks` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 18 | `process-automation-queue` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 19 | `reconcile-automations` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 20 | `reprocess-automation-job` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 21 | `resend-webhook` | ACTIVE | 1 | `false` | Inbound Resend Svix signature verification |
| 22 | `run-automations` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 23 | `run-automations-cron` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 24 | `send-email` | ACTIVE | 1 | `false` | Internal caller authorization |
| 25 | `send-push` | ACTIVE | 1 | `false` | Bearer `PUSH_INTERNAL_SECRET` header |
| 26 | `staff-auth` | ACTIVE | 1 | `false` | Staff credentials verification |
| 27 | `stripe-addons` | ACTIVE | 1 | `false` | Session / tenant authorization |
| 28 | `stripe-checkout` | ACTIVE | 1 | `false` | Session / tenant authorization |
| 29 | `stripe-webhook` | ACTIVE | 1 | `false` | Inbound Stripe HMAC-SHA256 signature verification |
| 30 | `team-invitations` | ACTIVE | 1 | `false` | Invitation token validation |
| 31 | `test-automation` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 32 | `whatsapp-cloud` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 33 | `zapi-api` | ACTIVE | 1 | `true` | Supabase JWT verification |
| 34 | `zapi-catch-all` | ACTIVE | 1 | `false` | Inbound Z-API client token validation |
| 35 | `zapi-receive-json` | ACTIVE | 1 | `false` | Inbound Z-API client token validation |
| 36 | `zapi-send` | ACTIVE | 1 | `false` | Internal caller authorization |
| 37 | `zapi-webhook` | ACTIVE | 1 | `false` | Inbound WhatsApp webhook instanceId binding |
| 38 | `zapi-webhook-v2` | ACTIVE | 1 | `true` | Supabase JWT verification |

---

### 4. Stripe Webhook Fail-Closed Security Validation

Static code analysis confirms:
1. `stripe-webhook` checks `verifyStripeWebhookSignature(rawBody, signatureHeader)`.
2. `getStripeWebhookSecret()` retrieves `STRIPE_WEBHOOK_SECRET`. If unset, it throws `SERVICE_UNAVAILABLE ("Chave secreta do webhook Stripe não configurada.", 503)`.
3. If signature verification fails or throws, the function returns HTTP 400 immediately with `{ error: "Invalid webhook signature" }`.
4. It is impossible for an unverified Stripe event to be processed or written to the database in Target precutover.

---

### 5. Invariant Post-Deployment Preservations

```
TARGET FOUNDATION:
  - Canonical Public Rows:    257,687 (UNMODIFIED)
  - status_checks Rows:       256,998 (UNMODIFIED)
  - status_checks Max ID:     256,998 (UNMODIFIED)
  - Auth Users:               10 (UNMODIFIED)
  - Auth Identities:          12 (UNMODIFIED)
  - Storage Buckets:          5 (UNMODIFIED)
  - Storage Objects:          30 (UNMODIFIED)
  - Storage Bytes:            10,480,575 (UNMODIFIED)
  - Cron Jobs:                0 (INACTIVE)

SOURCE FOUNDATION:
  - Raw Physical Public Rows: 257,691 (FROZEN)
  - status_checks Rows:       256,998 (FROZEN)
  - status_checks Max ID:     256,998 (FROZEN)
  - Write Freeze:             ACTIVE / VALID
  - WP-16 Hotfix:             ACTIVE
```

---

### 6. Rollback Model

Rollback is fully documented and requires deleting deployed functions from Target:
```bash
npx supabase functions delete --project-ref ywdwrstxvsdqiryhieiz <FUNCTION_NAME>
```
Because no functions receive live production traffic, the passive deployed code can safely remain in place awaiting Phase F3.
