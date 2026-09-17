# BARBEX — PHASE 17C.M6C: AUTH PHONE & RESET EDGE SPECIFICATION

## 1. Executive Summary

Phase **17C.M6C.1** delivers the server-side, privacy-preserving implementation of phone authentication and password reset workflows as native **Supabase Edge Functions**:
1. `auth-phone` — Handles staff and tenant-scoped customer sign-in via phone and password.
2. `auth-phone-reset` — Handles staff and customer password recovery via phone with strict anti-enumeration.
3. `auth_rate_limits` + `check_rate_limit` RPC — Distributed, atomic sliding window rate limiter with SHA-256 hashed keys (zero-PII, zero raw IP storage).

All implementations have been validated locally through automated test suites with **100% test pass rate (101/101 tests)**.

> [!IMPORTANT]
> **Zero Remote Deployment / Zero Production Mutation**:
> In accordance with Phase 17C.M6C.1 constraints, no Edge Functions were deployed to the remote target, no database migrations were materialized on the remote target, no business data was written, and production (`barbex.shop`) remains fully isolated and operational.

---

## 2. Architecture & Design Principles

```
                              ┌────────────────────────────────────────────────────────┐
                              │                      Browser / Client                  │
                              └───────────────────────────┬────────────────────────────┘
                                                          │ POST /functions/v1/auth-phone
                                                          │ (CORS Allowed Origins Only)
                                                          ▼
                                      ┌───────────────────────────────────────┐
                                      │   Supabase Edge Function: auth-phone  │
                                      │   (verify_jwt = false)                │
                                      └───────────────────┬───────────────────┘
                                                          │
                                     ┌────────────────────┴───────────────────┐
                                     │                                        │
                            [kind = "staff"]                        [kind = "customer"]
                                     │                                        │
                         1. Rate Limit (10/300s)                 1. Rate Limit (10/300s)
                         2. Canonical E.164                      2. Canonical E.164
                         3. profiles.phone Lookup                3. Resolve Tenant by Slug
                         4. Fallback in barbers.phone            4. Filter customers by tenant
                         5. Role IN staff roles                  5. Exactly 1 customer match
                         6. Deduplicate / Fail-closed            6. Role == 'client' validation
                                     │                                        │
                                     └────────────────────┬───────────────────┘
                                                          │
                                                          ▼
                                      ┌───────────────────────────────────────┐
                                      │ 7. Server-Side Email Lookup (GoTrue)  │
                                      │    auth.admin.getUserById(userId)     │
                                      │    (Email is NEVER exposed to client) │
                                      └───────────────────┬───────────────────┘
                                                          │
                                                          ▼
                                      ┌───────────────────────────────────────┐
                                      │ 8. Ephemeral GoTrue Auth Client       │
                                      │    signInWithPassword(email, pass)    │
                                      │    (anonKey, persistSession = false)  │
                                      └───────────────────┬───────────────────┘
                                                          │
                                                          ▼
                                      ┌───────────────────────────────────────┐
                                      │ 9. Sanitized Session DTO Response     │
                                      │    { access_token, refresh_token,     │
                                      │      expires_in, expires_at, type }   │
                                      └───────────────────────────────────────┘
```

---

## 3. Function Contracts & DTOs

### 3.1 `auth-phone` Contract

- **Endpoint**: `POST /functions/v1/auth-phone`
- **Preflight**: `OPTIONS` returns HTTP 204 No Content with restrictive CORS headers.
- **Payload Schema**:

#### Staff Login:
```json
{
  "kind": "staff",
  "phone": "(71) 98274-7130",
  "password": "StrongStaffPassword123!"
}
```

#### Customer Login:
```json
{
  "kind": "customer",
  "tenantSlug": "barbearia-vintage",
  "phone": "(71) 98274-7130",
  "password": "CustomerPassword123!"
}
```

#### Success Response (HTTP 200):
```json
{
  "ok": true,
  "session": {
    "access_token": "mock_access_token_sample...",
    "refresh_token": "dGhpcy1pcy...",
    "expires_in": 3600,
    "expires_at": 1757000000,
    "token_type": "bearer"
  },
  "requestId": "req_01955b4a72e87010a369..."
}
```

