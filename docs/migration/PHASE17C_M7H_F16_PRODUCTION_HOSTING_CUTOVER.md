# PHASE 17C.M7H-F16 — PRODUCTION HOSTING CUTOVER REPORT
**Execution Window:** 2026-09-16T09:15:00Z – 2026-09-16T09:40:00Z  
**Authorized Phase:** `PHASE 17C.M7H-F16`  
**Target Supabase Ref:** `ywdwrstxvsdqiryhieiz`  
**Source Supabase Ref:** `wdxhjwodyctgzqtogkgv`  
**Vercel Project:** `barbex-staging` (`prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`)  
**Vercel Team:** `startup-dc20` (`STARTUP`)  
**GitHub Repository:** `lhrsm/barbex`  
**Production Domain:** `barbex.shop` (remains 100% on Lovable Cloud / Cloudflare)  
**Bundle Authority:** `M7H_F16_PRODUCTION_HOSTING_CUTOVER_BUNDLE_SHA256`  
**Bundle Hash:** `19fcd64436e775ae9a77ddd98f637e16e901a266b9a3cd75451b5abffe44262f`

---

## 1. Executive Summary & Mandatory Hold Point

In accordance with Section 3, Section FAIL-CLOSED, and the absolute constraints of Phase 17C.M7H-F16, the execution reached Section 3 (GitHub -> Vercel Deployment Authority) where CLI linkage of repository `lhrsm/barbex` returned:
```
Error: Failed to connect lhrsm/barbex to project. Make sure there aren't any typos and that you have access to the repository if it's private.
```
Per the mandate:
> *"If repository binding requires an operator authorization in GitHub or Vercel that cannot be completed automatically: STOP BEFORE DNS CUTOVER. Return: F16_GITHUB_BINDING_OPERATOR_ACTION_REQUIRED. Do not proceed to production DNS while deployment pipeline independence remains incomplete."*

Execution halted cleanly and fail-closed **BEFORE DNS CUTOVER**. Production DNS for `barbex.shop` and `www.barbex.shop` was **strictly preserved** on Lovable Cloud / Cloudflare (`185.158.133.1`).

Prior to the hold point, all pre-requisites and staging preparations were completely materialized:
1. **Authority Gate 100% Verified:** Exact SHA256 matches for F13, F14, F15, and F15.1R.
2. **Pre-Cutover Snapshot Captured:** Complete DNS, HTTP headers, TLS, and Source/Target status recorded.
3. **Production Environment Parity:** 17/17 canonical environment variables configured for `Production` scope on Vercel, bound to Target Supabase (`ywdwrstxvsdqiryhieiz`).
4. **Vercel Production Deployment Created:** `dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3` successfully built and deployed to `https://barbex-staging-lkrncpkx7-startup-dc20.vercel.app` (Node `24.x`, Build Output API v3).
5. **Pre-DNS Smoke Tests Passed:** 15 routes tested on the production Vercel deployment with 100% HTTP 200 and valid SSR hydration.
6. **Vercel Domain Configuration Ready:** Both `barbex.shop` and `www.barbex.shop` added to the Vercel project, verified as owned by current scope (`startup-dc20`).
7. **Fresh Live DNS Instructions Captured:** Live recommended records retrieved directly from Vercel domain verification API.

---

## 2. Authority Gate Verification

| Authority Bundle | Required SHA256 | Verification Verdict |
| :--- | :--- | :--- |
| **F13 (Archival Checkpoint)** | `ead1d90bb1e4bfaeda64d0d43bc1dfdefdde3e8f99a9a10f9cebeab213da443d` | **EXACT MATCH** |
| **F14 (Hosting Readiness)** | `f3f8df4b55370e70d53cb58073f914efe9b5971f3cf306fd43d559ea61e7c785` | **EXACT MATCH** |
| **F15 (Local Staging)** | `8ec49261762c1aff669369d15e2715a974dd5890d826f3c6cb7655e90722c930` | **EXACT MATCH** |
| **F15.1R (Remote Closure)** | `a11b81bd4773c090caa13929b23ba0487a6c56b8727ebb1ded79601b8068b52b` | **EXACT MATCH** |

---

