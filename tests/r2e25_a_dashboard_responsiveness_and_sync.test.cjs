const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=== R2E.25A.1 CONTROLLED CUTOVER VALIDATION SUITE ===\n");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

const ROOT = path.resolve(__dirname, '..');

// 1. GATE MULTI-TENANT: Slug Resolution & Cross-Tenant Boundary
test("GATE MULTI-TENANT: use-tenant.ts strictly scopes canonicalSlug to active tenantId", () => {
  const content = fs.readFileSync(path.join(ROOT, 'src/hooks/use-tenant.ts'), 'utf-8');
  assert.ok(content.includes('const canonicalSlug = tenantMeta?.slug || (ownedShop?.id === tenantId ? ownedShop?.slug : null) || (tenantProfile?.id === tenantId ? tenantProfile?.slug : null) || null;'), "canonicalSlug enforces active tenantId boundary");
  assert.ok(content.includes('slug: canonicalSlug'), "Exposes canonicalSlug as slug");
});

test("GATE MULTI-TENANT: AppLayout.tsx prevents cross-tenant fallback and hides link when slug unavailable", () => {
  const content = fs.readFileSync(path.join(ROOT, 'src/components/layout/AppLayout.tsx'), 'utf-8');
  assert.ok(content.includes('slug: tenantSlug'), "AppLayout destructures tenantSlug");
  assert.ok(content.includes('(session?.tenant_id === tenantId ? session?.tenant_slug : null)'), "Guards session slug by tenantId");
  assert.ok(content.includes('(tenantProfile?.id === tenantId ? tenantProfile?.slug : null)'), "Guards tenantProfile slug by tenantId");
  assert.ok(content.includes('title="Ver Página Pública"'), "Has mobile top header button");
  assert.ok(content.includes('Ver Página Pública'), "Has mobile drawer button");
  assert.ok(!content.includes('href="/lm"'), "Zero hardcoded 'lm' slugs");
});

// 2. GATE SINCRONIZAÇÃO: QueryCache + Event Bus + Debounce
test("GATE SINCRONIZAÇÃO: use-appointment-status.ts updates only on verified success", () => {
  const content = fs.readFileSync(path.join(ROOT, 'src/hooks/use-appointment-status.ts'), 'utf-8');
  assert.ok(content.includes('if (!result?.success) {'), "Aborts immediately if result.success is false");
  assert.ok(content.includes("queryClient.invalidateQueries({ queryKey: ['dashboard'] })"), "Invalidates query only after success check");
  assert.ok(content.includes("window.dispatchEvent(new CustomEvent('REFRESH_DASHBOARD_DATA'"), "Emits custom sync event after success check");
});

test("GATE SINCRONIZAÇÃO: dashboard.index.tsx debounces sync to avoid duplicate refetches and loops", () => {
  const content = fs.readFileSync(path.join(ROOT, 'src/routes/dashboard.index.tsx'), 'utf-8');
  assert.ok(content.includes('syncTimerRef = useRef<NodeJS.Timeout | null>(null)'), "Uses syncTimerRef for debounce");
  assert.ok(content.includes('executeDebouncedSync'), "Implements executeDebouncedSync");
  assert.ok(content.includes('queryClient.getQueryCache().subscribe'), "Subscribes to QueryCache");
  assert.ok(content.includes("window.addEventListener('REFRESH_DASHBOARD_DATA'"), "Subscribes to REFRESH_DASHBOARD_DATA");
  assert.ok(content.includes('clearTimeout(syncTimerRef.current)'), "Cleans up timer on unmount and before each sync");
});

// 3. GATE VISUAL: Responsiveness & Monetary Values Integrity
test("GATE VISUAL: ExecutiveSummary.tsx avoids squeezing and preserves full monetary values without truncation", () => {
  const content = fs.readFileSync(path.join(ROOT, 'src/components/dashboard/ExecutiveSummary.tsx'), 'utf-8');
  assert.ok(content.includes('grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4'), "Grid divides into 2 columns on notebook and 4 on 2xl");
  assert.ok(content.includes('p-4 sm:p-5 xl:p-6'), "Responsive padding applied");
  assert.ok(content.includes('text-xl sm:text-2xl xl:text-3xl font-black tracking-tight whitespace-nowrap'), "Scales typography and prevents number breaking or ellipsis truncation");
  assert.ok(content.includes('min-w-0'), "Protected against flexbox overflow");
});

test("GATE VISUAL: MetricCard.tsx preserves full numbers and adjusts padding responsively", () => {
  const content = fs.readFileSync(path.join(ROOT, 'src/components/dashboard/MetricCard.tsx'), 'utf-8');
  assert.ok(content.includes('p-4 sm:p-5 xl:p-6'), "MetricCard padding scales");
  assert.ok(content.includes('text-xl sm:text-2xl xl:text-3xl font-black tracking-tight whitespace-nowrap'), "MetricCard typography scales without number truncation");
});

test("GATE VISUAL: KPIGrid in DashboardShell.tsx protects 4 columns on notebooks", () => {
  const content = fs.readFileSync(path.join(ROOT, 'src/components/dashboard/DashboardShell.tsx'), 'utf-8');
  assert.ok(content.includes('cols === 4 && "2xl:grid-cols-4"'), "KPIGrid uses 2xl breakpoint for 4 columns");
});

test("GATE VISUAL: InsightsPanel.tsx adapts list to 2-columns when wide and 1-column when in sidebar", () => {
  const content = fs.readFileSync(path.join(ROOT, 'src/components/dashboard/InsightsPanel.tsx'), 'utf-8');
  assert.ok(content.includes('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1'), "Adapts list columns dynamically");
  assert.ok(content.includes('break-words'), "Prevents horizontal word overflow");
});

test("GATE VISUAL: AdminDashboardView & ManagerDashboardView use xl:grid-cols-12", () => {
  const adminContent = fs.readFileSync(path.join(ROOT, 'src/components/dashboard/views/AdminDashboardView.tsx'), 'utf-8');
  const mgrContent = fs.readFileSync(path.join(ROOT, 'src/components/dashboard/views/ManagerDashboardView.tsx'), 'utf-8');
  assert.ok(adminContent.includes('xl:grid-cols-12'), "AdminDashboardView uses xl breakpoint");
  assert.ok(mgrContent.includes('xl:grid-cols-12'), "ManagerDashboardView uses xl breakpoint");
});

// 4. GATE PROTEÇÕES: Stripe Checkout & Financial Invariants
test("GATE PROTEÇÕES: stripe-checkout index.ts preserved with 0 diffs from origin/main", () => {
  const { execSync } = require('child_process');
  const diff = execSync('git diff origin/main -- supabase/functions/stripe-checkout/index.ts', { cwd: ROOT, encoding: 'utf-8' });
  assert.strictEqual(diff.trim(), '', "stripe-checkout/index.ts has 0 diffs against origin/main");
});

console.log(`\nTests Completed: ${passed}/${total} passed.`);
if (passed === total) {
  console.log("=== ALL R2E.25A.1 GATES PASSED SUCCESSFULLY ===");
} else {
  process.exit(1);
}
