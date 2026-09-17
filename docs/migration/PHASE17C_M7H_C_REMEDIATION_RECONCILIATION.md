# BARBEX — PHASE 17C.M7H-C
## PUBLIC DATA REMEDIATION PROVENANCE RECONCILIATION

### 1. Executive Summary
- **Phase:** BARBEX — PHASE 17C.M7H-C
- **Operation Mode:** Forensic Read-Only Audit & Provenance Reconciliation.
- **Source Mutation:** ZERO (Source remains 100% FROZEN).
- **Target Mutation:** ZERO (Target remains at 10 users, 12 identities, 5 buckets, 30 objects, 0 public rows).
- **Canonical Remediation Decision:** **MODEL A CONFIRMED**.
- **Model A Specification:**
  - **Transform (5 rows):** `appointments.subscription_id` -> `NULL` (resolving 5 FK orphans referencing missing `customer_subscriptions(id)` `3efdaed0-fe9d-4802-bb52-8108743db95e`).
  - **Exclusion (4 rows):** `barber_services` (resolving 4 stale junction rows referencing deleted `barbers(id)` `5959e528-a329-4aac-a39a-fbc6f86d9d1d`).
- **Model B Disproven:**
  - Phone formatting: 0 profiles and 0 customers have non-standard phone numbers; no CHECK constraints or integrity rules require phone normalization.
  - Test logs: No pre-existing rule or integrity requirement justifies excluding audit logs or notifications.
  - Furthermore, Model B fails to resolve the 9 fatal FK violations on Target.
- **Final Row Arithmetic:**
  - Frozen Source Public Rows: `257,691`
  - Canonical Transforms: `5`
  - Canonical Exclusions: `4`
  - Canonical Expected Target Public Rows: `257,687` (257,691 - 4)
- **Authority Hash:** `M7H_C_REMEDIATION_AUTHORITY_SHA256 = f32620c1984a0dc67b0729f5e92b90c6b731c08833f0f7c7803f64ac89068f78`

---

### 2. Authority & Freeze Verification
- `A4B_DELTA_HASH_MATCH`: YES (`87e9979de3b2737d22dff88814d220d027c42a56b48963c1eefaec141475a00b`)
- `A4B_FROZEN_BUNDLE_HASH_MATCH`: YES (`62e10366e085591c1a370c002466f8d51ea021184b2a00572eb56bba532a23f6`)
- `STORAGE_BUNDLE_HASH_MATCH`: YES (`5a719badc98f4c25e797ceedd4cd803c3560cb992ac9e43bd2908b9e7054b362`)
- `SOURCE_FREEZE_VALID`: YES (257,691 public rows, 256,998 status_checks, max ID 256,998, 0 mutable drift, 16/16 paths frozen, WP-16 hotfix active)

---

### 3. Forensic Analysis: Claim A vs Claim B

#### 3.1 Claim A: Historical Certified Remediation
1. **`appointments.subscription_id`:**
   - Exactly 5 rows in `appointments` contain non-null `subscription_id = '3efdaed0-fe9d-4802-bb52-8108743db95e'`.
   - Referenced parent `customer_subscriptions(id)` does not exist in the frozen candidate (0 rows exist in `customer_subscriptions`).
   - Column `subscription_id` is nullable and governed by `ON DELETE SET NULL`.
   - Remediation: `SET subscription_id = NULL` (5 rows transformed).
   - Row IDs Hash: `c53391ad26ea01ecbe39c28ad19c58ddf9261dc10fe3949ac13dfa1e37284ceb`.
2. **`barber_services.barber_id`:**
   - Exactly 4 rows in junction table `barber_services` reference deleted barber `5959e528-a329-4aac-a39a-fbc6f86d9d1d`.
   - Column `barber_id` is NOT NULL and is part of the primary identity. Cannot be nullified.
   - Remediation: `EXCLUDE_ROW` (4 rows excluded).
   - Row IDs Hash: `ebbad22316ea78b7ffcae9a2c8b16d05c13d0869a952e6e28f343a2e947d75a5`.

#### 3.2 Claim B: M7H-A4B Anomaly Audit
1. **E.164 Phone Formatting:**
   - Audited all 10 `profiles` and all 12 `customers`. Non-standard phone count is 0.
   - Canonical schema has no regex CHECK constraints on phone formats.
   - No application integrity rule or constraint mandates this transform.
2. **Pre-canonical Test Logs:**
   - Audited `automation_jobs` (0 rows), `audit_logs` (0 rows), `notifications` (217 rows).
   - No pre-existing exclusion rule exists.
   - No FK/UNIQUE/CHECK constraint is violated by these rows.
   - Excluding production notification records without provenance is uncertified and unsafe.
3. **Fatal Flaw of Claim B:**
   - If Claim B were applied, the 9 physical FK violations in `appointments` and `barber_services` would remain unaddressed, causing fatal transaction failure during Target import.

---

### 4. Model Comparison Matrix

| Property | Model A (Historical Certified) | Model B (A4B Anomaly) |
| :--- | :--- | :--- |
| **FK Orphans** | **0** | 9 (5 in appointments, 4 in barber_services) |
| **UNIQUE Conflicts** | 0 | 0 |
| **CHECK Conflicts** | 0 | 0 |
| **ENUM Violations** | 0 | 0 |
| **Auth Reference Orphans** | 0 | 0 |
| **Tenant Orphans** | 0 | 0 |
| **User Orphans** | 0 | 0 |
| **Physically Proven** | **YES** | NO |
| **Import Viability** | **100% PASS** | **FATAL FAILURE** |

---

### 5. Final Canonical Remediation Policy

1. **Rule `REM-TRANSFORM-01`:**
   - Table: `appointments`
   - Column: `subscription_id`
   - Action: `SET_NULL`
   - Row Count: 5
   - Row IDs Hash: `c53391ad26ea01ecbe39c28ad19c58ddf9261dc10fe3949ac13dfa1e37284ceb`
2. **Rule `REM-EXCLUDE-01`:**
   - Table: `barber_services`
   - Column: `*`
   - Action: `EXCLUDE_ROW`
   - Row Count: 4
   - Row IDs Hash: `ebbad22316ea78b7ffcae9a2c8b16d05c13d0869a952e6e28f343a2e947d75a5`

- **Total Transforms:** 5 rows
- **Total Exclusions:** 4 rows
- **Expected Target Public Rows:** `257,687` (257,691 - 4)
- **Remediation Authority Hash:** `M7H_C_REMEDIATION_AUTHORITY_SHA256 = f32620c1984a0dc67b0729f5e92b90c6b731c08833f0f7c7803f64ac89068f78`
