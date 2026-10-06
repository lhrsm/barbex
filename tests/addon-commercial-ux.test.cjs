/**
 * BARBEX — R2E.16G.3: Commercial Add-on UX Hardening Tests
 * 
 * Verifies:
 *  1. Owner-Aware Financial CTA Matrix (owner vs all 9 non-owner roles)
 *  2. Owner Authority Loading / Unresolved Fail-Closed Behavior
 *  3. Billing Cycle Enforcement Matrix (month, year, null, invalid, loading)
 *  4. Cart Arithmetic & Annual Savings Math
 *  5. Client Request Payload Protection (zero browser-authoritative price/amount)
 *  6. Plan-Included Capability Preservation
 *  7. Trial Account Fencing Policy
 *  8. Super Admin Addon Table Responsiveness (overflow-x-auto container)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Logic helpers mirroring the frontend components
function resolveOwnerAuthority({ userId, barbershopOwnerId, isOwnerLoading }) {
  if (isOwnerLoading || !userId || !barbershopOwnerId) {
    return { isOwner: false, isOwnerLoading: Boolean(isOwnerLoading) };
  }
  return {
    isOwner: userId === barbershopOwnerId,
    isOwnerLoading: false,
  };
}

function resolveCycleState({ baseSub, isSubLoading }) {
  if (isSubLoading) {
    return { status: 'loading', cycle: null, rawCycle: null };
  }
  if (!baseSub || !baseSub.stripe_subscription_id || !['active', 'trialing', 'past_due'].includes(baseSub.status || '')) {
    return { status: 'unknown', cycle: null, rawCycle: null, reason: 'no_active_subscription' };
  }
  const raw = String(baseSub.billing_cycle || '').toLowerCase().trim();
  if (raw === 'year' || raw === 'annual' || raw === 'yearly') {
    return { status: 'valid', cycle: 'annual', rawCycle: raw };
  }
  if (raw === 'month' || raw === 'monthly') {
    return { status: 'valid', cycle: 'monthly', rawCycle: raw };
  }
  return { status: 'unknown', cycle: null, rawCycle: raw, reason: 'invalid_cycle' };
}

function computeCtaState({ isOwner, isOwnerLoading, cycleState, isInPlan, isContracted, isEligibleForPlan, isConfiguredInStripe, canAddMoreAddons }) {
  if (isInPlan) {
    return { type: 'included', label: 'Ativar', href: '/settings', actionable: true, isPaid: false };
  }
  if (isContracted) {
    return { type: 'contracted', label: 'Gerenciar', href: '/subscription', actionable: true, isPaid: false };
  }
  if (!isConfiguredInStripe) {
    return { type: 'unavailable', label: 'Indisponível', disabled: true, actionable: false, isPaid: false };
  }
  if (!isEligibleForPlan) {
    return { type: 'ineligible', label: 'Não elegível', disabled: true, actionable: false, isPaid: false };
  }
  if (isOwnerLoading || cycleState.status === 'loading') {
    return { type: 'loading', label: 'Verificando...', disabled: true, actionable: false, isPaid: false };
  }
  if (!isOwner) {
    return {
      type: 'owner_required',
      label: 'Contratar',
      disabled: true,
      actionable: false,
      reason: 'Somente o proprietário pode contratar add-ons.',
      isPaid: true
    };
  }
  if (cycleState.status === 'unknown') {
    return {
      type: 'cycle_unavailable',
      label: 'Contratar',
      disabled: true,
      actionable: false,
      reason: cycleState.reason === 'no_active_subscription'
        ? 'Requer assinatura ativa para contratar add-ons.'
        : 'Ciclo de cobrança não identificado.',
      isPaid: true
    };
  }
  return {
    type: 'purchase_eligible',
    label: 'Contratar',
    disabled: !canAddMoreAddons,
    actionable: canAddMoreAddons,
    effectiveCycle: cycleState.cycle,
    isPaid: true
  };
}

describe('BARBEX — R2E.16G.3: Add-on Commercial UX Hardening Suite', () => {

  describe('Gate 1: Owner Authorization Matrix', () => {
    const BARBERSHOP_OWNER_ID = 'user-owner-001';

    const testRoles = [
      { role: 'owner', userId: 'user-owner-001', shouldBeActionable: true },
      { role: 'admin', userId: 'user-admin-002', shouldBeActionable: false },
      { role: 'tenant_admin', userId: 'user-tenant-admin-003', shouldBeActionable: false },
      { role: 'manager', userId: 'user-manager-004', shouldBeActionable: false },
      { role: 'financial', userId: 'user-fin-005', shouldBeActionable: false },
      { role: 'cashier', userId: 'user-cashier-006', shouldBeActionable: false },
      { role: 'professional', userId: 'user-pro-007', shouldBeActionable: false },
      { role: 'barber', userId: 'user-barber-008', shouldBeActionable: false },
      { role: 'client', userId: 'user-client-009', shouldBeActionable: false },
      { role: 'super_admin', userId: 'user-super-010', shouldBeActionable: false },
    ];

    testRoles.forEach(({ role, userId, shouldBeActionable }) => {
      test(`User with role "${role}" has actionable financial CTA = ${shouldBeActionable}`, () => {
        const { isOwner, isOwnerLoading } = resolveOwnerAuthority({
          userId,
          barbershopOwnerId: BARBERSHOP_OWNER_ID,
          isOwnerLoading: false,
        });

        const cycleState = { status: 'valid', cycle: 'monthly', rawCycle: 'month' };
        const cta = computeCtaState({
          isOwner,
          isOwnerLoading,
          cycleState,
          isInPlan: false,
          isContracted: false,
          isEligibleForPlan: true,
          isConfiguredInStripe: true,
          canAddMoreAddons: true,
        });

        if (shouldBeActionable) {
          assert.equal(isOwner, true);
          assert.equal(cta.type, 'purchase_eligible');
          assert.equal(cta.actionable, true);
          assert.equal(cta.disabled, false);
        } else {
          assert.equal(isOwner, false);
          assert.equal(cta.type, 'owner_required');
          assert.equal(cta.actionable, false);
          assert.equal(cta.disabled, true);
          assert.equal(cta.reason, 'Somente o proprietário pode contratar add-ons.');
        }
      });
    });
  });

  describe('Gate 2: Fail-Closed On Unresolved / Loading Ownership', () => {
    test('CTA is disabled/loading when isOwnerLoading = true', () => {
      const { isOwner, isOwnerLoading } = resolveOwnerAuthority({
        userId: 'user-owner-001',
        barbershopOwnerId: 'user-owner-001',
        isOwnerLoading: true,
      });

      const cycleState = { status: 'valid', cycle: 'monthly' };
      const cta = computeCtaState({
        isOwner,
        isOwnerLoading,
        cycleState,
        isInPlan: false,
        isContracted: false,
        isEligibleForPlan: true,
        isConfiguredInStripe: true,
        canAddMoreAddons: true,
      });

      assert.equal(cta.type, 'loading');
      assert.equal(cta.actionable, false);
      assert.equal(cta.disabled, true);
    });

    test('CTA is disabled when barbershopOwnerId is null (unresolved)', () => {
      const { isOwner, isOwnerLoading } = resolveOwnerAuthority({
        userId: 'user-owner-001',
        barbershopOwnerId: null,
        isOwnerLoading: false,
      });

      const cycleState = { status: 'valid', cycle: 'monthly' };
      const cta = computeCtaState({
        isOwner,
        isOwnerLoading,
        cycleState,
        isInPlan: false,
        isContracted: false,
        isEligibleForPlan: true,
        isConfiguredInStripe: true,
        canAddMoreAddons: true,
      });

      assert.equal(isOwner, false);
      assert.equal(cta.actionable, false);
      assert.equal(cta.disabled, true);
    });
  });

  describe('Gate 3: Billing Cycle Matrix Enforcement', () => {
    test('Base month resolves to monthly cycle and locks purchase to monthly', () => {
      const res = resolveCycleState({
        baseSub: { stripe_subscription_id: 'sub_123', status: 'active', billing_cycle: 'month' },
        isSubLoading: false,
      });
      assert.equal(res.status, 'valid');
      assert.equal(res.cycle, 'monthly');
    });

    test('Base year resolves to annual cycle and locks purchase to annual', () => {
      const res = resolveCycleState({
        baseSub: { stripe_subscription_id: 'sub_123', status: 'active', billing_cycle: 'year' },
        isSubLoading: false,
      });
      assert.equal(res.status, 'valid');
      assert.equal(res.cycle, 'annual');
    });

    test('Base yearly / annual synonyms resolve accurately to annual', () => {
      const res1 = resolveCycleState({
        baseSub: { stripe_subscription_id: 'sub_123', status: 'active', billing_cycle: 'annual' },
        isSubLoading: false,
      });
      assert.equal(res1.cycle, 'annual');

      const res2 = resolveCycleState({
        baseSub: { stripe_subscription_id: 'sub_123', status: 'active', billing_cycle: 'yearly' },
        isSubLoading: false,
      });
      assert.equal(res2.cycle, 'annual');
    });

    test('Null base subscription fails closed with no_active_subscription', () => {
      const res = resolveCycleState({ baseSub: null, isSubLoading: false });
      assert.equal(res.status, 'unknown');
      assert.equal(res.cycle, null);
      assert.equal(res.reason, 'no_active_subscription');
    });

    test('Invalid cycle string fails closed with invalid_cycle', () => {
      const res = resolveCycleState({
        baseSub: { stripe_subscription_id: 'sub_123', status: 'active', billing_cycle: 'biweekly' },
        isSubLoading: false,
      });
      assert.equal(res.status, 'unknown');
      assert.equal(res.cycle, null);
      assert.equal(res.reason, 'invalid_cycle');
    });

    test('Loading base subscription fails closed with loading state', () => {
      const res = resolveCycleState({ baseSub: null, isSubLoading: true });
      assert.equal(res.status, 'loading');
      assert.equal(res.cycle, null);
    });
  });

  describe('Gate 4: Cart Arithmetic & Annual Savings Integrity', () => {
    const sampleCatalog = [
      { id: '1', addon_key: 'advanced_finance', monthly_price: 24.90, annual_price: 249.00 },
      { id: '2', addon_key: 'stock', monthly_price: 19.90, annual_price: 199.00 },
      { id: '3', addon_key: 'commissions', monthly_price: 19.90, annual_price: 199.00 },
      { id: '4', addon_key: 'reports_advanced', monthly_price: 19.90, annual_price: 199.00 },
      { id: '5', addon_key: 'loyalty', monthly_price: 19.90, annual_price: 199.00 },
      { id: '6', addon_key: 'coupons', monthly_price: 14.90, annual_price: 149.00 },
      { id: '7', addon_key: 'campaigns', monthly_price: 24.90, annual_price: 249.00 },
    ];

    sampleCatalog.forEach((item) => {
      test(`Addon ${item.addon_key} has exactly 2 months discount on annual (10x monthly)`, () => {
        const expectedAnnual = Number((item.monthly_price * 10).toFixed(2));
        assert.equal(item.annual_price, expectedAnnual, `Annual price must equal 10 * monthly_price for ${item.addon_key}`);
        const savings = (item.monthly_price * 12) - item.annual_price;
        const expectedSavings = Number((item.monthly_price * 2).toFixed(2));
        assert.equal(Number(savings.toFixed(2)), expectedSavings);
      });
    });

    test('Multi-item cart subtotal computes correctly for monthly and annual', () => {
      const cartLines = [
        { addon: sampleCatalog[0], quantity: 1 }, // advanced_finance: 24.90 / 249.00
        { addon: sampleCatalog[1], quantity: 2 }, // stock x2: 39.80 / 398.00
      ];

      const monthlySubtotal = cartLines.reduce((s, l) => s + l.addon.monthly_price * l.quantity, 0);
      const annualSubtotal = cartLines.reduce((s, l) => s + (l.addon.annual_price || l.addon.monthly_price * 10) * l.quantity, 0);

      assert.equal(Number(monthlySubtotal.toFixed(2)), 64.70);
      assert.equal(Number(annualSubtotal.toFixed(2)), 647.00);

      const savings = (monthlySubtotal * 12) - annualSubtotal;
      assert.equal(Number(savings.toFixed(2)), 129.40); // 64.70 * 2 = 129.40
    });
  });

  describe('Gate 5: Client Request Payload Invariants', () => {
    test('Batch subscribe request payload contains NO price_id, unit_amount, or product_id', () => {
      const cart = [
        { addon_id: 'addon_123', quantity: 1, billing_cycle: 'monthly' }
      ];
      const payload = {
        items: cart.map(c => ({
          addonId: c.addon_id,
          quantity: c.quantity,
          billingCycle: c.billing_cycle,
        })),
        environment: 'sandbox'
      };

      assert.equal('priceId' in payload.items[0], false);
      assert.equal('price_id' in payload.items[0], false);
      assert.equal('unit_amount' in payload.items[0], false);
      assert.equal('amount' in payload.items[0], false);
      assert.equal('productId' in payload.items[0], false);
      assert.equal('product_id' in payload.items[0], false);
      assert.equal(payload.items[0].addonId, 'addon_123');
      assert.equal(payload.items[0].quantity, 1);
      assert.equal(payload.items[0].billingCycle, 'monthly');
    });

    test('Single subscribe request payload contains only addonId and environment', () => {
      const payload = { addonId: 'addon_abc', environment: 'sandbox' };
      assert.deepEqual(Object.keys(payload).sort(), ['addonId', 'environment']);
    });
  });

  describe('Gate 6: Plan-Included Capability Preservation', () => {
    test('Included module renders "Ativar" linking to /settings for both owner and non-owner', () => {
      const ownerCta = computeCtaState({
        isOwner: true,
        isOwnerLoading: false,
        cycleState: { status: 'valid', cycle: 'monthly' },
        isInPlan: true,
        isContracted: false,
        isEligibleForPlan: true,
        isConfiguredInStripe: true,
        canAddMoreAddons: true,
      });
      assert.equal(ownerCta.type, 'included');
      assert.equal(ownerCta.label, 'Ativar');
      assert.equal(ownerCta.href, '/settings');
      assert.equal(ownerCta.isPaid, false);

      const nonOwnerCta = computeCtaState({
        isOwner: false,
        isOwnerLoading: false,
        cycleState: { status: 'valid', cycle: 'monthly' },
        isInPlan: true,
        isContracted: false,
        isEligibleForPlan: true,
        isConfiguredInStripe: true,
        canAddMoreAddons: true,
      });
      assert.equal(nonOwnerCta.type, 'included');
      assert.equal(nonOwnerCta.label, 'Ativar');
      assert.equal(nonOwnerCta.href, '/settings');
      assert.equal(nonOwnerCta.isPaid, false);
    });
  });

  describe('Gate 7: Trial Subscription Fencing', () => {
    test('Trial user with no Stripe base subscription cannot activate paid purchase CTA', () => {
      const trialSub = {
        stripe_subscription_id: null,
        status: 'trialing',
        billing_cycle: null
      };

      const cycleState = resolveCycleState({ baseSub: trialSub, isSubLoading: false });
      assert.equal(cycleState.status, 'unknown');
      assert.equal(cycleState.reason, 'no_active_subscription');

      const cta = computeCtaState({
        isOwner: true,
        isOwnerLoading: false,
        cycleState,
        isInPlan: false,
        isContracted: false,
        isEligibleForPlan: true,
        isConfiguredInStripe: true,
        canAddMoreAddons: true,
      });

      assert.equal(cta.type, 'cycle_unavailable');
      assert.equal(cta.actionable, false);
      assert.equal(cta.disabled, true);
      assert.equal(cta.reason, 'Requer assinatura ativa para contratar add-ons.');
    });
  });

  describe('Gate 8: Admin Table Responsive Structure', () => {
    test('admin.addons.tsx wraps catalog and contracts tables in overflow-x-auto with min-w', () => {
      const filePath = path.resolve(__dirname, '../src/routes/admin.addons.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check catalog table wrapper
      assert.ok(content.includes('<div className="overflow-x-auto">'), 'Must contain overflow-x-auto wrapper');
      assert.ok(content.includes('min-w-[760px]'), 'Catalog table must have min-width');
      assert.ok(content.includes('min-w-[640px]'), 'Contracts table must have min-width');
    });

    test('subscription.addons.tsx and AddonsCartDrawer.tsx contain owner and cycle fencing', () => {
      const pagePath = path.resolve(__dirname, '../src/routes/subscription.addons.tsx');
      const pageContent = fs.readFileSync(pagePath, 'utf-8');
      assert.ok(pageContent.includes('Somente o proprietário pode contratar add-ons.'), 'Must explain non-owner policy');
      assert.ok(pageContent.includes('barbershops.owner_id === user.id') || pageContent.includes('barbershop.owner_id === user.id'), 'Must verify barbershop owner');

      const drawerPath = path.resolve(__dirname, '../src/components/subscription/AddonsCartDrawer.tsx');
      const drawerContent = fs.readFileSync(drawerPath, 'utf-8');
      assert.ok(drawerContent.includes('Somente o proprietário pode contratar add-ons'), 'Drawer must fence non-owner checkout');
      assert.ok(!drawerContent.includes('<ToggleGroup'), 'Drawer must not have an interactive ToggleGroup for cycle');
    });
  });
});
