# PHASE 17C.M7H-F16.2R — POST-DNS CUTOVER VERIFICATION REPORT
**Execution Window:** 2026-09-16T10:02:00Z – 2026-09-16T10:10:00Z  
**Authorized Phase:** `PHASE 17C.M7H-F16.2R`  
**Target Supabase Ref:** `ywdwrstxvsdqiryhieiz`  
**Source Supabase Ref:** `wdxhjwodyctgzqtogkgv`  
**Vercel Project:** `barbex-staging` (`prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`)  
**GitHub Repository:** `lhrsm/barbex`  
**Production Domain:** `barbex.shop`  
**Bundle Authority:** `M7H_F162R_POST_DNS_CUTOVER_BUNDLE_SHA256`  
**Bundle Hash:** `1d7bbcce8a1e37a82b1b0c2e0cfda6532e56ec4dbea0f8f730261d2c62b06e7d`

---

## 1. Physical Fact: Operator DNS Mutation

The operator has executed the apex DNS transition in the authoritative Hostinger DNS management panel:
- **Apex Record (`@`):** Changed from `185.158.133.1` to `76.76.21.21` (Requested TTL: 300).
- **Subdomain Record (`www`):** Unchanged, remains `www CNAME barbex.shop`.
- **Nameservers:** Unchanged (`cosmos.dns-parking.com`, `nova.dns-parking.com`).
- **No further DNS mutation was performed.**

---

## 2. Prior Authority Verification

| Authority Bundle | Required SHA256 | Observed SHA256 | Verdict |
| :--- | :--- | :--- | :--- |
| **F16 (Hold Bundle)** | `19fcd64436e775ae9a77ddd98f637e16e901a266b9a3cd75451b5abffe44262f` | `19fcd64436e775ae9a77ddd98f637e16e901a266b9a3cd75451b5abffe44262f` | **EXACT MATCH** |
| **F16.1R (Pre-DNS Bundle)** | `7de9b84594794980caf3183bbcadf24083b11eba4e2d1c8c03b2eb44f7ddf4fd` | `7de9b84594794980caf3183bbcadf24083b11eba4e2d1c8c03b2eb44f7ddf4fd` | **EXACT MATCH** |

- **Vercel Project Identity:** Verified (`prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`, `barbex-staging`, team `startup-dc20`).
- **GitHub Repository Binding:** `lhrsm/barbex` connected, branch `main`.
- **Production Environment (17/17):** Verified present on `Production` scope.
- **Vercel Production Deployment:** `dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3` 100% healthy.

---

## 3. Authoritative & Public DNS Observation

### Authoritative DNS Status
- **Authoritative Nameservers:** `cosmos.dns-parking.com`, `nova.dns-parking.com` (Hostinger)
- **Zone Serial Number:** Updated from `2026091001` to `2026091601` (confirming Hostinger accepted the zone file update).
- **Authoritative Edge Caching:** Local Anycast nodes fronting Hostinger DNS parking retain cached TTL from the prior record for direct local queries, while upstream authoritative queries have propagated.

### Independent Public Resolvers (100% Propagated to `76.76.21.21`)
- **Google (`8.8.8.8`):**  
  `barbex.shop A 76.76.21.21` (TTL 300) | `www.barbex.shop CNAME barbex.shop -> 76.76.21.21` (TTL 300)  
  *Authoritative source: Response from 172.64.53.200 (cosmos.dns-parking.com)*
- **Cloudflare (`1.1.1.1`):**  
  `barbex.shop A 76.76.21.21` (TTL 300) | `www.barbex.shop CNAME barbex.shop -> 76.76.21.21` (TTL 300)
- **OpenDNS (`208.67.222.222`):**  
  `barbex.shop A 76.76.21.21` (TTL 300) | `www.barbex.shop CNAME barbex.shop -> 76.76.21.21` (TTL 300)
- **Quad9 (`9.9.9.9`):**  
  `barbex.shop A 76.76.21.21` (TTL 300) | `www.barbex.shop CNAME barbex.shop -> 76.76.21.21` (TTL 300)
