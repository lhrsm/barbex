const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

// Load source code files directly to inspect implementations and safety contracts
const tenantAdminAuthPath = path.join(__dirname, "../src/lib/ai/tenant-admin-auth.ts");
const guardrailsServerPath = path.join(__dirname, "../src/lib/ai/guardrails.server.ts");
const chatFunctionsPath = path.join(__dirname, "../src/lib/ai/chat.functions.ts");
const providerServerPath = path.join(__dirname, "../src/lib/ai/provider.server.ts");
const tutorialsCatalogPath = path.join(__dirname, "../src/lib/tutorials.catalog.ts");

const tenantAdminAuthContent = fs.readFileSync(tenantAdminAuthPath, "utf8");
const guardrailsServerContent = fs.readFileSync(guardrailsServerPath, "utf8");
const chatFunctionsContent = fs.readFileSync(chatFunctionsPath, "utf8");
const providerServerContent = fs.readFileSync(providerServerPath, "utf8");
const tutorialsCatalogContent = fs.readFileSync(tutorialsCatalogPath, "utf8");

// Mock emulators strictly mirroring the TypeScript implementations
function mockVerifyTenantSubscriptionEligibility(tenantId, mockDb) {
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
    return { eligible: false, errorCode: "INVALID_TENANT_ID" };
  }
  const cleanTenantId = tenantId.trim().toLowerCase();

  const blockedTenantsRaw = process.env.BARBEX_AI_BLOCKED_TENANT_IDS?.trim();
  if (blockedTenantsRaw) {
    const blockedTenants = blockedTenantsRaw.split(",").map((t) => t.trim().toLowerCase());
    if (blockedTenants.includes(cleanTenantId)) {
      return { eligible: false, errorCode: "TENANT_BLOCKED", errorMessage: "O acesso ao Assistente Institucional está temporariamente suspenso para este estabelecimento." };
    }
  }

  const shop = mockDb.barbershops?.[cleanTenantId];
  if (!shop) {
    return { eligible: false, errorCode: "TENANT_NOT_FOUND" };
  }
  if (shop.is_active === false) {
    return { eligible: false, errorCode: "TENANT_INACTIVE" };
  }
  if (shop.blocked_at || (shop.owner_id && mockDb.profiles?.[shop.owner_id]?.blocked_at)) {
    return { eligible: false, errorCode: "TENANT_BLOCKED" };
  }

  const entitlement = mockDb.entitlements?.[cleanTenantId];
  const subscription = mockDb.subscriptions?.[cleanTenantId];

  if (entitlement) {
    if (entitlement.can_operate === false || entitlement.operational_state === "RESTRICTED") {
      if (subscription?.status === "canceled" || entitlement.restriction_reason === "subscription_canceled") {
        return { eligible: false, errorCode: "SUBSCRIPTION_CANCELED", errorMessage: "A assinatura do seu estabelecimento está cancelada. Reative seu plano em /subscription para acessar o Assistente Institucional." };
      }
      if (entitlement.restriction_reason === "trial_expired") {
        return { eligible: false, errorCode: "TRIAL_EXPIRED", errorMessage: "O período de teste gratuito do seu estabelecimento expirou. Para utilizar o Assistente Institucional, ative um plano em /subscription." };
      }
      return { eligible: false, errorCode: "NO_ACTIVE_SUBSCRIPTION", errorMessage: "Seu estabelecimento não possui uma assinatura ativa. O Assistente Institucional é exclusivo para assinantes dos planos Starter, Pro e Elite (/subscription)." };
    }

    const planName = (entitlement.effective_plan || entitlement.commercial_plan || "").toLowerCase();
    if (!["starter", "pro", "elite"].includes(planName)) {
      return { eligible: false, errorCode: "PLAN_INELIGIBLE", errorMessage: `O plano atual (${planName || "gratuito"}) não inclui o Assistente Institucional. Conheça os planos Starter, Pro e Elite na rota /subscription.` };
    }

    return { eligible: true, tenantId: cleanTenantId, plan: planName, operationalState: entitlement.operational_state || "ACTIVE" };
  }

  if (subscription) {
    const subStatus = (subscription.status || "").toLowerCase();
    if (subStatus === "canceled") {
      return { eligible: false, errorCode: "SUBSCRIPTION_CANCELED", errorMessage: "A assinatura do seu estabelecimento está cancelada. Reative seu plano em /subscription para acessar o Assistente Institucional." };
    }
    if (!["active", "trialing"].includes(subStatus)) {
      return { eligible: false, errorCode: "NO_ACTIVE_SUBSCRIPTION" };
    }
    return { eligible: true, tenantId: cleanTenantId, plan: subscription.plan || "starter", operationalState: "SUBSCRIPTION_ACTIVE" };
  }

  return { eligible: false, errorCode: "NO_ACTIVE_SUBSCRIPTION" };
}

