-- =====================================================================
-- BARBEX — PHASE 17C.M7D-B
-- SOURCE AUTH DRIFT CHECK & LIVE FINGERPRINT QUERY
-- EXECUTE IN LOVABLE CLOUD / SOURCE SQL EDITOR
-- MODE: STRICTLY READ-ONLY
-- ZERO MUTATION
-- =====================================================================

WITH users_summary AS (
    SELECT 
        COUNT(*)::int AS users_count,
        COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END)::int AS confirmed_users_count,
        COUNT(CASE WHEN encrypted_password IS NOT NULL AND length(encrypted_password) > 0 THEN 1 END)::int AS password_hash_count,
        COUNT(CASE WHEN is_anonymous = true THEN 1 END)::int AS anonymous_users_count
    FROM auth.users
    WHERE id IN (
        '292134e7-4b98-49ee-84c6-b8b546ec57de'::uuid,
        '7b5c3640-2e10-4788-83a7-5e6d8e0d9978'::uuid,
        'ab0fb7c1-b7c9-40ef-be97-14348e88ae65'::uuid,
        '67d4e85a-3ed5-4109-9c9b-b83622331286'::uuid,
        '703dcd8f-0077-4a57-8728-be05f654bd5b'::uuid,
        '2af47416-1c7a-4222-bb30-757eb4318377'::uuid,
        '997746ee-723f-40e4-a6c6-5359eddd2a98'::uuid,
        'c54ac1ac-49be-4505-b7a4-d257ed023f08'::uuid,
        '69e0910b-a3f1-4be0-8a37-4f37c544bf6c'::uuid,
        '0cd900ec-d14a-4647-8229-1387c73c578f'::uuid
    )
),
total_users AS (
    SELECT COUNT(*)::int AS total_source_users FROM auth.users
),
identities_summary AS (
    SELECT 
        COUNT(*)::int AS identities_count,
        COUNT(DISTINCT user_id)::int AS distinct_user_identities,
        COUNT(CASE WHEN provider = 'email' THEN 1 END)::int AS email_identities_count
    FROM auth.identities
    WHERE user_id IN (
        '292134e7-4b98-49ee-84c6-b8b546ec57de'::uuid,
        '7b5c3640-2e10-4788-83a7-5e6d8e0d9978'::uuid,
        'ab0fb7c1-b7c9-40ef-be97-14348e88ae65'::uuid,
        '67d4e85a-3ed5-4109-9c9b-b83622331286'::uuid,
        '703dcd8f-0077-4a57-8728-be05f654bd5b'::uuid,
        '2af47416-1c7a-4222-bb30-757eb4318377'::uuid,
        '997746ee-723f-40e4-a6c6-5359eddd2a98'::uuid,
        'c54ac1ac-49be-4505-b7a4-d257ed023f08'::uuid,
        '69e0910b-a3f1-4be0-8a37-4f37c544bf6c'::uuid,
        '0cd900ec-d14a-4647-8229-1387c73c578f'::uuid
    )
),
total_identities AS (
    SELECT COUNT(*)::int AS total_source_identities FROM auth.identities
)
SELECT 
    t_u.total_source_users,
    u.users_count AS targeted_users_count,
    u.confirmed_users_count,
    u.password_hash_count,
    u.anonymous_users_count,
    t_i.total_source_identities,
    i.identities_count AS targeted_identities_count,
    i.distinct_user_identities,
    i.email_identities_count,
    CASE 
        WHEN t_u.total_source_users = 10 
         AND u.users_count = 10 
         AND u.confirmed_users_count = 10 
         AND u.password_hash_count = 10
         AND t_i.total_source_identities = 10 
         AND i.identities_count = 10 
         AND i.email_identities_count = 10
        THEN 'SOURCE_AUTH_CURRENT_NO_DRIFT'
        ELSE 'SOURCE_AUTH_DRIFT_DETECTED'
    END AS drift_status
FROM users_summary u
CROSS JOIN total_users t_u
CROSS JOIN identities_summary i
CROSS JOIN total_identities t_i;
