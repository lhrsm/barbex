import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmail } from "./resend.functions";

const MAX_STAFF_OTP_ATTEMPTS = 5;

function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code.trim()).digest("hex");
}

/**
 * Solicita envio de código OTP de 6 dígitos para verificação de e-mail do colaborador/barbeiro
 */
export const requestStaffEmailVerification = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    phone: z.string(),
    barberId: z.string().uuid(),
    tenantId: z.string(),
    barberName: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    const cleanEmail = data.email.trim().toLowerCase();

    // 1. Validar que o barbeiro existe e está vinculado ao tenant
    const { data: barber, error: barberError } = await supabaseAdmin
      .from("barbers")
      .select("id, name, tenant_id, user_id, active")
      .eq("id", data.barberId)
      .maybeSingle();

    if (barberError || !barber) {
      throw new Error("Colaborador não encontrado.");
    }

    // 2. Checar colisão de e-mail com o proprietário/administrador da barbearia
    const { data: tenantProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("id", data.tenantId)
      .maybeSingle();

    if (tenantProfile?.email && tenantProfile.email.toLowerCase() === cleanEmail) {
      throw new Error("Conflito: este e-mail já pertence ao administrador da barbearia.");
    }

    // 3. Checar se outro barbeiro deste ou de outro tenant já usa esse e-mail
    const { data: otherBarber } = await supabaseAdmin
      .from("barbers")
      .select("id, name")
      .eq("email", cleanEmail)
      .neq("id", data.barberId)
      .maybeSingle();

    if (otherBarber) {
      throw new Error(`Conflito: este e-mail já está em uso pelo profissional ${otherBarber.name}.`);
    }

    // 3.5 Checar se já existe conta no Supabase Auth por e-mail
    const listRes = await supabaseAdmin.auth.admin.listUsers();
    const users = listRes?.data?.users || [];
    const existingUser = users.find((u) => u.email?.toLowerCase() === cleanEmail);
    const emailExists = !!existingUser;

    // 4. Concorrência & Reset: remover qualquer challenge staff anterior para este barbeiro
    await supabaseAdmin
      .from("verification_challenges" as any)
      .delete()
      .eq("purpose", "staff_email_verification")
      .eq("barber_id", data.barberId);

    // 5. Gerar código numérico OTP de 6 dígitos e computar SHA-256
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = hashOtpCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos

    // 6. Gravar desafio na tabela de verificação com barber_id dedicado e attempts = 0
    const { data: insertedChallenge, error: insertError } = await supabaseAdmin
      .from("verification_challenges" as any)
      .insert({
        email: cleanEmail,
        barber_id: data.barberId,
        client_id: null,
        code_hash: codeHash,
        expires_at: expiresAt,
        purpose: "staff_email_verification",
        attempts: 0,
      })
      .select("id")
      .single();

    if (insertError) {
      if ((insertError as any).code === "23505") {
        console.warn("[StaffAuth] Concorrência detectada: challenge ativo já existente.");
        throw new Error("Uma solicitação de verificação já está em andamento. Aguarde alguns instantes.");
      }
      console.error("[StaffAuth] Erro ao gravar challenge:", insertError.message);
      throw new Error("Falha ao gerar código de verificação.");
    }

    // 7. Enviar e-mail transacional via Resend com tratamento e cleanup seguro por ID em caso de falha
    try {
      await sendTransactionalEmail({
        data: {
          recipient: cleanEmail,
          templateKey: "email_verification_code",
          templateData: {
            code,
            userName: data.barberName,
          },
        },
      });
      return { success: true, emailExists };
    } catch (sendErr) {
      console.error("[StaffAuth] Erro ao enviar e-mail com código:", sendErr);
      // Cleanup do challenge EXCLUSIVAMENTE pelo ID específico do registro recém-criado
      if ((insertedChallenge as any)?.id) {
        await supabaseAdmin
          .from("verification_challenges" as any)
          .delete()
          .eq("id", (insertedChallenge as any).id);
      }
      throw new Error("Não foi possível enviar o e-mail de verificação.");
    }
  });

/**
 * Valida o código OTP de 6 dígitos digitado pelo colaborador
 * Controla número máximo de 5 tentativas por código e transição atômica PENDING -> VERIFIED
 */
