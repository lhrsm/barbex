// ==============================================================================
// BARBEX — EDGE FUNCTION: contact-public
// ==============================================================================
// Public contact form endpoint with honeypot anti-spam, IP rate limiting,
// and notification dispatch. Replaces legacy submitPublicContactMessage Nitro route.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-admin.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { AppError } from "../_shared/errors.ts";
import { sendEmail } from "../_shared/resend.ts";

interface ContactRequestBody {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  honeypot?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(new AppError("METHOD_NOT_ALLOWED", "Apenas POST permitido.", 405), corsHeaders);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  try {
    const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";

    // 1. IP Rate Limiting: max 5 submissions per 10 minutes
    const rateLimitKey = `public_contact_${clientIp}`;
    const allowed = await checkRateLimit(supabaseAdmin, rateLimitKey, 5, 600);
    if (!allowed) {
      return errorResponse(
        new AppError("RATE_LIMIT_EXCEEDED", "Muitas mensagens enviadas recentemente. Aguarde alguns minutos.", 429),
        corsHeaders
      );
    }

    const body: ContactRequestBody = await req.json().catch(() => ({} as any));

    // 2. Anti-spam Honeypot Check: if bot filled hidden honeypot field, safely fake success
    if (body.honeypot && body.honeypot.trim().length > 0) {
      return jsonResponse({ success: true, message: "Mensagem recebida com sucesso." }, 200, corsHeaders);
    }

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const message = body.message?.trim();
    const phone = body.phone?.trim() || "";
    const subject = body.subject?.trim() || "Contato pelo Site";

    if (!name || !email || !message) {
      return errorResponse(new AppError("INVALID_PAYLOAD", "Nome, e-mail e mensagem são obrigatórios.", 400), corsHeaders);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse(new AppError("INVALID_EMAIL", "E-mail inválido.", 400), corsHeaders);
    }

    // 3. Persist contact message safely
    const safeName = escapeHtml(name.slice(0, 100));
    const safeMessage = escapeHtml(message.slice(0, 2000));

    await supabaseAdmin.from("contact_messages").insert({
      name: safeName,
      email: email.slice(0, 120),
      phone: phone.slice(0, 20),
      subject: escapeHtml(subject.slice(0, 150)),
      message: safeMessage,
      ip_address: clientIp.slice(0, 50),
      created_at: new Date().toISOString(),
    });

    // 4. Send notification email to Barbex support (if Resend configured)
    try {
      await sendEmail({
        to: "contato@barbex.shop",
        template: "system_notification",
        variables: {
          title: `[Novo Contato] ${subject}`,
          body: `De: ${safeName} (${email})\nTelefone: ${phone}\n\nMensagem:\n${safeMessage}`,
        },
      });
    } catch (e) {
      console.warn("[contact-public] Email dispatch warning:", e);
    }

    return jsonResponse(
      {
        success: true,
        message: "Sua mensagem foi enviada com sucesso! Entraremos em contato em breve.",
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    return errorResponse(err, corsHeaders);
  }
});
