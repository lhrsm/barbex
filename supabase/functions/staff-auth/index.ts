/**
 * BARBEX SUPABASE EDGE FUNCTION — STAFF AUTHENTICATION & ONBOARDING
 * Handles:
 * - request-verification: Dispatches 6-digit OTP email code for barber verification
 * - verify-code: Validates 6-digit OTP code against verification challenges
 * - finalize-setup: Consumes verified challenge, links GoTrue user and updates barber/profile
 * - create-reception: Creates dedicated reception staff member with permissions
 */

import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireMethod, parseJsonBody } from "../_shared/validation.ts";
import { normalizePhone, isValidBrazilianPhone } from "../_shared/phone.ts";
import { generateRateLimitKey, checkRateLimit } from "../_shared/rate-limit.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { extractBearerToken } from "../_shared/auth.ts";
import { createStructuredLogger } from "../_shared/logging.ts";
import { generateRequestId, sha256Hex } from "../_shared/crypto.ts";
import { EdgeError } from "../_shared/errors.ts";
import { sendEmail } from "../_shared/resend.ts";

export type StaffAuthAction =
  | {
      action: "request-verification";
      email: string;
      phone: string;
      barberId: string;
      tenantId: string;
      barberName: string;
    }
  | {
      action: "verify-code";
      email: string;
      code: string;
      barberId: string;
    }
  | {
      action: "finalize-setup";
      email: string;
      password?: string;
      barberId: string;
      phone: string;
      name: string;
      tenantId: string;
    }
  | {
      action: "create-reception";
      email: string;
      password: string;
      name?: string;
    };

const MAX_STAFF_OTP_ATTEMPTS = 5;

function buildResponse(body: Record<string, unknown>, status = 200, req?: Request): Response {
  const requestId = req?.headers?.get("x-request-id") || generateRequestId();
  const cors = getCorsHeaders(req);

  return new Response(
    JSON.stringify({
      ...body,
      requestId
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Content-Type-Options": "nosniff",
        ...cors,
        "x-request-id": requestId
      }
    }
  );
}

/**
 * Resolves authenticated administrator / owner caller for protected operations.
 */
async function resolveAdminCaller(
  req: Request,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<{ userId: string; tenantId: string }> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new EdgeError("UNAUTHORIZED", "Token de autenticação ausente ou inválido.", 401);
  }

  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) {
    throw new EdgeError("UNAUTHORIZED", "Sessão expirada ou não autorizada.", 401);
  }

  const userId = user.id;

  const { data: profile, error: profErr } = await adminClient
    .from("profiles")
    .select("id, role, tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (profErr || !profile) {
    throw new EdgeError("FORBIDDEN", "Perfil de usuário não encontrado.", 403);
  }

  const effectiveTenantId = profile.tenant_id || profile.id;
  const isPrivileged = ["super_admin", "admin", "tenant_admin", "shop_owner"].includes(profile.role || "");

  if (!isPrivileged) {
    const { data: membership } = await adminClient
      .from("tenant_memberships")
      .select("role, status")
      .eq("tenant_id", effectiveTenantId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!membership || (membership.role !== "admin" && membership.role !== "tenant_admin")) {
      throw new EdgeError("FORBIDDEN", "Acesso negado: privilégios de administrador necessários.", 403);
    }
  }

  return {
    userId,
    tenantId: effectiveTenantId
  };
}

