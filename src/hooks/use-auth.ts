import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import {
  type UserRole,
  type AuthenticatedIdentity,
  resolveAuthenticatedIdentity,
  getDefaultRouteForIdentity
} from "@/lib/auth-identity.resolver";

export type { UserRole, AuthenticatedIdentity };

export type IdentityStatus = 'legacy' | 'pending' | 'completed';

export interface Profile {
  id: string;
  role: UserRole;
  tenant_id: string | null;
  business_name: string | null;
  full_name: string | null;
  responsible_name: string | null;
  display_name: string | null;
  slug: string | null;
  email: string | null;
  identity_status: IdentityStatus;
  phone: string | null;
}

// Global state shared across useAuth instances
let globalUser: User | null = null;
let globalSession: Session | null = null;
let globalIdentity: AuthenticatedIdentity | null = null;
let globalProfile: Profile | null = null;
let globalLoading = false; 
let globalAuthInitialized = false;
let globalRefreshing = false;

if (typeof window === 'undefined') {
  globalLoading = false;
  globalAuthInitialized = true;
}

let initialized = false;
let initializationPromise: Promise<void> | null = null;
let currentResolutionId = 0;

const listeners = new Set<(state: {
  user: User | null;
  session: Session | null;
  identity: AuthenticatedIdentity | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  refreshing: boolean;
}) => void>();

function emit() {
  const state = {
    user: globalUser,
    session: globalSession,
    identity: globalIdentity,
    profile: globalProfile,
    loading: globalLoading,
    initialized: globalAuthInitialized,
    refreshing: globalRefreshing
  };
  listeners.forEach((l) => l(state));
}

function setState(partial: Partial<{
  user: User | null;
  session: Session | null;
  identity: AuthenticatedIdentity | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  refreshing: boolean;
}>) {
  if (partial.user !== undefined) globalUser = partial.user;
  if (partial.session !== undefined) globalSession = partial.session;
  if (partial.identity !== undefined) globalIdentity = partial.identity;
  if (partial.profile !== undefined) globalProfile = partial.profile;
  if (partial.loading !== undefined) globalLoading = partial.loading;
  if (partial.initialized !== undefined) globalAuthInitialized = partial.initialized;
  if (partial.refreshing !== undefined) globalRefreshing = partial.refreshing;
  emit();
}

/**
 * Executa a resolução assíncrona da identidade fora do GoTrue auth lock.
 * Possui proteção de geração (resolutionId) contra race conditions e logout concorrente.
 */
async function executeIdentityResolution(userId: string, resolutionId: number) {
  try {
    const identity = await resolveAuthenticatedIdentity(userId);

    // Stale check: se a sessão foi alterada/deslogada durante a query, descarta o resultado
    if (resolutionId !== currentResolutionId) {
      console.warn("[useAuth] Descartando resolução obsoleta para usuário:", userId);
      return null;
    }

    if (!identity) {
      setState({
        identity: null,
        profile: null,
        loading: false,
        refreshing: false,
        initialized: true,
      });
      return null;
    }

    // Mapeamento compatível para interface Profile legada
    const profile: Profile = {
      id: identity.userId,
      role: identity.role,
      tenant_id: identity.tenantId,
      business_name: identity.businessName,
      full_name: identity.displayName,
      responsible_name: identity.displayName,
      display_name: identity.displayName,
      slug: identity.tenantSlug,
      email: identity.email,
      identity_status: 'completed',
      phone: identity.phone,
    };

    setState({
      identity,
      profile,
      loading: false,
      refreshing: false,
      initialized: true,
    });

    return identity;
  } catch (err) {
    console.error("[useAuth] Erro ao resolver identidade:", err);
    if (resolutionId === currentResolutionId) {
      setState({ loading: false, refreshing: false, initialized: true });
    }
    return null;
  }
}

