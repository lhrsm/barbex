/**
 * BARBEX — Z-API WHATSAPP EDGE ADAPTER
 * Adapts client-side WhatsApp messaging and instance management operations
 * to communicate directly with Supabase Edge Function 'zapi-send'.
 *
 * Enforces tenant authority, zero client secret exposure, phone normalization,
 * and standard error contracts.
 */

import { invokeEdgeFunction, type EdgeInvokeOptions } from "../edge-client";

export interface ZApiButtonOption {
  id: string;
  label: string;
}

export interface SendZApiTextInput {
  phone: string;
  message: string;
  customerId?: string;
  tenantId?: string;
  instanceId?: string;
}

export interface SendZApiButtonInput {
  phone: string;
  message: string;
  buttons?: ZApiButtonOption[];
  customerId?: string;
  tenantId?: string;
  instanceId?: string;
}

export interface SendZApiImageInput {
  phone: string;
  imageUrl: string;
  caption?: string;
  customerId?: string;
  tenantId?: string;
  instanceId?: string;
}

export interface SendZApiTestMessageInput {
  phone: string;
  message?: string;
  instanceId?: string;
  tenantId?: string;
}

export interface SendZApiTestButtonInput {
  phone: string;
  message?: string;
  buttons?: ZApiButtonOption[];
  instanceId?: string;
  tenantId?: string;
}

export interface CheckZApiStatusInput {
  instanceId?: string;
  tenantId?: string;
}

export interface SetZApiWebhookInput {
  webhookUrl?: string;
  instanceId?: string;
  tenantId?: string;
}

export interface DisconnectZApiInput {
  instanceId?: string;
  tenantId?: string;
}

export interface GetZApiQRCodeInput {
  instanceId?: string;
  tenantId?: string;
}

export type ZApiResult<T = Record<string, unknown>> =
  | ({ ok: true; success: true } & T)
  | { ok: false; success?: false; error: string; code?: string };

function unwrapInput<T>(input: T | { data: T }): T {
  if (input && typeof input === "object" && "data" in input && (input as any).data) {
    return (input as { data: T }).data;
  }
  return input as T;
}

/**
 * Sends a text message via 'zapi-send' Edge Function.
 */
export async function sendZApiText(
  rawInput: SendZApiTextInput | { data: SendZApiTextInput },
  options?: EdgeInvokeOptions
): Promise<ZApiResult<{ messageId?: string; status?: string }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    {
      action: "send-text";
      phone: string;
      message: string;
      customer_id?: string;
      tenantId?: string;
      instanceId?: string;
    },
    { success?: boolean; messageId?: string; status?: string }
  >(
    "zapi-send",
    {
      action: "send-text",
      phone: input.phone,
      message: input.message,
      customer_id: input.customerId,
      tenantId: input.tenantId,
      instanceId: input.instanceId,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      success: false,
      error: result.message || "Falha ao enviar mensagem de WhatsApp.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    success: true,
    messageId: data.messageId,
    status: data.status || "sent",
  };
}

/**
 * Sends an interactive button message via 'zapi-send' Edge Function.
 */
export async function sendZApiButton(
  rawInput: SendZApiButtonInput | { data: SendZApiButtonInput },
  options?: EdgeInvokeOptions
): Promise<ZApiResult<{ messageId?: string; status?: string }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    {
      action: "send-button";
      phone: string;
      message: string;
      buttons?: ZApiButtonOption[];
      customer_id?: string;
      tenantId?: string;
      instanceId?: string;
    },
    { success?: boolean; messageId?: string; status?: string }
  >(
    "zapi-send",
    {
      action: "send-button",
      phone: input.phone,
      message: input.message,
      buttons: input.buttons,
      customer_id: input.customerId,
      tenantId: input.tenantId,
      instanceId: input.instanceId,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      success: false,
      error: result.message || "Falha ao enviar mensagem com botões.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    success: true,
    messageId: data.messageId,
    status: data.status || "sent",
  };
}

/**
 * Sends an image message with optional caption via 'zapi-send' Edge Function.
 */
export async function sendZApiImage(
  rawInput: SendZApiImageInput | { data: SendZApiImageInput },
  options?: EdgeInvokeOptions
): Promise<ZApiResult<{ messageId?: string; status?: string }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    {
      action: "send-image";
      phone: string;
      imageUrl: string;
      caption?: string;
      customer_id?: string;
      tenantId?: string;
      instanceId?: string;
    },
    { success?: boolean; messageId?: string; status?: string }
  >(
    "zapi-send",
    {
      action: "send-image",
      phone: input.phone,
      imageUrl: input.imageUrl,
      caption: input.caption,
      customer_id: input.customerId,
      tenantId: input.tenantId,
      instanceId: input.instanceId,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      success: false,
      error: result.message || "Falha ao enviar imagem via WhatsApp.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    success: true,
    messageId: data.messageId,
    status: data.status || "sent",
  };
}

/**
 * Sends a test message for integration validation via 'zapi-send' Edge Function.
 */
