# BARBEX — PHASE 17C.M6I.2G-S: PHYSICAL SOURCE POLICY TRUTH RECONCILIATION REPORT
**MODE**: LOCAL FORENSIC RECONCILIATION / NO REMOTE DATABASE MUTATION  
**DATE**: 2026-09-08  
**SOURCE PRODUCTION REF**: `wdxhjwodyctgzqtogkgv` (**100% UNTOUCHED / ZERO REMOTE CONTACT**)  
**TARGET SUPABASE REF**: `ywdwrstxvsdqiryhieiz` (**100% PRISTINE EMPTY AFTER CLEAN ROLLBACK**)  
**SUPERSEDED RELEASE ID**: `BARBEX-CANONICAL-20260908-3021b866` (STATUS: `SUPERSEDED_POLICY_INVENTORY_DEFECT`)  
**NEW CANONICAL RELEASE ID**: `BARBEX-CANONICAL-20260908-d0037497`  
**FINAL DECISION**: `READY_FOR_PHYSICAL_RETRY_4_REVIEW`  

---

## 1. EXECUTIVE SUMMARY

In accordance with the operational mandate for Phase 17C.M6I.2G-S, the canonical Barbex RLS policy layer was completely rebuilt from the authorized, read-only physical production catalog export (`docs/migration/source-truth/policies_source_truth_394.csv`), replacing historical-migration inference with **authoritative physical catalog truth**.

### Key Outcomes:
1. **Physical Source Truth Verified**:
   - Total rows: **394** (100% in `public` schema, 100% non-empty identities).
   - Unique identity signatures (`schema.table::policy_name`): **394**.
   - Command distribution: **138 SELECT**, **62 INSERT**, **43 UPDATE**, **32 DELETE**, **119 ALL**.
   - Enforcement distribution: **316 PERMISSIVE**, **78 RESTRICTIVE**.
   - Policy-less tables verified: `background_jobs`, `observability_logs`, `operation_locks` (0 policies, RLS enabled).
2. **Surplus Baseline Policies Resolved**:
   - The prior baseline contained **417** policy statements due to cumulative migration parsing.
   - All 103 historical/superseded baseline-only policies were purged from Section 09.
   - All 80 Source policies missing from the prior baseline (including 78 dynamic `require_module_*` policies and 2 omitted/truncated policies) were restored directly from physical catalog truth.
   - The net surplus of **23 policies** (417 - 394) is 100% explained and eliminated.
3. **Canonical Baseline Rebuilt**:
   - Section 09 of `supabase/baseline/20260907_barbex_canonical_source_baseline.sql` now defines exactly **394 CREATE POLICY** statements and **394 DROP POLICY IF EXISTS** statements.
   - Zero identity drift, zero semantic definition drift.
4. **Canonical Manifest Synchronized**:
   - `docs/migration/manifests/barbex_canonical_manifest.json` updated with all 394 physical policies with complete attributes (`name`, `table`, `command`, `permissive`, `roles`, `using`, `with_check`).
   - Summary counts updated to `policies: 394`.
5. **Verifier Hardened**:
   - `supabase/baseline/verify_20260907_canonical_baseline.sql` upgraded from count-only check to nominal validation of all 394 policy identities, zero missing, zero unexpected, and strict policy-less checks on the 3 system tables.
6. **Assembler Corrected**:
   - `scratch/assemble_canonical_source_baseline.mjs` updated with `ASSEMBLER_POLICY_SOURCE = 'PHYSICAL_SOURCE_CATALOG'`, ensuring automated builds read from authoritative physical catalog CSV instead of naive migration parsing.
7. **Permanent Regression Suite**:
   - Added `scratch/test_policy_reconciliation_regression.mjs` with 17/17 passing tests.
8. **Quality Gates & Integrity**:
   - All quality gates pass (`git diff --check`, `npx tsc --noEmit`, `npm run build`, secret scan).
   - FK remediation (279 ALTER TABLE constraints, 0 inline FKs) and function remediation (202 functions) remain 100% intact.
   - Generated new release fingerprint: `BARBEX-CANONICAL-20260908-d0037497`.

---

## 2. PHYSICAL SOURCE CATALOG AUDIT

