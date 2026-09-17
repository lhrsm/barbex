-- =====================================================================
-- BARBEX — PHASE 17C.M7E
-- TARGET FOUNDATION RECHECK
-- MODE: STRICTLY READ-ONLY / ZERO MUTATION
-- =====================================================================

WITH target_schema AS (
    SELECT 
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS base_tables_count,
        (SELECT count(*)::int FROM information_schema.views WHERE table_schema = 'public') AS views_count,
        (SELECT count(*)::int FROM information_schema.sequences WHERE sequence_schema = 'public') AS sequences_count,
        (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public') AS functions_count,
        (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public') AS policies_count,
        (SELECT count(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e') AS enum_types_count
),
target_auth AS (
    SELECT 
        (SELECT count(*)::int FROM auth.users) AS auth_users_count,
        (SELECT count(*)::int FROM auth.identities) AS auth_identities_count
),
target_data AS (
    SELECT 
        (SELECT count(*)::int FROM storage.objects) AS storage_objects_count,
        (SELECT count(*)::int FROM cron.job) AS cron_jobs_count,
        (SELECT count(*)::int FROM supabase_migrations.schema_migrations) AS schema_migrations_count,
        (SELECT coalesce(sum(n_live_tup)::int, 0) FROM pg_stat_user_tables WHERE schemaname = 'public') AS public_live_rows
)
SELECT 
    s.base_tables_count,
    s.views_count,
    s.sequences_count,
    s.functions_count,
    s.policies_count,
    s.enum_types_count,
    a.auth_users_count,
    a.auth_identities_count,
    d.storage_objects_count,
    d.cron_jobs_count,
    d.schema_migrations_count,
    d.public_live_rows,
    CASE 
        WHEN s.base_tables_count = 159 
         AND s.views_count = 2 
         AND s.sequences_count = 2 
         AND s.functions_count = 202 
         AND s.policies_count = 394 
         AND s.enum_types_count = 14 
        THEN 'YES' 
        ELSE 'NO' 
    END AS target_schema_foundation_valid,
    CASE 
        WHEN a.auth_users_count = 10 
         AND a.auth_identities_count = 12 
        THEN 'YES' 
        ELSE 'NO' 
    END AS target_auth_foundation_valid,
    CASE 
        WHEN d.public_live_rows = 0 
        THEN 'NO' 
        ELSE 'YES' 
    END AS target_public_not_empty_blocker
FROM target_schema s
CROSS JOIN target_auth a
CROSS JOIN target_data d;
