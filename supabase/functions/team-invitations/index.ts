/**
 * BARBEX SUPABASE EDGE FUNCTION — TEAM INVITATIONS
 * Handles the complete lifecycle of team invitations:
 * - invite: Creates pending invitation and dispatches transactional email
 * - resend: Refreshes token and re-sends invitation email
 * - revoke: Cancels active invitation
 * - validate: Public pre-auth token validation with anti-enumeration
 * - accept: Creates/updates GoTrue user and executes atomic acceptance transaction
 */

import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireMethod, parseJsonBody } from "../_shared/validation.ts";
import { normalizePhone, isValidBrazilianPhone } from "../_shared/phone.ts";
import { generateRateLimitKey, checkRateLimit } from "../_shared/rate-limit.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { extractBearerToken } from "../_shared/auth.ts";
import { createStructuredLogger } from "../_shared/logging.ts";
import { generateRequestId, randomBytesHex } from "../_shared/crypto.ts";
import { EdgeError } from "../_shared/errors.ts";
import { sendEmail } from "../_shared/resend.ts";

export type TeamInvitationAction =
  | { action: "invite"; email: string; role: string; phone?: string; professionalId?: string }
  | { action: "resend"; invitationId: string }
  | { action: "revoke"; invitationId: string }
  | { action: "validate"; token: string }
  | { action: "accept"; token: string; password: string };

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
 * Resolves authenticated caller identity and verifies administrator privileges for the tenant.
 */
