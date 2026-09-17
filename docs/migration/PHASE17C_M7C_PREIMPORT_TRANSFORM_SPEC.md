# =====================================================================
# BARBEX — PHASE 17C.M7C
# DATA REMEDIATION + PRE-IMPORT TRANSFORM SPECIFICATION
# MIGRATION ARTIFACT BUILD / ZERO REMOTE MUTATION
# =====================================================================

**Release:** `BARBEX-CANONICAL-20260909-02b6e234`  
**Execution Timestamp:** 2026-09-09T16:35:00Z  
**Mode:** LOCAL MIGRATION ARTIFACT PREPARATION + READ-ONLY VALIDATION  
**Source Project Ref:** `wdxhjwodyctgzqtogkgv` (Authorized Read-Only)  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz` (Authorized Read-Only)  
**Safety Contract:** STRICT ZERO REMOTE MUTATIONS (Source Untouched, Target Untouched, No Commits, No Pushes)  

---

## 1. Executive Summary & Artifact Governance

Phase 17C.M7C translates the forensic discoveries of Phases 17C.M7A and 17C.M7B into deterministic, immutable migration artifacts.

### Key Deliverables & Determinations:
1. **Target Schema Invariant:** Confirmed 100% compliant with canonical release `BARBEX-CANONICAL-20260909-02b6e234`. All 159 tables, 2,198 columns, 279 FKs, 58 uniques, 59 checks, 110 triggers, 202 functions, and 394 policies remain active and pristine.
2. **Remediation Manifest (`phase17c_m7c_remediation_manifest.json`):**
   - **Appointments Transform:** Exactly 5 rows (`appointments.subscription_id` set to `NULL`).
   - **Barber Services Exclusion:** Exactly 4 rows (junction rows for deleted barber `5959e528` excluded).
   - **Remediation Manifest SHA256:** `1bc85fb7f7caef2156c22671f853bb9c4e0f709ed6eb324425bb6619e6c7f975`.
3. **Public Data Scope:**
   - **Source Public Rows Before Transform:** `253,813`
   - **Expected Imported Public Rows:** `253,809` (253,813 minus the 4 excluded `barber_services` rows; the 5 `appointments` rows remain with their nullable `subscription_id` transformed to `NULL`).
   - **Non-Empty Tables:** 25 tables.
   - **Empty Tables Skipped:** 134 tables (no INSERT statements generated).
4. **Topological Insertion Ordering:**
   - Evaluated and mathematically validated against all 279 canonical foreign keys.
   - `loyalty_levels` is proven to have 0 outgoing foreign keys and is positioned in **Level 0**.
   - `TOPOLOGICAL_ORDER_VALID: YES`
   - `TOPOLOGICAL_ORDER_FK_BLOCKERS: 0`
5. **Auth Precondition Boundary:**
   - Public data import is strictly prohibited until Target `auth.users` contains the exact 10 required UUIDs and matching identities (`TARGET_AUTH_USERS = 10`, `TARGET_AUTH_UUID_SET_MATCH = YES`).
   - `AUTH_BOOTSTRAP_REQUIRES_DIRECT_MANAGED_TABLE_WRITES: YES` (requires explicit separate authorization in Phase M7D).
   - `AUTH_LOGIN_POLICY: PASSWORD_RESET_OR_MAGIC_LINK_REQUIRED`.
6. **Trigger Strategy:**
   - `GLOBAL_REPLICA_MODE_REQUIRED: NO`.
   - Controlled suppression applied only to tables with `handle_updated_at` / realtime broadcast triggers (`profiles`, `barbers`, `customers`, `appointments`, `services`, `notifications`). All triggers restored before transaction commit.
7. **Storage Manifest & URL Rewriting:**
   - 5 buckets (1 with objects: `barber-avatars`, 4 empty).
   - 30 objects, 10,480,575 bytes total.
   - Exact 6 database rows (5 in `barbers`, 1 in `profiles`) containing project-specific storage URLs will be rewritten to reference Target project `ywdwrstxvsdqiryhieiz`.
8. **Immutability & Checksum:**
   - All 10 migration artifacts assembled and hashed in `phase17c_m7c_artifact_bundle.json`.
   - **M7C_MIGRATION_ARTIFACT_BUNDLE_SHA256:** `aa521e462406956d5008b0f7db63be1bc42a5b1c88519836dd632f863314ac5d`.

---

## 2. Reconfirmation of Remediation Policy

### 1. `appointments.subscription_id` (Orphan Set A)
- Exactly 5 Source rows reference `customer_subscriptions(id) = 3efdaed0-fe9d-4802-bb52-8108743db95e`.
- The parent table `customer_subscriptions` contains 0 rows in Source.
- Physical constraint: `FOREIGN KEY (subscription_id) REFERENCES customer_subscriptions(id) ON DELETE SET NULL`.
- Resolution: `SET subscription_id = NULL` for the 5 target appointment primary keys.
- **APPOINTMENT_TRANSFORM_ROWS = 5**.

### 2. `barber_services` (Orphan Set B)
- Exactly 4 Source rows reference deleted barber `5959e528-a329-4aac-a39a-fbc6f86d9d1d`.
- Physical constraint: `FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE`.
- The referenced barber was deleted from Source; under canonical schema rules, junction records cascade-delete.
- Resolution: Exclude these 4 obsolete rows from the migration export dataset.
- **BARBER_SERVICE_EXCLUSION_ROWS = 4**.

---

## 3. Immutable Remediation Manifest

The transformation manifest targets explicit primary keys with zero generic predicates:

```json
{
  "appointments_transforms": [
    { "id": "3da3b661-be36-441c-a9a5-9a48abe9bb1a", "action": "SET_NULL", "column": "subscription_id" },
    { "id": "39f8e617-51a6-4265-8d02-672d186b5b92", "action": "SET_NULL", "column": "subscription_id" },
    { "id": "683099a1-ec63-4aba-ba0a-23b20d47dab6", "action": "SET_NULL", "column": "subscription_id" },
    { "id": "13130eb0-f1ca-4d32-b4a1-9901f4d5093c", "action": "SET_NULL", "column": "subscription_id" },
    { "id": "329b8fe9-454c-4968-9937-ee8244a6b6bb", "action": "SET_NULL", "column": "subscription_id" }
  ],
  "barber_services_exclusions": [
    { "id": "00b25157-87d5-4044-ad2e-d9dcf96c2618", "action": "EXCLUDE_ROW" },
    { "id": "18e96e90-8e61-4142-aa06-93afd310216b", "action": "EXCLUDE_ROW" },
    { "id": "d371b9cb-469e-4b72-a3df-5489b8d3cb2f", "action": "EXCLUDE_ROW" },
    { "id": "d978ee8f-2688-4d58-b42e-822a8329888b", "action": "EXCLUDE_ROW" }
  ]
}
```

**REMEDIATION_MANIFEST_SHA256: 1bc85fb7f7caef2156c22671f853bb9c4e0f709ed6eb324425bb6619e6c7f975**

---

## 4. Source Snapshot Drift Guard

Documented in `docs/migration/evidence/phase17c_m7c_drift_guard_spec.json`:
- Assertions to execute immediately after Source write-freeze:
  - `auth.users = 10`
  - `auth.identities = 10`
  - `public.tables = 159`
  - `nonempty_tables = 25`
  - All 5 appointment primary keys exist and reference orphan subscription
  - All 4 barber_services primary keys exist and reference deleted barber
  - Zero new FK orphans appeared
  - Zero UNIQUE conflicts appeared
  - Zero CHECK conflicts appeared
  - Storage: 5 buckets, 30 objects, 10,480,575 bytes
- If any assertion fails: **MIGRATION ABORTS AUTOMATICALLY FOR RECONCILIATION**.

---

## 5. Complete 25-Table Data Manifest

| Level | Table Name | Rows Before | Rows After | PK | Batch Strategy | Trigger Policy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | `profiles` | 10 | 10 | `id` | Single Batch | Suppress `handle_updated_at` |
| **0** | `plans` | 3 | 3 | `id` | Single Batch | Normal Insert |
| **0** | `status_services` | 14 | 14 | `id` | Single Batch | Normal Insert |
| **0** | `saas_addons` | 17 | 17 | `id` | Single Batch | Normal Insert |
| **0** | `loyalty_settings` | 6 | 6 | `id` | Single Batch | Normal Insert |
| **0** | `loyalty_achievements` | 4 | 4 | `id` | Single Batch | Normal Insert |
| **0** | `loyalty_campaign_templates` | 20 | 20 | `id` | Single Batch | Normal Insert |
| **0** | `subprocessors` | 6 | 6 | `id` | Single Batch | Normal Insert |
| **0** | `tutorial_categories` | 21 | 21 | `id` | Single Batch | Normal Insert |
| **0** | `onboarding_settings` | 1 | 1 | `id` | Single Batch | Normal Insert |
| **0** | `loyalty_levels` | 4 | 4 | `id` | Single Batch | Normal Insert |
| **1** | `barbershops` | 5 | 5 | `id` | Single Batch | Normal Insert |
| **1** | `barbers` | 8 | 8 | `id` | Single Batch | Suppress `handle_updated_at` |
| **1** | `customers` | 12 | 12 | `id` | Single Batch | Suppress `handle_updated_at` |
| **1** | `services` | 8 | 8 | `id` | Single Batch | Suppress `handle_updated_at` |
| **1** | `status_checks` | 253,120 | 253,120 | `id` | Keyset 25,000 | Normal Insert |
| **1** | `tutorials` | 58 | 58 | `id` | Single Batch | Normal Insert |
| **1** | `barbershop_modules` | 145 | 145 | `id` | Single Batch | Normal Insert |
| **2** | `barber_services` | 26 | **22** | `id` | Single Batch | Normal Insert (-4 excluded) |
| **2** | `products` | 10 | 10 | `id` | Single Batch | Normal Insert |
| **2** | `subscription_plans` | 4 | 4 | `id` | Single Batch | Normal Insert |
| **3** | `appointments` | 79 | 79 | `id` | Single Batch | Suppress `handle_updated_at` (5 NULLs) |
| **3** | `subscription_plan_services` | 9 | 9 | `id` | Single Batch | Normal Insert |
| **4** | `appointment_reviews` | 6 | 6 | `id` | Single Batch | Normal Insert |
| **4** | `notifications` | 217 | 217 | `id` | Single Batch | Suppress broadcast trigger |
| **TOTAL** | **25 Tables** | **253,813** | **253,809** | - | - | - |

- `SOURCE_PUBLIC_ROWS_BEFORE_TRANSFORM: 253813`
- `EXPECTED_IMPORTED_PUBLIC_ROWS: 253809`
- `EMPTY_TABLES_SKIPPED: 134`

---

## 6. Topological Insert Order Validation

All inter-table foreign keys were audited against the topological level ordering:
- `customers` references `loyalty_levels(id)`. Because `loyalty_levels` is in **Level 0** and `customers` is in **Level 1**, dependencies are 100% satisfied.
- `appointments` references `subscription_plans` (Level 2), `barbers` (Level 1), `customers` (Level 1), `services` (Level 1), and `profiles` (Level 0). All parents are loaded prior to Level 3.
- `TOPOLOGICAL_ORDER_VALID: YES`
- `TOPOLOGICAL_ORDER_FK_BLOCKERS: 0`

---

## 7. Auth Dependency Boundary & Bootstrap Specification

- Precondition: `TARGET_AUTH_USERS = 10` and `TARGET_AUTH_UUID_SET_MATCH = YES`.
- Public data import will fail-closed if Target `auth.users` does not contain all 10 verified UUIDs.
- `AUTH_BOOTSTRAP_REQUIRES_DIRECT_MANAGED_TABLE_WRITES: YES` (materialization will be handled in Phase M7D via privileged Target connection).
- `AUTH_LOGIN_POLICY: PASSWORD_RESET_OR_MAGIC_LINK_REQUIRED`.

---

## 8. Generated Column Omission Rule

- `public.customer_credits.available_amount` is a stored generated column: `(amount - used_amount)`.
- Explicit column lists are generated for all 25 tables in `phase17c_m7c_table_import_manifest.json`.
- `GENERATED_COLUMNS_EXCLUDED: 1`
- `AVAILABLE_AMOUNT_EXCLUDED_FROM_INSERT: YES`

---

## 9. Controlled Trigger Suppression Plan

- `GLOBAL_REPLICA_MODE_REQUIRED: NO`.
- Specific triggers will be disabled at the start of the table load block and re-enabled before validation/commit:
  - `profiles`: `handle_updated_at`
  - `barbers`: `handle_updated_at`
  - `customers`: `handle_updated_at`
  - `appointments`: `handle_updated_at`
  - `services`: `handle_updated_at`
  - `notifications`: `trg_notifications_broadcast`
- All foreign key constraint triggers remain active and enforced.

---

## 10. Verification Models (SQL Artifacts)

### 1. Foreign Key Verifier: `docs/migration/sql/phase17c_m7c_verify_fks.sql`
- Contains explicit anti-join queries testing all 279 canonical foreign keys.
- Fails with exception if any orphan rows are detected.
- `FK_VALIDATOR_RELATIONSHIPS: 279`
- `EXPECTED_FK_ORPHANS_AFTER: 0`

### 2. Constraints Verifier: `docs/migration/sql/phase17c_m7c_verify_constraints.sql`
- Contains grouped assertion queries testing all 58 unique constraints, 59 check constraints, and 14 enums.
- `UNIQUE_VALIDATORS: 58`
- `CHECK_VALIDATORS: 59`
- `ENUM_VALIDATORS: 14`

---

## 11. `status_checks` Batching Strategy & Sequence Reseed

- Primary Key: `id` (bigint)
- Range: `min_id = 1`, `max_id = 253,120`
- Expected Rows: `253,120`
- Batch Size: `25,000` rows using keyset pagination:
  `WHERE id > :last_id AND id <= :last_id + 25000 ORDER BY id ASC`
- Batch Count: **11 batches** (10 batches of 25,000 + 1 batch of 3,120).
- Sequence Reseed:
  `SELECT setval('public.status_checks_id_seq', 253120, true);`
  - `STATUS_CHECKS_EXPECTED_NEXT_ID: 253121`
  - `rate_limit_hits_id_seq`: `SELECT setval('public.rate_limit_hits_id_seq', 1, false);` (next generated ID = 1).

---

## 12. Storage Manifest & URL Rewriting

- Buckets: 5 (`barber-avatars`, `payment-receipts`, `support-attachments`, `system-assets`, `tutorial-assets`).
- Objects to migrate: **30** (all in `barber-avatars`, totaling 10,480,575 bytes).
- Objects to exclude: **0**.
- Project-Specific URL Rewrite:
  - 6 database rows (5 in `barbers.avatar_url`, 1 in `profiles.avatar_url` / `profiles.logo_url`).
  - Target URL format replaces `wdxhjwodyctgzqtogkgv` with `ywdwrstxvsdqiryhieiz`.
  - Stored in `docs/migration/evidence/phase17c_m7c_storage_url_rewrite_manifest.json`.

---

## 13. Public Data Transaction & Rollback Architecture

- All 25 tables will be loaded within a **SINGLE ATOMIC TRANSACTION** (`BEGIN ... COMMIT`).
- If any pre-commit check fails, `ROLLBACK` executes automatically, leaving Target pristine.
- Separate rollback manifests created for Auth, Storage, and Public Data in `phase17c_m7c_artifact_bundle.json`.
- Operational runbook ready: `FINAL_DELTA_RUNBOOK_READY = YES`.

---

## 14. Artifact Bundle Immutability

| Artifact Path | SHA256 Hash | Target Phase |
| :--- | :--- | :--- |
| `docs/migration/evidence/phase17c_m7c_remediation_manifest.json` | `1bc85fb7f7caef2156c22671f853bb9c4e0f709ed6eb324425bb6619e6c7f975` | M7F |
| `docs/migration/evidence/phase17c_m7c_table_import_manifest.json` | `4313a96dc0a2d568e5ec128a711aeb0609449a41eca19379f9ce7347716ccdf6` | M7F |
| `docs/migration/evidence/phase17c_m7c_auth_bootstrap_spec.json` | `35bf585ffafe3dd5c43108916bfbaca0de17940c34483ec19fd30ed06254c12c` | M7D |
| `docs/migration/evidence/phase17c_m7c_storage_manifest.json` | `fcc7eb0b7e4f386af4daf0596b48827ea9d031120dc92042252a43750cc968f5` | M7E |
| `docs/migration/evidence/phase17c_m7c_storage_url_rewrite_manifest.json` | `fdad2ac476e267f125b938161ba013831e800dc15de353a8d0b9ac3401535fa3` | M7G |
| `docs/migration/evidence/phase17c_m7c_sequence_reseed_spec.json` | `eab743182ae3d44a3ae851f44934fc0544e0a4224a001f91b532d3f7df33c76a` | M7G |
| `docs/migration/evidence/phase17c_m7c_trigger_policy.json` | `a323cca47b92bc6e7d7fba619d08a1bae0366f63e9945a73c22c3dbb19a7d555` | M7F |
| `docs/migration/evidence/phase17c_m7c_drift_guard_spec.json` | `2e1f9312ed3b2ff7e342669bdb2805f443d90a9e7e73779f3569a22b47d5297b` | M7F |
| `docs/migration/sql/phase17c_m7c_verify_fks.sql` | `3b35357e8899e7642f114801d810100d0756b9a7724ae8aad4b60755cb7298f0` | M7G |
| `docs/migration/sql/phase17c_m7c_verify_constraints.sql` | `e1f82f23bdfbbf94943fcf31c3fc6bf9664db6e648c660cb012a6858e7c10b74` | M7G |

**M7C_MIGRATION_ARTIFACT_BUNDLE_SHA256: aa521e462406956d5008b0f7db63be1bc42a5b1c88519836dd632f863314ac5d**

---

## 15. Gate Status & Conclusion

All required specifications, deterministic manifests, and SQL verifiers have been created and checksummed. Zero remote mutations have occurred on Source or Target.

**FINAL_DECISION: READY_FOR_M7D_AUTH_REVIEW**
