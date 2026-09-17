# BARBEX — PHASE 17C.M7H-F12
## SOURCE RETIREMENT PLANNING REPORT
### DEPENDENCY CLOSURE / BACKUP & RETENTION PLAN / ROLLBACK EXPIRATION / LOVABLE DECOUPLING

**Source Project Ref:** `wdxhjwodyctgzqtogkgv`  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz`  
**Production Domain:** `https://barbex.shop`  
**Execution Timestamp:** `2026-09-15T12:45:00.000Z`  

---

### 1. Executive Summary & Purpose

Phase **17C.M7H-F12** concludes the exhaustive, read-only architectural planning required before the legacy Lovable / Supabase Source project (`wdxhjwodyctgzqtogkgv`) can cease to serve as a rollback authority.

In strict compliance with the **Planning Only / Zero Mutation / No Decommission** contract:
1. **Prerequisite Authority Hard Gate:** All three prerequisite authority bundles (`M7H-F10B`, `M7H-F11.1`, and `M7H-F11.2`) were verified with 100% exact SHA-256 hash matches (`YES` / `YES` / `YES`).
2. **Current Production Authority:** Target maintains 100% operational authority across App, Database, Auth, Storage, Realtime, Edge Functions, all provider webhooks (Stripe, Z-API, Resend, Gateway), and all 6 background producers (`PRODUCTION_AUTHORITIES_ALL_TARGET: YES`).
3. **Source Isolation:** Source remains strictly frozen (`public_rows = 257691`, `status_checks = 256998`). WP16 hotfix remains permanently active. Source App, Provider, and Background traffic remain at exactly 0.
4. **Source Reference Scan:** Full repository scan for `wdxhjwodyctgzqtogkgv` detected 257 total matches:
   - `RUNTIME_ACTIVE`: **0**
   - `BUILD_ACTIVE`: **0**
   - `DEPLOY_ACTIVE`: **0**
   - `ROLLBACK_ONLY`: **1** (environment rollback template)
   - `DOCUMENTATION_EVIDENCE`: **256** (historical baseline, migration evidence, runbooks)
   - `UNRESOLVED`: **0**
5. **Lovable Dependency Audit:**
   - **Database, Auth, Storage, Edge Functions:** 100% independent of Lovable (`IS_BARBEX_DATABASE_INDEPENDENT_OF_LOVABLE: YES`).
   - **Hosting, Deployment Pipeline, Domain Binding:** The frontend application remains hosted on Cloudflare Pages/Workers via Lovable Cloud dashboard deployment (`https://lovable.dev/projects/8e95dc9e-ab64-44cf-956c-ecec6fefeb51`), using `@lovable.dev/vite-tanstack-config`, and `barbex.shop` custom domain SSL is routed through Lovable Cloud's Cloudflare setup.
   - **Verdict:** `BARBEX_FULLY_INDEPENDENT_OF_LOVABLE`: **`NO`**. `PRODUCTION_DEPLOYMENT_DEPENDS_ON_LOVABLE`: **`YES`**.
6. **Rollback Expiration & Data Divergence:** Target is live and accumulating production data (telemetry in `status_checks`, user sessions). Naive direct rollback to frozen Source is already lossy (`DIRECT_ROLLBACK_TO_FROZEN_SOURCE_CAUSES_DATA_LOSS: YES`). Rollback is time-bounded and will fully expire upon sealing the final verified Source archival checkpoint (F13).
7. **Source Deletion Eligibility:** `SOURCE_PROJECT_DELETION_ELIGIBLE_NOW`: **`NO`**. Source cannot be deleted until hosting/domain dependencies are uncoupled, final archival dumps are verified, and provider legacy webhooks are cleanly detached.
8. **Next Safe Retirement Level:** **`LEVEL_1_ONLY`** (`ARCHIVED_ROLLBACK_REFERENCE` via Phase 17C.F13).

---

### 2. Authority Gate Re-Verification

