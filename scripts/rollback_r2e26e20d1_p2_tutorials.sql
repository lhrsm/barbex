-- ==============================================================================
-- BARBEX — R2E.26E.20D.3: ROLLBACK DOS TUTORIAIS OPERACIONAIS P2
-- SCRIPT DE ROLLBACK PREPARADO PARA OS TRÊS ARTIGOS P2
-- REALOCADO DE supabase/migrations/ CONFORME GATE 1
-- ==============================================================================

DELETE FROM public.tutorials
WHERE id IN (
  'e59a721d-9e0c-4c48-8df1-3f628ab29008',
  'e59a721d-9e0c-4c48-8df1-3f628ab29009',
  'e59a721d-9e0c-4c48-8df1-3f628ab29010'
);
