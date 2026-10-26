'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TESTE ESPECÍFICO R2E.26A.4H — VERIFICAÇÃO DE USECALLBACK ===');

const root = path.resolve(__dirname, '..');

// 1. Verificar dashboard.index.tsx
const dashPath = path.join(root, 'src', 'routes', 'dashboard.index.tsx');
const dashContent = fs.readFileSync(dashPath, 'utf8');

assert(
  /import\s+[^;]*\buseCallback\b[^;]*from\s+["']react["']/.test(dashContent),
  'dashboard.index.tsx DEVE importar useCallback de "react"'
);
console.log('PASS: dashboard.index.tsx importa useCallback corretamente.');

// 2. Verificar calendar.tsx
const calPath = path.join(root, 'src', 'routes', 'calendar.tsx');
const calContent = fs.readFileSync(calPath, 'utf8');

assert(
  /import\s+[^;]*\buseCallback\b[^;]*from\s+["']react["']/.test(calContent),
  'calendar.tsx DEVE importar useCallback de "react"'
);
console.log('PASS: calendar.tsx importa useCallback corretamente.');

// 3. Auditoria exaustiva em todo o diretório src/
const files = fs.readdirSync(path.join(root, 'src'), { recursive: true })
  .filter(f => typeof f === 'string' && (f.endsWith('.tsx') || f.endsWith('.ts')))
  .map(f => path.join(root, 'src', f.replace(/\\/g, '/')));

const hooks = ['useCallback', 'useMemo', 'useState', 'useEffect', 'useRef'];
const missingReport = [];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const hook of hooks) {
    const hookUsage = new RegExp('\\b' + hook + '\\s*[(<]').test(content);
    if (hookUsage) {
      const importLines = content.split('\n').filter(l => l.includes('import') && l.includes('react'));
      const hasImport = importLines.some(l => new RegExp('\\b' + hook + '\\b').test(l));
      const hasReactDot = content.includes('React.' + hook);
      if (!hasImport && !hasReactDot) {
        missingReport.push({ file: path.relative(root, file), hook });
      }
    }
  }
}

assert.strictEqual(
  missingReport.length,
  0,
  `Hooks com import faltando encontrados: ${JSON.stringify(missingReport)}`
);
console.log('PASS: 0 hooks com imports faltantes em todo o src/.');

console.log('RESULTADO: TODOS OS TESTES ESPECÍFICOS R2E.26A.4H APROVADOS.');
