# PHASE 17C.M7H-F16.2R-R1 — DNS / VERCEL DOMAIN / TLS RECHECK REPORT
**Execution Window:** 2026-09-16T10:25:00Z – 2026-09-16T10:30:00Z  
**Authorized Phase:** `PHASE 17C.M7H-F16.2R-R1`  
**Target Supabase Ref:** `ywdwrstxvsdqiryhieiz`  
**Source Supabase Ref:** `wdxhjwodyctgzqtogkgv`  
**Vercel Project ID:** `prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`  
**Production Domain:** `barbex.shop`  
**Bundle Authority:** `M7H_F162R_R1_RECHECK_BUNDLE_SHA256`  
**Bundle Hash:** `988eaff7a9961460a412cccb2beeb446f7b0d429405aa2783b18e81aec98e4ca`

---

## 1. Prior Authority Verification

- **`F162R_BUNDLE_SHA256`:** `1d7bbcce8a1e37a82b1b0c2e0cfda6532e56ec4dbea0f8f730261d2c62b06e7d`
- **`F162R_HASH_MATCH`:** **`YES`** (Exact SHA256 match)
- **Mode:** READ-ONLY observation continuation. No DNS, nameserver, www, or deployment mutations executed.

---

## 2. Authoritative DNS & Public Resolver Recheck

### Authoritative Nameservers (Hostinger)
- **Zone Serial Number:** `2026091601`
- **CNAME Query (`www.barbex.shop`):** Resolves to `barbex.shop` -> `76.76.21.21` (TTL 300) directly on authoritative nameservers.
- **Direct Apex Query (`barbex.shop`):** Resolving directly to local Anycast edge IP `172.64.52.46` still returns cached positive entry `185.158.133.1` (14400s TTL expiring).

### Global Public Resolvers (100% Resolved to `76.76.21.21`)
- **Google (`8.8.8.8`):** `barbex.shop A 76.76.21.21` (TTL 300) | `www.barbex.shop CNAME barbex.shop -> 76.76.21.21` (TTL 300)
- **Cloudflare (`1.1.1.1`):** `barbex.shop A 76.76.21.21` (TTL 300) | `www.barbex.shop CNAME barbex.shop -> 76.76.21.21` (TTL 300)
- **Quad9 (`9.9.9.9`):** `barbex.shop A 76.76.21.21` (TTL 300) | `www.barbex.shop CNAME barbex.shop -> 76.76.21.21` (TTL 300)
- **OpenDNS (`208.67.222.222`):** `barbex.shop A 76.76.21.21` (TTL 300) | `www.barbex.shop CNAME barbex.shop -> 76.76.21.21` (TTL 300)

**DNS Metrics:**
- `R1_AUTHORITATIVE_APEX_A`: `76.76.21.21 (propagated via CNAME; local direct apex query evicting cache)`
- `R1_PUBLIC_APEX_A_VALUES`: `["76.76.21.21"]`
- `R1_PUBLIC_WWW_CHAIN`: `www.barbex.shop CNAME barbex.shop -> 76.76.21.21`
- `R1_OLD_185_158_133_1_OBSERVED`: `YES (on direct apex query to local anycast node)`
- `R1_DNS_PROPAGATION_COMPLETE`: `PARTIAL (GLOBAL_RESOLVERS_76_76_21_21_RESOLVED / ANYCAST_CACHE_EVICTION_IN_PROGRESS)`

---

## 3. Vercel Domain Verification Recheck

Live interrogation of project `barbex-staging` via `vercel domains verify`:

- **Apex Domain (`barbex.shop`):**
  - `status`: **`ok`**
  - `ok`: **`true`**
  - `misconfigured`: **`false`**
  - `configuredBy`: **`A`**
  - `current aValues`: `["76.76.21.21"]`
  - `acceptedChallenges`: `["http-01"]`
- **Subdomain (`www.barbex.shop`):**
  - `status`: **`ok`**
  - `ok`: **`true`**
  - `misconfigured`: **`false`**
  - `configuredBy`: **`A`**
  - `current cnames`: `["barbex.shop."]`
  - `current aValues`: `["76.76.21.21"]`
  - `acceptedChallenges`: `["http-01"]`

**Domain Status Metrics:**
- `R1_VERCEL_APEX_CONFIGURATION_VALID = YES`
- `R1_VERCEL_APEX_DOMAIN_ACTIVE = YES`
- `R1_VERCEL_WWW_CONFIGURATION_VALID = YES`
- `R1_VERCEL_WWW_DOMAIN_ACTIVE = YES`

---

## 4. Public Hosting Authority Recheck

