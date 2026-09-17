# BARBEX — PHASE 17C.M6H: FRONTEND ADAPTERS & NITRO DECOUPLING

## 1. Executive Summary

Phase 17C.M6H completes the decoupling of the Barbex frontend application from the legacy Nitro server runtime (`createServerFn`). Prior to this phase, the application relied on 97 active server functions with direct server-side bindings to secrets and database connections.

In Phase 17C.M6H, all UI components, pages, and client services were migrated to canonical adapters located in `src/lib/backend/`:
1. **Edge Function Adapters (`src/lib/backend/edge/`)**: High-privilege actions (Auth, Staff, Team, Stripe, Z-API, Resend, Web Push) routed via `invokeEdgeFunction()`.
2. **RPC Adapters (`src/lib/backend/rpc/`)**: Background job queuing and maintenance via PostgreSQL stored procedures.
3. **Direct Client Adapters (`src/lib/backend/client/`)**: Data fetching and CRUD protected by native Supabase RLS and RBAC policies.

---

## 2. Architecture & Adapter Layer

```
                        ┌──────────────────────────────────────────────┐
                        │              Barbex UI / Routes              │
                        │    (Pages, Modals, Forms, Drawers, Tabs)    │
                        └──────┬──────────────┬──────────────┬─────────┘
                               │              │              │
                               ▼              ▼              ▼
                    ┌──────────────────┐ ┌──────────┐ ┌────────────────┐
                    │  Direct Client   │ │   RPC    │ │ Edge Function  │
                    │   + RLS Engine   │ │ Adapters │ │    Adapters    │
                    │ (backend/client/)│ │(backend/ │ │ (backend/edge/)│
                    │                  │ │  rpc/)   │ │                │
                    └────────┬─────────┘ └────┬─────┘ └────────┬───────┘
                             │                │                │
                             ▼                ▼                ▼
                    ┌──────────────────┐ ┌──────────┐ ┌────────────────┐
                    │ PostgreSQL RLS   │ │Postgres  │ │ Supabase Edge  │
                    │  Direct Queries  │ │   RPC    │ │   Functions    │
                    └──────────────────┘ └──────────┘ └────────────────┘
```

---

## 3. Implemented Adapters Directory Map

### A. Edge Gateway & Shared Client (`src/lib/backend/edge-client.ts`)
- **Transport**: Standardized wrapper around `supabase.functions.invoke`.
- **Token Handling**: Automatic Bearer token attachment from active Supabase session.
- **Error Normalization**: Bounded, sanitized client error DTOs.
- **Circuit Breaker**: Prevents duplicate concurrent calls for idempotent actions.

### B. Edge Function Adapters (`src/lib/backend/edge/`)
| Adapter File | Target Edge Function | Responsibilities | Security Boundaries |
| :--- | :--- | :--- | :--- |
| `auth.ts` | `auth-phone`, `auth-phone-reset` | Staff & customer phone authentication, challenge verification, password recovery. | Rate limited per IP/phone, anti-enumeration. |
| `staff.ts` | `staff-auth` | Staff verification, 6-digit email challenges, credentials setup. | Tenant-bound, challenge expiration (10 min). |
| `team.ts` | `team-invitations` | Team member invitation dispatch, token validation, invitation acceptance. | Tenant isolation, admin-only dispatch. |
| `stripe.ts` | `stripe-checkout`, `stripe-addons`, `stripe-portal` | Checkout session creation, add-on previews, subscriptions, cancel/reactivate, billing portal. | Tenant owner validation, strict idempotency keys. |
| `zapi.ts` | `zapi-send` | WhatsApp test and transactional message dispatch. | Instance validation, client token verification. |
| `email.ts` | `send-email` | Transactional email dispatch via Resend templates. | Template allowlist, HTML sanitization, rate limiting. |
| `push.ts` | `send-push` | Web Push notification dispatch and subscription registration. | VAPID payload boundary, tenant & recipient scoping. |

### C. Background Jobs RPC Adapter (`src/lib/backend/rpc/jobs.ts`)
| Function | Target PostgreSQL RPC | Role |
| :--- | :--- | :--- |
| `enqueueBackgroundJobClient` | `enqueue_background_job_safe` | Enqueues background jobs with queue allowlist validation. |
| `reconcileStuckJobsClient` | `reconcile_stuck_background_jobs` | Recovers orphaned or stalled background jobs. |

