# BARBEX — R2E.17M.2 DUAL-COMPATIBLE RUNTIME LAYER REPORT
## Canonical Tenant Migration — Phase 2 of 5
**Stage:** R2E.17M.2  
**Supabase Production Target:** `ywdwrstxvsdqiryhieiz`  
**Execution Timestamp:** 2026-10-09T10:01:00-03:00  
**Baseline Commit:** `3e15c9cc17954717464ca34297c9e5be221c4391`  
**Decision:** `R2E17M2_DATABASE_LAYER_ONLY_PASS`  
**Live Payment Status:** `HOLD_FOR_CANONICAL_TENANT_MIGRATION`

---

## 1. Executive Summary & Authorization Boundary

Phase R2E.17M.2 establishes the **deterministic runtime translation/compatibility layer** between:
1. **Canonical Business Tenant:** `public.barbershops.id`
2. **Legacy Operational Scope:** `public.barbershops.owner_id` / `public.profiles.id` (historical owner scope)

This translation layer operates without changing any physical operational `tenant_id` data values, without altering any of the 422 existing RLS policies, without dropping legacy foreign keys, and without activating canonical foreign keys on operational tables.

In accordance with Sections 10, 11, and 21 of the specification:
- Production operational tables (`barbers`, `services`, `customers`, `appointments`, `barbershop_modules`, `loyalty_settings`) physically retain V1 scope (`profiles.id`).
- Prematurely switching client-side operational queries to `barbershops.id` would cause split-tenant operational queries (e.g., Carlos Hotmail) to return 0 records and new inserts to fail with foreign key violations.
- Therefore, the database compatibility translation layer was successfully deployed to production, while frontend application deployment remains deferred to subsequent migration phases (`R2E17M2_DATABASE_LAYER_ONLY_PASS`).

---

## 2. Preflight Audit & Financial Freeze Verification

| Check Item | Target Requirement | Production Verified State | Status |
|---|---|---|---|
| Git HEAD Baseline | `3e15c9cc17954717464ca34297c9e5be221c4391` | `3e15c9cc17954717464ca34297c9e5be221c4391` | PASS |
| Phase 17M.1 Migration | `20261009121500_r2e17m1_canonical_tenant_compatibility_foundation` | Applied & active | PASS |
| Phase 1 Canonical Helpers | 5 helpers exist (`is_tenant_owner`, `is_active_tenant_member`, `has_tenant_role`, `can_access_tenant`, `get_my_canonical_tenant_id`) | All 5 present (`SECURITY DEFINER`, `STABLE`, `search_path=public, pg_temp`) | PASS |
| Legacy `get_my_tenant_id()` | Intact, unaltered for V1 runtime | Unaltered (`SELECT tenant_id FROM profiles...`) | PASS |
| RLS Policy Count | Unchanged since 17M.1 | 422 policies total | PASS |
| Legacy Foreign Keys | Intact, 0 dropped | All legacy FKs intact | PASS |
| Carlos Hotmail Operational Counts | Barbers: 3, Services: 3, Barber-Services: 9, Appointments: 5 | Exact match: 3, 3, 9, 5 | PASS |
| Live Stripe Checkout Session | `cs_live_a1PRVMjC9BmTfCFuq9sb1hDCNIJC98BBCeuhobpaaWoxmH27bMDnYOF8LV` | `status = open`, `payment_status = unpaid` | PASS |
| Stripe Financial Mutations | Zero mutations | 0 test, 0 live mutations, 0 financial transactions | PASS |

---

## 3. Translation Source of Truth & Relational Contract

The deterministic translation contract leverages relational ownership stored in `public.barbershops`:
- **Canonical Business Tenant:** `public.barbershops.id`
- **Legacy Operational Scope:** `public.barbershops.owner_id`

### Control Tenants Audit Matrix

| Barbershop Name | Canonical Tenant ID (`barbershops.id`) | Legacy Operational Scope (`barbershops.owner_id`) | Tenant Model | Round-Trip Status |
|---|---|---|---|---|
| **Barbearia LM** | `c54ac1ac-49be-4505-b7a4-d257ed023f08` | `c54ac1ac-49be-4505-b7a4-d257ed023f08` | Aligned | Deterministic PASS |
| **Barber Shop Carlos (Gmail)** | `7b5c3640-2e10-4788-83a7-5e6d8e0d9978` | `7b5c3640-2e10-4788-83a7-5e6d8e0d9978` | Aligned | Deterministic PASS |
| **Carlos Barber Shop (Hotmail)** | `92caca5a-5174-4725-9da9-b10a9aa87104` | `703dcd8f-0077-4a57-8728-be05f654bd5b` | Split | Deterministic PASS |
| **Carlos Barber (Barbearia Vip)** | `5d57205d-3a30-4852-92ff-78e8400cb9d5` | `67d4e85a-3ed5-4109-9c9b-b83622331286` | Split | Deterministic PASS |

