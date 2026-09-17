# BARBEX — PHASE 17C.M6I.2M: PHYSICAL SEQUENCE & RELATION DEPENDENCY CLOSURE
**Mode:** Local Forensic Reconciliation / Local Remediation Only  
**Execution Timestamp:** 2026-09-09T09:55:00Z  
**Source Project Ref:** `wdxhjwodyctgzqtogkgv` (STRICTLY ZERO CONTACT / ZERO MUTATION)  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz` (STRICTLY ZERO CONTACT / ZERO MUTATION)  
**Superseded Release:** `BARBEX-CANONICAL-20260908-ea7230e1`  
**New Candidate Release:** `BARBEX-CANONICAL-20260909-a5373b05`  
**Final Decision:** `READY_FOR_PHYSICAL_RETRY_7_REVIEW`  

---

## 1. Root Cause Analysis (Retry #6 Post-Mortem)

During Retry #6, the atomic materialization transaction failed closed at line 1934:
- **SQLSTATE:** `42P01` (undefined_table)
- **Failing Relation:** `public.rate_limit_hits_id_seq`
- **Failing Statement:**
  ```sql
  CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
      id BIGINT NOT NULL DEFAULT nextval('rate_limit_hits_id_seq'::regclass),
      bucket TEXT NOT NULL,
      key TEXT NOT NULL,
      hit_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT rate_limit_hits_pkey PRIMARY KEY (id)
  );
  ```
- **Root Cause Class:** `PHYSICAL_SEQUENCE_CATALOG_OMITTED_FROM_CANONICAL_ASSEMBLER`.
  While tables, views, and indexes were assembled directly from physical Source CSV catalogs, physical sequences were omitted from the canonical assembler. Because `'rate_limit_hits_id_seq'::regclass` requires the sequence relation to exist at table parse time, PostgreSQL aborted the statement.

---

## 2. Physical Sequence Source Truth Validation

Authoritative physical sequence catalog parsed from `docs/migration/source-truth/sequences_source_truth.csv` with delimiter `;`:
- `SEQUENCE_SOURCE_FILE_VALID: YES`
- `SOURCE_PHYSICAL_SEQUENCES: 2`
- `SOURCE_SEQUENCE_DUPLICATE_IDENTITIES: 0`

### Complete Physical Sequence Catalog:
1. `public.rate_limit_hits_id_seq`
   - Data Type: `bigint`
   - Parameters: `START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE`
   - Ownership: `public.rate_limit_hits.id` (`deptype = 'a'`)
   - Owner: `postgres`
   - ACL: `{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres,sandbox_exec=rU/postgres}`
2. `public.status_checks_id_seq`
   - Data Type: `bigint`
   - Parameters: `START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE`
   - Ownership: `public.status_checks.id` (`deptype = 'a'`)
   - Owner: `postgres`
   - ACL: `{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres,sandbox_exec=rU/postgres}`

---

## 3. Sequence-Backed Column Defaults & Exact Dependency Mapping

Cross-checked against `docs/migration/source-truth/columns_source_truth_exact_2211.csv`:
- `SEQUENCE_BACKED_COLUMN_DEFAULTS: 2`
  - `public.rate_limit_hits.id` -> `DEFAULT nextval('rate_limit_hits_id_seq'::regclass)`
  - `public.status_checks.id` -> `DEFAULT nextval('status_checks_id_seq'::regclass)`

---

## 4. Machine-Readable Before vs After Reconciliation

| Metric | Before (Retry #6 Release) | After (Remediated Release) | Status |
| :--- | :--- | :--- | :--- |
| **Source-Only Sequences** | 2 | 0 | **RESOLVED** |
| **Baseline-Only Sequences** | 0 | 0 | **MATCH** |
| **Sequence Definition Drift** | 2 | 0 | **RESOLVED** |
| **Sequence Ownership Drift** | 2 | 0 | **RESOLVED** |
| **Sequence Default Ref Drift** | 2 | 0 | **RESOLVED** |
| **Unresolved Sequence Refs** | 2 | 0 | **RESOLVED** |
| **Forward Sequence Blockers** | 2 | 0 | **RESOLVED** |
| **Manifest Sequences** | 0 | 2 | **RESOLVED** |
| **Manifest Definition Drift** | 2 | 0 | **RESOLVED** |
| **Manifest Ownership Drift** | 2 | 0 | **RESOLVED** |

---

## 5. Sequence DDL Placement & Execution Ordering

The baseline assembler (`scratch/assemble_canonical_source_baseline.mjs`) was updated to enforce strict dependency order:
1. **Section 02.1 SEQUENCES (Lines 125-144):**
   `CREATE SEQUENCE IF NOT EXISTS public.rate_limit_hits_id_seq` (Line 127)  
   `CREATE SEQUENCE IF NOT EXISTS public.status_checks_id_seq` (Line 136)  
   `GRANT ALL ON SEQUENCE ... TO anon, authenticated, service_role;`
2. **Section 03 BASE TABLES DDL (Lines 147-3100):**
   `CREATE TABLE IF NOT EXISTS public.rate_limit_hits` (Line 1956)  
   `CREATE TABLE IF NOT EXISTS public.status_checks` (Line 2221)  
3. **Section 03.1 SEQUENCE OWNERSHIP (Lines 3102-3112):**
   `ALTER SEQUENCE public.rate_limit_hits_id_seq OWNED BY public.rate_limit_hits.id;` (Line 3107)  
   `ALTER SEQUENCE public.status_checks_id_seq OWNED BY public.status_checks.id;` (Line 3108)  

Ordering statically proven:
`seq_create (lines 127/136) < table_create (lines 1956/2221) < seq_owned (lines 3107/3108)`

---

## 6. Physical Relation Census (Relkind Closure)

All observed public `pg_class` objects classified into authoritative physical relkinds:
- Ordinary Base Tables (`relkind = 'r'`): **159**
- Views (`relkind = 'v'`): **2**
- Physical Sequences (`relkind = 'S'`): **2**
- Standalone + Constraint Indexes (`relkind = 'i'`): **442**
- Materialized Views (`relkind = 'm'`): **0**
- Foreign Tables (`relkind = 'f'`): **0**
- Partitioned Tables (`relkind = 'p'`): **0**
- Partitioned Indexes (`relkind = 'I'`): **0**
- `UNEXPECTED_PHYSICAL_RELKIND_CLASSES: 0`

---

## 7. Verifier Hardening (Section 10)

`supabase/baseline/verify_20260907_canonical_baseline.sql` hardened with Section 2.1 PHYSICAL SEQUENCES:
- Queries `pg_class` for `relkind = 'S'` in schema `public` (requires exactly 2).
- Verifies nominal identities against `v_expected_sequences` with zero missing and zero unexpected.
- Queries `pg_sequence` to verify exact definition parity (`bigint`, `start=1`, `increment=1`, `min=1`, `max=9223372036854775807`, `cache=1`, `cycle=false`).
- Queries `pg_depend` to verify exact physical ownership (`rate_limit_hits.id`, `status_checks.id` with `deptype = 'a'`).
- Queries `pg_attrdef` to verify column defaults reference the sequences via `nextval('..._id_seq'::regclass)`.

---

## 8. Quality Gates & Release Freezing

- `git diff --check`: **PASS** (0 whitespace/syntax errors)
- `npx tsc --noEmit`: **PASS** (exited with code 0)
- `npm run build`: **PASS** (client + SSR + nitro build succeeded with code 0)
- `secret scan`: **PASS** (0 sensitive credentials in modified artifacts or backups)

### Release Lineage:
- `OLD_RELEASE_ID: BARBEX-CANONICAL-20260908-ea7230e1` (SUPERSEDED)
- `OLD_BASELINE_SHA256: ea7230e1c7241e632ee28c90e1e72a486b5e63c8efa38d8a9a59125500fb69cb`
- `OLD_VERIFY_SHA256: ad8ce922c4f749d2dcfec83d3a1454dbcd0bf40dc6f67fc031395059322b9543`
- `OLD_MANIFEST_SHA256: 719b6daac1a67be3e781fa837a0e97c2c2354817fa1bb72ae33a0b26bc3f68d9`

### New Frozen Release:
- `NEW_RELEASE_ID: BARBEX-CANONICAL-20260909-a5373b05`
- `NEW_BASELINE_SHA256: a5373b057110297474dd51db50bc58f4ec4f85e3120b01be036b9f7af5cc01e9`
- `NEW_VERIFY_SHA256: 35f15442c8a62001511abf06d579400e571e539b7f7183d7af23c3a1ac413ada`
- `NEW_MANIFEST_SHA256: 7e98a17be95fd7728c83647d74c74ba0a625a99517efef9258603ad1a073feb4`

---

## 9. Final Decision

`FINAL_DECISION: READY_FOR_PHYSICAL_RETRY_7_REVIEW`
