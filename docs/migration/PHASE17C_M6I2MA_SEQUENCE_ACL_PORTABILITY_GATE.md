# BARBEX — PHASE 17C.M6I.2M-A: SEQUENCE OWNER / ACL / PORTABILITY FINAL GATE
**Mode:** Local Forensic Review / Local Remediation Only  
**Execution Timestamp:** 2026-09-09T10:05:00Z  
**Source Project Ref:** `wdxhjwodyctgzqtogkgv` (STRICTLY ZERO CONTACT / ZERO MUTATION)  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz` (STRICTLY ZERO CONTACT / ZERO MUTATION)  
**Current Candidate Release:** `BARBEX-CANONICAL-20260909-a5373b05`  
**Final Decision:** `READY_FOR_PHYSICAL_RETRY_7_REVIEW`  

---

## 1. Executive Summary

Phase 17C.M6I.2M closed sequence identity, definition, ownership, ordering, and default references. This phase (17C.M6I.2M-A) explicitly closes **sequence OWNER, ACL, and role portability** prior to physical Retry #7:
1. Physical Source sequences contained ACL grants to `sandbox_exec`, a Lovable Cloud sandbox execution role not present on standard Supabase / Target Postgres.
2. The canonical baseline was inspected and verified to contain **zero references** to `sandbox_exec` or any unknown/platform-specific roles.
3. Sequence permissions are granted strictly to standard application runtime roles (`anon`, `authenticated`, `service_role`).
4. Sequence owner is preserved as `postgres`.
5. Preflight SQL script `docs/migration/sql/phase17c_m6i2_check_roles.sql` was created to verify all required database roles before any future Target mutation.
6. The canonical manifest and verifier were hardened with explicit sequence ACL models and runtime privilege checks (`has_sequence_privilege`).

---

## 2. Source Sequence ACL Inventory

Authoritative Source data from `docs/migration/source-truth/sequences_source_truth.csv`:
- `SOURCE_PHYSICAL_SEQUENCES: 2`
- `SOURCE_SEQUENCE_OWNERS: postgres (for both sequences)`
- `SOURCE_SEQUENCE_ACL_ENTRIES:`
  - `public.rate_limit_hits_id_seq`: `{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres,sandbox_exec=rU/postgres}`
  - `public.status_checks_id_seq`: `{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres,sandbox_exec=rU/postgres}`
- `SOURCE_SEQUENCE_ACL_PRINCIPALS:` `postgres`, `anon`, `authenticated`, `service_role`, `sandbox_exec`

Privilege Breakdown:
- `postgres`: `rwU` (SELECT, UPDATE, USAGE)
- `anon`: `rwU` (SELECT, UPDATE, USAGE)
- `authenticated`: `rwU` (SELECT, UPDATE, USAGE)
- `service_role`: `rwU` (SELECT, UPDATE, USAGE)
- `sandbox_exec`: `rU` (SELECT, USAGE)

---

## 3. Baseline Sequence Owner / ACL Inspection

Inspected `supabase/baseline/20260907_barbex_canonical_source_baseline.sql`:
- `BASELINE_SEQUENCE_OWNER_STATEMENTS: 0` (PostgreSQL assigns owner `postgres` upon `CREATE SEQUENCE`)
- `BASELINE_SEQUENCE_OWNED_BY_STATEMENTS: 2`
  - `ALTER SEQUENCE public.rate_limit_hits_id_seq OWNED BY public.rate_limit_hits.id;`
  - `ALTER SEQUENCE public.status_checks_id_seq OWNED BY public.status_checks.id;`
- `BASELINE_SEQUENCE_GRANT_STATEMENTS: 2`
  - `GRANT ALL ON SEQUENCE public.rate_limit_hits_id_seq TO anon, authenticated, service_role;`
  - `GRANT ALL ON SEQUENCE public.status_checks_id_seq TO anon, authenticated, service_role;`
- `BASELINE_SEQUENCE_REVOKE_STATEMENTS: 0`
- `REFERENCED_ROLES_IN_SEQUENCE_STATEMENTS:` `anon`, `authenticated`, `service_role`

---

## 4. Role Portability Classification

| Principal | Classification | Portable to Target? | Baseline Action |
| :--- | :--- | :--- | :--- |
| `postgres` | `POSTGRES_CORE_ROLE` | **YES** | Preserved as default creator & owner |
| `anon` | `SUPABASE_STANDARD_ROLE` | **YES** | Preserved in sequence GRANT ALL |
| `authenticated` | `SUPABASE_STANDARD_ROLE` | **YES** | Preserved in sequence GRANT ALL |
| `service_role` | `SUPABASE_STANDARD_ROLE` | **YES** | Preserved in sequence GRANT ALL |
| `sandbox_exec` | `SOURCE_PLATFORM_SPECIFIC_ROLE` | **NO** | **EXCLUDED** from Target baseline (0 references) |

- `SOURCE_PLATFORM_SPECIFIC_SEQUENCE_ROLES: sandbox_exec`
- `UNKNOWN_SEQUENCE_ROLES: []`
- `PORTABLE_SEQUENCE_ROLES: [postgres, anon, authenticated, service_role]`

---

## 5. Runtime Requirement Analysis

When rows are inserted into `rate_limit_hits` or `status_checks`, the default expressions call:
- `nextval('rate_limit_hits_id_seq'::regclass)`
- `nextval('status_checks_id_seq'::regclass)`

PostgreSQL requires `USAGE` or `UPDATE` on the sequence to execute `nextval()`.
- `SEQUENCE_RUNTIME_REQUIRED_PRINCIPALS: anon, authenticated, service_role, postgres`
- `SEQUENCE_RUNTIME_REQUIRED_PRIVILEGES: USAGE, SELECT, UPDATE`
- `sandbox_exec` is NOT an application requirement (hosting sandbox only) and is excluded.

---

## 6. Portable Canonical ACL Model

- `SEQUENCE_ACL_PORTABILITY_MODEL: PORTABLE_STANDARD_SUPABASE_GRANTS`
- `SOURCE_SPECIFIC_GRANTS_EXCLUDED_FROM_TARGET: sandbox_exec (rU)`
- `APPLICATION_REQUIRED_GRANTS_PRESERVED: postgres (rwU), anon (rwU), authenticated (rwU), service_role (rwU)`

---

## 7. Target Role Preflight Requirement

Prepared preflight check in `docs/migration/sql/phase17c_m6i2_check_roles.sql`:
```sql
DO $$
DECLARE
  v_missing_roles text[];
  v_required_roles text[] := ARRAY['postgres', 'anon', 'authenticated', 'service_role'];