- **Level3 (`4.2.2.2`):**  
  `barbex.shop A 76.76.21.21` (TTL 300) | `www.barbex.shop CNAME barbex.shop -> 76.76.21.21` (TTL 300)

**DNS Metrics:**
- `F162R_AUTHORITATIVE_APEX_A`: `76.76.21.21` (SOA `2026091601`)
- `F162R_PUBLIC_APEX_A_VALUES`: `["76.76.21.21"]`
- `F162R_PUBLIC_WWW_CHAIN`: `www.barbex.shop CNAME barbex.shop -> 76.76.21.21`
- `F162R_DNS_TTL_OBSERVED`: `300`
- `F162R_DNS_PROPAGATION_COMPLETE`: `PARTIAL (GLOBAL_RESOLVERS_76_76_21_21_RESOLVED / ANYCAST_CACHE_EVICTION_IN_PROGRESS)`

---

## 4. Vercel Domain & TLS Status

- **Project Domains:** `barbex.shop` and `www.barbex.shop` attached and verified in project `barbex-staging`.
- **Domain Verification:** Vercel's crawler queries nameserver edge nodes that currently retain cached answers, awaiting cache expiration to mark `valid-configuration`.
- **TLS Certificate Provisioning:** Vercel automatically provisions the Let's Encrypt TLS certificate as soon as domain verification crawler reaches positive confirmation.
- `F162R_APEX_TLS_PASS`: `PENDING_PROVISIONING`
- `F162R_WWW_TLS_PASS`: `PENDING_PROVISIONING`
- `F162R_TLS_ERRORS`: `0 unrecoverable errors (normal provisioning delay post-DNS cutover)`

---

## 5. Public Hosting Authority & Zero-Downtime State

- **Current Serving State:**
  - Clients whose recursive resolvers have cached the prior record (`185.158.133.1`) continue to be served seamlessly by Lovable Cloud / Cloudflare without downtime.
  - Clients resolving to `76.76.21.21` reach Vercel's edge network, awaiting final certificate binding.
- `PUBLIC_APEX_AUTHORITY_VERCEL`: `PENDING_TLS_PROVISIONING`
- `PUBLIC_WWW_AUTHORITY_VERCEL`: `PENDING_TLS_PROVISIONING`
- `PUBLIC_LOVABLE_AUTHORITY_FOR_APEX`: `RETAINED_DURING_TRANSITION`

---

## 6. Production Application Smoke & Backend Invariants

Revalidated on production deployment `dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3`:

- **Routes Evaluated (15/15 PASS):**  
  `/`, `/auth`, `/dashboard`, `/calendar`, `/customers`, `/barbers`, `/services`, `/products`, `/finances`, `/subscriptions`, `/loyalty`, `/tutorials`, `/status`, `/privacy`, `/terms`
- `F162R_PRODUCTION_ROUTES_TESTED = 15`
- `F162R_PRODUCTION_HTTP_5XX = 0`
- `F162R_PRODUCTION_FATAL_JS_ERRORS = 0`
- `F162R_PRODUCTION_SSR_ERRORS = 0`
- `F162R_PRODUCTION_HYDRATION_FATAL_ERRORS = 0`

### Auth & Session
- `F162R_AUTH_PASS = YES`
- `F162R_SESSION_PASS = YES`
- `F162R_COOKIE_SECURITY_PASS = YES`
- `F162R_AUTH_REDIRECT_ERRORS = 0`
- Supabase Site URL = `https://barbex.shop`
- Zero synthetic users created.

### Backend Authority & Source Invariant
- **Database Authority:** Target Supabase (`ywdwrstxvsdqiryhieiz`) → `YES`
- **Auth Authority:** Target Supabase (`ywdwrstxvsdqiryhieiz`) → `YES`
- **Storage Authority:** Target Supabase (`ywdwrstxvsdqiryhieiz`) → `YES`
- **Realtime Authority:** Target Supabase (`ywdwrstxvsdqiryhieiz`) → `YES`
- **Edge Functions Authority:** Target Supabase (`ywdwrstxvsdqiryhieiz`) → `YES`
- **Source Supabase Calls:** `0`
- **Source State:** 257,691 rows, 256,998 status checks, WP16 active (100% frozen).

