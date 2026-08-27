import { supabase } from "@/integrations/supabase/client";

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'tenant_admin'
  | 'manager'
  | 'receptionist'
  | 'financial'
  | 'cashier'
  | 'professional'
  | 'client'
  | 'reception'
  | 'finance'
  | 'barber';

export interface AuthenticatedIdentity {
  userId: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  tenantId: string | null;
  tenantSlug: string | null;
  businessName: string | null;
  displayName: string | null;
  barberId: string | null;
  customerId: string | null;
  destination: string;
}

/**
 * Determina a rota padrão canônica para uma identidade autenticada
 */
export function getDefaultRouteForIdentity(identity: AuthenticatedIdentity | null | undefined): string {
  if (!identity || !identity.role) return "/auth";

  switch (identity.role) {
    case "super_admin":
      return "/admin/dashboard";

    case "reception":
    case "receptionist":
      return "/reception";

    case "barber":
    case "professional":
      return identity.tenantSlug && identity.tenantSlug !== "general"
        ? `/${identity.tenantSlug}/profissional`
        : "/auth";

    case "client":
      return identity.tenantSlug && identity.tenantSlug !== "general"
        ? `/${identity.tenantSlug}/portal`
        : "/auth";

    case "manager":
    case "financial":
    case "finance":
    case "cashier":
    case "admin":
    case "tenant_admin":
      return "/dashboard";

    default:
      return "/auth"; // FAIL CLOSED
  }
}

const inFlightResolutions = new Map<string, Promise<AuthenticatedIdentity | null>>();

/**
 * Resolver Canônico de Identidade Autenticada
 *
 * Executa a descoberta e resolução determinística do papel (role),
 * tenant proprietário, slug canônico e rota de destino com base
 * nos dados reais do PostgreSQL/Supabase.
 *
 * Possui deduplicação automática de requisições em voo (in-flight deduplication).
 */
