# PHASE 17C.M7H-F15.1R — VERCEL REMOTE STAGING CLOSURE REPORT
**Execution Window:** 2026-09-15T15:30:00Z – 2026-09-15T16:55:00Z  
**Authorized Phase:** `PHASE 17C.M7H-F15.1R`  
**Target Supabase Ref:** `ywdwrstxvsdqiryhieiz`  
**Source Supabase Ref:** `wdxhjwodyctgzqtogkgv`  
**GitHub Repository:** `lhrsm/barbex`  
**Production Domain:** `barbex.shop` (remains 100% on Lovable Cloud / Cloudflare)  
**Bundle Authority:** `M7H_F151R_VERCEL_REMOTE_STAGING_CLOSURE_BUNDLE_SHA256`  
**Bundle Hash:** `a11b81bd4773c090caa13929b23ba0487a6c56b8727ebb1ded79601b8068b52b`

---

## 1. Executive Summary & Context

Phase 17C.M7H-F15 physically proved local Vercel compatibility (Build Output API v3, `nodejs24.x`, clean decoupling from Lovable build plugins, 0 secrets exposed, HTTP 200 across local preview). However, Phase 17C.M7H-F15.1 previously stopped fail-closed because authenticated Vercel access was not available.

Upon operator authentication (`analistalouis-6644` in team `startup-dc20`), Phase 17C.M7H-F15.1R resumed execution from Section 5 onwards to complete the missing remote half of Phase F15:
1. **Remote Project Materialized:** Linked and configured Vercel project `barbex-staging` (`prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`) under team `startup-dc20`.
2. **Canonical Environment Variables Reconciled:** 17/17 environment variables configured for the Preview environment, binding all Supabase services to Target Supabase (`ywdwrstxvsdqiryhieiz`).
3. **Real Remote Vercel Preview Deployed:** Successfully deployed live to Vercel (`dpl_7HrVsYsxPXkB5Pt1LWAE3XzYiB2z`, URL: `https://barbex-staging-8s6t1ofu6-startup-dc20.vercel.app`, aliased: `https://barbex-staging.vercel.app`).
4. **Comprehensive Remote Smoke Pass:** 19 routes tested on `*.vercel.app`, achieving 100% HTTP 200 with full SSR hydration, zero 5xx errors, zero fatal JS errors, and zero hydration mismatches.
5. **Strict Production & Source Invariants:** Zero DNS changes to `barbex.shop`, Lovable Cloud production remains 100% active, Source Supabase remains 100% frozen under WP16 with 257,691 rows, and Target Supabase remains 100% healthy.
6. **Actual F16 DNS Transition Plan Captured:** Live DNS records and rollback instructions verified for upcoming Phase F16 cutover.

---

## 2. Prior Authority Verification Gate

| Authority Bundle | Required SHA256 | Verification Verdict |
| :--- | :--- | :--- |
| **F13 (Archival Checkpoint)** | `ead1d90bb1e4bfaeda64d0d43bc1dfdefdde3e8f99a9a10f9cebeab213da443d` | **EXACT MATCH** |
| **F14 (Hosting Readiness)** | `f3f8df4b55370e70d53cb58073f914efe9b5971f3cf306fd43d559ea61e7c785` | **EXACT MATCH** |
| **F15 (Local Staging)** | `8ec49261762c1aff669369d15e2715a974dd5890d826f3c6cb7655e90722c930` | **EXACT MATCH** |
| **F15.1 (Blocked Authority)** | `3831358f30af63fa719b1bf58fc38a40e0ee81ea7035ec6b66a4adbabc6edfb1` | **EXACT MATCH** |

---

## 3. Physical Vercel Project & Deployment Metrics

- **Authenticated Operator:** `analistalouis-6644`
- **Active Vercel Team:** `startup-dc20` (`STARTUP`)
- **Vercel CLI Version:** `59.17.0` (Node.js `24.19.0`)
- **Project Name:** `barbex-staging`
- **Project ID:** `prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`
- **Repository Bound:** `NO` (CLI-driven decoupled deployment)
- **Production Domain Bound:** `NO` (Strict isolation from `barbex.shop`)
- **Runtime Preset:** `vercel` (Build Output API v3)
- **Serverless Runtime:** `nodejs24.x` (Sandbox Region: `iad1`)
- **Live Preview Deployment ID:** `dpl_7HrVsYsxPXkB5Pt1LWAE3XzYiB2z`
- **Live Preview URL:** `https://barbex-staging-8s6t1ofu6-startup-dc20.vercel.app`
- **Live Project Aliased URL:** `https://barbex-staging.vercel.app`
- **Build Status:** `PASS`
- **Runtime Status:** `PASS`