| Authority Bundle | Stored SHA-256 Hash | Match |
| :--- | :--- | :---: |
| **M7H-F10B Background Activation** | `3d919abc45d1c332c0a34c8826532b5665a538bfd34fd720115e023c0b249afa` | **YES** |
| **M7H-F11.1 Temporal Attestation** | `659e8318686477905ceac8f2d35162f568a8871c6403d4d08fe16aeac9b89829` | **YES** |
| **M7H-F11.2 Stabilization Completion** | `d4d41abbba9f2830ac54f13bcf0dfbf45c0495cb3eacbc87cd6634d40b7dd1cb` | **YES** |

---

### 3. Production Authority & Source Isolation

- **App Authority:** `Target` (`ywdwrstxvsdqiryhieiz`)
- **Database Authority:** `Target`
- **Auth Authority:** `Target`
- **Storage Authority:** `Target`
- **Realtime Authority:** `Target`
- **Edge Function Authority:** `Target`
- **Webhook Authorities:** `Target` (Stripe, Z-API, Resend, Multi-Gateway)
- **Background Producers:** `Target` (6 active producers)
- **Production Authorities All Target:** `YES`
- **Source Baseline:** `public_rows = 257691`, `status_checks = 256998`, max ID 256,998
- **Source WP16 Hotfix:** **STILL ACTIVE** (Permanently retained)
- **Source Traffic:** App = 0, Provider = 0, Background = 0
- **Source Freeze State:** **VALID**

---

### 4. Complete Source Reference Scan

| Reference Classification | Count | Status | Notes |
| :--- | :---: | :---: | :--- |
| **RUNTIME_ACTIVE** | 0 | PASS | Zero active calls to Source Supabase in `src/` or `supabase/functions/` |
| **BUILD_ACTIVE** | 0 | PASS | Zero build variables referencing Source project ref |
| **DEPLOY_ACTIVE** | 0 | PASS | Deployment pipeline targets Target environment |
| **ROLLBACK_ONLY** | 1 | PASS | Rollback environment matrix definition |
| **DOCUMENTATION_EVIDENCE** | 256 | PASS | Phase 17C audit logs, baseline SQL, forensic records |
| **UNRESOLVED** | 0 | PASS | Zero unclassified references |
| **Total Matches** | **257** | **PASS** | Repository is 100% cataloged |

---

### 5. Lovable Cloud Dependency & Hosting Forensic Audit

| Component | Platform Authority | Lovable Dependency | Retirement Impact | Decoupling Strategy |
| :--- | :--- | :---: | :--- | :--- |
| **Database** | Supabase Target | NO | None | Already 100% decoupled |
| **Auth** | Supabase Target | NO | None | Already 100% decoupled |
| **Storage** | Supabase Target | NO | None | Already 100% decoupled |
| **Edge Functions** | Supabase Target | NO | None | Already 100% decoupled |
| **Frontend Code** | GitHub (`lhrsm/barbex`) | NO | None | Direct Git authority |
| **Build Configuration** | Vite / TanStack Start | **YES** | Low | `@lovable.dev/vite-tanstack-config` in `devDependencies` |
| **Hosting & Deploy** | Cloudflare Pages via Lovable | **YES** | High | Deployment triggered via Lovable UI; deleting Lovable drops hosting |
| **Custom Domain & SSL** | Cloudflare Universal SSL | **YES** | Critical | `barbex.shop` routed through Lovable Cloudflare zone |

- `IS_BARBEX_HOSTING_INDEPENDENT_OF_LOVABLE`: **NO**
- `IS_BARBEX_DEPLOYMENT_PIPELINE_INDEPENDENT_OF_LOVABLE`: **NO**
- `IS_BARBEX_DOMAIN_ROUTING_INDEPENDENT_OF_LOVABLE`: **NO**
- `BARBEX_FULLY_INDEPENDENT_OF_LOVABLE`: **NO**
- `PRODUCTION_DEPLOYMENT_DEPENDS_ON_LOVABLE`: **YES**

---

### 6. Provider Legacy Configuration & Rollback State

