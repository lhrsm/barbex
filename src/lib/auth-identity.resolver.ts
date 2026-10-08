import { supabase } from "@/integrations/supabase/client";

export type UserRole =
  | "super_admin"
  | "admin"
  | "tenant_admin"
  | "manager"
  | "receptionist"
  | "financial"
  | "cashier"
  | "professional"
  | "client"
  | "customer"
  | "reception"
  | "finance"
  | "barber"
  | "unknown";

export interface AuthenticatedIdentity {
  userId: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  tenantId: string | null;
  tenantSlug: string | null;
  businessName: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
  barberId: string | null;
  customerId: string | null;
  destination: string;
}

/**
 * Determina a rota padrão canônica para uma identidade autenticada
 */
export function getDefaultRouteForIdentity(
  identity: AuthenticatedIdentity | null | undefined,
): string {
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
    case "customer":
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

    case "unknown":
    default:
      return "/auth"; // FAIL CLOSED
  }
}

/**
 * Resolves tenant slug and commercial/business name canonically from barbershops table,
 * falling back to profiles table only for legacy references.
 */
export async function resolveTenantMetadata(
  tenantId: string | null,
): Promise<{ slug: string | null; name: string | null }> {
  if (!tenantId) return { slug: null, name: null };

  const { data: shop } = await supabase
    .from("barbershops")
    .select("slug, name")
    .eq("id", tenantId)
    .maybeSingle();

  if (shop?.slug) {
    return { slug: shop.slug, name: shop.name };
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("slug, business_name")
    .eq("id", tenantId)
    .maybeSingle();

  return {
    slug: prof?.slug || null,
    name: prof?.business_name || null,
  };
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
export async function resolveAuthenticatedIdentity(
  userId: string,
): Promise<AuthenticatedIdentity | null> {
  if (!userId) return null;

  // Se já houver uma resolução em voo para este userId, reutiliza a mesma Promise
  const existing = inFlightResolutions.get(userId);
  if (existing) {
    return existing;
  }

  const resolutionPromise: Promise<AuthenticatedIdentity | null> =
    (async (): Promise<AuthenticatedIdentity | null> => {
      try {
        // 1. Consultas paralelas ao perfil base, tabela barbers, user_roles, tenant_memberships, customers e verificação RPC
        const [profileRes, barberRes, userRoleRes, membershipRes, customerRes, superAdminRpcRes] =
          await Promise.all([
            supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
            supabase
              .from("barbers")
              .select("id, name, phone, user_id, tenant_id, active")
              .eq("user_id", userId)
              .maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
            supabase
              .from("tenant_memberships")
              .select("role, tenant_id, status")
              .eq("user_id", userId)
              .eq("status", "active")
              .maybeSingle(),
            supabase
              .from("customers")
              .select("id, name, phone, email, tenant_id, user_id")
              .eq("user_id", userId)
              .maybeSingle(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" as any }),
          ]);

        const profile = profileRes.data;
        const barber = barberRes.data;
        const userRole = userRoleRes.data;
        const membership = membershipRes.data;
        const customer = customerRes.data;
        const isSuperAdminRpc = superAdminRpcRes?.data === true;

        // A. Super Admin (Global SaaS Platform Owner)
        if (
          isSuperAdminRpc ||
          userRole?.role === "super_admin" ||
          profile?.role === "super_admin"
        ) {
          const identity: AuthenticatedIdentity = {
            userId,
            email: profile?.email || null,
            phone: profile?.phone || null,
            role: "super_admin",
            tenantId: null,
            tenantSlug: null,
            businessName: profile?.business_name || "SaaS Admin",
            displayName: profile?.display_name || profile?.responsible_name || "Super Admin",
            avatarUrl: profile?.avatar_url || null,
            barberId: null,
            customerId: null,
            destination: "/admin/dashboard",
          };
          return identity;
        }

        // B. Barber / Colaborador Profissional
        const isBarber =
          (barber && barber.active) ||
          profile?.role === "barber" ||
          profile?.role === "professional";
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

          const tenantId =
            resolvedBarber?.tenant_id || profile?.tenant_id || membership?.tenant_id || null;
          let tenantSlug: string | null = null;
          let businessName: string | null = profile?.business_name || null;

          if (tenantId) {
            const meta = await resolveTenantMetadata(tenantId);
            tenantSlug = meta.slug;
            businessName = businessName || meta.name;
          }

          const destination =
            tenantSlug && tenantSlug !== "general" ? `/${tenantSlug}/profissional` : "/auth";

          const identity: AuthenticatedIdentity = {
            userId,
            email: profile?.email || null,
            phone: resolvedBarber?.phone || profile?.phone || null,
            role: "barber",
            tenantId,
            tenantSlug,
            businessName,
            displayName:
              resolvedBarber?.name ||
              profile?.responsible_name ||
              profile?.display_name ||
              "Profissional",
            avatarUrl: profile?.avatar_url || null,
            barberId: resolvedBarber?.id || null,
            customerId: null,
            destination,
          };
          return identity;
        }

        // C. Explicit Active Tenant Membership (Manager, Reception, Financial, etc.)
        if (membership?.tenant_id && membership?.role) {
          const meta = await resolveTenantMetadata(membership.tenant_id);
          const tenantSlug = meta.slug;
          const businessName = meta.name || profile?.business_name || null;

          const role = membership.role as UserRole;
          const destination = getDefaultRouteForIdentity({
            userId,
            email: profile?.email || null,
            phone: profile?.phone || null,
            role,
            tenantId: membership.tenant_id,
            tenantSlug,
            businessName,
            displayName: profile?.display_name || profile?.responsible_name || null,
            avatarUrl: profile?.avatar_url || null,
            barberId: null,
            customerId: null,
            destination: "",
          });

          const identity: AuthenticatedIdentity = {
            userId,
            email: profile?.email || null,
            phone: profile?.phone || null,
            role,
            tenantId: membership.tenant_id,
            tenantSlug,
            businessName,
            displayName: profile?.display_name || profile?.responsible_name || null,
            avatarUrl: profile?.avatar_url || null,
            barberId: null,
            customerId: null,
            destination,
          };
          return identity;
        }

        // D. Tenant Owner / Admin (Dono da Barbearia)
        if (profile?.role === "admin" || profile?.role === "tenant_admin") {
          let tenantId = profile.tenant_id || null;
          let tenantSlug = profile.slug || null;
          let businessName = profile.business_name || null;

          if (!tenantId) {
            const { data: ownedShop } = await supabase
              .from("barbershops")
              .select("id, slug, name")
              .eq("owner_id", userId)
              .maybeSingle();

            if (ownedShop?.id) {
              tenantId = ownedShop.id;
              tenantSlug = ownedShop.slug || tenantSlug;
              businessName = ownedShop.name || businessName;
            }
          }

          if (tenantId && (!tenantSlug || !businessName)) {
            const meta = await resolveTenantMetadata(tenantId);
            tenantSlug = tenantSlug || meta.slug;
            businessName = businessName || meta.name;
          }

          if (!tenantId) {
            // FAIL CLOSED: Admin sem estabelecimento canônico associado
            return {
              userId,
              email: profile?.email || null,
              phone: profile?.phone || null,
              role: "unknown",
              tenantId: null,
              tenantSlug: null,
              businessName: null,
              displayName: profile?.responsible_name || profile?.display_name || null,
              avatarUrl: profile?.avatar_url || null,
              barberId: null,
              customerId: null,
              destination: "/auth",
            };
          }

          const identity: AuthenticatedIdentity = {
            userId,
            email: profile?.email || null,
            phone: profile?.phone || null,
            role: profile.role,
            tenantId,
            tenantSlug,
            businessName,
            displayName:
              profile.responsible_name || profile.display_name || businessName || "Administrador",
            avatarUrl: profile.avatar_url || null,
            barberId: null,
            customerId: null,
            destination: "/dashboard",
          };
          return identity;
        }

        // E. Manager / Reception / Financial (direto no perfil)
        if (
          profile?.role &&
          ["manager", "reception", "receptionist", "financial", "finance", "cashier"].includes(
            profile.role,
          )
        ) {
          let tenantId = profile.tenant_id || null;
          if (!tenantId) {
            const { data: ownedShop } = await supabase
              .from("barbershops")
              .select("id")
              .eq("owner_id", userId)
              .maybeSingle();
            tenantId = ownedShop?.id || null;
          }

          if (!tenantId) {
            // FAIL CLOSED: Staff sem tenant canônico associado
            return {
              userId,
              email: profile?.email || null,
              phone: profile?.phone || null,
              role: "unknown",
              tenantId: null,
              tenantSlug: null,
              businessName: null,
              displayName: profile?.responsible_name || profile?.display_name || null,
              avatarUrl: profile?.avatar_url || null,
              barberId: null,
              customerId: null,
              destination: "/auth",
            };
          }

          const meta = await resolveTenantMetadata(tenantId);
          const tenantSlug = profile.slug || meta.slug;
          const businessName = profile.business_name || meta.name;
          const role = profile.role as UserRole;
          let destination = "/dashboard";
          if (role === "reception" || role === "receptionist") destination = "/reception";

          const identity: AuthenticatedIdentity = {
            userId,
            email: profile?.email || null,
            phone: profile?.phone || null,
            role,
            tenantId,
            tenantSlug,
            businessName,
            displayName: profile.responsible_name || profile.display_name || null,
            avatarUrl: profile.avatar_url || null,
            barberId: null,
            customerId: null,
            destination,
          };
          return identity;
        }

        // F. Client Legítimo (exige vínculo comprovado com tenant)
        const isClientRole = profile?.role === "client" || profile?.role === "customer";
        const hasCustomerLink = Boolean(customer && customer.tenant_id);

        if (isClientRole || hasCustomerLink) {
          const tenantId = profile?.tenant_id || customer?.tenant_id || null;
          let tenantSlug: string | null = null;
          if (tenantId) {
            const meta = await resolveTenantMetadata(tenantId);
            tenantSlug = meta.slug;
          }

          if (tenantId && tenantSlug && tenantSlug !== "general") {
            const identity: AuthenticatedIdentity = {
              userId,
              email: profile?.email || customer?.email || null,
              phone: profile?.phone || customer?.phone || null,
              role: "client",
              tenantId,
              tenantSlug,
              businessName: null,
              displayName:
                profile?.responsible_name || profile?.display_name || customer?.name || "Cliente",
              avatarUrl: profile?.avatar_url || customer?.avatar_url || null,
              barberId: null,
              customerId: customer?.id || null,
              destination: `/${tenantSlug}/portal`,
            };
            return identity;
          }
        }

        // G. FAIL CLOSED: Perfil desconhecido, sem tenant ou sem vínculo comprovado
        const unknownIdentity: AuthenticatedIdentity = {
          userId,
          email: profile?.email || null,
          phone: profile?.phone || null,
          role: "unknown",
          tenantId: null,
          tenantSlug: null,
          businessName: null,
          displayName: profile?.responsible_name || profile?.display_name || null,
          avatarUrl: profile?.avatar_url || null,
          barberId: null,
          customerId: null,
          destination: "/auth",
        };
        return unknownIdentity;
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
