/**
 * BARBEX — INTEGRATIONS DIRECT CLIENT ADAPTER
 * Fetches integration health for WhatsApp, payment gateways, and automations via Direct Supabase Client + RLS.
 */

import { supabase } from "@/integrations/supabase/client";

export interface IntegrationHealthResult {
  whatsapp: {
    status: "active" | "not_configured";
    health: "healthy" | "degraded";
    lastActivity: string;
  };
  payments: Array<{
    id: string;
    provider: string;
    status: "active" | "error";
    environment: string;
    lastSync: string | null;
  }>;
  timestamp: string;
}

/**
 * Retrieves health telemetry for integrations belonging to the tenant.
 */
export async function getIntegrationHealthClient(tenantId: string): Promise<IntegrationHealthResult> {
  const [profileRes, whatsappRes, gatewaysRes, logsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("whatsapp_enabled")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("whatsapp_instances")
      .select("id, status, updated_at")
      .eq("tenant_id", tenantId)
      .limit(1),
    supabase
      .from("payment_gateways")
      .select("id, provider, status, environment, last_sync_at")
      .eq("tenant_id", tenantId),
    supabase
      .from("automation_logs")
      .select("status")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const profile = profileRes.data;
  const instance = whatsappRes.data?.[0];
  const gateways = gatewaysRes.data || [];
  const logs = logsRes.data || [];

  const whatsappStatus = profile?.whatsapp_enabled && instance ? "active" : "not_configured";
  const recentFailures = logs.filter((l: any) => l.status === "error").length;

  return {
    whatsapp: {
      status: whatsappStatus,
      health: recentFailures > 3 ? "degraded" : "healthy",
      lastActivity: new Date().toISOString(),
    },
    payments: gateways.map((g: any) => ({
      id: g.id,
      provider: g.provider,
      status: g.status === "connected" ? "active" : "error",
      environment: g.environment,
      lastSync: g.last_sync_at,
    })),
    timestamp: new Date().toISOString(),
  };
}
