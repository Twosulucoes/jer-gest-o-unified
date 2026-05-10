/**
 * Authentication Hook and Provider for JER Gestão.
 * Handles Supabase session management, user profiling, and role-based access control (RBAC).
 */
import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { saveUserDataCache, loadUserDataCache, clearUserDataCache } from "@/lib/offlineSessionCache";

/** Valid roles in the system from the Database schema */
type AppRole = Database["public"]["Enums"]["app_role"];

/** Public interface for the Auth state */
interface AuthState {
  /** The current Supabase user */
  user: User | null;
  /** The current active session */
  session: Session | null;
  /** List of roles assigned to the current user */
  roles: AppRole[];
  /** User profile information (name and avatar) */
  profile: { full_name: string | null; avatar_url: string | null } | null;
  /** Loading state during initial session check */
  loading: boolean;
  /** True quando roles/profile foram restaurados do cache local por falta de rede */
  isOfflineFallback: boolean;
  /** Function to log out the user */
  signOut: () => Promise<void>;
  /** Helper function to check if the user has a specific role */
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);

  // Guard against processing the same user twice concurrently
  const processingRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const fetchUserData = useCallback(async (userId: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, avatar_url").eq("id", userId).single(),
    ]);

    return {
      roles: (rolesRes.data ?? []).map((r) => r.role),
      profile: profileRes.data ?? null,
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const applySession = async (nextSession: Session | null) => {
      if (!isMounted) return;

      const nextUserId = nextSession?.user?.id ?? null;

      // If we're already processing this exact user, skip
      if (processingRef.current === nextUserId && nextUserId !== null) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        processingRef.current = null;
        setRoles([]);
        setProfile(null);
        setLoading(false);
        return;
      }

      processingRef.current = nextUserId;

      try {
        const userData = await fetchUserData(nextSession.user.id);
        if (!isMounted) return;
        // Verify we are still processing the same user to avoid race conditions
        if (processingRef.current !== nextUserId) return;
        setRoles(userData.roles);
        setProfile(userData.profile);
        setIsOfflineFallback(false);
        saveUserDataCache(nextSession.user.id, userData.roles, userData.profile);
      } catch (err) {
        console.error("Failed to fetch user data:", err);
        // Se estiver offline, tenta restaurar roles/profile do cache local
        if (!navigator.onLine && nextUserId) {
          const cached = loadUserDataCache(nextUserId);
          if (cached && isMounted) {
            setRoles(cached.roles);
            setProfile(cached.profile);
            setIsOfflineFallback(true);
            return;
          }
        }
        setRoles([]);
        setProfile(null);
        setIsOfflineFallback(false);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // 1. Set up listener FIRST (as per Supabase best practice)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // After initial load, onAuthStateChange is the source of truth
      if (initializedRef.current) {
        void applySession(nextSession);
      }
    });

    // 2. Then restore session from storage
    void supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      if (!isMounted) return;
      initializedRef.current = true;
      void applySession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
    try {
      processingRef.current = null;
      clearUserDataCache();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setUser(null);
      setSession(null);
      setRoles([]);
      setProfile(null);
      setIsOfflineFallback(false);
    }
  }, []);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  return (
    <AuthContext.Provider value={{ user, session, roles, profile, loading, isOfflineFallback, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
