import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface ProfessionalSession {
  barber_id: string;
  phone: string;
  name: string;
  role: 'barber';
  tenant_id: string;
  tenant_slug?: string;
  user_id?: string;
}

interface ProfessionalAuthContextType {
  session: ProfessionalSession | null;
  loading: boolean;
  login: (sessionData: ProfessionalSession) => void;
  logout: () => Promise<void>;
}

const ProfessionalAuthContext = createContext<ProfessionalAuthContextType | undefined>(undefined);

export function ProfessionalAuthProvider({ children }: { children: React.ReactNode }) {
  const { user, role, loading: authLoading, initialized: authInitialized, logout: authLogout } = useAuth();
  const [session, setSession] = useState<ProfessionalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Skip on server
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    if (!authInitialized || authLoading) {
      return;
    }

    // FAIL CLOSED: Se não há usuário Supabase Auth ativo, limpa qualquer resquício
    if (!user) {
      if (session) setSession(null);
      localStorage.removeItem('barber_session');
      setLoading(false);
      return;
    }

    // Se o usuário autenticado não for barber/professional, limpa sessão profissional
    if (role && role !== 'barber' && role !== 'professional') {
      if (session) setSession(null);
      localStorage.removeItem('barber_session');
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function hydrateProfessionalSession() {
      try {
        if (!user?.id) {
          if (isMounted) {
            setSession(null);
            setLoading(false);
          }
          return;
        }

        // Buscar registro de barbeiro vinculado a este auth.users.id
        const { data: barberData, error: barberErr } = await supabase
          .from("barbers")
          .select("id, name, phone, user_id, tenant_id, active")
          .eq("user_id", user.id)
          .maybeSingle();

        if (barberErr || !barberData || !barberData.active) {
          console.warn("[ProfessionalAuth] Usuário autenticado não possui vínculo ativo em barbers:", user.id);
          if (isMounted) {
            setSession(null);
            localStorage.removeItem('barber_session');
            setLoading(false);
          }
          return;
        }

        // Buscar slug do tenant correspondente
        let tenantSlug: string | undefined;
        if (barberData.tenant_id) {
          const { data: tenantProfile } = await supabase
            .from("profiles")
            .select("slug")
            .eq("id", barberData.tenant_id)
            .maybeSingle();
          tenantSlug = tenantProfile?.slug || undefined;
        }

        const validSession: ProfessionalSession = {
          barber_id: barberData.id,
          user_id: barberData.user_id,
          phone: barberData.phone || user.phone || "",
          name: barberData.name,
          role: 'barber',
          tenant_id: barberData.tenant_id || "",
          tenant_slug: tenantSlug,
        };

        if (isMounted) {
          setSession(validSession);
          localStorage.setItem('barber_session', JSON.stringify(validSession));
          setLoading(false);
        }
      } catch (err) {
        console.error("[ProfessionalAuth] Erro ao hidratar sessão profissional:", err);
        if (isMounted) {
          setSession(null);
          setLoading(false);
        }
      }
    }

    hydrateProfessionalSession();

    return () => {
      isMounted = false;
    };
  }, [user, role, authLoading, authInitialized]);

  const login = (sessionData: ProfessionalSession) => {
    const fullSession: ProfessionalSession = {
      ...sessionData,
      user_id: sessionData.user_id || user?.id,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('barber_session', JSON.stringify(fullSession));
    }
    setSession(fullSession);
    setLoading(false);
  };

  const logout = async () => {
    console.warn('[AUTH_REDIRECT_TRACE]', {
      source: 'ProfessionalAuthProvider/logout',
      reason: 'Manual professional logout',
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      timestamp: Date.now()
    });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('barber_session');
    }
    setSession(null);
    await authLogout();
    navigate({ to: "/auth" as any });
  };

  return (
    <ProfessionalAuthContext.Provider value={{ session, loading: loading || authLoading, login, logout }}>
      {children}
    </ProfessionalAuthContext.Provider>
  );
}

export function useProfessionalAuth() {
  const context = useContext(ProfessionalAuthContext);
  if (context === undefined) {
    throw new Error("useProfessionalAuth must be used within a ProfessionalAuthProvider");
  }
  return context;
}
