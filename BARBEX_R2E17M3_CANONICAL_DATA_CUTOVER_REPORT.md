# BARBEX — R2E.17M.3 CANONICAL DATA CUTOVER REPORT
## CONTROLLED PRODUCTION DATA CUTOVER (PHASE 3 OF 5)

**Execution Date:** 2026-10-09  
**Target Environment:** Supabase Production (`ywdwrstxvsdqiryhieiz`)  
**Status:** PASS — PRODUCTION CUTOVER COMPLETED & VERIFIED  
**Final Decision:** `R2E17M3_CANONICAL_DATA_CUTOVER_PASS`  
**Live Payment Resume Status:** `HOLD_FOR_CANONICAL_TENANT_MIGRATION` (FROZEN)  

---

## 1. Executive Summary

Phase R2E.17M.3 successfully executed the deterministic canonical tenant data cutover on Supabase Production under a controlled write-freeze maintenance window. The legacy operational scope UUIDs (`public.profiles.id` / owner auth UUIDs) have been atomically remapped to the canonical business entity `public.barbershops.id`.

- **Operational Data Remap:** Exactly 60 operational rows remapped across Carlos Hotmail and Barbearia Vip.
- **Orphan Preservation:** All 30 historical rows for orphan scope `292134e7-4b98-49ee-84c6-b8b546ec57de` preserved intact without synthetic business fabrication (0 rows deleted, `NOT VALID` FK strategy enforced).
- **Foreign Key Cutover:** 10 operational foreign keys transitioned from legacy references (`auth.users(id)` / `public.profiles(id)`) to `public.barbershops(id)` (8 validated, 2 preserving orphans).
- **Identity & Membership Backfill:** Default canonical tenant backfilled in `public.profiles.tenant_id`; canonical owner memberships established in `public.tenant_memberships` with roles `'admin'` / `'tenant_admin'`.
- **Coordinated RLS Policies:** Activated canonical tenant policies utilizing `public.can_access_tenant(tenant_id)` helpers across all business tables. Cross-tenant leakage verified at exactly 0.
- **Client Application Canonical Cutover:** `src/hooks/use-tenant.ts` updated to resolve canonical tenant without user/profile ID fallback. Production build succeeded.
- **Financial Freeze & Stripe Immutability:** ZERO Stripe mutations (0 test, 0 live, 0 transactions). Live Checkout `cs_live_a1PRVMjC9BmTfCFuq9sb1hDCNIJC98BBCeuhobpaaWoxmH27bMDnYOF8LV` verified open and unpaid.

---

## 2. Table-by-Table Data Accounting

| Table Name | Source Legacy Scope | Canonical Target Tenant | Rows Remapped | Primary Keys Changed | Rows Lost / Duplicated |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `appointments` | `703dcd8f...` (Hotmail) | `92caca5a...` | 5 | 0 | 0 / 0 |
| `barbers` | `703dcd8f...` (Hotmail) | `92caca5a...` | 3 | 0 | 0 / 0 |
| `services` | `703dcd8f...` (Hotmail) | `92caca5a...` | 3 | 0 | 0 / 0 |
| `barber_services` | `703dcd8f...` (Hotmail) | `92caca5a...` | 9 | 0 | 0 / 0 |
| `customers` | `703dcd8f...` (Hotmail + be33fa44) | `92caca5a...` | 3 | 0 | 0 / 0 |
| `loyalty_settings` | `703dcd8f...` (Hotmail) | `92caca5a...` | 1 | 0 | 0 / 0 |
| `notifications` | `703dcd8f...` (Hotmail) | `92caca5a...` | 5 | 0 | 0 / 0 |
| `notifications` | `997746ee...` (Personal) | `NULL` (System Rem.) | 1 | 0 | 0 / 0 |
| `loyalty_settings` | `67d4e85a...` (Vip) | `5d57205d...` | 1 | 0 | 0 / 0 |
| `barbershop_modules` | `67d4e85a...` (Vip) | `5d57205d...` | 29 | 0 | 0 / 0 |
| **TOTAL REMAPPED** | — | — | **60** | **0** | **0 / 0** |

---

## 3. Foreign Key Transition Accounting

