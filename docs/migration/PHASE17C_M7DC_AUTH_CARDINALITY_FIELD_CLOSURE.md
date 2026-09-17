# =====================================================================
# BARBEX — PHASE 17C.M7D-C
# AUTH SNAPSHOT CARDINALITY + SAFE FIELD CLOSURE REPORT
# ZERO TARGET MUTATION / COMPLETE FORENSIC RESOLUTION
# =====================================================================

**Date:** 2026-09-10  
**Status:** COMPLETED & VERIFIED  
**Mode:** LOCAL READ-ONLY VALIDATION ONLY  
**Source Project Ref:** `wdxhjwodyctgzqtogkgv`  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz`  
**Canonical Schema Release:** `BARBEX-CANONICAL-20260909-02b6e234`  
**Verified Snapshot Hashes:**
- Users File SHA256: `ded2ae546348ca71c5806f5665de39c2af1d0f71d21a9dfac0b6a02ab5ef05e8` (Match: YES)
- Identities File SHA256: `681e74382b174e2866fe1a2bfc675420d5116c57a7b773f1a50df136fc3004f7` (Match: YES)
- Snapshot Bundle SHA256: `ba198fc5543022713db7aefeccfce481153b439ea287618a33086e45ce15909f`

---

## 1. Executive Summary & Verification

Phase 17C.M7D-C definitively resolves the physical CSV cardinality, identity provider topology, volatile token sanitization, and safe field mapping for Barbex Auth migration.

### Safety Guarantees:
- **Zero Remote Mutations:** Neither Target nor Source has been modified.
- **Zero Secrets or Hashes in Git:** Physical CSVs remain safely quarantined in the gitignored `.migration-secrets/` directory.

---

## 2. Physical Cardinality & Provider Census

Parsed with standard CSV parsing:
- **`auth.users` Physical Rows:** 10
- **`auth.identities` Physical Rows:** 12
- **Provider Breakdown:**
  - `IDENTITIES_PROVIDER_EMAIL`: 10
  - `IDENTITIES_PROVIDER_PHONE`: 2
  - `IDENTITIES_PROVIDER_OTHER`: 0
  - `IDENTITIES_TOTAL`: 12 (10 + 2 + 0 = 12, mathematical identity satisfied)

### Resolution of Prior Ambiguity:
- **Prior Report Status:** `AMBIGUOUS`
- **Explanation:** Early M7A discovery queried identities through PostgREST which only enumerated primary email identities (`by_provider: { email: 10 }`). The physical SQL export from Lovable Cloud SQL Editor captures the complete database catalog, revealing 2 staff users have a linked phone identity in addition to their email identity.

---

## 3. User / Identity Topology

- `USERS_WITH_0_IDENTITIES`: 0
- `USERS_WITH_1_IDENTITY`: 8
- `USERS_WITH_2_IDENTITIES`: 2
- `USERS_WITH_GT2_IDENTITIES`: 0
- `USERS_WITH_EMAIL_IDENTITY`: 10
- `USERS_WITH_PHONE_IDENTITY`: 2
- `USERS_WITH_EMAIL_AND_PHONE_IDENTITY`: 2
- `ORPHAN_IDENTITIES`: 0 (100% of identities map to the 10 Barbex users)
- `DUPLICATE_PROVIDER_IDENTITIES`: 0 (No user has more than one identity of the same provider)

---

## 4. Volatile Token Audit & Sanitization Policy

### Token Census in Export:
- `confirmation_token`: 0 non-empty rows
- `recovery_token`: 3 non-empty rows
- `email_change_token_new`: 0 non-empty rows
- `email_change_token_current`: 0 non-empty rows
- `reauthentication_token`: 0 non-empty rows
- `confirmation_sent_at`: 3 non-empty rows
- `recovery_sent_at`: 3 non-empty rows

### Do-Not-Migrate Policy:
All volatile authentication tokens (`recovery_token`, `recovery_sent_at`, `confirmation_token`, `confirmation_sent_at`, `email_change_token_*`, `reauthentication_token_*`) are classified as `DO_NOT_IMPORT`. They will NOT be replayed into Target.

### Field Classification Summary (`auth.users`):
- `AUTH_USERS_IMPORT_EXACT_COUNT`: 14
- `AUTH_USERS_IMPORT_TRANSFORMED_COUNT`: 3 (`instance_id`, `phone`, `phone_confirmed_at`)
- `AUTH_USERS_TARGET_DEFAULT_COUNT`: 1 (`is_super_admin`)
- `AUTH_USERS_DO_NOT_IMPORT_COUNT`: 17 (tokens, dispatch timestamps, soft-delete, banned flags)
- Total Reviewed Columns: 35

---

## 5. Instance ID & Null Normalization

- **`instance_id`**: Uniformly `'00000000-0000-0000-0000-000000000000'::uuid` across all 10 Source rows, which is the canonical GoTrue single-tenant instance ID. Safe to preserve (`COPY_SOURCE_INSTANCE_ID_SAFE = YES`).
- **Null / Empty String Normalization**: Empty strings in optional columns (e.g. `phone`, `banned_until`) will be coerced to `NULL` via `NULLIF(val, '')` to prevent GoTrue schema constraint violations.

---

## 6. Target `auth.identities` Schema & Final Insert Columns

- **Generated Columns**: Target `auth.identities` columns are standard stored base columns (`AUTH_IDENTITIES_GENERATED_COLUMNS = NONE`).
- **`email` Column Insertable**: `YES`.
- **Final Target Insert Column Counts**:
  - `auth.users`: 17 explicit columns (`AUTH_USERS_VOLATILE_TOKEN_FIELDS_IMPORTED = NO`).
  - `auth.identities`: 9 explicit columns (`AUTH_IDENTITIES_GENERATED_FIELDS_IMPORTED = NO`).

---

## 7. Artifacts Created & Updated

- Evidence Artifacts:
  - [phase17c_m7dc_identity_cardinality.json](file:///c:/Antigravity/Barbex/barbex/docs/migration/evidence/phase17c_m7dc_identity_cardinality.json)
  - [phase17c_m7dc_auth_field_policy.json](file:///c:/Antigravity/Barbex/barbex/docs/migration/evidence/phase17c_m7dc_auth_field_policy.json)
  - [phase17c_m7dc_null_empty_compatibility.json](file:///c:/Antigravity/Barbex/barbex/docs/migration/evidence/phase17c_m7dc_null_empty_compatibility.json)
  - [phase17c_m7dc_final_insert_columns.json](file:///c:/Antigravity/Barbex/barbex/docs/migration/evidence/phase17c_m7dc_final_insert_columns.json)
- Closure Report: [PHASE17C_M7DC_AUTH_CARDINALITY_FIELD_CLOSURE.md](file:///c:/Antigravity/Barbex/barbex/docs/migration/PHASE17C_M7DC_AUTH_CARDINALITY_FIELD_CLOSURE.md)
