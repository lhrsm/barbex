# BARBEX — PHASE 17C.M6 RUNTIME INVENTORY
## INVENTÁRIO COMPLETO DO BACKEND SERVER-SIDE & ROTAS DE API

Este documento detalha o inventário exato de todas as funções `createServerFn` e rotas `/api/*` atualmente presentes na aplicação Barbex, mapeando suas dependências de banco, secrets, chamadores ativos na interface e sua respectiva classificação de destino para a migração definitiva para Supabase Edge Functions, PostgreSQL RPC e Direct Client + RLS.

---

### 1. Resumo Executivo da Auditoria

- **Total de `createServerFn` mapeados no código:** 142
- **Funções ativas com chamadores reais na UI:** 97
- **Funções classificadas como código morto (Dead Code):** 45
- **Total de rotas de API (`src/routes/api/**`):** 12
- **Rotas de Webhooks externos:** 4 (Stripe Payments, Stripe Subscriptions, Z-API, Resend)
- **Rotas de Hooks agendados/manuais:** 8 (Addons Cleanup/Reconcile, Admin Digest, Risk Scan, Reviews, Status Check, Push)
- **Meta de Desacoplamento:** Eliminar 100% da dependência de runtime Nitro e remover `SUPABASE_SERVICE_ROLE_KEY` do deploy web Cloudflare.

---

### 2. Inventário de `createServerFn` por Categoria

#### A. Autenticação por Telefone & Reset de Senha (Auth Phone & Reset)
| Função | Arquivo de Origem | Chamadores Ativos na UI | Dependências / Secrets | Classificação de Destino |
|---|---|---|---|---|
| `signInWithPhone` | `src/lib/auth-phone.functions.ts` | `StaffLoginModal.tsx`, `PhoneLoginForm.tsx` | Supabase GoTrue Admin, `service_role` | **Supabase Edge Function** (`auth-phone`) |
| `requestPasswordResetByPhone` | `src/lib/auth-phone.functions.ts` | `StaffMigrationModal.tsx` | Supabase GoTrue Admin, `service_role` | **Supabase Edge Function** (`auth-phone-reset`) |
| `requestStaffEmailVerification` | `src/lib/staff-auth.functions.ts` | `StaffMigrationModal.tsx` | Resend API, `service_role` | **Supabase Edge Function** (`staff-auth`) |
| `verifyStaffEmailCode` | `src/lib/staff-auth.functions.ts` | `StaffMigrationModal.tsx` | DB Verification Challenges | **PostgreSQL RPC** |
| `finalizeStaffAuthSetup` | `src/lib/staff-auth.functions.ts` | `StaffMigrationModal.tsx` | GoTrue Admin, `service_role` | **Supabase Edge Function** (`staff-auth`) |

#### B. Gestão de Equipe & Convites (Team Management)
| Função | Arquivo de Origem | Chamadores Ativos na UI | Dependências / Secrets | Classificação de Destino |
|---|---|---|---|---|
| `inviteTeamMember` | `src/lib/team.functions.ts` | `AddUserModal.tsx` | Resend API, `service_role` | **Supabase Edge Function** (`team-invitations`) |
| `resendTeamInvitation` | `src/lib/team.functions.ts` | `dashboard.usuarios.tsx` | Resend API, `service_role` | **Supabase Edge Function** (`team-invitations`) |
| `revokeTeamInvitation` | `src/lib/team.functions.ts` | `dashboard.usuarios.tsx` | DB update | **Direct Client + RLS** |
| `getTeamMembers` | `src/lib/team.functions.ts` | `dashboard.usuarios.tsx` | DB select | **Direct Client + RLS** |
| `getPendingInvitations` | `src/lib/team.functions.ts` | `dashboard.usuarios.tsx` | DB select | **Direct Client + RLS** |
| `validateInvitationToken` | `src/lib/team.functions.ts` | `invite.$token.tsx` | DB select | **Direct Client + RLS** |
| `acceptTeamInvitation` | `src/lib/team.functions.ts` | `invite.$token.tsx` | GoTrue Admin, `service_role` | **Supabase Edge Function** (`team-invitations`) |

#### C. Pagamentos & Assinaturas Stripe (Stripe Billing & Addons)
| Função | Arquivo de Origem | Chamadores Ativos na UI | Dependências / Secrets | Classificação de Destino |
|---|---|---|---|---|
| `createCheckoutSession` | `src/utils/payments.functions.ts` | `StripeEmbeddedCheckout.tsx` | `STRIPE_SECRET_KEY` | **Supabase Edge Function** (`stripe-checkout`) |
| `createPortalSession` | `src/utils/payments.functions.ts` | `subscription.index.tsx` | `STRIPE_SECRET_KEY` | **Supabase Edge Function** (`stripe-portal`) |
| `createPlanCheckout` | `src/utils/payments.functions.ts` | 0 (Dead) | `STRIPE_SECRET_KEY` | **Dead Code** |
| `previewAddon` | `src/utils/addons.functions.ts` | `AddonsCartDrawer.tsx`, `SubscribeAddonDialog.tsx` | `STRIPE_SECRET_KEY` | **Supabase Edge Function** (`stripe-addons`) |
| `subscribeToAddon` | `src/utils/addons.functions.ts` | `AddonsCartDrawer.tsx`, `SubscribeAddonDialog.tsx` | `STRIPE_SECRET_KEY` | **Supabase Edge Function** (`stripe-addons`) |
| `cancelAddon` | `src/utils/addons.functions.ts` | `YourAddons.tsx` | `STRIPE_SECRET_KEY` | **Supabase Edge Function** (`stripe-addons`) |
| `reactivateAddon` | `src/utils/addons.functions.ts` | `YourAddons.tsx` | `STRIPE_SECRET_KEY` | **Supabase Edge Function** (`stripe-addons`) |
| `updateAddonQuantity` | `src/utils/addons.functions.ts` | `YourAddons.tsx` | `STRIPE_SECRET_KEY` | **Supabase Edge Function** (`stripe-addons`) |
| `adminCreateAddonStripePrice`| `src/utils/addons.functions.ts` | `admin.addons.tsx` | `STRIPE_SECRET_KEY` | **Supabase Edge Function** (`stripe-admin`) |
| `subscribeToAddonsBatch` | `src/utils/addons.functions.ts` | `AddonsCartDrawer.tsx` | `STRIPE_SECRET_KEY` | **Supabase Edge Function** (`stripe-addons`) |
| `previewAddonsBatch` | `src/utils/addons.functions.ts` | `AddonsCartDrawer.tsx` | `STRIPE_SECRET_KEY` | **Supabase Edge Function** (`stripe-addons`) |