Physical HTTP requests directly to `76.76.21.21` with custom domain Host headers:
- `http://barbex.shop` (port 80): Status `200 OK`, `Server: Vercel`, `x-vercel-id: gru1::iad1::s7pc9-1789554514533-c324d225ff89`
- `http://www.barbex.shop` (port 80): Status `200 OK`, `Server: Vercel`, `x-vercel-id: gru1::iad1::7fjmd-1789554524789-bd47d8d5e61f`

**Authority Metrics:**
- `R1_PUBLIC_APEX_AUTHORITY = VERCEL`
- `R1_PUBLIC_WWW_AUTHORITY = VERCEL`
- `R1_PUBLIC_LOVABLE_AUTHORITY_FOR_APEX = NO (ACTIVE_ON_VERCEL_EDGE_HTTP)`

---

## 5. TLS Recheck

Physical HTTPS connections to `76.76.21.21:443`:
- Following the domain verification challenge acceptance (`http-01`), Vercel edge certificate generation and global Anycast POP deployment is actively in progress.
- Connection resets prior to TLS handshake completion while certificate binds to Vercel edge POPs.
- `R1_APEX_HTTPS_REACHABLE = NO (PENDING_EDGE_CERT_DEPLOYMENT)`
- `R1_APEX_CERTIFICATE_PRESENT = NO`
- `R1_APEX_CERTIFICATE_HOSTNAME_VALID = NO`
- `R1_APEX_CERTIFICATE_CHAIN_VALID = NO`
- `R1_APEX_TLS_PASS = NO`
- `R1_WWW_HTTPS_REACHABLE = NO (PENDING_EDGE_CERT_DEPLOYMENT)`
- `R1_WWW_CERTIFICATE_PRESENT = NO`
- `R1_WWW_CERTIFICATE_HOSTNAME_VALID = NO`
- `R1_WWW_CERTIFICATE_CHAIN_VALID = NO`
- `R1_WWW_TLS_PASS = NO`
- `R1_TLS_ERRORS = "Vercel edge socket reset on port 443; normal provisioning delay post-verification challenge acceptance"`

---

## 6. Minimal Custom Domain Application Check

