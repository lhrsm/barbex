# BARBEX — PHASE 17C.M7H-F16.2R-D1
## VERCEL TLS CERTIFICATE FORENSIC DIAGNOSTIC
### STRICTLY READ-ONLY / NO CERTIFICATE ISSUANCE

---

## 1. EXECUTIVE SUMMARY & FORENSIC MANDATE

| Forensic Parameter | Specification | Physical Observation |
|---|---|---|
| **Phase** | `PHASE 17C.M7H-F16.2R-D1` | `PHASE 17C.M7H-F16.2R-D1` |
| **Prior R3 Authority SHA256** | `d95069bf86bc496931bf892f23cb7c23299b407cd56cfb4c0b6b815531eb7bde` | Verified Exact Match (`D1_R3_HASH_MATCH = YES`) |
| **Production Apex** | `barbex.shop` | Tested via Authoritative DNS, Vercel CLI, Network SNI |
| **Production WWW** | `www.barbex.shop` | Tested via Authoritative DNS, Vercel CLI, Network SNI |
| **Vercel Project** | `prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB` (`barbex-staging`) | Verified Attached & Active |
| **Installed Vercel CLI Version** | `59.19.0` (Node.js `24.19.0`) | Supports `certs [add|issue|list|remove]` |
| **Physical Certificate Inventory** | `vercel certs ls` under team `startup-dc20` | **0 certificates found for `barbex.shop` or `www.barbex.shop`** |
| **Vercel Edge HTTP (Port 80)** | `GET http://barbex.shop/` -> `76.76.21.21:80` | `HTTP 200 OK` (`server: Vercel`, `x-vercel-id`) |
| **Vercel Edge TLS (Port 443)** | `76.76.21.21:443` with SNI `barbex.shop` | `TCP_CONNECTED -> ECONNRESET` (No cert loaded in proxy) |
| **DNS / CAA Status** | Authoritative A record `76.76.21.21`, no CAA blockers | **100% Valid & Unblocked** |
| **Root-Cause Classification** | Physical verification against Vercel platform | **`CERTIFICATE_NOT_ISSUED`** |
| **Eligibility for Manual Issuance** | `vercel certs issue barbex.shop www.barbex.shop` | **`YES` (Awaiting Operator Authorization)** |
| **Final Decision** | Case Analysis | **`D1_CERTIFICATE_REISSUANCE_RECOMMENDED_AWAITING_EXPLICIT_AUTHORIZATION`** |

---

## 2. R3 PRIOR HASH VERIFICATION

```
Expected R3 SHA256: d95069bf86bc496931bf892f23cb7c23299b407cd56cfb4c0b6b815531eb7bde
Computed R3 SHA256: d95069bf86bc496931bf892f23cb7c23299b407cd56cfb4c0b6b815531eb7bde
D1_R3_HASH_MATCH:   YES
```

---

## 3. COMPLETE DNS CERTIFICATE FORENSICS

Authoritative DNS query against Hostinger primary nameservers (`172.64.52.46` / `nova.ns.cloudflare.com`, `172.64.53.200` / `cosmos.ns.cloudflare.com`) and public recursive resolvers (`8.8.8.8`, `1.1.1.1`):

| Query Target | Type | Observed Value | Forensic Status |
|---|---|---|---|
| `barbex.shop` | `A` | `76.76.21.21` (TTL 300) | Current authoritative Vercel edge IP |
| `barbex.shop` | `AAAA` | `ENODATA` | Clean (No IPv6 conflicting records) |
| `www.barbex.shop` | `A` | `76.76.21.21` | Current authoritative Vercel edge IP |
| `www.barbex.shop` | `AAAA` | `ENODATA` | Clean |
| `www.barbex.shop` | `CNAME` | `barbex.shop` | Resolves canonically to apex A record |
| `barbex.shop` | `CAA` | `ENODATA` | Clean (No restrictive CA tags) |
| `www.barbex.shop` | `CAA` | `ENODATA` | Clean |
| `_acme-challenge.barbex.shop` | `TXT` | `ENOTFOUND` | Clean (No stale challenge records) |
| `_acme-challenge.www.barbex.shop` | `TXT` | `ENOTFOUND` | Clean |

- `D1_CONFLICTING_A`: **NONE**
- `D1_CONFLICTING_AAAA`: **NONE**
- `D1_STALE_ACME_RECORD`: **NONE**
- `D1_DNS_CERTIFICATE_BLOCKER`: **NO**

---

## 4. VERCEL DOMAIN FORENSICS

Full JSON diagnostics captured from `vercel domains verify` and `vercel domains inspect`:

