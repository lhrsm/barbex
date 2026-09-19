/**
 * BARBEX — TEAM MANAGEMENT EDGE & DIRECT CLIENT ADAPTER
 * Adapts team management operations (invites, acceptance, member listings)
 * to communicate directly with Supabase Edge Function 'team-invitations'
 * and Direct Supabase Client with PostgreSQL Row-Level Security.
 * ZERO server-side secrets or service role keys allowed here.
 */

import { invokeEdgeFunction, type EdgeInvokeOptions } from "../edge-client";
import { supabase as defaultSupabase } from "@/integrations/supabase/client";

export interface UnifiedTeamMember {
  id: string;
  entityType: "barber" | "staff";
  domainId: string;
  userId: string | null;
  name: string;
  displayName: string | null;
  responsibleName: string | null;
  email: string;
  phone: string;
  avatarUrl: string | null;
  role: string;
  roleLabel: string;
  category: "barber" | "reception" | "manager" | "financial" | "admin";
  status: "active" | "inactive";
  accessStatus: "active_account" | "no_auth";
  isProfileComplete: boolean;
  commissionRate: number | null;
  commissionType: string | null;
  barberCategory: string | null;
  specialties: string[] | null;
  appointmentsCount: number;
  createdAt: string | null;
}

export interface TeamInvitation {
  id: string;
  email: string;
  phone: string | null;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  invitedBy?: string | null;
  professionalId?: string | null;
}

export interface InviteTeamMemberInput {
  email: string;
  role: string;
  phone?: string;
  professionalId?: string;
  tenantId: string;
}

export interface ResendTeamInvitationInput {
  invitationId: string;
  tenantId?: string;
}

export interface RevokeTeamInvitationInput {
  invitationId: string;
  tenantId?: string;
}

export interface ValidateInvitationTokenInput {
  token: string;
}

export interface AcceptTeamInvitationInput {
  token: string;
  password: string;
}

function unwrapInput<T>(input: T | { data: T }): T {
  if (input && typeof input === "object" && "data" in input && (input as any).data) {
    return (input as { data: T }).data;
  }
  return input as T;
}

function getRoleLabel(role?: string | null, category?: string | null): string {
  const map: Record<string, string> = {
    admin: "Administrador",
    tenant_admin: "Dono / Administrador",
    super_admin: "Super Admin",
    manager: "Gerente",
    reception: "Recepção",
    receptionist: "Recepcionista",
    financial: "Financeiro",
    finance: "Financeiro",
    cashier: "Caixa",
    barber: "Barbeiro",
    professional: "Profissional",
  };
  if (category) {
    return `Barbeiro (${category})`;
  }
  return (role && map[role.toLowerCase()]) || role || "Colaborador";
}

function mapRoleToCategory(role?: string | null): "barber" | "reception" | "manager" | "financial" | "admin" | null {
  if (!role) return null;
  const r = role.toLowerCase().trim();
  if (r === "client" || r === "customer") return null;
  if (r === "barber" || r === "professional") return "barber";
  if (r === "reception" || r === "receptionist") return "reception";
  if (r === "manager") return "manager";
  if (r === "financial" || r === "finance" || r === "cashier") return "financial";
  if (r === "admin" || r === "tenant_admin" || r === "super_admin" || r === "shop_owner") return "admin";
  return null;
}

/**
 * Lists all active team members (barbers and staff) for a tenant via Direct Client with RLS.
 */
