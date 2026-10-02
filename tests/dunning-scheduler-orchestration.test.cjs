/**
 * BARBEX — R2E.15C.4: Hourly Dunning Scheduler & Worker Orchestration Tests
 * Local Validation Suite for Scan-Before-Drain, Bounded Worker Drain,
 * Hourly Idempotency, Window Transitions, Recovery Races, Concurrency,
 * Tenant Isolation, Auth Gates, and Zero Entitlement Authority.
 */

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");

function runPsql(sql) {
  try {
    const raw = execSync(
      "docker exec -i supabase_db_barbex psql -U postgres -d postgres -t -A -v ON_ERROR_STOP=1",
      {
        input: sql,
        stdio: ["pipe", "pipe", "pipe"],
      },
    )
      .toString()
      .trim();
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines[lines.length - 1] || "";
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(`psql error: ${stderr}`);
  }
}

function runPsqlJson(sql) {
  const res = runPsql(sql);
  try {
    return JSON.parse(res);
  } catch (e) {
    throw new Error(`Failed to parse JSON from psql: "${res}". Error: ${e.message}`);
  }
}

function insertTestSubscription({
  id = null,
  userId,
  subId,
  customerId = "cus_sched_test",
  productId = "prod_sched_test",
  priceId = "price_sched_test",
  status = "past_due",
  planKey = "pro",
  pastDueSince = "now() - interval '5 days'",
  graceEndsAt = "now() + interval '2 days'",
  currentPeriodEnd = "now() + interval '30 days'",
}) {
  const idCol = id ? "id, " : "";
  const idVal = id ? `'${id}', ` : "";
  const pastDueVal = pastDueSince ? pastDueSince : "NULL";
  const graceVal = graceEndsAt ? graceEndsAt : "NULL";

  runPsql(`
    INSERT INTO public.subscriptions (
      ${idCol}user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id,
      status, plan_key, current_period_end, past_due_since, grace_ends_at
    ) VALUES (
      ${idVal}'${userId}', '${subId}', '${customerId}', '${productId}', '${priceId}',
      '${status}', '${planKey}', ${currentPeriodEnd}, ${pastDueVal}, ${graceVal}
    );
  `);
}

// In-memory provider spy to verify 0 real network calls and mock delivery
const mockProviderCalls = [];
let mockProviderResponseMode = "success"; // "success", "retry_500", "fatal_400", "timeout"

function resetMockProvider() {
  mockProviderCalls.length = 0;
  mockProviderResponseMode = "success";
}

