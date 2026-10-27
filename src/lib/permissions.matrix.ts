import { type PermissionKey } from "@/hooks/use-permissions";
import { type UserRole } from "@/hooks/use-auth";

/**
 * Matriz Canônica de Permissões por Perfil (RBAC) do Barbex
 */
export const ROLE_PERMISSIONS_MATRIX: Record<UserRole, PermissionKey[] | ["*"]> = {
  super_admin: ["*"],
  admin: ["*"],
  tenant_admin: ["*"],

  manager: [
    "dashboard:view",
    "command_center:view",
    "appointments:view",
    "appointments:create",
    "appointments:manage",
    "clients:view",
    "clients:manage",
    "professionals:view",
    "marketing:view",
    "marketing:manage",
  ],

  reception: [
    "appointments:view",
    "appointments:create",
    "appointments:manage",
    "clients:view",
    "clients:manage",
    "professionals:view",
  ],

  receptionist: [
    "appointments:view",
    "appointments:create",
    "appointments:manage",
    "clients:view",
    "clients:manage",
    "professionals:view",
  ],

  financial: [
    "dashboard:view",
    "finances:view",
    "finances:manage",
  ],

  finance: [
    "dashboard:view",
    "finances:view",
    "finances:manage",
  ],

  cashier: [
    "dashboard:view",
    "finances:view",
    "appointments:view",
  ],

  barber: [
    "appointments:view",
    "professionals:view",
  ],

  professional: [
    "appointments:view",
    "professionals:view",
  ],

  client: [],
  customer: [],
  unknown: [],
};

/**
 * Verifica se um papel tem permissão para uma chave específica
 */
export function checkRolePermission(role: UserRole | null | undefined, permission: PermissionKey): boolean {
  if (!role) return false;
  if (role === "super_admin" || role === "admin" || role === "tenant_admin") return true;

  const perms = ROLE_PERMISSIONS_MATRIX[role] as readonly (PermissionKey | "*")[];
  if (!perms || perms.length === 0) return false;
  if ((perms as readonly string[]).includes("*")) return true;
  return (perms as readonly string[]).includes(permission);
}

/**
 * Verifica se o usuário tem autorização para pagar/liquidar comissões (alinhado à RPC pay_barber_commissions_v2)
 */
export function canManageCommissionPayouts({
  role,
  membershipRole,
  isOwner,
  hasManagePermission,
}: {
  role?: string | null;
  membershipRole?: string | null;
  isOwner?: boolean;
  hasManagePermission?: boolean;
}): boolean {
  // 1. Se for o proprietário do estabelecimento atual, possui autorização total
  if (isOwner) return true;

  // 2. Se o vínculo com o tenant atual for de recepção, barbeiro, cliente ou desconhecido, BLOQUEIO IMEDIATO
  if (
    membershipRole === "reception" ||
    membershipRole === "receptionist" ||
    membershipRole === "barber" ||
    membershipRole === "professional" ||
    membershipRole === "client" ||
    membershipRole === "customer"
  ) {
    return false;
  }

  // 3. Se possuir papel ativo autorizado no tenant atual
  if (
    membershipRole === "owner" ||
    membershipRole === "admin" ||
    membershipRole === "tenant_admin" ||
    membershipRole === "financial" ||
    membershipRole === "finance" ||
    membershipRole === "manager"
  ) {
    return true;
  }

  // 4. Sem vínculo explícito no tenant: somente perfis administrativos globais autorizados
  if (
    role === "super_admin" ||
    role === "admin" ||
    role === "tenant_admin" ||
    role === "financial" ||
    role === "finance"
  ) {
    return true;
  }

  // 5. Permissão complementar de gerenciamento financeiro (somente se não bloqueado por papel restritivo)
  if (
    hasManagePermission &&
    role !== "reception" &&
    role !== "receptionist" &&
    role !== "barber" &&
    role !== "professional" &&
    role !== "client" &&
    role !== "customer"
  ) {
    return true;
  }

  return false;
}

/**
 * Determina a rota inicial padrão para cada perfil após autenticação
 */
export function getDefaultRouteForRole(role: UserRole | null | undefined, slug?: string | null): string {
  switch (role) {
    case "super_admin":
      return "/admin/dashboard";
    case "reception":
    case "receptionist":
      return "/reception";
    case "barber":
    case "professional":
      return slug && slug !== "general" ? `/${slug}/profissional` : "/auth";
    case "client":
    case "customer":
      return slug && slug !== "general" ? `/${slug}/portal` : "/auth";
    case "manager":
    case "financial":
    case "finance":
    case "cashier":
    case "admin":
    case "tenant_admin":
      return "/dashboard";
    case "unknown":
    default:
      return "/auth";
  }
}
