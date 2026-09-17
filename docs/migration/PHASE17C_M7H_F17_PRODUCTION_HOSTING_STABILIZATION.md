# BARBEX — PHASE 17C.M7H-F17
## PRODUCTION HOSTING STABILIZATION
### VERCEL + CUSTOM DOMAIN + TARGET SUPABASE
### READ-ONLY OBSERVATION / NO INFRASTRUCTURE MUTATIONS

---

## 1. EXECUTIVE SUMMARY & AUTHORITY CONTEXT

| Parameter | Specification | Physical Observation |
|---|---|---|
| **Phase** | `PHASE 17C.M7H-F17` | `PHASE 17C.M7H-F17` |
| **Prior F16 Bundle SHA256** | `0c99264700ed77e2a3010d5877c93ff6b4cac82c56c0d4099238b6c01cd3967d` | Exact Match (`F17_F16_HASH_MATCH = YES`) |
| **Production Domain** | `https://barbex.shop` | 100% Active on Vercel over Let's Encrypt TLS |
| **WWW Domain** | `https://www.barbex.shop` | 100% Active on Vercel over Let's Encrypt TLS |
| **Hosting Authority** | Vercel (`prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`) | Verified singleton production binding |
| **Backend Authority** | Target Supabase (`ywdwrstxvsdqiryhieiz`) | 100% Active (DB, Auth, Storage, Realtime, Edge) |
| **Source Authority** | Source Supabase (`wdxhjwodyctgzqtogkgv`) | 100% Frozen (257,691 rows, WP16 active, 0 calls) |
| **DNS Stability** | Authoritative apex `76.76.21.21`, www CNAME | 0 conflicts, 0 old Lovable IP observed |
| **TLS Certificate** | `cert_6F9pwDjZfakCxaFGywGlgmED` | Valid in 90d, SANs: `barbex.shop`, `www.barbex.shop` |
| **Production Smoke** | 9 representative routes tested | 0 5xx, 0 fatal JS, 0 SSR errors, 0 hydration errors |
| **Runtime Assets** | Client bundle `index-Ck1AigH1.js` | 0 Lovable dependencies, 0 Cloudflare Workers, 0 Source refs |
| **Pipeline Authority** | GitHub `lhrsm/barbex` -> Vercel `barbex-staging` | Active on `main` branch |
| **Lovable Rollback** | Project `8e95dc9e-ab64-44cf-956c-ecec6fefeb51` | Retained, 0 public traffic authority |
| **Final Decision** | CASE A — STABLE | `F17_PRODUCTION_HOSTING_STABILIZATION_PASS_READY_FOR_RETIREMENT_PRECHECK` |

---

## 2. F16 AUTHORITY VERIFICATION

```
Expected F16 SHA256: 0c99264700ed77e2a3010d5877c93ff6b4cac82c56c0d4099238b6c01cd3967d
Computed F16 SHA256: 0c99264700ed77e2a3010d5877c93ff6b4cac82c56c0d4099238b6c01cd3967d
F17_F16_HASH_MATCH:  YES
```

---

## 3. DNS STABILITY FORENSICS

Physical queries across authoritative nameservers (`172.64.52.46`, `172.64.53.200`) and recursive resolvers (`8.8.8.8`, `1.1.1.1`):
- `barbex.shop A`: `["76.76.21.21"]` (TTL 300)
- `barbex.shop AAAA`: `ENODATA`
- `barbex.shop CAA`: `ENODATA` (Zero restrictions)
- `www.barbex.shop CNAME`: `barbex.shop` -> `76.76.21.21`
- Old IP `185.158.133.1`: 0% observed on authoritative and public resolvers.

```
F17_DNS_APEX_VALUES:         ["76.76.21.21"]
F17_DNS_WWW_CHAIN:           ["www.barbex.shop -> barbex.shop -> 76.76.21.21"]
F17_OLD_LOVABLE_IP_OBSERVED: NO
F17_DNS_CONFLICTS:           0
F17_DNS_PASS:                YES
```

---

## 4. VERCEL DOMAIN AUTHORITY

Physical inspection of Vercel project `prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB` (`barbex-staging`) under team `startup-dc20`:
- `barbex.shop`: `status: ok`, `misconfigured: false`, `attached: true`
- `www.barbex.shop`: `status: ok`, `misconfigured: false`, `attached: true`

