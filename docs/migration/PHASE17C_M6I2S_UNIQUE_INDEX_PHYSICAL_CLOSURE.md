# BARBEX — PHASE 17C.M6I.2S CLOSURE REPORT
## Unique Constraint / Index Physical Parity Closure
### Post-Retry #9 Local Forensic Remediation & Pre-Retry #10 Review Gate

**Document Version:** 1.0.0  
**Timestamp:** 2026-09-09T15:20:00Z  
**Source Project (Reference Only):** `wdxhjwodyctgzqtogkgv` (**STRICT ZERO CONTACT / ZERO MUTATION**)  
**Target Project:** `ywdwrstxvsdqiryhieiz` (**ZERO MUTATION / PRE-RETRY #10 GATE**)  
**Superseded Release:** `BARBEX-CANONICAL-20260909-a5373b05-r4`  
**Authorized New Release Candidate:** `BARBEX-CANONICAL-20260909-02b6e234`  

---

## 1. Executive Summary & Retry #9 Physical Facts

During Physical Target Materialization Retry #9 (Phase 17C.M6I.2R), the baseline DDL executed cleanly, but the in-transaction canonical verifier halted and triggered an immediate, clean fail-closed rollback.

### Physical Failure Diagnostics:
- **Failure Phase:** VERIFIER (Section 7: Unique Constraints)
- **Error SQLSTATE:** `P0001`
- **Error Message:** `CRITICAL_VERIFY_FAILURE: Unique constraint mismatch! Actual=57, Expected=58, Missing={client_auth::client_auth_phone_unique}, Unexpected=<NULL>`
- **Actual Objects Materialized Before Verifier:**
  - Tables: `159`
  - Base Table Columns: `2198`
  - Views: `2` (View Columns: `13`)
  - Sequences: `2`
  - Primary Keys: `159`
  - Unique Constraints: `57` (Expected: `58`)
  - Check Constraints: `59`
  - Exclusions: `0`
  - Foreign Keys: `279`
  - Indexes: `441` (Expected: `442`)
  - Triggers: `110`
  - Enums: `14` types / `75` values
  - RLS: `159` enabled / `0` force
  - Functions: `202` (169 Security Definer, 33 Non-Security Definer)
  - Policies: `394`

---

## 2. Source Physical Unique Truth

Parsing `docs/migration/source-truth/constraints_source_truth.csv` as authoritative semicolon-delimited CSV confirms:
- **Source Physical Unique Constraints Count:** `58`
- **Table `public.client_auth` Unique Constraints in Source:** Exactly `2`
  1. `client_auth_phone_key`: `UNIQUE (phone)` (deferrable: false, initially_deferred: false, validated: true)
  2. `client_auth_phone_unique`: `UNIQUE (phone)` (deferrable: false, initially_deferred: false, validated: true)

Both constraints physically exist in the Source PostgreSQL catalog (`pg_constraint`), each backed by its corresponding unique B-tree index in `pg_class`.

---

## 3. `client_auth` Physical Column Truth

Authoritative catalog `docs/migration/source-truth/columns_source_truth_exact_2211.csv` confirms `public.client_auth` contains exactly `6` columns:
1. `id` (`uuid`, `NOT NULL`, default: `gen_random_uuid()`)
2. `phone` (`text`, `NOT NULL`, collation: `pg_catalog.default`, ordinal: `2`)
3. `password_hash` (`text`, nullable: `true`, collation: `pg_catalog.default`, ordinal: `3`)
4. `customer_id` (`uuid`, nullable: `true`, ordinal: `4`)
5. `created_at` (`timestamptz`, `NOT NULL`, default: `now()`, ordinal: `5`)
6. `updated_at` (`timestamptz`, `NOT NULL`, default: `now()`, ordinal: `6`)

**Columns Covered by `client_auth_phone_unique`:** Single column `(phone)`.

---

## 4. Baseline Unique Census (Before vs After)

- **Baseline Unique Constraints Before (Retry #9 / `a5373b05`):** `57`
  - Missing: `client_auth_phone_unique`
  - Source-Only Uniques Before: `['client_auth_phone_unique']`
  - Baseline-Only Uniques Before: `[]`
  - Unique Definition Drift Before: `0`
- **Baseline Unique Constraints After (`02b6e234`):** `58`
  - Inline Constraints: `57`
  - Alter Table Constraints: `1` (`ALTER TABLE public.client_auth ADD CONSTRAINT client_auth_phone_unique UNIQUE (phone);` at line 1062)
  - Source-Only Uniques After: `0`
  - Baseline-Only Uniques After: `0`
  - Unique Nominal Drift After: `0`
  - Unique Definition Drift After: `0`

---

## 5. Root Cause Forensic Analysis

- **Classification:** `UNIQUE_ASSEMBLER_USED_HISTORICAL_STATE`
- **Forensic Provenance:** In historical migration `20260507110136_5ee91f31-e24b-4712-8b18-eb8d458e65fa.sql`, `client_auth` was defined with inline `phone TEXT NOT NULL UNIQUE`, which PostgreSQL automatically names `client_auth_phone_key`. Later in the lifecycle of the Source production database, a secondary physical constraint `client_auth_phone_unique` was added. When the baseline DDL was assembled, it used the historical table creation definition containing only `client_auth_phone_key`, omitting the lifecycle constraint `client_auth_phone_unique` present in the physical constraint catalog.

---

## 6. Supporting Index Relationship

- **Source Physical Indexes:** `442`
- **Materialized Indexes Before (Retry #9):** `441`
- **Source-Only Indexes Before:** `['client_auth_phone_unique']`
- **Supporting Index:**
  - **Name:** `client_auth_phone_unique`
  - **Definition:** `CREATE UNIQUE INDEX client_auth_phone_unique ON public.client_auth USING btree (phone)`
  - **Constraint-Backed:** `YES` (created automatically by PostgreSQL when the UNIQUE constraint is defined)
- **Shared Root Cause:** `UNIQUE_DRIFT_1_AND_INDEX_DRIFT_1_SHARE_SINGLE_ROOT_CAUSE = YES`
  - In PostgreSQL, creating a `UNIQUE` constraint automatically provisions the supporting unique index in `pg_class`. The omission of the constraint was the single point of failure that simultaneously caused the index count to drop from 442 to 441.

---

## 7. PostgreSQL Constraint Semantics Rule

- `client_auth_phone_unique` is created as a true `pg_constraint` `UNIQUE` object via:
  ```sql
  ALTER TABLE public.client_auth
      ADD CONSTRAINT client_auth_phone_unique UNIQUE (phone);
  ```
- It is **NOT** replaced with a standalone `CREATE UNIQUE INDEX`.
- Target materialization faithfully reproduces `pg_constraint` identity, constraint semantics, and the underlying supporting unique index.
- Duplicate standalone indexes introduced: `0`.

---

## 8. Catalog Parity & Cardinality Invariants

Permanent regression suite [test_constraint_index_cardinality_regression.mjs](file:///c:/Antigravity/Barbex/barbex/scratch/test_constraint_index_cardinality_regression.mjs) confirms:

| Catalog Dimension | Canonical Source Truth | Baseline After Remediation | Parity Status |
| :--- | :--- | :--- | :--- |
| **Base Tables** | 159 | 159 | **PASS** |
| **Base Table Columns** | 2198 | 2198 | **PASS** |
| **Views** | 2 | 2 | **PASS** |
| **View Columns** | 13 | 13 | **PASS** |
| **Sequences** | 2 | 2 | **PASS** |
| **Primary Keys** | 159 | 159 | **PASS** |
| **Unique Constraints** | 58 | 58 | **PASS** |
| **Check Constraints** | 59 | 59 | **PASS** |
| **Exclusion Constraints** | 0 | 0 | **PASS** |
| **Foreign Keys** | 279 | 279 | **PASS** |
| **Standalone Indexes** | 225 | 225 | **PASS** |
| **Total Materialized Indexes** | 442 | 442 | **PASS** |
| **Triggers** | 110 | 110 | **PASS** |
| **Enum Types / Values** | 14 / 75 | 14 / 75 | **PASS** |
| **RLS Enabled / Force** | 159 / 0 | 159 / 0 | **PASS** |
| **Functions (SecDef / Non-SecDef)** | 202 (169 / 33) | 202 (169 / 33) | **PASS** |
| **Policies** | 394 | 394 | **PASS** |

---

## 9. Preservation of Prior Verifier & Harness Closures

- **Verifier Assertions Weakened / Removed:** `0`
- **Verifier PG17 Catalog References:** Clean (`c.relrowsecurity`, `c.relforcerowsecurity`)
- **Verifier RAISE Format Strings:** Clean (escaped `100%%`, 0 argument mismatches)
- **Harness Separation:** Separate Baseline, Snapshot, Verifier, and Commit phases under single transaction block preserved.

---

## 10. Immutable Release Bundle Hashes

Release `BARBEX-CANONICAL-20260909-a5373b05-r4` is marked **SUPERSEDED**.  
The new frozen release candidate is deterministic:

| Component | Path | SHA256 |
| :--- | :--- | :--- |
| **Release ID** | — | `BARBEX-CANONICAL-20260909-02b6e234` |
| **Baseline SQL** | [`20260907_barbex_canonical_source_baseline.sql`](file:///c:/Antigravity/Barbex/barbex/supabase/baseline/20260907_barbex_canonical_source_baseline.sql) | `02b6e23486ab691f84895f4afc875d1a6e55359b1fd312b263cc179bdc8b3cc6` |
| **Verifier SQL** | [`verify_20260907_canonical_baseline.sql`](file:///c:/Antigravity/Barbex/barbex/supabase/baseline/verify_20260907_canonical_baseline.sql) | `aa7da09bed133135d03c3780858b5359a034a0c88d01ab54eec76b9ba0b2c781` |
| **Manifest JSON**| [`barbex_canonical_manifest.json`](file:///c:/Antigravity/Barbex/barbex/docs/migration/manifests/barbex_canonical_manifest.json) | `542ac204aeca59bd8452f8b3a8cf61b5ca6aedf5385179c12b449600f93b166b` |
| **Canonical Bundle SHA256** | `SHA256(canonicalInput)` | `d8a9cecd72016ffa62506bc70d0f1bc9c2ac7c0005e0cb09488b1d3e221f7abb` |

---

## 11. Quality Gates & Evidence Artifacts

- **`git diff --check`:** **PASS** (zero whitespace/formatting issues)
- **`tsc --noEmit`:** **PASS** (exit code 0)
- **`npm run build`:** **PASS** (client + SSR built cleanly in 53.72s)
- **Secret Scan:** **PASS** (zero tokens or secrets in workspace)
- **Source & Target Isolation:** **STRICT ZERO CONTACT / ZERO MUTATION** maintained.

### Machine-Readable Evidence Files:
1. [`docs/migration/evidence/phase17c_m6i2s_bundle_evidence.json`](file:///c:/Antigravity/Barbex/barbex/docs/migration/evidence/phase17c_m6i2s_bundle_evidence.json)
2. [`docs/migration/evidence/phase17c_m6i2s_client_auth_evidence.json`](file:///c:/Antigravity/Barbex/barbex/docs/migration/evidence/phase17c_m6i2s_client_auth_evidence.json)
3. [`docs/migration/evidence/phase17c_m6i2s_unique_catalog_evidence.json`](file:///c:/Antigravity/Barbex/barbex/docs/migration/evidence/phase17c_m6i2s_unique_catalog_evidence.json)
4. [`docs/migration/evidence/phase17c_m6i2s_index_catalog_evidence.json`](file:///c:/Antigravity/Barbex/barbex/docs/migration/evidence/phase17c_m6i2s_index_catalog_evidence.json)

---

## 12. Gate Verdict

**FINAL_DECISION: READY_FOR_PHYSICAL_RETRY_10_REVIEW**  
Execution halted per absolute safety instructions. No physical retry initiated.
