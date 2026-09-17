-- ============================================================================
-- ROLLBACK HOTFIX 13B: REVERTER PARA O ESTADO DO HOTFIX 11
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_appointment_completion_review_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' AND NEW.review_decision IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.appointment_reviews WHERE appointment_id = NEW.id) THEN
        NEW.review_decision := 'submitted';
      ELSE
        NEW.review_decision := 'pending';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed'
       AND OLD.status IS DISTINCT FROM 'completed'
       AND NEW.review_decision IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.appointment_reviews WHERE appointment_id = NEW.id) THEN
        NEW.review_decision := 'submitted';
      ELSE
        NEW.review_decision := 'pending';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_review_decision ON public.appointment_reviews;
CREATE OR REPLACE FUNCTION public.sync_appointment_review_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.appointments
     SET review_decision = 'submitted',
         updated_at = now()
   WHERE id = NEW.appointment_id
     AND (review_decision IS NULL OR review_decision != 'submitted');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_appointment_review_decision
  AFTER INSERT ON public.appointment_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_appointment_review_decision();
