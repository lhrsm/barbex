# BARBEX — PHASE 17C.M6G: BACKGROUND WORKERS, EMAIL & WEB PUSH EDGE MIGRATION

## 1. Executive Summary

Phase 17C.M6G reimplements the background processing, transactional email (Resend), and Web Push (VAPID) notification engine natively in Supabase Edge Functions and PostgreSQL.

In **Phase 17C.M6G.1**, all components are implemented **locally** with strict safety gates:
- **Zero remote Edge Function deployments**
- **Zero remote secret configurations**
- **Zero remote pg_cron activations**
- **Zero live email, push, or WhatsApp transmissions**
- **Zero modifications to live production (`barbex.shop`)**

---

## 2. Target Architecture

```
Browser / DB Triggers
       │
       ▼
public.background_jobs (status: pending, priority, next_run_at)
       │
       ▼ (Atomic RPC: claim_next_background_job with FOR UPDATE SKIP LOCKED)
┌─────────────────────────────────────────────────────────────┐
│                       cron-worker                           │
│  - Service Authenticated (CRON_WORKER_SECRET / Service-Role)│
│  - Bounded Loop: MAX_JOBS_PER_RUN=10, MAX_EXEC_MS=25000     │
│  - Lock Ownership Validation (locked_by = worker_id)        │
│  - Auto-Healing: reconcile_stuck_background_jobs            │
└───────┬──────────────────────┬──────────────────────┬───────┘
        │                      │                      │
        ▼                      ▼                      ▼
    send-email             send-push              zapi-send
 (Resend Adapter)        (Web Push/VAPID)      (WhatsApp Adapter)
        │                      │                      │
        ▼                      ▼                      ▼
  complete_job           complete_job           complete_job
 (or retry backoff)     (or retry backoff)     (or retry backoff)
```

---

## 3. Component Inventory & Matrix

| Component | Type | Path / Object | Authentication | Allowed Scope / Queues | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cron-worker` | Edge Function | `supabase/functions/cron-worker/index.ts` | Service / `CRON_WORKER_SECRET` | `email_notification`, `push_notification`, `whatsapp_notification`, `review_request`, `review_reminder`, `addons_cleanup`, `admin_digest`, `reconcile_stuck_jobs`, `default` | Local Implemented |
| `send-email` | Edge Function | `supabase/functions/send-email/index.ts` | Service / JWT (Self-only) | `internal_user_invitation`, `email_verification_code`, `admin_digest`, `review_request`, `subscription_reminder`, `system_notification`, `custom` | Local Implemented |
| `send-push` | Edge Function | `supabase/functions/send-push/index.ts` | Service / JWT (Tenant-bound) | `push_subscriptions` targeting by `user_id`, `customer_phone`, `tenant_id`, `audience` | Local Implemented |
| `_shared/resend.ts` | Shared Module | `supabase/functions/_shared/resend.ts` | Internal | Resend API client, HTML escaping, template rendering, error classification | Local Implemented |
| `_shared/push.ts` | Shared Module | `supabase/functions/_shared/push.ts` | Internal | Web Push / VAPID helper, URL safety, 410 stale detection, PII sanitization | Local Implemented |
| `complete_background_job` | PostgreSQL RPC | `public.complete_background_job` | `service_role` only | Marks job completed with lock verification (`locked_by = p_worker_id`) | Local Migration |
| `fail_background_job` | PostgreSQL RPC | `public.fail_background_job` | `service_role` only | Computes exponential backoff / max attempts with lock verification | Local Migration |
| `enqueue_background_job_safe` | PostgreSQL RPC | `public.enqueue_background_job_safe` | `service_role`, `authenticated` | Enforces queue allowlist on job scheduling | Local Migration |

---

## 4. Job Engine & Concurrency Lifecycle

```
[ pending / retry ]
        │
        ▼  (claim_next_background_job — FOR UPDATE SKIP LOCKED)
  [ processing ]  (locked_by = worker-uuid, locked_at = NOW())
        │
   ┌────┴────────────────────────┐
   ▼                             ▼
(Execution OK)             (Execution Error)
   │                             │
   ▼                             ├──────────────────────────┐
complete_background_job          ▼                          ▼
(locked_by verified)     (attempts < max_attempts)   (attempts >= max_attempts)
   │                             │                          │
   ▼                             ▼                          ▼
[ completed ]                 [ retry ]                  [ failed ]
(lock cleared)          (next_run_at = NOW() + backoff)  (next_run_at = NULL)
```

### Stuck Job Auto-Healing
If a worker crashes or times out while holding a lock, `reconcile_stuck_background_jobs(15)` automatically releases locks on jobs stuck in `processing` for >15 minutes, transitioning them to `retry` (if attempts remain) or `failed`.

---

## 5. Security & Isolation Controls

1. **Service-to-Service Authentication**:
   - `cron-worker` is strictly closed: rejects any request without a valid `CRON_WORKER_SECRET` or `service_role` key.
   - Wildcard CORS is disabled.
2. **Recipient Authority**:
   - `send-email` validates that non-admin callers can only send emails to their own authenticated email address.
   - `send-push` verifies that callers cannot target devices belonging to other users or tenants.
3. **Safe URL Validation**:
   - Web Push action URLs must be safe relative paths (e.g. `/agendamentos`, `/admin`) or explicit `barbex.shop` domains.
   - `javascript:`, `data:`, and third-party phishing domains are rejected.
4. **HTML Injection Protection**:
   - All email variables are sanitized via `escapeHtml()`.
5. **PII Redaction**:
   - Log outputs automatically mask email addresses, phone numbers, auth tokens, passwords, and API keys.

---

## 6. Verification & Test Matrix

Test Suite: `scratch/test_m6g_workers_edge.mjs`
- Total Tests: 92
- Passed: 92
- Failed: 0
- Coverage:
  1. Target identity hard gate (`ywdwrstxvsdqiryhieiz`)
  2. Migration, baseline, and rollback SHA-256 consistency
  3. Edge Functions and `config.toml` registration
  4. HTML escaping and XSS defense
  5. Web Push safe URL validation
  6. Atomic job claiming, priority ordering, and queue filtering
  7. Concurrency simulation and worker lock ownership
  8. Transient error retry backoff vs max attempts exhaustion
  9. Auto-healing stuck job reconciliation
  10. Stale push subscription (410 Gone) deactivation
  11. Multi-channel and multi-tenant isolation
  12. PII / secret redaction in logging
  13. Codebase secret leak scan
