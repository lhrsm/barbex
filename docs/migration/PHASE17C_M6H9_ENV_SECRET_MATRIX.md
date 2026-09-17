# BARBEX — PHASE 17C.M6H.9: ENVIRONMENT & SECRET MATRIX
## COMPLETE RUNTIME ENV AUDIT, PUBLIC VS SERVER CLASSIFICATION & SECRET LIFECYCLE

### 1. Executive Summary
This document provides the canonical inventory of all environment variables and secrets across the Barbex application, classifying each for the target Supabase architecture and establishing the zero-secret client bundle guarantee.

---

### 2. Client Allowlist vs Forbidden Secrets

#### A. Final Frontend Public Allowlist
Only the following variables are permitted in the client browser bundle:
- `VITE_SUPABASE_URL`: Public Supabase API gateway URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Standard Supabase public anon key for RLS queries
- `VITE_SUPABASE_ANON_KEY`: Alias for publishable key
- `VAPID_PUBLIC_KEY`: Browser Web Push subscription public key (safe for client registration)
- `VITE_APP_URL`: Canonical public web origin
- `VITE_PAYMENTS_SANDBOX_CLIENT_TOKEN`: Public client token for embedded checkout testing
- `VITE_PAYMENTS_CLIENT_TOKEN`: Public client token for embedded checkout live

#### B. Forbidden Server-Only Secrets (Must Never Enter Frontend)
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `VAPID_PRIVATE_KEY`
- `CRON_WORKER_SECRET`
- `CRON_SECRET`
- `LOVABLE_API_KEY`
- `OPENAI_API_KEY`

**Client Bundle Secret Scan Result**: 0 secrets exposed.

---

### 3. Detailed Environment Variable Inventory

| ENV Variable | Runtime | Category | Target Destination | Required in Web Deploy Post-Cutover? | Cutover Action |
|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | Client (Vite) | PUBLIC | Supabase Target URL | **YES** | Update value from Source to Target |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client (Vite) | PUBLIC | Supabase Target Anon Key | **YES** | Update value from Source to Target |
| `VAPID_PUBLIC_KEY` | Client (Vite) | PUBLIC | Browser Push Registration | **YES** | Keep public key in frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (Deno/Node) | SERVER_ONLY | Supabase Target Edge Functions | **NO** (Remove from Cloudflare Web) | Migrate exclusively to Target Edge Secret |
| `STRIPE_SECRET_KEY` | Server (Deno/Node) | SERVER_ONLY | Edge (`stripe-checkout`, `stripe-addons`) | **NO** (Remove from Cloudflare Web) | Migrate exclusively to Target Edge Secret |
| `STRIPE_WEBHOOK_SECRET` | Server (Deno/Node) | SERVER_ONLY | Edge (`stripe-webhook`) | **NO** (Remove from Cloudflare Web) | Migrate exclusively to Target Edge Secret |
| `RESEND_API_KEY` | Server (Deno/Node) | SERVER_ONLY | Edge (`send-email`, `staff-auth`, `team-invitations`) | **NO** (Remove from Cloudflare Web) | Migrate exclusively to Target Edge Secret |
| `VAPID_PRIVATE_KEY` | Server (Deno/Node) | SERVER_ONLY | Edge (`send-push`) | **NO** (Remove from Cloudflare Web) | Migrate exclusively to Target Edge Secret |
| `CRON_WORKER_SECRET` | Server (Deno/RPC) | SERVER_ONLY | Edge (`cron-worker`) + PostgreSQL Vault | **NO** (Remove from Cloudflare Web) | Configure in Supabase Vault & Edge Secrets |
| `CRON_SECRET` | Server (Node) | LEGACY | Nitro legacy hooks | **NO** | Discard upon Nitro decommissioning |
| `LOVABLE_API_KEY` | Server (Node) | LEGACY | Decouple to Edge `ai-assistant` | **NO** | Eliminate upon Lovable decoupling |
| `OPENAI_API_KEY` | Server (Deno) | TARGET_EDGE | Edge (`ai-assistant`) | **NO** | Set in Target Supabase Secrets only |
| `ZAPI_TOKEN` | Server (DB/Per-Tenant)| DEAD_GLOBAL | Migrated to `whatsapp_instances.token` | **NO** | Discard global ENV; read per tenant |
| `ZAPI_INSTANCE_ID` | Server (DB/Per-Tenant)| DEAD_GLOBAL | Migrated to `whatsapp_instances.instance_id` | **NO** | Discard global ENV; read per tenant |
| `ZAPI_CLIENT_TOKEN` | Server (DB/Per-Tenant)| DEAD_GLOBAL | Migrated to `whatsapp_instances.client_token` | **NO** | Discard global ENV; read per tenant |
| `PUSH_INTERNAL_SECRET`| Server (Node/Edge) | LEGACY | Edge `send-push` handles directly | **NO** | Discard upon Nitro decommissioning |

---

### 4. Supabase Target Edge Function Secrets Map

| Edge Function | Auto-Injected Supabase Env | Custom Required Secrets | Target Configuration Status | Value Printed? |
|---|---|---|---|---|
| `auth-phone` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | None | Ready | NO |
| `auth-phone-reset` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | None | Ready | NO |
| `team-invitations` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `RESEND_API_KEY` | Pending Target Secret Setting | NO |
| `staff-auth` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `RESEND_API_KEY` | Pending Target Secret Setting | NO |
| `stripe-checkout` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `STRIPE_SECRET_KEY` | Pending Target Secret Setting | NO |
| `stripe-addons` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `STRIPE_SECRET_KEY` | Pending Target Secret Setting | NO |
| `stripe-webhook` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `STRIPE_WEBHOOK_SECRET` | Pending Target Secret Setting | NO |
| `zapi-webhook` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | None (reads per-tenant from DB) | Ready | NO |
| `zapi-send` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | None (reads per-tenant from DB) | Ready | NO |
| `cron-worker` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `CRON_WORKER_SECRET` | Pending Target Secret Setting | NO |
| `send-email` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `RESEND_API_KEY` | Pending Target Secret Setting | NO |
| `send-push` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Pending Target Secret Setting | NO |
| `ai-assistant` (Planned)| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `OPENAI_API_KEY` | Pending Implementation & Secret | NO |
