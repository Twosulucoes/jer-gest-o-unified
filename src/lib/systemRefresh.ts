import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const REFRESH_EVENT = "refresh_all";
const RELOAD_GUARD_KEY = "jer-global-refresh-at";
const RELOAD_GUARD_WINDOW_MS = 10_000;

export async function dispatchGlobalRefresh() {
  const channel = supabase.channel("system-commands-refresh");
  
  // Envia via broadcast para todos os clientes conectados
  const response = await channel.send({
    type: 'broadcast',
    event: REFRESH_EVENT,
    payload: {
      reason: "manual_super_admin",
      requested_at: new Date().toISOString(),
    },
  });

  if (response !== 'ok') {
    console.error("Error dispatching global refresh via broadcast:", response);
    throw new Error("Falha ao enviar comando de atualização");
  }
}

export function installGlobalRefreshListener() {
  console.log("Installing global refresh listener...");
  
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
      (payload) => {
        console.log("Received global refresh command:", payload);
        
        const lastAtRaw = sessionStorage.getItem(RELOAD_GUARD_KEY);
        const lastAt = lastAtRaw ? Number(lastAtRaw) : 0;
        const now = Date.now();
        
        if (Number.isFinite(lastAt) && now - lastAt < RELOAD_GUARD_WINDOW_MS) {
          console.log("Refresh command throttled (within guard window)");
          return;
        }
        
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
        
        toast.info("Comando de atualização global recebido. Recarregando em breve...", {
          duration: 3000,
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      },
    )
    .subscribe((status) => {
      console.log("Global refresh subscription status:", status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
