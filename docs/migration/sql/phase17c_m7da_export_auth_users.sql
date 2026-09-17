-- =====================================================================
-- BARBEX — PHASE 17C.M7D-A
-- SOURCE AUTH EXPORT TEMPLATE: auth.users
-- TARGET: Exactly 10 Barbex Auth Users
-- MODE: STRICTLY READ-ONLY SELECT QUERY
-- ZERO REMOTE MUTATION
-- SENSITIVE CREDENTIAL NOTICE:
-- Do NOT execute this query into git-tracked files or public consoles.
-- The output contains encrypted_password hashes (bcrypt).
-- Save output exclusively to secure local gitignored storage
-- (e.g. scratch/migration-secrets/source_auth_users.json).
-- =====================================================================

SELECT 
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    confirmed_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
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
ORDER BY created_at ASC;
