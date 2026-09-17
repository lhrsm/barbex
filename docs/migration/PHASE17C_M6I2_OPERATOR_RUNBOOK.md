# BARBEX — PHASE 17C.M6I.2 OPERATOR RUNBOOK FOR TARGET MATERIALIZATION
**TARGET PROJECT REF**: `ywdwrstxvsdqiryhieiz`  
**DATABASE HOST**: `db.ywdwrstxvsdqiryhieiz.supabase.co`  
**CANONICAL RELEASE ID**: `BARBEX-CANONICAL-20260908-c2af7c11`  
**BASELINE SHA256**: `293c4a1cf15ccd8d51349a169f80378d11ddb86110d34d04c39c9e05f9a3b699`  

---

## 1. PRE-EXECUTION SAFETY CHECKLIST

Before initiating materialization, the human operator MUST confirm:
1. [ ] Confirm Target project ref is `ywdwrstxvsdqiryhieiz` (NOT Source `wdxhjwodyctgzqtogkgv`).
2. [ ] Confirm Target database is 100% empty (0 public tables, 0 public views, 0 auth users).
3. [ ] Confirm SHA256 of `supabase/baseline/20260907_barbex_canonical_source_baseline.sql` matches:
   `293c4a1cf15ccd8d51349a169f80378d11ddb86110d34d04c39c9e05f9a3b699`.
4. [ ] Confirm operator accepts the residual risk of direct materialization into the empty target given that disposable execution was blocked by account quota.

---

## 2. STEP-BY-STEP EXECUTION RUNBOOK

### STEP 1: Execute Preflight Audit (READ-ONLY)
Run the preflight audit script against Target to prove empty slate and platform readiness:
```bash
# Using Supabase CLI db execute or psql with scoped environment variable
npx supabase db query --project-ref ywdwrstxvsdqiryhieiz -f docs/migration/sql/phase17c_m6i2_target_preflight.sql
```
**Expected Output**: `[PREFLIGHT PASS] Target public schema is clean for bootstrap.`

---

### STEP 2: Execute Checkpoint CP0 (READ-ONLY)
Verify zero application tables exist:
```sql
SELECT (count(*) = 0) AS passed FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
```
If `passed` is NOT true: **ABORT IMMEDIATELY**.

---

### STEP 3: Execute Canonical Baseline Bootstrap (TRANSACTIONAL)
Execute the frozen canonical baseline enclosed in `BEGIN; ... COMMIT;`:
```bash
# Note: Never execute using historical migrations. Execute the single canonical baseline.
npx supabase db query --project-ref ywdwrstxvsdqiryhieiz -f supabase/baseline/20260907_barbex_canonical_source_baseline.sql
```
**Failure Protocol**: If any statement fails with a SQLSTATE error, the transaction automatically rolls back. The database returns to its clean empty state. **DO NOT retry without investigating the exact line and error.**

---

### STEP 4: Run Intermediate Checkpoints CP1 to CP9 (READ-ONLY)
Execute the checkpoint verification pack:
```bash
npx supabase db query --project-ref ywdwrstxvsdqiryhieiz -f docs/migration/sql/phase17c_m6i2_checkpoints.sql
```
**Criteria for Advancement**: Every row CP1 through CP9 MUST output `passed = true`.

---

### STEP 5: Run Comprehensive Canonical Verifier Script (READ-ONLY)
Execute the official Barbex canonical validator:
```bash
npx supabase db query --project-ref ywdwrstxvsdqiryhieiz -f supabase/baseline/verify_20260907_canonical_baseline.sql
```
**Expected Result**:
- 159 base tables verified
- 2 views verified
- 14 enums / 75 values verified
- 159 PKs, 279 FKs, 442 indexes verified
- 159/159 tables with RLS enabled
- 394 policies verified
- 0 FORCE RLS verified
- Output ends with: `[PASS] 100% CANONICAL STRUCTURAL PARITY ACHIEVED.`

---

### STEP 6: Execute Post-Verification Catalog Proof (READ-ONLY)
Run the final catalog proof table:
```bash
npx supabase db query --project-ref ywdwrstxvsdqiryhieiz -f docs/migration/sql/phase17c_m6i2_postverify.sql
```
Record catalog counts for the completion report.

---

## 3. FAIL-CLOSED ABORT & ROLLBACK PROTOCOL

1. **Pre-commit Abort**: Any error during Step 3 automatically triggers `ROLLBACK`. Zero objects persist.
2. **Post-commit Verification Failure**: If Step 4 or Step 5 reveals unexpected drift or missing objects:
   - Mark Phase as `MATERIALIZATION_FAILED`.
   - Freeze all deployment operations.
   - Zero Edge Function deployments permitted.
   - Zero Auth migrations permitted.
   - Zero live traffic redirection permitted.