---

## 4. Deployed Database Compatibility Layer

Migration applied: `supabase/migrations/20261009130000_r2e17m2_dual_compatible_tenant_runtime.sql`

### 1. `canonical_tenant_to_operational_scope(p_canonical_tenant_id uuid)`
- **Behavior:** Translates canonical barbershop ID to legacy operational scope ID (`b.owner_id`).
- **Authorization Guard:** Caller must be `service_role`, direct maintenance session, or pass `public.can_access_tenant(b.id)`.
- **Synonym/Alias:** `canonical_tenant_to_legacy_scope(uuid)`.

### 2. `operational_scope_to_canonical_tenant(p_operational_scope_id uuid)`
- **Behavior:** Translates legacy operational scope ID to canonical barbershop ID (`b.id`).
- **Authorization Guard:** Caller must be `service_role`, direct maintenance session, or pass `public.can_access_tenant(b.id)`.
- **Synonym/Alias:** `legacy_scope_to_canonical_tenant(uuid)`.

### 3. `resolve_operational_scope(p_id uuid)`
- **Behavior:** Accepts either canonical barbershop ID or legacy operational scope ID and returns the active physical operational scope required for V1 queries.
- **Authorization Guard:** Caller must be `service_role`, direct maintenance session, or pass `public.can_access_tenant(b.id)`.

---

## 5. Security & Isolation Matrix

| Caller Context | Tested Action | Expected Result | Actual Result | Verification |
|---|---|---|---|---|
| **Anonymous (`anon`)** | Canonical $\to$ Operational | `NULL` | `NULL` | PASS — No enumeration |
| **Anonymous (`anon`)** | Operational $\to$ Canonical | `NULL` | `NULL` | PASS — No enumeration |
| **Anonymous (`anon`)** | Resolve Operational Scope | `NULL` | `NULL` | PASS — No enumeration |
| **Owner A (Carlos Gmail)** | Own Canonical $\to$ Own Operational | `7b5c3640...` | `7b5c3640...` | PASS — Authorized |
| **Owner A (Carlos Gmail)** | Tenant B Canonical $\to$ Operational | `NULL` | `NULL` | PASS — Cross-tenant blocked |
| **Owner A (Carlos Gmail)** | Tenant B Operational $\to$ Canonical | `NULL` | `NULL` | PASS — Cross-tenant blocked |
| **Staff Member (LM Reception)** | LM Canonical $\to$ LM Operational | `c54ac1ac...` | `c54ac1ac...` | PASS — Member authorized |
| **Staff Member (LM Reception)** | Hotmail Canonical $\to$ Operational | `NULL` | `NULL` | PASS — Cross-tenant blocked |
| **Orphan Scope (`292134e7...`)** | Translate to Canonical | `NULL` | `NULL` | PASS — No fake business |
| **Personal Scope (`997746ee...`)** | Translate to Canonical | `NULL` | `NULL` | PASS — Personal isolated |
| **Unknown UUID (`00000000...`)** | Translate to Canonical | `NULL` | `NULL` | PASS — Safe fallback |
| **NULL UUID** | Translate to Canonical | `NULL` | `NULL` | PASS — Safe fallback |

**Cross-Tenant Translation Leakage:** `0`

---

## 6. Registration & Future Tenants Compatibility

Inspection of production trigger function `public.handle_new_user()` confirms:
- When a new business owner registers (`role IN ('tenant_admin', 'admin', 'super_admin')`), `profiles` is inserted with `id = new.id`, and `barbershops` is created with `owner_id = new.id`.
- Operational tables populated under V1 write `tenant_id = new.id`.
- The translation layer automatically resolves:
  - `canonical_tenant_to_operational_scope(barbershops.id)` $\to$ `new.id`
  - `operational_scope_to_canonical_tenant(new.id)` $\to$ `barbershops.id`
- **Result:** `NEW_TENANT_CREATED_DURING_17M2_TRANSLATABLE = TRUE`. Registration does NOT require a freeze during Phase 17M.2.

---

## 7. Data Immutability & Operational Safety

| Entity | Baseline Count | Post-17M.2 Count | Delta |
|---|---|---|---|
| `public.barbers` | 8 | 8 | 0 |
| `public.services` | 8 | 8 | 0 |
| `public.barber_services` | 22 | 22 | 0 |
| `public.customers` | 12 | 12 | 0 |
| `public.appointments` | 80 | 80 | 0 |
| `public.barbershop_modules` | 131 | 131 | 0 |
| `public.loyalty_settings` | 5 | 5 | 0 |
| `public.profiles` tenant references | Unchanged | Unchanged | 0 |
| `public.tenant_memberships` | 2 | 2 | 0 |
| Historical Orphan Rows (`292134e7...`) | 30 | 30 | 0 |
| Carlos Hotmail Operational Rows | 22 | 22 | 0 |
| Legacy Foreign Keys Dropped | 0 | 0 | 0 |
| Canonical Operational FKs Activated | 0 | 0 | 0 |
| RLS Policies Changed/Removed | 0 | 0 | 0 |

