# BARBEX — PHASE 17C.M6H.9: CRON & INTERNAL HOOKS CUTOVER
## SCHEDULED JOBS, PG_CRON ARCHITECTURE & NITRO HOOK MAPPING

### 1. Overview
The legacy Nitro backend currently exposes 8 internal hook endpoints under `/api/public/hooks/*` and `/api/public/send-push`. In the target Supabase architecture, these are replaced by `pg_cron` invoking the `cron-worker` Edge Function through `pg_net`, using credentials securely fetched from Supabase Vault.

---

### 2. Internal Hook Mapping Matrix

| Legacy Nitro Hook | Schedule / Trigger | Target Architecture | Target Queue / Handler | Target Status | Required Action |
|---|---|---|---|---|---|
| `/api/public/send-push` | On-demand / Internal | Edge `send-push` | Direct HTTP invoke / `push_notification` | **READY** | Deprecate Nitro route; callers invoke Edge Function directly |
| `/api/public/hooks/addons-cleanup` | Hourly (`0 * * * *`) | `cron-worker` via `pg_cron` | Queue `addons_cleanup` | **READY** | Configure `pg_cron` schedule on Target |
| `/api/public/hooks/addons-reconcile` | Daily (`0 4 * * *`) | `cron-worker` via `pg_cron` | Queue `addons_reconcile` | **NEEDS WORKER HANDLER** | Implement Stripe subscription reconciliation loop in worker |
| `/api/public/hooks/admin-digest` | Daily (`0 8 * * *`) | `cron-worker` via `pg_cron` | Queue `admin_digest` | **READY** | Configure `pg_cron` schedule on Target |
| `/api/public/hooks/admin-risk-scan` | Daily (`0 6 * * *`) | `cron-worker` via `pg_cron` | Queue `admin_risk_scan` | **NEEDS WORKER HANDLER** | Implement anomaly/trial expiration scan in worker |
| `/api/public/hooks/review-reminders` | Hourly (`*/30 * * * *`) | `cron-worker` via `pg_cron` | Queue `review_reminder` | **READY** | Configure `pg_cron` schedule on Target |
| `/api/public/hooks/send-review-requests`| Every 15 min (`*/15 * * * *`) | `cron-worker` via `pg_cron` | Queue `review_request` | **READY** | Configure `pg_cron` schedule on Target |
| `/api/public/hooks/status-check` | On-demand Health | Supabase native health RPC | `public.check_system_health()` | **READY** | Deprecate Nitro endpoint; use Supabase direct status check |

---

### 3. Target pg_cron & pg_net Schedule Plan

```sql
-- Target pg_cron setup template (PENDING M6I ACTIVATION — DO NOT ACTIVATE NOW)

-- 1. Store worker secret in Supabase Vault
-- INSERT INTO vault.decrypted_secrets (name, secret) VALUES ('cron_worker_secret', '<CRON_WORKER_SECRET>');

-- 2. Dispatch worker loop every minute for queue execution
-- SELECT cron.schedule(
--   'cron-worker-dispatch-every-minute',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/cron-worker',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_worker_secret')
--     ),
--     body := '{"reconcile": true}'::jsonb
--   );
--   $$
-- );
```

---

### 4. Zero-Action Safety Guarantee
- **pg_cron schedules on Target**: **0** active schedules.
- **pg_cron schedules on Source**: **0** modifications.
- **Nitro cron endpoints**: Fully active for current production.
