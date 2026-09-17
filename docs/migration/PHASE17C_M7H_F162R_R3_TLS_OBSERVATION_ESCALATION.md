# BARBEX — PHASE 17C.M7H-F16.2R-R3
## TLS PROVISIONING FINAL OBSERVATION / ESCALATION GATE
### READ-ONLY — NO MUTATIONS

---

## 1. EXECUTIVE SUMMARY & AUTHORITY CONTEXT

| Parameter | Specification | Physical Observation |
|---|---|---|
| **Phase** | `PHASE 17C.M7H-F16.2R-R3` | `PHASE 17C.M7H-F16.2R-R3` |
| **Prior R2 Bundle SHA256** | `c1bee225ce9c1940988e701bfb4a0ed7befa528d9a5265d4c8e91827f6f6b9cb` | Exact Match (`R2_HASH_MATCH = YES`) |
| **Production Apex** | `barbex.shop` | Configured on Vercel |
| **Production WWW** | `www.barbex.shop` | Configured on Vercel |
| **Vercel Project** | `prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB` (`barbex-staging`) | Active / Verified |
| **Target Supabase Project** | `ywdwrstxvsdqiryhieiz` | 100% Authoritative |
| **Source Supabase Project** | `wdxhjwodyctgzqtogkgv` | 100% Frozen (WP16 Active, 0 calls) |
| **CAA Restrictions** | `barbex.shop CAA` query | `ENODATA` / No blocking CAA records |
| **Vercel Apex Domain Status** | `status: ok`, `ok: true`, `configuredBy: A` | `R3_VERCEL_APEX_DOMAIN_OK = YES` |
| **Vercel WWW Domain Status** | `status: ok`, `ok: true`, `configuredBy: A` | `R3_VERCEL_WWW_DOMAIN_OK = YES` |
| **Vercel Challenge Status** | `acceptedChallenges: ["http-01"]` | Accepted |
| **Vercel Edge HTTP (Port 80)** | `http://barbex.shop/` -> `76.76.21.21:80` | `HTTP 200 OK` (`server: Vercel`) |
| **Vercel Edge TLS (Port 443)** | `https://barbex.shop/` -> `76.76.21.21:443` | `ECONNRESET` (Certificate not yet active on edge) |
| **Final Decision** | Case B Classification | `F162R_TLS_NOT_YET_AVAILABLE_ESCALATE_TO_CERTIFICATE_DIAGNOSTIC` |

---

## 2. PRIOR HASH VERIFICATION

```
Expected R2 SHA256: c1bee225ce9c1940988e701bfb4a0ed7befa528d9a5265d4c8e91827f6f6b9cb
Computed R2 SHA256: c1bee225ce9c1940988e701bfb4a0ed7befa528d9a5265d4c8e91827f6f6b9cb
R2_HASH_MATCH: YES
```

---

## 3. DNS PHYSICAL EVIDENCE & CAA INSPECTION

### 3.1 Authoritative DNS Propagation
- Hostinger Authoritative Nameservers:
  - `nova.ns.cloudflare.com` (`172.64.52.46`): `barbex.shop A 76.76.21.21` (TTL 300)
  - `cosmos.ns.cloudflare.com` (`172.64.53.200`): `barbex.shop A 76.76.21.21` (TTL 300)
- Global Recursive Resolvers:
  - Google Public DNS (`8.8.8.8`): `76.76.21.21`
  - Cloudflare Public DNS (`1.1.1.1`): `76.76.21.21`
- Old IP Check:
  - Legacy `185.158.133.1` observed: **NO** (0% across all authoritative nameservers).

### 3.2 CAA Records Check
- DNS CAA Query on `barbex.shop`:
  - Result: `[]` (`ENODATA` / No CAA records returned).
- Assessment:
  - `R3_CAA_RECORDS = []`
  - `R3_CAA_RESTRICTIVE = NO`
  - `R3_CAA_POTENTIAL_CERT_BLOCK = NO`
  - Let's Encrypt and DigiCert (Vercel certificate authorities) are unrestricted.

---

## 4. VERCEL CONFIGURATION & CERTIFICATE STATE

Interrogation of Vercel project `prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB` (`barbex-staging`) via CLI:

### 4.1 Apex Domain (`barbex.shop`)
```json
{
  "name": "barbex.shop",
  "apexName": "barbex.shop",
  "projectId": "prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB",
  "verified": true,
  "verification": [
    { "type": "A", "domain": "barbex.shop", "value": "76.76.21.21", "reason": "pending_configuration" }
  ],
  "configuredBy": "A",
  "acceptedChallenges": ["http-01"],
  "misconfigured": false,
  "status": "ok",
  "ok": true
}
```