Deno.serve(async (req: Request) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  const logger = createStructuredLogger("staff-auth", req);
  const startTime = Date.now();

  try {
    requireMethod(req, "POST");

    const payload = await parseJsonBody<StaffAuthAction>(req, 32768);
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "";
    const adminClient = createAdminClient();

    if (!payload || typeof payload !== "object" || !("action" in payload)) {
      throw new EdgeError("INVALID_REQUEST", "Ação não especificada ou inválida.", 400);
    }

    // -------------------------------------------------------------------------
    // ACTION: REQUEST-VERIFICATION (6-digit OTP code dispatch)
    // -------------------------------------------------------------------------
    if (payload.action === "request-verification") {
      const { email, phone, barberId, tenantId, barberName } = payload;
      if (!email || !barberId || !tenantId) {
        throw new EdgeError("INVALID_REQUEST", "Parâmetros obrigatórios ausentes.", 400);
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
        throw new EdgeError("INVALID_REQUEST", "Endereço de e-mail inválido.", 400);
      }

      // Rate limit: 5 attempts / 10 minutes per barber ID
      const rateLimitKey = await generateRateLimitKey("staff:verify", barberId, tenantId, clientIp);
      await checkRateLimit(rateLimitKey, 5, 600);

      // 1. Verify barber exists in tenant
      const { data: barber, error: bErr } = await adminClient
        .from("barbers")
        .select("id, name, tenant_id, user_id, active")
        .eq("id", barberId)
        .maybeSingle();

      if (bErr || !barber || barber.tenant_id !== tenantId) {
        throw new EdgeError("NOT_FOUND", "Colaborador não encontrado neste estabelecimento.", 404);
      }

      // 2. Check collision with tenant owner
      const { data: ownerProfile } = await adminClient
        .from("profiles")
        .select("id, email")
        .eq("id", tenantId)
        .maybeSingle();

      if (ownerProfile?.email && ownerProfile.email.toLowerCase() === cleanEmail) {
        throw new EdgeError("CONFLICT", "Conflito: este e-mail já pertence ao administrador da barbearia.", 409);
      }

      // 3. Check collision with other barber
      const { data: otherBarber } = await adminClient
        .from("barbers")
        .select("id, name")
        .eq("email", cleanEmail)
        .neq("id", barberId)
        .maybeSingle();

      if (otherBarber) {
        throw new EdgeError("CONFLICT", `Conflito: este e-mail já está em uso pelo profissional ${otherBarber.name}.`, 409);
      }

      // Check if Auth account already exists
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingUser = (listData?.users || []).find(
        (u) => Boolean(u.email) && u.email!.toLowerCase() === cleanEmail
      );
      const emailExists = Boolean(existingUser);

      // 4. Delete previous pending challenges for this barber
      await adminClient
        .from("verification_challenges")
        .delete()
        .eq("purpose", "staff_email_verification")
        .eq("barber_id", barberId);

      // 5. Generate numeric 6-digit OTP code & compute SHA-256 hash
      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = await sha256Hex(randomCode);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      const { data: insertedChallenge, error: insertError } = await adminClient
        .from("verification_challenges")
        .insert({
          email: cleanEmail,
          barber_id: barberId,
          client_id: null,
          code_hash: codeHash,
          expires_at: expiresAt,
          purpose: "staff_email_verification",
          attempts: 0
        })
        .select("id")
        .single();

      if (insertError) {
        throw new EdgeError("INTERNAL_ERROR", "Falha ao gerar código de verificação.", 500);
      }

      // 6. Send transactional email via Resend
      try {
        await sendEmail({
          recipient: cleanEmail,
          templateKey: "email_verification_code",
          templateData: {
            code: randomCode,
            userName: barberName || barber.name || "Colaborador"
          },
          tenantId
        });
      } catch (emailErr) {
        await adminClient.from("verification_challenges").delete().eq("id", insertedChallenge.id);
        throw new EdgeError("SERVICE_UNAVAILABLE", "Não foi possível enviar o e-mail de verificação.", 503);
      }

      logger.info("Staff email verification code dispatched", { action: "request-verification", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true, emailExists }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: VERIFY-CODE (6-digit OTP code validation)
    // -------------------------------------------------------------------------
    if (payload.action === "verify-code") {
      const { email, code, barberId } = payload;
      if (!email || !code || !barberId) {
        throw new EdgeError("INVALID_REQUEST", "E-mail, código e colaborador são obrigatórios.", 400);
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = code.trim();
      const codeHash = await sha256Hex(cleanCode);

      const rateLimitKey = await generateRateLimitKey("staff:verify_attempt", barberId, undefined, clientIp);
      await checkRateLimit(rateLimitKey, 10, 300);

      const { data: challenge, error } = await adminClient
        .from("verification_challenges")
        .select("id, email, code_hash, attempts, expires_at, verified_at, consumed_at")
        .eq("email", cleanEmail)
        .eq("purpose", "staff_email_verification")
        .eq("barber_id", barberId)
        .gt("expires_at", new Date().toISOString())
        .is("verified_at", null)
        .is("consumed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !challenge) {
        return buildResponse({ ok: false, error: "Código inválido ou expirado." }, 200, req);
      }

      const currentAttempts = challenge.attempts || 0;

      if (currentAttempts >= MAX_STAFF_OTP_ATTEMPTS) {
        await adminClient.from("verification_challenges").delete().eq("id", challenge.id);
        return buildResponse({ ok: false, error: "Este código atingiu o limite de tentativas. Solicite um novo código." }, 200, req);
      }

      if (challenge.code_hash !== codeHash) {
        const newAttempts = currentAttempts + 1;
        if (newAttempts >= MAX_STAFF_OTP_ATTEMPTS) {
          await adminClient.from("verification_challenges").delete().eq("id", challenge.id);
          return buildResponse({ ok: false, error: "Este código atingiu o limite de tentativas. Solicite um novo código." }, 200, req);
        }

        await adminClient
          .from("verification_challenges")
          .update({ attempts: newAttempts })
          .eq("id", challenge.id)
          .is("verified_at", null)
          .is("consumed_at", null);

        return buildResponse({ ok: false, error: "Código inválido ou expirado." }, 200, req);
      }

      // Code matched -> Mark verified_at atomically
      const { error: updateErr } = await adminClient
        .from("verification_challenges")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", challenge.id)
        .is("verified_at", null)
        .is("consumed_at", null);

      if (updateErr) {
        return buildResponse({ ok: false, error: "Código inválido ou expirado." }, 200, req);
      }

      logger.info("Staff email verification code confirmed", { action: "verify-code", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: FINALIZE-SETUP (Consume challenge & establish staff access)
    // -------------------------------------------------------------------------
    if (payload.action === "finalize-setup") {
      const { email, password, barberId, phone, name, tenantId } = payload;
      if (!email || !barberId || !tenantId) {
        throw new EdgeError("INVALID_REQUEST", "Parâmetros obrigatórios ausentes.", 400);
      }

      const cleanEmail = email.trim().toLowerCase();

      // 1. Verify barber belongs to tenant
      const { data: barber, error: bErr } = await adminClient
        .from("barbers")
        .select("id, name, tenant_id, user_id, active")
        .eq("id", barberId)
        .maybeSingle();

      if (bErr || !barber || barber.tenant_id !== tenantId) {
        throw new EdgeError("NOT_FOUND", "Colaborador não encontrado neste estabelecimento.", 404);
      }

      // 2. Consume verified challenge atomically
      let challengeId: string | null = null;
      try {
        const { data: rpcRes, error: rpcErr } = await adminClient.rpc("claim_staff_verification_challenge", {
          p_barber_id: barberId,
          p_email: cleanEmail,
          p_max_attempts: MAX_STAFF_OTP_ATTEMPTS
        });

        if (!rpcErr && rpcRes && rpcRes.length > 0 && rpcRes[0].claimed) {
          challengeId = rpcRes[0].challenge_id;
        }
      } catch {
        // Fallback conditional update
      }

      if (!challengeId) {
        const { data: challenge } = await adminClient
          .from("verification_challenges")
          .select("id")
          .eq("email", cleanEmail)
          .eq("purpose", "staff_email_verification")
          .eq("barber_id", barberId)
          .gt("expires_at", new Date().toISOString())
          .not("verified_at", "is", null)
          .is("consumed_at", null)
          .lt("attempts", MAX_STAFF_OTP_ATTEMPTS)
          .order("verified_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!challenge) {
          throw new EdgeError("FORBIDDEN", "E-mail não verificado ou solicitação já processada.", 403);
        }

        const { error: claimErr } = await adminClient
          .from("verification_challenges")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", challenge.id)
          .is("consumed_at", null);

        if (claimErr) {
          throw new EdgeError("FORBIDDEN", "E-mail não verificado ou solicitação já processada.", 403);
        }

        challengeId = challenge.id;
      }

      // 3. Resolve or Create GoTrue User
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingUser = (listData?.users || []).find(
        (u) => Boolean(u.email) && u.email!.toLowerCase() === cleanEmail
      );

      let userId: string;
      let newlyCreatedAuthUserId: string | null = null;
      const canonicalPhone = phone ? normalizePhone(phone) : null;

      if (!existingUser) {
        if (!password || password.length < 6) {
          throw new EdgeError("INVALID_REQUEST", "A senha deve ter no mínimo 6 caracteres para novas contas.", 400);
        }

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: name,
            phone: canonicalPhone,
            role: "barber",
            barber_id: barberId,
            tenant_id: tenantId
          }
        });

        if (createError || !newUser?.user) {
          throw new EdgeError("INTERNAL_ERROR", "Erro ao criar credenciais de autenticação.", 500);
        }

        userId = newUser.user.id;
        newlyCreatedAuthUserId = userId;
      } else {
        userId = existingUser.id;
        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...existingUser.user_metadata,
            full_name: name,
            phone: canonicalPhone || existingUser.user_metadata?.phone,
            barber_id: barberId,
            tenant_id: tenantId
          }
        });
      }

      try {
        // 4. Update Barbers table (Preserving barber.id)
        const barberPatch: Record<string, unknown> = {
          user_id: userId,
          email: cleanEmail,
          auth_migration_status: "completed"
        };
        if (canonicalPhone) barberPatch.phone = canonicalPhone;

        const { error: barberUpdateError } = await adminClient
          .from("barbers")
          .update(barberPatch)
          .eq("id", barberId);

        if (barberUpdateError) {
          throw new EdgeError("INTERNAL_ERROR", "Falha ao vincular profissional.", 500);
        }

        // 5. Create / Update Profiles
        const { data: existingProfile } = await adminClient
          .from("profiles")
          .select("id, role, phone")
          .eq("id", userId)
          .maybeSingle();

        if (existingProfile) {
          const newRole = existingProfile.role === "client" ? "client" : "barber";
          const profilePatch: Record<string, unknown> = {
            responsible_name: name,
            display_name: name,
            email: cleanEmail,
            role: newRole,
            identity_status: "completed",
            tenant_id: tenantId
          };
          if (canonicalPhone && !existingProfile.phone) {
            profilePatch.phone = canonicalPhone;
          }

          await adminClient.from("profiles").update(profilePatch).eq("id", userId);
        } else {
          await adminClient.from("profiles").insert({
            id: userId,
            responsible_name: name,
            display_name: name,
            email: cleanEmail,
            phone: canonicalPhone,
            role: "barber",
            identity_status: "completed",
            tenant_id: tenantId
          });
        }

        // 6. Upsert Tenant Memberships
        await adminClient.from("tenant_memberships").upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            role: "barber",
            status: "active"
          },
          { onConflict: "tenant_id,user_id" }
        );

        // 7. Upsert User Roles
        await adminClient.from("user_roles").upsert(
          {
            user_id: userId,
            role: "barber"
          },
          { onConflict: "user_id,role" }
        );

        // 8. Delete consumed challenge
        if (challengeId) {
          await adminClient.from("verification_challenges").delete().eq("id", challengeId);
        }

        logger.info("Staff access setup finalized successfully", { action: "finalize-setup", durationMs: Date.now() - startTime });
        return buildResponse({ ok: true, userId, barberId }, 200, req);
      } catch (err) {
        // Compensate: Delete orphan Auth user if newly created
        if (newlyCreatedAuthUserId) {
          try {
            await adminClient.auth.admin.deleteUser(newlyCreatedAuthUserId);
          } catch {
            // Ignore delete error
          }
        }
        throw err;
      }
    }

    // -------------------------------------------------------------------------
    // ACTION: CREATE-RECEPTION (Reception staff creation with permissions)
    // -------------------------------------------------------------------------
    if (payload.action === "create-reception") {
      const { tenantId } = await resolveAdminCaller(req, adminClient);
      const { email, password, name } = payload;

      if (!email || !password) {
        throw new EdgeError("INVALID_REQUEST", "E-mail e senha são obrigatórios.", 400);
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
        throw new EdgeError("INVALID_REQUEST", "Endereço de e-mail inválido.", 400);
      }

      if (password.length < 8) {
        throw new EdgeError("INVALID_REQUEST", "A senha deve ter pelo menos 8 caracteres.", 400);
      }

      const cleanName = (name || "Recepção").trim().slice(0, 120);

      // Check existing user
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      let targetUserId = existingProfile?.id;

      if (!targetUserId) {
        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: { responsible_name: cleanName }
        });

        if (createError || !created?.user) {
          throw new EdgeError("INTERNAL_ERROR", `Falha ao criar usuário de recepção: ${createError?.message || "erro interno"}`, 500);
        }
        targetUserId = created.user.id;
      }

      // Update profile, role and permissions
      await adminClient
        .from("profiles")
        .update({ role: "reception", tenant_id: tenantId, responsible_name: cleanName })
        .eq("id", targetUserId);

      await adminClient
        .from("user_roles")
        .upsert({ user_id: targetUserId, role: "reception" }, { onConflict: "user_id,role" });

      await adminClient.from("reception_permissions").upsert(
        {
          user_id: targetUserId,
          tenant_id: tenantId,
          permissions: {
            can_view_calendar: true,
            can_create_appointments: true,
            can_manage_clients: true,
            can_view_cashier: true
          },
          is_active: true
        },
        { onConflict: "user_id" }
      );

      await adminClient.from("tenant_memberships").upsert(
        {
          tenant_id: tenantId,
          user_id: targetUserId,
          role: "reception",
          status: "active"
        },
        { onConflict: "tenant_id,user_id" }
      );

      logger.info("Reception user created successfully", { action: "create-reception", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true, user_id: targetUserId }, 200, req);
    }

    throw new EdgeError("INVALID_REQUEST", "Ação desconhecida.", 400);
  } catch (err: unknown) {
    if (err instanceof EdgeError) {
      return buildResponse({ ok: false, code: err.code, error: err.message }, err.status, req);
    }

    logger.error("Unexpected error during staff-auth execution", {
      durationMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : "Unknown error"
    });

    return buildResponse({ ok: false, code: "SERVICE_UNAVAILABLE", error: "Serviço temporariamente indisponível." }, 503, req);
  }
});