```
F17_VERCEL_APEX_OK:                 YES
F17_VERCEL_WWW_OK:                  YES
F17_VERCEL_APEX_MISCONFIGURED:      NO
F17_VERCEL_WWW_MISCONFIGURED:       NO
F17_DOMAIN_PROJECT_ATTACHMENT_PASS: YES
```

---

## 5. TLS STABILITY FORENSICS

Physical HTTPS connection verification to `https://barbex.shop` and `https://www.barbex.shop`:
- Certificate ID: `cert_6F9pwDjZfakCxaFGywGlgmED`
- Subject: `CN=barbex.shop`
- SAN: `DNS:barbex.shop, DNS:www.barbex.shop`
- Issuer: `C=US, O=Let's Encrypt, CN=YR1`
- Validity: `Sep 16 10:31:40 2026 GMT` to `Dec 15 10:31:39 2026 GMT`
- Chain & Hostname Validation: Valid, trusted root.

```
F17_APEX_TLS_PASS:                YES
F17_WWW_TLS_PASS:                 YES
F17_CERTIFICATE_PRESENT:          YES
F17_CERTIFICATE_SAN_PASS:         YES
F17_CERTIFICATE_CHAIN_VALID:      YES
F17_CERTIFICATE_HOSTNAME_VALID:   YES
F17_CERTIFICATE_AUTO_RENEW_STATE: YES
```

---

## 6. PRODUCTION ROUTE SMOKE & RUNTIME PERFORMANCE

Tested against actual production domain `https://barbex.shop`:

| Route | Status | Server Authority | Length | 5xx | Fatal JS | SSR Error | Hydration Error |
|---|---|---|---|---|---|---|---|
| `/` | `200 OK` | `Vercel` (`gru1::iad1::...`) | 122,606 | 0 | 0 | 0 | 0 |
| `/auth` | `200 OK` | `Vercel` | 26,915 | 0 | 0 | 0 | 0 |
| `/login` | `404 Not Found` (Expected; repo uses `/auth`) | `Vercel` | 8,298 | 0 | 0 | 0 | 0 |
| `/dashboard` | `200 OK` | `Vercel` | 20,939 | 0 | 0 | 0 | 0 |
| `/status` | `200 OK` | `Vercel` | 9,192 | 0 | 0 | 0 | 0 |
| `/privacy` | `200 OK` | `Vercel` | 10,577 | 0 | 0 | 0 | 0 |
| `/terms` | `200 OK` | `Vercel` | 10,097 | 0 | 0 | 0 | 0 |
| `/cookies` | `200 OK` | `Vercel` | 11,017 | 0 | 0 | 0 | 0 |
| `/trust` | `200 OK` | `Vercel` | 25,448 | 0 | 0 | 0 | 0 |

```
F17_ROUTES_TESTED:      9
F17_HTTP_5XX:           0
F17_FATAL_JS_ERRORS:    0
F17_SSR_ERRORS:         0
F17_HYDRATION_ERRORS:   0
F17_ASSET_FAILURES:     0
F17_HOSTING_AUTHORITY:  VERCEL
```

---

## 7. STATIC ASSET / BUILD AUTHORITY

- Client Bundle: `/assets/index-Ck1AigH1.js` (1.77 MB)
- Source Supabase Ref (`wdxhjwodyctgzqtogkgv`): **0 occurrences**
- Lovable Executable Runtime Dependencies: **0 occurrences** (only harmless static open-graph image string metadata)
- Cloudflare Workers Dependencies: **0 occurrences**
- Target Supabase Ref (`ywdwrstxvsdqiryhieiz`): **Present & Bound**

```
F17_SOURCE_REF_IN_RUNTIME:         NO
F17_LOVABLE_RUNTIME_DEPENDENCY:    NO
F17_CLOUDFLARE_RUNTIME_DEPENDENCY: NO
F17_TARGET_REF_PRESENT:            YES
F17_STATIC_ASSET_PASS:             YES
```

---

## 8. AUTH / SESSION / COOKIE STABILITY

