const fs = require('fs');
const { execSync } = require('child_process');

function runSql(query) {
  const result = execSync(`npx.cmd supabase db query --linked "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
  const jsonStart = result.indexOf('{\n  "boundary":');
  if (jsonStart === -1) {
    const rawStart = result.indexOf('{"boundary":');
    if (rawStart === -1) return [];
    return JSON.parse(result.slice(rawStart)).rows;
  }
  return JSON.parse(result.slice(jsonStart)).rows;
}

async function verify() {
  console.log('=== R2E.17M.3 CANONICAL DATA CUTOVER VERIFICATION ===');

  // 1. Pre-cutover snapshot comparison
  const snapshotRaw = fs.readFileSync('C:\\Users\\louis.SBPM-BA\\.gemini\\antigravity-ide\\brain\\e4086e8b-0d30-47a0-81ee-18b673f56217\\scratch\\pre_cutover_snapshot.json', 'utf8');
  const snapshot = JSON.parse(snapshotRaw);
  console.log('Loaded pre-cutover snapshot taken at:', snapshot.timestamp);

  // 2. Query Carlos Hotmail operational rows
  const hotmailTenant = '92caca5a-5174-4725-9da9-b10a9aa87104';
  const hotmailBarbers = runSql(`SELECT id, name FROM public.barbers WHERE tenant_id = '${hotmailTenant}';`);
  const hotmailServices = runSql(`SELECT id, name FROM public.services WHERE tenant_id = '${hotmailTenant}';`);
  const hotmailBarberServices = runSql(`SELECT barber_id, service_id FROM public.barber_services WHERE tenant_id = '${hotmailTenant}';`);
  const hotmailCustomers = runSql(`SELECT id, name FROM public.customers WHERE tenant_id = '${hotmailTenant}';`);
  const hotmailAppointments = runSql(`SELECT id, customer_id, barber_id, service_id, status FROM public.appointments WHERE tenant_id = '${hotmailTenant}';`);

  console.log('Carlos Hotmail Barbers:', hotmailBarbers.length, '(expected 3)');
  console.log('Carlos Hotmail Services:', hotmailServices.length, '(expected 3)');
  console.log('Carlos Hotmail Barber Services:', hotmailBarberServices.length, '(expected 9)');
  console.log('Carlos Hotmail Customers:', hotmailCustomers.length, '(expected 3)');
  console.log('Carlos Hotmail Appointments:', hotmailAppointments.length, '(expected 5)');

  if (hotmailBarbers.length !== 3 || hotmailServices.length !== 3 || hotmailBarberServices.length !== 9 || hotmailCustomers.length !== 3 || hotmailAppointments.length !== 5) {
    throw new Error('FAILED: Carlos Hotmail count invariant violated!');
  }

  // Verify primary keys matched snapshot
  const snapHotmailBarbers = snapshot.barbers.filter(b => b.tenant_id === '703dcd8f-0077-4a57-8728-be05f654bd5b');
  const snapHotmailAppts = snapshot.appointments.filter(a => a.tenant_id === '703dcd8f-0077-4a57-8728-be05f654bd5b');
  const snapHotmailCusts = snapshot.customers.filter(c => c.tenant_id === '703dcd8f-0077-4a57-8728-be05f654bd5b' || c.id === 'be33fa44-fead-4d75-985b-75b9aaf0b06e');

  const barberIdsNow = new Set(hotmailBarbers.map(b => b.id));
  const snapBarberIds = new Set(snapHotmailBarbers.map(b => b.id));
  for (const id of snapBarberIds) {
    if (!barberIdsNow.has(id)) throw new Error(`Barber PK missing: ${id}`);
  }

  const apptIdsNow = new Set(hotmailAppointments.map(a => a.id));
  const snapApptIds = new Set(snapHotmailAppts.map(a => a.id));
  for (const id of snapApptIds) {
    if (!apptIdsNow.has(id)) throw new Error(`Appointment PK missing: ${id}`);
  }

  const custIdsNow = new Set(hotmailCustomers.map(c => c.id));
  const snapCustIds = new Set(snapHotmailCusts.map(c => c.id));
  for (const id of snapCustIds) {
    if (!custIdsNow.has(id)) throw new Error(`Customer PK missing: ${id}`);
  }

  console.log('PRIMARY KEYS PRESERVED: 100% match with pre-cutover snapshot.');

  // 3. Barbearia Vip modules & loyalty
  const vipTenant = '5d57205d-3a30-4852-92ff-78e8400cb9d5';
  const vipModules = runSql(`SELECT count(*) as cnt FROM public.barbershop_modules WHERE tenant_id = '${vipTenant}';`);
  const vipLoyalty = runSql(`SELECT count(*) as cnt FROM public.loyalty_settings WHERE tenant_id = '${vipTenant}';`);
  console.log('Barbearia Vip Modules:', vipModules[0].cnt, '(expected 29)');
  console.log('Barbearia Vip Loyalty Settings:', vipLoyalty[0].cnt, '(expected 1)');
  if (vipModules[0].cnt !== 29 || vipLoyalty[0].cnt !== 1) {
    throw new Error('FAILED: Barbearia Vip modules/loyalty invariant violated!');
  }

  // 4. Orphan preservation (292134e7-4b98-49ee-84c6-b8b546ec57de)
  const orphanTenant = '292134e7-4b98-49ee-84c6-b8b546ec57de';
  const orphanModules = runSql(`SELECT count(*) as cnt FROM public.barbershop_modules WHERE tenant_id = '${orphanTenant}';`);
  const orphanLoyalty = runSql(`SELECT count(*) as cnt FROM public.loyalty_settings WHERE tenant_id = '${orphanTenant}';`);
  console.log('Historical Orphan Modules:', orphanModules[0].cnt, '(expected 29)');
  console.log('Historical Orphan Loyalty Settings:', orphanLoyalty[0].cnt, '(expected 1)');
  if (orphanModules[0].cnt !== 29 || orphanLoyalty[0].cnt !== 1) {
    throw new Error('FAILED: Orphan preservation invariant violated! Expected 30 total rows.');
  }

  // 5. Foreign key verification
  const fks = runSql(`SELECT conname, conrelid::regclass as relname, confrelid::regclass as frelname, convalidated FROM pg_constraint WHERE conname LIKE '%tenant_id_fkey' AND confrelid::regclass::text = 'barbershops';`);
  console.log('Canonical Barbershops FKs Count:', fks.length);
  fks.forEach(f => {
    console.log(` - ${f.relname}.${f.conname} -> ${f.frelname} (validated: ${f.convalidated})`);
  });

  // 6. Profiles & Memberships
  const profiles = runSql(`SELECT id, email, role, tenant_id FROM public.profiles WHERE tenant_id IS NOT NULL;`);
  console.log('Canonical profiles with tenant_id:');
  profiles.forEach(p => console.log(` - ${p.email || p.id} -> tenant_id: ${p.tenant_id} (role: ${p.role})`));

  const memberships = runSql(`SELECT tenant_id, user_id, role, status FROM public.tenant_memberships WHERE status = 'active';`);
  console.log('Active Tenant Memberships:', memberships.length);
  memberships.forEach(m => console.log(` - tenant: ${m.tenant_id} user: ${m.user_id} role: ${m.role}`));

  // 7. Verify zero legacy operational scope rows remain in business tables
  const legacyHotmailScope = '703dcd8f-0077-4a57-8728-be05f654bd5b';
  const legacyVipScope = '67d4e85a-3ed5-4109-9c9b-b83622331286';
  const checkOldHotmail = runSql(`SELECT 'appts' as t, count(*) as cnt FROM public.appointments WHERE tenant_id = '${legacyHotmailScope}' UNION ALL SELECT 'barbers', count(*) FROM public.barbers WHERE tenant_id = '${legacyHotmailScope}' UNION ALL SELECT 'custs', count(*) FROM public.customers WHERE tenant_id = '${legacyHotmailScope}' UNION ALL SELECT 'servs', count(*) FROM public.services WHERE tenant_id = '${legacyHotmailScope}';`);
  console.log('Remaining old Hotmail operational scope rows:', checkOldHotmail);
  for (const r of checkOldHotmail) {
    if (r.cnt !== 0) throw new Error(`Unexpected old hotmail scope row in ${r.t}: ${r.cnt}`);
  }

  console.log('=== ALL R2E.17M.3 DATA INVARIANTS PASS ===');
}

verify().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
