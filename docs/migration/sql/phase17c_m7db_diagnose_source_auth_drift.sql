-- =====================================================================
-- BARBEX — PHASE 17C.M7D-B
-- SOURCE AUTH DRIFT DIAGNOSTIC QUERY
-- EXECUTE IN LOVABLE CLOUD / SOURCE SQL EDITOR
-- MODE: STRICTLY READ-ONLY (SELECT / CTE ONLY)
-- ZERO INSERT / ZERO UPDATE / ZERO DELETE / ZERO DDL
-- PRIVACY: NO EMAILS, NO PASSWORD HASHES, NO TOKENS, NO FULL RAW METADATA
-- =====================================================================

WITH frozen_manifest_users AS (
    SELECT unnest(ARRAY[
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
    ]) AS expected_id
),
source_users_all AS (
    SELECT 
        id,
        email_confirmed_at,
        encrypted_password,
        raw_app_meta_data,
        raw_user_meta_data,
        is_anonymous,
        created_at,
        updated_at,
        last_sign_in_at,
        confirmation_sent_at,
        recovery_sent_at,
        reauthentication_sent_at
    FROM auth.users
),
source_identities_all AS (
    SELECT 
        id,
        user_id,
        provider,
        provider_id,
        created_at,
        updated_at,
        last_sign_in_at
    FROM auth.identities
),
user_counts AS (
    SELECT
        COUNT(*)::int AS current_auth_users_count,
        10::int AS expected_auth_users_count,
        COUNT(CASE WHEN u.id IN (SELECT expected_id FROM frozen_manifest_users) THEN 1 END)::int AS matching_manifest_users_count,
        COUNT(CASE WHEN u.id NOT IN (SELECT expected_id FROM frozen_manifest_users) THEN 1 END)::int AS unexpected_users_count,
        (SELECT COUNT(*)::int FROM frozen_manifest_users f WHERE f.expected_id NOT IN (SELECT id FROM source_users_all)) AS missing_manifest_users_count,
        COUNT(CASE WHEN u.email_confirmed_at IS NOT NULL THEN 1 END)::int AS email_confirmed_users_count,
        COUNT(CASE WHEN u.encrypted_password IS NOT NULL AND length(u.encrypted_password) > 0 THEN 1 END)::int AS password_hash_present_count,
        COUNT(CASE WHEN u.encrypted_password IS NULL OR length(u.encrypted_password) = 0 THEN 1 END)::int AS password_hash_empty_count,
        COUNT(CASE WHEN u.is_anonymous = true THEN 1 END)::int AS anonymous_users_count
    FROM source_users_all u
),
identity_counts AS (
    SELECT
        COUNT(*)::int AS current_auth_identities_count,
        10::int AS expected_auth_identities_count,
        COUNT(CASE WHEN i.provider = 'email' THEN 1 END)::int AS email_provider_identities_count,
        COUNT(CASE WHEN i.provider != 'email' THEN 1 END)::int AS non_email_provider_identities_count,
        COUNT(CASE WHEN i.user_id NOT IN (SELECT id FROM source_users_all) THEN 1 END)::int AS identity_orphan_count
    FROM source_identities_all i
),
user_identity_topology AS (
    SELECT
        COUNT(CASE WHEN identity_count = 0 THEN 1 END)::int AS users_without_identity_count,
        COUNT(CASE WHEN identity_count = 1 THEN 1 END)::int AS users_with_one_identity_count,
        COUNT(CASE WHEN identity_count > 1 THEN 1 END)::int AS users_with_multiple_identities_count
    FROM (
        SELECT 
            u.id, 
            COUNT(i.id)::int AS identity_count
        FROM source_users_all u
        LEFT JOIN source_identities_all i ON i.user_id = u.id
        GROUP BY u.id
    ) u_id_counts
),
volatile_changes_check AS (
    -- Checks whether recent activity occurred on users
    SELECT
        COUNT(CASE WHEN u.updated_at > u.created_at THEN 1 END)::int AS users_with_updated_at_drift,
        COUNT(CASE WHEN u.last_sign_in_at IS NOT NULL THEN 1 END)::int AS users_with_last_sign_in,
        COUNT(CASE WHEN u.confirmation_sent_at IS NOT NULL THEN 1 END)::int AS users_with_confirmation_sent,
        COUNT(CASE WHEN u.recovery_sent_at IS NOT NULL THEN 1 END)::int AS users_with_recovery_sent,
        COUNT(CASE WHEN u.reauthentication_sent_at IS NOT NULL THEN 1 END)::int AS users_with_reauth_sent
    FROM source_users_all u
)
SELECT 
    -- 1. Aggregate Counts
    uc.current_auth_users_count AS "SOURCE_AUTH_USERS_CURRENT",
    uc.expected_auth_users_count AS "SOURCE_AUTH_USERS_EXPECTED",
    ic.current_auth_identities_count AS "SOURCE_AUTH_IDENTITIES_CURRENT",
    ic.expected_auth_identities_count AS "SOURCE_AUTH_IDENTITIES_EXPECTED",
    
    -- 2. UUID Parity
    CASE WHEN uc.matching_manifest_users_count = 10 AND uc.unexpected_users_count = 0 AND uc.missing_manifest_users_count = 0 THEN 'YES' ELSE 'NO' END AS "UUID_SET_MATCH",
    uc.missing_manifest_users_count AS "UUID_MISSING_COUNT",
    uc.unexpected_users_count AS "UUID_UNEXPECTED_COUNT",
    
    -- 3. Identity Topology
    CASE WHEN uit.users_with_one_identity_count = 10 AND uit.users_without_identity_count = 0 AND uit.users_with_multiple_identities_count = 0 AND ic.identity_orphan_count = 0 THEN 'YES' ELSE 'NO' END AS "IDENTITY_TOPOLOGY_MATCH",
    ic.identity_orphan_count AS "IDENTITY_ORPHANS",
    uit.users_without_identity_count AS "USERS_WITHOUT_IDENTITY",
    uit.users_with_multiple_identities_count AS "USERS_WITH_MULTIPLE_IDENTITIES",
    
    -- 4. Provider & Confirmation
    ic.email_provider_identities_count AS "EMAIL_IDENTITIES",
    ic.non_email_provider_identities_count AS "NON_EMAIL_IDENTITIES",
    uc.email_confirmed_users_count AS "EMAIL_CONFIRMED_USERS",
    uc.password_hash_present_count AS "PASSWORD_HASH_ROWS",
    uc.password_hash_empty_count AS "PASSWORD_HASH_EMPTY_ROWS",
    
    -- 5. Drift Sub-Classifications
    CASE 
        WHEN uc.current_auth_users_count != 10 
          OR ic.current_auth_identities_count != 10 
          OR uc.missing_manifest_users_count > 0 
          OR uc.unexpected_users_count > 0 
          OR uit.users_without_identity_count > 0 
          OR uit.users_with_multiple_identities_count > 0
          OR ic.identity_orphan_count > 0
        THEN 'YES' 
        ELSE 'NO' 
    END AS "STRUCTURAL_AUTH_DRIFT",
    
    CASE 
        WHEN uc.password_hash_empty_count > 0 
          OR uc.password_hash_present_count != 10 
        THEN 'YES' 
        ELSE 'NO' 
    END AS "CREDENTIAL_AUTH_DRIFT",
    
    CASE 
        WHEN uc.anonymous_users_count > 0 
        THEN 'YES' 
        ELSE 'NO' 
    END AS "METADATA_AUTH_DRIFT",
    
    CASE 
        WHEN (uc.current_auth_users_count = 10 AND ic.current_auth_identities_count = 10 AND uc.missing_manifest_users_count = 0 AND uc.unexpected_users_count = 0)
         AND (vc.users_with_updated_at_drift > 0 OR vc.users_with_last_sign_in > 0)
        THEN 'YES'
        ELSE 'NO'
    END AS "VOLATILE_ONLY_DRIFT",

    -- 6. Original Drift Guard Evaluation
    -- Original check evaluated:
    -- t_u.total_source_users = 10 AND u.users_count = 10 AND u.confirmed_users_count = 10 AND u.password_hash_count = 10
    -- AND t_i.total_source_identities = 10 AND i.identities_count = 10 AND i.email_identities_count = 10
    CASE 
        WHEN uc.matching_manifest_users_count = 10 
         AND ic.current_auth_identities_count = 10
         AND (uc.current_auth_users_count > 10 OR uc.password_hash_present_count < 10)
        THEN 'YES'
        ELSE 'NO'
    END AS "ORIGINAL_DRIFT_GUARD_OVER_SENSITIVE",

    -- 7. High-Level Classification
    CASE 
        WHEN uc.current_auth_users_count = 10 AND ic.current_auth_identities_count = 10 AND uc.missing_manifest_users_count = 0 AND uc.unexpected_users_count = 0 AND uc.password_hash_present_count = 10 AND uc.email_confirmed_users_count = 10
        THEN 'NO_DRIFT'
        WHEN uc.missing_manifest_users_count = 0 AND uc.unexpected_users_count = 0 AND uc.password_hash_present_count = 10 AND (vc.users_with_updated_at_drift > 0 OR vc.users_with_last_sign_in > 0)
        THEN 'VOLATILE_ONLY'
        WHEN uc.missing_manifest_users_count > 0 OR uc.unexpected_users_count > 0 OR ic.current_auth_identities_count != 10
        THEN 'STRUCTURAL'
        WHEN uc.password_hash_empty_count > 0
        THEN 'CREDENTIAL'
        ELSE 'UNDETERMINED'
    END AS "SOURCE_AUTH_DRIFT_CLASSIFICATION",

    -- 8. Recommended Action
    CASE 
        WHEN uc.current_auth_users_count = 10 AND ic.current_auth_identities_count = 10 AND uc.missing_manifest_users_count = 0 AND uc.unexpected_users_count = 0 AND uc.password_hash_present_count = 10 AND uc.email_confirmed_users_count = 10
        THEN 'ACCEPT_CURRENT_EXPORT'
        WHEN uc.missing_manifest_users_count = 0 AND uc.unexpected_users_count = 0 AND uc.password_hash_present_count = 10
        THEN 'ACCEPT_CURRENT_EXPORT'
        WHEN uc.unexpected_users_count > 0 OR uc.missing_manifest_users_count > 0
        THEN 'INVESTIGATE_BEFORE_MIGRATION'
        ELSE 'NO_GO'
    END AS "RECOMMENDED_ACTION"

FROM user_counts uc
CROSS JOIN identity_counts ic
CROSS JOIN user_identity_topology uit
CROSS JOIN volatile_changes_check vc;
