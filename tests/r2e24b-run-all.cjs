/**
 * R2E.24B - CONSOLIDATED REGRESSION RUNNER
 * Executes all R2E.24B test suites in sequence:
 * 1. tests/r2e24b-payment-authorization.test.cjs
 * 2. tests/r2e24b-pix-normalization.test.cjs
 * 3. tests/r2e24b-auth-phone.test.cjs
 */

const { execSync } = require('child_process');
const path = require('path');

const suites = [
  'r2e24b-payment-authorization.test.cjs',
  'r2e24b-pix-normalization.test.cjs',
  'r2e24b-auth-phone.test.cjs'
];

console.log('====================================================');
console.log('BARBEX R2E.24B — EXECUÇÃO DE REGRESSÃO CONSOLIDADA');
console.log('====================================================\n');

let totalSuites = suites.length;
let passedSuites = 0;

for (const suite of suites) {
  const suitePath = path.join(__dirname, suite);
  console.log(`>>> Executando suíte: ${suite}...`);
  try {
    const output = execSync(`node "${suitePath}"`, { encoding: 'utf-8' });
    console.log(output);
    passedSuites++;
  } catch (err) {
    console.error(`❌ FALHA na suíte: ${suite}`);
    console.error(err.stdout || err.message);
    process.exit(1);
  }
}

console.log('====================================================');
console.log(`STATUS FINAL DE TESTES: ${passedSuites}/${totalSuites} SUÍTES APROVADAS COM SUCESSO!`);
console.log('====================================================');
