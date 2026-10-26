'use strict';
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0;
function pass(s, d) { passed++; console.log('PASS -- ' + s + ': ' + d); }
function fail(s, d) { failed++; console.log('FAIL -- ' + s + ': ' + d); }
async function runTests() {
  console.log('BARBEX R2E.26A -- Cross-Panel Sync Test Suite');
  function check(label, file) {
    const patterns = Array.from(arguments).slice(2);
    if (!fs.existsSync(file)) { fail(label, path.basename(file) + ' nao encontrado'); return; }
    const c = fs.readFileSync(file, 'utf-8');
    const missing = patterns.filter(function(p) { return !c.includes(p); });
    if (missing.length === 0) { pass(label, path.basename(file) + ' OK'); } else { fail(label, 'faltam: ' + missing.join(', ')); }
  }
  const base = path.join(__dirname, '..');
  check('H-sync-module', base+'/src/lib/sync-appointments.ts', 'APPOINTMENT_QUERY_KEYS', 'invalidateAllAppointmentQueries', 'reception-queue', 'reception-stats', 'REFRESH_APPOINTMENTS_DATA', 'REFRESH_DASHBOARD_DATA');
  check('I-ReceptionQueue-Realtime', base+'/src/components/reception/ReceptionQueue.tsx', 'tenant-sync-', 'appointment_checkins', 'removeChannel', 'REFRESH_APPOINTMENTS_DATA', 'refetchOnWindowFocus');
  check('J-WalkinModal', base+'/src/components/calendar/WalkinModal.tsx', 'invalidateAllAppointmentQueries', 'useQueryClient');
  check('K1-reception.index', base+'/src/routes/reception.index.tsx', 'onSuccess', 'invalidateAllAppointmentQueries', 'REFRESH_APPOINTMENTS_DATA');
  check('K2-reception.agenda', base+'/src/routes/reception.agenda.tsx', 'onSuccess', 'invalidateAllAppointmentQueries', 'useQueryClient');
  check('L-AppointmentModal', base+'/src/components/calendar/AppointmentModal.tsx', 'invalidateAllAppointmentQueries');
  check('M-RescheduleWizard', base+'/src/components/reschedule/RescheduleWizard.tsx', 'invalidateAllAppointmentQueries', 'useQueryClient');
  check('N-use-appointment-status', base+'/src/hooks/use-appointment-status.ts', 'invalidateAllAppointmentQueries');
  check('O-AppointmentDetailsModal', base+'/src/components/calendar/AppointmentDetailsModal.tsx', 'invalidateAllAppointmentQueries');
  check('P-use-customer-cancellation', base+'/src/hooks/use-customer-cancellation.ts', 'invalidateAllAppointmentQueries');
  console.log('Resultado: ' + passed + ' PASS | ' + failed + ' FAIL | ' + (passed+failed) + ' total');
  return { passed: passed, failed: failed };
}
runTests().then(function(r) { process.exit(r.failed > 0 ? 1 : 0); }).catch(function(err) { console.error(err); process.exit(1); });
