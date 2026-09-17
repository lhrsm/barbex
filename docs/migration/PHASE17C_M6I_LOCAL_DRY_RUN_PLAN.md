# BARBEX — PHASE 17C.M6I: LOCAL THROWAWAY DRY-RUN PLAN
**MODE**: DRY-RUN EXECUTION SPECIFICATION (FUTURE PHASE)  
**ENVIRONMENT**: DISPOSABLE LOCAL SUPABASE / POSTGRES DOCKER CONTAINER  
**CRITICAL DIRECTIVE**: DO NOT EXECUTE AGAINST SOURCE OR TARGET SUPABASE.  

---

## 1. PURPOSE

The local throwaway dry-run validates the execution fidelity and idempotency of the completed canonical baseline `supabase/baseline/20260907_barbex_canonical_source_baseline.sql` and verification script `supabase/baseline/verify_20260907_canonical_baseline.sql` in an isolated, throwaway PostgreSQL instance before touching any remote infrastructure.

---

## 2. PRE-CONDITIONS & ISOLATION BOUNDARIES

1. **Strictly Forbidden**:
   - Zero connections to Source `wdxhjwodyctgzqtogkgv`.
   - Zero connections to Target `ywdwrstxvsdqiryhieiz`.
   - Zero mutations to `https://barbex.shop`.
   - Zero Edge Function deployments.
   - Zero remote secret updates.
2. **Execution Environment**:
   - Local Docker-based PostgreSQL (via `supabase start` or local container on port 54322).
   - Fresh, completely empty database.

---

## 3. DRY-RUN EXECUTION WORKFLOW

### Step 1: Initialize Disposable Environment
```bash
# Start clean local Supabase container (isolated from cloud)
npx supabase start
```

### Step 2: First Execution (Clean Bootstrap)
Execute the complete baseline:
```bash
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/baseline/20260907_barbex_canonical_source_baseline.sql
```
**Success Criteria**:
- Exit code 0.
- Zero fatal syntax errors or unresolved forward reference errors.

### Step 3: Run Canonical Verification Script
Execute the read-only validator:
```bash
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/baseline/verify_20260907_canonical_baseline.sql
```
**Success Criteria**:
- Exact 159 tables reported.
- Exact 2 views reported.
- 159/159 tables with RLS enabled.
- 14 ENUMs verified.
- Zero missing tables, zero unexpected tables.

### Step 4: Second Execution (Idempotency Test)
Re-execute the exact same baseline script against the populated local database:
```bash
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/baseline/20260907_barbex_canonical_source_baseline.sql
```
**Success Criteria**:
- Exit code 0.
- Safe execution without "relation already exists" fatal halts.

### Step 5: Verify Zero Data & Inactive Crons
Validate with SQL:
```sql
SELECT count(*) FROM auth.users;          -- Must be 0
SELECT count(*) FROM public.customers;    -- Must be 0
SELECT count(*) FROM public.appointments; -- Must be 0
SELECT count(*) FROM cron.job WHERE active = true; -- Must be 0
```

### Step 6: Environment Tear-Down (Disposal)
```bash
npx supabase stop --no-backup
```

---

## 4. GATE CONDITIONS FOR PROCEEDING TO CLOUD CUTOVER
Only upon 100% PASS of all 6 steps in the local dry-run may the project consider scheduling the Target remote application.
