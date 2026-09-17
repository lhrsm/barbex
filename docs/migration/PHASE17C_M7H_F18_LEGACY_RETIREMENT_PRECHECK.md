# BARBEX — PHASE 17C.M7H-F18
## LEGACY RETIREMENT & REPOSITORY CONSOLIDATION PRECHECK
### READ-ONLY / NO RETIREMENT / NO COMMIT / NO PUSH

---

## 1. EXECUTIVE SUMMARY & AUTHORITY CONTEXT

| Parameter | Specification | Physical Observation |
|---|---|---|
| **Phase** | `PHASE 17C.M7H-F18` | `PHASE 17C.M7H-F18` |
| **Prior F17 Authority SHA256** | `ac425496d2e44b368bba069a35f356aa377cd19954ef83e866631c98414a7e86` | Exact Match (`F18_F17_HASH_MATCH = YES`) |
| **Production Apex Domain** | `https://barbex.shop` | Active, 100% Vercel authority over Let's Encrypt TLS |
| **Production WWW Domain** | `https://www.barbex.shop` | Active, 100% Vercel authority over Let's Encrypt TLS |
| **Hosting Authority** | Vercel (`prj_2b76k2ZxrCpMBO6wApCzUEFQL8AB`) | Verified singleton production binding |
| **Backend Authority** | Target Supabase (`ywdwrstxvsdqiryhieiz`) | 100% Active (DB, Auth, Storage, Realtime, Edge) |
| **Source Authority** | Source Supabase (`wdxhjwodyctgzqtogkgv`) | 100% Frozen Archival (257,691 rows, WP16 active, 0 calls) |
| **Worktree Changed Tracked Files** | `git diff --name-status HEAD` | 54 modified files |
| **Worktree Untracked Files** | `git ls-files --others --exclude-standard` | 691 files (runtime adapters, migrations, evidence) |
| **Secret Material in Candidates** | Secret regex scan across all candidates | **0 secrets detected** |
| **GitHub Remote Parity** | `lhrsm/barbex` (`main`) | In sync at commit `350be6e5` (0 ahead, 0 behind) |
| **Production Deployment Source** | Vercel deployment `dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3` | CLI Prebuilt from local worktree |
| **Reproducibility from GitHub** | Clean clone of remote `origin/main` | **Cannot reproduce yet** (uncommitted runtime adapters) |
| **Final Decision** | CASE A — Ready for Consolidation | `F18_PRECHECK_PASS_REPOSITORY_CONSOLIDATION_REQUIRED_BEFORE_RETIREMENT` |

---

## 2. F17 AUTHORITY HASH RECOMPUTATION

```
Expected F17 SHA256: ac425496d2e44b368bba069a35f356aa377cd19954ef83e866631c98414a7e86
Computed F17 SHA256: ac425496d2e44b368bba069a35f356aa377cd19954ef83e866631c98414a7e86
F18_F17_HASH_MATCH:  YES
```

---

## 3. CURRENT PRODUCTION AUTHORITY RECONFIRMATION

- DNS Apex: `76.76.21.21` (Vercel Anycast IP)
- HTTPS Status: `200 OK`
- Server Header: `Vercel`
- Backend Reference: Target Supabase (`ywdwrstxvsdqiryhieiz`)
- Source Supabase Calls: `0`

```
F18_PRODUCTION_DNS_AUTHORITY:     VERCEL
F18_PRODUCTION_HOSTING_AUTHORITY: VERCEL
F18_PRODUCTION_BACKEND_AUTHORITY: TARGET_SUPABASE
F18_PRODUCTION_TLS_PASS:          YES
F18_SOURCE_PRODUCTION_CALLS:      0
```

---

## 4. LOCAL WORKTREE FORENSIC INVENTORY

A complete forensic census was conducted across the local worktree:
- **Changed Tracked Files**: 54 files
- **Untracked Files**: 691 files
- **Staged Files**: 0 files

### Categorization:
1. **REQUIRED_RUNTIME_MIGRATION** (67 files):
   - Decoupled backend adapters: `src/lib/backend/client/*`, `src/lib/backend/edge/*`, `src/lib/backend/rpc/*`, `src/lib/backend/edge-client.ts`, `src/lib/backend/quick-wins.ts`.
   - Frontend route integrations: `src/routes/invite.$token.tsx`, `src/routes/admin.observability.tsx`, `src/components/security/MFASettings.tsx`, etc.