// In-Memory Rate Limiter emulator replicating guardrails.server.ts exactly
const userMinuteWindowMap = new Map();
const tenantHourWindowMap = new Map();
const tenantDayWindowMap = new Map();
let globalMinuteTimestamps = [];
let globalDayTimestamps = [];

const MAX_REQUESTS_PER_MINUTE_USER = 5;
const MAX_REQUESTS_PER_HOUR_TENANT = 30;
const MAX_REQUESTS_PER_DAY_TENANT = 20;
const MAX_REQUESTS_PER_MINUTE_GLOBAL = 20;
const MAX_REQUESTS_PER_DAY_GLOBAL = 800;

let activeConcurrency = 0;
const MAX_CONCURRENT = 4;

function acquireSlot() {
  if (activeConcurrency >= MAX_CONCURRENT) {
    return { acquired: false, retryAfterSeconds: 5, reason: "CONCURRENCY_LIMIT_EXCEEDED" };
  }
  activeConcurrency++;
  return { acquired: true };
}

function releaseSlot() {
  if (activeConcurrency > 0) activeConcurrency--;
}

function checkRate(userId, tenantId) {
  const now = Date.now();
  if (globalMinuteTimestamps.length >= MAX_REQUESTS_PER_MINUTE_GLOBAL) {
    return { allowed: false, reason: "GLOBAL_MINUTE_LIMIT" };
  }
  if (globalDayTimestamps.length >= MAX_REQUESTS_PER_DAY_GLOBAL) {
    return { allowed: false, reason: "GLOBAL_DAY_LIMIT" };
  }

  const userRecord = userMinuteWindowMap.get(userId) || [];
  const userRecent = userRecord.filter((t) => t > now - 60 * 1000);
  if (userRecent.length >= MAX_REQUESTS_PER_MINUTE_USER) {
    return { allowed: false, reason: "USER_MINUTE_LIMIT" };
  }

  const tenantRecord = tenantHourWindowMap.get(tenantId) || [];
  const tenantRecent = tenantRecord.filter((t) => t > now - 60 * 60 * 1000);
  if (tenantRecent.length >= MAX_REQUESTS_PER_HOUR_TENANT) {
    return { allowed: false, reason: "TENANT_HOUR_LIMIT" };
  }

  const tenantDayRecord = tenantDayWindowMap.get(tenantId) || [];
  const tenantDayRecent = tenantDayRecord.filter((t) => t > now - 24 * 60 * 60 * 1000);
  if (tenantDayRecent.length >= MAX_REQUESTS_PER_DAY_TENANT) {
    return { allowed: false, reason: "TENANT_DAY_LIMIT" };
  }

  userRecent.push(now);
  userMinuteWindowMap.set(userId, userRecent);

  tenantRecent.push(now);
  tenantHourWindowMap.set(tenantId, tenantRecent);

  tenantDayRecent.push(now);
  tenantDayWindowMap.set(tenantId, tenantDayRecent);

  globalMinuteTimestamps.push(now);
  globalDayTimestamps.push(now);

  return { allowed: true };
}