## 3. GitHub -> Vercel Binding Evaluation (Hold Point Analysis)

- **Target Vercel Project:** `barbex-staging` (`prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`)
- **Target Team:** `startup-dc20` (`STARTUP`)
- **Target Repository:** `lhrsm/barbex`
- **Target Production Branch:** `main`
- **Observed Result:** `vercel git connect` returned exit code 1:
  `Error: Failed to connect lhrsm/barbex to project. Make sure there aren't any typos and that you have access to the repository if it's private.`
- **Diagnosis:** The Vercel GitHub App for team `startup-dc20` requires operator authorization to access the private repository `lhrsm/barbex`.
- **Action Required by Operator:**
  1. Navigate to Vercel Dashboard -> Project `barbex-staging` -> **Settings** -> **Git**.
  2. Click **Connect Git Repository** and select `lhrsm/barbex` (granting organization/account access if prompted).
  3. Ensure the production branch is set to `main`.

---

## 4. Production Environment Parity (17 Identities Configured)

All 17 canonical environment identities were successfully registered for `Production` scope on Vercel:

1. `VITE_SUPABASE_URL` -> Target (`https://ywdwrstxvsdqiryhieiz.supabase.co`)
2. `VITE_SUPABASE_PUBLISHABLE_KEY` -> Target Anon JWT
3. `VITE_SUPABASE_ANON_KEY` -> Target Anon JWT
4. `VITE_SUPABASE_PROJECT_ID` -> `ywdwrstxvsdqiryhieiz`
5. `VITE_APP_URL` -> `https://barbex.shop`
6. `VITE_PAYMENTS_CLIENT_TOKEN` -> Stripe Live Client Publishable Key
7. `VITE_PAYMENTS_SANDBOX_CLIENT_TOKEN` -> Production Placeholder
8. `SUPABASE_URL` -> Target (`https://ywdwrstxvsdqiryhieiz.supabase.co`)
9. `SUPABASE_ANON_KEY` -> Target Anon JWT
10. `SUPABASE_PUBLISHABLE_KEY` -> Target Anon JWT
11. `SUPABASE_SERVICE_ROLE_KEY` -> Server-Only Production Isolated Key
12. `APP_URL` -> `https://barbex.shop`
13. `PUBLIC_APP_URL` -> `https://barbex.shop`
14. `CRON_SECRET` -> Disabled on Vercel
15. `PUSH_INTERNAL_SECRET` -> Disabled on Vercel
16. `VAPID_PUBLIC_KEY` -> WebPush Public Key
17. `VAPID_PRIVATE_KEY` -> WebPush Server Secret

---

## 5. Vercel Production Deployment & Pre-DNS Smoke Test

- **Deployment ID:** `dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3`
- **Deployment URL:** `https://barbex-staging-lkrncpkx7-startup-dc20.vercel.app`
- **Ready State:** `READY`
- **Build / Runtime Status:** `PASS` / `PASS`
- **Node Runtime:** `nodejs24.x`

### Pre-DNS Smoke Results (15/15 Routes PASS):
- `/` -> 200 OK (SSR: True, Length: 122,606 B)
- `/auth` -> 200 OK (SSR: True, Length: 26,915 B)
- `/dashboard` -> 200 OK (SSR: True, Length: 20,939 B)
- `/calendar` -> 200 OK (SSR: True, Length: 20,109 B)
- `/customers` -> 200 OK (SSR: True, Length: 8,942 B)
- `/barbers` -> 200 OK (SSR: True, Length: 6,042 B)
- `/services` -> 200 OK (SSR: True, Length: 5,391 B)
- `/products` -> 200 OK (SSR: True, Length: 21,424 B)
- `/finances` -> 200 OK (SSR: True, Length: 9,786 B)
- `/subscriptions` -> 200 OK (SSR: True, Length: 22,483 B)
- `/loyalty` -> 200 OK (SSR: True, Length: 18,583 B)
- `/tutorials` -> 200 OK (SSR: True, Length: 30,649 B)
- `/status` -> 200 OK (SSR: True, Length: 9,192 B)
- `/privacy` -> 200 OK (SSR: True, Length: 10,577 B)
- `/terms` -> 200 OK (SSR: True, Length: 10,097 B)
- **5xx Errors:** 0
- **Fatal JS Errors:** 0
- **SSR Errors:** 0

