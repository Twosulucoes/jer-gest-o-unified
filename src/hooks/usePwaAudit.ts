import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";

/**
 * Hook to audit PWA module access and usage.
 * Now includes automatic event scope validation.
 */
export function usePwaAudit(moduleName: string, currentModuleEventId?: string | null, additionalData?: any) {
  const { activeEventId } = useEventContext();

  useEffect(() => {
    const logAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Log general access
        await supabase.from("audit_events").insert({
          table_name: "pwa_access",
          record_id: moduleName,
          action: "access",
          created_by: session.user.id,
          payload: {
            module: moduleName,
            activeEventId,
            currentModuleEventId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            ...additionalData,
          },
        });

        // Validate scope: if currentModuleEventId is provided and differs from activeEventId, register alert
        if (currentModuleEventId && activeEventId && currentModuleEventId !== activeEventId) {
          console.warn(`[Scope Audit] Module ${moduleName} is accessing event ${currentModuleEventId} while active event is ${activeEventId}`);
          
          await supabase.from("audit_events").insert({
            table_name: "pwa_scope_violation",
            record_id: moduleName,
            action: "scope_violation",
            created_by: session.user.id,
            payload: {
              module: moduleName,
              violation_type: "context_mismatch",
              requested_event_id: currentModuleEventId,
              active_event_id: activeEventId,
              timestamp: new Date().toISOString(),
              ...additionalData,
            },
          });
        }
      } catch (err) {
        console.error("Failed to log PWA audit:", err);
      }
    };

    logAccess();
  }, [moduleName, currentModuleEventId, activeEventId]);

  /**
   * Manually validate if a given eventId matches the active event scope.
   * Useful for dynamic queries inside the same module.
   */
  const validateEventScope = useCallback(async (targetEventId: string | null, action: string = "query") => {
    if (!targetEventId || !activeEventId) return true;

    if (targetEventId !== activeEventId) {
      console.warn(`[Scope Audit] Module ${moduleName} is accessing event ${targetEventId} while active event is ${activeEventId}`);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from("audit_events").insert({
          table_name: "pwa_scope_violation",
          record_id: moduleName,
          action: "scope_violation",
          created_by: session?.user?.id,
          payload: {
            module: moduleName,
            violation_type: action,
            requested_event_id: targetEventId,
            active_event_id: activeEventId,
            timestamp: new Date().toISOString(),
            ...additionalData,
          },
        });
      } catch (err) {
        console.error("Failed to log scope violation:", err);
      }
      return false;
    }
    return true;
  }, [moduleName, activeEventId, additionalData]);

  return { validateEventScope };
}