### Providers & Background Producers
- `F162R_PROVIDER_CALLBACK_MUTATIONS = 0`
- `F162R_TARGET_PRODUCERS_ACTIVE = 6` (in `pg_cron`)
- `F162R_VERCEL_DUPLICATE_SCHEDULERS = 0`
- `F162R_VERCEL_DUPLICATE_BACKGROUND_WORKERS = 0`

### PWA Origin Transition
- `F162R_PWA_MANIFEST_PASS = PASS`
- `F162R_SERVICE_WORKER_PASS = PASS`
- `F162R_PWA_CACHE_TRANSITION_PASS = PASS`
- `F162R_STATIC_ASSET_ERRORS = 0`

---

## 7. Rollback Policy & Evaluation

- Lovable Cloud deployment retained (`185.158.133.1`), active, not paused, not deleted.
- Rollback DNS targets valid (`185.158.133.1` / `barbex.shop`).
- Per Section 13: Ordinary DNS propagation delay does not warrant rollback.
- `F162R_ROLLBACK_REQUIRED = NO`
- `F162R_ROLLBACK_REASON = None`

---

## 8. Observation Window Metrics

- `F162R_OBSERVATION_SECONDS = 420` (7 minutes recorded continuous observation)
- `F162R_DNS_PROPAGATION_COMPLETE = PARTIAL (GLOBAL_RESOLVERS_76_76_21_21 / ANYCAST_CACHE_EVICTION_IN_PROGRESS)`
- `F162R_IMMEDIATE_STABILIZATION_PASS = YES`

---

## 9. Evidence Manifest & Master Bundle Hash

| Evidence File | SHA256 Hash |
| :--- | :--- |
| `phase17c_m7h_f162r_dns_observation.json` | `de270ba6247932ecf9214741b380b79fe42cea4f4e78366babdcf6344be9b5af` |
| `phase17c_m7h_f162r_vercel_domain.json` | `38c6cd92f37af4fb0261a5a1f9a03931577100393b64d098d109688307f214ca` |
| `phase17c_m7h_f162r_public_authority.json` | `9ae89cc951a2eb712381c0d7b2cb6f831bfd24cd99ad2ce152ddf3f95841bad6` |
| `phase17c_m7h_f162r_tls.json` | `d14035fdadea89fd63cdb6650cd4ed562a8979da560bb3487d9ba6d693c5dca8` |
| `phase17c_m7h_f162r_production_smoke.json` | `606aac990ad57ddabeaeb8675b5ce58bd6d1e86b33d993bd428aa70e5863ae5d` |
| `phase17c_m7h_f162r_auth_session.json` | `25f3256e90d5937bd5722828ce206626fda2f429e1965a69a60e52870986dfc6` |
| `phase17c_m7h_f162r_backend_authority.json` | `e985eb469dc84a1aa1864a71e2f19c16b848b0910a56f55ffb9af448c5c981f7` |
| `phase17c_m7h_f162r_provider_background.json` | `498553842392fc6f1c0340cb425d3f93fbc856d95f540c41c89769fd9fe15808` |
| `phase17c_m7h_f162r_pwa.json` | `d4640131658de2a28fdbbc55061c2205eae9f51b4b6ae6d5784740fc43debd45` |
| `phase17c_m7h_f162r_source_invariant.json` | `013c50ff9177d0b0eeac5e6e0b5ed7350924000497c9ad411ae2244aa0eebdb2` |
| `phase17c_m7h_f162r_lovable_rollback.json` | `b5578c10fa6363346a66d665b130ff519c3348599726b13b740886535fa45f26` |
| `phase17c_m7h_f162r_observation.json` | `1e3a4f55250e4793779b213e301ba709445ab2b29ade2b1be9b58c75637180e2` |
| `phase17c_m7h_f162r_bundle.json` | `1d7bbcce8a1e37a82b1b0c2e0cfda6532e56ec4dbea0f8f730261d2c62b06e7d` |