---

## 4. Canonical Environment Parity (17 Identities)

All 17 canonical environment identities were successfully registered for the `Preview` scope:

1. `VITE_SUPABASE_URL` -> Target (`https://ywdwrstxvsdqiryhieiz.supabase.co`)
2. `VITE_SUPABASE_PUBLISHABLE_KEY` -> Target Anon JWT
3. `VITE_SUPABASE_ANON_KEY` -> Target Anon JWT
4. `VITE_SUPABASE_PROJECT_ID` -> `ywdwrstxvsdqiryhieiz`
5. `VITE_APP_URL` -> `https://barbex-staging.vercel.app`
6. `VITE_PAYMENTS_CLIENT_TOKEN` -> Stripe Live Client Publishable Key
7. `VITE_PAYMENTS_SANDBOX_CLIENT_TOKEN` -> Sandbox Placeholder
8. `SUPABASE_URL` -> Target (`https://ywdwrstxvsdqiryhieiz.supabase.co`)
9. `SUPABASE_ANON_KEY` -> Target Anon JWT
10. `SUPABASE_PUBLISHABLE_KEY` -> Target Anon JWT
11. `SUPABASE_SERVICE_ROLE_KEY` -> Server-Only Preview Isolated Key
12. `APP_URL` -> `https://barbex-staging.vercel.app`
13. `PUBLIC_APP_URL` -> `https://barbex-staging.vercel.app`
14. `CRON_SECRET` -> Disabled for preview
15. `PUSH_INTERNAL_SECRET` -> Disabled for preview
16. `VAPID_PUBLIC_KEY` -> WebPush Public Key
17. `VAPID_PRIVATE_KEY` -> WebPush Server Secret

---

## 5. Remote Smoke Test Results (Actual *.vercel.app)

| Route Probed | HTTP Status | Content Length | Title / Content | SSR Active |
| :--- | :--- | :--- | :--- | :--- |
| `/` | **200 OK** | 115,871 B | Barbex Landing Page | **YES** |
| `/auth` | **200 OK** | 26,915 B | Entrar no Barbex \| Acesso da Equipe | **YES** |
| `/privacy` | **200 OK** | 10,577 B | Barbex Política de Privacidade | **YES** |
| `/terms` | **200 OK** | 10,097 B | Barbex Termos de Uso | **YES** |
| `/status` | **200 OK** | 9,192 B | Barbex Status dos Serviços | **YES** |
| `/subprocessors` | **200 OK** | 6,850 B | Barbex Subprocessadores | **YES** |
| `/trust` | **200 OK** | 25,448 B | Barbex Trust Center | **YES** |
| `/security` | **200 OK** | 14,793 B | Segurança - Barbex | **YES** |
| `/faq` | **200 OK** | 7,570 B | Faq \| Agendamento Online | **YES** |
| `/dashboard` | **200 OK** | 20,940 B | Barbex Dashboard | **YES** |
| `/agenda` | **200 OK** | 7,612 B | Agenda \| Agendamento Online | **YES** |
| `/customers` | **200 OK** | 8,942 B | Barbex Clientes | **YES** |
| `/barbers` | **200 OK** | 6,042 B | Barbex Barbeiros | **YES** |
| `/services` | **200 OK** | 5,391 B | Barbex Serviços | **YES** |
| `/products` | **200 OK** | 21,425 B | Barbex Produtos | **YES** |
| `/finances` | **200 OK** | 9,786 B | Barbex Financeiro | **YES** |
| `/subscriptions` | **200 OK** | 22,484 B | Barbex Assinaturas | **YES** |
| `/loyalty` | **200 OK** | 18,584 B | Barbex Fidelidade | **YES** |
| `/tutorials` | **200 OK** | 30,650 B | Barbex Tutoriais | **YES** |

- **HTTP 5xx Errors:** **0**
- **Fatal JS Errors:** **0**
- **SSR Errors:** **0**
- **Hydration Fatal Errors:** **0**

---

## 6. Security Scan & Target Backend Authority Proof

