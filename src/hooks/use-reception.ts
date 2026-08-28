import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useTenant } from "./use-tenant";
import {
  canReceptionPerform,
  DEFAULT_RECEPTION_PERMISSIONS,
  type ReceptionAction,
} from "@/lib/reception-permissions";

/**
 * Contexto do Portal da Recepção.
 * - Dono/admin da barbearia: acesso total (usa o próprio tenant).
 * - Usuário de recepção: autorização canônica via role de recepção / tenant_memberships / reception_permissions.
 */
export function useReception() {
  const { user, profile, loading: authLoading } = useAuth();
  const { tenantId: resolvedTenantId } = useTenant();

  const isOwner =
    profile?.role === "tenant_admin" ||
    profile?.role === "admin" ||
    profile?.role === "super_admin";

  const isReceptionRole =
    profile?.role === "reception" ||
    profile?.role === "receptionist";

  const { data: receptionRow, isLoading: rowLoading } = useQuery({
    queryKey: ["reception-permissions", user?.id],
    enabled: !!user?.id && !isOwner,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reception_permissions")
        .select("id, tenant_id, permissions, is_active")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  const tenantId = isOwner
    ? resolvedTenantId || profile?.tenant_id || profile?.id || null
    : resolvedTenantId || receptionRow?.tenant_id || profile?.tenant_id || null;

  const isMatchingReceptionRow = receptionRow && (!resolvedTenantId || receptionRow.tenant_id === resolvedTenantId);

  const permissions = (isMatchingReceptionRow ? (receptionRow.permissions as Record<string, any> | null) : null) ??
    (isReceptionRole ? DEFAULT_RECEPTION_PERMISSIONS : null);

  const isReception = (isReceptionRole && !!tenantId) || (Boolean(isMatchingReceptionRow) && !!tenantId);
  const hasAccess = Boolean(isOwner || isReception);
  const loading = authLoading || (!isOwner && !isReceptionRole && rowLoading);

  const can = (action: ReceptionAction) =>
    canReceptionPerform(action, { isOwner, permissions });

  return { loading, hasAccess, isOwner, isReception, tenantId, permissions, can, user, profile };
}
