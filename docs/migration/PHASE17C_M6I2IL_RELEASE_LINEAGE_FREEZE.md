# BARBEX — PHASE 17C.M6I.2I-L: RELEASE LINEAGE & HASH FREEZE RECONCILIATION REPORT
**Execution Date**: 2026-09-08  
**Mode**: LOCAL FORENSIC / READ-ONLY LINEAGE RECONCILIATION  
**Source Production Ref**: `wdxhjwodyctgzqtogkgv` (**100% UNTOUCHED / ZERO REMOTE CONTACT**)  
**Target Project Ref**: `ywdwrstxvsdqiryhieiz` (**100% PRISTINE EMPTY AFTER ATOMIC ROLLBACK**)  
**Current Candidate Release ID**: `BARBEX-CANONICAL-20260908-cf75c2f9`  
**Status**: `READY_FOR_PHYSICAL_RETRY_5`

---

## 1. Executive Summary & Objectives

Before authorizing Physical Target Materialization Retry #5, this forensic phase audited and reconciled two specific reporting inconsistencies identified across prior phase reports:

1. **Artifact Hash Discrepancy**: Clarified why the "OLD" verifier and manifest hashes reported in Phase 17C.M6I.2I-R differed from the hashes physically executed and validated in Retry #4.
2. **Column Count Discrepancy**: Clarified why the pre-rebuild baseline column count was reported as `1,726` in Phase 17C.M6I.2I and as `1,704` in Phase 17C.M6I.2I-R (exact delta of 22).

Zero remote databases were contacted or mutated. Zero modifications were made to baseline SQL, verifier SQL, manifest JSON, or the assembler.

---

## 2. Release Lineage & Hash Discrepancy Forensic Resolution

### A. Authoritative Retry #4 Execution Lineage (Release `BARBEX-CANONICAL-20260908-d0037497`)
The physical execution of Retry #4 was gated and validated against the following frozen SHA256 hashes:
- **BASELINE**: `d003749775ae9c8f51729914f7c6981b56f11469c9cc4587a8e723fe6368a783`
- **VERIFY**: `10e4c6b160014e14494d9b03a3982253094b86688975748e9a0f324acaa235a4`
- **MANIFEST**: `602d9a03d5ced3d4c3baca666f2f38491979a14798bc27684cd2f859e1bc0852`

These exact hashes are permanently evidenced in:
1. `docs/migration/evidence/phase17c_m6i2h_pre_state.json` (lines 33–35)
2. `docs/migration/PHASE17C_M6I2H_PHYSICAL_RETRY4_RESULT.md` (lines 17–19)
3. `docs/migration/PHASE17C_M6I2GS_SOURCE_POLICY_RECONCILIATION.md` (lines 170–172)
4. `scratch/execute_m6i2h_physical_retry4.mjs` (lines 127–129)

### B. Root Cause of M6I.2I-R "OLD" Hash Values
Phase 17C.M6I.2I-R reported:
- `OLD_BASELINE_SHA256`: `d003749775ae9c8f51729914f7c6981b56f11469c9cc4587a8e723fe6368a783` (**EXACT MATCH**)
- `OLD_VERIFY_SHA256`: `10e4c6b160b86a3d93bfbe03f0b2f568a9947f6ff4ecb74d6c4e09fbaebfc3ee` (**DISCREPANCY**)
- `OLD_MANIFEST_SHA256`: `e8eb19dbe8021d7b055375fc87498c1a166cb0e9ba835f8992a549d3d9a5b672` (**DISCREPANCY**)