export const verifyStaffEmailCode = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    code: z.string().length(6),
    barberId: z.string().uuid(),
  }).parse(data))
  .handler(async ({ data }) => {
    const cleanEmail = data.email.trim().toLowerCase();
    const codeHash = hashOtpCode(data.code);

    const { data: challenge, error } = await supabaseAdmin
      .from("verification_challenges" as any)
      .select("id, email, code_hash, attempts, expires_at, verified_at, consumed_at")
      .eq("email", cleanEmail)
      .eq("purpose", "staff_email_verification")
      .eq("barber_id", data.barberId)
      .gt("expires_at", new Date().toISOString())
      .is("verified_at", null)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !challenge) {
      return { success: false, error: "Código inválido ou expirado." };
    }

    const currentAttempts = (challenge as any).attempts ?? 0;

    // Se o desafio já atingiu o limite de 5 tentativas, invalida e bloqueia
    if (currentAttempts >= MAX_STAFF_OTP_ATTEMPTS) {
      await supabaseAdmin
        .from("verification_challenges" as any)
        .delete()
        .eq("id", (challenge as any).id);

      return {
        success: false,
        error: "Este código não pode mais ser utilizado. Solicite um novo código de verificação.",
      };
    }

    // Validação do hash do código
    if ((challenge as any).code_hash !== codeHash) {
      const newAttempts = currentAttempts + 1;

      if (newAttempts >= MAX_STAFF_OTP_ATTEMPTS) {
        // Ao atingir a 5ª tentativa incorreta, invalida o desafio
        await supabaseAdmin
          .from("verification_challenges" as any)
          .delete()
          .eq("id", (challenge as any).id);

        return {
          success: false,
          error: "Este código não pode mais ser utilizado. Solicite um novo código de verificação.",
        };
      }

      // Incrementa a tentativa atomicamente no registro específico por ID
      await supabaseAdmin
        .from("verification_challenges" as any)
        .update({ attempts: newAttempts })
        .eq("id", (challenge as any).id)
        .is("verified_at", null)
        .is("consumed_at", null);

      return { success: false, error: "Código inválido ou expirado." };
    }

    // Código correto e dentro do limite de tentativas: transição atômica para VERIFIED
    const { error: updateErr } = await supabaseAdmin
      .from("verification_challenges" as any)
      .update({ verified_at: new Date().toISOString() })
      .eq("id", (challenge as any).id)
      .is("verified_at", null)
      .is("consumed_at", null);

    if (updateErr) {
      return { success: false, error: "Código inválido ou expirado." };
    }

    return { success: true };
  });

/**
 * Finaliza a migração/configuração do acesso do colaborador:
 * - Adquire exclusivamente o direito de consumo (Claim) no banco
 * - Cria/atualiza auth.users com e-mail e senha
 * - Vincula barbers.user_id, barbers.email e auth_migration_status
 * - Garante profiles, tenant_memberships e user_roles com role = 'barber'
 * - PRESERVA 100% o barber.id imutável
 */
