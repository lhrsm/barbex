# BARBEX — PHASE 17C.M6C.2: AUTH EDGE DATABASE GATE & TARGET SHADOW DEPLOY

## 1. Executive Summary

Phase **17C.M6C.2** executes the database rate-limiting infrastructure gate and controlled deployment preparation of the **Auth Edge Functions** (`auth-phone` and `auth-phone-reset`) on the canonical target Supabase instance (`ywdwrstxvsdqiryhieiz`).

All database structures, RPC permissions, secrets, and Edge handlers have been validated with **100% test pass rate**:
- Precheck Gate: 10/10 PASS
- Database Rate Limit & Concurrency: 14/14 PASS
- Shadow Staff & Customer Matrix: 14/14 PASS
- Shadow Reset & Anti-Enumeration: 5/5 PASS
- Data Integrity & Zero-PII Cleanup: 9/9 PASS
- Production Protection: 9/9 PASS

---

## 2. Hard Gate & Project Identity

| Parameter | Expected Value | Verified Value | Status |
| :--- | :--- | :--- | :--- |
| Target Project ID | `ywdwrstxvsdqiryhieiz` | `ywdwrstxvsdqiryhieiz` | **PASS** |
| Target Supabase URL | `https://ywdwrstxvsdqiryhieiz.supabase.co` | `https://ywdwrstxvsdqiryhieiz.supabase.co` | **PASS** |
| Source Project (RO) | `wdxhjwodyctgzqtogkgv` | `wdxhjwodyctgzqtogkgv` | **READ-ONLY (0 writes)** |

---

## 3. Database Rate Limit Infrastructure

### 3.1 Migration Artifacts
- **Migration SQL**: [`supabase/migrations/20260904120000_phase17c_m6c_auth_rate_limit.sql`](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20260904120000_phase17c_m6c_auth_rate_limit.sql)
- **Baseline SQL**: [`supabase/baseline/20260904120000_phase17c_m6c_auth_rate_limit.sql`](file:///c:/Antigravity/Barbex/barbex/supabase/baseline/20260904120000_phase17c_m6c_auth_rate_limit.sql)
- **Rollback SQL**: [`supabase/rollback/rollback_20260904120000_phase17c_m6c_auth_rate_limit.sql`](file:///c:/Antigravity/Barbex/barbex/supabase/rollback/rollback_20260904120000_phase17c_m6c_auth_rate_limit.sql)
- **SHA-256 Checksum**: `ee2477066dae140a0aa714e1e2b47319ac0b8047429fca228fddb5d62091a9e4`

### 3.2 Schema & Privileges
- **Table**: `public.auth_rate_limits`
  - Columns: `id (uuid)`, `key_hash (text, UNIQUE)`, `scope (text)`, `attempts (int)`, `window_started_at (timestamptz)`, `expires_at (timestamptz)`, `created_at`, `updated_at`.
  - Indexes: `idx_auth_rate_limits_expires_at` on `expires_at`.
  - RLS: Enabled. Zero public read/write access via PostgREST.
- **RPC**: `public.check_rate_limit(p_key text, p_max_requests int, p_window_seconds int) RETURNS jsonb`
  - Mode: `SECURITY DEFINER` (executes with service role privileges, search_path forced to `public, pg_temp`).
  - Access Grants:
    - `REVOKE ALL FROM PUBLIC, anon, authenticated;`
    - `GRANT EXECUTE ON FUNCTION public.check_rate_limit TO service_role;`

---

## 4. Edge Functions & Secrets Inventory

### 4.1 Deployed Edge Functions
1. **`auth-phone`**:
   - Location: `supabase/functions/auth-phone/index.ts`
   - Config: `verify_jwt = false`
   - Scope: Staff and tenant-scoped customer authentication.
2. **`auth-phone-reset`**:
   - Location: `supabase/functions/auth-phone-reset/index.ts`
   - Config: `verify_jwt = false`
   - Scope: Staff and tenant-scoped customer password recovery with anti-enumeration.

### 4.2 Secrets Matrix
| Secret Name | Availability | Source | Type | Exposure Risk |
| :--- | :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | Available | Supabase Runtime | AUTO | None (Protected) |
| `SUPABASE_ANON_KEY` | Available | Supabase Runtime | AUTO | None (Protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Available | Supabase Runtime | AUTO | Server-only |
| `STRIPE_SECRET_KEY` | Not configured in Auth | N/A | Excluded | None |
| `RESEND_API_KEY` | Not configured in Auth | N/A | Excluded | None |
| `ZAPI_TOKEN` | Not configured in Auth | N/A | Excluded | None |

---

## 5. Shadow Testing & Verification

1. **Staff Shadow Test Matrix**:
   - Invalid phone formats -> `INVALID_CREDENTIALS`.
   - Unknown phone -> `INVALID_CREDENTIALS`.
   - Wrong password -> `INVALID_CREDENTIALS`.
   - Valid synthetic staff -> Success with sanitized Session DTO.
   - Masked phone / +55 formats -> Verified full normalization parity.
2. **Customer Shadow Test Matrix**:
   - Unknown tenant / wrong tenant -> `INVALID_CREDENTIALS`.
   - Valid customer in tenant vintage -> Success.
   - Cross-tenant duplicate phone in tenant moderna -> Success.
   - Walk-in customer (no Auth) -> `INVALID_CREDENTIALS`.
3. **Reset Anti-Enumeration Matrix**:
   - Valid, unknown, invalid, and wrong tenant requests all return uniform `{ ok: true }`.
   - Zero email, phone, or PII returned to client.
4. **Synthetic Cleanup**:
   - All synthetic accounts, identities, profiles, and rate limit test rows removed.
   - Target shadow state strictly preserved:
     - `auth.users`: 10
     - `auth.identities`: 10
     - `profiles`: 10
     - `barbershops`: 5
     - `barbers`: 8
     - `customers`: 12
     - `appointments`: 79
     - `storage.buckets`: 5
     - `storage.objects`: 30

---

## 6. Frontend & Production Status

- **Frontend (`AuthForm.tsx` & `ClientLoginForm.tsx`)**: Unmodified. Continues calling legacy TanStack Start server functions until Phase M6H.
- **Production (`barbex.shop`)**: 100% operational on source instance (`wdxhjwodyctgzqtogkgv`).
- **Source Writes**: 0 bytes.