### Source Truth File
- **Location**: `docs/migration/source-truth/policies_source_truth_394.csv`
- **Format**: Semicolon-delimited (`command;permissive;policy_name;roles;schema_name;table_name;using_expression;with_check_expression`).
- **Validation Results**:
  - `SOURCE_POLICY_ROWS`: 394
  - `SOURCE_UNIQUE_POLICY_IDENTITIES`: 394
  - `DUPLICATE_IDENTITIES`: 0

### Source Policy Distribution
| Dimension | Category | Physical Catalog Count | Baseline After Rebuild | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Command** | `SELECT` | 138 | 138 | **EXACT MATCH** |
| | `INSERT` | 62 | 62 | **EXACT MATCH** |
| | `UPDATE` | 43 | 43 | **EXACT MATCH** |
| | `DELETE` | 32 | 32 | **EXACT MATCH** |
| | `ALL` | 119 | 119 | **EXACT MATCH** |
| **Enforcement** | `PERMISSIVE` | 316 | 316 | **EXACT MATCH** |
| | `RESTRICTIVE` | 78 | 78 | **EXACT MATCH** |
| **Total** | **All Policies** | **394** | **394** | **EXACT MATCH** |

### Policy-less RLS Tables Verification
The 3 system and audit tables remain strictly policy-less in physical production:
- `background_jobs`: 0 policies
- `observability_logs`: 0 policies
- `operation_locks`: 0 policies

---

## 3. ROOT CAUSE OF 394 VS 417 & SURPLUS AUDIT

### Detailed Mechanism of Drift in Prior Baseline
1. **Cumulative Migration Accumulation**: The previous baseline builder (`assemble_canonical_source_baseline.mjs`) iterated over all 535 SQL migrations, collecting every `CREATE POLICY` regex match without evaluating `DROP POLICY` statements or rename chains.
2. **Omission of Dynamic SQL**: In migration `20260722115730_55362d70-ab65-435d-b68c-edf26747863a.sql`, the 78 RESTRICTIVE policies enforcing tenant module access (`require_module_*`) were generated dynamically via a PL/pgSQL `DO` loop (`EXECUTE format('CREATE POLICY ...')`). Because static regex could not parse dynamic statements, all 78 RESTRICTIVE policies were omitted from the prior baseline.
3. **Historical Surplus**: The prior baseline contained 103 historical policies that were either dropped (87 replaced by narrower policies in later migrations) or belonged to obsolete workflows (16).
4. **Net Difference**: $103 \text{ surplus historical} - 80 \text{ omitted Source} = 23 \text{ net surplus statements}$ (417 vs 394).

### Classification of the Baseline-Only Policies
- **Historically Replaced (87)**: Wide-open development policies (e.g. `"Allow anonymous SELECT on appointments"`, `"Public access"`, `"Anyone can create customers"`) that were subsequently dropped and replaced with hardened multi-tenant role-based checks.
- **Obsolete (16)**: Temporary worker policies created during intermediate migrations (e.g. `"Tenants can manage their own queue"`, `"Tenants can view their sessions"`).
- **Unclassified (0)**: Every surplus policy was deterministically traced.

---

## 4. CANONICAL REBUILD & PARITY MATRICES

### Source ↔ Baseline Parity
| Metric | Before Rebuild | After Rebuild | Status |
| :--- | :--- | :--- | :--- |
| **Total CREATE Statements** | 417 | 394 | **PARITY ACHIEVED** |
| **Total Defensive DROP Statements**| 417 | 394 | **PARITY ACHIEVED** |
| **Unique Policy Identities** | 417 | 394 | **PARITY ACHIEVED** |
| **Source-Only Policies** | 80 | 0 | **ZERO DRIFT** |
| **Baseline-Only Policies** | 103 | 0 | **ZERO DRIFT** |
| **Policy Identity Drift** | 103 | 0 | **ZERO DRIFT** |
| **Command Drift** | - | 0 | **ZERO DRIFT** |
| **Permissive Drift** | - | 0 | **ZERO DRIFT** |
| **Roles Drift** | - | 0 | **ZERO DRIFT** |
| **Semantic USING Drift** | - | 0 | **ZERO DRIFT** |
| **Semantic WITH CHECK Drift**| - | 0 | **ZERO DRIFT** |

### Source ↔ Manifest Parity
- `MANIFEST_POLICY_COUNT`: 394
- `MANIFEST_UNIQUE_POLICY_IDENTITIES`: 394
- `SOURCE_ONLY_VS_MANIFEST`: 0
- `MANIFEST_ONLY_VS_SOURCE`: 0
- `MANIFEST_POLICY_DEFINITION_DRIFT`: 0

