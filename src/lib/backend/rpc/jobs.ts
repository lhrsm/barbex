/**
 * BARBEX — BACKGROUND JOB PRODUCER ADAPTER
 * Provides secure, validated enqueueing of background jobs into the Supabase job engine.
 * Leverages the transactional `enqueue_background_job_safe` RPC and queue allowlist.
 * ZERO direct table writes or unvalidated arbitrary queues.
 */

import { supabase as defaultSupabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ALLOWED_JOB_QUEUES = [
  "email_notification",
  "push_notification",
  "whatsapp_notification",
  "review_request",
  "review_reminder",
  "subscription_reminder",
  "addons_cleanup",
  "admin_digest",
  "reconcile_stuck_jobs",
  "default",
] as const;

export type AllowedJobQueue = (typeof ALLOWED_JOB_QUEUES)[number];

export interface EnqueueJobParams {
  queue_name: AllowedJobQueue | string;
  payload?: Record<string, any>;
  tenant_id?: string | null;
  priority?: number;
  next_run_at?: string;
  max_attempts?: number;
}

export interface EnqueueJobResult {
  ok: boolean;
  jobId?: string;
  error?: string;
}

export interface ReconcileStuckJobsResult {
  ok: boolean;
  repairedCount: number;
  failedCount: number;
  error?: string;
}

/**
 * Safely enqueues a background job via the `enqueue_background_job_safe` RPC.
 */
export async function enqueueBackgroundJob(
  params: EnqueueJobParams,
  options: { client?: SupabaseClient } = {}
): Promise<EnqueueJobResult> {
  const sb = options.client || defaultSupabase;

  const queueName = params.queue_name;
  if (!ALLOWED_JOB_QUEUES.includes(queueName as AllowedJobQueue)) {
    return {
      ok: false,
      error: `Queue '${queueName}' não é permitida. Filas válidas: ${ALLOWED_JOB_QUEUES.join(", ")}`,
    };
  }

  try {
    const { data, error } = await sb.rpc("enqueue_background_job_safe", {
      p_queue_name: queueName,
      p_payload: params.payload || {},
      p_tenant_id: params.tenant_id ?? null,
      p_priority: params.priority ?? 0,
      p_next_run_at: params.next_run_at || new Date().toISOString(),
      p_max_attempts: params.max_attempts ?? 3,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, jobId: data as string };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Falha ao enfileirar background job." };
  }
}

/**
 * Triggers safe reconciliation of stuck background jobs via the `reconcile_stuck_background_jobs` RPC.
 */
export async function reconcileStuckJobs(
  timeoutMinutes: number = 15,
  options: { client?: SupabaseClient } = {}
): Promise<ReconcileStuckJobsResult> {
  const sb = options.client || defaultSupabase;

  try {
    const { data, error } = await sb.rpc("reconcile_stuck_background_jobs", {
      p_timeout_minutes: timeoutMinutes,
    });

    if (error) {
      return { ok: false, repairedCount: 0, failedCount: 0, error: error.message };
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

    return {
      ok: true,
      repairedCount: row?.repaired_count || 0,
      failedCount: row?.failed_count || 0,
    };
  } catch (err: any) {
    return {
      ok: false,
      repairedCount: 0,
      failedCount: 0,
      error: err?.message || "Falha na reconciliação de jobs presos.",
    };
  }
}
