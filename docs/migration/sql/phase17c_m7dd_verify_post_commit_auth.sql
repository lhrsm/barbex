-- =====================================================================
-- BARBEX — PHASE 17C.M7D-D / M7D
-- INDEPENDENT POST-COMMIT AUTH STATE VERIFICATION QUERY
-- EXECUTE ON NEW CONNECTION AFTER M7D TRANSACTION COMMIT
-- MODE: STRICTLY READ-ONLY
-- ZERO MUTATION
-- =====================================================================

WITH users_summary AS (
    SELECT 
        COUNT(*)::int AS users_count,
        COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END)::int AS confirmed_users_count,
        COUNT(CASE WHEN encrypted_password IS NOT NULL AND length(encrypted_password) > 0 THEN 1 END)::int AS password_hash_count,
        COUNT(CASE WHEN encrypted_password IS NULL OR length(encrypted_password) = 0 THEN 1 END)::int AS password_hash_empty_count,
        COUNT(CASE WHEN phone IS NOT NULL AND length(phone) > 0 THEN 1 END)::int AS nonempty_phone_count,
        COUNT(CASE WHEN is_anonymous = true THEN 1 END)::int AS anonymous_users_count
    FROM auth.users
),
identities_summary AS (
    SELECT 
        COUNT(*)::int AS identities_count,
        COUNT(CASE WHEN provider = 'email' THEN 1 END)::int AS email_identities_count,
        COUNT(CASE WHEN provider = 'phone' THEN 1 END)::int AS phone_identities_count,
        COUNT(CASE WHEN user_id NOT IN (SELECT id FROM auth.users) THEN 1 END)::int AS orphan_identities_count
    FROM auth.identities
),
duplicate_providers AS (
    SELECT count(*)::int AS duplicate_provider_identities_count
    FROM (
        SELECT user_id, provider, count(*) 
        FROM auth.identities 
        GROUP BY user_id, provider 
        HAVING count(*) > 1
    ) d
),
topology_summary AS (
    SELECT 
        COUNT(CASE WHEN id_cnt = 1 THEN 1 END)::int AS users_with_1_identity,
        COUNT(CASE WHEN id_cnt = 2 THEN 1 END)::int AS users_with_2_identities,
        COUNT(CASE WHEN id_cnt = 0 THEN 1 END)::int AS users_with_0_identities,
        COUNT(CASE WHEN id_cnt > 2 THEN 1 END)::int AS users_with_gt2_identities
    FROM (
        SELECT u.id, COUNT(i.id)::int AS id_cnt
        FROM auth.users u
        LEFT JOIN auth.identities i ON i.user_id = u.id
        GROUP BY u.id
    ) u_counts
),
phone_consistency AS (
    SELECT 
        CASE 
            WHEN COUNT(*) = 2 THEN 'YES'
            ELSE 'NO'
        END AS phone_state_consistent
    FROM auth.identities i
    JOIN auth.users u ON u.id = i.user_id
    WHERE i.provider = 'phone' 
      AND u.phone IS NOT NULL 
      AND length(u.phone) > 0
),
non_auth_delta AS (
    SELECT 
        (SELECT coalesce(sum(n_live_tup)::int, 0) FROM pg_stat_user_tables WHERE schemaname = 'public') AS public_live_rows,
        (SELECT count(*)::int FROM storage.buckets) AS storage_buckets_count,
        (SELECT count(*)::int FROM storage.objects) AS storage_objects_count,
        (SELECT count(*)::int FROM cron.job) AS cron_jobs_count,
        (SELECT count(*)::int FROM supabase_migrations.schema_migrations) AS schema_migrations_count
)
SELECT 
    u.users_count AS "TARGET_AUTH_USERS",
    i.identities_count AS "TARGET_AUTH_IDENTITIES",
    i.email_identities_count AS "EMAIL_IDENTITIES",
    i.phone_identities_count AS "PHONE_IDENTITIES",
    t.users_with_1_identity AS "USERS_WITH_1_IDENTITY",
    t.users_with_2_identities AS "USERS_WITH_2_IDENTITIES",
    t.users_with_0_identities AS "USERS_WITH_0_IDENTITIES",
    t.users_with_gt2_identities AS "USERS_WITH_GT2_IDENTITIES",
    i.orphan_identities_count AS "ORPHAN_IDENTITIES",
    dp.duplicate_provider_identities_count AS "DUPLICATE_PROVIDER_IDENTITIES",
    u.password_hash_count AS "PASSWORD_HASH_ROWS",
    u.password_hash_empty_count AS "PASSWORD_HASH_EMPTY_ROWS",
    u.confirmed_users_count AS "EMAIL_CONFIRMED_USERS",
    u.nonempty_phone_count AS "USERS_WITH_NONEMPTY_PHONE",
    pc.phone_state_consistent AS "PHONE_IDENTITY_USER_STATE_CONSISTENT",
    CASE WHEN u.users_count = 10 THEN 'YES' ELSE 'NO' END AS "UUID_SET_MATCH",
    CASE WHEN i.identities_count = 12 AND i.email_identities_count = 10 AND i.phone_identities_count = 2 AND t.users_with_1_identity = 8 AND t.users_with_2_identities = 2 THEN 'YES' ELSE 'NO' END AS "IDENTITY_TOPOLOGY_MATCH",
    nad.public_live_rows AS "PUBLIC_BUSINESS_ROWS_UNEXPECTED_DELTA",
    nad.storage_buckets_count AS "STORAGE_BUCKET_DELTA",
    nad.storage_objects_count AS "STORAGE_OBJECT_DELTA",
    nad.cron_jobs_count AS "CRON_DELTA",
    nad.schema_migrations_count AS "MIGRATION_HISTORY_DELTA",
    CASE 
        WHEN u.users_count = 10 
         AND i.identities_count = 12 
         AND i.email_identities_count = 10 
         AND i.phone_identities_count = 2
         AND t.users_with_1_identity = 8 
         AND t.users_with_2_identities = 2
         AND t.users_with_0_identities = 0
         AND t.users_with_gt2_identities = 0
         AND i.orphan_identities_count = 0
         AND dp.duplicate_provider_identities_count = 0
         AND u.password_hash_count = 10
         AND u.password_hash_empty_count = 0
         AND u.confirmed_users_count = 10
         AND u.nonempty_phone_count = 2
         AND pc.phone_state_consistent = 'YES'
         AND nad.public_live_rows = 0
         AND nad.storage_buckets_count = 0
         AND nad.storage_objects_count = 0
         AND nad.cron_jobs_count = 0
         AND nad.schema_migrations_count = 0
        THEN 'POST_COMMIT_VERIFICATION_PASS'
        ELSE 'POST_COMMIT_VERIFICATION_FAIL'
    END AS "VERIFICATION_STATUS"
FROM users_summary u
CROSS JOIN identities_summary i
CROSS JOIN duplicate_providers dp
CROSS JOIN topology_summary t
CROSS JOIN phone_consistency pc
CROSS JOIN non_auth_delta nad;
