import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      displayName: z.string().trim().max(120).optional(),
      responsibleName: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(30).optional(),
      avatarUrl: z
        .string()
        .trim()
        .refine(
          (val) => {
            if (!val) return true;
            try {
              const parsed = new URL(val);
              return parsed.protocol === "https:";
            } catch {
              return false;
            }
          },
          { message: "A foto de perfil deve ser uma URL segura (https://)." }
        )
        .optional()
        .or(z.literal("")),
    }))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    if (!userId) {
      throw new Error("Usuário não autenticado.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.displayName !== undefined) {
      patch.display_name = data.displayName || null;
    }
    if (data.responsibleName !== undefined) {
      patch.responsible_name = data.responsibleName || null;
    }
    if (data.phone !== undefined) {
      patch.phone = data.phone || null;
    }
    if (data.avatarUrl !== undefined) {
      patch.avatar_url = data.avatarUrl || null;
    }

    // Se informou apenas display_name ou responsible_name, preenche ambos para consistência
    if (patch.display_name && !patch.responsible_name) {
      patch.responsible_name = patch.display_name;
    } else if (patch.responsible_name && !patch.display_name) {
      patch.display_name = patch.responsible_name;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update(patch as any)
      .eq("id", userId)
      .select("id, email, display_name, responsible_name, phone, avatar_url, role, tenant_id")
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao atualizar perfil: ${error.message}`);
    }

    return { success: true, profile: updated };
  });
