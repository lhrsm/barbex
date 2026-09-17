/**
 * BARBEX — GATEWAY ADAPTER
 * Calls the `gateway-manager` Edge Function for tenant gateway connections
 * and customer subscription creation.
 */

import { invokeEdgeFunction, type EdgeResult } from "@/lib/backend/edge-client";

export interface TestGatewayConnectionParams {
  gatewayId: string;
}

export interface CreateCustomerSubscriptionParams {
  tenantId: string;
  planId: string;
  phone: string;
  email?: string;
  returnUrl: string;
}

export async function testGatewayConnectionClient(
  params: TestGatewayConnectionParams
): Promise<{ ok: boolean; message?: string; accountName?: string }> {
  const res = await invokeEdgeFunction<
    { action: string; gatewayId: string },
    { ok: boolean; message: string; accountName?: string }
  >("gateway-manager", {
    action: "test-connection",
    gatewayId: params.gatewayId,
  });

  if (!res.ok) {
    return { ok: false, message: res.message || "Falha ao testar conexão com o gateway." };
  }

  return {
    ok: res.data?.ok ?? true,
    message: res.data?.message,
    accountName: res.data?.accountName,
  };
}

export async function createCustomerSubscriptionClient(
  params: CreateCustomerSubscriptionParams
): Promise<{ checkoutUrl?: string; subscriptionId?: string; error?: string }> {
  const res = await invokeEdgeFunction<
    {
      action: string;
      tenantId: string;
      planId: string;
      phone: string;
      email?: string;
      returnUrl: string;
    },
    { subscriptionId: string; checkoutUrl: string; provider: string }
  >("gateway-manager", {
    action: "create-customer-subscription",
    ...params,
  });

  if (!res.ok) {
    return { error: res.message || "Falha ao criar assinatura." };
  }

  return {
    checkoutUrl: res.data?.checkoutUrl,
    subscriptionId: res.data?.subscriptionId,
  };
}
