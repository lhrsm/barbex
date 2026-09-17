# BARBEX — PHASE 17C.M6H.9: CUTOVER READINESS & PREPARATION CHECKLIST

### 1. Readiness Score Matrix

| Architectural Category | Target Readiness | Blocker Level | Key Finding / Dependency |
|---|:---:|:---:|---|
| **Database & Schema** | **READY** | None | 100% tables, RLS, functions, triggers migrated to Target |
| **Auth & Profiles** | **PARTIAL** | P0 | Staff auth ready; Customer booking auth needs dedicated Edge |
| **Storage Buckets** | **READY** | None | 5 buckets, 30 objects verified on Target |
| **Realtime** | **READY** | None | Realtime replication policies configured |
| **Edge Functions** | **PARTIAL** | P0 / P1 | 12 functions ready; Missing `ai-assistant`, `resend-webhook` |
| **RPC Functions** | **PARTIAL** | P1 | Background jobs RPCs ready; Missing backup codes & platform settings RPC |
| **Frontend Adapters** | **READY** | None | 38 components decoupled; 0 secrets in client bundle |
| **AI / Machine Learning** | **BLOCKED** | P0 | 2 features depend on `LOVABLE_API_KEY` and Lovable AI Gateway |
| **Payment Gateways** | **PARTIAL** | P1 | Stripe ready; Multi-gateway customer subscriptions need Edge/Nitro |
| **Webhooks** | **PARTIAL** | P1 | Stripe & Z-API ready; Resend & Subscriptions webhooks need Target Edge |
| **Cron Workers** | **PARTIAL** | P1 | `cron-worker` ready; `addons-reconcile` and `admin-risk-scan` need handlers |
| **Secrets & Vault** | **PARTIAL** | P0 | Inventory complete; Target Supabase Secrets pending configuration |
| **SSR Runtime** | **PARTIAL** | P1 | Still dependent on Nitro for residual 26 functions |
| **Nitro Removal** | **BLOCKED** | P0 | Cannot remove Nitro until all P0/P1 blockers are resolved |

---

### 2. Cutover Blocker Register

| ID | Severity | Domain | Description | Required Action | Target Artifact | Provider Action | DB Migration | Edge Deploy |
|---|:---:|---|---|---|---|:---:|:---:|:---:|
| **BLK-01** | **P0** | AI | Lovable AI gateway dependency in `askAdminAssistant` and `suggestLoyaltyCampaigns` | Implement `ai-assistant` Edge Function with OpenAI provider | `supabase/functions/ai-assistant` | Set `OPENAI_API_KEY` | None | Deploy `ai-assistant` |
| **BLK-02** | **P0** | AUTH | `BookingAuthStep.tsx` customer verification cannot reuse `staff-auth` | Deploy `customer-auth` Edge Function for public booking | `supabase/functions/customer-auth` | None | None | Deploy `customer-auth` |
| **BLK-03** | **P1** | WEBHOOK | Missing Resend webhook receiver Edge Function | Implement `resend-webhook` Edge Function | `supabase/functions/resend-webhook` | Resend Dashboard URL | None | Deploy `resend-webhook` |
| **BLK-04** | **P1** | PAYMENTS | Multi-gateway customer subscriptions webhook has no Edge equivalent | Implement `gateway-webhook` Edge Function or keep Nitro route | `supabase/functions/gateway-webhook` | Update per-tenant webhooks | None | Deploy `gateway-webhook` |
| **BLK-05** | **P1** | SECURITY | MFA backup codes verification depends on server-side query | Implement `verify_mfa_backup_code` and `generate_mfa_backup_codes` RPC | SQL migration | None | Apply RPC | None |
| **BLK-06** | **P1** | CONTACT | Public contact form anti-spam & honeypot | Implement `contact-public` Edge Function | `supabase/functions/contact-public` | None | None | Deploy `contact-public` |
| **BLK-07** | **P2** | SETTINGS | Platform public settings reads `system_settings` via service role | Implement `get_public_platform_settings()` RPC | SQL migration | None | Apply RPC | None |

---

### 3. M6I Entry Criteria Evaluation

| M6I Entry Criterion | Status | Evaluation |
|---|:---:|---|
| All residual Edge functions implemented | **FAIL** | `ai-assistant`, `customer-auth`, `resend-webhook` pending implementation |
| All residual RPC functions implemented | **FAIL** | Backup codes and platform settings RPCs pending creation |
| Auth residual callers migrated | **PARTIAL** | 10 MFA native functions ready to wire; Booking customer auth needs Edge |
| AI Lovable dependency eliminated | **FAIL** | `LOVABLE_API_KEY` still present in 2 active functions |
| Payment gateway residuals migrated | **PARTIAL** | Stripe ready; Multi-gateway subscriptions need target edge/handling |
| Webhooks mapped & target equivalents exist | **FAIL** | 2 of 4 webhooks lack target Edge Function |
| Cron jobs mapped & worker handlers complete | **PARTIAL** | 2 worker handlers (`addons-reconcile`, `admin-risk-scan`) need implementation |
| Target Secrets configured | **PARTIAL** | Inventory complete; Secret values pending remote setting |
| Platform settings safe target exists | **FAIL** | RPC pending creation |
| LGPD admin secure target exists | **FAIL** | Super admin RPC pending creation |
| **FINAL M6I GATE EVALUATION** | **FAIL** | **DO NOT START M6I** |

---

### 4. Executive Decision
- **Phase 17C.M6H.9 Status**: **COMPLETE**
- **Nitro Removal Readiness**: **NO** (`NITRO_REMOVAL_READY = NO`)
- **Action**: DO NOT START M6I. DO NOT REMOVE NITRO. DO NOT SWITCH PRODUCTION.