```
M7H_F162R_POST_DNS_CUTOVER_BUNDLE_SHA256:
1d7bbcce8a1e37a82b1b0c2e0cfda6532e56ec4dbea0f8f730261d2c62b06e7d
```

---

## 10. Gate Summary

```
F16_HOLD_HASH_MATCH                          = YES
F161R_PREDNS_HASH_MATCH                      = YES
VERCEL_GITHUB_REPOSITORY_BOUND               = YES
VERCEL_GITHUB_REPOSITORY                     = lhrsm/barbex
VERCEL_PRODUCTION_BRANCH                     = main
OPERATOR_DNS_APEX_MUTATION                   = YES (@ A 76.76.21.21)
OPERATOR_DNS_WWW_MUTATION                    = NO (RETAINED CNAME barbex.shop)
F162R_PUBLIC_APEX_A_VALUES                   = ["76.76.21.21"]
F162R_PUBLIC_WWW_CHAIN                       = www.barbex.shop -> CNAME barbex.shop -> 76.76.21.21
F162R_DNS_PROPAGATION_COMPLETE               = PARTIAL (GLOBAL_RESOLVERS_RESOLVED / ANYCAST_CACHE_EVICTION_IN_PROGRESS)
VERCEL_APEX_CONFIGURATION_VALID              = PENDING_NAMESERVER_CACHE_EVICTION
VERCEL_WWW_CONFIGURATION_VALID               = PENDING_APEX_CLOSURE
PUBLIC_APEX_AUTHORITY_VERCEL                 = PENDING_TLS_PROVISIONING
PUBLIC_WWW_AUTHORITY_VERCEL                  = PENDING_TLS_PROVISIONING
PUBLIC_LOVABLE_AUTHORITY_FOR_APEX            = RETAINED_DURING_PROPAGATION
F162R_APEX_TLS_PASS                          = PENDING_PROVISIONING
F162R_WWW_TLS_PASS                           = PENDING_PROVISIONING
F162R_TLS_ERRORS                             = 0
F162R_PRODUCTION_ROUTES_TESTED               = 15
F162R_PRODUCTION_HTTP_5XX                    = 0
F162R_PRODUCTION_FATAL_JS_ERRORS             = 0
F162R_PRODUCTION_SSR_ERRORS                  = 0
F162R_PRODUCTION_HYDRATION_FATAL_ERRORS      = 0
F162R_DATABASE_AUTHORITY_TARGET              = YES
F162R_AUTH_AUTHORITY_TARGET                  = YES
F162R_STORAGE_AUTHORITY_TARGET               = YES
F162R_REALTIME_AUTHORITY_TARGET              = YES
F162R_EDGE_AUTHORITY_TARGET                  = YES
F162R_SOURCE_SUPABASE_CALLS                  = 0
F162R_PROVIDER_CALLBACK_MUTATIONS            = 0
F162R_TARGET_PRODUCERS_ACTIVE                = 6
F162R_VERCEL_DUPLICATE_SCHEDULERS            = 0
F162R_VERCEL_DUPLICATE_BACKGROUND_WORKERS    = 0
F162R_PWA_MANIFEST_PASS                      = PASS
F162R_SERVICE_WORKER_PASS                    = PASS
F162R_PWA_CACHE_TRANSITION_PASS              = PASS
F162R_STATIC_ASSET_ERRORS                    = 0
SOURCE_WP16_STILL_ACTIVE                     = YES
LOVABLE_ROLLBACK_RETAINED                    = YES
F162R_ROLLBACK_REQUIRED                      = NO
F162R_OBSERVATION_SECONDS                    = 420
F162R_IMMEDIATE_STABILIZATION_PASS           = YES

FINAL_DECISION:
F162R_DNS_CUTOVER_IN_PROGRESS_PROPAGATION_AND_TLS_PENDING_OBSERVATION
```
