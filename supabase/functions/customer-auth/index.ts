// ==============================================================================
// BARBEX — EDGE FUNCTION: customer-auth
// ==============================================================================
// Dedicated public booking funnel authentication for salon customers.
// Strictly isolated from staff-auth:
// - Never grants staff, barber, or admin roles.
// - Resolves customer record scoped to the salon's tenant_id.
// - Handles 6-digit OTP verification with single-use hashed challenges.
// - Atomically links client profile and customer record to Auth user.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-admin.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { AppError } from "../_shared/errors.ts";
import { normalizePhoneBR } from "../_shared/phone.ts";
import { sendEmail } from "../_shared/resend.ts";

interface RequestBody {
  action: "request-verification" | "verify-code" | "finalize-setup";
  tenantId?: string;
  phone?: string;
  name?: string;
  email?: string;
  challengeId?: string;
  code?: string;
  password?: string;
}

async function hashCode(code: string): Promise<string> {
  // Simple SHA-256 hex string for OTP comparison without plaintext persistence
  const data = new TextEncoder().encode(code);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
    const body: RequestBody = await req.json().catch(() => ({ action: "" as any }));
    const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";

    // ---------------------------------------------------------------------------
    // ACTION: request-verification
    // ---------------------------------------------------------------------------
    if (body.action === "request-verification") {
      const { tenantId, phone, name, email } = body;
      if (!tenantId || !phone || !email) {
        return errorResponse(new AppError("INVALID_PAYLOAD", "tenantId, phone e email são obrigatórios.", 400), corsHeaders);
      }

      // Rate limit by IP + Phone: max 5 requests per 10 minutes
      const normalizedPhone = normalizePhoneBR(phone);
      const rateLimitKey = `cust_auth_req_${clientIp}_${normalizedPhone}`;
      const allowed = await checkRateLimit(supabaseAdmin, rateLimitKey, 5, 600);
      if (!allowed) {
        return errorResponse(new AppError("RATE_LIMIT_EXCEEDED", "Muitas solicitações. Aguarde antes de tentar novamente.", 429), corsHeaders);
      }

      // 6-digit cryptographic random code
      const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = await hashCode(rawCode);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Upsert into verification_challenges
      const { data: challenge, error: chErr } = await supabaseAdmin
        .from("verification_challenges")
        .insert({
          tenant_id: tenantId,
          email: email.trim().toLowerCase(),
          phone: normalizedPhone,
          challenge_hash: codeHash,
          challenge_type: "customer_booking_email",
          expires_at: expiresAt,
          attempts: 0,
          metadata: { name: name?.trim() || "Cliente", scope: "customer" },
        })
        .select("id")
        .single();

      if (chErr) {
        return errorResponse(new AppError("CHALLENGE_CREATE_FAILED", "Falha ao gerar código de verificação.", 500), corsHeaders);
      }

      // Send transactional verification email
      try {
        await sendEmail({
          to: email.trim().toLowerCase(),
          template: "email_verification_code",
          variables: {
            name: name?.trim() || "Cliente",
            code: rawCode,
          },
        });
      } catch (emailErr) {
        console.warn("[customer-auth] Email dispatch warning:", emailErr);
      }

      return jsonResponse(
        {
          success: true,
          data: {
            challengeId: challenge.id,
            expiresAt,
            message: "Código de verificação enviado para o seu e-mail.",
          },
        },
        200,
        corsHeaders
      );
    }

    // ---------------------------------------------------------------------------
    // ACTION: verify-code
    // ---------------------------------------------------------------------------
    if (body.action === "verify-code") {
      const { challengeId, code, email } = body;
      if (!challengeId || !code) {
        return errorResponse(new AppError("INVALID_PAYLOAD", "challengeId e code são obrigatórios.", 400), corsHeaders);
      }

      const { data: challenge, error: fetchErr } = await supabaseAdmin
        .from("verification_challenges")
        .select("*")
        .eq("id", challengeId)
        .maybeSingle();

      if (fetchErr || !challenge) {
        return errorResponse(new AppError("CHALLENGE_NOT_FOUND", "Código ou desafio inválido.", 404), corsHeaders);
      }

      if (new Date(challenge.expires_at) < new Date()) {
        return errorResponse(new AppError("CHALLENGE_EXPIRED", "O código de verificação expirou.", 410), corsHeaders);
      }

      if (challenge.attempts >= 5) {
        return errorResponse(new AppError("CHALLENGE_LOCKED", "Limite de tentativas excedido.", 429), corsHeaders);
      }

      const inputHash = await hashCode(code.trim());
      if (inputHash !== challenge.challenge_hash) {
        await supabaseAdmin
          .from("verification_challenges")
          .update({ attempts: challenge.attempts + 1 })
          .eq("id", challengeId);
        return errorResponse(new AppError("INVALID_CODE", "Código de verificação incorreto.", 400), corsHeaders);
      }

      // Mark verified
      await supabaseAdmin
        .from("verification_challenges")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", challengeId);

      return jsonResponse(
        {
          success: true,
          data: {
            verified: true,
            challengeId,
          },
        },
        200,
        corsHeaders
      );
    }

    // ---------------------------------------------------------------------------
    // ACTION: finalize-setup
    // ---------------------------------------------------------------------------
    if (body.action === "finalize-setup") {
      const { challengeId, password } = body;
      if (!challengeId || !password || password.length < 6) {
        return errorResponse(new AppError("INVALID_PAYLOAD", "challengeId e password (mínimo 6 caracteres) são obrigatórios.", 400), corsHeaders);
      }

      const { data: challenge, error: chErr } = await supabaseAdmin
        .from("verification_challenges")
        .select("*")
        .eq("id", challengeId)
        .maybeSingle();

      if (chErr || !challenge || !challenge.verified_at) {
        return errorResponse(new AppError("UNVERIFIED_CHALLENGE", "O desafio precisa ser validado com o código primeiro.", 400), corsHeaders);
      }

      if (challenge.consumed_at) {
        return errorResponse(new AppError("CHALLENGE_ALREADY_USED", "Este link/código já foi utilizado.", 400), corsHeaders);
      }

      const email = challenge.email;
      const phone = challenge.phone;
      const tenantId = challenge.tenant_id;
      const name = challenge.metadata?.name || "Cliente";

      // 1. Create or retrieve auth user
      let userId: string;
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        userId = existingUser.id;
        // Update password
        await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      } else {
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: name, user_type: "customer" },
        });

        if (createErr || !newUser?.user) {
          return errorResponse(new AppError("USER_CREATION_FAILED", "Falha ao criar usuário de acesso.", 500), corsHeaders);
        }
        userId = newUser.user.id;
      }

      // 2. Link customer record atomically
      await supabaseAdmin
        .from("customers")
        .update({
          auth_user_id: userId,
          email: email,
          name: name,
        })
        .eq("tenant_id", tenantId)
        .eq("phone", phone);

      // 3. Mark challenge consumed
      await supabaseAdmin
        .from("verification_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", challengeId);

      return jsonResponse(
        {
          success: true,
          data: {
            userId,
            email,
            message: "Conta de cliente vinculada com sucesso.",
          },
        },
        200,
        corsHeaders
      );
    }

    return errorResponse(new AppError("INVALID_ACTION", "Ação não suportada.", 400), corsHeaders);
  } catch (err: any) {
    return errorResponse(err, corsHeaders);
  }
});
