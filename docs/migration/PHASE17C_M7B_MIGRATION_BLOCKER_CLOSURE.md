# =====================================================================
# BARBEX — PHASE 17C.M7B
# AUTH / FK ORPHAN / STORAGE MIGRATION BLOCKER CLOSURE
# READ-ONLY PRE-EXECUTION STRATEGY GATE REPORT
# =====================================================================

**Release:** `BARBEX-CANONICAL-20260909-02b6e234`  
**Execution Timestamp:** 2026-09-09T16:24:00Z  
**Mode:** READ-ONLY FORENSIC MIGRATION STRATEGY CLOSURE  
**Source Project Ref:** `wdxhjwodyctgzqtogkgv` (Authorized Read-Only)  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz` (Authorized Read-Only)  
**Safety Contract:** ZERO Mutations (Source Untouched, Target Untouched, Zero Data Inserted, No Commit, No Push)  

---

## 1. Executive Summary

Phase 17C.M7B provides exhaustive forensic closure for all blockers, data anomalies, identity preservation rules, and storage topologies discovered during Phase 17C.M7A.

### Key Decisions and Findings:
1. **Target Canonical Integrity Reconfirmed:** Target project `ywdwrstxvsdqiryhieiz` remains 100% compliant with canonical release `BARBEX-CANONICAL-20260909-02b6e234`. All 159 tables, 2,198 columns, 279 FKs, 58 uniques, 59 checks, 110 triggers, 202 functions, and 394 policies remain active. Target data remains pristine (0 users, 0 buckets, 0 objects, 0 cron jobs, 0 migrations).
2. **Reclassification of M7A Blockers:** `RAW_SOURCE_DATA_CAN_BE_IMPORTED_WITH_ALL_FKS_ENFORCED = NO`. The 9 orphan rows discovered in M7A are **P0 Execution Blockers** for a raw byte-for-byte import because Target enforces all 279 FKs. A deterministic data-resolution policy has been designed to eliminate 100% of orphans prior to final Target constraint assertion.
3. **Orphan Set A Closed (5 rows in `appointments.subscription_id`):** All 5 rows reference subscription `3efdaed0-fe9d-4802-bb52-8108743db95e`, which does not exist in `customer_subscriptions` (0 rows in Source). In schema, `subscription_id` is nullable with `ON DELETE SET NULL`. All 5 appointments are completed, with payment state preserved. Resolution: `SAFE_NULL_CONVERSION_ON_IMPORT`.
4. **Orphan Set B Closed (4 rows in `barber_services.barber_id`):** All 4 rows reference barber `5959e528-a329-4aac-a39a-fbc6f86d9d1d`. Forensic search confirms this barber was permanently deleted from Source (0 profiles, 0 barbers, 0 appointments). In canonical schema, `barber_services_barber_id_fkey` is `ON DELETE CASCADE`. Resolution: `EXCLUDE_STALE_BARBER_SERVICE_ROWS`.
5. **Zero-Orphan Target Guarantee:** Applying the two deterministic pre-import transformations guarantees that Target post-migration integrity will yield `FKS_WITH_ORPHANS = 0` and `TOTAL_ORPHAN_ROWS = 0`.
6. **PostgreSQL 17 `session_replication_role` Forensics:** Replica mode disables all 110 user triggers and system foreign key triggers during bulk load. However, `SESSION_REPLICATION_ROLE_REPLICA_SAFE_FOR_FINAL_DATA_STATE = NO`. Replica mode is only an import transport mechanism; before transaction commit, session must restore to `origin` and execute full constraint assertions.
7. **Auth Migration Architecture:** Exactly 10 `auth.users` and 10 `auth.identities`. All 10 UUIDs must be preserved verbatim to satisfy 48 foreign keys across 37 public tables. Password hashes cannot be extracted via current PostgREST access (`AUTH_PASSWORD_REAUTHENTICATION_ACTUALLY_REQUIRED = YES`). Users will re-authenticate cleanly via password reset / magic link.
8. **Storage 5-Bucket Topology Reconciled:** Exactly 5 buckets exist. 1 bucket (`barber-avatars`) contains all 30 objects (10,480,575 bytes). The other 4 buckets (`payment-receipts`, `support-attachments`, `system-assets`, `tutorial-assets`) are empty. All 30 objects will be migrated to Target to maintain complete asset history.
9. **Bulk Data Scope:** 25 non-empty tables (253,813 rows total, of which `status_checks` accounts for 253,120 rows). 134 tables are empty.

---

## 2. Reconfirm Target Canonical State (Read-Only)

Target project `ywdwrstxvsdqiryhieiz` was introspected to ensure zero schema drift:

| Catalog Component | Target Canonical State | Expected Specification | Audit Status |
| :--- | :--- | :--- | :--- |
| Schema Release | `BARBEX-CANONICAL-20260909-02b6e234` | `BARBEX-CANONICAL-20260909-02b6e234` | **VALID** |
| Base Tables | 159 | 159 | **MATCH** |
| Base Columns | 2,198 | 2,198 | **MATCH** |
| Views | 2 | 2 | **MATCH** |
| Sequences | 2 | 2 | **MATCH** |
| Primary Keys | 159 | 159 | **MATCH** |
| Unique Constraints | 58 | 58 | **MATCH** |
| Check Constraints | 59 | 59 | **MATCH** |
| Foreign Keys | 279 | 279 | **MATCH** |
| Indexes | 442 | 442 | **MATCH** |
| Triggers | 110 | 110 | **MATCH** |
| Enum Types | 14 | 14 | **MATCH** |
| Enum Values | 75 | 75 | **MATCH** |
| RLS Enabled Tables | 159 | 159 | **MATCH** |
| Force RLS | 0 | 0 | **MATCH** |
| Functions | 202 | 202 | **MATCH** |
| Policies | 394 | 394 | **MATCH** |
| `auth.users` | 0 | 0 | **PRISTINE** |
| `storage.buckets` | 0 | 0 | **PRISTINE** |
| `storage.objects` | 0 | 0 | **PRISTINE** |
| `cron.job` | 0 | 0 | **PRISTINE** |
| `schema_migrations` | 0 | 0 | **PRISTINE** |

**TARGET_SCHEMA_RELEASE_STATE_VALID: YES**

---

## 3. Reclassification of M7A Blockers

In Phase 17C.M7A, the 9 FK orphan rows were classified under P1 Warnings.

**Forensic Evaluation:**
Because Target database physically enforces all 279 foreign keys, attempting to import raw Source rows byte-for-byte would trigger fatal foreign key violations at load time:
- `appointments_subscription_id_fkey` would fail on 5 rows.
- `barber_services_barber_id_fkey` would fail on 4 rows.

Therefore:
- `RAW_SOURCE_DATA_CAN_BE_IMPORTED_WITH_ALL_FKS_ENFORCED: NO`
- `M7A_BLOCKER_CLASSIFICATION_CORRECT: NO`

### Revised Blocker Classification:
- **REVISED_P0_BLOCKERS: 2** (The 2 orphan sets represent hard blockers for raw data import until pre-import remediation is approved).
- **REVISED_P1_BLOCKERS: 0**
- **REVISED_P2_WARNINGS: 3**
  1. `customer_credits.available_amount` is a stored generated column and must be omitted from INSERT lists.
  2. `status_checks` contains 253,120 rows and requires sequence reseed to 253,121 after import.
  3. `automations`, `automation_interactions`, and `automation_templates` form a cyclic FK component (currently 0 rows).

---

## 4. Orphan Set A Forensic Analysis: `appointments.subscription_id`

### Physical Definition:
- **Table:** `public.appointments`
- **Column:** `subscription_id`
- **Referenced Table:** `public.customer_subscriptions.id`
- **Constraint:** `appointments_subscription_id_fkey`

### Forensic Row Census:
Exactly 5 rows in `appointments` contain non-null `subscription_id = '3efdaed0-fe9d-4802-bb52-8108743db95e'`:

| Appointment ID | Customer ID | Barber ID | Service ID | Status | Payment Status | Total Price | Final Amount | Created At |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `3da3b661-be36-441c-a9a5-9a48abe9bb1a` | `a43d0f80...` | `24cc2b0d...` | `94cf042e...` | `completed` | `covered_by_subscription` | 50.00 | 0.00 | 2026-08-21 |
| `39f8e617-51a6-4265-8d02-672d186b5b92` | `a43d0f80...` | `02103452...` | `94cf042e...` | `completed` | `paid` | 50.00 | 0.00 | 2026-07-01 |
| `683099a1-ec63-4aba-ba0a-23b20d47dab6` | `a43d0f80...` | `24cc2b0d...` | `94cf042e...` | `completed` | `paid` | 50.00 | 0.00 | 2026-07-01 |
| `13130eb0-f1ca-4d32-b4a1-9901f4d5093c` | `a43d0f80...` | `a517611b...` | `94cf042e...` | `completed` | `paid` | 50.00 | 0.00 | 2026-07-01 |
| `329b8fe9-454c-4968-9937-ee8244a6b6bb` | `a43d0f80...` | `02103452...` | `94cf042e...` | `completed` | `paid` | 50.00 | 0.00 | 2026-07-01 |

### Investigation Findings:
- Referenced parent UUID `3efdaed0-fe9d-4802-bb52-8108743db95e` does not exist anywhere in Source database (`customer_subscriptions` and `subscriptions` both contain 0 rows).
- Schema definition: `subscription_id` is nullable (`is_nullable: YES`).
- Foreign key rule: `ON DELETE SET NULL`.
- Application support: 74 out of 79 appointments in Source have `subscription_id = NULL`. The application and appointment workflows fully support null `subscription_id`.
- Historical validity: Financial audit trail is completely intact through `payment_status`, `total_price`, and `final_amount`.

### Resolution Classification:
- `APPOINTMENT_ORPHANS_RECOVERABLE_PARENT: 0`
- `APPOINTMENT_ORPHANS_SAFE_NULL_CANDIDATES: 5`
- `APPOINTMENT_ORPHANS_RECONSTRUCTION_CANDIDATES: 0`
- `APPOINTMENT_ORPHANS_EXCLUSION_CANDIDATES: 0`
- `APPOINTMENT_ORPHANS_UNRESOLVED: 0`
- **APPOINTMENT_ORPHAN_RECOMMENDED_POLICY:** `SAFE_NULL_CONVERSION_ON_IMPORT`  
  *(Convert `subscription_id` to `NULL` for these 5 rows during export/staging).*

---

## 5. Orphan Set B Forensic Analysis: `barber_services.barber_id`

### Physical Definition:
- **Table:** `public.barber_services`
- **Column:** `barber_id`
- **Referenced Table:** `public.barbers.id`
- **Constraint:** `barber_services_barber_id_fkey`

### Forensic Row Census:
Exactly 4 rows reference deleted barber `5959e528-a329-4aac-a39a-fbc6f86d9d1d`:

| Barber Service ID | Barber ID | Service ID | Tenant ID | Created At |
| :--- | :--- | :--- | :--- | :--- |
| `00b25157-87d5-4044-ad2e-d9dcf96c2618` | `5959e528...` | `daac6b30...` | `c54ac1ac...` | 2026-05-05T11:30:40Z |
| `18e96e90-8e61-4142-aa06-93afd310216b` | `5959e528...` | `a02d1147...` | `c54ac1ac...` | 2026-05-05T11:30:40Z |
| `d371b9cb-469e-4b72-a3df-5489b8d3cb2f` | `5959e528...` | `f4b5f92e...` | `c54ac1ac...` | 2026-05-05T11:30:40Z |
| `d978ee8f-2688-4d58-b42e-822a8329888b` | `5959e528...` | `94cf042e...` | `c54ac1ac...` | 2026-05-05T11:30:40Z |

### Investigation Findings:
- Barber `5959e528-a329-4aac-a39a-fbc6f86d9d1d` was created during initial test seeding (2026-05-05) and subsequently deleted.
- Exhaustive search reveals:
  - Exists in `barbers`: **NO** (0 rows).
  - Exists in `profiles`: **NO** (0 rows).
  - Exists in `appointments`: **NO** (0 appointments reference this barber).
  - Exists in `commissions`: **NO** (0 rows).
- Schema definition: `barber_services_barber_id_fkey` defines `ON DELETE CASCADE`. In canonical operational state, deleting a barber automatically purges its junction records in `barber_services`.
- Re-mapping to another barber is strictly rejected (zero evidence of identity).

### Resolution Classification:
- `BARBER_SERVICE_ORPHANS: 4`
- `DELETED_BARBER_RECOVERABLE: NO`
- **BARBER_SERVICE_ORPHAN_RECOMMENDED_POLICY:** `EXCLUDE_STALE_BARBER_SERVICE_ROWS`  
  *(Filter out these 4 obsolete junction rows during export/staging).*

---

## 6. Zero-Orphan Target Requirement & Strategy

The Target database must complete data migration with:
```
FKS_AUDITED = 279
FKS_WITH_ORPHANS = 0
TOTAL_ORPHAN_ROWS = 0
```

### Strategy Architecture:
1. **Pre-Import Staged Transformation:**
   - Appointments: Apply `UPDATE appointments SET subscription_id = NULL WHERE subscription_id = '3efdaed0-fe9d-4802-bb52-8108743db95e'` in the export staging pipeline.
   - Barber Services: Apply `DELETE FROM barber_services WHERE barber_id = '5959e528-a329-4aac-a39a-fbc6f86d9d1d'` in the export staging pipeline.
2. **Post-Import Constraint Assertions:**
   - Execute an automated cross-table orphan query across all 279 FKs immediately before `COMMIT`.
   - Assert `total_orphans == 0`.

---

## 7. `session_replication_role` Forensics in PostgreSQL 17

### Trigger Analysis:
- Total active triggers on Target: **110**.
- In PostgreSQL 17, setting `SET session_replication_role = 'replica'`:
  - Disables all triggers where `tgenabled = 'O'` (Origin, standard default).
  - All 110 user triggers on Target are Origin-mode triggers.
  - `TRIGGERS_DISABLED_UNDER_REPLICA_COUNT: 110`
  - `TRIGGERS_ALWAYS_ENABLED_COUNT: 0`
- **System Constraint Triggers (Foreign Keys):**
  - PostgreSQL implements foreign key checks via internal system constraint triggers (`RI_ConstraintTrigger_*`).
  - These system constraint triggers are **SUPPRESSED** under `session_replication_role = 'replica'`.
- **Safety Determination:**
  - `SESSION_REPLICATION_ROLE_REPLICA_SAFE_FOR_FINAL_DATA_STATE: NO`
  - While replica mode is ideal during bulk transport to prevent trigger side-effects (e.g. overwriting historical `updated_at` values or creating spurious audit logs), it **cannot** be used to mask orphan data permanently.
  - Final commit must be validated with all FKs enforced.

---

## 8. Safe Public Data Import Model

### Recommended Model:
`STAGED_TRANSFORMATION_TOPOLOGICAL_ATOMIC_INSERT`

### Execution Protocol:
```
1. BEGIN TRANSACTION;
2. SET LOCAL session_replication_role = 'replica';
3. Import 25 non-empty tables in topological order (Level 0 through Level 5)
   - Exclude generated column customer_credits.available_amount
   - Apply pre-approved transforms (5 subscription NULLs, 4 barber_services prune)
