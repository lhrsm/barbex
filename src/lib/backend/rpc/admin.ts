import { supabase } from "@/integrations/supabase/client";

export async function listAdminUpgradeRecommendationsClient(days = 90) {
  const { data, error } = await (supabase as any).rpc("admin_list_upgrade_recommendations", {
    p_days: days,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminListLgpdRequestsClient(params?: { status?: string; type?: string; tenant_id?: string }) {
  const { data, error } = await (supabase as any).rpc("admin_list_lgpd_requests", {
    p_status: params?.status || null,
    p_type: params?.type || null,
    p_tenant_id: params?.tenant_id || null,
  });
  if (error) throw new Error(error.message);
  return { items: data || [] };
}

export async function adminResolveLgpdRequestClient(params: {
  id: string;
  status: "in_progress" | "done" | "rejected";
  response?: string;
}) {
  const { data, error } = await (supabase as any).rpc("admin_resolve_lgpd_request", {
    p_request_id: params.id,
    p_status: params.status,
    p_response: params.response || null,
  });
  if (error) throw new Error(error.message);
  return { ok: !!data };
}
