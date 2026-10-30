const { execSync } = require('child_process');
const fs = require('fs');

const sql = "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261030090000') ON CONFLICT (version) DO NOTHING;";
fs.writeFileSync('scripts/temp_record_mig_r2e26e20b11.sql', sql);
try {
  const out = execSync('npx.cmd supabase db query --linked -f scripts/temp_record_mig_r2e26e20b11.sql', { encoding: 'utf8' });
  console.log('MIGRATION 20261030090000 RECORDED:');
  console.log(out);
} finally {
  if (fs.existsSync('scripts/temp_record_mig_r2e26e20b11.sql')) fs.unlinkSync('scripts/temp_record_mig_r2e26e20b11.sql');
}