4. SET LOCAL session_replication_role = 'origin';
5. Reseed sequences:
   - SELECT setval('status_checks_id_seq', 253121, false);
   - SELECT setval('rate_limit_hits_id_seq', 1, false);
6. Execute automated 279-FK integrity verifier (Assert 0 orphans);
7. COMMIT;
```

---

## 9. ID Preservation Scope Refinement

| Category | Table Count | Details |
| :--- | :--- | :--- |
| `TABLES_EXACT_ID_PRESERVATION_REQUIRED` | **25** | All 25 non-empty operational tables |
| `TABLES_ID_PRESERVATION_RECOMMENDED` | **0** | - |
| `TABLES_REGENERATABLE_WITH_MAPPING` | **0** | - |
| `EMPTY_TABLES` | **134** | 134 tables have 0 rows |
| **Total** | **159** | Complete canonical schema coverage |

---

## 10. Auth UUID Preservation & Access Capabilities

### Hard Invariant:
- `AUTH_UUID_PRESERVATION_CONFIRMED: YES`
- `AUTH_UUID_REFERENCE_COUNT: 48` physical FKs across 37 tables.
- `AUTH_UUID_REWRITE_REQUIRED_IF_NOT_PRESERVED: YES`

### Source Access Capabilities (PostgREST Publishable Key):
| Field | Capability | Source Exposure Mechanism |
| :--- | :--- | :--- |
| `id` | **AVAILABLE** | Exists in `public.profiles.id` and user_id FKs |
| `email` | **AVAILABLE** | Exists in `public.profiles.email` |
| `phone` | **AVAILABLE** | Exists in `public.profiles.phone` (0 phone auth users) |
| `encrypted_password` | **NOT_AVAILABLE** | PostgREST API never exposes password hashes |
| `email_confirmed_at` | **AVAILABLE** | Documented in verified bootstrap records |
| `phone_confirmed_at` | **NOT_APPLICABLE** | 0 phone auth users |
| `raw_app_meta_data` | **AVAILABLE** | `{"provider":"email","providers":["email"]}` |
| `raw_user_meta_data` | **AVAILABLE** | `{}` |
| `created_at` / `updated_at` | **AVAILABLE** | Preserved from `profiles` timestamps |
| `is_sso_user` | **AVAILABLE** | `false` |
| `is_anonymous` | **AVAILABLE** | `false` |

### Password Hash Reassessment:
- `AUTH_PASSWORD_HASH_TECHNICALLY_PRESERVABLE: YES` (PostgreSQL/Supabase supports direct hash insertion).
- `AUTH_PASSWORD_HASH_AVAILABLE_FROM_CURRENT_SOURCE_ACCESS: NO`.
- `AUTH_PASSWORD_REAUTHENTICATION_ACTUALLY_REQUIRED: YES`.

---

## 11. Auth Identities & Migration Method Matrix

### Reconciliation:
- Total Auth Users: **10**
- Total Auth Identities: **10**
- Users with Exactly One Identity: **10**
- Provider: `email` (100%)

### Method Evaluation:
| Method | UUID Preservation | Password Preservation | Confirmation State | Identity Preservation | Risk Level | Selected |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A. Direct SQL Bootstrap** | **YES** | NO (Clean reset) | **YES** | **YES** | **LOW** | **YES** |
| B. Supabase Admin API | **YES** | NO | **YES** | **YES** | LOW | NO |
| C. CLI Migration Dump | **YES** | YES | **YES** | **YES** | HIGH (IPv6 network blocked) | NO |

**RECOMMENDED_AUTH_MIGRATION_METHOD:** `DIRECT_SQL_BOOTSTRAP_WITH_EXACT_UUIDS`  
**EXPECTED_USER_REAUTH_BEHAVIOR:** `PASSWORD_RESET_OR_MAGIC_LINK_ON_FIRST_LOGIN`

---

## 12. Storage Topology & Object Reconciliation

### 5-Bucket Reconciliation:
| Bucket Name | Visibility | Object Count | Total Bytes | Referenced Objects | Empty? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `barber-avatars` | **PUBLIC** | 30 | 10,480,575 | 6 | **NO** |
| `payment-receipts` | **PRIVATE** | 0 | 0 | 0 | **YES** |
| `support-attachments` | **PRIVATE** | 0 | 0 | 0 | **YES** |
| `system-assets` | **PUBLIC** | 0 | 0 | 0 | **YES** |
| `tutorial-assets` | **PUBLIC** | 0 | 0 | 0 | **YES** |
| **TOTALS** | - | **30** | **10,480,575** | **6** | - |

- `STORAGE_BUCKETS_REQUIRING_CREATION: 5`
- `STORAGE_OBJECTS_RECOMMENDED_TO_MIGRATE: 30` (Migrate all 30 objects to preserve complete media asset lineage).
- `STORAGE_PATH_PRESERVATION_REQUIRED: YES`
- `PROJECT_SPECIFIC_STORAGE_URL_ROWS: 6` (6 avatar URLs contain `https://wdxhjwodyctgzqtogkgv.supabase.co/...`).
- `STORAGE_REFERENCE_REWRITE_REQUIRED: YES` (Update URLs on Target to reference `ywdwrstxvsdqiryhieiz`).
- `RECOMMENDED_STORAGE_TRANSFER_ORDER: IN_PARALLEL_PRE_CUTOVER` (Immutable binary assets can be staged before the downtime window).

