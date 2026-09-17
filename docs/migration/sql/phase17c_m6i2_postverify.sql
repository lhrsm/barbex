-- ==============================================================================
-- BARBEX — PHASE 17C.M6I.2: POST-MATERIALIZATION CATALOG VERIFICATION
-- FILE: docs/migration/sql/phase17c_m6i2_postverify.sql
-- TARGET PROJECT: ywdwrstxvsdqiryhieiz
-- MODE: 100% READ-ONLY / EVIDENCE CAPTURE / ZERO MUTATIONS
-- ==============================================================================

SELECT
  'TABLES' AS object_category,
  count(*) AS actual_count,
  159 AS expected_count,
  CASE WHEN count(*) = 159 THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'

UNION ALL

SELECT
  'VIEWS' AS object_category,
  count(*) AS actual_count,
  2 AS expected_count,
  CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.views
WHERE table_schema = 'public'

UNION ALL

SELECT
  'COLUMNS' AS object_category,
  count(*) AS actual_count,
  2211 AS expected_count,
  CASE WHEN count(*) = 2211 THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.columns
WHERE table_schema = 'public'

UNION ALL

SELECT
  'ENUM_TYPES' AS object_category,
  count(DISTINCT t.typname) AS actual_count,
  14 AS expected_count,
  CASE WHEN count(DISTINCT t.typname) = 14 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typtype = 'e'

UNION ALL

SELECT
  'ENUM_VALUES' AS object_category,
  count(e.enumlabel) AS actual_count,
  75 AS expected_count,
  CASE WHEN count(e.enumlabel) = 75 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public' AND t.typtype = 'e'

UNION ALL

SELECT
  'PRIMARY_KEYS' AS object_category,
  count(*) AS actual_count,
  159 AS expected_count,
  CASE WHEN count(*) = 159 THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND constraint_type = 'PRIMARY KEY'

UNION ALL

SELECT
  'FOREIGN_KEYS' AS object_category,
  count(*) AS actual_count,
  279 AS expected_count,
  CASE WHEN count(*) = 279 THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'

UNION ALL

SELECT
  'INDEXES' AS object_category,
  count(*) AS actual_count,
  442 AS expected_count,
  CASE WHEN count(*) = 442 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_indexes
WHERE schemaname = 'public'

UNION ALL

SELECT
  'PUBLIC_FUNCTIONS' AS object_category,
  count(*) AS actual_count,
  202 AS expected_count,
  CASE WHEN count(*) = 202 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'

UNION ALL

SELECT
  'TRIGGERS' AS object_category,
  count(*) AS actual_count,
  110 AS expected_count,
  CASE WHEN count(*) = 110 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal

UNION ALL

SELECT
  'RLS_ENABLED_TABLES' AS object_category,
  count(*) AS actual_count,
  159 AS expected_count,
  CASE WHEN count(*) = 159 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true

UNION ALL

SELECT
  'RLS_POLICIES' AS object_category,
  count(*) AS actual_count,
  394 AS expected_count,
  CASE WHEN count(*) = 394 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'

UNION ALL

SELECT
  'FORCE_RLS' AS object_category,
  count(*) AS actual_count,
  0 AS expected_count,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity = true

UNION ALL

SELECT
  'ACTIVE_CRON_JOBS' AS object_category,
  count(*) AS actual_count,
  0 AS expected_count,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM cron.job;
