# BARBEX — PHASE 17C.M6I.2I-R: PHYSICAL SOURCE COLUMN TRUTH RECONCILIATION REPORT
**Execution Date**: 2026-09-08  
**Mode**: LOCAL FORENSIC RECONCILIATION ONLY  
**Source Production Ref**: `wdxhjwodyctgzqtogkgv`  
**Target Project Ref**: `ywdwrstxvsdqiryhieiz`  
**Authoritative Column Source**: `docs/migration/source-truth/columns_source_truth_2211.csv`  
**Failed Release**: `BARBEX-CANONICAL-20260908-d0037497` (SUPERSEDED_COLUMN_STATE_DEFECT)  
**New Canonical Release ID**: `BARBEX-CANONICAL-20260908-cf75c2f9`

---

## 1. Executive Summary & Root Cause Analysis
During physical target materialization Retry #4 (`execute_m6i2h_physical_retry4.mjs`), execution failed with:
```
ERROR: 42703: column "service_id" referenced in foreign key constraint does not exist
```
Target was automatically and atomically rolled back, remaining 100% pristine.

### Forensic Investigation
1. **Physical Source Truth**:
   The authoritative catalog export `columns_source_truth_2211.csv` directly from Source production contains 2,211 rows.
   - `public.appointment_reviews` has `service_id` at `ordinal_position = 20` (`uuid`, nullable).
   - Additional columns on `appointment_reviews`: `service_rating` (ordinal 21), `allow_public_display` (ordinal 22), `reply` (23), `reply_at` (24), `reply_by` (25), `rejected_at` (26), `rejected_by` (27), `reply_reminder_sent_at` (28).
   - `public.subscription_usage_logs` has `service_id` at `ordinal_position = 9` (`uuid`, nullable).
2. **Provenance**:
   These columns were introduced in migration `20260710110058_4591167c-2d91-43e8-b436-5f44722872ae.sql` via `ALTER TABLE public.appointment_reviews ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id)`.
3. **Assembler Defect**:
   The baseline generator `scratch/assemble_canonical_source_baseline.mjs` was using initial `CREATE TABLE` DDLs from early migrations/backups, rather than the physical current column state. Consequently, 519 physical source columns were missing from Section 03 DDL.

---

## 2. Full Physical Column Rebuild
The baseline assembler was refactored with the new authoritative architecture:
```
PHYSICAL SOURCE COLUMN CATALOG (2211 Columns)
                ↓
    159 Final Base Table Definitions (2198 Columns)
                ↓
    159 Primary Keys & 58 Unique Constraints
                ↓
    279 Foreign Keys (Two-Phase ALTER TABLE)
                ↓
    442 Indexes
                ↓
    202 Functions / RPCs
                ↓
    124 Triggers (110 Canonical Families)
                ↓
    159 RLS Enabled Tables
                ↓
    394 Row Level Security Policies
                ↓
    2 Views (13 Projected Columns)
```

---

## 3. Physical Catalog Metrics & Parity
- **Total Catalog Rows**: 2,211
- **Tabular Objects**: 161
- **Base Tables**: 159 (2,198 columns)
- **Views**: 2 (13 columns)
  - `barber_rating_stats`: 4 columns (`barber_id`, `tenant_id`, `avg_rating`, `total_ratings`)
  - `vw_automation_debug`: 9 columns (`appointment_id`, `status`, `created_at`, `start_time`, `confirmation_sent_at`, `confirmation_sent`, `customer_name`, `customer_phone`, `tenant_id`)
- **Duplicate Column Identities**: 0
- **Baseline Tables Before**: 159
- **Baseline Columns Before**: 1,704
- **Source-Only Columns Before**: 519
- **Baseline-Only Columns Before**: 25
- **Baseline Tables After**: 159
- **Baseline Columns After**: 2,198
- **Source-Only Columns After**: 0
- **Baseline-Only Columns After**: 0
- **Column Type Drift**: 0
- **Column Nullability Drift**: 0
- **Column Default Drift**: 0
- **Column Identity Drift**: 0
- **Column Generated Drift**: 0 (`customer_credits.available_amount GENERATED ALWAYS AS (amount - used_amount) STORED`)
- **Column Order Drift**: 0 (DDL ordered by physical `ordinal_position`)

---

## 4. Foreign Key & Object Closure Verification
- **Total Canonical FKs**: 279 (all two-phase `ALTER TABLE ADD CONSTRAINT`, 0 inline `REFERENCES`)
- **The Two Remediated Missing FK Source Columns**:
  1. `appointment_reviews_service_id_fkey` (`appointment_reviews.service_id` -> `services.id`): **RESOLVED**
  2. `subscription_usage_logs_service_id_fkey` (`subscription_usage_logs.service_id` -> `services.id`): **RESOLVED**
- **FK Source Columns Missing After**: 0
- **FK Target Columns Missing After**: 0
- **PK Column Closure**: 0 blockers (159 PKs)
- **UNIQUE Column Closure**: 0 blockers (58 unique constraints)
- **Index Reference Closure**: 0 blockers (442 indexes)
- **Policy Column Closure**: 0 blockers (394 policies)
- **Function Column Closure**: 0 blockers (202 functions)
- **Trigger Column Closure**: 0 blockers (124 triggers, 110 families)

---

## 5. Artifact Verification & Checkpoints
- `docs/migration/evidence/phase17c_m6i2ir_column_diff_before.json`: Generated
- `docs/migration/evidence/phase17c_m6i2ir_column_diff_after.json`: Generated (`source_only = 0`, `baseline_only = 0`, `nullability_drift = 0`, `order_drift = 0`)
- `docs/migration/manifests/barbex_canonical_manifest.json`: Updated with full nominal `table_columns` dictionary for all 159 tables
- `supabase/baseline/verify_20260907_canonical_baseline.sql`: Hardened with physical nominal column assertions failing closed if `appointment_reviews.service_id` is missing
- `scratch/test_column_reconciliation_regression.mjs`: Permanent regression test suite (36/36 checks passing)

---

## 6. Release Fingerprints
- **Old Release**: `BARBEX-CANONICAL-20260908-d0037497` (`SUPERSEDED_COLUMN_STATE_DEFECT`)
- **New Release ID**: `BARBEX-CANONICAL-20260908-cf75c2f9`
- **New Baseline SHA256**: `cf75c2f9fc42b8a4f8c40cb4231303a844d87a5dda54db94652c3c0e4ae55a46`
- **New Verify SHA256**: `0016594e683b1653d3360863e0231599f104c8539edab3e4b79ee9056edafc68`
- **New Manifest SHA256**: `50a1b9972a9219b494b1b8a6b9c77a83cb05b34be48eef627846cf2da827eee8`

---

## 7. Safety Contract Adherence
- Source `wdxhjwodyctgzqtogkgv`: **NOT CONTACTED / NOT MUTATED**
- Target `ywdwrstxvsdqiryhieiz`: **NOT CONTACTED / NOT MUTATED**
- Retry #5: **NOT RUN**
- Code Changes: **LOCAL FORENSIC RECONCILIATION ONLY (NO GIT COMMIT / NO GIT PUSH)**