export const finalizeStaffAuthSetup = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    password: z.string().min(6).optional(),
    barberId: z.string().uuid(),
    phone: z.string(),
    name: z.string(),
    tenantId: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    const cleanEmail = data.email.trim().toLowerCase();

    // 1. Validar que o barbeiro existe e está vinculado ao tenant
    const { data: barber, error: barberError } = await supabaseAdmin
      .from("barbers")
      .select("id, name, tenant_id, user_id, active")
      .eq("id", data.barberId)
      .maybeSingle();

    if (barberError || !barber) {
      throw new Error("Colaborador não encontrado.");
    }

    if (barber.tenant_id !== data.tenantId) {
      throw new Error("Conflito de tenant do colaborador.");
    }

    // 2. Aquisição Atômica de Consumo (Claim) para prevenir duplo finalize concorrente
    let challengeId: string | null = null;

    try {
      const { data: rpcRes, error: rpcErr } = await (supabaseAdmin.rpc as any)(
        "claim_staff_verification_challenge",
        {
          p_barber_id: data.barberId,
          p_email: cleanEmail,
          p_max_attempts: MAX_STAFF_OTP_ATTEMPTS,
        }
      );

      if (!rpcErr && rpcRes && rpcRes.length > 0 && rpcRes[0].claimed) {
        challengeId = rpcRes[0].challenge_id;
      }
    } catch {
      // Ignora erro de RPC se ainda não materializada no banco remoto
    }

    if (!challengeId) {
      // Fallback via consulta e update condicional atômico
      const { data: challenge } = await supabaseAdmin
        .from("verification_challenges" as any)
        .select("id, barber_id, attempts, expires_at, verified_at, consumed_at")
        .eq("email", cleanEmail)
        .eq("purpose", "staff_email_verification")
        .eq("barber_id", data.barberId)
        .gt("expires_at", new Date().toISOString())
        .not("verified_at", "is", null)
        .is("consumed_at", null)
        .lt("attempts", MAX_STAFF_OTP_ATTEMPTS)
        .order("verified_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!challenge) {
        throw new Error("E-mail não verificado ou solicitação já processada.");
      }

      const { error: claimErr } = await supabaseAdmin
        .from("verification_challenges" as any)
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", (challenge as any).id)
        .is("consumed_at", null);

      if (claimErr) {
        throw new Error("E-mail não verificado ou solicitação já processada.");
      }

      challengeId = (challenge as any).id;
    }

    if (!challengeId) {
      throw new Error("E-mail não verificado ou solicitação já processada.");
    }

    // 3. Verificar se já existe usuário no Supabase Auth por e-mail
    const listRes = await supabaseAdmin.auth.admin.listUsers();
    const users = listRes?.data?.users || [];
    const existingUser = users.find((u) => u.email?.toLowerCase() === cleanEmail);

    let userId: string;
    let newlyCreatedAuthUserId: string | null = null;

    const { normalizePhone } = await import("@/utils/phone");
    const canonicalPhone = data.phone ? normalizePhone(data.phone) : null;

    if (!existingUser) {
      if (!data.password || data.password.length < 6) {
        throw new Error("A senha deve ter no mínimo 6 caracteres para novas contas.");
      }
      // Criar novo usuário no Supabase Auth
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.name,
          phone: canonicalPhone,
          role: "barber",
          barber_id: data.barberId,
          tenant_id: data.tenantId,
        },
      });

      if (createError || !newUser?.user) {
        throw createError || new Error("Erro ao criar credenciais de autenticação.");
      }
      userId = newUser.user.id;
      newlyCreatedAuthUserId = userId;
    } else {
      userId = existingUser.id;
      // Não sobrescrevemos a senha de usuário pré-existente (ex: cliente); apenas garantimos metadata adicional
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existingUser.user_metadata,
          full_name: data.name,
          phone: canonicalPhone || existingUser.user_metadata?.phone,
          barber_id: data.barberId,
          tenant_id: data.tenantId,
        },
      });
    }

    try {
      // 4. Atualizar tabela BARBERS (PRESERVANDO integralmente o barber.id)
      const barberPatch: Record<string, any> = {
        user_id: userId,
        email: cleanEmail,
        auth_migration_status: "completed",
      };
      if (canonicalPhone) {
        barberPatch.phone = canonicalPhone;
      }

      const { error: barberUpdateError } = await supabaseAdmin
        .from("barbers")
        .update(barberPatch as any)
        .eq("id", data.barberId);

      if (barberUpdateError) {
        console.error("[StaffAuth] Erro ao vincular barbeiro:", barberUpdateError);
        throw new Error("Falha ao vincular perfil do profissional.");
      }

      // 5. Criar/Atualizar PROFILES
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, role, phone")
        .eq("id", userId)
        .maybeSingle();

      if (existingProfile) {
        // Se o perfil existente já for client, preservamos o papel base e garantimos o vínculo de membership
        const newRole = existingProfile.role === 'client' ? 'client' : 'barber';
        const profileUpdatePatch: Record<string, any> = {
          responsible_name: data.name,
          display_name: data.name,
          email: cleanEmail,
          role: newRole,
          identity_status: "completed",
          tenant_id: data.tenantId,
        };
        if (canonicalPhone && !existingProfile.phone) {
          profileUpdatePatch.phone = canonicalPhone;
        }

        await supabaseAdmin
          .from("profiles")
          .update(profileUpdatePatch as any)
          .eq("id", userId);
      } else {
        await supabaseAdmin
          .from("profiles")
          .insert({
            id: userId,
            responsible_name: data.name,
            display_name: data.name,
            email: cleanEmail,
            phone: canonicalPhone,
            role: "barber",
            identity_status: "completed",
            tenant_id: data.tenantId,
          });
      }

      // 6. Vincular TENANT_MEMBERSHIPS (role específico para o tenant)
      await supabaseAdmin
        .from("tenant_memberships")
        .upsert({
          tenant_id: data.tenantId,
          user_id: userId,
          role: "barber",
          status: "active",
        });

      // 7. Vincular USER_ROLES
      await supabaseAdmin
        .from("user_roles")
        .upsert({
          user_id: userId,
          role: "barber",
        } as any);

      // 8. Anti-Replay: Excluir definitivamente o desafio de verificação consumido
      if (challengeId) {
        await supabaseAdmin
          .from("verification_challenges" as any)
          .delete()
          .eq("id", challengeId);
      }

      return { success: true, userId, barberId: data.barberId };
    } catch (err: any) {
      // Compensação transacional: se o usuário foi criado nesta execução e o vínculo falhou, remove o usuário órfão
      if (newlyCreatedAuthUserId) {
        console.warn("[StaffAuth] Compensando falha: removendo auth.users órfão", newlyCreatedAuthUserId);
        try {
          await supabaseAdmin.auth.admin.deleteUser(newlyCreatedAuthUserId);
        } catch (cleanupErr) {
          console.error("[StaffAuth] Erro ao deletar auth user órfão:", cleanupErr);
        }
      }
      // Reverter o claim do challenge caso a transação tenha falhado
      if (challengeId) {
        try {
          await supabaseAdmin
            .from("verification_challenges" as any)
            .update({ consumed_at: null })
            .eq("id", challengeId);
        } catch (revertErr) {
          console.error("[StaffAuth] Erro ao reverter claim:", revertErr);
        }
      }
      throw err;
    }
  });
