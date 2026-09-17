-- ROLLBACK HOTFIX 09B: Remover policy de leitura das próprias avaliações

DROP POLICY IF EXISTS "Customers can view own reviews" ON public.appointment_reviews;