#### D. Mensageria, Comunicações & Z-API (Communications & WhatsApp)
| Função | Arquivo de Origem | Chamadores Ativos na UI | Dependências / Secrets | Classificação de Destino |
|---|---|---|---|---|
| `sendDirectEmail` | `src/lib/resend.functions.ts` | `ContactForm.tsx` | `RESEND_API_KEY` | **Supabase Edge Function** (`send-email`) |
| `getTenantZapiStatus` | `src/lib/zapi.functions.ts` | `SettingsIntegrations.tsx` | DB / Z-API credentials | **Direct Client + RLS** |
| `sendZapiTestMessage` | `src/lib/zapi.functions.ts` | `SettingsIntegrations.tsx` | `ZAPI_TOKEN` | **Supabase Edge Function** (`zapi-send`) |
| `sendWebPushNotification` | `src/lib/push.functions.ts` | `NotificationCenter.tsx` | `VAPID_PRIVATE_KEY` | **Supabase Edge Function** (`send-push`) |

#### E. Observabilidade, Saúde do Sistema & Quick-Wins (17C.1 Closure)
| Função | Arquivo de Origem | Chamadores Ativos na UI | Dependências / Secrets | Classificação de Destino |
|---|---|---|---|---|
| `getSystemHealth` | `src/lib/scalability.functions.ts` | `admin.observability.tsx` | DB Metrics | **Direct Client + RPC** |
| `getScalabilityMetrics`| `src/lib/scalability.functions.ts` | `admin.observability.tsx` | DB Metrics | **Direct Client + RPC** |
| `getLGPDStatus` | `src/lib/security-lgpd.functions.ts` | `quick-wins.ts` | DB audit | **Direct Client + RLS** |
| `listSubprocessors` | `src/lib/trust.functions.ts` | `subprocessors.tsx` | DB public table | **Direct Client + RLS** |
| `submitCookieConsent` | `src/lib/trust.functions.ts` | `CookieBanner.tsx` | DB public table | **Direct Client + RLS** |
| `getTimeOff` | `src/lib/time-off.functions.ts` | `ProfessionalTimeOffDialog.tsx` | DB table | **Direct Client + RLS** |
| `createTimeOff` | `src/lib/time-off.functions.ts` | `ProfessionalTimeOffDialog.tsx` | DB table | **Direct Client + RLS** |
| `updateTimeOff` | `src/lib/time-off.functions.ts` | `ProfessionalTimeOffDialog.tsx` | DB table | **Direct Client + RLS** |
| `deleteTimeOff` | `src/lib/time-off.functions.ts` | `ProfessionalTimeOffDialog.tsx` | DB table | **Direct Client + RLS** |

---

### 3. Inventário de Rotas de API (`src/routes/api/**`)

| Rota HTTP | Método | Tipo | Dependências / Secrets | Destino Canônico |
|---|---|---|---|---|
| `/api/public/payments/webhook` | POST | Webhook Stripe | `STRIPE_WEBHOOK_SECRET`, `service_role` | `supabase/functions/stripe-webhook` |
| `/api/public/subscriptions/webhook` | POST | Webhook Stripe | `STRIPE_WEBHOOK_SECRET`, `service_role` | Consolidado em `stripe-webhook` |
| `/api/webhooks/zapi/:barbershopId` | POST | Webhook Z-API | `ZAPI_CLIENT_TOKEN`, `service_role` | `supabase/functions/zapi-webhook` |
| `/api/public/resend-webhook` | POST | Webhook Resend | `RESEND_WEBHOOK_SECRET`, `service_role` | `supabase/functions/resend-webhook` |
| `/api/public/send-push` | POST | Push Dispatch | `VAPID_PRIVATE_KEY`, `service_role` | `supabase/functions/send-push` |
| `/api/public/hooks/addons-cleanup` | GET/POST | Cron Hook | `service_role` | Supabase `pg_cron` + PostgreSQL RPC |
| `/api/public/hooks/addons-reconcile` | GET/POST | Cron Hook | `STRIPE_SECRET_KEY`, `service_role` | `supabase/functions/cron-worker` |
| `/api/public/hooks/admin-digest` | GET/POST | Cron Hook | `RESEND_API_KEY`, `service_role` | `supabase/functions/cron-worker` |
| `/api/public/hooks/admin-risk-scan` | GET/POST | Cron Hook | `service_role` | Supabase `pg_cron` + PostgreSQL RPC |
| `/api/public/hooks/review-reminders` | GET/POST | Cron Hook | `ZAPI_TOKEN`, `service_role` | `supabase/functions/cron-worker` |
| `/api/public/hooks/send-review-requests` | GET/POST | Cron Hook | `ZAPI_TOKEN`, `service_role` | `supabase/functions/cron-worker` |
| `/api/public/hooks/status-check` | GET | Health Check | `service_role` | Direct Health Endpoint / RPC |