export async function sendZApiTestMessage(
  rawInput: SendZApiTestMessageInput | { data: SendZApiTestMessageInput },
  options?: EdgeInvokeOptions
): Promise<ZApiResult<{ messageId?: string; status?: string }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    {
      action: "send-test-message";
      phone: string;
      message?: string;
      instanceId?: string;
      tenantId?: string;
    },
    { success?: boolean; messageId?: string; status?: string }
  >(
    "zapi-send",
    {
      action: "send-test-message",
      phone: input.phone,
      message: input.message,
      instanceId: input.instanceId,
      tenantId: input.tenantId,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      success: false,
      error: result.message || "Falha ao enviar mensagem de teste.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    success: true,
    messageId: data.messageId,
    status: data.status || "sent",
  };
}

/**
 * Sends a test button message for callback verification via 'zapi-send' Edge Function.
 */
export async function sendZApiTestButton(
  rawInput: SendZApiTestButtonInput | { data: SendZApiTestButtonInput },
  options?: EdgeInvokeOptions
): Promise<ZApiResult<{ messageId?: string; status?: string }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    {
      action: "send-test-button";
      phone: string;
      message?: string;
      buttons?: ZApiButtonOption[];
      instanceId?: string;
      tenantId?: string;
    },
    { success?: boolean; messageId?: string; status?: string }
  >(
    "zapi-send",
    {
      action: "send-test-button",
      phone: input.phone,
      message: input.message,
      buttons: input.buttons,
      instanceId: input.instanceId,
      tenantId: input.tenantId,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      success: false,
      error: result.message || "Falha ao enviar botão de teste.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    success: true,
    messageId: data.messageId,
    status: data.status || "sent",
  };
}

/**
 * Checks WhatsApp instance connection status via 'zapi-send' Edge Function.
 */
export async function checkZApiStatus(
  rawInput: CheckZApiStatusInput | { data: CheckZApiStatusInput } = {},
  options?: EdgeInvokeOptions
): Promise<ZApiResult<{ connected: boolean; status: string }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    {
      action: "check-status";
      instanceId?: string;
      tenantId?: string;
    },
    { success?: boolean; connected?: boolean; status?: string }
  >(
    "zapi-send",
    {
      action: "check-status",
      instanceId: input.instanceId,
      tenantId: input.tenantId,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      success: false,
      error: result.message || "Falha ao verificar status da instância.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    success: true,
    connected: Boolean(data.connected),
    status: data.status || (data.connected ? "connected" : "disconnected"),
  };
}

/**
 * Configures the webhook URL on Z-API via 'zapi-send' Edge Function.
 */
export async function setZApiWebhook(
  rawInput: SetZApiWebhookInput | { data: SetZApiWebhookInput } = {},
  options?: EdgeInvokeOptions
): Promise<ZApiResult<{ webhookUrl: string; results?: unknown }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    {
      action: "set-webhook";
      webhookUrl?: string;
      instanceId?: string;
      tenantId?: string;
    },
    { success?: boolean; webhookUrl?: string; results?: unknown }
  >(
    "zapi-send",
    {
      action: "set-webhook",
      webhookUrl: input.webhookUrl,
      instanceId: input.instanceId,
      tenantId: input.tenantId,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      success: false,
      error: result.message || "Falha ao configurar webhook no Z-API.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    success: true,
    webhookUrl: data.webhookUrl || "",
    results: data.results,
  };
}

/**
 * Disconnects the WhatsApp instance via 'zapi-send' Edge Function.
 */
export async function disconnectZApi(
  rawInput: DisconnectZApiInput | { data: DisconnectZApiInput } = {},
  options?: EdgeInvokeOptions
): Promise<ZApiResult<{ status: string }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    {
      action: "disconnect";
      instanceId?: string;
      tenantId?: string;
    },
    { success?: boolean; status?: string }
  >(
    "zapi-send",
    {
      action: "disconnect",
      instanceId: input.instanceId,
      tenantId: input.tenantId,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      success: false,
      error: result.message || "Falha ao desconectar instância.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    success: true,
    status: data.status || "disconnected",
  };
}

/**
 * Retrieves the QR code for pairing the WhatsApp instance via 'zapi-send' Edge Function.
 */
export async function getZApiQRCode(
  rawInput: GetZApiQRCodeInput | { data: GetZApiQRCodeInput } = {},
  options?: EdgeInvokeOptions
): Promise<ZApiResult<{ qrCode?: string }>> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<
    {
      action: "get-qrcode";
      instanceId?: string;
      tenantId?: string;
    },
    { success?: boolean; qrCode?: string }
  >(
    "zapi-send",
    {
      action: "get-qrcode",
      instanceId: input.instanceId,
      tenantId: input.tenantId,
    },
    options
  );

  if (!result.ok) {
    return {
      ok: false,
      success: false,
      error: result.message || "Falha ao obter QR Code de conexão.",
      code: result.code,
    };
  }

  const data = (result as any).data || result;
  return {
    ok: true,
    success: true,
    qrCode: data.qrCode,
  };
}
