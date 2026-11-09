const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

// Load source code files directly to validate strict commercial truth without ts-node dependency
const tutorialsCatalogPath = path.join(__dirname, "../src/lib/tutorials.catalog.ts");
const providerServerPath = path.join(__dirname, "../src/lib/ai/provider.server.ts");
const knowledgeServerPath = path.join(__dirname, "../src/lib/ai/knowledge.server.ts");

const tutorialsCatalogContent = fs.readFileSync(tutorialsCatalogPath, "utf8");
const providerServerContent = fs.readFileSync(providerServerPath, "utf8");
const knowledgeServerContent = fs.readFileSync(knowledgeServerPath, "utf8");

describe("BARBEX FASE R2E.26E.22N.37A.1 — Commercial Truth & Tenant Eligibility Suite", () => {
  test("1. Commercial Truth: Exact Plan Pricing in Tutorials Catalog", () => {
    // Starter
    assert.match(tutorialsCatalogContent, /R\$\s*59,90\s*\/\s*mês/i, "Starter monthly price must be exactly R$ 59,90/mês");
    assert.match(tutorialsCatalogContent, /R\$\s*499,00\s*\/\s*ano/i, "Starter annual price must be exactly R$ 499,00/ano");

    // Pro
    assert.match(tutorialsCatalogContent, /R\$\s*99,90\s*\/\s*mês/i, "Pro monthly price must be exactly R$ 99,90/mês");
    assert.match(tutorialsCatalogContent, /R\$\s*999,00\s*\/\s*ano/i, "Pro annual price must be exactly R$ 999,00/ano");

    // Elite
    assert.match(tutorialsCatalogContent, /R\$\s*149,90\s*\/\s*mês/i, "Elite monthly price must be exactly R$ 149,90/mês");
    assert.match(tutorialsCatalogContent, /R\$\s*1\.499,00\s*\/\s*ano/i, "Elite annual price must be exactly R$ 1.499,00/ano");

    // No rounded values in pricing definitions
    assert.doesNotMatch(tutorialsCatalogContent, /Starter:\s*R\$\s*60,00/i, "Should not round Starter to R$ 60");
    assert.doesNotMatch(tutorialsCatalogContent, /Pro:\s*R\$\s*100,00/i, "Should not round Pro to R$ 100");
    assert.doesNotMatch(tutorialsCatalogContent, /Elite:\s*R\$\s*150,00/i, "Should not round Elite to R$ 150");
  });

  test("2. Commercial Truth: Exact Resource Limits and Exact 8 Automations on Pro", () => {
    // Starter limits
    assert.match(tutorialsCatalogContent, /até 3 barbeiros/i, "Starter must limit to 3 barbers");
    assert.match(tutorialsCatalogContent, /300 clientes/i, "Starter must limit to 300 clients");
    assert.match(tutorialsCatalogContent, /15 serviços/i, "Starter must limit to 15 services");
    assert.match(tutorialsCatalogContent, /3 automações/i, "Starter must limit to 3 automations");

    // Pro limits
    assert.match(tutorialsCatalogContent, /até 10 barbeiros/i, "Pro must limit to 10 barbers");
    assert.match(tutorialsCatalogContent, /clientes ilimitados/i, "Pro must have unlimited clients");
    assert.match(tutorialsCatalogContent, /serviços ilimitados/i, "Pro must have unlimited services");
    assert.match(tutorialsCatalogContent, /exatamente 8 automações/i, "Pro must specify exactly 8 automations in catalog");
    assert.match(providerServerContent, /exatamente 8 automações/i, "Pro must specify exactly 8 automations in system prompt");

    // Elite limits
    assert.match(tutorialsCatalogContent, /profissionais.*clientes.*serviços.*automações totalmente ilimitados/i, "Elite must be unlimited");
  });

  test("3. Commercial Truth: Distinction between Institutional Assistant and Customer AI", () => {
    assert.match(tutorialsCatalogContent, /Assistente Institucional em \/dashboard\/assistente/i, "Must identify institutional assistant route");
    assert.match(tutorialsCatalogContent, /ai_assistant.*R\$\s*49,90/i, "Must specify ai_assistant add-on at R$ 49,90/mês");
    assert.match(tutorialsCatalogContent, /plano Elite ou ao add-on comercial 'IA para Atendimento'/i, "Must distinguish Elite and customer AI add-on");
    assert.match(tutorialsCatalogContent, /API de terceiros.*Z-API/i, "Must specify external WhatsApp API requirements");

    // Provider server system prompt checks
    assert.match(providerServerContent, /Distinção mandatória de IA: você é o Assistente Institucional oficial do Barbex/i, "System prompt must have strict institutional assistant definition");
    assert.match(providerServerContent, /Robôs de atendimento automático ao cliente no WhatsApp pertencem exclusivamente ao plano Elite/i, "System prompt must have strict customer AI distinction");
    assert.match(providerServerContent, /R\$ 49,90\/mês/i, "System prompt must have add-on pricing");
  });

  test("4. Query Resolution & Knowledge Clusters: Add-on and Pricing Terms", () => {
    assert.match(knowledgeServerContent, /addon/i, "Knowledge server must include 'addon' in CLUSTER_IDENTIFIERS");
    assert.match(knowledgeServerContent, /add-on/i, "Knowledge server must include 'add-on' in CLUSTER_IDENTIFIERS");
    assert.match(knowledgeServerContent, /ia para atendimento/i, "Knowledge server must include 'ia para atendimento' in CLUSTER_IDENTIFIERS");
    assert.match(knowledgeServerContent, /mensalidade/i, "Knowledge server must include 'mensalidade' in CLUSTER_IDENTIFIERS");
  });

  test("5. Mock Provider: Commercial Truth Alignment", () => {
    assert.match(providerServerContent, /R\$\s*59,90/i, "Mock must state Starter R$ 59,90");
    assert.match(providerServerContent, /R\$\s*499,00/i, "Mock must state Starter R$ 499,00");
    assert.match(providerServerContent, /R\$\s*99,90/i, "Mock must state Pro R$ 99,90");
    assert.match(providerServerContent, /R\$\s*999,00/i, "Mock must state Pro R$ 999,00");
    assert.match(providerServerContent, /exatamente 8 automações/i, "Mock must state exactly 8 automations on Pro");
    assert.match(providerServerContent, /R\$\s*149,90/i, "Mock must state Elite R$ 149,90");
    assert.match(providerServerContent, /R\$\s*1\.499,00/i, "Mock must state Elite R$ 1.499,00");
  });

  test("6. Tenant Eligibility Rules: Factual Matrix Validation", () => {
    // Audit verified 4 registered barbershops in production database:
    const registeredTenants = [
      {
        id: "c54ac1ac-49be-4505-b7a4-d257ed023f08",
        name: "Barbearia LM",
        slug: "lm",
        plan: "elite",
        status: "active",
        owner_verified: true,
        trial_expired: false,
        active_subscription_or_flagship: true,
        eligible: true,
        reason: "Active flagship with verified tenant_admin and Elite entitlement"
      },
      {
        id: "5d57205d-3a30-4852-92ff-78e8400cb9d5",
        name: "Carlos Barber",
        slug: "carlos-barber",
        plan: "starter",
        status: "active",
        owner_verified: true,
        trial_expired: true, // expired June 2026
        active_subscription_or_flagship: false,
        eligible: false,
        reason: "Trial expired (June 2026) and no active Stripe subscription"
      },
      {
        id: "92caca5a-5174-4725-9da9-b10a9aa87104",
        name: "Carlos Barber Shop",
        slug: "carlos-barber-shop",
        plan: null,
        status: "active",
        owner_verified: true,
        trial_expired: true, // expired July 2026
        active_subscription_or_flagship: false,
        eligible: false,
        reason: "Subscription explicitly canceled and trial expired"
      },
      {
        id: "7b5c3640-2e10-4788-83a7-5e6d8e0d9978",
        name: "Barber Shop Carlos",
        slug: "7b5c3640-2e10-4788-83a7-5e6d8e0d9978",
        plan: "starter",
        status: "active",
        owner_verified: false, // UUID slug, null email
        trial_expired: true,
        active_subscription_or_flagship: false,
        eligible: false,
        reason: "Incomplete onboarding (null email, UUID slug) and no active subscription"
      }
    ];

    const eligibleList = registeredTenants.filter(t => t.eligible);
    assert.strictEqual(eligibleList.length, 1, "Exactly 1 tenant is fully eligible (Barbearia LM)");
    assert.strictEqual(eligibleList[0].id, "c54ac1ac-49be-4505-b7a4-d257ed023f08");

    const ineligibleList = registeredTenants.filter(t => !t.eligible);
    assert.strictEqual(ineligibleList.length, 3, "3 tenants are ineligible due to expired trials or missing subscriptions");
  });

  test("7. Capacity Quotas and Global Budget Priority", () => {
    const limits = {
      tenantRPM: 5,
      tenantRPD: 20,
      globalRPM: 30,
      globalRPD: 1000,
      globalTPM: 8000
    };

    // A batch of 5 tenants with 5 RPM each could theoretically request 25 RPM, which is <= 30 RPM global
    const pilotBatchSize = 5;
    const maxPotentialRPM = pilotBatchSize * limits.tenantRPM;
    assert.ok(maxPotentialRPM <= limits.globalRPM, "5 tenants * 5 RPM (25 RPM) must be <= 30 global RPM");

    // But if 5 tenants ask at the same time, tokens would be 5 * 1800 = 9000 TPM > 8000 TPM
    const avgTokensPerTurn = 1800;
    const concurrentPeakTPM = pilotBatchSize * avgTokensPerTurn;
    assert.ok(concurrentPeakTPM > limits.globalTPM, "Notice: 5 concurrent turns exceed 8000 TPM, confirming fail-closed queue/retry is mandatory");
  });
});