- **Source Supabase Calls:** **0**
- **Source Project Ref Count in Client Bundles:** **0** (`wdxhjwodyctgzqtogkgv` absent)
- **Lovable Runtime Dependencies:** **0**
- **Client Service Role Exposure:** **0**
- **Client Secret Exposure:** **0**
- **Backend Authorities:**
  - Database -> Target Supabase (`ywdwrstxvsdqiryhieiz`)
  - Auth -> Target Supabase (`ywdwrstxvsdqiryhieiz`)
  - Storage -> Target Supabase (`ywdwrstxvsdqiryhieiz`)
  - Realtime -> Target Supabase (`ywdwrstxvsdqiryhieiz`)
- **Background & Provider Isolation:**
  - Duplicate Schedulers: **0**
  - Duplicate Background Workers: **0**
  - Provider Callback Mutations: **0** (All webhooks remain directed to Target Edge Functions)

---

## 7. Production Isolation & Source Freeze Invariants

- **Production DNS (`barbex.shop`):** Strictly untouched (`185.158.133.1`, Cloudflare Universal SSL, Server: `cloudflare`, CF-Ray active).
- **Production Host:** Lovable Cloud remains active, healthy, and serving 100% of production traffic.
- **Source Supabase (`wdxhjwodyctgzqtogkgv`):**
  - Public Rows: **257,691**
  - Status Checks: **256,998** (Max ID: **256,998**)
  - External WP16 Scheduler: **ACTIVE** (frozen)
  - Application Traffic: **0**
  - Provider Traffic: **0**
  - Background Traffic: **0**
- **Target Supabase (`ywdwrstxvsdqiryhieiz`):** 100% operational across App, Auth, Database, Storage, Realtime, and 6 background producers.

---

## 8. Actual F16 Domain & DNS Cutover Plan

Captured live and ready for execution in Phase 17C.M7H-F16:

1. **Apex Domain (`barbex.shop`):**
   - Current DNS: `A` -> `185.158.133.1` (TTL: `14400`)
   - Vercel Target: `A` -> `76.76.21.21` (TTL: `300`)
   - Pre-Verification: `TXT` -> `_vercel`
   - Rollback Target: `A` -> `185.158.133.1` (Cloudflare / Lovable)
2. **Subdomain (`www.barbex.shop`):**
   - Current DNS: `CNAME` -> `barbex.shop`
   - Vercel Target: `CNAME` -> `cname.vercel-dns.com` (TTL: `300`)
   - Rollback Target: `CNAME` -> `barbex.shop`

---

## 9. Final Decision & Gate Status

```
F151R_VERCEL_ACCESS_AVAILABLE = YES
F151R_VERCEL_USER = analistalouis-6644
F151R_VERCEL_TEAM = startup-dc20
VERCEL_PROJECT_CREATED_OR_REUSED = YES
VERCEL_PROJECT_ID = prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB
VERCEL_PROJECT_NAME = barbex-staging
VERCEL_REMOTE_PREVIEW_DEPLOYED = YES
VERCEL_REMOTE_PREVIEW_DEPLOYMENT_ID = dpl_7HrVsYsxPXkB5Pt1LWAE3XzYiB2z
VERCEL_REMOTE_PREVIEW_URL = https://barbex-staging-8s6t1ofu6-startup-dc20.vercel.app
F151R_ENV_REQUIRED_TOTAL = 17
F151R_ENV_PRESENT_PREVIEW = 17
F151R_ENV_MISSING_PREVIEW = 0
F151R_REMOTE_ROUTES_TESTED = 19
F151R_REMOTE_HTTP_5XX = 0
F151R_REMOTE_FATAL_JS_ERRORS = 0
F151R_REMOTE_SSR_ERRORS = 0
REMOTE_DATABASE_AUTHORITY_TARGET = YES
REMOTE_AUTH_AUTHORITY_TARGET = YES
REMOTE_STORAGE_AUTHORITY_TARGET = YES
REMOTE_REALTIME_AUTHORITY_TARGET = YES
REMOTE_SOURCE_SUPABASE_CALLS = 0
PRODUCTION_DNS_CHANGED = NO
LOVABLE_PRODUCTION_STILL_ACTIVE = YES
F16_DNS_PLAN_COMPLETE = YES
F151R_REACHED = YES
READY_FOR_F16_PRODUCTION_HOSTING_CUTOVER = YES

FINAL_DECISION:
F151R_VERCEL_REMOTE_STAGING_CLOSED_READY_FOR_F16
```