### Verifier Hardening Parity
- `VERIFIER_EXPECTED_POLICY_COUNT`: 394
- `VERIFIER_NOMINAL_POLICY_VALIDATION`: YES (Explicit array check across all 394 policies)
- `VERIFIER_POLICYLESS_TABLES_CHECK`: YES (`background_jobs`, `observability_logs`, `operation_locks` confirmed clean)

---

## 5. DEPENDENCY AND STRUCTURAL INTEGRITY

### Policy Function Dependency Resolution
All helper functions invoked in policy `USING` and `WITH CHECK` clauses resolve directly against the canonical 202-function catalog:
- `public.has_role(uuid, app_role)`: Present & Hardened
- `public.is_super_admin_user()`: Present & Hardened
- `public.has_module_access(uuid, text)`: Present & Hardened
- `public.get_my_tenant_id()`: Present & Hardened
- `public.is_super_admin()`: Present & Hardened
- `public.reception_tenant_id()`: Present & Hardened
- `public.reception_can(text, uuid)`: Present & Hardened
- `UNRESOLVED_POLICY_FUNCTION_REFERENCES`: **0**

### Two-Phase DDL & Foreign Key Order Preservation (M6I.2G)
- Total Foreign Keys: **279**
- Inline Foreign Keys in Section 03: **0**
- ALTER TABLE Constraints in Section 04: **279**
- Forward Reference Dependencies: **0**
- FK Semantic Drift: **0**

### Trigger Pairing Preservation
- `DROP TRIGGER IF EXISTS` Statements: **124**
- `CREATE TRIGGER` Statements: **124**
- Matched Trigger Pairs: **124**
- Trigger Families: **110**

### Global Structural Inventory
- Base Tables: **159**
- Views: **2**
- Total Columns: **2,211**
- ENUM Types: **14** (75 values)
- Primary Keys: **159**
- Foreign Keys: **279**
- Performance Indexes: **442**
- Functions / RPCs: **202**
- Triggers: **124**
- RLS-Enabled Tables: **159**
- RLS Policies: **394**

---

## 6. RELEASE FINGERPRINT INVALIDATION & UPGRADE

| Release Property | Superseded Release | New Canonical Release |
| :--- | :--- | :--- |
| **Release ID** | `BARBEX-CANONICAL-20260908-3021b866` | **`BARBEX-CANONICAL-20260908-d0037497`** |
| **Status** | `SUPERSEDED_POLICY_INVENTORY_DEFECT`| **`READY_FOR_PHYSICAL_RETRY_4_REVIEW`** |
| **Baseline SHA256** | `3021b866535f24cd5914f3784677236878588ed8c63f9fb38653ac2091ddc55b` | `d003749775ae9c8f51729914f7c6981b56f11469c9cc4587a8e723fe6368a783` |
| **Verify SHA256** | `6d94e05e16b567c23131f591bc0d3a092829cc5cae3177ba5d187c0fedd0fdb3` | `10e4c6b160014e14494d9b03a3982253094b86688975748e9a0f324acaa235a4` |
| **Manifest SHA256** | `a238446c19baa01c329bfe88515259e0765404e157d3848ebbf204b236a2cb11` | `602d9a03d5ced3d4c3baca666f2f38491979a14798bc27684cd2f859e1bc0852` |

---

## 7. QUALITY GATES

1. `git diff --check`: **PASS** (Zero conflict markers, zero whitespace errors)
2. `npx tsc --noEmit`: **PASS** (Exit code 0, zero compilation errors)
3. `npm run build`: **PASS** (Exit code 0, client and server bundles built cleanly)
4. Secret Scan: **PASS** (Zero private credentials or sensitive connection strings leaked)
5. Regression Suite (`test_policy_reconciliation_regression.mjs`): **PASS (17/17)**
6. Remote Boundaries: **PASS** (Zero remote calls, zero database writes, no commit, no push)

---

## 8. RECOMMENDATION & NEXT ACTIONS

- **FINAL DECISION**: `READY_FOR_PHYSICAL_RETRY_4_REVIEW`
- **SAFETY CONTRACT REAFFIRMED**: Execution is stopped locally. Zero remote contact to target `ywdwrstxvsdqiryhieiz` or source `wdxhjwodyctgzqtogkgv`. No commit, no push.
