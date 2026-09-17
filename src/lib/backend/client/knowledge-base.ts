/**
 * BARBEX — KNOWLEDGE BASE & CONTENT ADMIN DIRECT CLIENT ADAPTER
 * Manages tutorials, academy lessons, and changelog updates with admin RLS.
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Saves or updates a tutorial with versioning and audit logging via Supabase Client RLS.
 */
export async function adminSaveTutorialClient(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Usuário não autenticado.");

  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (!isAdmin) throw new Error("Unauthorized: Apenas administradores podem gerenciar conteúdo.");

  const { id, ...values } = data;

  if (id) {
    const { data: current } = await supabase
      .from("tutorials")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (current) {
      await supabase.from("article_versions").insert({
        tutorial_id: id,
        version_number: current.version || 1,
        title: current.title,
        content: current.description || "",
        summary: current.description?.substring(0, 100),
        author_id: user.id,
        change_reason: data.change_reason || "Update",
      });

      values.version = (current.version || 1) + 1;
    }
  }

  const { data: result, error } = await supabase
    .from("tutorials")
    .upsert({
      id,
      ...values,
      author_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("content_workflow_logs").insert({
    content_type: "tutorial",
    content_id: result.id,
    from_status: data.from_status || "draft",
    to_status: values.status || "published",
    user_id: user.id,
    notes: data.change_reason,
  });

  return result;
}

/**
 * Saves or updates an academy lesson directly via Supabase Client RLS.
 */
export async function adminSaveAcademyLessonClient(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Usuário não autenticado.");

  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (!isAdmin) throw new Error("Unauthorized: Acesso restrito a administradores.");

  const { id, ...values } = data;

  const { data: result, error } = await supabase
    .from("academy_lessons")
    .upsert({ id, ...values })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return result;
}

/**
 * Saves or updates a changelog entry directly via Supabase Client RLS.
 */
export async function adminSaveUpdateClient(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Usuário não autenticado.");

  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (!isAdmin) throw new Error("Unauthorized: Acesso restrito a administradores.");

  const { id, ...values } = data;

  if (values.status === "published" && !values.published_at) {
    values.published_at = new Date().toISOString();
  }

  const { data: result, error } = await supabase
    .from("changelog_entries")
    .upsert({
      id,
      ...values,
      author_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return result;
}

/**
 * Increments view count for tutorials or academy content via RPC.
 */
export async function reportContentViewClient(contentType: string, contentId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.rpc("increment_content_views", {
    c_type: contentType,
    c_id: contentId,
  });

  return { ok: !error };
}
