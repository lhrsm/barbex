# =====================================================================
# BARBEX — PHASE 17C.M7A
# AUTH + BUSINESS DATA + STORAGE SOURCE INVENTORY
# POST-SCHEMA MATERIALIZATION / READ-ONLY FORENSIC DISCOVERY REPORT
# =====================================================================

**Release:** `BARBEX-CANONICAL-20260909-02b6e234`  
**Execution Timestamp:** 2026-09-09T16:09:00Z  
**Mode:** READ-ONLY FORENSIC INVENTORY ONLY  
**Source Project Ref:** `wdxhjwodyctgzqtogkgv` (READ-ONLY Contacted via HTTP PostgREST API)  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz` (READ-ONLY Contacted via PostgreSQL / Supabase CLI)  
**Safety Status:** Source Untouched (Zero Mutations) / Target Untouched (Zero Data Inserted)  

---

## 1. Executive Summary & Core Invariants

Phase 17C.M7A completes the read-only forensic discovery and physical migration inventory for Barbex migration from Source (`wdxhjwodyctgzqtogkgv`) to Target (`ywdwrstxvsdqiryhieiz`).

### Key Invariants Verified:
1. **Target Schema Integrity:** Target remains in committed canonical schema state `BARBEX-CANONICAL-20260909-02b6e234` (159 tables, 2,198 columns, 2 views, 2 sequences, 159 PKs, 58 unique constraints, 59 check constraints, 279 FKs, 442 physical indexes, 110 triggers, 14 enums [75 values], 159 RLS enabled, 202 functions, 394 policies).
2. **Pristine Target Data:** 0 auth.users, 0 storage buckets/objects, 0 cron jobs, 0 schema migrations.
3. **Auth Identity Preservation Required:** **YES**. 37 business tables and 48 physical foreign keys directly reference `auth.users(id)`. All 10 existing Source `auth.users` UUIDs must be preserved verbatim.
4. **Source Table Census:** Exactly 159 tables audited. 25 non-empty tables containing 253,813 rows (dominated by `status_checks` with 253,120 rows). 134 tables are currently empty.
5. **Foreign Key Integrity:** 279 FKs audited. 277 FKs have 100% integrity (0 orphans). Exactly 2 FKs contain orphan rows (total 9 orphan rows):
   - `appointments_subscription_id_fkey`: 5 rows reference non-existent `customer_subscriptions(id)`.
   - `barber_services_barber_id_fkey`: 4 rows reference a deleted barber ID.
6. **Unique & Check Constraints:** 100% compatible. 58 unique constraints have 0 duplicate conflicts. 59 check constraints have 0 conflicts. `client_auth` is empty (0 rows), satisfying the canonical uniqueness constraint.
7. **Storage Inventory:** 5 buckets defined. Exactly 1 bucket (`barber-avatars`) contains objects (30 objects, 10,480,575 bytes ~9.99 MB). The other 4 buckets are empty.
8. **Stored Generated Column:** Exactly 1 stored generated column exists in the database: `public.customer_credits.available_amount` (`(amount - used_amount)`). Rule: MUST be excluded from INSERT statements during data import.

---

## 2. Target State Verification (Read-Only)

Target project `ywdwrstxvsdqiryhieiz` was queried via read-only catalog introspection:

| Metric | Target Physical State | Canonical Expected | Status |
| :--- | :--- | :--- | :--- |
| Schema Release | `BARBEX-CANONICAL-20260909-02b6e234` | `BARBEX-CANONICAL-20260909-02b6e234` | **VALID** |
| Base Tables | 159 | 159 | **MATCH** |
| Base Columns | 2,198 | 2,198 | **MATCH** |
| Primary Keys | 159 | 159 | **MATCH** |
| Foreign Keys | 279 | 279 | **MATCH** |
| Unique Constraints | 58 | 58 | **MATCH** |
| Check Constraints | 59 | 59 | **MATCH** |
| Indexes | 442 | 442 | **MATCH** |
| Triggers | 110 | 110 | **MATCH** |
| Functions | 202 | 202 | **MATCH** |
| RLS Enabled Tables | 159 | 159 | **MATCH** |
| Policies | 394 | 394 | **MATCH** |
| `auth.users` | 0 | 0 | **PRISTINE** |
| `storage.buckets` | 0 | 0 | **PRISTINE** |
| `storage.objects` | 0 | 0 | **PRISTINE** |
| `cron.job` | 0 | 0 | **PRISTINE** |
| `schema_migrations` | 0 | 0 | **PRISTINE** |

**TARGET_SCHEMA_RELEASE_STATE_VALID: YES**

---

## 3. Source Auth Inventory (Read-Only)

Source `auth.users` contains exactly 10 users:

- **SOURCE_AUTH_USERS_TOTAL:** 10
- **SOURCE_AUTH_EMAIL_USERS:** 10
- **SOURCE_AUTH_PHONE_USERS:** 0
- **SOURCE_AUTH_ANONYMOUS_USERS:** 0
- **SOURCE_AUTH_CONFIRMED_EMAIL_USERS:** 10
- **SOURCE_AUTH_CONFIRMED_PHONE_USERS:** 0
- **SOURCE_AUTH_BANNED_USERS:** 0
- **SOURCE_AUTH_DELETED_USERS:** 0

### Real Source Auth UUIDs:
1. `292134e7-4b98-49ee-84c6-b8b546ec57de` (SaaS Admin, role: client)
2. `7b5c3640-2e10-4788-83a7-5e6d8e0d9978` (Barber Shop Carlos, role: tenant_admin)
3. `ab0fb7c1-b7c9-40ef-be97-14348e88ae65` (Barbearia do Louis, role: barber)
4. `67d4e85a-3ed5-4109-9c9b-b83622331286` (Carlos Barber, role: tenant_admin)
5. `703dcd8f-0077-4a57-8728-be05f654bd5b` (Carlos Barber Shop, role: tenant_admin)
6. `2af47416-1c7a-4222-bb30-757eb4318377` (role: client)
7. `997746ee-723f-40e4-a6c6-5359eddd2a98` (Minha Barbearia, role: client)
8. `c54ac1ac-49be-4505-b7a4-d257ed023f08` (Barbearia LM, role: admin)
9. `69e0910b-a3f1-4be0-8a37-4f37c544bf6c` (role: reception)
10. `0cd900ec-d14a-4647-8229-1387c73c578f` (role: reception)

*(Sensitive credentials, tokens, OTP secrets, and password hashes were not exported or logged).*

---

## 4. Auth ID Preservation Analysis

- **AUTH_USER_ID_PRESERVATION_REQUIRED: YES**

### Evidence:
- **37 public tables** possess physical foreign key constraints or logical UUID relations referencing `auth.users(id)`.
- **48 foreign key constraints** directly declare `REFERENCES auth.users(id)`.
- **Key Referencing Tables:**
  - `public.profiles.id` (10 rows): 100% 1-to-1 match with `auth.users.id`.
  - `public.barbers.user_id` (8 rows): references `auth.users.id`.
  - `public.customers.user_id` and `auth_user_id` (12 rows): references `auth.users.id`.
  - `public.appointments.user_id` (79 rows): references `auth.users.id`.
  - `public.notifications.user_id` (217 rows): references `auth.users.id`.
  - `public.barbershops.owner_id` (5 rows): references `auth.users.id`.
  - `public.products.user_id` (10 rows): references `auth.users.id`.
  - `public.services.user_id` (8 rows): references `auth.users.id`.
  - `public.tenant_memberships.user_id`: references `auth.users.id`.

When the 10 real Auth UUIDs are preserved, **AUTH FK ORPHAN COUNT = 0**.

---

## 5. Public Table Row Counts — Complete Census

- **SOURCE_PUBLIC_TABLES:** 159
- **SOURCE_PUBLIC_TOTAL_ROWS:** 253,813
- **SOURCE_EMPTY_TABLES:** 134
- **SOURCE_NONEMPTY_TABLES:** 25

### Complete List of Non-Empty Tables:
| Table Name | Row Count | Primary Key | Tenant Col | User Col | Size Classification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `status_checks` | 253,120 | `id` (bigint) | NO | NO | **LARGE** |
| `notifications` | 217 | `id` (uuid) | YES | YES | **SMALL** |
| `barbershop_modules` | 145 | `id` (uuid) | NO | NO | **SMALL** |
| `appointments` | 79 | `id` (uuid) | YES | YES | **SMALL** |
| `tutorials` | 58 | `id` (uuid) | NO | NO | **SMALL** |
| `barber_services` | 26 | `id` (uuid) | YES | YES | **SMALL** |
| `tutorial_categories` | 21 | `id` (uuid) | NO | NO | **SMALL** |
| `loyalty_campaign_templates` | 20 | `id` (uuid) | NO | NO | **SMALL** |
| `saas_addons` | 17 | `id` (uuid) | NO | NO | **SMALL** |
| `status_services` | 14 | `id` (uuid) | NO | NO | **SMALL** |
| `customers` | 12 | `id` (uuid) | YES | YES | **SMALL** |
| `products` | 10 | `id` (uuid) | YES | YES | **SMALL** |
| `profiles` | 10 | `id` (uuid) | YES | NO | **SMALL** |
| `subscription_plan_services` | 9 | `id` (uuid) | NO | NO | **SMALL** |
| `barbers` | 8 | `id` (uuid) | YES | YES | **SMALL** |
| `services` | 8 | `id` (uuid) | YES | YES | **SMALL** |
| `appointment_reviews` | 6 | `id` (uuid) | NO | NO | **SMALL** |
| `loyalty_settings` | 6 | `id` (uuid) | YES | NO | **SMALL** |
| `subprocessors` | 6 | `id` (uuid) | NO | NO | **SMALL** |
| `barbershops` | 5 | `id` (uuid) | NO | YES | **SMALL** |
| `loyalty_achievements` | 4 | `id` (uuid) | NO | NO | **SMALL** |
| `loyalty_levels` | 4 | `id` (uuid) | YES | NO | **SMALL** |
| `subscription_plans` | 4 | `id` (uuid) | NO | NO | **SMALL** |
| `plans` | 3 | `id` (uuid) | NO | NO | **SMALL** |
| `onboarding_settings` | 1 | `id` (uuid) | NO | NO | **SMALL** |

*(134 tables have 0 rows in production).*

---

## 6. Table Size & Migration Volume

### Thresholds:
- **SMALL:** < 1,000 rows
- **MEDIUM:** 1,000 - 10,000 rows
- **LARGE:** 10,000 - 100,000 rows
- **VERY_LARGE:** > 100,000 rows

`status_checks` (253,120 rows) is the only table in VERY_LARGE/LARGE category. All other 24 non-empty tables are SMALL (< 1,000 rows each). Total volume across all 24 operational tables is only **693 rows**.

---

## 7. Multi-Tenant Identity Analysis

- **MULTITENANT_DATA_MODEL_STATUS:** HYBRID_V1_V2 (Transition model)
- **Tables with `tenant_id`:** 111 tables
- **Tables with `user_id`:** 48 tables
- **Distinct Tenant IDs in Data:**
  - `c54ac1ac-49be-4505-b7a4-d257ed023f08` (Barbearia LM)
  - `703dcd8f-0077-4a57-8728-be05f654bd5b` (Carlos Barber Shop)
- **Data Distribution:**
  - `TENANT_ID_ROWS_TOTAL`: 367 rows populated with `tenant_id`.
  - `LEGACY_USER_ID_ROWS_TOTAL`: 5 rows populated with `user_id` and null `tenant_id` (`barbershops`).
  - `MIXED_OWNERSHIP_ROWS_TOTAL`: 348 rows populated with both `tenant_id` and `user_id` (`appointments`, `barber_services`, `barbers`, `customers`, `notifications`, `products`, `services`).
  - `TENANT_ORPHAN_ROWS`: 0 (all populated `tenant_id` values resolve to existing profiles).
  - `USER_ORPHAN_ROWS`: 0 (all populated `user_id` values resolve to the 10 auth users).

---

## 8. Foreign Key Data Integrity

- **FKS_AUDITED:** 279
- **FKS_WITH_ORPHANS:** 2
- **TOTAL_ORPHAN_ROWS:** 9

### Orphan Details:
1. `appointments_subscription_id_fkey`:
   - Table: `appointments`
   - Column: `subscription_id`
   - References: `customer_subscriptions(id)`
   - Orphan Rows: 5 rows contain `3efdaed0-fe9d-4802-bb52-8108743db95e`.
   - Resolution: `subscription_id` is nullable. During pre-import reconciliation or data migration, set `subscription_id = NULL` or insert the missing parent record in `customer_subscriptions`.
2. `barber_services_barber_id_fkey`:
   - Table: `barber_services`
   - Column: `barber_id`
   - References: `barbers(id)`
   - Orphan Rows: 4 rows contain `5959e528-a329-4aac-a39a-fbc6f86d9d1d`.
   - Resolution: Barber was deleted on Source. During import, omit these 4 stale association rows or re-assign them to a valid active barber.

---

## 9. FK Migration Dependency Graph

- **DATA_DEPENDENCY_LEVELS:** 8 (Levels 0 through 7)
- **SELF_REFERENTIAL_FKS:** 3 tables
  - `appointments` (`rescheduled_from_id` -> `appointments.id`)
  - `customer_subscriptions` (`parent_subscription_id` -> `customer_subscriptions.id`)
  - `profiles` (`tenant_id` -> `profiles.id`)
- **CYCLIC_COMPONENTS:** 1 strongly connected component
  - Component: `['automations', 'automation_interactions', 'automation_templates']`
  - Note: All 3 tables currently have **0 rows** in production.
- **Topological Level Ordering:**
  - **Level 0 (46 tables):** Base tables with no public FK dependencies (e.g. `plans`, `profiles`, `subprocessors`, `status_services`, `tutorial_categories`, `loyalty_settings`, `saas_addons`, etc.)
  - **Level 1 (39 tables):** Depends only on Level 0 (e.g. `barbershops`, `barbers`, `customers`, `services`, `status_checks`, `tutorials`, etc.)
  - **Level 2 (13 tables):** Depends on Level 0-1 (e.g. `barber_services`, `products`, `subscription_plans`, etc.)
  - **Level 3 (21 tables):** Depends on Level 0-2 (e.g. `appointments`, `subscription_plan_services`, etc.)
  - **Level 4 (11 tables):** Depends on Level 0-3 (e.g. `appointment_reviews`, `notifications`, etc.)
  - **Level 5 (21 tables):** Depends on Level 0-4
  - **Level 6 (7 tables):** Depends on Level 0-5
  - **Level 7 (1 table):** `tenant_memberships`

---

## 10. Primary Key & Identity Preservation

- **TABLES_REQUIRING_ID_PRESERVATION:** 159 (All tables must preserve primary keys)
- **SEQUENCE_BACKED_DATA_TABLES:** 2 (`status_checks`, `rate_limit_hits`)
- **POST_IMPORT_SEQUENCE_RESEED_REQUIRED:** YES
  - `SELECT setval('status_checks_id_seq', 253121, false);`
  - `SELECT setval('rate_limit_hits_id_seq', 1, false);`

---

## 11. Storage Inventory (Read-Only)

- **SOURCE_STORAGE_BUCKETS_TOTAL:** 5
- **SOURCE_STORAGE_OBJECTS_TOTAL:** 30
- **SOURCE_STORAGE_TOTAL_BYTES:** 10,480,575 bytes (~9.99 MB)

### Bucket Details:
| Bucket Name | Public | Object Count | Size (Bytes) | Content Type |
| :--- | :--- | :--- | :--- | :--- |
| `barber-avatars` | YES | 30 | 10,480,575 | `image/jpeg`, `image/png`, `image/webp` |
| `payment-receipts` | NO | 0 | 0 | - |
| `support-attachments` | NO | 0 | 0 | - |
| `system-assets` | YES | 0 | 0 | - |
| `tutorial-assets` | YES | 0 | 0 | - |

---

## 12. Storage Reference Analysis

- **TABLES_REFERENCING_STORAGE:** 13 tables (`barbers`, `barbershops`, `customers`, `profiles`, `products`, etc.)
- **REFERENCED_STORAGE_OBJECTS:** 6 active objects referenced in `barbers.avatar_url` and `profiles.avatar_url`.
- **UNREFERENCED_STORAGE_OBJECTS:** 24 objects (historical/unreferenced avatars in `barber-avatars`).
- **MISSING_STORAGE_REFERENCES:** 0 (All database avatar URLs that point to Supabase Storage exist in the storage manifest).

---

## 13. Auth / Public Profile Parity

- **AUTH_USERS_WITH_PROFILE:** 10
- **AUTH_USERS_WITHOUT_PROFILE:** 0
- **PROFILES_WITHOUT_AUTH_USER:** 0
- **TENANT_MEMBERSHIPS_WITHOUT_AUTH_USER:** 0
- **CLIENT_AUTH_WITHOUT_AUTH_USER_IF_APPLICABLE:** 0

There is a 100% 1-to-1 bijective mapping between `auth.users` and `public.profiles`.

---

## 14. Email / Phone Normalization Analysis

- **CLIENT_AUTH_ROWS:** 0
- **CLIENT_AUTH_DUPLICATE_PHONE_RAW:** 0
- **CLIENT_AUTH_DUPLICATE_PHONE_NORMALIZED:** 0
- **CLIENT_AUTH_NULL_PHONE:** 0
- **CLIENT_AUTH_EMPTY_PHONE:** 0

The canonical `client_auth_phone_unique` constraint (`UNIQUE (phone)`) on Target is completely unthreatened by Source data.

---

## 15. Unique Constraint Data Compatibility

- **UNIQUE_CONSTRAINTS_AUDITED:** 58
- **UNIQUE_CONSTRAINTS_WITH_DATA_CONFLICTS:** 0
- **UNIQUE_CONFLICT_ROWS_TOTAL:** 0

All 58 canonical unique constraints are 100% compatible with Source data.

---

## 16. Check Constraint Data Compatibility

- **CHECK_CONSTRAINTS_AUDITED:** 59
- **CHECK_CONSTRAINTS_WITH_DATA_CONFLICTS:** 0
- **CHECK_CONFLICT_ROWS_TOTAL:** 0

All 59 canonical check constraints evaluate successfully against Source data.

---

## 17. Enum Data Compatibility

- **ENUM_COLUMNS_AUDITED:** 14 enum types / 75 enum values
- **ENUM_INVALID_VALUES:** 0
- **ENUM_INVALID_ROWS:** 0

---

## 18. Generated Column Import Rules

- **GENERATED_COLUMNS_TOTAL:** 1
- **GENERATED_COLUMN_LIST:** `['public.customer_credits.available_amount']`
- **Definition:** `STORED (amount - used_amount)`
- **GENERATED_COLUMNS_EXCLUDED_FROM_INSERT:** **YES**

---

## 19. Sequence Data State

| Sequence | Owned Column | Source Max ID | Source Last Value | Required Post-Import `setval` |
| :--- | :--- | :--- | :--- | :--- |
| `status_checks_id_seq` | `public.status_checks.id` | 253,120 | 253,120 | `253121` |
| `rate_limit_hits_id_seq` | `public.rate_limit_hits.id` | 0 | 0 | `1` |

---

## 20. Triggers & Default Import Risk Analysis

- **Target Triggers:** 110 active triggers.
- **Risk Assessment:**
  - Automatic `updated_at` modification triggers could overwrite historical timestamps.
  - Notification and audit triggers could generate spurious duplicate events.
- **Remediation Strategy:** Execute bulk data import under privileged session:
  ```sql
  SET session_replication_role = 'replica';
  -- perform COPY / INSERT
  SET session_replication_role = 'origin';
  ```
  This safely bypasses trigger firing and foreign key constraints during bulk loading while preserving exact historical timestamps.

---

## 21. RLS Migration Execution Model

- **DATA_IMPORT_RLS_EXECUTION_MODEL:** Direct connection using privileged `postgres` role via `BARBEX_DB_URL` with `session_replication_role = 'replica'`.

---

## 22. Auth Migration Capability Matrix

| Auth Category | Migration Classification | Action Plan |
| :--- | :--- | :--- |
| User UUIDs | **PRESERVABLE** | Insert into `auth.users` with exact UUIDs |
| Emails | **PRESERVABLE** | Insert into `auth.users` and `auth.identities` |
| Email Confirmed State | **PRESERVABLE** | Set `email_confirmed_at = NOW()` |
| User / App Metadata | **PRESERVABLE** | Transfer `raw_app_meta_data` and `raw_user_meta_data` |
| Passwords / Hashes | **REQUIRES_REAUTHENTICATION** | Omit hashes; users authenticate via magic link or reset password |
| Sessions / Refresh Tokens | **NOT_MIGRATABLE** | Clean re-authentication on cutover |
| MFA Factors | **NOT_MIGRATABLE** | Re-enrollment (0 active MFA users on Source) |

---

## 23. Application Configuration Dependencies

- **Hardcoded References in `src/`:** 0. The application architecture cleanly reads `process.env.SUPABASE_URL`, `process.env.SUPABASE_SERVICE_ROLE_KEY`, `process.env.VITE_SUPABASE_URL`, and `process.env.VITE_SUPABASE_PUBLISHABLE_KEY`.
- **References in Migrations / Docs:** Several legacy migration files contain old project URL `https://wdxhjwodyctgzqtogkgv.supabase.co`. These do not affect production execution when environment variables are updated.

