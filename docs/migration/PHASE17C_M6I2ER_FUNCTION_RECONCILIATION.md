# BARBEX — PHASE 17C.M6I.2E-R: FUNCTION INVENTORY RECONCILIATION REPORT
**MODE**: LOCAL FORENSIC / READ-ONLY REVIEW  
**DATE**: 2026-09-08  
**SOURCE PRODUCTION REF**: `wdxhjwodyctgzqtogkgv` (**100% UNTOUCHED / ZERO REMOTE CONTACT**)  
**TARGET REF**: `ywdwrstxvsdqiryhieiz` (**100% PRISTINE EMPTY AFTER CLEAN ROLLBACK**)  
**CANDIDATE RELEASE ID**: `BARBEX-CANONICAL-20260908-bde95634`  
**FINAL DECISION**: `SOURCE_FUNCTION_EVIDENCE_MISSING`  

---

## 1. OBJECTIVE & INVESTIGATION SUMMARY

This forensic review was commissioned to investigate the discrepancy between:
- **`FUNCTIONS_EXPECTED: 202`** (Production catalog metric from Phase 17C.M6I.1: 170 PL/pgSQL, 32 SQL)
- **`FUNCTION_DEFINITIONS_FOUND: 194`** (Reported by the static baseline scanner in Phase 17C.M6I.2E)

A full forensic analysis of the canonical baseline, the historical migration suite, the manifest generation scripts, and local evidence directories was conducted.

---

## 2. DISCOVERY & FORENSIC EXPLANATION OF 194 VS 202

### Finding 1: The Baseline Contains Exactly 194 Raw DDL Statements Representing 183 Unique Signatures
A complete lexical and AST scan of `supabase/baseline/20260907_barbex_canonical_source_baseline.sql` revealed:
- **Raw `CREATE [OR REPLACE] FUNCTION` statements**: **194**
- **Unique function names**: **173**
- **Unique identity signatures**: **183**
- **Duplicate identical statements**: **11** (statements defined twice at different line numbers due to multi-migration assembly concatenation):
  1. `update_appointment_status(uuid, text, text, uuid, text, jsonb)` (Lines 3293, 5864)
  2. `cancel_appointment(uuid, text, text, text, uuid)` (Lines 3368, 4078)
  3. `seed_default_workflows_v2()` (Lines 3600, 3733)
  4. `complete_appointment(uuid, text, uuid, text, jsonb)` (Lines 3932, 4738)
  5. `request_appointment_refund(uuid, uuid, uuid, numeric, text, text, text, text)` (Lines 4467, 5121)
  6. `get_or_create_automation(uuid, text, text)` (Lines 4880, 4935)
  7. `check_appointment_financial_status(uuid)` (Lines 5191, 5385)
  8. `handle_appointment_payment_update()` (Lines 5509, 11373)
  9. `recalculate_customer_stats(uuid, uuid)` (Lines 5638, 5801)
  10. `fn_get_financial_summary(uuid, date, date)` (Lines 6355, 6732)
  11. `fn_recalculate_customer_loyalty(uuid)` (Lines 6377, 6554)

### Finding 2: Missing Granular Source-Truth Catalog Export (`SOURCE_FUNCTION_EVIDENCE_MISSING`)
- In Phase 17C.M6I.1, direct physical inspection of production `wdxhjwodyctgzqtogkgv` returned `count(*) = 202` from `pg_proc` in `public` schema.
- However, while enum values (`1.csv` on Desktop) and views (`2.csv` on Desktop) were extracted into discrete source-truth CSV files, **zero granular catalog dump of `pg_proc` (e.g. `3.csv` or `source_functions.json`) was saved to `docs/migration/source-truth/` or local storage**.
- `docs/migration/source-truth/` remains completely empty.
- Under Section 2 mandatory rules: *"If source-truth evidence is unavailable locally: STOP. FINAL_DECISION = SOURCE_FUNCTION_EVIDENCE_MISSING"*.

### Finding 3: Root Cause of SQL Function Omission During Baseline Assembly
Historical analysis of `scratch/assemble_canonical_source_baseline.mjs` revealed why `20260907_barbex_canonical_source_baseline.sql` only contains **4 SQL functions** instead of the expected **32 SQL functions**:
```javascript
// From scratch/assemble_canonical_source_baseline.mjs line 105:
const fnRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*RETURNS\s+([^;\n]+)\s+(?:LANGUAGE\s+[a-zA-Z0-9_]+\s+|SECURITY\s+DEFINER\s+|SET\s+search_path\s*=\s*[^;\n]+\s+)*AS\s+(\$[a-zA-Z0-9_]*\$)[\s\S]*?\4\s*(?:LANGUAGE\s+[a-zA-Z0-9_]+\s*|SECURITY\s+DEFINER\s*|SET\s+search_path\s*=\s*[^;\n]+\s*)*;/gi;
```
- In historical migrations (e.g. `20260510121737_c1ffc196-fea4-4f9e-9798-02502dbb3e51.sql`), core RBAC functions were written with volatility decorators between `RETURNS` and `AS`:
  ```sql
  create or replace function public.has_role(_user_id uuid, _role public.app_role)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$ ... $$;
  ```