### 4.2 WWW Domain (`www.barbex.shop`)
```json
{
  "name": "www.barbex.shop",
  "apexName": "barbex.shop",
  "projectId": "prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB",
  "verified": true,
  "verification": [
    { "type": "CNAME", "domain": "www.barbex.shop", "value": "barbex.shop.", "reason": "pending_configuration" }
  ],
  "configuredBy": "A",
  "acceptedChallenges": ["http-01"],
  "misconfigured": false,
  "status": "ok",
  "ok": true
}
```

### 4.3 Vercel Status Summary
- `R3_VERCEL_APEX_DOMAIN_OK = YES`
- `R3_VERCEL_WWW_DOMAIN_OK = YES`
- `R3_VERCEL_APEX_CERT_STATUS = UNKNOWN` (Vercel CLI exposes no dedicated cert status subfield)
- `R3_VERCEL_WWW_CERT_STATUS = UNKNOWN`
- `R3_VERCEL_CERTIFICATE_EXISTS_APEX = NO`
- `R3_VERCEL_CERTIFICATE_EXISTS_WWW = NO`
- `R3_VERCEL_CERTIFICATE_ERROR_APEX = NONE`
- `R3_VERCEL_CERTIFICATE_ERROR_WWW = NONE`
- `R3_VERCEL_CHALLENGE_STATUS_APEX = ACCEPTED (http-01)`
- `R3_VERCEL_CHALLENGE_STATUS_WWW = ACCEPTED (http-01)`

---

## 5. TLS PHYSICAL OBSERVATION & HANDSHAKE ANALYSIS

### 5.1 Vercel Edge Server HTTP Confirmation (Port 80)
- Request: `GET http://barbex.shop/` resolving to `76.76.21.21:80`
- Response: `HTTP 200 OK`
- Headers:
  - `Server: Vercel`
  - `x-vercel-id: gru1::iad1::...`
- Physical Proof: Vercel edge is 100% active and serving content on port 80.

### 5.2 Forced Edge Resolution HTTPS Handshake (Port 443)
- Request: `curl --resolve barbex.shop:443:76.76.21.21 https://barbex.shop/`
- Connection: Socket established to `76.76.21.21:443`
- Handshake Attempt: Client Hello sent with SNI `barbex.shop`
- Result: `ECONNRESET` / Socket closed by remote peer without presenting an SSL certificate
- Observation: Vercel edge POPs reset connection on port 443 because certificate provisioning and global edge binding have not fully finished across all POP nodes.

### 5.3 Normal Resolution HTTPS Handshake
- Apex (`https://barbex.shop`): Resolves locally to cached Cloudflare IP `185.158.133.1` -> `HTTP 421 Misdirected Request` (Cloudflare SNI rejection).
- WWW (`https://www.barbex.shop`): Resolves locally to cached Cloudflare IP `185.158.133.1` -> `HTTP 421 Misdirected Request`.

---

## 6. SAFETY INVARIANTS CHECK

| Invariant | Status | Verification Detail |
|---|---|---|
| `R3_SOURCE_SUPABASE_CALLS` | `0` | Frozen table row counts constant at `257,691` |
| `SOURCE_WP16_STILL_ACTIVE` | `YES` | Write prevention trigger active |
| `R3_DATABASE_AUTHORITY_TARGET` | `YES` | Target holds 100% production data |
| `R3_AUTH_AUTHORITY_TARGET` | `YES` | Target handles user authentication |
| `R3_STORAGE_AUTHORITY_TARGET` | `YES` | Target buckets active |
| `R3_REALTIME_AUTHORITY_TARGET` | `YES` | Target publication active |
| `R3_EDGE_AUTHORITY_TARGET` | `YES` | Target edge functions active |
| `R3_PROVIDER_CALLBACK_MUTATIONS` | `0` | Provider callbacks untouched |
| `R3_VERCEL_DUPLICATE_WORKERS` | `0` | Clean singleton project binding |

---

## 7. DECISION DETERMINATION & ESCALATION

Under Section 8 rules:
- Authoritative DNS is globally complete (`76.76.21.21`).
- Vercel domain verification is valid and healthy (`status: ok`, `ok: true`).
- CAA records do not block certificate generation (`ENODATA`).
- Vercel CLI reports zero explicit certificate errors.
- TLS certificate is not yet presented on Vercel edge port 443.

Therefore, this matches **CASE B — CERTIFICATE STILL NOT AVAILABLE, NO EXPLICIT ERROR**:
- `R3_ROLLBACK_REQUIRED = NO`
- `R3_TLS_DIAGNOSTIC_REQUIRED = YES`
- **FINAL DECISION**: `F162R_TLS_NOT_YET_AVAILABLE_ESCALATE_TO_CERTIFICATE_DIAGNOSTIC`

---

## 8. EVIDENCE BUNDLE MANIFEST

Master bundle: `docs/migration/evidence/phase17c_m7h_f162r_r3_bundle.json`
**Bundle SHA256**: `d95069bf86bc496931bf892f23cb7c23299b407cd56cfb4c0b6b815531eb7bde`