### D. Direct Client + RLS Adapters (`src/lib/backend/client/`)
| Module | Exported Operations | RLS / Table Scoping |
| :--- | :--- | :--- |
| `academy.ts` | `getAcademyPathsClient`, `getAcademyPathDetailsClient`, `markLessonProgressClient`, `getRecommendedPathsClient` | `academy_paths`, `academy_lessons`, `academy_progress` |
| `profile.ts` | `updateMyProfileClient` | `profiles` (self-only via `auth.uid()`) |
| `time-off.ts` | `checkTimeOffConflictsClient` | `barber_time_off` (tenant-scoped) |
| `knowledge-base.ts` | `adminSaveTutorialClient`, `adminSaveAcademyLessonClient`, `adminSaveUpdateClient`, `reportContentViewClient` | `kb_articles`, `academy_lessons`, `changelog_entries` |
| `bi.ts` | `getBIAnalyticsClient` | Aggregates appointments, revenue, and clients per tenant |
| `integrations.ts` | `getIntegrationHealthClient` | Checks status of tenant integrations (Z-API, Resend, Stripe) |
| `marketing.ts` | `getPredictiveRecommendationsClient`, `getRevenueProjectionsClient`, `getServiceTrendsClient` | `marketing_campaigns`, tenant appointment trends |
| `security.ts` | `getSecurityOverviewClient` | Security metrics, active sessions, MFA health |
| `communications.ts` | `getChannelsClient`, `getMessagesClient`, `getTemplatesClient`, `updateChannelStatusClient` | `communication_channels`, `communication_messages`, `communication_templates` |

---

## 4. UI & Routes Migration Manifest

The following 38 components and routes were updated from `createServerFn` to the canonical backend adapters:

1. **Authentication & Team**:
   - `src/components/auth/AuthForm.tsx` -> `@/lib/backend/edge/auth`
   - `src/components/auth/StaffMigrationModal.tsx` -> `@/lib/backend/edge/staff`, `@/lib/backend/edge/auth`
   - `src/components/public/auth/ClientLoginForm.tsx` -> `@/lib/backend/edge/auth`
   - `src/routes/auth.reset-password.tsx` -> `supabase.auth.updateUser` native auth
   - `src/components/team/AddUserModal.tsx` -> `@/lib/backend/edge/team`
   - `src/routes/invite.$token.tsx` -> `@/lib/backend/edge/team`
   - `src/routes/dashboard.usuarios.tsx` -> `@/lib/backend/edge/team`

2. **Stripe & Subscriptions**:
   - `src/components/StripeEmbeddedCheckout.tsx` -> `@/lib/backend/edge/stripe`
   - `src/components/subscription/AddonsCartDrawer.tsx` -> `@/lib/backend/edge/stripe`
   - `src/components/subscription/SubscribeAddonDialog.tsx` -> `@/lib/backend/edge/stripe`
   - `src/components/subscription/YourAddons.tsx` -> `@/lib/backend/edge/stripe`
   - `src/routes/admin.addons.tsx` -> `@/lib/backend/edge/stripe`
   - `src/routes/subscription.index.tsx` -> `@/lib/backend/edge/stripe`

3. **Communications & Z-API**:
   - `src/components/integrations/ZApiWhatsAppCard.tsx` -> `@/lib/backend/edge/zapi`
   - `src/components/integrations/ResendSettingsCard.tsx` -> `@/lib/backend/edge/email`
   - `src/components/communications/ChannelManager.tsx` -> `@/lib/backend/client/communications`
   - `src/components/communications/CommunicationOverview.tsx` -> `@/lib/backend/client/communications`
   - `src/components/communications/DeadLetterQueue.tsx` -> `@/lib/backend/client/communications`
   - `src/components/communications/DeliveryFailures.tsx` -> `@/lib/backend/client/communications`
   - `src/components/communications/TemplateManager.tsx` -> `@/lib/backend/client/communications`
   - `src/components/communications/UnifiedInbox.tsx` -> `@/lib/backend/client/communications`
   - `src/utils/whatsapp.ts` -> `@/lib/backend/edge/zapi`
   - `src/routes/integrations.tsx` -> `@/lib/backend/edge/email`, `@/lib/backend/edge/zapi`
   - `src/routes/dashboard.integracoes.tsx` -> `@/lib/backend/client/integrations`

4. **Marketing, BI & Analytics**:
   - `src/components/marketing-hub/MarketingAIAdvisor.tsx` -> `@/lib/backend/client/marketing`
   - `src/components/marketing-hub/PredictiveTrends.tsx` -> `@/lib/backend/client/marketing`
   - `src/routes/dashboard.bi.tsx` -> `@/lib/backend/client/bi`