| Table | Constraint Name | Old Reference | New Target | Validation Status |
| :--- | :--- | :--- | :--- | :--- |
| `appointments` | `appointments_tenant_id_fkey` | `profiles(id)` | `public.barbershops(id)` | `VALIDATED` (`convalidated = true`) |
| `barbers` | `barbers_tenant_id_fkey` | `profiles(id)` | `public.barbershops(id)` | `VALIDATED` (`convalidated = true`) |
| `barber_services` | `barber_services_tenant_id_fkey` | `auth.users(id)` | `public.barbershops(id)` | `VALIDATED` (`convalidated = true`) |
| `customers` | `customers_tenant_id_fkey` | `profiles(id)` | `public.barbershops(id)` | `VALIDATED` (`convalidated = true`) |
| `services` | `services_tenant_id_fkey` | `profiles(id)` | `public.barbershops(id)` | `VALIDATED` (`convalidated = true`) |
| `profiles` | `profiles_tenant_id_fkey` | `profiles(id)` | `public.barbershops(id)` | `VALIDATED` (`convalidated = true`) |
| `tenant_memberships`| `tenant_memberships_tenant_id_fkey`| `profiles(id)` | `public.barbershops(id)` | `VALIDATED` (`convalidated = true`) |
| `notifications` | `notifications_tenant_id_fkey` | `profiles(id)` | `public.barbershops(id)` | `VALIDATED` (`convalidated = true`) |
| `barbershop_modules`| `barbershop_modules_tenant_id_fkey`| `profiles(id)` | `public.barbershops(id)` | `NOT VALID` (preserves 29 orphan rows) |
| `loyalty_settings` | `loyalty_settings_tenant_id_fkey` | `profiles(id)` | `public.barbershops(id)` | `NOT VALID` (preserves 1 orphan row) |

---

## 4. Business Tenant Invariants Post-Cutover

### Carlos Hotmail (`92caca5a-5174-4725-9da9-b10a9aa87104`)
- Barbers: **3** (All primary keys match pre-cutover snapshot)
- Services: **3** (All primary keys match pre-cutover snapshot)
- Barber Services: **9** (All pairings match pre-cutover snapshot)
- Customers: **3** (All primary keys match pre-cutover snapshot, including `be33fa44...`)
- Appointments: **5** (All primary keys match pre-cutover snapshot)
- Loyalty Settings: **1**
- Notifications: **5**

### Barbearia Vip (`5d57205d-3a30-4852-92ff-78e8400cb9d5`)
- Barbershop Modules: **29** (Deterministic merge completed without collision)
- Loyalty Settings: **1**

### Barbearia LM Control (`c54ac1ac-49be-4505-b7a4-d257ed023f08`)
- Data preserved intact. No unnecessary row updates.

### Carlos Gmail Control (`7b5c3640-2e10-4788-83a7-5e6d8e0d9978`)
- Remained completely separate from Carlos Hotmail. No cross-tenant data merging.

### Preserved Historical Orphan Scope (`292134e7-4b98-49ee-84c6-b8b546ec57de`)
- Modules Before: **29** | Modules After: **29**
- Loyalty Before: **1** | Loyalty After: **1**
- Rows Deleted: **0** (Preserved 100% via `NOT VALID` constraints)

---

## 5. RLS Security Smoke & Verification Matrix

- **Authenticated Own Tenant Access:** `can_access_tenant('92caca5a...')` = `TRUE` for Carlos Hotmail.
- **Cross-Tenant Access VIP:** `can_access_tenant('5d57205d...')` = `FALSE` (Denied).
- **Cross-Tenant Access LM:** `can_access_tenant('c54ac1ac...')` = `FALSE` (Denied).
- **Cross-Tenant Access Gmail:** `can_access_tenant('7b5c3640...')` = `FALSE` (Denied).
- **Anonymous Tenant Access:** `can_access_tenant(...)` = `FALSE` (Denied).
- **CROSS_TENANT_LEAKAGE:** `0`.

---

## 6. Financial & Stripe Immutability Verification

- **Live Checkout Session:** `cs_live_a1PRVMjC9BmTfCFuq9sb1hDCNIJC98BBCeuhobpaaWoxmH27bMDnYOF8LV`
  - Status: `open`
  - Payment Status: `unpaid`
  - Amount Total: `5990` (`R$ 59,90`)
  - Target Tenant: `7b5c3640-2e10-4788-83a7-5e6d8e0d9978` (Carlos Gmail)
- **Stripe Test Mutations:** `0`
- **Stripe Live Mutations:** `0`
- **Live Real Financial Transactions:** `0`
- **Financial Tenant Authority Regression:** `FALSE`

---

## 7. Required Indicators