---

## 24. Migration Blocker Classification

### P0 Blockers (0):
*None*. All foundational constraints and data shapes are fully compatible.

### P1 Blockers (2):
1. **5 orphan rows in `appointments.subscription_id`:** References non-existent `customer_subscriptions(id)`. Must be set to `NULL` or have a stub parent record created before re-enabling FKs.
2. **4 orphan rows in `barber_services.barber_id`:** References deleted barber `5959e528-a329-4aac-a39a-fbc6f86d9d1d`. Must be pruned before re-enabling FKs.

### P2 Warnings (3):
1. **Stored Generated Column:** `customer_credits.available_amount` must be excluded from INSERT column lists.
2. **Sequence Reseed:** `status_checks_id_seq` must be set to `253121` immediately after data load.
3. **Cyclic FK Component:** `automations` <-> `automation_interactions` <-> `automation_templates` forms an SCC (currently empty).

---

## 25. Proposed Migration Phase Order

1. **PHASE 1: AUTH BOOTSTRAP** (Pre-seed 10 `auth.users` and `auth.identities` into Target).
2. **PHASE 2: STORAGE TRANSFER** (Transfer 30 files in `barber-avatars` to Target).
3. **PHASE 3: PUBLIC DATA IMPORT** (Single `BEGIN...COMMIT` transaction in Level 0 -> 7 topological order with `session_replication_role = 'replica'`).
4. **PHASE 4: SEQUENCE & ORPHAN RECONCILIATION** (Reseed sequences and resolve the 9 orphan rows).
5. **PHASE 5: VERIFICATION SUITE** (Catalog, row count, and policy assertions).
6. **PHASE 6: APPLICATION CUTOVER** (Environment variables update, DNS cutover, restart).

---

## 26. Final Decision & Gate Status

**FINAL_DECISION: READY_FOR_MIGRATION_STRATEGY_REVIEW**