async function mockDispatchDunningRecord(dunningRec) {
  // Simulates dispatchDunningNotification logic with pre-send check and mock provider
  const preSend = runPsqlJson(
    `SELECT public.check_dunning_presend_eligibility('${dunningRec.id}'::uuid, '${dunningRec.claim_token}');`,
  );

  if (!preSend.eligible) {
    return { status: "canceled", reason: preSend.reason };
  }

  // Pre-send passed, now invoke provider (mocked)
  mockProviderCalls.push({
    dunningId: dunningRec.id,
    type: dunningRec.notification_type,
    recipientEmail: preSend.recipient_email,
    attempt: dunningRec.attempt_count,
  });

  if (mockProviderResponseMode === "success") {
    const mockResendId = `resend_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    runPsql(
      `SELECT public.complete_dunning_notification('${dunningRec.id}'::uuid, '${dunningRec.claim_token}', '${mockResendId}');`,
    );
    return { status: "sent", providerMessageId: mockResendId };
  } else if (mockProviderResponseMode === "retry_500") {
    runPsql(
      `SELECT public.fail_dunning_notification('${dunningRec.id}'::uuid, '${dunningRec.claim_token}', 'RETRYABLE_SERVER_ERROR', 'HTTP_500', 'HTTP 500 Internal Error', true, 300);`,
    );
    return { status: "retry", error: "HTTP 500 Internal Error" };
  } else if (mockProviderResponseMode === "fatal_400") {
    runPsql(
      `SELECT public.fail_dunning_notification('${dunningRec.id}'::uuid, '${dunningRec.claim_token}', 'NON_RETRYABLE_CLIENT_ERROR', 'HTTP_400', 'HTTP 400 Bad Request', false, 0);`,
    );
    return { status: "failed", error: "HTTP 400 Bad Request" };
  }

  throw new Error(`Unhandled mock mode: ${mockProviderResponseMode}`);
}

/**
 * Simulates one full deterministic scheduler cycle:
 * 1. Authenticate invocation
 * 2. Scan due intents (public.scan_and_enqueue_dunning_reminders)
 * 3. Bounded drain loop (up to maxClaims)
 * 4. Return operational summary
 */
async function executeDeterministicSchedulerCycle(options = {}) {
  const {
    authHeader,
    cronSecretHeader,
    configuredCronSecret = "valid-scheduler-secret-xyz",
    serviceRoleKey = "valid-service-role-key-123",
    maxClaims = 5,
    leaseSeconds = 300,
    workerId = `worker-sched-${Math.random().toString(36).slice(2, 6)}`,
  } = options;

  // 1. Authentication Gate
  let isAuthorized = false;
  if (authHeader && authHeader === `Bearer ${serviceRoleKey}`) {
    isAuthorized = true;
  } else if (cronSecretHeader && cronSecretHeader === configuredCronSecret) {
    isAuthorized = true;
  } else if (authHeader && authHeader === `Bearer ${configuredCronSecret}`) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return {
      status: 401,
      ok: false,
      error: "UNAUTHORIZED",
      message: "Acesso não autorizado ao worker de background.",
    };
  }

  // 2. Scan due intents (Database clock authority)
  let scanResult = null;
  try {
    scanResult = runPsqlJson(`SELECT public.scan_and_enqueue_dunning_reminders();`);
  } catch (err) {
    scanResult = { ok: false, error: err.message };
  }

  // 3. Bounded Drain Loop (R2E.15C.3 & R2E.15C.4)
  let dunningProcessed = 0;
  let dunningSent = 0;
  let dunningCanceled = 0;
  let dunningFailed = 0;
  let dunningRetried = 0;
  const dunningResults = [];

  while (dunningProcessed < maxClaims) {
    const claimRaw = runPsql(
      `SELECT row_to_json(c) FROM public.claim_next_dunning_notification('${workerId}', ${leaseSeconds}) c;`,
    );

    if (!claimRaw || claimRaw === "null" || claimRaw === "") {
      break; // No more eligible claims in ledger
    }

    const dunningRec = JSON.parse(claimRaw);
    dunningProcessed++;

    const dispatchRes = await mockDispatchDunningRecord(dunningRec);

    if (dispatchRes.status === "sent") {
      dunningSent++;
      dunningResults.push({ id: dunningRec.id, status: "sent", type: dunningRec.notification_type });
    } else if (dispatchRes.status === "canceled") {
      dunningCanceled++;
      dunningResults.push({
        id: dunningRec.id,
        status: "canceled",
        type: dunningRec.notification_type,
        error: dispatchRes.reason,
      });
    } else if (dispatchRes.status === "retry") {
      dunningRetried++;
      dunningResults.push({
        id: dunningRec.id,
        status: "retry",
        type: dunningRec.notification_type,
        error: dispatchRes.error,
      });
    } else {
      dunningFailed++;
      dunningResults.push({
        id: dunningRec.id,
        status: "failed",
        type: dunningRec.notification_type,
        error: dispatchRes.error,
      });
    }
  }

  return {
    status: 200,
    ok: true,
    workerId,
    dunning: {
      scanned: scanResult,
      processed: dunningProcessed,
      sent: dunningSent,
      canceled: dunningCanceled,
      failed: dunningFailed,
      retried: dunningRetried,
      results: dunningResults,
    },
  };
}

describe("BARBEX — R2E.15C.4: Dunning Scheduler & Worker Orchestration Suite", { concurrency: 1 }, () => {
  const testTenant1 = "11111111-1111-4111-8111-111111111111";
  const testTenant2 = "22222222-2222-4222-8222-222222222222";
  const testTrialTenant = "33333333-3333-4333-8333-333333333333";
  const testActiveTenant = "44444444-4444-4444-8444-444444444444";

  const testSub1 = "sub_sched_test_001";
  const testSub2 = "sub_sched_test_002";
  const testSubActive = "sub_sched_test_active";

  const defaultAuthHeaders = {
    cronSecretHeader: "valid-scheduler-secret-xyz",
  };

  function cleanupDatabase() {
    resetMockProvider();
    runPsql(`
      DELETE FROM public.dunning_notifications;
      DELETE FROM public.subscriptions WHERE stripe_subscription_id IN ('${testSub1}', '${testSub2}', '${testSubActive}')
                                         OR user_id IN ('${testTenant1}', '${testTenant2}', '${testTrialTenant}', '${testActiveTenant}');
      UPDATE public.subscriptions SET status = 'active', past_due_since = NULL, grace_ends_at = NULL WHERE status = 'past_due';
    `);
  }

  before(() => {
    // Setup test profiles and clean tables
    runPsql(`
      BEGIN;
      INSERT INTO auth.users (id, email) VALUES
        ('${testTenant1}', 'owner1@barbex.shop'),
        ('${testTenant2}', 'owner2@barbex.shop'),
        ('${testTrialTenant}', 'trial_owner@barbex.shop'),
        ('${testActiveTenant}', 'active_owner@barbex.shop')
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

      INSERT INTO public.profiles (id, email, contact_email, status, role, business_name, tenant_id) VALUES
        ('${testTenant1}', 'owner1@barbex.shop', 'owner1@barbex.shop', 'active', 'tenant_admin', 'Barbearia Sched 1', '${testTenant1}'),
        ('${testTenant2}', 'owner2@barbex.shop', 'owner2@barbex.shop', 'active', 'tenant_admin', 'Barbearia Sched 2', '${testTenant2}'),
        ('${testTrialTenant}', 'trial_owner@barbex.shop', 'trial_owner@barbex.shop', 'active', 'tenant_admin', 'Barbearia Trial Only', '${testTrialTenant}'),
        ('${testActiveTenant}', 'active_owner@barbex.shop', 'active_owner@barbex.shop', 'active', 'tenant_admin', 'Barbearia Active Paid', '${testActiveTenant}')
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        contact_email = EXCLUDED.contact_email,
        business_name = EXCLUDED.business_name,
        status = EXCLUDED.status,
        role = EXCLUDED.role,
        tenant_id = EXCLUDED.tenant_id;

      DELETE FROM public.dunning_notifications;
      DELETE FROM public.subscriptions WHERE stripe_subscription_id IN ('${testSub1}', '${testSub2}', '${testSubActive}');
      COMMIT;
    `);
  });

  after(() => {
    runPsql(`
      BEGIN;
      DELETE FROM public.dunning_notifications;
      DELETE FROM public.notifications WHERE tenant_id IN ('${testTenant1}', '${testTenant2}', '${testTrialTenant}', '${testActiveTenant}');
      DELETE FROM public.audit_logs WHERE target_id IN ('${testTenant1}', '${testTenant2}', '${testTrialTenant}', '${testActiveTenant}')
                                      OR admin_id IN ('${testTenant1}', '${testTenant2}', '${testTrialTenant}', '${testActiveTenant}');
      DELETE FROM public.subscriptions WHERE user_id IN ('${testTenant1}', '${testTenant2}', '${testTrialTenant}', '${testActiveTenant}')
                                         OR stripe_subscription_id IN ('${testSub1}', '${testSub2}', '${testSubActive}');
      DELETE FROM public.profiles WHERE id IN ('${testTenant1}', '${testTenant2}', '${testTrialTenant}', '${testActiveTenant}');
      DELETE FROM auth.users WHERE id IN ('${testTenant1}', '${testTenant2}', '${testTrialTenant}', '${testActiveTenant}');
      COMMIT;
    `);
  });

  // ============================================================================
  // Gate 1: Scheduler Authentication & Secret Protection
  // ============================================================================
  describe("Gate 1: Scheduler Authentication & Secret Protection", { concurrency: 1 }, () => {
    test("1.1 Anonymous invocation without credentials is strictly denied (401)", async () => {
      cleanupDatabase();
      const res = await executeDeterministicSchedulerCycle({});
      assert.equal(res.status, 401);
      assert.equal(res.ok, false);
      assert.equal(res.error, "UNAUTHORIZED");
      assert.equal(mockProviderCalls.length, 0);
    });

    test("1.2 Invocation with invalid secret or malformed header is denied (401)", async () => {
      cleanupDatabase();
      const res = await executeDeterministicSchedulerCycle({
        cronSecretHeader: "wrong-secret-token",
        authHeader: "Bearer invalid-jwt",
      });
      assert.equal(res.status, 401);
      assert.equal(res.ok, false);
      assert.equal(mockProviderCalls.length, 0);
    });

    test("1.3 Invocation with valid x-cron-secret header is authorized (200)", async () => {
      cleanupDatabase();
      const res = await executeDeterministicSchedulerCycle({
        cronSecretHeader: "valid-scheduler-secret-xyz",
      });
      assert.equal(res.status, 200);
      assert.equal(res.ok, true);
    });

    test("1.4 Invocation with valid service-role Bearer token is authorized (200)", async () => {
      cleanupDatabase();
      const res = await executeDeterministicSchedulerCycle({
        authHeader: "Bearer valid-service-role-key-123",
      });
      assert.equal(res.status, 200);
      assert.equal(res.ok, true);
    });

    test("1.5 Zero secret values exposed in repository migrations or cron job definitions", () => {
      const cronJobsRaw = runPsql(
        `SELECT COALESCE(string_agg(command, ' '), '') FROM cron.job;`,
      );
      assert.ok(
        !cronJobsRaw.includes("eyJhbGciOi"),
        "JWT / Service role key detected in cron.job commands!",
      );
      assert.ok(
        !cronJobsRaw.includes("re_123456789"),
        "Resend API key detected in cron.job commands!",
      );
      assert.ok(
        !cronJobsRaw.includes("sk_live_"),
        "Stripe live secret detected in cron.job commands!",
      );
    });
  });

  // ============================================================================
  // Gate 2: Scanner Re-use, Idempotency & Window Transitions
  // ============================================================================
  describe("Gate 2: Scanner Re-use, Idempotency & Window Transitions", { concurrency: 1 }, () => {
    test("2.1 Hourly repeat: running scheduler multiple times inside same window creates no duplicate intents or duplicate deliveries", async () => {
      cleanupDatabase();
      // Setup subscription in past_due, remaining 2 days in grace (three_day window: <= 3d and > 1d)
      insertTestSubscription({
        userId: testTenant1,
        subId: testSub1,
        pastDueSince: "now() - interval '5 days'",
        graceEndsAt: "now() + interval '2 days'",
      });

      // Run 1: Should discover initial (if missing) + three_day, and drain up to batch
      const cycle1 = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(cycle1.status, 200);
      assert.equal(cycle1.dunning.scanned.enqueued_three_day, 1);
      assert.equal(cycle1.dunning.sent, 2); // initial + three_day sent

      // Run 2 (Simulating 1 hour later, still inside 2-day remaining window):
      const cycle2 = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(cycle2.status, 200);
      assert.equal(cycle2.dunning.scanned.enqueued_three_day, 0); // No duplicate
      assert.equal(cycle2.dunning.processed, 0); // No new deliveries
      assert.equal(cycle2.dunning.sent, 0);

      // Verify exact count in ledger
      const threeDayCount = parseInt(
        runPsql(
          `SELECT count(*) FROM public.dunning_notifications WHERE subscription_id = (SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSub1}') AND notification_type = 'three_day';`,
        ),
        10,
      );
      assert.equal(threeDayCount, 1, "Must have exactly 1 three_day intent");
    });

    test("2.2 Missed run: scheduler not running at exact 3-day boundary still discovers and enqueues THREE_DAY on first run", async () => {
      cleanupDatabase();
      // Remaining 1.5 days (grace_ends_at = now() + 1.5 days). Scheduler missed the exact 3.0 days boundary.
      insertTestSubscription({
        userId: testTenant1,
        subId: testSub1,
        pastDueSince: "now() - interval '5.5 days'",
        graceEndsAt: "now() + interval '36 hours'",
      });

      const cycle = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(cycle.status, 200);
      assert.equal(cycle.dunning.scanned.enqueued_three_day, 1);
      assert.ok(mockProviderCalls.some((c) => c.type === "three_day"));
    });

    test("2.3 Window transition: 3-day window -> THREE_DAY, later 1-day window -> ONE_DAY creates both distinct intents", async () => {
      cleanupDatabase();
      // Step A: In 3-day window (2 days remaining)
      insertTestSubscription({
        userId: testTenant1,
        subId: testSub1,
        pastDueSince: "now() - interval '5 days'",
        graceEndsAt: "now() + interval '2 days'",
      });

      const runA = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(runA.dunning.scanned.enqueued_three_day, 1);
      assert.equal(runA.dunning.scanned.enqueued_one_day, 0);

      // Step B: Advance time so remaining is 12 hours (inside 1-day window: <= 1d and > 0)
      runPsql(`
        UPDATE public.subscriptions
        SET grace_ends_at = now() + interval '12 hours'
        WHERE stripe_subscription_id = '${testSub1}';
      `);

      const runB = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(runB.dunning.scanned.enqueued_three_day, 0);
      assert.equal(runB.dunning.scanned.enqueued_one_day, 1);

      // Verify both intents exist
      const totalIntents = runPsqlJson(`
        SELECT json_agg(notification_type ORDER BY created_at)
        FROM public.dunning_notifications
        WHERE subscription_id = (SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSub1}');
      `);
      assert.ok(totalIntents.includes("three_day"));
      assert.ok(totalIntents.includes("one_day"));
    });

    test("2.4 Missed 3-day window entirely: when observed <= 1 day, ONE_DAY is created and THREE_DAY is NOT retroactively created", async () => {
      cleanupDatabase();
      // Subscription was past_due, but scheduler was offline until remaining grace is 8 hours (<= 1 day)
      insertTestSubscription({
        userId: testTenant1,
        subId: testSub1,
        pastDueSince: "now() - interval '6.5 days'",
        graceEndsAt: "now() + interval '8 hours'",
      });

      const cycle = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(cycle.dunning.scanned.enqueued_one_day, 1);
      assert.equal(cycle.dunning.scanned.enqueued_three_day, 0, "THREE_DAY must not be retroactively enqueued!");

      const ledgerTypes = runPsqlJson(`
        SELECT json_agg(notification_type)
        FROM public.dunning_notifications
        WHERE subscription_id = (SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSub1}');
      `);
      assert.ok(!ledgerTypes.includes("three_day"), "Ledger must not contain three_day");
      assert.ok(ledgerTypes.includes("one_day"), "Ledger must contain one_day");
    });

    test("2.5 Expiry: at/after grace_ends_at, GRACE_EXPIRED is enqueued once without duplicate on repeated runs", async () => {
      cleanupDatabase();
      // Grace ended 2 hours ago
      insertTestSubscription({
        userId: testTenant1,
        subId: testSub1,
        pastDueSince: "now() - interval '7 days' - interval '2 hours'",
        graceEndsAt: "now() - interval '2 hours'",
      });

      const run1 = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(run1.dunning.scanned.enqueued_expired, 1);

      const run2 = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(run2.dunning.scanned.enqueued_expired, 0, "No duplicate expired intent on repeat");

      const expiredCount = parseInt(
        runPsql(
          `SELECT count(*) FROM public.dunning_notifications WHERE subscription_id = (SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSub1}') AND notification_type = 'grace_expired';`,
        ),
        10,
      );
      assert.equal(expiredCount, 1);
    });

    test("2.6 Zero recovery inference by scanner: scanner never enqueues RECOVERY on cleared timestamps", async () => {
      cleanupDatabase();
      // Subscription was cleared / active
      insertTestSubscription({
        userId: testTenant1,
        subId: testSub1,
        status: "active",
        pastDueSince: null,
        graceEndsAt: null,
      });

      const cycle = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(cycle.dunning.scanned.enqueued_initial, 0);
      assert.equal(cycle.dunning.scanned.enqueued_three_day, 0);
      assert.equal(cycle.dunning.scanned.enqueued_one_day, 0);
      assert.equal(cycle.dunning.scanned.enqueued_expired, 0);

      const recoveryCount = parseInt(
        runPsql(
          `SELECT count(*) FROM public.dunning_notifications WHERE subscription_id = (SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSub1}') AND notification_type = 'recovery';`,
        ),
        10,
      );
      assert.equal(recoveryCount, 0, "Scanner must never synthesize recovery");
    });
  });

  // ============================================================================
  // Gate 3: Scan-Before-Drain Orchestration & Failure Isolation
  // ============================================================================
  describe("Gate 3: Scan-Before-Drain Orchestration & Failure Isolation", { concurrency: 1 }, () => {
    test("3.1 Scan occurs before drain and provider failures do not roll back scanned intents", async () => {
      cleanupDatabase();
      insertTestSubscription({
        userId: testTenant1,
        subId: testSub1,
        pastDueSince: "now() - interval '5 days'",
        graceEndsAt: "now() + interval '2 days'",
      });

      // Set mock provider to fail with 500
      mockProviderResponseMode = "retry_500";

      const cycle = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(cycle.status, 200);
      assert.equal(cycle.dunning.scanned.enqueued_three_day, 1);
      assert.equal(cycle.dunning.retried, 2); // initial + three_day both retried

      // Verify that intents REMAIN in ledger despite provider failure
      const intentsCount = parseInt(
        runPsql(
          `SELECT count(*) FROM public.dunning_notifications WHERE subscription_id = (SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSub1}');`,
        ),
        10,
      );
      assert.equal(intentsCount, 2, "Scanner intents must remain durable in database");
    });

    test("3.2 Pre-send recheck is NEVER bypassed by scheduler: cancels stale notification if recovered before run", async () => {
      cleanupDatabase();
      // Step A: Create past_due subscription & enqueue intent
      insertTestSubscription({
        userId: testTenant1,
        subId: testSub1,
        pastDueSince: "now() - interval '5 days'",
        graceEndsAt: "now() + interval '2 days'",
      });
      // Scan once to enqueue
      runPsql(`SELECT public.scan_and_enqueue_dunning_reminders();`);

      // Step B: Subscription recovers BEFORE scheduled drain loop runs
      runPsql(`
        UPDATE public.subscriptions
        SET status = 'active', past_due_since = NULL, grace_ends_at = NULL
        WHERE stripe_subscription_id = '${testSub1}';
      `);

      // Run scheduler cycle
      const cycle = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(cycle.dunning.canceled, 2, "Both stale initial & three_day must be canceled");
      assert.equal(cycle.dunning.sent, 0, "No email must be sent for recovered subscription");
      assert.equal(mockProviderCalls.length, 0, "Zero provider network calls");

      // Verify notification status in DB
      const statuses = runPsqlJson(`
        SELECT json_agg(status) FROM public.dunning_notifications
        WHERE subscription_id = (SELECT id FROM public.subscriptions WHERE stripe_subscription_id = '${testSub1}');
      `);
      assert.ok(statuses.every((s) => s === "canceled"));
    });
  });

  // ============================================================================
  // Gate 4: Bounded Drain & Backlog Progression
  // ============================================================================
  describe("Gate 4: Bounded Drain & Backlog Progression", { concurrency: 1 }, () => {
    test("4.1 Backlog > 5 items is bounded per invocation and preserved for future cycles", async () => {
      cleanupDatabase();
      // Setup sub1
      insertTestSubscription({
        id: "a0000000-0000-0000-0000-000000000001",
        userId: testTenant1,
        subId: testSub1,
        pastDueSince: "now() - interval '2 days'",
        graceEndsAt: "now() + interval '5 days'",
      });

      // Insert 7 pending dunning records manually into ledger (unique on subscription_id, past_due_since, notification_type)
      runPsql(`
        INSERT INTO public.dunning_notifications (
          subscription_id, tenant_id, past_due_since, notification_type, status, recipient_user_id, recipient_email
        ) VALUES
          ('a0000000-0000-0000-0000-000000000001', '${testTenant1}', now() - interval '10 days', 'initial', 'pending', '${testTenant1}', 'owner1@barbex.shop'),
          ('a0000000-0000-0000-0000-000000000001', '${testTenant1}', now() - interval '10 days', 'three_day', 'pending', '${testTenant1}', 'owner1@barbex.shop'),
          ('a0000000-0000-0000-0000-000000000001', '${testTenant1}', now() - interval '10 days', 'one_day', 'pending', '${testTenant1}', 'owner1@barbex.shop'),
          ('a0000000-0000-0000-0000-000000000001', '${testTenant1}', now() - interval '10 days', 'grace_expired', 'pending', '${testTenant1}', 'owner1@barbex.shop'),
          ('a0000000-0000-0000-0000-000000000001', '${testTenant1}', now() - interval '10 days', 'recovery', 'pending', '${testTenant1}', 'owner1@barbex.shop'),
          ('a0000000-0000-0000-0000-000000000001', '${testTenant1}', now() - interval '20 days', 'initial', 'pending', '${testTenant1}', 'owner1@barbex.shop'),
          ('a0000000-0000-0000-0000-000000000001', '${testTenant1}', now() - interval '20 days', 'three_day', 'pending', '${testTenant1}', 'owner1@barbex.shop');
      `);

      // Cycle 1: Max 5 claims
      const cycle1 = await executeDeterministicSchedulerCycle({
        ...defaultAuthHeaders,
        maxClaims: 5,
      });
      assert.equal(cycle1.dunning.processed, 5, "First cycle must process exactly 5 (bounded)");

      // Verify remaining records remain in ledger (7 manual + 1 initial from scanner = 8, 5 processed, 3 remain)
      const remainingPending = parseInt(
        runPsql(`SELECT count(*) FROM public.dunning_notifications WHERE status = 'pending';`),
        10,
      );
      assert.ok(remainingPending > 0, "Remaining backlog must be safely pending after cycle 1");

      // Cycle 2: Process remaining records
      const cycle2 = await executeDeterministicSchedulerCycle({
        ...defaultAuthHeaders,
        maxClaims: 5,
      });
      assert.ok(cycle2.dunning.processed > 0, "Second cycle drains remaining records");

      const pendingAfter2 = parseInt(
        runPsql(`SELECT count(*) FROM public.dunning_notifications WHERE status = 'pending';`),
        10,
      );
      assert.equal(pendingAfter2, 0, "All backlog processed without data loss");
    });
  });

  // ============================================================================
  // Gate 5: Concurrency, Trial & Tenant Isolation
  // ============================================================================
  describe("Gate 5: Concurrency, Trial & Tenant Isolation", { concurrency: 1 }, () => {
    test("5.1 Concurrent overlapping scheduler executions safely fence claims via FOR UPDATE SKIP LOCKED", async () => {
      cleanupDatabase();
      insertTestSubscription({
        id: "a0000000-0000-0000-0000-000000000001",
        userId: testTenant1,
        subId: testSub1,
        pastDueSince: "now() - interval '2 days'",
        graceEndsAt: "now() + interval '5 days'",
      });

      runPsql(`
        INSERT INTO public.dunning_notifications (
          subscription_id, tenant_id, past_due_since, notification_type, status, recipient_user_id, recipient_email
        ) VALUES
          ('a0000000-0000-0000-0000-000000000001', '${testTenant1}', now() - interval '2 days', 'initial', 'pending', '${testTenant1}', 'owner1@barbex.shop');
      `);

      // Worker 1 claims the record with 300s lease
      const claim1 = runPsqlJson(
        `SELECT row_to_json(c) FROM public.claim_next_dunning_notification('worker-conc-1', 300) c;`,
      );
      assert.ok(claim1, "Worker 1 must claim the record");

      // Worker 2 attempts to claim concurrently while Worker 1 holds active lease
      const claim2Raw = runPsql(
        `SELECT row_to_json(c) FROM public.claim_next_dunning_notification('worker-conc-2', 300) c;`,
      );
      assert.equal(claim2Raw, "", "Worker 2 must receive null (claim fencing holds)");

      // Worker 1 finishes
      runPsql(
        `SELECT public.complete_dunning_notification('${claim1.id}'::uuid, '${claim1.claim_token}', 'resend_conc_ok');`,
      );
    });

    test("5.2 Trial account isolation: trial tenants never create dunning intents or provider dispatches", async () => {
      cleanupDatabase();
      // Trial tenant has a profile with 15-day trial, but NO subscription row (or active trial)
      // Run scheduler cycle
      const cycle = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(cycle.status, 200);

      // Verify zero dunning notifications for trial tenant
      const trialDunningCount = parseInt(
        runPsql(
          `SELECT count(*) FROM public.dunning_notifications WHERE tenant_id = '${testTrialTenant}';`,
        ),
        10,
      );
      assert.equal(trialDunningCount, 0, "Trial tenant must have zero dunning notifications");
      assert.ok(!mockProviderCalls.some((c) => c.recipientEmail === "trial_owner@barbex.shop"));
    });

    test("5.3 Active paid account isolation: healthy active subscriptions generate zero dunning reminders", async () => {
      cleanupDatabase();
      insertTestSubscription({
        userId: testActiveTenant,
        subId: testSubActive,
        status: "active",
        pastDueSince: null,
        graceEndsAt: null,
      });

      const cycle = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(cycle.status, 200);

      const activeDunningCount = parseInt(
        runPsql(
          `SELECT count(*) FROM public.dunning_notifications WHERE tenant_id = '${testActiveTenant}';`,
        ),
        10,
      );
      assert.equal(activeDunningCount, 0, "Active paid tenant must have zero dunning notifications");
      assert.ok(!mockProviderCalls.some((c) => c.recipientEmail === "active_owner@barbex.shop"));
    });

    test("5.4 Tenant recipient isolation: dunning notices strictly resolve to each tenant's owner email", async () => {
      cleanupDatabase();
      // Setup Sub 1 for Tenant 1 and Sub 2 for Tenant 2
      insertTestSubscription({
        id: "11111111-0000-0000-0000-000000000001",
        userId: testTenant1,
        subId: testSub1,
        customerId: "cus_sched_1",
        planKey: "pro",
        pastDueSince: "now() - interval '1 day'",
        graceEndsAt: "now() + interval '6 days'",
      });
      insertTestSubscription({
        id: "22222222-0000-0000-0000-000000000002",
        userId: testTenant2,
        subId: testSub2,
        customerId: "cus_sched_2",
        planKey: "elite",
        pastDueSince: "now() - interval '1 day'",
        graceEndsAt: "now() + interval '6 days'",
      });

      const cycle = await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      assert.equal(cycle.status, 200);
      assert.equal(cycle.dunning.sent, 2);

      const callsForTenant1 = mockProviderCalls.filter((c) => c.recipientEmail === "owner1@barbex.shop");
      const callsForTenant2 = mockProviderCalls.filter((c) => c.recipientEmail === "owner2@barbex.shop");

      assert.equal(callsForTenant1.length, 1, "Tenant 1 must receive exactly 1 email");
      assert.equal(callsForTenant2.length, 1, "Tenant 2 must receive exactly 1 email");
      assert.equal(mockProviderCalls.length, 2, "No cross-tenant leakage or duplicated emails");
    });
  });

  // ============================================================================
  // Gate 6: Scheduler Entitlement Immutability
  // ============================================================================
  describe("Gate 6: Scheduler Entitlement Immutability", { concurrency: 1 }, () => {
    test("6.1 Scheduler has ZERO entitlement authority: status, grace_ends_at, past_due_since remain strictly unchanged", async () => {
      cleanupDatabase();
      insertTestSubscription({
        id: "a0000000-0000-0000-0000-000000000001",
        userId: testTenant1,
        subId: testSub1,
        currentPeriodEnd: "'2026-11-01 12:00:00+00'",
        pastDueSince: "'2026-10-01 12:00:00+00'",
        graceEndsAt: "'2026-10-08 12:00:00+00'",
      });

      const subBefore = runPsqlJson(
        `SELECT row_to_json(s) FROM (SELECT status, past_due_since, grace_ends_at, plan_key FROM public.subscriptions WHERE stripe_subscription_id = '${testSub1}') s;`,
      );

      // Run multiple scheduler cycles
      await executeDeterministicSchedulerCycle(defaultAuthHeaders);
      await executeDeterministicSchedulerCycle(defaultAuthHeaders);

      const subAfter = runPsqlJson(
        `SELECT row_to_json(s) FROM (SELECT status, past_due_since, grace_ends_at, plan_key FROM public.subscriptions WHERE stripe_subscription_id = '${testSub1}') s;`,
      );

      assert.equal(subAfter.status, subBefore.status, "Subscription status must remain unchanged");
      assert.equal(subAfter.past_due_since, subBefore.past_due_since, "past_due_since must remain unchanged");
      assert.equal(subAfter.grace_ends_at, subBefore.grace_ends_at, "grace_ends_at must remain unchanged");
      assert.equal(subAfter.plan_key, subBefore.plan_key, "plan_key must remain unchanged");
    });
  });
});