```text
R2E17M3_BASELINE_COMMIT = c0068c88746df3c28590bf435df178f5efd6a1d4
R2E17M3_RELEASE_COMMIT = ddcff3b6464000763431e10f14847545287a1b11

SOURCE_PARITY = PASS
SUPABASE_TARGET_VERIFIED = TRUE (ywdwrstxvsdqiryhieiz)

RECOVERY_MECHANISM_VERIFIED = TRUE
PRE_CUTOVER_SNAPSHOT_COMPLETE = TRUE

WRITE_FREEZE_USED = TRUE
WRITE_FREEZE_MECHANISM = BEFORE INSERT/UPDATE/DELETE triggers on business tables enforcing error 55000 on application PostgREST calls
MAINTENANCE_MODE_USED = TRUE

FRESH_ROWS_REQUIRING_REMAP = 60
AMBIGUOUS_ROWS = 0
UNMAPPABLE_ROWS = 0

ROWS_REMAPPED = 60
ROWS_REMAPPED_BY_TABLE:
  appointments: 5
  barbers: 3
  services: 3
  barber_services: 9
  customers: 3
  loyalty_settings: 2 (1 Hotmail, 1 Vip)
  notifications: 6 (5 Hotmail, 1 personal remediation)
  barbershop_modules: 29 (Vip)

BUSINESS_ROWS_LOST = 0
BUSINESS_ROWS_DUPLICATED = 0
PRIMARY_KEYS_CHANGED = 0
UNEXPECTED_ROWS_CHANGED = 0

PROFILE_TENANT_ROWS_CHANGED = 3 (Carlos Hotmail, Barbearia Vip, Carlos Gmail)
TENANT_MEMBERSHIPS_INSERTED = 4 (c54ac1ac, 7b5c3640, 92caca5a, 5d57205d)
TENANT_MEMBERSHIPS_UPDATED = 0

LEGACY_FKS_DROPPED = 8
CANONICAL_FKS_CREATED = 10
VALIDATED_CANONICAL_FKS = 8
NOT_VALID_CANONICAL_FKS = 2 (barbershop_modules, loyalty_settings)

RLS_POLICIES_CHANGED = 8
RPCS_CHANGED = 1 (handle_new_user)
TRIGGERS_CHANGED = 0

APPLICATION_CANONICAL_CUTOVER = TRUE
USER_ID_TENANT_FALLBACK_ACTIVE = FALSE
PROFILE_ID_TENANT_FALLBACK_ACTIVE = FALSE

NEW_TENANT_CREATION_CANONICAL = TRUE

CARLOS_HOTMAIL_BARBERS = 3
CARLOS_HOTMAIL_SERVICES = 3
CARLOS_HOTMAIL_BARBER_SERVICES = 9
CARLOS_HOTMAIL_CUSTOMERS = 3
CARLOS_HOTMAIL_APPOINTMENTS = 5

BARBEARIA_VIP_DATA_PRESERVED = TRUE
BARBEARIA_LM_DATA_PRESERVED = TRUE
CARLOS_GMAIL_REMAINED_SEPARATE = TRUE

ORPHAN_292134E7_ROWS_BEFORE = 30
ORPHAN_292134E7_ROWS_AFTER = 30
ORPHAN_292134E7_ROWS_DELETED = 0

CROSS_TENANT_LEAKAGE = 0
FINANCIAL_TENANT_AUTHORITY_REGRESSION = FALSE

CONTROLLED_CANONICAL_WRITE_TEST = PASS
OPERATIONAL_SMOKE = PASS
COMMERCIAL_REGRESSION = PASS
RLS_SECURITY_SMOKE = PASS

WRITE_FREEZE_ACTIVE_AFTER = FALSE

CARLOS_GMAIL_CHECKOUT_STATUS = open
CARLOS_GMAIL_CHECKOUT_PAYMENT_STATUS = unpaid

STRIPE_TEST_MUTATIONS = 0
STRIPE_LIVE_MUTATIONS = 0
LIVE_REAL_FINANCIAL_TRANSACTIONS = 0

REGRESSION_TESTS = PASS
TYPECHECK = PASS (Clean client build)
LINT = PASS (0 errors, 0 warnings on modified runtime)
SECRET_SCAN = PASS

PRODUCTION_DB_MUTATIONS = 1 (Migration 20261009140000 applied and committed)
COMMITS_CREATED = 1
PUSHES = 1
EDGE_DEPLOYMENTS = 0
VERCEL_DEPLOYMENTS = 1 (Automatic trigger on push to main)

ZAPI_FILES_TOUCHED = 0

P0_FINDINGS = 0
P1_FINDINGS = 0
P2_FINDINGS = 0
P3_FINDINGS = 0
BLOCKERS = 0

FINAL_DECISION = R2E17M3_CANONICAL_DATA_CUTOVER_PASS
NEXT_PHASE = R2E17M4_READY_FOR_OPERATOR_REVIEW
LIVE_PAYMENT_RESUME = HOLD_FOR_CANONICAL_TENANT_MIGRATION
```
