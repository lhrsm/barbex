# BARBEX — PHASE 17C.M6H.9: RESIDUAL BACKEND RECONCILIATION
## COMPLETE AUDIT OF 26 RESIDUAL SERVERFNS, LOVABLE AI DECOUPLING & RPC TARGETS

### 1. Residual 26 ServerFns Classification

The canonical AST scanner identified exactly 26 residual ServerFns active in the UI. They are grouped into the following architectural targets:

| Group | Count | Functions | Source File | Target Architecture |
|---|---|---|---|---|
| **AUTH_NATIVE_READY** | 10 | `getMFAChallenge`, `verifyMFAChallenge`, `updatePassword`, `requestEmailChange`, `listSessions`, `enrollMFA`, `verifyMFA`, `unenrollMFA`, `getMFAStatus`, `listFactors` | `auth-mfa.functions.ts`, `auth-security.functions.ts` | Direct Supabase Auth SDK (`supabase.auth.*`, `supabase.auth.mfa.*`) |
| **CUSTOMER_AUTH_EDGE** | 3 | `requestEmailVerification`, `verifyEmailCode`, `finalizeAuthSetup` | `auth-verification.functions.ts` | Dedicated `customer-auth` Edge Function (Public Booking Funnel) |
| **BACKUP_CODES_BACKEND** | 3 | `verifyBackupCode`, `generateBackupCodes`, `listBackupCodes` | `auth-mfa.functions.ts`, `auth-security.functions.ts` | PostgreSQL RPC with user ownership & audit logging |
| **PUBLIC_CONTACT_BACKEND** | 1 | `submitPublicContactMessage` | `contact.functions.ts` | Public `contact-public` Edge Function (Honeypot + Rate Limit) |
| **PLATFORM_SETTINGS_BACKEND**| 1 | `getPlatformPublicSettings` | `platform-contact.functions.ts` | Public PostgreSQL RPC `get_public_platform_settings()` |
| **SUPER_ADMIN_BACKEND** | 4 | `getSecurityLogs`, `listAdminUpgradeRecommendations`, `adminListLgpdRequests`, `adminResolveLgpdRequest` | `auth-security.functions.ts`, `addons-engine.functions.ts`, `trust.functions.ts` | Authenticated PostgreSQL RPCs with `has_role(auth.uid(), 'super_admin')` |
| **PAYMENT_GATEWAY_BACKEND** | 2 | `testGatewayConnection`, `createCustomerSubscription` | `payments/subscriptions.functions.ts` | Dedicated `gateway-manager` Edge Function or keep Nitro temporarily |
| **AI_BACKEND** | 2 | `askAdminAssistant`, `suggestLoyaltyCampaigns` | `admin-assistant.functions.ts`, `loyalty-premium.functions.ts` | Target `ai-assistant` Edge Function (OpenAI provider via Target Secret) |

---

### 2. Lovable AI Decoupling Specification

#### Current State:
- **Endpoints**:
  - `askAdminAssistant` (Super Admin Assistant) -> `https://ai.gateway.lovable.dev/v1/chat/completions`
  - `suggestLoyaltyCampaigns` (Loyalty Campaign Advisor) -> `https://ai.gateway.lovable.dev/v1/chat/completions`
- **Secret**: `LOVABLE_API_KEY`
- **Model**: `openai/gpt-5.5`

#### Target State:
- **Function**: `supabase/functions/ai-assistant/index.ts`
- **Provider**: Independent OpenAI API via `OPENAI_API_KEY` stored in Target Supabase Secrets.
- **Data Minimization**:
  - `askAdminAssistant`: Sends aggregated platform KPIs from `admin_executive_kpis` and `admin_anomaly_alerts`. Zero raw passwords or tokens sent.
  - `suggestLoyaltyCampaigns`: Sends aggregated customer counts and average ticket size. Zero PII or customer phone numbers sent.
- **Security Boundary**:
  - Role validation: `super_admin` required for `admin-assistant`, `tenant_admin` for `loyalty-campaigns`.
  - Rate limiting: 10 calls/min per tenant.
  - PII sanitization: Strips names, emails, and phones from context payloads.

---

### 3. Customer vs Staff Auth Semantic Distinction

A critical discovery in M6H.9 confirmed that `BookingAuthStep.tsx` calls `requestEmailVerification`, `verifyEmailCode`, and `finalizeAuthSetup`.
- **Staff Auth** (`staff-auth` Edge Function): Designed for internal salon staff migration (`StaffMigrationModal.tsx`).
- **Customer Auth** (`BookingAuthStep.tsx`): Designed for salon end-customers verifying identity during appointment booking.
- **Decision**: Customer onboarding MUST NOT be forced into `staff-auth`. A dedicated `customer-auth` Edge Function or client auth pattern will be deployed.

---

### 4. RPC Target Specifications

#### A. Backup Codes RPC
- `public.verify_mfa_backup_code(p_code text) -> boolean`: Single-use atomic update (`used_at = now()`), SHA-256 hashed comparison, logs to `security_activity_logs`.
- `public.generate_mfa_backup_codes() -> text[]`: Generates 10 secure random codes, stores hashed in `user_mfa_backup_codes`.

#### B. Platform Public Settings RPC
- `public.get_public_platform_settings() -> jsonb`: Returns only `saas_name`, `main_url`, `saas_logo`, `public_email`, `phone`, `whatsapp_number`, `address`, `social_links`. Strips private system keys.