export async function getTeamMembers(
  rawInput: { tenantId: string } | { data: { tenantId: string } },
  options?: EdgeInvokeOptions
): Promise<UnifiedTeamMember[]> {
  const input = unwrapInput(rawInput);
  const client = options?.client || defaultSupabase;

  const [barbersRes, membershipsRes] = await Promise.all([
    client
      .from("barbers")
      .select("id, name, email, phone, avatar_url, active, user_id, commission_rate, commission_type, category, specialties, created_at")
      .eq("tenant_id", input.tenantId),
    client
      .from("tenant_memberships")
      .select("id, user_id, role, status, created_at")
      .eq("tenant_id", input.tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
  ]);

  if (barbersRes.error) {
    console.error("[getTeamMembers] Error loading barbers:", barbersRes.error);
    throw new Error(`Erro ao buscar barbeiros: ${barbersRes.error.message}`);
  }

  if (membershipsRes.error) {
    console.error("[getTeamMembers] Error loading tenant memberships:", membershipsRes.error);
    throw new Error(`Erro ao buscar colaboradores da equipe: ${membershipsRes.error.message}`);
  }

  // 1. Collect user IDs from tenant memberships to fetch profiles
  const staffUserIds = Array.from(
    new Set(
      (membershipsRes.data || [])
        .map((m) => m.user_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const profilesMap = new Map<string, any>();
  if (staffUserIds.length > 0) {
    const profilesRes = await client
      .from("profiles")
      .select("id, display_name, responsible_name, email, phone, avatar_url, role")
      .in("id", staffUserIds);

    if (profilesRes.error) {
      console.error("[getTeamMembers] Error loading staff profiles:", profilesRes.error);
      throw new Error(`Erro ao buscar perfis dos colaboradores: ${profilesRes.error.message}`);
    }

    if (profilesRes.data) {
      for (const prof of profilesRes.data) {
        profilesMap.set(prof.id, prof);
      }
    }
  }

  const unifiedList: UnifiedTeamMember[] = [];
  const registeredUserIds = new Set<string>();

  // 2. Process Barbers
  if (barbersRes.data) {
    for (const barber of barbersRes.data) {
      if (barber.user_id) {
        registeredUserIds.add(barber.user_id);
      }
      unifiedList.push({
        id: `barber-${barber.id}`,
        entityType: "barber",
        domainId: barber.id,
        userId: barber.user_id || null,
        name: barber.name,
        displayName: barber.name,
        responsibleName: null,
        email: barber.email || "",
        phone: barber.phone || "",
        avatarUrl: barber.avatar_url,
        role: "barber",
        roleLabel: getRoleLabel("barber", barber.category),
        category: "barber",
        status: barber.active ? "active" : "inactive",
        accessStatus: barber.user_id ? "active_account" : "no_auth",
        isProfileComplete: Boolean(barber.user_id),
        commissionRate: barber.commission_rate,
        commissionType: barber.commission_type,
        barberCategory: barber.category,
        specialties: barber.specialties,
        appointmentsCount: 0,
        createdAt: barber.created_at,
      });
    }
  }

  // 3. Process Staff Memberships (Reception, Manager, Finance, Admin)
  if (membershipsRes.data) {
    for (const mem of membershipsRes.data) {
      if (mem.user_id && registeredUserIds.has(mem.user_id)) {
        continue; // Avoid duplicating user who is already mapped as a barber
      }
      const prof = mem.user_id ? profilesMap.get(mem.user_id) : null;
      const category = mapRoleToCategory(mem.role) || "admin";
      const staffName = prof?.display_name || prof?.responsible_name || prof?.email || "Colaborador";
      unifiedList.push({
        id: `staff-${mem.id}`,
        entityType: "staff",
        domainId: mem.id,
        userId: mem.user_id,
        name: staffName,
        displayName: prof?.display_name || prof?.responsible_name || null,
        responsibleName: prof?.responsible_name || null,
        email: prof?.email || "",
        phone: prof?.phone || "",
        avatarUrl: prof?.avatar_url || null,
        role: mem.role,
        roleLabel: getRoleLabel(mem.role),
        category,
        status: mem.status === "active" ? "active" : "inactive",
        accessStatus: "active_account",
        isProfileComplete: true,
        commissionRate: null,
        commissionType: null,
        barberCategory: null,
        specialties: null,
        appointmentsCount: 0,
        createdAt: mem.created_at,
      });
    }
  }

  return unifiedList;
}

/**
 * Lists pending invitations for a tenant via Direct Client with RLS.
 */
export async function getPendingInvitations(
  rawInput: { tenantId: string } | { data: { tenantId: string } },
  options?: EdgeInvokeOptions
): Promise<TeamInvitation[]> {
  const input = unwrapInput(rawInput);
  const client = options?.client || defaultSupabase;

  const { data, error } = await client
    .from("user_invitations")
    .select("id, email, phone, role, status, expires_at, created_at, invited_by, professional_id")
    .eq("tenant_id", input.tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data || []).map((inv: any) => ({
    id: inv.id,
    email: inv.email,
    phone: inv.phone,
    role: inv.role,
    status: inv.status,
    expiresAt: inv.expires_at,
    createdAt: inv.created_at,
    invitedBy: inv.invited_by,
    professionalId: inv.professional_id,
  }));
}

/**
 * Dispatches an invitation email and registers a pending invite via 'team-invitations' Edge Function.
 */
export async function inviteTeamMember(
  rawInput: InviteTeamMemberInput | { data: InviteTeamMemberInput },
  options?: EdgeInvokeOptions
): Promise<{ ok: boolean; message?: string }> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction(
    "team-invitations",
    {
      action: "invite",
      email: input.email,
      role: input.role,
      phone: input.phone,
      professionalId: input.professionalId,
    },
    options
  );

  if (!result.ok) {
    throw new Error(result.message || "Falha ao enviar convite.");
  }

  return { ok: true };
}

/**
 * Resends an invitation email via 'team-invitations' Edge Function.
 */
export async function resendTeamInvitation(
  rawInput: ResendTeamInvitationInput | { data: ResendTeamInvitationInput },
  options?: EdgeInvokeOptions
): Promise<{ ok: boolean }> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction(
    "team-invitations",
    {
      action: "resend",
      invitationId: input.invitationId,
    },
    options
  );

  if (!result.ok) {
    throw new Error(result.message || "Falha ao reenviar convite.");
  }

  return { ok: true };
}

/**
 * Revokes a pending invitation via 'team-invitations' Edge Function.
 */
export async function revokeTeamInvitation(
  rawInput: RevokeTeamInvitationInput | { data: RevokeTeamInvitationInput },
  options?: EdgeInvokeOptions
): Promise<{ ok: boolean }> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction(
    "team-invitations",
    {
      action: "revoke",
      invitationId: input.invitationId,
    },
    options
  );

  if (!result.ok) {
    throw new Error(result.message || "Falha ao revogar convite.");
  }

  return { ok: true };
}

/**
 * Validates a public invitation token via 'team-invitations' Edge Function.
 */
export async function validateInvitationToken(
  rawInput: ValidateInvitationTokenInput | { data: ValidateInvitationTokenInput },
  options?: EdgeInvokeOptions
): Promise<{ valid: boolean; email?: string; role?: string; barbershopName?: string; expiresAt?: string }> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction<{ action: "validate"; token: string }, {
    valid: boolean;
    email?: string;
    role?: string;
    barbershopName?: string;
    expiresAt?: string;
  }>(
    "team-invitations",
    {
      action: "validate",
      token: input.token,
    },
    options
  );

  if (!result.ok) {
    return { valid: false };
  }

  return {
    valid: Boolean((result as any).valid),
    email: (result as any).email,
    role: (result as any).role,
    barbershopName: (result as any).barbershopName,
    expiresAt: (result as any).expiresAt,
  };
}

/**
 * Accepts a team invitation and activates user access via 'team-invitations' Edge Function.
 */
export async function acceptTeamInvitation(
  rawInput: AcceptTeamInvitationInput | { data: AcceptTeamInvitationInput },
  options?: EdgeInvokeOptions
): Promise<{ ok: boolean }> {
  const input = unwrapInput(rawInput);

  const result = await invokeEdgeFunction(
    "team-invitations",
    {
      action: "accept",
      token: input.token,
      password: input.password,
    },
    options
  );

  if (!result.ok) {
    throw new Error(result.message || "Falha ao aceitar convite.");
  }

  return { ok: true };
}
