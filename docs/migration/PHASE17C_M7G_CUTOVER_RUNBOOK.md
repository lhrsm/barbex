# =====================================================================
# BARBEX — PHASE 17C.M7G.1
# CANONICAL OPERATOR CUTOVER RUNBOOK
# ZERO UNCONTROLLED MUTATION / FAIL-CLOSED ARCHITECTURE
# 16 WRITE PATHS COMPLETE MITIGATION / 6 MANUAL CHECKPOINTS
# =====================================================================

## 0. PRE-FLIGHT AND IMMUTABILITY CHECKS
1. Verify Target Schema Foundation (`BARBEX-CANONICAL-20260909-02b6e234`):
   - 159 base tables, 2 views, 2 sequences, 202 functions, 394 policies, 14 enums.
   - 0 business rows in Target `public.*`.
2. Verify Target Auth Foundation:
   - Exactly 10 `auth.users`, 12 `auth.identities`.
   - Post-commit verified bundle SHA256: `1491b063b45d336a5f423a42dcc88a8723a7bd1c9edf4d9bce6aa8b967fecf25`.
3. Verify M7F Immutable Public Snapshot:
   - Manifest SHA256: `e7f20b696f60bc97d2d714c541a261273fff18b8a967d61bcb8ae95f02c36bee`.
   - Bundle SHA256: `e8776cdf7769a646bc863f3770d792a739b78f33f66b9a815463648c2e9023e5`.
4. Verify Mutable Table Fingerprint Parity:
   - 24/24 mutable tables match exact M7F logical fingerprints.

-----------------------------------------------------------------------
### [CHECKPOINT A]: AUTHORIZATION TO COMMENCE PRE-FREEZE ACTIONS
Operator explicitly authorizes initiating maintenance mode and write gates.
-----------------------------------------------------------------------

## 1. APPLICATION & EDGE WRITE GATE ACTIVATION (PATHS WP-01 TO WP-10)
5. Set `VITE_MAINTENANCE_MODE=true` in frontend hosting:
   - Blocks WP-01 (Public Client Booking Flow)
   - Blocks WP-02 (Admin/Staff Appointment Booking & Walk-in)
   - Blocks WP-03 (Appointment Status Updates & Check-ins)
   - Blocks WP-04 (Professional Management & Schedule Edits)
   - Blocks WP-05 (Service Catalog Management)
   - Blocks WP-06 (Customer CRM Profile & History Edits)
   - Blocks WP-07 (Customer Review Submission)
   - Blocks WP-08 (Product Sales & POS Stock Adjustments)
   - Blocks WP-09 (Barbershop Settings & Profile Customization)
   - Blocks WP-10 (Tenant Onboarding & Settings Configuration)
6. Verify UI displays maintenance modal with read-only navigation allowed.

## 2. WEBHOOK INGRESS PAUSE & BUFFERING (PATHS WP-11 TO WP-14)
7. Configure Edge Functions to return HTTP 503 Service Unavailable:
   - WP-11 (`stripe-webhook`): Stripe enters automatic 72-hour exponential backoff retry. Zero data loss.
   - WP-12 (`zapi-webhook`): Z-API webhook returns 503; provider retries delivery. Zero data loss.
   - WP-13 (`resend-webhook`): Resend enters automatic 24-hour retry backoff. Zero data loss.
   - WP-14 (`gateway-webhook`): Multi-gateway webhook returns 503; gateway retries delivery. Zero data loss.

## 3. CRON & BACKGROUND DISPATCHER PAUSE (PATHS WP-15 TO WP-16)
8. Pause background workers:
   - WP-15 (`cron-worker`): Pause cloud scheduler and set `CRON_DISABLED=true` on Edge Function.
   - WP-16 (`status_checks`): Pause periodic health check logger runner.

## 4. IN-FLIGHT DRAIN & QUIET-STATE VERIFICATION
9. Wait 15 seconds to allow any in-flight database requests to settle.
10. Run `FreezeStateVerifier` to establish T0 baseline.
11. Observe Source for 60 seconds quiet interval (justified by 25s max Edge function timeout and 60s cron cycle).
12. Run `FreezeStateVerifier` to verify T1 against T0:
    - Expected: Delta across all 159 tables == 0, `status_checks` max(id) completely unchanged.

-----------------------------------------------------------------------
### [CHECKPOINT B]: AUTHORIZATION TO CAPTURE FINAL DELTA
Operator verifies Source quiet state (zero writes) and approves final delta capture.
-----------------------------------------------------------------------