async function resolveAdminCaller(
  req: Request,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<{ userId: string; tenantId: string; callerRole: string }> {
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
  const isPrivileged = profile.role === "super_admin" || profile.role === "admin" || profile.role === "tenant_admin" || profile.role === "shop_owner";

  if (!isPrivileged) {
    const { data: membership } = await adminClient
      .from("tenant_memberships")
      .select("role, status")
      .eq("tenant_id", effectiveTenantId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!membership || (membership.role !== "admin" && membership.role !== "tenant_admin")) {
      throw new EdgeError("FORBIDDEN", "Acesso negado: você não possui permissão para gerenciar a equipe deste estabelecimento.", 403);
    }
  }

  return {
    userId,
    tenantId: effectiveTenantId,
    callerRole: profile.role || "admin"
  };
}

Deno.serve(async (req: Request) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  const logger = createStructuredLogger("team-invitations", req);
  const startTime = Date.now();

  try {
    requireMethod(req, "POST");

    const payload = await parseJsonBody<TeamInvitationAction>(req, 32768);
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "";
    const adminClient = createAdminClient();

    if (!payload || typeof payload !== "object" || !("action" in payload)) {
      throw new EdgeError("INVALID_REQUEST", "Ação não especificada ou inválida.", 400);
    }

    // -------------------------------------------------------------------------
    // ACTION: INVITE
    // -------------------------------------------------------------------------
    if (payload.action === "invite") {
      const { userId, tenantId, callerRole } = await resolveAdminCaller(req, adminClient);
      const { email, role, phone, professionalId } = payload;

      if (!email || typeof email !== "string" || !role || typeof role !== "string") {
        throw new EdgeError("INVALID_REQUEST", "E-mail e papel do colaborador são obrigatórios.", 400);
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
        throw new EdgeError("INVALID_REQUEST", "Endereço de e-mail inválido.", 400);
      }

      if (role === "super_admin" && callerRole !== "super_admin") {
        throw new EdgeError("FORBIDDEN", "Não é permitido convidar administradores globais.", 403);
      }

      // Rate limit: 10 invites / 5 minutes per tenant + email
      const rateLimitKey = await generateRateLimitKey("team:invite", cleanEmail, tenantId, clientIp);
      await checkRateLimit(rateLimitKey, 10, 300);

      // Check existing pending invite in this tenant
      const { data: pendingInvite } = await adminClient
        .from("user_invitations")
        .select("id, expires_at, status")
        .eq("tenant_id", tenantId)
        .ilike("email", cleanEmail)
        .eq("status", "pending")
        .maybeSingle();

      if (pendingInvite) {
        const isExpired = new Date(pendingInvite.expires_at) <= new Date();
        if (!isExpired) {
          throw new EdgeError("CONFLICT", "Já existe um convite pendente para este e-mail neste estabelecimento.", 409);
        } else {
          await adminClient
            .from("user_invitations")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("id", pendingInvite.id);
        }
      }

      // Check existing profile and membership
      const { data: existingUser } = await adminClient
        .from("profiles")
        .select("id, role")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (existingUser) {
        const { data: existingMembership } = await adminClient
          .from("tenant_memberships")
          .select("id, role, status")
          .eq("tenant_id", tenantId)
          .eq("user_id", existingUser.id)
          .maybeSingle();

        if (existingMembership && existingMembership.status === "active") {
          const isPrivileged = ["super_admin", "admin", "tenant_admin"].includes(existingMembership.role);
          if (isPrivileged || existingMembership.role === role) {
            throw new EdgeError("CONFLICT", "Este usuário já possui acesso ativo a esta barbearia.", 409);
          }
        }
      }

      // If professionalId is provided, verify ownership in tenant
      if (professionalId) {
        const { data: prof } = await adminClient
          .from("barbers")
          .select("id")
          .eq("id", professionalId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!prof) {
          throw new EdgeError("INVALID_REQUEST", "Profissional não encontrado neste estabelecimento.", 400);
        }
      }

      // Normalize phone if present (Optional phone field)
      let normalizedPhone: string | null = null;
      if (phone && phone.trim()) {
        normalizedPhone = normalizePhone(phone);
        if (normalizedPhone && !isValidBrazilianPhone(normalizedPhone)) {
          throw new EdgeError("INVALID_REQUEST", "Telefone de convite inválido. Informe o DDD e o número com 10 ou 11 dígitos.", 400);
        }
      }

      // Generate cryptographically secure 64-char token (72h expiry)
      const token = randomBytesHex(32);
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

      const { data: insertedInvite, error: insertError } = await adminClient
        .from("user_invitations")
        .insert({
          tenant_id: tenantId,
          email: cleanEmail,
          phone: normalizedPhone,
          role,
          professional_id: professionalId || null,
          token_hash: token,
          status: "pending",
          expires_at: expiresAt,
          invited_by: userId
        })
        .select("id")
        .single();

      if (insertError) {
        throw new EdgeError("INTERNAL_ERROR", "Falha ao registrar convite.", 500);
      }

      // Fetch tenant branding for email
      const { data: tenantProfile } = await adminClient
        .from("profiles")
        .select("business_name, display_name")
        .eq("id", tenantId)
        .maybeSingle();

      const appUrl = Deno.env.get("APP_URL") || "https://barbex.shop";
      const inviteUrl = `${appUrl.replace(/\/+$/, "")}/invite/${token}`;

      try {
        await sendEmail({
          recipient: cleanEmail,
          templateKey: "internal_user_invitation",
          templateData: {
            barbershopName: tenantProfile?.business_name || tenantProfile?.display_name || "Barbex",
            role,
            inviteUrl
          },
          tenantId,
          userId
        });
      } catch (emailErr) {
        // Rollback inserted invitation on email dispatch failure
        await adminClient.from("user_invitations").delete().eq("id", insertedInvite.id);
        logger.error("Failed to send invitation email; rolled back invitation row", { durationMs: Date.now() - startTime });
        throw new EdgeError("SERVICE_UNAVAILABLE", "Falha no envio do e-mail de convite. O convite foi cancelado.", 503);
      }

      logger.info("Team invitation issued successfully", { action: "invite", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: RESEND
    // -------------------------------------------------------------------------
    if (payload.action === "resend") {
      const { userId, tenantId } = await resolveAdminCaller(req, adminClient);
      const { invitationId } = payload;

      if (!invitationId) {
        throw new EdgeError("INVALID_REQUEST", "Identificador do convite é obrigatório.", 400);
      }

      const rateLimitKey = await generateRateLimitKey("team:resend", invitationId, tenantId, clientIp);
      await checkRateLimit(rateLimitKey, 5, 300);

      const { data: invite, error: fetchErr } = await adminClient
        .from("user_invitations")
        .select("*")
        .eq("id", invitationId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (fetchErr || !invite) {
        throw new EdgeError("NOT_FOUND", "Convite não encontrado.", 404);
      }

      if (invite.status === "accepted") {
        throw new EdgeError("CONFLICT", "Este convite já foi aceito e o usuário já está ativo.", 409);
      }

      if (invite.status === "revoked") {
        throw new EdgeError("CONFLICT", "Este convite foi revogado. Crie um novo convite.", 409);
      }

      const previousToken = invite.token_hash;
      const previousExpiresAt = invite.expires_at;
      const previousStatus = invite.status;

      const newToken = randomBytesHex(32);
      const newExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

      const { error: updateErr } = await adminClient
        .from("user_invitations")
        .update({
          token_hash: newToken,
          status: "pending",
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        })
        .eq("id", invitationId)
        .eq("tenant_id", tenantId);

      if (updateErr) {
        throw new EdgeError("INTERNAL_ERROR", "Erro ao atualizar token do convite.", 500);
      }

      const { data: tenantProfile } = await adminClient
        .from("profiles")
        .select("business_name, display_name")
        .eq("id", tenantId)
        .maybeSingle();

      const appUrl = Deno.env.get("APP_URL") || "https://barbex.shop";
      const inviteUrl = `${appUrl.replace(/\/+$/, "")}/invite/${newToken}`;

      try {
        await sendEmail({
          recipient: invite.email,
          templateKey: "internal_user_invitation",
          templateData: {
            barbershopName: tenantProfile?.business_name || tenantProfile?.display_name || "Barbex",
            role: invite.role,
            inviteUrl
          },
          tenantId,
          userId
        });
      } catch (emailErr) {
        // Restore previous token state on email failure
        await adminClient
          .from("user_invitations")
          .update({
            token_hash: previousToken,
            status: previousStatus,
            expires_at: previousExpiresAt,
            updated_at: new Date().toISOString()
          })
          .eq("id", invitationId)
          .eq("tenant_id", tenantId);

        throw new EdgeError("SERVICE_UNAVAILABLE", "Falha no envio do e-mail de convite. O convite anterior foi preservado.", 503);
      }

      logger.info("Team invitation resent successfully", { action: "resend", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: REVOKE
    // -------------------------------------------------------------------------
    if (payload.action === "revoke") {
      const { tenantId } = await resolveAdminCaller(req, adminClient);
      const { invitationId } = payload;

      if (!invitationId) {
        throw new EdgeError("INVALID_REQUEST", "Identificador do convite é obrigatório.", 400);
      }

      const { data: revokedInvite, error: revokeErr } = await adminClient
        .from("user_invitations")
        .update({
          status: "revoked",
          updated_at: new Date().toISOString()
        })
        .eq("id", invitationId)
        .eq("tenant_id", tenantId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (revokeErr || !revokedInvite) {
        throw new EdgeError("NOT_FOUND", "Convite não encontrado ou já processado.", 404);
      }

      logger.info("Team invitation revoked", { action: "revoke", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true }, 200, req);
    }

    // -------------------------------------------------------------------------
    // ACTION: VALIDATE (PUBLIC PRE-AUTH)
    // -------------------------------------------------------------------------
    if (payload.action === "validate") {
      const { token } = payload;
      if (!token || typeof token !== "string" || !/^[a-fA-F0-9]{64}$/.test(token.trim())) {
        return buildResponse({ ok: true, valid: false }, 200, req);
      }

      const cleanToken = token.trim();
      const rateLimitKey = await generateRateLimitKey("team:validate", cleanToken, undefined, clientIp);
      await checkRateLimit(rateLimitKey, 30, 300);

      const { data: invite, error } = await adminClient
        .from("user_invitations")
        .select("email, role, expires_at, status, tenant_id")
        .eq("token_hash", cleanToken)
        .eq("status", "pending")
        .maybeSingle();

      if (error || !invite || new Date(invite.expires_at) <= new Date()) {
        return buildResponse({ ok: true, valid: false }, 200, req);
      }

      const { data: tenantProfile } = await adminClient
        .from("profiles")
        .select("business_name, display_name")
        .eq("id", invite.tenant_id)
        .maybeSingle();

      return buildResponse(
        {
          ok: true,
          valid: true,
          email: invite.email,
          role: invite.role,
          barbershopName: tenantProfile?.business_name || tenantProfile?.display_name || "Barbearia",
          expiresAt: invite.expires_at
        },
        200,
        req
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: ACCEPT (PUBLIC PRE-AUTH OR AUTHENTICATED)
    // -------------------------------------------------------------------------
    if (payload.action === "accept") {
      const { token, password } = payload;
      if (!token || typeof token !== "string" || !/^[a-fA-F0-9]{64}$/.test(token.trim())) {
        throw new EdgeError("INVALID_REQUEST", "Convite inválido ou malformado.", 400);
      }

      if (!password || typeof password !== "string" || password.length < 6) {
        throw new EdgeError("INVALID_REQUEST", "A senha deve ter no mínimo 6 caracteres.", 400);
      }

      const cleanToken = token.trim();
      const rateLimitKey = await generateRateLimitKey("team:accept", cleanToken, undefined, clientIp);
      await checkRateLimit(rateLimitKey, 10, 300);

      // 1. Fetch and pre-validate invitation
      const { data: invite, error: inviteErr } = await adminClient
        .from("user_invitations")
        .select("*")
        .eq("token_hash", cleanToken)
        .eq("status", "pending")
        .maybeSingle();

      if (inviteErr || !invite) {
        throw new EdgeError("INVALID_REQUEST", "Convite inválido ou já utilizado.", 400);
      }

      if (new Date(invite.expires_at) <= new Date()) {
        await adminClient
          .from("user_invitations")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", invite.id);
        throw new EdgeError("CONFLICT", "Este convite expirou.", 409);
      }

      // 2. Resolve or Create GoTrue User
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingAuthUser = (listData?.users || []).find(
        (u) => Boolean(u.email) && u.email!.toLowerCase() === invite.email.toLowerCase()
      );

      let targetUserId: string;
      let newlyCreatedAuthUserId: string | null = null;

      if (!existingAuthUser) {
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email: invite.email,
          password: password,
          email_confirm: true,
          user_metadata: {
            role: invite.role
          }
        });

        if (createError || !newUser?.user) {
          throw new EdgeError("INTERNAL_ERROR", `Falha ao criar credenciais de acesso: ${createError?.message || "erro interno"}`, 500);
        }

        targetUserId = newUser.user.id;
        newlyCreatedAuthUserId = targetUserId;
      } else {
        targetUserId = existingAuthUser.id;

        const { data: existingProfile } = await adminClient
          .from("profiles")
          .select("role")
          .eq("id", targetUserId)
          .maybeSingle();

        const isPrivileged = ["super_admin", "admin", "tenant_admin"].includes(existingProfile?.role);
        if (!isPrivileged) {
          await adminClient.auth.admin.updateUserById(targetUserId, {
            password: password,
            email_confirm: true
          });
        }
      }

      // 3. Execute atomic database acceptance transaction via RPC
      try {
        const { data: rpcResult, error: rpcErr } = await adminClient.rpc("accept_team_invitation_atomic", {
          p_token: cleanToken,
          p_user_id: targetUserId,
          p_phone: invite.phone || null
        });

        if (rpcErr || !rpcResult || rpcResult.ok !== true) {
          const msg = rpcResult?.message || rpcErr?.message || "Erro ao processar o aceite do convite.";
          throw new EdgeError("CONFLICT", msg, 409);
        }
      } catch (txErr) {
        // Rollback orphan Auth user if created in this execution
        if (newlyCreatedAuthUserId) {
          try {
            await adminClient.auth.admin.deleteUser(newlyCreatedAuthUserId);
          } catch {
            // Ignore delete error
          }
        }
        throw txErr;
      }

      logger.info("Team invitation accepted successfully", { action: "accept", durationMs: Date.now() - startTime });
      return buildResponse({ ok: true }, 200, req);
    }

    throw new EdgeError("INVALID_REQUEST", "Ação desconhecida.", 400);
  } catch (err: unknown) {
    if (err instanceof EdgeError) {
      return buildResponse({ ok: false, code: err.code, error: err.message }, err.status, req);
    }

    logger.error("Unexpected error during team-invitations execution", {
      durationMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : "Unknown error"
    });

    return buildResponse({ ok: false, code: "SERVICE_UNAVAILABLE", error: "Serviço temporariamente indisponível." }, 503, req);
  }
});