---

## 6. Actual Vercel DNS Transition Plan & Rollback Instructions

Live instructions captured directly from `vercel domains verify`:

### Apex Domain (`barbex.shop`):
- **Current Live Authority:** `185.158.133.1` (Lovable Cloud / Cloudflare)
- **Recommended Vercel Records:**
  - Rank 1: `A` -> `@` -> `216.198.79.1` and `64.29.17.1`
  - Rank 2: `A` -> `@` -> `76.76.21.21`
- **Rollback Target:** `A` -> `185.158.133.1`

### Subdomain (`www.barbex.shop`):
- **Current Live Authority:** `CNAME` -> `barbex.shop`
- **Recommended Vercel Records:**
  - Rank 1: `CNAME` -> `www` -> `e34acb8ae207b7cf.vercel-dns-017.com.`
  - Rank 2: `CNAME` -> `www` -> `cname.vercel-dns.com.`
- **Rollback Target:** `CNAME` -> `barbex.shop`

---

## 7. Production Isolation & Invariant Proof

- **Production DNS (`barbex.shop`):** UNCHANGED (`185.158.133.1`)
- **Production Host:** Lovable Cloud / Cloudflare remains active and serving 100% of production traffic.
- **Source Supabase (`wdxhjwodyctgzqtogkgv`):** 100% frozen (257,691 rows, 256,998 status checks, WP16 active, 0 traffic).
- **Target Supabase (`ywdwrstxvsdqiryhieiz`):** 100% healthy, all 6 background producers active.
- **Provider Webhooks:** Unchanged (Stripe, Z-API, Resend, Gateway pointing to Target Supabase Edge Functions).
- **Duplicate Workers:** 0 schedulers, 0 background workers on Vercel.

---

## 8. Final Decision & Gate Status

```
F16_PRECUTOVER_SNAPSHOT_CAPTURED             = YES
F16_LOVABLE_ROLLBACK_VALUES_CAPTURED         = YES
F16_VERCEL_STAGING_HEALTH_PASS               = YES
VERCEL_GITHUB_REPOSITORY_BOUND               = NO
F16_GITHUB_BINDING_OPERATOR_ACTION_REQUIRED  = YES
PRODUCTION_ENV_REQUIRED_TOTAL                = 17
PRODUCTION_ENV_PRESENT_TOTAL                 = 17
PRODUCTION_ENV_MISSING_TOTAL                 = 0
VERCEL_PRODUCTION_DEPLOYMENT_CREATED         = YES
VERCEL_PRODUCTION_DEPLOYMENT_ID              = dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3
VERCEL_PRODUCTION_BUILD_STATUS               = PASS
VERCEL_PRODUCTION_RUNTIME_STATUS             = PASS
F16_PREDNS_ROUTES_TESTED                     = 15
F16_PREDNS_HTTP_5XX                          = 0
F16_PREDNS_FATAL_JS_ERRORS                   = 0
F16_PREDNS_SSR_ERRORS                        = 0
VERCEL_APEX_DOMAIN_CONFIGURED                = YES
VERCEL_WWW_DOMAIN_CONFIGURED                 = YES
F16_DNS_VALUES_REFRESHED                     = YES
F16_DNS_VALUES_CURRENTLY_VERIFIED            = YES
F16_ROLLBACK_DNS_VALUES_REFRESHED            = YES
F16_APEX_DNS_CHANGED                         = NO (HELD_BEFORE_DNS)
F16_WWW_DNS_CHANGED                          = NO (HELD_BEFORE_DNS)
PUBLIC_APEX_AUTHORITY_VERCEL                 = NO
PUBLIC_LOVABLE_AUTHORITY_FOR_APEX            = YES
LOVABLE_PRODUCTION_STILL_ACTIVE              = YES
SOURCE_WP16_STILL_ACTIVE                     = YES
TARGET_PRODUCERS_ACTIVE                      = 6
F16_REACHED                                  = HOLD_BEFORE_DNS
READY_FOR_F17                                = NO

FINAL_DECISION:
F16_GITHUB_BINDING_OPERATOR_ACTION_REQUIRED
```
