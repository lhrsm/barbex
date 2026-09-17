import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/SUPABASE_URL="?([^"\r\n]+)"?/);
const keyMatch = env.match(/SUPABASE_PUBLISHABLE_KEY="?([^"\r\n]+)"?/);
const client = createClient(urlMatch![1], keyMatch![1]);

async function check() {
  const t0 = Date.now();
  const { data, error } = await client.from('status_checks').select('id, service_id, status, latency_ms, success, message, checked_at').order('id', {ascending: true}).limit(1000);
  console.log('Result count:', data?.length, 'Time:', Date.now() - t0, 'ms', 'Error:', error?.message);
}
check();
