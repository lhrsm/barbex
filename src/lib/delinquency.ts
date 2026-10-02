/**
 * BARBEX — DELINQUENCY & GRACE UX RESOLVER
 * R2E.15B: Centralized canonical delinquency resolution and display utilities.
 *
 * NOTE: Frontend evaluation is purely for presentation, countdown, and user guidance.
 * Authoritative commercial access enforcement remains strictly in PostgreSQL has_module_access.
 */

export type DelinquencyState = "NOT_APPLICABLE" | "IN_GRACE" | "GRACE_EXPIRED" | "RECOVERY_PENDING";

export interface SubscriptionDelinquencyInput {
  status?: string | null;
  pastDueSince?: string | null;
  graceEndsAt?: string | null;
  paymentFailedAt?: string | null;
  isRecoveryPending?: boolean;
}

export interface DelinquencyResolution {
  state: DelinquencyState;
  isDelinquent: boolean;
  isInGrace: boolean;
  isGraceExpired: boolean;
  isRecoveryPending: boolean;
  deadlineDisplay: string;
  countdownDisplay: string;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  hasValidGraceMetadata: boolean;
}

export const BILLING_AUTHORIZED_ROLES = [
  "super_admin",
  "admin",
  "tenant_admin",
  "shop_owner",
] as const;

export type BillingAuthorizedRole = (typeof BILLING_AUTHORIZED_ROLES)[number];

/**
 * Validates whether the given role has authority to perform billing actions (e.g. open Stripe Portal).
 * Enforces strict denial during impersonation to prevent cross-tenant billing operations.
 */
export function canManageBilling(
  role: string | null | undefined,
  isImpersonating: boolean = false,
): boolean {
  if (!role) return false;
  if (isImpersonating) return false;
  return BILLING_AUTHORIZED_ROLES.includes(role as BillingAuthorizedRole);
}

/**
 * Formats a timestamp into Brazilian Portuguese presentation: DD/MM/YYYY às HH:mm (America/Sao_Paulo)
 */
export function formatGraceDeadline(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  try {
    const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const datePart = dateFormatter.format(date);
    const timePart = timeFormatter.format(date);

    return `${datePart} às ${timePart}`;
  } catch {
    // Fallback if timezone formatting fails
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}

/**
 * Computes human-friendly informational countdown for the remaining Grace Period.
 * Purely informational; backend has_module_access remains the sole security authority.
 */
export function formatGraceCountdown(
  graceEndsAt: string | null | undefined,
  now: Date = new Date(),
): {
  countdownText: string;
  isExpired: boolean;
  days: number;
  hours: number;
  minutes: number;
} {
  if (!graceEndsAt) {
    return {
      countdownText: "Período de carência encerrado",
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
    };
  }

  const end = new Date(graceEndsAt);
  if (isNaN(end.getTime())) {
    return {
      countdownText: "Período de carência encerrado",
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
    };
  }

  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) {
    return {
      countdownText: "Período de carência encerrado",
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
    };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  const remainingMinutes = totalMinutes % 60;

  let countdownText = "";
  if (days > 1) {
    countdownText = `${days} dias restantes`;
  } else if (days === 1) {
    countdownText =
      remainingHours > 0
        ? `1 dia e ${remainingHours} ${remainingHours === 1 ? "hora restante" : "horas restantes"}`
        : "1 dia restante";
  } else if (totalHours >= 1) {
    countdownText = `${totalHours} ${totalHours === 1 ? "hora restante" : "horas restantes"}`;
  } else {
    countdownText = "menos de 1 hora restante";
  }

  return {
    countdownText,
    isExpired: false,
    days,
    hours: remainingHours,
    minutes: remainingMinutes,
  };
}

/**
 * Resolves the canonical delinquency state for a subscription.
 * Fails closed if grace_ends_at is missing/corrupted when status is past_due.
 */
export function resolveDelinquencyState(
  input: SubscriptionDelinquencyInput | null | undefined,
  now: Date = new Date(),
): DelinquencyResolution {
  const status = (input?.status || "").toLowerCase().trim();

  // If status is not past_due, delinquency is NOT_APPLICABLE
  if (status !== "past_due") {
    if (input?.isRecoveryPending) {
      return {
        state: "RECOVERY_PENDING",
        isDelinquent: false,
        isInGrace: false,
        isGraceExpired: false,
        isRecoveryPending: true,
        deadlineDisplay: "",
        countdownDisplay: "",
        daysRemaining: 0,
        hoursRemaining: 0,
        minutesRemaining: 0,
        hasValidGraceMetadata: false,
      };
    }

    return {
      state: "NOT_APPLICABLE",
      isDelinquent: false,
      isInGrace: false,
      isGraceExpired: false,
      isRecoveryPending: false,
      deadlineDisplay: "",
      countdownDisplay: "",
      daysRemaining: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      hasValidGraceMetadata: false,
    };
  }

  // status === 'past_due'
  const graceEndsAtStr = input?.graceEndsAt;

  // Fail-closed rule: if grace_ends_at is missing or invalid, fail closed -> GRACE_EXPIRED
  if (!graceEndsAtStr) {
    return {
      state: "GRACE_EXPIRED",
      isDelinquent: true,
      isInGrace: false,
      isGraceExpired: true,
      isRecoveryPending: !!input?.isRecoveryPending,
      deadlineDisplay: "",
      countdownDisplay: "Período de carência encerrado",
      daysRemaining: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      hasValidGraceMetadata: false,
    };
  }

  const graceEndsAtDate = new Date(graceEndsAtStr);
  if (isNaN(graceEndsAtDate.getTime())) {
    return {
      state: "GRACE_EXPIRED",
      isDelinquent: true,
      isInGrace: false,
      isGraceExpired: true,
      isRecoveryPending: !!input?.isRecoveryPending,
      deadlineDisplay: "",
      countdownDisplay: "Período de carência encerrado",
      daysRemaining: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      hasValidGraceMetadata: false,
    };
  }

  const countdown = formatGraceCountdown(graceEndsAtStr, now);
  const deadlineDisplay = formatGraceDeadline(graceEndsAtStr);

  if (countdown.isExpired) {
    return {
      state: "GRACE_EXPIRED",
      isDelinquent: true,
      isInGrace: false,
      isGraceExpired: true,
      isRecoveryPending: !!input?.isRecoveryPending,
      deadlineDisplay,
      countdownDisplay: countdown.countdownText,
      daysRemaining: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      hasValidGraceMetadata: true,
    };
  }

  // Still within Grace period
  return {
    state: "IN_GRACE",
    isDelinquent: true,
    isInGrace: true,
    isGraceExpired: false,
    isRecoveryPending: !!input?.isRecoveryPending,
    deadlineDisplay,
    countdownDisplay: countdown.countdownText,
    daysRemaining: countdown.days,
    hoursRemaining: countdown.hours,
    minutesRemaining: countdown.minutes,
    hasValidGraceMetadata: true,
  };
}
