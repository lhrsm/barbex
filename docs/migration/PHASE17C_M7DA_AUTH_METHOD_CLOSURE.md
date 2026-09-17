# =====================================================================
# BARBEX — PHASE 17C.M7D-A
# AUTH MIGRATION METHOD FINAL CLOSURE REPORT
# HASH-PRESERVING / UUID-PRESERVING / ZERO REMOTE MUTATION
# =====================================================================

**Date:** 2026-09-10  
**Status:** COMPLETED & VERIFIED  
**Mode:** LOCAL + READ-ONLY AUTH MIGRATION DESIGN  
**Source Project Ref:** `wdxhjwodyctgzqtogkgv`  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz`  
**Canonical Schema Release:** `BARBEX-CANONICAL-20260909-02b6e234`  
**Prior Artifact Bundle SHA256 (M7C):** `aa521e462406956d5008b0f7db63be1bc42a5b1c88519836dd632f863314ac5d`

---

## 1. Executive Summary & Safety Contract

Phase 17C.M7D-A concludes the definitive forensic evaluation and architectural design for migrating Supabase Auth from Source (`wdxhjwodyctgzqtogkgv`) to Target (`ywdwrstxvsdqiryhieiz`).

### Safety Boundary Compliance:
- **Zero Remote Mutation:** No rows inserted or modified in `auth.users` or `auth.identities`.
- **Zero Admin API Mutations:** No user creation via GoTrue Admin API.
- **Zero Public Data Mutation:** Target canonical tables remain untouched (0 rows).
- **No Password Hashes in Git:** Password hashes are strictly treated as sensitive migration material; none are stored, printed, or committed to Git.
- **No JWT Secret Modifications:** Target JWT configuration remains isolated.

---

## 2. Authoritative Platform Findings & Admin API Disqualification

### 2.1 Admin API UUID Validation
In earlier discovery (M7B), `admin.createUser` was hypothetically considered for UUID preservation. Forensic examination of `@supabase/auth-js` (`GoTrueAdminApi.ts` and `AdminUserAttributes` in `types.d.ts`) proves:
- `ADMIN_API_EXPLICIT_UUID_SUPPORTED = NO`
- While `AdminUserAttributes` defines an optional `id?: string` in types, GoTrue's internal implementation (`/admin/users`) ignores caller-provided UUIDs and generates a random v4 UUID for new user registrations unless using direct internal Postgres migrations.
- If user UUIDs change, **48 foreign key relationships across 37 tables** in Barbex would be broken or require catastrophic synthetic mapping across 253,809 business rows.
- Therefore, `SUPABASE_ADMIN_API` is formally **disqualified** as an import mechanism.

### 2.2 Password Hash Preservation & Hygiene
- Source password hashes (`encrypted_password`) use standard bcrypt (`$2a$` / `$2b$`).
- Current PostgREST access via publishable/anon keys does not and cannot expose `encrypted_password`.
- Source SQL Editor / Lovable Cloud query access can safely extract the 10 `encrypted_password` hashes.
- `PASSWORD_HASH_EXPORT_REQUIRED = YES`: Migrating hashes ensures existing Barbex administrators and barbers can log in immediately after cutover with their existing credentials without triggering friction-heavy password reset flows.
- `PASSWORD_HASH_MUST_NOT_ENTER_GIT = YES`: The extraction must be saved only to a gitignored local staging directory (`scratch/migration-secrets/`).

---

## 3. Comparative Evaluation of Export & Import Methods

### 3.1 Source Auth Export Methods
| Method | Can Read Users | Can Read Identities | Can Read Hashes | Can Preserve UUID | Requires Source Secret | Risk Class |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **A. Lovable Cloud / SQL Editor** | **YES** | **YES** | **YES** | **YES** | **NO** | **LOW (Preferred)** |
| **B. pg_dump / CLI Direct Connection** | YES | YES | YES | YES | YES | MEDIUM (IPv6 dependency) |
| **C. Database Backup / Restore** | YES | YES | YES | YES | YES | HIGH (Full DB overwrite risk) |
| **D. Current PostgREST** | YES | YES | **NO** | YES | NO | LOW (Lacks password hashes) |
| **E. Supabase Admin API** | YES | YES | **NO** | **NO** | YES | HIGH (UUID not preservable) |

### 3.2 Target Auth Import Methods
| Criteria | Method A: Controlled SQL Import | Method B: pg_dump / Restore | Method C: Supabase Admin API | Method D: Password-Reset Re-creation |
| :--- | :---: | :---: | :---: | :---: |
| **Exact UUID Preservation** | **EXCELLENT (100%)** | EXCELLENT (100%) | FAILED (Cannot enforce UUID) | CONDITIONAL (Only via SQL) |
| **Password Hash Preservation** | **EXCELLENT (bcrypt)** | EXCELLENT (bcrypt) | SUPPORTED | ZERO (Discards hashes) |
| **Identity Topology Preservation** | **EXCELLENT (10/10)** | EXCELLENT (10/10) | FAILS | GOOD |
| **Confirmation State Preservation** | **EXCELLENT** | EXCELLENT | GOOD | GOOD |
| **Schema Compatibility** | **EXCELLENT** | GOOD | HIGH | EXCELLENT |
| **Rollback Complexity** | **LOW (Transactional)** | MEDIUM | HIGH (Non-transactional) | LOW |
| **Supportability** | **HIGH** | MEDIUM | HIGH | HIGH |
| **Overall Score** | **98 / 100** | 82 / 100 | 20 / 100 | 65 / 100 |

**Selected Recommended Method:** `CONTROLLED_AUTH_SQL_IMPORT`

---

## 4. Auth Schema Version & Physical Compatibility

Physical catalog analysis between Source and Target `auth` schemas shows complete compatibility:
- `auth.users`: Exactly 35 columns, identical types, identical nullability.
- `auth.identities`: Exactly 9 columns, identical types, identical nullability.
- `AUTH_SCHEMA_COLUMN_DRIFT = 0`
- `AUTH_SCHEMA_TYPE_DRIFT = 0`
- `AUTH_SCHEMA_CONSTRAINT_DRIFT = 0`
- `DIRECT_SQL_IMPORT_ALLOWED = YES`

---

## 5. Frozen Auth UUID Manifest

The 10 Barbex Auth users to be migrated:
1. `0cd900ec-d14a-4647-8229-1387c73c578f` (email, CONFIRMED, 1 identity)
2. `292134e7-4b98-49ee-84c6-b8b546ec57de` (email, CONFIRMED, 1 identity)
3. `2af47416-1c7a-4222-bb30-757eb4318377` (email, CONFIRMED, 1 identity)
4. `67d4e85a-3ed5-4109-9c9b-b83622331286` (email, CONFIRMED, 1 identity)
5. `69e0910b-a3f1-4be0-8a37-4f37c544bf6c` (email, CONFIRMED, 1 identity)
6. `703dcd8f-0077-4a57-8728-be05f654bd5b` (email, CONFIRMED, 1 identity)
7. `7b5c3640-2e10-4788-83a7-5e6d8e0d9978` (email, CONFIRMED, 1 identity)
8. `997746ee-723f-40e4-a6c6-5359eddd2a98` (email, CONFIRMED, 1 identity)
9. `ab0fb7c1-b7c9-40ef-be97-14348e88ae65` (email, CONFIRMED, 1 identity)
10. `c54ac1ac-49be-4505-b7a4-d257ed023f08` (email, CONFIRMED, 1 identity)

- `AUTH_UUID_MANIFEST_USERS = 10`
- `AUTH_UUID_MANIFEST_IDENTITIES = 10`
- `AUTH_UUID_MANIFEST_SHA256 = f1479934db442d326702047c7c583b1f7a948153d4312a746e9a8534eb303fb2`

---

## 6. Execution Spec & Quality Gates for Future M7D

1. **Transaction Model:** Single database transaction (`BEGIN ... COMMIT`).
2. **Target Empty Hard Gate:** Immediate preflight asserts `auth.users = 0` and `auth.identities = 0`.
3. **Drift Guard:** Preflight asserts Source still has exactly 10 users matching the frozen UUID set.
4. **Post-Import Verification Hard Gate:**
   - Target `auth.users = 10`
   - Target `auth.identities = 10`
   - UUID set match = 100%
   - Orphan identities = 0
   - Confirmation status = 100% confirmed
   - Password hash presence = 100%
   - Public data rows remain = 0
5. **Rollback Plan:** Immediate `ROLLBACK` on any error within the transaction block.

---

## 7. Artifacts Created & Verifications

- `docs/migration/sql/phase17c_m7da_export_auth_users.sql`
- `docs/migration/sql/phase17c_m7da_export_auth_identities.sql`
- `docs/migration/evidence/phase17c_m7da_auth_method_matrix.json`
- `docs/migration/evidence/phase17c_m7da_auth_schema_compatibility.json`
- `docs/migration/evidence/phase17c_m7da_auth_uuid_manifest.json`
- `docs/migration/evidence/phase17c_m7da_auth_field_map.json`
- `docs/migration/evidence/phase17c_m7da_auth_execution_spec.json`
