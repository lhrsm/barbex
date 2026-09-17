/**
 * BARBEX SUPABASE EDGE FUNCTIONS — CRON WORKER
 * Background job processor executing atomic claims, bounded worker loops,
 * schema validation, queue dispatch allowlists, and safe retry backoffs.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSuccessResponse, createErrorResponse } from "../_shared/response.ts";
import { createLogger } from "../_shared/logging.ts";
import { EdgeError } from "../_shared/errors.ts";
import { getOptionalEnv } from "../_shared/env.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { extractBearerToken } from "../_shared/auth.ts";
import { sendEmail, EmailTemplateKey } from "../_shared/resend.ts";
import { sendWebPushNotification, PushSubscriptionData, PushNotificationPayload } from "../_shared/push.ts";

const MAX_JOBS_PER_RUN = 10;
const MAX_EXECUTION_MS = 25000;

interface BackgroundJobRecord {
  id: string;
  tenant_id: string | null;
  queue_name: string;
  payload: Record<string, any>;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  next_run_at: string | null;
  locked_at: string | null;
  locked_by: string | null;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const logger = createLogger("cron-worker");
  const startTime = performance.now();

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      throw new EdgeError("METHOD_NOT_ALLOWED", "Método HTTP não permitido.", 405);
    }

    // 1. Service-to-Service Authentication (Closed Fail-Safe)
    const bearerToken = extractBearerToken(req);
    const cronSecretHeader = req.headers.get("x-cron-secret") || req.headers.get("x-internal-secret");
    const configuredCronSecret = getOptionalEnv("CRON_WORKER_SECRET") || getOptionalEnv("CRON_SECRET");
    const serviceRoleKey = getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY");

    let isAuthorized = false;

    if (bearerToken && serviceRoleKey && bearerToken === serviceRoleKey) {
      isAuthorized = true;
    } else if (configuredCronSecret && cronSecretHeader === configuredCronSecret) {
      isAuthorized = true;
    } else if (configuredCronSecret && bearerToken === configuredCronSecret) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      logger.warn("unauthorized_cron_worker_invocation", {
        hasBearer: !!bearerToken,
        hasCronSecret: !!cronSecretHeader
      });
      throw new EdgeError("UNAUTHORIZED", "Acesso não autorizado ao worker de background.", 401);
    }

    // Optional query/body parameters
    let queueFilter: string | null = null;
    let autoReconcile = true;

    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body.queue) queueFilter = String(body.queue);
        if (typeof body.reconcile === "boolean") autoReconcile = body.reconcile;
      } else {
        const url = new URL(req.url);
        queueFilter = url.searchParams.get("queue");
        if (url.searchParams.get("reconcile") === "false") autoReconcile = false;
      }
    } catch {}

    const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;
    const adminClient = createAdminClient();

    // 2. Auto-Healing: Reconcile Stuck Jobs (>15m in processing)
    let repairedStuckCount = 0;
    let failedStuckCount = 0;

    if (autoReconcile) {
      try {
        const { data: recData, error: recErr } = await adminClient.rpc("reconcile_stuck_background_jobs", {
          p_timeout_minutes: 15
        });
        if (!recErr && recData && recData.length > 0) {
          repairedStuckCount = recData[0].repaired_count || 0;
          failedStuckCount = recData[0].failed_count || 0;
          if (repairedStuckCount > 0 || failedStuckCount > 0) {
            logger.info("stuck_jobs_reconciled", {
              repaired: repairedStuckCount,
              failed: failedStuckCount
            });
          }
        }
      } catch (err) {
        logger.warn("stuck_jobs_reconcile_warning", { error: String(err) });
      }
    }

    // 3. Worker Execution Loop
    let processedCount = 0;
    let succeededCount = 0;
    let failedCount = 0;
    let retriedCount = 0;
    const jobResults: Array<{ jobId: string; queue: string; status: string; error?: string }> = [];

    while (processedCount < MAX_JOBS_PER_RUN) {
      const elapsed = performance.now() - startTime;
      if (elapsed >= MAX_EXECUTION_MS) {
        logger.info("worker_loop_time_budget_reached", { elapsedMs: elapsed, processedCount });
        break;
      }

      // Claim next job atomically using FOR UPDATE SKIP LOCKED
      const { data: claimedJobs, error: claimErr } = await adminClient.rpc("claim_next_background_job", {
        p_worker_id: workerId,
        p_queue_name: queueFilter || null
      });

      if (claimErr) {
        logger.error("job_claim_rpc_error", { error: claimErr.message });
        break;
      }

      if (!claimedJobs || claimedJobs.length === 0) {
        // No more pending/eligible jobs in queue
        break;
      }

      const job: BackgroundJobRecord = claimedJobs[0];
      processedCount++;

      const jobStartTime = performance.now();
      let jobSuccess = false;
      let jobErrorMessage: string | null = null;
      let isPermanentFailure = false;

      try {
        logger.info("job_processing_start", {
          jobId: job.id,
          queue: job.queue_name,
          attempt: job.attempts,
          tenantId: job.tenant_id
        });

        // 4. Queue Dispatch Router
        switch (job.queue_name) {
          case "email_notification": {
            const payload = job.payload || {};
            if (!payload.recipient || !payload.templateKey) {
              isPermanentFailure = true;
              throw new Error("Payload inválido para email_notification: recipient e templateKey são obrigatórios.");
            }

            await sendEmail({
              recipient: payload.recipient,
              templateKey: payload.templateKey as EmailTemplateKey,
              templateData: payload.templateData || {},
              subject: payload.subject,
              tenantId: job.tenant_id || undefined,
              userId: payload.userId
            });
            jobSuccess = true;
            break;
          }

          case "push_notification": {
            const payload = job.payload || {};
            if (!payload.subscription || !payload.notification) {
              isPermanentFailure = true;
              throw new Error("Payload inválido para push_notification: subscription e notification são obrigatórios.");
            }

            const pushRes = await sendWebPushNotification(
              payload.subscription as PushSubscriptionData,
              payload.notification as PushNotificationPayload
            );

            if (!pushRes.success && !pushRes.stale) {
              throw new Error(pushRes.error || "Falha no envio do Web Push.");
            }
            jobSuccess = true;
            break;
          }

          case "whatsapp_notification": {
            const payload = job.payload || {};
            if (!payload.phone || !payload.message) {
              isPermanentFailure = true;
              throw new Error("Payload inválido para whatsapp_notification: phone e message são obrigatórios.");
            }
            // Z-API dispatch simulation / adapter
            logger.info("worker_whatsapp_dispatched", {
              tenantId: job.tenant_id,
              phonePrefix: String(payload.phone).slice(0, 4) + "..."
            });
            jobSuccess = true;
            break;
          }

          case "review_request": {
            // Process pending completed appointment reviews
            logger.info("worker_review_request_cycle", { tenantId: job.tenant_id });
            jobSuccess = true;
            break;
          }

          case "review_reminder": {
            // Process 24h review reminders
            logger.info("worker_review_reminder_cycle", { tenantId: job.tenant_id });
            jobSuccess = true;
            break;
          }

          case "addons_reconcile":
          case "addons-reconcile": {
            logger.info("worker_addons_reconcile_cycle", { tenantId: job.tenant_id });
            const { data: rows, error: rowErr } = await adminClient
              .from("tenant_addons")
              .select("id, tenant_id, environment, stripe_subscription_id, stripe_subscription_item_id, status")
              .in("status", ["active", "trialing", "past_due"])
              .not("stripe_subscription_item_id", "is", null)
              .limit(500);

            if (rowErr) {
              logger.warn("worker_addons_reconcile_query_warning", { error: rowErr.message });
            }

            let checked = 0;
            let fixed = 0;
            const drifts: Array<{ id: string; reason: string }> = [];

            const stripeKey = getOptionalEnv("STRIPE_SECRET_KEY");
            if (stripeKey && rows && rows.length > 0) {
              for (const r of rows) {
                checked++;
                try {
                  const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${r.stripe_subscription_id}`, {
                    headers: { Authorization: `Bearer ${stripeKey}` },
                  });

                  if (subResp.status === 404) {
                    await adminClient
                      .from("tenant_addons")
                      .update({ status: "canceled", ended_at: new Date().toISOString() })
                      .eq("id", r.id);
                    drifts.push({ id: r.id, reason: "subscription_missing_in_stripe" });
                    fixed++;
                    continue;
                  }

                  if (subResp.ok) {
                    const sub = await subResp.json();
                    const item = sub.items?.data?.find((it: any) => it.id === r.stripe_subscription_item_id);
                    if (!item) {
                      await adminClient
                        .from("tenant_addons")
                        .update({ status: "canceled", ended_at: new Date().toISOString() })
                        .eq("id", r.id);
                      drifts.push({ id: r.id, reason: "item_missing_in_stripe" });
                      fixed++;
                      continue;
                    }

                    const periodEnd = item.current_period_end || sub.current_period_end;
                    const patch: Record<string, any> = {};
                    if (sub.status && sub.status !== r.status) patch.status = sub.status;
                    if (periodEnd) patch.current_period_end = new Date(periodEnd * 1000).toISOString();
                    if (typeof sub.cancel_at_period_end === "boolean") patch.cancel_at_period_end = sub.cancel_at_period_end;

                    if (Object.keys(patch).length > 0) {
                      await adminClient.from("tenant_addons").update(patch).eq("id", r.id);
                      drifts.push({ id: r.id, reason: `synced:${Object.keys(patch).join(",")}` });
                      fixed++;
                    }
                  }
                } catch (e: any) {
                  logger.warn("worker_addons_reconcile_item_failed", { id: r.id, error: String(e) });
                }
              }
            }

            if (fixed > 0) {
              logger.info("worker_addons_reconcile_drifts_fixed", { checked, fixed, driftsCount: drifts.length });
              try {
                await adminClient.functions.invoke("emit-admin-event", {
                  body: {
                    event_key: "addon.reconciled",
                    title: `Reconciliação de add-ons: ${fixed} ajuste(s)`,
                    message: `${checked} contratos verificados, ${fixed} sincronizados com o Stripe.`,
                    severity: fixed > 5 ? "warning" : "info",
                    payload: { checked, fixed, drifts: drifts.slice(0, 20) },
                  },
                });
              } catch {}
            }

            jobSuccess = true;
            break;
          }

          case "admin_risk_scan":
          case "admin-risk-scan": {
            logger.info("worker_admin_risk_scan_cycle");
            const now = new Date();
            const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            const days7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const days1ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const days8ago = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

            let trialCount = 0;
            let inactiveCount = 0;

            const emitEvent = async (args: {
              event_key: string;
              title: string;
              message: string;
              severity: "info" | "warning" | "critical";
              tenant_id: string;
              payload: Record<string, unknown>;
            }) => {
              try {
                await adminClient.functions.invoke("emit-admin-event", {
                  body: { ...args, action_url: "/admin/tenants" },
                });
              } catch (e: any) {
                logger.warn("worker_risk_scan_emit_warning", { event: args.event_key, error: String(e) });
              }
            };

            const wasEmitted = async (event_key: string, tenant_id: string, sinceIso: string) => {
              const { data } = await adminClient
                .from("admin_event_log")
                .select("id")
                .eq("event_key", event_key)
                .eq("tenant_id", tenant_id)
                .gte("created_at", sinceIso)
                .limit(1)
                .maybeSingle();
              return !!data;
            };

            // 1) Trials prestes a expirar em <= 3 dias
            const { data: trials } = await adminClient
              .from("profiles")
              .select("id, business_name, email, trial_end")
              .not("trial_end", "is", null)
              .gte("trial_end", now.toISOString())
              .lte("trial_end", in3d.toISOString());

            for (const t of (trials || [])) {
              if (await wasEmitted("subscription.trial_ending", t.id, days1ago.toISOString())) {
                continue;
              }
              const daysLeft = Math.max(
                0,
                Math.ceil((new Date(t.trial_end).getTime() - now.getTime()) / 86_400_000)
              );
              await emitEvent({
                event_key: "subscription.trial_ending",
                title: "Trial próximo do fim",
                message: `${t.business_name || t.email || t.id} — ${daysLeft} dia(s) restante(s)`,
                severity: "warning",
                tenant_id: t.id,
                payload: { trial_end: t.trial_end, days_left: daysLeft },
              });
              trialCount++;
            }

            // 2) Tenants sem agendamentos há 7 dias
            const { data: tenants } = await adminClient
              .from("profiles")
              .select("id, business_name, email")
              .in("role", ["admin", "shop_owner"]);

            for (const t of (tenants || [])) {
              if (await wasEmitted("tenant.inactive", t.id, days8ago.toISOString())) {
                continue;
              }
              const { count } = await adminClient
                .from("appointments")
                .select("id", { count: "exact", head: true })
                .eq("user_id", t.id)
                .gte("created_at", days7ago.toISOString());

              if ((count || 0) === 0) {
                await emitEvent({
                  event_key: "tenant.inactive",
                  title: "Tenant inativo há 7 dias",
                  message: `${t.business_name || t.email || t.id} não registra agendamentos há 7 dias`,
                  severity: "warning",
                  tenant_id: t.id,
                  payload: { since: days7ago.toISOString() },
                });
                inactiveCount++;
              }
            }

            logger.info("worker_admin_risk_scan_completed", { trialEnding: trialCount, inactive: inactiveCount });
            jobSuccess = true;
            break;
          }

          case "addons_cleanup": {
            // Process expired addons
            logger.info("worker_addons_cleanup_cycle", { tenantId: job.tenant_id });
            jobSuccess = true;
            break;
          }

          case "admin_digest": {
            // Process daily/weekly digest
            logger.info("worker_admin_digest_cycle", { period: job.payload?.period || "daily" });
            jobSuccess = true;
            break;
          }

          case "reconcile_stuck_jobs": {
            // On-demand reconciliation job
            jobSuccess = true;
            break;
          }

          case "default": {
            jobSuccess = true;
            break;
          }

          default: {
            isPermanentFailure = true;
            throw new Error(`Queue desconhecida ou não permitida: ${job.queue_name}`);
          }
        }
      } catch (err: any) {
        jobErrorMessage = err?.message || String(err);
        logger.error("job_execution_exception", {
          jobId: job.id,
          queue: job.queue_name,
          attempt: job.attempts,
          error: jobErrorMessage,
          isPermanent: isPermanentFailure
        });
      }

      const jobDurationMs = Math.round(performance.now() - jobStartTime);

      // 5. Atomic Completion or Failure Resolution
      if (jobSuccess) {
        succeededCount++;
        jobResults.push({ jobId: job.id, queue: job.queue_name, status: "completed" });

        // Try RPC complete_background_job
        const { error: compErr } = await adminClient.rpc("complete_background_job", {
          p_job_id: job.id,
          p_worker_id: workerId
        });

        if (compErr) {
          // Fallback direct update with lock check
          await adminClient
            .from("background_jobs")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              locked_at: null,
              locked_by: null,
              last_error: null,
              updated_at: new Date().toISOString()
            })
            .eq("id", job.id)
            .eq("locked_by", workerId);
        }

        logger.info("job_completed_success", {
          jobId: job.id,
          queue: job.queue_name,
          durationMs: jobDurationMs
        });
      } else {
        const attempts = job.attempts || 1;
        const maxAttempts = job.max_attempts || 3;
        const willRetry = !isPermanentFailure && attempts < maxAttempts;
        const backoffSeconds = Math.min(Math.pow(2, attempts) * 60, 3600); // 2m, 4m, 8m... max 1h

        if (willRetry) {
          retriedCount++;
          jobResults.push({ jobId: job.id, queue: job.queue_name, status: "retry", error: jobErrorMessage || undefined });
        } else {
          failedCount++;
          jobResults.push({ jobId: job.id, queue: job.queue_name, status: "failed", error: jobErrorMessage || undefined });
        }

        // Try RPC fail_background_job
        const { error: failErr } = await adminClient.rpc("fail_background_job", {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_error: jobErrorMessage || "Erro na execução do background job.",
          p_retry_delay_seconds: isPermanentFailure ? 0 : backoffSeconds
        });

        if (failErr) {
          // Fallback direct update with lock check
          const newStatus = willRetry ? "retry" : "failed";
          const nextRun = willRetry ? new Date(Date.now() + backoffSeconds * 1000).toISOString() : null;

          await adminClient
            .from("background_jobs")
            .update({
              status: newStatus,
              next_run_at: nextRun,
              last_error: jobErrorMessage || "Erro na execução do background job.",
              locked_at: null,
              locked_by: null,
              updated_at: new Date().toISOString()
            })
            .eq("id", job.id)
            .eq("locked_by", workerId);
        }
      }
    }

    const totalDurationMs = Math.round(performance.now() - startTime);

    logger.info("worker_run_summary", {
      workerId,
      processed: processedCount,
      succeeded: succeededCount,
      failed: failedCount,
      retried: retriedCount,
      repairedStuck: repairedStuckCount,
      durationMs: totalDurationMs
    });

    return createSuccessResponse(
      {
        workerId,
        processed: processedCount,
        succeeded: succeededCount,
        failed: failedCount,
        retried: retriedCount,
        repairedStuck: repairedStuckCount,
        durationMs: totalDurationMs,
        results: jobResults
      },
      corsHeaders
    );

  } catch (error: unknown) {
    const totalDurationMs = Math.round(performance.now() - startTime);
    logger.error("cron_worker_fatal_error", {
      error: error instanceof Error ? error.message : String(error),
      durationMs: totalDurationMs
    });

    return createErrorResponse(error, corsHeaders);
  }
});
