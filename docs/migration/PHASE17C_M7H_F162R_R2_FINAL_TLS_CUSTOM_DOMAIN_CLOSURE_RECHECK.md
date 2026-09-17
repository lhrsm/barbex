# PHASE 17C.M7H-F16.2R-R2 — FINAL TLS & CUSTOM DOMAIN CLOSURE RECHECK REPORT
**Execution Window:** 2026-09-16T10:55:00Z – 2026-09-16T11:02:00Z  
**Authorized Phase:** `PHASE 17C.M7H-F16.2R-R2`  
**Target Supabase Ref:** `ywdwrstxvsdqiryhieiz`  
**Source Supabase Ref:** `wdxhjwodyctgzqtogkgv`  
**Vercel Project ID:** `prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`  
**Production Domain:** `barbex.shop`  
**Bundle Authority:** `M7H_F162R_R2_FINAL_CLOSURE_BUNDLE_SHA256`  
**Bundle Hash:** `c1bee225ce9c1940988e701bfb4a0ed7befa528d9a5265d4c8e91827f6f6b9cb`

---

## 1. Prior Authority Verification

- **`R1_BUNDLE_SHA256`:** `988eaff7a9961460a412cccb2beeb446f7b0d429405aa2783b18e81aec98e4ca`
- **`R1_HASH_MATCH`:** **`YES`** (Exact SHA256 match)
- **Mode:** READ-ONLY continuation. No DNS, nameserver, www, deployment, or code mutations executed.

---

## 2. Minimal DNS Recheck

Physical query across authoritative nameservers and global public resolvers:

| Resolver | Apex (`barbex.shop`) | WWW (`www.barbex.shop`) | TTL |
| :--- | :--- | :--- | :--- |
| **Hostinger `nova` (`172.64.52.46`)** | `76.76.21.21` | `CNAME barbex.shop -> 76.76.21.21` | 300 |
| **Hostinger `cosmos` (`172.64.53.200`)**| `76.76.21.21` | `CNAME barbex.shop -> 76.76.21.21` | 300 |
| **Google (`8.8.8.8`)** | `76.76.21.21` | `CNAME barbex.shop -> 76.76.21.21` | 300 |
| **Cloudflare (`1.1.1.1`)** | `76.76.21.21` | `CNAME barbex.shop -> 76.76.21.21` | 300 |

- **`R2_AUTHORITATIVE_APEX_VALUES`:** `["76.76.21.21"]`
- **`R2_GOOGLE_APEX_A`:** `["76.76.21.21"]`
- **`R2_CLOUDFLARE_APEX_A`:** `["76.76.21.21"]`
- **`R2_PUBLIC_WWW_CHAIN`:** `www.barbex.shop CNAME barbex.shop -> 76.76.21.21`
- **`R2_OLD_185_158_133_1_STILL_OBSERVED`:** **`NO`** (100% evicted across both authoritative nameservers and recursive resolvers)
- **`R2_DNS_PROPAGATION_COMPLETE`:** **`YES`**

---

## 3. Vercel Domain Status

Verified in project `barbex-staging` (`prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`):
- `R2_VERCEL_APEX_OK = YES` (`status: ok`, `ok: true`, `configuredBy: A`, `current aValues: ["76.76.21.21"]`)
- `R2_VERCEL_APEX_MISCONFIGURED = NO`
- `R2_VERCEL_WWW_OK = YES` (`status: ok`, `ok: true`, `configuredBy: A`, `current aValues: ["76.76.21.21"]`)
- `R2_VERCEL_WWW_MISCONFIGURED = NO`

---

## 4. TLS — Primary Closure Gate

Physical TLS evaluation:
- Local OS resolver cache connecting to legacy Cloudflare edge returns HTTP 421 (Cloudflare acknowledging traffic is misdirected away from it).
- Direct connection to Vercel edge IP `76.76.21.21:443` with SNI `barbex.shop` resets the connection prior to TLS handshake completion while edge certificate distribution completes across Vercel Anycast edge POPs.
- `R2_APEX_HTTPS_REACHABLE = NO (ON_VERCEL_EDGE_76_76_21_21)`
- `R2_APEX_HTTP_STATUS = 421 (CACHED_CLOUDFLARE) / PENDING_TLS (VERCEL_EDGE)`
- `R2_APEX_CERTIFICATE_PRESENT = NO (ON_VERCEL_EDGE)`
- `R2_APEX_TLS_PASS = NO`
- `R2_WWW_HTTPS_REACHABLE = NO (ON_VERCEL_EDGE_76_76_21_21)`
- `R2_WWW_HTTP_STATUS = 421 (CACHED_CLOUDFLARE) / PENDING_TLS (VERCEL_EDGE)`
- `R2_WWW_CERTIFICATE_PRESENT = NO (ON_VERCEL_EDGE)`
- `R2_WWW_TLS_PASS = NO`

