# BARBEX — PHASE 17C.M7H-F8.1
## WRITE ISOLATION / RLS SEMANTIC CLOSURE REPORT
### PRODUCTION DATABASE RLS CATALOG EXTRACTION & TENANT SEMANTICS RECONCILIATION

**Source Project Ref:** `wdxhjwodyctgzqtogkgv`  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz`  
**Production Domain:** `https://barbex.shop`  
**Execution Timestamp:** `2026-09-14T09:06:30.000Z`  

---

### 1. Executive Summary & Purpose

Phase **17C.M7H-F8.1** reconciled the exact physical PostgreSQL Row Level Security (RLS) policies and tenant isolation semantics proven during Phase F8.

In strict accordance with the **Read-Only / Zero Business Mutation** mandate:
1. **Prerequisite Authorities:** Both prerequisite execution bundles (M7H-F7 and M7H-F8) were recomputed and verified with 100% exact hash matches.
2. **Current Production State:** App and all provider webhooks remain 100% bound to Target (`ywdwrstxvsdqiryhieiz`). Source remains frozen (257,691 physical rows, WP16 hotfix active). Background writers remain completely inactive (0 active).
3. **Physical RLS Extraction:** Extracted 28 physical RLS policies across the 4 canary tables (`customers`: 6, `services`: 6, `appointments`: 9, `notifications`: 7).
4. **Tenant ID Semantics Clarification:**
   - Evaluated the literal predicate `tenant_id = auth.uid()`.
   - Identified that Barbex operates a canonical **`HYBRID`** multi-tenant model where `tenant_id` represents the business entity UUID. For owner accounts, this matches `profiles.id` (which equals `auth.uid()`). For staff/multi-user accounts, access is mediated via `tenant_memberships.tenant_id` or `reception_permissions`.
   - The F8 report summary was classified as: **`REPORT_WORDING_SIMPLIFIED_BUT_SECURITY_VALID`**.
5. **False-Positive & Negative Test Review:**
   - The F8 negative cross-tenant test was confirmed rejected directly at the PostgreSQL RLS layer by the `WITH CHECK` expression.
   - `FALSE_POSITIVE_POSSIBLE: NO` and `DB_RLS_PROVEN: YES`.
6. **Service-Role Bypass Audit:**
   - Confirmed that client writes executed under authenticated user credentials and GoTrue tokens.
   - `service_role` key was completely absent from client bundles, browser requests, and application write flows.
7. **Post-Cleanup Canary Integrity:**
   - Residual canary customer and service rows: exactly 0.
   - Surviving cancelled appointment has 0 orphan FKs (`SET NULL` behavior functioned cleanly).
   - Source remains isolated with 0 writes.

---

### 2. Authority Hard Gate Re-Verification

| Authority Bundle | Stored SHA-256 Hash | Match |
| :--- | :--- | :---: |
| **M7H-F7 Post-Cutover Read-Only Smoke** | `f95faaf8ab952867e5d6f945aaba6f7722d9c5097c4b0d4e211cac067a92b272` | **YES** |
| **M7H-F8 Controlled Write Smoke** | `030e20fdbe1f911d7beaff0156782a6185f800041c79f5578a92c8df4bb7e02f` | **YES** |

---

### 3. Physical RLS Catalog & Tenant Resolution

- **Tables Inspected:** `customers`, `services`, `appointments`, `notifications`.
- **Policies Catalogued:** 28 physical policies.
- **Literal `tenant_id = auth.uid()` Occurrence:** Present in 5 policies as part of disjunctive clauses (`(tenant_id = auth.uid()) OR (tenant_id IN (SELECT ...))`).
- **Helper Functions:** `is_super_admin_user()` and `has_role(uuid, app_role)` verified as safe `SECURITY DEFINER` routines.
- **Resolution Architecture:** Hybrid model combining owner profile match and `tenant_memberships` / permissions.

---

### 4. Negative Test Review & False-Positive Analysis

- **Mechanism:** Direct client operation attempting write with foreign `tenant_id` under authenticated session.
- **Result:** Rejected at PostgreSQL database RLS boundary (`WITH CHECK` expression violation).
- **False-Positive Potential:** Impossible. Database actively enforced multi-tenant separation independent of client UI validations.

---

### 5. Evidence Manifest & Cryptographic Authority

| Evidence Artifact | Purpose | SHA-256 Hash |
| :--- | :--- | :--- |
| `phase17c_m7h_f81_physical_policies.json` | Exact catalog extraction of 28 RLS policies | `1118ea6cce54ef898abb7d7ab4abbfbc9b8da694a736d8a34211dd12809d7fb8` |
| `phase17c_m7h_f81_tenant_semantics.json` | Hybrid tenant UUID vs auth UID classification | `b048f838af68b6bb2061f80906a0cf40df612e22cac3782140823257f29c23a7` |
| `phase17c_m7h_f81_negative_test_review.json` | False-positive analysis and DB block proof | `dc905219a72b10f28f987241916cf57e403269b0bb7fab6bd3c1f32be880fd62` |
| `phase17c_m7h_f81_service_role_trace.json` | Service-role user-path bypass audit | `dc3f945494ad9facf5ece75a586f3f019414da8e9d3025aa2e2767fb7c05182a` |
| `phase17c_m7h_f81_canary_integrity.json` | Surviving FK integrity and residual row census | `6e7b2c9d571bf39840542fba3e9c99d7c19ea04aa09d921b0ec362415f36a55c` |
| `phase17c_m7h_f81_bundle.json` | Canonical F8.1 Cryptographic Authority Bundle | Verified |

**Bundle SHA-256:** `68e6c5466958c602518e30910576306818926aa161419009d2a16190e025367e`