**Forensic Findings**:
1. Notice that `OLD_VERIFY_SHA256` begins with the exact prefix `10e4c6b160`. The probability of two independent files sharing a 10-character hexadecimal SHA256 prefix is $16^{-10} \approx 1 \text{ in } 1.099 \text{ trillion}$.
2. In the conversational transcript and context compaction for User Request 3 (Retry #4 mandate), the verify hash string was truncated at `10e4c6b160` due to context window token clipping (`EXPECTED VERIFY SHA256: 10e4c6b160 <truncated 26514 bytes>`).
3. `scratch/compute_new_hashes.mjs` only computed the *new* candidate hashes and did not query or output old verify/manifest hashes.
4. During formal return compilation for Phase 17C.M6I.2I-R, the reporting agent recalled the `10e4c6b160` prefix from context and hallucinated the remaining hex characters (`b86a3d93bfbe03f0b2f568a9947f6ff4ecb74d6c4e09fbaebfc3ee`), along with the manifest hash (`e8eb19dbe8021d7b055375fc87498c1a166cb0e9ba835f8992a549d3d9a5b672`), rather than reading the physical pre-state evidence file.
5. **Conclusion**: The discrepancy was entirely a reporting/hallucination artifact in the markdown response of Phase 17C.M6I.2I-R. The physical repository artifacts never had those hash bytes.

---

## 3. Complete Artifact Transition Matrix

| Artifact | Retry #4 Executed (Frozen) | M6I.2I-R Input (Physical Disk) | M6I.2I-R Output (Current Candidate) | Transition Status | Reason & Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Baseline SQL** | `d0037497...` | `d0037497...` | `cf75c2f9...` | **CHANGED** | Section 03 rebuilt from physical column catalog (2,198 base table columns). Eliminates `SQLSTATE 42703`. |
| **Verifier SQL** | `10e4c6b160014e...` | `10e4c6b160014e...` | `0016594e...` | **CHANGED** | Hardened with nominal column checks for `appointment_reviews.service_id`, `service_rating`, etc. |
| **Manifest JSON** | `602d9a03...` | `602d9a03...` | `50a1b997...` | **CHANGED** | Ingested full 2,198-column dictionary for all 159 base tables. |

**Unexplained Artifact Transitions**: **0**

---

## 4. Column Count Discrepancy Forensic Resolution (1726 vs 1704)

### A. The Discrepancy
- Phase 17C.M6I.2I reported: `BASELINE_BASE_TABLE_COLUMNS_BEFORE = 1726`
- Phase 17C.M6I.2I-R reported: `BASELINE_BASE_TABLE_COLUMNS_BEFORE = 1704`
- Exact Delta: **22 columns**

### B. Investigation of Counting Methods
1. **Method A (`verify_columns_count.mjs` / Line-Based Counter)**:
   - Method A split each `CREATE TABLE` body by `\n` and counted non-empty lines that did not begin with `CONSTRAINT`, `PRIMARY KEY`, `UNIQUE`, `CHECK`, or `FOREIGN KEY`.
   - In the pre-rebuild baseline, multiple tables contained multi-line constraints. For example:
     - `automation_interactions`: The `action_type_check` constraint spanned 8 lines (`action_type IN ('confirm_appointment', ...)`). The 7 continuation lines did not start with `CONSTRAINT` and were erroneously tallied as 7 extra columns.
     - `automation_interaction_events`: The multi-line `event_type_check` contributed 2 extra lines.
     - `tenant_addons`, `notifications`, `appointment_checkins`, `academy_lessons`, and `status_checks` similarly contained multi-line constraint continuation lines and comments.
   - When evaluated against the pre-rebuild baseline, Method A produced **1,726**.
2. **Method B (`analyze_column_diff_before.mjs` / Regex Column Matcher)**:
   - Method B parsed column definitions using identifier matching (`/^"?([a-zA-Z0-9_]+)"?\s+([\s\S]+)$/`) and mapped them into a deduplicated column dictionary (`public.<table_name>.<column_name>`).
   - Continuation lines of `CHECK` clauses (which contain values like `'talk_to_shop'`, `'cancel_appointment'`) do not match column identifier definitions and were properly ignored.
   - When evaluated against the exact same pre-rebuild baseline bytes, Method B produced **1,704**.
3. **Canonical Raw DDL Count**:
   - The true physical number of distinct column definitions in Section 03 of the `d0037497` baseline was **1,704**.
   - The figure of 1,726 was an overcount artifact of 22 continuation lines produced by Method A.

---

## 5. Candidate Release Verification & Frozen Hashes

Direct byte verification of current repository files:

- **Baseline SQL** (`supabase/baseline/20260907_barbex_canonical_source_baseline.sql`):
  `cf75c2f9fc42b8a4f8c40cb4231303a844d87a5dda54db94652c3c0e4ae55a46`
- **Verifier SQL** (`supabase/baseline/verify_20260907_canonical_baseline.sql`):
  `0016594e683b1653d3360863e0231599f104c8539edab3e4b79ee9056edafc68`
- **Manifest JSON** (`docs/migration/manifests/barbex_canonical_manifest.json`):
  `50a1b9972a9219b494b1b8a6b9c77a83cb05b34be48eef627846cf2da827eee8`

All current bytes match the candidate freeze specifications with **100% bitwise parity**.

**Release Identifier**:
`first8(cf75c2f9fc42b8a4f8c40cb4231303a844d87a5dda54db94652c3c0e4ae55a46) = cf75c2f9`  
**Candidate Release**: `BARBEX-CANONICAL-20260908-cf75c2f9`

---

## 6. Current Structural & Safety Invariants

- **Tabular Objects**: 161 (159 Base Tables, 2 Views)
- **Base Table Columns**: 2,198 (100% parity with Source catalog)
- **View Columns**: 13 (4 for `barber_rating_stats`, 9 for `vw_automation_debug`)
- **Total Exported Columns**: 2,211 (100% parity with Source catalog)
- **Column Drift**: 0 (0 Type drift, 0 Nullability drift, 0 Default drift, 0 Identity drift, 0 Generated drift, 0 Order drift)
- **Foreign Keys**: 279 (all two-phase `ALTER TABLE ADD CONSTRAINT`, 0 inline FKs)
  - `appointment_reviews.service_id`: **PRESENT & RESOLVED**
  - `appointment_reviews.service_rating`: **PRESENT**
  - `appointment_reviews.allow_public_display`: **PRESENT**
  - `subscription_usage_logs.service_id`: **PRESENT & RESOLVED**
- **Functions / RPCs**: 202 (170 PL/pgSQL, 32 SQL, 169 SECURITY DEFINER; 100% Source parity)
- **RLS Policies**: 394 (138 SELECT, 62 INSERT, 43 UPDATE, 32 DELETE, 119 ALL; 100% Source parity)
- **Triggers**: 124 DROP / 124 CREATE matched pairs (110 canonical families)
- **Enums**: 14 (75 distinct enum values)
- **Primary Keys**: 159
- **Indexes**: 442
- **RLS Enabled Tables**: 159

---

## 7. Quality & Security Gates

1. `git diff --check`: **PASS** (zero whitespace issues, zero merge markers)
2. `cmd.exe /c npx tsc --noEmit`: **PASS** (exit code 0, zero compilation errors)
3. `cmd.exe /c npm run build`: **PASS** (exit code 0, client and SSR artifacts built cleanly)
4. `scratch/security_scan.mjs`: **PASS** (zero secrets/tokens leaked in migration/backup artifacts)
5. `scratch/test_column_reconciliation_regression.mjs`: **PASS** (36/36 checks passing)
6. `scratch/test_policy_reconciliation_regression.mjs`: **PASS** (17/17 checks passing)
7. `scratch/verify_dollar_quotes.mjs`: **PASS** (all dollar quotes balanced)
8. `scratch/static_sql_lexical_sanity.mjs`: **PASS** (zero lexical errors)

---

## 8. Final Recommendation & Absolute End Rule

- **Final Decision**: `READY_FOR_PHYSICAL_RETRY_5`
- **Execution State**: **STOPPED LOCALLY**.
- Neither Target (`ywdwrstxvsdqiryhieiz`) nor Source (`wdxhjwodyctgzqtogkgv`) was contacted or mutated.
- Retry #5 has **NOT** been run.
- No commit or push has been performed.
