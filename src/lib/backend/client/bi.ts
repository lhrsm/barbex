/**
 * BARBEX — BUSINESS INTELLIGENCE DIRECT CLIENT ADAPTER
 * Computes analytics and aggregates directly using Supabase Client with RLS.
 * Replaces legacy Server Function roundtrips with native client queries.
 */

import { supabase } from "@/integrations/supabase/client";
import { computeTotals, computeDre, breakdowns, dailySeries } from "@/components/finances/erp/engine";

export interface BIInputParams {
  start_date: string;
  end_date: string;
  compare_start_date?: string;
  compare_end_date?: string;
  filters?: Record<string, any>;
}

export async function getBIAnalyticsClient(params: BIInputParams) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Usuário não autenticado.");

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, role, tenant_id")
    .eq("id", user.id)
    .single();

  if (profErr || !profile) throw new Error("Perfil de usuário não encontrado.");

  const tenantId = profile.tenant_id || (profile.role === "tenant_admin" ? profile.id : null);

  if (!tenantId && profile.role !== "super_admin") {
    throw new Error("Contexto de tenant não resolvido para o perfil: " + profile.role);
  }

  const fetchPeriodData = async (start: string, end: string) => {
    let transQuery = supabase.from("transactions").select("*").gte("date", start).lte("date", end);
    let apptQuery = supabase.from("appointments").select("*, services:service_id(name), customers:customer_id(name)").gte("start_time", start).lte("start_time", end);
    let psQuery = supabase.from("product_sales").select("*").gte("created_at", start).lte("created_at", end);
    let cbQuery = supabase.from("cashback_transactions").select("*").gte("created_at", start).lte("created_at", end);
    let credQuery = supabase.from("credit_transactions").select("*").gte("created_at", start).lte("created_at", end);
    let subQuery = supabase.from("customer_subscriptions").select("*");
    let commQuery = supabase.from("barber_commissions").select("*").gte("created_at", start).lte("created_at", end);
    let barbQuery = supabase.from("profiles").select("id, full_name").eq("role", "barber");

    if (tenantId) {
      transQuery = transQuery.eq("tenant_id", tenantId);
      apptQuery = apptQuery.eq("tenant_id", tenantId);
      psQuery = psQuery.eq("tenant_id", tenantId);
      cbQuery = cbQuery.eq("tenant_id", tenantId);
      credQuery = credQuery.eq("tenant_id", tenantId);
      subQuery = subQuery.eq("tenant_id", tenantId);
      commQuery = commQuery.eq("tenant_id", tenantId);
      barbQuery = barbQuery.eq("tenant_id", tenantId);
    }

    const [
      transactions,
      appointments,
      productSales,
      cashback,
      credits,
      subscriptions,
      commissions,
      barbers,
    ] = await Promise.all([
      transQuery,
      apptQuery,
      psQuery,
      cbQuery,
      credQuery,
      subQuery,
      commQuery,
      barbQuery,
    ]);

    const t = transactions.data || [];
    const app = (appointments.data as any[]) || [];
    const ps = productSales.data || [];
    const comm = (commissions.data as any[]) || [];

    const totals = computeTotals({
      transactions: t,
      appointments: app,
      commissions: comm.map((c) => ({ ...c, commission_amount: c.commission_amount || 0 })),
      productSales: ps,
      cashback: cashback.data || [],
      credits: credits.data || [],
      subscriptions: subscriptions.data || [],
    });

    const dre = computeDre(totals);
    const b = breakdowns({
      transactions: t,
      appointments: app,
      productSales: ps,
      commissions: comm,
    });

    const series = dailySeries(t, { start: new Date(start), end: new Date(end) });

    return {
      totals,
      dre,
      breakdowns: b,
      series,
      barbersCount: barbers.data?.length || 0,
    };
  };

  const current = await fetchPeriodData(params.start_date, params.end_date);
  let comparison: any = null;

  if (params.compare_start_date && params.compare_end_date) {
    comparison = await fetchPeriodData(params.compare_start_date, params.compare_end_date);
  }

  return {
    current,
    comparison,
    period: { start: params.start_date, end: params.end_date },
    metadata: {
      last_sync: new Date().toISOString(),
      currency: "BRL",
    },
  };
}
