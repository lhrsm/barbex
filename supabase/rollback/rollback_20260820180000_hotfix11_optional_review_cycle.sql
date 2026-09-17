-- ROLLBACK HOTFIX 11
DROP TRIGGER IF EXISTS trg_sync_appointment_review_decision ON public.appointment_reviews;
DROP FUNCTION IF EXISTS public.sync_appointment_review_decision();

DROP TRIGGER IF EXISTS trg_validate_appointment_review_before_insert ON public.appointment_reviews;
DROP FUNCTION IF EXISTS public.validate_appointment_review_before_insert();

DROP TRIGGER IF EXISTS trg_appointment_completion_review_decision ON public.appointments;
DROP FUNCTION IF EXISTS public.handle_appointment_completion_review_decision();

DROP FUNCTION IF EXISTS public.set_appointment_review_decision(uuid, text);

DROP INDEX IF EXISTS idx_appointments_review_decision;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS review_decision;
