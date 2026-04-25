import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to audit PWA module access and usage.
 */
export function usePwaAudit(moduleName: string, additionalData?: any) {
  useEffect(() => {
    const logAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await supabase.from("audit_events").insert({
          table_name: "pwa_access",
          record_id: moduleName,
          action: "access",
          created_by: session.user.id,
          payload: {
            module: moduleName,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            ...additionalData,
          },
        });
      } catch (err) {
        console.error("Failed to log PWA access:", err);
      }
    };

    logAccess();
  }, [moduleName]);
}
