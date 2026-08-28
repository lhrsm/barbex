
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes } from "crypto";

const appRoleEnum = z.enum(["admin", "tenant_admin", "barber", "client", "reception", "manager", "financial"]);

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    email: z.string().email(),
    phone: z.string().optional(),
    role: z.string(),
    professionalId: z.string().optional(),
    tenantId: z.string()
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { email, phone, role, professionalId, tenantId } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 0. Authorization check: Caller must be owner, admin or tenant_admin of tenantId
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const { data: callerMembership } = await supabase
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const isOwner = userId === tenantId || callerProfile?.role === 'super_admin' || callerProfile?.role === 'admin' || callerProfile?.role === 'tenant_admin';
    const callerRole = isOwner ? 'admin' : (callerMembership?.role || callerProfile?.role);

    if (!isOwner && callerRole !== 'admin' && callerRole !== 'tenant_admin') {
      throw new Error("Acesso negado: você não possui permissão para gerenciar a equipe deste estabelecimento.");
    }

    // Prevenção de escalação de privilégios:
    if (role === 'super_admin' && callerProfile?.role !== 'super_admin') {
      throw new Error("Não é permitido convidar administradores globais.");
    }

    const sanitizedEmail = email.trim().toLowerCase();

    // 1. Check if there is already an active pending invitation for this email in this tenant
    const { data: pendingInvite } = await supabaseAdmin
      .from('user_invitations')
      .select('id, expires_at, status')
      .eq('tenant_id', tenantId)
      .ilike('email', sanitizedEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingInvite) {
      const isExpired = new Date(pendingInvite.expires_at) <= new Date();
      if (!isExpired) {
        throw new Error("Já existe um convite pendente para este e-mail.");
      } else {
        // Mark previous expired invite
        await supabaseAdmin
          .from('user_invitations')
          .update({ status: 'expired', updated_at: new Date().toISOString() } as any)
          .eq('id', pendingInvite.id);
      }
    }

    // 2. Validate real tenant membership
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .ilike('email', sanitizedEmail)
      .maybeSingle();

    if (existingUser) {
      const { data: existingMembership } = await supabaseAdmin
        .from('tenant_memberships')
        .select('id, role, status')
        .eq('tenant_id', tenantId)
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (existingMembership && existingMembership.status === 'active') {
        const isPrivileged =
          existingMembership.role === 'super_admin' ||
          existingMembership.role === 'admin' ||
          existingMembership.role === 'tenant_admin' ||
          existingUser.role === 'super_admin' ||
          existingUser.role === 'admin' ||
          existingUser.role === 'tenant_admin';

        if (isPrivileged) {
          throw new Error("Este usuário já possui privilégios de administrador nesta barbearia.");
        }

        if (existingMembership.role === role) {
          throw new Error("Este usuário já possui acesso ativo a esta barbearia.");
        }
      }
    }

    // 3. If professionalId provided, ensure it belongs to this tenant
    if (professionalId) {
      const { data: prof } = await supabaseAdmin
        .from('barbers')
        .select('id')
        .eq('id', professionalId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!prof) {
        throw new Error("Profissional não encontrado neste estabelecimento.");
      }
    }

    // 4. Generate token and insert invitation
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72); // 72 hours expiration

    const { error: inviteError } = await supabaseAdmin
      .from('user_invitations')
      .insert({
        tenant_id: tenantId,
        email: sanitizedEmail,
        phone,
        role,
        professional_id: professionalId,
        token_hash: token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        invited_by: userId
      } as any);

    if (inviteError) {
      throw new Error(inviteError.message);
    }

    // 2. Send Email via Resend
    // We'll import the send function inside handler to avoid module scope issues
    const { sendTransactionalEmail } = await import("./resend.functions");
    
    const appUrl = process.env['VITE_APP_URL'] || process.env['APP_URL'] || 'https://barbex.shop';
    const inviteUrl = `${appUrl}/invite/${token}`;

    const { data: tenant } = await supabase
      .from('profiles')
      .select('display_name, business_name')
      .eq('id', tenantId)
      .maybeSingle();

    try {
      await sendTransactionalEmail({
        data: {
          recipient: email,
          templateKey: 'internal_user_invitation',
          templateData: {
            barbershopName: tenant?.business_name || tenant?.display_name || 'Barbex',
            role,
            inviteUrl
          },
          tenantId,
          userId
        }
      });
    } catch (emailError: any) {
      // Rollback: remove the invitation if email fails
      await supabaseAdmin
        .from('user_invitations')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('email', email)
        .eq('token_hash', token);

      throw new Error(`Falha no envio do e-mail de convite (${emailError?.message || 'serviço indisponível'}). O convite foi cancelado.`);
    }

    return { success: true };
  });