2. **REQUIRED_VERCEL_CONFIGURATION**:
   - `vite.config.ts` (decoupled Nitro/Vercel SSR & bundling configuration).
   - `.gitignore` (covers `.migration-secrets/`, `.vercel/`, `.env*`).
3. **REQUIRED_SUPABASE_MIGRATION**:
   - Migration SQL files in `supabase/migrations/` (20260904* series).
   - Edge function code in `supabase/functions/` (19 Edge Functions).
4. **MIGRATION_EVIDENCE_DOCUMENTATION** (412 files):
   - Documentation and forensics in `docs/migration/evidence/*`, `docs/migration/*.md`, `docs/recovery/*`.
5. **TEMPORARY_MIGRATION_ARTIFACT**:
   - Diagnostic scripts: `test_tut_parse.ts`, `test_limit.ts`, `scratch_last_prompt.json`, `transcript_tail.txt`.
6. **SECRET_OR_SENSITIVE_FILE**:
   - `.env` (contains only public anon/publishable keys; should be untracked from Git via `git rm --cached .env`).

```
F18_CHANGED_TRACKED_FILES:         54
F18_UNTRACKED_FILES:               691
F18_STAGED_FILES:                  0
F18_SECRET_FILES_DETECTED:         1 (.env - public keys only)
F18_UNKNOWN_FILES:                 0
F18_RUNTIME_FILES_PENDING_COMMIT:  67
F18_EVIDENCE_FILES_PENDING_COMMIT: 412
```

---

## 5. SECRET HYGIENE PRECHECK

- **Regex Patterns Checked**: `service_role`, `sbp_tokens`, `sk_live_stripe`, `resend_api_keys`, database connection strings with passwords.
- **Results in Commit Candidates**: 0 secrets detected.
- **`.env` Audit**: Contains only `VITE_SUPABASE_ANON_KEY` and Stripe publishable key `pk_live_...`. No private or service role keys.
- **Recommendation**: Untrack `.env` from Git index during repository consolidation (`git rm --cached .env`) so `.gitignore` rules prevent future tracking.

```
F18_SECRET_MATERIAL_IN_COMMIT_CANDIDATES: 0
F18_GITIGNORE_SECRET_COVERAGE_PASS:       YES
F18_SECRET_ROTATION_REQUIRED:             NO
```

---

## 6. GITHUB REPOSITORY PARITY & VERCEL DEPLOYMENT SOURCE

### 6.1 Git Parity
- Local branch: `main`
- Local HEAD: `350be6e5c1a3e64ad4af210c91db17c98e21525d`
- Remote `origin/main` HEAD: `350be6e5c1a3e64ad4af210c91db17c98e21525d`
- Commits Ahead: 0
- Commits Behind: 0
- Status: **IN_SYNC**

### 6.2 Vercel Deployment Source
- Active Production Deployment ID: `dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3`
- Created: `Wed Sep 16 2026 06:23:43 GMT-0300`
- Source: `VERCEL_CLI_PREBUILT`
- Production Matches GitHub Main: **NO** (Active deployment contains local prebuilt migration configuration not yet committed to GitHub).

```
F18_LOCAL_BRANCH:                         main
F18_LOCAL_HEAD:                           350be6e5c1a3e64ad4af210c91db17c98e21525d
F18_ORIGIN_MAIN_HEAD:                     350be6e5c1a3e64ad4af210c91db17c98e21525d
F18_COMMITS_AHEAD:                        0
F18_COMMITS_BEHIND:                       0
F18_REPOSITORY_PARITY_STATUS:             IN_SYNC
F18_CURRENT_PRODUCTION_DEPLOYMENT_ID:     dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3
F18_CURRENT_PRODUCTION_DEPLOYMENT_SOURCE: VERCEL_CLI_PREBUILT
F18_CURRENT_PRODUCTION_GIT_SHA:           NONE
F18_PRODUCTION_MATCHES_GITHUB_MAIN:       NO
```

---

## 7. REPRODUCIBILITY GATE

Because production `dpl_9YX9oGXo9dNv2dJ9owUTzkqqC9h3` was deployed from the local prebuilt workspace containing the decoupled backend adapters (`src/lib/backend/client/*`, `src/lib/backend/edge/*`, etc.) and updated `vite.config.ts`, a fresh checkout of `lhrsm/barbex main` **cannot currently reproduce the production build**:

