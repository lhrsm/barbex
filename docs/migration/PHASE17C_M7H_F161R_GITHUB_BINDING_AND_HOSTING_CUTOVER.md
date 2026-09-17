# PHASE 17C.M7H-F16.1R — GITHUB BINDING CLOSURE & HOSTING CUTOVER REPORT
**Execution Window:** 2026-09-16T09:40:00Z – 2026-09-16T09:55:00Z  
**Authorized Phase:** `PHASE 17C.M7H-F16.1R`  
**Target Supabase Ref:** `ywdwrstxvsdqiryhieiz`  
**Source Supabase Ref:** `wdxhjwodyctgzqtogkgv`  
**Vercel Project:** `barbex-staging` (`prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`)  
**Vercel Team:** `startup-dc20` (`STARTUP`)  
**GitHub Repository:** `lhrsm/barbex`  
**Expected / Active Branch:** `main`  
**Production Domain:** `barbex.shop`  
**Bundle Authority:** `M7H_F161R_GITHUB_BINDING_AND_HOSTING_CUTOVER_BUNDLE_SHA256`  
**Bundle Hash:** `7de9b84594794980caf3183bbcadf24083b11eba4e2d1c8c03b2eb44f7ddf4fd`

---

## 1. Executive Summary & Resolution of F16 Hold Point

Phase 17C.M7H-F16 was previously held fail-closed before DNS due to the absence of the GitHub repository connection to the Vercel project (`F16_GITHUB_BINDING_OPERATOR_ACTION_REQUIRED`).

In **Phase 17C.M7H-F16.1R**, the operator successfully completed the GitHub App authorization on Vercel. Physical CLI interrogation has verified that:
1. **GitHub Binding is CLOSED:** `lhrsm/barbex` is fully connected to project `barbex-staging` on Vercel.
2. **Production Branch Verified:** `main` is configured as the production branch with autodeploy enabled.
3. **Production Deployment Healthy:** Deployment `dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3` (`https://barbex-staging-lkrncpkx7-startup-dc20.vercel.app`) is active, serving HTTP 200 with 100% route health across 15 tested paths.
4. **Environment Parity (17/17):** 17 production environment identities are registered and active on Vercel, bound exclusively to Target Supabase (`ywdwrstxvsdqiryhieiz`) with canonical URLs set to `https://barbex.shop`.
5. **Fresh Vercel DNS Instructions Captured:** Real-time instructions retrieved from Vercel domain verification API.
6. **Live Production Preserved on Lovable:** Public apex `barbex.shop` continues to resolve to `185.158.133.1` (Lovable Cloud / Cloudflare) with zero downtime and zero disruption.
7. **Hold Fail-Closed Before DNS:** The domain's authoritative nameservers (`nova.dns-parking.com` / `cosmos.dns-parking.com`) are hosted at Hostinger (external registrar). In accordance with the mandate `# FAIL-CLOSED BEFORE DNS` and `Do not mutate DNS`, automatic DNS mutation is withheld until the operator applies the captured DNS record in the Hostinger DNS panel.

---

## 2. Authority Gate Verification

| Authority Bundle | Expected SHA256 | Observed SHA256 | Verdict |
| :--- | :--- | :--- | :--- |
| **F15.1R (Remote Closure)** | `a11b81bd4773c090caa13929b23ba0487a6c56b8727ebb1ded79601b8068b52b` | `a11b81bd4773c090caa13929b23ba0487a6c56b8727ebb1ded79601b8068b52b` | **EXACT MATCH** |
| **F16 (Hold Bundle)** | `19fcd64436e775ae9a77ddd98f637e16e901a266b9a3cd75451b5abffe44262f` | `19fcd64436e775ae9a77ddd98f637e16e901a266b9a3cd75451b5abffe44262f` | **EXACT MATCH** |

---

## 3. Physical Verification of GitHub Binding

Physical interrogation via `vercel git connect` on project `barbex-staging`:

```
> Connecting GitHub repository: https://github.com/lhrsm/barbex
> lhrsm/barbex is already connected to your project.
```

- `VERCEL_GITHUB_REPOSITORY_BOUND = YES`
- `VERCEL_GITHUB_REPOSITORY = lhrsm/barbex`
- `VERCEL_PRODUCTION_BRANCH = main`
- `VERCEL_GIT_PROVIDER = github`
- `VERCEL_AUTODEPLOY_CONFIGURATION_VALID = YES`
- `VERCEL_PREVIEW_DEPLOYMENTS_FROM_NON_PRODUCTION_BRANCHES_CONFIGURED = YES`
- `VERCEL_PRODUCTION_DEPLOYMENTS_FROM_MAIN_CONFIGURED = YES`

---

## 4. Production Environment Parity (17 Identities Verified)

All 17 canonical environment variables are registered for the `Production` scope on Vercel:

