import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  const { user, identity, loading: authLoading, initialized: authInitialized, logout: authLogout } = useAuth();
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
      setLoading(true);
      return;
    }

    // FAIL CLOSED: Se não há usuário Supabase Auth ativo ou identidade resolvida
    if (!user || !identity) {
      if (session) setSession(null);
      localStorage.removeItem('barber_session');
      setLoading(false);
      return;
    }

    // Se a identidade canônica for de colaborador/barbeiro, sincroniza a sessão profissional
    if (identity.role === 'barber' || identity.role === 'professional') {
      const validSession: ProfessionalSession = {
        barber_id: identity.barberId || "",
        user_id: identity.userId,
        phone: identity.phone || user.phone || "",
        name: identity.displayName || "Profissional",
        role: 'barber',
        tenant_id: identity.tenantId || "",
        tenant_slug: identity.tenantSlug || undefined,
      };

      setSession(validSession);
      localStorage.setItem('barber_session', JSON.stringify(validSession));
      setLoading(false);
    } else {
      // Para qualquer outro perfil (admin, super_admin, manager, client), descarta sessão de barbeiro
      if (session) setSession(null);
      localStorage.removeItem('barber_session');
      setLoading(false);
    }
  }, [user, identity, authLoading, authInitialized]);

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