- The extractor regex did not account for `stable` or `immutable` placed before `AS`, causing it to silently skip `has_role`, `is_super_admin`, `is_super_admin_user`, `get_my_profile_role`, `is_profile_admin`, `get_my_tenant_id`, and other SQL functions during baseline compilation!
- This explains why policies reference `public.has_role(auth.uid(), 'super_admin'::app_role)`, yet `has_role` is omitted from baseline function DDL.

### Finding 4: Why Manifest Has 191 Functions
- The manifest generator script in step 1233 matched 191 functions because it used `CREATE OR REPLACE FUNCTION public\....` without case insensitivity and requiring the `public.` prefix.
- It missed 3 baseline functions:
  1. `decrement_product_stock` (omitted `public.` prefix)
  2. `has_active_subscription` (lowercase `create or replace function`)
  3. `sync_notification_read_status` (omitted `public.` prefix)
- 191 + 3 = 194 baseline functions.

---

## 3. CANONICAL BASELINE CURRENT FUNCTION BREAKDOWN

| Dimension | Baseline Actual | Expected Canonical Target | Status |
| :--- | :--- | :--- | :--- |
| **Raw Statements** | 194 | 202 | Deficit of 8 statements |
| **Unique Signatures** | 183 | 202 | 183 unique + 11 duplicates |
| **PL/pgSQL Functions** | 190 (179 unique) | 170 | Diff due to assembly duplicates |
| **SQL Functions** | 4 (4 unique) | 32 | Skipped by regex in M6I.1 assembly |
| **SECURITY DEFINER** | 163 (152 unique) | 169 | Diff due to skipped SQL sec-definers |
| **NON-SECURITY DEFINER** | 31 (31 unique) | 33 | Consistent with application RPCs |

---

## 4. OVERLOAD INVENTORY IN BASELINE

There are **7 overloaded function names** representing **17 distinct signatures**:
1. `cancel_appointment_by_token`:
   - `cancel_appointment_by_token(uuid)`
   - `cancel_appointment_by_token(text)`
2. `cancel_appointment`:
   - `cancel_appointment(uuid, text, text, text, uuid)`
   - `cancel_appointment(uuid, text, text, text)`
   - `cancel_appointment(uuid, uuid, text, text)`
3. `complete_appointment`:
   - `complete_appointment(uuid, text, uuid, text)`
   - `complete_appointment(uuid, text, uuid, text, jsonb)`
   - `complete_appointment(uuid, text, text, text, jsonb)`
   - `complete_appointment(uuid, jsonb, text, uuid, text)`
4. `reschedule_appointment`:
   - `reschedule_appointment(uuid, timestamptz, timestamptz, text, uuid, text, jsonb)`
   - `reschedule_appointment(uuid, timestamptz, timestamptz, text, uuid, text, jsonb, uuid)`
5. `process_subscription_loyalty_rewards`:
   - `process_subscription_loyalty_rewards(uuid)`
   - `process_subscription_loyalty_rewards()`
6. `submit_review_by_token`:
   - `submit_review_by_token(uuid, int, int, text, text)`
   - `submit_review_by_token(uuid, int, int, int, text, text, boolean, uuid)`
7. `check_rate_limit`:
   - `check_rate_limit(text, text, int, int)`
   - `check_rate_limit(text, int, int)`

---

## 5. FAILED RETRY FUNCTION STATUS

- **Function**: `public.handle_appointment_payment_update()`
- **Status**: **COMPLETE & FULLY FORMED**
- **Delimiters**: Balanced `$$` quotes verified.
- **Language**: `plpgsql`
- **Security**: `SECURITY DEFINER`
- **Returns**: `TRIGGER`

---

## 6. HASH STABILITY CONFIRMATION

Zero artifacts were modified in this read-only forensic review. Hashes remain identical:
- **Baseline SHA256**: `bde95634aa2b301f71658e1d2e7b742495ed6b75a98c8064a9c3e98630d4db48`
- **Verify SHA256**: `8dbf8e14995914220619241cf05fcfdec387ee683a70c6c78b327f0cd787ccce`
- **Manifest SHA256**: `f544aabd131713012c9717060108954995c31c62b8c51bd6a8c396f8fd41e9fc`
