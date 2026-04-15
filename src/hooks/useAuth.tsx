import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: { full_name: string | null; avatar_url: string | null } | null;
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [loading, setLoading] = useState(true);

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
        // Verify we're still processing the same user (no newer session arrived)
        if (processingRef.current !== nextUserId) return;
        setRoles(userData.roles);
        setProfile(userData.profile);
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
    processingRef.current = null;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
    setProfile(null);
  }, []);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  return (
    <AuthContext.Provider value={{ user, session, roles, profile, loading, signOut, hasRole }}>
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