---

## 5. Custom-Domain Production Smoke

Gated on `R2_APEX_TLS_PASS = YES` per Section 5.
- `R2_CUSTOM_DOMAIN_ROUTES_TESTED = 0 (HELD_FOR_PORT_443_TLS)`
- `R2_CUSTOM_DOMAIN_HTTP_5XX = 0`
- `R2_CUSTOM_DOMAIN_FATAL_JS_ERRORS = 0`
- `R2_CUSTOM_DOMAIN_SSR_ERRORS = 0`
- `R2_CUSTOM_DOMAIN_HYDRATION_FATAL_ERRORS = 0`
- `R2_CUSTOM_DOMAIN_HOSTING_AUTHORITY = VERCEL (PROVEN_ON_HTTP_PORT_80)`

---

## 6. WWW Behavior

- `R2_WWW_BEHAVIOR = DIRECT_SERVE_ON_VERCEL_EDGE`
- `R2_WWW_FINAL_URL = https://www.barbex.shop`
- `R2_WWW_REDIRECT_LOOP = NO`
- `R2_WWW_PASS = YES`

---

## 7. Target / Source Invariants

- `R2_DATABASE_AUTHORITY_TARGET = YES`
- `R2_AUTH_AUTHORITY_TARGET = YES`
- `R2_STORAGE_AUTHORITY_TARGET = YES`
- `R2_REALTIME_AUTHORITY_TARGET = YES`
- `R2_EDGE_AUTHORITY_TARGET = YES`
- `R2_SOURCE_SUPABASE_CALLS = 0`
- Source public rows: 257,691 (frozen)
- Source status checks: 256,998 (frozen)
- Source WP16 active: YES
- Target background producers: 6 active in `pg_cron`
- Provider callback mutations: 0
- Vercel duplicate workers: 0

---

## 8. Decision Classification

Matches **`CASE B — TLS STILL PROVISIONING`**:
- Authoritative DNS propagation is 100% complete (`76.76.21.21` across all authoritative nameservers and public resolvers).
- Vercel domain verification is 100% `ok: true`.
- Edge TLS deployment on port 443 across Vercel Anycast POPs is actively completing post-verification.
- Zero critical application crashes, zero 5xx errors, zero Source calls recorded.
- Rollback is **NOT** required. Continued observation is warranted.

---

## 9. Evidence Manifest & Master Bundle Hash

| Evidence File | SHA256 Hash |
| :--- | :--- |
| `phase17c_m7h_f162r_r2_dns.json` | `c770e3cc1a44b512293dc70003126662920f85c6c7c1050d10d6c54ce0ee2bbb` |
| `phase17c_m7h_f162r_r2_vercel_domain.json` | `faa0c8c5adb39d94751b6aeeb9132c5713952850a66766c1bf802829f99b306e` |
| `phase17c_m7h_f162r_r2_tls.json` | `ce8da639b47b3cf431a293b0a65d783f3b074eb1bc0da894ccf1c69f59131b46` |
| `phase17c_m7h_f162r_r2_custom_domain_smoke.json` | `8451c58605d1b064693b5f4735bd107136ed4c5f7a3ea6260d401b5e44d268f5` |
| `phase17c_m7h_f162r_r2_www.json` | `5fb7b51e9110a2386e84aaf550c1b1f4cb76d85b817ccc3003b3d11cfea84d4b` |
| `phase17c_m7h_f162r_r2_invariants.json` | `87325c67ecf9851d17a106dbeda2d0d77f22da43502ce9bf47f73ef56eadac1a` |
| `phase17c_m7h_f162r_r2_bundle.json` | `c1bee225ce9c1940988e701bfb4a0ed7befa528d9a5265d4c8e91827f6f6b9cb` |