async function initializeAuth() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    if (initialized) return;
    initialized = true;

    if (!globalAuthInitialized) {
      setState({ loading: true, initialized: false });
    }

    // 1. Subscribe to auth events
    // REGRA CRÍTICA HOTFIX 15G: Callback síncrono e mínimo sem await dentro do GoTrue lock
    supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AUTH_TRACE] onAuthStateChange: ${event}`, { 
        hasSession: !!session,
        userId: session?.user?.id,
        authInitialized: globalAuthInitialized
      });
      
      if (event === 'SIGNED_OUT' || !session?.user) {
        currentResolutionId++; // Invalida qualquer resolução pendente
        globalAuthInitialized = true;
        setState({
          session: null,
          user: null,
          identity: null,
          profile: null,
          loading: false,
          refreshing: false,
          initialized: true
        });
        return;
      }

      // Background token refresh para o mesmo usuário já identificado
      if (event === 'TOKEN_REFRESHED' && globalUser?.id === session.user.id && globalIdentity) {
        setState({ session, user: session.user, refreshing: false });
        return;
      }

      const isSameUser = Boolean(globalUser?.id === session.user.id && globalIdentity !== null);

      if (!isSameUser || (!globalUser && event === 'SIGNED_IN')) {
        if (!globalAuthInitialized) {
          setState({ session, user: session.user, identity: null, profile: null, loading: true, refreshing: false, initialized: false });
        } else {
          setState({ session, user: session.user, refreshing: true });
        }

        // Agenda a resolução da identidade fora do ciclo do listener GoTrue
        const resolutionId = ++currentResolutionId;
        setTimeout(() => {
          executeIdentityResolution(session.user.id, resolutionId);
        }, 0);
      } else {
        setState({ session, user: session.user, refreshing: false });
      }
    });

    // 2. Initial hydration síncrona/inicial
    try {
      if (typeof window !== 'undefined') {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const { data: { session } } = await supabase.auth.getSession();
      console.log("[AUTH_TRACE] Initial getSession:", { hasSession: !!session });
      
      if (session?.user) {
        setState({ session, user: session.user, loading: true, initialized: false });
        const resolutionId = ++currentResolutionId;
        await executeIdentityResolution(session.user.id, resolutionId);
      } else {
        setState({ session: null, user: null, identity: null, profile: null, loading: false, initialized: true });
      }
    } catch (err) {
      console.error("[AUTH_TRACE] getSession error:", err);
      setState({ session: null, user: null, identity: null, profile: null, loading: false, initialized: true });
    } finally {
      globalAuthInitialized = true;
      setState({ loading: false, refreshing: false, initialized: true });
      console.log("[AUTH_TRACE] Initialization complete", { 
        loading: globalLoading, 
        user: !!globalUser, 
        identity: !!globalIdentity,
        initialized: globalAuthInitialized
      });
    }
  })();

  return initializationPromise;
}

export function useAuth() {
  const [state, setLocalState] = useState({
    user: globalUser,
    session: globalSession,
    identity: globalIdentity,
    profile: globalProfile,
    loading: typeof window === 'undefined' ? false : (!globalAuthInitialized ? true : globalLoading),
    initialized: globalAuthInitialized,
    refreshing: globalRefreshing,
  });

  useEffect(() => {
    if (initialized) {
      setLocalState({
        user: globalUser,
        session: globalSession,
        identity: globalIdentity,
        profile: globalProfile,
        loading: globalLoading,
        initialized: globalAuthInitialized,
        refreshing: globalRefreshing,
      });
    }

    const listener = (next: typeof state) => {
      setLocalState(next);
    };
    listeners.add(listener);

    if (!initialized && typeof window !== 'undefined') {
      initializeAuth();
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const logout = async () => {
    currentResolutionId++;
    await supabase.auth.signOut();
    setState({
      session: null,
      user: null,
      identity: null,
      profile: null,
      loading: false,
      refreshing: false,
      initialized: true
    });
  };

  return {
    user: state.user,
    session: state.session,
    identity: state.identity,
    profile: state.profile,
    role: state.identity?.role || state.profile?.role || null,
    destination: state.identity?.destination || (state.profile ? getDefaultRouteForIdentity(state.identity) : "/auth"),
    loading: state.loading,
    initialized: state.initialized,
    refreshing: state.refreshing,
    logout,
  };
}
