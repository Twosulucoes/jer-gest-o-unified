import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const CACHE_KEY = "jer_offline_user_cache";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

interface CachedUserData {
  userId: string;
  roles: AppRole[];
  profile: { full_name: string | null; avatar_url: string | null } | null;
  cachedAt: number;
}

export function saveUserDataCache(
  userId: string,
  roles: AppRole[],
  profile: CachedUserData["profile"],
): void {
  try {
    const data: CachedUserData = { userId, roles, profile, cachedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // falha silenciosa — storage pode estar cheio ou indisponível
  }
}

export function loadUserDataCache(
  userId: string,
): Pick<CachedUserData, "roles" | "profile"> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CachedUserData = JSON.parse(raw);
    if (data.userId !== userId) return null;
    if (Date.now() - data.cachedAt > MAX_AGE_MS) return null;
    return { roles: data.roles, profile: data.profile };
  } catch {
    return null;
  }
}

export function clearUserDataCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // falha silenciosa
  }
}
