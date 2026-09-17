-- =====================================================================
-- BARBEX — PHASE 17C.M7D
-- TARGET PREFLIGHT VERIFICATION
-- MODE: STRICTLY READ-ONLY / ZERO MUTATION
-- =====================================================================

WITH target_id AS (
    SELECT 
        current_database() AS db_name,
        current_user AS user_name,
        version() AS pg_version
),
schema_counts AS (
    SELECT 
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables_count,
        (SELECT count(*)::int FROM information_schema.columns c JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE') AS columns_count,
        (SELECT count(*)::int FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype = 'u') AS unique_constraints_count,
        (SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public') AS indexes_count,
        (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public') AS functions_count,
        (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public') AS policies_count
),
auth_counts AS (
    SELECT 
        (SELECT count(*)::int FROM auth.users) AS auth_users_count,
        (SELECT count(*)::int FROM auth.identities) AS auth_identities_count
),
non_auth_counts AS (
    SELECT 
        (SELECT count(*)::int FROM storage.buckets) AS storage_buckets_count,
        (SELECT count(*)::int FROM storage.objects) AS storage_objects_count,
        (SELECT count(*)::int FROM cron.job) AS cron_jobs_count,
        (SELECT count(*)::int FROM supabase_migrations.schema_migrations) AS schema_migrations_count,
        (SELECT coalesce(sum(n_live_tup)::int, 0) FROM pg_stat_user_tables WHERE schemaname = 'public') AS public_live_rows
),
users_col_check AS (
    -- Verify all 17 required columns exist in auth.users
    SELECT count(*)::int AS users_matched_cols
    FROM information_schema.columns
    WHERE table_schema = 'auth' 
      AND table_name = 'users'
      AND column_name IN (
        'id', 'instance_id', 'aud', 'role', 'email', 'encrypted_password',
        'email_confirmed_at', 'confirmed_at', 'raw_app_meta_data', 'raw_user_meta_data',
        'created_at', 'updated_at', 'last_sign_in_at', 'phone', 'phone_confirmed_at',
        'is_sso_user', 'is_anonymous'
      )
),
identities_col_check AS (
    -- Verify all 9 required columns exist in auth.identities
    SELECT count(*)::int AS identities_matched_cols
    FROM information_schema.columns
    WHERE table_schema = 'auth' 
      AND table_name = 'identities'
      AND column_name IN (
        'id', 'provider_id', 'user_id', 'identity_data', 'provider',
        'last_sign_in_at', 'created_at', 'updated_at', 'email'
      )
),
trigger_audit AS (
    SELECT count(*)::int AS app_triggers_count
    FROM information_schema.triggers
    WHERE event_object_schema = 'auth'
      AND event_object_table IN ('users', 'identities')
      AND trigger_name NOT LIKE 'on_auth_%'
      AND action_statement NOT LIKE '%supabase%'
)
SELECT 
    t.db_name,
    t.user_name,
    s.tables_count,
    s.columns_count,
    s.unique_constraints_count,
    s.indexes_count,
    s.functions_count,
    s.policies_count,
    a.auth_users_count,
    a.auth_identities_count,
    na.storage_buckets_count,
    na.storage_objects_count,
    na.cron_jobs_count,
    na.schema_migrations_count,
    na.public_live_rows,
    (17 - uc.users_matched_cols) AS users_column_drift,
    (9 - ic.identities_matched_cols) AS identities_column_drift,
    tr.app_triggers_count,
    CASE 
        WHEN s.tables_count = 159
         AND s.columns_count = 2198
         AND s.unique_constraints_count = 58
         AND s.indexes_count = 442
         AND s.functions_count = 202
         AND s.policies_count = 394
         AND a.auth_users_count = 0
         AND a.auth_identities_count = 0
         AND na.storage_buckets_count = 0
         AND na.storage_objects_count = 0
         AND na.cron_jobs_count = 0
         AND na.schema_migrations_count = 0
         AND uc.users_matched_cols = 17
         AND ic.identities_matched_cols = 9
         AND tr.app_triggers_count = 0
        THEN 'PREFLIGHT_PASS'
        ELSE 'PREFLIGHT_FAIL'
    END AS preflight_status
FROM target_id t
CROSS JOIN schema_counts s
CROSS JOIN auth_counts a
CROSS JOIN non_auth_counts na
CROSS JOIN users_col_check uc
CROSS JOIN identities_col_check ic
CROSS JOIN trigger_audit tr;
