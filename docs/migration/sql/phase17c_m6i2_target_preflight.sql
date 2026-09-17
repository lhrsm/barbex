-- ==============================================================================
-- BARBEX — PHASE 17C.M6I.2: TARGET PRE-MATERIALIZATION PREFLIGHT VERIFICATION
-- FILE: docs/migration/sql/phase17c_m6i2_target_preflight.sql
-- TARGET PROJECT: ywdwrstxvsdqiryhieiz
-- MODE: 100% READ-ONLY / FORENSIC PRE-FLIGHT / ZERO WRITES
-- ==============================================================================

DO $$
DECLARE
  v_current_db text := current_database();
  v_current_user text := current_user;
  v_pg_version text := version();
  
  v_public_tables int;
  v_public_views int;
  v_public_functions int;
  v_public_triggers int;
  v_public_policies int;
  v_public_enums int;
  
  v_auth_users int := 0;
  v_storage_buckets int := 0;
  v_storage_objects int := 0;
  v_schema_migrations int := 0;
  v_cron_jobs int := 0;
  
  v_auth_schema boolean;
  v_storage_schema boolean;
  v_realtime_schema boolean;
  v_extensions_schema boolean;
  v_vault_schema boolean;
  v_cron_schema boolean;
  v_net_schema boolean;
  
  v_ext_uuid boolean;
  v_ext_pgcrypto boolean;
  v_ext_pg_net boolean;
  v_ext_pg_cron boolean;
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'BARBEX M6I.2 PRE-MATERIALIZATION PREFLIGHT AUDIT';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'DATABASE: % | USER: %', v_current_db, v_current_user;
  RAISE NOTICE 'VERSION:  %', v_pg_version;

  -- 1. PUBLIC SCHEMA OBJECTS
  SELECT count(*) INTO v_public_tables
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  SELECT count(*) INTO v_public_views
  FROM information_schema.views
  WHERE table_schema = 'public';

  SELECT count(*) INTO v_public_functions
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public';

  SELECT count(*) INTO v_public_triggers
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal;

  SELECT count(*) INTO v_public_policies
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public';

  SELECT count(*) INTO v_public_enums
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typtype = 'e';

  RAISE NOTICE 'PUBLIC SCHEMA OBJECTS:';
  RAISE NOTICE '  Tables:     %', v_public_tables;
  RAISE NOTICE '  Views:      %', v_public_views;
  RAISE NOTICE '  Functions:  %', v_public_functions;
  RAISE NOTICE '  Triggers:   %', v_public_triggers;
  RAISE NOTICE '  Policies:   %', v_public_policies;
  RAISE NOTICE '  Enums:      %', v_public_enums;

  -- 2. AUTH & STORAGE
  BEGIN
    SELECT count(*) INTO v_auth_users FROM auth.users;
  EXCEPTION WHEN OTHERS THEN
    v_auth_users := -1;
  END;

  BEGIN
    SELECT count(*) INTO v_storage_buckets FROM storage.buckets;
    SELECT count(*) INTO v_storage_objects FROM storage.objects;
  EXCEPTION WHEN OTHERS THEN
    v_storage_buckets := -1;
    v_storage_objects := -1;
  END;

  BEGIN
    SELECT count(*) INTO v_schema_migrations FROM supabase_migrations.schema_migrations;
  EXCEPTION WHEN OTHERS THEN
    v_schema_migrations := 0;
  END;

  BEGIN
    SELECT count(*) INTO v_cron_jobs FROM cron.job;
  EXCEPTION WHEN OTHERS THEN
    v_cron_jobs := 0;
  END;

  RAISE NOTICE 'PLATFORM STATE:';
  RAISE NOTICE '  auth.users:        %', v_auth_users;
  RAISE NOTICE '  storage.buckets:   %', v_storage_buckets;
  RAISE NOTICE '  storage.objects:   %', v_storage_objects;
  RAISE NOTICE '  schema_migrations: %', v_schema_migrations;
  RAISE NOTICE '  cron.job:          %', v_cron_jobs;

  -- 3. SCHEMAS
  SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'auth') INTO v_auth_schema;
  SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'storage') INTO v_storage_schema;
  SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'realtime') INTO v_realtime_schema;
  SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') INTO v_extensions_schema;
  SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'vault') INTO v_vault_schema;
  SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'cron') INTO v_cron_schema;
  SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'net') INTO v_net_schema;

  RAISE NOTICE 'SCHEMAS: auth=%, storage=%, realtime=%, extensions=%, vault=%, cron=%, net=%',
    v_auth_schema, v_storage_schema, v_realtime_schema, v_extensions_schema, v_vault_schema, v_cron_schema, v_net_schema;

  -- 4. EXTENSIONS AVAILABLE / INSTALLED
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') INTO v_ext_uuid;
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') INTO v_ext_pgcrypto;
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net') INTO v_ext_pg_net;
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO v_ext_pg_cron;

  RAISE NOTICE 'INSTALLED EXTENSIONS: uuid-ossp=%, pgcrypto=%, pg_net=%, pg_cron=%',
    v_ext_uuid, v_ext_pgcrypto, v_ext_pg_net, v_ext_pg_cron;

  -- PREFLIGHT VERDICT
  IF v_public_tables = 0 AND v_public_views = 0 THEN
    RAISE NOTICE '[PREFLIGHT PASS] Target public schema is clean for bootstrap.';
  ELSE
    RAISE WARNING '[PREFLIGHT DRIFT] Target contains existing public objects. Manual review required.';
  END IF;
END;
$$;
