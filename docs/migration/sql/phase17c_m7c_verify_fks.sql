-- =====================================================================
-- BARBEX — PHASE 17C.M7C PHYSICAL FK ORPHAN VERIFIER
-- CHECKS ALL 279 CANONICAL FOREIGN KEYS VIA ANTI-JOIN QUERIES
-- MUST RETURN 0 ORPHANS FOR EVERY RELATIONSHIP
-- =====================================================================

DO $$
DECLARE
  v_orphans INTEGER;
  v_total_orphans INTEGER := 0;
BEGIN
  SELECT count(*) INTO v_orphans
  FROM public."academy_lessons" s
  LEFT JOIN "public"."academy_modules" t ON s."module_id" = t."id"
  WHERE s."module_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'academy_lessons_module_id_fkey', 'academy_lessons', 'module_id', 'academy_modules', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."academy_lessons" s
  LEFT JOIN "public"."tutorials" t ON s."tutorial_id" = t."id"
  WHERE s."tutorial_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'academy_lessons_tutorial_id_fkey', 'academy_lessons', 'tutorial_id', 'tutorials', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."academy_modules" s
  LEFT JOIN "public"."academy_paths" t ON s."path_id" = t."id"
  WHERE s."path_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'academy_modules_path_id_fkey', 'academy_modules', 'path_id', 'academy_paths', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."academy_paths" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'academy_paths_tenant_id_fkey', 'academy_paths', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."academy_progress" s
  LEFT JOIN "public"."academy_lessons" t ON s."lesson_id" = t."id"
  WHERE s."lesson_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'academy_progress_lesson_id_fkey', 'academy_progress', 'lesson_id', 'academy_lessons', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."academy_progress" s
  LEFT JOIN "public"."academy_paths" t ON s."path_id" = t."id"
  WHERE s."path_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'academy_progress_path_id_fkey', 'academy_progress', 'path_id', 'academy_paths', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."academy_progress" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'academy_progress_tenant_id_fkey', 'academy_progress', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."academy_progress" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'academy_progress_user_id_fkey', 'academy_progress', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."addon_upgrade_recommendations" s
  LEFT JOIN "public"."plans" t ON s."current_plan_id" = t."id"
  WHERE s."current_plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'addon_upgrade_recommendations_current_plan_id_fkey', 'addon_upgrade_recommendations', 'current_plan_id', 'plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."addon_upgrade_recommendations" s
  LEFT JOIN "public"."plans" t ON s."recommended_plan_id" = t."id"
  WHERE s."recommended_plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'addon_upgrade_recommendations_recommended_plan_id_fkey', 'addon_upgrade_recommendations', 'recommended_plan_id', 'plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."admin_event_subscriptions" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'admin_event_subscriptions_user_id_fkey', 'admin_event_subscriptions', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."admin_event_templates" s
  LEFT JOIN "auth"."users" t ON s."updated_by" = t."id"
  WHERE s."updated_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'admin_event_templates_updated_by_fkey', 'admin_event_templates', 'updated_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."ai_settings" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'ai_settings_tenant_id_fkey', 'ai_settings', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointment_checkins" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointment_checkins_appointment_id_fkey', 'appointment_checkins', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointment_groups" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointment_groups_customer_id_fkey', 'appointment_groups', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointment_groups" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointment_groups_tenant_id_fkey', 'appointment_groups', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointment_reviews" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointment_reviews_appointment_id_fkey', 'appointment_reviews', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointment_reviews" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointment_reviews_barber_id_fkey', 'appointment_reviews', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointment_reviews" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointment_reviews_customer_id_fkey', 'appointment_reviews', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointment_reviews" s
  LEFT JOIN "public"."services" t ON s."service_id" = t."id"
  WHERE s."service_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointment_reviews_service_id_fkey', 'appointment_reviews', 'service_id', 'services', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointment_status_logs" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointment_status_logs_appointment_id_fkey', 'appointment_status_logs', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointments" s
  LEFT JOIN "public"."appointment_groups" t ON s."appointment_group_id" = t."id"
  WHERE s."appointment_group_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointments_appointment_group_id_fkey', 'appointments', 'appointment_group_id', 'appointment_groups', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointments" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointments_barber_id_fkey', 'appointments', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointments" s
  LEFT JOIN "public"."coupons" t ON s."coupon_id" = t."id"
  WHERE s."coupon_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointments_coupon_id_fkey', 'appointments', 'coupon_id', 'coupons', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointments" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointments_customer_id_fkey', 'appointments', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointments" s
  LEFT JOIN "public"."appointments" t ON s."rescheduled_from_id" = t."id"
  WHERE s."rescheduled_from_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointments_rescheduled_from_id_fkey', 'appointments', 'rescheduled_from_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointments" s
  LEFT JOIN "public"."services" t ON s."service_id" = t."id"
  WHERE s."service_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointments_service_id_fkey', 'appointments', 'service_id', 'services', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointments" s
  LEFT JOIN "public"."customer_subscriptions" t ON s."subscription_id" = t."id"
  WHERE s."subscription_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointments_subscription_id_fkey', 'appointments', 'subscription_id', 'customer_subscriptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointments" s
  LEFT JOIN "public"."subscription_plans" t ON s."subscription_plan_id" = t."id"
  WHERE s."subscription_plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointments_subscription_plan_id_fkey', 'appointments', 'subscription_plan_id', 'subscription_plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointments" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointments_tenant_id_fkey', 'appointments', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointments" s
  LEFT JOIN "public"."barbers" t ON s."tip_barber_id" = t."id"
  WHERE s."tip_barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointments_tip_barber_id_fkey', 'appointments', 'tip_barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."appointments" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'appointments_user_id_fkey', 'appointments', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."audit_logs" s
  LEFT JOIN "public"."profiles" t ON s."admin_id" = t."id"
  WHERE s."admin_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'audit_logs_admin_id_fkey', 'audit_logs', 'admin_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_conversations" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_conversations_appointment_id_fkey', 'automation_conversations', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_conversations" s
  LEFT JOIN "public"."automations" t ON s."automation_id" = t."id"
  WHERE s."automation_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_conversations_automation_id_fkey', 'automation_conversations', 'automation_id', 'automations', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_conversations" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_conversations_customer_id_fkey', 'automation_conversations', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_conversations" s
  LEFT JOIN "public"."barbershops" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_conversations_tenant_id_fkey', 'automation_conversations', 'tenant_id', 'barbershops', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_cron_runs" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_cron_runs_appointment_id_fkey', 'automation_cron_runs', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_cron_runs" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_cron_runs_tenant_id_fkey', 'automation_cron_runs', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_dispatches" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_dispatches_appointment_id_fkey', 'automation_dispatches', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_dispatches" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_dispatches_customer_id_fkey', 'automation_dispatches', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_dispatches" s
  LEFT JOIN "public"."barbershops" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_dispatches_tenant_id_fkey', 'automation_dispatches', 'tenant_id', 'barbershops', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_interaction_events" s
  LEFT JOIN "public"."automation_interactions" t ON s."interaction_id" = t."id"
  WHERE s."interaction_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_interaction_events_interaction_id_fkey', 'automation_interaction_events', 'interaction_id', 'automation_interactions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_interaction_events" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_interaction_events_tenant_id_fkey', 'automation_interaction_events', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_interactions" s
  LEFT JOIN "public"."automations" t ON s."automation_id" = t."id"
  WHERE s."automation_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_interactions_automation_id_fkey', 'automation_interactions', 'automation_id', 'automations', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_interactions" s
  LEFT JOIN "public"."automation_templates" t ON s."automation_template_id" = t."id"
  WHERE s."automation_template_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_interactions_automation_template_id_fkey', 'automation_interactions', 'automation_template_id', 'automation_templates', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_interactions" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_interactions_tenant_id_fkey', 'automation_interactions', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_logs" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_logs_appointment_id_fkey', 'automation_logs', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_logs" s
  LEFT JOIN "public"."automation_templates" t ON s."automation_id" = t."id"
  WHERE s."automation_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_logs_automation_id_fkey', 'automation_logs', 'automation_id', 'automation_templates', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_logs" s
  LEFT JOIN "auth"."users" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_logs_barber_id_fkey', 'automation_logs', 'barber_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_logs" s
  LEFT JOIN "public"."automation_conversations" t ON s."conversation_id" = t."id"
  WHERE s."conversation_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_logs_conversation_id_fkey', 'automation_logs', 'conversation_id', 'automation_conversations', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_logs" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_logs_tenant_id_fkey', 'automation_logs', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_queue" s
  LEFT JOIN "public"."appointment_groups" t ON s."appointment_group_id" = t."id"
  WHERE s."appointment_group_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_queue_appointment_group_id_fkey', 'automation_queue', 'appointment_group_id', 'appointment_groups', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_queue" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_queue_appointment_id_fkey', 'automation_queue', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_queue" s
  LEFT JOIN "public"."automation_templates" t ON s."automation_id" = t."id"
  WHERE s."automation_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_queue_automation_id_fkey', 'automation_queue', 'automation_id', 'automation_templates', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_queue" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_queue_customer_id_fkey', 'automation_queue', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_queue" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_queue_tenant_id_fkey', 'automation_queue', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_reconciliation_settings" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_reconciliation_settings_tenant_id_fkey', 'automation_reconciliation_settings', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_send_history" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_send_history_appointment_id_fkey', 'automation_send_history', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_send_history" s
  LEFT JOIN "public"."automation_conversations" t ON s."conversation_id" = t."id"
  WHERE s."conversation_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_send_history_conversation_id_fkey', 'automation_send_history', 'conversation_id', 'automation_conversations', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_send_history" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_send_history_tenant_id_fkey', 'automation_send_history', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_templates" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_templates_tenant_id_fkey', 'automation_templates', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_templates" s
  LEFT JOIN "public"."automation_interactions" t ON s."wait_timeout_interaction_id" = t."id"
  WHERE s."wait_timeout_interaction_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_templates_wait_timeout_interaction_id_fkey', 'automation_templates', 'wait_timeout_interaction_id', 'automation_interactions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_v2_dispatches" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_v2_dispatches_appointment_id_fkey', 'automation_v2_dispatches', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_v2_dispatches" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_v2_dispatches_customer_id_fkey', 'automation_v2_dispatches', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_v2_dispatches" s
  LEFT JOIN "public"."automation_conversations" t ON s."session_id" = t."id"
  WHERE s."session_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_v2_dispatches_session_id_fkey', 'automation_v2_dispatches', 'session_id', 'automation_conversations', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_v2_dispatches" s
  LEFT JOIN "public"."barbershops" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_v2_dispatches_tenant_id_fkey', 'automation_v2_dispatches', 'tenant_id', 'barbershops', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_v2_logs" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_v2_logs_appointment_id_fkey', 'automation_v2_logs', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_v2_logs" s
  LEFT JOIN "public"."barbershops" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_v2_logs_tenant_id_fkey', 'automation_v2_logs', 'tenant_id', 'barbershops', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_v2_sessions" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_v2_sessions_appointment_id_fkey', 'automation_v2_sessions', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_v2_sessions" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_v2_sessions_customer_id_fkey', 'automation_v2_sessions', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_v2_sessions" s
  LEFT JOIN "public"."barbershops" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_v2_sessions_tenant_id_fkey', 'automation_v2_sessions', 'tenant_id', 'barbershops', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_webhook_logs" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_webhook_logs_appointment_id_fkey', 'automation_webhook_logs', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automation_webhook_logs" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automation_webhook_logs_tenant_id_fkey', 'automation_webhook_logs', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automations" s
  LEFT JOIN "auth"."users" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automations_barber_id_fkey', 'automations', 'barber_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automations" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automations_tenant_id_fkey', 'automations', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."automations" s
  LEFT JOIN "public"."automation_interactions" t ON s."wait_timeout_interaction_id" = t."id"
  WHERE s."wait_timeout_interaction_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'automations_wait_timeout_interaction_id_fkey', 'automations', 'wait_timeout_interaction_id', 'automation_interactions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."background_jobs" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'background_jobs_tenant_id_fkey', 'background_jobs', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barber_services" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barber_services_barber_id_fkey', 'barber_services', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barber_services" s
  LEFT JOIN "public"."services" t ON s."service_id" = t."id"
  WHERE s."service_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barber_services_service_id_fkey', 'barber_services', 'service_id', 'services', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barber_services" s
  LEFT JOIN "auth"."users" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barber_services_tenant_id_fkey', 'barber_services', 'tenant_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barber_services" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barber_services_user_id_fkey', 'barber_services', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barber_tips" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barber_tips_appointment_id_fkey', 'barber_tips', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barber_tips" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barber_tips_barber_id_fkey', 'barber_tips', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barber_tips" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barber_tips_customer_id_fkey', 'barber_tips', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barbers" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barbers_tenant_id_fkey', 'barbers', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barbers" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barbers_user_id_fkey', 'barbers', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barbershop_settings" s
  LEFT JOIN "public"."profiles" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barbershop_settings_barber_id_fkey', 'barbershop_settings', 'barber_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barbershops" s
  LEFT JOIN "auth"."users" t ON s."owner_id" = t."id"
  WHERE s."owner_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barbershops_owner_id_fkey', 'barbershops', 'owner_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."barbershops" s
  LEFT JOIN "public"."plans" t ON s."plan_id" = t."id"
  WHERE s."plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'barbershops_plan_id_fkey', 'barbershops', 'plan_id', 'plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."campaign_logs" s
  LEFT JOIN "public"."campaigns" t ON s."campaign_id" = t."id"
  WHERE s."campaign_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'campaign_logs_campaign_id_fkey', 'campaign_logs', 'campaign_id', 'campaigns', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."campaign_logs" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'campaign_logs_tenant_id_fkey', 'campaign_logs', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."campaigns" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'campaigns_tenant_id_fkey', 'campaigns', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."cashback_transactions" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'cashback_transactions_appointment_id_fkey', 'cashback_transactions', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."cashback_transactions" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'cashback_transactions_customer_id_fkey', 'cashback_transactions', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."client_auth" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'client_auth_customer_id_fkey', 'client_auth', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."communication_channels" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'communication_channels_tenant_id_fkey', 'communication_channels', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."communication_messages" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'communication_messages_customer_id_fkey', 'communication_messages', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."communication_messages" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'communication_messages_tenant_id_fkey', 'communication_messages', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."communication_templates" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'communication_templates_tenant_id_fkey', 'communication_templates', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."cookie_consents" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'cookie_consents_customer_id_fkey', 'cookie_consents', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."cookie_consents" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'cookie_consents_tenant_id_fkey', 'cookie_consents', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."coupons" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'coupons_tenant_id_fkey', 'coupons', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."credit_transactions" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'credit_transactions_appointment_id_fkey', 'credit_transactions', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."credit_transactions" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'credit_transactions_customer_id_fkey', 'credit_transactions', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_achievements" s
  LEFT JOIN "public"."loyalty_achievements" t ON s."achievement_id" = t."id"
  WHERE s."achievement_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_achievements_achievement_id_fkey', 'customer_achievements', 'achievement_id', 'loyalty_achievements', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_achievements" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_achievements_customer_id_fkey', 'customer_achievements', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_credits" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_credits_appointment_id_fkey', 'customer_credits', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_credits" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_credits_customer_id_fkey', 'customer_credits', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_credits" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_credits_tenant_id_fkey', 'customer_credits', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_documents" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_documents_customer_id_fkey', 'customer_documents', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_documents" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_documents_tenant_id_fkey', 'customer_documents', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_interactions" s
  LEFT JOIN "public"."profiles" t ON s."author_id" = t."id"
  WHERE s."author_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_interactions_author_id_fkey', 'customer_interactions', 'author_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_interactions" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_interactions_customer_id_fkey', 'customer_interactions', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_interactions" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_interactions_tenant_id_fkey', 'customer_interactions', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_subscriptions" s
  LEFT JOIN "public"."coupons" t ON s."coupon_id" = t."id"
  WHERE s."coupon_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_subscriptions_coupon_id_fkey', 'customer_subscriptions', 'coupon_id', 'coupons', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_subscriptions" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_subscriptions_customer_id_fkey', 'customer_subscriptions', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_subscriptions" s
  LEFT JOIN "public"."payment_gateways" t ON s."gateway_id" = t."id"
  WHERE s."gateway_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_subscriptions_gateway_id_fkey', 'customer_subscriptions', 'gateway_id', 'payment_gateways', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_subscriptions" s
  LEFT JOIN "public"."subscription_plans" t ON s."plan_id" = t."id"
  WHERE s."plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_subscriptions_plan_id_fkey', 'customer_subscriptions', 'plan_id', 'subscription_plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_subscriptions" s
  LEFT JOIN "public"."customer_subscriptions" t ON s."referred_by_subscription_id" = t."id"
  WHERE s."referred_by_subscription_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_subscriptions_referred_by_subscription_id_fkey', 'customer_subscriptions', 'referred_by_subscription_id', 'customer_subscriptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_tasks" s
  LEFT JOIN "public"."profiles" t ON s."author_id" = t."id"
  WHERE s."author_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_tasks_author_id_fkey', 'customer_tasks', 'author_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_tasks" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_tasks_customer_id_fkey', 'customer_tasks', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customer_tasks" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customer_tasks_tenant_id_fkey', 'customer_tasks', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customers" s
  LEFT JOIN "auth"."users" t ON s."auth_user_id" = t."id"
  WHERE s."auth_user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customers_auth_user_id_fkey', 'customers', 'auth_user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customers" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customers_barber_id_fkey', 'customers', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customers" s
  LEFT JOIN "public"."loyalty_levels" t ON s."loyalty_level_id" = t."id"
  WHERE s."loyalty_level_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customers_loyalty_level_id_fkey', 'customers', 'loyalty_level_id', 'loyalty_levels', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customers" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customers_tenant_id_fkey', 'customers', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."customers" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'customers_user_id_fkey', 'customers', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."email_logs" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'email_logs_tenant_id_fkey', 'email_logs', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."email_logs" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'email_logs_user_id_fkey', 'email_logs', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."email_settings" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'email_settings_tenant_id_fkey', 'email_settings', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."financial_adjustment_logs" s
  LEFT JOIN "auth"."users" t ON s."adjusted_by" = t."id"
  WHERE s."adjusted_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'financial_adjustment_logs_adjusted_by_fkey', 'financial_adjustment_logs', 'adjusted_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."financial_adjustment_logs" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'financial_adjustment_logs_appointment_id_fkey', 'financial_adjustment_logs', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."financial_adjustment_logs" s
  LEFT JOIN "public"."barbershops" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'financial_adjustment_logs_tenant_id_fkey', 'financial_adjustment_logs', 'tenant_id', 'barbershops', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."financial_adjustment_logs" s
  LEFT JOIN "public"."transactions" t ON s."transaction_id" = t."id"
  WHERE s."transaction_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'financial_adjustment_logs_transaction_id_fkey', 'financial_adjustment_logs', 'transaction_id', 'transactions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."lgpd_requests" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'lgpd_requests_customer_id_fkey', 'lgpd_requests', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."lgpd_requests" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'lgpd_requests_tenant_id_fkey', 'lgpd_requests', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."loyalty_campaign_participations" s
  LEFT JOIN "public"."loyalty_campaigns" t ON s."campaign_id" = t."id"
  WHERE s."campaign_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'loyalty_campaign_participations_campaign_id_fkey', 'loyalty_campaign_participations', 'campaign_id', 'loyalty_campaigns', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."loyalty_campaigns" s
  LEFT JOIN "public"."loyalty_campaign_templates" t ON s."template_slug" = t."slug"
  WHERE s."template_slug" IS NOT NULL AND t."slug" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'loyalty_campaigns_template_slug_fkey', 'loyalty_campaigns', 'template_slug', 'loyalty_campaign_templates', 'slug', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."loyalty_rewards" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'loyalty_rewards_customer_id_fkey', 'loyalty_rewards', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."marketing_audiences" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'marketing_audiences_tenant_id_fkey', 'marketing_audiences', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."notification_recipients" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'notification_recipients_barber_id_fkey', 'notification_recipients', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."notifications" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'notifications_barber_id_fkey', 'notifications', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."notifications" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'notifications_customer_id_fkey', 'notifications', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."notifications" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'notifications_tenant_id_fkey', 'notifications', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."notifications" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'notifications_user_id_fkey', 'notifications', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."observability_logs" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'observability_logs_tenant_id_fkey', 'observability_logs', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."operational_insights_interactions" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'operational_insights_interactions_user_id_fkey', 'operational_insights_interactions', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."payment_gateway_logs" s
  LEFT JOIN "public"."payment_gateways" t ON s."gateway_id" = t."id"
  WHERE s."gateway_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'payment_gateway_logs_gateway_id_fkey', 'payment_gateway_logs', 'gateway_id', 'payment_gateways', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."payment_receipts" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'payment_receipts_appointment_id_fkey', 'payment_receipts', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."privacy_consents" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'privacy_consents_customer_id_fkey', 'privacy_consents', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."product_images" s
  LEFT JOIN "public"."products" t ON s."product_id" = t."id"
  WHERE s."product_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'product_images_product_id_fkey', 'product_images', 'product_id', 'products', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."product_sales" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'product_sales_appointment_id_fkey', 'product_sales', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."product_sales" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'product_sales_barber_id_fkey', 'product_sales', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."product_sales" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'product_sales_customer_id_fkey', 'product_sales', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."product_sales" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'product_sales_tenant_id_fkey', 'product_sales', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."product_sales" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'product_sales_user_id_fkey', 'product_sales', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."products" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'products_user_id_fkey', 'products', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."professional_time_off" s
  LEFT JOIN "auth"."users" t ON s."approved_by" = t."id"
  WHERE s."approved_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'professional_time_off_approved_by_fkey', 'professional_time_off', 'approved_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."professional_time_off" s
  LEFT JOIN "auth"."users" t ON s."cancelled_by" = t."id"
  WHERE s."cancelled_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'professional_time_off_cancelled_by_fkey', 'professional_time_off', 'cancelled_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."professional_time_off" s
  LEFT JOIN "public"."barbers" t ON s."professional_id" = t."id"
  WHERE s."professional_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'professional_time_off_professional_id_fkey', 'professional_time_off', 'professional_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."professional_time_off" s
  LEFT JOIN "auth"."users" t ON s."requested_by" = t."id"
  WHERE s."requested_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'professional_time_off_requested_by_fkey', 'professional_time_off', 'requested_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."professional_time_off" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'professional_time_off_tenant_id_fkey', 'professional_time_off', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."profiles" s
  LEFT JOIN "auth"."users" t ON s."id" = t."id"
  WHERE s."id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'profiles_id_fkey', 'profiles', 'id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."profiles" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'profiles_tenant_id_fkey', 'profiles', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."push_subscriptions" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'push_subscriptions_user_id_fkey', 'push_subscriptions', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."refund_audits" s
  LEFT JOIN "public"."refund_requests" t ON s."refund_id" = t."id"
  WHERE s."refund_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'refund_audits_refund_id_fkey', 'refund_audits', 'refund_id', 'refund_requests', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."refund_audits" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'refund_audits_tenant_id_fkey', 'refund_audits', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."refund_requests" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'refund_requests_appointment_id_fkey', 'refund_requests', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."refund_requests" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'refund_requests_customer_id_fkey', 'refund_requests', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."review_automation_logs" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'review_automation_logs_appointment_id_fkey', 'review_automation_logs', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."review_automation_logs" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'review_automation_logs_customer_id_fkey', 'review_automation_logs', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."review_automation_logs" s
  LEFT JOIN "public"."appointment_reviews" t ON s."review_id" = t."id"
  WHERE s."review_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'review_automation_logs_review_id_fkey', 'review_automation_logs', 'review_id', 'appointment_reviews', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."review_automation_logs" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'review_automation_logs_tenant_id_fkey', 'review_automation_logs', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."role_permissions" s
  LEFT JOIN "public"."permissions" t ON s."permission_key" = t."key"
  WHERE s."permission_key" IS NOT NULL AND t."key" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'role_permissions_permission_key_fkey', 'role_permissions', 'permission_key', 'permissions', 'key', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_addons" s
  LEFT JOIN "public"."plans" t ON s."minimum_plan_id" = t."id"
  WHERE s."minimum_plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_addons_minimum_plan_id_fkey', 'saas_addons', 'minimum_plan_id', 'plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_audit_logs" s
  LEFT JOIN "auth"."users" t ON s."actor_user_id" = t."id"
  WHERE s."actor_user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_audit_logs_actor_user_id_fkey', 'saas_admin_voucher_audit_logs', 'actor_user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_audit_logs" s
  LEFT JOIN "public"."barbershops" t ON s."barbershop_id" = t."id"
  WHERE s."barbershop_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_audit_logs_barbershop_id_fkey', 'saas_admin_voucher_audit_logs', 'barbershop_id', 'barbershops', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_audit_logs" s
  LEFT JOIN "public"."saas_admin_voucher_redemptions" t ON s."redemption_id" = t."id"
  WHERE s."redemption_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_audit_logs_redemption_id_fkey', 'saas_admin_voucher_audit_logs', 'redemption_id', 'saas_admin_voucher_redemptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_audit_logs" s
  LEFT JOIN "auth"."users" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_audit_logs_tenant_id_fkey', 'saas_admin_voucher_audit_logs', 'tenant_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_audit_logs" s
  LEFT JOIN "public"."saas_admin_vouchers" t ON s."voucher_id" = t."id"
  WHERE s."voucher_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_audit_logs_voucher_id_fkey', 'saas_admin_voucher_audit_logs', 'voucher_id', 'saas_admin_vouchers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_redemptions" s
  LEFT JOIN "auth"."users" t ON s."applied_by" = t."id"
  WHERE s."applied_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_redemptions_applied_by_fkey', 'saas_admin_voucher_redemptions', 'applied_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_redemptions" s
  LEFT JOIN "public"."plans" t ON s."applied_plan_id" = t."id"
  WHERE s."applied_plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_redemptions_applied_plan_id_fkey', 'saas_admin_voucher_redemptions', 'applied_plan_id', 'plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_redemptions" s
  LEFT JOIN "public"."barbershops" t ON s."barbershop_id" = t."id"
  WHERE s."barbershop_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_redemptions_barbershop_id_fkey', 'saas_admin_voucher_redemptions', 'barbershop_id', 'barbershops', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_redemptions" s
  LEFT JOIN "public"."plans" t ON s."previous_plan_id" = t."id"
  WHERE s."previous_plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_redemptions_previous_plan_id_fkey', 'saas_admin_voucher_redemptions', 'previous_plan_id', 'plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_redemptions" s
  LEFT JOIN "auth"."users" t ON s."revoked_by" = t."id"
  WHERE s."revoked_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_redemptions_revoked_by_fkey', 'saas_admin_voucher_redemptions', 'revoked_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_redemptions" s
  LEFT JOIN "auth"."users" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_redemptions_tenant_id_fkey', 'saas_admin_voucher_redemptions', 'tenant_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_voucher_redemptions" s
  LEFT JOIN "public"."saas_admin_vouchers" t ON s."voucher_id" = t."id"
  WHERE s."voucher_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_voucher_redemptions_voucher_id_fkey', 'saas_admin_voucher_redemptions', 'voucher_id', 'saas_admin_vouchers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_vouchers" s
  LEFT JOIN "public"."plans" t ON s."allowed_plan_id" = t."id"
  WHERE s."allowed_plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_vouchers_allowed_plan_id_fkey', 'saas_admin_vouchers', 'allowed_plan_id', 'plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_vouchers" s
  LEFT JOIN "auth"."users" t ON s."applied_by" = t."id"
  WHERE s."applied_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_vouchers_applied_by_fkey', 'saas_admin_vouchers', 'applied_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_vouchers" s
  LEFT JOIN "auth"."users" t ON s."created_by" = t."id"
  WHERE s."created_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_vouchers_created_by_fkey', 'saas_admin_vouchers', 'created_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_vouchers" s
  LEFT JOIN "auth"."users" t ON s."revoked_by" = t."id"
  WHERE s."revoked_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_vouchers_revoked_by_fkey', 'saas_admin_vouchers', 'revoked_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_vouchers" s
  LEFT JOIN "public"."barbershops" t ON s."specific_barbershop_id" = t."id"
  WHERE s."specific_barbershop_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_vouchers_specific_barbershop_id_fkey', 'saas_admin_vouchers', 'specific_barbershop_id', 'barbershops', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_admin_vouchers" s
  LEFT JOIN "auth"."users" t ON s."specific_tenant_id" = t."id"
  WHERE s."specific_tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_admin_vouchers_specific_tenant_id_fkey', 'saas_admin_vouchers', 'specific_tenant_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."saas_checkout_sessions" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'saas_checkout_sessions_user_id_fkey', 'saas_checkout_sessions', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."security_activity_logs" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'security_activity_logs_user_id_fkey', 'security_activity_logs', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."service_ratings" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'service_ratings_appointment_id_fkey', 'service_ratings', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."service_ratings" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'service_ratings_barber_id_fkey', 'service_ratings', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."service_ratings" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'service_ratings_customer_id_fkey', 'service_ratings', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."service_ratings" s
  LEFT JOIN "public"."profiles" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'service_ratings_user_id_fkey', 'service_ratings', 'user_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."services" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'services_tenant_id_fkey', 'services', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."services" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'services_user_id_fkey', 'services', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."status_checks" s
  LEFT JOIN "public"."status_services" t ON s."service_id" = t."id"
  WHERE s."service_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'status_checks_service_id_fkey', 'status_checks', 'service_id', 'status_services', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_card_scans" s
  LEFT JOIN "public"."customer_subscriptions" t ON s."subscription_id" = t."id"
  WHERE s."subscription_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_card_scans_subscription_id_fkey', 'subscription_card_scans', 'subscription_id', 'customer_subscriptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_invoices" s
  LEFT JOIN "public"."coupons" t ON s."coupon_id" = t."id"
  WHERE s."coupon_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_invoices_coupon_id_fkey', 'subscription_invoices', 'coupon_id', 'coupons', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_invoices" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_invoices_customer_id_fkey', 'subscription_invoices', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_invoices" s
  LEFT JOIN "public"."customer_subscriptions" t ON s."subscription_id" = t."id"
  WHERE s."subscription_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_invoices_subscription_id_fkey', 'subscription_invoices', 'subscription_id', 'customer_subscriptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_loyalty_history" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_loyalty_history_customer_id_fkey', 'subscription_loyalty_history', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_loyalty_history" s
  LEFT JOIN "public"."subscription_loyalty_rewards" t ON s."reward_id" = t."id"
  WHERE s."reward_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_loyalty_history_reward_id_fkey', 'subscription_loyalty_history', 'reward_id', 'subscription_loyalty_rewards', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_loyalty_history" s
  LEFT JOIN "public"."customer_subscriptions" t ON s."subscription_id" = t."id"
  WHERE s."subscription_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_loyalty_history_subscription_id_fkey', 'subscription_loyalty_history', 'subscription_id', 'customer_subscriptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_payments" s
  LEFT JOIN "public"."payment_gateways" t ON s."gateway_id" = t."id"
  WHERE s."gateway_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_payments_gateway_id_fkey', 'subscription_payments', 'gateway_id', 'payment_gateways', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_payments" s
  LEFT JOIN "public"."customer_subscriptions" t ON s."subscription_id" = t."id"
  WHERE s."subscription_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_payments_subscription_id_fkey', 'subscription_payments', 'subscription_id', 'customer_subscriptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_plan_benefit_services" s
  LEFT JOIN "public"."subscription_plan_benefits" t ON s."benefit_id" = t."id"
  WHERE s."benefit_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_plan_benefit_services_benefit_id_fkey', 'subscription_plan_benefit_services', 'benefit_id', 'subscription_plan_benefits', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_plan_benefit_services" s
  LEFT JOIN "public"."subscription_plans" t ON s."plan_id" = t."id"
  WHERE s."plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_plan_benefit_services_plan_id_fkey', 'subscription_plan_benefit_services', 'plan_id', 'subscription_plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_plan_benefit_services" s
  LEFT JOIN "public"."services" t ON s."service_id" = t."id"
  WHERE s."service_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_plan_benefit_services_service_id_fkey', 'subscription_plan_benefit_services', 'service_id', 'services', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_plan_benefits" s
  LEFT JOIN "public"."subscription_plans" t ON s."plan_id" = t."id"
  WHERE s."plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_plan_benefits_plan_id_fkey', 'subscription_plan_benefits', 'plan_id', 'subscription_plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_plan_changes" s
  LEFT JOIN "public"."customer_subscriptions" t ON s."subscription_id" = t."id"
  WHERE s."subscription_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_plan_changes_subscription_id_fkey', 'subscription_plan_changes', 'subscription_id', 'customer_subscriptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_plan_services" s
  LEFT JOIN "public"."subscription_plans" t ON s."plan_id" = t."id"
  WHERE s."plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_plan_services_plan_id_fkey', 'subscription_plan_services', 'plan_id', 'subscription_plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_plan_services" s
  LEFT JOIN "public"."services" t ON s."service_id" = t."id"
  WHERE s."service_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_plan_services_service_id_fkey', 'subscription_plan_services', 'service_id', 'services', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_referrals" s
  LEFT JOIN "public"."customers" t ON s."referred_customer_id" = t."id"
  WHERE s."referred_customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_referrals_referred_customer_id_fkey', 'subscription_referrals', 'referred_customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_referrals" s
  LEFT JOIN "public"."customers" t ON s."referrer_customer_id" = t."id"
  WHERE s."referrer_customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_referrals_referrer_customer_id_fkey', 'subscription_referrals', 'referrer_customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_referrals" s
  LEFT JOIN "public"."customer_subscriptions" t ON s."referrer_subscription_id" = t."id"
  WHERE s."referrer_subscription_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_referrals_referrer_subscription_id_fkey', 'subscription_referrals', 'referrer_subscription_id', 'customer_subscriptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_referrals" s
  LEFT JOIN "public"."customer_subscriptions" t ON s."subscription_id" = t."id"
  WHERE s."subscription_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_referrals_subscription_id_fkey', 'subscription_referrals', 'subscription_id', 'customer_subscriptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_status_logs" s
  LEFT JOIN "public"."customer_subscriptions" t ON s."subscription_id" = t."id"
  WHERE s."subscription_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_status_logs_subscription_id_fkey', 'subscription_status_logs', 'subscription_id', 'customer_subscriptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_usage_logs" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_usage_logs_customer_id_fkey', 'subscription_usage_logs', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_usage_logs" s
  LEFT JOIN "public"."services" t ON s."service_id" = t."id"
  WHERE s."service_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_usage_logs_service_id_fkey', 'subscription_usage_logs', 'service_id', 'services', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_usage_logs" s
  LEFT JOIN "public"."customer_subscriptions" t ON s."subscription_id" = t."id"
  WHERE s."subscription_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_usage_logs_subscription_id_fkey', 'subscription_usage_logs', 'subscription_id', 'customer_subscriptions', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscription_usage_logs" s
  LEFT JOIN "public"."subscription_plans" t ON s."subscription_plan_id" = t."id"
  WHERE s."subscription_plan_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscription_usage_logs_subscription_plan_id_fkey', 'subscription_usage_logs', 'subscription_plan_id', 'subscription_plans', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."subscriptions" s
  LEFT JOIN "public"."profiles" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'subscriptions_user_id_fkey', 'subscriptions', 'user_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."support_messages" s
  LEFT JOIN "auth"."users" t ON s."sender_id" = t."id"
  WHERE s."sender_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'support_messages_sender_id_fkey', 'support_messages', 'sender_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."support_messages" s
  LEFT JOIN "public"."support_tickets" t ON s."ticket_id" = t."id"
  WHERE s."ticket_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'support_messages_ticket_id_fkey', 'support_messages', 'ticket_id', 'support_tickets', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."support_tickets" s
  LEFT JOIN "public"."barbershops" t ON s."barbershop_id" = t."id"
  WHERE s."barbershop_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'support_tickets_barbershop_id_fkey', 'support_tickets', 'barbershop_id', 'barbershops', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."support_tickets" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'support_tickets_user_id_fkey', 'support_tickets', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."team_audit_logs" s
  LEFT JOIN "auth"."users" t ON s."actor_id" = t."id"
  WHERE s."actor_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'team_audit_logs_actor_id_fkey', 'team_audit_logs', 'actor_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."team_audit_logs" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'team_audit_logs_tenant_id_fkey', 'team_audit_logs', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."tenant_addons" s
  LEFT JOIN "public"."saas_addons" t ON s."addon_id" = t."id"
  WHERE s."addon_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'tenant_addons_addon_id_fkey', 'tenant_addons', 'addon_id', 'saas_addons', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."tenant_memberships" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'tenant_memberships_tenant_id_fkey', 'tenant_memberships', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."tenant_memberships" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'tenant_memberships_user_id_fkey', 'tenant_memberships', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."ticket_messages" s
  LEFT JOIN "public"."support_tickets" t ON s."ticket_id" = t."id"
  WHERE s."ticket_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'ticket_messages_ticket_id_fkey', 'ticket_messages', 'ticket_id', 'support_tickets', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."transactions" s
  LEFT JOIN "auth"."users" t ON s."adjusted_by" = t."id"
  WHERE s."adjusted_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'transactions_adjusted_by_fkey', 'transactions', 'adjusted_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."transactions" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'transactions_appointment_id_fkey', 'transactions', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."transactions" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'transactions_barber_id_fkey', 'transactions', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."transactions" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'transactions_customer_id_fkey', 'transactions', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."transactions" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'transactions_tenant_id_fkey', 'transactions', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."transactions" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'transactions_user_id_fkey', 'transactions', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."tutorials" s
  LEFT JOIN "public"."tutorial_categories" t ON s."category_id" = t."id"
  WHERE s."category_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'tutorials_category_id_fkey', 'tutorials', 'category_id', 'tutorial_categories', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."user_invitations" s
  LEFT JOIN "auth"."users" t ON s."invited_by" = t."id"
  WHERE s."invited_by" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'user_invitations_invited_by_fkey', 'user_invitations', 'invited_by', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."user_invitations" s
  LEFT JOIN "public"."barbers" t ON s."professional_id" = t."id"
  WHERE s."professional_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'user_invitations_professional_id_fkey', 'user_invitations', 'professional_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."user_invitations" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'user_invitations_tenant_id_fkey', 'user_invitations', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."user_mfa_backup_codes" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'user_mfa_backup_codes_user_id_fkey', 'user_mfa_backup_codes', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."user_onboarding_preferences" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'user_onboarding_preferences_user_id_fkey', 'user_onboarding_preferences', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."user_onboarding_progress" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'user_onboarding_progress_user_id_fkey', 'user_onboarding_progress', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."user_tour_states" s
  LEFT JOIN "auth"."users" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'user_tour_states_user_id_fkey', 'user_tour_states', 'user_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."verification_challenges" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'verification_challenges_barber_id_fkey', 'verification_challenges', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."verification_challenges" s
  LEFT JOIN "public"."customers" t ON s."client_id" = t."id"
  WHERE s."client_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'verification_challenges_client_id_fkey', 'verification_challenges', 'client_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."waiting_list" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'waiting_list_barber_id_fkey', 'waiting_list', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."waiting_list" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'waiting_list_customer_id_fkey', 'waiting_list', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."waiting_list" s
  LEFT JOIN "public"."services" t ON s."service_id" = t."id"
  WHERE s."service_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'waiting_list_service_id_fkey', 'waiting_list', 'service_id', 'services', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."wallet" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'wallet_customer_id_fkey', 'wallet', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."wallet_transactions" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'wallet_transactions_appointment_id_fkey', 'wallet_transactions', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."wallet_transactions" s
  LEFT JOIN "public"."wallet" t ON s."wallet_id" = t."id"
  WHERE s."wallet_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'wallet_transactions_wallet_id_fkey', 'wallet_transactions', 'wallet_id', 'wallet', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."webhook_logs" s
  LEFT JOIN "public"."profiles" t ON s."barbershop_id" = t."id"
  WHERE s."barbershop_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'webhook_logs_barbershop_id_fkey', 'webhook_logs', 'barbershop_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_cloud_connections" s
  LEFT JOIN "public"."profiles" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_connections_user_id_fkey', 'whatsapp_cloud_connections', 'user_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_conversations" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_conversations_appointment_id_fkey', 'whatsapp_conversations', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_conversations" s
  LEFT JOIN "public"."barbers" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_conversations_barber_id_fkey', 'whatsapp_conversations', 'barber_id', 'barbers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_conversations" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_conversations_customer_id_fkey', 'whatsapp_conversations', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_delivery_logs" s
  LEFT JOIN "public"."appointments" t ON s."appointment_id" = t."id"
  WHERE s."appointment_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_delivery_logs_appointment_id_fkey', 'whatsapp_delivery_logs', 'appointment_id', 'appointments', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_delivery_logs" s
  LEFT JOIN "public"."automation_v2_dispatches" t ON s."dispatch_id" = t."id"
  WHERE s."dispatch_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_delivery_logs_dispatch_id_fkey', 'whatsapp_delivery_logs', 'dispatch_id', 'automation_v2_dispatches', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_delivery_logs" s
  LEFT JOIN "auth"."users" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_delivery_logs_tenant_id_fkey', 'whatsapp_delivery_logs', 'tenant_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_instances" s
  LEFT JOIN "auth"."users" t ON s."barber_id" = t."id"
  WHERE s."barber_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_connections_barber_id_fkey', 'whatsapp_instances', 'barber_id', 'users', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_instances" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_connections_barbershop_id_fkey', 'whatsapp_instances', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_messages" s
  LEFT JOIN "public"."whatsapp_instances" t ON s."connection_id" = t."id"
  WHERE s."connection_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_messages_connection_id_fkey', 'whatsapp_messages', 'connection_id', 'whatsapp_instances', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_messages" s
  LEFT JOIN "public"."customers" t ON s."customer_id" = t."id"
  WHERE s."customer_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_messages_customer_id_fkey', 'whatsapp_messages', 'customer_id', 'customers', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_messages" s
  LEFT JOIN "public"."profiles" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_messages_user_id_fkey', 'whatsapp_messages', 'user_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."whatsapp_templates" s
  LEFT JOIN "public"."profiles" t ON s."user_id" = t."id"
  WHERE s."user_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'whatsapp_templates_user_id_fkey', 'whatsapp_templates', 'user_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."zapi_integration_logs" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'zapi_integration_logs_tenant_id_fkey', 'zapi_integration_logs', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."zapi_webhook_debug" s
  LEFT JOIN "public"."automation_conversations" t ON s."matched_conversation_id" = t."id"
  WHERE s."matched_conversation_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'zapi_webhook_debug_matched_conversation_id_fkey', 'zapi_webhook_debug', 'matched_conversation_id', 'automation_conversations', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."zapi_webhook_debug" s
  LEFT JOIN "public"."barbershops" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'zapi_webhook_debug_tenant_id_fkey', 'zapi_webhook_debug', 'tenant_id', 'barbershops', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;
  SELECT count(*) INTO v_orphans
  FROM public."zapi_webhook_logs" s
  LEFT JOIN "public"."profiles" t ON s."tenant_id" = t."id"
  WHERE s."tenant_id" IS NOT NULL AND t."id" IS NULL;

  IF v_orphans > 0 THEN
    RAISE WARNING 'FK Orphan detected on % (%.% -> %.%): % rows', 'zapi_webhook_logs_tenant_id_fkey', 'zapi_webhook_logs', 'tenant_id', 'profiles', 'id', v_orphans;
    v_total_orphans := v_total_orphans + v_orphans;
  END IF;

  IF v_total_orphans > 0 THEN
    RAISE EXCEPTION 'FK integrity validation failed: % total orphan rows across canonical foreign keys.', v_total_orphans;
  END IF;

  RAISE NOTICE 'SUCCESS: 279 Foreign Keys audited with ZERO orphan rows.';
END $$;
