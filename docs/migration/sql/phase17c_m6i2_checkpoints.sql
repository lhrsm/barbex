-- ==============================================================================
-- BARBEX — PHASE 17C.M6I.2: MATERIALIZATION CHECKPOINTS (CP0–CP10)
-- FILE: docs/migration/sql/phase17c_m6i2_checkpoints.sql
-- MODE: 100% READ-ONLY / ASSERTION QUERIES / ZERO WRITES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- CP0: TARGET VERIFIED EMPTY (Pre-Bootstrap)
-- ------------------------------------------------------------------------------
SELECT
  'CP0' AS checkpoint,
  (count(*) = 0) AS passed,
  count(*) AS actual_tables,
  0 AS expected_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- ------------------------------------------------------------------------------
-- CP1: EXTENSIONS READY
-- ------------------------------------------------------------------------------
SELECT
  'CP1' AS checkpoint,
  (count(*) >= 4) AS passed,
  count(*) AS installed_count,
  4 AS expected_count
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_net', 'pg_cron');

-- ------------------------------------------------------------------------------
-- CP2: TYPES READY
-- ------------------------------------------------------------------------------
SELECT
  'CP2' AS checkpoint,
  (count(DISTINCT t.typname) = 14 AND count(e.enumlabel) = 75) AS passed,
  count(DISTINCT t.typname) AS actual_enums,
  14 AS expected_enums,
  count(e.enumlabel) AS actual_values,
  75 AS expected_values
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
LEFT JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public' AND t.typtype = 'e';

-- ------------------------------------------------------------------------------
-- CP3: TABLES READY
-- ------------------------------------------------------------------------------
SELECT
  'CP3' AS checkpoint,
  (count(*) = 159) AS passed,
  count(*) AS actual_tables,
  159 AS expected_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- ------------------------------------------------------------------------------
-- CP4: CONSTRAINTS READY (PK, FK, Indexes)
-- ------------------------------------------------------------------------------
WITH pks AS (
  SELECT count(*) AS pk_count
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND constraint_type = 'PRIMARY KEY'
),
fks AS (
  SELECT count(*) AS fk_count
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'
),
idxs AS (
  SELECT count(*) AS idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
)
SELECT
  'CP4' AS checkpoint,
  (pk_count = 159 AND fk_count = 279 AND idx_count = 442) AS passed,
  pk_count, 159 AS exp_pks,
  fk_count, 279 AS exp_fks,
  idx_count, 442 AS exp_idxs
FROM pks, fks, idxs;

-- ------------------------------------------------------------------------------
-- CP5: FUNCTIONS READY
-- ------------------------------------------------------------------------------
SELECT
  'CP5' AS checkpoint,
  (count(*) = 202) AS passed,
  count(*) AS actual_functions,
  202 AS expected_functions
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';

-- ------------------------------------------------------------------------------
-- CP6: TRIGGERS READY
-- ------------------------------------------------------------------------------
SELECT
  'CP6' AS checkpoint,
  (count(*) = 110) AS passed,
  count(*) AS actual_triggers,
  110 AS expected_triggers
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal;

-- ------------------------------------------------------------------------------
-- CP7: RLS READY (159/159 Tables)
-- ------------------------------------------------------------------------------
SELECT
  'CP7' AS checkpoint,
  (count(*) = 159) AS passed,
  count(*) AS actual_rls_tables,
  159 AS expected_rls_tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true;

-- ------------------------------------------------------------------------------
-- CP8: POLICIES READY
-- ------------------------------------------------------------------------------
SELECT
  'CP8' AS checkpoint,
  (count(*) = 394) AS passed,
  count(*) AS actual_policies,
  394 AS expected_policies
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public';

-- ------------------------------------------------------------------------------
-- CP9: VIEWS READY
-- ------------------------------------------------------------------------------
SELECT
  'CP9' AS checkpoint,
  (count(*) = 2) AS passed,
  count(*) AS actual_views,
  2 AS expected_views
FROM information_schema.views
WHERE table_schema = 'public';

-- ------------------------------------------------------------------------------
-- CP10: FULL CANONICAL VERIFY PASS (Data Zero & Cron Zero Proof)
-- ------------------------------------------------------------------------------
WITH zero_counts AS (
  SELECT
    (SELECT count(*) FROM auth.users) AS users_cnt,
    (SELECT count(*) FROM storage.objects) AS objects_cnt,
    (SELECT count(*) FROM cron.job) AS jobs_cnt
)
SELECT
  'CP10' AS checkpoint,
  (users_cnt = 0 AND objects_cnt = 0 AND jobs_cnt = 0) AS passed,
  users_cnt AS auth_users,
  objects_cnt AS storage_objects,
  jobs_cnt AS cron_jobs
FROM zero_counts;