```
F18_GITHUB_MAIN_CAN_REPRODUCE_CURRENT_PRODUCTION: NO
F18_MISSING_FILES_FROM_GITHUB_MAIN: [
  "src/lib/backend/client/*",
  "src/lib/backend/edge/*",
  "src/lib/backend/rpc/*",
  "src/lib/backend/edge-client.ts",
  "supabase/functions/*",
  "modified vite.config.ts"
]
F18_PRODUCTION_ONLY_LOCAL_CHANGES: 89
F18_REPRODUCIBILITY_PASS:          NO
```

> [!IMPORTANT]
> **GATE TRIGGER**: Because GitHub `main` cannot reproduce the current production deployment, **legacy retirement must not proceed until repository consolidation is executed and verified via CI/CD**.

---

## 8. LOVABLE & SOURCE DEPENDENCY AUDIT

### 8.1 Lovable Frontend
- Active production dependencies: **0**
- Rollback-only dependencies: **1** (Project `8e95dc9e-ab64-44cf-956c-ecec6fefeb51` retained)
- Documentation references: **35**
- Unknown references: **0**
- Retirement technically eligible: **YES** (post-consolidation)

### 8.2 Source Supabase
- Active production dependencies: **0**
- Rollback-only dependencies: **1** (Project `wdxhjwodyctgzqtogkgv`)
- Archive dependencies: **5** (DB, Auth, Storage, Config, Evidence archives in F13)
- Unknown dependencies: **0**
- Retirement technically eligible: **YES** (post-consolidation)

---

## 9. ROLLBACK REALITY & WP16 SAFETY

1. **Frontend Rollback**:
   - Available via DNS A record update to legacy IP `185.158.133.1`.
2. **Backend Data Rollback**:
   - **NOT SAFE DIRECTLY**. Target Supabase has processed live transactions and pg_cron updates post-cutover. Directly switching traffic to Source would cause split-brain data loss unless forward reconciliation is performed.
3. **WP16 Trigger**:
   - Protects Source database from residual writes, maintaining archival immutability.
   - Removing WP16 now serves no purpose and would weaken archival guarantees.

```
F18_FRONTEND_ROLLBACK_AVAILABLE:                     YES
F18_FRONTEND_ROLLBACK_MECHANISM:                     DNS_A_RECORD_TO_185_158_133_1
F18_SOURCE_DIRECT_DATA_ROLLBACK_SAFE:                NO
F18_SOURCE_ROLLBACK_REQUIRES_FORWARD_RECONCILIATION: YES
F18_WP16_CURRENT_PURPOSE:                            WRITE_PREVENTION_TRIGGER_ON_SOURCE
F18_WP16_PRODUCTION_REQUIRED:                        NO
F18_WP16_ARCHIVAL_FREEZE_REQUIRED:                   YES
F18_WP16_SAFE_TO_REMOVE_NOW:                         NO
```

---

## 10. DOMAIN & DNS LEGACY RECORDS

- **Required Production Records**:
  - `A barbex.shop -> 76.76.21.21`
  - `CNAME www.barbex.shop -> barbex.shop`
- **Legacy Verification Records (Candidates for future removal)**:
  - `_lovable.barbex.shop TXT lovable_verify=99374a072055b3baea78b81e3c4b0ed3cfe522636d93a5329c95a79f10c2f8f7`
  - `_lovable.www.barbex.shop TXT lovable_verify=ed7ff19c33fc871ef3c621ff5d775f2a018bebb219d1bdde162b35f8d8bf69e3`

```
F18_DNS_LEGACY_RECORDS:                       ["_lovable.barbex.shop", "_lovable.www.barbex.shop"]
F18_DNS_RECORDS_REQUIRED_CURRENTLY:           ["A barbex.shop", "CNAME www.barbex.shop"]
F18_DNS_RECORDS_CANDIDATE_FOR_FUTURE_REMOVAL: ["_lovable.barbex.shop", "_lovable.www.barbex.shop"]
F18_DNS_RECORDS_UNKNOWN:                      []
```

---

## 11. ORDERED RETIREMENT SYNTHESIS

An ordered sequence is established for future execution:

```
1. Step A: REPOSITORY_CONSOLIDATION (Commit runtime adapters, configs, and migration docs; untrack .env)
2. Step B: REPRODUCIBILITY_PROOF_FROM_GITHUB_MAIN (Verify clean build parity from GitHub main)
3. Step C: PRODUCTION_DEPLOYMENT_FROM_GITHUB_MAIN (Trigger Vercel production deployment from GitHub CI/CD)
4. Step D: POST_DEPLOYMENT_STABILIZATION (Re-verify production custom domain smoke on GitHub deployment)
5. Step E: LOVABLE_ROLLBACK_RETIREMENT (Decommission Lovable frontend project 8e95dc9e-ab64-44cf-956c-ecec6fefeb51)
6. Step F: OBSOLETE_DNS_VERIFICATION_CLEANUP (Remove legacy _lovable TXT records in Hostinger DNS)
7. Step G: SOURCE_ROLLBACK_RETIREMENT (Formally close Source rollback window)
8. Step H: WP16_RETIREMENT (Drop WP16 trigger on Source)
9. Step I: SOURCE_PROJECT_PAUSE (Pause Source Supabase project wdxhjwodyctgzqtogkgv)
10. Step J: EVENTUAL_SOURCE_DELETION (Delete Source Supabase project after compliance retention window)
```

---

## 12. FINAL DECISION

Production is stable on Vercel and Target Supabase, but local/GitHub reproducibility requires repository consolidation before any legacy decommissioning can begin.

This matches **CASE A — READY FOR REPOSITORY CONSOLIDATION**:

```
F18_PRODUCTION_STABLE:                 YES
F18_REPOSITORY_CONSOLIDATION_REQUIRED: YES
F18_LEGACY_RETIREMENT_AUTHORIZED:     NO

FINAL_DECISION:
F18_PRECHECK_PASS_REPOSITORY_CONSOLIDATION_REQUIRED_BEFORE_RETIREMENT
```

---

## 13. EVIDENCE MANIFEST & MASTER BUNDLE SHA256

- `phase17c_m7h_f18_production_authority.json` (`6f37c198b753c1b0843e5abab9d519ffd480d40a6c8b56df662b656dda5cb606`)
- `phase17c_m7h_f18_worktree_inventory.json` (`4fdc1c4e09908cdfeb2edd6201b491bb24a4c79e3edbf186842e90726c89b30b`)
- `phase17c_m7h_f18_secret_hygiene.json` (`3a9f82f66520fb5aa04b36c250f17860236ed7320a5f2ee7d6ad1ff0f3556fbd`)
- `phase17c_m7h_f18_repository_parity.json` (`cc80ecf177300dd5fc41afc7d025cc97d45ed70f0c93e2fefbea273ddf64000f`)
- `phase17c_m7h_f18_vercel_deployment_source.json` (`92fdf160f71e073f64cbfe780083f9c99aecdba519a60cc7c7451b5431601ef5`)
- `phase17c_m7h_f18_reproducibility.json` (`6cc239c09ce456b73262bd9f7f98d2319270f4034d7b118ca17e2d8b287efd66`)
- `phase17c_m7h_f18_lovable_dependencies.json` (`4ac4aa41c0eeabb1fcfee1af3a6c7ee03ce6acbc7a7e453345f66d7645306721`)
- `phase17c_m7h_f18_source_dependencies.json` (`8c7e2ecb701ae755115e7d6629bf77de6d153dd1982d86bd1bf22a20cbad6371`)
- `phase17c_m7h_f18_rollback_reality.json` (`f018e210845319e582320c9598e38b4e4f21e410cae767ec244f86e083a6761c`)
- `phase17c_m7h_f18_wp16.json` (`04ffdf92757d79a27bfe047bdd22867349910967f3bf5bb8d0b8c3109e6b1d14`)
- `phase17c_m7h_f18_archive_integrity.json` (`2c292fb8130f9e394f114ac0f817ded494bd2dd98d7cd476e667609a1abcc307`)
- `phase17c_m7h_f18_provider_refs.json` (`c6d0a41ac6c1332b8d1ec48c7da61d725bb3fb835d944a44120c5b55fce8f9fc`)
- `phase17c_m7h_f18_dns_legacy.json` (`3e268d94f133c82180e0d2dd45e0b95e889409ab5559eb2888107ca43d707dee`)
- `phase17c_m7h_f18_retirement_order.json` (`050b90e3053cf6b329cbb581f04a0219d07430da2ae36f879bc9419f01a7afcb`)
- [PHASE17C_M7H_F18_LEGACY_RETIREMENT_PRECHECK.md](file:///c:/Antigravity/Barbex/barbex/docs/migration/PHASE17C_M7H_F18_LEGACY_RETIREMENT_PRECHECK.md)
- [phase17c_m7h_f18_bundle.json](file:///c:/Antigravity/Barbex/barbex/docs/migration/evidence/phase17c_m7h_f18_bundle.json)

```
M7H_F18_BUNDLE_SHA256:
e066ae8372e0194b6f8bdd1473fcddc98808e1c52fc7dd9f6c33333ad7543cfc
```