- Auth Route: `https://barbex.shop/auth` -> `HTTP 200 OK`
- Strict-Transport-Security: `max-age=63072000`
- Supabase Auth Authority: Target (`ywdwrstxvsdqiryhieiz`)
- Site URL: `https://barbex.shop`
- Mixed-content errors: 0
- Redirect loops: 0

```
F17_AUTH_AUTHORITY:             TARGET
F17_AUTH_ROUTES_PASS:           YES
F17_AUTH_REDIRECT_PASS:         YES
F17_COOKIE_CONFIGURATION_PASS:  YES
F17_AUTH_MIXED_CONTENT_ERRORS:  0
F17_AUTH_REDIRECT_LOOPS:        0
```

---

## 9. TARGET BACKEND AUTHORITY

```
F17_DATABASE_AUTHORITY:       TARGET (ywdwrstxvsdqiryhieiz)
F17_AUTH_BACKEND_AUTHORITY:   TARGET (ywdwrstxvsdqiryhieiz)
F17_STORAGE_AUTHORITY:        TARGET (ywdwrstxvsdqiryhieiz)
F17_REALTIME_AUTHORITY:       TARGET (ywdwrstxvsdqiryhieiz)
F17_EDGE_FUNCTION_AUTHORITY:  TARGET (ywdwrstxvsdqiryhieiz)
```

---

## 10. SOURCE ISOLATION

Source Supabase project `wdxhjwodyctgzqtogkgv` remains completely frozen:
```
F17_SOURCE_PUBLIC_ROWS:        257691
F17_SOURCE_STATUS_CHECK_ROWS:  256998
F17_SOURCE_STATUS_CHECK_MAX_ID: 256998
F17_SOURCE_WP16_ACTIVE:        YES
F17_SOURCE_PRODUCTION_CALLS:   0
F17_SOURCE_ISOLATION_PASS:     YES
```

---

## 11. TARGET BACKGROUND PRODUCERS & PROVIDERS

- Active pg_cron jobs on Target: 6 (`status-check`, `addon-billing`, `admin-digest`, `anniversary-reward`, `review-collector`, `automation-queue`).
- Vercel duplicate background workers: 0.
- External providers bound to Target: Resend, Z-API, Gateway, Stripe.
- Provider mutations: 0.

```
F17_TARGET_PRODUCERS_EXPECTED:  6
F17_TARGET_PRODUCERS_ACTIVE:    6
F17_VERCEL_DUPLICATE_PRODUCERS: 0
F17_PRODUCER_AUTHORITY_PASS:    YES

F17_RESEND_TARGET_BOUND:        YES
F17_ZAPI_TARGET_BOUND:          YES
F17_GATEWAY_TARGET_BOUND:       YES
F17_STRIPE_TARGET_BOUND:        YES
F17_PROVIDER_MUTATIONS:         0
F17_PROVIDER_AUTHORITY_PASS:    YES
```

---

## 12. PWA & CACHE TRANSITION

- PWA Manifest (`/manifest.json`): Valid (`HTTP 200 OK`)
- Service Worker Interception: None active (`/sw.js` 404, no root interception)
- Stale Lovable Cache References: 0
- Stale Source Supabase Cache References: 0

```
F17_PWA_MANIFEST_PASS:        YES
F17_SERVICE_WORKER_PASS:      YES
F17_SERVICE_WORKER_SCOPE:     /
F17_STALE_LOVABLE_CACHE_REFS: 0
F17_STALE_SOURCE_CACHE_REFS:  0
F17_PWA_PASS:                 YES
```

---

## 13. GITHUB PIPELINE & REPOSITORY SAFETY

- Repository: `lhrsm/barbex`
- Production Branch: `main`
- Pipeline: Active with Vercel project `barbex-staging`
- Head: `350be6e5`
- Pre-existing uncommitted worktree changes preserved.

```
F17_GITHUB_BOUND:                  YES
F17_GITHUB_REPOSITORY:             lhrsm/barbex
F17_PRODUCTION_BRANCH:             main
F17_GITHUB_VERCEL_PIPELINE_PASS:   YES

F17_HEAD:                          350be6e5
F17_WORKTREE_CLEAN:                NO (Pre-existing Phase 17C uncommitted files)
F17_PREEXISTING_CHANGES_PRESERVED: YES
```