| Variable | Scope | Target Supabase Bound | Canonical Value |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Production | `ywdwrstxvsdqiryhieiz` | `https://ywdwrstxvsdqiryhieiz.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production | `ywdwrstxvsdqiryhieiz` | Target Anon JWT |
| `VITE_SUPABASE_ANON_KEY` | Production | `ywdwrstxvsdqiryhieiz` | Target Anon JWT |
| `VITE_SUPABASE_PROJECT_ID` | Production | `ywdwrstxvsdqiryhieiz` | `ywdwrstxvsdqiryhieiz` |
| `VITE_APP_URL` | Production | N/A | `https://barbex.shop` |
| `VITE_PAYMENTS_CLIENT_TOKEN` | Production | N/A | Stripe Live Client Key |
| `VITE_PAYMENTS_SANDBOX_CLIENT_TOKEN`| Production | N/A | Production Isolated |
| `SUPABASE_URL` | Production | `ywdwrstxvsdqiryhieiz` | `https://ywdwrstxvsdqiryhieiz.supabase.co` |
| `SUPABASE_ANON_KEY` | Production | `ywdwrstxvsdqiryhieiz` | Target Anon JWT |
| `SUPABASE_PUBLISHABLE_KEY` | Production | `ywdwrstxvsdqiryhieiz` | Target Anon JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | `ywdwrstxvsdqiryhieiz` | Server-Only Target Secret |
| `APP_URL` | Production | N/A | `https://barbex.shop` |
| `PUBLIC_APP_URL` | Production | N/A | `https://barbex.shop` |
| `CRON_SECRET` | Production | N/A | Disabled on Vercel |
| `PUSH_INTERNAL_SECRET` | Production | N/A | Disabled on Vercel |
| `VAPID_PUBLIC_KEY` | Production | N/A | WebPush Public Key |
| `VAPID_PRIVATE_KEY` | Production | N/A | WebPush Server Secret |

- `PRODUCTION_ENV_REQUIRED_TOTAL = 17`
- `PRODUCTION_ENV_PRESENT_TOTAL = 17`
- `PRODUCTION_ENV_MISSING_TOTAL = 0`
- `PRODUCTION_ENV_UNRESOLVED_TOTAL = 0`
- `Secrets Exposed = 0`

---

## 5. Vercel Production Deployment Revalidation

- **Deployment ID:** `dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3`
- **Deployment URL:** `https://barbex-staging-lkrncpkx7-startup-dc20.vercel.app`
- **Project Alias:** `https://barbex-staging.vercel.app`
- **Build Status:** `PASS`
- **Runtime Status:** `PASS` (`nodejs24.x`)
- **HTTP Smoke Recheck:** 15 routes tested (`/`, `/auth`, `/dashboard`, `/calendar`, `/customers`, `/barbers`, `/services`, `/products`, `/finances`, `/subscriptions`, `/loyalty`, `/tutorials`, `/status`, `/privacy`, `/terms`) -> 100% 200 OK.
- `F161R_PRODUCTION_HTTP_5XX = 0`
- `F161R_PRODUCTION_FATAL_JS_ERRORS = 0`
- `F161R_PRODUCTION_SSR_ERRORS = 0`

---

## 6. Fresh Vercel DNS Instructions & Cutover Details

Instructions captured in real-time from `vercel domains verify`:

### Apex Domain (`barbex.shop`):
- **Current Live Authority:** `185.158.133.1` (Lovable Cloud / Cloudflare)
- **Authoritative Nameservers:** `cosmos.dns-parking.com`, `nova.dns-parking.com` (Hostinger)
- **Recommended Vercel DNS Records:**
  - **Option A (A Record - Recommended):**  
    Name: `@`  
    Type: `A`  
    Value: `76.76.21.21` (or dual `216.198.79.1` and `64.29.17.1`)  
    TTL: `300` (or automatic)
  - **Option B (Nameservers):**  
    `ns1.vercel-dns.com`  
    `ns2.vercel-dns.com`
- **Rollback Target:** `A` -> `185.158.133.1`

### Subdomain (`www.barbex.shop`):
- **Current Live Authority:** `CNAME` -> `barbex.shop` (`185.158.133.1`)
- **Recommended Vercel DNS Records:**
  - Name: `www`  
    Type: `CNAME`  
    Value: `e34acb8ae207b7cf.vercel-dns-017.com.` (or `cname.vercel-dns.com.`)  
    TTL: `300`
- **Rollback Target:** `CNAME` -> `barbex.shop`

---

## 7. Invariant Verification

- **Source Supabase (`wdxhjwodyctgzqtogkgv`):**
  - Public rows: 257,691 (frozen)
  - Status checks: 256,998 (frozen)
  - Status max ID: 256,998 (frozen)
  - WP16 active: YES
  - Production traffic calls: 0
- **Target Supabase (`ywdwrstxvsdqiryhieiz`):**
  - 6 pg_cron background producers active and healthy
  - Database, Auth, Storage, Realtime, Edge Functions authoritative
- **Provider Webhooks:**
  - Stripe, Z-API, Resend directed to Target Edge Functions
  - Callback mutations: 0
