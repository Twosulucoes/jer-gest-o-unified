import { supabase } from "@/integrations/supabase/client";

const REFRESH_EVENT = "refresh_all";
const RELOAD_GUARD_KEY = "jer-global-refresh-at";
const RELOAD_GUARD_WINDOW_MS = 10_000;

export async function dispatchGlobalRefresh() {
  const { error } = await supabase.from("system_commands").insert({
    command: REFRESH_EVENT,
    payload: {
      reason: "manual_super_admin",
      requested_at: new Date().toISOString(),
    },
  });

  if (error) throw error;
}

export function installGlobalRefreshListener() {
  const channel = supabase
    .channel("system-commands-refresh")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "system_commands",
        filter: `command=eq.${REFRESH_EVENT}`,
      },
      () => {
        const lastAtRaw = sessionStorage.getItem(RELOAD_GUARD_KEY);
        const lastAt = lastAtRaw ? Number(lastAtRaw) : 0;
        const now = Date.now();
        if (Number.isFinite(lastAt) && now - lastAt < RELOAD_GUARD_WINDOW_MS) return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
        window.location.reload();
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