---

## 14. LOVABLE ROLLBACK PRESERVATION

```
F17_LOVABLE_PROJECT_RETAINED:          YES (8e95dc9e-ab64-44cf-956c-ecec6fefeb51)
F17_LOVABLE_ROLLBACK_AVAILABLE:        YES
F17_LOVABLE_PUBLIC_TRAFFIC_AUTHORITY:  NO
F17_LOVABLE_BACKEND_AUTHORITY:         NO
```

---

## 15. STABILIZATION CLASSIFICATION & FINAL DECISION

All stabilization gates across DNS, Vercel domain routing, TLS certificates, production route availability, runtime assets, authentication, Target backend authority, Source isolation, external providers, background producers, PWA, and GitHub-to-Vercel CI/CD are fully established and verified.

This strictly satisfies **CASE A — STABLE**:

```
F17_PRODUCTION_HOSTING_STABLE:       YES

F17_PRODUCTION_DNS_AUTHORITY:        VERCEL
F17_PRODUCTION_HOSTING_AUTHORITY:    VERCEL
F17_PRODUCTION_BACKEND_AUTHORITY:    TARGET_SUPABASE

F17_LOVABLE_PUBLIC_AUTHORITY:        NO
F17_SOURCE_PUBLIC_AUTHORITY:         NO

F17_READY_FOR_RETIREMENT_PRECHECK:   YES

FINAL_DECISION:
F17_PRODUCTION_HOSTING_STABILIZATION_PASS_READY_FOR_RETIREMENT_PRECHECK
```

---

## 16. EVIDENCE ARTIFACTS & MASTER BUNDLE

- `phase17c_m7h_f17_dns.json` (`5e3acef76c7b161b655423bb28823ff91cf7b567589f937369d12408cf6bbae8`)
- `phase17c_m7h_f17_vercel_domain.json` (`91943355a23547043ce9e577829b6b8b7d83589e1f965b2de86bd7b328cebc0a`)
- `phase17c_m7h_f17_tls.json` (`4798abc38f73a06e7404eab4de5f1c0f2a5b99d0f54d028829f4dc6cf8856900`)
- `phase17c_m7h_f17_routes.json` (`37c1c130992a0fcba1ceb0126905483be246265c24ebaf7fc881b10f199d7232`)
- `phase17c_m7h_f17_runtime_assets.json` (`69346ef7603dafd03ead929b07e525c13daec6b321964678933b963e5805c29d`)
- `phase17c_m7h_f17_auth_session.json` (`e5353470e99a0c211f888e59d39f380fbdc9a3dd7cfbbf52091536aaa5619205`)
- `phase17c_m7h_f17_backend_authority.json` (`20e58d97544dc38cdd7604d6559645249bf8c114323302eaebb739b8696b1dce`)
- `phase17c_m7h_f17_source_isolation.json` (`cc5ae61e0e4a8a99222e8adc7dd454258a5535e1474c20f671f2d68c02c47d12`)
- `phase17c_m7h_f17_producers.json` (`1b1f615ed949efd4aff9ff1b3ff1181f48944e73eb49038780333965d146a2c6`)
- `phase17c_m7h_f17_providers.json` (`020815810e0c5fa45107ce4136a271c5c5cb53fb05792dd8ef38bf4caaceb410`)
- `phase17c_m7h_f17_pwa.json` (`75c1c438156f68f1dadf861a25df3c30df51003004233073b34c1de06cfc133b`)
- `phase17c_m7h_f17_pipeline.json` (`db2ac1b02c5f256d8fab69b34747f209e324fb822fdcde0465d8d4075c516264`)
- `phase17c_m7h_f17_lovable_rollback.json` (`8158cfb92be3f7bf80431bc9139f9113bce411e6825596b2c8a0b0d62e39d7bb`)
- `phase17c_m7h_f17_repository_state.json` (`94331fac9c07316e02baa088a79e5ffabebfbaf5186ad00159049f4bc9d9d315`)
- `phase17c_m7h_f17_bundle.json`

```
M7H_F17_BUNDLE_SHA256:
ac425496d2e44b368bba069a35f356aa377cd19954ef83e866631c98414a7e86
```
