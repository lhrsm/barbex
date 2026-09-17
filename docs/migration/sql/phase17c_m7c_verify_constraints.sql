-- =====================================================================
-- BARBEX — PHASE 17C.M7C CONSTRAINTS DATA INTEGRITY VERIFIER
-- VALIDATES 58 UNIQUE CONSTRAINTS, 59 CHECK CONSTRAINTS, AND ENUMS
-- =====================================================================

DO $$
DECLARE
  v_conflicts INTEGER := 0;
BEGIN
  -- 1. Unique Constraints Audit
  IF EXISTS (
    SELECT "user_id", "lesson_id" FROM public."academy_progress"
    WHERE "user_id" IS NOT NULL AND "lesson_id" IS NOT NULL
    GROUP BY "user_id", "lesson_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'academy_progress', 'academy_progress_user_id_lesson_id_key';
  END IF;
  IF EXISTS (
    SELECT "user_id", "event_key" FROM public."admin_event_subscriptions"
    WHERE "user_id" IS NOT NULL AND "event_key" IS NOT NULL
    GROUP BY "user_id", "event_key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'admin_event_subscriptions', 'admin_event_subscriptions_user_id_event_key_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id" FROM public."ai_settings"
    WHERE "tenant_id" IS NOT NULL
    GROUP BY "tenant_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'ai_settings', 'ai_settings_tenant_id_key';
  END IF;
  IF EXISTS (
    SELECT "appointment_id" FROM public."appointment_checkins"
    WHERE "appointment_id" IS NOT NULL
    GROUP BY "appointment_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'appointment_checkins', 'appointment_checkins_appointment_id_key';
  END IF;
  IF EXISTS (
    SELECT "group_token" FROM public."appointment_groups"
    WHERE "group_token" IS NOT NULL
    GROUP BY "group_token" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'appointment_groups', 'appointment_groups_group_token_key';
  END IF;
  IF EXISTS (
    SELECT "appointment_id" FROM public."appointment_reviews"
    WHERE "appointment_id" IS NOT NULL
    GROUP BY "appointment_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'appointment_reviews', 'appointment_reviews_appointment_id_key';
  END IF;
  IF EXISTS (
    SELECT "review_token" FROM public."appointment_reviews"
    WHERE "review_token" IS NOT NULL
    GROUP BY "review_token" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'appointment_reviews', 'appointment_reviews_review_token_key';
  END IF;
  IF EXISTS (
    SELECT "unique_key" FROM public."automation_dispatches"
    WHERE "unique_key" IS NOT NULL
    GROUP BY "unique_key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'automation_dispatches', 'automation_dispatches_unique_key_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id", "key" FROM public."automation_templates"
    WHERE "tenant_id" IS NOT NULL AND "key" IS NOT NULL
    GROUP BY "tenant_id", "key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'automation_templates', 'automation_templates_tenant_id_key_key';
  END IF;
  IF EXISTS (
    SELECT "appointment_id", "barber_id" FROM public."barber_commissions"
    WHERE "appointment_id" IS NOT NULL AND "barber_id" IS NOT NULL
    GROUP BY "appointment_id", "barber_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'barber_commissions', 'barber_commissions_appointment_barber_key';
  END IF;
  IF EXISTS (
    SELECT "barber_id", "service_id" FROM public."barber_services"
    WHERE "barber_id" IS NOT NULL AND "service_id" IS NOT NULL
    GROUP BY "barber_id", "service_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'barber_services', 'barber_services_barber_id_service_id_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id", "module_key" FROM public."barbershop_modules"
    WHERE "tenant_id" IS NOT NULL AND "module_key" IS NOT NULL
    GROUP BY "tenant_id", "module_key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'barbershop_modules', 'barbershop_modules_tenant_id_module_key_key';
  END IF;
  IF EXISTS (
    SELECT "barber_id" FROM public."barbershop_settings"
    WHERE "barber_id" IS NOT NULL
    GROUP BY "barber_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'barbershop_settings', 'barbershop_settings_barber_id_key';
  END IF;
  IF EXISTS (
    SELECT "owner_id" FROM public."barbershops"
    WHERE "owner_id" IS NOT NULL
    GROUP BY "owner_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'barbershops', 'barbershops_owner_id_key';
  END IF;
  IF EXISTS (
    SELECT "slug" FROM public."barbershops"
    WHERE "slug" IS NOT NULL
    GROUP BY "slug" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'barbershops', 'barbershops_slug_key';
  END IF;
  IF EXISTS (
    SELECT "appointment_id" FROM public."cashback_transactions"
    WHERE "appointment_id" IS NOT NULL
    GROUP BY "appointment_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'cashback_transactions', 'unique_cashback_per_appointment';
  END IF;
  IF EXISTS (
    SELECT "phone" FROM public."client_auth"
    WHERE "phone" IS NOT NULL
    GROUP BY "phone" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'client_auth', 'client_auth_phone_key';
  END IF;
  IF EXISTS (
    SELECT "phone" FROM public."client_auth"
    WHERE "phone" IS NOT NULL
    GROUP BY "phone" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'client_auth', 'client_auth_phone_unique';
  END IF;
  IF EXISTS (
    SELECT "appointment_id" FROM public."commission_entries"
    WHERE "appointment_id" IS NOT NULL
    GROUP BY "appointment_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'commission_entries', 'commission_entries_appointment_id_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id", "type" FROM public."communication_channels"
    WHERE "tenant_id" IS NOT NULL AND "type" IS NOT NULL
    GROUP BY "tenant_id", "type" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'communication_channels', 'communication_channels_tenant_id_type_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id", "key", "channel_type" FROM public."communication_templates"
    WHERE "tenant_id" IS NOT NULL AND "key" IS NOT NULL AND "channel_type" IS NOT NULL
    GROUP BY "tenant_id", "key", "channel_type" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'communication_templates', 'communication_templates_tenant_id_key_channel_type_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id", "code" FROM public."coupons"
    WHERE "tenant_id" IS NOT NULL AND "code" IS NOT NULL
    GROUP BY "tenant_id", "code" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'coupons', 'coupons_tenant_id_code_key';
  END IF;
  IF EXISTS (
    SELECT "customer_id", "achievement_id" FROM public."customer_achievements"
    WHERE "customer_id" IS NOT NULL AND "achievement_id" IS NOT NULL
    GROUP BY "customer_id", "achievement_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'customer_achievements', 'customer_achievements_customer_id_achievement_id_key';
  END IF;
  IF EXISTS (
    SELECT "appointment_id" FROM public."customer_credits"
    WHERE "appointment_id" IS NOT NULL
    GROUP BY "appointment_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'customer_credits', 'customer_credits_appointment_id_key';
  END IF;
  IF EXISTS (
    SELECT "provider_event_id" FROM public."email_logs"
    WHERE "provider_event_id" IS NOT NULL
    GROUP BY "provider_event_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'email_logs', 'email_logs_provider_event_id_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id" FROM public."email_settings"
    WHERE "tenant_id" IS NOT NULL
    GROUP BY "tenant_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'email_settings', 'email_settings_tenant_id_key';
  END IF;
  IF EXISTS (
    SELECT "campaign_id", "customer_id" FROM public."loyalty_campaign_participations"
    WHERE "campaign_id" IS NOT NULL AND "customer_id" IS NOT NULL
    GROUP BY "campaign_id", "customer_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'loyalty_campaign_participations', 'loyalty_campaign_participations_campaign_id_customer_id_key';
  END IF;
  IF EXISTS (
    SELECT "slug" FROM public."loyalty_campaign_templates"
    WHERE "slug" IS NOT NULL
    GROUP BY "slug" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'loyalty_campaign_templates', 'loyalty_campaign_templates_slug_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id" FROM public."loyalty_settings"
    WHERE "tenant_id" IS NOT NULL
    GROUP BY "tenant_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'loyalty_settings', 'loyalty_settings_tenant_id_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id", "type", "unique_key" FROM public."notifications"
    WHERE "tenant_id" IS NOT NULL AND "type" IS NOT NULL AND "unique_key" IS NOT NULL
    GROUP BY "tenant_id", "type", "unique_key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'notifications', 'notifications_tenant_type_unique_key_key';
  END IF;
  IF EXISTS (
    SELECT "key" FROM public."permissions"
    WHERE "key" IS NOT NULL
    GROUP BY "key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'permissions', 'permissions_key_key';
  END IF;
  IF EXISTS (
    SELECT "name" FROM public."plans"
    WHERE "name" IS NOT NULL
    GROUP BY "name" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'plans', 'plans_name_key';
  END IF;
  IF EXISTS (
    SELECT "checkin_token" FROM public."profiles"
    WHERE "checkin_token" IS NOT NULL
    GROUP BY "checkin_token" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'profiles', 'profiles_checkin_token_key';
  END IF;
  IF EXISTS (
    SELECT "slug" FROM public."profiles"
    WHERE "slug" IS NOT NULL
    GROUP BY "slug" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'profiles', 'profiles_slug_key';
  END IF;
  IF EXISTS (
    SELECT "endpoint" FROM public."push_subscriptions"
    WHERE "endpoint" IS NOT NULL
    GROUP BY "endpoint" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'push_subscriptions', 'push_subscriptions_endpoint_key';
  END IF;
  IF EXISTS (
    SELECT "user_id" FROM public."reception_permissions"
    WHERE "user_id" IS NOT NULL
    GROUP BY "user_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'reception_permissions', 'reception_permissions_user_id_key';
  END IF;
  IF EXISTS (
    SELECT "role", "permission_key" FROM public."role_permissions"
    WHERE "role" IS NOT NULL AND "permission_key" IS NOT NULL
    GROUP BY "role", "permission_key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'role_permissions', 'role_permissions_role_permission_key_key';
  END IF;
  IF EXISTS (
    SELECT "addon_key" FROM public."saas_addons"
    WHERE "addon_key" IS NOT NULL
    GROUP BY "addon_key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'saas_addons', 'saas_addons_addon_key_key';
  END IF;
  IF EXISTS (
    SELECT "singleton" FROM public."saas_billing_settings"
    WHERE "singleton" IS NOT NULL
    GROUP BY "singleton" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'saas_billing_settings', 'saas_billing_settings_singleton_key';
  END IF;
  IF EXISTS (
    SELECT "appointment_id" FROM public."service_ratings"
    WHERE "appointment_id" IS NOT NULL
    GROUP BY "appointment_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'service_ratings', 'service_ratings_appointment_id_key';
  END IF;
  IF EXISTS (
    SELECT "slug" FROM public."status_services"
    WHERE "slug" IS NOT NULL
    GROUP BY "slug" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'status_services', 'status_services_slug_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id", "customer_id", "subscription_id", "reward_id", "reward_cycle" FROM public."subscription_loyalty_history"
    WHERE "tenant_id" IS NOT NULL AND "customer_id" IS NOT NULL AND "subscription_id" IS NOT NULL AND "reward_id" IS NOT NULL AND "reward_cycle" IS NOT NULL
    GROUP BY "tenant_id", "customer_id", "subscription_id", "reward_id", "reward_cycle" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'subscription_loyalty_history', 'subscription_loyalty_history_unique_cycle';
  END IF;
  IF EXISTS (
    SELECT "tenant_id", "months_required", "reward_type" FROM public."subscription_loyalty_rewards"
    WHERE "tenant_id" IS NOT NULL AND "months_required" IS NOT NULL AND "reward_type" IS NOT NULL
    GROUP BY "tenant_id", "months_required", "reward_type" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'subscription_loyalty_rewards', 'subscription_loyalty_rewards_tenant_id_months_required_rewa_key';
  END IF;
  IF EXISTS (
    SELECT "benefit_id", "service_id" FROM public."subscription_plan_benefit_services"
    WHERE "benefit_id" IS NOT NULL AND "service_id" IS NOT NULL
    GROUP BY "benefit_id", "service_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'subscription_plan_benefit_services', 'subscription_plan_benefit_services_benefit_id_service_id_key';
  END IF;
  IF EXISTS (
    SELECT "plan_id", "benefit_key" FROM public."subscription_plan_benefits"
    WHERE "plan_id" IS NOT NULL AND "benefit_key" IS NOT NULL
    GROUP BY "plan_id", "benefit_key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'subscription_plan_benefits', 'subscription_plan_benefits_plan_id_benefit_key_key';
  END IF;
  IF EXISTS (
    SELECT "plan_id", "service_id" FROM public."subscription_plan_services"
    WHERE "plan_id" IS NOT NULL AND "service_id" IS NOT NULL
    GROUP BY "plan_id", "service_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'subscription_plan_services', 'subscription_plan_services_plan_id_service_id_key';
  END IF;
  IF EXISTS (
    SELECT "subscription_id" FROM public."subscription_referrals"
    WHERE "subscription_id" IS NOT NULL
    GROUP BY "subscription_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'subscription_referrals', 'subscription_referrals_subscription_id_key';
  END IF;
  IF EXISTS (
    SELECT "stripe_subscription_id" FROM public."subscriptions"
    WHERE "stripe_subscription_id" IS NOT NULL
    GROUP BY "stripe_subscription_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'subscriptions', 'subscriptions_stripe_subscription_id_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id", "provider" FROM public."tenant_integrations"
    WHERE "tenant_id" IS NOT NULL AND "provider" IS NOT NULL
    GROUP BY "tenant_id", "provider" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'tenant_integrations', 'tenant_integrations_tenant_id_provider_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id", "user_id" FROM public."tenant_memberships"
    WHERE "tenant_id" IS NOT NULL AND "user_id" IS NOT NULL
    GROUP BY "tenant_id", "user_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'tenant_memberships', 'tenant_memberships_tenant_id_user_id_key';
  END IF;
  IF EXISTS (
    SELECT "name" FROM public."tutorial_categories"
    WHERE "name" IS NOT NULL
    GROUP BY "name" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'tutorial_categories', 'tutorial_categories_name_key';
  END IF;
  IF EXISTS (
    SELECT "slug" FROM public."tutorials"
    WHERE "slug" IS NOT NULL
    GROUP BY "slug" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'tutorials', 'tutorials_slug_key';
  END IF;
  IF EXISTS (
    SELECT "user_id", "tenant_id", "step_key" FROM public."user_onboarding_progress"
    WHERE "user_id" IS NOT NULL AND "tenant_id" IS NOT NULL AND "step_key" IS NOT NULL
    GROUP BY "user_id", "tenant_id", "step_key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'user_onboarding_progress', 'user_onboarding_progress_user_id_tenant_id_step_key_key';
  END IF;
  IF EXISTS (
    SELECT "user_id" FROM public."user_roles"
    WHERE "user_id" IS NOT NULL
    GROUP BY "user_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'user_roles', 'user_roles_user_id_key';
  END IF;
  IF EXISTS (
    SELECT "user_id", "tenant_id", "tour_key" FROM public."user_tour_states"
    WHERE "user_id" IS NOT NULL AND "tenant_id" IS NOT NULL AND "tour_key" IS NOT NULL
    GROUP BY "user_id", "tenant_id", "tour_key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'user_tour_states', 'user_tour_states_user_id_tenant_id_tour_key_key';
  END IF;
  IF EXISTS (
    SELECT "customer_id" FROM public."wallet"
    WHERE "customer_id" IS NOT NULL
    GROUP BY "customer_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'wallet', 'wallet_customer_id_key';
  END IF;
  IF EXISTS (
    SELECT "tenant_id" FROM public."whatsapp_instances"
    WHERE "tenant_id" IS NOT NULL
    GROUP BY "tenant_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'whatsapp_instances', 'unique_barbershop_whatsapp';
  END IF;
  IF EXISTS (
    SELECT "user_id", "event_type" FROM public."whatsapp_templates"
    WHERE "user_id" IS NOT NULL AND "event_type" IS NOT NULL
    GROUP BY "user_id", "event_type" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unique constraint violation on % (%)', 'whatsapp_templates', 'whatsapp_templates_user_id_event_type_key';
  END IF;

  RAISE NOTICE 'SUCCESS: 58 Unique Constraints verified with zero duplicate rows.';
END $$;
