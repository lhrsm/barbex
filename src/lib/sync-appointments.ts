import type { QueryClient } from "@tanstack/react-query";

/**
 * BARBEX R2E.26A — Sincronização Global de Agendamentos entre Painéis
 * Lista exaustiva de queryKeys do TanStack Query afetadas por mutações em agendamentos.
 */
export const APPOINTMENT_QUERY_KEYS = [
  "appointments",
  "calendar",
  "dashboard",
  "dashboard-appointments",
  "calendar-appointments",
  "customerAppointments",
  "customer-appointments",
  "reception-queue",
  "reception-stats",
  "reception-barbers",
  "today-appointments",
  "admin-stats",
  "finances",
  "finances-appointments",
  "financial-summary",
  "customer-portal",
] as const;

export interface AppointmentSyncOptions {
  appointmentId?: string;
  status?: string;
  source?: string;
  tenantId?: string;
  barberId?: string;
}

/**
 * Invalida todas as queries do TanStack Query e despacha eventos no barramento local (window)
 * para atualização instantânea na mesma aba e entre componentes montados simultaneamente.
 */
export function invalidateAllAppointmentQueries(
  queryClient: QueryClient,
  options?: AppointmentSyncOptions
) {
  if (!queryClient) return;

  for (const key of APPOINTMENT_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("REFRESH_DASHBOARD_DATA", {
        detail: options || {},
      })
    );
    window.dispatchEvent(
      new CustomEvent("REFRESH_APPOINTMENTS_DATA", {
        detail: options || {},
      })
    );
  }
}