export const resendTeamInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    invitationId: z.string().uuid(),
    tenantId: z.string().uuid()
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { invitationId, tenantId } = data;

    // Caller authorization check (strictly matching users:manage permission)
    const { data: callerMembership } = await supabase
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const isOwner = userId === tenantId || callerProfile?.role === 'super_admin' || callerProfile?.role === 'admin' || callerProfile?.role === 'tenant_admin';
    const callerRole = isOwner ? 'admin' : (callerMembership?.role || callerProfile?.role);

    if (!isOwner && callerRole !== 'admin' && callerRole !== 'tenant_admin') {
      throw new Error("Acesso negado: você não tem permissão para reenviar convites.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch existing invitation
    const { data: invite, error: fetchError } = await supabaseAdmin
      .from('user_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError || !invite) {
      throw new Error("Convite não encontrado.");
    }

    if (invite.status === 'accepted') {
      throw new Error("Este convite já foi aceito e o usuário já está ativo.");
    }

    if (invite.status === 'revoked') {
      throw new Error("Este convite foi revogado. Crie um novo convite.");
    }

    // Capture previous state for rollback compensation
    const previousToken = invite.token_hash;
    const previousExpiresAt = invite.expires_at;
    const previousStatus = invite.status;

    // Generate new token and refresh expiration for 72 hours
    const newToken = randomBytes(32).toString('hex');
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + 72);

    const { error: updateError } = await supabaseAdmin
      .from('user_invitations')
      .update({
        token_hash: newToken,
        status: 'pending',
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', invitationId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Send updated transactional email
    const { sendTransactionalEmail } = await import("./resend.functions");
    const appUrl = process.env['VITE_APP_URL'] || process.env['APP_URL'] || 'https://barbex.shop';
    const inviteUrl = `${appUrl}/invite/${newToken}`;

    const { data: tenantProfile } = await supabaseAdmin
      .from('profiles')
      .select('business_name, display_name')
      .eq('id', tenantId)
      .maybeSingle();

    try {
      await sendTransactionalEmail({
        data: {
          recipient: invite.email,
          templateKey: 'internal_user_invitation',
          templateData: {
            barbershopName: tenantProfile?.business_name || tenantProfile?.display_name || 'Barbex',
            role: invite.role,
            inviteUrl
          },
          tenantId,
          userId
        }
      });
    } catch (emailError: any) {
      // Conditional rollback: restore previous token only if this resend token is still the active one
      await supabaseAdmin
        .from('user_invitations')
        .update({
          token_hash: previousToken,
          status: previousStatus,
          expires_at: previousExpiresAt,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', invitationId)
        .eq('tenant_id', tenantId)
        .eq('token_hash', newToken);

      throw new Error(`Falha no envio do e-mail de convite (${emailError?.message || 'serviço indisponível'}). O convite anterior foi preservado.`);
    }

    return { success: true };
  });

export const revokeTeamInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    invitationId: z.string().uuid(),
    tenantId: z.string().uuid()
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { invitationId, tenantId } = data;

    // Caller authorization check
    const { data: callerMembership } = await supabase
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const isOwner = userId === tenantId || callerProfile?.role === 'super_admin' || callerProfile?.role === 'admin' || callerProfile?.role === 'tenant_admin';
    const callerRole = isOwner ? 'admin' : (callerMembership?.role || callerProfile?.role);

    if (!isOwner && callerRole !== 'admin' && callerRole !== 'tenant_admin') {
      throw new Error("Acesso negado: você não tem permissão para revogar convites.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Atomic revocation of pending invitation
    const { data: revokedInvite, error: revokeError } = await supabaseAdmin
      .from('user_invitations')
      .update({
        status: 'revoked',
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', invitationId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (revokeError) {
      throw new Error(revokeError.message);
    }

    if (!revokedInvite) {
      throw new Error("Convite não encontrado ou já processado.");
    }

    return { success: true };
  });

export const getTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ tenantId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    // Caller authorization: must be admin or tenant_admin of tenantId
    const { data: callerMembership } = await supabase
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', data.tenantId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const isOwner = userId === data.tenantId || callerProfile?.role === 'super_admin' || callerProfile?.role === 'admin' || callerProfile?.role === 'tenant_admin';
    const callerRole = isOwner ? 'admin' : (callerMembership?.role || callerProfile?.role);

    if (!isOwner && callerRole !== 'admin' && callerRole !== 'tenant_admin') {
      throw new Error("Acesso negado: você não tem permissão para visualizar os membros da equipe.");
    }

    const { data: members, error } = await supabase
      .from('tenant_memberships')
      .select(`
        *,
        profile:profiles!tenant_memberships_user_id_fkey(
          id,
          display_name,
          email,
          avatar_url,
          responsible_name
        )
      `)
      .eq('tenant_id', data.tenantId);

    if (error) throw new Error(error.message);
    return members;
  });

export const getPendingInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ tenantId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    // Caller authorization: must be admin or tenant_admin of tenantId
    const { data: callerMembership } = await supabase
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', data.tenantId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const isOwner = userId === data.tenantId || callerProfile?.role === 'super_admin' || callerProfile?.role === 'admin' || callerProfile?.role === 'tenant_admin';
    const callerRole = isOwner ? 'admin' : (callerMembership?.role || callerProfile?.role);

    if (!isOwner && callerRole !== 'admin' && callerRole !== 'tenant_admin') {
      throw new Error("Acesso negado: você não tem permissão para visualizar convites pendentes.");
    }

    const { data: invites, error } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('tenant_id', data.tenantId)
      .eq('status', 'pending');

    if (error) throw new Error(error.message);
    return invites;
  });

