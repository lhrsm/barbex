-- =====================================================================
-- BARBEX — PHASE 17C.M7D-A
-- SOURCE AUTH EXPORT TEMPLATE: auth.identities
-- TARGET: Exactly 10 Barbex Auth Identities
-- MODE: STRICTLY READ-ONLY SELECT QUERY
-- ZERO REMOTE MUTATION
-- NOTICE:
-- Excludes session-sensitive tokens.
-- Save output exclusively to secure local gitignored storage
-- (e.g. scratch/migration-secrets/source_auth_identities.json).
-- =====================================================================

SELECT 
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    email
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
ORDER BY created_at ASC;
