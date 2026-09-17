# BARBEX — PHASE 17C.M7H-F16.2R-D2
## CONTROLLED VERCEL TLS CERTIFICATE ISSUANCE & CLOSURE
### SINGLE AUTHORIZED CERTIFICATE MUTATION + PHYSICAL VERIFICATION

---

## 1. EXECUTIVE SUMMARY & AUTHORITY CONTEXT

| Parameter | Specification | Physical Observation |
|---|---|---|
| **Phase** | `PHASE 17C.M7H-F16.2R-D2` | `PHASE 17C.M7H-F16.2R-D2` |
| **Prior D1 Authority SHA256** | `702760353899f9e86e7370d9f19e0e8a89cd0e000f73861e35679b54cea0815c` | Exact Match (`D2_D1_HASH_MATCH = YES`) |
| **Production Apex** | `barbex.shop` | Validated over HTTPS with Let's Encrypt TLS |
| **Production WWW** | `www.barbex.shop` | Validated over HTTPS with Let's Encrypt TLS |
| **Vercel Project** | `prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB` (`barbex-staging`) | 100% Production Authority |
| **Target Supabase** | `ywdwrstxvsdqiryhieiz` | 100% Production Authority |
| **Source Supabase** | `wdxhjwodyctgzqtogkgv` | 100% Frozen Archival (0 calls, WP16 active) |
| **Certificate Mutation Execution** | `vercel certs issue barbex.shop www.barbex.shop` | Exactly 1 Attempt, Exit Code 0, Success |
| **Certificate ID** | `cert_6F9pwDjZfakCxaFGywGlgmED` | Active, Dual SAN (`barbex.shop`, `www.barbex.shop`) |
| **Apex HTTPS Handshake & Status** | `https://barbex.shop/` | `HTTP 200 OK`, Valid Certificate, Server: Vercel |
| **WWW HTTPS Handshake & Status** | `https://www.barbex.shop/` | `HTTP 200 OK`, Valid Certificate, Server: Vercel |
| **Custom Domain Production Smoke** | 4 routes (`/`, `/auth`, `/dashboard`, `/status`) | 0 5xx, 0 fatal JS, 0 SSR errors, Hosting: VERCEL |
| **Target Authority & Backend Binding** | Client bundle `index-Ck1AigH1.js` | Points 100% to `ywdwrstxvsdqiryhieiz`, 0 Source refs |
| **Final Decision** | Case A — TLS & Hosting Closed | `D2_CERTIFICATE_ISSUED_TLS_VERIFIED_F16_COMPLETE_READY_FOR_F17` |

---

## 2. D1 PRIOR HASH VERIFICATION

```
Expected D1 SHA256: 702760353899f9e86e7370d9f19e0e8a89cd0e000f73861e35679b54cea0815c
Computed D1 SHA256: 702760353899f9e86e7370d9f19e0e8a89cd0e000f73861e35679b54cea0815c
D2_D1_HASH_MATCH:   YES
```

---

## 3. PRE-MUTATION FAIL-CLOSED GATE

Preflight checks performed immediately before mutation:
- `A barbex.shop`: `76.76.21.21` (TTL 300)
- `AAAA barbex.shop`: `ENODATA`
- `A www.barbex.shop`: `76.76.21.21`
- `AAAA www.barbex.shop`: `ENODATA`
- `CNAME www.barbex.shop`: `barbex.shop`
- `CAA barbex.shop`: `ENODATA` (Zero restrictions)
- `Vercel apex status`: `ok` (`misconfigured: false`)
- `Vercel www status`: `ok` (`misconfigured: false`)
- `vercel certs ls preflight`: 0 certificates for `barbex.shop` or `www.barbex.shop`

```
D2_PREFLIGHT_DNS_PASS:              YES
D2_PREFLIGHT_DOMAIN_PASS:           YES
D2_PREFLIGHT_CAA_PASS:              YES
D2_PREFLIGHT_APEX_CERT_EXISTS:      NO
D2_PREFLIGHT_WWW_CERT_EXISTS:       NO
D2_CERT_RECOVERED_BEFORE_MUTATION:  NO
```

---

## 4. CONTROLLED CERTIFICATE ISSUANCE EXECUTION

Executed under authorized scope `startup-dc20`:
```bash
vercel certs issue barbex.shop www.barbex.shop --scope startup-dc20
```

