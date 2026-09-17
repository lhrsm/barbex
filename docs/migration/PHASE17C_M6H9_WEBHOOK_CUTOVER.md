# BARBEX — PHASE 17C.M6H.9: WEBHOOK CUTOVER MATRIX
## DETAILED PROVIDER WEBHOOK CUTOVER SPECIFICATION & ROLLBACK PLAN

### 1. Overview
The Barbex platform currently exposes 4 provider webhook endpoints on the legacy Nitro server. This document defines the migration target, dashboard re-routing requirements, and blocker analysis for each endpoint.

---

### 2. Provider Webhook Cutover Matrix

| Route | Provider | Purpose | Legacy Endpoint (Current) | Target Endpoint (Edge) | Target Status | Dashboard Change Required | Secret Update Required | Rollback Endpoint |
|---|---|---|---|---|---|---|---|---|
| `/api/public/payments/webhook` | Stripe | SaaS Subscriptions & Add-ons | `https://barbex.shop/api/public/payments/webhook` | `https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/stripe-webhook` | **READY** | Stripe Dashboard Webhook URL change | Generate Target `STRIPE_WEBHOOK_SECRET` | `https://barbex.shop/api/public/payments/webhook` |
| `/api/webhooks/zapi/:barbershopId` | Z-API | WhatsApp Inbound & Status | `https://barbex.shop/api/webhooks/zapi/:barbershopId` | `https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/zapi-webhook?barbershopId=:barbershopId` | **READY** | Z-API Instance Webhook URL update | Set webhook URL per instance | `https://barbex.shop/api/webhooks/zapi/:barbershopId` |
| `/api/public/subscriptions/webhook` | Multi-Gateway (Asaas, MP, etc.) | Customer Club Subscriptions | `https://barbex.shop/api/public/subscriptions/webhook?gateway=:id` | **MISSING** (No multi-gateway Edge function) | **BLOCKER (P1)** | Cannot migrate until multi-gateway Edge or RPC is built | Per-tenant webhook secret in `payment_gateways` | Keep active on Nitro |
| `/api/public/resend-webhook` | Resend | Email Delivery/Bounce Events | `https://barbex.shop/api/public/resend-webhook` | **MISSING** (`resend-webhook` not in `supabase/functions/`) | **BLOCKER (P1)** | Resend Webhooks Dashboard | Set `RESEND_WEBHOOK_SECRET` in Target Edge | Keep active on Nitro |

---

### 3. Deep Dive into Blockers

#### Blocker 1: Multi-Gateway Customer Subscriptions (`/api/public/subscriptions/webhook`)
- **Nature**: Unlike SaaS subscriptions which exclusively use Stripe, end-customer subscriptions allow barbershops to configure Asaas, Mercado Pago, PagSeguro, etc.
- **Current Logic**: Nitro dynamically selects provider via `src/lib/payments/providers/index.server.ts` and parses webhooks to update `customer_subscriptions`.
- **Target Solution**: Maintain this route on Nitro during initial cutover OR implement a unified `gateway-webhook` Edge Function.

#### Blocker 2: Resend Inbound Webhook (`/api/public/resend-webhook`)
- **Nature**: Records delivery confirmations and bounce events into `email_logs`.
- **Target Solution**: Create `supabase/functions/resend-webhook` to verify SVIX/HMAC signature and update `email_logs`.

---

### 4. Zero-Action Confirmation
- **Stripe Dashboard Webhooks**: UNTOUCHED (still pointing to production `barbex.shop`).
- **Z-API Webhooks**: UNTOUCHED.
- **Nitro Routes**: 100% ACTIVE and OPERATIONAL.
