import { useState, useEffect, useCallback, createContext, useContext } from "react";
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

  const fetchUserData = useCallback(async (userId: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, avatar_url").eq("id", userId).single(),
    ]);

    if (rolesRes.data) {
      setRoles(rolesRes.data.map((r) => r.role));
    }
    if (profileRes.data) {
      setProfile(profileRes.data);
    }
  }, []);

  useEffect(() => {
    let initialised = false;

    // Restore session from storage first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initialised) {
        initialised = true;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserData(session.user.id);
        }
        setLoading(false);
      }
    });

    // Then listen for subsequent changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!initialised) {
          // getSession hasn't resolved yet; let it handle the first state
          initialised = true;
        }
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fire-and-forget to avoid blocking the callback
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setRoles([]);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
    setProfile(null);
  }, []);

  const hasRole = useCallback(
    (role: AppRole) => roles.includes(role),
    [roles]
  );

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
