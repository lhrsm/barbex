/**
 * BARBEX — R2E.15C.2: Dunning Persistence & Idempotency Foundation Tests
 * Local Validation Suite for public.dunning_notifications, Episode Idempotency,
 * Scanner Windows, Recovery Durability, Atomic Claims, Tenancy & Security.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');

function runPsql(sql) {
  try {
    const raw = execSync('docker exec -i supabase_db_barbex psql -U postgres -d postgres -t -A -v ON_ERROR_STOP=1', {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString().trim();
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines[lines.length - 1] || '';
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

describe('BARBEX — R2E.15C.2: Dunning Persistence & Idempotency Suite', { concurrency: 1 }, () => {

  const tenantOwnerA = '11111111-aaaa-4111-8111-111111111111';
  const tenantAdminA = '11111111-aaaa-4111-8111-222222222222';
  const tenantOwnerB = '22222222-bbbb-4222-8222-111111111111';
  const tenantTrial = '33333333-cccc-4333-8333-111111111111';
  const subStripeIdA = 'sub_dunning_test_a';
  const subStripeIdB = 'sub_dunning_test_b';

  before(() => {
    runPsql(`
      BEGIN;
      -- Ensure Test Users
      INSERT INTO auth.users (id, email) VALUES
        ('${tenantOwnerA}', 'owner_a@barbex.shop'),
        ('${tenantAdminA}', 'admin_a@barbex.shop'),
        ('${tenantOwnerB}', 'owner_b@barbex.shop'),
        ('${tenantTrial}', 'trial@barbex.shop')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.profiles (id, email, status, role, tenant_id) VALUES
        ('${tenantOwnerA}', 'owner_a@barbex.shop', 'active', 'tenant_admin', '${tenantOwnerA}'),
        ('${tenantAdminA}', 'admin_a@barbex.shop', 'active', 'tenant_admin', '${tenantOwnerA}'),
        ('${tenantOwnerB}', 'owner_b@barbex.shop', 'active', 'tenant_admin', '${tenantOwnerB}'),
        ('${tenantTrial}', 'trial@barbex.shop', 'active', 'tenant_admin', '${tenantTrial}')
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        role = EXCLUDED.role,
        tenant_id = EXCLUDED.tenant_id;

      INSERT INTO public.tenant_memberships (user_id, tenant_id, role, status) VALUES
        ('${tenantAdminA}', '${tenantOwnerA}', 'tenant_admin', 'active')
      ON CONFLICT DO NOTHING;

      -- Clean up previous test subscriptions & dunning records
      DELETE FROM public.dunning_notifications WHERE tenant_id IN ('${tenantOwnerA}', '${tenantOwnerB}', '${tenantTrial}');
      DELETE FROM public.notifications WHERE tenant_id IN ('${tenantOwnerA}', '${tenantOwnerB}', '${tenantTrial}');
      DELETE FROM public.subscriptions WHERE user_id IN ('${tenantOwnerA}', '${tenantOwnerB}', '${tenantTrial}');
      COMMIT;
    `);
  });

  // ============================================================================
  // 1. EPISODE TEST MATRIX (Section 53)
  // ============================================================================
  describe('Gate 1: Episode Identity & Initial Dunning Intent', () => {

    test('1.1 New paid past_due transition creates exactly one INITIAL dunning notice', () => {
      const res = runPsqlJson(`
        SELECT public.sync_subscription_atomic(
          '${tenantOwnerA}'::uuid,
          '${subStripeIdA}',
          'cus_test_a',
          'price_1TVtOWPKG6q10UjrQErPgyKO',
          'prod_test_starter',
          'past_due',
          NOW() - INTERVAL '1 hour',
          NOW() + INTERVAL '30 days',
          false,
          'test',
          NOW()
        );
      `);
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.status, 'past_due');
      assert.strictEqual(res.audit_action, 'billing.grace_started');

      const dunningCount = Number(runPsql(`
        SELECT count(*) FROM public.dunning_notifications
        WHERE tenant_id = '${tenantOwnerA}' AND notification_type = 'initial';
      `));
      assert.strictEqual(dunningCount, 1, 'Should create exactly 1 initial dunning record');
    });

    test('1.2 Scanner rerun on active episode does NOT create duplicate INITIAL notice', () => {
      // First scan catches any baseline subscriptions
      runPsqlJson(`SELECT public.scan_and_enqueue_dunning_reminders();`);
      // Repeat scan must find 0 new initials
      const scanRes = runPsqlJson(`SELECT public.scan_and_enqueue_dunning_reminders();`);
      assert.strictEqual(scanRes.ok, true);
      assert.strictEqual(scanRes.enqueued_initial, 0, 'Scanner rerun should not enqueue initial if already present');

      const dunningCount = Number(runPsql(`
        SELECT count(*) FROM public.dunning_notifications
        WHERE tenant_id = '${tenantOwnerA}' AND notification_type = 'initial';
      `));
      assert.strictEqual(dunningCount, 1, 'Initial count remains strictly 1');
    });

    test('1.3 Stripe invoice retry does NOT create second INITIAL notice or reset past_due_since', () => {
      const beforeSub = runPsqlJson(`
        SELECT jsonb_build_object('past_due_since', past_due_since, 'grace_ends_at', grace_ends_at)
        FROM public.subscriptions WHERE stripe_subscription_id = '${subStripeIdA}';
      `);

      // Simulated repeated past_due event with newer timestamp
      const res = runPsqlJson(`
        SELECT public.sync_subscription_atomic(
          '${tenantOwnerA}'::uuid,
          '${subStripeIdA}',
          'cus_test_a',
          'price_1TVtOWPKG6q10UjrQErPgyKO',
          'prod_test_starter',
          'past_due',
          NOW() - INTERVAL '1 hour',
          NOW() + INTERVAL '30 days',
          false,
          'test',
          NOW() + INTERVAL '10 minutes'
        );
      `);
      assert.strictEqual(res.ok, true);

      const afterSub = runPsqlJson(`
        SELECT jsonb_build_object('past_due_since', past_due_since, 'grace_ends_at', grace_ends_at)
        FROM public.subscriptions WHERE stripe_subscription_id = '${subStripeIdA}';
      `);

      assert.strictEqual(afterSub.past_due_since, beforeSub.past_due_since, 'past_due_since must not change on retry');
      assert.strictEqual(afterSub.grace_ends_at, beforeSub.grace_ends_at, 'grace_ends_at must not change on retry');

      const dunningCount = Number(runPsql(`
        SELECT count(*) FROM public.dunning_notifications
        WHERE tenant_id = '${tenantOwnerA}' AND notification_type = 'initial';
      `));
      assert.strictEqual(dunningCount, 1, 'Retry does not create second initial notice');
    });

    test('1.4 Concurrent enqueue attempts for same episode are strictly blocked by UNIQUE constraint', () => {
      const sub = runPsqlJson(`SELECT jsonb_build_object('id', id, 'past_due_since', past_due_since) FROM public.subscriptions WHERE stripe_subscription_id = '${subStripeIdA}';`);
      
      const insertResult = runPsql(`
        SELECT public.record_dunning_intent(
          '${sub.id}'::uuid,
          '${tenantOwnerA}'::uuid,
          '${sub.past_due_since}'::timestamptz,
          'initial',
          'Duplicate test',
          'Duplicate test body'
        );
      `);
      // When ON CONFLICT DO NOTHING occurs, record_dunning_intent returns NULL
      assert.strictEqual(insertResult, '', 'Concurrent duplicate insert returns NULL (no duplicate created)');

      const dunningCount = Number(runPsql(`
        SELECT count(*) FROM public.dunning_notifications
        WHERE subscription_id = '${sub.id}' AND notification_type = 'initial';
      `));
      assert.strictEqual(dunningCount, 1);
    });

    test('1.5 Trial account cannot generate dunning notices', () => {
      // Trial accounts have NO subscriptions row in public.subscriptions
      const scanRes = runPsqlJson(`SELECT public.scan_and_enqueue_dunning_reminders();`);
      const trialDunning = Number(runPsql(`
        SELECT count(*) FROM public.dunning_notifications WHERE tenant_id = '${tenantTrial}';
      `));
      assert.strictEqual(trialDunning, 0, 'Trial account has 0 dunning notices');
    });

  });

  // ============================================================================
  // 2. REMINDER WINDOWS TEST MATRIX (Section 54 & 55)
  // ============================================================================
  describe('Gate 2: Deterministic Reminder Windows & Grace Expiry', () => {

    test('2.1 More than 3 days remaining -> zero reminders enqueued', () => {
      // Ensure subscription has 5 days remaining (grace_ends_at = NOW() + 5 days)
      runPsql(`
        UPDATE public.subscriptions
        SET grace_ends_at = NOW() + INTERVAL '5 days'
        WHERE stripe_subscription_id = '${subStripeIdA}';
      `);

      const scanRes = runPsqlJson(`SELECT public.scan_and_enqueue_dunning_reminders();`);
      assert.strictEqual(scanRes.enqueued_three_day, 0);
      assert.strictEqual(scanRes.enqueued_one_day, 0);
      assert.strictEqual(scanRes.enqueued_expired, 0);
    });

    test('2.2 Inside 3-day window (<=3d and >1d) -> exactly one THREE_DAY reminder enqueued', () => {
      // Set grace_ends_at = NOW() + 2 days (2 days remaining, inside [1d, 3d])
      runPsql(`
        UPDATE public.subscriptions
        SET grace_ends_at = NOW() + INTERVAL '2 days'
        WHERE stripe_subscription_id = '${subStripeIdA}';
      `);

      const scanRes = runPsqlJson(`SELECT public.scan_and_enqueue_dunning_reminders();`);
      assert.strictEqual(scanRes.enqueued_three_day, 1, 'Should enqueue 1 three_day reminder');
      assert.strictEqual(scanRes.enqueued_one_day, 0);

      // Repeat scan must not duplicate
      const repeatRes = runPsqlJson(`SELECT public.scan_and_enqueue_dunning_reminders();`);
      assert.strictEqual(repeatRes.enqueued_three_day, 0, 'Repeat scan enqueues 0 duplicates');
    });

    test('2.3 Inside 1-day window (<=1d and >0) -> exactly one ONE_DAY reminder enqueued', () => {
      // Set grace_ends_at = NOW() + 12 hours (12 hours remaining, inside [0, 1d])
      runPsql(`
        UPDATE public.subscriptions
        SET grace_ends_at = NOW() + INTERVAL '12 hours'
        WHERE stripe_subscription_id = '${subStripeIdA}';
      `);

      const scanRes = runPsqlJson(`SELECT public.scan_and_enqueue_dunning_reminders();`);
      assert.strictEqual(scanRes.enqueued_one_day, 1, 'Should enqueue 1 one_day reminder');

      // Repeat scan must not duplicate
      const repeatRes = runPsqlJson(`SELECT public.scan_and_enqueue_dunning_reminders();`);
      assert.strictEqual(repeatRes.enqueued_one_day, 0, 'Repeat scan enqueues 0 duplicates');
    });

    test('2.4 At or after grace_ends_at boundary -> exactly one GRACE_EXPIRED notice enqueued', () => {
      // Set grace_ends_at = NOW() - 1 hour (expired)
      runPsql(`
        UPDATE public.subscriptions
        SET grace_ends_at = NOW() - INTERVAL '1 hour'
        WHERE stripe_subscription_id = '${subStripeIdA}';
      `);

      const scanRes = runPsqlJson(`SELECT public.scan_and_enqueue_dunning_reminders();`);
      assert.strictEqual(scanRes.enqueued_expired, 1, 'Should enqueue 1 grace_expired notice');

      // Repeat scan must not duplicate
      const repeatRes = runPsqlJson(`SELECT public.scan_and_enqueue_dunning_reminders();`);
      assert.strictEqual(repeatRes.enqueued_expired, 0, 'Repeat scan enqueues 0 duplicates');
    });

  });

  // ============================================================================
  // 3. RECOVERY TEST MATRIX (Section 56)
  // ============================================================================
  describe('Gate 3: Recovery Transitions & Stale Reminder Invalidation', () => {

    test('3.1 Transition past_due -> active creates RECOVERY notice exactly once for episode', () => {
      const recRes = runPsqlJson(`
        SELECT public.sync_subscription_atomic(
          '${tenantOwnerA}'::uuid,
          '${subStripeIdA}',
          'cus_test_a',
          'price_1TVtOWPKG6q10UjrQErPgyKO',
          'prod_test_starter',
          'active',
          NOW(),
          NOW() + INTERVAL '30 days',
          false,
          'test',
          NOW() + INTERVAL '20 minutes'
        );
      `);
      assert.strictEqual(recRes.ok, true);
      assert.strictEqual(recRes.status, 'active');
      assert.strictEqual(recRes.audit_action, 'billing.grace_recovered');

      const recoveryCount = Number(runPsql(`
        SELECT count(*) FROM public.dunning_notifications
        WHERE tenant_id = '${tenantOwnerA}' AND notification_type = 'recovery';
      `));
      assert.strictEqual(recoveryCount, 1, 'Should create 1 recovery dunning record');
    });

    test('3.2 Repeat active update does NOT create duplicate RECOVERY notice', () => {
      const recRes2 = runPsqlJson(`
        SELECT public.sync_subscription_atomic(
          '${tenantOwnerA}'::uuid,
          '${subStripeIdA}',
          'cus_test_a',
          'price_1TVtOWPKG6q10UjrQErPgyKO',
          'prod_test_starter',
          'active',
          NOW(),
          NOW() + INTERVAL '30 days',
          false,
          'test',
          NOW() + INTERVAL '30 minutes'
        );
      `);
      assert.strictEqual(recRes2.ok, true);
      assert.strictEqual(recRes2.audit_action, null, 'No new audit action on repeated active');

      const recoveryCount = Number(runPsql(`
        SELECT count(*) FROM public.dunning_notifications
        WHERE tenant_id = '${tenantOwnerA}' AND notification_type = 'recovery';
      `));
      assert.strictEqual(recoveryCount, 1, 'Recovery count remains strictly 1');
    });

    test('3.3 Stale delinquency reminder fails pre-send check if subscription recovered', () => {
      // Find an unprocessed reminder from episode A
      const reminderId = runPsql(`
        SELECT id FROM public.dunning_notifications
        WHERE tenant_id = '${tenantOwnerA}' AND notification_type = 'three_day'
        LIMIT 1;
      `);
      assert.ok(reminderId, 'Should find existing three_day dunning id');

      // Set it to processing with mock claim token
      const claimToken = 'worker-test:12345';
      runPsql(`
        UPDATE public.dunning_notifications
        SET status = 'processing', claim_token = '${claimToken}', claimed_at = NOW()
        WHERE id = '${reminderId}';
      `);

      // Pre-send eligibility recheck must FAIL because subscription is now 'active', not 'past_due'
      const checkRes = runPsqlJson(`
        SELECT public.check_dunning_presend_eligibility('${reminderId}'::uuid, '${claimToken}');
      `);
      assert.strictEqual(checkRes.eligible, false, 'Pre-send check must reject reminder for recovered subscription');
      assert.strictEqual(checkRes.reason, 'subscription_no_longer_past_due');

      const statusAfter = runPsql(`SELECT status FROM public.dunning_notifications WHERE id = '${reminderId}';`);
      assert.strictEqual(statusAfter, 'canceled', 'Stale reminder must be marked canceled');
    });

    test('3.4 New delinquency episode later receives a NEW distinct past_due_since and NEW initial notice', () => {
      // Transition again to past_due (Second episode)
      const res2 = runPsqlJson(`
        SELECT public.sync_subscription_atomic(
          '${tenantOwnerA}'::uuid,
          '${subStripeIdA}',
          'cus_test_a',
          'price_1TVtOWPKG6q10UjrQErPgyKO',
          'prod_test_starter',
          'past_due',
          NOW(),
          NOW() + INTERVAL '30 days',
          false,
          'test',
          NOW() + INTERVAL '2 hours'
        );
      `);
      assert.strictEqual(res2.ok, true);
      assert.strictEqual(res2.status, 'past_due');
      assert.strictEqual(res2.audit_action, 'billing.grace_started');

      const totalInitialCount = Number(runPsql(`
        SELECT count(*) FROM public.dunning_notifications
        WHERE tenant_id = '${tenantOwnerA}' AND notification_type = 'initial';
      `));
      assert.strictEqual(totalInitialCount, 2, 'Total 2 initial notices across 2 separate episodes');
    });

  });

  // ============================================================================
  // 4. ATOMIC CLAIMS & FENCING TEST MATRIX (Section 57)
  // ============================================================================
  describe('Gate 4: Worker Claims, Fencing Tokens & Lifecycle Completion', () => {

    test('4.1 claim_next_dunning_notification atomically claims with unique fencing token', () => {
      const claim = runPsqlJson(`
        SELECT row_to_json(t) FROM (
          SELECT * FROM public.claim_next_dunning_notification('worker-node-1', 300)
        ) t;
      `);
      assert.ok(claim.id, 'Should claim a valid dunning notification');
      assert.strictEqual(claim.status, 'processing');
      assert.ok(claim.claim_token.startsWith('worker-node-1:'), 'Token must contain worker prefix');

      // Second concurrent claim cannot claim the same record
      const claim2 = runPsql(`
        SELECT id FROM public.claim_next_dunning_notification('worker-node-2', 300);
      `);
      assert.notStrictEqual(claim2, claim.id, 'Second worker must NOT claim the same record');
    });

    test('4.2 complete_dunning_notification rejects invalid claim token', () => {
      const dn = runPsqlJson(`
        SELECT jsonb_build_object('id', id, 'claim_token', claim_token)
        FROM public.dunning_notifications WHERE status = 'processing' LIMIT 1;
      `);
      assert.ok(dn.id);

      const fakeToken = 'wrong-worker:fake-token';
      const completeRes = runPsql(`
        SELECT public.complete_dunning_notification('${dn.id}'::uuid, '${fakeToken}', 'msg_resend_123');
      `);
      assert.strictEqual(completeRes, 'f', 'Completion with wrong token must return false');

      const status = runPsql(`SELECT status FROM public.dunning_notifications WHERE id = '${dn.id}';`);
      assert.strictEqual(status, 'processing', 'Status remains processing');
    });

    test('4.3 complete_dunning_notification succeeds with valid claim token and persists message ID', () => {
      const dn = runPsqlJson(`
        SELECT jsonb_build_object('id', id, 'claim_token', claim_token)
        FROM public.dunning_notifications WHERE status = 'processing' LIMIT 1;
      `);

      const completeRes = runPsql(`
        SELECT public.complete_dunning_notification('${dn.id}'::uuid, '${dn.claim_token}', 'msg_resend_99999');
      `);
      assert.strictEqual(completeRes, 't', 'Completion with correct token must return true');

      const after = runPsqlJson(`
        SELECT jsonb_build_object('status', status, 'provider_msg_id', provider_message_id)
        FROM public.dunning_notifications WHERE id = '${dn.id}';
      `);
      assert.strictEqual(after.status, 'sent');
      assert.strictEqual(after.provider_msg_id, 'msg_resend_99999');
    });

    test('4.4 fail_dunning_notification sets retry when attempts < max_attempts', () => {
      const claim = runPsqlJson(`
        SELECT row_to_json(t) FROM (
          SELECT * FROM public.claim_next_dunning_notification('worker-fail-test', 300)
        ) t;
      `);
      assert.ok(claim.id, 'Worker must claim a dunning record');

      const failRes = runPsql(`
        SELECT public.fail_dunning_notification(
          '${claim.id}'::uuid,
          '${claim.claim_token}',
          'rate_limit',
          '429',
          'Resend rate limit exceeded',
          true,
          120
        );
      `);
      assert.strictEqual(failRes, 't');

      const afterFail = runPsqlJson(`
        SELECT jsonb_build_object('status', status, 'category', last_error_category, 'code', last_error_code)
        FROM public.dunning_notifications WHERE id = '${claim.id}';
      `);
      assert.strictEqual(afterFail.status, 'retry');
      assert.strictEqual(afterFail.category, 'rate_limit');
      assert.strictEqual(afterFail.code, '429');
    });

  });

  // ============================================================================
  // 5. IN-APP PERSISTENT NOTIFICATIONS MATRIX (Section 59)
  // ============================================================================
  describe('Gate 5: In-App Persistent Notifications & Multi-Admin Fanout', () => {

    test('5.1 In-app notification is delivered to both tenant owner AND tenant admin', () => {
      const ownerNotifCount = Number(runPsql(`
        SELECT count(*) FROM public.notifications
        WHERE user_id = '${tenantOwnerA}' AND type LIKE 'billing_%';
      `));
      assert.ok(ownerNotifCount >= 1, 'Owner received billing in-app notification');

      const adminNotifCount = Number(runPsql(`
        SELECT count(*) FROM public.notifications
        WHERE user_id = '${tenantAdminA}' AND type LIKE 'billing_%';
      `));
      assert.ok(adminNotifCount >= 1, 'Tenant admin received billing in-app notification');
    });

    test('5.2 In-app notification unique_key prevents duplicate rows per user and event', () => {
      const countBefore = Number(runPsql(`
        SELECT count(*) FROM public.notifications
        WHERE user_id = '${tenantOwnerA}' AND type = 'billing_initial';
      `));

      // Attempt duplicate emission
      const sub = runPsqlJson(`SELECT jsonb_build_object('id', id, 'past_due_since', past_due_since) FROM public.subscriptions WHERE stripe_subscription_id = '${subStripeIdA}';`);
      runPsql(`
        SELECT public.emit_in_app_billing_notification(
          '${sub.id}'::uuid,
          '${tenantOwnerA}'::uuid,
          '${sub.past_due_since}'::timestamptz,
          'initial',
          'Duplicate test',
          'Duplicate test message'
        );
      `);

      const countAfter = Number(runPsql(`
        SELECT count(*) FROM public.notifications
        WHERE user_id = '${tenantOwnerA}' AND type = 'billing_initial';
      `));
      assert.strictEqual(countAfter, countBefore, 'In-app unique_key strictly prevents duplicates');
    });

  });

  // ============================================================================
  // 6. TENANCY & SECURITY MATRIX (Section 58 & 60)
  // ============================================================================
  describe('Gate 6: Cross-Tenant Isolation, RLS & Schema Constraints', () => {

    test('6.1 Tenant B cannot read Tenant A dunning records under RLS', () => {
      // Create Tenant B subscription and delinquency
      runPsqlJson(`
        SELECT public.sync_subscription_atomic(
          '${tenantOwnerB}'::uuid,
          '${subStripeIdB}',
          'cus_test_b',
          'price_1TVtOWPKG6q10UjrQErPgyKO',
          'prod_test_starter',
          'past_due',
          NOW(),
          NOW() + INTERVAL '30 days',
          false,
          'test',
          NOW()
        );
      `);

      // Query as Tenant B under auth.uid()
      const tenantBVisibleCount = Number(runPsql(`
        BEGIN;
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '${tenantOwnerB}';
        SELECT count(*) FROM public.dunning_notifications WHERE tenant_id = '${tenantOwnerA}';
      `));
      assert.strictEqual(tenantBVisibleCount, 0, 'Tenant B cannot see any of Tenant A records');
    });

    test('6.2 Direct mutation by non-service-role user is blocked by RLS/privileges', () => {
      assert.throws(() => {
        runPsql(`
          BEGIN;
          SET LOCAL ROLE authenticated;
          SET LOCAL "request.jwt.claim.sub" = '${tenantOwnerA}';
          INSERT INTO public.dunning_notifications (
            subscription_id, tenant_id, past_due_since, notification_type, recipient_user_id
          ) VALUES (
            gen_random_uuid(), '${tenantOwnerA}'::uuid, NOW(), 'initial', '${tenantOwnerA}'::uuid
          );
          COMMIT;
        `);
      }, /permission denied/i, 'Direct authenticated INSERT must be rejected');
    });

    test('6.3 Invalid notification_type is rejected by check constraint', () => {
      const sub = runPsqlJson(`SELECT jsonb_build_object('id', id, 'past_due_since', past_due_since) FROM public.subscriptions WHERE stripe_subscription_id = '${subStripeIdA}';`);

      assert.throws(() => {
        runPsql(`
          SELECT public.record_dunning_intent(
            '${sub.id}'::uuid,
            '${tenantOwnerA}'::uuid,
            '${sub.past_due_since}'::timestamptz,
            'malicious_arbitrary_type',
            'Title',
            'Message'
          );
        `);
      }, /(Tipo de notifica|inv.*lido|invalid)/i);
    });

    test('6.4 12-Month retention purge function purges only older resolved records', () => {
      // Insert old completed notification from 400 days ago
      const sub = runPsqlJson(`SELECT jsonb_build_object('id', id) FROM public.subscriptions WHERE stripe_subscription_id = '${subStripeIdA}';`);
      runPsql(`
        INSERT INTO public.dunning_notifications (
          subscription_id, tenant_id, past_due_since, notification_type, status, recipient_user_id, created_at, updated_at
        ) VALUES (
          '${sub.id}'::uuid, '${tenantOwnerA}'::uuid, NOW() - INTERVAL '405 days', 'initial', 'sent', '${tenantOwnerA}'::uuid, NOW() - INTERVAL '400 days', NOW() - INTERVAL '400 days'
        );
      `);

      const deletedCount = Number(runPsql(`SELECT public.purge_expired_dunning_records(365);`));
      assert.ok(deletedCount >= 1, 'Purges old sent records older than 365 days');

      // Ensure active/pending dunning records remain
      const remainingCount = Number(runPsql(`SELECT count(*) FROM public.dunning_notifications;`));
      assert.ok(remainingCount > 0, 'Recent records are preserved');
    });

  });

});
