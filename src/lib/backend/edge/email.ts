/**
 * BARBEX — EMAIL EDGE FUNCTION ADAPTER
 * Connects frontend callers to the `send-email` Supabase Edge Function.
 * Provides normalized types, timeout handling, and correlation tracking.
 * ZERO server secrets or direct provider API keys allowed here.
 */

import { invokeEdgeFunction, type EdgeInvokeOptions, type EdgeResult } from "@/lib/backend/edge-client";

export type EmailTemplateKey =
  | "internal_user_invitation"
  | "email_verification_code"
  | "admin_digest"
  | "review_request"
  | "subscription_reminder"
  | "system_notification"
  | "custom"
  | "test_email"
  | "contact_form_message"
  | "platform_contact_form_message"
  | "client_password_recovery"
  | "client_account_setup"
  | "security_alert";

export interface SendEmailPayload {
  recipient: string;
  templateKey: EmailTemplateKey | string;
  templateData?: Record<string, any>;
  subject?: string;
  tenantId?: string;
  userId?: string;
  eventId?: string;
  replyTo?: string;
  customSubject?: string;
}

export interface SendEmailResultData {
  messageId: string;
  recipient: string;
  templateKey: string;
  delivered: boolean;
  durationMs?: number;
}

/**
 * Dispatches a transactional email through the Supabase `send-email` Edge Function.
 */
export async function sendTransactionalEmail(
  payload: SendEmailPayload | { data: SendEmailPayload },
  options?: EdgeInvokeOptions
): Promise<EdgeResult<SendEmailResultData>> {
  // Support both direct payload and legacy `{ data: payload }` envelope
  const cleanPayload: SendEmailPayload = "data" in payload && payload.data ? payload.data : (payload as SendEmailPayload);

  // Map legacy template names or fields if applicable
  const templateKey = cleanPayload.templateKey || "custom";
  const subject = cleanPayload.subject || cleanPayload.customSubject;

  const edgeBody = {
    recipient: cleanPayload.recipient.trim(),
    templateKey,
    templateData: cleanPayload.templateData || {},
    subject,
    tenantId: cleanPayload.tenantId,
    userId: cleanPayload.userId,
    eventId: cleanPayload.eventId,
  };

  const response = await invokeEdgeFunction<typeof edgeBody, SendEmailResultData>(
    "send-email",
    edgeBody,
    options
  );

  return response;
}