#### Failure Response (HTTP 200):
```json
{
  "ok": false,
  "code": "INVALID_CREDENTIALS",
  "requestId": "req_01955b4a72e87010a369..."
}
```
*Possible Error Codes*: `INVALID_CREDENTIALS`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`.

---

### 3.2 `auth-phone-reset` Contract

- **Endpoint**: `POST /functions/v1/auth-phone-reset`
- **Anti-Enumeration Guarantee**: Always returns `{ ok: true, requestId }` regardless of whether the phone exists, is unknown, invalid, belongs to another tenant, is a walk-in, or triggers role collision.
- **Payload Schema**:

#### Staff Reset:
```json
{
  "kind": "staff",
  "phone": "(71) 98274-7130"
}
```

#### Customer Reset:
```json
{
  "kind": "customer",
  "tenantSlug": "barbearia-vintage",
  "phone": "(71) 98274-7130"
}
```

#### Response (HTTP 200):
```json
{
  "ok": true,
  "requestId": "req_01955b4a72e87010a369..."
}
```

---

## 4. Rate Limiting Architecture

### 4.1 Zero-PII Key Derivation
Keys are generated using SHA-256 hashes without storing raw phone numbers, emails, or IP addresses:

$$\text{Staff Key} = \text{"rl:auth:staff:"} + \text{SHA256}(\text{phone})_{0..32} + \text{":"} + \text{SHA256}(\text{IP})_{0..16}$$

$$\text{Customer Key} = \text{"rl:auth:customer:"} + \text{SHA256}(\text{tenantId})_{0..16} + \text{":"} + \text{SHA256}(\text{phone})_{0..32} + \text{":"} + \text{SHA256}(\text{IP})_{0..16}$$

### 4.2 Limits Matrix
| Context | Scope | Max Attempts | Window | Retry Behavior |
| :--- | :--- | :--- | :--- | :--- |
| Staff Login | `auth:staff` | 10 | 300 seconds (5 min) | HTTP 429 / `RATE_LIMITED` |
| Customer Login | `auth:customer` | 10 | 300 seconds (5 min) | HTTP 429 / `RATE_LIMITED` |
| Staff Reset | `auth:reset:staff` | 3 | 600 seconds (10 min) | HTTP 429 / `RATE_LIMITED` |
| Customer Reset | `auth:reset:customer` | 3 | 600 seconds (10 min) | HTTP 429 / `RATE_LIMITED` |

### 4.3 Database Schema & RPC
- Migration: `supabase/migrations/20260904120000_phase17c_m6c_auth_rate_limit.sql`
- Baseline: `supabase/baseline/20260904120000_phase17c_m6c_auth_rate_limit.sql`
- Table: `public.auth_rate_limits (key_hash, scope, attempts, window_started_at, expires_at)`
- RPC: `public.check_rate_limit(p_key text, p_max_requests int, p_window_seconds int)`
- Security: `REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role;`

---

## 5. Security Audits & Guarantees

1. **Password Security**: Volatile memory only. Passwords are never logged, never persisted in custom tables, and never included in error payloads.
2. **PII Redaction**: Email and phone numbers are never returned in Session DTOs or reset responses. Structured logger automatically strips JWT tokens, email patterns, phone patterns, and passwords.
3. **CORS Hardening**: Strict allowlist (`barbex.shop`, `www.barbex.shop`, `preview.barbex.shop`, `localhost`). Zero `*` wildcard reflection.
4. **Tenant Scoping**: Customer phone authentication resolves tenant via `profiles.slug` server-side and queries `customers` strictly with `tenant_id = effectiveTenantId`. Cross-tenant phone duplicates are isolated safely.

---

## 6. Test Suite & Validation Results

The test harness `scratch/test_m6c_auth_edge.mjs` was executed locally:

```
=======================================================
PHASE 17C.M6C.1 TEST RESULTS: 101/101 TESTS PASSED
ALL TESTS COMPLETED SUCCESSFULLY WITH ZERO ERRORS.
=======================================================
```

### Test Coverage Summary:
- **Phone Normalization Parity**: 22 tests (Brazilian E.164 formats with/without 55, landlines, mobiles, masking, invalid inputs).
- **Rate Limit Key Derivation**: 6 tests (prefix integrity, PII absence, IP composite hash, tenant isolation).
- **Atomic Rate Limiter & Concurrency**: 14 tests (10 sliding window increments, 11th rejection, 50-thread concurrent race condition validation).
- **Staff Login Matrix**: 14 tests (invalid phone, unknown phone, wrong password, valid staff, masked phone, ambiguity fail-closed, customer phone rejection, session DTO leak check).
- **Customer Login Matrix**: 8 tests (invalid phone, unknown tenant, valid tenant customer, cross-tenant duplicate phone, wrong tenant password, walk-in fail-closed, intra-tenant ambiguity fail-closed, staff profile rejection).
- **Anti-Enumeration Matrix**: 9 tests (staff valid, staff unknown, staff invalid, staff ambiguous, customer valid, customer wrong tenant, customer walk-in, staff-on-customer, rate limit trigger).
- **Redaction & Security**: 15 tests (password stripping, JWT stripping, email stripping, phone stripping, SQLSTATE sanitization).
