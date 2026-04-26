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
      "broadcast",
      { event: REFRESH_EVENT },
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
        
        // Salva a rota atual para restauração pós-refresh
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        if (currentPath !== "/" && !currentPath.includes("/login")) {
          localStorage.setItem("jer_last_pwa_path", currentPath);
        }

        
        toast.info("Atualização global detectada!", {
          description: "O sistema está sendo sincronizado para garantir a última versão em todos os módulos.",
          duration: 5000,
        });
        
        setTimeout(async () => {
          console.log("Executing global refresh cleanup...");
          try {
            // Limpar caches para garantir que não pegue arquivos antigos
            if ("caches" in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            }
            
            // Unregister Service Workers para forçar re-registro na próxima carga
            const registrations = await navigator.serviceWorker?.getRegistrations();
            if (registrations) {
              await Promise.all(registrations.map(r => r.unregister()));
            }
          } catch (err) {
            console.error("Error during global refresh cleanup:", err);
          }
          
          window.location.reload();
        }, 2000);
      },
    )
    .subscribe((status) => {
      console.log("Global refresh subscription status:", status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
