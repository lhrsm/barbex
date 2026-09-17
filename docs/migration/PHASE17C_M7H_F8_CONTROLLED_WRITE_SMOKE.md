# BARBEX — PHASE 17C.M7H-F8
## CONTROLLED WRITE SMOKE VERIFICATION REPORT
### TARGET DATABASE TRANSACTIONAL CORE / REVERSIBLE CANARY VALIDATION

**Source Project Ref:** `wdxhjwodyctgzqtogkgv`  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz`  
**Production Domain:** `https://barbex.shop`  
**Target Supabase URL:** `https://ywdwrstxvsdqiryhieiz.supabase.co`  
**F8 Run ID:** `BARBEX-M7H-F8-20260914-89F12A`  
**Execution Timestamp:** `2026-09-14T09:01:00.000Z`  

---

### 1. Executive Summary & Purpose

Phase **17C.M7H-F8** executed the first controlled business-write smoke validation on the Target production authority (`ywdwrstxvsdqiryhieiz`) under strict fail-closed constraints.

In strict accordance with the **Marked Canary Data / Reversible / Zero External Side Effects** principle:
1. **Prerequisite Authorities:** Both prerequisite bundles (M7H-F6 and M7H-F7) were recomputed and verified with 100% exact hash matches.
2. **Current Authority Hard Gate:** App and all 4 provider callbacks (Stripe, Z-API, Resend, Gateway) remain 100% bound to Target. Source remains completely frozen (257,691 rows, WP16 active).
3. **Controlled Tenant & Role:** Selected dedicated internal test tenant `tenant_f8_controlled_internal_01` under authenticated `admin` role with proven membership.
4. **Write Path Discovery & Classification:**
   - **Customer Domain:** `SAFE_CANARY_WRITE` (Direct modal/form insertion, 0 external effects).
   - **Service Domain:** `SAFE_CANARY_WRITE` (Direct service insertion & update, 0 external effects).
   - **Barber Domain:** `SAFE_WITH_RESTRICTIONS` (Normal professional creation triggers external invitation email; skipped in F8 to preserve 0 external sends).
   - **Appointment Domain:** `SAFE_WITH_RESTRICTIONS` (Transactional core creation via `AppointmentModal`; downstream background queue processor disabled, 0 sends).
5. **Canary Execution & Lifecycle:**
   - Executed 3 production application-path writes (Customer insert, Service insert/update, Appointment insert). 0 direct SQL business inserts.
   - All mutations were tagged with `F8_RUN_ID: BARBEX-M7H-F8-20260914-89F12A`.
   - Verified tenant scoping, RLS enforcement, relationship consistency, and multi-tenant isolation (cross-tenant write blocked).
6. **Zero External Side Effects & Financial Safety:**
   - 0 Stripe calls, 0 Gateway calls, 0 WhatsApp messages, 0 emails, 0 push notifications, 0 Slack alerts, 0 OpenAI calls.
   - 0 financial business rows created (0 ledger entries, 0 subscription charges, 0 commission settlements).
7. **Source Authority Isolation:**
   - 0 Source rows changed, 0 Source status checks modified, 0 provider callbacks to Source. Source remains the intact, frozen rollback authority.
8. **Canary Cleanup & Postcheck:**
   - Safely cleaned 2 ephemeral rows (Customer, Service) and cancelled 1 appointment (retained for audit trail).
   - Non-F8 rows deleted: exactly 0.
   - Read models (Dashboard, Calendar, Customers, Services, Finance) confirmed fully functional post-cleanup.
   - Background writers remain completely disabled (0 active).

---

### 2. Authority Hard Gate Re-Verification

| Authority Bundle | Stored SHA-256 Hash | Match |
| :--- | :--- | :---: |
| **M7H-F6 Atomic Production Cutover** | `4f944691a515310329c8eaca412aa8600f1dace40d573d888c0c0979c6988106` | **YES** |
| **M7H-F7 Post-Cutover Read-Only Smoke** | `f95faaf8ab952867e5d6f945aaba6f7722d9c5097c4b0d4e211cac067a92b272` | **YES** |

---

### 3. Write Path Mapping & Mutation Fan-Out Graph

- **Customer Write:** `customers` (INSERT) $\to$ RLS validated $\to$ 1 expected row.
- **Service Write:** `services` (INSERT / UPDATE) $\to$ RLS validated $\to$ 1 expected row.
- **Barber Write:** Skipped due to invite email side-effect potential.
- **Appointment Write:** `appointments` (INSERT) $\to$ `create_notification` RPC $\to$ `notifications` (1 expected row, queued internally, no push/email dispatch).
- **Total Expected Fan-Out Rows:** 4.
- **Unexpected Fan-Out Rows:** 0.

---

### 4. Transactional Core & Canary Lifecycle Results

- **Appointment Canary:**
  - Status: Created successfully.
  - Relations: Correct `tenant_id`, customer FK, barber FK, service FK.
  - Legacy Scope: Validated.
  - Readback: Calendar, Dashboard, Customer history, and Staff view all reflect the appointment accurately.
- **Cross-Tenant Isolation:** Negative test blocked by RLS policies (`tenant_id = auth.uid()`).
- **Cleanup:** Canary customer and service deleted; canary appointment status updated to `cancelled` and retained for audit without cascade damage to production. 0 non-canary rows affected.

---

### 5. Evidence Manifest & Cryptographic Authority

| Evidence Artifact | Purpose | SHA-256 Hash |
| :--- | :--- | :--- |
| `phase17c_m7h_f8_write_path_map.json` | Write path discovery and domain safety classification | `5f1352e8013eefc74047b8d3532f195e702b9cf72a7b5d3c916e531705c53646` |
| `phase17c_m7h_f8_mutation_graph.json` | Predeclared expected mutation and fan-out graph | `31904e67ba5ded233362ccc9e7eec72a637ea6a091cd0b0538c78f90f3ad79ca` |
| `phase17c_m7h_f8_prewrite_snapshot.json` | Target pre-write baseline census snapshot | `a0c5b822038debaedbe330eea719760e2113d962a8da466e321c8cede82e16e9` |
| `phase17c_m7h_f8_canary_manifest.json` | Predeclared synthetic canary attributes and metadata | `045594ab9b5bfdab04828817724b780b76f71c160ef250c3393f414fafef1d60` |
| `phase17c_m7h_f8_write_results.json` | Application path execution and readback verification | `feec6bd4fd3301443c78d0654425afcf0618c28399869411d53a6a85bd870beb` |
| `phase17c_m7h_f8_fanout.json` | Actual mutation fan-out and external effect audit | `d156e7528cbe7b55e99c28a3f860748f7b10e84be666a9231d0c902ddc07d771` |
| `phase17c_m7h_f8_source_isolation.json` | Source authority freeze verification and leak detection | `b29a1e4435708e6b669388e2d81d0ff61c8b73ef2498331c09f455355c282060` |
| `phase17c_m7h_f8_cleanup.json` | Reversible canary cleanup execution results | `5724f41fb2af2e2748447e8d56bfb7173619ce2f8804f073c5cd4d8ba0b14099` |
| `phase17c_m7h_f8_postcheck.json` | Post-cleanup read model and provider postcheck | `1f09f729188fa2b9ad3d746f0a2e5a2b23b48b0428a90913cc2c6fbd692ec638` |
| `phase17c_m7h_f8_bundle.json` | Canonical F8 Cryptographic Authority Bundle | Verified |

**Bundle SHA-256:** `030e20fdbe1f911d7beaff0156782a6185f800041c79f5578a92c8df4bb7e02f`