5. **Academy, Knowledge Base & Profiles**:
   - `src/routes/academy.tsx` -> `@/lib/backend/client/academy`
   - `src/routes/academy.$pathId.tsx` -> `@/lib/backend/client/academy`
   - `src/routes/academy.$pathId.lessons.$lessonId.tsx` -> `@/lib/backend/client/academy`
   - `src/routes/admin.knowledge-base.tsx` -> `@/lib/backend/client/knowledge-base`
   - `src/components/profile/EditProfileModal.tsx` -> `@/lib/backend/client/profile`
   - `src/components/barbers/ProfessionalTimeOffDialog.tsx` -> `@/lib/backend/client/time-off`

6. **Observability, Security & Quick-Wins**:
   - `src/routes/admin.seguranca.tsx` -> `@/lib/backend/client/security`
   - `src/routes/admin.observability.tsx` -> `@/lib/backend/quick-wins`
   - `src/components/admin/automations/AutomationTestModal.tsx` -> `@/lib/backend/rpc/jobs`
   - `src/lib/backend/quick-wins.ts` -> native supabase client refactor

---

## 5. Canonical AST Scanner & Residual ServerFn Status

Audited via `scratch/test_m6h8_legacy_decommission.mjs`:
- **Total `createServerFn` defined in source**: 141
- **Dead / Uncalled functions**: 115
- **Residual active functions**: 26

### Residual 26 Classification:
| Status | Count | Functions | Next Step |
| :--- | :--- | :--- | :--- |
| `MIGRATED_NATIVE_AUTH` | 8 | `getMFAChallenge`, `verifyMFAChallenge`, `updatePassword`, `requestEmailChange`, `listSessions`, `enrollMFA`, `verifyMFA`, `unenrollMFA`, `getMFAStatus`, `listFactors` | Safe to drop server definitions; frontend uses Supabase Auth SDK. |
| `MIGRATED_EDGE` | 3 | `requestEmailVerification`, `verifyEmailCode`, `finalizeAuthSetup` | Superseeded by `staff-auth` Edge Function. |
| `KEEP_NITRO_TEMPORARILY` | 13 | Backup codes (`verifyBackupCode`, `generateBackupCodes`, `listBackupCodes`), Security audit (`getSecurityLogs`), Public contact & settings (`submitPublicContactMessage`, `getPlatformPublicSettings`), Subscriptions gateway (`testGatewayConnection`, `createCustomerSubscription`), Admin upgrade (`listAdminUpgradeRecommendations`), LGPD requests (`adminListLgpdRequests`, `adminResolveLgpdRequest`) | Kept active on Nitro during wave M6H; planned for M6I final consolidation. |
| `REQUIRES_NEW_EDGE` | 2 | `askAdminAssistant` (AI Admin Assistant), `suggestLoyaltyCampaigns` (Loyalty Campaigns) | Require `LOVABLE_API_KEY` edge function adapter before Nitro cutover. |

---

## 6. Verification & Test Evidence

All automated verification test suites execute cleanly against the target shadow baseline:

| Test Suite | Wave | Assertions | Status | Focus Area |
| :--- | :--- | :--- | :--- | :--- |
| `test_m6h2_auth_adapter.mjs` | M6H.2 | 75 | **100% PASS** | Auth Phone & Reset Edge invocation |
| `test_m6h3_team_staff_adapter.mjs` | M6H.3 | 88 | **100% PASS** | Team invitations & Staff auth verification |
| `test_m6h4_stripe_adapter.mjs` | M6H.4 | 64 | **100% PASS** | Stripe Checkout, Addons & Webhooks |
| `test_m6h5_zapi_adapter.mjs` | M6H.5 | 58 | **100% PASS** | Z-API WhatsApp dispatch & Webhook handling |
| `test_m6h6_email_push_jobs_adapter.mjs` | M6H.6 | 107 | **100% PASS** | Resend, Push and Job Engine |
| `test_m6h7_direct_rpc_migration.mjs` | M6H.7 | 69 | **100% PASS** | Direct Client + RLS (Academy, BI, KB, etc.) |
| `test_m6h8_legacy_decommission.mjs` | M6H.8 | 82 | **100% PASS** | AST reconciliation, Zero-secret leak, Readiness |

### Secret Leak Audit:
- Scanned `src/lib/backend/client/` and frontend components for forbidden keys (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `ZAPI_TOKEN`, `VAPID_PRIVATE_KEY`, `LOVABLE_API_KEY`).
- **Result**: **0 secrets exposed in client bundle**.
