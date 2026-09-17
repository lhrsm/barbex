SELECT
  (SELECT count(*) FROM pg_extension WHERE extname = 'uuid-ossp') AS has_uuid_ossp,
  (SELECT count(*) FROM pg_extension WHERE extname = 'pgcrypto') AS has_pgcrypto,
  (SELECT count(*) FROM pg_extension WHERE extname = 'pg_net') AS has_pg_net,
  (SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron') AS has_pg_cron,
  (SELECT count(*) FROM pg_available_extensions WHERE name = 'uuid-ossp') AS avail_uuid_ossp,
  (SELECT count(*) FROM pg_available_extensions WHERE name = 'pgcrypto') AS avail_pgcrypto,
  (SELECT count(*) FROM pg_available_extensions WHERE name = 'pg_net') AS avail_pg_net,
  (SELECT count(*) FROM pg_available_extensions WHERE name = 'pg_cron') AS avail_pg_cron;