---

## 8. Required Indicators

```ini
R2E17M2_BASELINE_COMMIT=3e15c9cc17954717464ca34297c9e5be221c4391
R2E17M2_RELEASE_COMMIT=6c7dc0ffdfadeac1dbd51f3b3ae31c10602315e3
SUPABASE_TARGET_VERIFIED=ywdwrstxvsdqiryhieiz
MIGRATION_VERSION=20261009130000

CANONICAL_TO_OPERATIONAL_HELPER=canonical_tenant_to_operational_scope(uuid)
OPERATIONAL_TO_CANONICAL_HELPER=operational_scope_to_canonical_tenant(uuid)

ACTIVE_BARBERSHOPS_TRANSLATABLE=4/4
ROUND_TRIP_FAILURES=0
AMBIGUOUS_TRANSLATIONS=0
UNKNOWN_SCOPE_TRANSLATIONS=0

ORPHAN_292134E7_CANONICAL_RESULT=NULL
PERSONAL_997746EE_CANONICAL_RESULT=NULL

DUAL_RUNTIME_CONTRACT_IMPLEMENTED=TRUE
CANONICAL_TENANT_ID_EXPOSED=TRUE
OPERATIONAL_SCOPE_ID_EXPOSED=TRUE

EXISTING_RLS_POLICIES_REMOVED=0
RLS_POLICIES_CHANGED=0

CANONICAL_ID_WRITTEN_INTO_LEGACY_FK_TABLES=FALSE
FINANCIAL_USES_OPERATIONAL_SCOPE=FALSE

NEW_TENANT_CREATED_DURING_17M2_TRANSLATABLE=TRUE

TENANT_SCOPE_ROWS_REMAPPED=0
BARBERS_CHANGED=0
SERVICES_CHANGED=0
BARBER_SERVICES_CHANGED=0
CUSTOMERS_CHANGED=0
APPOINTMENTS_CHANGED=0

PROFILE_TENANT_ROWS_CHANGED=0
TENANT_MEMBERSHIPS_CHANGED=0
ORPHAN_ROWS_CHANGED=0

LEGACY_FKS_DROPPED=0
CANONICAL_OPERATIONAL_FKS_ACTIVATED=0

CARLOS_HOTMAIL_CANONICAL_TENANT=92caca5a-5174-4725-9da9-b10a9aa87104
CARLOS_HOTMAIL_OPERATIONAL_SCOPE=703dcd8f-0077-4a57-8728-be05f654bd5b
CARLOS_HOTMAIL_BARBERS=3
CARLOS_HOTMAIL_SERVICES=3
CARLOS_HOTMAIL_BARBER_SERVICES=9
CARLOS_HOTMAIL_CUSTOMERS=3
CARLOS_HOTMAIL_APPOINTMENTS=5

CROSS_TENANT_TRANSLATION_LEAKAGE=0
FINANCIAL_TENANT_AUTHORITY_REGRESSION=0

CARLOS_GMAIL_CHECKOUT_STATUS=open
CARLOS_GMAIL_CHECKOUT_PAYMENT_STATUS=unpaid

STRIPE_TEST_MUTATIONS=0
STRIPE_LIVE_MUTATIONS=0
LIVE_REAL_FINANCIAL_TRANSACTIONS=0

REGRESSION_TESTS=PASS
TYPECHECK=PASS
LINT=PASS
SECRET_SCAN=PASS

PRODUCTION_DB_MUTATIONS=1 (additive translation helpers migration only)
COMMITS_CREATED=1
PUSHES=1
EDGE_DEPLOYMENTS=0
VERCEL_DEPLOYMENTS=0

ZAPI_FILES_TOUCHED=0

P0_FINDINGS=0
P1_FINDINGS=0
P2_FINDINGS=0
P3_FINDINGS=0
BLOCKERS=0
```

---

## 9. Next Phase Readiness & Final Decision

### Next Phase Recommendation
`R2E17M3_READY_FOR_OPERATOR_REVIEW`

*(Note: This recommendation does NOT authorize execution of Phase R2E.17M.3).*

### Live Payment Boundary
`LIVE_PAYMENT_RESUME = HOLD_FOR_CANONICAL_TENANT_MIGRATION`

### Final Decision
`R2E17M2_DATABASE_LAYER_ONLY_PASS`

---

## 10. Mandatory Stop Notice

All Phase R2E.17M.2 objectives have been completed under authorized boundaries. Execution is stopped.
- ZERO rows remapped.
- ZERO legacy foreign keys dropped.
- ZERO canonical operational foreign keys activated.
- ZERO RLS policy cutovers performed.
- ZERO Stripe mutations performed.
- Production awaits operator review before Phase R2E.17M.3.
