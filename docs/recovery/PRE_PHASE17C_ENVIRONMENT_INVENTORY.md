# BARBEX — PRE-PHASE 17C ENVIRONMENT INVENTORY

**Reference Commit:** `50b6e5390cf60c247f850d357aba77b8b9d52819`  
**Generated At:** 2026-09-02  
**Security Notice:** Zero secrets or credential values are stored in this document. This file only catalogs environment variable names and their usage.

---

## 1. Supabase (Database, Auth, Storage)

| Variable Name | Client / Server | Description / Purpose |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Server / Client | Canonical URL of the Supabase project |
| `VITE_SUPABASE_URL` | Client | Client-side Vite environment variable for Supabase URL |
| `SUPABASE_PROJECT_ID` | Server | Supabase Project Reference (`wdxhjwodyctgzqtogkgv`) |
| `VITE_SUPABASE_PROJECT_ID` | Client | Client-side Supabase project ID |
| `SUPABASE_PUBLISHABLE_KEY` | Server / Client | Anonymous / Publishable Supabase API key |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client | Client-side Vite publishable API key |
| `SUPABASE_ANON_KEY` | Server / Client | Fallback alias for anonymous key |
| `VITE_SUPABASE_ANON_KEY` | Client | Fallback alias for client anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | High-privilege administrative key for server functions |

---

## 2. Application & Routing

| Variable Name | Client / Server | Description / Purpose |
| :--- | :--- | :--- |
| `APP_URL` | Server | Base domain URL of the application (`https://barbex.shop`) |
| `VITE_APP_URL` | Client | Client-side application URL |

---

## 3. Stripe (Payments & Subscriptions)

| Variable Name | Client / Server | Description / Purpose |
| :--- | :--- | :--- |
| `STRIPE_SECRET_KEY` | Server Only | Stripe administrative secret key for API requests |
| `STRIPE_WEBHOOK_SECRET` | Server Only | Stripe webhook signing secret for event verification |
| `STRIPE_PRICE_ID_*` | Server Only | Stripe plan and add-on price identifiers |
| `VITE_PAYMENTS_SANDBOX_CLIENT_TOKEN` | Client | Sandbox client token for frontend payments UI |

---

## 4. Email & Messaging (Resend, WhatsApp / Z-API)

| Variable Name | Client / Server | Description / Purpose |
| :--- | :--- | :--- |
| `RESEND_API_KEY` | Server Only | Resend API key for transactional emails and invitations |
| `RESEND_FROM_EMAIL` | Server Only | Sender email address (`no-reply@barbex.shop`) |
| `ZAPI_INSTANCE_ID` | Server Only | Z-API instance identifier for WhatsApp automation |
| `ZAPI_TOKEN` | Server Only | Z-API token for WhatsApp messaging |
| `ZAPI_CLIENT_TOKEN` | Server Only | Z-API client authentication token |

---

## 5. Cloudflare & Deployment Runtime

| Variable Name | Client / Server | Description / Purpose |
| :--- | :--- | :--- |
| `CF_PAGES` | Server Only | Cloudflare Pages runtime flag |
| `NITRO_PRESET` | Server Only | Nitro deployment preset (`cloudflare-pages`) |
