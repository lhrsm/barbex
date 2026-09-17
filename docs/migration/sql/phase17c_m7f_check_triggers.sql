SELECT 
  count(*) as raw_total,
  count(*) FILTER (WHERE t.tgisinternal = true) as internal_triggers,
  count(*) FILTER (WHERE t.tgisinternal = false) as non_internal_triggers
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public';