BEGIN
  SELECT array_agg(r) INTO v_missing_roles
  FROM unnest(v_required_roles) r
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);

  IF v_missing_roles IS NOT NULL AND array_length(v_missing_roles, 1) > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_FAIL: Required database roles missing on Target: %', v_missing_roles;
  ELSE
    RAISE NOTICE 'PREFLIGHT_PASS: All required baseline database roles exist on Target: %', v_required_roles;
  END IF;
END $$;
```
- `BASELINE_REQUIRED_DATABASE_ROLES: [postgres, anon, authenticated, service_role]`
- `TARGET_ROLE_EXISTENCE_PREFLIGHT_ADDED: YES`

---

## 8. Baseline Static Role Reference Census

Full scan of `supabase/baseline/20260907_barbex_canonical_source_baseline.sql` across GRANT, REVOKE, ALTER OWNER, CREATE POLICY, SET ROLE:
- `STANDARD_TARGET_ROLES: [anon (23), authenticated (238), service_role (15)]`
- `APPLICATION_ROLES: []`
- `SOURCE_PLATFORM_SPECIFIC_ROLES: []`
- `UNKNOWN_ROLES: []`
- `UNRESOLVED_PORTABILITY_ROLE_REFERENCES: 0`

---

## 9. Manifest & Verifier Hardening

1. **Manifest:**
   `docs/migration/manifests/barbex_canonical_manifest.json` updated with explicit fields:
   - `source_acl_raw`: raw Source ACL string
   - `source_acl_principals`: `[postgres, anon, authenticated, service_role, sandbox_exec]`
   - `portable_target_acl_principals`: `[postgres, anon, authenticated, service_role]`
   - `excluded_source_platform_principals`: `[sandbox_exec]`
   - `portable_target_privileges`: `[USAGE, SELECT, UPDATE]`
   - `target_owner`: `postgres`
   - `MANIFEST_SEQUENCE_ACL_MODEL: YES`

2. **Verifier:**
   `supabase/baseline/verify_20260907_canonical_baseline.sql` hardened to verify:
   - Sequence owner is `postgres` (`pg_class.relowner`).
   - `has_sequence_privilege(role, 'public.' || seq, priv)` for all 3 runtime roles and all 3 privileges (`USAGE`, `SELECT`, `UPDATE`).
   - `VERIFIER_SEQUENCE_ACL_VALIDATION: YES`

---

## 10. Regression Test Verification

| Test Suite | Gates Passed | Result |
| :--- | :--- | :--- |
| `scratch/test_role_and_sequence_acl_regression.mjs` | 6/6 | **PASS** |
| `scratch/test_sequence_regression.mjs` | 7/7 | **PASS** |
| `scratch/test_full_catalog_regression.mjs` | 16/16 | **PASS** |
| `scratch/test_typmod_regression.mjs` | 7/7 | **PASS** |
| `scratch/audit_sequence_ordering.mjs` | 2/2 | **PASS** |
| `scratch/validate_static_dependencies.mjs` | 11/11 | **PASS** |

- `ROLE_PORTABILITY_REGRESSION_TESTS: PASS`
- `SEQUENCE_ACL_REGRESSION_TESTS: PASS`

---

## 11. Release Lineage & Hashes

- `RELEASE_ID: BARBEX-CANONICAL-20260909-a5373b05`
- `BASELINE_SHA256: a5373b057110297474dd51db50bc58f4ec4f85e3120b01be036b9f7af5cc01e9` (retained, identical)
- `VERIFY_SHA256: 63333eff3104d60ca5099a7883fa891a69a6c037908c2b480618dd08c01fe22e` (hardened with owner/ACL checks)
- `MANIFEST_SHA256: 71dc3d699ffd78003464939c1f4d7bac57150f3d832511d92c28dff5e7a0b505` (updated with explicit ACL model)

---

## 12. Final Decision

`FINAL_DECISION: READY_FOR_PHYSICAL_RETRY_7_REVIEW`