### Execution Details:
- **Attempts**: 1 (Exactly one, no retries)
- **Exit Code**: `0`
- **Output**: `> Success! Certificate entry for barbex.shop, www.barbex.shop created [16s]`
- **Certificate ID**: `cert_6F9pwDjZfakCxaFGywGlgmED`
- **SAN Names**: `["barbex.shop", "www.barbex.shop"]`
- **Issuer**: Let's Encrypt (`YR1`)
- **Created At**: `2026-09-16T11:30:13.000Z`
- **Expires At**: `2026-12-15T10:31:39.000Z`
- **Auto-Renew**: `YES`

```
D2_CERT_ISSUANCE_EXECUTED: YES
D2_CERT_ISSUANCE_ATTEMPTS: 1
D2_CERT_ISSUANCE_EXIT_CODE: 0
D2_CERT_ISSUANCE_RESULT:   SUCCESS
D2_CERT_ID:                cert_6F9pwDjZfakCxaFGywGlgmED
D2_CERT_NAMES:             ["barbex.shop", "www.barbex.shop"]
D2_CERT_CREATED_AT:        2026-09-16T11:30:13.000Z
D2_CERT_EXPIRES_AT:        2026-12-15T10:31:39.000Z
D2_CERT_AUTO_RENEW:        YES
D2_CERT_CA:                Let's Encrypt
```

---

## 5. POST-ISSUANCE INVENTORY VERIFICATION

Read-only confirmation via `vercel certs ls`:
```
id: cert_6F9pwDjZfakCxaFGywGlgmED
cns: - barbex.shop
     - www.barbex.shop
expiration: in 90d
renew: yes
```

```
D2_POST_CERT_APEX_FOUND: YES
D2_POST_CERT_WWW_FOUND:  YES
D2_POST_CERT_ID:         cert_6F9pwDjZfakCxaFGywGlgmED
D2_POST_CERT_NAMES:      ["barbex.shop", "www.barbex.shop"]
D2_POST_CERT_VALID:      YES
```

---

## 6. TLS EDGE ACTIVATION OBSERVATION

Physical verification directly against Vercel edge IP (`76.76.21.21:443`) with strict TLS certificate verification enabled:

### 6.1 Apex Domain (`barbex.shop`)
- Reachable: `YES`
- HTTP Status: `200 OK`
- Server Header: `Vercel`
- Strict-Transport-Security: `max-age=63072000`
- Certificate Present: `YES`
- Certificate Subject: `CN=barbex.shop`
- Certificate SAN: `DNS:barbex.shop, DNS:www.barbex.shop`
- Certificate Issuer: `C=US, O=Let's Encrypt, CN=YR1`
- Not Before: `Sep 16 10:31:40 2026 GMT`
- Not After: `Dec 15 10:31:39 2026 GMT`
- Certificate Chain Valid: `YES`
- Hostname Valid: `YES`
- **TLS Pass**: `YES`

### 6.2 WWW Domain (`www.barbex.shop`)
- Reachable: `YES`
- HTTP Status: `200 OK`
- Server Header: `Vercel`
- Strict-Transport-Security: `max-age=63072000`
- Certificate Present: `YES`
- Certificate Subject: `CN=barbex.shop`
- Certificate SAN: `DNS:barbex.shop, DNS:www.barbex.shop`
- Certificate Issuer: `C=US, O=Let's Encrypt, CN=YR1`
- Not Before: `Sep 16 10:31:40 2026 GMT`
- Not After: `Dec 15 10:31:39 2026 GMT`
- Certificate Chain Valid: `YES`
- Hostname Valid: `YES`
- **TLS Pass**: `YES`

---

## 7. CUSTOM DOMAIN PRODUCTION SMOKE

Executed over HTTPS directly against production custom domain:

| Route | HTTP Status | Hosting Authority | Length | JS Errors | SSR Errors | Hydration Errors |
|---|---|---|---|---|---|---|
| `https://barbex.shop/` | `200 OK` | `VERCEL` (`gru1::iad1::...`) | 122,606 | 0 | 0 | 0 |
| `https://barbex.shop/auth` | `200 OK` | `VERCEL` (`gru1::iad1::...`) | 26,915 | 0 | 0 | 0 |
| `https://barbex.shop/dashboard` | `200 OK` | `VERCEL` (`gru1::iad1::...`) | 20,939 | 0 | 0 | 0 |
| `https://barbex.shop/status` | `200 OK` | `VERCEL` (`gru1::iad1::...`) | 9,192 | 0 | 0 | 0 |

```
D2_CUSTOM_DOMAIN_ROUTES_TESTED:         4
D2_CUSTOM_DOMAIN_HTTP_5XX:              0
D2_CUSTOM_DOMAIN_FATAL_JS_ERRORS:       0
D2_CUSTOM_DOMAIN_SSR_ERRORS:            0
D2_CUSTOM_DOMAIN_HYDRATION_FATAL_ERRORS: 0
D2_CUSTOM_DOMAIN_HOSTING_AUTHORITY:     VERCEL
```