export async function resolveAuthenticatedIdentity(userId: string): Promise<AuthenticatedIdentity | null> {
  if (!userId) return null;

  // Se já houver uma resolução em voo para este userId, reutiliza a mesma Promise
  const existing = inFlightResolutions.get(userId);
  if (existing) {
    return existing;
  }

  const resolutionPromise: Promise<AuthenticatedIdentity | null> = (async (): Promise<AuthenticatedIdentity | null> => {
    try {
      // 1. Consultas paralelas ao perfil base, tabela barbers, user_roles e tenant_memberships
      const [profileRes, barberRes, userRoleRes, membershipRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("barbers").select("id, name, phone, user_id, tenant_id, active").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("tenant_memberships").select("role, tenant_id, status").eq("user_id", userId).eq("status", "active").maybeSingle()
      ]);

    const profile = profileRes.data;
    const barber = barberRes.data;
    const userRole = userRoleRes.data;
    const membership = membershipRes.data;

    // A. Super Admin (Global SaaS Platform Owner)
    if (userRole?.role === 'super_admin' || profile?.role === 'super_admin') {
      const identity: AuthenticatedIdentity = {
        userId,
        email: profile?.email || null,
        phone: profile?.phone || null,
        role: 'super_admin',
        tenantId: null,
        tenantSlug: null,
        businessName: profile?.business_name || null,
        displayName: profile?.display_name || profile?.responsible_name || 'Super Admin',
        barberId: null,
        customerId: null,
        destination: '/admin/dashboard'
      };
      return identity;
    }

    // B. Barber / Colaborador Profissional
    const isBarber = (barber && barber.active) || profile?.role === 'barber' || profile?.role === 'professional';
    if (isBarber) {
      let resolvedBarber = barber;
      // Fallback por e-mail se vínculo user_id ainda não populado
      if (!resolvedBarber && profile?.email) {
        const { data: bByEmail } = await supabase
          .from("barbers")
          .select("id, name, phone, user_id, tenant_id, active")
          .eq("email", profile.email.trim().toLowerCase())
          .maybeSingle();
        resolvedBarber = bByEmail;
      }

      const tenantId = resolvedBarber?.tenant_id || profile?.tenant_id || membership?.tenant_id || null;
      let tenantSlug: string | null = null;

      if (tenantId) {
        const { data: tenantProfile } = await supabase
          .from("profiles")
          .select("slug, business_name")
          .eq("id", tenantId)
          .maybeSingle();
        tenantSlug = tenantProfile?.slug || null;
      }

      const destination = tenantSlug && tenantSlug !== "general"
        ? `/${tenantSlug}/profissional`
        : "/auth";

      const identity: AuthenticatedIdentity = {
        userId,
        email: profile?.email || null,
        phone: resolvedBarber?.phone || profile?.phone || null,
        role: 'barber',
        tenantId,
        tenantSlug,
        businessName: profile?.business_name || null,
        displayName: resolvedBarber?.name || profile?.responsible_name || profile?.display_name || 'Profissional',
        barberId: resolvedBarber?.id || null,
        customerId: null,
        destination
      };
      return identity;
    }

    // C. Explicit Active Tenant Membership (Manager, Reception, Financial, etc.)
    if (membership?.tenant_id && membership?.role) {
      let tenantSlug: string | null = null;
      const { data: tProf } = await supabase
        .from("profiles")
        .select("slug, business_name")
        .eq("id", membership.tenant_id)
        .maybeSingle();
      tenantSlug = tProf?.slug || null;

      const role = membership.role as UserRole;
      const destination = getDefaultRouteForIdentity({
        userId,
        email: profile?.email || null,
        phone: profile?.phone || null,
        role,
        tenantId: membership.tenant_id,
        tenantSlug,
        businessName: tProf?.business_name || profile?.business_name || null,
        displayName: profile?.display_name || profile?.responsible_name || null,
        barberId: null,
        customerId: null,
        destination: ""
      });

      const identity: AuthenticatedIdentity = {
        userId,
        email: profile?.email || null,
        phone: profile?.phone || null,
        role,
        tenantId: membership.tenant_id,
        tenantSlug,
        businessName: tProf?.business_name || profile?.business_name || null,
        displayName: profile?.display_name || profile?.responsible_name || null,
        barberId: null,
        customerId: null,
        destination
      };
      return identity;
    }

    // D. Tenant Owner / Admin (Dono da Barbearia)
    if (profile?.role === 'admin' || profile?.role === 'tenant_admin') {
      const tenantId = profile.id;
      const tenantSlug = profile.slug || null;
      const identity: AuthenticatedIdentity = {
        userId,
        email: profile?.email || null,
        phone: profile?.phone || null,
        role: profile.role,
        tenantId,
        tenantSlug,
        businessName: profile.business_name || null,
        displayName: profile.responsible_name || profile.display_name || profile.business_name || 'Administrador',
        barberId: null,
        customerId: null,
        destination: '/dashboard'
      };
      return identity;
    }

    // E. Manager / Reception / Financial (direto no perfil)
    if (profile?.role && ['manager', 'reception', 'receptionist', 'financial', 'finance', 'cashier'].includes(profile.role)) {
      const tenantId = profile.tenant_id || profile.id;
      let tenantSlug = profile.slug;
      if (!tenantSlug && tenantId) {
        const { data: tProf } = await supabase.from("profiles").select("slug").eq("id", tenantId).maybeSingle();
        tenantSlug = tProf?.slug || null;
      }
      const role = profile.role as UserRole;
      let destination = "/dashboard";
      if (role === 'reception' || role === 'receptionist') destination = "/reception";

      const identity: AuthenticatedIdentity = {
        userId,
        email: profile?.email || null,
        phone: profile?.phone || null,
        role,
        tenantId,
        tenantSlug,
        businessName: profile.business_name || null,
        displayName: profile.responsible_name || profile.display_name || null,
        barberId: null,
        customerId: null,
        destination
      };
      return identity;
    }

    // F. Client (Portal do Cliente)
    if (profile?.role === 'client') {
      const tenantId = profile.tenant_id || null;
      let tenantSlug: string | null = null;
      if (tenantId) {
        const { data: tProf } = await supabase.from("profiles").select("slug").eq("id", tenantId).maybeSingle();
        tenantSlug = tProf?.slug || null;
      }
      const identity: AuthenticatedIdentity = {
        userId,
        email: profile?.email || null,
        phone: profile?.phone || null,
        role: 'client',
        tenantId,
        tenantSlug,
        businessName: null,
        displayName: profile.responsible_name || profile.display_name || 'Cliente',
        barberId: null,
        customerId: null,
        destination: tenantSlug ? `/${tenantSlug}/portal` : "/auth"
      };
      return identity;
    }

    // G. FAIL CLOSED: Perfil desconhecido ou inexistente
    const fallbackIdentity: AuthenticatedIdentity = {
      userId,
      email: profile?.email || null,
      phone: profile?.phone || null,
      role: 'client',
      tenantId: null,
      tenantSlug: null,
      businessName: null,
      displayName: null,
      barberId: null,
      customerId: null,
      destination: '/auth'
    };
    return fallbackIdentity;
  } catch (err) {
    console.error("[IdentityResolver] Erro ao resolver identidade autenticada:", err);
    return null;
  } finally {
    inFlightResolutions.delete(userId);
  }
})();

inFlightResolutions.set(userId, resolutionPromise);
return resolutionPromise;
}
