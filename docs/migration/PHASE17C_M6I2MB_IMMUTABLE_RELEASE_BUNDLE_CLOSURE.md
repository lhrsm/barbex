# BARBEX — PHASE 17C.M6I.2M-B
## IMMUTABLE RELEASE BUNDLE / ACL SEMANTICS CLOSURE
### FINAL LOCAL GATE BEFORE PHYSICAL RETRY #7

**Execution Mode:** `LOCAL FORENSIC RELEASE RECONCILIATION ONLY`  
**Date:** 2026-09-09  
**Source Production Project Ref:** `wdxhjwodyctgzqtogkgv`  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz`  

---

## 1. Executive Summary & Objective

In Phase 17C.M6I.2M-A, verifier and manifest artifacts were hardened to include sequence ACL and owner verification, which altered their cryptographic hashes:
- Verifier: `35f15442c8a62001511abf06d579400e571e539b7f7183d7af23c3a1ac413ada` -> `63333eff3104d60ca5099a7883fa891a69a6c037908c2b480618dd08c01fe22e`
- Manifest: `7e98a17be95fd7728c83647d74c74ba0a625a99517efef9258603ad1a073feb4` -> `71dc3d699ffd78003464939c1f4d7bac57150f3d832511d92c28dff5e7a0b505`

However, Phase 17C.M6I.2M-A retained the same release identifier (`BARBEX-CANONICAL-20260909-a5373b05`), violating immutable release bundle semantics. Under an immutable release bundle model, a canonical release represents the exact immutable 3-tuple `(BASELINE_SHA256, VERIFY_SHA256, MANIFEST_SHA256)`. Any modification to any member of this tuple necessitates marking the prior bundle as `SUPERSEDED` and generating an unambiguous revision identifier without mutating baseline SQL unnecessarily.

Phase 17C.M6I.2M-B achieves:
1. Formal adoption of `IMMUTABLE_RELEASE_BUNDLE_MODEL = YES`.
2. Explicit classification of `BARBEX-CANONICAL-20260909-a5373b05` as `SUPERSEDED` with its original hash tuple preserved in historical evidence.
3. Establishment of unambiguous release identifier: `BARBEX-CANONICAL-20260909-a5373b05-r2`.
4. Derivation of deterministic release bundle fingerprint `CANONICAL_BUNDLE_SHA256`: `379f4147d2904009ef964e2ea5e5a57b8707835a5a71babbdf44937fd500986f`.
5. Formal clarification of sequence privilege semantics: `postgres` is OWNER (implicit `rwU` privileges); explicit runtime GRANT statements are restricted to `anon`, `authenticated`, and `service_role`; `sandbox_exec` is excluded as platform-specific.
6. Validation of Target database role preflight script `docs/migration/sql/phase17c_m6i2_check_roles.sql` (100% read-only, checks exactly 4 required roles).
7. Confirmation of 100% catalog parity, zero drift, zero blockers, and all regression test passes.

---

## 2. Immutable Release Bundle Specification

### 2.1 Superseded Release Bundle
- **Release ID:** `BARBEX-CANONICAL-20260909-a5373b05`
- **Status:** `SUPERSEDED`
- **Superseded By:** `BARBEX-CANONICAL-20260909-a5373b05-r2`
- **Original Baseline SHA256:** `a5373b057110297474dd51db50bc58f4ec4f85e3120b01be036b9f7af5cc01e9`
- **Original Verifier SHA256:** `35f15442c8a62001511abf06d579400e571e539b7f7183d7af23c3a1ac413ada`
- **Original Manifest SHA256:** `7e98a17be95fd7728c83647d74c74ba0a625a99517efef9258603ad1a073feb4`

### 2.2 Active Frozen Release Bundle (Retry #7 Candidate)
- **Release ID:** `BARBEX-CANONICAL-20260909-a5373b05-r2`
- **Status:** `ACTIVE_FROZEN_CANDIDATE`
- **Baseline File:** `supabase/baseline/20260907_barbex_canonical_source_baseline.sql`
  - **Baseline SHA256:** `a5373b057110297474dd51db50bc58f4ec4f85e3120b01be036b9f7af5cc01e9`
- **Verifier File:** `supabase/baseline/verify_20260907_canonical_baseline.sql`
  - **Verifier SHA256:** `63333eff3104d60ca5099a7883fa891a69a6c037908c2b480618dd08c01fe22e`
- **Manifest File:** `docs/migration/manifests/barbex_canonical_manifest.json`
  - **Manifest SHA256:** `71dc3d699ffd78003464939c1f4d7bac57150f3d832511d92c28dff5e7a0b505`

### 2.3 Deterministic Bundle Fingerprint
- **Model:** `BUNDLE_FINGERPRINT_MODEL = YES`
- **Canonical Input Format:**
  ```
  baseline=a5373b057110297474dd51db50bc58f4ec4f85e3120b01be036b9f7af5cc01e9\n
  verifier=63333eff3104d60ca5099a7883fa891a69a6c037908c2b480618dd08c01fe22e\n
  manifest=71dc3d699ffd78003464939c1f4d7bac57150f3d832511d92c28dff5e7a0b505\n
  ```
- **CANONICAL_BUNDLE_SHA256:** `379f4147d2904009ef964e2ea5e5a57b8707835a5a71babbdf44937fd500986f`
- **Machine-Readable Evidence:** `docs/migration/evidence/phase17c_m6i2mb_bundle_evidence.json`

---

## 3. Sequence Privilege Semantics Reconciled

### 3.1 Physical Source Privilege State
- Authoritative Source CSV: `docs/migration/source-truth/sequences_source_truth.csv`
- Raw ACL on Source: `{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres,sandbox_exec=rU/postgres}`
- Owner: `postgres`
- Explicit Principals in pg_class.relacl: `postgres`, `anon`, `authenticated`, `service_role`, `sandbox_exec`

### 3.2 Portable Target Privilege Model
- `postgres`: **OWNER** of the sequence. In PostgreSQL, object ownership grants full implicit privileges (`USAGE`, `SELECT`, `UPDATE` / `rwU`). No explicit `GRANT ALL ON SEQUENCE ... TO postgres` statement is required or emitted.
- `anon`: Explicit `GRANT ALL ON SEQUENCE public.<seq> TO anon;` (provides `USAGE`, `SELECT`, `UPDATE`).
- `authenticated`: Explicit `GRANT ALL ON SEQUENCE public.<seq> TO authenticated;` (provides `USAGE`, `SELECT`, `UPDATE`).
- `service_role`: Explicit `GRANT ALL ON SEQUENCE public.<seq> TO service_role;` (provides `USAGE`, `SELECT`, `UPDATE`).
- `sandbox_exec`: **EXCLUDED**. This is a proprietary Lovable Cloud execution sandbox role not present in vanilla Supabase Target environments.

### 3.3 Verifier & Manifest Coherence
- Verifier validates sequence owner: `SELECT c.relname FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname <> 'postgres'` (asserts 0 mismatches).
- Verifier validates portable ACLs via `has_sequence_privilege(t.role, 'public.' || t.seq, t.priv)` across `('anon', 'authenticated', 'service_role')` for `('USAGE', 'SELECT', 'UPDATE')`.
- Manifest explicitly records `portable_target_acl_principals`, `excluded_source_platform_principals: ["sandbox_exec"]`, and `target_owner: "postgres"`.

---

## 4. Executable Database Role Census

Complete static analysis of `supabase/baseline/20260907_barbex_canonical_source_baseline.sql`:
- **Role Census Summary:**
  - `postgres`: Implicit superuser / session user / object owner for all tables, sequences, functions, and views.
  - `anon`: 23 explicit occurrences (grants, policies).
  - `authenticated`: 238 explicit occurrences (grants, policies).
  - `service_role`: 15 explicit occurrences (grants, policies).
- **Executable Platform-Specific References:** `0` (zero references to `sandbox_exec`, `lovable_internal`, etc.).
- **Unknown Executable Role References:** `0`.
- **BASELINE_REQUIRED_DATABASE_ROLES:** `postgres, anon, authenticated, service_role`.

---

## 5. Target Role Preflight Validation

- **Artifact:** `docs/migration/sql/phase17c_m6i2_check_roles.sql`
- **Mode:** `100% READ-ONLY`
- **Mutating Statements:** `0` (zero `CREATE ROLE`, `ALTER ROLE`, `GRANT`, or `DROP ROLE`).
- **Required Roles Checked:** Exactly 4:
  1. `postgres`
  2. `anon`
  3. `authenticated`
  4. `service_role`
- **Verification Logic:** Uses anonymous PL/pgSQL block querying `pg_roles` with fail-closed assertion raising exception if any required role is absent, followed by a deterministic inspection `SELECT rolname, rolcanlogin, rolsuper FROM pg_roles`.
- **Status:** Validated locally. Preflight script ready for execution before Target transaction.

---

## 6. Comprehensive Physical Catalog Parity

| Catalog Metric | Physical Source Truth | Rebuilt Baseline | Verifier Contract | Drift / Status |
| :--- | :--- | :--- | :--- | :--- |
| **Base Tables** | 159 | 159 | 159 | **0 Drift** (MATCH) |
| **Base Table Columns** | 2198 | 2198 | 2198 | **0 Drift** (MATCH) |
| **Views** | 2 | 2 | 2 | **0 Drift** (MATCH) |
| **View Columns** | 13 | 13 | 13 | **0 Drift** (MATCH) |
| **Sequences** | 2 | 2 | 2 | **0 Drift** (MATCH) |
| **Primary Keys** | 159 | 159 | 159 | **0 Drift** (MATCH) |
| **Unique Constraints** | 58 | 58 | 58 | **0 Drift** (MATCH) |
| **Check Constraints** | 59 | 59 | 59 | **0 Drift** (MATCH) |
| **Exclusion Constraints**| 0 | 0 | 0 | **0 Drift** (MATCH) |
| **Foreign Keys** | 279 | 279 | 279 | **0 Drift** (MATCH) |
| **Indexes** | 442 | 442 | 442 | **0 Drift** (MATCH) |
| **Triggers** | 110 | 110 | 110 | **0 Drift** (MATCH) |
| **Enum Types** | 14 | 14 | 14 | **0 Drift** (MATCH) |
| **Enum Values** | 75 | 75 | 75 | **0 Drift** (MATCH) |
| **RLS Enabled Tables** | 159 | 159 | 159 | **0 Drift** (100% MATCH) |
| **FORCE RLS Tables** | 0 | 0 | 0 | **0 Drift** (MATCH) |
| **Functions / RPCs** | 202 | 202 | 202 | **0 Drift** (MATCH) |
| **Policies** | 394 | 394 | 394 | **0 Drift** (MATCH) |
| **Exact Typmod Parity** | 2211 | 2211 | 2211 | **0 Drift** (MATCH) |

### Sequence Parity Breakdown
- Nominal drift: `0`
- Definition drift: `0` (`bigint`, `START 1`, `INCREMENT 1`, `MINVALUE 1`, `MAXVALUE 9223372036854775807`, `CACHE 1`, `NO CYCLE`)
- Ownership drift: `0` (`rate_limit_hits_id_seq` owned by `rate_limit_hits.id`, `status_checks_id_seq` owned by `status_checks.id`)
- Column default reference drift: `0` (`nextval('rate_limit_hits_id_seq'::regclass)`, `nextval('status_checks_id_seq'::regclass)`)
- Unresolved sequence references: `0`
- Forward sequence reference blockers: `0` (created at lines 127, 136 before table defaults at lines 1957, 2222)
- Static dependency blockers: `0`
- Full schema dependency blockers: `0`
- Unresolved relation references: `0`

---

## 7. Permanent Regression Test Results

| Test Suite | Gates Passed | Result |
| :--- | :--- | :--- |
| `scratch/test_immutable_release_regression.mjs` | 8 / 8 | **PASS** |
| `scratch/test_role_and_sequence_acl_regression.mjs` | 6 / 6 | **PASS** |
| `scratch/test_sequence_regression.mjs` | 7 / 7 | **PASS** |
| `scratch/test_full_catalog_regression.mjs` | 16 / 16 | **PASS** |
| `scratch/test_typmod_regression.mjs` | 7 / 7 | **PASS** |
| `scratch/audit_sequence_ordering.mjs` | 2 / 2 | **PASS** |
| `scratch/validate_static_dependencies.mjs` | All gates | **PASS** |

---

## 8. Quality Gates & Safety Compliance

- `git diff --check`: PASS (Clean whitespace, no conflict markers)
- `npx tsc --noEmit`: PASS (0 errors)
- `npm run build`: PASS (Vite production build verified)
- `secret scan`: PASS (0 secrets exposed)
- Remote safety compliance:
  - Source contacted: NO
  - Source mutated: NO
  - Target contacted: NO
  - Target mutated: NO
  - Physical Retry #7 executed: NO
  - Git commit / push executed: NO
