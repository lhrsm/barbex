/**
 * BARBEX — PROFESSIONAL TIME OFF DIRECT CLIENT ADAPTER
 * Manages absences, breaks, and time-off conflicts directly via Supabase Client and RPC.
 */

import { supabase } from "@/integrations/supabase/client";

export interface TimeOffRecord {
  id: string;
  professional_id: string;
  type: string;
  title: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  status: string;
  approval_status: string;
  created_at: string;
}

export interface CheckConflictsParams {
  professionalId: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Checks for scheduling conflicts against professional time off using the PostgreSQL RPC.
 */
export async function checkTimeOffConflictsClient(params: CheckConflictsParams) {
  const { data: conflicts, error } = await supabase.rpc("check_time_off_conflicts", {
    p_professional_id: params.professionalId,
    p_starts_at: params.startsAt,
    p_ends_at: params.endsAt,
  });

  if (error) throw error;
  return (conflicts || []) as any[];
}
