/**
 * BARBEX — COMMUNICATIONS DIRECT CLIENT ADAPTER
 * Manages communication channels, messages, and templates via Direct Supabase Client + RLS.
 */

import { supabase } from "@/integrations/supabase/client";

export type ChannelType = 'whatsapp' | 'email' | 'sms' | 'push' | 'internal' | 'telegram' | 'instagram';
export type MessageStatus = 'pending' | 'queued' | 'processing' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed' | 'cancelled' | 'expired';
export type CommunicationCategory = 'transactional' | 'operational' | 'commercial' | 'billing' | 'support' | 'internal' | 'security';

export interface GetMessagesOptions {
  tenantId: string;
  limit?: number;
  offset?: number;
  channelType?: ChannelType;
  status?: MessageStatus;
}

/**
 * Lists communication channels for a tenant.
 */
export async function getChannelsClient(tenantId: string) {
  const { data: channels, error } = await supabase
    .from("communication_channels")
    .select("*")
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  return channels;
}

/**
 * Lists communication messages with customer relation.
 */
export async function getMessagesClient(options: GetMessagesOptions) {
  const { tenantId, limit = 50, offset = 0, channelType, status } = options;

  let query = supabase
    .from("communication_messages")
    .select(`
      *,
      customer:customers(id, name, phone, email)
    `)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (channelType) query = query.eq("channel_type", channelType as any);
  if (status) query = query.eq("status", status as any);

  const { data: messages, error } = await query;
  if (error) throw new Error(error.message);
  return messages;
}

/**
 * Lists communication templates for a tenant.
 */
export async function getTemplatesClient(tenantId: string) {
  const { data: templates, error } = await supabase
    .from("communication_templates")
    .select("*")
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  return templates;
}

/**
 * Updates channel status and active state.
 */
export async function updateChannelStatusClient(id: string, status: string, isActive: boolean) {
  const { error } = await supabase
    .from("communication_channels")
    .update({
      status,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  return { success: true };
}
