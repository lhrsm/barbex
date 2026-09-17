-- ============================================================================
-- ROLLBACK HOTFIX 02 (SOMENTE LOCAL - CONTINGÊNCIA - NÃO EXECUTAR)
-- ============================================================================

-- 1. Remover policies criadas pelo Hotfix 02
DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Customers can view own credit transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Customers can view own cashback transactions" ON public.cashback_transactions;
DROP POLICY IF EXISTS "Customers can view own subscriptions" ON public.customer_subscriptions;
DROP POLICY IF EXISTS "Customers can view own achievements" ON public.customer_achievements;

-- 2. Restaurar policy antiga de customer_achievements se necessário
DROP POLICY IF EXISTS "Customers can read their own achievements" ON public.customer_achievements;
CREATE POLICY "Customers can read their own achievements"
ON public.customer_achievements
FOR SELECT
TO authenticated
USING (true);

-- 3. Remover RPC de auto-vinculação
DROP FUNCTION IF EXISTS public.claim_customer_profile(UUID);

-- 4. Remover índices criados pelo Hotfix 02
DROP INDEX IF EXISTS public.idx_customers_tenant_auth_user;
DROP INDEX IF EXISTS public.idx_appointments_customer_tenant;
DROP INDEX IF EXISTS public.idx_credit_transactions_customer_tenant;
DROP INDEX IF EXISTS public.idx_cashback_transactions_customer_tenant;
DROP INDEX IF EXISTS public.idx_customer_achievements_cust;

-- 5. Remover coluna auth_user_id (apenas se seguro e sem tocar em customers.user_id)
ALTER TABLE public.customers
DROP COLUMN IF EXISTS auth_user_id;