export const validateInvitationToken = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    token: z.string()
  }))
  .handler(async ({ data }) => {
    const { token } = data;
    if (!token || typeof token !== "string" || !/^[a-fA-F0-9]{64}$/.test(token.trim())) {
      return { valid: false as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error } = await supabaseAdmin
      .from('user_invitations')
      .select('*, tenant:profiles!user_invitations_tenant_id_fkey(business_name, display_name)')
      .eq('token_hash', token.trim())
      .eq('status', 'pending')
      .maybeSingle();

    if (error || !invite) {
      return { valid: false as const };
    }

    if (invite.status !== 'pending' || (invite as any).accepted_at) {
      return { valid: false as const };
    }

    if (new Date(invite.expires_at) <= new Date()) {
      return { valid: false as const };
    }

    const tenantProfile = invite.tenant as any;
    const barbershopName = tenantProfile?.business_name || tenantProfile?.display_name || "Barbearia";

    return {
      valid: true as const,
      email: invite.email,
      role: invite.role,
      barbershopName,
      expiresAt: invite.expires_at
    };
  });

export const acceptTeamInvitation = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    password: z.string().min(6)
  }))
  .handler(async ({ data }) => {
    const { token, password } = data;
    if (!token || typeof token !== "string" || !/^[a-fA-F0-9]{64}$/.test(token.trim())) {
      throw new Error("Convite inválido ou malformado.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Validate Invitation (Server-Side pre-check)
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('user_invitations')
      .select('*')
      .eq('token_hash', token.trim())
      .eq('status', 'pending')
      .maybeSingle();

    if (inviteError || !invite || invite.status !== 'pending' || (invite as any).accepted_at) {
      throw new Error("Convite inválido ou já utilizado.");
    }

    if (new Date(invite.expires_at) <= new Date()) {
      await supabaseAdmin
        .from('user_invitations')
        .update({ status: 'expired' } as any)
        .eq('id', invite.id);
      throw new Error("Este convite expirou.");
    }

    // 2. Check if Auth User exists
    const { data: authData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw new Error("Erro ao verificar usuários.");
    let user = authData.users.find(u => Boolean(u.email) && u.email!.toLowerCase() === invite.email.toLowerCase());

    if (!user) {
      // Create Auth User
      // Note: Passing role only (without tenant_id in raw_user_meta_data) ensures the trigger
      // handle_new_user creates the initial profile without triggering tg_admin_notify_new_tenant
      // which crashes on legacy profiles without barbershop_name.
      // Tenant association and permissions are explicitly and securely assigned in Step 3 below.
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: invite.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          role: invite.role
        }
      });
      if (createError) throw new Error(createError.message);
      user = newUser.user;
    } else {
      // Existing user: check if account holds owner/admin privileges before updating password
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const isPrivileged = existingProfile?.role === 'super_admin' || existingProfile?.role === 'admin' || existingProfile?.role === 'tenant_admin';

      if (!isPrivileged) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: password,
          email_confirm: true
        });
      }
    }

    // 3. Link Membership & Profile (Idempotent & Defensive)
    const { data: existingMembership } = await supabaseAdmin
      .from('tenant_memberships')
      .select('id, role, status')
      .eq('tenant_id', invite.tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMembership) {
      // Existing membership: preserve privileged roles, allow updates for staff roles
      const isPrivilegedRole =
        existingMembership.role === 'super_admin' ||
        existingMembership.role === 'admin' ||
        existingMembership.role === 'tenant_admin';

      const targetRole = isPrivilegedRole ? existingMembership.role : invite.role;

      const { error: updateMemError } = await supabaseAdmin
        .from('tenant_memberships')
        .update({
          role: targetRole,
          status: 'active',
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', existingMembership.id);

      if (updateMemError) {
        throw new Error("Erro ao atualizar o vínculo da equipe.");
      }
    } else {
      // Create new membership with explicit composite unique key conflict resolution
      const { error: insertMemError } = await supabaseAdmin
        .from('tenant_memberships')
        .upsert(
          {
            tenant_id: invite.tenant_id,
            user_id: user.id,
            role: invite.role,
            status: 'active',
            updated_at: new Date().toISOString()
          } as any,
          { onConflict: 'tenant_id,user_id' }
        );

      if (insertMemError) {
        // Defensive check: if race condition 23505 occurs, confirm membership exists
        const { data: retryMem } = await supabaseAdmin
          .from('tenant_memberships')
          .select('id')
          .eq('tenant_id', invite.tenant_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!retryMem) {
          throw new Error("Erro ao estabelecer vínculo com o estabelecimento.");
        }
      }
    }

    // Update profile role only if user is not already an administrator/owner
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isPrivilegedProfile =
      currentProfile?.role === 'super_admin' ||
      currentProfile?.role === 'admin' ||
      currentProfile?.role === 'tenant_admin';

    if (!isPrivilegedProfile) {
      await supabaseAdmin
        .from('profiles')
        .update({
          role: invite.role,
          tenant_id: invite.tenant_id,
          status: 'active',
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', user.id);
    }

    // 4. Update Invitation Status (Conditional Atomic Claim)
    const { data: claimedInvite, error: updateInviteError } = await supabaseAdmin
      .from('user_invitations')
      .update({ 
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', invite.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (updateInviteError || !claimedInvite) {
      throw new Error("Convite já foi utilizado por outra sessão concorrente.");
    }

    return { success: true };
  });
