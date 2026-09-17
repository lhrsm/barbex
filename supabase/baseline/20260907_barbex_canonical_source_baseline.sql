-- ==============================================================================
-- BARBEX — CANONICAL PHYSICAL SOURCE BASELINE (COMPLETE PHYSICAL CATALOG EDITION)
-- FILE: supabase/baseline/20260907_barbex_canonical_source_baseline.sql
-- DATE: 2026-09-08
-- SOURCE PRODUCTION REF: wdxhjwodyctgzqtogkgv (Lovable Cloud)
--
-- PHYSICAL SOURCE TARGET:
-- 159 Base Tables
-- 2 Views (barber_rating_stats, vw_automation_debug)
-- 2211 Columns (2198 Base Table Columns + 13 View Columns)
-- 159 Primary Keys (Physical Constraints Catalog)
-- 58 Unique Constraints (Physical Constraints Catalog)
-- 59 Check Constraints (Physical Constraints Catalog)
-- 0 Exclusion Constraints
-- 279 Foreign Keys (Two-Phase DDL: ALTER TABLE ADD CONSTRAINT)
-- 442 Indexes (159 PK + 58 Unique + 225 Standalone)
-- 159/159 Tables with RLS enabled
-- 394 Policies
-- 202 Functions / RPCs
-- 110 Triggers (Physical Non-Internal Triggers)
-- 14 ENUMs (75 values)
--
-- DIRECTIVE:
-- - IDEMPOTENT EXECUTION FOR EMPTY SUPABASE TARGET
-- - ZERO PRODUCTION ROWS / ZERO USER DATA INSERTS
-- ==============================================================================

-- ==============================================================================
-- 01. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA extensions;

-- ==============================================================================
-- 02. ENUMS AND CUSTOM TYPES (EXACTLY 14 ENUMS / 75 VALUES)
-- ==============================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'addon_access_source') THEN
        CREATE TYPE public.addon_access_source AS ENUM ('addon', 'plan', 'voucher');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'addon_billing_cycle') THEN
        CREATE TYPE public.addon_billing_cycle AS ENUM ('monthly', 'annual');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'tenant_admin', 'barber', 'client', 'reception', 'manager', 'receptionist', 'financial', 'cashier', 'professional');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'approval_status') THEN
        CREATE TYPE public.approval_status AS ENUM ('not_required', 'pending', 'approved', 'rejected');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'automation_flow_type') THEN
        CREATE TYPE public.automation_flow_type AS ENUM ('single', 'multi');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'communication_category') THEN
        CREATE TYPE public.communication_category AS ENUM ('transactional', 'operational', 'commercial', 'billing', 'support', 'internal', 'security');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'communication_channel_type') THEN
        CREATE TYPE public.communication_channel_type AS ENUM ('whatsapp', 'email', 'sms', 'push', 'internal', 'telegram', 'instagram');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'communication_message_status') THEN
        CREATE TYPE public.communication_message_status AS ENUM ('pending', 'queued', 'processing', 'sent', 'delivered', 'read', 'replied', 'failed', 'cancelled', 'expired');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'identity_status') THEN
        CREATE TYPE public.identity_status AS ENUM ('legacy', 'pending', 'completed');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'loyalty_category') THEN
        CREATE TYPE public.loyalty_category AS ENUM ('visit', 'spend', 'referral', 'social', 'special');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'product_sale_status') THEN
        CREATE TYPE public.product_sale_status AS ENUM ('completed', 'cancelled', 'refunded');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'time_off_status') THEN
        CREATE TYPE public.time_off_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'time_off_type') THEN
        CREATE TYPE public.time_off_type AS ENUM ('day_off', 'personal_block', 'break', 'meeting', 'training', 'vacation', 'medical_leave', 'personal_leave', 'suspension', 'other');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'tour_status') THEN
        CREATE TYPE public.tour_status AS ENUM ('not_started', 'in_progress', 'completed', 'skipped');
    END IF;
END $$;

-- ==============================================================================
-- 02.1. SEQUENCES (EXACTLY 2 CANONICAL PHYSICAL SEQUENCES)
-- REBUILT DIRECTLY FROM AUTHORITATIVE PHYSICAL SOURCE SEQUENCE CATALOG
-- ==============================================================================
CREATE SEQUENCE IF NOT EXISTS public.rate_limit_hits_id_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 9223372036854775807
    CACHE 1
    NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public.status_checks_id_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 9223372036854775807
    CACHE 1
    NO CYCLE;

GRANT ALL ON SEQUENCE public.rate_limit_hits_id_seq TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.status_checks_id_seq TO anon, authenticated, service_role;

-- ==============================================================================
-- 03. BASE TABLES DDL (EXACTLY 159 TABLES - TWO-PHASE DDL: ZERO INLINE CROSS-TABLE FKS)
-- REBUILT DIRECTLY FROM AUTHORITATIVE PHYSICAL SOURCE COLUMN & CONSTRAINT CATALOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.academy_lessons (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    video_url TEXT,
    checklist JSONB DEFAULT '[]'::jsonb,
    tutorial_id UUID,
    route_path TEXT,
    duration TEXT,
    "order" INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published'::text,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT academy_lessons_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.academy_modules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    path_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT academy_modules_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.academy_paths (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    profile_target public.app_role NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'::text,
    "order" INTEGER DEFAULT 0,
    duration TEXT,
    difficulty TEXT,
    level TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT academy_paths_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.academy_progress (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    path_id UUID NOT NULL,
    lesson_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'started'::text,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT academy_progress_pkey PRIMARY KEY (id),
    CONSTRAINT academy_progress_user_id_lesson_id_key UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS public.addon_upgrade_recommendations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    current_plan_id UUID,
    recommended_plan_id UUID,
    selected_addon_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    active_addon_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    billing_cycle public.addon_billing_cycle NOT NULL DEFAULT 'monthly'::addon_billing_cycle,
    current_option_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    upgrade_option_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    monthly_savings NUMERIC(10,2) NOT NULL DEFAULT 0,
    annual_savings NUMERIC(10,2) NOT NULL DEFAULT 0,
    recommendation_reason TEXT,
    customer_action TEXT,
    action_taken_at TIMESTAMPTZ,
    shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT addon_upgrade_recommendations_customer_action_check CHECK (customer_action = ANY (ARRAY['upgraded'::text, 'kept_addons'::text, 'reviewed_selection'::text, 'dismissed'::text])),
    CONSTRAINT addon_upgrade_recommendations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.admin_event_log (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info'::text,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    tenant_id UUID,
    recipients_count INTEGER NOT NULL DEFAULT 0,
    channels_delivered JSONB NOT NULL DEFAULT '{}'::jsonb,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT admin_event_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.admin_event_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_key TEXT NOT NULL,
    channel_panel BOOLEAN NOT NULL DEFAULT true,
    channel_push BOOLEAN NOT NULL DEFAULT true,
    channel_whatsapp BOOLEAN NOT NULL DEFAULT false,
    channel_email BOOLEAN NOT NULL DEFAULT false,
    whatsapp_phone TEXT,
    email_address TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT admin_event_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT admin_event_subscriptions_user_id_event_key_key UNIQUE (user_id, event_key)
);

CREATE TABLE IF NOT EXISTS public.admin_event_templates (
    event_key TEXT NOT NULL,
    title_tpl TEXT NOT NULL,
    message_tpl TEXT NOT NULL DEFAULT ''::text,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    CONSTRAINT admin_event_templates_pkey PRIMARY KEY (event_key)
);

CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    reference_id UUID,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    message TEXT,
    tenant_id UUID,
    user_id UUID,
    related_entity_type TEXT,
    related_entity_id UUID,
    action_url TEXT,
    priority TEXT NOT NULL DEFAULT 'normal'::text,
    read_at TIMESTAMPTZ,
    archived BOOLEAN NOT NULL DEFAULT false,
    event_key TEXT,
    severity TEXT NOT NULL DEFAULT 'info'::text,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT admin_notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ai_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider TEXT NOT NULL DEFAULT 'openai'::text,
    api_key TEXT,
    model TEXT DEFAULT 'gpt-3.5-turbo'::text,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_settings_pkey PRIMARY KEY (id),
    CONSTRAINT ai_settings_tenant_id_key UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.appointment_checkins (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    customer_id UUID,
    source TEXT NOT NULL DEFAULT 'qr'::text,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT appointment_checkins_pkey PRIMARY KEY (id),
    CONSTRAINT appointment_checkins_appointment_id_key UNIQUE (appointment_id)
);

CREATE TABLE IF NOT EXISTS public.appointment_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID,
    group_token TEXT NOT NULL,
    total_amount NUMERIC(10,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending'::text,
    status TEXT DEFAULT 'active'::text,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT appointment_groups_pkey PRIMARY KEY (id),
    CONSTRAINT appointment_groups_group_token_key UNIQUE (group_token)
);

CREATE TABLE IF NOT EXISTS public.appointment_reviews (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    appointment_id UUID NOT NULL,
    customer_id UUID,
    barber_id UUID,
    barbershop_rating INTEGER,
    barber_rating INTEGER,
    testimonial_text TEXT,
    testimonial_status TEXT NOT NULL DEFAULT 'pending'::text,
    show_on_frontend BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    review_token UUID,
    token_expires_at TIMESTAMPTZ,
    token_used_at TIMESTAMPTZ,
    would_recommend TEXT,
    submitted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    service_id UUID,
    service_rating INTEGER,
    allow_public_display BOOLEAN NOT NULL DEFAULT false,
    reply TEXT,
    reply_at TIMESTAMPTZ,
    reply_by UUID,
    rejected_at TIMESTAMPTZ,
    rejected_by UUID,
    reply_reminder_sent_at TIMESTAMPTZ,
    CONSTRAINT appointment_reviews_barber_rating_check CHECK (barber_rating >= 1 AND barber_rating <= 5),
    CONSTRAINT appointment_reviews_barbershop_rating_check CHECK (barbershop_rating >= 1 AND barbershop_rating <= 5),
    CONSTRAINT appointment_reviews_service_rating_check CHECK (service_rating IS NULL OR service_rating >= 1 AND service_rating <= 5),
    CONSTRAINT appointment_reviews_testimonial_status_check CHECK (testimonial_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
    CONSTRAINT appointment_reviews_would_recommend_check CHECK (would_recommend = ANY (ARRAY['yes'::text, 'maybe'::text, 'no'::text])),
    CONSTRAINT appointment_reviews_pkey PRIMARY KEY (id),
    CONSTRAINT appointment_reviews_appointment_id_key UNIQUE (appointment_id),
    CONSTRAINT appointment_reviews_review_token_key UNIQUE (review_token)
);

CREATE TABLE IF NOT EXISTS public.appointment_status_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by_type TEXT NOT NULL,
    changed_by_id UUID,
    source TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error TEXT,
    rpc_response JSONB,
    status_before TEXT,
    status_after TEXT,
    CONSTRAINT appointment_status_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    customer_id UUID,
    barber_id UUID,
    service_id UUID,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled'::text,
    total_price NUMERIC(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    cancel_token UUID DEFAULT gen_random_uuid(),
    payment_status TEXT DEFAULT 'pending'::text,
    payment_method TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    refund_requested_at TIMESTAMPTZ,
    refund_type TEXT,
    refund_status TEXT DEFAULT 'pending'::text,
    original_total NUMERIC(10,2),
    credit_used NUMERIC(10,2) DEFAULT 0,
    pix_amount NUMERIC(10,2) DEFAULT 0,
    barbershop_amount NUMERIC(10,2) DEFAULT 0,
    final_amount NUMERIC(10,2) DEFAULT 0,
    cashback_used NUMERIC DEFAULT 0,
    cashback_earned NUMERIC DEFAULT 0,
    reminder_sent BOOLEAN DEFAULT false,
    confirmation_sent BOOLEAN DEFAULT false,
    tenant_id UUID NOT NULL,
    source TEXT DEFAULT 'admin'::text,
    updated_by_type TEXT,
    updated_by_id UUID,
    coupon_id UUID,
    coupon_code TEXT,
    discount_amount NUMERIC DEFAULT 0,
    subtotal_amount NUMERIC,
    appointment_group_id UUID,
    cancel_reason TEXT,
    confirmation_sent_at TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_source TEXT,
    cancelled_by TEXT,
    confirmed_by TEXT,
    completed_by TEXT,
    refund_preference TEXT,
    credits_used NUMERIC(10,2) DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    confirmation_response_sent_at TIMESTAMPTZ,
    cash_amount NUMERIC(10,2) DEFAULT 0,
    credit_card_amount NUMERIC(10,2) DEFAULT 0,
    debit_card_amount NUMERIC(10,2) DEFAULT 0,
    payment_breakdown JSONB,
    management_token UUID DEFAULT gen_random_uuid(),
    customer_action_source TEXT,
    rescheduled_from_id UUID,
    payment_id TEXT,
    service_amount NUMERIC(10,2),
    group_sequence INTEGER,
    paid_at TIMESTAMPTZ,
    subscription_id UUID,
    subscription_plan_id UUID,
    subscription_covered_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    extra_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    products_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    tip_barber_id UUID,
    appointment_type TEXT NOT NULL DEFAULT 'online'::text,
    walkin_arrived_at TIMESTAMPTZ,
    walkin_started_at TIMESTAMPTZ,
    walkin_ticket_number INTEGER,
    review_decision TEXT,
    CONSTRAINT appointments_appointment_type_check CHECK (appointment_type = ANY (ARRAY['online'::text, 'walk_in'::text])),
    CONSTRAINT appointments_refund_status_check CHECK (refund_status = ANY (ARRAY['none'::text, 'not_applicable'::text, 'refund_requested'::text, 'refund_approved'::text, 'refund_rejected'::text, 'refunded'::text, 'converted_to_credit'::text, 'pending'::text, 'requested'::text, 'approved'::text, 'completed'::text, 'cancelled'::text])),
    CONSTRAINT appointments_refund_type_check CHECK (refund_type = ANY (ARRAY['credits'::text, 'refund'::text])),
    CONSTRAINT appointments_review_decision_check CHECK (review_decision IS NULL OR (review_decision = ANY (ARRAY['pending'::text, 'submitted'::text, 'skipped'::text]))),
    CONSTRAINT appointments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL,
    target_id UUID,
    action TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_conversations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID,
    phone TEXT NOT NULL,
    automation_type TEXT NOT NULL,
    current_state TEXT NOT NULL DEFAULT 'AWAITING_MAIN_ACTION'::text,
    appointment_ids UUID[] DEFAULT '{}'::uuid[],
    selected_appointment_id UUID,
    remaining_appointment_ids UUID[] DEFAULT '{}'::uuid[],
    last_option_id TEXT,
    status TEXT NOT NULL DEFAULT 'active'::text,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + '24:00:00'::interval),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    automation_id UUID,
    phone_normalized TEXT,
    appointment_id UUID,
    workflow_key TEXT,
    customer_phone TEXT,
    expected_response TEXT,
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT automation_conversations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_cron_runs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL,
    processed_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB,
    tenant_id UUID,
    appointment_id UUID,
    skipped_count INTEGER DEFAULT 0,
    details JSONB DEFAULT '{}'::jsonb,
    error TEXT,
    found_count INTEGER DEFAULT 0,
    eligible_count INTEGER DEFAULT 0,
    processed_appointments JSONB DEFAULT '[]'::jsonb,
    CONSTRAINT automation_cron_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_dispatches (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    automation_type TEXT NOT NULL,
    appointment_id UUID,
    customer_id UUID,
    scheduled_for TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    sent_at TIMESTAMPTZ,
    unique_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT automation_dispatches_pkey PRIMARY KEY (id),
    CONSTRAINT automation_dispatches_unique_key_key UNIQUE (unique_key)
);

CREATE TABLE IF NOT EXISTS public.automation_interaction_events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    interaction_id UUID,
    dispatch_id UUID,
    appointment_id UUID,
    customer_id UUID,
    customer_phone TEXT,
    workflow_key TEXT,
    event_type TEXT NOT NULL,
    response_text TEXT,
    response_time_ms INTEGER,
    ip TEXT,
    source TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT automation_interaction_events_type_check CHECK (event_type = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'clicked'::text, 'replied'::text, 'timeout'::text, 'failed'::text, 'action_executed'::text])),
    CONSTRAINT automation_interaction_events_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_interactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    automation_template_id UUID,
    automation_id UUID,
    button_title TEXT NOT NULL,
    button_icon TEXT,
    button_color TEXT DEFAULT 'gray'::text,
    action_type TEXT NOT NULL,
    action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    success_message TEXT,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    display_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT automation_interactions_action_type_check CHECK (action_type = ANY (ARRAY['confirm_appointment'::text, 'reschedule_appointment'::text, 'cancel_appointment'::text, 'open_portal'::text, 'open_public_page'::text, 'review'::text, 'renew_subscription'::text, 'change_plan'::text, 'buy_product'::text, 'talk_to_shop'::text, 'webhook'::text, 'edge_function'::text, 'api_call'::text, 'start_flow'::text])),
    CONSTRAINT automation_interactions_color_check CHECK (button_color = ANY (ARRAY['green'::text, 'blue'::text, 'red'::text, 'gold'::text, 'gray'::text])),
    CONSTRAINT automation_interactions_parent_check CHECK (automation_template_id IS NOT NULL OR automation_id IS NOT NULL),
    CONSTRAINT automation_interactions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    automation_id UUID,
    tenant_id UUID NOT NULL,
    customer_id UUID,
    status TEXT NOT NULL,
    provider TEXT,
    response JSONB,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    barber_id UUID,
    appointment_id UUID,
    message_type TEXT,
    phone TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    original_template TEXT,
    processed_template TEXT,
    direction TEXT DEFAULT 'outgoing'::text,
    option_id TEXT,
    payload JSONB,
    conversation_id UUID,
    received_at TIMESTAMPTZ,
    metadata JSONB,
    webhook_type TEXT,
    selected_option_raw TEXT,
    selected_option_normalized TEXT,
    state_before TEXT,
    state_after TEXT,
    action TEXT,
    message_sent TEXT,
    zapi_response JSONB,
    appointment_group_id UUID,
    idempotency_key TEXT,
    provider_message_id TEXT,
    callback_received BOOLEAN DEFAULT false,
    callback_received_at TIMESTAMPTZ,
    button_id TEXT,
    final_status TEXT,
    CONSTRAINT automation_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    automation_id UUID,
    appointment_id UUID,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    payload JSONB,
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    idempotency_key TEXT,
    event_name TEXT,
    workflow_key TEXT,
    scheduled_for TIMESTAMPTZ,
    customer_id UUID,
    reference_year INTEGER,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    automation_type TEXT,
    processed_at TIMESTAMPTZ,
    appointment_group_id UUID,
    CONSTRAINT automation_queue_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_reconciliation_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    reconciliation_interval_minutes INTEGER DEFAULT 15,
    pending_callback_alert_threshold INTEGER DEFAULT 10,
    not_found_alert_threshold INTEGER DEFAULT 5,
    alert_period_hours INTEGER DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT automation_reconciliation_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_send_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    appointment_id UUID,
    automation_name TEXT,
    event_name TEXT,
    source TEXT,
    channel TEXT DEFAULT 'whatsapp'::text,
    phone TEXT,
    status TEXT,
    provider_message_id TEXT,
    payload JSONB,
    zapi_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    conversation_created BOOLEAN DEFAULT false,
    conversation_id UUID,
    conversation_error TEXT,
    CONSTRAINT automation_send_history_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_status (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    last_run_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'active'::text,
    last_error TEXT,
    total_processed INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    server_time TIMESTAMPTZ DEFAULT now(),
    timezone TEXT DEFAULT 'America/Sao_Paulo'::text,
    CONSTRAINT automation_status_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    key TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp'::text,
    active BOOLEAN DEFAULT true,
    template TEXT NOT NULL,
    buttons JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_notified_at TIMESTAMPTZ,
    reprocessing_status TEXT DEFAULT 'idle'::text,
    last_reprocessed_at TIMESTAMPTZ,
    reprocessing_attempts INTEGER DEFAULT 0,
    reprocessing_history JSONB DEFAULT '[]'::jsonb,
    reprocessing_config JSONB DEFAULT '{"max_retries": 3, "backoff_factor": 2}'::jsonb,
    requires_callback BOOLEAN DEFAULT false,
    additional_templates JSONB DEFAULT '{}'::jsonb,
    wait_response_timeout_minutes INTEGER,
    wait_timeout_interaction_id UUID,
    recipient TEXT NOT NULL DEFAULT 'customer'::text,
    category TEXT NOT NULL DEFAULT 'agendamentos'::text,
    CONSTRAINT automation_templates_pkey PRIMARY KEY (id),
    CONSTRAINT automation_templates_tenant_id_key_key UNIQUE (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS public.automation_v2_dispatches (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    appointment_id UUID,
    appointment_group_id UUID,
    workflow_key TEXT NOT NULL,
    flow_type TEXT NOT NULL DEFAULT 'single'::text,
    phone TEXT NOT NULL,
    customer_name TEXT,
    message_id TEXT,
    channel TEXT NOT NULL DEFAULT 'whatsapp'::text,
    status TEXT NOT NULL DEFAULT 'sent'::text,
    sent_at TIMESTAMPTZ DEFAULT now(),
    payload JSONB,
    provider_response JSONB,
    callback_received BOOLEAN DEFAULT false,
    callback_received_at TIMESTAMPTZ,
    callback_button_id TEXT,
    callback_payload JSONB,
    session_id UUID,
    current_step TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    customer_id UUID,
    customer_phone TEXT,
    provider_message_id TEXT,
    zaap_id TEXT,
    action_executed BOOLEAN DEFAULT false,
    action_executed_at TIMESTAMPTZ,
    finalized BOOLEAN DEFAULT false,
    finalized_at TIMESTAMPTZ,
    birthday_year INTEGER,
    requires_callback BOOLEAN DEFAULT false,
    anniversary_year INTEGER,
    anniversary_message_type TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    error_log JSONB DEFAULT '[]'::jsonb,
    CONSTRAINT automation_v2_dispatches_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_v2_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    appointment_id UUID,
    level TEXT NOT NULL DEFAULT 'info'::text,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT automation_v2_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_v2_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID,
    phone TEXT NOT NULL,
    flow_type TEXT NOT NULL DEFAULT 'single'::text,
    current_step TEXT NOT NULL DEFAULT 'AWAITING_MAIN_ACTION'::text,
    status TEXT NOT NULL DEFAULT 'active'::text,
    appointment_id UUID,
    appointment_group_id UUID,
    provider_message_id TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT automation_v2_sessions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automation_webhook_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    appointment_id UUID,
    raw_payload JSONB NOT NULL,
    type TEXT,
    fromme BOOLEAN,
    phone TEXT,
    messageid TEXT,
    referencemessageid TEXT,
    buttonid TEXT,
    buttontext TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    "buttonId" TEXT,
    processed_at TIMESTAMPTZ,
    phone_raw TEXT,
    phone_normalized TEXT,
    incoming_text TEXT,
    normalized_text TEXT,
    matched_action TEXT,
    conversation_found BOOLEAN DEFAULT false,
    conversation_id UUID,
    status_before TEXT,
    status_after TEXT,
    response_sent BOOLEAN DEFAULT false,
    error TEXT,
    query_filters_used JSONB,
    conversations_found_count INTEGER DEFAULT 0,
    conversation_selected_id UUID,
    appointment_id_found UUID,
    last_processing_step TEXT,
    processing_error TEXT,
    CONSTRAINT automation_webhook_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    type TEXT NOT NULL,
    enabled BOOLEAN DEFAULT false,
    channel TEXT DEFAULT 'whatsapp'::text,
    trigger_type TEXT NOT NULL,
    trigger_delay INTEGER DEFAULT 0,
    template TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    barber_id UUID,
    template_multiple TEXT,
    wait_response_timeout_minutes INTEGER,
    wait_timeout_interaction_id UUID,
    CONSTRAINT automations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.availability_conflict_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    barber_id UUID,
    requested_start TIMESTAMPTZ NOT NULL,
    requested_end TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER,
    buffer_minutes INTEGER DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'unknown'::text,
    result TEXT NOT NULL DEFAULT 'conflict'::text,
    conflicting JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT availability_conflict_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.background_jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    queue_name TEXT NOT NULL DEFAULT 'default'::text,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_run_at TIMESTAMPTZ DEFAULT now(),
    last_error TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT background_jobs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.barber_commissions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    barber_id UUID NOT NULL,
    appointment_id UUID NOT NULL,
    customer_id UUID,
    service_id UUID,
    service_name TEXT,
    service_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    commission_type TEXT NOT NULL DEFAULT 'percentage'::text,
    commission_percentage NUMERIC(10,2) NOT NULL DEFAULT 0,
    commission_fixed_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    paid_at TIMESTAMPTZ,
    paid_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT barber_commissions_status_check CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])),
    CONSTRAINT barber_commissions_pkey PRIMARY KEY (id),
    CONSTRAINT barber_commissions_appointment_barber_key UNIQUE (appointment_id, barber_id)
);

CREATE TABLE IF NOT EXISTS public.barber_services (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    barber_id UUID,
    service_id UUID,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID,
    CONSTRAINT barber_services_pkey PRIMARY KEY (id),
    CONSTRAINT barber_services_barber_id_service_id_key UNIQUE (barber_id, service_id)
);

CREATE TABLE IF NOT EXISTS public.barber_tips (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    barber_id UUID NOT NULL,
    appointment_id UUID,
    customer_id UUID,
    amount NUMERIC(10,2) NOT NULL,
    method TEXT NOT NULL DEFAULT 'pix'::text,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    source TEXT NOT NULL DEFAULT 'review_link'::text,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT barber_tips_amount_check CHECK (amount > 0::numeric),
    CONSTRAINT barber_tips_status_check CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text])),
    CONSTRAINT barber_tips_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.barbers (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    avatar_url TEXT,
    category TEXT DEFAULT 'Proprietário'::text,
    commission_rate NUMERIC DEFAULT 0,
    average_rating NUMERIC(3,2) DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    working_hours JSONB DEFAULT '{"friday": {"end": "19:00", "start": "09:00", "enabled": true}, "monday": {"end": "19:00", "start": "09:00", "enabled": true}, "sunday": {"end": "14:00", "start": "09:00", "enabled": false}, "tuesday": {"end": "19:00", "start": "09:00", "enabled": true}, "saturday": {"end": "14:00", "start": "09:00", "enabled": true}, "thursday": {"end": "19:00", "start": "09:00", "enabled": true}, "wednesday": {"end": "19:00", "start": "09:00", "enabled": true}}'::jsonb,
    tenant_id UUID,
    bio TEXT,
    specialties TEXT[],
    updated_at TIMESTAMPTZ DEFAULT now(),
    commission_type TEXT NOT NULL DEFAULT 'percentage'::text,
    commission_fixed_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    commission_bonus_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    monthly_goal NUMERIC(10,2) NOT NULL DEFAULT 0,
    pix_key TEXT,
    pix_key_type TEXT,
    accepts_tips BOOLEAN NOT NULL DEFAULT true,
    pix_qr_code_url TEXT,
    auth_migration_status public.identity_status DEFAULT 'legacy'::identity_status,
    CONSTRAINT barbers_pix_key_type_check CHECK (pix_key_type = ANY (ARRAY['cpf'::text, 'cnpj'::text, 'email'::text, 'phone'::text, 'random'::text])),
    CONSTRAINT barbers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.barbershop_module_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    module_key TEXT NOT NULL,
    old_value BOOLEAN,
    new_value BOOLEAN NOT NULL,
    changed_by UUID,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT barbershop_module_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.barbershop_modules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    module_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT barbershop_modules_pkey PRIMARY KEY (id),
    CONSTRAINT barbershop_modules_tenant_id_module_key_key UNIQUE (tenant_id, module_key)
);

CREATE TABLE IF NOT EXISTS public.barbershop_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    barber_id UUID NOT NULL,
    instance_id TEXT,
    instance_token TEXT,
    client_token TEXT,
    whatsapp_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT barbershop_settings_pkey PRIMARY KEY (id),
    CONSTRAINT barbershop_settings_barber_id_key UNIQUE (barber_id)
);

CREATE TABLE IF NOT EXISTS public.barbershops (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    logo_url TEXT,
    owner_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    plan_id UUID,
    CONSTRAINT barbershops_pkey PRIMARY KEY (id),
    CONSTRAINT barbershops_owner_id_key UNIQUE (owner_id),
    CONSTRAINT barbershops_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.campaign_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    customer_id UUID,
    status TEXT NOT NULL,
    response JSONB,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT campaign_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    scheduled_at TIMESTAMPTZ,
    status TEXT DEFAULT 'draft'::text,
    filters JSONB,
    total_recipients INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.cashback_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    appointment_id UUID,
    type TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    base_amount NUMERIC(10,2),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT cashback_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT unique_cashback_per_appointment UNIQUE (appointment_id)
);

CREATE TABLE IF NOT EXISTS public.client_auth (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    password_hash TEXT,
    customer_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT client_auth_pkey PRIMARY KEY (id),
    CONSTRAINT client_auth_phone_key UNIQUE (phone)
);

ALTER TABLE public.client_auth
    ADD CONSTRAINT client_auth_phone_unique UNIQUE (phone);

CREATE TABLE IF NOT EXISTS public.commission_closings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    barber_id UUID NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT commission_closings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.commission_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    barber_id UUID NOT NULL,
    appointment_id UUID NOT NULL,
    customer_id UUID,
    service_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    commission_type TEXT NOT NULL DEFAULT 'percentage'::text,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    commission_fixed NUMERIC(10,2) NOT NULL DEFAULT 0,
    commission_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
    commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    closing_id UUID,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT commission_entries_pkey PRIMARY KEY (id),
    CONSTRAINT commission_entries_appointment_id_key UNIQUE (appointment_id)
);

CREATE TABLE IF NOT EXISTS public.communication_channels (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    type public.communication_channel_type NOT NULL,
    provider_name TEXT,
    status TEXT DEFAULT 'not_configured'::text,
    is_active BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}'::jsonb,
    health_status JSONB DEFAULT '{}'::jsonb,
    last_sync_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT communication_channels_pkey PRIMARY KEY (id),
    CONSTRAINT communication_channels_tenant_id_type_key UNIQUE (tenant_id, type)
);

CREATE TABLE IF NOT EXISTS public.communication_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    channel_type public.communication_channel_type NOT NULL,
    category public.communication_category DEFAULT 'operational'::communication_category,
    direction TEXT NOT NULL,
    sender_id UUID,
    customer_id UUID,
    recipient_address TEXT NOT NULL,
    content TEXT,
    template_id UUID,
    status public.communication_message_status DEFAULT 'pending'::communication_message_status,
    provider_message_id TEXT,
    provider_response JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    conversation_id UUID,
    correlation_id UUID,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT communication_messages_direction_check CHECK (direction = ANY (ARRAY['inbound'::text, 'outbound'::text])),
    CONSTRAINT communication_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.communication_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    key TEXT NOT NULL,
    category public.communication_category NOT NULL,
    channel_type public.communication_channel_type NOT NULL,
    content TEXT NOT NULL,
    subject TEXT,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT communication_templates_pkey PRIMARY KEY (id),
    CONSTRAINT communication_templates_tenant_id_key_channel_type_key UNIQUE (tenant_id, key, channel_type)
);

CREATE TABLE IF NOT EXISTS public.cookie_consents (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    customer_id UUID,
    user_id UUID,
    session_id TEXT,
    necessary BOOLEAN NOT NULL DEFAULT true,
    preferences BOOLEAN NOT NULL DEFAULT false,
    statistics BOOLEAN NOT NULL DEFAULT false,
    marketing BOOLEAN NOT NULL DEFAULT false,
    policy_version TEXT NOT NULL DEFAULT '2026-06-27'::text,
    ip TEXT,
    user_agent TEXT,
    device TEXT,
    source TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT cookie_consents_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    minimum_amount NUMERIC DEFAULT 0,
    max_discount NUMERIC,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    starts_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    applies_to TEXT NOT NULL DEFAULT 'order'::text,
    first_month_only BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT coupons_applies_to_check CHECK (applies_to = ANY (ARRAY['order'::text, 'subscription'::text])),
    CONSTRAINT coupons_type_check CHECK (type = ANY (ARRAY['fixed'::text, 'percentage'::text])),
    CONSTRAINT coupons_pkey PRIMARY KEY (id),
    CONSTRAINT coupons_tenant_id_code_key UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    appointment_id UUID,
    type TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT credit_transactions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.customer_achievements (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    achievement_id UUID NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT customer_achievements_pkey PRIMARY KEY (id),
    CONSTRAINT customer_achievements_customer_id_achievement_id_key UNIQUE (customer_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS public.customer_credits (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    appointment_id UUID,
    payment_id TEXT,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    used_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    available_amount NUMERIC(10,2) GENERATED ALWAYS AS ((amount - used_amount)) STORED,
    status TEXT NOT NULL DEFAULT 'available'::text,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    credit_type TEXT DEFAULT 'cashback'::text,
    expires_at TIMESTAMPTZ,
    source_payment_id TEXT,
    description TEXT,
    CONSTRAINT customer_credits_pkey PRIMARY KEY (id),
    CONSTRAINT customer_credits_appointment_id_key UNIQUE (appointment_id)
);

CREATE TABLE IF NOT EXISTS public.customer_documents (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    file_url TEXT,
    file_type TEXT,
    category TEXT DEFAULT 'other'::text,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customer_documents_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.customer_interactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    author_id UUID NOT NULL,
    type TEXT NOT NULL DEFAULT 'note'::text,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customer_interactions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'::text,
    payment_method TEXT NOT NULL DEFAULT 'in_person'::text,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + '1 mon'::interval),
    next_billing_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    uses_this_period INTEGER NOT NULL DEFAULT 0,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    external_ref TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paused_at TIMESTAMPTZ,
    pause_reason TEXT,
    pause_until TIMESTAMPTZ,
    resumed_at TIMESTAMPTZ,
    pause_notes TEXT,
    total_paused_days INTEGER NOT NULL DEFAULT 0,
    card_token TEXT,
    card_token_issued_at TIMESTAMPTZ,
    card_token_revoked_at TIMESTAMPTZ,
    coupon_id UUID,
    coupon_code TEXT,
    coupon_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
    coupon_first_month_only BOOLEAN NOT NULL DEFAULT false,
    referral_code TEXT,
    referred_by_code TEXT,
    referred_by_subscription_id UUID,
    provider TEXT,
    provider_customer_id TEXT,
    provider_subscription_id TEXT,
    gateway_id UUID,
    next_payment TIMESTAMPTZ,
    renewal_date TIMESTAMPTZ,
    amount NUMERIC(10,2),
    currency TEXT DEFAULT 'BRL'::text,
    CONSTRAINT customer_subscriptions_status_check CHECK (status = ANY (ARRAY['active'::text, 'pending_payment'::text, 'past_due'::text, 'canceled'::text, 'expired'::text, 'paused'::text])),
    CONSTRAINT customer_subscriptions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.customer_tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    author_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customer_tasks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    cashback_balance NUMERIC NOT NULL DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    credits NUMERIC DEFAULT 0,
    avatar_url TEXT,
    birth_date DATE,
    barber_id UUID,
    birthday_sent BOOLEAN DEFAULT false,
    tenant_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now(),
    credit_balance NUMERIC(10,2) DEFAULT 0,
    total_spent NUMERIC(10,2) DEFAULT 0,
    lifetime_value NUMERIC(10,2) DEFAULT 0,
    last_visit TIMESTAMPTZ,
    credits_used NUMERIC(10,2) DEFAULT 0,
    cashback_used NUMERIC(10,2) DEFAULT 0,
    allow_marketing BOOLEAN NOT NULL DEFAULT false,
    allow_notifications BOOLEAN NOT NULL DEFAULT true,
    privacy_accepted_at TIMESTAMPTZ,
    terms_accepted_at TIMESTAMPTZ,
    deletion_requested_at TIMESTAMPTZ,
    deletion_status TEXT,
    whatsapp_transactional_consent BOOLEAN NOT NULL DEFAULT true,
    whatsapp_marketing_consent BOOLEAN NOT NULL DEFAULT false,
    policy_version_accepted TEXT,
    xp INTEGER DEFAULT 0,
    loyalty_level_id UUID,
    auth_migration_status public.identity_status DEFAULT 'legacy'::identity_status,
    auth_user_id UUID,
    CONSTRAINT customers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID,
    recipient TEXT NOT NULL,
    template_key TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'resend'::text,
    provider_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    attempts INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_code TEXT,
    correlation_id TEXT,
    provider_event_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT email_logs_pkey PRIMARY KEY (id),
    CONSTRAINT email_logs_provider_event_id_key UNIQUE (provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.email_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider TEXT NOT NULL DEFAULT 'resend'::text,
    api_key TEXT,
    sender_email TEXT,
    sender_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT email_settings_pkey PRIMARY KEY (id),
    CONSTRAINT email_settings_tenant_id_key UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.financial_adjustment_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    transaction_id UUID,
    appointment_id UUID,
    old_values JSONB,
    new_values JSONB,
    reason TEXT NOT NULL,
    adjusted_by UUID,
    adjusted_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT financial_adjustment_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.lgpd_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    customer_id UUID,
    user_id UUID,
    request_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response JSONB,
    contact_email TEXT,
    notes TEXT,
    ip TEXT,
    user_agent TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lgpd_requests_request_type_check CHECK (request_type = ANY (ARRAY['export'::text, 'delete'::text, 'anonymize'::text, 'correction'::text])),
    CONSTRAINT lgpd_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'done'::text, 'rejected'::text])),
    CONSTRAINT lgpd_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_achievements (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    xp_reward INTEGER NOT NULL DEFAULT 0,
    category public.loyalty_category NOT NULL DEFAULT 'visit'::loyalty_category,
    requirement_type TEXT NOT NULL,
    requirement_value INTEGER NOT NULL DEFAULT 1,
    hidden_until_unlocked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT loyalty_achievements_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_campaign_participations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    progress JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_value NUMERIC NOT NULL DEFAULT 0,
    target_value NUMERIC,
    unlocked_at TIMESTAMPTZ,
    redeemed_at TIMESTAMPTZ,
    reward_granted JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT loyalty_campaign_participations_pkey PRIMARY KEY (id),
    CONSTRAINT loyalty_campaign_participations_campaign_id_customer_id_key UNIQUE (campaign_id, customer_id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_campaign_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'easy'::text,
    icon TEXT,
    color TEXT,
    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT loyalty_campaign_templates_pkey PRIMARY KEY (id),
    CONSTRAINT loyalty_campaign_templates_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.loyalty_campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_slug TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    status TEXT NOT NULL DEFAULT 'draft'::text,
    rule_type TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    reward JSONB NOT NULL DEFAULT '{}'::jsonb,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    image_url TEXT,
    icon TEXT,
    color TEXT,
    badge TEXT,
    allow_stacking BOOLEAN NOT NULL DEFAULT false,
    allow_combine BOOLEAN NOT NULL DEFAULT false,
    limit_per_customer INTEGER,
    limit_per_campaign INTEGER,
    notify_whatsapp BOOLEAN NOT NULL DEFAULT true,
    notify_email BOOLEAN NOT NULL DEFAULT false,
    notify_push BOOLEAN NOT NULL DEFAULT false,
    notify_portal BOOLEAN NOT NULL DEFAULT true,
    message_template TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT loyalty_campaigns_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_levels (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    min_xp INTEGER NOT NULL DEFAULT 0,
    icon TEXT,
    color TEXT,
    benefits TEXT[],
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT loyalty_levels_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'available'::text,
    appointments_count INTEGER NOT NULL,
    benefit_type TEXT NOT NULL,
    benefit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    benefit_description TEXT NOT NULL DEFAULT ''::text,
    max_benefit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    redeemed_at TIMESTAMPTZ,
    redeemed_appointment_id UUID,
    barbershop_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT loyalty_rewards_status_check CHECK (status = ANY (ARRAY['available'::text, 'redeemed'::text, 'expired'::text, 'canceled'::text])),
    CONSTRAINT loyalty_rewards_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    appointments_required INTEGER NOT NULL DEFAULT 10,
    benefit_type TEXT NOT NULL DEFAULT 'free_service'::text,
    benefit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    benefit_description TEXT NOT NULL DEFAULT 'Serviço grátis'::text,
    max_benefit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    validity_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    premium_enabled BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT loyalty_settings_appointments_required_check CHECK (appointments_required >= 1),
    CONSTRAINT loyalty_settings_benefit_type_check CHECK (benefit_type = ANY (ARRAY['free_service'::text, 'percent_discount'::text, 'fixed_discount'::text, 'free_addon'::text])),
    CONSTRAINT loyalty_settings_validity_days_check CHECK (validity_days >= 0),
    CONSTRAINT loyalty_settings_pkey PRIMARY KEY (id),
    CONSTRAINT loyalty_settings_tenant_id_key UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.marketing_audiences (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_dynamic BOOLEAN DEFAULT true,
    filters JSONB DEFAULT '[]'::jsonb,
    total_count INTEGER DEFAULT 0,
    last_count_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT marketing_audiences_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notification_recipients (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'other'::text,
    phone TEXT,
    email TEXT,
    receive_whatsapp BOOLEAN NOT NULL DEFAULT true,
    receive_email BOOLEAN NOT NULL DEFAULT false,
    receive_panel BOOLEAN NOT NULL DEFAULT true,
    notify_new_appointment BOOLEAN NOT NULL DEFAULT true,
    notify_rescheduled_appointment BOOLEAN NOT NULL DEFAULT true,
    notify_cancelled_appointment BOOLEAN NOT NULL DEFAULT true,
    notify_completed_appointment BOOLEAN NOT NULL DEFAULT false,
    notify_new_subscription BOOLEAN NOT NULL DEFAULT true,
    notify_subscription_cancelled BOOLEAN NOT NULL DEFAULT true,
    notify_payment_received BOOLEAN NOT NULL DEFAULT true,
    notify_payment_failed BOOLEAN NOT NULL DEFAULT true,
    notify_review_received BOOLEAN NOT NULL DEFAULT false,
    notify_bad_review BOOLEAN NOT NULL DEFAULT true,
    notify_support_ticket BOOLEAN NOT NULL DEFAULT false,
    notify_automation_failure BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    barber_id UUID,
    CONSTRAINT notification_recipients_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info'::text,
    read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    barber_id UUID,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    tenant_id UUID,
    customer_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    unique_key TEXT,
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_tenant_type_unique_key_key UNIQUE (tenant_id, type, unique_key)
);

CREATE TABLE IF NOT EXISTS public.observability_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    correlation_id TEXT,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    operation TEXT,
    duration_ms DOUBLE PRECISION,
    metadata JSONB,
    error JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT observability_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.onboarding_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    video_url TEXT,
    message TEXT,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT onboarding_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.operation_locks (
    key TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT operation_locks_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.operational_insights_interactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    rule_key TEXT NOT NULL,
    entity_id TEXT,
    status TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT operational_insights_interactions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payment_gateway_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    gateway_id UUID,
    event TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_gateway_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payment_gateways (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
    methods JSONB NOT NULL DEFAULT '{"pix": true, "cash": false, "in_person": false, "debit_card": false, "credit_card": false, "payment_link": false}'::jsonb,
    pix_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    webhook_url TEXT,
    webhook_secret TEXT,
    environment TEXT NOT NULL DEFAULT 'production'::text,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    status_message TEXT,
    last_sync_at TIMESTAMPTZ,
    last_event_at TIMESTAMPTZ,
    last_payment_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_gateways_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payment_receipts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    appointment_id UUID,
    customer_id UUID,
    method TEXT NOT NULL DEFAULT 'pix'::text,
    amount NUMERIC(12,2),
    file_path TEXT NOT NULL,
    file_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    sent_via_whatsapp BOOLEAN NOT NULL DEFAULT false,
    uploaded_by UUID,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_receipts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT permissions_pkey PRIMARY KEY (id),
    CONSTRAINT permissions_key_key UNIQUE (key)
);

CREATE TABLE IF NOT EXISTS public.plans (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
    price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    slug TEXT,
    tier INTEGER NOT NULL DEFAULT 0,
    allowed_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_barbers INTEGER,
    is_recommended BOOLEAN NOT NULL DEFAULT false,
    automation_limit INTEGER DEFAULT 0,
    stripe_price_id_test TEXT,
    stripe_price_id_live TEXT,
    max_addons INTEGER NOT NULL DEFAULT 3,
    CONSTRAINT plans_pkey PRIMARY KEY (id),
    CONSTRAINT plans_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.privacy_consents (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    customer_id UUID,
    user_id UUID,
    ip TEXT,
    user_agent TEXT,
    accepted_terms BOOLEAN NOT NULL DEFAULT false,
    accepted_privacy BOOLEAN NOT NULL DEFAULT false,
    allow_marketing BOOLEAN NOT NULL DEFAULT false,
    allow_notifications BOOLEAN NOT NULL DEFAULT true,
    source TEXT,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT privacy_consents_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT product_images_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.product_sales (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    customer_id UUID,
    total_amount NUMERIC(10,2) NOT NULL,
    status public.product_sale_status NOT NULL DEFAULT 'completed'::product_sale_status,
    items JSONB NOT NULL,
    pix_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    refund_requested_at TIMESTAMPTZ,
    refund_reason TEXT,
    barber_id UUID,
    tenant_id UUID,
    appointment_id UUID,
    CONSTRAINT check_items_not_empty CHECK (jsonb_array_length(items) > 0),
    CONSTRAINT product_sales_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    slug TEXT,
    short_description TEXT,
    category TEXT,
    brand TEXT,
    promotional_price NUMERIC,
    featured BOOLEAN DEFAULT false,
    badge TEXT,
    CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.professional_time_off (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    professional_id UUID NOT NULL,
    type public.time_off_type NOT NULL DEFAULT 'personal_block'::time_off_type,
    title TEXT,
    description TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT false,
    recurrence_rule TEXT,
    status public.time_off_status NOT NULL DEFAULT 'scheduled'::time_off_status,
    approval_status public.approval_status NOT NULL DEFAULT 'approved'::approval_status,
    requested_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by UUID,
    cancelled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT time_off_dates_check CHECK (starts_at < ends_at),
    CONSTRAINT professional_time_off_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL,
    business_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    plan TEXT DEFAULT 'free'::text,
    whatsapp_number TEXT,
    whatsapp_enabled BOOLEAN DEFAULT false,
    payment_gateway_provider TEXT,
    payment_gateway_key TEXT,
    primary_color TEXT DEFAULT '#7c3aed'::text,
    secondary_color TEXT DEFAULT '#f4f4f5'::text,
    logo_url TEXT,
    slug TEXT,
    scheduling_mode TEXT DEFAULT 'automatic'::text,
    cashback_enabled BOOLEAN NOT NULL DEFAULT false,
    cashback_percentage NUMERIC NOT NULL DEFAULT 0,
    address TEXT,
    google_maps_url TEXT,
    free_service_threshold INTEGER DEFAULT 10,
    font_family TEXT DEFAULT 'Inter'::text,
    font_size TEXT DEFAULT '16px'::text,
    font_color TEXT DEFAULT '#000000'::text,
    role TEXT DEFAULT 'client'::text,
    pix_key TEXT,
    pix_qr_code_url TEXT,
    status TEXT DEFAULT 'active'::text,
    blocked_at TIMESTAMPTZ,
    suspension_reason TEXT,
    tenant_id UUID,
    responsible_name TEXT,
    barbers_range TEXT,
    trial_end TIMESTAMPTZ,
    email TEXT,
    trial_start TIMESTAMPTZ DEFAULT now(),
    effective_plan TEXT DEFAULT 'pro'::text,
    selected_plan TEXT DEFAULT 'free'::text,
    barbershop_logo_url TEXT,
    opening_date DATE,
    cancellation_window_hours INTEGER DEFAULT 2,
    cashback_type TEXT DEFAULT 'percentage'::text,
    cashback_fixed_value NUMERIC(10,2) DEFAULT 0,
    cashback_minimum_amount NUMERIC(10,2) DEFAULT 0,
    cashback_expiration_days INTEGER,
    loyalty_mode TEXT NOT NULL DEFAULT 'none'::text,
    commission_base TEXT NOT NULL DEFAULT 'gross'::text,
    barber_can_cancel BOOLEAN DEFAULT false,
    barber_can_reschedule BOOLEAN DEFAULT false,
    social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
    avatar_url TEXT,
    allow_notifications_on_business_phone BOOLEAN NOT NULL DEFAULT false,
    loyalty_reward_value NUMERIC(10,2) NOT NULL DEFAULT 10.00,
    gallery_images TEXT[] NOT NULL DEFAULT '{}'::text[],
    checkin_token TEXT,
    is_internal_test_tenant BOOLEAN NOT NULL DEFAULT false,
    walkin_send_notifications BOOLEAN NOT NULL DEFAULT false,
    slot_buffer_minutes INTEGER NOT NULL DEFAULT 0,
    portal_before_after JSONB NOT NULL DEFAULT '[]'::jsonb,
    portal_events JSONB NOT NULL DEFAULT '[]'::jsonb,
    portal_partners JSONB NOT NULL DEFAULT '[]'::jsonb,
    identity_status public.identity_status DEFAULT 'legacy'::identity_status,
    display_name TEXT,
    phone TEXT,
    contact_email TEXT,
    CONSTRAINT profiles_loyalty_mode_check CHECK (loyalty_mode = ANY (ARRAY['none'::text, 'cashback'::text, 'loyalty'::text, 'subscription'::text])),
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_checkin_token_key UNIQUE (checkin_token),
    CONSTRAINT profiles_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID,
    customer_phone TEXT,
    tenant_id UUID,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    audience TEXT NOT NULL DEFAULT 'customer'::text,
    active BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
    id BIGINT NOT NULL DEFAULT nextval('rate_limit_hits_id_seq'::regclass),
    bucket TEXT NOT NULL,
    key TEXT NOT NULL,
    hit_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rate_limit_hits_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.reception_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reception_permissions_pkey PRIMARY KEY (id),
    CONSTRAINT reception_permissions_user_id_key UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.refund_audits (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    refund_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    changed_by_id UUID,
    changed_by_type TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT refund_audits_changed_by_type_check CHECK (changed_by_type = ANY (ARRAY['admin'::text, 'system'::text])),
    CONSTRAINT refund_audits_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.refund_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    appointment_id UUID NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_id TEXT,
    refund_method TEXT,
    admin_notes TEXT,
    completed_at TIMESTAMPTZ,
    pix_key TEXT,
    pix_type TEXT,
    holder_name TEXT,
    CONSTRAINT refund_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.resend_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    from_name TEXT NOT NULL DEFAULT 'Barbex'::text,
    from_email TEXT NOT NULL DEFAULT 'noreply@notify.barbex.shop'::text,
    domain TEXT NOT NULL DEFAULT 'notify.barbex.shop'::text,
    is_domain_verified BOOLEAN DEFAULT false,
    last_test_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT resend_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.review_automation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    appointment_id UUID NOT NULL,
    customer_id UUID,
    channel TEXT NOT NULL DEFAULT 'whatsapp'::text,
    status TEXT NOT NULL,
    reason TEXT,
    review_id UUID,
    provider_message_id TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT review_automation_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    role public.app_role NOT NULL,
    permission_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
    CONSTRAINT role_permissions_role_permission_key_key UNIQUE (role, permission_key)
);

CREATE TABLE IF NOT EXISTS public.saas_addons (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    addon_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'gestao'::text,
    icon TEXT,
    module_key TEXT NOT NULL,
    monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL'::text,
    stripe_price_id_test TEXT,
    stripe_price_id_live TEXT,
    minimum_plan TEXT,
    max_quantity INTEGER NOT NULL DEFAULT 1,
    trial_days INTEGER NOT NULL DEFAULT 0,
    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_premium BOOLEAN NOT NULL DEFAULT false,
    annual_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    stripe_product_id_test TEXT,
    stripe_product_id_live TEXT,
    minimum_plan_id UUID,
    CONSTRAINT saas_addons_pkey PRIMARY KEY (id),
    CONSTRAINT saas_addons_addon_key_key UNIQUE (addon_key)
);

CREATE TABLE IF NOT EXISTS public.saas_admin_voucher_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    voucher_id UUID,
    redemption_id UUID,
    tenant_id UUID,
    barbershop_id UUID,
    action TEXT NOT NULL,
    actor_user_id UUID,
    actor_ip TEXT,
    reason TEXT,
    previous_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT saas_admin_voucher_audit_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.saas_admin_voucher_redemptions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    voucher_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    barbershop_id UUID,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    previous_plan_id UUID,
    applied_plan_id UUID,
    covered_addon_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    original_monthly_amount NUMERIC(12,2),
    discount_amount NUMERIC(12,2),
    final_monthly_amount NUMERIC(12,2),
    status TEXT NOT NULL DEFAULT 'pending'::text,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    applied_by UUID,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_by UUID,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT saas_admin_voucher_redemptions_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'failed'::text, 'revoked'::text, 'expired'::text])),
    CONSTRAINT saas_admin_voucher_redemptions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.saas_admin_vouchers (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    purpose TEXT NOT NULL,
    specific_tenant_id UUID,
    specific_barbershop_id UUID,
    allowed_plan_id UUID,
    includes_all_addons BOOLEAN NOT NULL DEFAULT true,
    allowed_addon_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 100,
    duration_type TEXT NOT NULL DEFAULT 'forever'::text,
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    requires_payment_method BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'draft'::text,
    stripe_coupon_id_test TEXT,
    stripe_coupon_id_live TEXT,
    stripe_promotion_code_id_test TEXT,
    stripe_promotion_code_id_live TEXT,
    created_by UUID,
    applied_by UUID,
    applied_at TIMESTAMPTZ,
    revoked_by UUID,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT saas_admin_vouchers_discount_percentage_check CHECK (discount_percentage >= 0::numeric AND discount_percentage <= 100::numeric),
    CONSTRAINT saas_admin_vouchers_duration_type_check CHECK (duration_type = ANY (ARRAY['forever'::text, 'until_date'::text])),
    CONSTRAINT saas_admin_vouchers_purpose_check CHECK (purpose = 'internal_testing'::text),
    CONSTRAINT saas_admin_vouchers_status_check CHECK (status = ANY (ARRAY['draft'::text, 'pending'::text, 'active'::text, 'failed'::text, 'revoked'::text, 'expired'::text])),
    CONSTRAINT saas_admin_vouchers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.saas_billing_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    singleton BOOLEAN NOT NULL DEFAULT true,
    minimum_upgrade_savings NUMERIC(10,2) NOT NULL DEFAULT 5.00,
    upgrade_recommendation_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT saas_billing_settings_pkey PRIMARY KEY (id),
    CONSTRAINT saas_billing_settings_singleton_key UNIQUE (singleton)
);

CREATE TABLE IF NOT EXISTS public.saas_checkout_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    plan_key TEXT NOT NULL,
    stripe_price_id TEXT NOT NULL,
    stripe_checkout_session_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    environment TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT saas_checkout_sessions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.security_activity_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT security_activity_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.service_ratings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    barber_id UUID NOT NULL,
    user_id UUID NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT service_ratings_rating_check CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT service_ratings_pkey PRIMARY KEY (id),
    CONSTRAINT service_ratings_appointment_id_key UNIQUE (appointment_id)
);

CREATE TABLE IF NOT EXISTS public.services (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    tenant_id UUID,
    category TEXT DEFAULT 'Geral'::text,
    CONSTRAINT services_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.status_checks (
    id BIGINT NOT NULL DEFAULT nextval('status_checks_id_seq'::regclass),
    service_id UUID NOT NULL,
    status TEXT NOT NULL,
    latency_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT true,
    message TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT status_checks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.status_incidents (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'minor'::text,
    status TEXT NOT NULL DEFAULT 'investigating'::text,
    affected_services TEXT[] NOT NULL DEFAULT '{}'::text[],
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT status_incidents_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.status_maintenances (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    impact TEXT NOT NULL DEFAULT 'low'::text,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    affected_services TEXT[] NOT NULL DEFAULT '{}'::text[],
    status TEXT NOT NULL DEFAULT 'scheduled'::text,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT status_maintenances_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.status_services (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'core'::text,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    manual_status TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT status_services_pkey PRIMARY KEY (id),
    CONSTRAINT status_services_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.subprocessors (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    purpose TEXT NOT NULL,
    category TEXT NOT NULL,
    country TEXT,
    privacy_url TEXT,
    website_url TEXT,
    logo_url TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subprocessors_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.subscription_card_scans (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID,
    subscription_id UUID,
    scanned_by UUID,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    result TEXT NOT NULL,
    reason TEXT,
    ip TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT subscription_card_scans_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.subscription_invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    payment_method TEXT NOT NULL DEFAULT 'in_person'::text,
    due_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ,
    external_ref TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    coupon_id UUID,
    coupon_code TEXT,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    original_amount NUMERIC(10,2),
    CONSTRAINT subscription_invoices_status_check CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text, 'canceled'::text])),
    CONSTRAINT subscription_invoices_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.subscription_loyalty_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    reward_id UUID NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'granted'::text,
    redeemed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reward_cycle INTEGER NOT NULL DEFAULT 1,
    reward_description TEXT,
    notification_sent BOOLEAN NOT NULL DEFAULT false,
    notification_sent_at TIMESTAMPTZ,
    notification_error TEXT,
    CONSTRAINT subscription_loyalty_history_status_check CHECK (status = ANY (ARRAY['granted'::text, 'redeemed'::text, 'expired'::text, 'cancelled'::text])),
    CONSTRAINT subscription_loyalty_history_pkey PRIMARY KEY (id),
    CONSTRAINT subscription_loyalty_history_unique_cycle UNIQUE (tenant_id, customer_id, subscription_id, reward_id, reward_cycle)
);

CREATE TABLE IF NOT EXISTS public.subscription_loyalty_rewards (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    months_required INTEGER NOT NULL,
    reward_type TEXT NOT NULL,
    reward_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    reward_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscription_loyalty_rewards_months_required_check CHECK (months_required > 0),
    CONSTRAINT subscription_loyalty_rewards_reward_type_check CHECK (reward_type = ANY (ARRAY['free_service'::text, 'cashback'::text, 'credit'::text, 'product'::text, 'discount'::text, 'custom'::text])),
    CONSTRAINT subscription_loyalty_rewards_pkey PRIMARY KEY (id),
    CONSTRAINT subscription_loyalty_rewards_tenant_id_months_required_rewa_key UNIQUE (tenant_id, months_required, reward_type)
);

CREATE TABLE IF NOT EXISTS public.subscription_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    gateway_id UUID,
    provider TEXT NOT NULL,
    provider_payment_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL'::text,
    payment_method TEXT,
    pix_code TEXT,
    pix_qr_code_base64 TEXT,
    invoice_url TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscription_payments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.subscription_plan_benefit_services (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    benefit_id UUID NOT NULL,
    service_id UUID NOT NULL,
    consume_quantity INTEGER NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscription_plan_benefit_services_consume_quantity_check CHECK (consume_quantity > 0),
    CONSTRAINT subscription_plan_benefit_services_pkey PRIMARY KEY (id),
    CONSTRAINT subscription_plan_benefit_services_benefit_id_service_id_key UNIQUE (benefit_id, service_id)
);

CREATE TABLE IF NOT EXISTS public.subscription_plan_benefits (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    benefit_key TEXT NOT NULL,
    benefit_name TEXT NOT NULL,
    monthly_limit INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscription_plan_benefits_monthly_limit_check CHECK (monthly_limit >= 0),
    CONSTRAINT subscription_plan_benefits_pkey PRIMARY KEY (id),
    CONSTRAINT subscription_plan_benefits_plan_id_benefit_key_key UNIQUE (plan_id, benefit_key)
);

CREATE TABLE IF NOT EXISTS public.subscription_plan_changes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    old_plan_id UUID,
    new_plan_id UUID,
    old_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    new_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    days_remaining INTEGER NOT NULL DEFAULT 0,
    days_in_cycle INTEGER NOT NULL DEFAULT 30,
    proration_credit NUMERIC(10,2) NOT NULL DEFAULT 0,
    proration_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    change_type TEXT NOT NULL,
    effective_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    invoice_id UUID,
    credit_transaction_id UUID,
    changed_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscription_plan_changes_change_type_check CHECK (change_type = ANY (ARRAY['upgrade'::text, 'downgrade'::text, 'same'::text])),
    CONSTRAINT subscription_plan_changes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.subscription_plan_services (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    service_id UUID NOT NULL,
    max_uses_per_period INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscription_plan_services_pkey PRIMARY KEY (id),
    CONSTRAINT subscription_plan_services_plan_id_service_id_key UNIQUE (plan_id, service_id)
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    plan_type TEXT NOT NULL DEFAULT 'custom'::text,
    monthly_price NUMERIC(10,2) NOT NULL,
    usage_type TEXT NOT NULL DEFAULT 'unlimited'::text,
    max_uses_per_month INTEGER,
    benefits JSONB NOT NULL DEFAULT '{}'::jsonb,
    payment_methods TEXT[] NOT NULL DEFAULT ARRAY['in_person'::text],
    active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    participates_traditional_loyalty BOOLEAN NOT NULL DEFAULT false,
    participates_cashback BOOLEAN NOT NULL DEFAULT false,
    accumulates_premium_loyalty BOOLEAN NOT NULL DEFAULT true,
    allows_product_discount BOOLEAN NOT NULL DEFAULT false,
    agenda_priority BOOLEAN NOT NULL DEFAULT false,
    exclusive_hours BOOLEAN NOT NULL DEFAULT false,
    exclusive_days BOOLEAN NOT NULL DEFAULT false,
    preferential_service BOOLEAN NOT NULL DEFAULT false,
    included_benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    barber_commission_type TEXT NOT NULL DEFAULT 'fixed'::text,
    barber_commission_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT subscription_plans_barber_commission_type_check CHECK (barber_commission_type = ANY (ARRAY['fixed'::text, 'percent'::text, 'custom'::text, 'none'::text])),
    CONSTRAINT subscription_plans_monthly_price_check CHECK (monthly_price >= 0::numeric),
    CONSTRAINT subscription_plans_plan_type_check CHECK (plan_type = ANY (ARRAY['hair'::text, 'beard'::text, 'hair_beard'::text, 'custom'::text])),
    CONSTRAINT subscription_plans_usage_type_check CHECK (usage_type = ANY (ARRAY['unlimited'::text, 'limited'::text])),
    CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.subscription_referrals (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    referrer_customer_id UUID NOT NULL,
    referrer_subscription_id UUID,
    referred_customer_id UUID NOT NULL,
    subscription_id UUID,
    referral_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    reward_type TEXT NOT NULL DEFAULT 'free_month'::text,
    reward_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    reward_description TEXT,
    reward_granted BOOLEAN NOT NULL DEFAULT false,
    notification_sent BOOLEAN NOT NULL DEFAULT false,
    notification_sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscription_referrals_pkey PRIMARY KEY (id),
    CONSTRAINT subscription_referrals_subscription_id_key UNIQUE (subscription_id)
);

CREATE TABLE IF NOT EXISTS public.subscription_status_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    customer_id UUID,
    old_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT,
    pause_until TIMESTAMPTZ,
    notes TEXT,
    changed_by UUID,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT subscription_status_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.subscription_usage_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    appointment_id UUID,
    used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    customer_id UUID,
    subscription_plan_id UUID,
    service_id UUID,
    benefit_type TEXT NOT NULL DEFAULT 'service'::text,
    covered_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    extra_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    benefit_key TEXT,
    consume_quantity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'consumed'::text,
    CONSTRAINT subscription_usage_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    stripe_subscription_id TEXT NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    price_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'::text,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    environment TEXT NOT NULL DEFAULT 'sandbox'::text,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    billing_status TEXT,
    billing_source TEXT,
    is_internal_test_tenant BOOLEAN NOT NULL DEFAULT false,
    stripe_subscription_status TEXT,
    CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id)
);

CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    ticket_id UUID,
    sender_id UUID,
    message TEXT NOT NULL,
    is_admin_reply BOOLEAN DEFAULT false,
    attachment_url TEXT,
    attachment_urls TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT support_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    barbershop_id UUID,
    user_id UUID,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    priority TEXT DEFAULT 'medium'::text,
    status TEXT DEFAULT 'open'::text,
    attachment_url TEXT,
    attachment_urls TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT support_tickets_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.system_health_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    slack_webhook_url TEXT,
    alert_emails TEXT[],
    deduplication_minutes INTEGER DEFAULT 60,
    notify_on_critical_error BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT system_health_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    saas_name TEXT DEFAULT 'Barber SaaS'::text,
    saas_logo TEXT,
    main_url TEXT,
    maintenance_mode BOOLEAN DEFAULT false,
    stripe_secret_key TEXT,
    stripe_webhook_secret TEXT,
    admin_access_level TEXT DEFAULT 'restricted'::text,
    two_factor_auth_enabled BOOLEAN DEFAULT false,
    audit_logs_enabled BOOLEAN DEFAULT true,
    integrations JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now(),
    payments_test_mode BOOLEAN DEFAULT true,
    public_email TEXT,
    contact_email TEXT,
    phone TEXT,
    whatsapp_number TEXT,
    address TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT system_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.team_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    actor_id UUID,
    event_type TEXT NOT NULL,
    target_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT team_audit_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tenant_addons (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    addon_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL'::text,
    environment TEXT NOT NULL DEFAULT 'sandbox'::text,
    stripe_subscription_id TEXT,
    stripe_subscription_item_id TEXT,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    cancelled_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    trial_ends_at TIMESTAMPTZ,
    trial_used BOOLEAN NOT NULL DEFAULT false,
    payment_failed_count INTEGER NOT NULL DEFAULT 0,
    last_payment_error TEXT,
    last_payment_failed_at TIMESTAMPTZ,
    billing_cycle public.addon_billing_cycle NOT NULL DEFAULT 'monthly'::addon_billing_cycle,
    access_source public.addon_access_source NOT NULL DEFAULT 'addon'::addon_access_source,
    CONSTRAINT tenant_addons_status_check CHECK (status = ANY (ARRAY['pending'::text, 'trialing'::text, 'active'::text, 'past_due'::text, 'cancelled'::text, 'expired'::text])),
    CONSTRAINT tenant_addons_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tenant_integrations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider TEXT NOT NULL,
    credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tenant_integrations_pkey PRIMARY KEY (id),
    CONSTRAINT tenant_integrations_tenant_id_provider_key UNIQUE (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role public.app_role NOT NULL DEFAULT 'barber'::app_role,
    status TEXT NOT NULL DEFAULT 'active'::text,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tenant_memberships_pkey PRIMARY KEY (id),
    CONSTRAINT tenant_memberships_tenant_id_user_id_key UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tenant_webhooks (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    event TEXT NOT NULL DEFAULT 'all'::text,
    secret TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tenant_webhooks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    sender_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ticket_messages_sender_type_check CHECK (sender_type = ANY (ARRAY['barber_admin'::text, 'super_admin'::text])),
    CONSTRAINT ticket_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    appointment_id UUID,
    type TEXT NOT NULL,
    category TEXT,
    amount NUMERIC(10,2) NOT NULL,
    description TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    barber_id UUID,
    time TIME,
    tenant_id UUID,
    payment_method TEXT,
    pix_amount NUMERIC DEFAULT 0,
    cash_amount NUMERIC DEFAULT 0,
    credit_card_amount NUMERIC DEFAULT 0,
    debit_card_amount NUMERIC DEFAULT 0,
    credits_amount NUMERIC DEFAULT 0,
    cashback_amount NUMERIC DEFAULT 0,
    manual_adjustment BOOLEAN DEFAULT false,
    adjusted_by UUID,
    adjusted_at TIMESTAMPTZ,
    adjustment_reason TEXT,
    payment_breakdown JSONB,
    customer_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT transactions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tutorial_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    icon TEXT,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT tutorial_categories_pkey PRIMARY KEY (id),
    CONSTRAINT tutorial_categories_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.tutorials (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category_id UUID,
    type TEXT NOT NULL,
    content_url TEXT,
    thumbnail_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    long_description TEXT,
    level TEXT DEFAULT 'basico'::text,
    estimated_time TEXT DEFAULT '3 min'::text,
    icon TEXT,
    slug TEXT,
    profile_target TEXT[],
    module_key TEXT,
    status TEXT DEFAULT 'published'::text,
    related_route TEXT,
    CONSTRAINT tutorials_level_check CHECK (level = ANY (ARRAY['basico'::text, 'intermediario'::text, 'avancado'::text])),
    CONSTRAINT tutorials_type_check CHECK (type = ANY (ARRAY['video'::text, 'pdf'::text, 'link'::text, 'document'::text])),
    CONSTRAINT tutorials_pkey PRIMARY KEY (id),
    CONSTRAINT tutorials_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.user_invitations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role public.app_role NOT NULL,
    professional_id UUID,
    token_hash TEXT NOT NULL,
    status TEXT DEFAULT 'pending'::text,
    expires_at TIMESTAMPTZ NOT NULL,
    invited_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_invitations_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])),
    CONSTRAINT user_invitations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_mfa_backup_codes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_mfa_backup_codes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_onboarding_preferences (
    user_id UUID NOT NULL,
    show_onboarding BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_onboarding_preferences_pkey PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    step_key TEXT NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_onboarding_progress_pkey PRIMARY KEY (id),
    CONSTRAINT user_onboarding_progress_user_id_tenant_id_step_key_key UNIQUE (user_id, tenant_id, step_key)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role public.app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_roles_pkey PRIMARY KEY (id),
    CONSTRAINT user_roles_user_id_key UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.user_tour_states (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    tour_key TEXT NOT NULL,
    status public.tour_status NOT NULL DEFAULT 'not_started'::tour_status,
    version TEXT NOT NULL,
    last_step_index INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_tour_states_pkey PRIMARY KEY (id),
    CONSTRAINT user_tour_states_user_id_tenant_id_tour_key_key UNIQUE (user_id, tenant_id, tour_key)
);

CREATE TABLE IF NOT EXISTS public.verification_challenges (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    client_id UUID,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    barber_id UUID,
    consumed_at TIMESTAMPTZ,
    CONSTRAINT verification_challenges_target_exclusivity_check CHECK (NOT (client_id IS NOT NULL AND barber_id IS NOT NULL)),
    CONSTRAINT verification_challenges_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.waiting_list (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID,
    customer_name TEXT NOT NULL,
    phone TEXT,
    service_id UUID,
    barber_id UUID,
    preferred_date DATE,
    time_range TEXT,
    priority TEXT NOT NULL DEFAULT 'normal'::text,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'aguardando'::text,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT waiting_list_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.wallet (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    balance NUMERIC NOT NULL DEFAULT 0,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT wallet_pkey PRIMARY KEY (id),
    CONSTRAINT wallet_customer_id_key UNIQUE (customer_id)
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    appointment_id UUID,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT wallet_transactions_type_check CHECK (type = ANY (ARRAY['credit'::text, 'debit'::text])),
    CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    barbershop_id UUID,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT webhook_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_cloud_connections (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    business_name TEXT,
    phone_number TEXT,
    phone_number_id TEXT,
    waba_id TEXT,
    access_token TEXT,
    webhook_verify_token TEXT DEFAULT (gen_random_uuid())::text,
    status TEXT DEFAULT 'pending'::text,
    connected_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT whatsapp_connections_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'disconnected'::text, 'error'::text])),
    CONSTRAINT whatsapp_connections_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    barber_id UUID,
    customer_id UUID,
    appointment_id UUID,
    phone TEXT NOT NULL,
    state TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    appointment_group_id UUID,
    last_action TEXT,
    active BOOLEAN DEFAULT true,
    phone_fallback TEXT,
    CONSTRAINT whatsapp_conversations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_delivery_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    dispatch_id UUID,
    appointment_id UUID,
    status TEXT NOT NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    payload JSONB,
    response JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT whatsapp_delivery_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider TEXT NOT NULL DEFAULT 'z-api'::text,
    instance_id TEXT NOT NULL,
    server_url TEXT NOT NULL,
    token TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected'::text,
    webhook_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    connected BOOLEAN DEFAULT false,
    barber_id UUID,
    client_token TEXT,
    webhook_received_url TEXT,
    webhook_received_configured_at TIMESTAMPTZ,
    webhook_received_last_response JSONB,
    webhook_token TEXT NOT NULL DEFAULT replace((gen_random_uuid())::text, '-'::text, ''::text),
    CONSTRAINT whatsapp_connections_pkey1 PRIMARY KEY (id),
    CONSTRAINT unique_barbershop_whatsapp UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    connection_id UUID,
    customer_id UUID,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    content TEXT,
    wa_id TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    scheduled_for TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT whatsapp_messages_status_check CHECK (status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text])),
    CONSTRAINT whatsapp_messages_type_check CHECK (type = ANY (ARRAY['sent'::text, 'received'::text])),
    CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id),
    CONSTRAINT whatsapp_templates_user_id_event_type_key UNIQUE (user_id, event_type)
);

CREATE TABLE IF NOT EXISTS public.zapi_integration_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    instance_id TEXT,
    action TEXT NOT NULL,
    request_payload JSONB,
    response_payload JSONB,
    status_code INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    endpoint TEXT,
    phone_number TEXT,
    error_message TEXT,
    token_masked TEXT,
    client_token_masked TEXT,
    method TEXT,
    request_body JSONB,
    response_status INTEGER,
    response_body JSONB,
    webhook_url TEXT,
    CONSTRAINT zapi_integration_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.zapi_webhook_debug (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID,
    phone_raw TEXT,
    phone_normalized TEXT,
    message_text TEXT,
    option_id TEXT,
    payload_raw JSONB,
    headers_raw JSONB,
    received_at TIMESTAMPTZ DEFAULT now(),
    processed BOOLEAN DEFAULT false,
    processing_error TEXT,
    matched_conversation_id UUID,
    source TEXT DEFAULT 'real'::text,
    integration_id TEXT,
    method TEXT,
    url TEXT,
    content_type TEXT,
    query_params JSONB,
    path_params JSONB,
    raw_body TEXT,
    CONSTRAINT zapi_webhook_debug_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.zapi_webhook_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    barber_id UUID,
    payload JSONB NOT NULL,
    phone TEXT,
    event_type TEXT,
    processed BOOLEAN DEFAULT false,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ignored BOOLEAN DEFAULT false,
    selected_option TEXT,
    instance_id TEXT,
    status_code INTEGER,
    extracted_phone TEXT,
    extracted_option TEXT,
    type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    phone_raw TEXT,
    phone_normalized_8 TEXT,
    tenant_id UUID,
    button_id TEXT,
    reference_message_id TEXT,
    session_id UUID,
    flow_type public.automation_flow_type,
    CONSTRAINT zapi_webhook_logs_pkey PRIMARY KEY (id)
);

-- ==============================================================================
-- 03.1. SEQUENCE OWNERSHIP (EXACTLY 2 CANONICAL PHYSICAL SEQUENCE OWNERSHIPS)
-- REBUILT DIRECTLY FROM AUTHORITATIVE PHYSICAL SOURCE SEQUENCE CATALOG
-- ==============================================================================
ALTER SEQUENCE public.rate_limit_hits_id_seq OWNED BY public.rate_limit_hits.id;
ALTER SEQUENCE public.status_checks_id_seq OWNED BY public.status_checks.id;

-- ==============================================================================
-- 04. FOREIGN KEY CONSTRAINTS (EXACTLY 279 CANONICAL FOREIGN KEYS)
-- REBUILT DIRECTLY FROM AUTHORITATIVE PHYSICAL SOURCE FK CATALOG
-- ==============================================================================
ALTER TABLE public.academy_lessons
  ADD CONSTRAINT academy_lessons_module_id_fkey
  FOREIGN KEY (module_id)
  REFERENCES public.academy_modules(id)
  ON DELETE CASCADE;

ALTER TABLE public.academy_lessons
  ADD CONSTRAINT academy_lessons_tutorial_id_fkey
  FOREIGN KEY (tutorial_id)
  REFERENCES public.tutorials(id)
  ON DELETE SET NULL;

ALTER TABLE public.academy_modules
  ADD CONSTRAINT academy_modules_path_id_fkey
  FOREIGN KEY (path_id)
  REFERENCES public.academy_paths(id)
  ON DELETE CASCADE;

ALTER TABLE public.academy_paths
  ADD CONSTRAINT academy_paths_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.academy_progress
  ADD CONSTRAINT academy_progress_lesson_id_fkey
  FOREIGN KEY (lesson_id)
  REFERENCES public.academy_lessons(id)
  ON DELETE CASCADE;

ALTER TABLE public.academy_progress
  ADD CONSTRAINT academy_progress_path_id_fkey
  FOREIGN KEY (path_id)
  REFERENCES public.academy_paths(id)
  ON DELETE CASCADE;

ALTER TABLE public.academy_progress
  ADD CONSTRAINT academy_progress_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.academy_progress
  ADD CONSTRAINT academy_progress_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.addon_upgrade_recommendations
  ADD CONSTRAINT addon_upgrade_recommendations_current_plan_id_fkey
  FOREIGN KEY (current_plan_id)
  REFERENCES public.plans(id)
  ON DELETE SET NULL;

ALTER TABLE public.addon_upgrade_recommendations
  ADD CONSTRAINT addon_upgrade_recommendations_recommended_plan_id_fkey
  FOREIGN KEY (recommended_plan_id)
  REFERENCES public.plans(id)
  ON DELETE SET NULL;

ALTER TABLE public.admin_event_subscriptions
  ADD CONSTRAINT admin_event_subscriptions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.admin_event_templates
  ADD CONSTRAINT admin_event_templates_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.ai_settings
  ADD CONSTRAINT ai_settings_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.appointment_checkins
  ADD CONSTRAINT appointment_checkins_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.appointment_groups
  ADD CONSTRAINT appointment_groups_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.appointment_groups
  ADD CONSTRAINT appointment_groups_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.appointment_reviews
  ADD CONSTRAINT appointment_reviews_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.appointment_reviews
  ADD CONSTRAINT appointment_reviews_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE SET NULL;

ALTER TABLE public.appointment_reviews
  ADD CONSTRAINT appointment_reviews_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.appointment_reviews
  ADD CONSTRAINT appointment_reviews_service_id_fkey
  FOREIGN KEY (service_id)
  REFERENCES public.services(id)
  ON DELETE SET NULL;

ALTER TABLE public.appointment_status_logs
  ADD CONSTRAINT appointment_status_logs_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_appointment_group_id_fkey
  FOREIGN KEY (appointment_group_id)
  REFERENCES public.appointment_groups(id)
  ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE CASCADE;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_coupon_id_fkey
  FOREIGN KEY (coupon_id)
  REFERENCES public.coupons(id);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_rescheduled_from_id_fkey
  FOREIGN KEY (rescheduled_from_id)
  REFERENCES public.appointments(id);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_service_id_fkey
  FOREIGN KEY (service_id)
  REFERENCES public.services(id)
  ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_subscription_id_fkey
  FOREIGN KEY (subscription_id)
  REFERENCES public.customer_subscriptions(id)
  ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_subscription_plan_id_fkey
  FOREIGN KEY (subscription_plan_id)
  REFERENCES public.subscription_plans(id)
  ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_tip_barber_id_fkey
  FOREIGN KEY (tip_barber_id)
  REFERENCES public.barbers(id)
  ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_admin_id_fkey
  FOREIGN KEY (admin_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.automation_conversations
  ADD CONSTRAINT automation_conversations_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id);

ALTER TABLE public.automation_conversations
  ADD CONSTRAINT automation_conversations_automation_id_fkey
  FOREIGN KEY (automation_id)
  REFERENCES public.automations(id);

ALTER TABLE public.automation_conversations
  ADD CONSTRAINT automation_conversations_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.automation_conversations
  ADD CONSTRAINT automation_conversations_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.barbershops(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_cron_runs
  ADD CONSTRAINT automation_cron_runs_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id);

ALTER TABLE public.automation_cron_runs
  ADD CONSTRAINT automation_cron_runs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.automation_dispatches
  ADD CONSTRAINT automation_dispatches_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_dispatches
  ADD CONSTRAINT automation_dispatches_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_dispatches
  ADD CONSTRAINT automation_dispatches_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.barbershops(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_interaction_events
  ADD CONSTRAINT automation_interaction_events_interaction_id_fkey
  FOREIGN KEY (interaction_id)
  REFERENCES public.automation_interactions(id)
  ON DELETE SET NULL;

ALTER TABLE public.automation_interaction_events
  ADD CONSTRAINT automation_interaction_events_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_interactions
  ADD CONSTRAINT automation_interactions_automation_id_fkey
  FOREIGN KEY (automation_id)
  REFERENCES public.automations(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_interactions
  ADD CONSTRAINT automation_interactions_automation_template_id_fkey
  FOREIGN KEY (automation_template_id)
  REFERENCES public.automation_templates(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_interactions
  ADD CONSTRAINT automation_interactions_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_logs
  ADD CONSTRAINT automation_logs_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id);

ALTER TABLE public.automation_logs
  ADD CONSTRAINT automation_logs_automation_id_fkey
  FOREIGN KEY (automation_id)
  REFERENCES public.automation_templates(id)
  ON DELETE SET NULL;

ALTER TABLE public.automation_logs
  ADD CONSTRAINT automation_logs_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES auth.users(id);

ALTER TABLE public.automation_logs
  ADD CONSTRAINT automation_logs_conversation_id_fkey
  FOREIGN KEY (conversation_id)
  REFERENCES public.automation_conversations(id)
  ON DELETE SET NULL;

ALTER TABLE public.automation_logs
  ADD CONSTRAINT automation_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_queue
  ADD CONSTRAINT automation_queue_appointment_group_id_fkey
  FOREIGN KEY (appointment_group_id)
  REFERENCES public.appointment_groups(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_queue
  ADD CONSTRAINT automation_queue_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_queue
  ADD CONSTRAINT automation_queue_automation_id_fkey
  FOREIGN KEY (automation_id)
  REFERENCES public.automation_templates(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_queue
  ADD CONSTRAINT automation_queue_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id);

ALTER TABLE public.automation_queue
  ADD CONSTRAINT automation_queue_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_reconciliation_settings
  ADD CONSTRAINT automation_reconciliation_settings_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.automation_send_history
  ADD CONSTRAINT automation_send_history_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id);

ALTER TABLE public.automation_send_history
  ADD CONSTRAINT automation_send_history_conversation_id_fkey
  FOREIGN KEY (conversation_id)
  REFERENCES public.automation_conversations(id);

ALTER TABLE public.automation_send_history
  ADD CONSTRAINT automation_send_history_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.automation_templates
  ADD CONSTRAINT automation_templates_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_templates
  ADD CONSTRAINT automation_templates_wait_timeout_interaction_id_fkey
  FOREIGN KEY (wait_timeout_interaction_id)
  REFERENCES public.automation_interactions(id)
  ON DELETE SET NULL;

ALTER TABLE public.automation_v2_dispatches
  ADD CONSTRAINT automation_v2_dispatches_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_v2_dispatches
  ADD CONSTRAINT automation_v2_dispatches_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id);

ALTER TABLE public.automation_v2_dispatches
  ADD CONSTRAINT automation_v2_dispatches_session_id_fkey
  FOREIGN KEY (session_id)
  REFERENCES public.automation_conversations(id)
  ON DELETE SET NULL;

ALTER TABLE public.automation_v2_dispatches
  ADD CONSTRAINT automation_v2_dispatches_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.barbershops(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_v2_logs
  ADD CONSTRAINT automation_v2_logs_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_v2_logs
  ADD CONSTRAINT automation_v2_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.barbershops(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_v2_sessions
  ADD CONSTRAINT automation_v2_sessions_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_v2_sessions
  ADD CONSTRAINT automation_v2_sessions_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id);

ALTER TABLE public.automation_v2_sessions
  ADD CONSTRAINT automation_v2_sessions_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.barbershops(id)
  ON DELETE CASCADE;

ALTER TABLE public.automation_webhook_logs
  ADD CONSTRAINT automation_webhook_logs_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id);

ALTER TABLE public.automation_webhook_logs
  ADD CONSTRAINT automation_webhook_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.automations
  ADD CONSTRAINT automations_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES auth.users(id);

ALTER TABLE public.automations
  ADD CONSTRAINT automations_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.automations
  ADD CONSTRAINT automations_wait_timeout_interaction_id_fkey
  FOREIGN KEY (wait_timeout_interaction_id)
  REFERENCES public.automation_interactions(id)
  ON DELETE SET NULL;

ALTER TABLE public.background_jobs
  ADD CONSTRAINT background_jobs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.barber_services
  ADD CONSTRAINT barber_services_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE CASCADE;

ALTER TABLE public.barber_services
  ADD CONSTRAINT barber_services_service_id_fkey
  FOREIGN KEY (service_id)
  REFERENCES public.services(id)
  ON DELETE CASCADE;

ALTER TABLE public.barber_services
  ADD CONSTRAINT barber_services_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES auth.users(id);

ALTER TABLE public.barber_services
  ADD CONSTRAINT barber_services_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.barber_tips
  ADD CONSTRAINT barber_tips_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE SET NULL;

ALTER TABLE public.barber_tips
  ADD CONSTRAINT barber_tips_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE CASCADE;

ALTER TABLE public.barber_tips
  ADD CONSTRAINT barber_tips_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.barbers
  ADD CONSTRAINT barbers_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.barbers
  ADD CONSTRAINT barbers_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.barbershop_settings
  ADD CONSTRAINT barbershop_settings_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.barbershops
  ADD CONSTRAINT barbershops_owner_id_fkey
  FOREIGN KEY (owner_id)
  REFERENCES auth.users(id);

ALTER TABLE public.barbershops
  ADD CONSTRAINT barbershops_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES public.plans(id);

ALTER TABLE public.campaign_logs
  ADD CONSTRAINT campaign_logs_campaign_id_fkey
  FOREIGN KEY (campaign_id)
  REFERENCES public.campaigns(id)
  ON DELETE CASCADE;

ALTER TABLE public.campaign_logs
  ADD CONSTRAINT campaign_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.cashback_transactions
  ADD CONSTRAINT cashback_transactions_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE SET NULL;

ALTER TABLE public.cashback_transactions
  ADD CONSTRAINT cashback_transactions_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.client_auth
  ADD CONSTRAINT client_auth_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.communication_channels
  ADD CONSTRAINT communication_channels_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.communication_messages
  ADD CONSTRAINT communication_messages_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.communication_messages
  ADD CONSTRAINT communication_messages_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.communication_templates
  ADD CONSTRAINT communication_templates_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.cookie_consents
  ADD CONSTRAINT cookie_consents_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.cookie_consents
  ADD CONSTRAINT cookie_consents_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE SET NULL;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.customer_achievements
  ADD CONSTRAINT customer_achievements_achievement_id_fkey
  FOREIGN KEY (achievement_id)
  REFERENCES public.loyalty_achievements(id)
  ON DELETE CASCADE;

ALTER TABLE public.customer_achievements
  ADD CONSTRAINT customer_achievements_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.customer_credits
  ADD CONSTRAINT customer_credits_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id);

ALTER TABLE public.customer_credits
  ADD CONSTRAINT customer_credits_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id);

ALTER TABLE public.customer_credits
  ADD CONSTRAINT customer_credits_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.customer_documents
  ADD CONSTRAINT customer_documents_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.customer_documents
  ADD CONSTRAINT customer_documents_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.customer_interactions
  ADD CONSTRAINT customer_interactions_author_id_fkey
  FOREIGN KEY (author_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.customer_interactions
  ADD CONSTRAINT customer_interactions_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.customer_interactions
  ADD CONSTRAINT customer_interactions_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.customer_subscriptions
  ADD CONSTRAINT customer_subscriptions_coupon_id_fkey
  FOREIGN KEY (coupon_id)
  REFERENCES public.coupons(id)
  ON DELETE SET NULL;

ALTER TABLE public.customer_subscriptions
  ADD CONSTRAINT customer_subscriptions_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.customer_subscriptions
  ADD CONSTRAINT customer_subscriptions_gateway_id_fkey
  FOREIGN KEY (gateway_id)
  REFERENCES public.payment_gateways(id)
  ON DELETE SET NULL;

ALTER TABLE public.customer_subscriptions
  ADD CONSTRAINT customer_subscriptions_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES public.subscription_plans(id)
  ON DELETE RESTRICT;

ALTER TABLE public.customer_subscriptions
  ADD CONSTRAINT customer_subscriptions_referred_by_subscription_id_fkey
  FOREIGN KEY (referred_by_subscription_id)
  REFERENCES public.customer_subscriptions(id)
  ON DELETE SET NULL;

ALTER TABLE public.customer_tasks
  ADD CONSTRAINT customer_tasks_author_id_fkey
  FOREIGN KEY (author_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.customer_tasks
  ADD CONSTRAINT customer_tasks_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.customer_tasks
  ADD CONSTRAINT customer_tasks_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_auth_user_id_fkey
  FOREIGN KEY (auth_user_id)
  REFERENCES auth.users(id);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_loyalty_level_id_fkey
  FOREIGN KEY (loyalty_level_id)
  REFERENCES public.loyalty_levels(id);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.email_settings
  ADD CONSTRAINT email_settings_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.financial_adjustment_logs
  ADD CONSTRAINT financial_adjustment_logs_adjusted_by_fkey
  FOREIGN KEY (adjusted_by)
  REFERENCES auth.users(id);

ALTER TABLE public.financial_adjustment_logs
  ADD CONSTRAINT financial_adjustment_logs_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id);

ALTER TABLE public.financial_adjustment_logs
  ADD CONSTRAINT financial_adjustment_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.barbershops(id);

ALTER TABLE public.financial_adjustment_logs
  ADD CONSTRAINT financial_adjustment_logs_transaction_id_fkey
  FOREIGN KEY (transaction_id)
  REFERENCES public.transactions(id);

ALTER TABLE public.lgpd_requests
  ADD CONSTRAINT lgpd_requests_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.lgpd_requests
  ADD CONSTRAINT lgpd_requests_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.loyalty_campaign_participations
  ADD CONSTRAINT loyalty_campaign_participations_campaign_id_fkey
  FOREIGN KEY (campaign_id)
  REFERENCES public.loyalty_campaigns(id)
  ON DELETE CASCADE;

ALTER TABLE public.loyalty_campaigns
  ADD CONSTRAINT loyalty_campaigns_template_slug_fkey
  FOREIGN KEY (template_slug)
  REFERENCES public.loyalty_campaign_templates(slug)
  ON DELETE SET NULL;

ALTER TABLE public.loyalty_rewards
  ADD CONSTRAINT loyalty_rewards_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.marketing_audiences
  ADD CONSTRAINT marketing_audiences_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.notification_recipients
  ADD CONSTRAINT notification_recipients_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id);

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.observability_logs
  ADD CONSTRAINT observability_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.operational_insights_interactions
  ADD CONSTRAINT operational_insights_interactions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.payment_gateway_logs
  ADD CONSTRAINT payment_gateway_logs_gateway_id_fkey
  FOREIGN KEY (gateway_id)
  REFERENCES public.payment_gateways(id)
  ON DELETE CASCADE;

ALTER TABLE public.payment_receipts
  ADD CONSTRAINT payment_receipts_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.privacy_consents
  ADD CONSTRAINT privacy_consents_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.product_images
  ADD CONSTRAINT product_images_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE CASCADE;

ALTER TABLE public.product_sales
  ADD CONSTRAINT product_sales_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE SET NULL;

ALTER TABLE public.product_sales
  ADD CONSTRAINT product_sales_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id);

ALTER TABLE public.product_sales
  ADD CONSTRAINT product_sales_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id);

ALTER TABLE public.product_sales
  ADD CONSTRAINT product_sales_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.product_sales
  ADD CONSTRAINT product_sales_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id);

ALTER TABLE public.products
  ADD CONSTRAINT products_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.professional_time_off
  ADD CONSTRAINT professional_time_off_approved_by_fkey
  FOREIGN KEY (approved_by)
  REFERENCES auth.users(id);

ALTER TABLE public.professional_time_off
  ADD CONSTRAINT professional_time_off_cancelled_by_fkey
  FOREIGN KEY (cancelled_by)
  REFERENCES auth.users(id);

ALTER TABLE public.professional_time_off
  ADD CONSTRAINT professional_time_off_professional_id_fkey
  FOREIGN KEY (professional_id)
  REFERENCES public.barbers(id)
  ON DELETE CASCADE;

ALTER TABLE public.professional_time_off
  ADD CONSTRAINT professional_time_off_requested_by_fkey
  FOREIGN KEY (requested_by)
  REFERENCES auth.users(id);

ALTER TABLE public.professional_time_off
  ADD CONSTRAINT professional_time_off_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.refund_audits
  ADD CONSTRAINT refund_audits_refund_id_fkey
  FOREIGN KEY (refund_id)
  REFERENCES public.refund_requests(id)
  ON DELETE CASCADE;

ALTER TABLE public.refund_audits
  ADD CONSTRAINT refund_audits_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.refund_requests
  ADD CONSTRAINT refund_requests_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.refund_requests
  ADD CONSTRAINT refund_requests_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.review_automation_logs
  ADD CONSTRAINT review_automation_logs_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.review_automation_logs
  ADD CONSTRAINT review_automation_logs_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.review_automation_logs
  ADD CONSTRAINT review_automation_logs_review_id_fkey
  FOREIGN KEY (review_id)
  REFERENCES public.appointment_reviews(id)
  ON DELETE SET NULL;

ALTER TABLE public.review_automation_logs
  ADD CONSTRAINT review_automation_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_permission_key_fkey
  FOREIGN KEY (permission_key)
  REFERENCES public.permissions(key)
  ON DELETE CASCADE;

ALTER TABLE public.saas_addons
  ADD CONSTRAINT saas_addons_minimum_plan_id_fkey
  FOREIGN KEY (minimum_plan_id)
  REFERENCES public.plans(id)
  ON DELETE SET NULL;

ALTER TABLE public.saas_admin_voucher_audit_logs
  ADD CONSTRAINT saas_admin_voucher_audit_logs_actor_user_id_fkey
  FOREIGN KEY (actor_user_id)
  REFERENCES auth.users(id);

ALTER TABLE public.saas_admin_voucher_audit_logs
  ADD CONSTRAINT saas_admin_voucher_audit_logs_barbershop_id_fkey
  FOREIGN KEY (barbershop_id)
  REFERENCES public.barbershops(id)
  ON DELETE SET NULL;

ALTER TABLE public.saas_admin_voucher_audit_logs
  ADD CONSTRAINT saas_admin_voucher_audit_logs_redemption_id_fkey
  FOREIGN KEY (redemption_id)
  REFERENCES public.saas_admin_voucher_redemptions(id)
  ON DELETE SET NULL;

ALTER TABLE public.saas_admin_voucher_audit_logs
  ADD CONSTRAINT saas_admin_voucher_audit_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.saas_admin_voucher_audit_logs
  ADD CONSTRAINT saas_admin_voucher_audit_logs_voucher_id_fkey
  FOREIGN KEY (voucher_id)
  REFERENCES public.saas_admin_vouchers(id)
  ON DELETE SET NULL;

ALTER TABLE public.saas_admin_voucher_redemptions
  ADD CONSTRAINT saas_admin_voucher_redemptions_applied_by_fkey
  FOREIGN KEY (applied_by)
  REFERENCES auth.users(id);

ALTER TABLE public.saas_admin_voucher_redemptions
  ADD CONSTRAINT saas_admin_voucher_redemptions_applied_plan_id_fkey
  FOREIGN KEY (applied_plan_id)
  REFERENCES public.plans(id);

ALTER TABLE public.saas_admin_voucher_redemptions
  ADD CONSTRAINT saas_admin_voucher_redemptions_barbershop_id_fkey
  FOREIGN KEY (barbershop_id)
  REFERENCES public.barbershops(id)
  ON DELETE SET NULL;

ALTER TABLE public.saas_admin_voucher_redemptions
  ADD CONSTRAINT saas_admin_voucher_redemptions_previous_plan_id_fkey
  FOREIGN KEY (previous_plan_id)
  REFERENCES public.plans(id);

ALTER TABLE public.saas_admin_voucher_redemptions
  ADD CONSTRAINT saas_admin_voucher_redemptions_revoked_by_fkey
  FOREIGN KEY (revoked_by)
  REFERENCES auth.users(id);

ALTER TABLE public.saas_admin_voucher_redemptions
  ADD CONSTRAINT saas_admin_voucher_redemptions_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.saas_admin_voucher_redemptions
  ADD CONSTRAINT saas_admin_voucher_redemptions_voucher_id_fkey
  FOREIGN KEY (voucher_id)
  REFERENCES public.saas_admin_vouchers(id)
  ON DELETE CASCADE;

ALTER TABLE public.saas_admin_vouchers
  ADD CONSTRAINT saas_admin_vouchers_allowed_plan_id_fkey
  FOREIGN KEY (allowed_plan_id)
  REFERENCES public.plans(id)
  ON DELETE SET NULL;

ALTER TABLE public.saas_admin_vouchers
  ADD CONSTRAINT saas_admin_vouchers_applied_by_fkey
  FOREIGN KEY (applied_by)
  REFERENCES auth.users(id);

ALTER TABLE public.saas_admin_vouchers
  ADD CONSTRAINT saas_admin_vouchers_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id);

ALTER TABLE public.saas_admin_vouchers
  ADD CONSTRAINT saas_admin_vouchers_revoked_by_fkey
  FOREIGN KEY (revoked_by)
  REFERENCES auth.users(id);

ALTER TABLE public.saas_admin_vouchers
  ADD CONSTRAINT saas_admin_vouchers_specific_barbershop_id_fkey
  FOREIGN KEY (specific_barbershop_id)
  REFERENCES public.barbershops(id)
  ON DELETE CASCADE;

ALTER TABLE public.saas_admin_vouchers
  ADD CONSTRAINT saas_admin_vouchers_specific_tenant_id_fkey
  FOREIGN KEY (specific_tenant_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.saas_checkout_sessions
  ADD CONSTRAINT saas_checkout_sessions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.security_activity_logs
  ADD CONSTRAINT security_activity_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.service_ratings
  ADD CONSTRAINT service_ratings_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.service_ratings
  ADD CONSTRAINT service_ratings_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE CASCADE;

ALTER TABLE public.service_ratings
  ADD CONSTRAINT service_ratings_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.service_ratings
  ADD CONSTRAINT service_ratings_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.services
  ADD CONSTRAINT services_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.services
  ADD CONSTRAINT services_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.status_checks
  ADD CONSTRAINT status_checks_service_id_fkey
  FOREIGN KEY (service_id)
  REFERENCES public.status_services(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_card_scans
  ADD CONSTRAINT subscription_card_scans_subscription_id_fkey
  FOREIGN KEY (subscription_id)
  REFERENCES public.customer_subscriptions(id)
  ON DELETE SET NULL;

ALTER TABLE public.subscription_invoices
  ADD CONSTRAINT subscription_invoices_coupon_id_fkey
  FOREIGN KEY (coupon_id)
  REFERENCES public.coupons(id)
  ON DELETE SET NULL;

ALTER TABLE public.subscription_invoices
  ADD CONSTRAINT subscription_invoices_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_invoices
  ADD CONSTRAINT subscription_invoices_subscription_id_fkey
  FOREIGN KEY (subscription_id)
  REFERENCES public.customer_subscriptions(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_loyalty_history
  ADD CONSTRAINT subscription_loyalty_history_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_loyalty_history
  ADD CONSTRAINT subscription_loyalty_history_reward_id_fkey
  FOREIGN KEY (reward_id)
  REFERENCES public.subscription_loyalty_rewards(id)
  ON DELETE RESTRICT;

ALTER TABLE public.subscription_loyalty_history
  ADD CONSTRAINT subscription_loyalty_history_subscription_id_fkey
  FOREIGN KEY (subscription_id)
  REFERENCES public.customer_subscriptions(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_payments
  ADD CONSTRAINT subscription_payments_gateway_id_fkey
  FOREIGN KEY (gateway_id)
  REFERENCES public.payment_gateways(id)
  ON DELETE SET NULL;

ALTER TABLE public.subscription_payments
  ADD CONSTRAINT subscription_payments_subscription_id_fkey
  FOREIGN KEY (subscription_id)
  REFERENCES public.customer_subscriptions(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_plan_benefit_services
  ADD CONSTRAINT subscription_plan_benefit_services_benefit_id_fkey
  FOREIGN KEY (benefit_id)
  REFERENCES public.subscription_plan_benefits(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_plan_benefit_services
  ADD CONSTRAINT subscription_plan_benefit_services_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES public.subscription_plans(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_plan_benefit_services
  ADD CONSTRAINT subscription_plan_benefit_services_service_id_fkey
  FOREIGN KEY (service_id)
  REFERENCES public.services(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_plan_benefits
  ADD CONSTRAINT subscription_plan_benefits_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES public.subscription_plans(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_plan_changes
  ADD CONSTRAINT subscription_plan_changes_subscription_id_fkey
  FOREIGN KEY (subscription_id)
  REFERENCES public.customer_subscriptions(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_plan_services
  ADD CONSTRAINT subscription_plan_services_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES public.subscription_plans(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_plan_services
  ADD CONSTRAINT subscription_plan_services_service_id_fkey
  FOREIGN KEY (service_id)
  REFERENCES public.services(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_referrals
  ADD CONSTRAINT subscription_referrals_referred_customer_id_fkey
  FOREIGN KEY (referred_customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_referrals
  ADD CONSTRAINT subscription_referrals_referrer_customer_id_fkey
  FOREIGN KEY (referrer_customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_referrals
  ADD CONSTRAINT subscription_referrals_referrer_subscription_id_fkey
  FOREIGN KEY (referrer_subscription_id)
  REFERENCES public.customer_subscriptions(id)
  ON DELETE SET NULL;

ALTER TABLE public.subscription_referrals
  ADD CONSTRAINT subscription_referrals_subscription_id_fkey
  FOREIGN KEY (subscription_id)
  REFERENCES public.customer_subscriptions(id)
  ON DELETE SET NULL;

ALTER TABLE public.subscription_status_logs
  ADD CONSTRAINT subscription_status_logs_subscription_id_fkey
  FOREIGN KEY (subscription_id)
  REFERENCES public.customer_subscriptions(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_usage_logs
  ADD CONSTRAINT subscription_usage_logs_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_usage_logs
  ADD CONSTRAINT subscription_usage_logs_service_id_fkey
  FOREIGN KEY (service_id)
  REFERENCES public.services(id)
  ON DELETE SET NULL;

ALTER TABLE public.subscription_usage_logs
  ADD CONSTRAINT subscription_usage_logs_subscription_id_fkey
  FOREIGN KEY (subscription_id)
  REFERENCES public.customer_subscriptions(id)
  ON DELETE CASCADE;

ALTER TABLE public.subscription_usage_logs
  ADD CONSTRAINT subscription_usage_logs_subscription_plan_id_fkey
  FOREIGN KEY (subscription_plan_id)
  REFERENCES public.subscription_plans(id)
  ON DELETE SET NULL;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_sender_id_fkey
  FOREIGN KEY (sender_id)
  REFERENCES auth.users(id);

ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_ticket_id_fkey
  FOREIGN KEY (ticket_id)
  REFERENCES public.support_tickets(id)
  ON DELETE CASCADE;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_barbershop_id_fkey
  FOREIGN KEY (barbershop_id)
  REFERENCES public.barbershops(id)
  ON DELETE CASCADE;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id);

ALTER TABLE public.team_audit_logs
  ADD CONSTRAINT team_audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id)
  REFERENCES auth.users(id);

ALTER TABLE public.team_audit_logs
  ADD CONSTRAINT team_audit_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.tenant_addons
  ADD CONSTRAINT tenant_addons_addon_id_fkey
  FOREIGN KEY (addon_id)
  REFERENCES public.saas_addons(id)
  ON DELETE RESTRICT;

ALTER TABLE public.tenant_memberships
  ADD CONSTRAINT tenant_memberships_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.tenant_memberships
  ADD CONSTRAINT tenant_memberships_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.ticket_messages
  ADD CONSTRAINT ticket_messages_ticket_id_fkey
  FOREIGN KEY (ticket_id)
  REFERENCES public.support_tickets(id)
  ON DELETE CASCADE;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_adjusted_by_fkey
  FOREIGN KEY (adjusted_by)
  REFERENCES auth.users(id);

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE SET NULL;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id);

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id);

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.tutorials
  ADD CONSTRAINT tutorials_category_id_fkey
  FOREIGN KEY (category_id)
  REFERENCES public.tutorial_categories(id);

ALTER TABLE public.user_invitations
  ADD CONSTRAINT user_invitations_invited_by_fkey
  FOREIGN KEY (invited_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.user_invitations
  ADD CONSTRAINT user_invitations_professional_id_fkey
  FOREIGN KEY (professional_id)
  REFERENCES public.barbers(id)
  ON DELETE SET NULL;

ALTER TABLE public.user_invitations
  ADD CONSTRAINT user_invitations_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.user_mfa_backup_codes
  ADD CONSTRAINT user_mfa_backup_codes_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.user_onboarding_preferences
  ADD CONSTRAINT user_onboarding_preferences_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id);

ALTER TABLE public.user_onboarding_progress
  ADD CONSTRAINT user_onboarding_progress_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.user_tour_states
  ADD CONSTRAINT user_tour_states_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.verification_challenges
  ADD CONSTRAINT verification_challenges_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE CASCADE;

ALTER TABLE public.verification_challenges
  ADD CONSTRAINT verification_challenges_client_id_fkey
  FOREIGN KEY (client_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.waiting_list
  ADD CONSTRAINT waiting_list_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE SET NULL;

ALTER TABLE public.waiting_list
  ADD CONSTRAINT waiting_list_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.waiting_list
  ADD CONSTRAINT waiting_list_service_id_fkey
  FOREIGN KEY (service_id)
  REFERENCES public.services(id)
  ON DELETE SET NULL;

ALTER TABLE public.wallet
  ADD CONSTRAINT wallet_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE SET NULL;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_wallet_id_fkey
  FOREIGN KEY (wallet_id)
  REFERENCES public.wallet(id)
  ON DELETE CASCADE;

ALTER TABLE public.webhook_logs
  ADD CONSTRAINT webhook_logs_barbershop_id_fkey
  FOREIGN KEY (barbershop_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.whatsapp_cloud_connections
  ADD CONSTRAINT whatsapp_connections_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE CASCADE;

ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;

ALTER TABLE public.whatsapp_delivery_logs
  ADD CONSTRAINT whatsapp_delivery_logs_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE SET NULL;

ALTER TABLE public.whatsapp_delivery_logs
  ADD CONSTRAINT whatsapp_delivery_logs_dispatch_id_fkey
  FOREIGN KEY (dispatch_id)
  REFERENCES public.automation_v2_dispatches(id)
  ON DELETE CASCADE;

ALTER TABLE public.whatsapp_delivery_logs
  ADD CONSTRAINT whatsapp_delivery_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES auth.users(id);

ALTER TABLE public.whatsapp_instances
  ADD CONSTRAINT whatsapp_connections_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES auth.users(id);

ALTER TABLE public.whatsapp_instances
  ADD CONSTRAINT whatsapp_connections_barbershop_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_connection_id_fkey
  FOREIGN KEY (connection_id)
  REFERENCES public.whatsapp_instances(id)
  ON DELETE SET NULL;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.zapi_integration_logs
  ADD CONSTRAINT zapi_integration_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

ALTER TABLE public.zapi_webhook_debug
  ADD CONSTRAINT zapi_webhook_debug_matched_conversation_id_fkey
  FOREIGN KEY (matched_conversation_id)
  REFERENCES public.automation_conversations(id)
  ON DELETE SET NULL;

ALTER TABLE public.zapi_webhook_debug
  ADD CONSTRAINT zapi_webhook_debug_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.barbershops(id)
  ON DELETE CASCADE;

ALTER TABLE public.zapi_webhook_logs
  ADD CONSTRAINT zapi_webhook_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.profiles(id);

-- ==============================================================================
-- 05. INDEXES (EXACTLY 225 STANDALONE PHYSICAL INDEXES + 159 PK + 58 UNIQUE = 442 INDEXES)
-- REBUILT DIRECTLY FROM AUTHORITATIVE PHYSICAL SOURCE INDEX CATALOG
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_addon_upgrade_rec_created ON public.addon_upgrade_recommendations USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_addon_upgrade_rec_tenant ON public.addon_upgrade_recommendations USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_event_log_event_key ON public.admin_event_log USING btree (event_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_event_log_tenant ON public.admin_event_log USING btree (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_event_key ON public.admin_notifications USING btree (event_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority ON public.admin_notifications USING btree (priority);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON public.admin_notifications USING btree (is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointment_reviews_barber ON public.appointment_reviews USING btree (barber_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reviews_status ON public.appointment_reviews USING btree (testimonial_status);
CREATE INDEX IF NOT EXISTS idx_appointment_reviews_tenant ON public.appointment_reviews USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reviews_token ON public.appointment_reviews USING btree (review_token) WHERE (review_token IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS appointments_management_token_idx ON public.appointments USING btree (management_token);
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_sent ON public.appointments USING btree (confirmation_sent);
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_sent_at ON public.appointments USING btree (confirmation_sent_at);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON public.appointments USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_group_id ON public.appointments USING btree (appointment_group_id);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_sent ON public.appointments USING btree (reminder_sent);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_sent_at ON public.appointments USING btree (reminder_sent_at);
CREATE INDEX IF NOT EXISTS idx_appointments_review_decision ON public.appointments USING btree (review_decision);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON public.appointments USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status ON public.appointments USING btree (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_type_tenant ON public.appointments USING btree (tenant_id, appointment_type, status);
CREATE INDEX IF NOT EXISTS idx_appointments_walkin_barber_time ON public.appointments USING btree (barber_id, start_time) WHERE (appointment_type = 'walk_in'::text);
CREATE INDEX IF NOT EXISTS idx_appts_subscription ON public.appointments USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_automation_conv_phone ON public.automation_conversations USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_automation_conv_tenant ON public.automation_conversations USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_disp_status ON public.automation_dispatches USING btree (status);
CREATE INDEX IF NOT EXISTS idx_automation_disp_tenant ON public.automation_dispatches USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_interaction_events_dispatch ON public.automation_interaction_events USING btree (dispatch_id);
CREATE INDEX IF NOT EXISTS idx_automation_interaction_events_interaction ON public.automation_interaction_events USING btree (interaction_id);
CREATE INDEX IF NOT EXISTS idx_automation_interaction_events_tenant ON public.automation_interaction_events USING btree (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_interaction_events_workflow ON public.automation_interaction_events USING btree (workflow_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_interactions_automation ON public.automation_interactions USING btree (automation_id) WHERE (automation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_automation_interactions_template ON public.automation_interactions USING btree (automation_template_id) WHERE (automation_template_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_automation_interactions_tenant ON public.automation_interactions USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_conv ON public.automation_logs USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON public.automation_logs USING btree (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_logs_idempotency ON public.automation_logs USING btree (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_automation_logs_provider_message_id ON public.automation_logs USING btree (provider_message_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_tenant ON public.automation_logs USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_tenant_created ON public.automation_logs USING btree (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_tenant_id ON public.automation_logs USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_queue_idempotency ON public.automation_queue USING btree (idempotency_key) WHERE (status <> 'error'::text);
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_queue_reminders ON public.automation_queue USING btree (tenant_id, appointment_id, workflow_key, scheduled_for) WHERE (appointment_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_queue_unique_confirmation ON public.automation_queue USING btree (appointment_id, workflow_key) WHERE ((workflow_key = 'appointment_confirmation'::text) AND (status = ANY (ARRAY['pending'::text, 'processing'::text, 'success'::text])));
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_birthday_per_year ON public.automation_queue USING btree (tenant_id, customer_id, reference_year) WHERE (workflow_key = 'customer_birthday'::text);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_birthday_queue_per_year ON public.automation_queue USING btree (tenant_id, customer_id, workflow_key, reference_year) WHERE ((workflow_key = 'customer_birthday'::text) AND (reference_year IS NOT NULL) AND (customer_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_automation_templates_tenant_event ON public.automation_templates USING btree (tenant_id, trigger_event) WHERE (active = true);
CREATE UNIQUE INDEX IF NOT EXISTS idx_anniversary_uniqueness ON public.automation_v2_dispatches USING btree (tenant_id, customer_id, workflow_key, anniversary_year, anniversary_message_type) WHERE (workflow_key = 'barbershop_anniversary'::text);
CREATE INDEX IF NOT EXISTS idx_auto_v2_disp_appt ON public.automation_v2_dispatches USING btree (appointment_id);
CREATE INDEX IF NOT EXISTS idx_auto_v2_disp_created ON public.automation_v2_dispatches USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_auto_v2_disp_msg ON public.automation_v2_dispatches USING btree (message_id);
CREATE INDEX IF NOT EXISTS idx_auto_v2_disp_tenant ON public.automation_v2_dispatches USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_birthday_dispatch_per_year ON public.automation_v2_dispatches USING btree (tenant_id, customer_id, workflow_key, birthday_year) WHERE ((workflow_key = 'customer_birthday'::text) AND (birthday_year IS NOT NULL) AND (customer_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_avail_conflict_logs_tenant_created ON public.availability_conflict_logs USING btree (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bg_jobs_status_next_run ON public.background_jobs USING btree (status, next_run_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry'::text]));
CREATE INDEX IF NOT EXISTS idx_bg_jobs_tenant_id ON public.background_jobs USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_appointment ON public.barber_commissions USING btree (appointment_id);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_created_at ON public.barber_commissions USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_tenant_barber_status ON public.barber_commissions USING btree (tenant_id, barber_id, status);
CREATE INDEX IF NOT EXISTS idx_barber_services_barber_id ON public.barber_services USING btree (barber_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_service_id ON public.barber_services USING btree (service_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_tenant_id ON public.barber_services USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_user_id ON public.barber_services USING btree (user_id);
CREATE INDEX IF NOT EXISTS barber_tips_barber_idx ON public.barber_tips USING btree (barber_id, created_at DESC);
CREATE INDEX IF NOT EXISTS barber_tips_tenant_idx ON public.barber_tips USING btree (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_barbers_tenant_id ON public.barbers USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_barbershop_module_logs_tenant ON public.barbershop_module_logs USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_barbershop_modules_tenant ON public.barbershop_modules USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_auth_customer_id ON public.client_auth USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_client_auth_phone ON public.client_auth USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_commission_closings_barber ON public.commission_closings USING btree (barber_id);
CREATE INDEX IF NOT EXISTS idx_commission_closings_tenant ON public.commission_closings USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_entries_barber ON public.commission_entries USING btree (barber_id);
CREATE INDEX IF NOT EXISTS idx_commission_entries_earned_at ON public.commission_entries USING btree (earned_at);
CREATE INDEX IF NOT EXISTS idx_commission_entries_status ON public.commission_entries USING btree (status);
CREATE INDEX IF NOT EXISTS idx_commission_entries_tenant ON public.commission_entries USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consents_created ON public.cookie_consents USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cookie_consents_customer ON public.cookie_consents USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consents_tenant ON public.cookie_consents USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_coupons_applies_to ON public.coupons USING btree (tenant_id, applies_to, active);
CREATE UNIQUE INDEX IF NOT EXISTS unique_credit_used_per_appointment ON public.credit_transactions USING btree (appointment_id) WHERE ((type = ANY (ARRAY['used'::text, 'credit_used'::text])) AND (appointment_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS customer_credits_payment_id_idx ON public.customer_credits USING btree (payment_id) WHERE (payment_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cust_subs_customer ON public.customer_subscriptions USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_subs_provider_sub_id ON public.customer_subscriptions USING btree (provider_subscription_id) WHERE (provider_subscription_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cust_subs_status ON public.customer_subscriptions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_cust_subs_tenant ON public.customer_subscriptions USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cust_one_active_sub ON public.customer_subscriptions USING btree (customer_id) WHERE (status = ANY (ARRAY['active'::text, 'pending_payment'::text, 'past_due'::text, 'paused'::text]));
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_subscriptions_card_token ON public.customer_subscriptions USING btree (card_token) WHERE (card_token IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_subscriptions_referral_code ON public.customer_subscriptions USING btree (referral_code) WHERE (referral_code IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON public.customers USING btree (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_barber_id ON public.customers USING btree (barber_id);
CREATE INDEX IF NOT EXISTS idx_customers_birthday_sent ON public.customers USING btree (birthday_sent);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_auth_user ON public.customers USING btree (tenant_id, auth_user_id) WHERE (auth_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_provider_message_id ON public.email_logs USING btree (provider_message_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_customer ON public.lgpd_requests USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_status ON public.lgpd_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_tenant ON public.lgpd_requests USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_part_campaign ON public.loyalty_campaign_participations USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_part_customer ON public.loyalty_campaign_participations USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_part_tenant ON public.loyalty_campaign_participations USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_campaigns_status ON public.loyalty_campaigns USING btree (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_loyalty_campaigns_tenant ON public.loyalty_campaigns USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_customer ON public.loyalty_rewards USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_status ON public.loyalty_rewards USING btree (status);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_tenant ON public.loyalty_rewards USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_barber ON public.notification_recipients USING btree (barber_id) WHERE (barber_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_tenant ON public.notification_recipients USING btree (tenant_id) WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS notification_recipients_tenant_phone_barber_key ON public.notification_recipients USING btree (tenant_id, phone, COALESCE(barber_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_notifications_barber_id ON public.notifications USING btree (barber_id);
CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON public.notifications USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dedup ON public.notifications USING btree (tenant_id, type, unique_key);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications USING btree (read);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON public.notifications USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_idx ON public.notifications USING btree (tenant_id, type, unique_key) WHERE (unique_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_obs_logs_correlation_id ON public.observability_logs USING btree (correlation_id);
CREATE INDEX IF NOT EXISTS idx_obs_logs_created_at ON public.observability_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_obs_logs_tenant_id ON public.observability_logs USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_operation_locks_expires_at ON public.operation_locks USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_logs_gateway ON public.payment_gateway_logs USING btree (gateway_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_logs_tenant ON public.payment_gateway_logs USING btree (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_tenant ON public.payment_gateways USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_primary_gateway_per_tenant ON public.payment_gateways USING btree (tenant_id) WHERE (is_primary = true);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_appointment ON public.payment_receipts USING btree (appointment_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_tenant ON public.payment_receipts USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_live ON public.plans USING btree (stripe_price_id_live) WHERE (stripe_price_id_live IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_test ON public.plans USING btree (stripe_price_id_test) WHERE (stripe_price_id_test IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS plans_slug_key ON public.plans USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_privacy_consents_customer ON public.privacy_consents USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_privacy_consents_tenant ON public.privacy_consents USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_sales_appointment_id ON public.product_sales USING btree (appointment_id);
CREATE INDEX IF NOT EXISTS idx_product_sales_barber_id ON public.product_sales USING btree (barber_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products USING btree (category);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email);
CREATE INDEX IF NOT EXISTS idx_push_subs_phone ON public.push_subscriptions USING btree (customer_phone) WHERE active;
CREATE INDEX IF NOT EXISTS idx_push_subs_tenant ON public.push_subscriptions USING btree (tenant_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions USING btree (user_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_key_time ON public.rate_limit_hits USING btree (bucket, key, hit_at DESC);
CREATE INDEX IF NOT EXISTS idx_reception_permissions_tenant ON public.reception_permissions USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_appointment_id ON public.refund_requests USING btree (appointment_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_created_at ON public.refund_requests USING btree (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_requests_single_active_per_appointment ON public.refund_requests USING btree (appointment_id) WHERE (status <> ALL (ARRAY['rejected'::text, 'cancelled'::text]));
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_tenant_id ON public.refund_requests USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS resend_settings_single_row ON public.resend_settings USING btree (((id IS NOT NULL)));
CREATE INDEX IF NOT EXISTS idx_review_logs_tenant ON public.review_automation_logs USING btree (tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_log_per_appointment ON public.review_automation_logs USING btree (appointment_id) WHERE (status = ANY (ARRAY['sent'::text, 'skipped'::text]));
CREATE INDEX IF NOT EXISTS idx_admin_voucher_audit_created ON public.saas_admin_voucher_audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_voucher_audit_tenant ON public.saas_admin_voucher_audit_logs USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_voucher_audit_voucher ON public.saas_admin_voucher_audit_logs USING btree (voucher_id);
CREATE INDEX IF NOT EXISTS idx_redemption_status ON public.saas_admin_voucher_redemptions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_redemption_tenant ON public.saas_admin_voucher_redemptions USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_redemption_voucher_active ON public.saas_admin_voucher_redemptions USING btree (voucher_id) WHERE (status = ANY (ARRAY['pending'::text, 'active'::text]));
CREATE INDEX IF NOT EXISTS idx_admin_voucher_status ON public.saas_admin_vouchers USING btree (status);
CREATE INDEX IF NOT EXISTS idx_admin_voucher_tenant ON public.saas_admin_vouchers USING btree (specific_tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_voucher_internal_tenant ON public.saas_admin_vouchers USING btree (specific_tenant_id) WHERE ((purpose = 'internal_testing'::text) AND (status = ANY (ARRAY['draft'::text, 'pending'::text, 'active'::text])));
CREATE INDEX IF NOT EXISTS idx_saas_checkout_session ON public.saas_checkout_sessions USING btree (stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_saas_checkout_tenant ON public.saas_checkout_sessions USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON public.services USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_checks_service_time ON public.status_checks USING btree (service_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_scans_scanned_at ON public.subscription_card_scans USING btree (scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_scans_subscription ON public.subscription_card_scans USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_card_scans_tenant ON public.subscription_card_scans USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_inv_status ON public.subscription_invoices USING btree (status);
CREATE INDEX IF NOT EXISTS idx_sub_inv_sub ON public.subscription_invoices USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_inv_tenant ON public.subscription_invoices USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_loyalty_history_customer ON public.subscription_loyalty_history USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_sub_loyalty_history_subscription ON public.subscription_loyalty_history USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_loyalty_history_tenant ON public.subscription_loyalty_history USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_loyalty_rewards_tenant ON public.subscription_loyalty_rewards USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_provider_payment_id ON public.subscription_payments USING btree (provider_payment_id) WHERE (provider_payment_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status ON public.subscription_payments USING btree (status);
CREATE INDEX IF NOT EXISTS idx_sub_payments_subscription ON public.subscription_payments USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_tenant ON public.subscription_payments USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_spbs_benefit ON public.subscription_plan_benefit_services USING btree (benefit_id);
CREATE INDEX IF NOT EXISTS idx_spbs_plan ON public.subscription_plan_benefit_services USING btree (plan_id);
CREATE INDEX IF NOT EXISTS idx_spbs_service ON public.subscription_plan_benefit_services USING btree (service_id);
CREATE INDEX IF NOT EXISTS idx_spbs_tenant ON public.subscription_plan_benefit_services USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_spb_plan ON public.subscription_plan_benefits USING btree (plan_id);
CREATE INDEX IF NOT EXISTS idx_spb_tenant ON public.subscription_plan_benefits USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_spc_subscription ON public.subscription_plan_changes USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_spc_tenant ON public.subscription_plan_changes USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sps_plan ON public.subscription_plan_services USING btree (plan_id);
CREATE INDEX IF NOT EXISTS idx_sps_tenant ON public.subscription_plan_services USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_tenant ON public.subscription_plans USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_referrals_code ON public.subscription_referrals USING btree (referral_code);
CREATE INDEX IF NOT EXISTS idx_sub_referrals_referrer ON public.subscription_referrals USING btree (referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_sub_referrals_status ON public.subscription_referrals USING btree (status);
CREATE INDEX IF NOT EXISTS idx_sub_referrals_tenant ON public.subscription_referrals USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status_logs_sub ON public.subscription_status_logs USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status_logs_tenant ON public.subscription_status_logs USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_usage_appointment ON public.subscription_usage_logs USING btree (appointment_id);
CREATE INDEX IF NOT EXISTS idx_sub_usage_status ON public.subscription_usage_logs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_sub_usage_sub ON public.subscription_usage_logs USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_usage_tenant ON public.subscription_usage_logs USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_usage_logs_appointment ON public.subscription_usage_logs USING btree (appointment_id) WHERE (appointment_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON public.subscriptions USING btree (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_addons_payment_failed ON public.tenant_addons USING btree (tenant_id) WHERE (payment_failed_count > 0);
CREATE INDEX IF NOT EXISTS idx_tenant_addons_status ON public.tenant_addons USING btree (status);
CREATE INDEX IF NOT EXISTS idx_tenant_addons_tenant ON public.tenant_addons USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_addons_unique_single ON public.tenant_addons USING btree (tenant_id, addon_id) WHERE (quantity = 1);
CREATE INDEX IF NOT EXISTS idx_tenant_webhooks_tenant ON public.tenant_webhooks USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON public.transactions USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_income_per_appointment ON public.transactions USING btree (appointment_id) WHERE ((type = 'income'::text) AND (appointment_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS verification_challenges_barber_id_idx ON public.verification_challenges USING btree (barber_id);
CREATE UNIQUE INDEX IF NOT EXISTS verification_challenges_one_active_staff_idx ON public.verification_challenges USING btree (barber_id) WHERE ((barber_id IS NOT NULL) AND (purpose = 'staff_email_verification'::text) AND (consumed_at IS NULL));
CREATE INDEX IF NOT EXISTS idx_waiting_list_tenant_status ON public.waiting_list USING btree (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_barbershop_id ON public.webhook_logs USING btree (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_user_id ON public.whatsapp_cloud_connections USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_barber_id ON public.whatsapp_conversations USING btree (barber_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_group_id ON public.whatsapp_conversations USING btree (appointment_group_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_active ON public.whatsapp_conversations USING btree (phone, active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_fallback ON public.whatsapp_conversations USING btree (phone_fallback);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_barbershop_id ON public.whatsapp_instances USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS whatsapp_instances_webhook_token_idx ON public.whatsapp_instances USING btree (webhook_token);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status_scheduled ON public.whatsapp_messages USING btree (status, scheduled_for) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_id ON public.whatsapp_messages USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_id ON public.whatsapp_messages USING btree (wa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user_id ON public.whatsapp_templates USING btree (user_id);

-- ==============================================================================
-- 06. FUNCTIONS AND STORED PROCEDURES (202 PHYSICAL SOURCE CATALOG FUNCTIONS)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public._norm_pt(_txt text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT lower(translate(COALESCE(_txt,''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
    'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'));
$function$;

CREATE OR REPLACE FUNCTION public._compute_consume_quantity(_service_name text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _service_name IS NULL THEN 1
    WHEN public._norm_pt(_service_name) LIKE '%combo%' THEN 2
    WHEN public._norm_pt(_service_name) LIKE '%barba%'
      AND (public._norm_pt(_service_name) LIKE '%corte%'
        OR public._norm_pt(_service_name) LIKE '%cabelo%') THEN 2
    ELSE 1
  END;
$function$;

CREATE OR REPLACE FUNCTION public.check_time_off_conflicts(p_professional_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone)
 RETURNS TABLE(appointment_id uuid, customer_name text, service_name text, start_time timestamp with time zone, end_time timestamp with time zone, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
    SELECT 
        a.id as appointment_id,
        c.name as customer_name,
        s.name as service_name,
        a.start_time,
        a.end_time,
        a.status
    FROM public.appointments a
    LEFT JOIN public.customers c ON a.customer_id = c.id
    LEFT JOIN public.services s ON a.service_id = s.id
    WHERE a.barber_id = p_professional_id
      AND a.status NOT IN ('cancelled', 'no_show')
      AND a.start_time < p_ends_at
      AND a.end_time > p_starts_at;
$function$;

CREATE OR REPLACE FUNCTION public.generate_admin_digest(_hours integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH win AS (
    SELECT * FROM public.admin_event_log
    WHERE created_at >= now() - (_hours || ' hours')::interval
      AND event_key NOT LIKE 'admin.digest%'
  ),
  by_evt AS (
    SELECT event_key, COUNT(*) AS n FROM win GROUP BY event_key ORDER BY 2 DESC
  ),
  new_tenants AS (
    SELECT COUNT(*) AS n FROM public.profiles WHERE created_at >= now() - (_hours || ' hours')::interval
  ),
  new_subs AS (
    SELECT COUNT(*) AS n FROM public.subscriptions WHERE created_at >= now() - (_hours || ' hours')::interval AND status IN ('active','trialing')
  ),
  new_appts AS (
    SELECT COUNT(*) AS n FROM public.appointments WHERE created_at >= now() - (_hours || ' hours')::interval
  ),
  critical AS (
    SELECT COUNT(*) AS n FROM win WHERE severity = 'critical'
  )
  SELECT jsonb_build_object(
    'window_hours', _hours,
    'new_tenants', (SELECT n FROM new_tenants),
    'new_subscriptions', (SELECT n FROM new_subs),
    'new_appointments', (SELECT n FROM new_appts),
    'critical_events', (SELECT n FROM critical),
    'total_events', (SELECT COUNT(*) FROM win),
    'top_events', COALESCE((SELECT jsonb_agg(jsonb_build_object('event', event_key, 'count', n)) FROM by_evt LIMIT 10), '[]'::jsonb)
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_active_subscription(p_customer_id uuid)
 RETURNS TABLE(subscription_id uuid, plan_id uuid, tenant_id uuid, started_at timestamp with time zone, months_active integer, participates_traditional_loyalty boolean, participates_cashback boolean, accumulates_premium_loyalty boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT
    cs.id,
    cs.plan_id,
    cs.tenant_id,
    cs.started_at,
    GREATEST(0, EXTRACT(YEAR FROM age(now(), cs.started_at))::int * 12
            + EXTRACT(MONTH FROM age(now(), cs.started_at))::int) AS months_active,
    sp.participates_traditional_loyalty,
    sp.participates_cashback,
    sp.accumulates_premium_loyalty
  FROM public.customer_subscriptions cs
  JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  WHERE cs.customer_id = p_customer_id
    AND cs.status IN ('active','trialing','past_due')
  ORDER BY cs.started_at ASC
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_allowed_modules(_tenant uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE(p.allowed_modules, '[]'::jsonb)
  FROM public.barbershops b
  LEFT JOIN public.plans p ON p.id = b.plan_id
  WHERE b.id = _tenant;
$function$;

CREATE OR REPLACE FUNCTION public.get_appointment_for_rating(p_cancel_token text)
 RETURNS TABLE(id uuid, user_id uuid, tenant_id uuid, barber_id uuid, service_id uuid, customer_id uuid, start_time timestamp with time zone, status text, already_rated boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT a.id,
         a.user_id,
         a.tenant_id,
         a.barber_id,
         a.service_id,
         a.customer_id,
         a.start_time,
         a.status,
         EXISTS (SELECT 1 FROM public.service_ratings sr WHERE sr.appointment_id = a.id) AS already_rated
  FROM public.appointments a
  WHERE p_cancel_token IS NOT NULL
    AND length(p_cancel_token) >= 6
    AND a.cancel_token::text = p_cancel_token
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_barber_appointments(p_barber_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.start_time DESC), '[]'::jsonb)
  FROM (
    SELECT
      a.*,
      jsonb_build_object(
        'name', c.name,
        'phone', c.phone,
        'avatar_url', c.avatar_url
      ) AS customers,
      jsonb_build_object(
        'name', s.name
      ) AS services
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services  s ON s.id = a.service_id
    WHERE a.barber_id = p_barber_id
  ) t;
$function$;

CREATE OR REPLACE FUNCTION public.get_barber_commissions(p_tenant_id uuid, p_barber_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_status text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, appointment_id uuid, customer_id uuid, customer_name text, service_id uuid, service_name text, service_amount numeric, commission_type text, commission_percentage numeric, commission_fixed_amount numeric, commission_amount numeric, status text, paid_at timestamp with time zone, paid_by uuid, created_at timestamp with time zone, appointment_date timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT
    bc.id,
    bc.appointment_id,
    bc.customer_id,
    c.name AS customer_name,
    bc.service_id,
    bc.service_name,
    bc.service_amount,
    bc.commission_type,
    bc.commission_percentage,
    bc.commission_fixed_amount,
    bc.commission_amount,
    bc.status,
    bc.paid_at,
    bc.paid_by,
    bc.created_at,
    COALESCE(a.start_time, bc.created_at) AS appointment_date
  FROM public.barber_commissions bc
  LEFT JOIN public.customers c ON c.id = bc.customer_id
  LEFT JOIN public.appointments a ON a.id = bc.appointment_id
  WHERE bc.tenant_id = p_tenant_id
    AND bc.barber_id = p_barber_id
    AND (p_status IS NULL OR bc.status = p_status)
    AND (p_start_date IS NULL OR COALESCE(a.completed_at, bc.created_at, a.start_time) >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR COALESCE(a.completed_at, bc.created_at, a.start_time) < (p_end_date + 1)::timestamptz)
  ORDER BY COALESCE(a.start_time, bc.created_at) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_barber_pending_commissions(p_tenant_id uuid, p_barber_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, appointment_id uuid, customer_id uuid, customer_name text, service_id uuid, service_name text, service_amount numeric, commission_amount numeric, status text, created_at timestamp with time zone, appointment_date timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT
    bc.id,
    bc.appointment_id,
    bc.customer_id,
    c.name AS customer_name,
    bc.service_id,
    bc.service_name,
    bc.service_amount,
    bc.commission_amount,
    bc.status,
    bc.created_at,
    a.start_time AS appointment_date
  FROM public.barber_commissions bc
  LEFT JOIN public.customers c ON c.id = bc.customer_id
  LEFT JOIN public.appointments a ON a.id = bc.appointment_id
  WHERE bc.tenant_id = p_tenant_id
    AND bc.barber_id = p_barber_id
    AND bc.status = 'pending'
    AND (p_start_date IS NULL OR COALESCE(a.completed_at, bc.created_at, a.start_time) >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR COALESCE(a.completed_at, bc.created_at, a.start_time) < (p_end_date + 1)::timestamptz)
  ORDER BY COALESCE(a.start_time, bc.created_at) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_coupon_by_code(p_tenant_id uuid, p_code text)
 RETURNS TABLE(id uuid, code text, type text, value numeric, minimum_amount numeric, max_discount numeric, usage_limit integer, used_count integer, expires_at timestamp with time zone, active boolean, applies_to text, first_month_only boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT id, code, type, value, minimum_amount, max_discount,
         usage_limit, used_count, expires_at, active, applies_to, first_month_only
  FROM public.coupons
  WHERE tenant_id = p_tenant_id
    AND upper(code) = upper(p_code)
    AND active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_review(_appointment_id uuid)
 RETURNS SETOF appointment_reviews
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT r.*
  FROM public.appointment_reviews r
  JOIN public.appointments a ON a.id = r.appointment_id
  JOIN public.customers c ON c.id = a.customer_id
  WHERE r.appointment_id = _appointment_id
    AND (c.user_id = auth.uid() OR r.tenant_id = auth.uid())
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_profile_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  select role::text
  from public.user_roles
  where user_id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.get_new_appointment_management_token(p_appointment_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT a.management_token::text
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.created_at > now() - interval '15 minutes'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_plan_slug_by_stripe_price(_price_id text, _env text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT slug FROM public.plans
  WHERE (_env = 'live' AND stripe_price_id_live = _price_id)
     OR (_env = 'sandbox' AND stripe_price_id_test = _price_id)
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_active_customer_subscription(_tenant_id uuid, _customer_id uuid)
 RETURNS TABLE(id uuid, tenant_id uuid, customer_id uuid, plan_id uuid, status text, started_at timestamp with time zone, current_period_end timestamp with time zone, next_billing_at timestamp with time zone, uses_this_period integer, plan jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT
    cs.id,
    cs.tenant_id,
    cs.customer_id,
    cs.plan_id,
    cs.status,
    cs.started_at,
    cs.current_period_end,
    cs.next_billing_at,
    cs.uses_this_period,
    jsonb_build_object(
      'id', sp.id,
      'tenant_id', sp.tenant_id,
      'name', sp.name,
      'description', sp.description,
      'plan_type', sp.plan_type,
      'monthly_price', sp.monthly_price,
      'usage_type', sp.usage_type,
      'max_uses_per_month', sp.max_uses_per_month,
      'benefits', sp.benefits,
      'included_benefits', sp.included_benefits,
      'active', sp.active,
      'display_order', sp.display_order,
      'participates_traditional_loyalty', sp.participates_traditional_loyalty,
      'participates_cashback', sp.participates_cashback,
      'accumulates_premium_loyalty', sp.accumulates_premium_loyalty,
      'allows_product_discount', sp.allows_product_discount,
      'agenda_priority', sp.agenda_priority,
      'exclusive_hours', sp.exclusive_hours,
      'exclusive_days', sp.exclusive_days,
      'preferential_service', sp.preferential_service
    ) AS plan
  FROM public.customer_subscriptions cs
  JOIN public.customers c
    ON c.id = cs.customer_id
   AND c.user_id = cs.tenant_id
  LEFT JOIN public.subscription_plans sp
    ON sp.id = cs.plan_id
   AND sp.tenant_id = cs.tenant_id
  WHERE cs.tenant_id = _tenant_id
    AND cs.customer_id = _customer_id
    AND c.id = _customer_id
    AND cs.status = 'active'
  ORDER BY cs.started_at DESC NULLS LAST, cs.created_at DESC
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_subscriber_months(p_subscription_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT GREATEST(0,
    EXTRACT(YEAR FROM age(now(), started_at))::int * 12
    + EXTRACT(MONTH FROM age(now(), started_at))::int
  )
  FROM public.customer_subscriptions
  WHERE id = p_subscription_id;
$function$;

CREATE OR REPLACE FUNCTION public.has_active_addon(_user_id uuid, _addon_key text, _env text DEFAULT 'live'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_addons ta
    JOIN public.saas_addons sa ON sa.id = ta.addon_id
    WHERE ta.tenant_id = _user_id
      AND sa.addon_key = _addon_key
      AND ta.environment = _env
      AND ta.status IN ('active', 'trialing', 'past_due')
      AND (ta.current_period_end IS NULL OR ta.current_period_end > now())
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_active_internal_voucher(_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.saas_admin_voucher_redemptions r
    JOIN public.saas_admin_vouchers v ON v.id = r.voucher_id
    WHERE r.tenant_id = _tenant_id
      AND r.status = 'active'
      AND v.status = 'active'
      AND v.purpose = 'internal_testing'
      AND (v.starts_at IS NULL OR v.starts_at <= now())
      AND (
        v.duration_type = 'forever'
        OR (v.duration_type = 'until_date' AND v.expires_at > now())
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
    and environment = check_env
    and (
      (status in ('active', 'trialing') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_module(_tenant_id uuid, _module_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE((SELECT enabled FROM public.barbershop_modules
    WHERE tenant_id = _tenant_id AND module_key = _module_key), false);
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_active_subscriber(p_customer_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.customer_subscriptions
    WHERE customer_id = p_customer_id
      AND status IN ('active','trialing','past_due')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_internal_test_tenant(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE(
    (SELECT is_internal_test_tenant FROM public.profiles WHERE id = _user_id),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_profile_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_reception(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.reception_permissions
    WHERE user_id = _user_id AND is_active = true
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  select coalesce(public.has_role(auth.uid(), 'super_admin'), false)
$function$;

CREATE OR REPLACE FUNCTION public.list_admin_event_catalog()
 RETURNS TABLE(event_key text, category text, label text, description text, default_severity text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT * FROM (VALUES
    ('tenant.signup',                 'growth',      'Novo cadastro',                'Uma nova barbearia se cadastrou na plataforma.',                     'info'),
    ('tenant.onboarding_completed',   'growth',      'Onboarding concluído',         'Barbearia completou o setup inicial.',                                'info'),
    ('tenant.first_appointment',      'growth',      'Primeiro agendamento',         'Barbearia registrou o primeiro agendamento.',                         'info'),
    ('subscription.created',          'growth',      'Nova assinatura',              'Uma nova assinatura SaaS foi paga.',                                  'info'),
    ('subscription.upgraded',         'growth',      'Upgrade de plano',             'Cliente subiu de plano.',                                             'info'),
    ('subscription.cancelled',        'risk',        'Cancelamento',                 'Cliente cancelou a assinatura.',                                      'warning'),
    ('subscription.downgraded',       'risk',        'Downgrade de plano',           'Cliente trocou para plano menor.',                                    'warning'),
    ('subscription.payment_failed',   'risk',        'Falha no pagamento',           'Cobrança recorrente falhou.',                                         'critical'),
    ('trial.expiring_soon',           'risk',        'Trial expirando',              'Trial acaba em até 3 dias.',                                          'warning'),
    ('tenant.inactive_7d',            'risk',        'Tenant inativo',               'Sem login/agendamento há 7 dias.',                                    'warning'),
    ('tenant.churn_risk',             'risk',        'Risco de churn',               'Tenant com sinais fortes de cancelamento próximo.',                   'warning'),
    ('support.ticket_created',        'operational', 'Novo ticket de suporte',       'Foi aberto um novo ticket.',                                          'info'),
    ('support.ticket_urgent',         'operational', 'Ticket urgente',               'Ticket marcado como urgente.',                                        'critical'),
    ('support.suggestion_created',    'growth',      'Nova sugestão',                'Uma barbearia enviou uma sugestão de melhoria.',                      'info'),
    ('payment.refund_requested',      'operational', 'Reembolso solicitado',         'Pedido de reembolso pendente.',                                       'warning'),
    ('system.error_spike',            'operational', 'Pico de erros',                'Muitos erros em pouco tempo.',                                        'critical'),
    ('whatsapp.instance_disconnected','operational', 'WhatsApp desconectado',        'Instância Z-API de um tenant caiu.',                                  'warning'),
    ('revenue.milestone',             'financial',   'Marco de receita',             'MRR/receita bateu uma meta.',                                         'info'),
    ('payment.high_value',            'financial',   'Transação alta',               'Transação acima do limite configurado.',                              'info'),
    ('review.low_rating',             'operational', 'Avaliação baixa',              'Cliente deixou avaliação ruim (≤ 2 estrelas).',                       'warning'),
    ('automation.template_broken',    'operational', 'Template de automação com erro','Falha ao renderizar/enviar template de automação.',                    'warning'),
    ('security.suspicious_login',     'operational', 'Login suspeito',               'Login de origem incomum detectado.',                                  'warning'),
    ('finance.chargeback',            'financial',   'Chargeback recebido',          'Foi aberto um chargeback contra um pagamento.',                       'critical'),
    ('admin.digest_daily',            'digest',      'Resumo diário',                'Digest diário automático das últimas 24h.',                           'info'),
    ('admin.digest_weekly',           'digest',      'Resumo semanal',               'Digest semanal automático dos últimos 7 dias.',                       'info')
  ) AS c(event_key, category, label, description, default_severity);
$function$;

CREATE OR REPLACE FUNCTION public.reception_can(_user_id uuid, _action text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE(
    (SELECT (permissions ->> _action)::boolean
     FROM public.reception_permissions
     WHERE user_id = _user_id AND is_active = true
     LIMIT 1),
    false
  )
$function$;

CREATE OR REPLACE FUNCTION public.reception_tenant_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT tenant_id
  FROM public.reception_permissions
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.tenant_has_active_addon(_tenant_id uuid, _module_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_addons ta
    JOIN public.saas_addons a ON a.id = ta.addon_id
    WHERE ta.tenant_id = _tenant_id
      AND a.module_key = _module_key
      AND ta.status IN ('active','trialing','past_due')
      AND (ta.current_period_end IS NULL OR ta.current_period_end > now())
  );
$function$;

CREATE OR REPLACE FUNCTION public.admin_anomaly_alerts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_alerts jsonb := '[]'::jsonb;
  v_wa_disconnected int;
  v_gateway_failures int;
  v_automation_failures int;
  v_open_tickets int;
  v_low_reviews int;
  v_dormant_paying int;
  v_incidents_open int;
  v_stripe_recent_failures int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- WhatsApp instances disconnected on paying tenants
  SELECT count(DISTINCT wi.barbershop_id) INTO v_wa_disconnected
  FROM public.whatsapp_instances wi
  JOIN public.profiles p ON p.id = wi.barbershop_id
  WHERE COALESCE(wi.connected, false) = false
    AND COALESCE(p.plan, 'free') NOT IN ('free', 'trial');

  IF v_wa_disconnected > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'whatsapp_disconnected',
      'severity', CASE WHEN v_wa_disconnected >= 5 THEN 'critical' ELSE 'warning' END,
      'title', 'WhatsApp desconectado em barbearias pagantes',
      'description', v_wa_disconnected || ' barbearia(s) com plano pago estão sem WhatsApp conectado.',
      'count', v_wa_disconnected,
      'action_label', 'Ver barbearias',
      'action_route', '/admin/tenants'
    );
  END IF;

  -- Payment gateway failures (24h)
  SELECT count(*) INTO v_gateway_failures
  FROM public.payment_gateway_logs
  WHERE created_at > now() - interval '24 hours'
    AND (status ILIKE '%fail%' OR status ILIKE '%error%' OR status = 'declined');

  IF v_gateway_failures >= 3 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'gateway_failures',
      'severity', CASE WHEN v_gateway_failures >= 10 THEN 'critical' ELSE 'warning' END,
      'title', 'Falhas em gateways de pagamento (24h)',
      'description', v_gateway_failures || ' transação(ões) falharam nas últimas 24h.',
      'count', v_gateway_failures,
      'action_label', 'Ver logs',
      'action_route', '/admin/errors'
    );
  END IF;

  -- Automation failures (24h)
  SELECT count(*) INTO v_automation_failures
  FROM public.automation_logs
  WHERE created_at > now() - interval '24 hours'
    AND status IN ('failed', 'error');

  IF v_automation_failures >= 10 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'automation_failures',
      'severity', CASE WHEN v_automation_failures >= 50 THEN 'critical' ELSE 'warning' END,
      'title', 'Automações falhando',
      'description', v_automation_failures || ' automação(ões) falharam nas últimas 24h.',
      'count', v_automation_failures,
      'action_label', 'Ver logs',
      'action_route', '/admin/errors'
    );
  END IF;

  -- Support tickets open > 48h
  SELECT count(*) INTO v_open_tickets
  FROM public.support_tickets
  WHERE status IN ('open', 'pending', 'aberto', 'pendente')
    AND created_at < now() - interval '48 hours';

  IF v_open_tickets > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'stale_tickets',
      'severity', CASE WHEN v_open_tickets >= 5 THEN 'critical' ELSE 'warning' END,
      'title', 'Tickets sem resposta há mais de 48h',
      'description', v_open_tickets || ' ticket(s) de suporte parados.',
      'count', v_open_tickets,
      'action_label', 'Abrir suporte',
      'action_route', '/admin/support'
    );
  END IF;

  -- Low reviews last 7d
  SELECT count(*) INTO v_low_reviews
  FROM public.appointment_reviews
  WHERE created_at > now() - interval '7 days'
    AND rating IS NOT NULL
    AND rating <= 2;

  IF v_low_reviews >= 3 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'low_reviews',
      'severity', 'warning',
      'title', 'Avaliações baixas na semana',
      'description', v_low_reviews || ' avaliação(ões) com 1-2 estrelas nos últimos 7 dias.',
      'count', v_low_reviews,
      'action_label', 'Ver relatórios',
      'action_route', '/admin/reports'
    );
  END IF;

  -- Paying tenants dormant 14+ days
  SELECT count(*) INTO v_dormant_paying
  FROM public.profiles p
  WHERE COALESCE(p.plan, 'free') NOT IN ('free', 'trial')
    AND NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.barbershop_id = p.id
        AND a.created_at > now() - interval '14 days'
    );

  IF v_dormant_paying > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'dormant_paying',
      'severity', CASE WHEN v_dormant_paying >= 3 THEN 'critical' ELSE 'warning' END,
      'title', 'Barbearias pagantes sem atividade',
      'description', v_dormant_paying || ' pagante(s) sem agendamentos há 14+ dias — risco de churn.',
      'count', v_dormant_paying,
      'action_label', 'Ver barbearias',
      'action_route', '/admin/tenants'
    );
  END IF;

  -- Open status incidents
  SELECT count(*) INTO v_incidents_open
  FROM public.status_incidents
  WHERE status NOT IN ('resolved', 'closed');

  IF v_incidents_open > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'open_incidents',
      'severity', 'critical',
      'title', 'Incidentes de status abertos',
      'description', v_incidents_open || ' incidente(s) na status page.',
      'count', v_incidents_open,
      'action_label', 'Ver status',
      'action_route', '/admin/status'
    );
  END IF;

  -- Recent Stripe subscription failures (past_due / unpaid)
  SELECT count(*) INTO v_stripe_recent_failures
  FROM public.subscriptions
  WHERE status IN ('past_due', 'unpaid', 'incomplete_expired')
    AND updated_at > now() - interval '7 days';

  IF v_stripe_recent_failures > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'stripe_dunning',
      'severity', CASE WHEN v_stripe_recent_failures >= 3 THEN 'critical' ELSE 'warning' END,
      'title', 'Assinaturas com pagamento pendente',
      'description', v_stripe_recent_failures || ' assinatura(s) em dunning (past_due/unpaid).',
      'count', v_stripe_recent_failures,
      'action_label', 'Ver assinaturas',
      'action_route', '/admin/subscriptions'
    );
  END IF;

  RETURN jsonb_build_object(
    'alerts', v_alerts,
    'total', jsonb_array_length(v_alerts),
    'critical_count', (
      SELECT count(*) FROM jsonb_array_elements(v_alerts) e
      WHERE e->>'severity' = 'critical'
    ),
    'generated_at', now()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_executive_kpis()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_result jsonb;
  v_mrr numeric := 0;
  v_paying int := 0;
  v_total_tenants int := 0;
  v_new_7 int := 0;
  v_new_30 int := 0;
  v_active_30 int := 0;
  v_dormant_30 int := 0;
  v_churn_signal int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*) INTO v_total_tenants
  FROM public.profiles p
  WHERE public.has_role(p.id, 'tenant_admin');

  SELECT COUNT(*) INTO v_new_7
  FROM public.profiles p
  WHERE public.has_role(p.id, 'tenant_admin')
    AND p.created_at >= now() - interval '7 days';

  SELECT COUNT(*) INTO v_new_30
  FROM public.profiles p
  WHERE public.has_role(p.id, 'tenant_admin')
    AND p.created_at >= now() - interval '30 days';

  SELECT COALESCE(SUM(pl.price_monthly),0), COUNT(*)
    INTO v_mrr, v_paying
  FROM public.profiles p
  JOIN public.plans pl ON lower(pl.name) = lower(p.plan)
  WHERE public.has_role(p.id, 'tenant_admin')
    AND p.plan IS NOT NULL
    AND lower(p.plan) NOT IN ('free','starter');

  SELECT COUNT(DISTINCT a.tenant_id) INTO v_active_30
  FROM public.appointments a
  WHERE a.created_at >= now() - interval '30 days';

  v_dormant_30 := GREATEST(v_total_tenants - v_active_30, 0);

  -- Churn signal: tenants that had activity in previous 30d window but not in last 30d
  SELECT COUNT(*) INTO v_churn_signal
  FROM (
    SELECT tenant_id
    FROM public.appointments
    WHERE created_at >= now() - interval '60 days'
      AND created_at <  now() - interval '30 days'
    GROUP BY tenant_id
  ) prev
  WHERE prev.tenant_id NOT IN (
    SELECT tenant_id FROM public.appointments
    WHERE created_at >= now() - interval '30 days'
      AND tenant_id IS NOT NULL
  );

  v_result := jsonb_build_object(
    'mrr', v_mrr,
    'arr', v_mrr * 12,
    'arpu', CASE WHEN v_paying > 0 THEN round(v_mrr / v_paying, 2) ELSE 0 END,
    'ltv_estimate', CASE WHEN v_paying > 0 THEN round((v_mrr / v_paying) * 24, 2) ELSE 0 END,
    'paying_tenants', v_paying,
    'total_tenants', v_total_tenants,
    'new_signups_7d', v_new_7,
    'new_signups_30d', v_new_30,
    'active_tenants_30d', v_active_30,
    'dormant_tenants', v_dormant_30,
    'churn_signal_30d', v_churn_signal,
    'churn_rate_30d', CASE WHEN v_total_tenants > 0 THEN round((v_churn_signal::numeric / v_total_tenants) * 100, 2) ELSE 0 END
  );

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_tenant_health(p_limit integer DEFAULT 50)
 RETURNS TABLE(tenant_id uuid, business_name text, plan text, created_at timestamp with time zone, appointments_30d bigint, last_appointment_at timestamp with time zone, days_since_activity integer, whatsapp_connected boolean, open_tickets bigint, health_score integer, risk_level text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH tenants AS (
    SELECT p.id, p.business_name, p.plan, p.created_at
    FROM public.profiles p
    WHERE public.has_role(p.id, 'tenant_admin')
  ),
  appts AS (
    SELECT a.tenant_id,
           COUNT(*) FILTER (WHERE a.created_at >= now() - interval '30 days') AS a_30,
           MAX(a.created_at) AS last_at
    FROM public.appointments a
    GROUP BY a.tenant_id
  ),
  wa AS (
    SELECT w.tenant_id,
           bool_or(coalesce(w.connected, false) OR w.status = 'connected') AS is_connected
    FROM public.whatsapp_instances w
    GROUP BY w.tenant_id
  ),
  tickets AS (
    SELECT st.barbershop_id AS tenant_id, COUNT(*) AS n
    FROM public.support_tickets st
    WHERE st.status IN ('open','pending','in_progress')
    GROUP BY st.barbershop_id
  )
  SELECT
    t.id,
    t.business_name,
    t.plan,
    t.created_at,
    COALESCE(ap.a_30, 0) AS appointments_30d,
    ap.last_at,
    CASE WHEN ap.last_at IS NULL THEN NULL
         ELSE EXTRACT(day FROM now() - ap.last_at)::int
    END AS days_since_activity,
    COALESCE(wa.is_connected, false) AS whatsapp_connected,
    COALESCE(tk.n, 0) AS open_tickets,
    LEAST(100, GREATEST(0,
      -- appointments in last 30d (up to 40 pts)
      LEAST(40, COALESCE(ap.a_30, 0) * 2)::int
      -- WhatsApp connected (20 pts)
      + CASE WHEN COALESCE(wa.is_connected, false) THEN 20 ELSE 0 END
      -- Paid plan (20 pts)
      + CASE WHEN t.plan IS NOT NULL AND lower(t.plan) NOT IN ('free','starter') THEN 20 ELSE 5 END
      -- No open tickets (10 pts)
      + CASE WHEN COALESCE(tk.n, 0) = 0 THEN 10 ELSE 0 END
      -- Recent activity within 7d (10 pts)
      + CASE WHEN ap.last_at >= now() - interval '7 days' THEN 10
             WHEN ap.last_at >= now() - interval '30 days' THEN 5
             ELSE 0 END
    ))::int AS health_score,
    CASE
      WHEN COALESCE(ap.a_30, 0) = 0 THEN 'critical'
      WHEN ap.last_at < now() - interval '14 days' THEN 'at_risk'
      WHEN NOT COALESCE(wa.is_connected, false) THEN 'watch'
      ELSE 'healthy'
    END AS risk_level
  FROM tenants t
  LEFT JOIN appts ap ON ap.tenant_id = t.id
  LEFT JOIN wa   ON wa.tenant_id = t.id
  LEFT JOIN tickets tk ON tk.tenant_id = t.id
  ORDER BY health_score ASC, appointments_30d ASC
  LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assert_comanda_access(p_appointment_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tenant UUID;
  v_barber UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT tenant_id, barber_id INTO v_tenant, v_barber
  FROM public.appointments WHERE id = p_appointment_id;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found';
  END IF;

  -- Shop owner
  IF v_tenant = v_uid THEN
    RETURN v_tenant;
  END IF;

  -- Barber assigned to this appointment (barbers table)
  IF EXISTS (
    SELECT 1 FROM public.barbers b
    WHERE b.id = v_barber AND b.user_id = v_tenant
      AND (b.id = v_uid OR b.user_id = v_uid)
  ) THEN
    RETURN v_tenant;
  END IF;

  RAISE EXCEPTION 'forbidden';
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_product_to_comanda(p_appointment_id uuid, p_product_id uuid, p_quantity integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tenant UUID;
  v_product RECORD;
  v_appointment RECORD;
  v_total NUMERIC;
  v_sale_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  v_tenant := public.assert_comanda_access(p_appointment_id);

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND user_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;
  IF COALESCE(v_product.stock_quantity, 0) < p_quantity THEN
    RAISE EXCEPTION 'insufficient_stock';
  END IF;

  SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id;

  v_total := ROUND((v_product.price * p_quantity)::numeric, 2);

  -- Insert product sale linked to appointment
  INSERT INTO public.product_sales (
    user_id, barber_id, appointment_id, items, total_amount, status
  ) VALUES (
    v_tenant,
    v_appointment.barber_id,
    p_appointment_id,
    jsonb_build_array(jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name,
      'quantity', p_quantity,
      'price', v_product.price
    )),
    v_total,
    'completed'
  ) RETURNING id INTO v_sale_id;

  -- Decrement stock
  UPDATE public.products
    SET stock_quantity = stock_quantity - p_quantity
    WHERE id = p_product_id;

  -- Register transaction (income)
  INSERT INTO public.transactions (
    user_id, tenant_id, barber_id, appointment_id, amount, type, category, description, date
  ) VALUES (
    v_tenant, v_tenant, v_appointment.barber_id, p_appointment_id,
    v_total, 'income', 'Venda de Produto',
    'Comanda: ' || v_product.name || ' x' || p_quantity,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );

  -- Append to appointment items + bump totals
  UPDATE public.appointments
    SET items = COALESCE(items, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'id', v_product.id,
          'sale_id', v_sale_id,
          'name', v_product.name,
          'type', 'product',
          'quantity', p_quantity,
          'price', v_product.price,
          'total', v_total
        )),
        total_price = COALESCE(total_price, 0) + v_total,
        final_amount = COALESCE(final_amount, 0) + v_total,
        updated_at = now()
    WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'total', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_commission_for_appointment(p_appointment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_appt RECORD;
  v_barber RECORD;
  v_base_mode text;
  v_base numeric(10,2);
  v_amount numeric(10,2) := 0;
  v_rate numeric(5,2) := 0;
  v_fixed numeric(10,2) := 0;
  v_bonus numeric(10,2) := 0;
  v_type text;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND OR v_appt.status <> 'completed' OR v_appt.barber_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_barber FROM public.barbers WHERE id = v_appt.barber_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(commission_base, 'gross') INTO v_base_mode
    FROM public.profiles WHERE id = v_appt.tenant_id;

  -- base de cálculo
  IF v_base_mode = 'net_cash' OR v_base_mode = 'custom' THEN
    v_base := GREATEST(0, COALESCE(v_appt.total_price,0)
                        - COALESCE(v_appt.credits_used, v_appt.credit_used, 0)
                        - COALESCE(v_appt.cashback_used, 0));
  ELSE
    v_base := COALESCE(v_appt.total_price, 0);
  END IF;

  v_type  := COALESCE(v_barber.commission_type, 'percentage');
  v_rate  := COALESCE(v_barber.commission_rate, 0);
  v_fixed := COALESCE(v_barber.commission_fixed_value, 0);
  v_bonus := COALESCE(v_barber.commission_bonus_value, 0);

  IF v_type = 'percentage' THEN
    v_amount := v_base * v_rate / 100.0;
  ELSIF v_type = 'fixed' THEN
    v_amount := v_fixed;
  ELSIF v_type = 'hybrid' THEN
    v_amount := (v_base * v_rate / 100.0) + v_bonus;
  END IF;

  IF v_amount <= 0 AND v_fixed = 0 THEN
    -- nada a registrar
    DELETE FROM public.commission_entries
      WHERE appointment_id = p_appointment_id AND status = 'pending';
    RETURN;
  END IF;

  INSERT INTO public.commission_entries (
    tenant_id, barber_id, appointment_id, customer_id,
    service_amount, commission_type, commission_rate, commission_fixed,
    commission_bonus, commission_amount, status, earned_at
  ) VALUES (
    v_appt.tenant_id, v_appt.barber_id, p_appointment_id, v_appt.customer_id,
    v_base, v_type, v_rate, v_fixed, v_bonus, v_amount,
    'pending', COALESCE(v_appt.completed_at, now())
  )
  ON CONFLICT (appointment_id) DO UPDATE SET
    service_amount = EXCLUDED.service_amount,
    commission_type = EXCLUDED.commission_type,
    commission_rate = EXCLUDED.commission_rate,
    commission_fixed = EXCLUDED.commission_fixed,
    commission_bonus = EXCLUDED.commission_bonus,
    commission_amount = CASE
      WHEN public.commission_entries.status = 'paid' THEN public.commission_entries.commission_amount
      ELSE EXCLUDED.commission_amount
    END,
    updated_at = now()
  WHERE public.commission_entries.status <> 'paid';
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_next_retry(attempts integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    delay_minutes INTEGER;
BEGIN
    -- Backoff exponencial: 5, 15, 60, 240 minutos
    delay_minutes := CASE 
        WHEN attempts = 1 THEN 5
        WHEN attempts = 2 THEN 15
        WHEN attempts = 3 THEN 60
        WHEN attempts = 4 THEN 240
        ELSE 1440 -- 24h fallback
    END;
    
    RETURN now() + (delay_minutes || ' minutes')::interval;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id uuid, p_cancelled_by text, p_source text, p_refund_preference text DEFAULT 'none'::text, p_changed_by_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_appt RECORD;
    v_customer_id UUID;
    v_tenant_id UUID;
    v_credits_to_return NUMERIC(10,2);
    v_cashback_to_return NUMERIC(10,2);
    v_pix_paid NUMERIC(10,2);
BEGIN
    -- 1. Carregar agendamento
    SELECT * FROM public.appointments WHERE id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já cancelado');
    END IF;

    v_customer_id := v_appt.customer_id;
    v_tenant_id := v_appt.tenant_id;
    v_credits_to_return := COALESCE(v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_to_return := COALESCE(v_appt.cashback_used, 0);
    v_pix_paid := COALESCE(v_appt.pix_amount, 0);

    -- 2. Devolução Automática de Créditos Usados
    IF v_credits_to_return > 0 THEN
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, v_credits_to_return, 'credit_refund', 'Devolução de crédito por cancelamento'
        );
    END IF;

    -- 3. Devolução Automática de Cashback Usado
    IF v_cashback_to_return > 0 THEN
        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, v_cashback_to_return, 'cashback_refund', 'Devolução de cashback por cancelamento'
        );
    END IF;

    -- 4. Tratar Valor Pago via PIX/Dinheiro/Cartão (v_pix_paid representa o valor real em caixa)
    IF v_pix_paid > 0 THEN
        IF p_refund_preference = 'credits' THEN
            -- Converter para crédito
            INSERT INTO public.credit_transactions (
                tenant_id, customer_id, appointment_id, amount, type, description
            ) VALUES (
                v_tenant_id, v_customer_id, p_appointment_id, v_pix_paid, 'credit_earned', 'Valor convertido de PIX por cancelamento'
            );
        ELSIF p_refund_preference = 'refund' THEN
            -- Criar solicitação de estorno
            INSERT INTO public.refund_requests (
                tenant_id, customer_id, appointment_id, amount, status, created_at
            ) VALUES (
                v_tenant_id, v_customer_id, p_appointment_id, v_pix_paid, 'requested', NOW()
            );
        END IF;
    END IF;

    -- 5. Atualizar Status do Agendamento
    UPDATE public.appointments
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = p_cancelled_by,
        cancel_source = p_source,
        refund_preference = p_refund_preference,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    -- 6. Cancelar Transação Financeira de Entrada (se existir)
    INSERT INTO public.transactions (
        user_id, tenant_id, appointment_id, barber_id, type, category, 
        amount, description, date
    ) VALUES (
        v_tenant_id, v_tenant_id, p_appointment_id, v_appt.barber_id, 'expense', 'Estorno',
        COALESCE(v_appt.total_price, 0), 'Cancelamento: ' || p_appointment_id, CURRENT_DATE
    );

    -- 7. Recalcular saldos
    PERFORM public.fn_recalculate_customer_balances(v_customer_id);

    RETURN jsonb_build_object('success', true, 'status_after', 'cancelled');
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(token_val text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_customer_id uuid;
    v_total_price numeric;
    v_items jsonb;
    v_payment_method text;
    v_payment_status text;
    v_appointment_id uuid;
    v_refund_amount numeric;
BEGIN
    -- Get appointment details
    SELECT id, customer_id, total_price, items, payment_method, payment_status
    INTO v_appointment_id, v_customer_id, v_total_price, v_items, v_payment_method, v_payment_status
    FROM public.appointments
    WHERE cancel_token = token_val AND status = 'scheduled'
    LIMIT 1;

    IF v_appointment_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Update appointment status
    UPDATE public.appointments
    SET status = 'cancelled', updated_at = now()
    WHERE id = v_appointment_id;

    -- Handle credits if paid via PIX
    IF v_payment_method = 'pix' AND v_payment_status = 'paid' THEN
        -- Calculate refund amount from items if possible
        v_refund_amount := 0;
        IF v_items IS NOT NULL AND jsonb_array_length(v_items) > 0 THEN
            SELECT SUM((item->>'price')::numeric * COALESCE((item->>'quantity')::numeric, 1))
            INTO v_refund_amount
            FROM jsonb_array_elements(v_items) AS item;
        END IF;
        
        IF v_refund_amount IS NULL OR v_refund_amount = 0 THEN
            v_refund_amount := v_total_price;
        END IF;

        UPDATE public.customers
        SET credits = COALESCE(credits, 0) + v_refund_amount
        WHERE id = v_customer_id;
    END IF;

    RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_appointment_conflict(p_barber_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_exclude_appointment_id uuid DEFAULT NULL::uuid, p_buffer_minutes integer DEFAULT NULL::integer)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_buffer integer;
  v_tenant uuid;
  v_start_eff timestamptz;
  v_end_eff timestamptz;
  v_conflict uuid;
BEGIN
  IF p_barber_id IS NULL OR p_start IS NULL OR p_end IS NULL THEN
    RETURN false;
  END IF;

  -- Descobre o buffer padrão do tenant do profissional se não informado
  IF p_buffer_minutes IS NULL THEN
    SELECT b.tenant_id INTO v_tenant FROM public.barbers b WHERE b.id = p_barber_id;
    IF v_tenant IS NOT NULL THEN
      SELECT COALESCE(pr.slot_buffer_minutes, 0) INTO v_buffer
      FROM public.profiles pr WHERE pr.id = v_tenant;
    END IF;
    v_buffer := COALESCE(v_buffer, 0);
  ELSE
    v_buffer := GREATEST(p_buffer_minutes, 0);
  END IF;

  v_start_eff := p_start - make_interval(mins => v_buffer);
  v_end_eff   := p_end   + make_interval(mins => v_buffer);

  SELECT a.id INTO v_conflict
  FROM public.appointments a
  WHERE a.barber_id = p_barber_id
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
    AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(v_start_eff, v_end_eff, '[)')
  LIMIT 1;

  RETURN v_conflict IS NOT NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.check_appointment_financial_status(p_appointment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_appt RECORD;
    v_is_pix_paid BOOLEAN;
    v_pix_amount NUMERIC(10,2);
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
BEGIN
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Agendamento não encontrado');
    END IF;

    -- Lógica de detecção de Pix
    v_pix_amount := COALESCE(v_appt.pix_amount, 0);
    -- Se o valor pix estiver zerado mas o método for pix e estiver pago, o valor real é o preço total menos créditos/cashback
    IF v_pix_amount = 0 AND v_appt.payment_method ~* 'pix' AND v_appt.payment_status = 'paid' THEN
        v_pix_amount := v_appt.total_price - COALESCE(v_appt.credits_used, v_appt.credit_used, 0) - COALESCE(v_appt.cashback_used, 0);
        IF v_pix_amount < 0 THEN v_pix_amount := 0; END IF;
    END IF;

    v_is_pix_paid := (v_appt.payment_status = 'paid') AND (v_pix_amount > 0);
    
    -- Lógica de detecção de Créditos e Cashback
    v_credits_used := COALESCE(v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE(v_appt.cashback_used, 0);

    RETURN jsonb_build_object(
        'has_paid_pix', v_is_pix_paid,
        'paid_pix_amount', v_pix_amount,
        'has_used_credits', (v_credits_used > 0),
        'used_credit_amount', v_credits_used,
        'has_used_cashback', (v_cashback_used > 0),
        'used_cashback_amount', v_cashback_used,
        'total_value', v_appt.total_price,
        'requires_financial_decision', (v_is_pix_paid OR v_credits_used > 0 OR v_cashback_used > 0)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_expired_trials()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    -- Se o trial expirou e não há assinatura ativa, o plano efetivo volta para free e status para 'blocked' (opcional)
    -- Aqui apenas definimos o plano efetivo. A lógica de bloqueio será no frontend/middleware.
    UPDATE public.profiles
    SET effective_plan = 'free'
    WHERE trial_end < now() 
      AND (plan = 'free' OR plan IS NULL)
      AND effective_plan != 'free';
      
    -- Se tem plano pago no profile mas o trial ainda está ativo, o effective_plan deve ser PRO (conforme regra do usuário)
    -- Mas a regra diz: "Durante trial effective_plan = PRO mesmo que selected_plan = ELITE"
    -- E "Após trial effective_plan = selected_plan"
    UPDATE public.profiles
    SET effective_plan = 'pro'
    WHERE trial_end > now() AND effective_plan != 'pro';
    
    UPDATE public.profiles
    SET effective_plan = plan
    WHERE trial_end <= now() AND effective_plan != plan AND plan != 'free';
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(_bucket text, _key text, _max integer, _window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM public.rate_limit_hits WHERE hit_at < now() - INTERVAL '1 day';
  SELECT COUNT(*) INTO v_count FROM public.rate_limit_hits
    WHERE bucket = _bucket AND key = _key AND hit_at > now() - (_window_seconds || ' seconds')::INTERVAL;
  IF v_count >= _max THEN
    RETURN false;
  END IF;
  INSERT INTO public.rate_limit_hits (bucket, key) VALUES (_bucket, _key);
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_subscription_eligibility(p_customer_id uuid, p_service_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
  v_service RECORD;
  v_mapping RECORD;
  v_global_used int := 0;
  v_service_used int := 0;
  v_service_price numeric(10,2) := 0;
  v_covered numeric(10,2) := 0;
  v_extra numeric(10,2) := 0;
  v_remaining int := NULL;
  v_reason text;
BEGIN
  SELECT * INTO v_service FROM public.services WHERE id = p_service_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_active_subscription', false, 'reason', 'service_not_found');
  END IF;
  v_service_price := COALESCE(v_service.price, 0);

  SELECT cs.*, sp.name AS plan_name, sp.usage_type, sp.max_uses_per_month, sp.monthly_price
    INTO v_sub
  FROM public.customer_subscriptions cs
  JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  WHERE cs.customer_id = p_customer_id
    AND cs.tenant_id = p_tenant_id
    AND cs.status = 'active'
  ORDER BY cs.started_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_active_subscription', false,
      'service_price', v_service_price,
      'reason', 'no_subscription'
    );
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;

  -- Service mapping
  SELECT * INTO v_mapping
  FROM public.subscription_plan_services
  WHERE plan_id = v_sub.plan_id AND service_id = p_service_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_active_subscription', true,
      'subscription_id', v_sub.id,
      'plan_id', v_plan.id,
      'plan_name', v_plan.name,
      'next_billing_date', v_sub.next_billing_at,
      'service_included', false,
      'service_price', v_service_price,
      'covered_amount', 0,
      'extra_amount_to_pay', v_service_price,
      'requires_payment', true,
      'reason', 'not_included'
    );
  END IF;

  -- Global uses (plan-level)
  IF v_plan.usage_type = 'limited' AND v_plan.max_uses_per_month IS NOT NULL THEN
    SELECT COUNT(*) INTO v_global_used
    FROM public.subscription_usage_logs
    WHERE subscription_id = v_sub.id
      AND used_at >= v_sub.current_period_start
      AND used_at < v_sub.current_period_end;

    IF v_global_used >= v_plan.max_uses_per_month THEN
      RETURN jsonb_build_object(
        'has_active_subscription', true,
        'subscription_id', v_sub.id,
        'plan_id', v_plan.id,
        'plan_name', v_plan.name,
        'next_billing_date', v_sub.next_billing_at,
        'service_included', true,
        'service_price', v_service_price,
        'remaining_uses', 0,
        'covered_amount', 0,
        'extra_amount_to_pay', v_service_price,
        'requires_payment', true,
        'reason', 'no_uses_left'
      );
    END IF;
    v_remaining := v_plan.max_uses_per_month - v_global_used;
  END IF;

  -- Per-service uses
  IF v_mapping.max_uses_per_period IS NOT NULL THEN
    SELECT COUNT(*) INTO v_service_used
    FROM public.subscription_usage_logs
    WHERE subscription_id = v_sub.id
      AND service_id = p_service_id
      AND used_at >= v_sub.current_period_start
      AND used_at < v_sub.current_period_end;

    IF v_service_used >= v_mapping.max_uses_per_period THEN
      RETURN jsonb_build_object(
        'has_active_subscription', true,
        'subscription_id', v_sub.id,
        'plan_id', v_plan.id,
        'plan_name', v_plan.name,
        'next_billing_date', v_sub.next_billing_at,
        'service_included', true,
        'service_price', v_service_price,
        'remaining_uses', 0,
        'covered_amount', 0,
        'extra_amount_to_pay', v_service_price,
        'requires_payment', true,
        'reason', 'no_uses_left'
      );
    END IF;
    v_remaining := LEAST(
      COALESCE(v_remaining, 999999),
      v_mapping.max_uses_per_period - v_service_used
    );
  END IF;

  -- Covered: full price (até o valor do serviço)
  v_covered := v_service_price;
  v_extra := 0;
  v_reason := 'full_coverage';

  RETURN jsonb_build_object(
    'has_active_subscription', true,
    'subscription_id', v_sub.id,
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'next_billing_date', v_sub.next_billing_at,
    'service_included', true,
    'service_price', v_service_price,
    'remaining_uses', v_remaining,
    'covered_amount', v_covered,
    'extra_amount_to_pay', v_extra,
    'requires_payment', false,
    'reason', v_reason
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_customer_profile(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id UUID;
    v_customer_id UUID;
    v_phone TEXT;
    v_email_confirmed BOOLEAN;
BEGIN
    -- Get current user ID
    v_user_id := (SELECT auth.uid());
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Validate user
    SELECT (email_confirmed_at IS NOT NULL), phone
    INTO v_email_confirmed, v_phone
    FROM auth.users
    WHERE id = v_user_id;

    -- Find customer by phone in the specific tenant
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE tenant_id = p_tenant_id
      AND (
          phone = v_phone 
          OR phone = REPLACE(REPLACE(REPLACE(REPLACE(v_phone, ' ', ''), '-', ''), '(', ''), ')', '')
      )
    LIMIT 1;

    IF v_customer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Customer profile not found');
    END IF;

    -- Check if already claimed
    IF EXISTS (
        SELECT 1 FROM public.customers 
        WHERE id = v_customer_id AND auth_user_id IS NOT NULL AND auth_user_id != v_user_id
    ) THEN
        RAISE EXCEPTION 'Profile already linked to another account';
    END IF;

    -- Update
    UPDATE public.customers
    SET auth_user_id = v_user_id,
        updated_at = NOW()
    WHERE id = v_customer_id;

    RETURN jsonb_build_object(
        'success', true, 
        'customer_id', v_customer_id
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_staff_verification_challenge(p_barber_id uuid, p_email text, p_max_attempts integer DEFAULT 5)
 RETURNS TABLE(claimed boolean, challenge_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.verification_challenges
  SET consumed_at = now()
  WHERE id = (
    SELECT id
    FROM public.verification_challenges
    WHERE barber_id = p_barber_id
      AND email = p_email
      AND purpose = 'staff_email_verification'
      AND verified_at IS NOT NULL
      AND consumed_at IS NULL
      AND expires_at > now()
      AND attempts < p_max_attempts
    ORDER BY verified_at DESC
    LIMIT 1
    FOR UPDATE
  )
  RETURNING id INTO v_id;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, NULL::uuid;
  ELSE
    RETURN QUERY
    SELECT true, v_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_invalid_cashback(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_enabled boolean;
  v_removed int := 0;
  v_balance_fix int := 0;
BEGIN
  SELECT COALESCE(cashback_enabled, false) INTO v_enabled FROM public.profiles WHERE id = p_tenant_id;
  IF v_enabled THEN
    RETURN jsonb_build_object('success', false, 'reason', 'cashback_enabled');
  END IF;

  WITH del AS (
    DELETE FROM public.cashback_transactions
     WHERE tenant_id = p_tenant_id AND type = 'earned'
     RETURNING customer_id, amount
  ),
  rebal AS (
    SELECT customer_id, SUM(amount) AS total FROM del GROUP BY customer_id
  ),
  upd AS (
    UPDATE public.customers c
       SET cashback_balance = GREATEST(0, COALESCE(c.cashback_balance,0) - r.total),
           updated_at = now()
      FROM rebal r
     WHERE c.id = r.customer_id
     RETURNING c.id
  )
  SELECT (SELECT count(*) FROM del), (SELECT count(*) FROM upd) INTO v_removed, v_balance_fix;

  UPDATE public.appointments
     SET cashback_earned = 0
   WHERE tenant_id = p_tenant_id AND COALESCE(cashback_earned,0) > 0;

  RETURN jsonb_build_object('success', true, 'removed', v_removed, 'customers_updated', v_balance_fix);
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_barbershop_financial_data(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_customer_record RECORD;
    v_count_appts INTEGER;
BEGIN
    -- Verificar permissão (apenas o próprio tenant ou super_admin)
    -- Em uma implementação real, checaríamos auth.uid()
    
    -- Contar agendamentos antes
    SELECT count(*) INTO v_count_appts FROM public.appointments WHERE tenant_id = p_tenant_id;

    -- Delete activity data (Ordem importa para chaves estrangeiras)
    DELETE FROM public.appointment_status_logs WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = p_tenant_id);
    DELETE FROM public.refund_requests WHERE tenant_id = p_tenant_id;
    DELETE FROM public.cashback_transactions WHERE tenant_id = p_tenant_id;
    DELETE FROM public.credit_transactions WHERE tenant_id = p_tenant_id;
    DELETE FROM public.transactions WHERE tenant_id = p_tenant_id;
    DELETE FROM public.product_sales WHERE tenant_id = p_tenant_id;
    DELETE FROM public.appointments WHERE tenant_id = p_tenant_id;
    DELETE FROM public.financial_adjustment_logs WHERE tenant_id = p_tenant_id;
    
    -- Recalculate balances for all customers of this tenant
    FOR v_customer_record IN SELECT id FROM public.customers WHERE tenant_id = p_tenant_id LOOP
        PERFORM public.fn_recalculate_customer_balances(v_customer_record.id);
        
        -- Também zerar campos legados se houver
        UPDATE public.customers 
        SET 
            credits = 0, 
            cashback_balance = 0, 
            loyalty_points = 0,
            total_spent = 0,
            appointments_count = 0
        WHERE id = v_customer_record.id;
    END LOOP;
    
    -- Zerar saldo da carteira (wallet) se existir
    UPDATE public.wallet SET balance = 0 WHERE user_id = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Dados financeiros limpos com sucesso',
        'appointments_removed', v_count_appts
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_barbershop_test_data(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean := false;
  v_appt_ids uuid[];
  v_cust_ids uuid[];
  v_wallet_ids uuid[];
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  BEGIN
    SELECT public.has_role(v_caller, 'admin'::app_role) INTO v_is_admin;
  EXCEPTION WHEN OTHERS THEN v_is_admin := false;
  END;
  IF v_caller <> p_tenant_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Sem permissão para limpar dados deste tenant';
  END IF;

  SELECT array_agg(id) INTO v_appt_ids FROM public.appointments WHERE user_id = p_tenant_id OR tenant_id = p_tenant_id;
  SELECT array_agg(id) INTO v_cust_ids FROM public.customers WHERE tenant_id = p_tenant_id;
  SELECT array_agg(id) INTO v_wallet_ids FROM public.wallet WHERE customer_id = ANY(COALESCE(v_cust_ids, ARRAY[]::uuid[]));

  IF v_appt_ids IS NOT NULL THEN
    DELETE FROM public.automation_logs           WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_conversations  WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_cron_runs      WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_webhook_logs   WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_v2_dispatches  WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_v2_sessions    WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_v2_logs        WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_queue          WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_dispatches     WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_send_history   WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.whatsapp_conversations    WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.whatsapp_delivery_logs    WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.service_ratings           WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.wallet_transactions       WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.transactions              WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.credit_transactions       WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.customer_credits          WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.cashback_transactions     WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.refund_audits             WHERE refund_id IN (SELECT id FROM public.refund_requests WHERE appointment_id = ANY(v_appt_ids));
    DELETE FROM public.refund_requests           WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.financial_adjustment_logs WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.appointment_status_logs   WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.appointment_reviews       WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.subscription_usage_logs   WHERE appointment_id = ANY(v_appt_ids);
    UPDATE public.appointments SET rescheduled_from_id = NULL WHERE rescheduled_from_id = ANY(v_appt_ids);
  END IF;

  DELETE FROM public.appointment_reviews       WHERE tenant_id = p_tenant_id;
  DELETE FROM public.subscription_usage_logs   WHERE tenant_id = p_tenant_id;
  DELETE FROM public.appointment_groups        WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_queue          WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_dispatches     WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_send_history   WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_v2_dispatches  WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_v2_sessions    WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_v2_logs        WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_conversations  WHERE tenant_id = p_tenant_id;
  DELETE FROM public.zapi_webhook_debug        WHERE tenant_id = p_tenant_id;
  DELETE FROM public.financial_adjustment_logs WHERE tenant_id = p_tenant_id;

  DELETE FROM public.appointments WHERE user_id = p_tenant_id OR tenant_id = p_tenant_id;

  DELETE FROM public.transactions   WHERE tenant_id = p_tenant_id OR user_id = p_tenant_id;
  DELETE FROM public.refund_audits  WHERE tenant_id = p_tenant_id;
  DELETE FROM public.refund_requests WHERE tenant_id = p_tenant_id;
  DELETE FROM public.product_sales  WHERE tenant_id = p_tenant_id;

  IF v_cust_ids IS NOT NULL THEN
    DELETE FROM public.credit_transactions   WHERE customer_id = ANY(v_cust_ids);
    DELETE FROM public.customer_credits      WHERE customer_id = ANY(v_cust_ids);
    DELETE FROM public.cashback_transactions WHERE customer_id = ANY(v_cust_ids);
    DELETE FROM public.loyalty_rewards       WHERE customer_id = ANY(v_cust_ids);
    DELETE FROM public.subscription_loyalty_history WHERE customer_id = ANY(v_cust_ids);
  END IF;
  IF v_wallet_ids IS NOT NULL THEN
    DELETE FROM public.wallet_transactions WHERE wallet_id = ANY(v_wallet_ids);
    UPDATE public.wallet SET balance = 0 WHERE id = ANY(v_wallet_ids);
  END IF;

  DELETE FROM public.loyalty_campaign_participations
    WHERE campaign_id IN (SELECT id FROM public.loyalty_campaigns WHERE tenant_id = p_tenant_id);
  DELETE FROM public.subscription_loyalty_history WHERE tenant_id = p_tenant_id;
  DELETE FROM public.subscription_loyalty_rewards WHERE tenant_id = p_tenant_id;

  DELETE FROM public.commission_entries  WHERE tenant_id = p_tenant_id;
  DELETE FROM public.commission_closings WHERE tenant_id = p_tenant_id;
  DELETE FROM public.barber_commissions  WHERE tenant_id = p_tenant_id;

  UPDATE public.customers
     SET credits = 0, credit_balance = 0, credits_used = 0,
         cashback_balance = 0, cashback_used = 0,
         loyalty_points = 0, total_spent = 0, lifetime_value = 0,
         last_visit = NULL
   WHERE tenant_id = p_tenant_id;

  UPDATE public.customer_subscriptions SET uses_this_period = 0 WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object('success', true, 'tenant_id', p_tenant_id, 'cleared_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_subscription_benefit(p_appointment_id uuid, p_subscription_id uuid, p_service_id uuid, p_covered_amount numeric, p_extra_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  INSERT INTO public.subscription_usage_logs (
    tenant_id, subscription_id, subscription_plan_id, customer_id, service_id,
    appointment_id, benefit_type, covered_amount, extra_amount,
    used_at, period_start, period_end
  ) VALUES (
    v_sub.tenant_id, v_sub.id, v_sub.plan_id, v_sub.customer_id, p_service_id,
    p_appointment_id, 'service', COALESCE(p_covered_amount, 0), COALESCE(p_extra_amount, 0),
    now(), v_sub.current_period_start, v_sub.current_period_end
  ) ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL DO NOTHING;

  UPDATE public.customer_subscriptions
  SET uses_this_period = uses_this_period + 1,
      updated_at = now()
  WHERE id = p_subscription_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_subscription_use(p_subscription_id uuid, p_appointment_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions
    WHERE id = p_subscription_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura não encontrada');
  END IF;

  IF v_sub.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura não está ativa');
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;

  IF v_plan.usage_type = 'limited' AND v_sub.uses_this_period >= COALESCE(v_plan.max_uses_per_month, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Limite mensal atingido');
  END IF;

  UPDATE public.customer_subscriptions
    SET uses_this_period = uses_this_period + 1, updated_at = now()
    WHERE id = p_subscription_id;

  INSERT INTO public.subscription_usage_logs (
    tenant_id, subscription_id, appointment_id, period_start, period_end
  ) VALUES (
    v_sub.tenant_id, p_subscription_id, p_appointment_id, v_sub.current_period_start, v_sub.current_period_end
  )
  ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('success', true, 'uses_this_period', v_sub.uses_this_period + 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.convert_appointment_to_credit(p_appointment_id uuid, p_customer_id uuid, p_tenant_id uuid, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_appointment RECORD;
    v_credit_id UUID;
BEGIN
    -- Select with row-level lock
    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appointment.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento já está cancelado');
    END IF;

    -- Extra safety: check if this specific appointment has already been converted
    IF v_appointment.refund_status = 'converted_to_credit' THEN
         RETURN jsonb_build_object('success', false, 'error', 'Este agendamento já foi convertido em crédito');
    END IF;

    -- Double check in customer_credits table by appointment_id
    IF EXISTS (SELECT 1 FROM customer_credits WHERE appointment_id = p_appointment_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Crédito já gerado para este agendamento');
    END IF;

    -- 1. Create the credit record
    INSERT INTO customer_credits (
        tenant_id,
        customer_id,
        appointment_id,
        payment_id,
        amount,
        status
    ) VALUES (
        p_tenant_id,
        p_customer_id,
        p_appointment_id,
        v_appointment.payment_id,
        p_amount,
        'available'
    ) RETURNING id INTO v_credit_id;

    -- 2. Update the appointment status and source
    UPDATE appointments 
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        cancel_source = 'customer_credit_conversion',
        refund_status = 'converted_to_credit',
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 3. Update the global credit balance on customer record
    UPDATE customers 
    SET 
        credits = COALESCE(credits, 0) + p_amount,
        updated_at = now()
    WHERE id = p_customer_id;

    -- 4. Log status change
    INSERT INTO appointment_status_logs (
        appointment_id,
        old_status,
        new_status,
        changed_by_type,
        source,
        metadata
    ) VALUES (
        p_appointment_id,
        v_appointment.status,
        'cancelled',
        'customer',
        'public_link',
        jsonb_build_object(
            'action', 'convert_to_credit',
            'amount', p_amount,
            'credit_id', v_credit_id,
            'payment_id', v_appointment.payment_id
        )
    );

    RETURN jsonb_build_object('success', true, 'credit_id', v_credit_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_admin_notification(p_type text, p_title text, p_message text DEFAULT NULL::text, p_tenant_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid, p_related_entity_type text DEFAULT NULL::text, p_related_entity_id uuid DEFAULT NULL::uuid, p_action_url text DEFAULT NULL::text, p_priority text DEFAULT 'normal'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.admin_notifications
    (type, title, description, message, tenant_id, user_id, related_entity_type, related_entity_id, action_url, priority, is_read)
  VALUES
    (p_type, p_title, p_message, p_message, p_tenant_id, p_user_id, p_related_entity_type, p_related_entity_id, p_action_url, p_priority, false)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.create_barber_commission_for_appointment(p_appointment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_appt record;
  v_barber record;
  v_service_amount numeric(10,2) := 0;
  v_commission_type text := 'percentage';
  v_percentage numeric(10,2) := 0;
  v_fixed numeric(10,2) := 0;
  v_bonus numeric(10,2) := 0;
  v_commission numeric(10,2) := 0;
  v_id uuid;
  v_status text;
BEGIN
  SELECT a.*, c.name AS customer_name, s.name AS service_name
    INTO v_appt
  FROM public.appointments a
  LEFT JOIN public.customers c ON c.id = a.customer_id
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'appointment_not_found');
  END IF;

  IF COALESCE(v_appt.status, '') <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'appointment_not_completed');
  END IF;

  IF v_appt.barber_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'no_barber');
  END IF;

  SELECT * INTO v_barber
  FROM public.barbers
  WHERE id = v_appt.barber_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'barber_not_found');
  END IF;

  v_service_amount := COALESCE(v_appt.service_amount, v_appt.original_total, v_appt.total_price, 0);
  v_commission_type := COALESCE(NULLIF(v_barber.commission_type, ''), 'percentage');
  v_percentage := COALESCE(v_barber.commission_rate, 0);
  v_fixed := COALESCE(v_barber.commission_fixed_value, 0);
  v_bonus := COALESCE(v_barber.commission_bonus_value, 0);

  IF v_commission_type = 'fixed' THEN
    v_commission := v_fixed;
  ELSIF v_commission_type = 'hybrid' THEN
    v_commission := (v_service_amount * v_percentage / 100) + v_bonus;
  ELSE
    v_commission := v_service_amount * v_percentage / 100;
  END IF;

  v_commission := ROUND(GREATEST(v_commission, 0), 2);

  INSERT INTO public.barber_commissions (
    tenant_id, barber_id, appointment_id, customer_id, service_id, service_name,
    service_amount, commission_type, commission_percentage, commission_fixed_amount,
    commission_amount, status, created_at, updated_at
  ) VALUES (
    COALESCE(v_appt.tenant_id, v_barber.tenant_id, v_appt.user_id, v_barber.user_id),
    v_appt.barber_id,
    v_appt.id,
    v_appt.customer_id,
    v_appt.service_id,
    v_appt.service_name,
    v_service_amount,
    v_commission_type,
    CASE WHEN v_commission_type IN ('percentage','hybrid') THEN v_percentage ELSE 0 END,
    CASE WHEN v_commission_type = 'hybrid' THEN v_fixed + v_bonus ELSE v_fixed END,
    v_commission,
    'pending',
    COALESCE(v_appt.completed_at, now()),
    now()
  )
  ON CONFLICT (appointment_id, barber_id) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      customer_id = EXCLUDED.customer_id,
      service_id = EXCLUDED.service_id,
      service_name = EXCLUDED.service_name,
      service_amount = EXCLUDED.service_amount,
      commission_type = EXCLUDED.commission_type,
      commission_percentage = EXCLUDED.commission_percentage,
      commission_fixed_amount = EXCLUDED.commission_fixed_amount,
      commission_amount = CASE
        WHEN public.barber_commissions.status = 'pending' THEN EXCLUDED.commission_amount
        ELSE public.barber_commissions.commission_amount
      END,
      status = CASE
        WHEN public.barber_commissions.status = 'cancelled' THEN 'pending'
        ELSE public.barber_commissions.status
      END,
      created_at = COALESCE(public.barber_commissions.created_at, EXCLUDED.created_at),
      updated_at = now()
  RETURNING id, status INTO v_id, v_status;

  RETURN jsonb_build_object(
    'success', true,
    'commission_id', v_id,
    'service_amount', v_service_amount,
    'commission_amount', v_commission,
    'status', v_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid, p_changed_by_type text DEFAULT 'system'::text, p_changed_by_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'rpc'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_credit_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_pix_amount NUMERIC(10,2);
    v_cash_amount NUMERIC(10,2);
    v_card_amount NUMERIC(10,2);
    v_final_amount NUMERIC(10,2);
    v_total_price NUMERIC(10,2);
    v_sub_covered NUMERIC(10,2);
    v_extra_amount NUMERIC(10,2);
    v_cashbackable_base NUMERIC(10,2);
    v_cashback_earned NUMERIC(10,2) := 0;
    v_cashback_percentage NUMERIC;
    v_cashback_enabled BOOLEAN := false;
    v_existing_trans BOOLEAN;
    v_status_before TEXT;
    v_description TEXT;
    v_cashback_tx_id UUID;
    v_cashback_skipped BOOLEAN := false;
    v_cashback_blocked_by_subscription BOOLEAN := false;
    v_cashback_blocked_by_module BOOLEAN := false;
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_income_amount NUMERIC(10,2);
    v_fully_covered BOOLEAN;
    v_commission_result jsonb;
BEGIN
    SELECT a.*, c.name as customer_name, s.name as service_name
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'appointment_not_found');
    END IF;

    v_status_before := v_appt.status;
    IF v_appt.status = 'completed' THEN
      v_commission_result := public.create_barber_commission_for_appointment(p_appointment_id);
      RETURN jsonb_build_object('success', true, 'already', true, 'commission', v_commission_result);
    END IF;

    SELECT * FROM public.profiles WHERE id = v_appt.tenant_id INTO v_tenant;

    v_total_price := COALESCE(v_appt.total_price, 0);
    v_sub_covered := COALESCE(v_appt.subscription_covered_amount, 0);
    v_extra_amount := GREATEST(0, v_total_price - v_sub_covered);
    v_fully_covered := (v_sub_covered >= v_total_price AND v_total_price > 0);

    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, 0);
    v_card_amount := COALESCE((p_metadata->>'card_amount')::numeric, 0);

    IF v_fully_covered THEN
        v_final_amount := 0;
    ELSE
        v_final_amount := GREATEST(0, v_extra_amount - v_credit_used - v_cashback_used);
    END IF;

    IF v_fully_covered THEN
        v_payment_method := 'subscription';
        v_payment_status := 'covered_by_subscription';
    ELSE
        v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');
        v_payment_status := COALESCE(v_appt.payment_status, 'paid');
    END IF;

    v_cashback_enabled := COALESCE(v_tenant.cashback_enabled, false);
    v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
    v_cashbackable_base := v_extra_amount;

    IF NOT v_cashback_enabled THEN
        v_cashback_blocked_by_module := true;
        v_cashback_earned := 0;
    ELSIF v_fully_covered THEN
        v_cashback_blocked_by_subscription := true;
        v_cashback_earned := 0;
    ELSIF v_cashback_percentage > 0 AND v_cashbackable_base > 0 THEN
        v_cashback_earned := (v_cashbackable_base * v_cashback_percentage) / 100;
        IF v_sub_covered > 0 THEN
            v_cashback_blocked_by_subscription := true;
        END IF;
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.transactions WHERE appointment_id = p_appointment_id) INTO v_existing_trans;
    v_income_amount := v_extra_amount;

    IF NOT v_existing_trans AND v_income_amount > 0 THEN
        v_description := 'Atendimento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente')
            || CASE WHEN v_sub_covered > 0 THEN ' (diferença assinatura)' ELSE '' END;

        INSERT INTO public.transactions (
            user_id, tenant_id, appointment_id, barber_id, type, category,
            amount, pix_amount, cash_amount, credit_card_amount,
            credits_amount, cashback_amount, payment_method,
            description, date, payment_breakdown
        ) VALUES (
            v_appt.tenant_id, v_appt.tenant_id, p_appointment_id, v_appt.barber_id, 'income', 'Serviço',
            v_income_amount, v_pix_amount, v_cash_amount, v_card_amount,
            v_credit_used, v_cashback_used, v_payment_method,
            v_description, CURRENT_DATE,
            jsonb_build_object(
                'pix', v_pix_amount, 'cash', v_cash_amount, 'card', v_card_amount,
                'credits', v_credit_used, 'cashback', v_cashback_used,
                'subscription_covered', v_sub_covered,
                'total_price', v_total_price, 'extra_amount', v_extra_amount
            )
        );
    END IF;

    IF v_cashback_earned > 0 THEN
        SELECT id FROM public.cashback_transactions
        WHERE appointment_id = p_appointment_id INTO v_cashback_tx_id;

        IF v_cashback_tx_id IS NULL THEN
            INSERT INTO public.cashback_transactions (
                customer_id, tenant_id, appointment_id, amount, base_amount, type, description
            ) VALUES (
                v_appt.customer_id, v_appt.tenant_id, p_appointment_id, v_cashback_earned, v_cashbackable_base, 'earned',
                'Cashback: ' || COALESCE(v_appt.service_name, 'Serviço') ||
                CASE WHEN v_sub_covered > 0 THEN ' (apenas valor extra)' ELSE '' END
            ) RETURNING id INTO v_cashback_tx_id;

            UPDATE public.customers
            SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned,
                updated_at = now()
            WHERE id = v_appt.customer_id;
        END IF;
    ELSE
        v_cashback_skipped := true;
    END IF;

    IF v_appt.subscription_id IS NOT NULL AND v_sub_covered > 0 THEN
        UPDATE public.subscription_usage_logs
        SET status = 'consumed',
            used_at = COALESCE(used_at, now())
        WHERE appointment_id = p_appointment_id
          AND (status IS NULL OR status NOT IN ('consumed','refunded'));
    END IF;

    UPDATE public.appointments
    SET status = 'completed',
        completed_at = now(),
        updated_at = now(),
        cashback_earned = v_cashback_earned,
        payment_method = v_payment_method,
        payment_status = v_payment_status,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used
    WHERE id = p_appointment_id;

    v_commission_result := public.create_barber_commission_for_appointment(p_appointment_id);

    BEGIN
      INSERT INTO public.appointment_status_logs(
        appointment_id, tenant_id, status_before, status_after,
        changed_by_type, changed_by_id, source, metadata
      ) VALUES (
        p_appointment_id, v_appt.tenant_id, v_status_before, 'completed',
        p_changed_by_type, p_changed_by_id, p_source,
        COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'cashback_earned', v_cashback_earned,
          'cashback_tx_id', v_cashback_tx_id,
          'cashback_blocked_by_subscription', v_cashback_blocked_by_subscription,
          'cashback_blocked_by_module', v_cashback_blocked_by_module,
          'extra_amount', v_extra_amount,
          'subscription_covered', v_sub_covered,
          'barber_commission', v_commission_result
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object(
      'success', true,
      'appointment_id', p_appointment_id,
      'cashback_earned', v_cashback_earned,
      'cashback_skipped', v_cashback_skipped,
      'cashback_blocked_by_subscription', v_cashback_blocked_by_subscription,
      'cashback_blocked_by_module', v_cashback_blocked_by_module,
      'commission', v_commission_result
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_barber_id uuid DEFAULT NULL::uuid, p_customer_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        barber_id,
        customer_id,
        metadata
    ) VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_barber_id,
        p_customer_id,
        p_metadata
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_or_get_public_customer(p_slug text, p_name text, p_phone text, p_email text DEFAULT NULL::text, p_barber_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_shop_id uuid;
  v_owner_id uuid;
  v_phone text;
  v_customer_id uuid;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN RAISE EXCEPTION 'slug_required'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF p_phone IS NULL THEN RAISE EXCEPTION 'phone_required'; END IF;

  v_phone := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_phone) < 8 THEN RAISE EXCEPTION 'invalid_phone'; END IF;

  SELECT id, owner_id INTO v_shop_id, v_owner_id
  FROM public.barbershops
  WHERE slug = p_slug
  LIMIT 1;

  IF v_shop_id IS NULL THEN RAISE EXCEPTION 'barbershop_not_found'; END IF;
  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'barbershop_owner_missing'; END IF;

  -- Match by phone against either owner_id or shop id (legacy rows)
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE (user_id = v_owner_id OR user_id = v_shop_id OR tenant_id = v_owner_id OR tenant_id = v_shop_id)
    AND regexp_replace(coalesce(phone,''), '\D', '', 'g') = v_phone
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET name = COALESCE(NULLIF(trim(p_name), ''), name),
        email = COALESCE(p_email, email)
    WHERE id = v_customer_id;
    RETURN v_customer_id;
  END IF;

  INSERT INTO public.customers (
    user_id, tenant_id, barber_id, name, phone, email
  ) VALUES (
    v_owner_id, v_owner_id, p_barber_id, trim(p_name), v_phone, p_email
  )
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_walkin_appointment(p_tenant_id uuid, p_barber_id uuid, p_customer_id uuid, p_service_id uuid, p_start_time timestamp with time zone, p_duration_minutes integer, p_total_price numeric DEFAULT NULL::numeric, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_end timestamptz := p_start_time + make_interval(mins => p_duration_minutes);
  v_new_id uuid;
  v_price numeric;
  v_is_owner boolean;
  v_role_ok boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  v_is_owner := (v_actor = p_tenant_id);
  IF NOT v_is_owner THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_actor
        AND role IN ('admin','super_admin','manager','receptionist')
    ) INTO v_role_ok;
  END IF;

  IF NOT (v_is_owner OR v_role_ok) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para criar atendimento presencial');
  END IF;

  IF public.check_appointment_conflict(p_barber_id, p_start_time, v_end, NULL, NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Horário indisponível para este profissional');
  END IF;

  IF p_total_price IS NULL THEN
    SELECT price INTO v_price FROM public.services WHERE id = p_service_id;
  ELSE
    v_price := p_total_price;
  END IF;

  INSERT INTO public.appointments (
    tenant_id, user_id, barber_id, customer_id, service_id,
    start_time, end_time, status, appointment_type,
    total_price, service_amount, final_amount,
    source, notes, walkin_arrived_at,
    updated_by_type, updated_by_id
  ) VALUES (
    p_tenant_id, p_tenant_id, p_barber_id, p_customer_id, p_service_id,
    p_start_time, v_end, 'scheduled', 'walk_in',
    v_price, v_price, COALESCE(v_price, 0),
    'walkin', p_notes, now(),
    'admin', v_actor
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', v_new_id);
END $function$;

CREATE OR REPLACE FUNCTION public.customer_cancel_return_credit(p_appointment_id uuid, p_source text DEFAULT 'customer_portal'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_appt RECORD;
    v_response JSONB;
BEGIN
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado.');
    END IF;

    SELECT convert_appointment_to_credit(
        p_appointment_id,
        v_appt.customer_id,
        v_appt.tenant_id,
        v_appt.total_price
    ) INTO v_response;

    IF NOT (v_response->>'success')::BOOLEAN THEN
        RETURN v_response;
    END IF;

    UPDATE public.appointments
    SET 
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = 'customer',
        cancel_source = p_source,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.customer_cancel_simple(p_appointment_id uuid, p_source text DEFAULT 'customer_portal'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_fin JSONB;
BEGIN
    v_fin := public.check_appointment_financial_status(p_appointment_id);

    IF COALESCE((v_fin->>'requires_financial_decision')::boolean, false)
       OR COALESCE((v_fin->>'has_paid_pix')::boolean, false)
       OR COALESCE((v_fin->>'has_used_credits')::boolean, false)
       OR COALESCE((v_fin->>'has_used_cashback')::boolean, false) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este agendamento possui valores financeiros e requer decisão específica.');
    END IF;

    UPDATE public.appointments
    SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = 'customer',
        cancel_source = p_source,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrement_product_stock(prod_id uuid, amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity - amount
  WHERE id = prod_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.emit_admin_event_panel(p_event_key text, p_title text, p_message text DEFAULT ''::text, p_severity text DEFAULT 'info'::text, p_tenant_id uuid DEFAULT NULL::uuid, p_action_url text DEFAULT NULL::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count integer := 0;
  v_admin record;
  v_sub record;
  v_priority text;
BEGIN
  v_priority := CASE p_severity
    WHEN 'critical' THEN 'critical'
    WHEN 'warning' THEN 'high'
    ELSE 'normal'
  END;

  FOR v_admin IN
    SELECT id FROM public.profiles WHERE role = 'super_admin'
  LOOP
    SELECT * INTO v_sub
      FROM public.admin_event_subscriptions
      WHERE user_id = v_admin.id AND event_key = p_event_key;

    -- Default (no explicit subscription) = panel on
    IF v_sub.id IS NOT NULL AND NOT COALESCE(v_sub.enabled, true) THEN CONTINUE; END IF;
    IF v_sub.id IS NOT NULL AND NOT COALESCE(v_sub.channel_panel, true) THEN CONTINUE; END IF;

    INSERT INTO public.admin_notifications (
      user_id, event_key, type, severity, priority,
      title, message, description, tenant_id, action_url, payload
    ) VALUES (
      v_admin.id, p_event_key, p_event_key, p_severity, v_priority,
      p_title, p_message, p_message, p_tenant_id, p_action_url, p_payload
    );
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.admin_event_log (event_key, severity, payload, tenant_id, recipients_count, channels_delivered)
  VALUES (p_event_key, p_severity, p_payload, p_tenant_id, v_count, jsonb_build_object('panel', v_count));

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.emit_first_appointment_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  tenant_uuid uuid := NEW.tenant_id;
  existing_count int;
  biz text;
BEGIN
  IF tenant_uuid IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO existing_count
  FROM public.appointments
  WHERE tenant_id = tenant_uuid AND id <> NEW.id;

  IF existing_count > 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(business_name, email) INTO biz FROM public.profiles WHERE id = tenant_uuid;

  PERFORM net.http_post(
    url := (SELECT value FROM public.system_settings WHERE key = 'supabase_url' LIMIT 1),
    headers := '{}'::jsonb,
    body := jsonb_build_object('event', 'first_appointment', 'tenant_id', tenant_uuid, 'business_name', biz)
  ) WHERE false; -- placeholder no-op para evitar hard-fail se net.http_post não disponível

  INSERT INTO public.admin_event_log(event_key, severity, payload, tenant_id, recipients_count, channels_delivered)
  VALUES ('tenant.first_appointment.pending', 'info',
          jsonb_build_object('business_name', biz, 'appointment_id', NEW.id), tenant_uuid, 0, '{}'::jsonb);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_appointment_no_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Só valida se linha ficará ativa (cancelled/no_show liberam o horário)
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  IF NEW.barber_id IS NULL OR NEW.start_time IS NULL OR NEW.end_time IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.check_appointment_conflict(
    NEW.barber_id, NEW.start_time, NEW.end_time,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END,
    NULL
  ) THEN
    RAISE EXCEPTION 'Horário indisponível: já existe outro atendimento do profissional nesse intervalo'
      USING ERRCODE = 'P0001', HINT = 'appointment_overlap';
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.enqueue_subscription_renewal_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_template RECORD;
  v_customer RECORD;
  v_plan RECORD;
  v_barbershop_name TEXT;
  v_idem TEXT;
  v_count INTEGER := 0;
BEGIN
  FOR v_sub IN
    SELECT cs.*
    FROM public.customer_subscriptions cs
    WHERE cs.status IN ('active','trialing')
      AND cs.auto_renew = true
      AND cs.next_billing_at IS NOT NULL
      AND cs.next_billing_at::date = (CURRENT_DATE + INTERVAL '3 days')::date
  LOOP
    SELECT id, template, active INTO v_template
    FROM public.automation_templates
    WHERE tenant_id = v_sub.tenant_id AND key = 'subscription_renewal_upcoming'
    LIMIT 1;
    CONTINUE WHEN v_template.id IS NULL OR v_template.active IS NOT TRUE;

    SELECT id, name, phone INTO v_customer FROM public.customers WHERE id = v_sub.customer_id;
    CONTINUE WHEN v_customer.phone IS NULL OR v_customer.phone = '';

    SELECT name, monthly_price INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;
    SELECT COALESCE(business_name, responsible_name, 'Nossa Barbearia') INTO v_barbershop_name
    FROM public.profiles WHERE id = v_sub.tenant_id;

    v_idem := 'sub_renewal_' || v_sub.id::text || '_' || to_char(v_sub.next_billing_at, 'YYYYMMDD');

    BEGIN
      INSERT INTO public.automation_queue (
        tenant_id, automation_id, customer_id, automation_type, workflow_key,
        event_name, status, scheduled_for, attempts, idempotency_key, payload
      ) VALUES (
        v_sub.tenant_id, v_template.id, v_sub.customer_id,
        'subscription_renewal_upcoming', 'subscription_renewal_upcoming',
        'subscription.renewal_upcoming', 'pending', now(), 0, v_idem,
        jsonb_build_object(
          'customer_name', COALESCE(v_customer.name, 'Cliente'),
          'barbershop_name', v_barbershop_name,
          'subscription_plan', COALESCE(v_plan.name, 'Plano'),
          'subscription_amount', to_char(COALESCE(v_plan.monthly_price, 0), 'FM999G990D00'),
          'renewal_date', to_char(v_sub.next_billing_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
          'subscription_id', v_sub.id,
          'rendered', v_template.template
        )
      ) ON CONFLICT (idempotency_key) WHERE status <> 'error' DO NOTHING;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'enqueue_subscription_renewal_reminders failed for %: %', v_sub.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_appointment_tenant_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_single_primary_gateway()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.payment_gateways
       SET is_primary = false
     WHERE tenant_id = NEW.tenant_id
       AND id <> NEW.id
       AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_loyalty_rewards()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE v_count INTEGER;
BEGIN
    UPDATE public.loyalty_rewards
    SET status = 'expired'
    WHERE status = 'available'
      AND expires_at IS NOT NULL
      AND expires_at < now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_get_financial_summary(p_tenant_id uuid, p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'servicos_vendidos', COALESCE(SUM(total_price), 0),
        'entrada_caixa', COALESCE(SUM(pix_amount + cash_amount + credit_card_amount + debit_card_amount), 0),
        'cashback_concedido', COALESCE(SUM(cashback_earned), 0),
        'cashback_utilizado', COALESCE(SUM(cashback_used), 0),
        'creditos_utilizados', COALESCE(SUM(credits_used), 0),
        'assinatura_coberta', COALESCE(SUM(subscription_covered_amount), 0),
        'assinatura_extra', COALESCE(SUM(extra_amount), 0),
        'atendimentos_assinatura', COALESCE(SUM(CASE WHEN subscription_id IS NOT NULL THEN 1 ELSE 0 END), 0)
    ) INTO v_summary
    FROM public.appointments
    WHERE tenant_id = p_tenant_id 
      AND status = 'completed'
      AND completed_at::DATE BETWEEN p_start_date AND p_end_date;

    RETURN v_summary;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_on_appointment_created_enqueue_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
 DECLARE
     v_automation_id UUID;
     v_exists BOOLEAN;
 BEGIN
     -- Só processa para agendamentos confirmados (ou que acabaram de ser confirmados)
     IF NEW.status = 'confirmed' AND NEW.customer_id IS NOT NULL AND NEW.tenant_id IS NOT NULL THEN
         
         -- Se for um UPDATE, só prossegue se o status mudo para confirmed ou se não havia sido enfileirado antes
         IF TG_OP = 'UPDATE' THEN
            IF OLD.status = 'confirmed' THEN
                -- Se já estava confirmado, verifica se já existe uma fila para evitar duplicidade em atualizações triviais
                SELECT EXISTS (
                    SELECT 1 FROM public.automation_queue
                    WHERE appointment_id = NEW.id
                    AND workflow_key = 'appointment_confirmation'
                    AND status IN ('pending', 'processing', 'success')
                ) INTO v_exists;
                
                IF v_exists THEN
                    RETURN NEW;
                END IF;
            END IF;
         END IF;

         -- 1. Buscar ID do template de confirmação
         SELECT id INTO v_automation_id
         FROM public.automation_templates
         WHERE tenant_id = NEW.tenant_id AND key = 'appointment_confirmation'
         LIMIT 1;
         
         -- 2. Se não existir, criar um template padrão para este tenant
         IF v_automation_id IS NULL THEN
             INSERT INTO public.automation_templates (
                 tenant_id,
                 key,
                 name,
                 trigger_event,
                 template,
                 active
             ) VALUES (
                 NEW.tenant_id,
                 'appointment_confirmation',
                 'Confirmação de Agendamento',
                 'appointment_created',
                 'Olá, {customer_name}! 👋\n\nSeu agendamento na {barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: {service_name}\n💈 Profissional: {professional_name}\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}\n\nPara reagendar ou cancelar, acesse o link abaixo:\n{management_link}\n\nObrigado!',
                 true
             ) ON CONFLICT (tenant_id, key) DO UPDATE SET tenant_id = EXCLUDED.tenant_id RETURNING id INTO v_automation_id;
         END IF;

         -- 3. Verificação final de idempotência (redundante com o índice mas bom para lógica)
         SELECT EXISTS (
             SELECT 1 FROM public.automation_queue
             WHERE (appointment_id = NEW.id OR (NEW.appointment_group_id IS NOT NULL AND appointment_group_id = NEW.appointment_group_id))
             AND workflow_key = 'appointment_confirmation'
             AND status IN ('pending', 'processing', 'success')
         ) INTO v_exists;
         
         IF v_exists THEN
             RETURN NEW;
         END IF;

         -- 4. Inserir na fila de automação
         INSERT INTO public.automation_queue (
             tenant_id,
             automation_id,
             appointment_id,
             appointment_group_id,
             customer_id,
             automation_type,
             workflow_key,
             status,
             attempts,
             scheduled_for
         ) VALUES (
             NEW.tenant_id,
             v_automation_id,
             NEW.id,
             NEW.appointment_group_id,
             NEW.customer_id,
             'new_appointment',
             'appointment_confirmation',
             'pending',
             0,
             now()
         ) ON CONFLICT DO NOTHING;
     END IF;
     
     RETURN NEW;
 END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_recalculate_customer_loyalty(p_customer_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_points INTEGER;
    v_sub RECORD;
BEGIN
    SELECT * INTO v_sub FROM public.get_active_subscription(p_customer_id);

    -- Se assinante ativo e plano não participa da fidelidade tradicional, zera pontos
    IF FOUND AND v_sub.participates_traditional_loyalty = false THEN
      UPDATE public.customers
      SET loyalty_points = 0, updated_at = NOW()
      WHERE id = p_customer_id;
      RETURN 0;
    END IF;

    SELECT COUNT(*)
    INTO v_points
    FROM public.appointments
    WHERE customer_id = p_customer_id AND status = 'completed';

    UPDATE public.customers
    SET loyalty_points = v_points,
        updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN v_points;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_product_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
        -- Garantir que não termina com hífen
        NEW.slug := trim(trailing '-' from NEW.slug);
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_subscription_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
  v_attempts INT := 0;
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.customer_subscriptions WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists OR v_attempts > 12;
    v_attempts := v_attempts + 1;
  END LOOP;
  RETURN v_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_unique_slug(base_name text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  new_slug text;
  counter integer := 0;
BEGIN
  new_slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '-', 'g'));
  new_slug := trim(both '-' from new_slug);
  
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE slug = new_slug) OR EXISTS (SELECT 1 FROM public.barbershops WHERE slug = new_slug) LOOP
    counter := counter + 1;
    new_slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || counter;
    new_slug := trim(both '-' from new_slug);
  END LOOP;
  
  RETURN new_slug;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_appointment_by_management_token(p_token uuid)
 RETURNS TABLE(id uuid, tenant_id uuid, customer_id uuid, barber_id uuid, service_id uuid, start_time timestamp with time zone, end_time timestamp with time zone, status text, payment_status text, total_price numeric, customer_name text, service_name text, professional_name text, business_name text, professional_id uuid, cancellation_window_hours integer, management_token uuid, cancel_token uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.tenant_id,
    a.customer_id,
    a.barber_id,
    a.service_id,
    a.start_time,
    a.end_time,
    a.status,
    a.payment_status,
    a.total_price,
    c.name as customer_name,
    s.name as service_name,
    b.name as professional_name,
    p.business_name,
    a.barber_id as professional_id,
    COALESCE(p.cancellation_window_hours, 2) as cancellation_window_hours,
    a.management_token,
    a.cancel_token
  FROM appointments a
  JOIN customers c ON a.customer_id = c.id
  JOIN services s ON a.service_id = s.id
  JOIN barbers b ON a.barber_id = b.id
  JOIN profiles p ON a.tenant_id = p.id
  WHERE a.management_token = p_token OR a.cancel_token = p_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_appointment_group_by_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_group public.appointment_groups%ROWTYPE;
  v_result JSONB;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  SELECT * INTO v_group FROM public.appointment_groups WHERE group_token = _token LIMIT 1;
  IF v_group.id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'group', to_jsonb(v_group),
    'business', (SELECT jsonb_build_object('business_name', p.business_name, 'whatsapp_number', p.whatsapp_number, 'slug', p.slug) FROM public.profiles p WHERE p.id = v_group.tenant_id),
    'customer_name', (SELECT c.name FROM public.customers c WHERE c.id = v_group.customer_id),
    'appointments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'service_id', a.service_id, 'barber_id', a.barber_id,
        'start_time', a.start_time, 'end_time', a.end_time, 'status', a.status,
        'service_amount', a.service_amount, 'group_sequence', a.group_sequence,
        'management_token', a.management_token,
        'service_name', s.name, 'professional_name', b.name
      ) ORDER BY a.group_sequence)
      FROM public.appointments a
      LEFT JOIN public.services s ON s.id = a.service_id
      LEFT JOIN public.barbers b ON b.id = a.barber_id
      WHERE a.appointment_group_id = v_group.id
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_availability_slots(p_barber_id uuid, p_date date, p_duration_minutes integer DEFAULT 30, p_exclude_appointment_id uuid DEFAULT NULL::uuid, p_step_minutes integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tz text := 'America/Sao_Paulo';
  v_barber record;
  v_tenant uuid;
  v_buffer integer := 0;
  v_wh jsonb;
  v_daykey text;
  v_duration integer := GREATEST(COALESCE(p_duration_minutes, 30), 5);
  v_step integer := GREATEST(COALESCE(p_step_minutes, 30), 5);
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_open timestamptz;
  v_close timestamptz;
  v_break_start timestamptz;
  v_break_end timestamptz;
  v_now timestamptz := now();
  v_cand timestamptz;
  v_end timestamptz;
  v_state text;
  v_slots jsonb := '[]'::jsonb;
  v_candidates timestamptz[] := ARRAY[]::timestamptz[];
  v_appt record;
BEGIN
  IF p_barber_id IS NULL OR p_date IS NULL THEN
    RETURN jsonb_build_object('slots', '[]'::jsonb, 'buffer_minutes', 0, 'duration_minutes', v_duration);
  END IF;

  SELECT b.id, b.tenant_id, b.user_id, b.working_hours
    INTO v_barber
  FROM public.barbers b WHERE b.id = p_barber_id;

  IF v_barber.id IS NULL THEN
    RETURN jsonb_build_object('slots', '[]'::jsonb, 'buffer_minutes', 0, 'duration_minutes', v_duration);
  END IF;

  v_tenant := COALESCE(v_barber.tenant_id, v_barber.user_id);
  SELECT COALESCE(pr.slot_buffer_minutes, 0) INTO v_buffer
  FROM public.profiles pr WHERE pr.id = v_tenant;
  v_buffer := GREATEST(COALESCE(v_buffer, 0), 0);

  v_daykey := lower(to_char(p_date, 'FMday'));
  v_daykey := CASE v_daykey
    WHEN 'sunday' THEN 'sunday' WHEN 'monday' THEN 'monday' WHEN 'tuesday' THEN 'tuesday'
    WHEN 'wednesday' THEN 'wednesday' WHEN 'thursday' THEN 'thursday'
    WHEN 'friday' THEN 'friday' ELSE 'saturday' END;

  v_wh := (COALESCE(v_barber.working_hours, '{}'::jsonb)) -> v_daykey;

  IF v_wh IS NULL OR COALESCE((v_wh->>'enabled')::boolean, false) IS NOT TRUE
     OR v_wh->>'start' IS NULL OR v_wh->>'end' IS NULL THEN
    RETURN jsonb_build_object('slots', '[]'::jsonb, 'buffer_minutes', v_buffer, 'duration_minutes', v_duration, 'closed', true);
  END IF;

  v_open  := ((p_date::text || ' ' || (v_wh->>'start'))::timestamp) AT TIME ZONE v_tz;
  v_close := ((p_date::text || ' ' || (v_wh->>'end'))::timestamp) AT TIME ZONE v_tz;
  
  IF v_wh->>'break_start' IS NOT NULL AND v_wh->>'break_end' IS NOT NULL THEN
    v_break_start := ((p_date::text || ' ' || (v_wh->>'break_start'))::timestamp) AT TIME ZONE v_tz;
    v_break_end   := ((p_date::text || ' ' || (v_wh->>'break_end'))::timestamp) AT TIME ZONE v_tz;
  END IF;

  v_day_start := (p_date::text || ' 00:00:00')::timestamp AT TIME ZONE v_tz;
  v_day_end   := v_day_start + interval '1 day';

  -- Candidatos: grade regular do expediente
  v_cand := v_open;
  WHILE v_cand < v_close LOOP
    v_candidates := array_append(v_candidates, v_cand);
    v_cand := v_cand + make_interval(mins => v_step);
  END LOOP;

  -- Candidatos de encaixe: término real (+buffer) de cada atendimento do dia
  FOR v_appt IN
    SELECT a.start_time, a.end_time
    FROM public.appointments a
    WHERE a.barber_id = p_barber_id
      AND a.status NOT IN ('cancelled', 'no_show')
      AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
      AND a.start_time < v_day_end
      AND a.end_time > v_day_start
  LOOP
    v_cand := v_appt.end_time + make_interval(mins => v_buffer);
    IF v_cand > v_open AND v_cand < v_close AND NOT (v_cand = ANY (v_candidates)) THEN
      v_candidates := array_append(v_candidates, v_cand);
    END IF;
  END LOOP;

  FOREACH v_cand IN ARRAY (SELECT array_agg(x ORDER BY x) FROM unnest(v_candidates) x)
  LOOP
    v_end := v_cand + make_interval(mins => v_duration);
    v_state := 'available';

    IF v_end > v_close THEN
      v_state := 'overflow';
    ELSIF v_cand < v_now THEN
      v_state := 'past';
    ELSIF v_break_start IS NOT NULL AND v_cand < v_break_end AND v_end > v_break_start THEN
      v_state := 'busy';
    -- Check for Time Off blocks
    ELSIF EXISTS (
      SELECT 1 FROM public.professional_time_off t
      WHERE t.professional_id = p_barber_id
        AND t.status IN ('scheduled', 'active')
        AND t.approval_status IN ('approved', 'not_required')
        AND tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(v_cand, v_end, '[)')
    ) THEN
      v_state := 'busy';
    ELSIF EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.barber_id = p_barber_id
        AND a.status NOT IN ('cancelled', 'no_show')
        AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
        AND tstzrange(a.start_time - make_interval(mins => v_buffer),
                      a.end_time   + make_interval(mins => v_buffer), '[)')
            && tstzrange(v_cand, v_end, '[)')
    ) THEN
      v_state := 'busy';
    END IF;

    v_slots := v_slots || jsonb_build_object(
      'time', to_char(v_cand AT TIME ZONE v_tz, 'HH24:MI'),
      'end_time', to_char(v_end AT TIME ZONE v_tz, 'HH24:MI'),
      'iso', to_char(v_cand AT TIME ZONE v_tz, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'state', v_state
    );
  END LOOP;

  RETURN jsonb_build_object(
    'slots', v_slots,
    'buffer_minutes', v_buffer,
    'duration_minutes', v_duration,
    'open', to_char(v_open AT TIME ZONE v_tz, 'HH24:MI'),
    'close', to_char(v_close AT TIME ZONE v_tz, 'HH24:MI')
  );
END $function$;

CREATE OR REPLACE FUNCTION public.get_barber_commission_summary(p_tenant_id uuid, p_barber_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_production numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_paid numeric(10,2) := 0;
  v_pending numeric(10,2) := 0;
  v_completed integer := 0;
  v_paid_count integer := 0;
  v_pending_count integer := 0;
  v_avg numeric(10,2) := 0;
BEGIN
  v_start := CASE WHEN p_start_date IS NULL THEN NULL ELSE p_start_date::timestamptz END;
  v_end := CASE WHEN p_end_date IS NULL THEN NULL ELSE (p_end_date + 1)::timestamptz END;

  SELECT
    COALESCE(SUM(bc.service_amount) FILTER (WHERE bc.status <> 'cancelled'), 0),
    COALESCE(SUM(bc.commission_amount) FILTER (WHERE bc.status <> 'cancelled'), 0),
    COALESCE(SUM(bc.commission_amount) FILTER (WHERE bc.status = 'paid'), 0),
    COALESCE(SUM(bc.commission_amount) FILTER (WHERE bc.status = 'pending'), 0),
    COUNT(*) FILTER (WHERE bc.status <> 'cancelled')::integer,
    COUNT(*) FILTER (WHERE bc.status = 'paid')::integer,
    COUNT(*) FILTER (WHERE bc.status = 'pending')::integer
  INTO v_production, v_total, v_paid, v_pending, v_completed, v_paid_count, v_pending_count
  FROM public.barber_commissions bc
  LEFT JOIN public.appointments a ON a.id = bc.appointment_id
  WHERE bc.tenant_id = p_tenant_id
    AND bc.barber_id = p_barber_id
    AND (v_start IS NULL OR COALESCE(a.completed_at, bc.created_at, a.start_time) >= v_start)
    AND (v_end IS NULL OR COALESCE(a.completed_at, bc.created_at, a.start_time) < v_end);

  v_avg := CASE WHEN v_completed > 0 THEN ROUND(v_production / v_completed, 2) ELSE 0 END;

  RETURN jsonb_build_object(
    'production_total', v_production,
    'commission_total', v_total,
    'commission_paid', v_paid,
    'commission_pending', v_pending,
    'completed_appointments', v_completed,
    'paid_count', v_paid_count,
    'pending_count', v_pending_count,
    'average_ticket', v_avg
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_barber_dashboard_summary(p_tenant_id uuid, p_barber_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_month_start date := date_trunc('month', now())::date;
  v_today date := now()::date;
  v_week_start date := (now()::date - 6);
  v_summary jsonb;
  v_today_count integer := 0;
  v_week_count integer := 0;
  v_cancelled integer := 0;
  v_next timestamptz;
BEGIN
  SELECT COUNT(*)::integer INTO v_today_count
  FROM public.appointments
  WHERE tenant_id = p_tenant_id AND barber_id = p_barber_id
    AND status = 'completed'
    AND COALESCE(completed_at, start_time)::date = v_today;

  SELECT COUNT(*)::integer INTO v_week_count
  FROM public.appointments
  WHERE tenant_id = p_tenant_id AND barber_id = p_barber_id
    AND status = 'completed'
    AND COALESCE(completed_at, start_time)::date >= v_week_start;

  SELECT COUNT(*)::integer INTO v_cancelled
  FROM public.appointments
  WHERE tenant_id = p_tenant_id AND barber_id = p_barber_id
    AND status = 'cancelled'
    AND COALESCE(cancelled_at, updated_at, start_time)::date >= v_month_start;

  SELECT start_time INTO v_next
  FROM public.appointments
  WHERE tenant_id = p_tenant_id AND barber_id = p_barber_id
    AND status IN ('scheduled','confirmed')
    AND start_time > now()
  ORDER BY start_time ASC
  LIMIT 1;

  v_summary := public.get_barber_commission_summary(
    p_tenant_id,
    p_barber_id,
    COALESCE(p_start_date, v_month_start),
    COALESCE(p_end_date, v_today)
  );

  RETURN jsonb_build_object(
    'appointments_today', v_today_count,
    'appointments_week', v_week_count,
    'appointments_month', COALESCE((v_summary->>'completed_appointments')::integer, 0),
    'gross_production', COALESCE((v_summary->>'production_total')::numeric, 0),
    'commission_generated', COALESCE((v_summary->>'commission_total')::numeric, 0),
    'commission_paid', COALESCE((v_summary->>'commission_paid')::numeric, 0),
    'commission_pending', COALESCE((v_summary->>'commission_pending')::numeric, 0),
    'average_ticket', COALESCE((v_summary->>'average_ticket')::numeric, 0),
    'cancelled_count', v_cancelled,
    'next_appointment', v_next
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_barbershop_by_checkin_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE v_row public.profiles%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN RETURN NULL; END IF;
  SELECT * INTO v_row FROM public.profiles WHERE checkin_token = _token LIMIT 1;
  IF v_row.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'tenant_id', v_row.id,
    'business_name', v_row.business_name,
    'slug', v_row.slug,
    'primary_color', v_row.primary_color,
    'logo_url', v_row.logo_url
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_cron_status()
 RETURNS TABLE(cron_job_id bigint, cron_job_name text, cron_last_run timestamp with time zone, cron_status text, cron_return_message text, cron_start_time timestamp with time zone, cron_end_time timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobid,
    j.jobname,
    r.start_time as last_run,
    r.status,
    r.return_message,
    r.start_time,
    r.end_time
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT d.start_time, d.status, d.return_message, d.end_time
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid 
    ORDER BY d.start_time DESC 
    LIMIT 1
  ) r ON true
  WHERE j.jobname = 'run-automations-every-5-minutes';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_identity_context()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    _user_id uuid := auth.uid();
    _profile record;
    _membership record;
    _result json;
BEGIN
    IF _user_id IS NULL THEN
        RETURN json_build_object('authenticated', false);
    END IF;

    -- Get profile
    SELECT * INTO _profile FROM public.profiles WHERE id = _user_id;

    -- Get active membership (simplified for single tenant for now)
    SELECT * INTO _membership FROM public.tenant_memberships WHERE user_id = _user_id LIMIT 1;

    _result := json_build_object(
        'authenticated', true,
        'user_id', _user_id,
        'profile', row_to_json(_profile),
        'tenant_id', COALESCE(_membership.tenant_id, CASE WHEN _profile.role = 'tenant_admin' THEN _profile.id ELSE _profile.tenant_id END),
        'role', COALESCE(_membership.role, _profile.role),
        'identity_status', _profile.identity_status
    );

    RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_customers_with_birthday_today(target_day integer, target_month integer)
 RETURNS TABLE(id uuid, tenant_id uuid, name text, phone text, birth_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.id, c.tenant_id, c.name, c.phone, c.birth_date
  FROM public.customers c
  WHERE EXTRACT(DAY FROM c.birth_date) = target_day
    AND EXTRACT(MONTH FROM c.birth_date) = target_month;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_automation(p_tenant_id uuid, p_type text, p_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_id UUID;
    v_trigger_type TEXT := 'event';
BEGIN
    -- Try to find existing automation in the 'automations' table
    -- This table does NOT have a 'name' column
    SELECT id INTO v_id FROM public.automations
    WHERE tenant_id = p_tenant_id AND type = p_type
    LIMIT 1;

    -- If not found, create one
    IF v_id IS NULL THEN
        -- p_name is ignored as the table lacks a 'name' column
        INSERT INTO public.automations (
            tenant_id,
            type,
            enabled,
            trigger_type,
            trigger_delay,
            channel
        ) VALUES (
            p_tenant_id,
            p_type,
            true,
            v_trigger_type,
            0,
            'whatsapp'
        )
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
EXCEPTION WHEN OTHERS THEN
    -- If everything fails, try to return any existing automation for this tenant
    SELECT id INTO v_id FROM public.automations WHERE tenant_id = p_tenant_id LIMIT 1;
    RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_reschedule_options(p_appointment_id uuid, p_barber_id uuid DEFAULT NULL::uuid, p_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_appt record;
  v_duration integer := 30;
  v_link_count integer := 0;
  v_barbers jsonb := '[]'::jsonb;
  v_times jsonb := '[]'::jsonb;
  v_target_barber record;
  v_day_key text;
  v_wh jsonb;
  v_start_hm text;
  v_end_hm text;
  v_start_hour integer;
  v_start_min integer;
  v_end_hour integer;
  v_end_min integer;
  v_hour integer;
  v_min integer;
  v_time_text text;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_is_busy boolean;
  v_now_br timestamp;
  v_buffer integer := 0;
BEGIN
  SELECT a.* INTO v_appt FROM public.appointments a WHERE a.id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado', 'barbers', '[]'::jsonb, 'times', '[]'::jsonb);
  END IF;

  SELECT COALESCE(s.duration_minutes, GREATEST(15, ROUND(EXTRACT(EPOCH FROM (v_appt.end_time - v_appt.start_time)) / 60)::int), 30)
    INTO v_duration FROM public.services s WHERE s.id = v_appt.service_id;
  IF v_duration IS NULL THEN
    v_duration := COALESCE(GREATEST(15, ROUND(EXTRACT(EPOCH FROM (v_appt.end_time - v_appt.start_time)) / 60)::int), 30);
  END IF;

  SELECT COALESCE(pr.slot_buffer_minutes, 0) INTO v_buffer
  FROM public.profiles pr WHERE pr.id = v_appt.tenant_id;
  v_buffer := COALESCE(v_buffer, 0);

  SELECT count(*) INTO v_link_count FROM public.barber_services bs WHERE bs.service_id = v_appt.service_id;

  WITH eligible AS (
    SELECT DISTINCT b.id, b.name, b.avatar_url, b.specialties, b.category, b.working_hours, b.active
    FROM public.barbers b
    WHERE COALESCE(b.active, false) = true
      AND (b.tenant_id = v_appt.tenant_id OR b.user_id = v_appt.tenant_id)
      AND (
        v_link_count = 0
        OR EXISTS (SELECT 1 FROM public.barber_services bs WHERE bs.barber_id = b.id AND bs.service_id = v_appt.service_id)
        OR b.id = v_appt.barber_id
      )
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id, 'name', e.name, 'avatar_url', e.avatar_url,
      'specialties', COALESCE(to_jsonb(e.specialties), '[]'::jsonb),
      'category', e.category, 'working_hours', COALESCE(e.working_hours, '{}'::jsonb),
      'is_active', e.active, 'is_current', e.id = v_appt.barber_id
    ) ORDER BY CASE WHEN e.id = v_appt.barber_id THEN 0 ELSE 1 END, e.name
  ), '[]'::jsonb) INTO v_barbers FROM eligible e;

  IF p_barber_id IS NOT NULL AND p_date IS NOT NULL THEN
    SELECT b.* INTO v_target_barber FROM public.barbers b
    WHERE b.id = p_barber_id AND COALESCE(b.active, false) = true
      AND (b.tenant_id = v_appt.tenant_id OR b.user_id = v_appt.tenant_id);

    IF FOUND THEN
      v_day_key := CASE extract(dow FROM p_date)::int
        WHEN 0 THEN 'sunday' WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday'
        WHEN 3 THEN 'wednesday' WHEN 4 THEN 'thursday' WHEN 5 THEN 'friday' WHEN 6 THEN 'saturday'
      END;
      v_wh := v_target_barber.working_hours -> v_day_key;

      IF v_wh IS NOT NULL AND COALESCE((v_wh ->> 'enabled')::boolean, false) THEN
        v_start_hm := v_wh ->> 'start';
        v_end_hm := v_wh ->> 'end';
        v_start_hour := split_part(v_start_hm, ':', 1)::int;
        v_start_min := split_part(v_start_hm, ':', 2)::int;
        v_end_hour := split_part(v_end_hm, ':', 1)::int;
        v_end_min := split_part(v_end_hm, ':', 2)::int;
        v_now_br := now() AT TIME ZONE 'America/Sao_Paulo';

        v_hour := v_start_hour;
        WHILE v_hour <= v_end_hour LOOP
          v_min := CASE WHEN v_hour = v_start_hour THEN v_start_min ELSE 0 END;
          WHILE v_min < 60 LOOP
            EXIT WHEN v_hour = v_end_hour AND v_min >= v_end_min;

            v_time_text := lpad(v_hour::text, 2, '0') || ':' || lpad(v_min::text, 2, '0');
            v_slot_start := (p_date::text || ' ' || v_time_text || ':00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
            v_slot_end := v_slot_start + make_interval(mins => v_duration);

            IF ((p_date::text || ' ' || v_time_text || ':00')::timestamp >= v_now_br)
               AND ((v_slot_end AT TIME ZONE 'America/Sao_Paulo')::time <= v_end_hm::time) THEN
              v_is_busy := public.check_appointment_conflict(
                p_barber_id, v_slot_start, v_slot_end, p_appointment_id, v_buffer
              );
              IF NOT v_is_busy THEN
                v_times := v_times || to_jsonb(v_time_text);
              END IF;
            END IF;

            v_min := v_min + 30;
          END LOOP;
          v_hour := v_hour + 1;
        END LOOP;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'durationMinutes', v_duration, 'barbers', v_barbers, 'times', v_times, 'bufferMinutes', v_buffer);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_review_by_token(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', r.id,
    'tenant_id', r.tenant_id,
    'appointment_id', r.appointment_id,
    'customer_id', r.customer_id,
    'barber_id', r.barber_id,
    'service_id', a.service_id,
    'customer_name', c.name,
    'barber_name', b.name,
    'barber_avatar', b.avatar_url,
    'barber_pix_key', CASE WHEN COALESCE(b.accepts_tips, true) THEN b.pix_key ELSE NULL END,
    'barber_pix_key_type', CASE WHEN COALESCE(b.accepts_tips, true) THEN b.pix_key_type ELSE NULL END,
    'barber_accepts_tips', COALESCE(b.accepts_tips, true),
    'barbershop_name', p.business_name,
    'barbershop_slug', p.slug,
    'service_name', s.name,
    'appointment_date', a.start_time,
    'submitted_at', r.submitted_at,
    'token_used_at', r.token_used_at,
    'already_submitted', (r.submitted_at IS NOT NULL OR r.token_used_at IS NOT NULL)
  ) INTO result
  FROM public.appointment_reviews r
  JOIN public.appointments a ON a.id = r.appointment_id
  LEFT JOIN public.customers c ON c.id = r.customer_id
  LEFT JOIN public.barbers b ON b.id = r.barber_id
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.profiles p ON p.id = r.tenant_id
  WHERE r.review_token = _token
  LIMIT 1;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_server_info()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'server_time', now(),
        'timezone', current_setting('TimeZone'),
        'br_time', now() AT TIME ZONE 'America/Bahia'
    ) INTO result;
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_subscription_benefit_balance(_subscription_id uuid)
 RETURNS TABLE(benefit_key text, benefit_name text, monthly_limit integer, used integer, remaining integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  _plan_id uuid;
  _period_start timestamptz;
  _period_end timestamptz;
BEGIN
  SELECT cs.plan_id,
         COALESCE(cs.current_period_start, date_trunc('month', now())),
         COALESCE(cs.current_period_end, date_trunc('month', now()) + interval '1 month')
    INTO _plan_id, _period_start, _period_end
  FROM public.customer_subscriptions cs
  WHERE cs.id = _subscription_id;

  IF _plan_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.benefit_key,
    b.benefit_name,
    b.monthly_limit,
    COALESCE(SUM(
      CASE WHEN ul.status IN ('reserved','consumed') THEN ul.consume_quantity ELSE 0 END
    ), 0)::int AS used,
    GREATEST(
      b.monthly_limit - COALESCE(SUM(
        CASE WHEN ul.status IN ('reserved','consumed') THEN ul.consume_quantity ELSE 0 END
      ), 0),
      0
    )::int AS remaining
  FROM public.subscription_plan_benefits b
  LEFT JOIN public.subscription_usage_logs ul
    ON ul.subscription_id = _subscription_id
   AND ul.benefit_key = b.benefit_key
   AND ul.used_at >= _period_start
   AND ul.used_at < _period_end
  WHERE b.plan_id = _plan_id AND b.active = true
  GROUP BY b.benefit_key, b.benefit_name, b.monthly_limit, b.display_order
  ORDER BY b.display_order, b.benefit_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_subscription_benefits_v2(_subscription_id uuid, _service_id uuid, _appointment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  _plan_id uuid;
  _tenant_id uuid;
  _customer_id uuid;
  _period_start timestamptz;
  _period_end timestamptz;
  _link record;
  _balance record;
  _missing jsonb := '[]'::jsonb;
  _inserted_ids uuid[] := ARRAY[]::uuid[];
  _new_id uuid;
BEGIN
  SELECT cs.plan_id, cs.tenant_id, cs.customer_id,
         COALESCE(cs.current_period_start, date_trunc('month', now())),
         COALESCE(cs.current_period_end, date_trunc('month', now()) + interval '1 month')
    INTO _plan_id, _tenant_id, _customer_id, _period_start, _period_end
  FROM public.customer_subscriptions cs
  WHERE cs.id = _subscription_id;

  IF _plan_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'subscription_not_found');
  END IF;

  -- Check each benefit the service consumes
  FOR _link IN
    SELECT bs.consume_quantity, b.benefit_key, b.benefit_name, b.id as benefit_id
    FROM public.subscription_plan_benefit_services bs
    JOIN public.subscription_plan_benefits b ON b.id = bs.benefit_id
    WHERE bs.plan_id = _plan_id
      AND bs.service_id = _service_id
      AND bs.active = true
      AND b.active = true
  LOOP
    SELECT remaining INTO _balance
    FROM public.get_subscription_benefit_balance(_subscription_id)
    WHERE benefit_key = _link.benefit_key;

    IF _balance IS NULL OR _balance.remaining < _link.consume_quantity THEN
      _missing := _missing || jsonb_build_object(
        'benefit_key', _link.benefit_key,
        'benefit_name', _link.benefit_name,
        'required', _link.consume_quantity,
        'remaining', COALESCE(_balance.remaining, 0)
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(_missing) > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'missing', _missing);
  END IF;

  -- Insert reservation logs (one row per benefit)
  FOR _link IN
    SELECT bs.consume_quantity, b.benefit_key
    FROM public.subscription_plan_benefit_services bs
    JOIN public.subscription_plan_benefits b ON b.id = bs.benefit_id
    WHERE bs.plan_id = _plan_id
      AND bs.service_id = _service_id
      AND bs.active = true
      AND b.active = true
  LOOP
    INSERT INTO public.subscription_usage_logs (
      tenant_id, subscription_id, subscription_plan_id, customer_id,
      appointment_id, service_id, benefit_key, consume_quantity,
      status, benefit_type, period_start, period_end
    ) VALUES (
      _tenant_id, _subscription_id, _plan_id, _customer_id,
      _appointment_id, _service_id, _link.benefit_key, _link.consume_quantity,
      'reserved', 'service', _period_start, _period_end
    ) RETURNING id INTO _new_id;
    _inserted_ids := array_append(_inserted_ids, _new_id);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'log_ids', to_jsonb(_inserted_ids));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_workflow_key_for_event(p_event_name text, p_flow_type text DEFAULT 'single'::text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN CASE 
        WHEN p_event_name = 'appointment.created' AND p_flow_type = 'single' THEN 'confirmation_single'
        WHEN p_event_name = 'appointment.created' AND p_flow_type = 'multi' THEN 'confirmation_multi'
        WHEN p_event_name = 'appointment.completed' THEN 'post_service'
        WHEN p_event_name = 'appointment.cancelled' THEN 'appointment_cancelled'
        WHEN p_event_name = 'appointment.rescheduled' THEN 'appointment_rescheduled'
        WHEN p_event_name = 'appointment.reminder' THEN 'appointment_reminder'
        WHEN p_event_name = 'customer.birthday' THEN 'customer_birthday'
        WHEN p_event_name = 'customer.inactive' THEN 'inactive_customer'
        WHEN p_event_name = 'credit.created' THEN 'credit_created'
        WHEN p_event_name = 'cashback.created' THEN 'cashback_created'
        WHEN p_event_name = 'payment.confirmed' THEN 'payment_confirmed'
        WHEN p_event_name = 'payment.pending' THEN 'payment_pending'
        ELSE NULL
    END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_subscription_referral_reward(p_referral_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ref RECORD;
BEGIN
  SELECT * INTO v_ref FROM public.subscription_referrals WHERE id = p_referral_id;
  IF NOT FOUND OR v_ref.reward_granted THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found_or_already_granted');
  END IF;

  IF v_ref.reward_type = 'free_month' AND v_ref.referrer_subscription_id IS NOT NULL THEN
    UPDATE public.customer_subscriptions
    SET current_period_end = current_period_end + INTERVAL '1 month',
        next_billing_at = COALESCE(next_billing_at, current_period_end) + INTERVAL '1 month'
    WHERE id = v_ref.referrer_subscription_id;
  ELSIF v_ref.reward_type IN ('credit', 'discount') AND v_ref.reward_value > 0 THEN
    INSERT INTO public.customer_credits (tenant_id, customer_id, amount, type, status, notes)
    VALUES (v_ref.tenant_id, v_ref.referrer_customer_id, v_ref.reward_value, 'referral_reward', 'available',
            'Recompensa por indicação de assinatura');
  ELSIF v_ref.reward_type = 'cashback' AND v_ref.reward_value > 0 THEN
    UPDATE public.customers SET cashback_balance = COALESCE(cashback_balance,0) + v_ref.reward_value
    WHERE id = v_ref.referrer_customer_id;
  END IF;

  UPDATE public.subscription_referrals
  SET reward_granted = true,
      confirmed_at = COALESCE(confirmed_at, now()),
      status = 'confirmed'
  WHERE id = p_referral_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_referral_on_activation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ref RECORD;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    SELECT * INTO v_ref FROM public.subscription_referrals
      WHERE subscription_id = NEW.id AND status = 'pending' AND reward_granted = false
      LIMIT 1;
    IF FOUND THEN
      PERFORM public.grant_subscription_referral_reward(v_ref.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_subscription_rewards()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_reward RECORD;
  v_months int;
  v_granted int := 0;
BEGIN
  FOR v_sub IN
    SELECT cs.id, cs.tenant_id, cs.customer_id, cs.plan_id
    FROM public.customer_subscriptions cs
    JOIN public.subscription_plans sp ON sp.id = cs.plan_id
    WHERE cs.status IN ('active','trialing')
      AND sp.accumulates_premium_loyalty = true
  LOOP
    v_months := public.get_subscriber_months(v_sub.id);

    FOR v_reward IN
      SELECT * FROM public.subscription_loyalty_rewards
      WHERE tenant_id = v_sub.tenant_id
        AND active = true
        AND months_required <= v_months
    LOOP
      INSERT INTO public.subscription_loyalty_history (
        tenant_id, subscription_id, customer_id, reward_id, status
      ) VALUES (
        v_sub.tenant_id, v_sub.id, v_sub.customer_id, v_reward.id, 'granted'
      )
      ON CONFLICT (subscription_id, reward_id) DO NOTHING;

      IF FOUND THEN
        v_granted := v_granted + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_granted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_internal_test_tenant_flag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.is_internal_test_tenant IS DISTINCT FROM OLD.is_internal_test_tenant THEN
    IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'Somente super admin pode alterar is_internal_test_tenant';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_appointment_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_template_id UUID;
  v_template TEXT;
  v_active BOOLEAN;
  v_customer_name TEXT;
  v_barbershop_name TEXT;
  v_service_name TEXT;
  v_professional_name TEXT;
  v_appointment_date TEXT;
  v_appointment_time TEXT;
  v_idempotency_key TEXT;
BEGIN
  -- Get template details and active status
  SELECT id, template, active 
  INTO v_template_id, v_template, v_active
  FROM public.automation_templates
  WHERE tenant_id = NEW.tenant_id 
    AND key = 'appointment_confirmation'
  LIMIT 1;

  -- ONLY proceed if template exists AND is active
  IF v_template_id IS NOT NULL AND v_active = TRUE THEN
    -- Generate idempotency key
    v_idempotency_key := 'apt_conf_' || NEW.id;

    -- Get data for template replacement
    SELECT name INTO v_customer_name FROM public.customers WHERE id = NEW.customer_id;
    SELECT name INTO v_barbershop_name FROM public.tenants WHERE id = NEW.tenant_id;
    SELECT name INTO v_service_name FROM public.services WHERE id = NEW.service_id;
    
    -- Robust professional name resolution
    SELECT name INTO v_professional_name FROM public.barbers WHERE id = NEW.barber_id;
    IF v_professional_name IS NULL OR v_professional_name = '' THEN
       SELECT responsible_name INTO v_professional_name FROM public.profiles WHERE id = NEW.barber_id;
    END IF;
    
    -- Timezone handling: America/Sao_Paulo
    v_appointment_date := to_char(NEW.start_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');
    v_appointment_time := to_char(NEW.start_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');

    -- Insert into queue
    INSERT INTO public.automation_queue (
      tenant_id,
      automation_id,
      appointment_id,
      customer_id,
      payload,
      idempotency_key
    ) VALUES (
      NEW.tenant_id,
      v_template_id,
      NEW.id,
      NEW.customer_id,
      jsonb_build_object(
        'customer_name', COALESCE(v_customer_name, 'Cliente'),
        'barbershop_name', COALESCE(v_barbershop_name, 'Nossa Barbearia'),
        'service_name', COALESCE(v_service_name, 'Serviço'),
        'professional_name', COALESCE(v_professional_name, 'Profissional'),
        'appointment_date', v_appointment_date,
        'appointment_time', v_appointment_time,
        'rendered', v_template
      ),
      v_idempotency_key
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_profile RECORD;
    v_loyalty_points INTEGER;
    v_loyalty_reward_value NUMERIC(10,2);
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_sub_covered NUMERIC(10,2);
    v_total_price NUMERIC(10,2);
    v_fully_covered BOOLEAN;
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN

        v_sub_covered := COALESCE(NEW.subscription_covered_amount, 0);
        v_total_price := COALESCE(NEW.total_price, 0);
        v_fully_covered := (NEW.subscription_id IS NOT NULL AND v_sub_covered > 0 AND v_sub_covered >= v_total_price);

        -- Métricas básicas sempre atualizadas
        UPDATE public.customers
        SET total_spent = COALESCE(total_spent, 0) + v_total_price,
            lifetime_value = COALESCE(lifetime_value, 0) + v_total_price,
            last_visit = NOW(),
            updated_at = NOW()
        WHERE id = NEW.customer_id;

        -- Pontos de fidelidade tradicional: BLOQUEADOS quando totalmente coberto pela assinatura
        IF NOT v_fully_covered THEN
            UPDATE public.customers
            SET loyalty_points = COALESCE(loyalty_points, 0) + 1,
                updated_at = NOW()
            WHERE id = NEW.customer_id
            RETURNING loyalty_points INTO v_loyalty_points;
        ELSE
            SELECT loyalty_points INTO v_loyalty_points FROM public.customers WHERE id = NEW.customer_id;
        END IF;

        v_credits_used := COALESCE(NEW.credits_used, NEW.credit_used, 0);
        v_cashback_used := COALESCE(NEW.cashback_used, 0);

        IF v_credits_used > 0 OR v_cashback_used > 0 THEN
            UPDATE public.customers
            SET credits_used = COALESCE(credits_used, 0) + v_credits_used,
                cashback_used = COALESCE(cashback_used, 0) + v_cashback_used,
                updated_at = NOW()
            WHERE id = NEW.customer_id;
        END IF;

        SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.tenant_id;

        -- Prêmio de fidelidade (créditos) só dispara se houve incremento de ponto
        IF NOT v_fully_covered AND v_loyalty_points >= COALESCE(v_profile.free_service_threshold, 10) THEN
            UPDATE public.customers SET loyalty_points = 0 WHERE id = NEW.customer_id;
            v_loyalty_reward_value := COALESCE(v_profile.loyalty_reward_value, 10.00);

            IF v_loyalty_reward_value > 0 THEN
                INSERT INTO public.customer_credits (
                    tenant_id, customer_id, appointment_id, amount, used_amount, status, credit_type, description
                ) VALUES (
                    NEW.tenant_id, NEW.customer_id, NEW.id, v_loyalty_reward_value, 0, 'available', 'loyalty', 'Prêmio de Fidelidade'
                );

                INSERT INTO public.credit_transactions (
                    tenant_id, customer_id, appointment_id, type, amount, description
                ) VALUES (
                    NEW.tenant_id, NEW.customer_id, NEW.id, 'earned', v_loyalty_reward_value, 'Crédito de fidelidade concedido'
                );

                UPDATE public.customers
                SET credits = COALESCE(credits, 0) + v_loyalty_reward_value,
                    updated_at = NOW()
                WHERE id = NEW.customer_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_appointment_completion_review_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_ticket_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    INSERT INTO public.admin_notifications (type, title, description, reference_id)
    VALUES ('new_ticket', 'Novo Chamado Aberto', 'Um novo chamado foi aberto por ' || (SELECT COALESCE(name, 'Barbearia') FROM public.barbershops WHERE id = NEW.barbershop_id), NEW.id);
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  shop_name text;
  generated_slug text;
  user_role text;
  target_tenant_id uuid;
BEGIN
  -- Determine role from metadata or default to tenant_admin
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant_admin');
  
  -- Logic for administrative roles (Barbershop Owners)
  IF user_role IN ('tenant_admin', 'admin', 'super_admin') THEN
    shop_name := COALESCE(new.raw_user_meta_data->>'business_name', 'Minha Barbearia');
    generated_slug := generate_unique_slug(shop_name);

    INSERT INTO public.profiles (
      id, business_name, responsible_name, email, whatsapp_number,
      barbers_range, plan, trial_end, role, status, slug
    )
    VALUES (
      new.id, shop_name, new.raw_user_meta_data->>'responsible_name',
      new.email, new.raw_user_meta_data->>'whatsapp_number',
      new.raw_user_meta_data->>'barbers_range',
      COALESCE(new.raw_user_meta_data->>'plan', 'pro'),
      CASE 
        WHEN (new.raw_user_meta_data->>'plan') = 'pro' OR new.raw_user_meta_data->>'plan' IS NULL 
        THEN (now() + interval '15 days') 
        ELSE NULL 
      END,
      user_role, 'active', generated_slug
    )
    ON CONFLICT (id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      responsible_name = EXCLUDED.responsible_name,
      email = EXCLUDED.email,
      slug = COALESCE(profiles.slug, EXCLUDED.slug);

    -- Create actual tenant record
    INSERT INTO public.barbershops (owner_id, name, slug)
    VALUES (new.id, shop_name, generated_slug)
    ON CONFLICT (owner_id) DO NOTHING;
  ELSE
    -- Logic for clients, staff, professionals (Strict Isolation: No slug, No tenant)
    target_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;
    
    INSERT INTO public.profiles (
      id, responsible_name, display_name, email, role, status, slug, tenant_id
    )
    VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'responsible_name'), 
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'responsible_name'),
      new.email, user_role, 'active', NULL, target_tenant_id
    )
    ON CONFLICT (id) DO UPDATE SET 
      role = EXCLUDED.role,
      tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id);
  END IF;

  -- Ensure RBAC record exists
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, user_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback
  END;

  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_product_sale_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_item RECORD;
BEGIN
    -- Check if status has changed
    IF (OLD.status = NEW.status) THEN
        RETURN NEW;
    END IF;

    -- Scenario 1: Sale was completed but now cancelled or refunded (Return items to stock)
    IF (OLD.status = 'completed' AND (NEW.status = 'cancelled' OR NEW.status = 'refunded')) THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(OLD.items) AS x(product_id UUID, quantity INT)
        LOOP
            UPDATE public.products 
            SET stock_quantity = stock_quantity + v_item.quantity
            WHERE id = v_item.product_id;
        END LOOP;
    END IF;

    -- Scenario 2: Sale was cancelled or refunded but now completed (Remove items from stock)
    -- This handles cases where a user might accidentally cancel and then revert
    IF ((OLD.status = 'cancelled' OR OLD.status = 'refunded') AND NEW.status = 'completed') THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(NEW.items) AS x(product_id UUID, quantity INT)
        LOOP
            UPDATE public.products 
            SET stock_quantity = stock_quantity - v_item.quantity
            WHERE id = v_item.product_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_wallet_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF (NEW.type = 'credit') THEN
        UPDATE public.wallet 
        SET balance = balance + NEW.amount, updated_at = now()
        WHERE id = NEW.wallet_id;
    ELSIF (NEW.type = 'debit') THEN
        UPDATE public.wallet 
        SET balance = balance - NEW.amount, updated_at = now()
        WHERE id = NEW.wallet_id;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_plan_slug     text;
  v_allowed       jsonb;
  v_bshop_plan_id uuid;
BEGIN
  IF _user_id IS NULL OR _module_key IS NULL THEN
    RETURN true;
  END IF;

  -- Super admin bypass
  BEGIN
    IF public.is_super_admin_user() THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Voucher administrativo ativo → libera todos os módulos
  BEGIN
    IF public.has_active_internal_voucher(_user_id) THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Add-on ativo em sandbox ou live
  BEGIN
    IF public.has_active_addon(_user_id, _module_key, 'sandbox')
       OR public.has_active_addon(_user_id, _module_key, 'live') THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Plano via profiles.effective_plan / profiles.plan
  SELECT lower(coalesce(p.effective_plan, p.plan))
    INTO v_plan_slug
  FROM public.profiles p
  WHERE p.id = _user_id;

  IF v_plan_slug IS NOT NULL THEN
    SELECT allowed_modules INTO v_allowed FROM public.plans WHERE slug = v_plan_slug;
    IF v_allowed IS NOT NULL AND v_allowed ? _module_key THEN
      RETURN true;
    END IF;
  END IF;

  -- Fallback via barbershops.plan_id
  SELECT plan_id INTO v_bshop_plan_id
    FROM public.barbershops
   WHERE id = _user_id
   LIMIT 1;

  IF v_bshop_plan_id IS NOT NULL THEN
    SELECT allowed_modules INTO v_allowed FROM public.plans WHERE id = v_bshop_plan_id;
    IF v_allowed IS NOT NULL AND v_allowed ? _module_key THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    _user_role public.app_role;
BEGIN
    -- Obter a role do usuário (priorizando a tabela user_roles)
    SELECT role INTO _user_role
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1;

    -- Se for super_admin, tem todas as permissões
    IF _user_role = 'super_admin' THEN
        RETURN true;
    END IF;

    -- Verificar se a role tem a permissão associada
    RETURN EXISTS (
        SELECT 1
        FROM public.role_permissions
        WHERE role = _user_role
          AND permission_key = _permission_key
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    UPDATE public.coupons
    SET used_count = COALESCE(used_count, 0) + 1
    WHERE id = p_coupon_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_availability_conflict(p_barber_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_source text DEFAULT 'unknown'::text, p_result text DEFAULT 'conflict'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tenant uuid;
  v_buffer integer := 0;
  v_conflicting jsonb;
BEGIN
  IF p_barber_id IS NULL OR p_start IS NULL OR p_end IS NULL THEN
    RETURN;
  END IF;

  SELECT b.user_id INTO v_tenant FROM public.barbers b WHERE b.id = p_barber_id;
  SELECT COALESCE(pr.slot_buffer_minutes, 0) INTO v_buffer
    FROM public.profiles pr WHERE pr.id = v_tenant;

  SELECT jsonb_agg(jsonb_build_object('id', a.id, 'start_time', a.start_time, 'end_time', a.end_time, 'status', a.status))
    INTO v_conflicting
  FROM public.appointments a
  WHERE a.barber_id = p_barber_id
    AND a.status NOT IN ('cancelled', 'no_show', 'completed')
    AND a.start_time < (p_end + make_interval(mins => COALESCE(v_buffer, 0)))
    AND a.end_time > (p_start - make_interval(mins => COALESCE(v_buffer, 0)));

  INSERT INTO public.availability_conflict_logs (
    tenant_id, barber_id, requested_start, requested_end, duration_minutes,
    buffer_minutes, source, result, conflicting
  ) VALUES (
    v_tenant, p_barber_id, p_start, p_end,
    GREATEST(1, (EXTRACT(EPOCH FROM (p_end - p_start)) / 60)::int),
    COALESCE(v_buffer, 0), COALESCE(p_source, 'unknown'), COALESCE(p_result, 'conflict'), v_conflicting
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_payment_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF (OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
        INSERT INTO public.financial_adjustment_logs (
            appointment_id,
            tenant_id,
            reason,
            old_values,
            new_values,
            adjusted_at,
            adjusted_by
        ) VALUES (
            NEW.id,
            NEW.tenant_id,
            'Payment status updated to ' || NEW.payment_status,
            jsonb_build_object('payment_status', OLD.payment_status, 'paid_at', OLD.paid_at),
            jsonb_build_object('payment_status', NEW.payment_status, 'paid_at', NEW.paid_at),
            now(),
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_refund_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_changes JSONB := '{}'::jsonb;
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.status IS DISTINCT FROM NEW.status) THEN
            v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
            
            INSERT INTO public.refund_audits (
                refund_id,
                tenant_id,
                changed_by_id,
                changed_by_type,
                old_status,
                new_status,
                changes
            ) VALUES (
                NEW.id,
                NEW.tenant_id,
                auth.uid(), -- Might be null if system-driven
                CASE WHEN auth.uid() IS NOT NULL THEN 'admin' ELSE 'system' END,
                OLD.status,
                NEW.status,
                v_changes
            );
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.refund_audits (
            refund_id,
            tenant_id,
            changed_by_id,
            changed_by_type,
            old_status,
            new_status,
            changes
        ) VALUES (
            NEW.id,
            NEW.tenant_id,
            auth.uid(),
            CASE WHEN auth.uid() IS NOT NULL THEN 'admin' ELSE 'system' END,
            NULL,
            NEW.status,
            jsonb_build_object('initial_status', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_new_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    business_name_val TEXT;
    customer_name_val TEXT;
    service_name_val TEXT;
    notification_unique_key TEXT;
BEGIN
    -- Get business name
    SELECT business_name INTO business_name_val FROM public.profiles WHERE id = NEW.user_id;
    -- Get customer name
    SELECT name INTO customer_name_val FROM public.customers WHERE id = NEW.customer_id;
    -- Get service name
    SELECT name INTO service_name_val FROM public.services WHERE id = NEW.service_id;

    -- Chave única para evitar duplicidade
    notification_unique_key := 'appointment:' || NEW.id || ':barber:' || NEW.barber_id;

    -- Notificar o dono da barbearia
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, link, unique_key)
    VALUES (
        NEW.user_id,
        NEW.user_id,
        'Novo Agendamento',
        'Um novo agendamento foi realizado para ' || COALESCE(customer_name_val, 'Cliente') || ' - ' || COALESCE(service_name_val, 'Serviço'),
        'appointment',
        '/calendar',
        'appointment:' || NEW.id || ':owner'
    ) ON CONFLICT (tenant_id, type, unique_key) DO NOTHING;

    -- Notificar o barbeiro
    IF NEW.barber_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, tenant_id, barber_id, title, message, type, link, unique_key)
        VALUES (
            NEW.user_id,
            NEW.user_id,
            NEW.barber_id,
            'Novo Agendamento para Você',
            'Você tem um novo agendamento: ' || COALESCE(customer_name_val, 'Cliente') || ' - ' || COALESCE(service_name_val, 'Serviço') || ' às ' || to_char(NEW.start_time, 'HH24:MI'),
            'appointment',
            '/' || (SELECT slug FROM profiles WHERE id = NEW.user_id) || '/profissional',
            notification_unique_key
        ) ON CONFLICT (tenant_id, type, unique_key) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pause_customer_subscription(p_subscription_id uuid, p_reason text DEFAULT NULL::text, p_pause_until timestamp with time zone DEFAULT NULL::timestamp with time zone, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions
    WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura não encontrada');
  END IF;
  IF v_sub.tenant_id <> v_uid AND NOT public.is_super_admin_user() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;
  IF v_sub.status = 'paused' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura já está pausada');
  END IF;
  IF v_sub.status NOT IN ('active','pending_payment','past_due') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Só é possível pausar assinaturas ativas');
  END IF;

  UPDATE public.customer_subscriptions
     SET status = 'paused',
         paused_at = now(),
         pause_reason = p_reason,
         pause_until = p_pause_until,
         pause_notes = p_notes,
         resumed_at = NULL,
         auto_renew = false,
         updated_at = now()
   WHERE id = p_subscription_id;

  INSERT INTO public.subscription_status_logs(
    tenant_id, subscription_id, customer_id, old_status, new_status,
    reason, pause_until, notes, changed_by
  ) VALUES (
    v_sub.tenant_id, p_subscription_id, v_sub.customer_id, v_sub.status, 'paused',
    p_reason, p_pause_until, p_notes, v_uid
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pay_barber_commissions(p_tenant_id uuid, p_barber_id uuid, p_commission_ids uuid[], p_paid_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count integer := 0;
  v_total numeric(10,2) := 0;
BEGIN
  IF p_commission_ids IS NULL OR array_length(p_commission_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_commissions_selected');
  END IF;

  SELECT COUNT(*), COALESCE(SUM(commission_amount), 0)
    INTO v_count, v_total
  FROM public.barber_commissions
  WHERE tenant_id = p_tenant_id
    AND barber_id = p_barber_id
    AND status = 'pending'
    AND id = ANY(p_commission_ids);

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending_commissions_found');
  END IF;

  UPDATE public.barber_commissions
  SET status = 'paid',
      paid_at = now(),
      paid_by = COALESCE(p_paid_by, p_tenant_id),
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND barber_id = p_barber_id
    AND status = 'pending'
    AND id = ANY(p_commission_ids);

  RETURN jsonb_build_object('success', true, 'paid_count', v_count, 'paid_total', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pay_commission_entries(p_barber_id uuid, p_entry_ids uuid[], p_amount numeric, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tenant uuid := auth.uid();
  v_total numeric(10,2) := 0;
  v_period_start date;
  v_period_end date;
  v_closing_id uuid;
  v_status text;
  v_remaining numeric(10,2);
  v_entry RECORD;
  v_pay numeric(10,2);
BEGIN
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT COALESCE(SUM(commission_amount - paid_amount), 0),
         MIN(earned_at)::date, MAX(earned_at)::date
    INTO v_total, v_period_start, v_period_end
    FROM public.commission_entries
   WHERE tenant_id = v_tenant
     AND barber_id = p_barber_id
     AND id = ANY(p_entry_ids)
     AND status <> 'paid';

  IF v_total <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending');
  END IF;

  IF p_amount >= v_total THEN
    v_status := 'paid';
  ELSE
    v_status := 'partially_paid';
  END IF;

  INSERT INTO public.commission_closings (
    tenant_id, barber_id, period_start, period_end,
    total_amount, paid_amount, status, paid_at, notes
  ) VALUES (
    v_tenant, p_barber_id, COALESCE(v_period_start, CURRENT_DATE), COALESCE(v_period_end, CURRENT_DATE),
    v_total, LEAST(p_amount, v_total), v_status, now(), p_notes
  ) RETURNING id INTO v_closing_id;

  v_remaining := LEAST(p_amount, v_total);

  FOR v_entry IN
    SELECT id, commission_amount, paid_amount
      FROM public.commission_entries
     WHERE tenant_id = v_tenant
       AND barber_id = p_barber_id
       AND id = ANY(p_entry_ids)
       AND status <> 'paid'
     ORDER BY earned_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_pay := LEAST(v_remaining, v_entry.commission_amount - v_entry.paid_amount);

    UPDATE public.commission_entries
       SET paid_amount = paid_amount + v_pay,
           status = CASE
             WHEN paid_amount + v_pay >= commission_amount THEN 'paid'
             ELSE 'partially_paid'
           END,
           closing_id = v_closing_id,
           updated_at = now()
     WHERE id = v_entry.id;

    v_remaining := v_remaining - v_pay;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'closing_id', v_closing_id, 'total', v_total, 'paid', LEAST(p_amount, v_total));
END;
$function$;

CREATE OR REPLACE FUNCTION public.perform_qr_checkin(_token text, _phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tenant UUID;
  v_customer_id UUID;
  v_appt public.appointments%ROWTYPE;
BEGIN
  SELECT id INTO v_tenant FROM public.profiles WHERE checkin_token = _token LIMIT 1;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT id INTO v_customer_id FROM public.customers
    WHERE tenant_id = v_tenant AND regexp_replace(phone, '\D', '', 'g') = regexp_replace(_phone, '\D', '', 'g')
    LIMIT 1;
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'customer_not_found');
  END IF;
  SELECT * INTO v_appt FROM public.appointments
    WHERE tenant_id = v_tenant AND customer_id = v_customer_id
      AND start_time::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND status IN ('confirmed','scheduled','pending')
    ORDER BY start_time ASC LIMIT 1;
  IF v_appt.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_appointment_today', 'customer_id', v_customer_id);
  END IF;
  INSERT INTO public.appointment_checkins (appointment_id, tenant_id, customer_id, source)
    VALUES (v_appt.id, v_tenant, v_customer_id, 'qr')
    ON CONFLICT (appointment_id) DO NOTHING;
  RETURN jsonb_build_object(
    'ok', true,
    'appointment_id', v_appt.id,
    'start_time', v_appt.start_time,
    'customer_id', v_customer_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.preview_subscription_plan_change(p_subscription_id uuid, p_new_plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_old_plan RECORD;
  v_new_plan RECORD;
  v_now TIMESTAMPTZ := now();
  v_total_days INT;
  v_days_remaining INT;
  v_old_price NUMERIC;
  v_new_price NUMERIC;
  v_credit NUMERIC;
  v_new_prorated NUMERIC;
  v_net NUMERIC;
  v_change_type TEXT;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Assinatura não encontrada'); END IF;

  SELECT * INTO v_old_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;
  SELECT * INTO v_new_plan FROM public.subscription_plans WHERE id = p_new_plan_id;
  IF v_new_plan IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Novo plano não encontrado'); END IF;

  v_total_days := GREATEST(1, EXTRACT(DAY FROM (v_sub.current_period_end - v_sub.current_period_start))::INT);
  v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.current_period_end - v_now))::INT);

  v_old_price := COALESCE(v_old_plan.monthly_price, 0);
  v_new_price := COALESCE(v_new_plan.monthly_price, 0);

  v_credit := ROUND((v_old_price * v_days_remaining / v_total_days)::NUMERIC, 2);
  v_new_prorated := ROUND((v_new_price * v_days_remaining / v_total_days)::NUMERIC, 2);
  v_net := v_new_prorated - v_credit;

  IF v_new_price > v_old_price THEN v_change_type := 'upgrade';
  ELSIF v_new_price < v_old_price THEN v_change_type := 'downgrade';
  ELSE v_change_type := 'same';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'old_plan_id', v_sub.plan_id,
    'old_plan_name', v_old_plan.name,
    'old_price', v_old_price,
    'new_plan_id', p_new_plan_id,
    'new_plan_name', v_new_plan.name,
    'new_price', v_new_price,
    'days_in_cycle', v_total_days,
    'days_remaining', v_days_remaining,
    'proration_credit', v_credit,
    'proration_charge', v_new_prorated,
    'net_amount', v_net,
    'change_type', v_change_type
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.change_subscription_plan(p_subscription_id uuid, p_new_plan_id uuid, p_payment_method text DEFAULT NULL::text, p_apply_credit_to_wallet boolean DEFAULT true, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_preview JSONB;
  v_invoice_id UUID;
  v_credit_id UUID;
  v_change_id UUID;
  v_net NUMERIC;
  v_credit NUMERIC;
  v_charge NUMERIC;
  v_change_type TEXT;
  v_payment_method TEXT;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Assinatura não encontrada'); END IF;
  IF v_sub.status NOT IN ('active','pending_payment','past_due') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura precisa estar ativa para trocar plano');
  END IF;

  v_preview := public.preview_subscription_plan_change(p_subscription_id, p_new_plan_id);
  IF (v_preview->>'success')::BOOLEAN IS NOT TRUE THEN RETURN v_preview; END IF;

  v_credit := (v_preview->>'proration_credit')::NUMERIC;
  v_charge := (v_preview->>'proration_charge')::NUMERIC;
  v_net := (v_preview->>'net_amount')::NUMERIC;
  v_change_type := v_preview->>'change_type';
  v_payment_method := COALESCE(p_payment_method, v_sub.payment_method, 'in_person');

  IF v_net > 0 THEN
    INSERT INTO public.subscription_invoices (
      tenant_id, subscription_id, customer_id, amount, status,
      payment_method, due_date
    ) VALUES (
      v_sub.tenant_id, v_sub.id, v_sub.customer_id, v_net, 'pending',
      v_payment_method, now()
    ) RETURNING id INTO v_invoice_id;
  ELSIF v_net < 0 AND p_apply_credit_to_wallet THEN
    INSERT INTO public.customer_credits (
      tenant_id, customer_id, amount, used_amount, status, credit_type, description
    ) VALUES (
      v_sub.tenant_id, v_sub.customer_id, ABS(v_net), 0, 'available',
      'subscription_downgrade', 'Crédito por downgrade de plano'
    ) RETURNING id INTO v_credit_id;
  END IF;

  UPDATE public.customer_subscriptions
  SET plan_id = p_new_plan_id, updated_at = now()
  WHERE id = p_subscription_id;

  INSERT INTO public.subscription_plan_changes (
    tenant_id, customer_id, subscription_id,
    old_plan_id, new_plan_id, old_price, new_price,
    days_remaining, days_in_cycle,
    proration_credit, proration_charge, net_amount,
    change_type, invoice_id, credit_transaction_id,
    changed_by, notes
  ) VALUES (
    v_sub.tenant_id, v_sub.customer_id, v_sub.id,
    (v_preview->>'old_plan_id')::UUID, p_new_plan_id,
    (v_preview->>'old_price')::NUMERIC, (v_preview->>'new_price')::NUMERIC,
    (v_preview->>'days_remaining')::INT, (v_preview->>'days_in_cycle')::INT,
    v_credit, v_charge, v_net,
    v_change_type, v_invoice_id, v_credit_id,
    auth.uid(), p_notes
  ) RETURNING id INTO v_change_id;

  RETURN jsonb_build_object(
    'success', true,
    'change_id', v_change_id,
    'invoice_id', v_invoice_id,
    'credit_id', v_credit_id,
    'net_amount', v_net,
    'change_type', v_change_type,
    'preview', v_preview
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_product_sale(p_user_id uuid, p_customer_id uuid, p_total_amount numeric, p_items jsonb, p_pix_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_sale_id UUID;
    v_item RECORD;
BEGIN
    -- 1. Insert the sale record
    INSERT INTO public.product_sales (user_id, customer_id, total_amount, items, pix_key, status)
    VALUES (p_user_id, p_customer_id, p_total_amount, p_items, p_pix_key, 'completed')
    RETURNING id INTO v_sale_id;

    -- 2. Update stock for each item
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT)
    LOOP
        UPDATE public.products 
        SET stock_quantity = stock_quantity - v_item.quantity
        WHERE id = v_item.product_id AND user_id = p_user_id;
    END LOOP;

    RETURN v_sale_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_subscription_loyalty_rewards()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_reward RECORD;
  v_customer RECORD;
  v_plan RECORD;
  v_template RECORD;
  v_barbershop_name TEXT;
  v_months int;
  v_cycle int;
  v_history_id uuid;
  v_idem text;
  v_granted int := 0;
  v_notified int := 0;
  v_errors int := 0;
BEGIN
  FOR v_sub IN
    SELECT cs.id, cs.tenant_id, cs.customer_id, cs.plan_id,
           COALESCE(cs.started_at, cs.created_at) AS start_date
    FROM public.customer_subscriptions cs
    JOIN public.subscription_plans sp ON sp.id = cs.plan_id
    WHERE cs.status IN ('active','trialing')
      AND sp.accumulates_premium_loyalty = true
  LOOP
    v_months := GREATEST(0,
      EXTRACT(YEAR FROM age(now(), v_sub.start_date))::int * 12
      + EXTRACT(MONTH FROM age(now(), v_sub.start_date))::int
    );
    -- Ciclo: 1 por instância de assinatura (subscription_id já isola ciclos)
    v_cycle := 1;

    FOR v_reward IN
      SELECT * FROM public.subscription_loyalty_rewards
      WHERE tenant_id = v_sub.tenant_id
        AND active = true
        AND months_required <= v_months
      ORDER BY months_required ASC
    LOOP
      -- Insere histórico (idempotente via unique constraint)
      INSERT INTO public.subscription_loyalty_history (
        tenant_id, customer_id, subscription_id, reward_id,
        reward_cycle, reward_description, status, granted_at
      ) VALUES (
        v_sub.tenant_id, v_sub.customer_id, v_sub.id, v_reward.id,
        v_cycle, v_reward.description, 'granted', now()
      )
      ON CONFLICT (tenant_id, customer_id, subscription_id, reward_id, reward_cycle) DO NOTHING
      RETURNING id INTO v_history_id;

      IF v_history_id IS NULL THEN
        CONTINUE; -- já existia, não duplica nem notifica
      END IF;

      v_granted := v_granted + 1;

      -- Enfileira WhatsApp (Motor V2)
      BEGIN
        SELECT id, template, active INTO v_template
        FROM public.automation_templates
        WHERE tenant_id = v_sub.tenant_id AND key = 'subscription_reward_unlocked'
        LIMIT 1;

        IF v_template.id IS NULL OR v_template.active IS NOT TRUE THEN
          UPDATE public.subscription_loyalty_history
          SET notification_error = 'template_not_found_or_inactive'
          WHERE id = v_history_id;
          v_errors := v_errors + 1;
          CONTINUE;
        END IF;

        SELECT id, name, phone INTO v_customer FROM public.customers WHERE id = v_sub.customer_id;
        IF v_customer.phone IS NULL OR v_customer.phone = '' THEN
          UPDATE public.subscription_loyalty_history
          SET notification_error = 'missing_customer_phone'
          WHERE id = v_history_id;
          v_errors := v_errors + 1;
          CONTINUE;
        END IF;

        SELECT name, monthly_price INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;
        SELECT COALESCE(business_name, full_name, 'Nossa Barbearia') INTO v_barbershop_name
        FROM public.profiles WHERE id = v_sub.tenant_id;

        v_idem := 'sub_reward_' || v_history_id::text;

        INSERT INTO public.automation_queue (
          tenant_id, automation_id, customer_id, automation_type, workflow_key,
          event_name, status, scheduled_for, attempts, idempotency_key, payload
        ) VALUES (
          v_sub.tenant_id, v_template.id, v_sub.customer_id,
          'subscription_reward_unlocked', 'subscription_reward_unlocked',
          'subscription.reward_unlocked', 'pending', now(), 0, v_idem,
          jsonb_build_object(
            'customer_name', COALESCE(v_customer.name, 'Cliente'),
            'barbershop_name', v_barbershop_name,
            'plan_name', COALESCE(v_plan.name, 'Plano'),
            'reward_description', v_reward.description,
            'tenure_months', v_months,
            'subscription_id', v_sub.id,
            'reward_id', v_reward.id,
            'history_id', v_history_id,
            'reward_cycle', v_cycle,
            'rendered', v_template.template
          )
        )
        ON CONFLICT (idempotency_key) WHERE status <> 'error' DO NOTHING;

        UPDATE public.subscription_loyalty_history
        SET notification_sent = true,
            notification_sent_at = now(),
            notification_error = NULL
        WHERE id = v_history_id;

        v_notified := v_notified + 1;
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.subscription_loyalty_history
        SET notification_error = SQLERRM
        WHERE id = v_history_id;
        v_errors := v_errors + 1;
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'granted', v_granted,
    'notified', v_notified,
    'errors', v_errors,
    'ran_at', now()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_subscription_loyalty_rewards(p_tenant_id uuid)
 RETURNS TABLE(granted_count integer, subscription_id uuid, reward_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_reward RECORD;
  v_months integer;
  v_count integer := 0;
BEGIN
  FOR v_sub IN
    SELECT cs.id, cs.customer_id, cs.tenant_id, cs.plan_id,
           COALESCE(cs.started_at, cs.created_at) AS start_date,
           sp.accumulates_premium_loyalty
    FROM public.customer_subscriptions cs
    JOIN public.subscription_plans sp ON sp.id = cs.plan_id
    WHERE cs.tenant_id = p_tenant_id
      AND cs.status = 'active'
      AND sp.accumulates_premium_loyalty = true
  LOOP
    v_months := GREATEST(0, EXTRACT(YEAR FROM age(now(), v_sub.start_date))::int * 12
                          + EXTRACT(MONTH FROM age(now(), v_sub.start_date))::int);

    FOR v_reward IN
      SELECT * FROM public.subscription_loyalty_rewards
      WHERE tenant_id = p_tenant_id
        AND active = true
        AND months_required <= v_months
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.subscription_loyalty_history
        WHERE subscription_id = v_sub.id AND reward_id = v_reward.id
      ) THEN
        INSERT INTO public.subscription_loyalty_history
          (tenant_id, customer_id, subscription_id, reward_id, status, granted_at)
        VALUES
          (p_tenant_id, v_sub.customer_id, v_sub.id, v_reward.id, 'granted', now());
        v_count := v_count + 1;
        granted_count := v_count;
        subscription_id := v_sub.id;
        reward_id := v_reward.id;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_role_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If the role is being changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Only allow if the requester is a super_admin
    IF NOT public.is_super_admin() THEN
      -- Also allow the first super_admin to be created if there are NO super_admins yet (optional, but let's stick to the "manual via DB" rule)
      -- The user specifically said: "O sistema deve permitir criar o primeiro super_admin manualmente pelo banco de dados."
      -- Manual updates via SQL (like what I'm doing now or what an admin would do in the Supabase dashboard) bypass triggers if not careful, 
      -- but usually security definer functions and RLS are what we care about.
      -- Actually, triggers run even for DB updates. But the check `public.is_super_admin()` uses `auth.uid()`.
      -- If updating via SQL directly in the dashboard, `auth.uid()` is null, so it might block it.
      
      IF auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'Only super_admins can change roles.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_barber_commissions(p_tenant_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_appt RECORD;
  v_count integer := 0;
BEGIN
  IF p_tenant_id IS DISTINCT FROM auth.uid() AND NOT public.is_super_admin() THEN
    RETURN 0;
  END IF;
  FOR v_appt IN
    SELECT id FROM public.appointments
     WHERE tenant_id = p_tenant_id
       AND status = 'completed'
       AND (p_from IS NULL OR completed_at::date >= p_from)
       AND (p_to   IS NULL OR completed_at::date <= p_to)
  LOOP
    PERFORM public.calculate_commission_for_appointment(v_appt.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_customer_cashback_balance(p_customer_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_earned NUMERIC(10,2);
    v_used NUMERIC(10,2);
    v_refunded NUMERIC(10,2);
    v_expired NUMERIC(10,2);
    v_balance NUMERIC(10,2);
BEGIN
    -- Soma ganhos ( earned, cashback_earned, granted )
    SELECT COALESCE(SUM(amount), 0) INTO v_earned
    FROM public.cashback_transactions
    WHERE customer_id = p_customer_id AND type IN ('earned', 'cashback_earned', 'granted');

    -- Soma utilizados ( used, cashback_used )
    SELECT COALESCE(SUM(amount), 0) INTO v_used
    FROM public.cashback_transactions
    WHERE customer_id = p_customer_id AND type IN ('used', 'cashback_used');

    -- Soma devolvidos ( refunded, cashback_refund )
    SELECT COALESCE(SUM(amount), 0) INTO v_refunded
    FROM public.cashback_transactions
    WHERE customer_id = p_customer_id AND type IN ('refunded', 'cashback_refund');

    -- Soma expirados
    SELECT COALESCE(SUM(amount), 0) INTO v_expired
    FROM public.cashback_transactions
    WHERE customer_id = p_customer_id AND type IN ('expired');

    v_balance := v_earned - v_used + v_refunded - v_expired;

    -- Atualiza a tabela customers
    UPDATE public.customers
    SET cashback_balance = v_balance
    WHERE id = p_customer_id;

    RETURN v_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_customer_credit_balance(p_customer_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_earned NUMERIC(10,2);
    v_used NUMERIC(10,2);
    v_refunded NUMERIC(10,2);
    v_balance NUMERIC(10,2);
BEGIN
    -- Tabela credit_transactions
    SELECT COALESCE(SUM(amount), 0) INTO v_earned
    FROM public.credit_transactions
    WHERE customer_id = p_customer_id AND type IN ('earned', 'credit_earned', 'granted', 'purchase', 'payout');

    SELECT COALESCE(SUM(amount), 0) INTO v_used
    FROM public.credit_transactions
    WHERE customer_id = p_customer_id AND type IN ('used', 'credit_used');

    SELECT COALESCE(SUM(amount), 0) INTO v_refunded
    FROM public.credit_transactions
    WHERE customer_id = p_customer_id AND type IN ('refunded', 'credit_refund');

    v_balance := v_earned - v_used + v_refunded;

    -- Atualiza a tabela customers
    UPDATE public.customers
    SET credits = v_balance
    WHERE id = p_customer_id;

    RETURN v_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reception_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_automation_logs()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Marca logs de botões enviados há mais de 24h sem clique como 'expired' ou similar (opcional, aqui apenas registramos para estatística)
  -- Poderia ser usado para limpar zapi_webhook_debug antigos também
  DELETE FROM public.zapi_webhook_debug WHERE created_at < now() - interval '3 days';
END;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_expired_addons()
 RETURNS TABLE(tenant_id uuid, addon_id uuid, expired_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT ta.id, ta.tenant_id, ta.addon_id, ta.current_period_end
    FROM public.tenant_addons ta
    WHERE ta.cancel_at_period_end = true
      AND ta.current_period_end IS NOT NULL
      AND ta.current_period_end < now()
      AND ta.status <> 'canceled'
  LOOP
    UPDATE public.tenant_addons
    SET status = 'canceled',
        cancelled_at = COALESCE(cancelled_at, now()),
        updated_at = now()
    WHERE id = v_rec.id;

    -- Log admin event (best effort)
    BEGIN
      INSERT INTO public.admin_event_log (event_type, payload, created_at)
      VALUES (
        'addon.expired',
        jsonb_build_object(
          'tenant_id', v_rec.tenant_id,
          'addon_id', v_rec.addon_id,
          'expired_at', v_rec.current_period_end
        ),
        now()
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    tenant_id := v_rec.tenant_id;
    addon_id := v_rec.addon_id;
    expired_at := v_rec.current_period_end;
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(p_reward_id uuid, p_appointment_id uuid, p_applied_cost numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_reward RECORD;
    v_cost NUMERIC(10,2);
BEGIN
    SELECT * INTO v_reward FROM public.loyalty_rewards WHERE id = p_reward_id FOR UPDATE;
    IF v_reward.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'reward_not_found');
    END IF;
    IF v_reward.status <> 'available' THEN
        RETURN jsonb_build_object('success', false, 'error', 'reward_not_available');
    END IF;
    IF v_reward.expires_at IS NOT NULL AND v_reward.expires_at < now() THEN
        UPDATE public.loyalty_rewards SET status = 'expired' WHERE id = p_reward_id;
        RETURN jsonb_build_object('success', false, 'error', 'reward_expired');
    END IF;

    v_cost := COALESCE(p_applied_cost, 0);
    IF v_reward.max_benefit_value > 0 AND v_cost > v_reward.max_benefit_value THEN
        v_cost := v_reward.max_benefit_value;
    END IF;

    UPDATE public.loyalty_rewards
    SET status = 'redeemed',
        redeemed_at = now(),
        redeemed_appointment_id = p_appointment_id,
        barbershop_cost = v_cost
    WHERE id = p_reward_id;

    RETURN jsonb_build_object('success', true, 'reward_id', p_reward_id, 'barbershop_cost', v_cost);
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_subscription_reward(p_history_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS subscription_loyalty_history
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_row public.subscription_loyalty_history;
BEGIN
  UPDATE public.subscription_loyalty_history
  SET status = 'redeemed',
      redeemed_at = now(),
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_history_id AND status = 'granted'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Recompensa não encontrada ou já resgatada';
  END IF;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.regenerate_subscription_card_token(p_subscription_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_uid UUID := auth.uid();
  v_new TEXT;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions
    WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_sub.tenant_id <> v_uid AND NOT public.is_super_admin_user() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_new := encode(gen_random_bytes(24), 'hex');
  UPDATE public.customer_subscriptions
     SET card_token = v_new,
         card_token_issued_at = now(),
         card_token_revoked_at = NULL,
         updated_at = now()
   WHERE id = p_subscription_id;
  RETURN jsonb_build_object('success', true, 'card_token', v_new);
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_pix_tip(_token uuid, _amount numeric, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_rev RECORD;
  v_barber RECORD;
  v_tip_id UUID;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor inválido');
  END IF;

  SELECT r.tenant_id, r.barber_id, r.customer_id, r.appointment_id
    INTO v_rev
  FROM public.appointment_reviews r
  WHERE r.review_token = _token
  LIMIT 1;

  IF v_rev IS NULL OR v_rev.barber_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link inválido');
  END IF;

  SELECT id, pix_key, accepts_tips INTO v_barber
  FROM public.barbers WHERE id = v_rev.barber_id;

  IF NOT COALESCE(v_barber.accepts_tips, true) OR v_barber.pix_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Barbeiro não aceita gorjetas digitais');
  END IF;

  INSERT INTO public.barber_tips (
    tenant_id, barber_id, appointment_id, customer_id, amount, method, status, source, note
  ) VALUES (
    v_rev.tenant_id, v_rev.barber_id, v_rev.appointment_id, v_rev.customer_id,
    _amount, 'pix', 'pending', 'review_link', NULLIF(_note, '')
  )
  RETURNING id INTO v_tip_id;

  RETURN jsonb_build_object('success', true, 'tip_id', v_tip_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_push_subscription(_endpoint text, _p256dh text, _auth text, _user_agent text DEFAULT NULL::text, _customer_phone text DEFAULT NULL::text, _tenant_id uuid DEFAULT NULL::uuid, _audience text DEFAULT 'customer'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF _endpoint IS NULL OR _p256dh IS NULL OR _auth IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_fields');
  END IF;

  INSERT INTO public.push_subscriptions
    (user_id, customer_phone, tenant_id, endpoint, p256dh, auth, user_agent, audience, active, last_seen_at)
  VALUES
    (v_uid, _customer_phone, _tenant_id, _endpoint, _p256dh, _auth, _user_agent, COALESCE(_audience,'customer'), true, now())
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, public.push_subscriptions.user_id),
    customer_phone = COALESCE(EXCLUDED.customer_phone, public.push_subscriptions.customer_phone),
    tenant_id = COALESCE(EXCLUDED.tenant_id, public.push_subscriptions.tenant_id),
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    audience = EXCLUDED.audience,
    active = true,
    last_seen_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_comanda_item(p_sale_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sale RECORD;
  v_tenant UUID;
  v_item JSONB;
  v_qty INTEGER;
  v_prod_id UUID;
BEGIN
  SELECT * INTO v_sale FROM public.product_sales WHERE id = p_sale_id;
  IF NOT FOUND OR v_sale.appointment_id IS NULL THEN
    RAISE EXCEPTION 'sale_not_found';
  END IF;

  v_tenant := public.assert_comanda_access(v_sale.appointment_id);

  -- Restore stock for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_sale.items, '[]'::jsonb)) LOOP
    v_prod_id := (v_item->>'id')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    IF v_prod_id IS NOT NULL THEN
      UPDATE public.products SET stock_quantity = COALESCE(stock_quantity,0) + v_qty WHERE id = v_prod_id;
    END IF;
  END LOOP;

  -- Delete transaction linked to this sale (best-effort by description marker; safer: nothing)
  DELETE FROM public.transactions
    WHERE appointment_id = v_sale.appointment_id
      AND category = 'Venda de Produto'
      AND amount = v_sale.total_amount
      AND description LIKE 'Comanda:%';

  -- Bump appointment totals down + remove item entry with sale_id
  UPDATE public.appointments a
    SET items = COALESCE((
          SELECT jsonb_agg(el)
          FROM jsonb_array_elements(COALESCE(a.items, '[]'::jsonb)) AS el
          WHERE COALESCE(el->>'sale_id','') <> p_sale_id::text
        ), '[]'::jsonb),
        total_price = GREATEST(0, COALESCE(a.total_price,0) - v_sale.total_amount),
        final_amount = GREATEST(0, COALESCE(a.final_amount,0) - v_sale.total_amount),
        updated_at = now()
    WHERE a.id = v_sale.appointment_id;

  DELETE FROM public.product_sales WHERE id = p_sale_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.render_admin_template(_event_key text, _payload jsonb, _fallback_title text, _fallback_message text)
 RETURNS TABLE(title text, message text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  tpl_row public.admin_event_templates;
  rendered_title   text;
  rendered_message text;
  k text;
  v text;
BEGIN
  SELECT * INTO tpl_row FROM public.admin_event_templates WHERE event_key = _event_key;
  IF NOT FOUND THEN
    title := _fallback_title;
    message := _fallback_message;
    RETURN NEXT;
    RETURN;
  END IF;

  rendered_title := tpl_row.title_tpl;
  rendered_message := tpl_row.message_tpl;

  IF _payload IS NOT NULL THEN
    FOR k, v IN SELECT key, COALESCE(value #>> '{}', '') FROM jsonb_each(_payload) LOOP
      rendered_title := replace(rendered_title, '{{' || k || '}}', v);
      rendered_message := replace(rendered_message, '{{' || k || '}}', v);
    END LOOP;
  END IF;

  -- Fallbacks se template ainda estiver vazio
  IF rendered_title IS NULL OR rendered_title = '' THEN rendered_title := _fallback_title; END IF;
  IF rendered_message IS NULL OR rendered_message = '' THEN rendered_message := _fallback_message; END IF;

  title := rendered_title;
  message := rendered_message;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_appointment_refund(p_appointment_id uuid, p_customer_id uuid, p_tenant_id uuid, p_amount numeric, p_pix_key text, p_pix_key_type text, p_account_holder_name text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
 DECLARE
     v_existing_refund_id UUID;
     v_existing_credit_id UUID;
     v_refund_id UUID;
 BEGIN
     -- 1. Check if refund already exists for this appointment (not rejected/cancelled)
     SELECT id INTO v_existing_refund_id
     FROM public.refund_requests
     WHERE appointment_id = p_appointment_id
     AND status NOT IN ('rejected', 'cancelled');

     IF v_existing_refund_id IS NOT NULL THEN
         RETURN jsonb_build_object('success', false, 'error', 'Já existe uma solicitação de estorno ativa para este agendamento.');
     END IF;

     -- 2. Check if credit already exists for this appointment
     SELECT id INTO v_existing_credit_id
     FROM public.customer_credits
     WHERE appointment_id = p_appointment_id
     AND status != 'cancelled';

     IF v_existing_credit_id IS NOT NULL THEN
         RETURN jsonb_build_object('success', false, 'error', 'O valor deste agendamento já foi convertido em crédito.');
     END IF;

     -- 3. Update appointment status
     UPDATE public.appointments
     SET 
         status = 'cancelled',
         cancelled_at = now(),
         customer_action_source = 'link_publico',
         refund_status = 'refund_requested',
         refund_type = 'refund'
     WHERE id = p_appointment_id;

     -- 4. Create refund request
     INSERT INTO public.refund_requests (
         tenant_id,
         appointment_id,
         customer_id,
         amount,
         pix_key,
         pix_type,
         holder_name,
         notes,
         status,
         created_at
     ) VALUES (
         p_tenant_id,
         p_appointment_id,
         p_customer_id,
         p_amount,
         p_pix_key,
         p_pix_key_type,
         p_account_holder_name,
         p_notes,
         'requested',
         now()
     ) RETURNING id INTO v_refund_id;

     RETURN jsonb_build_object('success', true, 'refund_id', v_refund_id);
 END;
$function$;

CREATE OR REPLACE FUNCTION public.customer_cancel_request_refund(p_appointment_id uuid, p_holder_name text, p_pix_key text, p_pix_type text, p_notes text DEFAULT NULL::text, p_source text DEFAULT 'customer_portal'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_appt RECORD;
    v_fin JSONB;
    v_response JSONB;
BEGIN
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado.');
    END IF;

    v_fin := public.check_appointment_financial_status(p_appointment_id);

    IF NOT COALESCE((v_fin->>'has_paid_pix')::boolean, false) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este agendamento não possui pagamento Pix para estorno.');
    END IF;

    SELECT public.request_appointment_refund(
        p_appointment_id,
        v_appt.customer_id,
        v_appt.tenant_id,
        COALESCE(v_appt.pix_amount, v_appt.total_price),
        p_pix_key,
        p_pix_type,
        p_holder_name,
        COALESCE(p_notes, 'Cancelamento solicitado pelo cliente via portal')
    ) INTO v_response;

    IF NOT (v_response->>'success')::BOOLEAN THEN
        RETURN v_response;
    END IF;

    UPDATE public.appointments
    SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = 'customer',
        cancel_source = p_source,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_subscription_plan_change(_subscription_id uuid, _new_plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub public.customer_subscriptions%ROWTYPE;
  v_old public.subscription_plans%ROWTYPE;
  v_new public.subscription_plans%ROWTYPE;
  v_change_type text;
  v_days_remaining int;
  v_days_in_cycle int;
  v_change_id uuid;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = _subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;

  SELECT * INTO v_new FROM public.subscription_plans WHERE id = _new_plan_id AND tenant_id = v_sub.tenant_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de destino inválido';
  END IF;

  SELECT * INTO v_old FROM public.subscription_plans WHERE id = v_sub.plan_id;

  IF v_old.id = v_new.id THEN
    RAISE EXCEPTION 'Você já está neste plano';
  END IF;

  v_change_type := CASE
    WHEN v_new.monthly_price > COALESCE(v_old.monthly_price, 0) THEN 'upgrade'
    WHEN v_new.monthly_price < COALESCE(v_old.monthly_price, 0) THEN 'downgrade'
    ELSE 'same'
  END;

  v_days_in_cycle := GREATEST(1, EXTRACT(DAY FROM (v_sub.current_period_end - v_sub.current_period_start))::int);
  v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.current_period_end - now()))::int);

  INSERT INTO public.subscription_plan_changes (
    tenant_id, customer_id, subscription_id, old_plan_id, new_plan_id,
    old_price, new_price, days_remaining, days_in_cycle,
    change_type, effective_date, notes
  ) VALUES (
    v_sub.tenant_id, v_sub.customer_id, v_sub.id, v_old.id, v_new.id,
    COALESCE(v_old.monthly_price, 0), v_new.monthly_price, v_days_remaining, v_days_in_cycle,
    v_change_type,
    CASE WHEN v_change_type = 'downgrade' THEN v_sub.current_period_end ELSE now() END,
    'Solicitado pelo cliente via portal'
  ) RETURNING id INTO v_change_id;

  IF v_change_type = 'upgrade' OR v_change_type = 'same' THEN
    UPDATE public.customer_subscriptions
    SET plan_id = v_new.id,
        metadata = COALESCE(metadata, '{}'::jsonb) - 'pending_plan_id' - 'pending_plan_name',
        updated_at = now()
    WHERE id = v_sub.id;
  ELSE
    -- downgrade: store pending change, applied at renewal
    UPDATE public.customer_subscriptions
    SET metadata = COALESCE(metadata, '{}'::jsonb)
                   || jsonb_build_object('pending_plan_id', v_new.id::text, 'pending_plan_name', v_new.name),
        updated_at = now()
    WHERE id = v_sub.id;
  END IF;

  RETURN jsonb_build_object(
    'change_id', v_change_id,
    'change_type', v_change_type,
    'applied', v_change_type IN ('upgrade','same'),
    'effective_at', CASE WHEN v_change_type = 'downgrade' THEN v_sub.current_period_end ELSE now() END
  );
END $function$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(p_appointment_id uuid, p_new_start_time timestamp with time zone, p_new_end_time timestamp with time zone, p_changed_by_type text DEFAULT 'system'::text, p_changed_by_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'rpc'::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_new_barber_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_appt          record;
  v_barber        record;
  v_svc_link      integer;
  v_conflict      integer;
  v_old_start     timestamp with time zone;
  v_old_end       timestamp with time zone;
  v_old_barber_id uuid;
  v_new_barber_id uuid;
  v_barber_changed boolean := false;
  v_day_key       text;
  v_wh            jsonb;
  v_wh_enabled    boolean;
  v_wh_start      text;
  v_wh_end        text;
  v_local_start   timestamp;
  v_local_end     timestamp;
  v_start_hm      text;
  v_end_hm        text;
  v_log_created   boolean := false;
  v_log_error     text;
  v_old_snapshot  jsonb;
  v_new_snapshot  jsonb;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  IF v_appt.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível reagendar um agendamento cancelado');
  END IF;
  IF v_appt.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível reagendar um agendamento já concluído');
  END IF;

  IF v_appt.appointment_group_id IS NOT NULL AND p_new_barber_id IS NOT NULL
     AND p_new_barber_id <> v_appt.barber_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reagendamento de combos ainda não permite troca de profissional'
    );
  END IF;

  v_old_start     := v_appt.start_time;
  v_old_end       := v_appt.end_time;
  v_old_barber_id := v_appt.barber_id;
  v_new_barber_id := COALESCE(p_new_barber_id, v_appt.barber_id);
  v_barber_changed := (v_new_barber_id IS DISTINCT FROM v_old_barber_id);

  SELECT jsonb_build_object(
    'id', a.id,
    'tenant_id', a.tenant_id,
    'customer_id', a.customer_id,
    'service_id', a.service_id,
    'professional_id', a.barber_id,
    'barber_id', a.barber_id,
    'start_time', a.start_time,
    'end_time', a.end_time,
    'payment_method', a.payment_method,
    'management_token', a.management_token,
    'appointment_group_id', a.appointment_group_id,
    'total_price', COALESCE(a.total_price, s.price, 0),
    'customer', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'phone', c.phone
    ),
    'service', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'price', COALESCE(a.total_price, s.price, 0)
    ),
    'professional', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'phone', b.phone
    )
  ) INTO v_old_snapshot
  FROM public.appointments a
  LEFT JOIN public.customers c ON c.id = a.customer_id
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.barbers b ON b.id = a.barber_id
  WHERE a.id = p_appointment_id;

  IF v_barber_changed THEN
    SELECT * INTO v_barber
      FROM public.barbers
     WHERE id = v_new_barber_id
       AND tenant_id = v_appt.tenant_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profissional não encontrado nesta barbearia');
    END IF;
    IF COALESCE(v_barber.active, false) = false THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profissional inativo');
    END IF;

    IF v_appt.service_id IS NOT NULL THEN
      SELECT count(*) INTO v_svc_link
        FROM public.barber_services
       WHERE barber_id = v_new_barber_id
         AND service_id = v_appt.service_id;
      IF v_svc_link = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profissional não realiza este serviço');
      END IF;
    END IF;

    v_wh := v_barber.working_hours;
    IF v_wh IS NULL OR v_wh = '{}'::jsonb THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profissional sem agenda configurada');
    END IF;
  END IF;

  IF v_barber_changed THEN
    v_wh := v_barber.working_hours;
  ELSE
    SELECT working_hours INTO v_wh FROM public.barbers WHERE id = v_new_barber_id;
  END IF;

  IF v_wh IS NOT NULL AND v_wh <> '{}'::jsonb THEN
    v_local_start := (p_new_start_time AT TIME ZONE 'America/Sao_Paulo');
    v_local_end   := (p_new_end_time   AT TIME ZONE 'America/Sao_Paulo');
    v_day_key := CASE extract(dow FROM v_local_start)::int
      WHEN 0 THEN 'sunday' WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday'
      WHEN 3 THEN 'wednesday' WHEN 4 THEN 'thursday' WHEN 5 THEN 'friday'
      WHEN 6 THEN 'saturday' END;
    v_wh_enabled := COALESCE((v_wh -> v_day_key ->> 'enabled')::boolean, false);
    v_wh_start   := v_wh -> v_day_key ->> 'start';
    v_wh_end     := v_wh -> v_day_key ->> 'end';

    IF NOT v_wh_enabled THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profissional não trabalha neste dia');
    END IF;

    v_start_hm := to_char(v_local_start, 'HH24:MI');
    v_end_hm   := to_char(v_local_end,   'HH24:MI');
    IF v_wh_start IS NOT NULL AND v_start_hm < v_wh_start THEN
      RETURN jsonb_build_object('success', false, 'error', 'Horário fora do expediente do profissional');
    END IF;
    IF v_wh_end IS NOT NULL AND v_end_hm > v_wh_end THEN
      RETURN jsonb_build_object('success', false, 'error', 'Horário fora do expediente do profissional');
    END IF;
  END IF;

  SELECT count(*) INTO v_conflict
    FROM public.appointments
   WHERE barber_id = v_new_barber_id
     AND id <> p_appointment_id
     AND status NOT IN ('cancelled', 'no_show')
     AND start_time < p_new_end_time
     AND end_time   > p_new_start_time;

  IF v_conflict > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Este horário acabou de ser ocupado. Escolha outro horário.',
      'code',    'slot_taken'
    );
  END IF;

  UPDATE public.appointments
     SET start_time = p_new_start_time,
         end_time   = p_new_end_time,
         barber_id  = v_new_barber_id,
         updated_at = now(),
         updated_by_type = p_changed_by_type,
         updated_by_id   = p_changed_by_id,
         customer_action_source = CASE
           WHEN p_changed_by_type = 'customer' THEN p_source
           ELSE customer_action_source
         END
   WHERE id = p_appointment_id;

  SELECT jsonb_build_object(
    'id', a.id,
    'tenant_id', a.tenant_id,
    'customer_id', a.customer_id,
    'service_id', a.service_id,
    'professional_id', a.barber_id,
    'barber_id', a.barber_id,
    'start_time', a.start_time,
    'end_time', a.end_time,
    'payment_method', a.payment_method,
    'management_token', a.management_token,
    'appointment_group_id', a.appointment_group_id,
    'total_price', COALESCE(a.total_price, s.price, 0),
    'customer', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'phone', c.phone
    ),
    'service', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'price', COALESCE(a.total_price, s.price, 0)
    ),
    'professional', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'phone', b.phone
    )
  ) INTO v_new_snapshot
  FROM public.appointments a
  LEFT JOIN public.customers c ON c.id = a.customer_id
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.barbers b ON b.id = a.barber_id
  WHERE a.id = p_appointment_id;

  BEGIN
    INSERT INTO public.appointment_status_logs (
      appointment_id, old_status, new_status,
      status_before, status_after,
      changed_by_type, changed_by_id, source, metadata
    ) VALUES (
      p_appointment_id,
      v_appt.status, v_appt.status,
      v_appt.status, v_appt.status,
      p_changed_by_type, p_changed_by_id, p_source,
      p_metadata || jsonb_build_object(
        'action',              CASE WHEN v_barber_changed THEN 'reschedule_with_barber_change' ELSE 'reschedule' END,
        'old_start',           v_old_start,
        'new_start',           p_new_start_time,
        'old_end',             v_old_end,
        'new_end',             p_new_end_time,
        'previous_barber_id',  v_old_barber_id,
        'new_barber_id',       v_new_barber_id,
        'barber_changed',      v_barber_changed,
        'changed_at',          now()
      )
    );
    v_log_created := true;
  EXCEPTION WHEN OTHERS THEN
    v_log_error := SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',            true,
    'barber_changed',     v_barber_changed,
    'previous_barber_id', v_old_barber_id,
    'new_barber_id',      v_new_barber_id,
    'oldAppointment',     v_old_snapshot,
    'newAppointment',     v_new_snapshot,
    'actor_type',         p_changed_by_type,
    'actor_id',           p_changed_by_id,
    'source',             p_source,
    'log_created',        v_log_created,
    'log_error',          v_log_error
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_usage_log_on_appointment_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_service_name text;
  v_qty integer;
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  IF NEW.subscription_id IS NOT NULL
     AND COALESCE(NEW.subscription_covered_amount, 0) > 0
     AND COALESCE(NEW.status, '') NOT IN ('cancelled','canceled','no_show') THEN

    SELECT name INTO v_service_name FROM public.services WHERE id = NEW.service_id;
    v_qty := public._compute_consume_quantity(v_service_name);

    SELECT current_period_start, current_period_end INTO v_period_start, v_period_end
      FROM public.customer_subscriptions WHERE id = NEW.subscription_id;

    INSERT INTO public.subscription_usage_logs (
      tenant_id, subscription_id, customer_id, appointment_id, service_id,
      benefit_type, covered_amount, extra_amount, consume_quantity,
      status, used_at, period_start, period_end
    ) VALUES (
      NEW.tenant_id, NEW.subscription_id, NEW.customer_id, NEW.id, NEW.service_id,
      'service',
      COALESCE(NEW.subscription_covered_amount, 0),
      GREATEST(0, COALESCE(NEW.total_price, 0) - COALESCE(NEW.subscription_covered_amount, 0)),
      v_qty,
      CASE WHEN NEW.status = 'completed' THEN 'consumed' ELSE 'reserved' END,
      COALESCE(NEW.start_time, now()),
      v_period_start, v_period_end
    )
    ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL
    DO UPDATE SET
      consume_quantity = GREATEST(public.subscription_usage_logs.consume_quantity, EXCLUDED.consume_quantity),
      covered_amount = EXCLUDED.covered_amount,
      extra_amount = EXCLUDED.extra_amount;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_tenant_billing_context(_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_profile record;
  v_sub record;
  v_plan record;
  v_voucher record;
  v_addons_total numeric := 0;
  v_original numeric := 0;
  v_discount numeric := 0;
  v_final numeric := 0;
  v_has_voucher boolean := false;
BEGIN
  -- AUTHZ: só o próprio tenant ou super_admin
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error','unauthenticated');
  END IF;
  IF auth.uid() <> _tenant_id AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  SELECT id, email, business_name, plan
    INTO v_profile
    FROM public.profiles
    WHERE id = _tenant_id;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('error','tenant_not_found','tenant_id',_tenant_id);
  END IF;

  SELECT *
    INTO v_sub
    FROM public.subscriptions
    WHERE user_id = _tenant_id
    ORDER BY created_at DESC
    LIMIT 1;

  SELECT id, name, slug, price_monthly
    INTO v_plan
    FROM public.plans
    WHERE slug = COALESCE(v_profile.plan, 'starter')
    LIMIT 1;

  v_original := COALESCE(v_plan.price_monthly, 0);

  SELECT COALESCE(SUM(unit_price * COALESCE(quantity,1)), 0)
    INTO v_addons_total
    FROM public.tenant_addons
    WHERE tenant_id = _tenant_id
      AND status IN ('active','trialing');

  SELECT v.*
    INTO v_voucher
    FROM public.saas_admin_vouchers v
    JOIN public.saas_admin_voucher_redemptions r ON r.voucher_id = v.id
    WHERE r.tenant_id = _tenant_id
      AND r.status = 'active'
      AND v.status = 'active'
      AND v.revoked_at IS NULL
      AND (v.expires_at IS NULL OR v.expires_at > now())
    ORDER BY r.applied_at DESC
    LIMIT 1;

  v_has_voucher := v_voucher.id IS NOT NULL;

  IF v_has_voucher THEN
    v_discount := ROUND(((v_original + v_addons_total) * COALESCE(v_voucher.discount_percentage,0) / 100)::numeric, 2);
  END IF;

  v_final := GREATEST((v_original + v_addons_total) - v_discount, 0);

  RETURN jsonb_build_object(
    'tenant_id', v_profile.id,
    'tenant_name', v_profile.business_name,
    'tenant_email', v_profile.email,
    'plan_slug', v_profile.plan,
    'plan_name', COALESCE(v_plan.name, v_profile.plan),
    'stripe_subscription_status', COALESCE(v_sub.stripe_subscription_status, v_sub.status),
    'stripe_subscription_id', v_sub.stripe_subscription_id,
    'billing_status', COALESCE(v_sub.billing_status,
      CASE WHEN v_has_voucher THEN 'voucher_active' ELSE 'active_paid' END),
    'billing_source', COALESCE(v_sub.billing_source,
      CASE WHEN v_has_voucher THEN 'voucher' ELSE 'stripe' END),
    'is_internal_test_tenant', COALESCE(v_sub.is_internal_test_tenant, false)
      OR (v_has_voucher AND v_voucher.purpose = 'internal_testing'),
    'has_active_voucher', v_has_voucher,
    'voucher', CASE WHEN v_has_voucher THEN jsonb_build_object(
      'id', v_voucher.id,
      'name', v_voucher.name,
      'purpose', v_voucher.purpose,
      'duration_type', v_voucher.duration_type,
      'starts_at', v_voucher.starts_at,
      'expires_at', v_voucher.expires_at,
      'discount_percentage', v_voucher.discount_percentage,
      'includes_all_addons', v_voucher.includes_all_addons,
      'requires_payment_method', v_voucher.requires_payment_method,
      'applied_at', v_voucher.applied_at
    ) ELSE NULL END,
    'original_monthly_amount', v_original,
    'addons_monthly_amount', v_addons_total,
    'discount_amount', v_discount,
    'final_monthly_amount', v_final,
    'requires_payment_method', COALESCE(v_voucher.requires_payment_method, true)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.resume_customer_subscription(p_subscription_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_uid UUID := auth.uid();
  v_paused_days INTEGER := 0;
  v_new_period_end TIMESTAMPTZ;
  v_new_next_billing TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions
    WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura não encontrada');
  END IF;
  IF v_sub.tenant_id <> v_uid AND NOT public.is_super_admin_user() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;
  IF v_sub.status <> 'paused' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura não está pausada');
  END IF;

  v_paused_days := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_sub.paused_at)) / 86400)::int;
  v_new_period_end := v_sub.current_period_end + make_interval(days => v_paused_days);
  v_new_next_billing := COALESCE(v_sub.next_billing_at, v_sub.current_period_end) + make_interval(days => v_paused_days);

  UPDATE public.customer_subscriptions
     SET status = 'active',
         resumed_at = now(),
         current_period_end = v_new_period_end,
         next_billing_at = v_new_next_billing,
         total_paused_days = COALESCE(total_paused_days,0) + v_paused_days,
         auto_renew = true,
         updated_at = now()
   WHERE id = p_subscription_id;

  INSERT INTO public.subscription_status_logs(
    tenant_id, subscription_id, customer_id, old_status, new_status,
    reason, changed_by, metadata
  ) VALUES (
    v_sub.tenant_id, p_subscription_id, v_sub.customer_id, 'paused', 'active',
    'resumed', v_uid, jsonb_build_object('paused_days', v_paused_days, 'new_period_end', v_new_period_end)
  );

  RETURN jsonb_build_object('success', true, 'paused_days', v_paused_days, 'new_period_end', v_new_period_end);
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_default_workflows_v2()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    t_id uuid;
BEGIN
    FOR t_id IN SELECT id FROM profiles LOOP
        -- Lista exaustiva de workflows conforme solicitado
        -- Use INSERT ON CONFLICT para não duplicar
        
        -- confirmation_single
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'confirmation_single', 'Confirmação de Agendamento Único', 'appointment.created', true, jsonb_build_object('flow_type', 'single'))
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.created';

        -- confirmation_multi
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'confirmation_multi', 'Confirmação de Múltiplos Agendamentos', 'appointment.created', true, jsonb_build_object('flow_type', 'multi'))
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.created';

        -- appointment_cancelled
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'appointment_cancelled', 'Cancelamento de Agendamento', 'appointment.cancelled', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.cancelled';

        -- appointment_rescheduled
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'appointment_rescheduled', 'Reagendamento de Agendamento', 'appointment.rescheduled', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.rescheduled';

        -- appointment_reminder
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'appointment_reminder', 'Lembrete de Agendamento', 'appointment.reminder', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.reminder';

        -- customer_birthday
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'customer_birthday', 'Aniversário do Cliente', 'customer.birthday', false, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'customer.birthday';

        -- inactive_customer
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'inactive_customer', 'Cliente Inativo', 'customer.inactive', false, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'customer.inactive';

        -- post_service
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'post_service', 'Pós-atendimento', 'appointment.completed', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.completed';

        -- review_request
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'review_request', 'Pedido de Avaliação', 'appointment.completed', false, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.completed';

        -- credit_created
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'credit_created', 'Crédito Adicionado', 'credit.created', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'credit.created';

        -- cashback_created
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'cashback_created', 'Cashback Gerado', 'cashback.created', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'cashback.created';

        -- payment_confirmed
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'payment_confirmed', 'Pagamento Confirmado', 'payment.confirmed', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'payment.confirmed';

        -- payment_pending
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'payment_pending', 'Pagamento Pendente', 'payment.pending', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'payment.pending';

        -- notify_barbershop_new_appointment
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'notify_barbershop_new_appointment', 'Notificar Barbearia (Novo Agendamento)', 'appointment.created', false, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.created';

        -- notify_professional_new_appointment
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'notify_professional_new_appointment', 'Notificar Profissional (Novo Agendamento)', 'appointment.created', false, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.created';

    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_subscription_automation_templates(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.automation_templates (tenant_id, key, name, channel, trigger_event, template, active)
  VALUES
    (
      p_tenant_id,
      'subscription.reward_unlocked',
      'Recompensa Premium Desbloqueada',
      'whatsapp',
      'subscription.reward_unlocked',
      E'Olá {{customer_name}}! 👑\n\nVocê acaba de desbloquear uma recompensa exclusiva do seu plano *{{plan_name}}*:\n\n🎁 *{{reward_description}}*\n\nVocê já está há {{tenure_months}} meses conosco. Obrigado pela fidelidade!\n\nFale conosco para resgatar.',
      true
    ),
    (
      p_tenant_id,
      'subscription.tenure_milestone',
      'Marco de Tempo de Assinatura',
      'whatsapp',
      'subscription.tenure_milestone',
      E'Parabéns {{customer_name}}! 🎉\n\nVocê completou *{{tenure_months}} meses* como assinante do plano *{{plan_name}}*.\n\nObrigado por confiar na nossa barbearia. Continue aproveitando todos os seus benefícios exclusivos!',
      true
    )
  ON CONFLICT (tenant_id, key) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_subscription_reward_unlocked_template(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.automation_templates (tenant_id, key, name, channel, trigger_event, template, active, requires_callback)
  VALUES (
    p_tenant_id,
    'subscription_reward_unlocked',
    'Recompensa Premium Desbloqueada',
    'whatsapp',
    'subscription.reward_unlocked',
    E'Olá {{customer_name}} 🎉\n\nParabéns! Você desbloqueou uma nova recompensa da sua assinatura premium na {{barbershop_name}}.\n\n🎁 Recompensa: {{reward_description}}\n\nContinue aproveitando seus benefícios exclusivos como assinante!',
    true,
    false
  )
  ON CONFLICT (tenant_id, key) DO UPDATE
    SET trigger_event = EXCLUDED.trigger_event,
        channel = EXCLUDED.channel,
        requires_callback = false,
        updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_appointment_review_decision(p_appointment_id uuid, p_decision text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id uuid;
  v_appt public.appointments;
  v_customer_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_decision != 'skipped' THEN
    RAISE EXCEPTION 'invalid_decision: manual decision via RPC can only be skipped';
  END IF;

  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found';
  END IF;

  IF v_appt.status != 'completed' THEN
    RAISE EXCEPTION 'appointment_not_completed: review decision is only applicable to completed appointments';
  END IF;

  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE id = v_appt.customer_id
    AND tenant_id = v_appt.tenant_id
    AND auth_user_id = v_user_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: caller is not the owner of this appointment';
  END IF;

  IF EXISTS (SELECT 1 FROM public.appointment_reviews WHERE appointment_id = p_appointment_id) THEN
    RAISE EXCEPTION 'review_already_submitted: cannot skip an appointment with an existing review';
  END IF;

  IF v_appt.review_decision = 'submitted' THEN
    RAISE EXCEPTION 'cannot_change_submitted_decision';
  END IF;

  IF v_appt.review_decision = 'skipped' THEN
    RETURN jsonb_build_object(
      'success', true,
      'appointment_id', p_appointment_id,
      'review_decision', 'skipped',
      'idempotent', true
    );
  END IF;

  UPDATE public.appointments
  SET review_decision = 'skipped',
      updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', p_appointment_id,
    'review_decision', 'skipped'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_subscription_card_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.card_token IS NULL THEN
    NEW.card_token := encode(gen_random_bytes(24), 'hex');
    NEW.card_token_issued_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_subscription_referral_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_subscription_referral_code();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_appointment_payment(p_appointment_id uuid, p_service_amount numeric, p_products_amount numeric, p_tip_amount numeric, p_discount_amount numeric, p_payment_breakdown jsonb, p_tip_barber_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_appt RECORD;
  v_uid UUID := auth.uid();
  v_is_owner BOOLEAN := false;
  v_is_barber BOOLEAN := false;
  v_cash NUMERIC := COALESCE((p_payment_breakdown->>'cash')::NUMERIC, 0);
  v_credit NUMERIC := COALESCE((p_payment_breakdown->>'credit_card')::NUMERIC, 0);
  v_debit NUMERIC := COALESCE((p_payment_breakdown->>'debit_card')::NUMERIC, 0);
  v_pix NUMERIC := COALESCE((p_payment_breakdown->>'pix')::NUMERIC, 0);
  v_other NUMERIC := COALESCE((p_payment_breakdown->>'other')::NUMERIC, 0);
  v_paid_total NUMERIC;
  v_expected NUMERIC;
  v_final NUMERIC;
  v_method TEXT;
  v_nonzero INT := 0;
  v_tip_barber UUID;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  v_is_owner := (v_uid = v_appt.tenant_id);
  IF NOT v_is_owner AND v_appt.barber_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.barbers b WHERE b.id = v_appt.barber_id AND b.user_id = v_uid
    ) INTO v_is_barber;
  END IF;

  IF NOT (v_is_owner OR v_is_barber) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  p_service_amount  := COALESCE(p_service_amount, 0);
  p_products_amount := COALESCE(p_products_amount, 0);
  p_tip_amount      := COALESCE(p_tip_amount, 0);
  p_discount_amount := COALESCE(p_discount_amount, 0);

  IF p_service_amount < 0 OR p_products_amount < 0 OR p_tip_amount < 0 OR p_discount_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valores negativos não permitidos');
  END IF;

  v_final := p_service_amount + p_products_amount + p_tip_amount - p_discount_amount;
  IF v_final < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Desconto maior que o total');
  END IF;

  v_paid_total := v_cash + v_credit + v_debit + v_pix + v_other;

  IF ROUND(v_paid_total::numeric, 2) <> ROUND(v_final::numeric, 2) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Total das formas de pagamento (' || v_paid_total || ') difere do total (' || v_final || ')'
    );
  END IF;

  -- Determine primary payment method
  IF v_cash > 0 THEN v_nonzero := v_nonzero + 1; v_method := 'cash'; END IF;
  IF v_credit > 0 THEN v_nonzero := v_nonzero + 1; v_method := 'credit_card'; END IF;
  IF v_debit > 0 THEN v_nonzero := v_nonzero + 1; v_method := 'debit_card'; END IF;
  IF v_pix > 0 THEN v_nonzero := v_nonzero + 1; v_method := 'pix'; END IF;
  IF v_other > 0 THEN v_nonzero := v_nonzero + 1; v_method := COALESCE(v_method, 'other'); END IF;
  IF v_nonzero > 1 THEN v_method := 'mixed'; END IF;
  IF v_nonzero = 0 AND v_final = 0 THEN v_method := 'free'; END IF;

  v_tip_barber := COALESCE(p_tip_barber_id, v_appt.barber_id);

  UPDATE public.appointments SET
    service_amount = p_service_amount,
    products_amount = p_products_amount,
    tip_amount = p_tip_amount,
    tip_barber_id = v_tip_barber,
    discount_amount = p_discount_amount,
    subtotal_amount = p_service_amount + p_products_amount,
    final_amount = v_final,
    total_price = v_final,
    amount_paid = v_final,
    cash_amount = v_cash,
    credit_card_amount = v_credit,
    debit_card_amount = v_debit,
    pix_amount = v_pix,
    extra_amount = v_other,
    payment_method = v_method,
    payment_breakdown = p_payment_breakdown,
    payment_status = 'paid',
    updated_at = now()
  WHERE id = p_appointment_id;

  -- Register/refresh main financial transaction for the service+tip portion.
  -- Product portions are already lançadas por add_product_to_comanda.
  IF (p_service_amount + p_tip_amount - p_discount_amount) > 0 THEN
    INSERT INTO public.transactions (
      tenant_id, type, amount, category, description,
      payment_method, appointment_id, barber_id, transaction_date
    ) VALUES (
      v_appt.tenant_id, 'income',
      p_service_amount + p_tip_amount - p_discount_amount,
      CASE WHEN p_tip_amount > 0 THEN 'service_with_tip' ELSE 'service' END,
      'Fechamento agendamento #' || substring(p_appointment_id::text, 1, 8)
        || CASE WHEN p_tip_amount > 0 THEN ' (inclui gorjeta R$ ' || p_tip_amount || ')' ELSE '' END,
      v_method, p_appointment_id, v_appt.barber_id, now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'final_amount', v_final,
    'payment_method', v_method
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_review_by_token(_token uuid, _barbershop_rating integer, _barber_rating integer, _service_rating integer DEFAULT NULL::integer, _testimonial_text text DEFAULT NULL::text, _would_recommend text DEFAULT NULL::text, _allow_public_display boolean DEFAULT false, _service_id uuid DEFAULT NULL::uuid)
 RETURNS appointment_reviews
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_row public.appointment_reviews;
BEGIN
  UPDATE public.appointment_reviews
     SET barbershop_rating = COALESCE(_barbershop_rating, barbershop_rating),
         barber_rating = COALESCE(_barber_rating, barber_rating),
         service_rating = COALESCE(_service_rating, service_rating),
         testimonial_text = COALESCE(NULLIF(trim(_testimonial_text), ''), testimonial_text),
         would_recommend = COALESCE(_would_recommend, would_recommend),
         allow_public_display = COALESCE(_allow_public_display, allow_public_display),
         service_id = COALESCE(_service_id, service_id),
         submitted_at = COALESCE(submitted_at, now()),
         token_used_at = now(),
         testimonial_status = 'pending',
         updated_at = now()
   WHERE review_token = _token
     AND (token_expires_at IS NULL OR token_expires_at > now())
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_token';
  END IF;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_review_by_token(_token uuid, _barbershop_rating integer, _barber_rating integer, _testimonial text, _would_recommend text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  rec public.appointment_reviews%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM public.appointment_reviews WHERE review_token = _token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;
  IF rec.token_used_at IS NOT NULL OR rec.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_submitted');
  END IF;
  IF _barbershop_rating IS NULL OR _barbershop_rating < 1 OR _barbershop_rating > 5
     OR _barber_rating IS NULL OR _barber_rating < 1 OR _barber_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_rating');
  END IF;
  IF _would_recommend IS NOT NULL AND _would_recommend NOT IN ('yes','maybe','no') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_recommend');
  END IF;

  UPDATE public.appointment_reviews
     SET barbershop_rating = _barbershop_rating,
         barber_rating = _barber_rating,
         testimonial_text = NULLIF(trim(_testimonial), ''),
         would_recommend = _would_recommend,
         testimonial_status = CASE WHEN NULLIF(trim(_testimonial), '') IS NOT NULL THEN 'pending' ELSE testimonial_status END,
         submitted_at = now(),
         token_used_at = now()
   WHERE id = rec.id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.subscription_active_months(p_subscription_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_total_days NUMERIC;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_total_days := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_sub.started_at)) / 86400 - COALESCE(v_sub.total_paused_days, 0));
  RETURN FLOOR(v_total_days / 30.4375)::int;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_appointment_review_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE public.appointments
  SET review_decision = 'submitted',
      updated_at = now()
  WHERE id = NEW.appointment_id
    AND (review_decision IS NULL OR review_decision != 'submitted');

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_barbershop_modules(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  mod text;
  allowed jsonb;
  default_enabled boolean;
  plan_slug text;
  resolved_plan_id uuid;
BEGIN
  -- 1) tenta plan_id em barbershops
  SELECT plan_id INTO resolved_plan_id FROM public.barbershops WHERE id = p_tenant_id;

  -- 2) fallback: resolve via profiles.effective_plan/plan
  IF resolved_plan_id IS NULL THEN
    SELECT p.id INTO resolved_plan_id
      FROM public.profiles pr
      JOIN public.plans p
        ON p.slug = lower(coalesce(nullif(pr.effective_plan,''), nullif(pr.plan,''), 'starter'))
     WHERE pr.id = p_tenant_id;
  END IF;

  IF resolved_plan_id IS NULL THEN RETURN; END IF;

  SELECT p.allowed_modules, p.slug INTO allowed, plan_slug
    FROM public.plans p WHERE p.id = resolved_plan_id;
  IF allowed IS NULL THEN RETURN; END IF;

  FOR mod IN SELECT jsonb_array_elements_text(allowed) LOOP
    default_enabled := CASE
      WHEN mod IN ('dashboard','calendar','customers','barbers','services','finances','basic_finance','support','whatsapp','client_portal','barber_panel','reports_basic') THEN true
      ELSE false
    END;
    INSERT INTO public.barbershop_modules (tenant_id, module_key, enabled)
    VALUES (p_tenant_id, mod, default_enabled)
    ON CONFLICT (tenant_id, module_key) DO NOTHING;
  END LOOP;

  UPDATE public.barbershop_modules
     SET enabled = false
   WHERE tenant_id = p_tenant_id
     AND NOT (allowed ? module_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_barbershop_to_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE public.profiles p
  SET
    business_name       = COALESCE(NULLIF(p.business_name, ''), NEW.name),
    slug                = COALESCE(NULLIF(p.slug, ''),           NULLIF(NEW.slug, p.id::text)),
    barbershop_logo_url = COALESCE(NULLIF(NEW.logo_url, ''),     p.barbershop_logo_url),
    logo_url            = COALESCE(NULLIF(NEW.logo_url, ''),     p.logo_url),
    updated_at          = now()
  WHERE p.id = NEW.owner_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_customer_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Only sync to credits balance if it is NOT cashback
    IF NEW.credit_type = 'cashback' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' AND NEW.status = 'available' THEN
        UPDATE public.customers 
        SET credits = COALESCE(credits, 0) + NEW.amount
        WHERE id = NEW.customer_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != 'available' AND NEW.status = 'available' THEN
            UPDATE public.customers 
            SET credits = COALESCE(credits, 0) + NEW.amount
            WHERE id = NEW.customer_id;
        ELSIF OLD.status = 'available' AND NEW.status != 'available' THEN
             UPDATE public.customers 
            SET credits = COALESCE(credits, 0) - OLD.amount
            WHERE id = OLD.customer_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_modules_for_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  mod text;
  allowed jsonb;
  default_enabled boolean;
  plan_slug text;
BEGIN
  IF NEW.plan_id IS NULL THEN RETURN NEW; END IF;

  SELECT p.allowed_modules, p.slug INTO allowed, plan_slug
  FROM public.plans p WHERE p.id = NEW.plan_id;

  IF allowed IS NULL THEN RETURN NEW; END IF;

  -- Inserir módulos novos (que vieram com o plano)
  FOR mod IN SELECT jsonb_array_elements_text(allowed) LOOP
    default_enabled := CASE
      WHEN plan_slug = 'starter' THEN true
      WHEN mod IN ('dashboard','calendar','customers','barbers','services','finances','basic_finance','support','commissions','loyalty','coupons','whatsapp','client_portal','barber_panel','reports_basic','automations_basic') THEN true
      ELSE false
    END;
    INSERT INTO public.barbershop_modules (tenant_id, module_key, enabled)
    VALUES (NEW.id, mod, default_enabled)
    ON CONFLICT (tenant_id, module_key) DO NOTHING;
  END LOOP;

  -- Desativar módulos que NÃO pertencem mais ao plano (downgrade)
  UPDATE public.barbershop_modules
     SET enabled = false
   WHERE tenant_id = NEW.id
     AND NOT (allowed ? module_key);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_notification_read_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_read IS NOT NULL THEN
      NEW.read := NEW.is_read;
    ELSIF NEW.read IS NOT NULL THEN
      NEW.is_read := NEW.read;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_read IS DISTINCT FROM OLD.is_read THEN
      NEW.read := NEW.is_read;
      IF NEW.is_read = true AND NEW.read_at IS NULL THEN
        NEW.read_at := now();
      END IF;
    ELSIF NEW.read IS DISTINCT FROM OLD.read THEN
      NEW.is_read := NEW.read;
      IF NEW.read = true AND NEW.read_at IS NULL THEN
        NEW.read_at := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_usage_logs_on_appointment_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_service_name text;
  v_qty integer;
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'completed'
       AND NEW.subscription_id IS NOT NULL
       AND COALESCE(NEW.subscription_covered_amount,0) > 0 THEN

      SELECT name INTO v_service_name FROM public.services WHERE id = NEW.service_id;
      v_qty := public._compute_consume_quantity(v_service_name);
      SELECT current_period_start, current_period_end INTO v_period_start, v_period_end
        FROM public.customer_subscriptions WHERE id = NEW.subscription_id;

      INSERT INTO public.subscription_usage_logs (
        tenant_id, subscription_id, customer_id, appointment_id, service_id,
        benefit_type, covered_amount, extra_amount, consume_quantity, status, used_at, period_start, period_end
      ) VALUES (
        NEW.tenant_id, NEW.subscription_id, NEW.customer_id, NEW.id, NEW.service_id,
        'service',
        COALESCE(NEW.subscription_covered_amount,0),
        GREATEST(0, COALESCE(NEW.total_price,0) - COALESCE(NEW.subscription_covered_amount,0)),
        v_qty,
        'consumed',
        COALESCE(NEW.completed_at, now()),
        v_period_start, v_period_end
      )
      ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL
      DO UPDATE SET
        status = 'consumed',
        used_at = COALESCE(public.subscription_usage_logs.used_at, EXCLUDED.used_at),
        consume_quantity = GREATEST(public.subscription_usage_logs.consume_quantity, EXCLUDED.consume_quantity),
        covered_amount = EXCLUDED.covered_amount,
        extra_amount = EXCLUDED.extra_amount;

    ELSIF NEW.status IN ('canceled','cancelled','no_show') THEN
      UPDATE public.subscription_usage_logs
         SET status = 'cancelled'
       WHERE appointment_id = NEW.id AND status IN ('reserved','consumed');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.test_rls_module_guards()
 RETURNS TABLE(table_name text, operation text, expected text, actual text, passed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  fake_user uuid := gen_random_uuid();
  tables text[] := ARRAY[
    'barber_commissions','cashback_transactions','commission_closings','commission_entries',
    'customer_subscriptions','loyalty_campaign_participations','loyalty_campaign_templates',
    'loyalty_campaigns','loyalty_rewards','loyalty_settings','product_images','product_sales',
    'products','subscription_card_scans','subscription_invoices','subscription_loyalty_history',
    'subscription_loyalty_rewards','subscription_payments','subscription_plan_benefit_services',
    'subscription_plan_benefits','subscription_plan_changes','subscription_plan_services',
    'subscription_plans','subscription_referrals','subscription_status_logs','subscription_usage_logs'
  ];
  t text;
  err_msg text;
  blocked boolean;
BEGIN
  -- Only super admins can run this diagnostic
  IF NOT public.is_super_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: super admin only';
  END IF;

  FOREACH t IN ARRAY tables LOOP
    blocked := false;
    err_msg := NULL;
    BEGIN
      -- Simulate authenticated user without any premium module
      EXECUTE format(
        'SET LOCAL role authenticated; ' ||
        'SET LOCAL "request.jwt.claims" = %L; ' ||
        'INSERT INTO public.%I DEFAULT VALUES;',
        json_build_object('sub', fake_user::text, 'role','authenticated')::text,
        t
      );
    EXCEPTION WHEN OTHERS THEN
      blocked := true;
      err_msg := SQLERRM;
    END;
    RESET role;

    table_name := t;
    operation := 'INSERT';
    expected := 'BLOCKED (RLS)';
    actual := CASE WHEN blocked THEN 'BLOCKED: ' || COALESCE(err_msg,'') ELSE 'ALLOWED (LEAK!)' END;
    passed := blocked AND (
      err_msg ILIKE '%row-level security%' OR
      err_msg ILIKE '%violates row-level%' OR
      err_msg ILIKE '%permission denied%' OR
      err_msg ILIKE '%new row violates%'
    );
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_admin_notify_lgpd()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.accepted_privacy = false OR NEW.source = 'deletion_request' THEN
    PERFORM public.create_admin_notification('lgpd_request','Solicitação LGPD',
      'Cliente registrou solicitação relacionada a privacidade/LGPD.',
      NEW.tenant_id, NEW.user_id, 'privacy_consent', NEW.id, '/admin/tenants', 'high');
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_admin_notify_new_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE v_name text;
BEGIN
  IF NEW.role IS DISTINCT FROM 'super_admin' AND NEW.tenant_id IS NOT NULL THEN
    v_name := COALESCE(NEW.barbershop_name, NEW.display_name, NEW.email, 'Nova barbearia');
    PERFORM public.create_admin_notification(
      'new_tenant', 'Nova barbearia cadastrada',
      v_name || ' iniciou teste grátis no Barbex.',
      NEW.tenant_id, NEW.id, 'profile', NEW.id, '/admin/tenants', 'normal'
    );
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_admin_notify_plan_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.effective_plan,'') IS DISTINCT FROM COALESCE(NEW.effective_plan,'') THEN
    v_name := COALESCE(NEW.business_name, NEW.responsible_name, NEW.email, 'Barbearia');
    BEGIN
      INSERT INTO public.admin_notifications (type, title, message, metadata)
      VALUES (
        'plan_change',
        'Plano atualizado',
        v_name || ' → ' || COALESCE(NEW.effective_plan,'—'),
        jsonb_build_object('tenant_id', NEW.id, 'from', OLD.effective_plan, 'to', NEW.effective_plan)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_admin_notify_saas_checkout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status IN ('paid','complete','succeeded')) OR
     (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('paid','complete','succeeded')) THEN
    PERFORM public.create_admin_notification('subscription_paid','Pagamento recebido',
      'Nova assinatura paga via Stripe.',
      NEW.tenant_id, NEW.user_id, 'saas_checkout_session', NEW.id, '/admin/subscriptions', 'high');
  ELSIF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('failed','payment_failed','canceled_failed')) THEN
    PERFORM public.create_admin_notification('subscription_failed','Pagamento falhou',
      'Assinatura falhou no checkout do Stripe.',
      NEW.tenant_id, NEW.user_id, 'saas_checkout_session', NEW.id, '/admin/subscriptions', 'critical');
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_admin_notify_support_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE v_ticket public.support_tickets%ROWTYPE;
BEGIN
  IF COALESCE(NEW.is_admin_reply,false) = false THEN
    SELECT * INTO v_ticket FROM public.support_tickets WHERE id = NEW.ticket_id;
    PERFORM public.create_admin_notification('support_ticket_replied','Resposta em chamado de suporte',
      COALESCE(LEFT(NEW.message,120),'Nova mensagem do cliente'),
      v_ticket.barbershop_id, NEW.sender_id, 'support_ticket', NEW.ticket_id, '/admin/support', 'normal');
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_admin_notify_support_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  PERFORM public.create_admin_notification('support_ticket_created','Novo chamado de suporte',
    COALESCE(NEW.title,'Chamado aberto'),
    NEW.barbershop_id, NEW.user_id, 'support_ticket', NEW.id, '/admin/support', 'high');
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_barbershop_modules_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_block_disabled_cashback()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_enabled boolean;
BEGIN
  IF NEW.type = 'earned' THEN
    SELECT COALESCE(cashback_enabled, false) INTO v_enabled
      FROM public.profiles WHERE id = NEW.tenant_id;
    IF NOT v_enabled THEN
      RAISE NOTICE 'Cashback ledger insert ignored: cashback is disabled for tenant %', NEW.tenant_id;
      RETURN NULL;  -- swallow the insert silently
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_log_barbershop_module_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.barbershop_module_logs (tenant_id, module_key, old_value, new_value, changed_by)
    VALUES (NEW.tenant_id, NEW.module_key, NULL, NEW.enabled, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND OLD.enabled IS DISTINCT FROM NEW.enabled THEN
    INSERT INTO public.barbershop_module_logs (tenant_id, module_key, old_value, new_value, changed_by)
    VALUES (NEW.tenant_id, NEW.module_key, OLD.enabled, NEW.enabled, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_loyalty_premium_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.tg_loyalty_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END $function$;

CREATE OR REPLACE FUNCTION public.tg_sync_modules_on_profile_plan_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF (coalesce(NEW.effective_plan,'') IS DISTINCT FROM coalesce(OLD.effective_plan,''))
     OR (coalesce(NEW.plan,'') IS DISTINCT FROM coalesce(OLD.plan,'')) THEN
    PERFORM public.sync_barbershop_modules(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.tr_handle_appointment_confirmation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    tpl_record RECORD;
    v_idempotency_key TEXT;
BEGIN
    BEGIN -- Safety block
        -- Only for new appointments
        IF (TG_OP = 'INSERT') THEN
            -- Find active template
            SELECT * INTO tpl_record
            FROM public.automation_templates
            WHERE tenant_id = NEW.tenant_id
            AND key = 'appointment_confirmation'
            AND active = true;

            IF FOUND THEN
                -- Generate key: type + appointment_id
                v_idempotency_key := 'appointment_confirmation:' || NEW.id;

                -- Insert into queue with idempotency check
                INSERT INTO public.automation_queue (tenant_id, automation_id, appointment_id, status, idempotency_key)
                VALUES (NEW.tenant_id, tpl_record.id, NEW.id, 'pending', v_idempotency_key)
                ON CONFLICT (idempotency_key) WHERE status != 'error' DO NOTHING;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error in tr_handle_appointment_confirmation: %', SQLERRM;
    END;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tr_refund_subscription_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_log_id uuid;
BEGIN
  -- Only act on transition INTO canceled
  IF NEW.status = 'canceled'
     AND (OLD.status IS NULL OR OLD.status <> 'canceled')
     AND NEW.subscription_id IS NOT NULL THEN

    -- Find any usage log tied to this appointment
    SELECT id INTO v_log_id
    FROM public.subscription_usage_logs
    WHERE appointment_id = NEW.id
    LIMIT 1;

    IF v_log_id IS NOT NULL THEN
      DELETE FROM public.subscription_usage_logs WHERE id = v_log_id;

      -- Decrement uses_this_period (clamp at 0)
      UPDATE public.customer_subscriptions
      SET uses_this_period = GREATEST(0, uses_this_period - 1),
          updated_at = now()
      WHERE id = NEW.subscription_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_commission_on_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' THEN
      PERFORM public.create_barber_commission_for_appointment(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.create_barber_commission_for_appointment(NEW.id);
  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.barber_commissions
    SET status = 'cancelled', updated_at = now()
    WHERE appointment_id = NEW.id
      AND barber_id = NEW.barber_id
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_notify_admin_revenue_milestone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_month_start timestamptz;
  v_month_key text;
  v_total numeric;
  v_prev_total numeric;
  v_threshold numeric;
  v_shop_name text;
  v_thresholds numeric[] := ARRAY[1000, 5000, 10000, 50000, 100000];
BEGIN
  IF NEW.tenant_id IS NULL OR COALESCE(NEW.type, '') <> 'income' THEN
    RETURN NEW;
  END IF;

  v_month_start := date_trunc('month', COALESCE(NEW.created_at, now()));
  v_month_key := to_char(v_month_start, 'YYYY-MM');

  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM public.transactions
  WHERE tenant_id = NEW.tenant_id
    AND type = 'income'
    AND created_at >= v_month_start
    AND created_at < v_month_start + interval '1 month';

  v_prev_total := v_total - COALESCE(NEW.amount, 0);

  SELECT COALESCE(business_name, responsible_name, email) INTO v_shop_name
  FROM public.profiles WHERE id = NEW.tenant_id;

  FOREACH v_threshold IN ARRAY v_thresholds LOOP
    IF v_prev_total < v_threshold AND v_total >= v_threshold THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.admin_event_log
        WHERE event_key = 'revenue.milestone'
          AND tenant_id = NEW.tenant_id
          AND payload->>'month' = v_month_key
          AND (payload->>'threshold')::numeric = v_threshold
      ) THEN
        PERFORM public.emit_admin_event_panel(
          'revenue.milestone',
          'info',
          'Marco de receita atingido 🎉',
          COALESCE(v_shop_name, 'Barbearia') || ' cruzou R$ ' || to_char(v_threshold, 'FM999G999') || ' em ' || v_month_key,
          NEW.tenant_id,
          '/admin/finance',
          jsonb_build_object('threshold', v_threshold, 'total', v_total, 'month', v_month_key)
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_notify_admin_support_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_shop_name text;
BEGIN
  SELECT COALESCE(business_name, responsible_name, email) INTO v_shop_name
  FROM public.profiles WHERE id = NEW.barbershop_id;

  PERFORM public.emit_admin_event_panel(
    'support.ticket_created',
    'info',
    'Novo chamado de suporte',
    COALESCE(v_shop_name, 'Barbearia') || ' abriu: ' || NEW.title,
    NEW.barbershop_id,
    '/admin/support',
    jsonb_build_object('ticket_id', NEW.id, 'category', NEW.category, 'priority', NEW.priority)
  );

  IF NEW.priority IN ('urgent', 'high') THEN
    PERFORM public.emit_admin_event_panel(
      'support.ticket_urgent',
      'critical',
      'Chamado urgente aberto',
      COALESCE(v_shop_name, 'Barbearia') || ' — ' || NEW.title,
      NEW.barbershop_id,
      '/admin/support',
      jsonb_build_object('ticket_id', NEW.id, 'priority', NEW.priority)
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_notify_admin_tenant_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.business_name IS NOT NULL OR NEW.role IN ('admin', 'shop_owner') THEN
    PERFORM public.emit_admin_event_panel(
      'tenant.signup',
      'Nova barbearia cadastrada',
      COALESCE(NEW.business_name, NEW.responsible_name, NEW.email, 'Sem nome'),
      'info',
      NEW.id,
      '/admin/tenants',
      jsonb_build_object(
        'tenant_id', NEW.id,
        'business_name', NEW.business_name,
        'email', NEW.email,
        'plan', NEW.plan
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_appointment_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_event_name TEXT;
    v_automation_type TEXT;
    v_tenant_id UUID;
    v_workflow RECORD;
    v_automation_id UUID;
    v_customer_phone TEXT;
BEGIN
    BEGIN -- Outer block for safety
        v_tenant_id := NEW.tenant_id;

        -- 1. Detecção do Evento
        IF TG_OP = 'INSERT' THEN
            v_event_name := 'appointment.created';
            v_automation_type := 'new_appointment';
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.status IS DISTINCT FROM OLD.status THEN
                IF NEW.status = 'confirmed' THEN
                    v_event_name := 'appointment.confirmed';
                    v_automation_type := 'appointment_confirmation';
                ELSIF NEW.status = 'cancelled' THEN
                    v_event_name := 'appointment.cancelled';
                    v_automation_type := 'cancellation';
                ELSIF NEW.status = 'completed' THEN
                    v_event_name := 'appointment.completed';
                    v_automation_type := 'post_service';
                ELSE
                    v_event_name := 'appointment.updated';
                    v_automation_type := 'rescheduling';
                END IF;
            ELSIF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
                v_event_name := 'appointment.rescheduled';
                v_automation_type := 'rescheduling';
            ELSE
                RETURN NEW;
            END IF;
        END IF;

        -- 2. Buscar telefone do cliente
        SELECT phone INTO v_customer_phone FROM public.customers WHERE id = NEW.customer_id;

        -- 3. Obter ID de automação válido da tabela public.automations
        BEGIN
            v_automation_id := public.get_or_create_automation(v_tenant_id, v_automation_type);
        EXCEPTION WHEN OTHERS THEN
            v_automation_id := NULL;
        END;

        -- 4. Loop pelos templates para enfileirar (se existirem)
        FOR v_workflow in
            SELECT id, key, active FROM public.automation_templates
            WHERE tenant_id = v_tenant_id
            AND trigger_event = v_event_name
        LOOP
            IF v_workflow.active THEN
                IF v_customer_phone IS NULL OR v_customer_phone = '' THEN
                    -- Log de Telefone Ausente (non-blocking)
                    BEGIN
                        INSERT INTO public.automation_logs (
                            tenant_id, automation_id, appointment_id, status, message_type, phone, payload, error_message
                        ) VALUES (
                            v_tenant_id, v_automation_id, NEW.id, 'error', v_workflow.key, v_customer_phone,
                            jsonb_build_object('diagnostic', 'customer_phone_missing', 'origin', 'automatic'),
                            'customer_phone_missing'
                        );
                    EXCEPTION WHEN OTHERS THEN
                        -- Ignore logging errors
                    END;
                    CONTINUE;
                END IF;

                -- Inserir na fila
                BEGIN
                    INSERT INTO public.automation_queue (
                        tenant_id,
                        appointment_id,
                        customer_id,
                        automation_id,
                        automation_type,
                        workflow_key,
                        status,
                        scheduled_for,
                        attempts
                    ) VALUES (
                        v_tenant_id,
                        NEW.id,
                        NEW.customer_id,
                        v_workflow.id,
                        v_automation_type,
                        v_workflow.key,
                        'pending',
                        now(),
                        0
                    ) ON CONFLICT (appointment_id, workflow_key) 
                    WHERE status = 'pending' DO NOTHING;
                EXCEPTION WHEN OTHERS THEN
                    -- Ignore queueing errors
                END;
            END IF;
        END LOOP;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error in trigger_appointment_automation: %', SQLERRM;
    END;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_cashback()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.recalculate_customer_cashback_balance(OLD.customer_id);
        RETURN OLD;
    ELSE
        PERFORM public.recalculate_customer_cashback_balance(NEW.customer_id);
        RETURN NEW;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.recalculate_customer_credit_balance(OLD.customer_id);
        RETURN OLD;
    ELSE
        PERFORM public.recalculate_customer_credit_balance(NEW.customer_id);
        RETURN NEW;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_subscription_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_event_name TEXT;
  v_workflow_key TEXT;
  v_template RECORD;
  v_customer RECORD;
  v_plan RECORD;
  v_barbershop_name TEXT;
  v_subscription_amount TEXT;
  v_renewal_date TEXT;
  v_idem TEXT;
BEGIN
  -- 1. Detect event
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status, 'active') IN ('active','trialing') THEN
      v_event_name := 'subscription.created';
      v_workflow_key := 'subscription_welcome';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'canceled' THEN
        v_event_name := 'subscription.canceled';
        v_workflow_key := 'subscription_canceled';
      ELSIF NEW.status IN ('past_due','unpaid','payment_failed') THEN
        v_event_name := 'subscription.payment_failed';
        v_workflow_key := 'subscription_payment_failed';
      ELSIF (OLD.status NOT IN ('active','trialing')) AND NEW.status IN ('active','trialing') THEN
        -- Reativação conta como nova boas-vindas
        v_event_name := 'subscription.created';
        v_workflow_key := 'subscription_welcome';
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- 2. Find active template for this tenant + key
  SELECT id, template, active INTO v_template
  FROM public.automation_templates
  WHERE tenant_id = NEW.tenant_id AND key = v_workflow_key
  LIMIT 1;

  IF v_template.id IS NULL OR v_template.active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- 3. Customer & data
  SELECT id, name, phone INTO v_customer FROM public.customers WHERE id = NEW.customer_id;
  IF v_customer.phone IS NULL OR v_customer.phone = '' THEN
    RETURN NEW;
  END IF;

  SELECT name, monthly_price INTO v_plan FROM public.subscription_plans WHERE id = NEW.plan_id;
  SELECT COALESCE(business_name, responsible_name, 'Nossa Barbearia') INTO v_barbershop_name
  FROM public.profiles WHERE id = NEW.tenant_id;

  v_subscription_amount := to_char(COALESCE(v_plan.monthly_price, 0), 'FM999G990D00');
  v_renewal_date := to_char(COALESCE(NEW.next_billing_at, NEW.current_period_end) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');
  v_idem := 'sub_' || v_workflow_key || '_' || NEW.id::text || '_' || COALESCE(NEW.status,'-');

  -- 4. Enqueue
  BEGIN
    INSERT INTO public.automation_queue (
      tenant_id, automation_id, customer_id, automation_type, workflow_key,
      event_name, status, scheduled_for, attempts, idempotency_key, payload
    ) VALUES (
      NEW.tenant_id, v_template.id, NEW.customer_id, v_workflow_key, v_workflow_key,
      v_event_name, 'pending', now(), 0, v_idem,
      jsonb_build_object(
        'customer_name', COALESCE(v_customer.name, 'Cliente'),
        'barbershop_name', v_barbershop_name,
        'subscription_plan', COALESCE(v_plan.name, 'Plano'),
        'subscription_amount', v_subscription_amount,
        'renewal_date', v_renewal_date,
        'subscription_id', NEW.id,
        'rendered', v_template.template
      )
    ) ON CONFLICT (idempotency_key) WHERE status <> 'error' DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_subscription_automation enqueue failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unregister_push_subscription(_endpoint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE public.push_subscriptions SET active = false, updated_at = now() WHERE endpoint = _endpoint;
  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_barber_commissions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_barber_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    UPDATE public.barbers
    SET 
        average_rating = (
            SELECT AVG(rating)::DECIMAL(3,2) 
            FROM public.service_ratings 
            WHERE barber_id = NEW.barber_id
        ),
        total_ratings = (
            SELECT COUNT(*) 
            FROM public.service_ratings 
            WHERE barber_id = NEW.barber_id
        )
    WHERE id = NEW.barber_id;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_barber_working_hours(p_barber_id uuid, p_working_hours jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count int;
BEGIN
  UPDATE public.barbers
  SET working_hours = p_working_hours,
      updated_at = now()
  WHERE id = p_barber_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_bg_jobs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_payment_gateway_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_tenant_webhooks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_whatsapp_delivery_logs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_workflow_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.status = 'success') THEN
            UPDATE public.automation_workflows 
            SET total_sent = total_sent + 1,
                last_execution_at = NEW.created_at
            WHERE id = NEW.workflow_id;
        ELSIF (NEW.status = 'error') THEN
            UPDATE public.automation_workflows 
            SET total_failed = total_failed + 1,
                last_execution_at = NEW.created_at
            WHERE id = NEW.workflow_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.use_customer_credits(p_customer_id uuid, p_amount numeric, p_appointment_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_available_credits NUMERIC;
    v_credit_record RECORD;
    v_remaining_to_deduct NUMERIC := p_amount;
    v_deducted_total NUMERIC := 0;
BEGIN
    -- 1. Check total available credits with row-level lock
    SELECT COALESCE(credits, 0) INTO v_available_credits FROM customers WHERE id = p_customer_id FOR UPDATE;
    
    IF v_available_credits < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Saldo de créditos insuficiente');
    END IF;

    -- 2. Deduct from customer_credits records (FIFO)
    FOR v_credit_record IN 
        SELECT id, amount, used_amount, available_amount 
        FROM customer_credits 
        WHERE customer_id = p_customer_id AND status IN ('available', 'partially_used')
        ORDER BY created_at ASC
        FOR UPDATE
    LOOP
        IF v_remaining_to_deduct <= 0 THEN
            EXIT;
        END IF;

        IF v_credit_record.available_amount <= v_remaining_to_deduct THEN
            -- Use full record
            UPDATE customer_credits 
            SET 
                used_amount = amount,
                status = 'used',
                updated_at = now()
            WHERE id = v_credit_record.id;
            
            v_remaining_to_deduct := v_remaining_to_deduct - v_credit_record.available_amount;
            v_deducted_total := v_deducted_total + v_credit_record.available_amount;
        ELSE
            -- Use partial record
            UPDATE customer_credits 
            SET 
                used_amount = used_amount + v_remaining_to_deduct,
                status = 'partially_used',
                updated_at = now()
            WHERE id = v_credit_record.id;
            
            v_deducted_total := v_deducted_total + v_remaining_to_deduct;
            v_remaining_to_deduct := 0;
        END IF;
    END LOOP;

    -- 3. Update the global credit balance on customer record
    UPDATE customers 
    SET 
        credits = credits - p_amount,
        updated_at = now()
    WHERE id = p_customer_id;

    RETURN jsonb_build_object('success', true, 'deducted', p_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_appointment_review_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_appt public.appointments;
BEGIN
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = NEW.appointment_id
  FOR UPDATE;

  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found: appointment % does not exist', NEW.appointment_id;
  END IF;

  IF v_appt.status != 'completed' THEN
    RAISE EXCEPTION 'appointment_not_completed: cannot review appointment with status %', v_appt.status;
  END IF;

  IF v_appt.review_decision = 'skipped' THEN
    RAISE EXCEPTION 'review_decision_already_skipped: customer chose not to review this appointment';
  END IF;

  IF v_appt.customer_id != NEW.customer_id OR v_appt.tenant_id != NEW.tenant_id THEN
    RAISE EXCEPTION 'inconsistent_review_target: customer or tenant does not match appointment';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_subscription_card(p_token text, p_scanned_by uuid DEFAULT NULL::uuid, p_log boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
  v_customer RECORD;
  v_last_use TIMESTAMPTZ;
  v_remaining INTEGER;
  v_result TEXT;
  v_reason TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_sub FROM public.customer_subscriptions
    WHERE card_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'not_found');
  END IF;

  IF v_sub.card_token_revoked_at IS NOT NULL THEN
    v_result := 'revoked'; v_reason := 'token_revoked';
  ELSIF v_sub.status = 'canceled' THEN
    v_result := 'invalid'; v_reason := 'subscription_canceled';
  ELSIF v_sub.status = 'expired' THEN
    v_result := 'invalid'; v_reason := 'subscription_expired';
  ELSIF v_sub.status = 'paused' THEN
    v_result := 'paused'; v_reason := 'subscription_paused';
  ELSIF v_sub.status = 'active' THEN
    v_result := 'valid';
  ELSE
    v_result := 'pending'; v_reason := v_sub.status;
  END IF;

  SELECT id, name, avatar_url, phone INTO v_customer
    FROM public.customers WHERE id = v_sub.customer_id;

  SELECT id, name, plan_type, monthly_price, usage_type, max_uses_per_month, benefits
    INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;

  SELECT MAX(used_at) INTO v_last_use FROM public.subscription_usage_logs
    WHERE subscription_id = v_sub.id;

  IF v_plan.usage_type = 'limited' THEN
    v_remaining := GREATEST(0, COALESCE(v_plan.max_uses_per_month, 0) - COALESCE(v_sub.uses_this_period, 0));
  ELSE
    v_remaining := NULL;
  END IF;

  IF p_log THEN
    INSERT INTO public.subscription_card_scans(
      tenant_id, customer_id, subscription_id, scanned_by, result, reason
    ) VALUES (
      v_sub.tenant_id, v_sub.customer_id, v_sub.id, p_scanned_by, v_result, v_reason
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', v_result = 'valid',
    'result', v_result,
    'reason', v_reason,
    'subscription_id', v_sub.id,
    'tenant_id', v_sub.tenant_id,
    'status', v_sub.status,
    'current_period_end', v_sub.current_period_end,
    'paused_until', v_sub.pause_until,
    'customer', CASE WHEN v_customer.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', v_customer.name,
      'avatar_url', v_customer.avatar_url,
      'phone_masked', CASE WHEN v_customer.phone IS NULL THEN NULL
        ELSE regexp_replace(v_customer.phone, '(\d{2})(\d+)(\d{4})', '\1*****\3') END
    ) END,
    'plan', CASE WHEN v_plan.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', v_plan.name,
      'plan_type', v_plan.plan_type,
      'monthly_price', v_plan.monthly_price,
      'usage_type', v_plan.usage_type,
      'max_uses_per_month', v_plan.max_uses_per_month,
      'benefits', v_plan.benefits
    ) END,
    'uses_this_period', v_sub.uses_this_period,
    'remaining_uses', v_remaining,
    'last_use', v_last_use
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_subscription_coupon(p_tenant_id uuid, p_code text, p_plan_price numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_discount numeric(10,2) := 0;
  v_final numeric(10,2) := COALESCE(p_plan_price, 0);
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Código vazio');
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE tenant_id = p_tenant_id
    AND upper(code) = upper(trim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom inválido ou inexistente');
  END IF;

  IF v_coupon.applies_to <> 'subscription' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este cupom não é válido para assinaturas');
  END IF;

  IF NOT v_coupon.active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom inativo');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom expirado');
  END IF;

  IF v_coupon.usage_limit IS NOT NULL AND COALESCE(v_coupon.used_count,0) >= v_coupon.usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom atingiu o limite de usos');
  END IF;

  IF v_coupon.type = 'fixed' THEN
    v_discount := LEAST(v_coupon.value, COALESCE(p_plan_price,0));
  ELSE
    v_discount := ROUND((COALESCE(p_plan_price,0) * (v_coupon.value / 100.0))::numeric, 2);
  END IF;

  IF v_coupon.max_discount IS NOT NULL THEN
    v_discount := LEAST(v_discount, v_coupon.max_discount);
  END IF;

  v_final := GREATEST(0, COALESCE(p_plan_price,0) - v_discount);

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'coupon_code', v_coupon.code,
    'discount_type', v_coupon.type,
    'discount_value', v_coupon.value,
    'first_month_only', v_coupon.first_month_only,
    'discount_amount', v_discount,
    'final_amount', v_final
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_subscription_referral_code(p_tenant_id uuid, p_code text, p_new_customer_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub RECORD;
BEGIN
  IF p_code IS NULL OR LENGTH(TRIM(p_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'empty');
  END IF;

  SELECT cs.id, cs.customer_id, cs.tenant_id, cs.status, c.name AS customer_name
  INTO v_sub
  FROM public.customer_subscriptions cs
  JOIN public.customers c ON c.id = cs.customer_id
  WHERE UPPER(cs.referral_code) = UPPER(TRIM(p_code))
    AND cs.tenant_id = p_tenant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_sub.status NOT IN ('active', 'paused', 'pending_payment') THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;

  IF p_new_customer_id IS NOT NULL AND v_sub.customer_id = p_new_customer_id THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'self_referral');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'referrer_subscription_id', v_sub.id,
    'referrer_customer_id', v_sub.customer_id,
    'referrer_name', v_sub.customer_name
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_subscription_referral(p_subscription_id uuid, p_referral_code text, p_reward_type text DEFAULT 'free_month'::text, p_reward_value numeric DEFAULT 0, p_reward_description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_new_sub RECORD;
  v_validation JSONB;
  v_ref_id UUID;
BEGIN
  SELECT * INTO v_new_sub FROM public.customer_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'subscription_not_found');
  END IF;

  v_validation := public.validate_subscription_referral_code(v_new_sub.tenant_id, p_referral_code, v_new_sub.customer_id);
  IF NOT (v_validation->>'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', v_validation->>'reason');
  END IF;

  UPDATE public.customer_subscriptions
  SET referred_by_code = UPPER(TRIM(p_referral_code)),
      referred_by_subscription_id = (v_validation->>'referrer_subscription_id')::uuid
  WHERE id = p_subscription_id;

  INSERT INTO public.subscription_referrals (
    tenant_id, referrer_customer_id, referrer_subscription_id,
    referred_customer_id, subscription_id, referral_code,
    status, reward_type, reward_value, reward_description
  ) VALUES (
    v_new_sub.tenant_id,
    (v_validation->>'referrer_customer_id')::uuid,
    (v_validation->>'referrer_subscription_id')::uuid,
    v_new_sub.customer_id,
    v_new_sub.id,
    UPPER(TRIM(p_referral_code)),
    'pending',
    p_reward_type,
    COALESCE(p_reward_value, 0),
    p_reward_description
  )
  ON CONFLICT (subscription_id) DO NOTHING
  RETURNING id INTO v_ref_id;

  RETURN jsonb_build_object('success', true, 'referral_id', v_ref_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_usage_log_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('reserved','consumed','cancelled','refunded') THEN
    RAISE EXCEPTION 'invalid status %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_staff_verification_challenge(p_challenge_id uuid, p_barber_id uuid, p_code_hash text, p_max_attempts integer DEFAULT 5)
 RETURNS TABLE(success boolean, error_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_row record;
BEGIN
  SELECT *
  INTO v_row
  FROM public.verification_challenges
  WHERE id = p_challenge_id
    AND barber_id = p_barber_id
    AND purpose = 'staff_email_verification'
    AND verified_at IS NULL
    AND consumed_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, 'NOT_FOUND_OR_EXPIRED'::text;
    RETURN;
  END IF;

  IF v_row.attempts >= p_max_attempts THEN
    DELETE FROM public.verification_challenges
    WHERE id = p_challenge_id;

    RETURN QUERY
    SELECT false, 'ATTEMPTS_EXCEEDED'::text;
    RETURN;
  END IF;

  IF v_row.code_hash <> p_code_hash THEN
    IF (v_row.attempts + 1) >= p_max_attempts THEN
      DELETE FROM public.verification_challenges
      WHERE id = p_challenge_id;

      RETURN QUERY
      SELECT false, 'ATTEMPTS_EXCEEDED'::text;
    ELSE
      UPDATE public.verification_challenges
      SET attempts = attempts + 1
      WHERE id = p_challenge_id;

      RETURN QUERY
      SELECT false, 'INVALID_CODE'::text;
    END IF;

    RETURN;
  END IF;

  UPDATE public.verification_challenges
  SET verified_at = now()
  WHERE id = p_challenge_id;

  RETURN QUERY
  SELECT true, 'OK'::text;
END;
$function$;

-- ==============================================================================
-- 07. DATABASE TRIGGERS (EXACTLY 110 CANONICAL PHYSICAL TRIGGERS)
-- REBUILT DIRECTLY FROM AUTHORITATIVE PHYSICAL SOURCE TRIGGER CATALOG
-- ==============================================================================
DROP TRIGGER IF EXISTS update_academy_lessons_updated_at ON public.academy_lessons;
CREATE TRIGGER update_academy_lessons_updated_at BEFORE UPDATE ON public.academy_lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_academy_paths_updated_at ON public.academy_paths;
CREATE TRIGGER update_academy_paths_updated_at BEFORE UPDATE ON public.academy_paths FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_academy_progress_updated_at ON public.academy_progress;
CREATE TRIGGER update_academy_progress_updated_at BEFORE UPDATE ON public.academy_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_addon_upgrade_rec_updated_at ON public.addon_upgrade_recommendations;
CREATE TRIGGER trg_addon_upgrade_rec_updated_at BEFORE UPDATE ON public.addon_upgrade_recommendations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_admin_event_subs_updated ON public.admin_event_subscriptions;
CREATE TRIGGER trg_admin_event_subs_updated BEFORE UPDATE ON public.admin_event_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_sync_appointment_review_decision ON public.appointment_reviews;
CREATE TRIGGER trg_sync_appointment_review_decision AFTER INSERT ON public.appointment_reviews FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_review_decision();

DROP TRIGGER IF EXISTS trg_validate_appointment_review_before_insert ON public.appointment_reviews;
CREATE TRIGGER trg_validate_appointment_review_before_insert BEFORE INSERT ON public.appointment_reviews FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_review_before_insert();

DROP TRIGGER IF EXISTS update_appointment_reviews_updated_at ON public.appointment_reviews;
CREATE TRIGGER update_appointment_reviews_updated_at BEFORE UPDATE ON public.appointment_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_payment_status_change ON public.appointments;
CREATE TRIGGER on_payment_status_change AFTER UPDATE OF payment_status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.log_payment_status_change();

DROP TRIGGER IF EXISTS tr_ensure_appointment_tenant_id ON public.appointments;
CREATE TRIGGER tr_ensure_appointment_tenant_id BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.ensure_appointment_tenant_id();

DROP TRIGGER IF EXISTS tr_handle_appointment_completion ON public.appointments;
CREATE TRIGGER tr_handle_appointment_completion AFTER UPDATE ON public.appointments FOR EACH ROW WHEN (new.status = 'completed'::text AND (old.status IS NULL OR old.status <> 'completed'::text)) EXECUTE FUNCTION public.handle_appointment_completion();

DROP TRIGGER IF EXISTS tr_notify_new_appointment ON public.appointments;
CREATE TRIGGER tr_notify_new_appointment AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.notify_new_appointment();

DROP TRIGGER IF EXISTS tr_reserve_usage_log_on_insert ON public.appointments;
CREATE TRIGGER tr_reserve_usage_log_on_insert AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.reserve_usage_log_on_appointment_insert();

DROP TRIGGER IF EXISTS tr_sync_usage_logs_on_status ON public.appointments;
CREATE TRIGGER tr_sync_usage_logs_on_status AFTER UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.sync_usage_logs_on_appointment_status();

DROP TRIGGER IF EXISTS trg_appointment_completion_review_decision ON public.appointments;
CREATE TRIGGER trg_appointment_completion_review_decision BEFORE INSERT OR UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_completion_review_decision();

DROP TRIGGER IF EXISTS trg_appointments_no_overlap ON public.appointments;
CREATE TRIGGER trg_appointments_no_overlap BEFORE INSERT OR UPDATE OF barber_id, start_time, end_time, status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_no_overlap();

DROP TRIGGER IF EXISTS trg_commission_on_appointment ON public.appointments;
CREATE TRIGGER trg_commission_on_appointment AFTER INSERT OR UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.trg_commission_on_appointment();

DROP TRIGGER IF EXISTS trg_first_appointment ON public.appointments;
CREATE TRIGGER trg_first_appointment AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.emit_first_appointment_event();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_conversations_updated_at ON public.automation_conversations;
CREATE TRIGGER update_automation_conversations_updated_at BEFORE UPDATE ON public.automation_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_interactions_updated_at ON public.automation_interactions;
CREATE TRIGGER update_automation_interactions_updated_at BEFORE UPDATE ON public.automation_interactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reconciliation_settings_updated_at ON public.automation_reconciliation_settings;
CREATE TRIGGER update_reconciliation_settings_updated_at BEFORE UPDATE ON public.automation_reconciliation_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_templates_updated_at ON public.automation_templates;
CREATE TRIGGER update_automation_templates_updated_at BEFORE UPDATE ON public.automation_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_v2_dispatches_updated_at ON public.automation_v2_dispatches;
CREATE TRIGGER update_automation_v2_dispatches_updated_at BEFORE UPDATE ON public.automation_v2_dispatches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_v2_sessions_updated_at ON public.automation_v2_sessions;
CREATE TRIGGER update_automation_v2_sessions_updated_at BEFORE UPDATE ON public.automation_v2_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_bg_jobs_updated_at ON public.background_jobs;
CREATE TRIGGER trg_update_bg_jobs_updated_at BEFORE UPDATE ON public.background_jobs FOR EACH ROW EXECUTE FUNCTION public.update_bg_jobs_updated_at();

DROP TRIGGER IF EXISTS trg_update_barber_commissions_updated_at ON public.barber_commissions;
CREATE TRIGGER trg_update_barber_commissions_updated_at BEFORE UPDATE ON public.barber_commissions FOR EACH ROW EXECUTE FUNCTION public.update_barber_commissions_updated_at();

DROP TRIGGER IF EXISTS update_barbers_updated_at ON public.barbers;
CREATE TRIGGER update_barbers_updated_at BEFORE UPDATE ON public.barbers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS barbershop_modules_log_change ON public.barbershop_modules;
CREATE TRIGGER barbershop_modules_log_change AFTER INSERT OR UPDATE ON public.barbershop_modules FOR EACH ROW EXECUTE FUNCTION public.tg_log_barbershop_module_change();

DROP TRIGGER IF EXISTS barbershop_modules_updated_at ON public.barbershop_modules;
CREATE TRIGGER barbershop_modules_updated_at BEFORE UPDATE ON public.barbershop_modules FOR EACH ROW EXECUTE FUNCTION public.tg_barbershop_modules_updated_at();

DROP TRIGGER IF EXISTS update_barbershop_settings_updated_at ON public.barbershop_settings;
CREATE TRIGGER update_barbershop_settings_updated_at BEFORE UPDATE ON public.barbershop_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sync_barbershop_to_profile ON public.barbershops;
CREATE TRIGGER trg_sync_barbershop_to_profile AFTER INSERT OR UPDATE ON public.barbershops FOR EACH ROW EXECUTE FUNCTION public.sync_barbershop_to_profile();

DROP TRIGGER IF EXISTS trg_sync_modules_for_plan ON public.barbershops;
CREATE TRIGGER trg_sync_modules_for_plan AFTER INSERT OR UPDATE OF plan_id ON public.barbershops FOR EACH ROW EXECUTE FUNCTION public.sync_modules_for_plan();

DROP TRIGGER IF EXISTS tr_recalculate_cashback ON public.cashback_transactions;
CREATE TRIGGER tr_recalculate_cashback AFTER INSERT OR DELETE OR UPDATE ON public.cashback_transactions FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_cashback();

DROP TRIGGER IF EXISTS trg_block_disabled_cashback ON public.cashback_transactions;
CREATE TRIGGER trg_block_disabled_cashback BEFORE INSERT ON public.cashback_transactions FOR EACH ROW EXECUTE FUNCTION public.tg_block_disabled_cashback();

DROP TRIGGER IF EXISTS update_client_auth_updated_at ON public.client_auth;
CREATE TRIGGER update_client_auth_updated_at BEFORE UPDATE ON public.client_auth FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_commission_closings_updated_at ON public.commission_closings;
CREATE TRIGGER trg_commission_closings_updated_at BEFORE UPDATE ON public.commission_closings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_commission_entries_updated_at ON public.commission_entries;
CREATE TRIGGER trg_commission_entries_updated_at BEFORE UPDATE ON public.commission_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS tr_recalculate_credits ON public.credit_transactions;
CREATE TRIGGER tr_recalculate_credits AFTER INSERT OR DELETE OR UPDATE ON public.credit_transactions FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_credits();

DROP TRIGGER IF EXISTS tr_sync_customer_credits ON public.customer_credits;
CREATE TRIGGER tr_sync_customer_credits AFTER INSERT OR UPDATE ON public.customer_credits FOR EACH ROW EXECUTE FUNCTION public.sync_customer_credits();

DROP TRIGGER IF EXISTS update_customer_interactions_updated_at ON public.customer_interactions;
CREATE TRIGGER update_customer_interactions_updated_at BEFORE UPDATE ON public.customer_interactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_confirm_referral_on_activation ON public.customer_subscriptions;
CREATE TRIGGER trg_confirm_referral_on_activation AFTER UPDATE OF status ON public.customer_subscriptions FOR EACH ROW EXECUTE FUNCTION public.confirm_referral_on_activation();

DROP TRIGGER IF EXISTS trg_cust_subs_updated_at ON public.customer_subscriptions;
CREATE TRIGGER trg_cust_subs_updated_at BEFORE UPDATE ON public.customer_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_customer_subscription_automation ON public.customer_subscriptions;
CREATE TRIGGER trg_customer_subscription_automation AFTER INSERT OR UPDATE OF status ON public.customer_subscriptions FOR EACH ROW EXECUTE FUNCTION public.trigger_subscription_automation();

DROP TRIGGER IF EXISTS trg_set_subscription_card_token ON public.customer_subscriptions;
CREATE TRIGGER trg_set_subscription_card_token BEFORE INSERT ON public.customer_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_subscription_card_token();

DROP TRIGGER IF EXISTS trg_set_subscription_referral_code ON public.customer_subscriptions;
CREATE TRIGGER trg_set_subscription_referral_code BEFORE INSERT ON public.customer_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_subscription_referral_code();

DROP TRIGGER IF EXISTS update_customer_tasks_updated_at ON public.customer_tasks;
CREATE TRIGGER update_customer_tasks_updated_at BEFORE UPDATE ON public.customer_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_lgpd_requests_updated ON public.lgpd_requests;
CREATE TRIGGER trg_lgpd_requests_updated BEFORE UPDATE ON public.lgpd_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_loy_part_upd ON public.loyalty_campaign_participations;
CREATE TRIGGER trg_loy_part_upd BEFORE UPDATE ON public.loyalty_campaign_participations FOR EACH ROW EXECUTE FUNCTION public.tg_loyalty_premium_updated_at();

DROP TRIGGER IF EXISTS trg_loy_camp_tpl_upd ON public.loyalty_campaign_templates;
CREATE TRIGGER trg_loy_camp_tpl_upd BEFORE UPDATE ON public.loyalty_campaign_templates FOR EACH ROW EXECUTE FUNCTION public.tg_loyalty_premium_updated_at();

DROP TRIGGER IF EXISTS trg_loy_camp_upd ON public.loyalty_campaigns;
CREATE TRIGGER trg_loy_camp_upd BEFORE UPDATE ON public.loyalty_campaigns FOR EACH ROW EXECUTE FUNCTION public.tg_loyalty_premium_updated_at();

DROP TRIGGER IF EXISTS trg_loyalty_rewards_updated_at ON public.loyalty_rewards;
CREATE TRIGGER trg_loyalty_rewards_updated_at BEFORE UPDATE ON public.loyalty_rewards FOR EACH ROW EXECUTE FUNCTION public.tg_loyalty_touch_updated_at();

DROP TRIGGER IF EXISTS trg_loyalty_settings_updated_at ON public.loyalty_settings;
CREATE TRIGGER trg_loyalty_settings_updated_at BEFORE UPDATE ON public.loyalty_settings FOR EACH ROW EXECUTE FUNCTION public.tg_loyalty_touch_updated_at();

DROP TRIGGER IF EXISTS update_notification_recipients_updated_at ON public.notification_recipients;
CREATE TRIGGER update_notification_recipients_updated_at BEFORE UPDATE ON public.notification_recipients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS tr_sync_notification_read ON public.notifications;
CREATE TRIGGER tr_sync_notification_read BEFORE INSERT OR UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.sync_notification_read_status();

DROP TRIGGER IF EXISTS trg_payment_gateways_updated_at ON public.payment_gateways;
CREATE TRIGGER trg_payment_gateways_updated_at BEFORE UPDATE ON public.payment_gateways FOR EACH ROW EXECUTE FUNCTION public.update_payment_gateway_updated_at();

DROP TRIGGER IF EXISTS trg_single_primary_gateway ON public.payment_gateways;
CREATE TRIGGER trg_single_primary_gateway BEFORE INSERT OR UPDATE OF is_primary ON public.payment_gateways FOR EACH ROW WHEN (new.is_primary = true) EXECUTE FUNCTION public.ensure_single_primary_gateway();

DROP TRIGGER IF EXISTS update_payment_receipts_updated_at ON public.payment_receipts;
CREATE TRIGGER update_payment_receipts_updated_at BEFORE UPDATE ON public.payment_receipts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_plans_updated_at ON public.plans;
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_admin_notify_lgpd ON public.privacy_consents;
CREATE TRIGGER trg_admin_notify_lgpd AFTER INSERT ON public.privacy_consents FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_lgpd();

DROP TRIGGER IF EXISTS tr_product_sale_status_change ON public.product_sales;
CREATE TRIGGER tr_product_sale_status_change AFTER UPDATE OF status ON public.product_sales FOR EACH ROW EXECUTE FUNCTION public.handle_product_sale_status_change();

DROP TRIGGER IF EXISTS update_product_sales_updated_at ON public.product_sales;
CREATE TRIGGER update_product_sales_updated_at BEFORE UPDATE ON public.product_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_generate_product_slug ON public.products;
CREATE TRIGGER trg_generate_product_slug BEFORE INSERT OR UPDATE OF name ON public.products FOR EACH ROW EXECUTE FUNCTION public.generate_product_slug();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS tr_protect_role_column ON public.profiles;
CREATE TRIGGER tr_protect_role_column BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_role_column();

DROP TRIGGER IF EXISTS trg_admin_notify_new_tenant ON public.profiles;
CREATE TRIGGER trg_admin_notify_new_tenant AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_new_tenant();

DROP TRIGGER IF EXISTS trg_admin_notify_plan_change ON public.profiles;
CREATE TRIGGER trg_admin_notify_plan_change AFTER UPDATE OF plan, effective_plan ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_plan_change();

DROP TRIGGER IF EXISTS trg_admin_notify_tenant_signup ON public.profiles;
CREATE TRIGGER trg_admin_notify_tenant_signup AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_tenant_signup();

DROP TRIGGER IF EXISTS trg_guard_internal_test_tenant_flag ON public.profiles;
CREATE TRIGGER trg_guard_internal_test_tenant_flag BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_internal_test_tenant_flag();

DROP TRIGGER IF EXISTS trg_sync_modules_on_profile_plan ON public.profiles;
CREATE TRIGGER trg_sync_modules_on_profile_plan AFTER UPDATE OF plan, effective_plan ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_sync_modules_on_profile_plan_change();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_reception_permissions_updated ON public.reception_permissions;
CREATE TRIGGER trg_reception_permissions_updated BEFORE UPDATE ON public.reception_permissions FOR EACH ROW EXECUTE FUNCTION public.reception_touch_updated_at();

DROP TRIGGER IF EXISTS tr_log_refund_status_change ON public.refund_requests;
CREATE TRIGGER tr_log_refund_status_change AFTER INSERT OR UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.log_refund_status_change();

DROP TRIGGER IF EXISTS trg_saas_addons_updated ON public.saas_addons;
CREATE TRIGGER trg_saas_addons_updated BEFORE UPDATE ON public.saas_addons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_redemption_updated_at ON public.saas_admin_voucher_redemptions;
CREATE TRIGGER trg_admin_redemption_updated_at BEFORE UPDATE ON public.saas_admin_voucher_redemptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_voucher_updated_at ON public.saas_admin_vouchers;
CREATE TRIGGER trg_admin_voucher_updated_at BEFORE UPDATE ON public.saas_admin_vouchers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_saas_billing_settings_updated_at ON public.saas_billing_settings;
CREATE TRIGGER trg_saas_billing_settings_updated_at BEFORE UPDATE ON public.saas_billing_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_admin_notify_saas_checkout ON public.saas_checkout_sessions;
CREATE TRIGGER trg_admin_notify_saas_checkout AFTER INSERT OR UPDATE ON public.saas_checkout_sessions FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_saas_checkout();

DROP TRIGGER IF EXISTS on_rating_submitted ON public.service_ratings;
CREATE TRIGGER on_rating_submitted AFTER INSERT OR UPDATE ON public.service_ratings FOR EACH ROW EXECUTE FUNCTION public.update_barber_rating();

DROP TRIGGER IF EXISTS trg_status_incidents_updated ON public.status_incidents;
CREATE TRIGGER trg_status_incidents_updated BEFORE UPDATE ON public.status_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_status_maintenances_updated ON public.status_maintenances;
CREATE TRIGGER trg_status_maintenances_updated BEFORE UPDATE ON public.status_maintenances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_status_services_updated ON public.status_services;
CREATE TRIGGER trg_status_services_updated BEFORE UPDATE ON public.status_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_subprocessors_updated ON public.subprocessors;
CREATE TRIGGER trg_subprocessors_updated BEFORE UPDATE ON public.subprocessors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sub_inv_updated_at ON public.subscription_invoices;
CREATE TRIGGER trg_sub_inv_updated_at BEFORE UPDATE ON public.subscription_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sub_loyalty_history_updated_at ON public.subscription_loyalty_history;
CREATE TRIGGER trg_sub_loyalty_history_updated_at BEFORE UPDATE ON public.subscription_loyalty_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sub_loyalty_rewards_updated_at ON public.subscription_loyalty_rewards;
CREATE TRIGGER trg_sub_loyalty_rewards_updated_at BEFORE UPDATE ON public.subscription_loyalty_rewards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sub_payments_updated_at ON public.subscription_payments;
CREATE TRIGGER trg_sub_payments_updated_at BEFORE UPDATE ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_spbs_updated_at ON public.subscription_plan_benefit_services;
CREATE TRIGGER trg_spbs_updated_at BEFORE UPDATE ON public.subscription_plan_benefit_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_spb_updated_at ON public.subscription_plan_benefits;
CREATE TRIGGER trg_spb_updated_at BEFORE UPDATE ON public.subscription_plan_benefits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER trg_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_subscription_referrals_updated_at ON public.subscription_referrals;
CREATE TRIGGER trg_subscription_referrals_updated_at BEFORE UPDATE ON public.subscription_referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_validate_usage_log_status ON public.subscription_usage_logs;
CREATE TRIGGER trg_validate_usage_log_status BEFORE INSERT OR UPDATE ON public.subscription_usage_logs FOR EACH ROW EXECUTE FUNCTION public.validate_usage_log_status();

DROP TRIGGER IF EXISTS trg_admin_notify_support_reply ON public.support_messages;
CREATE TRIGGER trg_admin_notify_support_reply AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_support_reply();

DROP TRIGGER IF EXISTS on_ticket_created ON public.support_tickets;
CREATE TRIGGER on_ticket_created AFTER INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.handle_new_ticket_notification();

DROP TRIGGER IF EXISTS trg_admin_notify_support_ticket ON public.support_tickets;
CREATE TRIGGER trg_admin_notify_support_ticket AFTER INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_support_ticket();

DROP TRIGGER IF EXISTS trg_notify_admin_support_ticket ON public.support_tickets;
CREATE TRIGGER trg_notify_admin_support_ticket AFTER INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_support_ticket();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_addons_updated ON public.tenant_addons;
CREATE TRIGGER trg_tenant_addons_updated BEFORE UPDATE ON public.tenant_addons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_tenant_integrations_updated_at ON public.tenant_integrations;
CREATE TRIGGER update_tenant_integrations_updated_at BEFORE UPDATE ON public.tenant_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tenant_webhooks_updated_at ON public.tenant_webhooks;
CREATE TRIGGER trg_tenant_webhooks_updated_at BEFORE UPDATE ON public.tenant_webhooks FOR EACH ROW EXECUTE FUNCTION public.update_tenant_webhooks_updated_at();

DROP TRIGGER IF EXISTS trg_notify_admin_revenue_milestone ON public.transactions;
CREATE TRIGGER trg_notify_admin_revenue_milestone AFTER INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_revenue_milestone();

DROP TRIGGER IF EXISTS trg_waiting_list_updated ON public.waiting_list;
CREATE TRIGGER trg_waiting_list_updated BEFORE UPDATE ON public.waiting_list FOR EACH ROW EXECUTE FUNCTION public.reception_touch_updated_at();

DROP TRIGGER IF EXISTS update_wallet_updated_at ON public.wallet;
CREATE TRIGGER update_wallet_updated_at BEFORE UPDATE ON public.wallet FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_wallet_transaction ON public.wallet_transactions;
CREATE TRIGGER on_wallet_transaction AFTER INSERT ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.handle_wallet_transaction();

DROP TRIGGER IF EXISTS update_whatsapp_connections_updated_at ON public.whatsapp_cloud_connections;
CREATE TRIGGER update_whatsapp_connections_updated_at BEFORE UPDATE ON public.whatsapp_cloud_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_conversations_updated_at ON public.whatsapp_conversations;
CREATE TRIGGER update_whatsapp_conversations_updated_at BEFORE UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_delivery_logs_updated_at_trigger ON public.whatsapp_delivery_logs;
CREATE TRIGGER update_whatsapp_delivery_logs_updated_at_trigger BEFORE UPDATE ON public.whatsapp_delivery_logs FOR EACH ROW EXECUTE FUNCTION public.update_whatsapp_delivery_logs_updated_at();

DROP TRIGGER IF EXISTS update_whatsapp_connections_updated_at ON public.whatsapp_instances;
CREATE TRIGGER update_whatsapp_connections_updated_at BEFORE UPDATE ON public.whatsapp_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_templates_updated_at ON public.whatsapp_templates;
CREATE TRIGGER update_whatsapp_templates_updated_at BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 08. ROW LEVEL SECURITY (159/159 TABLES)
-- ==============================================================================
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_upgrade_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_cron_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_interaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_reconciliation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_send_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_v2_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_v2_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_v2_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_conflict_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershop_module_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershop_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_adjustment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_campaign_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observability_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_insights_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateway_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reception_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resend_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_admin_voucher_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_admin_voucher_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_admin_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_maintenances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subprocessors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_card_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_loyalty_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_benefit_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tour_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_cloud_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_webhook_debug ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_webhook_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 09. ROW LEVEL SECURITY POLICIES (EXACTLY 394 PHYSICAL SOURCE POLICIES)
-- ==============================================================================
DROP POLICY IF EXISTS "Lessons viewable by authenticated if path is viewable" ON public.academy_lessons;
CREATE POLICY "Lessons viewable by authenticated if path is viewable" ON public.academy_lessons
  FOR SELECT
  TO authenticated
  USING (EXISTS ( SELECT 1
   FROM (academy_modules m
     JOIN academy_paths p ON ((p.id = m.path_id)))
  WHERE ((m.id = academy_lessons.module_id) AND ((p.status = 'published'::text) OR (p.tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role)))));

DROP POLICY IF EXISTS "Modules viewable by authenticated if path is viewable" ON public.academy_modules;
CREATE POLICY "Modules viewable by authenticated if path is viewable" ON public.academy_modules
  FOR SELECT
  TO authenticated
  USING (EXISTS ( SELECT 1
   FROM academy_paths p
  WHERE ((p.id = academy_modules.path_id) AND ((p.status = 'published'::text) OR (p.tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role)))));

DROP POLICY IF EXISTS "Public paths are viewable by all authenticated" ON public.academy_paths;
CREATE POLICY "Public paths are viewable by all authenticated" ON public.academy_paths
  FOR SELECT
  TO authenticated
  USING ((status = 'published'::text) OR (tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can manage their own progress" ON public.academy_progress;
CREATE POLICY "Users can manage their own progress" ON public.academy_progress
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "super admin manages recommendations" ON public.addon_upgrade_recommendations;
CREATE POLICY "super admin manages recommendations" ON public.addon_upgrade_recommendations
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "tenant inserts own recommendations" ON public.addon_upgrade_recommendations;
CREATE POLICY "tenant inserts own recommendations" ON public.addon_upgrade_recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "tenant reads own recommendations" ON public.addon_upgrade_recommendations;
CREATE POLICY "tenant reads own recommendations" ON public.addon_upgrade_recommendations
  FOR SELECT
  TO authenticated
  USING ((tenant_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "tenant updates own recommendations" ON public.addon_upgrade_recommendations;
CREATE POLICY "tenant updates own recommendations" ON public.addon_upgrade_recommendations
  FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Super admin can read event log" ON public.admin_event_log;
CREATE POLICY "Super admin can read event log" ON public.admin_event_log
  FOR SELECT
  TO authenticated
  USING (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'super_admin'::text);

DROP POLICY IF EXISTS "Super admin manages own event subscriptions" ON public.admin_event_subscriptions;
CREATE POLICY "Super admin manages own event subscriptions" ON public.admin_event_subscriptions
  FOR ALL
  TO authenticated
  USING ((user_id = auth.uid()) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'super_admin'::text))
  WITH CHECK ((user_id = auth.uid()) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'super_admin'::text));

DROP POLICY IF EXISTS "service role full access templates" ON public.admin_event_templates;
CREATE POLICY "service role full access templates" ON public.admin_event_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "super admins manage event templates" ON public.admin_event_templates;
CREATE POLICY "super admins manage event templates" ON public.admin_event_templates
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can create admin notifications" ON public.admin_notifications;
CREATE POLICY "Authenticated users can create admin notifications" ON public.admin_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Notificações visíveis apenas para super admin" ON public.admin_notifications;
CREATE POLICY "Notificações visíveis apenas para super admin" ON public.admin_notifications
  FOR SELECT
  TO public
  USING (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'super_admin'::text);

DROP POLICY IF EXISTS "Super admin pode atualizar notificações (marcar como lido)" ON public.admin_notifications;
CREATE POLICY "Super admin pode atualizar notificações (marcar como lido)" ON public.admin_notifications
  FOR UPDATE
  TO public
  USING (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'super_admin'::text);

DROP POLICY IF EXISTS "Super admin pode excluir notificações" ON public.admin_notifications;
CREATE POLICY "Super admin pode excluir notificações" ON public.admin_notifications
  FOR DELETE
  TO public
  USING (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'super_admin'::text);

DROP POLICY IF EXISTS "Tenants can manage their own ai settings" ON public.ai_settings;
CREATE POLICY "Tenants can manage their own ai settings" ON public.ai_settings
  FOR ALL
  TO public
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "tenant_insert_checkins" ON public.appointment_checkins;
CREATE POLICY "tenant_insert_checkins" ON public.appointment_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "tenant_read_checkins" ON public.appointment_checkins;
CREATE POLICY "tenant_read_checkins" ON public.appointment_checkins
  FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Public can create appointment groups" ON public.appointment_groups;
CREATE POLICY "Public can create appointment groups" ON public.appointment_groups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (tenant_id IS NOT NULL);

DROP POLICY IF EXISTS "Tenant can manage their appointment groups" ON public.appointment_groups;
CREATE POLICY "Tenant can manage their appointment groups" ON public.appointment_groups
  FOR ALL
  TO public
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenant can view own appointment groups" ON public.appointment_groups;
CREATE POLICY "Tenant can view own appointment groups" ON public.appointment_groups
  FOR SELECT
  TO authenticated
  USING (tenant_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Public can read approved testimonials" ON public.appointment_reviews;
CREATE POLICY "Public can read approved testimonials" ON public.appointment_reviews
  FOR SELECT
  TO anon, authenticated
  USING ((testimonial_status = 'approved'::text) AND (show_on_frontend = true));

DROP POLICY IF EXISTS "Public can submit reviews for real appointments" ON public.appointment_reviews;
CREATE POLICY "Public can submit reviews for real appointments" ON public.appointment_reviews
  FOR INSERT
  TO anon, authenticated
  WITH CHECK ((appointment_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = appointment_reviews.appointment_id) AND (a.tenant_id = appointment_reviews.tenant_id)))) AND ((barbershop_rating IS NULL) OR ((barbershop_rating >= 1) AND (barbershop_rating <= 5))) AND ((barber_rating IS NULL) OR ((barber_rating >= 1) AND (barber_rating <= 5))) AND ((service_rating IS NULL) OR ((service_rating >= 1) AND (service_rating <= 5))) AND (COALESCE(show_on_frontend, false) = false) AND (approved_at IS NULL) AND (approved_by IS NULL) AND (reply IS NULL));

DROP POLICY IF EXISTS "Tenant owner can delete reviews" ON public.appointment_reviews;
CREATE POLICY "Tenant owner can delete reviews" ON public.appointment_reviews
  FOR DELETE
  TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Tenant owner can read all reviews" ON public.appointment_reviews;
CREATE POLICY "Tenant owner can read all reviews" ON public.appointment_reviews
  FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Tenant owner can update reviews" ON public.appointment_reviews;
CREATE POLICY "Tenant owner can update reviews" ON public.appointment_reviews
  FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.appointment_status_logs;
CREATE POLICY "Authenticated users can insert logs" ON public.appointment_status_logs
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "Users can view logs of their own appointments" ON public.appointment_status_logs;
CREATE POLICY "Users can view logs of their own appointments" ON public.appointment_status_logs
  FOR SELECT
  TO public
  USING (EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = appointment_status_logs.appointment_id) AND ((a.tenant_id = auth.uid()) OR (a.customer_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can view their tenant's status logs" ON public.appointment_status_logs;
CREATE POLICY "Users can view their tenant's status logs" ON public.appointment_status_logs
  FOR SELECT
  TO public
  USING (appointment_id IN ( SELECT appointments.id
   FROM appointments
  WHERE ((appointments.tenant_id = auth.uid()) OR (appointments.tenant_id IN ( SELECT profiles.tenant_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

DROP POLICY IF EXISTS "Barbers can view their own appointments" ON public.appointments;
CREATE POLICY "Barbers can view their own appointments" ON public.appointments
  FOR SELECT
  TO authenticated
  USING (EXISTS ( SELECT 1
   FROM barbers
  WHERE ((barbers.id = appointments.barber_id) AND (barbers.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Customers can view own appointments" ON public.appointments;
CREATE POLICY "Customers can view own appointments" ON public.appointments
  FOR SELECT
  TO authenticated
  USING (customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = ( SELECT auth.uid() AS uid))));

DROP POLICY IF EXISTS "Public access for availability" ON public.appointments;
CREATE POLICY "Public access for availability" ON public.appointments
  FOR SELECT
  TO anon, authenticated
  USING (status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]));

DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;
CREATE POLICY "Public can create appointments" ON public.appointments
  FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;
CREATE POLICY "Staff can update appointments" ON public.appointments
  FOR UPDATE
  TO authenticated
  USING ((tenant_id = auth.uid()) OR (barber_id IN ( SELECT barbers.id
   FROM barbers
  WHERE (barbers.user_id = auth.uid()))) OR (tenant_id IN ( SELECT reception_permissions.tenant_id
   FROM reception_permissions
  WHERE ((reception_permissions.user_id = auth.uid()) AND (reception_permissions.is_active = true)))) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR (barber_id IN ( SELECT barbers.id
   FROM barbers
  WHERE (barbers.user_id = auth.uid()))) OR (tenant_id IN ( SELECT reception_permissions.tenant_id
   FROM reception_permissions
  WHERE ((reception_permissions.user_id = auth.uid()) AND (reception_permissions.is_active = true)))) OR is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can manage all appointments" ON public.appointments;
CREATE POLICY "Super admins can manage all appointments" ON public.appointments
  FOR ALL
  TO public
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "Tenant can view own appointments" ON public.appointments;
CREATE POLICY "Tenant can view own appointments" ON public.appointments
  FOR SELECT
  TO authenticated
  USING ((tenant_id = auth.uid()) OR (tenant_id IN ( SELECT profiles.tenant_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'tenant_admin'::text, 'manager'::text]))))) OR (tenant_id IN ( SELECT tenant_memberships.tenant_id
   FROM tenant_memberships
  WHERE (tenant_memberships.user_id = auth.uid()))) OR is_super_admin_user());

DROP POLICY IF EXISTS "Users can manage their own appointments" ON public.appointments;
CREATE POLICY "Users can manage their own appointments" ON public.appointments
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
CREATE POLICY "Users can view their own appointments" ON public.appointments
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id) OR (customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text)))));

DROP POLICY IF EXISTS "Audit logs insertable by super_admin" ON public.audit_logs;
CREATE POLICY "Audit logs insertable by super_admin" ON public.audit_logs
  FOR INSERT
  TO public
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "Audit logs viewable by super_admin" ON public.audit_logs;
CREATE POLICY "Audit logs viewable by super_admin" ON public.audit_logs
  FOR SELECT
  TO public
  USING (is_super_admin_user());

DROP POLICY IF EXISTS "Tenants can view their own conversations" ON public.automation_conversations;
CREATE POLICY "Tenants can view their own conversations" ON public.automation_conversations
  FOR SELECT
  TO public
  USING (tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Super admins can view all cron runs" ON public.automation_cron_runs;
CREATE POLICY "Super admins can view all cron runs" ON public.automation_cron_runs
  FOR SELECT
  TO public
  USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text))));

DROP POLICY IF EXISTS "Tenants can view their own cron runs" ON public.automation_cron_runs;
CREATE POLICY "Tenants can view their own cron runs" ON public.automation_cron_runs
  FOR SELECT
  TO public
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Users can view their own cron logs" ON public.automation_cron_runs;
CREATE POLICY "Users can view their own cron logs" ON public.automation_cron_runs
  FOR SELECT
  TO public
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants can view their own dispatches" ON public.automation_dispatches;
CREATE POLICY "Tenants can view their own dispatches" ON public.automation_dispatches
  FOR SELECT
  TO public
  USING (tenant_id IN ( SELECT barbershops.id
   FROM barbershops
  WHERE (barbershops.owner_id = auth.uid())));

DROP POLICY IF EXISTS "Admins manage all interaction events" ON public.automation_interaction_events;
CREATE POLICY "Admins manage all interaction events" ON public.automation_interaction_events
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Tenants insert their own interaction events" ON public.automation_interaction_events;
CREATE POLICY "Tenants insert their own interaction events" ON public.automation_interaction_events
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants view their own interaction events" ON public.automation_interaction_events;
CREATE POLICY "Tenants view their own interaction events" ON public.automation_interaction_events
  FOR SELECT
  TO public
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Admins can manage all automation interactions" ON public.automation_interactions;
CREATE POLICY "Admins can manage all automation interactions" ON public.automation_interactions
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Tenants manage their own automation interactions" ON public.automation_interactions;
CREATE POLICY "Tenants manage their own automation interactions" ON public.automation_interactions
  FOR ALL
  TO public
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Service role manages automation logs" ON public.automation_logs;
CREATE POLICY "Service role manages automation logs" ON public.automation_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Tenants can view their own automation logs" ON public.automation_logs;
CREATE POLICY "Tenants can view their own automation logs" ON public.automation_logs
  FOR SELECT
  TO public
  USING (tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Users can manage their own automation_queue" ON public.automation_queue;
CREATE POLICY "Users can manage their own automation_queue" ON public.automation_queue
  FOR ALL
  TO public
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Users can manage their own settings" ON public.automation_reconciliation_settings;
CREATE POLICY "Users can manage their own settings" ON public.automation_reconciliation_settings
  FOR ALL
  TO public
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants can insert their own send history" ON public.automation_send_history;
CREATE POLICY "Tenants can insert their own send history" ON public.automation_send_history
  FOR INSERT
  TO public
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Tenants can view their own send history" ON public.automation_send_history;
CREATE POLICY "Tenants can view their own send history" ON public.automation_send_history
  FOR SELECT
  TO public
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Allow all for service_role" ON public.automation_status;
CREATE POLICY "Allow all for service_role" ON public.automation_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read for authenticated" ON public.automation_status;
CREATE POLICY "Allow read for authenticated" ON public.automation_status
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role manages automation status" ON public.automation_status;
CREATE POLICY "Service role manages automation status" ON public.automation_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own automation_templates" ON public.automation_templates;
CREATE POLICY "Users can manage their own automation_templates" ON public.automation_templates
  FOR ALL
  TO public
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants can manage their own v2 dispatches" ON public.automation_v2_dispatches;
CREATE POLICY "Tenants can manage their own v2 dispatches" ON public.automation_v2_dispatches
  FOR ALL
  TO public
  USING (tenant_id IN ( SELECT barbershops.id
   FROM barbershops
  WHERE (barbershops.owner_id = auth.uid())));

DROP POLICY IF EXISTS "Tenants can view their own v2 logs" ON public.automation_v2_logs;
CREATE POLICY "Tenants can view their own v2 logs" ON public.automation_v2_logs
  FOR SELECT
  TO authenticated
  USING (tenant_id IN ( SELECT barbershops.id
   FROM barbershops
  WHERE (barbershops.owner_id = auth.uid())));

DROP POLICY IF EXISTS "Tenants can manage their own v2 sessions" ON public.automation_v2_sessions;
CREATE POLICY "Tenants can manage their own v2 sessions" ON public.automation_v2_sessions
  FOR ALL
  TO authenticated
  USING (tenant_id IN ( SELECT barbershops.id
   FROM barbershops
  WHERE (barbershops.owner_id = auth.uid())));

DROP POLICY IF EXISTS "Service role manages automation webhook logs" ON public.automation_webhook_logs;
CREATE POLICY "Service role manages automation webhook logs" ON public.automation_webhook_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Tenants can view their automation webhook logs" ON public.automation_webhook_logs;
CREATE POLICY "Tenants can view their automation webhook logs" ON public.automation_webhook_logs
  FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Barbers can manage their own automations" ON public.automations;
CREATE POLICY "Barbers can manage their own automations" ON public.automations
  FOR ALL
  TO public
  USING (auth.uid() = barber_id);

DROP POLICY IF EXISTS "Tenants can manage their own automations" ON public.automations;
CREATE POLICY "Tenants can manage their own automations" ON public.automations
  FOR ALL
  TO public
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Users can view their own tenant data" ON public.automations;
CREATE POLICY "Users can view their own tenant data" ON public.automations
  FOR ALL
  TO public
  USING (tenant_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Tenant reads own availability conflict logs" ON public.availability_conflict_logs;
CREATE POLICY "Tenant reads own availability conflict logs" ON public.availability_conflict_logs
  FOR SELECT
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "Public can read commissions through scoped RPC only" ON public.barber_commissions;
CREATE POLICY "Public can read commissions through scoped RPC only" ON public.barber_commissions
  FOR SELECT
  TO anon
  USING (false);

DROP POLICY IF EXISTS "require_module_commissions_delete" ON public.barber_commissions;
CREATE POLICY "require_module_commissions_delete" ON public.barber_commissions
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'commissions'::text));

DROP POLICY IF EXISTS "require_module_commissions_insert" ON public.barber_commissions;
CREATE POLICY "require_module_commissions_insert" ON public.barber_commissions
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'commissions'::text));

DROP POLICY IF EXISTS "require_module_commissions_update" ON public.barber_commissions;
CREATE POLICY "require_module_commissions_update" ON public.barber_commissions
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'commissions'::text))
  WITH CHECK (has_module_access(auth.uid(), 'commissions'::text));

DROP POLICY IF EXISTS "Tenant admins can manage barber commissions" ON public.barber_commissions;
CREATE POLICY "Tenant admins can manage barber commissions" ON public.barber_commissions
  FOR ALL
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_manage_barber_services" ON public.barber_services;
CREATE POLICY "authenticated_manage_barber_services" ON public.barber_services
  FOR ALL
  TO authenticated
  USING ((auth.uid() = user_id) OR (auth.uid() = tenant_id))
  WITH CHECK ((auth.uid() = user_id) OR (auth.uid() = tenant_id));

DROP POLICY IF EXISTS "public_view_barber_services" ON public.barber_services;
CREATE POLICY "public_view_barber_services" ON public.barber_services
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Vínculos de serviços são públicos" ON public.barber_services;
CREATE POLICY "Vínculos de serviços são públicos" ON public.barber_services
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Barber sees own tips" ON public.barber_tips;
CREATE POLICY "Barber sees own tips" ON public.barber_tips
  FOR SELECT
  TO authenticated
  USING (EXISTS ( SELECT 1
   FROM barbers b
  WHERE ((b.id = barber_tips.barber_id) AND (b.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Shop owner sees own tips" ON public.barber_tips;
CREATE POLICY "Shop owner sees own tips" ON public.barber_tips
  FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Shop owner updates tips" ON public.barber_tips;
CREATE POLICY "Shop owner updates tips" ON public.barber_tips
  FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Barbers can manage their own profile" ON public.barbers;
CREATE POLICY "Barbers can manage their own profile" ON public.barbers
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public select for active barbers" ON public.barbers;
CREATE POLICY "Public select for active barbers" ON public.barbers
  FOR SELECT
  TO public
  USING ((active = true) OR (tenant_id = auth.uid()) OR (tenant_id IN ( SELECT tenant_memberships.tenant_id
   FROM tenant_memberships
  WHERE (tenant_memberships.user_id = auth.uid()))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can manage all barbers" ON public.barbers;
CREATE POLICY "Super admins can manage all barbers" ON public.barbers
  FOR ALL
  TO public
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "Tenants read their own module logs" ON public.barbershop_module_logs;
CREATE POLICY "Tenants read their own module logs" ON public.barbershop_module_logs
  FOR SELECT
  TO authenticated
  USING ((tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users write module logs for own tenant" ON public.barbershop_module_logs;
CREATE POLICY "Users write module logs for own tenant" ON public.barbershop_module_logs
  FOR INSERT
  TO authenticated
  WITH CHECK ((tenant_id = get_my_tenant_id()) OR is_super_admin_user());

DROP POLICY IF EXISTS "Public can read tenant modules" ON public.barbershop_modules;
CREATE POLICY "Public can read tenant modules" ON public.barbershop_modules
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Tenant staff can read their tenant modules" ON public.barbershop_modules;
CREATE POLICY "Tenant staff can read their tenant modules" ON public.barbershop_modules
  FOR SELECT
  TO authenticated
  USING (tenant_id IN ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Tenants manage their own modules" ON public.barbershop_modules;
CREATE POLICY "Tenants manage their own modules" ON public.barbershop_modules
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK ((tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can manage their own barbershop settings" ON public.barbershop_settings;
CREATE POLICY "Users can manage their own barbershop settings" ON public.barbershop_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = barber_id);

DROP POLICY IF EXISTS "Owners can update their own barbershop" ON public.barbershops;
CREATE POLICY "Owners can update their own barbershop" ON public.barbershops
  FOR UPDATE
  TO public
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Public read access for barbershops" ON public.barbershops;
CREATE POLICY "Public read access for barbershops" ON public.barbershops
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Tenants can view their own campaign logs" ON public.campaign_logs;
CREATE POLICY "Tenants can view their own campaign logs" ON public.campaign_logs
  FOR SELECT
  TO public
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants can manage their own campaigns" ON public.campaigns;
CREATE POLICY "Tenants can manage their own campaigns" ON public.campaigns
  FOR ALL
  TO public
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Customers can view own cashback transactions" ON public.cashback_transactions;
CREATE POLICY "Customers can view own cashback transactions" ON public.cashback_transactions
  FOR SELECT
  TO authenticated
  USING (customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = ( SELECT auth.uid() AS uid))));

DROP POLICY IF EXISTS "require_module_cashback_delete" ON public.cashback_transactions;
CREATE POLICY "require_module_cashback_delete" ON public.cashback_transactions
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'cashback'::text));

DROP POLICY IF EXISTS "require_module_cashback_insert" ON public.cashback_transactions;
CREATE POLICY "require_module_cashback_insert" ON public.cashback_transactions
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'cashback'::text));

DROP POLICY IF EXISTS "require_module_cashback_update" ON public.cashback_transactions;
CREATE POLICY "require_module_cashback_update" ON public.cashback_transactions
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'cashback'::text))
  WITH CHECK (has_module_access(auth.uid(), 'cashback'::text));

DROP POLICY IF EXISTS "Service role can do everything on cashback_transactions" ON public.cashback_transactions;
CREATE POLICY "Service role can do everything on cashback_transactions" ON public.cashback_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can insert cashback transactions for their tenant" ON public.cashback_transactions;
CREATE POLICY "Users can insert cashback transactions for their tenant" ON public.cashback_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK ((tenant_id = auth.uid()) OR (tenant_id IN ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

DROP POLICY IF EXISTS "Users can view their tenant's cashback transactions" ON public.cashback_transactions;
CREATE POLICY "Users can view their tenant's cashback transactions" ON public.cashback_transactions
  FOR SELECT
  TO authenticated
  USING ((tenant_id = auth.uid()) OR (tenant_id IN ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

DROP POLICY IF EXISTS "Service role manages client auth updates" ON public.client_auth;
CREATE POLICY "Service role manages client auth updates" ON public.client_auth
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role reads client auth" ON public.client_auth;
CREATE POLICY "Service role reads client auth" ON public.client_auth
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "require_module_commissions_delete" ON public.commission_closings;
CREATE POLICY "require_module_commissions_delete" ON public.commission_closings
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'commissions'::text));

DROP POLICY IF EXISTS "require_module_commissions_insert" ON public.commission_closings;
CREATE POLICY "require_module_commissions_insert" ON public.commission_closings
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'commissions'::text));

DROP POLICY IF EXISTS "require_module_commissions_update" ON public.commission_closings;
CREATE POLICY "require_module_commissions_update" ON public.commission_closings
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'commissions'::text))
  WITH CHECK (has_module_access(auth.uid(), 'commissions'::text));

DROP POLICY IF EXISTS "tenant manages commission closings" ON public.commission_closings;
CREATE POLICY "tenant manages commission closings" ON public.commission_closings
  FOR ALL
  TO public
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "require_module_commissions_delete" ON public.commission_entries;
CREATE POLICY "require_module_commissions_delete" ON public.commission_entries
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'commissions'::text));

DROP POLICY IF EXISTS "require_module_commissions_insert" ON public.commission_entries;
CREATE POLICY "require_module_commissions_insert" ON public.commission_entries
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'commissions'::text));

DROP POLICY IF EXISTS "require_module_commissions_update" ON public.commission_entries;
CREATE POLICY "require_module_commissions_update" ON public.commission_entries
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'commissions'::text))
  WITH CHECK (has_module_access(auth.uid(), 'commissions'::text));

DROP POLICY IF EXISTS "tenant manages commission entries" ON public.commission_entries;
CREATE POLICY "tenant manages commission entries" ON public.commission_entries
  FOR ALL
  TO public
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Users can access their own tenant communication_channels" ON public.communication_channels;
CREATE POLICY "Users can access their own tenant communication_channels" ON public.communication_channels
  FOR ALL
  TO authenticated
  USING (tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Users can access their own tenant communication_messages" ON public.communication_messages;
CREATE POLICY "Users can access their own tenant communication_messages" ON public.communication_messages
  FOR ALL
  TO authenticated
  USING (tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Users can access their own tenant communication_templates" ON public.communication_templates;
CREATE POLICY "Users can access their own tenant communication_templates" ON public.communication_templates
  FOR ALL
  TO authenticated
  USING (tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Anyone can insert cookie consent" ON public.cookie_consents;
CREATE POLICY "Anyone can insert cookie consent" ON public.cookie_consents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own cookie consents" ON public.cookie_consents;
CREATE POLICY "Users view own cookie consents" ON public.cookie_consents
  FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid()) OR (tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Tenant can view own coupons" ON public.coupons;
CREATE POLICY "Tenant can view own coupons" ON public.coupons
  FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Tenants can manage their own coupons" ON public.coupons;
CREATE POLICY "Tenants can manage their own coupons" ON public.coupons
  FOR ALL
  TO authenticated
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Customers can view own credit transactions" ON public.credit_transactions;
CREATE POLICY "Customers can view own credit transactions" ON public.credit_transactions
  FOR SELECT
  TO authenticated
  USING (customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = ( SELECT auth.uid() AS uid))));

DROP POLICY IF EXISTS "Users can view their tenant's credit transactions" ON public.credit_transactions;
CREATE POLICY "Users can view their tenant's credit transactions" ON public.credit_transactions
  FOR SELECT
  TO public
  USING ((tenant_id = auth.uid()) OR (tenant_id IN ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

DROP POLICY IF EXISTS "Customers can view own achievements" ON public.customer_achievements;
CREATE POLICY "Customers can view own achievements" ON public.customer_achievements
  FOR SELECT
  TO authenticated
  USING (customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = ( SELECT auth.uid() AS uid))));

DROP POLICY IF EXISTS "Allow INSERT for tenant" ON public.customer_credits;
CREATE POLICY "Allow INSERT for tenant" ON public.customer_credits
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Allow SELECT for tenant and owner" ON public.customer_credits;
CREATE POLICY "Allow SELECT for tenant and owner" ON public.customer_credits
  FOR SELECT
  TO public
  USING ((auth.uid() = tenant_id) OR (auth.uid() = customer_id));

DROP POLICY IF EXISTS "Allow UPDATE for tenant" ON public.customer_credits;
CREATE POLICY "Allow UPDATE for tenant" ON public.customer_credits
  FOR UPDATE
  TO public
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Manage own tenant customer documents" ON public.customer_documents;
CREATE POLICY "Manage own tenant customer documents" ON public.customer_documents
  FOR ALL
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Manage own tenant customer interactions" ON public.customer_interactions;
CREATE POLICY "Manage own tenant customer interactions" ON public.customer_interactions
  FOR ALL
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Customers can view own subscriptions" ON public.customer_subscriptions;
CREATE POLICY "Customers can view own subscriptions" ON public.customer_subscriptions
  FOR SELECT
  TO authenticated
  USING (customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = ( SELECT auth.uid() AS uid))));

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.customer_subscriptions;
CREATE POLICY "require_module_subscriptions_delete" ON public.customer_subscriptions
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.customer_subscriptions;
CREATE POLICY "require_module_subscriptions_insert" ON public.customer_subscriptions
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.customer_subscriptions;
CREATE POLICY "require_module_subscriptions_update" ON public.customer_subscriptions
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text))
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "tenant manages own subs" ON public.customer_subscriptions;
CREATE POLICY "tenant manages own subs" ON public.customer_subscriptions
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "Manage own tenant customer tasks" ON public.customer_tasks;
CREATE POLICY "Manage own tenant customer tasks" ON public.customer_tasks
  FOR ALL
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Allow public insert on customers" ON public.customers;
CREATE POLICY "Allow public insert on customers" ON public.customers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (tenant_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow public select for identification" ON public.customers;
CREATE POLICY "Allow public select for identification" ON public.customers
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
CREATE POLICY "Customers can view own profile" ON public.customers
  FOR SELECT
  TO authenticated
  USING (auth_user_id = ( SELECT auth.uid() AS uid));

DROP POLICY IF EXISTS "Super admins can manage all customers" ON public.customers;
CREATE POLICY "Super admins can manage all customers" ON public.customers
  FOR ALL
  TO public
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "Tenant members can view customers" ON public.customers;
CREATE POLICY "Tenant members can view customers" ON public.customers
  FOR SELECT
  TO authenticated
  USING ((tenant_id = auth.uid()) OR (tenant_id IN ( SELECT tenant_memberships.tenant_id
   FROM tenant_memberships
  WHERE ((tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.status = 'active'::text)))) OR (tenant_id IN ( SELECT barbershops.id
   FROM barbershops
  WHERE (barbershops.owner_id = auth.uid()))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can manage their own customers" ON public.customers;
CREATE POLICY "Users can manage their own customers" ON public.customers
  FOR ALL
  TO authenticated
  USING ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM barbers
  WHERE ((barbers.id = customers.barber_id) AND (barbers.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;
CREATE POLICY "Users can view their own customers" ON public.customers
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text)))));

DROP POLICY IF EXISTS "Admins can view all email logs" ON public.email_logs;
CREATE POLICY "Admins can view all email logs" ON public.email_logs
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Tenants can view their own email logs" ON public.email_logs;
CREATE POLICY "Tenants can view their own email logs" ON public.email_logs
  FOR SELECT
  TO authenticated
  USING (tenant_id = ( SELECT tenant_memberships.tenant_id
   FROM tenant_memberships
  WHERE (tenant_memberships.user_id = auth.uid())
 LIMIT 1));

DROP POLICY IF EXISTS "Tenants can manage their own email settings" ON public.email_settings;
CREATE POLICY "Tenants can manage their own email settings" ON public.email_settings
  FOR ALL
  TO public
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Users can insert their own tenant logs" ON public.financial_adjustment_logs;
CREATE POLICY "Users can insert their own tenant logs" ON public.financial_adjustment_logs
  FOR INSERT
  TO public
  WITH CHECK (tenant_id IN ( SELECT barbershops.id
   FROM barbershops
  WHERE (barbershops.owner_id = auth.uid())));

DROP POLICY IF EXISTS "Users can view their own tenant logs" ON public.financial_adjustment_logs;
CREATE POLICY "Users can view their own tenant logs" ON public.financial_adjustment_logs
  FOR SELECT
  TO public
  USING (tenant_id IN ( SELECT barbershops.id
   FROM barbershops
  WHERE (barbershops.owner_id = auth.uid())));

DROP POLICY IF EXISTS "Anyone can submit lgpd request" ON public.lgpd_requests;
CREATE POLICY "Anyone can submit lgpd request" ON public.lgpd_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Customers view own requests" ON public.lgpd_requests;
CREATE POLICY "Customers view own requests" ON public.lgpd_requests
  FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid()) OR (customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))) OR (tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Tenant and admin update requests" ON public.lgpd_requests;
CREATE POLICY "Tenant and admin update requests" ON public.lgpd_requests
  FOR UPDATE
  TO authenticated
  USING ((tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK ((tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read achievements" ON public.loyalty_achievements;
CREATE POLICY "Anyone can read achievements" ON public.loyalty_achievements
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "require_module_loyalty_delete" ON public.loyalty_campaign_participations;
CREATE POLICY "require_module_loyalty_delete" ON public.loyalty_campaign_participations
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "require_module_loyalty_insert" ON public.loyalty_campaign_participations;
CREATE POLICY "require_module_loyalty_insert" ON public.loyalty_campaign_participations
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "require_module_loyalty_update" ON public.loyalty_campaign_participations;
CREATE POLICY "require_module_loyalty_update" ON public.loyalty_campaign_participations
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'loyalty'::text))
  WITH CHECK (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "Tenant owners view participations" ON public.loyalty_campaign_participations;
CREATE POLICY "Tenant owners view participations" ON public.loyalty_campaign_participations
  FOR ALL
  TO authenticated
  USING (tenant_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid())))
  WITH CHECK (tenant_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "require_module_loyalty_delete" ON public.loyalty_campaign_templates;
CREATE POLICY "require_module_loyalty_delete" ON public.loyalty_campaign_templates
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "require_module_loyalty_insert" ON public.loyalty_campaign_templates;
CREATE POLICY "require_module_loyalty_insert" ON public.loyalty_campaign_templates
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "require_module_loyalty_update" ON public.loyalty_campaign_templates;
CREATE POLICY "require_module_loyalty_update" ON public.loyalty_campaign_templates
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'loyalty'::text))
  WITH CHECK (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "Templates readable by all" ON public.loyalty_campaign_templates;
CREATE POLICY "Templates readable by all" ON public.loyalty_campaign_templates
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "require_module_loyalty_delete" ON public.loyalty_campaigns;
CREATE POLICY "require_module_loyalty_delete" ON public.loyalty_campaigns
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "require_module_loyalty_insert" ON public.loyalty_campaigns;
CREATE POLICY "require_module_loyalty_insert" ON public.loyalty_campaigns
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "require_module_loyalty_update" ON public.loyalty_campaigns;
CREATE POLICY "require_module_loyalty_update" ON public.loyalty_campaigns
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'loyalty'::text))
  WITH CHECK (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "Tenant owners manage campaigns" ON public.loyalty_campaigns;
CREATE POLICY "Tenant owners manage campaigns" ON public.loyalty_campaigns
  FOR ALL
  TO authenticated
  USING (tenant_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid())))
  WITH CHECK (tenant_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Anyone can read levels" ON public.loyalty_levels;
CREATE POLICY "Anyone can read levels" ON public.loyalty_levels
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "public can read loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "public can read loyalty rewards" ON public.loyalty_rewards
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "require_module_loyalty_delete" ON public.loyalty_rewards;
CREATE POLICY "require_module_loyalty_delete" ON public.loyalty_rewards
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "require_module_loyalty_insert" ON public.loyalty_rewards;
CREATE POLICY "require_module_loyalty_insert" ON public.loyalty_rewards
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "require_module_loyalty_update" ON public.loyalty_rewards;
CREATE POLICY "require_module_loyalty_update" ON public.loyalty_rewards
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'loyalty'::text))
  WITH CHECK (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "tenant manages own loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "tenant manages own loyalty rewards" ON public.loyalty_rewards
  FOR ALL
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "public can read loyalty settings" ON public.loyalty_settings;
CREATE POLICY "public can read loyalty settings" ON public.loyalty_settings
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "require_module_loyalty_delete" ON public.loyalty_settings;
CREATE POLICY "require_module_loyalty_delete" ON public.loyalty_settings
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "require_module_loyalty_insert" ON public.loyalty_settings;
CREATE POLICY "require_module_loyalty_insert" ON public.loyalty_settings
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "require_module_loyalty_update" ON public.loyalty_settings;
CREATE POLICY "require_module_loyalty_update" ON public.loyalty_settings
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'loyalty'::text))
  WITH CHECK (has_module_access(auth.uid(), 'loyalty'::text));

DROP POLICY IF EXISTS "tenant manages own loyalty settings" ON public.loyalty_settings;
CREATE POLICY "tenant manages own loyalty settings" ON public.loyalty_settings
  FOR ALL
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Tenants can manage their own audiences" ON public.marketing_audiences;
CREATE POLICY "Tenants can manage their own audiences" ON public.marketing_audiences
  FOR ALL
  TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Tenant can manage own recipients" ON public.notification_recipients;
CREATE POLICY "Tenant can manage own recipients" ON public.notification_recipients
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK ((tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Barbeiros podem ver suas próprias notificações" ON public.notifications;
CREATE POLICY "Barbeiros podem ver suas próprias notificações" ON public.notifications
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM barbers
  WHERE ((barbers.id = notifications.barber_id) AND (barbers.user_id = auth.uid())))) OR (user_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "Barber panel can read its notifications" ON public.notifications;
CREATE POLICY "Barber panel can read its notifications" ON public.notifications
  FOR SELECT
  TO anon, authenticated
  USING (barber_id IS NOT NULL);

DROP POLICY IF EXISTS "Barber panel can update its notifications" ON public.notifications;
CREATE POLICY "Barber panel can update its notifications" ON public.notifications
  FOR UPDATE
  TO anon, authenticated
  USING (barber_id IS NOT NULL)
  WITH CHECK (barber_id IS NOT NULL);

DROP POLICY IF EXISTS "Super admins can manage all notifications" ON public.notifications;
CREATE POLICY "Super admins can manage all notifications" ON public.notifications
  FOR ALL
  TO public
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;
CREATE POLICY "Users can manage their own notifications" ON public.notifications
  FOR ALL
  TO public
  USING ((EXISTS ( SELECT 1
   FROM barbers
  WHERE ((barbers.id = notifications.barber_id) AND (barbers.user_id = auth.uid())))) OR (user_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "Users can view their own tenant data" ON public.notifications;
CREATE POLICY "Users can view their own tenant data" ON public.notifications
  FOR ALL
  TO public
  USING (tenant_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Everyone can view onboarding settings" ON public.onboarding_settings;
CREATE POLICY "Everyone can view onboarding settings" ON public.onboarding_settings
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Only super admins can manage onboarding settings" ON public.onboarding_settings;
CREATE POLICY "Only super admins can manage onboarding settings" ON public.onboarding_settings
  FOR ALL
  TO public
  USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text))));

DROP POLICY IF EXISTS "Tenant access" ON public.operational_insights_interactions;
CREATE POLICY "Tenant access" ON public.operational_insights_interactions
  FOR ALL
  TO authenticated
  USING (tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "tenant inserts own payment_gateway_logs" ON public.payment_gateway_logs;
CREATE POLICY "tenant inserts own payment_gateway_logs" ON public.payment_gateway_logs
  FOR INSERT
  TO public
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "tenant views own payment_gateway_logs" ON public.payment_gateway_logs;
CREATE POLICY "tenant views own payment_gateway_logs" ON public.payment_gateway_logs
  FOR SELECT
  TO public
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "tenant manages own payment_gateways" ON public.payment_gateways;
CREATE POLICY "tenant manages own payment_gateways" ON public.payment_gateways
  FOR ALL
  TO public
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Public customers can submit receipts" ON public.payment_receipts;
CREATE POLICY "Public customers can submit receipts" ON public.payment_receipts
  FOR INSERT
  TO anon
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (p.id = p.tenant_id))) AND (appointment_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = payment_receipts.appointment_id) AND (a.tenant_id = payment_receipts.tenant_id)))));

DROP POLICY IF EXISTS "Tenant can delete own receipts" ON public.payment_receipts;
CREATE POLICY "Tenant can delete own receipts" ON public.payment_receipts
  FOR DELETE
  TO authenticated
  USING (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "Tenant can insert own receipts" ON public.payment_receipts;
CREATE POLICY "Tenant can insert own receipts" ON public.payment_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "Tenant can update own receipts" ON public.payment_receipts;
CREATE POLICY "Tenant can update own receipts" ON public.payment_receipts
  FOR UPDATE
  TO authenticated
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "Tenant can view own receipts" ON public.payment_receipts;
CREATE POLICY "Tenant can view own receipts" ON public.payment_receipts
  FOR SELECT
  TO authenticated
  USING ((tenant_id = get_my_tenant_id()) OR is_super_admin());

DROP POLICY IF EXISTS "Allow read for authenticated permissions" ON public.permissions;
CREATE POLICY "Allow read for authenticated permissions" ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Plans are viewable by everyone" ON public.plans;
CREATE POLICY "Plans are viewable by everyone" ON public.plans
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Plans manageable by super_admin" ON public.plans;
CREATE POLICY "Plans manageable by super_admin" ON public.plans
  FOR ALL
  TO public
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "Anyone can insert consent" ON public.privacy_consents;
CREATE POLICY "Anyone can insert consent" ON public.privacy_consents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own/tenant consents" ON public.privacy_consents;
CREATE POLICY "Users view own/tenant consents" ON public.privacy_consents
  FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid()) OR (customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))) OR (tenant_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

DROP POLICY IF EXISTS "Qualquer pessoa pode ver imagens de produtos" ON public.product_images;
CREATE POLICY "Qualquer pessoa pode ver imagens de produtos" ON public.product_images
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "require_module_products_delete" ON public.product_images;
CREATE POLICY "require_module_products_delete" ON public.product_images
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'products'::text));

DROP POLICY IF EXISTS "require_module_products_insert" ON public.product_images;
CREATE POLICY "require_module_products_insert" ON public.product_images
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'products'::text));

DROP POLICY IF EXISTS "require_module_products_update" ON public.product_images;
CREATE POLICY "require_module_products_update" ON public.product_images
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'products'::text))
  WITH CHECK (has_module_access(auth.uid(), 'products'::text));

DROP POLICY IF EXISTS "Vendedores podem gerenciar imagens de seus produtos" ON public.product_images;
CREATE POLICY "Vendedores podem gerenciar imagens de seus produtos" ON public.product_images
  FOR ALL
  TO public
  USING (EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_images.product_id) AND (p.user_id = auth.uid()))))
  WITH CHECK (EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_images.product_id) AND (p.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Authenticated tenant can create product sales" ON public.product_sales;
CREATE POLICY "Authenticated tenant can create product sales" ON public.product_sales
  FOR INSERT
  TO authenticated
  WITH CHECK ((barber_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM barbers b
  WHERE ((b.id = product_sales.barber_id) AND (b.tenant_id = auth.uid())))));

DROP POLICY IF EXISTS "require_module_store_delete" ON public.product_sales;
CREATE POLICY "require_module_store_delete" ON public.product_sales
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'store'::text));

DROP POLICY IF EXISTS "require_module_store_insert" ON public.product_sales;
CREATE POLICY "require_module_store_insert" ON public.product_sales
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'store'::text));

DROP POLICY IF EXISTS "require_module_store_update" ON public.product_sales;
CREATE POLICY "require_module_store_update" ON public.product_sales
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'store'::text))
  WITH CHECK (has_module_access(auth.uid(), 'store'::text));

DROP POLICY IF EXISTS "Super admins can manage all product sales" ON public.product_sales;
CREATE POLICY "Super admins can manage all product sales" ON public.product_sales
  FOR ALL
  TO public
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "Users can insert their own product sales" ON public.product_sales;
CREATE POLICY "Users can insert their own product sales" ON public.product_sales
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own product sales" ON public.product_sales;
CREATE POLICY "Users can manage their own product sales" ON public.product_sales
  FOR ALL
  TO authenticated
  USING ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM barbers
  WHERE ((barbers.id = product_sales.barber_id) AND (barbers.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can update their own product sales" ON public.product_sales;
CREATE POLICY "Users can update their own product sales" ON public.product_sales
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own product sales" ON public.product_sales;
CREATE POLICY "Users can view their own product sales" ON public.product_sales
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view products" ON public.products;
CREATE POLICY "Public can view products" ON public.products
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Public select for products" ON public.products;
CREATE POLICY "Public select for products" ON public.products
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "require_module_products_delete" ON public.products;
CREATE POLICY "require_module_products_delete" ON public.products
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'products'::text));

DROP POLICY IF EXISTS "require_module_products_insert" ON public.products;
CREATE POLICY "require_module_products_insert" ON public.products
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'products'::text));

DROP POLICY IF EXISTS "require_module_products_update" ON public.products;
CREATE POLICY "require_module_products_update" ON public.products
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'products'::text))
  WITH CHECK (has_module_access(auth.uid(), 'products'::text));

DROP POLICY IF EXISTS "Super admins can manage all products" ON public.products;
CREATE POLICY "Super admins can manage all products" ON public.products
  FOR ALL
  TO public
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "Users can create their own products" ON public.products;
CREATE POLICY "Users can create their own products" ON public.products
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;
CREATE POLICY "Users can delete their own products" ON public.products
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
CREATE POLICY "Users can update their own products" ON public.products
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own products" ON public.products;
CREATE POLICY "Users can view their own products" ON public.products
  FOR SELECT
  TO public
  USING ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text)))));

DROP POLICY IF EXISTS "Admins can manage time off for their tenant" ON public.professional_time_off;
CREATE POLICY "Admins can manage time off for their tenant" ON public.professional_time_off
  FOR ALL
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Users can view time off for their tenant" ON public.professional_time_off;
CREATE POLICY "Users can view time off for their tenant" ON public.professional_time_off
  FOR SELECT
  TO authenticated
  USING ((tenant_id = auth.uid()) OR (professional_id IN ( SELECT barbers.id
   FROM barbers
  WHERE (barbers.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Profiles are viewable by owner, tenant, or super admin" ON public.profiles;
CREATE POLICY "Profiles are viewable by owner, tenant, or super admin" ON public.profiles
  FOR SELECT
  TO public
  USING ((auth.uid() = id) OR is_super_admin_user() OR ((get_my_tenant_id() IS NOT NULL) AND ((tenant_id = get_my_tenant_id()) OR (id = get_my_tenant_id()))));

DROP POLICY IF EXISTS "Super admins can delete profiles" ON public.profiles;
CREATE POLICY "Super admins can delete profiles" ON public.profiles
  FOR DELETE
  TO public
  USING (is_super_admin_user());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile or super admin can update any" ON public.profiles;
CREATE POLICY "Users can update own profile or super admin can update any" ON public.profiles
  FOR UPDATE
  TO public
  USING ((auth.uid() = id) OR is_super_admin_user())
  WITH CHECK ((auth.uid() = id) OR is_super_admin_user());

DROP POLICY IF EXISTS "user_own_subs_delete" ON public.push_subscriptions;
CREATE POLICY "user_own_subs_delete" ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_own_subs_select" ON public.push_subscriptions;
CREATE POLICY "user_own_subs_select" ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_only_rl" ON public.rate_limit_hits;
CREATE POLICY "service_only_rl" ON public.rate_limit_hits
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Owner manages reception permissions" ON public.reception_permissions;
CREATE POLICY "Owner manages reception permissions" ON public.reception_permissions
  FOR ALL
  TO authenticated
  USING ((tenant_id = get_my_tenant_id()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = get_my_tenant_id()) OR is_super_admin_user());

DROP POLICY IF EXISTS "Reception reads own permissions" ON public.reception_permissions;
CREATE POLICY "Reception reads own permissions" ON public.reception_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view their own tenant's refund audits" ON public.refund_audits;
CREATE POLICY "Admins can view their own tenant's refund audits" ON public.refund_audits
  FOR SELECT
  TO public
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants can manage their own refund requests" ON public.refund_requests;
CREATE POLICY "Tenants can manage their own refund requests" ON public.refund_requests
  FOR ALL
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Only Super Admins can read Resend settings" ON public.resend_settings;
CREATE POLICY "Only Super Admins can read Resend settings" ON public.resend_settings
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super Admins can manage Resend settings" ON public.resend_settings;
CREATE POLICY "Super Admins can manage Resend settings" ON public.resend_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Tenant owner reads review logs" ON public.review_automation_logs;
CREATE POLICY "Tenant owner reads review logs" ON public.review_automation_logs
  FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Allow read for authenticated role_permissions" ON public.role_permissions;
CREATE POLICY "Allow read for authenticated role_permissions" ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Catálogo de add-ons ativos é público" ON public.saas_addons;
CREATE POLICY "Catálogo de add-ons ativos é público" ON public.saas_addons
  FOR SELECT
  TO public
  USING ((is_active = true) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admin gerencia add-ons" ON public.saas_addons;
CREATE POLICY "Super admin gerencia add-ons" ON public.saas_addons
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "super_admin_insert_audit" ON public.saas_admin_voucher_audit_logs;
CREATE POLICY "super_admin_insert_audit" ON public.saas_admin_voucher_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "super_admin_read_audit" ON public.saas_admin_voucher_audit_logs;
CREATE POLICY "super_admin_read_audit" ON public.saas_admin_voucher_audit_logs
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "super_admin_full_access_redemptions" ON public.saas_admin_voucher_redemptions;
CREATE POLICY "super_admin_full_access_redemptions" ON public.saas_admin_voucher_redemptions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "tenant_can_view_own_redemption" ON public.saas_admin_voucher_redemptions;
CREATE POLICY "tenant_can_view_own_redemption" ON public.saas_admin_voucher_redemptions
  FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "super_admin_full_access_vouchers" ON public.saas_admin_vouchers;
CREATE POLICY "super_admin_full_access_vouchers" ON public.saas_admin_vouchers
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "tenant_can_view_own_voucher" ON public.saas_admin_vouchers;
CREATE POLICY "tenant_can_view_own_voucher" ON public.saas_admin_vouchers
  FOR SELECT
  TO authenticated
  USING (specific_tenant_id = auth.uid());

DROP POLICY IF EXISTS "authenticated reads billing settings" ON public.saas_billing_settings;
CREATE POLICY "authenticated reads billing settings" ON public.saas_billing_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "super admin manages billing settings" ON public.saas_billing_settings;
CREATE POLICY "super admin manages billing settings" ON public.saas_billing_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages checkout sessions" ON public.saas_checkout_sessions;
CREATE POLICY "Service role manages checkout sessions" ON public.saas_checkout_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users insert own checkout sessions" ON public.saas_checkout_sessions;
CREATE POLICY "Users insert own checkout sessions" ON public.saas_checkout_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own checkout sessions" ON public.saas_checkout_sessions;
CREATE POLICY "Users see own checkout sessions" ON public.saas_checkout_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own security logs" ON public.security_activity_logs;
CREATE POLICY "Users can view their own security logs" ON public.security_activity_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can rate real appointments" ON public.service_ratings;
CREATE POLICY "Public can rate real appointments" ON public.service_ratings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK ((appointment_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM appointments a
  WHERE (a.id = service_ratings.appointment_id))) AND ((rating >= 1) AND (rating <= 5)));

DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON public.service_ratings;
CREATE POLICY "Ratings are viewable by everyone" ON public.service_ratings
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Public select for services" ON public.services;
CREATE POLICY "Public select for services" ON public.services
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Serviços são públicos" ON public.services;
CREATE POLICY "Serviços são públicos" ON public.services
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Super admins can manage all services" ON public.services;
CREATE POLICY "Super admins can manage all services" ON public.services
  FOR ALL
  TO public
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "Users can manage their own services" ON public.services;
CREATE POLICY "Users can manage their own services" ON public.services
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own services" ON public.services;
CREATE POLICY "Users can view their own services" ON public.services
  FOR SELECT
  TO public
  USING ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text)))));

DROP POLICY IF EXISTS "Users can view their own tenant data" ON public.services;
CREATE POLICY "Users can view their own tenant data" ON public.services
  FOR ALL
  TO public
  USING (tenant_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "status_checks public read" ON public.status_checks;
CREATE POLICY "status_checks public read" ON public.status_checks
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "status_incidents admin write" ON public.status_incidents;
CREATE POLICY "status_incidents admin write" ON public.status_incidents
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "status_incidents public read" ON public.status_incidents;
CREATE POLICY "status_incidents public read" ON public.status_incidents
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "status_maintenances admin write" ON public.status_maintenances;
CREATE POLICY "status_maintenances admin write" ON public.status_maintenances
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "status_maintenances public read" ON public.status_maintenances;
CREATE POLICY "status_maintenances public read" ON public.status_maintenances
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "status_services admin write" ON public.status_services;
CREATE POLICY "status_services admin write" ON public.status_services
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "status_services public read" ON public.status_services;
CREATE POLICY "status_services public read" ON public.status_services
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Public can view active subprocessors" ON public.subprocessors;
CREATE POLICY "Public can view active subprocessors" ON public.subprocessors
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Super admin manages subprocessors" ON public.subprocessors;
CREATE POLICY "Super admin manages subprocessors" ON public.subprocessors
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_card_scans;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_card_scans
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_card_scans;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_card_scans
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_card_scans;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_card_scans
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user())
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant inserts card scans" ON public.subscription_card_scans;
CREATE POLICY "tenant inserts card scans" ON public.subscription_card_scans
  FOR INSERT
  TO authenticated
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant reads own card scans" ON public.subscription_card_scans;
CREATE POLICY "tenant reads own card scans" ON public.subscription_card_scans
  FOR SELECT
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_invoices;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_invoices
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_invoices;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_invoices
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_invoices;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_invoices
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user())
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant manages own invoices" ON public.subscription_invoices;
CREATE POLICY "tenant manages own invoices" ON public.subscription_invoices
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_loyalty_history;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_loyalty_history
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_loyalty_history;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_loyalty_history
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_loyalty_history;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_loyalty_history
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user())
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant manages own history" ON public.subscription_loyalty_history;
CREATE POLICY "tenant manages own history" ON public.subscription_loyalty_history
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_loyalty_rewards;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_loyalty_rewards
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_loyalty_rewards;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_loyalty_rewards
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_loyalty_rewards;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_loyalty_rewards
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user())
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant manages own rewards" ON public.subscription_loyalty_rewards;
CREATE POLICY "tenant manages own rewards" ON public.subscription_loyalty_rewards
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_payments;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_payments
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_payments;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_payments
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_payments;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_payments
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text))
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "tenant manages own subscription_payments" ON public.subscription_payments;
CREATE POLICY "tenant manages own subscription_payments" ON public.subscription_payments
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant reads own subscription_payments" ON public.subscription_payments;
CREATE POLICY "tenant reads own subscription_payments" ON public.subscription_payments
  FOR SELECT
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "auth can view plan benefit services" ON public.subscription_plan_benefit_services;
CREATE POLICY "auth can view plan benefit services" ON public.subscription_plan_benefit_services
  FOR SELECT
  TO authenticated
  USING ((active = true) OR (tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "public can view plan benefit services" ON public.subscription_plan_benefit_services;
CREATE POLICY "public can view plan benefit services" ON public.subscription_plan_benefit_services
  FOR SELECT
  TO anon
  USING (active = true);

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_plan_benefit_services;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_plan_benefit_services
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_plan_benefit_services;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_plan_benefit_services
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_plan_benefit_services;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_plan_benefit_services
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text))
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "tenant manages own plan benefit services" ON public.subscription_plan_benefit_services;
CREATE POLICY "tenant manages own plan benefit services" ON public.subscription_plan_benefit_services
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "auth can view plan benefits" ON public.subscription_plan_benefits;
CREATE POLICY "auth can view plan benefits" ON public.subscription_plan_benefits
  FOR SELECT
  TO authenticated
  USING ((active = true) OR (tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "public can view plan benefits" ON public.subscription_plan_benefits;
CREATE POLICY "public can view plan benefits" ON public.subscription_plan_benefits
  FOR SELECT
  TO anon
  USING (active = true);

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_plan_benefits;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_plan_benefits
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_plan_benefits;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_plan_benefits
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_plan_benefits;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_plan_benefits
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text))
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "tenant manages own plan benefits" ON public.subscription_plan_benefits;
CREATE POLICY "tenant manages own plan benefits" ON public.subscription_plan_benefits
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_plan_changes;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_plan_changes
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_plan_changes;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_plan_changes
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_plan_changes;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_plan_changes
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user())
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant insert plan changes" ON public.subscription_plan_changes;
CREATE POLICY "tenant insert plan changes" ON public.subscription_plan_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "tenant read plan changes" ON public.subscription_plan_changes;
CREATE POLICY "tenant read plan changes" ON public.subscription_plan_changes
  FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "public can view plan services" ON public.subscription_plan_services;
CREATE POLICY "public can view plan services" ON public.subscription_plan_services
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_plan_services;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_plan_services
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_plan_services;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_plan_services
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_plan_services;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_plan_services
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text))
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "tenant manages own plan services" ON public.subscription_plan_services;
CREATE POLICY "tenant manages own plan services" ON public.subscription_plan_services
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "auth can view active plans" ON public.subscription_plans;
CREATE POLICY "auth can view active plans" ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "public can view active plans" ON public.subscription_plans;
CREATE POLICY "public can view active plans" ON public.subscription_plans
  FOR SELECT
  TO anon
  USING (active = true);

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_plans;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_plans
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_plans;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_plans
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_plans;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_plans
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text))
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text));

DROP POLICY IF EXISTS "tenant manages own plans" ON public.subscription_plans;
CREATE POLICY "tenant manages own plans" ON public.subscription_plans
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_referrals;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_referrals
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_referrals;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_referrals
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_referrals;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_referrals
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user())
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "Service role full access referrals" ON public.subscription_referrals;
CREATE POLICY "Service role full access referrals" ON public.subscription_referrals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant manages own referrals" ON public.subscription_referrals;
CREATE POLICY "Tenant manages own referrals" ON public.subscription_referrals
  FOR ALL
  TO authenticated
  USING (tenant_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid())))
  WITH CHECK (tenant_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_status_logs;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_status_logs
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_status_logs;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_status_logs
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_status_logs;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_status_logs
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user())
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant inserts status logs" ON public.subscription_status_logs;
CREATE POLICY "tenant inserts status logs" ON public.subscription_status_logs
  FOR INSERT
  TO authenticated
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant reads own status logs" ON public.subscription_status_logs;
CREATE POLICY "tenant reads own status logs" ON public.subscription_status_logs
  FOR SELECT
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_delete" ON public.subscription_usage_logs;
CREATE POLICY "require_module_subscriptions_delete" ON public.subscription_usage_logs
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_insert" ON public.subscription_usage_logs;
CREATE POLICY "require_module_subscriptions_insert" ON public.subscription_usage_logs
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "require_module_subscriptions_update" ON public.subscription_usage_logs;
CREATE POLICY "require_module_subscriptions_update" ON public.subscription_usage_logs
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user())
  WITH CHECK (has_module_access(auth.uid(), 'subscriptions'::text) OR is_super_admin_user());

DROP POLICY IF EXISTS "tenant manages own usage logs" ON public.subscription_usage_logs;
CREATE POLICY "tenant manages own usage logs" ON public.subscription_usage_logs
  FOR ALL
  TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions
  FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text);

DROP POLICY IF EXISTS "Super admins can manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Super admins can manage all subscriptions" ON public.subscriptions
  FOR ALL
  TO authenticated
  USING (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'super_admin'::app_role))));

DROP POLICY IF EXISTS "Super admins can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Super admins can manage subscriptions" ON public.subscriptions
  FOR ALL
  TO public
  USING (is_super_admin_user());

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Messages access" ON public.support_messages;
CREATE POLICY "Messages access" ON public.support_messages
  FOR SELECT
  TO public
  USING (EXISTS ( SELECT 1
   FROM support_tickets
  WHERE ((support_tickets.id = support_messages.ticket_id) AND ((support_tickets.user_id = auth.uid()) OR is_super_admin()))));

DROP POLICY IF EXISTS "Messages insert" ON public.support_messages;
CREATE POLICY "Messages insert" ON public.support_messages
  FOR INSERT
  TO public
  WITH CHECK (EXISTS ( SELECT 1
   FROM support_tickets
  WHERE ((support_tickets.id = support_messages.ticket_id) AND ((support_tickets.user_id = auth.uid()) OR is_super_admin()))));

DROP POLICY IF EXISTS "Tickets access" ON public.support_tickets;
CREATE POLICY "Tickets access" ON public.support_tickets
  FOR SELECT
  TO public
  USING ((auth.uid() = user_id) OR is_super_admin());

DROP POLICY IF EXISTS "Tickets insert" ON public.support_tickets;
CREATE POLICY "Tickets insert" ON public.support_tickets
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Tickets update" ON public.support_tickets;
CREATE POLICY "Tickets update" ON public.support_tickets
  FOR UPDATE
  TO public
  USING ((auth.uid() = user_id) OR is_super_admin());

DROP POLICY IF EXISTS "Service role manages system health settings" ON public.system_health_settings;
CREATE POLICY "Service role manages system health settings" ON public.system_health_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Super admins manage system health settings" ON public.system_health_settings;
CREATE POLICY "Super admins manage system health settings" ON public.system_health_settings
  FOR ALL
  TO authenticated
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can manage system settings" ON public.system_settings;
CREATE POLICY "Super admins can manage system settings" ON public.system_settings
  FOR ALL
  TO public
  USING (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'super_admin'::app_role))));

DROP POLICY IF EXISTS "Users can view audit logs for their tenant" ON public.team_audit_logs;
CREATE POLICY "Users can view audit logs for their tenant" ON public.team_audit_logs
  FOR SELECT
  TO authenticated
  USING ((tenant_id IN ( SELECT tenant_memberships.tenant_id
   FROM tenant_memberships
  WHERE (tenant_memberships.user_id = auth.uid()))) OR (tenant_id = auth.uid()));

DROP POLICY IF EXISTS "Barbearia vê seus próprios add-ons" ON public.tenant_addons;
CREATE POLICY "Barbearia vê seus próprios add-ons" ON public.tenant_addons
  FOR SELECT
  TO authenticated
  USING ((tenant_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admin gerencia contratos" ON public.tenant_addons;
CREATE POLICY "Super admin gerencia contratos" ON public.tenant_addons
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Tenants manage their own integrations" ON public.tenant_integrations;
CREATE POLICY "Tenants manage their own integrations" ON public.tenant_integrations
  FOR ALL
  TO authenticated
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Admins can manage their tenant memberships" ON public.tenant_memberships;
CREATE POLICY "Admins can manage their tenant memberships" ON public.tenant_memberships
  FOR ALL
  TO authenticated
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Users can view their own memberships" ON public.tenant_memberships;
CREATE POLICY "Users can view their own memberships" ON public.tenant_memberships
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id) OR (auth.uid() = tenant_id));

DROP POLICY IF EXISTS "Tenants can manage their own webhooks" ON public.tenant_webhooks;
CREATE POLICY "Tenants can manage their own webhooks" ON public.tenant_webhooks
  FOR ALL
  TO authenticated
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Inserção de mensagens permitida para donos do ticket ou super" ON public.ticket_messages;
CREATE POLICY "Inserção de mensagens permitida para donos do ticket ou super" ON public.ticket_messages
  FOR INSERT
  TO public
  WITH CHECK (EXISTS ( SELECT 1
   FROM support_tickets st
  WHERE ((st.id = ticket_messages.ticket_id) AND ((st.user_id = auth.uid()) OR (( SELECT profiles.role
           FROM profiles
          WHERE (profiles.id = auth.uid())) = 'super_admin'::text)))));

DROP POLICY IF EXISTS "Mensagens visíveis por donos do ticket ou super admin" ON public.ticket_messages;
CREATE POLICY "Mensagens visíveis por donos do ticket ou super admin" ON public.ticket_messages
  FOR SELECT
  TO public
  USING (EXISTS ( SELECT 1
   FROM support_tickets st
  WHERE ((st.id = ticket_messages.ticket_id) AND ((st.user_id = auth.uid()) OR (( SELECT profiles.role
           FROM profiles
          WHERE (profiles.id = auth.uid())) = 'super_admin'::text)))));

DROP POLICY IF EXISTS "Barbers can view their own transactions" ON public.transactions;
CREATE POLICY "Barbers can view their own transactions" ON public.transactions
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM barbers
  WHERE ((barbers.id = transactions.barber_id) AND (barbers.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'tenant_admin'::app_role, 'super_admin'::app_role]))))) OR (auth.uid() = user_id));

DROP POLICY IF EXISTS "Super admins can manage all transactions" ON public.transactions;
CREATE POLICY "Super admins can manage all transactions" ON public.transactions
  FOR ALL
  TO public
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions" ON public.transactions
  FOR ALL
  TO public
  USING ((EXISTS ( SELECT 1
   FROM barbers
  WHERE ((barbers.id = transactions.barber_id) AND (barbers.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'tenant_admin'::app_role, 'super_admin'::app_role]))))) OR (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own tenant data" ON public.transactions;
CREATE POLICY "Users can view their own tenant data" ON public.transactions
  FOR ALL
  TO public
  USING (tenant_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Everyone can view tutorial categories" ON public.tutorial_categories;
CREATE POLICY "Everyone can view tutorial categories" ON public.tutorial_categories
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Only super admins can manage tutorial categories" ON public.tutorial_categories;
CREATE POLICY "Only super admins can manage tutorial categories" ON public.tutorial_categories
  FOR ALL
  TO public
  USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text))));

DROP POLICY IF EXISTS "Everyone can view tutorials" ON public.tutorials;
CREATE POLICY "Everyone can view tutorials" ON public.tutorials
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Only super admins can manage tutorials" ON public.tutorials;
CREATE POLICY "Only super admins can manage tutorials" ON public.tutorials
  FOR ALL
  TO public
  USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text))));

DROP POLICY IF EXISTS "Users can create invitations for their tenant" ON public.user_invitations;
CREATE POLICY "Users can create invitations for their tenant" ON public.user_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK ((tenant_id IN ( SELECT tenant_memberships.tenant_id
   FROM tenant_memberships
  WHERE (tenant_memberships.user_id = auth.uid()))) OR (tenant_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update invitations for their tenant" ON public.user_invitations;
CREATE POLICY "Users can update invitations for their tenant" ON public.user_invitations
  FOR UPDATE
  TO authenticated
  USING ((tenant_id IN ( SELECT tenant_memberships.tenant_id
   FROM tenant_memberships
  WHERE (tenant_memberships.user_id = auth.uid()))) OR (tenant_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view invitations for their tenant" ON public.user_invitations;
CREATE POLICY "Users can view invitations for their tenant" ON public.user_invitations
  FOR SELECT
  TO authenticated
  USING ((tenant_id IN ( SELECT tenant_memberships.tenant_id
   FROM tenant_memberships
  WHERE (tenant_memberships.user_id = auth.uid()))) OR (tenant_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own backup codes" ON public.user_mfa_backup_codes;
CREATE POLICY "Users can manage their own backup codes" ON public.user_mfa_backup_codes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_onboarding_preferences;
CREATE POLICY "Users can manage their own preferences" ON public.user_onboarding_preferences
  FOR ALL
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_onboarding_preferences;
CREATE POLICY "Users can view their own preferences" ON public.user_onboarding_preferences
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own onboarding progress" ON public.user_onboarding_progress;
CREATE POLICY "Users can manage their own onboarding progress" ON public.user_onboarding_progress
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
CREATE POLICY "Super admins can manage roles" ON public.user_roles
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT
  TO public
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can manage their own tour states" ON public.user_tour_states;
CREATE POLICY "Users can manage their own tour states" ON public.user_tour_states
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own challenges" ON public.verification_challenges;
CREATE POLICY "Users can view their own challenges" ON public.verification_challenges
  FOR SELECT
  TO authenticated
  USING (email = ( SELECT profiles.email
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Reception reads waiting list" ON public.waiting_list;
CREATE POLICY "Reception reads waiting list" ON public.waiting_list
  FOR SELECT
  TO authenticated
  USING (tenant_id = reception_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Reception updates waiting list" ON public.waiting_list;
CREATE POLICY "Reception updates waiting list" ON public.waiting_list
  FOR UPDATE
  TO authenticated
  USING ((tenant_id = reception_tenant_id(auth.uid())) AND reception_can(auth.uid(), 'manage_waiting_list'::text))
  WITH CHECK ((tenant_id = reception_tenant_id(auth.uid())) AND reception_can(auth.uid(), 'manage_waiting_list'::text));

DROP POLICY IF EXISTS "Reception writes waiting list" ON public.waiting_list;
CREATE POLICY "Reception writes waiting list" ON public.waiting_list
  FOR INSERT
  TO authenticated
  WITH CHECK ((tenant_id = reception_tenant_id(auth.uid())) AND reception_can(auth.uid(), 'manage_waiting_list'::text));

DROP POLICY IF EXISTS "Tenant manages waiting list" ON public.waiting_list;
CREATE POLICY "Tenant manages waiting list" ON public.waiting_list
  FOR ALL
  TO authenticated
  USING ((tenant_id = get_my_tenant_id()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = get_my_tenant_id()) OR is_super_admin_user());

DROP POLICY IF EXISTS "Users can manage wallets of their customers" ON public.wallet;
CREATE POLICY "Users can manage wallets of their customers" ON public.wallet
  FOR ALL
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view wallets of their customers" ON public.wallet;
CREATE POLICY "Users can view wallets of their customers" ON public.wallet
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage transactions of their customers" ON public.wallet_transactions;
CREATE POLICY "Users can manage transactions of their customers" ON public.wallet_transactions
  FOR ALL
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view transactions of their customers" ON public.wallet_transactions;
CREATE POLICY "Users can view transactions of their customers" ON public.wallet_transactions
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Barbearias podem ver seus próprios logs" ON public.webhook_logs;
CREATE POLICY "Barbearias podem ver seus próprios logs" ON public.webhook_logs
  FOR SELECT
  TO public
  USING (auth.uid() = barbershop_id);

DROP POLICY IF EXISTS "Users can manage their own whatsapp connections" ON public.whatsapp_cloud_connections;
CREATE POLICY "Users can manage their own whatsapp connections" ON public.whatsapp_cloud_connections
  FOR ALL
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Barbers can view their conversations" ON public.whatsapp_conversations;
CREATE POLICY "Barbers can view their conversations" ON public.whatsapp_conversations
  FOR SELECT
  TO authenticated
  USING (EXISTS ( SELECT 1
   FROM barbers b
  WHERE ((b.id = whatsapp_conversations.barber_id) AND (b.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Service role can manage all conversations" ON public.whatsapp_conversations;
CREATE POLICY "Service role can manage all conversations" ON public.whatsapp_conversations
  FOR ALL
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Users can manage their own delivery logs" ON public.whatsapp_delivery_logs;
CREATE POLICY "Users can manage their own delivery logs" ON public.whatsapp_delivery_logs
  FOR ALL
  TO public
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Users can view their own delivery logs" ON public.whatsapp_delivery_logs;
CREATE POLICY "Users can view their own delivery logs" ON public.whatsapp_delivery_logs
  FOR SELECT
  TO public
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Manage own whatsapp instances" ON public.whatsapp_instances;
CREATE POLICY "Manage own whatsapp instances" ON public.whatsapp_instances
  FOR ALL
  TO public
  USING ((auth.uid() = tenant_id) OR (auth.uid() = barber_id));

DROP POLICY IF EXISTS "View own whatsapp instances" ON public.whatsapp_instances;
CREATE POLICY "View own whatsapp instances" ON public.whatsapp_instances
  FOR SELECT
  TO public
  USING ((auth.uid() = tenant_id) OR (auth.uid() = barber_id));

DROP POLICY IF EXISTS "Users can view their own whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can view their own whatsapp messages" ON public.whatsapp_messages
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own whatsapp templates" ON public.whatsapp_templates;
CREATE POLICY "Users can manage their own whatsapp templates" ON public.whatsapp_templates
  FOR ALL
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own integration logs" ON public.zapi_integration_logs;
CREATE POLICY "Users can view their own integration logs" ON public.zapi_integration_logs
  FOR SELECT
  TO public
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants can view their own debug logs" ON public.zapi_webhook_debug;
CREATE POLICY "Tenants can view their own debug logs" ON public.zapi_webhook_debug
  FOR SELECT
  TO public
  USING (tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = auth.uid())));

DROP POLICY IF EXISTS "Service role manages zapi webhook logs" ON public.zapi_webhook_logs;
CREATE POLICY "Service role manages zapi webhook logs" ON public.zapi_webhook_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Tenants can view their own webhook logs" ON public.zapi_webhook_logs;
CREATE POLICY "Tenants can view their own webhook logs" ON public.zapi_webhook_logs
  FOR SELECT
  TO public
  USING (auth.uid() = tenant_id);


-- ==============================================================================
-- 10. VIEWS (2 VIEWS)
-- ==============================================================================
CREATE OR REPLACE VIEW public.barber_rating_stats AS
SELECT barber_id,
    tenant_id,
    round(avg(barber_rating), 2) AS avg_rating,
    count(barber_rating) AS total_ratings
   FROM appointment_reviews
  WHERE (barber_rating IS NOT NULL)
  GROUP BY barber_id, tenant_id;

CREATE OR REPLACE VIEW public.vw_automation_debug AS
SELECT a.id AS appointment_id,
    a.status,
    a.created_at,
    a.start_time,
    a.confirmation_sent_at,
    a.confirmation_sent,
    c.name AS customer_name,
    c.phone AS customer_phone,
    a.tenant_id
   FROM (appointments a
     LEFT JOIN customers c ON ((a.customer_id = c.id)));

