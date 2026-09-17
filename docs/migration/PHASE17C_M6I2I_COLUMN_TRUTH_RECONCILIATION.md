# BARBEX — PHASE 17C.M6I.2I: PHYSICAL SOURCE COLUMN TRUTH RECONCILIATION REPORT
**MODE**: LOCAL FORENSIC RECONCILIATION ONLY  
**DATE**: 2026-09-08  
**AUTHORIZED TARGET REF**: `ywdwrstxvsdqiryhieiz`  
**SOURCE PRODUCTION REF**: `wdxhjwodyctgzqtogkgv` (**100% UNTOUCHED / ZERO REMOTE CONTACT**)  
**FAILED RETRY**: PHASE 17C.M6I.2H — RETRY #4  
**FAILED CANDIDATE RELEASE ID**: `BARBEX-CANONICAL-20260908-d0037497`  
**FINAL DECISION**: `PHYSICAL_COLUMN_EVIDENCE_MISSING`  

---

## 1. EXECUTIVE FORENSIC SUMMARY

In Phase 17C.M6I.2H (Physical Materialization Retry #4), transactional execution aborted at Section 06 (Foreign Keys), line 2510 of `supabase/baseline/20260907_barbex_canonical_source_baseline.sql`, with:
- **SQLSTATE**: `42703` (`undefined_column`)
- **Error**: `column "service_id" referenced in foreign key constraint does not exist`
- **Object**: `public.appointment_reviews`
- **Constraint**: `appointment_reviews_service_id_fkey`

The transaction failed closed immediately and executed an automatic `ROLLBACK`. Target `ywdwrstxvsdqiryhieiz` was physically verified to have returned to a 100% pristine empty slate (**0 public tables, 0 views, 0 functions, 0 policies, 0 auth users, 0 storage objects**), as documented in `docs/migration/evidence/phase17c_m6i2h_post_state.json`.

---

## 2. ROOT CAUSE OF RETRY #4 FAILURE

1. **Table Assembler Lifecycle Defect**:
   - In `scratch/assemble_canonical_source_baseline.mjs`, Section 03 base table DDL generation extracted only the initial `CREATE TABLE` statement encountered for each table from migration history.
   - For `public.appointment_reviews`, the assembler captured the initial definition from migration `20260618213608_04074f96-18b3-4f8e-8c5d-931b264b0c7a.sql` (13 columns), completely ignoring subsequent schema evolutions.
   - Migration `20260710110058_4591167c-2d91-43e8-b436-5f44722872ae.sql` added:
     ```sql
     ALTER TABLE public.appointment_reviews
       ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS service_rating integer,
       ADD COLUMN IF NOT EXISTS allow_public_display boolean NOT NULL DEFAULT false,
       ADD COLUMN IF NOT EXISTS reply text,
       ADD COLUMN IF NOT EXISTS reply_at timestamptz,
       ADD COLUMN IF NOT EXISTS reply_by uuid,
       ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
       ADD COLUMN IF NOT EXISTS rejected_by uuid;
     ```
2. **Column Population Disparity**:
   - Section 03 of the current baseline contains only **1,726 table columns** across the 159 base tables.
   - Known production truth across the 161 public tabular objects (159 base tables + 2 views) is **2,211 columns**.
   - This proves that the defect is not isolated to `appointment_reviews.service_id`, but represents a systemic omission of post-creation `ADD COLUMN` migrations across base tables.

---

## 3. PHYSICAL COLUMN EVIDENCE AUDIT (SECTION 2 MANDATE)

Per Section 2 of Phase 17C.M6I.2I:
> Locate the existing physical Source column export used in the previous forensic inventory.  
> The previously supplied physical column catalog contained 2211 rows across 161 public objects.  
> Prefer an existing immutable local Source-truth artifact under: `docs/migration/source-truth/`  
> If the physical column export has not yet been copied into that folder, locate the local copy without contacting Source.  
> DO NOT reconstruct physical column truth from historical migrations.  
> DO NOT use the baseline itself as Source truth.  
> If no authoritative physical column export exists locally:  
> **STOP. Return: PHYSICAL_COLUMN_EVIDENCE_MISSING. Do not contact Source automatically.**

### Local Search Findings
1. `docs/migration/source-truth/` currently contains only:
   - `functions_source_truth_202.csv` (Authoritative Source Functions Catalog: 202 functions)
   - `policies_source_truth_394.csv` (Authoritative Source Policies Catalog: 394 policies)
2. Exhaustive local filesystem search for column exports (e.g. `columns_source_truth_2211.csv`, `columns_2211.csv`, `information_schema.columns` dumps) across the repository, `docs/`, `scratch/`, `backups/`, and user home directories confirmed that no physical Source column catalog file is present locally.
3. In accordance with the strict fail-closed contract, neither Source (`wdxhjwodyctgzqtogkgv`) nor Target (`ywdwrstxvsdqiryhieiz`) was contacted.
4. Without the physical Source column catalog, canonical table columns cannot be deterministically reconstructed with exact production data types, UDTs, ordinal positions, nullabilities, and defaults without violating the rule against inferring truth from historical migrations.

---

## 4. NEXT ACTION REQUIRED

The operator must supply the authoritative physical Source column catalog export (e.g., `docs/migration/source-truth/columns_source_truth_2211.csv`) containing the 2,211 column definitions exported from production `information_schema.columns` (or `pg_attribute`), analogous to `functions_source_truth_202.csv` and `policies_source_truth_394.csv`.

Once provided, the canonical baseline assembler will be updated to construct all 159 `CREATE TABLE` definitions directly from `PHYSICAL_SOURCE_CATALOG` truth, guaranteeing 100% nominal column parity and unblocking Foreign Key materialization.

---

## 5. QUALITY GATES SUMMARY

- `GIT_DIFF_CHECK`: **PASS**
- `TYPESCRIPT`: **PASS**
- `BUILD`: **PASS**
- `SECRET_SCAN`: **PASS**
- `TARGET_MUTATED`: **NO** (Preserved 100% pristine empty after rollback)
- `SOURCE_CONTACTED`: **NO**
- `SOURCE_MUTATED`: **NO**