| Provider | Target State | Source State | Retained for Rollback | Retained for Audit |
| :--- | :---: | :---: | :---: | :---: |
| **Stripe** | Active | Inactive | YES | YES |
| **Z-API** | Active | Inactive | YES | YES |
| **Resend** | Active | Inactive | YES | YES |
| **Gateway** | Active | Inactive | YES | YES |

---

### 7. Final Source & Target Backup Specifications

Future retirement execution (Phase 17C.F13) requires capturing immutable, checksum-verified artifacts before any detachment:
1. `FINAL_SOURCE_DATABASE_BACKUP_REQUIRED`: **YES** (`pg_dump` of Source public schema and physical data).
2. `FINAL_SOURCE_AUTH_BACKUP_REQUIRED`: **YES** (10 users, 12 identities, encrypted passwords export).
3. `FINAL_SOURCE_STORAGE_BACKUP_REQUIRED`: **YES** (Bucket manifests and object metadata).
4. `FINAL_SOURCE_CONFIG_BACKUP_REQUIRED`: **YES** (All 202 functions, 394 policies, extensions catalog).
5. `FINAL_SOURCE_EDGE_BACKUP_REQUIRED`: **YES** (Legacy edge function code snapshot).
6. `FINAL_PROVIDER_CONFIG_BACKUP_REQUIRED`: **YES** (Endpoint mapping and webhook signing IDs).
7. `FINAL_MIGRATION_EVIDENCE_ARCHIVE_REQUIRED`: **YES** (Complete `docs/migration/evidence` bundle).
8. `TARGET_PRE_RETIREMENT_CHECKPOINT_REQUIRED`: **YES** (Clean post-stabilization checkpoint of Target database).
9. Verification standard: SHA-256 manifest, file sizes, exact row/object counts, and restore dry-validation.

---

### 8. Rollback Model & Data Divergence

- **Current Classification:** `TIME_BOUNDED`.
- **Target Accumulation:** Target is actively accumulating telemetry rows (1,624+ in `status_checks`), user sessions, and customer transactions.
- **Naive Rollback Risk:** `DIRECT_ROLLBACK_TO_FROZEN_SOURCE_CAUSES_DATA_LOSS: YES`. A naive DNS/env revert to frozen Source would drop all events generated since cutover.
- **Data Reconciliation Scope:** Rollback requires forward data reconciliation of `status_checks`, customer profiles, and provider webhooks.
- **Rollback Expiration Criteria:** Rollback authority ceases once the F13 archival snapshot is sealed and verified, and the formal detachment phase (F14) commences.

---

### 9. WP16 Retirement Analysis

- WP16 hotfix prevents the legacy edge status check writer on Lovable Cloud from spamming Source `status_checks`.
- **Classification:** `KEEP_UNTIL_SOURCE_DISABLED`.
- **Preconditions for Removal:** Removing or reverting WP16 on Source would reactivate rogue telemetry writes. WP16 must remain active indefinitely until the Source database is permanently paused and disabled.

---

### 10. Staged Retirement Levels & Action DAG

| Level | State Name | Description | Status |
| :---: | :--- | :--- | :---: |
| **0** | `FROZEN_ROLLBACK_AUTHORITY` | Source frozen, WP16 active, rollback-ready | **CURRENT** |
| **1** | `ARCHIVED_ROLLBACK_REFERENCE` | Checkpoint backups verified and sealed | **NEXT SAFE LEVEL** |
| **2** | `PROVIDER_DETACHED_SOURCE` | Legacy provider webhooks deleted from Stripe/Z-API/Resend | Future |
| **3** | `HOSTING_DETACHED_SOURCE` | Direct Cloudflare/Vercel hosting migration (if decoupling Lovable) | Future |
| **4** | `SOURCE_PROJECT_DISABLED_OR_ARCHIVED` | Source Supabase project paused in cloud console | Future |
| **5** | `SOURCE_PROJECT_DELETION_ELIGIBLE` | Final project deletion | Blocked |

