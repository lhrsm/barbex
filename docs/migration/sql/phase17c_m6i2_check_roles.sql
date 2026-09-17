-- ==============================================================================
-- BARBEX — TARGET DATABASE ROLE EXISTENCE PREFLIGHT
-- FILE: docs/migration/sql/phase17c_m6i2_check_roles.sql
-- MODE: 100% READ-ONLY PREFLIGHT ASSERTION
-- ==============================================================================

DO $$
DECLARE
  v_missing_roles text[];
  v_required_roles text[] := ARRAY['postgres', 'anon', 'authenticated', 'service_role'];
BEGIN
  SELECT array_agg(r) INTO v_missing_roles
  FROM unnest(v_required_roles) r
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);

  IF v_missing_roles IS NOT NULL AND array_length(v_missing_roles, 1) > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_FAIL: Required database roles missing on Target: %', v_missing_roles;
  ELSE
    RAISE NOTICE 'PREFLIGHT_PASS: All required baseline database roles exist on Target: %', v_required_roles;
  END IF;
END $$;

SELECT
  r.rolname,
  r.rolcanlogin,
  r.rolsuper
FROM pg_roles r
WHERE r.rolname IN ('postgres', 'anon', 'authenticated', 'service_role')
ORDER BY r.rolname;