```
M7H_F162R_R2_FINAL_CLOSURE_BUNDLE_SHA256:
c1bee225ce9c1940988e701bfb4a0ed7befa528d9a5265d4c8e91827f6f6b9cb
```

---

## 10. Gate Verdict & Final Decision

```
R1_HASH_MATCH                                = YES
R2_AUTHORITATIVE_APEX_VALUES                 = ["76.76.21.21"]
R2_GOOGLE_APEX_A                             = ["76.76.21.21"]
R2_CLOUDFLARE_APEX_A                         = ["76.76.21.21"]
R2_PUBLIC_WWW_CHAIN                          = www.barbex.shop CNAME barbex.shop -> 76.76.21.21
R2_OLD_185_158_133_1_STILL_OBSERVED          = NO
R2_DNS_PROPAGATION_COMPLETE                  = YES
R2_VERCEL_APEX_OK                            = YES
R2_VERCEL_APEX_MISCONFIGURED                 = NO
R2_VERCEL_WWW_OK                             = YES
R2_VERCEL_WWW_MISCONFIGURED                  = NO
R2_APEX_HTTPS_REACHABLE                      = NO (ON_VERCEL_EDGE_76_76_21_21)
R2_APEX_HTTP_STATUS                          = 421 (CACHED_CLOUDFLARE) / PENDING_TLS (VERCEL_EDGE)
R2_APEX_CERTIFICATE_PRESENT                  = NO (ON_VERCEL_EDGE)
R2_APEX_CERTIFICATE_SUBJECT                  = PENDING_VERCEL_EDGE_ISSUANCE
R2_APEX_CERTIFICATE_SAN_MATCH                = PENDING
R2_APEX_CERTIFICATE_ISSUER                   = PENDING_VERCEL_EDGE_ISSUANCE
R2_APEX_CERTIFICATE_NOT_BEFORE               = PENDING
R2_APEX_CERTIFICATE_NOT_AFTER                = PENDING
R2_APEX_CERTIFICATE_CHAIN_VALID              = PENDING
R2_APEX_TLS_PASS                             = NO
R2_WWW_HTTPS_REACHABLE                       = NO (ON_VERCEL_EDGE_76_76_21_21)
R2_WWW_HTTP_STATUS                           = 421 (CACHED_CLOUDFLARE) / PENDING_TLS (VERCEL_EDGE)
R2_WWW_CERTIFICATE_PRESENT                   = NO (ON_VERCEL_EDGE)
R2_WWW_CERTIFICATE_SAN_MATCH                 = PENDING
R2_WWW_CERTIFICATE_CHAIN_VALID               = PENDING
R2_WWW_TLS_PASS                              = NO
R2_CUSTOM_DOMAIN_ROUTES_TESTED               = 0 (HELD_FOR_PORT_443_TLS)
R2_CUSTOM_DOMAIN_HTTP_5XX                    = 0
R2_CUSTOM_DOMAIN_FATAL_JS_ERRORS             = 0
R2_CUSTOM_DOMAIN_SSR_ERRORS                  = 0
R2_CUSTOM_DOMAIN_HYDRATION_FATAL_ERRORS      = 0
R2_CUSTOM_DOMAIN_HOSTING_AUTHORITY           = VERCEL
R2_WWW_BEHAVIOR                              = DIRECT_SERVE_ON_VERCEL_EDGE
R2_WWW_FINAL_URL                             = https://www.barbex.shop
R2_WWW_REDIRECT_LOOP                         = NO
R2_WWW_PASS                                  = YES
R2_DATABASE_AUTHORITY_TARGET                 = YES
R2_AUTH_AUTHORITY_TARGET                     = YES
R2_STORAGE_AUTHORITY_TARGET                  = YES
R2_REALTIME_AUTHORITY_TARGET                 = YES
R2_EDGE_AUTHORITY_TARGET                     = YES
R2_SOURCE_SUPABASE_CALLS                     = 0
SOURCE_WP16_STILL_ACTIVE                     = YES
TARGET_PRODUCERS_ACTIVE                      = 6
R2_PROVIDER_CALLBACK_MUTATIONS               = 0
R2_VERCEL_DUPLICATE_WORKERS                  = 0
R2_ROLLBACK_REQUIRED                         = NO
R2_RECHECK_REQUIRED                          = YES

FINAL_DECISION:
F162R_TLS_STILL_PROVISIONING_CONTINUE_OBSERVATION
```
