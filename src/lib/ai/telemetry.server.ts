/**
 * BARBEX — TELEMETRIA ESTRUTURADA DE AUDITORIA DO AGENTE DE IA
 * Fase: R2E.26E.22N.2
 *
 * Emite logs estruturados em JSON no runtime server-side para rastreabilidade
 * de segurança, consumo de quotas e performance sem expor credenciais, chaves,
 * dados pessoais ou o conteúdo integral das perguntas/respostas.
 */

export type TelemetryEventType =
  | "AI_ACCESS_ATTEMPT"
  | "AI_AUTH_BLOCKED"
  | "AI_RBAC_BLOCKED"
  | "AI_KILLSWITCH_BLOCKED"
  | "AI_CANARY_BLOCKED"
  | "AI_RATE_LIMIT_BLOCKED"
  | "AI_PROVIDER_REQUEST"
  | "AI_PROVIDER_RESPONSE"
  | "AI_ERROR";

export interface TelemetryPayload {
  event: TelemetryEventType;
  timestamp: string;
  correlationId: string;
  outcome: "ALLOWED" | "BLOCKED" | "SUCCESS" | "ERROR";
  reasonCode?: string;
  tenantIdMasked?: string;
  userIdMasked?: string;
  model?: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  rateLimitSource?: "rpc" | "memory_fallback";
  details?: Record<string, unknown>;
}

// Armazenamento em memória para asserções de suítes de testes automatizados
const memoryTelemetrySink: TelemetryPayload[] = [];
let telemetryCaptureEnabled = false;

export function enableTelemetryCaptureForTesting() {
  telemetryCaptureEnabled = true;
  memoryTelemetrySink.length = 0;
}

export function disableTelemetryCaptureForTesting() {
  telemetryCaptureEnabled = false;
  memoryTelemetrySink.length = 0;
}

export function getCapturedTelemetryEvents(): TelemetryPayload[] {
  return [...memoryTelemetrySink];
}

export function clearCapturedTelemetryEvents() {
  memoryTelemetrySink.length = 0;
}

/**
 * Mascara identificadores UUID para logs sem impedir auditoria
 * Exemplo: '3f6c1e5a-7b2a-4a8e-9c1d-8f2e3d4c5b6a' -> '3f6c...5b6a'
 */
export function maskIdentifier(id: string | null | undefined): string {
  if (!id || typeof id !== "string") return "anonymous";
  const clean = id.trim();
  if (clean.length < 12) return "***";
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}

/**
 * Emite evento de telemetria estruturada em JSON no stdout/stderr server-side
 */
export function logAITelemetry(payload: TelemetryPayload): void {
  // Captura para suítes de teste se habilitado
  if (telemetryCaptureEnabled || process.env.NODE_ENV === "test") {
    memoryTelemetrySink.push(payload);
  }

  // Sanitização estrita de segurança defensiva: garantir ausência de segredos ou payloads completos
  const safePayload: TelemetryPayload = {
    event: payload.event,
    timestamp: payload.timestamp || new Date().toISOString(),
    correlationId: payload.correlationId,
    outcome: payload.outcome,
    reasonCode: payload.reasonCode,
    tenantIdMasked: payload.tenantIdMasked,
    userIdMasked: payload.userIdMasked,
    model: payload.model,
    latencyMs: payload.latencyMs,
    promptTokens: payload.promptTokens,
    completionTokens: payload.completionTokens,
    totalTokens: payload.totalTokens,
    rateLimitSource: payload.rateLimitSource,
  };

  // Log formatado para ingestão padrão na Vercel (JSON estruturado na linha)
  try {
    const jsonLine = JSON.stringify({
      log_type: "BARBEX_AI_TELEMETRY",
      ...safePayload,
    });
    console.log(jsonLine);
  } catch {
    // Fail-safe silencioso sem impactar o fluxo da aplicação
  }
}