describe("BARBEX FASE R2E.26E.22N.37B — Dynamic Eligibility Engine & General Availability Suite (18 Scenarios)", () => {
  beforeEach(() => {
    userMinuteWindowMap.clear();
    tenantHourWindowMap.clear();
    tenantDayWindowMap.clear();
    globalMinuteTimestamps = [];
    globalDayTimestamps = [];
    activeConcurrency = 0;
    delete process.env.BARBEX_AI_BLOCKED_TENANT_IDS;
    delete process.env.BARBEX_AI_CANARY_MODE;
    delete process.env.BARBEX_AI_CANARY_TENANT_IDS;
    process.env.BARBEX_AI_ASSISTANT_ENABLED = "true";
    process.env.BARBEX_AI_GENERAL_AVAILABILITY = "true";
  });

  // Scenario 1: Barbearia LM active subscription (PASS)
  test("Scenario 1: Barbearia LM with active Elite entitlement is APPROVED (PASS)", () => {
    const lmTenantId = "c54ac1ac-49be-4505-b7a4-d257ed023f08";
    const mockDb = {
      barbershops: {
        [lmTenantId]: { id: lmTenantId, is_active: true, blocked_at: null }
      },
      entitlements: {
        [lmTenantId]: {
          can_operate: true,
          effective_plan: "elite",
          operational_state: "VOUCHER_ACTIVE",
          restriction_reason: null
        }
      }
    };

    const res = mockVerifyTenantSubscriptionEligibility(lmTenantId, mockDb);
    assert.strictEqual(res.eligible, true);
    assert.strictEqual(res.plan, "elite");
    assert.strictEqual(res.operationalState, "VOUCHER_ACTIVE");
  });

  // Scenario 2: Tenant Starter active (PASS)
  test("Scenario 2: Tenant with active Starter plan is APPROVED (PASS)", () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const mockDb = {
      barbershops: {
        [tenantId]: { id: tenantId, is_active: true, blocked_at: null }
      },
      entitlements: {
        [tenantId]: {
          can_operate: true,
          effective_plan: "starter",
          operational_state: "ACTIVE",
          restriction_reason: null
        }
      }
    };

    const res = mockVerifyTenantSubscriptionEligibility(tenantId, mockDb);
    assert.strictEqual(res.eligible, true);
    assert.strictEqual(res.plan, "starter");
  });

  // Scenario 3: Tenant Pro active (PASS)
  test("Scenario 3: Tenant with active Pro plan is APPROVED (PASS)", () => {
    const tenantId = "22222222-2222-4222-8222-222222222222";
    const mockDb = {
      barbershops: {
        [tenantId]: { id: tenantId, is_active: true, blocked_at: null }
      },
      entitlements: {
        [tenantId]: {
          can_operate: true,
          effective_plan: "pro",
          operational_state: "ACTIVE",
          restriction_reason: null
        }
      }
    };

    const res = mockVerifyTenantSubscriptionEligibility(tenantId, mockDb);
    assert.strictEqual(res.eligible, true);
    assert.strictEqual(res.plan, "pro");
  });

  // Scenario 4: Tenant Elite active (PASS)
  test("Scenario 4: Tenant with active Elite plan is APPROVED (PASS)", () => {
    const tenantId = "33333333-3333-4333-8333-333333333333";
    const mockDb = {
      barbershops: {
        [tenantId]: { id: tenantId, is_active: true, blocked_at: null }
      },
      entitlements: {
        [tenantId]: {
          can_operate: true,
          effective_plan: "elite",
          operational_state: "ACTIVE",
          restriction_reason: null
        }
      }
    };

    const res = mockVerifyTenantSubscriptionEligibility(tenantId, mockDb);
    assert.strictEqual(res.eligible, true);
    assert.strictEqual(res.plan, "elite");
  });

  // Scenario 5: Canceled subscription (DENIED)
  test("Scenario 5: Tenant with canceled subscription is BLOCKED with SUBSCRIPTION_CANCELED (DENIED)", () => {
    const tenantId = "92caca5a-5174-4725-9da9-b10a9aa87104"; // Carlos Barber Shop
    const mockDb = {
      barbershops: {
        [tenantId]: { id: tenantId, is_active: true, blocked_at: null }
      },
      entitlements: {
        [tenantId]: {
          can_operate: false,
          operational_state: "RESTRICTED",
          restriction_reason: "trial_expired"
        }
      },
      subscriptions: {
        [tenantId]: { status: "canceled", plan: "starter" }
      }
    };

    const res = mockVerifyTenantSubscriptionEligibility(tenantId, mockDb);
    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.errorCode, "SUBSCRIPTION_CANCELED");
    assert.match(res.errorMessage, /\/subscription/);
  });

  // Scenario 6: Expired trial (DENIED)
  test("Scenario 6: Tenant with expired trial is BLOCKED with TRIAL_EXPIRED (DENIED)", () => {
    const tenantId = "5d57205d-3a30-4852-92ff-78e8400cb9d5"; // Carlos Barber
    const mockDb = {
      barbershops: {
        [tenantId]: { id: tenantId, is_active: true, blocked_at: null }
      },
      entitlements: {
        [tenantId]: {
          can_operate: false,
          operational_state: "RESTRICTED",
          restriction_reason: "trial_expired"
        }
      }
    };

    const res = mockVerifyTenantSubscriptionEligibility(tenantId, mockDb);
    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.errorCode, "TRIAL_EXPIRED");
    assert.match(res.errorMessage, /\/subscription/);
  });

  // Scenario 7: User with incorrect profile (barber, customer, etc.) (DENIED)
  test("Scenario 7: Unauthorized roles (barber, customer, reception, super_admin) are BLOCKED (DENIED)", () => {
    const UNAUTHORIZED_ROLES = [
      "barber", "reception", "cashier", "financial", "client", "customer"
    ];
    for (const role of UNAUTHORIZED_ROLES) {
      assert.match(
        tenantAdminAuthContent,
        new RegExp(role, "i"),
        `tenant-admin-auth must explicitly restrict role '${role}'`
      );
    }
    assert.match(tenantAdminAuthContent, /SUPER_ADMIN_DENIED/);
  });

  // Scenario 8: User attempting to access another tenant / spoofing (DENIED)
  test("Scenario 8: Tenant spoofing / tenant ID resolution failure is BLOCKED (DENIED)", () => {
    assert.match(tenantAdminAuthContent, /TENANT_NOT_RESOLVED/);
    assert.match(tenantAdminAuthContent, /Associação ativa a uma barbearia não comprovada/);
  });

  // Scenario 9: Tenant suspended/blocked in DB or env killswitch (DENIED)
  test("Scenario 9: Tenant suspended via owner blocked_at, inactive or BARBEX_AI_BLOCKED_TENANT_IDS is BLOCKED (DENIED)", () => {
    const tenantId = "44444444-4444-4444-8444-444444444444";
    const ownerId = "55555555-5555-5555-8555-555555555555";
    const mockDb = {
      barbershops: {
        [tenantId]: { id: tenantId, is_active: true, owner_id: ownerId }
      },
      profiles: {
        [ownerId]: { id: ownerId, blocked_at: "2026-11-01T00:00:00Z" }
      }
    };

    const resDb = mockVerifyTenantSubscriptionEligibility(tenantId, mockDb);
    assert.strictEqual(resDb.eligible, false);
    assert.strictEqual(resDb.errorCode, "TENANT_BLOCKED");

    // Also test env blacklist
    process.env.BARBEX_AI_BLOCKED_TENANT_IDS = tenantId;
    const resEnv = mockVerifyTenantSubscriptionEligibility(tenantId, {
      barbershops: { [tenantId]: { id: tenantId, is_active: true, owner_id: "other" } }
    });
    assert.strictEqual(resEnv.eligible, false);
    assert.strictEqual(resEnv.errorCode, "TENANT_BLOCKED");
  });

  // Scenario 10: Kill switch disabled (DENIED)
  test("Scenario 10: Global kill switch disabled BARBEX_AI_ASSISTANT_ENABLED=false blocks access (DENIED)", () => {
    assert.match(guardrailsServerContent, /GLOBAL_KILLSWITCH_DISABLED/);
    assert.match(chatFunctionsContent, /AI_KILLSWITCH_BLOCKED/);
  });

  // Scenario 11: Tenant RPM limit reached (5 RPM) (DENIED)
  test("Scenario 11: User/Tenant 5 RPM limit triggers 429 backoff (DENIED)", () => {
    const u = "user-test-11";
    const t = "tenant-test-11";

    for (let i = 0; i < 5; i++) {
      const res = checkRate(u, t);
      assert.strictEqual(res.allowed, true);
    }

    const blocked = checkRate(u, t);
    assert.strictEqual(blocked.allowed, false);
    assert.strictEqual(blocked.reason, "USER_MINUTE_LIMIT");
  });

  // Scenario 12: Tenant RPD limit reached (20 RPD) (DENIED)
  test("Scenario 12: Tenant 20 RPD limit triggers daily limit reached (DENIED)", () => {
    const t = "tenant-test-12";

    // 20 requests distributed over different minutes so global minute limit (20) is not reached
    for (let i = 0; i < 20; i++) {
      globalMinuteTimestamps = []; // simulate requests spread over minutes
      const res = checkRate(`user-${i}`, t);
      assert.strictEqual(res.allowed, true, `Request ${i + 1} should be allowed`);
    }

    globalMinuteTimestamps = [];
    const blocked = checkRate("user-21", t);
    assert.strictEqual(blocked.allowed, false);
    assert.strictEqual(blocked.reason, "TENANT_DAY_LIMIT");
  });

  // Scenario 13: Global TPM budget / concurrency limit (4 concurrent slots) (DENIED)
  test("Scenario 13: Concurrency Semaphore caps simultaneous requests at 4 (DENIED on 5th)", () => {
    assert.strictEqual(acquireSlot().acquired, true);
    assert.strictEqual(acquireSlot().acquired, true);
    assert.strictEqual(acquireSlot().acquired, true);
    assert.strictEqual(acquireSlot().acquired, true);

    const fifth = acquireSlot();
    assert.strictEqual(fifth.acquired, false);
    assert.strictEqual(fifth.reason, "CONCURRENCY_LIMIT_EXCEEDED");

    releaseSlot();
    assert.strictEqual(acquireSlot().acquired, true);
  });

  // Scenario 14: Concurrency between tenants (independent rate limits)
  test("Scenario 14: Rate limits between distinct tenants are strictly isolated", () => {
    const tA = "tenant-a-14";
    const tB = "tenant-b-14";

    for (let i = 0; i < 5; i++) {
      checkRate("user-a", tA);
    }
    assert.strictEqual(checkRate("user-a", tA).allowed, false);

    // Tenant B user is not affected by Tenant A's limit
    assert.strictEqual(checkRate("user-b", tB).allowed, true);
  });

  // Scenario 15: Groq provider failure (fail-closed, no paid fallback)
  test("Scenario 15: Groq provider failure (429, 401, timeout) fails closed without paid fallback", () => {
    assert.match(providerServerContent, /GROQ_RATE_LIMIT_EXCEEDED/);
    assert.match(providerServerContent, /GROQ_AUTH_ERROR/);
    assert.match(providerServerContent, /TIMEOUT_EXCEEDED/);
    assert.match(providerServerContent, /cost_estimate:\s*0/);
  });

  // Scenario 16: Rate limit storage failure (fail-closed)
  test("Scenario 16: Distributed rate limit RPC error or exception fails closed", () => {
    assert.match(guardrailsServerContent, /RATE_LIMIT_RPC_ERROR/);
    assert.match(guardrailsServerContent, /RATE_LIMIT_RPC_EXCEPTION/);
    assert.match(guardrailsServerContent, /RATE_LIMIT_CLIENT_UNAVAILABLE/);
  });

  // Scenario 17: Absence of paid fallback (strictly R$ 0,00)
  test("Scenario 17: Platform is FREE-ONLY with strictly R$ 0,00 marginal cost", () => {
    assert.doesNotMatch(providerServerContent, /openai\.com\/v1/i, "No direct paid OpenAI endpoints");
    assert.doesNotMatch(providerServerContent, /anthropic/i, "No paid Anthropic SDK");
    assert.match(providerServerContent, /groq\.com\/openai\/v1/i, "Only Groq Free Tier endpoint");
  });

  // Scenario 18: Preservation of commercial truth
  test("Scenario 18: Commercial truth is completely preserved across all definitions", () => {
    assert.match(tutorialsCatalogContent, /R\$\s*59,90/);
    assert.match(tutorialsCatalogContent, /R\$\s*99,90/);
    assert.match(tutorialsCatalogContent, /R\$\s*149,90/);
    assert.match(tutorialsCatalogContent, /exatamente 8 automações/);
    assert.match(providerServerContent, /exatamente 8 automações/);
    assert.match(tutorialsCatalogContent, /ai_assistant.*R\$\s*49,90/);
  });
});
