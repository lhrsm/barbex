# BARBEX — PRE-PHASE 17C SERVER FUNCTIONS INVENTORY

**Baseline Commit:** `50b6e5390cf60c247f850d357aba77b8b9d52819`  
**Purpose:** Comprehensive catalog of all existing `@tanstack/react-start` Server Functions (`createServerFn`) prior to any backend / Edge Function migration.

---

## 1. Authentication & Security Functions

| Function Name | Source File | Method | Auth Required | Supabase Admin | External Service | Writes DB |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `signInWithPhone` | `src/lib/auth-phone.functions.ts` | POST | No (Public) | Yes | GoTrue | No |
| `requestPasswordResetByPhone` | `src/lib/auth-phone.functions.ts` | POST | No (Public) | Yes | GoTrue | No |
| `signInCustomerWithPhone` | `src/lib/auth-customer.functions.ts` | POST | No (Public) | Yes | GoTrue | No |
| `requestCustomerPasswordResetByPhone` | `src/lib/auth-customer.functions.ts` | POST | No (Public) | Yes | GoTrue | No |
| `clientLogin` | `src/lib/auth-client.functions.ts` | POST | No (Public) | No | GoTrue | No |
| `requestPasswordReset` | `src/lib/auth-client.functions.ts` | POST | No (Public) | No | GoTrue | No |
| `validateResetToken` | `src/lib/auth-client.functions.ts` | POST | No (Public) | No | None | No |
| `updatePassword` | `src/lib/auth-client.functions.ts` | POST | Yes (Auth) | No | GoTrue | Yes |
| `requestStaffEmailVerification` | `src/lib/staff-auth.functions.ts` | POST | No (Public) | Yes | Resend | Yes |
| `verifyStaffEmailCode` | `src/lib/staff-auth.functions.ts` | POST | No (Public) | Yes | None | Yes |
| `finalizeStaffAuthSetup` | `src/lib/staff-auth.functions.ts` | POST | No (Public) | Yes | GoTrue | Yes |
| `getMFAStatus` | `src/lib/security-mfa.functions.ts` | GET | Yes (Auth) | Yes | None | No |
| `enrollMFA` | `src/lib/security-mfa.functions.ts` | POST | Yes (Auth) | Yes | None | Yes |
| `verifyMFAEnrollment` | `src/lib/security-mfa.functions.ts` | POST | Yes (Auth) | Yes | None | Yes |
| `disableMFA` | `src/lib/security-mfa.functions.ts` | POST | Yes (Auth) | Yes | None | Yes |
| `generateMFABackupCodes` | `src/lib/security-mfa.functions.ts` | POST | Yes (Auth) | Yes | None | Yes |

---

## 2. Team & Reception Functions

| Function Name | Source File | Method | Auth Required | Supabase Admin | External Service | Writes DB |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `inviteTeamMember` | `src/lib/team.functions.ts` | POST | Yes (Admin) | Yes | Resend | Yes |
| `resendTeamInvitation` | `src/lib/team.functions.ts` | POST | Yes (Admin) | Yes | Resend | Yes |
| `revokeTeamInvitation` | `src/lib/team.functions.ts` | POST | Yes (Admin) | Yes | None | Yes |
| `getTeamMembers` | `src/lib/team.functions.ts` | GET | Yes (Staff) | Yes | None | No |
| `getPendingInvitations` | `src/lib/team.functions.ts` | GET | Yes (Staff) | Yes | None | No |
| `validateInvitationToken` | `src/lib/team.functions.ts` | GET | No (Public) | Yes | None | No |
| `acceptTeamInvitation` | `src/lib/team.functions.ts` | POST | No (Public) | Yes | GoTrue | Yes |

---

## 3. Payments & Addons Functions