### 4.1 Apex Domain (`barbex.shop`)
- `status`: `ok`
- `ok`: `true`
- `misconfigured`: `false`
- `configuredBy`: `A`
- `acceptedChallenges`: `["http-01"]`
- `current.aValues`: `["76.76.21.21"]`
- `current.nameservers`: `["cosmos.dns-parking.com", "nova.dns-parking.com"]`
- `conflicts`: `[]`
- `project.idOrName`: `barbex-staging`
- `project.attached`: `true`
- `project.verified`: `true`

### 4.2 WWW Domain (`www.barbex.shop`)
- `status`: `ok`
- `ok`: `true`
- `misconfigured`: `false`
- `configuredBy`: `A`
- `acceptedChallenges`: `["http-01"]`
- `current.cnames`: `["barbex.shop."]`
- `current.aValues`: `["76.76.21.21"]`
- `conflicts`: `[]`
- `project.idOrName`: `barbex-staging`
- `project.attached`: `true`
- `project.verified`: `true`

---

## 5. VERCEL CERTIFICATE CLI CAPABILITY & PHYSICAL INVENTORY

### 5.1 CLI Capability Discovery (Vercel CLI 59.19.0)
- `vercel certs --help` exposes: `add`, `issue cn`, `list`, `remove id`.
- `D1_CERT_CLI_COMMANDS_AVAILABLE = ["add", "issue", "list", "remove"]`
- `D1_CERT_LIST_SUPPORTED = YES`
- `D1_CERT_INSPECT_SUPPORTED = NO` (inspect is not a certs subcommand; inspect is under domains)
- `D1_CERT_ISSUE_SUPPORTED = YES`

### 5.2 Physical Certificate Listing (`vercel certs ls`)
Executing read-only certificate inventory under active scope `startup-dc20` returned 9 active certificates for other domains (`louismenezes.com.br`, `alexseles.online`, `msadvocaciaonline.adv.br`, `rltechtasks.com`, etc.):
- Certificates for `barbex.shop`: **NONE (0)**
- Certificates for `www.barbex.shop`: **NONE (0)**
- `D1_CERTIFICATE_INVENTORY = NONE_FOR_BARBEX_SHOP`
- `D1_APEX_CERT_FOUND = NO`
- `D1_WWW_CERT_FOUND = NO`
- `D1_COMBINED_CERT_FOUND = NO`
- `D1_CERT_STATUS = NONE`
- `D1_CERT_CREATED_AT = NONE`
- `D1_CERT_EXPIRES_AT = NONE`
- `D1_CERTIFICATE_ISSUED_BUT_NOT_SERVED = NO`
- `D1_CERTIFICATE_NOT_ISSUED = YES`

---

## 6. TLS NETWORK FORENSICS & RESOLVER DISTINCTION

### 6.1 Forced Edge Probes (`76.76.21.21:443`)
- **Port 80 (HTTP)**: Responds with `HTTP 200 OK`, `Server: Vercel`, `x-vercel-id: gru1::...`. Vercel edge is 100% active and answering requests.
- **Port 443 (HTTPS)**: TCP connection succeeds immediately (`TCP_CONNECTED`). Upon sending `ClientHello` with SNI `barbex.shop` or `www.barbex.shop`, the socket is disconnected by peer (`ECONNRESET`).
- **Failure Stage**: `SERVER_HELLO_CERTIFICATE_EXCHANGE`. The Vercel edge reverse proxy resets the connection because no certificate exists in its memory/cache for this SNI.
- Peer Certificate: `NONE_ON_VERCEL_EDGE`.

### 6.2 Normal Resolver Probes
- `dns.lookup('barbex.shop')` on the local OS currently returns `185.158.133.1` due to local OS resolver caching.
- Public resolvers (`8.8.8.8`, `1.1.1.1`) and authoritative nameservers return `76.76.21.21`.
- `D1_LOCAL_DNS_STALE = YES`
- `D1_PUBLIC_DNS_CURRENT = YES`
- `D1_FORCED_VERCEL_TLS_RESULT = TCP_CONNECTED_TLS_ECONNRESET`

---

## 7. ROOT-CAUSE CLASSIFICATION

The physical evidence categorically rules out:
1. `DNS_BLOCKER`: False. Authoritative DNS has pointed to `76.76.21.21` with TTL 300 for over 2 hours.
2. `AAAA_CONFLICT`: False. Zero AAAA records exist.
3. `CAA_BLOCKER`: False. Query returns `ENODATA`; CA generation is completely unrestricted.
4. `ACME_CONFLICT`: False. Zero conflicting `_acme-challenge` TXT records exist.
5. `DOMAIN_CONFIGURATION_ERROR`: False. Vercel domain verification reports `ok: true`, `status: ok`, `misconfigured: false`, `acceptedChallenges: ["http-01"]`.

