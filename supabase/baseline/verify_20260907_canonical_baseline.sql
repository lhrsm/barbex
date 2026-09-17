-- ==============================================================================
-- BARBEX — CANONICAL BASELINE COMPREHENSIVE VERIFICATION SCRIPT
-- FILE: supabase/baseline/verify_20260907_canonical_baseline.sql
-- DATE: 2026-09-09
-- MODE: 100% READ-ONLY / FORENSIC VALIDATOR / ZERO DATA MUTATIONS
-- ==============================================================================

DO $$
DECLARE
  v_expected_tables text[] := ARRAY[
      'academy_lessons',
      'academy_modules',
      'academy_paths',
      'academy_progress',
      'addon_upgrade_recommendations',
      'admin_event_log',
      'admin_event_subscriptions',
      'admin_event_templates',
      'admin_notifications',
      'ai_settings',
      'appointment_checkins',
      'appointment_groups',
      'appointment_reviews',
      'appointment_status_logs',
      'appointments',
      'audit_logs',
      'automation_conversations',
      'automation_cron_runs',
      'automation_dispatches',
      'automation_interaction_events',
      'automation_interactions',
      'automation_logs',
      'automation_queue',
      'automation_reconciliation_settings',
      'automation_send_history',
      'automation_status',
      'automation_templates',
      'automation_v2_dispatches',
      'automation_v2_logs',
      'automation_v2_sessions',
      'automation_webhook_logs',
      'automations',
      'availability_conflict_logs',
      'background_jobs',
      'barber_commissions',
      'barber_services',
      'barber_tips',
      'barbers',
      'barbershop_module_logs',
      'barbershop_modules',
      'barbershop_settings',
      'barbershops',
      'campaign_logs',
      'campaigns',
      'cashback_transactions',
      'client_auth',
      'commission_closings',
      'commission_entries',
      'communication_channels',
      'communication_messages',
      'communication_templates',
      'cookie_consents',
      'coupons',
      'credit_transactions',
      'customer_achievements',
      'customer_credits',
      'customer_documents',
      'customer_interactions',
      'customer_subscriptions',
      'customer_tasks',
      'customers',
      'email_logs',
      'email_settings',
      'financial_adjustment_logs',
      'lgpd_requests',
      'loyalty_achievements',
      'loyalty_campaign_participations',
      'loyalty_campaign_templates',
      'loyalty_campaigns',
      'loyalty_levels',
      'loyalty_rewards',
      'loyalty_settings',
      'marketing_audiences',
      'notification_recipients',
      'notifications',
      'observability_logs',
      'onboarding_settings',
      'operation_locks',
      'operational_insights_interactions',
      'payment_gateway_logs',
      'payment_gateways',
      'payment_receipts',
      'permissions',
      'plans',
      'privacy_consents',
      'product_images',
      'product_sales',
      'products',
      'professional_time_off',
      'profiles',
      'push_subscriptions',
      'rate_limit_hits',
      'reception_permissions',
      'refund_audits',
      'refund_requests',
      'resend_settings',
      'review_automation_logs',
      'role_permissions',
      'saas_addons',
      'saas_admin_voucher_audit_logs',
      'saas_admin_voucher_redemptions',
      'saas_admin_vouchers',
      'saas_billing_settings',
      'saas_checkout_sessions',
      'security_activity_logs',
      'service_ratings',
      'services',
      'status_checks',
      'status_incidents',
      'status_maintenances',
      'status_services',
      'subprocessors',
      'subscription_card_scans',
      'subscription_invoices',
      'subscription_loyalty_history',
      'subscription_loyalty_rewards',
      'subscription_payments',
      'subscription_plan_benefit_services',
      'subscription_plan_benefits',
      'subscription_plan_changes',
      'subscription_plan_services',
      'subscription_plans',
      'subscription_referrals',
      'subscription_status_logs',
      'subscription_usage_logs',
      'subscriptions',
      'support_messages',
      'support_tickets',
      'system_health_settings',
      'system_settings',
      'team_audit_logs',
      'tenant_addons',
      'tenant_integrations',
      'tenant_memberships',
      'tenant_webhooks',
      'ticket_messages',
      'transactions',
      'tutorial_categories',
      'tutorials',
      'user_invitations',
      'user_mfa_backup_codes',
      'user_onboarding_preferences',
      'user_onboarding_progress',
      'user_roles',
      'user_tour_states',
      'verification_challenges',
      'waiting_list',
      'wallet',
      'wallet_transactions',
      'webhook_logs',
      'whatsapp_cloud_connections',
      'whatsapp_conversations',
      'whatsapp_delivery_logs',
      'whatsapp_instances',
      'whatsapp_messages',
      'whatsapp_templates',
      'zapi_integration_logs',
      'zapi_webhook_debug',
      'zapi_webhook_logs'
  ];
  v_expected_views text[] := ARRAY[
      'barber_rating_stats',
      'vw_automation_debug'
  ];
  v_expected_sequences text[] := ARRAY[
      'rate_limit_hits_id_seq',
      'status_checks_id_seq'
  ];
  v_expected_enums text[] := ARRAY[
      'addon_access_source',
      'addon_billing_cycle',
      'app_role',
      'approval_status',
      'automation_flow_type',
      'communication_category',
      'communication_channel_type',
      'communication_message_status',
      'identity_status',
      'loyalty_category',
      'product_sale_status',
      'time_off_status',
      'time_off_type',
      'tour_status'
  ];
  v_expected_fks text[] := ARRAY[
      'academy_lessons::academy_lessons_module_id_fkey',
      'academy_lessons::academy_lessons_tutorial_id_fkey',
      'academy_modules::academy_modules_path_id_fkey',
      'academy_paths::academy_paths_tenant_id_fkey',
      'academy_progress::academy_progress_lesson_id_fkey',
      'academy_progress::academy_progress_path_id_fkey',
      'academy_progress::academy_progress_tenant_id_fkey',
      'academy_progress::academy_progress_user_id_fkey',
      'addon_upgrade_recommendations::addon_upgrade_recommendations_current_plan_id_fkey',
      'addon_upgrade_recommendations::addon_upgrade_recommendations_recommended_plan_id_fkey',
      'admin_event_subscriptions::admin_event_subscriptions_user_id_fkey',
      'admin_event_templates::admin_event_templates_updated_by_fkey',
      'ai_settings::ai_settings_tenant_id_fkey',
      'appointment_checkins::appointment_checkins_appointment_id_fkey',
      'appointment_groups::appointment_groups_customer_id_fkey',
      'appointment_groups::appointment_groups_tenant_id_fkey',
      'appointment_reviews::appointment_reviews_appointment_id_fkey',
      'appointment_reviews::appointment_reviews_barber_id_fkey',
      'appointment_reviews::appointment_reviews_customer_id_fkey',
      'appointment_reviews::appointment_reviews_service_id_fkey',
      'appointment_status_logs::appointment_status_logs_appointment_id_fkey',
      'appointments::appointments_appointment_group_id_fkey',
      'appointments::appointments_barber_id_fkey',
      'appointments::appointments_coupon_id_fkey',
      'appointments::appointments_customer_id_fkey',
      'appointments::appointments_rescheduled_from_id_fkey',
      'appointments::appointments_service_id_fkey',
      'appointments::appointments_subscription_id_fkey',
      'appointments::appointments_subscription_plan_id_fkey',
      'appointments::appointments_tenant_id_fkey',
      'appointments::appointments_tip_barber_id_fkey',
      'appointments::appointments_user_id_fkey',
      'audit_logs::audit_logs_admin_id_fkey',
      'automation_conversations::automation_conversations_appointment_id_fkey',
      'automation_conversations::automation_conversations_automation_id_fkey',
      'automation_conversations::automation_conversations_customer_id_fkey',
      'automation_conversations::automation_conversations_tenant_id_fkey',
      'automation_cron_runs::automation_cron_runs_appointment_id_fkey',
      'automation_cron_runs::automation_cron_runs_tenant_id_fkey',
      'automation_dispatches::automation_dispatches_appointment_id_fkey',
      'automation_dispatches::automation_dispatches_customer_id_fkey',
      'automation_dispatches::automation_dispatches_tenant_id_fkey',
      'automation_interaction_events::automation_interaction_events_interaction_id_fkey',
      'automation_interaction_events::automation_interaction_events_tenant_id_fkey',
      'automation_interactions::automation_interactions_automation_id_fkey',
      'automation_interactions::automation_interactions_automation_template_id_fkey',
      'automation_interactions::automation_interactions_tenant_id_fkey',
      'automation_logs::automation_logs_appointment_id_fkey',
      'automation_logs::automation_logs_automation_id_fkey',
      'automation_logs::automation_logs_barber_id_fkey',
      'automation_logs::automation_logs_conversation_id_fkey',
      'automation_logs::automation_logs_tenant_id_fkey',
      'automation_queue::automation_queue_appointment_group_id_fkey',
      'automation_queue::automation_queue_appointment_id_fkey',
      'automation_queue::automation_queue_automation_id_fkey',
      'automation_queue::automation_queue_customer_id_fkey',
      'automation_queue::automation_queue_tenant_id_fkey',
      'automation_reconciliation_settings::automation_reconciliation_settings_tenant_id_fkey',
      'automation_send_history::automation_send_history_appointment_id_fkey',
      'automation_send_history::automation_send_history_conversation_id_fkey',
      'automation_send_history::automation_send_history_tenant_id_fkey',
      'automation_templates::automation_templates_tenant_id_fkey',
      'automation_templates::automation_templates_wait_timeout_interaction_id_fkey',
      'automation_v2_dispatches::automation_v2_dispatches_appointment_id_fkey',
      'automation_v2_dispatches::automation_v2_dispatches_customer_id_fkey',
      'automation_v2_dispatches::automation_v2_dispatches_session_id_fkey',
      'automation_v2_dispatches::automation_v2_dispatches_tenant_id_fkey',
      'automation_v2_logs::automation_v2_logs_appointment_id_fkey',
      'automation_v2_logs::automation_v2_logs_tenant_id_fkey',
      'automation_v2_sessions::automation_v2_sessions_appointment_id_fkey',
      'automation_v2_sessions::automation_v2_sessions_customer_id_fkey',
      'automation_v2_sessions::automation_v2_sessions_tenant_id_fkey',
      'automation_webhook_logs::automation_webhook_logs_appointment_id_fkey',
      'automation_webhook_logs::automation_webhook_logs_tenant_id_fkey',
      'automations::automations_barber_id_fkey',
      'automations::automations_tenant_id_fkey',
      'automations::automations_wait_timeout_interaction_id_fkey',
      'background_jobs::background_jobs_tenant_id_fkey',
      'barber_services::barber_services_barber_id_fkey',
      'barber_services::barber_services_service_id_fkey',
      'barber_services::barber_services_tenant_id_fkey',
      'barber_services::barber_services_user_id_fkey',
      'barber_tips::barber_tips_appointment_id_fkey',
      'barber_tips::barber_tips_barber_id_fkey',
      'barber_tips::barber_tips_customer_id_fkey',
      'barbers::barbers_tenant_id_fkey',
      'barbers::barbers_user_id_fkey',
      'barbershop_settings::barbershop_settings_barber_id_fkey',
      'barbershops::barbershops_owner_id_fkey',
      'barbershops::barbershops_plan_id_fkey',
      'campaign_logs::campaign_logs_campaign_id_fkey',
      'campaign_logs::campaign_logs_tenant_id_fkey',
      'campaigns::campaigns_tenant_id_fkey',
      'cashback_transactions::cashback_transactions_appointment_id_fkey',
      'cashback_transactions::cashback_transactions_customer_id_fkey',
      'client_auth::client_auth_customer_id_fkey',
      'communication_channels::communication_channels_tenant_id_fkey',
      'communication_messages::communication_messages_customer_id_fkey',
      'communication_messages::communication_messages_tenant_id_fkey',
      'communication_templates::communication_templates_tenant_id_fkey',
      'cookie_consents::cookie_consents_customer_id_fkey',
      'cookie_consents::cookie_consents_tenant_id_fkey',
      'coupons::coupons_tenant_id_fkey',
      'credit_transactions::credit_transactions_appointment_id_fkey',
      'credit_transactions::credit_transactions_customer_id_fkey',
      'customer_achievements::customer_achievements_achievement_id_fkey',
      'customer_achievements::customer_achievements_customer_id_fkey',
      'customer_credits::customer_credits_appointment_id_fkey',
      'customer_credits::customer_credits_customer_id_fkey',
      'customer_credits::customer_credits_tenant_id_fkey',
      'customer_documents::customer_documents_customer_id_fkey',
      'customer_documents::customer_documents_tenant_id_fkey',
      'customer_interactions::customer_interactions_author_id_fkey',
      'customer_interactions::customer_interactions_customer_id_fkey',
      'customer_interactions::customer_interactions_tenant_id_fkey',
      'customer_subscriptions::customer_subscriptions_coupon_id_fkey',
      'customer_subscriptions::customer_subscriptions_customer_id_fkey',
      'customer_subscriptions::customer_subscriptions_gateway_id_fkey',
      'customer_subscriptions::customer_subscriptions_plan_id_fkey',
      'customer_subscriptions::customer_subscriptions_referred_by_subscription_id_fkey',
      'customer_tasks::customer_tasks_author_id_fkey',
      'customer_tasks::customer_tasks_customer_id_fkey',
      'customer_tasks::customer_tasks_tenant_id_fkey',
      'customers::customers_auth_user_id_fkey',
      'customers::customers_barber_id_fkey',
      'customers::customers_loyalty_level_id_fkey',
      'customers::customers_tenant_id_fkey',
      'customers::customers_user_id_fkey',
      'email_logs::email_logs_tenant_id_fkey',
      'email_logs::email_logs_user_id_fkey',
      'email_settings::email_settings_tenant_id_fkey',
      'financial_adjustment_logs::financial_adjustment_logs_adjusted_by_fkey',
      'financial_adjustment_logs::financial_adjustment_logs_appointment_id_fkey',
      'financial_adjustment_logs::financial_adjustment_logs_tenant_id_fkey',
      'financial_adjustment_logs::financial_adjustment_logs_transaction_id_fkey',
      'lgpd_requests::lgpd_requests_customer_id_fkey',
      'lgpd_requests::lgpd_requests_tenant_id_fkey',
      'loyalty_campaign_participations::loyalty_campaign_participations_campaign_id_fkey',
      'loyalty_campaigns::loyalty_campaigns_template_slug_fkey',
      'loyalty_rewards::loyalty_rewards_customer_id_fkey',
      'marketing_audiences::marketing_audiences_tenant_id_fkey',
      'notification_recipients::notification_recipients_barber_id_fkey',
      'notifications::notifications_barber_id_fkey',
      'notifications::notifications_customer_id_fkey',
      'notifications::notifications_tenant_id_fkey',
      'notifications::notifications_user_id_fkey',
      'observability_logs::observability_logs_tenant_id_fkey',
      'operational_insights_interactions::operational_insights_interactions_user_id_fkey',
      'payment_gateway_logs::payment_gateway_logs_gateway_id_fkey',
      'payment_receipts::payment_receipts_appointment_id_fkey',
      'privacy_consents::privacy_consents_customer_id_fkey',
      'product_images::product_images_product_id_fkey',
      'product_sales::product_sales_appointment_id_fkey',
      'product_sales::product_sales_barber_id_fkey',
      'product_sales::product_sales_customer_id_fkey',
      'product_sales::product_sales_tenant_id_fkey',
      'product_sales::product_sales_user_id_fkey',
      'products::products_user_id_fkey',
      'professional_time_off::professional_time_off_approved_by_fkey',
      'professional_time_off::professional_time_off_cancelled_by_fkey',
      'professional_time_off::professional_time_off_professional_id_fkey',
      'professional_time_off::professional_time_off_requested_by_fkey',
      'professional_time_off::professional_time_off_tenant_id_fkey',
      'profiles::profiles_id_fkey',
      'profiles::profiles_tenant_id_fkey',
      'push_subscriptions::push_subscriptions_user_id_fkey',
      'refund_audits::refund_audits_refund_id_fkey',
      'refund_audits::refund_audits_tenant_id_fkey',
      'refund_requests::refund_requests_appointment_id_fkey',
      'refund_requests::refund_requests_customer_id_fkey',
      'review_automation_logs::review_automation_logs_appointment_id_fkey',
      'review_automation_logs::review_automation_logs_customer_id_fkey',
      'review_automation_logs::review_automation_logs_review_id_fkey',
      'review_automation_logs::review_automation_logs_tenant_id_fkey',
      'role_permissions::role_permissions_permission_key_fkey',
      'saas_addons::saas_addons_minimum_plan_id_fkey',
      'saas_admin_voucher_audit_logs::saas_admin_voucher_audit_logs_actor_user_id_fkey',
      'saas_admin_voucher_audit_logs::saas_admin_voucher_audit_logs_barbershop_id_fkey',
      'saas_admin_voucher_audit_logs::saas_admin_voucher_audit_logs_redemption_id_fkey',
      'saas_admin_voucher_audit_logs::saas_admin_voucher_audit_logs_tenant_id_fkey',
      'saas_admin_voucher_audit_logs::saas_admin_voucher_audit_logs_voucher_id_fkey',
      'saas_admin_voucher_redemptions::saas_admin_voucher_redemptions_applied_by_fkey',
      'saas_admin_voucher_redemptions::saas_admin_voucher_redemptions_applied_plan_id_fkey',
      'saas_admin_voucher_redemptions::saas_admin_voucher_redemptions_barbershop_id_fkey',
      'saas_admin_voucher_redemptions::saas_admin_voucher_redemptions_previous_plan_id_fkey',
      'saas_admin_voucher_redemptions::saas_admin_voucher_redemptions_revoked_by_fkey',
      'saas_admin_voucher_redemptions::saas_admin_voucher_redemptions_tenant_id_fkey',
      'saas_admin_voucher_redemptions::saas_admin_voucher_redemptions_voucher_id_fkey',
      'saas_admin_vouchers::saas_admin_vouchers_allowed_plan_id_fkey',
      'saas_admin_vouchers::saas_admin_vouchers_applied_by_fkey',
      'saas_admin_vouchers::saas_admin_vouchers_created_by_fkey',
      'saas_admin_vouchers::saas_admin_vouchers_revoked_by_fkey',
      'saas_admin_vouchers::saas_admin_vouchers_specific_barbershop_id_fkey',
      'saas_admin_vouchers::saas_admin_vouchers_specific_tenant_id_fkey',
      'saas_checkout_sessions::saas_checkout_sessions_user_id_fkey',
      'security_activity_logs::security_activity_logs_user_id_fkey',
      'service_ratings::service_ratings_appointment_id_fkey',
      'service_ratings::service_ratings_barber_id_fkey',
      'service_ratings::service_ratings_customer_id_fkey',
      'service_ratings::service_ratings_user_id_fkey',
      'services::services_tenant_id_fkey',
      'services::services_user_id_fkey',
      'status_checks::status_checks_service_id_fkey',
      'subscription_card_scans::subscription_card_scans_subscription_id_fkey',
      'subscription_invoices::subscription_invoices_coupon_id_fkey',
      'subscription_invoices::subscription_invoices_customer_id_fkey',
      'subscription_invoices::subscription_invoices_subscription_id_fkey',
      'subscription_loyalty_history::subscription_loyalty_history_customer_id_fkey',
      'subscription_loyalty_history::subscription_loyalty_history_reward_id_fkey',
      'subscription_loyalty_history::subscription_loyalty_history_subscription_id_fkey',
      'subscription_payments::subscription_payments_gateway_id_fkey',
      'subscription_payments::subscription_payments_subscription_id_fkey',
      'subscription_plan_benefit_services::subscription_plan_benefit_services_benefit_id_fkey',
      'subscription_plan_benefit_services::subscription_plan_benefit_services_plan_id_fkey',
      'subscription_plan_benefit_services::subscription_plan_benefit_services_service_id_fkey',
      'subscription_plan_benefits::subscription_plan_benefits_plan_id_fkey',
      'subscription_plan_changes::subscription_plan_changes_subscription_id_fkey',
      'subscription_plan_services::subscription_plan_services_plan_id_fkey',
      'subscription_plan_services::subscription_plan_services_service_id_fkey',
      'subscription_referrals::subscription_referrals_referred_customer_id_fkey',
      'subscription_referrals::subscription_referrals_referrer_customer_id_fkey',
      'subscription_referrals::subscription_referrals_referrer_subscription_id_fkey',
      'subscription_referrals::subscription_referrals_subscription_id_fkey',
      'subscription_status_logs::subscription_status_logs_subscription_id_fkey',
      'subscription_usage_logs::subscription_usage_logs_customer_id_fkey',
      'subscription_usage_logs::subscription_usage_logs_service_id_fkey',
      'subscription_usage_logs::subscription_usage_logs_subscription_id_fkey',
      'subscription_usage_logs::subscription_usage_logs_subscription_plan_id_fkey',
      'subscriptions::subscriptions_user_id_fkey',
      'support_messages::support_messages_sender_id_fkey',
      'support_messages::support_messages_ticket_id_fkey',
      'support_tickets::support_tickets_barbershop_id_fkey',
      'support_tickets::support_tickets_user_id_fkey',
      'team_audit_logs::team_audit_logs_actor_id_fkey',
      'team_audit_logs::team_audit_logs_tenant_id_fkey',
      'tenant_addons::tenant_addons_addon_id_fkey',
      'tenant_memberships::tenant_memberships_tenant_id_fkey',
      'tenant_memberships::tenant_memberships_user_id_fkey',
      'ticket_messages::ticket_messages_ticket_id_fkey',
      'transactions::transactions_adjusted_by_fkey',
      'transactions::transactions_appointment_id_fkey',
      'transactions::transactions_barber_id_fkey',
      'transactions::transactions_customer_id_fkey',
      'transactions::transactions_tenant_id_fkey',
      'transactions::transactions_user_id_fkey',
      'tutorials::tutorials_category_id_fkey',
      'user_invitations::user_invitations_invited_by_fkey',
      'user_invitations::user_invitations_professional_id_fkey',
      'user_invitations::user_invitations_tenant_id_fkey',
      'user_mfa_backup_codes::user_mfa_backup_codes_user_id_fkey',
      'user_onboarding_preferences::user_onboarding_preferences_user_id_fkey',
      'user_onboarding_progress::user_onboarding_progress_user_id_fkey',
      'user_tour_states::user_tour_states_user_id_fkey',
      'verification_challenges::verification_challenges_barber_id_fkey',
      'verification_challenges::verification_challenges_client_id_fkey',
      'waiting_list::waiting_list_barber_id_fkey',
      'waiting_list::waiting_list_customer_id_fkey',
      'waiting_list::waiting_list_service_id_fkey',
      'wallet::wallet_customer_id_fkey',
      'wallet_transactions::wallet_transactions_appointment_id_fkey',
      'wallet_transactions::wallet_transactions_wallet_id_fkey',
      'webhook_logs::webhook_logs_barbershop_id_fkey',
      'whatsapp_cloud_connections::whatsapp_connections_user_id_fkey',
      'whatsapp_conversations::whatsapp_conversations_appointment_id_fkey',
      'whatsapp_conversations::whatsapp_conversations_barber_id_fkey',
      'whatsapp_conversations::whatsapp_conversations_customer_id_fkey',
      'whatsapp_delivery_logs::whatsapp_delivery_logs_appointment_id_fkey',
      'whatsapp_delivery_logs::whatsapp_delivery_logs_dispatch_id_fkey',
      'whatsapp_delivery_logs::whatsapp_delivery_logs_tenant_id_fkey',
      'whatsapp_instances::whatsapp_connections_barber_id_fkey',
      'whatsapp_instances::whatsapp_connections_barbershop_id_fkey',
      'whatsapp_messages::whatsapp_messages_connection_id_fkey',
      'whatsapp_messages::whatsapp_messages_customer_id_fkey',
      'whatsapp_messages::whatsapp_messages_user_id_fkey',
      'whatsapp_templates::whatsapp_templates_user_id_fkey',
      'zapi_integration_logs::zapi_integration_logs_tenant_id_fkey',
      'zapi_webhook_debug::zapi_webhook_debug_matched_conversation_id_fkey',
      'zapi_webhook_debug::zapi_webhook_debug_tenant_id_fkey',
      'zapi_webhook_logs::zapi_webhook_logs_tenant_id_fkey'
  ];
  v_expected_pks text[] := ARRAY[
      'academy_lessons::academy_lessons_pkey',
      'academy_modules::academy_modules_pkey',
      'academy_paths::academy_paths_pkey',
      'academy_progress::academy_progress_pkey',
      'addon_upgrade_recommendations::addon_upgrade_recommendations_pkey',
      'admin_event_log::admin_event_log_pkey',
      'admin_event_subscriptions::admin_event_subscriptions_pkey',
      'admin_event_templates::admin_event_templates_pkey',
      'admin_notifications::admin_notifications_pkey',
      'ai_settings::ai_settings_pkey',
      'appointment_checkins::appointment_checkins_pkey',
      'appointment_groups::appointment_groups_pkey',
      'appointment_reviews::appointment_reviews_pkey',
      'appointment_status_logs::appointment_status_logs_pkey',
      'appointments::appointments_pkey',
      'audit_logs::audit_logs_pkey',
      'automation_conversations::automation_conversations_pkey',
      'automation_cron_runs::automation_cron_runs_pkey',
      'automation_dispatches::automation_dispatches_pkey',
      'automation_interaction_events::automation_interaction_events_pkey',
      'automation_interactions::automation_interactions_pkey',
      'automation_logs::automation_logs_pkey',
      'automation_queue::automation_queue_pkey',
      'automation_reconciliation_settings::automation_reconciliation_settings_pkey',
      'automation_send_history::automation_send_history_pkey',
      'automation_status::automation_status_pkey',
      'automation_templates::automation_templates_pkey',
      'automation_v2_dispatches::automation_v2_dispatches_pkey',
      'automation_v2_logs::automation_v2_logs_pkey',
      'automation_v2_sessions::automation_v2_sessions_pkey',
      'automation_webhook_logs::automation_webhook_logs_pkey',
      'automations::automations_pkey',
      'availability_conflict_logs::availability_conflict_logs_pkey',
      'background_jobs::background_jobs_pkey',
      'barber_commissions::barber_commissions_pkey',
      'barber_services::barber_services_pkey',
      'barber_tips::barber_tips_pkey',
      'barbers::barbers_pkey',
      'barbershop_module_logs::barbershop_module_logs_pkey',
      'barbershop_modules::barbershop_modules_pkey',
      'barbershop_settings::barbershop_settings_pkey',
      'barbershops::barbershops_pkey',
      'campaign_logs::campaign_logs_pkey',
      'campaigns::campaigns_pkey',
      'cashback_transactions::cashback_transactions_pkey',
      'client_auth::client_auth_pkey',
      'commission_closings::commission_closings_pkey',
      'commission_entries::commission_entries_pkey',
      'communication_channels::communication_channels_pkey',
      'communication_messages::communication_messages_pkey',
      'communication_templates::communication_templates_pkey',
      'cookie_consents::cookie_consents_pkey',
      'coupons::coupons_pkey',
      'credit_transactions::credit_transactions_pkey',
      'customer_achievements::customer_achievements_pkey',
      'customer_credits::customer_credits_pkey',
      'customer_documents::customer_documents_pkey',
      'customer_interactions::customer_interactions_pkey',
      'customer_subscriptions::customer_subscriptions_pkey',
      'customer_tasks::customer_tasks_pkey',
      'customers::customers_pkey',
      'email_logs::email_logs_pkey',
      'email_settings::email_settings_pkey',
      'financial_adjustment_logs::financial_adjustment_logs_pkey',
      'lgpd_requests::lgpd_requests_pkey',
      'loyalty_achievements::loyalty_achievements_pkey',
      'loyalty_campaign_participations::loyalty_campaign_participations_pkey',
      'loyalty_campaign_templates::loyalty_campaign_templates_pkey',
      'loyalty_campaigns::loyalty_campaigns_pkey',
      'loyalty_levels::loyalty_levels_pkey',
      'loyalty_rewards::loyalty_rewards_pkey',
      'loyalty_settings::loyalty_settings_pkey',
      'marketing_audiences::marketing_audiences_pkey',
      'notification_recipients::notification_recipients_pkey',
      'notifications::notifications_pkey',
      'observability_logs::observability_logs_pkey',
      'onboarding_settings::onboarding_settings_pkey',
      'operation_locks::operation_locks_pkey',
      'operational_insights_interactions::operational_insights_interactions_pkey',
      'payment_gateway_logs::payment_gateway_logs_pkey',
      'payment_gateways::payment_gateways_pkey',
      'payment_receipts::payment_receipts_pkey',
      'permissions::permissions_pkey',
      'plans::plans_pkey',
      'privacy_consents::privacy_consents_pkey',
      'product_images::product_images_pkey',
      'product_sales::product_sales_pkey',
      'products::products_pkey',
      'professional_time_off::professional_time_off_pkey',
      'profiles::profiles_pkey',
      'push_subscriptions::push_subscriptions_pkey',
      'rate_limit_hits::rate_limit_hits_pkey',
      'reception_permissions::reception_permissions_pkey',
      'refund_audits::refund_audits_pkey',
      'refund_requests::refund_requests_pkey',
      'resend_settings::resend_settings_pkey',
      'review_automation_logs::review_automation_logs_pkey',
      'role_permissions::role_permissions_pkey',
      'saas_addons::saas_addons_pkey',
      'saas_admin_voucher_audit_logs::saas_admin_voucher_audit_logs_pkey',
      'saas_admin_voucher_redemptions::saas_admin_voucher_redemptions_pkey',
      'saas_admin_vouchers::saas_admin_vouchers_pkey',
      'saas_billing_settings::saas_billing_settings_pkey',
      'saas_checkout_sessions::saas_checkout_sessions_pkey',
      'security_activity_logs::security_activity_logs_pkey',
      'service_ratings::service_ratings_pkey',
      'services::services_pkey',
      'status_checks::status_checks_pkey',
      'status_incidents::status_incidents_pkey',
      'status_maintenances::status_maintenances_pkey',
      'status_services::status_services_pkey',
      'subprocessors::subprocessors_pkey',
      'subscription_card_scans::subscription_card_scans_pkey',
      'subscription_invoices::subscription_invoices_pkey',
      'subscription_loyalty_history::subscription_loyalty_history_pkey',
      'subscription_loyalty_rewards::subscription_loyalty_rewards_pkey',
      'subscription_payments::subscription_payments_pkey',
      'subscription_plan_benefit_services::subscription_plan_benefit_services_pkey',
      'subscription_plan_benefits::subscription_plan_benefits_pkey',
      'subscription_plan_changes::subscription_plan_changes_pkey',
      'subscription_plan_services::subscription_plan_services_pkey',
      'subscription_plans::subscription_plans_pkey',
      'subscription_referrals::subscription_referrals_pkey',
      'subscription_status_logs::subscription_status_logs_pkey',
      'subscription_usage_logs::subscription_usage_logs_pkey',
      'subscriptions::subscriptions_pkey',
      'support_messages::support_messages_pkey',
      'support_tickets::support_tickets_pkey',
      'system_health_settings::system_health_settings_pkey',
      'system_settings::system_settings_pkey',
      'team_audit_logs::team_audit_logs_pkey',
      'tenant_addons::tenant_addons_pkey',
      'tenant_integrations::tenant_integrations_pkey',
      'tenant_memberships::tenant_memberships_pkey',
      'tenant_webhooks::tenant_webhooks_pkey',
      'ticket_messages::ticket_messages_pkey',
      'transactions::transactions_pkey',
      'tutorial_categories::tutorial_categories_pkey',
      'tutorials::tutorials_pkey',
      'user_invitations::user_invitations_pkey',
      'user_mfa_backup_codes::user_mfa_backup_codes_pkey',
      'user_onboarding_preferences::user_onboarding_preferences_pkey',
      'user_onboarding_progress::user_onboarding_progress_pkey',
      'user_roles::user_roles_pkey',
      'user_tour_states::user_tour_states_pkey',
      'verification_challenges::verification_challenges_pkey',
      'waiting_list::waiting_list_pkey',
      'wallet::wallet_pkey',
      'wallet_transactions::wallet_transactions_pkey',
      'webhook_logs::webhook_logs_pkey',
      'whatsapp_cloud_connections::whatsapp_connections_pkey',
      'whatsapp_conversations::whatsapp_conversations_pkey',
      'whatsapp_delivery_logs::whatsapp_delivery_logs_pkey',
      'whatsapp_instances::whatsapp_connections_pkey1',
      'whatsapp_messages::whatsapp_messages_pkey',
      'whatsapp_templates::whatsapp_templates_pkey',
      'zapi_integration_logs::zapi_integration_logs_pkey',
      'zapi_webhook_debug::zapi_webhook_debug_pkey',
      'zapi_webhook_logs::zapi_webhook_logs_pkey'
  ];
  v_expected_uniques text[] := ARRAY[
      'academy_progress::academy_progress_user_id_lesson_id_key',
      'admin_event_subscriptions::admin_event_subscriptions_user_id_event_key_key',
      'ai_settings::ai_settings_tenant_id_key',
      'appointment_checkins::appointment_checkins_appointment_id_key',
      'appointment_groups::appointment_groups_group_token_key',
      'appointment_reviews::appointment_reviews_appointment_id_key',
      'appointment_reviews::appointment_reviews_review_token_key',
      'automation_dispatches::automation_dispatches_unique_key_key',
      'automation_templates::automation_templates_tenant_id_key_key',
      'barber_commissions::barber_commissions_appointment_barber_key',
      'barber_services::barber_services_barber_id_service_id_key',
      'barbershop_modules::barbershop_modules_tenant_id_module_key_key',
      'barbershop_settings::barbershop_settings_barber_id_key',
      'barbershops::barbershops_owner_id_key',
      'barbershops::barbershops_slug_key',
      'cashback_transactions::unique_cashback_per_appointment',
      'client_auth::client_auth_phone_key',
      'client_auth::client_auth_phone_unique',
      'commission_entries::commission_entries_appointment_id_key',
      'communication_channels::communication_channels_tenant_id_type_key',
      'communication_templates::communication_templates_tenant_id_key_channel_type_key',
      'coupons::coupons_tenant_id_code_key',
      'customer_achievements::customer_achievements_customer_id_achievement_id_key',
      'customer_credits::customer_credits_appointment_id_key',
      'email_logs::email_logs_provider_event_id_key',
      'email_settings::email_settings_tenant_id_key',
      'loyalty_campaign_participations::loyalty_campaign_participations_campaign_id_customer_id_key',
      'loyalty_campaign_templates::loyalty_campaign_templates_slug_key',
      'loyalty_settings::loyalty_settings_tenant_id_key',
      'notifications::notifications_tenant_type_unique_key_key',
      'permissions::permissions_key_key',
      'plans::plans_name_key',
      'profiles::profiles_checkin_token_key',
      'profiles::profiles_slug_key',
      'push_subscriptions::push_subscriptions_endpoint_key',
      'reception_permissions::reception_permissions_user_id_key',
      'role_permissions::role_permissions_role_permission_key_key',
      'saas_addons::saas_addons_addon_key_key',
      'saas_billing_settings::saas_billing_settings_singleton_key',
      'service_ratings::service_ratings_appointment_id_key',
      'status_services::status_services_slug_key',
      'subscription_loyalty_history::subscription_loyalty_history_unique_cycle',
      'subscription_loyalty_rewards::subscription_loyalty_rewards_tenant_id_months_required_rewa_key',
      'subscription_plan_benefit_services::subscription_plan_benefit_services_benefit_id_service_id_key',
      'subscription_plan_benefits::subscription_plan_benefits_plan_id_benefit_key_key',
      'subscription_plan_services::subscription_plan_services_plan_id_service_id_key',
      'subscription_referrals::subscription_referrals_subscription_id_key',
      'subscriptions::subscriptions_stripe_subscription_id_key',
      'tenant_integrations::tenant_integrations_tenant_id_provider_key',
      'tenant_memberships::tenant_memberships_tenant_id_user_id_key',
      'tutorial_categories::tutorial_categories_name_key',
      'tutorials::tutorials_slug_key',
      'user_onboarding_progress::user_onboarding_progress_user_id_tenant_id_step_key_key',
      'user_roles::user_roles_user_id_key',
      'user_tour_states::user_tour_states_user_id_tenant_id_tour_key_key',
      'wallet::wallet_customer_id_key',
      'whatsapp_instances::unique_barbershop_whatsapp',
      'whatsapp_templates::whatsapp_templates_user_id_event_type_key'
  ];
  v_expected_checks text[] := ARRAY[
      'addon_upgrade_recommendations::addon_upgrade_recommendations_customer_action_check',
      'appointment_reviews::appointment_reviews_barber_rating_check',
      'appointment_reviews::appointment_reviews_barbershop_rating_check',
      'appointment_reviews::appointment_reviews_service_rating_check',
      'appointment_reviews::appointment_reviews_testimonial_status_check',
      'appointment_reviews::appointment_reviews_would_recommend_check',
      'appointments::appointments_appointment_type_check',
      'appointments::appointments_refund_status_check',
      'appointments::appointments_refund_type_check',
      'appointments::appointments_review_decision_check',
      'automation_interaction_events::automation_interaction_events_type_check',
      'automation_interactions::automation_interactions_action_type_check',
      'automation_interactions::automation_interactions_color_check',
      'automation_interactions::automation_interactions_parent_check',
      'barber_commissions::barber_commissions_status_check',
      'barber_tips::barber_tips_amount_check',
      'barber_tips::barber_tips_status_check',
      'barbers::barbers_pix_key_type_check',
      'communication_messages::communication_messages_direction_check',
      'coupons::coupons_applies_to_check',
      'coupons::coupons_type_check',
      'customer_subscriptions::customer_subscriptions_status_check',
      'lgpd_requests::lgpd_requests_request_type_check',
      'lgpd_requests::lgpd_requests_status_check',
      'loyalty_rewards::loyalty_rewards_status_check',
      'loyalty_settings::loyalty_settings_appointments_required_check',
      'loyalty_settings::loyalty_settings_benefit_type_check',
      'loyalty_settings::loyalty_settings_validity_days_check',
      'product_sales::check_items_not_empty',
      'professional_time_off::time_off_dates_check',
      'profiles::profiles_loyalty_mode_check',
      'refund_audits::refund_audits_changed_by_type_check',
      'saas_admin_voucher_redemptions::saas_admin_voucher_redemptions_status_check',
      'saas_admin_vouchers::saas_admin_vouchers_discount_percentage_check',
      'saas_admin_vouchers::saas_admin_vouchers_duration_type_check',
      'saas_admin_vouchers::saas_admin_vouchers_purpose_check',
      'saas_admin_vouchers::saas_admin_vouchers_status_check',
      'service_ratings::service_ratings_rating_check',
      'subscription_invoices::subscription_invoices_status_check',
      'subscription_loyalty_history::subscription_loyalty_history_status_check',
      'subscription_loyalty_rewards::subscription_loyalty_rewards_months_required_check',
      'subscription_loyalty_rewards::subscription_loyalty_rewards_reward_type_check',
      'subscription_plan_benefit_services::subscription_plan_benefit_services_consume_quantity_check',
      'subscription_plan_benefits::subscription_plan_benefits_monthly_limit_check',
      'subscription_plan_changes::subscription_plan_changes_change_type_check',
      'subscription_plans::subscription_plans_barber_commission_type_check',
      'subscription_plans::subscription_plans_monthly_price_check',
      'subscription_plans::subscription_plans_plan_type_check',
      'subscription_plans::subscription_plans_usage_type_check',
      'tenant_addons::tenant_addons_status_check',
      'ticket_messages::ticket_messages_sender_type_check',
      'tutorials::tutorials_level_check',
      'tutorials::tutorials_type_check',
      'user_invitations::user_invitations_status_check',
      'verification_challenges::verification_challenges_target_exclusivity_check',
      'wallet_transactions::wallet_transactions_type_check',
      'whatsapp_cloud_connections::whatsapp_connections_status_check',
      'whatsapp_messages::whatsapp_messages_status_check',
      'whatsapp_messages::whatsapp_messages_type_check'
  ];
  v_expected_indexes text[] := ARRAY[
      'academy_lessons::academy_lessons_pkey',
      'academy_modules::academy_modules_pkey',
      'academy_paths::academy_paths_pkey',
      'academy_progress::academy_progress_pkey',
      'academy_progress::academy_progress_user_id_lesson_id_key',
      'addon_upgrade_recommendations::addon_upgrade_recommendations_pkey',
      'addon_upgrade_recommendations::idx_addon_upgrade_rec_created',
      'addon_upgrade_recommendations::idx_addon_upgrade_rec_tenant',
      'admin_event_log::admin_event_log_pkey',
      'admin_event_log::idx_admin_event_log_event_key',
      'admin_event_log::idx_admin_event_log_tenant',
      'admin_event_subscriptions::admin_event_subscriptions_pkey',
      'admin_event_subscriptions::admin_event_subscriptions_user_id_event_key_key',
      'admin_event_templates::admin_event_templates_pkey',
      'admin_notifications::admin_notifications_pkey',
      'admin_notifications::idx_admin_notifications_created_at',
      'admin_notifications::idx_admin_notifications_event_key',
      'admin_notifications::idx_admin_notifications_priority',
      'admin_notifications::idx_admin_notifications_unread',
      'ai_settings::ai_settings_pkey',
      'ai_settings::ai_settings_tenant_id_key',
      'appointment_checkins::appointment_checkins_appointment_id_key',
      'appointment_checkins::appointment_checkins_pkey',
      'appointment_groups::appointment_groups_group_token_key',
      'appointment_groups::appointment_groups_pkey',
      'appointment_reviews::appointment_reviews_appointment_id_key',
      'appointment_reviews::appointment_reviews_pkey',
      'appointment_reviews::appointment_reviews_review_token_key',
      'appointment_reviews::idx_appointment_reviews_barber',
      'appointment_reviews::idx_appointment_reviews_status',
      'appointment_reviews::idx_appointment_reviews_tenant',
      'appointment_reviews::idx_appointment_reviews_token',
      'appointment_status_logs::appointment_status_logs_pkey',
      'appointments::appointments_management_token_idx',
      'appointments::appointments_pkey',
      'appointments::idx_appointments_confirmation_sent',
      'appointments::idx_appointments_confirmation_sent_at',
      'appointments::idx_appointments_customer_id',
      'appointments::idx_appointments_group_id',
      'appointments::idx_appointments_reminder_sent',
      'appointments::idx_appointments_reminder_sent_at',
      'appointments::idx_appointments_review_decision',
      'appointments::idx_appointments_tenant_id',
      'appointments::idx_appointments_tenant_status',
      'appointments::idx_appointments_type_tenant',
      'appointments::idx_appointments_walkin_barber_time',
      'appointments::idx_appts_subscription',
      'audit_logs::audit_logs_pkey',
      'automation_conversations::automation_conversations_pkey',
      'automation_conversations::idx_automation_conv_phone',
      'automation_conversations::idx_automation_conv_tenant',
      'automation_cron_runs::automation_cron_runs_pkey',
      'automation_dispatches::automation_dispatches_pkey',
      'automation_dispatches::automation_dispatches_unique_key_key',
      'automation_dispatches::idx_automation_disp_status',
      'automation_dispatches::idx_automation_disp_tenant',
      'automation_interaction_events::automation_interaction_events_pkey',
      'automation_interaction_events::idx_automation_interaction_events_dispatch',
      'automation_interaction_events::idx_automation_interaction_events_interaction',
      'automation_interaction_events::idx_automation_interaction_events_tenant',
      'automation_interaction_events::idx_automation_interaction_events_workflow',
      'automation_interactions::automation_interactions_pkey',
      'automation_interactions::idx_automation_interactions_automation',
      'automation_interactions::idx_automation_interactions_template',
      'automation_interactions::idx_automation_interactions_tenant',
      'automation_logs::automation_logs_pkey',
      'automation_logs::idx_automation_logs_conv',
      'automation_logs::idx_automation_logs_created_at',
      'automation_logs::idx_automation_logs_idempotency',
      'automation_logs::idx_automation_logs_provider_message_id',
      'automation_logs::idx_automation_logs_tenant',
      'automation_logs::idx_automation_logs_tenant_created',
      'automation_logs::idx_automation_logs_tenant_id',
      'automation_queue::automation_queue_pkey',
      'automation_queue::idx_automation_queue_idempotency',
      'automation_queue::idx_automation_queue_reminders',
      'automation_queue::idx_automation_queue_unique_confirmation',
      'automation_queue::idx_unique_birthday_per_year',
      'automation_queue::idx_unique_birthday_queue_per_year',
      'automation_reconciliation_settings::automation_reconciliation_settings_pkey',
      'automation_send_history::automation_send_history_pkey',
      'automation_status::automation_status_pkey',
      'automation_templates::automation_templates_pkey',
      'automation_templates::automation_templates_tenant_id_key_key',
      'automation_templates::idx_automation_templates_tenant_event',
      'automation_v2_dispatches::automation_v2_dispatches_pkey',
      'automation_v2_dispatches::idx_anniversary_uniqueness',
      'automation_v2_dispatches::idx_auto_v2_disp_appt',
      'automation_v2_dispatches::idx_auto_v2_disp_created',
      'automation_v2_dispatches::idx_auto_v2_disp_msg',
      'automation_v2_dispatches::idx_auto_v2_disp_tenant',
      'automation_v2_dispatches::idx_unique_birthday_dispatch_per_year',
      'automation_v2_logs::automation_v2_logs_pkey',
      'automation_v2_sessions::automation_v2_sessions_pkey',
      'automation_webhook_logs::automation_webhook_logs_pkey',
      'automations::automations_pkey',
      'availability_conflict_logs::availability_conflict_logs_pkey',
      'availability_conflict_logs::idx_avail_conflict_logs_tenant_created',
      'background_jobs::background_jobs_pkey',
      'background_jobs::idx_bg_jobs_status_next_run',
      'background_jobs::idx_bg_jobs_tenant_id',
      'barber_commissions::barber_commissions_appointment_barber_key',
      'barber_commissions::barber_commissions_pkey',
      'barber_commissions::idx_barber_commissions_appointment',
      'barber_commissions::idx_barber_commissions_created_at',
      'barber_commissions::idx_barber_commissions_tenant_barber_status',
      'barber_services::barber_services_barber_id_service_id_key',
      'barber_services::barber_services_pkey',
      'barber_services::idx_barber_services_barber_id',
      'barber_services::idx_barber_services_service_id',
      'barber_services::idx_barber_services_tenant_id',
      'barber_services::idx_barber_services_user_id',
      'barber_tips::barber_tips_barber_idx',
      'barber_tips::barber_tips_pkey',
      'barber_tips::barber_tips_tenant_idx',
      'barbers::barbers_pkey',
      'barbers::idx_barbers_tenant_id',
      'barbershop_module_logs::barbershop_module_logs_pkey',
      'barbershop_module_logs::idx_barbershop_module_logs_tenant',
      'barbershop_modules::barbershop_modules_pkey',
      'barbershop_modules::barbershop_modules_tenant_id_module_key_key',
      'barbershop_modules::idx_barbershop_modules_tenant',
      'barbershop_settings::barbershop_settings_barber_id_key',
      'barbershop_settings::barbershop_settings_pkey',
      'barbershops::barbershops_owner_id_key',
      'barbershops::barbershops_pkey',
      'barbershops::barbershops_slug_key',
      'campaign_logs::campaign_logs_pkey',
      'campaigns::campaigns_pkey',
      'cashback_transactions::cashback_transactions_pkey',
      'cashback_transactions::unique_cashback_per_appointment',
      'client_auth::client_auth_phone_key',
      'client_auth::client_auth_phone_unique',
      'client_auth::client_auth_pkey',
      'client_auth::idx_client_auth_customer_id',
      'client_auth::idx_client_auth_phone',
      'commission_closings::commission_closings_pkey',
      'commission_closings::idx_commission_closings_barber',
      'commission_closings::idx_commission_closings_tenant',
      'commission_entries::commission_entries_appointment_id_key',
      'commission_entries::commission_entries_pkey',
      'commission_entries::idx_commission_entries_barber',
      'commission_entries::idx_commission_entries_earned_at',
      'commission_entries::idx_commission_entries_status',
      'commission_entries::idx_commission_entries_tenant',
      'communication_channels::communication_channels_pkey',
      'communication_channels::communication_channels_tenant_id_type_key',
      'communication_messages::communication_messages_pkey',
      'communication_templates::communication_templates_pkey',
      'communication_templates::communication_templates_tenant_id_key_channel_type_key',
      'cookie_consents::cookie_consents_pkey',
      'cookie_consents::idx_cookie_consents_created',
      'cookie_consents::idx_cookie_consents_customer',
      'cookie_consents::idx_cookie_consents_tenant',
      'coupons::coupons_pkey',
      'coupons::coupons_tenant_id_code_key',
      'coupons::idx_coupons_applies_to',
      'credit_transactions::credit_transactions_pkey',
      'credit_transactions::unique_credit_used_per_appointment',
      'customer_achievements::customer_achievements_customer_id_achievement_id_key',
      'customer_achievements::customer_achievements_pkey',
      'customer_credits::customer_credits_appointment_id_key',
      'customer_credits::customer_credits_payment_id_idx',
      'customer_credits::customer_credits_pkey',
      'customer_documents::customer_documents_pkey',
      'customer_interactions::customer_interactions_pkey',
      'customer_subscriptions::customer_subscriptions_pkey',
      'customer_subscriptions::idx_cust_subs_customer',
      'customer_subscriptions::idx_cust_subs_provider_sub_id',
      'customer_subscriptions::idx_cust_subs_status',
      'customer_subscriptions::idx_cust_subs_tenant',
      'customer_subscriptions::uq_cust_one_active_sub',
      'customer_subscriptions::uq_customer_subscriptions_card_token',
      'customer_subscriptions::uq_customer_subscriptions_referral_code',
      'customer_tasks::customer_tasks_pkey',
      'customers::customers_pkey',
      'customers::idx_customers_auth_user_id',
      'customers::idx_customers_barber_id',
      'customers::idx_customers_birthday_sent',
      'customers::idx_customers_tenant_auth_user',
      'customers::idx_customers_tenant_id',
      'email_logs::email_logs_pkey',
      'email_logs::email_logs_provider_event_id_key',
      'email_logs::idx_email_logs_provider_message_id',
      'email_settings::email_settings_pkey',
      'email_settings::email_settings_tenant_id_key',
      'financial_adjustment_logs::financial_adjustment_logs_pkey',
      'lgpd_requests::idx_lgpd_requests_customer',
      'lgpd_requests::idx_lgpd_requests_status',
      'lgpd_requests::idx_lgpd_requests_tenant',
      'lgpd_requests::lgpd_requests_pkey',
      'loyalty_achievements::loyalty_achievements_pkey',
      'loyalty_campaign_participations::idx_loyalty_part_campaign',
      'loyalty_campaign_participations::idx_loyalty_part_customer',
      'loyalty_campaign_participations::idx_loyalty_part_tenant',
      'loyalty_campaign_participations::loyalty_campaign_participations_campaign_id_customer_id_key',
      'loyalty_campaign_participations::loyalty_campaign_participations_pkey',
      'loyalty_campaign_templates::loyalty_campaign_templates_pkey',
      'loyalty_campaign_templates::loyalty_campaign_templates_slug_key',
      'loyalty_campaigns::idx_loyalty_campaigns_status',
      'loyalty_campaigns::idx_loyalty_campaigns_tenant',
      'loyalty_campaigns::loyalty_campaigns_pkey',
      'loyalty_levels::loyalty_levels_pkey',
      'loyalty_rewards::idx_loyalty_rewards_customer',
      'loyalty_rewards::idx_loyalty_rewards_status',
      'loyalty_rewards::idx_loyalty_rewards_tenant',
      'loyalty_rewards::loyalty_rewards_pkey',
      'loyalty_settings::loyalty_settings_pkey',
      'loyalty_settings::loyalty_settings_tenant_id_key',
      'marketing_audiences::marketing_audiences_pkey',
      'notification_recipients::idx_notification_recipients_barber',
      'notification_recipients::idx_notification_recipients_tenant',
      'notification_recipients::notification_recipients_pkey',
      'notification_recipients::notification_recipients_tenant_phone_barber_key',
      'notifications::idx_notifications_barber_id',
      'notifications::idx_notifications_customer_id',
      'notifications::idx_notifications_dedup',
      'notifications::idx_notifications_read',
      'notifications::idx_notifications_tenant_id',
      'notifications::idx_notifications_user_id',
      'notifications::notifications_pkey',
      'notifications::notifications_tenant_type_unique_key_key',
      'notifications::notifications_unique_idx',
      'observability_logs::idx_obs_logs_correlation_id',
      'observability_logs::idx_obs_logs_created_at',
      'observability_logs::idx_obs_logs_tenant_id',
      'observability_logs::observability_logs_pkey',
      'onboarding_settings::onboarding_settings_pkey',
      'operation_locks::idx_operation_locks_expires_at',
      'operation_locks::operation_locks_pkey',
      'operational_insights_interactions::operational_insights_interactions_pkey',
      'payment_gateway_logs::idx_payment_gateway_logs_gateway',
      'payment_gateway_logs::idx_payment_gateway_logs_tenant',
      'payment_gateway_logs::payment_gateway_logs_pkey',
      'payment_gateways::idx_payment_gateways_tenant',
      'payment_gateways::one_primary_gateway_per_tenant',
      'payment_gateways::payment_gateways_pkey',
      'payment_receipts::idx_payment_receipts_appointment',
      'payment_receipts::idx_payment_receipts_tenant',
      'payment_receipts::payment_receipts_pkey',
      'permissions::permissions_key_key',
      'permissions::permissions_pkey',
      'plans::idx_plans_stripe_price_live',
      'plans::idx_plans_stripe_price_test',
      'plans::plans_name_key',
      'plans::plans_pkey',
      'plans::plans_slug_key',
      'privacy_consents::idx_privacy_consents_customer',
      'privacy_consents::idx_privacy_consents_tenant',
      'privacy_consents::privacy_consents_pkey',
      'product_images::product_images_pkey',
      'product_sales::idx_product_sales_appointment_id',
      'product_sales::idx_product_sales_barber_id',
      'product_sales::product_sales_pkey',
      'products::idx_products_category',
      'products::idx_products_slug',
      'products::products_pkey',
      'professional_time_off::professional_time_off_pkey',
      'profiles::idx_profiles_email',
      'profiles::profiles_checkin_token_key',
      'profiles::profiles_pkey',
      'profiles::profiles_slug_key',
      'push_subscriptions::idx_push_subs_phone',
      'push_subscriptions::idx_push_subs_tenant',
      'push_subscriptions::idx_push_subs_user',
      'push_subscriptions::push_subscriptions_endpoint_key',
      'push_subscriptions::push_subscriptions_pkey',
      'rate_limit_hits::idx_rate_limit_bucket_key_time',
      'rate_limit_hits::rate_limit_hits_pkey',
      'reception_permissions::idx_reception_permissions_tenant',
      'reception_permissions::reception_permissions_pkey',
      'reception_permissions::reception_permissions_user_id_key',
      'refund_audits::refund_audits_pkey',
      'refund_requests::idx_refund_requests_appointment_id',
      'refund_requests::idx_refund_requests_created_at',
      'refund_requests::idx_refund_requests_single_active_per_appointment',
      'refund_requests::idx_refund_requests_status',
      'refund_requests::idx_refund_requests_tenant_id',
      'refund_requests::refund_requests_pkey',
      'resend_settings::resend_settings_pkey',
      'resend_settings::resend_settings_single_row',
      'review_automation_logs::idx_review_logs_tenant',
      'review_automation_logs::review_automation_logs_pkey',
      'review_automation_logs::uniq_review_log_per_appointment',
      'role_permissions::role_permissions_pkey',
      'role_permissions::role_permissions_role_permission_key_key',
      'saas_addons::saas_addons_addon_key_key',
      'saas_addons::saas_addons_pkey',
      'saas_admin_voucher_audit_logs::idx_admin_voucher_audit_created',
      'saas_admin_voucher_audit_logs::idx_admin_voucher_audit_tenant',
      'saas_admin_voucher_audit_logs::idx_admin_voucher_audit_voucher',
      'saas_admin_voucher_audit_logs::saas_admin_voucher_audit_logs_pkey',
      'saas_admin_voucher_redemptions::idx_redemption_status',
      'saas_admin_voucher_redemptions::idx_redemption_tenant',
      'saas_admin_voucher_redemptions::saas_admin_voucher_redemptions_pkey',
      'saas_admin_voucher_redemptions::uq_redemption_voucher_active',
      'saas_admin_vouchers::idx_admin_voucher_status',
      'saas_admin_vouchers::idx_admin_voucher_tenant',
      'saas_admin_vouchers::saas_admin_vouchers_pkey',
      'saas_admin_vouchers::uq_admin_voucher_internal_tenant',
      'saas_billing_settings::saas_billing_settings_pkey',
      'saas_billing_settings::saas_billing_settings_singleton_key',
      'saas_checkout_sessions::idx_saas_checkout_session',
      'saas_checkout_sessions::idx_saas_checkout_tenant',
      'saas_checkout_sessions::saas_checkout_sessions_pkey',
      'security_activity_logs::security_activity_logs_pkey',
      'service_ratings::service_ratings_appointment_id_key',
      'service_ratings::service_ratings_pkey',
      'services::idx_services_tenant_id',
      'services::services_pkey',
      'status_checks::idx_status_checks_service_time',
      'status_checks::status_checks_pkey',
      'status_incidents::status_incidents_pkey',
      'status_maintenances::status_maintenances_pkey',
      'status_services::status_services_pkey',
      'status_services::status_services_slug_key',
      'subprocessors::subprocessors_pkey',
      'subscription_card_scans::idx_card_scans_scanned_at',
      'subscription_card_scans::idx_card_scans_subscription',
      'subscription_card_scans::idx_card_scans_tenant',
      'subscription_card_scans::subscription_card_scans_pkey',
      'subscription_invoices::idx_sub_inv_status',
      'subscription_invoices::idx_sub_inv_sub',
      'subscription_invoices::idx_sub_inv_tenant',
      'subscription_invoices::subscription_invoices_pkey',
      'subscription_loyalty_history::idx_sub_loyalty_history_customer',
      'subscription_loyalty_history::idx_sub_loyalty_history_subscription',
      'subscription_loyalty_history::idx_sub_loyalty_history_tenant',
      'subscription_loyalty_history::subscription_loyalty_history_pkey',
      'subscription_loyalty_history::subscription_loyalty_history_unique_cycle',
      'subscription_loyalty_rewards::idx_sub_loyalty_rewards_tenant',
      'subscription_loyalty_rewards::subscription_loyalty_rewards_pkey',
      'subscription_loyalty_rewards::subscription_loyalty_rewards_tenant_id_months_required_rewa_key',
      'subscription_payments::idx_sub_payments_provider_payment_id',
      'subscription_payments::idx_sub_payments_status',
      'subscription_payments::idx_sub_payments_subscription',
      'subscription_payments::idx_sub_payments_tenant',
      'subscription_payments::subscription_payments_pkey',
      'subscription_plan_benefit_services::idx_spbs_benefit',
      'subscription_plan_benefit_services::idx_spbs_plan',
      'subscription_plan_benefit_services::idx_spbs_service',
      'subscription_plan_benefit_services::idx_spbs_tenant',
      'subscription_plan_benefit_services::subscription_plan_benefit_services_benefit_id_service_id_key',
      'subscription_plan_benefit_services::subscription_plan_benefit_services_pkey',
      'subscription_plan_benefits::idx_spb_plan',
      'subscription_plan_benefits::idx_spb_tenant',
      'subscription_plan_benefits::subscription_plan_benefits_pkey',
      'subscription_plan_benefits::subscription_plan_benefits_plan_id_benefit_key_key',
      'subscription_plan_changes::idx_spc_subscription',
      'subscription_plan_changes::idx_spc_tenant',
      'subscription_plan_changes::subscription_plan_changes_pkey',
      'subscription_plan_services::idx_sps_plan',
      'subscription_plan_services::idx_sps_tenant',
      'subscription_plan_services::subscription_plan_services_pkey',
      'subscription_plan_services::subscription_plan_services_plan_id_service_id_key',
      'subscription_plans::idx_subscription_plans_tenant',
      'subscription_plans::subscription_plans_pkey',
      'subscription_referrals::idx_sub_referrals_code',
      'subscription_referrals::idx_sub_referrals_referrer',
      'subscription_referrals::idx_sub_referrals_status',
      'subscription_referrals::idx_sub_referrals_tenant',
      'subscription_referrals::subscription_referrals_pkey',
      'subscription_referrals::subscription_referrals_subscription_id_key',
      'subscription_status_logs::idx_subscription_status_logs_sub',
      'subscription_status_logs::idx_subscription_status_logs_tenant',
      'subscription_status_logs::subscription_status_logs_pkey',
      'subscription_usage_logs::idx_sub_usage_appointment',
      'subscription_usage_logs::idx_sub_usage_status',
      'subscription_usage_logs::idx_sub_usage_sub',
      'subscription_usage_logs::idx_sub_usage_tenant',
      'subscription_usage_logs::subscription_usage_logs_pkey',
      'subscription_usage_logs::uq_subscription_usage_logs_appointment',
      'subscriptions::idx_subscriptions_stripe_id',
      'subscriptions::idx_subscriptions_user_id',
      'subscriptions::subscriptions_pkey',
      'subscriptions::subscriptions_stripe_subscription_id_key',
      'support_messages::support_messages_pkey',
      'support_tickets::support_tickets_pkey',
      'system_health_settings::system_health_settings_pkey',
      'system_settings::system_settings_pkey',
      'team_audit_logs::team_audit_logs_pkey',
      'tenant_addons::idx_tenant_addons_payment_failed',
      'tenant_addons::idx_tenant_addons_status',
      'tenant_addons::idx_tenant_addons_tenant',
      'tenant_addons::tenant_addons_pkey',
      'tenant_addons::tenant_addons_unique_single',
      'tenant_integrations::tenant_integrations_pkey',
      'tenant_integrations::tenant_integrations_tenant_id_provider_key',
      'tenant_memberships::tenant_memberships_pkey',
      'tenant_memberships::tenant_memberships_tenant_id_user_id_key',
      'tenant_webhooks::idx_tenant_webhooks_tenant',
      'tenant_webhooks::tenant_webhooks_pkey',
      'ticket_messages::ticket_messages_pkey',
      'transactions::idx_transactions_tenant_id',
      'transactions::idx_unique_income_per_appointment',
      'transactions::transactions_pkey',
      'tutorial_categories::tutorial_categories_name_key',
      'tutorial_categories::tutorial_categories_pkey',
      'tutorials::tutorials_pkey',
      'tutorials::tutorials_slug_key',
      'user_invitations::user_invitations_pkey',
      'user_mfa_backup_codes::user_mfa_backup_codes_pkey',
      'user_onboarding_preferences::user_onboarding_preferences_pkey',
      'user_onboarding_progress::user_onboarding_progress_pkey',
      'user_onboarding_progress::user_onboarding_progress_user_id_tenant_id_step_key_key',
      'user_roles::user_roles_pkey',
      'user_roles::user_roles_user_id_key',
      'user_tour_states::user_tour_states_pkey',
      'user_tour_states::user_tour_states_user_id_tenant_id_tour_key_key',
      'verification_challenges::verification_challenges_barber_id_idx',
      'verification_challenges::verification_challenges_one_active_staff_idx',
      'verification_challenges::verification_challenges_pkey',
      'waiting_list::idx_waiting_list_tenant_status',
      'waiting_list::waiting_list_pkey',
      'wallet::wallet_customer_id_key',
      'wallet::wallet_pkey',
      'wallet_transactions::wallet_transactions_pkey',
      'webhook_logs::idx_webhook_logs_barbershop_id',
      'webhook_logs::idx_webhook_logs_created_at',
      'webhook_logs::webhook_logs_pkey',
      'whatsapp_cloud_connections::idx_whatsapp_connections_user_id',
      'whatsapp_cloud_connections::whatsapp_connections_pkey',
      'whatsapp_conversations::idx_whatsapp_conversations_barber_id',
      'whatsapp_conversations::idx_whatsapp_conversations_group_id',
      'whatsapp_conversations::idx_whatsapp_conversations_phone_active',
      'whatsapp_conversations::idx_whatsapp_conversations_phone_fallback',
      'whatsapp_conversations::whatsapp_conversations_pkey',
      'whatsapp_delivery_logs::whatsapp_delivery_logs_pkey',
      'whatsapp_instances::idx_whatsapp_connections_barbershop_id',
      'whatsapp_instances::unique_barbershop_whatsapp',
      'whatsapp_instances::whatsapp_connections_pkey1',
      'whatsapp_instances::whatsapp_instances_webhook_token_idx',
      'whatsapp_messages::idx_whatsapp_messages_status_scheduled',
      'whatsapp_messages::idx_whatsapp_messages_user_id',
      'whatsapp_messages::idx_whatsapp_messages_wa_id',
      'whatsapp_messages::whatsapp_messages_pkey',
      'whatsapp_templates::idx_whatsapp_templates_user_id',
      'whatsapp_templates::whatsapp_templates_pkey',
      'whatsapp_templates::whatsapp_templates_user_id_event_type_key',
      'zapi_integration_logs::zapi_integration_logs_pkey',
      'zapi_webhook_debug::zapi_webhook_debug_pkey',
      'zapi_webhook_logs::zapi_webhook_logs_pkey'
  ];
  v_expected_functions text[] := ARRAY[
      'public._compute_consume_quantity',
      'public._norm_pt',
      'public.add_product_to_comanda',
      'public.admin_anomaly_alerts',
      'public.admin_executive_kpis',
      'public.admin_tenant_health',
      'public.assert_comanda_access',
      'public.calculate_commission_for_appointment',
      'public.calculate_next_retry',
      'public.cancel_appointment',
      'public.cancel_appointment_by_token',
      'public.change_subscription_plan',
      'public.check_appointment_conflict',
      'public.check_appointment_financial_status',
      'public.check_expired_trials',
      'public.check_rate_limit',
      'public.check_subscription_eligibility',
      'public.check_time_off_conflicts',
      'public.claim_customer_profile',
      'public.claim_staff_verification_challenge',
      'public.cleanup_invalid_cashback',
      'public.clear_barbershop_financial_data',
      'public.clear_barbershop_test_data',
      'public.complete_appointment',
      'public.confirm_referral_on_activation',
      'public.consume_subscription_benefit',
      'public.consume_subscription_benefits_v2',
      'public.consume_subscription_use',
      'public.convert_appointment_to_credit',
      'public.create_admin_notification',
      'public.create_barber_commission_for_appointment',
      'public.create_notification',
      'public.create_or_get_public_customer',
      'public.create_walkin_appointment',
      'public.customer_cancel_request_refund',
      'public.customer_cancel_return_credit',
      'public.customer_cancel_simple',
      'public.decrement_product_stock',
      'public.emit_admin_event_panel',
      'public.emit_first_appointment_event',
      'public.enforce_appointment_no_overlap',
      'public.enqueue_subscription_renewal_reminders',
      'public.ensure_appointment_tenant_id',
      'public.ensure_single_primary_gateway',
      'public.expire_loyalty_rewards',
      'public.fn_get_financial_summary',
      'public.fn_on_appointment_created_enqueue_automation',
      'public.fn_recalculate_customer_loyalty',
      'public.generate_admin_digest',
      'public.generate_product_slug',
      'public.generate_subscription_referral_code',
      'public.generate_unique_slug',
      'public.get_active_subscription',
      'public.get_allowed_modules',
      'public.get_appointment_by_management_token',
      'public.get_appointment_for_rating',
      'public.get_appointment_group_by_token',
      'public.get_availability_slots',
      'public.get_barber_appointments',
      'public.get_barber_commission_summary',
      'public.get_barber_commissions',
      'public.get_barber_dashboard_summary',
      'public.get_barber_pending_commissions',
      'public.get_barbershop_by_checkin_token',
      'public.get_coupon_by_code',
      'public.get_cron_status',
      'public.get_current_identity_context',
      'public.get_customer_review',
      'public.get_customers_with_birthday_today',
      'public.get_my_profile_role',
      'public.get_my_tenant_id',
      'public.get_new_appointment_management_token',
      'public.get_or_create_automation',
      'public.get_plan_slug_by_stripe_price',
      'public.get_public_active_customer_subscription',
      'public.get_reschedule_options',
      'public.get_review_by_token',
      'public.get_server_info',
      'public.get_subscriber_months',
      'public.get_subscription_benefit_balance',
      'public.get_workflow_key_for_event',
      'public.grant_subscription_referral_reward',
      'public.grant_subscription_rewards',
      'public.guard_internal_test_tenant_flag',
      'public.handle_appointment_automation',
      'public.handle_appointment_completion',
      'public.handle_appointment_completion_review_decision',
      'public.handle_new_ticket_notification',
      'public.handle_new_user',
      'public.handle_product_sale_status_change',
      'public.handle_updated_at',
      'public.handle_wallet_transaction',
      'public.has_active_addon',
      'public.has_active_internal_voucher',
      'public.has_active_subscription',
      'public.has_module',
      'public.has_module_access',
      'public.has_permission',
      'public.has_role',
      'public.increment_coupon_usage',
      'public.is_active_subscriber',
      'public.is_internal_test_tenant',
      'public.is_profile_admin',
      'public.is_reception',
      'public.is_super_admin',
      'public.is_super_admin_user',
      'public.list_admin_event_catalog',
      'public.log_availability_conflict',
      'public.log_payment_status_change',
      'public.log_refund_status_change',
      'public.notify_new_appointment',
      'public.pause_customer_subscription',
      'public.pay_barber_commissions',
      'public.pay_commission_entries',
      'public.perform_qr_checkin',
      'public.preview_subscription_plan_change',
      'public.process_product_sale',
      'public.process_subscription_loyalty_rewards',
      'public.protect_role_column',
      'public.recalculate_barber_commissions',
      'public.recalculate_customer_cashback_balance',
      'public.recalculate_customer_credit_balance',
      'public.reception_can',
      'public.reception_tenant_id',
      'public.reception_touch_updated_at',
      'public.reconcile_automation_logs',
      'public.reconcile_expired_addons',
      'public.redeem_loyalty_reward',
      'public.redeem_subscription_reward',
      'public.regenerate_subscription_card_token',
      'public.register_pix_tip',
      'public.register_push_subscription',
      'public.register_subscription_referral',
      'public.remove_comanda_item',
      'public.render_admin_template',
      'public.request_appointment_refund',
      'public.request_subscription_plan_change',
      'public.reschedule_appointment',
      'public.reserve_usage_log_on_appointment_insert',
      'public.resolve_tenant_billing_context',
      'public.resume_customer_subscription',
      'public.seed_default_workflows_v2',
      'public.seed_subscription_automation_templates',
      'public.seed_subscription_reward_unlocked_template',
      'public.set_appointment_review_decision',
      'public.set_subscription_card_token',
      'public.set_subscription_referral_code',
      'public.set_updated_at',
      'public.settle_appointment_payment',
      'public.submit_review_by_token',
      'public.subscription_active_months',
      'public.sync_appointment_review_decision',
      'public.sync_barbershop_modules',
      'public.sync_barbershop_to_profile',
      'public.sync_customer_credits',
      'public.sync_modules_for_plan',
      'public.sync_notification_read_status',
      'public.sync_usage_logs_on_appointment_status',
      'public.tenant_has_active_addon',
      'public.test_rls_module_guards',
      'public.tg_admin_notify_lgpd',
      'public.tg_admin_notify_new_tenant',
      'public.tg_admin_notify_plan_change',
      'public.tg_admin_notify_saas_checkout',
      'public.tg_admin_notify_support_reply',
      'public.tg_admin_notify_support_ticket',
      'public.tg_barbershop_modules_updated_at',
      'public.tg_block_disabled_cashback',
      'public.tg_log_barbershop_module_change',
      'public.tg_loyalty_premium_updated_at',
      'public.tg_loyalty_touch_updated_at',
      'public.tg_sync_modules_on_profile_plan_change',
      'public.touch_updated_at',
      'public.tr_handle_appointment_confirmation',
      'public.tr_refund_subscription_on_cancel',
      'public.trg_commission_on_appointment',
      'public.trg_notify_admin_revenue_milestone',
      'public.trg_notify_admin_support_ticket',
      'public.trg_notify_admin_tenant_signup',
      'public.trigger_appointment_automation',
      'public.trigger_recalculate_cashback',
      'public.trigger_recalculate_credits',
      'public.trigger_subscription_automation',
      'public.unregister_push_subscription',
      'public.update_barber_commissions_updated_at',
      'public.update_barber_rating',
      'public.update_barber_working_hours',
      'public.update_bg_jobs_updated_at',
      'public.update_payment_gateway_updated_at',
      'public.update_tenant_webhooks_updated_at',
      'public.update_updated_at_column',
      'public.update_whatsapp_delivery_logs_updated_at',
      'public.update_workflow_stats',
      'public.use_customer_credits',
      'public.validate_appointment_review_before_insert',
      'public.validate_subscription_card',
      'public.validate_subscription_coupon',
      'public.validate_subscription_referral_code',
      'public.validate_usage_log_status',
      'public.verify_staff_verification_challenge'
  ];
  v_expected_triggers text[] := ARRAY[
      'academy_lessons::update_academy_lessons_updated_at',
      'academy_paths::update_academy_paths_updated_at',
      'academy_progress::update_academy_progress_updated_at',
      'addon_upgrade_recommendations::trg_addon_upgrade_rec_updated_at',
      'admin_event_subscriptions::trg_admin_event_subs_updated',
      'appointment_reviews::trg_sync_appointment_review_decision',
      'appointment_reviews::trg_validate_appointment_review_before_insert',
      'appointment_reviews::update_appointment_reviews_updated_at',
      'appointments::on_payment_status_change',
      'appointments::tr_ensure_appointment_tenant_id',
      'appointments::tr_handle_appointment_completion',
      'appointments::tr_notify_new_appointment',
      'appointments::tr_reserve_usage_log_on_insert',
      'appointments::tr_sync_usage_logs_on_status',
      'appointments::trg_appointment_completion_review_decision',
      'appointments::trg_appointments_no_overlap',
      'appointments::trg_commission_on_appointment',
      'appointments::trg_first_appointment',
      'appointments::update_appointments_updated_at',
      'automation_conversations::update_automation_conversations_updated_at',
      'automation_interactions::update_automation_interactions_updated_at',
      'automation_reconciliation_settings::update_reconciliation_settings_updated_at',
      'automation_templates::update_automation_templates_updated_at',
      'automation_v2_dispatches::update_automation_v2_dispatches_updated_at',
      'automation_v2_sessions::update_automation_v2_sessions_updated_at',
      'background_jobs::trg_update_bg_jobs_updated_at',
      'barber_commissions::trg_update_barber_commissions_updated_at',
      'barbers::update_barbers_updated_at',
      'barbershop_modules::barbershop_modules_log_change',
      'barbershop_modules::barbershop_modules_updated_at',
      'barbershop_settings::update_barbershop_settings_updated_at',
      'barbershops::trg_sync_barbershop_to_profile',
      'barbershops::trg_sync_modules_for_plan',
      'cashback_transactions::tr_recalculate_cashback',
      'cashback_transactions::trg_block_disabled_cashback',
      'client_auth::update_client_auth_updated_at',
      'commission_closings::trg_commission_closings_updated_at',
      'commission_entries::trg_commission_entries_updated_at',
      'credit_transactions::tr_recalculate_credits',
      'customer_credits::tr_sync_customer_credits',
      'customer_interactions::update_customer_interactions_updated_at',
      'customer_subscriptions::trg_confirm_referral_on_activation',
      'customer_subscriptions::trg_cust_subs_updated_at',
      'customer_subscriptions::trg_customer_subscription_automation',
      'customer_subscriptions::trg_set_subscription_card_token',
      'customer_subscriptions::trg_set_subscription_referral_code',
      'customer_tasks::update_customer_tasks_updated_at',
      'customers::update_customers_updated_at',
      'lgpd_requests::trg_lgpd_requests_updated',
      'loyalty_campaign_participations::trg_loy_part_upd',
      'loyalty_campaign_templates::trg_loy_camp_tpl_upd',
      'loyalty_campaigns::trg_loy_camp_upd',
      'loyalty_rewards::trg_loyalty_rewards_updated_at',
      'loyalty_settings::trg_loyalty_settings_updated_at',
      'notification_recipients::update_notification_recipients_updated_at',
      'notifications::tr_sync_notification_read',
      'payment_gateways::trg_payment_gateways_updated_at',
      'payment_gateways::trg_single_primary_gateway',
      'payment_receipts::update_payment_receipts_updated_at',
      'plans::update_plans_updated_at',
      'privacy_consents::trg_admin_notify_lgpd',
      'product_sales::tr_product_sale_status_change',
      'product_sales::update_product_sales_updated_at',
      'products::trg_generate_product_slug',
      'products::update_products_updated_at',
      'profiles::tr_protect_role_column',
      'profiles::trg_admin_notify_new_tenant',
      'profiles::trg_admin_notify_plan_change',
      'profiles::trg_admin_notify_tenant_signup',
      'profiles::trg_guard_internal_test_tenant_flag',
      'profiles::trg_sync_modules_on_profile_plan',
      'profiles::update_profiles_updated_at',
      'reception_permissions::trg_reception_permissions_updated',
      'refund_requests::tr_log_refund_status_change',
      'saas_addons::trg_saas_addons_updated',
      'saas_admin_voucher_redemptions::trg_admin_redemption_updated_at',
      'saas_admin_vouchers::trg_admin_voucher_updated_at',
      'saas_billing_settings::trg_saas_billing_settings_updated_at',
      'saas_checkout_sessions::trg_admin_notify_saas_checkout',
      'service_ratings::on_rating_submitted',
      'status_incidents::trg_status_incidents_updated',
      'status_maintenances::trg_status_maintenances_updated',
      'status_services::trg_status_services_updated',
      'subprocessors::trg_subprocessors_updated',
      'subscription_invoices::trg_sub_inv_updated_at',
      'subscription_loyalty_history::trg_sub_loyalty_history_updated_at',
      'subscription_loyalty_rewards::trg_sub_loyalty_rewards_updated_at',
      'subscription_payments::trg_sub_payments_updated_at',
      'subscription_plan_benefit_services::trg_spbs_updated_at',
      'subscription_plan_benefits::trg_spb_updated_at',
      'subscription_plans::trg_subscription_plans_updated_at',
      'subscription_referrals::trg_subscription_referrals_updated_at',
      'subscription_usage_logs::trg_validate_usage_log_status',
      'support_messages::trg_admin_notify_support_reply',
      'support_tickets::on_ticket_created',
      'support_tickets::trg_admin_notify_support_ticket',
      'support_tickets::trg_notify_admin_support_ticket',
      'system_settings::update_system_settings_updated_at',
      'tenant_addons::trg_tenant_addons_updated',
      'tenant_integrations::update_tenant_integrations_updated_at',
      'tenant_webhooks::trg_tenant_webhooks_updated_at',
      'transactions::trg_notify_admin_revenue_milestone',
      'waiting_list::trg_waiting_list_updated',
      'wallet::update_wallet_updated_at',
      'wallet_transactions::on_wallet_transaction',
      'whatsapp_cloud_connections::update_whatsapp_connections_updated_at',
      'whatsapp_conversations::update_whatsapp_conversations_updated_at',
      'whatsapp_delivery_logs::update_whatsapp_delivery_logs_updated_at_trigger',
      'whatsapp_instances::update_whatsapp_connections_updated_at',
      'whatsapp_templates::update_whatsapp_templates_updated_at'
  ];
  v_expected_policies text[] := ARRAY[
      'academy_lessons::Lessons viewable by authenticated if path is viewable',
      'academy_modules::Modules viewable by authenticated if path is viewable',
      'academy_paths::Public paths are viewable by all authenticated',
      'academy_progress::Users can manage their own progress',
      'addon_upgrade_recommendations::super admin manages recommendations',
      'addon_upgrade_recommendations::tenant inserts own recommendations',
      'addon_upgrade_recommendations::tenant reads own recommendations',
      'addon_upgrade_recommendations::tenant updates own recommendations',
      'admin_event_log::Super admin can read event log',
      'admin_event_subscriptions::Super admin manages own event subscriptions',
      'admin_event_templates::service role full access templates',
      'admin_event_templates::super admins manage event templates',
      'admin_notifications::Authenticated users can create admin notifications',
      'admin_notifications::Notificações visíveis apenas para super admin',
      'admin_notifications::Super admin pode atualizar notificações (marcar como lido)',
      'admin_notifications::Super admin pode excluir notificações',
      'ai_settings::Tenants can manage their own ai settings',
      'appointment_checkins::tenant_insert_checkins',
      'appointment_checkins::tenant_read_checkins',
      'appointment_groups::Public can create appointment groups',
      'appointment_groups::Tenant can manage their appointment groups',
      'appointment_groups::Tenant can view own appointment groups',
      'appointment_reviews::Public can read approved testimonials',
      'appointment_reviews::Public can submit reviews for real appointments',
      'appointment_reviews::Tenant owner can delete reviews',
      'appointment_reviews::Tenant owner can read all reviews',
      'appointment_reviews::Tenant owner can update reviews',
      'appointment_status_logs::Authenticated users can insert logs',
      'appointment_status_logs::Users can view logs of their own appointments',
      'appointment_status_logs::Users can view their tenant''s status logs',
      'appointments::Barbers can view their own appointments',
      'appointments::Customers can view own appointments',
      'appointments::Public access for availability',
      'appointments::Public can create appointments',
      'appointments::Staff can update appointments',
      'appointments::Super admins can manage all appointments',
      'appointments::Tenant can view own appointments',
      'appointments::Users can manage their own appointments',
      'appointments::Users can view their own appointments',
      'audit_logs::Audit logs insertable by super_admin',
      'audit_logs::Audit logs viewable by super_admin',
      'automation_conversations::Tenants can view their own conversations',
      'automation_cron_runs::Super admins can view all cron runs',
      'automation_cron_runs::Tenants can view their own cron runs',
      'automation_cron_runs::Users can view their own cron logs',
      'automation_dispatches::Tenants can view their own dispatches',
      'automation_interaction_events::Admins manage all interaction events',
      'automation_interaction_events::Tenants insert their own interaction events',
      'automation_interaction_events::Tenants view their own interaction events',
      'automation_interactions::Admins can manage all automation interactions',
      'automation_interactions::Tenants manage their own automation interactions',
      'automation_logs::Service role manages automation logs',
      'automation_logs::Tenants can view their own automation logs',
      'automation_queue::Users can manage their own automation_queue',
      'automation_reconciliation_settings::Users can manage their own settings',
      'automation_send_history::Tenants can insert their own send history',
      'automation_send_history::Tenants can view their own send history',
      'automation_status::Allow all for service_role',
      'automation_status::Allow read for authenticated',
      'automation_status::Service role manages automation status',
      'automation_templates::Users can manage their own automation_templates',
      'automation_v2_dispatches::Tenants can manage their own v2 dispatches',
      'automation_v2_logs::Tenants can view their own v2 logs',
      'automation_v2_sessions::Tenants can manage their own v2 sessions',
      'automation_webhook_logs::Service role manages automation webhook logs',
      'automation_webhook_logs::Tenants can view their automation webhook logs',
      'automations::Barbers can manage their own automations',
      'automations::Tenants can manage their own automations',
      'automations::Users can view their own tenant data',
      'availability_conflict_logs::Tenant reads own availability conflict logs',
      'barber_commissions::Public can read commissions through scoped RPC only',
      'barber_commissions::Tenant admins can manage barber commissions',
      'barber_commissions::require_module_commissions_delete',
      'barber_commissions::require_module_commissions_insert',
      'barber_commissions::require_module_commissions_update',
      'barber_services::Vínculos de serviços são públicos',
      'barber_services::authenticated_manage_barber_services',
      'barber_services::public_view_barber_services',
      'barber_tips::Barber sees own tips',
      'barber_tips::Shop owner sees own tips',
      'barber_tips::Shop owner updates tips',
      'barbers::Barbers can manage their own profile',
      'barbers::Public select for active barbers',
      'barbers::Super admins can manage all barbers',
      'barbershop_module_logs::Tenants read their own module logs',
      'barbershop_module_logs::Users write module logs for own tenant',
      'barbershop_modules::Public can read tenant modules',
      'barbershop_modules::Tenant staff can read their tenant modules',
      'barbershop_modules::Tenants manage their own modules',
      'barbershop_settings::Users can manage their own barbershop settings',
      'barbershops::Owners can update their own barbershop',
      'barbershops::Public read access for barbershops',
      'campaign_logs::Tenants can view their own campaign logs',
      'campaigns::Tenants can manage their own campaigns',
      'cashback_transactions::Customers can view own cashback transactions',
      'cashback_transactions::Service role can do everything on cashback_transactions',
      'cashback_transactions::Users can insert cashback transactions for their tenant',
      'cashback_transactions::Users can view their tenant''s cashback transactions',
      'cashback_transactions::require_module_cashback_delete',
      'cashback_transactions::require_module_cashback_insert',
      'cashback_transactions::require_module_cashback_update',
      'client_auth::Service role manages client auth updates',
      'client_auth::Service role reads client auth',
      'commission_closings::require_module_commissions_delete',
      'commission_closings::require_module_commissions_insert',
      'commission_closings::require_module_commissions_update',
      'commission_closings::tenant manages commission closings',
      'commission_entries::require_module_commissions_delete',
      'commission_entries::require_module_commissions_insert',
      'commission_entries::require_module_commissions_update',
      'commission_entries::tenant manages commission entries',
      'communication_channels::Users can access their own tenant communication_channels',
      'communication_messages::Users can access their own tenant communication_messages',
      'communication_templates::Users can access their own tenant communication_templates',
      'cookie_consents::Anyone can insert cookie consent',
      'cookie_consents::Users view own cookie consents',
      'coupons::Tenant can view own coupons',
      'coupons::Tenants can manage their own coupons',
      'credit_transactions::Customers can view own credit transactions',
      'credit_transactions::Users can view their tenant''s credit transactions',
      'customer_achievements::Customers can view own achievements',
      'customer_credits::Allow INSERT for tenant',
      'customer_credits::Allow SELECT for tenant and owner',
      'customer_credits::Allow UPDATE for tenant',
      'customer_documents::Manage own tenant customer documents',
      'customer_interactions::Manage own tenant customer interactions',
      'customer_subscriptions::Customers can view own subscriptions',
      'customer_subscriptions::require_module_subscriptions_delete',
      'customer_subscriptions::require_module_subscriptions_insert',
      'customer_subscriptions::require_module_subscriptions_update',
      'customer_subscriptions::tenant manages own subs',
      'customer_tasks::Manage own tenant customer tasks',
      'customers::Allow public insert on customers',
      'customers::Allow public select for identification',
      'customers::Customers can view own profile',
      'customers::Super admins can manage all customers',
      'customers::Tenant members can view customers',
      'customers::Users can manage their own customers',
      'customers::Users can view their own customers',
      'email_logs::Admins can view all email logs',
      'email_logs::Tenants can view their own email logs',
      'email_settings::Tenants can manage their own email settings',
      'financial_adjustment_logs::Users can insert their own tenant logs',
      'financial_adjustment_logs::Users can view their own tenant logs',
      'lgpd_requests::Anyone can submit lgpd request',
      'lgpd_requests::Customers view own requests',
      'lgpd_requests::Tenant and admin update requests',
      'loyalty_achievements::Anyone can read achievements',
      'loyalty_campaign_participations::Tenant owners view participations',
      'loyalty_campaign_participations::require_module_loyalty_delete',
      'loyalty_campaign_participations::require_module_loyalty_insert',
      'loyalty_campaign_participations::require_module_loyalty_update',
      'loyalty_campaign_templates::Templates readable by all',
      'loyalty_campaign_templates::require_module_loyalty_delete',
      'loyalty_campaign_templates::require_module_loyalty_insert',
      'loyalty_campaign_templates::require_module_loyalty_update',
      'loyalty_campaigns::Tenant owners manage campaigns',
      'loyalty_campaigns::require_module_loyalty_delete',
      'loyalty_campaigns::require_module_loyalty_insert',
      'loyalty_campaigns::require_module_loyalty_update',
      'loyalty_levels::Anyone can read levels',
      'loyalty_rewards::public can read loyalty rewards',
      'loyalty_rewards::require_module_loyalty_delete',
      'loyalty_rewards::require_module_loyalty_insert',
      'loyalty_rewards::require_module_loyalty_update',
      'loyalty_rewards::tenant manages own loyalty rewards',
      'loyalty_settings::public can read loyalty settings',
      'loyalty_settings::require_module_loyalty_delete',
      'loyalty_settings::require_module_loyalty_insert',
      'loyalty_settings::require_module_loyalty_update',
      'loyalty_settings::tenant manages own loyalty settings',
      'marketing_audiences::Tenants can manage their own audiences',
      'notification_recipients::Tenant can manage own recipients',
      'notifications::Barbeiros podem ver suas próprias notificações',
      'notifications::Barber panel can read its notifications',
      'notifications::Barber panel can update its notifications',
      'notifications::Super admins can manage all notifications',
      'notifications::Users can manage their own notifications',
      'notifications::Users can view their own tenant data',
      'onboarding_settings::Everyone can view onboarding settings',
      'onboarding_settings::Only super admins can manage onboarding settings',
      'operational_insights_interactions::Tenant access',
      'payment_gateway_logs::tenant inserts own payment_gateway_logs',
      'payment_gateway_logs::tenant views own payment_gateway_logs',
      'payment_gateways::tenant manages own payment_gateways',
      'payment_receipts::Public customers can submit receipts',
      'payment_receipts::Tenant can delete own receipts',
      'payment_receipts::Tenant can insert own receipts',
      'payment_receipts::Tenant can update own receipts',
      'payment_receipts::Tenant can view own receipts',
      'permissions::Allow read for authenticated permissions',
      'plans::Plans are viewable by everyone',
      'plans::Plans manageable by super_admin',
      'privacy_consents::Anyone can insert consent',
      'privacy_consents::Users view own/tenant consents',
      'product_images::Qualquer pessoa pode ver imagens de produtos',
      'product_images::Vendedores podem gerenciar imagens de seus produtos',
      'product_images::require_module_products_delete',
      'product_images::require_module_products_insert',
      'product_images::require_module_products_update',
      'product_sales::Authenticated tenant can create product sales',
      'product_sales::Super admins can manage all product sales',
      'product_sales::Users can insert their own product sales',
      'product_sales::Users can manage their own product sales',
      'product_sales::Users can update their own product sales',
      'product_sales::Users can view their own product sales',
      'product_sales::require_module_store_delete',
      'product_sales::require_module_store_insert',
      'product_sales::require_module_store_update',
      'products::Public can view products',
      'products::Public select for products',
      'products::Super admins can manage all products',
      'products::Users can create their own products',
      'products::Users can delete their own products',
      'products::Users can update their own products',
      'products::Users can view their own products',
      'products::require_module_products_delete',
      'products::require_module_products_insert',
      'products::require_module_products_update',
      'professional_time_off::Admins can manage time off for their tenant',
      'professional_time_off::Users can view time off for their tenant',
      'profiles::Profiles are viewable by everyone',
      'profiles::Profiles are viewable by owner, tenant, or super admin',
      'profiles::Super admins can delete profiles',
      'profiles::Users can insert own profile',
      'profiles::Users can update own profile or super admin can update any',
      'push_subscriptions::user_own_subs_delete',
      'push_subscriptions::user_own_subs_select',
      'rate_limit_hits::service_only_rl',
      'reception_permissions::Owner manages reception permissions',
      'reception_permissions::Reception reads own permissions',
      'refund_audits::Admins can view their own tenant''s refund audits',
      'refund_requests::Tenants can manage their own refund requests',
      'resend_settings::Only Super Admins can read Resend settings',
      'resend_settings::Super Admins can manage Resend settings',
      'review_automation_logs::Tenant owner reads review logs',
      'role_permissions::Allow read for authenticated role_permissions',
      'saas_addons::Catálogo de add-ons ativos é público',
      'saas_addons::Super admin gerencia add-ons',
      'saas_admin_voucher_audit_logs::super_admin_insert_audit',
      'saas_admin_voucher_audit_logs::super_admin_read_audit',
      'saas_admin_voucher_redemptions::super_admin_full_access_redemptions',
      'saas_admin_voucher_redemptions::tenant_can_view_own_redemption',
      'saas_admin_vouchers::super_admin_full_access_vouchers',
      'saas_admin_vouchers::tenant_can_view_own_voucher',
      'saas_billing_settings::authenticated reads billing settings',
      'saas_billing_settings::super admin manages billing settings',
      'saas_checkout_sessions::Service role manages checkout sessions',
      'saas_checkout_sessions::Users insert own checkout sessions',
      'saas_checkout_sessions::Users see own checkout sessions',
      'security_activity_logs::Users can view their own security logs',
      'service_ratings::Public can rate real appointments',
      'service_ratings::Ratings are viewable by everyone',
      'services::Public select for services',
      'services::Serviços são públicos',
      'services::Super admins can manage all services',
      'services::Users can manage their own services',
      'services::Users can view their own services',
      'services::Users can view their own tenant data',
      'status_checks::status_checks public read',
      'status_incidents::status_incidents admin write',
      'status_incidents::status_incidents public read',
      'status_maintenances::status_maintenances admin write',
      'status_maintenances::status_maintenances public read',
      'status_services::status_services admin write',
      'status_services::status_services public read',
      'subprocessors::Public can view active subprocessors',
      'subprocessors::Super admin manages subprocessors',
      'subscription_card_scans::require_module_subscriptions_delete',
      'subscription_card_scans::require_module_subscriptions_insert',
      'subscription_card_scans::require_module_subscriptions_update',
      'subscription_card_scans::tenant inserts card scans',
      'subscription_card_scans::tenant reads own card scans',
      'subscription_invoices::require_module_subscriptions_delete',
      'subscription_invoices::require_module_subscriptions_insert',
      'subscription_invoices::require_module_subscriptions_update',
      'subscription_invoices::tenant manages own invoices',
      'subscription_loyalty_history::require_module_subscriptions_delete',
      'subscription_loyalty_history::require_module_subscriptions_insert',
      'subscription_loyalty_history::require_module_subscriptions_update',
      'subscription_loyalty_history::tenant manages own history',
      'subscription_loyalty_rewards::require_module_subscriptions_delete',
      'subscription_loyalty_rewards::require_module_subscriptions_insert',
      'subscription_loyalty_rewards::require_module_subscriptions_update',
      'subscription_loyalty_rewards::tenant manages own rewards',
      'subscription_payments::require_module_subscriptions_delete',
      'subscription_payments::require_module_subscriptions_insert',
      'subscription_payments::require_module_subscriptions_update',
      'subscription_payments::tenant manages own subscription_payments',
      'subscription_payments::tenant reads own subscription_payments',
      'subscription_plan_benefit_services::auth can view plan benefit services',
      'subscription_plan_benefit_services::public can view plan benefit services',
      'subscription_plan_benefit_services::require_module_subscriptions_delete',
      'subscription_plan_benefit_services::require_module_subscriptions_insert',
      'subscription_plan_benefit_services::require_module_subscriptions_update',
      'subscription_plan_benefit_services::tenant manages own plan benefit services',
      'subscription_plan_benefits::auth can view plan benefits',
      'subscription_plan_benefits::public can view plan benefits',
      'subscription_plan_benefits::require_module_subscriptions_delete',
      'subscription_plan_benefits::require_module_subscriptions_insert',
      'subscription_plan_benefits::require_module_subscriptions_update',
      'subscription_plan_benefits::tenant manages own plan benefits',
      'subscription_plan_changes::require_module_subscriptions_delete',
      'subscription_plan_changes::require_module_subscriptions_insert',
      'subscription_plan_changes::require_module_subscriptions_update',
      'subscription_plan_changes::tenant insert plan changes',
      'subscription_plan_changes::tenant read plan changes',
      'subscription_plan_services::public can view plan services',
      'subscription_plan_services::require_module_subscriptions_delete',
      'subscription_plan_services::require_module_subscriptions_insert',
      'subscription_plan_services::require_module_subscriptions_update',
      'subscription_plan_services::tenant manages own plan services',
      'subscription_plans::auth can view active plans',
      'subscription_plans::public can view active plans',
      'subscription_plans::require_module_subscriptions_delete',
      'subscription_plans::require_module_subscriptions_insert',
      'subscription_plans::require_module_subscriptions_update',
      'subscription_plans::tenant manages own plans',
      'subscription_referrals::Service role full access referrals',
      'subscription_referrals::Tenant manages own referrals',
      'subscription_referrals::require_module_subscriptions_delete',
      'subscription_referrals::require_module_subscriptions_insert',
      'subscription_referrals::require_module_subscriptions_update',
      'subscription_status_logs::require_module_subscriptions_delete',
      'subscription_status_logs::require_module_subscriptions_insert',
      'subscription_status_logs::require_module_subscriptions_update',
      'subscription_status_logs::tenant inserts status logs',
      'subscription_status_logs::tenant reads own status logs',
      'subscription_usage_logs::require_module_subscriptions_delete',
      'subscription_usage_logs::require_module_subscriptions_insert',
      'subscription_usage_logs::require_module_subscriptions_update',
      'subscription_usage_logs::tenant manages own usage logs',
      'subscriptions::Service role can manage subscriptions',
      'subscriptions::Super admins can manage all subscriptions',
      'subscriptions::Super admins can manage subscriptions',
      'subscriptions::Users can view own subscription',
      'support_messages::Messages access',
      'support_messages::Messages insert',
      'support_tickets::Tickets access',
      'support_tickets::Tickets insert',
      'support_tickets::Tickets update',
      'system_health_settings::Service role manages system health settings',
      'system_health_settings::Super admins manage system health settings',
      'system_settings::Super admins can manage system settings',
      'team_audit_logs::Users can view audit logs for their tenant',
      'tenant_addons::Barbearia vê seus próprios add-ons',
      'tenant_addons::Super admin gerencia contratos',
      'tenant_integrations::Tenants manage their own integrations',
      'tenant_memberships::Admins can manage their tenant memberships',
      'tenant_memberships::Users can view their own memberships',
      'tenant_webhooks::Tenants can manage their own webhooks',
      'ticket_messages::Inserção de mensagens permitida para donos do ticket ou super',
      'ticket_messages::Mensagens visíveis por donos do ticket ou super admin',
      'transactions::Barbers can view their own transactions',
      'transactions::Super admins can manage all transactions',
      'transactions::Users can manage their own transactions',
      'transactions::Users can view their own tenant data',
      'tutorial_categories::Everyone can view tutorial categories',
      'tutorial_categories::Only super admins can manage tutorial categories',
      'tutorials::Everyone can view tutorials',
      'tutorials::Only super admins can manage tutorials',
      'user_invitations::Users can create invitations for their tenant',
      'user_invitations::Users can update invitations for their tenant',
      'user_invitations::Users can view invitations for their tenant',
      'user_mfa_backup_codes::Users can manage their own backup codes',
      'user_onboarding_preferences::Users can manage their own preferences',
      'user_onboarding_preferences::Users can view their own preferences',
      'user_onboarding_progress::Users can manage their own onboarding progress',
      'user_roles::Super admins can manage roles',
      'user_roles::Users can view their own role',
      'user_tour_states::Users can manage their own tour states',
      'verification_challenges::Users can view their own challenges',
      'waiting_list::Reception reads waiting list',
      'waiting_list::Reception updates waiting list',
      'waiting_list::Reception writes waiting list',
      'waiting_list::Tenant manages waiting list',
      'wallet::Users can manage wallets of their customers',
      'wallet::Users can view wallets of their customers',
      'wallet_transactions::Users can manage transactions of their customers',
      'wallet_transactions::Users can view transactions of their customers',
      'webhook_logs::Barbearias podem ver seus próprios logs',
      'whatsapp_cloud_connections::Users can manage their own whatsapp connections',
      'whatsapp_conversations::Barbers can view their conversations',
      'whatsapp_conversations::Service role can manage all conversations',
      'whatsapp_delivery_logs::Users can manage their own delivery logs',
      'whatsapp_delivery_logs::Users can view their own delivery logs',
      'whatsapp_instances::Manage own whatsapp instances',
      'whatsapp_instances::View own whatsapp instances',
      'whatsapp_messages::Users can view their own whatsapp messages',
      'whatsapp_templates::Users can manage their own whatsapp templates',
      'zapi_integration_logs::Users can view their own integration logs',
      'zapi_webhook_debug::Tenants can view their own debug logs',
      'zapi_webhook_logs::Service role manages zapi webhook logs',
      'zapi_webhook_logs::Tenants can view their own webhook logs'
  ];
  v_expected_typmod_columns text[] := ARRAY[
      'addon_upgrade_recommendations::annual_savings::numeric(10,2)',
      'addon_upgrade_recommendations::current_option_total::numeric(10,2)',
      'addon_upgrade_recommendations::monthly_savings::numeric(10,2)',
      'addon_upgrade_recommendations::upgrade_option_total::numeric(10,2)',
      'appointment_groups::total_amount::numeric(10,2)',
      'appointments::amount_paid::numeric',
      'appointments::barbershop_amount::numeric(10,2)',
      'appointments::cash_amount::numeric(10,2)',
      'appointments::cashback_earned::numeric',
      'appointments::cashback_used::numeric',
      'appointments::credit_card_amount::numeric(10,2)',
      'appointments::credit_used::numeric(10,2)',
      'appointments::credits_used::numeric(10,2)',
      'appointments::debit_card_amount::numeric(10,2)',
      'appointments::discount_amount::numeric',
      'appointments::extra_amount::numeric(10,2)',
      'appointments::final_amount::numeric(10,2)',
      'appointments::original_total::numeric(10,2)',
      'appointments::pix_amount::numeric(10,2)',
      'appointments::products_amount::numeric(10,2)',
      'appointments::service_amount::numeric(10,2)',
      'appointments::subscription_covered_amount::numeric(10,2)',
      'appointments::subtotal_amount::numeric',
      'appointments::tip_amount::numeric(10,2)',
      'appointments::total_price::numeric(10,2)',
      'barber_commissions::commission_amount::numeric(10,2)',
      'barber_commissions::commission_fixed_amount::numeric(10,2)',
      'barber_commissions::commission_percentage::numeric(10,2)',
      'barber_commissions::service_amount::numeric(10,2)',
      'barber_tips::amount::numeric(10,2)',
      'barbers::average_rating::numeric(3,2)',
      'barbers::commission_bonus_value::numeric(10,2)',
      'barbers::commission_fixed_value::numeric(10,2)',
      'barbers::commission_rate::numeric',
      'barbers::monthly_goal::numeric(10,2)',
      'cashback_transactions::amount::numeric(10,2)',
      'cashback_transactions::base_amount::numeric(10,2)',
      'commission_closings::paid_amount::numeric(10,2)',
      'commission_closings::total_amount::numeric(10,2)',
      'commission_entries::commission_amount::numeric(10,2)',
      'commission_entries::commission_bonus::numeric(10,2)',
      'commission_entries::commission_fixed::numeric(10,2)',
      'commission_entries::commission_rate::numeric(5,2)',
      'commission_entries::paid_amount::numeric(10,2)',
      'commission_entries::service_amount::numeric(10,2)',
      'coupons::max_discount::numeric',
      'coupons::minimum_amount::numeric',
      'coupons::value::numeric',
      'credit_transactions::amount::numeric(10,2)',
      'customer_credits::amount::numeric(10,2)',
      'customer_credits::available_amount::numeric(10,2)',
      'customer_credits::used_amount::numeric(10,2)',
      'customer_subscriptions::amount::numeric(10,2)',
      'customer_subscriptions::coupon_discount::numeric(10,2)',
      'customers::cashback_balance::numeric',
      'customers::cashback_used::numeric(10,2)',
      'customers::credit_balance::numeric(10,2)',
      'customers::credits::numeric',
      'customers::credits_used::numeric(10,2)',
      'customers::lifetime_value::numeric(10,2)',
      'customers::total_spent::numeric(10,2)',
      'loyalty_campaign_participations::current_value::numeric',
      'loyalty_campaign_participations::target_value::numeric',
      'loyalty_rewards::barbershop_cost::numeric(10,2)',
      'loyalty_rewards::benefit_value::numeric(10,2)',
      'loyalty_rewards::max_benefit_value::numeric(10,2)',
      'loyalty_settings::benefit_value::numeric(10,2)',
      'loyalty_settings::max_benefit_value::numeric(10,2)',
      'payment_receipts::amount::numeric(12,2)',
      'plans::price_monthly::numeric(10,2)',
      'plans::price_yearly::numeric(10,2)',
      'product_sales::total_amount::numeric(10,2)',
      'products::price::numeric',
      'products::promotional_price::numeric',
      'profiles::cashback_fixed_value::numeric(10,2)',
      'profiles::cashback_minimum_amount::numeric(10,2)',
      'profiles::cashback_percentage::numeric',
      'profiles::loyalty_reward_value::numeric(10,2)',
      'refund_requests::amount::numeric(10,2)',
      'saas_addons::annual_price::numeric(10,2)',
      'saas_addons::monthly_price::numeric(10,2)',
      'saas_admin_voucher_redemptions::discount_amount::numeric(12,2)',
      'saas_admin_voucher_redemptions::final_monthly_amount::numeric(12,2)',
      'saas_admin_voucher_redemptions::original_monthly_amount::numeric(12,2)',
      'saas_admin_vouchers::discount_percentage::numeric(5,2)',
      'saas_billing_settings::minimum_upgrade_savings::numeric(10,2)',
      'services::price::numeric(10,2)',
      'subscription_invoices::amount::numeric(10,2)',
      'subscription_invoices::discount_amount::numeric(10,2)',
      'subscription_invoices::original_amount::numeric(10,2)',
      'subscription_loyalty_rewards::reward_value::numeric(10,2)',
      'subscription_payments::amount::numeric(10,2)',
      'subscription_plan_changes::net_amount::numeric(10,2)',
      'subscription_plan_changes::new_price::numeric(10,2)',
      'subscription_plan_changes::old_price::numeric(10,2)',
      'subscription_plan_changes::proration_charge::numeric(10,2)',
      'subscription_plan_changes::proration_credit::numeric(10,2)',
      'subscription_plans::barber_commission_value::numeric(10,2)',
      'subscription_plans::monthly_price::numeric(10,2)',
      'subscription_referrals::reward_value::numeric(10,2)',
      'subscription_usage_logs::covered_amount::numeric(10,2)',
      'subscription_usage_logs::extra_amount::numeric(10,2)',
      'tenant_addons::unit_price::numeric(10,2)',
      'transactions::amount::numeric(10,2)',
      'transactions::cash_amount::numeric',
      'transactions::cashback_amount::numeric',
      'transactions::credit_card_amount::numeric',
      'transactions::credits_amount::numeric',
      'transactions::debit_card_amount::numeric',
      'transactions::pix_amount::numeric',
      'wallet::balance::numeric',
      'wallet_transactions::amount::numeric'
  ];

  v_missing_tables text[];
  v_unexpected_tables text[];
  v_missing_views text[];
  v_missing_enums text[];
  v_missing_fks text[];
  v_unexpected_fks text[];
  v_missing_pks text[];
  v_unexpected_pks text[];
  v_missing_uniques text[];
  v_unexpected_uniques text[];
  v_missing_checks text[];
  v_unexpected_checks text[];
  v_missing_indexes text[];
  v_unexpected_indexes text[];
  v_missing_functions text[];
  v_missing_triggers text[];
  v_unexpected_triggers text[];
  v_missing_policies text[];
  v_unexpected_policies text[];
  v_mismatched_typmods text[];
  v_actual_sequence_count int;
  v_missing_sequences text[];
  v_unexpected_sequences text[];
  v_sequence_def_mismatches text[];
  v_sequence_ownership_mismatches text[];
  v_sequence_default_ref_mismatches text[];
  v_sequence_owner_mismatches text[];
  v_sequence_acl_mismatches text[];
  v_rls_missing text[];
  v_force_rls_tables text[];

  v_actual_table_count int;
  v_actual_view_count int;
  v_actual_enum_count int;
  v_actual_enum_value_count int;
  v_actual_column_count int;
  v_actual_pk_count int;
  v_actual_unique_count int;
  v_actual_check_count int;
  v_actual_exclusion_count int;
  v_actual_fk_count int;
  v_actual_index_count int;
  v_actual_fn_count int;
  v_actual_trigger_count int;
  v_actual_policy_count int;
  v_rls_enabled_count int;
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'BARBEX CANONICAL BASELINE COMPREHENSIVE AUDIT';
  RAISE NOTICE '==================================================';

  -- 1. BASE TABLES COUNT & NOMINAL PARITY (159)
  SELECT count(*) INTO v_actual_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  SELECT array_agg(t) INTO v_missing_tables
  FROM unnest(v_expected_tables) t
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name = t
  );

  SELECT array_agg(table_name) INTO v_unexpected_tables
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name != ALL(v_expected_tables);

  RAISE NOTICE '1. BASE TABLES: Actual=%, Expected=159', v_actual_table_count;
  IF v_actual_table_count = 159 AND (v_missing_tables IS NULL OR array_length(v_missing_tables, 1) = 0) AND (v_unexpected_tables IS NULL OR array_length(v_unexpected_tables, 1) = 0) THEN
    RAISE NOTICE '   [PASS] Exact 159 physical tables verified with zero missing and zero unexpected.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Table mismatch! Missing=%, Unexpected=%', v_missing_tables, v_unexpected_tables;
  END IF;

  -- 2. VIEWS NOMINAL PARITY (2)
  SELECT count(*) INTO v_actual_view_count
  FROM information_schema.views
  WHERE table_schema = 'public';

  SELECT array_agg(v) INTO v_missing_views
  FROM unnest(v_expected_views) v
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = v
  );

  RAISE NOTICE '2. VIEWS: Actual=%, Expected=2', v_actual_view_count;
  IF v_actual_view_count = 2 AND (v_missing_views IS NULL OR array_length(v_missing_views, 1) = 0) THEN
    RAISE NOTICE '   [PASS] Exact 2 public views verified (barber_rating_stats, vw_automation_debug).';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: View mismatch! Missing=%', v_missing_views;
  END IF;

  -- 2.1 PHYSICAL SEQUENCES (EXACTLY 2 PHYSICAL SEQUENCES, DEFINITIONS, OWNERSHIP, AND COLUMN DEFAULTS)
  SELECT count(*) INTO v_actual_sequence_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'S';

  SELECT array_agg(s) INTO v_missing_sequences
  FROM unnest(v_expected_sequences) s
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname = s
  );

  SELECT array_agg(c.relname) INTO v_unexpected_sequences
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'S'
    AND NOT (c.relname = ANY(v_expected_sequences));

  RAISE NOTICE '2.1 SEQUENCES: Actual=%, Expected=2', v_actual_sequence_count;
  IF v_actual_sequence_count = 2 AND (v_missing_sequences IS NULL OR array_length(v_missing_sequences, 1) = 0) AND (v_unexpected_sequences IS NULL OR array_length(v_unexpected_sequences, 1) = 0) THEN
    RAISE NOTICE '   [PASS] Exact 2 physical sequences nominally verified with zero missing and zero unexpected.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Sequence mismatch! Actual=%, Expected=2, Missing=%, Unexpected=%', v_actual_sequence_count, v_missing_sequences, v_unexpected_sequences;
  END IF;

  -- Verify Sequence Definitions (data_type = bigint, start = 1, increment = 1, min = 1, max = 9223372036854775807, cache = 1, cycle = false)
  SELECT array_agg(c.relname || ' (type=' || pg_catalog.format_type(s.seqtypid, NULL) || ', start=' || s.seqstart || ', inc=' || s.seqincrement || ', min=' || s.seqmin || ', max=' || s.seqmax || ', cache=' || s.seqcache || ', cycle=' || s.seqcycle || ')')
  INTO v_sequence_def_mismatches
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_sequence s ON s.seqrelid = c.oid
  WHERE n.nspname = 'public' AND c.relkind = 'S'
    AND (
      pg_catalog.format_type(s.seqtypid, NULL) <> 'bigint'
      OR s.seqstart <> 1
      OR s.seqincrement <> 1
      OR s.seqmin <> 1
      OR s.seqmax <> 9223372036854775807
      OR s.seqcache <> 1
      OR s.seqcycle <> false
    );

  IF v_sequence_def_mismatches IS NOT NULL AND array_length(v_sequence_def_mismatches, 1) > 0 THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Sequence definition mismatch! %', v_sequence_def_mismatches;
  ELSE
    RAISE NOTICE '   [PASS] Physical sequence definitions verified (bigint, start=1, inc=1, min=1, max=9223372036854775807, cache=1, cycle=false).';
  END IF;

  -- Verify Sequence Ownership (rate_limit_hits.id and status_checks.id with deptype = a)
  SELECT array_agg(s.relname || ' expected owned by ' || exp.tbl || '.' || exp.col || ', got ' || COALESCE(t.relname || '.' || a.attname, 'UNOWNED'))
  INTO v_sequence_ownership_mismatches
  FROM (
    VALUES
      ('rate_limit_hits_id_seq', 'rate_limit_hits', 'id'),
      ('status_checks_id_seq', 'status_checks', 'id')
  ) AS exp(seq, tbl, col)
  JOIN pg_class s ON s.relname = exp.seq AND s.relnamespace = 'public'::regnamespace AND s.relkind = 'S'
  LEFT JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.refclassid = 'pg_class'::regclass AND d.deptype = 'a'
  LEFT JOIN pg_class t ON t.oid = d.refobjid
  LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
  WHERE t.relname IS DISTINCT FROM exp.tbl OR a.attname IS DISTINCT FROM exp.col;

  IF v_sequence_ownership_mismatches IS NOT NULL AND array_length(v_sequence_ownership_mismatches, 1) > 0 THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Sequence ownership mismatch! %', v_sequence_ownership_mismatches;
  ELSE
    RAISE NOTICE '   [PASS] Physical sequence ownership verified (rate_limit_hits.id, status_checks.id with deptype=a).';
  END IF;

  -- Verify Column Defaults Reference the Correct Physical Sequences
  SELECT array_agg(exp.tbl || '.' || exp.col || ' default expected ' || exp.def || ', got ' || COALESCE(pg_get_expr(ad.adbin, ad.adrelid), 'NULL'))
  INTO v_sequence_default_ref_mismatches
  FROM (
    VALUES
      ('rate_limit_hits', 'id', 'nextval(''rate_limit_hits_id_seq''::regclass)'),
      ('status_checks', 'id', 'nextval(''status_checks_id_seq''::regclass)')
  ) AS exp(tbl, col, def)
  JOIN pg_class t ON t.relname = exp.tbl AND t.relnamespace = 'public'::regnamespace
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = exp.col
  LEFT JOIN pg_attrdef ad ON ad.adrelid = t.oid AND ad.adnum = a.attnum
  WHERE pg_get_expr(ad.adbin, ad.adrelid) IS DISTINCT FROM exp.def;

  IF v_sequence_default_ref_mismatches IS NOT NULL AND array_length(v_sequence_default_ref_mismatches, 1) > 0 THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Sequence default reference mismatch! %', v_sequence_default_ref_mismatches;
  ELSE
    RAISE NOTICE '   [PASS] Column default sequence references verified (nextval with regclass cast).';
  END IF;

  -- Verify Sequence Owner (postgres)
  SELECT array_agg(c.relname || ' owner expected postgres, got ' || r.rolname)
  INTO v_sequence_owner_mismatches
  FROM pg_class c
  JOIN pg_roles r ON r.oid = c.relowner
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S'
    AND r.rolname <> 'postgres';

  IF v_sequence_owner_mismatches IS NOT NULL AND array_length(v_sequence_owner_mismatches, 1) > 0 THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Sequence owner mismatch! %', v_sequence_owner_mismatches;
  ELSE
    RAISE NOTICE '   [PASS] Physical sequence owner verified (postgres).';
  END IF;

  -- Verify Portable Sequence ACLs (anon, authenticated, service_role have USAGE, SELECT, UPDATE)
  SELECT array_agg(t.seq || ' missing ' || t.priv || ' for ' || t.role)
  INTO v_sequence_acl_mismatches
  FROM (
    SELECT s.seq, r.role, p.priv
    FROM (VALUES ('rate_limit_hits_id_seq'), ('status_checks_id_seq')) AS s(seq)
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(role)
    CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) AS p(priv)
  ) t
  WHERE NOT has_sequence_privilege(t.role, 'public.' || t.seq, t.priv);

  IF v_sequence_acl_mismatches IS NOT NULL AND array_length(v_sequence_acl_mismatches, 1) > 0 THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Sequence ACL privilege mismatch! %', v_sequence_acl_mismatches;
  ELSE
    RAISE NOTICE '   [PASS] Portable sequence ACL privileges verified (USAGE, SELECT, UPDATE for anon, authenticated, service_role).';
  END IF;

  -- 3. RLS ENFORCEMENT & ZERO FORCE-RLS (159 enabled, 0 force)
  SELECT count(*) INTO v_rls_enabled_count
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE t.schemaname = 'public' AND c.relrowsecurity = true;

  SELECT array_agg(t.tablename) INTO v_rls_missing
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE t.schemaname = 'public' AND c.relrowsecurity = false;

  SELECT array_agg(t.tablename) INTO v_force_rls_tables
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE t.schemaname = 'public' AND c.relforcerowsecurity = true;

  RAISE NOTICE '3. RLS ENFORCEMENT: %/159 tables have RLS enabled.', v_rls_enabled_count;
  IF v_rls_enabled_count = 159 AND (v_rls_missing IS NULL OR array_length(v_rls_missing, 1) = 0) AND (v_force_rls_tables IS NULL OR array_length(v_force_rls_tables, 1) = 0) THEN
    RAISE NOTICE '   [PASS] 100%% of tables have Row Level Security enabled with 0 unexpected FORCE RLS.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: RLS mismatch! Missing=%, Force RLS=%', v_rls_missing, v_force_rls_tables;
  END IF;

  -- 4. ENUMS PARITY (14 types, 75 values)
  SELECT count(DISTINCT t.typname) INTO v_actual_enum_count
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typtype = 'e';

  SELECT count(*) INTO v_actual_enum_value_count
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public';

  SELECT array_agg(e) INTO v_missing_enums
  FROM unnest(v_expected_enums) e
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e' AND t.typname = e
  );

  RAISE NOTICE '4. ENUMS: Actual Types=%, Expected=14 | Actual Values=%, Expected=75', v_actual_enum_count, v_actual_enum_value_count;
  IF v_actual_enum_count = 14 AND v_actual_enum_value_count = 75 AND (v_missing_enums IS NULL OR array_length(v_missing_enums, 1) = 0) THEN
    RAISE NOTICE '   [PASS] All 14 custom ENUM types and 75 values verified.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: ENUM mismatch! Missing types=%', v_missing_enums;
  END IF;

  -- 5. COLUMNS COUNT & CRITICAL NOMINAL VALIDATION (2211 total: 2198 base + 13 view)
  SELECT count(*) INTO v_actual_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public';

  RAISE NOTICE '5. COLUMNS: Actual=%, Expected=2211', v_actual_column_count;
  IF v_actual_column_count <> 2211 THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Column count mismatch! Actual=%, Expected=2211', v_actual_column_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointment_reviews'
      AND column_name = 'service_id'
      AND udt_name = 'uuid'
  ) THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: appointment_reviews.service_id (UUID) is missing or invalid in public catalog!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointment_reviews'
      AND column_name = 'service_rating'
  ) THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: appointment_reviews.service_rating is missing in public catalog!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointment_reviews'
      AND column_name = 'allow_public_display'
  ) THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: appointment_reviews.allow_public_display is missing in public catalog!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_usage_logs'
      AND column_name = 'service_id'
  ) THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: subscription_usage_logs.service_id is missing in public catalog!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_credits'
      AND column_name = 'available_amount'
      AND is_generated = 'ALWAYS'
  ) THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: customer_credits.available_amount GENERATED column is missing or invalid!';
  END IF;

  -- 5.1 EXACT COLUMN TYPEMOD VALIDATION (pg_catalog.format_type)
  SELECT array_agg(parsed.tbl || '.' || parsed.col || ' (Expected: ' || parsed.exp_type || ', Actual: ' || COALESCE(pg_catalog.format_type(a.atttypid, a.atttypmod), 'MISSING') || ')')
  INTO v_mismatched_typmods
  FROM unnest(v_expected_typmod_columns) expected_col
  CROSS JOIN LATERAL (
    SELECT split_part(expected_col, '::', 1) AS tbl,
           split_part(expected_col, '::', 2) AS col,
           split_part(expected_col, '::', 3) AS exp_type
  ) parsed
  LEFT JOIN pg_class c ON c.relname = parsed.tbl
  LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = parsed.col AND a.attnum > 0 AND NOT a.attisdropped
  WHERE c.oid IS NULL 
     OR a.attnum IS NULL 
     OR pg_catalog.format_type(a.atttypid, a.atttypmod) <> parsed.exp_type;

  IF v_mismatched_typmods IS NOT NULL AND array_length(v_mismatched_typmods, 1) > 0 THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Column typmod mismatch detected! Mismatched=%', v_mismatched_typmods;
  ELSE
    RAISE NOTICE '   [PASS] Exact PostgreSQL column typmods (numeric precision/scale, etc.) verified via pg_catalog.format_type (% columns checked).', array_length(v_expected_typmod_columns, 1);
  END IF;

  -- 6. PRIMARY KEYS (159 NOMINAL)
  SELECT count(*) INTO v_actual_pk_count
  FROM pg_constraint con
  JOIN pg_namespace n ON n.oid = con.connamespace
  WHERE n.nspname = 'public' AND con.contype = 'p';

  SELECT array_agg(p) INTO v_missing_pks
  FROM unnest(v_expected_pks) p
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public'
      AND con.contype = 'p'
      AND (rel.relname || '::' || con.conname) = p
  );

  SELECT array_agg(rel.relname || '::' || con.conname) INTO v_unexpected_pks
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = con.connamespace
  WHERE n.nspname = 'public'
    AND con.contype = 'p'
    AND NOT ((rel.relname || '::' || con.conname) = ANY(v_expected_pks));

  RAISE NOTICE '6. PRIMARY KEYS: Actual=%, Expected=159', v_actual_pk_count;
  IF v_actual_pk_count = 159 AND (v_missing_pks IS NULL OR array_length(v_missing_pks, 1) = 0) AND (v_unexpected_pks IS NULL OR array_length(v_unexpected_pks, 1) = 0) THEN
    RAISE NOTICE '   [PASS] Exact 159 physical primary keys nominally verified with zero missing and zero unexpected.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Primary key mismatch! Actual=%, Expected=159, Missing=%, Unexpected=%', v_actual_pk_count, v_missing_pks, v_unexpected_pks;
  END IF;

  -- 7. UNIQUE CONSTRAINTS (58 NOMINAL)
  SELECT count(*) INTO v_actual_unique_count
  FROM pg_constraint con
  JOIN pg_namespace n ON n.oid = con.connamespace
  WHERE n.nspname = 'public' AND con.contype = 'u';

  SELECT array_agg(u) INTO v_missing_uniques
  FROM unnest(v_expected_uniques) u
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public'
      AND con.contype = 'u'
      AND (rel.relname || '::' || con.conname) = u
  );

  SELECT array_agg(rel.relname || '::' || con.conname) INTO v_unexpected_uniques
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = con.connamespace
  WHERE n.nspname = 'public'
    AND con.contype = 'u'
    AND NOT ((rel.relname || '::' || con.conname) = ANY(v_expected_uniques));

  RAISE NOTICE '7. UNIQUE CONSTRAINTS: Actual=%, Expected=58', v_actual_unique_count;
  IF v_actual_unique_count = 58 AND (v_missing_uniques IS NULL OR array_length(v_missing_uniques, 1) = 0) AND (v_unexpected_uniques IS NULL OR array_length(v_unexpected_uniques, 1) = 0) THEN
    RAISE NOTICE '   [PASS] Exact 58 physical unique constraints nominally verified with zero missing and zero unexpected.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Unique constraint mismatch! Actual=%, Expected=58, Missing=%, Unexpected=%', v_actual_unique_count, v_missing_uniques, v_unexpected_uniques;
  END IF;

  -- 8. CHECK CONSTRAINTS (59 NOMINAL)
  SELECT count(*) INTO v_actual_check_count
  FROM pg_constraint con
  JOIN pg_namespace n ON n.oid = con.connamespace
  WHERE n.nspname = 'public' AND con.contype = 'c';

  SELECT array_agg(c) INTO v_missing_checks
  FROM unnest(v_expected_checks) c
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public'
      AND con.contype = 'c'
      AND (rel.relname || '::' || con.conname) = c
  );

  SELECT array_agg(rel.relname || '::' || con.conname) INTO v_unexpected_checks
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = con.connamespace
  WHERE n.nspname = 'public'
    AND con.contype = 'c'
    AND NOT ((rel.relname || '::' || con.conname) = ANY(v_expected_checks));

  RAISE NOTICE '8. CHECK CONSTRAINTS: Actual=%, Expected=59', v_actual_check_count;
  IF v_actual_check_count = 59 AND (v_missing_checks IS NULL OR array_length(v_missing_checks, 1) = 0) AND (v_unexpected_checks IS NULL OR array_length(v_unexpected_checks, 1) = 0) THEN
    RAISE NOTICE '   [PASS] Exact 59 physical check constraints nominally verified with zero missing and zero unexpected.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Check constraint mismatch! Actual=%, Expected=59, Missing=%, Unexpected=%', v_actual_check_count, v_missing_checks, v_unexpected_checks;
  END IF;

  -- 9. EXCLUSION CONSTRAINTS (0 NOMINAL)
  SELECT count(*) INTO v_actual_exclusion_count
  FROM pg_constraint con
  JOIN pg_namespace n ON n.oid = con.connamespace
  WHERE n.nspname = 'public' AND con.contype = 'x';

  RAISE NOTICE '9. EXCLUSION CONSTRAINTS: Actual=%, Expected=0', v_actual_exclusion_count;
  IF v_actual_exclusion_count <> 0 THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Exclusion constraints detected! Actual=%, Expected=0', v_actual_exclusion_count;
  ELSE
    RAISE NOTICE '   [PASS] Zero exclusion constraints confirmed.';
  END IF;

  -- 10. FOREIGN KEYS (279 NOMINAL)
  SELECT count(*) INTO v_actual_fk_count
  FROM pg_constraint con
  JOIN pg_namespace n ON n.oid = con.connamespace
  WHERE n.nspname = 'public' AND con.contype = 'f';

  SELECT array_agg(f) INTO v_missing_fks
  FROM unnest(v_expected_fks) f
  WHERE NOT EXISTS (
    SELECT 1 
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public'
      AND con.contype = 'f'
      AND (rel.relname || '::' || con.conname) = f
  );

  SELECT array_agg(rel.relname || '::' || con.conname) INTO v_unexpected_fks
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = con.connamespace
  WHERE n.nspname = 'public'
    AND con.contype = 'f'
    AND NOT ((rel.relname || '::' || con.conname) = ANY(v_expected_fks));

  RAISE NOTICE '10. FOREIGN KEYS: Actual=%, Expected=279', v_actual_fk_count;
  IF v_actual_fk_count = 279 AND (v_missing_fks IS NULL OR array_length(v_missing_fks, 1) = 0) AND (v_unexpected_fks IS NULL OR array_length(v_unexpected_fks, 1) = 0) THEN
    RAISE NOTICE '   [PASS] Exact 279 physical foreign keys nominally verified with zero missing and zero unexpected.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Foreign key mismatch! Actual=%, Expected=279, Missing=%, Unexpected=%', v_actual_fk_count, v_missing_fks, v_unexpected_fks;
  END IF;

  -- REGRESSION ASSERTIONS FOR RETRY #4 AND RETRY #5 PHANTOM CONSTRAINTS
  IF EXISTS (SELECT 1 FROM pg_constraint con JOIN pg_namespace n ON n.oid = con.connamespace WHERE n.nspname = 'public' AND con.conname = 'automation_logs_queue_id_fkey') THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Phantom constraint automation_logs_queue_id_fkey detected!';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint con JOIN pg_namespace n ON n.oid = con.connamespace WHERE n.nspname = 'public' AND con.conname = 'whatsapp_delivery_logs_queue_id_fkey') THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Phantom constraint whatsapp_delivery_logs_queue_id_fkey detected!';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint con JOIN pg_namespace n ON n.oid = con.connamespace WHERE n.nspname = 'public' AND con.conname = 'whatsapp_instances_user_id_fkey') THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Phantom constraint whatsapp_instances_user_id_fkey detected!';
  END IF;

  -- 11. INDEXES (442 NOMINAL: 159 PK + 58 UNIQUE + 225 STANDALONE)
  SELECT count(*) INTO v_actual_index_count
  FROM pg_indexes
  WHERE schemaname = 'public';

  SELECT array_agg(i) INTO v_missing_indexes
  FROM unnest(v_expected_indexes) i
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND (tablename || '::' || indexname) = i
  );

  SELECT array_agg(tablename || '::' || indexname) INTO v_unexpected_indexes
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND NOT ((tablename || '::' || indexname) = ANY(v_expected_indexes));

  RAISE NOTICE '11. INDEXES: Actual=%, Expected=442', v_actual_index_count;
  IF v_actual_index_count = 442 AND (v_missing_indexes IS NULL OR array_length(v_missing_indexes, 1) = 0) AND (v_unexpected_indexes IS NULL OR array_length(v_unexpected_indexes, 1) = 0) THEN
    RAISE NOTICE '   [PASS] Exact 442 physical indexes nominally verified with zero missing and zero unexpected.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Index mismatch! Actual=%, Expected=442, Missing=%, Unexpected=%', v_actual_index_count, v_missing_indexes, v_unexpected_indexes;
  END IF;

  -- 12. FUNCTIONS (202 NOMINAL)
  SELECT count(*) INTO v_actual_fn_count
  FROM information_schema.routines
  WHERE routine_schema = 'public';

  SELECT array_agg(f) INTO v_missing_functions
  FROM unnest(v_expected_functions) f
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE ('public.' || p.proname) = f
  );

  RAISE NOTICE '12. FUNCTIONS: Actual=%, Expected=202', v_actual_fn_count;
  IF v_actual_fn_count = 202 AND (v_missing_functions IS NULL OR array_length(v_missing_functions, 1) = 0) THEN
    RAISE NOTICE '   [PASS] Exact 202 public functions verified with 0 missing and 0 unexpected.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Function mismatch! Actual=%, Expected=202, Missing=%', v_actual_fn_count, v_missing_functions;
  END IF;

  -- 13. TRIGGERS (110 NOMINAL PHYSICAL TRIGGERS)
  SELECT count(*) INTO v_actual_trigger_count
  FROM pg_trigger trg
  JOIN pg_class rel ON rel.oid = trg.tgrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public' AND NOT trg.tgisinternal;

  SELECT array_agg(t) INTO v_missing_triggers
  FROM unnest(v_expected_triggers) t
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_trigger trg
    JOIN pg_class rel ON rel.oid = trg.tgrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND NOT trg.tgisinternal
      AND (rel.relname || '::' || trg.tgname) = t
  );

  SELECT array_agg(rel.relname || '::' || trg.tgname) INTO v_unexpected_triggers
  FROM pg_trigger trg
  JOIN pg_class rel ON rel.oid = trg.tgrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public'
    AND NOT trg.tgisinternal
    AND NOT ((rel.relname || '::' || trg.tgname) = ANY(v_expected_triggers));

  RAISE NOTICE '13. TRIGGERS: Actual=%, Expected=110', v_actual_trigger_count;
  IF v_actual_trigger_count = 110 AND (v_missing_triggers IS NULL OR array_length(v_missing_triggers, 1) = 0) AND (v_unexpected_triggers IS NULL OR array_length(v_unexpected_triggers, 1) = 0) THEN
    RAISE NOTICE '   [PASS] Exact 110 physical triggers nominally verified with zero missing and zero unexpected.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Trigger mismatch! Actual=%, Expected=110, Missing=%, Unexpected=%', v_actual_trigger_count, v_missing_triggers, v_unexpected_triggers;
  END IF;

  -- 14. POLICIES (394 NOMINAL)
  SELECT count(*) INTO v_actual_policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  SELECT array_agg(p) INTO v_missing_policies
  FROM unnest(v_expected_policies) p
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND (pol.tablename || '::' || pol.policyname) = p
  );

  SELECT array_agg(pol.tablename || '::' || pol.policyname) INTO v_unexpected_policies
  FROM pg_policies pol
  WHERE pol.schemaname = 'public'
    AND NOT ((pol.tablename || '::' || pol.policyname) = ANY(v_expected_policies));

  RAISE NOTICE '14. POLICIES: Actual=%, Expected=394', v_actual_policy_count;
  IF v_actual_policy_count = 394 AND (v_missing_policies IS NULL OR array_length(v_missing_policies, 1) = 0) AND (v_unexpected_policies IS NULL OR array_length(v_unexpected_policies, 1) = 0) THEN
    RAISE NOTICE '   [PASS] Exact 394 public policies nominally verified with zero missing and zero unexpected.';
  ELSE
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Policy mismatch! Actual=%, Expected=394, Missing=%, Unexpected=%', v_actual_policy_count, v_missing_policies, v_unexpected_policies;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('background_jobs', 'observability_logs', 'operation_locks')
  ) THEN
    RAISE EXCEPTION 'CRITICAL_VERIFY_FAILURE: Unexpected policies found on policyless tables (background_jobs, observability_logs, operation_locks)!';
  ELSE
    RAISE NOTICE '   [PASS] Policyless RLS tables verified clean (0 policies on background_jobs, observability_logs, operation_locks).';
  END IF;

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'STRUCTURAL TOTALS SUMMARY:';
  RAISE NOTICE '   - Base Tables: % (Expected 159)', v_actual_table_count;
  RAISE NOTICE '   - Views: % (Expected 2)', v_actual_view_count;
  RAISE NOTICE '   - Sequences: % (Expected 2)', v_actual_sequence_count;
  RAISE NOTICE '   - Enums: % (Expected 14)', v_actual_enum_count;
  RAISE NOTICE '   - Columns: % (Expected 2211)', v_actual_column_count;
  RAISE NOTICE '   - Typmod-Sensitive Columns: % (Expected 112)', array_length(v_expected_typmod_columns, 1);
  RAISE NOTICE '   - Primary Keys: % (Expected 159)', v_actual_pk_count;
  RAISE NOTICE '   - Unique Constraints: % (Expected 58)', v_actual_unique_count;
  RAISE NOTICE '   - Check Constraints: % (Expected 59)', v_actual_check_count;
  RAISE NOTICE '   - Exclusion Constraints: % (Expected 0)', v_actual_exclusion_count;
  RAISE NOTICE '   - Foreign Keys: % (Expected 279)', v_actual_fk_count;
  RAISE NOTICE '   - Indexes: % (Expected 442)', v_actual_index_count;
  RAISE NOTICE '   - Functions/RPCs: % (Expected 202)', v_actual_fn_count;
  RAISE NOTICE '   - Triggers: % (Expected 110)', v_actual_trigger_count;
  RAISE NOTICE '   - RLS Tables: % (Expected 159)', v_rls_enabled_count;
  RAISE NOTICE '   - Policies: % (Expected 394)', v_actual_policy_count;
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'AUDIT COMPLETED: 100%% CANONICAL PHYSICAL SOURCE PARITY CONFIRMED';
  RAISE NOTICE '==================================================';
END $$;