---

## 8. WWW PRODUCTION CHECK

```
D2_WWW_HTTP_STATUS:   200
D2_WWW_FINAL_URL:      https://www.barbex.shop/
D2_WWW_REDIRECT_LOOP:  NO
D2_WWW_PASS:           YES
```

---

## 9. AUTH / SESSION MINIMAL CHECK

- Production client asset: `/assets/index-Ck1AigH1.js`
- Contains Target Supabase Ref (`ywdwrstxvsdqiryhieiz`): **TRUE**
- Contains Source Supabase Ref (`wdxhjwodyctgzqtogkgv`): **FALSE**
- Auth route status: `200 OK`
- Redirect loops: `0`
- Source calls: `0`

```
D2_AUTH_PASS:                  YES
D2_SESSION_CONFIGURATION_PASS: YES
D2_AUTH_REDIRECT_ERRORS:       0
D2_SOURCE_SUPABASE_CALLS:      0
```

---

## 10. SAFETY INVARIANTS

```
SOURCE_SUPABASE_CALLS:       0 (Public rows: 257,691, status_checks: 256,998)
SOURCE_WP16_STILL_ACTIVE:   YES
TARGET_DATABASE_AUTHORITY:  YES
TARGET_AUTH_AUTHORITY:      YES
TARGET_STORAGE_AUTHORITY:   YES
TARGET_REALTIME_AUTHORITY:  YES
TARGET_EDGE_AUTHORITY:      YES
TARGET_PRODUCERS_ACTIVE:    6
PROVIDER_MUTATIONS:         0
VERCEL_DUPLICATE_WORKERS:   0
LOVABLE_ROLLBACK_RETAINED:  YES
```

---

## 11. FINAL DECISION

All criteria of **CASE A — CERTIFICATE ISSUED AND TLS CLOSED** have been fully verified:

```
D2_CERTIFICATE_REMEDIATION_COMPLETE: YES

F162R_REACHED: YES
F16_REACHED:   YES

PRODUCTION_DNS_AUTHORITY:          VERCEL
PRODUCTION_HOSTING_AUTHORITY:      VERCEL
PRODUCTION_BACKEND_AUTHORITY:      TARGET_SUPABASE

PRODUCTION_DOMAIN:                 https://barbex.shop
PRODUCTION_DEPLOYMENT_PIPELINE:    GitHub lhrsm/barbex -> Vercel barbex-staging

LOVABLE_FRONTEND_PUBLIC_TRAFFIC_AUTHORITY: NO
LOVABLE_ROLLBACK_RETAINED:                 YES

BARBEX_FRONTEND_HOSTING_INDEPENDENCE: YES
BARBEX_BACKEND_INDEPENDENCE:          YES

READY_FOR_F17_HOSTING_STABILIZATION:  YES

FINAL_DECISION:
D2_CERTIFICATE_ISSUED_TLS_VERIFIED_F16_COMPLETE_READY_FOR_F17
```

---

## 12. EVIDENCE ARTIFACTS & MASTER BUNDLE

- `phase17c_m7h_f162r_d2_preflight.json` (`e2d845ebb84176d5896fb857630211cc8deb66aae96845125c4acff40c35e7a0`)
- `phase17c_m7h_f162r_d2_certificate_issuance.json` (`d32c9a7d3ae56cdb0589972328f7a3fdec8d09923448b45776f89aaacb40883a`)
- `phase17c_m7h_f162r_d2_certificate_inventory.json` (`2b5f208511960d61cb28fb2df7603a11f856275b14b6f002521c00666f00977b`)
- `phase17c_m7h_f162r_d2_tls.json` (`ffae7cc2c1ea6742b7cb98459bbe4fa224b82c8e105fe51437bb0beb48691721`)
- `phase17c_m7h_f162r_d2_custom_domain_smoke.json` (`41370a312482fcbd35625dcb03b3edc6b3537a0be17804038a47992d0f06a005`)
- `phase17c_m7h_f162r_d2_auth_session.json` (`d7744bf156d48a6d28e92aae14e2794fad44b9a26b36b672a1cbbef92c7b0710`)
- `phase17c_m7h_f162r_d2_invariants.json` (`663be614cb0483b9326994c2f295fe1ac07ab63e4fc5b5a0f0b38941d3c22cdd`)
- `phase17c_m7h_f162r_d2_bundle.json`

```
M7H_F162R_D2_BUNDLE_SHA256:
0c99264700ed77e2a3010d5877c93ff6b4cac82c56c0d4099238b6c01cd3967d
```