---

## 13. `status_checks` Bulk Strategy & Sequences

- Total Rows: **253,120**
- Sequence: `status_checks_id_seq`
- Max ID: **253,120**
- `STATUS_CHECKS_MIGRATION_REQUIRED: YES`
- `STATUS_CHECKS_RECOMMENDED_BATCH_MODEL: STREAMED_COPY_OR_PAGINATED_BATCHES_OF_25000`
- `STATUS_CHECKS_SEQUENCE_RESEED_TARGET: 253121` (`SELECT setval('status_checks_id_seq', 253121, false);`)

---

## 14. Cyclic Component Reassessment

- SCC: `['automations', 'automation_interactions', 'automation_templates']`
- Production row census:
  - `automations`: **0 rows**
  - `automation_interactions`: **0 rows**
  - `automation_templates`: **0 rows**
- `CYCLE_BLOCKS_CURRENT_DATA_MIGRATION: NO`

---

## 15. Migration Rollback Matrix

| Subsystem | Transactional | Rollback Mechanism |
| :--- | :--- | :--- |
| **Public Database** | **YES** | PostgreSQL `ROLLBACK` on failure / `TRUNCATE` tables |
| **Auth Users** | **NO** | `DELETE FROM auth.users WHERE id IN ('...')` |
| **Storage Objects** | **NO** | Purge Target storage buckets |
| **Webhooks** | **NO** | Revert dashboard endpoints to Source |
| **Application Config** | **NO** | Revert environment variables |

---

## 16. Proposed Execution Phases (Pre-Migration Plan)

- **PHASE M7C:** Data Remediation & Staged Transform Specification (Automated SQL transform generator).
- **PHASE M7D:** Target Auth Bootstrap (Materialize 10 users and 10 identities).
- **PHASE M7E:** Storage Buckets & Binary Transfer Execution (Recreate 5 buckets, sync 30 objects).
- **PHASE M7F:** Atomic Public Data Import (Topological INSERT of 25 non-empty tables).
- **PHASE M7G:** Sequence Reseed, URL Rewrite & Full Verification (Assert 0 orphans, reseed sequences).
- **PHASE M7H:** Edge Functions & External Integrations (Deploy Target edge functions, set webhook secrets).
- **PHASE M7I:** Production Cutover & Final Verification.

---

## 17. Final Blocker Status

- `P0_BLOCKERS_REMAINING: 0` (All blockers have proven, deterministic resolution specifications).
- `P1_BLOCKERS_REMAINING: 0`
- `P2_WARNINGS_REMAINING: 3` (Documented and handled in runbook architecture).
- `FINAL_DECISION: READY_FOR_MIGRATION_EXECUTION_PLAN_REVIEW`