| Function Name | Source File | Method | Auth Required | Supabase Admin | External Service | Writes DB |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `createCheckoutSession` | `src/utils/payments.functions.ts` | POST | Yes (Auth) | Yes | Stripe | Yes |
| `createPlanCheckout` | `src/utils/payments.functions.ts` | POST | Yes (Auth) | Yes | Stripe | Yes |
| `createPortalSession` | `src/utils/payments.functions.ts` | POST | Yes (Auth) | Yes | Stripe | No |
| `previewAddon` | `src/utils/addons.functions.ts` | POST | Yes (Auth) | Yes | Stripe | No |
| `subscribeToAddon` | `src/utils/addons.functions.ts` | POST | Yes (Auth) | Yes | Stripe | Yes |
| `cancelAddon` | `src/utils/addons.functions.ts` | POST | Yes (Auth) | Yes | Stripe | Yes |
| `reactivateAddon` | `src/utils/addons.functions.ts` | POST | Yes (Auth) | Yes | Stripe | Yes |
| `updateAddonQuantity` | `src/utils/addons.functions.ts` | POST | Yes (Auth) | Yes | Stripe | Yes |
| `adminCreateAddonStripePrice` | `src/utils/addons.functions.ts` | POST | Yes (Super Admin) | Yes | Stripe | Yes |
| `subscribeToAddonsBatch` | `src/utils/addons.functions.ts` | POST | Yes (Auth) | Yes | Stripe | Yes |
| `previewAddonsBatch` | `src/utils/addons.functions.ts` | POST | Yes (Auth) | Yes | Stripe | No |

---

## 4. Scalability, Jobs & Maintenance Functions

| Function Name | Source File | Method | Auth Required | Supabase Admin | External Service | Writes DB |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `enqueueJob` | `src/lib/scalability-jobs.functions.ts` | POST | Yes (Auth) | Yes | None | Yes |
| `processNextJob` | `src/lib/scalability-jobs.functions.ts` | POST | Yes (Auth) | Yes | None | Yes |
| `getSystemHealth` | `src/lib/scalability.functions.ts` | GET | Yes (Admin) | Yes | None | No |
| `getScalabilityMetrics` | `src/lib/scalability.functions.ts` | GET | Yes (Admin) | Yes | None | No |
| `runAutoHealingDiagnostic` | `src/lib/scalability.functions.ts` | POST | Yes (Admin) | Yes | None | Yes |

---

## 5. Trust, Privacy (LGPD) & Time-Off Functions

| Function Name | Source File | Method | Auth Required | Supabase Admin | External Service | Writes DB |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `getLGPDStatus` | `src/lib/security-lgpd.functions.ts` | GET | Yes (Auth) | Yes | None | No |
| `requestDataExport` | `src/lib/security-lgpd.functions.ts` | POST | Yes (Auth) | Yes | None | Yes |
| `processErasureRequest` | `src/lib/security-lgpd.functions.ts` | POST | Yes (Admin) | Yes | None | Yes |
| `listSubprocessors` | `src/lib/trust.functions.ts` | GET | No (Public) | No | None | No |
| `submitCookieConsent` | `src/lib/trust.functions.ts` | POST | No (Public) | No | None | Yes |
| `submitLgpdRequest` | `src/lib/trust.functions.ts` | POST | No (Public) | Yes | None | Yes |
| `myLgpdHistory` | `src/lib/trust.functions.ts` | GET | Yes (Auth) | Yes | None | No |
| `adminListLgpdRequests` | `src/lib/trust.functions.ts` | GET | Yes (Admin) | Yes | None | No |
| `adminResolveLgpdRequest` | `src/lib/trust.functions.ts` | POST | Yes (Admin) | Yes | None | Yes |
| `getTimeOff` | `src/lib/time-off.functions.ts` | GET | Yes (Staff) | Yes | None | No |
| `createTimeOff` | `src/lib/time-off.functions.ts` | POST | Yes (Staff) | Yes | None | Yes |
| `updateTimeOff` | `src/lib/time-off.functions.ts` | POST | Yes (Staff) | Yes | None | Yes |
| `deleteTimeOff` | `src/lib/time-off.functions.ts` | POST | Yes (Staff) | Yes | None | Yes |
| `checkConflicts` | `src/lib/time-off.functions.ts` | GET | Yes (Staff) | Yes | None | No |
