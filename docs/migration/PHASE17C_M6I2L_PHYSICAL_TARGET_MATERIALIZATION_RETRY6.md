# BARBEX — PHASE 17C.M6I.2L: PHYSICAL TARGET MATERIALIZATION RETRY #6 EVIDENCE REPORT
**Mode:** Controlled Physical Target Schema Materialization  
**Execution Timestamp:** 2026-09-09T09:35:00.336Z  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz`  
**Source Project Ref:** `wdxhjwodyctgzqtogkgv` (STRICTLY ZERO CONTACT / ZERO MUTATION)  
**Candidate Release:** `BARBEX-CANONICAL-20260908-ea7230e1`  
**Final Decision:** `MATERIALIZATION_FAILED_ROLLED_BACK`  

---

## 1. Release Freeze Gate (SHA256 Signatures)

All release artifacts were validated for exact cryptographic match before contacting the remote target database.

| Artifact | Path | Expected SHA256 | Actual SHA256 | Match |
| :--- | :--- | :--- | :--- | :--- |
| **Baseline** | `supabase/baseline/20260907_barbex_canonical_source_baseline.sql` | `ea7230e1c7241e632ee28c90e1e72a486b5e63c8efa38d8a9a59125500fb69cb` | `ea7230e1c7241e632ee28c90e1e72a486b5e63c8efa38d8a9a59125500fb69cb` | **YES** |
| **Verifier** | `supabase/baseline/verify_20260907_canonical_baseline.sql` | `ad8ce922c4f749d2dcfec83d3a1454dbcd0bf40dc6f67fc031395059322b9543` | `ad8ce922c4f749d2dcfec83d3a1454dbcd0bf40dc6f67fc031395059322b9543` | **YES** |
| **Manifest** | `docs/migration/manifests/barbex_canonical_manifest.json` | `719b6daac1a67be3e781fa837a0e97c2c2354817fa1bb72ae33a0b26bc3f68d9` | `719b6daac1a67be3e781fa837a0e97c2c2354817fa1bb72ae33a0b26bc3f68d9` | **YES** |

- `BASELINE_HASH_MATCH: YES`
- `VERIFIER_HASH_MATCH: YES`
- `MANIFEST_HASH_MATCH: YES`

---

## 2. Baseline Transaction Safety Gate

The authorized baseline was inspected for top-level transaction control keywords outside comments and string literals:

- `BASELINE_TOP_LEVEL_BEGIN_COUNT: 0`
- `BASELINE_TOP_LEVEL_COMMIT_COUNT: 0`
- `BASELINE_TOP_LEVEL_ROLLBACK_COUNT: 0`

Result: **PASS**.

---

## 3. Target Identity Gate

Target database identity was confirmed via authenticated Supabase management connection to project `ywdwrstxvsdqiryhieiz`:

- `TARGET_CONNECTION_OK: YES`
- `TARGET_IDENTITY_CONFIRMED: YES`
- `TARGET_CURRENT_DATABASE: postgres`
- `TARGET_CURRENT_USER: postgres`
- `SERVER_VERSION: PostgreSQL 17.6 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit`

---

## 4. Target Pristine Empty Pre-State Gate

Before opening the materialization transaction, Target was proven completely empty and pristine:

- `TARGET_PUBLIC_BASE_TABLES_BEFORE: 0`
- `TARGET_PUBLIC_VIEWS_BEFORE: 0`
- `TARGET_PUBLIC_MATERIALIZED_VIEWS_BEFORE: 0`
- `TARGET_PUBLIC_FUNCTIONS_BEFORE: 0`
- `TARGET_PUBLIC_POLICIES_BEFORE: 0`
- `TARGET_PUBLIC_ENUM_TYPES_BEFORE: 0`
- `TARGET_PUBLIC_ALL_RELATIONS_BEFORE: 0`
- `TARGET_AUTH_USERS_BEFORE: 0`
- `TARGET_STORAGE_BUCKETS_BEFORE: 0`
- `TARGET_STORAGE_OBJECTS_BEFORE: 0`
- `TARGET_CRON_JOBS_BEFORE: 0`
- `TARGET_MIGRATION_HISTORY_BEFORE: 0`

Evidence persisted to: `docs/migration/evidence/phase17c_m6i2l_pre_state.json`.  
Result: **TARGET_EMPTY_GATE: PASS**.

---

## 5. Transaction Execution & First Failure Analysis

An atomic external PostgreSQL transaction payload wrapping `BEGIN; <authorized_baseline> <authorized_verifier> <in_tx_assertions> COMMIT;` was delivered to Target project `ywdwrstxvsdqiryhieiz`.

- `TRANSACTION_STARTED: YES`
- `BASELINE_EXECUTION_STARTED: 2026-09-09T09:34:47.576Z`
- `EXECUTION_ELAPSED: 12.76s`
- `EXIT_CODE: 1`

### First SQL Error Details:
- `BASELINE_FIRST_ERROR_SQLSTATE: 42P01`
- `BASELINE_FIRST_ERROR_MESSAGE: unexpected status 400: {"message":"Failed to run sql query: ERROR:  42P01: relation \"rate_limit_hits_id_seq\" does not exist\nLINE 1934:     id BIGINT NOT NULL DEFAULT nextval('rate_limit_hits_id_seq'::regclass),\n                                                  ^\n"}`
- `BASELINE_FIRST_ERROR_LINE: 1934`
- `BASELINE_FIRST_ERROR_STATEMENT: CREATE TABLE IF NOT EXISTS public.rate_limit_hits ( id BIGINT NOT NULL DEFAULT nextval('rate_limit_hits_id_seq'::regclass), bucket TEXT NOT NULL, key TEXT NOT NULL, hit_at TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT rate_limit_hits_pkey PRIMARY KEY (id) );`

### Root Cause Analysis:
Table `public.rate_limit_hits` has column `id BIGINT NOT NULL DEFAULT nextval('rate_limit_hits_id_seq'::regclass)`. The sequence `rate_limit_hits_id_seq` was not created prior to line 1931 in the baseline DDL (missing `CREATE SEQUENCE IF NOT EXISTS public.rate_limit_hits_id_seq;`). Because the relation does not exist at parse time when resolving `'rate_limit_hits_id_seq'::regclass`, PostgreSQL raised `42P01`.

---

## 6. Fail-Closed Protocol & Post-Rollback Pristine Verification

Upon SQL execution failure:
1. External transaction automatically aborted and rolled back.
2. `COMMIT_EXECUTED: NO`
3. `ROLLBACK_EXECUTED: YES`
4. A fresh connection was opened to Target to inspect post-rollback database state.

### Post-Rollback State Audit:
- `TARGET_PUBLIC_BASE_TABLES_AFTER: 0`
- `TARGET_PUBLIC_VIEWS_AFTER: 0`
- `TARGET_PUBLIC_FUNCTIONS_AFTER: 0`
- `TARGET_PUBLIC_POLICIES_AFTER: 0`
- `TARGET_PUBLIC_ENUM_TYPES_AFTER: 0`
- `TARGET_AUTH_USERS_AFTER: 0`
- `TARGET_STORAGE_BUCKETS_AFTER: 0`
- `TARGET_STORAGE_OBJECTS_AFTER: 0`
- `TARGET_CRON_JOBS_AFTER: 0`
- `TARGET_MIGRATION_HISTORY_AFTER: 0`

Result:
- `ROLLBACK_CONFIRMED: YES`
- `TARGET_PRISTINE_AFTER_ROLLBACK: YES`

Evidence persisted to: `docs/migration/evidence/phase17c_m6i2l_post_state.json`.

---

## 7. Zero Mutation & Scope Compliance

- `SOURCE_CONTACTED: NO`
- `SOURCE_MUTATED: NO`
- `TARGET_CONTACTED: YES`
- `TARGET_MUTATED: NO` (all changes safely rolled back; database remains pristine)
- `AUTOMATIC_REMEDIATION_ATTEMPTED: NO`
- `RETRY_7_ATTEMPTED: NO`

---

## 8. Final Decision

`FINAL_DECISION: MATERIALIZATION_FAILED_ROLLED_BACK`