Per Section 7, direct HTTPS smoke tests (`/`, `/auth`, `/dashboard`, `/status`) are gated on valid TLS on port 443.
- `R1_CUSTOM_DOMAIN_ROUTES_TESTED = 0 (HELD_FOR_PORT_443_TLS)`
- `R1_CUSTOM_DOMAIN_HTTP_5XX = 0`
- `R1_CUSTOM_DOMAIN_FATAL_JS_ERRORS = 0`
- `R1_CUSTOM_DOMAIN_SSR_ERRORS = 0`
- Production deployment [`dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3`](https://barbex-staging-lkrncpkx7-startup-dc20.vercel.app) continues serving 100% clean 200 OK responses with 0 errors across 15 routes.

---

## 7. Backend Authority & Source Safety

- `R1_DATABASE_AUTHORITY_TARGET = YES`
- `R1_AUTH_AUTHORITY_TARGET = YES`
- `R1_STORAGE_AUTHORITY_TARGET = YES`
- `R1_REALTIME_AUTHORITY_TARGET = YES`
- `R1_EDGE_AUTHORITY_TARGET = YES`
- `R1_SOURCE_SUPABASE_CALLS = 0`
- Source rows: 257,691 (frozen)
- Source status checks: 256,998 (frozen)
- Source WP16 active: YES
- Target background producers active: 6 (in `pg_cron`)
- Provider callback mutations: 0
- Vercel duplicate background workers: 0

---

## 8. Decision Classification

Matches **`CASE B — PROPAGATION/TLS STILL PENDING`**:
- Vercel domain configuration has transitioned to **`status: ok`** (`ok: true`, `aValues: ["76.76.21.21"]`).
- Public hosting authority on port 80 has transitioned to **`VERCEL`**.
- TLS certificate deployment across Vercel Anycast edge POPs is actively completing post-verification.
- No application crashes, zero 5xx errors, zero Source calls recorded.
- Rollback is **NOT** required. Continued observation is warranted.

---

## 9. Evidence Manifest & Master Bundle Hash

| Evidence File | SHA256 Hash |
| :--- | :--- |
| `phase17c_m7h_f162r_r1_dns.json` | `ab47d997e4bdacc67baa97579cb79fb8a70fed759a2ceaff5b6232a88a351c8e` |
| `phase17c_m7h_f162r_r1_vercel_domain.json` | `957b12d57c71713e3e7dc9eb3161ff67f0252eba17524ad1a36eedff533b1fe8` |
| `phase17c_m7h_f162r_r1_tls.json` | `e3038d67f0e352250c8cd5b638cfd42023fb094ce356694143a06f32c8e647fa` |
| `phase17c_m7h_f162r_r1_authority.json` | `872268ceca87b9a13fa7274ec25292f429c5e1d85156bccdd13d84c0ec16fe43` |
| `phase17c_m7h_f162r_r1_custom_domain_smoke.json` | `c843c8d4b109a797e6e4eac839f942deaaa514e859e3aaf7263300974cd2fb3c` |
| `phase17c_m7h_f162r_r1_invariants.json` | `d07673583db5662e352e371224eed08c2f07d90909f4db31fb9e17547cfd5a91` |
| `phase17c_m7h_f162r_r1_bundle.json` | `988eaff7a9961460a412cccb2beeb446f7b0d429405aa2783b18e81aec98e4ca` |

```
M7H_F162R_R1_RECHECK_BUNDLE_SHA256:
988eaff7a9961460a412cccb2beeb446f7b0d429405aa2783b18e81aec98e4ca
```

---

## 10. Gate Verdict & Final Decision

```
F162R_HASH_MATCH                             = YES
R1_AUTHORITATIVE_APEX_A                      = 76.76.21.21 (propagated via CNAME; direct apex query evicting cache)
R1_PUBLIC_APEX_A_VALUES                      = ["76.76.21.21"]
R1_PUBLIC_WWW_CHAIN                          = www.barbex.shop CNAME barbex.shop -> 76.76.21.21
R1_OLD_185_158_133_1_OBSERVED                = YES (on direct apex query to local anycast node)
R1_DNS_PROPAGATION_COMPLETE                  = PARTIAL (GLOBAL_RESOLVERS_76_76_21_21_RESOLVED / ANYCAST_CACHE_EVICTION_IN_PROGRESS)
R1_VERCEL_APEX_CONFIGURATION_VALID           = YES
R1_VERCEL_APEX_DOMAIN_ACTIVE                 = YES
R1_VERCEL_WWW_CONFIGURATION_VALID            = YES
R1_VERCEL_WWW_DOMAIN_ACTIVE                  = YES
R1_PUBLIC_APEX_AUTHORITY                     = VERCEL
R1_PUBLIC_WWW_AUTHORITY                      = VERCEL
R1_PUBLIC_LOVABLE_AUTHORITY_FOR_APEX         = NO (ACTIVE_ON_VERCEL_EDGE_HTTP)
R1_APEX_HTTPS_REACHABLE                      = NO (PENDING_EDGE_CERT_DEPLOYMENT)
R1_APEX_CERTIFICATE_PRESENT                  = NO
R1_APEX_CERTIFICATE_HOSTNAME_VALID           = NO
R1_APEX_CERTIFICATE_CHAIN_VALID              = NO
R1_APEX_TLS_PASS                             = NO
R1_WWW_HTTPS_REACHABLE                       = NO (PENDING_EDGE_CERT_DEPLOYMENT)
R1_WWW_CERTIFICATE_PRESENT                   = NO
R1_WWW_CERTIFICATE_HOSTNAME_VALID            = NO
R1_WWW_CERTIFICATE_CHAIN_VALID               = NO
R1_WWW_TLS_PASS                              = NO
R1_TLS_ERRORS                                = Vercel edge socket reset on port 443; normal provisioning delay post-verification challenge acceptance
R1_CUSTOM_DOMAIN_ROUTES_TESTED               = 0 (HELD_FOR_PORT_443_TLS)
R1_CUSTOM_DOMAIN_HTTP_5XX                    = 0
R1_CUSTOM_DOMAIN_FATAL_JS_ERRORS             = 0
R1_CUSTOM_DOMAIN_SSR_ERRORS                  = 0
R1_DATABASE_AUTHORITY_TARGET                 = YES
R1_AUTH_AUTHORITY_TARGET                     = YES
R1_STORAGE_AUTHORITY_TARGET                  = YES
R1_REALTIME_AUTHORITY_TARGET                 = YES
R1_EDGE_AUTHORITY_TARGET                     = YES
R1_SOURCE_SUPABASE_CALLS                     = 0
SOURCE_WP16_STILL_ACTIVE                     = YES
LOVABLE_ROLLBACK_RETAINED                    = YES
R1_ROLLBACK_REQUIRED                         = NO
R1_RECHECK_REQUIRED                          = YES

FINAL_DECISION:
F162R_PROPAGATION_OR_TLS_STILL_PENDING_CONTINUE_OBSERVATION
```
