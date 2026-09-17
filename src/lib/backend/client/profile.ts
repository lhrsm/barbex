/**
 * BARBEX — PROFILE DIRECT CLIENT ADAPTER
 * Updates the user's profile directly via Supabase Client protected by RLS (auth.uid() = id).
 * Validates Brazilian phone numbers, sanitizes https avatar URLs, and synchronizes display names.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, isValidBrazilianPhone } from "@/utils/phone";

export interface UpdateMyProfileParams {
  displayName?: string;
  responsibleName?: string;
  phone?: string;
  avatarUrl?: string;
}

export async function updateMyProfileClient(params: UpdateMyProfileParams) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Usuário não autenticado.");

  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (params.displayName !== undefined) {
    patch.display_name = params.displayName || null;
  }
  if (params.responsibleName !== undefined) {
    patch.responsible_name = params.responsibleName || null;
  }
  if (params.phone !== undefined) {
    if (!params.phone || params.phone.trim() === "") {
      patch.phone = null;
    } else {
      const cleanPhone = normalizePhone(params.phone);
      if (cleanPhone && !isValidBrazilianPhone(cleanPhone)) {
        throw new Error("Telefone inválido. Informe o DDD e o número com 10 ou 11 dígitos.");
      }
      patch.phone = cleanPhone || null;
    }
  }
  if (params.avatarUrl !== undefined) {
    if (params.avatarUrl && params.avatarUrl.trim() !== "") {
      try {
        const parsed = new URL(params.avatarUrl.trim());
        if (parsed.protocol !== "https:") {
          throw new Error("A foto de perfil deve ser uma URL segura (https://).");
        }
      } catch {
        throw new Error("URL da foto de perfil inválida.");
      }
      patch.avatar_url = params.avatarUrl.trim();
    } else {
      patch.avatar_url = null;
    }
  }

  if (patch.display_name && !patch.responsible_name) {
    patch.responsible_name = patch.display_name;
  } else if (patch.responsible_name && !patch.display_name) {
    patch.display_name = patch.responsible_name;
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("id, email, display_name, responsible_name, phone, avatar_url, role, tenant_id")
    .maybeSingle();

  if (error) {
    if ((error as any).code === "23505" || (error.message && error.message.toLowerCase().includes("unique"))) {
      throw new Error("Não foi possível atualizar o perfil: este número de telefone já está associado a outra conta.");
    }
    throw new Error("Erro ao atualizar perfil. Verifique os dados informados.");
  }

  return { success: true, profile: updated };
}
