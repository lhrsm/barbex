import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
 * Invalida todas as queries do TanStack Query e despacha eventos no barramento local (window).
 * A sincronização cross-session e entre dispositivos é realizada de forma estritamente segura
 * pelo Supabase Realtime via PostgreSQL Logical Replication (postgres_changes), protegido por RLS.
 */
export function invalidateAllAppointmentQueries(
  queryClient: QueryClient,
  options?: AppointmentSyncOptions
) {
  if (queryClient) {
    for (const key of APPOINTMENT_QUERY_KEYS) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
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

