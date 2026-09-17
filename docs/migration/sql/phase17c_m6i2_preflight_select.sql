SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS public_tables,
  (SELECT count(*) FROM information_schema.views WHERE table_schema = 'public') AS public_views,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public') AS public_functions,
  (SELECT count(*) FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public') AS public_policies,
  (SELECT count(*) FROM auth.users) AS auth_users,
  (SELECT count(*) FROM storage.buckets) AS storage_buckets,
  (SELECT count(*) FROM storage.objects) AS storage_objects;
