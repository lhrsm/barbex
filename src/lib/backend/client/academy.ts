/**
 * BARBEX — ACADEMY DIRECT SUPABASE CLIENT ADAPTER
 * Replaces legacy Server Functions with direct, secure Supabase Client queries.
 * Fully protected by PostgreSQL Row Level Security (RLS) on:
 * - public.academy_paths
 * - public.academy_modules
 * - public.academy_lessons
 * - public.academy_progress
 */

import { supabase } from "@/integrations/supabase/client";

export interface AcademyPath {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  profile_target: string | null;
  status: string;
  order: number;
  duration: string | null;
  difficulty: string | null;
  level: string | null;
  tenant_id?: string | null;
}

export interface GetAcademyPathsParams {
  profile_target?: string;
}

export interface GetAcademyPathDetailsParams {
  pathId: string;
}

export interface MarkLessonProgressParams {
  pathId: string;
  lessonId: string;
  status: "started" | "completed";
}

/**
 * Fetches all published or tenant-accessible academy paths.
 */
export async function getAcademyPathsClient(params: GetAcademyPathsParams = {}): Promise<{ items: AcademyPath[] }> {
  let query = supabase
    .from("academy_paths")
    .select("*")
    .order("order", { ascending: true });

  if (params.profile_target) {
    query = query.eq("profile_target", params.profile_target);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return { items: (data || []) as AcademyPath[] };
}

/**
 * Fetches full details for an academy path, including modules, sorted lessons, and user progress.
 */
export async function getAcademyPathDetailsClient(params: GetAcademyPathDetailsParams) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: path, error: pathError } = await supabase
    .from("academy_paths")
    .select("*")
    .eq("id", params.pathId)
    .single();

  if (pathError) throw new Error(pathError.message);

  const { data: modules, error: modulesError } = await supabase
    .from("academy_modules")
    .select(`
      *,
      lessons:academy_lessons(*)
    `)
    .eq("path_id", params.pathId)
    .order("order", { ascending: true });

  if (modulesError) throw new Error(modulesError.message);

  // Fetch progress for authenticated user if session active
  let progress: Array<{ lesson_id: string; status: string }> = [];
  if (user?.id) {
    const { data: userProgress } = await supabase
      .from("academy_progress")
      .select("lesson_id, status")
      .eq("user_id", user.id)
      .eq("path_id", params.pathId);

    progress = (userProgress || []) as Array<{ lesson_id: string; status: string }>;
  }

  const progressMap = new Map(progress.map((p) => [p.lesson_id, p.status]));

  const enrichedModules = (modules || []).map((m: any) => ({
    ...m,
    lessons: (m.lessons || [])
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      .map((l: any) => ({
        ...l,
        progress: progressMap.get(l.id) || "not_started",
      })),
  }));

  return {
    path,
    modules: enrichedModules,
    stats: {
      totalLessons: enrichedModules.reduce((acc: number, m: any) => acc + m.lessons.length, 0),
      completedLessons: progress.filter((p) => p.status === "completed").length,
    },
  };
}

/**
 * Marks progress for a lesson (upserts into academy_progress).
 */
export async function markLessonProgressClient(params: MarkLessonProgressParams): Promise<{ ok: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Usuário não autenticado.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  const tenantId = profile?.tenant_id || user.id;

  const { error } = await supabase
    .from("academy_progress")
    .upsert(
      {
        user_id: user.id,
        tenant_id: tenantId,
        path_id: params.pathId,
        lesson_id: params.lessonId,
        status: params.status,
        completed_at: params.status === "completed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" }
    );

  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * Fetches recommended paths based on authenticated user's role.
 */
export async function getRecommendedPathsClient(): Promise<{ items: AcademyPath[] }> {
  const { data: { user } } = await supabase.auth.getUser();

  let targetRole = "user";
  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role) {
      targetRole = profile.role;
    }
  }

  const { data: paths, error } = await supabase
    .from("academy_paths")
    .select("*")
    .eq("profile_target", targetRole)
    .eq("status", "published")
    .limit(3);

  if (error) throw new Error(error.message);

  return { items: (paths || []) as AcademyPath[] };
}