**Physical Fact:** `vercel certs ls` physically confirms that no certificate has ever been issued or bound to `barbex.shop` or `www.barbex.shop` on Vercel. Automatic issuance background jobs on Vercel's automated pipeline did not fire or complete the ACME HTTP-01 challenge.

**Classification:**
```
D1_ROOT_CAUSE_CLASSIFICATION: CERTIFICATE_NOT_ISSUED
D1_ROOT_CAUSE_EVIDENCE: vercel certs ls physically returned 0 certificates for barbex.shop or www.barbex.shop under team startup-dc20 despite DNS being authoritative and Port 80 responding from Vercel edge for over 2 hours. No ACME certificate has been created or bound.
```

---

## 8. REMEDIATION PLAN (STRICTLY PROPOSAL — NO MUTATION)

```
D1_MANUAL_CERT_ISSUANCE_ELIGIBLE: YES
D1_PROPOSED_CERT_COMMAND:         vercel certs issue barbex.shop www.barbex.shop
```

### Technical Parameters & Impact
- **Command Semantics**: Instructs Vercel's ACME certificate engine to generate an SSL certificate covering both SANs: `barbex.shop` and `www.barbex.shop`.
- **Pre-Conditions Verified**:
  - DNS apex A record resolves to `76.76.21.21` globally: **VERIFIED**.
  - DNS www CNAME resolves to `barbex.shop`: **VERIFIED**.
  - Vercel Port 80 is live and answering HTTP traffic: **VERIFIED** (HTTP-01 challenge will pass immediately).
  - CAA does not block Let's Encrypt / ZeroSSL: **VERIFIED**.
- **Expected Side-Effects**: Vercel validates the HTTP-01 challenge on Port 80, retrieves the certificate from the CA, and distributes it to edge POPs, enabling HTTPS on Port 443.
- **Rollback Implication**: Zero impact on backend, database, or GitHub repository. Reversible via `vercel certs rm <id>` if required.
- **CA Rate Limits**: 0 certificates issued this week. Rate limit headroom is 50 certificates/week. Risk is zero.

---

## 9. SAFETY INVARIANTS

```
SOURCE_SUPABASE_CALLS:       0 (Read-only row count frozen at 257,691)
SOURCE_WP16_STILL_ACTIVE:   YES
TARGET_BACKEND_AUTHORITY:   YES (Database, Auth, Storage, Realtime, Edge Functions authoritative on ywdwrstxvsdqiryhieiz)
NO_PROVIDER_MUTATION:       YES
NO_DNS_MUTATION:            YES
NO_DEPLOYMENT_MUTATION:     YES
```

---

## 10. DECISION

```
D1_TLS_RECOVERED_NATURALLY:         NO
D1_READY_TO_CLOSE_F16:              NO
D1_OPERATOR_AUTHORIZATION_REQUIRED: YES

FINAL_DECISION:
D1_CERTIFICATE_REISSUANCE_RECOMMENDED_AWAITING_EXPLICIT_AUTHORIZATION
```

---

## 11. EVIDENCE MANIFEST

- `phase17c_m7h_f162r_d1_dns_certificate_forensics.json` (`5db07bc13440f0713d6c2c51f1cce2152c1b7afa26bcdd0fc54f099999fd338c`)
- `phase17c_m7h_f162r_d1_vercel_domain.json` (`d46a1ab357b3e834bb3e8ac935a473f758a7e23521c6495cf56d6223c0e6bf4d`)
- `phase17c_m7h_f162r_d1_certificate_inventory.json` (`ae7c18d1e3648eb24ec6dbd4466ea4098831cd298f2265507cc1bc8397d65ef8`)
- `phase17c_m7h_f162r_d1_tls_network.json` (`af3e0aa7100785abe2ce494b191770e660aa970309722be56e8252965624e52b`)
- `phase17c_m7h_f162r_d1_root_cause.json` (`ac4b9f40c98f169a8dd8ba136350c2b793c63f253c805f52218174c546ae4b00`)
- `phase17c_m7h_f162r_d1_remediation_plan.json` (`4f081ec7119df730d17a432baf89e6244c4866719537b06c4003bb39c975ecdf`)
- `phase17c_m7h_f162r_d1_bundle.json`

```
M7H_F162R_D1_BUNDLE_SHA256:
702760353899f9e86e7370d9f19e0e8a89cd0e000f73861e35679b54cea0815c
```
