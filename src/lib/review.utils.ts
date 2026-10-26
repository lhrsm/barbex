/**
 * Utilitário canônico de resolução de estado do ciclo de avaliação do cliente.
 * Compartilhado entre AppointmentsTab, HomeTab e demais componentes do portal.
 */

export type ReviewDecisionState =
  | 'PENDING_DECISION'
  | 'REVIEW_SUBMITTED'
  | 'REVIEW_SKIPPED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

export interface ResolvedReviewState {
  state: ReviewDecisionState;
  decision: 'pending' | 'submitted' | 'skipped' | null;
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  canReview: boolean;
  canSkip: boolean;
  label: string;
}

export function resolveReviewState(app: any, reviewsStatus?: 'success' | 'error'): ResolvedReviewState {
  if (!app || app.status !== "completed") {
    return {
      state: "NOT_APPLICABLE",
      decision: null,
      canReview: false,
      canSkip: false,
      label: "",
    };
  }

  // 1. Fail-closed: se a query de reviews falhou no portal
  if (app.reviewStatus === "unknown" || reviewsStatus === "error") {
    return {
      state: "UNKNOWN",
      decision: null,
      canReview: false,
      canSkip: false,
      label: "Avaliação Indisponível",
    };
  }

  // 2. Recusa explícita do cliente (prioridade absoluta)
  if (app.review_decision === "skipped") {
    return {
      state: "REVIEW_SKIPPED",
      decision: "skipped",
      canReview: false,
      canSkip: false,
      label: "Sem avaliação",
    };
  }

  // 3. Avaliação enviada (via relação appointment_reviews, flag ou reviewStatus)
  const rawReview = (Array.isArray(app.appointment_reviews) && app.appointment_reviews.length > 0)
    ? app.appointment_reviews[0]
    : (app.review || (!Array.isArray(app.appointment_reviews) ? app.appointment_reviews : null));

  const isRealReview = Boolean(
    rawReview && (
      rawReview.submitted_at ||
      (rawReview.rating != null && Number(rawReview.rating) > 0) ||
      rawReview.barbershop_rating != null ||
      rawReview.service_rating != null ||
      rawReview.barber_rating != null ||
      rawReview.testimonial_status === "approved" ||
      rawReview.testimonial_status === "rejected" ||
      rawReview.testimonial_status === "pending" ||
      rawReview.testimonial_status === "submitted"
    )
  );

  const hasSubmittedReview = isRealReview || app.review_decision === "submitted";

  if (hasSubmittedReview) {
    const rawStatus = String(rawReview?.testimonial_status || '').toLowerCase();
    const moderation: "pending" | "approved" | "rejected" =
      rawStatus === "approved"
        ? "approved"
        : rawStatus === "rejected"
        ? "rejected"
        : rawStatus === "pending" || rawStatus === "submitted"
        ? "pending"
        : app._review_id
        ? "approved"
        : "pending";

    const label =
      moderation === "approved"
        ? "✓ Avaliado"
        : moderation === "rejected"
        ? "Avaliação enviada"
        : "Avaliação enviada • Em moderação";

    return {
      state: "REVIEW_SUBMITTED",
      decision: "submitted",
      moderationStatus: moderation,
      canReview: false,
      canSkip: false,
      label,
    };
  }

  // 4. Concluído pendente de decisão do cliente
  // Legacy safety fallback only:
  // After Hotfix 11 migration, completed appointments should be
  // canonically pending/submitted/skipped in the database.
  return {
    state: "PENDING_DECISION",
    decision: "pending",
    canReview: true,
    canSkip: true,
    label: "Avaliar Agora",
  };
}
