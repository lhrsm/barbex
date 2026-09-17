import { supabase } from "@/integrations/supabase/client";
import { sendZApiButton, sendZApiText } from "@/lib/backend/edge/zapi";

interface WhatsAppParams {
  userId: string;
  eventType: 'appointment_confirmation' | 'reminder' | 'cancellation' | 'cashback' | 'payment_confirmed' | 'service_completed';
  phone: string;
  placeholders: Record<string, any>;
  appointmentId?: string;
}

export const triggerWhatsAppMessage = async ({
  userId,
  eventType,
  phone,
  placeholders,
  appointmentId
}: WhatsAppParams) => {
  try {
    // 1. Get Template
    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("content")
      .eq("user_id", userId)
      .eq("event_type", eventType)
      .eq("is_active", true)
      .maybeSingle();

    if (!template) {
      console.log(`[WhatsApp] No active template found for ${eventType} and user ${userId}`);
      return { success: false, error: "Template not found" };
    }

    // 2. Parse placeholders
    let content = template.content;
    Object.keys(placeholders).forEach(key => {
      content = content.replace(new RegExp(`{{${key}}}`, "g"), placeholders[key]);
    });

    // 3. Prepare Buttons for confirmation
    const hasButtons = eventType === 'appointment_confirmation';
    const buttons = hasButtons ? [{ id: "main_confirm", label: "Confirmar agendamento" }] : undefined;

    // 4. Send via canonical Z-API Edge Adapter
    let res;
    if (hasButtons) {
      res = await sendZApiButton({
        phone,
        message: content,
        buttons,
        tenantId: userId,
      });
    } else {
      res = await sendZApiText({
        phone,
        message: content,
        tenantId: userId,
      });
    }

    if (!res.ok) {
      console.error('Error triggering WhatsApp message:', res.error);
      return { success: false, error: res.error };
    }

    return { success: true, data: res };
  } catch (err) {
    console.error('Unexpected error triggering WhatsApp:', err);
    return { success: false, error: err };
  }
};

