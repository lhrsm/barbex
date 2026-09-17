# =====================================================================
# BARBEX — PHASE 17C.M6I.2J-R
# PHYSICAL SOURCE FOREIGN KEY TRUTH RECONCILIATION REPORT
# POST RETRY #5 FORENSIC RECONCILIATION
# =====================================================================

**Date**: 2026-09-08  
**Mode**: LOCAL FORENSIC RECONCILIATION ONLY  
**Source Ref**: `wdxhjwodyctgzqtogkgv` (Untouched, Uncontacted)  
**Target Ref**: `ywdwrstxvsdqiryhieiz` (Untouched, Pristine Clean Slate)  
**Superseded Release**: `BARBEX-CANONICAL-20260908-cf75c2f9`  
**New Release Candidate**: `BARBEX-CANONICAL-20260908-dfc59eea`  

---

## 1. Executive Summary

During Phase 17C.M6I.2J (Retry #5), execution failed at line 3126 during Section 04 (Foreign Keys DDL) with PostgreSQL error:
```
SQLSTATE 42703: column "queue_id" referenced in foreign key constraint does not exist
Statement: ALTER TABLE public.automation_logs ADD CONSTRAINT automation_logs_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.automation_queue(id) ON DELETE SET NULL;
```
Immediate fail-closed `ROLLBACK` was executed, leaving Target `ywdwrstxvsdqiryhieiz` in a 100% pristine empty slate.

In this Phase (17C.M6I.2J-R), complete local forensic reconciliation was conducted between:
1. The authoritative physical Source foreign key catalog export: `docs/migration/source-truth/foreign_keys_source_truth.csv` (279 physical constraints).
2. The authoritative physical Source column catalog export: `docs/migration/source-truth/columns_source_truth_2211.csv` (2,211 columns across 159 base tables and 2 views).
3. The existing canonical baseline DDL Section 04.

### Key Forensic Findings
1. **Total Physical FKs**: Exactly **279 foreign keys** exist in the physical PostgreSQL catalog of Source production (`foreign_keys_source_truth.csv`).
2. **Column Closure**: Every single source table (159), source column, public target table, and public target column referenced by the 279 physical FKs exists with 100% precision in `columns_source_truth_2211.csv` (`SOURCE_FK_SOURCE_TABLE_MISSING = 0`, `SOURCE_FK_SOURCE_COLUMN_MISSING = 0`, `SOURCE_FK_PUBLIC_TARGET_TABLE_MISSING = 0`, `SOURCE_FK_PUBLIC_TARGET_COLUMN_MISSING = 0`).
3. **Phantoms in Previous Baseline**: The previous baseline Section 04 was derived from `scratch/canonical_279_fks.json` (historical migration statements) rather than the physical catalog export. It contained **8 non-physical/draft/obsolete FKs**, including the 3 that referenced missing columns:
   - `automation_logs_queue_id_fkey` (`queue_id` does not exist in `automation_logs`)
   - `whatsapp_delivery_logs_queue_id_fkey` (`queue_id` does not exist in `whatsapp_delivery_logs`)
   - `whatsapp_instances_user_id_fkey` (`user_id` does not exist in `whatsapp_instances`)
4. **Compensating Physical Source FKs**: Exactly **8 physical Source FKs** were missing from the previous baseline, including physical foreign keys referencing `auth.users(id)` and physical constraint names from table renames:
   - `automation_logs_barber_id_fkey` (`barber_id -> auth.users.id`)
   - `automations_barber_id_fkey` (`barber_id -> auth.users.id`)
   - `barber_services_tenant_id_fkey` (`tenant_id -> auth.users.id`)
   - `customers_auth_user_id_fkey` (`auth_user_id -> auth.users.id`)
   - `transactions_adjusted_by_fkey` (`adjusted_by -> auth.users.id`)
   - `whatsapp_connections_user_id_fkey` on `whatsapp_cloud_connections`
   - `whatsapp_connections_barber_id_fkey` on `whatsapp_instances`
   - `whatsapp_connections_barbershop_id_fkey` on `whatsapp_instances`
5. **Reconciliation**: With Section 04 generated directly from `foreign_keys_source_truth.csv`, baseline Section 04 now has:
   - `SOURCE_PHYSICAL_FKS = 279`
   - `BASELINE_FKS_AFTER = 279`
   - `SOURCE_ONLY_FKS_AFTER = 0`
   - `BASELINE_ONLY_FKS_AFTER = 0`
   - `FK_DEFINITION_DRIFT_AFTER = 0`

---

## 2. Retry #5 Phantom Constraints Forensic Classification

| Constraint Name | Source Table | Source Column | Target Relation | Classification | Forensic Provenance |
|---|---|---|---|---|---|
| `automation_logs_queue_id_fkey` | `automation_logs` | `queue_id` | `public.automation_queue(id)` | `DRAFT_NEVER_PHYSICAL` | `queue_id` was a draft/abandoned design concept; `automation_logs` has 37 physical columns in production, none is `queue_id`. |
| `whatsapp_delivery_logs_queue_id_fkey` | `whatsapp_delivery_logs` | `queue_id` | `public.automation_queue(id)` | `DRAFT_NEVER_PHYSICAL` | `queue_id` was never materialized in production; `whatsapp_delivery_logs` has 11 physical columns, none is `queue_id`. |
| `whatsapp_instances_user_id_fkey` | `whatsapp_instances` | `user_id` | `auth.users(id)` | `HISTORICAL_REPLACED_FK` | In physical production, `whatsapp_instances` references `auth.users(id)` via `barber_id` under constraint `whatsapp_connections_barber_id_fkey`. |

---

## 3. Discrepancy Breakdown Before Remediation

### 3.1 BASELINE-ONLY Foreign Keys (8 total)
1. `public.automation_logs.automation_logs_queue_id_fkey`: `queue_id -> public.automation_queue(id)`
2. `public.refund_audits.refund_audits_changed_by_id_fkey`: `changed_by_id -> auth.users(id)`
3. `public.refund_requests.refund_requests_tenant_id_fkey`: `tenant_id -> public.profiles(id)`
4. `public.whatsapp_cloud_connections.whatsapp_cloud_connections_user_id_fkey`: `user_id -> public.profiles(id)`
5. `public.whatsapp_delivery_logs.whatsapp_delivery_logs_queue_id_fkey`: `queue_id -> public.automation_queue(id)`
6. `public.whatsapp_instances.whatsapp_instances_tenant_id_fkey`: `tenant_id -> public.profiles(id)`
7. `public.whatsapp_instances.whatsapp_instances_user_id_fkey`: `user_id -> auth.users(id)`
8. `public.zapi_webhook_logs.zapi_webhook_logs_barber_id_fkey`: `barber_id -> public.barbers(id)`

### 3.2 SOURCE-ONLY Foreign Keys (8 total)
1. `public.automation_logs.automation_logs_barber_id_fkey`: `barber_id -> auth.users(id)`
2. `public.automations.automations_barber_id_fkey`: `barber_id -> auth.users(id)`
3. `public.barber_services.barber_services_tenant_id_fkey`: `tenant_id -> auth.users(id)`
4. `public.customers.customers_auth_user_id_fkey`: `auth_user_id -> auth.users(id)`
5. `public.transactions.transactions_adjusted_by_fkey`: `adjusted_by -> auth.users(id)`
6. `public.whatsapp_cloud_connections.whatsapp_connections_user_id_fkey`: `user_id -> public.profiles(id)`
7. `public.whatsapp_instances.whatsapp_connections_barber_id_fkey`: `barber_id -> auth.users(id)`
8. `public.whatsapp_instances.whatsapp_connections_barbershop_id_fkey`: `tenant_id -> public.profiles(id)`

### 3.3 Definition Drift (24 total)
All 24 instances of definition drift involved missing physical `ON DELETE CASCADE` or `ON DELETE SET NULL` clauses that were present in physical Source truth but defaulted to `NO ACTION` in the previous draft baseline, plus target schema qualification for `whatsapp_delivery_logs_tenant_id_fkey`.
All 24 drifts are completely resolved in the new baseline.

---

## 4. Root Cause Analysis

**Root Cause**: `FK_ASSEMBLER_USED_HISTORICAL_MIGRATION_STATE_INSTEAD_OF_PHYSICAL_SOURCE_CATALOG`

The assembler `scratch/assemble_canonical_source_baseline.mjs` was reading foreign key definitions from `scratch/canonical_279_fks.json`, an intermediate file compiled from historical migration statements. Historical migrations contained forward-looking drafts, abandoned column references, and unapplied constraint renames that never reflected the physical reality of the running production database.

**Remediation**:
`scratch/assemble_canonical_source_baseline.mjs` was re-engineered to ingest `docs/migration/source-truth/foreign_keys_source_truth.csv` directly as the sole canonical authority for Section 04 foreign keys.

---

## 5. Artifact Parity & Hardening

1. **Manifest Rebuild**:
   `docs/migration/manifests/barbex_canonical_manifest.json` updated with full array of 279 physical foreign keys and updated counts.
2. **Verifier Hardening**:
   `supabase/baseline/verify_20260907_canonical_baseline.sql` enhanced with:
   - `v_expected_fks` array (279 items).
   - Nominal validation loop checking 0 missing and 0 unexpected FKs.
   - Explicit regression assertions rejecting `automation_logs_queue_id_fkey`, `whatsapp_delivery_logs_queue_id_fkey`, and `whatsapp_instances_user_id_fkey`.
   - Explicit regression assertions requiring `appointment_reviews_service_id_fkey`, `automation_logs_barber_id_fkey`, `whatsapp_connections_barber_id_fkey`, and `whatsapp_connections_barbershop_id_fkey`.
3. **Regression Test Suite**:
   `scratch/test_fk_regression_suite.mjs` executed and passed all 17 automated tests.

---

## 6. Release Lineage

- **Superseded Release**: `BARBEX-CANONICAL-20260908-cf75c2f9`
- **Reason**: Canonical FK inventory contained phantom constraints referencing non-existent columns.
- **New Release Candidate**: `BARBEX-CANONICAL-20260908-dfc59eea`
- **New Baseline SHA256**: `dfc59eeac080eb722f8e18c674e16654a73b842acdcbe28ab5ad9069d845b9f4`
- **New Verify SHA256**: `d35c1bdde80089f64a2ec1613556829c96d2e15ca8dc6bf30ab653bf63a8b496`
- **New Manifest SHA256**: `1e993af7e13697166710f1c0455d0bfffd4ad03f67f4c4229e50d654f990a113`
