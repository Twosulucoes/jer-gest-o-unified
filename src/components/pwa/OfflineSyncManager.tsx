import { useEffect, useRef } from "react";
import { syncOfflineQueue } from "@/lib/offlineQueue";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

/**
 * Background manager for offline data synchronization.
 * Triggers sync on network recovery and periodically.
 */
export function OfflineSyncManager() {
  const { user } = useAuth();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    if (!user) return;

    const handleSync = async () => {
      if (isSyncingRef.current || !navigator.onLine) return;
      isSyncingRef.current = true;
        try {
          const result = await syncOfflineQueue();
          if (!isMounted) return;
          
          if (result.count > 0) {
            toast.success(`${result.count} registro(s) sincronizados com sucesso.`, {
              description: "Os dados coletados offline foram enviados ao servidor."
            });
          }
          if (result.errors && result.errors > 0) {
            toast.error(`Falha ao sincronizar ${result.errors} registro(s).`, {
              description: "Verifique a Central de Conflitos no menu PWA."
            });
          }
        } catch (error) {
          console.error("Sync error:", error);
        } finally {
          isSyncingRef.current = false;
        }
    };

    // 1. Sync when coming back online
    window.addEventListener("online", handleSync);
    
    // 2. Periodic sync every 2 minutes while active
    const interval = setInterval(handleSync, 1000 * 60 * 2);
    
    // 3. Initial sync check
    handleSync();

    return () => {
      isMounted = false;
      window.removeEventListener("online", handleSync);
      clearInterval(interval);
    };
  }, [user]);

  return null; // Invisible component
}