## 5. CAPTURE FINAL DELTA
13. Read `status_checks` keyset delta (`id > 256536`).
14. Verify no operational business table has changed.
15. Save delta files to `.migration-secrets/public-data/M7F-CAPTURE-1789043053743/final-delta/`.

-----------------------------------------------------------------------
### [CHECKPOINT C]: AUTHORIZATION TO MIGRATE STORAGE BINARIES
Operator authorizes migrating storage binary objects from Source to Target.
-----------------------------------------------------------------------

## 6. STORAGE BINARY MIGRATION
16. Transfer 30 binary objects (10,480,575 bytes) across 5 buckets (`barber-avatars`, etc.) from Source to Target.
17. Verify Target storage objects = 30 and public access is functional. Zero broken URLs.

-----------------------------------------------------------------------
### [CHECKPOINT D]: AUTHORIZATION TO EXECUTE PUBLIC DATA IMPORT
Operator authorizes executing staged public data import on Target.
-----------------------------------------------------------------------

## 7. STAGED TARGET PUBLIC DATA IMPORT
18. Execute Stage 1: Level 0 tables (11 tables) with controlled suppression of `handle_updated_at` on `profiles`.
19. Execute Stage 2: Level 1 tables (7 tables) with controlled suppression of `handle_updated_at` on `barbers`, `customers`, `services`.
20. Execute Stage 3: `status_checks` in 11 keyset batches of 25,000 + final delta.
21. Execute Stage 4: Level 2 tables (3 tables) with 4 stale rows in `barber_services` EXCLUDED.
22. Execute Stage 5: Level 3 tables (2 tables) with 5 orphan rows in `appointments.subscription_id` set to `NULL`.
23. Execute Stage 6: Level 4 tables (2 tables) with controlled suppression of `trg_notifications_broadcast` on `notifications`.
24. Execute Stage 7: Post-Import Transformations & Reseed:
    - Rewrite 6 storage URLs in `barbers` and `profiles` to `ywdwrstxvsdqiryhieiz`.
    - Reseed `status_checks_id_seq` to `max(id) + 1`.
    - Reseed `rate_limit_hits_id_seq` to 1.
25. Run full post-import forensic verifier:
    - 159 base tables, exact expected rows.
    - 279 FK orphans = 0, UNIQUE = 0, CHECK = 0, ENUM = 0.
    - Auth UUID coverage = 100% (10 users, 12 identities).
    - Multi-tenancy tenant_id and user_id orphans = 0.

-----------------------------------------------------------------------
### [CHECKPOINT E]: AUTHORIZATION FOR APPLICATION ENVIRONMENT CUTOVER
Operator reviews database & storage verification results and approves DNS / hosting cutover.
-----------------------------------------------------------------------

## 8. APPLICATION ENVIRONMENT CUTOVER & SMOKE TESTS
26. Update production hosting environment variables to point to Target:
    - `VITE_SUPABASE_URL="https://ywdwrstxvsdqiryhieiz.supabase.co"`
    - `VITE_SUPABASE_ANON_KEY="..."`
    - Edge function secrets updated to Target.
27. Deploy application production build.
28. Run smoke tests on public endpoints.
29. Perform single controlled login test with designated verification account. Confirm session token and dashboard load.

-----------------------------------------------------------------------
### [CHECKPOINT F]: AUTHORIZATION TO REOPEN WRITES & REPLAY WEBHOOKS
Operator approves opening system to live production traffic.
-----------------------------------------------------------------------

## 9. REOPEN WRITES & MONITORING
30. Set `VITE_MAINTENANCE_MODE=false`.
31. Unset `EDGE_MAINTENANCE_MODE` on webhook Edge Functions; Stripe, Z-API, and Resend deliver buffered retries safely.
32. Resume cron workers pointing to Target.
33. Monitor telemetry for 30 minutes.

-----------------------------------------------------------------------
## 10. CUTBACK / ROLLBACK PROCEDURE (IF ABORTED AT ANY POINT PRIOR TO CHECKPOINT F)
34. If failure occurs at any stage before Checkpoint F:
    - Source database was never mutated and remains 100% authoritative.
    - Unset maintenance flags and resume crons/webhooks on Source.
    - Target database is marked DIRTY and remains non-production.
    - Zero data loss, zero split-brain.
