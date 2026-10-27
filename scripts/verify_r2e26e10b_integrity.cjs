const { execSync } = require('child_process');
const fs = require('fs');

function runLinkedQuery(sql) {
  const tempFile = `scripts/temp_integ_${Date.now()}.sql`;
  fs.writeFileSync(tempFile, sql, 'utf8');
  try {
    const out = execSync(`npx.cmd supabase db query --linked --file "${tempFile}"`, { encoding: 'utf8' });
    return JSON.parse(out);
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

async function verifyIntegrity() {
  console.log('================================================================');
  console.log('BARBEX R2E.26E.10B — GATE 5: VERIFICAÇÃO DE INTEGRIDADE');
  console.log('================================================================\n');

  const sql = `
    SELECT 
      (SELECT count(*) FROM public.tenant_memberships) as memberships_count,
      (SELECT count(*) FROM public.tenant_memberships WHERE role = 'reception') as reception_count,
      (SELECT count(*) FROM public.tenant_memberships WHERE role = 'financial') as financial_count,
      (SELECT count(*) FROM public.tenant_memberships WHERE role = 'barber') as barber_memberships_count,
      (SELECT count(*) FROM public.tenant_memberships WHERE role = 'admin' OR role = 'tenant_admin') as admin_memberships_count,
      (SELECT count(*) FROM public.barber_commissions WHERE status = 'pending') as pending_commissions_count,
      (SELECT coalesce(sum(commission_amount), 0) FROM public.barber_commissions WHERE status = 'pending') as pending_sum,
      (SELECT count(*) FROM public.transactions) as transactions_count,
      (SELECT count(*) FROM public.team_role_audit_logs) as audit_logs_count,
      (SELECT count(*) FROM public.saas_admin_vouchers) as vouchers_count,
      (SELECT count(*) FROM public.subscriptions) as subscriptions_count;
  `;

  const res = runLinkedQuery(sql);
  const row = (res.rows || res)[0];

  console.log('Métricas Consolidadas de Produção Pós-Cutover:');
  console.log(`- tenant_memberships total: ${row.memberships_count} (Esperado: 6)`);
  console.log(`  * reception: ${row.reception_count} (Esperado: 2)`);
  console.log(`  * financial: ${row.financial_count} (Esperado: 0)`);
  console.log(`  * barber: ${row.barber_memberships_count} (Esperado: 2)`);
  console.log(`  * admin/tenant_admin: ${row.admin_memberships_count} (Esperado: 2)`);
  console.log(`- comissões pendentes: ${row.pending_commissions_count} (Esperado: 6)`);
  console.log(`- soma comissões pendentes: R$ ${Number(row.pending_sum).toFixed(2)} (Esperado: R$ 125.00)`);
  console.log(`- transactions: ${row.transactions_count} (Esperado: 7)`);
  console.log(`- audit_logs: ${row.audit_logs_count} (Esperado: 0)`);
  console.log(`- vouchers: ${row.vouchers_count}`);
  console.log(`- subscriptions: ${row.subscriptions_count}`);

  const errors = [];
  if (Number(row.memberships_count) !== 6) errors.push(`memberships_count diferente: ${row.memberships_count}`);
  if (Number(row.reception_count) !== 2) errors.push(`reception_count alterado: ${row.reception_count}`);
  if (Number(row.financial_count) !== 0) errors.push(`financial_count alterado: ${row.financial_count}`);
  if (Number(row.pending_commissions_count) !== 6) errors.push(`pending_commissions_count diferente: ${row.pending_commissions_count}`);
  if (Number(row.pending_sum) !== 125.00) errors.push(`pending_sum diferente: ${row.pending_sum}`);
  if (Number(row.transactions_count) !== 7) errors.push(`transactions_count diferente: ${row.transactions_count}`);
  if (Number(row.audit_logs_count) !== 0) errors.push(`audit_logs_count diferente: ${row.audit_logs_count}`);

  if (errors.length > 0) {
    console.error('\nFATAL: Divergências de integridade detectadas:', errors);
    process.exit(1);
  }

  console.log('\n>>> GATE 5 APROVADO: 100% dos dados e invariantes permanecem intactos!');
}

verifyIntegrity().catch(err => {
  console.error('Falha na verificação de integridade:', err);
  process.exit(1);
});