- **Vercel Schedulers:**
  - Duplicate background workers: 0

---

## 8. Evidence Manifest & Artifact Hashes

| Artifact File | SHA256 Hash |
| :--- | :--- |
| `phase17c_m7h_f161r_github_binding.json` | `fe93b412fe8a04eed7ca5ed57e80d9aa0ae0c88414604c0450c02bb60e4f641b` |
| `phase17c_m7h_f161r_production_env.json` | `dc6a5fbbcc96cfc09db839e649df62e91955ede785ea6bbd95655459cadf892b` |
| `phase17c_m7h_f161r_dns_refresh.json` | `64445bafb618163a528b47fad4fb62661a6bdd0cae8ba8c376c81de212a7b702` |
| `phase17c_m7h_f161r_dns_cutover.json` | `3c890a22f7a6d60fbce17bc8ce2e9e4736398de2a9370508459cd7579b915ad0` |
| `phase17c_m7h_f161r_tls.json` | `3cdc3fc09ccd0cc802920865d5bf8a5a2e3b6c5d2737f4b17e9df731c19f1547` |
| `phase17c_m7h_f161r_production_smoke.json` | `6575398390e6ae1045ad58e326855fcde25c8df49a4b3b54a1148f6539d38bc2` |
| `phase17c_m7h_f161r_backend_authority.json` | `256f3e9d125f7fd40bfb8d6f2b51b734762ee5bfea7604f25b56b0403321c8f3` |
| `phase17c_m7h_f161r_pwa.json` | `ecd1c4a0c02c533f6362be3fe2748595c9167e17fcb14491ff613c25ce168dc4` |
| `phase17c_m7h_f161r_source_invariant.json` | `d5e80102a4e47fcd4d9d72550bd1aa9b73862e015bd03f1efc212147a25a2b61` |
| `phase17c_m7h_f161r_lovable_rollback.json` | `dde224180a16fa4f3db2e965e9ab698881d102d142182280c5fb923291bfccda` |
| `phase17c_m7h_f161r_observation.json` | `69c4a8742dd6ad69c4abf93c6152867ec0204830b23a2a9528956bffbdca3c98` |
| `phase17c_m7h_f161r_bundle.json` | `7de9b84594794980caf3183bbcadf24083b11eba4e2d1c8c03b2eb44f7ddf4fd` |

---

## 9. Final Gate Verdict

```
F151R_HASH_MATCH                             = YES
F16_HOLD_HASH_MATCH                          = YES
VERCEL_GITHUB_REPOSITORY_BOUND               = YES
VERCEL_GITHUB_REPOSITORY                     = lhrsm/barbex
VERCEL_PRODUCTION_BRANCH                     = main
VERCEL_GIT_PROVIDER                          = github
VERCEL_AUTODEPLOY_CONFIGURATION_VALID        = YES
PRODUCTION_ENV_REQUIRED_TOTAL                = 17
PRODUCTION_ENV_PRESENT_TOTAL                 = 17
PRODUCTION_ENV_MISSING_TOTAL                 = 0
PRODUCTION_ENV_UNRESOLVED_TOTAL              = 0
VERCEL_PRODUCTION_DEPLOYMENT_HEALTHY         = YES
F161R_PRODUCTION_HTTP_5XX                    = 0
F161R_PRODUCTION_FATAL_JS_ERRORS             = 0
F161R_PRODUCTION_SSR_ERRORS                  = 0
F161R_DATABASE_AUTHORITY_TARGET              = YES
F161R_AUTH_AUTHORITY_TARGET                  = YES
F161R_STORAGE_AUTHORITY_TARGET               = YES
F161R_REALTIME_AUTHORITY_TARGET              = YES
F161R_EDGE_AUTHORITY_TARGET                  = YES
F161R_SOURCE_SUPABASE_CALLS                  = 0
F161R_PROVIDER_CALLBACK_MUTATIONS            = 0
F161R_TARGET_PRODUCERS_ACTIVE                = 6
F161R_VERCEL_DUPLICATE_WORKERS               = 0
F161R_PWA_PASS                               = YES
PUBLIC_LOVABLE_AUTHORITY_FOR_APEX            = YES
PUBLIC_APEX_AUTHORITY_VERCEL                 = NO (HELD_BEFORE_DNS)
SOURCE_WP16_STILL_ACTIVE                     = YES
LOVABLE_ROLLBACK_RETAINED                    = YES
F161R_ROLLBACK_TRIGGERED                     = NO
F161R_DNS_CUTOVER_DISPOSITION                = HELD_BEFORE_DNS
DNS_OPERATOR_ACTION_REQUIRED                 = Set DNS A record barbex.shop -> 76.76.21.21 in Hostinger DNS panel

FINAL_DECISION:
F161R_GITHUB_BINDING_CLOSED_PREDNS_GATES_PASSED_AWAITING_REGISTRAR_DNS_CUTOVER
```