- **Retirement DAG:** 8 Nodes, 9 Edges, **0 Cycles**.
- **Irreversible Actions:** 2 (`ACT-F14-01`: Provider Webhook Deletion; `ACT-F16-01`: Source Project Disablement) with separate mandatory Hold Points (`HP-IRR-01`, `HP-IRR-02`).
- **Deletion Blockers:** Hosting/SSL bound to Lovable Cloud; archival checkpoint not yet captured; provider legacy endpoints retained.

---

### 11. Proposed Future Retirement Phases

1. **Phase 17C.F13: Final Backup & Archival Checkpoint** (Capture verified Source & Target dumps, generate SHA-256 manifest).
2. **Phase 17C.F14: Reversible Source Webhook & Secret Detachment** (Deregister legacy endpoints in external providers).
3. **Phase 17C.F15: Post-Detachment Quiet Window** (Verify zero incoming traffic to legacy endpoints).
4. **Phase 17C.F16: Source Project Pausing & Final Decommission** (Pause Source Supabase project; preserve permanent archive).

---

### 12. Evidence Manifest & Cryptographic Authority Bundle

| Evidence Artifact | Purpose | SHA-256 Hash |
| :--- | :--- | :--- |
| `phase17c_m7h_f12_source_reference_scan.json` | Repository-wide Source project ref scan & classification | `285e6c1a3b988065f3565b26e2de4acd8aed337f3b9b147e982d55fbc8e1eb68` |
| `phase17c_m7h_f12_lovable_dependencies.json` | Detailed Lovable Cloud build, hosting & domain dependency audit | `cc4e86004aa3e98330898ee3a6b98e04aa47e1b9de5db2561d7ef1d921fc5e51` |
| `phase17c_m7h_f12_hosting_domain.json` | Hosting, deployment, SSL, and domain authority topology | `49e49cac4f6f224f749e28893bc1004880f0bbfaff1bb35d89fca2a408d8e608` |
| `phase17c_m7h_f12_provider_legacy.json` | Provider legacy endpoint status and audit retention mapping | `7189d8337022c6bc638069fac6139eee3213ba7ee6f83a6a7b12b756ac5c97da` |
| `phase17c_m7h_f12_backup_requirements.json` | Final Source and Target archival backup specifications | `caebd9dbaa126907f4614dbba47c7142c4a49018998dd357749f7f89af6c3198` |
| `phase17c_m7h_f12_retention_classification.json` | Data and evidence retention classification matrix | `683d8832e28ee25d63ca814af918609204d48fbbfb1185b9adea3c91ae820005` |
| `phase17c_m7h_f12_secrets_inventory.json` | Secret identities and post-retirement rotation mapping | `5f479b5901616e5fed3716071c815aa5842dd9b2fe74f765a997487380bc8f4f` |
| `phase17c_m7h_f12_rollback_model.json` | Rollback divergence, expiration criteria, and WP16 policy | `40ea9565567763a173a8393e4261850f0fbf05ff197633670f70c2936ba7081e` |
| `phase17c_m7h_f12_retirement_levels.json` | 6 staged retirement levels and next safe execution level | `4bd58eda7143f358ba88296948f923f3aa53ae3e49ba03b8ac81da31f5b37eef` |
| `phase17c_m7h_f12_retirement_actions.json` | Complete inventory of 8 future deterministic retirement actions | `74839e3784baf188a5352cfafab5e517bd454bc56246cd0ea00e7109cfc58d1a` |
| `phase17c_m7h_f12_retirement_dag.json` | Dependency DAG (8 nodes, 9 edges, 0 cycles, 2 hold points) | `312d17367761cec414b3c911c40cb78e3920de8c5f421ca506f2bf41743a3ea3` |
| `phase17c_m7h_f12_independence_verdict.json` | Lovable independence verdict, blockers, and phase roadmap | `61b443eab42390a2526d2ff588c38144e00473c9432e8643e8294b5304978a63` |
| `phase17c_m7h_f12_bundle.json` | Canonical F12 Cryptographic Authority Bundle | Verified |

**Bundle SHA-256:** `b555f8bd7604612208fa2adb7f3f986866b6e0a87fa33e233c4723cfec495172`
